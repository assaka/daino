/**
 * Marketing Integrations Routes
 *
 * API endpoints for managing marketing platform integrations (Klaviyo, Mailchimp, HubSpot).
 */

const express = require('express');
const router = express.Router();
const { storeOwnerOnly } = require('../middleware/auth');
const marketingIntegrationService = require('../services/marketing-integration-service');

/**
 * GET /api/marketing-integrations
 * Get all marketing integrations for a store
 */
router.get('/', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const integrations = await marketingIntegrationService.getIntegrations(store_id);

    res.json({ integrations });
  } catch (error) {
    console.error('Error getting marketing integrations:', error);
    res.status(500).json({ error: 'Failed to get integrations' });
  }
});

/**
 * POST /api/marketing-integrations/:provider/connect
 * Connect a marketing integration
 */
router.post('/:provider/connect', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;
    const configData = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const result = await marketingIntegrationService.saveConfiguration(store_id, provider, configData);

    res.json(result);
  } catch (error) {
    console.error(`Error connecting ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to connect integration' });
  }
});

/**
 * POST /api/marketing-integrations/:provider/test
 * Test a marketing integration connection
 */
router.post('/:provider/test', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const result = await marketingIntegrationService.testConnection(store_id, provider);

    res.json(result);
  } catch (error) {
    console.error(`Error testing ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to test connection' });
  }
});

/**
 * POST /api/marketing-integrations/:provider/disconnect
 * Disconnect a marketing integration
 */
router.post('/:provider/disconnect', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const result = await marketingIntegrationService.disconnect(store_id, provider);

    res.json(result);
  } catch (error) {
    console.error(`Error disconnecting ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
});

/**
 * POST /api/marketing-integrations/:provider/sync-contact
 * Sync a single contact to a provider
 */
router.post('/:provider/sync-contact', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;
    const { customer } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!customer || !customer.email) {
      return res.status(400).json({ error: 'customer with email is required' });
    }

    const result = await marketingIntegrationService.syncContact(store_id, provider, customer);

    res.json(result);
  } catch (error) {
    console.error(`Error syncing contact to ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to sync contact' });
  }
});

/**
 * POST /api/marketing-integrations/:provider/track-event
 * Track an event in a provider
 */
router.post('/:provider/track-event', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;
    const { email, eventName, properties } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!email || !eventName) {
      return res.status(400).json({ error: 'email and eventName are required' });
    }

    const result = await marketingIntegrationService.trackEvent(
      store_id, provider, email, eventName, properties || {}
    );

    res.json(result);
  } catch (error) {
    console.error(`Error tracking event in ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to track event' });
  }
});

/**
 * POST /api/marketing-integrations/:provider/track-purchase
 * Track a purchase in a provider
 */
router.post('/:provider/track-purchase', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;
    const { order } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!order) {
      return res.status(400).json({ error: 'order is required' });
    }

    const result = await marketingIntegrationService.trackPurchase(store_id, provider, order);

    res.json(result);
  } catch (error) {
    console.error(`Error tracking purchase in ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to track purchase' });
  }
});

/**
 * GET /api/marketing-integrations/:provider/lists
 * Get lists/audiences from a provider
 */
router.get('/:provider/lists', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { provider } = req.params;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const providerInstance = marketingIntegrationService.getProvider(provider);
    const lists = await providerInstance.getLists(store_id);

    res.json({ lists });
  } catch (error) {
    console.error(`Error getting lists from ${req.params.provider}:`, error);
    res.status(500).json({ error: error.message || 'Failed to get lists' });
  }
});

/**
 * GET /api/marketing-integrations/sync-status
 * Get sync status for all integrations
 */
router.get('/sync-status', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const status = await marketingIntegrationService.getSyncStatus(store_id);

    res.json({ status });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * POST /api/marketing-integrations/sync-all
 * Sync contacts to all active integrations
 */
router.post('/sync-all', storeOwnerOnly, async (req, res) => {
  try {
    const { store_id } = req.query;
    const { customers } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({ error: 'customers array is required' });
    }

    const results = await marketingIntegrationService.syncContactsToAll(store_id, customers);

    res.json({ results });
  } catch (error) {
    console.error('Error syncing to all integrations:', error);
    res.status(500).json({ error: 'Failed to sync contacts' });
  }
});

module.exports = router;
