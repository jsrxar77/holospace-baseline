/**
 * Motor de Cálculo de Rentabilidad Neta y Repricing Táctico — 4see Margins
 */
function calculateMarginMetrics({
  costPrice = 0,
  sellingPrice = 0,
  minMarginPct = 20,
  platformFeePct = 13,
  taxPct = 21,
  shippingCost = 0
}) {
  const cost = Number(costPrice) || 0;
  const price = Number(sellingPrice) || 0;
  const minMargin = Number(minMarginPct) || 20;
  const feePct = Number(platformFeePct) || 13;
  const tax = Number(taxPct) || 21;
  const shipping = Number(shippingCost) || 0;

  // Comisiones sobre venta bruta
  const platformFeeAmount = price * (feePct / 100);
  
  // Impuestos estimados sobre venta neta o componente impositivo
  const taxAmount = price * (tax / 100);

  // Beneficio neto
  const netProfit = price - cost - platformFeeAmount - taxAmount - shipping;

  // Margen neto porcentual sobre precio de venta
  const realMarginPct = price > 0 ? Math.round((netProfit / price) * 100 * 10) / 10 : 0;

  // Zona Roja: si el margen real es inferior al margen mínimo pretendido
  const isRedZone = realMarginPct < minMargin;

  // Repricing Táctico sugerido (+8% para capturar valor si la competencia quiebra stock)
  const suggestedRepricingPrice = Math.round(price * 1.08 * 100) / 100;

  return {
    costPrice: cost,
    sellingPrice: price,
    minMarginPct: minMargin,
    platformFeePct: feePct,
    taxPct: tax,
    shippingCost: shipping,
    platformFeeAmount: Math.round(platformFeeAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    realMarginPct,
    isRedZone,
    suggestedRepricingPrice
  };
}

module.exports = {
  calculateMarginMetrics
};
