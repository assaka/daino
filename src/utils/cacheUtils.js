/**
 * Centralized Caching System
 *
 * Provides in-memory and localStorage caching with TTL support.
 * Extracted from StoreProvider.jsx for better maintainability.
 */

// Cache duration constants
export const CACHE_DURATION_LONG = 3600000; // 1 hour - for data that rarely changes
export const CACHE_DURATION_MEDIUM = 300000; // 5 minutes - for semi-static data
export const CACHE_DURATION_SHORT = 60000; // 1 minute - for frequently updated data
export const CACHE_VERSION = '2.2'; // Increment this to invalidate all cached data

// In-memory cache
const apiCache = new Map();

/**
 * Load cache from localStorage on initialization
 */
export function loadCacheFromStorage() {
  try {
    const stored = localStorage.getItem('storeProviderCache');
    const storedVersion = localStorage.getItem('storeProviderCacheVersion');

    // Invalidate cache if version changed
    if (storedVersion !== CACHE_VERSION) {
      localStorage.removeItem('storeProviderCache');
      localStorage.setItem('storeProviderCacheVersion', CACHE_VERSION);
      return;
    }

    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([key, value]) => {
        apiCache.set(key, value);
      });
    }
  } catch (e) {
    console.warn('Failed to load cache from storage:', e);
  }
}

/**
 * Save cache to localStorage
 */
export function saveCacheToStorage() {
  try {
    const cacheObj = {};
    apiCache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    localStorage.setItem('storeProviderCache', JSON.stringify(cacheObj));
  } catch (e) {
    console.warn('Failed to save cache to storage:', e);
  }
}

/**
 * Ultra-aggressive caching - return stale data immediately, refresh in background
 * @param {string} key - Cache key
 * @param {Function} apiCall - Function that returns a Promise with the data
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise} Cached or fresh data
 */
export async function cachedApiCall(key, apiCall, ttl = CACHE_DURATION_LONG) {
  const now = Date.now();

  // Force fresh calls for critical APIs
  // Note: categories removed from critical calls - now properly cached at backend level
  const isCriticalCall = key.includes('products-category');

  // Check cache first (unless critical)
  if (apiCache.has(key) && !isCriticalCall) {
    const { data, timestamp } = apiCache.get(key);

    // If data is fresh, return it
    if (now - timestamp < ttl) {
      return Promise.resolve(data);
    }

    // For critical calls, don't return stale empty data
    if (isCriticalCall && Array.isArray(data) && data.length === 0) {
      // Force fresh call below
    } else {
      // Return stale data, refresh in background
      setTimeout(async () => {
        try {
          const freshData = await apiCall();
          apiCache.set(key, { data: freshData, timestamp: now });
          saveCacheToStorage();
        } catch (error) {
          console.warn(`Background refresh failed for ${key}:`, error);
        }
      }, 100);

      return data;
    }
  }

  // No cache - fetch fresh
  try {
    const result = await apiCall();
    apiCache.set(key, { data: result, timestamp: now });
    saveCacheToStorage();
    return result;
  } catch (error) {
    console.error(`CacheUtils: API call failed for ${key}:`, error);

    // Don't cache empty results for critical calls
    if (isCriticalCall) {
      console.error(`CacheUtils: Not caching empty result for critical API: ${key}`);
      throw error;
    }

    // Return empty data for non-critical calls
    const emptyData = [];
    apiCache.set(key, { data: emptyData, timestamp: now });
    return emptyData;
  }
}

/**
 * Clear all cache (both memory and localStorage)
 */
export function clearCache() {
  apiCache.clear();
  localStorage.removeItem('storeProviderCache');
}

/**
 * Clear specific cache keys
 * @param {Array<string>} keys - Array of cache keys to clear
 */
export function clearCacheKeys(keys) {
  try {
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        if (apiCache.has(key)) {
          apiCache.delete(key);
        }
      });
    }

    localStorage.removeItem('storeProviderCache');
    localStorage.setItem('forceRefreshStore', Date.now().toString());
  } catch (error) {
    console.warn('Failed to clear specific cache keys:', error);
  }
}

/**
 * Delete a specific cache entry
 * @param {string} key - Cache key to delete
 */
