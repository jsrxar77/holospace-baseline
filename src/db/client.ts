import * as SQLite from 'expo-sqlite';
import { Order, OrderItem, ScanLog } from '../types';

// Singleton DB helper for Phone-Ware SQLite Storage
const DB_NAME = 'phoneware.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await initTables(dbInstance);
  }
  return dbInstance;
};

const initTables = async (db: SQLite.SQLiteDatabase) => {
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
      await db.runAsync(
        `INSERT OR REPLACE INTO order_items (id, orderId, code, description, quantityRequired, quantityScanned, unitPrice, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.orderId,
          item.code,
          item.description,
          item.quantityRequired,
          item.quantityScanned,
          item.unitPrice || null,
          item.status
        ]
      );
    }
  },

  getAllOrders: async (): Promise<Order[]> => {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(`SELECT * FROM orders ORDER BY createdAt DESC`);
    const orders: Order[] = [];

    for (const row of rows) {
      const items = await db.getAllAsync<OrderItem>(`SELECT * FROM order_items WHERE orderId = ?`, [row.id]);
      orders.push({
        ...row,
        items
      });
    }

    return orders;
  },

  logScan: async (log: ScanLog): Promise<void> => {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO scan_logs (id, orderId, barcodeScanned, timestamp, result, matchedItemId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [log.id, log.orderId, log.barcodeScanned, log.timestamp, log.result, log.matchedItemId || null]
    );
  }
};
