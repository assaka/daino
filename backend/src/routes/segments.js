/**
 * Segments API Routes
 *
 * Manages customer segments for marketing and targeting.
 */

const express = require('express');
const router = express.Router();
const SegmentService = require('../services/segment-service');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');

/**
 * GET /api/segments
 * List all segments
 */
router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const options = {
      isActive: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      segmentType: req.query.segment_type,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const segments = await SegmentService.getAllSegments(storeId, options);

    res.json({ success: true, segments });
  } catch (error) {
    console.error('[Segments] Error listing segments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/segments/fields
 * Get available filter fields
 */
router.get('/fields', authMiddleware, authorize(['admin', 'store_owner']), (req, res) => {
  try {
    const fields = SegmentService.getAvailableFields();
    res.json({ success: true, fields });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/segments/operators/:type
 * Get available operators for a field type
 */
router.get('/operators/:type', authMiddleware, authorize(['admin', 'store_owner']), (req, res) => {
  try {
    const operators = SegmentService.getOperatorsForFieldType(req.params.type);
    res.json({ success: true, operators });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/segments/preview
 * Preview segment - get count without saving
 */
router.post('/preview', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { filters } = req.body;

    const result = await SegmentService.previewSegment(storeId, filters);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Segments] Error previewing segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/segments/:id
 * Get segment by ID
 */
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const segment = await SegmentService.getSegment(storeId, req.params.id);

    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    res.json({ success: true, segment });
  } catch (error) {
    console.error('[Segments] Error getting segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/segments
 * Create a new segment
 */
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { name, description, segmentType, filters, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    const segment = await SegmentService.createSegment(storeId, {
      name,
      description,
      segmentType: segmentType || 'dynamic',
      filters: filters || {},
      isActive: isActive !== false
    });

    // Calculate initial members for dynamic segments
    if (segment.segment_type === 'dynamic') {
      await SegmentService.calculateSegmentMembers(storeId, segment.id);
    }

    res.status(201).json({ success: true, segment });
  } catch (error) {
    console.error('[Segments] Error creating segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/segments/:id
 * Update a segment
 */
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { name, description, segmentType, filters, isActive } = req.body;

    const segment = await SegmentService.updateSegment(storeId, req.params.id, {
      name,
      description,
      segmentType,
      filters,
      isActive
    });

    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    // Recalculate members if filters changed and it's a dynamic segment
    if (filters && segment.segment_type === 'dynamic') {
      await SegmentService.calculateSegmentMembers(storeId, segment.id);
    }

    res.json({ success: true, segment });
  } catch (error) {
    console.error('[Segments] Error updating segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/segments/:id
 * Delete a segment
 */
router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    await SegmentService.deleteSegment(storeId, req.params.id);

    res.json({ success: true, message: 'Segment deleted successfully' });
  } catch (error) {
    console.error('[Segments] Error deleting segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/segments/:id/recalculate
 * Recalculate segment members
 */
router.post('/:id/recalculate', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const result = await SegmentService.calculateSegmentMembers(storeId, req.params.id);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Segments] Error recalculating segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/segments/:id/members
 * Get segment members
 */
router.get('/:id/members', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const options = {
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const members = await SegmentService.getSegmentMembers(storeId, req.params.id, options);

    res.json({ success: true, members });
  } catch (error) {
    console.error('[Segments] Error getting segment members:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/segments/:id/members
 * Add customer to static segment
 */
router.post('/:id/members', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'customerId is required' });
    }

    await SegmentService.addToSegment(storeId, req.params.id, customerId);

    res.json({ success: true, message: 'Customer added to segment' });
  } catch (error) {
    console.error('[Segments] Error adding to segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/segments/:id/members/:customerId
 * Remove customer from static segment
 */
router.delete('/:id/members/:customerId', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    await SegmentService.removeFromSegment(storeId, req.params.id, req.params.customerId);

    res.json({ success: true, message: 'Customer removed from segment' });
  } catch (error) {
    console.error('[Segments] Error removing from segment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/segments/seed-predefined
 * Create predefined segments
 */
router.post('/seed-predefined', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const segments = await SegmentService.createPredefinedSegments(storeId);

    res.json({ success: true, segments, count: segments.length });
  } catch (error) {
    console.error('[Segments] Error seeding predefined segments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
