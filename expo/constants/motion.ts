import { useEffect, useRef, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';

/**
 * Animaciones (solo web; en iOS/Android no hacen nada). Marcadas pero cortas (menos de 1 s), siempre ligadas a algo que pasa:
 * - `enter(i)`: el bloque aparece subiendo un poco; con `i` se escalonan (listas, tarjetas, cifras).
 * - `useCountUp`: una cifra cuenta hasta su valor al abrir (total del pedido, contadores).
 * Si el sistema pide «reducir movimiento», WebGlobalStyles anula las animaciones y la cifra sale directa.
 */
/** Frenada larga (tipo «expo out»): arranca rápido y se posa suave, como las apps nativas */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Con un pequeño rebote al final: para lo que «aparece» (tarjeta principal, chapas de estado) */
const EASE_BACK = 'cubic-bezier(0.34, 1.4, 0.64, 1)';

/** Nombres de las animaciones; los @keyframes están en WebGlobalStyles (react-native-web no inserta los suyos con estilos dinámicos) */
const NAMES = { rise: 'ao-rise', pop: 'ao-pop', fade: 'ao-fade', grow: 'ao-grow', slide: 'ao-slide', bump: 'ao-bump' } as const;
type Kind = keyof typeof NAMES;

const DURATION: Record<Kind, number> = { rise: 720, pop: 680, fade: 420, grow: 1000, slide: 620, bump: 460 };

export const MOTION_KEYFRAMES_CSS = `
  @keyframes ao-rise { from { opacity: 0; transform: translateY(28px) scale(0.985); filter: blur(5px); } to { opacity: 1; transform: none; filter: none; } }
  @keyframes ao-pop { 0% { opacity: 0; transform: translateY(18px) scale(0.93); filter: blur(4px); } 60% { opacity: 1; filter: none; } 100% { opacity: 1; transform: none; filter: none; } }
  @keyframes ao-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ao-grow { from { transform: scaleX(0); } to { transform: none; } }
  @keyframes ao-slide { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: none; } }
  @keyframes ao-bump { 0% { transform: scale(0.86); } 55% { transform: scale(1.08); } 100% { transform: none; } }
  @keyframes ao-sheen { 0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateX(420%) skewX(-18deg); opacity: 0; } }
  @keyframes ao-pulse { 0% { box-shadow: 0 0 0 0 var(--ao-pulse, rgba(255,135,24,0.55)); } 100% { box-shadow: 0 0 0 12px rgba(0,0,0,0); } }
  @keyframes ao-tab-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  /* Levantar al pasar el ratón (solo con ratón; en el móvil no se queda «enganchado») */
  [data-lift] { transition: transform .4s ${EASE}, box-shadow .4s ease, background-color .3s ease; }
  @media (hover: hover) {
    [data-lift]:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0, 42, 57, 0.14), inset 0 1px 0 rgba(255,255,255,0.6) !important; }
    [data-hl]:hover { background-color: rgba(255, 135, 24, 0.07) !important; }
  }
  /* Cambios de color suaves (estado de un producto, del pedido…) */
  [data-tint] { transition: background-color .45s ease, border-color .45s ease, color .45s ease; }
`;

/**
 * Animación de entrada. Con \`i\` se escalonan (listas, tarjetas, cifras).
 * Usa «backwards»: al terminar deja de aplicarse, para que el efecto de levantar al pasar el ratón funcione.
 */
export function enter(i = 0, kind: Kind = 'rise', opts: { step?: number; base?: number; duration?: number } = {}): ViewStyle {
  if (Platform.OS !== 'web') return {};
  const step = opts.step ?? 55;
  // a partir del elemento 12 no se retrasa más: una lista larga no debe tardar en verse
  const delay = (opts.base ?? 0) + Math.min(i, 12) * step;
  return {
    animationName: NAMES[kind],
    animationDuration: `${opts.duration ?? DURATION[kind]}ms`,
    animationTimingFunction: kind === 'pop' || kind === 'bump' ? EASE_BACK : EASE,
    animationDelay: `${delay}ms`,
    animationFillMode: 'backwards',
    ...(kind === 'grow' ? { transformOrigin: 'left center' } : {}),
  } as unknown as ViewStyle;
}

/** Destello que cruza una vez la tarjeta principal al abrirla (va en una capa absoluta dentro de ella) */
export function sheen(delay = 450): ViewStyle {
  if (Platform.OS !== 'web') return { display: 'none' };
  return {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: '32%',
    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0) 100%)',
    animationName: 'ao-sheen', animationDuration: '1500ms', animationDelay: `${delay}ms`, animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)', animationFillMode: 'both',
    pointerEvents: 'none',
  } as unknown as ViewStyle;
}

/** Anillo que late (3 veces) alrededor del paso actual o de lo que acaba de cambiar */
export function pulse(color: string, iterations = 3): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return { ['--ao-pulse' as never]: color, animationName: 'ao-pulse', animationDuration: '1600ms', animationIterationCount: iterations, animationDelay: '700ms', animationTimingFunction: 'ease-out' } as unknown as ViewStyle;
}

/** Atributos web para efectos de CSS: `lift` (levantar con el ratón), `hl` (resaltar fila), `tint` (transición de color) */
export function fx(...names: ('lift' | 'hl' | 'tint')[]): object {
  if (Platform.OS !== 'web') return {};
  return { dataSet: Object.fromEntries(names.map(n => [n, '1'])) };
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
