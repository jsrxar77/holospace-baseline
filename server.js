const http = require('http');
const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist');
const Database = require('better-sqlite3');

// Leer variables de entorno desde .env
let processEnv = {
  PORT: process.env.PORT || '3001',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@drinklovers.com.ar',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'drinklovers2026!'
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

const PORT = parseInt(processEnv.PORT, 10) || 3001;

// BASE DE DATOS SQLITE RELACIONAL Y PERSISTENTE EN ./data/phoneware.db
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'phoneware.db');
const ERROR_LOG_PATH = path.join(DATA_DIR, 'errors.log');

// Sistema de Registro de Errores Detallados en Consola y Archivo ./data/errors.log
function logDetailedError(context, err, payload = {}) {
  const timestamp = new Date().toLocaleString('es-AR');
  const errorMessage = err ? (err.message || String(err)) : 'Error sin descripción';
  const stackTrace = err && err.stack ? err.stack : 'No hay stack trace disponible';

  const logEntry = `
======================================================
🚨 [ERROR DETALLADO - ${timestamp}]
📌 Contexto / Ruta: ${context}
👤 Usuario: ${payload.userEmail || payload.email || 'No especificado'}
❌ Error: ${errorMessage}
📦 Payload Contexto: ${JSON.stringify(payload, null, 2)}
📜 Stack Trace:
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
    orderNumber TEXT PRIMARY KEY NOT NULL,
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
    id TEXT PRIMARY KEY NOT NULL,
    orderNumber TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unitPrice REAL DEFAULT 0.0,
    quantityRequired INTEGER NOT NULL,
    quantityScanned INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (orderNumber) REFERENCES orders(orderNumber) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderNumber TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    userEmail TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    FOREIGN KEY (orderNumber) REFERENCES orders(orderNumber) ON DELETE CASCADE
  );
`);

