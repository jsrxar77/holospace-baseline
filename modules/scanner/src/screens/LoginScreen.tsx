import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';
import { useAuthStore, getSavedCredentials } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

// Icono Nave Retro Multicolor Vectorial
const RetroShipIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28">
    <G transform="rotate(45, 14, 14)">
      <Rect x="12" y="3" width="4" height="4" fill="#8AADF4" />
      <Rect x="10" y="7" width="8" height="6" fill="#CAD3F5" />
      <Rect x="6" y="9" width="16" height="4" fill="#C6A0F6" />
      <Rect x="4" y="13" width="20" height="4" fill="#8AADF4" />
      <Rect x="4" y="17" width="4" height="4" fill="#ED8796" />
      <Rect x="20" y="17" width="4" height="4" fill="#ED8796" />
      <Rect x="2" y="19" width="2" height="4" fill="#F5BDE6" />
      <Rect x="24" y="19" width="2" height="4" fill="#F5BDE6" />
      <Rect x="12" y="17" width="4" height="6" fill="#A6DA95" />
      <Rect x="13" y="23" width="2" height="4" fill="#FE8019" />
      <Rect x="14" y="27" width="1" height="2" fill="#EED49F" />
    </G>
  </Svg>
);

// Asteroide 1 SVG
const Asteroid1Svg: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Rect x="8" y="2" width="16" height="4" fill="#6E738D" />
    <Rect x="4" y="6" width="24" height="20" fill="#5B6078" />
    <Rect x="8" y="26" width="16" height="4" fill="#494D64" />
    <Rect x="2" y="10" width="28" height="12" fill="#5B6078" />
    <Rect x="8" y="10" width="4" height="4" fill="#363A4F" />
    <Rect x="18" y="8" width="6" height="6" fill="#363A4F" />
    <Rect x="14" y="18" width="8" height="4" fill="#363A4F" />
  </Svg>
);

