const { getOne } = require('../../../lib/db');
const { PLANS } = require('../../../lib/billing');

async function getFourseeeLimits(tenantId) {
  const sub = await getOne(
    "SELECT plan_code FROM tenant_subscriptions WHERE tenant_id = ? AND status = 'active'",
    [tenantId],
    { tenantId }
  );
  const plan = PLANS[sub?.plan_code] || PLANS.fourseee_simple;
  return {
    planCode: plan.code,
    planName: plan.name,
    maxMonitoredProducts: plan.maxMonitoredProducts,
    maxCompetitorsPerProduct: plan.maxCompetitorsPerProduct
  };
}

async function countWatchedProducts(tenantId) {
  const row = await getOne(
    'SELECT COUNT(*)::int AS n FROM fourseee_products WHERE tenant_id = ? AND in_analysis = true',
    [tenantId],
    { tenantId }
  );
  return row?.n || 0;
}

async function countRivalsOfProduct(tenantId, productId) {
  const row = await getOne(
    'SELECT COUNT(*)::int AS n FROM fourseee_competitor_monitors WHERE tenant_id = ? AND product_id = ?',
    [tenantId, productId],
    { tenantId }
  );
  return row?.n || 0;
}

module.exports = { getFourseeeLimits, countWatchedProducts, countRivalsOfProduct };
