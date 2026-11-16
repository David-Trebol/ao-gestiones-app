import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronDown, Download, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors } from '@/constants/colors';
import { cardShadow, radius, webInputReset } from '@/constants/theme';
import StatusBadge, { STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
import SelectSheet, { SheetOption } from '@/components/SelectSheet';
import { usePageLayout } from '@/components/Page';
import type { Order, OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
import { exportOrdersToExcel } from '@/utils/exportExcel';
import {
  ATTENTION_RULES,
  DEFAULT_FILTERS,
  OrderFilters,
  PERIOD_LABELS,
  PeriodKey,
  SORT_LABELS,
  SortKey,
  activeFilterCount,
  attentionReasons,
  filterOrders,
  formatISODate,
  overdueDays,
} from '@/utils/orderFilters';

// Se conservan al volver de un pedido o al cambiar de vista
let savedFilters: OrderFilters = { ...DEFAULT_FILTERS };
let savedVisible = 50;

type SheetKind = 'manufacturer' | 'owner' | 'year' | 'period' | 'sort' | null;

export default function OrdersDashboard() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { pad, width } = usePageLayout();
  const { orders, manufacturers, years } = useData();
  const table = width >= 1100; // tabla cuando cabe sin apretar (con la barra lateral)
  const twoCols = width >= 700 && !table;
  const wideTable = width >= 1400;
  const [filters, setFiltersState] = useState<OrderFilters>(savedFilters);
  const [visible, setVisibleState] = useState(savedVisible);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [exporting, setExporting] = useState(false);
  const s = useMemo(() => makeStyles(colors), [colors]);

  const setFilters = (patch: Partial<OrderFilters>) => {
    const next = { ...filters, ...patch };
    savedFilters = next;
    setFiltersState(next);
    savedVisible = 50;
    setVisibleState(50);
  };
  const setVisible = (n: number) => {
    savedVisible = n;
    setVisibleState(n);
  };

  const now = Date.now();
  const counts = useMemo(() => {
    const c: Record<OrderStatus, { n: number; total: number }> = {
      pending: { n: 0, total: 0 },
      processing: { n: 0, total: 0 },
      shipped: { n: 0, total: 0 },
      delivered: { n: 0, total: 0 },
      cancelled: { n: 0, total: 0 },
    };
    for (const o of orders) {
      const k = c[o.status] ?? c.pending;
      k.n++;
      k.total += o.total_with_vat || 0;
    }
    return c;
  }, [orders]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- "now" cambia en cada render; basta con recalcular cuando cambian los pedidos
  const attentionCount = useMemo(() => orders.filter(o => attentionReasons(o, now).length).length, [orders]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lateCount = useMemo(() => orders.filter(o => (overdueDays(o, now) ?? 0) > 0).length, [orders]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => filterOrders(orders, filters, now), [orders, filters]);
  const shown = list.slice(0, visible);
  const nActive = activeFilterCount(filters);

  const allYears = useMemo(() => Array.from(new Set([...years, ...orders.map(o => o.year)])).sort((a, b) => b - a), [years, orders]);
  const owners = useMemo(() => Array.from(new Set(orders.map(o => o.owner?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'es')), [orders]);
  const mfName = manufacturers.find(m => m.id === filters.manufacturerId)?.name;
  const showReasons = filters.status === 'attention' || filters.status === 'overdue';

  const open = (o: Order) => router.push(`/order-detail?orderId=${o.id}` as never);

  const doExport = async () => {
    if (!list.length) return;
    setExporting(true);
    try {
      const name = await exportOrdersToExcel(list, manufacturers, nActive ? 'pedidos-filtrados' : 'pedidos');
      Alert.alert('Excel descargado', `${name} · ${list.length} pedido${list.length === 1 ? '' : 's'}.`);
    } catch (e) {
      Alert.alert('No se pudo exportar', (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const sheetProps = (): { title: string; options: SheetOption<string>[]; selected: string; onSelect: (v: string) => void } | null => {
    switch (sheet) {
      case 'manufacturer':
        return {
          title: 'Fabricante',
          options: [{ value: '__all', label: 'Todos los fabricantes' }, ...manufacturers.map(m => ({ value: m.id, label: m.name, hint: m.code }))],
          selected: filters.manufacturerId || '__all',
          onSelect: v => setFilters({ manufacturerId: v === '__all' ? '' : v }),
        };
      case 'owner':
        return {
          title: 'Responsable',
          options: [{ value: '__all', label: 'Todos' }, { value: '__none', label: 'Sin responsable' }, ...owners.map(o => ({ value: o, label: o }))],
          selected: filters.owner || '__all',
          onSelect: v => setFilters({ owner: v === '__all' ? '' : v }),
        };
      case 'year':
        return {
          title: 'Año del pedido',
          options: [{ value: '__all', label: 'Todos los años' }, ...allYears.map(y => ({ value: String(y), label: String(y) }))],
          selected: filters.year || '__all',
          onSelect: v => setFilters({ year: v === '__all' ? '' : v }),
        };
      case 'period':
        return {
          title: 'Fecha de creación',
          options: (Object.keys(PERIOD_LABELS) as PeriodKey[]).map(k => ({ value: k, label: PERIOD_LABELS[k] })),
          selected: filters.period,
          onSelect: v => setFilters({ period: v as PeriodKey }),
        };
      case 'sort':
        return {
          title: 'Ordenar por',
          options: (Object.keys(SORT_LABELS) as SortKey[]).map(k => ({ value: k, label: SORT_LABELS[k] })),
          selected: filters.sort,
          onSelect: v => setFilters({ sort: v as SortKey }),
        };
      default:
        return null;
    }
  };
  const sp = sheetProps();

  const chip = (kind: Exclude<SheetKind, null>, label: string, active: boolean) => (
    <Pressable
      key={kind}
      onPress={() => setSheet(kind)}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.chip, active ? { backgroundColor: colors.primarySoftAlt } : { backgroundColor: hovered || pressed ? colors.surfaceAlt : colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Cambiar`}
    >
      <Text style={[s.chipText, active && { color: colors.primary }]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={14} color={active ? colors.primary : colors.textSecondary} />
    </Pressable>
  );

  const listTitle =
    filters.status === 'attention' ? 'Requieren atención' : filters.status === 'overdue' ? 'Con retraso' : filters.status !== 'all' ? statusConfig[filters.status].label : 'Todos los pedidos';

  return (
    <View style={{ gap: 16 }}>
      {/* Buscador */}
      <View style={[s.searchBox, cardShadow(isDark)]}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={filters.query}
          onChangeText={t => setFilters({ query: t })}
          placeholder={width >= 700 ? 'Buscar por referencia, cliente, NIF, producto, nº de factura o responsable' : 'Buscar pedidos'}
          placeholderTextColor={colors.textTertiary}
          style={s.searchInput}
          accessibilityLabel="Buscar pedidos"
          returnKeyType="search"
          autoCorrect={false}
          testID="home-search"
        />
        {!!filters.query && (
          <Pressable onPress={() => setFilters({ query: '' })} hitSlop={10} accessibilityLabel="Borrar búsqueda" style={s.clearBtn}>
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Contadores por estado: abren la lista filtrada */}
      <View style={s.counters}>
        {STATUS_ORDER.map(st => {
          const sel = filters.status === st;
          const cfg = statusConfig[st];
          return (
            <Pressable
              key={st}
              onPress={() => setFilters({ status: sel ? 'all' : st })}
              style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
                s.counter,
                { flexBasis: width >= 700 ? '18%' : '30%', borderColor: sel ? colors[cfg.textKey] : 'transparent' },
                cardShadow(isDark),
                (hovered || pressed) && !sel && { backgroundColor: colors.surfaceAlt },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${cfg.label}: ${counts[st].n} pedidos. ${sel ? 'Quitar filtro' : 'Ver estos pedidos'}`}
              testID={`counter-${st}`}
            >
              <View style={s.counterTop}>
                <View style={[s.dot, { backgroundColor: colors[cfg.textKey] }]} />
                <Text style={s.counterLabel} numberOfLines={1}>
                  {cfg.label}
                </Text>
              </View>
              <Text style={s.counterValue}>{counts[st].n}</Text>
              {width >= 700 && (
                <Text style={s.counterSub} numberOfLines={1}>
                  {formatCurrency(counts[st].total)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Atención: una sola línea que filtra la lista */}
      {attentionCount > 0 && (
        <View style={[s.attention, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
          <AlertTriangle size={18} color={colors.warning} />
          <Text style={[s.attentionText, { color: colors.text }]}>
            <Text style={{ fontWeight: '600' }}>
              {attentionCount} {attentionCount === 1 ? 'pedido requiere' : 'pedidos requieren'} atención
            </Text>
            {lateCount > 0 ? <Text style={{ color: colors.error }}> · {lateCount} con retraso</Text> : null}
          </Text>
          <View style={s.attentionActions}>
            {lateCount > 0 && (
              <Pressable onPress={() => setFilters({ status: filters.status === 'overdue' ? 'all' : 'overdue' })} style={s.textBtn} accessibilityRole="button" testID="filter-overdue">
                <Text style={[s.link, { color: colors.error }]}>{filters.status === 'overdue' ? 'Ver todos' : 'Ver retrasados'}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setFilters({ status: filters.status === 'attention' ? 'all' : 'attention' })} style={s.textBtn} accessibilityRole="button" testID="filter-attention">
              <Text style={s.link}>{filters.status === 'attention' ? 'Ver todos' : 'Ver'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Lista */}
      <View>
        <View style={s.listHead}>
          <Text style={s.sectionTitle}>
            {listTitle} · {list.length}
          </Text>
          <View style={s.listHeadActions}>
            {nActive > 0 && (
              <Pressable onPress={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} style={s.textBtn} accessibilityRole="button" testID="clear-filters">
                <Text style={s.link}>Quitar filtros ({nActive})</Text>
              </Pressable>
            )}
            {Platform.OS === 'web' && list.length > 0 && (
              <Pressable onPress={doExport} disabled={exporting} style={[s.textBtn, { flexDirection: 'row', gap: 6 }]} accessibilityRole="button" accessibilityLabel={`Exportar ${list.length} pedidos a Excel`} testID="export-excel">
                <Download size={16} color={colors.primary} />
                <Text style={s.link}>{exporting ? 'Exportando…' : 'Excel'}</Text>
              </Pressable>
            )}
          </View>
        </View>
        {showReasons && (
          <Text style={s.ruleNote}>
            Reglas: fecha prevista vencida; pendiente más de {ATTENTION_RULES.pendingDays} días sin cambios; procesando o enviado más de {ATTENTION_RULES.activeDays} días sin cambios; sin cliente o con importe 0 €.
          </Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chips, { paddingHorizontal: pad }]} style={{ marginHorizontal: -pad }}>
          <View style={s.filterIcon}>
            <SlidersHorizontal size={16} color={colors.textSecondary} />
          </View>
          {chip('manufacturer', mfName ?? 'Fabricante', !!filters.manufacturerId)}
          {(owners.length > 0 || !!filters.owner) && chip('owner', filters.owner === '__none' ? 'Sin responsable' : filters.owner || 'Responsable', !!filters.owner)}
          {chip('year', filters.year || 'Año', !!filters.year)}
          {chip('period', filters.period === 'all' ? 'Fecha' : PERIOD_LABELS[filters.period], filters.period !== 'all')}
          {chip('sort', SORT_LABELS[filters.sort], false)}
        </ScrollView>

        {orders.length === 0 ? (
          <View style={[s.card, s.empty, cardShadow(isDark)]}>
            <Text style={s.emptyTitle}>Aún no hay pedidos</Text>
            <Text style={s.emptyText}>Crea el primero con «Nuevo pedido».</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={[s.card, s.empty, cardShadow(isDark)]}>
            <Text style={s.emptyTitle}>Ningún pedido coincide</Text>
            <Text style={s.emptyText}>Prueba con otra búsqueda o quita los filtros.</Text>
            <Pressable onPress={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} style={[s.emptyBtn, { backgroundColor: colors.fill }]} accessibilityRole="button">
              <Text style={[s.link, { fontWeight: '600' }]}>Quitar filtros</Text>
            </Pressable>
          </View>
        ) : table ? (
          <OrderTable orders={shown} onOpen={open} showReasons={showReasons} showUpdated={wideTable} />
        ) : (
          <View style={[s.cardsWrap, twoCols && s.cardsWrapTwo]}>
            {shown.map(o => (
              <OrderCardItem key={o.id} order={o} onOpen={open} twoCols={twoCols} showReasons={showReasons} />
            ))}
          </View>
        )}
        {list.length > shown.length && (
          <Pressable onPress={() => setVisible(visible + 50)} style={({ pressed }) => [s.moreBtn, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
            <Text style={[s.link, { fontWeight: '600' }]}>
              Mostrar más ({shown.length} de {list.length})
            </Text>
          </Pressable>
        )}
      </View>

      {sp && <SelectSheet visible title={sp.title} options={sp.options} selected={sp.selected} onSelect={sp.onSelect} onClose={() => setSheet(null)} />}
    </View>
  );
}

// ------------------------------------------------------------------ piezas reutilizables

export function ExpectedText({ o, prefix = '' }: { o: Order; prefix?: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!o.expected_date) return <Text style={s.tdSub}>—</Text>;
  const late = overdueDays(o);
  const isLate = late !== null && late > 0;
  return (
    <Text style={[s.tdSub, isLate && { color: colors.error, fontWeight: '600' }]} accessibilityLabel={isLate ? `Previsto ${formatISODate(o.expected_date)}, retrasado ${late} días` : undefined}>
      {prefix}
      {formatISODate(o.expected_date)}
      {isLate ? ` · ${late} d de retraso` : late === 0 ? ' · hoy' : ''}
    </Text>
  );
}

export function OrderTable({ orders, onOpen, showReasons, showUpdated }: { orders: Order[]; onOpen: (o: Order) => void; showReasons?: boolean; showUpdated?: boolean }) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.card, cardShadow(isDark)]}>
      <View style={[s.tr, s.th]}>
        <Text style={[s.thText, s.cRef]}>Referencia</Text>
        <Text style={[s.thText, s.cClient]}>Cliente</Text>
        <Text style={[s.thText, s.cMf]}>Fabricante</Text>
        <Text style={[s.thText, s.cStatus]}>Estado</Text>
        <Text style={[s.thText, s.cDate]}>Creado</Text>
        {showUpdated && <Text style={[s.thText, s.cDate]}>Actualizado</Text>}
        <Text style={[s.thText, s.cDate]}>Previsto</Text>
        <Text style={[s.thText, s.cTotal]}>Total</Text>
      </View>
      {orders.map((o, i) => {
        const reasons = showReasons ? attentionReasons(o) : [];
        return (
          <Pressable
            key={o.id}
            onPress={() => onOpen(o)}
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [s.tr, i > 0 && s.rowBorder, (hovered || pressed) && { backgroundColor: colors.surfaceAlt }, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
            accessibilityRole="link"
            accessibilityLabel={`Pedido ${o.reference_number}, ${o.customer?.nombre_empresa || 'sin cliente'}, ${statusConfig[o.status].label}, ${formatCurrency(o.total_with_vat)}`}
            testID={`order-row-${o.id}`}
          >
            <View style={s.cRef}>
              <Text style={s.tdStrong}>{o.reference_number}</Text>
              {!!o.custom_reference && (
                <Text style={s.tdSub} numberOfLines={1}>
                  Ref. {o.custom_reference}
                </Text>
              )}
            </View>
            <View style={s.cClient}>
              <Text style={s.td} numberOfLines={2}>
                {o.customer?.nombre_empresa || '—'}
              </Text>
              {reasons.length > 0 ? (
                <Text style={[s.tdSub, { color: colors.warning }]} numberOfLines={2}>
                  {reasons.join(' · ')}
                </Text>
              ) : o.customer?.numero_referencia_pedido ? (
                <Text style={s.tdSub} numberOfLines={1}>
                  Su pedido {o.customer.numero_referencia_pedido}
                </Text>
              ) : null}
            </View>
            <Text style={[s.td, s.cMf]} numberOfLines={2}>
              {o.manufacturer_name}
            </Text>
            <View style={s.cStatus}>
              <StatusBadge status={o.status} size="sm" />
            </View>
            <Text style={[s.tdSub, s.cDate]}>{formatDate(o.created_at)}</Text>
            {showUpdated && <Text style={[s.tdSub, s.cDate]}>{formatDate(o.updated_at)}</Text>}
            <View style={s.cDate}>
              <ExpectedText o={o} />
              {!!o.owner && (
                <Text style={s.tdSub} numberOfLines={1}>
                  {o.owner}
                </Text>
              )}
            </View>
            <Text style={[s.tdStrong, s.cTotal]}>{formatCurrency(o.total_with_vat)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OrderCardItem({ order: o, onOpen, twoCols, showReasons }: { order: Order; onOpen: (o: Order) => void; twoCols?: boolean; showReasons?: boolean }) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const reasons = showReasons ? attentionReasons(o) : [];
  return (
    <Pressable
      onPress={() => onOpen(o)}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.oCard, twoCols && s.oCardTwo, cardShadow(isDark), (pressed || hovered) && { backgroundColor: colors.surfaceAlt }]}
      accessibilityRole="link"
      accessibilityLabel={`Pedido ${o.reference_number}, ${o.customer?.nombre_empresa || 'sin cliente'}, ${statusConfig[o.status].label}, ${formatCurrency(o.total_with_vat)}`}
      testID={`order-card-${o.id}`}
    >
      <View style={s.oTop}>
        <Text style={s.oRef}>{o.reference_number}</Text>
        <StatusBadge status={o.status} size="sm" />
      </View>
      <Text style={s.oClient}>{o.customer?.nombre_empresa || 'Sin cliente'}</Text>
      {!!o.custom_reference && <Text style={s.tdSub}>Ref. {o.custom_reference}</Text>}
      {reasons.length > 0 && <Text style={[s.tdSub, { color: colors.warning }]}>{reasons.join(' · ')}</Text>}
      {(!!o.expected_date || !!o.owner || !!o.next_action) && (
        <View style={s.follow}>
          {!!o.expected_date && <ExpectedText o={o} prefix="Previsto " />}
          {!!o.owner && <Text style={s.tdSub}>{o.owner}</Text>}
          {!!o.next_action && (
            <Text style={[s.tdSub, { flexBasis: '100%' }]} numberOfLines={2}>
              → {o.next_action}
            </Text>
          )}
        </View>
      )}
      <View style={s.oBottom}>
        <Text style={s.oMeta} numberOfLines={2}>
          {o.manufacturer_name} · {formatDate(o.created_at)} · {o.items.length} {o.items.length === 1 ? 'producto' : 'productos'}
        </Text>
        <Text style={s.oTotal}>{formatCurrency(o.total_with_vat)}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderRadius: radius.md, backgroundColor: c.surface },
    searchInput: { flex: 1, minWidth: 0, fontSize: 16, color: c.text, height: 48, ...webInputReset },
    clearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    counter: { flexGrow: 1, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, backgroundColor: c.surface, minHeight: 72 },
    counterTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    counterLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500', flexShrink: 1 },
    counterValue: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'], marginTop: 2 },
    counterSub: { fontSize: 12, color: c.textSecondary, fontVariant: ['tabular-nums'] },
    attention: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 4, borderRadius: radius.lg, borderWidth: 1, minHeight: 52 },
    attentionText: { flex: 1, minWidth: 180, fontSize: 15 },
    attentionActions: { flexDirection: 'row', alignItems: 'center' },
    textBtn: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
    listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
    listHeadActions: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 4 },
    link: { fontSize: 14, color: c.primary, fontWeight: '600' },
    ruleNote: { fontSize: 12.5, lineHeight: 17, color: c.textSecondary, paddingHorizontal: 4, marginBottom: 4 },
    chips: { flexDirection: 'row', gap: 8, paddingBottom: 12, paddingTop: 4, alignItems: 'center' },
    filterIcon: { width: 24, alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, maxWidth: 260 },
    chipText: { fontSize: 14, color: c.text, fontWeight: '500' },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' },
    empty: { padding: 28, alignItems: 'center', gap: 6 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    emptyBtn: { marginTop: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: radius.pill },
    tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
    th: { minHeight: 40, paddingVertical: 10, backgroundColor: c.surfaceAlt },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    thText: { fontSize: 12, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
    td: { fontSize: 14, color: c.text },
    tdStrong: { fontSize: 14, color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
    tdSub: { fontSize: 13, color: c.textSecondary, fontVariant: ['tabular-nums'] },
    cRef: { flex: 1.3, minWidth: 0 },
    cClient: { flex: 2, minWidth: 0 },
    cMf: { flex: 1.2, minWidth: 0 },
    cStatus: { flex: 1.1, minWidth: 0 },
    cDate: { flex: 1, minWidth: 0 },
    cTotal: { flex: 1.1, minWidth: 120, textAlign: 'right' },
    cardsWrap: { gap: 10 },
    cardsWrapTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    oCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, gap: 4 },
    oCardTwo: { width: '48.8%' as unknown as number },
    oTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    oRef: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] },
    oClient: { fontSize: 15, color: c.text },
    follow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 4 },
    oBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    oMeta: { flex: 1, fontSize: 13, color: c.textSecondary },
    oTotal: { fontSize: 18, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
    moreBtn: { alignSelf: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  });
}
