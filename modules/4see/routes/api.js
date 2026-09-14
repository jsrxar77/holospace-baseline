const crypto = require('crypto');
const { query, execute, getOne } = require('../../../lib/db');
const { extractProductData } = require('../lib/extractor');
const { calculateMarginMetrics } = require('../lib/margins');
const { checkTenantModuleAccess } = require('../../../lib/entitlement');
const { hasPermission, sendPermissionError } = require('../../../lib/rbac');
const { createStoreListing } = require('../lib/ontology');
const { auditListing, auditCatalogBatch } = require('../lib/rules_engine');
const { TiendanubeConnector } = require('../lib/connectors/tiendanube');
const { WooCommerceConnector } = require('../lib/connectors/woocommerce');

let isStoreTableReady = false;
async function ensureConnectedStoresTable() {
  if (isStoreTableReady) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_connected_stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        store_url TEXT NOT NULL,
        credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_scanned_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fourseee_stores_tenant ON fourseee_connected_stores(tenant_id);
      ALTER TABLE fourseee_connected_stores ENABLE ROW LEVEL SECURITY;
    `, []);
    isStoreTableReady = true;
  } catch (err) {
    isStoreTableReady = true;
  }
}

function maskCredentialValue(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= 8) return '••••••••';
  return str.slice(0, 4) + '••••' + str.slice(-4);
}

function maskStoreCredentials(creds = {}) {
  const masked = { ...creds };
  if (masked.consumer_secret) masked.consumer_secret = maskCredentialValue(masked.consumer_secret);
  if (masked.consumerSecret) masked.consumerSecret = maskCredentialValue(masked.consumerSecret);
  if (masked.access_token) masked.access_token = maskCredentialValue(masked.access_token);
  if (masked.accessToken) masked.accessToken = maskCredentialValue(masked.accessToken);
  if (masked.consumer_key) masked.consumer_key = maskCredentialValue(masked.consumer_key);
  if (masked.consumerKey) masked.consumerKey = maskCredentialValue(masked.consumerKey);
  return masked;
}

/**
 * Handler principal para todas las peticiones bajo /api/4see/*
 */
async function handle4seeApi(req, res, { currentUser, tenantId, data, isSuperAdmin }) {
  await ensureConnectedStoresTable();
  const url = req.url;
  const pathPart = url.split('?')[0];

  // Verificar entitlement del tenant para '4see'
  if (!isSuperAdmin) {
    const hasAccess = await checkTenantModuleAccess(tenantId, '4see');
    if (!hasAccess) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: "El modulo '4see' no esta contratado en la suscripcion activa de tu organizacion.",
        code: 'MODULE_NOT_ENTITLED',
        requiredModule: '4see'
      }));
      return true;
    }
  }

  // 1. MONITOR DE COMPETIDORES
  if (pathPart === '/api/4see/monitors' && req.method === 'GET') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:read')) {
      sendPermissionError(res, '4see:catalog:read');
      return true;
    }
    const monitors = await query(
      isSuperAdmin 
        ? 'SELECT * FROM fourseee_competitor_monitors ORDER BY created_at DESC'
        : 'SELECT * FROM fourseee_competitor_monitors WHERE tenant_id = ? ORDER BY created_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, monitors }));
    return true;
  }

  if (pathPart === '/api/4see/monitors' && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:pricing:write')) {
      sendPermissionError(res, '4see:pricing:write');
      return true;
    }
    const { productName, competitorUrl, competitorName, myPrice } = data || {};
    if (!productName || !competitorUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Nombre de producto y URL son obligatorios.' }));
      return true;
    }

    const id = crypto.randomUUID();
    const extracted = await extractProductData(competitorUrl);

    await execute(
      `INSERT INTO fourseee_competitor_monitors 
       (id, tenant_id, product_name, competitor_url, competitor_name, my_price, competitor_price, competitor_stock, last_checked_at, extraction_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        id, 
        tenantId, 
        productName.trim(), 
        competitorUrl.trim(), 
        competitorName ? competitorName.trim() : (extracted.store || 'Competidor'),
        parseFloat(myPrice) || 0,
        extracted.price || 0,
        extracted.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
        extracted.method || 'STRUCTURED_DATA'
      ],
      { tenantId }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, id, extracted }));
    return true;
  }

  if (pathPart.startsWith('/api/4see/monitors/') && pathPart.endsWith('/check') && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:pricing:write')) {
      sendPermissionError(res, '4see:pricing:write');
      return true;
    }
    const monitorId = pathPart.replace('/api/4see/monitors/', '').replace('/check', '');
    const monitor = await getOne(
      'SELECT * FROM fourseee_competitor_monitors WHERE id = ?',
      [monitorId],
      { tenantId, isSuperAdmin }
    );

    if (!monitor) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Monitor no encontrado.' }));
      return true;
    }

    const extracted = await extractProductData(monitor.competitor_url);
    await execute(
      `UPDATE fourseee_competitor_monitors 
       SET competitor_price = ?, competitor_stock = ?, last_checked_at = CURRENT_TIMESTAMP, extraction_method = ?
       WHERE id = ? AND tenant_id = ?`,
      [extracted.price || 0, extracted.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK', extracted.method || 'STRUCTURED_DATA', monitor.id, monitor.tenant_id],
      { tenantId: monitor.tenant_id }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, monitorId: monitor.id, extracted }));
    return true;
  }

  if (pathPart.startsWith('/api/4see/monitors/') && req.method === 'DELETE') {
    if (!hasPermission(currentUser?.permissions, '4see:pricing:write')) {
      sendPermissionError(res, '4see:pricing:write');
      return true;
    }
    const monitorId = pathPart.replace('/api/4see/monitors/', '');
    await execute('DELETE FROM fourseee_competitor_monitors WHERE id = ? AND tenant_id = ?', [monitorId, tenantId], { tenantId });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  // 2. AUDITORÍA DE CATÁLOGO & DIFF VIEW
  if (pathPart === '/api/4see/catalog' && req.method === 'GET') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:read')) {
      sendPermissionError(res, '4see:catalog:read');
      return true;
    }
    const items = await query(
      isSuperAdmin
        ? 'SELECT * FROM fourseee_catalog_items ORDER BY updated_at DESC'
        : 'SELECT * FROM fourseee_catalog_items WHERE tenant_id = ? ORDER BY updated_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items }));
    return true;
  }

  if ((pathPart === '/api/4see/catalog' || pathPart === '/api/4see/catalog/audit') && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:audit')) {
      sendPermissionError(res, '4see:catalog:audit');
      return true;
    }
    const { sku, title, gtin, brand, category } = data || {};
    if (!sku || !title) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'SKU y Titulo son requeridos.' }));
      return true;
    }

    const id = crypto.randomUUID();
    const diagnostics = [];
    if (!gtin || gtin.length < 8) {
      diagnostics.push({ code: 'MISSING_GTIN', severity: 'HIGH', message: 'Falta codigo GTIN / EAN-13 valido (riesgo de suspension en Google Shopping).' });
    }
    if (!brand || brand.trim().length === 0) {
      diagnostics.push({ code: 'MISSING_BRAND', severity: 'MEDIUM', message: 'Falta especificar marca del producto.' });
    }
    if (title.length < 20) {
      diagnostics.push({ code: 'SHORT_TITLE', severity: 'LOW', message: 'Titulo demasiado breve para intencion de busqueda comercial.' });
    }

    const suggestedTitle = `${brand ? brand.toUpperCase() + ' ' : ''}${title.trim()} [Envio Inmediato - Stock Oficial]`;
    const status = diagnostics.length === 0 ? 'OPTIMIZED' : 'NEEDS_REVIEW';

    await execute(
      `INSERT INTO fourseee_catalog_items
       (id, tenant_id, sku, original_title, current_title, gtin, brand, category, status, diagnostics, suggested_title, is_approved, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, CURRENT_TIMESTAMP)`,
      [
        id,
        tenantId,
        sku.trim(),
        title.trim(),
        title.trim(),
        gtin ? gtin.trim() : null,
        brand ? brand.trim() : null,
        category ? category.trim() : null,
        status,
        JSON.stringify(diagnostics),
        suggestedTitle
      ],
      { tenantId }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, id, status, diagnostics, suggestedTitle }));
    return true;
  }

  if (pathPart.startsWith('/api/4see/catalog/') && pathPart.endsWith('/approve') && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:audit')) {
      sendPermissionError(res, '4see:catalog:audit');
      return true;
    }
    const itemId = pathPart.replace('/api/4see/catalog/', '').replace('/approve', '');
    const item = await getOne('SELECT * FROM fourseee_catalog_items WHERE id = ? AND tenant_id = ?', [itemId, tenantId], { tenantId });
    if (!item) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Item de catalogo no encontrado.' }));
      return true;
    }

    await execute(
      `UPDATE fourseee_catalog_items
       SET current_title = suggested_title, is_approved = true, status = 'OPTIMIZED', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [item.id, tenantId],
      { tenantId }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, approvedTitle: item.suggested_title }));
    return true;
  }

  // 2.0 TIENDAS CONECTADAS PERSISTENTES (MULTI-STORE MANAGEMENT)
  if (pathPart === '/api/4see/stores' && req.method === 'GET') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:read')) {
      sendPermissionError(res, '4see:catalog:read');
      return true;
    }

    const stores = await query(
      isSuperAdmin
        ? 'SELECT * FROM fourseee_connected_stores WHERE is_active = true ORDER BY created_at DESC'
        : 'SELECT * FROM fourseee_connected_stores WHERE tenant_id = ? AND is_active = true ORDER BY created_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );

    const safeStores = stores.map(st => {
      const creds = typeof st.credentials === 'string' ? JSON.parse(st.credentials) : (st.credentials || {});
      return {
        id: st.id,
        tenant_id: st.tenant_id,
        name: st.name,
        platform: st.platform,
        store_url: st.store_url,
        is_active: st.is_active,
        last_scanned_at: st.last_scanned_at,
        created_at: st.created_at,
        updated_at: st.updated_at,
        credentials: maskStoreCredentials(creds)
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stores: safeStores }));
    return true;
  }

  if (pathPart === '/api/4see/stores' && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:pricing:write') && !hasPermission(currentUser?.permissions, '4see:catalog:audit')) {
      sendPermissionError(res, '4see:catalog:audit');
      return true;
    }

    const { id: storeId, name, platform, store_url, credentials = {}, is_active = true } = data || {};
    if (!name || !platform || !store_url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Nombre, plataforma y URL de la tienda son obligatorios.' }));
      return true;
    }

    const cleanPlatform = String(platform).toUpperCase().trim();
    const cleanName = String(name).trim();
    const cleanUrl = String(store_url).trim();

    if (storeId) {
      const existing = await getOne(
        'SELECT * FROM fourseee_connected_stores WHERE id = ?',
        [storeId],
        { tenantId, isSuperAdmin }
      );
      if (!existing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Tienda conectada no encontrada.' }));
        return true;
      }

      const prevCreds = typeof existing.credentials === 'string' ? JSON.parse(existing.credentials) : (existing.credentials || {});
      const mergedCreds = { ...prevCreds };
      for (const [k, v] of Object.entries(credentials)) {
        if (v && typeof v === 'string' && !v.includes('••••')) {
          mergedCreds[k] = v.trim();
        }
      }

      await execute(
        `UPDATE fourseee_connected_stores
         SET name = ?, platform = ?, store_url = ?, credentials = ?::jsonb, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [cleanName, cleanPlatform, cleanUrl, JSON.stringify(mergedCreds), is_active, storeId, existing.tenant_id],
        { tenantId }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        store: {
          id: storeId,
          name: cleanName,
          platform: cleanPlatform,
          store_url: cleanUrl,
          credentials: maskStoreCredentials(mergedCreds)
        }
      }));
      return true;
    } else {
      const newId = crypto.randomUUID();
      await execute(
        `INSERT INTO fourseee_connected_stores
         (id, tenant_id, name, platform, store_url, credentials, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [newId, tenantId, cleanName, cleanPlatform, cleanUrl, JSON.stringify(credentials)],
        { tenantId }
      );

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        store: {
          id: newId,
          name: cleanName,
          platform: cleanPlatform,
          store_url: cleanUrl,
          credentials: maskStoreCredentials(credentials)
        }
      }));
      return true;
    }
  }

  if (pathPart.startsWith('/api/4see/stores/') && req.method === 'DELETE') {
    if (!hasPermission(currentUser?.permissions, '4see:pricing:write') && !hasPermission(currentUser?.permissions, '4see:catalog:audit')) {
      sendPermissionError(res, '4see:catalog:audit');
      return true;
    }

    const storeId = pathPart.replace('/api/4see/stores/', '').trim();
    await execute(
      'UPDATE fourseee_connected_stores SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
      [storeId, tenantId],
      { tenantId }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Tienda desconectada exitosamente.' }));
    return true;
  }

  // 2.1 AUDITORÍA ON-THE-FLY & CONECTORES MULTITIENDA (CERO PERSISTENCIA)
  if (pathPart === '/api/4see/store/audit-live' && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:audit')) {
      sendPermissionError(res, '4see:catalog:audit');
      return true;
    }

    const { store_id, platform: reqPlatform, credentials: reqCredentials = {}, options = {}, save_store, store_name } = data || {};
    let platform = reqPlatform;
    let credentials = reqCredentials;
    let activeStore = null;

    if (store_id) {
      activeStore = await getOne(
        'SELECT * FROM fourseee_connected_stores WHERE id = ? AND is_active = true',
        [store_id],
        { tenantId, isSuperAdmin }
      );
      if (!activeStore) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Tienda conectada no encontrada o inactiva.' }));
        return true;
      }
      platform = activeStore.platform.toUpperCase();
      const storedCreds = typeof activeStore.credentials === 'string' ? JSON.parse(activeStore.credentials) : (activeStore.credentials || {});
      credentials = { ...storedCreds };
      if (activeStore.store_url && !credentials.storeUrl && !credentials.store_url) {
        credentials.storeUrl = activeStore.store_url;
      }
    } else if (save_store && (reqCredentials.consumerSecret || reqCredentials.consumer_secret || reqCredentials.accessToken || reqCredentials.access_token)) {
      try {
        const newId = crypto.randomUUID();
        const sUrl = credentials.storeUrl || credentials.store_url || '';
        const sName = (store_name || sUrl || 'Tienda Conectada').replace(/^https?:\/\//, '').replace(/\/$/, '');
        await execute(
          `INSERT INTO fourseee_connected_stores (id, tenant_id, name, platform, store_url, credentials, is_active)
           VALUES (?, ?, ?, ?, ?, ?::jsonb, true)`,
          [newId, tenantId, sName, String(platform).toUpperCase(), sUrl, JSON.stringify(credentials)],
          { tenantId }
        );
        activeStore = { id: newId, name: sName, platform: String(platform).toUpperCase(), store_url: sUrl };
      } catch (saveErr) {
        console.warn('[4SEE] No se pudo persistir la conexion de la tienda:', saveErr.message);
      }
    }

    let listings = [];

    try {
      if (platform === 'TIENDANUBE') {
        const connector = new TiendanubeConnector({
          accessToken: credentials.accessToken || credentials.access_token,
          userId: credentials.userId || credentials.user_id
        });
        listings = await connector.fetchProducts({
          page: options.page || 1,
          limit: options.limit || 50,
          query: options.query || ''
        });
      } else if (platform === 'WOOCOMMERCE') {
        const connector = new WooCommerceConnector({
          storeUrl: credentials.storeUrl || credentials.store_url,
          consumerKey: credentials.consumerKey || credentials.consumer_key,
          consumerSecret: credentials.consumerSecret || credentials.consumer_secret
        });
        listings = await connector.fetchProducts({
          page: options.page || 1,
          limit: options.limit || 50,
          search: options.query || ''
        });
      } else if (Array.isArray(data?.raw_items)) {
        // Soporte para procesamiento on-the-fly desde payload crudo arbitrario (ej. CSV/JSON import)
        listings = data.raw_items.map(item => createStoreListing(item));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Plataforma no soportada o datos incompletos. Soportadas: TIENDANUBE, WOOCOMMERCE o raw_items.'
        }));
        return true;
      }

      // Actualizar marca temporal de escaneo si la tienda está persistida
      if (activeStore && activeStore.id) {
        await execute('UPDATE fourseee_connected_stores SET last_scanned_at = CURRENT_TIMESTAMP WHERE id = ?', [activeStore.id], { tenantId });
      }

      // Ejecutar motor de reglas OQL en caliente sobre los listings
      const auditReport = auditCatalogBatch(listings);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        platform: platform || 'CUSTOM',
        store_id: activeStore ? activeStore.id : null,
        store_name: activeStore ? activeStore.name : null,
        audit: auditReport
      }));
      return true;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: `Error en auditoría on-the-fly: ${err.message}`
      }));
      return true;
    }
  }

  // 2.2 WRITE-BACK SELECTIVO HACIA LA TIENDA CONECTADA
  if (pathPart === '/api/4see/store/write-back' && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:audit')) {
      sendPermissionError(res, '4see:catalog:audit');
      return true;
    }

    const { store_id, platform: reqPlatform, credentials: reqCredentials = {}, productId, updates = {} } = data || {};
    let platform = reqPlatform;
    let credentials = reqCredentials;

    if (store_id) {
      const store = await getOne(
        'SELECT * FROM fourseee_connected_stores WHERE id = ? AND is_active = true',
        [store_id],
        { tenantId, isSuperAdmin }
      );
      if (!store) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Tienda conectada no encontrada para write-back.' }));
        return true;
      }
      platform = store.platform.toUpperCase();
      const storedCreds = typeof store.credentials === 'string' ? JSON.parse(store.credentials) : (store.credentials || {});
      credentials = { ...storedCreds };
      if (store.store_url && !credentials.storeUrl && !credentials.store_url) {
        credentials.storeUrl = store.store_url;
      }
    }

    if (!platform || !productId || Object.keys(updates).length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Parámetros insuficientes para write-back.' }));
      return true;
    }

    try {
      if (platform === 'TIENDANUBE') {
        const connector = new TiendanubeConnector({
          accessToken: credentials.accessToken || credentials.access_token,
          userId: credentials.userId || credentials.user_id
        });
        await connector.updateProduct(productId, updates);
      } else if (platform === 'WOOCOMMERCE') {
        const connector = new WooCommerceConnector({
          storeUrl: credentials.storeUrl || credentials.store_url,
          consumerKey: credentials.consumerKey || credentials.consumer_key,
          consumerSecret: credentials.consumerSecret || credentials.consumer_secret
        });
        await connector.updateProduct(productId, updates);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Plataforma ${platform} no soporta write-back.` }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Producto ${productId} actualizado en ${platform}.` }));
      return true;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `Error en write-back: ${err.message}` }));
      return true;
    }
  }

  // 3. GUARDIÁN DE RENTABILIDAD & MÁRGENES
  if (pathPart === '/api/4see/margins' && req.method === 'GET') {
    if (!hasPermission(currentUser?.permissions, '4see:catalog:read')) {
      sendPermissionError(res, '4see:catalog:read');
      return true;
    }
    const rules = await query(
      isSuperAdmin
        ? 'SELECT * FROM fourseee_margin_rules ORDER BY created_at DESC'
        : 'SELECT * FROM fourseee_margin_rules WHERE tenant_id = ? ORDER BY created_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, rules }));
    return true;
  }

  if (pathPart === '/api/4see/margins' && req.method === 'POST') {
    if (!hasPermission(currentUser?.permissions, '4see:margins:manage')) {
      sendPermissionError(res, '4see:margins:manage');
      return true;
    }
    const { productSku, productName, costPrice, sellingPrice, minMarginPct, platformFeePct, taxPct, shippingCost } = data || {};
    if (!productSku || costPrice === undefined || sellingPrice === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'SKU, Costo y Precio de Venta son obligatorios.' }));
      return true;
    }

    const id = crypto.randomUUID();
    const metrics = calculateMarginMetrics({
      costPrice: parseFloat(costPrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      minMarginPct: parseFloat(minMarginPct) || 20,
      platformFeePct: parseFloat(platformFeePct) || 13,
      taxPct: parseFloat(taxPct) || 21,
      shippingCost: parseFloat(shippingCost) || 0
    });

    await execute(
      `INSERT INTO fourseee_margin_rules
       (id, tenant_id, product_sku, product_name, cost_price, selling_price, min_margin_pct, platform_fee_pct, tax_pct, shipping_cost, net_profit, real_margin_pct, is_red_zone, suggested_repricing_price, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        tenantId,
        productSku.trim(),
        productName ? productName.trim() : productSku.trim(),
        metrics.costPrice,
        metrics.sellingPrice,
        metrics.minMarginPct,
        metrics.platformFeePct,
        metrics.taxPct,
        metrics.shippingCost,
        metrics.netProfit,
        metrics.realMarginPct,
        metrics.isRedZone,
        metrics.suggestedRepricingPrice
      ],
      { tenantId }
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, id, metrics }));
    return true;
  }

  return false;
}

module.exports = {
  handle4seeApi
};
