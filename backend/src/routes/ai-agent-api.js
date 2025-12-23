const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const { applyProductTranslationsToMany, fetchProductImages } = require('../utils/productHelpers');
const { getLanguageFromRequest } = require('../utils/languageUtils');

const router = express.Router();

/**
 * AI Agent API - Optimized for AI assistants like ChatGPT, Claude, Gemini, Copilot
 *
 * Features:
 * - Natural language-friendly responses
 * - Rich product context
 * - Semantic search capabilities
 * - Conversational response format
 */

/**
 * Get store context from request
 */
async function getStoreContext(req) {
  const storeId = req.headers['x-store-id'] || req.query.store_id;
  if (!storeId) {
    throw new Error('Store ID required');
  }

  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: store } = await tenantDb
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  const baseUrl = store?.domain || `https://${store?.subdomain || 'store'}.example.com`;
  const currency = store?.currency || 'USD';

  return { storeId, tenantDb, store, baseUrl, currency };
}

/**
 * Format a product for AI consumption
 */
function formatProductForAI(product, baseUrl, currency) {
  const discount = calculateDiscount(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,

    // AI-friendly summary
    ai_summary: generateAISummary(product, discount, currency),

    // Descriptions
    description: product.description,
    short_description: product.short_description,

    // Highlights
    highlights: product.ai_shopping_data?.product_highlights || [],

    // Pricing
    pricing: {
      current_price: parseFloat(product.price) || 0,
      original_price: product.compare_price ? parseFloat(product.compare_price) : null,
      currency: currency,
      formatted_current: formatPrice(product.price, currency),
      formatted_original: product.compare_price ? formatPrice(product.compare_price, currency) : null,
      discount_percentage: discount,
      price_context: discount > 0
        ? `Currently ${discount}% off, save ${formatPrice(parseFloat(product.compare_price) - parseFloat(product.price), currency)}`
        : 'Regular price'
    },

    // Availability
    availability: {
      status: getAvailabilityStatus(product),
      quantity: product.stock_quantity,
      message: getAvailabilityMessage(product),
      low_stock_warning: product.stock_quantity > 0 && product.stock_quantity <= (product.low_stock_threshold || 5)
    },

    // Identifiers
    identifiers: {
      sku: product.sku,
      gtin: product.gtin,
      mpn: product.mpn,
      barcode: product.barcode
    },

    brand: product.brand,

    // Category
    category: {
      ids: product.category_ids || []
    },

    // Specifications
    specifications: formatSpecifications(product),

    // URLs
    urls: {
      product_page: `${baseUrl}/product/${product.slug}`,
      add_to_cart: `${baseUrl}/cart/add/${product.id}`,
      images: formatImages(product.images)
    },

    // Shipping
    shipping: {
      weight: product.weight ? `${product.weight} kg` : null,
      dimensions: formatDimensions(product.dimensions)
    }
  };
}

// Helper functions
function generateAISummary(product, discount, currency) {
  const parts = [];

  if (product.brand) {
    parts.push(`The ${product.brand} ${product.name}`);
  } else {
    parts.push(`This ${product.name}`);
  }

  if (product.short_description) {
    parts.push(product.short_description.substring(0, 150));
  }

  if (discount > 0) {
    parts.push(`Currently ${discount}% off at ${formatPrice(product.price, currency)}.`);
  } else {
    parts.push(`Priced at ${formatPrice(product.price, currency)}.`);
  }

  if (product.infinite_stock || product.stock_quantity > 10) {
    parts.push('In stock and ready to ship.');
  } else if (product.stock_quantity > 0) {
    parts.push(`Only ${product.stock_quantity} left in stock.`);
  }

  return parts.join(' ');
}

function getAvailabilityStatus(product) {
  if (product.infinite_stock || product.stock_quantity > 0) return 'in_stock';
  if (product.allow_backorders) return 'backorder';
  return 'out_of_stock';
}

