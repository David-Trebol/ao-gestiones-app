import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, FolderOpen, Plus, Settings } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { liquidGlass } from '@/constants/theme';

/** Ancho desde el que la navegación pasa a ser lateral */
export const NAV_SIDE_MIN = 768;
/** Ancho desde el que la barra lateral muestra textos */
export const NAV_FULL_MIN = 1200;
/** Ancho de la barra lateral (con textos / solo iconos) */
export const NAV_WIDTH_FULL = 248;
export const NAV_WIDTH_COMPACT = 84;
/** Espacio que ocupa la barra flotante de móvil (para que el final de las listas no quede debajo) */
export const TAB_BAR_SPACE = 96;

const ITEMS = [
  // Colores de la marca Alpha Omega: naranja, azul acero y gris pizarra
  { name: '(home)', label: 'Pedidos', Icon: FolderOpen, tint: '#FF8718' },
  { name: 'manufacturers', label: 'Fabricantes', Icon: Building2, tint: '#3F6E92' },
  { name: 'settings', label: 'Ajustes', Icon: Settings, tint: '#5B6B73' },
] as const;

const web = Platform.OS === 'web';
const pointer = web ? ({ cursor: 'pointer' } as ViewStyle) : null;

/** Icono de la app: degradado de color, como el icono de una app de Apple */
export function AppIcon({ size = 34 }: { size?: number }) {
  return (
    <View
      style={[
        styles.appIcon,
        { width: size, height: size, borderRadius: size * 0.2237 },
        web
          ? ({ backgroundImage: 'linear-gradient(145deg, #FFA24A 0%, #FF8718 45%, #E5600A 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(255,135,24,0.35)' } as ViewStyle)
          : { backgroundColor: '#FF8718' },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.appIconText, { fontSize: size * 0.5 }]}>Ω</Text>
    </View>
  );
}

/** Icono en un cuadrado de color (como los de Ajustes de iOS y la barra lateral de macOS) */
export function TintChip({ Icon, tint, size = 28 }: { Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; tint: string; size?: number }) {
  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: size * 0.27, backgroundColor: tint }]}>
      <Icon size={size * 0.58} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}

/**
 * Navegación principal con el lenguaje de Apple:
 * - ordenador (≥ 1200 px): barra lateral translúcida de macOS, con iconos de colores y «Nuevo pedido»
 * - tablet (768–1199 px): la misma barra, solo con iconos
 * - móvil: barra de pestañas flotante de vidrio (se oculta en el formulario, que tiene su barra de guardar)
 */
