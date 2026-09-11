#!/usr/bin/env node
/**
 * bin/test-rbac-granular.js
 * Test Suite Automatizado para el Subsistema RBAC Dinámico y Permisos Granulares
 */

const {
  hasPermission,
  formatPermissionError,
  getAllPermissions,
  getRolesForTenant,
  getUserPermissions,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole
} = require('../lib/rbac');
const { query } = require('../lib/db');

console.log('======================================================');
console.log('TEST SUITE: SISTEMA RBAC DINAMICO Y PERMISOS GRANULARES');
console.log('======================================================');

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

async function runTests() {
  // -----------------------------------------------------------
  // 1. Validaciones lógicas en memoria de hasPermission
  // -----------------------------------------------------------
  console.log('\n--- 1. Evaluacion Logica de hasPermission ---');

  const superUser = {
    role: 'SUPERADMIN',
    permissions: ['*']
  };
  assert(hasPermission(superUser, 'kanban:orders:read'), 'Superadmin tiene permiso de kanban:orders:read via wildcard');
  assert(hasPermission(superUser, '4see:pricing:write'), 'Superadmin tiene permiso de 4see:pricing:write via wildcard');
  assert(hasPermission(superUser, 'nonexistent:module:action'), 'Superadmin tiene acceso total ante cualquier clave');

  const adminUser = {
    role: 'ADMIN',
    permissions: ['core:users:read', 'core:users:manage', 'kanban:orders:read', '4see:catalog:read']
  };
  assert(hasPermission(adminUser, 'core:users:read'), 'Admin con core:users:read tiene permiso');
  assert(hasPermission(adminUser, 'kanban:orders:read'), 'Admin con kanban:orders:read tiene permiso');
  assert(!hasPermission(adminUser, 'tenant:tenants:manage'), 'Admin sin tenant:tenants:manage es denegado');
  assert(!hasPermission(adminUser, '4see:margins:manage'), 'Admin sin 4see:margins:manage es denegado');

  const operatorUser = {
    role: 'OPERATOR',
    permissions: ['kanban:orders:read', 'scanner:items:scan']
  };
  assert(hasPermission(operatorUser, 'scanner:items:scan'), 'Operator tiene scanner:items:scan');
  assert(!hasPermission(operatorUser, 'kanban:orders:assign'), 'Operator no puede asignar pedidos');
  assert(!hasPermission(operatorUser, 'core:users:manage'), 'Operator no puede administrar usuarios');

  // Test wildcard por modulo (ej: '4see:*')
  const moduleScopedUser = {
    role: 'CUSTOM',
    permissions: ['4see:*']
  };
  assert(hasPermission(moduleScopedUser, '4see:pricing:write'), 'Usuario con 4see:* tiene 4see:pricing:write');
  assert(hasPermission(moduleScopedUser, '4see:margins:manage'), 'Usuario con 4see:* tiene 4see:margins:manage');
  assert(!hasPermission(moduleScopedUser, 'core:users:read'), 'Usuario con 4see:* no puede acceder a core');

  // -----------------------------------------------------------
  // 2. Formato del contrato canonico de error 403
  // -----------------------------------------------------------
  console.log('\n--- 2. Contrato Canonico de Error 403 ---');
  const errObj = formatPermissionError('4see:pricing:write');
  assert(errObj.code === 'INSUFFICIENT_PERMISSIONS', 'Codigo de error es INSUFFICIENT_PERMISSIONS');
  assert(errObj.required_permission === '4see:pricing:write', 'required_permission es exacto');
  assert(errObj.module === '4see', 'Modulo inferido correctamente como 4see');
  assert(typeof errObj.timestamp === 'string', 'Timestamp RFC3339 presente');
  assert(errObj.message.includes('4see:pricing:write'), 'Mensaje amigable incluye la clave de permiso');

  // -----------------------------------------------------------
  // 3. Integracion con PostgreSQL (Roles y Permisos persistidos)
  // -----------------------------------------------------------
  console.log('\n--- 3. Verificacion en Base de Datos PostgreSQL ---');
  try {
    const allPerms = await getAllPermissions();
    assert(Array.isArray(allPerms) && allPerms.length >= 20, `Catalogo de permisos cargado desde DB (${allPerms.length} permisos)`);

    const hasCoreRead = allPerms.some(p => p.key === 'core:users:read');
    const hasKanbanRead = allPerms.some(p => p.key === 'kanban:orders:read');
    const has4seeMargins = allPerms.some(p => p.key === '4see:margins:manage');
    assert(hasCoreRead && hasKanbanRead && has4seeMargins, 'Permisos canonicos verificados en catalogo');

    // Consultar roles para tenant poke
    const pokeTenant = await query("SELECT id FROM tenants WHERE slug = 'poke'");
    const pokeTenantId = (pokeTenant && pokeTenant[0]) ? pokeTenant[0].id : '550e8400-e29b-41d4-a716-446655440001';
    const pokeRoles = await getRolesForTenant(pokeTenantId);
    assert(Array.isArray(pokeRoles) && pokeRoles.length >= 2, `Roles del sistema descubiertos para tenant poke (${pokeRoles.length} roles)`);

    // Probar ciclo de vida de rol personalizado
    console.log('\n--- 4. Ciclo de Vida de Rol Personalizado (CRUD) ---');
    const customRoleName = 'Auditor de Precios Test';
    const customRoleSlug = 'test_pricing_auditor';
    const customRolePerms = ['4see:catalog:read', '4see:catalog:audit'];

    const created = await createCustomRole({
      tenantId: pokeTenantId,
      name: customRoleName,
      slug: customRoleSlug,
      description: 'Rol de prueba automatizada para auditorias de precios',
      permissions: customRolePerms
    });

    assert(created && created.id, 'Rol personalizado creado exitosamente en PostgreSQL');
    assert(created.is_system === false, 'Rol marcado correctamente como no-sistema (personalizado)');

    const postCreateRoles = await getRolesForTenant(pokeTenantId);
    const foundRole = postCreateRoles.find(r => r.id === created.id);
    assert(foundRole !== undefined, 'Rol personalizado visible en la lista de roles del tenant');
    assert(
      Array.isArray(foundRole.permissions) &&
      foundRole.permissions.includes('4see:catalog:read') &&
      foundRole.permissions.includes('4see:catalog:audit'),
      'Permisos asignados al rol coinciden con lo persistido'
    );

    // Actualizar rol
    const updated = await updateCustomRole({
      roleId: created.id,
      tenantId: pokeTenantId,
      name: 'Auditor de Precios y Margenes Test',
      description: 'Actualizado con margen',
      permissions: ['4see:catalog:read', '4see:catalog:audit', '4see:margins:manage']
    });
    assert(updated && updated.permissions.includes('4see:margins:manage'), 'Rol actualizado con nuevo permiso 4see:margins:manage');

    // Limpiar / Eliminar rol creado para dejar la base de datos limpia
    const deleted = await deleteCustomRole(created.id, pokeTenantId);
    assert(deleted && deleted.success, 'Rol personalizado eliminado exitosamente');

    const finalRoles = await getRolesForTenant(pokeTenantId);
    assert(!finalRoles.some(r => r.id === created.id), 'Rol no figura mas en el catalogo del tenant');

  } catch (err) {
    console.error('Error en pruebas de base de datos:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
