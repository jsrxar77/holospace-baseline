import { create } from 'zustand';
import { Order, OrderItem, ScanLog, ScanResult } from '../types';
import { parsePdfVoucher } from '../services/pdfParser';
import { dbService } from '../db/localDatabase';
import { hapticsService } from '../services/hapticsService';
import { audioService } from '../services/audioService';
import { fileWorkflowService } from '../services/fileWorkflowService';
import { useAuthStore } from './useAuthStore';

import { loggerService } from '../services/loggerService';

interface OrderState {
  orders: Order[];
  activeOrder: Order | null;
  isScannerOpen: boolean;
  operatorId: string;
  lastScanToast: {
    type: 'SUCCESS' | 'ERROR' | 'EXCESS';
    message: string;
    code: string;
  } | null;
  lastScanTimestamp: number;

  // Actions
  loadInitialOrders: () => Promise<void>;
  loadPdfOrder: (fileName: string, pdfText?: string) => Promise<Order>;
  claimOrder: (orderNumber: string) => Promise<Order>;
  releaseOrder: (orderNumber: string) => Promise<boolean>;
  setActiveOrder: (order: Order | null) => void;
  setScannerOpen: (isOpen: boolean) => void;
  scanBarcode: (barcode: string) => Promise<ScanResult>;
  clearToast: () => void;
  closeOrder: (supervisorPin?: string, exceptionReason?: string) => Promise<boolean>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  activeOrder: null,
  isScannerOpen: false,
  operatorId: useAuthStore.getState().user?.email || 'jsrxar@gmail.com',
  lastScanToast: null,
  lastScanTimestamp: 0,

  loadInitialOrders: async () => {
    try {
      const savedOrders = await dbService.getAllOrders();
      const currentUserEmail = useAuthStore.getState().user?.email || 'jsrxar@gmail.com';

      // Auto-detección de pedido activo asignado por email en el servidor
      const activeDoing = await fileWorkflowService.getActiveDoingOrder(currentUserEmail);
      let restoredActiveOrder: Order | null = null;

      if (activeDoing.hasActive && activeDoing.orderNumber) {
        let realOrder = activeDoing.order || (await fileWorkflowService.getOrderDetails(activeDoing.orderNumber));
        if (realOrder) {
          restoredActiveOrder = realOrder;
          await dbService.saveOrder(restoredActiveOrder);
        }
        console.log(`[STORE] Auto-recuperado pedido real #${activeDoing.orderNumber} para ${currentUserEmail}.`);
      } else {
        // Si el servidor informa que ya no posee orden activa (reasignado por Admin a READY), desasignar localmente
        const currentLocalActive = get().activeOrder;
        if (currentLocalActive && currentLocalActive.status !== 'CLOSED' && currentLocalActive.status !== 'PARTIAL_DISPATCH') {
          console.log(`[STORE] Pedido #${currentLocalActive.orderNumber} fue desasignado/reasignado por el Administrador.`);
          restoredActiveOrder = null;
        }
      }

      set({
        orders: savedOrders,
        activeOrder: restoredActiveOrder !== null ? restoredActiveOrder : (activeDoing.hasActive ? get().activeOrder : null),
        operatorId: currentUserEmail
      });
    } catch (e) {
      console.log('Error loading initial orders:', e);
      loggerService.logError('useOrderStore.loadInitialOrders', e);
    }
  },

  loadPdfOrder: async (fileName: string, pdfText?: string) => {
    const order = await parsePdfVoucher(fileName, pdfText);
    await dbService.saveOrder(order);
    
    set((state) => ({
      activeOrder: order,
      orders: [order, ...state.orders.filter((o) => o.id !== order.id)]
    }));

    return order;
  },

  // Acción: Tomar Pedido REAL desde la Base de Datos del Servidor usando Email
  claimOrder: async (orderNumber: string) => {
    const currentUserEmail = useAuthStore.getState().user?.email || 'jsrxar@gmail.com';
    try {
      const { claimOrder: claimFile } = fileWorkflowService;
      const { targetFileName, order: serverOrder } = await claimFile(orderNumber, currentUserEmail);

      // Obtener la orden real con sus ítems reales parsed del servidor
      let realOrder = serverOrder || (await fileWorkflowService.getOrderDetails(orderNumber));

      if (!realOrder) {
        const parsed = await parsePdfVoucher(targetFileName);
        realOrder = {
          ...parsed,
          orderNumber,
          pdfFileName: targetFileName,
          status: 'SCANNING'
        };
      }

      await dbService.saveOrder(realOrder);

      set((state) => ({
        activeOrder: realOrder,
        operatorId: currentUserEmail,
        orders: [realOrder, ...state.orders.filter((o) => o.id !== realOrder.id)]
      }));

      return realOrder;
    } catch (e) {
      loggerService.logError('useOrderStore.claimOrder', e, { orderNumber, currentUserEmail });
      throw e;
    }
  },

  // Acción: Liberar Pedido de /delivery/doing a /delivery/ready
  releaseOrder: async (orderNumber: string) => {
    const currentUserEmail = useAuthStore.getState().user?.email || 'jsrxar@gmail.com';
    const { releaseOrder: releaseFile } = fileWorkflowService;
    const { success } = await releaseFile(orderNumber, currentUserEmail);

    if (success) {
      set((state) => ({
        activeOrder: state.activeOrder?.orderNumber === orderNumber ? null : state.activeOrder,
        orders: state.orders.filter((o) => o.orderNumber !== orderNumber)
      }));
    }

    return success;
  },

