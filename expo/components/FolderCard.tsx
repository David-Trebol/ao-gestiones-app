import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { ChevronRight, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { NATIVE_DRIVER, motion } from '@/constants/animation';
import { cardShadow, radius, type } from '@/constants/theme';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badges?: { label: string; color: string }[];
  totalLabel?: string;
  totalValue?: string;
  onPress: () => void;
  onDuplicate?: () => void;
  testID?: string;
}

/** Tarjeta de carpeta (año / fabricante): blanca, sin bordes, sombra mínima y una sola llamada a la acción */
export default React.memo(function FolderCard({
  icon,
  title,
  subtitle,
  badges,
  totalLabel,
  totalValue,
  onPress,
  onDuplicate,
  testID,
}: Props) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const pressTo = (toValue: number) =>
    Animated.timing(scaleAnim, { toValue, duration: motion.fast, easing: motion.easeOut, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => pressTo(0.97)}
        onPressOut={() => pressTo(1)}
        onLongPress={onDuplicate}
        delayLongPress={600}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}${totalValue ? `, total ${totalValue}` : ''}`}
        style={({ hovered }: any) => [
          styles.card,
          { backgroundColor: colors.surface },
          cardShadow(isDark),
          Platform.OS === 'web' && hovered && !isDark && ({ boxShadow: '0 2px 4px rgba(0,0,0,0.05), 0 12px 28px rgba(0,0,0,0.08)' } as any),
          Platform.OS === 'web' && hovered && isDark && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>{icon}</View>
          <View style={styles.headerRight}>
            {onDuplicate && (
              <Pressable
                onPress={onDuplicate}
                hitSlop={8}
                accessibilityLabel={`Duplicar ${title}`}
                style={({ pressed }) => [styles.duplicateBtn, { backgroundColor: colors.fill, opacity: pressed ? 0.6 : 1 }]}
              >
                <Copy size={13} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}

        {badges && badges.length > 0 ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>
            {badges.map(b => b.label).join(' · ')}
          </Text>
        ) : null}

        {totalLabel && totalValue ? (
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <View>
              <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>{totalLabel}</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{totalValue}</Text>
            </View>
            <View style={[styles.chevron, { backgroundColor: colors.fill }]}>
              <ChevronRight size={16} color={colors.textSecondary} />
            </View>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: 18,
    minHeight: 176,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transitionProperty: 'box-shadow, background-color', transitionDuration: '200ms' } as any) : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  duplicateBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.title2,
    marginBottom: 2,
  },
  subtitle: {
    ...type.footnote,
  },
  meta: {
    ...type.footnote,
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    ...type.caption,
    marginBottom: 2,
  },
  totalValue: {
    ...type.title3,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
