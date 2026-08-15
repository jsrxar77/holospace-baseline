/**
 * lib/auth.js - HoloWare Multi-Tenant Security, Hashing & JWT Auth Engine
 * Implementación criptográfica de grado militar sin dependencias externas (Node.js crypto).
 */

const crypto = require('crypto');
const { getOne, query, DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'holoware_super_secret_jwt_key_2026_x89f_aes';

/**
 * 1. Hashing Criptográfico de Contraseñas (scrypt con Salt de 16 bytes)
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verificación segura de contraseñas (soporta hash scrypt y migración transparente de texto plano)
 */
function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  // Si tiene formato scrypt:plaintext (seeds directos en SQL)
  if (storedHash.startsWith('scrypt:')) {
    const expectedPlain = storedHash.substring(7);
    return password === expectedPlain;
  }

  // Si tiene formato salt:hash (hex scrypt generado por hashPassword)
  if (storedHash.includes(':')) {
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length === derivedKey.length) {
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    }
    return false;
  }

  // Retrocompatibilidad con contraseñas legadas en texto plano
  return password === storedHash;
}

/**
 * 2. Emisión y Verificación de Tokens JWT Multi-Tenant (HMAC-SHA256)
 */
function getJwtSecret() {
  return process.env.JWT_SECRET || 'holoware_super_secret_jwt_key_2026_x89f_aes';
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

function signJwt(payload, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSig) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * 3. Middleware de Resolución de Tenant (Usuario Autenticado, Header X-Tenant-ID, Subdominio o Default)
 */
async function resolveTenantContext(req, currentUser = null) {
  let tenantSlug = null;
  let tenantId = null;

  // A. Tenant del usuario autenticado
  if (currentUser && (currentUser.tenant_id || currentUser.tenantId)) {
    tenantId = currentUser.tenant_id || currentUser.tenantId;
  }

  // B. Header explícito X-Tenant-ID o X-Tenant-Slug
  if (!tenantId && req.headers) {
    if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'];
    } else if (req.headers['x-tenant-slug']) {
      tenantSlug = req.headers['x-tenant-slug'];
    }
  }

  // C. Subdominio (ej: drinklovers.holoware.app)
  if (!tenantSlug && !tenantId && req.headers && req.headers.host) {
    const hostParts = req.headers.host.split(':')[0].split('.');
    if (hostParts.length > 2 && hostParts[0] !== 'www' && hostParts[0] !== 'localhost') {
      tenantSlug = hostParts[0];
    }
  }

  // D. Fallback a Tenant por Defecto
  if (!tenantId && !tenantSlug) {
    tenantId = DEFAULT_TENANT_ID;
    tenantSlug = DEFAULT_TENANT_SLUG;
  }

  // Obtener registro de Tenant de la base de datos
  let tenant = null;
  if (tenantId) {
    tenant = await getOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  } else if (tenantSlug) {
    tenant = await getOne('SELECT * FROM tenants WHERE slug = ?', [tenantSlug]);
  }

  if (!tenant) {
    tenant = { id: DEFAULT_TENANT_ID, slug: DEFAULT_TENANT_SLUG, name: 'HoloWare Cloud Platform', status: 'active' };
  }

  req.tenant = tenant;
  req.tenantId = tenant.id;
  req.tenantSlug = tenant.slug;
  return tenant;
}

/**
 * 4. Middleware de Autenticación de Token JWT
 */
async function authenticateToken(req, res, next) {
  await resolveTenantContext(req);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token JWT requerido', code: 'AUTH_REQUIRED' });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(403).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' });
  }

  req.user = payload;
  req.userEmail = payload.email;
  req.userRole = payload.role;
  req.tenantId = payload.tenantId || req.tenantId;
  req.tenantSlug = payload.tenantSlug || req.tenantSlug;
  req.isSuperAdmin = payload.role === 'SUPERADMIN';

  next();
}

/**
 * 5. Middleware de Control de Roles (RBAC)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida', code: 'UNAUTHENTICATED' });
    }

    // SUPERADMIN tiene acceso a todas las operaciones
    if (req.user.role === 'SUPERADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permiso denegado: Se requiere uno de los siguientes roles: [${allowedRoles.join(', ')}]`,
        code: 'FORBIDDEN_ROLE'
      });
    }

    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  resolveTenantContext,
  authenticateToken,
  requireRole,
  JWT_SECRET
};
