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

// Las credenciales de prueba pueden venir del entorno; los valores por defecto son los del seed de desarrollo.
const CREDS = {
  superadmin: [process.env.SUPERADMIN_EMAIL || 'superadmin@holospace.com.ar', process.env.SUPERADMIN_PASSWORD || 'BrunaSeRelambe22!'],
  juan: ['juan@poke.com.ar', process.env.TEST_JUAN_PASSWORD || 'juan2026'],
  vanesa: ['vanesa@poke.com.ar', process.env.TEST_VANESA_PASSWORD || 'vanesa2026']
};

async function loginToken(key) {
  const [email, password] = CREDS[key];
  const res = await requestJson('POST', '/api/login', { email, password });
  if (!res.data || !res.data.token) throw new Error(`Login fallido para ${email}: HTTP ${res.status}`);
  return res.data.token;
}

async function runTests() {
  const tokens = {
    superadmin: await loginToken('superadmin'),
    juan: await loginToken('juan'),
    vanesa: await loginToken('vanesa')
  };

  console.log('======================================================');
  console.log('🧪 TEST SUITE: JERARQUÍA DE TEMAS (TENANT VS USUARIO)');
  console.log('======================================================\n');

  try {
    // 1. Obtener Tenant de prueba (Poke Argentina)
    const pokeTenant = await getOne("SELECT id FROM tenant_tenants WHERE slug = 'poke'", [], { isSuperAdmin: true });
    assert(pokeTenant && pokeTenant.id, 'Tenant Poke Argentina recuperado');

    // 2. Definir tema por defecto para Poke (Holo Day) como SuperAdmin (scope: 'tenant')
    console.log('\n--- 1. Definición de Tema Base del Tenant (Scope: Tenant) ---');
    const setTenantThemeRes = await requestJson('POST', '/api/theme', {
      themeKey: 'holo_light',
      scope: 'tenant',
      targetTenantId: pokeTenant.id
    }, {
      'Authorization': `Bearer ${tokens.superadmin}`
    });

    assert(setTenantThemeRes.status === 200, 'Endpoint POST /api/theme respondió 200 para scope tenant');
    assert(setTenantThemeRes.data.success === true, 'Tema base del Tenant guardado con éxito');
    assert(setTenantThemeRes.data.themeKey === 'holo_light', 'Tema guardado es holo_light');

    // 3. Consultar tema como usuario Juan de Poke (sin preferencia personal) -> Debe heredar cyberpunk
    console.log('\n--- 2. Herencia del Tema Base por Usuario sin Preferencia ---');
    const juanThemeRes = await requestJson('GET', '/api/theme', null, {
      'Authorization': `Bearer ${tokens.juan}`
    });

    assert(juanThemeRes.status === 200, 'GET /api/theme respondió 200 para juan@poke.com.ar');
    assert(juanThemeRes.data.themeKey === 'holo_light', 'Juan hereda correctamente el tema base del Tenant (Holo Day)');

    // 4. Juan cambia su tema personal a 'holo_dark' (scope: 'user')
    console.log('\n--- 3. Preferencia Personal de Usuario (Scope: User) ---');
    const setJuanPersonalThemeRes = await requestJson('POST', '/api/theme', {
      themeKey: 'holo_dark',
      scope: 'user'
    }, {
      'Authorization': `Bearer ${tokens.juan}`
    });

    assert(setJuanPersonalThemeRes.status === 200, 'POST /api/theme respondió 200 para preferencia de Juan');
    assert(setJuanPersonalThemeRes.data.scope === 'user', 'Scope de respuesta es user');

    // 5. Verificar que Juan ahora tiene su tema personal
    const juanUpdatedThemeRes = await requestJson('GET', '/api/theme', null, {
      'Authorization': `Bearer ${tokens.juan}`
    });
    assert(juanUpdatedThemeRes.data.themeKey === 'holo_dark', 'Juan ahora ve su tema personal (Holo Night)');

    // 6. Verificar que Vanesa (otra usuaria de Poke) sigue viendo el tema base del Tenant (Holo Day)
    console.log('\n--- 4. Aislamiento Estricto entre Usuarios del Mismo Tenant ---');
    const vanesaThemeRes = await requestJson('GET', '/api/theme', null, {
      'Authorization': `Bearer ${tokens.vanesa}`
    });
    assert(vanesaThemeRes.data.themeKey === 'holo_light', 'Vanesa NO se ve afectada por el cambio de Juan y mantiene el tema del Tenant');

    // 6b. Solo existen los dos temas Holo: la lista expone exactamente 2 y una clave legada cae en Holo Night
    const listRes = await requestJson('GET', '/api/theme', null, { 'Authorization': `Bearer ${tokens.juan}` });
    const keys = (listRes.data.availableThemes || []).map(t => t.key).sort().join(',');
    assert(keys === 'holo_dark,holo_light', 'availableThemes expone solo holo_dark y holo_light');
    const legacyRes = await requestJson('POST', '/api/theme', { themeKey: 'omarchy_tiling', scope: 'user' }, { 'Authorization': `Bearer ${tokens.juan}` });
    assert(legacyRes.data && legacyRes.data.themeKey === 'holo_dark', 'Una clave de tema legada se normaliza a holo_dark');

    // 7. Limpieza: restaurar tema base de Poke a holo_dark y resetear preferencia de Juan
    await execute("UPDATE core_users SET theme_preference = NULL WHERE LOWER(email) = 'juan@poke.com.ar'", [], { isSuperAdmin: true });
    await execute("INSERT INTO core_app_settings (tenant_id, key, value) VALUES (?, 'active_theme', 'holo_dark') ON CONFLICT (tenant_id, key) DO UPDATE SET value = 'holo_dark'", [pokeTenant.id], { isSuperAdmin: true });

  } catch (err) {
    console.error('Error durante la ejecución de los tests:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 RESULTADOS: ${passed} Aprobados | ${failed} Fallidos`);
  if (failed === 0) {
    console.log('FASE 8: MOTOR DE TEMAS HIERÁRQUICO (TENANT VS USUARIO) 100% OPERATIVO.');
    console.log('======================================================');
    process.exit(0);
  } else {
    console.error('ALGUNOS TESTS FALLARON.');
    console.log('======================================================');
    process.exit(1);
  }
}

runTests();
