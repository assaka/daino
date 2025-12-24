# Instagram Shopping Integration Plan

Export products to Instagram Shopping via Meta Commerce Manager catalog sync.

## Overview

Integrate with Meta Commerce API to sync products to a Facebook/Instagram catalog, enabling Instagram Shopping tags on posts and the Instagram Shop tab.

---

## Prerequisites (You need to do this first)

### Create Meta App at developers.facebook.com:
1. Go to https://developers.facebook.com/apps/
2. Click "Create App" → Select "Business" type
3. Add products: **Facebook Login** + **Marketing API** (for Catalog access)
4. In App Settings → Basic: Copy **App ID** and **App Secret**
5. In Facebook Login → Settings: Add OAuth redirect URI (your backend callback URL)
6. Request permissions: `catalog_management`, `business_management`

### Add to your `.env`:
```bash
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_OAUTH_REDIRECT_URI=https://your-backend.com/api/meta-commerce/auth/callback
```

---

## How to Access

### Navigation Options:
1. **Marketplace Hub** → Instagram tab: `/admin/marketplace-hub`
2. **Direct page**: `/admin/integrations/instagram-shopping`

### Usage Flow:
1. Navigate to **Marketplace Hub** and click the **Instagram** tab (or go directly to the Instagram Shopping page)
2. Click **"Go to Instagram Shopping"** button
3. Click **"Connect with Facebook"** to start OAuth flow
4. Select your **Business Account** from the dropdown
5. Select or create a **Product Catalog**
6. Configure sync settings (optional)
7. Click **"Sync All Products"** to push products to Instagram

### Features:
- **Connection Tab**: Connect/disconnect Meta Business account
- **Catalog Tab**: Select business account and product catalog
- **Settings Tab**: Configure sync options, default brand, currency
- **Sync Tab**: Trigger manual product sync or schedule background jobs
- **Errors Tab**: View products that failed validation or sync

---

## Architecture Overview

```
+-------------------+     +--------------------+     +-------------------------+
|  Admin UI         |---->|  Backend API       |---->|  Meta Commerce API      |
|  (React)          |     |  (Express)         |     |  (Graph API v18.0)      |
+-------------------+     +--------------------+     +-------------------------+
        |                         |                          |
        |                         v                          |
        |                 +--------------------+             |
        |                 |  Background Jobs   |<------------+
        |                 |  (Bull Queue)      |
        |                 +--------------------+
        |                         |
        +-------------------------+--------> IntegrationConfig (DB)
```

---

## Files to Create

### 1. Backend Service: `backend/src/services/meta-commerce-service.js`

