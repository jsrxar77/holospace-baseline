import * as FileSystem from 'expo-file-system/legacy';

export interface WorkflowFile {
  orderNumber: string;
  fileName: string;
  folder: 'backlog' | 'doing' | 'done';
  operatorId?: string;
}

// Identificador Híbrido por defecto (Opción 3: JAVIER-DEV82)
let currentOperatorName = 'JAVIER';
let currentDeviceId = 'DEV82';

export const getHybridOperatorId = (): string => {
  return `${currentOperatorName}-${currentDeviceId}`;
};

export const setOperatorName = (name: string) => {
  if (name && name.trim()) {
    currentOperatorName = name.trim().toUpperCase().replace(/\s+/g, '');
  }
};

// URL del Servidor de Archivos y Base de Datos (Mac Host)
const SERVER_URL = 'http://192.168.100.247:3001';

export const fileWorkflowService = {
  getOperatorId: (): string => {
    return getHybridOperatorId();
  },

  setOperatorName: (name: string): void => {
    setOperatorName(name);
  },

  // Auto-detectar si el operario tiene un pedido activo en DB
  getActiveDoingOrder: async (): Promise<{ hasActive: boolean; orderNumber?: string; pdfFileName?: string }> => {
    const operatorId = getHybridOperatorId();
    try {
      const response = await fetch(`${SERVER_URL}/api/active-order?operatorId=${operatorId}`);
      const data = await response.json();
      if (data && data.hasActive) {
        console.log(`[AUTO-DETECCIÓN PROCESO] Encontrado pedido activo en DB: #${data.orderNumber}`);
        return { hasActive: true, orderNumber: data.orderNumber, pdfFileName: `${data.orderNumber}.pdf` };
      }
    } catch (e) {
      console.log('Error llamando a auto-detección de active-order:', e);
    }
    return { hasActive: false };
  },

  // Acción: Tomar Pedido (Cambio de estado a DOING en DB)
  claimOrder: async (orderNumber: string): Promise<{ success: boolean; targetFileName: string; operatorId: string }> => {
    const operatorId = getHybridOperatorId();
    const targetFileName = `${orderNumber}.pdf`;

    try {
      const response = await fetch(`${SERVER_URL}/api/claim-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId })
      });
      const data = await response.json();
      console.log('[BASE DE DATOS] claimOrder estado a DOING:', data);
    } catch (e) {
      console.log('Error llamando a claimOrder en DB:', e);
    }

    return { success: true, targetFileName, operatorId };
  },

  // Acción: Liberar Pedido (Cambio de estado a BACKLOG en DB)
  releaseOrder: async (orderNumber: string): Promise<{ success: boolean }> => {
    const operatorId = getHybridOperatorId();

    try {
      const response = await fetch(`${SERVER_URL}/api/release-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId })
      });
      const data = await response.json();
      console.log('[BASE DE DATOS] releaseOrder estado a BACKLOG:', data);
    } catch (e) {
      console.log('Error llamando a releaseOrder en DB:', e);
    }

    return { success: true };
  },

  // Acción: Finalizar Pedido (Cambio de estado a DONE en DB con Marca de Agua)
  completeOrderWithWatermark: async (
    orderNumber: string,
    scannedCount: number,
    totalCount: number,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    const operatorId = getHybridOperatorId();
    const doneFileName = `${orderNumber}.pdf`;
    const nowIso = new Date().toLocaleString('es-AR');
    const statusText = scannedCount === totalCount ? '100% OK' : `PARCIAL OK (PIN: ${supervisorPin || '9999'})`;
    const watermarkText = `AUDITADO POR: ${operatorId} | FECHA: ${nowIso} | ESTADO: ${statusText} (${scannedCount}/${totalCount} U)`;

    try {
      const response = await fetch(`${SERVER_URL}/api/complete-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId, watermarkText })
      });
      const data = await response.json();
      console.log('[BASE DE DATOS] completeOrder estado a DONE:', data);
    } catch (e) {
      console.log('Error llamando a completeOrder en DB:', e);
    }

    return { success: true, doneFileName, watermarkText };
  }
};
