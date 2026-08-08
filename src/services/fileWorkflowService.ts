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

// URL del Servidor de Archivos Físicos en Disco (Mac Host)
const SERVER_URL = 'http://192.168.100.247:3001';

export const fileWorkflowService = {
  getOperatorId: (): string => {
    return getHybridOperatorId();
  },

  setOperatorName: (name: string): void => {
    setOperatorName(name);
  },

  // Acción: Tomar Pedido (Mover físicamente en el disco duro del Mac de delivery/backlog a delivery/doing)
  claimOrder: async (orderNumber: string): Promise<{ success: boolean; targetFileName: string; operatorId: string }> => {
    const operatorId = getHybridOperatorId();
    const targetFileName = `${orderNumber}-${operatorId}.pdf`;

    try {
      const response = await fetch(`${SERVER_URL}/api/claim-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId })
      });
      const data = await response.json();
      console.log('[MOVIMIENTO FÍSICO REAL EN MAC] claimOrder:', data);
    } catch (e) {
      console.log('Error llamando al servidor de archivos físico:', e);
    }

    return { success: true, targetFileName, operatorId };
  },

  // Acción: Liberar Pedido (Mover físicamente en el disco duro del Mac de delivery/doing a delivery/backlog)
  releaseOrder: async (orderNumber: string): Promise<{ success: boolean }> => {
    const operatorId = getHybridOperatorId();

    try {
      const response = await fetch(`${SERVER_URL}/api/release-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId })
      });
      const data = await response.json();
      console.log('[DEVOLUCIÓN FÍSICA REAL EN MAC] releaseOrder:', data);
    } catch (e) {
      console.log('Error llamando al servidor de archivos físico:', e);
    }

    return { success: true };
  },

  // Acción: Finalizar Pedido (Mover físicamente en el disco duro del Mac de delivery/doing a delivery/done con marca de agua)
  completeOrderWithWatermark: async (
    orderNumber: string,
    scannedCount: number,
    totalCount: number,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    const operatorId = getHybridOperatorId();
    const doneFileName = `${orderNumber}-${operatorId}.pdf`;
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
      console.log('[ARCHIVADO FÍSICO Y MARCA DE AGUA EN MAC] completeOrder:', data);
    } catch (e) {
      console.log('Error llamando al servidor de archivos físico:', e);
    }

    return { success: true, doneFileName, watermarkText };
  }
};
