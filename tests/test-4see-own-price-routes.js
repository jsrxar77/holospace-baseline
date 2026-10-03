/**
 * tests/test-4see-own-price-routes.js
 * Maestro-detalle de Competencia: un producto vigilado (con "tu precio" guardado una sola vez)
 * puede tener varios rivales; se puede agregar un rival mas, editar uno existente, editar tu
 * precio del producto, y nunca se guarda un precio o un stock inventado. Contra PostgreSQL real.
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
  console.log('TEST SUITE: MAESTRO-DETALLE (PRODUCTO VIGILADO Y SUS RIVALES)');
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

    console.log('\n--- 3. Alta de un producto vigilado (Competencia): sin lectura y sin permitirlo, se rechaza ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/watched-products', method: 'POST' }, res, {
      ...ctx, data: { productName: 'Moet Ice 750 ml', competitorUrl: UNREACHABLE_URL, myPrice: '18.020,50' }
    });
    assert(res.getStatusCode() === 422, 'Responde 422 si el rival no se pudo leer');
    assert(res.getBody().code === 'RIVAL_UNREADABLE', 'Codigo RIVAL_UNREADABLE');
    const noProduct = await getOne('SELECT id FROM fourseee_products WHERE tenant_id = ? AND title = ?', [tenantId, 'Moet Ice 750 ml'], { tenantId });
    assert(!noProduct, 'No se crea el producto sin confirmar que el rival quedo sin leer');

    console.log('\n--- 4. Alta con "guardar igual": no se inventa precio ni stock del rival ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/watched-products', method: 'POST' }, res, {
      ...ctx, data: { productName: 'Moet Ice 750 ml', competitorUrl: UNREACHABLE_URL, myPrice: '18.020,50', allowUnreadable: true }
    });
    assert(res.getStatusCode() === 200, 'Se crea al permitir guardar con el rival sin leer');
    const productId = res.getBody().productId;
    const monitorId = res.getBody().monitorId;
    const product = await getOne('SELECT * FROM fourseee_products WHERE id = ?', [productId], { tenantId });
    assert(product.in_analysis === true, 'el producto queda en analisis');
    assert(parseFloat(product.current_price) === 18020.5, 'tu precio se guarda en el producto (no en el rival)');
    assert(product.price_source === 'MANUAL', 'se registra que tu precio salio del valor cargado a mano');
    const row = await getOne('SELECT * FROM fourseee_competitor_monitors WHERE id = ?', [monitorId], { tenantId });
    assert(row.product_id === productId, 'el rival queda colgado del producto');
    assert(row.competitor_price === null, 'competitor_price queda NULL (no 0) cuando no se pudo leer');
    assert(row.competitor_stock === null, 'competitor_stock queda NULL (no "IN_STOCK" supuesto)');
    assert(!!row.competitor_read_error, 'se guarda el motivo por el que no se pudo leer');

    console.log('\n--- 5. Agregar un segundo rival al mismo producto: reutiliza tu precio, no lo vuelve a pedir ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/watched-products/${productId}/monitors`, method: 'POST' }, res, {
      ...ctx, data: { competitorUrl: UNREACHABLE_URL, competitorName: 'Segundo rival', allowUnreadable: true }
    });
    assert(res.getStatusCode() === 200, 'Se agrega un segundo rival al producto existente');
    const monitorId2 = res.getBody().monitorId;
    assert(monitorId2 !== monitorId, 'es un rival distinto del primero');
    const list = await query('SELECT * FROM fourseee_competitor_monitors WHERE product_id = ?', [productId], { tenantId });
    assert(list.length === 2, 'el producto ahora tiene 2 rivales');
    const stillOneProduct = await query('SELECT id FROM fourseee_products WHERE tenant_id = ? AND title = ?', [tenantId, 'Moet Ice 750 ml'], { tenantId });
    assert(stillOneProduct.length === 1, 'sigue siendo un solo producto (no se duplico al agregar el rival)');

    console.log('\n--- 6. Editar un rival existente (link y nombre) ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/monitors/${monitorId2}`, method: 'PATCH' }, res, {
      ...ctx, data: { competitorUrl: UNREACHABLE_URL, competitorName: 'Rival renombrado', allowUnreadable: true }
    });
    assert(res.getStatusCode() === 200, 'Se puede editar un rival ya cargado (antes solo se podia borrar y recrear)');
    const edited = await getOne('SELECT * FROM fourseee_competitor_monitors WHERE id = ?', [monitorId2], { tenantId });
    assert(edited.competitor_name === 'Rival renombrado', 'el nombre del rival se actualizo');

    console.log('\n--- 7. Editar tu precio del producto: se aplica a todos sus rivales, no a uno solo ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/watched-products/${productId}`, method: 'PATCH' }, res, {
      ...ctx, data: { myPrice: '20.000,00' }
    });
    assert(res.getStatusCode() === 200, 'Se puede editar tu precio del producto');
    const updatedProduct = await getOne('SELECT * FROM fourseee_products WHERE id = ?', [productId], { tenantId });
    assert(parseFloat(updatedProduct.current_price) === 20000, 'el precio del producto se actualizo');
    const rivalsOfProduct = await query('SELECT id FROM fourseee_competitor_monitors WHERE product_id = ?', [productId], { tenantId });
    assert(rivalsOfProduct.length === 2, 'los dos rivales se mantienen vinculados al mismo producto con el precio nuevo');

    console.log('\n--- 8. Listado maestro-detalle: cada producto trae sus rivales adentro ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/watched-products', method: 'GET' }, res, { ...ctx, data: {} });
    const listed = res.getBody().products.find((p) => p.id === productId);
    assert(!!listed && Array.isArray(listed.monitors) && listed.monitors.length === 2, 'el producto trae sus 2 rivales embebidos (sin pedirlos aparte)');

    console.log('\n--- 9. Revisar ("check") un rival sin red: no pisa el precio con un 0 ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/monitors/${monitorId}/check`, method: 'POST' }, res, { ...ctx, data: {} });
    assert(res.getStatusCode() === 200, 'La revision responde 200 aunque no se pueda leer');
    const afterCheck = await getOne('SELECT * FROM fourseee_competitor_monitors WHERE id = ?', [monitorId], { tenantId });
    assert(afterCheck.competitor_price === null, 'sigue en NULL: no aparece un precio inventado tras revisar');

    console.log('\n--- 10. Tienda inexistente: no se listan productos inventados ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/stores/${crypto.randomUUID()}/products`, method: 'GET' }, res, ctx);
    assert(res.getStatusCode() === 404, 'Tienda que no existe o no es tuya: 404, no una lista vacia disfrazada de exito');

    console.log('\n--- 11. Sacar un producto del analisis: sale de Competencia pero queda en el catalogo ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/watched-products/${productId}`, method: 'DELETE' }, res, { ...ctx, data: {} });
    assert(res.getStatusCode() === 200, 'Se puede sacar el producto del analisis');
    const catalogRow = await getOne('SELECT id, in_analysis FROM fourseee_products WHERE id = ?', [productId], { tenantId });
    assert(catalogRow && catalogRow.in_analysis === false, 'el producto sigue en el catalogo y ya no esta en analisis');

    console.log('\n--- 12. Aislamiento: otro tenant no ve los productos de este ---');
    const otherTenantId = crypto.randomUUID();
    await execute(`INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Own Price B', 'tenant-own-price-b', 'active') ON CONFLICT (id) DO NOTHING`, [otherTenantId]);
    await setTenantModuleState(otherTenantId, '4see', true, 'superadmin@holospace.com');
    const otherUser = { id: crypto.randomUUID(), email: 'b@own-price-tests.com', role: 'ADMIN', permissions: ['4see:catalog:read'] };
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/watched-products', method: 'GET' }, res, { currentUser: otherUser, tenantId: otherTenantId, isSuperAdmin: false, data: {} });
    const otherList = res.getBody().products || [];
    assert(!otherList.some((p) => p.name === 'Moet Ice 750 ml'), 'el producto de un tenant no aparece en otro (RLS)');

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
