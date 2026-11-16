import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronUp, Copy, MoreHorizontal, Pencil, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CompactTitleBar, useCollapsingTitle, usePageLayout } from '@/components/Page';
import { canvas, cardShadow, type, webInputReset } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors } from '@/constants/colors';
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
  const { width, content, bottomSpace } = usePageLayout();
  const { shown: compactShown, scrollProps } = useCollapsingTitle(90);
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
  const lateTone = late !== null && late > 0;
  const hasFollowUp = !!(order.expected_date || order.owner || order.next_action);

  const header = (
    <View style={s.top}>
      <View style={s.topBar}>
        <Pressable onPress={goBack} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.backBtn, hovered && { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel="Volver a Pedidos" testID="detail-back">
          <ChevronLeft size={24} color={colors.primary} strokeWidth={2.4} />
          <Text style={s.backText}>Pedidos</Text>
        </Pressable>
        <View style={s.topActions}>
          <Pressable onPress={handleDuplicate} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.roundBtn, (hovered || pressed) && { backgroundColor: colors.primarySoftAlt }]} accessibilityRole="button" accessibilityLabel="Duplicar pedido" testID="duplicate-order-btn">
            <Copy size={18} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => setSheet('more')} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.roundBtn, (hovered || pressed) && { backgroundColor: colors.primarySoftAlt }]} accessibilityRole="button" accessibilityLabel="Más acciones" testID="more-actions-btn">
            <MoreHorizontal size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={s.hero}>
        <View style={{ flexGrow: 1, flexBasis: 260, minWidth: 0 }}>
          <Text style={s.caption}>Referencia</Text>
          <Text style={s.ref} selectable accessibilityRole="header">
            {order.reference_number}
          </Text>
          <View style={s.heroMeta}>
            <Pressable
              onPress={() => setSheet('status')}
              disabled={busy}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.statusBtn, hovered && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`Estado: ${statusConfig[order.status].label}. Cambiar estado`}
              testID="change-status"
            >
              <StatusBadge status={order.status} />
              <ChevronDown size={15} color={colors.textSecondary} />
            </Pressable>
            <Text style={s.heroSub} numberOfLines={1}>
              {order.manufacturer_name} · {order.year}
            </Text>
          </View>
        </View>
        <View style={s.totalBox}>
          <Text style={[s.caption, desktop && { textAlign: 'right' }]}>Total con IVA</Text>
          <Text style={[s.total, desktop && { textAlign: 'right' }]} accessibilityLabel={`Total ${formatCurrency(order.total_with_vat)}`}>
            {formatCurrency(order.total_with_vat)}
          </Text>
        </View>
      </View>

      <View style={s.actions}>
        <Pressable onPress={handleEdit} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.btn, { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: pressed ? 0.85 : 1 }]} accessibilityRole="button" testID="edit-order-btn">
          <Pencil size={16} color="#fff" />
          <Text style={[s.btnText, { color: '#fff' }]}>Editar pedido</Text>
        </Pressable>
      </View>
    </View>
  );

  const section = (title: string, body: React.ReactNode, opts: { trailing?: React.ReactNode; footer?: string } = {}) => (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
        {opts.trailing}
      </View>
      <View style={[s.card, cardShadow(isDark)]}>{body}</View>
      {!!opts.footer && <Text style={s.footer}>{opts.footer}</Text>}
    </View>
  );

  const followUp = section(
    'Seguimiento',
    order.expected_date || order.owner || order.next_action ? (
      <>
        <Row s={s} first label="Fecha prevista" value={order.expected_date ? `${formatISODate(order.expected_date)}${late !== null ? (late > 0 ? ` · ${late} día${late === 1 ? '' : 's'} de retraso` : ' · es hoy') : ''}` : '—'} tone={lateTone ? colors.error : undefined} />
        <Row s={s} label="Responsable" value={order.owner || '—'} />
        <Row s={s} label="Siguiente acción" value={order.next_action || '—'} stacked />
      </>
    ) : (
      <Text style={[s.muted, s.pad]}>Sin fecha prevista, responsable ni siguiente acción. Puedes añadirlos en «Editar pedido».</Text>
    ),
  );

  const finance = section(
    'Resumen económico',
    <>
      <Row s={s} first label="Productos (sin IVA)" value={formatCurrency(order.total_ex_vat)} num />
      <Row s={s} label="IVA de los productos" value={formatCurrency(order.total_vat)} num />
      {shipTotal > 0 && <Row s={s} label="Gastos de envío (con IVA)" value={formatCurrency(shipTotal)} num />}
      {order.shipping_cost > 0 && <Row s={s} label="Envío extra (importe fijo)" value={formatCurrency(order.shipping_cost)} num />}
      <View style={[s.row, s.rowSep, s.totalRow]}>
        <Text style={s.totalRowLabel}>Total</Text>
        <Text style={s.totalRowValue}>{formatCurrency(order.total_with_vat)}</Text>
      </View>
    </>,
    { footer: hasCost ? `Beneficio bruto de los productos: ${formatCurrency(profit)} (venta sin IVA − coste).` : undefined },
  );

  const products = section(
    `Productos`,
    <>
      {order.items.map((it, i) => (
        <View key={i} style={[s.item, i > 0 && s.rowSep]}>
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
    </>,
    { trailing: <Text style={s.sectionCount}>{order.items.length}</Text> },
  );

  const shipping = shipLines.length > 0 && section(
    'Gastos de envío',
    <>
      {shipLines.map((x, i) => (
        <View key={i} style={[s.item, i > 0 && s.rowSep]}>
          <View style={s.itemTop}>
            <Text style={s.itemName}>{x.description || 'Envío'}</Text>
            <Text style={s.itemTotal}>{formatCurrency(x.valor_con_iva)}</Text>
          </View>
          <Text style={s.muted}>
            {x.quantity} × {formatCurrency(x.costo_unitario)} · {formatCurrency(x.valor_sin_iva)} sin IVA · IVA {x.vat_percentage} % · total con IVA
          </Text>
        </View>
      ))}
    </>,
    { trailing: <Text style={s.sectionCount}>{shipLines.length}</Text> },
  );

  /** Sección plegable en móvil (en ordenador siempre abierta) */
  const collapsible = (title: string, open: boolean, setOpen: (v: boolean) => void, preview: string, body: React.ReactNode) => {
    const isOpen = desktop || open;
    return (
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
        </View>
        <View style={[s.card, cardShadow(isDark)]}>
          {!desktop && (
            <Pressable
              onPress={() => setOpen(!open)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.row, hovered && { backgroundColor: colors.fill }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${isOpen ? 'Ocultar' : 'Mostrar'} ${title.toLowerCase()}`}
            >
              <Text style={[s.rowValue, { flex: 1, textAlign: 'left', color: isOpen ? colors.textSecondary : colors.text }]} numberOfLines={1}>
                {isOpen ? 'Ocultar' : preview}
              </Text>
              {isOpen ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
            </Pressable>
          )}
          {isOpen && <View style={!desktop ? s.rowSep : undefined}>{body}</View>}
        </View>
      </View>
    );
  };

  const client = collapsible(
    'Cliente',
    openClient,
    setOpenClient,
    [c.nombre_empresa, c.contacto].filter(Boolean).join(' · ') || 'Sin datos',
    <>
      <Row s={s} first label="Empresa" value={c.nombre_empresa || '—'} />
      <Row s={s} label="NIF" value={c.nif || '—'} />
      <Row s={s} label="Contacto" value={[c.contacto, c.departamento].filter(Boolean).join(' · ') || '—'} />
      <Row s={s} label="Dirección" value={[c.direccion_1, c.direccion_2, [c.codigo_postal, c.provincia].filter(Boolean).join(' '), c.pais].filter(Boolean).join('\n') || '—'} stacked />
      <Row s={s} label="Teléfono" value={[c.telefono_1, c.telefono_2].filter(Boolean).join(' · ') || '—'} />
      <Row s={s} label="Email" value={c.email || '—'} />
    </>,
  );

  const documents = collapsible(
    'Documentos y condiciones',
    openDocs,
    setOpenDocs,
    docs.length ? docs.map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Sin datos',
    docs.length ? (
      <>
        {docs.map(([k, v], i) => (
          <Row key={k} s={s} first={i === 0} label={k} value={v} />
        ))}
      </>
    ) : (
      <Text style={[s.muted, s.pad]}>No hay documentos ni condiciones en este pedido.</Text>
    ),
  );

  const info = section(
    'Datos del pedido',
    <>
      <Row s={s} first label="Fabricante" value={`${order.manufacturer_name} (${order.manufacturer_code})`} />
      <Row s={s} label="Año" value={String(order.year)} />
      <Pressable
        onPress={() => {
          setRefValue(order.custom_reference || '');
          setEditingRef(true);
        }}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.row, s.rowSep, hovered && !editingRef && { backgroundColor: colors.fill }]}
        disabled={editingRef}
        accessibilityRole="button"
        accessibilityLabel="Editar referencia manual"
      >
        <Text style={s.rowLabel}>Ref. manual</Text>
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
            <Pressable onPress={saveRef} disabled={busy} style={[s.iconBtn, { backgroundColor: colors.primaryFill }]} accessibilityLabel="Guardar referencia manual">
              <Check size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setEditingRef(false)} style={[s.iconBtn, { backgroundColor: colors.fill }]} accessibilityLabel="Cancelar">
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <View style={s.rowRight}>
            <Text style={s.rowValue}>{order.custom_reference || '—'}</Text>
            <Pencil size={14} color={colors.textSecondary} />
          </View>
        )}
      </Pressable>
      <Row s={s} label="Creado" value={formatDate(order.created_at)} />
      <Row s={s} label="Última actualización" value={formatDate(order.updated_at)} />
    </>,
  );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: order.reference_number, headerShown: false }} />
      <CompactTitleBar title={order.reference_number} shown={compactShown} />
      <ScrollView {...scrollProps} contentContainerStyle={[s.content, content, { paddingBottom: bottomSpace }]}>
        {header}
        {desktop ? (
          <View style={s.cols}>
            <View style={s.colMain}>
              {products}
              {shipping}
              {client}
              {documents}
            </View>
            <View style={s.colSide}>
              {finance}
              {followUp}
              {info}
            </View>
          </View>
        ) : (
          <>
            {hasFollowUp && followUp}
            {products}
            {shipping}
            {finance}
            {!hasFollowUp && followUp}
            {client}
            {documents}
            {info}
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

function Row({ s, label, value, tone, first, num, stacked }: { s: Styles; label: string; value: string; tone?: string; first?: boolean; num?: boolean; stacked?: boolean }) {
  return (
    <View style={[s.row, !first && s.rowSep, stacked && s.rowStacked]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, stacked && { textAlign: 'left' }, num && { fontVariant: ['tabular-nums'] }, tone ? { color: tone, fontWeight: '600' } : null]} selectable>
        {value}
      </Text>
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

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: canvas(c) },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    content: { gap: 24, width: '100%', alignSelf: 'center', paddingBottom: 48 },
    cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
    colMain: { flex: 1.6, gap: 24, minWidth: 0 },
    colSide: { flex: 1, gap: 24, minWidth: 0 },
    // cabecera
    top: { gap: 14 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginLeft: -8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 10, paddingLeft: 2, borderRadius: 10 },
    backText: { fontSize: 17, color: c.primary, letterSpacing: -0.3 },
    topActions: { flexDirection: 'row', gap: 10 },
    roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
    caption: { fontSize: 13, fontWeight: '500', color: c.textSecondary },
    ref: { ...type.largeTitle, color: c.text, fontVariant: ['tabular-nums'] },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
    statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
    heroSub: { fontSize: 15, color: c.textSecondary, flexShrink: 1 },
    totalBox: { alignItems: 'flex-start' },
    total: { fontSize: 30, fontWeight: '700', color: c.text, letterSpacing: -0.7, fontVariant: ['tabular-nums'], marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 999 },
    btnSecondary: { backgroundColor: c.fill },
    btnText: { fontSize: 15, fontWeight: '600' },
    // secciones agrupadas (como Ajustes de iOS)
    section: { gap: 8 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
    sectionCount: { fontSize: 20, color: c.textSecondary },
    footer: { fontSize: 13, color: c.textSecondary, lineHeight: 18, paddingHorizontal: 16 },
    card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden' },
    pad: { padding: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 11 },
    rowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
    rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    rowLabel: { fontSize: 15, color: c.textSecondary, letterSpacing: -0.2 },
    rowValue: { flex: 1, minWidth: 0, fontSize: 16, color: c.text, textAlign: 'right', letterSpacing: -0.2, lineHeight: 21 },
    rowRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 },
    totalRow: { minHeight: 56 },
    totalRowLabel: { flex: 1, fontSize: 17, fontWeight: '600', color: c.text },
    totalRowValue: { fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
    refEditRow: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' },
    refInput: { flex: 1, minWidth: 0, height: 40, borderRadius: 10, backgroundColor: c.fill, paddingHorizontal: 12, fontSize: 16, color: c.text, borderWidth: 2, borderColor: c.primary, ...webInputReset },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    // productos
    item: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    itemTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    itemName: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: c.text, lineHeight: 21, letterSpacing: -0.2 },
    itemTotal: { fontSize: 16, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] },
    itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    mini: { backgroundColor: c.fill, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexGrow: 1, flexBasis: 120 },
    miniLabel: { fontSize: 12, color: c.textSecondary },
    miniValue: { fontSize: 14, color: c.text, fontWeight: '500', fontVariant: ['tabular-nums'], marginTop: 1 },
    muted: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    h2: { fontSize: 20, fontWeight: '600', color: c.text, marginBottom: 6 },
  });
}
