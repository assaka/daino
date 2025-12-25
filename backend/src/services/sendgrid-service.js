const axios = require('axios');
const IntegrationConfig = require('../models/IntegrationConfig');

/**
 * SendGrid Service
 * Handles SendGrid API key authentication and configuration
 * Uses Bearer token authentication
 *
 * Configuration stored in integration_configs table with integration_type='sendgrid'
 */
class SendGridService {
  constructor() {
    this.sendgridApiUrl = 'https://api.sendgrid.com/v3';
    this.integrationType = 'sendgrid';
  }

  /**
   * Save SendGrid API key for a store
   * @param {string} storeId - Store ID
   * @param {string} apiKey - SendGrid API key (SG.xxx...)
   * @param {string} senderName - Sender name
   * @param {string} senderEmail - Sender email
   * @returns {Promise<Object>} Configuration
   */
  async saveConfiguration(storeId, apiKey, senderName, senderEmail) {
    try {
      // Validate API key by testing it
      const validation = await this.validateApiKey(apiKey);

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid SendGrid API key');
      }

      // Before saving, unset is_primary on other email providers
      await IntegrationConfig.unsetPrimaryForTypes(storeId, ['brevo']);

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
        message: 'SendGrid API key saved successfully',
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
      console.error('Save SendGrid configuration error:', error.message);
      throw new Error(`Failed to save SendGrid configuration: ${error.message}`);
    }
  }

  /**
   * Validate SendGrid API key
   * @param {string} apiKey - SendGrid API key
   * @returns {Promise<Object>} Validation result
   */
  async validateApiKey(apiKey) {
    try {
      console.log('Validating SendGrid API key...');
      console.log('API key format:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');

      const response = await axios.get(`${this.sendgridApiUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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

      // Check for common SendGrid errors
      if (error.response?.status === 401) {
        return {
          valid: false,
          error: 'Invalid API key or authentication failed. Please check your SendGrid API key.'
        };
      }

      if (error.response?.status === 403) {
        return {
          valid: false,
          error: 'API key does not have permission to access user profile. Please ensure the key has "Full Access" or appropriate permissions.'
        };
      }

      return {
        valid: false,
        error: error.response?.data?.errors?.[0]?.message || error.message || 'Invalid API key or authentication failed'
      };
    }
  }

  /**
   * Get sender information from SendGrid
   * @param {string} apiKey - SendGrid API key
   * @returns {Promise<Object>} Sender information
   */
  async getSenderInfo(apiKey) {
    try {
      const response = await axios.get(`${this.sendgridApiUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        email: response.data.email || 'noreply@example.com',
        name: response.data.first_name && response.data.last_name
          ? `${response.data.first_name} ${response.data.last_name}`
          : response.data.company || 'Store Owner'
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
      throw new Error('SendGrid not configured for this store');
    }

    return config.config_data.apiKey;
  }

  /**
   * Disconnect SendGrid from store
   * @param {string} storeId - Store ID
   * @returns {Promise<boolean>} Success status
   */
  async disconnect(storeId) {
    try {
      await IntegrationConfig.deactivate(storeId, this.integrationType);
      return true;
    } catch (error) {
      console.error('Disconnect error:', error.message);
      throw new Error('Failed to disconnect SendGrid');
    }
  }

  /**
   * Test SendGrid connection by sending a test API request
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Test result
   */
  async testConnection(storeId) {
    try {
      const apiKey = await this.getValidApiKey(storeId);

      // Test by fetching user profile
      const response = await axios.get(`${this.sendgridApiUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
        message: 'SendGrid connection is active',
        account: {
          email: response.data.email,
          company: response.data.company,
          firstName: response.data.first_name,
          lastName: response.data.last_name
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
        message: 'SendGrid connection failed',
        error: error.response?.data?.errors?.[0]?.message || error.message
      };
    }
  }

  /**
   * Check if SendGrid is configured for a store
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

module.exports = new SendGridService();
