import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore, getSavedCredentials } from '../store/useAuthStore';

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

  useEffect(() => {
    const creds = getSavedCredentials();
    if (creds.email) setEmail(creds.email);
    if (creds.pass) setPassword(creds.pass);
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
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brandTitleWhite}>
          HOLO<Text style={styles.brandTitleGreen}>WARE</Text>
        </Text>
        <Text style={styles.subtitle}>ScanBan Scanner · Operativa de Depósito</Text>

        {!!errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email del Operario</Text>
          <TextInput
            style={styles.input}
            placeholder="ej: jsrxar@gmail.com"
            placeholderTextColor="#8B949E"
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
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { flex: 1, paddingRight: 44 }]}
              placeholder="••••••••"
              placeholderTextColor="#8B949E"
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
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
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
            <Text style={styles.btnSubmitText}>INICIAR SESIÓN EN ESCÁNER</Text>
          )}
        </TouchableOpacity>

        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            💡 Operario por defecto: jsrxar@gmail.com / Asadito21!
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#30363D',
    alignItems: 'center'
  },
  brandTitleWhite: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center'
  },
  brandTitleGreen: {
    color: '#00E676',
    fontWeight: '900'
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 13,
    marginBottom: 24,
    textAlign: 'center'
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderWidth: 1,
    borderColor: '#FF5252',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 16
  },
  errorText: {
    color: '#FF5252',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center'
  },
  formGroup: {
    width: '100%',
    marginBottom: 16
  },
  label: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  input: {
    backgroundColor: '#0B0E14',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
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
    fontSize: 18
  },
  btnSubmit: {
    backgroundColor: '#00E676',
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
    backgroundColor: '#0B0E14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    width: '100%'
  },
  hintText: {
    color: '#8B949E',
    fontSize: 11,
    textAlign: 'center'
  }
});