```javascript
const crypto = require('crypto');
const axios = require('axios');
const IntegrationConfig = require('../models/IntegrationConfig');

class MetaCommerceService {
  constructor(storeId) {
    this.storeId = storeId;
    this.integration = null;
    this.graphApiVersion = 'v18.0';
    this.graphApiBaseUrl = 'https://graph.facebook.com';
    this.appId = process.env.META_APP_ID;
    this.appSecret = process.env.META_APP_SECRET;
    this.redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  }

  // ==================== OAuth Methods ====================

  generateState() {
    // Generate encrypted state with storeId and timestamp
    const payload = JSON.stringify({
      storeId: this.storeId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    });
    // Encrypt with app secret
    return Buffer.from(payload).toString('base64');
  }

  verifyState(state) {
    // Decrypt and verify state, check expiration (10 min)
  }

  generateAuthUrl() {
    const state = this.generateState();
    const scopes = [
      'catalog_management',
      'business_management',
      'pages_read_engagement',
      'instagram_basic'
    ].join(',');

    return {
      url: `https://www.facebook.com/${this.graphApiVersion}/dialog/oauth?` +
        `client_id=${this.appId}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `scope=${scopes}&` +
        `state=${state}&` +
        `response_type=code`,
      state
    };
  }

  async exchangeCodeForToken(code) {
    // Exchange authorization code for access token
    const response = await axios.get(
      `${this.graphApiBaseUrl}/${this.graphApiVersion}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          redirect_uri: this.redirectUri,
          client_secret: this.appSecret,
          code
        }
      }
    );
    return response.data; // { access_token, token_type, expires_in }
  }

  async exchangeForLongLivedToken(shortLivedToken) {
    // Exchange short-lived token for long-lived token (60 days)
    const response = await axios.get(
      `${this.graphApiBaseUrl}/${this.graphApiVersion}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken
        }
      }
    );
    return response.data;
  }

  async revokeAccess() {
    // Revoke access token and clear integration config
  }

  // ==================== Business & Catalog Methods ====================

  async getBusinessAccounts() {
    // GET /me/businesses
    const response = await this.graphRequest('/me/businesses', {
      fields: 'id,name,profile_picture_uri'
    });
    return response.data;
  }

  async getCatalogs(businessId) {
    // GET /{business_id}/owned_product_catalogs
    const response = await this.graphRequest(`/${businessId}/owned_product_catalogs`, {
      fields: 'id,name,product_count,vertical'
    });
    return response.data;
  }

  async createCatalog(businessId, name) {
    // POST /{business_id}/owned_product_catalogs
    const response = await this.graphRequest(`/${businessId}/owned_product_catalogs`, {}, 'POST', {
      name,
      vertical: 'commerce'
    });
    return response;
  }

  async selectCatalog(catalogId, catalogName) {
    // Save selected catalog to integration config
    await this.updateConfig({
      catalogId,
      catalogName
    });
  }

  // ==================== Product Sync Methods ====================

  async initialize() {
    this.integration = await IntegrationConfig.findByStoreAndType(
      this.storeId,
      'meta-commerce'
    );
    if (!this.integration) {
      throw new Error('Meta Commerce integration not configured');
    }
  }

  async syncProducts(productIds = null, options = {}) {
    const { progressCallback, dryRun = false } = options;

    // 1. Fetch products from database
    const products = await this.fetchProducts(productIds);

    // 2. Transform to Meta format
    const metaProducts = products.map(p => this.transformProduct(p));

    // 3. Validate products
    const { valid, invalid } = this.validateProducts(metaProducts);

    // 4. Batch upload to Meta
    if (!dryRun && valid.length > 0) {
      await this.batchUploadProducts(valid, progressCallback);
    }

    return {
      total: products.length,
      successful: valid.length,
      failed: invalid.length,
      errors: invalid
    };
  }

  transformProduct(product) {
    // Transform store product to Meta catalog format
    const domain = this.integration.config_data.storeDomain;

    return {
      retailer_id: product.sku,
      title: product.name.substring(0, 150),
      description: (product.description || '').substring(0, 5000),
      availability: product.stock_quantity > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      price: `${product.price} ${this.integration.config_data.currency || 'USD'}`,
      sale_price: product.compare_price
        ? `${product.compare_price} ${this.integration.config_data.currency || 'USD'}`
        : undefined,
      link: `https://${domain}/products/${product.slug}`,
      image_link: product.images?.[0]?.url,
      additional_image_link: product.images?.slice(1, 10).map(i => i.url),
      brand: this.integration.config_data.defaultBrand || domain,
      inventory: product.stock_quantity
    };
  }

  validateProduct(product) {
    const errors = [];
    if (!product.retailer_id) errors.push('Missing SKU (retailer_id)');
    if (!product.title) errors.push('Missing title');
    if (!product.price) errors.push('Missing price');
    if (!product.image_link) errors.push('Missing primary image');
    if (!product.link) errors.push('Missing product URL');
    return { valid: errors.length === 0, errors };
  }

  async batchUploadProducts(products, progressCallback) {
    const catalogId = this.integration.config_data.catalogId;
    const batchSize = 500; // Meta allows up to 500 items per batch

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const requests = batch.map(p => ({
        method: 'UPDATE', // CREATE or UPDATE - UPDATE handles both
        retailer_id: p.retailer_id,
        data: p
      }));

      await this.graphRequest(`/${catalogId}/items_batch`, {}, 'POST', {
        requests: JSON.stringify(requests)
      });

      if (progressCallback) {
        progressCallback({
          stage: 'uploading',
          current: Math.min(i + batchSize, products.length),
          total: products.length
        });
      }
    }
  }

  // ==================== Helper Methods ====================

  async graphRequest(endpoint, params = {}, method = 'GET', data = null) {
    const url = `${this.graphApiBaseUrl}${endpoint}`;
    const config = {
      method,
      url,
      params: {
        ...params,
        access_token: this.integration.config_data.accessToken
      }
    };
    if (data) config.data = data;

    const response = await axios(config);
    return response.data;
  }

  async updateConfig(updates) {
    const config = this.integration.config_data || {};
    await IntegrationConfig.createOrUpdate(this.storeId, 'meta-commerce', {
      ...config,
      ...updates
    });
  }

  async getSyncStatus() {
    return {
      connected: !!this.integration?.config_data?.accessToken,
      catalogId: this.integration?.config_data?.catalogId,
      catalogName: this.integration?.config_data?.catalogName,
      lastSyncAt: this.integration?.last_sync_at,
      syncStatus: this.integration?.sync_status,
      syncError: this.integration?.sync_error
    };
  }
}

