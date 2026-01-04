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
 * Parse error messages and return user-friendly versions
 */
function parseErrorMessage(error) {
  const errorStr = error.message || String(error);

  // OpenAI safety/content policy errors
  if (errorStr.includes('safety system') || errorStr.includes('content policy')) {
    return {
      code: 'CONTENT_REJECTED',
      message: 'The image was rejected by the AI safety system. This usually happens when the image contains content that violates usage policies.',
      suggestion: 'Try using a different image or contact support if you believe this is an error.',
      originalError: errorStr
    };
  }

  // Rate limiting
  if (errorStr.includes('rate limit') || errorStr.includes('429') || errorStr.includes('too many requests')) {
    return {
      code: 'RATE_LIMITED',
      message: 'Too many requests. The AI service is temporarily rate limited.',
      suggestion: 'Please wait a moment and try again.',
      originalError: errorStr
    };
  }

  // API key / authentication errors
  if (errorStr.includes('API key') || errorStr.includes('authentication') || errorStr.includes('401') || errorStr.includes('403')) {
    return {
      code: 'PROVIDER_AUTH_ERROR',
      message: 'Authentication error with the AI provider.',
      suggestion: 'Please contact support to verify API configuration.',
      originalError: errorStr
    };
  }

  // Image format/size errors
  if (errorStr.includes('format') || errorStr.includes('size') || errorStr.includes('too large') || errorStr.includes('unsupported')) {
    return {
      code: 'INVALID_IMAGE',
      message: 'The image format or size is not supported.',
      suggestion: 'Try using a JPEG or PNG image under 20MB.',
      originalError: errorStr
    };
  }

  // Timeout errors
  if (errorStr.includes('timeout') || errorStr.includes('ETIMEDOUT') || errorStr.includes('ECONNRESET')) {
    return {
      code: 'TIMEOUT',
      message: 'The operation timed out.',
      suggestion: 'The AI service is taking too long. Please try again or use a smaller image.',
      originalError: errorStr
    };
  }

  // Network errors
  if (errorStr.includes('ENOTFOUND') || errorStr.includes('network') || errorStr.includes('fetch failed')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network error connecting to the AI service.',
      suggestion: 'Please check your connection and try again.',
      originalError: errorStr
    };
  }

  // Quota/billing errors
  if (errorStr.includes('quota') || errorStr.includes('billing') || errorStr.includes('insufficient')) {
    return {
      code: 'PROVIDER_QUOTA',
      message: 'The AI provider quota has been exceeded.',
      suggestion: 'Please contact support.',
      originalError: errorStr
    };
  }

  // Default error
  return {
    code: 'OPTIMIZATION_FAILED',
    message: 'Failed to process the image.',
    suggestion: 'Please try again or use a different provider.',
    originalError: errorStr
  };
}

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
  body('operation').isIn(['compress', 'upscale', 'remove_bg', 'stage', 'convert', 'custom', 'generate']).withMessage('Invalid operation'),
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

      // Deduct credits only on success
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

      // Parse error for user-friendly message
      const parsedError = parseErrorMessage(error);

      // No credits were deducted since error occurred before deduction
      res.status(500).json({
        success: false,
        code: parsedError.code,
        message: parsedError.message,
        suggestion: parsedError.suggestion,
        error: parsedError.originalError,
        creditsDeducted: 0
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

      const parsedError = parseErrorMessage(error);
      res.status(500).json({
        success: false,
        code: parsedError.code,
        message: parsedError.message,
        suggestion: parsedError.suggestion,
        error: parsedError.originalError,
        creditsDeducted: 0
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
      const userId = req.user?.id;

      const serviceKey = SERVICE_KEYS[provider]?.stage;
      let creditCost = 2;

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
        operation: 'stage',
        image,
        params: { context, style, lighting }
      });

      // Deduct credits
      if (userId) {
        await creditService.deduct(
          userId,
          storeId,
          creditCost,
          `Product staging in ${context} using ${provider}`,
          { provider, operation: 'stage', context },
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
      console.error('[ImageOptimization] Error staging product:', error);

      const parsedError = parseErrorMessage(error);
      res.status(500).json({
        success: false,
        code: parsedError.code,
        message: parsedError.message,
        suggestion: parsedError.suggestion,
        error: parsedError.originalError,
        creditsDeducted: 0
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
      const userId = req.user?.id;

      const serviceKey = SERVICE_KEYS[provider]?.upscale;
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
        operation: 'upscale',
        image,
        params: { scale, enhanceDetails }
      });

      // Deduct credits
      if (userId) {
        await creditService.deduct(
          userId,
          storeId,
          creditCost,
          `Image upscale ${scale}x using ${provider}`,
          { provider, operation: 'upscale', scale },
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
      console.error('[ImageOptimization] Error upscaling image:', error);

      const parsedError = parseErrorMessage(error);
      res.status(500).json({
        success: false,
        code: parsedError.code,
        message: parsedError.message,
        suggestion: parsedError.suggestion,
        error: parsedError.originalError,
        creditsDeducted: 0
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
  body('operation').isIn(['compress', 'upscale', 'remove_bg', 'stage', 'convert', 'custom', 'generate']).withMessage('Invalid operation'),
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
      const userId = req.user?.id;

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
      if (userId) {
        const hasCredits = await creditService.hasEnoughCredits(userId, storeId, totalCost);
        if (!hasCredits) {
          const balance = await creditService.getBalance(userId);
          return res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${totalCost}, Available: ${balance}`,
            required: totalCost,
            available: balance
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

      if (userId && actualCost > 0) {
        await creditService.deduct(
          userId,
          storeId,
          actualCost,
          `Batch ${operation}: ${successfulCount} images using ${provider}`,
          { provider, operation, imageCount: successfulCount },
          null,
          'ai_image_optimization'
        );
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: actualCost,
        creditPerImage: creditCostPerImage
      });
    } catch (error) {
      console.error('[ImageOptimization] Error in batch operation:', error);

      const parsedError = parseErrorMessage(error);
      res.status(500).json({
        success: false,
        code: parsedError.code,
        message: parsedError.message,
        suggestion: parsedError.suggestion,
        error: parsedError.originalError,
        creditsDeducted: 0
      });
    }
  }
);

/**
 * Generate new image from text prompt
 * POST /api/image-optimization/generate
 */
router.post('/generate',
  authMiddleware,
  body('provider').optional().isIn(['openai', 'flux']).withMessage('Invalid provider for generation'),
  body('prompt').notEmpty().withMessage('Prompt is required'),
  body('style').optional().isString(),
  body('aspectRatio').optional().isIn(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']),
  body('referenceImageUrl').optional().isURL().withMessage('Invalid reference image URL'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const {
        provider = 'flux',
        prompt,
        style = 'photorealistic',
        aspectRatio = '1:1',
        referenceImageUrl = null
      } = req.body;
      const storeId = req.storeId || req.headers['x-store-id'];
      const userId = req.user?.id;

      // Get credit cost for generation
      const serviceKey = SERVICE_KEYS[provider]?.generate;
      let creditCost = 3; // Default for generation

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

      // Generate the image
      const result = await aiImageOptimizer.optimize({
        provider,
        operation: 'generate',
        image: referenceImageUrl, // Reference product image (optional)
        params: { prompt, style, aspectRatio, referenceImageUrl }
      });

      // Deduct credits only on success
      if (userId) {
        await creditService.deduct(
          userId,
          storeId,
          creditCost,
          `AI Image generation using ${provider}`,
          { provider, operation: 'generate', prompt: prompt.substring(0, 100) },
          null,
          'ai_image_generation'
        );
      }

      res.json({
        success: true,
        ...result,
        creditsDeducted: creditCost
      });
    } catch (error) {
      console.error('[ImageOptimization] Error generating image:', error);

      const parsedError = parseErrorMessage(error);
      res.status(500).json({
        success: false,
        code: parsedError.code,
        message: parsedError.message,
        suggestion: parsedError.suggestion,
        error: parsedError.originalError,
        creditsDeducted: 0
      });
    }
  }
);

module.exports = router;
