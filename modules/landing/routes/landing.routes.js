const fs = require('fs');
const path = require('path');

const LANDING_HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');
const LANDING_CSS_PATH = path.join(__dirname, '..', 'public', 'landing.css');

module.exports = function handleLandingRoutes(req, res) {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  const url = req.url.split('?')[0];

  // Dominios de Landing Page pública
  const isLandingDomain = 
    host === 'holospace.com.ar' || 
    host === 'www.holospace.com.ar' || 
    host === 'hologrowth.com.ar' || 
    host === 'www.hologrowth.com.ar';

  // Servir CSS del módulo Landing
  if (url === '/landing/landing.css') {
    if (fs.existsSync(LANDING_CSS_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(fs.readFileSync(LANDING_CSS_PATH, 'utf8'));
      return true;
    }
  }

  // Si entra por holospace.com.ar / hologrowth.com.ar en la raíz (/) o pide /landing
  if (url === '/landing' || url === '/landing/' || (isLandingDomain && (url === '/' || url === '' || url === '/index.html'))) {
    if (fs.existsSync(LANDING_HTML_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(LANDING_HTML_PATH, 'utf8'));
      return true;
    }
  }

  return false;
};
