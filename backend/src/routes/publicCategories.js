const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { applyCacheHeaders } = require('../utils/cacheUtils');
const { fetchProductImages } = require('../utils/productHelpers');
const { batchFetchProductAttributes } = require('../utils/productAttributeBatcher');
const { cacheCategories } = require('../middleware/cacheMiddleware');
const router = express.Router();

// @route   GET /api/public/categories
// @desc    Get all active categories (no authentication required)
// @access  Public
// @cache   10 minutes (Redis/in-memory)
router.get('/', cacheCategories(600), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const { page = 1, limit = 100, parent_id, search, include_hidden } = req.query;
    const offset = (page - 1) * limit;
    const lang = getLanguageFromRequest(req);

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Build query
    let query = tenantDb
      .from('categories')
      .select('*', { count: 'exact' })
      .eq('store_id', store_id)
      .eq('is_active', true);

    // Only filter by hide_in_menu if include_hidden is not set (for sitemap use case)
    if (include_hidden !== 'true') {
      query = query.eq('hide_in_menu', false);
    }

    if (parent_id !== undefined) {
      query = query.eq('parent_id', parent_id);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    query = query
      .order('sort_order', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: categories, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Load translations for categories
    const categoryIds = (categories || []).map(c => c.id);
    let translations = [];

    if (categoryIds.length > 0) {
      const { data: trans } = await tenantDb
        .from('category_translations')
        .select('*')
        .in('category_id', categoryIds)
        .in('language_code', [lang, 'en']);

      translations = trans || [];
    }

    // Build translation map
    const transMap = {};
    translations.forEach(t => {
      if (!transMap[t.category_id]) transMap[t.category_id] = {};
      transMap[t.category_id][t.language_code] = t;
    });

    // Apply translations
    const categoriesWithTrans = (categories || []).map(cat => {
      const trans = transMap[cat.id];
      const reqLang = trans?.[lang];
      const enLang = trans?.['en'];

      return {
        ...cat,
        name: reqLang?.name || enLang?.name || cat.slug || cat.name,
        description: reqLang?.description || enLang?.description || null
      };
    });

    // Apply cache headers
    await applyCacheHeaders(res, store_id);

    // Return structured response with pagination
    res.json({
      success: true,
      data: categoriesWithTrans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Get public categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/public/categories/by-slug/:slug/full
// @desc    Get complete category data with products in one request
// @access  Public
// @cache   5 minutes (Redis/in-memory)
router.get('/by-slug/:slug/full', cacheCategories(300), async (req, res) => {
  try {
    const { slug } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;
    const lang = getLanguageFromRequest(req);

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // 1. Find category by slug
    const { data: category, error: catError } = await tenantDb
      .from('categories')
      .select('*')
      .eq('store_id', store_id)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (catError) {
      console.error('Error fetching category:', catError);
      throw catError;
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category "${slug}" not found`,
        reason: 'Category does not exist or is inactive'
      });
    }

    // Load category translation
    const { data: categoryTrans } = await tenantDb
      .from('category_translations')
      .select('*')
      .eq('category_id', category.id)
      .in('language_code', [lang, 'en']);

    const transMap = {};
    (categoryTrans || []).forEach(t => {
      transMap[t.language_code] = t;
    });

    const reqLang = transMap[lang];
    const enLang = transMap['en'];

    const categoryWithTrans = {
      ...category,
      name: reqLang?.name || enLang?.name || category.slug || category.name,
      description: reqLang?.description || enLang?.description || null
    };

    // 2. Load products for this category
    // Note: JSONB contains query has compatibility issues with some Supabase versions,
    // so we fetch active/visible products and filter by category in JavaScript
    const { data: allProducts, error: prodsError } = await tenantDb
      .from('products')
      .select('*')
      .eq('store_id', store_id)
      .eq('status', 'active')
      .eq('visibility', 'visible')
      .order('created_at', { ascending: false });

    if (prodsError) {
      console.error('Error loading category products:', prodsError.message);
    }

    // Filter products that have this category in their category_ids array
    const products = (allProducts || []).filter(p =>
      p.category_ids && Array.isArray(p.category_ids) && p.category_ids.includes(category.id)
    ).slice(0, 100);

    // Load product translations
    const productIds = (products || []).map(p => p.id);
    let productTranslations = [];

    if (productIds.length > 0) {
      const { data: prodTrans } = await tenantDb
        .from('product_translations')
        .select('*')
        .in('product_id', productIds)
        .in('language_code', [lang, 'en']);

      productTranslations = prodTrans || [];
    }

    // Build product translation map
    const prodTransMap = {};
    productTranslations.forEach(t => {
      if (!prodTransMap[t.product_id]) prodTransMap[t.product_id] = {};
      prodTransMap[t.product_id][t.language_code] = t;
    });

    // Batch fetch images and attributes in parallel (optimized)
    const [imagesByProduct, batchData] = await Promise.all([
      fetchProductImages(productIds, tenantDb),
      batchFetchProductAttributes(productIds, lang, tenantDb)
    ]);

    // Apply translations, images, and attributes to products
    const productsWithTrans = (products || []).map(p => {
      const trans = prodTransMap[p.id];
      const reqLang = trans?.[lang];
      const enLang = trans?.['en'];

      // Transform product attribute values to array format using batched data
      const productPavs = batchData.pavByProduct[p.id] || [];
      const attributes = productPavs.map(pav => {
        const attr = batchData.attrMap.get(pav.attribute_id);
        if (!attr) return null;

        const attrTrans = batchData.attrTransMap.get(attr.id) || {};
        const attrLabel = attrTrans[lang]?.label || attrTrans.en?.label || attr.code;

        let value, valueLabel, metadata = null;

        if (pav.value_id) {
          const val = batchData.valMap.get(pav.value_id);
          if (val) {
            value = val.code;
            const valTrans = batchData.valTransMap.get(val.id) || {};
            valueLabel = valTrans[lang]?.value || valTrans.en?.value || val.code;
            metadata = val.metadata;
          }
        } else {
          value = pav.text_value || pav.number_value || pav.date_value || pav.boolean_value;
          valueLabel = String(value);
        }

        return {
          id: attr.id,
          code: attr.code,
          label: attrLabel,
          value: valueLabel,
          rawValue: value,
          type: attr.type,
          metadata
        };
      }).filter(Boolean);

      return {
        ...p,
        name: reqLang?.name || enLang?.name || p.name,
        description: reqLang?.description || enLang?.description || p.description,
        images: imagesByProduct[p.id] || [],
        attributes
      };
    });

    res.json({
      success: true,
      data: {
        category: categoryWithTrans,
        products: productsWithTrans
      }
    });
  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/public/categories/:id
// @desc    Get single category by ID (no authentication required)
// @access  Public
// @cache   10 minutes (Redis/in-memory)
router.get('/:id', cacheCategories(600), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const lang = getLanguageFromRequest(req);
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get category
    const { data: category, error: catError } = await tenantDb
      .from('categories')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .maybeSingle();

    if (catError) {
      console.error('Error fetching category:', catError);
      throw catError;
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category "${slug}" not found`,
        reason: 'Category does not exist or is inactive'
      });
    }

    // Load translation
    const { data: categoryTrans } = await tenantDb
      .from('category_translations')
      .select('*')
      .eq('category_id', category.id)
      .in('language_code', [lang, 'en']);

    const transMap = {};
    (categoryTrans || []).forEach(t => {
      transMap[t.language_code] = t;
    });

    const reqLang = transMap[lang];
    const enLang = transMap['en'];

    const categoryWithTrans = {
      ...category,
      name: reqLang?.name || enLang?.name || category.slug || category.name,
      description: reqLang?.description || enLang?.description || null
    };

    res.json({
      success: true,
      data: categoryWithTrans
    });
  } catch (error) {
    console.error('Get public category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
