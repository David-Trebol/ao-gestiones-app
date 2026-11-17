import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, Clock, Copy, Euro, Factory, FileText, IdCard, Mail, MapPin, MoreHorizontal, Package, Pencil, Phone, Receipt, Truck, User, X } from 'lucide-react-native';
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
  // Tabla de productos solo si la columna tiene sitio para todas las cifras (en 1024 se cortaba «Con IVA»)
  const tableWide = width >= 1200;
  const s = useMemo(() => makeStyles(colors), [colors]);
  const order = useMemo(() => orders.find(o => o.id === orderId), [orders, orderId]);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [editingRef, setEditingRef] = useState(false);
  const [refValue, setRefValue] = useState('');
  const [busy, setBusy] = useState(false);

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

  // ---------------------------------------------------------------- bloques
  const lateTone = late !== null && late > 0;
  const hasFollowUp = !!(order.expected_date || order.owner || order.next_action);
  const wide = width >= 1280;
  const narrow = width < 420; // móvil estrecho: cabecera compacta para que el cliente se vea en la primera pantalla
  const phones = [c.telefono_1, c.telefono_2].filter(v => !!v?.trim());
  const cityLine = [c.codigo_postal, c.provincia].filter(Boolean).join(' ');
  const addressLines = [c.direccion_1, c.direccion_2, cityLine, c.pais].filter(v => !!v?.trim());

  // ---------------------------------------------------------------- cabecera
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

      <View style={[s.heroCard, cardShadow(isDark)]}>
        <View style={[s.heroAccent, { backgroundColor: colors.brand }]} />
        <View style={s.heroMain}>
          <Text style={s.caption}>Referencia</Text>
          <Text style={s.ref} selectable accessibilityRole="header">
            {order.reference_number}
          </Text>
          {narrow && !!c.nombre_empresa && (
            <Text style={s.heroCompany} numberOfLines={2}>
              {c.nombre_empresa}
            </Text>
          )}
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
            <View style={s.metaChip}>
              <Factory size={14} color={colors.accent} />
              <Text style={s.metaChipText} numberOfLines={1}>{order.manufacturer_name} · {order.year}</Text>
            </View>
            {!narrow && (
              <View style={s.metaChip}>
                <CalendarDays size={14} color={colors.accent} />
                <Text style={s.metaChipText} numberOfLines={1}>Creado el {formatDate(order.created_at)}</Text>
              </View>
            )}
            {!narrow && !!c.numero_factura && (
              <View style={s.metaChip}>
                <Receipt size={14} color={colors.accent} />
                <Text style={s.metaChipText} numberOfLines={1}>Factura {c.numero_factura}</Text>
              </View>
            )}
          </View>
          {narrow && (
            <Text style={s.heroSmall} numberOfLines={2}>
              Creado el {formatDate(order.created_at)}
              {c.numero_factura ? ` · Factura ${c.numero_factura}` : ''}
            </Text>
          )}
        </View>
        <View style={[s.heroSide, desktop && { alignItems: 'flex-end' }, narrow && s.heroSideRow]}>
          <View style={narrow ? { flexShrink: 1, minWidth: 0 } : undefined}>
            <Text style={[s.caption, desktop && { textAlign: 'right' }]}>Total con IVA</Text>
            <Text style={[s.total, desktop && { textAlign: 'right' }, narrow && { fontSize: 26, letterSpacing: -0.6 }]} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Total ${formatCurrency(order.total_with_vat)}`}>
              {formatCurrency(order.total_with_vat)}
            </Text>
          </View>
          <Pressable
            onPress={handleEdit}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.btn, { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            testID="edit-order-btn"
          >
            <Pencil size={16} color={colors.onPrimary} />
            <Text style={[s.btnText, { color: colors.onPrimary }]}>{narrow ? 'Editar' : 'Editar pedido'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // ---------------------------------------------------------------- bloques
  const card = (title: string, icon: React.ReactNode, body: React.ReactNode, opts: { trailing?: React.ReactNode; footer?: string; flush?: boolean } = {}) => (
    <View style={[s.card, cardShadow(isDark)]}>
      <View style={s.cardHead}>
        <View style={s.cardIcon}>{icon}</View>
        <Text style={s.cardTitle} accessibilityRole="header">{title}</Text>
        {opts.trailing}
      </View>
      <View style={opts.flush ? undefined : s.cardBody}>{body}</View>
      {!!opts.footer && <Text style={s.footer}>{opts.footer}</Text>}
    </View>
  );

  const clientCols = wide ? 3 : width >= 600 ? 2 : 1;
  const client = card(
    'Cliente',
    <Building2 size={16} color={colors.onPrimary} />,
    <>
      <Text style={s.company} selectable>{c.nombre_empresa || 'Sin nombre de empresa'}</Text>
      <View style={s.grid}>
        <Cell s={s} cols={clientCols} icon={<User size={14} color={colors.accent} />} label="Contacto" value={c.contacto} />
        <Cell s={s} cols={clientCols} icon={<Briefcase size={14} color={colors.accent} />} label="Departamento" value={c.departamento} />
        <Cell s={s} cols={clientCols} icon={<IdCard size={14} color={colors.accent} />} label="NIF" value={c.nif} />
        <Cell s={s} cols={clientCols} icon={<Phone size={14} color={colors.accent} />} label={phones.length > 1 ? 'Teléfonos' : 'Teléfono'} value={phones.length ? undefined : ''}>
          {phones.map(t => (
            <Text key={t} style={[s.cellValue, s.link]} onPress={() => void Linking.openURL(`tel:${t.replace(/\s/g, '')}`)} accessibilityRole="link" selectable>
              {t}
            </Text>
          ))}
        </Cell>
        <Cell s={s} cols={clientCols} icon={<Mail size={14} color={colors.accent} />} label="Email" value={c.email ? undefined : ''}>
          {!!c.email && (
            <Text style={[s.cellValue, s.link]} onPress={() => void Linking.openURL(`mailto:${c.email}`)} accessibilityRole="link" selectable numberOfLines={2}>
              {c.email}
            </Text>
          )}
        </Cell>
        <Cell s={s} cols={clientCols} icon={<MapPin size={14} color={colors.accent} />} label="Dirección" value={addressLines.length ? addressLines.join('\n') : ''} />
      </View>
    </>,
  );

  const orderInfo = card(
    'Pedido y documentos',
    <FileText size={16} color={colors.onPrimary} />,
    <>
      <InfoRow s={s} first label="Fabricante" value={`${order.manufacturer_name} (${order.manufacturer_code})`} />
      <InfoRow s={s} label="Año" value={String(order.year)} />
      <InfoRow s={s} label="Nº pedido del cliente" value={c.numero_referencia_pedido} strong />
      <InfoRow s={s} label="Oferta / proforma" value={c.oferta_proforma} />
      <InfoRow s={s} label="Nº factura" value={c.numero_factura} strong />
      <InfoRow s={s} label="Nº recibo / albarán" value={c.numero_recibo} />
      <InfoRow s={s} label="Condiciones de entrega" value={c.condiciones_entrega} stacked />
      <InfoRow s={s} label="Condiciones de pago" value={c.condiciones_pago} stacked />
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
              <Check size={18} color={colors.onPrimary} />
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
      <InfoRow s={s} label="Creado" value={formatDate(order.created_at)} />
      <InfoRow s={s} label="Última actualización" value={formatDate(order.updated_at)} />
    </>,
    { flush: true },
  );

  const followUp = card(
    'Seguimiento',
    <Clock size={16} color={colors.onPrimary} />,
    hasFollowUp ? (
      <>
        <InfoRow s={s} first label="Fecha prevista" value={order.expected_date ? `${formatISODate(order.expected_date)}${late !== null ? (late > 0 ? ` · ${late} día${late === 1 ? '' : 's'} de retraso` : ' · es hoy') : ''}` : ''} tone={lateTone ? colors.error : undefined} />
        <InfoRow s={s} label="Responsable" value={order.owner} />
        <InfoRow s={s} label="Siguiente acción" value={order.next_action} stacked />
      </>
    ) : (
      <Text style={[s.muted, s.pad]}>Sin fecha prevista, responsable ni siguiente acción. Puedes añadirlos en «Editar pedido».</Text>
    ),
    { flush: true },
  );

  const finance = card(
    'Resumen económico',
    <Euro size={16} color={colors.onPrimary} />,
    <>
      <InfoRow s={s} first label="Productos (sin IVA)" value={formatCurrency(order.total_ex_vat)} num />
      <InfoRow s={s} label="IVA de los productos" value={formatCurrency(order.total_vat)} num />
      {shipTotal > 0 && <InfoRow s={s} label="Gastos de envío (con IVA)" value={formatCurrency(shipTotal)} num />}
      {order.shipping_cost > 0 && <InfoRow s={s} label="Envío extra (importe fijo)" value={formatCurrency(order.shipping_cost)} num />}
      <View style={[s.row, s.rowSep, s.totalRow]}>
        <Text style={s.totalRowLabel}>Total</Text>
        <Text style={s.totalRowValue}>{formatCurrency(order.total_with_vat)}</Text>
      </View>
    </>,
    { flush: true, footer: hasCost ? `Beneficio bruto de los productos: ${formatCurrency(profit)} (venta sin IVA − coste).` : undefined },
  );

  // Tabla tipo Excel en ordenador; filas compactas en móvil
  const products = card(
    'Productos',
    <Package size={16} color={colors.onPrimary} />,
    tableWide ? (
      <View>
        <View style={[s.tr, s.th]}>
          <Text style={[s.thText, s.cQty]}>Cant.</Text>
          <Text style={[s.thText, s.cName]}>Equipo y referencia</Text>
          <Text style={[s.thText, s.cNum]}>Neto sin IVA</Text>
          <Text style={[s.thText, s.cNum]}>Coste ud.</Text>
          <Text style={[s.thText, s.cNum]}>Beneficio</Text>
          <Text style={[s.thText, s.cNum]}>Con IVA</Text>
        </View>
        {order.items.map((it, i) => (
          <View key={i} style={[s.tr, s.rowSep, i % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[s.td, s.cQty, s.tdStrong]}>{it.quantity}</Text>
            <View style={s.cName}>
              <Text style={[s.td, s.tdStrong]} selectable>{it.product_name || 'Sin nombre'}</Text>
              <Text style={s.tdSub}>
                {[
                  it.tpv_unitario > 0 ? `${formatCurrency(it.tpv_unitario)} ud.` : '',
                  it.total_sin_iva > 0 ? `importe ${formatCurrency(it.total_sin_iva)}` : '',
                  it.descuento_porcentaje ? `dto. ${it.descuento_porcentaje} %` : '',
                  `IVA ${it.vat_percentage} %`,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={[s.td, s.cNum, s.noWrap, s.tdStrong]}>{formatCurrency(it.valor_sin_iva)}</Text>
            <Text style={[s.td, s.cNum, s.noWrap]}>{it.costo_unitario > 0 ? formatCurrency(it.costo_unitario) : '—'}</Text>
            <Text style={[s.td, s.cNum, s.noWrap, it.costo_unitario > 0 && { color: it.beneficio_bruto >= 0 ? colors.success : colors.error, fontWeight: '600' }]}>
              {it.costo_unitario > 0 ? formatCurrency(it.beneficio_bruto) : '—'}
            </Text>
            <Text style={[s.td, s.cNum, s.noWrap]}>{formatCurrency(it.valor_con_iva)}</Text>
          </View>
        ))}
      </View>
    ) : (
      <View>
        {order.items.map((it, i) => (
          <View key={i} style={[s.item, i > 0 && s.rowSep]}>
            <View style={s.itemTop}>
              <Text style={s.qtyBadge}>{it.quantity}×</Text>
              <Text style={s.itemName} selectable>{it.product_name || 'Sin nombre'}</Text>
              <Text style={s.itemTotal}>{formatCurrency(it.valor_sin_iva)}</Text>
            </View>
            <Text style={s.muted}>
              {formatCurrency(it.pvp_neto_sin_iva)} neto ud.{it.descuento_porcentaje ? ` (dto. ${it.descuento_porcentaje} %)` : ''} · IVA {it.vat_percentage} % · con IVA {formatCurrency(it.valor_con_iva)}
            </Text>
            {it.costo_unitario > 0 && (
              <Text style={s.muted}>
                Coste ud. {formatCurrency(it.costo_unitario)} · beneficio{' '}
                <Text style={{ color: it.beneficio_bruto >= 0 ? colors.success : colors.error, fontWeight: '600' }}>{formatCurrency(it.beneficio_bruto)}</Text>
              </Text>
            )}
          </View>
        ))}
      </View>
    ),
    { flush: true, trailing: <Text style={s.cardCount}>{order.items.length}</Text> },
  );

  const shipping = shipLines.length > 0 && card(
    'Gastos de envío',
    <Truck size={16} color={colors.onPrimary} />,
    tableWide ? (
      <View>
        <View style={[s.tr, s.th]}>
          <Text style={[s.thText, s.cQty]}>Cant.</Text>
          <Text style={[s.thText, s.cName]}>Concepto</Text>
          <Text style={[s.thText, s.cNum]}>Coste ud.</Text>
          <Text style={[s.thText, s.cNum]}>Sin IVA</Text>
          <Text style={[s.thText, s.cDto]}>IVA</Text>
          <Text style={[s.thText, s.cNum]}>Con IVA</Text>
        </View>
        {shipLines.map((x, i) => (
          <View key={i} style={[s.tr, s.rowSep]}>
            <Text style={[s.td, s.cQty, s.tdStrong]}>{x.quantity}</Text>
            <Text style={[s.td, s.cName, s.tdStrong]}>{x.description || 'Envío'}</Text>
            <Text style={[s.td, s.cNum, s.noWrap]}>{formatCurrency(x.costo_unitario)}</Text>
            <Text style={[s.td, s.cNum, s.noWrap]}>{formatCurrency(x.valor_sin_iva)}</Text>
            <Text style={[s.td, s.cDto, s.noWrap]}>{x.vat_percentage} %</Text>
            <Text style={[s.td, s.cNum, s.noWrap, s.tdStrong]}>{formatCurrency(x.valor_con_iva)}</Text>
          </View>
        ))}
      </View>
    ) : (
      <View>
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
      </View>
    ),
    { flush: true, trailing: <Text style={s.cardCount}>{shipLines.length}</Text> },
  );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: order.reference_number, headerShown: false }} />
      <CompactTitleBar title={order.reference_number} shown={compactShown} />
      <ScrollView {...scrollProps} contentContainerStyle={[s.content, content, { paddingBottom: bottomSpace }]}>
        {header}
        {desktop ? (
          // Dos columnas independientes: lo que cuelga de cada una sube sin dejar huecos
          <View style={s.cols}>
            <View style={s.colMain}>
              {client}
              {products}
              {shipping}
            </View>
            <View style={s.colSide}>
              {finance}
              {orderInfo}
              {followUp}
            </View>
          </View>
        ) : (
          <>
            {client}
            {hasFollowUp && followUp}
            {products}
            {shipping}
            {finance}
            {orderInfo}
            {!hasFollowUp && followUp}
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

/** Celda de la rejilla del cliente: icono + etiqueta pequeña encima y valor (o hijos, p. ej. enlaces) */
function Cell({ s, cols, icon, label, value, children }: { s: Styles; cols: number; icon: React.ReactNode; label: string; value?: string; children?: React.ReactNode }) {
  const empty = value !== undefined && !value.trim();
  return (
    <View style={[s.cell, { flexBasis: cols === 1 ? '100%' : cols === 2 ? '47%' : '30%' }]}>
      <View style={s.cellHead}>
        {icon}
        <Text style={s.cellLabel}>{label}</Text>
      </View>
      {value !== undefined ? (
        <Text style={[s.cellValue, empty && s.empty]} selectable>
          {empty ? '—' : value}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function InfoRow({ s, label, value, tone, first, num, stacked, strong }: { s: Styles; label: string; value?: string; tone?: string; first?: boolean; num?: boolean; stacked?: boolean; strong?: boolean }) {
  const empty = !value?.trim();
  return (
    <View style={[s.row, !first && s.rowSep, stacked && !empty && s.rowStacked]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text
        style={[
          s.rowValue,
          stacked && !empty && { textAlign: 'left' },
          num && { fontVariant: ['tabular-nums'] },
          strong && !empty && { fontWeight: '700' },
          tone ? { color: tone, fontWeight: '600' } : null,
          empty && s.empty,
        ]}
        selectable
      >
        {empty ? '—' : value}
      </Text>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: canvas(c) },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    content: { gap: 20, width: '100%', alignSelf: 'center', paddingBottom: 48 },
    cols: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
    colMain: { flex: 1.7, gap: 20, minWidth: 0 },
    colSide: { flex: 1, gap: 20, minWidth: 0 },
    // cabecera
    top: { gap: 12 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginLeft: -8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 10, paddingLeft: 2, borderRadius: 10 },
    backText: { fontSize: 17, color: c.primary, letterSpacing: -0.3, fontWeight: '600' },
    topActions: { flexDirection: 'row', gap: 10 },
    roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    heroCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, backgroundColor: c.surface, borderRadius: 18, padding: 20, paddingLeft: 26, overflow: 'hidden' },
    heroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
    heroMain: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
    heroSide: { gap: 6, alignItems: 'flex-start' },
    caption: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    ref: { ...type.largeTitle, fontWeight: '800', color: c.reference, fontVariant: ['tabular-nums'] },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.fill, borderRadius: 999, paddingHorizontal: 12, minHeight: 32, flexShrink: 1, maxWidth: '100%', minWidth: 0 },
    metaChipText: { fontSize: 14, color: c.text, fontWeight: '500', flexShrink: 1, minWidth: 0 },
    heroCompany: { fontSize: 17, fontWeight: '700', color: c.text, marginTop: 4, letterSpacing: -0.2 },
    heroSmall: { fontSize: 13, color: c.textSecondary, marginTop: 8 },
    heroSideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 },
    total: { fontSize: 34, fontWeight: '800', color: c.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 20, borderRadius: 999, marginTop: 4 },
    btnSecondary: { backgroundColor: c.fill },
    btnText: { fontSize: 15, fontWeight: '700' },
    // tarjetas
    card: { backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    cardIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand },
    cardTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: c.text, letterSpacing: -0.3 },
    cardCount: { fontSize: 15, fontWeight: '700', color: c.textSecondary },
    cardBody: { paddingHorizontal: 16, paddingBottom: 16 },
    footer: { fontSize: 13, color: c.textSecondary, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 14 },
    pad: { padding: 16, paddingTop: 4 },
    // cliente
    company: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5, marginBottom: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 14 },
    cell: { flexGrow: 1, minWidth: 0, gap: 3 },
    cellHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cellLabel: { fontSize: 12.5, fontWeight: '600', color: c.textSecondary },
    cellValue: { fontSize: 16, color: c.text, lineHeight: 22, letterSpacing: -0.1 },
    link: { color: c.primary, fontWeight: '600' },
    empty: { color: c.textTertiary },
    // filas
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 16, paddingVertical: 9 },
    rowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
    rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    rowLabel: { fontSize: 14.5, color: c.textSecondary },
    rowValue: { flex: 1, minWidth: 0, fontSize: 15.5, color: c.text, textAlign: 'right', lineHeight: 21 },
    rowRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 },
    totalRow: { minHeight: 54, backgroundColor: c.primarySoft },
    totalRowLabel: { flex: 1, fontSize: 17, fontWeight: '700', color: c.text },
    totalRowValue: { fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
    refEditRow: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' },
    refInput: { flex: 1, minWidth: 0, height: 40, borderRadius: 10, backgroundColor: c.fill, paddingHorizontal: 12, fontSize: 16, color: c.text, borderWidth: 2, borderColor: c.primary, ...webInputReset },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    // tabla de productos
    tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 48 },
    th: { minHeight: 36, paddingVertical: 8, backgroundColor: c.fill },
    thText: { fontSize: 12.5, fontWeight: '700', color: c.textSecondary },
    td: { fontSize: 14.5, color: c.text, fontVariant: ['tabular-nums'] },
    tdStrong: { fontWeight: '600' },
    tdSub: { fontSize: 12.5, color: c.textSecondary, marginTop: 2 },
    cQty: { width: 44, textAlign: 'center' },
    cName: { flex: 1, minWidth: 170 },
    // Importes: ancho fijo y sin partir («912,00 €» no debe quedar en dos líneas); el concepto se estrecha
    cNum: { width: 80, flexShrink: 0, textAlign: 'right' },
    noWrap: (Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}) as object,
    cDto: { width: 56, textAlign: 'right' },
    // móvil
    item: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
    itemTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    qtyBadge: { fontSize: 14, fontWeight: '800', color: c.reference, minWidth: 28 },
    itemName: { flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: '600', color: c.text, lineHeight: 21 },
    itemTotal: { fontSize: 15.5, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
    muted: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    h2: { fontSize: 20, fontWeight: '600', color: c.text, marginBottom: 6 },
  });
}
