import Constants from 'expo-constants';

/**
 * Configuración global del cliente móvil HoloWare ScanBan Scanner.
 * Auto-detecta dinámicamente la IP de la Mac a través del hostUri de Expo Go.
 */
const getDynamicHostIp = (): string => {
  if (process.env.EXPO_PUBLIC_SERVER_IP) {
    return process.env.EXPO_PUBLIC_SERVER_IP;
  }

  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
    const expUrl = Constants.experienceUrl;
    if (expUrl && expUrl.startsWith('exp://')) {
      const ip = expUrl.replace('exp://', '').split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && ip !== '10.0.2.2') {
        return ip;
      }
    }
  } catch (e) {
    console.log('Error auto-detectando IP desde Expo Constants:', e);
  }
  return '192.168.1.100'; // IP simulada por defecto (evitar localhost en Android)
};

export const HOST_IP = getDynamicHostIp();

export const SERVER_URL = `http://${HOST_IP}:3001`;

