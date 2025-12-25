import apiClient from './client';

/**
 * Brevo API Helper
 * Handles Brevo OAuth and email service configuration
 */

class BrevoAPI {
  /**
   * Save Brevo API key configuration
   * @param {string} storeId - Store ID
   * @param {string} apiKey - Brevo API key (xkeysib-...)
   * @param {string} senderName - Sender name
   * @param {string} senderEmail - Sender email
   * @returns {Promise<Object>} Configuration result
   */
  async saveConfiguration(storeId, apiKey, senderName, senderEmail) {
    try {
      const response = await apiClient.post('brevo/configure', {
        store_id: storeId,
        api_key: apiKey,
        sender_name: senderName,
        sender_email: senderEmail
      });
      return response;
    } catch (error) {
      console.error('Brevo configure error:', error);
      throw error;
    }
  }

  /**
   * Get Brevo connection status for a store
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Connection status
   */
  async getConnectionStatus(storeId) {
    try {
      const response = await apiClient.get(`brevo/status?store_id=${storeId}`);
      return response;
    } catch (error) {
      console.error('Brevo status check error:', error);
      throw error;
    }
  }

  /**
   * Disconnect Brevo from store
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Disconnect result
   */
  async disconnect(storeId) {
    try {
      const response = await apiClient.post('brevo/disconnect', {
        store_id: storeId
      });
      return response;
    } catch (error) {
      console.error('Brevo disconnect error:', error);
      throw error;
    }
  }

  /**
   * Test Brevo connection
   * @param {string} storeId - Store ID
   * @param {string} testEmail - Email address to send test to
   * @returns {Promise<Object>} Test result
   */
  async testConnection(storeId, testEmail) {
    try {
      const response = await apiClient.post('brevo/test-connection', {
        store_id: storeId,
        test_email: testEmail
      });
      return response;
    } catch (error) {
      console.error('Brevo test connection error:', error);
      throw error;
    }
  }

  /**
   * Get email sending statistics
   * @param {string} storeId - Store ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Email statistics
   */
  async getEmailStatistics(storeId, days = 30) {
    try {
      const response = await apiClient.get(`brevo/email-statistics?store_id=${storeId}&days=${days}`);
      return response;
    } catch (error) {
      console.error('Get email statistics error:', error);
      throw error;
    }
  }

  /**
   * Set Brevo as the primary email provider
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Result
   */
  async setPrimary(storeId) {
    try {
      const response = await apiClient.post('brevo/set-primary', {
        store_id: storeId
      });
      return response;
    } catch (error) {
      console.error('Brevo set-primary error:', error);
      throw error;
    }
  }
}

export default new BrevoAPI();
