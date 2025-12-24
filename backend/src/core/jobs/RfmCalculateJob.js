const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');

/**
 * Background job for calculating RFM scores for all customers
 *
 * This job runs daily to:
 * 1. Calculate Recency, Frequency, and Monetary scores for each customer
 * 2. Assign customers to RFM segments
 * 3. Update the customer_rfm_scores table
 *
 * Payload:
 * - storeId: Optional - calculate for specific store only
 * - forceRecalculate: Recalculate even if recently calculated (default: false)
 */
class RfmCalculateJob extends BaseJobHandler {
  async execute() {
    const payload = this.getPayload();
    const { storeId, forceRecalculate = false } = payload;

    this.log('Starting RFM calculation job');
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

    let totalCustomers = 0;
    const results = {};

    for (let i = 0; i < stores.length; i++) {
      await this.checkAbort();

      const store = stores[i];

      try {
        const rfmService = require('../../services/rfm-service');
        const result = await rfmService.calculateAllScores(store.id, { forceRecalculate });

        totalCustomers += result.customersProcessed || 0;
        results[store.id] = {
          success: true,
          customersProcessed: result.customersProcessed,
          segmentDistribution: result.segmentDistribution
        };

        this.log(`Store ${store.id}: ${result.customersProcessed} customers scored`);
      } catch (error) {
        this.log(`Error processing store ${store.id}: ${error.message}`, 'error');
        results[store.id] = { success: false, error: error.message };
      }

      const progress = 5 + Math.floor((i + 1) / stores.length * 90);
      await this.updateProgress(progress, `Processed ${i + 1}/${stores.length} stores`);
    }

    await this.updateProgress(100, 'RFM calculation completed');

    const result = {
      success: true,
      storesProcessed: stores.length,
      totalCustomersScored: totalCustomers,
      results
    };

    this.log(`RFM calculation completed: ${totalCustomers} customers across ${stores.length} stores`);
    return result;
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

module.exports = RfmCalculateJob;
