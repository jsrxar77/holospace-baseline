/**
 * 4see: regla de precio por defecto (sin reglas propias). Logica pura, sin base de datos.
 */
const { evaluateSmartPrice, DEFAULT_RULE } = require('../modules/4see/lib/smartprice');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };
const base = { id: 'p', cost_price: 100, operating_costs: 0, min_margin_percentage: 10, min_price_floor: 110, max_price_ceiling: 300, current_price: 200 };
const inStock = (price) => ({ is_active: true, last_scraped_price: price, last_scraped_stock: 'IN_STOCK' });

console.log('Regla por defecto: acercarse 1% por debajo del rival mas barato con stock');
ok(DEFAULT_RULE.trigger_condition === 'LOWEST_MARKET' && DEFAULT_RULE.offset_value === 1, 'la regla por defecto es 1% por debajo del mas barato');
let r = evaluateSmartPrice(base, [inStock(150), inStock(140)], []);
ok(r && r.suggested_price === 138.6, 'con rivales 150 y 140 propone 138,60 (140 menos 1%)');
ok(r && r.rule_id === null && r.trigger_reason === 'LOWEST_MARKET_IN_STOCK', 'queda marcada como regla por defecto (sin id)');

console.log('Nunca baja del piso ni supera el tope');
r = evaluateSmartPrice(base, [inStock(105)], []);
ok(r && r.suggested_price === 110 && r.floor_applied, 'si el rival esta debajo del piso, propone el piso');
r = evaluateSmartPrice({ ...base, max_price_ceiling: 120, current_price: 90 }, [inStock(400)], []);
ok(r && r.suggested_price === 120 && r.ceiling_applied, 'si el rival esta muy arriba, propone el tope');

console.log('Sin datos no se inventa nada');
r = evaluateSmartPrice(base, [], []);
ok(r === null, 'sin rivales y con precio sobre el piso no propone nada');
r = evaluateSmartPrice(base, [{ is_active: true, last_scraped_price: 140, last_scraped_stock: null }], []);
ok(r === null, 'un rival con stock desconocido no cuenta como disponible');
r = evaluateSmartPrice({ ...base, current_price: 90 }, [], []);
ok(r && r.trigger_reason === 'DEFAULT_FLOOR_PROTECTION', 'sin rivales pero debajo del piso, protege el piso');

console.log('Las reglas propias tienen prioridad sobre la regla por defecto');
const own = [{ id: 'r1', is_active: true, priority: 5, trigger_condition: 'LOWEST_MARKET', action_type: 'FIXED_OFFSET_BELOW', offset_value: 10 }];
r = evaluateSmartPrice(base, [inStock(140)], own);
ok(r && r.rule_id === 'r1' && r.suggested_price === 130, 'una regla propia (10 pesos menos que el mas barato) se aplica en lugar de la por defecto');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nRegla por defecto OK');
process.exit(failed ? 1 : 0);
