/**
 * Sistema de color de AO Gestiones, con el lenguaje de las apps de Apple.
 * - Un único color de acción (azul del sistema); el resto, neutros de iOS/macOS.
 * - El color aparece donde Apple lo pone: estados, iconos de colores (como en Ajustes de iOS),
 *   el icono de la app y un brillo muy suave de fondo que se ve a través del vidrio.
 * - Vidrio: barras translúcidas con desenfoque (barra lateral en ordenador, barra flotante en móvil).
 * Contrastes comprobados (WCAG AA): textos ≥ 4,5:1 sobre blanco y sobre el fondo agrupado,
 * estados ≥ 4,8:1 sobre su tinte; en oscuro, el azul de texto 4,7:1 sobre #1C1C1E.
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
  /** Fondo de botones principales (texto blanco ≥ 4,5:1 también en oscuro) */
  primaryFill: string;
  /** Vidrio: fondo translúcido, borde claro y brillo superior */
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassHighlight: string;
  /** Brillo de color de fondo (CSS, solo web) que se ve a través del vidrio */
  ambient: string;
}

/** Colores del sistema para iconos de colores (como los de Ajustes de iOS) */
export const SystemTint = {
  blue: '#007AFF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  pink: '#FF2D55',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  teal: '#30B0C7',
  gray: '#8E8E93',
} as const;

export const LightColors: ThemeColors = {
  primary: '#0071E3',
  primaryDark: '#0062C4',
  primaryLight: '#2B8CF0',
  primarySoft: 'rgba(0, 113, 227, 0.08)',
  primarySoftAlt: 'rgba(0, 113, 227, 0.14)',
  accent: '#0066CC',
  accentDark: '#0055AA',
  accentLight: '#2B8CF0',
  accentSoft: 'rgba(0, 113, 227, 0.10)',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F7',
  surfaceElevated: '#FFFFFF',
  text: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#6C6C70',
  border: 'rgba(60, 60, 67, 0.18)',
  borderLight: 'rgba(60, 60, 67, 0.08)',
  divider: 'rgba(60, 60, 67, 0.12)',
  success: '#1D7A34',
  successBg: 'rgba(52, 199, 89, 0.14)',
  successBorder: 'rgba(52, 199, 89, 0.32)',
  warning: '#A35200',
  warningBg: 'rgba(255, 149, 0, 0.14)',
  warningBorder: 'rgba(255, 149, 0, 0.32)',
  error: '#D70015',
  errorBg: 'rgba(255, 59, 48, 0.09)',
  errorBorder: 'rgba(255, 59, 48, 0.26)',
  info: '#0066CC',
  infoBg: 'rgba(0, 113, 227, 0.08)',
  infoBorder: 'rgba(0, 113, 227, 0.25)',
  statusPendingBg: 'rgba(255, 149, 0, 0.14)',
  statusPendingText: '#A35200',
  statusProcessingBg: 'rgba(0, 122, 255, 0.14)',
  statusProcessingText: '#0062C4',
  statusShippedBg: 'rgba(175, 82, 222, 0.14)',
  statusShippedText: '#5E3FC4',
  statusDeliveredBg: 'rgba(52, 199, 89, 0.14)',
  statusDeliveredText: '#1D7A34',
  statusCancelledBg: 'rgba(255, 59, 48, 0.14)',
  statusCancelledText: '#C4001A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.28)',
  cardShadow: 'rgba(0, 0, 0, 0.06)',
  headerBackground: 'rgba(249, 249, 251, 0.72)',
  tabBarBackground: 'rgba(255, 255, 255, 0.62)',
  heroTile: '#1D1D1F',
  heroTileText: '#F5F5F7',
  heroTileTextSecondary: 'rgba(245, 245, 247, 0.66)',
  fill: 'rgba(118, 118, 128, 0.12)',
  primaryFill: '#0071E3',
  glass: 'rgba(255, 255, 255, 0.58)',
  glassStrong: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(255, 255, 255, 0.65)',
  glassHighlight: 'rgba(255, 255, 255, 0.9)',
  ambient:
    'radial-gradient(1200px 600px at 0% 0%, rgba(0, 122, 255, 0.10), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(175, 82, 222, 0.09), transparent 60%), radial-gradient(900px 600px at 50% 110%, rgba(255, 149, 0, 0.07), transparent 60%)',
};

export const DarkColors: ThemeColors = {
  primary: '#0A84FF',
  primaryDark: '#0071E3',
  primaryLight: '#4DA3FF',
  primarySoft: 'rgba(10, 132, 255, 0.16)',
  primarySoftAlt: 'rgba(10, 132, 255, 0.26)',
  accent: '#4DA3FF',
  accentDark: '#0A84FF',
  accentLight: '#7DBBFF',
  accentSoft: 'rgba(10, 132, 255, 0.18)',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  surfaceElevated: '#2C2C2E',
  text: '#F5F5F7',
  textSecondary: '#98989F',
  textTertiary: '#8D8D93',
  border: 'rgba(84, 84, 88, 0.65)',
  borderLight: 'rgba(84, 84, 88, 0.36)',
  divider: 'rgba(84, 84, 88, 0.45)',
  success: '#5CDB7E',
  successBg: 'rgba(48, 209, 88, 0.16)',
  successBorder: 'rgba(48, 209, 88, 0.32)',
  warning: '#FFB340',
  warningBg: 'rgba(255, 159, 10, 0.16)',
  warningBorder: 'rgba(255, 159, 10, 0.32)',
  error: '#FF6961',
  errorBg: 'rgba(255, 69, 58, 0.16)',
  errorBorder: 'rgba(255, 69, 58, 0.32)',
  info: '#4DA3FF',
  infoBg: 'rgba(10, 132, 255, 0.16)',
  infoBorder: 'rgba(10, 132, 255, 0.34)',
  statusPendingBg: 'rgba(255, 159, 10, 0.18)',
  statusPendingText: '#FFB340',
  statusProcessingBg: 'rgba(10, 132, 255, 0.20)',
  statusProcessingText: '#6CB4FF',
  statusShippedBg: 'rgba(191, 90, 242, 0.22)',
  statusShippedText: '#C9A4FF',
  statusDeliveredBg: 'rgba(48, 209, 88, 0.18)',
  statusDeliveredText: '#5CDB7E',
  statusCancelledBg: 'rgba(255, 69, 58, 0.18)',
  statusCancelledText: '#FF8A82',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.55)',
  cardShadow: 'rgba(0, 0, 0, 0.0)',
  headerBackground: 'rgba(22, 22, 24, 0.72)',
  tabBarBackground: 'rgba(30, 30, 32, 0.62)',
  heroTile: '#2C2C2E',
  heroTileText: '#F5F5F7',
  heroTileTextSecondary: 'rgba(245, 245, 247, 0.62)',
  fill: 'rgba(118, 118, 128, 0.24)',
  primaryFill: '#0071E3',
  glass: 'rgba(36, 36, 40, 0.55)',
  glassStrong: 'rgba(36, 36, 40, 0.78)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.18)',
  ambient:
    'radial-gradient(1200px 600px at 0% 0%, rgba(10, 132, 255, 0.16), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(191, 90, 242, 0.13), transparent 60%), radial-gradient(900px 600px at 50% 110%, rgba(255, 159, 10, 0.08), transparent 60%)',
};

export const Colors = LightColors;
