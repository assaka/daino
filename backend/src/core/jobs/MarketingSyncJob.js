const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');
const ConnectionManager = require('../../database/ConnectionManager');

/**
 * Background job for syncing contacts to marketing platforms
 *
 * This job runs hourly to:
 * 1. Get customers that have been modified since last sync
 * 2. Sync them to all active marketing integrations (Klaviyo, Mailchimp, HubSpot)
 * 3. Log sync results
 *
 * Payload:
 * - storeId: Optional - sync specific store only
 * - fullSync: Sync all customers, not just modified (default: false)
 * - batchSize: Customers per batch (default: 100)
 */
class MarketingSyncJob extends BaseJobHandler {
  async execute() {
    const payload = this.getPayload();
    const { storeId, fullSync = false, batchSize = 100 } = payload;

    this.log('Starting marketing sync job');
    await this.updateProgress(5, 'Loading stores...');

    // Get stores to process
    let stores;
    if (storeId) {
      stores = [{ id: storeId }];
    } else {
      stores = await this.getActiveStores();
    }

    if (stores.length === 0) {
      this.log('No stores to process');
      return { success: true, processed: 0 };
    }

    this.log(`Processing ${stores.length} stores`);

    let totalSynced = 0;
    let totalFailed = 0;
    const results = {};

    for (let i = 0; i < stores.length; i++) {
      await this.checkAbort();

      const store = stores[i];

      try {
        const result = await this.syncStoreContacts(store.id, fullSync, batchSize);
        totalSynced += result.synced;
        totalFailed += result.failed;
        results[store.id] = result;

        this.log(`Store ${store.id}: ${result.synced} synced, ${result.failed} failed`);
      } catch (error) {
        this.log(`Error processing store ${store.id}: ${error.message}`, 'error');
        results[store.id] = { success: false, error: error.message };
      }

      const progress = 5 + Math.floor((i + 1) / stores.length * 90);
      await this.updateProgress(progress, `Processed ${i + 1}/${stores.length} stores`);
    }

    await this.updateProgress(100, 'Marketing sync completed');

    const result = {
      success: true,
      storesProcessed: stores.length,
      totalSynced,
      totalFailed,
      results
    };

    this.log(`Marketing sync completed: ${totalSynced} synced, ${totalFailed} failed`);
    return result;
  }

  /**
   * Sync contacts for a single store
   */
  async syncStoreContacts(storeId, fullSync, batchSize) {
    const marketingService = require('../../services/marketing-integration-service');

    // Get active integrations
    const integrations = await marketingService.getIntegrations(storeId);
    const activeIntegrations = integrations.filter(i => i.isConnected);

    if (activeIntegrations.length === 0) {
      return { synced: 0, failed: 0, message: 'No active integrations' };
    }

    // Get customers to sync
    const customers = await this.getCustomersToSync(storeId, fullSync, batchSize);

    if (customers.length === 0) {
      return { synced: 0, failed: 0, message: 'No customers to sync' };
    }

    this.log(`Syncing ${customers.length} customers to ${activeIntegrations.length} integrations`);

    let synced = 0;
    let failed = 0;
    const integrationResults = {};

    // Sync to each active integration
    for (const integration of activeIntegrations) {
      try {
        const providerName = integration.provider;

        for (const customer of customers) {
          try {
            await marketingService.syncContact(storeId, providerName, {
              id: customer.id,
              email: customer.email,
              first_name: customer.first_name,
              last_name: customer.last_name,
              phone: customer.phone,
              total_orders: customer.total_orders,
              total_spent: customer.total_spent
            });
            synced++;
          } catch (error) {
            failed++;
            this.log(`Failed to sync ${customer.email} to ${providerName}: ${error.message}`, 'warn');
          }
        }

        integrationResults[providerName] = { success: true };
      } catch (error) {
        integrationResults[integration.provider] = { success: false, error: error.message };
      }
    }

    // Update last sync timestamp for these customers
    await this.markCustomersSynced(storeId, customers.map(c => c.id));

    // Log sync
    await this.logSync(storeId, {
      synced,
      failed,
      integrations: Object.keys(integrationResults)
    });

    return { synced, failed, integrations: integrationResults };
  }

  /**
   * Get customers that need syncing
   */
  async getCustomersToSync(storeId, fullSync, limit) {
    const knex = await ConnectionManager.getConnection(storeId);

    let query = knex('customers')
      .select([
        'id',
        'email',
        'first_name',
        'last_name',
        'phone',
        'total_orders',
        'total_spent',
        'marketing_synced_at',
        'updated_at'
      ])
      .whereNotNull('email')
      .where('email', '!=', '')
      .orderBy('updated_at', 'desc')
      .limit(limit);

    if (!fullSync) {
      // Only get customers modified since last sync
      query = query.where(function() {
        this.whereNull('marketing_synced_at')
          .orWhereRaw('updated_at > marketing_synced_at');
      });
    }

    return await query;
  }

  /**
   * Mark customers as synced
   */
  async markCustomersSynced(storeId, customerIds) {
    if (customerIds.length === 0) return;

    try {
      const knex = await ConnectionManager.getConnection(storeId);

      await knex('customers')
        .whereIn('id', customerIds)
        .update({ marketing_synced_at: new Date() });
    } catch (error) {
      this.log(`Error marking customers synced: ${error.message}`, 'warn');
    }
  }

  /**
   * Log sync operation
   */
  async logSync(storeId, data) {
    try {
      const MarketingSyncLog = require('../../models/MarketingSyncLog');
      await MarketingSyncLog.create(storeId, {
        syncType: 'contact_sync',
        status: data.failed === 0 ? 'success' : 'partial',
        recordsSynced: data.synced,
        recordsFailed: data.failed,
        integrations: data.integrations
      });
    } catch (error) {
      this.log(`Error logging sync: ${error.message}`, 'warn');
    }
  }

  /**
   * Get all active stores from master database
   */
  async getActiveStores() {
    if (!masterDbClient) {
      this.log('Master DB client not available', 'warn');
      return [];
    }

    const { data: stores, error } = await masterDbClient
      .from('stores')
      .select('id, name')
      .eq('is_active', true);

    if (error) {
      this.log(`Error fetching stores: ${error.message}`, 'error');
      return [];
    }

    return stores || [];
  }
}

module.exports = MarketingSyncJob;
