import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useAuthStore } from './src/store/useAuthStore';
import { useThemeStore } from './src/store/useThemeStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { BarcodeScannerScreen } from './src/screens/BarcodeScannerScreen';
import { DispatchScreen } from './src/screens/DispatchScreen';
import { ThemedAlertModal } from './src/components/ThemedAlertModal';

type ScreenName = 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME');
  const { isAuthenticated } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    // 1. Revisar si viene autenticado por parámetros URL (SSO Universal desde Login Web)
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get('auth_token');
      const authUserStr = urlParams.get('auth_user');
      const authTenantStr = urlParams.get('auth_tenant');

      if (authToken && authUserStr) {
        try {
          const authUser = JSON.parse(authUserStr);
          const authTenant = authTenantStr ? JSON.parse(authTenantStr) : null;
          window.localStorage.setItem('hs_token', authToken);
          window.localStorage.setItem('hs_user', JSON.stringify(authUser));
          if (authTenant) window.localStorage.setItem('hs_tenant', JSON.stringify(authTenant));

          useAuthStore.setState({
            token: authToken,
            user: authUser,
            tenant: authTenant,
            isAuthenticated: true
          });

          // Limpiar parámetros de la URL para que quede limpia /scanner
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        } catch (e) {}
      }

      // 2. Revisar si ya existe sesión guardada en localStorage
      const webToken = window.localStorage.getItem('hs_token');
      const webUser = window.localStorage.getItem('hs_user');
      const webTenant = window.localStorage.getItem('hs_tenant');
      if (webToken && webUser) {
        try {
          useAuthStore.setState({
            token: webToken,
            user: JSON.parse(webUser),
            tenant: webTenant ? JSON.parse(webTenant) : null,
            isAuthenticated: true
          });
          return;
        } catch (e) {}
      }

      // 3. Si no hay sesión, redirigir de inmediato al ÚNICO Login Web Oficial
      const returnUrl = window.location.href;
      window.location.href = 'https://holospace.com.ar/login?redirect=' + encodeURIComponent(returnUrl);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const activeToken = useAuthStore.getState().token;
      fetchTheme(activeToken);
      const interval = setInterval(() => {
        const currentToken = useAuthStore.getState().token;
        fetchTheme(currentToken);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#121317', alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" backgroundColor="#121317" />
        <ActivityIndicator size="large" color="#50FA7B" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" backgroundColor={theme.background} />
      {currentScreen === 'HOME' && (
        <HomeScreen
          onNavigate={(screen) => setCurrentScreen(screen as ScreenName)}
        />
      )}
      {currentScreen === 'SUMMARY' && (
        <OrderSummaryScreen
          onNavigate={(screen) => setCurrentScreen(screen as ScreenName)}
        />
      )}
      {currentScreen === 'SCANNER' && (
        <BarcodeScannerScreen
          onNavigate={(screen) => setCurrentScreen(screen as ScreenName)}
        />
      )}
      {currentScreen === 'DISPATCH' && (
        <DispatchScreen
          onNavigate={(screen) => setCurrentScreen(screen as ScreenName)}
        />
      )}
      <ThemedAlertModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