  setActiveOrder: (order) => set({ activeOrder: order }),

  setScannerOpen: (isOpen) => set({ isScannerOpen: isOpen }),

  clearToast: () => set({ lastScanToast: null }),

  scanBarcode: async (barcode: string): Promise<ScanResult> => {
    const { activeOrder, lastScanTimestamp } = get();
    const now = Date.now();

    // Debounce de 500ms para evitar lecturas repetidas en ráfaga
    if (now - lastScanTimestamp < 500) {
      return 'SUCCESS';
    }

    if (!activeOrder) {
      return 'UNMATCHED_CODE';
    }

    set({ lastScanTimestamp: now });

    const trimmedBarcode = barcode.trim();
    const matchedItem = activeOrder.items.find((item) => item.code === trimmedBarcode);

    // Scenario A: Código NO pertenece al pedido
    if (!matchedItem) {
      await audioService.playErrorBuzzer();
      await hapticsService.notifyError();

      const log: ScanLog = {
        id: `log_${now}`,
        orderId: activeOrder.id,
        barcodeScanned: trimmedBarcode,
        timestamp: new Date().toISOString(),
        result: 'UNMATCHED_CODE'
      };
      await dbService.logScan(log);

      set({
        lastScanToast: {
          type: 'ERROR',
          message: '¡CÓDIGO NO PERTENECE AL PEDIDO!',
          code: trimmedBarcode
        }
      });

      return 'UNMATCHED_CODE';
    }

    // Scenario B: Sobre-escaneo / Cantidad ya completada
    if (matchedItem.quantityScanned >= matchedItem.quantityRequired) {
      await audioService.playErrorBuzzer();
      await hapticsService.notifyError();

      const log: ScanLog = {
        id: `log_${now}`,
        orderId: activeOrder.id,
        barcodeScanned: trimmedBarcode,
        timestamp: new Date().toISOString(),
        result: 'EXCESS_QUANTITY',
        matchedItemId: matchedItem.id
      };
      await dbService.logScan(log);

      set({
        lastScanToast: {
          type: 'EXCESS',
          message: '¡CANTIDAD YA COMPLETADA PARA ESTE ÍTEM!',
          code: `${matchedItem.description} (${matchedItem.quantityScanned}/${matchedItem.quantityRequired})`
        }
      });

      return 'EXCESS_QUANTITY';
    }

    // Scenario C: Coincidencia Exitosa
    const updatedItems = activeOrder.items.map((item) => {
      if (item.id === matchedItem.id) {
        const newScanned = item.quantityScanned + 1;
        return {
          ...item,
          quantityScanned: newScanned,
          status: (newScanned === item.quantityRequired ? 'COMPLETED' : 'IN_PROGRESS') as any
        };
      }
      return item;
    });

    const newTotalScanned = activeOrder.totalItemsScanned + 1;
    const is100Percent = newTotalScanned === activeOrder.totalItemsRequired;
    const newOrderStatus = is100Percent ? 'VERIFIED' : 'SCANNING';

    const updatedOrder: Order = {
      ...activeOrder,
      totalItemsScanned: newTotalScanned,
      status: newOrderStatus,
      items: updatedItems
    };

    await audioService.playSuccessBeep();
    await hapticsService.notifySuccess();

    const log: ScanLog = {
      id: `log_${now}`,
      orderId: activeOrder.id,
      barcodeScanned: trimmedBarcode,
      timestamp: new Date().toISOString(),
      result: 'SUCCESS',
      matchedItemId: matchedItem.id
    };
    await dbService.logScan(log);
    await dbService.saveOrder(updatedOrder);

    // Enviar avance de escaneo al servidor en tiempo real para persistencia permanente
    fileWorkflowService.updateScanProgress(activeOrder.orderNumber, updatedItems, newTotalScanned);

    set((state) => ({
      activeOrder: updatedOrder,
      orders: state.orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      lastScanToast: {
        type: 'SUCCESS',
        message: `¡CÓDIGO CORRECTO! +1 (${matchedItem.description})`,
        code: `${newTotalScanned}/${activeOrder.totalItemsRequired}`
      }
    }));

    return 'SUCCESS';
  },

  closeOrder: async (supervisorPin?: string, exceptionReason?: string): Promise<boolean> => {
    const { activeOrder } = get();
    if (!activeOrder) return false;

    const currentUserEmail = useAuthStore.getState().user?.email || 'jsrxar@gmail.com';
    const isComplete = activeOrder.totalItemsScanned === activeOrder.totalItemsRequired;
    const isSupervisorOverride = !!supervisorPin && supervisorPin === '9999';

    if (!isComplete && !isSupervisorOverride) {
      await audioService.playErrorBuzzer();
      await hapticsService.notifyError();
      return false;
    }

    const { completeOrderWithWatermark } = fileWorkflowService;
    const finalStatus = isComplete ? 'CLOSED' : 'PARTIAL_DISPATCH';
    const { watermarkText } = await completeOrderWithWatermark(
      activeOrder.orderNumber,
      activeOrder.totalItemsScanned,
      activeOrder.totalItemsRequired,
      currentUserEmail,
      supervisorPin
    );

    const closedOrder: Order = {
      ...activeOrder,
      status: finalStatus,
      auditStamp: watermarkText
    };

    await dbService.saveOrder(closedOrder);

    set((state) => ({
      activeOrder: null,
      orders: state.orders.map((o) => (o.id === closedOrder.id ? closedOrder : o))
    }));

    return true;
  }
}));