function getAvailabilityMessage(product) {
  if (product.infinite_stock) return 'In stock and ready to ship';
  if (product.stock_quantity > 10) return 'In stock and ready to ship';
  if (product.stock_quantity > 0) return `Only ${product.stock_quantity} left in stock`;
  if (product.allow_backorders) return 'Available for backorder';
  return 'Out of stock';
}

function formatPrice(price, currency) {
  const num = parseFloat(price) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(num);
}

function calculateDiscount(product) {
  if (!product.compare_price || parseFloat(product.compare_price) <= parseFloat(product.price)) return 0;
  return Math.round((1 - parseFloat(product.price) / parseFloat(product.compare_price)) * 100);
}

function formatSpecifications(product) {
  const specs = [];
  const identifiers = product.product_identifiers || {};

  if (identifiers.color) specs.push({ name: 'Color', value: identifiers.color });
  if (identifiers.size) specs.push({ name: 'Size', value: identifiers.size });
  if (identifiers.material) specs.push({ name: 'Material', value: identifiers.material });
  if (identifiers.gender) specs.push({ name: 'Gender', value: identifiers.gender });
  if (identifiers.age_group) specs.push({ name: 'Age Group', value: identifiers.age_group });
  if (product.weight) specs.push({ name: 'Weight', value: `${product.weight} kg` });

  return specs;
}

function formatImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((img, index) => ({
    url: img.url || img.file_url || img,
    alt: img.alt || img.alt_text || `Product image ${index + 1}`
  }));
}

function formatDimensions(dimensions) {
  if (!dimensions) return null;
  const parts = [];
  if (dimensions.length) parts.push(dimensions.length);
  if (dimensions.width) parts.push(dimensions.width);
  if (dimensions.height) parts.push(dimensions.height);
  if (parts.length === 0) return null;
  return `${parts.join(' x ')} ${dimensions.unit || 'cm'}`;
}

function parseNaturalLanguageQuery(query) {
  const result = {
    keywords: [],
    maxPrice: null,
    minPrice: null,
    color: null,
    inStock: null
  };

  // Extract price constraints
  const underMatch = query.match(/under\s*\$?(\d+)/i) || query.match(/less\s*than\s*\$?(\d+)/i);
  if (underMatch) result.maxPrice = parseInt(underMatch[1]);

  const overMatch = query.match(/over\s*\$?(\d+)/i) || query.match(/more\s*than\s*\$?(\d+)/i);
  if (overMatch) result.minPrice = parseInt(overMatch[1]);

  // Extract color
  const colors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink', 'orange', 'brown', 'gray', 'grey', 'navy', 'beige'];
  colors.forEach(color => {
    if (query.toLowerCase().includes(color)) {
      result.color = color;
    }
  });

  // Extract stock preference
  if (query.toLowerCase().includes('in stock') || query.toLowerCase().includes('available')) {
    result.inStock = true;
  }

  // Extract keywords (remove price and color terms)
  let cleanQuery = query
    .replace(/under\s*\$?\d+/gi, '')
    .replace(/less\s*than\s*\$?\d+/gi, '')
    .replace(/over\s*\$?\d+/gi, '')
    .replace(/more\s*than\s*\$?\d+/gi, '')
    .replace(/in\s*stock/gi, '')
    .replace(/available/gi, '')
    .replace(new RegExp(colors.join('|'), 'gi'), '')
    .trim();

  result.keywords = cleanQuery.split(/\s+/).filter(word => word.length > 2);

  return result;
}

/**
 * @route   GET /api/ai-agent/products
 * @desc    List products with AI-friendly responses
 * @access  Public
 */
