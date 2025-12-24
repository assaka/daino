/**
 * Marketing Integration Service
 *
 * Abstraction layer for marketing platform integrations (Klaviyo, Mailchimp, HubSpot).
 * Provides a unified interface for common marketing operations.
 */

const IntegrationConfig = require('../models/IntegrationConfig');
const KlaviyoService = require('./klaviyo-service');
const MailchimpService = require('./mailchimp-service');
const HubspotService = require('./hubspot-service');

class MarketingIntegrationService {
  constructor() {
    this.providers = {
      klaviyo: new KlaviyoService(),
      mailchimp: new MailchimpService(),
      hubspot: new HubspotService()
    };
  }

  /**
   * Get provider instance
   * @param {string} provider - Provider name (klaviyo, mailchimp, hubspot)
   */
  getProvider(provider) {
    const providerInstance = this.providers[provider?.toLowerCase()];
    if (!providerInstance) {
      throw new Error(`Unknown marketing provider: ${provider}`);
    }
    return providerInstance;
  }

  /**
   * Get all configured integrations for a store
   * @param {string} storeId - Store ID
   */
  async getIntegrations(storeId) {
    const integrations = [];

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        const config = await IntegrationConfig.findByType(storeId, name);
        integrations.push({
          provider: name,
          displayName: provider.displayName,
          description: provider.description,
          isConnected: !!config && config.is_active,
          config: config ? {
            id: config.id,
            isActive: config.is_active,
            connectionStatus: config.connection_status,
            lastSyncAt: config.last_sync_at,
            createdAt: config.created_at
          } : null
        });
      } catch (error) {
        console.error(`Error getting ${name} config:`, error);
        integrations.push({
          provider: name,
          displayName: provider.displayName,
          description: provider.description,
          isConnected: false,
          config: null
        });
      }
    }

    return integrations;
  }

  /**
   * Save integration configuration
   * @param {string} storeId - Store ID
   * @param {string} provider - Provider name
   * @param {Object} configData - Configuration data (API keys, etc.)
   */
  async saveConfiguration(storeId, provider, configData) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.saveConfiguration(storeId, configData);
  }

  /**
   * Test connection
   * @param {string} storeId - Store ID
   * @param {string} provider - Provider name
   */
  async testConnection(storeId, provider) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.testConnection(storeId);
  }

  /**
   * Disconnect integration
   * @param {string} storeId - Store ID
   * @param {string} provider - Provider name
   */
  async disconnect(storeId, provider) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.disconnect(storeId);
  }

  /**
   * Sync contact to marketing platform
   * @param {string} storeId - Store ID
   * @param {string} provider - Provider name
   * @param {Object} customer - Customer data
   */
  async syncContact(storeId, provider, customer) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.syncContact(storeId, customer);
  }

  /**
   * Track event in marketing platform
   * @param {string} storeId - Store ID
   * @param {string} provider - Provider name
   * @param {string} email - Customer email
   * @param {string} eventName - Event name
   * @param {Object} properties - Event properties
   */
  async trackEvent(storeId, provider, email, eventName, properties) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.trackEvent(storeId, email, eventName, properties);
  }

  /**
   * Track purchase in marketing platform
   * @param {string} storeId - Store ID
   * @param {string} provider - Provider name
   * @param {Object} order - Order data
   */
  async trackPurchase(storeId, provider, order) {
    const providerInstance = this.getProvider(provider);
    return providerInstance.trackPurchase(storeId, order);
  }

  /**
   * Sync contacts to all active integrations
   * @param {string} storeId - Store ID
   * @param {Array} customers - Array of customer data
   */
  async syncContactsToAll(storeId, customers) {
    const results = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        const config = await IntegrationConfig.findByType(storeId, name);
        if (config && config.is_active) {
          const syncResults = await provider.syncContacts(storeId, customers);
          results[name] = { success: true, ...syncResults };
        }
      } catch (error) {
        console.error(`Error syncing to ${name}:`, error);
        results[name] = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Get sync status for all integrations
   * @param {string} storeId - Store ID
   */
  async getSyncStatus(storeId) {
    const statuses = {};

    for (const [name] of Object.entries(this.providers)) {
      try {
        const config = await IntegrationConfig.findByType(storeId, name);
        if (config) {
          statuses[name] = {
            isActive: config.is_active,
            lastSyncAt: config.last_sync_at,
            connectionStatus: config.connection_status,
            syncEnabled: config.config_data?.syncEnabled || false
          };
        }
      } catch (error) {
        console.error(`Error getting ${name} status:`, error);
      }
    }

    return statuses;
  }
}

module.exports = new MarketingIntegrationService();
