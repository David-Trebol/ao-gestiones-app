import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
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
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          ...(isDesktop ? {
            height: 58,
            paddingBottom: 6,
          } : {}),
          ...(Platform.OS === 'web' ? {
            cursor: 'pointer' as any,
          } : {}),
        },
        tabBarLabelStyle: {
          fontSize: isDesktop ? 13 : 11,
          fontWeight: '600' as const,
          letterSpacing: 0.1,
        },
        tabBarIconStyle: isDesktop ? {
          marginBottom: -2,
        } : undefined,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => <FolderOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="manufacturers"
        options={{
          title: 'Fabricantes',
          tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
