'use strict';

/**
 * Demo Data Management Routes
 *
 * POST /api/stores/:id/provision-demo - Provision demo data
 * POST /api/stores/:id/restore-demo - Clear demo data and restore
 * GET /api/stores/:id/demo-status - Get demo data status
 */

const express = require('express');
const router = express.Router();
const { masterDbClient } = require('../database/masterConnection');
const DemoDataProvisioningService = require('../services/demo-data-provisioning-service');
const DemoDataRestorationService = require('../services/demo-data-restoration-service');

/**
 * Middleware to check store ownership
 */
async function checkStoreOwnership(req, res, next) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const { data: store, error } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching store:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify store ownership'
      });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found or access denied'
      });
    }

    req.store = store;
    next();
  } catch (err) {
    console.error('Store ownership check error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * POST /api/stores/:id/provision-demo
 * Provision demo data for a store
 */
router.post('/:id/provision-demo', checkStoreOwnership, async (req, res) => {
  try {
    const store = req.store;

    // Validate store can receive demo data
    // Only active stores that are not published can receive demo data
    if (store.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Cannot provision demo data for store with status: ${store.status}. Store must be 'active'.`
      });
    }

    if (store.published) {
      return res.status(400).json({
        success: false,
        error: 'Cannot provision demo data for a running store. Please pause the store first.'
      });
    }

    console.log(`[DemoRoutes] Starting demo provisioning for store: ${store.id}`);

    const service = new DemoDataProvisioningService(store.id);
    const result = await service.provisionDemoData();

    res.json({
      success: true,
      message: 'Demo data provisioned successfully',
      data: result.summary
    });
  } catch (error) {
    console.error('Demo provisioning error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to provision demo data',
      details: error.message
    });
  }
});

/**
 * POST /api/stores/:id/restore-demo
 * Clear demo data and restore store to active state
 */
router.post('/:id/restore-demo', checkStoreOwnership, async (req, res) => {
  try {
    const store = req.store;

    // Only demo stores can be restored
    if (store.status !== 'demo') {
      return res.status(400).json({
        success: false,
        error: `Store does not have demo data to restore. Current status: ${store.status}`
      });
    }

    console.log(`[DemoRoutes] Starting demo restoration for store: ${store.id}`);

    const service = new DemoDataRestorationService(store.id);
    const result = await service.restoreStore();

    res.json({
      success: true,
      message: 'Demo data cleared and store restored',
      data: result
    });
  } catch (error) {
    console.error('Demo restoration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore store',
      details: error.message
    });
  }
});

/**
 * GET /api/stores/:id/demo-status
 * Get demo data status for a store
 */
router.get('/:id/demo-status', checkStoreOwnership, async (req, res) => {
  try {
    const store = req.store;

    // Check if store has demo data (for demo stores)
    let demoDataInfo = null;
    if (store.status === 'demo') {
      const service = new DemoDataRestorationService(store.id);
      demoDataInfo = await service.checkDemoStatus();
    }

    res.json({
      success: true,
      data: {
        storeId: store.id,
        status: store.status,
        published: store.published,
        hasDemo: store.status === 'demo',
        canProvision: store.status === 'active' && !store.published,
        canRestore: store.status === 'demo',
        demoDataInfo
      }
    });
  } catch (error) {
    console.error('Demo status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get demo status'
    });
  }
});

module.exports = router;
