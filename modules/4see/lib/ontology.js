/**
 * modules/4see/lib/ontology.js
 * Capa Ontológica Unificada de E-Commerce para HoloSpace (Módulo 4see)
 * Normaliza esquemas dispares de tiendas externas a un contrato canónico universal en memoria.
 */

const PlatformEnum = Object.freeze({
  TIENDANUBE: 'TIENDANUBE',
  WOOCOMMERCE: 'WOOCOMMERCE',
  SHOPIFY: 'SHOPIFY',
  MERCADOLIBRE: 'MERCADOLIBRE',
  CUSTOM: 'CUSTOM'
});

const AvailabilityStatusEnum = Object.freeze({
  IN_STOCK: 'IN_STOCK',
  AVAILABLE_FOR_RESERVATION: 'AVAILABLE_FOR_RESERVATION',
  OUT_OF_STOCK: 'OUT_OF_STOCK'
});

/**
 * Limpia y normaliza cadenas de texto eliminando etiquetas HTML y entidades codificadas.
 */
function stripHtml(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') return '';
  return htmlText
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza valores string o diccionarios multilingües (ej: {"es": "..."})
 */
function cleanStr(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const res = val.es || val.pt || val.en || Object.values(val)[0] || '';
    return typeof res === 'string' ? res.trim() : '';
  }
  const s = String(val).trim();
  return ['none', 'null', 'undefined'].includes(s.toLowerCase()) ? '' : s;
}

/**
 * Factory para crear una entidad StoreListing canónica.
 */
function createStoreListing(data = {}) {
  const unitPrice = parseFloat(data.unitPrice || data.price || 0) || 0;
  const regularPrice = parseFloat(data.regularPrice || unitPrice) || unitPrice;
  const stock = parseInt(data.stock !== undefined ? data.stock : 0, 10);
  
  let availability = data.availabilityStatus || AvailabilityStatusEnum.IN_STOCK;
  if (stock <= 0 && availability === AvailabilityStatusEnum.IN_STOCK) {
    availability = AvailabilityStatusEnum.OUT_OF_STOCK;
  }

  return {
    external_id: String(data.externalId || data.id || ''),
    platform: data.platform || PlatformEnum.CUSTOM,
    title: cleanStr(data.title || data.name || ''),
    description: stripHtml(data.description || ''),
    unit_price: unitPrice,
    regular_price: regularPrice,
    currency: (data.currency || 'ARS').toUpperCase(),
    stock,
    is_in_stock: availability === AvailabilityStatusEnum.IN_STOCK,
    availability_status: availability,
    sku: cleanStr(data.sku || ''),
    barcode_gtin: cleanStr(data.gtin || data.barcode || ''),
    brand: cleanStr(data.brand || ''),
    categories: Array.isArray(data.categories) ? data.categories.map(c => cleanStr(c)).filter(Boolean) : [],
    category_ids: Array.isArray(data.categoryIds) ? data.categoryIds.map(String) : [],
    image_urls: Array.isArray(data.imageUrls) ? data.imageUrls.filter(Boolean) : [],
    permalink: cleanStr(data.permalink || data.url || ''),
    seo_title: cleanStr(data.seoTitle || ''),
    seo_description: cleanStr(data.seoDescription || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(t => cleanStr(t)).filter(Boolean) : [],
    raw_attributes: data.rawAttributes || {}
  };
}

/**
 * Factory para crear una entidad StoreTaxonomy canónica.
 */
function createStoreTaxonomy(data = {}) {
  return {
    external_id: String(data.externalId || data.id || ''),
    platform: data.platform || PlatformEnum.CUSTOM,
    name: cleanStr(data.name || ''),
    slug: cleanStr(data.slug || ''),
    description: stripHtml(data.description || ''),
    parent_external_id: data.parentId ? String(data.parentId) : null,
    product_count: parseInt(data.productCount || 0, 10),
    meta_title: cleanStr(data.metaTitle || ''),
    meta_description: cleanStr(data.metaDescription || ''),
    google_shopping_category: cleanStr(data.googleShoppingCategory || '')
  };
}

module.exports = {
  PlatformEnum,
  AvailabilityStatusEnum,
  stripHtml,
  cleanStr,
  createStoreListing,
  createStoreTaxonomy
};
