const BaseJobHandler = require('./BaseJobHandler');
const WooCommerceImportService = require('../../services/woocommerce-import-service');

/**
 * WooCommerce Import Products Job Handler
 *
 * Imports WooCommerce products with images and attributes in the background.
 * This job survives server restarts/deployments when using BullMQ.
 */
class WooCommerceImportProductsJob extends BaseJobHandler {
  async execute() {
    const { storeId, options = {} } = this.job.payload;

    this.log(`Starting WooCommerce products import for store ${storeId}`);
    await this.updateProgress(0, 'Initializing...');

    // Initialize import service
    const importService = new WooCommerceImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize WooCommerce connection: ${initResult.message}`);
    }

    await this.updateProgress(0, 'Fetching products from WooCommerce...');

    // Import products with progress tracking
    const result = await importService.importProducts({
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        if (progress.stage === 'importing_products') {
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

    const stats = result.stats || {};
    this.log(`Products import complete: ${stats.imported || 0} imported, ${stats.failed || 0} failed`);

    return result;
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[WooCommerceImportProductsJob ${this.job.id}] ${message}`);
  }
}

module.exports = WooCommerceImportProductsJob;
