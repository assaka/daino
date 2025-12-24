/**
 * HubSpot Service
 *
 * Handles HubSpot API integration for CRM and marketing.
 * https://developers.hubspot.com/docs/api/overview
 */

const axios = require('axios');
const IntegrationConfig = require('../models/IntegrationConfig');

class HubspotService {
  constructor() {
    this.apiUrl = 'https://api.hubapi.com';
    this.integrationType = 'hubspot';
    this.displayName = 'HubSpot';
    this.description = 'Full CRM and marketing automation platform';
  }

  /**
   * Get headers for HubSpot API requests
   */
  getHeaders(accessToken) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Save HubSpot configuration
   */
  async saveConfiguration(storeId, configData) {
    try {
      const { accessToken } = configData;

      if (!accessToken) {
        throw new Error('Access token is required');
      }

      // Validate access token
      const validation = await this.validateAccessToken(accessToken);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid HubSpot access token');
      }

      // Store configuration
      const config = await IntegrationConfig.createOrUpdate(storeId, this.integrationType, {
        accessToken,
        syncEnabled: configData.syncEnabled || false,
        portalId: validation.portalId,
        hubDomain: validation.hubDomain
      });

      if (config && config.id) {
        await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
      }

      return {
        success: true,
        message: 'HubSpot connected successfully',
        accountName: validation.hubDomain || 'HubSpot Account'
      };
    } catch (error) {
      console.error('Save HubSpot configuration error:', error.message);
      throw new Error(`Failed to connect HubSpot: ${error.message}`);
    }
  }

  /**
   * Validate HubSpot access token
   */
  async validateAccessToken(accessToken) {
    try {
      const response = await axios.get(`${this.apiUrl}/account-info/v3/api-usage/daily/private-apps`, {
        headers: this.getHeaders(accessToken)
      });

      // Get account details
      const accountResponse = await axios.get(`${this.apiUrl}/account-info/v3/details`, {
        headers: this.getHeaders(accessToken)
      });

      return {
        valid: true,
        portalId: accountResponse.data?.portalId,
        hubDomain: accountResponse.data?.uiDomain || accountResponse.data?.accountType
      };
    } catch (error) {
      console.error('HubSpot validation error:', error.response?.data || error.message);
      return {
        valid: false,
        error: error.response?.data?.message || 'Invalid access token'
      };
    }
  }

  /**
   * Test connection
   */
  async testConnection(storeId) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.config_data?.accessToken) {
        return { connected: false, error: 'Not configured' };
      }

      const validation = await this.validateAccessToken(config.config_data.accessToken);
      return {
        connected: validation.valid,
        accountName: validation.hubDomain,
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
      return { success: true, message: 'HubSpot disconnected successfully' };
    } catch (error) {
      throw new Error(`Failed to disconnect HubSpot: ${error.message}`);
    }
  }

  /**
   * Sync a single contact to HubSpot
   */
  async syncContact(storeId, customer) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { synced: false, reason: 'Integration not active' };
      }

      const accessToken = config.config_data.accessToken;

      // Search for existing contact by email
      const searchResponse = await axios.post(
        `${this.apiUrl}/crm/v3/objects/contacts/search`,
        {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: customer.email
            }]
          }]
        },
        { headers: this.getHeaders(accessToken) }
      );

      const existingContact = searchResponse.data?.results?.[0];

      const contactData = {
        properties: {
          email: customer.email,
          firstname: customer.first_name || '',
          lastname: customer.last_name || '',
          phone: customer.phone || '',
          catalyst_customer_id: customer.id,
          catalyst_store_id: storeId,
          catalyst_total_orders: String(customer.total_orders || 0),
          catalyst_total_spent: String(customer.total_spent || 0)
        }
      };

      let contactId;
      if (existingContact) {
        // Update existing contact
        await axios.patch(
          `${this.apiUrl}/crm/v3/objects/contacts/${existingContact.id}`,
          contactData,
          { headers: this.getHeaders(accessToken) }
        );
        contactId = existingContact.id;
      } else {
        // Create new contact
        const createResponse = await axios.post(
          `${this.apiUrl}/crm/v3/objects/contacts`,
          contactData,
          { headers: this.getHeaders(accessToken) }
        );
        contactId = createResponse.data?.id;
      }

      return { synced: true, contactId };
    } catch (error) {
      console.error('HubSpot sync contact error:', error.response?.data || error.message);
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
   * Track event in HubSpot
   */
  async trackEvent(storeId, email, eventName, properties) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { tracked: false, reason: 'Integration not active' };
      }

      const accessToken = config.config_data.accessToken;

      // HubSpot custom events require custom behavioral event setup
      // For now, we'll add a note to the contact timeline
      const searchResponse = await axios.post(
        `${this.apiUrl}/crm/v3/objects/contacts/search`,
        {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }]
          }]
        },
        { headers: this.getHeaders(accessToken) }
      );

      const contact = searchResponse.data?.results?.[0];
      if (contact) {
        // Create engagement (note) for the contact
        await axios.post(
          `${this.apiUrl}/crm/v3/objects/notes`,
          {
            properties: {
              hs_timestamp: new Date().toISOString(),
              hs_note_body: `Event: ${eventName}\nProperties: ${JSON.stringify(properties)}`
            },
            associations: [{
              to: { id: contact.id },
              types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }]
            }]
          },
          { headers: this.getHeaders(accessToken) }
        );
      }

      return { tracked: true };
    } catch (error) {
      console.error('HubSpot track event error:', error.response?.data || error.message);
      return { tracked: false, error: error.message };
    }
  }

  /**
   * Track purchase in HubSpot (create deal)
   */
  async trackPurchase(storeId, order) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.is_active) {
        return { tracked: false, reason: 'Integration not active' };
      }

      const accessToken = config.config_data.accessToken;

      // Find contact
      const searchResponse = await axios.post(
        `${this.apiUrl}/crm/v3/objects/contacts/search`,
        {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: order.customer_email
            }]
          }]
        },
        { headers: this.getHeaders(accessToken) }
      );

      const contact = searchResponse.data?.results?.[0];

      // Create deal
      const dealData = {
        properties: {
          dealname: `Order #${order.id}`,
          amount: order.total_amount,
          dealstage: 'closedwon',
          closedate: new Date().toISOString(),
          catalyst_order_id: order.id
        }
      };

      if (contact) {
        dealData.associations = [{
          to: { id: contact.id },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
        }];
      }

      await axios.post(
        `${this.apiUrl}/crm/v3/objects/deals`,
        dealData,
        { headers: this.getHeaders(accessToken) }
      );

      return { tracked: true };
    } catch (error) {
      console.error('HubSpot track purchase error:', error.response?.data || error.message);
      return { tracked: false, error: error.message };
    }
  }

  /**
   * Get deal pipelines from HubSpot
   */
  async getPipelines(storeId) {
    try {
      const config = await IntegrationConfig.findByType(storeId, this.integrationType);
      if (!config || !config.config_data?.accessToken) {
        return [];
      }

      const response = await axios.get(
        `${this.apiUrl}/crm/v3/pipelines/deals`,
        { headers: this.getHeaders(config.config_data.accessToken) }
      );

      return response.data?.results?.map(pipeline => ({
        id: pipeline.id,
        label: pipeline.label,
        stages: pipeline.stages?.map(s => ({ id: s.id, label: s.label }))
      })) || [];
    } catch (error) {
      console.error('Error getting HubSpot pipelines:', error.message);
      return [];
    }
  }
}

module.exports = HubspotService;
