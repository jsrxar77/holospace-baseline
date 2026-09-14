/**
 * modules/4see/lib/connectors/tiendanube.js
 * Conector Oficial Tiendanube / Nuvemshop API v1 para HoloSpace Baseline.
 * Ingesta productos en memoria, normaliza a StoreListing y soporta write-back.
 */

const https = require('https');
const { createStoreListing, PlatformEnum } = require('../ontology');

const USER_AGENT = 'HoloSpace Baseline E-Commerce Hub (support@holospace.io)';

/**
 * Cliente HTTP ligero basado en https nativo de Node.js
 */
function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      timeout: options.timeout || 15000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (err) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

class TiendanubeConnector {
  constructor({ accessToken = '', userId = '' } = {}) {
    this.accessToken = String(accessToken).trim();
    this.userId = String(userId).trim();
    this.baseUrl = `https://api.tiendanube.com/v1/${this.userId}`;
  }

  get isConfigured() {
    return Boolean(this.accessToken && this.userId);
  }

  get headers() {
    return {
      'Authentication': `bearer ${this.accessToken}`,
      'Authorization': `Bearer ${this.accessToken}`
    };
  }

  /**
   * Mapea un producto crudo de la API de Tiendanube al objeto ontológico StoreListing.
   */
  mapProduct(raw) {
    if (!raw || !raw.id) return null;

    const variants = Array.isArray(raw.variants) ? raw.variants : [];
    const firstVar = variants[0] || {};
    const price = parseFloat(firstVar.price || 0) || 0;
    const stock = firstVar.stock !== undefined && firstVar.stock !== null ? parseInt(firstVar.stock, 10) : 999;
    const sku = firstVar.sku || '';
    const barcode = firstVar.barcode || '';

    const rawCategories = Array.isArray(raw.categories) ? raw.categories : [];
    const categories = rawCategories.map(c => {
      if (!c) return '';
      if (typeof c === 'object') return c.name ? (c.name.es || c.name.pt || c.name) : '';
      return String(c);
    }).filter(Boolean);

    const images = Array.isArray(raw.images) ? raw.images.map(img => img.src).filter(Boolean) : [];

    return createStoreListing({
      externalId: raw.id,
      platform: PlatformEnum.TIENDANUBE,
      title: raw.name,
      description: raw.description,
      unitPrice: price,
      stock,
      sku,
      gtin: barcode,
      brand: raw.brand || '',
      categories,
      imageUrls: images,
      permalink: raw.canonical_url || (raw.handle ? `https://tiendanube.com/productos/${raw.handle}` : ''),
      seoTitle: raw.seo_title,
      seoDescription: raw.seo_description,
      tags: typeof raw.tags === 'string' ? raw.tags.split(',').map(t => t.trim()) : (raw.tags || []),
      rawAttributes: {
        handle: raw.handle,
        variant_id: firstVar.id,
        variants_count: variants.length
      }
    });
  }

  /**
   * Obtiene productos de Tiendanube en memoria ("on the fly").
   */
  async fetchProducts({ page = 1, limit = 50, query = '' } = {}) {
    if (!this.isConfigured) {
      throw new Error('TiendanubeConnector: Credenciales no configuradas (accessToken o userId faltante).');
    }

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(Math.min(limit, 200)),
      published: 'true'
    });
    if (query) params.append('q', query);

    const url = `${this.baseUrl}/products?${params.toString()}`;
    const rawProducts = await requestJson(url, { headers: this.headers });
    if (!Array.isArray(rawProducts)) return [];

    return rawProducts.map(p => this.mapProduct(p)).filter(Boolean);
  }

  /**
   * Write-back: actualiza título, descripción o barcode en Tiendanube.
   */
  async updateProduct(productId, updates = {}) {
    if (!this.isConfigured) throw new Error('TiendanubeConnector: Sin credenciales.');

    const payload = {};
    if (updates.title) payload.name = { es: updates.title };
    if (updates.description) payload.description = { es: updates.description };
    if (updates.seoTitle) payload.seo_title = { es: updates.seoTitle };
    if (updates.seoDescription) payload.seo_description = { es: updates.seoDescription };

    if (Object.keys(payload).length > 0) {
      await requestJson(`${this.baseUrl}/products/${productId}`, {
        method: 'PUT',
        headers: this.headers
      }, payload);
    }

    // Actualización de código de barras en la variante si se provee
    if (updates.barcode && updates.variantId) {
      await requestJson(`${this.baseUrl}/products/${productId}/variants/${updates.variantId}`, {
        method: 'PUT',
        headers: this.headers
      }, { barcode: updates.barcode });
    }

    return true;
  }
}

module.exports = {
  TiendanubeConnector
};
