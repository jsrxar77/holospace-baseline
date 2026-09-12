/**
 * tests/test-oauth-and-role-quotas.js
 * Suite de Pruebas Automatizadas:
 * 1. Autenticacion Federada OAuth2 / OpenID Connect (Google)
 * 2. Auto-Onboarding Federado con Asignacion de Planes Verticales (Kanban y 4see)
 * 3. Gobernanza y Validacion Estricta de Cuotas por Rol (role_quotas) en core_users
 * 4. Aislamiento Multi-Tenant y Prevencion de Fugas de Datos
 */

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const { query, getOne, execute } = require('../lib/db');
const { getAuthorizationUrl, exchangeCodeForUser, resolveOAuthUser, completeOAuthOnboarding } = require('../lib/oauth');
const { PLANS } = require('../lib/billing');

// Helper para peticiones HTTP contra la API local de HoloSpace
function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const port = process.env.HS_PORT || process.env.PORT || 3001;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode, data: json, raw });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: OAUTH2 GOOGLE & GOBERNANZA DE CUOTAS POR ROL');
  console.log('======================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function pass(msg) {
    console.log(`[PASS] ${msg}`);
    passedCount++;
  }

  function fail(msg, err) {
    console.error(`[FAIL] ${msg}:`, err ? err.message : '');
    failedCount++;
  }

  const nonce = Date.now();
  const testRedirectUri = 'http://localhost:3001/api/auth/google/callback';

  // --- 1. Generacion de URL de Autorizacion OAuth2 ---
  console.log('--- 1. Generacion de URL de Autorizacion OAuth2 ---');
  try {
    const authUrl = getAuthorizationUrl('google', testRedirectUri, { plan: 'kanban_simple' });
    assert(authUrl.includes('https://accounts.google.com/o/oauth2/v2/auth'), 'URL base de Google incorrecta');
    assert(authUrl.includes('redirect_uri='), 'Debe incluir redirect_uri');
    assert(authUrl.includes('scope=openid+email+profile') || authUrl.includes('scope=openid%20email%20profile'), 'Scopes OpenID Connect presentes');
    assert(authUrl.includes('state='), 'Debe incluir token state');
    pass('URL de consentimiento Google OAuth2 generada con scopes canónicos');
  } catch (err) {
    fail('Error al generar URL de autorizacion', err);
  }

  // --- 2. Canje de Codigo Mock y Resolucion de Perfil ---
  console.log('\n--- 2. Resolucion de Perfil OAuth2 ---');
  const mockEmailKanban = `test.kanban.${nonce}@empresa-logistica.com`;
  const mockEmail4see = `test.4see.${nonce}@tienda-ecommerce.com`;
  let profileKanban = null;

  try {
    profileKanban = await exchangeCodeForUser('google', `mock_code_${mockEmailKanban}`, testRedirectUri);
    assert.strictEqual(profileKanban.email, mockEmailKanban.toLowerCase());
    assert(profileKanban.sub, 'Debe contener identificador sub de Google');
    assert.strictEqual(profileKanban.provider, 'google');
    pass('Intercambio de codigo OAuth2 y obtencion de perfil verificado exitoso');
  } catch (err) {
    fail('Error en canje de codigo OAuth2', err);
  }

  // --- 3. Deteccion de Estado NEEDS_ONBOARDING para Usuario Nuevo ---
  console.log('\n--- 3. Deteccion de Estado de Onboarding ---');
  try {
    const resolveRes = await resolveOAuthUser(profileKanban);
    assert.strictEqual(resolveRes.status, 'NEEDS_ONBOARDING');
    assert.strictEqual(resolveRes.profile.email, mockEmailKanban);
    pass('Usuario nuevo detectado correctamente con estado NEEDS_ONBOARDING');
  } catch (err) {
    fail('Fallo en deteccion de estado NEEDS_ONBOARDING', err);
  }

  // --- 4. Auto-Onboarding Federado (Linea Vertical Kanban Simple) ---
  console.log('\n--- 4. Onboarding Federado: Plan Kanban Simple ---');
  const slugKanban = `logistica-express-${nonce}`;
  let onboardResultKanban = null;

  try {
    onboardResultKanban = await completeOAuthOnboarding({
      profile: profileKanban,
      companyName: `Logistica Express ${nonce}`,
      slug: slugKanban,
      planCode: 'kanban_simple'
    });

    assert(onboardResultKanban.success, 'El alta de onboarding debe ser exitosa');
    assert(onboardResultKanban.token, 'Debe emitir token JWT');
    assert.strictEqual(onboardResultKanban.user.email, mockEmailKanban);
    assert.strictEqual(onboardResultKanban.user.role, 'KANBAN_ADMIN');
    assert(onboardResultKanban.user.entitlements.includes('kanban'), 'Entitlements deben incluir modulo kanban');
    assert(onboardResultKanban.user.entitlements.includes('scanner'), 'Entitlements deben incluir modulo scanner');

    // Validacion en PostgreSQL 16
    const userInDb = await getOne('SELECT id, auth_provider, auth_provider_id, role, tenant_id FROM core_users WHERE email = ?', [mockEmailKanban], { isSuperAdmin: true });
    assert(userInDb, 'Usuario federado debe existir en core_users');
    assert.strictEqual(userInDb.auth_provider, 'google');
    assert.strictEqual(userInDb.role, 'KANBAN_ADMIN');

    const subInDb = await getOne('SELECT plan_code, max_users FROM tenant_subscriptions WHERE tenant_id = ?', [userInDb.tenant_id], { isSuperAdmin: true });
    assert.strictEqual(subInDb.plan_code, 'kanban_simple');
    assert.strictEqual(subInDb.max_users, 4);

    pass('Organizacion, suscripcion y usuario federado persistidos en PostgreSQL 16');
  } catch (err) {
    fail('Fallo en onboarding federado de Kanban Simple', err);
  }

  // --- 5. Autenticacion Recurrente de Usuario Existente ---
  console.log('\n--- 5. Login Recurrente de Usuario Federado ---');
  try {
    const loginRes = await resolveOAuthUser(profileKanban);
    assert.strictEqual(loginRes.status, 'AUTHENTICATED');
    assert(loginRes.token, 'Debe emitir JWT de sesion');
    assert.strictEqual(loginRes.user.email, mockEmailKanban);
    assert.strictEqual(loginRes.user.tenantSlug, slugKanban);
    pass('Usuario registrado previamente inicia sesion directamente como AUTHENTICATED');
  } catch (err) {
    fail('Fallo en login de usuario federado existente', err);
  }

  // --- 6. Validacion Estricta de Cuotas por Rol (role_quotas) ---
  console.log('\n--- 6. Gobernanza de Cuotas por Rol (role_quotas) ---');
  const kanbanTenantId = onboardResultKanban.tenant.id;
  const kanbanToken = onboardResultKanban.token;

  // Plan kanban_simple: max_admins: 1, max_operators: 3
  // Intento 1: Crear un segundo administrador (Debe fallar porque ya existe 1 admin)
  try {
    const addSecondAdminRes = await makeRequest('/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kanbanToken}`,
        'x-tenant-id': kanbanTenantId
      }
    }, {
      tenantId: kanbanTenantId,
      username: `admin2_${nonce}`,
      email: `admin2_${nonce}@empresa.com`,
      password: 'SecurePassword2026!',
      name: 'Segundo Admin',
      role: 'KANBAN_ADMIN'
    });

    assert.strictEqual(addSecondAdminRes.status, 400, 'Debe responder 400 Bad Request');
    assert.strictEqual(addSecondAdminRes.data.code, 'ROLE_QUOTA_EXCEEDED', 'Codigo de error ROLE_QUOTA_EXCEEDED');
    pass('Bloqueo exitoso de exceso de cuota de Administradores (max_admins: 1)');
  } catch (err) {
    fail('Fallo al validar bloqueo de cuota de admins', err);
  }

  // Intento 2: Crear 3 operarios permitidos (max_operators: 3)
  try {
    for (let i = 1; i <= 3; i++) {
      const addOpRes = await makeRequest('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kanbanToken}`,
          'x-tenant-id': kanbanTenantId
        }
      }, {
        tenantId: kanbanTenantId,
        username: `operario${i}_${nonce}`,
        email: `op${i}_${nonce}@empresa.com`,
        password: 'SecurePassword2026!',
        name: `Operario ${i}`,
        role: 'OPERATOR'
      });
      assert.strictEqual(addOpRes.status, 200, `Operario ${i} debe crearse con exito`);
    }
    pass('Creacion exitosa de 3 operarios dentro de la cuota autorizada');
  } catch (err) {
    fail('Fallo al crear operarios permitidos', err);
  }

  // Intento 3: Crear el 4to operario (Debe fallar porque el limite es 3 operarios y 4 usuarios totales)
  try {
    const addFourthOpRes = await makeRequest('/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kanbanToken}`,
        'x-tenant-id': kanbanTenantId
      }
    }, {
      tenantId: kanbanTenantId,
      username: `operario4_${nonce}`,
      email: `op4_${nonce}@empresa.com`,
      password: 'SecurePassword2026!',
      name: 'Operario Excedente',
      role: 'OPERATOR'
    });

    assert.strictEqual(addFourthOpRes.status, 400, 'Debe rechazar el 4to operario');
    assert(addFourthOpRes.data.code === 'ROLE_QUOTA_EXCEEDED' || addFourthOpRes.data.code === 'USER_LIMIT_EXCEEDED', 'Debe indicar cuota o limite total excedido');
    pass('Bloqueo exitoso de 4to operario excedente segun limites del plan');
  } catch (err) {
    fail('Fallo al validar bloqueo de 4to operario', err);
  }

  // --- 7. Onboarding Federado: Linea Vertical E-Commerce 4see Simple ---
  console.log('\n--- 7. Onboarding Federado: Linea Vertical 4see Simple ---');
  const slug4see = `tienda-online-${nonce}`;
  let onboardResult4see = null;

  try {
    const profile4see = await exchangeCodeForUser('google', `mock_code_${mockEmail4see}`, testRedirectUri);
    onboardResult4see = await completeOAuthOnboarding({
      profile: profile4see,
      companyName: `Tienda Online ${nonce}`,
      slug: slug4see,
      planCode: 'fourseee_simple'
    });

    assert(onboardResult4see.success, 'Alta de 4see debe ser exitosa');
    assert.strictEqual(onboardResult4see.user.role, '4SEE_ADMIN');
    assert(onboardResult4see.user.entitlements.includes('4see'), 'Entitlements deben incluir modulo 4see');
    assert(!onboardResult4see.user.entitlements.includes('kanban'), 'Entitlements NO deben incluir kanban en plan 4see');
    pass('Tenant de e-commerce 4see creado con rol 4SEE_ADMIN y aislamiento modular');
  } catch (err) {
    fail('Fallo en onboarding de linea 4see', err);
  }

  // --- 8. Cuotas del Plan 4see (max_operators: 0, max_analysts: 2) ---
  console.log('\n--- 8. Cuotas del Plan 4see ---');
  const fourseeTenantId = onboardResult4see.tenant.id;
  const fourseeToken = onboardResult4see.token;

  try {
    // Intentar crear un operario de deposito en plan de 4see (max_operators: 0)
    const addOpIn4seeRes = await makeRequest('/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fourseeToken}`,
        'x-tenant-id': fourseeTenantId
      }
    }, {
      tenantId: fourseeTenantId,
      username: `op_4see_${nonce}`,
      email: `op_4see_${nonce}@tienda.com`,
      password: 'SecurePassword2026!',
      name: 'Operario Invalido en 4see',
      role: 'OPERATOR'
    });

    assert.strictEqual(addOpIn4seeRes.status, 400, 'Debe rechazar creacion de operario en plan 4see');
    assert.strictEqual(addOpIn4seeRes.data.code, 'ROLE_QUOTA_EXCEEDED');
    pass('Rechazo estricto de roles operarios en planes verticales de e-commerce (max_operators: 0)');

    // Crear un analista de catalogo (max_analysts: 2)
    const addAnalystRes = await makeRequest('/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fourseeToken}`,
        'x-tenant-id': fourseeTenantId
      }
    }, {
      tenantId: fourseeTenantId,
      username: `analyst1_${nonce}`,
      email: `analyst1_${nonce}@tienda.com`,
      password: 'SecurePassword2026!',
      name: 'Analista de Precios',
      role: 'ANALYST'
    });

    assert.strictEqual(addAnalystRes.status, 200, 'Analista de catalogo debe crearse con exito');
    pass('Creacion exitosa de Analista en plan 4see dentro de su cuota (max_analysts: 2)');
  } catch (err) {
    fail('Fallo en validacion de cuotas de 4see', err);
  }

  // --- Resumen de Suite ---
  console.log('\n======================================================================');
  console.log(`RESULTADOS: ${passedCount} PASARON | ${failedCount} FALLARON`);
  console.log('======================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('[FATAL] Error en suite de tests:', err);
  process.exit(1);
});
