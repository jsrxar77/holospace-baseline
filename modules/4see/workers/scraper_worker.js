/**
 * modules/4see/workers/scraper_worker.js
 * Worker asíncrono en segundo plano para scraping de competidores
 * y evaluación determinista de SmartPrice sin bloquear el event-loop.
 */

const crypto = require('crypto');
const { query, execute, getOne } = require('../../../lib/db');
const { extractProductData } = require('../lib/extractor');
const { evaluateSmartPrice } = require('../lib/smartprice');
const { TiendanubeConnector } = require('../lib/connectors/tiendanube');
const { WooCommerceConnector } = require('../lib/connectors/woocommerce');

let isRunning = false;

/**
 * Ejecuta un ciclo de scraping y evaluación de reglas de pricing para un tenant o todos.
 * Concurrencia controlada para evitar saturación de red o límites de API.
 * 
 * @param {Object} options
 * @param {string} [options.tenantId]
 * @param {boolean} [options.isSuperAdmin]
 * @param {number} [options.concurrencyLimit=5]
 * @returns {Promise<Object>} Resumen de resultados del ciclo
 */
async function runScraperWorkerCycle({ tenantId, isSuperAdmin = false, concurrencyLimit = 5 } = {}) {
  if (isRunning) {
    return { skipped: true, reason: 'CYCLE_ALREADY_IN_PROGRESS' };
  }

  isRunning = true;
  const startTime = Date.now();
  const summary = {
    totalMappingsProcessed: 0,
    scrapedSuccess: 0,
    scrapedErrors: 0,
    rulesEvaluated: 0,
    priceUpdatesQueued: 0,
    autoDispatchesExecuted: 0
  };

  try {
    // 1. Rivales de los productos en analisis con costos cargados (pasos 2 a 4 de Competencia)
    const tenantFilter = tenantId && !isSuperAdmin ? 'AND m.tenant_id = ?' : '';
    const monitors = await query(
      `SELECT m.id, m.tenant_id, m.product_id, m.competitor_url
       FROM fourseee_competitor_monitors m
       JOIN fourseee_products p ON m.product_id = p.id
       WHERE p.in_analysis = true AND p.costs_loaded = true ${tenantFilter}
       ORDER BY m.last_checked_at ASC NULLS FIRST
       LIMIT 50`,
      tenantId && !isSuperAdmin ? [tenantId] : [],
      { tenantId, isSuperAdmin }
    );

    // 2. Procesar scraping por bloques concurrentes (semáforo)
    const chunks = [];
    for (let i = 0; i < monitors.length; i += concurrencyLimit) {
      chunks.push(monitors.slice(i, i + concurrencyLimit));
    }

    const modifiedProductIds = new Set();

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (monitor) => {
        summary.totalMappingsProcessed++;
        try {
          const extracted = await extractProductData(monitor.competitor_url);
          if (!extracted.ok) {
            // No se pudo leer el precio del rival: no se inventa un 0, se deja el ultimo dato conocido
            summary.scrapedErrors++;
            console.warn(`[4SEE WORKER] No se pudo leer ${monitor.competitor_url}: ${extracted.reason}`);
            return;
          }
          const scrapedPrice = extracted.price;
          // El stock puede ser desconocido (precio leido, disponibilidad no informada): se guarda como UNKNOWN, nunca se supone "con stock"
          const scrapedStock = extracted.inStock === null ? 'UNKNOWN' : (extracted.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK');
          const method = extracted.method || 'STRUCTURED_DATA';

          // Registrar en log inmutable
          const logId = crypto.randomUUID();
          await execute(
            `INSERT INTO fourseee_price_logs (id, tenant_id, monitor_id, scraped_price, scraped_currency, scraped_stock_status, extraction_method)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [logId, monitor.tenant_id, monitor.id, scrapedPrice, extracted.currency || 'ARS', scrapedStock, method],
            { tenantId: monitor.tenant_id }
          );

          await execute(
            `UPDATE fourseee_competitor_monitors
             SET competitor_price = ?, competitor_stock = ?, competitor_read_error = NULL, extraction_method = ?, last_checked_at = CURRENT_TIMESTAMP
             WHERE id = ? AND tenant_id = ?`,
            [scrapedPrice, scrapedStock === 'UNKNOWN' ? null : scrapedStock, method, monitor.id, monitor.tenant_id],
            { tenantId: monitor.tenant_id }
          );

          summary.scrapedSuccess++;
          modifiedProductIds.add({ productId: monitor.product_id, tenantId: monitor.tenant_id });
        } catch (err) {
          summary.scrapedErrors++;
          console.warn(`[4SEE WORKER] Error scraping monitor ${monitor.id}:`, err.message);
        }
      }));
    }

    // 3. Evaluar reglas de SmartPrice para productos con variaciones de competidores
    for (const { productId, tenantId: tId } of modifiedProductIds) {
      summary.rulesEvaluated++;

      const product = await getOne(
        `SELECT * FROM fourseee_products WHERE id = ? AND tenant_id = ?`,
        [productId, tId],
        { tenantId: tId }
      );
      if (!product) continue;

      // Obtener todos los mapeos activos de este producto
      const prodMappings = await query(
        `SELECT id, true AS is_active, competitor_price AS last_scraped_price, competitor_stock AS last_scraped_stock
         FROM fourseee_competitor_monitors WHERE product_id = ? AND tenant_id = ?`,
        [productId, tId],
        { tenantId: tId }
      );

      // Obtener reglas activas aplicables (por producto o globales del tenant)
      const rules = await query(
        `SELECT * FROM fourseee_pricing_rules
         WHERE tenant_id = ? AND is_active = true AND (product_id = ? OR product_id IS NULL)
         ORDER BY priority DESC`,
        [tId, productId],
        { tenantId: tId }
      );

      const evaluation = evaluateSmartPrice(product, prodMappings, rules);
      if (evaluation && evaluation.suggested_price !== undefined) {
        // Encolar en fourseee_price_update_queue si no hay una sugerencia idéntica pendiente
        const existingPending = await getOne(
          `SELECT id FROM fourseee_price_update_queue WHERE product_id = ? AND status = 'PENDING' AND tenant_id = ?`,
          [productId, tId],
          { tenantId: tId }
        );

        const queueId = crypto.randomUUID();
        const initialStatus = evaluation.auto_dispatch ? 'APPROVED' : 'PENDING';

        if (existingPending) {
          await execute(
            `UPDATE fourseee_price_update_queue
             SET calculated_price = ?, suggested_price = ?, floor_applied = ?, rule_id = ?, status = ?, created_at = CURRENT_TIMESTAMP
             WHERE id = ? AND tenant_id = ?`,
            [evaluation.calculated_price, evaluation.suggested_price, evaluation.floor_applied, evaluation.rule_id, initialStatus, existingPending.id, tId],
            { tenantId: tId }
          );
        } else {
          await execute(
            `INSERT INTO fourseee_price_update_queue
             (id, tenant_id, product_id, rule_id, previous_price, calculated_price, suggested_price, floor_applied, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [queueId, tId, productId, evaluation.rule_id, evaluation.previous_price, evaluation.calculated_price, evaluation.suggested_price, evaluation.floor_applied, initialStatus],
            { tenantId: tId }
          );
          summary.priceUpdatesQueued++;
        }

        // Si la regla permite auto_dispatch y hay tienda asociada, ejecutar push inmediato
        if (evaluation.auto_dispatch && product.store_id) {
          try {
            await dispatchPriceUpdate(tId, existingPending ? existingPending.id : queueId, productId, evaluation.suggested_price, product.store_id);
            summary.autoDispatchesExecuted++;
          } catch (dispErr) {
            console.warn(`[4SEE WORKER] Error en auto-dispatch para producto ${productId}:`, dispErr.message);
          }
        }
      }
    }

    summary.durationMs = Date.now() - startTime;
    return summary;
  } finally {
    isRunning = false;
  }
}

/**
 * Despacha el nuevo precio hacia la tienda del cliente y actualiza el estado de la cola
 */
async function dispatchPriceUpdate(tenantId, queueId, productId, newPrice, storeId) {
  const store = await getOne(
    `SELECT * FROM fourseee_connected_stores WHERE id = ? AND tenant_id = ? AND is_active = true`,
    [storeId, tenantId],
    { tenantId }
  );

  if (!store) {
    throw new Error('Tienda no encontrada o inactiva para write-back');
  }

  const credentials = typeof store.credentials === 'string' ? JSON.parse(store.credentials) : (store.credentials || {});
  const platform = (store.platform || '').toUpperCase();

  if (platform === 'TIENDANUBE') {
    const connector = new TiendanubeConnector({
      accessToken: credentials.accessToken || credentials.access_token,
      userId: credentials.userId || credentials.user_id
    });
    await connector.updateProduct(productId, { price: newPrice });
  } else if (platform === 'WOOCOMMERCE') {
    const connector = new WooCommerceConnector({
      storeUrl: credentials.storeUrl || credentials.store_url || store.store_url,
      consumerKey: credentials.consumerKey || credentials.consumer_key,
      consumerSecret: credentials.consumerSecret || credentials.consumer_secret
    });
    await connector.updateProduct(productId, { regular_price: String(newPrice) });
  }

  // Actualizar precio actual del producto en el catálogo propio
  await execute(
    `UPDATE fourseee_products SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
    [newPrice, productId, tenantId],
    { tenantId }
  );

  // Marcar cola como APPLIED
  await execute(
    `UPDATE fourseee_price_update_queue
     SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP
     WHERE id = ? AND tenant_id = ?`,
    [queueId, tenantId],
    { tenantId }
  );
}

module.exports = {
  runScraperWorkerCycle,
  dispatchPriceUpdate
};
