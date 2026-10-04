/**
 * Formato de montos, fechas y nombres (public/format.js). Logica pura, sin base de datos.
 */
const F = require('../public/format.js');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const NB = ' ';

console.log('Montos: formato unico en pesos');
ok(F.money(165200) === `$${NB}165.200,00`, 'entero: $ 165.200,00 (dos decimales siempre)');
ok(F.money(173250.5) === `$${NB}173.250,50`, 'con centavos: $ 173.250,50');
ok(F.money(0) === `$${NB}0,00`, 'cero se muestra como $ 0,00 (no desaparece)');
ok(F.money(-1200) === `-$${NB}1.200,00`, 'negativo con signo delante');
ok(F.money(null) === '—' && F.money('') === '—' && F.money('abc') === '—', 'vacio o no numerico: guion, nunca 0 inventado');

console.log('Lectura de montos escritos a mano');
ok(F.parseMoney('165.200,00') === 165200, 'acepta 165.200,00');
ok(F.parseMoney('165200,5') === 165200.5, 'acepta coma decimal sin miles');
ok(F.parseMoney('165200.50') === 165200.5, 'acepta punto decimal');
ok(F.parseMoney('$ 1.250.000') === 1250000, 'quita signo y separa miles con punto');
ok(Number.isNaN(F.parseMoney('')) && Number.isNaN(F.parseMoney('doce')), 'vacio o texto: NaN (no se guarda un monto)');

console.log('Nombres');
ok(F.name('  Moet   Ice  750 ml ') === 'Moet Ice 750 ml', 'espacios repetidos y de los extremos se limpian');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nFormato de montos OK');
process.exit(failed ? 1 : 0);
