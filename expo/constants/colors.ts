/**
 * Sistema de color "estilo Apple" de AO Gestiones.
 * - Un único acento de marca (naranja tostado) y todo lo demás neutro.
 * - Claro: fondo agrupado gris muy claro + tarjetas blancas (como Ajustes de iOS).
 * - Oscuro: negros y grises neutros (sin marrones), nunca blanco puro para el texto.
 * Contrastes comprobados (WCAG): acento claro #C2410C con texto blanco 5,2:1 y como texto sobre #F2F2F7 4,6:1.
 */
export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primarySoft: string;
  primarySoftAlt: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  accentSoft: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  divider: string;
  success: string;
  successBg: string;
  successBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;
  statusPendingBg: string;
  statusPendingText: string;
  statusProcessingBg: string;
  statusProcessingText: string;
  statusShippedBg: string;
  statusShippedText: string;
  statusDeliveredBg: string;
  statusDeliveredText: string;
  statusCancelledBg: string;
  statusCancelledText: string;
  white: string;
  black: string;
  overlay: string;
  cardShadow: string;
  /** Barra superior (translúcida en web) */
  headerBackground: string;
  /** Barra de pestañas (translúcida en web) */
  tabBarBackground: string;
  /** Bloque oscuro para cifras clave (total del pedido, facturación) */
  heroTile: string;
  heroTileText: string;
  heroTileTextSecondary: string;
  /** Relleno de campos y controles (equivale a "fill" de iOS) */
  fill: string;
}

export const LightColors: ThemeColors = {
  primary: '#C2410C',
  primaryDark: '#9A3412',
  primaryLight: '#EA580C',
  primarySoft: 'rgba(194, 65, 12, 0.08)',
  primarySoftAlt: 'rgba(194, 65, 12, 0.14)',
  accent: '#C2410C',
  accentDark: '#9A3412',
  accentLight: '#EA580C',
  accentSoft: 'rgba(194, 65, 12, 0.10)',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F7',
  surfaceElevated: '#FFFFFF',
  text: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#8E8E93',
  border: 'rgba(60, 60, 67, 0.18)',
  borderLight: 'rgba(60, 60, 67, 0.08)',
  divider: 'rgba(60, 60, 67, 0.12)',
  success: '#248A3D',
  successBg: 'rgba(52, 199, 89, 0.12)',
  successBorder: 'rgba(52, 199, 89, 0.30)',
  warning: '#B25000',
  warningBg: 'rgba(255, 149, 0, 0.12)',
  warningBorder: 'rgba(255, 149, 0, 0.30)',
  error: '#D70015',
  errorBg: 'rgba(255, 59, 48, 0.08)',
  errorBorder: 'rgba(255, 59, 48, 0.25)',
  info: '#0066CC',
  infoBg: 'rgba(0, 113, 227, 0.08)',
  infoBorder: 'rgba(0, 113, 227, 0.25)',
  statusPendingBg: 'rgba(255, 149, 0, 0.14)',
  statusPendingText: '#9A4F00',
  statusProcessingBg: 'rgba(0, 113, 227, 0.10)',
  statusProcessingText: '#0062C4',
  statusShippedBg: 'rgba(88, 86, 214, 0.11)',
  statusShippedText: '#4744C2',
  statusDeliveredBg: 'rgba(52, 199, 89, 0.14)',
  statusDeliveredText: '#1E7A35',
  statusCancelledBg: 'rgba(255, 59, 48, 0.10)',
  statusCancelledText: '#C4001A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.32)',
  cardShadow: 'rgba(0, 0, 0, 0.06)',
  headerBackground: '#F9F9FB',
  tabBarBackground: 'rgba(249, 249, 251, 0.90)',
  heroTile: '#1D1D1F',
  heroTileText: '#F5F5F7',
  heroTileTextSecondary: 'rgba(245, 245, 247, 0.62)',
  fill: 'rgba(118, 118, 128, 0.10)',
};

export const DarkColors: ThemeColors = {
  primary: '#E5641C',
  primaryDark: '#C2410C',
  primaryLight: '#FF8A3D',
  primarySoft: 'rgba(229, 100, 28, 0.16)',
  primarySoftAlt: 'rgba(229, 100, 28, 0.26)',
  accent: '#E5641C',
  accentDark: '#C2410C',
  accentLight: '#FF8A3D',
  accentSoft: 'rgba(229, 100, 28, 0.18)',
  background: '#0B0B0C',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  surfaceElevated: '#2C2C2E',
  text: '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary: '#8D8D93',
  border: 'rgba(84, 84, 88, 0.65)',
  borderLight: 'rgba(84, 84, 88, 0.36)',
  divider: 'rgba(84, 84, 88, 0.45)',
  success: '#30D158',
  successBg: 'rgba(48, 209, 88, 0.14)',
  successBorder: 'rgba(48, 209, 88, 0.32)',
  warning: '#FF9F0A',
  warningBg: 'rgba(255, 159, 10, 0.14)',
  warningBorder: 'rgba(255, 159, 10, 0.32)',
  error: '#FF6961',
  errorBg: 'rgba(255, 69, 58, 0.14)',
  errorBorder: 'rgba(255, 69, 58, 0.32)',
  info: '#64D2FF',
  infoBg: 'rgba(10, 132, 255, 0.16)',
  infoBorder: 'rgba(10, 132, 255, 0.34)',
  statusPendingBg: 'rgba(255, 159, 10, 0.16)',
  statusPendingText: '#FFB340',
  statusProcessingBg: 'rgba(10, 132, 255, 0.18)',
  statusProcessingText: '#70B7FF',
  statusShippedBg: 'rgba(94, 92, 230, 0.22)',
  statusShippedText: '#A9A7FF',
  statusDeliveredBg: 'rgba(48, 209, 88, 0.16)',
  statusDeliveredText: '#5CDB7E',
  statusCancelledBg: 'rgba(255, 69, 58, 0.16)',
  statusCancelledText: '#FF8A82',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.55)',
  cardShadow: 'rgba(0, 0, 0, 0.0)',
  headerBackground: '#161618',
  tabBarBackground: 'rgba(22, 22, 24, 0.88)',
  heroTile: '#2C2C2E',
  heroTileText: '#F5F5F7',
  heroTileTextSecondary: 'rgba(245, 245, 247, 0.6)',
  fill: 'rgba(118, 118, 128, 0.24)',
};

export const Colors = LightColors;
