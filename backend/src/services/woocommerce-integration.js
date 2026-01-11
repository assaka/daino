const WooCommerceClient = require('./woocommerce-client');
const IntegrationConfig = require('../models/IntegrationConfig');

/**
 * WooCommerce Integration Service
 * Handles WooCommerce REST API authentication and connection management
 *
 * Configuration stored in integration_configs table with integration_type='woocommerce'
 *
 * WooCommerce uses Consumer Key/Secret authentication (not OAuth like Shopify)
 */
class WooCommerceIntegration {
  constructor() {
    this.integrationType = 'woocommerce';
  }

  /**
   * Save WooCommerce credentials for a store
   */
  async saveCredentials(storeId, storeUrl, consumerKey, consumerSecret) {
    try {
      // Normalize store URL (remove trailing slash)
      const normalizedUrl = storeUrl.replace(/\/$/, '');

      // Test the connection first
      const client = new WooCommerceClient(normalizedUrl, consumerKey, consumerSecret);
      const testResult = await client.testConnection();

      if (!testResult.success) {
        return {
          success: false,
          message: testResult.message || 'Failed to connect to WooCommerce',
          error: testResult.message
        };
      }

      // Get store info if possible
      let storeInfo = {};
      try {
        storeInfo = await client.getStoreInfo();
      } catch (infoError) {
        console.warn('Could not fetch store info:', infoError.message);
      }

      // Store configuration
      const configData = {
        store_url: normalizedUrl,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        store_info: storeInfo,
        connected: true,
        connectionType: 'rest_api'
      };

      const config = await IntegrationConfig.createOrUpdateWithKey(
        storeId,
        this.integrationType,
        configData,
        'default',
        {
          displayName: storeInfo.settings?.store_name || normalizedUrl
        }
      );

      // Update connection status
      if (config && config.id) {
        await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
      }

      console.log('WooCommerce connection saved successfully:', {
        storeId,
        storeUrl: normalizedUrl
      });

      return {
        success: true,
        message: 'WooCommerce credentials saved and connection verified',
        data: {
          store_url: normalizedUrl,
          store_info: storeInfo
        }
      };

    } catch (error) {
      console.error('Error saving WooCommerce credentials:', error);
      return {
        success: false,
        message: error.message || 'Failed to save WooCommerce credentials',
        error: error.message
      };
    }
  }

  /**
   * Test connection to WooCommerce store
   */
  async testConnection(storeId) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

      if (!config || !config.config_data) {
        return {
          success: false,
          message: 'No WooCommerce connection found for this store. Please configure your WooCommerce credentials first.'
        };
      }

      const { store_url, consumer_key, consumer_secret } = config.config_data;

      if (!store_url || !consumer_key || !consumer_secret) {
        return {
          success: false,
          message: 'WooCommerce configuration is incomplete. Please check your credentials.'
        };
      }

      const client = new WooCommerceClient(store_url, consumer_key, consumer_secret);
      const testResult = await client.testConnection();

      // Update connection status
      if (config.id) {
        await IntegrationConfig.updateConnectionStatus(
          config.id,
          storeId,
          testResult.success ? 'success' : 'failed',
          testResult.success ? null : testResult.message
        );
      }

      if (testResult.success) {
        return {
          success: true,
          message: 'Successfully connected to WooCommerce',
          data: {
            store_url: store_url,
            ...testResult.data
          }
        };
      } else {
        return {
          success: false,
          message: testResult.message || 'Connection test failed'
        };
      }

    } catch (error) {
      // Update connection status to failed
      try {
        const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
        if (config && config.id) {
          await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'failed', error.message);
        }
      } catch (updateError) {
        // Ignore update errors
      }

      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Get connection status for a store
   */
  async getConnectionStatus(storeId) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

      if (!config || !config.config_data) {
        return {
          connected: false,
          configured: false,
          message: 'No WooCommerce connection configured'
        };
      }

      const { store_url, consumer_key, consumer_secret, connected, store_info } = config.config_data;

      // Check if credentials are configured
      if (!store_url || !consumer_key || !consumer_secret) {
        return {
          connected: false,
          configured: false,
          message: 'WooCommerce credentials not configured'
        };
      }

      // If previously connected, test if still valid
      if (connected) {
        const testResult = await this.testConnection(storeId);

        return {
          connected: testResult.success,
          configured: true,
          store_url: store_url,
          store_name: store_info?.settings?.store_name || store_url,
          connection_status: config.connection_status,
          last_connected: config.updated_at,
          message: testResult.message,
          data: testResult.data
        };
      }

      return {
        connected: false,
        configured: true,
        store_url: store_url,
        message: 'WooCommerce configured but not connected'
      };

    } catch (error) {
      return {
        connected: false,
        configured: false,
        message: `Error checking connection: ${error.message}`
      };
    }
  }

  /**
   * Get token/credentials info for a store
   * Returns format compatible with import service
   */
  async getTokenInfo(storeId) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

      if (!config || !config.config_data) {
        return null;
      }

      const { store_url, consumer_key, consumer_secret, store_info } = config.config_data;

      return {
        id: config.id,
        store_id: storeId,
        store_url: store_url,
        consumer_key: consumer_key,
        consumer_secret: consumer_secret,
        store_info: store_info,
        created_at: config.created_at,
        updated_at: config.updated_at
      };
    } catch (error) {
      console.error('Error getting WooCommerce token info:', error);
      return null;
    }
  }

  /**
   * Get WooCommerce client instance for a store
   */
  async getClient(storeId) {
    const tokenInfo = await this.getTokenInfo(storeId);

    if (!tokenInfo) {
      throw new Error('WooCommerce not configured for this store');
    }

    return new WooCommerceClient(
      tokenInfo.store_url,
      tokenInfo.consumer_key,
      tokenInfo.consumer_secret
    );
  }

  /**
   * Get store URL for API calls
   */
  async getStoreUrl(storeId) {
    const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

    if (!config || !config.config_data || !config.config_data.store_url) {
      throw new Error('WooCommerce not configured for this store');
    }

    return config.config_data.store_url;
  }

  /**
   * Remove WooCommerce connection for a store
   */
  async disconnect(storeId) {
    try {
      await IntegrationConfig.deactivate(storeId, this.integrationType);

      return {
        success: true,
        message: 'WooCommerce connection removed successfully'
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to disconnect: ${error.message}`
      };
    }
  }

  /**
   * Get available data counts from WooCommerce store
   */
  async getDataCounts(storeId) {
    try {
      const client = await this.getClient(storeId);

      // Get counts for various data types
      const [products, categories, tags] = await Promise.all([
        client.getProducts({ per_page: 1 }).catch(() => []),
        client.getCategories({ per_page: 1 }).catch(() => []),
        client.getTags({ per_page: 1 }).catch(() => [])
      ]);

      return {
        success: true,
        counts: {
          products: 'Available',
          categories: 'Available',
          tags: 'Available'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new WooCommerceIntegration();
