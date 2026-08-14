import Constants from 'expo-constants';

/**
 * Configuración global del cliente móvil HoloWare ScanBan Scanner.
 * Auto-detecta dinámicamente la IP de la Mac a través del hostUri de Expo Go.
 */
const getDynamicHostIp = (): string => {
  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch (e) {
    console.log('Error auto-detectando IP desde Expo Constants:', e);
  }
  return '127.0.0.1';
};

export const HOST_IP = getDynamicHostIp();

export const SERVER_URL = `http://${HOST_IP}:3001`;

