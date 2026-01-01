/**
 * AI Image Optimizer Service
 *
 * Provides AI-powered image optimization including:
 * - Compression/Quality optimization
 * - Upscaling/Enhancement
 * - Background Removal
 * - Contextual Staging (product in environment)
 * - Format Conversion
 *
 * Supports multiple providers: OpenAI, Gemini, Qwen, Flux
 */

const OpenAIImageProvider = require('./providers/openai-image');
const GeminiImageProvider = require('./providers/gemini-image');
const FluxImageProvider = require('./providers/flux-image');
const QwenImageProvider = require('./providers/qwen-image');
const ServiceCreditCost = require('../models/ServiceCreditCost');
const { masterDbClient } = require('../database/masterConnection');
const sharp = require('sharp');

// Provider registry
const PROVIDERS = {
  openai: OpenAIImageProvider,
  gemini: GeminiImageProvider,
  flux: FluxImageProvider,
  qwen: QwenImageProvider
};

// Operation types
const OPERATIONS = {
  COMPRESS: 'compress',
  UPSCALE: 'upscale',
  REMOVE_BG: 'remove_bg',
  STAGE: 'stage',
  CONVERT: 'convert'
};

// Service keys for credit costs
const SERVICE_KEYS = {
  openai: {
    compress: 'ai_image_openai_compress',
    upscale: 'ai_image_openai_upscale',
    remove_bg: 'ai_image_openai_remove_bg',
    stage: 'ai_image_openai_stage',
    convert: 'ai_image_openai_convert'
  },
  gemini: {
    compress: 'ai_image_gemini_compress',
    upscale: 'ai_image_gemini_upscale',
    remove_bg: 'ai_image_gemini_remove_bg',
    stage: 'ai_image_gemini_stage',
    convert: 'ai_image_gemini_convert'
  },
  flux: {
    compress: 'ai_image_flux_compress',
    upscale: 'ai_image_flux_upscale',
    remove_bg: 'ai_image_flux_remove_bg',
    stage: 'ai_image_flux_stage',
    convert: 'ai_image_flux_convert'
  },
  qwen: {
    compress: 'ai_image_qwen_compress',
    upscale: 'ai_image_qwen_upscale',
    remove_bg: 'ai_image_qwen_remove_bg',
    stage: 'ai_image_qwen_stage',
    convert: 'ai_image_qwen_convert'
  }
};

class AIImageOptimizer {
  constructor() {
    this.providers = {};
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  initializeProviders() {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        this.providers.openai = new OpenAIImageProvider(process.env.OPENAI_API_KEY);
        console.log('[AIImageOptimizer] OpenAI provider initialized');
      } catch (error) {
        console.warn('[AIImageOptimizer] Failed to initialize OpenAI provider:', error.message);
      }
    }

