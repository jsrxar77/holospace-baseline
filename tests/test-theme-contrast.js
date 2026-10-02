/**
 * Core: contraste WCAG y coherencia de tokens de la familia Holo.
 * No requiere base de datos.
 */
const { THEMES, buildThemeCss } = require('../modules/themes');

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`  OK   ${msg}`); else { failed++; console.error(`  FAIL ${msg}`); } };

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const key of ['holo_dark', 'holo_light']) {
  const t = THEMES[key];
  console.log(`Tema ${key}`);
  ok(!!t && !!t.tokens, 'definido con tokens extendidos');
  const k = t.tokens;
  const surfaces = [t.background, k.surface1, k.surface2, k.surface3];
  for (const s of surfaces) {
    ok(ratio(t.textMain, s) >= 7, `texto principal sobre ${s} >= 7:1 (${ratio(t.textMain, s).toFixed(2)})`);
    ok(ratio(t.textMuted, s) >= 4.5, `texto secundario sobre ${s} >= 4.5:1 (${ratio(t.textMuted, s).toFixed(2)})`);
    ok(ratio(k.textSubtle, s) >= 3, `texto sutil sobre ${s} >= 3:1 (${ratio(k.textSubtle, s).toFixed(2)})`);
    for (const c of ['emerald', 'cobalt', 'amber', 'red']) {
      ok(ratio(t[c], s) >= 3, `${c} sobre ${s} >= 3:1 (${ratio(t[c], s).toFixed(2)})`);
    }
    for (let i = 1; i <= 6; i++) ok(ratio(k['chart' + i], s) >= 3, `chart${i} sobre ${s} >= 3:1`);
  }
  ok(ratio(k.accentFg, t.emerald) >= 4.5, `texto sobre boton primario >= 4.5:1 (${ratio(k.accentFg, t.emerald).toFixed(2)})`);
  ok(ratio(t.cardBorder, t.background) >= 1.1, 'borde visible respecto al fondo');
  ok(lum(k.surface3) !== lum(k.surface1), 'elevacion distinguible entre superficies');
}
ok(lum(THEMES.holo_dark.background) < 0.05 && lum(THEMES.holo_light.background) > 0.85, 'par oscuro/claro con modos opuestos');

// Una sola senal de alerta: el rojo se reemplaza por ambar en ambos temas
for (const key of ['holo_dark', 'holo_light']) {
  const th = THEMES[key];
  ok(th.red.toLowerCase() === th.amber.toLowerCase(), `${key}: la alerta (red) usa el ambar de la paleta`);
  ok(th.tokens.dangerSoft.includes(th.amber === '#F5B84B' ? '245,184,75' : '169,79,8'), `${key}: dangerSoft es el ambar suave`);
}

const css = buildThemeCss();
ok(css.includes('body.theme-holo_dark') && css.includes('body.theme-holo_light'), 'CSS generado incluye ambos temas');
const tokenBlocks = css.slice(0, css.indexOf('/* Holo Design System'));
ok(tokenBlocks.length > 0 && !/!important/.test(tokenBlocks), 'bloques de tokens sin !important');
ok(!/[\u{1F300}-\u{1FAFF}]/u.test(css), 'CSS sin emojis');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nContraste y tokens OK');
process.exit(failed ? 1 : 0);
