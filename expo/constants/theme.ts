import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeColors } from './colors';

/**
 * Tokens de diseño con el lenguaje de Apple: fuente del sistema (SF en Mac/iPhone, Inter en el resto),
 * escala tipográfica de iOS, radios continuos, espaciado base 4, sombras muy suaves y vidrio.
 */

/** Figtree (la tipografía de la web de Alpha Omega, desde Google Fonts); si no carga, la del sistema */
export const FONT_FAMILY = Platform.select({
  web: '"Figtree", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

/** Fuente para títulos grandes: la misma Figtree de alphaomega-electronics.com */
export const DISPLAY_FAMILY = Platform.select({
  web: '"Figtree", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

/** Fondo del contenido de una pantalla: transparente en web, porque el fondo (con su brillo) lo pone la propia escena */
export function canvas(colors: ThemeColors): string {
  return Platform.OS === 'web' ? 'transparent' : colors.background;
}

/**
 * Fondo de cada escena de la navegación: SIEMPRE opaco. Las pantallas que no están activas siguen pintadas
 * debajo (pestañas y pila), así que un fondo transparente hacía que se vieran unas encima de otras.
 * En web lleva el brillo de color para que el aspecto sea el mismo.
 */
export function sceneBackground(colors: ThemeColors): ViewStyle {
  if (Platform.OS !== 'web') return { backgroundColor: colors.background };
  return { backgroundColor: colors.background, backgroundImage: colors.ambient, backgroundRepeat: 'no-repeat' } as unknown as ViewStyle;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

/** Escala tipográfica (tamaños de iOS) */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '800', letterSpacing: -0.9, lineHeight: 41, ...(DISPLAY_FAMILY ? { fontFamily: DISPLAY_FAMILY } : {}) },
  title1: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, lineHeight: 32 },
  title2: { fontSize: 21, fontWeight: '700', letterSpacing: -0.35, lineHeight: 26 },
  title3: { fontSize: 18, fontWeight: '600', letterSpacing: -0.25, lineHeight: 23 },
  headline: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2, lineHeight: 21 },
  body: { fontSize: 16, fontWeight: '400', letterSpacing: -0.2, lineHeight: 22 },
  callout: { fontSize: 15, fontWeight: '400', letterSpacing: -0.15, lineHeight: 20 },
  subhead: { fontSize: 14, fontWeight: '400', letterSpacing: -0.1, lineHeight: 19 },
  footnote: { fontSize: 13, fontWeight: '400', letterSpacing: -0.05, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', letterSpacing: 0, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

/** Sombra muy suave para tarjetas (en oscuro no hace falta: las superficies ya se separan por tono) */
export function cardShadow(isDark: boolean): ViewStyle {
  if (isDark) return {};
  return Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' } as ViewStyle,
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  })!;
}

/** Efecto vidrio (solo web): fondo translúcido + desenfoque del contenido de detrás */
export function glass(background: string, blur = 20): ViewStyle {
  if (Platform.OS !== 'web') return { backgroundColor: background };
  return {
    backgroundColor: background,
    backdropFilter: `saturate(180%) blur(${blur}px)`,
    WebkitBackdropFilter: `saturate(180%) blur(${blur}px)`,
  } as unknown as ViewStyle;
}

/**
 * Vidrio flotante (estilo Liquid Glass): translúcido, borde claro, brillo interior arriba y sombra amplia.
 * Solo para controles flotantes (barras, pestañas, botones), nunca para bloques de texto.
 */
export function liquidGlass(colors: ThemeColors, isDark: boolean, opts: { strong?: boolean; blur?: number } = {}): ViewStyle {
  const bg = opts.strong ? colors.glassStrong : colors.glass;
  if (Platform.OS !== 'web') return { backgroundColor: isDark ? colors.surface : colors.surface };
  const blur = opts.blur ?? 24;
  return {
    backgroundColor: bg,
    backdropFilter: `blur(${blur}px) saturate(180%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    boxShadow: `inset 0 1px 0 ${colors.glassHighlight}, 0 10px 30px rgba(0,0,0,${isDark ? 0.45 : 0.12}), 0 1px 3px rgba(0,0,0,${isDark ? 0.3 : 0.06})`,
  } as unknown as ViewStyle;
}

/** Quita el contorno del navegador en campos de texto (el foco se marca con el borde del propio campo) */
export const webInputReset: TextStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {};
