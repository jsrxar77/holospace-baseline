/**
 * UI: suite de graficos hs-charts (ECharts vendorizado), paleta semantica y visibilidad de "Conectar Celular".
 * No requiere base de datos ni navegador: los constructores se ejecutan con un DOM minimo simulado.
 */
const fs = require('fs');
const path = require('path');
const themes = require('../modules/themes/themes.json');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

console.log('Libreria vendorizada (sin CDN)');
const vendor = path.join(__dirname, '..', 'public', 'vendor', 'echarts.min.js');
ok(fs.existsSync(vendor) && fs.statSync(vendor).size > 500000, 'public/vendor/echarts.min.js presente');
const charts = read('public/charts/hs-charts.js');
ok(charts.includes('/vendor/echarts.min.js'), 'hs-charts carga ECharts desde el propio servidor');
ok(!/https?:\/\//.test(charts), 'hs-charts no referencia URLs externas');
ok(!/#[0-9a-fA-F]{3,8}\b/.test(charts) && !/rgba?\(/.test(charts), 'hs-charts no tiene colores fijos (solo variables del tema)');
ok(!/linearGradient|shadowBlur/.test(charts), 'sin degradados ni sombras (lamina tecnica)');
const server = read('server.js');
ok(server.includes("'/vendor/echarts.min.js'") && server.includes("'/charts/hs-charts.js'"), 'el servidor expone la suite');
ok(read('lib/assets.js').includes('hs-charts'), 'hs-charts se versiona contra el cache de Cloudflare');

console.log('Constructores con tema simulado');
const vars = {
  '--emerald': 'E', '--hw-chart1': 'V', '--amber': 'A', '--text-muted': 'M', '--text-main': 'I',
  '--hw-text-subtle': 'S', '--card-border': 'H', '--hw-border-strong': 'B', '--hw-surface-1': 'F',
  '--hw-font-mono': "'Geist Mono'", '--hw-font-family': "'Geist'"
};
global.window = global;
global.document = { body: { getPropertyValue: () => '', className: '', contains: () => true } };
global.getComputedStyle = () => ({ getPropertyValue: (n) => vars[n] || '' });
global.matchMedia = () => ({ matches: false });
global.addEventListener = () => {};
require('../public/charts/hs-charts.js');
const HS = global.HSCharts;
ok(!!HS && typeof HS.build.donut === 'function', 'HSCharts expuesto');
const p = HS.palette();
ok(p.applied === 'E' && p.pending === 'V' && p.risk === 'A', 'menta = aplicado, violeta = pendiente, ambar = riesgo');
const d = HS.build.donut({ centerLabel: '5', items: [{ name: 'a', value: 2, tone: 'pending' }, { name: 'b', value: 3, tone: 'applied' }] });
ok(d.series[0].data[0].itemStyle.color === 'V' && d.series[0].data[1].itemStyle.color === 'E', 'dona toma el color por tono');
const fb = HS.build.floorBand({ rows: [{ name: 'X', floor: 100, previous: 120, suggested: 110 }] });
ok(fb.series.length === 3 && fb.series[0].data[0] === 100 && fb.series[2].data[0] === 110, 'precio contra piso: piso, anterior y sugerido');
const pr = HS.build.priceVsRivals({ rows: [{ name: 'X', mine: 100, rivals: [90, 95] }] });
ok(pr.series[1].data.length === 2, 'mi precio contra rivales: un punto por rival');
const sp = HS.build.spark({ values: [1, 2, 3], tone: 'applied' });
ok(sp.series[0].data.length === 3, 'sparkline lista para series historicas');
ok(fb.aria && fb.aria.enabled, 'accesibilidad (aria) activa');

console.log('Contraste de la paleta semantica sobre la superficie (graficos >= 3:1)');
function lum(hex) {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(n.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
for (const key of ['holo_dark', 'holo_light']) {
  const t = themes[key];
  const surface = t.tokens.surface1;
  ok(ratio(t.emerald, surface) >= 3, `${key}: menta (aplicado) legible`);
  ok(ratio(t.tokens.chart1, surface) >= 3, `${key}: violeta (pendiente) legible`);
  ok(ratio(t.amber, surface) >= 3, `${key}: ambar (riesgo) legible`);
}

console.log('Conectar Celular solo en Kanban y Scanner');
const html = read('public/index.html');
ok(/id="btnConnectCell"[^>]*data-ops-only/.test(html), 'boton de escritorio marcado data-ops-only');
ok(/id="btnConnectCellMobile"[^>]*data-ops-only/.test(html), 'boton movil marcado data-ops-only');
const app = read('public/app.js');
ok(/function updateOpsOnlyControls\(moduleName\)[\s\S]{0,200}'kanban'[\s\S]{0,80}'scanner'/.test(app), 'visible solo si el modulo es kanban o scanner');
ok(app.includes('updateOpsOnlyControls(normMod)') && app.includes('updateOpsOnlyControls(parentModule)'), 'se actualiza al cambiar de modulo y de pestana');

console.log('Vistas Tabla / Dashboard');
ok(html.includes('id="smartpriceDashboard"') && html.includes('id="monitorsDashboard"'), 'SmartPrice y Monitor tienen dashboard');
ok(/kpi-cell tone-pending/.test(html) && /kpi-cell tone-applied/.test(html) && /kpi-cell tone-risk/.test(html), 'KPIs de SmartPrice con codigo de color semantico');
ok(!/id="kpiFloorShielded"[^>]*var\(--red\)/.test(html), 'pisos activos sin rojo');

if (failed) { console.error(`\n${failed} verificaciones fallaron`); process.exit(1); }
console.log('\nSuite de graficos OK');
