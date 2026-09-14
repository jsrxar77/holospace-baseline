/**
 * tests/run-all-tests.js
 * Runner unificado y orquestador maestro de pruebas automatizadas
 * Cobertura 360 de todos los módulos de HoloSpace Baseline:
 * - Plataforma / DB Integrity
 * - Módulo Core (Auth JWT, RBAC Granular, Jerarquía de Temas)
 * - Módulo Tenant (Entitlements, Facturación/Onboarding, Gobierno de Tenants, Toggle de Módulos)
 * - Módulo Kanban (Ciclo de Vida de Pedidos, Asignación Dual, Aislamiento Multi-Tenant)
 * - Módulo Scanner (Picking Móvil EAN-13, Transiciones y Trazabilidad)
 * - Módulo 4see (Inteligencia E-Commerce, Repricing y Márgenes)
 */

const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'DB Integrity & RLS Verification', file: 'tests/verify-db-integrity.js', module: 'PLATFORM' },
  { name: 'Core: Auth JWT & Passwords (scrypt)', file: 'tests/test-auth-jwt.js', module: 'CORE' },
  { name: 'Core: RBAC Granular Permissions', file: 'tests/test-rbac-granular.js', module: 'CORE' },
  { name: 'Core: Theme Engine Hierarchy (HW-DS)', file: 'tests/test-theme-hierarchy.js', module: 'CORE' },
  { name: 'Tenant: Governance & Isolation', file: 'tests/test-tenants-module.js', module: 'TENANT' },
  { name: 'Tenant: Entitlements & Licensing', file: 'tests/test-entitlement.js', module: 'TENANT' },
  { name: 'Tenant: Billing Plans & Onboarding', file: 'tests/test-billing-onboarding.js', module: 'TENANT' },
  { name: 'Tenant: Dynamic Module Toggle', file: 'tests/test-modules-toggle.js', module: 'TENANT' },
  { name: 'Kanban: Order Lifecycle & Logistics', file: 'tests/test-kanban-module.js', module: 'KANBAN' },
  { name: 'Scanner: Mobile EAN-13 Picking', file: 'tests/test-scanner-module.js', module: 'SCANNER' },
  { name: '4see: Margin Calculations & Repricing', file: 'bin/test-4see.js', module: '4SEE' },
  { name: '4see: E-Commerce Ontology & On-The-Fly Audit', file: 'tests/test-4see-ontology.js', module: '4SEE' },
  { name: 'Core/Tenant: Google OAuth2 & Role Quotas', file: 'tests/test-oauth-and-role-quotas.js', module: 'CORE' }
];

function runScript(filePath) {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn('node', [filePath], {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      stdio: 'inherit'
    });

    proc.on('close', (code) => {
      const durationMs = Date.now() - start;
      resolve({ code, durationMs });
    });

    proc.on('error', (err) => {
      console.error(`[ERROR] No se pudo ejecutar ${filePath}:`, err.message);
      resolve({ code: 1, durationMs: 0 });
    });
  });
}

async function main() {
  console.log('======================================================================');
  console.log('HOLOSPACE BASELINE: EJECUTOR MAESTRO DE SUITE DE PRUEBAS (TODOS LOS MODULOS)');
  console.log('======================================================================\n');

  const results = [];
  let allSuccess = true;

  for (const suite of SUITES) {
    console.log(`\n>>> EJECUTANDO SUITE [${suite.module}]: ${suite.name} (${suite.file})`);
    console.log('----------------------------------------------------------------------');
    const { code, durationMs } = await runScript(suite.file);
    const passed = code === 0;
    if (!passed) allSuccess = false;
    results.push({ ...suite, passed, code, durationMs });
  }

  console.log('\n======================================================================');
  console.log('RESUMEN CONSOLIDADO DE EJECUCION DE SUITES POR MODULO');
  console.log('======================================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const res of results) {
    const tag = res.passed ? '[PASS]' : '[FAIL]';
    console.log(`${tag} [${res.module.padEnd(8)}] ${res.name.padEnd(42)} (${res.durationMs}ms)`);
    if (res.passed) passedCount++;
    else failedCount++;
  }

  console.log('----------------------------------------------------------------------');
  console.log(`TOTAL SUITES: ${results.length} | PASARON: ${passedCount} | FALLARON: ${failedCount}`);
  console.log('======================================================================');

  if (!allSuccess) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL] Error en runner de tests:', err);
  process.exit(1);
});
