const { TiendanubeConnector } = require('./connectors/tiendanube');
const { WooCommerceConnector } = require('./connectors/woocommerce');

/**
 * Arma el conector de una tienda guardada (fila de fourseee_connected_stores) o null si falta algo.
 */
function buildConnector(store) {
  if (!store) return null;
  const credentials = typeof store.credentials === 'string' ? JSON.parse(store.credentials) : (store.credentials || {});
  const platform = String(store.platform || '').toUpperCase();
  if (platform === 'TIENDANUBE') {
    return new TiendanubeConnector({
      accessToken: credentials.accessToken || credentials.access_token,
      userId: credentials.userId || credentials.user_id
    });
  }
  if (platform === 'WOOCOMMERCE') {
    return new WooCommerceConnector({
      storeUrl: credentials.storeUrl || credentials.store_url || store.store_url,
      consumerKey: credentials.consumerKey || credentials.consumer_key,
      consumerSecret: credentials.consumerSecret || credentials.consumer_secret
    });
  }
  return null;
}

module.exports = { buildConnector };
