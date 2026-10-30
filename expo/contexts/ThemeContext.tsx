import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { LightColors, DarkColors, ThemeColors } from '@/constants/colors';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = '@ao_theme_mode';

async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'light';
  } catch (e) {
    console.error('[ThemeContext] Error loading theme:', e);
    return 'light';
  }
}

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  const themeQuery = useQuery({
    queryKey: ['theme_mode'],
    queryFn: loadThemeMode,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (themeQuery.data) {
      setThemeMode(themeQuery.data);
    }
  }, [themeQuery.data]);

  const toggleTheme = useCallback(async () => {
    const newMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.error('[ThemeContext] Error saving theme:', e);
    }
  }, [themeMode]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.error('[ThemeContext] Error saving theme:', e);
    }
  }, []);

  const colors: ThemeColors = useMemo(
    () => (themeMode === 'dark' ? DarkColors : LightColors),
    [themeMode]
  );

  const isDark = themeMode === 'dark';

  return {
    themeMode,
    isDark,
    colors,
    toggleTheme,
    setTheme,
  };
});
