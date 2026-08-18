const crypto = require('crypto');
const { getOne, execute, query } = require('./db');
const { hashPassword, signJwt } = require('./auth');
const { setTenantModuleState } = require('./entitlement');

// Catálogo de Planes Comerciales
const PLANS = {
  starter: {
    code: 'starter',
    name: 'Starter Tier',
    priceUsd: 49,
    maxUsers: 3,
    maxOrdersMonthly: 500,
    includedModules: ['core', 'kanban', 'scanner'],
    description: 'Ideal para depósitos pequeños o pilotos operativos.'
  },
  pro: {
    code: 'pro',
    name: 'Professional Tier',
    priceUsd: 149,
    maxUsers: 15,
    maxOrdersMonthly: 3000,
    includedModules: ['core', 'kanban', 'scanner'],
    description: 'Para centros de distribución y empresas de logística medianas.'
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise Tier',
    priceUsd: 499,
    maxUsers: 9999,
    maxOrdersMonthly: 999999,
    includedModules: ['core', 'tenant', 'kanban', 'scanner'],
    description: 'Capacidad ilimitada, soporte 24/7 y todos los módulos desbloqueados.'
  }
};

/**
 * 1. Flujo de Auto-Registro de Nuevas Empresas (Auto-Onboarding B2B)
 */
async function registerNewTenant({ companyName, slug, adminName, adminEmail, password, planCode = 'starter' }) {
  if (!companyName || !slug || !adminEmail || !password || !adminName) {
    throw new Error('Todos los campos son obligatorios (nombre de empresa, slug, nombre de admin, email y contraseña).');
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
  const cleanEmail = adminEmail.toLowerCase().trim();

  if (cleanSlug.length < 3) {
    throw new Error('El identificador/slug de la organización debe tener al menos 3 caracteres.');
  }

  // 1. Verificar unicidad de Slug
  const existingTenant = await getOne('SELECT id FROM tenants WHERE slug = ?', [cleanSlug], { isSuperAdmin: true });
  if (existingTenant) {
    throw new Error(`El slug de organización '${cleanSlug}' ya está registrado. Por favor elige otro.`);
  }

  // 2. Verificar unicidad de Email
  const existingUser = await getOne('SELECT email FROM users WHERE LOWER(email) = ?', [cleanEmail], { isSuperAdmin: true });
  if (existingUser) {
    throw new Error(`El email '${cleanEmail}' ya está registrado en la plataforma.`);
  }

  const selectedPlan = PLANS[planCode] || PLANS.starter;
  const tenantId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // 3. Crear Organización (Tenant)
  await execute(
    'INSERT INTO tenants (id, slug, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [tenantId, cleanSlug, companyName.trim(), 'active'],
    { isSuperAdmin: true }
  );

  // 4. Crear Suscripción (Trial / Active)
  await execute(
    "INSERT INTO tenant_subscriptions (id, tenant_id, plan_code, status, max_users, max_orders_monthly, current_period_start, current_period_end) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '30 days')",
    [subId, tenantId, selectedPlan.code, 'active', selectedPlan.maxUsers, selectedPlan.maxOrdersMonthly],
    { isSuperAdmin: true }
  );

  // 5. Habilitar Módulos según el Plan Contratado
  for (const mod of selectedPlan.includedModules) {
    await setTenantModuleState(tenantId, mod, true, cleanEmail);
  }

  // 6. Crear Usuario Administrador con Contraseña Encriptada
  const passwordHash = hashPassword(password);
  await execute(
    'INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, true)',
    [userId, tenantId, cleanEmail, passwordHash, adminName.trim(), 'ADMIN'],
    { isSuperAdmin: true }
  );

  // 7. Emitir Token JWT de Bienvenida
  const jwtPayload = {
    sub: cleanEmail,
    email: cleanEmail,
    name: adminName.trim(),
    role: 'ADMIN',
    tenantId,
    tenantSlug: cleanSlug,
    entitlements: selectedPlan.includedModules
  };
  const token = signJwt(jwtPayload, 86400 * 7);

  console.log(`🎉 [ONBOARDING] Nuevo Tenant registrado con éxito: ${companyName} (${cleanSlug}) - Plan: ${selectedPlan.name}`);

  return {
    success: true,
    message: 'Organización y cuenta administradora creadas con éxito.',
    token,
    tenant: {
      id: tenantId,
      slug: cleanSlug,
      name: companyName.trim(),
      plan: selectedPlan.code
    },
    user: {
      id: cleanEmail,
      email: cleanEmail,
      name: adminName.trim(),
      role: 'ADMIN',
      tenantId,
      tenantSlug: cleanSlug,
      entitlements: selectedPlan.includedModules
    }
  };
}

/**
 * 2. Generar Sesión de Checkout / Actualización de Plan
 */
async function createCheckoutSession(tenantId, targetPlanCode, successUrl = '/#subscription-success') {
  const plan = PLANS[targetPlanCode];
  if (!plan) {
    throw new Error(`Plan comercial inválido: '${targetPlanCode}'.`);
  }

  const tenant = await getOne('SELECT * FROM tenants WHERE id = ?', [tenantId], { tenantId, isSuperAdmin: true });
  if (!tenant) {
    throw new Error('Organización no encontrada.');
  }

  const sessionId = `cs_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  
  return {
    success: true,
    sessionId,
    checkoutUrl: `https://checkout.holoware.app/pay/${sessionId}?tenant=${tenant.slug}&plan=${plan.code}`,
    plan: {
      code: plan.code,
      name: plan.name,
      priceUsd: plan.priceUsd
    },
    amount: plan.priceUsd,
    currency: 'USD'
  };
}

/**
 * 3. Procesar Webhook de Pasarela de Pagos (Stripe / MercadoPago Simulator)
 */
async function handlePaymentWebhook({ eventType, tenantId, planCode, status = 'active' }) {
  console.log(`💳 [BILLING WEBHOOK] Evento recibido: ${eventType} para Tenant ${tenantId}`);

  if (eventType === 'subscription.activated' || eventType === 'payment.succeeded') {
    const selectedPlan = PLANS[planCode] || PLANS.pro;

    // Actualizar límites y estado de suscripción
    await execute(
      "UPDATE tenant_subscriptions SET plan_code = ?, status = ?, max_users = ?, max_orders_monthly = ?, current_period_end = CURRENT_TIMESTAMP + interval '30 days', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
      [selectedPlan.code, status, selectedPlan.maxUsers, selectedPlan.maxOrdersMonthly, tenantId],
      { isSuperAdmin: true }
    );

    // Habilitar los módulos del nuevo plan
    for (const mod of selectedPlan.includedModules) {
      await setTenantModuleState(tenantId, mod, true, 'billing_webhook');
    }

    return { success: true, message: `Suscripción de ${tenantId} actualizada a ${selectedPlan.name}.` };
  }

  if (eventType === 'subscription.canceled' || eventType === 'payment.failed') {
    await execute(
      "UPDATE tenant_subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
      [tenantId],
      { isSuperAdmin: true }
    );
    return { success: true, message: `Suscripción de ${tenantId} marcada como past_due.` };
  }

  return { success: true, message: 'Evento procesado sin cambios de estado.' };
}

module.exports = {
  PLANS,
  registerNewTenant,
  createCheckoutSession,
  handlePaymentWebhook
};
