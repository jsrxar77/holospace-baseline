/**
 * 4see: lectura de precios sin datos inventados (modules/4see/lib/price.js, extractor.js, own_price.js).
 * Sin red ni base de datos: fetchHtml/fetchJson y la tienda se inyectan como dependencias.
 */
const fs = require('fs');
const path = require('path');
const { parsePrice, scaleWarning } = require('../modules/4see/lib/price');
const { extractProductData, describeReadFailure } = require('../modules/4see/lib/extractor');
const { resolveOwnPrice } = require('../modules/4see/lib/own_price');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };

console.log('Formatos de precio argentinos y comunes (sin inventar escala)');
const cases = [
  ['$ 185.240,00', 185240], ['185.240,00', 185240], ['18.020', 18020], ['18020', 18020],
  ['18020.00', 18020], ['18.020,5', 18020.5], ['$18.620', 18620], ['1.234.567', 1234567],
  ['1,234.56', 1234.56], ['18,5', 18.5], ['0,99', 0.99], ['ARS 99.999,99', 99999.99],
  ['12.5', 12.5], ['$ 1.299', 1299], [185240, 185240]
];
for (const [input, expected] of cases) ok(parsePrice(input) === expected, `parsePrice(${JSON.stringify(input)}) === ${expected}`);

console.log('Nunca un precio inventado');
for (const bad of ['', 'gratis', '0', '0,00', null, undefined, 0, -5, 'NaN', '   ']) {
  ok(parsePrice(bad) === null, `parsePrice(${JSON.stringify(bad)}) === null (no se inventa)`);
}

console.log('Aviso cuando el precio leido esta fuera de escala');
ok(scaleWarning(18620, 165200) !== null, 'detecta 18.620 contra 165.200 (el bug reportado)');
ok(scaleWarning(165000, 165200) === null, 'no avisa cuando los precios son comparables');
ok(scaleWarning(null, 100) === null, 'sin aviso si falta un dato');

