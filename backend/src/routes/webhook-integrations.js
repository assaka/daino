/**
 * Webhook Integrations Routes
 *
 * API endpoints for managing webhook-based workflow automation integrations:
 * - n8n (self-hosted workflow automation)
 * - Zapier (no-code automation)
 * - Make/Integromat (visual workflow builder)
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { storeOwnerOnly } = require('../middleware/auth');
const WebhookIntegrationService = require('../services/webhook-integration-service');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Valid provider types
const validProviders = ['n8n', 'zapier', 'make'];

/**
 * GET /api/webhook-integrations/providers
 * Get all available webhook integration providers
 */
router.get('/providers', storeOwnerOnly, async (req, res) => {
  try {
    const providers = WebhookIntegrationService.getProviders();
    res.json({ success: true, providers });
  } catch (error) {
    console.error('Error getting providers:', error);
    res.status(500).json({ success: false, error: 'Failed to get providers' });
  }
});

/**
 * GET /api/webhook-integrations/event-types
 * Get all supported event types
 */
router.get('/event-types', storeOwnerOnly, async (req, res) => {
  try {
    const eventTypes = WebhookIntegrationService.getEventTypes();
    res.json({ success: true, eventTypes });
  } catch (error) {
    console.error('Error getting event types:', error);
    res.status(500).json({ success: false, error: 'Failed to get event types' });
  }
});

/**
 * GET /api/webhook-integrations/auth-types
 * Get all supported authentication types
 */
router.get('/auth-types', storeOwnerOnly, async (req, res) => {
  try {
    const authTypes = WebhookIntegrationService.getAuthTypes();
    res.json({ success: true, authTypes });
  } catch (error) {
    console.error('Error getting auth types:', error);
    res.status(500).json({ success: false, error: 'Failed to get auth types' });
  }
});

/**
 * GET /api/webhook-integrations/:provider/webhooks
 * Get all webhook configurations for a provider
 */
router.get(
  '/:provider/webhooks',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    query('store_id').notEmpty().withMessage('store_id is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { provider } = req.params;
      const { store_id } = req.query;

      const webhooks = await WebhookIntegrationService.getWebhooks(store_id, provider);

      res.json({ success: true, webhooks });
    } catch (error) {
      console.error(`Error getting ${req.params.provider} webhooks:`, error);
      res.status(500).json({ success: false, error: 'Failed to get webhooks' });
    }
  }
);

/**
 * POST /api/webhook-integrations/:provider/webhooks
 * Create a new webhook configuration
 */
router.post(
  '/:provider/webhooks',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    query('store_id').notEmpty().withMessage('store_id is required'),
    body('webhookUrl').isURL().withMessage('Valid webhook URL is required'),
    body('eventTypes').optional().isArray().withMessage('eventTypes must be an array'),
    body('isGlobal').optional().isBoolean().withMessage('isGlobal must be a boolean'),
    body('displayName').optional().isString().withMessage('displayName must be a string')
  ],
  validate,
  async (req, res) => {
    try {
      const { provider } = req.params;
      const { store_id } = req.query;

      const webhook = await WebhookIntegrationService.createWebhook(store_id, provider, req.body);

      res.status(201).json({ success: true, webhook });
    } catch (error) {
      console.error(`Error creating ${req.params.provider} webhook:`, error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create webhook' });
    }
  }
);

/**
 * PUT /api/webhook-integrations/:provider/webhooks/:webhookId
 * Update an existing webhook configuration
 */
router.put(
  '/:provider/webhooks/:webhookId',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    param('webhookId').isUUID().withMessage('Invalid webhook ID'),
    query('store_id').notEmpty().withMessage('store_id is required'),
    body('webhookUrl').optional().isURL().withMessage('Valid webhook URL is required'),
    body('eventTypes').optional().isArray().withMessage('eventTypes must be an array'),
    body('isGlobal').optional().isBoolean().withMessage('isGlobal must be a boolean'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  validate,
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const { store_id } = req.query;

      const webhook = await WebhookIntegrationService.updateWebhook(store_id, webhookId, req.body);

      res.json({ success: true, webhook });
    } catch (error) {
      console.error('Error updating webhook:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update webhook' });
    }
  }
);

