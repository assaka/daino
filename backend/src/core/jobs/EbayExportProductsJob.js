const BaseJobHandler = require('./BaseJobHandler');
const EbayExportService = require('../../services/ebay-export-service');

class EbayExportProductsJob extends BaseJobHandler {
  async execute() {
    const { storeId, productIds, options = {} } = this.job.payload;

    this.log(`Starting eBay product export for store ${storeId}`);
    await this.updateProgress(10, 'Initializing eBay connection...');

    const exportService = new EbayExportService(storeId);
    await exportService.initialize();

    await this.updateProgress(20, 'Exporting products...');

    const result = await exportService.exportProducts(productIds, {
      ...options,
      progressCallback: async (progress) => {
        // Check for cancellation on each progress update
        await this.checkAbort();
        const percent = 20 + (progress.current / progress.total * 75);
        await this.updateProgress(Math.round(percent), `Processing: ${progress.item}`);
      }
    });

    await this.updateProgress(100, 'Export completed');
    this.log(`Export complete: ${result.successful} successful, ${result.failed} failed`);

    return result;
  }

  log(message) {
    console.log(`[EbayExportProductsJob ${this.job.id}] ${message}`);
  }
}

module.exports = EbayExportProductsJob;
