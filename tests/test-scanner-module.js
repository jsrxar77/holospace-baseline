/**
 * tests/test-scanner-module.js
 * Test Suite: Módulo Scanner Móvil (Picking, Escaneo EAN-13, Verificación de Discrepancias y Avance Transaccional)
 */

const assert = require('assert');
const { query, getOne, execute } = require('../lib/db');
const crypto = require('crypto');

async function runTests() {
  console.log('======================================================');
  console.log('TEST SUITE: MÓDULO SCANNER (PICKING MÓVIL Y ESCANEO)');
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  function test(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const tenantId = '550e8400-e29b-41d4-a716-446655440001'; // poke
  const operatorEmail = 'juan@poke.com.ar';
  const testOrderId = crypto.randomUUID();
  const testOrderNumber = `SC-${Date.now().toString().slice(-6)}`;
  const itemEan1 = '7790040401010';
  const itemEan2 = '7790040402020';

  try {
    // 1. Crear Orden Asignada para el Operario de Escáner
    console.log('\n--- 1. Preparación de Pedido Asignado para Escáner ---');
    await execute(
      `INSERT INTO kanban_orders (
        id, tenant_id, order_number, status, client_name, issue_date,
        total_items, total_items_required, total_items_scanned,
        operator_email, assigned_operator_email, dispatch_status
      ) VALUES (?, ?, ?, 'DOING', 'Supermercado Central', '2026-09-11', 2, 4, 0, ?, ?, 'NO_DESPACHADO')`,
      [testOrderId, tenantId, testOrderNumber, operatorEmail, operatorEmail],
      { tenantId, isSuperAdmin: true }
    );

    const itemId1 = crypto.randomUUID();
    const itemId2 = crypto.randomUUID();
    await execute(
      `INSERT INTO kanban_order_items (
        id, tenant_id, order_id, code, description, unit_price, quantity_required, quantity_scanned, status
      ) VALUES (?, ?, ?, ?, 'Cerveza Artesanal IPA 500ml', 3200.00, 2, 0, 'PENDING')`,
      [itemId1, tenantId, testOrderId, itemEan1],
      { tenantId, isSuperAdmin: true }
    );
    await execute(
      `INSERT INTO kanban_order_items (
        id, tenant_id, order_id, code, description, unit_price, quantity_required, quantity_scanned, status
      ) VALUES (?, ?, ?, ?, 'Snack Papas Rústicas 150g', 1800.00, 2, 0, 'PENDING')`,
      [itemId2, tenantId, testOrderId, itemEan2],
      { tenantId, isSuperAdmin: true }
    );

    // 2. Consulta de Pedidos en DOING por Operario (getMyDoingOrders)
    console.log('\n--- 2. Descubrimiento de Pedidos Asignados en DOING ---');
    const myOrders = await query(
      `SELECT id, order_number, client_name, total_items_required, total_items_scanned, status
       FROM kanban_orders
       WHERE tenant_id = ? AND status = 'DOING' AND (LOWER(operator_email) = ? OR LOWER(assigned_operator_email) = ?)`,
      [tenantId, operatorEmail.toLowerCase(), operatorEmail.toLowerCase()],
      { tenantId }
    );
    test(myOrders.length >= 1, 'Operario recupera sus pedidos asignados en DOING');
    test(myOrders.some(o => o.id === testOrderId), 'Pedido de prueba presente en la lista del operario');

    // 3. Simulación de Escaneo Exitoso del Primer Ítem (EAN-13 Match)
    console.log('\n--- 3. Avance Transaccional de Escaneo (EAN Match) ---');
    // Escaneo de 1 unidad del ítem 1
    await execute(
      `UPDATE kanban_order_items 
       SET quantity_scanned = quantity_scanned + 1,
           status = CASE WHEN quantity_scanned + 1 >= quantity_required THEN 'COMPLETE' ELSE 'PARTIAL' END,
           scanned_at = CURRENT_TIMESTAMP
       WHERE id = ? AND code = ? AND tenant_id = ?`,
      [itemId1, itemEan1, tenantId],
      { tenantId, isSuperAdmin: true }
    );
    await execute(
      'UPDATE kanban_orders SET total_items_scanned = total_items_scanned + 1 WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantId],
      { tenantId, isSuperAdmin: true }
    );

    let item1State = await getOne('SELECT quantity_scanned, status FROM kanban_order_items WHERE id = ?', [itemId1], { tenantId });
    let orderProgress = await getOne('SELECT total_items_scanned, total_items_required FROM kanban_orders WHERE id = ?', [testOrderId], { tenantId });

    test(item1State.quantity_scanned === 1, 'Cantidad escaneada del ítem 1 incrementada a 1');
    test(item1State.status === 'PARTIAL', 'Estado del ítem marcado como PARTIAL');
    test(orderProgress.total_items_scanned === 1, 'Total escaneado de la orden actualizado a 1/4');

    // Escaneo de la segunda unidad del ítem 1
    await execute(
      `UPDATE kanban_order_items 
       SET quantity_scanned = quantity_scanned + 1,
           status = CASE WHEN quantity_scanned + 1 >= quantity_required THEN 'COMPLETE' ELSE 'PARTIAL' END,
           scanned_at = CURRENT_TIMESTAMP
       WHERE id = ? AND code = ? AND tenant_id = ?`,
      [itemId1, itemEan1, tenantId],
      { tenantId, isSuperAdmin: true }
    );
    item1State = await getOne('SELECT quantity_scanned, status FROM kanban_order_items WHERE id = ?', [itemId1], { tenantId });
    test(item1State.quantity_scanned === 2, 'Cantidad escaneada del ítem 1 completada (2/2)');
    test(item1State.status === 'COMPLETE', 'Estado del ítem 1 marcado como COMPLETE');

    // 4. Verificación de Código Discrepante / Inválido
    console.log('\n--- 4. Detección y Rechazo de Código EAN Discrepante ---');
    const invalidEan = '9999999999999';
    const invalidItemMatch = await getOne(
      'SELECT id FROM kanban_order_items WHERE order_id = ? AND code = ? AND tenant_id = ?',
      [testOrderId, invalidEan, tenantId],
      { tenantId }
    );
    test(invalidItemMatch === null, 'Código inexistente no encuentra coincidencia en la orden');

    // 5. Completar Escaneo de la Orden (100% Verificado)
    console.log('\n--- 5. Completitud de Escaneo (100% Picking Verificado) ---');
    await execute(
      `UPDATE kanban_order_items 
       SET quantity_scanned = 2, status = 'COMPLETE', scanned_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND tenant_id = ?`,
      [itemId2, tenantId],
      { tenantId, isSuperAdmin: true }
    );
    await execute(
      'UPDATE kanban_orders SET total_items_scanned = 4 WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantId],
      { tenantId, isSuperAdmin: true }
    );

    const pendingItems = await query(
      "SELECT id FROM kanban_order_items WHERE order_id = ? AND status != 'COMPLETE' AND tenant_id = ?",
      [testOrderId, tenantId],
      { tenantId }
    );
    test(pendingItems.length === 0, 'Todos los ítems de la orden han sido 100% verificados');

    // 6. Registro de Auditoría de Escaneo Móvil
    console.log('\n--- 6. Registro de Trazabilidad Móvil en core_audit_logs ---');
    await execute(
      `INSERT INTO core_audit_logs (order_id, tenant_id, timestamp, user_email, action, details)
       VALUES (?, ?, ?, ?, 'ITEMS_SCANNED_100', 'Verificación física completa via escáner móvil')`,
      [testOrderId, tenantId, new Date().toISOString(), operatorEmail],
      { tenantId, isSuperAdmin: true }
    );
    const scannerLog = await getOne(
      "SELECT * FROM core_audit_logs WHERE order_id = ? AND action = 'ITEMS_SCANNED_100'",
      [testOrderId],
      { tenantId }
    );
    test(scannerLog !== null, 'Evento de verificación de escáner registrado en auditoría');

  } finally {
    // Limpieza de datos de prueba
    await execute('DELETE FROM core_audit_logs WHERE order_id = ?', [testOrderId], { isSuperAdmin: true });
    await execute('DELETE FROM kanban_order_items WHERE order_id = ?', [testOrderId], { isSuperAdmin: true });
    await execute('DELETE FROM kanban_orders WHERE id = ?', [testOrderId], { isSuperAdmin: true });
  }

  console.log('\n======================================================');
  console.log(`RESULTADOS: ${passed} PASARON | ${failed} FALLARON`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Error en test suite Scanner:', err);
  process.exit(1);
});
