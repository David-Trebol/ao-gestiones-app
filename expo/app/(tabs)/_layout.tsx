import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { FONT_FAMILY, glass } from '@/constants/theme';
import { FolderOpen, Search, Building2, Settings } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          ...glass(colors.tabBarBackground, 24),
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          ...(isDesktop ? { height: 60, paddingBottom: 8, paddingTop: 6 } : {}),
          ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
        },
        tabBarLabelStyle: {
          fontSize: isDesktop ? 12 : 10,
          fontWeight: '500' as const,
          letterSpacing: 0,
          ...(FONT_FAMILY ? { fontFamily: FONT_FAMILY } : {}),
        },
        tabBarIconStyle: isDesktop ? { marginBottom: -2 } : undefined,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size, focused }) => <FolderOpen size={size - 2} color={color} strokeWidth={focused ? 2.3 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size, focused }) => <Search size={size - 2} color={color} strokeWidth={focused ? 2.3 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="manufacturers"
        options={{
          title: 'Fabricantes',
          tabBarIcon: ({ color, size, focused }) => <Building2 size={size - 2} color={color} strokeWidth={focused ? 2.3 : 1.8} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size, focused }) => <Settings size={size - 2} color={color} strokeWidth={focused ? 2.3 : 1.8} />,
        }}
      />
    </Tabs>
  );
}
