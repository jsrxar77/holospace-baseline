import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('javier@drinklovers.com');
  const [password, setPassword] = useState('op123456');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuthStore();

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
          PHONEWARE <Text style={styles.brandTitleGreen}>SCANNER</Text>
        </Text>
        <Text style={styles.subtitle}>Ingreso obligatorio para operarios de logística</Text>

        {!!errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email del Operario</Text>
          <TextInput
            style={styles.input}
            placeholder="ej: javier@drinklovers.com"
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
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#8B949E"
            secureTextEntry
            value={password}
            onChangeText={(txt) => {
              setPassword(txt);
              setErrorMessage('');
            }}
          />
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
            💡 Admin por defecto: admin@drinklovers.com / drinklovers2026!
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
