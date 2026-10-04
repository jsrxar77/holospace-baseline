/**
 * Genera el tema de respaldo del Scanner desde modules/themes/themes.json (fuente unica).
 * Uso: node modules/scanner/scripts/sync-default-theme.js          (escribe el archivo)
 *      node modules/scanner/scripts/sync-default-theme.js --check  (falla si esta desactualizado)
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '../../themes/themes.json');
const TARGET = path.join(__dirname, '../src/theme/defaultTheme.json');

function buildDefaultTheme() {
  const t = JSON.parse(fs.readFileSync(SOURCE, 'utf8')).holo_dark;
  return {
    background: t.background,
    cardBg: t.cardBg,
    cardBorder: t.cardBorder,
    emerald: t.emerald,
    cobalt: t.cobalt,
    amber: t.amber,
    red: t.red,
    textMain: t.textMain,
    textMuted: t.textMuted,
    fontFamily: t.fontFamily,
    fontMono: t.fontMono,
    borderRadius: t.borderRadius,
    radiusCard: t.radiusCard,
    radiusBtn: t.radiusBtn,
    radiusBadge: t.radiusBadge,
    borderWidth: t.borderWidth,
    accentFg: t.tokens.accentFg
  };
}

if (require.main === module) {
  const next = JSON.stringify(buildDefaultTheme(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
    if (current !== next) { console.error('defaultTheme.json desactualizado: ejecutar sync-default-theme.js'); process.exit(1); }
    console.log('defaultTheme.json al dia');
  } else {
    fs.writeFileSync(TARGET, next);
    console.log('defaultTheme.json generado');
  }
}

module.exports = { buildDefaultTheme, SOURCE, TARGET };
