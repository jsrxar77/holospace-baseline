/**
 * lib/oauth.js - HoloSpace Baseline Modular OAuth2 / OpenID Connect Adapter
 * Capa de integración universal para federación de identidades (Google, Azure AD, GitHub).
 * Provee generación de URL de consentimiento, canje de código y resolución de perfil.
 */

const crypto = require('crypto');
const https = require('https');
const { getOne, execute, query } = require('./db');
const { signJwt } = require('./auth');
const { PLANS, registerNewTenant } = require('./billing');

// Configuración de Proveedores OAuth2
const OAUTH_PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID || 'dummy_google_client_id.apps.googleusercontent.com',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_google_secret',
    defaultScopes: ['openid', 'email', 'profile']
  }
};

/**
 * Helper para peticiones HTTPS con soporte JSON
 */
function httpsRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * 1. Genera la URL de autorización para el proveedor seleccionado
 */
function getAuthorizationUrl(providerName = 'google', redirectUri, statePayload = {}) {
  const provider = OAUTH_PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Proveedor OAuth2 no soportado: '${providerName}'`);
  }

  const state = Buffer.from(JSON.stringify({
    ...statePayload,
    nonce: crypto.randomBytes(12).toString('hex'),
    timestamp: Date.now()
  })).toString('base64url');

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.defaultScopes.join(' '),
    access_type: 'offline',
    prompt: 'select_account',
    state
  });

  return `${provider.authUrl}?${params.toString()}`;
}

/**
 * 2. Canjea el código de autorización y obtiene el perfil verificado del usuario
 */
async function exchangeCodeForUser(providerName = 'google', code, redirectUri) {
  const provider = OAUTH_PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Proveedor OAuth2 no soportado: '${providerName}'`);
  }

  // Si estamos en entorno de test/mock (claves dummy o explícito)
  if (provider.clientId.startsWith('dummy_') || code.startsWith('mock_code_')) {
    const mockEmail = code.includes('@') ? code.replace('mock_code_', '') : 'test.oauth.user@gmail.com';
    return {
      sub: 'google_user_' + crypto.createHash('md5').update(mockEmail).digest('hex'),
      email: mockEmail,
      name: 'Usuario Google Verificado',
      picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      provider: providerName
    };
  }

  const postParams = new URLSearchParams({
    code,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  }).toString();

  const tokenRes = await httpsRequest(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postParams)
    }
  }, postParams);

  if (tokenRes.status !== 200 || !tokenRes.data || !tokenRes.data.access_token) {
    throw new Error(`Error en el intercambio de token con ${providerName}: ${tokenRes.raw}`);
  }

  const userRes = await httpsRequest(provider.userInfoUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenRes.data.access_token}`
    }
  });

  if (userRes.status !== 200 || !userRes.data || !userRes.data.email) {
    throw new Error(`No se pudo obtener el perfil del usuario desde ${providerName}`);
  }

  return {
    sub: userRes.data.sub,
    email: userRes.data.email.toLowerCase().trim(),
    name: userRes.data.name || userRes.data.email.split('@')[0],
    picture: userRes.data.picture || null,
    provider: providerName
  };
}

/**
 * 3. Resuelve el login o estado de onboarding para un perfil OAuth
 */
async function resolveOAuthUser(profile) {
  const { email, sub, name, picture, provider } = profile;
  const cleanEmail = email.toLowerCase().trim();

  // Buscar usuario existente por email o provider_id
  const user = await getOne(
    `SELECT u.id, u.tenant_id, u.role_id, u.username, u.email, u.name, u.role, u.is_active,
            t.slug as tenant_slug, t.name as tenant_name, t.status as tenant_status,
            s.plan_code
     FROM core_users u
     JOIN tenant_tenants t ON u.tenant_id = t.id
     LEFT JOIN tenant_subscriptions s ON t.id = s.tenant_id
     WHERE LOWER(u.email) = ? OR (u.auth_provider = ? AND u.auth_provider_id = ?)`,
    [cleanEmail, provider, sub],
    { isSuperAdmin: true }
  );

  if (user) {
    if (user.is_active === false) {
      throw new Error('Su cuenta se encuentra desactivada. Contacte al administrador.');
    }
    if (user.tenant_status === 'suspended') {
      throw new Error('La organización a la que pertenece se encuentra suspendida.');
    }

    // Actualizar proveedor federado y avatar si cambiaron
    await execute(
      `UPDATE core_users 
       SET auth_provider = ?, auth_provider_id = ?, avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [provider, sub, picture, user.id],
      { isSuperAdmin: true }
    );

    // Obtener módulos habilitados para el tenant
    const mods = await query(
      'SELECT module_code FROM tenant_modules WHERE tenant_id = ? AND is_enabled = true',
      [user.tenant_id],
      { isSuperAdmin: true }
    );
    const entitlements = mods.map(m => m.module_code);

    const { getUserPermissions } = require('./rbac');
    const permissions = await getUserPermissions(user);

    const jwtPayload = {
      sub: user.email,
      email: user.email,
      name: user.name,
      role: user.role,
      roleId: user.role_id,
      tenantId: user.tenant_id,
      tenantSlug: user.tenant_slug,
      entitlements,
      permissions,
      authProvider: provider,
      avatarUrl: picture
    };

    const token = signJwt(jwtPayload, 86400 * 7);

    return {
      status: 'AUTHENTICATED',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        tenantSlug: user.tenant_slug,
        entitlements,
        avatarUrl: picture
      }
    };
  }

  // Usuario nuevo sin organización: se requiere completar selección de plan / onboarding
  return {
    status: 'NEEDS_ONBOARDING',
    profile: {
      email: cleanEmail,
      name,
      sub,
      picture,
      provider
    }
  };
}

