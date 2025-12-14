const BaseJobHandler = require('./BaseJobHandler');
const ShopifyImportService = require('../../services/shopify-import-service');

/**
 * Shopify Import Products Job Handler
 *
 * Imports Shopify products with variants, images, and attributes in the background.
 * This job survives server restarts/deployments when using BullMQ.
 */
class ShopifyImportProductsJob extends BaseJobHandler {
  async execute() {
    const { storeId, options = {} } = this.job.payload;

    this.log(`Starting Shopify products import for store ${storeId}`);
    await this.updateProgress(5, 'Initializing Shopify connection...');

    // Initialize import service
    const importService = new ShopifyImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize Shopify connection: ${initResult.message}`);
    }

    await this.updateProgress(10, 'Connection established, fetching products...');

    // Import products with progress tracking
    // Simple linear progress: current/total * 100
    const result = await importService.importProducts({
      ...options,
      progressCallback: async (progress) => {
        if (progress.stage === 'importing_products') {
          // Linear progress based on products: 1/17 = 6%, 17/17 = 100%
          const percent = Math.round((progress.current / progress.total) * 100);
          await this.updateProgress(
            percent,
            `Importing: ${progress.item} (${progress.current}/${progress.total})`
          );
        }
      }
    });

    await this.updateProgress(100, 'Products import completed');

    // result.stats contains { total, imported, skipped, failed } directly
    const stats = result.stats || {};
    this.log(`Products import complete: ${stats.imported || 0} imported, ${stats.failed || 0} failed`);

    return result;
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[ShopifyImportProductsJob ${this.job.id}] ${message}`);
  }
}

module.exports = ShopifyImportProductsJob;
