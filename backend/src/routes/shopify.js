const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const shopifyIntegration = require('../services/shopify-integration');
const ShopifyImportService = require('../services/shopify-import-service');
const IntegrationConfig = require('../models/IntegrationConfig');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize, storeOwnerOnly, customerOnly, adminOnly } = require('../middleware/auth');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const jobManager = require('../core/BackgroundJobManager');

// Middleware to check if user is authenticated and has store access
const storeAuth = (req, res, next) => {
  const storeId = req.headers['x-store-id'] || 
                  req.body.store_id || 
                  req.query.store_id ||
                  req.params.store_id;
  
  if (storeId) {
    req.params.store_id = storeId;
  }
  
  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: 'Store ID is required. Please provide store_id in headers (x-store-id), body, or query parameters.'
    });
  }
  
  checkStoreOwnership(req, res, (err) => {
    if (err) return next(err);
    
    req.storeId = req.store?.id || storeId;
    
    if (!req.storeId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine store ID from request'
      });
    }
    
    next();
  });
};

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/shopify/configure-app
 * @desc Save Shopify app credentials for store
 * @access Private
 */
router.post('/configure-app',
  storeAuth,
  [
    body('client_id')
      .notEmpty()
      .withMessage('Client ID is required')
      .isLength({ min: 20 })
      .withMessage('Invalid Client ID format'),
    body('client_secret')
      .notEmpty()
      .withMessage('Client Secret is required')
      .isLength({ min: 32 })
      .withMessage('Invalid Client Secret format'),
    body('redirect_uri')
      .notEmpty()
      .withMessage('Redirect URI is required')
      .isURL()
      .withMessage('Invalid Redirect URI format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { client_id, client_secret, redirect_uri } = req.body;
      const storeId = req.storeId;

      const result = await shopifyIntegration.saveAppCredentials(
        storeId,
        client_id,
        client_secret,
        redirect_uri
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Shopify app credentials saved successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to save app credentials'
        });
      }

    } catch (error) {
      console.error('Failed to save Shopify app credentials:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/shopify/app-configured
 * @desc Check if Shopify app is configured for store
 * @access Private
 */
router.get('/app-configured', storeAuth, async (req, res) => {
  try {
    const credentials = await shopifyIntegration.getAppCredentials(req.storeId);
    
    res.json({
      success: true,
      configured: !!credentials,
      has_global_config: shopifyIntegration.oauthConfigured,
      redirect_uri: credentials?.redirect_uri || null
    });

  } catch (error) {
    console.error('Error checking app configuration:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/shopify/auth
 * @desc Generate Shopify OAuth URL
 * @access Private
 */
router.get('/auth', 
  storeAuth,
  [
    query('shop_domain')
      .notEmpty()
      .withMessage('Shop domain is required')
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)
      .withMessage('Invalid Shopify domain format. Must be in format: your-shop.myshopify.com')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { shop_domain } = req.query;
      const storeId = req.storeId;

      const authUrl = await shopifyIntegration.getAuthorizationUrl(storeId, shop_domain);

      res.json({
        success: true,
        auth_url: authUrl,
        message: 'Redirect user to this URL to authorize Shopify access'
      });

    } catch (error) {
      console.error('Shopify auth URL generation failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/shopify/direct-access
 * @desc Setup direct access with access token (for custom/private apps)
 * @access Private
 */
router.post('/direct-access',
  storeAuth,
  [
    body('shop_domain')
      .notEmpty()
      .withMessage('Shop domain is required')
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)
      .withMessage('Invalid Shopify domain format'),
    body('access_token')
      .notEmpty()
      .withMessage('Access token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { shop_domain, access_token } = req.body;
      const storeId = req.storeId;

      const result = await shopifyIntegration.setupDirectAccess(
        storeId,
        shop_domain,
        access_token
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Direct access connection established successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to establish direct access connection'
        });
      }

    } catch (error) {
      console.error('Direct access setup failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/shopify/callback
 * @desc Handle Shopify OAuth callback
 * @access Public (no auth required for OAuth callback)
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state, hmac } = req.query;

    if (!code || !shop || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing required OAuth parameters'
      });
    }

    // Extract storeId from state to verify HMAC with correct credentials
    let storeId = null;
    try {
      const stateData = shopifyIntegration.verifyState(state);
      storeId = stateData.storeId;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter'
      });
    }

    // Verify HMAC if present (recommended for production)
    if (hmac) {
      const isValidHmac = await shopifyIntegration.verifyHmac(req.query, hmac, storeId);
      if (!isValidHmac) {
        return res.status(400).json({
          success: false,
          message: 'Invalid HMAC signature'
        });
      }
    }

    const result = await shopifyIntegration.exchangeCodeForToken(code, shop, state);

    if (result.success) {
      // Redirect to success page in frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/integrations/shopify/success?store_id=${result.data.store_id}`);
    } else {
      console.error('Shopify OAuth failed:', result);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/integrations/shopify/error?error=${encodeURIComponent(result.error)}`);
    }

  } catch (error) {
    console.error('Shopify callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/integrations/shopify/error?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * @route GET /api/shopify/status
 * @desc Get Shopify connection status
 * @access Private
 */
router.get('/status', storeAuth, async (req, res) => {
  try {
    const status = await shopifyIntegration.getConnectionStatus(req.storeId);
    
    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Error checking Shopify status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/shopify/test-connection
 * @desc Test Shopify connection
 * @access Private
 */
router.post('/test-connection', storeAuth, async (req, res) => {
  try {
    const result = await shopifyIntegration.testConnection(req.storeId);

    // Update integration config connection status
    const integrationConfig = await IntegrationConfig.findByStoreAndType(req.storeId, 'shopify');
    if (integrationConfig) {
      await IntegrationConfig.updateConnectionStatus(
        integrationConfig.id,
        req.storeId,
        result.success ? 'success' : 'failed',
        result.success ? null : result.message
      );
    }

    res.json(result);

  } catch (error) {
    console.error('Shopify connection test failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/shopify/disconnect
 * @desc Disconnect Shopify integration
 * @access Private
 */
router.delete('/disconnect', storeAuth, async (req, res) => {
  try {
    const result = await shopifyIntegration.disconnect(req.storeId);
    
    res.json(result);

  } catch (error) {
    console.error('Shopify disconnect failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/shopify/import/collections
 * @desc Import Shopify collections
 * @access Private
 */
router.post('/import/collections',
  storeAuth,
  [
    body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean'),
    body('overwrite').optional().isBoolean().withMessage('overwrite must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { dry_run = false, overwrite = false } = req.body;

      // Schedule import as background job
      const job = await jobManager.scheduleJob({
        type: 'shopify:import:collections',
        payload: {
          storeId: req.storeId,
          options: {
            dryRun: dry_run,
            overwrite: overwrite
          }
        },
        priority: 'normal',
        maxRetries: 2,
        storeId: req.storeId,
        userId: req.user.id,
        metadata: {
          importType: 'collections'
        }
      });

      res.json({
        success: true,
        message: 'Collections import job scheduled. Track progress via the job status endpoint.',
        jobId: job.id,
        statusUrl: `/api/background-jobs/${job.id}/status`
      });

    } catch (error) {
      console.error('Collections import job scheduling failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/shopify/import/products-direct
 * @desc Import Shopify products directly with real-time progress (SSE)
 * @access Private
 */
router.post('/import/products-direct', storeAuth, async (req, res) => {
  try {
    const { limit = null, overwrite = false } = req.body;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendProgress({ stage: 'initializing', message: 'Initializing Shopify connection...' });

    const importService = new ShopifyImportService(req.storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      sendProgress({ stage: 'error', message: initResult.message });
      res.end();
      return;
    }

    sendProgress({ stage: 'importing', message: 'Starting product import...' });

    const result = await importService.importProducts({
      limit,
      overwrite,
      progressCallback: (progress) => {
        sendProgress(progress);
      }
    });

    sendProgress({ stage: 'complete', result });
    res.end();

  } catch (error) {
    console.error('Direct products import failed:', error);
    res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

/**
 * @route POST /api/shopify/import/products
 * @desc Import Shopify products (background job - DEPRECATED, use /import/products-direct)
 * @access Private
 */
router.post('/import/products',
  storeAuth,
  [
    body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean'),
    body('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer'),
    body('overwrite').optional().isBoolean().withMessage('overwrite must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { dry_run = false, limit = null, overwrite = false } = req.body;

      // Schedule import as background job
      const job = await jobManager.scheduleJob({
        type: 'shopify:import:products',
        payload: {
          storeId: req.storeId,
          options: {
            dryRun: dry_run,
            limit: limit,
            overwrite: overwrite
          }
        },
        priority: 'normal',
        maxRetries: 2,
        storeId: req.storeId,
        userId: req.user.id,
        metadata: {
          importType: 'products'
        }
      });

      res.json({
        success: true,
        message: 'Products import job scheduled. Track progress via the job status endpoint.',
        jobId: job.id,
        statusUrl: `/api/background-jobs/${job.id}/status`
      });

    } catch (error) {
      console.error('Products import job scheduling failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/shopify/import/full
 * @desc Full import (collections + products)
 * @access Private
 */
router.post('/import/full',
  storeAuth,
  [
    body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean'),
    body('product_limit').optional().isInt({ min: 1 }).withMessage('product_limit must be a positive integer'),
    body('overwrite').optional().isBoolean().withMessage('overwrite must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { dry_run = false, product_limit = null, overwrite = false } = req.body;

      // Schedule full import as background job
      const job = await jobManager.scheduleJob({
        type: 'shopify:import:all',
        payload: {
          storeId: req.storeId,
          options: {
            dryRun: dry_run,
            limit: product_limit,
            overwrite: overwrite
          }
        },
        priority: 'high', // Higher priority for full imports
        maxRetries: 2,
        storeId: req.storeId,
        userId: req.user.id,
        metadata: {
          importType: 'full'
        }
      });

      res.json({
        success: true,
        message: 'Full import job scheduled. This may take several minutes depending on your catalog size.',
        jobId: job.id,
        statusUrl: `/api/background-jobs/${job.id}/status`
      });

    } catch (error) {
      console.error('Full import job scheduling failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/shopify/import/stats
 * @desc Get import statistics
 * @access Private
 */
router.get('/import/stats', storeAuth, async (req, res) => {
  try {
    const ImportStatistic = require('../models/ImportStatistic');
    const stats = await ImportStatistic.getLatestStats(req.storeId, 'shopify');

    // Return Shopify-specific stats
    const shopifyStats = {
      collections: stats.collections,
      products: stats.products
    };

    res.json({
      success: true,
      stats: shopifyStats,
      detailed_stats: stats
    });

  } catch (error) {
    console.error('Error fetching import stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/shopify/shop-info
 * @desc Get connected shop information
 * @access Private
 */
router.get('/shop-info', storeAuth, async (req, res) => {
  try {
    // Use shopify-integration service which reads from integration_configs table
    const tokenRecord = await shopifyIntegration.getTokenInfo(req.storeId);

    if (!tokenRecord) {
      return res.status(404).json({
        success: false,
        message: 'No Shopify connection found for this store'
      });
    }

    res.json({
      success: true,
      shop_info: {
        shop_domain: tokenRecord.shop_domain,
        shop_name: tokenRecord.shop_name,
        shop_email: tokenRecord.shop_email,
        shop_country: tokenRecord.shop_country,
        shop_currency: tokenRecord.shop_currency,
        shop_timezone: tokenRecord.shop_timezone,
        plan_name: tokenRecord.plan_name,
        connected_at: tokenRecord.created_at,
        last_updated: tokenRecord.updated_at
      }
    });

  } catch (error) {
    console.error('Error fetching shop info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;