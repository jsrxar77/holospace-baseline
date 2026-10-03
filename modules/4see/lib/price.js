/**
 * Lectura de precios: convierte textos de tiendas argentinas ("$ 185.240,00", "18.020", "18020.00") en numeros.
 * Devuelve null cuando no puede asegurar el valor: nunca inventa un precio ni devuelve 0.
 */

function parsePrice(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? round2(input) : null;

  let s = String(input).trim();
  if (!s) return null;
  // Se queda con el primer numero del texto ("$ 185.240,00 ARS" -> "185.240,00")
  const m = s.replace(/ /g, ' ').match(/\d[\d.,\s]*/);
  if (!m) return null;
  s = m[0].replace(/\s+/g, '').replace(/[.,]+$/, '');
  if (!s) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized;

  if (lastDot !== -1 && lastComma !== -1) {
    // Los dos separadores: el ultimo es el decimal, el otro separa miles
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    normalized = s.split(thou).join('').replace(dec, '.');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const parts = s.split(sep);
    const after = parts[parts.length - 1];
    if (parts.length > 2) {
      // Varias apariciones: separador de miles ("1.234.567")
      normalized = parts.join('');
    } else if (after.length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== '0') {
      // "18.020" o "1,234": tres digitos despues del separador son miles
      normalized = parts.join('');
    } else {
      // "185240.00", "18,5", "0,125": decimal
      normalized = parts[0] + '.' + after;
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

function round2(n) { return Math.round(n * 100) / 100; }

// Aviso cuando un precio leido esta fuera de escala respecto de otro conocido (p. ej. 18.620 contra 165.200)
function scaleWarning(readPrice, referencePrice, factor = 8) {
  if (!readPrice || !referencePrice) return null;
  const ratio = readPrice / referencePrice;
  if (ratio > factor || ratio < 1 / factor) {
    return 'El precio leído es muy distinto al tuyo. Revisá que el link sea del mismo producto y que el precio esté bien leído.';
  }
  return null;
}

module.exports = { parsePrice, scaleWarning };
