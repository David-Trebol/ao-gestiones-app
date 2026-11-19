import { useEffect, useRef, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';

/**
 * Animaciones (solo web; en iOS/Android no hacen nada). Movimiento corto y suave, que acompaña lo que pasa:
 * - `enter(i)`: el bloque aparece subiendo un poco; con `i` se escalonan (listas, tarjetas, cifras).
 * - `useCountUp`: una cifra cuenta hasta su valor al abrir (total del pedido, contadores).
 * Si el sistema pide «reducir movimiento», WebGlobalStyles anula las animaciones y la cifra sale directa.
 */
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Nombres de las animaciones; los @keyframes están en WebGlobalStyles (react-native-web no inserta los suyos con estilos dinámicos) */
const NAMES = { rise: 'ao-rise', pop: 'ao-pop', fade: 'ao-fade', grow: 'ao-grow' } as const;

export const MOTION_KEYFRAMES_CSS = `
  @keyframes ao-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes ao-pop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
  @keyframes ao-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ao-grow { from { transform: scaleX(0); } to { transform: none; } }
`;

export function enter(i = 0, kind: keyof typeof NAMES = 'rise', opts: { step?: number; base?: number; duration?: number } = {}): ViewStyle {
  if (Platform.OS !== 'web') return {};
  const step = opts.step ?? 45;
  // a partir del elemento 12 no se retrasa más: una lista larga no debe tardar en verse
  const delay = (opts.base ?? 0) + Math.min(i, 12) * step;
  return {
    animationName: NAMES[kind],
    animationDuration: `${opts.duration ?? (kind === 'grow' ? 700 : 460)}ms`,
    animationTimingFunction: EASE,
    animationDelay: `${delay}ms`,
    animationFillMode: 'both',
    ...(kind === 'grow' ? { transformOrigin: 'left center' } : {}),
  } as unknown as ViewStyle;
}

function reducedMotion(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Cuenta desde 0 (o desde el valor anterior) hasta `value` en `ms`, con frenada al final */
export function useCountUp(value: number, ms = 800, delay = 120): number {
  const [shown, setShown] = useState(Platform.OS === 'web' && !reducedMotion() ? 0 : value);
  const from = useRef(shown);
  useEffect(() => {
    if (Platform.OS !== 'web' || reducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setShown(value);
      return;
    }
    const start = from.current;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, Math.max(0, (t - t0 - delay) / ms));
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (value - start) * eased;
      from.current = v;
      setShown(p >= 1 ? value : v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, delay]);
  return shown;
}
