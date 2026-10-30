import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Package, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, type } from '@/constants/theme';

interface Props {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default React.memo(function EmptyState({ icon, title, description, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.fill }]}>
        {icon || <Package size={36} color={colors.textTertiary} strokeWidth={1.5} />}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Plus size={17} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 36,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    ...type.title2,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  description: {
    ...type.callout,
    textAlign: 'center' as const,
    marginBottom: 28,
    maxWidth: 360,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
