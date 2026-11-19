import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, Clock, Copy, Euro, Factory, FileText, IdCard, Mail, MapPin, MoreHorizontal, Package, Pencil, Phone, Receipt, Truck, User, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CompactTitleBar, useCollapsingTitle, usePageLayout } from '@/components/Page';
import { canvas, heroFill, panel, type, webInputReset } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors } from '@/constants/colors';
import StatusBadge, { STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
import SelectSheet from '@/components/SelectSheet';
import type { OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
import { addressLine, formatISODate, itemsSummary, overdueDays } from '@/utils/orderFilters';

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
  const tableWide = width >= 1600;
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
  const mobileTiles = width < 760;
  const narrow = width < 420; // móvil estrecho: cabecera compacta para que el cliente se vea en la primera pantalla
  const phones = [c.telefono_1, c.telefono_2].filter(v => !!v?.trim());
  const cityLine = [c.codigo_postal, c.provincia].filter(Boolean).join(' ');
  const addressLines = [c.direccion_1, c.direccion_2, cityLine, c.pais].filter(v => !!v?.trim());

  const person = [c.contacto, c.departamento].filter(v => !!v?.trim()).join(' · ');
  const addr = addressLine(c);
  const it = itemsSummary(order);
  const tile = (icon: React.ReactNode, label: string, value: string, sub: string) => (
    <View style={[s.tile, panel(colors, isDark), mobileTiles && s.tileHalf]}>
      <View style={s.tileHead}>
        <View style={s.tileIcon}>{icon}</View>
        <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.tileValue, mobileTiles && { fontSize: 19, letterSpacing: -0.3 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.tileSub} numberOfLines={1}>{sub}</Text>
    </View>
  );

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

      {/* Cabecera protagonista (la única tarjeta naranja): lo primero que se busca de un pedido, como en el Excel */}
      <View style={[s.heroCard, heroFill(colors)]}>
        <View style={s.heroMain}>
          <View style={s.heroTopRow}>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text style={s.heroCaption}>Referencia</Text>
              <Text style={s.ref} selectable accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
                {order.reference_number}
              </Text>
            </View>
            <Pressable
              onPress={() => setSheet('status')}
              disabled={busy}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.statusBtn, isDark && { backgroundColor: 'rgba(0, 30, 41, 0.86)' }, hovered && { backgroundColor: isDark ? 'rgba(0, 30, 41, 0.96)' : 'rgba(255,255,255,0.92)' }]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Estado: ${statusConfig[order.status].label}. Cambiar estado`}
              testID="change-status"
            >
              <StatusBadge status={order.status} />
              <ChevronDown size={15} color={colors[statusConfig[order.status].textKey]} strokeWidth={2.5} />
            </Pressable>
          </View>
          <Text style={[s.heroClient, narrow && { fontSize: 24, lineHeight: 29 }]} numberOfLines={2} selectable>
            {c.nombre_empresa || 'Sin nombre de empresa'}
          </Text>
          {!!person && <Text style={s.heroLine} numberOfLines={1}>{person}</Text>}
          <View style={s.heroFacts}>
            {!!addr && (
              <View style={s.heroFact}>
                <MapPin size={15} color={colors.onPrimary} />
                <Text style={s.heroFactText} numberOfLines={2}>{addr}</Text>
              </View>
            )}
            {!!phones[0] && (
              <Pressable style={s.heroFact} onPress={() => void Linking.openURL(`tel:${phones[0].replace(/\s/g, '')}`)} accessibilityRole="link">
                <Phone size={15} color={colors.onPrimary} />
                <Text style={s.heroFactText} numberOfLines={1}>{phones[0]}</Text>
              </Pressable>
            )}
            {!!c.email && (
              <Pressable style={[s.heroFact, { flexShrink: 1 }]} onPress={() => void Linking.openURL(`mailto:${c.email}`)} accessibilityRole="link">
                <Mail size={15} color={colors.onPrimary} />
                <Text style={s.heroFactText} numberOfLines={1}>{c.email}</Text>
              </Pressable>
            )}
          </View>
          {it.names.length > 0 && (
            <View style={s.heroItems}>
              {it.names.slice(0, 3).map((n, k) => (
                <View key={k} style={s.heroItem}>
                  <Text style={s.heroItemText} numberOfLines={1}>{n}</Text>
                </View>
              ))}
              {it.names.length > 3 && (
                <View style={s.heroItem}>
                  <Text style={s.heroItemText}>y {it.names.length - 3} más</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View style={[s.heroSide, desktop ? { alignItems: 'flex-end' } : s.heroSideRow]}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={[s.heroCaption, desktop && { textAlign: 'right' }]}>Total con IVA</Text>
            <Text style={[s.total, desktop && { textAlign: 'right' }, narrow && { fontSize: 30 }]} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Total ${formatCurrency(order.total_with_vat)}`}>
              {formatCurrency(order.total_with_vat)}
            </Text>
            <Text style={[s.heroLine, desktop && { textAlign: 'right' }]}>{it.label}</Text>
          </View>
          <Pressable
            onPress={handleEdit}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.btn, { backgroundColor: hovered ? '#013A4F' : colors.onPrimary, opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            testID="edit-order-btn"
          >
            <Pencil size={16} color="#FFFFFF" />
            <Text style={[s.btnText, { color: '#FFFFFF' }]}>{narrow ? 'Editar' : 'Editar pedido'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Cifras clave en vidrio, debajo de la cabecera */}
      <View style={s.tiles}>
        {tile(<Package size={16} color={colors.brand} />, 'Productos', String(it.count), it.units > it.count ? `${it.units} unidades` : it.count === 1 ? '1 línea' : `${it.count} líneas`)}
        {tile(<Euro size={16} color={colors.brand} />, 'Base sin IVA', formatCurrency(order.total_ex_vat), `IVA ${formatCurrency(order.total_vat)}`)}
        {hasCost
          ? tile(<Receipt size={16} color={colors.brand} />, 'Beneficio', formatCurrency(profit), 'Venta menos coste')
          : tile(<Truck size={16} color={colors.brand} />, 'Envío', shipTotal > 0 ? formatCurrency(shipTotal) : 'Sin envío', shipLines.length ? `${shipLines.length} línea${shipLines.length === 1 ? '' : 's'}` : 'Incluido o no aplica')}
        {tile(<Factory size={16} color={colors.brand} />, 'Fabricante', order.manufacturer_name || '—', `Año ${order.year}`)}
      </View>
    </View>
  );

  // ---------------------------------------------------------------- bloques
  const card = (title: string, icon: React.ReactNode, body: React.ReactNode, opts: { trailing?: React.ReactNode; footer?: string; flush?: boolean; grow?: boolean } = {}) => (
    <View style={[s.card, panel(colors, isDark), opts.grow && { flexGrow: 1 }]}>
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
    { grow: true },
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
      {/* Editando: una fila normal (no un botón), porque en web un botón desactivado bloqueaba el clic en ✓ y ✗ */}
      {editingRef ? (
        <View style={[s.row, s.rowSep]}>
          <Text style={s.rowLabel}>Ref. manual</Text>
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
              testID="ref-input"
            />
            <Pressable onPress={saveRef} disabled={busy} style={[s.iconBtn, { backgroundColor: colors.primaryFill }]} accessibilityRole="button" accessibilityLabel="Guardar referencia manual" testID="ref-save">
              <Check size={18} color={colors.onPrimary} />
            </Pressable>
            <Pressable onPress={() => setEditingRef(false)} style={[s.iconBtn, { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel="Cancelar" testID="ref-cancel">
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setRefValue(order.custom_reference || '');
            setEditingRef(true);
          }}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.row, s.rowSep, hovered && { backgroundColor: colors.fill }]}
          accessibilityRole="button"
          accessibilityLabel="Editar referencia manual"
          testID="ref-edit"
        >
          <Text style={s.rowLabel}>Ref. manual</Text>
          <View style={s.rowRight}>
            <Text style={s.rowValue}>{order.custom_reference || '—'}</Text>
            <Pencil size={14} color={colors.textSecondary} />
          </View>
        </Pressable>
      )}
      <InfoRow s={s} label="Creado" value={formatDate(order.created_at)} />
      <InfoRow s={s} label="Última actualización" value={formatDate(order.updated_at)} />
    </>,
    { flush: true },
  );

  /** Pedido y documentos en rejilla de dos columnas (ordenador): los mismos datos que la lista, en la mitad de alto */
  // lado a lado con el cliente desde 1280 px (2 columnas); por debajo, a todo el ancho (3 columnas)
  const sideBySide = width >= 1280;
  const docCols = sideBySide ? 2 : 3;
  const orderInfoGrid = card(
    'Pedido y documentos',
    <FileText size={16} color={colors.onPrimary} />,
    <>
      <View style={[s.grid, s.cardBody]}>
        <Cell s={s} cols={docCols} icon={<Factory size={14} color={colors.accent} />} label="Fabricante" value={`${order.manufacturer_name} (${order.manufacturer_code}) · ${order.year}`} />
        <Cell s={s} cols={docCols} icon={<Receipt size={14} color={colors.accent} />} label="Nº pedido del cliente" value={c.numero_referencia_pedido} />
        <Cell s={s} cols={docCols} icon={<FileText size={14} color={colors.accent} />} label="Oferta / proforma" value={c.oferta_proforma} />
        <Cell s={s} cols={docCols} icon={<Receipt size={14} color={colors.accent} />} label="Nº factura" value={c.numero_factura} />
        <Cell s={s} cols={docCols} icon={<FileText size={14} color={colors.accent} />} label="Nº recibo / albarán" value={c.numero_recibo} />
        <Cell s={s} cols={docCols} icon={<CalendarDays size={14} color={colors.accent} />} label="Creado · actualizado" value={`${formatDate(order.created_at)} · ${formatDate(order.updated_at)}`} />
        <Cell s={s} cols={docCols} icon={<Truck size={14} color={colors.accent} />} label="Condiciones de entrega" value={c.condiciones_entrega} />
        <Cell s={s} cols={docCols} icon={<Euro size={14} color={colors.accent} />} label="Condiciones de pago" value={c.condiciones_pago} />
      </View>
      {/* Editando: una fila normal (no un botón), porque en web un botón desactivado bloqueaba el clic en ✓ y ✗ */}
      {editingRef ? (
        <View style={[s.row, s.rowSep]}>
          <Text style={s.rowLabel}>Ref. manual</Text>
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
              testID="ref-input"
            />
            <Pressable onPress={saveRef} disabled={busy} style={[s.iconBtn, { backgroundColor: colors.primaryFill }]} accessibilityRole="button" accessibilityLabel="Guardar referencia manual" testID="ref-save">
              <Check size={18} color={colors.onPrimary} />
            </Pressable>
            <Pressable onPress={() => setEditingRef(false)} style={[s.iconBtn, { backgroundColor: colors.fill }]} accessibilityRole="button" accessibilityLabel="Cancelar" testID="ref-cancel">
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setRefValue(order.custom_reference || '');
            setEditingRef(true);
          }}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.row, s.rowSep, hovered && { backgroundColor: colors.fill }]}
          accessibilityRole="button"
          accessibilityLabel="Editar referencia manual"
          testID="ref-edit"
        >
          <Text style={s.rowLabel}>Ref. manual</Text>
          <View style={s.rowRight}>
            <Text style={s.rowValue}>{order.custom_reference || '—'}</Text>
            <Pencil size={14} color={colors.textSecondary} />
          </View>
        </Pressable>
      )}
    </>,
    { flush: true, grow: true },
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

  const hasUnitPrice = order.items.some(i => i.tpv_unitario > 0);
  const hasDiscount = order.items.some(i => !!i.descuento_porcentaje);
  /** Ordenador: productos a todo el ancho, como una factura (líneas, gastos de envío y totales alineados a la derecha) */
  const invoice = card(
    'Productos',
    <Package size={16} color={colors.onPrimary} />,
    <View>
      <View style={[s.tr, s.th]}>
        <Text style={[s.thText, s.cQty]}>Cant.</Text>
        <Text style={[s.thText, s.cName]}>Equipo y referencia</Text>
        {hasUnitPrice && <Text style={[s.thText, s.cNum]}>Precio ud.</Text>}
        {hasDiscount && <Text style={[s.thText, s.cDto]}>Dto.</Text>}
        <Text style={[s.thText, s.cNum]}>Neto sin IVA</Text>
        <Text style={[s.thText, s.cDto]}>IVA</Text>
        {hasCost && <Text style={[s.thText, s.cNum]}>Coste ud.</Text>}
        {hasCost && <Text style={[s.thText, s.cNum]}>Beneficio</Text>}
        <Text style={[s.thText, s.cNum]}>Con IVA</Text>
      </View>
      {order.items.map((it, i) => (
        <View key={i} style={[s.tr, s.rowSep, i % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[s.td, s.cQty, s.tdStrong]}>{it.quantity}</Text>
          <View style={s.cName}>
            <Text style={[s.td, s.tdStrong]} selectable>{it.product_name || 'Sin nombre'}</Text>
            {it.total_sin_iva > 0 && <Text style={s.tdSub}>Importe de la línea antes de dto.: {formatCurrency(it.total_sin_iva)}</Text>}
          </View>
          {hasUnitPrice && <Text style={[s.td, s.cNum, s.noWrap, !(it.tpv_unitario > 0) && s.dim]}>{it.tpv_unitario > 0 ? formatCurrency(it.tpv_unitario) : '—'}</Text>}
          {hasDiscount && <Text style={[s.td, s.cDto, s.noWrap, !it.descuento_porcentaje && s.dim]}>{it.descuento_porcentaje ? `${it.descuento_porcentaje} %` : '—'}</Text>}
          <Text style={[s.td, s.cNum, s.noWrap, s.tdStrong]}>{formatCurrency(it.valor_sin_iva)}</Text>
          <Text style={[s.td, s.cDto, s.noWrap]}>{it.vat_percentage} %</Text>
          {hasCost && <Text style={[s.td, s.cNum, s.noWrap, !(it.costo_unitario > 0) && s.dim]}>{it.costo_unitario > 0 ? formatCurrency(it.costo_unitario) : '—'}</Text>}
          {hasCost && (
            <Text style={[s.td, s.cNum, s.noWrap, it.costo_unitario > 0 ? { color: it.beneficio_bruto >= 0 ? colors.success : colors.error, fontWeight: '600' } : s.dim]}>
              {it.costo_unitario > 0 ? formatCurrency(it.beneficio_bruto) : '—'}
            </Text>
          )}
          <Text style={[s.td, s.cNum, s.noWrap]}>{formatCurrency(it.valor_con_iva)}</Text>
        </View>
      ))}

      {/* Pie de factura: gastos de envío a la izquierda, totales a la derecha */}
      <View style={[s.invoiceFoot, s.rowSep]}>
        <View style={s.invoiceShip}>
          <Text style={s.subHead}>Gastos de envío</Text>
          {shipLines.length === 0 && order.shipping_cost <= 0 ? (
            <Text style={s.muted}>Sin gastos de envío.</Text>
          ) : (
            <>
              {shipLines.map((x, i) => (
                <View key={i} style={s.shipLine}>
                  <Text style={[s.td, { flex: 1, minWidth: 0 }]} numberOfLines={2}>
                    {x.quantity > 1 ? `${x.quantity} × ` : ''}{x.description || 'Envío'}
                  </Text>
                  <Text style={[s.tdSub, s.noWrap]}>{formatCurrency(x.valor_sin_iva)} + IVA {x.vat_percentage} %</Text>
                  <Text style={[s.td, s.tdStrong, s.noWrap, { width: 100, textAlign: 'right' }]}>{formatCurrency(x.valor_con_iva)}</Text>
                </View>
              ))}
              {order.shipping_cost > 0 && (
                <View style={s.shipLine}>
                  <Text style={[s.td, { flex: 1 }]}>Envío extra (importe fijo, sin IVA)</Text>
                  <Text style={[s.td, s.tdStrong, s.noWrap, { width: 100, textAlign: 'right' }]}>{formatCurrency(order.shipping_cost)}</Text>
                </View>
              )}
            </>
          )}
          {hasCost && <Text style={[s.muted, { marginTop: 10 }]}>Beneficio bruto de los productos: <Text style={{ color: profit >= 0 ? colors.success : colors.error, fontWeight: '700' }}>{formatCurrency(profit)}</Text> (venta sin IVA − coste).</Text>}
        </View>
        <View style={s.totals}>
          <View style={s.totLine}><Text style={s.totLabel}>Productos (sin IVA)</Text><Text style={s.totValue}>{formatCurrency(order.total_ex_vat)}</Text></View>
          <View style={s.totLine}><Text style={s.totLabel}>IVA de los productos</Text><Text style={s.totValue}>{formatCurrency(order.total_vat)}</Text></View>
          {shipTotal > 0 && <View style={s.totLine}><Text style={s.totLabel}>Gastos de envío (con IVA)</Text><Text style={s.totValue}>{formatCurrency(shipTotal)}</Text></View>}
          {order.shipping_cost > 0 && <View style={s.totLine}><Text style={s.totLabel}>Envío extra</Text><Text style={s.totValue}>{formatCurrency(order.shipping_cost)}</Text></View>}
          <View style={[s.totLine, s.totGrand]}>
            <Text style={s.totalRowLabel}>Total</Text>
            <Text style={s.totalRowValue}>{formatCurrency(order.total_with_vat)}</Text>
          </View>
        </View>
      </View>
    </View>,
    { flush: true, trailing: <Text style={s.cardCount}>{order.items.length}</Text> },
  );

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: order.reference_number, headerShown: false }} />
      <CompactTitleBar title={order.reference_number} shown={compactShown} />
      <ScrollView {...scrollProps} contentContainerStyle={[s.content, content, { paddingBottom: bottomSpace }]}>
        {header}
        {desktop ? (
          // Como una factura: datos (cliente | pedido y documentos), productos con sus totales a todo el ancho, seguimiento
          <>
            {sideBySide ? (
              <View style={[s.cols, { alignItems: 'stretch' }]}>
                <View style={s.colMain}>{client}</View>
                <View style={s.colSide}>{orderInfoGrid}</View>
              </View>
            ) : (
              <>
                {client}
                {orderInfoGrid}
              </>
            )}
            {invoice}
            {followUp}
          </>
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
    heroCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 20, borderRadius: 26, padding: 24, overflow: 'hidden' },
    // base 240 (no 320): en móviles de 320 px la cabecera se salía de la tarjeta
    heroMain: { flexGrow: 1, flexBasis: 240, minWidth: 0, maxWidth: '100%', gap: 4 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 },
    heroSide: { gap: 10, alignItems: 'flex-start' },
    heroCaption: { fontSize: 13, fontWeight: '700', color: 'rgba(0, 42, 57, 0.72)' },
    ref: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: c.onPrimary, letterSpacing: 0.2, fontVariant: ['tabular-nums'] },
    // la flecha va dentro de la misma píldora que el estado, sobre un vidrio claro para que se lea encima del naranja
    statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 0, minHeight: 36, paddingRight: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.78)' },
    heroClient: { fontSize: 32, lineHeight: 37, fontWeight: '800', color: c.onPrimary, letterSpacing: -0.9 },
    heroLine: { fontSize: 15, color: 'rgba(0, 42, 57, 0.78)', fontWeight: '600' },
    heroFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6, marginTop: 8 },
    heroFact: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%', minHeight: 28 },
    heroFactText: { fontSize: 15, color: c.onPrimary, fontWeight: '500', flexShrink: 1 },
    heroItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    heroItem: { backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
    heroItemText: { fontSize: 13.5, fontWeight: '600', color: c.onPrimary },
    heroSideRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', gap: 12 },
    total: { fontSize: 40, fontWeight: '800', color: c.onPrimary, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    // cifras clave
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: { flexGrow: 1, flexBasis: 0, minWidth: 180, borderRadius: 20, padding: 16, gap: 4 },
    tileHalf: { flexBasis: '45%' as unknown as number, minWidth: 0 },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    tileIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    tileLabel: { fontSize: 13.5, fontWeight: '700', color: c.textSecondary, flexShrink: 1 },
    tileValue: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    tileSub: { fontSize: 12.5, color: c.textSecondary },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 20, borderRadius: 999, marginTop: 4 },
    btnSecondary: { backgroundColor: c.fill },
    btnText: { fontSize: 15, fontWeight: '700' },
    // tarjetas
    card: { backgroundColor: c.surface, borderRadius: 22, overflow: 'hidden' },
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
    rowLabel: { fontSize: 14.5, color: c.textSecondary, flexShrink: 0, maxWidth: '45%' },
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
    cNum: { width: 100, flexShrink: 0, textAlign: 'right', paddingLeft: 6 },
    noWrap: (Platform.OS === 'web' ? { whiteSpace: 'nowrap' } : {}) as object,
    cDto: { width: 56, textAlign: 'right' },
    dim: { color: c.textTertiary },
    invoiceFoot: { flexDirection: 'row', gap: 32, padding: 16, paddingTop: 18, alignItems: 'flex-start' },
    invoiceShip: { flex: 1, minWidth: 0, gap: 6 },
    subHead: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginBottom: 2 },
    shipLine: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
    totals: { width: 360, maxWidth: '45%', gap: 2 },
    totLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 34 },
    totLabel: { fontSize: 15, color: c.textSecondary },
    totValue: { fontSize: 15.5, color: c.text, fontVariant: ['tabular-nums'], fontWeight: '600' },
    totGrand: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: c.primarySoft },
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
