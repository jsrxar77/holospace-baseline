import { Platform } from 'react-native';

export interface WorkflowFile {
  orderNumber: string;
  fileName: string;
  folder: 'backlog' | 'doing' | 'done';
  operatorId?: string;
}

// Simulador de ID de Dispositivo u Operario (Opción 3: Híbrido JAVIER-DEV82)
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

// Estado en memoria de archivos por carpetas para web/móvil
const fileRegistry = {
  backlog: ['34512175.pdf', '34409313.pdf', '34512173.pdf'],
  doing: new Map<string, { orderNumber: string; operatorId: string; fileName: string }>(),
  done: new Map<string, { orderNumber: string; operatorId: string; fileName: string; auditStamp: string }>()
};

export const fileWorkflowService = {
  getOperatorId: (): string => {
    return getHybridOperatorId();
  },

  setOperatorName: (name: string): void => {
    setOperatorName(name);
  },

  // Obtener pedidos disponibles en backlog
  getBacklogFiles: async (): Promise<string[]> => {
    return [...fileRegistry.backlog];
  },

  // Obtener pedidos en proceso (doing)
  getDoingFiles: async (): Promise<{ orderNumber: string; operatorId: string; fileName: string }[]> => {
    return Array.from(fileRegistry.doing.values());
  },

  // Acción: Tomar Pedido (backlog -> doing)
  claimOrder: async (orderNumber: string): Promise<{ success: boolean; targetFileName: string; operatorId: string }> => {
    const operatorId = getHybridOperatorId();
    const pdfName = fileRegistry.backlog.find((f) => f.includes(orderNumber)) || `${orderNumber}.pdf`;

    // Remover de backlog
    fileRegistry.backlog = fileRegistry.backlog.filter((f) => f !== pdfName);

    // Agregar a doing con la marca (numero-pedido)-(identificador).pdf
    const targetFileName = `${orderNumber}-${operatorId}.pdf`;
    fileRegistry.doing.set(orderNumber, {
      orderNumber,
      operatorId,
      fileName: targetFileName
    });

    console.log(`[WORKFLOW] Pedido ${orderNumber} tomado por ${operatorId}. Mivido a ./delivery/doing/${targetFileName}`);
    return { success: true, targetFileName, operatorId };
  },

  // Acción: Liberar Pedido (doing -> backlog)
  releaseOrder: async (orderNumber: string): Promise<{ success: boolean }> => {
    const doingItem = fileRegistry.doing.get(orderNumber);
    if (!doingItem) {
      return { success: false };
    }

    // Remover de doing
    fileRegistry.doing.delete(orderNumber);

    // Devolver a backlog con el nombre limpio original
    const originalFileName = `${orderNumber}.pdf`;
    if (!fileRegistry.backlog.includes(originalFileName)) {
      fileRegistry.backlog.push(originalFileName);
    }

    console.log(`[WORKFLOW] Pedido ${orderNumber} liberado. Devuelto a ./delivery/backlog/${originalFileName}`);
    return { success: true };
  },

  // Acción: Finalizar Pedido (doing -> done con Marca de Agua)
  completeOrderWithWatermark: async (
    orderNumber: string,
    scannedCount: number,
    totalCount: number,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    const operatorId = getHybridOperatorId();
    const nowIso = new Date().toLocaleString('es-AR');

    // Remover de doing si estaba ahí
    fileRegistry.doing.delete(orderNumber);
    fileRegistry.backlog = fileRegistry.backlog.filter((f) => !f.includes(orderNumber));

    const doneFileName = `${orderNumber}-${operatorId}.pdf`;
    const statusText = scannedCount === totalCount ? '100% OK' : `PARCIAL OK (PIN: ${supervisorPin || '9999'})`;
    const watermarkText = `AUDITADO POR: ${operatorId} | FECHA: ${nowIso} | ESTADO: ${statusText} (${scannedCount}/${totalCount} U)`;

    fileRegistry.done.set(orderNumber, {
      orderNumber,
      operatorId,
      fileName: doneFileName,
      auditStamp: watermarkText
    });

    console.log(`[WORKFLOW] Pedido ${orderNumber} completado y archivado en ./delivery/done/${doneFileName}`);
    console.log(`[MARCA DE AGUA]: "${watermarkText}"`);

    return { success: true, doneFileName, watermarkText };
  }
};
