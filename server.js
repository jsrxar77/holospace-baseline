const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const BASE_DIR = path.join(__dirname, 'delivery');
const BACKLOG_DIR = path.join(BASE_DIR, 'backlog');
const DOING_DIR = path.join(BASE_DIR, 'doing');
const DONE_DIR = path.join(BASE_DIR, 'done');

// Asegurar que existan las tres carpetas en el disco del Mac
[BACKLOG_DIR, DOING_DIR, DONE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const server = http.createServer((req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};

      // 0. CONSULTAR PEDIDO ACTIVO EN PROCESO (Doing Auto-Detection)
      if ((req.url.startsWith('/api/active-order') || req.url === '/api/check-active-order')) {
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
            console.log(`[DISCO REAL MAC] Auto-detectado pedido activo en doing: ${activeFile} (Pedido #${orderNumber})`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ hasActive: true, orderNumber, pdfFileName: activeFile }));
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hasActive: false }));
        return;
      }

      // 1. TOMAR PEDIDO: Mover físicamente de ./delivery/backlog a ./delivery/doing/
      if (req.url === '/api/claim-order' && req.method === 'POST') {
        const { orderNumber, operatorId } = data;
        const cleanFileName = `${orderNumber}.pdf`;
        const targetFileName = `${orderNumber}-${operatorId}.pdf`;

        const srcPath = path.join(BACKLOG_DIR, cleanFileName);
        const destPath = path.join(DOING_DIR, targetFileName);

        if (fs.existsSync(srcPath)) {
          fs.renameSync(srcPath, destPath);
          console.log(`[DISCO REAL MAC] Archivo tomado y movido: delivery/backlog/${cleanFileName} -> delivery/doing/${targetFileName}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, targetFileName }));
          return;
        } else {
          // Buscar si existe un archivo parcial en backlog
          const backlogFiles = fs.readdirSync(BACKLOG_DIR);
          const match = backlogFiles.find((f) => f.includes(orderNumber));
          if (match) {
            fs.renameSync(path.join(BACKLOG_DIR, match), destPath);
            console.log(`[DISCO REAL MAC] Archivo tomado: delivery/backlog/${match} -> delivery/doing/${targetFileName}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, targetFileName }));
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, targetFileName, warning: 'Archivo no encontrado en backlog pero registrado' }));
        return;
      }

      // 2. LIBERAR PEDIDO: Mover físicamente de ./delivery/doing a ./delivery/backlog/
      if (req.url === '/api/release-order' && req.method === 'POST') {
        const { orderNumber, operatorId } = data;
        const doingFileName = `${orderNumber}-${operatorId}.pdf`;
        const cleanFileName = `${orderNumber}.pdf`;

        const doingPath = path.join(DOING_DIR, doingFileName);
        const backlogPath = path.join(BACKLOG_DIR, cleanFileName);

        if (fs.existsSync(doingPath)) {
          fs.renameSync(doingPath, backlogPath);
          console.log(`[DISCO REAL MAC] Archivo liberado y devuelto a backlog: delivery/doing/${doingFileName} -> delivery/backlog/${cleanFileName}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        } else {
          // Buscar cualquier archivo en doing con ese orderNumber
          const doingFiles = fs.existsSync(DOING_DIR) ? fs.readdirSync(DOING_DIR) : [];
          const match = doingFiles.find((f) => f.includes(orderNumber));
          if (match) {
            fs.renameSync(path.join(DOING_DIR, match), backlogPath);
            console.log(`[DISCO REAL MAC] Archivo liberado: delivery/doing/${match} -> delivery/backlog/${cleanFileName}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 3. FINALIZAR PEDIDO: Mover físicamente de ./delivery/doing a ./delivery/done/ e incrustar marca de agua
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
          console.log(`[DISCO REAL MAC] Archivo finalizado trasladado: delivery/doing/${doingFileName} -> delivery/done/${doneFileName}`);
        }

        // Grabar la marca de agua física en el disco del Mac
        fs.writeFileSync(auditPath, watermarkText, 'utf8');
        console.log(`[MARCA DE AGUA REAL EN DISCO MAC]: "${auditPath}" -> "${watermarkText}"`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, doneFileName, auditPath }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
    } catch (e) {
      console.error('Error en el servidor de archivos:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de Archivos Real en Disco activo en http://192.168.100.247:${PORT}`);
});
