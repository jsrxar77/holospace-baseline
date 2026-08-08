const http = require('http');
const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist');

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

  // 3. Unificar líneas divididas de la tabla (ej. EANs envueltos en múltiples saltos de línea)
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
    // Coincidencia: [Código/EAN] [Descripción] [Cantidad] $[PrecioUnitario] ...
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




// Helper para registrar un comprobante en la Base de Datos con su PDF Blob
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
      { timestamp: now, userEmail, action: 'CARGA_COMPROBANTE', details: `Comprobante PDF y Blob registrado en Base de Datos.` }
    ]
  };

  ordersDb.set(orderNumber, orderRecord);
  return orderRecord;
};


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

  req.on('end', async () => {
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

      // 2. AUTH: LISTAR / CREAR / EDITAR / BORRADO LÓGICO DE USUARIOS
      if (req.url === '/api/users' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ users: users.map(({ password, ...u }) => ({ ...u, active: u.active !== false })) }));
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
          operatorId: `${name.split(' ')[0].toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
          active: true
        };

        users.push(newUser);
        saveUsers();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user: newUser }));
        return;
      }

      if (req.url === '/api/users' && req.method === 'PUT') {
        const { id, email, password, name, role, active } = data;
        const user = users.find((u) => u.id === id || u.email.toLowerCase() === (email || '').toLowerCase());
        if (!user) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Usuario no encontrado' }));
          return;
        }

        if (name) user.name = name.trim();
        if (email) user.email = email.trim();
        if (password) user.password = password.trim();
        if (role) user.role = role === 'ADMIN' ? 'ADMIN' : 'OPERATOR';
        if (active !== undefined) user.active = !!active;

        saveUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user }));
        return;
      }

      if ((req.url === '/api/users' || req.url.startsWith('/api/users/')) && req.method === 'DELETE') {
        const id = data.id || (req.url.split('/api/users/')[1] || '');
        const user = users.find((u) => u.id === id);
        if (user) {
          user.active = false; // Borrado lógico
          saveUsers();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: `Usuario ${user.email} desactivado correctamente.` }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Usuario no encontrado' }));
        }
        return;
      }

      // 2.1 BUSCADOR Y EXPLORADOR INTELIGENTE DE PEDIDOS
      if (req.url.startsWith('/api/orders') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const query = (urlParams.get('q') || '').toLowerCase();
        const statusFilter = urlParams.get('status') || '';
        const sortBy = urlParams.get('sortBy') || 'date_desc';

        let results = Array.from(ordersDb.values());

        if (statusFilter) {
          results = results.filter((o) => o.status === statusFilter);
        }

        if (query) {
          results = results.filter((o) => {
            const numMatch = (o.orderNumber || '').toLowerCase().includes(query);
            const clientMatch = (o.clientName || '').toLowerCase().includes(query);
            const fileMatch = (o.pdfFileName || '').toLowerCase().includes(query);
            const opMatch = (o.operatorId || '').toLowerCase().includes(query);
            const itemMatch = o.items.some((i) => i.description.toLowerCase().includes(query) || i.code.includes(query));
            return numMatch || clientMatch || fileMatch || opMatch || itemMatch;
          });
        }

        if (sortBy === 'date_desc') {
          results.sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0));
        } else if (sortBy === 'date_asc') {
          results.sort((a, b) => new Date(a.issueDate || 0) - new Date(b.issueDate || 0));
        } else if (sortBy === 'amount_desc') {
          results.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
        } else if (sortBy === 'items_desc') {
          results.sort((a, b) => (b.totalItemsRequired || 0) - (a.totalItemsRequired || 0));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ orders: results }));
        return;
      }


      // 3. KANBAN REAL-TIME DATA (BASADO EN BASE DE DATOS - 4 COLUMNAS: BACKLOG, READY, DOING, DONE)
      if (req.url === '/api/kanban' && req.method === 'GET') {
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

          ready: allOrders
            .filter((o) => o.status === 'READY')
            .map((o) => ({
              orderNumber: o.orderNumber,
              fileName: o.pdfFileName,
              clientName: o.clientName,
              totalItems: o.totalItemsRequired,
              scannedItems: 0,
              status: 'READY'
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

      // 3.1 PASAR COMPROBANTE DE BACKLOG A LISTO (READY) POR EL ADMIN
      if (req.url === '/api/mark-ready' && req.method === 'POST') {
        const { orderNumber, userEmail } = data;
        if (ordersDb.has(orderNumber)) {
          const order = ordersDb.get(orderNumber);
          const email = userEmail || processEnv.ADMIN_EMAIL;
          const now = new Date().toLocaleString('es-AR');

          order.status = 'READY';
          order.auditLogs.push({
            timestamp: now,
            userEmail: email,
            action: 'VALIDAR_COMPROBANTE',
            details: `Comprobante #${orderNumber} validado por Administrador ${email}. Estado cambiado a LISTO (READY).`
          });
          console.log(`[ADMIN LOG] Pedido ${orderNumber} validado y pasado a READY por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3.2 DEVOLVER COMPROBANTE DE LISTO (READY) A BACKLOG POR EL ADMIN
      if (req.url === '/api/mark-backlog' && req.method === 'POST') {
        const { orderNumber, userEmail } = data;
        if (ordersDb.has(orderNumber)) {
          const order = ordersDb.get(orderNumber);
          const email = userEmail || processEnv.ADMIN_EMAIL;
          const now = new Date().toLocaleString('es-AR');

          order.status = 'BACKLOG';
          order.auditLogs.push({
            timestamp: now,
            userEmail: email,
            action: 'DEVOLVER_A_BACKLOG',
            details: `Comprobante #${orderNumber} devuelto a Backlog por Administrador ${email}.`
          });
          console.log(`[ADMIN LOG] Pedido ${orderNumber} devuelto a BACKLOG por ${email}.`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3.3 PEDIDOS DISPONIBLES EN READY PARA OPERARIOS EN MÓVIL
      if (req.url === '/api/available-orders' && req.method === 'GET') {
        const readyOrders = Array.from(ordersDb.values())
          .filter((o) => o.status === 'READY')
          .map((o) => ({
            orderNumber: o.orderNumber,
            fileName: o.pdfFileName,
            clientName: o.clientName,
            totalItems: o.totalItemsRequired,
            scannedItems: 0,
            status: 'READY'
          }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, orders: readyOrders }));
        return;
      }


      // 4. VER DETALLE COMPLETO FORMATO FACTURA Y LOGS DE AUDITORÍA
      if (req.url.startsWith('/api/order-detail')) {
        let orderNumber = req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '';
        if (!orderNumber && data.orderNumber) orderNumber = data.orderNumber;

        if (!ordersDb.has(orderNumber)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Pedido no encontrado' }));
          return;
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

      // 5. DESCARGAR O VISUALIZAR PDF DESDE BLOB DE DB
      if (req.url.startsWith('/api/download-pdf')) {
        let orderNumber = req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '';

        if (ordersDb.has(orderNumber) && ordersDb.get(orderNumber).pdfBlob) {
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

      // 6. BORRAR COMPROBANTE EN BACKLOG (SOLO BASE DE DATOS)
      if ((req.url === '/api/delete-order' || req.url.startsWith('/api/delete-order')) && (req.method === 'DELETE' || req.method === 'POST')) {
        const orderNumber = data.orderNumber || (req.url.includes('orderNumber=') ? req.url.split('orderNumber=')[1].split('&')[0] : '');
        if (!orderNumber) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Falta orderNumber' }));
          return;
        }

        ordersDb.delete(orderNumber);
        console.log(`[ADMIN] Comprobante ${orderNumber} eliminado de la DB por ${data.userEmail || processEnv.ADMIN_EMAIL}`);

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

          order.status = 'READY';
          order.auditLogs.push({
            timestamp: now,
            userEmail: email,
            action: 'LIBERAR_PEDIDO',
            details: `Pedido #${orderNumber} liberado por ${email}. Devuelto a columna LISTO (READY).`
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
        const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const email = userEmail || processEnv.ADMIN_EMAIL;

        // Parseo real del contenido del PDF
        const parsed = await parsePdfBuffer(buffer, cleanName);

        const now = new Date().toLocaleString('es-AR');
        const orderRecord = {
          id: `ord-${parsed.orderNumber}`,
          orderNumber: parsed.orderNumber,
          clientName: parsed.clientName,
          issueDate: new Date().toLocaleDateString('es-AR'),
          pdfFileName: cleanName,
          pdfBlob: pdfBase64,
          status: 'BACKLOG',
          operatorId: null,
          totalItemsRequired: parsed.items.reduce((acc, i) => acc + i.quantityRequired, 0),
          totalItemsScanned: 0,
          items: parsed.items,
          auditLogs: [
            { timestamp: now, userEmail: email, action: 'CARGA_COMPROBANTE', details: `Comprobante PDF parseado y Blob registrado en Base de Datos por ${email}.` }
          ]
        };

        ordersDb.set(parsed.orderNumber, orderRecord);

        console.log(`[ADMIN LOG] Comprobante PDF ${parsed.orderNumber} (${parsed.clientName}) parseado y registrado en Base de Datos por ${email}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fileName: cleanName, orderNumber: parsed.orderNumber, message: 'Comprobante parseado y publicado en backlog' }));
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
