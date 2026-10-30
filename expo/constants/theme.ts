import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Tokens de diseño "estilo Apple": fuente del sistema, escala tipográfica,
 * radios, espaciado (base 4), sombras muy suaves y efecto vidrio para web.
 */

/** Fuente del sistema: SF en Apple, Inter/Segoe/Roboto en el resto */
export const FONT_FAMILY = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

/** Escala tipográfica (tamaños de iOS) */
export const type = {
  largeTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.6, lineHeight: 38 },
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

/** Quita el contorno del navegador en campos de texto (el foco se marca con el borde del propio campo) */
export const webInputReset: TextStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {};