module.exports = MetaCommerceService;
```

---

### 2. API Routes: `backend/src/routes/meta-commerce.js`

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const storeResolver = require('../middleware/storeResolver');
const MetaCommerceService = require('../services/meta-commerce-service');
const IntegrationConfig = require('../models/IntegrationConfig');
const BackgroundJobManager = require('../core/BackgroundJobManager');

// Apply middleware
router.use(authMiddleware);
router.use(storeResolver);

// ==================== OAuth Endpoints ====================

// Get OAuth authorization URL
router.post('/auth/url', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    const { url, state } = service.generateAuthUrl();

    // Store state temporarily for verification
    await IntegrationConfig.createOrUpdate(req.storeId, 'meta-commerce', {
      pendingState: state,
      pendingStateExpires: Date.now() + 600000 // 10 minutes
    });

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback (typically called by redirect, but could be AJAX)
router.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/admin/integrations/instagram-shopping?error=${error}`);
    }

    // Verify state and get storeId
    const integration = await IntegrationConfig.findByPendingState(state);
    if (!integration) {
      return res.redirect('/admin/integrations/instagram-shopping?error=invalid_state');
    }

    const service = new MetaCommerceService(integration.store_id);

    // Exchange code for token
    const tokenData = await service.exchangeCodeForToken(code);

    // Exchange for long-lived token
    const longLivedToken = await service.exchangeForLongLivedToken(tokenData.access_token);

    // Save tokens
    await IntegrationConfig.createOrUpdate(integration.store_id, 'meta-commerce', {
      accessToken: longLivedToken.access_token,
      tokenExpiresAt: Date.now() + (longLivedToken.expires_in * 1000),
      pendingState: null,
      pendingStateExpires: null
    });

    await IntegrationConfig.updateConnectionStatus(
      integration.id,
      integration.store_id,
      'connected'
    );

    res.redirect('/admin/integrations/instagram-shopping?success=connected');
  } catch (error) {
    console.error('Meta OAuth callback error:', error);
    res.redirect(`/admin/integrations/instagram-shopping?error=${encodeURIComponent(error.message)}`);
  }
});

