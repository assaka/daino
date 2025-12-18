const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { applyProductTranslationsToMany, fetchProductImages } = require('../utils/productHelpers');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const router = express.Router();

/**
 * @route   GET /api/public/page-bootstrap
 * @desc    Get page-specific data in one request
 * @access  Public
 * @cache   5 minutes (Redis) - Page-specific data
 * @query   {string} page_type - Page type: product, category, checkout, homepage
 * @query   {string} store_id - Store ID (required)
 * @query   {string} lang - Language code (optional)
 */
router.get('/', cacheMiddleware({
  prefix: 'page-bootstrap',
  ttl: 300, // 5 minutes
  keyGenerator: (req) => {
    const pageType = req.query.page_type || 'default';
    const storeId = req.query.store_id || 'default';
    const lang = req.query.lang || 'en';
    return `page-bootstrap:${pageType}:${storeId}:${lang}`;
  }
}), async (req, res) => {
  try {
    const { page_type, store_id, lang } = req.query;
    const language = lang || 'en';

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    if (!page_type) {
      return res.status(400).json({
        success: false,
        message: 'Page type is required'
      });
    }

    // Get tenant connection (Supabase client)
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    let pageData = {};

    switch (page_type) {
      case 'product':
        // Product page needs: attributes, attribute sets, labels, tabs
        const [
          { data: attributes },
          { data: attributeSets },
          { data: productLabels },
          { data: productTabs }
        ] = await Promise.all([
          tenantDb.from('attributes').select('*').eq('store_id', store_id).order('code', { ascending: true }),
          tenantDb.from('attribute_sets').select('*').eq('store_id', store_id).order('name', { ascending: true }),
          tenantDb.from('product_labels').select('*').eq('store_id', store_id).eq('is_active', true).order('name', { ascending: true }),
          tenantDb.from('product_tabs').select('*').eq('store_id', store_id).eq('is_active', true).order('sort_order', { ascending: true })
        ]);

        pageData = {
          attributes: attributes || [],
          attributeSets: attributeSets || [],
          productLabels: productLabels || [],
          productTabs: productTabs || []
        };
        break;

      case 'category':
        // Category page needs: filterable attributes with translations, labels
        const [
          { data: filterableAttributesRaw },
          { data: categoryLabels }
        ] = await Promise.all([
          tenantDb.from('attributes')
            .select(`
              *,
              attribute_translations (
                language_code,
                label
              ),
              attribute_values (
                id,
                code,
                sort_order,
                attribute_value_translations (
                  language_code,
                  label
                )
              )
            `)
            .eq('store_id', store_id)
            .eq('is_filterable', true)
            .order('code', { ascending: true }),
          tenantDb.from('product_labels').select('*').eq('store_id', store_id).eq('is_active', true).order('name', { ascending: true })
        ]);

        // Transform attributes with pre-translated label and value strings
        // This matches the format from publicAttributes.js for consistency
        const filterableAttributes = (filterableAttributesRaw || []).map(attr => {
          // Get translated attribute label (current lang -> en fallback -> code)
          const attrTranslations = attr.attribute_translations || [];
          const currentLangTrans = attrTranslations.find(t => t.language_code === language);
          const enTrans = attrTranslations.find(t => t.language_code === 'en');
          const label = currentLangTrans?.label || enTrans?.label || attr.code;

          // Convert attribute_values with pre-translated value string
          const values = (attr.attribute_values || []).map(val => {
            const valTranslations = val.attribute_value_translations || [];
            const valCurrentLang = valTranslations.find(t => t.language_code === language);
            const valEnLang = valTranslations.find(t => t.language_code === 'en');

            return {
              id: val.id,
              code: val.code,
              sort_order: val.sort_order,
              // Pre-translated value string (matches publicAttributes.js format)
              value: valCurrentLang?.label || valEnLang?.label || val.code
            };
          });

          return {
            ...attr,
            // Pre-translated label string (matches publicAttributes.js format)
            label,
            values,
            // Remove raw arrays
            attribute_translations: undefined,
            attribute_values: undefined
          };
        });

        pageData = {
          filterableAttributes: filterableAttributes || [],
          productLabels: categoryLabels || []
        };
        break;

      case 'cart':
        // Cart page needs: taxes
        try {
          const { data: cartTaxes } = await tenantDb
            .from('taxes')
            .select('*')
            .eq('store_id', store_id)
            .eq('is_active', true)
            .order('name', { ascending: true });

          pageData = {
            taxes: cartTaxes || []
          };
        } catch (cartError) {
          console.error('Cart bootstrap error:', cartError);
          pageData = {
            taxes: []
          };
        }
        break;

      case 'checkout':
        // Checkout page needs: taxes, shipping, payment, delivery settings
        const [
          { data: taxes },
          { data: shippingMethods },
          { data: paymentMethods },
          { data: deliverySettings }
        ] = await Promise.all([
          tenantDb.from('taxes').select('*').eq('store_id', store_id).eq('is_active', true).order('name', { ascending: true }),
          tenantDb.from('shipping_methods').select('*').eq('store_id', store_id).eq('is_active', true).order('sort_order', { ascending: true }),
          tenantDb.from('payment_methods').select('*').eq('store_id', store_id).eq('is_active', true).order('sort_order', { ascending: true }),
          tenantDb.from('delivery_settings').select('*').eq('store_id', store_id)
        ]);

        pageData = {
          taxes: taxes || [],
          shippingMethods: shippingMethods || [],
          paymentMethods: paymentMethods || [],
          deliverySettings: deliverySettings || []
        };
        break;

      case 'homepage':
        // Homepage needs: featured products, CMS blocks
        try {
          const [
            { data: featuredProducts },
            { data: cmsBlocks }
          ] = await Promise.all([
            tenantDb.from('products').select('*').eq('store_id', store_id).eq('featured', true).eq('status', 'active').order('created_at', { ascending: false }).limit(12),
            tenantDb.from('cms_blocks').select('*').eq('store_id', store_id).eq('is_active', true).order('sort_order', { ascending: true })
          ]);

          // Apply translations if products exist
          let translatedProducts = featuredProducts && featuredProducts.length > 0
            ? await applyProductTranslationsToMany(featuredProducts, language, tenantDb)
            : [];

          // Fetch and apply product images
          if (translatedProducts.length > 0) {
            const productIds = translatedProducts.map(p => p.id);
            const imagesByProduct = await fetchProductImages(productIds, tenantDb);
            translatedProducts = translatedProducts.map(product => ({
              ...product,
              images: imagesByProduct[product.id] || []
            }));
          }

          pageData = {
            featuredProducts: translatedProducts,
            cmsBlocks: cmsBlocks || []
          };
        } catch (homepageError) {
          console.error('Homepage bootstrap error:', homepageError);
          // Return empty data instead of failing
          pageData = {
            featuredProducts: [],
            cmsBlocks: []
          };
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Invalid page_type: ${page_type}`
        });
    }

    res.json({
      success: true,
      data: pageData,
      meta: {
        page_type,
        store_id,
        language,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Page bootstrap error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      pageType: req.query.page_type,
      storeId: req.query.store_id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to load page data',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
