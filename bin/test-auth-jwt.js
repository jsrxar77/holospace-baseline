#!/usr/bin/env node
/**
 * bin/test-auth-jwt.js
 * Test Suite Automatizado para la Fase 2: JWT Multi-Tenant & RBAC Engine
 */

const { hashPassword, verifyPassword, signJwt, verifyJwt } = require('../lib/auth');

console.log('======================================================');
console.log('🧪 TEST SUITE: AUTENTICACIÓN JWT MULTI-TENANT & RBAC');
console.log('======================================================');

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${desc}`);
    failed++;
  }
}

// 1. Test de Hashing Criptográfico scrypt
console.log('\n--- 1. Hashing Criptográfico Seguro (scrypt) ---');
const rawPass = 'MiPasswordSegura2026!';
const hash1 = hashPassword(rawPass);
const hash2 = hashPassword(rawPass);

assert(hash1.includes(':'), 'El hash contiene formato salt:hash');
assert(hash1 !== hash2, 'Dos hashes del mismo password tienen salts diferentes');
assert(verifyPassword(rawPass, hash1), 'Verificación exitosa con password correcto');
assert(!verifyPassword('WrongPassword123!', hash1), 'Falla controlada con password incorrecto');
assert(verifyPassword('LegacyPass', 'LegacyPass'), 'Retrocompatibilidad transparente con password plano legado');

// 2. Test de Token JWT Multi-Tenant (HMAC-SHA256)
console.log('\n--- 2. Tokens JWT Multi-Tenant ---');
const payload = {
  sub: 'admin@drinklovers.com.ar',
  email: 'admin@drinklovers.com.ar',
  role: 'ADMIN',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  tenantSlug: 'drinklovers',
  entitlements: ['core', 'scanban']
};

const token = signJwt(payload, 3600);
assert(typeof token === 'string' && token.split('.').length === 3, 'Token JWT emitido con estructura válida (3 partes)');

const decoded = verifyJwt(token);
assert(decoded !== null, 'Token JWT verificado y decodificado exitosamente');
assert(decoded.email === payload.email, 'Claim `email` coincide');
assert(decoded.tenantId === payload.tenantId, 'Claim `tenantId` coincide');
assert(decoded.role === 'ADMIN', 'Claim `role` coincide');
assert(Array.isArray(decoded.entitlements) && decoded.entitlements.includes('scanban'), 'Claim `entitlements` contiene módulo `scanban`');

// 3. Test de Seguridad de Tokens Alterados
console.log('\n--- 3. Detección de Tokens Alterados / Forjados ---');
const tamperedToken = token.slice(0, -5) + 'XXXXX';
const tamperedDecoded = verifyJwt(tamperedToken);
assert(tamperedDecoded === null, 'Token alterado es rechazado inmediatamente');

const expiredToken = signJwt(payload, -10); // Expirado hace 10 segundos
const expiredDecoded = verifyJwt(expiredToken);
assert(expiredDecoded === null, 'Token expirado es rechazado inmediatamente');

console.log('\n======================================================');
console.log(`📊 RESULTADOS: ${passed} Aprobados | ${failed} Fallidos`);
if (failed === 0) {
  console.log('🎉 FASE 2: MOTOR DE AUTENTICACIÓN JWT Y RBAC 100% OPERATIVO.');
} else {
  console.error('⚠️ ALGUNOS TESTS DE AUTENTICACIÓN FALLARON.');
  process.exit(1);
}
console.log('======================================================');
