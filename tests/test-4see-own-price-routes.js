/**
 * tests/test-4see-own-price-routes.js
 * Rutas de /api/4see/monitors y /api/4see/products: nunca se guarda un precio o un stock inventado.
 * Usa dominios que no resuelven (sin red real) para forzar una lectura fallida del rival de forma deterministica.
 */

const crypto = require('crypto');
const { query, execute, getOne } = require('../lib/db');
const { handle4seeApi } = require('../modules/4see/routes/api');
const { setTenantModuleState } = require('../lib/entitlement');

const UNREACHABLE_URL = 'https://holospace-dominio-que-no-existe-qa.invalid/producto';

function createMockRes() {
  let statusCode = 200;
  let body = '';
  return {
    writeHead: (code) => { statusCode = code; },
    end: (data) => { body = data; },
    getStatusCode: () => statusCode,
    getBody: () => { try { return JSON.parse(body); } catch (e) { return body; } }
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: LECTURA DE PRECIOS SIN DATOS INVENTADOS (RUTAS 4SEE)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;
  const assert = (cond, name) => { if (cond) { console.log(`[PASS] ${name}`); passed++; } else { console.error(`[FAIL] ${name}`); failed++; } };

  const tenantId = crypto.randomUUID();
  await execute(
    `INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Own Price Tests', 'tenant-own-price-tests', 'active') ON CONFLICT (id) DO NOTHING`,
    [tenantId]
  );
  await setTenantModuleState(tenantId, '4see', true, 'superadmin@holospace.com');

  const user = { id: crypto.randomUUID(), email: 'admin@own-price-tests.com', role: 'ADMIN', permissions: ['4see:catalog:read', '4see:pricing:write'] };
  const ctx = { currentUser: user, tenantId, isSuperAdmin: false };

  try {
    console.log('\n--- 1. Producto nuevo sin ninguna fuente de precio ---');
    let res = createMockRes();
    await handle4seeApi({ url: '/api/4see/products', method: 'POST' }, res, { ...ctx, data: { sku: 'QA-1', title: 'Producto QA', cost_price: 100, min_margin_percentage: 10 } });
    assert(res.getStatusCode() === 422, 'Responde 422 cuando no hay tienda, link ni valor cargado');
    assert(res.getBody().code === 'OWN_PRICE_UNKNOWN', 'Codigo OWN_PRICE_UNKNOWN (no se inventa un precio)');
    const noRow = await getOne('SELECT id FROM fourseee_products WHERE tenant_id = ? AND sku = ?', [tenantId, 'QA-1'], { tenantId });
    assert(!noRow, 'No se crea ninguna fila sin precio resuelto');

    console.log('\n--- 2. Producto con precio a mano en formato argentino ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/products', method: 'POST' }, res, {
      ...ctx, data: { sku: 'QA-2', title: 'Producto QA 2', cost_price: 100, min_margin_percentage: 10, current_price: '18.020,50' }
    });
    assert(res.getStatusCode() === 201, 'Se crea con precio a mano');
    const created = res.getBody().product;
    assert(parseFloat(created.current_price) === 18020.5, '18.020,50 se guarda como 18020.5 (no 18,02 ni 1802050)');
    assert(created.price_source === 'MANUAL', 'Queda registrado que el precio se cargo a mano');

    console.log('\n--- 3. Alta de rival: sin lectura y sin permitirlo explicitamente, se rechaza ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/monitors', method: 'POST' }, res, {
      ...ctx, data: { productName: 'Rival QA', competitorUrl: UNREACHABLE_URL, myPrice: '18.020,50' }
    });
    assert(res.getStatusCode() === 422, 'Responde 422 si el rival no se pudo leer');
    assert(res.getBody().code === 'RIVAL_UNREADABLE', 'Codigo RIVAL_UNREADABLE');
    const noMonitor = await getOne('SELECT id FROM fourseee_competitor_monitors WHERE tenant_id = ? AND product_name = ?', [tenantId, 'Rival QA'], { tenantId });
    assert(!noMonitor, 'No se guarda el monitor sin confirmar que el rival quedo sin leer');

    console.log('\n--- 4. Alta de rival: con "guardar igual", no se inventa precio ni stock del rival ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/monitors', method: 'POST' }, res, {
      ...ctx, data: { productName: 'Rival QA', competitorUrl: UNREACHABLE_URL, myPrice: '18.020,50', allowUnreadable: true }
    });
    assert(res.getStatusCode() === 200, 'Se crea al permitir guardar con el rival sin leer');
    const monitorId = res.getBody().id;
    const row = await getOne('SELECT * FROM fourseee_competitor_monitors WHERE id = ?', [monitorId], { tenantId });
    assert(row.competitor_price === null, 'competitor_price queda NULL (no 0) cuando no se pudo leer');
    assert(row.competitor_stock === null, 'competitor_stock queda NULL (no "IN_STOCK" supuesto)');
    assert(!!row.competitor_read_error, 'se guarda el motivo por el que no se pudo leer');
    assert(parseFloat(row.my_price) === 18020.5, 'tu precio se guarda igual de bien aunque el rival no se haya podido leer');
    assert(row.my_price_source === 'MANUAL', 'se registra que tu precio salio del valor cargado a mano');

    console.log('\n--- 5. Revisar ("check") un rival sin red: no pisa el precio con un 0 ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/monitors/${monitorId}/check`, method: 'POST' }, res, { ...ctx, data: {} });
    assert(res.getStatusCode() === 200, 'La revision responde 200 aunque no se pueda leer');
    const afterCheck = await getOne('SELECT * FROM fourseee_competitor_monitors WHERE id = ?', [monitorId], { tenantId });
    assert(afterCheck.competitor_price === null, 'sigue en NULL: no aparece un precio inventado tras revisar');

    console.log('\n--- 6. Tienda inexistente: no se listan productos inventados ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/stores/${crypto.randomUUID()}/products`, method: 'GET' }, res, ctx);
    assert(res.getStatusCode() === 404, 'Tienda que no existe o no es tuya: 404, no una lista vacia disfrazada de exito');

    console.log('\n--- 7. Aislamiento: otro tenant no ve este monitor ---');
    const otherTenantId = crypto.randomUUID();
    await execute(`INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Own Price B', 'tenant-own-price-b', 'active') ON CONFLICT (id) DO NOTHING`, [otherTenantId]);
    await setTenantModuleState(otherTenantId, '4see', true, 'superadmin@holospace.com');
    const otherUser = { id: crypto.randomUUID(), email: 'b@own-price-tests.com', role: 'ADMIN', permissions: ['4see:catalog:read'] };
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/monitors', method: 'GET' }, res, { currentUser: otherUser, tenantId: otherTenantId, isSuperAdmin: false, data: {} });
    const otherList = res.getBody().monitors || [];
    assert(!otherList.some((m) => m.id === monitorId), 'el monitor de un tenant no aparece en otro (RLS)');

    await execute('DELETE FROM tenant_tenants WHERE id = ?', [otherTenantId]);
  } finally {
    await execute('DELETE FROM tenant_tenants WHERE id = ?', [tenantId]);
  }

  console.log('\n======================================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => { console.error('ERROR FATAL EN SUITE:', e); process.exit(1); });
