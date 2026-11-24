import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronDown, Download, Factory, Mail, MapPin, Package, Phone, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { ThemeColors , SystemTint } from '@/constants/colors';
import { cardShadow, panel, radius, webInputReset } from '@/constants/theme';
import { fx, enter, useCountUp } from '@/constants/motion';
import { itemProgress, itemStatusOf, itemTone } from '@/constants/itemStatus';
import StatusBadge, { STATUS_ICONS, STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
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
  itemsSummary,
  addressLine,
} from '@/utils/orderFilters';

// Se conservan al volver de un pedido o al cambiar de vista
let savedFilters: OrderFilters = { ...DEFAULT_FILTERS };
let savedVisible = 50;

/** Color de sistema de cada estado (círculos de los contadores, como las listas de Recordatorios) */
export const STATUS_TINT: Record<OrderStatus, string> = {
  pending: SystemTint.orange,
  processing: SystemTint.blue,
  shipped: SystemTint.purple,
  delivered: SystemTint.green,
  cancelled: SystemTint.red,
};

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

      {/* Contadores por estado (como las listas de Recordatorios): abren la lista filtrada */}
      {(() => {
        const tiles = STATUS_ORDER.map(st => {
          const sel = filters.status === st;
          const cfg = statusConfig[st];
          const tint = STATUS_TINT[st];
          const Icon = STATUS_ICONS[st];
          return (
            <Pressable
              key={st}
              onPress={() => setFilters({ status: sel ? 'all' : st })}
              style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
                s.counter,
                panel(colors, isDark),
                enter(STATUS_ORDER.indexOf(st), 'pop', { step: 55 }),
                width < 700 ? s.counterScroll : s.counterGrid,
                sel ? { backgroundColor: tint } : (hovered || pressed) ? { backgroundColor: colors.glassStrong } : null,
                Platform.OS === 'web' && ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '160ms' } as object),
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${cfg.label}: ${counts[st].n} pedidos. ${sel ? 'Quitar filtro' : 'Ver estos pedidos'}`}
              testID={`counter-${st}`}
            >
              <View style={s.counterTop}>
                <View style={[s.counterIcon, { backgroundColor: sel ? '#FFFFFF' : tint }]}>
                  <Icon size={17} color={sel ? tint : '#FFFFFF'} strokeWidth={2.4} />
                </View>
                <CountText style={[s.counterValue, sel && { color: '#FFFFFF' }]} value={counts[st].n} />
              </View>
              <Text style={[s.counterLabel, sel && { color: '#FFFFFF' }]} numberOfLines={1}>
                {cfg.label}
              </Text>
              <Text style={[s.counterSub, sel && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                {formatCurrency(counts[st].total)}
              </Text>
            </Pressable>
          );
        });
        return width < 700 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.countersScroll, { paddingHorizontal: pad }]} style={{ marginHorizontal: -pad }}>
            {tiles}
          </ScrollView>
        ) : (
          <View style={s.counters}>{tiles}</View>
        );
      })()}

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
              <Text style={s.link}>{filters.status === 'attention' ? 'Ver todos' : 'Ver cuáles'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Lista */}
      <View>
        <View style={s.listHead}>
          <Text style={s.sectionTitle} accessibilityRole="header">
            {listTitle} <Text style={s.sectionCount}>{list.length}</Text>
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
        {(() => {
          const chipList = (
            <>
              <View style={s.filterIcon}>
                <SlidersHorizontal size={16} color={colors.textSecondary} />
              </View>
              {chip('year', filters.year || 'Año', !!filters.year)}
              {chip('manufacturer', mfName ?? 'Fabricante', !!filters.manufacturerId)}
              {(owners.length > 0 || !!filters.owner) && chip('owner', filters.owner === '__none' ? 'Sin responsable' : filters.owner || 'Responsable', !!filters.owner)}
              {chip('period', filters.period === 'all' ? 'Fecha' : PERIOD_LABELS[filters.period], filters.period !== 'all')}
              {chip('sort', SORT_LABELS[filters.sort], false)}
            </>
          );
          // En móvil, en varias filas (en una sola fila con desplazamiento lateral no se veía que había más)
          return width < 700 ? <View style={[s.chips, s.chipsWrap]}>{chipList}</View> : <View style={s.chips}>{chipList}</View>;
        })()}

        {orders.length === 0 ? (
          <View style={[s.card, s.empty, panel(colors, isDark)]}>
            <Text style={s.emptyTitle}>Aún no hay pedidos</Text>
            <Text style={s.emptyText}>Crea el primero con «Nuevo pedido».</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={[s.card, s.empty, panel(colors, isDark)]}>
            <Text style={s.emptyTitle}>Ningún pedido coincide</Text>
            <Text style={s.emptyText}>Prueba con otra búsqueda o quita los filtros.</Text>
            <Pressable onPress={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })} style={[s.emptyBtn, { backgroundColor: colors.fill }]} accessibilityRole="button">
              <Text style={[s.link, { fontWeight: '600' }]}>Quitar filtros</Text>
            </Pressable>
          </View>
        ) : table ? (
          <OrderTable orders={shown} onOpen={open} showReasons={showReasons} showUpdated={wideTable} />
        ) : (
          <View style={twoCols ? [s.cardsWrap, s.cardsWrapTwo] : [s.card, s.grouped, panel(colors, isDark)]}>
            {shown.map((o, i) => (
              <OrderCardItem key={o.id} order={o} onOpen={open} twoCols={twoCols} grouped={!twoCols} first={i === 0} index={i} showReasons={showReasons} />
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

/** Número que cuenta hasta su valor (contadores de estado) */
function CountText({ value, style }: { value: number; style: React.ComponentProps<typeof Text>['style'] }) {
  const v = useCountUp(value, 700, 200);
  return <Text style={style}>{Math.round(v)}</Text>;
}

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

/** Una sola línea corta bajo el estado: «47 d de retraso», «Previsto hoy» o «Previsto 15/01» (la fila no crece) */
function LateLine({ o }: { o: Order }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!o.expected_date) return o.owner ? <Text style={s.tdSub} numberOfLines={1}>{o.owner}</Text> : null;
  const late = overdueDays(o);
  if (late !== null && late > 0) return <Text style={[s.tdSub, { color: colors.error, fontWeight: '700' }]} numberOfLines={1}>{late} d de retraso</Text>;
  return <Text style={s.tdSub} numberOfLines={1}>{late === 0 ? 'Previsto hoy' : `Previsto ${formatISODate(o.expected_date).slice(0, 5)}`}</Text>;
}

/**
 * Lista de pedidos (ordenador) como la hoja Excel del propietario: cada pedido es un bloque que se lee de un vistazo,
 * de izquierda a derecha y de lo más importante a lo menos: quién es el cliente y dónde está, qué pedido es,
 * qué se le vende y cuánto suma.
 */
export function OrderTable({ orders, onOpen, showReasons }: { orders: Order[]; onOpen: (o: Order) => void; showReasons?: boolean; showUpdated?: boolean }) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.card, panel(colors, isDark)]}>
      <View style={[s.tr, s.th]}>
        <Text style={[s.thText, s.cClient]}>Cliente y dirección</Text>
        <Text style={[s.thText, s.cRef]}>Pedido</Text>
        <Text style={[s.thText, s.cItems]}>Productos</Text>
        <Text style={[s.thText, s.cTotal]}>Total y estado</Text>
      </View>
      {orders.map((o, i) => {
        const reasons = showReasons ? attentionReasons(o) : [];
        const c = o.customer;
        const person = [c?.contacto, c?.departamento].filter(x => x?.trim()).join(' · ');
        const addr = addressLine(c);
        const it = itemsSummary(o);
        return (
          <Pressable
            key={o.id}
            onPress={() => onOpen(o)}
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [s.tr, s.trBody, enter(i, 'rise', { base: 120, step: 35 }), i > 0 && s.rowBorder, (hovered || pressed) && { backgroundColor: colors.primarySoft }, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
            accessibilityRole="link"
            accessibilityLabel={`Pedido ${o.reference_number}, ${c?.nombre_empresa || 'sin cliente'}, ${it.label}, ${statusConfig[o.status].label}, ${formatCurrency(o.total_with_vat)}`}
            testID={`order-row-${o.id}`}
          >
            <View style={[s.cClient, { gap: 3 }]}>
              <Text style={s.clientText} numberOfLines={1}>{c?.nombre_empresa || 'Sin cliente'}</Text>
              {reasons.length > 0 ? (
                <Text style={[s.tdSub, { color: colors.warning }]} numberOfLines={1}>{reasons.join(' · ')}</Text>
              ) : person ? (
                <Text style={s.tdSub} numberOfLines={1}>{person}</Text>
              ) : null}
              {!!addr && (
                <View style={s.iconLine}>
                  <MapPin size={13} color={colors.accent} />
                  <Text style={[s.td, { flexShrink: 1 }]} numberOfLines={1}>{addr}</Text>
                </View>
              )}
              {(!!c?.telefono_1 || !!c?.email) && (
                <View style={s.contactRow}>
                  {!!c?.telefono_1 && (
                    <View style={[s.iconLine, { flexShrink: 0 }]}>
                      <Phone size={13} color={colors.accent} />
                      <Text style={s.tdSub} numberOfLines={1}>{c.telefono_1}</Text>
                    </View>
                  )}
                  {!!c?.email && (
                    <View style={[s.iconLine, { flexShrink: 1 }]}>
                      <Mail size={13} color={colors.accent} />
                      <Text style={[s.tdSub, { flexShrink: 1 }]} numberOfLines={1}>{c.email}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={[s.cRef, { gap: 3 }]}>
              <Text style={s.refText} numberOfLines={1}>{o.reference_number}</Text>
              <Text style={s.tdSub} numberOfLines={1}>
                {formatDate(o.created_at)}
                {o.custom_reference ? ` · ${o.custom_reference}` : ''}
              </Text>
              <View style={s.iconLine}>
                <Factory size={13} color={colors.accent} />
                <Text style={[s.tdSub, { flexShrink: 1 }]} numberOfLines={1}>{o.manufacturer_name} · {o.year}</Text>
              </View>
            </View>
            <View style={[s.cItems, { gap: 3 }]}>
              <View style={s.iconLine}>
                <Package size={14} color={colors.brand} />
                <Text style={s.itemsLabel} numberOfLines={1}>{it.label}</Text>
              </View>
              <ItemDots o={o} />
              {it.names.slice(0, 2).map((n, k) => (
                <Text key={k} style={s.td} numberOfLines={1}>{n}</Text>
              ))}
              {it.names.length > 2 && <Text style={s.tdSub}>y {it.names.length - 2} más</Text>}
            </View>
            <View style={[s.cTotal, { gap: 4, alignItems: 'flex-end' }]}>
              <Text style={s.totalText}>{formatCurrency(o.total_with_vat)}</Text>
              <StatusBadge status={o.status} size="sm" />
              <LateLine o={o} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Pedido como tarjeta (2 columnas) o como fila de una lista agrupada (`grouped`, móvil). Mismo orden que el Excel:
 * referencia y estado, cliente, dirección, productos y, abajo, fabricante y total.
 */
export function OrderCardItem({ order: o, onOpen, twoCols, showReasons, grouped, first, index = 0 }: { order: Order; onOpen: (o: Order) => void; twoCols?: boolean; showReasons?: boolean; grouped?: boolean; first?: boolean; index?: number }) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const reasons = showReasons ? attentionReasons(o) : [];
  const c = o.customer;
  const person = [c?.contacto, c?.departamento].filter(x => x?.trim()).join(' · ');
  const addr = addressLine(c);
  const it = itemsSummary(o);
  return (
    <Pressable
      onPress={() => onOpen(o)}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        s.oCard,
        twoCols && s.oCardTwo,
        enter(index, 'rise', { base: 120, step: 40 }),
        grouped ? s.oRow : panel(colors, isDark),
        (pressed || hovered) && { backgroundColor: grouped ? colors.fill : colors.primarySoft },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Pedido ${o.reference_number}, ${c?.nombre_empresa || 'sin cliente'}, ${it.label}, ${statusConfig[o.status].label}, ${formatCurrency(o.total_with_vat)}`}
      testID={`order-card-${o.id}`}
      {...(grouped ? {} : fx('lift'))}
    >
      {grouped && !first && <View style={s.oSep} />}
      <View style={s.oTop}>
        <Text style={s.oRef}>{o.reference_number}</Text>
        <StatusBadge status={o.status} size="sm" />
      </View>
      <Text style={s.oClient} numberOfLines={2}>{c?.nombre_empresa || 'Sin cliente'}</Text>
      <View style={s.oInfo}>
        {!!person && <Text style={s.tdSub} numberOfLines={1}>{person}</Text>}
        {!!addr && (
          <View style={s.iconLine}>
            <MapPin size={13} color={colors.accent} />
            <Text style={[s.tdSub, { flexShrink: 1 }]} numberOfLines={1}>{addr}</Text>
          </View>
        )}
        {!!c?.telefono_1 && (
          <View style={s.iconLine}>
            <Phone size={13} color={colors.accent} />
            <Text style={s.tdSub} numberOfLines={1}>{c.telefono_1}</Text>
          </View>
        )}
        {!!c?.email && (
          <View style={s.iconLine}>
            <Mail size={13} color={colors.accent} />
            <Text style={[s.tdSub, { flexShrink: 1 }]} numberOfLines={1}>{c.email}</Text>
          </View>
        )}
      </View>
      <View style={[s.oItems, { backgroundColor: colors.fill }]}>
        <View style={s.iconLine}>
          <Package size={14} color={colors.brand} />
          <Text style={s.itemsLabel} numberOfLines={1}>{it.label}</Text>
        </View>
        <ItemDots o={o} />
        {it.names.length > 0 && (
          <Text style={s.td} numberOfLines={1}>
            {it.names[0]}
            {it.names.length > 1 ? ` y ${it.names.length - 1} más` : ''}
          </Text>
        )}
      </View>
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
        <View style={s.oMetaWrap}>
          <Text style={s.oMf} numberOfLines={1}>{o.manufacturer_name} · {o.year}</Text>
          <Text style={s.oMeta} numberOfLines={1}>{formatDate(o.created_at)}</Text>
        </View>
        <Text style={s.oTotal}>{formatCurrency(o.total_with_vat)}</Text>
      </View>
    </Pressable>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, backgroundColor: c.fill },
    searchInput: { flex: 1, minWidth: 0, fontSize: 17, color: c.text, height: 44, letterSpacing: -0.2, ...webInputReset },
    clearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    countersScroll: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
    counter: { borderRadius: 18, padding: 12, backgroundColor: c.surface, gap: 6 },
    counterGrid: { flexGrow: 1, flexBasis: '17%' as unknown as number },
    counterScroll: { width: 148 },
    counterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    counterIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    counterLabel: { fontSize: 15, color: c.textSecondary, fontWeight: '600', letterSpacing: -0.2, marginTop: 2 },
    counterValue: { fontSize: 28, fontWeight: '700', color: c.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
    counterSub: { fontSize: 12.5, color: c.textSecondary, fontVariant: ['tabular-nums'], marginTop: -4 },
    attention: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 4, borderRadius: 14, borderWidth: 0, minHeight: 52 },
    attentionText: { flex: 1, minWidth: 180, fontSize: 15 },
    attentionActions: { flexDirection: 'row', alignItems: 'center' },
    textBtn: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
    listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
    listHeadActions: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.4, paddingHorizontal: 2 },
    sectionCount: { fontWeight: '400', color: c.textSecondary },
    link: { fontSize: 14, color: c.primary, fontWeight: '600' },
    ruleNote: { fontSize: 12.5, lineHeight: 17, color: c.textSecondary, paddingHorizontal: 4, marginBottom: 4 },
    chips: { flexDirection: 'row', gap: 8, paddingBottom: 12, paddingTop: 4, alignItems: 'center' },
    filterIcon: { width: 24, alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, maxWidth: 260 },
    chipText: { fontSize: 14, color: c.text, fontWeight: '500' },
    card: { backgroundColor: c.surface, borderRadius: 20, overflow: 'hidden' },
    empty: { padding: 28, alignItems: 'center', gap: 6 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: c.text },
    emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    emptyBtn: { marginTop: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: radius.pill },
    tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
    th: { minHeight: 40, paddingVertical: 10, backgroundColor: 'transparent', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
    thText: { fontSize: 12.5, fontWeight: '600', color: c.textSecondary, letterSpacing: -0.05 },
    td: { fontSize: 14, color: c.text },
    tdStrong: { fontSize: 14, color: c.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
    tdSub: { fontSize: 13, color: c.textSecondary, fontVariant: ['tabular-nums'] },
    cRef: { flex: 1.35, minWidth: 0 },
    cClient: { flex: 2.5, minWidth: 0 },
    cItems: { flex: 2.1, minWidth: 0 },
    itemsLabel: { fontSize: 14, fontWeight: '700', color: c.text, flexShrink: 1 },
    contactRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12, minWidth: 0 },
    oItems: { gap: 2, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    cContact: { flex: 2, minWidth: 0, gap: 2 },
    cPlace: { flex: 1.5, minWidth: 0 },
    cMf: { flex: 1.1, minWidth: 0 },
    cStatus: { width: 130, alignItems: 'flex-start' },
    trBody: { alignItems: 'flex-start', paddingVertical: 16 },
    refText: { fontSize: 16, fontWeight: '800', color: c.reference, letterSpacing: 0.1, fontVariant: ['tabular-nums'] },
    clientText: { fontSize: 16.5, fontWeight: '800', color: c.text, letterSpacing: -0.1 },
    totalText: { fontSize: 18, letterSpacing: -0.3, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'], ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as object) : {}) },
    iconLine: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    oInfo: { gap: 3, marginTop: 4 },
    cDate: { flex: 1, minWidth: 0 },
    cTotal: { width: 156, flexShrink: 0, textAlign: 'right' },
    cardsWrap: { gap: 10 },
    cardsWrapTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    oCard: { backgroundColor: c.surface, borderRadius: 20, padding: 16, gap: 4 },
    oCardTwo: { width: '48.8%' as unknown as number },
    grouped: { paddingVertical: 0 },
    oRow: { borderRadius: 0, backgroundColor: 'transparent', paddingTop: 14, paddingBottom: 14 },
    oSep: { position: 'absolute', top: 0, left: 16, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.divider },
    oTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    oRef: { flex: 1, fontSize: 16, fontWeight: '800', color: c.reference, fontVariant: ['tabular-nums'] },
    oClient: { fontSize: 17, fontWeight: '700', color: c.text, letterSpacing: -0.2 },
    follow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 4 },
    oBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 6 },
    oMetaWrap: { flex: 1, minWidth: 0 },
    oMf: { fontSize: 13.5, fontWeight: '600', color: c.accent },
    oMeta: { fontSize: 13, color: c.textSecondary },
    chipsWrap: { flexWrap: 'wrap' },
    oTotal: { flexShrink: 0, fontSize: 18, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
    moreBtn: { alignSelf: 'center', marginTop: 12, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  });
}

/** Un punto de color por producto (verde enviado, amarillo pendiente, gris sin empezar) y el recuento; solo si alguno tiene estado */
function ItemDots({ o }: { o: Order }) {
  const { colors, isDark } = useTheme();
  const p = itemProgress(o.items ?? []);
  if (p.total === 0 || p.shipped + p.pending === 0) return null;
  const parts = [p.shipped ? `${p.shipped} enviado${p.shipped === 1 ? '' : 's'}` : '', p.pending ? `${p.pending} pendiente${p.pending === 1 ? '' : 's'}` : ''].filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} accessibilityLabel={parts.join(', ')}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {(o.items ?? []).slice(0, 10).map((x, k) => (
          <View key={k} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: itemTone(itemStatusOf(x), colors, isDark).dot }} />
        ))}
      </View>
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }} numberOfLines={1}>{parts.join(' · ')}</Text>
    </View>
  );
}
