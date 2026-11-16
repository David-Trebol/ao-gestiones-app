import { Platform } from 'react-native';
import type { ThemeColors } from '@/constants/colors';
import { FONT_FAMILY, canvas, glass } from '@/constants/theme';

/** Cabecera estilo Apple: fondo claro/neutro, título oscuro centrado, acento en botones y flecha de volver */
export function headerOptions(colors: ThemeColors) {
  return {
    headerStyle: { backgroundColor: colors.headerBackground, ...(Platform.OS === 'web' ? (glass(colors.headerBackground) as object) : {}) },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontWeight: '600' as const,
      fontSize: 17,
      color: colors.text,
      ...(FONT_FAMILY ? { fontFamily: FONT_FAMILY } : {}),
    },
    headerTitleAlign: 'center' as const,
    headerShadowVisible: true,
    headerBackTitle: 'Atrás',
    ...(Platform.OS === 'ios' ? { headerBlurEffect: 'systemChromeMaterial' as const } : {}),
    contentStyle: { backgroundColor: canvas(colors) },
  };
}
