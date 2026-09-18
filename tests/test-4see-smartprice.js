/**
 * tests/test-4see-smartprice.js
 * Suite automatizada de pruebas para el motor SmartPrice, Mapeo 1:N,
 * Piso Inquebrantable (Hard Floor) y Worker de Repricing en 4see.
 */

const assert = require('assert');
const crypto = require('crypto');
const { query, execute, getOne } = require('../lib/db');
const { calculateHardFloor, clampPrice, evaluateSmartPrice } = require('../modules/4see/lib/smartprice');
const { ensureSmartPriceTables } = require('../modules/4see/lib/ensure_tables');
const { handle4seeApi } = require('../modules/4see/routes/api');

const TEST_TENANT_A = 'a1111111-1111-1111-1111-111111111111';
const TEST_TENANT_B = 'b2222222-2222-2222-2222-222222222222';

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`[PASS] ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`[FAIL] ${msg}:`, err ? err.message : '');
  failed++;
}

// Mock simple de res para invocar handle4seeApi
function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(data) {
      this.body = data;
    },
    json() {
      try {
        return JSON.parse(this.body);
      } catch (e) {
        return null;
      }
    }
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: SMARTPRICE ENGINE, 1:N MAPPINGS Y PISO INQUEBRANTABLE (4SEE)');
  console.log('======================================================================\n');

  // Asegurar tenants de prueba
  await execute(`
    INSERT INTO tenant_tenants (id, name, slug, status)
    VALUES 
      ('${TEST_TENANT_A}', 'Tenant Test A', 'tenant-test-a', 'active'),
      ('${TEST_TENANT_B}', 'Tenant Test B', 'tenant-test-b', 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
    VALUES 
      ('${TEST_TENANT_A}', '4see', true),
      ('${TEST_TENANT_B}', '4see', true)
    ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;
  `, [], { isSuperAdmin: true });

  // 1. Inicializar tablas
  await ensureSmartPriceTables();
  pass('Tablas relacionales 1:N y políticas RLS inicializadas correctamente');

  // --- 2. Pruebas Unitarias de Lógica Pura: SmartPrice Engine ---
  console.log('\n--- 1. Pruebas Unitarias: Piso Inquebrantable & Clampeo ---');

  const sampleProduct = {
    id: 'prod-001',
    cost_price: 1000.00,
    min_margin_percentage: 20.00, // 20%
    operating_costs: 150.00,
    max_price_ceiling: 2500.00,
    current_price: 1500.00
  };

  // Floor = 1000 * 1.20 + 150 = 1350.00
  const floorCalculated = calculateHardFloor(sampleProduct);
  assert.strictEqual(floorCalculated, 1350.00);
  pass(`Cálculo de piso inquebrantable exacto: $${floorCalculated} (Costo: $1000 + 20% margen + $150 flete/op)`);

  // Caso 2.1: Rival tira el precio por debajo del costo ($1200)
  const clampedBelow = clampPrice(1200.00, floorCalculated, sampleProduct.max_price_ceiling);
  assert.strictEqual(clampedBelow.finalPrice, 1350.00);
  assert.strictEqual(clampedBelow.floorApplied, true);
  pass('Blindaje de margen: Intento de bajar a $1200 forzado al piso inquebrantable ($1350)');

  // Caso 2.2: Precio dentro de banda ($1800)
  const clampedNormal = clampPrice(1800.00, floorCalculated, sampleProduct.max_price_ceiling);
  assert.strictEqual(clampedNormal.finalPrice, 1800.00);
  assert.strictEqual(clampedNormal.floorApplied, false);
  pass('Banda normal: Precio $1800 respetado sin activar flags de protección');

  // Caso 2.3: Precio supera el techo ($2800 > $2500)
  const clampedCeiling = clampPrice(2800.00, floorCalculated, sampleProduct.max_price_ceiling);
  assert.strictEqual(clampedCeiling.finalPrice, 2500.00);
  assert.strictEqual(clampedCeiling.ceilingApplied, true);
  pass('Límite superior: Intento de subir a $2800 clampeado al ceiling ($2500)');

  // --- 3. Evaluación de Reglas Deterministas (IF/THEN) ---
  console.log('\n--- 2. Evaluación de Reglas SmartPrice ---');

  const mappingsSample = [
    { competitor_id: 'comp-rival-a', last_scraped_price: 1600.00, last_scraped_stock: 'IN_STOCK', is_active: true },
    { competitor_id: 'comp-rival-b', last_scraped_price: 1400.00, last_scraped_stock: 'IN_STOCK', is_active: true },
    { competitor_id: 'comp-rival-c', last_scraped_price: 1300.00, last_scraped_stock: 'OUT_OF_STOCK', is_active: true }
  ];

  // Regla: 5% por debajo del más barato en stock (LOWEST_MARKET)
  // El más barato en stock es Rival B ($1400). 1400 * 0.95 = 1330.
  // Pero el piso inquebrantable es 1350. Debería sugerir 1350 con floor_applied = true.
  const rulesLowest = [
    {
      id: 'rule-lowest',
      name: '5% below lowest',
      trigger_condition: 'LOWEST_MARKET',
      action_type: 'PERCENT_OFFSET_BELOW',
      offset_value: 5.00,
      priority: 10,
      is_active: true
    }
  ];

  const evalResult = evaluateSmartPrice(sampleProduct, mappingsSample, rulesLowest);
  assert.strictEqual(evalResult.suggested_price, 1350.00);
  assert.strictEqual(evalResult.floor_applied, true);
  pass('Regla LOWEST_MARKET: Rival B $1400 -> cálculo $1330 interceptado y elevado al piso $1350');

  // Regla de Quiebre Ajeno (OUT_OF_STOCK_RIVAL)
  // Rival C está quebrado ($1300 OUT_OF_STOCK). Capturar sobremargen hacia el siguiente ($1400)
  const rulesQuiebre = [
    {
      id: 'rule-quiebre',
      name: 'Capturar sobremargen',
      trigger_condition: 'OUT_OF_STOCK_RIVAL',
      action_type: 'MATCH',
      offset_value: 0,
      priority: 20,
      is_active: true
    }
  ];

  const evalQuiebre = evaluateSmartPrice(sampleProduct, mappingsSample, rulesQuiebre);
  assert.strictEqual(evalQuiebre.suggested_price, 1400.00);
  assert.strictEqual(evalQuiebre.trigger_reason, 'RIVAL_OUT_OF_STOCK_CAPTURE_NEXT_BEST');
  pass('Regla OUT_OF_STOCK_RIVAL: Detección de quiebre y captura de sobremargen hacia el siguiente competidor en stock ($1400)');

  // --- 4. Pruebas de Integración API REST & Multi-Tenancy RLS ---
  console.log('\n--- 3. Pruebas de Integración API REST & RLS ---');

  const adminUser = {
    email: 'admin@test-a.com',
    role: '4SEE_ADMIN',
    permissions: ['4see:catalog:read', '4see:catalog:audit', '4see:pricing:write', '4see:rules:manage', '4see:queue:approve']
  };

  // Crear Producto Propio vía API
  const mockResProd = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/products', method: 'POST' },
    mockResProd,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      data: {
        sku: `SKU-SMART-${Date.now()}`,
        title: 'Auriculares Bluetooth Pro',
        cost_price: 2000.00,
        operating_costs: 300.00,
        min_margin_percentage: 15.00, // Floor = 2000 * 1.15 + 300 = 2600.00
        max_price_ceiling: 4500.00,
        current_price: 3200.00,
        stock_quantity: 10
      },
      isSuperAdmin: false
    }
  );

  assert.strictEqual(mockResProd.statusCode, 201);
  const createdProd = mockResProd.json().product;
  assert.strictEqual(parseFloat(createdProd.min_price_floor), 2600.00);
  pass(`Producto creado vía API con min_price_floor autogenerado en PostgreSQL: $${createdProd.min_price_floor}`);

  // Crear Competidor A y B vía API
  const mockResComp1 = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/competitors', method: 'POST' },
    mockResComp1,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      data: { name: 'ElectroStore', domain_url: `https://electro-${Date.now()}.com`, priority_weight: 1 },
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResComp1.statusCode, 201);
  const compId1 = mockResComp1.json().id;

  const mockResComp2 = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/competitors', method: 'POST' },
    mockResComp2,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      data: { name: 'MegaTech', domain_url: `https://megatech-${Date.now()}.com`, priority_weight: 2 },
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResComp2.statusCode, 201);
  const compId2 = mockResComp2.json().id;
  pass('Competidores registrados en directorio');

  // Mapeo 1:N (Producto <-> Competidor 1 y Competidor 2)
  const mockResMap1 = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/mappings', method: 'POST' },
    mockResMap1,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      data: { product_id: createdProd.id, competitor_id: compId1, competitor_url: 'https://electro.com/prod/123' },
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResMap1.statusCode, 201);

  const mockResMap2 = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/mappings', method: 'POST' },
    mockResMap2,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      data: { product_id: createdProd.id, competitor_id: compId2, competitor_url: 'https://megatech.com/prod/456' },
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResMap2.statusCode, 201);
  pass('Mapeo 1:N exitoso: 1 SKU vinculado simultáneamente a 2 URLs de competidores distintos');

  // Crear Regla SmartPrice
  const mockResRule = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/rules', method: 'POST' },
    mockResRule,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      data: {
        product_id: createdProd.id,
        name: 'Igualar a ElectroStore',
        trigger_condition: 'TARGET_COMPETITOR',
        target_competitor_id: compId1,
        action_type: 'MATCH',
        offset_value: 0,
        auto_dispatch: false,
        priority: 5
      },
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResRule.statusCode, 201);
  pass('Regla de repricing creada y asociada al producto');

  // Simular inserción de sugerencia en cola
  const queueId = crypto.randomUUID();
  await execute(`
    INSERT INTO fourseee_price_update_queue
    (id, tenant_id, product_id, rule_id, previous_price, calculated_price, suggested_price, floor_applied, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [queueId, TEST_TENANT_A, createdProd.id, mockResRule.json().id, 3200.00, 2900.00, 2900.00, false, 'PENDING'], { tenantId: TEST_TENANT_A });

  // Aprobación manual en 1 clic
  const mockResApprove = createMockRes();
  await handle4seeApi(
    { url: `/api/4see/queue/${queueId}/approve`, method: 'POST' },
    mockResApprove,
    {
      currentUser: adminUser,
      tenantId: TEST_TENANT_A,
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResApprove.statusCode, 200);
  assert.strictEqual(parseFloat(mockResApprove.json().newPrice), 2900.00);

  const updatedProd = await getOne('SELECT current_price FROM fourseee_products WHERE id = ?', [createdProd.id], { tenantId: TEST_TENANT_A });
  assert.strictEqual(parseFloat(updatedProd.current_price), 2900.00);
  pass('Aprobación manual en 1 clic: sugerencia aplicada y precio propio actualizado en catálogo');

  // --- 5. Aislamiento Multi-Tenant Estricto (Zero Data Leakage) ---
  console.log('\n--- 4. Verificación de Aislamiento Multi-Tenant RLS ---');

  const mockResTenantB = createMockRes();
  await handle4seeApi(
    { url: '/api/4see/products', method: 'GET' },
    mockResTenantB,
    {
      currentUser: { email: 'user@tenant-b.com', permissions: ['4see:catalog:read'] },
      tenantId: TEST_TENANT_B,
      isSuperAdmin: false
    }
  );
  assert.strictEqual(mockResTenantB.statusCode, 200);
  const prodsTenantB = mockResTenantB.json().products;
  const leakage = prodsTenantB.find(p => p.id === createdProd.id);
  assert.strictEqual(leakage, undefined);
  pass('Zero Data Leakage: Tenant B NO visualiza productos ni mappings creados por Tenant A');

  console.log('\n======================================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[FATAL] Error en suite de pruebas SmartPrice:', err);
  process.exit(1);
});
