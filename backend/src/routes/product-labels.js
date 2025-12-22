const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const ConnectionManager = require('../services/database/ConnectionManager');
const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * Get product labels with translations from JSONB column
 */
async function getProductLabelsWithTranslations(tenantDb, where = {}, lang = 'en', allTranslations = false) {
  // Build query for product labels using Supabase syntax
  let query = tenantDb
    .from('product_labels')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('priority', { ascending: false })
    .order('name', { ascending: true });

  // Apply where conditions
  Object.entries(where).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data: labels, error } = await query;
  if (error) throw new Error(error.message);

  if (!labels || labels.length === 0) return [];

  if (allTranslations) {
    // Return labels with translations object as-is from JSONB column
    return labels.map(label => ({
      ...label,
      translations: label.translations || {}
    }));
  }

  // Single language mode - merge translation into label fields
  return labels.map(label => {
    const trans = label.translations || {};
    const reqLang = trans[lang];
    const enLang = trans['en'];

    return {
      ...label,
      name: reqLang?.name || enLang?.name || label.name,
      text: reqLang?.text || enLang?.text || label.text
    };
  });
}

/**
 * Get single product label with ALL translations from JSONB column
 */
async function getProductLabelWithAllTranslations(tenantDb, id) {
  const { data: label, error } = await tenantDb
    .from('product_labels')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!label) return null;

  // Ensure translations object exists
  return {
    ...label,
    translations: label.translations || {}
  };
}

/**
 * Create product label with translations stored in JSONB column
 */
async function createProductLabelWithTranslations(tenantDb, labelData, translations = {}) {
  // Insert product label with translations JSONB
  const now = new Date().toISOString();
  const { data: label, error: insertError } = await tenantDb
    .from('product_labels')
    .insert({
      id: uuidv4(),
      store_id: labelData.store_id,
      name: labelData.name || '',
      slug: labelData.slug,
      text: labelData.text || '',
      background_color: labelData.background_color,
      color: labelData.color || labelData.text_color,
      position: labelData.position || 'top-right',
      priority: labelData.priority || 0,
      sort_order: labelData.sort_order || 0,
      is_active: labelData.is_active !== false,
      conditions: labelData.conditions || {},
      translations: translations,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  return {
    ...label,
    translations: label.translations || {}
  };
}

/**
 * Update product label with translations stored in JSONB column
 */
async function updateProductLabelWithTranslations(tenantDb, id, labelData, translations = {}) {
  // First get existing label to merge translations
  const { data: existingLabel } = await tenantDb
    .from('product_labels')
    .select('translations')
    .eq('id', id)
    .single();

  // Merge existing translations with new ones
  const existingTranslations = existingLabel?.translations || {};
  const mergedTranslations = { ...existingTranslations };

  // Update/add each language translation
  for (const [langCode, data] of Object.entries(translations)) {
    if (data && (data.name !== undefined || data.text !== undefined)) {
      mergedTranslations[langCode] = {
        ...(mergedTranslations[langCode] || {}),
        ...data
      };
      console.log('🔍 Updating product label translation:', { langCode, data });
    }
  }

  // Build update object
  const updateData = {
    updated_at: new Date().toISOString(),
    translations: mergedTranslations
  };

  if (labelData.name !== undefined) updateData.name = labelData.name;
  if (labelData.slug !== undefined) updateData.slug = labelData.slug;
  if (labelData.text !== undefined) updateData.text = labelData.text;
  if (labelData.background_color !== undefined) updateData.background_color = labelData.background_color;
  if (labelData.color !== undefined) updateData.color = labelData.color;
  if (labelData.text_color !== undefined) updateData.color = labelData.text_color;
  if (labelData.position !== undefined) updateData.position = labelData.position;
  if (labelData.priority !== undefined) updateData.priority = labelData.priority;
  if (labelData.sort_order !== undefined) updateData.sort_order = labelData.sort_order;
  if (labelData.is_active !== undefined) updateData.is_active = labelData.is_active;
  if (labelData.conditions !== undefined) updateData.conditions = labelData.conditions;

  const { data: label, error: updateError } = await tenantDb
    .from('product_labels')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return {
    ...label,
    translations: label.translations || {}
  };
}

/**
 * Delete product label (translations are CASCADE deleted)
 */
async function deleteProductLabel(tenantDb, id) {
  const { error } = await tenantDb
    .from('product_labels')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

// @route   GET /api/product-labels
// @desc    Get all product labels for a store (authenticated)
// @access  Private
router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id, is_active } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const whereClause = { store_id };

    // Authenticated access - filter by is_active if provided
    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true';
    }

    const lang = getLanguageFromRequest(req);
    console.log('🌍 Product Labels (Admin): Requesting language:', lang, 'Headers:', {
      'x-language': req.headers['x-language'],
      'accept-language': req.headers['accept-language'],
      'query-lang': req.query.lang
    });

    // Authenticated requests get all translations
    const labels = await getProductLabelsWithTranslations(tenantDb, whereClause, lang, true);
    console.log('🏷️ Product Labels (Admin): Retrieved', labels.length, 'labels for language:', lang, labels.slice(0, 2));

    // Return wrapped response for authenticated requests
    res.json({
      success: true,
      data: { product_labels: labels }
    });
  } catch (error) {
    console.error('Get product labels error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/product-labels/:id
// @desc    Get single product label with all translations
// @access  Private
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const label = await getProductLabelWithAllTranslations(tenantDb, req.params.id);

    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Product label not found'
      });
    }

    console.log('📝 Backend: Loaded product label with translations:', {
      id: label.id,
      name: label.name,
      text: label.text,
      translations: label.translations,
      translationKeys: Object.keys(label.translations || {}),
      fullTranslations: JSON.stringify(label.translations, null, 2)
    });

    res.json({
      success: true,
      data: label
    });
  } catch (error) {
    console.error('Get product label error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/product-labels/test
// @desc    Create a test product label for debugging
// @access  Private
router.post('/test', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    console.log('🧪 Creating test product label...');

    const store_id = req.body.store_id || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const testLabelData = {
      store_id,
      name: 'Test Label - Debug',
      slug: 'test-label-debug',
      text: 'TEST',
      background_color: '#FF0000',
      color: '#FFFFFF',
      position: 'top-right',
      is_active: true,
      conditions: {}
    };

    console.log('🧪 Test label data:', testLabelData);

    const label = await createProductLabelWithTranslations(tenantDb, testLabelData, {});
    console.log('✅ Test label created successfully:', label);

    res.status(201).json({
      success: true,
      data: label,
      message: 'Test label created successfully'
    });
  } catch (error) {
    console.error('❌ Create test label error:', error);
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
      error: error.name
    });
  }
});