router.get('/products', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl, currency } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';
    const {
      search,
      category,
      brand,
      min_price,
      max_price,
      in_stock,
      limit = 20,
      page = 1
    } = req.query;

    let query = tenantDb
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('visibility', 'visible');

    // Apply filters
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }

    if (min_price) {
      query = query.gte('price', parseFloat(min_price));
    }

    if (max_price) {
      query = query.lte('price', parseFloat(max_price));
    }

    if (in_stock === 'true') {
      query = query.or('infinite_stock.eq.true,stock_quantity.gt.0');
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: products, error } = await query;
    if (error) throw error;

    // Apply translations
    let enrichedProducts = await applyProductTranslationsToMany(products || [], tenantDb, language);

    // Apply images
    enrichedProducts = await fetchProductImages(enrichedProducts, tenantDb);

    // Search filter (after translations applied)
    if (search) {
      const searchLower = search.toLowerCase();
      enrichedProducts = enrichedProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchLower)) ||
        (p.description && p.description.toLowerCase().includes(searchLower)) ||
        (p.sku && p.sku.toLowerCase().includes(searchLower))
      );
    }

    // Category filter (JSONB)
    if (category) {
      enrichedProducts = enrichedProducts.filter(p =>
        p.category_ids && p.category_ids.includes(category)
      );
    }

    // Format for AI
    const formattedProducts = enrichedProducts.map(p => formatProductForAI(p, baseUrl, currency));

    res.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: formattedProducts.length
        }
      },
      meta: {
        response_format: 'ai-agent-v1',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('AI Agent products error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * @route   GET /api/ai-agent/products/search
 * @desc    Natural language product search
 * @access  Public
 */
router.get('/products/search', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl, currency } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query (q) required' });
    }

    // Parse natural language query
    const searchTerms = parseNaturalLanguageQuery(q);

    let query = tenantDb
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .eq('visibility', 'visible');

    // Apply parsed filters
    if (searchTerms.maxPrice) {
      query = query.lte('price', searchTerms.maxPrice);
    }

    if (searchTerms.minPrice) {
      query = query.gte('price', searchTerms.minPrice);
    }

    if (searchTerms.inStock) {
      query = query.or('infinite_stock.eq.true,stock_quantity.gt.0');
    }

    query = query.limit(50); // Get more for keyword filtering

    const { data: products, error } = await query;
    if (error) throw error;

    // Apply translations
    let enrichedProducts = await applyProductTranslationsToMany(products || [], tenantDb, language);

    // Apply images
    enrichedProducts = await fetchProductImages(enrichedProducts, tenantDb);

    // Keyword and color filtering
    if (searchTerms.keywords.length > 0 || searchTerms.color) {
      enrichedProducts = enrichedProducts.filter(p => {
        let matches = true;

        // Keyword matching
        if (searchTerms.keywords.length > 0) {
          const searchText = `${p.name || ''} ${p.description || ''} ${p.short_description || ''}`.toLowerCase();
          matches = searchTerms.keywords.some(kw => searchText.includes(kw.toLowerCase()));
        }

        // Color matching
        if (matches && searchTerms.color) {
          const productColor = p.product_identifiers?.color?.toLowerCase() || '';
          const searchText = `${p.name || ''} ${p.description || ''}`.toLowerCase();
          matches = productColor.includes(searchTerms.color) || searchText.includes(searchTerms.color);
        }

        return matches;
      });
    }

    // Limit results
    enrichedProducts = enrichedProducts.slice(0, parseInt(limit));

    // Format for AI
    const formattedProducts = enrichedProducts.map(p => formatProductForAI(p, baseUrl, currency));

    res.json({
      success: true,
      data: {
        query: q,
        interpreted_as: searchTerms,
        products: formattedProducts,
        result_count: formattedProducts.length
      },
      meta: {
        response_format: 'ai-agent-v1',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('AI Agent search error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to search products' });
  }
});

