/**
 * lib/db.js - HoloWare Multi-Tenant Database Adapter Layer
 * 100% PostgreSQL 16 Nativo con Row-Level Security (RLS) y Pool de Conexiones
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pgPool = null;

const DEFAULT_DATABASE_URL = 'postgres://holoware_admin:Secr3tP@ssword2026@127.0.0.1:5434/holoware_saas';
const DEFAULT_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEFAULT_TENANT_SLUG = 'holoware';

/**
 * Inicialización del Pool de Conexiones PostgreSQL
 */
function initDatabase() {
  if (pgPool) return pgPool;

  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

  pgPool = new Pool({
    connectionString: databaseUrl,
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pgPool.on('error', (err) => {
    console.error('💥 [PostgreSQL] Error inesperado en el pool de conexiones:', err.message);
  });

  console.log('✅ [DB] Conectado a PostgreSQL 16 (Modo Multi-Tenant RLS exclusivo):', databaseUrl.replace(/:[^:@]+@/, ':****@'));
  return pgPool;
}

/**
 * Helper para convertir placeholders '?' a sintaxis PostgreSQL '$1, $2, ...'
 */
function normalizeSql(sql) {
  let paramIdx = 1;
  return sql.replace(/\?/g, () => `$${paramIdx++}`);
}

/**
 * Ejecutar consulta SQL en PostgreSQL con contexto de aislamiento RLS
 * @param {string} sql - Consulta SQL (admite sintaxis $1 o ?)
 * @param {Array} params - Parámetros de la consulta
 * @param {Object} context - { tenantId, isSuperAdmin }
 * @returns {Promise<Array>} Registros resultantes
 */
async function query(sql, params = [], context = {}) {
  if (!pgPool) initDatabase();
  const client = await pgPool.connect();

  try {
    const formattedSql = normalizeSql(sql);

    // Configurar contexto de sesión para Row-Level Security
    if (context.isSuperAdmin) {
      await client.query(`SELECT set_config('app.is_superadmin', 'true', true);`);
    } else if (context.tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [String(context.tenantId)]);
    }

    const res = await client.query(formattedSql, params);
    return res.rows;
  } catch (err) {
    console.error(`❌ [PostgreSQL Error] en query: "${sql}"`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Obtener un solo registro
 */
async function getOne(sql, params = [], context = {}) {
  const rows = await query(sql, params, context);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Ejecutar sentencia de mutación (INSERT, UPDATE, DELETE) retornando metadatos
 */
async function execute(sql, params = [], context = {}) {
  if (!pgPool) initDatabase();
  const client = await pgPool.connect();

  try {
    const formattedSql = normalizeSql(sql);

    if (context.isSuperAdmin) {
      await client.query(`SELECT set_config('app.is_superadmin', 'true', true);`);
    } else if (context.tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [String(context.tenantId)]);
    }

    const res = await client.query(formattedSql, params);
    return {
      rowCount: res.rowCount,
      rows: res.rows
    };
  } catch (err) {
    console.error(`❌ [PostgreSQL Error] en execute: "${sql}"`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ejecutar una transacción atómica con aislamiento RLS
 */
async function transaction(callback, context = {}) {
  if (!pgPool) initDatabase();
  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    if (context.isSuperAdmin) {
      await client.query(`SELECT set_config('app.is_superadmin', 'true', true);`);
    } else if (context.tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [String(context.tenantId)]);
    }

    const txHelper = {
      query: async (sql, params = []) => {
        const res = await client.query(normalizeSql(sql), params);
        return res.rows;
      },
      getOne: async (sql, params = []) => {
        const res = await client.query(normalizeSql(sql), params);
        return res.rows.length > 0 ? res.rows[0] : null;
      },
      execute: async (sql, params = []) => {
        const res = await client.query(normalizeSql(sql), params);
        return { rowCount: res.rowCount, rows: res.rows };
      }
    };

    const result = await callback(txHelper);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function getPool() {
  if (!pgPool) initDatabase();
  return pgPool;
}

module.exports = {
  initDatabase,
  query,
  getOne,
  execute,
  transaction,
  getPool,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG
};
