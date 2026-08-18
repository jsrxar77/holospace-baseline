/**
 * Test Suite: Jerarquía de Temas Multi-Tenant (Tenant Default vs User Preference)
 * Valida:
 * 1. Definición de tema base a nivel Tenant (Scope: 'tenant').
 * 2. Herencia automática del tema del Tenant para usuarios sin preferencia personal.
 * 3. Sobrescritura de tema a nivel Usuario Individual (Scope: 'user').
 * 4. Aislamiento estricto entre usuarios del mismo Tenant.
 */

const { execute, getOne, query } = require('../lib/db');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

async function requestJson(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('======================================================');
  console.log('🧪 TEST SUITE: JERARQUÍA DE TEMAS (TENANT VS USUARIO)');
  console.log('======================================================\n');

  try {
    // 1. Obtener Tenant de prueba (Poke Argentina)
    const pokeTenant = await getOne("SELECT id FROM tenants WHERE slug = 'poke'", [], { isSuperAdmin: true });
    assert(pokeTenant && pokeTenant.id, 'Tenant Poke Argentina recuperado');

    // 2. Definir tema por defecto para Poke (Cyberpunk Glassmorphism) como SuperAdmin (scope: 'tenant')
    console.log('\n--- 1. Definición de Tema Base del Tenant (Scope: Tenant) ---');
    const setTenantThemeRes = await requestJson('POST', '/api/theme', {
      themeKey: 'cyberpunk_glassmorphism',
      scope: 'tenant',
      targetTenantId: pokeTenant.id
    }, {
      'Authorization': 'Bearer superadmin@holospace.com.ar'
    });

    assert(setTenantThemeRes.status === 200, 'Endpoint POST /api/theme respondió 200 para scope tenant');
    assert(setTenantThemeRes.data.success === true, 'Tema base del Tenant guardado con éxito');
    assert(setTenantThemeRes.data.themeKey === 'cyberpunk_glassmorphism', 'Tema guardado es cyberpunk_glassmorphism');

    // 3. Consultar tema como usuario Juan de Poke (sin preferencia personal) -> Debe heredar cyberpunk
    console.log('\n--- 2. Herencia del Tema Base por Usuario sin Preferencia ---');
    const juanThemeRes = await requestJson('GET', '/api/theme', null, {
      'Authorization': 'Bearer juan@poke.com.ar'
    });

    assert(juanThemeRes.status === 200, 'GET /api/theme respondió 200 para juan@poke.com.ar');
    assert(juanThemeRes.data.themeKey === 'cyberpunk_glassmorphism', 'Juan hereda correctamente el tema base del Tenant (Cyberpunk)');

    // 4. Juan cambia su tema personal a 'dark_glassmorphism' (scope: 'user')
    console.log('\n--- 3. Preferencia Personal de Usuario (Scope: User) ---');
    const setJuanPersonalThemeRes = await requestJson('POST', '/api/theme', {
      themeKey: 'dark_glassmorphism',
      scope: 'user'
    }, {
      'Authorization': 'Bearer juan@poke.com.ar'
    });

    assert(setJuanPersonalThemeRes.status === 200, 'POST /api/theme respondió 200 para preferencia de Juan');
    assert(setJuanPersonalThemeRes.data.scope === 'user', 'Scope de respuesta es user');

    // 5. Verificar que Juan ahora tiene su tema personal
    const juanUpdatedThemeRes = await requestJson('GET', '/api/theme', null, {
      'Authorization': 'Bearer juan@poke.com.ar'
    });
    assert(juanUpdatedThemeRes.data.themeKey === 'dark_glassmorphism', 'Juan ahora ve su tema personal (Dark Glassmorphism)');

    // 6. Verificar que Vanesa (otra usuaria de Poke) sigue viendo el tema base del Tenant (Cyberpunk)
    console.log('\n--- 4. Aislamiento Estricto entre Usuarios del Mismo Tenant ---');
    const vanesaThemeRes = await requestJson('GET', '/api/theme', null, {
      'Authorization': 'Bearer vanesa@poke.com.ar'
    });
    assert(vanesaThemeRes.data.themeKey === 'cyberpunk_glassmorphism', 'Vanesa NO se ve afectada por el cambio de Juan y mantiene el tema del Tenant');

    // 7. Limpieza: restaurar tema base de Poke a omarchy_tiling y resetear preferencia de Juan
    await execute("UPDATE users SET theme_preference = NULL WHERE LOWER(email) = 'juan@poke.com.ar'", [], { isSuperAdmin: true });
    await execute("INSERT INTO app_settings (tenant_id, key, value) VALUES (?, 'active_theme', 'omarchy_tiling') ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'omarchy_tiling'", [pokeTenant.id], { isSuperAdmin: true });

  } catch (err) {
    console.error('Error durante la ejecución de los tests:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 RESULTADOS: ${passed} Aprobados | ${failed} Fallidos`);
  if (failed === 0) {
    console.log('🎉 FASE 8: MOTOR DE TEMAS HIERÁRQUICO (TENANT VS USUARIO) 100% OPERATIVO.');
  } else {
    console.error('⚠️ ALGUNOS TESTS FALLARON.');
    process.exit(1);
  }
  console.log('======================================================');
}

runTests();
