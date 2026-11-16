import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, FolderOpen, Plus, Settings } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { radius } from '@/constants/theme';

/** Ancho desde el que la navegación pasa a ser lateral */
export const NAV_SIDE_MIN = 768;
/** Ancho desde el que la barra lateral muestra textos */
export const NAV_FULL_MIN = 1200;

const ITEMS = [
  { name: '(home)', label: 'Pedidos', Icon: FolderOpen },
  { name: 'manufacturers', label: 'Fabricantes', Icon: Building2 },
  { name: 'settings', label: 'Ajustes', Icon: Settings },
] as const;

/**
 * Navegación principal:
 * - ordenador (≥ 1200 px): barra lateral con textos y «Nuevo pedido» siempre a mano
 * - tablet (768–1199 px): barra lateral solo con iconos
 * - móvil: barra inferior (se oculta en el formulario, que tiene su propia barra de guardar)
 */
export default function AppNav({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const side = width >= NAV_SIDE_MIN;
  const full = width >= NAV_FULL_MIN;

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
      <View
        style={[styles.bottom, { backgroundColor: colors.tabBarBackground, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 6) }]}
        accessibilityRole={Platform.OS === 'web' ? ('navigation' as never) : undefined}
      >
        {ITEMS.map(({ name, label, Icon }) => {
          const active = isActive(name);
          return (
            <Pressable
              key={name}
              onPress={() => go(name)}
              style={styles.bottomItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              testID={`nav-${label}`}
            >
              <Icon size={22} color={active ? colors.primary : colors.textSecondary} strokeWidth={active ? 2.3 : 1.8} />
              <Text style={[styles.bottomLabel, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[styles.side, { width: full ? 232 : 76, backgroundColor: colors.headerBackground, borderRightColor: colors.divider }]}
      accessibilityRole={Platform.OS === 'web' ? ('navigation' as never) : undefined}
    >
      <View style={[styles.brand, !full && { justifyContent: 'center', paddingHorizontal: 0 }]}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>AO</Text>
        </View>
        {full && <Text style={[styles.brandText, { color: colors.text }]}>AO Gestiones</Text>}
      </View>

      <Pressable
        onPress={() => router.push('/order-form' as never)}
        style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) => [
          styles.newBtn,
          !full && styles.newBtnCompact,
          { backgroundColor: hovered ? colors.primaryDark : colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Nuevo pedido"
        testID="nav-new-order"
      >
        <Plus size={18} color="#fff" strokeWidth={2.5} />
        {full && <Text style={styles.newBtnText}>Nuevo pedido</Text>}
      </Pressable>

      <View style={styles.items}>
        {ITEMS.map(({ name, label, Icon }) => {
          const active = isActive(name);
          return (
            <Pressable
              key={name}
              onPress={() => go(name)}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.item,
                !full && styles.itemCompact,
                active ? { backgroundColor: colors.primarySoftAlt } : hovered ? { backgroundColor: colors.fill } : null,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              testID={`nav-${label}`}
            >
              <Icon size={20} color={active ? colors.primary : colors.textSecondary} strokeWidth={active ? 2.3 : 1.9} />
              {full ? (
                <Text style={[styles.itemText, { color: active ? colors.primary : colors.text }, active && { fontWeight: '600' }]}>{label}</Text>
              ) : (
                <Text style={[styles.itemTextCompact, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {full && currentUser && (
        <View style={[styles.user, { borderTopColor: colors.divider }]}>
          <View style={[styles.avatar, { backgroundColor: colors.fill }]}>
            <Text style={[styles.avatarText, { color: colors.text }]}>{(currentUser.displayName || currentUser.email || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {currentUser.displayName || currentUser.email}
            </Text>
            <Text style={[styles.userMail, { color: colors.textSecondary }]} numberOfLines={1}>
              {currentUser.role === 'admin' ? 'Administrador' : 'Usuario'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  bottomLabel: { fontSize: 11, fontWeight: '500' },
  side: { height: '100%', borderRightWidth: StyleSheet.hairlineWidth, paddingVertical: 16, paddingHorizontal: 12, gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, marginBottom: 12, minHeight: 36 },
  logo: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  brandText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: radius.pill, marginBottom: 12 },
  newBtnCompact: { width: 48, alignSelf: 'center' },
  newBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  items: { gap: 2, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.md },
  itemCompact: { flexDirection: 'column', gap: 2, paddingHorizontal: 0, paddingVertical: 8, minHeight: 56, justifyContent: 'center' },
  itemText: { fontSize: 15 },
  itemTextCompact: { fontSize: 10.5, fontWeight: '500' },
  user: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '600' },
  userName: { fontSize: 14, fontWeight: '600' },
  userMail: { fontSize: 12 },
});
