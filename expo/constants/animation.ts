import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

/** En web no existe el driver nativo de animaciones: usarlo solo en iOS/Android evita avisos */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** Tokens de movimiento (cortos y con desaceleración, estilo Apple) */
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  easeIn: Easing.bezier(0.7, 0, 0.84, 0),
  easeInOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

/** Entrada estándar: aparece y sube 12 px. Escalonado de 50 ms por elemento (máx. 8). */
export function enterAnimation(opacity: Animated.Value, translateY: Animated.Value, index = 0) {
  return Animated.parallel([
    Animated.timing(opacity, { toValue: 1, duration: motion.slow, delay: Math.min(index, 8) * 50, easing: motion.easeOut, useNativeDriver: NATIVE_DRIVER }),
    Animated.timing(translateY, { toValue: 0, duration: motion.slow, delay: Math.min(index, 8) * 50, easing: motion.easeOut, useNativeDriver: NATIVE_DRIVER }),
  ]);
}

/**
 * Accesibilidad: si el sistema pide "reducir movimiento", todas las animaciones
 * terminan al instante (las pantallas siguen funcionando igual, sin desplazamientos).
 */
let reduceMotion = false;
export function isReduceMotion() {
  return reduceMotion;
}

function applyReducedMotion() {
  const A = Animated as unknown as Record<string, any>;
  if (A.__aoReducedPatched) return;
  A.__aoReducedPatched = true;
  const timing = Animated.timing;
  const spring = Animated.spring;
  const loop = Animated.loop;
  A.timing = (value: Animated.Value, config: Animated.TimingAnimationConfig) =>
    reduceMotion ? timing(value, { ...config, duration: 0, delay: 0 }) : timing(value, config);
  // Estilo Apple: sin rebotes. Todos los "spring" heredados se convierten en una desaceleración corta.
  A.spring = (value: Animated.Value, config: Animated.SpringAnimationConfig) =>
    timing(value, {
      toValue: config.toValue as number,
      duration: reduceMotion ? 0 : 300,
      delay: reduceMotion ? 0 : config.delay ?? 0,
      easing: motion.easeOut,
      useNativeDriver: config.useNativeDriver,
    });
  void spring;
  A.loop = (animation: Animated.CompositeAnimation, config?: Animated.LoopAnimationConfig) =>
    reduceMotion ? { start: () => {}, stop: () => {}, reset: () => {} } : loop(animation, config);
}

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotion = mq.matches;
  mq.addEventListener?.('change', e => {
    reduceMotion = e.matches;
  });
  applyReducedMotion();
} else if (Platform.OS !== 'web') {
  applyReducedMotion();
  AccessibilityInfo.isReduceMotionEnabled()
    .then(v => {
      reduceMotion = v;
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => {
    reduceMotion = v;
  });
}
