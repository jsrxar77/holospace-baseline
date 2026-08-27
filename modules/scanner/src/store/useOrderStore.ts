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
  myDoingOrders: DoingOrderSummary[];
  activeOrder: Order | null;
  selectedItemId: string | null;
  isScannerOpen: boolean;
  operatorId: string;
  unassignedOrderNotification: string | null;
  lastScanToast: {
    type: 'SUCCESS' | 'ERROR' | 'EXCESS';
    message: string;
    code: string;
  } | null;
  lastScanTimestamp: number;

  // Actions
  loadInitialOrders: () => Promise<void>;
  focusDoingOrder: (orderIdOrNumber: string) => Promise<void>;
  loadPdfOrder: (fileName: string, pdfText?: string) => Promise<Order>;
  claimOrder: (orderId: string, orderNumber?: string) => Promise<Order>;
  releaseOrder: (orderId: string, orderNumber?: string) => Promise<boolean>;
  setActiveOrder: (order: Order | null) => void;
  setSelectedItemId: (id: string | null) => void;
  setScannerOpen: (isOpen: boolean) => void;
  clearUnassignedNotification: () => void;
  scanBarcode: (barcode: string) => Promise<ScanResult>;
  clearToast: () => void;
  closeOrder: (supervisorPin?: string, exceptionReason?: string) => Promise<boolean>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  myDoingOrders: [],
  activeOrder: null,
  selectedItemId: null,
  isScannerOpen: false,
  operatorId: useAuthStore.getState().user?.email || '',
  unassignedOrderNotification: null,
  lastScanToast: null,
  lastScanTimestamp: 0,

  setSelectedItemId: (id: string | null) => set({ selectedItemId: id }),

  clearUnassignedNotification: () => {
    set({ unassignedOrderNotification: null });
  },

  focusDoingOrder: async (orderIdOrNumber: string) => {
    try {
      const currentUserEmail = useAuthStore.getState().user?.email || '';
      const res = await fileWorkflowService.getActiveDoingOrder(currentUserEmail, orderIdOrNumber);
      if (res.hasActive && res.order) {
        await dbService.saveOrder(res.order);
        set({ activeOrder: res.order });
      }
    } catch (e) {
      console.log('Error focusing doing order:', e);
    }
  },

  loadInitialOrders: async () => {
    try {
      const savedOrders = await dbService.getAllOrders();
      const currentUser = useAuthStore.getState().user;
      const currentUserEmail = currentUser?.email || '';

      // Actualizar operatorId en el store
      if (currentUserEmail) {
        set({ operatorId: currentUserEmail });
      }

      // 1. Obtener todos los pedidos asignados a este operario
      const myDoing = currentUserEmail ? await fileWorkflowService.getMyDoingOrders(currentUserEmail) : [];

      // 2. Determinar cuál pedido está en foco
      const currentActive = get().activeOrder;
      let focusedOrder: Order | null = null;
      let unassignedNum: string | null = null;

      if (myDoing.length > 0) {
        const targetId = currentActive && myDoing.some(d => d.id === currentActive.id || d.orderNumber === currentActive.orderNumber)
          ? currentActive.id || currentActive.orderNumber
          : myDoing[0].id || myDoing[0].orderNumber;

        const activeDoing = await fileWorkflowService.getActiveDoingOrder(currentUserEmail, targetId);
        if (activeDoing.hasActive && activeDoing.order) {
          focusedOrder = activeDoing.order;
          await dbService.saveOrder(focusedOrder);
        } else if (currentActive) {
          focusedOrder = currentActive;
        }
      } else {
        // Si myDoing viene vacío, el operario NO tiene pedidos en proceso en el servidor.
        if (currentActive && currentActive.status !== 'CLOSED' && currentActive.status !== 'PARTIAL_DISPATCH') {
          try {
            const serverDetail = await fileWorkflowService.getOrderDetails(currentActive.orderNumber);
            if (serverDetail && serverDetail.status === 'READY') {
              console.log(`[STORE] Pedido #${currentActive.orderNumber} confirmado como liberado a LISTO.`);
              unassignedNum = currentActive.orderNumber;
            } else if (serverDetail && serverDetail.operatorEmail && serverDetail.operatorEmail.toLowerCase() !== currentUserEmail.toLowerCase()) {
              console.log(`[STORE] Pedido #${currentActive.orderNumber} asignado a otro operario (${serverDetail.operatorEmail}).`);
              unassignedNum = currentActive.orderNumber;
            }
          } catch (err) {
            console.log('[STORE] Error validando detalle de orden desasignada:', err);
          }
        }
        focusedOrder = null;
      }

      set({
        orders: savedOrders,
        myDoingOrders: myDoing,
        activeOrder: focusedOrder,
        isScannerOpen: unassignedNum ? false : get().isScannerOpen,
        unassignedOrderNotification: unassignedNum,
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

  // Acción: Tomar Pedido REAL desde la Base de Datos del Servidor usando UUID como clave primaria
  claimOrder: async (orderId: string, orderNumber?: string) => {
    const currentUserEmail = useAuthStore.getState().user?.email || '';
    try {
      const { claimOrder: claimFile } = fileWorkflowService;
      const claimRes = await claimFile(orderId, orderNumber, currentUserEmail);

      if (!claimRes || !claimRes.success || !claimRes.order) {
        throw new Error('No se pudo confirmar la toma del pedido en el servidor.');
      }

      const realOrder = claimRes.order;
      await dbService.saveOrder(realOrder);

      set((state) => ({
        activeOrder: realOrder,
        operatorId: currentUserEmail,
        myDoingOrders: [
          {
            id: realOrder.id,
            uuid: realOrder.uuid || realOrder.id,
            orderNumber: realOrder.orderNumber,
            clientName: realOrder.clientName,
            totalItemsRequired: realOrder.totalItemsRequired,
            totalItemsScanned: realOrder.totalItemsScanned,
            status: realOrder.status
          },
          ...state.myDoingOrders.filter((o) => o.id !== realOrder.id && o.orderNumber !== realOrder.orderNumber)
        ],
        orders: [realOrder, ...state.orders.filter((o) => o.id !== realOrder.id)]
      }));

      return realOrder;
    } catch (e) {
      loggerService.logError('useOrderStore.claimOrder', e, { orderId, orderNumber, currentUserEmail });
      throw e;
    }
  },

  // Acción: Liberar Pedido de /delivery/doing a /delivery/ready
  releaseOrder: async (orderId: string, orderNumber?: string) => {
    const currentUserEmail = useAuthStore.getState().user?.email || '';
    const { releaseOrder: releaseFile } = fileWorkflowService;
    const { success } = await releaseFile(orderId, orderNumber, currentUserEmail);

    if (success) {
      set((state) => ({
        activeOrder: (state.activeOrder?.id === orderId || state.activeOrder?.orderNumber === orderNumber || state.activeOrder?.orderNumber === orderId) ? null : state.activeOrder,
        selectedItemId: null,
        myDoingOrders: state.myDoingOrders.filter((o) => o.id !== orderId && o.orderNumber !== orderNumber && o.orderNumber !== orderId),
        orders: state.orders.filter((o) => o.id !== orderId && o.orderNumber !== orderNumber && o.orderNumber !== orderId)
      }));
      await get().loadInitialOrders();
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
      return 'IGNORED';
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
    const currentUserEmail = useAuthStore.getState().user?.email || '';
    fileWorkflowService.updateScanProgress(activeOrder.id, activeOrder.orderNumber, updatedItems, newTotalScanned, currentUserEmail);

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
      activeOrder.id,
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
