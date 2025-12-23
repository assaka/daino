const axios = require('axios');
const crypto = require('crypto');
const IntegrationConfig = require('../models/IntegrationConfig');
const ConnectionManager = require('./database/ConnectionManager');

/**
 * Meta Commerce Service
 *
 * Handles Instagram Shopping integration via Meta Commerce Manager.
 * Syncs products to Facebook/Instagram product catalogs.
 */
class MetaCommerceService {
  constructor(storeId) {
    this.storeId = storeId;
    this.integration = null;
    this.graphApiVersion = 'v18.0';
    this.graphApiBaseUrl = 'https://graph.facebook.com';
    this.appId = process.env.META_APP_ID;
    this.appSecret = process.env.META_APP_SECRET;
    this.redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  }

  // ==================== OAuth Methods ====================

  /**
   * Generate state parameter for OAuth flow
   */
  generateState() {
    const payload = JSON.stringify({
      storeId: this.storeId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    });
    return Buffer.from(payload).toString('base64url');
  }

  /**
   * Verify and decode state parameter
   */
  verifyState(state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());

      // Check if state is expired (10 minutes)
      if (Date.now() - decoded.timestamp > 600000) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl() {
    const state = this.generateState();
    const scopes = [
      'catalog_management',
      'business_management',
      'pages_read_engagement',
      'instagram_basic'
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      state: state,
      response_type: 'code'
    });

