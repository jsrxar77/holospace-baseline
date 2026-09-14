/**
 * modules/4see/lib/rules_engine.js
 * Motor de Reglas OQL (Ontology Query Language) determinístico en memoria.
 * Evalúa calidad técnica de listings sin persistencia de base de datos ni modelos de IA.
 */

const { stripHtml, cleanStr } = require('./ontology');

/**
 * Operadores OQL determinísticos
 */
const OQL_OPERATORS = {
  is_ean_format: (val) => Boolean(val && /^[0-9]{8,14}$/.test(String(val).trim())),
  is_not_ean_format: (val) => !val || !/^[0-9]{8,14}$/.test(String(val).trim()),
  is_empty: (val) => val === null || val === undefined || String(val).trim() === '' || (Array.isArray(val) && val.length === 0),
  is_not_empty: (val) => val !== null && val !== undefined && String(val).trim() !== '' && (!Array.isArray(val) || val.length > 0),
  equals: (val, target) => String(val).toLowerCase() === String(target).toLowerCase(),
  not_equals: (val, target) => String(val).toLowerCase() !== String(target).toLowerCase(),
  greater_than: (val, target) => parseFloat(val) > parseFloat(target),
  less_than: (val, target) => parseFloat(val) < parseFloat(target),
  contains: (val, target) => String(val || '').toLowerCase().includes(String(target || '').toLowerCase()),
  regex_match: (val, pattern) => {
    try {
      return new RegExp(pattern).test(String(val || ''));
    } catch {
      return false;
    }
  }
};

/**
 * Evalúa una condición individual sobre una entidad
 */
function evaluateCondition(entity, condition) {
  const { field, operator, value } = condition;
  const entityValue = entity[field];
  const opFn = OQL_OPERATORS[operator];
  if (!opFn) return true;
  return opFn(entityValue, value);
}

/**
 * Evalúa un conjunto de reglas (AST OQL simplificado)
 */
function evaluateQuery(entity, queryDef) {
  if (!queryDef || !Array.isArray(queryDef.rules)) return true;
  const combinator = (queryDef.combinator || 'AND').toUpperCase();
  if (combinator === 'OR') {
    return queryDef.rules.some(r => evaluateCondition(entity, r));
  }
  return queryDef.rules.every(r => evaluateCondition(entity, r));
}

/**
 * Filtro comercial: determina si un producto es apto para análisis activo
 */
function isCommerciallyActive(listing) {
  if (!listing) return false;
  if (listing.unit_price <= 0) return false;
  if (listing.availability_status === 'OUT_OF_STOCK') return false;
  return true;
}

/**
 * Ejecuta la batería de auditoría técnica sobre un StoreListing canónico.
 * Genera diagnósticos con severidad y título sugerido determinístico.
 */
function auditListing(listing) {
  const diagnostics = [];
  const gtin = cleanStr(listing.barcode_gtin);
  const brand = cleanStr(listing.brand);
  const title = cleanStr(listing.title);
  const seoTitle = cleanStr(listing.seo_title);
  const seoDesc = cleanStr(listing.seo_description);

  // 1. Validación GTIN / EAN
  if (!OQL_OPERATORS.is_ean_format(gtin)) {
    diagnostics.push({
      code: 'MISSING_GTIN',
      severity: 'HIGH',
      field: 'barcode_gtin',
      message: 'Falta código GTIN / EAN-13 válido (8-14 dígitos). Riesgo de rechazo en Google Shopping y marketplaces.'
    });
  }

  // 2. Validación Marca
  if (!brand) {
    diagnostics.push({
      code: 'MISSING_BRAND',
      severity: 'MEDIUM',
      field: 'brand',
      message: 'Falta especificar la marca del producto para indexación y filtros por faceta.'
    });
  }

  // 3. Longitud de Título
  if (title.length < 20) {
    diagnostics.push({
      code: 'SHORT_TITLE',
      severity: 'LOW',
      field: 'title',
      message: 'Título demasiado breve (< 20 caracteres) para intención de búsqueda comercial.'
    });
  }

  // 4. Meta Título SEO
  if (!seoTitle) {
    diagnostics.push({
      code: 'MISSING_SEO_TITLE',
      severity: 'LOW',
      field: 'seo_title',
      message: 'No posee meta título SEO configurado.'
    });
  }

  // 5. Meta Descripción SEO
  if (!seoDesc) {
    diagnostics.push({
      code: 'MISSING_SEO_DESC',
      severity: 'LOW',
      field: 'seo_description',
      message: 'No posee meta descripción SEO (afecta CTR en motores de búsqueda).'
    });
  }

  // Generación determinística de título sugerido
  const brandPrefix = brand ? `${brand.toUpperCase()} ` : '';
  const cleanTitleCore = title ? title.trim() : 'Producto';
  const suggestedTitle = `${brandPrefix}${cleanTitleCore} [Envio Inmediato - Stock Oficial]`;

  const status = diagnostics.length === 0 ? 'OPTIMIZED' : 'NEEDS_REVIEW';

  return {
    listing_id: listing.external_id,
    sku: listing.sku,
    platform: listing.platform,
    original_title: title,
    suggested_title: suggestedTitle,
    status,
    diagnostics,
    has_critical_issues: diagnostics.some(d => d.severity === 'HIGH'),
    is_commercially_active: isCommerciallyActive(listing)
  };
}

/**
 * Audita una lista completa de StoreListings "on the fly".
 */
function auditCatalogBatch(listings = []) {
  const auditedItems = [];
  let optimizedCount = 0;
  let needsReviewCount = 0;
  let criticalCount = 0;

  for (const item of listings) {
    const auditRes = auditListing(item);
    if (auditRes.status === 'OPTIMIZED') optimizedCount++;
    else needsReviewCount++;
    if (auditRes.has_critical_issues) criticalCount++;
    auditedItems.push({
      ...item,
      audit: auditRes
    });
  }

  return {
    total_audited: listings.length,
    optimized_count: optimizedCount,
    needs_review_count: needsReviewCount,
    critical_issues_count: criticalCount,
    items: auditedItems
  };
}

module.exports = {
  OQL_OPERATORS,
  evaluateCondition,
  evaluateQuery,
  isCommerciallyActive,
  auditListing,
  auditCatalogBatch
};
