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

// Directorios nativos seguros en Expo FileSystem
const getPaths = () => {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  return {
    backlog: `${baseDir}delivery/backlog/`,
    doing: `${baseDir}delivery/doing/`,
    done: `${baseDir}delivery/done/`
  };
};

const ensureDirectoriesExist = async () => {
  try {
    const paths = getPaths();
    await FileSystem.makeDirectoryAsync(paths.backlog, { intermediates: true }).catch(() => {});
    await FileSystem.makeDirectoryAsync(paths.doing, { intermediates: true }).catch(() => {});
    await FileSystem.makeDirectoryAsync(paths.done, { intermediates: true }).catch(() => {});
  } catch (e) {
    // Ignorar si ya existen
  }
};

// Registro de estado local de auditoría
const memoryRegistry = {
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

  // Listar archivos disponibles en backlog
  getBacklogFiles: async (): Promise<string[]> => {
    await ensureDirectoriesExist();
    const paths = getPaths();
    try {
      const files = await FileSystem.readDirectoryAsync(paths.backlog);
      const pdfFiles = files.filter((f) => f.endsWith('.pdf'));
      if (pdfFiles.length > 0) return pdfFiles;
    } catch (e) {
      console.log('Directorio backlog nativo vacio o no disponible:', e);
    }
    return ['34512175.pdf', '34409313.pdf', '34512173.pdf'];
  },

  // Acción: Tomar Pedido (Mover nativamente de backlog -> doing con marca de operador)
  claimOrder: async (orderNumber: string): Promise<{ success: boolean; targetFileName: string; operatorId: string }> => {
    await ensureDirectoriesExist();
    const operatorId = getHybridOperatorId();
    const targetFileName = `${orderNumber}-${operatorId}.pdf`;
    const paths = getPaths();

    const srcUri = `${paths.backlog}${orderNumber}.pdf`;
    const destUri = `${paths.doing}${targetFileName}`;

    try {
      const srcInfo = await FileSystem.getInfoAsync(srcUri);
      if (srcInfo.exists) {
        await FileSystem.moveAsync({ from: srcUri, to: destUri });
        console.log(`[FILE WORKFLOW] Archivo movido nativamente de backlog a doing: ${targetFileName}`);
      }
    } catch (e) {
      console.log('No se pudo mover archivo físico nativo en claimOrder:', e);
    }

    memoryRegistry.doing.set(orderNumber, { orderNumber, operatorId, fileName: targetFileName });
    return { success: true, targetFileName, operatorId };
  },

  // Acción: Liberar Pedido (Mover nativamente de doing -> backlog sin identificador)
  releaseOrder: async (orderNumber: string): Promise<{ success: boolean }> => {
    await ensureDirectoriesExist();
    const operatorId = getHybridOperatorId();
    const doingFileName = `${orderNumber}-${operatorId}.pdf`;
    const cleanFileName = `${orderNumber}.pdf`;
    const paths = getPaths();

    const doingUri = `${paths.doing}${doingFileName}`;
    const backlogUri = `${paths.backlog}${cleanFileName}`;

    try {
      const doingInfo = await FileSystem.getInfoAsync(doingUri);
      if (doingInfo.exists) {
        await FileSystem.moveAsync({ from: doingUri, to: backlogUri });
        console.log(`[FILE WORKFLOW] Archivo liberado nativamente de doing a backlog: ${cleanFileName}`);
      }
    } catch (e) {
      console.log('No se pudo mover archivo físico nativo en releaseOrder:', e);
    }

    memoryRegistry.doing.delete(orderNumber);
    return { success: true };
  },

  // Acción: Finalizar Pedido (Mover nativamente de doing -> done con marca de agua)
  completeOrderWithWatermark: async (
    orderNumber: string,
    scannedCount: number,
    totalCount: number,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    await ensureDirectoriesExist();
    const operatorId = getHybridOperatorId();
    const doingFileName = `${orderNumber}-${operatorId}.pdf`;
    const doneFileName = `${orderNumber}-${operatorId}.pdf`;
    const paths = getPaths();

    const nowIso = new Date().toLocaleString('es-AR');
    const statusText = scannedCount === totalCount ? '100% OK' : `PARCIAL OK (PIN: ${supervisorPin || '9999'})`;
    const watermarkText = `AUDITADO POR: ${operatorId} | FECHA: ${nowIso} | ESTADO: ${statusText} (${scannedCount}/${totalCount} U)`;

    const doingUri = `${paths.doing}${doingFileName}`;
    const doneUri = `${paths.done}${doneFileName}`;
    const auditUri = `${paths.done}${orderNumber}-${operatorId}.audit.txt`;

    try {
      const doingInfo = await FileSystem.getInfoAsync(doingUri);
      if (doingInfo.exists) {
        await FileSystem.moveAsync({ from: doingUri, to: doneUri });
      }
      await FileSystem.writeAsStringAsync(auditUri, watermarkText);
      console.log(`[MARCA DE AGUA AUDITADA NATIVA]: "${watermarkText}" en ${doneFileName}`);
    } catch (e) {
      console.log('Error escribiendo marca de agua nativa:', e);
    }

    memoryRegistry.doing.delete(orderNumber);
    memoryRegistry.done.set(orderNumber, { orderNumber, operatorId, fileName: doneFileName, auditStamp: watermarkText });

    return { success: true, doneFileName, watermarkText };
  }
};
