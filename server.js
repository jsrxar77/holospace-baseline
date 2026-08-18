const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const pdfjsLib = require('pdfjs-dist');
const { query, getOne, execute, transaction, DEFAULT_TENANT_ID } = require('./lib/db');
const { hashPassword, verifyPassword, signJwt, verifyJwt, resolveTenantContext } = require('./lib/auth');
const { checkTenantModuleAccess, getTenantEntitlements, setTenantModuleState, getTenantSubscriptionAndUsage, requireModule } = require('./lib/entitlement');
const { PLANS, registerNewTenant, createCheckoutSession, handlePaymentWebhook } = require('./lib/billing');

function getPrimaryLocalIp(req) {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  if (req && req.headers && req.headers.host) {
    const hostPart = req.headers.host.split(':')[0];
    if (hostPart && hostPart !== 'localhost' && hostPart !== '127.0.0.1' && hostPart !== '0.0.0.0' && hostPart !== '::1') {
      return hostPart;
    }
  }
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('172.') && !net.address.startsWith('127.')) {
        return net.address;
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// Leer variables de entorno
let processEnv = {
  HS_PORT: process.env.HS_PORT || process.env.PORT || '3001'
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
        process.env[key] = val;
      }
    }
  });
}

const PORT = parseInt(processEnv.HS_PORT || processEnv.PORT, 10) || 3001;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ERROR_LOG_PATH = path.join(DATA_DIR, 'errors.log');

process.on('uncaughtException', (err) => {
  console.error('[SERVER SAFETY - UNCAUGHT EXCEPTION]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER SAFETY - UNHANDLED REJECTION]', reason ? (reason.message || reason) : 'Unknown');
});

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

// Catálogo de Temas Centralizado
const THEMES = {
  dark_glassmorphism: {
    name: 'Dark Glassmorphism',
    background: '#0B0E14',
    cardBg: 'rgba(18, 24, 38, 0.55)',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
    emerald: '#00E676',
    cobalt: '#3B82F6',
    amber: '#F59E0B',
    red: '#FF5252',
    textMain: '#FFFFFF',
    textMuted: '#8B949E',
    fontFamily: 'Outfit',
    fontMono: 'monospace',
    borderRadius: 24,
    radiusCard: 24,
    radiusBtn: 16,
    radiusBadge: 12,
    borderWidth: 1,
    backdropBlur: 'blur(20px)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
  },
  cyberpunk_glassmorphism: {
    name: 'Cyberpunk Glassmorphism',
    background: '#05050A',
    cardBg: 'rgba(20, 10, 35, 0.70)',
    cardBorder: 'rgba(255, 0, 127, 0.45)',
    emerald: '#00FFCC',
    cobalt: '#FF007F',
    amber: '#FFE600',
    red: '#FF003C',
    textMain: '#FFFFFF',
    textMuted: '#A0A0B0',
    fontFamily: 'Press Start 2P',
    fontMono: 'Press Start 2P',
    borderRadius: 8,
    radiusCard: 8,
    radiusBtn: 6,
    radiusBadge: 4,
    borderWidth: 2,
    backdropBlur: 'blur(16px)',
    boxShadow: '0 0 25px rgba(255, 0, 127, 0.2)'
  },
  omarchy_tiling: {
    name: 'Omarchy Tiling WM (Dracula)',
    background: '#121317',
    cardBg: '#1A1B22',
    cardBorder: '#2E303E',
    emerald: '#50FA7B',
    cobalt: '#BD93F9',
    amber: '#F1FA8C',
    red: '#FF5555',
    textMain: '#F8F8F2',
    textMuted: '#6272A4',
    fontFamily: 'JetBrains Mono',
    fontMono: 'JetBrains Mono',
    borderRadius: 4,
    radiusCard: 4,
    radiusBtn: 4,
    radiusBadge: 2,
    borderWidth: 1,
    backdropBlur: 'none',
    boxShadow: 'none'
  },
  omarchy_aetheria: {
    name: 'Omarchy Aetheria',
    background: '#0E091D',
    cardBg: '#170F2E',
    cardBorder: '#3D256D',
    emerald: '#14B9B5',
    cobalt: '#7C3AED',
    amber: '#FBBF24',
    red: '#A60234',
    textMain: '#F3EEFF',
    textMuted: '#9D8BBF',
    fontFamily: 'JetBrains Mono',
    fontMono: 'JetBrains Mono',
    borderRadius: 4,
    radiusCard: 4,
    radiusBtn: 4,
    radiusBadge: 2,
    borderWidth: 2,
    backdropBlur: 'none',
    boxShadow: 'none'
  },
  soft_minimal_pastel: {
    name: 'Soft Minimal Pastel',
    background: '#1E1E2E',
    cardBg: '#252538',
    cardBorder: '#36364F',
    emerald: '#A6E3A1',
    cobalt: '#89B4FA',
    amber: '#F9E2AF',
    red: '#F38BA8',
    textMain: '#CDD6F4',
    textMuted: '#7F849C',
    fontFamily: 'Plus Jakarta Sans',
    fontMono: 'monospace',
    borderRadius: 16,
    radiusCard: 16,
    radiusBtn: 20,
    radiusBadge: 14,
    borderWidth: 1,
    backdropBlur: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
  }
};

