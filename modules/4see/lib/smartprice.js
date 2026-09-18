/**
 * modules/4see/lib/smartprice.js
 * Motor de Dynamic Pricing con Piso Inquebrantable (Hard Margin Floor)
 * y resolución determinista de reglas según especificación Prisync.
 */

/**
 * Calcula el piso inquebrantable de precio:
 * Floor = Costo Base * (1 + Margen Mínimo) + Costos Operativos
 * 
 * @param {Object} product
 * @returns {number}
 */
function calculateHardFloor(product) {
  const cost = parseFloat(product.cost_price) || 0;
  const marginPct = parseFloat(product.min_margin_percentage) || 0;
  const opCosts = parseFloat(product.operating_costs) || 0;
  const rawFloor = cost * (1 + (marginPct / 100.0)) + opCosts;
  return Math.round(rawFloor * 100) / 100;
}

/**
 * Clampea un precio calculado contra el piso inquebrantable y el techo máximo permitido.
 * 
 * @param {number} calculatedPrice 
 * @param {number} floorPrice 
 * @param {number|null} ceilingPrice 
 * @returns {{ finalPrice: number, floorApplied: boolean, ceilingApplied: boolean }}
 */
function clampPrice(calculatedPrice, floorPrice, ceilingPrice = null) {
  let finalPrice = calculatedPrice;
  let floorApplied = false;
  let ceilingApplied = false;

  // 1. Techo máximo (si está definido y es > 0)
  if (ceilingPrice !== null && ceilingPrice !== undefined && Number(ceilingPrice) > 0) {
    const numCeiling = parseFloat(ceilingPrice);
    if (finalPrice > numCeiling) {
      finalPrice = numCeiling;
      ceilingApplied = true;
    }
  }

  // 2. Piso inquebrantable (inviolable, prevalece siempre)
  if (finalPrice < floorPrice) {
    finalPrice = floorPrice;
    floorApplied = true;
  }

  return {
    finalPrice: Math.round(finalPrice * 100) / 100,
    floorApplied,
    ceilingApplied
  };
}

/**
 * Evalúa las reglas de SmartPrice para un producto dado frente a la lista de mapeos de competidores.
 * 
 * @param {Object} product - Producto propio con cost_price, min_price_floor, max_price_ceiling, current_price
 * @param {Array<Object>} mappings - Lista de mapeos activos con last_scraped_price, last_scraped_stock, competitor_id, priority_weight
 * @param {Array<Object>} rules - Reglas activas ordenadas por prioridad DESC
 * @returns {Object|null} - Resultado de evaluación con suggested_price, floor_applied, rule_id, trigger_reason
 */
