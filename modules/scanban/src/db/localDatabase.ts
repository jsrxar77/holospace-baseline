import { Platform } from 'react-native';
import { Order, OrderItem, ScanLog } from '../types';

// En la web usamos almacenamiento en memoria o localStorage
const memoryOrders: Map<string, Order> = new Map();
const memoryLogs: ScanLog[] = [];

let dbInstance: any = null;

export const getDb = async () => {
  if (Platform.OS === 'web') {
    return null;
  }
  const SQLite = require('expo-sqlite');
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('holospace.db');
    await initTables(dbInstance);
  }
  return dbInstance;
};

const initTables = async (db: any) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      orderNumber TEXT NOT NULL,
      clientName TEXT NOT NULL,
      issueDate TEXT NOT NULL,
      pdfFileName TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      closedAt TEXT,
      totalItemsRequired INTEGER NOT NULL,
      totalItemsScanned INTEGER NOT NULL,
      exceptionReason TEXT,
      supervisorPin TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY NOT NULL,
      orderId TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      quantityRequired INTEGER NOT NULL,
      quantityScanned INTEGER NOT NULL,
      unitPrice REAL,
      status TEXT NOT NULL,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_logs (
      id TEXT PRIMARY KEY NOT NULL,
      orderId TEXT NOT NULL,
      barcodeScanned TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      result TEXT NOT NULL,
      matchedItemId TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);
};

export const dbService = {
  saveOrder: async (order: Order): Promise<void> => {
    if (Platform.OS === 'web') {
      memoryOrders.set(order.id, JSON.parse(JSON.stringify(order)));
      return;
    }

    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO orders (id, orderNumber, clientName, issueDate, pdfFileName, status, createdAt, closedAt, totalItemsRequired, totalItemsScanned, exceptionReason, supervisorPin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.orderNumber,
        order.clientName,
        order.issueDate,
        order.pdfFileName,
        order.status,
        order.createdAt,
        order.closedAt || null,
        order.totalItemsRequired,
        order.totalItemsScanned,
        order.exceptionReason || null,
        order.supervisorPin || null
      ]
    );

    for (const item of order.items) {
      const itemId = item.id || `item_${order.orderNumber}_${item.code}`;
      await db.runAsync(
        `INSERT OR REPLACE INTO order_items (id, orderId, code, description, quantityRequired, quantityScanned, unitPrice, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          order.id,
          item.code,
          item.description,
          item.quantityRequired,
          item.quantityScanned || 0,
          item.unitPrice || 0,
          item.status || 'PENDING'
        ]
      );
    }
  },

  getAllOrders: async (): Promise<Order[]> => {
    if (Platform.OS === 'web') {
      return Array.from(memoryOrders.values());
    }

    const db = await getDb();
    const rows: any[] = await db.getAllAsync(`SELECT * FROM orders ORDER BY createdAt DESC`);
    const orders: Order[] = [];

    for (const row of rows) {
      const items: OrderItem[] = await db.getAllAsync(`SELECT * FROM order_items WHERE orderId = ?`, [row.id]);
      orders.push({
        ...row,
        items
      });
    }

    return orders;
  },

  logScan: async (log: ScanLog): Promise<void> => {
    if (Platform.OS === 'web') {
      memoryLogs.push(log);
      return;
    }

    const db = await getDb();
    await db.runAsync(
      `INSERT INTO scan_logs (id, orderId, barcodeScanned, timestamp, result, matchedItemId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [log.id, log.orderId, log.barcodeScanned, log.timestamp, log.result, log.matchedItemId || null]
    );
  }
};