// Parser Real de Archivos PDF con Diagnóstico Estructurado en 3 Pasos
async function parsePdfBuffer(pdfBuffer, fileName = 'order.pdf') {
  let orderNumber = '';
  let clientName = '';
  let issueDate = '';
  let contactPerson = '';

  const items = [];
  let fullText = '';
  const checklist = {
    step1_integrity: { passed: false, title: 'Integridad del Archivo PDF', details: 'Verificando formato binario y estructura...' },
    step2_metadata: { passed: false, title: 'Lectura de Cabecera y Metadatos', details: 'Buscando N° de comprobante, cliente y fecha...' },
    step3_items: { passed: false, title: 'Detección de Productos y Cantidades', details: 'Extrayendo tabla de artículos y cantidades requeridas...' }
  };

  try {
    let cleanBuffer = pdfBuffer;
    // Si el buffer recibido viene como un string base64 o texto
    if (typeof pdfBuffer === 'string') {
      cleanBuffer = Buffer.from(pdfBuffer, 'base64');
    } else if (Buffer.isBuffer(pdfBuffer)) {
      const strStart = pdfBuffer.slice(0, 30).toString('utf8');
      if (strStart.startsWith('JVBERi0') || strStart.startsWith('data:application/pdf;base64,')) {
        const cleanBase64 = pdfBuffer.toString('utf8').replace(/^data:application\/pdf;base64,/, '');
        cleanBuffer = Buffer.from(cleanBase64, 'base64');
      }
    }

    // Paso 1: Validar firma mágica %PDF-
    const headerCheck = cleanBuffer.slice(0, 10).toString('utf8');
    if (!headerCheck.includes('%PDF-')) {
      checklist.step1_integrity = {
        passed: false,
        title: 'Integridad del Archivo PDF',
        details: 'El archivo subido no tiene una estructura PDF válida o está dañado.'
      };
      return {
        success: false,
        checklist,
        error: 'El archivo no tiene una cabecera PDF válida (%PDF-).',
        orderNumber, clientName, issueDate, items
      };
    }

    const data = new Uint8Array(cleanBuffer);
    const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true });
    const pdfDocument = await loadingTask.promise;

    checklist.step1_integrity = {
      passed: true,
      title: 'Integridad del Archivo PDF',
      details: `Estructura PDF válida (${pdfDocument.numPages} página${pdfDocument.numPages > 1 ? 's' : ''}).`
    };

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const content = await page.getTextContent();

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
        } else if (/ORDEN\s*(?:N°|DE COMPRA|#)?\s*([A-Z0-9_-]+)/i.test(l.text)) {
          orderNumber = l.text.match(/ORDEN\s*(?:N°|DE COMPRA|#)?\s*([A-Z0-9_-]+)/i)[1];
        } else if (/FACTURA\s*(?:N°|#)?\s*([A-Z0-9_-]+)/i.test(l.text)) {
          orderNumber = l.text.match(/FACTURA\s*(?:N°|#)?\s*([A-Z0-9_-]+)/i)[1];
        }

        if (/Razón Social:\s*([^\n\r]+)/i.test(l.text)) {
          const m = l.text.match(/Razón Social:\s*([^\n\r]+)/i)[1].trim();
          clientName = m.replace(/\s*CUIT:.*$/, '').trim();
        } else if (/Cliente:\s*([^\n\r]+)/i.test(l.text)) {
          clientName = l.text.match(/Cliente:\s*([^\n\r]+)/i)[1].trim();
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

          items.push({
            code: fullCode || '',
            description: description || '',
            quantityRequired,
            quantityScanned: 0,
            unitPrice,
            status: 'PENDING'
          });
        }
      }
    }

    if (!orderNumber) {
      orderNumber = fileName.replace(/\.[^/.]+$/, '');
    }

    // Paso 2: Evaluación de Cabecera
    if (orderNumber || clientName) {
      checklist.step2_metadata = {
        passed: true,
        title: 'Lectura de Cabecera y Metadatos',
        details: `N° Comprobante: #${orderNumber} | Cliente: ${clientName || 'Consumidor Final'} | Fecha: ${issueDate || 'Hoy'}`
      };
    } else {
      checklist.step2_metadata = {
        passed: false,
        title: 'Lectura de Cabecera y Metadatos',
        details: 'No se detectó número de comprobante ni cliente legible en la cabecera.'
      };
    }

    // Paso 3: Evaluación de Productos
    if (items.length > 0) {
      const totalUnits = items.reduce((acc, i) => acc + (i.quantityRequired || 0), 0);
      checklist.step3_items = {
        passed: true,
        title: 'Detección de Productos y Cantidades',
        details: `${items.length} producto(s) detectado(s) con un total de ${totalUnits} unidad(es) requerida(s).`
      };
    } else {
      checklist.step3_items = {
        passed: false,
        title: 'Detección de Productos y Cantidades',
        details: 'No se detectaron productos o cantidades válidas en el cuerpo del comprobante.'
      };
    }

  } catch (err) {
    console.error('Error parseando PDF con pdfjsLib:', err);
    checklist.step1_integrity = {
      passed: false,
      title: 'Integridad del Archivo PDF',
      details: `Error al decodificar la estructura PDF: ${err.message || 'Archivo corrupto o no legible'}`
    };
  }

  const totalAmount = items.reduce((acc, i) => acc + ((i.unitPrice || 0) * (i.quantityRequired || 0)), 0);
  const isOverallValid = checklist.step1_integrity.passed && items.length > 0;

  return {
    success: isOverallValid,
    checklist,
    orderNumber,
    clientName,
    issueDate,
    contactPerson,
    items,
    totalItems: items.reduce((acc, i) => acc + (i.quantityRequired || 0), 0),
    totalAmount,
    extractedText: fullText
  };
}

// Helper para obtener una orden completa estructurada desde PostgreSQL
async function getFullOrderFromDb(identifier, context = {}) {
  if (!identifier) return null;
  let order = null;

  if (typeof identifier === 'number' || /^\d+$/.test(String(identifier))) {
    order = await getOne('SELECT * FROM orders WHERE id::text = ?', [String(identifier)], context);
  }
  if (!order) {
    order = await getOne('SELECT * FROM orders WHERE uuid = ?', [String(identifier)], context);
  }
  if (!order) {
    order = await getOne('SELECT * FROM orders WHERE order_number = ? ORDER BY created_at DESC LIMIT 1', [String(identifier)], context);
  }
  if (!order) return null;

  const items = await query('SELECT id, order_id as "orderId", code, description, quantity_required as "quantityRequired", quantity_scanned as "quantityScanned", unit_price as "unitPrice", status FROM order_items WHERE order_id = ?', [order.id], context);
  const auditLogs = await query('SELECT id, order_id as "orderId", timestamp, user_email as "userEmail", action, details FROM audit_logs WHERE order_id = ? ORDER BY id ASC', [order.id], context);

  return {
    id: order.id,
    uuid: order.uuid,
    orderNumber: order.order_number,
    clientName: order.client_name,
    issueDate: order.issue_date,
    pdfFileName: order.pdf_file_name,
    status: order.status,
    operatorEmail: order.operator_email || order.assigned_operator_email || null,
    totalItemsRequired: order.total_items_required,
    totalItemsScanned: order.total_items_scanned,
    auditStamp: order.audit_stamp,
    createdAt: order.created_at,
    items,
    auditLogs
  };
}

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const reqPath = req.url.split('?')[0];

  // Rutas estáticas & Rutas directas de Módulos (SPA routing: /tenant, /core, /kanban, /scanner)
  const isSpaModuleRoute = ['/tenant', '/tenants', '/core', '/kanban', '/scanner', '/orders', '/stockflow', '/scanban', '/scanflow'].includes(reqPath);
  if (reqPath === '/' || reqPath === '/index.html' || isSpaModuleRoute) {
    let indexPath = path.join(__dirname, 'public', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(__dirname, 'modules', 'core', 'public', 'index.html');
    }
    fs.readFile(indexPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error cargando index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  if (reqPath === '/app.js') {
    let jsPath = path.join(__dirname, 'public', 'app.js');
    if (!fs.existsSync(jsPath)) {
      jsPath = path.join(__dirname, 'modules', 'core', 'public', 'core.js');
    }
    fs.readFile(jsPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error cargando app.js');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  if (reqPath === '/css/holospace-theme.css' || reqPath.startsWith('/css/')) {
    let cssPath = path.join(__dirname, 'public', reqPath);
    if (!fs.existsSync(cssPath)) {
      cssPath = path.join(__dirname, 'modules', 'core', 'public', reqPath);
    }
    if (fs.existsSync(cssPath)) {
      fs.readFile(cssPath, (err, content) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error cargando CSS');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        res.end(content);
      });
      return;
    }
  }

  // DESCARGA DE COMPROBANTE PDF (BLOB)
  if (req.url.startsWith('/api/scanban/download-pdf')) {
    const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
    const identifier = urlParams.get('id') || urlParams.get('orderId') || urlParams.get('orderNumber');

    if (!identifier) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Falta identificador de pedido (id o orderNumber)' }));
      return;
    }

    try {
      const order = await getOne(
        'SELECT pdf_blob as "pdfBlob", pdf_file_name as "pdfFileName" FROM orders WHERE id::text = ? OR uuid = ? OR order_number = ?',
        [identifier, identifier, identifier],
        { isSuperAdmin: true }
      );

      if (!order || !order.pdfBlob) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Comprobante PDF no encontrado en PostgreSQL' }));
        return;
      }

      const pdfBuffer = Buffer.from(order.pdfBlob, 'base64');
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${order.pdfFileName}"`,
        'Content-Length': pdfBuffer.length
      });
      res.end(pdfBuffer);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    let data = {};
    if (body) {
      try { data = JSON.parse(body); } catch (e) { }
    }

    let currentUser = null;
    const authHeader = req.headers['authorization'] || '';
    const userHeader = req.headers['x-user-email'] || '';
    let emailToFind = '';

    if (authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.substring(7).trim();
      const jwtPayload = verifyJwt(rawToken);
      if (jwtPayload && jwtPayload.email) {
        emailToFind = jwtPayload.email;
        currentUser = jwtPayload;
      } else {
        emailToFind = rawToken;
      }
    } else if (userHeader) {
      emailToFind = userHeader.trim();
    } else if (data && (data.userEmail || data.email)) {
      emailToFind = (data.userEmail || data.email).trim();
    }

    if (emailToFind) {
      try {
        const dbUser = await getOne(
          'SELECT email as id, email, password_hash as password, name, role, is_active as active, tenant_id, theme_preference FROM users WHERE LOWER(email) = ? AND is_active = true',
          [emailToFind.toLowerCase()],
          { isSuperAdmin: true }
        );
        if (dbUser) {
          currentUser = { ...(currentUser || {}), ...dbUser };
        }
      } catch (e) { }
    }

    const tenantContext = await resolveTenantContext(req, currentUser);
    const tenantId = (tenantContext && tenantContext.id) || (tenantContext && tenantContext.tenantId) || (currentUser && (currentUser.tenant_id || currentUser.tenantId)) || DEFAULT_TENANT_ID;

    try {
      // 1. ENDPOINT DE RESETEO EN VIVO (DEVOPS)
      if (req.url === '/api/reset-db' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Servidor sincronizado con PostgreSQL 16.' }));
        return;
      }

      // 1.1 CONFIGURACIÓN Y CONSULTA DE IP DINÁMICA LAN / EXPO Y VERSIÓN
      if (req.url === '/api/config' && req.method === 'GET') {
        const hostIp = getPrimaryLocalIp(req);
        let appVersion = '1.2.1';
        try {
          const pkgPath = path.join(__dirname, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.version) appVersion = pkg.version;
          }
        } catch (e) { }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          version: appVersion,
          hostIp,
          port: PORT,
          metroPort: 8081,
          expoUrl: `exp://${hostIp}:8081`,
          serverUrl: `http://${hostIp}:${PORT}`
        }));
        return;
      }

      // 2. ENDPOINTS DE TEMA CENTRALIZADO (HERENCIA: USUARIO -> TENANT DEFAULT -> PLATAFORMA)
      if (req.url === '/api/theme' && req.method === 'GET') {
        let themeKey = null;
        if (currentUser && currentUser.email) {
          const userRow = await getOne('SELECT theme_preference FROM users WHERE LOWER(email) = ? AND tenant_id = ?', [currentUser.email.toLowerCase(), tenantId], { tenantId, isSuperAdmin: currentUser.role === 'SUPERADMIN' });
          if (userRow && userRow.theme_preference) {
            themeKey = userRow.theme_preference;
          }
        }
        if (!themeKey) {
          const row = await getOne("SELECT value FROM app_settings WHERE key = 'active_theme' AND tenant_id = ?", [tenantId], { tenantId });
          themeKey = row ? row.value : 'omarchy_tiling';
        }
        const theme = THEMES[themeKey] || THEMES.omarchy_tiling;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          themeKey,
          theme,
          availableThemes: Object.keys(THEMES).map(k => ({ key: k, name: THEMES[k].name }))
        }));
        return;
      }

      if (req.url === '/api/theme' && req.method === 'POST') {
        const { themeKey, scope = 'user', targetTenantId } = data || {};
        const targetKey = THEMES[themeKey] ? themeKey : 'omarchy_tiling';

        if (scope === 'tenant') {
          const destTenantId = targetTenantId || tenantId;
          if (!currentUser || (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'ADMIN')) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Permisos insuficientes para definir el tema del Tenant.' }));
            return;
          }

          await execute(
            'INSERT INTO app_settings (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value',
            [destTenantId, 'active_theme', targetKey],
            { tenantId: destTenantId, isSuperAdmin: true }
          );

          await execute(
            'INSERT INTO platform_audit_logs (tenant_id, user_email, action, details) VALUES (?, ?, ?, ?)',
            [destTenantId, currentUser.email, 'TENANT_THEME_CHANGED', JSON.stringify({ themeKey: targetKey, themeName: THEMES[targetKey].name, tenantId: destTenantId })],
            { tenantId: destTenantId, isSuperAdmin: true }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            scope: 'tenant',
            tenantId: destTenantId,
            themeKey: targetKey,
            theme: THEMES[targetKey],
            message: `Tema por defecto del Tenant actualizado a: ${THEMES[targetKey].name}`
          }));
          return;
        }

        // Scope por defecto: 'user' (afecta al usuario autenticado)
        if (currentUser && currentUser.email) {
          await execute(
            'UPDATE users SET theme_preference = ? WHERE LOWER(email) = ? AND tenant_id = ?',
            [targetKey, currentUser.email.toLowerCase(), tenantId],
            { tenantId, isSuperAdmin: true }
          );
          if (currentUser.role === 'SUPERADMIN') {
            await execute(
              'INSERT INTO app_settings (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value',
              [tenantId, 'active_theme', targetKey],
              { tenantId, isSuperAdmin: true }
            );
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          scope: 'user',
          themeKey: targetKey,
          theme: THEMES[targetKey],
          message: `Tema de usuario actualizado a: ${THEMES[targetKey].name}`
        }));
        return;
      }

      // 3. CATÁLOGO OFICIAL DE MÓDULOS DE PLATAFORMA
      if (req.url === '/api/modules' && req.method === 'GET') {
        try {
          const rows = await query('SELECT * FROM modules ORDER BY category, key', [], { isSuperAdmin: true });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, modules: rows }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            modules: [
              { key: 'tenant', name: 'Gestión Multi-Tenant', description: 'Panel exclusivo SUPERADMIN para administración de organizaciones.', category: 'admin', is_active: true },
              { key: 'core', name: 'HoloSpace Core', description: 'Plataforma base: autenticación, motor de temas y auditoría.', category: 'system', is_active: true },
              { key: 'kanban', name: 'Kanban Board', description: 'Módulo Web de logística: Tablero Kanban 4 columnas y explorador.', category: 'operational', is_active: true },
              { key: 'scanner', name: 'Scanner App', description: 'Módulo Móvil Expo: Escáner de códigos de barra EAN-13.', category: 'operational', is_active: true }
            ]
          }));
        }
        return;
      }

      if (req.url === '/api/modules' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede activar o desactivar módulos de plataforma.' }));
          return;
        }

        const { key, active } = data || {};
        if (!key) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Se requiere la clave del módulo.' }));
          return;
        }

        if (key === 'core' && !active) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'El módulo Core no puede ser desactivado (mandatorio de plataforma).' }));
          return;
        }

        const isActiveBool = Boolean(active);
        try {
          await execute(
            'UPDATE modules SET is_active = ?, activated_by = ?, activated_at = CURRENT_TIMESTAMP WHERE key = ?',
            [isActiveBool, currentUser.email, key],
            { isSuperAdmin: true }
          );

          // Registrar en platform_audit_logs
          await execute(
            'INSERT INTO platform_audit_logs (user_email, action, details) VALUES (?, ?, ?)',
            [currentUser.email, isActiveBool ? 'MODULE_ACTIVATED' : 'MODULE_DEACTIVATED', JSON.stringify({ moduleKey: key, active: isActiveBool, description: `Módulo '${key}' ${isActiveBool ? 'activado' : 'desactivado'} por ${currentUser.email}` })],
            { isSuperAdmin: true }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, key, is_active: isActiveBool }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 4. AUDITORÍA DE PLATAFORMA (SUPERADMIN ONLY)
      if (req.url === '/api/platform-audit' && req.method === 'GET') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede acceder a la auditoría de plataforma.' }));
          return;
        }
        const logs = await query('SELECT id, created_at as timestamp, user_email as "userEmail", action, details FROM platform_audit_logs ORDER BY created_at DESC LIMIT 100', [], { isSuperAdmin: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, logs }));
        return;
      }

      // 5. SAAS: CONSULTA DE SUSCRIPCIÓN Y CUOTAS
      if (req.url === '/api/subscription' && req.method === 'GET') {
        const targetTenantId = (currentUser && currentUser.tenantId) || tenantId;
        const subData = await getTenantSubscriptionAndUsage(targetTenantId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...subData }));
        return;
      }

      // 5.1 SAAS: CATÁLOGO Y GESTIÓN DE PLANES (SUPERADMIN ONLY PARA CREACIÓN)
      if (req.url === '/api/plans' && req.method === 'GET') {
        try {
          const plansList = await query('SELECT * FROM plans ORDER BY max_users ASC', [], { isSuperAdmin: true });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, plans: plansList }));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            plans: [
              { code: 'starter', name: 'Plan Starter Inicial', max_users: 5, max_orders_monthly: 500, included_modules: ['core', 'kanban'] },
              { code: 'pro', name: 'Plan Pro Profesional', max_users: 15, max_orders_monthly: 3000, included_modules: ['core', 'kanban', 'scanner'] },
              { code: 'enterprise', name: 'Plan Enterprise Ilimitado', max_users: 999, max_orders_monthly: 999999, included_modules: ['tenant', 'core', 'kanban', 'scanner'] }
            ]
          }));
        }
        return;
      }

      if (req.url === '/api/plans' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede crear o modificar planes.' }));
          return;
        }
        const { code, name, description, maxUsers = 5, maxOrdersMonthly = 500, includedModules = ['core'] } = data || {};
        if (!code || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Código y nombre del plan son obligatorios.' }));
          return;
        }
        await execute(
          'INSERT INTO plans (code, name, description, max_users, max_orders_monthly, included_modules, is_active) VALUES (?, ?, ?, ?, ?, ?::jsonb, true) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, max_users = EXCLUDED.max_users, max_orders_monthly = EXCLUDED.max_orders_monthly, included_modules = EXCLUDED.included_modules',
          [code.toLowerCase().trim(), name, description || '', parseInt(maxUsers, 10), parseInt(maxOrdersMonthly, 10), JSON.stringify(includedModules)],
          { isSuperAdmin: true }
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Plan '${code}' guardado con éxito.` }));
        return;
      }

      // 6. SAAS: GESTIÓN DE TENANTS (SUPERADMIN ONLY)
      if (req.url === '/api/tenants' && req.method === 'GET') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede listar organizaciones.' }));
          return;
        }
        const tenants = await query(`
          SELECT t.id, t.slug, t.name, t.status, t.created_at,
                 s.plan_code, s.status as sub_status, s.max_users, s.max_orders_monthly
          FROM tenants t
          LEFT JOIN tenant_subscriptions s ON t.id = s.tenant_id
          ORDER BY t.created_at ASC
        `, [], { isSuperAdmin: true });

        for (const t of tenants) {
          t.modules = await query('SELECT module_code, is_enabled FROM tenant_modules WHERE tenant_id = ?', [t.id], { isSuperAdmin: true });
          t.users = await query('SELECT id, email, name, role, is_active, theme_preference FROM users WHERE tenant_id = ? ORDER BY role, name', [t.id], { isSuperAdmin: true });
          const themeRow = await getOne("SELECT value FROM app_settings WHERE key = 'active_theme' AND tenant_id = ?", [t.id], { isSuperAdmin: true });
          t.active_theme = themeRow ? themeRow.value : 'omarchy_tiling';
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tenants }));
        return;
      }

      if (req.url === '/api/tenants' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede crear organizaciones.' }));
          return;
        }
        const { name, slug, planCode = 'starter', maxUsers, maxOrdersMonthly, adminName, adminEmail, adminPassword } = data || {};
        if (!name || !slug) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Nombre de empresa y slug son obligatorios.' }));
          return;
        }
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
        const existing = await getOne('SELECT id FROM tenants WHERE slug = ?', [cleanSlug], { isSuperAdmin: true });
        if (existing) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `El slug '${cleanSlug}' ya existe.` }));
          return;
        }

        const newTenantId = crypto.randomUUID();
        const subId = crypto.randomUUID();
        const selectedPlan = PLANS[planCode] || PLANS.starter;

        await execute(
          'INSERT INTO tenants (id, slug, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [newTenantId, cleanSlug, name.trim(), 'active'],
          { isSuperAdmin: true }
        );

        await execute(
          "INSERT INTO tenant_subscriptions (id, tenant_id, plan_code, status, max_users, max_orders_monthly, current_period_start, current_period_end) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '30 days')",
          [subId, newTenantId, selectedPlan.code, 'active', maxUsers || selectedPlan.maxUsers, maxOrdersMonthly || selectedPlan.maxOrdersMonthly],
          { isSuperAdmin: true }
        );

        for (const mod of selectedPlan.includedModules) {
          await setTenantModuleState(newTenantId, mod, true, currentUser.email);
        }

        if (adminEmail && adminPassword && adminName) {
          const userId = crypto.randomUUID();
          const adminUsername = (data && data.adminUsername) ? data.adminUsername.toLowerCase().trim() : adminEmail.split('@')[0].toLowerCase();
          await execute(
            'INSERT INTO users (id, tenant_id, username, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, true)',
            [userId, newTenantId, adminUsername, adminEmail.toLowerCase().trim(), hashPassword(adminPassword), adminName.trim(), 'ADMIN'],
            { isSuperAdmin: true }
          );
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Organización '${name}' creada con éxito.`, tenantId: newTenantId, slug: cleanSlug }));
        return;
      }

      if (req.url === '/api/tenants/users' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede crear usuarios en tenants.' }));
          return;
        }
        const { tenantId: targetTenantId, username, email, name, password, role = 'OPERATOR' } = data || {};
        if (!targetTenantId || !email || !password || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Todos los campos son obligatorios (tenantId, email, name, password).' }));
          return;
        }
        const cleanEmail = email.toLowerCase().trim();
        const cleanUsername = username ? username.toLowerCase().trim() : cleanEmail.split('@')[0];

        const existingUser = await getOne(
          'SELECT id FROM users WHERE tenant_id = ? AND (LOWER(email) = ? OR LOWER(username) = ?)',
          [targetTenantId, cleanEmail, cleanUsername],
          { isSuperAdmin: true }
        );
        if (existingUser) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `El usuario o nick ya existe en esta organización.` }));
          return;
        }

        const userId = crypto.randomUUID();
        await execute(
          'INSERT INTO users (id, tenant_id, username, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, true)',
          [userId, targetTenantId, cleanUsername, cleanEmail, hashPassword(password), name.trim(), role.toUpperCase()],
          { isSuperAdmin: true }
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Usuario '${name}' asignado con éxito.`, userId, email: cleanEmail }));
        return;
      }

      // 6.2 EDICIÓN INTEGRAL DE ORGANIZACIÓN (SUPERADMIN ONLY)
      if (req.url === '/api/tenants' && req.method === 'PUT') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede editar organizaciones.' }));
          return;
        }

        const { tenantId: targetTenantId, name, planCode, maxUsers, maxOrdersMonthly, activeTheme, modules } = data || {};
        if (!targetTenantId || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'El ID de la organización y el nombre son obligatorios.' }));
          return;
        }

        const targetTenant = await getOne('SELECT * FROM tenants WHERE id::text = ?', [String(targetTenantId)], { isSuperAdmin: true });
        if (!targetTenant) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Organización no encontrada.' }));
          return;
        }

        // 1. Actualizar Nombre de Organización
        await execute(
          'UPDATE tenants SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name.trim(), targetTenant.id],
          { isSuperAdmin: true }
        );

        // 2. Actualizar Suscripción y Cuotas si se especificó plan
        if (planCode) {
          const selectedPlan = PLANS[planCode] || PLANS.starter;
          const finalMaxUsers = maxUsers !== undefined ? parseInt(maxUsers, 10) : selectedPlan.maxUsers;
          const finalMaxOrders = maxOrdersMonthly !== undefined ? parseInt(maxOrdersMonthly, 10) : selectedPlan.maxOrdersMonthly;

          await execute(
            `INSERT INTO tenant_subscriptions (id, tenant_id, plan_code, status, max_users, max_orders_monthly, current_period_start, current_period_end)
             VALUES (?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '30 days')
             ON CONFLICT (tenant_id) DO UPDATE SET
               plan_code = EXCLUDED.plan_code,
               max_users = EXCLUDED.max_users,
               max_orders_monthly = EXCLUDED.max_orders_monthly,
               updated_at = CURRENT_TIMESTAMP`,
            [crypto.randomUUID(), targetTenant.id, selectedPlan.code, finalMaxUsers, finalMaxOrders],
            { isSuperAdmin: true }
          );
        }

        // 3. Actualizar Tema Base del Tenant
        if (activeTheme && THEMES[activeTheme]) {
          await execute(
            'INSERT INTO app_settings (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value',
            [targetTenant.id, 'active_theme', activeTheme],
            { tenantId: targetTenant.id, isSuperAdmin: true }
          );
        }

        // 4. Actualizar Módulos Licenciados si se enviaron
        if (modules && typeof modules === 'object') {
          for (const [modKey, isEnabled] of Object.entries(modules)) {
            await setTenantModuleState(targetTenant.id, modKey, Boolean(isEnabled), currentUser.email);
          }
        }

        // 5. Registrar en Auditoría de Plataforma
        await execute(
          'INSERT INTO platform_audit_logs (tenant_id, user_email, action, details) VALUES (?, ?, ?, ?)',
          [targetTenant.id, currentUser.email, 'TENANT_UPDATED', JSON.stringify({
            tenantName: name.trim(),
            planCode,
            activeTheme,
            modules,
            updatedBy: currentUser.email
          })],
          { isSuperAdmin: true }
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Organización '${name}' actualizada con éxito.`,
          tenant: { id: targetTenant.id, name: name.trim(), planCode, activeTheme }
        }));
        return;
      }

      // 6.1 SUSPENSIÓN LÓGICA DE ORGANIZACIÓN (TENANT)
      if (req.url === '/api/tenants/status' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede modificar el estado de organizaciones.' }));
          return;
        }
        const { tenantId: targetTenantId, status } = data || {};
        if (!targetTenantId || !status) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Se requiere tenantId y status (active | suspended).' }));
          return;
        }

        const targetTenant = await getOne('SELECT * FROM tenants WHERE id::text = ?', [String(targetTenantId)], { isSuperAdmin: true });
        if (!targetTenant) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Organización no encontrada.' }));
          return;
        }

        if (targetTenant.slug === 'holospace' || targetTenant.id === 'a0000000-0000-0000-0000-000000000001') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'La Organización de Plataforma HoloSpace no puede ser suspendida.' }));
          return;
        }

        const newStatus = status === 'suspended' ? 'suspended' : 'active';
        await execute(
          'UPDATE tenants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, targetTenant.id],
          { isSuperAdmin: true }
        );

        // Registrar en auditoría de plataforma
        await execute(
          'INSERT INTO platform_audit_logs (tenant_id, user_email, action, details) VALUES (?, ?, ?, ?)',
          [targetTenant.id, currentUser.email, newStatus === 'suspended' ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED', JSON.stringify({ tenantName: targetTenant.name, slug: targetTenant.slug, status: newStatus })],
          { isSuperAdmin: true }
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `Organización '${targetTenant.name}' ${newStatus === 'suspended' ? 'suspendida' : 'reactivada'} con éxito.`,
          status: newStatus
        }));
        return;
      }

      if (req.url === '/api/tenants/modules' && req.method === 'POST') {
        if (!currentUser || currentUser.role !== 'SUPERADMIN') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Solo el Super Administrador puede licenciar módulos.' }));
          return;
        }
        const { tenantId: targetTenantId, moduleCode, isEnabled } = data || {};
        try {
          const result = await setTenantModuleState(targetTenantId, moduleCode, isEnabled, currentUser.email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 7. SAAS: BILLING & AUTO-ONBOARDING
      if (req.url === '/api/billing/plans' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, plans: PLANS }));
        return;
      }

      if (req.url === '/api/auth/register-tenant' && req.method === 'POST') {
        try {
          const result = await registerNewTenant(data || {});
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      if (req.url === '/api/billing/create-checkout' && req.method === 'POST') {
        const { planCode } = data || {};
        const targetTenantId = (currentUser && currentUser.tenantId) || tenantId;
        try {
          const session = await createCheckoutSession(targetTenantId, planCode || 'pro');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(session));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      if (req.url === '/api/billing/webhook' && req.method === 'POST') {
        try {
          const result = await handlePaymentWebhook(data || {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // 8. AUTENTICACIÓN / LOGIN JWT MULTI-TENANT
      if ((req.url === '/api/login' || req.url === '/api/auth/login') && req.method === 'POST') {
        const { email, password } = data || {};
        const normalizedEmail = (email || '').toLowerCase().trim();

        const user = await getOne(
          'SELECT email as id, email, username, password_hash as password, name, role, is_active as active, tenant_id FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = true',
          [normalizedEmail, normalizedEmail],
          { isSuperAdmin: true }
        );

        if (!user || !verifyPassword(password, user.password)) {
          console.log(`[AUTH] Intento de login fallido para: ${normalizedEmail}`);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Credenciales inválidas o usuario inactivo' }));
          return;
        }

        // Auto-upgrade de hash si era legado
        if (!user.password.includes(':')) {
          try {
            const secureHash = hashPassword(password);
            await execute('UPDATE users SET password_hash = ? WHERE LOWER(email) = ?', [secureHash, normalizedEmail], { isSuperAdmin: true });
          } catch (upgradeErr) { }
        }

        const userTenantId = user.tenant_id || DEFAULT_TENANT_ID;
        const tenant = await getOne('SELECT * FROM tenants WHERE id = ?', [userTenantId], { isSuperAdmin: true }) || {
          id: userTenantId,
          slug: 'drinklovers',
          name: 'Drink Lovers Argentina'
        };

        const entitlements = await getTenantEntitlements(userTenantId);

        const jwtPayload = {
          sub: user.email,
          email: user.email,
          username: user.username || user.email.split('@')[0],
          name: user.name,
          role: user.role,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          entitlements
        };
        const token = signJwt(jwtPayload, 86400 * 7);

        console.log(`[AUTH] Login JWT exitoso: ${user.username || user.email} (${user.role}) [Tenant: ${tenant.slug}]`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username || user.email.split('@')[0],
            name: user.name,
            role: user.role,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            tenantName: tenant.name
          },
          tenant,
          entitlements
        }));
        return;
      }

      // 9. GESTIÓN DE USUARIOS
      if (req.url.startsWith('/api/users')) {
        if (req.method === 'GET') {
          let userList;
          if (currentUser && currentUser.role === 'SUPERADMIN') {
            userList = await query(`
              SELECT u.id, u.username, u.email, u.name, u.role, u.is_active as active, u.tenant_id,
                     t.name as tenant_name, t.slug as tenant_slug
              FROM users u
              LEFT JOIN tenants t ON u.tenant_id = t.id
              ORDER BY t.slug, u.name
            `, [], { isSuperAdmin: true });
          } else {
            userList = await query(
              'SELECT id, username, email, name, role, is_active as active, tenant_id FROM users WHERE tenant_id = ? ORDER BY name',
              [tenantId],
              { tenantId }
            );
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(userList));
          return;
        }

        if (req.method === 'POST') {
          const { tenantId: reqTenantId, username, email, password, name, role } = data || {};
          if (!username || !email || !password || !name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Nick (Username), nombre, email y contraseña son obligatorios.' }));
            return;
          }
          const cleanUsername = username.toLowerCase().trim();
          const cleanEmail = email.toLowerCase().trim();
          const targetRole = role || 'OPERATOR';
          const targetTenantId = (currentUser && currentUser.role === 'SUPERADMIN' && reqTenantId) ? reqTenantId : tenantId;
          const userId = crypto.randomUUID();

          // Validar username único dentro del tenant
          const existing = await getOne(
            'SELECT id FROM users WHERE tenant_id = ? AND (LOWER(username) = ? OR LOWER(email) = ?)',
            [targetTenantId, cleanUsername, cleanEmail],
            { tenantId: targetTenantId, isSuperAdmin: currentUser && currentUser.role === 'SUPERADMIN' }
          );
          if (existing) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'El Nick (Username) o Email ya están en uso en esta organización.' }));
            return;
          }

          await execute(
            'INSERT INTO users (id, tenant_id, username, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, true)',
            [userId, targetTenantId, cleanUsername, cleanEmail, hashPassword(password), name, targetRole],
            { tenantId: targetTenantId, isSuperAdmin: currentUser && currentUser.role === 'SUPERADMIN' }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario guardado en PostgreSQL' }));
          return;
        }

        if (req.method === 'PUT') {
          const { id, tenantId: reqTenantId, username, email, name, password, role, active } = data || {};
          if (!id && !email && !username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Se requiere ID, username o email de usuario.' }));
            return;
          }

          let targetUser = null;
          if (id) {
            targetUser = await getOne('SELECT * FROM users WHERE id::text = ? OR email = ? OR username = ?', [String(id), String(id), String(id)], { isSuperAdmin: true });
          } else if (email) {
            targetUser = await getOne('SELECT * FROM users WHERE LOWER(email) = ?', [email.toLowerCase().trim()], { isSuperAdmin: true });
          }

          if (!targetUser) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Usuario no encontrado.' }));
            return;
          }

          const updatedUsername = username !== undefined ? username.toLowerCase().trim() : (targetUser.username || targetUser.email.split('@')[0]);
          const updatedName = name !== undefined ? name : targetUser.name;
          const updatedEmail = email !== undefined ? email.toLowerCase().trim() : targetUser.email;
          const updatedRole = role !== undefined ? role : targetUser.role;
          const updatedActive = active !== undefined ? Boolean(active) : targetUser.is_active;
          const updatedTenantId = (currentUser && currentUser.role === 'SUPERADMIN' && reqTenantId) ? reqTenantId : targetUser.tenant_id;

          let updatedHash = targetUser.password_hash;
          if (password && password.trim() && password !== '••••••••') {
            updatedHash = hashPassword(password);
          }

          await execute(
            'UPDATE users SET tenant_id = ?, username = ?, name = ?, email = ?, role = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [updatedTenantId, updatedUsername, updatedName, updatedEmail, updatedRole, updatedActive, updatedHash, targetUser.id],
            { isSuperAdmin: true }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Usuario actualizado con éxito.' }));
          return;
        }
      }

      // 10. KANBAN BOARD & PEDIDOS (SCANBAN)
      if ((req.url.startsWith('/api/scanban/orders') || req.url.startsWith('/api/scanban/kanban')) && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const search = (urlParams.get('q') || urlParams.get('search') || '').toLowerCase().trim();
        const statusFilter = (urlParams.get('status') || 'ALL').toUpperCase();

        // SUPERADMIN puede ver todas las órdenes de la plataforma (o filtrado por tenantId si se especifica)
        // ADMIN y OPERATOR ven estricta y únicamente las órdenes de su propia organización (tenantId)
        const isSuperAdmin = currentUser && currentUser.role === 'SUPERADMIN';
        const ordersContext = isSuperAdmin ? { isSuperAdmin: true } : { tenantId };
        const allOrdersInDb = await query(
          isSuperAdmin
            ? 'SELECT * FROM orders ORDER BY created_at DESC'
            : 'SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC',
          isSuperAdmin ? [] : [tenantId],
          ordersContext
        );

        const formattedOrders = [];
        for (const o of allOrdersInDb) {
          const orderTenantId = o.tenant_id || tenantId;
          const items = await query('SELECT id, code, description, quantity_required as "quantityRequired", quantity_scanned as "quantityScanned", unit_price as "unitPrice", status FROM order_items WHERE order_id = ?', [o.id], { tenantId: orderTenantId, isSuperAdmin });
          const logs = await query('SELECT timestamp, user_email as "userEmail", action, details FROM audit_logs WHERE order_id = ? ORDER BY id ASC', [o.id], { tenantId: orderTenantId, isSuperAdmin });

          const scannedItems = o.total_items_scanned || 0;
          const totalItems = o.total_items_required || 1;
          const progressPercentage = Math.round((scannedItems / totalItems) * 100);
          const totalAmount = items.reduce((acc, i) => acc + ((i.unitPrice || 0) * (i.quantityRequired || 1)), 0);

          formattedOrders.push({
            id: o.id,
            uuid: o.uuid,
            orderNumber: o.order_number,
            clientName: o.client_name,
            issueDate: o.issue_date,
            fileName: o.pdf_file_name,
            pdfFileName: o.pdf_file_name,
            status: o.status,
            operatorEmail: o.operator_email || 'Sin asignar',
            operatorId: o.operator_email || 'Sin asignar',
            totalItemsRequired: o.total_items_required,
            totalItemsScanned: o.total_items_scanned,
            scannedItems,
            totalItems,
            progressPercentage,
            totalAmount,
            auditStamp: o.audit_stamp,
            createdAt: o.created_at,
            items,
            auditLogs: logs
          });
        }

        const filtered = formattedOrders.filter(o => {
          const matchesSearch = !search ||
            o.orderNumber.toLowerCase().includes(search) ||
            o.clientName.toLowerCase().includes(search) ||
            o.pdfFileName.toLowerCase().includes(search);
          const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
          return matchesSearch && matchesStatus;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          orders: filtered,
          backlog: filtered.filter(o => o.status === 'BACKLOG'),
          ready: filtered.filter(o => o.status === 'READY'),
          doing: filtered.filter(o => o.status === 'DOING' || o.status === 'SCANNING'),
          done: filtered.filter(o => o.status === 'DONE' || o.status === 'CLOSED' || o.status === 'PARTIAL_DISPATCH')
        }));
        return;
      }

      // 10.1 VALIDAR COMPROBANTE (BACKLOG -> READY)
      if (req.url === '/api/scanban/mark-ready' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const email = (userEmail || 'admin@drinklovers.com.ar').toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          await execute("UPDATE orders SET status = 'READY' WHERE id = ?", [order.id], { tenantId });
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [order.id, tenantId, now, email, 'VALIDAR_COMPROBANTE', `Pedido #${order.orderNumber} validado a Listo por ${email}.`],
            { tenantId }
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10.2 DEVOLVER A BACKLOG
      if (req.url === '/api/scanban/mark-backlog' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const email = (userEmail || 'admin@drinklovers.com.ar').toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          await execute("UPDATE orders SET status = 'BACKLOG', operator_email = NULL WHERE id = ?", [order.id], { tenantId });
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [order.id, tenantId, now, email, 'DEVOLVER_BACKLOG', `Pedido #${order.orderNumber} devuelto a Backlog por ${email}.`],
            { tenantId }
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10.3 ASIGNAR OPERARIO
      if (req.url === '/api/scanban/assign-order' && req.method === 'POST') {
        const { orderId, orderNumber, operatorEmail, userEmail } = data;
        const adminEmail = (userEmail || (currentUser && currentUser.email) || 'admin@drinklovers.com.ar').toLowerCase();
        const targetOperator = (operatorEmail || '').trim().toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          await execute("UPDATE orders SET status = 'DOING', operator_email = ?, assigned_operator_email = ? WHERE id = ?", [targetOperator, targetOperator, order.id], { tenantId });
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [order.id, tenantId, now, adminEmail, 'ASIGNAR_OPERARIO', `Pedido #${order.orderNumber} asignado a ${targetOperator}.`],
            { tenantId }
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10.3.1 REASIGNAR Y LIBERAR A LISTO (DOING -> READY)
      if (req.url === '/api/scanban/release-order-admin' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const adminEmail = (userEmail || (currentUser && currentUser.email) || 'admin@drinklovers.com.ar').toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          await execute("UPDATE orders SET status = 'READY', operator_email = NULL, assigned_operator_email = NULL WHERE id = ?", [order.id], { tenantId });
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [order.id, tenantId, now, adminEmail, 'LIBERAR_PEDIDO', `Pedido #${order.orderNumber} liberado a Listo por Administrador (${adminEmail}).`],
            { tenantId }
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 10.3.2 ELIMINAR PEDIDO DE BACKLOG
      if (req.url === '/api/scanban/delete-order' && (req.method === 'POST' || req.method === 'DELETE')) {
        const { orderId, orderNumber, userEmail } = data || {};
        const adminEmail = (userEmail || (currentUser && currentUser.email) || 'admin@drinklovers.com.ar').toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          await execute('DELETE FROM order_items WHERE order_id = ? AND tenant_id = ?', [order.id, tenantId], { tenantId });
          await execute('DELETE FROM audit_logs WHERE order_id = ? AND tenant_id = ?', [order.id, tenantId], { tenantId });
          await execute('DELETE FROM orders WHERE id = ? AND tenant_id = ?', [order.id, tenantId], { tenantId });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Pedido eliminado con éxito.' }));
        return;
      }

      // 10.4 SUBIDA DE PDF CON PARSER REAL
      if (req.url === '/api/scanban/upload-pdf' && req.method === 'POST') {
        const { fileName, pdfBase64, userEmail } = data;
        if (!fileName || !pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Debes proporcionar un archivo PDF válido' }));
          return;
        }

        const buffer = Buffer.from(pdfBase64, 'base64');
        const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const email = (userEmail || 'admin@drinklovers.com.ar').toLowerCase();

        const parsed = await parsePdfBuffer(buffer, cleanName);
        if (!parsed.success || !parsed.items || parsed.items.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            checklist: parsed.checklist,
            error: parsed.error || 'No se pudieron extraer productos válidos del PDF.'
          }));
          return;
        }

        const orderUuid = crypto.randomUUID();
        const totalItemsRequired = parsed.items.reduce((acc, i) => acc + i.quantityRequired, 0);

        try {
          // Insertar siempre como nueva orden independiente identificada unívocamente por su id (UUID)
          await execute(
            'INSERT INTO orders (id, tenant_id, uuid, order_number, client_name, issue_date, pdf_file_name, pdf_blob, status, total_items, total_items_required, total_items_scanned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)',
            [orderUuid, tenantId, orderUuid, parsed.orderNumber, parsed.clientName, parsed.issueDate, cleanName, pdfBase64, 'BACKLOG', totalItemsRequired, totalItemsRequired],
            { tenantId }
          );

          for (const item of parsed.items) {
            const itemId = crypto.randomUUID();
            await execute(
              'INSERT INTO order_items (id, tenant_id, order_id, code, description, unit_price, quantity_required, quantity_scanned, status) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
              [itemId, tenantId, orderUuid, item.code, item.description, item.unitPrice || 0, item.quantityRequired, 'PENDING'],
              { tenantId }
            );
          }

          const now = new Date().toLocaleString('es-AR');
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [orderUuid, tenantId, now, email, 'CARGA_COMPROBANTE', `Comprobante PDF #${parsed.orderNumber} cargado e ingresado en PostgreSQL por ${email}.`],
            { tenantId }
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            checklist: parsed.checklist,
            id: orderUuid,
            uuid: orderUuid,
            fileName: cleanName,
            orderNumber: parsed.orderNumber,
            clientName: parsed.clientName,
            totalItems: totalItemsRequired,
            message: `Comprobante #${parsed.orderNumber} guardado en PostgreSQL.`
          }));
          return;
        } catch (dbErr) {
          console.error('Error guardando pedido PDF en PostgreSQL:', dbErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            checklist: parsed.checklist,
            error: `Error en Base de Datos: ${dbErr.message}`
          }));
          return;
        }
      }

      // 10.5 APP MÓVIL: PEDIDOS DISPONIBLES & DETALLE
      if (req.url === '/api/scanban/available-orders' && req.method === 'GET') {
        const readyOrders = await query(
          "SELECT id, uuid, order_number as \"orderNumber\", client_name as \"clientName\", total_items_required as \"totalItems\" FROM orders WHERE status = 'READY' AND tenant_id = ?",
          [tenantId],
          { tenantId }
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, orders: readyOrders }));
        return;
      }

      // 10.5.1 APP MÓVIL: PEDIDOS EN PROCESO (DOING) ASIGNADOS AL OPERARIO
      if (req.url.startsWith('/api/scanban/my-doing-orders') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const opEmail = urlParams.get('userEmail') || (currentUser && currentUser.email) || '';

        if (!opEmail) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count: 0, orders: [] }));
          return;
        }

        const doingRows = await query(
          "SELECT id, uuid, order_number as \"orderNumber\", client_name as \"clientName\", total_items_required as \"totalItemsRequired\", total_items_scanned as \"totalItemsScanned\", status FROM orders WHERE LOWER(operator_email) = ? AND status = 'DOING' AND tenant_id = ? ORDER BY created_at DESC",
          [opEmail.toLowerCase(), tenantId],
          { tenantId }
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: doingRows.length, orders: doingRows }));
        return;
      }

      // 10.5.1.B APP MÓVIL: PEDIDO ACTIVO EN FOCO DE ESCANEO
      if (req.url.startsWith('/api/scanban/active-order') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const opEmail = urlParams.get('userEmail') || (currentUser && currentUser.email) || '';
        const requestedId = urlParams.get('id') || urlParams.get('orderId') || urlParams.get('orderNumber');

        if (!opEmail) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hasActive: false }));
          return;
        }

        let activeRow = null;
        if (requestedId) {
          activeRow = await getOne(
            "SELECT id, uuid, order_number as \"orderNumber\", client_name as \"clientName\", total_items_required as \"totalItemsRequired\", total_items_scanned as \"totalItemsScanned\", status FROM orders WHERE (id::text = ? OR uuid = ? OR order_number = ?) AND LOWER(operator_email) = ? AND status = 'DOING' AND tenant_id = ?",
            [requestedId, requestedId, requestedId, opEmail.toLowerCase(), tenantId],
            { tenantId }
          );
        }

        if (!activeRow) {
          activeRow = await getOne(
            "SELECT id, uuid, order_number as \"orderNumber\", client_name as \"clientName\", total_items_required as \"totalItemsRequired\", total_items_scanned as \"totalItemsScanned\", status FROM orders WHERE LOWER(operator_email) = ? AND status = 'DOING' AND tenant_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1",
            [opEmail.toLowerCase(), tenantId],
            { tenantId }
          );
        }

        if (activeRow) {
          const fullOrder = await getFullOrderFromDb(activeRow.id, { tenantId });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hasActive: true, id: activeRow.id, orderNumber: activeRow.orderNumber, order: fullOrder }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hasActive: false }));
        return;
      }

      // 10.5.2 APP MÓVIL: LIBERAR PEDIDO A READY (desde operario móvil)
      if (req.url === '/api/scanban/release-order' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data || {};
        const opEmail = (userEmail || (currentUser && currentUser.email) || '').trim().toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          await execute(
            "UPDATE orders SET status = 'READY', operator_email = NULL, assigned_operator_email = NULL WHERE id = ? AND tenant_id = ?",
            [order.id, tenantId],
            { tenantId }
          );
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [order.id, tenantId, now, opEmail, 'LIBERAR_PEDIDO_OPERARIO', `Pedido #${order.orderNumber} liberado a Listo por Operario (${opEmail}).`],
            { tenantId }
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.url.startsWith('/api/scanban/order-detail') && req.method === 'GET') {
        const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
        const identifier = urlParams.get('id') || urlParams.get('orderId') || urlParams.get('orderNumber');

        const fullOrder = await getFullOrderFromDb(identifier, { tenantId });
        if (fullOrder) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, order: fullOrder }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Pedido no encontrado' }));
        return;
      }

      // 10.6 TOMAR Y ESCANEAR PEDIDO
      if (req.url === '/api/scanban/claim-order' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail } = data;
        const opEmail = (userEmail || 'juan@drinklovers.com.ar').trim().toLowerCase();

        const existingOrder = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (existingOrder) {
          const now = new Date().toLocaleString('es-AR');
          await execute("UPDATE orders SET status = 'DOING', operator_email = ? WHERE id = ?", [opEmail, existingOrder.id], { tenantId });
          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [existingOrder.id, tenantId, now, opEmail, 'TOMAR_PEDIDO', `Pedido tomado por ${opEmail}.`],
            { tenantId }
          );

          const updatedFull = await getFullOrderFromDb(existingOrder.id, { tenantId });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, order: updatedFull }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pedido no encontrado' }));
        return;
      }

      // 10.7 COMPLETAR Y DESPACHAR PEDIDO
      if (req.url === '/api/scanban/complete-order' && req.method === 'POST') {
        const { orderId, orderNumber, userEmail, watermarkText } = data;
        const opEmail = (userEmail || 'juan@drinklovers.com.ar').trim().toLowerCase();

        const order = await getFullOrderFromDb(orderId || orderNumber, { tenantId });
        if (order) {
          const now = new Date().toLocaleString('es-AR');
          const auditStamp = watermarkText || `EXPEDIDO POR ${opEmail} | ${now}`;

          await execute(
            "UPDATE orders SET status = 'DONE', operator_email = ?, audit_stamp = ?, total_items_scanned = total_items_required WHERE id = ?",
            [opEmail, auditStamp, order.id],
            { tenantId }
          );

          await execute(
            'INSERT INTO audit_logs (order_id, tenant_id, timestamp, user_email, action, details) VALUES (?, ?, ?, ?, ?, ?)',
            [order.id, tenantId, now, opEmail, 'DESPACHAR_PEDIDO', `Pedido despachado por ${opEmail}.`],
            { tenantId }
          );
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 11. LOGS DE ERROR
      if (req.url.startsWith('/api/error-logs') && req.method === 'GET') {
        const errorContent = fs.existsSync(ERROR_LOG_PATH) ? fs.readFileSync(ERROR_LOG_PATH, 'utf8') : 'Sin errores registrados.';
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(errorContent);
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
  console.log(`🚀 HoloSpace Server 100% PostgreSQL 16 Activo en http://0.0.0.0:${PORT}`);
});
