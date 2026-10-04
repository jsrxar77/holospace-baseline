/**
 * 4see: alta de producto desde un link, una tienda o a mano. Contra PostgreSQL real y un servidor local
 * que sirve paginas reales guardadas en tests/fixtures (incluido el muro de inicio de sesion de Mercado Libre).
 * Reglas: si el link no se puede leer no se guarda nada; el SKU se lee y, si falta, se genera y se avisa.
 */
process.env.HS_ALLOW_PRIVATE_FETCH = '1'; // solo pruebas: permite leer el servidor local (nunca vale en produccion)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execute, getOne, query } = require('../lib/db');
const { handle4seeApi } = require('../modules/4see/routes/api');
const { setTenantModuleState } = require('../lib/entitlement');

const fixture = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const PAGES = {
  '/woo': { status: 200, body: fixture('woocommerce-poke-jack-daniels.html') },
  '/muro': { status: 200, body: fixture('mercadolibre-muro-de-login.html') },
  '/bloqueado': { status: 403, body: 'Forbidden' },
  '/sin-codigo': {
    status: 200,
    body: '<html><head><title>x</title><script type="application/ld+json">{"@type":"Product","name":"Whisky sin codigo","offers":{"@type":"Offer","price":"12500","priceCurrency":"ARS","availability":"https://schema.org/InStock"}}</script></head></html>'
  },
  '/sin-nombre': {
    status: 200,
    body: '<html><head><script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"900","priceCurrency":"ARS"}}</script></head></html>'
  }
};

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
  console.log('TEST SUITE: ALTA DE PRODUCTO (LINK, TIENDA, A MANO)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;
  const assert = (cond, name) => { if (cond) { console.log(`[PASS] ${name}`); passed++; } else { console.error(`[FAIL] ${name}`); failed++; } };

  const server = http.createServer((req, res) => {
    const page = PAGES[req.url.split('?')[0]];
    if (!page) { res.writeHead(404); return res.end('no'); }
    res.writeHead(page.status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page.body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const tenantId = crypto.randomUUID();
  await execute(
    `INSERT INTO tenant_tenants (id, name, slug, status) VALUES (?, 'Tenant Product Intake', ?, 'active') ON CONFLICT (id) DO NOTHING`,
    [tenantId, `tenant-intake-${tenantId.slice(0, 8)}`]
  );
  await setTenantModuleState(tenantId, '4see', true, 'superadmin@holospace.com');
  const user = { id: crypto.randomUUID(), email: 'admin@intake.com', role: 'ADMIN', permissions: ['4see:catalog:read', '4see:pricing:write'] };
  const ctx = { currentUser: user, tenantId, isSuperAdmin: false };
  const call = async (url, method, data, extra = {}) => {
    const res = createMockRes();
    await handle4seeApi({ url, method }, res, { ...ctx, ...extra, data });
    return res;
  };
  const count = async () => (await getOne('SELECT COUNT(*)::int AS n FROM fourseee_products WHERE tenant_id = ?', [tenantId], { tenantId })).n;

  try {
    console.log('\n--- 1. Leer un link no guarda nada y devuelve lo que encontro ---');
    let res = await call('/api/4see/products/read', 'POST', { url: `${base}/woo` });
    let reading = res.getBody().reading;
    assert(res.getStatusCode() === 200 && reading.ok, 'un link de WooCommerce real se lee');
    assert(reading.title === 'Jack Daniels N7 1 lt' && reading.price === 47200 && reading.currency === 'ARS', 'devuelve nombre, precio y moneda');
    assert(reading.sku === 'jack-daniels-n7-1-lt', 'devuelve el codigo (SKU) de la pagina');
    assert(reading.inStock === null, 'el stock queda desconocido cuando la pagina dice BackOrder (no se supone)');
    assert(await count() === 0, 'leer no crea ningun producto');

    console.log('\n--- 2. Un link que no se puede leer se informa con su motivo ---');
    res = await call('/api/4see/products/read', 'POST', { url: `${base}/bloqueado` });
    assert(res.getBody().reading.ok === false && res.getBody().reading.reason === 'BLOCKED_BY_SITE', 'HTTP 403: BLOCKED_BY_SITE');
    assert(!!res.getBody().reading.message, 'trae un mensaje para la persona');
    res = await call('/api/4see/products/read', 'POST', { url: `${base}/muro` });
    assert(res.getBody().reading.reason === 'BLOCKED_BY_SITE', 'el muro de inicio de sesion de Mercado Libre: BLOCKED_BY_SITE');
    res = await call('/api/4see/products/read', 'POST', { url: 'esto no es un link' });
    assert(res.getStatusCode() === 400, 'un texto que no es un link se rechaza con 400');
    process.env.HS_ALLOW_PRIVATE_FETCH = '0';
    res = await call('/api/4see/products/read', 'POST', { url: `${base}/woo` });
    assert(res.getBody().reading.reason === 'URL_NOT_ALLOWED', 'con la proteccion activa, una direccion interna no se lee');
    process.env.HS_ALLOW_PRIVATE_FETCH = '1';

    console.log('\n--- 3. Alta desde un link ---');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/woo` });
    let body = res.getBody();
    assert(res.getStatusCode() === 201, 'se crea el producto a partir del link');
    assert(body.product.title === 'Jack Daniels N7 1 lt' && parseFloat(body.product.current_price) === 47200, 'nombre y precio salen de la pagina');
    assert(body.sku.value === 'jack-daniels-n7-1-lt' && body.sku.generated === false, 'el SKU leido se usa y no se marca como generado');
    assert(body.source === 'LINK' && body.product.price_source === 'LINK' && body.product.own_url === `${base}/woo`, 'queda registrado que el precio sale del link');
    assert(body.product.in_analysis === false && body.product.costs_loaded === false, 'entra al catalogo sin analisis ni costos (se eligen en los pasos 2 y 3)');
    assert(await count() === 1, 'hay un producto');

    console.log('\n--- 4. El mismo link no se carga dos veces ---');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/woo` });
    assert(res.getStatusCode() === 409 && res.getBody().code === 'DUPLICATE_LINK', 'el link repetido se rechaza con 409');
    assert(await count() === 1, 'no se duplico');
    res = await call('/api/4see/products/read', 'POST', { url: `${base}/woo` });
    assert(res.getBody().existing && res.getBody().existing.title === 'Jack Daniels N7 1 lt', 'al leer, avisa que ese link ya esta cargado');

    console.log('\n--- 5. Sin codigo en la pagina: se genera y se avisa ---');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/sin-codigo` });
    body = res.getBody();
    assert(res.getStatusCode() === 201 && body.sku.generated === true && /^HS-[0-9A-F]{6}$/.test(body.sku.value), 'se genera un codigo HS-XXXXXX y se informa que fue generado');
    assert(body.product.sku === body.sku.value, 'el codigo informado es el que quedo guardado');

    console.log('\n--- 6. Un link que no se puede leer no guarda nada, ni siquiera con precio escrito ---');
    const before = await count();
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/bloqueado` });
    assert(res.getStatusCode() === 422 && res.getBody().code === 'READ_FAILED' && res.getBody().manualOnly === true, '422 READ_FAILED: la unica salida es cargar a mano');
    assert(res.getBody().reason === 'BLOCKED_BY_SITE' && !!res.getBody().error, 'informa el motivo y el mensaje');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/bloqueado`, current_price: 999, title: 'Con precio a mano' });
    assert(res.getStatusCode() === 422, 'aunque se mande un precio escrito, no cae en silencio a lo manual');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/muro` });
    assert(res.getStatusCode() === 422 && res.getBody().reason === 'BLOCKED_BY_SITE', 'el muro de Mercado Libre tampoco guarda');
    assert(await count() === before, 'no quedo ningun producto a medias');

    console.log('\n--- 7. Pagina sin nombre: hay que escribirlo ---');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/sin-nombre` });
    assert(res.getStatusCode() === 400 && res.getBody().code === 'TITLE_REQUIRED', 'sin nombre en la pagina ni escrito: TITLE_REQUIRED');
    res = await call('/api/4see/products', 'POST', { own_url: `${base}/sin-nombre`, title: '  Nombre   escrito  ' });
    assert(res.getStatusCode() === 201 && res.getBody().product.title === 'Nombre escrito', 'escrito por la persona se limpia y se guarda');

    console.log('\n--- 8. Alta a mano ---');
    res = await call('/api/4see/products', 'POST', { title: 'Producto a mano', current_price: '18.020,50' });
    body = res.getBody();
    assert(res.getStatusCode() === 201 && parseFloat(body.product.current_price) === 18020.5 && body.source === 'MANUAL', 'a mano: el precio escrito en formato argentino se guarda como numero');
    assert(body.sku.generated === true, 'a mano sin codigo: se genera y se avisa');
    res = await call('/api/4see/products', 'POST', { title: 'Sin precio' });
    assert(res.getStatusCode() === 422 && res.getBody().code === 'OWN_PRICE_UNKNOWN', 'a mano sin precio: se rechaza (no se inventa)');
    res = await call('/api/4see/products', 'POST', { current_price: 100 });
    assert(res.getStatusCode() === 400 && res.getBody().code === 'TITLE_REQUIRED', 'a mano sin nombre: se rechaza');
    res = await call('/api/4see/products', 'POST', { title: 'Con codigo propio', sku: 'MIO-1', current_price: 100 });
    assert(res.getStatusCode() === 201 && res.getBody().sku.value === 'MIO-1' && res.getBody().sku.generated === false, 'a mano con codigo propio: se respeta');
    res = await call('/api/4see/products', 'POST', { title: 'Otro con el mismo codigo', sku: 'MIO-1', current_price: 100 });
    assert(res.getStatusCode() === 409 && res.getBody().code === 'DUPLICATE_SKU', 'codigo repetido: 409');

    console.log('\n--- 9. Tienda conectada que no existe: no se guarda ---');
    const n = await count();
    res = await call('/api/4see/products', 'POST', { store_id: crypto.randomUUID(), store_external_id: '123' });
    assert(res.getStatusCode() === 422 && res.getBody().code === 'READ_FAILED' && res.getBody().manualOnly === true, 'tienda inexistente: 422 y salida a mano');
    assert(await count() === n, 'no se guardo nada');

    console.log('\n--- 10. Permisos ---');
    const reader = { currentUser: { ...user, permissions: ['4see:catalog:read'] } };
    res = await call('/api/4see/products/read', 'POST', { url: `${base}/woo` }, reader);
    assert(res.getStatusCode() === 403, 'sin permiso de escritura no se puede leer un link');
    res = await call('/api/4see/products', 'POST', { title: 'x', current_price: 1 }, reader);
    assert(res.getStatusCode() === 403, 'sin permiso de escritura no se puede crear');
  } catch (err) {
    console.error('Error inesperado:', err);
    failed++;
  }

  server.close();
  console.log('\n======================================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((e) => { console.error('ERROR FATAL EN SUITE:', e); process.exit(1); });
