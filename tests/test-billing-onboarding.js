#!/usr/bin/env node
/**
 * bin/test-billing-onboarding.js
 * Test Suite Automatizado para la Fase 6: Pasarela de Pagos & Auto-Onboarding
 */

const {
  PLANS,
  registerNewTenant,
  createCheckoutSession,
  handlePaymentWebhook
} = require('../lib/billing');
const { getTenantSubscriptionAndUsage } = require('../lib/entitlement');

console.log('======================================================');
console.log('🧪 TEST SUITE: BILLING & AUTO-ONBOARDING B2B');
console.log('======================================================');

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${desc}`);
    failed++;
  }
}

async function runTests() {
  // 1. Catálogo de Planes Comerciales
  console.log('\n--- 1. Catálogo de Planes Comerciales ---');
  assert(PLANS.kanban_simple && PLANS.kanban_business && PLANS.kanban_enterprise, 'Línea Vertical Logística Kanban definida');
  assert(PLANS.fourseee_simple && PLANS.fourseee_business && PLANS.fourseee_enterprise, 'Línea Vertical E-Commerce 4see definida');
  assert(PLANS.kanban_business.priceUsd === 119, 'Precio del Plan Kanban Business = $119 USD');
  assert(PLANS.kanban_business.includedModules.includes('kanban'), 'Plan Kanban Business incluye módulo Kanban');

  // 2. Flujo de Auto-Registro de Nueva Organización (Tenant Onboarding)
  console.log('\n--- 2. Auto-Registro de Nueva Organización B2B ---');
  const testSlug = `demo_corp_${Date.now()}`;
  const testEmail = `admin@${testSlug}.com`;

  const regResult = await registerNewTenant({
    companyName: 'Demo Logistics Corp',
    slug: testSlug,
    adminName: 'CEO Demo Corp',
    adminEmail: testEmail,
    password: 'PasswordSuperSegura2026!',
    planCode: 'kanban_business'
  });

  assert(regResult.success === true, 'Auto-registro completado con éxito');
  assert(typeof regResult.token === 'string' && regResult.token.length > 20, 'Token JWT emitido automáticamente en el onboarding');
  assert(regResult.tenant.slug === testSlug, 'Slug del Tenant registrado correctamente');

  // 3. Verificación de Aprovisionamiento de Suscripción y Módulos
  const subData = await getTenantSubscriptionAndUsage(regResult.tenant.id);
  assert(subData.subscription.planCode.includes('kanban_business'), 'Suscripción inicial asignada en Plan Kanban Business');
  assert(subData.entitlements.includes('kanban'), 'Módulo Kanban aprovisionado automáticamente');

  // 4. Creación de Sesión de Checkout
  console.log('\n--- 4. Generación de Checkout Session ---');
  const checkout = await createCheckoutSession(regResult.tenant.id, 'kanban_enterprise');
  assert(checkout.success === true, 'Sesión de checkout creada con éxito');
  assert(checkout.checkoutUrl.includes('kanban_enterprise'), 'URL de checkout contiene el plan de destino');

  // 5. Procesamiento de Webhook de Pago
  console.log('\n--- 5. Procesamiento de Webhooks de Pasarela ---');
  const webhookResult = await handlePaymentWebhook({
    eventType: 'payment.succeeded',
    tenantId: regResult.tenant.id,
    planCode: 'kanban_enterprise',
    status: 'active'
  });
  assert(webhookResult.success === true, 'Webhook de pago procesado con éxito');

  const upgradedSub = await getTenantSubscriptionAndUsage(regResult.tenant.id);
  assert(upgradedSub.subscription.planCode.includes('kanban_enterprise'), 'Suscripción actualizada a Kanban Enterprise tras webhook');
  assert(upgradedSub.entitlements.includes('scanner'), 'Módulo Scanner desbloqueado automáticamente tras upgrade');

  // Limpieza estricta de datos de prueba
  const { execute } = require('../lib/db');
  await execute('DELETE FROM core_users WHERE tenant_id = ?', [regResult.tenant.id], { isSuperAdmin: true });
  await execute('DELETE FROM tenant_modules WHERE tenant_id = ?', [regResult.tenant.id], { isSuperAdmin: true });
  await execute('DELETE FROM tenant_subscriptions WHERE tenant_id = ?', [regResult.tenant.id], { isSuperAdmin: true });
  await execute('DELETE FROM tenant_tenants WHERE id = ?', [regResult.tenant.id], { isSuperAdmin: true });

  console.log('\n======================================================');
  console.log(`📊 RESULTADOS: ${passed} Aprobados | ${failed} Fallidos`);
  if (failed === 0) {
    console.log('FASE 6: MOTOR DE BILLING & AUTO-ONBOARDING 100% OPERATIVO.');
  } else {
    console.error('ALGUNOS TESTS DE BILLING FALLARON.');
    process.exit(1);
  }
  console.log('======================================================');
  process.exit(0);
}

runTests();
