/**
 * Sistema de color de AO Gestiones: identidad de Alpha Omega Electronics (azul petróleo #002A39,
 * naranja #FF8718, azul acero #7FA4B7, Figtree) con el lenguaje de las apps de Apple.
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
  /** Texto sobre el botón principal (naranja de marca → texto azul petróleo, 6,3:1) */
  onPrimary: string;
  /** Naranja de marca tal cual (logo, acentos grandes); no usar para texto pequeño sobre blanco */
  brand: string;
  /** Color de las referencias de pedido (como el nº de pedido en rojo del Excel) */
  reference: string;
  /** Barra lateral de marca (azul petróleo de alphaomega-electronics.com) */
  nav: string;
  navText: string;
  navMuted: string;
  navActiveBg: string;
  navActiveText: string;
  navDivider: string;
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
  primary: '#B85600',
  primaryDark: '#E5710A',
  primaryLight: '#FF8718',
  primarySoft: 'rgba(255, 135, 24, 0.10)',
  primarySoftAlt: 'rgba(255, 135, 24, 0.18)',
  accent: '#2F6385',
  accentDark: '#0E4C66',
  accentLight: '#7FA4B7',
  accentSoft: 'rgba(127, 164, 183, 0.18)',
  background: '#F3F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F7F8',
  surfaceElevated: '#FFFFFF',
  text: '#002A39',
  textSecondary: '#5B6B73',
  textTertiary: '#66757C',
  border: 'rgba(0, 42, 57, 0.16)',
  borderLight: 'rgba(0, 42, 57, 0.07)',
  divider: 'rgba(0, 42, 57, 0.10)',
  success: '#1D7A34',
  successBg: 'rgba(52, 199, 89, 0.14)',
  successBorder: 'rgba(52, 199, 89, 0.32)',
  warning: '#A35200',
  warningBg: 'rgba(255, 149, 0, 0.14)',
  warningBorder: 'rgba(255, 149, 0, 0.32)',
  error: '#D70015',
  errorBg: 'rgba(255, 59, 48, 0.09)',
  errorBorder: 'rgba(255, 59, 48, 0.26)',
  info: '#2F6385',
  infoBg: 'rgba(127, 164, 183, 0.16)',
  infoBorder: 'rgba(0, 113, 227, 0.25)',
  statusPendingBg: 'rgba(255, 149, 0, 0.14)',
  statusPendingText: '#A35200',
  statusProcessingBg: 'rgba(255, 204, 0, 0.22)',
  statusProcessingText: '#7A5800',
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
  headerBackground: 'rgba(246, 247, 248, 0.78)',
  tabBarBackground: 'rgba(255, 255, 255, 0.62)',
  heroTile: '#002A39',
  heroTileText: '#FFFFFF',
  heroTileTextSecondary: 'rgba(245, 245, 247, 0.66)',
  fill: 'rgba(0, 42, 57, 0.06)',
  primaryFill: '#FF8718',
  glass: 'rgba(255, 255, 255, 0.56)',
  glassStrong: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(255, 255, 255, 0.72)',
  glassHighlight: 'rgba(255, 255, 255, 0.9)',
  onPrimary: '#002A39',
  brand: '#FF8718',
  reference: '#B85600',
  nav: '#002A39',
  navText: '#FFFFFF',
  navMuted: '#9EC1D3',
  navActiveBg: 'rgba(255, 135, 24, 0.16)',
  navActiveText: '#FFA24A',
  navDivider: 'rgba(255, 255, 255, 0.10)',
  // Fondo cálido difuminado (estilo «vidrio»): brillo naranja de la marca arriba a la derecha, melocotón a la izquierda y azul acero abajo
  ambient: 'radial-gradient(900px 620px at 92% -8%, rgba(255, 135, 24, 0.30), transparent 62%), radial-gradient(820px 620px at 4% 28%, rgba(255, 186, 128, 0.26), transparent 64%), radial-gradient(1100px 720px at 58% 112%, rgba(127, 164, 183, 0.30), transparent 62%), linear-gradient(180deg, #F7F1EC 0%, #F1F4F6 100%)',
};

export const DarkColors: ThemeColors = {
  primary: '#FFA24A',
  primaryDark: '#FF8718',
  primaryLight: '#FFB878',
  primarySoft: 'rgba(255, 135, 24, 0.16)',
  primarySoftAlt: 'rgba(255, 135, 24, 0.26)',
  accent: '#9EC1D3',
  accentDark: '#7FA4B7',
  accentLight: '#B9CCD6',
  accentSoft: 'rgba(127, 164, 183, 0.20)',
  background: '#00151D',
  surface: '#0A2A37',
  surfaceAlt: '#113646',
  surfaceElevated: '#113646',
  text: '#EEF3F5',
  textSecondary: '#9FB3BD',
  textTertiary: '#8FA3AD',
  border: 'rgba(158, 193, 211, 0.30)',
  borderLight: 'rgba(158, 193, 211, 0.14)',
  divider: 'rgba(158, 193, 211, 0.18)',
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
  statusProcessingBg: 'rgba(255, 204, 0, 0.18)',
  statusProcessingText: '#FFD54A',
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
  headerBackground: 'rgba(0, 26, 36, 0.78)',
  tabBarBackground: 'rgba(30, 30, 32, 0.62)',
  heroTile: '#113646',
  heroTileText: '#F5F5F7',
  heroTileTextSecondary: 'rgba(245, 245, 247, 0.62)',
  fill: 'rgba(158, 193, 211, 0.14)',
  primaryFill: '#FF8718',
  glass: 'rgba(10, 42, 55, 0.58)',
  glassStrong: 'rgba(10, 42, 55, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.18)',
  onPrimary: '#002A39',
  brand: '#FF8718',
  reference: '#FFA24A',
  nav: '#001E29',
  navText: '#FFFFFF',
  navMuted: '#9EC1D3',
  navActiveBg: 'rgba(255, 135, 24, 0.18)',
  navActiveText: '#FFA24A',
  navDivider: 'rgba(255, 255, 255, 0.08)',
  ambient: 'radial-gradient(900px 620px at 92% -8%, rgba(255, 135, 24, 0.20), transparent 62%), radial-gradient(820px 620px at 4% 28%, rgba(200, 110, 40, 0.14), transparent 64%), radial-gradient(1100px 720px at 58% 112%, rgba(127, 164, 183, 0.18), transparent 62%)',
};

export const Colors = LightColors;
