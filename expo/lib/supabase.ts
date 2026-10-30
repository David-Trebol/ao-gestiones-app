import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Proyecto Supabase "AO Gestiones".
 * La clave publicable es pública por diseño: la seguridad la ponen las políticas RLS
 * (solo usuarios con sesión iniciada pueden leer o escribir).
 * Se pueden sobrescribir con EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ixsosbtieclihoizmszq.supabase.co';
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_XDt9hPcoewsLq39A7RRgzA_c8p3-JLW';

const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // En web usa localStorage (por defecto); en iOS/Android, AsyncStorage
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/** Convierte un error de Supabase en un mensaje legible en español */
export function describeError(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  const msg = e?.message ?? String(error ?? 'Error desconocido');
  if (e?.code === '23505') return 'Ya existe un registro con esos datos (duplicado).';
  if (e?.code === '23503') return 'No se puede completar: hay datos relacionados que lo impiden.';
  if (/Failed to fetch|Network request failed|NetworkError/i.test(msg)) {
    return 'Sin conexión con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.';
  }
  if (/JWT|session|not authenticated|permission denied|row-level security/i.test(msg)) {
    return 'Tu sesión ha caducado o no tienes permiso. Vuelve a iniciar sesión.';
  }
  return msg;
}
