const express = require('express');
const { body, validationResult } = require('express-validator');
const ConnectionManager = require('../services/database/ConnectionManager');

const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');
const { applyAllProductTranslations, updateProductTranslations, applyProductImages } = require('../utils/productHelpers');
const router = express.Router();

// Import the new store auth middleware
const { checkStoreOwnership: storeAuthMiddleware, checkResourceOwnership } = require('../middleware/storeAuth');

// @route   GET /api/products
// @desc    Get products (authenticated users only)
// @access  Private (Admin/Store Owner)
const { authAdmin } = require('../middleware/authMiddleware');
const { storeOwnerOnly, customerOnly, adminOnly } = require('../middleware/auth');

router.get('/', authAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100, category_id, status, search, slug, sku, id, include_all_translations, is_custom_option } = req.query;
    const store_id = req.headers['x-store-id'] || req.query.store_id;
    const offset = (page - 1) * limit;

    console.log('🔍 Admin Products API called with params:', req.query);
    console.log('📊 Status parameter:', status, typeof status);

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const { getProducts } = require('../utils/productTenantHelpers');

    // Build filters
    const filters = {};
    if (category_id) filters.category_id = category_id;
    if (status) filters.status = status;
    if (slug) filters.slug = slug;
    if (sku) filters.sku = sku;
    if (id) filters.id = id;
    if (search) filters.search = search;
    if (is_custom_option === 'true' || is_custom_option === true) filters.is_custom_option = true;

    console.log('🔎 Final filters for products query:', JSON.stringify(filters, null, 2));

    // Get products from tenant database
    const { rows, count } = await getProducts(store_id, filters, { limit: parseInt(limit), offset });

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Apply images from product_files table
    console.log(`🖼️ Admin Products: Fetching images for ${rows.length} products`);
    console.log(`🖼️ Admin Products: First 3 product IDs:`, rows.slice(0, 3).map(p => p.id));
    let products = await applyProductImages(rows, tenantDb);

    // Debug: Check how many products got images
    const productsWithImages = products.filter(p => p.images && p.images.length > 0);
    console.log(`🖼️ Admin Products: ${productsWithImages.length}/${products.length} products have images`);
    if (products.length > 0 && products[0].images) {
      console.log(`🖼️ Admin Products: First product images:`, JSON.stringify(products[0].images.slice(0, 2)));
    }

    // Apply all translations if requested (for admin translation management)
    if (include_all_translations === 'true') {
      products = await applyAllProductTranslations(products, tenantDb);
    }

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count,
          total_pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Private
