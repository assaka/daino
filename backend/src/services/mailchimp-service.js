/**
 * Mailchimp Service
 *
 * Handles Mailchimp API integration for email marketing.
 * https://mailchimp.com/developer/marketing/api/
 */

const axios = require('axios');
const crypto = require('crypto');
const IntegrationConfig = require('../models/IntegrationConfig');

class MailchimpService {
  constructor() {
    this.integrationType = 'mailchimp';
    this.displayName = 'Mailchimp';
    this.description = 'All-in-one marketing platform with email campaigns';
  }

  /**
   * Get API URL based on datacenter in API key
   */
  getApiUrl(apiKey) {
    const dc = apiKey.split('-').pop();
    return `https://${dc}.api.mailchimp.com/3.0`;
  }

  /**
   * Get headers for Mailchimp API requests
   */
  getHeaders(apiKey) {
    const encoded = Buffer.from(`anystring:${apiKey}`).toString('base64');
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get subscriber hash (MD5 of lowercase email)
   */
  getSubscriberHash(email) {
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  }

  /**
   * Save Mailchimp configuration
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
        throw new Error(validation.error || 'Invalid Mailchimp API key');
      }

      // Store configuration
      const config = await IntegrationConfig.createOrUpdate(storeId, this.integrationType, {
        apiKey,
        listId,
        syncEnabled: configData.syncEnabled || false,
        accountId: validation.accountId,
        accountName: validation.accountName
      });

      if (config && config.id) {
        await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
      }

      return {
        success: true,
        message: 'Mailchimp connected successfully',
        accountName: validation.accountName
      };
    } catch (error) {
      console.error('Save Mailchimp configuration error:', error.message);
      throw new Error(`Failed to connect Mailchimp: ${error.message}`);
    }
  }

  /**
   * Validate Mailchimp API key
   */
  async validateApiKey(apiKey) {
    try {
      const apiUrl = this.getApiUrl(apiKey);
      const response = await axios.get(`${apiUrl}/`, {
        headers: this.getHeaders(apiKey)
      });

      return {
        valid: true,
        accountId: response.data?.account_id,
        accountName: response.data?.account_name || 'Mailchimp Account'
      };
    } catch (error) {
      console.error('Mailchimp validation error:', error.response?.data || error.message);
      return {
        valid: false,
        error: error.response?.data?.detail || 'Invalid API key'
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
      return { success: true, message: 'Mailchimp disconnected successfully' };
    } catch (error) {
      throw new Error(`Failed to disconnect Mailchimp: ${error.message}`);
    }
  }

  /**
   * Sync a single contact to Mailchimp
   */
  async syncContact(storeId, customer) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { synced: false, reason: 'Integration not active' };
      }

      const apiKey = config.config_data.apiKey;
      const listId = config.config_data.listId;

      if (!listId) {
        return { synced: false, reason: 'No audience/list configured' };
      }

      const apiUrl = this.getApiUrl(apiKey);
      const subscriberHash = this.getSubscriberHash(customer.email);

      const memberData = {
        email_address: customer.email,
        status_if_new: 'subscribed',
        merge_fields: {
          FNAME: customer.first_name || '',
          LNAME: customer.last_name || '',
          PHONE: customer.phone || ''
        },
        tags: ['catalyst-sync']
      };

      await axios.put(
        `${apiUrl}/lists/${listId}/members/${subscriberHash}`,
        memberData,
        { headers: this.getHeaders(apiKey) }
      );

      return { synced: true, subscriberHash };
    } catch (error) {
      console.error('Mailchimp sync contact error:', error.response?.data || error.message);
      return { synced: false, error: error.message };
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
   * Track event in Mailchimp (via tags or automation triggers)
   */
  async trackEvent(storeId, email, eventName, properties) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { tracked: false, reason: 'Integration not active' };
      }

      const apiKey = config.config_data.apiKey;
      const listId = config.config_data.listId;

      if (!listId) {
        return { tracked: false, reason: 'No audience/list configured' };
      }

      const apiUrl = this.getApiUrl(apiKey);
      const subscriberHash = this.getSubscriberHash(email);

      // Mailchimp uses event tracking via automations API
      // Add event as a tag for simpler tracking
      const tagName = eventName.replace(/\s+/g, '-').toLowerCase();

      await axios.post(
        `${apiUrl}/lists/${listId}/members/${subscriberHash}/tags`,
        {
          tags: [{ name: tagName, status: 'active' }]
        },
        { headers: this.getHeaders(apiKey) }
      );

      return { tracked: true };
    } catch (error) {
      console.error('Mailchimp track event error:', error.response?.data || error.message);
      return { tracked: false, error: error.message };
    }
  }

  /**
   * Track purchase in Mailchimp
   */
  async trackPurchase(storeId, order) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { tracked: false, reason: 'Integration not active' };
      }

      const apiKey = config.config_data.apiKey;
      const apiUrl = this.getApiUrl(apiKey);

      // Mailchimp e-commerce tracking requires store setup
      // For now, add purchase tag to member
      const listId = config.config_data.listId;
      if (listId && order.customer_email) {
        const subscriberHash = this.getSubscriberHash(order.customer_email);
        await axios.post(
          `${apiUrl}/lists/${listId}/members/${subscriberHash}/tags`,
          {
            tags: [
              { name: 'purchased', status: 'active' },
              { name: `order-${new Date().toISOString().split('T')[0]}`, status: 'active' }
            ]
          },
          { headers: this.getHeaders(apiKey) }
        );
      }

      return { tracked: true };
    } catch (error) {
      console.error('Mailchimp track purchase error:', error.response?.data || error.message);
      return { tracked: false, error: error.message };
    }
  }

  /**
   * Get audiences/lists from Mailchimp
   */
  async getLists(storeId) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.config_data?.apiKey) {
        return [];
      }

      const apiKey = config.config_data.apiKey;
      const apiUrl = this.getApiUrl(apiKey);

      const response = await axios.get(`${apiUrl}/lists`, {
        headers: this.getHeaders(apiKey)
      });

      return response.data?.lists?.map(list => ({
        id: list.id,
        name: list.name,
        memberCount: list.stats?.member_count
      })) || [];
    } catch (error) {
      console.error('Error getting Mailchimp lists:', error.message);
      return [];
    }
  }
}

module.exports = MailchimpService;