    return {
      url: `https://www.facebook.com/${this.graphApiVersion}/dialog/oauth?${params.toString()}`,
      state
    };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.get(
        `${this.graphApiBaseUrl}/${this.graphApiVersion}/oauth/access_token`, {
          params: {
            client_id: this.appId,
            redirect_uri: this.redirectUri,
            client_secret: this.appSecret,
            code
          }
        }
      );
      return response.data; // { access_token, token_type, expires_in }
    } catch (error) {
      console.error('Meta OAuth token exchange error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to exchange code for token');
    }
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  async exchangeForLongLivedToken(shortLivedToken) {
    try {
      const response = await axios.get(
        `${this.graphApiBaseUrl}/${this.graphApiVersion}/oauth/access_token`, {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortLivedToken
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Meta long-lived token exchange error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to get long-lived token');
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccess() {
    if (!this.integration?.config_data?.accessToken) {
      return { success: true };
    }

    try {
      await axios.delete(
        `${this.graphApiBaseUrl}/${this.graphApiVersion}/me/permissions`, {
          params: {
            access_token: this.integration.config_data.accessToken
          }
        }
      );
      return { success: true };
    } catch (error) {
      console.error('Meta revoke access error:', error.response?.data || error.message);
      // Continue even if revoke fails
      return { success: true };
    }
  }

  // ==================== Business & Catalog Methods ====================

  /**
   * Get user's business accounts
   */
  async getBusinessAccounts() {
    const response = await this.graphRequest('/me/businesses', {
      fields: 'id,name,profile_picture_uri'
    });
    return response.data || [];
  }

  /**
   * Get catalogs for a business
   */
  async getCatalogs(businessId) {
    const response = await this.graphRequest(`/${businessId}/owned_product_catalogs`, {
      fields: 'id,name,product_count,vertical'
    });
    return response.data || [];
  }

  /**
   * Create a new product catalog
   */
  async createCatalog(businessId, name) {
    const response = await this.graphRequest(
      `/${businessId}/owned_product_catalogs`,
      {},
      'POST',
      { name, vertical: 'commerce' }
    );
    return response;
  }

  /**
   * Save selected catalog to config
   */
  async selectCatalog(catalogId, catalogName) {
    await this.updateConfig({
      catalogId,
      catalogName
    });
  }

  // ==================== Product Sync Methods ====================

  /**
   * Initialize service by loading integration config
   */
  async initialize() {
    this.integration = await IntegrationConfig.findByStoreAndType(
      this.storeId,
      'meta-commerce'
    );
    if (!this.integration) {
      throw new Error('Meta Commerce integration not configured');
    }
    return { success: true };
  }

  /**
   * Fetch products from database
   */
  async fetchProducts(productIds = null) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    let query = tenantDb
      .from('products')
      .select(`
        id, sku, slug, price, compare_price, stock_quantity, status,
        name, description, short_description, images
      `)
      .eq('store_id', this.storeId)
      .eq('status', 'active');

    if (productIds && productIds.length > 0) {
      query = query.in('id', productIds);
    }

    const { data: products, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    // Fetch translations for products
    if (products && products.length > 0) {
      const { data: translations } = await tenantDb
        .from('product_translations')
        .select('product_id, language_code, name, description, short_description')
        .in('product_id', products.map(p => p.id));

      // Apply translations (prefer English)
      products.forEach(product => {
        const productTranslations = translations?.filter(t => t.product_id === product.id) || [];
        const enTranslation = productTranslations.find(t => t.language_code === 'en');
        const anyTranslation = productTranslations[0];

        const translation = enTranslation || anyTranslation;
        if (translation) {
          product.name = translation.name || product.name;
          product.description = translation.description || product.description;
          product.short_description = translation.short_description || product.short_description;
        }
      });

      // Fetch images from product_files
      const { data: files } = await tenantDb
        .from('product_files')
        .select('product_id, file_url, position, is_primary')
        .in('product_id', products.map(p => p.id))
        .order('position', { ascending: true });

      products.forEach(product => {
        const productFiles = files?.filter(f => f.product_id === product.id) || [];
        product.images = productFiles.map(f => ({ url: f.file_url, position: f.position, is_primary: f.is_primary }));
      });
    }

    return products || [];
  }

  /**
   * Transform product to Meta catalog format
   */
  transformProduct(product) {
    const config = this.integration.config_data || {};
    const domain = config.storeDomain || 'example.com';
    const currency = config.currency || 'USD';

    const transformed = {
      retailer_id: product.sku || product.id,
      title: (product.name || '').substring(0, 150),
      description: (product.description || product.short_description || '').substring(0, 5000),
      availability: product.stock_quantity > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${product.price} ${currency}`,
      link: `https://${domain}/products/${product.slug}`,
      brand: config.defaultBrand || domain,
      inventory: product.stock_quantity || 0
    };

    // Add sale price if compare_price exists
    if (product.compare_price && product.compare_price > product.price) {
      transformed.sale_price = `${product.price} ${currency}`;
      transformed.price = `${product.compare_price} ${currency}`;
    }

    // Add images
    if (product.images && product.images.length > 0) {
      transformed.image_link = product.images[0]?.url;
      if (product.images.length > 1) {
        transformed.additional_image_link = product.images.slice(1, 10).map(i => i.url);
      }
    }

    return transformed;
  }

  /**
   * Validate product for Meta catalog requirements
   */
  validateProduct(product) {
    const errors = [];

    if (!product.retailer_id) errors.push('Missing SKU (retailer_id)');
    if (!product.title) errors.push('Missing title');
    if (!product.price) errors.push('Missing price');
    if (!product.image_link) errors.push('Missing primary image');
    if (!product.link) errors.push('Missing product URL');

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate multiple products
   */
  validateProducts(products) {
    const valid = [];
    const invalid = [];

    products.forEach(product => {
      const result = this.validateProduct(product);
      if (result.valid) {
        valid.push(product);
      } else {
        invalid.push({
          retailerId: product.retailer_id,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: result.errors.join(', '),
          timestamp: new Date().toISOString()
        });
      }
    });

    return { valid, invalid };
  }

  /**
   * Sync products to Meta catalog
   */
  async syncProducts(productIds = null, options = {}) {
    const { progressCallback, dryRun = false } = options;

    // 1. Fetch products from database
    if (progressCallback) {
      await progressCallback({ stage: 'fetching', current: 0, total: 100 });
    }

    const products = await this.fetchProducts(productIds);

    if (products.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        errors: []
      };
    }

    // 2. Transform to Meta format
    if (progressCallback) {
      await progressCallback({ stage: 'transforming', current: 0, total: products.length });
    }

    const metaProducts = [];
    for (let i = 0; i < products.length; i++) {
      const transformed = this.transformProduct(products[i]);
      metaProducts.push(transformed);

      if (progressCallback) {
        await progressCallback({
          stage: 'transforming',
          current: i + 1,
          total: products.length,
          item: products[i].name
        });
      }
    }

    // 3. Validate products
    const { valid, invalid } = this.validateProducts(metaProducts);

    // 4. Batch upload to Meta
    if (!dryRun && valid.length > 0) {
      await this.batchUploadProducts(valid, progressCallback);
    }

    return {
      total: products.length,
      successful: valid.length,
      failed: invalid.length,
      errors: invalid
    };
  }

  /**
   * Batch upload products to Meta catalog
   */
  async batchUploadProducts(products, progressCallback) {
    const catalogId = this.integration.config_data?.catalogId;
    if (!catalogId) {
      throw new Error('No catalog selected');
    }

    const batchSize = 500; // Meta allows up to 500 items per batch
    const errors = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const requests = batch.map(p => ({
        method: 'UPDATE', // UPDATE handles both create and update
        retailer_id: p.retailer_id,
        data: p
      }));

      try {
        await this.graphRequest(`/${catalogId}/items_batch`, {}, 'POST', {
          requests: JSON.stringify(requests)
        });
      } catch (error) {
        console.error('Meta batch upload error:', error);
        // Add errors for this batch
        batch.forEach(p => {
          errors.push({
            retailerId: p.retailer_id,
            errorCode: 'UPLOAD_ERROR',
            errorMessage: error.message,
            timestamp: new Date().toISOString()
          });
        });
      }

      if (progressCallback) {
        await progressCallback({
          stage: 'uploading',
          current: Math.min(i + batchSize, products.length),
          total: products.length
        });
      }
    }

    return errors;
  }

  // ==================== Helper Methods ====================

  /**
   * Make a Graph API request
   */
  async graphRequest(endpoint, params = {}, method = 'GET', data = null) {
    const url = `${this.graphApiBaseUrl}/${this.graphApiVersion}${endpoint}`;

    const config = {
      method,
      url,
      params: {
        ...params,
        access_token: this.integration?.config_data?.accessToken
      }
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Meta Graph API error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Update integration config
   */
  async updateConfig(updates) {
    const currentConfig = this.integration?.config_data || {};
    const newConfig = { ...currentConfig, ...updates };

    await IntegrationConfig.createOrUpdate(this.storeId, 'meta-commerce', newConfig);

    // Refresh integration object
    this.integration = await IntegrationConfig.findByStoreAndType(this.storeId, 'meta-commerce');
  }

  /**
   * Get current sync status
   */
  async getSyncStatus() {
    return {
      connected: !!this.integration?.config_data?.accessToken,
      catalogId: this.integration?.config_data?.catalogId,
      catalogName: this.integration?.config_data?.catalogName,
      businessId: this.integration?.config_data?.businessId,
      businessName: this.integration?.config_data?.businessName,
      lastSyncAt: this.integration?.last_sync_at,
      syncStatus: this.integration?.sync_status,
      syncError: this.integration?.sync_error
    };
  }

  /**
   * Test connection to Meta API
   */
  async testConnection() {
    try {
      await this.graphRequest('/me', { fields: 'id,name' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = MetaCommerceService;