/**
 * @route   GET /api/ai-agent/products/:id
 * @desc    Get single product with full AI context
 * @access  Public
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { storeId, tenantDb, store, baseUrl, currency } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';
    const { id } = req.params;

    // Try to find by id, slug, or sku
    let query = tenantDb
      .from('products')
      .select('*')
      .eq('store_id', storeId);

    // UUID check
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.or(`slug.eq.${id},sku.eq.${id}`);
    }

    const { data: products, error } = await query;
    if (error) throw error;

    const product = products?.[0];
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Apply translations
    let enrichedProducts = await applyProductTranslationsToMany([product], tenantDb, language);

    // Apply images
    enrichedProducts = await fetchProductImages(enrichedProducts, tenantDb);

    const enrichedProduct = enrichedProducts[0];

    // Get related products
    let relatedProducts = [];
    const relatedIds = enrichedProduct.related_product_ids || [];
    if (relatedIds.length > 0) {
      const { data: related } = await tenantDb
        .from('products')
        .select('id, slug, price, images')
        .in('id', relatedIds.slice(0, 5))
        .eq('status', 'active');

      if (related) {
        let relatedEnriched = await applyProductTranslationsToMany(related, tenantDb, language);
        relatedProducts = relatedEnriched.map(rp => ({
          id: rp.id,
          name: rp.name,
          price: formatPrice(rp.price, currency),
          url: `${baseUrl}/product/${rp.slug}`
        }));
      }
    }

    const formattedProduct = formatProductForAI(enrichedProduct, baseUrl, currency);
    formattedProduct.related_products = relatedProducts;

    res.json({
      success: true,
      data: {
        product: formattedProduct,
        store: {
          name: store?.name,
          return_policy: store?.settings?.return_policy || '30-day hassle-free returns',
          warranty: store?.settings?.warranty || 'Standard manufacturer warranty'
        }
      },
      meta: {
        response_format: 'ai-agent-v1',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('AI Agent product detail error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * @route   GET /api/ai-agent/categories
 * @desc    Get category tree for AI navigation
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const { storeId, tenantDb, baseUrl } = await getStoreContext(req);
    const language = getLanguageFromRequest(req) || 'en';

    const { data: categories, error } = await tenantDb
      .from('categories')
      .select('id, slug, parent_id, sort_order')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('sort_order');

    if (error) throw error;

    // Get translations
    const categoryIds = (categories || []).map(c => c.id);
    let translationsMap = {};

    if (categoryIds.length > 0) {
      const { data: translations } = await tenantDb
        .from('category_translations')
        .select('category_id, name, description')
        .in('category_id', categoryIds)
        .eq('language_code', language);

      if (translations) {
        translations.forEach(t => {
          translationsMap[t.category_id] = t;
        });
      }
    }

    // Build flat list with names
    const flatList = (categories || []).map(c => ({
      id: c.id,
      name: translationsMap[c.id]?.name || c.slug,
      slug: c.slug,
      parent_id: c.parent_id,
      url: `${baseUrl}/category/${c.slug}`
    }));

    // Build tree
    function buildTree(items, parentId = null) {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          url: item.url,
          children: buildTree(items, item.id)
        }));
    }

    res.json({
      success: true,
      data: {
        categories: buildTree(flatList),
        flat_list: flatList
      }
    });
  } catch (error) {
    console.error('AI Agent categories error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * @route   GET /api/ai-agent/store-info
 * @desc    Get store information for AI context
 * @access  Public
 */
router.get('/store-info', async (req, res) => {
  try {
    const { store, baseUrl, currency } = await getStoreContext(req);

    res.json({
      success: true,
      data: {
        store: {
          name: store?.name,
          url: baseUrl,
          currency: currency,
          description: store?.description
        },
        policies: {
          return_policy: store?.settings?.return_policy || '30-day returns accepted',
          shipping_policy: store?.settings?.shipping_policy || 'Standard shipping available',
          warranty: store?.settings?.warranty || 'Manufacturer warranty applies'
        },
        contact: {
          email: store?.email,
          phone: store?.phone
        },
        capabilities: {
          search: true,
          filtering: true,
          product_details: true,
          related_products: true,
          categories: true,
          natural_language_search: true
        }
      }
    });
  } catch (error) {
    console.error('AI Agent store info error:', error);
    if (error.message === 'Store ID required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch store info' });
  }
});

module.exports = router;
