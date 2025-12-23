const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('./config/passport');
require('dotenv').config();

const { masterDbClient } = require('./database/masterConnection');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/authMiddleware'); // Use same middleware as authMasterTenant
const { buildStoreUrl } = require('./utils/domainConfig');

// Import all models to ensure associations are loaded (Master DB)
const models = require('./models');

// Import and start automatic migrations
require('./database/auto-migrations');

// Import services  
const extensionService = require('./services/extension-service');

// Import routes
const authRoutes = require('./routes/authMasterTenant'); // Use master-tenant auth (no store_id required for login)
const userRoutes = require('./routes/users');
const storeRoutes = require('./routes/stores');
const productRoutes = require('./routes/products');
const configurableProductRoutes = require('./routes/configurable-products');
const categoryRoutes = require('./routes/categories');
const publicProductRoutes = require('./routes/publicProducts');
const publicCategoryRoutes = require('./routes/publicCategories');
const publicShippingRoutes = require('./routes/publicShipping');
const publicDeliveryRoutes = require('./routes/publicDelivery');
const publicPaymentMethodRoutes = require('./routes/publicPaymentMethods');
const orderRoutes = require('./routes/orders');
const couponRoutes = require('./routes/coupons');
const attributeRoutes = require('./routes/attributes');
const cmsRoutes = require('./routes/cms');
const cmsBlockRoutes = require('./routes/cms-blocks');
const shippingRoutes = require('./routes/shipping');
const taxRoutes = require('./routes/tax');
const deliveryRoutes = require('./routes/delivery');
const customerRoutes = require('./routes/customers');
const blacklistRoutes = require('./routes/blacklist');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const languageRoutes = require('./routes/languages');
const translationRoutes = require('./routes/translations');
const aiWorkspaceRoutes = require('./routes/ai-workspace');
const aiPluginAssistantRoutes = require('./routes/ai-plugin-assistant');
const aiRoutes = require('./routes/ai'); // Centralized AI service
const aiModelsRoutes = require('./routes/ai-models'); // AI models configuration
const aiLearningRoutes = require('./routes/ai-learning'); // AI training & feedback
const migrationsRoutes = require('./routes/migrations');
// const diagnosticRoutes = require('./routes/diagnostic'); // Temporarily disabled
const customerActivityRoutes = require('./routes/customer-activity');
const abTestingRoutes = require('./routes/ab-testing');
const analyticsRoutes = require('./routes/analytics');
const analyticsDashboardRoutes = require('./routes/analytics-dashboard');
const gdprRoutes = require('./routes/gdpr');
const customAnalyticsEventsRoutes = require('./routes/custom-analytics-events');
const seoSettingsRoutes = require('./routes/seo-settings');
const seoTemplateRoutes = require('./routes/seo-templates');
const redirectRoutes = require('./routes/redirects');
const canonicalUrlRoutes = require('./routes/canonical-urls');
const attributeSetRoutes = require('./routes/attribute-sets');
const productLabelRoutes = require('./routes/product-labels');
const productTabRoutes = require('./routes/product-tabs');
const paymentRoutes = require('./routes/payments');
const paymentMethodRoutes = require('./routes/payment-methods');
const cookieConsentRoutes = require('./routes/cookie-consent-settings');
const consentLogRoutes = require('./routes/consent-logs');
const customOptionRuleRoutes = require('./routes/custom-option-rules');
const cacheTestRoutes = require('./routes/cache-test');

// Public route modules (lightweight, no auth)
const storefrontBootstrapRoutes = require('./routes/storefront-bootstrap');
const pageBootstrapRoutes = require('./routes/page-bootstrap');
const publicProductTabRoutes = require('./routes/publicProductTabs');
const publicProductLabelRoutes = require('./routes/publicProductLabels');
const themeDefaultsRoutes = require('./routes/theme-defaults');
const publicAttributeRoutes = require('./routes/publicAttributes');
const addressRoutes = require('./routes/addresses');
const publicCmsBlocksRoutes = require('./routes/public-cms-blocks');
const publicCmsPagesRoutes = require('./routes/public-cms-pages');
const publicCustomerAuthRoutes = require('./routes/public-customer-auth');
const storeTeamRoutes = require('./routes/store-teams');
const storePauseAccessRoutes = require('./routes/store-pause-access');
const robotsRoutes = require('./routes/robots');
const sitemapRoutes = require('./routes/sitemap');
const aiShoppingFeedsRoutes = require('./routes/ai-shopping-feeds');
const aiAgentApiRoutes = require('./routes/ai-agent-api');
const integrationRoutes = require('./routes/integrations');
const supabaseRoutes = require('./routes/supabase');
const supabaseSetupRoutes = require('./routes/supabase-setup');
const shopifyRoutes = require('./routes/shopify');
const amazonRoutes = require('./routes/amazon');
const ebayRoutes = require('./routes/ebay');
const metaCommerceRoutes = require('./routes/meta-commerce');
const imageRoutes = require('./routes/images');
const cloudflareOAuthRoutes = require('./routes/cloudflare-oauth');
const domainSettingsRoutes = require('./routes/domain-settings');
const pluginRoutes = require('./routes/plugins');
const storePluginRoutes = require('./routes/store-plugins');
const pluginCreationRoutes = require('./routes/plugin-creation');
const storageRoutes = require('./routes/storage');
const productImageRoutes = require('./routes/product-images');
const categoryImageRoutes = require('./routes/category-images');
const fileManagerRoutes = require('./routes/file-manager');
const sourceFilesRoutes = require('./routes/source-files');
const storeProvisioningRoutes = require('./routes/store-provisioning');
const domainsRoutes = require('./routes/domains');
const storeDatabaseRoutes = require('./routes/store-database');
const storeMediaStorageRoutes = require('./routes/store-mediastorage');
const heatmapRoutes = require('./routes/heatmap');
const backgroundJobRoutes = require('./routes/background-jobs');
const cronJobRoutes = require('./routes/cron-jobs');
const extensionsRoutes = require('./routes/extensions');
const previewRoutes = require('./routes/preview');
const slotConfigurationRoutes = require('./routes/slotConfigurations');
const dynamicPluginRoutes = require('./routes/dynamic-plugins');
const adminNavigationRoutes = require('./routes/admin-navigation');
const pluginApiRoutes = require('./routes/plugin-api');
const pluginVersionApiRoutes = require('./routes/plugin-version-api');
const pluginAIRoutes = require('./routes/pluginAIRoutes');
const chatApiRoutes = require('./routes/chat-api');
const databaseProvisioningRoutes = require('./routes/database-provisioning');
const databaseOAuthRoutes = require('./routes/database-oauth');
const customDomainsRoutes = require('./routes/custom-domains');
const creditRoutes = require('./routes/credits');
const serviceCreditCostsRoutes = require('./routes/service-credit-costs');
const emailTemplatesRoutes = require('./routes/email-templates');
const pdfTemplatesRoutes = require('./routes/pdf-templates');
const brevoOAuthRoutes = require('./routes/brevo-oauth');
const storefrontsRoutes = require('./routes/storefronts');
const demoDataRoutes = require('./routes/demo-data');

