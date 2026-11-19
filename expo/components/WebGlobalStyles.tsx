import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FONT_FAMILY } from '@/constants/theme';
import { MOTION_KEYFRAMES_CSS } from '@/constants/motion';

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
      html { background-color: ${colors.background}; }
      body { background-color: transparent; }
      /* Brillo de color en una capa fija propia: «background-attachment: fixed» hace que Safari de iOS repinte sin parar */
      body { min-height: 100vh; }
      body::before { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; background-image: ${colors.ambient}; background-repeat: no-repeat; }
      body, input, textarea, button, [dir] { font-family: ${FONT_FAMILY}; }
      body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
      ::selection { background: ${colors.primarySoftAlt}; }
      input::placeholder, textarea::placeholder { color: ${colors.textTertiary}; opacity: 1; }
      input:focus, textarea:focus { outline: none; }
      input:focus-visible, textarea:focus-visible { outline: none; }
      [role="button"]:focus-visible, [role="link"]:focus-visible, button:focus-visible, [tabindex]:not(input):not(textarea):focus-visible {
        outline: 2px solid ${colors.primary}; outline-offset: 2px; border-radius: 10px;
      }
      ${MOTION_KEYFRAMES_CSS}
      /* Respuesta al pulsar: los botones se hunden un poco; filas y tarjetas apenas */
      [role="button"], [role="link"], [role="tab"] { transition: transform .18s cubic-bezier(.2,.8,.2,1), background-color .18s ease, box-shadow .2s ease, opacity .18s ease; }
      [role="button"]:active, [role="tab"]:active { transform: scale(0.96); }
      [role="link"]:active { transform: scale(0.992); }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}; border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
      ::-webkit-scrollbar-track { background: transparent; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
      }
    `;
    // Figtree, la tipografía de alphaomega-electronics.com
    if (!document.getElementById('ao-font-figtree')) {
      const pre = document.createElement('link');
      pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = 'anonymous';
      document.head.appendChild(pre);
      const link = document.createElement('link');
      link.id = 'ao-font-figtree';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400..800&display=swap';
      document.head.appendChild(link);
    }
    // Idioma de la página (lectores de pantalla y formato de fechas del navegador)
    document.documentElement.lang = 'es';
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
