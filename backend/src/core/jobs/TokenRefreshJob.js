const BaseJobHandler = require('./BaseJobHandler');
const IntegrationToken = require('../../models/master/IntegrationToken');

/**
 * Background job handler for refreshing OAuth tokens across all stores.
 *
 * This job runs hourly and:
 * 1. Queries the master DB for tokens expiring within the next hour
 * 2. Refreshes each token using the appropriate integration service
 * 3. Updates the master DB record with new expiry times
 * 4. Handles failures gracefully with retry tracking
 */
class TokenRefreshJob extends BaseJobHandler {
  async execute() {
    this.log('Starting token refresh job');

    const payload = this.getPayload();
    const {
      bufferMinutes = 60,  // Refresh tokens expiring within 60 minutes
      batchSize = 10       // Process 10 tokens at a time
    } = payload;

    const results = {
      total: 0,
      refreshed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      await this.updateProgress(5, 'Finding tokens that need refresh...');

      // Find tokens expiring soon
      const expiringTokens = await IntegrationToken.findExpiringTokens(bufferMinutes);
      results.total = expiringTokens.length;

      if (expiringTokens.length === 0) {
        this.log('No tokens need refresh');
        await this.updateProgress(100, 'No tokens need refresh');
        return {
          success: true,
          message: 'No tokens need refresh',
          results
        };
      }

      this.log(`Found ${expiringTokens.length} tokens to refresh`);
      await this.updateProgress(10, `Found ${expiringTokens.length} tokens to refresh`);

      // Process tokens in batches
      let processed = 0;
      for (let i = 0; i < expiringTokens.length; i += batchSize) {
        this.checkAbort();

        const batch = expiringTokens.slice(i, i + batchSize);

        // Process batch concurrently
        const batchResults = await Promise.allSettled(
          batch.map(token => this.refreshToken(token))
        );

        // Count results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.refreshed) {
              results.refreshed++;
            } else {
              results.skipped++;
            }
          } else {
            results.failed++;
            results.errors.push({
              storeId: batch[batchResults.indexOf(result)]?.store_id,
              integrationType: batch[batchResults.indexOf(result)]?.integration_type,
              error: result.reason?.message || 'Unknown error'
            });
          }
        }

        processed += batch.length;
        const progressPercent = 10 + Math.floor((processed / results.total) * 85);
        await this.updateProgress(progressPercent, `Processed ${processed}/${results.total} tokens`);
      }

      await this.updateProgress(100, 'Token refresh completed');

      const summary = `Refreshed ${results.refreshed}/${results.total} tokens (${results.failed} failed, ${results.skipped} skipped)`;
      this.log(summary);

      return {
        success: true,
        message: summary,
        results
      };

    } catch (error) {
      this.log(`Token refresh job failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Refresh a single token
   * @param {Object} tokenRecord - IntegrationToken record from master DB
   * @returns {Promise<Object>} - Result of refresh attempt
   */
  async refreshToken(tokenRecord) {
    const { store_id, integration_type, config_key } = tokenRecord;

    try {
      // Get the appropriate service for this integration type
      const service = await this.getIntegrationService(integration_type);

      if (!service) {
        this.log(`No refresh service available for ${integration_type}`, 'warn');
        return { refreshed: false, reason: 'No service available' };
      }

      // Attempt to refresh the token
      this.log(`Refreshing ${integration_type} token for store ${store_id}`);
      const refreshResult = await service.refreshAccessToken(store_id);

      if (refreshResult.success) {
        // Calculate new expiry (typically 1 hour for OAuth tokens)
        const newExpiresAt = refreshResult.expires_at ||
          new Date(Date.now() + (refreshResult.expires_in || 3600) * 1000);

        // Update master DB record
        await IntegrationToken.recordRefreshSuccess(
          store_id,
          integration_type,
          newExpiresAt,
          config_key
        );

        this.log(`Successfully refreshed ${integration_type} token for store ${store_id}`);
        return { refreshed: true, newExpiresAt };
      } else {
        throw new Error(refreshResult.error || 'Refresh returned unsuccessful');
      }

    } catch (error) {
      this.log(`Failed to refresh ${integration_type} token for store ${store_id}: ${error.message}`, 'error');

      // Record failure in master DB
      await IntegrationToken.recordRefreshFailure(
        store_id,
        integration_type,
        error.message,
        config_key
      );

      // Check if this looks like a revoked token
      if (this.isRevokedError(error)) {
        await IntegrationToken.markAsRevoked(store_id, integration_type, config_key);
        this.log(`Marked ${integration_type} token for store ${store_id} as revoked`);
      }

      throw error;
    }
  }

  /**
   * Get the integration service for a given integration type
   * @param {string} integrationType - Type of integration
   * @returns {Object|null} - Service instance or null if not supported
   */
  async getIntegrationService(integrationType) {
    // Map integration types to their services
    const serviceMap = {
      'supabase-oauth': () => require('../../services/supabase-integration'),
      'supabase': () => require('../../services/supabase-integration'),
      'cloudflare': () => require('../../services/cloudflare-oauth-service')
    };

    const getService = serviceMap[integrationType];
    if (!getService) {
      return null;
    }

    try {
      return getService();
    } catch (error) {
      this.log(`Failed to load service for ${integrationType}: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Check if an error indicates a revoked token
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isRevokedError(error) {
    const revokedIndicators = [
      'invalid_grant',
      'revoked',
      'unauthorized_client',
      'access_denied',
      'Token has been revoked'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    return revokedIndicators.some(indicator =>
      errorMessage.includes(indicator.toLowerCase()) ||
      errorCode.includes(indicator.toLowerCase())
    );
  }
}

module.exports = TokenRefreshJob;