/**
 * 4. Completa el registro de un nuevo usuario OAuth creando su Organización y Plan
 */
async function completeOAuthOnboarding({ profile, companyName, slug, planCode = 'kanban_simple' }) {
  const { email, name, sub, picture, provider = 'google' } = profile;
  const cleanEmail = email.toLowerCase().trim();
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();

  if (!companyName || !cleanSlug) {
    throw new Error('Nombre de empresa y slug son obligatorios.');
  }

  const existingTenant = await getOne('SELECT id FROM tenant_tenants WHERE slug = ?', [cleanSlug], { isSuperAdmin: true });
  if (existingTenant) {
    throw new Error(`El identificador de empresa "${cleanSlug}" ya se encuentra registrado.`);
  }

  const existingUser = await getOne('SELECT email FROM core_users WHERE LOWER(email) = ?', [cleanEmail], { isSuperAdmin: true });
  if (existingUser) {
    throw new Error(`El email '${cleanEmail}' ya está registrado.`);
  }

  const selectedPlan = PLANS[planCode] || PLANS.kanban_simple || PLANS.starter;
  const tenantId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // Determinar rol administrativo según el producto
  const is4seeProduct = selectedPlan.includedModules.includes('4see') && !selectedPlan.includedModules.includes('kanban');
  const adminRoleCode = is4seeProduct ? '4see_admin' : 'kanban_admin';

  // Buscar rol en base de datos si existe
  const roleRow = await getOne('SELECT id FROM core_roles WHERE LOWER(code) = ?', [adminRoleCode], { isSuperAdmin: true });
  const roleId = roleRow ? roleRow.id : null;

  // 1. Crear Organización
  await execute(
    'INSERT INTO tenant_tenants (id, slug, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [tenantId, cleanSlug, companyName.trim(), 'active'],
    { isSuperAdmin: true }
  );

  // 2. Crear Suscripción con Límites y Cuotas
  await execute(
    `INSERT INTO tenant_subscriptions 
      (id, tenant_id, plan_code, status, max_users, max_orders_monthly, current_period_start, current_period_end) 
     VALUES (?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '30 days')`,
    [subId, tenantId, selectedPlan.code, selectedPlan.maxUsers, selectedPlan.maxOrdersMonthly],
    { isSuperAdmin: true }
  );

  // 3. Habilitar Módulos
  const { setTenantModuleState } = require('./entitlement');
  for (const mod of selectedPlan.includedModules) {
    await setTenantModuleState(tenantId, mod, true, cleanEmail);
  }

  // 4. Crear Usuario Federado en core_users
  await execute(
    `INSERT INTO core_users 
      (id, tenant_id, role_id, username, email, password_hash, name, role, auth_provider, auth_provider_id, avatar_url, is_active) 
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, true)`,
    [userId, tenantId, roleId, cleanEmail.split('@')[0], cleanEmail, name.trim(), adminRoleCode.toUpperCase(), provider, sub, picture],
    { isSuperAdmin: true }
  );

  // 5. Emitir Token JWT
  const { getUserPermissions } = require('./rbac');
  const permissions = await getUserPermissions({
    role: adminRoleCode.toUpperCase(),
    role_id: roleId,
    tenant_id: tenantId
  });

  const jwtPayload = {
    sub: cleanEmail,
    email: cleanEmail,
    name: name.trim(),
    role: adminRoleCode.toUpperCase(),
    roleId,
    tenantId,
    tenantSlug: cleanSlug,
    entitlements: selectedPlan.includedModules,
    permissions,
    authProvider: provider,
    avatarUrl: picture
  };
  const token = signJwt(jwtPayload, 86400 * 7);

  console.log(`[OAUTH ONBOARDING] Nuevo Tenant con Google registrado: ${companyName} (${cleanSlug}) - Plan: ${selectedPlan.name}`);

  return {
    success: true,
    token,
    tenant: {
      id: tenantId,
      slug: cleanSlug,
      name: companyName.trim(),
      plan: selectedPlan.code
    },
    user: {
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      role: adminRoleCode.toUpperCase(),
      tenantId,
      tenantSlug: cleanSlug,
      entitlements: selectedPlan.includedModules,
      avatarUrl: picture
    }
  };
}

module.exports = {
  OAUTH_PROVIDERS,
  getAuthorizationUrl,
  exchangeCodeForUser,
  resolveOAuthUser,
  completeOAuthOnboarding
};
