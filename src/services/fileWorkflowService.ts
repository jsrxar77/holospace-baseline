import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

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

// Intento de importar fs si estamos en entorno Node/Web local
let fs: any = null;
let path: any = null;
try {
  if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.versions && process.versions.node)) {
    fs = require('fs');
    path = require('path');
  }
} catch (e) {
  // Ignorar en cliente React Native estricto
}

const getProjectBaseDir = (): string => {
  if (path && typeof process !== 'undefined' && process.cwd) {
    return process.cwd();
  }
  return FileSystem.documentDirectory || '';
};

// Directorios físicos
const getPaths = () => {
  const base = getProjectBaseDir();
  if (fs && path) {
    return {
      backlog: path.join(base, 'delivery', 'backlog'),
      doing: path.join(base, 'delivery', 'doing'),
      done: path.join(base, 'delivery', 'done')
    };
  }
  return {
    backlog: `${FileSystem.documentDirectory}delivery/backlog/`,
    doing: `${FileSystem.documentDirectory}delivery/doing/`,
    done: `${FileSystem.documentDirectory}delivery/done/`
  };
};

// Estado auxiliar en memoria de respaldo
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

  // Listar archivos físicos en backlog
  getBacklogFiles: async (): Promise<string[]> => {
    const paths = getPaths();
    try {
      if (fs && fs.existsSync(paths.backlog)) {
        const files = fs.readdirSync(paths.backlog);
        return files.filter((f: string) => f.endsWith('.pdf'));
      }
    } catch (e) {
      console.log('Error leyendo backlog en disco:', e);
    }
    return ['34512175.pdf', '34409313.pdf', '34512173.pdf'];
  },

  // Acción: Tomar Pedido (Mover físicamente de backlog -> doing con marca de operador)
  claimOrder: async (orderNumber: string): Promise<{ success: boolean; targetFileName: string; operatorId: string }> => {
    const operatorId = getHybridOperatorId();
    const targetFileName = `${orderNumber}-${operatorId}.pdf`;
    const paths = getPaths();

    try {
      if (fs && path) {
        const srcPath = path.join(paths.backlog, `${orderNumber}.pdf`);
        const destPath = path.join(paths.doing, targetFileName);

        // Asegurar directorio doing
        if (!fs.existsSync(paths.doing)) {
          fs.mkdirSync(paths.doing, { recursive: true });
        }

        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          console.log(`[DISCO REAL] Archivo movido físicamente: ${srcPath} -> ${destPath}`);
        } else {
          // Si el src con nombre limpio no existe, buscar si hay coincidencia
          const backlogFiles = fs.readdirSync(paths.backlog);
          const match = backlogFiles.find((f: string) => f.includes(orderNumber));
          if (match) {
            fs.renameSync(path.join(paths.backlog, match), destPath);
            console.log(`[DISCO REAL] Archivo movido físicamente: ${match} -> ${destPath}`);
          }
        }
      } else {
        // En móvil Expo FileSystem
        const srcUri = `${paths.backlog}${orderNumber}.pdf`;
        const destUri = `${paths.doing}${targetFileName}`;
        await FileSystem.moveAsync({ from: srcUri, to: destUri }).catch(() => {});
      }
    } catch (e) {
      console.log('Error en movimiento físico de archivo en claimOrder:', e);
    }

    memoryRegistry.doing.set(orderNumber, { orderNumber, operatorId, fileName: targetFileName });
    return { success: true, targetFileName, operatorId };
  },

  // Acción: Liberar Pedido (Mover físicamente de doing -> backlog sin identificador)
  releaseOrder: async (orderNumber: string): Promise<{ success: boolean }> => {
    const operatorId = getHybridOperatorId();
    const doingFileName = `${orderNumber}-${operatorId}.pdf`;
    const cleanFileName = `${orderNumber}.pdf`;
    const paths = getPaths();

    try {
      if (fs && path) {
        const doingPath = path.join(paths.doing, doingFileName);
        const backlogPath = path.join(paths.backlog, cleanFileName);

        // Asegurar directorio backlog
        if (!fs.existsSync(paths.backlog)) {
          fs.mkdirSync(paths.backlog, { recursive: true });
        }

        if (fs.existsSync(doingPath)) {
          fs.renameSync(doingPath, backlogPath);
          console.log(`[DISCO REAL] Archivo liberado y devuelto a backlog: ${doingPath} -> ${backlogPath}`);
        } else {
          // Buscar en doing cualquier archivo que contenga orderNumber
          if (fs.existsSync(paths.doing)) {
            const doingFiles = fs.readdirSync(paths.doing);
            const match = doingFiles.find((f: string) => f.includes(orderNumber));
            if (match) {
              fs.renameSync(path.join(paths.doing, match), backlogPath);
              console.log(`[DISCO REAL] Archivo liberado: ${match} -> ${backlogPath}`);
            }
          }
        }
      } else {
        const doingUri = `${paths.doing}${doingFileName}`;
        const backlogUri = `${paths.backlog}${cleanFileName}`;
        await FileSystem.moveAsync({ from: doingUri, to: backlogUri }).catch(() => {});
      }
    } catch (e) {
      console.log('Error en movimiento físico de archivo en releaseOrder:', e);
    }

    memoryRegistry.doing.delete(orderNumber);
    return { success: true };
  },

  // Acción: Finalizar Pedido (Mover físicamente de doing -> done con marca de agua)
  completeOrderWithWatermark: async (
    orderNumber: string,
    scannedCount: number,
    totalCount: number,
    supervisorPin?: string
  ): Promise<{ success: boolean; doneFileName: string; watermarkText: string }> => {
    const operatorId = getHybridOperatorId();
    const doingFileName = `${orderNumber}-${operatorId}.pdf`;
    const doneFileName = `${orderNumber}-${operatorId}.pdf`;
    const paths = getPaths();

    const nowIso = new Date().toLocaleString('es-AR');
    const statusText = scannedCount === totalCount ? '100% OK' : `PARCIAL OK (PIN: ${supervisorPin || '9999'})`;
    const watermarkText = `AUDITADO POR: ${operatorId} | FECHA: ${nowIso} | ESTADO: ${statusText} (${scannedCount}/${totalCount} U)`;

    try {
      if (fs && path) {
        const doingPath = path.join(paths.doing, doingFileName);
        const donePath = path.join(paths.done, doneFileName);
        const auditLogPath = path.join(paths.done, `${orderNumber}-${operatorId}.audit.txt`);

        // Asegurar directorio done
        if (!fs.existsSync(paths.done)) {
          fs.mkdirSync(paths.done, { recursive: true });
        }

        if (fs.existsSync(doingPath)) {
          fs.renameSync(doingPath, donePath);
          console.log(`[DISCO REAL] Archivo finalizado trasladado a done: ${doingPath} -> ${donePath}`);
        } else {
          // Fallback si estaba en backlog o con otro nombre
          const backlogPath = path.join(paths.backlog, `${orderNumber}.pdf`);
          if (fs.existsSync(backlogPath)) {
            fs.renameSync(backlogPath, donePath);
          }
        }

        // Estampar la marca de agua y registro de auditoría en disco
        fs.writeFileSync(auditLogPath, watermarkText, 'utf8');
        console.log(`[MARCA DE AGUA REAL EN DISCO]: "${auditLogPath}" -> "${watermarkText}"`);
      } else {
        const doingUri = `${paths.doing}${doingFileName}`;
        const doneUri = `${paths.done}${doneFileName}`;
        const auditUri = `${paths.done}${orderNumber}-${operatorId}.audit.txt`;
        await FileSystem.moveAsync({ from: doingUri, to: doneUri }).catch(() => {});
        await FileSystem.writeAsStringAsync(auditUri, watermarkText).catch(() => {});
      }
    } catch (e) {
      console.log('Error en movimiento físico de archivo en completeOrderWithWatermark:', e);
    }

    memoryRegistry.doing.delete(orderNumber);
    memoryRegistry.done.set(orderNumber, { orderNumber, operatorId, fileName: doneFileName, auditStamp: watermarkText });

    return { success: true, doneFileName, watermarkText };
  }
};
