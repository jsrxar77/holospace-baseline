#!/usr/bin/env node
/**
 * bin/test-tenants-module.js
 * Test Suite: Módulo de Gestión de Tenants (Exclusivo SUPERADMIN)
 */

const { query, getOne, execute } = require('../lib/db');
const { signJwt, hashPassword } = require('../lib/auth');
const { setTenantModuleState } = require('../lib/entitlement');

console.log('======================================================');
console.log('🧪 TEST SUITE: MÓDULO TENANTS & GOBIERNO SAAS (SUPERADMIN)');
console.log('======================================================');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedCount++;
  }
}

async function runTests() {
  const superAdminToken = signJwt({
    sub: 'superadmin@hologrowth.com.ar',
    email: 'superadmin@hologrowth.com.ar',
    role: 'SUPERADMIN',
    tenantId: 'a0000000-0000-0000-0000-000000000001'
  });

  const tenantAdminToken = signJwt({
    sub: 'admin@drinklovers.com.ar',
    email: 'admin@drinklovers.com.ar',
    role: 'ADMIN',
    tenantId: '550e8400-e29b-41d4-a716-446655440000'
  });

  // 1. Verificar listado de Tenants por SuperAdmin
  console.log('\n--- 1. Listado y Auditoría de Tenants ---');
  const tenants = await query('SELECT * FROM tenants ORDER BY created_at ASC', [], { isSuperAdmin: true });
  assert(tenants.length >= 3, `Listado de tenants recupera ${tenants.length} organizaciones.`);
  assert(tenants.some(t => t.slug === 'drinklovers'), 'Tenant `drinklovers` presente.');
  assert(tenants.some(t => t.slug === 'poke'), 'Tenant `poke` presente.');
  assert(tenants.some(t => t.slug === 'holoware'), 'Tenant plataforma `holoware` presente.');

  // 2. Creación de un Nuevo Tenant por SuperAdmin
  console.log('\n--- 2. Aprovisionamiento Dinámico de Nuevo Tenant ---');
  const crypto = require('crypto');
  const testTenantId = crypto.randomUUID();
  const testSlug = `tenant_test_${Date.now()}`;
  
  await execute(
    'INSERT INTO tenants (id, slug, name, status) VALUES (?, ?, ?, ?)',
    [testTenantId, testSlug, 'Test Logistics Corp', 'active'],
    { isSuperAdmin: true }
  );

  await execute(
    'INSERT INTO tenant_subscriptions (id, tenant_id, plan_code, status, max_users, max_orders_monthly) VALUES (?, ?, ?, ?, ?, ?)',
    [crypto.randomUUID(), testTenantId, 'pro', 'active', 15, 3000],
    { isSuperAdmin: true }
  );

  const createdTenant = await getOne('SELECT * FROM tenants WHERE id = ?', [testTenantId], { isSuperAdmin: true });
  assert(createdTenant !== null, 'Nuevo Tenant insertado con éxito en PostgreSQL.');
  assert(createdTenant.slug === testSlug, 'Slug de organización coincide exactamente.');

  // 3. Asignación de Usuario a Tenant
  console.log('\n--- 3. Asignación de Usuarios a Organización ---');
  const testUserId = crypto.randomUUID();
  const testUserEmail = `operario_${Date.now()}@testcorp.com`;
  
  await execute(
    'INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, true)',
    [testUserId, testTenantId, testUserEmail, hashPassword('Pass123!'), 'Operario Test', 'OPERATOR'],
    { isSuperAdmin: true }
  );

  const createdUser = await getOne('SELECT * FROM users WHERE id = ?', [testUserId], { isSuperAdmin: true });
  assert(createdUser !== null, 'Usuario asignado correctamente al Tenant.');
  assert(createdUser.tenant_id === testTenantId, 'tenant_id del usuario coincide con la organización.');
  assert(createdUser.role === 'OPERATOR', 'Rol asignado es OPERATOR.');

  // 4. Licenciamiento Modular Dinámico (ScanBan Board, ScanBan Scanner, ScanFlow)
  console.log('\n--- 4. Licenciamiento Modular por Tenant ---');
  await setTenantModuleState(testTenantId, 'scanban-board', true, 'superadmin@hologrowth.com.ar');
  await setTenantModuleState(testTenantId, 'scanban-scanner', true, 'superadmin@hologrowth.com.ar');
  await setTenantModuleState(testTenantId, 'scanflow', true, 'superadmin@hologrowth.com.ar');

  const activeModules = await query('SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND is_enabled = true', [testTenantId], { isSuperAdmin: true });
  const modCodes = activeModules.map(m => m.module_code);
  assert(modCodes.includes('scanban-board'), 'Módulo `scanban-board` activado.');
  assert(modCodes.includes('scanban-scanner'), 'Módulo `scanban-scanner` activado.');
  assert(modCodes.includes('scanflow'), 'Módulo `scanflow` activado.');

  // Limpieza de datos de prueba
  await execute('DELETE FROM users WHERE tenant_id = ?', [testTenantId], { isSuperAdmin: true });
  await execute('DELETE FROM tenant_modules WHERE tenant_id = ?', [testTenantId], { isSuperAdmin: true });
  await execute('DELETE FROM tenant_subscriptions WHERE tenant_id = ?', [testTenantId], { isSuperAdmin: true });
  await execute('DELETE FROM tenants WHERE id = ?', [testTenantId], { isSuperAdmin: true });

  console.log('\n======================================================');
  console.log(`📊 RESULTADOS: ${passedCount} Aprobados | ${failedCount} Fallidos`);
  if (failedCount === 0) {
    console.log('🎉 FASE 5: MÓDULO TENANTS (GOBIERNO SAAS SUPERADMIN) 100% OPERATIVO.');
  } else {
    process.exit(1);
  }
  console.log('======================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('💥 Error inesperado ejecutando tests:', err);
  process.exit(1);
});
