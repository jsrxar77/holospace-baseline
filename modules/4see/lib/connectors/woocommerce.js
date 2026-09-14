/**
 * modules/4see/lib/connectors/woocommerce.js
 * Conector Oficial WooCommerce REST API v3 para HoloSpace Baseline.
 * Ingesta productos en memoria, normaliza a StoreListing (incluyendo Yoast/RankMath) y soporta write-back.
 */

const https = require('https');
const http = require('http');
const { createStoreListing, PlatformEnum } = require('../ontology');

const USER_AGENT = 'HoloSpace Baseline E-Commerce Hub (support@holospace.io)';

/**
 * Cliente HTTP ligero que soporta http y https
 */
function requestJson(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === 'http:' ? http : https;
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      timeout: options.timeout || 15000
    };

    const req = transport.request(reqOptions, (res) => {
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

class WooCommerceConnector {
  constructor({ storeUrl = '', consumerKey = '', consumerSecret = '', version = 'wc/v3' } = {}) {
    this.storeUrl = String(storeUrl).trim().replace(/\/+$/, '');
    this.consumerKey = String(consumerKey).trim();
    this.consumerSecret = String(consumerSecret).trim();
    this.apiVersion = version;
    this.baseUrl = `${this.storeUrl}/wp-json/${this.apiVersion}`;
  }

  get isConfigured() {
    return Boolean(this.storeUrl && this.consumerKey && this.consumerSecret);
  }

  /**
   * Genera cabecera Basic Auth para WooCommerce REST API
   */
  get authHeader() {
    const token = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    return { 'Authorization': `Basic ${token}` };
  }

  /**
   * Mapea un producto de WooCommerce a la ontología StoreListing canónica.
   * Extrae atributos de variantes, imágenes y metadatos SEO de plugins como Yoast o RankMath.
   */
  mapProduct(raw) {
    if (!raw || !raw.id) return null;

    const price = parseFloat(raw.price || raw.regular_price || 0) || 0;
    const regularPrice = parseFloat(raw.regular_price || price) || price;
    const stock = raw.stock_quantity !== null && raw.stock_quantity !== undefined 
      ? parseInt(raw.stock_quantity, 10) 
      : (raw.stock_status === 'instock' ? 10 : 0);

    const categories = Array.isArray(raw.categories) ? raw.categories.map(c => c.name).filter(Boolean) : [];
    const categoryIds = Array.isArray(raw.categories) ? raw.categories.map(c => c.id).filter(Boolean) : [];
    const images = Array.isArray(raw.images) ? raw.images.map(img => img.src).filter(Boolean) : [];

    // Extracción de metadatos SEO de plugins populares de WordPress
    let seoTitle = '';
    let seoDesc = '';
    let barcode = '';

    if (Array.isArray(raw.meta_data)) {
      for (const meta of raw.meta_data) {
        const key = meta.key || '';
        const val = meta.value || '';
        if (key === '_yoast_wpseo_title' || key === 'rank_math_title') {
          seoTitle = String(val);
        } else if (key === '_yoast_wpseo_metadesc' || key === 'rank_math_description') {
          seoDesc = String(val);
        } else if (['barcode', 'gtin', '_barcode', '_gtin', '_wpm_gtin_code'].includes(key.toLowerCase())) {
          barcode = String(val);
        }
      }
    }

    // Si no vino en meta_data, revisar si vino en atributo nativo o sku
    if (!barcode && raw.sku && /^[0-9]{8,14}$/.test(raw.sku)) {
      barcode = raw.sku;
    }

    return createStoreListing({
      externalId: raw.id,
      platform: PlatformEnum.WOOCOMMERCE,
      title: raw.name,
      description: raw.description || raw.short_description || '',
      unitPrice: price,
      regularPrice,
      currency: 'ARS',
      stock,
      sku: raw.sku || '',
      gtin: barcode,
      brand: '', // WC estándar suele no traer brand a menos que tenga taxonomy personalizada
      categories,
      categoryIds,
      imageUrls: images,
      permalink: raw.permalink || '',
      seoTitle,
      seoDescription: seoDesc,
      tags: Array.isArray(raw.tags) ? raw.tags.map(t => t.name).filter(Boolean) : [],
      rawAttributes: {
        catalog_visibility: raw.catalog_visibility || 'visible',
        tax_status: raw.tax_status
      }
    });
  }

  /**
   * Obtiene productos de WooCommerce en memoria ("on the fly").
   */
  async fetchProducts({ page = 1, limit = 50, search = '' } = {}) {
    if (!this.isConfigured) {
      throw new Error('WooCommerceConnector: Credenciales no configuradas (storeUrl, consumerKey o consumerSecret faltante).');
    }

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(Math.min(limit, 100))
    });
    if (search) params.append('search', search);

    const url = `${this.baseUrl}/products?${params.toString()}`;
    const rawProducts = await requestJson(url, { headers: this.authHeader });
    if (!Array.isArray(rawProducts)) return [];

    return rawProducts.map(p => this.mapProduct(p)).filter(Boolean);
  }

  /**
   * Write-back: actualiza campos de título, descripción o metadatos SEO en WooCommerce.
   */
  async updateProduct(productId, updates = {}) {
    if (!this.isConfigured) throw new Error('WooCommerceConnector: Sin credenciales.');

    const payload = {};
    if (updates.title) payload.name = updates.title;
    if (updates.description) payload.description = updates.description;

    const metaData = [];
    if (updates.seoTitle) {
      metaData.push({ key: '_yoast_wpseo_title', value: updates.seoTitle });
      metaData.push({ key: 'rank_math_title', value: updates.seoTitle });
    }
    if (updates.seoDescription) {
      metaData.push({ key: '_yoast_wpseo_metadesc', value: updates.seoDescription });
      metaData.push({ key: 'rank_math_description', value: updates.seoDescription });
    }
    if (updates.barcode) {
      metaData.push({ key: '_barcode', value: updates.barcode });
      metaData.push({ key: '_wpm_gtin_code', value: updates.barcode });
    }

    if (metaData.length > 0) {
      payload.meta_data = metaData;
    }

    if (Object.keys(payload).length > 0) {
      await requestJson(`${this.baseUrl}/products/${productId}`, {
        method: 'PUT',
        headers: this.authHeader
      }, payload);
    }

    return true;
  }
}

module.exports = {
  WooCommerceConnector
};
