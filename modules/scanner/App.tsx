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
  const { isAuthenticated, token } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME');

  useEffect(() => {
    // 1. Ocultar loader HTML
    if (typeof document !== 'undefined') {
      const loader = document.getElementById('expo-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 200);
      }
    }

    // 2. Limpiar query params de SSO en la URL
    if (typeof window !== 'undefined' && window.location && window.history && window.history.replaceState) {
      if (window.location.search.includes('auth_token=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // 3. Si no está autenticado, redirigir al login unificado
    if (!isAuthenticated && typeof window !== 'undefined') {
      const returnUrl = window.location.origin + window.location.pathname;
      window.location.replace('https://holospace.com.ar/login?redirect=' + encodeURIComponent(returnUrl));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchTheme(token);
      const interval = setInterval(() => {
        const currentToken = useAuthStore.getState().token;
        fetchTheme(currentToken);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#121317', alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" backgroundColor="#121317" />
        <ActivityIndicator size="large" color="#A6DA95" />
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
