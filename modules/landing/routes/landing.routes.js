const fs = require('fs');
const path = require('path');

const LANDING_HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');
const LANDING_CSS_PATH = path.join(__dirname, '..', 'public', 'landing.css');

module.exports = function handleLandingRoutes(req, res) {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  const url = req.url.split('?')[0];

  // Si entra por hologrowth.com.ar o ruta explícita /landing
  const isHologrowth = host === 'hologrowth.com.ar' || host === 'www.hologrowth.com.ar';
  
  if (url === '/landing/landing.css') {
    if (fs.existsSync(LANDING_CSS_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(fs.readFileSync(LANDING_CSS_PATH, 'utf8'));
      return true;
    }
  }

  if (url === '/landing' || url === '/landing/' || (isHologrowth && (url === '/' || url === ''))) {
    if (fs.existsSync(LANDING_HTML_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(LANDING_HTML_PATH, 'utf8'));
      return true;
    }
  }

  return false;
};
