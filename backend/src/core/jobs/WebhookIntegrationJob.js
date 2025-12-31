/**
 * Webhook Integration Job
 *
 * Background job for sending webhooks to workflow automation platforms
 * (n8n, Zapier, Make). Handles retries and delivery logging.
 */

const BaseJobHandler = require('./BaseJobHandler');

class WebhookIntegrationJob extends BaseJobHandler {
  constructor(job) {
    super(job);
  }

  /**
   * Execute the webhook send job
   */
  async execute() {
    const payload = this.getPayload();
    const { eventType, eventData, storeId } = payload;

    if (!storeId) {
      throw new Error('storeId is required');
    }

    if (!eventType) {
      throw new Error('eventType is required');
    }

    this.log(`Processing webhook job for event: ${eventType}`);

    // Lazy load to avoid circular dependencies
    const WebhookIntegrationService = require('../../services/webhook-integration-service');

    try {
      // Get all webhooks configured for this event type
      const webhooks = await WebhookIntegrationService.getWebhooksForEvent(storeId, eventType);

      if (!webhooks || webhooks.length === 0) {
        this.log(`No webhooks configured for event: ${eventType}`);
        return {
          success: true,
          webhooksSent: 0,
          message: 'No webhooks configured for this event'
        };
      }

      this.log(`Found ${webhooks.length} webhook(s) for event: ${eventType}`);

      let successCount = 0;
      let failureCount = 0;
      const results = [];

      // Process each webhook
      for (let i = 0; i < webhooks.length; i++) {
        const webhook = webhooks[i];

        await this.checkAbort(); // Check for cancellation

        try {
          this.log(`Sending to ${webhook.integration_type} webhook (${i + 1}/${webhooks.length})`);

          // Send webhook with retry logic
          const result = await this.retryOperation(
            async () => WebhookIntegrationService.sendWebhook(webhook, eventData),
            webhook.config_data?.retryOnFailure !== false ? 3 : 1, // 3 retries if enabled
            1000 // 1 second base delay
          );

          // Log the delivery
          await WebhookIntegrationService.logDelivery(
            storeId,
            webhook.id,
            webhook.integration_type,
            eventType,
            eventData,
            result
          );

          if (result.success) {
            successCount++;
            this.log(`Successfully sent to ${webhook.integration_type} (HTTP ${result.statusCode})`);
          } else {
            failureCount++;
            this.log(`Failed to send to ${webhook.integration_type}: ${result.error}`, 'warn');
          }

          results.push({
            webhookId: webhook.id,
            provider: webhook.integration_type,
            success: result.success,
            statusCode: result.statusCode,
            error: result.error
          });
        } catch (webhookError) {
          failureCount++;

          // Log failed delivery
          await WebhookIntegrationService.logDelivery(
            storeId,
            webhook.id,
            webhook.integration_type,
            eventType,
            eventData,
            {
              success: false,
              error: webhookError.message
            }
          );

          this.log(`Error sending to ${webhook.integration_type}: ${webhookError.message}`, 'error');

          results.push({
            webhookId: webhook.id,
            provider: webhook.integration_type,
            success: false,
            error: webhookError.message
          });
        }

        // Update progress
        const progress = Math.round(((i + 1) / webhooks.length) * 100);
        await this.updateProgress(progress, `Processed ${i + 1}/${webhooks.length} webhooks`);
      }

      const summary = {
        success: true,
        webhooksSent: successCount,
        webhooksFailed: failureCount,
        total: webhooks.length,
        eventType,
        results
      };

      this.log(`Webhook job completed: ${successCount} sent, ${failureCount} failed`);

      return summary;
    } catch (error) {
      this.log(`Webhook job failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

module.exports = WebhookIntegrationJob;
