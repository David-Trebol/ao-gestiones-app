import React, { useEffect, useRef } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { ChevronRight, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

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
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      ])
    ).start();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, isDark ? 0.12 : 0.09],
  });

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      friction: 5,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onDuplicate}
        delayLongPress={600}
        testID={testID}
        style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight, shadowColor: colors.cardShadow }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: shimmerOpacity, borderRadius: 18 }]} />
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            {icon}
          </View>
          <View style={styles.headerRight}>
            {onDuplicate && (
              <Pressable
                onPress={onDuplicate}
                hitSlop={8}
                style={({ pressed }) => [styles.duplicateBtn, { backgroundColor: colors.primarySoft, transform: [{ scale: pressed ? 0.8 : 1 }] }]}
              >
                <Copy size={12} color={colors.primary} />
              </Pressable>
            )}
            <View style={styles.badgesContainer}>
              {badges?.map((badge, i) => (
                <View key={i} style={[styles.badge, { backgroundColor: badge.color }]}>
                  <Text style={styles.badgeText}>{badge.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}

        {totalLabel && totalValue ? (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{totalLabel}</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>{totalValue}</Text>
          </View>
        ) : null}

        <View style={[styles.footer, { borderTopColor: colors.divider }]}>
          <Text style={[styles.footerText, { color: colors.primary }]}>Ver detalles</Text>
          <ChevronRight size={13} color={colors.primary} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    minHeight: 182,
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  duplicateBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgesContainer: {
    alignItems: 'flex-end',
    gap: 5,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800' as const,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 12,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
