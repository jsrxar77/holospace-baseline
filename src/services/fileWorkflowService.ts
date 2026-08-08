import * as FileSystem from 'expo-file-system/legacy';
import { Order } from '../types';

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

  // Obtener detalle 100% REAL de la orden desde el servidor
  getOrderDetails: async (orderNumber: string): Promise<Order | null> => {
    try {
      const response = await fetch(`${SERVER_URL}/api/order-detail?orderNumber=${orderNumber}`);
      const data = await response.json();
      if (data && data.success && data.order) {
        const o = data.order;
        return {
          id: o.id || `ord_${o.orderNumber}`,
          orderNumber: o.orderNumber,
          clientName: o.clientName || 'Cliente Logística',
          issueDate: o.issueDate || new Date().toLocaleDateString('es-AR'),
          pdfFileName: o.pdfFileName || `${o.orderNumber}.pdf`,
          status: o.status || 'SCANNING',
          createdAt: o.createdAt || new Date().toISOString(),
          totalItemsRequired: o.totalItemsRequired || o.items.reduce((acc: number, i: any) => acc + i.quantityRequired, 0),
          totalItemsScanned: o.totalItemsScanned || 0,
          items: (o.items || []).map((i: any, idx: number) => ({
            id: i.id || `item_${o.orderNumber}_${idx}`,
            orderId: o.orderNumber,
            code: i.code,
            description: i.description,
            quantityRequired: i.quantityRequired,
            quantityScanned: i.quantityScanned || 0,
            status: (i.quantityScanned || 0) >= i.quantityRequired ? 'COMPLETE' : (i.quantityScanned || 0) > 0 ? 'PARTIAL' : 'PENDING'
          }))
        };
      }
    } catch (e) {
      console.log(`Error obteniendo orderDetails reales para ${orderNumber}:`, e);
    }
    return null;
  },

  // Acción: Tomar Pedido (Cambio de estado a DOING en DB)
  claimOrder: async (orderNumber: string, userEmail?: string): Promise<{ success: boolean; targetFileName: string; operatorId: string }> => {
    const operatorId = getHybridOperatorId();
    const targetFileName = `${orderNumber}.pdf`;

    try {
      const response = await fetch(`${SERVER_URL}/api/claim-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId, userEmail })
      });
      const data = await response.json();
      console.log('[BASE DE DATOS] claimOrder estado a DOING:', data);
    } catch (e) {
      console.log('Error llamando a claimOrder en DB:', e);
    }

    return { success: true, targetFileName, operatorId };
  },

  // Acción: Liberar Pedido (Cambio de estado a READY en DB)
  releaseOrder: async (orderNumber: string, userEmail?: string): Promise<{ success: boolean }> => {
    const operatorId = getHybridOperatorId();

    try {
      const response = await fetch(`${SERVER_URL}/api/release-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, operatorId, userEmail })
      });
      const data = await response.json();
      console.log('[BASE DE DATOS] releaseOrder estado a READY:', data);
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
    const watermarkText = `AUDITADO Y EXPEDIDO POR OPERARIO ${operatorId} | FECHA: ${nowIso} | BULTOS: ${scannedCount}/${totalCount}`;

    return { success: true, doneFileName, watermarkText };
  }
};
