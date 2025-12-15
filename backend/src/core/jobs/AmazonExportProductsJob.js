const BaseJobHandler = require('./BaseJobHandler');
const AmazonExportService = require('../../services/amazon-export-service');

/**
 * Amazon Export Products Job
 *
 * Exports products to Amazon with AI optimization and translation
 */
class AmazonExportProductsJob extends BaseJobHandler {
  async execute() {
    const { storeId, productIds, options = {} } = this.job.payload;

    this.log(`Starting Amazon product export for store ${storeId}`);
    await this.updateProgress(5, 'Initializing Amazon connection...');

    const exportService = new AmazonExportService(storeId);
    await exportService.initialize();

    await this.updateProgress(10, 'Connection established, exporting products...');

    const result = await exportService.exportProducts(productIds, {
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        let progressPercent = 10;

        if (progress.stage === 'fetching_products') {
          progressPercent = 10 + (progress.current / progress.total * 10);
        } else if (progress.stage === 'transforming_products') {
          progressPercent = 20 + (progress.current / progress.total * 20);
        } else if (progress.stage === 'ai_optimizing') {
          progressPercent = 40 + (progress.current / progress.total * 30);
        } else if (progress.stage === 'translating') {
          progressPercent = 70 + (progress.current / progress.total * 15);
        } else if (progress.stage === 'generating_feeds') {
          progressPercent = 85;
        }

        await this.updateProgress(
          Math.round(progressPercent),
          progress.item ? `${progress.stage}: ${progress.item}` : progress.stage
        );
      }
    });

    await this.updateProgress(100, 'Export completed');

    this.log(`Export complete: ${result.successful} successful, ${result.failed} failed`);

    return result;
  }

  log(message) {
    console.log(`[AmazonExportProductsJob ${this.job.id}] ${message}`);
  }
}

module.exports = AmazonExportProductsJob;
