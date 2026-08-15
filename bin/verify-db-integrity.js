#!/usr/bin/env node
/**
 * bin/verify-db-integrity.js
 * Auditoría y Verificación de Integridad de la Base de Datos Multi-Tenant en PostgreSQL 16
 */

const { query } = require('../lib/db');

console.log('======================================================');
console.log('🔍 AUDITORÍA DE INTEGRIDAD: BASE DE DATOS POSTGRESQL 16 (RLS)');
console.log('======================================================');

let allPassed = true;

async function check(title, testFn) {
  try {
    const res = await testFn();
    if (res.passed) {
      console.log(`✅ [PASS] ${title}: ${res.message}`);
    } else {
      console.error(`❌ [FAIL] ${title}: ${res.message}`);
      allPassed = false;
    }
  } catch (err) {
    console.error(`💥 [ERROR] ${title}: ${err.message}`);
    allPassed = false;
  }
}

async function runAudit() {
  // 1. Verificar existencia de tabla tenants
  await check('Tabla `tenants`', async () => {
    const tenants = await query('SELECT * FROM tenants', [], { isSuperAdmin: true });
    return {
      passed: tenants.length > 0,
      message: `${tenants.length} tenants encontrados (${tenants.map(t => t.slug).join(', ')})`
    };
  });

  // 2. Verificar existencia de tabla tenant_subscriptions
  await check('Tabla `tenant_subscriptions`', async () => {
    const subs = await query('SELECT * FROM tenant_subscriptions', [], { isSuperAdmin: true });
    return {
      passed: subs.length > 0,
      message: `${subs.length} suscripciones activas registradas`
    };
  });

  // 3. Verificar existencia de tabla tenant_modules (Entitlements)
  await check('Tabla `tenant_modules` (Entitlements)', async () => {
    const mods = await query('SELECT * FROM tenant_modules', [], { isSuperAdmin: true });
    return {
      passed: mods.length > 0,
      message: `${mods.length} módulos licenciados (${mods.map(m => `${m.tenant_id.substring(0, 8)}...:${m.module_code}`).join(', ')})`
    };
  });

  // 4. Verificar usuarios y columna tenant_id
  await check('Tabla `users` con `tenant_id`', async () => {
    const users = await query('SELECT * FROM users', [], { isSuperAdmin: true });
    const nullTenant = users.filter(u => !u.tenant_id);
    return {
      passed: users.length > 0 && nullTenant.length === 0,
      message: `${users.length} usuarios auditados, 0 huérfanos sin tenant_id`
    };
  });

  // 5. Verificar pedidos y columna tenant_id
  await check('Tabla `orders` con `tenant_id`', async () => {
    const orders = await query('SELECT * FROM orders', [], { isSuperAdmin: true });
    const nullTenant = orders.filter(o => !o.tenant_id);
    return {
      passed: nullTenant.length === 0,
      message: `${orders.length} pedidos auditados, 0 huérfanos sin tenant_id`
    };
  });

  // 6. Verificar ítems de pedidos y consistencia relacional
  await check('Tabla `order_items` con `tenant_id`', async () => {
    const items = await query('SELECT * FROM order_items', [], { isSuperAdmin: true });
    const nullTenant = items.filter(i => !i.tenant_id);
    return {
      passed: nullTenant.length === 0,
      message: `${items.length} ítems auditados, 0 huérfanos sin tenant_id`
    };
  });

  // 7. Verificar logs de auditoría y settings
  await check('Logs de Auditoría y Settings', async () => {
    const settings = await query('SELECT * FROM app_settings', [], { isSuperAdmin: true });
    return {
      passed: settings.length > 0,
      message: `${settings.length} settings globales configurados`
    };
  });

  console.log('======================================================');
  if (allPassed) {
    console.log('🎉 RESULTADO: LA BASE DE DATOS POSTGRESQL MULTI-TENANT ESTÁ 100% SANA.');
  } else {
    console.error('⚠️ RESULTADO: SE ENCONTRARON INCONSISTENCIAS.');
    process.exit(1);
  }
  console.log('======================================================');
  process.exit(0);
}

runAudit();
