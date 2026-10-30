import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginScreen from "@/app/login";
import ResetPasswordScreen from "@/components/ResetPasswordScreen";
import WebAlertHost from "@/components/WebAlertHost";
import WebGlobalStyles from "@/components/WebGlobalStyles";
import { headerOptions } from "@/constants/navigation";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
    },
  },
});

function AuthGate() {
  const { isAuthenticated, authLoading, passwordRecovery } = useAuth();
  const { colors } = useTheme();

  if (authLoading) {
    return (
      <View style={[authStyles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[authStyles.loadingText, { color: colors.textSecondary }]}>Cargando...</Text>
      </View>
    );
  }

  if (passwordRecovery) {
    return <ResetPasswordScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={headerOptions(colors)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="order-detail"
        options={{
          title: "Detalle del Pedido",
        }}
      />
      <Stack.Screen
        name="order-form"
        options={{
          presentation: 'modal',
          title: 'Nuevo Pedido',
        }}
      />
      <Stack.Screen
        name="login"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

const authStyles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary fallbackTitle="Error en la aplicación">
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <AuthProvider>
              <DataProvider>
                <ErrorBoundary fallbackTitle="Error de contenido">
                  <AuthGate />
                </ErrorBoundary>
                <WebAlertHost />
                <WebGlobalStyles />
              </DataProvider>
            </AuthProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
