const express = require('express');
const router = express.Router();
const { masterDbClient } = require('../database/masterConnection');
const { authMiddleware } = require('../middleware/authMiddleware');
const TenantMigrationService = require('../services/migrations/TenantMigrationService');
const ConnectionManager = require('../services/database/ConnectionManager');

// Superadmin emails
const SUPERADMIN_EMAILS = ['hello@dainostore.com', 'hamid@dainostore.com'];

// Middleware to check superadmin access
const requireSuperadmin = (req, res, next) => {
  const userEmail = req.user?.email?.toLowerCase();
  if (!userEmail || !SUPERADMIN_EMAILS.includes(userEmail)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Superadmin privileges required.'
    });
  }
  next();
};

// Apply auth and superadmin check to all routes
router.use(authMiddleware);
router.use(requireSuperadmin);

/**
 * GET /api/superadmin/stores
 * Get all stores with their database info
 */
router.get('/stores', async (req, res) => {
  try {
    // Get stores with owner info
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select(`
        id,
        user_id,
        name,
        slug,
        is_active,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (storesError) throw storesError;

    // Get store_databases info
    const { data: databases, error: dbError } = await masterDbClient
      .from('store_databases')
      .select('store_id, schema_version, has_pending_migration, last_migration_at, is_active');

    if (dbError) throw dbError;

    // Get owners (stores.user_id -> users.id)
    const { data: users, error: usersError } = await masterDbClient
      .from('users')
      .select('id, email');

    if (usersError) throw usersError;

    // Merge data
    const dbMap = new Map(databases?.map(d => [d.store_id, d]) || []);
    const userMap = new Map(users?.map(u => [u.id, u.email]) || []);

    const enrichedStores = (stores || []).map(store => ({
      ...store,
      owner_email: userMap.get(store.user_id) || null,
      schema_version: dbMap.get(store.id)?.schema_version || 0,
      has_pending_migration: dbMap.get(store.id)?.has_pending_migration || false,
      db_active: dbMap.get(store.id)?.is_active || false
    }));

    res.json({
      success: true,
      data: { stores: enrichedStores }
    });
  } catch (error) {
    console.error('Superadmin stores error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/users
 * Get all users
 */
router.get('/users', async (req, res) => {
  try {
    // Get users
    const { data: users, error } = await masterDbClient
      .from('users')
      .select('id, email, first_name, last_name, role, email_verified, created_at')
      .order('created_at', { ascending: false });

    // Get stores to find which user owns which store
    const { data: stores } = await masterDbClient
      .from('stores')
      .select('id, user_id');

    const userStoreMap = new Map();
    stores?.forEach(s => {
      if (s.user_id) userStoreMap.set(s.user_id, s.id);
    });

    const enrichedUsers = (users || []).map(u => ({
      ...u,
      full_name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
      store_id: userStoreMap.get(u.id) || null
    }));

    if (error) throw error;

    res.json({
      success: true,
      data: { users: enrichedUsers }
    });
  } catch (error) {
    console.error('Superadmin users error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/migrations
 * Get all available migrations
 */
router.get('/migrations', async (req, res) => {
  try {
    const { data: migrations, error } = await masterDbClient
      .from('migrations')
      .select('id, version, name, description, created_at')
      .order('version', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: { migrations: migrations || [] }
    });
  } catch (error) {
    console.error('Superadmin migrations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/migrations/status
 * Get migration status for all stores
 */
router.get('/migrations/status', async (req, res) => {
  try {
    const status = await TenantMigrationService.getAllMigrationStatus();
    res.json({
      success: true,
      data: { stores: status }
    });
  } catch (error) {
    console.error('Superadmin migration status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/migrations/run-all
 * Run pending migrations for all stores
 */
router.post('/migrations/run-all', async (req, res) => {
  try {
    const stores = await TenantMigrationService.getStoresWithPendingMigrations();

    if (stores.length === 0) {
      return res.json({
        success: true,
        message: 'No stores with pending migrations',
        results: []
      });
    }

    console.log(`[Superadmin] Running migrations for ${stores.length} store(s)`);

    const results = [];

    for (const store of stores) {
      const storeId = store.store_id;
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const result = await TenantMigrationService.runPendingMigrations(storeId, tenantDb);
        results.push({
          storeId,
          success: result.success,
          applied: result.applied,
          failed: result.failed
        });
      } catch (error) {
        results.push({
          storeId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      success: failedCount === 0,
      data: {
        message: `Migrations completed: ${successCount} succeeded, ${failedCount} failed`,
        results
      }
    });
  } catch (error) {
    console.error('Superadmin run-all error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
