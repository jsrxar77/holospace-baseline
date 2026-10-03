const http = require('http');
const https = require('https');
const { parsePrice } = require('./price');

/**
 * Lectura de producto desde una URL, en cascada y sin inventar datos:
 *   1. API de Mercado Libre (precio y unidades reales)
 *   2. Datos estructurados de la pagina (JSON-LD Product, microdatos, Open Graph)
 * Si nada de eso trae un precio valido devuelve { ok: false, price: null, inStock: null, reason }.
 * Nunca devuelve 0 ni supone "con stock": lo que no se pudo leer queda como null.
 *
 * Razones de fallo: INVALID_URL, FETCH_FAILED, NOT_FOUND_IN_PAGE, MAYBE_JS_RENDERED.
 * Las paginas que arman el precio con JavaScript no se leen sin un navegador (deuda D-050).
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3 * 1024 * 1024;

function fail(url, reason, extra = {}) {
  return { ok: false, price: null, inStock: null, currency: null, title: null, store: extractDomain(url), method: 'NONE', reason, ...extra };
}

function availabilityToStock(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).toLowerCase();
  if (/outofstock|soldout|discontinued|\boos\b|out of stock|agotado|sin stock/.test(v)) return false;
  if (/instock|limitedavailability|onlineonly|instoreonly|in stock|available|disponible/.test(v)) return true;
  return null; // preventa, reserva o texto desconocido: no se supone nada
}

function typeIncludes(node, type) {
  const t = node && node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function collectNodes(parsed, out = []) {
  if (Array.isArray(parsed)) { parsed.forEach((p) => collectNodes(p, out)); return out; }
  if (parsed && typeof parsed === 'object') {
    out.push(parsed);
    if (Array.isArray(parsed['@graph'])) collectNodes(parsed['@graph'], out);
  }
  return out;
}

function offersOf(product) {
  const raw = product.offers;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const flat = [];
  for (const o of list) {
    if (!o) continue;
    if (Array.isArray(o.offers)) flat.push(...o.offers); else flat.push(o);
  }
  return flat;
}

function fromJsonLd(html) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const raw = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { continue; }
    const product = collectNodes(parsed).find((n) => typeIncludes(n, 'Product'));
    if (!product) continue;
    const readings = offersOf(product).map((o) => ({
      price: parsePrice(o.price !== undefined ? o.price : (o.lowPrice !== undefined ? o.lowPrice : (o.priceSpecification && o.priceSpecification.price))),
      stock: availabilityToStock(o.availability),
      currency: o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency) || null
    })).filter((r) => r.price);
    if (!readings.length) continue;
    const available = readings.filter((r) => r.stock === true);
    const pool = available.length ? available : readings;
    const best = pool.reduce((a, b) => (b.price < a.price ? b : a));
    const stock = available.length ? true : (readings.every((r) => r.stock === false) ? false : best.stock);
    return { price: best.price, inStock: stock, currency: best.currency, title: product.name || null, method: 'JSON_LD' };
  }
  return null;
}

function metaContent(html, names) {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]*(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${name}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m) return m[1];
  }
  return null;
}

function fromMetaTags(html) {
  const price = parsePrice(metaContent(html, ['product:price:amount', 'og:price:amount', 'product:sale_price:amount', 'price']));
  if (price) {
    return {
      price,
      inStock: availabilityToStock(metaContent(html, ['product:availability', 'og:availability'])),
      currency: metaContent(html, ['product:price:currency', 'og:price:currency']) || null,
      title: metaContent(html, ['og:title']),
      method: 'META_TAGS'
    };
  }
  return null;
}

function fromMicrodata(html) {
  const m = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
  const price = m ? parsePrice(m[1]) : null;
  if (!price) return null;
  const av = html.match(/itemprop=["']availability["'][^>]*(?:href|content)=["']([^"']+)["']/i);
  return { price, inStock: av ? availabilityToStock(av[1]) : null, currency: null, title: null, method: 'MICRODATA' };
}

function looksJsRendered(html) {
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return /<div[^>]+id=["'](root|__next|app)["']/i.test(html) && text.length < 800;
}

async function extractProductData(targetUrl, deps = {}) {
  const getJson = deps.fetchJson || fetchJson;
  const getHtml = deps.fetchHtml || fetchHtml;

  if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl.trim())) {
    return fail(targetUrl, 'INVALID_URL');
  }
  const url = targetUrl.trim();

  // 1. Mercado Libre: API publica de items
  const mliMatch = url.match(/MLA-?(\d+)/i);
  if (mliMatch) {
    try {
      const item = await getJson(`https://api.mercadolibre.com/items/MLA${mliMatch[1]}`);
      const price = parsePrice(item && item.price);
      if (price) {
        const qty = Number.isFinite(item.available_quantity) ? item.available_quantity : null;
        return {
          ok: true, price, currency: item.currency_id || null,
          inStock: qty === null ? availabilityToStock(item.status === 'active' ? 'instock' : null) : qty > 0,
          title: item.title || null, store: 'Mercado Libre', method: 'MERCADOLIBRE_API', reason: null
        };
      }
    } catch (e) {
      console.warn(`[4SEE] Mercado Libre no respondio para MLA${mliMatch[1]}: ${e.message}`);
    }
  }

  // 2. Datos estructurados de la pagina
  let html = null;
  try {
    html = await getHtml(url);
  } catch (e) {
    return fail(url, 'FETCH_FAILED', { detail: e.message });
  }
  if (!html) return fail(url, 'FETCH_FAILED');

  const found = fromJsonLd(html) || fromMicrodata(html) || fromMetaTags(html);
  if (found) {
    return { ok: true, currency: found.currency || null, store: extractDomain(url), reason: null, ...found };
  }
  return fail(url, looksJsRendered(html) ? 'MAYBE_JS_RENDERED' : 'NOT_FOUND_IN_PAGE');
}

// Texto para personas segun el motivo de fallo
function describeReadFailure(reason) {
  switch (reason) {
    case 'INVALID_URL': return 'El link no parece válido. Copialo completo, con https://.';
    case 'FETCH_FAILED': return 'No pudimos abrir la página. Revisá el link o probá de nuevo en un rato.';
    case 'MAYBE_JS_RENDERED': return 'Esta página arma el precio al cargarse y todavía no podemos leerlo desde acá.';
    case 'NOT_FOUND_IN_PAGE': return 'No encontramos el precio en esta página. Revisá que sea el link de un producto.';
    default: return 'No pudimos leer el precio.';
  }
}

function extractDomain(fullUrl) {
  try {
    return new URL(fullUrl).hostname.replace('www.', '');
  } catch (e) {
    return 'Web Store';
  }
}

const REQUEST_DEADLINE_MS = 8000;

// Plazo de pared completo (DNS + conexion + TLS + respuesta): el `timeout` de http.get solo cuenta
// inactividad una vez que el socket existe, asi que una resolucion de DNS que no responde (un rival
// caido o con un dominio mal escrito) puede colgar el pedido mucho mas alla de ese valor sin este reloj aparte.
function requestText(targetUrl, headers, redirects = 0, deadline = Date.now() + REQUEST_DEADLINE_MS) {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error('Timeout'));

    const client = targetUrl.startsWith('https') ? https : http;
    const req = client.get(targetUrl, { headers, timeout: remaining }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) return reject(new Error('Demasiadas redirecciones'));
        return resolve(requestText(new URL(res.headers.location, targetUrl).toString(), headers, redirects + 1, deadline));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      let bytes = 0;
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) { req.destroy(); return reject(new Error('Pagina demasiado grande')); }
        data += chunk;
      });
      res.on('end', () => resolve(data));
    });
    const hardTimer = setTimeout(() => req.destroy(new Error('Timeout')), remaining);
    req.on('error', (e) => { clearTimeout(hardTimer); reject(e); });
    req.on('close', () => clearTimeout(hardTimer));
    req.on('timeout', () => { req.destroy(new Error('Timeout')); });
  });
}

function fetchJson(targetUrl) {
  return requestText(targetUrl, { 'User-Agent': 'holospace-4see/1.0', Accept: 'application/json' }).then((t) => JSON.parse(t));
}

function fetchHtml(targetUrl) {
  return requestText(targetUrl, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 holospace-4see/1.0',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9'
  });
}

module.exports = { extractProductData, describeReadFailure, availabilityToStock };
