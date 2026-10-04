/**
 * tests/test-4see-analysis-flow.js
 * Flujo de 4see en una sola pantalla: el catalogo es el unico lugar donde se carga un producto,
 * se eligen cuantos entran en analisis (tope del plan) y a cada uno se le suman rivales (tope por
 * producto). Contra PostgreSQL real.
 */

const crypto = require('crypto');
const { execute, getOne, query } = require('../lib/db');
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

async function insertCatalogProduct(tenantId, index) {
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO fourseee_products (id, tenant_id, sku, title, current_price, price_source)
     VALUES (?, ?, ?, ?, 1000, 'MANUAL')`,
    [id, tenantId, `FLOW-${index}-${id.slice(0, 6)}`, `Producto flujo ${index}`],
    { tenantId }
  );
  return id;
}

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: FLUJO DE ANALISIS (CATALOGO -> ANALISIS -> RIVALES)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;
  const assert = (cond, name) => { if (cond) { console.log(`[PASS] ${name}`); passed++; } else { console.error(`[FAIL] ${name}`); failed++; } };

  const tenantId = crypto.randomUUID();
  await execute(
    `INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Analysis Flow', ?, 'active') ON CONFLICT (id) DO NOTHING`,
    [tenantId, `tenant-analysis-flow-${tenantId.slice(0, 8)}`]
  );
  await setTenantModuleState(tenantId, '4see', true, 'superadmin@holospace.com');

  const user = { id: crypto.randomUUID(), email: 'admin@analysis-flow.com', role: 'ADMIN', permissions: ['4see:catalog:read', '4see:pricing:write'] };
  const ctx = { currentUser: user, tenantId, isSuperAdmin: false };

  const otherTenantId = crypto.randomUUID();
  await execute(
    `INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Analysis Flow B', ?, 'active') ON CONFLICT (id) DO NOTHING`,
    [otherTenantId, `tenant-analysis-flow-b-${otherTenantId.slice(0, 8)}`]
  );
  await setTenantModuleState(otherTenantId, '4see', true, 'superadmin@holospace.com');

  try {
    console.log('\n--- 1. El catalogo es la unica entrada: los productos nuevos arrancan fuera del analisis ---');
    const productIds = [];
    for (let i = 1; i <= 6; i++) productIds.push(await insertCatalogProduct(tenantId, i));
    const fresh = await getOne('SELECT in_analysis, costs_loaded FROM fourseee_products WHERE id = ?', [productIds[0]], { tenantId });
    assert(fresh.in_analysis === false, 'un producto del catalogo arranca sin estar en analisis');
    assert(fresh.costs_loaded === false, 'y sin costos cargados (no se inventa un margen)');

    console.log('\n--- 2. El tope del plan Simple (5 productos) se aplica al elegir ---');
    let res = createMockRes();
    for (let i = 0; i < 5; i++) {
      res = createMockRes();
      await handle4seeApi({ url: `/api/4see/products/${productIds[i]}/analysis`, method: 'POST' }, res, { ...ctx, data: { inAnalysis: true } });
      assert(res.getStatusCode() === 200, `producto ${i + 1} entra en analisis dentro del tope`);
    }
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[5]}/analysis`, method: 'POST' }, res, { ...ctx, data: { inAnalysis: true } });
    assert(res.getStatusCode() === 403, 'el sexto producto se rechaza con 403');
    assert(res.getBody().code === 'PLAN_LIMIT_REACHED', 'codigo PLAN_LIMIT_REACHED');

    console.log('\n--- 3. El contador de la pantalla refleja el uso del plan ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/products', method: 'GET' }, res, { ...ctx, data: {} });
    assert(res.getBody().analysis && res.getBody().analysis.used === 5, 'muestra 5 productos analizados');
    assert(res.getBody().analysis.max === 5 && res.getBody().analysis.planName, 'muestra el maximo del plan y su nombre');

    console.log('\n--- 4. Sacar un producto libera el lugar y no lo borra del catalogo ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[0]}/analysis`, method: 'POST' }, res, { ...ctx, data: { inAnalysis: false } });
    assert(res.getStatusCode() === 200, 'se puede sacar un producto del analisis');
    const stillInCatalog = await getOne('SELECT id, in_analysis FROM fourseee_products WHERE id = ?', [productIds[0]], { tenantId });
    assert(stillInCatalog && stillInCatalog.in_analysis === false, 'sigue en el catalogo, fuera del analisis');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[5]}/analysis`, method: 'POST' }, res, { ...ctx, data: { inAnalysis: true } });
    assert(res.getStatusCode() === 200, 'el lugar liberado se puede usar para otro producto');

    console.log('\n--- 5. La pantalla lista todo el catalogo con su marca de analisis y el contador del plan ---');
    res = createMockRes();
    await handle4seeApi({ url: '/api/4see/watched-products', method: 'GET' }, res, { ...ctx, data: {} });
    const listed = res.getBody().products;
    assert(listed.length === 6, 'la lista trae los 6 productos del catalogo');
    const sacado = listed.find((p) => p.id === productIds[0]);
    assert(sacado && sacado.in_analysis === false, 'el producto sacado del analisis aparece con in_analysis = false');
    assert(res.getBody().analysis && res.getBody().analysis.used === 5, 'el contador del plan dice 5 en analisis');

    console.log('\n--- 6. Tope de rivales por producto (Simple: 3) ---');
    const rivalTarget = productIds[1];
    for (let i = 0; i < 3; i++) {
      res = createMockRes();
      await handle4seeApi({ url: `/api/4see/watched-products/${rivalTarget}/monitors`, method: 'POST' }, res, {
        ...ctx, data: { competitorUrl: UNREACHABLE_URL, competitorName: `Rival ${i + 1}`, allowUnreadable: true }
      });
      assert(res.getStatusCode() === 200, `rival ${i + 1} se suma al producto`);
    }
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/watched-products/${rivalTarget}/monitors`, method: 'POST' }, res, {
      ...ctx, data: { competitorUrl: UNREACHABLE_URL, competitorName: 'Rival 4', allowUnreadable: true }
    });
    assert(res.getStatusCode() === 403 && res.getBody().code === 'PLAN_LIMIT_REACHED', 'el cuarto rival se rechaza con PLAN_LIMIT_REACHED');

    console.log('\n--- 6b. Costos: sin costo no se marca listo; con costo queda listo para sugerir ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[3]}/costs`, method: 'PATCH' }, res, { ...ctx, data: { costPrice: '' } });
    assert(res.getStatusCode() === 400, 'sin costo se rechaza (no se inventa un margen)');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[3]}/costs`, method: 'PATCH' }, res, { ...ctx, data: { costPrice: 500, operatingCosts: 50, minMarginPercentage: 20 } });
    assert(res.getStatusCode() === 200, 'con costo se guarda');
    const costed = await getOne('SELECT costs_loaded, cost_price, min_price_floor FROM fourseee_products WHERE id = ?', [productIds[3]], { tenantId });
    assert(costed.costs_loaded === true && parseFloat(costed.min_price_floor) === 650, 'queda listo para sugerir, con piso de margen calculado (500 x 1,20 + 50 = 650)');

    console.log('\n--- 6c. Catalogo: editar, validar, impacto y quitar ---');
    const editable = await insertCatalogProduct(tenantId, 9);
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${editable}`, method: 'PATCH' }, res, { ...ctx, data: { title: '   ', sku: 'X-1', price: '' } });
    assert(res.getStatusCode() === 400, 'no se guarda un producto sin nombre');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${editable}`, method: 'PATCH' }, res, { ...ctx, data: { title: 'Producto editado', sku: productIds[1] ? (await getOne('SELECT sku FROM fourseee_products WHERE id = ?', [productIds[1]], { tenantId })).sku : 'X', price: 2500.5 } });
    assert(res.getStatusCode() === 409, 'un codigo repetido en el mismo catalogo se rechaza con 409');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${editable}`, method: 'PATCH' }, res, { ...ctx, data: { title: '  Producto   editado ', sku: 'EDIT-OK-1', price: 2500.5 } });
    assert(res.getStatusCode() === 200, 'se guarda la edicion con codigo nuevo');
    const edited = await getOne('SELECT title, sku, current_price FROM fourseee_products WHERE id = ?', [editable], { tenantId });
    assert(edited.title === 'Producto editado' && parseFloat(edited.current_price) === 2500.5, 'el nombre se limpia y el precio se guarda como numero');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[1]}/impact`, method: 'GET' }, res, { ...ctx, data: {} });
    assert(res.getBody().impact && res.getBody().impact.rivals >= 1, 'el impacto cuenta los rivales antes de borrar');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[1]}`, method: 'DELETE' }, res, { ...ctx, data: {} });
    assert(res.getStatusCode() === 200, 'se puede quitar un producto del catalogo');
    const gone = await getOne('SELECT id FROM fourseee_products WHERE id = ?', [productIds[1]], { tenantId });
    const orphan = await query('SELECT id FROM fourseee_competitor_monitors WHERE product_id = ?', [productIds[1]], { tenantId });
    assert(!gone && orphan.length === 0, 'al quitarlo se van tambien sus rivales (no quedan huerfanos)');

    console.log('\n--- 6d. Costos: cambiar un costo recalcula la sugerencia pendiente (sin datos viejos) ---');
    const costedRecalc = productIds[2];
    await execute(
      `INSERT INTO fourseee_competitor_monitors (id, tenant_id, product_id, product_name, competitor_url, competitor_price, competitor_stock)
       VALUES (?, ?, ?, 'Producto flujo 3', 'https://rival.example/p', 150, 'IN_STOCK')`,
      [crypto.randomUUID(), tenantId, costedRecalc],
      { tenantId }
    );
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${costedRecalc}/costs`, method: 'PATCH' }, res, { ...ctx, data: { costPrice: 500, operatingCosts: 50, minMarginPercentage: 20 } });
    let pendingRows = await query("SELECT suggested_price FROM fourseee_price_update_queue WHERE product_id = ? AND status = 'PENDING'", [costedRecalc], { tenantId });
    assert(pendingRows.length === 1 && parseFloat(pendingRows[0].suggested_price) === 650, 'con costo 500 el piso (650) frena la sugerencia');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${costedRecalc}/costs`, method: 'PATCH' }, res, { ...ctx, data: { costPrice: 100, operatingCosts: 0, minMarginPercentage: 20 } });
    pendingRows = await query("SELECT suggested_price FROM fourseee_price_update_queue WHERE product_id = ? AND status = 'PENDING'", [costedRecalc], { tenantId });
    assert(pendingRows.length === 1 && Math.abs(parseFloat(pendingRows[0].suggested_price) - 148.5) < 0.01, 'al bajar el costo se recalcula: 1% por debajo de 150 (148,50), sin quedar la sugerencia vieja');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${costedRecalc}/analysis`, method: 'POST' }, res, { ...ctx, data: { inAnalysis: false } });
    pendingRows = await query("SELECT id FROM fourseee_price_update_queue WHERE product_id = ? AND status = 'PENDING'", [costedRecalc], { tenantId });
    assert(res.getStatusCode() === 200 && pendingRows.length === 0, 'quitar del analisis saca la sugerencia pendiente de ese producto');

    console.log('\n--- 6e. Sumar un rival a un producto nuevo lo pone en analisis (si el plan tiene lugar) ---');
    const tenantC = crypto.randomUUID();
    await execute(
      "INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Rival Auto', ?, 'active') ON CONFLICT (id) DO NOTHING",
      [tenantC, 'tenant-rival-auto-' + tenantC.slice(0, 8)]
    );
    await setTenantModuleState(tenantC, '4see', true, 'superadmin@holospace.com');
    const callC = async (url, method, data) => {
      const r = createMockRes();
      await handle4seeApi({ url, method }, r, { ...ctx, tenantId: tenantC, data });
      return r;
    };
    const rivalBody = { competitorUrl: UNREACHABLE_URL, competitorName: 'Rival QA', allowUnreadable: true };
    const nuevo = await insertCatalogProduct(tenantC, 1);
    res = await callC('/api/4see/watched-products/' + nuevo + '/monitors', 'POST', rivalBody);
    assert(res.getStatusCode() === 200 && res.getBody().analysisStarted === true, 'sumar el primer rival a un producto nuevo funciona y avisa que empezo el analisis');
    let fila = await getOne('SELECT in_analysis FROM fourseee_products WHERE id = ?', [nuevo], { tenantId: tenantC });
    assert(fila.in_analysis === true, 'el producto quedo en analisis sin tener que marcarlo aparte');
    let rivales = await query('SELECT id FROM fourseee_competitor_monitors WHERE product_id = ?', [nuevo], { tenantId: tenantC });
    assert(rivales.length === 1, 'el rival quedo guardado');

    // llenar el plan Simple (5 productos): el nuevo ya ocupa uno
    for (let i = 2; i <= 5; i++) {
      const extra = await insertCatalogProduct(tenantC, i);
      await execute('UPDATE fourseee_products SET in_analysis = true WHERE id = ?', [extra], { tenantId: tenantC });
    }
    const sinLugar = await insertCatalogProduct(tenantC, 6);
    res = await callC('/api/4see/monitors/preview', 'POST', { competitorUrl: UNREACHABLE_URL, watchedProductId: sinLugar });
    assert(res.getStatusCode() === 403 && res.getBody().code === 'PLAN_LIMIT_REACHED', 'sin lugar en el plan, la vista previa del rival ya avisa (403)');
    res = await callC('/api/4see/watched-products/' + sinLugar + '/monitors', 'POST', rivalBody);
    assert(res.getStatusCode() === 403 && res.getBody().code === 'PLAN_LIMIT_REACHED' && /Sacá uno del análisis/.test(res.getBody().error), 'sin lugar en el plan, sumar el rival se frena con el motivo');
    fila = await getOne('SELECT in_analysis FROM fourseee_products WHERE id = ?', [sinLugar], { tenantId: tenantC });
    rivales = await query('SELECT id FROM fourseee_competitor_monitors WHERE product_id = ?', [sinLugar], { tenantId: tenantC });
    assert(fila.in_analysis === false && rivales.length === 0, 'no quedo ni el rival ni el analisis a medias');
    res = await callC('/api/4see/watched-products/' + nuevo + '/monitors', 'POST', { ...rivalBody, competitorName: 'Otro rival' });
    assert(res.getStatusCode() === 200 && res.getBody().analysisStarted === false, 'un producto que ya esta en analisis sigue recibiendo rivales aunque el plan este lleno');
    res = await callC('/api/4see/watched-products/' + sinLugar, 'PATCH', { myPrice: '2.500,00' });
    fila = await getOne('SELECT current_price FROM fourseee_products WHERE id = ?', [sinLugar], { tenantId: tenantC });
    assert(res.getStatusCode() === 200 && parseFloat(fila.current_price) === 2500, 'Editar el precio funciona tambien en un producto fuera de analisis');

    console.log('\n--- 7. Aislamiento: otra organizacion no puede tocar este catalogo ---');
    res = createMockRes();
    await handle4seeApi({ url: `/api/4see/products/${productIds[2]}/analysis`, method: 'POST' }, res, {
      currentUser: { ...user, id: crypto.randomUUID() }, tenantId: otherTenantId, isSuperAdmin: false, data: { inAnalysis: true }
    });
    assert(res.getStatusCode() === 404, 'otra organizacion recibe 404, no puede marcar un producto ajeno');
    const untouched = await getOne('SELECT in_analysis FROM fourseee_products WHERE id = ?', [productIds[2]], { tenantId });
    assert(untouched.in_analysis === false, 'el producto ajeno no cambio (queda fuera de analisis, como lo dejo su dueño en la prueba de costos)');
  } catch (err) {
    console.error('Error inesperado:', err);
    failed++;
  }

  console.log(`\n======================================================================`);
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log(`======================================================================`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => { console.error('ERROR FATAL EN SUITE:', e); process.exit(1); });
