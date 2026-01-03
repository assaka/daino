/**
 * Image Optimization Routes
 *
 * API endpoints for AI-powered image optimization
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const aiImageOptimizer = require('../services/ai-image-optimizer');
const { OPERATIONS, SERVICE_KEYS } = require('../services/ai-image-optimizer');
const ServiceCreditCost = require('../models/ServiceCreditCost');
const { masterDbClient } = require('../database/masterConnection');
const creditService = require('../services/credit-service');

/**
 * Get available providers and their capabilities
 * GET /api/image-optimization/providers
 */
router.get('/providers', authMiddleware, async (req, res) => {
  try {
    const providers = aiImageOptimizer.getAvailableProviders();

    res.json({
      success: true,
      providers
    });
  } catch (error) {
    console.error('[ImageOptimization] Error getting providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get providers',
      error: error.message
    });
  }
});

/**
 * Get available operations with credit costs
 * GET /api/image-optimization/operations
 */
router.get('/operations', authMiddleware, async (req, res) => {
  try {
    const operations = await aiImageOptimizer.getOperationsWithCosts();

    res.json({
      success: true,
      operations
    });
  } catch (error) {
    console.error('[ImageOptimization] Error getting operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get operations',
      error: error.message
    });
  }
});

/**
 * Get full pricing matrix (providers x operations)
 * GET /api/image-optimization/pricing
 */
router.get('/pricing', authMiddleware, async (req, res) => {
  try {
    const { data: costs, error } = await masterDbClient
      .from('service_credit_costs')
      .select('*')
      .like('service_key', 'ai_image_%')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Build pricing matrix
    const matrix = {};
    const providers = new Set();
    const operations = new Set();

    for (const cost of costs || []) {
      const parts = cost.service_key.split('_');
      if (parts.length >= 4) {
        const provider = parts[2];
        const operation = parts.slice(3).join('_');

        providers.add(provider);
        operations.add(operation);

        if (!matrix[provider]) matrix[provider] = {};
        matrix[provider][operation] = {
          credits: parseFloat(cost.cost_per_unit),
          serviceKey: cost.service_key,
          serviceName: cost.service_name,
          description: cost.description
        };
      }
    }

    res.json({
      success: true,
      providers: Array.from(providers),
      operations: Array.from(operations),
      matrix
    });
  } catch (error) {
    console.error('[ImageOptimization] Error getting pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pricing',
      error: error.message
    });
  }
});

/**
 * Optimize a single image
 * POST /api/image-optimization/optimize
 */
router.post('/optimize',
  authMiddleware,
  body('provider').isIn(['openai', 'gemini', 'flux', 'qwen']).withMessage('Invalid provider'),
  body('operation').isIn(['compress', 'upscale', 'remove_bg', 'stage', 'convert']).withMessage('Invalid operation'),
  body('image').notEmpty().withMessage('Image is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { provider, operation, image, params = {} } = req.body;
      const storeId = req.storeId || req.headers['x-store-id'];
      const userId = req.user?.id;

      // Get credit cost
      const serviceKey = SERVICE_KEYS[provider]?.[operation];
      let creditCost = 1; // Default

      try {
        creditCost = await ServiceCreditCost.getCostByKey(serviceKey);
      } catch (e) {
        console.warn(`[ImageOptimization] Using default cost for ${serviceKey}`);
      }

      // Check if user has enough credits
      if (userId) {
        const hasCredits = await creditService.hasEnoughCredits(userId, storeId, creditCost);
        if (!hasCredits) {
          const balance = await creditService.getBalance(userId);
          return res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${creditCost}, Available: ${balance}`,
            required: creditCost,
            available: balance
          });
        }
      }

      // Perform optimization
      const result = await aiImageOptimizer.optimize({
        provider,
        operation,
        image,
        params
      });

      // Deduct credits
      if (userId) {
        await creditService.deduct(
          userId,
          storeId,
          creditCost,
          `Image ${operation} using ${provider}`,
          { provider, operation },
          null,
          'ai_image_optimization'
        );
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: creditCost
      });
    } catch (error) {
      console.error('[ImageOptimization] Error optimizing image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to optimize image',
        error: error.message
      });
    }
  }
);

/**
 * Remove background from image
 * POST /api/image-optimization/remove-bg
 */
router.post('/remove-bg',
  authMiddleware,
  body('provider').optional().isIn(['openai', 'gemini', 'flux', 'qwen']),
  body('image').notEmpty().withMessage('Image is required'),
  async (req, res) => {
    try {
      const { provider = 'flux', image, replacement = 'transparent' } = req.body;
      const storeId = req.storeId || req.headers['x-store-id'];
      const userId = req.user?.id;

      const serviceKey = SERVICE_KEYS[provider]?.remove_bg;
      let creditCost = 1;

      try {
        creditCost = await ServiceCreditCost.getCostByKey(serviceKey);
      } catch (e) {
        console.warn(`[ImageOptimization] Using default cost for ${serviceKey}`);
      }

      // Check credits
      if (userId) {
        const hasCredits = await creditService.hasEnoughCredits(userId, storeId, creditCost);
        if (!hasCredits) {
          const balance = await creditService.getBalance(userId);
          return res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${creditCost}`,
            required: creditCost,
            available: balance
          });
        }
      }

      const result = await aiImageOptimizer.optimize({
        provider,
        operation: 'remove_bg',
        image,
        params: { replacement }
      });

      // Deduct credits
      if (userId) {
        await creditService.deduct(
          userId,
          storeId,
          creditCost,
          `Background removal using ${provider}`,
          { provider, operation: 'remove_bg' },
          null,
          'ai_image_optimization'
        );
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: creditCost
      });
    } catch (error) {
      console.error('[ImageOptimization] Error removing background:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove background',
        error: error.message
      });
    }
  }
);

