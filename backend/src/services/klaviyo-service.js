/**
 * Klaviyo Service
 *
 * Handles Klaviyo API integration for email marketing.
 * https://developers.klaviyo.com/en/reference/api-overview
 */

const axios = require('axios');
const IntegrationConfig = require('../models/IntegrationConfig');

class KlaviyoService {
  constructor() {
    this.apiUrl = 'https://a.klaviyo.com/api';
    this.integrationType = 'klaviyo';
    this.displayName = 'Klaviyo';
    this.description = 'Email marketing automation with powerful segmentation';
  }

  /**
   * Get headers for Klaviyo API requests
   */
  getHeaders(apiKey) {
    return {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'revision': '2024-02-15'
    };
  }

  /**
   * Save Klaviyo configuration
   */
  async saveConfiguration(storeId, configData) {
    try {
      const { apiKey, listId } = configData;

      if (!apiKey) {
        throw new Error('API key is required');
      }

      // Validate API key
      const validation = await this.validateApiKey(apiKey);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid Klaviyo API key');
      }

      // Store configuration
      const config = await IntegrationConfig.createOrUpdate(storeId, this.integrationType, {
        apiKey,
        listId,
        syncEnabled: configData.syncEnabled || false,
        accountId: validation.accountId
      });

      if (config && config.id) {
        await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
      }

      return {
        success: true,
        message: 'Klaviyo connected successfully',
        accountName: validation.accountName
      };
    } catch (error) {
      console.error('Save Klaviyo configuration error:', error.message);
      throw new Error(`Failed to connect Klaviyo: ${error.message}`);
    }
  }

  /**
   * Validate Klaviyo API key
   */
  async validateApiKey(apiKey) {
    try {
      const response = await axios.get(`${this.apiUrl}/accounts/`, {
        headers: this.getHeaders(apiKey)
      });

      const account = response.data?.data?.[0];
      return {
        valid: true,
        accountId: account?.id,
        accountName: account?.attributes?.contact_information?.organization_name || 'Klaviyo Account'
      };
    } catch (error) {
      console.error('Klaviyo validation error:', error.response?.data || error.message);
      return {
        valid: false,
        error: error.response?.data?.errors?.[0]?.detail || 'Invalid API key'
      };
    }
  }

  /**
   * Test connection
   */
  async testConnection(storeId) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.config_data?.apiKey) {
        return { connected: false, error: 'Not configured' };
      }

      const validation = await this.validateApiKey(config.config_data.apiKey);
      return {
        connected: validation.valid,
        accountName: validation.accountName,
        error: validation.error
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Disconnect integration
   */
  async disconnect(storeId) {
    try {
      await IntegrationConfig.delete(storeId, this.integrationType);
      return { success: true, message: 'Klaviyo disconnected successfully' };
    } catch (error) {
      throw new Error(`Failed to disconnect Klaviyo: ${error.message}`);
    }
  }

  /**
   * Sync a single contact to Klaviyo
   */
  async syncContact(storeId, customer) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { synced: false, reason: 'Integration not active' };
      }

      const apiKey = config.config_data.apiKey;
      const listId = config.config_data.listId;

      // Create or update profile
      const profileData = {
        data: {
          type: 'profile',
          attributes: {
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone_number: customer.phone,
            properties: {
              store_id: storeId,
              customer_id: customer.id,
              total_orders: customer.total_orders || 0,
              total_spent: customer.total_spent || 0
            }
          }
        }
      };

      const response = await axios.post(`${this.apiUrl}/profiles/`, profileData, {
        headers: this.getHeaders(apiKey)
      });

      const profileId = response.data?.data?.id;

      // Add to list if listId is configured
      if (listId && profileId) {
        await this.addProfileToList(apiKey, listId, profileId);
      }

      return { synced: true, profileId };
    } catch (error) {
      console.error('Klaviyo sync contact error:', error.response?.data || error.message);
      return { synced: false, error: error.message };
    }
  }

  /**
   * Add profile to a list
   */
  async addProfileToList(apiKey, listId, profileId) {
    try {
      await axios.post(`${this.apiUrl}/lists/${listId}/relationships/profiles/`, {
        data: [{ type: 'profile', id: profileId }]
      }, {
        headers: this.getHeaders(apiKey)
      });
    } catch (error) {
      console.error('Error adding profile to list:', error.response?.data || error.message);
    }
  }

  /**
   * Sync multiple contacts
   */
  async syncContacts(storeId, customers) {
    let synced = 0;
    let failed = 0;

    for (const customer of customers) {
      const result = await this.syncContact(storeId, customer);
      if (result.synced) {
        synced++;
      } else {
        failed++;
      }
    }

    // Update last sync time
    const config = await IntegrationConfig.findByType(storeId, this.integrationType);
    if (config) {
      await IntegrationConfig.updateLastSync(config.id, storeId);
    }

    return { synced, failed, total: customers.length };
  }

  /**
   * Track event in Klaviyo
   */
  async trackEvent(storeId, email, eventName, properties) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { tracked: false, reason: 'Integration not active' };
      }

      const apiKey = config.config_data.apiKey;

      const eventData = {
        data: {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: { name: eventName }
              }
            },
            profile: {
              data: {
                type: 'profile',
                attributes: { email }
              }
            },
            properties: {
              ...properties,
              store_id: storeId
            },
            time: new Date().toISOString()
          }
        }
      };

      await axios.post(`${this.apiUrl}/events/`, eventData, {
        headers: this.getHeaders(apiKey)
      });

      return { tracked: true };
    } catch (error) {
      console.error('Klaviyo track event error:', error.response?.data || error.message);
      return { tracked: false, error: error.message };
    }
  }

  /**
   * Track purchase in Klaviyo
   */
  async trackPurchase(storeId, order) {
    const properties = {
      order_id: order.id,
      value: order.total_amount,
      currency: order.currency || 'EUR',
      items: order.items?.map(item => ({
        product_id: item.product_id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })) || []
    };

    return this.trackEvent(storeId, order.customer_email, 'Placed Order', properties);
  }

  /**
   * Get lists from Klaviyo
   */
  async getLists(storeId) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.config_data?.apiKey) {
        return [];
      }

      const response = await axios.get(`${this.apiUrl}/lists/`, {
        headers: this.getHeaders(config.config_data.apiKey)
      });

      return response.data?.data?.map(list => ({
        id: list.id,
        name: list.attributes.name,
        created: list.attributes.created
      })) || [];
    } catch (error) {
      console.error('Error getting Klaviyo lists:', error.message);
      return [];
    }
  }
}

module.exports = KlaviyoService;
