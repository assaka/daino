const axios = require('axios');

/**
 * Bol.com Retailer API Integration
 * Handles authentication and API calls to Bol.com
 *
 * API Documentation: https://api.bol.com/retailer/public/Retailer-API/v9/index.html
 */
class BolcomIntegration {
  constructor(config = {}) {
    this.config = config;
    this.baseUrl = 'https://api.bol.com/retailer';
    this.authUrl = 'https://login.bol.com/token';
    this.accessToken = null;
    this.tokenExpiry = null;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Accept': 'application/vnd.retailer.v9+json',
        'Content-Type': 'application/vnd.retailer.v9+json'
      }
    });

    // Add auth interceptor
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  /**
   * Get OAuth2 access token from Bol.com
   * Tokens are cached until expiry
   */
  async getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const { client_id, client_secret } = this.config;

    if (!client_id || !client_secret) {
      throw new Error('Missing Bol.com API credentials. Please configure client_id and client_secret.');
    }

    try {
      const response = await axios.post(
        this.authUrl,
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          auth: {
            username: client_id,
            password: client_secret
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log('🔑 Bol.com access token refreshed');
      return this.accessToken;
    } catch (error) {
      const message = error.response?.data?.error_description || error.message;
      throw new Error(`Failed to authenticate with Bol.com: ${message}`);
    }
  }

  /**
   * Test connection to Bol.com API
   */
  async testConnection() {
    try {
      // Try to get commission rates - a simple read-only endpoint
      const response = await this.client.get('/commission');

      return {
        success: true,
        message: 'Successfully connected to Bol.com API',
        data: {
          commissions: response.data?.commissions?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  /**
   * Sync products to Bol.com as offers
   * @param {Object} options - Sync options
   */
  async syncProducts(options = {}) {
    const { products = [], batchSize = 50, dryRun = false, fulfillmentMethod = 'FBR' } = options;
    const results = {
      total: products.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    console.log(`🔄 Syncing ${products.length} products to Bol.com (dryRun: ${dryRun})...`);

    // Process products in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      for (const product of batch) {
        try {
          const offer = this.mapProductToOffer(product, fulfillmentMethod);

          if (dryRun) {
            console.log(`[DRY RUN] Would create/update offer for EAN: ${offer.ean}`);
            continue;
          }

          // Check if offer exists
          const existingOffer = await this.findOfferByEan(product.ean);

          if (existingOffer) {
            await this.updateOffer(existingOffer.offerId, offer);
            results.updated++;
          } else {
            await this.createOffer(offer);
            results.created++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            product: product.sku || product.id,
            error: error.message
          });
        }
      }
    }

    console.log(`✅ Product sync complete: ${results.created} created, ${results.updated} updated, ${results.failed} failed`);
    return results;
  }

  /**
   * Map internal product to Bol.com offer format
   */
  mapProductToOffer(product, fulfillmentMethod = 'FBR') {
    return {
      ean: product.ean || product.barcode,
      condition: {
        name: 'NEW',
        category: 'NEW'
      },
      reference: product.sku || product.id,
      onHoldByRetailer: false,
      unknownProductTitle: product.name,
      pricing: {
        bundlePrices: [
          {
            quantity: 1,
            unitPrice: parseFloat(product.price) || 0
          }
        ]
      },
      stock: {
        amount: parseInt(product.stock_quantity) || 0,
        managedByRetailer: true
      },
      fulfilment: {
        method: fulfillmentMethod,
        deliveryCode: '24uurs-23'  // Default: next day delivery
      }
    };
  }

  /**
   * Find existing offer by EAN
   */
  async findOfferByEan(ean) {
    try {
      const response = await this.client.get('/offers', {
        params: { ean }
      });

      const offers = response.data?.offers || [];
      return offers.find(o => o.ean === ean);
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new offer on Bol.com
   */
  async createOffer(offer) {
    const response = await this.client.post('/offers', offer);
    console.log(`📦 Created offer for EAN: ${offer.ean}`);
    return response.data;
  }

  /**
   * Update an existing offer
   */
  async updateOffer(offerId, offerData) {
    const response = await this.client.put(`/offers/${offerId}`, offerData);
    console.log(`📝 Updated offer: ${offerId}`);
    return response.data;
  }

  /**
   * Get single offer by ID
   */
  async getOffer(offerId) {
    const response = await this.client.get(`/offers/${offerId}`);
    return response.data;
  }

  /**
   * Get all offers
   */
  async getOffers(page = 1) {
    const response = await this.client.get('/offers', {
      params: { page }
    });
    return response.data;
  }

  /**
   * Import orders from Bol.com
   * @param {Object} options - Import options
   */
  async importOrders(options = {}) {
    const { fulfillmentMethod = 'FBR', status = 'OPEN', page = 1 } = options;
    const results = {
      total: 0,
      imported: 0,
      errors: []
    };

    try {
      console.log(`📥 Importing orders from Bol.com (status: ${status}, fulfillment: ${fulfillmentMethod})...`);

      const response = await this.client.get('/orders', {
        params: {
          'fulfilment-method': fulfillmentMethod,
          status,
          page
        }
      });

      const orders = response.data?.orders || [];
      results.total = orders.length;

      for (const order of orders) {
        try {
          // Get full order details
          const orderDetails = await this.getOrder(order.orderId);
          results.imported++;

          // TODO: Save order to local database
          console.log(`✅ Imported order: ${order.orderId}`);
        } catch (error) {
          results.errors.push({
            orderId: order.orderId,
            error: error.message
          });
        }
      }

      console.log(`✅ Order import complete: ${results.imported}/${results.total} imported`);
      return results;
    } catch (error) {
      throw new Error(`Failed to import orders: ${error.message}`);
    }
  }

  /**
   * Get single order details
   */
  async getOrder(orderId) {
    const response = await this.client.get(`/orders/${orderId}`);
    return response.data;
  }

  /**
   * Update stock level on Bol.com
   */
  async updateStock(offerId, quantity) {
    const response = await this.client.put(`/offers/${offerId}/stock`, {
      amount: quantity,
      managedByRetailer: true
    });
    console.log(`📊 Updated stock for offer ${offerId}: ${quantity}`);
    return response.data;
  }

  /**
   * Confirm shipment of an order
   * @param {string} orderId - Bol.com order ID
   * @param {Object} shipmentData - Shipment details
   */
  async confirmShipment(orderId, shipmentData) {
    const {
      orderItemId,
      trackingCode,
      transporterCode = 'TNT',
      quantity = 1
    } = shipmentData;

    const response = await this.client.put('/orders/shipment', {
      orderItems: [{
        orderItemId,
        quantity
      }],
      shipmentReference: `SHIP-${orderId}-${Date.now()}`,
      transport: {
        transporterCode,
        trackAndTrace: trackingCode
      }
    });

    console.log(`📬 Shipment confirmed for order: ${orderId}`);
    return response.data;
  }

  /**
   * Get shipping labels for FBB orders
   */
  async getShippingLabel(orderId) {
    const response = await this.client.get(`/orders/${orderId}/shipping-label`);
    return response.data;
  }

  /**
   * Get returns from Bol.com
   */
  async getReturns(options = {}) {
    const { handled = false, page = 1 } = options;

    const response = await this.client.get('/returns', {
      params: {
        handled,
        page
      }
    });

    return response.data;
  }

  /**
   * Handle a return
   */
  async handleReturn(returnId, handlingResult) {
    const response = await this.client.put(`/returns/${returnId}`, {
      handlingResult,
      quantityReturned: 1
    });

    console.log(`🔄 Return ${returnId} handled: ${handlingResult}`);
    return response.data;
  }

  /**
   * Get commission rates
   */
  async getCommissions() {
    const response = await this.client.get('/commission');
    return response.data;
  }

  /**
   * Get insights/performance data
   */
  async getPerformanceIndicators() {
    const response = await this.client.get('/insights/performance/indicator');
    return response.data;
  }
}

module.exports = BolcomIntegration;
