const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const brevoService = require('../services/brevo-service');
const emailService = require('../services/email-service');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/brevo/configure
 * Save Brevo API key configuration
 */
router.post('/configure', [
  body('store_id').isUUID().withMessage('Valid store_id is required'),
  body('api_key').notEmpty().withMessage('API key is required'),
  body('sender_name').notEmpty().withMessage('Sender name is required'),
  body('sender_email').isEmail().withMessage('Valid sender email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, api_key, sender_name, sender_email } = req.body;

    // Check store access
    req.params.store_id = store_id;
    await new Promise((resolve, reject) => {
      checkStoreOwnership(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Save configuration
    const result = await brevoService.saveConfiguration(store_id, api_key, sender_name, sender_email);

    res.json({
      success: true,
      message: 'Brevo configured successfully',
      data: result.config
    });
  } catch (error) {
    console.error('Brevo configure error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to configure Brevo'
    });
  }
});

/**
 * POST /api/brevo/disconnect
 * Disconnect Brevo from store
 */
router.post('/disconnect', [
  body('store_id').isUUID().withMessage('Valid store_id is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id } = req.body;

    // Check store access
    req.params.store_id = store_id;
    await new Promise((resolve, reject) => {
      checkStoreOwnership(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await brevoService.disconnect(store_id);

    res.json({
      success: true,
      message: 'Brevo disconnected successfully'
    });
  } catch (error) {
    console.error('Brevo disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Brevo',
      error: error.message
    });
  }
});

/**
 * GET /api/brevo/status
 * Check Brevo connection status for a store
 */
router.get('/status', async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check store access
    req.params.store_id = store_id;
    await new Promise((resolve, reject) => {
      checkStoreOwnership(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const isConfigured = await brevoService.isConfigured(store_id);
    const config = await brevoService.getConfiguration(store_id);

    // Debug logging
    console.log('📧 [Brevo Status] Store:', store_id);
    console.log('📧 [Brevo Status] isConfigured:', isConfigured);
    console.log('📧 [Brevo Status] config:', JSON.stringify(config, null, 2));

    const responseData = {
      isConfigured,
      connected: isConfigured && config?.connectionStatus === 'success',
      connectionStatus: config?.connectionStatus || null,
      config: config ? {
        sender_name: config.senderName,
        sender_email: config.senderEmail,
        is_active: config.isActive,
        is_primary: config.isPrimary,
        connected_at: config.createdAt,
        updated_at: config.updatedAt
      } : null
    };

    console.log('📧 [Brevo Status] Response:', JSON.stringify(responseData, null, 2));

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Brevo status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check Brevo status',
      error: error.message
    });
  }
});

/**
 * POST /api/brevo/test-connection
 * Test Brevo connection by sending a test email
 */
router.post('/test-connection', [
  body('store_id').isUUID().withMessage('Valid store_id is required'),
  body('test_email').isEmail().withMessage('Valid test email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, test_email } = req.body;

    // Check store access
    req.params.store_id = store_id;
    await new Promise((resolve, reject) => {
      checkStoreOwnership(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Test connection
    const result = await brevoService.testConnection(store_id);

    // If connection is successful, optionally send a test email
    if (result.success) {
      try {
        // Create a simple test email
        const testHtml = `
          <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Brevo Connection Test</h2>
              <p>This is a test email from your DainoStore email system.</p>
              <p>If you received this email, your Brevo integration is working correctly!</p>
              <p>Account: ${result.account.email}</p>
              <p>Company: ${result.account.companyName || 'N/A'}</p>
              <hr>
              <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
            </body>
          </html>
        `;

        await emailService.sendViaBrevo(
          store_id,
          test_email,
          'Brevo Connection Test',
          testHtml
        );

        result.test_email_sent = true;
      } catch (emailError) {
        console.error('Failed to send test email:', emailError.message);
        result.test_email_sent = false;
        result.email_error = emailError.message;
      }
    }

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Brevo test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Brevo connection',
      error: error.message
    });
  }
});

/**
 * GET /api/brevo/email-statistics
 * Get email sending statistics for a store
 */
router.get('/email-statistics', async (req, res) => {
  try {
    const { store_id, days = 30 } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check store access
    req.params.store_id = store_id;
    await new Promise((resolve, reject) => {
      checkStoreOwnership(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const stats = await emailService.getEmailStatistics(store_id, parseInt(days));

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get email statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/brevo/set-primary
 * Set Brevo as the primary email provider
 */
router.post('/set-primary', checkStoreOwnership, async (req, res) => {
  try {
    const storeId = req.storeId;
    const IntegrationConfig = require('../models/IntegrationConfig');

    // Check if Brevo is configured
    const isConfigured = await brevoService.isConfigured(storeId);
    if (!isConfigured) {
      return res.status(400).json({
        success: false,
        error: 'Brevo is not configured. Please configure it first.'
      });
    }

    // Unset is_primary on other email providers
    await IntegrationConfig.unsetPrimaryForTypes(storeId, ['sendgrid']);

    // Get Brevo config and set as primary
    const config = await IntegrationConfig.findByStoreAndType(storeId, 'brevo');
    if (config && config.id) {
      const ConnectionManager = require('../services/database/ConnectionManager');
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      await tenantDb
        .from('integration_configs')
        .update({ is_primary: true, updated_at: new Date().toISOString() })
        .eq('id', config.id);
    }

    res.json({
      success: true,
      message: 'Brevo set as primary email provider'
    });
  } catch (error) {
    console.error('Brevo set-primary error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
