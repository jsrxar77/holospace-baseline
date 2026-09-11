const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query, execute, getOne } = require('../../lib/db');
const { extractProductData } = require('../lib/extractor');
const { calculateMarginMetrics } = require('../lib/margins');

// 1. MONITOR DE COMPETIDORES
// Listar monitores de competidores del tenant autenticado
router.get('/monitors', async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === 'SUPERADMIN';
    const tenantId = req.user.tenantId;
    const monitors = await query(
      isSuperAdmin 
        ? 'SELECT * FROM fourseee_competitor_monitors ORDER BY created_at DESC'
        : 'SELECT * FROM fourseee_competitor_monitors WHERE tenant_id = ? ORDER BY created_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );
    res.json({ success: true, monitors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear nuevo monitor de competidor
router.post('/monitors', async (req, res) => {
  try {
    const { productName, competitorUrl, competitorName, myPrice, targetMarginPct } = req.body;
    if (!productName || !competitorUrl) {
      return res.status(400).json({ success: false, error: 'Nombre de producto y URL son obligatorios.' });
    }

    const tenantId = req.user.tenantId;
    const id = crypto.randomUUID();
    
    // Extracción inicial
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

    res.json({ success: true, id, extracted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Forzar re-chequeo de URL competidora
router.post('/monitors/:id/check', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const isSuperAdmin = req.user && req.user.role === 'SUPERADMIN';
    const monitor = await getOne(
      'SELECT * FROM fourseee_competitor_monitors WHERE id = ?',
      [req.params.id],
      { tenantId, isSuperAdmin }
    );

    if (!monitor) {
      return res.status(404).json({ success: false, error: 'Monitor no encontrado.' });
    }

    const extracted = await extractProductData(monitor.competitor_url);
    await execute(
      `UPDATE fourseee_competitor_monitors 
       SET competitor_price = ?, competitor_stock = ?, last_checked_at = CURRENT_TIMESTAMP, extraction_method = ?
       WHERE id = ? AND tenant_id = ?`,
      [extracted.price || 0, extracted.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK', extracted.method || 'STRUCTURED_DATA', monitor.id, monitor.tenant_id],
      { tenantId: monitor.tenant_id }
    );

    res.json({ success: true, monitorId: monitor.id, extracted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar monitor
router.delete('/monitors/:id', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    await execute('DELETE FROM fourseee_competitor_monitors WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId], { tenantId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. AUDITORÍA DE CATÁLOGO & FEED
// Listar ítems de catálogo auditados
router.get('/catalog', async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === 'SUPERADMIN';
    const tenantId = req.user.tenantId;
    const items = await query(
      isSuperAdmin
        ? 'SELECT * FROM fourseee_catalog_items ORDER BY updated_at DESC'
        : 'SELECT * FROM fourseee_catalog_items WHERE tenant_id = ? ORDER BY updated_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Agregar o auditar un ítem de catálogo
router.post('/catalog/audit', async (req, res) => {
  try {
    const { sku, title, gtin, brand, category } = req.body;
    if (!sku || !title) {
      return res.status(400).json({ success: false, error: 'SKU y Título son requeridos.' });
    }

    const tenantId = req.user.tenantId;
    const id = crypto.randomUUID();

    // Diagnóstico técnico estricto
    const diagnostics = [];
    if (!gtin || gtin.length < 8) {
      diagnostics.push({ code: 'MISSING_GTIN', severity: 'HIGH', message: 'Falta código GTIN / EAN-13 válido (riesgo de rechazo en Google Shopping).' });
    }
    if (!brand || brand.trim().length === 0) {
      diagnostics.push({ code: 'MISSING_BRAND', severity: 'MEDIUM', message: 'Falta especificar marca del producto.' });
    }
    if (title.length < 20) {
      diagnostics.push({ code: 'SHORT_TITLE', severity: 'LOW', message: 'Título demasiado breve para intención de búsqueda comercial.' });
    }

    // Sugerencia optimizada con intención de búsqueda
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

    res.json({ success: true, id, status, diagnostics, suggestedTitle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Aprobar optimización de título en Diff View
router.post('/catalog/:id/approve', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const item = await getOne('SELECT * FROM fourseee_catalog_items WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId], { tenantId });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Ítem de catálogo no encontrado.' });
    }

    await execute(
      `UPDATE fourseee_catalog_items
       SET current_title = suggested_title, is_approved = true, status = 'OPTIMIZED', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [item.id, tenantId],
      { tenantId }
    );

    res.json({ success: true, approvedTitle: item.suggested_title });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GUARDIÁN DE RENTABILIDAD & MÁRGENES
// Listar reglas y estado de rentabilidad
router.get('/margins', async (req, res) => {
  try {
    const isSuperAdmin = req.user && req.user.role === 'SUPERADMIN';
    const tenantId = req.user.tenantId;
    const rules = await query(
      isSuperAdmin
        ? 'SELECT * FROM fourseee_margin_rules ORDER BY created_at DESC'
        : 'SELECT * FROM fourseee_margin_rules WHERE tenant_id = ? ORDER BY created_at DESC',
      isSuperAdmin ? [] : [tenantId],
      { tenantId, isSuperAdmin }
    );
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear o actualizar regla de margen para un producto
router.post('/margins', async (req, res) => {
  try {
    const { productSku, productName, costPrice, sellingPrice, minMarginPct, platformFeePct, taxPct, shippingCost } = req.body;
    if (!productSku || costPrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ success: false, error: 'SKU, Costo y Precio de Venta son obligatorios.' });
    }

    const tenantId = req.user.tenantId;
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

    res.json({ success: true, id, metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
