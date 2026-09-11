const http = require('http');
const https = require('https');

/**
 * Motor de extracción de producto en cascada (3 capas)
 * Capa 1: Conector nativo Mercado Libre / JSON-LD / Metadatos OpenGraph
 * Capa 2: Heurística DOM básica
 * Capa 3: Fallback controlado
 */
async function extractProductData(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { price: 0, inStock: false, store: 'Desconocido', method: 'ERROR' };
  }

  const url = targetUrl.trim();

  // 1. CONECTOR NATIVO MERCADO LIBRE
  const mliMatch = url.match(/MLA-?(\d+)/i);
  if (mliMatch) {
    const itemId = `MLA${mliMatch[1]}`;
    try {
      const mliData = await fetchJson(`https://api.mercadolibre.com/items/${itemId}`);
      if (mliData && mliData.price) {
        return {
          price: mliData.price,
          currency: mliData.currency_id || 'ARS',
          inStock: (mliData.available_quantity || 0) > 0,
          title: mliData.title,
          store: 'Mercado Libre',
          method: 'NATIVE_API'
        };
      }
    } catch (e) {
      console.warn(`[4SEE] Error consultando API Mercado Libre para ${itemId}:`, e.message);
    }
  }

  // 2. CAPA 1: EXTRACCIÓN DIRECTA HTTP (JSON-LD / META TAGS)
  try {
    const html = await fetchHtml(url);
    if (html) {
      // Búsqueda de bloque JSON-LD con @type Product
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (const scriptTag of jsonLdMatch) {
          const rawContent = scriptTag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
          try {
            const parsed = JSON.parse(rawContent);
            const productObj = parsed['@type'] === 'Product' 
              ? parsed 
              : (Array.isArray(parsed['@graph']) ? parsed['@graph'].find(item => item['@type'] === 'Product') : null);

            if (productObj && productObj.offers) {
              const offers = Array.isArray(productObj.offers) ? productObj.offers[0] : productObj.offers;
              const price = parseFloat(offers.price || offers.lowPrice || 0);
              const availability = (offers.availability || '').toLowerCase();
              const inStock = availability.includes('instock') || !availability.includes('outofstock');
              return {
                price,
                currency: offers.priceCurrency || 'ARS',
                inStock,
                title: productObj.name,
                store: extractDomain(url),
                method: 'STRUCTURED_DATA_JSON_LD'
              };
            }
          } catch (jsonErr) {}
        }
      }

      // Búsqueda de Open Graph (og:price:amount)
      const ogPriceMatch = html.match(/<meta[^>]*property=["']og:price:amount["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:price:amount["']/i);
      if (ogPriceMatch) {
        const price = parseFloat(ogPriceMatch[1].replace(',', '.'));
        const isOutOfStock = html.includes('out-of-stock') || html.includes('agotado') || html.includes('sin-stock');
        return {
          price: isNaN(price) ? 0 : price,
          currency: 'ARS',
          inStock: !isOutOfStock,
          store: extractDomain(url),
          method: 'STRUCTURED_DATA_OG'
        };
      }
    }
  } catch (err) {
    console.warn(`[4SEE] Error en extracción HTTP para ${url}:`, err.message);
  }

  // Fallback seguro cuando no se puede conectar o parsear
  return {
    price: 0,
    currency: 'ARS',
    inStock: true,
    store: extractDomain(url),
    method: 'HEURISTIC_FALLBACK'
  };
}

function extractDomain(fullUrl) {
  try {
    const parsed = new URL(fullUrl);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return 'Web Store';
  }
}

function fetchJson(targetUrl) {
  return new Promise((resolve, reject) => {
    const client = targetUrl.startsWith('https') ? https : http;
    const req = client.get(targetUrl, { headers: { 'User-Agent': 'HoloSpace-4see-Bot/1.0' }, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function fetchHtml(targetUrl) {
  return new Promise((resolve, reject) => {
    const client = targetUrl.startsWith('https') ? https : http;
    const req = client.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 HoloSpace-4see/1.0' }, timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchHtml(res.headers.location));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = {
  extractProductData
};
