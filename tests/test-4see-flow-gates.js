/**
 * Core/4see: el flujo de Productos no permite saltar pasos (public/flow.js). No requiere base de datos.
 */
const { computeFlow, rivalSummary, costBreakdown } = require('../public/flow.js');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const byN = (flow, n) => flow.steps.find((s) => s.n === n);

console.log('Catalogo vacio: solo se puede empezar por el paso 1');
let f = computeFlow([], []);
ok(!byN(f, 1).locked && !byN(f, 1).done, 'paso 1 disponible y pendiente');
ok(byN(f, 2).locked && byN(f, 2).blockedBy === 1, 'Análisis bloqueado por el catálogo');
ok(byN(f, 3).locked && byN(f, 3).blockedBy === 2, 'Costos bloqueado hasta tener un producto en análisis');
ok(f.suggestedStep === 1, 'la pantalla sugiere empezar por el catálogo');

console.log('Catalogo con productos, nada en analisis');
f = computeFlow([{ id: 'a', in_analysis: false }], []);
ok(byN(f, 1).done && !byN(f, 2).locked, 'catálogo hecho y Análisis disponible');
ok(byN(f, 3).locked && /Primero elegí/.test(byN(f, 3).reason), 'Costos explica que falta elegir un producto');
ok(f.suggestedStep === 2, 'la pantalla sugiere Análisis');

console.log('Producto en analisis sin rivales ni costos');
f = computeFlow([{ id: 'a', in_analysis: true, monitors: [], costs_loaded: false }], []);
ok(!byN(f, 3).locked, 'Costos disponible en cuanto hay un producto en análisis');
ok(byN(f, 4).locked && byN(f, 4).blockedBy === 2, 'Sugerencias bloqueadas hasta sumar un rival');
ok(f.summary.analysisCount === 1 && f.summary.withRivals === 0, 'resumen: 1 en análisis y 0 con rivales');

console.log('Rival cargado pero sin costos: sigue bloqueado');
f = computeFlow([{ id: 'a', in_analysis: true, monitors: [{ id: 'm' }], costs_loaded: false }], []);
ok(byN(f, 2).done && !byN(f, 3).done, 'Análisis hecho con rival, costos pendientes');
ok(byN(f, 4).locked && byN(f, 4).blockedBy === 3, 'Sugerencias bloqueadas: falta costo');

console.log('Rival y costos: sugerencias disponibles');
f = computeFlow([{ id: 'a', in_analysis: true, monitors: [{ id: 'm' }], costs_loaded: true }], [{ status: 'PENDING', product_id: 'a' }]);
ok(!byN(f, 4).locked && byN(f, 4).done, 'Sugerencias disponibles y con propuestas para decidir');
ok(f.summary.suggestionsPending === 1, 'cuenta las sugerencias pendientes');

console.log('Sugerencias de un producto que ya no esta en analisis no cuentan en el paso 4');
f = computeFlow([{ id: 'a', in_analysis: false, monitors: [], costs_loaded: false }], [{ status: 'PENDING', product_id: 'a' }]);
ok(byN(f, 4).done === false, 'una sugerencia pendiente de un producto fuera de analisis no marca el paso 4 como hecho');
f = computeFlow([{ id: 'a', in_analysis: true, monitors: [{ id: 'm' }], costs_loaded: true }], [{ status: 'PENDING', product_id: 'a' }]);
ok(byN(f, 4).done === true, 'una sugerencia de un producto en analisis si cuenta');

console.log('Un producto fuera de analisis no cuenta para los pasos siguientes');
f = computeFlow([{ id: 'a', in_analysis: false, monitors: [{ id: 'm' }], costs_loaded: true }], []);
ok(byN(f, 3).locked && byN(f, 4).locked, 'rival y costo de un producto fuera de análisis no desbloquean nada');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nGates del flujo OK');
console.log('Contexto de precios: rivales y costos');
const rs = rivalSummary([
  { competitor_name: 'A', competitor_price: '185240.00', competitor_stock: 'IN_STOCK' },
  { competitor_name: 'B', competitor_price: '175000.00', competitor_stock: 'OUT_OF_STOCK' },
  { competitor_name: 'C', competitor_price: null, competitor_stock: null },
  { competitor_name: 'D', competitor_price: '180000.00', competitor_stock: null }
]);
ok(rs.pricedCount === 3, 'cuenta solo los rivales con precio');
ok(rs.cheapestInStock && rs.cheapestInStock.name === 'D', 'el mas barato con stock ignora al que se quedo sin stock');
ok(rs.cheapest && rs.cheapest.name === 'B', 'el mas barato a secas es B');
ok(rivalSummary([]).cheapestInStock === null && rivalSummary(undefined).pricedCount === 0, 'sin rivales no inventa un precio');
let cb = costBreakdown({ price: 1000, cost: 600, operating: 100, marginPct: 20, ceiling: null });
ok(cb.ready && cb.totalCost === 700 && cb.floor === 820, 'piso = costo x (1 + margen) + operativos');
ok(cb.marginMoney === 300 && cb.marginPercent === 30 && !cb.priceBelowFloor, 'margen de hoy sobre tu precio');
cb = costBreakdown({ price: 800, cost: 600, operating: 100, marginPct: 20, ceiling: 700 });
ok(cb.priceBelowFloor && cb.ceilingBelowFloor, 'avisa si tu precio queda bajo el piso y si el tope es menor que el piso');
ok(costBreakdown({ price: 1000, cost: '', operating: 5 }).ready === false, 'sin costo no calcula nada');
ok(costBreakdown({ price: null, cost: 100 }).marginPercent === null, 'sin precio no inventa el margen');

process.exit(failed ? 1 : 0);