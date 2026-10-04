/**
 * Core: el tema de respaldo del Scanner sale de themes.json (fuente unica).
 * No requiere base de datos.
 */
const fs = require('fs');
const path = require('path');
const { buildDefaultTheme, TARGET } = require('../modules/scanner/scripts/sync-default-theme');

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  OK   ${msg}`); else { failed++; console.error(`  FAIL ${msg}`); } };

const expected = buildDefaultTheme();
const committed = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
ok(JSON.stringify(committed) === JSON.stringify(expected), 'defaultTheme.json coincide con holo_dark de themes.json');

const store = fs.readFileSync(path.join(__dirname, '../modules/scanner/src/store/useThemeStore.ts'), 'utf8');
ok(store.includes("from '../theme/defaultTheme.json'"), 'useThemeStore importa el tema de respaldo generado');
ok(!/DEFAULT_THEME[^=]*=\s*\{[^}]*#[0-9A-Fa-f]{3,8}/.test(store), 'useThemeStore no repite colores fijos');

console.log(failed === 0 ? '\nTema de respaldo del Scanner OK' : `\n${failed} fallo(s)`);
process.exit(failed === 0 ? 0 : 1);
