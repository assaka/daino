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
    await this.updateProgress(0, 'Initializing...');

    // Initialize import service
    const importService = new ShopifyImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize Shopify connection: ${initResult.message}`);
    }

    await this.updateProgress(0, 'Fetching products from Shopify...');

    // Import products with progress tracking
    // Progress starts at 0% and only increases when items are actually imported
    const result = await importService.importProducts({
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        if (progress.stage === 'importing_products') {
          // Only show progress once first item is imported
          let percent = 0;
          if (progress.current >= 1 && progress.total > 0) {
            percent = Math.round((progress.current / progress.total) * 100);
          }
          await this.updateProgress(
            percent,
            progress.current >= 1
              ? `Importing: ${progress.item} (${progress.current}/${progress.total})`
              : 'Starting import...'
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
