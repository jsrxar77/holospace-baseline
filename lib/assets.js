/**
 * lib/assets.js: versionado de assets estaticos.
 * Cloudflare cachea CSS, JS e imagenes hasta 4 horas ignorando las cabeceras del origen, asi que cada URL
 * estatica referenciada desde el HTML lleva ?v=<mtime del archivo> y cambia sola cuando el archivo cambia.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSET_FILES = {
  '/themes/holo.css': () => [
    path.join(ROOT, 'modules', 'themes', 'themes.json'),
    path.join(ROOT, 'modules', 'themes', 'holo.css'),
    path.join(ROOT, 'modules', 'themes', 'index.js')
  ],
  '/css/holospace-theme.css': () => [path.join(ROOT, 'public', 'css', 'holospace-theme.css')],
  '/app.js': () => [path.join(ROOT, 'public', 'app.js')],
  '/access.js': () => [path.join(ROOT, 'public', 'access.js')],
  '/flow.js': () => [path.join(ROOT, 'public', 'flow.js')],
  '/format.js': () => [path.join(ROOT, 'public', 'format.js')],
  '/charts/hs-charts.js': () => [path.join(ROOT, 'public', 'charts', 'hs-charts.js')],
  '/tables/hs-table.js': () => [path.join(ROOT, 'public', 'tables', 'hs-table.js')],
  '/landing/landing.css': () => [path.join(ROOT, 'modules', 'landing', 'public', 'landing.css')]
};

function assetVersion(url) {
  const files = ASSET_FILES[url]
    ? ASSET_FILES[url]()
    : (url.startsWith('/brand/') ? [path.join(ROOT, 'public', 'brand', path.basename(url))] : null);
  if (!files) return null;
  let max = 0;
  for (const f of files) {
    try { max = Math.max(max, fs.statSync(f).mtimeMs); } catch (e) { /* archivo ausente */ }
  }
  return max ? Math.floor(max).toString(36) : null;
}

const ASSET_URL_RE = /(href|src)="(\/(?:themes\/holo\.css|css\/holospace-theme\.css|app\.js|access\.js|flow\.js|format\.js|charts\/hs-charts\.js|tables\/hs-table\.js|landing\/landing\.css|brand\/[A-Za-z0-9._-]+))(\?[^"]*)?"/g;

function withAssetVersions(html) {
  return html.replace(ASSET_URL_RE, (m, attr, url) => {
    const v = assetVersion(url);
    return v ? `${attr}="${url}?v=${v}"` : m;
  });
}

module.exports = { withAssetVersions, assetVersion };