// @route   POST /api/product-labels
// @desc    Create a new product label
// @access  Private
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    console.log('🔍 Creating product label with data:', req.body);
    console.log('🔍 Priority field debug (backend):', {
      priority: req.body.priority,
      priorityType: typeof req.body.priority,
      sort_order: req.body.sort_order,
      sortOrderType: typeof req.body.sort_order
    });

    const store_id = req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Extract translations from request body
    const { translations, ...labelData } = req.body;

    console.log('🌍 Translations received from frontend:', {
      translations,
      translationKeys: Object.keys(translations || {}),
      translationValues: translations
    });

    // Ensure slug is generated if not provided (fallback for hook issues)
    if (!labelData.slug && labelData.name) {
      labelData.slug = labelData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      console.log('🔧 Fallback slug generation:', labelData.slug);
    }

    const label = await createProductLabelWithTranslations(tenantDb, labelData, translations || {});
    console.log('✅ Product label created successfully:', label);
    console.log('✅ Created label priority field:', {
      priority: label.priority,
      sort_order: label.sort_order
    });
    res.status(201).json({
      success: true,
      data: label
    });
  } catch (error) {
    console.error('❌ Create product label error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
      error: error.name
    });
  }
});

// @route   PUT /api/product-labels/:id
// @desc    Update product label
// @access  Private
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    console.log('🔍 Updating product label with data:', req.body);
    console.log('🔍 Priority field debug (backend update):', {
      priority: req.body.priority,
      priorityType: typeof req.body.priority,
      sort_order: req.body.sort_order,
      sortOrderType: typeof req.body.sort_order
    });

    const store_id = req.headers['x-store-id'] || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if label exists
    const { data: existingLabel } = await tenantDb
      .from('product_labels')
      .select('id, store_id')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!existingLabel) {
      return res.status(404).json({
        success: false,
        message: 'Product label not found'
      });
    }

    // Extract translations from request body
    const { translations, ...labelData } = req.body;

    console.log('🌍 Translations received from frontend:', {
      translations,
      translationKeys: Object.keys(translations || {}),
      translationValues: translations
    });

    const label = await updateProductLabelWithTranslations(tenantDb, req.params.id, labelData, translations || {});
    console.log('✅ Updated label priority field:', {
      priority: label.priority,
      sort_order: label.sort_order
    });
    res.json({
      success: true,
      data: label
    });
  } catch (error) {
    console.error('Update product label error:', error);
    console.error('Update product label error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// @route   DELETE /api/product-labels/:id
// @desc    Delete product label
// @access  Private
router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if label exists
    const { data: label } = await tenantDb
      .from('product_labels')
      .select('id, store_id')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Product label not found'
      });
    }

    await deleteProductLabel(tenantDb, req.params.id);

    res.json({
      success: true,
      message: 'Product label deleted successfully'
    });
  } catch (error) {
    console.error('Delete product label error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/product-labels/:id/translate
// @desc    AI translate a single product label to target language
// @access  Private
router.post('/:id/translate', authMiddleware, [
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
    const store_id = req.headers['x-store-id'] || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const productLabel = await getProductLabelWithAllTranslations(tenantDb, req.params.id);

    if (!productLabel) {
      return res.status(404).json({
        success: false,
        message: 'Product label not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, productLabel.store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists
    if (!productLabel.translations || !productLabel.translations[fromLang]) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this product label`
      });
    }

    // Get source translation
    const sourceTranslation = productLabel.translations[fromLang];
    const translatedData = {};

    // Translate each field using AI
    for (const [key, value] of Object.entries(sourceTranslation)) {
      if (typeof value === 'string' && value.trim()) {
        translatedData[key] = await translationService.aiTranslate(value, fromLang, toLang);
      }
    }

    // Save the translation using normalized tables
    const translations = productLabel.translations || {};
    translations[toLang] = translatedData;

    const updatedLabel = await updateProductLabelWithTranslations(
      tenantDb,
      req.params.id,
      {},
      translations
    );

    res.json({
      success: true,
      message: `Product label translated to ${toLang} successfully`,
      data: updatedLabel
    });
  } catch (error) {
    console.error('Translate product label error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/product-labels/bulk-translate
// @desc    AI translate all product labels in a store to target language
// @access  Private
router.post('/bulk-translate', authMiddleware, [
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

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get all product labels for this store with ALL translations
    const lang = getLanguageFromRequest(req);
    const labels = await getProductLabelsWithTranslations(tenantDb, { store_id }, lang, true);

    if (labels.length === 0) {
      return res.json({
        success: true,
        message: 'No product labels found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each label
    const results = {
      total: labels.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting Product Labels translation: ${fromLang} → ${toLang} (${labels.length} Product Labels)`);

    for (const label of labels) {
      try {
        const labelText = label.translations?.[fromLang]?.text || label.text || `Label ${label.id}`;

        // Check if source translation exists
        if (!label.translations || !label.translations[fromLang]) {
          console.log(`⏭️  Skipping label "${labelText}": No ${fromLang} translation`);
          results.skipped++;
          results.skippedDetails.push({
            labelId: label.id,
            labelText,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if target translation already exists with actual content
        const hasTargetTranslation = label.translations[toLang] &&
          Object.values(label.translations[toLang]).some(val =>
            typeof val === 'string' && val.trim().length > 0
          );

        if (hasTargetTranslation) {
          console.log(`⏭️  Skipping label "${labelText}": ${toLang} translation already exists`);
          results.skipped++;
          results.skippedDetails.push({
            labelId: label.id,
            labelText,
            reason: `${toLang} translation already exists`
          });
          continue;
        }

        // Get source translation and translate each field
        console.log(`🔄 Translating label "${labelText}"...`);
        const sourceTranslation = label.translations[fromLang];
        const translatedData = {};

        for (const [key, value] of Object.entries(sourceTranslation)) {
          if (typeof value === 'string' && value.trim()) {
            translatedData[key] = await translationService.aiTranslate(value, fromLang, toLang);
          }
        }

        // Save the translation using normalized tables
        const translations = label.translations || {};
        translations[toLang] = translatedData;

        await updateProductLabelWithTranslations(tenantDb, label.id, {}, translations);
        console.log(`✅ Successfully translated label "${labelText}"`);
        results.translated++;
      } catch (error) {
        const labelText = label.translations?.[fromLang]?.text || label.text || `Label ${label.id}`;
        console.error(`❌ Error translating product label "${labelText}":`, error);
        results.failed++;
        results.errors.push({
          labelId: label.id,
          labelText,
          error: error.message
        });
      }
    }

    console.log(`✅ Product labels translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = labels.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('product_label');
      actualCost = totalItems * costPerItem;

      console.log(`💰 Product Label bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Product Label Translation (${fromLang} → ${toLang})`,
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
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} product labels`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (product-label-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate product labels error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;
