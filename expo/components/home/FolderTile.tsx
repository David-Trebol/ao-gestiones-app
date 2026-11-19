import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ChevronRight, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { cardShadow } from '@/constants/theme';
import { enter } from '@/constants/motion';
import { STATUS_ORDER, statusConfig } from '@/components/StatusBadge';
import { STATUS_TINT } from '@/components/home/OrdersDashboard';
import { formatCurrency, formatDate } from '@/utils/calculations';
import type { Order } from '@/types';

interface Props {
  /** «year»: el año en grande; «manufacturer»: código en un cuadrado naranja y el nombre */
  kind: 'year' | 'manufacturer';
  title: string;
  code?: string;
  orders: Order[];
  /** Dato extra para años (p. ej. «3 fabricantes») */
  extraLabel?: string;
  extraValue?: string;
  onPress: () => void;
  onDuplicate?: () => void;
  testID?: string;
}

/**
 * Carpeta de la vista «Por año y fabricante» con la marca Alpha Omega: muestra de un vistazo cuántos pedidos hay,
 * cómo se reparten por estado (barra de colores) y el importe sin cancelados.
 */
export default function FolderTile({ kind, title, code, orders, extraLabel, extraValue, onPress, onDuplicate, testID }: Props) {
  const { colors, isDark } = useTheme();
  const stats = useMemo(() => {
    const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, 0])) as Record<(typeof STATUS_ORDER)[number], number>;
    let amount = 0;
    let last = '';
    for (const o of orders) {
      counts[o.status] += 1;
      if (o.status !== 'cancelled') amount += o.total_with_vat;
      if (o.created_at > last) last = o.created_at;
    }
    return { counts, amount, last };
  }, [orders]);
  const n = orders.length;
  const web = Platform.OS === 'web';

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}${code && kind === 'manufacturer' ? `, código ${code}` : ''}, ${n} pedido${n === 1 ? '' : 's'}, importe ${formatCurrency(stats.amount)}`}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        { backgroundColor: colors.surface, borderTopColor: hovered || pressed ? colors.brand : 'transparent' },
        cardShadow(isDark),
        web && ({ cursor: 'pointer', transitionProperty: 'border-color, transform', transitionDuration: '160ms' } as ViewStyle),
        web && hovered && ({ transform: [{ translateY: -2 }] } as ViewStyle),
      ]}
    >
      <View style={styles.top}>
        {kind === 'year' ? (
          <Text style={[styles.year, { color: colors.reference }]} accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <View style={styles.mfHead}>
            <View style={[styles.codeTile, { backgroundColor: colors.brand }]}>
              <Text style={[styles.codeText, { color: colors.onPrimary }]} numberOfLines={1}>
                {(code || title).slice(0, 4)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.mfName, { color: colors.text }]} numberOfLines={2} accessibilityRole="header">
                {title}
              </Text>
              {!!code && <Text style={[styles.small, { color: colors.textSecondary }]}>Código {code}</Text>}
            </View>
          </View>
        )}
        {onDuplicate ? (
          <Pressable
            onPress={onDuplicate}
            accessibilityRole="button"
            accessibilityLabel={`Duplicar ${title}`}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [styles.iconBtn, { backgroundColor: hovered ? colors.primarySoftAlt : colors.primarySoft }]}
          >
            <Copy size={16} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={[styles.iconBtn, { backgroundColor: colors.primarySoft }]}>
            <ChevronRight size={18} color={colors.primary} />
          </View>
        )}
      </View>

      {/* Reparto por estado: una barra de colores y la cifra de cada estado con pedidos */}
      <View style={[styles.bar, { backgroundColor: colors.fill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {n > 0 &&
          STATUS_ORDER.filter(s => stats.counts[s] > 0).map(s => (
            <View key={s} style={[{ flex: stats.counts[s], backgroundColor: STATUS_TINT[s] }, enter(0, 'grow', { base: 200 })]} />
          ))}
      </View>
      <View style={styles.legend}>
        {n === 0 ? (
          <Text style={[styles.small, { color: colors.textSecondary }]}>Sin pedidos todavía</Text>
        ) : (
          STATUS_ORDER.filter(s => stats.counts[s] > 0).map(s => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: STATUS_TINT[s] }]} />
              <Text style={[styles.small, { color: colors.textSecondary }]}>
                {stats.counts[s]} {statusConfig[s].label.toLowerCase()}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.stats, { borderTopColor: colors.divider }]}>
        <View style={[styles.stat, { flex: 0.7 }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pedidos</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{n}</Text>
        </View>
        <View style={[styles.stat, { flex: 0, minWidth: 96 }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{extraLabel ?? 'Último pedido'}</Text>
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {extraValue ?? (stats.last ? formatDate(stats.last) : '—')}
          </Text>
        </View>
        <View style={[styles.stat, { flex: 1.6, alignItems: 'flex-end' }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Importe</Text>
          <Text style={[styles.statValue, styles.amount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(stats.amount)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 10, borderTopWidth: 3, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, minHeight: 44 },
  year: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  mfHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  codeTile: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  codeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  mfName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, minHeight: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  small: { fontSize: 12.5 },
  stats: { flexDirection: 'row', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  stat: { flex: 1, minWidth: 0, gap: 2 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  amount: { fontSize: 17, fontWeight: '800' },
});