// Import usage tracking middleware
const {
  trackApiCall,
  trackApiError,
  checkUsageLimits
} = require('./middleware/usageTracking');

// Import subscription enforcement middleware
const {
  requireActiveSubscription,
  enforceReadOnly,
  checkResourceLimit,
  warnApproachingLimits
} = require('./middleware/subscriptionEnforcement');

const app = express();

// Trust proxy for Render.com
app.set('trust proxy', 1);

// Security middleware with exceptions for preview route
app.use((req, res, next) => {
  // Skip helmet for preview routes to allow iframe embedding
  if (req.path.startsWith('/preview/') || req.path.startsWith('/api/preview/')) {
    // Force override CSP headers for preview routes
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *; frame-src *; child-src *; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' *; style-src \'self\' \'unsafe-inline\' *; default-src *;');
    return next();
  }
  helmet()(req, res, next);
});
app.use(compression());

// Request timing and query count tracking
const { timingMiddleware } = require('./middleware/timingMiddleware');
app.use(timingMiddleware);

// Rate limiting - increased limits for development
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000, // Increased from 100 to 1000
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Optimize OPTIONS preflight requests - handle them early before CORS async logic
app.options('/api/*', async (req, res, next) => {
  // Get origin from request
  const origin = req.headers.origin;

  // Check if origin is allowed using centralized domain config (fast path - no DB lookup)
  if (origin) {
    const { isAllowedDomain } = require('./utils/domainConfig');
    try {
      const hostname = new URL(origin).hostname;
      if (isAllowedDomain(hostname)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,x-store-id,X-Store-Id,X-Language,x-session-id,X-Session-Id,Cache-Control,cache-control,Pragma,pragma,Expires,expires,params,headers,x-skip-transform,X-Skip-Transform');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Browser cache
        res.setHeader('Vary', 'Origin'); // Important for caching
        return res.sendStatus(204);
      }
    } catch (e) {
      console.warn('⚠️ OPTIONS origin parse error:', e.message);
    }
  }

  // Check for custom domains (async lookup to master DB)
  if (origin) {
    try {
      const { masterDbClient } = require('./database/masterConnection');
      const hostname = new URL(origin).hostname;

      // Check custom_domains table first
      const { data: lookupDomain, error: lookupError } = await masterDbClient
        .from('custom_domains_lookup')
        .select('store_id')
        .eq('domain', hostname)
        .eq('is_active', true)
        .eq('is_verified', true)
        .maybeSingle();

      if (lookupDomain) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,x-store-id,X-Store-Id,X-Language,x-session-id,X-Session-Id,Cache-Control,cache-control,Pragma,pragma,Expires,expires,params,headers,x-skip-transform,X-Skip-Transform');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Vary', 'Origin');
        return res.sendStatus(204);
      }
    } catch (error) {
      console.warn('⚠️ OPTIONS custom domain check failed:', error.message);
    }
  }

  // If not recognized origin, let CORS middleware handle it
  next();
});

// CORS configuration
// const allowedOrigins = [
//   'http://localhost:5173',
//   'http://localhost:3000',
//   'https://www.dainostore.com',
//   'https://dainostore.com',
//   'https://backend.dainostore.com', // Allow backend for preview pages
//   'https://daino.onrender.com', // Allow backend for preview pages
//   process.env.CORS_ORIGIN
// ].filter(Boolean);

// CORS configuration - centralized in corsUtils.js
const { getCorsOptions } = require('./utils/corsUtils');
app.use(cors(getCorsOptions()));

