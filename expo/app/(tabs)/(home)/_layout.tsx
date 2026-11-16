import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { headerOptions } from '@/constants/navigation';

// Al abrir un pedido por enlace directo, "Atrás" vuelve a la lista
export const unstable_settings = { initialRouteName: 'index' };

export default function HomeLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={headerOptions(colors)}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Pedidos' }} />
      <Stack.Screen name="order-detail" options={{ title: 'Pedido' }} />
      <Stack.Screen name="order-form" options={{ title: 'Nuevo pedido' }} />
    </Stack>
  );
}
