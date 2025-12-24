const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');
const ConnectionManager = require('../../database/ConnectionManager');

/**
 * Background job for detecting and triggering abandoned cart automations
 *
 * This job runs periodically to:
 * 1. Find carts that have been abandoned (no activity for X minutes)
 * 2. Check if customer is already enrolled in abandoned cart automation
 * 3. Enroll eligible customers in the abandoned cart workflow
 *
 * Payload:
 * - abandonedAfterMinutes: Minutes of inactivity to consider cart abandoned (default: 60)
 * - limit: Max carts to process (default: 100)
 */
class AbandonedCartJob extends BaseJobHandler {
  async execute() {
    const payload = this.getPayload();
    const { abandonedAfterMinutes = 60, limit = 100 } = payload;

    this.log('Starting abandoned cart detection job');
    await this.updateProgress(5, 'Loading stores...');

    // Get all active stores
    const stores = await this.getActiveStores();

    if (stores.length === 0) {
      this.log('No active stores found');
      return { success: true, processed: 0 };
    }

    this.log(`Processing ${stores.length} stores`);

    let totalProcessed = 0;
    let totalEnrolled = 0;
    const errors = [];

    for (let i = 0; i < stores.length; i++) {
      await this.checkAbort();

      const store = stores[i];

      try {
        const result = await this.processStoreAbandonedCarts(
          store.id,
          abandonedAfterMinutes,
          limit
        );

        totalProcessed += result.processed;
        totalEnrolled += result.enrolled;
      } catch (error) {
        this.log(`Error processing store ${store.id}: ${error.message}`, 'error');
        errors.push({ storeId: store.id, error: error.message });
      }

      const progress = 5 + Math.floor((i + 1) / stores.length * 90);
      await this.updateProgress(progress, `Processed ${i + 1}/${stores.length} stores`);
    }

    await this.updateProgress(100, 'Abandoned cart detection completed');

    const result = {
      success: true,
      storesProcessed: stores.length,
      cartsProcessed: totalProcessed,
      customersEnrolled: totalEnrolled,
      errors: errors.slice(0, 10)
    };

    this.log(`Abandoned cart job completed: ${totalProcessed} carts, ${totalEnrolled} enrolled`);
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

  /**
   * Process abandoned carts for a single store
   */
  async processStoreAbandonedCarts(storeId, abandonedAfterMinutes, limit) {
    const knex = await ConnectionManager.getConnection(storeId);

    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - abandonedAfterMinutes * 60 * 1000);

    // Find abandoned carts
    const abandonedCarts = await knex('carts')
      .select([
        'carts.id',
        'carts.customer_id',
        'carts.session_id',
        'carts.updated_at',
        'carts.total_amount',
        'customers.email as customer_email',
        'customers.first_name',
        'customers.last_name'
      ])
      .leftJoin('customers', 'carts.customer_id', 'customers.id')
      .where('carts.updated_at', '<', cutoffTime.toISOString())
      .whereNotNull('carts.customer_id')
      .where(function() {
        this.where('carts.abandoned_email_sent', false)
          .orWhereNull('carts.abandoned_email_sent');
      })
      .whereRaw('(SELECT COUNT(*) FROM cart_items WHERE cart_id = carts.id) > 0')
      .orderBy('carts.updated_at', 'asc')
      .limit(limit);

    if (abandonedCarts.length === 0) {
      return { processed: 0, enrolled: 0 };
    }

    this.log(`Found ${abandonedCarts.length} abandoned carts in store ${storeId}`);

    // Get active abandoned cart automation
    const automation = await this.getAbandonedCartAutomation(storeId);

    let enrolled = 0;

    for (const cart of abandonedCarts) {
      try {
        if (!cart.customer_email) {
          continue;
        }

        // Mark cart as processed
        await knex('carts')
          .where('id', cart.id)
          .update({ abandoned_email_sent: true });

        // Enroll in automation if available
        if (automation) {
          const automationService = require('../../services/automation-service');

          // Check if already enrolled
          const isEnrolled = await automationService.isEnrolled(
            storeId,
            automation.id,
            cart.customer_email
          );

          if (!isEnrolled) {
            await automationService.enrollCustomer(storeId, automation.id, {
              email: cart.customer_email,
              customerId: cart.customer_id,
              metadata: {
                cart_id: cart.id,
                cart_total: cart.total_amount,
                first_name: cart.first_name,
                last_name: cart.last_name,
                trigger: 'abandoned_cart'
              }
            });
            enrolled++;
          }
        }
      } catch (error) {
        this.log(`Error processing cart ${cart.id}: ${error.message}`, 'warn');
      }
    }

    return { processed: abandonedCarts.length, enrolled };
  }

  /**
   * Get active abandoned cart automation for a store
   */
  async getAbandonedCartAutomation(storeId) {
    try {
      const AutomationWorkflow = require('../../models/AutomationWorkflow');
      const automations = await AutomationWorkflow.findByTrigger(storeId, 'abandoned_cart');
      return automations.find(a => a.is_active) || null;
    } catch (error) {
      this.log(`Error getting automation: ${error.message}`, 'warn');
      return null;
    }
  }
}

module.exports = AbandonedCartJob;