export function deleteCacheKey(key) {
  apiCache.delete(key);

  try {
    const stored = localStorage.getItem('storeProviderCache');
    if (stored) {
      const parsed = JSON.parse(stored);
      delete parsed[key];
      localStorage.setItem('storeProviderCache', JSON.stringify(parsed));
    }
  } catch (e) {
    console.warn('Failed to clear localStorage cache key:', e);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: apiCache.size,
    keys: Array.from(apiCache.keys()),
    version: CACHE_VERSION
  };
}

// Initialize cache from storage
loadCacheFromStorage();

// Universal cache clearing utility for instant admin updates
export const clearStorefrontCache = (storeId, dataTypes = []) => {
  try {
    localStorage.removeItem('storeProviderCache');

    let cacheKeysToClear = [];

    if (dataTypes.includes('categories')) {
      cacheKeysToClear.push(`categories-${storeId}`);
    }
    if (dataTypes.includes('taxes')) {
      cacheKeysToClear.push(`taxes-${storeId}`);
    }
    if (dataTypes.includes('labels')) {
      cacheKeysToClear.push(`labels-${storeId}`);
    }
    if (dataTypes.includes('attributes')) {
      cacheKeysToClear.push(`attributes-${storeId}`);
      cacheKeysToClear.push(`attr-sets-${storeId}`);
    }
    if (dataTypes.includes('seo-templates')) {
      cacheKeysToClear.push(`seo-templates-${storeId}`);
    }
    if (dataTypes.includes('cookie-consent')) {
      cacheKeysToClear.push(`cookie-consent-${storeId}`);
    }
    if (dataTypes.includes('stores')) {
      cacheKeysToClear.push(`store-slug-*`);
      cacheKeysToClear.push('first-store');
    }
    if (dataTypes.includes('cms-blocks')) {
      localStorage.removeItem('storeProviderCache');
    }
    if (dataTypes.includes('cms-pages')) {
      localStorage.removeItem('storeProviderCache');
    }
    if (dataTypes.includes('products')) {
      localStorage.removeItem('storeProviderCache');
    }
    if (dataTypes.includes('settings')) {
      cacheKeysToClear.push(`store-slug-*`);
    }

    if (dataTypes.length === 0) {
      cacheKeysToClear = [
        `categories-${storeId}`,
        `taxes-${storeId}`,
        `labels-${storeId}`,
        `attributes-${storeId}`,
        `attr-sets-${storeId}`,
        `seo-templates-${storeId}`
      ];
    }

    clearCacheKeys(cacheKeysToClear);
  } catch (error) {
    console.error('Failed to clear storefront cache:', error);
  }
};

// Specific cache clearing functions
export const clearCategoriesCache = (storeId) => clearStorefrontCache(storeId, ['categories']);
export const clearTaxesCache = (storeId) => clearStorefrontCache(storeId, ['taxes']);
export const clearLabelsCache = (storeId) => clearStorefrontCache(storeId, ['labels']);
export const clearAttributesCache = (storeId) => clearStorefrontCache(storeId, ['attributes']);
export const clearSeoTemplatesCache = (storeId) => clearStorefrontCache(storeId, ['seo-templates']);
export const clearCookieConsentCache = (storeId) => clearStorefrontCache(storeId, ['cookie-consent']);
export const clearStoresCache = (storeId) => clearStorefrontCache(storeId, ['stores']);
export const clearCmsBlocksCache = (storeId) => clearStorefrontCache(storeId, ['cms-blocks']);
export const clearCmsPagesCache = (storeId) => clearStorefrontCache(storeId, ['cms-pages']);
export const clearProductsCache = (storeId) => clearStorefrontCache(storeId, ['products']);
export const clearSettingsCache = (storeId) => clearStorefrontCache(storeId, ['settings']);
export const clearAllCache = (storeId) => clearCache();

// Make utilities available globally for debugging
if (typeof window !== 'undefined') {
  window.clearCache = clearCache;
  window.clearCacheKeys = clearCacheKeys;
  window.getCacheStats = getCacheStats;

  window.testForceRefresh = () => {
    localStorage.setItem('forceRefreshStore', Date.now().toString());
    window.location.reload();
  };

  window.testStringFlag = () => {
    localStorage.setItem('forceRefreshStore', 'true');
    window.location.reload();
  };
}