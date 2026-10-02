import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { BrandLockup } from '../components/Brand';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // Los formularios de acceso inician siempre vacios (regla de proyecto)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuthStore();
  const { theme, fetchTheme } = useThemeStore();

  useEffect(() => {
    fetchTheme(null);
  }, []);

  const mono = (Platform.OS === 'web' ? `"${theme.fontMono || 'Geist Mono'}", monospace` : 'monospace') as any;
  const sans = (Platform.OS === 'web' ? `"${theme.fontFamily || 'Geist'}", system-ui, sans-serif` : undefined) as any;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Escribí tu email y tu contraseña.');
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
      setErrorMessage('El email o la contraseña no son correctos. Revisalos e intentá de nuevo.');
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.textMain, fontFamily: sans }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
        <View style={styles.logoRow}>
          <BrandLockup
            ink={theme.textMain}
            accent={theme.emerald}
            fontSize={32}
            markSize={34}
            fontFamily={sans}
          />
        </View>
        <Text style={[styles.by, { color: theme.textMuted, fontFamily: mono }]}>by hologrowth.dev</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted, fontFamily: mono }]}>INGRESO A TU CUENTA</Text>

        {!!errorMessage && (
          <View style={[styles.errorContainer, { borderColor: theme.red }]}>
            <Text style={[styles.errorText, { color: theme.red }]}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.textMuted, fontFamily: mono }]}>TU EMAIL</Text>
          <TextInput
            style={inputStyle}
            placeholder="usuario@holospace.com.ar"
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
          <Text style={[styles.label, { color: theme.textMuted, fontFamily: mono }]}>CONTRASEÑA</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[...inputStyle, styles.passwordInput]}
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
              <Text style={[styles.eyeText, { color: theme.textMuted, fontFamily: mono }]}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
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
            <ActivityIndicator color={theme.accentFg || '#000000'} />
          ) : (
            <Text style={[styles.btnSubmitText, { color: theme.accentFg || '#04130E', fontFamily: sans }]}>Ingresar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backToHomeWrapper}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.href = 'https://holospace.com.ar/';
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.backToHomeText, { color: theme.textMuted, fontFamily: mono }]}>Volver al inicio →</Text>
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
    padding: 20
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: 0,
    padding: 28
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  by: {
    textAlign: 'center',
    fontSize: 11,
    marginBottom: 10
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 22
  },
  errorContainer: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 10,
    marginBottom: 16
  },
  errorText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700'
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14
  },
  passwordRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center'
  },
  passwordInput: {
    flex: 1,
    paddingRight: 70
  },
  eyeButton: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  eyeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  btnSubmit: {
    borderRadius: 0,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnSubmitText: {
    fontSize: 15,
    fontWeight: '700'
  },
  backToHomeWrapper: {
    marginTop: 14,
    alignItems: 'flex-end'
  },
  backToHomeText: {
    fontSize: 12
  }
});
