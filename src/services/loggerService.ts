// Servicio de Registro Unificado de Errores Móviles hacia el Servidor (errors.log / http://localhost:3001/api/error-logs)

const SERVER_URL = 'http://192.168.100.247:3001';

export const loggerService = {
  logError: async (context: string, error: any, extra?: any): Promise<void> => {
    const errorMsg = error ? (error.message || String(error)) : 'Error sin descripción';
    const stackTrace = error && error.stack ? error.stack : '';

    console.error(`[MÓVIL ERROR] Contexto: ${context}`, errorMsg);

    try {
      await fetch(`${SERVER_URL}/api/log-client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'MÓVIL',
          context,
          error: errorMsg,
          stack: stackTrace,
          extra
        })
      });
    } catch (e) {
      console.log('No se pudo transmitir el error móvil al servidor:', e);
    }
  }
};
