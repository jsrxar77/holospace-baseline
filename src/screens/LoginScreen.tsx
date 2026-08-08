import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('javier@drinklovers.com');
  const [password, setPassword] = useState('op123456');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña.');
      return;
    }

    setLoading(true);
    const success = await login(email.trim(), password.trim());
    setLoading(false);

    if (success) {
      onLoginSuccess();
    } else {
      Alert.alert('Error de Autenticación', 'Email o contraseña incorrectos. Verifica con el administrador.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>📦</Text>
        </View>

        <Text style={styles.title}>Phone-Ware Depósito</Text>
        <Text style={styles.subtitle}>Ingreso obligatorio para operarios de logística</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email del Operario</Text>
          <TextInput
            style={styles.input}
            placeholder="ej: javier@drinklovers.com"
            placeholderTextColor="#8B949E"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
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
            onChangeText={setPassword}
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
            <Text style={styles.btnSubmitText}>INICIAR SESIÓN EN DEPÓSITO</Text>
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
    borderWidth: 2,
    borderColor: '#00E676',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    gap: 16
  },
  logoCircle: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 2,
    borderColor: '#00E676',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoText: {
    fontSize: 36
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center'
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -8
  },
  formGroup: {
    width: '100%',
    gap: 6
  },
  label: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '700'
  },
  input: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#0B0E14',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16
  },
  btnSubmit: {
    width: '100%',
    minHeight: 64, // Ergonomía > 64px
    backgroundColor: '#00E676',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 10
  },
  btnSubmitText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  btnDisabled: {
    opacity: 0.6
  },
  hintBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)'
  },
  hintText: {
    color: '#3B82F6',
    fontSize: 12,
    textAlign: 'center'
  }
});
