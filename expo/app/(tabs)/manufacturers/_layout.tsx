import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { headerOptions } from '@/constants/navigation';

export default function ManufacturersLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={headerOptions(colors)}
    >
      <Stack.Screen name="index" options={{ title: 'Fabricantes' }} />
    </Stack>
  );
}
