import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label?: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  /** Etiqueta para lectores de pantalla cuando el botón solo lleva icono */
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

/** Botón común: 44 px de alto, estados de hover, pulsado, foco, cargando y deshabilitado. */
export default function Button({ label, icon: Icon, onPress, variant = 'secondary', disabled, busy, accessibilityLabel, testID, style }: Props) {
  const { colors } = useTheme();
  const fg = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.error : variant === 'ghost' ? colors.primary : colors.text;
  const bg = (hovered?: boolean) =>
    variant === 'primary'
      ? hovered ? colors.primaryDark : colors.primaryFill
      : variant === 'danger'
        ? colors.errorBg
        : variant === 'ghost'
          ? hovered ? colors.fill : 'transparent'
          : hovered ? colors.surfaceAlt : colors.fill;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.btn,
        !label && styles.iconOnly,
        { backgroundColor: bg(hovered), opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        Platform.OS === 'web' && ({ cursor: disabled ? 'default' : 'pointer' } as ViewStyle),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      testID={testID}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={18} color={fg} strokeWidth={2.2} /> : null}
      {!!label && <Text style={[styles.text, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999 },
  iconOnly: { width: 44, paddingHorizontal: 0 },
  text: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
});