// Disconnect
router.post('/auth/disconnect', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();
    await service.revokeAccess();

    await IntegrationConfig.deleteByStoreAndType(req.storeId, 'meta-commerce');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Configuration Endpoints ====================

// Get connection status
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
      businessName: integration.config_data?.businessName,
      lastSyncAt: integration.last_sync_at,
      syncStatus: integration.sync_status,
      tokenExpires: integration.config_data?.tokenExpiresAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get full config (masked sensitive fields)
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

    res.json({ configured: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save config
router.post('/save-config', async (req, res) => {
  try {
    const { syncSettings, defaultBrand, storeDomain, currency } = req.body;

    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    if (!integration) {
      return res.status(400).json({ error: 'Integration not connected' });
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
    res.status(500).json({ error: error.message });
  }
});

// ==================== Business & Catalog Endpoints ====================

// Get available business accounts
router.get('/businesses', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const businesses = await service.getBusinessAccounts();
    res.json({ businesses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get catalogs for selected business
router.get('/catalogs', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const businessId = service.integration.config_data?.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'No business selected' });
    }

    const catalogs = await service.getCatalogs(businessId);
    res.json({ catalogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new catalog
router.post('/catalogs', async (req, res) => {
  try {
    const { name } = req.body;

    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const businessId = service.integration.config_data?.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'No business selected' });
    }

    const catalog = await service.createCatalog(businessId, name);
    res.json({ catalog });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Select business
router.put('/businesses/select', async (req, res) => {
  try {
    const { businessId, businessName } = req.body;

    await IntegrationConfig.createOrUpdate(req.storeId, 'meta-commerce', {
      businessId,
      businessName
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Select catalog
router.put('/catalogs/select', async (req, res) => {
  try {
    const { catalogId, catalogName } = req.body;

    const service = new MetaCommerceService(req.storeId);
    await service.initialize();
    await service.selectCatalog(catalogId, catalogName);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Sync Endpoints ====================

// Schedule sync job
router.post('/sync-job', async (req, res) => {
  try {
    const { productIds } = req.body;

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

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
router.get('/sync/status', async (req, res) => {
  try {
    const service = new MetaCommerceService(req.storeId);
    await service.initialize();

    const status = await service.getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product errors
router.get('/products/errors', async (req, res) => {
  try {
    const integration = await IntegrationConfig.findByStoreAndType(
      req.storeId,
      'meta-commerce'
    );

    const errors = integration?.config_data?.productErrors || [];
    res.json({ errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

### 3. Background Job: `backend/src/core/jobs/MetaCommerceSyncJob.js`

```javascript
const BaseJobHandler = require('./BaseJobHandler');
const MetaCommerceService = require('../../services/meta-commerce-service');
const IntegrationConfig = require('../../models/IntegrationConfig');

class MetaCommerceSyncJob extends BaseJobHandler {
  async execute() {
    const { storeId, productIds, options = {} } = this.job.payload;

    this.log(`Starting Meta Commerce sync for store ${storeId}`);
    await this.updateProgress(5, 'Initializing Meta Commerce connection...');

    // Update sync status to 'syncing'
    const integration = await IntegrationConfig.findByStoreAndType(storeId, 'meta-commerce');
    await IntegrationConfig.updateSyncStatus(integration.id, storeId, 'syncing');

    try {
      const service = new MetaCommerceService(storeId);
      await service.initialize();

      await this.updateProgress(10, 'Connection established, fetching products...');

      const result = await service.syncProducts(productIds, {
        ...options,
        progressCallback: async (progress) => {
          await this.checkAbort();

          let progressPercent = 10;
          if (progress.stage === 'fetching') {
            progressPercent = 10 + (progress.current / progress.total * 20);
          } else if (progress.stage === 'transforming') {
            progressPercent = 30 + (progress.current / progress.total * 30);
          } else if (progress.stage === 'uploading') {
            progressPercent = 60 + (progress.current / progress.total * 35);
          }

          await this.updateProgress(
            Math.round(progressPercent),
            progress.item ? `${progress.stage}: ${progress.item}` : progress.stage
          );
        }
      });

      // Update sync status
      await IntegrationConfig.updateSyncStatus(
        integration.id,
        storeId,
        result.failed > 0 ? 'partial' : 'success'
      );

      // Store errors if any
      if (result.errors && result.errors.length > 0) {
        await IntegrationConfig.createOrUpdate(storeId, 'meta-commerce', {
          ...integration.config_data,
          productErrors: result.errors,
          statistics: {
            ...integration.config_data?.statistics,
            totalProducts: result.total,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: result.failed > 0 ? 'partial' : 'success',
            lastSyncErrors: result.failed
          }
        });
      }

      await this.updateProgress(100, 'Sync completed');
      this.log(`Sync complete: ${result.successful} successful, ${result.failed} failed`);

      return result;

    } catch (error) {
      // Update sync status to error
      await IntegrationConfig.updateSyncStatus(
        integration.id,
        storeId,
        'error',
        error.message
      );
      throw error;
    }
  }
}

module.exports = MetaCommerceSyncJob;
```

---

### 4. Frontend Page: `src/pages/admin/InstagramShopping.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Tabs, Tab, Button, Alert, Badge, Spinner,
  Form, Select, Input, Table
} from '../../components/ui';
import { MetaCommerce } from '../../api/meta-commerce';
import { Instagram, Link, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const InstagramShopping = () => {
  const [activeTab, setActiveTab] = useState('connection');
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        MetaCommerce.getStatus(),
        MetaCommerce.getConfig()
      ]);
      setStatus(statusRes);
      setConfig(configRes.config);

      if (statusRes.connected) {
        loadBusinesses();
        loadErrors();
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    try {
      const { url } = await MetaCommerce.getAuthUrl();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Instagram Shopping?')) return;
    try {
      await MetaCommerce.disconnect();
      setStatus({ connected: false });
      setConfig(null);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      const { businesses } = await MetaCommerce.getBusinesses();
      setBusinesses(businesses);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    }
  };

  const loadCatalogs = async () => {
    try {
      const { catalogs } = await MetaCommerce.getCatalogs();
      setCatalogs(catalogs);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
    }
  };

  const handleSelectBusiness = async (businessId) => {
    const business = businesses.find(b => b.id === businessId);
    await MetaCommerce.selectBusiness(businessId, business?.name);
    loadCatalogs();
  };

  const handleSelectCatalog = async (catalogId) => {
    const catalog = catalogs.find(c => c.id === catalogId);
    await MetaCommerce.selectCatalog(catalogId, catalog?.name);
    loadStatus();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { jobId } = await MetaCommerce.scheduleSyncJob({});
      // Poll for job status or redirect to jobs page
      alert(`Sync job started: ${jobId}`);
    } catch (error) {
      console.error('Failed to start sync:', error);
    }
    setSyncing(false);
  };

  const loadErrors = async () => {
    try {
      const { errors } = await MetaCommerce.getProductErrors();
      setErrors(errors);
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Instagram className="w-8 h-8" />
        <h1 className="text-2xl font-bold">Instagram Shopping</h1>
        {status?.connected && (
          <Badge variant="success">Connected</Badge>
        )}
      </div>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="connection">Connection</Tab>
        <Tab value="catalog" disabled={!status?.connected}>Catalog</Tab>
        <Tab value="settings" disabled={!status?.connected}>Settings</Tab>
        <Tab value="sync" disabled={!status?.catalogId}>Sync</Tab>
        <Tab value="errors" disabled={!status?.catalogId}>Errors</Tab>
      </Tabs>

      <div className="mt-6">
        {activeTab === 'connection' && (
          <Card>
            <Card.Header>
              <Card.Title>Meta Business Connection</Card.Title>
            </Card.Header>
            <Card.Content>
              {!status?.connected ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    Connect your Meta Business account to sync products to Instagram Shopping.
                  </p>
                  <Button onClick={handleConnect}>
                    <Link className="w-4 h-4 mr-2" />
                    Connect with Facebook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">Connected to {status.businessName}</p>
                        <p className="text-sm text-gray-600">
                          Catalog: {status.catalogName || 'Not selected'}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </div>

                  {status.lastSyncAt && (
                    <p className="text-sm text-gray-600">
                      Last sync: {new Date(status.lastSyncAt).toLocaleString()}
                      {status.syncStatus && ` (${status.syncStatus})`}
                    </p>
                  )}
                </div>
              )}
            </Card.Content>
          </Card>
        )}

        {activeTab === 'catalog' && (
          <Card>
            <Card.Header>
              <Card.Title>Select Product Catalog</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <Form.Group>
                  <Form.Label>Business Account</Form.Label>
                  <Select
                    value={config?.businessId}
                    onChange={(e) => handleSelectBusiness(e.target.value)}
                  >
                    <option value="">Select a business...</option>
                    {businesses.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </Select>
                </Form.Group>

                {config?.businessId && (
                  <Form.Group>
                    <Form.Label>Product Catalog</Form.Label>
                    <Select
                      value={config?.catalogId}
                      onChange={(e) => handleSelectCatalog(e.target.value)}
                    >
                      <option value="">Select a catalog...</option>
                      {catalogs.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.product_count} products)
                        </option>
                      ))}
                    </Select>
                  </Form.Group>
                )}
              </div>
            </Card.Content>
          </Card>
        )}

        {activeTab === 'sync' && (
          <Card>
            <Card.Header>
              <Card.Title>Sync Products</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Sync your products to the Instagram Shopping catalog.
                  Products must have a SKU, title, price, and at least one image.
                </p>

                <Button
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync All Products
                    </>
                  )}
                </Button>

                {status?.lastSyncAt && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium">Last Sync</p>
                    <p className="text-sm text-gray-600">
                      {new Date(status.lastSyncAt).toLocaleString()}
                    </p>
                    <p className="text-sm">
                      Status: <Badge variant={
                        status.syncStatus === 'success' ? 'success' :
                        status.syncStatus === 'error' ? 'destructive' : 'warning'
                      }>{status.syncStatus}</Badge>
                    </p>
                  </div>
                )}
              </div>
            </Card.Content>
          </Card>
        )}

        {activeTab === 'errors' && (
          <Card>
            <Card.Header>
              <Card.Title>Product Errors</Card.Title>
            </Card.Header>
            <Card.Content>
              {errors.length === 0 ? (
                <p className="text-gray-600 text-center py-4">
                  No errors found. All products synced successfully.
                </p>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>SKU</Table.Head>
                      <Table.Head>Error</Table.Head>
                      <Table.Head>Time</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {errors.map((error, i) => (
                      <Table.Row key={i}>
                        <Table.Cell>{error.retailerId}</Table.Cell>
                        <Table.Cell>
                          <span className="text-red-600">{error.errorMessage}</span>
                        </Table.Cell>
                        <Table.Cell>
                          {new Date(error.timestamp).toLocaleString()}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Card.Content>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InstagramShopping;
```

---

### 5. Frontend API Client: `src/api/meta-commerce.js`

```javascript
import apiClient from './client';

export const MetaCommerce = {
  // OAuth
  getAuthUrl: () => apiClient.post('meta-commerce/auth/url'),
  disconnect: () => apiClient.post('meta-commerce/auth/disconnect'),

  // Configuration
  getStatus: () => apiClient.get('meta-commerce/status'),
  getConfig: () => apiClient.get('meta-commerce/config'),
  saveConfig: (config) => apiClient.post('meta-commerce/save-config', config),

  // Business & Catalogs
  getBusinesses: () => apiClient.get('meta-commerce/businesses'),
  getCatalogs: () => apiClient.get('meta-commerce/catalogs'),
  createCatalog: (data) => apiClient.post('meta-commerce/catalogs', data),
  selectBusiness: (businessId, businessName) =>
    apiClient.put('meta-commerce/businesses/select', { businessId, businessName }),
  selectCatalog: (catalogId, catalogName) =>
    apiClient.put('meta-commerce/catalogs/select', { catalogId, catalogName }),

  // Sync
  syncProducts: (productIds) => apiClient.post('meta-commerce/sync/products', { productIds }),
  scheduleSyncJob: (options) => apiClient.post('meta-commerce/sync-job', options),
  getSyncStatus: () => apiClient.get('meta-commerce/sync/status'),

  // Product Status
  getProductStatus: (params) => apiClient.get('meta-commerce/products/status', { params }),
  getProductErrors: () => apiClient.get('meta-commerce/products/errors')
};
```

---

## Files to Modify

### 1. `backend/src/models/IntegrationConfig.js`

Add to `getSensitiveFields()`:

```javascript
static getSensitiveFields(integrationType) {
  const sensitiveFields = {
    // ... existing entries ...
    'meta-commerce': ['accessToken', 'refreshToken'],
    'instagram-shopping': ['accessToken', 'refreshToken']
  };
  return sensitiveFields[integrationType] || [];
}
```

### 2. `backend/src/core/BackgroundJobManager.js`

Add to `registerJobTypes()`:

```javascript
registerJobTypes() {
  const jobTypes = [
    // ... existing entries ...
    ['meta-commerce:sync:products', './jobs/MetaCommerceSyncJob'],
  ];
  // ...
}
```

### 3. `backend/src/index.js` or route registration

```javascript
const metaCommerceRoutes = require('./routes/meta-commerce');
app.use('/api/meta-commerce', metaCommerceRoutes);
```

### 4. Admin Navigation (e.g., `src/components/layouts/AdminSidebar.jsx`)

```javascript
{
  name: 'Instagram Shopping',
  icon: Instagram,
  path: '/admin/integrations/instagram-shopping'
}
```

---

## Product Data Mapping

| Store Field | Meta Catalog Field | Notes |
|-------------|-------------------|-------|
| `sku` | `retailer_id` | Required, unique identifier |
| `name` (translation) | `title` | Max 150 characters |
| `description` (translation) | `description` | Max 5000 characters |
| `price` | `price` | Format: "29.99 USD" |
| `compare_price` | `sale_price` | Original price if on sale |
| `stock_quantity` | `availability` | "in stock" / "out of stock" |
| `stock_quantity` | `inventory` | Numeric quantity |
| `images[0].url` | `image_link` | Min 500x500px, required |
| `images[1+].url` | `additional_image_link` | Up to 9 additional |
| `slug` + domain | `link` | Product page URL |
| config default | `brand` | Required for Shopping |
| `"new"` | `condition` | new/refurbished/used |

---

## Implementation Order

1. **Service**: Create `meta-commerce-service.js` with OAuth + catalog methods
2. **Routes**: Create API routes, register in Express
3. **Config**: Update IntegrationConfig sensitive fields
4. **Job**: Create background sync job, register in BackgroundJobManager
5. **Frontend**: Create admin page + API client
6. **Navigation**: Add menu entry
7. **Testing**: Test OAuth flow and product sync

---

## Key Patterns to Follow (Reference Files)

| Pattern | Reference File |
|---------|---------------|
| OAuth flow | `backend/src/services/cloudflare-oauth-service.js` |
| Export service | `backend/src/services/amazon-export-service.js` |
| Routes structure | `backend/src/routes/integrations.js` |
| Background job | `backend/src/core/jobs/AmazonExportProductsJob.js` |
| Admin page | `src/pages/admin/SeoSocial.jsx` |

---

## Error Categories

```javascript
const ERROR_CATEGORIES = {
  AUTH: 'authentication_error',      // OAuth/token issues
  PERMISSION: 'permission_error',    // Missing scopes/access
  CATALOG: 'catalog_error',          // Catalog not found/inaccessible
  PRODUCT: 'product_error',          // Individual product validation
  RATE_LIMIT: 'rate_limit_error',    // Meta API rate limits
  NETWORK: 'network_error',          // Connection issues
  UNKNOWN: 'unknown_error'
};
```

---

## Meta Graph API Reference

- **Base URL**: `https://graph.facebook.com/v18.0`
- **OAuth**: `https://www.facebook.com/v18.0/dialog/oauth`
- **Catalog Batch**: `POST /{catalog_id}/items_batch`
- **Rate Limits**: ~200 calls per hour per user token
- **Batch Size**: Up to 500 items per batch request
