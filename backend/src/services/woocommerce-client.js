const axios = require('axios');

class WooCommerceClient {
  constructor(storeUrl, consumerKey, consumerSecret) {
    // Normalize store URL (remove trailing slash)
    this.storeUrl = storeUrl.replace(/\/$/, '');
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.apiVersion = 'wc/v3';
    this.baseUrl = `${this.storeUrl}/wp-json/${this.apiVersion}`;
    this.rateLimitDelay = 300; // 300ms delay between requests
  }

  /**
   * Make authenticated request to WooCommerce API
   */
  async makeRequest(endpoint, method = 'GET', data = null, params = {}) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        auth: {
          username: this.consumerKey,
          password: this.consumerSecret
        },
        headers: {
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000 // 30 second timeout
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }

      const response = await axios(config);

      // Check rate limit headers if present
      const remaining = response.headers['x-wp-total'];
      if (remaining) {
        // Add small delay to respect rate limits
        await this.delay(this.rateLimitDelay);
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited - wait and retry once
        console.log('WooCommerce rate limit hit, waiting 2 seconds...');
        await this.delay(2000);
        return this.makeRequest(endpoint, method, data, params);
      }

      console.error('WooCommerce API Error:', {
        endpoint,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`WooCommerce API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Utility function to add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection to WooCommerce
   */
  async testConnection() {
    try {
      // Try to get system status or a single product to verify connection
      const data = await this.makeRequest('/system_status');
      return {
        success: true,
        message: 'Successfully connected to WooCommerce',
        data: {
          environment: data.environment,
          database: data.database,
          theme: data.theme,
          active_plugins: data.active_plugins?.length || 0
        }
      };
    } catch (error) {
      // Try a simpler endpoint if system_status fails (may need admin access)
      try {
        const products = await this.makeRequest('/products', 'GET', null, { per_page: 1 });
        return {
          success: true,
          message: 'Successfully connected to WooCommerce',
          data: { products_accessible: true }
        };
      } catch (fallbackError) {
        return {
          success: false,
          message: error.message || 'Failed to connect to WooCommerce'
        };
      }
    }
  }

  /**
   * Get store information
   */
  async getStoreInfo() {
    try {
      const data = await this.makeRequest('/system_status');
      return {
        environment: data.environment,
        database: data.database,
        settings: data.settings
      };
    } catch (error) {
      // Return basic info if system_status not accessible
      return { storeUrl: this.storeUrl };
    }
  }

  /**
   * Get products with pagination
   */
  async getProducts(params = {}) {
    const defaultParams = {
      per_page: 100, // Max limit for WooCommerce
      ...params
    };

    return await this.makeRequest('/products', 'GET', null, defaultParams);
  }

  /**
   * Get all products (with pagination handling)
   */
  async getAllProducts(progressCallback = null) {
    const allProducts = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const products = await this.getProducts({ page, per_page: perPage });

      if (!products || products.length === 0) break;

      allProducts.push(...products);

      if (progressCallback) {
        progressCallback({
          page,
          fetched: allProducts.length,
          lastBatch: products.length
        });
      }

      // If we got less than the limit, we're done
      if (products.length < perPage) break;

      page++;

      // Add delay to respect rate limits
      await this.delay(this.rateLimitDelay);
    }

    return allProducts;
  }

  /**
   * Get product by ID
   */
  async getProduct(productId) {
    return await this.makeRequest(`/products/${productId}`);
  }

  /**
   * Get product variations (for variable products)
   */
  async getProductVariations(productId, params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest(`/products/${productId}/variations`, 'GET', null, defaultParams);
  }

  /**
   * Get all variations for a product
   */
  async getAllProductVariations(productId, progressCallback = null) {
    const allVariations = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const variations = await this.getProductVariations(productId, { page, per_page: perPage });

      if (!variations || variations.length === 0) break;

      allVariations.push(...variations);

      if (progressCallback) {
        progressCallback({
          type: 'variations',
          productId,
          page,
          fetched: allVariations.length
        });
      }

      if (variations.length < perPage) break;

      page++;
      await this.delay(this.rateLimitDelay);
    }

    return allVariations;
  }

  /**
   * Get categories with pagination
   */
  async getCategories(params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest('/products/categories', 'GET', null, defaultParams);
  }

  /**
   * Get all categories (with pagination handling)
   */
  async getAllCategories(progressCallback = null) {
    const allCategories = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const categories = await this.getCategories({ page, per_page: perPage });

      if (!categories || categories.length === 0) break;

      allCategories.push(...categories);

      if (progressCallback) {
        progressCallback({
          type: 'categories',
          page,
          fetched: allCategories.length,
          lastBatch: categories.length
        });
      }

      if (categories.length < perPage) break;

      page++;
      await this.delay(this.rateLimitDelay);
    }

    return allCategories;
  }

  /**
   * Get product tags
   */
  async getTags(params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest('/products/tags', 'GET', null, defaultParams);
  }

  /**
   * Get all product tags (with pagination)
   */
  async getAllTags(progressCallback = null) {
    const allTags = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const tags = await this.getTags({ page, per_page: perPage });

      if (!tags || tags.length === 0) break;

      allTags.push(...tags);

      if (progressCallback) {
        progressCallback({
          type: 'tags',
          page,
          fetched: allTags.length
        });
      }

      if (tags.length < perPage) break;

      page++;
      await this.delay(this.rateLimitDelay);
    }

    return allTags;
  }

  /**
   * Get product attributes
   */
  async getAttributes(params = {}) {
    return await this.makeRequest('/products/attributes', 'GET', null, params);
  }

  /**
   * Get attribute terms
   */
  async getAttributeTerms(attributeId, params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest(`/products/attributes/${attributeId}/terms`, 'GET', null, defaultParams);
  }

  /**
   * Get customers with pagination
   */
  async getCustomers(params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest('/customers', 'GET', null, defaultParams);
  }

  /**
   * Get orders with pagination
   */
  async getOrders(params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest('/orders', 'GET', null, defaultParams);
  }

  /**
   * Get all orders (with pagination handling)
   */
  async getAllOrders(progressCallback = null) {
    const allOrders = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const orders = await this.getOrders({ page, per_page: perPage });

      if (!orders || orders.length === 0) break;

      allOrders.push(...orders);

      if (progressCallback) {
        progressCallback({
          type: 'orders',
          page,
          fetched: allOrders.length
        });
      }

      if (orders.length < perPage) break;

      page++;
      await this.delay(this.rateLimitDelay);
    }

    return allOrders;
  }

  /**
   * Get coupons
   */
  async getCoupons(params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest('/coupons', 'GET', null, defaultParams);
  }

  /**
   * Get product reviews
   */
  async getReviews(params = {}) {
    const defaultParams = {
      per_page: 100,
      ...params
    };

    return await this.makeRequest('/products/reviews', 'GET', null, defaultParams);
  }

  /**
   * Get shipping zones
   */
  async getShippingZones() {
    return await this.makeRequest('/shipping/zones');
  }

  /**
   * Get payment gateways
   */
  async getPaymentGateways() {
    return await this.makeRequest('/payment_gateways');
  }

  /**
   * Get tax classes
   */
  async getTaxClasses() {
    return await this.makeRequest('/taxes/classes');
  }

  /**
   * Build product-category map from products
   * WooCommerce products include their categories directly
   */
  buildProductCategoriesMap(products) {
    const productCategoriesMap = {};

    for (const product of products) {
      const productId = String(product.id);
      productCategoriesMap[productId] = (product.categories || []).map(cat => String(cat.id));
    }

    return productCategoriesMap;
  }
}

module.exports = WooCommerceClient;
