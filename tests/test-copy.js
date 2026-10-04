/**
 * UI: textos de producto (docs/CONTENT.md 0.2, skill holospace-copy). Sin base de datos ni navegador.
 * Verifica que no vuelva la jerga del glosario en la app web, el Scanner y la landing, y que cada pantalla
 * de 4see y Kanban cumpla el contrato titulo + bajada.
 */
const fs = require('fs');
const path = require('path');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

// Terminos del glosario que no deben verse en texto visible
const BANNED = [
  /scraping/i, /repricing/i, /inquebrantable/i, /hard floor/i, /diff view/i, /write-back/i,
  /worker de/i, /\bworker\b/i, /zona roja/i, /producto 1:n/i, /on-the-fly/i, /dynamic pricing/i,
  /\bmock\b/i, /auto-dispatch/i, /\bGTIN\b/, /\bmultiseleccion\b/i, /\bTenants?\b/
];

function htmlVisibleText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/(placeholder|title|aria-label)="([^"]*)"/g, '>$2<')
    .replace(/<[^>]+>/g, '\n')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 2);
}

// Textos para personas dentro de JS: cadenas con espacios y texto visible de las plantillas HTML
function jsLiterals(src) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[3] !== undefined) {
      out.push(...htmlVisibleText(m[3].replace(/\$\{[^}]*\}/g, ' ')));
      continue;
    }
    const s = m[1] || m[2] || '';
    if (/\s/.test(s) && /[a-záéíóú]{3,}/i.test(s) && !/^(\.|\/|#|<\w+ [^>]*>$)/.test(s.trim()) && !/^[A-Z_ ]+$/.test(s)) out.push(s);
  }
  return out;
}

function check(label, lines) {
  const hits = [];
  for (const l of lines) for (const re of BANNED) if (re.test(l)) hits.push(`${re}: ${l.slice(0, 90)}`);
  ok(hits.length === 0, `${label}: sin jerga del glosario`);
  hits.slice(0, 8).forEach((h) => console.error('       ' + h));
}

console.log('App web');
const html = read('public/index.html');
check('public/index.html', htmlVisibleText(html));
check('public/app.js', jsLiterals(read('public/app.js')));

console.log('Scanner');
const scannerFiles = walk('modules/scanner/src').concat(['modules/scanner/App.tsx']).filter((f) => /\.tsx?$/.test(f));
check('modules/scanner', scannerFiles.flatMap((f) => jsLiterals(read(f)).concat([...read(f).matchAll(/<Text[^>]*>([^<{]{4,})</g)].map((m) => m[1].trim()))));

console.log('Landing');
check('modules/landing', htmlVisibleText(read('modules/landing/public/index.html')));

console.log('Contrato de pantalla: titulo y bajada');
const views = {
  view4seeMonitors: 'Precios de tu competencia',
  view4seeSmartPrice: 'Precios sugeridos',
  view4seeCatalog: 'Salud de tu catálogo',
  view4seeMargins: 'Márgenes de ganancia',
  viewKanban: 'Pedidos para preparar',
  viewOrders: 'Todos los pedidos',
  viewUsers: 'Usuarios',
  viewRoles: 'Roles y permisos',
  viewTenants: 'Empresas clientes'
};
for (const [id, title] of Object.entries(views)) {
  const i = html.indexOf(`id="${id}"`);
  const chunk = i >= 0 ? html.slice(i, i + 1800) : '';
  const h2 = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  const p = chunk.match(/<\/h2>\s*<p[^>]*>([^<]{25,})<\/p>/);
  ok(!!h2 && h2[1].replace(/<[^>]+>/g, '').trim() === title, `${id}: titulo "${title}"`);
  ok(!!p, `${id}: bajada de una o dos frases`);
}

console.log('4see: una sola pestaña con el flujo en orden');
ok(html.includes('>Productos</button>'), 'pestana unica "Productos"');
ok(!/>(Competencia|Precios sugeridos|Catálogo|Márgenes)<\/button>/.test(html), 'no quedan pestañas sueltas de 4see');
const flowSteps = ['Cargá tu catálogo', 'Elegí los productos a analizar', 'Sumá los rivales', 'Completá costos y márgenes', 'Recibí los precios sugeridos'];
flowSteps.forEach((s) => ok(html.includes(s), `paso del flujo: "${s}"`));

console.log('Estados vacios con siguiente paso');
const app = read('public/app.js');
ok(app.includes('Todavía no elegiste productos para analizar') && html.includes('Elegir productos para analizar'), 'Competencia: vacio con siguiente paso (elegir productos)');
ok(app.includes('Apretá <strong>Revisar precios ahora</strong>'), 'Precios sugeridos: vacio con siguiente paso');
ok(app.includes('Todavía no calculaste el margen de ningún producto'), 'Márgenes: vacio explicado');

console.log('Voz');
const visible = htmlVisibleText(html).concat(jsLiterals(app)).join('\n');
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(visible.replace(/[✓×←→↗●○]/g, '')), 'sin emojis en texto visible');
ok(/hs-name">holospace<i>\.<\/i>/.test(html) || !/HoloSpace/.test(html), 'marca en minuscula');

if (failed) { console.error(`\n${failed} verificaciones fallaron`); process.exit(1); }
console.log('\nTextos de producto OK');
