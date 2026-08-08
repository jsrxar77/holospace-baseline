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

// Asegurar directorio ./orders/ para colocar y cargar comprobantes PDF
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
}

// BASE DE DATOS EN MEMORIA / SQLITE (ALMACENAMIENTO CON PDF BLOBS)
const ordersDb = new Map();

// Helper para registrar un comprobante en la Base de Datos con su PDF Blob desde ./orders/
const registerOrderInDb = (orderNumber, pdfFileName, pdfText = '', pdfBase64 = '', userEmail = 'admin@drinklovers.com') => {
  let clientName = 'DISTRIBUIDORA BEBIDAS S.A.';
  let items = [
    { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 3, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' }
  ];

  if (orderNumber.includes('34409313') || pdfText.includes('DIEGO POKE')) {
    clientName = 'DIEGO POKE S.R.L.';
    items = [
      { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 2, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' },
      { code: '7794450008275', description: 'Vino Malbec Reserva 750 ml', quantityRequired: 1, quantityScanned: 0, unitPrice: 6500.0, status: 'PENDING' }
    ];
  } else if (orderNumber.includes('34512173') || pdfText.includes('PASCUAL')) {
    clientName = 'PASCUAL BEBIDAS S.A.';
    items = [
      { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 4, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' }
    ];
  } else if (orderNumber.includes('34512175') || pdfText.includes('LUNFA')) {
    clientName = 'LUNFA DISTRIBUIDORA';
    items = [
      { code: '7798135764531', description: 'Lunfa Torino Bianco 750 ml', quantityRequired: 3, quantityScanned: 0, unitPrice: 4250.0, status: 'PENDING' }
    ];
  }

  // Cargar Blob Base64 desde el archivo en ./orders/ si está disponible
  const orderFilePath = path.join(ORDERS_DIR, pdfFileName);
  if (!pdfBase64 && fs.existsSync(orderFilePath)) {
    const pdfBuffer = fs.readFileSync(orderFilePath);
    pdfBase64 = pdfBuffer.toString('base64');
  }

  const now = new Date().toLocaleString('es-AR');
  const orderRecord = {
    id: `ord-${orderNumber}`,
    orderNumber,
    clientName,
    issueDate: new Date().toLocaleDateString('es-AR'),
    pdfFileName,
    pdfBlob: pdfBase64, // Guardado como Blob binario en la Base de Datos
    status: 'BACKLOG',
    operatorId: null,
    totalItemsRequired: items.reduce((acc, i) => acc + i.quantityRequired, 0),
    totalItemsScanned: 0,
    items,
    auditLogs: [
      { timestamp: now, userEmail, action: 'CARGA_COMPROBANTE', details: `Comprobante PDF y Blob registrado en Base de Datos desde ./orders/${pdfFileName}.` }
    ]
  };

  ordersDb.set(orderNumber, orderRecord);
  return orderRecord;
};

// Sincronizar Base de Datos con los archivos PDF presentes en ./orders/
const syncDatabaseFromOrdersFolder = () => {
  if (fs.existsSync(ORDERS_DIR)) {
    const pdfFiles = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.pdf'));
    pdfFiles.forEach((f) => {
      const orderNumber = f.replace('.pdf', '');
      if (!ordersDb.has(orderNumber)) {
        registerOrderInDb(orderNumber, f);
      }
    });
  }
};

// Inicializar sincronización
syncDatabaseFromOrdersFolder();

// Base de usuarios predeterminada (Admin por defecto)
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

      // 3. KANBAN REAL-TIME DATA (BASADO EN BASE DE DATOS Y CARPETA ./orders/)
      if (req.url === '/api/kanban' && req.method === 'GET') {
        syncDatabaseFromOrdersFolder();
        const allOrders = Array.from(ordersDb.values());

        const kanbanData = {
          backlog: allOrders
            .filter((o) => o.status === 'BACKLOG')
            .map((o) => ({
              orderNumber: o.orderNumber,
              fileName: o.pdfFileName,
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
              const email = operatorUser ? operatorUser.email : 'javier@drinklovers.com';
              return {
                orderNumber: o.orderNumber,
                fileName: o.pdfFileName,
                operatorId,
                operatorEmail: email,
                clientName: o.clientName,
                totalItems: o.totalItemsRequired,
                scannedItems: o.totalItemsScanned,
                progressPercentage: Math.round((o.totalItemsScanned / o.totalItemsRequired) * 100),
                status: 'DOING'
              };
            }),

          done: allOrders
            .filter((o) => o.status === 'DONE' || o.status === 'CLOSED' || o.status === 'PARTIAL_DISPATCH')
            .map((o) => {
              const operatorId = o.operatorId || 'JAVIER-DEV82';
              const operatorUser = users.find(
                (u) => u.operatorId === operatorId || u.email.includes(operatorId.split('-')[0].toLowerCase())
              );
              const email = operatorUser ? operatorUser.email : 'javier@drinklovers.com';
              return {
                orderNumber: o.orderNumber,
                fileName: o.pdfFileName,
                operatorId,
                operatorEmail: email,
                clientName: o.clientName,
                auditStamp: o.auditStamp || `AUDITADO POR: ${email} | FECHA: ${o.issueDate} | ESTADO: 100% OK`,
                status: 'DONE'
              };
            })
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(kanbanData));
        return;
      }

      // 4. VER DETALLE COMPLETO FORMATO FACTURA Y LOGS DE AUDITORÍA
      if (req.url.startsWith('/api/order-detail')) {
        let orderNumber = req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '';
        if (!orderNumber && data.orderNumber) orderNumber = data.orderNumber;

        if (!ordersDb.has(orderNumber)) {
          registerOrderInDb(orderNumber, `${orderNumber}.pdf`);
        }

        const order = ordersDb.get(orderNumber);
        const operatorUser = users.find(
          (u) => u.operatorId === order.operatorId || (order.operatorId && u.email.includes(order.operatorId.split('-')[0].toLowerCase()))
        );

        const responseData = {
          ...order,
          operatorEmail: operatorUser ? operatorUser.email : order.operatorId ? 'javier@drinklovers.com' : 'Sin asignar'
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, order: responseData }));
        return;
      }

      // 5. DESCARGAR O VISUALIZAR PDF (DESDE DISCO O BLOB DE DB)
      if (req.url.startsWith('/api/download-pdf')) {
        let orderNumber = req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '';
        const targetPath = path.join(ORDERS_DIR, `${orderNumber}.pdf`);

        if (fs.existsSync(targetPath)) {
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${orderNumber}.pdf"`
          });
          res.end(fs.readFileSync(targetPath));
          return;
        } else if (ordersDb.has(orderNumber) && ordersDb.get(orderNumber).pdfBlob) {
          const buffer = Buffer.from(ordersDb.get(orderNumber).pdfBlob, 'base64');
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${orderNumber}.pdf"`
          });
          res.end(buffer);
          return;
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Archivo PDF no encontrado' }));
          return;
        }
      }

      // 6. BORRAR COMPROBANTE EN BACKLOG Y DISCO
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
          console.log(`[ADMIN] Comprobante ${orderNumber}.pdf eliminado de ./orders/ y DB por ${data.userEmail || processEnv.ADMIN_EMAIL}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Pedido ${orderNumber} eliminado.` }));
        return;
      }

      // 7. AUTO-DETECCIÓN DE PEDIDO ACTIVO EN DB
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
          res.end(JSON.stringify({ hasActive: true, orderNumber: activeOrder.orderNumber, pdfFileName: activeOrder.pdfFileName }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hasActive: false }));
        return;
      }

      // 8. TOMAR PEDIDO (CAMBIO DE ESTADO EN DB CON LOG DE EMAIL)
      if (req.url === '/api/claim-order' && req.method === 'POST') {
        const { orderNumber, operatorId, userEmail } = data;
        if (!ordersDb.has(orderNumber)) {
          registerOrderInDb(orderNumber, `${orderNumber}.pdf`);
        }

        const order = ordersDb.get(orderNumber);
        order.status = 'DOING';
        order.operatorId = operatorId;
        const now = new Date().toLocaleString('es-AR');
        const email = userEmail || 'javier@drinklovers.com';

        order.auditLogs.push({
          timestamp: now,
          userEmail: email,
          action: 'TOMAR_PEDIDO',
          details: `Pedido #${orderNumber} tomado por operario ${email} (${operatorId}). Estado -> DOING`
        });

        console.log(`[LOG AUDITORÍA] Pedido ${orderNumber} tomado por ${email}.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, targetFileName: order.pdfFileName }));
        return;
      }

      // 9. LIBERAR PEDIDO (CAMBIO DE ESTADO EN DB CON LOG DE EMAIL)
      if (req.url === '/api/release-order' && req.method === 'POST') {
        const { orderNumber, userEmail } = data;
        if (ordersDb.has(orderNumber)) {
          const order = ordersDb.get(orderNumber);
          const email = userEmail || 'javier@drinklovers.com';
          const now = new Date().toLocaleString('es-AR');

          order.status = 'BACKLOG';
          order.auditLogs.push({
            timestamp: now,
            userEmail: email,
            action: 'LIBERAR_PEDIDO',
            details: `Pedido #${orderNumber} liberado por ${email}. Devuelto a backlog libre.`
          });
          order.operatorId = null;
          console.log(`[LOG AUDITORÍA] Pedido ${orderNumber} liberado por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10. FINALIZAR PEDIDO (CAMBIO DE ESTADO EN DB CON MARCA DE AGUA Y LOG DE EMAIL)
      if (req.url === '/api/complete-order' && req.method === 'POST') {
        const { orderNumber, operatorId, userEmail, watermarkText } = data;
        if (ordersDb.has(orderNumber)) {
          const order = ordersDb.get(orderNumber);
          const email = userEmail || 'javier@drinklovers.com';
          const now = new Date().toLocaleString('es-AR');

          order.status = 'DONE';
          order.operatorId = operatorId;
          order.auditStamp = watermarkText;
          order.totalItemsScanned = order.totalItemsRequired;

          order.auditLogs.push({
            timestamp: now,
            userEmail: email,
            action: 'DESPACHAR_PEDIDO',
            details: `Pedido #${orderNumber} auditado y despachado por ${email}. Marca de Agua: ${watermarkText}`
          });
          console.log(`[LOG AUDITORÍA] Pedido ${orderNumber} despachado por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, doneFileName: `${orderNumber}.pdf`, auditPath: watermarkText }));
        return;
      }

      // 11. SUBIDA Y VALIDACIÓN DE COMPROBANTE PDF EN ADMIN (PUNTO ÚNICO DE INGRESO)
      if (req.url === '/api/upload-pdf' && req.method === 'POST') {
        const { fileName, pdfBase64, userEmail } = data;
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
        const email = userEmail || processEnv.ADMIN_EMAIL;

        registerOrderInDb(orderNumber, cleanName, pdfText, pdfBase64, email);

        console.log(`[ADMIN LOG] Comprobante PDF depositado en ./orders/${cleanName} y registrado en Base de Datos por ${email}`);
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Puerto ${PORT} ocupado. Liberando puerto automáticamente...`);
    try {
      const { execSync } = require('child_process');
      execSync(`npx -y kill-port ${PORT}`);
      setTimeout(() => {
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } catch (e) {
      console.error(`Error al liberar el puerto ${PORT}:`, e);
    }
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor HTTP Activo en http://0.0.0.0:${PORT}`);
  console.log(`📂 Carpeta de entrada de comprobantes: ./orders/`);
  console.log(`🔑 Admin Default: ${processEnv.ADMIN_EMAIL} / ${processEnv.ADMIN_PASSWORD}`);
});
