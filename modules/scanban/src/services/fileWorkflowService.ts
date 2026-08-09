import { Order } from '../types';

export interface WorkflowFile {
  orderNumber: string;
  fileName: string;
  folder: 'backlog' | 'doing' | 'done';
  operatorEmail?: string;
}

// URL del Servidor de Archivos y Base de Datos (Mac Host)
const SERVER_URL = 'http://192.168.100.247:3001';

export const fileWorkflowService = {
  // Auto-detectar si el operario (por email) tiene un pedido activo en DB
  getActiveDoingOrder: async (userEmail?: string): Promise<{ hasActive: boolean; orderNumber?: string; pdfFileName?: string; order?: Order }> => {
    try {
      const emailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
      const response = await fetch(`${SERVER_URL}/api/scanban/active-order${emailParam}`);
      const data = await response.json();
      if (data && data.hasActive) {
        console.log(`[AUTO-DETECCIÓN PROCESO] Encontrado pedido activo en DB: #${data.orderNumber} para ${userEmail}`);
        return {
          hasActive: true,
          orderNumber: data.orderNumber,
          pdfFileName: `${data.orderNumber}.pdf`,
          order: data.order
        };
      }
    } catch (e) {
      console.log('Error llamando a auto-detección de active-order:', e);
    }
    return { hasActive: false };
  },

  // Obtener detalle 100% REAL de la orden desde el servidor
  getOrderDetails: async (orderNumber: string): Promise<Order | null> => {
    try {
      const response = await fetch(`${SERVER_URL}/api/scanban/order-detail?orderNumber=${orderNumber}`);
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

  // Guardar avance de escaneo en tiempo real en la base de datos del servidor
  updateScanProgress: async (orderNumber: string, items: any[], totalItemsScanned: number): Promise<boolean> => {
    try {
      await fetch(`${SERVER_URL}/api/scanban/update-scan-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, items, totalItemsScanned })
      });
      return true;
    } catch (e) {
      console.log('Error enviando avance de escaneo al servidor:', e);
    }
    return false;
  },

  // Acción: Tomar Pedido (Cambio de estado a DOING en DB)
  claimOrder: async (orderNumber: string, userEmail?: string): Promise<{ success: boolean; targetFileName: string; order?: Order }> => {
    const targetFileName = `${orderNumber}.pdf`;

    try {
      const response = await fetch(`${SERVER_URL}/api/scanban/claim-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, userEmail })
      });
      const data = await response.json();
      console.log('[BASE DE DATOS] claimOrder estado a DOING:', data);
      if (data && data.order) {
        return { success: true, targetFileName, order: data.order };
      }
    } catch (e) {
      console.log('Error llamando a claimOrder en DB:', e);
    }

    return { success: true, targetFileName };
  },

  // Acción: Liberar Pedido (Cambio de estado a READY en DB)
  releaseOrder: async (orderNumber: string, userEmail?: string): Promise<{ success: boolean }> => {
    try {
      const response = await fetch(`${SERVER_URL}/api/scanban/release-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, userEmail })
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
    userEmail?: string,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    const doneFileName = `${orderNumber}.pdf`;
    const nowIso = new Date().toLocaleString('es-AR');
    const email = userEmail || 'jsrxar@gmail.com';
    const watermarkText = `AUDITADO Y EXPEDIDO POR OPERARIO ${email} | FECHA: ${nowIso} | BULTOS: ${scannedCount}/${totalCount}`;

    try {
      await fetch(`${SERVER_URL}/api/scanban/complete-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, userEmail: email, watermarkText })
      });
    } catch (e) {
      console.log('Error enviando completeOrder al servidor:', e);
    }

    return { success: true, doneFileName, watermarkText };
  }
};
