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
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { Eye, EyeOff, Mail, Fingerprint, Package, Search, ScanLine } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { canvas, cardShadow, type, webInputReset } from '@/constants/theme';
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
  const { width } = useWindowDimensions();
  // Ordenador: panel de marca a la izquierda y formulario a la derecha; móvil: franja de marca arriba
  const split = width >= 960;

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

  // Lo que hace la app (solo funciones que existen)
  const features: { Icon: typeof Package; title: string; text: string }[] = [
    { Icon: Package, title: 'Pedidos y clientes', text: 'Cada pedido con su cliente, productos, importes y seguimiento.' },
    { Icon: Search, title: 'Encuentra cualquier pedido', text: 'Por referencia, cliente, email, NIF o producto, por año y por fabricante.' },
    { Icon: ScanLine, title: 'Lee tus documentos', text: 'Rellena un pedido desde un PDF o una foto, sin enviarlo a ningún servicio.' },
  ];

  const brandPanel = (
    <View style={[st.panel, { backgroundColor: colors.nav }, !split && st.panelTop]}>
      <View style={st.wordmarkRow}>
        <AppIcon size={split ? 44 : 38} />
        <View>
          <Text style={[st.wordmark, { color: colors.brand }]}>ALPHAΩMEGA</Text>
          <Text style={[st.wordmarkSub, { color: colors.navMuted }]}>ELECTRONICS</Text>
        </View>
      </View>
      {split ? (
        <View style={st.panelBody}>
          <Text style={[st.panelTitle, { color: colors.navText }]}>Libro de pedidos</Text>
          <Text style={[st.panelLead, { color: colors.navMuted }]}>La herramienta interna para llevar los pedidos de la empresa: lo que antes vivía en la hoja de Excel, ahora ordenado y a mano.</Text>
          <View style={st.featureList}>
            {features.map(({ Icon, title, text }) => (
              <View key={title} style={st.feature}>
                <View style={[st.featureIcon, { backgroundColor: colors.brand }]}>
                  <Icon size={18} color={colors.onPrimary} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.featureTitle, { color: colors.navText }]}>{title}</Text>
                  <Text style={[st.featureText, { color: colors.navMuted }]}>{text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={[st.panelLeadMobile, { color: colors.navMuted }]}>Libro de pedidos · uso interno</Text>
      )}
      {split && <Text style={[st.panelFoot, { color: colors.navMuted }]}>Alpha Omega Electronics · uso interno</Text>}
    </View>
  );

  return (
    <View style={[st.container, { backgroundColor: canvas(colors) }, split && { flexDirection: 'row' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {split && brandPanel}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[st.scroll, !split && st.scrollMobile]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!split && brandPanel}
          <Animated.View style={[st.column, !split && st.columnMobile, { transform: [{ translateX: shakeAnim }] }]}>
            <Animated.View style={[st.brand, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: logoScale }] }]}>
              <Text style={st.appName} accessibilityRole="header">{setupMode ? 'Crea tu cuenta' : 'Inicia sesión'}</Text>
              <Animated.Text style={[st.tagline, { opacity: taglineAnim }]}>
                {setupMode ? 'Crea la primera cuenta de administrador' : 'Entra con tu email y tu contraseña'}
              </Animated.Text>
            </Animated.View>

            <Animated.View style={[st.card, { backgroundColor: colors.surface }, cardShadow(isDark), { opacity: formFade, transform: [{ translateY: formSlide }] }]}>
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
                {loading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Text style={[st.primaryBtnText, { color: colors.onPrimary }]}>{setupMode ? 'Crear cuenta y entrar' : 'Entrar'}</Text>}
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
    scrollMobile: { justifyContent: 'flex-start', paddingHorizontal: 0, paddingTop: 0 },
    column: { width: '100%', maxWidth: 420 },
    columnMobile: { paddingHorizontal: 20, marginTop: 24 },
    brand: { alignItems: 'flex-start', marginBottom: 20, paddingHorizontal: 4 },
    appName: { ...type.largeTitle, color: c.text },
    tagline: { fontSize: 17, lineHeight: 22, color: c.textSecondary, marginTop: 4, letterSpacing: -0.2 },
    card: { borderRadius: 24, padding: 24, gap: 16, borderTopWidth: 4, borderTopColor: c.brand },
    // panel de marca
    panel: { width: '42%', maxWidth: 620, minWidth: 380, paddingHorizontal: 56, paddingVertical: 48, justifyContent: 'space-between' },
    panelTop: { width: '100%', maxWidth: undefined, minWidth: 0, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: 14 },
    wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: 1.2 },
    wordmarkSub: { fontSize: 12, fontWeight: '600', letterSpacing: 5, marginTop: -2 },
    panelBody: { gap: 18, marginVertical: 40 },
    panelTitle: { fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -1.4 },
    panelLead: { fontSize: 18, lineHeight: 27, maxWidth: 460 },
    panelLeadMobile: { fontSize: 15, letterSpacing: 0.2 },
    featureList: { gap: 20, marginTop: 12 },
    feature: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', maxWidth: 480 },
    featureIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    featureTitle: { fontSize: 17, fontWeight: '700' },
    featureText: { fontSize: 15, lineHeight: 21, marginTop: 2 },
    panelFoot: { fontSize: 13 },
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
