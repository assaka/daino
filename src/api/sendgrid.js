import apiClient from './client';

/**
 * SendGrid API Helper
 * Handles SendGrid email service configuration
 */

class SendGridAPI {
  /**
   * Save SendGrid API key configuration
   * @param {string} storeId - Store ID
   * @param {string} apiKey - SendGrid API key (SG.xxx...)
   * @param {string} senderName - Sender name
   * @param {string} senderEmail - Sender email
   * @returns {Promise<Object>} Configuration result
   */
  async saveConfiguration(storeId, apiKey, senderName, senderEmail) {
    try {
      const response = await apiClient.post('sendgrid/configure', {
        store_id: storeId,
        apiKey: apiKey,
        senderName: senderName,
        senderEmail: senderEmail
      });
      return response;
    } catch (error) {
      console.error('SendGrid configure error:', error);
      throw error;
    }
  }

  /**
   * Get SendGrid connection status for a store
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Connection status
   */
  async getConnectionStatus(storeId) {
    try {
      const response = await apiClient.get(`sendgrid/status?store_id=${storeId}`);
      return response;
    } catch (error) {
      console.error('SendGrid status check error:', error);
      throw error;
    }
  }

  /**
   * Disconnect SendGrid from store
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Disconnect result
   */
  async disconnect(storeId) {
    try {
      const response = await apiClient.post('sendgrid/disconnect', {
        store_id: storeId
      });
      return response;
    } catch (error) {
      console.error('SendGrid disconnect error:', error);
      throw error;
    }
  }

  /**
   * Test SendGrid connection
   * @param {string} storeId - Store ID
   * @param {string} testEmail - Email address to send test to
   * @returns {Promise<Object>} Test result
   */
  async testConnection(storeId, testEmail) {
    try {
      const response = await apiClient.post('sendgrid/test-connection', {
        store_id: storeId,
        testEmail: testEmail
      });
      return response;
    } catch (error) {
      console.error('SendGrid test connection error:', error);
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
      const response = await apiClient.get(`sendgrid/email-statistics?store_id=${storeId}&days=${days}`);
      return response;
    } catch (error) {
      console.error('Get email statistics error:', error);
      throw error;
    }
  }
}

export default new SendGridAPI();
