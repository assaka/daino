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
    await this.updateProgress(0, 'Initializing...');

    // Initialize import service
    const importService = new ShopifyImportService(storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      throw new Error(`Failed to initialize Shopify connection: ${initResult.message}`);
    }

    await this.updateProgress(0, 'Fetching collections from Shopify...');

    // Import collections with progress tracking
    // Progress starts at 0% and only increases when items are actually imported
    const result = await importService.importCollections({
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        if (progress.stage === 'fetching_collections') {
          // Stay at 0% while fetching
          await this.updateProgress(0, `Fetching collections: ${progress.current}/${progress.total}`);
        } else if (progress.stage === 'importing_collections') {
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
