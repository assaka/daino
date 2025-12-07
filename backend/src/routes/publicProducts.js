const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { applyProductTranslationsToMany, applyProductTranslations, fetchProductImages } = require('../utils/productHelpers');
const { getAttributesWithTranslations, getAttributeValuesWithTranslations } = require('../utils/attributeHelpers');
const { applyCacheHeaders } = require('../utils/cacheUtils');
const { getStoreSettings } = require('../utils/storeCache');
const { cacheProducts, cacheProduct } = require('../middleware/cacheMiddleware');
const { wrap, generateKey, CACHE_KEYS, DEFAULT_TTL } = require('../utils/cacheManager');
const router = express.Router();

// @route   GET /api/public/products
// @desc    Get all active products (no authentication required)
// @access  Public
// @cache   3 minutes (Redis/in-memory)
router.get('/', cacheProducts(180), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const { page = 1, limit = 100, category_id, status = 'active', search, slug, sku, id, ids, featured, is_custom_option } = req.query;
    const offset = (page - 1) * limit;

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Build Supabase query
    let query = tenantDb
      .from('products')
      .select('*', { count: 'exact' })
      .eq('store_id', store_id)
      .eq('status', 'active');

    // Skip visibility filter for custom option products (they may be hidden from catalog but still usable as options)
    if (!(is_custom_option === 'true' || is_custom_option === true)) {
      query = query.eq('visibility', 'visible');
    }

    // Stock filtering based on store settings
    try {
      const storeSettings = await getStoreSettings(store_id);
      const displayOutOfStock = storeSettings?.display_out_of_stock !== false;

      if (!displayOutOfStock) {
        // Show products that are: configurable OR infinite_stock OR not managing stock OR in stock
        query = query.or('type.eq.configurable,infinite_stock.eq.true,manage_stock.eq.false,and(manage_stock.eq.true,stock_quantity.gt.0)');
      }
    } catch (error) {
      console.warn('Could not load store settings for stock filtering:', error.message);
    }

    // Category filtering will be done in JavaScript after fetch
    // (JSONB array containment queries are complex in Supabase)

    // Simple filters
    if (featured === 'true' || featured === true) query = query.eq('featured', true);
    if (is_custom_option === 'true' || is_custom_option === true) query = query.eq('is_custom_option', true);
    if (slug) query = query.eq('slug', slug);
    if (sku) query = query.eq('sku', sku);
    // Handle 'ids' parameter - array of IDs
    if (ids) {
      try {
        const idsArray = typeof ids === 'string' && ids.startsWith('[')
          ? JSON.parse(ids)
          : Array.isArray(ids) ? ids : [ids];

        if (idsArray.length > 0) {
          query = query.in('id', idsArray);
        }
      } catch (error) {
        console.error('❌ Error parsing ids parameter:', error);
      }
    }
    // Handle 'id' parameter
    else if (id) {
      try {
        if (typeof id === 'string' && id.startsWith('{')) {
          const parsedId = JSON.parse(id);
          const idList = parsedId.$in || parsedId.in;
          if (Array.isArray(idList)) {
            query = query.in('id', idList);
          } else {
            query = query.eq('id', id);
          }
        } else {
          query = query.eq('id', id);
        }
      } catch (error) {
        console.error('❌ Error parsing id parameter:', error);
        query = query.eq('id', id);
      }
    }

    // Search in translations and SKU
    if (search) {
      // Search product translations in tenant DB
      const { data: searchResults } = await tenantDb
        .from('product_translations')
        .select('product_id')
        .or(`name.ilike.%${search}%,description.ilike.%${search}%`);

      const productIds = (searchResults || []).map(r => r.product_id);

      if (productIds.length > 0) {
        // Match products by translation OR SKU
        query = query.or(`id.in.(${productIds.join(',')}),sku.ilike.%${search}%`);
      } else {
        // Only search SKU if no translation matches
        query = query.ilike('sku', `%${search}%`);
      }
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: rows, error: queryError, count } = await query;

    if (queryError) {
      throw new Error(queryError.message);
    }

    // Apply category filter in JavaScript if needed
    let filteredRows = rows || [];
    if (category_id) {
      filteredRows = filteredRows.filter(p =>
        p.category_ids && Array.isArray(p.category_ids) && p.category_ids.includes(category_id)
      );
    }

    // Get language from request headers/query
    const lang = getLanguageFromRequest(req);

    // Apply product translations from normalized table
    const productsWithTranslations = await applyProductTranslationsToMany(filteredRows, lang, tenantDb);

    // Load attribute values for all products (full feature preservation)
    const productIds = filteredRows.map(p => p.id);
    let attributeValuesData = [];

    if (productIds.length > 0) {
      const { data: pavs, error: pavError } = await tenantDb
        .from('product_attribute_values')
        .select('*')
        .in('product_id', productIds);

      if (pavError) {
        console.error('Error loading product attribute values:', pavError.message);
      } else {
        attributeValuesData = pavs || [];
      }
    }

    // Load attributes and attribute values referenced
    const attributeIds = [...new Set((attributeValuesData || []).map(pav => pav.attribute_id))];
    const attributeValueIds = [...new Set((attributeValuesData || []).filter(pav => pav.value_id).map(pav => pav.value_id))];

    const [attributesData, attributeValuesListData] = await Promise.all([
      attributeIds.length > 0
        ? tenantDb.from('attributes').select('id, code, type, is_filterable').in('id', attributeIds).then(r => (r && r.data) || []).catch(() => [])
        : Promise.resolve([]),
      attributeValueIds.length > 0
        ? tenantDb.from('attribute_values').select('id, code, metadata').in('id', attributeValueIds).then(r => (r && r.data) || []).catch(() => [])
        : Promise.resolve([])
    ]);

    // Create lookup maps
    const attrMap = new Map((attributesData || []).map(a => [a.id, a]));
    const valMap = new Map((attributeValuesListData || []).map(v => [v.id, v]));

    // Fetch attribute and value translations
    const attributeTranslations = attributeIds.length > 0
      ? await getAttributesWithTranslations(tenantDb, { id: attributeIds }).catch(() => [])
      : [];
    const valueTranslations = attributeValueIds.length > 0
      ? await getAttributeValuesWithTranslations(tenantDb, { id: attributeValueIds }).catch(() => [])
      : [];

    const attrTransMap = new Map((attributeTranslations || []).map(a => [a.id, a.translations]));
    const valTransMap = new Map((valueTranslations || []).map(v => [v.id, v.translations]));

    // Fetch images from product_files table
    const imagesByProduct = await fetchProductImages(productIds, tenantDb);

    // Group attribute values by product
    const pavByProduct = {};
    attributeValuesData.forEach(pav => {
      if (!pavByProduct[pav.product_id]) pavByProduct[pav.product_id] = [];
      pavByProduct[pav.product_id].push(pav);
    });

    // Transform products with full attribute data
    const productsWithAttributes = productsWithTranslations.map(productData => {
      // Apply images from product_files table
      productData.images = imagesByProduct[productData.id] || [];

      // Add formatted attributes
      const productPavs = pavByProduct[productData.id] || [];
      productData.attributes = productPavs.map(pav => {
        const attr = attrMap.get(pav.attribute_id);
        if (!attr) return null;

        const attrTrans = attrTransMap.get(attr.id) || {};
        const attrLabel = attrTrans[lang]?.label || attrTrans.en?.label || attr.code;

        let value, valueLabel, metadata = null;

        if (pav.value_id) {
          const val = valMap.get(pav.value_id);
          if (val) {
            value = val.code;
            const valTrans = valTransMap.get(val.id) || {};
            valueLabel = valTrans[lang]?.label || valTrans.en?.label || val.code;
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

      return productData;
    });

    // Add cache headers
    await applyCacheHeaders(res, store_id);

    // Return structured response with pagination
    res.json({
      success: true,
      data: productsWithAttributes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get public products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/public/products/:id
// @desc    Get single product by ID (no authentication required)
// @access  Public
// @cache   5 minutes (Redis/in-memory)
router.get('/:id', cacheProduct(300), async (req, res) => {
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

    const { data: product, error } = await tenantDb
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error || !product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Apply product translations from normalized table
    const productData = await applyProductTranslations(store_id, product, lang);

    // Fetch images from product_files table
    const imagesByProduct = await fetchProductImages(product.id, tenantDb);
    productData.images = imagesByProduct[product.id] || [];

    // Load product attribute values
    const { data: pavs, error: pavError } = await tenantDb
      .from('product_attribute_values')
      .select('*')
      .eq('product_id', product.id);

    if (pavError) {
      console.error('Error loading product attribute values:', pavError.message);
    }

    const attributeValuesData = pavs || [];
    const attributeIds = [...new Set((attributeValuesData || []).map(pav => pav.attribute_id))];
    const attributeValueIds = [...new Set((attributeValuesData || []).filter(pav => pav.value_id).map(pav => pav.value_id))];

    // Load attributes and attribute values
    const [attributesData, attributeValuesListData] = await Promise.all([
      attributeIds.length > 0
        ? tenantDb.from('attributes').select('id, code, type').in('id', attributeIds).then(r => (r && r.data) || []).catch(() => [])
        : Promise.resolve([]),
      attributeValueIds.length > 0
        ? tenantDb.from('attribute_values').select('id, code, metadata').in('id', attributeValueIds).then(r => (r && r.data) || []).catch(() => [])
        : Promise.resolve([])
    ]);

    // Create lookup maps
    const attrMap = new Map((attributesData || []).map(a => [a.id, a]));
    const valMap = new Map((attributeValuesListData || []).map(v => [v.id, v]));

    // Fetch attribute and value translations
    const [attributeTranslations, valueTranslations] = await Promise.all([
      attributeIds.length > 0 ? getAttributesWithTranslations(tenantDb, { id: attributeIds }).catch(() => []) : [],
      attributeValueIds.length > 0 ? getAttributeValuesWithTranslations(tenantDb, { id: attributeValueIds }).catch(() => []) : []
    ]);

    const attrTransMap = new Map((attributeTranslations || []).map(attr => [attr.id, attr.translations]));
    const valTransMap = new Map((valueTranslations || []).map(val => [val.id, val.translations]));

    // Format attributes for frontend with normalized translations
    productData.attributes = attributeValuesData.map(pav => {
      const attr = attrMap.get(pav.attribute_id);
      if (!attr) return null;

      // Get translations from normalized table
      const attrTranslations = attrTransMap.get(attr.id) || {};
      const attrLabel = attrTranslations[lang]?.label ||
                       attrTranslations.en?.label ||
                       attr.code;

      let value, valueLabel, metadata = null;

      if (pav.value_id) {
        // Select/multiselect attribute - get translation from normalized table
        const val = valMap.get(pav.value_id);
        if (val) {
          value = val.code;
          const valTranslations = valTransMap.get(val.id) || {};
          valueLabel = valTranslations[lang]?.label ||
                      valTranslations.en?.label ||
                      val.code;
          metadata = val.metadata;
        }
      } else {
        // Text/number/date/boolean attribute
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

    // Add cache headers based on store settings
    const storeId = product.store_id;
    if (storeId) {
      await applyCacheHeaders(res, storeId);
    }

    res.json({
      success: true,
      data: productData
    });
  } catch (error) {
    console.error('Get public product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/public/products/by-slug/:slug/full
// @desc    Get complete product data with tabs, labels, and custom options in one request
// @access  Public
// @cache   5 minutes (Redis/in-memory)
router.get('/by-slug/:slug/full', cacheProduct(300), async (req, res) => {
  try {
    const { slug } = req.params;
    const { store_id } = req.query;
    const lang = getLanguageFromRequest(req);

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // 1. Find product by slug or SKU
    let { data: product, error } = await tenantDb
      .from('products')
      .select('*')
      .eq('store_id', store_id)
      .eq('slug', slug)
      .eq('status', 'active')
      .eq('visibility', 'visible')
      .maybeSingle();

    // Try SKU if slug not found
    if (!product) {
      const result = await tenantDb
        .from('products')
        .select('*')
        .eq('store_id', store_id)
        .eq('sku', slug)
        .eq('status', 'active')
        .eq('visibility', 'visible')
        .maybeSingle();

      product = result.data;
      error = result.error;
    }

    if (error || !product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Apply product translations
    const productData = await applyProductTranslations(store_id, product, lang);

    // Fetch images from product_files table
    const imagesByProduct = await fetchProductImages(product.id, tenantDb);
    productData.images = imagesByProduct[product.id] || [];

    // Load product attributes - skip if fails to not break product page
    productData.attributes = [];
    try {
      const { data: pavs } = await tenantDb
        .from('product_attribute_values')
        .select('*')
        .eq('product_id', product.id);

      if (pavs && pavs.length > 0) {
        const attributeIds = [...new Set(pavs.map(pav => pav.attribute_id))];
        const attributeValueIds = [...new Set(pavs.filter(pav => pav.value_id).map(pav => pav.value_id))];

        const [attributesData, attributeValuesListData, attributeTranslations, valueTranslations] = await Promise.all([
          attributeIds.length > 0 ? tenantDb.from('attributes').select('id, code, type').in('id', attributeIds).then(r => r.data || []) : [],
          attributeValueIds.length > 0 ? tenantDb.from('attribute_values').select('id, code, metadata').in('id', attributeValueIds).then(r => r.data || []) : [],
          attributeIds.length > 0 ? getAttributesWithTranslations(tenantDb, { id: attributeIds }) : [],
          attributeValueIds.length > 0 ? getAttributeValuesWithTranslations(tenantDb, { id: attributeValueIds }) : []
        ]);

        const attrMap = new Map(attributesData.map(a => [a.id, a]));
        const valMap = new Map(attributeValuesListData.map(v => [v.id, v]));
        const attrTransMap = new Map((attributeTranslations || []).map(attr => [attr.id, attr.translations]));
        const valTransMap = new Map((valueTranslations || []).map(val => [val.id, val.translations]));

        productData.attributes = pavs.map(pav => {
          const attr = attrMap.get(pav.attribute_id);
          if (!attr) return null;

          const attrTrans = attrTransMap.get(attr.id) || {};
          const attrLabel = attrTrans[lang]?.label || attrTrans.en?.label || attr.code;

          let value, valueLabel, metadata = null;
          if (pav.value_id) {
            const val = valMap.get(pav.value_id);
            if (val) {
              value = val.code;
              const valTrans = valTransMap.get(val.id) || {};
              valueLabel = valTrans[lang]?.label || valTrans.en?.label || val.code;
              metadata = val.metadata;
            }
          } else {
            value = pav.text_value || pav.number_value || pav.date_value || pav.boolean_value;
            valueLabel = String(value);
          }

          return { id: attr.id, code: attr.code, label: attrLabel, value: valueLabel, rawValue: value, type: attr.type, metadata };
        }).filter(Boolean);
      }
    } catch (attrErr) {
      console.error('Error loading product attributes:', attrErr);
    }

    // 2. Load product tabs
    const { getProductTabsWithTranslations } = require('../utils/productTabHelpers');
    const productTabs = await getProductTabsWithTranslations(store_id, {
      store_id,
      is_active: true
    }, lang, false); // false = only current language

    // 3. Load and evaluate product labels
    const { getProductLabelsWithTranslations } = require('../utils/productLabelHelpers');
    const allLabels = await getProductLabelsWithTranslations(tenantDb, {
      store_id,
      is_active: true
    }, lang, false);

    // Evaluate labels server-side
    const applicableLabels = allLabels.filter(label => {
      let conditions;
      try {
        conditions = typeof label.conditions === 'string' ? JSON.parse(label.conditions) : label.conditions;
      } catch (e) {
        return false;
      }

      // Check attribute conditions
      if (conditions?.attribute_conditions?.length > 0) {
        for (const condition of conditions.attribute_conditions) {
          const productAttr = productData.attributes?.find(
            attr => attr.code === condition.attribute_code
          );
          if (!productAttr || productAttr.value !== condition.attribute_value) {
            return false;
          }
        }
      }

      // Check price conditions
      if (conditions?.price_conditions && Object.keys(conditions.price_conditions).length > 0) {
        const price = parseFloat(productData.price) || 0;
        const { min, max } = conditions.price_conditions;

        if (min !== undefined && price < parseFloat(min)) return false;
        if (max !== undefined && price > parseFloat(max)) return false;
      }

      // Check stock conditions
      if (conditions?.stock_conditions && Object.keys(conditions.stock_conditions).length > 0) {
        const stockQty = parseInt(productData.stock_quantity) || 0;
        const { min, max } = conditions.stock_conditions;

        if (min !== undefined && stockQty < parseInt(min)) return false;
        if (max !== undefined && stockQty > parseInt(max)) return false;
      }

      return true;
    });

    // 4. Load custom option rules
    const { data: customOptionRules } = await tenantDb
      .from('custom_option_rules')
      .select('*')
      .eq('store_id', store_id)
      .eq('is_active', true);

    // Filter applicable custom option rules
    const applicableCustomOptions = (customOptionRules || []).filter(rule => {
      let conditions;
      try {
        conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
      } catch (e) {
        return false;
      }

      // Check if rule has any conditions at all
      const hasCategories = conditions?.categories?.length > 0;
      const hasAttributeSets = conditions?.attribute_sets?.length > 0;
      const hasSkus = conditions?.skus?.length > 0;
      const hasAttributeConditions = conditions?.attribute_conditions?.length > 0;
      const hasAnyConditions = hasCategories || hasAttributeSets || hasSkus || hasAttributeConditions;

      // If no conditions are set, rule applies to ALL products
      if (!hasAnyConditions) {
        return true;
      }

      // Check SKU conditions
      if (hasSkus && conditions.skus.includes(productData.sku)) return true;

      // Check category conditions
      if (hasCategories && productData.category_ids?.length > 0) {
        if (conditions.categories.some(catId => productData.category_ids.includes(catId))) {
          return true;
        }
      }

      // Check attribute set conditions
      if (hasAttributeSets && productData.attribute_set_id) {
        if (conditions.attribute_sets.includes(productData.attribute_set_id)) {
          return true;
        }
      }

      // Check attribute conditions
      if (hasAttributeConditions) {
        for (const condition of conditions.attribute_conditions) {
          const productAttr = productData.attributes?.find(
            attr => attr.code === condition.attribute_code
          );
          if (productAttr && productAttr.value === condition.attribute_value) {
            return true;
          }
        }
      }

      return false;
    });

    // Return structured response with cache headers based on store settings
    await applyCacheHeaders(res, store_id);

    res.json({
      success: true,
      data: {
        product: productData,
        productTabs: productTabs || [],
        productLabels: applicableLabels || [],
        customOptions: applicableCustomOptions || []
      }
    });

  } catch (error) {
    console.error('Get full product data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
