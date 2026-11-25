import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, CalendarDays, Check, ChevronDown, ChevronLeft, Clock, Copy, Euro, Factory, FileText, IdCard, Mail, MapPin, MoreHorizontal, Package, Pencil, Phone, Receipt, Route, Truck, User, UserRound, X, XCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CompactTitleBar, useCollapsingTitle, usePageLayout } from '@/components/Page';
import { canvas, heroFill, panel, webInputReset } from '@/constants/theme';
import { enter, fx, pulse, sheen, useCountUp } from '@/constants/motion';
import { ITEM_STATUS_HINT, ITEM_STATUS_LABEL, ITEM_STATUS_ORDER, itemProgress, itemStatusOf, itemTone } from '@/constants/itemStatus';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors } from '@/constants/colors';
import { STATUS_ICONS, STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
import SelectSheet from '@/components/SelectSheet';
import type { ItemStatus, OrderItem, OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
import { addressLine, formatISODate, itemsSummary, overdueDays } from '@/utils/orderFilters';

/** Pasos del pedido en la barra de progreso (Cancelado va aparte) */
const STEPS: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

type Sheet = 'more' | 'status' | null;

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, deleteOrder, updateOrderField, updateItemStatus, duplicateOrder } = useData();
  const { colors, isDark } = useTheme();
  const { width, content, bottomSpace } = usePageLayout();
  const { shown: compactShown, scrollProps } = useCollapsingTitle(90);
  const desktop = width >= 1024;
  const s = useMemo(() => makeStyles(colors), [colors]);
  const order = useMemo(() => orders.find(o => o.id === orderId), [orders, orderId]);
  // el total cuenta hasta su valor al abrir el pedido
  const totalShown = useCountUp(order?.total_with_vat ?? 0);

  const [sheet, setSheet] = useState<Sheet>(null);
  /** Producto cuyo estado se está cambiando (índice) */
  const [itemSheet, setItemSheet] = useState<number | 'all' | null>(null);
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

  const changeItemStatus = useCallback(
    async (index: number | 'all', st: ItemStatus) => {
      if (!order) return;
      if (index === 'all' ? order.items.every(x => itemStatusOf(x) === st) : itemStatusOf(order.items[index] ?? {}) === st) return;
      try {
        await updateItemStatus(order.id, index, st);
        void Haptics.selectionAsync();
      } catch (e) {
        Alert.alert(index === 'all' ? 'No se pudo cambiar el estado de los productos' : 'No se pudo cambiar el estado del producto', (e as Error).message);
      }
    },
    [order, updateItemStatus],
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

  const lateTone = late !== null && late > 0;
  const hasFollowUp = !!(order.expected_date || order.owner || order.next_action);
  const mobileTiles = width < 760;
  const narrow = width < 420;
  const tiny = width < 360; // móviles de 320 px: textos un punto más pequeños para que no se corten // móvil estrecho: cabecera compacta para que el cliente se vea en la primera pantalla
  const phones = [c.telefono_1, c.telefono_2].filter(v => !!v?.trim());
  const cityLine = [c.codigo_postal, c.provincia].filter(Boolean).join(' ');
  const addressLines = [c.direccion_1, c.direccion_2, cityLine, c.pais].filter(v => !!v?.trim());

  const person = [c.contacto, c.departamento].filter(v => !!v?.trim()).join(' · ');
  const addr = addressLine(c);
  const it = itemsSummary(order);
  const prog = itemProgress(order.items);
  const st = statusConfig[order.status];
  const StIcon = STATUS_ICONS[order.status];
  const stColor = colors[st.textKey];
  // color vivo de cada paso (punto y barra): el mismo que los puntos de los productos
  const stepTint = (k: OrderStatus): string =>
    k === 'pending' ? (isDark ? '#FF9F0A' : '#FF9500')
    : k === 'processing' ? (isDark ? '#FFCC00' : '#F2B705')
    : k === 'shipped' ? (isDark ? '#38BDF8' : '#0EA5E9')
    : k === 'delivered' ? (isDark ? '#30D158' : '#22A447')
    : colors.statusCancelledText;
  const stDot = stepTint(order.status);
  // icono encima del amarillo: oscuro para que se lea
  const onDot = order.status === 'processing' ? '#3D2C00' : '#FFFFFF';

  // Botón de estado: una sola píldora sólida (color del estado + flecha), que se lee bien encima del naranja.
  // En ordenador va arriba a la derecha, encima del total; en móvil, junto a la referencia.
  const statusPill = (
      <Pressable
        key={`st-${order.status}`}
        onPress={() => setSheet('status')}
        disabled={busy}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
          s.statusBtn,
          { backgroundColor: isDark ? '#0B2733' : '#FFFFFF' },
          hovered && { transform: [{ translateY: -1 }] },
          enter(0, 'bump', { base: 380 }),
        ]}
        {...fx('tint')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Estado: ${st.label}. Cambiar estado`}
        testID="change-status"
      >
        <View style={[s.statusIcon, { backgroundColor: stDot }]}>
          <StIcon size={17} color={onDot} strokeWidth={2.6} />
        </View>
        <Text style={[s.statusBtnText, { color: stColor }]}>{st.label}</Text>
        <ChevronDown size={18} color={stColor} strokeWidth={2.6} />
      </Pressable>
  );

  let tileN = 0;
  const tile = (Icon: typeof Euro, tint: string, label: string, value: string, sub: string, valueColor?: string) => (
    <View style={[s.tile, panel(colors, isDark), mobileTiles && s.tileHalf, enter(++tileN, 'pop', { base: 120, step: 70 })]} {...fx('lift')}>
      <View style={s.tileHead}>
        <View style={[s.tileIcon, { backgroundColor: tint }]}><Icon size={15} color="#FFFFFF" strokeWidth={2.4} /></View>
        <Text style={[s.tileLabel, tiny && { fontSize: 12 }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.tileValue, mobileTiles && { fontSize: value.length > 12 ? 16 : 19, letterSpacing: -0.3 }, valueColor ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[s.tileSub, tiny && { fontSize: 11 }]} numberOfLines={1}>{sub}</Text>
    </View>
  );

  /** Chapa de estado de un producto: se pulsa para cambiarlo */
  const itemChip = (i: number, item: OrderItem) => {
    const ist = itemStatusOf(item);
    const tone = itemTone(ist, colors, isDark);
    return (
      <Pressable
        key={`chip-${i}-${ist}`}
        onPress={() => setItemSheet(i)}
        style={[s.chip, { backgroundColor: tone.bg, borderColor: tone.border }, enter(0, 'bump', { base: 0 })]}
        {...fx('tint')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Estado del producto: ${ITEM_STATUS_LABEL[ist]}. Cambiar`}
        testID={`item-status-${i}`}
      >
        <View style={[s.chipDot, { backgroundColor: tone.dot }]} />
        <Text style={[s.chipText, { color: tone.text }]} numberOfLines={1}>{ITEM_STATUS_LABEL[ist]}</Text>
        <ChevronDown size={13} color={tone.text} strokeWidth={2.6} />
      </Pressable>
    );
  };
  /** Botón «Estado de todos»: cambia el estado de todos los productos a la vez */
  const allBtn = (
    <Pressable
      onPress={() => setItemSheet('all')}
      style={[s.allBtn, { borderColor: colors.border, backgroundColor: colors.fill }]}
      {...fx('tint')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Cambiar el estado de todos los productos"
      testID="item-status-all"
    >
      <Text style={s.allBtnText} numberOfLines={1}>{tiny ? 'Todos' : 'Estado de todos'}</Text>
      <ChevronDown size={14} color={colors.text} strokeWidth={2.6} />
    </Pressable>
  );
  /** Fondo y franja de color de la fila según el estado del producto */
  const rowTone = (item: OrderItem) => {
    const tone = itemTone(itemStatusOf(item), colors, isDark);
    return { backgroundColor: tone.row, borderLeftWidth: 4, borderLeftColor: itemStatusOf(item) === 'none' ? 'transparent' : tone.dot };
  };

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
      <View style={[s.heroCard, heroFill(colors), enter(0, 'pop')]}>
        <View style={sheen(500)} pointerEvents="none" />
        <View style={s.heroMain}>
          <View style={s.heroTopRow}>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text style={s.heroCaption}>Referencia</Text>
              <Text style={s.ref} selectable accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
                {order.reference_number}
              </Text>
            </View>
            {!desktop && statusPill}
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
              {order.items.filter(x => !!x.product_name?.trim() || Number(x.quantity) > 0).slice(0, 3).map((x, k) => (
                <View key={k} style={[s.heroItem, enter(k, 'pop', { base: 260, step: 70 })]}>
                  <View style={[s.heroDot, { backgroundColor: itemTone(itemStatusOf(x), colors, isDark).dot }]} />
                  <Text style={s.heroItemText} numberOfLines={1}>{`${Number(x.quantity) || 1}× ${x.product_name?.trim() || 'Sin nombre'}`}</Text>
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
          {desktop && <View style={{ marginBottom: 6 }}>{statusPill}</View>}
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={[s.heroCaption, desktop && { textAlign: 'right' }]}>Total con IVA</Text>
            <Text style={[s.total, desktop && { textAlign: 'right' }, narrow && { fontSize: 30 }]} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Total ${formatCurrency(order.total_with_vat)}`}>
              {formatCurrency(totalShown)}
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

      {/* Cifras clave: cada una con su color para distinguirlas de un vistazo */}
      <View style={s.tiles}>
        {tile(Euro, '#FF8718', tiny ? 'Base' : 'Base sin IVA', formatCurrency(order.total_ex_vat), `+ IVA ${formatCurrency(order.total_vat)}`)}
        {hasCost
          ? tile(Receipt, '#22A447', 'Beneficio', formatCurrency(profit), tiny ? 'Venta − coste' : 'Venta sin IVA − coste', profit >= 0 ? colors.success : colors.error)
          : tile(Truck, '#22A447', 'Envío', shipTotal > 0 ? formatCurrency(shipTotal) : 'Sin envío', shipLines.length ? `${shipLines.length} línea${shipLines.length === 1 ? '' : 's'}` : 'Incluido o no aplica')}
        {tile(Package, '#3F6E92', 'Productos', `${prog.out} de ${prog.total}`, prog.total === 0 ? 'Sin productos' : `${prog.delivered === prog.total ? 'entregados' : 'enviados'} · ${it.units} ud${it.units === 1 ? '' : 's'}.`)}
        {tile(Factory, '#7B5CC4', 'Fabricante', order.manufacturer_name || '—', `${order.manufacturer_code ? order.manufacturer_code + ' · ' : ''}año ${order.year}`)}
      </View>
    </View>
  );

  // ---------------------------------------------------------------- bloques
  let cardN = 0;
  const card = (title: string, icon: React.ReactNode, body: React.ReactNode, opts: { trailing?: React.ReactNode; footer?: string; flush?: boolean; grow?: boolean; tint?: string; testID?: string } = {}) => (
    <View style={[s.card, panel(colors, isDark), opts.grow && { flexGrow: 1 }, enter(cardN++, 'rise', { base: 360, step: 90 })]} testID={opts.testID}>
      <View style={s.cardHead}>
        <View style={[s.cardIcon, opts.tint ? { backgroundColor: opts.tint } : null]}>{icon}</View>
        <Text style={s.cardTitle} accessibilityRole="header">{title}</Text>
        {opts.trailing}
      </View>
      <View style={opts.flush ? undefined : s.cardBody}>{body}</View>
      {!!opts.footer && <Text style={s.footer}>{opts.footer}</Text>}
    </View>
  );

  // ---- Progreso: pasos del pedido + productos enviados
  const stepIdx = STEPS.indexOf(order.status);
  const allOut = prog.total > 0 && prog.out === prog.total;
  const allDelivered = prog.total > 0 && prog.delivered === prog.total;
  // propuesta (no se cambia sola): todos entregados → pedido Entregado; todos enviados o entregados → pedido Enviado
  const suggestTo: OrderStatus | null = allDelivered && order.status !== 'delivered' && order.status !== 'cancelled' ? 'delivered' : allOut && (order.status === 'pending' || order.status === 'processing') ? 'shipped' : null;
  const progress = card(
    'Progreso del pedido',
    <Route size={16} color="#FFFFFF" />,
    <View style={{ gap: 18 }}>
      {order.status === 'cancelled' ? (
        <View style={[s.cancelBox, { backgroundColor: colors.statusCancelledBg }]}>
          <XCircle size={22} color={colors.statusCancelledText} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.cancelTitle, { color: colors.statusCancelledText }]}>Pedido cancelado</Text>
            <Text style={s.muted}>No cuenta en la facturación. Puedes reactivarlo cambiando el estado.</Text>
          </View>
          <Pressable onPress={() => setSheet('status')} style={[s.smallBtn, { backgroundColor: colors.surface }]} accessibilityRole="button" testID="reactivate-btn">
            <Text style={[s.smallBtnText, { color: colors.text }]}>Cambiar estado</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.steps} accessibilityRole={'list' as never}>
          <View style={[s.track, { backgroundColor: colors.fill }]}>
            <View style={[s.trackFill, { width: `${(Math.max(stepIdx, 0) / (STEPS.length - 1)) * 100}%`, backgroundColor: stDot }, enter(0, 'grow', { base: 500 })]} />
          </View>
          {STEPS.map((step, k) => {
            const cfg = statusConfig[step];
            const Icon = STATUS_ICONS[step];
            const done = k < stepIdx;
            const current = k === stepIdx;
            const col = current || done ? stColor : colors.textTertiary;
            return (
              <Pressable
                key={step}
                onPress={() => void changeStatus(step)}
                disabled={busy || current}
                style={s.step}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={`${cfg.label}${current ? ' (estado actual)' : done ? ' (hecho)' : ''}`}
                testID={`step-${step}`}
              >
                <View
                  key={`${step}-${order.status}`}
                  style={[
                    s.stepDot,
                    current || done ? { backgroundColor: stDot, borderColor: stDot } : { backgroundColor: colors.surface, borderColor: colors.border },
                    enter(k, 'bump', { base: 420, step: 110 }),
                    current && pulse(stDot + '88'),
                  ]}
                >
                  {done ? <Check size={16} color={onDot} strokeWidth={3} /> : <Icon size={15} color={current ? onDot : colors.textTertiary} strokeWidth={2.4} />}
                </View>
                <Text style={[s.stepLabel, tiny && { fontSize: 11, letterSpacing: -0.2 }, { color: current ? col : done ? colors.text : colors.textSecondary }, current && { fontWeight: '800' }]} numberOfLines={1}>{cfg.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {prog.total > 0 && (
        <View style={s.prodProg}>
          <View style={s.prodProgHead}>
            <Text style={s.prodProgTitle}>Productos</Text>
            <View style={s.legend}>
              {(['delivered', 'shipped', 'pending', 'none'] as ItemStatus[]).filter(k => prog[k] > 0).map(k => (
                <View key={k} style={s.legendItem}>
                  <View style={[s.chipDot, { backgroundColor: itemTone(k, colors, isDark).dot }]} />
                  <Text style={s.legendText}>{prog[k]} {k === 'delivered' ? (prog[k] === 1 ? 'entregado' : 'entregados') : k === 'shipped' ? (prog[k] === 1 ? 'enviado' : 'enviados') : k === 'pending' ? (prog[k] === 1 ? 'pendiente' : 'pendientes') : 'sin empezar'}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.segments}>
            {order.items.map((x, k) => (
              <View key={k} style={[s.segment, { backgroundColor: itemStatusOf(x) === 'none' ? colors.fill : itemTone(itemStatusOf(x), colors, isDark).dot }, enter(k, 'grow', { base: 600, step: 90, duration: 700 })]} {...fx('tint')} />
            ))}
          </View>
          {suggestTo && (
            <Pressable key={suggestTo} onPress={() => void changeStatus(suggestTo)} style={[s.suggest, { backgroundColor: colors.successBg, borderColor: colors.successBorder }, enter(0, 'pop', { base: 300 })]} accessibilityRole="button" testID={`suggest-${suggestTo}`}>
              <Truck size={18} color={colors.success} />
              <Text style={[s.suggestText, { color: colors.success }]}>
                {suggestTo === 'delivered' ? 'Todos los productos están entregados. Marcar el pedido como «Entregado»' : 'Todos los productos han salido. Marcar el pedido como «Enviado»'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>,
    { tint: stColor, testID: 'progress-card' },
  );

  // ---- Cliente (el nombre ya está arriba): datos en bloques cortos
  const clientCols = width >= 1280 ? 3 : width >= 360 ? 2 : 1;
  const client = card(
    'Cliente',
    <UserRound size={16} color="#FFFFFF" />,
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
      <Cell s={s} cols={clientCols} full={clientCols < 3} icon={<Mail size={14} color={colors.accent} />} label="Email" value={c.email ? undefined : ''}>
        {!!c.email && (
          <Text style={[s.cellValue, s.link]} onPress={() => void Linking.openURL(`mailto:${c.email}`)} accessibilityRole="link" selectable numberOfLines={2}>
            {c.email}
          </Text>
        )}
      </Cell>
      <Cell s={s} cols={clientCols} full={clientCols < 3} icon={<MapPin size={14} color={colors.accent} />} label="Dirección" value={addressLines.length ? addressLines.join('\n') : ''} />
    </View>,
    { grow: true, tint: '#3F6E92' },
  );

  const refRow = editingRef ? (
    // Editando: una fila normal (no un botón), porque en web un botón desactivado bloqueaba el clic en ✓ y ✗
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
  );

  // ---- Pedido y documentos: rejilla de datos cortos, en todos los tamaños
  const docCols = width >= 1280 ? 2 : width >= 600 ? 3 : 2;
  const orderInfo = card(
    'Pedido y documentos',
    <FileText size={16} color="#FFFFFF" />,
    <>
      <View style={[s.grid, s.cardBody]}>
        <Cell s={s} cols={docCols} icon={<Receipt size={14} color={colors.accent} />} label="Nº pedido del cliente" value={c.numero_referencia_pedido} strong />
        <Cell s={s} cols={docCols} icon={<FileText size={14} color={colors.accent} />} label="Oferta / proforma" value={c.oferta_proforma} />
        <Cell s={s} cols={docCols} icon={<Receipt size={14} color={colors.accent} />} label="Nº factura" value={c.numero_factura} strong />
        <Cell s={s} cols={docCols} icon={<FileText size={14} color={colors.accent} />} label="Nº recibo / albarán" value={c.numero_recibo} />
        <Cell s={s} cols={docCols} icon={<Truck size={14} color={colors.accent} />} label="Condiciones de entrega" value={c.condiciones_entrega} />
        <Cell s={s} cols={docCols} icon={<Euro size={14} color={colors.accent} />} label="Condiciones de pago" value={c.condiciones_pago} />
        <Cell s={s} cols={docCols} icon={<CalendarDays size={14} color={colors.accent} />} label="Creado" value={formatDate(order.created_at)} />
        <Cell s={s} cols={docCols} icon={<CalendarDays size={14} color={colors.accent} />} label="Actualizado" value={formatDate(order.updated_at)} />
      </View>
      {refRow}
    </>,
    { flush: true, grow: true, tint: '#7B5CC4' },
  );

  const followUp = card(
    'Seguimiento',
    <Clock size={16} color="#FFFFFF" />,
    hasFollowUp ? (
      <>
        <InfoRow s={s} first label="Fecha prevista" value={order.expected_date ? `${formatISODate(order.expected_date)}${late !== null ? (late > 0 ? ` · ${late} día${late === 1 ? '' : 's'} de retraso` : ' · es hoy') : ''}` : ''} tone={lateTone ? colors.error : undefined} />
        <InfoRow s={s} label="Responsable" value={order.owner} />
        <InfoRow s={s} label="Siguiente acción" value={order.next_action} stacked />
      </>
    ) : (
      <Text style={[s.muted, s.pad]}>Sin fecha prevista, responsable ni siguiente acción. Puedes añadirlos en «Editar pedido».</Text>
    ),
    { flush: true, tint: lateTone ? colors.error : '#5B6B73' },
  );

  const finance = card(
    'Resumen económico',
    <Euro size={16} color="#FFFFFF" />,
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

  /** Dato pequeño de un producto en móvil: etiqueta arriba, cifra debajo */
  const metric = (label: string, value: string, tone?: string) => (
    <View style={s.metric}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, tone ? { color: tone } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );

  // Móvil y tablet: cada producto es un bloque con su color de estado
  const products = card(
    'Productos',
    <Package size={16} color="#FFFFFF" />,
    <View>
      {order.items.map((x, i) => (
        <View key={i} style={[s.item, i > 0 && s.rowSep, rowTone(x), enter(i, 'slide', { base: 520, step: 80 })]} {...fx('tint')} testID={`item-row-${i}`}>
          <View style={s.itemTop}>
            <View style={s.qtyPill}><Text style={s.qtyPillText}>{x.quantity}×</Text></View>
            <Text style={s.itemName} selectable>{x.product_name || 'Sin nombre'}</Text>
          </View>
          <View style={s.itemMid}>
            {itemChip(i, x)}
            <Text style={s.itemTotal}>{formatCurrency(x.valor_sin_iva)}</Text>
          </View>
          <View style={s.metrics}>
            {metric('Neto ud.', formatCurrency(x.pvp_neto_sin_iva))}
            {!!x.descuento_porcentaje && metric('Dto.', `${x.descuento_porcentaje} %`)}
            {metric('IVA', `${x.vat_percentage} %`)}
            {metric('Con IVA', formatCurrency(x.valor_con_iva))}
            {x.costo_unitario > 0 && metric('Coste ud.', formatCurrency(x.costo_unitario))}
            {x.costo_unitario > 0 && metric('Beneficio', formatCurrency(x.beneficio_bruto), x.beneficio_bruto >= 0 ? colors.success : colors.error)}
          </View>
        </View>
      ))}
    </View>,
    { flush: true, trailing: <View style={s.trailRow}>{order.items.length > 1 && allBtn}<Text style={s.cardCount}>{order.items.length}</Text></View> },
  );

  const shipping = shipLines.length > 0 && card(
    'Gastos de envío',
    <Truck size={16} color="#FFFFFF" />,
    <View>
      {shipLines.map((x, i) => (
        <View key={i} style={[s.item, i > 0 && s.rowSep]}>
          <View style={s.itemMid}>
            <Text style={[s.itemName, { flex: 1 }]}>{x.description || 'Envío'}</Text>
            <Text style={s.itemTotal}>{formatCurrency(x.valor_con_iva)}</Text>
          </View>
          <View style={s.metrics}>
            {metric('Cantidad', String(x.quantity))}
            {metric('Coste ud.', formatCurrency(x.costo_unitario))}
            {metric('Sin IVA', formatCurrency(x.valor_sin_iva))}
            {metric('IVA', `${x.vat_percentage} %`)}
          </View>
        </View>
      ))}
    </View>,
    { flush: true, trailing: <Text style={s.cardCount}>{shipLines.length}</Text>, tint: '#22A447' },
  );

  const hasUnitPrice = order.items.some(i => i.tpv_unitario > 0);
  const hasDiscount = order.items.some(i => !!i.descuento_porcentaje);
  /** Ordenador: productos a todo el ancho, como una factura (líneas con su estado, gastos de envío y totales a la derecha) */
  const invoice = card(
    'Productos',
    <Package size={16} color="#FFFFFF" />,
    <View>
      <View style={[s.tr, s.th]}>
        <Text style={[s.thText, s.cQty]}>Cant.</Text>
        <Text style={[s.thText, s.cName]}>Equipo y referencia</Text>
        {order.items.length > 1 ? (
          <Pressable onPress={() => setItemSheet('all')} style={[s.cState, s.thBtn]} accessibilityRole="button" accessibilityLabel="Cambiar el estado de todos los productos" testID="item-status-all-head">
            <Text style={[s.thText, { color: colors.primary }]}>Estado</Text>
            <ChevronDown size={13} color={colors.primary} strokeWidth={2.6} />
          </Pressable>
        ) : (
          <Text style={[s.thText, s.cState]}>Estado</Text>
        )}
        {hasUnitPrice && <Text style={[s.thText, s.cNum]}>Precio ud.</Text>}
        {hasDiscount && <Text style={[s.thText, s.cDto]}>Dto.</Text>}
        <Text style={[s.thText, s.cNum]}>Neto sin IVA</Text>
        <Text style={[s.thText, s.cDto]}>IVA</Text>
        {hasCost && <Text style={[s.thText, s.cNum]}>Beneficio</Text>}
        <Text style={[s.thText, s.cNum]}>Con IVA</Text>
      </View>
      {order.items.map((x, i) => (
        <View key={i} style={[s.tr, s.rowSep, rowTone(x), enter(i, 'slide', { base: 520, step: 80 })]} {...fx('tint', 'hl')} testID={`item-row-${i}`}>
          <Text style={[s.td, s.cQty, s.tdStrong]}>{x.quantity}</Text>
          <View style={s.cName}>
            <Text style={[s.td, s.tdStrong]} selectable>{x.product_name || 'Sin nombre'}</Text>
            {(x.total_sin_iva > 0 || x.costo_unitario > 0) && (
              <Text style={s.tdSub}>
                {[x.total_sin_iva > 0 ? `Importe antes de dto.: ${formatCurrency(x.total_sin_iva)}` : '', x.costo_unitario > 0 ? `coste ud. ${formatCurrency(x.costo_unitario)}` : ''].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          <View style={s.cState}>{itemChip(i, x)}</View>
          {hasUnitPrice && <Text style={[s.td, s.cNum, s.noWrap, !(x.tpv_unitario > 0) && s.dim]}>{x.tpv_unitario > 0 ? formatCurrency(x.tpv_unitario) : '—'}</Text>}
          {hasDiscount && <Text style={[s.td, s.cDto, s.noWrap, !x.descuento_porcentaje && s.dim]}>{x.descuento_porcentaje ? `${x.descuento_porcentaje} %` : '—'}</Text>}
          <Text style={[s.td, s.cNum, s.noWrap, s.tdStrong]}>{formatCurrency(x.valor_sin_iva)}</Text>
          <Text style={[s.td, s.cDto, s.noWrap]}>{x.vat_percentage} %</Text>
          {hasCost && (
            <Text style={[s.td, s.cNum, s.noWrap, x.costo_unitario > 0 ? { color: x.beneficio_bruto >= 0 ? colors.success : colors.error, fontWeight: '600' } : s.dim]}>
              {x.costo_unitario > 0 ? formatCurrency(x.beneficio_bruto) : '—'}
            </Text>
          )}
          <Text style={[s.td, s.cNum, s.noWrap]}>{formatCurrency(x.valor_con_iva)}</Text>
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
    { flush: true, trailing: <View style={s.trailRow}>{order.items.length > 1 && allBtn}<Text style={s.cardCount}>{order.items.length}</Text></View> },
  );

  const sideBySide = width >= 1280;
  const sheetItem = typeof itemSheet === 'number' ? order.items[itemSheet] : undefined;
  // en «todos», se marca la opción solo si todos los productos ya tienen el mismo estado
  const allSame = order.items.length > 0 && order.items.every(x => itemStatusOf(x) === itemStatusOf(order.items[0]!)) ? itemStatusOf(order.items[0]!) : undefined;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: order.reference_number, headerShown: false }} />
      <CompactTitleBar title={order.reference_number} shown={compactShown} />
      <ScrollView {...scrollProps} contentContainerStyle={[s.content, content, { paddingBottom: bottomSpace }]}>
        {header}
        {desktop ? (
          // Ordenador: progreso, productos como una factura, y debajo cliente | pedido y documentos, seguimiento
          <>
            {progress}
            {invoice}
            {sideBySide ? (
              <View style={[s.cols, { alignItems: 'stretch' }]}>
                <View style={s.colMain}>{client}</View>
                <View style={s.colSide}>{orderInfo}</View>
              </View>
            ) : (
              <>
                {client}
                {orderInfo}
              </>
            )}
            {followUp}
          </>
        ) : (
          <>
            {progress}
            {products}
            {shipping}
            {finance}
            {client}
            {followUp}
            {orderInfo}
          </>
        )}
      </ScrollView>

      <SelectSheet
        visible={sheet === 'status'}
        title="Cambiar estado del pedido"
        options={STATUS_ORDER.map(v => ({ value: v, label: statusConfig[v].label }))}
        selected={order.status}
        onSelect={v => void changeStatus(v as OrderStatus)}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={itemSheet !== null}
        title={itemSheet === 'all' ? `Estado de los ${order.items.length} productos` : sheetItem ? `Estado de «${sheetItem.product_name || 'producto'}»` : 'Estado del producto'}
        options={ITEM_STATUS_ORDER.map(v => ({ value: v, label: ITEM_STATUS_LABEL[v], hint: ITEM_STATUS_HINT[v] }))}
        selected={itemSheet === 'all' ? allSame : sheetItem ? itemStatusOf(sheetItem) : undefined}
        onSelect={v => {
          if (itemSheet !== null) void changeItemStatus(itemSheet, v as ItemStatus);
        }}
        onClose={() => setItemSheet(null)}
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

/** Celda de una rejilla de datos: icono + etiqueta pequeña encima y valor (o hijos, p. ej. enlaces) */
function Cell({ s, cols, icon, label, value, children, full, strong }: { s: Styles; cols: number; icon: React.ReactNode; label: string; value?: string; children?: React.ReactNode; full?: boolean; strong?: boolean }) {
  const empty = value !== undefined && !value.trim();
  return (
    <View style={[s.cell, { flexBasis: full || cols === 1 ? '100%' : cols === 2 ? '44%' : '29%' }]}>
      <View style={s.cellHead}>
        {icon}
        <Text style={s.cellLabel}>{label}</Text>
      </View>
      {value !== undefined ? (
        <Text style={[s.cellValue, strong && !empty && { fontWeight: '700' }, empty && s.empty]} selectable>
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
    statusBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, paddingLeft: 6, paddingRight: 14, borderRadius: 999,
      ...(Platform.OS === 'web' ? ({ boxShadow: '0 6px 18px rgba(0,42,57,0.22), inset 0 1px 0 rgba(255,255,255,0.6)', cursor: 'pointer' } as object) : {}),
    },
    statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    statusBtnText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    heroDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
    // chapa de estado de un producto
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
    chipDot: { width: 9, height: 9, borderRadius: 5 },
    chipText: { fontSize: 13.5, fontWeight: '700' },
    // progreso
    steps: { flexDirection: 'row', alignItems: 'flex-start', position: 'relative' },
    track: { position: 'absolute', top: 17, left: '12.5%', right: '12.5%', height: 4, borderRadius: 2, overflow: 'hidden' },
    trackFill: { height: '100%', borderRadius: 2 },
    step: { flex: 1, alignItems: 'center', gap: 8, minWidth: 0 },
    stepDot: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    stepLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
    cancelBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, flexWrap: 'wrap' },
    cancelTitle: { fontSize: 16, fontWeight: '800' },
    smallBtn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    smallBtnText: { fontSize: 14, fontWeight: '700' },
    prodProg: { gap: 10 },
    prodProgHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
    prodProgTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
    legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
    segments: { flexDirection: 'row', gap: 5, height: 10 },
    segment: { flex: 1, borderRadius: 5, ...(Platform.OS === 'web' ? ({ transformOrigin: 'left center' } as object) : {}) },
    suggest: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
    suggestText: { flex: 1, fontSize: 14, fontWeight: '700' },
    heroClient: { fontSize: 32, lineHeight: 37, fontWeight: '800', color: c.onPrimary, letterSpacing: -0.9 },
    heroLine: { fontSize: 15, color: 'rgba(0, 42, 57, 0.78)', fontWeight: '600' },
    heroFacts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6, marginTop: 8 },
    heroFact: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%', minHeight: 28 },
    heroFactText: { fontSize: 15, color: c.onPrimary, fontWeight: '500', flexShrink: 1 },
    heroItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    heroItem: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
    heroItemText: { fontSize: 13.5, fontWeight: '600', color: c.onPrimary, flexShrink: 1 },
    heroSideRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', gap: 12 },
    total: { fontSize: 40, fontWeight: '800', color: c.onPrimary, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
    // cifras clave
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: { flexGrow: 1, flexBasis: 0, minWidth: 180, borderRadius: 20, padding: 16, gap: 4 },
    tileHalf: { flexBasis: '45%' as unknown as number, minWidth: 0 },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    tileIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
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
    trailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
    allBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, flexShrink: 1, minWidth: 0 },
    allBtnText: { fontSize: 13.5, fontWeight: '700', color: c.text, flexShrink: 1 },
    thBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}) },
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
    item: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
    itemTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    itemMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    qtyPill: { minWidth: 34, height: 26, paddingHorizontal: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    qtyPillText: { fontSize: 13.5, fontWeight: '800', color: c.reference, fontVariant: ['tabular-nums'] },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8 },
    metric: { gap: 1, flexBasis: '20%' as unknown as number, flexGrow: 1, minWidth: 70 },
    metricLabel: { fontSize: 11.5, fontWeight: '600', color: c.textTertiary },
    metricValue: { fontSize: 14, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
    cState: { width: 140, flexShrink: 0 },
    itemName: { flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: '600', color: c.text, lineHeight: 21 },
    itemTotal: { fontSize: 17, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
    muted: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    h2: { fontSize: 20, fontWeight: '600', color: c.text, marginBottom: 6 },
  });
}
