import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { Eye, EyeOff, ArrowRight, Mail, Zap, Package, TrendingUp, Users, Fingerprint } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { webInputReset } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const ACCENT = '#E5641C';
const ACCENT_DARK = '#C2410C';
const BG_DARK = '#000000';
const BG_CARD = 'rgba(28, 28, 30, 0.72)';
const BG_INPUT = 'rgba(118, 118, 128, 0.18)';
const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.10)';
const TEXT_DIM = '#8D8D93';
const TEXT_MUTED = '#A1A1A6';
const GLOW_COLOR = 'rgba(229, 100, 28, 0.15)';

export default function LoginScreen() {
  const { login, loginWithBiometric, requestPasswordReset, biometricEnabled, biometricAvailable, locked } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isLargeDesktop = width >= 1200;

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
  const glowAnim = useRef(new Animated.Value(0)).current;
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

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ])
    ).start();
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

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const showBiometricButton = biometricEnabled && biometricAvailable && Platform.OS !== 'web';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.bgPattern}>
        <Animated.View style={[styles.glowOrb, styles.glowOrb1, { opacity: glowOpacity }]} />
        <Animated.View style={[styles.glowOrb, styles.glowOrb2, { opacity: glowAnim }]} />
      </View>

      {isLargeDesktop && (
        <View style={styles.desktopSidebar}>
          <View style={styles.sidebarContent}>
            <View style={styles.sidebarBrandRow}>
              <View style={styles.sidebarLogoBadge}>
                <Zap size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.sidebarBrandName}>AO Gestiones</Text>
                <Text style={styles.sidebarBrandTag}>Pedidos en movimiento</Text>
              </View>
            </View>

            <Text style={styles.sidebarHeadline}>
              Controla cada{'\n'}pedido en{'\n'}
              <Text style={styles.sidebarHeadlineAccent}>tiempo real</Text>
            </Text>

            <View style={styles.sidebarCards}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(229,100,28,0.15)' }]}>
                  <Package size={18} color={ACCENT} />
                </View>
                <View>
                  <Text style={styles.statValue}>Pedidos</Text>
                  <Text style={styles.statLabel}>Gestión completa</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                  <TrendingUp size={18} color="#34D399" />
                </View>
                <View>
                  <Text style={styles.statValue}>Análisis</Text>
                  <Text style={styles.statLabel}>Métricas en vivo</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                  <Users size={18} color="#60A5FA" />
                </View>
                <View>
                  <Text style={styles.statValue}>Equipo</Text>
                  <Text style={styles.statLabel}>Multi-usuario</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sidebarVersion}>AO Gestiones · Libro de pedidos</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.formSide, isLargeDesktop && styles.formSideDesktop]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.content,
              isDesktop && !isLargeDesktop && styles.contentDesktop,
              {
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            {!isLargeDesktop && (
              <Animated.View
                style={[
                  styles.logoSection,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: logoScale },
                    ],
                  },
                ]}
              >
                <View style={styles.logoContainer}>
                  <View style={styles.logoBadge}>
                    <Zap size={28} color="#fff" />
                  </View>
                  <View style={styles.logoGlowRing} />
                </View>
                <Text style={styles.appName}>AO Gestiones</Text>
                <Animated.View style={{ opacity: taglineAnim }}>
                  <Text style={styles.appTagline}>Pedidos en movimiento</Text>
                </Animated.View>
              </Animated.View>
            )}

            <Animated.View
              style={[
                styles.formCard,
                {
                  opacity: formFade,
                  transform: [{ translateY: formSlide }],
                },
              ]}
            >
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{setupMode ? 'Crea tu cuenta' : 'Bienvenido'}</Text>
                <Text style={styles.formSubtitle}>{setupMode ? 'Primera cuenta de administrador de AO Gestiones' : 'Inicia sesión para continuar'}</Text>
              </View>

              {displayError !== '' && (
                <View style={styles.errorBanner}>
                  <View style={styles.errorDot} />
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              )}

              {showBiometricButton && (
                <Pressable
                  style={({ pressed }) => [
                    styles.biometricBtn,
                    pressed && styles.biometricBtnPressed,
                    biometricLoading && styles.btnDisabled,
                  ]}
                  onPress={handleBiometricLogin}
                  disabled={biometricLoading || loading}
                  testID="login-biometric"
                >
                  {biometricLoading ? (
                    <ActivityIndicator color={ACCENT} size="small" />
                  ) : (
                    <>
                      <View style={styles.biometricIconCircle}>
                        <Fingerprint size={22} color={ACCENT} />
                      </View>
                      <Text style={styles.biometricBtnText}>Acceder con huella digital</Text>
                    </>
                  )}
                </Pressable>
              )}

              {showBiometricButton && (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>o</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              {needsSetup && !setupMode && (
                <Pressable style={styles.setupBanner} onPress={() => { setSetupMode(true); setError(''); setInfo(''); }} testID="login-setup-start">
                  <Text style={styles.setupBannerTitle}>Primera vez aquí</Text>
                  <Text style={styles.setupBannerText}>Crea tu cuenta de administrador y elige tu contraseña →</Text>
                </Pressable>
              )}

              {setupMode && (
                <View style={styles.field}>
                  <Text style={styles.label}>Tu nombre</Text>
                  <View style={[styles.inputWrap, focusedField === 'name' && styles.inputWrapFocused]}>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
                      value={setupName}
                      onChangeText={(t) => { setSetupName(t); setError(''); }}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Nombre y apellidos"
                      placeholderTextColor={TEXT_DIM}
                      testID="setup-name"
                    />
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === 'username' && styles.inputWrapFocused,
                  ]}
                >
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
                    value={username}
                    onChangeText={(text) => { setUsername(text); setError(''); }}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="tu@email.com"
                    placeholderTextColor={TEXT_DIM}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="username"
                    returnKeyType="next"
                    testID="login-username"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Contraseña</Text>
                <View
                  style={[
                    styles.inputWrap,
                    styles.passwordWrap,
                    focusedField === 'password' && styles.inputWrapFocused,
                  ]}
                >
                  <TextInput
                    style={[styles.passwordInput, Platform.OS === 'web' && styles.inputWeb]}
                    value={password}
                    onChangeText={(text) => { setPassword(text); setError(''); }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Tu contraseña"
                    autoComplete={setupMode ? 'new-password' : 'current-password'}
                    textContentType="password"
                    placeholderTextColor={TEXT_DIM}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={setupMode ? undefined : handleLogin}
                    testID="login-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword(p => !p)}
                    style={styles.eyeBtn}
                    hitSlop={10}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={TEXT_DIM} />
                    ) : (
                      <Eye size={16} color={TEXT_DIM} />
                    )}
                  </Pressable>
                </View>
              </View>

              {setupMode && (
                <View style={styles.field}>
                  <Text style={styles.label}>Repite la contraseña</Text>
                  <View style={[styles.inputWrap, focusedField === 'confirm' && styles.inputWrapFocused]}>
                    <TextInput
                      style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
                      value={setupConfirm}
                      onChangeText={(t) => { setSetupConfirm(t); setError(''); }}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Repite la contraseña"
                      placeholderTextColor={TEXT_DIM}
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      onSubmitEditing={handleSetup}
                      testID="setup-confirm"
                    />
                  </View>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.loginBtn,
                  pressed && styles.loginBtnPressed,
                  loading && styles.btnDisabled,
                ]}
                onPress={setupMode ? handleSetup : handleLogin}
                disabled={loading}
                testID="login-submit"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>{setupMode ? 'Crear cuenta y entrar' : 'Entrar'}</Text>
                    <ArrowRight size={18} color="#fff" />
                  </>
                )}
              </Pressable>

              {info !== '' && (
                <View style={styles.infoBanner}>
                  <Text style={styles.infoText}>{info}</Text>
                </View>
              )}

              {setupMode ? (
                <Pressable style={styles.hintToggle} onPress={() => { setSetupMode(false); setError(''); }}>
                  <Text style={styles.hintToggleText}>Ya tengo cuenta: iniciar sesión</Text>
                </Pressable>
              ) : (
              <Pressable
                style={styles.hintToggle}
                onPress={handleForgotPassword}
                disabled={resetLoading}
                testID="login-forgot"
              >
                {resetLoading ? <ActivityIndicator color={TEXT_MUTED} size="small" /> : <Mail size={12} color={TEXT_DIM} />}
                <Text style={styles.hintToggleText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
              )}
            </Animated.View>

            <Text style={styles.versionText}>AO Gestiones</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  setupBanner: {
    borderWidth: 1,
    borderColor: 'rgba(229, 100, 28, 0.45)',
    backgroundColor: 'rgba(229, 100, 28, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  setupBannerTitle: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  setupBannerText: { color: '#FFB4A6', fontSize: 13 },
  infoBanner: {
    backgroundColor: 'rgba(46, 160, 67, 0.12)',
    borderColor: 'rgba(46, 160, 67, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  infoText: {
    color: '#7EE2A0',
    fontSize: 13,
    lineHeight: 18,
  },
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
    flexDirection: 'row' as const,
  },
  bgPattern: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden' as const,
  },
  glowOrb: {
    position: 'absolute' as const,
    borderRadius: 999,
  },
  glowOrb1: {
    width: 300,
    height: 300,
    backgroundColor: GLOW_COLOR,
    top: -80,
    right: -60,
  },
  glowOrb2: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(96,165,250,0.08)',
    bottom: 60,
    left: -40,
  },
  desktopSidebar: {
    width: '42%' as any,
    backgroundColor: '#08080D',
    justifyContent: 'center' as const,
    paddingHorizontal: 60,
    borderRightWidth: 1,
    borderRightColor: BORDER_SUBTLE,
  },
  sidebarContent: {
    maxWidth: 420,
  },
  sidebarBrandRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginBottom: 48,
  },
  sidebarLogoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sidebarBrandName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  sidebarBrandTag: {
    fontSize: 12,
    color: TEXT_DIM,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  sidebarHeadline: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: '#fff',
    lineHeight: 50,
    letterSpacing: -1.5,
    marginBottom: 48,
  },
  sidebarHeadlineAccent: {
    color: ACCENT,
  },
  sidebarCards: {
    gap: 14,
    marginBottom: 48,
  },
  statCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: TEXT_DIM,
    marginTop: 1,
  },
  sidebarVersion: {
    fontSize: 12,
    color: '#333340',
  },
  formSide: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  formSideDesktop: {
    backgroundColor: '#0D0D14',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 50,
  },
  content: {
    width: '100%' as any,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    maxWidth: 400,
  },
  contentDesktop: {
    maxWidth: 380,
  },
  logoSection: {
    alignItems: 'center' as const,
    marginBottom: 36,
  },
  logoContainer: {
    position: 'relative' as const,
    marginBottom: 16,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 2,
  },
  logoGlowRing: {
    position: 'absolute' as const,
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(229,100,28,0.2)',
  },
  appName: {
    fontSize: 38,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -1.5,
  },
  appTagline: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    fontWeight: '500' as const,
  },
  formCard: {
    backgroundColor: BG_CARD,
    borderRadius: 24,
    padding: 28,
    width: '100%' as any,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'saturate(160%) blur(24px)',
          WebkitBackdropFilter: 'saturate(160%) blur(24px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 64px rgba(0,0,0,0.45)',
        } as any)
      : {}),
  },
  formHeader: {
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 14,
    color: TEXT_DIM,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: 'rgba(229,100,28,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(229,100,28,0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  errorText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600' as const,
    flex: 1,
  },
  biometricBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    backgroundColor: 'rgba(229, 100, 28, 0.06)',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(229, 100, 28, 0.2)',
    marginBottom: 4,
  },
  biometricBtnPressed: {
    backgroundColor: 'rgba(229, 100, 28, 0.12)',
  },
  biometricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(229, 100, 28, 0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  biometricBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#E0E0E8',
  },
  googleBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: '#1C1C24',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    marginBottom: 4,
  },
  googleBtnPressed: {
    backgroundColor: '#252530',
  },
  googleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#4285F4',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#E0E0E8',
  },
  dividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 18,
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER_SUBTLE,
  },
  dividerText: {
    fontSize: 11,
    color: TEXT_DIM,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: TEXT_MUTED,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrap: {
    backgroundColor: BG_INPUT,
    borderWidth: 1.5,
    borderColor: BORDER_SUBTLE,
    borderRadius: 14,
  },
  inputWrapFocused: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(229,100,28,0.03)',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    ...webInputReset,
  },
  inputWeb: {
    outlineStyle: 'none' as any,
  },
  passwordWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    ...webInputReset,
  },
  eyeBtn: {
    paddingRight: 14,
    paddingLeft: 4,
    paddingVertical: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  loginBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  loginBtnPressed: {
    backgroundColor: ACCENT_DARK,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  hintToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 20,
    paddingVertical: 6,
  },
  hintToggleText: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '500' as const,
  },
  hintSection: {
    marginTop: 12,
    backgroundColor: BG_INPUT,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
  },
  credentialRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  credentialDivider: {
    height: 1,
    backgroundColor: BORDER_SUBTLE,
    marginVertical: 10,
  },
  credentialLabel: {
    fontSize: 12,
    color: TEXT_DIM,
    fontWeight: '500' as const,
  },
  credentialValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: ACCENT,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  versionText: {
    fontSize: 11,
    color: '#2A2A35',
    marginTop: 28,
    textAlign: 'center' as const,
    letterSpacing: 0.5,
  },
});
