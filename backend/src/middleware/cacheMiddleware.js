const { get, set, generateKey } = require('../utils/cacheManager');

/**
 * Cache Middleware for Express Routes
 * Provides easy-to-use caching for API endpoints
 */

/**
 * Create cache middleware
 * @param {object} options - Cache options
 * @param {string} options.prefix - Cache key prefix
 * @param {number} options.ttl - Time to live in seconds (default: 300)
 * @param {function} options.keyGenerator - Custom key generator function
 * @param {function} options.condition - Condition to determine if response should be cached
 * @returns {function} Express middleware
 */
function cacheMiddleware(options = {}) {
  const {
    prefix = 'api',
    ttl = 300,
    keyGenerator = null,
    condition = null,
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      let cacheKey;
      if (keyGenerator) {
        cacheKey = keyGenerator(req);
      } else {
        // Default key generator
        const params = {
          ...req.query,
          ...req.params,
        };
        const identifier = req.path.replace(/\//g, '_');
        cacheKey = generateKey(prefix, identifier, params);
      }

      // Try to get cached response
      const cached = await get(cacheKey);
      if (cached) {
        // Set cache hit header for debugging
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Cache miss - intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Check condition if provided
        const shouldCache = condition ? condition(req, res, data) : true;

        if (shouldCache && res.statusCode >= 200 && res.statusCode < 300) {
          // Cache successful responses asynchronously
          set(cacheKey, data, ttl).catch(err => {
            console.error('Cache middleware set error:', err.message);
          });
        }

        // Set cache miss header for debugging
        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error.message);
      // On error, continue without caching
      next();
    }
  };
}

/**
 * Cache middleware for product listings
 * @param {number} ttl - Time to live in seconds
 * @returns {function} Express middleware
 */
function cacheProducts(ttl = 180) {
  return cacheMiddleware({
    prefix: 'products',
    ttl,
    keyGenerator: (req) => {
      const storeId = req.query.store_id || req.headers['x-store-id'] || req.params.store_id || 'default';
      const language = req.query.language || req.headers['x-language'] || 'en';
      const params = {
        language,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        category: req.query.category_id || req.query.category || '',
        search: req.query.search || '',
        sort: req.query.sort || '',
        featured: req.query.featured || '',
        ids: req.query.ids || '',
      };
      return generateKey('products', storeId, params);
    },
  });
}

/**
 * Cache middleware for product details
 * @param {number} ttl - Time to live in seconds
 * @returns {function} Express middleware
 */
function cacheProduct(ttl = 300) {
  return cacheMiddleware({
    prefix: 'product',
    ttl,
    keyGenerator: (req) => {
      const storeId = req.query.store_id || req.headers['x-store-id'] || 'default';
      const productId = req.params.id || req.params.slug || '';
      const language = req.query.language || req.headers['x-language'] || 'en';
      return generateKey('product', storeId, { productId, language });
    },
  });
}

/**
 * Cache middleware for categories
 * @param {number} ttl - Time to live in seconds
 * @returns {function} Express middleware
 */
function cacheCategories(ttl = 600) {
  return cacheMiddleware({
    prefix: 'categories',
    ttl,
    keyGenerator: (req) => {
      const storeId = req.query.store_id || req.headers['x-store-id'] || req.params.store_id || 'default';
      const language = req.query.language || req.headers['x-language'] || 'en';
      const slug = req.params.slug || req.params.id || '';
      const page = req.query.page || '1';
      const limit = req.query.limit || '100';
      return generateKey('categories', storeId, { language, slug, page, limit });
    },
  });
}

/**
 * Cache middleware for orders
 * @param {number} ttl - Time to live in seconds
 * @returns {function} Express middleware
 */
function cacheOrder(ttl = 60) {
  return cacheMiddleware({
    prefix: 'order',
    ttl,
    keyGenerator: (req) => {
      const paymentReference = req.params.paymentReference || req.params.reference || req.query.reference;
      const storeId = req.headers['x-store-id'] || req.query.store_id;
      // Include store_id in cache key to prevent cross-store cache collisions
      return generateKey('order', `${storeId}_${paymentReference}`);
    },
  });
}

/**
 * Cache middleware for store settings
 * @param {number} ttl - Time to live in seconds
 * @returns {function} Express middleware
 */
function cacheStoreSettings(ttl = 300) {
  return cacheMiddleware({
    prefix: 'store_settings',
    ttl,
    keyGenerator: (req) => {
      const storeId = req.params.store_id || req.query.store_id;
      return generateKey('store_settings', storeId);
    },
  });
}

/**
 * Cache middleware for analytics
 * @param {number} ttl - Time to live in seconds
 * @returns {function} Express middleware
 */
function cacheAnalytics(ttl = 900) {
  return cacheMiddleware({
    prefix: 'analytics',
    ttl,
    keyGenerator: (req) => {
      const storeId = req.query.store_id || 'default';
      const params = {
        startDate: req.query.startDate || '',
        endDate: req.query.endDate || '',
        type: req.query.type || 'all',
      };
      return generateKey('analytics', storeId, params);
    },
    // Only cache analytics if date range is in the past
    condition: (req, res, data) => {
      const endDate = req.query.endDate;
      if (!endDate) return false;
      const end = new Date(endDate);
      const now = new Date();
      // Only cache if end date is before today
      return end < now;
    },
  });
}

/**
 * Invalidate cache on POST, PUT, PATCH, DELETE requests
 * @param {string|string[]} patterns - Cache key patterns to invalidate
 * @returns {function} Express middleware
 */
function invalidateCacheOn(patterns) {
  const { deletePattern } = require('../utils/cacheManager');

  return async (req, res, next) => {
    // Skip for GET requests
    if (req.method === 'GET') {
      return next();
    }

    const originalJson = res.json.bind(res);
    res.json = async function(data) {
      // Invalidate cache after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const patternsArray = Array.isArray(patterns) ? patterns : [patterns];

        for (const pattern of patternsArray) {
          try {
            // Support dynamic pattern replacement (e.g., ":store_id")
            let resolvedPattern = pattern;
            Object.entries(req.params).forEach(([key, value]) => {
              resolvedPattern = resolvedPattern.replace(`:${key}`, value);
            });
            Object.entries(req.body || {}).forEach(([key, value]) => {
              resolvedPattern = resolvedPattern.replace(`:${key}`, value);
            });

            await deletePattern(resolvedPattern);
            console.log(`Cache invalidated: ${resolvedPattern}`);
          } catch (error) {
            console.error('Cache invalidation error:', error.message);
          }
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Cache health check middleware
 * Adds cache stats to health endpoint
 */
async function cacheHealth(req, res, next) {
  const { getStats } = require('../utils/cacheManager');
  const { isRedisConnected, getRedisInfo } = require('../config/redis');

  try {
    const stats = await getStats();
    req.cacheHealth = {
      redis: {
        connected: isRedisConnected(),
        ...getRedisInfo(),
      },
      stats,
    };
  } catch (error) {
    req.cacheHealth = {
      error: error.message,
    };
  }

  next();
}

module.exports = {
  // Generic middleware
  cacheMiddleware,

  // Specialized middleware
  cacheProducts,
  cacheProduct,
  cacheCategories,
  cacheOrder,
  cacheStoreSettings,
  cacheAnalytics,

  // Invalidation middleware
  invalidateCacheOn,

  // Health check
  cacheHealth,
};
