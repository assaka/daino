const AmazonFeedGenerator = require('./amazon-feed-generator');
const MarketplaceAIOptimizer = require('./marketplace-ai-optimizer');
const ConnectionManager = require('./database/ConnectionManager');
const translationService = require('./translation-service');

/**
 * Amazon Export Service
 *
 * Handles product export to Amazon with AI optimization and translation
 * Better than Channable with extra features!
 */
class AmazonExportService {
  constructor(storeId) {
    this.storeId = storeId;
    this.integration = null;
    this.feedGenerator = null;
    this.aiOptimizer = new MarketplaceAIOptimizer();
  }

  /**
   * Initialize service with credentials
   */
  async initialize() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data: integration, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', this.storeId)
      .eq('integration_type', 'amazon')
      .maybeSingle();

    if (error || !integration) {
      throw new Error('Amazon integration not configured for this store');
    }

    this.integration = integration;
    const config = integration.config_data;

    // Validate required credentials
    const requiredFields = ['sellerId', 'mwsAuthToken', 'awsAccessKeyId', 'awsSecretAccessKey'];
    const missing = requiredFields.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing Amazon credentials: ${missing.join(', ')}`);
    }

    this.feedGenerator = new AmazonFeedGenerator(
      config.sellerId,
      config.marketplaceId || 'ATVPDKIKX0DER'
    );

    return { success: true };
  }

  /**
   * Export products to Amazon
   */
  async exportProducts(productIds, options = {}) {
    const exportSettings = this.integration?.config_data?.exportSettings || {};
    const {
      useAIOptimization = exportSettings.use_ai_optimization || false,
      autoTranslate = exportSettings.auto_translate || false,
      targetLanguage = 'en',
      dryRun = false,
      progressCallback = null
    } = options;

    const results = {
      total: productIds.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      feeds: [],
      errors: []
    };

    if (progressCallback) {
      await progressCallback({
        stage: 'fetching_products',
        current: 0,
        total: productIds.length
      });
    }

    // Fetch products from database
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data: products, error: productsError } = await tenantDb
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('store_id', this.storeId);

    if (productsError || !products || products.length === 0) {
      throw new Error('No products found to export');
    }

    // Transform products to Amazon format
    const transformedProducts = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      results.processed++;

      try {
        if (progressCallback) {
          await progressCallback({
            stage: 'transforming_products',
            current: i + 1,
            total: products.length,
            item: product.name
          });
        }

        // Transform product data
        let transformed = await this.transformProduct(product);

        // AI Optimization (🔥 Cool Feature!)
        if (useAIOptimization) {
          if (progressCallback) {
            await progressCallback({
              stage: 'ai_optimizing',
              current: i + 1,
              total: products.length,
              item: product.name
            });
          }

          const optimized = await this.aiOptimizer.optimizeForAmazon(transformed, {
            targetAudience: exportSettings.target_audience || 'general'
          });

          if (optimized.success) {
            transformed.title = optimized.optimizedTitle;
            transformed.description = optimized.enhancedDescription;
            transformed.bulletPoints = optimized.bulletPoints;
            transformed.searchTerms = optimized.searchKeywords;
          }
        }

        // Auto-translation (🔥 Cool Feature!)
        if (autoTranslate && targetLanguage !== 'en') {
          if (progressCallback) {
            await progressCallback({
              stage: 'translating',
              current: i + 1,
              total: products.length,
              item: product.name
            });
          }

          transformed.title = await translationService.aiTranslate(transformed.title, 'en', targetLanguage);
          transformed.description = await translationService.aiTranslate(transformed.description, 'en', targetLanguage);

          if (transformed.bulletPoints) {
            transformed.bulletPoints = await Promise.all(
              transformed.bulletPoints.map(bp => translationService.aiTranslate(bp, 'en', targetLanguage))
            );
          }
        }

        // Validate product
        const validation = this.feedGenerator.validateProduct(transformed);
        if (!validation.valid) {
          results.failed++;
          results.errors.push({
            sku: product.sku,
            productId: product.id,
            errors: validation.errors
          });
          continue;
        }

        transformedProducts.push(transformed);
        results.successful++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          sku: product.sku,
          productId: product.id,
          error: error.message
        });
      }
    }

    // Generate feeds
    if (transformedProducts.length > 0 && !dryRun) {
      if (progressCallback) {
        await progressCallback({
          stage: 'generating_feeds',
          current: transformedProducts.length,
          total: transformedProducts.length
        });
      }

      // Product feed
      const productFeed = this.feedGenerator.generateProductFeed(transformedProducts);
      results.feeds.push({
        type: 'Product',
        content: productFeed,
        itemCount: transformedProducts.length
      });

      // Inventory feed
      const inventoryItems = transformedProducts.map(p => ({
        sku: p.sku,
        quantity: p.quantity || 0,
        fulfillmentLatency: 2
      }));
      const inventoryFeed = this.feedGenerator.generateInventoryFeed(inventoryItems);
      results.feeds.push({
        type: 'Inventory',
        content: inventoryFeed,
        itemCount: inventoryItems.length
      });

      // Price feed
      const priceItems = transformedProducts.map(p => ({
        sku: p.sku,
        price: p.price,
        currency: 'USD'
      }));
      const priceFeed = this.feedGenerator.generatePriceFeed(priceItems);
      results.feeds.push({
        type: 'Price',
        content: priceFeed,
        itemCount: priceItems.length
      });

      // Image feed (if images exist)
      const imageItems = [];
      transformedProducts.forEach(p => {
        if (p.images && p.images.length > 0) {
          p.images.forEach((img, idx) => {
            imageItems.push({
              sku: p.sku,
              imageUrl: img,
              imageType: idx === 0 ? 'Main' : `PT${idx}`
            });
          });
        }
      });

      if (imageItems.length > 0) {
        const imageFeed = this.feedGenerator.generateImageFeed(imageItems);
        results.feeds.push({
          type: 'ProductImage',
          content: imageFeed,
          itemCount: imageItems.length
        });
      }
    }

    // Update statistics
    if (!dryRun) {
      const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
      const stats = this.integration.config_data.statistics || {};
      const updatedConfigData = {
        ...this.integration.config_data,
        statistics: {
          ...stats,
          total_exports: (stats.total_exports || 0) + 1,
          successful_exports: (stats.successful_exports || 0) + (results.successful > 0 ? 1 : 0),
          failed_exports: (stats.failed_exports || 0) + (results.failed > 0 ? 1 : 0),
          total_products_synced: (stats.total_products_synced || 0) + results.successful
        }
      };

      await tenantDb
        .from('integration_configs')
        .update({
          config_data: updatedConfigData,
          last_sync_at: new Date().toISOString(),
          sync_status: 'success',
          updated_at: new Date().toISOString()
        })
        .eq('id', this.integration.id);
    }

    return results;
  }

  /**
   * Transform product from our format to Amazon format
   */
  async transformProduct(product) {
    const exportSettings = this.integration?.config_data?.exportSettings || {};

    return {
      sku: product.sku || `AUTO-${product.id}`,
      title: product.name,
      description: product.description || product.short_description || '',
      brand: product.brand || exportSettings.default_brand || 'Generic',
      price: this.calculatePrice(product.price, exportSettings.price_adjustment_percent || 0),
      quantity: product.stock_quantity || 0,
      upc: product.upc || product.ean || product.barcode,
      ean: product.ean,
      asin: product.asin,
      bulletPoints: this.generateBulletPoints(product),
      searchTerms: this.extractSearchTerms(product),
      images: this.getProductImages(product),
      productType: exportSettings.default_product_type || 'Home',
      color: product.color,
      size: product.size,
      dimensions: product.dimensions,
      manufacturer: product.manufacturer || product.brand,
      operation: 'Update'
    };
  }

  /**
   * Calculate adjusted price
   */
  calculatePrice(basePrice, adjustmentPercent) {
    if (!basePrice) return 0;
    const adjustment = 1 + (adjustmentPercent / 100);
    return parseFloat((basePrice * adjustment).toFixed(2));
  }

  /**
   * Generate bullet points from product data
   */
  generateBulletPoints(product) {
    const bullets = [];

    // Extract from features if available
    if (product.features && Array.isArray(product.features)) {
      bullets.push(...product.features.slice(0, 5));
    }

    // Generate from attributes (array format from product_attribute_values)
    if (product.attributes && Array.isArray(product.attributes)) {
      product.attributes.slice(0, 5 - bullets.length).forEach(attr => {
        if (attr.code && attr.value) {
          bullets.push(`${attr.code}: ${attr.value}`);
        }
      });
    }

    // Fallback bullets
    if (bullets.length === 0) {
      if (product.brand) bullets.push(`Brand: ${product.brand}`);
      if (product.color) bullets.push(`Color: ${product.color}`);
      if (product.size) bullets.push(`Size: ${product.size}`);
      bullets.push('High quality product');
      bullets.push('Fast shipping available');
    }

    return bullets.slice(0, 5);
  }

  /**
   * Extract search terms from product
   */
  extractSearchTerms(product) {
    const terms = new Set();

    // Add from name
    if (product.name) {
      product.name.split(' ').filter(w => w.length > 3).forEach(w => terms.add(w.toLowerCase()));
    }

    // Add from category
    if (product.category_name) {
      product.category_name.split(' ').forEach(w => terms.add(w.toLowerCase()));
    }

    // Add from tags
    if (product.tags && Array.isArray(product.tags)) {
      product.tags.forEach(t => terms.add(t.toLowerCase()));
    }

    return Array.from(terms).slice(0, 10);
  }

  /**
   * Get product image URLs
   */
  getProductImages(product) {
    const images = [];

    if (product.image_url) {
      images.push(product.image_url);
    }

    if (product.images && Array.isArray(product.images)) {
      images.push(...product.images);
    }

    // Get full URLs if relative
    return images.map(img => {
      if (img.startsWith('http')) return img;
      return `${process.env.STORAGE_URL || ''}${img}`;
    });
  }

  /**
   * Sync inventory to Amazon
   */
  async syncInventory(productIds) {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data: products, error } = await tenantDb
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('store_id', this.storeId);

    if (error || !products) {
      throw new Error('Failed to fetch products for inventory sync');
    }

    const inventoryItems = products.map(p => ({
      sku: p.sku || `AUTO-${p.id}`,
      quantity: p.stock_quantity || 0,
      fulfillmentLatency: 2
    }));

    const feed = this.feedGenerator.generateInventoryFeed(inventoryItems);

    return {
      success: true,
      feed,
      itemCount: inventoryItems.length
    };
  }
}

module.exports = AmazonExportService;
