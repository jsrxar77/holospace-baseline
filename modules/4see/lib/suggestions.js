const crypto = require('crypto');
const { query, execute, getOne } = require('../../../lib/db');
const { evaluateSmartPrice } = require('./smartprice');

// Recalcula la sugerencia pendiente de un producto con sus datos actuales (costos, precio, rivales, reglas).
// Si ya no hay una propuesta valida, la sugerencia pendiente se quita; nunca queda una vieja.
async function recalcSuggestionForProduct(tenantId, productId) {
  const product = await getOne(
    'SELECT * FROM fourseee_products WHERE id = ? AND tenant_id = ?',
    [productId, tenantId],
    { tenantId }
  );
  if (!product) return null;

  const monitors = await query(
    `SELECT id, competitor_price AS last_scraped_price, competitor_stock AS last_scraped_stock
     FROM fourseee_competitor_monitors WHERE product_id = ? AND tenant_id = ?`,
    [productId, tenantId],
    { tenantId }
  );
  const mappings = monitors.map((m) => ({ ...m, is_active: true }));

  const rules = await query(
    `SELECT * FROM fourseee_pricing_rules
     WHERE tenant_id = ? AND is_active = true AND (product_id = ? OR product_id IS NULL)
     ORDER BY priority DESC`,
    [tenantId, productId],
    { tenantId }
  );

  const pending = await getOne(
    "SELECT id FROM fourseee_price_update_queue WHERE product_id = ? AND status = 'PENDING' AND tenant_id = ?",
    [productId, tenantId],
    { tenantId }
  );

  const canSuggest = product.in_analysis && product.costs_loaded;
  const evaluation = canSuggest ? evaluateSmartPrice(product, mappings, rules) : null;

  if (!evaluation || evaluation.suggested_price === undefined) {
    if (pending) {
      await execute('DELETE FROM fourseee_price_update_queue WHERE id = ? AND tenant_id = ?', [pending.id, tenantId], { tenantId });
    }
    return null;
  }

  if (pending) {
    await execute(
      `UPDATE fourseee_price_update_queue
       SET rule_id = ?, previous_price = ?, calculated_price = ?, suggested_price = ?, floor_applied = ?, created_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [evaluation.rule_id, evaluation.previous_price, evaluation.calculated_price, evaluation.suggested_price, evaluation.floor_applied, pending.id, tenantId],
      { tenantId }
    );
    return pending.id;
  }

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO fourseee_price_update_queue
     (id, tenant_id, product_id, rule_id, previous_price, calculated_price, suggested_price, floor_applied, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [id, tenantId, productId, evaluation.rule_id, evaluation.previous_price, evaluation.calculated_price, evaluation.suggested_price, evaluation.floor_applied],
    { tenantId }
  );
  return id;
}

module.exports = { recalcSuggestionForProduct };
