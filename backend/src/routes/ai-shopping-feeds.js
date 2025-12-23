const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const AIShoppingFeedGenerator = require('../services/ai-shopping-feed-generator');
const { applyProductTranslationsToMany, fetchProductImages } = require('../utils/productHelpers');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { wrap, generateKey, DEFAULT_TTL } = require('../utils/cacheManager');

const router = express.Router();

const FEED_CACHE_TTL = 3600; // 1 hour

/**
 * Enrich products with brand and mpn from product_attribute_values
 * Fetches brand/mpn from the attribute system with translations
 *
 * @param {Array} products - Products array
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} storeId - Store ID
 * @param {string} language - Language code (e.g., 'en')
 */
async function enrichProductsWithBrandAndMpn(products, tenantDb, storeId, language = 'en') {
  if (!products || products.length === 0) return products;

  const productIds = products.map(p => p.id);

  // Find the brand and mpn attribute IDs for this store
  const { data: attributes } = await tenantDb
    .from('attributes')
    .select('id, code')
    .eq('store_id', storeId)
    .in('code', ['brand', 'mpn', 'manufacturer']);

  if (!attributes || attributes.length === 0) return products;

  const brandAttr = attributes.find(a => a.code === 'brand');
  const mpnAttr = attributes.find(a => a.code === 'mpn');
  const manufacturerAttr = attributes.find(a => a.code === 'manufacturer');

  const attrIds = attributes.map(a => a.id);

  // Fetch product_attribute_values for these products and attributes
  const { data: productAttrValues } = await tenantDb
    .from('product_attribute_values')
    .select('product_id, attribute_id, value_id, text_value')
    .in('product_id', productIds)
    .in('attribute_id', attrIds);

  if (!productAttrValues || productAttrValues.length === 0) return products;

  // Collect value_ids for select/multiselect attributes to fetch translations
  const valueIds = productAttrValues
    .filter(pav => pav.value_id)
    .map(pav => pav.value_id);

  // Fetch attribute_values and their translations
  let valueTranslations = {};
  if (valueIds.length > 0) {
    // First get the attribute values
    const { data: attrValues } = await tenantDb
      .from('attribute_values')
      .select('id, code, label')
      .in('id', valueIds);

    // Then get translations for these values
    const { data: translations } = await tenantDb
      .from('attribute_value_translations')
      .select('attribute_value_id, language_code, value')
      .in('attribute_value_id', valueIds);

    // Build lookup map: value_id -> translated label
    if (attrValues) {
      attrValues.forEach(av => {
        // Default to the attribute value's label
        valueTranslations[av.id] = av.label || av.code;
      });
    }

    // Override with translation if available for requested language
    if (translations) {
      translations.forEach(t => {
        if (t.language_code === language && t.value) {
          valueTranslations[t.attribute_value_id] = t.value;
        }
      });
    }
  }

  // Build product -> brand/mpn lookup
  const productBrandMap = {};
  const productMpnMap = {};
  const productManufacturerMap = {};

  productAttrValues.forEach(pav => {
    const value = pav.value_id
      ? valueTranslations[pav.value_id]
      : pav.text_value;

    if (!value) return;

    if (brandAttr && pav.attribute_id === brandAttr.id) {
      productBrandMap[pav.product_id] = value;
    }
    if (mpnAttr && pav.attribute_id === mpnAttr.id) {
      productMpnMap[pav.product_id] = value;
    }
    if (manufacturerAttr && pav.attribute_id === manufacturerAttr.id) {
      productManufacturerMap[pav.product_id] = value;
    }
  });

  // Attach brand/mpn to products
  return products.map(product => ({
    ...product,
    brand: productBrandMap[product.id] || null,
    mpn: productMpnMap[product.id] || null,
    manufacturer: productManufacturerMap[product.id] || null
  }));
}

/**
 * Get store context from request (supports both route param and header/query)
 */
async function getStoreContext(req) {
  // Support route param (preferred), header, or query
  const storeId = req.params.storeId || req.headers['x-store-id'] || req.query.store_id;
  if (!storeId) {
    throw new Error('Store ID required');
  }

  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Get store info - query by is_active since storeId is tenant identifier
  const { data: store } = await tenantDb
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  // Use buildStoreUrl if available, otherwise fallback
  const { buildStoreUrl } = require('../utils/domainConfig');
  let baseUrl;
  try {
    baseUrl = await buildStoreUrl({
      tenantDb,
      storeId: store?.id,
      storeSlug: store?.slug
    });
  } catch {
    baseUrl = store?.domain || `https://${store?.subdomain || 'store'}.example.com`;
  }

  return { storeId, tenantDb, store, baseUrl };
}

/**
 * Get products for feed with translations, images, and brand/mpn from attributes
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

  // Enrich with brand/mpn from product_attribute_values
  enrichedProducts = await enrichProductsWithBrandAndMpn(enrichedProducts, tenantDb, storeId, language);

  return enrichedProducts;
}

/**
 * @route   GET /api/public/feeds/:storeId/google-merchant-xml
 * @desc    Google Merchant Center XML feed
 * @access  Public
 */
router.get('/:storeId/google-merchant-xml', async (req, res) => {
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
 * @route   GET /api/public/feeds/:storeId/microsoft-merchant-xml
 * @desc    Microsoft Merchant Center XML feed
 * @access  Public
 */
router.get('/:storeId/microsoft-merchant-xml', async (req, res) => {
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
