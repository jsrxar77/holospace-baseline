import { Order } from '../types';
import { SERVER_URL } from '../config';
import { useAuthStore } from '../store/useAuthStore';

export interface WorkflowFile {
  orderNumber: string;
  fileName: string;
  folder: 'backlog' | 'doing' | 'done';
  operatorEmail?: string;
}

/**
 * Devuelve los headers con Authorization si hay token disponible.
 * Esto garantiza que el backend resuelva el tenant correcto (ej: poke).
 */
function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface DoingOrderSummary {
  id: string;
  uuid: string;
  orderNumber: string;
  clientName: string;
  totalItemsRequired: number;
  totalItemsScanned: number;
  status: string;
}

export const fileWorkflowService = {
  // Obtener todos los pedidos asignados en DOING al operario actual
  getMyDoingOrders: async (userEmail?: string): Promise<DoingOrderSummary[]> => {
    try {
      const emailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
      const response = await fetch(`${SERVER_URL}/api/scanban/my-doing-orders${emailParam}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data && data.success && Array.isArray(data.orders)) {
        return data.orders;
      }
    } catch (e) {
      console.log('Error obteniendo mis pedidos en proceso:', e);
    }
    return [];
  },

  // Auto-detectar o cargar el pedido activo enfocado de escaneo
  getActiveDoingOrder: async (userEmail?: string, orderIdentifier?: string): Promise<{ hasActive: boolean; id?: string; orderNumber?: string; pdfFileName?: string; order?: Order }> => {
    try {
      const params = new URLSearchParams();
      if (userEmail) params.append('userEmail', userEmail);
      if (orderIdentifier) params.append('id', orderIdentifier);
      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await fetch(`${SERVER_URL}/api/scanban/active-order${queryString}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data && data.hasActive) {
        return {
          hasActive: true,
          id: data.id,
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
  getOrderDetails: async (orderId: string, orderNumber?: string): Promise<Order | null> => {
    try {
      const params = new URLSearchParams();
      if (orderId) params.append('id', orderId);
      if (orderNumber) params.append('orderNumber', orderNumber);
      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await fetch(`${SERVER_URL}/api/scanban/order-detail${queryString}`, {
        headers: getAuthHeaders()
      });
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
  updateScanProgress: async (orderId: string, orderNumber: string, items: any[], totalItemsScanned: number, userEmail?: string): Promise<boolean> => {
    try {
      await fetch(`${SERVER_URL}/api/scanban/update-scan-progress`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId, orderNumber, items, totalItemsScanned, userEmail })
      });
      return true;
    } catch (e) {
      console.log('Error enviando avance de escaneo al servidor:', e);
    }
    return false;
  },

  // Acción: Tomar Pedido (Cambio de estado a DOING en DB usando UUID como clave primaria)
  claimOrder: async (orderId: string, orderNumber?: string, userEmail?: string): Promise<{ success: boolean; targetFileName: string; order?: Order }> => {
    const targetFileName = `${orderNumber || orderId}.pdf`;

    try {
      const response = await fetch(`${SERVER_URL}/api/scanban/claim-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId, orderNumber, userEmail })
      });
      if (!response.ok) {
        console.log(`Error en servidor al tomar pedido #${orderNumber || orderId}: HTTP ${response.status}`);
        return { success: false, targetFileName: '' };
      }
      const data = await response.json();
      console.log('[BASE DE DATOS] claimOrder estado a DOING:', data);
      if (data && data.success && data.order) {
        return { success: true, targetFileName, order: data.order };
      }
    } catch (e) {
      console.log('Error llamando a claimOrder en DB:', e);
    }

    return { success: false, targetFileName: '' };
  },

  // Acción: Liberar Pedido (Cambio de estado a READY en DB) — desde operario móvil
  releaseOrder: async (orderId: string, orderNumber?: string, userEmail?: string): Promise<{ success: boolean }> => {
    try {
      const response = await fetch(`${SERVER_URL}/api/scanban/release-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId, orderNumber, userEmail })
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
    orderId: string,
    orderNumber: string,
    scannedCount: number,
    totalCount: number,
    userEmail?: string,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    const doneFileName = `${orderNumber}.pdf`;
    const nowIso = new Date().toLocaleString('es-AR');
    const email = userEmail || 'operario@holospace.com.ar';
    const watermarkText = `AUDITADO Y EXPEDIDO POR OPERARIO ${email} | FECHA: ${nowIso} | BULTOS: ${scannedCount}/${totalCount}`;

    try {
      await fetch(`${SERVER_URL}/api/scanban/complete-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId, orderNumber, userEmail: email, watermarkText })
      });
    } catch (e) {
      console.log('Error enviando completeOrder al servidor:', e);
    }

    return { success: true, doneFileName, watermarkText };
  }
};
