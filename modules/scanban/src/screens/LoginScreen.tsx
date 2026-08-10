import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore, getSavedCredentials } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const initialCreds = getSavedCredentials();
  const [email, setEmail] = useState(initialCreds.email || 'jsrxar@gmail.com');
  const [password, setPassword] = useState(initialCreds.pass || 'Asadito21!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    fetchTheme();
    const interval = setInterval(fetchTheme, 3000);
    const creds = getSavedCredentials();
    if (creds.email) setEmail(creds.email);
    if (creds.pass) setPassword(creds.pass);

    return () => clearInterval(interval);
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
      onLoginSuccess();
    } else {
      setErrorMessage('Email o contraseña incorrectos. Verifica con el administrador.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <Text style={[styles.brandTitleWhite, { color: theme.textMain }]}>
          HOLO<Text style={[styles.brandTitleGreen, { color: theme.emerald }]}>WARE</Text>
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>ScanBan Scanner · Operativa de Depósito</Text>

        {!!errorMessage && (
          <View style={[styles.errorContainer, { borderColor: theme.red }]}>
            <Text style={[styles.errorText, { color: theme.red }]}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Email del Operario</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.textMain }]}
            placeholder="ej: jsrxar@gmail.com"
            placeholderTextColor={theme.textMuted}
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
          <Text style={[styles.label, { color: theme.textMuted }]}>Contraseña</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { flex: 1, paddingRight: 70, backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.textMain }]}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
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
              <Text style={[styles.eyeText, { color: theme.emerald }]}>{showPassword ? 'OCULTAR' : 'VER'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnSubmit, { backgroundColor: theme.emerald }, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.btnSubmitText}>INICIAR SESIÓN EN ESCÁNER</Text>
          )}
        </TouchableOpacity>

        <View style={[styles.hintBox, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
          <Text style={[styles.hintText, { color: theme.textMuted }]}>
            Operario por defecto: jsrxar@gmail.com / Asadito21!
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center'
  },
  brandTitleWhite: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center'
  },
  brandTitleGreen: {
    fontWeight: '900'
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 24,
    textAlign: 'center'
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 16
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  },
  formGroup: {
    width: '100%',
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%'
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  eyeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  btnSubmit: {
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 10
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnSubmitText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900'
  },
  hintBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%'
  },
  hintText: {
    fontSize: 11,
    textAlign: 'center'
  }
});
