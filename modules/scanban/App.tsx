import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { BarcodeScannerScreen } from './src/screens/BarcodeScannerScreen';
import { DispatchScreen } from './src/screens/DispatchScreen';
import { useAuthStore } from './src/store/useAuthStore';
import { useThemeStore } from './src/store/useThemeStore';

type ScreenName = 'HOME' | 'SUMMARY' | 'SCANNER' | 'DISPATCH';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME');
  const { isAuthenticated } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    fetchTheme();
    const interval = setInterval(fetchTheme, 3000);
    return () => clearInterval(interval);
  }, []);

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
