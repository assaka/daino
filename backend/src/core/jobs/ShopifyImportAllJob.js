const BaseJobHandler = require('./BaseJobHandler');
const ShopifyImportService = require('../../services/shopify-import-service');

/**
 * Shopify Import All Job Handler
 *
 * Imports both Shopify collections and products in a single job.
 * This job survives server restarts/deployments when using BullMQ.
 */
class ShopifyImportAllJob extends BaseJobHandler {
  async execute() {
    const { storeId, options = {} } = this.job.payload;

    this.log(`Starting full Shopify import (collections + products) for store ${storeId}`);
    await this.updateProgress(5, 'Initializing Shopify connection...');

    // Initialize import service
    const importService = new ShopifyImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize Shopify connection: ${initResult.message}`);
    }

    await this.updateProgress(10, 'Connection established, starting full import...');

    // Import everything with progress tracking
    const result = await importService.fullImport({
      ...options,
      progressCallback: async (progress) => {
        // Collections: 10% - 40%
        if (progress.stage === 'fetching_collections') {
          const fetchProgress = 10 + (progress.current / progress.total * 10);
          await this.updateProgress(
            Math.round(fetchProgress),
            `Fetching collections: ${progress.current}/${progress.total}`
          );
        } else if (progress.stage === 'importing_collections') {
          const importProgress = 20 + (progress.current / progress.total * 20);
          await this.updateProgress(
            Math.round(importProgress),
            `Importing collection: ${progress.item} (${progress.current}/${progress.total})`
          );
        }
        // Products: 40% - 100%
        else if (progress.stage === 'fetching_products') {
          const fetchProgress = 40 + (progress.current / progress.total * 15);
          await this.updateProgress(
            Math.round(fetchProgress),
            `Fetching products: ${progress.current}/${progress.total}`
          );
        } else if (progress.stage === 'downloading_images') {
          const imageProgress = 55 + (progress.current / progress.total * 20);
          await this.updateProgress(
            Math.round(imageProgress),
            `Downloading images: ${progress.current}/${progress.total}`
          );
        } else if (progress.stage === 'importing_products') {
          const importProgress = 75 + (progress.current / progress.total * 24);
          await this.updateProgress(
            Math.round(importProgress),
            `Importing product: ${progress.item} (${progress.current}/${progress.total})`
          );
        }
      }
    });

    await this.updateProgress(100, 'Full import completed');

    this.log(`Full import complete: ${result.collections?.stats?.imported || 0} collections, ${result.products?.stats?.imported || 0} products imported`);

    return result;
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[ShopifyImportAllJob ${this.job.id}] ${message}`);
  }
}

module.exports = ShopifyImportAllJob;
