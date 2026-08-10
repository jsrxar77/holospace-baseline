const http = require('http');
const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist');
const Database = require('better-sqlite3');

// Leer variables de entorno desde .env
let processEnv = {
  HW_PORT: process.env.HW_PORT || process.env.PORT || '3001'
};

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key && val) {
        processEnv[key] = val;
      }
    }
  });
}

const PORT = parseInt(processEnv.HW_PORT || processEnv.PORT, 10) || 3001;

// BASE DE DATOS SQLITE RELACIONAL Y PERSISTENTE EN ./data/holoware.db
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'holoware.db');
const ERROR_LOG_PATH = path.join(DATA_DIR, 'errors.log');

// Sistema de Registro de Errores Detallados en Consola y Archivo ./data/errors.log
function logDetailedError(context, err, payload = {}) {
  const timestamp = new Date().toLocaleString('es-AR');
  const errorMessage = err ? (err.message || String(err)) : 'Error sin descripción';
  const stackTrace = err && err.stack ? err.stack : 'No hay stack trace disponible';

  const logEntry = `
======================================================
[ERROR DETALLADO - ${timestamp}]
Contexto / Ruta: ${context}
Usuario: ${payload.userEmail || payload.email || 'No especificado'}
Error: ${errorMessage}
Payload Contexto: ${JSON.stringify(payload, null, 2)}
Stack Trace:
${stackTrace}
======================================================
`;

  console.error(logEntry);
  try {
    fs.appendFileSync(ERROR_LOG_PATH, logEntry, 'utf8');
  } catch (e) {
    console.error('Error escribiendo en log de archivo:', e);
  }

  return {
    timestamp,
    context,
    error: errorMessage,
    details: payload,
    stackTrace
  };
}
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Auto-Migración de Esquema: recrear tablas si la estructura relacional legada no posee orderId
try {
  const tableInfo = db.prepare("PRAGMA table_info(order_items)").all();
  const hasOrderId = tableInfo.some(col => col.name === 'orderId');
  if (!hasOrderId && tableInfo.length > 0) {
    console.log('⚡ Migrando esquema relacional SQLite a Claves Primarias Subrogadas (orderId)...');
    db.exec('DROP TABLE IF EXISTS audit_logs; DROP TABLE IF EXISTS order_items; DROP TABLE IF EXISTS orders;');
  }
} catch (e) {
  console.error('Error verificando esquema relacional:', e);
}

// Inicializar tablas en la base de datos relacional SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    orderNumber TEXT NOT NULL,
    clientName TEXT NOT NULL,
    issueDate TEXT NOT NULL,
    pdfFileName TEXT NOT NULL,
    pdfBlob TEXT NOT NULL,
    status TEXT NOT NULL,
    operatorEmail TEXT,
    totalItemsRequired INTEGER NOT NULL,
    totalItemsScanned INTEGER NOT NULL DEFAULT 0,
    auditStamp TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unitPrice REAL DEFAULT 0.0,
    quantityRequired INTEGER NOT NULL,
    quantityScanned INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- =============================================
  -- HOLOWARE BASELINE CORE PLATFORM TABLES
  -- =============================================

  -- Audit log for platform-level events (theme changes, module toggles, etc.)
  CREATE TABLE IF NOT EXISTS platform_audit_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    action    TEXT NOT NULL,
    details   TEXT NOT NULL
  );

  -- Module registry: catalog of available modules and their active state
  CREATE TABLE IF NOT EXISTS modules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    active      INTEGER NOT NULL DEFAULT 0,
    activatedBy TEXT,
    activatedAt TEXT
  );
