const axios = require('axios');
const IntegrationConfig = require('../models/IntegrationConfig');

/**
 * Brevo Service
 * Handles Brevo API key authentication and configuration
 * Uses simple API key (xkeysib-...) authentication
 *
 * Configuration stored in integration_configs table with integration_type='brevo'
 */
class BrevoService {
  constructor() {
    this.brevoApiUrl = 'https://api.brevo.com/v3';
    this.integrationType = 'brevo';
  }

  /**
   * Save Brevo API key for a store
   * @param {string} storeId - Store ID
   * @param {string} apiKey - Brevo API key (xkeysib-...)
   * @param {string} senderName - Sender name
   * @param {string} senderEmail - Sender email
   * @returns {Promise<Object>} Configuration
   */
  async saveConfiguration(storeId, apiKey, senderName, senderEmail) {
    try {
      // Validate API key by testing it
      const validation = await this.validateApiKey(apiKey);

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid Brevo API key');
      }

      // Before saving, unset is_primary on other email providers
      await IntegrationConfig.unsetPrimaryForTypes(storeId, ['sendgrid']);

      // Store configuration using IntegrationConfig with is_primary
      const configData = {
        apiKey: apiKey,
        senderName: senderName,
        senderEmail: senderEmail
      };

      const config = await IntegrationConfig.createOrUpdateWithKey(
        storeId,
        this.integrationType,
        configData,
        'default',
        { isPrimary: true }
      );

      // Update connection status to success
      if (config && config.id) {
        await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
      }

      return {
        success: true,
        message: 'Brevo API key saved successfully',
        config: {
          id: config.id,
          senderName: config.config_data.senderName,
          senderEmail: config.config_data.senderEmail,
          isActive: config.is_active,
          isPrimary: config.is_primary,
          createdAt: config.created_at,
          updatedAt: config.updated_at
        }
      };
    } catch (error) {
      console.error('Save Brevo configuration error:', error.message);
      throw new Error(`Failed to save Brevo configuration: ${error.message}`);
    }
  }

  /**
   * Validate Brevo API key
   * @param {string} apiKey - Brevo API key
   * @returns {Promise<boolean>} Validation result
   */
  async validateApiKey(apiKey) {
    try {
      console.log('Validating Brevo API key...');
      console.log('API key format:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');

      const response = await axios.get(`${this.brevoApiUrl}/account`, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('Validation successful, status:', response.status);
      return { valid: true };
    } catch (error) {
      console.error('API key validation error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      // Check for IP whitelist error
      if (error.response?.status === 401 && error.response?.data?.code === 'unauthorized') {
        const errorMessage = error.response.data.message;
        if (errorMessage.includes('unrecognised IP address')) {
          // Extract IP address from error message
          const ipMatch = errorMessage.match(/IP address (\d+\.\d+\.\d+\.\d+)/);
          const ipAddress = ipMatch ? ipMatch[1] : 'your server IP';

          return {
            valid: false,
            error: `IP address not whitelisted: ${ipAddress}. Please add this IP to your authorized IPs at https://app.brevo.com/security/authorised_ips`
          };
        }
      }

      return {
        valid: false,
        error: error.response?.data?.message || 'Invalid API key or authentication failed'
      };
    }
  }

  /**
   * Get sender information from Brevo
   * @param {string} apiKey - Brevo API key
   * @returns {Promise<Object>} Sender information
   */
  async getSenderInfo(apiKey) {
    try {
      const response = await axios.get(`${this.brevoApiUrl}/account`, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      return {
        email: response.data.email,
        name: response.data.firstName && response.data.lastName
          ? `${response.data.firstName} ${response.data.lastName}`
          : response.data.companyName || 'Store Owner'
      };
    } catch (error) {
      console.error('Error fetching sender info:', error.message);
      return { email: 'noreply@example.com', name: 'Store Owner' };
    }
  }

  /**
   * Get valid API key for a store
   * @param {string} storeId - Store ID
   * @returns {Promise<string>} Valid API key
   */
  async getValidApiKey(storeId) {
    const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

    if (!config || !config.config_data || !config.config_data.apiKey) {
      throw new Error('Brevo not configured for this store');
    }

    return config.config_data.apiKey;
  }

  /**
   * Disconnect Brevo from store
   * @param {string} storeId - Store ID
   * @returns {Promise<boolean>} Success status
   */
  async disconnect(storeId) {
    try {
      await IntegrationConfig.deactivate(storeId, this.integrationType);
      return true;
    } catch (error) {
      console.error('Disconnect error:', error.message);
      throw new Error('Failed to disconnect Brevo');
    }
  }

  /**
   * Test Brevo connection by sending a test API request
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Test result
   */
  async testConnection(storeId) {
    try {
      const apiKey = await this.getValidApiKey(storeId);

      // Test by fetching account info
      const response = await axios.get(`${this.brevoApiUrl}/account`, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      // Update connection status
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
      if (config && config.id) {
        await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
      }

      return {
        success: true,
        message: 'Brevo connection is active',
        account: {
          email: response.data.email,
          companyName: response.data.companyName,
          plan: response.data.plan?.type || 'free'
        }
      };
    } catch (error) {
      console.error('Connection test error:', error.response?.data || error.message);

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
        message: 'Brevo connection failed',
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Check if Brevo is configured for a store
   * @param {string} storeId - Store ID
   * @returns {Promise<boolean>} Configuration status
   */
  async isConfigured(storeId) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
      return !!config && !!config.config_data && !!config.config_data.apiKey;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get configuration for a store
   * @param {string} storeId - Store ID
   * @returns {Promise<Object|null>} Configuration object
   */
  async getConfiguration(storeId) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

      if (!config) {
        return null;
      }

      return {
        id: config.id,
        senderName: config.config_data?.senderName,
        senderEmail: config.config_data?.senderEmail,
        isActive: config.is_active,
        isPrimary: config.is_primary,
        connectionStatus: config.connection_status,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      };
    } catch (error) {
      console.error('Get configuration error:', error.message);
      return null;
    }
  }
}

module.exports = new BrevoService();
