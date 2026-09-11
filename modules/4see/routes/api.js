const crypto = require('crypto');
const { query, execute, getOne } = require('../../../lib/db');
const { extractProductData } = require('../lib/extractor');
const { calculateMarginMetrics } = require('../lib/margins');
const { checkTenantModuleAccess } = require('../../../lib/entitlement');
const { hasPermission, sendPermissionError } = require('../../../lib/rbac');

/**
 * Handler principal para todas las peticiones bajo /api/4see/*
 */
async function handle4seeApi(req, res, { currentUser, tenantId, data, isSuperAdmin }) {
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

  if (pathPart === '/api/4see/catalog/audit' && req.method === 'POST') {
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
