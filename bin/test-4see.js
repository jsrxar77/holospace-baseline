/**
 * bin/test-4see.js
 * Verificación automatizada de lógica, fórmulas, extractor y base de datos del módulo 4see
 */
const { query, getOne } = require('../lib/db');
const { calculateMarginMetrics } = require('../modules/4see/lib/margins');
const { extractProductData } = require('../modules/4see/lib/extractor');
const { PLANS } = require('../lib/billing');

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: MODULO 4SEE (E-COMMERCE INTELLIGENCE ON AUTOPILOT)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Verificar fórmulas de margen y detección de zona roja
  console.log('\n--- 1. Formulas de Rentabilidad y Repricing Tactico ---');
  const metricsHealthy = calculateMarginMetrics({
    costPrice: 5000,
    sellingPrice: 10000,
    minMarginPct: 20,
    platformFeePct: 13,
    taxPct: 21,
    shippingCost: 500
  });
  // Price: 10000, Cost: 5000, Fee: 1300, Tax: 2100, Shipping: 500 => Net: 1100 => 11% real margin < 20% => isRedZone: true
  assert(metricsHealthy.netProfit === 1100, 'Calculo de ganancia neta exacta ($1100)');
  assert(metricsHealthy.isRedZone === true, 'Deteccion correcta de Zona Roja (11% < 20%)');
  assert(metricsHealthy.suggestedRepricingPrice === 10800, 'Repricing tactico con +8% ($10800)');

  const metricsLoss = calculateMarginMetrics({
    costPrice: 8000,
    sellingPrice: 10000,
    minMarginPct: 15,
    platformFeePct: 13,
    taxPct: 21,
    shippingCost: 0
  });
  // 10000 - 8000 - 1300 - 2100 = -1400 => Net: -1400 => isRedZone: true
  assert(metricsLoss.netProfit < 0, 'Deteccion de venta a perdida');
  assert(metricsLoss.isRedZone === true, 'Marcado de Zona Roja ante perdida');

  // 2. Verificar motor extractor
  console.log('\n--- 2. Motor de Extraccion en Cascada ---');
  const mlExtract = await extractProductData('https://articulo.mercadolibre.com.ar/MLA-12345678-test');
  assert(mlExtract && mlExtract.store !== undefined, 'Extractor reconoce URLs estructuradas');

  // 3. Entitlements y Planes Comerciales en lib/billing.js
  console.log('\n--- 3. Catalogo de Planes Comerciales (Billing) ---');
  assert(PLANS.pro.includedModules.includes('4see'), 'Plan PRO incluye modulo 4see');
  assert(PLANS.enterprise.includedModules.includes('4see'), 'Plan ENTERPRISE incluye modulo 4see');
  assert(!PLANS.starter.includedModules.includes('4see'), 'Plan STARTER NO incluye modulo 4see (upsell)');

  // 4. Verificación de Base de Datos (si PostgreSQL esta activo)
  console.log('\n--- 4. Integridad en Base de Datos PostgreSQL 16 ---');
  try {
    const mod = await getOne("SELECT * FROM modules WHERE key = '4see'", [], { isSuperAdmin: true });
    assert(mod && mod.key === '4see', 'Modulo 4see registrado en tabla modules');
  } catch (dbErr) {
    console.log('[INFO] Base de datos no conectada en host local (5434). Las migraciones se aplicaran al levantar Docker Compose.');
  }

  console.log('\n======================================================================');
  console.log(`RESULTADOS: ${passed} pasados, ${failed} fallados`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
