const express = require('express');
const router = express.Router();
const MetaCommerceService = require('../services/meta-commerce-service');
const IntegrationConfig = require('../models/IntegrationConfig');
const { authMiddleware } = require('../middleware/authMiddleware');
const { storeResolver } = require('../middleware/storeResolver');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(storeResolver);

// ==================== OAuth Endpoints ====================

/**
 * Get OAuth authorization URL
 * POST /api/meta-commerce/auth/url
 */
router.post('/auth/url', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    const { url, state } = service.generateAuthUrl();

    // Store state temporarily for verification
    await IntegrationConfig.createOrUpdate(req.storeId, 'meta-commerce', {
      pendingState: state,
      pendingStateExpires: Date.now() + 600000 // 10 minutes
    });

    res.json({ success: true, url });
  } catch (error) {
    console.error('Meta Commerce auth URL error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * OAuth callback handler
 * GET /api/meta-commerce/auth/callback
 */
router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`/admin/marketplace-hub?error=${oauthError}`);
    }

    if (!code || !state) {
      return res.redirect('/admin/marketplace-hub?error=missing_params');
    }

    // Find integration by pending state
    // We need to decode the state to get the storeId
    const service = new MetaCommerceService(null);
    const decoded = service.verifyState(state);

    if (!decoded || !decoded.storeId) {
      return res.redirect('/admin/marketplace-hub?error=invalid_state');
    }

    const storeId = decoded.storeId;

    // Verify the pending state matches
    const integration = await IntegrationConfig.findByStoreAndType(storeId, 'meta-commerce');
    if (!integration || integration.config_data?.pendingState !== state) {
      return res.redirect('/admin/marketplace-hub?error=state_mismatch');
    }

    // Check if state is expired
    if (integration.config_data?.pendingStateExpires < Date.now()) {
      return res.redirect('/admin/marketplace-hub?error=state_expired');
    }

    // Exchange code for token
    const storeService = new MetaCommerceService(storeId);
    const tokenData = await storeService.exchangeCodeForToken(code);

    // Exchange for long-lived token
    const longLivedToken = await storeService.exchangeForLongLivedToken(tokenData.access_token);

    // Save tokens and clear pending state
    await IntegrationConfig.createOrUpdate(storeId, 'meta-commerce', {
      accessToken: longLivedToken.access_token,
      tokenExpiresAt: Date.now() + (longLivedToken.expires_in * 1000),
      pendingState: null,
      pendingStateExpires: null
    });

    // Update connection status
    await IntegrationConfig.updateConnectionStatus(
      integration.id,
      storeId,
      'connected'
    );

    res.redirect('/admin/marketplace-hub?success=connected');
  } catch (error) {
    console.error('Meta OAuth callback error:', error);
    res.redirect(`/admin/marketplace-hub?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Disconnect integration
 * POST /api/meta-commerce/auth/disconnect
 */
router.post('/auth/disconnect', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);

    try {
      await service.initialize();
      await service.revokeAccess();
    } catch (initError) {
      // Continue even if not initialized
    }

    // Delete the integration config
    await IntegrationConfig.deleteByStoreAndType(req.storeId, 'meta-commerce');

    res.json({ success: true });
  } catch (error) {
    console.error('Meta Commerce disconnect error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Configuration Endpoints ====================

/**
 * Get connection status
 * GET /api/meta-commerce/status
 */
router.get('/status', async (req, res) => {
  try {
    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({
      connected: integration.connection_status === 'connected',
      connectionStatus: integration.connection_status,
      catalogId: integration.config_data?.catalogId,
      catalogName: integration.config_data?.catalogName,
      businessId: integration.config_data?.businessId,
      businessName: integration.config_data?.businessName,
      lastSyncAt: integration.last_sync_at,
      syncStatus: integration.sync_status,
      tokenExpires: integration.config_data?.tokenExpiresAt
    });
  } catch (error) {
    console.error('Meta Commerce status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get configuration (masked sensitive fields)
 * GET /api/meta-commerce/config
 */
router.get('/config', async (req, res) => {
  try {
    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    if (!integration) {
      return res.json({ configured: false });
    }

    const config = { ...integration.config_data };

    // Mask sensitive fields
    if (config.accessToken) config.accessToken = '••••••••';
    if (config.pendingState) delete config.pendingState;
    if (config.pendingStateExpires) delete config.pendingStateExpires;

    res.json({ configured: true, config });
  } catch (error) {
    console.error('Meta Commerce config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Save configuration
 * POST /api/meta-commerce/save-config
 */
router.post('/save-config', async (req, res) => {
  try {
    const { syncSettings, defaultBrand, storeDomain, currency } = req.body;

    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    if (!integration) {
      return res.status(400).json({ success: false, error: 'Integration not connected' });
    }

    await IntegrationConfig.createOrUpdate(req.storeId, 'meta-commerce', {
      ...integration.config_data,
      syncSettings,
      defaultBrand,
      storeDomain,
      currency
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Meta Commerce save config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test connection
 * POST /api/meta-commerce/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();
    const result = await service.testConnection();

    res.json(result);
  } catch (error) {
    console.error('Meta Commerce test connection error:', error);
    res.json({ success: false, error: error.message });
  }
});

// ==================== Business & Catalog Endpoints ====================

/**
 * Get available business accounts
 * GET /api/meta-commerce/businesses
 */
router.get('/businesses', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const businesses = await service.getBusinessAccounts();
    res.json({ success: true, businesses });
  } catch (error) {
    console.error('Meta Commerce businesses error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Select business account
 * PUT /api/meta-commerce/businesses/select
 */
router.put('/businesses/select', async (req, res) => {
  try {
    const { businessId, businessName } = req.body;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business ID is required' });
    }

    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    if (!integration) {
      return res.status(400).json({ success: false, error: 'Integration not connected' });
    }

    await IntegrationConfig.createOrUpdate(req.storeId, 'meta-commerce', {
      ...integration.config_data,
      businessId,
      businessName,
      // Clear catalog selection when business changes
      catalogId: null,
      catalogName: null
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Meta Commerce select business error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get catalogs for selected business
 * GET /api/meta-commerce/catalogs
 */
router.get('/catalogs', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const businessId = service.integration.config_data?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'No business selected' });
    }

    const catalogs = await service.getCatalogs(businessId);
    res.json({ success: true, catalogs });
  } catch (error) {
    console.error('Meta Commerce catalogs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create new catalog
 * POST /api/meta-commerce/catalogs
 */
router.post('/catalogs', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Catalog name is required' });
    }

    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const businessId = service.integration.config_data?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'No business selected' });
    }

    const catalog = await service.createCatalog(businessId, name);
    res.json({ success: true, catalog });
  } catch (error) {
    console.error('Meta Commerce create catalog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Select catalog
 * PUT /api/meta-commerce/catalogs/select
 */
router.put('/catalogs/select', async (req, res) => {
  try {
    const { catalogId, catalogName } = req.body;

    if (!catalogId) {
      return res.status(400).json({ success: false, error: 'Catalog ID is required' });
    }

    const service = new MetaCommerceService(req.storeId);
    await service.initialize();
    await service.selectCatalog(catalogId, catalogName);

    res.json({ success: true });
  } catch (error) {
    console.error('Meta Commerce select catalog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Sync Endpoints ====================

/**
 * Schedule sync job
 * POST /api/meta-commerce/sync-job
 */
router.post('/sync-job', async (req, res) => {
  try {
    const { productIds } = req.body;

    // Import BackgroundJobManager here to avoid circular dependency
    const BackgroundJobManager = require('../core/BackgroundJobManager');
    const jobManager = BackgroundJobManager.getInstance();

    const job = await jobManager.addJob({
      type: 'meta-commerce:sync:products',
      payload: {
        storeId: req.storeId,
        productIds,
        userId: req.user.id
      },
      storeId: req.storeId,
      userId: req.user.id,
      priority: 5,
      description: 'Sync products to Instagram Shopping'
    });

    res.json({ success: true, jobId: job.id, status: 'queued' });
  } catch (error) {
    console.error('Meta Commerce sync job error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sync products (foreground - for small batches)
 * POST /api/meta-commerce/sync
 */
router.post('/sync', async (req, res) => {
  try {
    const { productIds, dryRun } = req.body;

    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    // Update sync status
    if (service.integration) {
      await IntegrationConfig.updateSyncStatus(
        service.integration.id,
        req.storeId,
        'syncing'
      );
    }

    const result = await service.syncProducts(productIds, { dryRun });

    // Update sync status
    if (service.integration) {
      await IntegrationConfig.updateSyncStatus(
        service.integration.id,
        req.storeId,
        result.failed > 0 ? 'partial' : 'success'
      );
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Meta Commerce sync error:', error);

    // Update sync status on error
    try {
      const integration = await IntegrationConfig.findByStoreAndType(req.storeId, 'meta-commerce');
      if (integration) {
        await IntegrationConfig.updateSyncStatus(
          integration.id,
          req.storeId,
          'error',
          error.message
        );
      }
    } catch (statusError) {
      console.error('Failed to update sync status:', statusError);
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get sync status
 * GET /api/meta-commerce/sync/status
 */
router.get('/sync/status', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const status = await service.getSyncStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Meta Commerce sync status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get product errors
 * GET /api/meta-commerce/products/errors
 */
router.get('/products/errors', async (req, res) => {
  try {
    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    const errors = integration?.config_data?.productErrors || [];
    res.json({ success: true, errors });
  } catch (error) {
    console.error('Meta Commerce product errors error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
