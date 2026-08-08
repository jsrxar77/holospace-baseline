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
const BASE_DIR = path.join(__dirname, 'delivery');
const BACKLOG_DIR = path.join(BASE_DIR, 'backlog');
const DOING_DIR = path.join(BASE_DIR, 'doing');
const DONE_DIR = path.join(BASE_DIR, 'done');
const USERS_FILE = path.join(__dirname, 'users.json');

// Asegurar directorios
[BACKLOG_DIR, DOING_DIR, DONE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Base de datos en memoria / disco de respaldo para pedidos y PDF blobs
const ordersDb = new Map();

const seedOrderData = (orderNumber, pdfFileName, folder = 'backlog', operatorId = null) => {
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
    pdfFileName,
    status: folder === 'backlog' ? 'BACKLOG' : folder === 'doing' ? 'DOING' : 'DONE',
    operatorId,
    totalItemsRequired: items.reduce((acc, i) => acc + i.quantityRequired, 0),
    totalItemsScanned: folder === 'doing' ? 1 : folder === 'done' ? items.reduce((acc, i) => acc + i.quantityRequired, 0) : 0,
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

      // 3. KANBAN REAL-TIME DATA (Backlog, Doing, Done)
      if (req.url === '/api/kanban' && req.method === 'GET') {
        const backlogFiles = fs.existsSync(BACKLOG_DIR) ? fs.readdirSync(BACKLOG_DIR).filter((f) => f.endsWith('.pdf')) : [];
        const doingFiles = fs.existsSync(DOING_DIR) ? fs.readdirSync(DOING_DIR).filter((f) => f.endsWith('.pdf')) : [];
        const doneFiles = fs.existsSync(DONE_DIR) ? fs.readdirSync(DONE_DIR).filter((f) => f.endsWith('.pdf')) : [];

        const kanbanData = {
          backlog: backlogFiles.map((f) => {
            const orderNumber = f.replace('.pdf', '');
            if (!ordersDb.has(orderNumber)) seedOrderData(orderNumber, f, 'backlog');
            const cached = ordersDb.get(orderNumber);
            return {
              orderNumber,
              fileName: f,
              clientName: cached ? cached.clientName : 'CLIENTE DEPÓSITO',
              totalItems: cached ? cached.totalItemsRequired : 3,
              scannedItems: 0,
              status: 'BACKLOG'
            };
          }),
          doing: doingFiles.map((f) => {
            const parts = f.replace('.pdf', '').split('-');
            const orderNumber = parts[0];
            const operatorId = parts.slice(1).join('-') || 'OP-DESCONOCIDO';
            if (!ordersDb.has(orderNumber)) seedOrderData(orderNumber, f, 'doing', operatorId);
            const cached = ordersDb.get(orderNumber);

            const operatorUser = users.find((u) => u.operatorId === operatorId || u.email.includes(operatorId.split('-')[0].toLowerCase()));

            return {
              orderNumber,
              fileName: f,
              operatorId,
              operatorEmail: operatorUser ? operatorUser.email : `${operatorId.toLowerCase()}@drinklovers.com`,
              clientName: cached ? cached.clientName : 'CLIENTE DEPÓSITO',
              totalItems: cached ? cached.totalItemsRequired : 3,
              scannedItems: cached ? cached.totalItemsScanned : 1,
              progressPercentage: cached ? Math.round((cached.totalItemsScanned / cached.totalItemsRequired) * 100) : 33,
              status: 'DOING'
            };
          }),
          done: doneFiles.map((f) => {
            const parts = f.replace('.pdf', '').split('-');
            const orderNumber = parts[0];
            const operatorId = parts.slice(1).join('-') || 'OP-DESCONOCIDO';
            if (!ordersDb.has(orderNumber)) seedOrderData(orderNumber, f, 'done', operatorId);
            const cached = ordersDb.get(orderNumber);

            const auditFile = path.join(DONE_DIR, `${f.replace('.pdf', '')}.audit.txt`);
            let auditStamp = 'AUDITADO OK';
            if (fs.existsSync(auditFile)) {
              auditStamp = fs.readFileSync(auditFile, 'utf8');
            }

            return {
              orderNumber,
              fileName: f,
              operatorId,
              clientName: cached ? cached.clientName : 'CLIENTE DEPÓSITO',
              auditStamp,
              status: 'DONE'
            };
          })
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
        const backlogPath = path.join(BACKLOG_DIR, `${orderNumber}.pdf`);
        if (fs.existsSync(backlogPath)) {
          fs.unlinkSync(backlogPath);
          console.log(`[ADMIN] Comprobante ${orderNumber}.pdf eliminado de backlog y DB`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Pedido ${orderNumber} eliminado.` }));
        return;
      }

      // 6. AUTO-DETECCIÓN DE PEDIDO ACTIVO
      if (req.url.startsWith('/api/active-order') || req.url === '/api/check-active-order') {
        let operatorId = data.operatorId;
        if (!operatorId && req.url.includes('operatorId=')) {
          operatorId = req.url.split('operatorId=')[1].split('&')[0];
        }

        if (fs.existsSync(DOING_DIR)) {
          const doingFiles = fs.readdirSync(DOING_DIR).filter((f) => f.endsWith('.pdf'));
          let activeFile = null;
          if (operatorId) {
            activeFile = doingFiles.find((f) => f.includes(operatorId));
          }
          if (!activeFile && doingFiles.length > 0) {
            activeFile = doingFiles[0];
          }

          if (activeFile) {
            const orderNumber = activeFile.split('-')[0];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ hasActive: true, orderNumber, pdfFileName: activeFile }));
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hasActive: false }));
        return;
      }

      // 7. TOMAR PEDIDO (backlog -> doing)
      if (req.url === '/api/claim-order' && req.method === 'POST') {
        const { orderNumber, operatorId } = data;
        const cleanFileName = `${orderNumber}.pdf`;
        const targetFileName = `${orderNumber}-${operatorId}.pdf`;

        const srcPath = path.join(BACKLOG_DIR, cleanFileName);
        const destPath = path.join(DOING_DIR, targetFileName);

        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          console.log(`[SERVER] Archivo tomado: delivery/backlog/${cleanFileName} -> delivery/doing/${targetFileName}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, targetFileName }));
        return;
      }

      // 8. LIBERAR PEDIDO (doing -> backlog)
      if (req.url === '/api/release-order' && req.method === 'POST') {
        const { orderNumber, operatorId } = data;
        const doingFileName = `${orderNumber}-${operatorId}.pdf`;
        const cleanFileName = `${orderNumber}.pdf`;

        const doingPath = path.join(DOING_DIR, doingFileName);
        const backlogPath = path.join(BACKLOG_DIR, cleanFileName);

        if (fs.existsSync(doingPath)) {
          fs.renameSync(doingPath, backlogPath);
          console.log(`[SERVER] Archivo liberado: delivery/doing/${doingFileName} -> delivery/backlog/${cleanFileName}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 9. FINALIZAR PEDIDO (doing -> done)
      if (req.url === '/api/complete-order' && req.method === 'POST') {
        const { orderNumber, operatorId, watermarkText } = data;
        const doingFileName = `${orderNumber}-${operatorId}.pdf`;
        const doneFileName = `${orderNumber}-${operatorId}.pdf`;
        const auditTxtFileName = `${orderNumber}-${operatorId}.audit.txt`;

        const doingPath = path.join(DOING_DIR, doingFileName);
        const donePath = path.join(DONE_DIR, doneFileName);
        const auditPath = path.join(DONE_DIR, auditTxtFileName);

        if (fs.existsSync(doingPath)) {
          fs.renameSync(doingPath, donePath);
          console.log(`[SERVER] Archivo finalizado: delivery/doing/${doingFileName} -> delivery/done/${doneFileName}`);
        }

        fs.writeFileSync(auditPath, watermarkText, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, doneFileName, auditPath }));
        return;
      }

      // 10. SUBIDA Y VALIDACIÓN DE COMPROBANTE PDF EN ADMIN
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

        const targetPath = path.join(BACKLOG_DIR, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
        fs.writeFileSync(targetPath, buffer);

        const orderNumber = fileName.replace('.pdf', '');
        seedOrderData(orderNumber, fileName, 'backlog');
        const cached = ordersDb.get(orderNumber);
        if (cached) cached.pdfBlob = pdfBase64;

        console.log(`[ADMIN] Comprobante PDF subido y validado exitosamente: ${targetPath}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fileName, message: 'Comprobante validado y publicado en backlog' }));
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
  console.log(`🔑 Admin Default: ${processEnv.ADMIN_EMAIL} / ${processEnv.ADMIN_PASSWORD}`);
});
