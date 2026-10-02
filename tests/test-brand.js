/**
 * Core: reglas de marca en el codigo fuente (holospace. en minuscula, hologrowth.dev). No requiere base de datos.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };

const SKIP_DIRS = new Set(['node_modules', '.git', '.impeccable', 'backups', 'logs', '.expo']);
const TEXT_EXT = new Set(['.js', '.ts', '.tsx', '.html', '.css', '.json', '.sql', '.sh', '.md', '.yml', '.conf']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (p.includes(`${path.sep}.claude${path.sep}skills`)) continue; walk(p, out); }
    else if (TEXT_EXT.has(path.extname(e.name)) && e.name !== 'package-lock.json') out.push(p);
  }
  return out;
}
const files = walk(ROOT);

console.log('Dominio de la empresa');
const bad = files.filter((f) => !f.endsWith(path.join('docs', 'DEBT.md')) && !f.endsWith('test-brand.js') && /hologrowth\.com\.ar/i.test(fs.readFileSync(f, 'utf8')));
ok(bad.length === 0, `ningun archivo usa hologrowth.com.ar (debe ser hologrowth.dev)${bad.length ? ': ' + bad.map((b) => path.relative(ROOT, b)).join(', ') : ''}`);

console.log('Nombre de marca visible');
function visibleText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}
for (const rel of ['modules/landing/public/index.html', 'public/index.html']) {
  const txt = visibleText(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const hits = (txt.match(/>[^<]*HoloSpace[^<]*</g) || []).length;
  ok(hits === 0, `${rel} no muestra "HoloSpace" en el texto visible`);
}
const appJs = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8').split('\n')
  .filter((l) => !/^\s*\/\//.test(l) && /HoloSpace/.test(l) && !/holospace\.com\.ar/.test(l));
ok(appJs.length === 0, 'public/app.js no usa "HoloSpace" en cadenas visibles');

console.log('Activos de marca');
for (const f of ['mark.svg', '4see.svg', 'logistica.svg', 'og.png', 'favicon.ico', 'apple-touch-icon.png', 'site.webmanifest']) {
  ok(fs.existsSync(path.join(ROOT, 'public/brand', f)), `existe public/brand/${f}`);
}
const landing = fs.readFileSync(path.join(ROOT, 'modules/landing/public/index.html'), 'utf8');
ok(landing.includes('og:image') && landing.includes('hologrowth.dev'), 'la landing declara Open Graph y enlaza hologrowth.dev');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nMarca OK');
process.exit(failed ? 1 : 0);
