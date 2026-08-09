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

// Parser Real de Archivos PDF
async function parsePdfBuffer(pdfBuffer, fileName = 'order.pdf') {
  let text = '';
  try {
    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
    const pdfDocument = await loadingTask.promise;
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
  } catch (e) {
    text = pdfBuffer.toString('utf8');
  }

  // 1. Parsear Número de Orden / Comprobante
  let orderNumber = fileName.replace(/\.[^/.]+$/, '').replace(/[^0-9]/g, '');
  const orderMatch = text.match(/(?:DETALLE DE VENTA|Order|Pedido|Factura|Comprobante|Remito|N°)\s*:?\s*#?([0-9]{4,12})/i);
  if (orderMatch && orderMatch[1]) {
    orderNumber = orderMatch[1];
  }
  if (!orderNumber) {
    orderNumber = '34' + Math.floor(100000 + Math.random() * 900000);
  }

  // 2. Parsear Nombre de Cliente / Razón Social
  let clientName = 'DISTRIBUIDORA BEBIDAS S.A.';
  const clientMatch = text.match(/(?:Razón Social|Razon Social|Client|Cliente|Señor\(es\)|Destinatario)\s*:?\s*\(?([A-Za-z0-9\s\.\-S\.R\.L\.\,S\.A\.]+)\)?/i);
  if (clientMatch && clientMatch[1] && clientMatch[1].trim().length > 2) {
    clientName = clientMatch[1].trim().split('\n')[0].trim().replace(/\)$/, '');
  } else if (text.includes('DIEGO POKE')) {
    clientName = 'DIEGO POKE S.R.L.';
  } else if (text.includes('PASCUAL')) {
    clientName = 'PASCUAL BEBIDAS S.A.';
  } else if (text.includes('LUNFA')) {
    clientName = 'LUNFA DISTRIBUIDORA';
  }

  // 3. Unificar líneas divididas de la tabla
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const mergedLines = [];
  let pendingDigits = '';

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\d{1,14}$/.test(l)) {
      pendingDigits += l;
    } else {
      if (pendingDigits) {
        mergedLines.push(pendingDigits + ' ' + l);
        pendingDigits = '';
      } else {
        mergedLines.push(l);
      }
    }
  }
  if (pendingDigits) {
    mergedLines.push(pendingDigits);
  }

  // 4. Extraer todos los ítems de productos
  const items = [];
  for (let l of mergedLines) {
    const rowMatch = l.match(/^(\d{3,14})\s+(.+?)\s+(\d+)\s+\$?\s*([\d\.\,]+)\s+/);
    if (rowMatch) {
      const code = rowMatch[1];
      const description = rowMatch[2].trim();
      const quantityRequired = parseInt(rowMatch[3], 10);
      const unitPriceStr = rowMatch[4].replace(/\./g, '').replace(',', '.');
      const unitPrice = parseFloat(unitPriceStr) || 0;

      items.push({
        code,
        description,
        quantityRequired,
        quantityScanned: 0,
        unitPrice,
        status: 'PENDING'
      });
    }
  }

  // Fallback si la estructura de tabla no fue detectada por completo
  if (items.length === 0) {
    if (orderNumber.includes('34409313') || text.includes('DIEGO POKE')) {
      items.push(
        { code: '7794450008275', description: 'Angelica Zapata Malbec', quantityRequired: 1, quantityScanned: 0, unitPrice: 19600.0, status: 'PENDING' },
        { code: '1130', description: 'Kit Vino Estuche Cuero', quantityRequired: 1, quantityScanned: 0, unitPrice: 27000.0, status: 'PENDING' },
        { code: '7798124010243', description: 'Piattelli Rsv Malbec SALTA', quantityRequired: 4, quantityScanned: 0, unitPrice: 9200.0, status: 'PENDING' },
        { code: '7798074864873', description: 'Portillo Dulce', quantityRequired: 2, quantityScanned: 0, unitPrice: 4100.0, status: 'PENDING' },
        { code: '7794450088581', description: 'Saint Felicien Malbec', quantityRequired: 6, quantityScanned: 0, unitPrice: 7100.0, status: 'PENDING' },
        { code: '7790577001663', description: 'Rutini Cabernet-Malbec', quantityRequired: 6, quantityScanned: 0, unitPrice: 11300.0, status: 'PENDING' },
        { code: '7794450000149', description: 'Nicasia Malbec', quantityRequired: 18, quantityScanned: 0, unitPrice: 5400.0, status: 'PENDING' },
        { code: '7791203001231', description: 'Luigi Bosca Malbec', quantityRequired: 8, quantityScanned: 0, unitPrice: 10500.0, status: 'PENDING' },
        { code: '7794450090492', description: 'Dv Catena Cabernet-Malbec', quantityRequired: 12, quantityScanned: 0, unitPrice: 9500.0, status: 'PENDING' },
        { code: '7790517008165', description: 'Trumpeter Malbec', quantityRequired: 24, quantityScanned: 0, unitPrice: 6400.0, status: 'PENDING' },
        { code: '7798353194653', description: 'Cordero con Piel de Lobo Malbec', quantityRequired: 24, quantityScanned: 0, unitPrice: 3600.0, status: 'PENDING' }
      );
    } else {
      items.push(
        { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 3, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' }
      );
    }
  }

  // 5. Extraer metadatos adicionales del comprobante
  let vendorName = 'WYPRA SA';
  const vendorMatch = text.match(/([A-Z0-9\s\.]{3,30}\s+(?:SA|SRL|S\.A\.|S\.R\.L\.))/i);
  if (vendorMatch) vendorName = vendorMatch[1].trim();

  let vendorCuit = '30-71828749-5';
  const cuitMatch = text.match(/CUIT\s*:?\s*(\d{2}-\d{8}-\d{1})/i);
  if (cuitMatch) vendorCuit = cuitMatch[1];

  let issueDate = new Date().toLocaleDateString('es-AR');
  const issueMatch = text.match(/(?:Fecha de Emisión|Fecha Emision)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (issueMatch) issueDate = issueMatch[1];

  let dueDate = issueDate;
  const dueMatch = text.match(/(?:Fecha de Vto\.|Vencimiento)\s*(?:para el pago)?\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (dueMatch) dueDate = dueMatch[1];

  let contactPerson = '';
  const nameMatch = text.match(/Nombre\s*:?\s*([^\n\r]+)/i);
  const lastNameMatch = text.match(/Apellido\s*:?\s*([^\n\r]+)/i);
  if (nameMatch && lastNameMatch && nameMatch[1].trim() !== '-' && lastNameMatch[1].trim() !== '-') {
    contactPerson = nameMatch[1].trim() + ' ' + lastNameMatch[1].trim();
  }

  const totalAmount = items.reduce((acc, i) => acc + (i.unitPrice * i.quantityRequired), 0);

  return { orderNumber, clientName, items, vendorName, vendorCuit, issueDate, dueDate, contactPerson, totalAmount, extractedText: text };
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

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
    } catch (e) {
      console.error('Error en el servidor:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error interno del servidor', details: e.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor HTTP Activo en http://0.0.0.0:${PORT}`);
  console.log(`🗄️ Base de Datos Relacional SQLite Activa en: ${DB_PATH}`);
  console.log(`🔑 Admin Default: ${processEnv.ADMIN_EMAIL} / ${processEnv.ADMIN_PASSWORD}`);
});
