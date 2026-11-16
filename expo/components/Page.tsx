import React from 'react';
import { StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

/** Ancho máximo común de todas las pantallas */
export const PAGE_MAX = 1280;

/** Márgenes según el ancho: móvil 16, tablet 24, ordenador 32 */
export function usePageLayout() {
  const { width, height } = useWindowDimensions();
  const pad = width >= 1200 ? 32 : width >= 768 ? 24 : 16;
  const content: ViewStyle = { width: '100%', maxWidth: PAGE_MAX, alignSelf: 'center', paddingHorizontal: pad };
  return { width, height, pad, content, mobile: width < 768, desktop: width >= 1024, short: height < 500 };
}

interface Props {
  title: string;
  subtitle?: string;
  /** Botones a la derecha del título */
  actions?: React.ReactNode;
  /** Pantallas sin barra superior: añade el margen del notch en móvil */
  topInset?: boolean;
}

/** Cabecera única de pantalla: título a la izquierda, acciones a la derecha. */
export function PageHeader({ title, subtitle, actions, topInset = true }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { pad, short } = usePageLayout();
  return (
    <View style={[styles.wrap, { paddingTop: (topInset ? insets.top : 0) + (short ? 12 : pad > 16 ? 28 : 16) }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: colors.text }, short && { fontSize: 22, lineHeight: 28 }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
});
