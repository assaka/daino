const express = require('express');
const { body, validationResult } = require('express-validator');
const { masterDbClient } = require('../database/masterConnection');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize, storeOwnerOnly } = require('../middleware/auth');
const { checkStoreOwnership, checkTeamMembership } = require('../middleware/storeAuth');
const crypto = require('crypto');
const ConnectionManager = require('../services/database/ConnectionManager');
const emailService = require('../services/email-service');
const router = express.Router();

// NOTE: MASTER DB ARCHITECTURE
// - StoreTeam: MASTER database (so users can discover their stores on login)
// - StoreInvitation: MASTER database (for cross-tenant invitation discovery)
// - Store: MASTER database (for store lookup and metadata)
// - User: MASTER database (for cross-tenant user authentication)

// @route   GET /api/store-teams/:store_id
// @desc    Get team members for a store
// @access  Private (store owner/admin)
router.get('/:store_id', authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id } = req.params;
    const { page = 1, limit = 10, status = 'active' } = req.query;
    const offset = (page - 1) * limit;

    // Check if user has permission to view team
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view team members'
      });
    }

    // Build query for store team members (from master DB)
    let teamQuery = masterDbClient.from('store_teams').select('*', { count: 'exact' });
    teamQuery = teamQuery.eq('store_id', store_id);

    if (status !== 'all') {
      teamQuery = teamQuery.eq('status', status);
    }

    teamQuery = teamQuery
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: teamMembers, error: teamError, count } = await teamQuery;

    if (teamError) {
      throw teamError;
    }

    // Fetch related user and store data from master DB
    const userIds = [...new Set([
      ...teamMembers.map(m => m.user_id),
      ...teamMembers.map(m => m.invited_by).filter(Boolean)
    ].filter(Boolean))];

    const { data: users } = await masterDbClient
      .from('users')
      .select('id, email, first_name, last_name, avatar_url')
      .in('id', userIds);

    const { data: stores } = await masterDbClient
      .from('stores')
      .select('id')
      .eq('id', store_id)
      .single();

    // Build lookup maps
    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u; });

    // Merge data
    const rows = teamMembers.map(member => ({
      ...member,
      User: userMap[member.user_id] || null,
      inviter: userMap[member.invited_by] || null,
      Store: stores || null
    }));

    res.json({
      success: true,
      data: {
        team_members: rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count,
          total_pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Get team members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/store-teams/:store_id/invitations
// @desc    Get pending invitations for a store
// @access  Private (store owner/admin)
router.get('/:store_id/invitations', authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id } = req.params;

    // Check if user has permission to view invitations
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view invitations'
      });
    }

    // Get invitations from master DB
    const { data: invitations, error } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('store_id', store_id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching store invitations:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch invitations'
      });
    }

    // Fetch inviter info from master DB
    const inviterIds = [...new Set(invitations.map(i => i.invited_by).filter(Boolean))];
    let inviterMap = {};

    if (inviterIds.length > 0) {
      const { data: inviters } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', inviterIds);

      (inviters || []).forEach(u => { inviterMap[u.id] = u; });
    }

    // Merge inviter data
    const invitationsWithInviter = invitations.map(inv => ({
      ...inv,
      inviter: inviterMap[inv.invited_by] || null
    }));

    res.json({
      success: true,
      data: {
        invitations: invitationsWithInviter
      }
    });
  } catch (error) {
    console.error('❌ Get store invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/store-teams/:store_id/invite
// @desc    Invite a user to join store team
// @access  Private (store owner/admin)
router.post('/:store_id/invite', authorize(['admin', 'store_owner']), checkStoreOwnership, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['admin', 'editor', 'viewer']).withMessage('Valid role is required'),
  body('message').optional().isString().isLength({ max: 500 }).withMessage('Message too long'),
  body('permissions').optional().isObject().withMessage('Permissions must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id } = req.params;
    const { email, role, message, permissions = {} } = req.body;

    // Check if user has permission to manage team
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to invite team members'
      });
    }

    // Check if email is already invited or is a team member
    // First get user by email from master DB
    const { data: userByEmail } = await masterDbClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (userByEmail) {
      // Check if this user is already a team member (in master DB)
      const { data: existingTeamMember } = await masterDbClient
        .from('store_teams')
        .select('*')
        .eq('store_id', store_id)
        .eq('user_id', userByEmail.id)
        .maybeSingle();

      if (existingTeamMember) {
        return res.status(400).json({
          success: false,
          message: 'User is already a team member'
        });
      }
    }

    // Check existing invitation in master DB using Supabase
    const { data: existingInvitation, error: checkError } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('store_id', store_id)
      .eq('invited_email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message: 'Invitation already sent to this email'
      });
    }

    // Create invitation using Supabase
    const invitationData = {
      store_id,
      invited_email: email,
      invited_by: req.user.id,
      role,
      permissions,
      message,
      invitation_token: crypto.randomBytes(32).toString('hex'),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: invitation, error: inviteError } = await masterDbClient
      .from('store_invitations')
      .insert(invitationData)
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create invitation'
      });
    }

    // Send email invitation
    try {
      // Get store info from master DB
      const { data: store } = await masterDbClient
        .from('stores')
        .select('id, name, domain')
        .eq('id', store_id)
        .single();

      // Get store name from tenant DB (that's where the actual name is stored)
      let tenantStoreName = null;
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(store_id);
        const { data: tenantStore } = await tenantDb
          .from('stores')
          .select('name')
          .eq('id', store_id)
          .maybeSingle();
        tenantStoreName = tenantStore?.name;
      } catch (err) {
        console.warn('Could not fetch tenant store name:', err.message);
      }

      // Get inviter info from master DB
      const { data: inviter } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('id', req.user.id)
        .single();

      // Build store data with tenant name preferred
      const storeData = {
        id: store?.id || store_id,
        name: tenantStoreName || store?.name || store?.domain || 'Your Store',
        domain: store?.domain || ''
      };

      // Send the invitation email
      const emailResult = await emailService.sendTeamInvitationEmail(
        store_id,
        invitation,
        storeData,
        inviter || { email: req.user.email }
      );

      if (!emailResult.success) {
        console.warn('⚠️ Invitation created but email failed:', emailResult.message);
      }
    } catch (emailError) {
      // Log but don't fail - invitation was created successfully
      console.error('⚠️ Failed to send invitation email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitation_id: invitation.id,
        invited_email: email,
        role,
        expires_at: invitation.expires_at
      }
    });
  } catch (error) {
    console.error('❌ Send invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/store-teams/:store_id/invitations/:invitation_id/resend
// @desc    Resend invitation email
// @access  Private (store owner/admin)
router.post('/:store_id/invitations/:invitation_id/resend', authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id, invitation_id } = req.params;

    // Check permissions
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to manage invitations'
      });
    }

    // Find the invitation (without status filter to provide better error messages)
    const { data: invitation, error: findError } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('id', invitation_id)
      .eq('store_id', store_id)
      .single();

    if (findError || !invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Check invitation status and provide specific error messages
    if (invitation.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been accepted. The user is now a team member.',
        code: 'INVITATION_ACCEPTED'
      });
    }

    if (invitation.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: 'This invitation was declined by the recipient.',
        code: 'INVITATION_DECLINED'
      });
    }

    if (invitation.status === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has expired. Please create a new invitation.',
        code: 'INVITATION_EXPIRED'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot resend invitation with status: ${invitation.status}`,
        code: 'INVALID_STATUS'
      });
    }

    // Update expiration date (extend by 7 days from now)
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await masterDbClient
      .from('store_invitations')
      .update({
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation_id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to resend invitation'
      });
    }

    // Send email invitation
    try {
      // Get store info from master DB
      const { data: store } = await masterDbClient
        .from('stores')
        .select('id, name, domain')
        .eq('id', store_id)
        .single();

      // Get store name from tenant DB (that's where the actual name is stored)
      let tenantStoreName = null;
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(store_id);
        const { data: tenantStore } = await tenantDb
          .from('stores')
          .select('name')
          .eq('id', store_id)
          .maybeSingle();
        tenantStoreName = tenantStore?.name;
      } catch (err) {
        console.warn('Could not fetch tenant store name:', err.message);
      }

      // Get inviter info from master DB
      const { data: inviter } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('id', invitation.invited_by)
        .single();

      // Build store data with tenant name preferred
      const storeData = {
        id: store?.id || store_id,
        name: tenantStoreName || store?.name || store?.domain || 'Your Store',
        domain: store?.domain || ''
      };

      // Update invitation with new expires_at for email
      const updatedInvitation = { ...invitation, expires_at: newExpiresAt };

      // Send the invitation email
      const emailResult = await emailService.sendTeamInvitationEmail(
        store_id,
        updatedInvitation,
        storeData,
        inviter || { email: 'Team Admin' }
      );

      if (!emailResult.success) {
        console.warn('⚠️ Invitation updated but email failed:', emailResult.message);
      }
    } catch (emailError) {
      console.error('⚠️ Failed to resend invitation email:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        invitation_id: invitation.id,
        invited_email: invitation.invited_email,
        expires_at: newExpiresAt
      }
    });
  } catch (error) {
    console.error('❌ Resend invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/store-teams/:store_id/invitations/:invitation_id
// @desc    Delete/cancel a pending invitation
// @access  Private (store owner/admin)
router.delete('/:store_id/invitations/:invitation_id', authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id, invitation_id } = req.params;

    // Check permissions
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to manage invitations'
      });
    }

    // Find the invitation first
    const { data: invitation, error: findError } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('id', invitation_id)
      .eq('store_id', store_id)
      .single();

    if (findError || !invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Delete the invitation
    const { error: deleteError } = await masterDbClient
      .from('store_invitations')
      .delete()
      .eq('id', invitation_id)
      .eq('store_id', store_id);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete invitation'
      });
    }

    res.json({
      success: true,
      message: 'Invitation deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/store-teams/:store_id/members/:member_id
// @desc    Update team member role/permissions
// @access  Private (store owner/admin)
router.put('/:store_id/members/:member_id', authorize(['admin', 'store_owner']), checkStoreOwnership, [
  body('role').optional().isIn(['admin', 'editor', 'viewer']).withMessage('Valid role is required'),
  body('permissions').optional().isObject().withMessage('Permissions must be an object'),
  body('status').optional().isIn(['active', 'suspended']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, member_id } = req.params;
    const { role, permissions, status } = req.body;

    // Check if user has permission to manage team
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to manage team members'
      });
    }

    // Get team member from master DB
    const { data: teamMember, error: memberError } = await masterDbClient
      .from('store_teams')
      .select('*')
      .eq('id', member_id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (memberError || !teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Fetch user data from master DB
    const { data: userData } = await masterDbClient
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', teamMember.user_id)
      .single();

    teamMember.User = userData;

    // Prevent changing owner role (if role is 'owner')
    if (teamMember.role === 'owner' && role && role !== 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change owner role'
      });
    }

    // Update team member
    const updateData = {};
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;
    if (status) updateData.status = status;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await masterDbClient
        .from('store_teams')
        .update(updateData)
        .eq('id', member_id);

      if (updateError) {
        throw updateError;
      }

      // Refresh team member data
      const { data: updatedMember } = await masterDbClient
        .from('store_teams')
        .select('*')
        .eq('id', member_id)
        .single();

      updatedMember.User = userData;

      res.json({
        success: true,
        message: 'Team member updated successfully',
        data: updatedMember
      });
    } else {
      res.json({
        success: true,
        message: 'No changes made',
        data: teamMember
      });
    }
  } catch (error) {
    console.error('❌ Update team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/store-teams/:store_id/members/:member_id
// @desc    Remove team member
// @access  Private (store owner/admin)
router.delete('/:store_id/members/:member_id', authorize(['admin', 'store_owner']), checkStoreOwnership, async (req, res) => {
  try {
    const { store_id, member_id } = req.params;

    // Check if user has permission to manage team
    const canManageTeam = req.storeAccess.isDirectOwner ||
                         req.storeAccess.permissions?.canManageTeam ||
                         req.storeAccess.permissions?.all;

    if (!canManageTeam) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to remove team members'
      });
    }

    // Get team member from master DB
    const { data: teamMember, error: memberError } = await masterDbClient
      .from('store_teams')
      .select('*')
      .eq('id', member_id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (memberError || !teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // Prevent removing owner
    if (teamMember.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove store owner'
      });
    }

    // Hard delete the team member
    const { error: deleteError } = await masterDbClient
      .from('store_teams')
      .delete()
      .eq('id', member_id)
      .eq('store_id', store_id);

    if (deleteError) {
      console.error('Error deleting team member:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove team member'
      });
    }

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('❌ Remove team member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/store-teams/invitation/:token
// @desc    Get invitation details by token (public - no auth required)
// @access  Public
router.get('/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find invitation in master DB
    const { data: invitation, error: inviteError } = await masterDbClient
      .from('store_invitations')
      .select('id, store_id, invited_email, role, message, expires_at, status, created_at')
      .eq('invitation_token', token)
      .maybeSingle();

    if (inviteError) {
      console.error('Error fetching invitation:', inviteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch invitation'
      });
    }

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This invitation has expired'
      });
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return res.status(410).json({
        success: false,
        message: 'This invitation has already been used'
      });
    }

    // Get store info
    const { data: store } = await masterDbClient
      .from('stores')
      .select('id, name, domain')
      .eq('id', invitation.store_id)
      .single();

    // Get inviter info
    const { data: inviterData } = await masterDbClient
      .from('store_invitations')
      .select('invited_by')
      .eq('id', invitation.id)
      .single();

    let inviter = null;
    if (inviterData?.invited_by) {
      const { data: inviterInfo } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('id', inviterData.invited_by)
        .single();
      inviter = inviterInfo;
    }

    // Check if a user with this email already exists
    const { data: existingUser } = await masterDbClient
      .from('users')
      .select('id')
      .eq('email', invitation.invited_email)
      .maybeSingle();

    res.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.invited_email,
        role: invitation.role,
        message: invitation.message,
        expires_at: invitation.expires_at,
        store: store || { name: 'Store' },
        inviter,
        userExists: !!existingUser
      }
    });
  } catch (error) {
    console.error('❌ Get invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/store-teams/accept-invitation/:token
// @desc    Accept store team invitation
// @access  Private
router.post('/accept-invitation/:token', authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { token } = req.params;

    // Find invitation in master DB using Supabase
    const { data: invitation, error: inviteError } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (inviteError) {
      console.error('Error fetching invitation:', inviteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch invitation'
      });
    }

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    // Check if invitee email matches current user (case-insensitive)
    if (invitation.invited_email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `This invitation was sent to ${invitation.invited_email}. You are logged in as ${req.user.email}. Please log out and sign in with the correct account.`
      });
    }

    // Check if user is already a team member (in master DB)
    const { data: existingMember } = await masterDbClient
      .from('store_teams')
      .select('*')
      .eq('store_id', invitation.store_id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this store'
      });
    }

    // Define default permissions based on role
    const getDefaultPermissions = (role) => {
      switch (role) {
        case 'admin':
          return {
            all: true,
            canManageTeam: true,
            canManageProducts: true,
            canManageOrders: true,
            canManageSettings: true,
            canManageContent: true
          };
        case 'editor':
          return {
            canManageProducts: true,
            canManageOrders: true,
            canManageContent: true
          };
        case 'viewer':
          return {
            canView: true
          };
        default:
          return {};
      }
    };

    const permissions = invitation.permissions && Object.keys(invitation.permissions).length > 0
      ? invitation.permissions
      : getDefaultPermissions(invitation.role);

    // Create team membership in master DB
    const { data: teamMember, error: createError } = await masterDbClient
      .from('store_teams')
      .insert({
        store_id: invitation.store_id,
        user_id: req.user.id,
        role: invitation.role,
        permissions: permissions,
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
        accepted_at: new Date().toISOString(),
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // Update invitation status in master DB
    await masterDbClient
      .from('store_invitations')
      .update({
        status: 'accepted',
        accepted_by: req.user.id,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    // Fetch User and Store data from master DB
    const [
      { data: userData },
      { data: storeData }
    ] = await Promise.all([
      masterDbClient.from('users').select('id, email, first_name, last_name').eq('id', req.user.id).single(),
      masterDbClient.from('stores').select('id').eq('id', invitation.store_id).single()
    ]);

    teamMember.User = userData;
    teamMember.Store = storeData;

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        team_member: teamMember,
        store: invitation.Store
      }
    });
  } catch (error) {
    console.error('❌ Accept invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/store-teams/my-invitations
// @desc    Get pending invitations for current user
// @access  Private
router.get('/my-invitations', authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    // Get invitations using Supabase
    const { data: invitations, error } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('invited_email', req.user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch invitations'
      });
    }

    // Note: Store and User data removed (were from includes)
    // Can be fetched separately if needed
    res.json({
      success: true,
      data: invitations || []
    });
  } catch (error) {
    console.error('❌ Get my invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