// Asegurar los 2 usuarios autorizados por defecto en la base de datos
const initUsers = () => {
  const adminEmail = (processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();
  const adminPassword = processEnv.ADMIN_PASSWORD || 'drinklovers2026!';

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO users (email, password, name, role, active)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(adminEmail, adminPassword, 'Administrador Principal', 'ADMIN', 1);
  stmt.run('jsrxar@gmail.com', 'Asadito21!', 'Javier Rizzo', 'OPERATOR', 1);
};
initUsers();

// Helper para obtener una orden completa estructurada desde SQLite
function getFullOrderFromDb(orderNumber) {
  const order = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);
  if (!order) return null;

  const items = db.prepare('SELECT id, orderNumber as orderId, code, description, quantityRequired, quantityScanned, unitPrice, status FROM order_items WHERE orderNumber = ?').all(orderNumber);
  const auditLogs = db.prepare('SELECT timestamp, userEmail, action, details FROM audit_logs WHERE orderNumber = ? ORDER BY id ASC').all(orderNumber);

  return {
    id: `ord-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    clientName: order.clientName,
    issueDate: order.issueDate,
    pdfFileName: order.pdfFileName,
    pdfBlob: order.pdfBlob,
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

  // Rutas de archivos estáticos para la interfaz Web Admin (PhoneWare Board)
  if (req.url === '/' || req.url === '/index.html') {
    const indexPath = path.join(__dirname, 'public', 'index.html');
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
  if (req.url.startsWith('/api/download-pdf')) {
    const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
    const orderNumber = urlParams.get('orderNumber');

    if (!orderNumber) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta orderNumber' }));
      return;
    }

    const order = db.prepare('SELECT pdfBlob, pdfFileName FROM orders WHERE orderNumber = ?').get(orderNumber);

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

    try {
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
          const cleanEmail = email.toLowerCase().trim();

          db.prepare('INSERT OR REPLACE INTO users (email, password, name, role, active) VALUES (?, ?, ?, ?, 1)').run(
            cleanEmail, password, name, role || 'OPERATOR'
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

          db.prepare(`
            UPDATE users
            SET password = ?, name = ?, role = ?, active = ?
            WHERE LOWER(email) = ?
          `).run(
            password || existing.password,
            name || existing.name,
            role || existing.role,
            typeof active === 'boolean' ? (active ? 1 : 0) : existing.active,
            cleanEmail
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario actualizado en Base de Datos' }));
          return;
        }

        if (req.method === 'DELETE') {
          const emailToDelete = data.email || (req.url.includes('email=') ? req.url.split('email=')[1].split('&')[0] : '');
          const cleanEmail = emailToDelete.toLowerCase().trim();

          db.prepare('UPDATE users SET active = 0 WHERE LOWER(email) = ?').run(cleanEmail);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario desactivado en Base de Datos' }));
          return;
        }
      }

      // 3. CONSULTA DE TABLERO KANBAN DE 4 COLUMNAS DESDE SQLITE
      if ((req.url.startsWith('/api/orders') || req.url.startsWith('/api/kanban')) && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const search = (urlParams.get('search') || '').toLowerCase().trim();
        const statusFilter = (urlParams.get('status') || 'ALL').toUpperCase();
        const selectedOperators = (urlParams.get('operators') || '').split(',').map(o => o.trim().toLowerCase()).filter(Boolean);

        const allOrdersInDb = db.prepare('SELECT * FROM orders').all();

        const formattedOrders = allOrdersInDb.map(o => {
          const items = db.prepare('SELECT * FROM order_items WHERE orderNumber = ?').all(o.orderNumber);
          const logs = db.prepare('SELECT timestamp, userEmail, action, details FROM audit_logs WHERE orderNumber = ? ORDER BY id ASC').all(o.orderNumber);

          const scannedItems = o.totalItemsScanned || 0;
          const totalItems = o.totalItemsRequired || 1;
          const progressPercentage = Math.round((scannedItems / totalItems) * 100);

          return {
            id: `ord-${o.orderNumber}`,
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
            o.operatorEmail.toLowerCase().includes(search);

          const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
          const matchesOperator = selectedOperators.length === 0 || selectedOperators.includes(o.operatorEmail.toLowerCase());

          return matchesSearch && matchesStatus && matchesOperator;
        });

        const kanbanData = {
          backlog: filtered.filter(o => o.status === 'BACKLOG'),
          ready: filtered.filter(o => o.status === 'READY'),
          doing: filtered.filter(o => o.status === 'DOING' || o.status === 'SCANNING'),
          done: filtered.filter(o => o.status === 'DONE' || o.status === 'CLOSED' || o.status === 'PARTIAL_DISPATCH')
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(kanbanData));
        return;
      }

      // 3.1 PASAR COMPROBANTE DE BACKLOG A LISTO (READY) EXCLUSIVO POR ADMIN
      if (req.url === '/api/mark-ready' && req.method === 'POST') {
        const { orderNumber, userEmail } = data;
        const email = (userEmail || processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();
        const callerUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(email);

        if (callerUser && callerUser.role !== 'ADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo los usuarios Administradores pueden validar comprobantes.' }));
          return;
        }

        const order = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'READY' WHERE orderNumber = ?").run(orderNumber);
          db.prepare(`
            INSERT INTO audit_logs (orderNumber, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(orderNumber, now, email, 'VALIDAR_COMPROBANTE', `Pedido #${orderNumber} validado y pasado a LISTO por Admin (${email}).`);

          console.log(`[ADMIN LOG] Pedido ${orderNumber} validado y pasado a READY por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3.2 DEVOLVER COMPROBANTE DE LISTO (READY) A BACKLOG EXCLUSIVO POR ADMIN
      if (req.url === '/api/mark-backlog' && req.method === 'POST') {
        const { orderNumber, userEmail } = data;
        const email = (userEmail || processEnv.ADMIN_EMAIL || 'admin@drinklovers.com.ar').toLowerCase();
        const callerUser = db.prepare('SELECT role FROM users WHERE LOWER(email) = ?').get(email);

        if (callerUser && callerUser.role !== 'ADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Solo los usuarios Administradores pueden mover comprobantes a Backlog.' }));
          return;
        }

        const order = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'BACKLOG', operatorEmail = NULL WHERE orderNumber = ?").run(orderNumber);
          db.prepare(`
            INSERT INTO audit_logs (orderNumber, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(orderNumber, now, email, 'DEVOLVER_BACKLOG', `Pedido #${orderNumber} devuelto a BACKLOG por Admin (${email}).`);

          console.log(`[ADMIN LOG] Pedido ${orderNumber} devuelto a BACKLOG por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 4. CONSULTA DE PEDIDOS DISPONIBLES EN LISTO PARA APP MÓVIL
      if (req.url === '/api/available-orders' && req.method === 'GET') {
        const readyOrders = db.prepare("SELECT orderNumber, clientName, totalItemsRequired as totalItems FROM orders WHERE status = 'READY'").all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, orders: readyOrders }));
        return;
      }

      // 5. DETALLE REAL DE UN PEDIDO CON PRODUCTOS PARSEADOS Y AUDITORÍA
      if (req.url.startsWith('/api/order-detail') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const orderNumber = urlParams.get('orderNumber') || (req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '');

        const fullOrder = getFullOrderFromDb(orderNumber);
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
      if ((req.url === '/api/delete-order' || req.url.startsWith('/api/delete-order')) && (req.method === 'DELETE' || req.method === 'POST')) {
        const orderNumber = data.orderNumber || (req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '');
        if (!orderNumber) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Falta orderNumber' }));
          return;
        }

        db.prepare('DELETE FROM orders WHERE orderNumber = ?').run(orderNumber);
        console.log(`[ADMIN] Comprobante ${orderNumber} eliminado de SQLite por ${data.userEmail || processEnv.ADMIN_EMAIL}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Pedido ${orderNumber} eliminado.` }));
        return;
      }

      // 7. AUTO-DETECCIÓN DE PEDIDO ACTIVO EN DB (POR EMAIL DE USUARIO)
      if (req.url.startsWith('/api/active-order') || req.url === '/api/check-active-order') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        let email = data.userEmail || data.email || data.operatorId || urlParams.get('userEmail') || urlParams.get('email') || urlParams.get('operatorId') || '';
        email = email.toLowerCase().trim();

        const activeOrderRow = db.prepare("SELECT orderNumber FROM orders WHERE (status = 'DOING' OR status = 'SCANNING') AND LOWER(operatorEmail) = ?").get(email);

        if (activeOrderRow) {
          const fullOrder = getFullOrderFromDb(activeOrderRow.orderNumber);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            hasActive: true,
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
      if (req.url === '/api/claim-order' && req.method === 'POST') {
        const { orderNumber, userEmail, email } = data;
        const operatorEmail = (userEmail || email || 'jsrxar@gmail.com').trim().toLowerCase();

        const existingOrder = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);
        if (existingOrder) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'DOING', operatorEmail = ? WHERE orderNumber = ?").run(operatorEmail, orderNumber);
          db.prepare(`
            INSERT INTO audit_logs (orderNumber, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(orderNumber, now, operatorEmail, 'TOMAR_PEDIDO', `Pedido #${orderNumber} tomado por operario ${operatorEmail}. Estado -> DOING`);

          console.log(`[LOG AUDITORÍA] Pedido ${orderNumber} tomado por ${operatorEmail}.`);
          const updatedFull = getFullOrderFromDb(orderNumber);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, targetFileName: updatedFull.pdfFileName, order: updatedFull }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pedido no existe en la Base de Datos' }));
        return;
      }

      // 8.1 ACTUALIZAR PROGRESO DE ESCANEO EN SQLITE
      if (req.url === '/api/update-scan-progress' && req.method === 'POST') {
        const { orderNumber, items, totalItemsScanned } = data;
        const order = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);

        if (order) {
          if (Array.isArray(items)) {
            const updateItemStmt = db.prepare(`
              UPDATE order_items
              SET quantityScanned = ?, status = ?
              WHERE orderNumber = ? AND (id = ? OR code = ?)
            `);

            for (const item of items) {
              const status = item.quantityScanned >= item.quantityRequired ? 'COMPLETED' : item.quantityScanned > 0 ? 'IN_PROGRESS' : 'PENDING';
              updateItemStmt.run(item.quantityScanned, status, orderNumber, item.id || '', item.code || '');
            }
          }

          if (typeof totalItemsScanned === 'number') {
            db.prepare('UPDATE orders SET totalItemsScanned = ? WHERE orderNumber = ?').run(totalItemsScanned, orderNumber);
          }

          console.log(`[ESCÁNER SQLITE] Avance guardado para Pedido #${orderNumber}: ${totalItemsScanned} U.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 9. LIBERAR PEDIDO (CAMBIO DE ESTADO EN SQLITE A READY)
      if (req.url === '/api/release-order' && req.method === 'POST') {
        const { orderNumber, userEmail, email } = data;
        const opEmail = (userEmail || email || 'jsrxar@gmail.com').trim().toLowerCase();

        const order = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          db.prepare("UPDATE orders SET status = 'READY', operatorEmail = NULL WHERE orderNumber = ?").run(orderNumber);
          db.prepare(`
            INSERT INTO audit_logs (orderNumber, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(orderNumber, now, opEmail, 'LIBERAR_PEDIDO', `Pedido #${orderNumber} liberado por ${opEmail}. Devuelto a columna LISTO (READY).`);

          console.log(`[LOG AUDITORÍA] Pedido ${orderNumber} liberado por ${opEmail}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10. FINALIZAR PEDIDO (CAMBIO DE ESTADO EN SQLITE A DONE CON MARCA DE AGUA)
      if (req.url === '/api/complete-order' && req.method === 'POST') {
        const { orderNumber, userEmail, email, watermarkText } = data;
        const opEmail = (userEmail || email || 'jsrxar@gmail.com').trim().toLowerCase();

        const order = db.prepare('SELECT * FROM orders WHERE orderNumber = ?').get(orderNumber);
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          const auditStamp = watermarkText || `AUDITADO Y EXPEDIDO POR OPERARIO ${opEmail} | FECHA: ${now}`;

          db.prepare("UPDATE orders SET status = 'DONE', operatorEmail = ?, auditStamp = ?, totalItemsScanned = totalItemsRequired WHERE orderNumber = ?").run(opEmail, auditStamp, orderNumber);
          db.prepare(`
            INSERT INTO audit_logs (orderNumber, timestamp, userEmail, action, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(orderNumber, now, opEmail, 'DESPACHAR_PEDIDO', `Pedido #${orderNumber} auditado y despachado por ${opEmail}. Marca de Agua: ${auditStamp}`);

          console.log(`[LOG AUDITORÍA] Pedido ${orderNumber} despachado por ${opEmail}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, doneFileName: `${orderNumber}.pdf` }));
        return;
      }

      // 11. SUBIDA Y VALIDACIÓN DE COMPROBANTE PDF EN ADMIN (CON PDF BLOB EN SQLITE)
      if (req.url === '/api/upload-pdf' && req.method === 'POST') {
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

        const now = new Date().toLocaleString('es-AR');
        const totalItemsRequired = parsed.items.reduce((acc, i) => acc + i.quantityRequired, 0);

        // Guardar Orden principal en SQLite con el Blob Base64
        db.prepare(`
          INSERT OR REPLACE INTO orders (orderNumber, clientName, issueDate, pdfFileName, pdfBlob, status, operatorEmail, totalItemsRequired, totalItemsScanned, auditStamp, createdAt)
          VALUES (?, ?, ?, ?, ?, 'BACKLOG', NULL, ?, 0, NULL, ?)
        `).run(
          parsed.orderNumber,
          parsed.clientName,
          new Date().toLocaleDateString('es-AR'),
          cleanName,
          pdfBase64,
          totalItemsRequired,
          now
        );

        // Limpiar e insertar ítems relacionales en order_items
        db.prepare('DELETE FROM order_items WHERE orderNumber = ?').run(parsed.orderNumber);
        const insertItemStmt = db.prepare(`
          INSERT INTO order_items (id, orderNumber, code, description, unitPrice, quantityRequired, quantityScanned, status)
          VALUES (?, ?, ?, ?, ?, ?, 0, 'PENDING')
        `);

        parsed.items.forEach((item, idx) => {
          insertItemStmt.run(`item_${parsed.orderNumber}_${idx}`, parsed.orderNumber, item.code, item.description, item.unitPrice || 0, item.quantityRequired);
        });

        // Insertar log de auditoría
        db.prepare(`
          INSERT INTO audit_logs (orderNumber, timestamp, userEmail, action, details)
          VALUES (?, ?, ?, ?, ?)
        `).run(parsed.orderNumber, now, email, 'CARGA_COMPROBANTE', `Comprobante PDF parseado y Blob guardado en SQLite por ${email}.`);

        console.log(`[ADMIN LOG] Comprobante PDF ${parsed.orderNumber} (${parsed.clientName}) parseado y guardado en SQLite por ${email}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fileName: cleanName, orderNumber: parsed.orderNumber, message: 'Comprobante parseado y publicado en backlog en SQLite' }));
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
  console.log(`🔑 Admin Default: ${processEnv.ADMIN_EMAIL} / ${processEnv.ADMIN_PASSWORD}`);
});
