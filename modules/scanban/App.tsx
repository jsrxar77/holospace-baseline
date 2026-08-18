import React, { useState, useEffect, Suspense } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { useAuthStore } from './src/store/useAuthStore';
import { useThemeStore } from './src/store/useThemeStore';

// Lazy imports para screens que usan modulos nativos pesados (expo-camera, expo-av, useOrderStore)
// Esto evita que el startup del app se bloquee en web por modulos nativos
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
  const { isAuthenticated } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    const token = useAuthStore.getState().token;
    fetchTheme(token);
    const interval = setInterval(() => {
      const currentToken = useAuthStore.getState().token;
      fetchTheme(currentToken);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar style="light" backgroundColor={theme.background} />
        <LoginScreen onLoginSuccess={() => setCurrentScreen('HOME')} />
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
          <HomeScreen onNavigateToSummary={() => setCurrentScreen('SUMMARY')} />
        )}

        {currentScreen === 'SUMMARY' && (
          <OrderSummaryScreen
            onNavigateToScanner={() => setCurrentScreen('SCANNER')}
            onNavigateToDispatch={() => setCurrentScreen('DISPATCH')}
            onBack={() => setCurrentScreen('HOME')}
          />
        )}

        {currentScreen === 'SCANNER' && (
          <BarcodeScannerScreen onClose={() => setCurrentScreen('SUMMARY')} />
        )}

        {currentScreen === 'DISPATCH' && (
          <DispatchScreen onBackToHome={() => setCurrentScreen('HOME')} />
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
