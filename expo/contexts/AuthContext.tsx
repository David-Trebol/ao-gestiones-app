import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Platform, Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase, describeError } from '@/lib/supabase';

/**
 * Autenticación con Supabase Auth (email + contraseña).
 * - Las contraseñas las guarda Supabase cifradas; la app nunca las almacena.
 * - El perfil (nombre, rol, activo) está en la tabla public.profiles.
 * - La gestión de usuarios (crear/editar/borrar) pasa por la función segura "admin-users".
 * - En móvil, la biometría funciona como bloqueo de la app sobre una sesión ya iniciada.
 */

export interface AppUser {
  id: string;
  /** Email con el que inicia sesión */
  username: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
}

type Result = { success: boolean; error?: string };

const BIOMETRIC_KEY = '@ao_biometric_enabled';

function mapProfile(row: any): AppUser {
  return {
    id: row.id,
    username: row.email ?? '',
    email: row.email ?? '',
    displayName: row.display_name || (row.email ?? '').split('@')[0],
    role: row.role === 'admin' ? 'admin' : 'user',
    active: !!row.active,
    created_at: row.created_at,
  };
}

async function callAdminUsers(payload: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if (error) {
    // Intenta leer el mensaje devuelto por la función
    let message = describeError(error);
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // se queda con el mensaje genérico
    }
    return { success: false, error: message };
  }
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [locked, setLocked] = useState(false);

  // Sesión inicial + cambios de sesión
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (Platform.OS !== 'web' && data.session) {
        const bio = await AsyncStorage.getItem(BIOMETRIC_KEY);
        if (bio === 'true') setLocked(true);
      }
      setSessionLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        queryClient.clear();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Biometría (solo iOS/Android)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const LocalAuth = await import('expo-local-authentication');
        const hasHardware = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        setBiometricAvailable(hasHardware && enrolled);
        setBiometricEnabled((await AsyncStorage.getItem(BIOMETRIC_KEY)) === 'true');
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  const userId = session?.user?.id ?? null;

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle();
      if (error) throw new Error(describeError(error));
      return data ? mapProfile(data) : null;
    },
  });

  const currentUser = profileQuery.data ?? null;
  const isAdmin = currentUser?.role === 'admin' && currentUser.active;

  const usersQuery = useQuery({
    queryKey: ['users'],
    enabled: !!userId && !!currentUser?.active,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (error) throw new Error(describeError(error));
      return (data ?? []).map(mapProfile);
    },
  });

  // Una cuenta desactivada no entra en la app
  const accountInactive = !!session && profileQuery.isFetched && (!currentUser || !currentUser.active);
  useEffect(() => {
    if (accountInactive && !passwordRecovery) {
      void supabase.auth.signOut();
    }
  }, [accountInactive, passwordRecovery]);

  const isAuthenticated = !!session && !!currentUser?.active && !locked && !passwordRecovery;
  const authLoading = sessionLoading || (!!session && profileQuery.isLoading);

  const login = useCallback(async (email: string, password: string): Promise<Result> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return { success: false, error: 'Introduce email y contraseña' };
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) return { success: false, error: 'Email o contraseña incorrectos' };
      if (/banned/i.test(error.message)) return { success: false, error: 'Esta cuenta está desactivada' };
      if (/email not confirmed/i.test(error.message)) return { success: false, error: 'Confirma tu email antes de entrar' };
      return { success: false, error: describeError(error) };
    }
    const { data: profile } = await supabase.from('profiles').select('active').eq('id', data.user.id).maybeSingle();
    if (!profile?.active) {
      await supabase.auth.signOut();
      return { success: false, error: 'Esta cuenta está desactivada. Pide acceso a un administrador.' };
    }
    setLocked(false);
    return { success: true };
  }, []);

  /** Envía el email para crear/restablecer la contraseña */
  const requestPasswordReset = useCallback(async (email: string): Promise<Result> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: 'Escribe tu email' };
    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    if (error) {
      if (/rate limit|security purposes/i.test(error.message)) {
        return { success: false, error: 'Has pedido demasiados correos seguidos. Espera unos minutos.' };
      }
      return { success: false, error: describeError(error) };
    }
    return { success: true };
  }, []);

  /** Cambia la contraseña del usuario con sesión (o tras abrir el enlace de recuperación) */
  const updatePassword = useCallback(async (newPassword: string): Promise<Result> => {
    if (newPassword.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (/different from the old/i.test(error.message)) return { success: false, error: 'La nueva contraseña debe ser distinta de la anterior' };
      return { success: false, error: describeError(error) };
    }
    setPasswordRecovery(false);
    return { success: true };
  }, []);

  const loginWithBiometric = useCallback(async (): Promise<Result> => {
    if (Platform.OS === 'web') return { success: false, error: 'Biometría no disponible en web' };
    if (!biometricAvailable || !biometricEnabled) return { success: false, error: 'Autenticación biométrica no configurada' };
    if (!session) return { success: false, error: 'Inicia sesión con tu email la primera vez' };
    try {
      const LocalAuth = await import('expo-local-authentication');
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Accede a Flow',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar contraseña',
        disableDeviceFallback: false,
      });
      if (!result.success) return { success: false, error: 'Autenticación biométrica cancelada' };
      setLocked(false);
      return { success: true };
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }, [biometricAvailable, biometricEnabled, session]);

  const toggleBiometric = useCallback(async () => {
    if (Platform.OS === 'web') return false;
    if (!biometricAvailable) {
      Alert.alert('No disponible', 'Tu dispositivo no tiene autenticación biométrica configurada.');
      return false;
    }
    const newValue = !biometricEnabled;
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(newValue));
    setBiometricEnabled(newValue);
    return newValue;
  }, [biometricAvailable, biometricEnabled]);

  const logout = useCallback(async () => {
    setLocked(false);
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  // ---------- Gestión de usuarios (solo admin) ----------

  const refreshUsers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['users'] });
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
  }, [queryClient]);

  const addUser = useCallback(async (email: string, password: string, displayName: string, role: 'admin' | 'user'): Promise<Result> => {
    const r = await callAdminUsers({ action: 'create', email, password, display_name: displayName, role });
    if (r.success) await refreshUsers();
    return r;
  }, [refreshUsers]);

  const updateUser = useCallback(async (
    id: string,
    updates: { email?: string; password?: string; displayName?: string; role?: 'admin' | 'user'; active?: boolean },
  ): Promise<Result> => {
    const r = await callAdminUsers({
      action: 'update',
      id,
      email: updates.email,
      password: updates.password || undefined,
      display_name: updates.displayName,
      role: updates.role,
      active: updates.active,
    });
    if (r.success) await refreshUsers();
    return r;
  }, [refreshUsers]);

  const deleteUser = useCallback(async (id: string): Promise<Result> => {
    const r = await callAdminUsers({ action: 'delete', id });
    if (r.success) await refreshUsers();
    return r;
  }, [refreshUsers]);

  /** Cambia el propio nombre visible (cualquier usuario) */
  const updateOwnDisplayName = useCallback(async (displayName: string): Promise<Result> => {
    if (!userId) return { success: false, error: 'No hay sesión' };
    const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', userId);
    if (error) return { success: false, error: describeError(error) };
    await refreshUsers();
    return { success: true };
  }, [userId, refreshUsers]);

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  return {
    session,
    currentUser,
    users,
    isAdmin,
    isAuthenticated,
    authLoading,
    locked,
    passwordRecovery,
    login,
    requestPasswordReset,
    updatePassword,
    loginWithBiometric,
    biometricEnabled,
    biometricAvailable,
    toggleBiometric,
    logout,
    addUser,
    updateUser,
    deleteUser,
    updateOwnDisplayName,
  };
});
