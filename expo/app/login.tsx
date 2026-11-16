import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { NATIVE_DRIVER } from '@/constants/animation';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Stack } from 'expo-router';
import { Eye, EyeOff, Mail, Fingerprint } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { canvas, liquidGlass, type, webInputReset } from '@/constants/theme';
import type { ThemeColors } from '@/constants/colors';
import { AppIcon } from '@/components/AppNav';
import * as Haptics from 'expo-haptics';

/**
 * Entrada con el mismo lenguaje que el resto de la app (estilo Apple): icono de la app,
 * una tarjeta de vidrio centrada sobre el fondo de color suave y campos agrupados como en iOS.
 */
export default function LoginScreen() {
  const { login, loginWithBiometric, requestPasswordReset, biometricEnabled, biometricAvailable, locked } = useAuth();
  const { colors, isDark } = useTheme();
  const st = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [info, setInfo] = useState<string>('');
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [setupMode, setSetupMode] = useState<boolean>(false);
  const [setupName, setSetupName] = useState<string>('');
  const [setupConfirm, setSetupConfirm] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(taglineAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.parallel([
        Animated.timing(formFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(formSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    ]).start();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- los valores animados son refs estables
  }, []);

  useEffect(() => {
    if (locked && biometricEnabled && biometricAvailable && Platform.OS !== 'web') {
      void handleBiometricLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, biometricEnabled, biometricAvailable]);

  // ¿Falta crear la primera cuenta de administrador?
  useEffect(() => {
    supabase.functions
      .invoke('setup-admin', { method: 'GET' })
      .then(({ data }) => setNeedsSetup(!!data?.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14, duration: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [shakeAnim]);

  const handleSetup = useCallback(async () => {
    setError('');
    if (!username.trim() || !setupName.trim()) {
      setError('Completa tu nombre y email');
      triggerShake();
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      triggerShake();
      return;
    }
    if (password !== setupConfirm) {
      setError('Las contraseñas no coinciden');
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('setup-admin', {
        body: { email: username.trim(), password, display_name: setupName.trim() },
      });
      let message = data?.error as string | undefined;
      if (fnError && !message) {
        try {
          const body = await (fnError as any).context?.json?.();
          message = body?.error;
        } catch {
          message = undefined;
        }
        message = message || 'No se pudo crear la cuenta';
      }
      if (message) {
        setError(message);
        triggerShake();
        return;
      }
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(result.error || 'Cuenta creada. Inicia sesión.');
        setSetupMode(false);
        setNeedsSetup(false);
      }
    } finally {
      setLoading(false);
    }
  }, [username, password, setupName, setupConfirm, login, triggerShake]);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setError('Introduce tu email y contraseña');
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(result.error || 'Error de autenticación');
        triggerShake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setError('Error inesperado. Inténtalo de nuevo.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }, [username, password, login, triggerShake]);

  const handleForgotPassword = useCallback(async () => {
    setError('');
    setInfo('');
    if (!username.trim()) {
      setError('Escribe tu email arriba y vuelve a pulsar "¿Olvidaste tu contraseña?"');
      triggerShake();
      return;
    }
    setResetLoading(true);
    const result = await requestPasswordReset(username.trim());
    setResetLoading(false);
    if (result.success) {
      setInfo(`Te hemos enviado un email a ${username.trim().toLowerCase()} para crear una nueva contraseña. Revisa también la carpeta de spam.`);
    } else {
      setError(result.error || 'No se pudo enviar el email');
      triggerShake();
    }
  }, [username, requestPasswordReset, triggerShake]);

  const handleBiometricLogin = useCallback(async () => {
    if (!biometricEnabled || !biometricAvailable || Platform.OS === 'web') return;
    setBiometricLoading(true);
    setError('');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await loginWithBiometric();
      if (!result.success && result.error !== 'Autenticación biométrica cancelada') {
        setError(result.error || 'Error biométrico');
      }
    } catch (e) {
      console.log('[Login] Biometric error:', e);
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricEnabled, biometricAvailable, loginWithBiometric]);

  const displayError = error;
  const showBiometricButton = biometricEnabled && biometricAvailable && Platform.OS !== 'web';
  const field = (name: string) => [st.inputWrap, focusedField === name && st.inputWrapFocused];

  return (
    <View style={[st.container, { backgroundColor: canvas(colors) }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={[st.column, { transform: [{ translateX: shakeAnim }] }]}>
            <Animated.View style={[st.brand, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: logoScale }] }]}>
              <AppIcon size={72} />
              <Text style={st.appName} accessibilityRole="header">AO Gestiones</Text>
              <Animated.Text style={[st.tagline, { opacity: taglineAnim }]}>
                {setupMode ? 'Crea la primera cuenta de administrador' : 'Inicia sesión para ver tus pedidos'}
              </Animated.Text>
            </Animated.View>

            <Animated.View style={[st.card, liquidGlass(colors, isDark, { strong: true }), { opacity: formFade, transform: [{ translateY: formSlide }] }]}>
              {displayError !== '' && (
                <View style={st.errorBanner} accessibilityLiveRegion="assertive">
                  <Text style={st.errorText}>{displayError}</Text>
                </View>
              )}

              {showBiometricButton && (
                <>
                  <Pressable
                    style={({ pressed }) => [st.secondaryBtn, pressed && { opacity: 0.8 }, biometricLoading && st.btnDisabled]}
                    onPress={handleBiometricLogin}
                    disabled={biometricLoading || loading}
                    testID="login-biometric"
                  >
                    {biometricLoading ? <ActivityIndicator color={colors.primary} size="small" /> : (
                      <>
                        <Fingerprint size={20} color={colors.primary} />
                        <Text style={st.secondaryBtnText}>Acceder con huella digital</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={st.or}>o</Text>
                </>
              )}

              {needsSetup && !setupMode && (
                <Pressable style={st.setupBanner} onPress={() => { setSetupMode(true); setError(''); setInfo(''); }} testID="login-setup-start" accessibilityRole="button">
                  <Text style={st.setupTitle}>Primera vez aquí</Text>
                  <Text style={st.setupText}>Crea tu cuenta de administrador y elige tu contraseña</Text>
                </Pressable>
              )}

              {setupMode && (
                <View style={st.field}>
                  <Text style={st.label}>Tu nombre</Text>
                  <View style={field('name')}>
                    <TextInput
                      style={st.input}
                      value={setupName}
                      onChangeText={(t) => { setSetupName(t); setError(''); }}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Nombre y apellidos"
                      placeholderTextColor={colors.textTertiary}
                      accessibilityLabel="Tu nombre"
                      testID="setup-name"
                    />
                  </View>
                </View>
              )}

              <View style={st.field}>
                <Text style={st.label}>Email</Text>
                <View style={field('username')}>
                  <TextInput
                    style={st.input}
                    value={username}
                    onChangeText={(text) => { setUsername(text); setError(''); }}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="tu@email.com"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="username"
                    returnKeyType="next"
                    accessibilityLabel="Email"
                    testID="login-username"
                  />
                </View>
              </View>

              <View style={st.field}>
                <Text style={st.label}>Contraseña</Text>
                <View style={[...field('password'), st.passwordWrap]}>
                  <TextInput
                    style={[st.input, { flex: 1 }]}
                    value={password}
                    onChangeText={(text) => { setPassword(text); setError(''); }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Tu contraseña"
                    autoComplete={setupMode ? 'new-password' : 'current-password'}
                    textContentType="password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={setupMode ? undefined : handleLogin}
                    accessibilityLabel="Contraseña"
                    testID="login-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword(p => !p)}
                    style={st.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
                  </Pressable>
                </View>
              </View>

              {setupMode && (
                <View style={st.field}>
                  <Text style={st.label}>Repite la contraseña</Text>
                  <View style={field('confirm')}>
                    <TextInput
                      style={st.input}
                      value={setupConfirm}
                      onChangeText={(t) => { setSetupConfirm(t); setError(''); }}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Repite la contraseña"
                      placeholderTextColor={colors.textTertiary}
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      onSubmitEditing={handleSetup}
                      accessibilityLabel="Repite la contraseña"
                      testID="setup-confirm"
                    />
                  </View>
                </View>
              )}

              <Pressable
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  st.primaryBtn,
                  { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: pressed ? 0.85 : 1 },
                  loading && st.btnDisabled,
                ]}
                onPress={setupMode ? handleSetup : handleLogin}
                disabled={loading}
                accessibilityRole="button"
                testID="login-submit"
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.primaryBtnText}>{setupMode ? 'Crear cuenta y entrar' : 'Entrar'}</Text>}
              </Pressable>

              {info !== '' && (
                <View style={st.infoBanner}>
                  <Text style={st.infoText}>{info}</Text>
                </View>
              )}

              {setupMode ? (
                <Pressable style={st.linkBtn} onPress={() => { setSetupMode(false); setError(''); }} accessibilityRole="button">
                  <Text style={st.linkText}>Ya tengo cuenta: iniciar sesión</Text>
                </Pressable>
              ) : (
                <Pressable style={st.linkBtn} onPress={handleForgotPassword} disabled={resetLoading} accessibilityRole="button" testID="login-forgot">
                  {resetLoading ? <ActivityIndicator color={colors.primary} size="small" /> : <Mail size={15} color={colors.primary} />}
                  <Text style={st.linkText}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              )}
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(c: ThemeColors, isDark: boolean) {
  const web = Platform.OS === 'web';
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },
    column: { width: '100%', maxWidth: 400 },
    brand: { alignItems: 'center', marginBottom: 28 },
    appName: { ...type.largeTitle, color: c.text, marginTop: 18, textAlign: 'center' },
    tagline: { fontSize: 17, lineHeight: 22, color: c.textSecondary, marginTop: 4, textAlign: 'center', letterSpacing: -0.2 },
    card: { borderRadius: 24, padding: 24, gap: 16, ...(web ? {} : { backgroundColor: c.surface }) },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSecondary, paddingHorizontal: 4 },
    inputWrap: { minHeight: 48, borderRadius: 12, backgroundColor: c.fill, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center' },
    inputWrapFocused: { borderColor: c.primary, backgroundColor: isDark ? 'rgba(118,118,128,0.18)' : '#FFFFFF' },
    passwordWrap: { flexDirection: 'row', alignItems: 'center' },
    input: { height: 44, paddingHorizontal: 14, fontSize: 17, color: c.text, letterSpacing: -0.2, ...webInputReset },
    eyeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    primaryBtn: {
      minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4,
      ...(web ? ({ cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.18)' } as ViewStyle) : {}),
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
    btnDisabled: { opacity: 0.55 },
    secondaryBtn: { minHeight: 48, borderRadius: 999, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill },
    secondaryBtnText: { fontSize: 16, fontWeight: '600', color: c.primary },
    or: { textAlign: 'center', fontSize: 13, color: c.textSecondary },
    linkBtn: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    linkText: { fontSize: 15, color: c.primary, fontWeight: '500' },
    errorBanner: { backgroundColor: c.errorBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    errorText: { color: c.error, fontSize: 14, fontWeight: '500', lineHeight: 19 },
    infoBanner: { backgroundColor: c.successBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    infoText: { color: c.success, fontSize: 14, lineHeight: 19 },
    setupBanner: { backgroundColor: c.primarySoft, borderRadius: 12, padding: 14, gap: 2 },
    setupTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    setupText: { fontSize: 14, color: c.primary },
  });
}
