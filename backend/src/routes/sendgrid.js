const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const sendgridService = require('../services/sendgrid-service');
const emailService = require('../services/email-service');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/sendgrid/configure
 * Save SendGrid API key configuration
 */
router.post('/configure',
  checkStoreOwnership,
  [
    body('apiKey').notEmpty().withMessage('API key is required'),
    body('senderName').notEmpty().withMessage('Sender name is required'),
    body('senderEmail').isEmail().withMessage('Valid sender email is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { apiKey, senderName, senderEmail } = req.body;
      const storeId = req.storeId;

      const result = await sendgridService.saveConfiguration(storeId, apiKey, senderName, senderEmail);

      res.json(result);
    } catch (error) {
      console.error('SendGrid configure error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/sendgrid/disconnect
 * Disconnect SendGrid from the store
 */
router.post('/disconnect',
  checkStoreOwnership,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      await sendgridService.disconnect(storeId);

      res.json({
        success: true,
        message: 'SendGrid disconnected successfully'
      });
    } catch (error) {
      console.error('SendGrid disconnect error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/sendgrid/status
 * Get SendGrid connection status
 */
router.get('/status',
  checkStoreOwnership,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      const isConfigured = await sendgridService.isConfigured(storeId);
      const config = await sendgridService.getConfiguration(storeId);

      res.json({
        success: true,
        data: {
          isConfigured,
          config: config ? {
            sender_name: config.senderName,
            sender_email: config.senderEmail,
            is_active: config.isActive,
            is_primary: config.isPrimary,
            connection_status: config.connectionStatus,
            created_at: config.createdAt,
            updated_at: config.updatedAt
          } : null
        }
      });
    } catch (error) {
      console.error('SendGrid status error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/sendgrid/test-connection
 * Test SendGrid connection and optionally send a test email
 */
router.post('/test-connection',
  checkStoreOwnership,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      const { testEmail } = req.body;

      // First test the API connection
      const connectionResult = await sendgridService.testConnection(storeId);

      if (!connectionResult.success) {
        return res.json(connectionResult);
      }

      // If test email provided, send a test email
      if (testEmail) {
        try {
          const sgMail = require('@sendgrid/mail');
          const apiKey = await sendgridService.getValidApiKey(storeId);
          const config = await sendgridService.getConfiguration(storeId);

          sgMail.setApiKey(apiKey);

          const msg = {
            to: testEmail,
            from: {
              name: config.senderName,
              email: config.senderEmail
            },
            subject: 'SendGrid Test Email',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a82e2;">SendGrid Test Email</h2>
                <p>Congratulations! Your SendGrid integration is working correctly.</p>
                <p>This test email confirms that:</p>
                <ul>
                  <li>Your API key is valid</li>
                  <li>Your sender email (${config.senderEmail}) is verified</li>
                  <li>Emails can be sent successfully</li>
                </ul>
                <p style="color: #666; font-size: 12px;">This is an automated test email.</p>
              </div>
            `
          };

          await sgMail.send(msg);

          return res.json({
            success: true,
            message: 'Connection verified and test email sent successfully',
            account: connectionResult.account,
            testEmailSent: true
          });
        } catch (emailError) {
          console.error('Test email error:', emailError.response?.body || emailError.message);
          return res.json({
            success: true,
            message: 'Connection verified but test email failed',
            account: connectionResult.account,
            testEmailSent: false,
            testEmailError: emailError.response?.body?.errors?.[0]?.message || emailError.message
          });
        }
      }

      res.json({
        ...connectionResult,
        testEmailSent: false
      });
    } catch (error) {
      console.error('SendGrid test connection error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/sendgrid/email-statistics
 * Get email statistics (uses shared email service)
 */
router.get('/email-statistics',
  checkStoreOwnership,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      const days = parseInt(req.query.days) || 30;

      const stats = await emailService.getEmailStatistics(storeId, days);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('SendGrid statistics error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/sendgrid/set-primary
 * Set SendGrid as the primary email provider
 */
router.post('/set-primary',
  checkStoreOwnership,
  async (req, res) => {
    try {
      const storeId = req.storeId;
      const IntegrationConfig = require('../models/IntegrationConfig');

      // Check if SendGrid is configured
      const isConfigured = await sendgridService.isConfigured(storeId);
      if (!isConfigured) {
        return res.status(400).json({
          success: false,
          error: 'SendGrid is not configured. Please configure it first.'
        });
      }

      // Unset is_primary on other email providers
      await IntegrationConfig.unsetPrimaryForTypes(storeId, ['brevo']);

      // Get SendGrid config and set as primary
      const config = await IntegrationConfig.findByStoreAndType(storeId, 'sendgrid');
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
        message: 'SendGrid set as primary email provider'
      });
    } catch (error) {
      console.error('SendGrid set-primary error:', error.message);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