router.get('/:id', authAdmin, async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const { getProductById } = require('../utils/productTenantHelpers');
    const product = await getProductById(store_id, req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get tenant connection and apply images from product_files table
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const productsWithImages = await applyProductImages([product], tenantDb);

    // Apply all translations from product_translations table
    const productsWithTranslations = await applyAllProductTranslations(productsWithImages, tenantDb);

    // Load attributes from product_attribute_values table
    const productWithAttributes = productsWithTranslations[0];
    try {
      console.log(`📊 [Admin] Loading attributes for product ${product.id}`);
      const { data: pavs, error: pavError } = await tenantDb
        .from('product_attribute_values')
        .select('*')
        .eq('product_id', product.id);

      console.log(`📊 [Admin] Found ${pavs?.length || 0} product_attribute_values records`, pavError ? `Error: ${pavError.message}` : '');

      if (pavs && pavs.length > 0) {
        const attributeIds = [...new Set(pavs.map(p => p.attribute_id))];
        const valueIds = pavs.filter(p => p.value_id).map(p => p.value_id);

        const [attrsData, valsData] = await Promise.all([
          attributeIds.length > 0 ? tenantDb.from('attributes').select('id, code, type').in('id', attributeIds).then(r => r.data || []) : [],
          valueIds.length > 0 ? tenantDb.from('attribute_values').select('id, code').in('id', valueIds).then(r => r.data || []) : []
        ]);

        const attrMap = new Map(attrsData.map(a => [a.id, a]));
        const valMap = new Map(valsData.map(v => [v.id, v.code]));

        // Build attributes object {code: value} for admin form compatibility
        productWithAttributes.attributes = {};
        for (const pav of pavs) {
          const attr = attrMap.get(pav.attribute_id);
          if (!attr) continue;

          let value;
          if (pav.value_id) {
            value = valMap.get(pav.value_id);
          } else {
            value = pav.text_value || pav.number_value || pav.date_value || pav.boolean_value;
          }

          if (value !== undefined) {
            productWithAttributes.attributes[attr.code] = value;
          }
        }
        console.log(`📊 [Admin] Built attributes object:`, productWithAttributes.attributes);
      } else {
        productWithAttributes.attributes = {};
        console.log(`📊 [Admin] No attribute values found, returning empty object`);
      }
    } catch (attrErr) {
      console.error('📊 [Admin] Error loading product attributes:', attrErr);
      productWithAttributes.attributes = {};
    }

    res.json({
      success: true,
      data: productWithAttributes
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private
router.post('/',
  authAdmin,
  storeAuthMiddleware, // Check store ownership
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('sku').notEmpty().withMessage('SKU is required'),
    body('price').isDecimal().withMessage('Price must be a valid decimal'),
    body('store_id').isUUID().withMessage('Store ID must be a valid UUID')
  ], 
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, translations, formData_translations, name, description, attributes, ...productData } = req.body;

    console.log('🔍 Product creation - Full request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Product creation - separating fields:', {
      hasTranslations: !!translations,
      hasFormDataTranslations: !!formData_translations,
      hasName: !!name,
      hasDescription: !!description,
      productDataKeys: Object.keys(productData),
      translationsData: translations
    });

    // Store ownership check is now handled by middleware

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Prepare product data (exclude translation fields like name, description)
    const productToInsert = {
      ...productData,
      store_id
    };

    // Insert product using Supabase client
    const { data: product, error } = await tenantDb
      .from('products')
      .insert(productToInsert)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Product created:', product.id);

    // Handle translations if provided
    const translationsToSave = translations || {};

    // If name/description are provided directly, save as default language translation
    if (name || description) {
      const defaultLang = 'en'; // TODO: Get from store settings
      if (!translationsToSave[defaultLang]) {
        translationsToSave[defaultLang] = {};
      }
      if (name) translationsToSave[defaultLang].name = name;
      if (description) translationsToSave[defaultLang].description = description;
      console.log('📝 Added direct name/description to default language:', defaultLang);
    }

    if (Object.keys(translationsToSave).length > 0) {
      console.log('📝 Saving translations for languages:', Object.keys(translationsToSave));

      for (const [langCode, transData] of Object.entries(translationsToSave)) {
        if (transData && Object.keys(transData).length > 0) {
          console.log(`📝 Saving translation for ${langCode}:`, transData);

          const { data: savedTrans, error: transError } = await tenantDb
            .from('product_translations')
            .insert({
              product_id: product.id,
              language_code: langCode,
              name: transData.name || null,
              description: transData.description || null,
              short_description: transData.short_description || null
            })
            .select();

          if (transError) {
            console.error('❌ Error saving translation for', langCode, ':', transError);
            console.error('❌ Translation error details:', JSON.stringify(transError, null, 2));
          } else {
            console.log('✅ Saved translation for', langCode, ':', savedTrans);
          }
        }
      }
    } else {
      console.log('⚠️ No translations to save');
    }

    // Sync attributes to product_attribute_values table if provided
    if (attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
      const { syncProductAttributeValues } = require('../utils/productTenantHelpers');
      try {
        await syncProductAttributeValues(tenantDb, store_id, product.id, attributes);
        console.log('✅ Synced attributes for product:', product.id);
      } catch (attrError) {
        console.warn('⚠️ Failed to sync attributes:', attrError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);

    // Handle specific database errors
    let statusCode = 500;
    let message = 'Server error';

    // Supabase/Postgres error handling
    if (error.code === '23505') { // Unique constraint violation
      statusCode = 409;
      if (error.message.includes('products_sku_store_id_key')) {
        message = `A product with SKU "${req.body.sku}" already exists in this store`;
      } else if (error.message.includes('products_slug_store_id_key')) {
        message = `A product with slug "${req.body.slug}" already exists in this store`;
      } else {
        message = 'A product with these values already exists';
      }
    } else if (error.code === '23503') { // Foreign key constraint violation
      statusCode = 400;
      message = 'Invalid reference: Please ensure all product settings are valid';
    } else if (error.message) {
      message = error.message;
    }

    res.status(statusCode).json({
      success: false,
      message
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/:id',
  authAdmin,
  checkResourceOwnership('Product'), // Check if user owns the product's store
  [
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('sku').optional().notEmpty().withMessage('SKU cannot be empty'),
    body('price').optional().isDecimal().withMessage('Price must be a valid decimal')
  ], 
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const { getProductById, updateProduct } = require('../utils/productTenantHelpers');

    // Check if product exists
    const product = await getProductById(store_id, req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Extract translations from request body
    const { translations, ...productData } = req.body;

    // Update product data (excluding translations)
    const updatedProduct = await updateProduct(store_id, req.params.id, productData);

    // Update translations in normalized table if provided
    if (translations && Object.keys(translations).length > 0) {
      await updateProductTranslations(store_id, req.params.id, translations);
    }

    // Get tenant connection and apply images from product_files table
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const productsWithImages = await applyProductImages([updatedProduct], tenantDb);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: productsWithImages[0]
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const { getProductById, deleteProduct } = require('../utils/productTenantHelpers');

    // Check if product exists
    const product = await getProductById(store_id, req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await deleteProduct(store_id, req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/products/:id/translate
// @desc    AI translate a single product to target language
// @access  Private
router.post('/:id/translate', authAdmin, [
  body('fromLang').notEmpty().withMessage('Source language is required'),
  body('toLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { fromLang, toLang } = req.body;
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get product from tenant DB
    const { data: product, error } = await tenantDb
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .single();

    if (error || !product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if source translation exists
    const { data: sourceTranslation } = await tenantDb
      .from('product_translations')
      .select('*')
      .eq('product_id', req.params.id)
      .eq('language_code', fromLang)
      .single();

    if (!sourceTranslation) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this product`
      });
    }

    // Translate the product
    const updatedProduct = await translationService.aiTranslateEntity('product', req.params.id, fromLang, toLang);

    res.json({
      success: true,
      message: `Product translated to ${toLang} successfully`,
      data: updatedProduct
    });
  } catch (error) {
    console.error('Translate product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/products/bulk-translate
// @desc    AI translate all products in a store to target language
// @access  Private
router.post('/bulk-translate', authAdmin, [
  body('store_id').isUUID().withMessage('Store ID must be a valid UUID'),
  body('fromLang').notEmpty().withMessage('Source language is required'),
  body('toLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, fromLang, toLang } = req.body;

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get all products for this store with ALL translations from product_translations table
    const { applyAllProductTranslations } = require('../utils/productHelpers');
    const { getAllProducts } = require('../utils/productTenantHelpers');

    const productsRaw = await getAllProducts(store_id);

    // Load all translations from product_translations table
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const products = await applyAllProductTranslations(productsRaw, tenantDb);

    console.log(`📦 Loaded ${products.length} products from database with ALL translations`);
    if (products.length > 0) {
      console.log(`🔍 First product structure:`, JSON.stringify({
        id: products[0].id,
        name: products[0].name,
        translations: products[0].translations,
        hasTranslations: !!products[0].translations,
        translationKeys: products[0].translations ? Object.keys(products[0].translations) : 'none'
      }, null, 2));
    }

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'No products found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each product
    const results = {
      total: products.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting product translation: ${fromLang} → ${toLang} (${products.length} products)`);

    for (const product of products) {
      try {
        const productName = product.translations?.[fromLang]?.name || product.name || `Product ${product.id}`;

        console.log(`\n📋 Processing product: ${productName}`);
        console.log(`   - Has translations object: ${!!product.translations}`);
        console.log(`   - Has ${fromLang} translation: ${!!(product.translations && product.translations[fromLang])}`);
        console.log(`   - Translations keys:`, product.translations ? Object.keys(product.translations) : 'none');

        // Check if source translation exists
        if (!product.translations || !product.translations[fromLang]) {
          console.log(`⏭️  Skipping product "${productName}": No ${fromLang} translation`);
          results.skipped++;
          results.skippedDetails.push({
            productId: product.id,
            productName,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if ALL target fields have content (aiTranslateEntity will handle field-level merging)
        const sourceFields = Object.entries(product.translations[fromLang] || {});
        const targetTranslation = product.translations[toLang] || {};

        const allFieldsTranslated = sourceFields.every(([key, value]) => {
          if (!value || typeof value !== 'string' || !value.trim()) return true; // Ignore empty source fields
          const targetValue = targetTranslation[key];
          return targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;
        });

        if (allFieldsTranslated && sourceFields.length > 0) {
          console.log(`⏭️  Skipping product "${productName}": All fields already translated`);
          results.skipped++;
          results.skippedDetails.push({
            productId: product.id,
            productName,
            reason: `All fields already translated`
          });
          continue;
        }

        // Translate the product (field-level translation handled by aiTranslateEntity)
        console.log(`🔄 Translating product "${productName}"...`);
        await translationService.aiTranslateEntity('product', product.id, fromLang, toLang);
        console.log(`✅ Successfully translated product "${productName}"`);
        results.translated++;
      } catch (error) {
        const productName = product.translations?.[fromLang]?.name || product.name || `Product ${product.id}`;
        console.error(`❌ Error translating product "${productName}":`, error);
        results.failed++;
        results.errors.push({
          productId: product.id,
          productName,
          error: error.message
        });
      }
    }

    console.log(`✅ Product translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = products.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('product');
      actualCost = totalItems * costPerItem;

      console.log(`💰 Product bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Product Translation (${fromLang} → ${toLang})`,
          {
            fromLang,
            toLang,
            totalItems,
            translated: results.translated,
            skipped: results.skipped,
            failed: results.failed,
            note: 'Charged for all items including skipped'
          },
          null,
          'ai_translation'
        );
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} products`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (product-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate products error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;