const { extractProductData, describeReadFailure } = require('./extractor');
const { parsePrice } = require('./price');
const { buildConnector } = require('./store_connector');

/**
 * Precio propio de un producto, con este orden de prioridad:
 *   1. Tienda conectada (si el producto esta definido ahi): toma las actualizaciones de la tienda.
 *   2. Link de tu producto (se lee la pagina publica).
 *   3. El valor que cargaste a mano.
 * Si ninguna fuente da un precio valido devuelve { ok: false, price: null } y el motivo; nunca inventa un valor.
 *
 * deps (inyectables para pruebas): getStore(storeId) -> fila de tienda | null, extract(url) -> lectura.
 */
async function resolveOwnPrice({ storeId, externalId, ownUrl, manualPrice, manualLocked = false } = {}, deps = {}) {
  const extract = deps.extract || extractProductData;
  const attempts = [];

  // Un precio corregido a mano por el usuario se respeta hasta que pida volver a leerlo
  if (manualLocked) {
    const manual = parsePrice(manualPrice);
    if (manual) return { ok: true, price: manual, source: 'MANUAL', inStock: null, attempts };
  }

  if (storeId && externalId && deps.getStore) {
    try {
      const store = await deps.getStore(storeId);
      const connector = (deps.buildConnector || buildConnector)(store);
      if (!store || !connector) throw new Error('La tienda ya no está conectada.');
      const listing = await connector.fetchProduct(externalId);
      const price = parsePrice(listing && listing.unit_price);
      if (price) {
        return {
          ok: true, price, source: 'STORE', title: listing.title || null, sku: listing.sku || null,
          inStock: listing.is_in_stock, stock: Number.isFinite(listing.stock) ? listing.stock : null, attempts
        };
      }
      attempts.push({ source: 'STORE', reason: 'Tu tienda no informa un precio para este producto.' });
    } catch (e) {
      attempts.push({ source: 'STORE', reason: `No pudimos leer tu tienda conectada (${e.message}).` });
    }
  }

  if (ownUrl) {
    const read = await extract(ownUrl);
    if (read && read.ok && read.price) {
      return { ok: true, price: read.price, source: 'LINK', title: read.title || null, inStock: read.inStock, method: read.method, attempts };
    }
    attempts.push({ source: 'LINK', reason: describeReadFailure(read && read.reason) });
  }

  const manual = parsePrice(manualPrice);
  if (manual) return { ok: true, price: manual, source: 'MANUAL', inStock: null, attempts };

  return { ok: false, price: null, source: null, inStock: null, attempts, reason: attempts.length ? attempts[attempts.length - 1].reason : 'Cargá tu precio, o el link de tu producto, o elegilo de tu tienda conectada.' };
}

/** Busca productos en una tienda conectada para elegir cual es el tuyo. */
async function searchStoreProducts(store, text, deps = {}) {
  const connector = (deps.buildConnector || buildConnector)(store);
  if (!connector) throw new Error('No pudimos conectarnos a esa tienda.');
  const platform = String(store.platform || '').toUpperCase();
  const listings = platform === 'TIENDANUBE'
    ? await connector.fetchProducts({ limit: 20, query: text || '' })
    : await connector.fetchProducts({ limit: 20, search: text || '' });
  return listings.map((l) => ({
    externalId: l.external_id, title: l.title, sku: l.sku, price: l.unit_price > 0 ? l.unit_price : null,
    inStock: l.is_in_stock
  }));
}

module.exports = { resolveOwnPrice, searchStoreProducts };
