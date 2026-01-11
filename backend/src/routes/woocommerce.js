const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const woocommerceIntegration = require('../services/woocommerce-integration');
const WooCommerceImportService = require('../services/woocommerce-import-service');
const IntegrationConfig = require('../models/IntegrationConfig');
const { authMiddleware } = require('../middleware/authMiddleware');
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
 * @route POST /api/woocommerce/connect
 * @desc Save WooCommerce credentials and test connection
 * @access Private
 */
router.post('/connect',
  storeAuth,
  [
    body('store_url')
      .notEmpty()
      .withMessage('Store URL is required')
      .isURL()
      .withMessage('Invalid store URL format'),
    body('consumer_key')
      .notEmpty()
      .withMessage('Consumer Key is required')
      .isLength({ min: 10 })
      .withMessage('Invalid Consumer Key format'),
    body('consumer_secret')
      .notEmpty()
      .withMessage('Consumer Secret is required')
      .isLength({ min: 10 })
      .withMessage('Invalid Consumer Secret format')
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

      const { store_url, consumer_key, consumer_secret } = req.body;
      const storeId = req.storeId;

      const result = await woocommerceIntegration.saveCredentials(
        storeId,
        store_url,
        consumer_key,
        consumer_secret
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'WooCommerce connection established successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to connect to WooCommerce'
        });
      }

    } catch (error) {
      console.error('Failed to connect WooCommerce:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/woocommerce/status
 * @desc Get WooCommerce connection status
 * @access Private
 */
router.get('/status', storeAuth, async (req, res) => {
  try {
    const status = await woocommerceIntegration.getConnectionStatus(req.storeId);

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Error checking WooCommerce status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/woocommerce/test-connection
 * @desc Test WooCommerce connection
 * @access Private
 */
router.post('/test-connection', storeAuth, async (req, res) => {
  try {
    const result = await woocommerceIntegration.testConnection(req.storeId);

    // Update integration config connection status
    const integrationConfig = await IntegrationConfig.findByStoreAndType(req.storeId, 'woocommerce');
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
    console.error('WooCommerce connection test failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/woocommerce/disconnect
 * @desc Disconnect WooCommerce integration
 * @access Private
 */
router.delete('/disconnect', storeAuth, async (req, res) => {
  try {
    const result = await woocommerceIntegration.disconnect(req.storeId);

    res.json(result);

  } catch (error) {
    console.error('WooCommerce disconnect failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/woocommerce/store-info
 * @desc Get connected WooCommerce store information
 * @access Private
 */
router.get('/store-info', storeAuth, async (req, res) => {
  try {
    const tokenInfo = await woocommerceIntegration.getTokenInfo(req.storeId);

    if (!tokenInfo) {
      return res.status(404).json({
        success: false,
        message: 'No WooCommerce connection found for this store'
      });
    }

    res.json({
      success: true,
      store_info: {
        store_url: tokenInfo.store_url,
        store_info: tokenInfo.store_info,
        connected_at: tokenInfo.created_at,
        last_updated: tokenInfo.updated_at
      }
    });

  } catch (error) {
    console.error('Error fetching WooCommerce store info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// IMPORT ENDPOINTS
// ==========================================

/**
 * @route POST /api/woocommerce/import/categories
 * @desc Import WooCommerce categories (background job)
 * @access Private
 */
router.post('/import/categories',
  storeAuth,
  [
    body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean')
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

      const { dry_run = false } = req.body;

      // Schedule import as background job
      const job = await jobManager.scheduleJob({
        type: 'woocommerce:import:categories',
        payload: {
          storeId: req.storeId,
          options: {
            dryRun: dry_run
          }
        },
        priority: 'normal',
        maxRetries: 2,
        storeId: req.storeId,
        userId: req.user.id,
        metadata: {
          importType: 'categories',
          source: 'woocommerce'
        }
      });

      res.json({
        success: true,
        message: 'Categories import job scheduled. Track progress via the job status endpoint.',
        jobId: job.id,
        statusUrl: `/api/background-jobs/${job.id}/status`
      });

    } catch (error) {
      console.error('WooCommerce categories import job scheduling failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/woocommerce/import/products
 * @desc Import WooCommerce products (background job)
 * @access Private
 */
router.post('/import/products',
  storeAuth,
  [
    body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean'),
    body('limit').optional().isInt({ min: 1 }).withMessage('limit must be a positive integer')
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

      const { dry_run = false, limit = null } = req.body;

      // Schedule import as background job
      const job = await jobManager.scheduleJob({
        type: 'woocommerce:import:products',
        payload: {
          storeId: req.storeId,
          options: {
            dryRun: dry_run,
            limit: limit
          }
        },
        priority: 'normal',
        maxRetries: 2,
        storeId: req.storeId,
        userId: req.user.id,
        metadata: {
          importType: 'products',
          source: 'woocommerce'
        }
      });

      res.json({
        success: true,
        message: 'Products import job scheduled. Track progress via the job status endpoint.',
        jobId: job.id,
        statusUrl: `/api/background-jobs/${job.id}/status`
      });

    } catch (error) {
      console.error('WooCommerce products import job scheduling failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/woocommerce/import/full
 * @desc Full import (categories + products)
 * @access Private
 */
router.post('/import/full',
  storeAuth,
  [
    body('dry_run').optional().isBoolean().withMessage('dry_run must be a boolean'),
    body('product_limit').optional().isInt({ min: 1 }).withMessage('product_limit must be a positive integer')
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

      const { dry_run = false, product_limit = null } = req.body;

      // Schedule full import as background job
      const job = await jobManager.scheduleJob({
        type: 'woocommerce:import:all',
        payload: {
          storeId: req.storeId,
          options: {
            dryRun: dry_run,
            limit: product_limit
          }
        },
        priority: 'high',
        maxRetries: 2,
        storeId: req.storeId,
        userId: req.user.id,
        metadata: {
          importType: 'full',
          source: 'woocommerce'
        }
      });

      res.json({
        success: true,
        message: 'Full import job scheduled. This may take several minutes depending on your catalog size.',
        jobId: job.id,
        statusUrl: `/api/background-jobs/${job.id}/status`
      });

    } catch (error) {
      console.error('WooCommerce full import job scheduling failed:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// ==========================================
// DIRECT IMPORT ENDPOINTS (SSE)
// ==========================================

/**
 * @route POST /api/woocommerce/import/categories-direct
 * @desc Import WooCommerce categories directly with real-time progress (SSE)
 * @access Private
 */
router.post('/import/categories-direct', storeAuth, async (req, res) => {
  try {
    const { dry_run = false } = req.body;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendProgress({ stage: 'initializing', message: 'Initializing WooCommerce connection...' });

    const importService = new WooCommerceImportService(req.storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      sendProgress({ stage: 'error', message: initResult.message });
      res.end();
      return;
    }

    sendProgress({ stage: 'importing', message: 'Starting categories import...' });

    const result = await importService.importCategories({
      dryRun: dry_run,
      progressCallback: (progress) => {
        sendProgress(progress);
      }
    });

    sendProgress({ stage: 'complete', result });
    res.end();

  } catch (error) {
    console.error('Direct categories import failed:', error);
    res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

/**
 * @route POST /api/woocommerce/import/products-direct
 * @desc Import WooCommerce products directly with real-time progress (SSE)
 * @access Private
 */
router.post('/import/products-direct', storeAuth, async (req, res) => {
  try {
    const { limit = null, dry_run = false } = req.body;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendProgress({ stage: 'initializing', message: 'Initializing WooCommerce connection...' });

    const importService = new WooCommerceImportService(req.storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      sendProgress({ stage: 'error', message: initResult.message });
      res.end();
      return;
    }

    sendProgress({ stage: 'importing', message: 'Starting products import...' });

    const result = await importService.importProducts({
      limit,
      dryRun: dry_run,
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
 * @route POST /api/woocommerce/import/full-direct
 * @desc Full import (categories + products) with real-time progress (SSE)
 * @access Private
 */
router.post('/import/full-direct', storeAuth, async (req, res) => {
  try {
    const { limit = null, dry_run = false } = req.body;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendProgress({ stage: 'initializing', message: 'Initializing WooCommerce connection...' });

    const importService = new WooCommerceImportService(req.storeId);
    const initResult = await importService.initialize();

    if (!initResult.success) {
      sendProgress({ stage: 'error', message: initResult.message });
      res.end();
      return;
    }

    sendProgress({ stage: 'importing', message: 'Starting full import...' });

    const result = await importService.fullImport({
      limit,
      dryRun: dry_run,
      progressCallback: (progress) => {
        sendProgress(progress);
      }
    });

    sendProgress({ stage: 'complete', result });
    res.end();

  } catch (error) {
    console.error('Direct full import failed:', error);
    res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

/**
 * @route GET /api/woocommerce/import/stats
 * @desc Get import statistics
 * @access Private
 */
router.get('/import/stats', storeAuth, async (req, res) => {
  try {
    const ImportStatistic = require('../models/ImportStatistic');
    const stats = await ImportStatistic.getLatestStats(req.storeId, 'woocommerce');

    // Return WooCommerce-specific stats
    const woocommerceStats = {
      categories: stats.categories,
      products: stats.products
    };

    res.json({
      success: true,
      stats: woocommerceStats,
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

// ==========================================
// SCHEDULED IMPORTS
// ==========================================

/**
 * Get all WooCommerce schedules for a store
 * GET /api/woocommerce/schedules
 */
router.get('/schedules', storeAuth, async (req, res) => {
  try {
    const WooCommerceSchedule = require('../models/WooCommerceSchedule');
    console.log(`[GET /woocommerce/schedules] storeId: ${req.storeId}`);

    const schedules = await WooCommerceSchedule.findAll({
      where: { store_id: req.storeId }
    });

    console.log(`[GET /woocommerce/schedules] Found ${schedules.length} schedules`);

    res.json({
      success: true,
      schedules
    });
  } catch (error) {
    console.error('Error getting WooCommerce schedules:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Create or update a WooCommerce schedule
 * POST /api/woocommerce/schedules
 */
router.post('/schedules', storeAuth, async (req, res) => {
  try {
    const WooCommerceSchedule = require('../models/WooCommerceSchedule');
    const storeId = req.storeId;

    const scheduleData = {
      ...req.body,
      store_id: storeId
    };

    // Convert schedule_date if provided
    if (scheduleData.schedule_date && scheduleData.schedule_date !== '') {
      try {
        const date = new Date(scheduleData.schedule_date);
        if (isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid schedule date format.'
          });
        }
        scheduleData.schedule_date = date.toISOString();
      } catch (dateError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule date format.'
        });
      }
    } else {
      scheduleData.schedule_date = null;
    }

    // Validate schedule type requirements
    if (scheduleData.schedule_type === 'once' && !scheduleData.schedule_date) {
      return res.status(400).json({
        success: false,
        message: 'Schedule date is required for one-time schedules.'
      });
    }

    if (req.body.id) {
      // Update existing schedule
      const updatedSchedule = await WooCommerceSchedule.update(req.body.id, scheduleData, storeId);
      res.json({
        success: true,
        message: 'Schedule updated successfully',
        schedule: updatedSchedule
      });
    } else {
      // Create new schedule
      const schedule = await WooCommerceSchedule.create(scheduleData);
      res.json({
        success: true,
        message: 'Schedule created successfully',
        schedule
      });
    }
  } catch (error) {
    console.error('Error saving WooCommerce schedule:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Delete a WooCommerce schedule
 * DELETE /api/woocommerce/schedules/:id
 */
router.delete('/schedules/:id', storeAuth, async (req, res) => {
  try {
    const WooCommerceSchedule = require('../models/WooCommerceSchedule');
    await WooCommerceSchedule.destroy(req.params.id, req.storeId);

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting WooCommerce schedule:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// CATEGORY MAPPING ENDPOINTS
// ==========================================

/**
 * Sync WooCommerce categories to category mappings
 * POST /api/woocommerce/category-mappings/sync
 */
router.post('/category-mappings/sync', storeAuth, async (req, res) => {
  try {
    const CategoryMappingService = require('../services/CategoryMappingService');
    const client = await woocommerceIntegration.getClient(req.storeId);

    // Fetch categories from WooCommerce
    const categories = await client.getAllCategories();

    // Map to expected format
    const mappedCategories = categories.map(cat => ({
      id: cat.id.toString(),
      code: cat.id.toString(),
      name: cat.name,
      parent_code: cat.parent > 0 ? cat.parent.toString() : null
    }));

    const mappingService = new CategoryMappingService(req.storeId, 'woocommerce');
    const results = await mappingService.syncExternalCategories(mappedCategories);

    res.json({
      success: true,
      message: `Synced ${results.created + results.updated} categories (${results.created} new, ${results.updated} updated)`,
      results
    });
  } catch (error) {
    console.error('Error syncing WooCommerce category mappings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