/**
 * Stage product in context
 * POST /api/image-optimization/stage
 */
router.post('/stage',
  authMiddleware,
  body('provider').optional().isIn(['openai', 'gemini', 'flux', 'qwen']),
  body('image').notEmpty().withMessage('Image is required'),
  body('context').optional().isString(),
  async (req, res) => {
    try {
      const {
        provider = 'openai',
        image,
        context = 'modern living room',
        style = 'photorealistic',
        lighting = 'natural daylight'
      } = req.body;
      const storeId = req.storeId || req.headers['x-store-id'];

      const serviceKey = SERVICE_KEYS[provider]?.stage;
      let creditCost = 2;

      try {
        creditCost = await ServiceCreditCost.getCostByKey(serviceKey);
      } catch (e) {
        console.warn(`[ImageOptimization] Using default cost for ${serviceKey}`);
      }

      // Check credits
      if (storeId) {
        const { data: store } = await masterDbClient
          .from('stores')
          .select('credits_balance')
          .eq('id', storeId)
          .single();

        if (store && store.credits_balance < creditCost) {
          return res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${creditCost}`,
            required: creditCost,
            available: store.credits_balance
          });
        }
      }

      const result = await aiImageOptimizer.optimize({
        provider,
        operation: 'stage',
        image,
        params: { context, style, lighting }
      });

      // Deduct credits
      if (storeId) {
        await masterDbClient.rpc('deduct_credits', {
          p_store_id: storeId,
          p_amount: creditCost,
          p_service_key: serviceKey,
          p_description: `Product staging in ${context} using ${provider}`
        });
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: creditCost
      });
    } catch (error) {
      console.error('[ImageOptimization] Error staging product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stage product',
        error: error.message
      });
    }
  }
);

/**
 * Upscale image
 * POST /api/image-optimization/upscale
 */
router.post('/upscale',
  authMiddleware,
  body('provider').optional().isIn(['openai', 'gemini', 'flux', 'qwen']),
  body('image').notEmpty().withMessage('Image is required'),
  body('scale').optional().isInt({ min: 1, max: 4 }),
  async (req, res) => {
    try {
      const { provider = 'flux', image, scale = 2, enhanceDetails = true } = req.body;
      const storeId = req.storeId || req.headers['x-store-id'];

      const serviceKey = SERVICE_KEYS[provider]?.upscale;
      let creditCost = 1;

      try {
        creditCost = await ServiceCreditCost.getCostByKey(serviceKey);
      } catch (e) {
        console.warn(`[ImageOptimization] Using default cost for ${serviceKey}`);
      }

      // Check credits
      if (storeId) {
        const { data: store } = await masterDbClient
          .from('stores')
          .select('credits_balance')
          .eq('id', storeId)
          .single();

        if (store && store.credits_balance < creditCost) {
          return res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${creditCost}`,
            required: creditCost,
            available: store.credits_balance
          });
        }
      }

      const result = await aiImageOptimizer.optimize({
        provider,
        operation: 'upscale',
        image,
        params: { scale, enhanceDetails }
      });

      // Deduct credits
      if (storeId) {
        await masterDbClient.rpc('deduct_credits', {
          p_store_id: storeId,
          p_amount: creditCost,
          p_service_key: serviceKey,
          p_description: `Image upscale ${scale}x using ${provider}`
        });
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: creditCost
      });
    } catch (error) {
      console.error('[ImageOptimization] Error upscaling image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upscale image',
        error: error.message
      });
    }
  }
);

/**
 * Batch optimize multiple images
 * POST /api/image-optimization/batch
 */
router.post('/batch',
  authMiddleware,
  body('provider').isIn(['openai', 'gemini', 'flux', 'qwen']).withMessage('Invalid provider'),
  body('operation').isIn(['compress', 'upscale', 'remove_bg', 'stage', 'convert']).withMessage('Invalid operation'),
  body('images').isArray({ min: 1, max: 20 }).withMessage('Images array required (1-20)'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { provider, operation, images, params = {}, concurrency = 3 } = req.body;
      const storeId = req.storeId || req.headers['x-store-id'];

      // Calculate total cost
      const serviceKey = SERVICE_KEYS[provider]?.[operation];
      let creditCostPerImage = 1;

      try {
        creditCostPerImage = await ServiceCreditCost.getCostByKey(serviceKey);
      } catch (e) {
        console.warn(`[ImageOptimization] Using default cost for ${serviceKey}`);
      }

      const totalCost = creditCostPerImage * images.length;

      // Check credits
      if (storeId) {
        const { data: store } = await masterDbClient
          .from('stores')
          .select('credits_balance')
          .eq('id', storeId)
          .single();

        if (store && store.credits_balance < totalCost) {
          return res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${totalCost}, Available: ${store.credits_balance}`,
            required: totalCost,
            available: store.credits_balance
          });
        }
      }

      // Process batch
      const result = await aiImageOptimizer.batchOptimize(images, {
        provider,
        operation,
        params,
        concurrency
      });

      // Deduct credits for successful operations
      const successfulCount = result.successful;
      const actualCost = creditCostPerImage * successfulCount;

      if (storeId && actualCost > 0) {
        await masterDbClient.rpc('deduct_credits', {
          p_store_id: storeId,
          p_amount: actualCost,
          p_service_key: serviceKey,
          p_description: `Batch ${operation}: ${successfulCount} images using ${provider}`
        });
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: actualCost,
        creditPerImage: creditCostPerImage
      });
    } catch (error) {
      console.error('[ImageOptimization] Error in batch operation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process batch',
        error: error.message
      });
    }
  }
);

module.exports = router;
