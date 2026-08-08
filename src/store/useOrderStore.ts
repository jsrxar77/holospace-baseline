import { create } from 'zustand';
import { Order, OrderItem, ScanLog, ScanResult } from '../types';
import { parsePdfVoucher } from '../services/pdfParser';
import { dbService } from '../db/client';
import { hapticsService } from '../services/hapticsService';
import { audioService } from '../services/audioService';

interface OrderState {
  orders: Order[];
  activeOrder: Order | null;
  isScannerOpen: boolean;
  lastScanToast: {
    type: 'SUCCESS' | 'ERROR' | 'EXCESS';
    message: string;
    code: string;
  } | null;
  lastScanTimestamp: number;

  // Actions
  loadInitialOrders: () => Promise<void>;
  loadPdfOrder: (fileName: string, pdfText?: string) => Promise<Order>;
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
  lastScanToast: null,
  lastScanTimestamp: 0,

  loadInitialOrders: async () => {
    try {
      const savedOrders = await dbService.getAllOrders();
      set({ orders: savedOrders });
    } catch (e) {
      console.log('Error loading initial orders:', e);
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

    const isComplete = activeOrder.totalItemsScanned === activeOrder.totalItemsRequired;
    const isSupervisorOverride = !!supervisorPin && supervisorPin === '9999';

    if (!isComplete && !isSupervisorOverride) {
      await audioService.playErrorBuzzer();
      await hapticsService.notifyError();
      return false;
    }

    const finalStatus = isComplete ? 'CLOSED' : 'PARTIAL_DISPATCH';
    const closedOrder: Order = {
      ...activeOrder,
      status: finalStatus,
      closedAt: new Date().toISOString(),
      supervisorPin: supervisorPin || undefined,
      exceptionReason: exceptionReason || undefined
    };

    await dbService.saveOrder(closedOrder);
    await hapticsService.notifySuccess();

    set((state) => ({
      activeOrder: closedOrder,
      orders: state.orders.map((o) => (o.id === closedOrder.id ? closedOrder : o))
    }));

    return true;
  }
}));
