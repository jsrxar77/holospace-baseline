/**
 * lib/rbac.js - HoloSpace Baseline RBAC & Fine-Grained Permissions Engine
 * Control de acceso dinámico basado en permisos granulares URN (<modulo>:<recurso>:<accion>)
 * y gestión de roles de sistema y personalizados por organización.
 */

const { query, getOne, execute } = require('./db');

/**
 * Catálogo estático de respaldo para inicialización y fallback rápido
 */
const DEFAULT_SYSTEM_PERMISSIONS = {
  superadmin: ['*'],
  tenant_admin: [
    'tenant:tenants:read', 'tenant:tenants:manage', 'tenant:quotas:manage', 'tenant:modules:manage', 'core:audit:read'
  ],
  core_admin: [
    'core:users:read', 'core:users:manage', 'core:roles:read', 'core:roles:manage', 'core:audit:read', 'core:theme:manage'
  ],
  kanban_admin: [
    'core:users:read', 'core:users:manage', 'core:audit:read',
    'kanban:orders:read', 'kanban:orders:ingest', 'kanban:orders:assign', 'kanban:orders:dispatch',
    'scanner:orders:view_assigned', 'scanner:items:scan', 'scanner:items:verify'
  ],
  kanban_operator: [
    'kanban:orders:read', 'kanban:orders:dispatch'
  ],
  scanner_operator: [
    'scanner:orders:view_assigned', 'scanner:items:scan', 'scanner:items:verify'
  ],
  '4see_admin': [
    'core:users:read', 'core:users:manage', 'core:audit:read',
    '4see:catalog:read', '4see:catalog:audit', '4see:pricing:write', '4see:margins:manage'
  ],
  '4see_user': [
    '4see:catalog:read', '4see:catalog:audit'
  ],
  // Aliases de compatibilidad
  admin: [
    'core:users:read', 'core:users:manage', 'core:roles:read', 'core:roles:manage', 'core:audit:read', 'core:theme:manage',
    'kanban:orders:read', 'kanban:orders:ingest', 'kanban:orders:assign', 'kanban:orders:dispatch',
    'scanner:items:scan', 'scanner:items:verify', 'scanner:orders:view_assigned',
    '4see:catalog:read', '4see:catalog:audit', '4see:pricing:write', '4see:margins:manage'
  ],
  operator: [
    'scanner:orders:view_assigned', 'scanner:items:scan', 'scanner:items:verify'
  ]
};

/**
 * Evalúa si una lista de permisos otorgados satisface el permiso requerido.
 * Soporta comodín global ('*') y comodines por módulo (ej: 'kanban:*' satisface 'kanban:orders:read').
 * Complejidad O(1) a O(N) acotada en memoria.
 *
 * @param {Array<string>} userPermissions - Lista de permisos del usuario.
 * @param {string} requiredPermission - Permiso requerido (ej: 'kanban:orders:dispatch').
 * @returns {boolean}
 */
