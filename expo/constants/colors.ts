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
}

export const LightColors: ThemeColors = {
  primary: '#D96A2B',
  primaryDark: '#B5521B',
  primaryLight: '#F29A61',
  primarySoft: 'rgba(217, 106, 43, 0.10)',
  primarySoftAlt: 'rgba(217, 106, 43, 0.16)',
  accent: '#F08A4B',
  accentDark: '#D96A2B',
  accentLight: '#F7B07B',
  accentSoft: 'rgba(240, 138, 75, 0.14)',
  background: '#ECE9E4',
  surface: '#F7F4EF',
  surfaceAlt: '#EEE8E0',
  surfaceElevated: '#FFFCF8',
  text: '#29241E',
  textSecondary: '#625A4F',
  textTertiary: '#8F8578',
  border: '#D9D0C3',
  borderLight: '#E7DED2',
  divider: '#E4DBCE',
  success: '#059669',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  statusPendingBg: '#FEF3C7',
  statusPendingText: '#92400E',
  statusProcessingBg: '#DBEAFE',
  statusProcessingText: '#1E40AF',
  statusShippedBg: '#E0E7FF',
  statusShippedText: '#3730A3',
  statusDeliveredBg: '#D1FAE5',
  statusDeliveredText: '#065F46',
  statusCancelledBg: '#FEE2E2',
  statusCancelledText: '#991B1B',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(39, 31, 24, 0.42)',
  cardShadow: 'rgba(63, 42, 26, 0.08)',
};

export const DarkColors: ThemeColors = {
  primary: '#FF9B57',
  primaryDark: '#E37B38',
  primaryLight: '#FFC08D',
  primarySoft: 'rgba(255, 155, 87, 0.18)',
  primarySoftAlt: 'rgba(255, 155, 87, 0.28)',
  accent: '#FFAE72',
  accentDark: '#F08A4B',
  accentLight: '#FFD0A9',
  accentSoft: 'rgba(255, 174, 114, 0.20)',
  background: '#312D29',
  surface: '#3B3631',
  surfaceAlt: '#45403A',
  surfaceElevated: '#504941',
  text: '#FFF7F0',
  textSecondary: '#E7D8C7',
  textTertiary: '#C0AE9B',
  border: '#5D544B',
  borderLight: '#70665C',
  divider: '#544C44',
  success: '#5AE0A9',
  successBg: 'rgba(90, 224, 169, 0.12)',
  successBorder: 'rgba(90, 224, 169, 0.28)',
  warning: '#FFC95C',
  warningBg: 'rgba(255, 201, 92, 0.12)',
  warningBorder: 'rgba(255, 201, 92, 0.30)',
  error: '#FF8A8A',
  errorBg: 'rgba(255, 138, 138, 0.12)',
  errorBorder: 'rgba(255, 138, 138, 0.28)',
  info: '#7AB8FF',
  infoBg: 'rgba(122, 184, 255, 0.12)',
  infoBorder: 'rgba(122, 184, 255, 0.28)',
  statusPendingBg: 'rgba(255, 201, 92, 0.14)',
  statusPendingText: '#FFD27D',
  statusProcessingBg: 'rgba(122, 184, 255, 0.14)',
  statusProcessingText: '#8EC5FF',
  statusShippedBg: 'rgba(155, 165, 255, 0.14)',
  statusShippedText: '#AAB2FF',
  statusDeliveredBg: 'rgba(90, 224, 169, 0.14)',
  statusDeliveredText: '#7DE7B8',
  statusCancelledBg: 'rgba(255, 138, 138, 0.14)',
  statusCancelledText: '#FFA3A3',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(20, 16, 13, 0.46)',
  cardShadow: 'rgba(12, 9, 7, 0.18)',
};

export const Colors = LightColors;
