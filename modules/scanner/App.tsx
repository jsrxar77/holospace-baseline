import React, { useState, useEffect, Suspense } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { useAuthStore } from './src/store/useAuthStore';
import { useThemeStore } from './src/store/useThemeStore';

const HomeScreen = React.lazy(() =>
  import('./src/screens/HomeScreen').then(m => ({ default: m.HomeScreen }))
);
const OrderSummaryScreen = React.lazy(() =>
  import('./src/screens/OrderSummaryScreen').then(m => ({ default: m.OrderSummaryScreen }))
);
const BarcodeScannerScreen = React.lazy(() =>
  import('./src/screens/BarcodeScannerScreen').then(m => ({ default: m.BarcodeScannerScreen }))
);
const DispatchScreen = React.lazy(() =>
  import('./src/screens/DispatchScreen').then(m => ({ default: m.DispatchScreen }))
);

type ScreenName = 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME');
  const { isAuthenticated, token } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    // Sincronizar token compartido de Web si existe en localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const webToken = window.localStorage.getItem('hs_token');
      const webUser = window.localStorage.getItem('hs_user');
      const webTenant = window.localStorage.getItem('hs_tenant');
      if (webToken && webUser && !isAuthenticated) {
        try {
          useAuthStore.setState({
            token: webToken,
            user: JSON.parse(webUser),
            tenant: webTenant ? JSON.parse(webTenant) : null,
            isAuthenticated: true
          });
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    // Si no está autenticado en navegador web, redirigir al Login Web Oficial
    if (!isAuthenticated && typeof window !== 'undefined' && window.location) {
      if (window.location.pathname.startsWith('/scanner') || window.location.hostname.startsWith('m.')) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const currentToken = useAuthStore.getState().token;
    fetchTheme(currentToken);
    const interval = setInterval(() => {
      const activeToken = useAuthStore.getState().token;
      fetchTheme(activeToken);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: '#181926', alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" backgroundColor="#181926" />
        <ActivityIndicator size="large" color="#A6DA95" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" backgroundColor={theme.background} />
      <Suspense fallback={
        <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={theme.emerald} />
        </View>
      }>
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
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
