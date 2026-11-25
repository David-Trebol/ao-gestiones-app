import React from 'react';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { sceneBackground } from '@/constants/theme';
import AppNav, { NAV_SIDE_MIN } from '@/components/AppNav';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const side = width >= NAV_SIDE_MIN;

  return (
    <Tabs
      tabBar={props => <AppNav {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: side ? 'left' : 'bottom',
        sceneStyle: sceneBackground(colors),
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Pedidos' }} />
      <Tabs.Screen name="manufacturers" options={{ title: 'Referencias de pedido' }} />
      <Tabs.Screen name="suppliers" options={{ title: 'Fabricantes' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
      {/* La búsqueda vive en Pedidos; la ruta antigua redirige allí */}
      <Tabs.Screen name="search" options={{ href: null, title: 'Buscar' }} />
    </Tabs>
  );
}
