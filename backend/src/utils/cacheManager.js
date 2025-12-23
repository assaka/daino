const { getRedisClient, isRedisConnected } = require('../config/redis');

/**
 * Cache Manager with Redis + In-Memory Fallback
 * Provides a unified caching interface that works with or without Redis
 */

// In-memory cache fallback (LRU-style with size limit)
class InMemoryCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key, value, ttl) {
    // Implement LRU: if at max size, delete oldest
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expiresAt = ttl ? Date.now() + (ttl * 1000) : null;
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  keys(pattern) {
    // Simple pattern matching for in-memory cache
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }
}

// Global in-memory cache instance
const memoryCache = new InMemoryCache(500); // Store up to 500 items

/**
 * Cache key prefixes for different data types
 */
const CACHE_KEYS = {
  PRODUCT: 'product',
  PRODUCT_LIST: 'products',
  CATEGORY: 'category',
  CATEGORY_LIST: 'categories',
  ORDER: 'order',
  STORE_SETTINGS: 'store_settings',
  TRANSLATION: 'translation',
  ANALYTICS: 'analytics',
};

/**
 * Default TTL values (in seconds)
 */
const DEFAULT_TTL = {
  PRODUCT: 300, // 5 minutes
  PRODUCT_LIST: 180, // 3 minutes
  CATEGORY: 600, // 10 minutes
  ORDER: 60, // 1 minute
  STORE_SETTINGS: 300, // 5 minutes
  TRANSLATION: 3600, // 1 hour
  ANALYTICS: 900, // 15 minutes
};

/**
 * Generate cache key
 * @param {string} prefix - Cache key prefix
 * @param {string|number} identifier - Unique identifier
 * @param {object} params - Additional parameters
 * @returns {string}
 */
function generateKey(prefix, identifier, params = {}) {
  const paramStr = Object.keys(params).length > 0
    ? ':' + Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  return `${prefix}:${identifier}${paramStr}`;
}

/**
 * Set cache value
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttl = 300) {
  try {
    const redis = getRedisClient();

    if (isRedisConnected() && redis) {
      // Use Redis
      const serialized = JSON.stringify(value);
      await redis.setEx(key, ttl, serialized);
      return true;
    } else {
      // Fallback to in-memory
      memoryCache.set(key, value, ttl);
      return true;
    }
  } catch (error) {
    console.error('Cache set error:', error.message);
    // Fallback to in-memory on Redis error
    memoryCache.set(key, value, ttl);
    return false;
  }
}

/**
 * Get cache value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>}
 */
async function get(key) {
  try {
    const redis = getRedisClient();

    if (isRedisConnected() && redis) {
      // Use Redis
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } else {
      // Fallback to in-memory
      return memoryCache.get(key);
    }
  } catch (error) {
    console.error('Cache get error:', error.message);
    // Try in-memory fallback
    return memoryCache.get(key);
  }
}

/**
 * Delete cache value
 * @param {string} key - Cache key
 * @returns {Promise<boolean>}
 */
async function del(key) {
  try {
    const redis = getRedisClient();

    if (isRedisConnected() && redis) {
      await redis.del(key);
    }
    memoryCache.delete(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    memoryCache.delete(key);
    return false;
  }
}

/**
 * Delete multiple cache keys by pattern
 * @param {string} pattern - Pattern to match (e.g., 'products:*')
 * @returns {Promise<number>}
 */
async function deletePattern(pattern) {
  try {
    const redis = getRedisClient();
    let deletedCount = 0;

    if (isRedisConnected() && redis) {
      // Use Redis SCAN for efficiency
      const keys = [];
      for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
      }

      console.log(`[CACHE] deletePattern Redis - pattern: ${pattern}, found keys:`, keys);

      if (keys.length > 0) {
        deletedCount = await redis.del(keys);
        console.log(`[CACHE] deletePattern Redis - deleted ${deletedCount} keys`);
      }
    } else {
      console.log(`[CACHE] deletePattern - Redis not connected, using in-memory only`);
    }

    // Also clear from in-memory cache
    const memKeys = memoryCache.keys(pattern);
    if (memKeys.length > 0) {
      console.log(`[CACHE] deletePattern in-memory - pattern: ${pattern}, found keys:`, memKeys);
    }
    memKeys.forEach(key => memoryCache.delete(key));
    deletedCount += memKeys.length;

    return deletedCount;
  } catch (error) {
    console.error('Cache delete pattern error:', error.message);
    return 0;
  }
}

/**
 * Clear all cache
 * @returns {Promise<boolean>}
 */
async function clear() {
  try {
    const redis = getRedisClient();

    if (isRedisConnected() && redis) {
      await redis.flushDb();
    }
    memoryCache.clear();
    return true;
  } catch (error) {
    console.error('Cache clear error:', error.message);
    memoryCache.clear();
    return false;
  }
}

/**
 * Wrap a function with caching
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>}
 */
async function wrap(key, fn, ttl = 300) {
  try {
    // Try to get from cache
    const cached = await get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn();

    // Cache result (don't await to avoid slowing down response)
    set(key, result, ttl).catch(err => {
      console.error('Cache wrap set error:', err.message);
    });

    return result;
  } catch (error) {
    console.error('Cache wrap error:', error.message);
    // On error, just execute function without caching
    return await fn();
  }
}

/**
 * Invalidate product caches
 * @param {number} storeId - Store ID
 * @param {number} productId - Product ID (optional)
 * @returns {Promise<void>}
 */
async function invalidateProduct(storeId, productId = null) {
  if (productId) {
    await del(generateKey(CACHE_KEYS.PRODUCT, productId));
  }
  await deletePattern(generateKey(CACHE_KEYS.PRODUCT_LIST, storeId) + '*');
}

/**
 * Invalidate category caches
 * @param {number} storeId - Store ID
 * @returns {Promise<void>}
 */
async function invalidateCategory(storeId) {
  await deletePattern(generateKey(CACHE_KEYS.CATEGORY, storeId) + '*');
  await deletePattern(generateKey(CACHE_KEYS.CATEGORY_LIST, storeId) + '*');
}

/**
 * Invalidate order caches
 * @param {string} paymentReference - Payment reference
 * @returns {Promise<void>}
 */
async function invalidateOrder(paymentReference) {
  await del(generateKey(CACHE_KEYS.ORDER, paymentReference));
}

/**
 * Invalidate store settings cache
 * @param {number} storeId - Store ID
 * @returns {Promise<void>}
 */
async function invalidateStoreSettings(storeId) {
  await del(generateKey(CACHE_KEYS.STORE_SETTINGS, storeId));
}

/**
 * Get cache statistics
 * @returns {Promise<object>}
 */
async function getStats() {
  try {
    const redis = getRedisClient();
    const stats = {
      redis: {
        connected: isRedisConnected(),
        keys: 0,
        memory: 0,
      },
      memory: {
        size: memoryCache.cache.size,
        maxSize: memoryCache.maxSize,
      },
    };

    if (isRedisConnected() && redis) {
      const info = await redis.info('stats');
      const keyspace = await redis.info('keyspace');
      stats.redis.info = { info, keyspace };
    }

    return stats;
  } catch (error) {
    console.error('Cache stats error:', error.message);
    return { error: error.message };
  }
}

module.exports = {
  // Core functions
  set,
  get,
  del,
  deletePattern,
  clear,
  wrap,

  // Helper functions
  generateKey,

  // Constants
  CACHE_KEYS,
  DEFAULT_TTL,

  // Invalidation functions
  invalidateProduct,
  invalidateCategory,
  invalidateOrder,
  invalidateStoreSettings,

  // Stats
  getStats,
};
