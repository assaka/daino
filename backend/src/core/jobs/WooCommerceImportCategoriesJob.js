const BaseJobHandler = require('./BaseJobHandler');
const WooCommerceImportService = require('../../services/woocommerce-import-service');

/**
 * WooCommerce Import Categories Job Handler
 *
 * Imports WooCommerce categories in the background.
 * This job survives server restarts/deployments when using BullMQ.
 */
class WooCommerceImportCategoriesJob extends BaseJobHandler {
  async execute() {
    const { storeId, options = {} } = this.job.payload;

    this.log(`Starting WooCommerce categories import for store ${storeId}`);
    await this.updateProgress(0, 'Initializing...');

    // Initialize import service
    const importService = new WooCommerceImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize WooCommerce connection: ${initResult.message}`);
    }

    await this.updateProgress(0, 'Fetching categories from WooCommerce...');

    // Import categories with progress tracking
    const result = await importService.importCategories({
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        if (progress.stage === 'importing_categories') {
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

    await this.updateProgress(100, 'Categories import completed');

    const stats = result.stats || {};
    this.log(`Categories import complete: ${stats.imported || 0} imported, ${stats.failed || 0} failed`);

    return result;
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[WooCommerceImportCategoriesJob ${this.job.id}] ${message}`);
  }
}

module.exports = WooCommerceImportCategoriesJob;
