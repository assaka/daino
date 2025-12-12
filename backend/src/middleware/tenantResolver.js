/**
 * Tenant Resolver Middleware
 *
 * Resolves tenant (store) from hostname and attaches tenant DB connection to request
 * Maps: myshop.dainostore.com → storeId → tenantDb connection
 *
 * Usage:
 *   app.use(tenantResolver); // Apply globally
 *   // OR
 *   router.get('/products', tenantResolver, (req, res) => {
 *     // req.storeId and req.tenantDb are available
 *   });
 */

const { StoreHostname } = require('../models/master');
const ConnectionManager = require('../services/database/ConnectionManager');

// In-memory cache for hostname → storeId mapping
const hostnameCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve tenant from hostname
 * Attaches req.storeId and req.tenantDb
 */
async function tenantResolver(req, res, next) {
  try {
    // 1. Get hostname from request
    const hostname = req.hostname || req.get('host')?.split(':')[0];

    if (!hostname) {
      return res.status(400).json({
        success: false,
        error: 'Unable to determine hostname',
        code: 'NO_HOSTNAME'
      });
    }

    // 2. Check cache first
    const cached = hostnameCache.get(hostname);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      req.storeId = cached.storeId;
      req.store = cached.store;

      // Attach tenant DB connection
      try {
        req.tenantDb = await ConnectionManager.getStoreConnection(cached.storeId);
      } catch (error) {
        console.error('Failed to connect to tenant DB:', error.message);
        return res.status(503).json({
          success: false,
          error: 'Store database unavailable',
          code: 'DB_UNAVAILABLE'
        });
      }

      return next();
    }

    // 3. Query master DB for hostname mapping
    const hostnameRecord = await StoreHostname.findByHostname(hostname);

    if (!hostnameRecord) {
      return res.status(404).json({
        success: false,
        error: 'Store not found for this hostname',
        code: 'STORE_NOT_FOUND',
        hostname
      });
    }

    const storeId = hostnameRecord.store_id;

    // 4. Verify store is active
    const { MasterStore } = require('../models/master');
    const store = await MasterStore.findByPk(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
        code: 'STORE_NOT_FOUND'
      });
    }

    if (!store.isOperational()) {
      return res.status(503).json({
        success: false,
        error: 'Store is not operational',
        code: 'STORE_UNAVAILABLE',
        status: store.status
      });
    }

    // 5. Cache the mapping
    hostnameCache.set(hostname, {
      storeId,
      store: {
        id: store.id,
        status: store.status,
        is_active: store.is_active
      },
      timestamp: Date.now()
    });

    // 6. Attach to request
    req.storeId = storeId;
    req.store = {
      id: store.id,
      status: store.status,
      is_active: store.is_active
    };

    // 7. Attach tenant DB connection
    try {
      req.tenantDb = await ConnectionManager.getStoreConnection(storeId);
    } catch (error) {
      console.error('Failed to connect to tenant DB:', error.message);
      return res.status(503).json({
        success: false,
        error: 'Store database unavailable',
        code: 'DB_UNAVAILABLE',
        details: error.message
      });
    }

    next();
  } catch (error) {
    console.error('Tenant resolver error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve tenant',
      code: 'RESOLVER_ERROR'
    });
  }
}

/**
 * Optional tenant resolver
 * Doesn't fail if hostname not found, just continues without tenant context
 */
async function optionalTenantResolver(req, res, next) {
  try {
    const hostname = req.hostname || req.get('host')?.split(':')[0];

    if (!hostname) {
      return next();
    }

    const hostnameRecord = await StoreHostname.findByHostname(hostname);

    if (hostnameRecord) {
      const storeId = hostnameRecord.store_id;
      req.storeId = storeId;

      try {
        req.tenantDb = await ConnectionManager.getStoreConnection(storeId);
      } catch (error) {
        // Continue without tenant DB
        console.warn('Failed to connect to tenant DB:', error.message);
      }
    }

    next();
  } catch (error) {
    // Continue without tenant context
    next();
  }
}

/**
 * Resolve tenant from store ID in route params
 * Use when hostname is not available (API calls with explicit store ID)
 */
async function tenantResolverById(req, res, next) {
  try {
    const storeId = req.params.storeId || req.params.id || req.body.storeId;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID required',
        code: 'NO_STORE_ID'
      });
    }

    // Verify store exists and is active
    const { MasterStore } = require('../models/master');
    const store = await MasterStore.findByPk(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
        code: 'STORE_NOT_FOUND'
      });
    }

    if (!store.isOperational()) {
      return res.status(503).json({
        success: false,
        error: 'Store is not operational',
        code: 'STORE_UNAVAILABLE'
      });
    }

    req.storeId = storeId;
    req.store = {
      id: store.id,
      status: store.status,
      is_active: store.is_active
    };

    // Attach tenant DB connection
    try {
      req.tenantDb = await ConnectionManager.getStoreConnection(storeId);
    } catch (error) {
      console.error('Failed to connect to tenant DB:', error.message);
      return res.status(503).json({
        success: false,
        error: 'Store database unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    next();
  } catch (error) {
    console.error('Tenant resolver by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve tenant'
    });
  }
}

/**
 * Clear hostname cache (call after updating store hostnames)
 */
function clearHostnameCache(hostname = null) {
  if (hostname) {
    hostnameCache.delete(hostname);
  } else {
    hostnameCache.clear();
  }
}

/**
 * Get cache stats (for monitoring)
 */
function getCacheStats() {
  return {
    size: hostnameCache.size,
    entries: Array.from(hostnameCache.keys())
  };
}

module.exports = {
  tenantResolver,
  optionalTenantResolver,
  tenantResolverById,
  clearHostnameCache,
  getCacheStats
};
