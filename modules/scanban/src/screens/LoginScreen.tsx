import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore, getSavedCredentials } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    fetchTheme();
    const interval = setInterval(fetchTheme, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Por favor ingresa tu email y contraseña.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    const success = await login(email.trim(), password.trim(), (tenantSlug.trim() || 'drinklovers'));
    setLoading(false);

    if (success) {
      onLoginSuccess();
    } else {
      setErrorMessage('Credenciales u organización incorrectas. Verifica con el administrador.');
    }
  };

  const isOmarchy = theme.borderRadius === 4;
  const isSoftMinimal = theme.borderRadius === 12;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderRadius: isOmarchy ? 4 : (isSoftMinimal ? 12 : 24), borderWidth: isOmarchy ? 2 : 1 }]}>
        <Text
          style={[
            styles.brandTitleWhite,
            {
              color: theme.textMain,
              fontFamily: isOmarchy ? 'Press Start 2P' : (isSoftMinimal ? 'Plus Jakarta Sans' : 'Outfit'),
              fontSize: isOmarchy ? 16 : 26,
              letterSpacing: isOmarchy ? 1 : -0.5
            }
          ]}
        >
          HOLO<Text style={[styles.brandTitleGreen, { color: theme.emerald }]}>WARE</Text>
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: isOmarchy ? 'JetBrains Mono' : (isSoftMinimal ? 'Plus Jakarta Sans' : 'Outfit') }]}>ScanBan Scanner · Operativa de Depósito</Text>

        {!!errorMessage && (
          <View style={[styles.errorContainer, { borderColor: theme.red, borderRadius: isOmarchy ? 4 : 8 }]}>
            <Text style={[styles.errorText, { color: theme.red }]}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Organización / Empresa</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.textMain, borderRadius: isOmarchy ? 4 : 12 }]}
            placeholder="ej: drinklovers"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            value={tenantSlug}
            onChangeText={(txt) => {
              setTenantSlug(txt);
              setErrorMessage('');
            }}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Email del Operario</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.textMain, borderRadius: isOmarchy ? 4 : 12 }]}
            placeholder="ej: operario@empresa.com"
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
              style={[styles.input, { flex: 1, paddingRight: 70, backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.textMain, borderRadius: isOmarchy ? 4 : 12 }]}
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
          style={[styles.btnSubmit, { backgroundColor: theme.emerald, borderRadius: isOmarchy ? 4 : (isSoftMinimal ? 20 : 14) }, loading && styles.btnDisabled]}
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
