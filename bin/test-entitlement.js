#!/usr/bin/env node
/**
 * bin/test-entitlement.js
 * Test Suite Automatizado para la Fase 3: Licenciamiento Modular & Entitlements
 */

const {
  checkTenantModuleAccess,
  getTenantEntitlements,
  setTenantModuleState,
  getTenantSubscriptionAndUsage
} = require('../lib/entitlement');

const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

console.log('======================================================');
console.log('🧪 TEST SUITE: LICENCIAMIENTO MODULAR & ENTITLEMENTS');
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
  // 1. Módulo Core siempre activo
  const coreAccess = await checkTenantModuleAccess(TEST_TENANT_ID, 'core');
  assert(coreAccess === true, 'El módulo `core` está siempre activo (mandatorio)');

  // 2. Módulo ScanBan habilitado para Drink Lovers
  const scanbanAccess = await checkTenantModuleAccess(TEST_TENANT_ID, 'scanban');
  assert(scanbanAccess === true, 'El módulo `scanban` está activo para el tenant de prueba');

  // 3. Módulo no contratado (ej. Analytics)
  const analyticsAccess = await checkTenantModuleAccess(TEST_TENANT_ID, 'analytics');
  assert(analyticsAccess === false, 'El módulo no contratado (`analytics`) devuelve false');

  // 4. Consulta de Suscripción y Cuotas
  const subData = await getTenantSubscriptionAndUsage(TEST_TENANT_ID);
  assert(subData.subscription.planCode === 'pro', 'Plan de suscripción correcto (Pro)');
  assert(subData.subscription.maxUsers === 15, 'Límite de usuarios correcto (15)');
  assert(subData.subscription.maxOrdersMonthly === 3000, 'Límite de pedidos mensual correcto (3000)');
  assert(typeof subData.usage.currentUsers === 'number', 'Conteo de usuarios activos calculado');
  assert(Array.isArray(subData.entitlements) && subData.entitlements.includes('scanban'), 'Lista de entitlements incluye scanban');

  // 5. Activación dinámica de Módulo (Feature Flag)
  console.log('\n--- 5. Activación Dinámica de Módulo ---');
  await setTenantModuleState(TEST_TENANT_ID, 'stockflow', true, 'superadmin@holoware.com');
  const stockflowAfter = await checkTenantModuleAccess(TEST_TENANT_ID, 'stockflow');
  assert(stockflowAfter === true, 'Módulo `stockflow` activado dinámicamente con éxito');

  // 6. Desactivación de Módulo
  await setTenantModuleState(TEST_TENANT_ID, 'stockflow', false, 'superadmin@holoware.com');
  const stockflowDisabled = await checkTenantModuleAccess(TEST_TENANT_ID, 'stockflow');
  assert(stockflowDisabled === false, 'Módulo `stockflow` desactivado con éxito');

  console.log('\n======================================================');
  console.log(`📊 RESULTADOS: ${passed} Aprobados | ${failed} Fallidos`);
  if (failed === 0) {
    console.log('🎉 FASE 3: MOTOR DE LICENCIAMIENTO MODULAR 100% OPERATIVO.');
  } else {
    console.error('⚠️ ALGUNOS TESTS DE LICENCIAMIENTO FALLARON.');
    process.exit(1);
  }
  console.log('======================================================');
}

runTests();
