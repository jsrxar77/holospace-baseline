const fs = require('fs');
const path = require('path');
const themes = require('./themes.json');

const HOLO_COMPONENTS_PATH = path.join(__dirname, 'holo.css');

const kebab = (s) => s.replace(/[A-Z]|\d+/g, (m) => '-' + m.toLowerCase());

// Variables CSS de un tema: tokens base (compatibles con el CSS legado) + tokens extendidos --hw-*.
function themeVars(t) {
  const v = {
    '--bg-main': t.background, '--bg-dark': t.background, '--bg-black': t.background,
    '--card-bg': t.cardBg, '--card-border': t.cardBorder,
    '--emerald': t.emerald, '--cobalt': t.cobalt, '--amber': t.amber, '--red': t.red,
    '--text-main': t.textMain, '--text-muted': t.textMuted,
    '--hw-font-family': `'${t.fontFamily}'`, '--hw-font-mono': `'${t.fontMono}'`,
    '--hw-radius-card': t.radiusCard + 'px', '--hw-radius-btn': t.radiusBtn + 'px',
    '--hw-radius-badge': t.radiusBadge + 'px', '--hw-border-width': t.borderWidth + 'px'
  };
  for (const [k, val] of Object.entries(t.tokens || {})) {
    v['--hw-' + kebab(k)] = typeof val === 'number' ? val + 'px' : val;
  }
  return v;
}

// CSS generado desde themes.json (unica fuente de verdad) para los temas que declaran tokens extendidos.
function buildThemeCss() {
  const blocks = Object.values(themes)
    .filter((t) => t.tokens)
    .map((t) => {
      const body = Object.entries(themeVars(t)).map(([k, val]) => `  ${k}: ${val};`).join('\n');
      return `body.theme-${t.key}, :root[data-theme="${t.key}"] {\n  color-scheme: ${t.tokens.colorScheme || t.mode};\n${body}\n}`;
    });
  const components = fs.existsSync(HOLO_COMPONENTS_PATH) ? fs.readFileSync(HOLO_COMPONENTS_PATH, 'utf8') : '';
  return `/* Generado desde modules/themes/themes.json. No editar tokens aqui. */\n${blocks.join('\n\n')}\n\n${components}`;
}

module.exports = {
  THEMES: themes,
  DEFAULT_THEME: themes.omarchy_tiling,
  getTheme: (key) => themes[key] || themes.omarchy_tiling,
  listThemes: () => Object.values(themes),
  themeVars,
  buildThemeCss
};
