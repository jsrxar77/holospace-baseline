const crypto = require('crypto');
const { getOne, query, execute, DEFAULT_TENANT_ID } = require('./db');

// Cache en memoria para ultra-baja latencia (< 0.1ms) con TTL de 60 segundos
const entitlementCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

/**
 * 1. Consultar si un Tenant tiene activo un módulo específico
 */
async function checkTenantModuleAccess(tenantId, moduleCode) {
  if (!tenantId) tenantId = DEFAULT_TENANT_ID;

  // El módulo Core siempre es gratuito y mandatorio
  if (moduleCode === 'core') return true;

  const cacheKey = `${tenantId}:${moduleCode}`;
  const cached = entitlementCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.isEnabled;
  }

  try {
    const row = await getOne(
      'SELECT is_enabled FROM tenant_modules WHERE tenant_id = ? AND module_code = ?',
      [tenantId, moduleCode],
      { tenantId }
    );

    const isEnabled = row ? Boolean(row.is_enabled) : false;
    entitlementCache.set(cacheKey, { isEnabled, expiresAt: now + CACHE_TTL_MS });
    return isEnabled;
  } catch (err) {
    console.error(`[ENTITLEMENT] Error consultando acceso al módulo ${moduleCode}:`, err.message);
    return false;
  }
}

/**
 * 2. Obtener lista completa de módulos licenciados para un Tenant
 */
async function getTenantEntitlements(tenantId) {
  if (!tenantId) tenantId = DEFAULT_TENANT_ID;

  try {
    const rows = await query(
      'SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND is_enabled = true',
      [tenantId],
      { tenantId }
    );

    const modules = rows.map(r => r.module_code);
    if (!modules.includes('core')) modules.unshift('core');
    return modules;
  } catch (err) {
    return ['core', 'scanban'];
  }
}

/**
 * 3. Habilitar o Deshabilitar un Módulo para un Tenant (Solo SUPERADMIN)
 */
async function setTenantModuleState(tenantId, moduleCode, isEnabled, actorEmail = 'system') {
  if (moduleCode === 'core' && !isEnabled) {
    throw new Error('El módulo Core es mandatorio para la plataforma y no puede ser desactivado.');
  }

  const existing = await getOne(
    'SELECT id FROM tenant_modules WHERE tenant_id = ? AND module_code = ?',
    [tenantId, moduleCode],
    { tenantId, isSuperAdmin: true }
  );

  if (existing) {
    await execute(
      'UPDATE tenant_modules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND module_code = ?',
      [Boolean(isEnabled), tenantId, moduleCode],
      { tenantId, isSuperAdmin: true }
    );
  } else {
    const id = crypto.randomUUID();
    await execute(
      'INSERT INTO tenant_modules (id, tenant_id, module_code, is_enabled) VALUES (?, ?, ?, ?)',
      [id, tenantId, moduleCode, Boolean(isEnabled)],
      { tenantId, isSuperAdmin: true }
    );
  }

  // Invalidar caché
  entitlementCache.delete(`${tenantId}:${moduleCode}`);

  // Registrar en Auditoría de Plataforma
  try {
    await execute(
      'INSERT INTO platform_audit_logs (tenant_id, user_email, action, details) VALUES (?, ?, ?, ?)',
      [
        tenantId,
        actorEmail,
        isEnabled ? 'TENANT_MODULE_ACTIVATED' : 'TENANT_MODULE_DEACTIVATED',
        JSON.stringify({ tenantId, moduleCode, isEnabled })
      ],
      { tenantId, isSuperAdmin: true }
    );
  } catch (e) {}

  return { success: true, tenantId, moduleCode, isEnabled };
}

/**
 * 4. Obtener Información de Suscripción, Plan y Consumo de Cuotas
 */
async function getTenantSubscriptionAndUsage(tenantId) {
  if (!tenantId) tenantId = DEFAULT_TENANT_ID;

  const tenant = await getOne('SELECT * FROM tenants WHERE id = ?', [tenantId], { tenantId, isSuperAdmin: true });
  const subscription = await getOne('SELECT * FROM tenant_subscriptions WHERE tenant_id = ?', [tenantId], { tenantId, isSuperAdmin: true }) || {
    plan_code: 'pro',
    status: 'active',
    max_users: 15,
    max_orders_monthly: 3000
  };

  const usersCountRow = await getOne('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = true', [tenantId], { tenantId, isSuperAdmin: true });
  const ordersCountRow = await getOne(
    "SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)",
    [tenantId],
    { tenantId, isSuperAdmin: true }
  );

  const entitlements = await getTenantEntitlements(tenantId);

  const maxUsers = parseInt(subscription.max_users, 10) || 15;
  const maxOrdersMonthly = parseInt(subscription.max_orders_monthly, 10) || 3000;
  const activeUsers = usersCountRow ? parseInt(usersCountRow.count, 10) : 0;
  const monthlyOrders = ordersCountRow ? parseInt(ordersCountRow.count, 10) : 0;

  return {
    tenant: tenant || { id: tenantId, slug: 'drinklovers', name: 'Drink Lovers' },
    subscription: {
      planCode: subscription.plan_code,
      status: subscription.status,
      maxUsers,
      maxOrdersMonthly,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    },
    usage: {
      currentUsers: activeUsers,
      maxUsers,
      usersQuotaPercent: Math.round((activeUsers / maxUsers) * 100),
      currentOrdersMonthly: monthlyOrders,
      maxOrdersMonthly,
      ordersQuotaPercent: Math.round((monthlyOrders / maxOrdersMonthly) * 100)
    },
    entitlements
  };
}

/**
 * 5. Middleware de Autorización Modular para Express / Node HTTP
 */
function requireModule(moduleCode) {
  return async (req, res, next) => {
    // Si el usuario es SUPERADMIN, tiene acceso irrestricto de diagnóstico
    if (req.user && req.user.role === 'SUPERADMIN') {
      return next();
    }

    const tenantId = (req.user && req.user.tenantId) || req.tenantId || DEFAULT_TENANT_ID;
    const hasAccess = await checkTenantModuleAccess(tenantId, moduleCode);

    if (!hasAccess) {
      console.warn(`⛔ [ENTITLEMENT] Acceso denegado: Tenant ${tenantId} no tiene activo el módulo '${moduleCode}'.`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `El módulo '${moduleCode}' no está incluido en la suscripción activa de tu organización.`,
        code: 'MODULE_NOT_ENTITLED',
        requiredModule: moduleCode,
        upgradeUrl: `/api/billing/upgrade?module=${moduleCode}`
      }));
      return;
    }

    next();
  };
}

module.exports = {
  checkTenantModuleAccess,
  getTenantEntitlements,
  setTenantModuleState,
  getTenantSubscriptionAndUsage,
  requireModule
};
