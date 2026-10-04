/**
 * public/access.js: que modulos y pestanas muestra el menu para cada sesion.
 * Logica pura (sin DOM) que se usa en el navegador (window.HSAccess) y en los tests de Node.
 * La autorizacion real sigue en el servidor (RBAC y entitlements); esto solo evita mostrar lo que no se puede usar.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HSAccess = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Permisos que habilitan cada pestana (cualquiera de la lista; '*' del SUPERADMIN habilita todo)
  var TABS = {
    tenants: { module: 'tenant', any: ['*'] },
    platform: { module: 'core', any: ['*'] },
    users: { module: 'core', any: ['*'] },
    roles: { module: 'core', any: ['*'] },
    kanban: { module: 'kanban', any: ['kanban:orders:read'] },
    orders: { module: 'kanban', any: ['kanban:orders:read'] },
    '4see-productos': { module: '4see', prefix: '4see:' }
  };
  var MODULE_TABS = {
    tenant: ['tenants'],
    core: ['platform', 'users', 'roles'],
    kanban: ['kanban', 'orders'],
    '4see': ['4see-productos']
  };
  // Orden de entrada para quien no es SUPERADMIN: el primero que tenga disponible
  var ENTRY_ORDER = ['kanban', '4see'];

  function list(v) { return Array.isArray(v) ? v : []; }
  function hasPerm(perms, key) { return perms.indexOf('*') !== -1 || perms.indexOf(key) !== -1; }
  function hasPrefix(perms, prefix) {
    return perms.indexOf('*') !== -1 || perms.some(function (p) { return String(p).indexOf(prefix) === 0; });
  }

  /**
   * @param {{role?: string}} user
   * @param {{entitlements?: string[], permissions?: string[]}} claims  contenido del JWT
   */
  function computeAccess(user, claims) {
    var role = user && user.role;
    var perms = list(claims && claims.permissions);
    var ents = list(claims && claims.entitlements);
    var isSuper = role === 'SUPERADMIN';

    var tabs = {};
    Object.keys(TABS).forEach(function (key) {
      var def = TABS[key];
      var ok;
      if (isSuper) {
        // El SUPERADMIN gobierna la plataforma: Tenant, Core y 4see; no opera los modulos de clientes (Kanban)
        ok = def.module !== 'kanban';
      } else if (def.module === 'tenant' || def.module === 'core') {
        ok = false;
      } else {
        var entitled = ents.indexOf(def.module) !== -1;
        var permitted = def.prefix ? hasPrefix(perms, def.prefix) : list(def.any).some(function (p) { return hasPerm(perms, p); });
        ok = entitled && permitted;
      }
      tabs[key] = ok;
    });

    var modules = {};
    Object.keys(MODULE_TABS).forEach(function (m) {
      modules[m] = MODULE_TABS[m].some(function (t) { return tabs[t]; });
    });

    var order = isSuper ? ['tenant', 'core', '4see'] : ENTRY_ORDER;
    var defaultModule = null;
    for (var i = 0; i < order.length; i++) { if (modules[order[i]]) { defaultModule = order[i]; break; } }
    var defaultTab = defaultModule ? MODULE_TABS[defaultModule].filter(function (t) { return tabs[t]; })[0] || null : null;

    return { superadmin: isSuper, modules: modules, tabs: tabs, defaultModule: defaultModule, defaultTab: defaultTab };
  }

  function firstTab(access, module) {
    return (MODULE_TABS[module] || []).filter(function (t) { return access.tabs[t]; })[0] || null;
  }

  // Lee el contenido del JWT (sin verificar la firma: solo para la interfaz; el servidor verifica en cada peticion)
  function decodeClaims(token) {
    try {
      var part = String(token || '').split('.')[1];
      if (!part) return null;
      var b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  return { computeAccess: computeAccess, firstTab: firstTab, decodeClaims: decodeClaims, TABS: TABS, MODULE_TABS: MODULE_TABS };
});
