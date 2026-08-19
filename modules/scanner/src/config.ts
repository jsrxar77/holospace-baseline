import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getServerUrl = (): string => {
  // En web (browser):
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Si estamos en producción o dominio real (ej. holospace.com.ar / m.holospace.com.ar)
    if (hostname.includes('holospace.com.ar') || hostname.includes('holospace.app')) {
      return 'https://holospace.com.ar';
    }
    // Si estamos en localhost o IP local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    return `http://${hostname}:3001`;
  }

  // En native (Expo Go, APK):
  if (process.env.EXPO_PUBLIC_SERVER_IP) {
    return `http://${process.env.EXPO_PUBLIC_SERVER_IP}:3001`;
  }

  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:3001`;
      }
    }
  } catch (e) {
    console.log('Error auto-detectando IP desde Expo Constants:', e);
  }

  return 'https://holospace.com.ar';
};

export const SERVER_URL = getServerUrl();
export const HOST_IP = SERVER_URL.replace(/https?:\/\//, '').split(':')[0];
