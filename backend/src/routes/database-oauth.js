/**
 * Database OAuth Routes
 *
 * Handles OAuth flows for database providers:
 * - Neon (PostgreSQL)
 * - PlanetScale (MySQL)
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const { masterDbClient } = require('../database/masterConnection');
const { encryptDatabaseCredentials } = require('../utils/encryption');
const neonService = require('../services/database/providers/NeonService');
const planetScaleService = require('../services/database/providers/PlanetScaleService');

// ========== NEON OAUTH ==========

/**
 * @route   GET /api/database-oauth/neon/authorize
 * @desc    Initiate Neon OAuth flow
 * @access  Private (Store Owner)
 */
router.get('/neon/authorize', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check store ownership
    const { checkUserStoreAccess } = require('../utils/storeAccess');
    if (req.user.role !== 'admin') {
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Generate OAuth authorization URL
    const authUrl = neonService.getAuthorizationUrl(store_id);

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Neon authorize error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/database-oauth/neon/callback
 * @desc    Handle Neon OAuth callback
 * @access  Private (Store Owner)
 */
router.post('/neon/callback', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'code and state are required'
      });
    }

    // Parse state
    const { storeId } = JSON.parse(state);

    // Check store ownership
    const { checkUserStoreAccess } = require('../utils/storeAccess');
    if (req.user.role !== 'admin') {
      const access = await checkUserStoreAccess(req.user.id, storeId);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Exchange code for token
    const tokenData = await neonService.exchangeCodeForToken(code);

    // Create Neon project
    const project = await neonService.createProject(tokenData.access_token, storeId);

    // Get connection string
    const connectionUri = await neonService.getConnectionString(tokenData.access_token, project.id);

    // Parse connection details
    const credentials = neonService.parseConnectionString(connectionUri);

    // Store in database (encrypted) - always set is_primary=true for main connection
    const { data: storeDatabase, error } = await masterDbClient
      .from('store_databases')
      .upsert({
        store_id: storeId,
        database_type: 'postgresql',
        connection_string_encrypted: encryptDatabaseCredentials(credentials),
        is_active: true,
        is_primary: true, // Primary connection - cannot be deleted
        connection_status: 'connected',
        last_connection_test: new Date().toISOString(),
        provider: 'neon',
        provider_project_id: project.id,
        provider_access_token_encrypted: encryptDatabaseCredentials({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token
        }),
        metadata: {
          region: project.region_id,
          pg_version: project.pg_version,
          created_at: project.created_at
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'store_id'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save database connection: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'Neon database connected successfully',
      data: {
        database_type: 'postgresql',
        provider: 'neon',
        project_id: project.id,
        region: project.region_id
      }
    });
  } catch (error) {
    console.error('Neon callback error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ========== PLANETSCALE OAUTH ==========

/**
 * @route   GET /api/database-oauth/planetscale/authorize
 * @desc    Initiate PlanetScale OAuth flow
 * @access  Private (Store Owner)
 */
router.get('/planetscale/authorize', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check store ownership
    const { checkUserStoreAccess } = require('../utils/storeAccess');
    if (req.user.role !== 'admin') {
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Generate OAuth authorization URL
    const authUrl = planetScaleService.getAuthorizationUrl(store_id);

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('PlanetScale authorize error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/database-oauth/planetscale/callback
 * @desc    Handle PlanetScale OAuth callback
 * @access  Private (Store Owner)
 */
router.post('/planetscale/callback', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'code and state are required'
      });
    }

    // Parse state
    const { storeId } = JSON.parse(state);

    // Check store ownership
    const { checkUserStoreAccess } = require('../utils/storeAccess');
    if (req.user.role !== 'admin') {
      const access = await checkUserStoreAccess(req.user.id, storeId);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Exchange code for token
    const tokenData = await planetScaleService.exchangeCodeForToken(code);

    // Create PlanetScale database
    const database = await planetScaleService.createDatabase(
      tokenData.access_token,
      tokenData.organization_id,
      storeId
    );

    // Get connection string
    const credentials = await planetScaleService.getConnectionString(
      tokenData.access_token,
      tokenData.organization_id,
      database.name
    );

    // Store in database (encrypted) - always set is_primary=true for main connection
    const { data: storeDatabase, error } = await masterDbClient
      .from('store_databases')
      .upsert({
        store_id: storeId,
        database_type: 'mysql',
        connection_string_encrypted: encryptDatabaseCredentials(credentials),
        is_active: true,
        is_primary: true, // Primary connection - cannot be deleted
        connection_status: 'connected',
        last_connection_test: new Date().toISOString(),
        provider: 'planetscale',
        provider_project_id: database.name,
        provider_organization_id: tokenData.organization_id,
        provider_access_token_encrypted: encryptDatabaseCredentials({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token
        }),
        metadata: {
          region: database.region,
          created_at: database.created_at
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'store_id'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save database connection: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'PlanetScale database connected successfully',
      data: {
        database_type: 'mysql',
        provider: 'planetscale',
        database_name: database.name,
        region: database.region
      }
    });
  } catch (error) {
    console.error('PlanetScale callback error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ========== DISCONNECT ROUTES ==========

/**
 * @route   POST /api/database-oauth/disconnect
 * @desc    Disconnect database provider
 * @access  Private (Store Owner)
 */
router.post('/disconnect', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check store ownership
    const { checkUserStoreAccess } = require('../utils/storeAccess');
    if (req.user.role !== 'admin') {
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Update database connection status
    const { error } = await masterDbClient
      .from('store_databases')
      .update({
        is_active: false,
        connection_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('store_id', store_id);

    if (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'Database disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
