/**
 * Store Resolution Middleware
 * Automatically resolves the user's store ID from the database and attaches it to req.storeId
 * This eliminates the need for frontend to send x-store-id headers
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.required - Whether store is required (default: true)
 * @param {string} options.fallbackStoreId - Fallback store ID if none found
 */
const storeResolver = (options = {}) => {
  const { required = true, fallbackStoreId = null } = options;

  return async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      if (!required) {
        // For unauthenticated requests, try to get store_id from headers/query
        req.storeId = req.headers['x-store-id'] || req.query.store_id || fallbackStoreId;
        return next();
      }

      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // FIXED: Use Supabase client instead of Sequelize to avoid connection issues
    // Master DB stores table only has: id, user_id, slug, status, is_active, created_at, updated_at
    // Full store data (name, etc.) is in tenant DB
    const { masterDbClient } = require('../database/masterConnection');
    const { data: stores, error: queryError } = await masterDbClient
      .from('stores')
      .select('id, slug, is_active, user_id, created_at')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (queryError) {
      throw new Error(`Master DB query failed: ${queryError.message}`);
    }

    if (!stores || stores.length === 0) {
      if (fallbackStoreId) {
        req.storeId = fallbackStoreId;
        req.store = { id: fallbackStoreId, name: 'Fallback Store', slug: 'fallback-store', is_active: true };
        return next();
      }

      if (!required) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'No active stores found for this user'
      });
    }

    // Use store from x-store-id header if provided, otherwise use first store
    const requestedStoreId = req.headers['x-store-id'] || req.query.store_id;
    const selectedStore = requestedStoreId
      ? stores.find(s => s.id === requestedStoreId) || stores[0]
      : stores[0];

    req.storeId = selectedStore.id;
    req.store = selectedStore;

    next();
  } catch (error) {
    console.error('❌ storeResolver error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   User ID:', req.user?.id);

    if (fallbackStoreId) {
      req.storeId = fallbackStoreId;
      req.store = { id: fallbackStoreId, name: 'Fallback Store', slug: 'fallback-store', is_active: true };
      return next();
    }

    if (!required) {
      return next();
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to resolve store information',
      details: error.message
    });
  }
  };
};

module.exports = {
  storeResolver
};