    // Gemini
    if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) {
      try {
        this.providers.gemini = new GeminiImageProvider(
          process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
        );
        console.log('[AIImageOptimizer] Gemini provider initialized');
      } catch (error) {
        console.warn('[AIImageOptimizer] Failed to initialize Gemini provider:', error.message);
      }
    }

    // Flux (via Replicate or fal.ai)
    if (process.env.REPLICATE_API_TOKEN || process.env.FAL_API_KEY) {
      try {
        this.providers.flux = new FluxImageProvider({
          replicateToken: process.env.REPLICATE_API_TOKEN,
          falApiKey: process.env.FAL_API_KEY
        });
        console.log('[AIImageOptimizer] Flux provider initialized');
      } catch (error) {
        console.warn('[AIImageOptimizer] Failed to initialize Flux provider:', error.message);
      }
    }

    // Qwen
    if (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY) {
      try {
        this.providers.qwen = new QwenImageProvider(
          process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY
        );
        console.log('[AIImageOptimizer] Qwen provider initialized');
      } catch (error) {
        console.warn('[AIImageOptimizer] Failed to initialize Qwen provider:', error.message);
      }
    }
  }

  /**
   * Get list of available providers with their capabilities
   */
  getAvailableProviders() {
    const available = [];

    for (const [name, provider] of Object.entries(this.providers)) {
      available.push({
        id: name,
        name: provider.getDisplayName(),
        icon: provider.getIcon(),
        capabilities: provider.getCapabilities(),
        isAvailable: true
      });
    }

    return available;
  }

  /**
   * Get available operations with their credit costs
   */
  async getOperationsWithCosts() {
    const { data: costs, error } = await masterDbClient
      .from('service_credit_costs')
      .select('*')
      .like('service_key', 'ai_image_%')
      .eq('is_active', true);

    if (error) {
      console.error('[AIImageOptimizer] Error fetching costs:', error);
      return [];
    }

    // Group by provider and operation
    const operations = {};

    for (const cost of costs || []) {
      // Parse service_key: ai_image_{provider}_{operation}
      const parts = cost.service_key.split('_');
      if (parts.length >= 4) {
        const provider = parts[2];
        const operation = parts.slice(3).join('_');

        if (!operations[operation]) {
          operations[operation] = {
            id: operation,
            name: this.getOperationDisplayName(operation),
            description: this.getOperationDescription(operation),
            providers: {}
          };
        }

        operations[operation].providers[provider] = {
          credits: parseFloat(cost.cost_per_unit),
          serviceKey: cost.service_key
        };
      }
    }

    return Object.values(operations);
  }

  /**
   * Get display name for operation
   */
  getOperationDisplayName(operation) {
    const names = {
      compress: 'Compress & Optimize',
      upscale: 'Upscale & Enhance',
      remove_bg: 'Remove Background',
      stage: 'Product Staging',
      convert: 'Format Conversion'
    };
    return names[operation] || operation;
  }

  /**
   * Get description for operation
   */
  getOperationDescription(operation) {
    const descriptions = {
      compress: 'AI-powered compression that maintains visual quality',
      upscale: 'Enhance resolution and reduce noise using AI',
      remove_bg: 'Automatically remove or replace backgrounds',
      stage: 'Place product in realistic environment (room, model, etc.)',
      convert: 'Smart conversion to optimal formats (WebP, AVIF)'
    };
    return descriptions[operation] || '';
  }

  /**
   * Get credit cost for an operation
   */
  async getCreditCost(provider, operation) {
    const serviceKey = SERVICE_KEYS[provider]?.[operation];
    if (!serviceKey) {
      throw new Error(`Unknown provider/operation: ${provider}/${operation}`);
    }

    try {
      const cost = await ServiceCreditCost.getCostByKey(serviceKey);
      return cost;
    } catch (error) {
      console.error(`[AIImageOptimizer] Error getting cost for ${serviceKey}:`, error);
      // Return default costs if not found
      const defaults = {
        compress: 0.5,
        upscale: 1.0,
        remove_bg: 1.0,
        stage: 2.0,
        convert: 0.3
      };
      return defaults[operation] || 1.0;
    }
  }

  /**
   * Optimize an image
   * @param {Object} options
   * @param {string} options.provider - Provider to use (openai, gemini, flux, qwen)
   * @param {string} options.operation - Operation type
   * @param {string|Buffer} options.image - Image URL or base64 data
   * @param {Object} options.params - Operation-specific parameters
   */
  async optimize(options) {
    const { provider, operation, image, params = {} } = options;

    // Validate provider
    if (!this.providers[provider]) {
      throw new Error(`Provider not available: ${provider}. Available: ${Object.keys(this.providers).join(', ')}`);
    }

    // Get provider instance
    const providerInstance = this.providers[provider];

    // Check if provider supports operation
    const capabilities = providerInstance.getCapabilities();
    if (!capabilities.includes(operation)) {
      throw new Error(`Provider ${provider} does not support operation: ${operation}`);
    }

    // Execute operation
    const startTime = Date.now();
    let result;

    try {
      switch (operation) {
        case OPERATIONS.COMPRESS:
          result = await providerInstance.compress(image, params);
          break;
        case OPERATIONS.UPSCALE:
          result = await providerInstance.upscale(image, params);
          break;
        case OPERATIONS.REMOVE_BG:
          result = await providerInstance.removeBackground(image, params);
          break;
        case OPERATIONS.STAGE:
          result = await providerInstance.stage(image, params);
          break;
        case OPERATIONS.CONVERT:
          result = await providerInstance.convert(image, params);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const duration = Date.now() - startTime;

      // Keep AI output as-is to preserve quality
      // AI providers return PNG which is lossless
      if (result && result.image && !result.format) {
        result.format = 'png';
      }

      return {
        success: true,
        provider,
        operation,
        result,
        duration,
        serviceKey: SERVICE_KEYS[provider]?.[operation]
      };
    } catch (error) {
      console.error(`[AIImageOptimizer] Error in ${provider}/${operation}:`, error);
      throw error;
    }
  }

  /**
   * Batch optimize multiple images
   */
  async batchOptimize(images, options) {
    const { provider, operation, params = {}, concurrency = 3 } = options;

    const results = [];
    const chunks = this.chunkArray(images, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(image => this.optimize({
          provider,
          operation,
          image,
          params
        }))
      );

      results.push(...chunkResults.map((result, index) => ({
        image: chunk[index],
        ...result.status === 'fulfilled'
          ? { success: true, ...result.value }
          : { success: false, error: result.reason.message }
      })));
    }

    return {
      total: images.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Helper to chunk array
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Process image using Sharp - lossless, preserves original quality
   * Only re-encodes to proper format without quality loss
   * @param {string} base64Image - Base64 encoded image
   * @param {Object} options - Processing options
   * @returns {Promise<{image: string, format: string}>}
   */
  async compressWithSharp(base64Image, options = {}) {
    const { preserveTransparency = true } = options;

    try {
      // Convert base64 to buffer
      const inputBuffer = Buffer.from(base64Image, 'base64');

      // Get image metadata to check for alpha channel
      const metadata = await sharp(inputBuffer).metadata();
      const hasAlpha = metadata.hasAlpha;

      let outputBuffer;
      let format = 'png';

      if (hasAlpha && preserveTransparency) {
        // For images with transparency, use PNG (lossless)
        outputBuffer = await sharp(inputBuffer)
          .png({
            compressionLevel: 6, // Balanced compression (0-9)
            adaptiveFiltering: true,
            palette: false // Keep as truecolor for quality
          })
          .toBuffer();
        format = 'png';
      } else {
        // For images without transparency, use lossless WebP
        outputBuffer = await sharp(inputBuffer)
          .webp({
            lossless: true, // Lossless - no quality degradation
            effort: 4 // Balanced effort (0-6)
          })
          .toBuffer();
        format = 'webp';
      }

      const originalSize = inputBuffer.length;
      const compressedSize = outputBuffer.length;
      const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

      console.log(`[AIImageOptimizer] Sharp lossless: ${(originalSize/1024).toFixed(1)}KB -> ${(compressedSize/1024).toFixed(1)}KB (${savings}% ${compressedSize < originalSize ? 'reduction' : 'increase'})`);

      return {
        image: outputBuffer.toString('base64'),
        format,
        originalSize,
        compressedSize
      };
    } catch (error) {
      console.error('[AIImageOptimizer] Sharp processing failed:', error.message);
      // Return original if processing fails
      return {
        image: base64Image,
        format: 'png',
        compressionFailed: true
      };
    }
  }
}

// Export singleton instance
module.exports = new AIImageOptimizer();
module.exports.OPERATIONS = OPERATIONS;
module.exports.SERVICE_KEYS = SERVICE_KEYS;
