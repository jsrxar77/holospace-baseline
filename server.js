const http = require('http');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno desde .env
let processEnv = {
  PORT: process.env.PORT || '3001',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@drinklovers.com',
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
const ORDERS_DIR = path.join(__dirname, 'orders');
const USERS_FILE = path.join(__dirname, 'users.json');

// Asegurar directorio orders
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
}

// Base de datos en memoria para pedidos y PDF blobs
const ordersDb = new Map();

const seedOrderData = (orderNumber, pdfFileName, status = 'BACKLOG', operatorId = null) => {
  let clientName = 'LUNFA DISTRIBUIDORA';
  let items = [
    { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 3, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' }
  ];

  if (orderNumber === '34409313') {
    clientName = 'DIEGO POKE S.R.L.';
    items = [
      { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 2, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' },
      { code: '7794450008275', description: 'Vino Malbec Reserva 750 ml', quantityRequired: 1, quantityScanned: 0, unitPrice: 6500.0, status: 'PENDING' }
    ];
  } else if (orderNumber === '34512173') {
    clientName = 'PASCUAL BEBIDAS S.A.';
    items = [
      { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 4, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' }
    ];
  }

  ordersDb.set(orderNumber, {
    id: `ord-${orderNumber}`,
    orderNumber,
    clientName,
    issueDate: new Date().toLocaleDateString('es-AR'),
    pdfFileName: `${orderNumber}.pdf`,
    status,
    operatorId,
    totalItemsRequired: items.reduce((acc, i) => acc + i.quantityRequired, 0),
    totalItemsScanned: status === 'DOING' ? 1 : status === 'DONE' ? items.reduce((acc, i) => acc + i.quantityRequired, 0) : 0,
    items
  });
};

// Base de usuarios predeterminada
let users = [
  {
    id: 'u-admin-1',
    email: processEnv.ADMIN_EMAIL,
    password: processEnv.ADMIN_PASSWORD,
    name: 'Administrador Principal',
    role: 'ADMIN'
  },
  {
    id: 'u-op-1',
    email: 'javier@drinklovers.com',
    password: 'op123456',
    name: 'Javier Operario',
    role: 'OPERATOR',
    operatorId: 'JAVIER-DEV82'
  }
];

if (fs.existsSync(USERS_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (Array.isArray(saved) && saved.length > 0) {
      users = saved;
    }
  } catch (e) {}
} else {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

const saveUsers = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Servir archivos estáticos del Panel Web Admin (/admin o /)
  if (req.method === 'GET' && (!req.url.startsWith('/api/') || req.url === '/')) {
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(__dirname, 'public', 'index.html');
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};

      // 1. AUTH: LOGIN (Email + Password)
      if (req.url === '/api/login' && req.method === 'POST') {
        const { email, password } = data;
        const user = users.find(
          (u) => u.email.toLowerCase() === (email || '').toLowerCase() && u.password === password
        );

        if (user) {
          console.log(`[AUTH] Login exitoso: ${user.email} (${user.role})`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                operatorId: user.operatorId || `${user.name.split(' ')[0].toUpperCase()}-DEV82`
              },
              token: `token_${user.id}_${Date.now()}`
            })
          );
        } else {
          console.log(`[AUTH] Intento de login fallido para: ${email}`);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Email o contraseña incorrectos' }));
        }
        return;
      }

      // 2. AUTH: LISTAR / CREAR USUARIOS
      if (req.url === '/api/users' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ users: users.map(({ password, ...u }) => u) }));
        return;
      }

      if (req.url === '/api/users' && req.method === 'POST') {
        const { email, password, name, role } = data;
        if (!email || !password || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Faltan campos obligatorios (email, password, name)' }));
          return;
        }

        const newUser = {
          id: `u-${Date.now()}`,
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          role: role === 'ADMIN' ? 'ADMIN' : 'OPERATOR',
          operatorId: `${name.split(' ')[0].toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`
        };

        users.push(newUser);
        saveUsers();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user: newUser }));
        return;
      }

      // 3. KANBAN REAL-TIME DATA (Backlog, Doing, Done 100% DB)
      if (req.url === '/api/kanban' && req.method === 'GET') {
        const orderFiles = fs.existsSync(ORDERS_DIR) ? fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.pdf')) : [];
        orderFiles.forEach((f) => {
          const orderNumber = f.replace('.pdf', '');
          if (!ordersDb.has(orderNumber)) {
            seedOrderData(orderNumber, f, 'BACKLOG');
          }
        });

        const allOrders = Array.from(ordersDb.values());

        const kanbanData = {
          backlog: allOrders
            .filter((o) => o.status === 'BACKLOG')
            .map((o) => ({
              orderNumber: o.orderNumber,
              fileName: `${o.orderNumber}.pdf`,
              clientName: o.clientName,
              totalItems: o.totalItemsRequired,
              scannedItems: 0,
              status: 'BACKLOG'
            })),

          doing: allOrders
            .filter((o) => o.status === 'DOING' || o.status === 'SCANNING')
            .map((o) => {
              const operatorId = o.operatorId || 'OP-DESCONOCIDO';
              const operatorUser = users.find(
                (u) => u.operatorId === operatorId || u.email.includes(operatorId.split('-')[0].toLowerCase())
              );
              return {
                orderNumber: o.orderNumber,
                fileName: `${o.orderNumber}.pdf`,
                operatorId,
                operatorEmail: operatorUser ? operatorUser.email : `${operatorId.toLowerCase()}@drinklovers.com`,
                clientName: o.clientName,
                totalItems: o.totalItemsRequired,
                scannedItems: o.totalItemsScanned,
                progressPercentage: Math.round((o.totalItemsScanned / o.totalItemsRequired) * 100),
                status: 'DOING'
              };
            }),

          done: allOrders
            .filter((o) => o.status === 'DONE' || o.status === 'CLOSED' || o.status === 'PARTIAL_DISPATCH')
            .map((o) => ({
              orderNumber: o.orderNumber,
              fileName: `${o.orderNumber}.pdf`,
              operatorId: o.operatorId || 'JAVIER-DEV82',
              clientName: o.clientName,
              auditStamp: `AUDITADO POR: ${o.operatorId || 'JAVIER-DEV82'} | FECHA: ${o.issueDate} | ESTADO: 100% OK`,
              status: 'DONE'
            }))
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(kanbanData));
        return;
      }

      // 4. VER DETALLE COMPLETO FORMATO FACTURA
      if (req.url.startsWith('/api/order-detail')) {
        let orderNumber = req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '';
        if (!orderNumber && data.orderNumber) orderNumber = data.orderNumber;

        if (!ordersDb.has(orderNumber)) {
          seedOrderData(orderNumber, `${orderNumber}.pdf`);
        }

        const order = ordersDb.get(orderNumber);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, order }));
        return;
      }

      // 5. BORRAR COMPROBANTE EN BACKLOG
      if ((req.url === '/api/delete-order' || req.url.startsWith('/api/delete-order')) && (req.method === 'DELETE' || req.method === 'POST')) {
        const orderNumber = data.orderNumber || (req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '');
        if (!orderNumber) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Falta orderNumber' }));
          return;
        }

        ordersDb.delete(orderNumber);
        const orderFilePath = path.join(ORDERS_DIR, `${orderNumber}.pdf`);
        if (fs.existsSync(orderFilePath)) {
          fs.unlinkSync(orderFilePath);
          console.log(`[ADMIN] Comprobante ${orderNumber}.pdf eliminado de ./orders/ y DB`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Pedido ${orderNumber} eliminado.` }));
        return;
      }

      // 6. AUTO-DETECCIÓN DE PEDIDO ACTIVO EN DB
      if (req.url.startsWith('/api/active-order') || req.url === '/api/check-active-order') {
        let operatorId = data.operatorId;
        if (!operatorId && req.url.includes('operatorId=')) {
          operatorId = req.url.split('operatorId=')[1].split('&')[0];
        }

        const activeOrder = Array.from(ordersDb.values()).find(
          (o) => (o.status === 'DOING' || o.status === 'SCANNING') && (!operatorId || o.operatorId === operatorId)
        );

        if (activeOrder) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hasActive: true, orderNumber: activeOrder.orderNumber, pdfFileName: `${activeOrder.orderNumber}.pdf` }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hasActive: false }));
        return;
      }

      // 7. TOMAR PEDIDO (CAMBIO DE ESTADO EN DB)
      if (req.url === '/api/claim-order' && req.method === 'POST') {
        const { orderNumber, operatorId } = data;
        if (!ordersDb.has(orderNumber)) {
          seedOrderData(orderNumber, `${orderNumber}.pdf`);
        }

        const order = ordersDb.get(orderNumber);
        order.status = 'DOING';
        order.operatorId = operatorId;

        console.log(`[SERVER DB] Pedido ${orderNumber} tomado por ${operatorId}. Estado -> DOING`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, targetFileName: `${orderNumber}.pdf` }));
        return;
      }

      // 8. LIBERAR PEDIDO (CAMBIO DE ESTADO EN DB)
      if (req.url === '/api/release-order' && req.method === 'POST') {
        const { orderNumber } = data;
        if (ordersDb.has(orderNumber)) {
          const order = ordersDb.get(orderNumber);
          order.status = 'BACKLOG';
          order.operatorId = null;
          console.log(`[SERVER DB] Pedido ${orderNumber} liberado. Estado -> BACKLOG`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 9. FINALIZAR PEDIDO (CAMBIO DE ESTADO EN DB CON MARCA DE AGUA)
      if (req.url === '/api/complete-order' && req.method === 'POST') {
        const { orderNumber, operatorId, watermarkText } = data;
        if (ordersDb.has(orderNumber)) {
          const order = ordersDb.get(orderNumber);
          order.status = 'DONE';
          order.operatorId = operatorId;
          order.auditStamp = watermarkText;
          order.totalItemsScanned = order.totalItemsRequired;
          console.log(`[SERVER DB] Pedido ${orderNumber} finalizado y archivado. Estado -> DONE`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, doneFileName: `${orderNumber}.pdf`, auditPath: watermarkText }));
        return;
      }

      // 10. SUBIDA Y VALIDACIÓN DE COMPROBANTE PDF EN ADMIN (GUARDAR EN ./orders/)
      if (req.url === '/api/upload-pdf' && req.method === 'POST') {
        const { fileName, pdfBase64 } = data;
        if (!fileName || !pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Debes proporcionar un archivo PDF válido en base64' }));
          return;
        }

        const buffer = Buffer.from(pdfBase64, 'base64');
        const pdfText = buffer.toString('utf8');

        if (!pdfText.includes('%PDF') && !pdfText.includes('obj')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'El archivo subido no es un documento PDF válido' }));
          return;
        }

        const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const targetPath = path.join(ORDERS_DIR, cleanName);
        fs.writeFileSync(targetPath, buffer);

        const orderNumber = cleanName.replace('.pdf', '');
        seedOrderData(orderNumber, cleanName, 'BACKLOG');
        const cached = ordersDb.get(orderNumber);
        if (cached) cached.pdfBlob = pdfBase64;

        console.log(`[ADMIN] Comprobante PDF subido y validado exitosamente en ./orders/: ${targetPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fileName: cleanName, message: 'Comprobante validado y publicado en backlog' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
    } catch (e) {
      console.error('Error en el servidor:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor HTTP Activo en http://0.0.0.0:${PORT}`);
  console.log(`📂 Única carpeta de comprobantes: ./orders/`);
  console.log(`🔑 Admin Default: ${processEnv.ADMIN_EMAIL} / ${processEnv.ADMIN_PASSWORD}`);
});