`);

// Inicializar el tema en SQLite (app_settings) como única fuente de verdad
const initTheme = () => {
  const existing = db.prepare("SELECT value FROM app_settings WHERE key = 'active_theme'").get();
  if (!existing) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('active_theme', ?)").run('original');
  }
};

// Inicializar el registro oficial de módulos del sistema
const initModules = () => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO modules (key, name, description, active, activatedBy, activatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();

  // 1. HoloWare Core (Web - Plataforma Base - SUPERADMIN)
  stmt.run('core', 'HoloWare Core', 'Plataforma base: Gestión de usuarios, gobierno de módulos, auditoría y motor de temas.', 1, 'system', now);

  // 2. HoloWare ScanBan Board (Web - Kanban & Facturación - ADMIN)
  stmt.run('scanban-board', 'HoloWare ScanBan Board', 'Módulo Web de logística: Tablero Kanban 4 columnas, parseo PDF y explorador.', 1, 'system', now);

  // 3. HoloWare ScanBan Scanner (Mobile - Escáner EAN-13 - OPERATOR)
  stmt.run('scanban-scanner', 'HoloWare ScanBan Scanner', 'Módulo Móvil Expo: Escáner de códigos de barra EAN-13 y auditoría de despacho.', 1, 'system', now);
};

// Inicialización de Usuarios: SuperAdmin desde .env + Usuarios de Semilla para Desarrollo
const initUsers = () => {
  const superAdminEmail = (processEnv.SUPERADMIN_EMAIL || 'superadmin@hologrowth.com.ar').toLowerCase().trim();
  const superAdminPassword = processEnv.SUPERADMIN_PASSWORD || 'BrunaSeRelambe22!';

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO users (email, password, name, role, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  // 1. SuperAdmin de Plataforma (Bootstrap desde .env)
  stmt.run(superAdminEmail, superAdminPassword, 'Super Administrador', 'SUPERADMIN');

  // 2. Usuarios de Prueba / Semilla para Desarrollo
  db.prepare(`INSERT OR IGNORE INTO users (email, password, name, role, active) VALUES (?, ?, ?, ?, 1)`)
    .run('admin@drinklovers.com.ar', 'drinklovers2026!', 'Administrador Principal', 'ADMIN');
  db.prepare(`INSERT OR IGNORE INTO users (email, password, name, role, active) VALUES (?, ?, ?, ?, 1)`)
    .run('jsrxar@gmail.com', 'Asadito21!', 'Javier Rizzo', 'OPERATOR');
};

initUsers();
initTheme();
initModules();

// Helper para obtener una orden completa estructurada desde SQLite por ID, UUID o orderNumber
function getFullOrderFromDb(identifier) {
  if (!identifier) return null;
  let order = null;

  if (typeof identifier === 'number' || /^\d+$/.test(String(identifier))) {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(identifier));
  }
  if (!order) {
    order = db.prepare('SELECT * FROM orders WHERE uuid = ?').get(String(identifier));
  }
  if (!order) {
    order = db.prepare('SELECT * FROM orders WHERE orderNumber = ? ORDER BY id DESC LIMIT 1').get(String(identifier));
  }
  if (!order) return null;

  const items = db.prepare('SELECT id, orderId, code, description, quantityRequired, quantityScanned, unitPrice, status FROM order_items WHERE orderId = ?').all(order.id);
  const auditLogs = db.prepare('SELECT id, orderId, timestamp, userEmail, action, details FROM audit_logs WHERE orderId = ? ORDER BY id ASC').all(order.id);

  return {
    id: order.id,
    uuid: order.uuid,
    orderNumber: order.orderNumber,
    clientName: order.clientName,
    issueDate: order.issueDate,
    pdfFileName: order.pdfFileName,
    status: order.status,
    operatorEmail: order.operatorEmail,
    totalItemsRequired: order.totalItemsRequired,
    totalItemsScanned: order.totalItemsScanned,
    auditStamp: order.auditStamp,
    createdAt: order.createdAt,
    items,
    auditLogs
  };
}

// Parser Real de Archivos PDF con Extracción por Coordenadas Y
async function parsePdfBuffer(pdfBuffer, fileName = 'order.pdf') {
  let orderNumber = fileName.replace(/\.[^/.]+$/, '').replace(/[^0-9]/g, '');
  let clientName = 'DISTRIBUIDORA BEBIDAS S.A.';
  let vendorName = 'WYPRA SA';
  let vendorCuit = '30-71828749-5';
  let issueDate = new Date().toLocaleDateString('es-AR');
  let contactPerson = '';

  const items = [];
  let fullText = '';

  try {
    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
    const pdfDocument = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const content = await page.getTextContent();

      // Agrupar elementos por coordenada Y (posición vertical en la página)
      const linesByY = {};
      content.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!linesByY[y]) linesByY[y] = [];
        linesByY[y].push(item.str);
      });

      const sortedY = Object.keys(linesByY).map(Number).sort((a, b) => b - a);
      const pageLines = sortedY.map(y => ({ y, text: linesByY[y].join(' ').trim() }));

      pageLines.forEach(l => {
        fullText += l.text + '\n';
        if (/DETALLE DE VENTA\s+(\d+)/i.test(l.text)) {
          orderNumber = l.text.match(/DETALLE DE VENTA\s+(\d+)/i)[1];
        }
        if (/Razón Social:\s*([^\n\r]+)/i.test(l.text)) {
          const m = l.text.match(/Razón Social:\s*([^\n\r]+)/i)[1].trim();
          clientName = m.replace(/\s*CUIT:.*$/, '').trim();
        }
        if (/Nombre:\s*([^\n\r]+)/i.test(l.text)) {
          contactPerson = l.text.match(/Nombre:\s*([^\n\r]+)/i)[1].trim().replace(/\s*Condición.*$/, '').trim();
        }
        if (/\d{2}\/\d{2}\/\d{4}/.test(l.text) && l.y > 700) {
          issueDate = l.text.match(/\d{2}\/\d{2}\/\d{4}/)[0];
        }
      });

      const headerLineIndex = pageLines.findIndex(l => l.text.includes('Código') && l.text.includes('Descripción'));
      const footerLineIndex = pageLines.findIndex(l => l.text.includes('Importe') || l.text.includes('Total Venta') || l.text.includes('Contagram'));

      const tableStartY = headerLineIndex !== -1 ? pageLines[headerLineIndex].y : 600;
      const tableEndY = footerLineIndex !== -1 ? pageLines[footerLineIndex].y : 50;

      const tableLines = pageLines.filter(l => l.y < tableStartY && l.y > tableEndY && l.text.length > 0);

      for (let i = 0; i < tableLines.length; i++) {
        const line = tableLines[i];
        const qtyPriceMatch = line.text.match(/^(\d+)\s+\$([\d\.\,]+)/);
        if (qtyPriceMatch) {
          const quantityRequired = parseInt(qtyPriceMatch[1], 10);
          const unitPrice = parseFloat(qtyPriceMatch[2].replace(/\./g, '').replace(',', '.')) || 0;

          const prevLine = i > 0 ? tableLines[i - 1] : null;
          if (!prevLine) continue;

          let rawCode = '';
          let description = prevLine.text;

          const codeMatch = prevLine.text.match(/^(\d{2,14})\s+(.+)/);
          if (codeMatch) {
            rawCode = codeMatch[1];
            description = codeMatch[2].trim();
          }

          let fullCode = rawCode;
          let nextIdx = i + 1;
          while (nextIdx < tableLines.length) {
            const nextLine = tableLines[nextIdx];
            if (/^\d{1,10}$/.test(nextLine.text)) {
              fullCode += nextLine.text;
              nextIdx++;
            } else {
              break;
            }
          }

          if (!fullCode) {
            fullCode = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
          }

          description = description.replace(/\b\d{4,14}\b/g, '').trim();

          if (description.length > 0 && quantityRequired > 0) {
            items.push({
              code: fullCode,
              description,
              quantityRequired,
              quantityScanned: 0,
              unitPrice,
              status: 'PENDING'
            });
          }
        }
      }
    }

    // Estrategia de Rescate: si la agrupación por coordenadas Y no halló ítems, parsear líneas completas
    if (items.length === 0 && fullText.trim().length > 0) {
      const lines = fullText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      for (let l of lines) {
        const rowMatch = l.match(/^(\d{3,14})\s+(.+?)\s+(\d+)\s+\$?\s*([\d\.\,]+)/) ||
                         l.match(/^(.+?)\s+(\d{3,14})\s+(\d+)\s+\$?\s*([\d\.\,]+)/);
        if (rowMatch) {
          const code = rowMatch[1].match(/^\d+$/) ? rowMatch[1] : rowMatch[2];
          const description = (rowMatch[1].match(/^\d+$/) ? rowMatch[2] : rowMatch[1]).trim();
          const quantityRequired = parseInt(rowMatch[3], 10) || 1;
          const unitPriceStr = rowMatch[4] ? rowMatch[4].replace(/\./g, '').replace(',', '.') : '0';
          const unitPrice = parseFloat(unitPriceStr) || 0;

          items.push({ code, description, quantityRequired, quantityScanned: 0, unitPrice, status: 'PENDING' });
        }
      }
    }
  } catch (e) {
    logDetailedError(`parsePdfBuffer: ${fileName}`, e, { fileName });
  }

  const totalAmount = items.reduce((acc, i) => acc + (i.unitPrice * i.quantityRequired), 0);

  return {
    orderNumber,
    clientName,
    items,
    vendorName,
    vendorCuit,
    issueDate,
    dueDate: issueDate,
    contactPerson,
    totalAmount,
    extractedText: fullText
  };
}

// Configuración de Servidor HTTP
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Rutas de archivos estáticos para la interfaz Web Admin (PhoneWare Board / HoloWare Core)
  if (req.url === '/' || req.url === '/index.html') {
    let indexPath = path.join(__dirname, 'modules', 'core', 'public', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(__dirname, 'public', 'index.html');
    }
    fs.readFile(indexPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error cargando index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  }

  if (req.url === '/app.js') {
    const jsPath = path.join(__dirname, 'public', 'app.js');
    fs.readFile(jsPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error cargando app.js');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(content);
    });
    return;
  }

  // DESCARGA DE COMPROBANTE PDF DESDE LA BASE DE DATOS SQLITE (BLOB)
  if (req.url.startsWith('/api/scanban/download-pdf')) {
    const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
    const identifier = urlParams.get('id') || urlParams.get('orderId') || urlParams.get('orderNumber');

    if (!identifier) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta identificador de pedido (id o orderNumber)' }));
      return;
    }

    let order = null;
    if (typeof identifier === 'number' || /^\d+$/.test(String(identifier))) {
      order = db.prepare('SELECT pdfBlob, pdfFileName FROM orders WHERE id = ?').get(Number(identifier));
    }
    if (!order) {
      order = db.prepare('SELECT pdfBlob, pdfFileName FROM orders WHERE uuid = ?').get(String(identifier));
    }
    if (!order) {
      order = db.prepare('SELECT pdfBlob, pdfFileName FROM orders WHERE orderNumber = ? ORDER BY id DESC LIMIT 1').get(String(identifier));
    }

    if (!order || !order.pdfBlob) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Comprobante PDF no encontrado en la Base de Datos' }));
      return;
    }

    const pdfBuffer = Buffer.from(order.pdfBlob, 'base64');
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${order.pdfFileName}"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    let data = {};
    if (body) {
      try { data = JSON.parse(body); } catch (e) {}
    }

    // Extraer usuario autenticado de la petición (Headers o Body) para RBAC y Auditoría
    let currentUser = null;
    const authHeader = req.headers['authorization'] || '';
    const userHeader = req.headers['x-user-email'] || '';
    let emailToFind = '';

    if (authHeader.startsWith('Bearer ')) {
      emailToFind = authHeader.substring(7).trim();
    } else if (userHeader) {
      emailToFind = userHeader.trim();
    } else if (data && (data.userEmail || data.email)) {
      emailToFind = (data.userEmail || data.email).trim();
    }

    if (emailToFind) {
      currentUser = db.prepare('SELECT email as id, email, password, name, role, active FROM users WHERE LOWER(email) = ? AND active = 1')
        .get(emailToFind.toLowerCase()) || null;
    }

const THEMES = {
  original: {
    name: 'Original Dark Glassmorphism',
    background: '#0B0E14',
    cardBg: '#161B22',
    cardBorder: '#30363D',
    emerald: '#00E676',
    cobalt: '#3B82F6',
    amber: '#F59E0B',
    red: '#FF5252',
    textMain: '#FFFFFF',
    textMuted: '#8B949E'
  },
  cyberpunk_neon: {
    name: 'Cyberpunk Neon',
    background: '#0A0A12',
    cardBg: '#121224',
    cardBorder: '#2D2B55',
    emerald: '#00F0FF',
    cobalt: '#A855F7',
    amber: '#FF007F',
    red: '#FF3366',
    textMain: '#FFFFFF',
    textMuted: '#A594F9'
  },
  nordic_frost: {
    name: 'Nordic Frost',
    background: '#0F172A',
    cardBg: '#1E293B',
    cardBorder: '#334155',
    emerald: '#38BDF8',
    cobalt: '#14B8A6',
    amber: '#F59E0B',
    red: '#F43F5E',
    textMain: '#F8FAFC',
    textMuted: '#94A3B8'
  },
  dracula_pro: {
    name: 'Dracula Pro',
    background: '#282A36',
    cardBg: '#44475A',
    cardBorder: '#6272A4',
    emerald: '#50FA7B',
    cobalt: '#BD93F9',
    amber: '#FFB86C',
    red: '#FF5555',
    textMain: '#F8F8F2',
    textMuted: '#8BE9FD'
  },
  emerald_light: {
    name: 'Modern Light Corporate',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    emerald: '#059669',
    cobalt: '#2563EB',
    amber: '#D97706',
    red: '#DC2626',
    textMain: '#0F172A',
    textMuted: '#64748B'
  },
  monochrome_minimal: {
    name: 'Monochrome Minimal',
    background: '#000000',
    cardBg: '#111111',
    cardBorder: '#222222',
    emerald: '#FFFFFF',
    cobalt: '#CCCCCC',
    amber: '#888888',
    red: '#FF4444',
    textMain: '#FFFFFF',
    textMuted: '#777777'
  },
  catppuccin_mocha: {
    name: 'Catppuccin Mocha',
    background: '#1E1E2E',
    cardBg: '#181825',
    cardBorder: '#313244',
    emerald: '#A6E3A1',
    cobalt: '#89B4FA',
    amber: '#F9E2AF',
    red: '#F38BA8',
    textMain: '#CDD6F4',
    textMuted: '#A6ADC8'
  }
};

    try {
      // -1. CONSULTA DE TEMA DINÁMICO DESDE SQLITE APP_SETTINGS
      if (req.url === '/api/theme' && req.method === 'GET') {
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'active_theme'").get();
        const themeKey = (row ? row.value : 'original').toLowerCase().trim();
        const activeTheme = THEMES[themeKey] || THEMES.original;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          activeThemeKey: themeKey in THEMES ? themeKey : 'original',
          theme: activeTheme
        }));
        return;
      }

      // -1.1 CAMBIO DE TEMA DINÁMICO EXCLUSIVO POR SUPERADMIN
      if (req.url === '/api/theme' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo el Super Administrador puede cambiar el tema visual de la plataforma.' }));
          return;
        }
        const { themeKey } = data;
        const adminEmail = currentUser.email;

        const targetKey = (themeKey || '').toLowerCase().trim();
        if (!THEMES[targetKey]) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tema no válido.' }));
          return;
        }

        db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('active_theme', ?)").run(targetKey);

        const now = new Date().toISOString();
        const themeName = THEMES[targetKey].name;
        db.prepare(`
          INSERT INTO platform_audit_logs (timestamp, userEmail, action, details)
          VALUES (?, ?, ?, ?)
        `).run(now, adminEmail, 'THEME_CHANGED', JSON.stringify({ themeKey: targetKey, themeName }));

        console.log(`[CONFIG] Tema de la aplicación actualizado a '${themeName}' (${targetKey}) por Admin ${adminEmail}.`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          activeThemeKey: targetKey,
          theme: THEMES[targetKey]
        }));
        return;
      }
      // 0. RESETEO DE BASE DE DATOS EN VIVO (DEVOPS - SIN APAGAR PUERTO 3001)
      if (req.url === '/api/reset-db' && req.method === 'POST') {
        db.prepare('DELETE FROM audit_logs').run();
        db.prepare('DELETE FROM order_items').run();
        db.prepare('DELETE FROM orders').run();
        db.prepare('DELETE FROM users').run();

        initUsers();

        console.log('[DEVOPS RESET] Base de datos SQLite reseteada en vivo sin apagar el puerto 3001.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Base de datos reseteada en vivo sin apagar el servidor.' }));
        return;
      }

      // CORE: MÓDULOS — GET lista todos los módulos, POST activa/desactiva (solo SUPERADMIN)
      if (req.url === '/api/modules' && req.method === 'GET') {
        const mods = db.prepare('SELECT id, key, name, description, active, activatedBy, activatedAt FROM modules ORDER BY id ASC').all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, modules: mods }));
        return;
      }

      if (req.url === '/api/modules' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede gestionar módulos.' }));
          return;
        }
        const { key, active } = data;
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Se requiere el campo key del módulo.' }));
          return;
        }
        const mod = db.prepare('SELECT * FROM modules WHERE key = ?').get(key);
        if (!mod) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Módulo '${key}' no encontrado.` }));
          return;
        }
        if (mod.key === 'core') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'El módulo Core no puede desactivarse.' }));
          return;
        }
        const newActive = active ? 1 : 0;
        db.prepare('UPDATE modules SET active = ?, activatedBy = ?, activatedAt = ? WHERE key = ?')
          .run(newActive, currentUser.email, new Date().toISOString(), key);
        // Log en platform_audit_logs
        db.prepare('INSERT INTO platform_audit_logs (timestamp, userEmail, action, details) VALUES (?, ?, ?, ?)')
          .run(new Date().toISOString(), currentUser.email, newActive ? 'MODULE_ACTIVATED' : 'MODULE_DEACTIVATED',
            JSON.stringify({ module: key, active: newActive }));
        const updated = db.prepare('SELECT * FROM modules WHERE key = ?').get(key);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, module: updated }));
        return;
      }

      // CORE: PLATFORM AUDIT LOGS — GET lista eventos de auditoría de plataforma (solo SUPERADMIN)
      if (req.url === '/api/platform-audit' && req.method === 'GET') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado.' }));
          return;
        }
        const logs = db.prepare('SELECT id, timestamp, userEmail, action, details FROM platform_audit_logs ORDER BY id DESC LIMIT 100').all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, logs }));
        return;
      }

      // 1. ENDPOINT DE AUTENTICACIÓN / LOGIN
      if (req.url === '/api/login' && req.method === 'POST') {
        const { email, password } = data;
        const normalizedEmail = (email || '').toLowerCase().trim();

        const user = db.prepare('SELECT email as id, email, password, name, role, active FROM users WHERE LOWER(email) = ? AND active = 1').get(normalizedEmail);

        if (!user || user.password !== password) {
          console.log(`[AUTH] Intento de login fallido para: ${normalizedEmail}`);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Credenciales inválidas o usuario inactivo' }));
          return;
        }

        console.log(`[AUTH] Login exitoso: ${user.email} (${user.role})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token: user.email,
          user: { id: user.email, email: user.email, name: user.name, role: user.role }
        }));
        return;
      }

      // 2. ENDPOINTS ABM DE USUARIOS EN BASE DE DATOS
      if (req.url.startsWith('/api/users')) {
        if (req.method === 'GET') {
          const userList = db.prepare('SELECT email as id, email, name, role, active FROM users').all().map(u => ({
            ...u,
            active: Boolean(u.active)
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(userList));
          return;
        }

        if (req.method === 'POST') {
          const { email, password, name, role } = data;
          if (!email || !password || !name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Datos incompletos' }));
            return;
          }
          const targetRole = role || 'OPERATOR';
          if (targetRole === 'SUPERADMIN' && (!currentUser || currentUser.role !== 'SUPERADMIN')) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Solo un Super Administrador puede asignar el rol SUPERADMIN.' }));
            return;
          }
          const cleanEmail = email.toLowerCase().trim();

          db.prepare('INSERT OR REPLACE INTO users (email, password, name, role, active) VALUES (?, ?, ?, ?, 1)').run(
            cleanEmail, password, name, targetRole
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario guardado en Base de Datos' }));
          return;
        }

        if (req.method === 'PUT') {
          const { email, password, name, role, active } = data;
          const cleanEmail = email.toLowerCase().trim();

          const existing = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
          if (!existing) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Usuario no encontrado' }));
            return;
          }

          // Protección de rol SUPERADMIN
          if ((existing.role === 'SUPERADMIN' || role === 'SUPERADMIN') && (!currentUser || currentUser.role !== 'SUPERADMIN')) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Solo un Super Administrador puede modificar cuentas SuperAdmin.' }));
            return;
          }

          const newRole = role || existing.role;
          const newActive = typeof active === 'boolean' ? (active ? 1 : 0) : existing.active;

          db.prepare(`
            UPDATE users SET name = ?, password = ?, role = ?, active = ? WHERE LOWER(email) = ?
          `).run(name || existing.name, password || existing.password, newRole, newActive, cleanEmail);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario actualizado correctamente' }));
          return;
        }

        if (req.method === 'DELETE') {
          const emailToDelete = data.email || (req.url.includes('email=') ? req.url.split('email=')[1].split('&')[0] : '');
          const cleanEmail = emailToDelete.toLowerCase().trim();
          const existing = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(cleanEmail);

          if (existing && existing.role === 'SUPERADMIN' && (!currentUser || currentUser.role !== 'SUPERADMIN')) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No tienes permisos para desactivar una cuenta SuperAdmin.' }));
            return;
          }

          db.prepare('UPDATE users SET active = 0 WHERE LOWER(email) = ?').run(cleanEmail);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario desactivado' }));
          return;
        }
      }

      // 3. CONSULTA DE TABLERO KANBAN Y EXPLORADOR DE PEDIDOS DESDE SQLITE
      if ((req.url.startsWith('/api/scanban/orders') || req.url.startsWith('/api/scanban/kanban')) && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const search = (urlParams.get('q') || urlParams.get('search') || '').toLowerCase().trim();
        const statusFilter = (urlParams.get('status') || 'ALL').toUpperCase();
        const selectedOperators = (urlParams.get('operators') || '').split(',').map(o => o.trim().toLowerCase()).filter(Boolean);

        const allOrdersInDb = db.prepare('SELECT * FROM orders').all();

        const formattedOrders = allOrdersInDb.map(o => {
          const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(o.id);
          const logs = db.prepare('SELECT timestamp, userEmail, action, details FROM audit_logs WHERE orderId = ? ORDER BY id ASC').all(o.id);

          const scannedItems = o.totalItemsScanned || 0;
          const totalItems = o.totalItemsRequired || 1;
          const progressPercentage = Math.round((scannedItems / totalItems) * 100);
          const totalAmount = items.reduce((acc, i) => acc + ((i.unitPrice || 0) * (i.quantityRequired || 1)), 0);

          return {
            id: o.id,
            uuid: o.uuid,
            orderNumber: o.orderNumber,
            clientName: o.clientName,
            issueDate: o.issueDate,
            fileName: o.pdfFileName,
            pdfFileName: o.pdfFileName,
            status: o.status,
            operatorEmail: o.operatorEmail || 'Sin asignar',
            operatorId: o.operatorEmail || 'Sin asignar',
            totalItemsRequired: o.totalItemsRequired,
            totalItemsScanned: o.totalItemsScanned,
            scannedItems,
            totalItems,
            progressPercentage,
            totalAmount,
            auditStamp: o.auditStamp,
            createdAt: o.createdAt,
            items,
            auditLogs: logs
          };
        });

        // Filtrado en servidor para Explorador Inteligente de Pedidos
        const filtered = formattedOrders.filter(o => {
          const matchesSearch = !search ||
            o.orderNumber.toLowerCase().includes(search) ||
            o.clientName.toLowerCase().includes(search) ||
            o.pdfFileName.toLowerCase().includes(search) ||
            o.operatorEmail.toLowerCase().includes(search) ||
            (o.items && o.items.some(i => i.code.toLowerCase().includes(search) || i.description.toLowerCase().includes(search)));

          const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
          const matchesOperator = selectedOperators.length === 0 || selectedOperators.includes(o.operatorEmail.toLowerCase());

          return matchesSearch && matchesStatus && matchesOperator;
        });

        const kanbanData = {
          success: true,
          orders: filtered,
          backlog: filtered.filter(o => o.status === 'BACKLOG'),
          ready: filtered.filter(o => o.status === 'READY'),
          doing: filtered.filter(o => o.status === 'DOING' || o.status === 'SCANNING'),
          done: filtered.filter(o => o.status === 'DONE' || o.status === 'CLOSED' || o.status === 'PARTIAL_DISPATCH')
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(kanbanData));
        return;
      }

      // 3.1 PASAR COMPROBANTE DE BACKLOG A LISTO EXCLUSIVO POR ADMIN
      if (req.url === '/api/scanban/mark-ready' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const email = (userEmail || processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();
        const callerUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(email);

        if (callerUser && callerUser.role !== 'ADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo los usuarios Administradores pueden validar comprobantes.' }));
          return;
        }

        const order = getFullOrderFromDb(orderId || orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'READY' WHERE id = ?").run(order.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(order.id, now, email, 'VALIDAR_COMPROBANTE', `Pedido #${order.orderNumber} (ID: ${order.id}) validado y pasado a Listo por Admin (${email}).`);

          console.log(`[ADMIN LOG] Pedido #${order.orderNumber} (ID: ${order.id}) validado y pasado a Listo por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3.2 DEVOLVER COMPROBANTE DE LISTO A BACKLOG EXCLUSIVO POR ADMIN
      if (req.url === '/api/scanban/mark-backlog' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const email = (userEmail || processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();
        const callerUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(email);

        if (callerUser && callerUser.role !== 'ADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo los usuarios Administradores pueden mover comprobantes a Backlog.' }));
          return;
        }

        const order = getFullOrderFromDb(orderId || orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'BACKLOG', operatorEmail = NULL WHERE id = ?").run(order.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(order.id, now, email, 'DEVOLVER_BACKLOG', `Pedido #${order.orderNumber} (ID: ${order.id}) devuelto a Backlog por Admin (${email}).`);

          console.log(`[ADMIN LOG] Pedido #${order.orderNumber} (ID: ${order.id}) devuelto a Backlog por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3.3 LIBERAR Y RESETEAR PEDIDO EN PROCESO A LISTO EXCLUSIVO POR ADMIN
      if ((req.url === '/api/scanban/release-order-admin' || req.url === '/api/scanban/release-order-admin') && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const email = (userEmail || processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();
        const callerUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(email);

        if (callerUser && callerUser.role !== 'ADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo los usuarios Administradores pueden reasignar pedidos en proceso.' }));
          return;
        }

        const order = getFullOrderFromDb(orderId || orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'READY', operatorEmail = NULL, totalItemsScanned = 0 WHERE id = ?").run(order.id);
          db.prepare("UPDATE order_items SET quantityScanned = 0, status = 'PENDING' WHERE orderId = ?").run(order.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(order.id, now, email, 'REASIGNAR_A_LISTO', `Pedido #${order.orderNumber} (ID: ${order.id}) liberado por Admin (${email}) de En Proceso a Listo para reasignación (escaneo reseteado a 0).`);

          console.log(`[ADMIN LOG] Pedido #${order.orderNumber} (ID: ${order.id}) liberado de En Proceso a Listo por Admin ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3.4 ASIGNAR PEDIDO DE LISTO A EN PROCESO EXCLUSIVO POR ADMIN CON SELECCIÓN DE OPERARIO
      if ((req.url === '/api/scanban/assign-order' || req.url === '/api/scanban/assign-order') && req.method === 'POST') {
        const { orderId, orderNumber, operatorEmail, userEmail } = data;
        const adminEmail = (userEmail || processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();

        const callerUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(adminEmail);
        if (callerUser && callerUser.role !== 'ADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo los usuarios Administradores pueden asignar pedidos a operarios.' }));
          return;
        }

        const targetOperator = (operatorEmail || '').trim().toLowerCase();
        if (!targetOperator) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Debes seleccionar un operario válido para asignar la orden.' }));
          return;
        }

        const order = getFullOrderFromDb(orderId || orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'DOING', operatorEmail = ? WHERE id = ?").run(targetOperator, order.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(order.id, now, adminEmail, 'ASIGNAR_OPERARIO', `Pedido #${order.orderNumber} (ID: ${order.id}) asignado al operario ${targetOperator} por Admin (${adminEmail}). Estado -> En Proceso.`);

          console.log(`[ADMIN LOG] Pedido #${order.orderNumber} (ID: ${order.id}) asignado a operario ${targetOperator} por ${adminEmail}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 4. CONSULTA DE PEDIDOS DISPONIBLES EN LISTO PARA APP MÓVIL
      if (req.url === '/api/scanban/available-orders' && req.method === 'GET') {
        const readyOrders = db.prepare("SELECT id, uuid, orderNumber, clientName, totalItemsRequired as totalItems FROM orders WHERE status = 'READY'").all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, orders: readyOrders }));
        return;
      }

      // 5. DETALLE REAL DE UN PEDIDO CON PRODUCTOS PARSEADOS Y AUDITORÍA
      if (req.url.startsWith('/api/scanban/order-detail') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const identifier = urlParams.get('id') || urlParams.get('orderId') || urlParams.get('orderNumber') || (req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '');

        const fullOrder = getFullOrderFromDb(identifier);
        if (fullOrder) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, order: fullOrder }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Pedido no encontrado' }));
        return;
      }

      // 6. BORRAR COMPROBANTE EN SQLITE
      if ((req.url === '/api/scanban/delete-order' || req.url.startsWith('/api/scanban/delete-order')) && (req.method === 'DELETE' || req.method === 'POST')) {
        const identifier = data.id || data.orderId || data.orderNumber || (req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '');
        const targetOrder = getFullOrderFromDb(identifier);
        if (!targetOrder) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Pedido no encontrado' }));
          return;
        }

        db.prepare('DELETE FROM orders WHERE id = ?').run(targetOrder.id);
        console.log(`[ADMIN] Comprobante #${targetOrder.orderNumber} (ID: ${targetOrder.id}) eliminado de SQLite por ${data.userEmail || processEnv.ADMIN_EMAIL}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Pedido #${targetOrder.orderNumber} eliminado.` }));
        return;
      }

      // 7. AUTO-DETECCIÓN DE PEDIDO ACTIVO EN DB (POR EMAIL DE USUARIO)
      if (req.url.startsWith('/api/scanban/active-order') || req.url === '/api/scanban/active-order') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        let email = data.userEmail || data.email || data.operatorId || urlParams.get('userEmail') || urlParams.get('email') || urlParams.get('operatorId') || '';
        email = email.toLowerCase().trim();

        const activeOrderRow = db.prepare("SELECT id FROM orders WHERE (status = 'DOING' OR status = 'SCANNING') AND LOWER(operatorEmail) = ?").get(email);

        if (activeOrderRow) {
          const fullOrder = getFullOrderFromDb(activeOrderRow.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            hasActive: true,
            orderId: fullOrder.id,
            orderNumber: fullOrder.orderNumber,
            pdfFileName: fullOrder.pdfFileName,
            order: fullOrder
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hasActive: false }));
        return;
      }

      // 8. TOMAR PEDIDO (CAMBIO DE ESTADO EN SQLITE CON EMAIL DE USUARIO)
      if (req.url === '/api/scanban/claim-order' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail, email } = data;
        const operatorEmail = (userEmail || email || 'jsrxar@gmail.com').trim().toLowerCase();

        const existingOrder = getFullOrderFromDb(orderId || orderNumber);
        if (existingOrder) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'DOING', operatorEmail = ? WHERE id = ?").run(operatorEmail, existingOrder.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(existingOrder.id, now, operatorEmail, 'TOMAR_PEDIDO', `Pedido #${existingOrder.orderNumber} (ID: ${existingOrder.id}) tomado por operario ${operatorEmail}. Estado -> DOING`);

          console.log(`[LOG AUDITORÍA] Pedido #${existingOrder.orderNumber} (ID: ${existingOrder.id}) tomado por ${operatorEmail}.`);
          const updatedFull = getFullOrderFromDb(existingOrder.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, targetFileName: updatedFull.pdfFileName, order: updatedFull }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pedido no existe en la Base de Datos' }));
        return;
      }

      // 8.1 ACTUALIZAR PROGRESO DE ESCANEO EN SQLITE
      if (req.url === '/api/scanban/update-scan-progress' && req.method === 'POST') {
        const { orderId, orderNumber, items, totalItemsScanned } = data;
        const order = getFullOrderFromDb(orderId || orderNumber);

        if (order) {
          if (order.status !== 'DOING' && order.status !== 'SCANNING') {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, releasedByAdmin: true, error: 'El Administrador ha desasignado o liberado este pedido a la columna LISTO.' }));
            return;
          }

          if (Array.isArray(items)) {
            const updateItemStmt = db.prepare(`
              UPDATE order_items
              SET quantityScanned = ?, status = ?
              WHERE orderId = ? AND (id = ? OR code = ?)
            `);

            for (const item of items) {
              const status = item.quantityScanned >= item.quantityRequired ? 'COMPLETED' : item.quantityScanned > 0 ? 'IN_PROGRESS' : 'PENDING';
              updateItemStmt.run(item.quantityScanned, status, order.id, item.id || 0, item.code || '');
            }
          }

          if (typeof totalItemsScanned === 'number') {
            db.prepare('UPDATE orders SET totalItemsScanned = ? WHERE id = ?').run(totalItemsScanned, order.id);
          }

          console.log(`[ESCÁNER SQLITE] Avance guardado para Pedido #${order.orderNumber} (ID: ${order.id}): ${totalItemsScanned} U.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 9. LIBERAR PEDIDO (CAMBIO DE ESTADO EN SQLITE A READY)
      if (req.url === '/api/scanban/release-order' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail, email } = data;
        const opEmail = (userEmail || email || 'jsrxar@gmail.com').trim().toLowerCase();

        const order = getFullOrderFromDb(orderId || orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'READY', operatorEmail = NULL WHERE id = ?").run(order.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(order.id, now, opEmail, 'LIBERAR_PEDIDO', `Pedido #${order.orderNumber} (ID: ${order.id}) liberado por ${opEmail}. Devuelto a columna LISTO (READY).`);

          console.log(`[LOG AUDITORÍA] Pedido #${order.orderNumber} liberado por ${opEmail}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10. FINALIZAR PEDIDO (CAMBIO DE ESTADO EN SQLITE A DONE CON MARCA DE AGUA)
      if (req.url === '/api/scanban/complete-order' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail, email, watermarkText } = data;
        const opEmail = (userEmail || email || 'jsrxar@gmail.com').trim().toLowerCase();

        const order = getFullOrderFromDb(orderId || orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          const auditStamp = watermarkText || `AUDITADO Y EXPEDIDO POR OPERARIO ${opEmail} | FECHA: ${now}`;

          db.prepare("UPDATE orders SET status = 'DONE', operatorEmail = ?, auditStamp = ?, totalItemsScanned = totalItemsRequired WHERE id = ?").run(opEmail, auditStamp, order.id);
          db.prepare(`
            INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(order.id, now, opEmail, 'DESPACHAR_PEDIDO', `Pedido #${order.orderNumber} (ID: ${order.id}) auditado y despachado por ${opEmail}. Marca de Agua: ${auditStamp}`);

          console.log(`[LOG AUDITORÍA] Pedido #${order.orderNumber} despachado por ${opEmail}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, doneFileName: `${order ? order.orderNumber : 'order'}.pdf` }));
        return;
      }

      // 11. SUBIDA Y VALIDACIÓN DE COMPROBANTE PDF EN ADMIN (CON PDF BLOB EN SQLITE)
      if (req.url === '/api/scanban/upload-pdf' && req.method === 'POST') {
        const { fileName, pdfBase64, userEmail } = data;
        if (!fileName || !pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Debes proporcionar un archivo PDF válido en base64' }));
          return;
        }

        const buffer = Buffer.from(pdfBase64, 'base64');
        const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const email = (userEmail || processEnv.ADMIN_EMAIL).toLowerCase();

        // Parseo real del contenido del PDF
        const parsed = await parsePdfBuffer(buffer, cleanName);

        if (!parsed.items || parsed.items.length === 0) {
          console.log(`[PARSE ERROR] No se pudieron extraer ítems del PDF "${cleanName}"`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `No se pudieron extraer productos ni ítems válidos del comprobante "${cleanName}". Asegúrate de subír un PDF de factura o comprobante que contenga texto de tabla con código, cantidad y precio.`
          }));
          return;
        }

        const orderUuid = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toLocaleString('es-AR');
        const totalItemsRequired = parsed.items.reduce((acc, i) => acc + i.quantityRequired, 0);

        // Guardar Orden principal en SQLite con Clave Primaria Autoincremental
        const orderInsertRes = db.prepare(`
          INSERT INTO orders (uuid, orderNumber, clientName, issueDate, pdfFileName, pdfBlob, status, operatorEmail, totalItemsRequired, totalItemsScanned, auditStamp, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, 'BACKLOG', NULL, ?, 0, NULL, ?)
        `).run(
          orderUuid,
          parsed.orderNumber,
          parsed.clientName,
          new Date().toLocaleDateString('es-AR'),
          cleanName,
          pdfBase64,
          totalItemsRequired,
          now
        );

        const orderId = orderInsertRes.lastInsertRowid;

        // Limpiar e insertar ítems relacionales en order_items vinculados por orderId
        const insertItemStmt = db.prepare(`
          INSERT INTO order_items (orderId, code, description, unitPrice, quantityRequired, quantityScanned, status)
          VALUES (?, ?, ?, ?, ?, 0, 'PENDING')
        `);

        parsed.items.forEach(item => {
          insertItemStmt.run(orderId, item.code, item.description, item.unitPrice || 0, item.quantityRequired);
        });

        // Insertar log de auditoría
        db.prepare(`
          INSERT INTO audit_logs (orderId, timestamp, userEmail, action, details)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, now, email, 'CARGA_COMPROBANTE', `Comprobante PDF parseado y Blob guardado en SQLite por ${email}.`);

        console.log(`[ADMIN LOG] Comprobante PDF ${parsed.orderNumber} (ID: ${orderId}, Cliente: ${parsed.clientName}) parseado y guardado en SQLite por ${email}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: orderId, uuid: orderUuid, fileName: cleanName, orderNumber: parsed.orderNumber, message: 'Comprobante parseado y publicado en backlog en SQLite' }));
        return;
      }

      // 12. CONSULTA Y LECTURA DE LOGS DE ERRORES DEL SISTEMA (DEVOPS)
      if (req.url.startsWith('/api/error-logs') && req.method === 'GET') {
        const errorContent = fs.existsSync(ERROR_LOG_PATH) ? fs.readFileSync(ERROR_LOG_PATH, 'utf8') : 'Sin registro de errores.';
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(errorContent);
        return;
      }

      // 13. RECEPCIÓN Y CENTRALIZACIÓN DE ERRORES DESDE APP MÓVIL Y WEB
      if (req.url === '/api/log-client-error' && req.method === 'POST') {
        const { platform, context, error, stack, extra } = data;
        const errObj = new Error(error || 'Error reportado por cliente');
        if (stack) errObj.stack = stack;

        logDetailedError(`[CLIENTE ${platform || 'MÓVIL'}] ${context || 'App Mobile'}`, errObj, extra || data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
    } catch (e) {
      const errorDetail = logDetailedError(req.url || 'Ruta Desconocida', e, data);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Error interno del servidor',
        message: e.message,
        errorDetail
      }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor HTTP Activo en http://0.0.0.0:${PORT}`);
  console.log(`🗄️ Base de Datos Relacional SQLite Activa en: ${DB_PATH}`);
});
