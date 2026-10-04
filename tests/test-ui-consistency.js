/**
 * UI: componentes visuales compartidos entre la landing y la app (holospace-architect, regla de
 * "componentes visuales compartidos"). Falla si un componente que ya existe en un lugar se vuelve
 * a inventar distinto en otro (el caso real: el selector de tema era un <select> en la app y un
 * boton icono+palabra en la landing).
 */
const fs = require('fs');
const path = require('path');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

console.log('Selector de tema: un solo diseno en la landing y en la app');
const app = read('public/index.html');
const landing = read('modules/landing/public/index.html');

ok(!/headerThemeSelect|class="theme-select"|theme-selector-group/.test(app), 'ya no existe el <select> de tema en la app (reemplazado por el boton icono+palabra)');
ok(/class="hs-theme-toggle"/.test(app), 'la app usa el boton de tema compartido (.hs-theme-toggle)');
ok(/class="mode"/.test(landing), 'la landing sigue usando su boton de tema (.mode)');

function svgPaths(html, cls) {
  const m = html.match(new RegExp(`class="${cls}"[^>]*>(<path[^>]*/>|<circle[^>]*>[\\s\\S]*?</svg>)`, 'i')) || html.match(new RegExp(`<svg class="[^"]*${cls}[^"]*"[\\s\\S]*?</svg>`, 'i'));
  return m ? m[0].replace(/\s+/g, ' ') : null;
}
const appHtml = app;
const moonApp = (appHtml.match(/<svg class="hs-tt-moon"[\s\S]*?<\/svg>/) || [])[0];
const sunApp = (appHtml.match(/<svg class="hs-tt-sun"[\s\S]*?<\/svg>/) || [])[0];
const moonLanding = (landing.match(/<svg class="moon"[\s\S]*?<\/svg>/) || [])[0];
const sunLanding = (landing.match(/<svg class="sun"[\s\S]*?<\/svg>/) || [])[0];
const pathOf = (svg) => svg && (svg.match(/d="([^"]+)"/g) || []).join('|');
ok(!!moonApp && !!moonLanding && pathOf(moonApp) === pathOf(moonLanding), 'el icono de luna es el mismo trazo en la app y en la landing');
ok(!!sunApp && !!sunLanding && pathOf(sunApp) === pathOf(sunLanding), 'el icono de sol es el mismo trazo en la app y en la landing');

console.log('Precios de 4see: la respuesta de la API se muestra, no se descarta');
const appJs = read('public/app.js');
const recheck = (appJs.match(/async function recheckMonitor[\s\S]*?\n}\n/) || [''])[0];
ok(/\{\s*rival,\s*warning\s*\}\s*=\s*data/.test(recheck), '"Revisar ahora" lee el resultado de la lectura (rival, warning), no solo recarga la tabla');
ok(/rival\.ok/.test(recheck), 'si no se pudo leer el rival, se le avisa a quien hizo clic (no queda en silencio)');

console.log('Todas las tablas de la app usan el mismo componente (hs-table), no un <thead> armado a mano (D-051)');
const appJsFull = appJs;
ok(!/tenantsTableBody|usersTableBody|rolesTableBody|ordersExplorerGrid/.test(appJsFull + app), 'no quedan referencias a los <tbody> viejos de Empresas, Usuarios, Roles o Pedidos');
const HSTABLE_IDS = ['tenants', 'users', 'roles', 'explorer_orders', '4see_competencia', '4see_smartprice_queue', 'saved_stores'];
HSTABLE_IDS.forEach((id) => {
  ok(appJsFull.includes(`id: '${id}'`), `la tabla "${id}" se monta con HSTable.mount (no con HTML armado a mano)`);
});
const HSTABLE_CONTAINER_IDS = ['tenantsTableContainer', 'usersTableContainer', 'rolesTableContainer', 'ordersExplorerContainer'];
HSTABLE_CONTAINER_IDS.forEach((id) => {
  ok(app.includes(`id="${id}"`) && !new RegExp(`<table[^>]*>[\\s\\S]{0,40}<thead>[\\s\\S]{0,400}id="${id}"`).test(app), `${id}: contenedor simple, sin <thead> fijo en el HTML`);
});

if (failed) { console.error(`\n${failed} verificaciones fallaron`); process.exit(1); }
console.log('\nConsistencia de UI OK');