// Body parsing middleware
// IMPORTANT: Webhook endpoint needs raw body for signature verification
// CRITICAL: Raw body middleware MUST come BEFORE JSON parsing middleware

// Step 1: Apply raw body parser to webhook endpoint FIRST
app.use((req, res, next) => {
  // Check if this is the Stripe webhook endpoint (be flexible with the check)
  const isWebhook = req.originalUrl.includes('/webhook') || req.url.includes('/webhook') || req.path.includes('/webhook');

  if (isWebhook) {
    console.log('🔧 Using RAW body parser for webhook:', req.originalUrl);
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// URL encoded for all other routes
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site cookies in production
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use('/uploads', express.static('uploads'));

// Usage tracking middleware (must be after body parsers, before routes)
app.use(trackApiCall); // Track API usage for billing
app.use(trackApiError); // Track API errors
// Note: checkUsageLimits is applied selectively on routes that need it

// Custom domain resolution middleware (must be before routes)
const domainResolver = require('./middleware/domainResolver');
app.use(domainResolver);

// Health check endpoint (no DB required)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    nodeVersion: process.version
  });
});

// Database health check endpoint (uses Supabase REST API)
app.get('/health/db', async (req, res) => {
  try {
    // Test master database connection via Supabase REST API
    if (!masterDbClient) {
      throw new Error('masterDbClient not initialized');
    }

    const { error } = await masterDbClient.from('stores').select('id').limit(1);
    if (error) {
      throw new Error(error.message);
    }

    res.json({
      status: 'OK',
      database: 'Connected',
      connection_type: 'Supabase REST API',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Redis cache health check endpoint
app.get('/health/cache', async (req, res) => {
  try {
    const { isRedisConnected, getRedisInfo } = require('./config/redis');
    const { getStats } = require('./utils/cacheManager');

    const redisInfo = getRedisInfo();
    const stats = await getStats();

    res.json({
      status: 'OK',
      redis: {
        connected: isRedisConnected(),
        ...redisInfo
      },
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/auth', authRoutes); // Original auth.js (modified for master-tenant)
app.use('/api/cache-test', cacheTestRoutes);

// Public routes for guest access
app.use('/api/public/auth', authRoutes);
app.use('/api/public/auth', publicCustomerAuthRoutes); // Forgot password, reset password (separate router)
app.use('/api/public/storefront/bootstrap', storefrontBootstrapRoutes); // Unified storefront initialization endpoint
app.use('/api/public/page-bootstrap', pageBootstrapRoutes); // Page-specific bootstrap (product, category, checkout, homepage)
app.use('/api/public/stores', storeRoutes);
app.use('/api/public/products', publicProductRoutes);
app.use('/api/public/categories', publicCategoryRoutes);
app.use('/api/public/shipping', publicShippingRoutes);
app.use('/api/public/tax', taxRoutes);
app.use('/api/public/delivery', publicDeliveryRoutes);
app.use('/api/public/attributes', publicAttributeRoutes);
app.use('/api/public/coupons', couponRoutes);
app.use('/api/public/product-labels', publicProductLabelRoutes);
app.use('/api/public/theme-defaults', themeDefaultsRoutes);
app.use('/api/theme-defaults', themeDefaultsRoutes); // Authenticated routes for creating user themes
app.use('/api/public/attribute-sets', attributeSetRoutes);
app.use('/api/public/seo-templates', seoTemplateRoutes);
app.use('/api/public/seo-settings', seoSettingsRoutes);
app.use('/api/public/cookie-consent-settings', cookieConsentRoutes);
app.use('/api/public/pause-access', storePauseAccessRoutes); // Public endpoints for pause access requests
// Use dedicated working route for public CMS blocks
app.use('/api/public/cms-blocks', publicCmsBlocksRoutes);
app.use('/api/public/cms-pages', publicCmsPagesRoutes);
app.use('/api/public/product-tabs', publicProductTabRoutes);
app.use('/api/public/custom-option-rules', customOptionRuleRoutes);
app.use('/api/public/payment-methods', publicPaymentMethodRoutes);
// Robots.txt serving route
app.use('/api/robots', robotsRoutes);
// Sitemap.xml serving route
app.use('/api/sitemap', sitemapRoutes);

// AI Shopping Feeds and Agent API
app.use('/api/public/feeds', aiShoppingFeedsRoutes);
app.use('/api/ai-agent', aiAgentApiRoutes);
// Public preview routes (no authentication required)
app.use('/api/preview', previewRoutes);

// Store-specific robots.txt route (for multi-store)
app.get('/public/:storeSlug/robots.txt', async (req, res) => {
  try {
    const { masterDbClient } = require('./database/masterConnection');
    const ConnectionManager = require('./services/database/ConnectionManager');
    const { storeSlug } = req.params;

    // Find store by slug from master DB
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('slug', storeSlug)
      .single();

    if (storeError || !store) {
      console.warn(`[Robots] Store not found for slug: ${storeSlug}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('# Store not found\nUser-agent: *\nDisallow: /');
    }

    // Find SEO settings for the store from tenant DB
    const tenantDb = await ConnectionManager.getStoreConnection(store.id);
    const { data: seoSettings } = await tenantDb
      .from('seo_settings')
      .select('*')
      .eq('store_id', store.id)
      .single();

    let robotsContent = '';

    if (seoSettings && seoSettings.robots_txt_content) {
      robotsContent = seoSettings.robots_txt_content;
    } else {
      // Default robots.txt content with store-specific sitemap
      const baseUrl = await buildStoreUrl({
        tenantDb,
        storeId: store.id,
        storeSlug: store.slug
      });
      robotsContent = `User-agent: *
Allow: /

# Allow content directories (default behavior)
Allow: /products/
Allow: /categories/
Allow: /cms-pages/

# Block admin and system paths
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /login

Sitemap: ${baseUrl}/sitemap.xml`;
    }

    // Set proper content-type and headers for robots.txt
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'X-Robots-Tag': 'noindex' // Don't index the robots.txt URL itself
    });

    res.send(robotsContent);
  } catch (error) {
    console.error('[Robots] Error serving store robots.txt:', error);
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }).send(`User-agent: *
Allow: /
Disallow: /admin/`);
  }
});

// Standard robots.txt route (for default store or custom domain)
app.get('/robots.txt', async (req, res) => {
  try {
    const { masterDbClient } = require('./database/masterConnection');
    const ConnectionManager = require('./services/database/ConnectionManager');

    // Check if request came from custom domain (set by domainResolver middleware)
    let targetStoreSlug = req.storeSlug;
    let store = null;

    // If not from custom domain, get the first active store as default
    if (!targetStoreSlug) {
      const { data: defaultStore, error: defaultStoreError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (defaultStoreError || !defaultStore) {
        return res.set({
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }).send(`User-agent: *
Allow: /
Disallow: /admin/`);
      }

      targetStoreSlug = defaultStore.slug;
      store = defaultStore;
    } else {
      // Find store by slug for custom domain
      const { data: storeData, error: storeError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('slug', targetStoreSlug)
        .single();

      if (storeError || !storeData) {
        console.warn(`[Robots] Store not found for slug: ${targetStoreSlug}`);
        return res.status(404).set({
          'Content-Type': 'text/plain; charset=utf-8'
        }).send('# Store not found\nUser-agent: *\nDisallow: /');
      }

      store = storeData;
    }

    if (!store) {
      console.warn(`[Robots] Store not found for slug: ${targetStoreSlug}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('# Store not found\nUser-agent: *\nDisallow: /');
    }

    // Find SEO settings for the store from tenant DB
    const tenantDb = await ConnectionManager.getStoreConnection(store.id);
    const { data: seoSettings } = await tenantDb
      .from('seo_settings')
      .select('*')
      .eq('store_id', store.id)
      .single();

    let robotsContent = '';

    if (seoSettings && seoSettings.robots_txt_content) {
      robotsContent = seoSettings.robots_txt_content;
    } else {
      // Default robots.txt content with store-specific sitemap
      const baseUrl = await buildStoreUrl({
        tenantDb,
        storeId: store.id,
        storeSlug: store.slug
      });
      robotsContent = `User-agent: *
Allow: /

# Allow content directories (default behavior)
Allow: /products/
Allow: /categories/
Allow: /cms-pages/

# Block admin and system paths
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /login

Sitemap: ${baseUrl}/sitemap.xml`;
    }

    // Set proper content-type and headers for robots.txt
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'X-Robots-Tag': 'noindex' // Don't index the robots.txt URL itself
    });

    res.send(robotsContent);
  } catch (error) {
    console.error('[Robots] Error serving default robots.txt:', error);
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }).send(`User-agent: *
Allow: /
Disallow: /admin/`);
  }
});

// Standard sitemap.xml route (for default store or custom domain)
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { masterDbClient } = require('./database/masterConnection');
    const { generateSitemapXml } = require('./routes/sitemap');

    // Check if request came from custom domain (set by domainResolver middleware)
    let targetStoreSlug = req.storeSlug;
    let store = null;

    // If not from custom domain, get the first active store as default
    if (!targetStoreSlug) {
      const { data: defaultStore, error: defaultStoreError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (defaultStoreError || !defaultStore) {
        return res.status(404).set({
          'Content-Type': 'text/plain; charset=utf-8'
        }).send('No active store found');
      }

      targetStoreSlug = defaultStore.slug;
      store = defaultStore;
    } else {
      // Find store by slug for custom domain
      const { data: storeData, error: storeError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('slug', targetStoreSlug)
        .single();

      if (storeError || !storeData) {
        console.warn(`[Sitemap] Store not found for slug: ${targetStoreSlug}`);
        return res.status(404).set({
          'Content-Type': 'text/plain; charset=utf-8'
        }).send('Store not found');
      }

      store = storeData;
    }

    if (!store) {
      console.warn(`[Sitemap] Store not found for slug: ${targetStoreSlug}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('Store not found');
    }

    // Get tenant connection for custom domain lookup
    const ConnectionManager = require('./services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getConnection(store.id);

    // Determine base URL (checks custom_domains table)
    const baseUrl = await buildStoreUrl({
      tenantDb,
      storeId: store.id,
      storeSlug: store.slug
    });

    // Generate sitemap
    const sitemapXml = await generateSitemapXml(store.id, baseUrl);

    if (!sitemapXml) {
      console.log(`[Sitemap] Sitemap disabled for store: ${targetStoreSlug}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('Sitemap is disabled for this store');
    }

    // Set proper content-type and headers for XML
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-Robots-Tag': 'noindex' // Don't index the sitemap URL itself
    });

    res.send(sitemapXml);
  } catch (error) {
    console.error('[Sitemap] Error serving default sitemap.xml:', error);
    res.status(500).set({
      'Content-Type': 'text/plain; charset=utf-8'
    }).send('Error generating sitemap');
  }
});

// Public store-specific sitemap.xml route
app.get('/public/:storeSlug/sitemap.xml', async (req, res) => {
  try {
    const { masterDbClient } = require('./database/masterConnection');
    const { generateSitemapXml } = require('./routes/sitemap');
    const { storeSlug } = req.params;

    // Find store by slug
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('slug', storeSlug)
      .single();

    if (storeError || !store) {
      console.warn(`[Sitemap] Store not found for slug: ${storeSlug}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('Store not found');
    }

    // Get tenant connection for custom domain lookup
    const ConnectionManager = require('./services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getConnection(store.id);

    // Determine base URL (checks custom_domains table)
    const baseUrl = await buildStoreUrl({
      tenantDb,
      storeId: store.id,
      storeSlug: store.slug
    });

    // Generate sitemap
    const sitemapXml = await generateSitemapXml(store.id, baseUrl);

    if (!sitemapXml) {
      console.log(`[Sitemap] Sitemap disabled for store: ${storeSlug}`);
      return res.status(404).set({
        'Content-Type': 'text/plain; charset=utf-8'
      }).send('Sitemap is disabled for this store');
    }

    // Set proper content-type and headers for XML
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-Robots-Tag': 'noindex' // Don't index the sitemap URL itself
    });

    res.send(sitemapXml);
  } catch (error) {
    console.error('[Sitemap] Error serving public sitemap.xml:', error);
    res.status(500).set({
      'Content-Type': 'text/plain; charset=utf-8'
    }).send('Error generating sitemap');
  }
});

// Authenticated routes
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/configurable-products', configurableProductRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api', slotConfigurationRoutes); // Slot configurations for cart layout

// Public order lookup by payment reference (MUST be before authenticated routes)
app.get('/api/orders/by-payment-reference/:payment_reference', async (req, res) => {
  try {
    const { payment_reference } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!payment_reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Use ConnectionManager for tenant database
    const ConnectionManager = require('./services/database/ConnectionManager');
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find order by payment reference
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('payment_reference', payment_reference)
      .maybeSingle();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch order'
      });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get order items (product info is stored directly in the item)
    const { data: orderItems, error: itemsError } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError) {
      console.warn('Error fetching order items:', itemsError);
    }

    // Get store info from master DB
    const { getMasterStore } = require('./utils/dbHelpers');
    const store = await getMasterStore(store_id);

    const orderWithDetails = {
      ...order,
      Store: store ? { id: store.id, name: store.name } : null,
      OrderItems: orderItems || []
    };

    res.json({
      success: true,
      data: orderWithDetails
    });
  } catch (error) {
    console.error('Get order by payment reference error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Register public order endpoints BEFORE auth middleware
const publicOrderRouter = express.Router();

// Import the finalization logic from orders.js
const { Order, OrderItem, Product, Customer } = require('./models'); // Tenant DB models
const { Op } = require('sequelize');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Public endpoint: Finalize order (called from OrderSuccess page)
publicOrderRouter.post('/finalize-order', async (req, res) => {
  try {
    const { session_id } = req.body;
    const store_id = req.headers['x-store-id'] || req.body.store_id;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'session_id is required'
      });
    }

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Use ConnectionManager for tenant database
    const ConnectionManager = require('./services/database/ConnectionManager');
    const { getMasterStore } = require('./utils/dbHelpers');
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find the order by payment reference
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .or(`payment_reference.eq.${session_id},stripe_session_id.eq.${session_id}`)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if already finalized
    if (order.status === 'processing' && order.payment_status === 'paid') {
      return res.json({
        success: true,
        message: 'Order already finalized',
        data: { order_id: order.id, already_finalized: true }
      });
    }

    // Get the store from master DB
    const store = await getMasterStore(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Verify payment with Stripe
    const stripeOptions = store.stripe_account_id ? { stripeAccount: store.stripe_account_id } : undefined;

    try {
      const session = stripeOptions
        ? await stripe.checkout.sessions.retrieve(session_id, stripeOptions)
        : await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== 'paid') {
        return res.json({
          success: false,
          message: 'Payment not yet completed',
          data: { payment_status: session.payment_status }
        });
      }
    } catch (stripeError) {
      return res.status(400).json({
        success: false,
        message: 'Failed to verify payment with Stripe',
        error: stripeError.message
      });
    }

    // Update order status
    const { error: updateError } = await tenantDb
      .from('sales_orders')
      .update({
        status: 'processing',
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Email is handled by Stripe webhook
    console.log('📧 Email sending disabled in finalize-order - Stripe webhook will handle emails');

    res.json({
      success: true,
      message: 'Order finalized successfully',
      data: {
        order_id: order.id,
        order_number: order.order_number,
        status: 'processing',
        payment_status: 'paid'
      }
    });

  } catch (error) {
    console.error('Finalize order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finalize order',
      error: error.message
    });
  }
});

// Register public order endpoints without auth
app.use('/api/orders', publicOrderRouter);

// Now register authenticated order routes
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/coupons', authMiddleware, couponRoutes);
app.use('/api/attributes', authMiddleware, attributeRoutes);
app.use('/api/cms-pages', authMiddleware, cmsRoutes);
app.use('/api/cms-blocks', authMiddleware, cmsBlockRoutes);
app.use('/api/shipping', authMiddleware, shippingRoutes);
app.use('/api/tax', authMiddleware, taxRoutes);
app.use('/api/delivery', authMiddleware, deliveryRoutes);

// New endpoint routes
app.use('/api/customers', customerRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/translations', translationRoutes);
// app.use('/api/diagnostic', diagnosticRoutes); // Temporarily disabled
app.use('/api/migrations', migrationsRoutes); // Database migrations
app.use('/api/ai', aiRoutes); // Centralized AI service (new unified system)
app.use('/api/ai', aiWorkspaceRoutes);
app.use('/api/ai', aiPluginAssistantRoutes); // AI Plugin Assistant for no-code and developer modes
app.use('/api/ai-models', aiModelsRoutes); // AI models configuration (public endpoint)
app.use('/api/ai-learning', aiLearningRoutes); // AI training, feedback, and documentation management
app.use('/api/plugins/ai', pluginAIRoutes); // Claude API integration for plugin generation
app.use('/api/customer-activity', customerActivityRoutes);
app.use('/api/ab-testing', abTestingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics-dashboard', analyticsDashboardRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/custom-analytics-events', customAnalyticsEventsRoutes);
app.use('/api/seo-settings', seoSettingsRoutes);
app.use('/api/seo-templates', seoTemplateRoutes);
app.use('/api/redirects', redirectRoutes);
app.use('/api/canonical-urls', canonicalUrlRoutes);
app.use('/api/attribute-sets', attributeSetRoutes);
app.use('/api/product-labels', productLabelRoutes);
app.use('/api/product-tabs', productTabRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment-methods', authMiddleware, paymentMethodRoutes);
app.use('/api/cookie-consent-settings', authMiddleware, cookieConsentRoutes);
app.use('/api/consent-logs', authMiddleware, consentLogRoutes);
app.use('/api/custom-option-rules', authMiddleware, customOptionRuleRoutes);
app.use('/api/addresses', addressRoutes);
// CMS blocks route moved to line 1522 with correct /api/public/cms-blocks path

// Public invitation endpoint (no auth required) - must be before authMiddleware
app.get('/api/invitations/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { masterDbClient } = require('./database/masterConnection');

    // Find invitation in master DB
    const { data: invitation, error: inviteError } = await masterDbClient
      .from('store_invitations')
      .select('id, store_id, invited_email, invited_by, role, message, expires_at, status, created_at')
      .eq('invitation_token', token)
      .maybeSingle();

    if (inviteError || !invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This invitation has expired' });
    }

    if (invitation.status !== 'pending') {
      return res.status(410).json({ success: false, message: 'This invitation has already been used' });
    }

    // Get store info from master DB
    const { data: store } = await masterDbClient
      .from('stores')
      .select('id, name, domain')
      .eq('id', invitation.store_id)
      .single();

    // Get store name from tenant DB (that's where the actual name is stored)
    let tenantStoreName = null;
    try {
      const ConnectionManager = require('./services/database/ConnectionManager');
      const tenantDb = await ConnectionManager.getStoreConnection(invitation.store_id);
      const { data: tenantStore } = await tenantDb
        .from('stores')
        .select('name')
        .eq('id', invitation.store_id)
        .maybeSingle();
      tenantStoreName = tenantStore?.name;
    } catch (err) {
      console.warn('Could not fetch tenant store name:', err.message);
    }

    // Get inviter info
    let inviter = null;
    if (invitation.invited_by) {
      const { data: inviterInfo } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('id', invitation.invited_by)
        .single();
      inviter = inviterInfo;
    }

    // Check if user already exists with this email
    const { data: existingUser } = await masterDbClient
      .from('users')
      .select('id')
      .eq('email', invitation.invited_email)
      .maybeSingle();

    // Ensure store has a name (prefer tenant name, then master name, then domain)
    const storeData = {
      id: store?.id || invitation.store_id,
      name: tenantStoreName || store?.name || store?.domain || 'Your Store',
      domain: store?.domain || ''
    };

    res.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.invited_email,
        role: invitation.role,
        message: invitation.message,
        expires_at: invitation.expires_at,
        store: storeData,
        inviter,
        userExists: !!existingUser
      }
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Public invitation accept with auth (signup/login + accept in one step)
app.post('/api/invitations/:token/accept-with-auth', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, firstName, lastName } = req.body;
    const { masterDbClient } = require('./database/masterConnection');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    // Find invitation
    const { data: invitation, error: inviteError } = await masterDbClient
      .from('store_invitations')
      .select('*')
      .eq('invitation_token', token)
      .maybeSingle();

    if (inviteError || !invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This invitation has expired' });
    }

    if (invitation.status !== 'pending') {
      return res.status(410).json({ success: false, message: 'This invitation has already been used' });
    }

    // Check if user exists
    const { data: existingUser } = await masterDbClient
      .from('users')
      .select('*')
      .eq('email', invitation.invited_email)
      .maybeSingle();

    let user;

    if (existingUser) {
      // Login flow - verify password
      const validPassword = await bcrypt.compare(password, existingUser.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }
      user = existingUser;
    } else {
      // Signup flow - create new account
      if (!firstName) {
        return res.status(400).json({ success: false, message: 'First name is required for new accounts' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const { data: newUser, error: createError } = await masterDbClient
        .from('users')
        .insert({
          email: invitation.invited_email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName || '',
          role: 'store_owner',
          account_type: 'agency',
          is_active: true,
          email_verified: true, // Auto-verify since they're accepting invitation
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ success: false, message: 'Failed to create account' });
      }

      user = newUser;
    }

    // Now accept the invitation - add to store_teams (in master DB)
    // Check if already a member
    const { data: existingMember } = await masterDbClient
      .from('store_teams')
      .select('id')
      .eq('store_id', invitation.store_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      // Already a member, just update invitation status
      await masterDbClient
        .from('store_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
    } else {
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

      // Add as team member to master DB
      const { error: memberError } = await masterDbClient
        .from('store_teams')
        .insert({
          store_id: invitation.store_id,
          user_id: user.id,
          role: invitation.role,
          permissions: permissions,
          invited_by: invitation.invited_by,
          invited_at: invitation.created_at,
          accepted_at: new Date().toISOString(),
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (memberError) {
        console.error('Error adding team member:', memberError);
        return res.status(500).json({ success: false, message: 'Failed to add to team' });
      }

      // Update invitation status
      await masterDbClient
        .from('store_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        account_type: user.account_type,
        store_id: invitation.store_id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token
    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          account_type: user.account_type
        },
        store_id: invitation.store_id
      }
    });

  } catch (error) {
    console.error('Accept invitation with auth error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.use('/api/store-teams', authMiddleware, storeTeamRoutes);
app.use('/api/pause-access', storePauseAccessRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/supabase', supabaseSetupRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/amazon', amazonRoutes);
app.use('/api/ebay', ebayRoutes);
app.use('/api/meta-commerce', metaCommerceRoutes);
app.use('/api/database-provisioning', authMiddleware, databaseProvisioningRoutes); // Master DB: provisioning, subscriptions, billing
app.use('/api/database-oauth', databaseOAuthRoutes); // Database OAuth: Neon, PlanetScale
app.use('/api/custom-domains', customDomainsRoutes); // Custom domain management: DNS verification, SSL provisioning
app.use('/api/images', authMiddleware, imageRoutes);
app.use('/api/cloudflare/oauth', cloudflareOAuthRoutes);
app.use('/api/admin', adminNavigationRoutes); // Dynamic navigation API (Plugin Architecture Phase 1)
app.use('/api/plugins', pluginApiRoutes); // Modern plugin system: widgets, marketplace, purchases (Plugin Architecture Phase 1)
app.use('/api/plugins', pluginVersionApiRoutes); // Plugin version control: git-like versioning, snapshots, patches, rollback
app.use('/api/plugins', pluginRoutes); // Core plugin management: install, uninstall, enable, disable, delete (must be after pluginApiRoutes due to /:name catch-all)
app.use('/api/stores/:store_id/plugins', storePluginRoutes); // Store-specific plugin routes (enable/disable/configure)
app.use('/api/stores/:store_id/plugins/create', pluginCreationRoutes);
app.use('/api/plugins', dynamicPluginRoutes.router);
app.use('/api/chat', chatApiRoutes); // Customer service chat plugin API
app.use('/api/storage', storageRoutes); // Main storage routes for File Library
app.use('/api/stores/:store_id/products', productImageRoutes);
app.use('/api/stores/:store_id/categories', categoryImageRoutes);
app.use('/api/file-manager', fileManagerRoutes);
app.use('/api/source-files', sourceFilesRoutes);
app.use('/api/store-provisioning', storeProvisioningRoutes);
app.use('/api/stores/:store_id/domains', domainsRoutes);
app.use('/api/stores', domainSettingsRoutes); // Domain settings for Store -> Settings -> Domain
app.use('/api/heatmap', heatmapRoutes); // Add heatmap routes (public tracking, auth for analytics) - MUST come before broad /api middleware
app.use('/api/background-jobs', backgroundJobRoutes); // Background job management routes

// Admin scripts (cron-protected endpoints for running maintenance tasks)
const adminScriptsRoutes = require('./routes/admin-scripts');
app.use('/api/admin', adminScriptsRoutes);
app.use('/api/cron-jobs', cronJobRoutes); // Dynamic cron job management routes
app.use('/api/extensions', extensionsRoutes); // Modern extension system API with hook-based architecture
app.use('/api/slot-configurations', slotConfigurationRoutes); // Slot configuration versioning API
app.use('/api/storefronts', storefrontsRoutes); // Multiple storefronts per store (themes, campaigns)
// Master-Tenant Architecture Routes (NEW - replaces old systems)
const storesMasterTenantRoutes = require('./routes/storesMasterTenant');
const creditsMasterTenantRoutes = require('./routes/creditsMasterTenant');
const testMasterDbRoutes = require('./routes/testMasterDb');

app.use('/api/stores', storesMasterTenantRoutes); // Master-tenant store management (auth handled in routes)
app.use('/api/stores', authMiddleware, demoDataRoutes); // Demo data provisioning and restoration
app.use('/api/credits', creditsMasterTenantRoutes); // Master-tenant credits (replaces old)
app.use('/api/test', testMasterDbRoutes); // Test endpoint for master DB
app.use('/api/test-master-connection', require('./routes/test-master-connection')); // Test Sequelize connection

app.use('/api/service-credit-costs', serviceCreditCostsRoutes); // Service credit costs management (admin)
app.use('/api/email-templates', emailTemplatesRoutes); // Email template management with translations
app.use('/api/pdf-templates', pdfTemplatesRoutes); // PDF template management for invoices, shipments
app.use('/api/brevo', brevoOAuthRoutes); // Brevo email service OAuth and configuration
// Conditional auth middleware that excludes preview and public routes
const conditionalAuthMiddleware = (req, res, next) => {
  // Skip authentication for preview routes, public routes, and auth routes
  // Note: req.path here is the path AFTER '/api' is stripped (e.g., /auth/customer/login)
  if (req.path.startsWith('/api/preview') || req.path.startsWith('/public') || req.path.startsWith('/auth')) {
    return next();
  }
  return authMiddleware(req, res, next);
};

app.use('/api', conditionalAuthMiddleware, storeDatabaseRoutes); // Add store database routes
app.use('/api', conditionalAuthMiddleware, storeMediaStorageRoutes); // Add media storage routes

// Preview route for serving content with customizations
// Server-side patch rendering for preview
app.get('/preview/:storeId', async (req, res) => {
  // Set headers to allow iframe embedding and prevent caching
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *;");
  res.removeHeader('X-Content-Type-Options');
  
  try {
    const { storeId } = req.params;
    const { fileName, patches = 'true', storeSlug, pageName: providedPageName } = req.query;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName query parameter is required' });
    }

    // Get store information
    const Store = require('./models/Store'); // Master/Tenant hybrid model
    const store = await Store.findByPk(storeId);

    if (!store) {
      return res.status(404).json({
        error: 'Store not found',
        storeId,
        message: `Store with ID "${storeId}" not found`
      });
    }

    const actualStoreSlug = storeSlug || store.slug || 'store';

    // Get current published version for this store
    const currentVersionResult = await extensionService.getCurrentVersion(storeId);
    const hasExtensions = currentVersionResult.success && currentVersionResult.version;

    // Redirect to main application
    const publicStoreBaseUrl = process.env.PUBLIC_STORE_BASE_URL || 'https://www.dainostore.com';
    const routePath = '';

    // Add extension system parameters instead of patches
    const queryParams = new URLSearchParams({
      extensions: 'true',
      storeId: storeId,
      fileName: fileName,
      preview: 'true',
      _t: Date.now()
    });

    const extensionPreviewUrl = `${publicStoreBaseUrl}/public/${actualStoreSlug}/${routePath}?${queryParams.toString()}`;

    return res.redirect(302, extensionPreviewUrl);

  } catch (error) {
    res.status(500).json({
      error: 'Preview failed',
      message: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log('[404 HANDLER] Not found:', req.method, req.originalUrl, 'Path:', req.path);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Database connection and server startup
const startServer = async () => {
  // Start HTTP server first (for health checks)
  const server = app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');

    // Close Redis connection
    try {
      const { closeRedis } = require('./config/redis');
      await closeRedis();
    } catch (error) {
      console.error('Error closing Redis:', error);
    }

    server.close(() => {
      console.log('Process terminated');
    });
  });

  // Connect to database after server is running
  try {

    // Test Supabase REST API connection (primary connection method)
    try {
      if (masterDbClient) {
        const { error } = await masterDbClient.from('stores').select('id').limit(1);
        if (error) {
          console.warn('⚠️ Master database connection failed:', error.message);
        } else {
          console.log('✅ Master database connected via Supabase REST API');
        }
      } else {
        console.warn('⚠️ masterDbClient not initialized');
      }
    } catch (dbError) {
      console.warn('⚠️ Master database connection failed:', dbError.message);
    }

    // Initialize Redis cache
    try {
      const { initRedis } = require('./config/redis');
      await initRedis();
      console.log('✅ Redis cache initialized');
    } catch (error) {
      console.warn('⚠️  Redis initialization failed, continuing without cache:', error.message);
    }

    // Initialize Plugin Manager
    try {
      const pluginManager = require('./core/PluginManager');
      await pluginManager.initialize();
    } catch (error) {
      console.warn('Plugin Manager initialization failed:', error.message);
    }

    // Initialize Background Job Manager
    try {
      const jobManager = require('./core/BackgroundJobManager');
      await jobManager.initialize();

      // Initialize Akeneo Scheduler Integration
      const akeneoSchedulerIntegration = require('./services/akeneo-scheduler-integration');
      await akeneoSchedulerIntegration.initialize();

    } catch (error) {
      console.warn('Background Job Manager initialization failed:', error.message);
    }

    // Run all pending database migrations automatically
    try {
      const { runPendingMigrations } = require('../sql_deprecated/migration-tracker');
      const migrationResult = await runPendingMigrations();

      if (!migrationResult.success && migrationResult.error) {
        console.warn('Some database migrations failed:', migrationResult.error);
      }
    } catch (migrationError) {
      console.warn('Database migration warning:', migrationError.message);
    }

  } catch (error) {
    console.error('Server startup error:', error.message);
  }
};

startServer();

module.exports = app;