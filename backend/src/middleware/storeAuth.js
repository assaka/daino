// Import from master models for store ownership checks (master-tenant architecture)
const { masterDbClient } = require('../database/masterConnection');

/**
 * Helper function to check if user is a team member with specific permissions
 */
const checkTeamMembership = async (userId, storeId, requiredPermissions = []) => {
  try {
    const { data: teamMember, error } = await masterDbClient
      .from('store_teams')
      .select('*')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !teamMember) {
      return { hasAccess: false, role: null, permissions: {} };
    }

    // Role-based permissions
    const rolePermissions = {
      owner: { all: true }, // Owner has all permissions
      admin: { 
        all: true, // Admin has all permissions except ownership transfer
        canManageTeam: true,
        canManageStore: true,
        canManageContent: true,
        canViewReports: true
      },
      editor: {
        canManageContent: true,
        canViewReports: true,
        canManageProducts: true,
        canManageOrders: true,
        canManageCategories: true
      },
      viewer: {
        canViewReports: true,
        canViewProducts: true,
        canViewOrders: true
      }
    };

    const basePermissions = rolePermissions[teamMember.role] || {};
    const customPermissions = teamMember.permissions || {};
    const finalPermissions = { ...basePermissions, ...customPermissions };

    // Check if user has required permissions
    const hasRequiredPermissions = requiredPermissions.length === 0 || 
      requiredPermissions.every(perm => finalPermissions[perm] || finalPermissions.all);

    return {
      hasAccess: hasRequiredPermissions,
      role: teamMember.role,
      permissions: finalPermissions,
      teamMember
    };
  } catch (error) {
    console.error('❌ Team membership check error:', error);
    return { hasAccess: false, role: null, permissions: {} };
  }
};

/**
 * Middleware to check if the authenticated user owns or has access to the store
 * Supports both direct ownership and team membership
 */
const checkStoreOwnership = async (req, res, next) => {
  try {

    // Check if user is authenticated
    if (!req.user) {
      console.log('❌ No authenticated user found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Extract store_id from various sources (support both camelCase and snake_case)
    const storeId = req.params.storeId || // camelCase (used by many routes)
                   req.params.store_id || // snake_case
                   req.params.id || // For store update/delete routes
                   req.body?.store_id ||
                   req.query?.store_id ||
                   req.headers['x-store-id'];

    if (!storeId) {
      return next();
    }

    // Find the store in MASTER database (where ownership is tracked)
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check direct ownership first
    const isDirectOwner = store.user_id && store.user_id === req.user.id;
    
    // Check team membership if not direct owner
    let teamAccess = { hasAccess: false, role: null, permissions: {} };
    if (!isDirectOwner) {
      teamAccess = await checkTeamMembership(req.user.id, storeId);
    }
    
    const hasAccess = isDirectOwner || teamAccess.hasAccess;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Attach store and access info to request for downstream use
    req.store = store;
    req.storeId = store.id; // Add this for compatibility with AST diff routes
    req.storeAccess = {
      isDirectOwner,
      teamRole: teamAccess.role,
      permissions: teamAccess.permissions,
      teamMember: teamAccess.teamMember
    };
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking store ownership: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Middleware to ensure store resources (products, categories, etc.) belong to user's store
 * This is for routes that deal with store resources but don't have store_id in the URL
 */
const checkResourceOwnership = (modelName) => {
  return async (req, res, next) => {
    try {
      const ConnectionManager = require('../services/database/ConnectionManager');
      const resourceId = req.params.id;

      if (!resourceId) {
        return next();
      }

      // First, we need to determine which store this resource belongs to
      // This is complex because we need to query tenant DB, but we don't know which tenant yet
      // For now, we'll require storeId to be passed in the request
      const storeId = req.storeId || req.headers['x-store-id'] || req.query.store_id;

      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID required for resource access'
        });
      }

      // Get resource from tenant DB
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);
      const tableName = modelName.toLowerCase() + 's'; // Simple pluralization

      const { data: resource, error: resourceError } = await tenantDb
        .from(tableName)
        .select('*')
        .eq('id', resourceId)
        .maybeSingle();

      if (resourceError || !resource) {
        return res.status(404).json({
          success: false,
          message: `${modelName} not found`
        });
      }

      // Check if user owns the store that owns this resource or is a team member
      const { data: store, error: storeError } = await masterDbClient
        .from('stores')
        .select('id, user_id')
        .eq('id', storeId)
        .maybeSingle();

      if (store) {
        const isDirectOwner = store.user_id && store.user_id === req.user.id;

        // Check team membership if not direct owner
        let teamAccess = { hasAccess: false };
        if (!isDirectOwner) {
          teamAccess = await checkTeamMembership(req.user.id, store.id);
        }

        const hasAccess = isDirectOwner || teamAccess.hasAccess;

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }

        // Attach access info to request
        req.storeAccess = {
          isDirectOwner,
          teamRole: teamAccess.role,
          permissions: teamAccess.permissions
        };
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership'
      });
    }
  };
};

module.exports = {
  checkStoreOwnership,
  checkResourceOwnership,
  checkTeamMembership
};