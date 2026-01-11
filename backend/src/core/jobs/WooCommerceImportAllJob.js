const BaseJobHandler = require('./BaseJobHandler');
const WooCommerceImportService = require('../../services/woocommerce-import-service');

/**
 * WooCommerce Full Import Job Handler
 *
 * Imports WooCommerce categories and products in the background.
 * This job survives server restarts/deployments when using BullMQ.
 */
class WooCommerceImportAllJob extends BaseJobHandler {
  async execute() {
    const { storeId, options = {} } = this.job.payload;

    this.log(`Starting WooCommerce full import for store ${storeId}`);
    await this.updateProgress(0, 'Initializing...');

    // Initialize import service
    const importService = new WooCommerceImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize WooCommerce connection: ${initResult.message}`);
    }

    await this.updateProgress(0, 'Starting full import (categories + products)...');

    // Full import with progress tracking
    const result = await importService.fullImport({
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();

        // Calculate overall progress
        let percent = progress.overall_progress || 0;
        let message = 'Importing...';

        if (progress.stage === 'starting_categories') {
          message = 'Starting categories import...';
        } else if (progress.stage === 'importing_categories') {
          message = `Importing category: ${progress.item || ''} (${progress.current}/${progress.total})`;
        } else if (progress.stage === 'starting_products') {
          message = 'Starting products import...';
        } else if (progress.stage === 'importing_products') {
          message = `Importing product: ${progress.item || ''} (${progress.current}/${progress.total})`;
        }

        await this.updateProgress(percent, message);
      }
    });

    await this.updateProgress(100, 'Full import completed');

    const categoriesStats = result.categories?.stats || {};
    const productsStats = result.products?.stats || {};

    this.log(`Full import complete: Categories: ${categoriesStats.imported || 0} imported, Products: ${productsStats.imported || 0} imported`);

    return result;
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[WooCommerceImportAllJob ${this.job.id}] ${message}`);
  }
}

module.exports = WooCommerceImportAllJob;
