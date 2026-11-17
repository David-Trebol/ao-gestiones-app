import React, { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { glass, type } from '@/constants/theme';
import { TAB_BAR_SPACE } from '@/components/AppNav';

/** Ancho máximo común de todas las pantallas */
export const PAGE_MAX = 1600;

/** Márgenes según el ancho: móvil 16, tablet 24, ordenador 32 */
export function usePageLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pad = width >= 1200 ? 32 : width >= 768 ? 24 : 16;
  const mobile = width < 768;
  const content: ViewStyle = { width: '100%', maxWidth: PAGE_MAX, alignSelf: 'center', paddingHorizontal: pad };
  /** Espacio al final de las listas: en móvil, lo que ocupa la barra flotante de vidrio */
  const bottomSpace = mobile ? TAB_BAR_SPACE + insets.bottom : 48;
  return { width, height, pad, content, mobile, desktop: width >= 1024, short: height < 500, bottomSpace };
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
  title: { ...type.largeTitle },
  subtitle: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
});

/**
 * Título que se encoge al desplazarse (como en iOS): el título grande se va con el contenido y,
 * al pasar de 48 px, aparece arriba una barra de vidrio con el título pequeño.
 */
export function useCollapsingTitle(threshold = 48) {
  const [shown, setShown] = useState(false);
  const ref = useRef(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > threshold;
    if (next !== ref.current) {
      ref.current = next;
      setShown(next);
    }
  }, [threshold]);
  return { shown, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}

export function CompactTitleBar({ title, shown, actions }: { title: string; shown: boolean; actions?: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents={shown ? 'box-none' : 'none'}
      style={[
        compact.bar,
        { paddingTop: insets.top, borderBottomColor: colors.divider, opacity: shown ? 1 : 0 },
        // El desenfoque solo mientras se ve (oculto seguía costando en cada fotograma del desplazamiento)
        shown ? glass(colors.headerBackground, 24) : { backgroundColor: 'transparent' },
        Platform.OS === 'web' && ({ transitionProperty: 'opacity', transitionDuration: '180ms' } as ViewStyle),
      ]}
      aria-hidden={!shown}
    >
      <View style={compact.inner}>
        <Text style={[compact.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {!!actions && <View style={compact.actions}>{actions}</View>}
      </View>
    </View>
  );
}

const compact = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  inner: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 56 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  actions: { position: 'absolute', right: 12, top: 4, flexDirection: 'row', gap: 8 },
});
