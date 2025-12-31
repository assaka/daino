/**
 * Webhook Integration Event Handler
 *
 * Processes events from the unified event bus and routes them to
 * configured webhook integrations (n8n, Zapier, Make).
 *
 * Events are queued via BackgroundJobManager for reliable delivery.
 */

const eventBus = require('../EventBus');

class WebhookIntegrationHandler {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize and register event handlers
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    this.registerHandlers();
    this.isInitialized = true;
  }

  /**
   * Register event handlers with EventBus
   */
  registerHandlers() {
    // Subscribe to customer activity events (page_view, product_view, add_to_cart, etc.)
    eventBus.subscribe(
      'customer_activity',
      this.handleCustomerActivity.bind(this),
      {
        name: 'WebhookIntegrationHandler-CustomerActivity',
        batchHandler: false, // Process individually for reliability
        priority: 5 // Lower than CustomerActivityHandler (10) to ensure DB write first
      }
    );

    // Subscribe to order events
    eventBus.subscribe(
      'order_placed',
      this.handleOrderPlaced.bind(this),
      {
        name: 'WebhookIntegrationHandler-OrderPlaced',
        batchHandler: false,
        priority: 5
      }
    );

    // Subscribe to customer registration events
    eventBus.subscribe(
      'customer_created',
      this.handleCustomerCreated.bind(this),
      {
        name: 'WebhookIntegrationHandler-CustomerCreated',
        batchHandler: false,
        priority: 5
      }
    );

    // Subscribe to checkout events
    eventBus.subscribe(
      'checkout_started',
      this.handleCheckoutStarted.bind(this),
      {
        name: 'WebhookIntegrationHandler-CheckoutStarted',
        batchHandler: false,
        priority: 5
      }
    );

    // Subscribe to abandoned cart events
    eventBus.subscribe(
      'abandoned_cart',
      this.handleAbandonedCart.bind(this),
      {
        name: 'WebhookIntegrationHandler-AbandonedCart',
        batchHandler: false,
        priority: 5
      }
    );

    // Subscribe to order status events
    eventBus.subscribe(
      ['order_shipped', 'order_delivered'],
      this.handleOrderStatus.bind(this),
      {
        name: 'WebhookIntegrationHandler-OrderStatus',
        batchHandler: false,
        priority: 5
      }
    );

    console.log('[WEBHOOK-INTEGRATION] Handler registered for all event types');
  }

  /**
   * Handle customer activity events (page_view, product_view, add_to_cart, etc.)
   */
  async handleCustomerActivity(event) {
    try {
      const storeId = event.data.store_id;
      if (!storeId) {
        return;
      }

      // Map activity_type to standard event type
      const eventType = event.data.activity_type;

      // Queue webhook job
      await this.queueWebhookJob(storeId, eventType, {
        event: eventType,
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        store_id: storeId,
        event_id: event.id,
        correlation_id: event.metadata?.correlationId,
        data: {
          session_id: event.data.session_id,
          user_id: event.data.user_id,
          page_url: event.data.page_url,
          referrer: event.data.referrer,
          product_id: event.data.product_id,
          search_query: event.data.search_query,
          metadata: event.data.metadata
        }
      });
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error handling customer activity:', error.message);
    }
  }

  /**
   * Handle order placed events
   */
  async handleOrderPlaced(event) {
    try {
      const storeId = event.data.store_id;
      if (!storeId) {
        return;
      }

      await this.queueWebhookJob(storeId, 'order_placed', {
        event: 'order_placed',
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        store_id: storeId,
        event_id: event.id,
        correlation_id: event.metadata?.correlationId,
        data: {
          order_id: event.data.order_id,
          order_number: event.data.order_number,
          customer_id: event.data.customer_id,
          customer_email: event.data.customer_email,
          total_amount: event.data.total_amount,
          currency: event.data.currency,
          payment_method: event.data.payment_method,
          items: event.data.items,
          shipping_address: event.data.shipping_address,
          billing_address: event.data.billing_address,
          metadata: event.data.metadata
        }
      });

      console.log(`[WEBHOOK-INTEGRATION] Queued order_placed webhook for order ${event.data.order_id}`);
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error handling order placed:', error.message);
    }
  }

  /**
   * Handle customer created events
   */
  async handleCustomerCreated(event) {
    try {
      const storeId = event.data.store_id;
      if (!storeId) {
        return;
      }

      await this.queueWebhookJob(storeId, 'customer_created', {
        event: 'customer_created',
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        store_id: storeId,
        event_id: event.id,
        correlation_id: event.metadata?.correlationId,
        data: {
          customer_id: event.data.customer_id,
          email: event.data.email,
          first_name: event.data.first_name,
          last_name: event.data.last_name,
          phone: event.data.phone,
          created_at: event.data.created_at,
          metadata: event.data.metadata
        }
      });

      console.log(`[WEBHOOK-INTEGRATION] Queued customer_created webhook for customer ${event.data.customer_id}`);
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error handling customer created:', error.message);
    }
  }

  /**
   * Handle checkout started events
   */
  async handleCheckoutStarted(event) {
    try {
      const storeId = event.data.store_id;
      if (!storeId) {
        return;
      }

      await this.queueWebhookJob(storeId, 'checkout_started', {
        event: 'checkout_started',
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        store_id: storeId,
        event_id: event.id,
        correlation_id: event.metadata?.correlationId,
        data: {
          session_id: event.data.session_id,
          customer_id: event.data.customer_id,
          cart_value: event.data.cart_value,
          items: event.data.items,
          metadata: event.data.metadata
        }
      });
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error handling checkout started:', error.message);
    }
  }

  /**
   * Handle abandoned cart events
   */
  async handleAbandonedCart(event) {
    try {
      const storeId = event.data.store_id;
      if (!storeId) {
        return;
      }

      await this.queueWebhookJob(storeId, 'abandoned_cart', {
        event: 'abandoned_cart',
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        store_id: storeId,
        event_id: event.id,
        correlation_id: event.metadata?.correlationId,
        data: {
          session_id: event.data.session_id,
          customer_id: event.data.customer_id,
          customer_email: event.data.customer_email,
          cart_value: event.data.cart_value,
          items: event.data.items,
          abandoned_at: event.data.abandoned_at,
          metadata: event.data.metadata
        }
      });

      console.log(`[WEBHOOK-INTEGRATION] Queued abandoned_cart webhook`);
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error handling abandoned cart:', error.message);
    }
  }

  /**
   * Handle order status events (shipped, delivered)
   */
  async handleOrderStatus(event) {
    try {
      const storeId = event.data.store_id;
      if (!storeId) {
        return;
      }

      const eventType = event.type; // order_shipped or order_delivered

      await this.queueWebhookJob(storeId, eventType, {
        event: eventType,
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        store_id: storeId,
        event_id: event.id,
        correlation_id: event.metadata?.correlationId,
        data: {
          order_id: event.data.order_id,
          order_number: event.data.order_number,
          customer_id: event.data.customer_id,
          customer_email: event.data.customer_email,
          tracking_number: event.data.tracking_number,
          carrier: event.data.carrier,
          status: event.data.status,
          metadata: event.data.metadata
        }
      });

      console.log(`[WEBHOOK-INTEGRATION] Queued ${eventType} webhook for order ${event.data.order_id}`);
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error handling order status:', error.message);
    }
  }

  /**
   * Queue a webhook job via BackgroundJobManager
   */
  async queueWebhookJob(storeId, eventType, payload) {
    try {
      // Lazy load to avoid circular dependencies
      const BackgroundJobManager = require('../../../core/BackgroundJobManager');

      await BackgroundJobManager.scheduleJob({
        type: 'webhook:send',
        payload: {
          eventType,
          eventData: payload,
          storeId
        },
        priority: 'normal',
        storeId
      });
    } catch (error) {
      // If job manager isn't available, log and continue
      // This allows the system to work even if BullMQ/Redis isn't configured
      console.warn('[WEBHOOK-INTEGRATION] Could not queue webhook job:', error.message);

      // Fallback: Try to send webhooks directly (synchronously)
      await this.sendWebhooksDirectly(storeId, eventType, payload);
    }
  }

  /**
   * Fallback: Send webhooks directly without job queue
   */
  async sendWebhooksDirectly(storeId, eventType, payload) {
    try {
      const WebhookIntegrationService = require('../../webhook-integration-service');

      const webhooks = await WebhookIntegrationService.getWebhooksForEvent(storeId, eventType);

      for (const webhook of webhooks) {
        try {
          const result = await WebhookIntegrationService.sendWebhook(webhook, payload);

          // Log the delivery
          await WebhookIntegrationService.logDelivery(
            storeId,
            webhook.id,
            webhook.integration_type,
            eventType,
            payload,
            result
          );
        } catch (webhookError) {
          console.error(`[WEBHOOK-INTEGRATION] Error sending webhook to ${webhook.integration_type}:`, webhookError.message);
        }
      }
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error in direct webhook send:', error.message);
    }
  }
}

// Create singleton instance and auto-initialize
const handler = new WebhookIntegrationHandler();
handler.initialize();

// Export instance and class
module.exports = handler;
module.exports.WebhookIntegrationHandler = WebhookIntegrationHandler;
