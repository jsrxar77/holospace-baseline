const http = require('http');
const https = require('https');
const { parsePrice } = require('./price');
const { assertPublicHost } = require('./url_guard');

/**
 * Lectura de producto desde una URL, en cascada y sin inventar datos:
 *   1. API de Mercado Libre (precio y unidades reales)
 *   2. Datos estructurados de la pagina (JSON-LD Product, microdatos, Open Graph)
 * Si nada de eso trae un precio valido devuelve { ok: false, price: null, inStock: null, reason }.
 * Nunca devuelve 0 ni supone "con stock": lo que no se pudo leer queda como null.
 *
 * Razones de fallo: INVALID_URL, URL_NOT_ALLOWED, FETCH_FAILED, BLOCKED_BY_SITE, NOT_FOUND_IN_PAGE, MAYBE_JS_RENDERED, AMBIGUOUS_PRODUCT_DATA.
 * Ademas del precio devuelve, cuando la pagina los trae: nombre, codigo (sku), codigo de barras (gtin) e imagen.
 * Las paginas que arman el precio con JavaScript no se leen sin un navegador (deuda D-050).
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3 * 1024 * 1024;

function fail(url, reason, extra = {}) {
  return { ok: false, price: null, inStock: null, currency: null, title: null, sku: null, gtin: null, image: null, store: extractDomain(url), method: 'NONE', reason, ...extra };
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
    // Muchas tiendas (Tiendanube entre ellas) publican el producto como WebPage con el Product
    // adentro de mainEntity, no como un nodo Product suelto: sin esto, nunca se encontraba.
    if (parsed.mainEntity) collectNodes(parsed.mainEntity, out);
    if (parsed.about) collectNodes(parsed.about, out);
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

// URLs que identifican a que producto pertenece un nodo (su propio id, el de su pagina, o el de su oferta)
function identifyingUrls(product) {
  const urls = [];
  if (typeof product['@id'] === 'string') urls.push(product['@id']);
  if (typeof product.url === 'string') urls.push(product.url);
  const moe = product.mainEntityOfPage;
  if (typeof moe === 'string') urls.push(moe);
  else if (moe && typeof moe === 'object') { if (moe['@id']) urls.push(moe['@id']); if (moe.url) urls.push(moe.url); }
  offersOf(product).forEach((o) => { if (o && typeof o.url === 'string') urls.push(o.url); });
  return urls;
}

// Mismo host y mismo path (sin importar query string ni barra final): asi comparamos la URL que
// pedimos leer contra la URL que declara cada nodo, sin que una redireccion o un parametro rompa el match.
function samePage(a, b) {
  try {
    const ua = new URL(a, b);
    const ub = new URL(b);
    return ua.hostname.replace(/^www\./i, '').toLowerCase() === ub.hostname.replace(/^www\./i, '').toLowerCase()
      && ua.pathname.replace(/\/+$/, '').toLowerCase() === ub.pathname.replace(/\/+$/, '').toLowerCase();
  } catch (e) {
    return false;
  }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function cleanText(v) {
  if (v === undefined || v === null) return null;
  const t = decodeEntities(String(v)).replace(/\s+/g, ' ').trim();
  return t || null;
}
function cleanCode(v) {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  if (!t || t.length > 100 || /^(undefined|null|n\/a|-)$/i.test(t)) return null;
  return t;
}
function cleanGtin(p) {
  for (const k of ['gtin13', 'gtin12', 'gtin14', 'gtin8', 'gtin']) {
    const d = String(p[k] === undefined || p[k] === null ? '' : p[k]).replace(/\D/g, '');
    if ([8, 12, 13, 14].includes(d.length)) return d;
  }
  return null;
}
function cleanImage(v) {
  let u = v;
  if (Array.isArray(u)) u = u[0];
  if (u && typeof u === 'object') u = u.url || u.contentUrl;
  if (typeof u !== 'string') return null;
  u = u.trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

function readingOf(product) {
  const readings = offersOf(product).map((o) => ({
    price: parsePrice(o.price !== undefined ? o.price : (o.lowPrice !== undefined ? o.lowPrice : (o.priceSpecification && o.priceSpecification.price))),
    stock: availabilityToStock(o.availability),
    currency: o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency) || null
  })).filter((r) => r.price);
  if (!readings.length) return null;
  const available = readings.filter((r) => r.stock === true);
  const pool = available.length ? available : readings;
  const best = pool.reduce((a, b) => (b.price < a.price ? b : a));
  const stock = available.length ? true : (readings.every((r) => r.stock === false) ? false : best.stock);
  return {
    price: best.price, inStock: stock, currency: best.currency, title: cleanText(product.name),
    sku: cleanCode(product.sku), gtin: cleanGtin(product), image: cleanImage(product.image), method: 'JSON_LD'
  };
}

/**
 * Lee el precio desde JSON-LD. Muchas paginas (fichas de producto con una franja de "tambien te
 * puede interesar") traen varios nodos Product en el mismo HTML: tomar "el primero que aparece"
 * confunde el producto propio con uno ajeno (asi se leyo Moet Ice como otro espumante mas barato).
 * Si hay un solo Product en la pagina se usa ese; si hay varios, solo se usa el que coincide con
 * la URL pedida. Si hay varios y ninguno coincide, no se adivina: se informa como ambiguo.
 */