// Asteroide 2 Dorado SVG
const Asteroid2Svg: React.FC<{ size?: number }> = ({ size = 42 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="6" y="2" width="12" height="4" fill="#A68A56" />
    <Rect x="2" y="6" width="20" height="12" fill="#8C7343" />
    <Rect x="6" y="18" width="12" height="4" fill="#6B5731" />
    <Rect x="6" y="8" width="4" height="4" fill="#EED49F" />
    <Rect x="14" y="12" width="4" height="4" fill="#F5A97F" />
  </Svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const saved = getSavedCredentials();
  const [email, setEmail] = useState(saved.email || '');
  const [password, setPassword] = useState(saved.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  // Animaciones de fondo espacial
  const asteroid1Anim = useRef(new Animated.Value(0)).current;
  const asteroid2Anim = useRef(new Animated.Value(0)).current;
  const shipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const creds = getSavedCredentials();
    if (creds.email && !email) setEmail(creds.email);
    if (creds.password && !password) setPassword(creds.password);

    fetchTheme(null);

    // Animación continua de asteroides y naves
    const startAnimations = () => {
      Animated.loop(
        Animated.timing(asteroid1Anim, {
          toValue: 1,
          duration: 35000,
          useNativeDriver: Platform.OS !== 'web'
        })
      ).start();

      Animated.loop(
        Animated.timing(asteroid2Anim, {
          toValue: 1,
          duration: 28000,
          useNativeDriver: Platform.OS !== 'web'
        })
      ).start();

      Animated.loop(
        Animated.timing(shipAnim, {
          toValue: 1,
          duration: 22000,
          useNativeDriver: Platform.OS !== 'web'
        })
      ).start();
    };

    startAnimations();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu email y contraseña.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    const success = await login(email.trim(), password.trim());
    setLoading(false);

    if (success) {
      const token = useAuthStore.getState().token;
      if (token) {
        await fetchTheme(token);
      }
      onLoginSuccess();
    } else {
      setErrorMessage('Credenciales incorrectas. Verifica tu email y contraseña.');
    }
  };

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const ast1TranslateX = asteroid1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, screenWidth + 60]
  });
  const ast1TranslateY = asteroid1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, screenHeight - 100]
  });

  const ast2TranslateX = asteroid2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth + 50, -50]
  });
  const ast2TranslateY = asteroid2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight - 150, 80]
  });

  const shipTranslateX = shipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, screenWidth + 50]
  });
  const shipTranslateY = shipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight + 30, -50]
  });

  return (
    <View style={styles.container}>
      {/* CAPA DE FONDO ESPACIAL ANIMADO (ASTEROIDES Y NAVES) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View
          style={[
            styles.spaceEntity,
            {
              transform: [
                { translateX: ast1TranslateX },
                { translateY: ast1TranslateY }
              ]
            }
          ]}
        >
          <Asteroid1Svg />
        </Animated.View>

        <Animated.View
          style={[
            styles.spaceEntity,
            {
              transform: [
                { translateX: ast2TranslateX },
                { translateY: ast2TranslateY }
              ]
            }
          ]}
        >
          <Asteroid2Svg />
        </Animated.View>

        <Animated.View
          style={[
            styles.spaceEntity,
            {
              transform: [
                { translateX: shipTranslateX },
                { translateY: shipTranslateY }
              ]
            }
          ]}
        >
          <RetroShipIcon size={38} />
        </Animated.View>
      </View>

      {/* TARJETA DE LOGIN 8-BIT FLOTANTE */}
      <View style={styles.card}>
        {/* LOGO HOLOSPACE + NAVE MULTICOLOR RETRO */}
        <View style={styles.logoRow}>
          <Text style={styles.logoHolo}>Holo</Text>
          <Text style={styles.logoSpace}>Space</Text>
          <View style={styles.logoIconWrapper}>
            <RetroShipIcon size={26} />
          </View>
        </View>

        <Text style={styles.subtitle}>Iniciar Sesión</Text>

        {!!errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email de Usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario@holospace.com.ar"
            placeholderTextColor="#6E738D"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(txt) => {
              setEmail(txt);
              setErrorMessage('');
            }}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="••••••••"
              placeholderTextColor="#6E738D"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(txt) => {
                setPassword(txt);
                setErrorMessage('');
              }}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnSubmit, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.btnSubmitText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  spaceEntity: {
    position: 'absolute',
    opacity: 0.85
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#181926',
    borderWidth: 2,
    borderColor: '#363A4F',
    borderRadius: 4,
    padding: 28,
    shadowColor: '#0A0B10',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    zIndex: 10
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  logoHolo: {
    fontFamily: Platform.OS === 'web' ? 'Press Start 2P, monospace' : 'monospace',
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: '#363A4F',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0
  },
  logoSpace: {
    fontFamily: Platform.OS === 'web' ? 'Press Start 2P, monospace' : 'monospace',
    fontSize: 22,
    fontWeight: '900',
    color: '#A6DA95',
    textShadowColor: '#1E4620',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0
  },
  logoIconWrapper: {
    marginLeft: 8
  },
  subtitle: {
    textAlign: 'center',
    color: '#A5ADCB',
    fontSize: 14,
    marginBottom: 20,
    fontFamily: Platform.OS === 'web' ? 'JetBrains Mono, monospace' : 'monospace'
  },
  errorContainer: {
    backgroundColor: 'rgba(237, 135, 150, 0.12)',
    borderWidth: 1,
    borderColor: '#ED8796',
    borderRadius: 4,
    padding: 10,
    marginBottom: 16
  },
  errorText: {
    color: '#ED8796',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700'
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    color: '#A5ADCB',
    marginBottom: 6,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'JetBrains Mono, monospace' : 'monospace'
  },
  input: {
    backgroundColor: '#1E2030',
    borderWidth: 1,
    borderColor: '#363A4F',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#CAD3F5',
    fontFamily: Platform.OS === 'web' ? 'JetBrains Mono, monospace' : 'monospace'
  },
  passwordRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center'
  },
  passwordInput: {
    flex: 1,
    paddingRight: 65
  },
  eyeButton: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  eyeText: {
    color: '#8AADF4',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'web' ? 'JetBrains Mono, monospace' : 'monospace'
  },
  btnSubmit: {
    backgroundColor: '#A6DA95',
    borderWidth: 2,
    borderColor: '#8BD5CA',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnSubmitText: {
    color: '#181926',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Platform.OS === 'web' ? 'Press Start 2P, monospace' : 'monospace',
    letterSpacing: 0.5
  }
});
