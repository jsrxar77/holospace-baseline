const fs = require('fs');
const path = require('path');

const LANDING_HTML_PATH = path.join(__dirname, '..', 'public', 'index.html');
const LANDING_CSS_PATH = path.join(__dirname, '..', 'public', 'landing.css');

module.exports = function handleLandingRoutes(req, res) {
  const url = req.url.split('?')[0];

  // 1. Servir CSS del módulo Landing
  if (url === '/landing/landing.css') {
    if (fs.existsSync(LANDING_CSS_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(fs.readFileSync(LANDING_CSS_PATH, 'utf8'));
      return true;
    }
  }

  // 2. Rutas que SIEMPRE sirven la Landing Page comercial pública
  if (url === '/' || url === '' || url === '/index.html' || url === '/landing' || url === '/landing/') {
    if (fs.existsSync(LANDING_HTML_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(LANDING_HTML_PATH, 'utf8'));
      return true;
    }
  }

  return false;
};
