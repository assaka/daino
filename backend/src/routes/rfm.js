/**
 * RFM API Routes
 *
 * Manages RFM (Recency, Frequency, Monetary) scoring for customers.
 */

const express = require('express');
const router = express.Router();
const RfmService = require('../services/rfm-service');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');

/**
 * GET /api/rfm/segments
 * Get segment definitions with details
 */
router.get('/segments', authMiddleware, authorize(['admin', 'store_owner']), (req, res) => {
  try {
    const segments = RfmService.getSegmentDetails();
    res.json({ success: true, segments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rfm/distribution
 * Get segment distribution for the store
 */
router.get('/distribution', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const distribution = await RfmService.getSegmentDistribution(storeId);

    res.json({ success: true, distribution });
  } catch (error) {
    console.error('[RFM] Error getting distribution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rfm/statistics
 * Get RFM statistics for the store
 */
router.get('/statistics', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const statistics = await RfmService.getStatistics(storeId);

    res.json({ success: true, statistics });
  } catch (error) {
    console.error('[RFM] Error getting statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rfm/matrix
 * Get RFM matrix data for visualization
 */
router.get('/matrix', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const matrix = await RfmService.getRfmMatrix(storeId);

    res.json({ success: true, matrix });
  } catch (error) {
    console.error('[RFM] Error getting matrix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rfm/customers/:segment
 * Get customers by RFM segment
 */
router.get('/customers/:segment', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const customers = await RfmService.getCustomersBySegment(storeId, req.params.segment);

    res.json({ success: true, customers });
  } catch (error) {
    console.error('[RFM] Error getting customers by segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rfm/customer/:customerId
 * Get RFM score for a specific customer
 */
router.get('/customer/:customerId', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const score = await RfmService.getCustomerScore(storeId, req.params.customerId);

    if (!score) {
      return res.status(404).json({ success: false, error: 'RFM score not found for this customer' });
    }

    res.json({ success: true, score });
  } catch (error) {
    console.error('[RFM] Error getting customer score:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rfm/calculate
 * Trigger RFM calculation for all customers
 */
router.post('/calculate', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const result = await RfmService.calculateAllScores(storeId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[RFM] Error calculating scores:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rfm/calculate/:customerId
 * Calculate RFM score for a specific customer
 */
router.post('/calculate/:customerId', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const score = await RfmService.calculateCustomerScore(storeId, req.params.customerId);

    if (!score) {
      return res.status(400).json({ success: false, error: 'Customer has no orders - cannot calculate RFM' });
    }

    res.json({ success: true, score });
  } catch (error) {
    console.error('[RFM] Error calculating customer score:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
