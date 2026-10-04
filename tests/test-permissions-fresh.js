/**
 * Core: los permisos se recalculan en cada pedido y no se confian al JWT (un permiso guardado al iniciar sesion
 * no sigue valiendo si el rol ya no lo tiene), y /api/users/me informa los permisos vigentes.
 */
const http = require('http');
const crypto = require('crypto');
const { signJwt } = require('../lib/auth');
const { execute, getOne } = require('../lib/db');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };

function req(method, p, token) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: '127.0.0.1', port: 3001, path: p, method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) {} resolve({ status: res.statusCode, json: j }); });
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  const tenantId = crypto.randomUUID();
  const stamp = Date.now();
  const email = `permisos_${stamp}@prueba.com`;
  try {
    await execute('INSERT INTO tenant_tenants (id, slug, name) VALUES (?, ?, ?)', [tenantId, `permisos-${stamp}`, `Permisos ${stamp}`], { isSuperAdmin: true });
    await execute(
      'INSERT INTO core_users (id, tenant_id, username, email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, true)',
      [crypto.randomUUID(), tenantId, `permisos_${stamp}`, email, 'x', 'Solo Lectura', 'OPERATOR'], { isSuperAdmin: true }
    );
    const claims = { sub: email, email, role: 'OPERATOR', tenantId, tenantSlug: `permisos-${stamp}` };

    const stale = signJwt({ ...claims, permissions: ['*'] }, 600);

    console.log('Los permisos vigentes salen de la base');
    const fresh = signJwt({ ...claims, permissions: [] }, 600);
    const me = await req('GET', '/api/users/me', fresh);
    ok(me.status === 200 && me.json.success && Array.isArray(me.json.user.permissions), 'users/me devuelve los permisos');
    ok(!me.json.user.permissions.includes('*') && !me.json.user.permissions.includes('4see:queue:approve'), 'un operador no recibe permisos de 4see ni comodin');
    const meStale = await req('GET', '/api/users/me', stale);
    ok(!meStale.json.user.permissions.includes('*') && meStale.json.user.permissions.join() === me.json.user.permissions.join(), 'un token que trae "*" guardado no lo conserva: ve lo mismo que un token sin permisos');
    const anon = await req('GET', '/api/users/me', 'no-es-un-token');
    ok(anon.status === 401, 'sin sesion valida users/me responde 401');
  } catch (err) {
    console.error('Error inesperado:', err);
    failed++;
  } finally {
    await execute('DELETE FROM core_users WHERE tenant_id = ?', [tenantId], { isSuperAdmin: true }).catch(() => {});
    await execute('DELETE FROM tenant_tenants WHERE id = ?', [tenantId], { isSuperAdmin: true }).catch(() => {});
  }
  console.log(failed ? `\n${failed} FALLARON` : '\nPermisos vigentes OK');
  process.exit(failed ? 1 : 0);
})();
