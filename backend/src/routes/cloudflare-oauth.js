const express = require('express');
const router = express.Router();
const CloudflareOAuthService = require('../services/cloudflare-oauth-service');
const { authMiddleware } = require('../middleware/authMiddleware');

const oauthService = new CloudflareOAuthService();

/**
 * Initialize OAuth flow - generate authorization URL
 */
router.post('/authorize', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.body;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Validate OAuth configuration
    const configErrors = oauthService.validateConfig();
    if (configErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'OAuth configuration incomplete',
        errors: configErrors
      });
    }

    // Generate authorization URL
    const authUrl = oauthService.generateAuthUrl(store_id, [
      'zone:read',
      'zone_settings:edit',
      'zone_settings:read'
    ]);

    res.json({
      success: true,
      auth_url: authUrl,
      message: 'Authorization URL generated. Redirect user to this URL.'
    });
  } catch (error) {
    console.error('OAuth authorization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate authorization URL',
      error: error.message
    });
  }
});

/**
 * Handle OAuth callback - exchange code for token
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      console.error('OAuth callback error:', error, error_description);
      return res.redirect(`/admin/integrations/cloudflare?error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code || !state) {
      return res.redirect('/admin/integrations/cloudflare?error=Missing authorization code or state');
    }

    // Exchange code for token
    const tokenResult = await oauthService.exchangeCodeForToken(code, state);
    
    if (!tokenResult.success) {
      console.error('Token exchange failed:', tokenResult.error);
      return res.redirect(`/admin/integrations/cloudflare?error=${encodeURIComponent(tokenResult.error)}`);
    }

    // Store credentials
    const storeResult = await oauthService.storeCredentials(
      tokenResult.storeId,
      tokenResult.tokenData,
      tokenResult.zones?.[0]?.id // Use first zone as default
    );

    if (!storeResult.success) {
      console.error('Failed to store credentials:', storeResult.error);
      return res.redirect(`/admin/integrations/cloudflare?error=${encodeURIComponent(storeResult.error)}`);
    }

    // Success redirect
    const successParams = new URLSearchParams({
      success: 'true',
      zones: tokenResult.zones.length.toString(),
      user_email: tokenResult.userInfo?.email || 'Unknown'
    });

    res.redirect(`/admin/integrations/cloudflare?${successParams.toString()}`);
    
  } catch (error) {
    console.error('OAuth callback processing failed:', error);
    res.redirect(`/admin/integrations/cloudflare?error=${encodeURIComponent('Authentication failed. Please try again.')}`);
  }
});

/**
 * Get OAuth status for a store
 */
router.get('/status/:store_id', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.params;
    
    const credentials = await oauthService.getStoredCredentials(store_id);
    
    if (!credentials) {
      return res.json({
        success: true,
        connected: false,
        message: 'No Cloudflare connection found'
      });
    }

    // Get user info and zones
    const userInfo = await oauthService.getUserInfo(credentials.access_token);
    const zones = await oauthService.getUserZones(credentials.access_token);

    res.json({
      success: true,
      connected: true,
      user_info: userInfo,
      zones: zones,
      expires_at: credentials.expires_at,
      scope: credentials.scope
    });
    
  } catch (error) {
    console.error('Failed to get OAuth status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OAuth status',
      error: error.message
    });
  }
});

/**
 * Disconnect OAuth - revoke access
 */
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.body;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    const result = await oauthService.revokeAccess(store_id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cloudflare connection successfully disconnected'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect Cloudflare',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('OAuth disconnect failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect OAuth',
      error: error.message
    });
  }
});

/**
 * Test OAuth connection and get user zones
 */
router.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.body;
    
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    const credentials = await oauthService.getStoredCredentials(store_id);
    
    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: 'No Cloudflare connection found for this store'
      });
    }

    // Test API access
    const userInfo = await oauthService.getUserInfo(credentials.access_token);
    const zones = await oauthService.getUserZones(credentials.access_token);

    res.json({
      success: true,
      connection_test: {
        status: 'connected',
        user_email: userInfo?.email,
        zones_count: zones.length,
        zones: zones.slice(0, 5), // Limit to first 5 zones
        token_expires: new Date(credentials.expires_at).toISOString(),
        scope: credentials.scope
      }
    });
    
  } catch (error) {
    console.error('OAuth connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

/**
 * Update zone selection for a store
 */
router.post('/update-zone', authMiddleware, async (req, res) => {
  try {
    const { store_id, zone_id } = req.body;
    
    if (!store_id || !zone_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID and Zone ID are required'
      });
    }

    const IntegrationConfig = require('../models/IntegrationConfig');

    // Get existing config
    const existingConfig = await IntegrationConfig.findByStoreAndType(store_id, 'cloudflare');

    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        message: 'No Cloudflare integration found for this store'
      });
    }

    // Update zone ID in integration config
    const updatedConfigData = {
      ...existingConfig.config_data,
      zone_id: zone_id,
      updated_at: new Date().toISOString()
    };

    await IntegrationConfig.createOrUpdate(store_id, 'cloudflare', updatedConfigData);

    res.json({
      success: true,
      message: 'Zone selection updated successfully'
    });
    
  } catch (error) {
    console.error('Failed to update zone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update zone selection',
      error: error.message
    });
  }
});

/**
 * Get available zones for a store
 */
router.get('/zones/:store_id', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.params;
    
    const credentials = await oauthService.getStoredCredentials(store_id);
    
    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: 'No Cloudflare connection found'
      });
    }

    const zones = await oauthService.getUserZones(credentials.access_token);

    res.json({
      success: true,
      zones: zones
    });
    
  } catch (error) {
    console.error('Failed to get zones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get zones',
      error: error.message
    });
  }
});

/**
 * Get OAuth service configuration
 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const status = oauthService.getStatus();
    const configErrors = oauthService.validateConfig();
    
    res.json({
      success: true,
      config: status,
      errors: configErrors,
      ready: configErrors.length === 0
    });
  } catch (error) {
    console.error('Failed to get OAuth config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OAuth configuration',
      error: error.message
    });
  }
});

module.exports = router;