export default function AppNav({ state, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const side = width >= NAV_SIDE_MIN;
  const full = width >= NAV_FULL_MIN;
  const { height } = useWindowDimensions();
  // Pantallas bajas (móvil en horizontal): elementos de la barra lateral más compactos
  const low = height < 460;

  const go = (name: string) => {
    const route = state.routes.find(r => r.name === name);
    if (!route) return;
    const focused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      if (focused && name === '(home)' && pathname !== '/') router.replace('/');
      else if (!focused) navigation.navigate(route.name, route.params);
    }
  };
  const isActive = (name: string) => state.routes[state.index]?.name === name;

  if (!side) {
    if (pathname.startsWith('/order-form')) return null;
    return (
      <View pointerEvents="box-none" style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View
          style={[styles.bottom, liquidGlass(colors, isDark)]}
          accessibilityRole={web ? ('navigation' as never) : undefined}
        >
          {ITEMS.map(({ name, label, Icon }) => {
            const active = isActive(name);
            return (
              <Pressable
                key={name}
                onPress={() => go(name)}
                style={[styles.bottomItem, active && { backgroundColor: colors.primarySoft }, pointer]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                testID={`nav-${label}`}
              >
                <Icon size={22} color={active ? colors.primary : colors.text} strokeWidth={active ? 2.3 : 1.8} />
                <Text style={[styles.bottomLabel, { color: active ? colors.primary : colors.text }, active && { fontWeight: '600' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // Barra lateral flotante: un panel navy de vidrio con esquinas redondeadas, separado del borde de la ventana
  return (
    <View style={[styles.sideWrap, { width: full ? NAV_WIDTH_FULL : NAV_WIDTH_COMPACT }]}>
    <View
      style={[
        styles.side,
        { backgroundColor: colors.nav },
        web &&
          ({
            backgroundColor: isDark ? 'rgba(0, 24, 33, 0.82)' : 'rgba(0, 42, 57, 0.88)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 18px 40px rgba(0,42,57,0.22)',
          } as ViewStyle),
      ]}
      accessibilityRole={web ? ('navigation' as never) : undefined}
    >
      <View style={[styles.brand, !full && styles.brandCompact]}>
        <AppIcon />
        {full && (
          <View style={{ minWidth: 0 }}>
            <Text style={[styles.brandText, { color: colors.brand }]}>ALPHAΩMEGA</Text>
            <Text style={[styles.brandSub, { color: colors.navMuted }]}>Libro de pedidos</Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={() => router.push('/order-form' as never)}
        style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
          styles.newBtn,
          !full && styles.newBtnCompact,
          { backgroundColor: hovered ? colors.primaryDark : colors.primaryFill, opacity: pressed ? 0.85 : 1 },
          web && ({ boxShadow: '0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.18)', cursor: 'pointer' } as ViewStyle),
        ]}
        accessibilityRole="button"
        accessibilityLabel="Nuevo pedido"
        testID="nav-new-order"
      >
        <Plus size={18} color={colors.onPrimary} strokeWidth={2.6} />
        {full && <Text style={[styles.newBtnText, { color: colors.onPrimary }]}>Nuevo pedido</Text>}
      </Pressable>

      <View style={styles.items}>
        {ITEMS.map(({ name, label, Icon, tint }) => {
          const active = isActive(name);
          return (
            <Pressable
              key={name}
              onPress={() => go(name)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.item,
                !full && styles.itemCompact,
                !full && low && { minHeight: 52, paddingVertical: 4 },
                active ? { backgroundColor: colors.navActiveBg } : hovered ? { backgroundColor: 'rgba(255,255,255,0.06)' } : null,
                pointer,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              testID={`nav-${label}`}
            >
              <TintChip Icon={Icon} tint={tint} size={full ? 26 : 30} />
              {full ? (
                <Text style={[styles.itemText, { color: active ? colors.navActiveText : colors.navText }, active && { fontWeight: '700' }]}>{label}</Text>
              ) : (
                <Text style={[styles.itemTextCompact, { color: active ? colors.navActiveText : colors.navMuted }, active && { fontWeight: '700' }]}>{label}</Text>
              )}
              {full && active && <View style={[styles.activeBar, { backgroundColor: colors.brand }]} />}
            </Pressable>
          );
        })}
      </View>

      {currentUser && (
        <View style={[styles.user, { borderTopColor: colors.navDivider }, !full && { justifyContent: 'center', paddingHorizontal: 0 }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.12)' }]} accessibilityLabel={currentUser.displayName || currentUser.email || 'Usuario'}>
            <Text style={[styles.avatarText, { color: colors.navText }]}>{(currentUser.displayName || currentUser.email || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          {full && (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.userName, { color: colors.navText }]} numberOfLines={1}>
                {currentUser.displayName || currentUser.email}
              </Text>
              <Text style={[styles.userMail, { color: colors.navMuted }]} numberOfLines={1}>
                {currentUser.role === 'admin' ? 'Administrador' : 'Usuario'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appIcon: { alignItems: 'center', justifyContent: 'center' },
  appIconText: { color: '#002A39', fontWeight: '800', letterSpacing: -0.3, marginTop: -2 },
  chip: { alignItems: 'center', justifyContent: 'center' },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 32, width: '100%', maxWidth: 420 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52, borderRadius: 26 },
  bottomLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.1 },
  sideWrap: { height: '100%', paddingLeft: 10, paddingVertical: 10 },
  side: { flex: 1, borderRadius: 22, overflow: 'hidden', paddingTop: 18, paddingBottom: 14, paddingHorizontal: 10, gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, marginBottom: 10, minHeight: 40 },
  brandCompact: { justifyContent: 'center', paddingHorizontal: 0 },
  brandText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.6 },
  brandSub: { fontSize: 12, marginTop: 1 },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 999, marginBottom: 14 },
  newBtnCompact: { width: 48, alignSelf: 'center' },
  newBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  items: { gap: 2, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 10, borderRadius: 12, overflow: 'hidden' },
  activeBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  itemCompact: { flexDirection: 'column', gap: 4, paddingHorizontal: 0, paddingVertical: 8, minHeight: 64, justifyContent: 'center' },
  itemText: { fontSize: 15, letterSpacing: -0.2 },
  itemTextCompact: { fontSize: 11, fontWeight: '500' },
  user: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '600' },
  userName: { fontSize: 14, fontWeight: '600' },
  userMail: { fontSize: 12 },
});
