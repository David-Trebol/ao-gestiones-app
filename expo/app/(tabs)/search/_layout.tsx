import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { headerOptions } from '@/constants/navigation';

export default function SearchLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={headerOptions(colors)}
    >
      <Stack.Screen name="index" options={{ title: 'Buscar' }} />
    </Stack>
  );
}
