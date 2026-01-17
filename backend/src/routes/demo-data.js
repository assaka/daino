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
const DemoDataProvisioningService = require('../services/demo-data-provisioning-service');
const DemoDataRestorationService = require('../services/demo-data-restoration-service');
const { checkStoreOwnership } = require('../middleware/storeAuth');

/**
 * Helper to check if user has permission to manage store demo data
 * Requires direct ownership or admin/all permissions
 */
function hasStoreDemoPermission(req) {
  return req.storeAccess?.isDirectOwner ||
         req.storeAccess?.permissions?.all ||
         req.storeAccess?.permissions?.canManageStore ||
         req.storeAccess?.teamRole === 'admin';
}

/**
 * POST /api/stores/:id/provision-demo
 * Provision demo data for a store
 */
router.post('/:id/provision-demo', checkStoreOwnership, async (req, res) => {
  try {
    const store = req.store;

    // Check permission - only owners or admins can provision demo data
    if (!hasStoreDemoPermission(req)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to provision demo data'
      });
    }

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

    // Check permission - only owners or admins can restore demo data
    if (!hasStoreDemoPermission(req)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to restore demo data'
      });
    }

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
