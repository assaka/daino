const BaseJobHandler = require('./BaseJobHandler');
const ShopifyImportService = require('../../services/shopify-import-service');

/**
 * Shopify Import Collections Job Handler
 *
 * Imports Shopify collections (custom + smart) as categories in the background.
 * This job survives server restarts/deployments when using BullMQ.
 */
class ShopifyImportCollectionsJob extends BaseJobHandler {
  async execute() {
    const { storeId, options = {} } = this.job.payload;

    this.log(`Starting Shopify collections import for store ${storeId}`);
    await this.updateProgress(5, 'Initializing Shopify connection...');

    // Initialize import service
    const importService = new ShopifyImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize Shopify connection: ${initResult.message}`);
    }

    await this.updateProgress(10, 'Connection established, fetching collections...');

    // Import collections with progress tracking
    const result = await importService.importCollections({
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        if (progress.stage === 'fetching_collections') {
          const fetchProgress = 10 + (progress.current / progress.total * 30);
          await this.updateProgress(
            Math.round(fetchProgress),
            `Fetching collections: ${progress.current}/${progress.total}`
          );
        } else if (progress.stage === 'importing_collections') {
          const importProgress = 40 + (progress.current / progress.total * 55);
          await this.updateProgress(
            Math.round(importProgress),
            `Importing collection: ${progress.item} (${progress.current}/${progress.total})`
          );
        }
      }
    });

    await this.updateProgress(100, 'Collections import completed');

    this.log(`Collections import complete: ${result.stats.collections.imported} imported, ${result.stats.collections.failed} failed`);

    return result;
  }

  /**
   * Helper method for logging
   */
  log(message) {
    console.log(`[ShopifyImportCollectionsJob ${this.job.id}] ${message}`);
  }
}

module.exports = ShopifyImportCollectionsJob;
