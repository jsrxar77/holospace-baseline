/**
 * Core: visibilidad de modulos y pestanas segun plan y permisos (public/access.js). No requiere base de datos.
 */
const { computeAccess, firstTab, decodeClaims } = require('../public/access.js');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };

const FOUR_ADMIN = ['4see:catalog:audit', '4see:catalog:read', '4see:margins:manage', '4see:pricing:write', '4see:queue:approve', '4see:rules:manage', 'core:audit:read', 'core:users:manage', 'core:users:read'];
const FOUR_USER = ['4see:catalog:audit', '4see:catalog:read'];
const KANBAN_ADMIN = ['core:audit:read', 'core:users:manage', 'core:users:read', 'kanban:orders:assign', 'kanban:orders:dispatch', 'kanban:orders:ingest', 'kanban:orders:read', 'scanner:items:scan', 'scanner:items:verify', 'scanner:orders:view_assigned'];

console.log('Administrador de 4see con plan de 4see (el caso de una cuenta nueva)');
let a = computeAccess({ role: '4SEE_ADMIN' }, { entitlements: ['core', '4see'], permissions: FOUR_ADMIN });
ok(a.modules['4see'] === true && a.modules.kanban === false, 've 4see y no ve Kanban');
ok(a.modules.tenant === false && a.modules.core === false, 'no ve Tenant ni Core');
ok(a.defaultModule === '4see' && a.defaultTab === '4see-productos', 'entra a 4see > Productos, no a Kanban');
ok(a.tabs['4see-productos'], 've la pestana unica de 4see (Productos)');
ok(a.tabs.kanban === false && a.tabs.orders === false, 'no ve pestanas de Kanban');

console.log('Usuario de 4see con permisos de solo lectura de catalogo');
a = computeAccess({ role: '4SEE_USER' }, { entitlements: ['core', '4see'], permissions: FOUR_USER });
ok(a.tabs['4see-productos'], 've Productos (los pasos se ven dentro de la pantalla)');
ok(a.tabs['4see-productos'] === true, 'el usuario de solo lectura entra igual a Productos');

console.log('Administrador de logistica');
a = computeAccess({ role: 'KANBAN_ADMIN' }, { entitlements: ['core', 'kanban', 'scanner'], permissions: KANBAN_ADMIN });
ok(a.modules.kanban === true && a.modules['4see'] === false, 've Kanban y no ve 4see');
ok(a.defaultModule === 'kanban' && a.defaultTab === 'kanban', 'entra a Kanban > Tablero');

console.log('Organizacion con las dos lineas');
a = computeAccess({ role: 'CORE_ADMIN' }, { entitlements: ['core', 'kanban', 'scanner', '4see'], permissions: [...new Set([...KANBAN_ADMIN, ...FOUR_ADMIN])] });
ok(a.modules.kanban && a.modules['4see'], 've ambos modulos');
ok(a.defaultModule === 'kanban', 'entra al primero disponible (Kanban)');

console.log('El plan o el rol no alcanzan');
a = computeAccess({ role: 'OPERATOR' }, { entitlements: ['core', 'kanban'], permissions: ['scanner:items:scan'] });
ok(a.modules.kanban === false && a.defaultModule === null, 'plan con Kanban pero rol sin permisos de Kanban: no ve nada');
a = computeAccess({ role: '4SEE_ADMIN' }, { entitlements: ['core', 'kanban'], permissions: FOUR_ADMIN });
ok(a.modules['4see'] === false, 'permisos de 4see sin plan de 4see: no ve 4see');
a = computeAccess({ role: 'X' }, { entitlements: [], permissions: [] });
ok(Object.values(a.modules).every((v) => v === false) && a.defaultModule === null, 'sin plan ni permisos: ningun modulo');
a = computeAccess({ role: 'X' }, null);
ok(a.defaultModule === null, 'sin claims no falla y no muestra modulos');

console.log('SUPERADMIN');
a = computeAccess({ role: 'SUPERADMIN' }, { entitlements: ['core', 'tenant'], permissions: ['*'] });
ok(a.modules.tenant && a.modules.core && a.modules['4see'], 've Tenant, Core y 4see');
ok(a.modules.kanban === false, 'no opera Kanban (modulo de clientes)');
ok(a.defaultModule === 'tenant', 'entra a Tenant');

console.log('Lectura del token');
const claims = { entitlements: ['core', '4see'], permissions: ['4see:catalog:read'], name: 'Pérez' };
const tok = 'x.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.y';
const d = decodeClaims(tok);
ok(d && d.entitlements[1] === '4see' && d.permissions[0] === '4see:catalog:read', 'decodeClaims devuelve entitlements y permisos');
ok(decodeClaims('basura') === null, 'decodeClaims tolera un token invalido');
ok(firstTab(computeAccess({ role: '4SEE_USER' }, d), '4see') === '4see-productos', 'firstTab devuelve la primera pestana permitida');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nVisibilidad por permisos OK');
process.exit(failed ? 1 : 0);
