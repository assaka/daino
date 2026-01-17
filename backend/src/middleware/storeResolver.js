/**
 * Store Resolution Middleware
 * Automatically resolves the user's store ID from the database and attaches it to req.storeId
 * This eliminates the need for frontend to send x-store-id headers
 *
 * Supports both owned stores AND stores where user is a team member.
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

    const { masterDbClient } = require('../database/masterConnection');

    // 1. Get stores owned by user
    const { data: ownedStores, error: ownedError } = await masterDbClient
      .from('stores')
      .select('id, slug, is_active, user_id, created_at')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (ownedError) {
      throw new Error(`Master DB query failed: ${ownedError.message}`);
    }

    // 2. Get stores where user is a team member (active status)
    const { data: teamMemberships, error: teamError } = await masterDbClient
      .from('store_teams')
      .select('store_id, role')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .eq('is_active', true);

    if (teamError) {
      console.warn('⚠️ storeResolver: Could not fetch team memberships:', teamError.message);
    }

    // Get team store IDs (excluding already owned stores)
    const ownedStoreIds = new Set((ownedStores || []).map(s => s.id));
    const teamStoreIds = (teamMemberships || [])
      .filter(m => !ownedStoreIds.has(m.store_id))
      .map(m => m.store_id);

    // 3. Fetch team member stores details
    let teamStores = [];
    if (teamStoreIds.length > 0) {
      const { data: teamStoreData, error: teamStoreError } = await masterDbClient
        .from('stores')
        .select('id, slug, is_active, user_id, created_at')
        .in('id', teamStoreIds)
        .eq('is_active', true);

      if (!teamStoreError && teamStoreData) {
        teamStores = teamStoreData;
      }
    }

    // Combine owned and team stores
    const allStores = [...(ownedStores || []), ...teamStores];

    if (allStores.length === 0) {
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
      ? allStores.find(s => s.id === requestedStoreId) || allStores[0]
      : allStores[0];

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