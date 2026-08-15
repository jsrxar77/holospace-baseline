#!/usr/bin/env node
/**
 * bin/tenant-dump.sh (ejecutable vía node o bash)
 * Utilidad de Exportación y Aislamiento de Datos por Tenant sobre PostgreSQL 16
 */

const fs = require('fs');
const path = require('path');
const { getOne, query } = require('../lib/db');

async function exportTenant() {
  const targetTenant = process.argv[2] || 'drinklovers';

  const tenant = await getOne(
    'SELECT * FROM tenants WHERE slug = ? OR id::text = ?',
    [targetTenant, targetTenant],
    { isSuperAdmin: true }
  );

  if (!tenant) {
    console.error(`❌ Tenant '${targetTenant}' no encontrado en PostgreSQL.`);
    process.exit(1);
  }

  console.log('======================================================');
  console.log(`📦 EXPORTADOR AISLADO DE DATOS: TENANT [${tenant.name}]`);
  console.log('======================================================');

  const tenantId = tenant.id;
  const users = await query('SELECT email, name, role, is_active FROM users WHERE tenant_id = ?', [tenantId], { tenantId });
  const orders = await query('SELECT * FROM orders WHERE tenant_id = ?', [tenantId], { tenantId });
  const orderItems = await query('SELECT * FROM order_items WHERE tenant_id = ?', [tenantId], { tenantId });
  const modules = await query('SELECT module_code, is_enabled FROM tenant_modules WHERE tenant_id = ?', [tenantId], { tenantId });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    tenant,
    modules,
    users,
    ordersCount: orders.length,
    orders,
    orderItemsCount: orderItems.length,
    orderItems
  };

  const outputDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `tenant_export_${tenant.slug}_${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(exportPayload, null, 2), 'utf8');

  console.log(`✅ Exportación exitosa desde PostgreSQL:`);
  console.log(` - Usuarios exportados: ${users.length}`);
  console.log(` - Pedidos exportados: ${orders.length}`);
  console.log(` - Ítems exportados: ${orderItems.length}`);
  console.log(`📁 Archivo generado: ${outputFile}`);
  console.log('======================================================');
  process.exit(0);
}

exportTenant().catch(err => {
  console.error('💥 Error exportando datos de Tenant:', err.message);
  process.exit(1);
});
