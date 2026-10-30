import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { headerOptions } from '@/constants/navigation';

export default function SettingsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={headerOptions(colors)}
    >
      <Stack.Screen name="index" options={{ title: 'Ajustes' }} />
    </Stack>
  );
}
