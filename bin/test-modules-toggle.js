/**
 * bin/test-modules-toggle.js - Test Suite para Activación y Desactivación de Módulos de Plataforma
 */

const assert = require('assert');
const { execute, query } = require('../lib/db');
const http = require('http');

async function testModuleToggling() {
  console.log('======================================================');
  console.log('🧪 TEST SUITE: ACTIVACIÓN/DESACTIVACIÓN DE MÓDULOS');
  console.log('======================================================');

  function request(path, method, data, token) {
    return new Promise((resolve, reject) => {
      const payload = data ? JSON.stringify(data) : '';
      const req = http.request(`http://127.0.0.1:3001${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': token ? `Bearer ${token}` : ''
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // 0. Autenticación como SuperAdmin
  const loginRes = await request('/api/login', 'POST', {
    email: 'superadmin@holospace.app',
    password: 'BrunaSeRelambe22!'
  });
  assert.strictEqual(loginRes.status, 200, 'Login SuperAdmin debe responder 200');
  const superAdminToken = loginRes.data.token;
  assert(superAdminToken, 'Debe devolver un token JWT válido');

  // 1. Listar módulos iniciales
  console.log('\n--- 1. Listado de Módulos (GET /api/modules) ---');
  const listRes = await request('/api/modules', 'GET', null, superAdminToken);
  assert.strictEqual(listRes.status, 200, 'GET /api/modules debe responder 200');
  assert.strictEqual(listRes.data.success, true, 'success debe ser true');
  assert(Array.isArray(listRes.data.modules), 'modules debe ser un array');
  console.log(`✅ [PASS] ${listRes.data.modules.length} módulos recuperados.`);

  // 2. Desactivar módulo kanban
  console.log('\n--- 2. Desactivar Módulo Kanban (POST /api/modules) ---');
  const deactRes = await request('/api/modules', 'POST', { key: 'kanban', active: false }, superAdminToken);
  assert.strictEqual(deactRes.status, 200, 'POST /api/modules debe responder 200');
  assert.strictEqual(deactRes.data.is_active, false, 'is_active debe ser false');
  console.log('✅ [PASS] Módulo scanflow desactivado con éxito.');

  // Verificar en DB
  const [scanflowDb] = await query("SELECT is_active, activated_by FROM modules WHERE key = 'kanban'", [], { isSuperAdmin: true });
  assert.strictEqual(scanflowDb.is_active, false, 'En base de datos is_active debe ser false');
  console.log('✅ [PASS] Estado en PostgreSQL 16 verificado como false.');

  // 3. Reactivar módulo kanban
  console.log('\n--- 3. Reactivar Módulo Kanban ---');
  const reactRes = await request('/api/modules', 'POST', { key: 'kanban', active: true }, superAdminToken);
  assert.strictEqual(reactRes.status, 200, 'POST /api/modules debe responder 200');
  assert.strictEqual(reactRes.data.is_active, true, 'is_active debe ser true');
  console.log('✅ [PASS] Módulo scanflow reactivado con éxito.');

  // 4. Intentar desactivar módulo Core (prohibido)
  console.log('\n--- 4. Intento de Desactivar Módulo Core ---');
  const coreRes = await request('/api/modules', 'POST', { key: 'core', active: false }, superAdminToken);
  assert.strictEqual(coreRes.status, 400, 'Desactivar Core debe ser rechazado con 400');
  console.log('✅ [PASS] Rechazo correcto de desactivación del módulo Core.');

  // 5. Auditoría de Plataforma
  console.log('\n--- 5. Registro en Auditoría de Plataforma ---');
  const auditRes = await request('/api/platform-audit', 'GET', null, superAdminToken);
  assert.strictEqual(auditRes.status, 200, 'GET /api/platform-audit debe responder 200');
  const hasModuleAction = auditRes.data.logs.some(l => l.action.startsWith('MODULE_'));
  assert(hasModuleAction, 'Los eventos de activación/desactivación deben estar auditados');
  console.log('✅ [PASS] Acciones registradas en platform_audit_logs.');

  console.log('\n======================================================');
  console.log('📊 RESULTADOS: 100% OPERATIVO');
  console.log('======================================================\n');
  process.exit(0);
}

testModuleToggling().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
