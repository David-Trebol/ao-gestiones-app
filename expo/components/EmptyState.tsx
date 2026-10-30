import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Package, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

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
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        {icon || <Package size={44} color={colors.textTertiary} />}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={onAction}>
          <Plus size={16} color="#FFFFFF" />
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
    paddingVertical: 64,
    paddingHorizontal: 36,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 19,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    textAlign: 'center' as const,
    marginBottom: 28,
    lineHeight: 21,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 15,
  },
});