function hasPermission(userOrPermissions, requiredPermission) {
  let userPermissions = userOrPermissions;
  if (userOrPermissions && typeof userOrPermissions === 'object' && !Array.isArray(userOrPermissions)) {
    if (userOrPermissions.role === 'SUPERADMIN') return true;
    userPermissions = userOrPermissions.permissions;
  }

  if (!userPermissions || !Array.isArray(userPermissions) || userPermissions.length === 0) {
    return false;
  }

  if (!requiredPermission) return true;

  // 1. Acceso Total Irrestricto
  if (userPermissions.includes('*')) {
    return true;
  }

  // 2. Coincidencia exacta
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // 3. Coincidencia por Wildcards (ej: 'kanban:*' o 'kanban:orders:*')
  for (const perm of userPermissions) {
    if (perm.endsWith(':*')) {
      const prefix = perm.slice(0, -2);
      if (requiredPermission.startsWith(prefix + ':') || requiredPermission === prefix) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Genera el payload de error 403 estandarizado y centralizado
 *
 * @param {string} requiredPermission - Clave del permiso faltante.
 * @param {string} [customMessage] - Mensaje adicional o contextual opcional.
 * @returns {object}
 */
function formatPermissionError(requiredPermission, customMessage) {
  const moduleCode = (requiredPermission && requiredPermission.includes(':'))
    ? requiredPermission.split(':')[0]
    : 'core';

  return {
    error: 'Acceso denegado: Permisos insuficientes',
    code: 'INSUFFICIENT_PERMISSIONS',
    required_permission: requiredPermission,
    module: moduleCode,
    message: customMessage || `No posees el permiso requerido [${requiredPermission}] para realizar esta acción. Solicita autorización al administrador de tu organización.`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Helper para responder HTTP 403 con el payload centralizado
 */
function sendPermissionError(res, requiredPermission, customMessage) {
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(formatPermissionError(requiredPermission, customMessage)));
}

/**
 * Obtiene los permisos asociados a un rol específico desde la base de datos
 */
async function getPermissionsForRole(roleId) {
  if (!roleId) return [];
  try {
    const rows = await query(
      'SELECT permission_key FROM core_role_permissions WHERE role_id = ?',
      [roleId],
      { isSuperAdmin: true }
    );
    return rows.map(r => r.permission_key);
  } catch (err) {
    console.error('[RBAC] Error al consultar permisos de rol:', err.message);
    return [];
  }
}

/**
 * Resuelve y compila la lista completa de permisos para un usuario dado.
 * Prioriza permisos del token/rol, luego consulta base de datos, y si no hay rol asignado
 * aplica el catálogo de fallback según user.role.
 *
 * @param {object} user - Objeto de usuario autenticado.
 * @returns {Promise<Array<string>>}
 */
async function getUserPermissions(user) {
  if (!user) return [];

  // SuperAdmin global siempre tiene wildcard '*'
  const roleCode = (user.role || '').toUpperCase();
  if (roleCode === 'SUPERADMIN') {
    return ['*'];
  }

  // Si el usuario ya trae sus permisos compilados en la sesión/JWT
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }

  // Si posee role_id, consultar en core_role_permissions
  if (user.role_id) {
    const perms = await getPermissionsForRole(user.role_id);
    if (perms && perms.length > 0) {
      return perms;
    }
  }

  // Si no tiene role_id o está vacío, consultar rol por código o usar fallback
  try {
    const roleRow = await getOne(
      'SELECT id FROM core_roles WHERE LOWER(code) = ? AND (tenant_id IS NULL OR tenant_id = ?)',
      [(user.role || 'operator').toLowerCase(), user.tenant_id || user.tenantId],
      { isSuperAdmin: true }
    );
    if (roleRow) {
      const perms = await getPermissionsForRole(roleRow.id);
      if (perms && perms.length > 0) return perms;
    }
  } catch (e) { }

  // Fallback seguro a roles estáticos de sistema
  const fallbackKey = (user.role || 'operator').toLowerCase();
  return DEFAULT_SYSTEM_PERMISSIONS[fallbackKey] || DEFAULT_SYSTEM_PERMISSIONS.operator;
}

/**
 * Retorna el catálogo completo de permisos clasificados por módulo
 */
async function getAllPermissions() {
  try {
    const rows = await query(
      'SELECT key, module_code, name, description, category FROM core_permissions ORDER BY module_code, key ASC',
      [],
      { isSuperAdmin: true }
    );
    return rows;
  } catch (err) {
    console.error('[RBAC] Error al obtener catálogo de permisos:', err.message);
    return [];
  }
}

/**
 * Lista todos los roles disponibles para el tenant actual (roles de sistema + personalizados)
 */
async function getRolesForTenant(tenantId, isSuperAdmin = false) {
  try {
    let sql = `
      SELECT r.id, r.tenant_id, r.code, r.name, r.description, r.is_system, r.created_at,
             COUNT(DISTINCT u.id) as user_count
      FROM core_roles r
      LEFT JOIN core_users u ON u.role_id = r.id
      WHERE (r.tenant_id IS NULL OR r.tenant_id = ?)
      GROUP BY r.id, r.tenant_id, r.code, r.name, r.description, r.is_system, r.created_at
      ORDER BY r.is_system DESC, r.name ASC
    `;
    let params = [tenantId];

    if (isSuperAdmin) {
      sql = `
        SELECT r.id, r.tenant_id, r.code, r.name, r.description, r.is_system, r.created_at,
               COUNT(DISTINCT u.id) as user_count
        FROM core_roles r
        LEFT JOIN core_users u ON u.role_id = r.id
        GROUP BY r.id, r.tenant_id, r.code, r.name, r.description, r.is_system, r.created_at
        ORDER BY r.is_system DESC, r.name ASC
      `;
      params = [];
    }

    const roles = await query(sql, params, { isSuperAdmin: true });

    // Enriquecer cada rol con su lista de permisos y alias slug
    for (const role of roles) {
      role.slug = role.code;
      role.user_count = parseInt(role.user_count || 0, 10);
      const perms = await query(
        'SELECT permission_key FROM core_role_permissions WHERE role_id = ?',
        [role.id],
        { isSuperAdmin: true }
      );
      role.permissions = perms.map(p => p.permission_key);
    }

    return roles;
  } catch (err) {
    console.error('[RBAC] Error al listar roles para tenant:', err.message);
    return [];
  }
}

/**
 * Crea un nuevo rol personalizado para un tenant específico
 */
async function createCustomRole(arg1, arg2) {
  let tenantId, code, slug, name, description, permissions;
  if (typeof arg1 === 'object' && !arg2) {
    ({ tenantId, code, slug, name, description, permissions } = arg1);
  } else {
    tenantId = arg1;
    ({ code, slug, name, description, permissions } = arg2 || {});
  }

  if (!tenantId) throw new Error('Se requiere tenant_id para crear un rol personalizado');
  if (!name || !name.trim()) throw new Error('El nombre del rol es obligatorio');

  const rawCode = code || slug || name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const normalizedCode = rawCode.trim();

  // Verificar unicidad en el tenant
  const existing = await getOne(
    'SELECT id FROM core_roles WHERE tenant_id = ? AND code = ?',
    [tenantId, normalizedCode],
    { isSuperAdmin: true }
  );
  if (existing) {
    throw new Error(`Ya existe un rol con el código [${normalizedCode}] en esta organización`);
  }

  // Insertar rol
  const insertRoleSql = `
    INSERT INTO core_roles (tenant_id, code, name, description, is_system)
    VALUES (?, ?, ?, ?, false)
    RETURNING id, tenant_id, code, name, description, is_system, created_at
  `;
  const newRole = await getOne(insertRoleSql, [tenantId, normalizedCode, name.trim(), description || null], { isSuperAdmin: true });

  // Asignar permisos si fueron provistos
  if (Array.isArray(permissions) && permissions.length > 0) {
    for (const permKey of permissions) {
      await execute(
        'INSERT INTO core_role_permissions (role_id, permission_key) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [newRole.id, permKey],
        { isSuperAdmin: true }
      );
    }
  }

  newRole.slug = newRole.code;
  newRole.permissions = Array.isArray(permissions) ? permissions : [];
  return newRole;
}

/**
 * Actualiza un rol personalizado
 */
async function updateCustomRole(arg1, arg2, arg3, arg4) {
  let roleId, tenantId, name, description, permissions, isSuperAdmin;
  if (typeof arg1 === 'object' && !arg2) {
    ({ roleId, tenantId, name, description, permissions, isSuperAdmin } = arg1);
  } else {
    roleId = arg1;
    tenantId = arg2;
    ({ name, description, permissions } = arg3 || {});
    isSuperAdmin = !!arg4;
  }

  const role = await getOne('SELECT * FROM core_roles WHERE id = ?', [roleId], { isSuperAdmin: true });
  if (!role) throw new Error('Rol no encontrado');

  if (role.is_system && !isSuperAdmin) {
    throw new Error('Los roles del sistema son inmutables y no pueden modificarse por organizaciones.');
  }

  if (!isSuperAdmin && tenantId && role.tenant_id !== tenantId) {
    throw new Error('No tienes permisos para modificar roles de otra organización.');
  }

  if (name && name.trim()) {
    await execute(
      'UPDATE core_roles SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), description || null, roleId],
      { isSuperAdmin: true }
    );
  }

  // Actualizar permisos si se especifica la lista
  if (Array.isArray(permissions)) {
    await execute('DELETE FROM core_role_permissions WHERE role_id = ?', [roleId], { isSuperAdmin: true });
    for (const permKey of permissions) {
      await execute(
        'INSERT INTO core_role_permissions (role_id, permission_key) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [roleId, permKey],
        { isSuperAdmin: true }
      );
    }
  }

  return { success: true, id: roleId, permissions: permissions || [] };
}

/**
 * Elimina un rol personalizado (valida que no sea del sistema ni tenga usuarios asignados)
 */
async function deleteCustomRole(roleId, tenantId, isSuperAdmin = false) {
  const role = await getOne('SELECT * FROM core_roles WHERE id = ?', [roleId], { isSuperAdmin: true });
  if (!role) throw new Error('Rol no encontrado');

  if (role.is_system) {
    throw new Error('Los roles nativos del sistema no pueden ser eliminados.');
  }

  if (!isSuperAdmin && role.tenant_id !== tenantId) {
    throw new Error('No tienes permisos para eliminar roles de otra organización.');
  }

  const assignedUsers = await query(
    'SELECT id, email FROM core_users WHERE role_id = ?',
    [roleId],
    { isSuperAdmin: true }
  );
  if (assignedUsers.length > 0) {
    throw new Error(`No se puede eliminar el rol porque tiene ${assignedUsers.length} usuario(s) asignado(s). Reasigna los usuarios antes de eliminarlo.`);
  }

  await execute('DELETE FROM core_roles WHERE id = ?', [roleId], { isSuperAdmin: true });
  return { success: true, message: 'Rol eliminado correctamente' };
}

module.exports = {
  hasPermission,
  formatPermissionError,
  sendPermissionError,
  getPermissionsForRole,
  getUserPermissions,
  getAllPermissions,
  getRolesForTenant,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  DEFAULT_SYSTEM_PERMISSIONS
};