console.log('Lectura de pagina (JSON-LD, microdatos, meta tags) sin red');
const jsonLdHtml = `<script type="application/ld+json">{"@type":"Product","name":"Moet Ice 750 ml","offers":{"@type":"Offer","price":"185.240,00","priceCurrency":"ARS","availability":"https://schema.org/InStock"}}</script>`;
(async () => {
  let r = await extractProductData('https://tienda.example.com/p/moet-ice', { fetchHtml: async () => jsonLdHtml });
  ok(r.ok && r.price === 185240 && r.inStock === true && r.method === 'JSON_LD', 'JSON-LD: 185.240,00 -> 185240 (no 18.240 ni 18,02)');

  const outOfStockHtml = `<script type="application/ld+json">{"@type":"Product","offers":{"price":"18.020","priceCurrency":"ARS","availability":"https://schema.org/OutOfStock"}}</script>`;
  r = await extractProductData('https://tienda.example.com/p/x', { fetchHtml: async () => outOfStockHtml });
  ok(r.ok && r.price === 18020 && r.inStock === false, 'JSON-LD: sin stock real, no se supone "con stock"');

  const microdataHtml = `<span itemprop="price" content="99.990,50"></span><link itemprop="availability" href="https://schema.org/InStock">`;
  r = await extractProductData('https://tienda.example.com/p/y', { fetchHtml: async () => microdataHtml });
  ok(r.ok && r.price === 99990.5 && r.method === 'MICRODATA', 'microdatos: lee precio y disponibilidad');

  const metaHtml = `<meta property="og:price:amount" content="42.500,00"><meta property="og:price:currency" content="ARS">`;
  r = await extractProductData('https://tienda.example.com/p/z', { fetchHtml: async () => metaHtml });
  ok(r.ok && r.price === 42500 && r.method === 'META_TAGS', 'meta tags: og:price:amount');

  console.log('Caso real: producto envuelto en WebPage/mainEntity junto a productos relacionados ajenos');
  // Capturado de una tienda real (Tiendanube) que puso en la misma pagina el producto pedido, como
  // WebPage > mainEntity > Product ($185.240), y mas abajo un Product suelto de otro articulo
  // relacionado ($18.620). El bug real: se leia el ajeno porque no se buscaba dentro de mainEntity
  // y se tomaba "el primer Product que aparece" sin confirmar que fuera el de la URL pedida.
  const rivalFixtureHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'rival-mainentity-con-productos-relacionados.html'), 'utf8');
  const theProductUrl = 'https://www.positanovinos.com.ar/productos/moet-chandon-ice-imperial-rose-x-750-1bs8b/?variant=1521739908&pf=mc';
  r = await extractProductData(theProductUrl, { fetchHtml: async () => rivalFixtureHtml });
  ok(r.ok && r.price === 185240, `WebPage con mainEntity: lee el producto pedido ($185.240), no uno relacionado (leyo ${r.price})`);
  ok(r.inStock === true, 'toma el stock del producto correcto, no el del relacionado');

  const relatedProductUrl = 'https://www.positanovinos.com.ar/productos/chandon-delice-rose-x-750-cc/';
  r = await extractProductData(relatedProductUrl, { fetchHtml: async () => rivalFixtureHtml });
  ok(r.ok && r.price === 18620, 'la misma pagina, pedida con la URL del producto relacionado, trae su propio precio');

  const unknownProductUrl = 'https://www.positanovinos.com.ar/productos/otro-producto-no-listado/';
  r = await extractProductData(unknownProductUrl, { fetchHtml: async () => rivalFixtureHtml });
  ok(!r.ok && r.reason === 'AMBIGUOUS_PRODUCT_DATA', 'si ninguno de los productos de la pagina coincide con la URL pedida, no se adivina');
  ok(describeReadFailure(r.reason).length > 10, 'motivo de ambiguedad explicado en lenguaje de negocio');

  console.log('Nunca precio 0 ni "con stock" supuesto cuando no se pudo leer');
  r = await extractProductData('https://tienda.example.com/p/sin-precio', { fetchHtml: async () => '<html><body>Sin datos</body></html>' });
  ok(!r.ok && r.price === null && r.inStock === null, 'pagina sin datos estructurados: no se pudo leer, no hay 0 ni stock supuesto');
  ok(typeof describeReadFailure(r.reason) === 'string' && describeReadFailure(r.reason).length > 10, 'motivo explicado en lenguaje de negocio');

  r = await extractProductData('https://tienda.example.com/p/app', { fetchHtml: async () => '<html><body><div id="root"></div></body></html>' });
  ok(!r.ok && r.reason === 'MAYBE_JS_RENDERED', 'pagina armada con JavaScript: se reconoce y no se inventa un precio');

  r = await extractProductData('no-es-una-url');
  ok(!r.ok && r.reason === 'INVALID_URL', 'link invalido: rechazado antes de salir a la red');

  r = await extractProductData('https://tienda.example.com/p/caida', { fetchHtml: async () => { throw new Error('ECONNRESET'); } });
  ok(!r.ok && r.reason === 'FETCH_FAILED', 'la pagina no respondio: no se inventa un precio');

  console.log('Mercado Libre: usa la API, no HTML');
  r = await extractProductData('https://articulo.mercadolibre.com.ar/MLA-123456789-x', {
    fetchJson: async () => ({ price: 18620.5, currency_id: 'ARS', available_quantity: 3, title: 'Producto ML', status: 'active' })
  });
  ok(r.ok && r.price === 18620.5 && r.inStock === true && r.method === 'MERCADOLIBRE_API', 'lee precio real de la API de Mercado Libre');

  console.log('Tu precio: orden tienda conectada -> tu link -> valor a mano');
  let mine = await resolveOwnPrice(
    { storeId: 's1', externalId: 'p1', ownUrl: 'https://mitienda.com/mi-producto', manualPrice: 999 },
    {
      getStore: async () => ({ id: 's1', platform: 'TIENDANUBE', credentials: {} }),
      buildConnector: () => ({ fetchProduct: async () => ({ unit_price: 165200, title: 'Mi producto', sku: 'X1', is_in_stock: true }) })
    }
  );
  ok(mine.ok && mine.price === 165200 && mine.source === 'STORE', 'si el producto esta definido en la tienda, toma el precio de la tienda');

  mine = await resolveOwnPrice(
    { ownUrl: 'https://mitienda.com/mi-producto', manualPrice: 999 },
    { extract: async () => ({ ok: true, price: 165200, inStock: true, method: 'JSON_LD' }) }
  );
  ok(mine.ok && mine.price === 165200 && mine.source === 'LINK', 'sin tienda conectada, lee el link de tu producto');

  mine = await resolveOwnPrice({ manualPrice: '165.200,00' }, {});
  ok(mine.ok && mine.price === 165200 && mine.source === 'MANUAL', 'sin tienda ni link, usa el valor que cargaste');

  mine = await resolveOwnPrice({ manualPrice: '18.020', manualLocked: true, ownUrl: 'https://mitienda.com/x' }, {
    extract: async () => { throw new Error('no deberia llamarse'); }
  });
  ok(mine.ok && mine.price === 18020 && mine.source === 'MANUAL', 'precio corregido a mano (locked) no se vuelve a pisar con la lectura');

  mine = await resolveOwnPrice({}, {});
  ok(!mine.ok && mine.price === null && typeof mine.reason === 'string', 'sin ninguna fuente: no se inventa un precio propio');

  mine = await resolveOwnPrice({ storeId: 's1', externalId: 'p1', manualPrice: 500 }, {
    getStore: async () => null,
    buildConnector: () => null
  });
  ok(mine.ok && mine.price === 500 && mine.source === 'MANUAL', 'si la tienda ya no esta conectada, cae al valor a mano sin romper');

  console.log('Integridad del esquema: columnas nuevas no inventan valores por defecto');
  const schema = require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'init-schema.sql'), 'utf8');
  const productsBlock = (schema.match(/CREATE TABLE IF NOT EXISTS fourseee_products \([\s\S]*?\);/) || [''])[0];
  ok(/\n  current_price NUMERIC\(14, 2\),\n/.test(productsBlock), 'el precio actual del producto admite NULL (no 0 por defecto)');
  ok(/competitor_price NUMERIC\(12, 2\),/.test(schema), 'competitor_price admite NULL (no 0 por defecto)');
  ok(schema.includes('competitor_read_error'), 'se guarda por que no se pudo leer el rival');
  ok(schema.includes('fourseee_competitor_monitors') && /product_id UUID REFERENCES fourseee_products\(id\)/.test(schema), 'un producto del catalogo puede tener varios rivales');

  if (failed) { console.error(`\n${failed} verificaciones fallaron`); process.exit(1); }
  console.log('\nLectura de precios OK');
})();