function fromJsonLd(html, pageUrl) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const candidates = [];
  for (const block of blocks) {
    const raw = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { continue; }
    collectNodes(parsed)
      .filter((n) => typeIncludes(n, 'Product'))
      .forEach((product) => {
        const reading = readingOf(product);
        if (reading) candidates.push({ product, reading });
      });
  }
  if (!candidates.length) return { reading: null, ambiguous: false };
  if (candidates.length === 1) return { reading: candidates[0].reading, ambiguous: false };

  const matches = candidates.filter((c) => identifyingUrls(c.product).some((u) => samePage(u, pageUrl)));
  if (matches.length === 1) return { reading: matches[0].reading, ambiguous: false };
  return { reading: null, ambiguous: true };
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
      title: cleanText(metaContent(html, ['og:title'])),
      sku: null, gtin: null, image: cleanImage(metaContent(html, ['og:image'])),
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
  const skuMatch = html.match(/itemprop=["']sku["'][^>]*content=["']([^"']+)["']/i);
  return { price, inStock: av ? availabilityToStock(av[1]) : null, currency: null, title: null, sku: skuMatch ? cleanCode(skuMatch[1]) : null, gtin: null, image: null, method: 'MICRODATA' };
}

function visibleText(html) {
  return html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// El sitio devolvio un muro de inicio de sesion o un desafio anti-robots en lugar del producto
function looksBlocked(html) {
  const text = visibleText(html);
  if (text.length > 4000) return false;
  return /(para continuar,?\s*ingres[aá]|ingres[aá] a tu cuenta|inici[aá] sesi[oó]n para continuar|(log|sign) ?in to continue)/i.test(text)
    || /(just a moment|attention required|checking your browser|verifying you are human|verific[aá] que sos humano|captcha)/i.test(text);
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
          title: item.title || null, sku: null, gtin: null, image: null, store: 'Mercado Libre', method: 'MERCADOLIBRE_API', reason: null
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
    if (e && e.code === 'URL_NOT_ALLOWED') return fail(url, 'URL_NOT_ALLOWED');
    if (/^HTTP (401|403|429)\b/.test(e && e.message)) return fail(url, 'BLOCKED_BY_SITE', { detail: e.message });
    return fail(url, 'FETCH_FAILED', { detail: e && e.message });
  }
  if (!html) return fail(url, 'FETCH_FAILED');

  const jsonLd = fromJsonLd(html, url);
  const found = jsonLd.reading || fromMicrodata(html) || fromMetaTags(html);
  if (found) {
    return { ok: true, currency: found.currency || null, store: extractDomain(url), reason: null, sku: null, gtin: null, image: null, ...found };
  }
  if (jsonLd.ambiguous) return fail(url, 'AMBIGUOUS_PRODUCT_DATA');
  if (looksBlocked(html)) return fail(url, 'BLOCKED_BY_SITE');
  return fail(url, looksJsRendered(html) ? 'MAYBE_JS_RENDERED' : 'NOT_FOUND_IN_PAGE');
}

// Texto para personas segun el motivo de fallo
function describeReadFailure(reason) {
  switch (reason) {
    case 'INVALID_URL': return 'El link no parece válido. Copialo completo, con https://.';
    case 'URL_NOT_ALLOWED': return 'Este link apunta a una dirección interna o privada y no se puede leer.';
    case 'BLOCKED_BY_SITE': return 'Este sitio no permite que lo leamos automáticamente (pide iniciar sesión o bloquea el acceso).';
    case 'FETCH_FAILED': return 'No pudimos abrir la página. Revisá el link o probá de nuevo en un rato.';
    case 'MAYBE_JS_RENDERED': return 'Esta página arma el precio al cargarse y todavía no podemos leerlo desde acá.';
    case 'NOT_FOUND_IN_PAGE': return 'No encontramos el precio en esta página. Revisá que sea el link de un producto.';
    case 'AMBIGUOUS_PRODUCT_DATA': return 'Esta página muestra varios productos y no pudimos identificar cuál es el tuyo. Probá con el link directo del producto.';
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
  return assertPublicHost(targetUrl).then(() => new Promise((resolve, reject) => {
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
  }));
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
