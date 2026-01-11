const BaseJobHandler = require('./BaseJobHandler');
const TenantMigrationService = require('../../services/migrations/TenantMigrationService');
const ConnectionManager = require('../../services/database/ConnectionManager');

/**
 * Background job to run migrations on all pending stores
 */
class TenantMigrationJob extends BaseJobHandler {
  constructor(job) {
    super(job);
    this.jobType = 'tenant:migration:run-all';
  }

  async execute() {
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      stores: []
    };

    try {
      await this.updateProgress(0, 'Getting stores with pending migrations...');

      const stores = await TenantMigrationService.getStoresWithPendingMigrations();
      results.total = stores.length;

      if (stores.length === 0) {
        await this.updateProgress(100, 'No stores with pending migrations');
        return {
          success: true,
          message: 'No stores with pending migrations',
          ...results
        };
      }

      await this.updateProgress(5, `Found ${stores.length} store(s) with pending migrations`);

      for (let i = 0; i < stores.length; i++) {
        const store = stores[i];
        const storeId = store.store_id;
        const storeName = store.store_name || storeId.slice(0, 8);
        const progress = Math.round(5 + ((i + 1) / stores.length) * 90);

        await this.updateProgress(progress, `Migrating ${storeName} (${i + 1}/${stores.length})...`);

        try {
          const tenantDb = await ConnectionManager.getStoreConnection(storeId);
          const result = await TenantMigrationService.runPendingMigrations(storeId, tenantDb);

          if (result.success) {
            results.success++;
            results.stores.push({
              storeId,
              storeName,
              success: true,
              applied: result.applied?.length || 0
            });
          } else {
            results.failed++;
            results.stores.push({
              storeId,
              storeName,
              success: false,
              error: result.failed?.[0]?.error || 'Unknown error'
            });
          }
        } catch (error) {
          results.failed++;
          results.stores.push({
            storeId,
            storeName,
            success: false,
            error: error.message
          });
        }
      }

      await this.updateProgress(100, `Completed: ${results.success} succeeded, ${results.failed} failed`);

      return {
        success: results.failed === 0,
        message: `Migrations completed: ${results.success} succeeded, ${results.failed} failed`,
        ...results
      };

    } catch (error) {
      console.error('[TenantMigrationJob] Error:', error);
      throw error;
    }
  }
}

module.exports = TenantMigrationJob;
