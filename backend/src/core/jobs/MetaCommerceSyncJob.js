const BaseJobHandler = require('./BaseJobHandler');
const MetaCommerceService = require('../../services/meta-commerce-service');
const IntegrationConfig = require('../../models/IntegrationConfig');

/**
 * Meta Commerce Sync Job
 *
 * Syncs products to Instagram Shopping via Meta Commerce Manager
 */
class MetaCommerceSyncJob extends BaseJobHandler {
  async execute() {
    const { storeId, productIds, options = {} } = this.job.payload;

    this.log(`Starting Meta Commerce sync for store ${storeId}`);
    await this.updateProgress(5, 'Initializing Meta Commerce connection...');

    // Update sync status to 'syncing'
    const integration = await IntegrationConfig.findByStoreAndType(storeId, 'meta-commerce');
    if (integration) {
      await IntegrationConfig.updateSyncStatus(integration.id, storeId, 'syncing');
    }

    try {
      const service = new MetaCommerceService(storeId);
      await service.initialize();

      await this.updateProgress(10, 'Connection established, fetching products...');

      const result = await service.syncProducts(productIds, {
        ...options,
        progressCallback: async (progress) => {
          // Check for cancellation on each progress update
          await this.checkAbort();

          let progressPercent = 10;

          if (progress.stage === 'fetching') {
            progressPercent = 10 + (progress.current / progress.total * 20);
          } else if (progress.stage === 'transforming') {
            progressPercent = 30 + (progress.current / progress.total * 30);
          } else if (progress.stage === 'uploading') {
            progressPercent = 60 + (progress.current / progress.total * 35);
          }

          await this.updateProgress(
            Math.round(progressPercent),
            progress.item ? `${progress.stage}: ${progress.item}` : progress.stage
          );
        }
      });

      // Update sync status
      if (integration) {
        await IntegrationConfig.updateSyncStatus(
          integration.id,
          storeId,
          result.failed > 0 ? 'partial' : 'success'
        );

        // Store errors and statistics
        if (result.errors && result.errors.length > 0) {
          const currentConfig = integration.config_data || {};
          await IntegrationConfig.createOrUpdate(storeId, 'meta-commerce', {
            ...currentConfig,
            productErrors: result.errors,
            statistics: {
              ...currentConfig.statistics,
              totalProducts: result.total,
              lastSyncAt: new Date().toISOString(),
              lastSyncStatus: result.failed > 0 ? 'partial' : 'success',
              lastSyncErrors: result.failed
            }
          });
        }
      }

      await this.updateProgress(100, 'Sync completed');
      this.log(`Sync complete: ${result.successful} successful, ${result.failed} failed`);

      return result;

    } catch (error) {
      // Update sync status to error
      if (integration) {
        await IntegrationConfig.updateSyncStatus(
          integration.id,
          storeId,
          'error',
          error.message
        );
      }
      throw error;
    }
  }

  log(message) {
    console.log(`[MetaCommerceSyncJob ${this.job.id}] ${message}`);
  }
}

module.exports = MetaCommerceSyncJob;
