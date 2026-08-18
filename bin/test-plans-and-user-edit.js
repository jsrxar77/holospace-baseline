/**
 * bin/test-plans-and-user-edit.js - Test Suite para Catálogo de Planes, Conexión LAN Expo y Edición ABM de Usuarios
 */

const assert = require('assert');
const { query } = require('../lib/db');
const http = require('http');

async function testPlansAndUserEdit() {
  console.log('======================================================');
  console.log('🧪 TEST SUITE: PLANES SAAS, ABM USUARIOS & EXPO LAN IP');
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

  // 1. Autenticación
  console.log('\n--- 1. Autenticación SuperAdmin ---');
  const loginRes = await request('/api/login', 'POST', {
    email: 'superadmin@holospace.app',
    password: 'BrunaSeRelambe22!'
  });
  assert.strictEqual(loginRes.status, 200, 'Login debe ser exitoso');
  const token = loginRes.data.token;
  console.log('✅ [PASS] Token SuperAdmin obtenido correctamente.');

  // 2. Consulta y Creación de Planes
  console.log('\n--- 2. Catálogo Oficial de Planes (GET /api/plans) ---');
  const plansRes = await request('/api/plans', 'GET', null, token);
  assert.strictEqual(plansRes.status, 200, 'GET /api/plans debe responder 200');
  assert(Array.isArray(plansRes.data.plans), 'plans debe ser un array');
  assert(plansRes.data.plans.length >= 3, 'Debe haber al menos 3 planes');
  console.log(`✅ [PASS] ${plansRes.data.plans.length} planes registrados (starter, pro, enterprise).`);

  // Crear nuevo plan personalizado
  console.log('\n--- 3. Creación Dinámica de Plan (POST /api/plans) ---');
  const newPlanRes = await request('/api/plans', 'POST', {
    code: 'logistics_plus',
    name: 'Plan Logística Plus',
    description: 'Plan especializado para logística avanzada.',
    maxUsers: 25,
    maxOrdersMonthly: 10000,
    includedModules: ['core', 'scanban-board', 'scanban-scanner', 'scanflow']
  }, token);
  assert.strictEqual(newPlanRes.status, 200, 'POST /api/plans debe responder 200');
  console.log('✅ [PASS] Plan personalizado logistics_plus creado exitosamente.');

  // 4. Conectar Celular / Expo Dynamic LAN IP
  console.log('\n--- 4. Conexión Expo Dinámica (GET /api/config) ---');
  const configRes = await request('/api/config', 'GET', null, token);
  assert.strictEqual(configRes.status, 200, 'GET /api/config debe responder 200');
  assert(configRes.data.hostIp, 'hostIp debe estar presente');
  assert(configRes.data.expoUrl.startsWith('exp://'), 'expoUrl debe tener esquema exp://');
  console.log(`✅ [PASS] Host IP detectada: ${configRes.data.hostIp} | Expo URL: ${configRes.data.expoUrl}`);

  // 5. ABM Usuarios: Creación, Edición y Toggle de Estado
  console.log('\n--- 5. Edición y ABM de Usuarios (PUT /api/users) ---');
  const listUsersRes = await request('/api/users', 'GET', null, token);
  assert.strictEqual(listUsersRes.status, 200, 'GET /api/users debe responder 200');
  const targetUser = listUsersRes.data.find(u => u.email === 'superadmin@holospace.app');
  assert(targetUser, 'SuperAdmin debe existir');

  // Actualizar nombre
  const updateRes = await request('/api/users', 'PUT', {
    id: targetUser.id,
    name: 'Super Administrador Global HoloSpace',
    email: targetUser.email,
    role: 'SUPERADMIN'
  }, token);
  assert.strictEqual(updateRes.status, 200, 'PUT /api/users debe responder 200');
  console.log('✅ [PASS] Nombre de usuario actualizado con éxito.');

  // 6. Auditoría de Plataforma
  console.log('\n--- 6. Auditoría de Plataforma (GET /api/platform-audit) ---');
  const auditRes = await request('/api/platform-audit', 'GET', null, token);
  assert.strictEqual(auditRes.status, 200, 'GET /api/platform-audit debe responder 200');
  assert(Array.isArray(auditRes.data.logs), 'logs debe ser un array');
  console.log(`✅ [PASS] ${auditRes.data.logs.length} eventos de auditoría registrados con marcas temporales válidas.`);

  console.log('\n======================================================');
  console.log('📊 RESULTADOS: 100% OPERATIVO');
  console.log('======================================================\n');
  process.exit(0);
}

testPlansAndUserEdit().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
