/**
 * Campaigns API Routes
 *
 * Manages email marketing campaigns.
 */

const express = require('express');
const router = express.Router();
const EmailCampaign = require('../models/EmailCampaign');
const EmailCampaignRecipient = require('../models/EmailCampaignRecipient');
const SegmentService = require('../services/segment-service');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');

/**
 * GET /api/campaigns
 * List all campaigns
 */
router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const options = {
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const campaigns = await EmailCampaign.findAll(storeId, options);

    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('[Campaigns] Error listing campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign by ID
 */
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const campaign = await EmailCampaign.findById(storeId, req.params.id);

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('[Campaigns] Error getting campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/campaigns
 * Create a new campaign
 */
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const {
      name,
      subject,
      previewText,
      fromName,
      fromEmail,
      replyTo,
      contentHtml,
      contentJson,
      templateId,
      segmentId
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    if (!subject) {
      return res.status(400).json({ success: false, error: 'subject is required' });
    }

    const campaign = await EmailCampaign.create(storeId, {
      name,
      subject,
      previewText,
      fromName,
      fromEmail,
      replyTo,
      contentHtml,
      contentJson,
      templateId,
      segmentId
    });

    res.status(201).json({ success: true, campaign });
  } catch (error) {
    console.error('[Campaigns] Error creating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/campaigns/:id
 * Update a campaign
 */
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Check if campaign is editable
    const existingCampaign = await EmailCampaign.findById(storeId, req.params.id);
    if (!existingCampaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (['sending', 'sent'].includes(existingCampaign.status)) {
      return res.status(400).json({ success: false, error: 'Cannot edit a sent or sending campaign' });
    }

    const campaign = await EmailCampaign.update(storeId, req.params.id, req.body);

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('[Campaigns] Error updating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign
 */
router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Delete recipients first
    await EmailCampaignRecipient.deleteByCampaign(storeId, req.params.id);

    // Delete campaign
    await EmailCampaign.delete(storeId, req.params.id);

    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('[Campaigns] Error deleting campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/campaigns/:id/schedule
 * Schedule a campaign
 */
router.post('/:id/schedule', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, error: 'scheduledAt is required' });
    }

    const campaign = await EmailCampaign.schedule(storeId, req.params.id, scheduledAt);

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('[Campaigns] Error scheduling campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/campaigns/:id/send
 * Send a campaign immediately
 */
router.post('/:id/send', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const campaign = await EmailCampaign.findById(storeId, req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    if (!campaign.segment_id) {
      return res.status(400).json({ success: false, error: 'Campaign must have a segment' });
    }

    // Get segment customers
    const customers = await SegmentService.getSegmentCustomersForCampaign(storeId, campaign.segment_id);

    if (customers.length === 0) {
      return res.status(400).json({ success: false, error: 'Segment has no customers' });
    }

    // Create recipient records
    const recipients = customers.map(c => ({
      customerId: c.id,
      email: c.email
    }));

    await EmailCampaignRecipient.bulkCreate(storeId, campaign.id, recipients);

    // Update campaign status
    await EmailCampaign.updateStatus(storeId, campaign.id, 'sending');

    // The actual sending is done by a background job
    // For now, just return success
    res.json({
      success: true,
      message: 'Campaign queued for sending',
      recipientCount: recipients.length
    });
  } catch (error) {
    console.error('[Campaigns] Error sending campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/campaigns/:id/stats
 * Get campaign statistics
 */
router.get('/:id/stats', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const stats = await EmailCampaignRecipient.getCampaignStats(storeId, req.params.id);

    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Campaigns] Error getting stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/campaigns/:id/recipients
 * Get campaign recipients
 */
router.get('/:id/recipients', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const options = {
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const recipients = await EmailCampaignRecipient.findByCampaign(storeId, req.params.id, options);

    res.json({ success: true, recipients });
  } catch (error) {
    console.error('[Campaigns] Error getting recipients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/campaigns/:id/duplicate
 * Duplicate a campaign
 */
router.post('/:id/duplicate', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.body.store_id || req.user.store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const originalCampaign = await EmailCampaign.findById(storeId, req.params.id);
    if (!originalCampaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const newCampaign = await EmailCampaign.create(storeId, {
      name: `${originalCampaign.name} (Copy)`,
      subject: originalCampaign.subject,
      previewText: originalCampaign.preview_text,
      fromName: originalCampaign.from_name,
      fromEmail: originalCampaign.from_email,
      replyTo: originalCampaign.reply_to,
      contentHtml: originalCampaign.content_html,
      contentJson: originalCampaign.content_json,
      templateId: originalCampaign.template_id,
      segmentId: originalCampaign.segment_id
    });

    res.status(201).json({ success: true, campaign: newCampaign });
  } catch (error) {
    console.error('[Campaigns] Error duplicating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
