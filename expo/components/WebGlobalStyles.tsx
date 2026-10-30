import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FONT_FAMILY } from '@/constants/theme';

/**
 * Ajustes globales solo para web: fuente del sistema con suavizado,
 * color de fondo y de selección según el tema, foco visible accesible y
 * desactivación de movimiento si el usuario lo pide.
 */
export default function WebGlobalStyles() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'ao-global-styles';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `
      :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
      html, body { background-color: ${colors.background}; }
      body, input, textarea, button, [dir] { font-family: ${FONT_FAMILY}; }
      body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
      ::selection { background: ${colors.primarySoftAlt}; }
      input::placeholder, textarea::placeholder { color: ${colors.textTertiary}; opacity: 1; }
      input:focus, textarea:focus { outline: none; }
      input:focus-visible, textarea:focus-visible { outline: none; }
      [role="button"]:focus-visible, [role="link"]:focus-visible, button:focus-visible, [tabindex]:not(input):not(textarea):focus-visible {
        outline: 2px solid ${colors.primary}; outline-offset: 2px; border-radius: 10px;
      }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}; border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
      ::-webkit-scrollbar-track { background: transparent; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
      }
    `;
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) meta.content = colors.background;
    else {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = colors.background;
      document.head.appendChild(m);
    }
  }, [colors, isDark]);

  return null;
}
