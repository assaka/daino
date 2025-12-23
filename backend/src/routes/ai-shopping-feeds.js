const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const AIShoppingFeedGenerator = require('../services/ai-shopping-feed-generator');
const { applyProductTranslationsToMany, fetchProductImages } = require('../utils/productHelpers');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { wrap, generateKey, DEFAULT_TTL } = require('../utils/cacheManager');

const router = express.Router();

const FEED_CACHE_TTL = 3600; // 1 hour

/**
 * Get store context from request
 */
async function getStoreContext(req) {
  const storeId = req.headers['x-store-id'] || req.query.store_id;
  if (!storeId) {
    throw new Error('Store ID required');
  }

  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Get store info
  const { data: store } = await tenantDb
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  const baseUrl = store?.domain || `https://${store?.subdomain || 'store'}.example.com`;

  return { storeId, tenantDb, store, baseUrl };
}

/**
 * Get products for feed with translations and images
 */
async function getProductsForFeed(tenantDb, storeId, language = 'en') {
  // Fetch active, visible products
  const { data: products, error } = await tenantDb
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .eq('visibility', 'visible')
    .order('created_at', { ascending: false })
    .limit(5000); // Feed limit

  if (error) throw error;

  // Apply translations
  let enrichedProducts = await applyProductTranslationsToMany(products || [], tenantDb, language);

  // Apply images
  enrichedProducts = await fetchProductImages(enrichedProducts, tenantDb);

  return enrichedProducts;
}

/**
 * @route   GET /api/public/feeds/google-merchant
 * @desc    Google Merchant Center XML feed
 * @access  Public
 */
router.get('/google-merchant', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';

    // Check cache
    const cacheKey = generateKey('feed', 'google', storeId, language);
    const cached = await wrap(cacheKey, null, 0); // Check only
    if (cached) {
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(cached);
    }

    const products = await getProductsForFeed(tenantDb, storeId, language);
    const generator = new AIShoppingFeedGenerator(baseUrl, store?.currency || 'USD');
    const xml = generator.generateGoogleFeed(products, {
      storeName: store?.name,
      description: `Product feed for ${store?.name || 'Store'}`
    });

    // Cache result
    await wrap(cacheKey, async () => xml, FEED_CACHE_TTL);

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Google feed error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to generate Google feed' });
  }
});

/**
 * @route   GET /api/public/feeds/microsoft-merchant
 * @desc    Microsoft Merchant Center XML feed
 * @access  Public
 */
router.get('/microsoft-merchant', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';

    const cacheKey = generateKey('feed', 'microsoft', storeId, language);
    const cached = await wrap(cacheKey, null, 0);
    if (cached) {
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(cached);
    }

    const products = await getProductsForFeed(tenantDb, storeId, language);
    const generator = new AIShoppingFeedGenerator(baseUrl, store?.currency || 'USD');
    const xml = generator.generateMicrosoftFeed(products, {
      storeName: store?.name,
      description: `Product feed for ${store?.name || 'Store'}`
    });

    await wrap(cacheKey, async () => xml, FEED_CACHE_TTL);

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Microsoft feed error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to generate Microsoft feed' });
  }
});

/**
 * @route   GET /api/public/feeds/chatgpt
 * @desc    ChatGPT/OpenAI compatible JSON feed
 * @access  Public
 */
router.get('/chatgpt', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';

    const cacheKey = generateKey('feed', 'chatgpt', storeId, language);
    const cached = await wrap(cacheKey, null, 0);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(typeof cached === 'string' ? JSON.parse(cached) : cached);
    }

    const products = await getProductsForFeed(tenantDb, storeId, language);
    const generator = new AIShoppingFeedGenerator(baseUrl, store?.currency || 'USD');
    const feed = generator.generateChatGPTFeed(products, store);

    await wrap(cacheKey, async () => JSON.stringify(feed), FEED_CACHE_TTL);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(feed);
  } catch (error) {
    console.error('ChatGPT feed error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to generate ChatGPT feed' });
  }
});

/**
 * @route   GET /api/public/feeds/universal
 * @desc    Universal AI feed (Schema.org based JSON)
 * @access  Public
 */
router.get('/universal', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';

    const cacheKey = generateKey('feed', 'universal', storeId, language);
    const cached = await wrap(cacheKey, null, 0);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.json(typeof cached === 'string' ? JSON.parse(cached) : cached);
    }

    const products = await getProductsForFeed(tenantDb, storeId, language);
    const generator = new AIShoppingFeedGenerator(baseUrl, store?.currency || 'USD');
    const feed = generator.generateUniversalFeed(products, store);

    await wrap(cacheKey, async () => JSON.stringify(feed), FEED_CACHE_TTL);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json(feed);
  } catch (error) {
    console.error('Universal feed error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to generate universal feed' });
  }
});

/**
 * @route   POST /api/public/feeds/invalidate-cache
 * @desc    Invalidate feed cache (requires auth)
 * @access  Private
 */
router.post('/invalidate-cache', async (req, res) => {
  try {
    const { storeId } = await getStoreContext(req);

    // Invalidate all feed caches for this store
    const patterns = ['google', 'microsoft', 'chatgpt', 'universal'];
    const languages = ['en', 'nl', 'de', 'fr', 'es']; // Common languages

    for (const pattern of patterns) {
      for (const lang of languages) {
        const cacheKey = generateKey('feed', pattern, storeId, lang);
        // Clear by setting empty value with 0 TTL
        await wrap(cacheKey, async () => null, 0);
      }
    }

    res.json({ success: true, message: 'Feed cache invalidated' });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

module.exports = router;
