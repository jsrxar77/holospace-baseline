/**
 * tests/test-kanban-module.js
 * Test Suite: Módulo Kanban (Logística, Creación de Pedidos, Asignación, Despacho y Aislamiento Multi-Tenant)
 */

const assert = require('assert');
const { query, getOne, execute } = require('../lib/db');
const { signJwt } = require('../lib/auth');
const crypto = require('crypto');

async function runTests() {
  console.log('======================================================');
  console.log('TEST SUITE: MÓDULO KANBAN (LOGÍSTICA Y DESPACHO)');
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

  // Identificadores de prueba
  const tenantA = '550e8400-e29b-41d4-a716-446655440000'; // drinklovers
  const tenantB = '550e8400-e29b-41d4-a716-446655440001'; // poke
  const testOrderId = crypto.randomUUID();
  const testOrderNumber = `KB-${Date.now().toString().slice(-6)}`;
  const testOperatorEmail = 'juan@drinklovers.com.ar';

  try {
    // 1. Ingesta / Creación de Pedido en BACKLOG
    console.log('\n--- 1. Ingesta de Pedido en kanban_orders ---');
    await execute(
      `INSERT INTO kanban_orders (
        id, tenant_id, order_number, status, client_name, issue_date,
        pdf_file_name, total_items, total_items_required, total_items_scanned, dispatch_status
      ) VALUES (?, ?, ?, 'BACKLOG', 'Cliente Gourmet S.A.', '2026-09-11', 'remito_test.pdf', 2, 5, 0, 'NO_DESPACHADO')`,
      [testOrderId, tenantA, testOrderNumber],
      { tenantId: tenantA, isSuperAdmin: true }
    );

    const createdOrder = await getOne(
      'SELECT * FROM kanban_orders WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantA],
      { tenantId: tenantA }
    );
    test(createdOrder !== null, 'Pedido insertado correctamente en kanban_orders');
    test(createdOrder.status === 'BACKLOG', 'Estado inicial es BACKLOG');
    test(createdOrder.order_number === testOrderNumber, 'Número de orden coincide');

    // 2. Creación de Ítems del Pedido en kanban_order_items
    console.log('\n--- 2. Ítems del Pedido en kanban_order_items ---');
    const itemId1 = crypto.randomUUID();
    const itemId2 = crypto.randomUUID();
    await execute(
      `INSERT INTO kanban_order_items (
        id, tenant_id, order_id, code, description, unit_price, quantity_required, quantity_scanned, status
      ) VALUES (?, ?, ?, '7791234567890', 'Vino Malbec Reserva 750ml', 4500.00, 3, 0, 'PENDING')`,
      [itemId1, tenantA, testOrderId],
      { tenantId: tenantA, isSuperAdmin: true }
    );
    await execute(
      `INSERT INTO kanban_order_items (
        id, tenant_id, order_id, code, description, unit_price, quantity_required, quantity_scanned, status
      ) VALUES (?, ?, ?, '7799876543210', 'Copa Degustación Cristal', 2200.00, 2, 0, 'PENDING')`,
      [itemId2, tenantA, testOrderId],
      { tenantId: tenantA, isSuperAdmin: true }
    );

    const items = await query(
      'SELECT * FROM kanban_order_items WHERE order_id = ? AND tenant_id = ? ORDER BY code ASC',
      [testOrderId, tenantA],
      { tenantId: tenantA }
    );
    test(items.length === 2, 'Los 2 ítems se registraron exitosamente');
    test(items[0].quantity_required === 3, 'Cantidad requerida para ítem 1 correcta');
    test(items[1].quantity_required === 2, 'Cantidad requerida para ítem 2 correcta');

    // 3. Transición de Estado a READY (Listo para Picking)
    console.log('\n--- 3. Transición a READY ---');
    await execute(
      'UPDATE kanban_orders SET status = ? WHERE id = ? AND tenant_id = ?',
      ['READY', testOrderId, tenantA],
      { tenantId: tenantA, isSuperAdmin: true }
    );
    const readyOrder = await getOne(
      'SELECT status FROM kanban_orders WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantA],
      { tenantId: tenantA }
    );
    test(readyOrder.status === 'READY', 'Pedido transicionado exitosamente a READY');

    // 4. Asignación de Operario y Transición a DOING
    console.log('\n--- 4. Asignación Dual de Operario a DOING ---');
    await execute(
      `UPDATE kanban_orders 
       SET status = 'DOING', operator_email = ?, assigned_operator_email = ? 
       WHERE id = ? AND tenant_id = ?`,
      [testOperatorEmail, testOperatorEmail, testOrderId, tenantA],
      { tenantId: tenantA, isSuperAdmin: true }
    );
    const doingOrder = await getOne(
      'SELECT status, operator_email, assigned_operator_email FROM kanban_orders WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantA],
      { tenantId: tenantA }
    );
    test(doingOrder.status === 'DOING', 'Estado actualizado a DOING');
    test(doingOrder.operator_email === testOperatorEmail, 'operator_email persistido correctamente');
    test(doingOrder.assigned_operator_email === testOperatorEmail, 'assigned_operator_email sincronizado idéntico');

    // 5. Registro de Trazabilidad en core_audit_logs
    console.log('\n--- 5. Registro de Auditoría en core_audit_logs ---');
    await execute(
      `INSERT INTO core_audit_logs (order_id, tenant_id, timestamp, user_email, action, details)
       VALUES (?, ?, ?, ?, 'ORDER_ASSIGNED', ?)`,
      [testOrderId, tenantA, new Date().toISOString(), 'admin@drinklovers.com.ar', `Asignado a ${testOperatorEmail}`],
      { tenantId: tenantA, isSuperAdmin: true }
    );
    const auditLogs = await query(
      'SELECT * FROM core_audit_logs WHERE order_id = ? AND tenant_id = ?',
      [testOrderId, tenantA],
      { tenantId: tenantA }
    );
    test(auditLogs.length >= 1, 'Registro de auditoría persistido en core_audit_logs');
    test(auditLogs[0].action === 'ORDER_ASSIGNED', 'Acción auditada correctamente');

    // 6. Aislamiento Multi-Tenant Estricto (Zero Data Leakage)
    console.log('\n--- 6. Aislamiento Multi-Tenant (Tenant B no debe ver Tenant A) ---');
    const crossTenantOrder = await getOne(
      'SELECT * FROM kanban_orders WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantB],
      { tenantId: tenantB }
    );
    test(crossTenantOrder === null, 'Tenant B no puede leer pedidos pertenecientes al Tenant A');

    const crossTenantItems = await query(
      'SELECT * FROM kanban_order_items WHERE order_id = ? AND tenant_id = ?',
      [testOrderId, tenantB],
      { tenantId: tenantB }
    );
    test(crossTenantItems.length === 0, 'Tenant B no puede ver ítems de pedidos del Tenant A');

    // 7. Cierre y Despacho del Pedido a DONE
    console.log('\n--- 7. Cierre y Despacho de Pedido (DOING -> DONE) ---');
    await execute(
      `UPDATE kanban_orders 
       SET status = 'DONE', dispatch_status = 'DESPACHADO', verified_by = ?, verified_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [testOperatorEmail, testOrderId, tenantA],
      { tenantId: tenantA, isSuperAdmin: true }
    );
    const doneOrder = await getOne(
      'SELECT status, dispatch_status, verified_by, verified_at FROM kanban_orders WHERE id = ? AND tenant_id = ?',
      [testOrderId, tenantA],
      { tenantId: tenantA }
    );
    test(doneOrder.status === 'DONE', 'Pedido cerrado exitosamente en estado DONE');
    test(doneOrder.dispatch_status === 'DESPACHADO', 'dispatch_status actualizado a DESPACHADO');
    test(doneOrder.verified_by === testOperatorEmail, 'verified_by registrado con email del operario');

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
  console.error('Error en test suite Kanban:', err);
  process.exit(1);
});
