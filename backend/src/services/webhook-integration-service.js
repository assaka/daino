/**
 * Webhook Integration Service
 *
 * Unified service for managing webhook-based workflow automation integrations:
 * - n8n (self-hosted workflow automation)
 * - Zapier (no-code automation)
 * - Make/Integromat (visual workflow builder)
 *
 * All providers use webhook URLs to receive events.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const IntegrationConfig = require('../models/IntegrationConfig');
const ConnectionManager = require('./database/ConnectionManager');

// Supported providers
const PROVIDERS = {
  N8N: 'n8n',
  ZAPIER: 'zapier',
  MAKE: 'make'
};

// Supported event types
const EVENT_TYPES = [
  { id: 'page_view', name: 'Page View', category: 'Analytics', description: 'Triggered when a page is viewed' },
  { id: 'product_view', name: 'Product View', category: 'Analytics', description: 'Triggered when a product is viewed' },
  { id: 'add_to_cart', name: 'Add to Cart', category: 'Cart', description: 'Triggered when a product is added to cart' },
  { id: 'remove_from_cart', name: 'Remove from Cart', category: 'Cart', description: 'Triggered when a product is removed from cart' },
  { id: 'view_cart', name: 'View Cart', category: 'Cart', description: 'Triggered when the cart page is viewed' },
  { id: 'checkout_started', name: 'Checkout Started', category: 'Checkout', description: 'Triggered when checkout begins' },
  { id: 'order_placed', name: 'Order Placed', category: 'Orders', description: 'Triggered when an order is placed' },
  { id: 'order_shipped', name: 'Order Shipped', category: 'Orders', description: 'Triggered when an order is shipped' },
  { id: 'order_delivered', name: 'Order Delivered', category: 'Orders', description: 'Triggered when an order is delivered' },
  { id: 'customer_created', name: 'Customer Created', category: 'Customers', description: 'Triggered when a new customer registers' },
  { id: 'abandoned_cart', name: 'Abandoned Cart', category: 'Cart', description: 'Triggered when a cart is abandoned' },
  { id: 'search', name: 'Search', category: 'Analytics', description: 'Triggered when a search is performed' },
  { id: 'wishlist_add', name: 'Add to Wishlist', category: 'Wishlist', description: 'Triggered when a product is added to wishlist' },
  { id: 'newsletter_signup', name: 'Newsletter Signup', category: 'Marketing', description: 'Triggered when someone signs up for newsletter' }
];

class WebhookIntegrationService {

  /**
   * Get all supported providers
   */
  static getProviders() {
    return [
      { id: PROVIDERS.N8N, name: 'n8n', description: 'Self-hosted workflow automation', icon: 'Workflow' },
      { id: PROVIDERS.ZAPIER, name: 'Zapier', description: 'No-code automation platform', icon: 'Zap' },
      { id: PROVIDERS.MAKE, name: 'Make', description: 'Visual workflow builder (Integromat)', icon: 'GitBranch' }
    ];
  }

  /**
   * Get all supported event types
   */
  static getEventTypes() {
    return EVENT_TYPES;
  }

  /**
   * Get all webhook configurations for a store and provider
   */
  static async getWebhooks(storeId, provider) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const { data, error } = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('store_id', storeId)
        .eq('integration_type', provider)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Decrypt and format webhooks
      return (data || []).map(config => ({
        id: config.id,
        provider: config.integration_type,
        configKey: config.config_key,
        displayName: config.display_name,
        webhookUrl: this._maskWebhookUrl(IntegrationConfig.decryptSensitiveData(config.config_data, provider)?.webhookUrl),
        eventTypes: config.config_data?.eventTypes || [],
        isGlobal: config.config_data?.isGlobal || false,
        isActive: config.is_active,
        connectionStatus: config.connection_status,
        connectionTestedAt: config.connection_tested_at,
        lastSyncAt: config.last_sync_at,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }));
    } catch (error) {
      console.error(`[WEBHOOK-INTEGRATION] Error getting webhooks for ${provider}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a single webhook configuration by ID
   */
  static async getWebhookById(storeId, webhookId) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const { data, error } = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('id', webhookId)
        .eq('store_id', storeId)
        .single();

      if (error || !data) {
        return null;
      }

      // Decrypt config data
      const decryptedConfig = IntegrationConfig.decryptSensitiveData(data.config_data, data.integration_type);

      return {
        ...data,
        config_data: decryptedConfig
      };
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error getting webhook by ID:', error.message);
      throw error;
    }
  }

  /**
   * Create a new webhook configuration
   */
  static async createWebhook(storeId, provider, config) {
    try {
      // Validate provider
      if (!Object.values(PROVIDERS).includes(provider)) {
        throw new Error(`Invalid provider: ${provider}. Supported: ${Object.values(PROVIDERS).join(', ')}`);
      }

      // Validate webhook URL
      if (!config.webhookUrl) {
        throw new Error('Webhook URL is required');
      }

      // Validate event types (if not global)
      if (!config.isGlobal && (!config.eventTypes || config.eventTypes.length === 0)) {
        throw new Error('At least one event type is required for non-global webhooks');
      }

      // Generate config key based on event types or global
      const configKey = config.isGlobal
        ? 'webhook_global'
        : `webhook_${config.eventTypes.sort().join('_')}`;

      const configData = {
        webhookUrl: config.webhookUrl,
        eventTypes: config.isGlobal ? [] : (config.eventTypes || []),
        isGlobal: config.isGlobal || false,
        isActive: true,
        customHeaders: config.customHeaders || {},
        includeCustomerData: config.includeCustomerData !== false,
        includeOrderItems: config.includeOrderItems !== false,
        retryOnFailure: config.retryOnFailure !== false,
        // Provider-specific fields
        ...(provider === PROVIDERS.ZAPIER && config.zapId && { zapId: config.zapId }),
        ...(provider === PROVIDERS.MAKE && config.scenarioId && { scenarioId: config.scenarioId })
      };

      const result = await IntegrationConfig.createOrUpdateWithKey(
        storeId,
        provider,
        configData,
        configKey,
        { displayName: config.displayName || `${provider} Webhook` }
      );

      console.log(`[WEBHOOK-INTEGRATION] Created ${provider} webhook for store ${storeId}`);

      return {
        id: result.id,
        provider,
        configKey: result.config_key,
        displayName: result.display_name,
        webhookUrl: this._maskWebhookUrl(config.webhookUrl),
        eventTypes: configData.eventTypes,
        isGlobal: configData.isGlobal,
        isActive: true,
        createdAt: result.created_at
      };
    } catch (error) {
      console.error(`[WEBHOOK-INTEGRATION] Error creating ${provider} webhook:`, error.message);
      throw error;
    }
  }

  /**
   * Update an existing webhook configuration
   */
  static async updateWebhook(storeId, webhookId, config) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get existing config
      const existing = await this.getWebhookById(storeId, webhookId);
      if (!existing) {
        throw new Error('Webhook configuration not found');
      }

      const provider = existing.integration_type;
      const existingData = existing.config_data || {};

      // Merge with existing data
      const configData = {
        ...existingData,
        ...(config.webhookUrl && { webhookUrl: config.webhookUrl }),
        ...(config.eventTypes && { eventTypes: config.eventTypes }),
        ...(config.isGlobal !== undefined && { isGlobal: config.isGlobal }),
        ...(config.customHeaders && { customHeaders: config.customHeaders }),
        ...(config.includeCustomerData !== undefined && { includeCustomerData: config.includeCustomerData }),
        ...(config.includeOrderItems !== undefined && { includeOrderItems: config.includeOrderItems }),
        ...(config.retryOnFailure !== undefined && { retryOnFailure: config.retryOnFailure }),
        ...(config.isActive !== undefined && { isActive: config.isActive })
      };

      // Encrypt sensitive data
      const encryptedData = IntegrationConfig.encryptSensitiveData(configData, provider);

      const { data, error } = await tenantDb
        .from('integration_configs')
        .update({
          config_data: encryptedData,
          display_name: config.displayName || existing.display_name,
          is_active: config.isActive !== undefined ? config.isActive : existing.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', webhookId)
        .eq('store_id', storeId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`[WEBHOOK-INTEGRATION] Updated webhook ${webhookId}`);

      return {
        id: data.id,
        provider,
        displayName: data.display_name,
        webhookUrl: this._maskWebhookUrl(configData.webhookUrl),
        eventTypes: configData.eventTypes,
        isGlobal: configData.isGlobal,
        isActive: data.is_active,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error updating webhook:', error.message);
      throw error;
    }
  }

  /**
   * Delete a webhook configuration
   */
  static async deleteWebhook(storeId, webhookId) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const { error } = await tenantDb
        .from('integration_configs')
        .delete()
        .eq('id', webhookId)
        .eq('store_id', storeId);

      if (error) {
        throw error;
      }

      console.log(`[WEBHOOK-INTEGRATION] Deleted webhook ${webhookId}`);
      return { success: true };
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error deleting webhook:', error.message);
      throw error;
    }
  }

  /**
   * Test a webhook connection
   */
  static async testWebhook(storeId, webhookId) {
    try {
      const config = await this.getWebhookById(storeId, webhookId);
      if (!config) {
        throw new Error('Webhook configuration not found');
      }

      const webhookUrl = config.config_data?.webhookUrl;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }

      const testPayload = {
        event: 'test',
        provider: config.integration_type,
        timestamp: new Date().toISOString(),
        store_id: storeId,
        event_id: `test_${uuidv4()}`,
        test: true,
        message: 'This is a test webhook from your store',
        data: {
          test_id: uuidv4(),
          test_timestamp: new Date().toISOString()
        }
      };

      const startTime = Date.now();

      try {
        const response = await axios.post(webhookUrl, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DainoStore-Webhook/1.0',
            ...(config.config_data?.customHeaders || {})
          },
          timeout: 10000 // 10 second timeout
        });

        const duration = Date.now() - startTime;

        // Update connection status
        await IntegrationConfig.updateConnectionStatus(webhookId, storeId, 'success', null);

        console.log(`[WEBHOOK-INTEGRATION] Test webhook successful for ${webhookId} (${duration}ms)`);

        return {
          success: true,
          statusCode: response.status,
          duration,
          message: 'Webhook test successful'
        };
      } catch (axiosError) {
        const duration = Date.now() - startTime;
        const errorMessage = axiosError.response
          ? `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
          : axiosError.message;

        // Update connection status
        await IntegrationConfig.updateConnectionStatus(webhookId, storeId, 'failed', errorMessage);

        console.log(`[WEBHOOK-INTEGRATION] Test webhook failed for ${webhookId}: ${errorMessage}`);

        return {
          success: false,
          statusCode: axiosError.response?.status || null,
          duration,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error testing webhook:', error.message);
      throw error;
    }
  }

  /**
   * Send webhook to a specific configuration
   */
  static async sendWebhook(webhookConfig, payload, options = {}) {
    const webhookUrl = webhookConfig.config_data?.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const provider = webhookConfig.integration_type;
    const customHeaders = webhookConfig.config_data?.customHeaders || {};

    // Format payload with standard structure
    const formattedPayload = {
      event: payload.event,
      provider,
      timestamp: payload.timestamp || new Date().toISOString(),
      store_id: payload.store_id,
      store_name: payload.store_name || null,
      event_id: payload.event_id || `evt_${uuidv4()}`,
      correlation_id: payload.correlation_id || null,
      data: payload.data || {}
    };

    try {
      const response = await axios.post(webhookUrl, formattedPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DainoStore-Webhook/1.0',
          'X-Webhook-Event': payload.event,
          'X-Webhook-Provider': provider,
          ...customHeaders
        },
        timeout: options.timeout || 30000 // 30 second default timeout
      });

      return {
        success: true,
        statusCode: response.status,
        responseBody: response.data
      };
    } catch (error) {
      const errorMessage = error.response
        ? `HTTP ${error.response.status}: ${error.response.statusText}`
        : error.message;

      return {
        success: false,
        statusCode: error.response?.status || null,
        error: errorMessage,
        responseBody: error.response?.data
      };
    }
  }

  /**
   * Get webhooks that should receive a specific event type
   */
  static async getWebhooksForEvent(storeId, eventType) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get all active webhook configs for all providers
      const { data, error } = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('store_id', storeId)
        .in('integration_type', Object.values(PROVIDERS))
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      // Filter webhooks that match this event type
      const matchingWebhooks = (data || []).filter(config => {
        const configData = IntegrationConfig.decryptSensitiveData(config.config_data, config.integration_type);

        // Global webhooks receive all events
        if (configData.isGlobal) {
          return true;
        }

        // Check if event type is in the webhook's event types
        return (configData.eventTypes || []).includes(eventType);
      }).map(config => ({
        ...config,
        config_data: IntegrationConfig.decryptSensitiveData(config.config_data, config.integration_type)
      }));

      return matchingWebhooks;
    } catch (error) {
      console.error(`[WEBHOOK-INTEGRATION] Error getting webhooks for event ${eventType}:`, error.message);
      throw error;
    }
  }

  /**
   * Log webhook delivery
   */
  static async logDelivery(storeId, webhookId, provider, eventType, payload, result) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const logEntry = {
        id: uuidv4(),
        store_id: storeId,
        provider,
        webhook_config_id: webhookId,
        event_type: eventType,
        event_id: payload.event_id || null,
        payload: payload,
        response_status: result.statusCode,
        response_body: typeof result.responseBody === 'string'
          ? result.responseBody
          : JSON.stringify(result.responseBody || null),
        delivery_status: result.success ? 'sent' : 'failed',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        error_message: result.error || null,
        created_at: new Date().toISOString()
      };

      const { error } = await tenantDb
        .from('webhook_integration_logs')
        .insert(logEntry);

      if (error) {
        console.error('[WEBHOOK-INTEGRATION] Error logging delivery:', error.message);
      }

      return logEntry;
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error logging delivery:', error.message);
      // Don't throw - logging failure shouldn't stop the webhook process
    }
  }

  /**
   * Get delivery logs for a webhook
   */
  static async getDeliveryLogs(storeId, webhookId, options = {}) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const limit = options.limit || 50;
      const offset = options.offset || 0;

      let query = tenantDb
        .from('webhook_integration_logs')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId)
        .eq('webhook_config_id', webhookId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (options.status) {
        query = query.eq('delivery_status', options.status);
      }
      if (options.eventType) {
        query = query.eq('event_type', options.eventType);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        logs: data || [],
        total: count || 0,
        limit,
        offset
      };
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error getting delivery logs:', error.message);
      throw error;
    }
  }

  /**
   * Get delivery statistics for a webhook
   */
  static async getDeliveryStats(storeId, webhookId, days = 7) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await tenantDb
        .from('webhook_integration_logs')
        .select('delivery_status, created_at')
        .eq('store_id', storeId)
        .eq('webhook_config_id', webhookId)
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        sent: 0,
        failed: 0,
        retrying: 0,
        pending: 0
      };

      (data || []).forEach(log => {
        if (stats[log.delivery_status] !== undefined) {
          stats[log.delivery_status]++;
        }
      });

      stats.successRate = stats.total > 0
        ? Math.round((stats.sent / stats.total) * 100)
        : 0;

      return stats;
    } catch (error) {
      console.error('[WEBHOOK-INTEGRATION] Error getting delivery stats:', error.message);
      throw error;
    }
  }

  /**
   * Mask webhook URL for display (hide sensitive parts)
   */
  static _maskWebhookUrl(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      // Mask the path except first and last 4 chars
      const path = urlObj.pathname;
      if (path.length > 12) {
        const masked = path.slice(0, 4) + '****' + path.slice(-4);
        return `${urlObj.origin}${masked}`;
      }
      return `${urlObj.origin}${path}`;
    } catch {
      // If URL parsing fails, return partially masked string
      if (url.length > 20) {
        return url.slice(0, 10) + '****' + url.slice(-6);
      }
      return url;
    }
  }
}

// Export providers constant for external use
WebhookIntegrationService.PROVIDERS = PROVIDERS;
WebhookIntegrationService.EVENT_TYPES = EVENT_TYPES;

module.exports = WebhookIntegrationService;
