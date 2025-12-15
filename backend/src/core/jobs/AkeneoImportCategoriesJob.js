const BaseJobHandler = require('./BaseJobHandler');
const AkeneoIntegration = require('../../services/akeneo-integration');
const IntegrationConfig = require('../../models/IntegrationConfig');
const ImportStatistic = require('../../models/ImportStatistic');

/**
 * Background job handler for Akeneo category imports
 */
class AkeneoImportCategoriesJob extends BaseJobHandler {
  async execute() {
    this.log('Starting Akeneo categories import job');

    const payload = this.getPayload();
    const {
      storeId,
      locale = 'en_US',
      dryRun = false,
      filters = {},
      settings = {}
    } = payload;

    if (!storeId) {
      throw new Error('storeId is required in job payload');
    }

    // Validate dependencies
    await this.validateDependencies([
      {
        name: 'Akeneo Integration Config',
        check: async () => {
          const config = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
          return !!config;
        },
        message: 'Akeneo integration not configured for this store'
      }
    ]);

    let akeneoIntegration;
    let importStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    try {
      await this.updateProgress(0, 'Starting import...');
      await this.updateProgress(2, 'Initializing Akeneo integration...');

      // Initialize Akeneo integration
      const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
      if (!integrationConfig || !integrationConfig.config_data) {
        throw new Error('Akeneo integration not configured for this store');
      }
      akeneoIntegration = new AkeneoIntegration(integrationConfig.config_data);

      // Test connection
      const connectionTest = await akeneoIntegration.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Akeneo connection failed: ${connectionTest.message}`);
      }

      await this.updateProgress(5, 'Fetching categories from Akeneo...');

      // Import categories with progress callback for linear progress
      const result = await akeneoIntegration.importCategories(storeId, {
        locale,
        dryRun,
        filters,
        settings,
        progressCallback: async (progress) => {
          // Check for cancellation on each progress update
          await this.checkAbort();

          // Track progress stats for partial results on cancellation
          if (progress.total) importStats.total = progress.total;
          if (progress.current) importStats.imported = progress.current;

          // Linear progress: current/total * 100 (capped at 99 to leave room for final steps)
          const percent = Math.min(99, Math.round((progress.current / progress.total) * 100));
          await this.updateProgress(
            percent,
            `Importing: ${progress.item} (${progress.current}/${progress.total})`
          );
        }
      });

      // Extract stats from result (stats are returned directly, not nested)
      if (result.stats) {
        importStats = {
          total: result.stats.total || 0,
          imported: result.stats.imported || 0,
          skipped: result.stats.skipped || 0,
          failed: result.stats.failed || 0,
          errors: result.stats.errors || []
        };
      }

      await this.updateProgress(95, 'Saving import statistics...');

      // Save import statistics
      await ImportStatistic.saveImportResults(storeId, 'categories', {
        totalProcessed: importStats.total,
        successfulImports: importStats.imported,
        failedImports: importStats.failed,
        skippedImports: importStats.skipped,
        errorDetails: importStats.errors.length > 0 ? JSON.stringify(importStats.errors) : null,
        importMethod: 'background_job'
      });

      await this.updateProgress(100, 'Category import completed');

      const finalResult = {
        success: result.success,
        message: `Import completed: ${importStats.imported} imported, ${importStats.skipped} skipped, ${importStats.failed} failed`,
        stats: importStats,
        dryRun,
        locale,
        filters
      };

      this.log(`Category import completed: ${JSON.stringify(finalResult.stats)}`);
      return finalResult;

    } catch (error) {
      // Save partial statistics if available
      if (importStats.total > 0 || importStats.imported > 0) {
        await ImportStatistic.saveImportResults(storeId, 'categories', {
          totalProcessed: importStats.total,
          successfulImports: importStats.imported,
          failedImports: importStats.failed,
          skippedImports: importStats.skipped,
          errorDetails: importStats.errors.length > 0 ? JSON.stringify(importStats.errors) : error.message,
          importMethod: 'background_job'
        });
      }

      // For cancellation, include partial stats in the error so they can be saved
      const isCancellation = error.message?.includes('cancelled') || error.message?.includes('canceled');
      if (isCancellation) {
        error.partialResult = {
          success: false,
          cancelled: true,
          message: `Import cancelled: ${importStats.imported} imported before cancellation`,
          stats: importStats,
          dryRun,
          locale
        };
      }

      throw error;
    }
  }
}

module.exports = AkeneoImportCategoriesJob;