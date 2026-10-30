import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, type } from '@/constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Título grande de sección (tipo "large title" de iOS) + botón pill opcional */
export default React.memo(function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          style={({ pressed, hovered }: any) => [
            styles.actionButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : hovered ? 0.9 : 1 },
          ]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...type.largeTitle,
    marginBottom: 4,
  },
  subtitle: {
    ...type.callout,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    marginBottom: 2,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
