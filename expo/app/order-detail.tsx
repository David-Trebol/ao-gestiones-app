import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Copy, MoreHorizontal, Pencil, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors } from '@/constants/colors';
import { cardShadow, radius, webInputReset } from '@/constants/theme';
import StatusBadge, { STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
import SelectSheet from '@/components/SelectSheet';
import type { OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
import { formatISODate, overdueDays } from '@/utils/orderFilters';

type Sheet = 'more' | 'status' | null;

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, deleteOrder, updateOrderField, duplicateOrder } = useData();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const s = useMemo(() => makeStyles(colors), [colors]);
  const order = useMemo(() => orders.find(o => o.id === orderId), [orders, orderId]);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [editingRef, setEditingRef] = useState(false);
  const [refValue, setRefValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [openClient, setOpenClient] = useState(false);
  const [openDocs, setOpenDocs] = useState(false);

  const goBack = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router]);

  const handleEdit = useCallback(() => {
    if (order) router.push(`/order-form?editOrderId=${order.id}` as never);
  }, [order, router]);

  const handleDuplicate = useCallback(() => {
    if (!order) return;
    Alert.alert('Duplicar pedido', `Se creará una copia de ${order.reference_number} como pedido pendiente, sin nº de factura ni de recibo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Duplicar',
        onPress: async () => {
          try {
            const copy = await duplicateOrder(order.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Pedido duplicado', `Se ha creado ${copy.reference_number}.`, [
              { text: 'Seguir aquí', style: 'cancel' },
              { text: 'Abrir la copia', onPress: () => router.replace(`/order-detail?orderId=${copy.id}` as never) },
            ]);
          } catch (e) {
            Alert.alert('No se pudo duplicar', (e as Error).message);
          }
        },
      },
    ]);
  }, [order, duplicateOrder, router]);

  const handleDelete = useCallback(() => {
    if (!order) return;
    Alert.alert('Eliminar pedido', `Se eliminará ${order.reference_number} de forma permanente. Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOrder(order.id);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            goBack();
          } catch (e) {
            Alert.alert('No se pudo eliminar', (e as Error).message);
          }
        },
      },
    ]);
  }, [order, deleteOrder, goBack]);

  const changeStatus = useCallback(
    async (st: OrderStatus) => {
      if (!order || st === order.status) return;
      setBusy(true);
      try {
        await updateOrderField(order.id, 'status', st);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        Alert.alert('No se pudo cambiar el estado', (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [order, updateOrderField],
  );

  const saveRef = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    try {
      await updateOrderField(order.id, 'custom_reference', refValue.trim());
      setEditingRef(false);
    } catch (e) {
      Alert.alert('No se pudo guardar', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [order, refValue, updateOrderField]);

  if (!order) {
    return (
      <View style={[s.root, s.center]}>
        <Stack.Screen options={{ title: 'Pedido' }} />
        <Text style={s.h2}>Pedido no encontrado</Text>
        <Text style={s.muted}>Puede que se haya eliminado.</Text>
        <Pressable onPress={goBack} style={[s.btn, s.btnSecondary, { marginTop: 16 }]} accessibilityRole="button">
          <Text style={[s.btnText, { color: colors.text }]}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const late = overdueDays(order);
  const shipLines = order.shipping_items ?? [];
  const shipTotal = shipLines.reduce((a, x) => a + (x.valor_con_iva || 0), 0);
  const profit = order.items.reduce((a, i) => a + (i.beneficio_bruto || 0), 0);
  const hasCost = order.items.some(i => i.costo_unitario > 0);
  const c = order.customer;
  const docs: [string, string][] = (
    [
      ['Nº pedido del cliente', c.numero_referencia_pedido],
      ['Oferta / proforma', c.oferta_proforma],
      ['Nº factura', c.numero_factura],
      ['Nº recibo / albarán', c.numero_recibo],
      ['Condiciones de entrega', c.condiciones_entrega],
      ['Condiciones de pago', c.condiciones_pago],
    ] as [string, string][]
  ).filter(([, v]) => !!v?.trim());

  // ---------------------------------------------------------------- bloques
  const summary = (
    <View style={[s.card, s.summary, cardShadow(isDark)]}>
      <View style={s.summaryTop}>
        <View style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }}>
          <Text style={s.caption}>Referencia</Text>
          <Text style={s.ref} selectable>
            {order.reference_number}
          </Text>
          {editingRef ? (
            <View style={s.refEditRow}>
              <TextInput
                value={refValue}
                onChangeText={setRefValue}
                placeholder="Referencia manual"
                placeholderTextColor={colors.textTertiary}
                style={s.refInput}
                autoFocus
                onSubmitEditing={saveRef}
                returnKeyType="done"
                accessibilityLabel="Referencia manual"
              />
              <Pressable onPress={saveRef} disabled={busy} style={[s.iconBtn, { backgroundColor: colors.primary }]} accessibilityLabel="Guardar referencia manual">
                <Check size={18} color="#fff" />
              </Pressable>
              <Pressable onPress={() => setEditingRef(false)} style={[s.iconBtn, { backgroundColor: colors.fill }]} accessibilityLabel="Cancelar">
                <X size={18} color={colors.text} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setRefValue(order.custom_reference || '');
                setEditingRef(true);
              }}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.refManual, hovered && { backgroundColor: colors.fill }]}
              accessibilityRole="button"
              accessibilityLabel="Editar referencia manual"
            >
              <Text style={s.muted}>
                Ref. manual: <Text style={{ color: colors.text }}>{order.custom_reference || '—'}</Text>
              </Text>
              <Pencil size={13} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={s.totalBox}>
          <Text style={s.caption}>Total con IVA</Text>
          <Text style={s.total} accessibilityLabel={`Total ${formatCurrency(order.total_with_vat)}`}>
            {formatCurrency(order.total_with_vat)}
          </Text>
        </View>
      </View>

      <View style={s.statusRow}>
        <StatusBadge status={order.status} />
        <Pressable onPress={() => setSheet('status')} disabled={busy} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.linkBtn, hovered && { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel="Cambiar estado" testID="change-status">
          <Text style={s.link}>Cambiar estado</Text>
          <ChevronDown size={14} color={colors.primary} />
        </Pressable>
      </View>

      <View style={s.metaGrid}>
        <Meta s={s} label="Fabricante" value={`${order.manufacturer_name} (${order.manufacturer_code})`} />
        <Meta s={s} label="Año" value={String(order.year)} />
        <Meta s={s} label="Creado" value={formatDate(order.created_at)} />
        <Meta s={s} label="Última actualización" value={formatDate(order.updated_at)} />
      </View>

      <View style={[s.follow, late !== null && late > 0 && { backgroundColor: colors.errorBg, borderColor: colors.errorBorder }]}>
        <Text style={s.caption}>Seguimiento</Text>
        {order.expected_date || order.owner || order.next_action ? (
          <View style={s.followGrid}>
            <Meta s={s} label="Fecha prevista" value={order.expected_date ? `${formatISODate(order.expected_date)}${late !== null ? (late > 0 ? ` · ${late} día${late === 1 ? '' : 's'} de retraso` : ' · es hoy') : ''}` : '—'} tone={late !== null && late > 0 ? colors.error : undefined} />
            <Meta s={s} label="Responsable" value={order.owner || '—'} />
            <View style={[s.meta, { flexBasis: '100%' }]}>
              <Text style={s.caption}>Siguiente acción</Text>
              <Text style={s.metaValue}>{order.next_action || '—'}</Text>
            </View>
          </View>
        ) : (
          <Text style={[s.muted, { marginTop: 2 }]}>Sin fecha prevista, responsable ni siguiente acción. Puedes añadirlos en «Editar pedido».</Text>
        )}
      </View>

      <View style={s.actions}>
        <Pressable onPress={handleEdit} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.btn, { backgroundColor: hovered ? colors.primaryDark : colors.primary, opacity: pressed ? 0.85 : 1 }]} accessibilityRole="button" testID="edit-order-btn">
          <Pencil size={16} color="#fff" />
          <Text style={[s.btnText, { color: '#fff' }]}>Editar pedido</Text>
        </Pressable>
        <Pressable onPress={handleDuplicate} style={({ pressed }) => [s.btn, s.btnSecondary, width < 480 && s.btnIcon, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel="Duplicar pedido" testID="duplicate-order-btn">
          <Copy size={16} color={colors.text} />
          {width >= 480 && <Text style={[s.btnText, { color: colors.text }]}>Duplicar</Text>}
        </Pressable>
        <Pressable onPress={() => setSheet('more')} style={({ pressed }) => [s.btn, s.btnSecondary, s.btnIcon, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel="Más acciones" testID="more-actions-btn">
          <MoreHorizontal size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );

  const finance = (
    <View style={[s.card, s.finance, { backgroundColor: colors.heroTile }]}>
      <Text style={[s.sectionTitleDark]}>Resumen económico</Text>
      <FinRow s={s} label="Productos (sin IVA)" value={order.total_ex_vat} />
      <FinRow s={s} label="IVA de los productos" value={order.total_vat} />
      {shipTotal > 0 && <FinRow s={s} label="Gastos de envío (con IVA)" value={shipTotal} />}
      {order.shipping_cost > 0 && <FinRow s={s} label="Envío extra (importe fijo)" value={order.shipping_cost} />}
      <View style={s.finTotalRow}>
        <Text style={s.finTotalLabel}>Total</Text>
        <Text style={s.finTotal}>{formatCurrency(order.total_with_vat)}</Text>
      </View>
      {hasCost && (
        <Text style={s.finNote}>
          Beneficio bruto de los productos: <Text style={{ color: profit >= 0 ? '#7EE2A0' : '#FF8A80', fontWeight: '600' }}>{formatCurrency(profit)}</Text> (venta sin IVA − coste)
        </Text>
      )}
    </View>
  );

  const products = (
    <View style={[s.card, cardShadow(isDark)]}>
      <View style={s.cardHead}>
        <Text style={s.sectionTitle}>Productos · {order.items.length}</Text>
      </View>
      {order.items.map((it, i) => (
        <View key={i} style={[s.item, i > 0 && s.rowBorder]}>
          <View style={s.itemTop}>
            <Text style={s.itemName} selectable>
              {it.product_name || 'Sin nombre'}
            </Text>
            <Text style={s.itemTotal}>{formatCurrency(it.valor_sin_iva)}</Text>
          </View>
          <Text style={s.muted}>
            {it.quantity} × {formatCurrency(it.pvp_neto_sin_iva)} neto{it.descuento_porcentaje ? ` (dto. ${it.descuento_porcentaje} %)` : ''} · IVA {it.vat_percentage} % · sin IVA
          </Text>
          <View style={s.itemGrid}>
            {it.tpv_unitario > 0 && <Mini s={s} label="Precio venta unit." value={formatCurrency(it.tpv_unitario)} />}
            {it.total_sin_iva > 0 && <Mini s={s} label="Importe antes de dto." value={formatCurrency(it.total_sin_iva)} />}
            {it.costo_unitario > 0 && <Mini s={s} label="Coste unitario" value={formatCurrency(it.costo_unitario)} />}
            <Mini s={s} label="Con IVA" value={formatCurrency(it.valor_con_iva)} />
            {it.costo_unitario > 0 && <Mini s={s} label="Beneficio de la línea" value={formatCurrency(it.beneficio_bruto)} tone={it.beneficio_bruto >= 0 ? colors.success : colors.error} />}
          </View>
        </View>
      ))}
    </View>
  );

  const shipping = shipLines.length > 0 && (
    <View style={[s.card, cardShadow(isDark)]}>
      <View style={s.cardHead}>
        <Text style={s.sectionTitle}>Gastos de envío · {shipLines.length}</Text>
      </View>
      {shipLines.map((x, i) => (
        <View key={i} style={[s.item, i > 0 && s.rowBorder]}>
          <View style={s.itemTop}>
            <Text style={s.itemName}>{x.description || 'Envío'}</Text>
            <Text style={s.itemTotal}>{formatCurrency(x.valor_con_iva)}</Text>
          </View>
          <Text style={s.muted}>
            {x.quantity} × {formatCurrency(x.costo_unitario)} · {formatCurrency(x.valor_sin_iva)} sin IVA · IVA {x.vat_percentage} % · total con IVA
          </Text>
        </View>
      ))}
    </View>
  );

  const collapsible = (title: string, open: boolean, setOpen: (v: boolean) => void, preview: string, body: React.ReactNode) => {
    const isOpen = desktop || open;
    return (
      <View style={[s.card, cardShadow(isDark)]}>
        <Pressable
          onPress={() => !desktop && setOpen(!open)}
          disabled={desktop}
          style={s.cardHeadPress}
          accessibilityRole={desktop ? 'header' : 'button'}
          accessibilityState={desktop ? undefined : { expanded: isOpen }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.sectionTitle}>{title}</Text>
            {!isOpen && !!preview && (
              <Text style={s.preview} numberOfLines={1}>
                {preview}
              </Text>
            )}
          </View>
          {!desktop && (isOpen ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />)}
        </Pressable>
        {isOpen && body}
      </View>
    );
  };

  const client = collapsible(
    'Cliente',
    openClient,
    setOpenClient,
    [c.nombre_empresa, c.contacto].filter(Boolean).join(' · ') || 'Sin datos',
    <View style={s.fields}>
      <Field s={s} label="Empresa" value={c.nombre_empresa} />
      <Field s={s} label="NIF" value={c.nif} />
      <Field s={s} label="Contacto" value={[c.contacto, c.departamento].filter(Boolean).join(' · ')} />
      <Field s={s} label="Dirección" value={[c.direccion_1, c.direccion_2, [c.codigo_postal, c.provincia].filter(Boolean).join(' '), c.pais].filter(Boolean).join('\n')} />
      <Field s={s} label="Teléfono" value={[c.telefono_1, c.telefono_2].filter(Boolean).join(' · ')} />
      <Field s={s} label="Email" value={c.email} />
    </View>,
  );

  const documents = collapsible(
    'Documentos y condiciones',
    openDocs,
    setOpenDocs,
    docs.length ? docs.map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Sin datos',
    docs.length ? (
      <View style={s.fields}>
        {docs.map(([k, v]) => (
          <Field key={k} s={s} label={k} value={v} />
        ))}
      </View>
    ) : (
      <Text style={[s.muted, { paddingHorizontal: 16, paddingBottom: 16 }]}>No hay documentos ni condiciones en este pedido.</Text>
    ),
  );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: order.reference_number }} />
      <ScrollView contentContainerStyle={[s.content, { maxWidth: desktop ? 1200 : 760 }]}>
        {summary}
        {desktop ? (
          <View style={s.cols}>
            <View style={s.colMain}>
              {products}
              {shipping}
            </View>
            <View style={s.colSide}>
              {finance}
              {client}
              {documents}
            </View>
          </View>
        ) : (
          <>
            {finance}
            {products}
            {shipping}
            {client}
            {documents}
          </>
        )}
      </ScrollView>

      <SelectSheet
        visible={sheet === 'status'}
        title="Cambiar estado"
        options={STATUS_ORDER.map(st => ({ value: st, label: statusConfig[st].label }))}
        selected={order.status}
        onSelect={v => void changeStatus(v as OrderStatus)}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet === 'more'}
        title={order.reference_number}
        options={[
          { value: 'status', label: 'Cambiar estado…' },
          { value: 'ref', label: 'Editar referencia manual' },
          { value: 'delete', label: 'Eliminar pedido', destructive: true },
        ]}
        onSelect={v => {
          if (v === 'status') setTimeout(() => setSheet('status'), 50);
          else if (v === 'ref') {
            setRefValue(order.custom_reference || '');
            setEditingRef(true);
          } else if (v === 'delete') handleDelete();
        }}
        onClose={() => setSheet(prev => (prev === 'more' ? null : prev))}
      />
    </View>
  );
}

function Meta({ s, label, value, tone }: { s: Styles; label: string; value: string; tone?: string }) {
  return (
    <View style={s.meta}>
      <Text style={s.caption}>{label}</Text>
      <Text style={[s.metaValue, tone ? { color: tone, fontWeight: '600' } : null]}>{value}</Text>
    </View>
  );
}

function Mini({ s, label, value, tone }: { s: Styles; label: string; value: string; tone?: string }) {
  return (
    <View style={s.mini}>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={[s.miniValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function FinRow({ s, label, value }: { s: Styles; label: string; value: number }) {
  return (
    <View style={s.finRow}>
      <Text style={s.finLabel}>{label}</Text>
      <Text style={s.finValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

function Field({ s, label, value }: { s: Styles; label: string; value?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.caption}>{label}</Text>
      <Text style={[s.fieldValue, !value && { color: s.muted.color as string }]} selectable>
        {value || '—'}
      </Text>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    content: { padding: 16, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 48 },
    cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    colMain: { flex: 1.65, gap: 16, minWidth: 0 },
    colSide: { flex: 1, gap: 16, minWidth: 0 },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' },
    summary: { padding: 20, gap: 16 },
    summaryTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
    caption: { fontSize: 12, fontWeight: '500', color: c.textSecondary, letterSpacing: 0.1 },
    ref: { fontSize: 26, fontWeight: '700', color: c.text, letterSpacing: -0.5, marginTop: 2, fontVariant: ['tabular-nums'] },
    refManual: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingVertical: 4, paddingHorizontal: 6, marginLeft: -6, borderRadius: 8, minHeight: 32 },
    refEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
    refInput: { flex: 1, minWidth: 0, height: 40, borderRadius: radius.sm, backgroundColor: c.fill, paddingHorizontal: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.primary, ...webInputReset },
    iconBtn: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    totalBox: { alignItems: 'flex-start' },
    total: { fontSize: 28, fontWeight: '700', color: c.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'], marginTop: 2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 8, borderRadius: 8 },
    link: { fontSize: 14, color: c.primary, fontWeight: '600' },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    meta: { flexGrow: 1, flexBasis: 150, minWidth: 0 },
    metaValue: { fontSize: 15, color: c.text, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    follow: { borderRadius: radius.md, padding: 12, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
    followGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill },
    btnSecondary: { backgroundColor: c.fill },
    btnIcon: { width: 44, paddingHorizontal: 0 },
    btnText: { fontSize: 15, fontWeight: '600' },
    finance: { padding: 20, gap: 10 },
    sectionTitleDark: { fontSize: 13, fontWeight: '600', color: c.heroTileTextSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
    finRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    finLabel: { fontSize: 15, color: c.heroTileTextSecondary, flex: 1 },
    finValue: { fontSize: 15, color: c.heroTileText, fontVariant: ['tabular-nums'] },
    finTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
    finTotalLabel: { fontSize: 17, fontWeight: '600', color: c.heroTileText },
    finTotal: { fontSize: 26, fontWeight: '700', color: c.heroTileText, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    finNote: { fontSize: 13, color: c.heroTileTextSecondary, marginTop: 4, lineHeight: 18 },
    cardHead: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    cardHeadPress: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
    preview: { fontSize: 15, color: c.text, marginTop: 4 },
    item: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    itemTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    itemName: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '500', color: c.text, lineHeight: 21 },
    itemTotal: { fontSize: 16, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] },
    itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    mini: { backgroundColor: c.fill, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexGrow: 1, flexBasis: 120 },
    miniLabel: { fontSize: 11, color: c.textSecondary },
    miniValue: { fontSize: 14, color: c.text, fontWeight: '500', fontVariant: ['tabular-nums'], marginTop: 1 },
    fields: { paddingHorizontal: 16, paddingBottom: 8 },
    field: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    fieldValue: { fontSize: 15, color: c.text, marginTop: 2, lineHeight: 21 },
    muted: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    h2: { fontSize: 20, fontWeight: '600', color: c.text, marginBottom: 6 },
  });
}