function evaluateSmartPrice(product, mappings = [], rules = []) {
  if (!product) return null;

  const hardFloor = product.min_price_floor !== undefined && product.min_price_floor !== null
    ? parseFloat(product.min_price_floor)
    : calculateHardFloor(product);

  const ceiling = product.max_price_ceiling ? parseFloat(product.max_price_ceiling) : null;
  const currentPrice = parseFloat(product.current_price) || 0;

  // Filtrar mapeos válidos con precio numérico detectado
  const validMappings = mappings.filter(m => m.is_active && m.last_scraped_price !== null && m.last_scraped_price !== undefined);
  const inStockMappings = validMappings.filter(m => (m.last_scraped_stock || '').toUpperCase() === 'IN_STOCK');
  const outOfStockMappings = validMappings.filter(m => (m.last_scraped_stock || '').toUpperCase() === 'OUT_OF_STOCK');

  // Si no hay reglas definidas, aplicar regla por defecto: Proteger piso
  if (!rules || rules.length === 0) {
    if (currentPrice < hardFloor) {
      return {
        product_id: product.id,
        rule_id: null,
        previous_price: currentPrice,
        calculated_price: hardFloor,
        suggested_price: hardFloor,
        floor_applied: true,
        ceiling_applied: false,
        trigger_reason: 'DEFAULT_FLOOR_PROTECTION'
      };
    }
    return null;
  }

  // Ordenar reglas por prioridad DESC
  const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of sortedRules) {
    if (!rule.is_active) continue;

    let targetPrice = null;
    let triggerReason = '';

    // Condición 1: Rival específico
    if (rule.trigger_condition === 'TARGET_COMPETITOR') {
      const match = inStockMappings.find(m => m.competitor_id === rule.target_competitor_id);
      if (match) {
        targetPrice = parseFloat(match.last_scraped_price);
        triggerReason = `TARGET_COMPETITOR_${match.competitor_id}`;
      }
    }
    // Condición 2: El más barato del mercado en stock
    else if (rule.trigger_condition === 'LOWEST_MARKET') {
      if (inStockMappings.length > 0) {
        // Ordenar por precio ASC
        const lowest = [...inStockMappings].sort((a, b) => parseFloat(a.last_scraped_price) - parseFloat(b.last_scraped_price))[0];
        targetPrice = parseFloat(lowest.last_scraped_price);
        triggerReason = 'LOWEST_MARKET_IN_STOCK';
      }
    }
    // Condición 3: Captura de sobremargen por quiebre de stock ajeno
    else if (rule.trigger_condition === 'OUT_OF_STOCK_RIVAL') {
      // Si el rival específico o el más barato está quebrado
      const targetQuiebre = rule.target_competitor_id
        ? outOfStockMappings.find(m => m.competitor_id === rule.target_competitor_id)
        : outOfStockMappings.length > 0;

      if (targetQuiebre) {
        // Elevar precio hacia el siguiente competidor o directamente al ceiling si existe
        if (inStockMappings.length > 0) {
          const nextLowest = [...inStockMappings].sort((a, b) => parseFloat(a.last_scraped_price) - parseFloat(b.last_scraped_price))[0];
          targetPrice = parseFloat(nextLowest.last_scraped_price);
          triggerReason = 'RIVAL_OUT_OF_STOCK_CAPTURE_NEXT_BEST';
        } else if (ceiling) {
          targetPrice = ceiling;
          triggerReason = 'ALL_RIVALS_OUT_OF_STOCK_CAPTURE_CEILING';
        }
      }
    }

    if (targetPrice !== null) {
      let rawCalculated = targetPrice;
      const offset = parseFloat(rule.offset_value) || 0;

      switch (rule.action_type) {
        case 'FIXED_OFFSET_BELOW':
          rawCalculated = targetPrice - offset;
          break;
        case 'PERCENT_OFFSET_BELOW':
          rawCalculated = targetPrice * (1.0 - (offset / 100.0));
          break;
        case 'FIXED_OFFSET_ABOVE':
          rawCalculated = targetPrice + offset;
          break;
        case 'PERCENT_OFFSET_ABOVE':
          rawCalculated = targetPrice * (1.0 + (offset / 100.0));
          break;
        case 'MATCH':
          rawCalculated = targetPrice;
          break;
        case 'MAX_CEILING':
          rawCalculated = ceiling || targetPrice;
          break;
        default:
          rawCalculated = targetPrice;
      }

      // Clampear estrictamente con el piso inquebrantable
      const { finalPrice, floorApplied, ceilingApplied } = clampPrice(rawCalculated, hardFloor, ceiling);

      // Si el precio sugerido es sustancialmente igual al actual (diferencia < $0.01), omitir
      if (Math.abs(finalPrice - currentPrice) < 0.01) {
        return null;
      }

      return {
        product_id: product.id,
        rule_id: rule.id,
        auto_dispatch: Boolean(rule.auto_dispatch),
        previous_price: currentPrice,
        calculated_price: Math.round(rawCalculated * 100) / 100,
        suggested_price: finalPrice,
        floor_applied: floorApplied,
        ceiling_applied: ceilingApplied,
        trigger_reason: triggerReason
      };
    }
  }

  return null;
}

module.exports = {
  calculateHardFloor,
  clampPrice,
  evaluateSmartPrice
};