/**
 * DELETE /api/webhook-integrations/:provider/webhooks/:webhookId
 * Delete a webhook configuration
 */
router.delete(
  '/:provider/webhooks/:webhookId',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    param('webhookId').isUUID().withMessage('Invalid webhook ID'),
    query('store_id').notEmpty().withMessage('store_id is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const { store_id } = req.query;

      await WebhookIntegrationService.deleteWebhook(store_id, webhookId);

      res.json({ success: true, message: 'Webhook deleted successfully' });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete webhook' });
    }
  }
);

/**
 * POST /api/webhook-integrations/:provider/webhooks/:webhookId/test
 * Test a webhook connection
 */
router.post(
  '/:provider/webhooks/:webhookId/test',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    param('webhookId').isUUID().withMessage('Invalid webhook ID'),
    query('store_id').notEmpty().withMessage('store_id is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const { store_id } = req.query;

      const result = await WebhookIntegrationService.testWebhook(store_id, webhookId);

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error testing webhook:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to test webhook' });
    }
  }
);

/**
 * GET /api/webhook-integrations/:provider/webhooks/:webhookId/logs
 * Get delivery logs for a webhook
 */
router.get(
  '/:provider/webhooks/:webhookId/logs',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    param('webhookId').isUUID().withMessage('Invalid webhook ID'),
    query('store_id').notEmpty().withMessage('store_id is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset must be >= 0'),
    query('status').optional().isIn(['pending', 'sent', 'failed', 'retrying']).withMessage('Invalid status')
  ],
  validate,
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const { store_id, limit, offset, status, eventType } = req.query;

      const result = await WebhookIntegrationService.getDeliveryLogs(store_id, webhookId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        status,
        eventType
      });

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error getting delivery logs:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get logs' });
    }
  }
);

/**
 * GET /api/webhook-integrations/:provider/webhooks/:webhookId/stats
 * Get delivery statistics for a webhook
 */
router.get(
  '/:provider/webhooks/:webhookId/stats',
  storeOwnerOnly,
  [
    param('provider').isIn(validProviders).withMessage('Invalid provider'),
    param('webhookId').isUUID().withMessage('Invalid webhook ID'),
    query('store_id').notEmpty().withMessage('store_id is required'),
    query('days').optional().isInt({ min: 1, max: 90 }).withMessage('days must be 1-90')
  ],
  validate,
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const { store_id, days } = req.query;

      const stats = await WebhookIntegrationService.getDeliveryStats(
        store_id,
        webhookId,
        days ? parseInt(days) : 7
      );

      res.json({ success: true, stats });
    } catch (error) {
      console.error('Error getting delivery stats:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get stats' });
    }
  }
);

/**
 * GET /api/webhook-integrations/all
 * Get all webhook configurations across all providers for a store
 */
router.get(
  '/all',
  storeOwnerOnly,
  [query('store_id').notEmpty().withMessage('store_id is required')],
  validate,
  async (req, res) => {
    try {
      const { store_id } = req.query;

      // Get webhooks for all providers
      const [n8nWebhooks, zapierWebhooks, makeWebhooks] = await Promise.all([
        WebhookIntegrationService.getWebhooks(store_id, 'n8n'),
        WebhookIntegrationService.getWebhooks(store_id, 'zapier'),
        WebhookIntegrationService.getWebhooks(store_id, 'make')
      ]);

      res.json({
        success: true,
        webhooks: {
          n8n: n8nWebhooks,
          zapier: zapierWebhooks,
          make: makeWebhooks
        },
        totals: {
          n8n: n8nWebhooks.length,
          zapier: zapierWebhooks.length,
          make: makeWebhooks.length,
          total: n8nWebhooks.length + zapierWebhooks.length + makeWebhooks.length
        }
      });
    } catch (error) {
      console.error('Error getting all webhooks:', error);
      res.status(500).json({ success: false, error: 'Failed to get webhooks' });
    }
  }
);

module.exports = router;
