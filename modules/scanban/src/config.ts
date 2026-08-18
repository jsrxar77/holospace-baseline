import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Configuracion global del cliente movil/web HoloWare ScanBan Scanner.
 *
 * Estrategia de resolucion de SERVER_URL:
 *
 * 1. Expo Web (browser): usa window.location.hostname para apuntar siempre
 *    al puerto 3001 del mismo host desde donde se carga la app. Funciona
 *    tanto desde localhost como desde la IP LAN sin configuracion adicional.
 *
 * 2. Expo Go / Native (iOS, Android): usa EXPO_PUBLIC_SERVER_IP (definido
 *    en docker-compose.yml) o detecta la IP via Constants.expoConfig.hostUri.
 *
 * IMPORTANTE: Este archivo es hot-reloaded por Metro pero NO requiere
 * reconstruccion de Docker. Los cambios en este archivo se reflejan
 * automaticamente en la proxima carga del bundle por Metro.
 * Solo se requiere `docker compose up -d --build mobile` cuando cambian:
 *   - Variables de entorno en docker-compose.yml
 *   - Dependencias en package.json
 *   - El Dockerfile mismo
 */
const getServerUrl = (): string => {
  // En web (browser): usar el hostname actual de la ventana para apuntar al servidor Node
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001`;
  }

  // En native (Expo Go, APK): usar la IP configurada o detectarla dinamicamente
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
    const expUrl = Constants.experienceUrl;
    if (expUrl && expUrl.startsWith('exp://')) {
      const ip = expUrl.replace('exp://', '').split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && ip !== '10.0.2.2') {
        return `http://${ip}:3001`;
      }
    }
  } catch (e) {
    console.log('Error auto-detectando IP desde Expo Constants:', e);
  }

  // Fallback: IP LAN del host. Actualizar si cambia la red.
  return 'http://192.168.100.247:3001';
};

export const SERVER_URL = getServerUrl();

// HOST_IP mantenido por compatibilidad con otros modulos que lo importen
export const HOST_IP = SERVER_URL.replace('http://', '').split(':')[0];

