const express = require('express');
const { body, validationResult } = require('express-validator');
const { masterDbClient } = require('../database/masterConnection');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const crypto = require('crypto');
const ConnectionManager = require('../services/database/ConnectionManager');
const masterEmailService = require('../services/master-email-service');
const router = express.Router();

// NOTE: TENANT DB ARCHITECTURE
// - StorePauseAccess: TENANT database (store-specific pause access requests)
// - Public routes require store_id to get tenant connection
// - Admin routes use checkStoreOwnership middleware

/**
 * Helper to get store info from master DB by store_id
 */
async function getStoreInfo(storeId) {
  const { data: store, error } = await masterDbClient
    .from('stores')
    .select('id, name, slug, user_id')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    return null;
  }
  return store;
}

/**
 * Helper to get store owner email
 */
async function getStoreOwnerEmail(userId) {
  const { data: user, error } = await masterDbClient
    .from('users')
    .select('email, first_name, last_name')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return null;
  }
  return user;
}

// @route   POST /api/pause-access/request
// @desc    Submit an access request (public - no auth required)
// @access  Public
router.post('/request', [
  body('store_id').isUUID().withMessage('Valid store_id is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').optional().isString().isLength({ max: 500 }).withMessage('Message must be under 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { store_id, email, message } = req.body;

    // Get store info
    const store = await getStoreInfo(store_id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Check if request already exists
    const { data: existing } = await tenantDb
      .from('store_pause_access')
      .select('id, status')
      .eq('store_id', store_id)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      if (existing.status === 'approved') {
        return res.json({ success: true, message: 'You already have access to this store', already_approved: true });
      }
      if (existing.status === 'pending') {
        return res.json({ success: true, message: 'Your request is still pending', already_pending: true });
      }
      // If rejected or revoked, allow re-request by updating the existing record
      const access_token = crypto.randomBytes(32).toString('hex');
      const { error: updateError } = await tenantDb
        .from('store_pause_access')
        .update({
          message: message || null,
          status: 'pending',
          requested_at: new Date().toISOString(),
          responded_at: null,
          responded_by: null,
          access_token,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      // Create new request
      const access_token = crypto.randomBytes(32).toString('hex');
      const { error: insertError } = await tenantDb
        .from('store_pause_access')
        .insert({
          store_id,
          email: email.toLowerCase(),
          message: message || null,
          status: 'pending',
          access_token
        });

      if (insertError) {
        throw insertError;
      }
    }

    // Send email notification to store owner
    try {
      const owner = await getStoreOwnerEmail(store.user_id);
      if (owner?.email) {
        await masterEmailService.sendPauseAccessRequestEmail({
          toEmail: owner.email,
          storeName: store.name,
          requesterEmail: email,
          message: message || null,
          requestDate: new Date().toISOString(),
          manageUrl: `${process.env.FRONTEND_URL}/admin/access-requests`
        });
      }
    } catch (emailError) {
      console.error('Failed to send pause access request email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Your access request has been submitted. You will be notified by email when it is reviewed.'
    });
  } catch (error) {
    console.error('Error submitting pause access request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/pause-access/check
// @desc    Check if email has approved access (public)
// @access  Public
router.get('/check', async (req, res) => {
  try {
    const { store_id, email, token } = req.query;

    if (!store_id || !email) {
      return res.status(400).json({ success: false, message: 'store_id and email are required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Check for approved access
    const { data: access, error } = await tenantDb
      .from('store_pause_access')
      .select('id, status, access_token, expires_at')
      .eq('store_id', store_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'approved')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!access) {
      return res.json({ success: true, hasAccess: false });
    }

    // Check expiration
    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return res.json({ success: true, hasAccess: false, expired: true });
    }

    // For guest users, verify the access token
    if (token && access.access_token !== token) {
      return res.json({ success: true, hasAccess: false, invalid_token: true });
    }

    res.json({ success: true, hasAccess: true });
  } catch (error) {
    console.error('Error checking pause access:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/pause-access/:store_id
// @desc    Get all access requests for a store
// @access  Private (store owner/admin)
router.get('/:store_id', authMiddleware, authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check permissions
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to manage access requests'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Build query
    let query = tenantDb
      .from('store_pause_access')
      .select('*', { count: 'exact' })
      .eq('store_id', store_id);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    query = query
      .order('requested_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: requests, error, count } = await query;

    if (error) {
      throw error;
    }

    // Fetch responder info from master DB if needed
    const responderIds = [...new Set(requests.map(r => r.responded_by).filter(Boolean))];
    let responderMap = {};

    if (responderIds.length > 0) {
      const { data: responders } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', responderIds);

      (responders || []).forEach(r => { responderMap[r.id] = r; });
    }

    // Merge data
    const rows = requests.map(request => ({
      ...request,
      responder: responderMap[request.responded_by] || null
    }));

    res.json({
      success: true,
      data: {
        requests: rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count,
          total_pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching pause access requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/pause-access/:store_id/:id/approve
// @desc    Approve an access request
// @access  Private (store owner/admin)
router.put('/:store_id/:id/approve', authMiddleware, authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id, id } = req.params;
    const { expires_in_days } = req.body; // Optional expiration

    // Check permissions
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to approve access requests'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Get the request
    const { data: request, error: fetchError } = await tenantDb
      .from('store_pause_access')
      .select('*')
      .eq('id', id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }

    if (request.status === 'approved') {
      return res.json({ success: true, message: 'Request is already approved' });
    }

    // Calculate expiration if specified
    let expires_at = null;
    if (expires_in_days && expires_in_days > 0) {
      expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + expires_in_days);
      expires_at = expires_at.toISOString();
    }

    // Update the request
    const { error: updateError } = await tenantDb
      .from('store_pause_access')
      .update({
        status: 'approved',
        responded_at: new Date().toISOString(),
        responded_by: req.user.id,
        expires_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Send approval email to requester
    try {
      const store = await getStoreInfo(store_id);
      if (store) {
        await masterEmailService.sendPauseAccessApprovedEmail({
          toEmail: request.email,
          storeName: store.name,
          storeUrl: `${process.env.FRONTEND_URL}/store/${store.slug}?pause_access_email=${encodeURIComponent(request.email)}&pause_access_token=${request.access_token}`,
          expiresDate: expires_at
        });
      }
    } catch (emailError) {
      console.error('Failed to send pause access approved email:', emailError);
    }

    res.json({ success: true, message: 'Access request approved' });
  } catch (error) {
    console.error('Error approving pause access request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/pause-access/:store_id/:id/reject
// @desc    Reject an access request
// @access  Private (store owner/admin)
router.put('/:store_id/:id/reject', authMiddleware, authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id, id } = req.params;

    // Check permissions
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to reject access requests'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Get the request
    const { data: request, error: fetchError } = await tenantDb
      .from('store_pause_access')
      .select('*')
      .eq('id', id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }

    // Update the request
    const { error: updateError } = await tenantDb
      .from('store_pause_access')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        responded_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Send rejection email to requester
    try {
      const store = await getStoreInfo(store_id);
      if (store) {
        const owner = await getStoreOwnerEmail(store.user_id);
        await masterEmailService.sendPauseAccessRejectedEmail({
          toEmail: request.email,
          storeName: store.name,
          contactEmail: owner?.email || null
        });
      }
    } catch (emailError) {
      console.error('Failed to send pause access rejected email:', emailError);
    }

    res.json({ success: true, message: 'Access request rejected' });
  } catch (error) {
    console.error('Error rejecting pause access request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/pause-access/:store_id/:id
// @desc    Revoke access (for approved requests)
// @access  Private (store owner/admin)
router.delete('/:store_id/:id', authMiddleware, authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id, id } = req.params;

    // Check permissions
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to revoke access'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getConnection(store_id);

    // Get the request
    const { data: request, error: fetchError } = await tenantDb
      .from('store_pause_access')
      .select('*')
      .eq('id', id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ success: false, message: 'Access request not found' });
    }

    // Update status to revoked
    const { error: updateError } = await tenantDb
      .from('store_pause_access')
      .update({
        status: 'revoked',
        responded_at: new Date().toISOString(),
        responded_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, message: 'Access revoked' });
  } catch (error) {
    console.error('Error revoking pause access:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
