import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors } from '@/constants/colors';
import { cardShadow, radius, webInputReset } from '@/constants/theme';
import StatusBadge, { STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
import SelectSheet, { SheetOption } from '@/components/SelectSheet';
import type { Order, OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/utils/calculations';
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
} from '@/utils/orderFilters';

// Se conservan al volver de un pedido o al cambiar de vista
let savedFilters: OrderFilters = { ...DEFAULT_FILTERS };
let savedVisible = 50;

type SheetKind = 'manufacturer' | 'year' | 'period' | 'sort' | null;

export default function OrdersDashboard() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { orders, manufacturers, years } = useData();
  const desktop = width >= 1024;
  const tablet = width >= 768 && !desktop;
  const [filters, setFiltersState] = useState<OrderFilters>(savedFilters);
  const [visible, setVisibleState] = useState(savedVisible);
  const [sheet, setSheet] = useState<SheetKind>(null);
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
  const attention = useMemo(
    () => orders.map(o => ({ o, reasons: attentionReasons(o, now) })).filter(x => x.reasons.length).sort((a, b) => new Date(a.o.updated_at).getTime() - new Date(b.o.updated_at).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "now" cambia en cada render; basta con recalcular cuando cambian los pedidos
    [orders],
  );
  const list = useMemo(() => filterOrders(orders, filters, now), [orders, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = list.slice(0, visible);
  const nActive = activeFilterCount(filters);
  const activeOrders = counts.pending.n + counts.processing.n + counts.shipped.n;

  const allYears = useMemo(() => Array.from(new Set([...years, ...orders.map(o => o.year)])).sort((a, b) => b - a), [years, orders]);
  const mfName = manufacturers.find(m => m.id === filters.manufacturerId)?.name;

  const open = (o: Order) => router.push(`/order-detail?orderId=${o.id}` as never);
  const newOrder = () => router.push('/order-form' as never);

  const sheetProps = (): { title: string; options: SheetOption<string>[]; selected: string; onSelect: (v: string) => void } | null => {
    switch (sheet) {
      case 'manufacturer':
        return {
          title: 'Fabricante',
          options: [{ value: '', label: 'Todos los fabricantes' }, ...manufacturers.map(m => ({ value: m.id, label: m.name, hint: m.code }))].map(o => ({ ...o, value: o.value || '__all' })),
          selected: filters.manufacturerId || '__all',
          onSelect: v => setFilters({ manufacturerId: v === '__all' ? '' : v }),
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
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        s.chip,
        active ? { backgroundColor: colors.primarySoftAlt } : { backgroundColor: hovered || pressed ? colors.fill : colors.surface },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Cambiar`}
    >
      <Text style={[s.chipText, active && { color: colors.primary }]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={14} color={active ? colors.primary : colors.textSecondary} />
    </Pressable>
  );

  return (
    <View style={{ gap: 20 }}>
      {/* 1. Buscar + nuevo pedido */}
      <View style={s.topRow}>
        <View style={[s.searchBox, { backgroundColor: isDark ? colors.surface : colors.surface }, cardShadow(isDark)]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            value={filters.query}
            onChangeText={t => setFilters({ query: t })}
            placeholder={desktop ? 'Buscar por referencia, cliente, NIF, producto, nº de factura…' : 'Buscar pedidos'}
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
        <Pressable
          onPress={newOrder}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.newBtn, { backgroundColor: hovered ? colors.primaryDark : colors.primary, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Nuevo pedido"
          testID="new-order-btn"
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          <Text style={s.newBtnText}>{width >= 420 ? 'Nuevo pedido' : 'Nuevo'}</Text>
        </Pressable>
      </View>

      {/* 2. Contadores por estado */}
      <View>
        <Text style={s.sectionTitle}>Estados · {activeOrders} en curso de {orders.length}</Text>
        <ScrollView horizontal={!desktop} showsHorizontalScrollIndicator={false} contentContainerStyle={desktop ? s.countersGrid : s.countersScroll} style={!desktop ? { marginHorizontal: -20 } : undefined}>
          {STATUS_ORDER.map(st => {
            const sel = filters.status === st;
            const cfg = statusConfig[st];
            return (
              <Pressable
                key={st}
                onPress={() => setFilters({ status: sel ? 'all' : st })}
                style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
                  s.counter,
                  desktop ? { flex: 1 } : { width: 148 },
                  { backgroundColor: colors.surface, borderColor: sel ? colors[cfg.textKey] : 'transparent' },
                  cardShadow(isDark),
                  (hovered || pressed) && !sel && { backgroundColor: colors.surfaceAlt },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${cfg.label}: ${counts[st].n} pedidos. ${sel ? 'Quitar filtro' : 'Ver estos pedidos'}`}
                testID={`counter-${st}`}
              >
                <View style={[s.dot, { backgroundColor: colors[cfg.textKey] }]} />
                <Text style={s.counterLabel}>{cfg.label}</Text>
                <Text style={s.counterValue}>{counts[st].n}</Text>
                <Text style={s.counterSub} numberOfLines={1}>{formatCurrency(counts[st].total)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Requieren atención */}
      {attention.length > 0 && (
        <View>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Requieren atención · {attention.length}</Text>
            <Pressable onPress={() => setFilters({ status: filters.status === 'attention' ? 'all' : 'attention' })} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>{filters.status === 'attention' ? 'Ver todos los pedidos' : 'Ver en la lista'}</Text>
            </Pressable>
          </View>
          <View style={[s.card, cardShadow(isDark)]}>
            {attention.slice(0, desktop ? 4 : 3).map(({ o, reasons }, i) => (
              <Pressable
                key={o.id}
                onPress={() => open(o)}
                style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [s.attRow, i > 0 && s.rowBorder, (hovered || pressed) && { backgroundColor: colors.surfaceAlt }]}
                accessibilityRole="link"
                accessibilityLabel={`Pedido ${o.reference_number}: ${reasons.join(', ')}`}
              >
                <AlertTriangle size={16} color={colors.warning} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.attRef}>
                    {o.reference_number}
                    <Text style={s.attClient}>  {o.customer?.nombre_empresa || 'Sin cliente'}</Text>
                  </Text>
                  <Text style={s.attReason}>{reasons.join(' · ')}</Text>
                </View>
                <ChevronRight size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
            <Text style={s.ruleNote}>
              Reglas: pendiente más de {ATTENTION_RULES.pendingDays} días sin cambios, procesando o enviado más de {ATTENTION_RULES.activeDays} días sin cambios, sin cliente o con importe 0 €.
            </Text>
          </View>
        </View>
      )}

      {/* 4. Lista con filtros */}
      <View>
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>
            {filters.status === 'attention' ? 'Requieren atención' : filters.status !== 'all' ? statusConfig[filters.status].label : 'Todos los pedidos'} · {list.length}
          </Text>
          {nActive > 0 && (
            <Pressable onPress={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} hitSlop={8} accessibilityRole="button" testID="clear-filters">
              <Text style={s.link}>Quitar filtros ({nActive})</Text>
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginHorizontal: -20 }}>
          <View style={s.filterIcon}>
            <SlidersHorizontal size={16} color={colors.textSecondary} />
          </View>
          {chip('manufacturer', mfName ?? 'Fabricante', !!filters.manufacturerId)}
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
        ) : desktop ? (
          <View style={[s.card, cardShadow(isDark)]} accessibilityRole={Platform.OS === 'web' ? ('table' as never) : undefined}>
            <View style={[s.tr, s.th]}>
              <Text style={[s.thText, s.cRef]}>Referencia</Text>
              <Text style={[s.thText, s.cClient]}>Cliente</Text>
              <Text style={[s.thText, s.cMf]}>Fabricante</Text>
              <Text style={[s.thText, s.cStatus]}>Estado</Text>
              <Text style={[s.thText, s.cDate]}>Creado</Text>
              <Text style={[s.thText, s.cDate]}>Actualizado</Text>
              <Text style={[s.thText, s.cTotal]}>Total</Text>
            </View>
            {shown.map((o, i) => (
              <Pressable
                key={o.id}
                onPress={() => open(o)}
                style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [s.tr, i > 0 && s.rowBorder, (hovered || pressed) && { backgroundColor: colors.surfaceAlt }, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
                accessibilityRole="link"
                accessibilityLabel={`Pedido ${o.reference_number}, ${o.customer?.nombre_empresa || 'sin cliente'}, ${statusConfig[o.status].label}, ${formatCurrency(o.total_with_vat)}`}
                testID={`order-row-${o.id}`}
              >
                <View style={s.cRef}>
                  <Text style={s.tdStrong}>{o.reference_number}</Text>
                  {!!o.custom_reference && <Text style={s.tdSub}>Ref. {o.custom_reference}</Text>}
                </View>
                <View style={s.cClient}>
                  <Text style={s.td}>{o.customer?.nombre_empresa || '—'}</Text>
                  {!!o.customer?.numero_referencia_pedido && <Text style={s.tdSub}>Su pedido {o.customer.numero_referencia_pedido}</Text>}
                </View>
                <Text style={[s.td, s.cMf]}>{o.manufacturer_name}</Text>
                <View style={s.cStatus}>
                  <StatusBadge status={o.status} size="sm" />
                </View>
                <Text style={[s.tdSub, s.cDate]}>{formatDate(o.created_at)}</Text>
                <Text style={[s.tdSub, s.cDate]}>{formatDate(o.updated_at)}</Text>
                <Text style={[s.tdStrong, s.cTotal]}>{formatCurrency(o.total_with_vat)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[s.cardsWrap, tablet && s.cardsWrapTablet]}>
            {shown.map(o => (
              <Pressable
                key={o.id}
                onPress={() => open(o)}
                style={({ pressed }) => [s.oCard, tablet && s.oCardTablet, cardShadow(isDark), pressed && { backgroundColor: colors.surfaceAlt }]}
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
                <View style={s.oBottom}>
                  <Text style={s.oMeta} numberOfLines={2}>
                    {o.manufacturer_name} · {formatDate(o.created_at)} · {o.items.length} {o.items.length === 1 ? 'producto' : 'productos'}
                  </Text>
                  <Text style={s.oTotal}>{formatCurrency(o.total_with_vat)}</Text>
                </View>
              </Pressable>
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

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    topRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderRadius: radius.md, minWidth: 0 },
    searchInput: { flex: 1, minWidth: 0, fontSize: 16, color: c.text, height: 48, ...webInputReset },
    clearBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 48, paddingHorizontal: 16, borderRadius: radius.pill },
    newBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, paddingHorizontal: 4 },
    link: { fontSize: 14, color: c.primary, fontWeight: '500' },
    countersGrid: { flexDirection: 'row', gap: 12 },
    countersScroll: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 4 },
    counter: { borderRadius: radius.lg, padding: 14, borderWidth: 2, minHeight: 104 },
    dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
    counterLabel: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
    counterValue: { fontSize: 26, fontWeight: '700', color: c.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'], marginTop: 2 },
    counterSub: { fontSize: 12, color: c.textSecondary, fontVariant: ['tabular-nums'] },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' },
    attRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    attRef: { fontSize: 15, fontWeight: '600', color: c.text },
    attClient: { fontWeight: '400', color: c.textSecondary },
    attReason: { fontSize: 13, color: c.warning, marginTop: 2 },
    ruleNote: { fontSize: 12, color: c.textTertiary, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
    filterIcon: { width: 28, alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, maxWidth: 260 },
    chipText: { fontSize: 14, color: c.text, fontWeight: '500' },
    empty: { padding: 28, alignItems: 'center', gap: 6 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    emptyBtn: { marginTop: 8, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', borderRadius: radius.pill },
    tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
    th: { minHeight: 40, paddingVertical: 10, backgroundColor: c.surfaceAlt },
    thText: { fontSize: 12, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
    td: { fontSize: 14, color: c.text },
    tdStrong: { fontSize: 14, color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
    tdSub: { fontSize: 13, color: c.textSecondary, fontVariant: ['tabular-nums'] },
    cRef: { flex: 1.4, minWidth: 0 },
    cClient: { flex: 1.9, minWidth: 0 },
    cMf: { flex: 1.2, minWidth: 0 },
    cStatus: { flex: 1.1, minWidth: 0 },
    cDate: { flex: 0.9, minWidth: 0 },
    cTotal: { flex: 1.1, minWidth: 0, textAlign: 'right' },
    cardsWrap: { gap: 10 },
    cardsWrapTablet: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    oCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, gap: 4 },
    oCardTablet: { width: '48.8%' as unknown as number },
    oTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    oRef: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] },
    oClient: { fontSize: 15, color: c.text },
    oBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    oMeta: { flex: 1, fontSize: 13, color: c.textSecondary },
    oTotal: { fontSize: 18, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
    moreBtn: { alignSelf: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  });
}
