const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');
const creditService = require('../../services/credit-service');

/**
 * Daily Credit Deduction Job
 * Deducts credits daily for:
 * - Published stores (cost configured in service_credit_costs table)
 * - Active custom domains (cost configured in service_credit_costs table)
 */
class DailyCreditDeductionJob extends BaseJobHandler {
  constructor(job) {
    super(job);
  }

  async execute() {
    try {
      // Verify masterDbClient is available
      if (!masterDbClient) {
        throw new Error('masterDbClient not initialized - check MASTER_SUPABASE_URL and MASTER_SUPABASE_SERVICE_KEY');
      }

      // TESTING MODE: Query ALL stores (bypass published check)
      // TODO: Re-enable .eq('published', true) after testing
      const { data: publishedStores, error: storesError } = await masterDbClient
        .from('stores')
        .select('id, user_id, slug, published')
        // .eq('published', true)  // DISABLED FOR TESTING
        .order('created_at', { ascending: false });

      console.log('[DAILY_DEDUCTION] TESTING MODE: Processing ALL stores (published check bypassed)');

      if (storesError) {
        throw new Error(`Failed to fetch published stores: ${storesError.message}`);
      }

      if (!publishedStores || publishedStores.length === 0) {
        console.log('[DAILY_DEDUCTION] No published stores found');
        return {
          success: true,
          message: 'No published stores found',
          processed: 0,
          successful: 0,
          failed: 0,
          timestamp: new Date().toISOString()
        };
      }

      console.log(`[DAILY_DEDUCTION] Found ${publishedStores.length} published stores to process`);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        stores: [],
        errors: []
      };

      for (const store of publishedStores) {
        results.processed++;

        try {
          // Query user from master DB
          const { data: owner, error: ownerError } = await masterDbClient
            .from('users')
            .select('id, email')
            .eq('id', store.user_id)
            .maybeSingle();

          if (ownerError) {
            results.failed++;
            results.errors.push({
              store_id: store.id,
              store_slug: store.slug,
              error: `Failed to fetch owner: ${ownerError.message}`
            });
            continue;
          }

          if (!owner) {
            results.failed++;
            results.errors.push({
              store_id: store.id,
              store_slug: store.slug,
              error: 'Store owner not found'
            });
            continue;
          }

          console.log(`[DAILY_DEDUCTION] Processing store ${store.slug} (${store.id})`);
          const chargeResult = await creditService.chargeDailyPublishingFee(store.user_id, store.id);
          console.log(`[DAILY_DEDUCTION] Charge result for ${store.slug}:`, JSON.stringify(chargeResult));

          if (chargeResult.success) {
            if (chargeResult.already_charged) {
              // Already charged today - count as skipped, not success or failure
              results.stores.push({
                store_id: store.id,
                store_slug: store.slug,
                owner_id: store.user_id,
                credits_deducted: 0,
                status: 'already_charged',
                message: chargeResult.message
              });
            } else {
              results.successful++;
              results.stores.push({
                store_id: store.id,
                store_slug: store.slug,
                owner_id: store.user_id,
                credits_deducted: chargeResult.credits_deducted || 1,
                remaining_balance: chargeResult.remaining_balance,
                status: 'success'
              });
            }
          } else {
            results.failed++;
            results.errors.push({
              store_id: store.id,
              store_slug: store.slug,
              error: chargeResult.message || 'Unknown error'
            });
          }
        } catch (storeError) {
          results.failed++;
          results.errors.push({
            store_id: store.id,
            store_slug: store.slug,
            error: storeError.message
          });
        }
      }

      // Process custom domains - query from master DB lookup table
      // Only charge for domains that are active, verified, AND have active SSL
      const { data: activeCustomDomains, error: domainsError } = await masterDbClient
        .from('custom_domains_lookup')
        .select('id, store_id, domain, is_active, is_verified, ssl_status')
        .eq('is_active', true)
        .eq('is_verified', true)
        .eq('ssl_status', 'active')
        .order('created_at', { ascending: false });

      if (domainsError) {
        console.error('Failed to fetch custom domains:', domainsError.message);
        // Continue with store results even if domain query fails
      }

      const domainResults = {
        processed: 0,
        successful: 0,
        failed: 0,
        domains: [],
        errors: []
      };

      const domainsToProcess = activeCustomDomains || [];

      for (const domain of domainsToProcess) {
        domainResults.processed++;

        try {
          // Query store from master DB
          const { data: store, error: storeError } = await masterDbClient
            .from('stores')
            .select('id, slug, user_id')
            .eq('id', domain.store_id)
            .maybeSingle();

          if (storeError) {
            domainResults.failed++;
            domainResults.errors.push({
              domain_id: domain.id,
              domain_name: domain.domain,
              error: `Failed to fetch store: ${storeError.message}`
            });
            continue;
          }

          if (!store) {
            domainResults.failed++;
            domainResults.errors.push({
              domain_id: domain.id,
              domain_name: domain.domain,
              error: 'Store not found'
            });
            continue;
          }

          const chargeResult = await creditService.chargeDailyCustomDomainFee(
            store.user_id,
            domain.id,
            domain.domain
          );

          if (chargeResult.success) {
            if (chargeResult.already_charged) {
              // Already charged today - count as skipped, not success or failure
              domainResults.domains.push({
                domain_id: domain.id,
                domain_name: domain.domain,
                store_id: domain.store_id,
                store_slug: store.slug,
                owner_id: store.user_id,
                credits_deducted: 0,
                status: 'already_charged',
                message: chargeResult.message
              });
            } else {
              domainResults.successful++;
              domainResults.domains.push({
                domain_id: domain.id,
                domain_name: domain.domain,
                store_id: domain.store_id,
                store_slug: store.slug,
                owner_id: store.user_id,
                credits_deducted: chargeResult.credits_deducted,
                remaining_balance: chargeResult.remaining_balance,
                status: 'success'
              });
            }
          } else {
            domainResults.failed++;
            domainResults.errors.push({
              domain_id: domain.id,
              domain_name: domain.domain,
              store_slug: store.slug,
              error: chargeResult.message,
              domain_deactivated: chargeResult.domain_deactivated || false
            });
          }
        } catch (domainError) {
          domainResults.failed++;
          domainResults.errors.push({
            domain_id: domain.id,
            domain_name: domain.domain,
            error: domainError.message
          });
        }
      }

      if (results.failed > 0 && results.successful === 0 && domainResults.successful === 0) {
        throw new Error(`All charges failed: ${results.failed} stores + ${domainResults.failed} domains`);
      }

      return {
        success: true,
        message: `Completed: ${results.successful}/${results.processed} stores, ${domainResults.successful}/${domainResults.processed} domains`,
        stores: results,
        custom_domains: domainResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get job type identifier
   */
  static getJobType() {
    return 'system:daily_credit_deduction';
  }

  /**
   * Get job description for logging
   */
  getDescription() {
    return 'Daily credit deduction for published stores and active custom domains';
  }

  /**
   * Validate job payload (none required for this job)
   */
  validatePayload() {
    // No specific payload validation needed for daily credit deduction
    return true;
  }
}

module.exports = DailyCreditDeductionJob;