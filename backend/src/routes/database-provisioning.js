const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const DatabaseProvisioningService = require('../services/database/DatabaseProvisioningService');
const ConnectionManager = require('../services/database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');

/**
 * Provision database for a new store
 */
router.post('/provision', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    const { databaseType, config } = req.body;

    if (!databaseType) {
      return res.status(400).json({
        success: false,
        message: 'Database type is required'
      });
    }

    // Update store status to provisioning
    await masterDbClient
      .from('stores')
      .update({ database_status: 'provisioning' })
      .eq('id', req.storeId);

    // Start provisioning (can be done async for large databases)
    const result = await DatabaseProvisioningService.provisionStore(req.storeId, {
      type: databaseType,
      ...config
    });

    res.json(result);
  } catch (error) {
    console.error('Provisioning error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Check provisioning status
 */
router.get('/status', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    const { data: store, error } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', req.storeId)
      .single();

    if (error || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    const isProvisioned = await DatabaseProvisioningService.isProvisioned(req.storeId);

    res.json({
      success: true,
      status: store.database_status,
      database_type: store.database_type,
      storage_type: store.storage_type,
      is_provisioned: isProvisioned,
      metadata: store.metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Test database connection
 */
router.post('/test-connection', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    const result = await ConnectionManager.testStoreConnection(req.storeId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get connection info (without sensitive data)
 */
router.get('/connection-info', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    const info = await ConnectionManager.getConnectionInfo(req.storeId);

    if (!info) {
      return res.status(404).json({
        success: false,
        message: 'No database configuration found'
      });
    }

    res.json({
      success: true,
      ...info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Re-provision database (admin only)
 */
router.post('/reprovision', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.is_admin && !req.user.platformAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await DatabaseProvisioningService.reprovisionStore(req.storeId);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Re-provision slot configurations only (for testing)
 */
router.post('/reprovision-slots', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    const TenantProvisioningService = require('../services/database/TenantProvisioningService');

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(req.storeId, false);

    if (!tenantDb) {
      return res.status(400).json({
        success: false,
        message: 'Could not connect to tenant database'
      });
    }

    // Delete existing slot configurations first
    console.log(`🗑️ Deleting existing slot_configurations for store ${req.storeId}...`);
    const { error: deleteError } = await tenantDb
      .from('slot_configurations')
      .delete()
      .eq('store_id', req.storeId);

    if (deleteError) {
      console.warn('⚠️ Error deleting slot configurations:', deleteError.message);
    }

    // Re-seed slot configurations
    console.log(`🔄 Re-seeding slot_configurations for store ${req.storeId}...`);
    const result = {
      storeId: req.storeId,
      dataSeeded: [],
      errors: []
    };

    await TenantProvisioningService.seedSlotConfigurations(tenantDb, req.storeId, {
      userId: req.user.id
    }, result);

    res.json({
      success: result.errors.length === 0,
      message: result.errors.length === 0
        ? 'Slot configurations reprovisioned successfully'
        : 'Reprovisioning completed with errors',
      dataSeeded: result.dataSeeded,
      errors: result.errors
    });
  } catch (error) {
    console.error('Slot reprovision error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get store subscription info
 */
router.get('/subscription', authMiddleware, checkStoreOwnership, async (req, res) => {
  try {
    const { data: subscriptions, error } = await masterDbClient
      .from('subscriptions')
      .select('*')
      .eq('store_id', req.storeId)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      subscription: {
        plan_name: subscription.plan_name,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        price_monthly: subscription.price_monthly,
        price_annual: subscription.price_annual,
        limits: {
          max_products: subscription.max_products,
          max_orders_per_month: subscription.max_orders_per_month,
          max_storage_gb: subscription.max_storage_gb,
          max_api_calls_per_month: subscription.max_api_calls_per_month
        },
        trial_ends_at: subscription.trial_ends_at,
        current_period_end: subscription.current_period_end
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
