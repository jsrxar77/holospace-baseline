/**
 * tests/test-4see-stores.js
 * Suite de Pruebas Automatizadas para Conexiones Persistentes Multi-Tienda (4see Stores)
 * Verifica: CRUD, enmascaramiento seguro de credenciales, resolución en auditoría on-the-fly y RLS multi-tenant.
 */

const crypto = require('crypto');
const { query, execute, getOne } = require('../lib/db');
const { handle4seeApi } = require('../modules/4see/routes/api');

async function runTests() {
  console.log('======================================================================');
  console.log('TEST SUITE: GESTIÓN DE TIENDAS CONECTADAS MULTI-STORE (4SEE)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // Helper para simular llamadas al handler de la API
  function createMockRes() {
    let statusCode = 200;
    let headers = {};
    let body = '';
    return {
      writeHead: (code, h) => {
        statusCode = code;
        headers = h || {};
      },
      end: (data) => {
        body = data;
      },
      getStatusCode: () => statusCode,
      getBody: () => {
        try {
          return JSON.parse(body);
        } catch (e) {
          return body;
        }
      }
    };
  }

  const { setTenantModuleState } = require('../lib/entitlement');

  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  // Asegurar tenants en base de datos con modulo 4see habilitado
  await execute(
    `INSERT INTO tenant_tenants (id, name, slug, status)
     VALUES (?, 'Tenant A Tests', 'tenant-a-tests', 'active'),
            (?, 'Tenant B Tests', 'tenant-b-tests', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [tenantA, tenantB]
  );

  await setTenantModuleState(tenantA, '4see', true, 'superadmin@holospace.com');
  await setTenantModuleState(tenantB, '4see', true, 'superadmin@holospace.com');

  const userTenantA = {
    id: crypto.randomUUID(),
    email: 'admin@tenant-a.com',
    role: 'ADMIN',
    permissions: ['4see:catalog:read', '4see:catalog:audit', '4see:pricing:write']
  };

  const userTenantB = {
    id: crypto.randomUUID(),
    email: 'admin@tenant-b.com',
    role: 'ADMIN',
    permissions: ['4see:catalog:read', '4see:catalog:audit', '4see:pricing:write']
  };

  let createdStoreId = null;

  try {
    // 1. Crear Tienda Conectada (WooCommerce)
    console.log('\n--- 1. Creación de Tienda Conectada (POST /api/4see/stores) ---');
    const reqCreate = { url: '/api/4see/stores', method: 'POST' };
    const resCreate = createMockRes();
    const dataCreate = {
      name: 'Poke Argentina',
      platform: 'WOOCOMMERCE',
      store_url: 'https://poke.com.ar',
      credentials: {
        consumer_key: 'ck_5d9b7c8a50fb3214e48197e7582ff9e39736ebee',
        consumer_secret: 'cs_c8eeeb753df32ca1c96dde7cec9031fb575132dd'
      }
    };

    await handle4seeApi(reqCreate, resCreate, {
      currentUser: userTenantA,
      tenantId: tenantA,
      data: dataCreate,
      isSuperAdmin: false
    });

    const bodyCreate = resCreate.getBody();
    assert(resCreate.getStatusCode() === 201, 'Endpoint responde HTTP 201 Created');
    assert(bodyCreate.success === true, 'Respuesta indica éxito en creación');
    assert(bodyCreate.store && bodyCreate.store.id, 'Retorna el ID autogenerado de la tienda');
    assert(bodyCreate.store.credentials.consumer_secret.includes('••••'), 'Consumer Secret retornado con máscara segura');
    assert(bodyCreate.store.name === 'Poke Argentina', 'Nombre de la tienda guardado correctamente');

    createdStoreId = bodyCreate.store.id;

    // 2. Listar Tiendas de la Organización
    console.log('\n--- 2. Listado Seguro de Tiendas (GET /api/4see/stores) ---');
    const reqList = { url: '/api/4see/stores', method: 'GET' };
    const resList = createMockRes();

    await handle4seeApi(reqList, resList, {
      currentUser: userTenantA,
      tenantId: tenantA,
      data: {},
      isSuperAdmin: false
    });

    const bodyList = resList.getBody();
    assert(resList.getStatusCode() === 200, 'Endpoint responde HTTP 200 OK');
    assert(Array.isArray(bodyList.stores), 'Retorna arreglo de tiendas');
    const foundStore = bodyList.stores.find(s => s.id === createdStoreId);
    assert(!!foundStore, 'La tienda creada aparece en el listado');
    assert(foundStore.credentials.consumer_secret.includes('••••'), 'Secretos permanecen enmascarados en el listado');

    // 3. Aislamiento Multi-Tenant (RLS)
    console.log('\n--- 3. Aislamiento Estricto Multi-Tenant (Zero Data Leakage) ---');
    const reqListB = { url: '/api/4see/stores', method: 'GET' };
    const resListB = createMockRes();

    await handle4seeApi(reqListB, resListB, {
      currentUser: userTenantB,
      tenantId: tenantB,
      data: {},
      isSuperAdmin: false
    });

    const bodyListB = resListB.getBody();
    const leakedStore = (bodyListB.stores || []).find(s => s.id === createdStoreId);
    assert(!leakedStore, 'Tenant B NO puede ver la tienda conectada de Tenant A (Zero Leakage)');

    // 4. Actualización sin Pérdida de Credenciales Ocultas
    console.log('\n--- 4. Actualización Incremental de Tienda Conectada ---');
    const reqUpdate = { url: '/api/4see/stores', method: 'POST' };
    const resUpdate = createMockRes();
    const dataUpdate = {
      id: createdStoreId,
      name: 'Poke Argentina - Sucursal Central',
      platform: 'WOOCOMMERCE',
      store_url: 'https://poke.com.ar',
      credentials: {
        consumer_secret: '••••••••' // Valor enmascarado enviado por el cliente
      }
    };

    await handle4seeApi(reqUpdate, resUpdate, {
      currentUser: userTenantA,
      tenantId: tenantA,
      data: dataUpdate,
      isSuperAdmin: false
    });

    assert(resUpdate.getStatusCode() === 200, 'Actualización responde HTTP 200 OK');
    const storeInDb = await getOne(
      'SELECT * FROM fourseee_connected_stores WHERE id = ?',
      [createdStoreId],
      { tenantId: tenantA }
    );
    const dbCreds = typeof storeInDb.credentials === 'string' ? JSON.parse(storeInDb.credentials) : storeInDb.credentials;
    assert(dbCreds.consumer_secret === 'cs_c8eeeb753df32ca1c96dde7cec9031fb575132dd', 'El secreto real no fue sobrescrito con el valor enmascarado');
    assert(storeInDb.name === 'Poke Argentina - Sucursal Central', 'Nombre actualizado en la base de datos');

    // 5. Auditoría On-The-Fly con store_id (Resolución de credenciales en servidor)
    console.log('\n--- 5. Auditoría On-The-Fly usando store_id ---');
    // Para no disparar llamadas HTTP externas en la suite si no hay red, validamos que el endpoint reconozca el store_id
    const reqAuditWithStore = { url: '/api/4see/store/audit-live', method: 'POST' };
    const resAuditWithStore = createMockRes();

    // Probamos con una tienda inexistente para verificar el 404
    await handle4seeApi(reqAuditWithStore, resAuditWithStore, {
      currentUser: userTenantA,
      tenantId: tenantA,
      data: { store_id: crypto.randomUUID() },
      isSuperAdmin: false
    });
    assert(resAuditWithStore.getStatusCode() === 404, 'Detecta correctamente 404 si el store_id no existe o pertenece a otro tenant');

    // 6. Desconexión Lógica (Soft Delete)
    console.log('\n--- 6. Desconexión Lógica (DELETE /api/4see/stores/:id) ---');
    const reqDelete = { url: `/api/4see/stores/${createdStoreId}`, method: 'DELETE' };
    const resDelete = createMockRes();

    await handle4seeApi(reqDelete, resDelete, {
      currentUser: userTenantA,
      tenantId: tenantA,
      data: {},
      isSuperAdmin: false
    });

    assert(resDelete.getStatusCode() === 200, 'Responde HTTP 200 en desconexión');
    const deactivatedStore = await getOne(
      'SELECT * FROM fourseee_connected_stores WHERE id = ?',
      [createdStoreId],
      { tenantId: tenantA }
    );
    assert(deactivatedStore.is_active === false, 'La tienda queda con is_active = false (borrado lógico)');

  } finally {
    // Limpieza de datos de prueba
    if (createdStoreId) {
      await execute('DELETE FROM fourseee_connected_stores WHERE id = ?', [createdStoreId]);
    }
    await execute('DELETE FROM tenant_tenants WHERE id IN (?, ?)', [tenantA, tenantB]);
  }

  console.log('======================================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Error fatal en suite:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
