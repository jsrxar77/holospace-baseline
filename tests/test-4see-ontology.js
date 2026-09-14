/**
 * tests/test-4see-ontology.js
 * Suite de Pruebas Automatizadas para la Capa Ontológica E-Commerce,
 * Conectores Multitienda (Tiendanube y WooCommerce) y Motor de Reglas OQL On-The-Fly.
 */

const { createStoreListing, PlatformEnum, AvailabilityStatusEnum } = require('../modules/4see/lib/ontology');
const { OQL_OPERATORS, auditListing, auditCatalogBatch, isCommerciallyActive, inferBrandFromTitle, generateSuggestedEan } = require('../modules/4see/lib/rules_engine');
const { TiendanubeConnector } = require('../modules/4see/lib/connectors/tiendanube');
const { WooCommerceConnector } = require('../modules/4see/lib/connectors/woocommerce');

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: CAPA ONTOLÓGICA & AUDITORÍA E-COMMERCE ON-THE-FLY (4SEE)');
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

  // 1. Normalización Ontológica Universal (StoreListing)
  console.log('\n--- 1. Normalización Ontológica Universal (StoreListing) ---');
  const tnRawMock = {
    id: 123456,
    name: { es: '  Ginebra Artesanal Botánica 750ml  ' },
    description: '<p>Destilada con <strong>botánicos premium</strong>.&nbsp;</p>',
    brand: 'London Spirit',
    variants: [
      { id: 987, price: '12500.50', stock: 15, sku: 'GIN-LON-750', barcode: '7791234567890' }
    ],
    categories: [{ id: 10, name: { es: 'Bebidas Espirituosas' } }],
    images: [{ src: 'https://cdn.tiendanube.com/img1.jpg' }],
    seo_title: { es: 'Ginebra Artesanal Premium' },
    seo_description: { es: 'Comprar ginebra artesanal botánica al mejor precio.' }
  };

  const tnConnector = new TiendanubeConnector({ accessToken: 'test_token', userId: '123' });
  const tnListing = tnConnector.mapProduct(tnRawMock);

  assert(tnListing.platform === PlatformEnum.TIENDANUBE, 'Plataforma normalizada como TIENDANUBE');
  assert(tnListing.external_id === '123456', 'external_id normalizado a string ("123456")');
  assert(tnListing.unit_price === 12500.50, 'Precio convertido a float numérico exacto (12500.50)');
  assert(tnListing.barcode_gtin === '7791234567890', 'Código GTIN / Barcode mapeado correctamente');
  assert(tnListing.description === 'Destilada con botánicos premium .', 'HTML depurado a texto plano');
  assert(tnListing.is_in_stock === true, 'Estado de stock en true');

  // 2. Normalización WooCommerce (Yoast / RankMath SEO)
  console.log('\n--- 2. Normalización WooCommerce & MetaDatos SEO ---');
  const wcRawMock = {
    id: 8841,
    name: 'Vino Tinto Reserva Malbec',
    price: '9400',
    regular_price: '11000',
    stock_quantity: 4,
    stock_status: 'instock',
    sku: 'VIN-RES-01',
    meta_data: [
      { key: '_yoast_wpseo_title', value: 'Vino Tinto Malbec Gran Reserva' },
      { key: '_yoast_wpseo_metadesc', value: 'Vino Malbec cosecha especial de bodega de altura.' },
      { key: '_barcode', value: '7798765432109' }
    ]
  };

  const wcConnector = new WooCommerceConnector({ storeUrl: 'https://tienda-demo.com', consumerKey: 'ck_123', consumerSecret: 'cs_456' });
  const wcListing = wcConnector.mapProduct(wcRawMock);

  assert(wcListing.platform === PlatformEnum.WOOCOMMERCE, 'Plataforma normalizada como WOOCOMMERCE');
  assert(wcListing.barcode_gtin === '7798765432109', 'Código GTIN extraído de meta_data de WooCommerce');
  assert(wcListing.seo_title === 'Vino Tinto Malbec Gran Reserva', 'Meta Título extraído de Yoast SEO');
  assert(wcListing.regular_price === 11000, 'Precio regular mapeado');

  // 3. Operadores OQL y Motor de Reglas
  console.log('\n--- 3. Operadores OQL & Motor de Reglas Determinístico ---');
  assert(OQL_OPERATORS.is_ean_format('7791234567890') === true, 'OQL valida EAN-13 numérico como válido');
  assert(OQL_OPERATORS.is_ean_format('12345') === false, 'OQL rechaza código con menos de 8 dígitos');
  assert(OQL_OPERATORS.is_ean_format('ABC-12345678') === false, 'OQL rechaza caracteres no numéricos en EAN');
  assert(OQL_OPERATORS.is_empty('') === true, 'OQL detecta string vacío');
  assert(OQL_OPERATORS.is_not_empty(['vino']) === true, 'OQL valida array no vacío');

  // 4. Auditoría Técnica de Producto Óptimo vs Producto con Discrepancias
  console.log('\n--- 4. Auditoría Técnica On-The-Fly (Sin DB) ---');
  const auditOptimized = auditListing(tnListing);
  assert(auditOptimized.status === 'OPTIMIZED', 'Producto completo catalogado como OPTIMIZED');
  assert(auditOptimized.diagnostics.length === 0, 'Producto óptimo tiene 0 diagnósticos de error');
  assert(auditOptimized.suggested_title.includes('LONDON SPIRIT'), 'Título sugerido incorpora marca en mayúsculas');

  const defectiveProduct = createStoreListing({
    externalId: '999',
    title: 'Ginebra', // Corto < 20 chars
    brand: '', // Sin marca
    gtin: '', // Sin GTIN
    price: 1500,
    stock: 5
  });
  const auditDefective = auditListing(defectiveProduct);
  assert(auditDefective.status === 'NEEDS_REVIEW', 'Producto incompleto catalogado como NEEDS_REVIEW');
  assert(auditDefective.has_critical_issues === true, 'Detecta problema crítico de GTIN ausente');
  const codes = auditDefective.diagnostics.map(d => d.code);
  assert(codes.includes('MISSING_GTIN'), 'Diagnóstico incluye MISSING_GTIN');
  assert(codes.includes('MISSING_BRAND'), 'Diagnóstico incluye MISSING_BRAND');
  assert(codes.includes('SHORT_TITLE'), 'Diagnóstico incluye SHORT_TITLE');

  // 5. Auditoría en Lote (Batch) en Memoria
  console.log('\n--- 5. Auditoría en Lote On-The-Fly (auditCatalogBatch) ---');
  const batchReport = auditCatalogBatch([tnListing, wcListing, defectiveProduct]);
  assert(batchReport.total_audited === 3, 'Total auditado en lote coincide (3)');
  assert(batchReport.needs_review_count >= 1, 'Registra productos pendientes de revisión');
  assert(batchReport.critical_issues_count >= 1, 'Registra conteo de problemas críticos');

  // 6. Filtro Comercial
  console.log('\n--- 6. Filtro Comercial (isCommerciallyActive) ---');
  const zeroPrice = createStoreListing({ externalId: '00', title: 'Muestra', price: 0, stock: 10 });
  const outOfStock = createStoreListing({ externalId: '01', title: 'Agotado', price: 1000, stock: 0 });
  assert(isCommerciallyActive(zeroPrice) === false, 'Producto con precio cero no es comercialmente activo');
  assert(isCommerciallyActive(outOfStock) === false, 'Producto agotado no es comercialmente activo');
  assert(isCommerciallyActive(tnListing) === true, 'Producto en stock con precio es activo');

  // 7. Asistente Interactivo de Atributos & Control Total del Usuario
  console.log('\n--- 7. Asistente Interactivo de Atributos & Inferencia ---');
  const inferred = inferBrandFromTitle('London Spirit Ginebra Botánica 750ml');
  assert(inferred === 'London', 'Infiere correctamente la marca a partir del título');

  const generatedEan = generateSuggestedEan('SKU-TEST-99');
  assert(generatedEan.length === 13, 'EAN interno generado tiene longitud exacta de 13 dígitos');
  assert(generatedEan.startsWith('200'), 'EAN interno utiliza prefijo reservado GS1 200');
  assert(/^[0-9]{13}$/.test(generatedEan), 'EAN interno cumple formato numérico estricto');

  // Simular edición y carga de atributos por parte del usuario sobre el producto defectuoso
  const correctedProduct = createStoreListing({
    externalId: defectiveProduct.external_id,
    sku: defectiveProduct.sku,
    title: 'Vino Malbec Roble 750ml Cosecha Especial', // Título largo cargado por usuario
    brand: 'Trapiche', // Marca cargada manualmente por el usuario
    gtin: generatedEan, // GTIN asignado por el usuario
    seoTitle: 'Vino Malbec Roble 750ml Cosecha Especial',
    seoDescription: 'Vino Malbec Roble de cosecha especial en botella de 750ml.',
    price: 1500,
    stock: 5
  });

  const auditCorrected = auditListing(correctedProduct);
  assert(auditCorrected.status === 'OPTIMIZED', 'Producto corregido por el usuario pasa a estado OPTIMIZED');
  assert(auditCorrected.has_critical_issues === false, 'Desaparecen los problemas críticos de GTIN');
  const correctedCodes = auditCorrected.diagnostics.map(d => d.code);
  assert(!correctedCodes.includes('MISSING_GTIN'), 'Diagnóstico ya NO incluye MISSING_GTIN');
  assert(!correctedCodes.includes('MISSING_BRAND'), 'Diagnóstico ya NO incluye MISSING_BRAND');
  assert(!correctedCodes.includes('SHORT_TITLE'), 'Diagnóstico ya NO incluye SHORT_TITLE');

  console.log('======================================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Error fatal ejecutando test:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
