const express = require('express');
const router = express.Router();
const ConnectionManager = require('../services/database/ConnectionManager');
const { authMiddleware } = require('../middleware/authMiddleware');
const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');

// Apply authentication middleware only if not accessed via public API
// Public API requests (like from storefront) don't need auth for reading
const conditionalAuthMiddleware = (req, res, next) => {
  // If this is a public API call (GET requests for storefront), skip auth
  if (req.method === 'GET' && req.baseUrl.includes('/public/')) {
    return next();
  }
  // For all other operations (POST, PUT, DELETE), require authentication
  return authMiddleware(req, res, next);
};

router.use(conditionalAuthMiddleware);

// Health check route for debugging
router.get('/health', async (req, res) => {
  res.json({ status: 'OK', message: 'Custom option rules API is working' });
});

// Get all custom option rules
router.get('/', async (req, res) => {
  try {
    const { store_id, order_by = '-created_at', limit, offset, is_active } = req.query;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    let query = tenantDb
      .from('custom_option_rules')
      .select('*');

    if (store_id) {
      query = query.eq('store_id', store_id);
    }

    // Filter by is_active if specified
    if (is_active === 'true' || is_active === true) {
      query = query.eq('is_active', true);
    } else if (is_active === 'false' || is_active === false) {
      query = query.eq('is_active', false);
    }

    // Handle ordering
    if (order_by) {
      const isDesc = order_by.startsWith('-');
      const field = isDesc ? order_by.substring(1) : order_by;
      query = query.order(field, { ascending: !isDesc });
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    if (offset) {
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching custom option rules:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error in GET /custom-option-rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific custom option rule
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data, error } = await tenantDb
      .from('custom_option_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Custom option rule not found' });
      }
      console.error('Error fetching custom option rule:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in GET /custom-option-rules/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new custom option rule
router.post('/', async (req, res) => {
  try {
    const {
      name,
      display_label = 'Custom Options',
      is_active = true,
      conditions = {},
      store_id,
      translations = {}
    } = req.body;

    if (!name || !store_id) {
      return res.status(400).json({
        error: 'Missing required fields: name and store_id are required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const ruleData = {
      name,
      display_label,
      is_active,
      conditions,
      store_id,
      translations,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('custom_option_rules')
      .insert([ruleData])
      .select()
      .single();

    if (error) {
      console.error('Error creating custom option rule:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error in POST /custom-option-rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a custom option rule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      display_label,
      is_active,
      conditions,
      store_id,
      translations
    } = req.body;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const updateData = {
      updated_at: new Date().toISOString()
    };

    // Only update fields that are provided
    if (name !== undefined) updateData.name = name;
    if (display_label !== undefined) updateData.display_label = display_label;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (store_id !== undefined) updateData.store_id = store_id;
    if (translations !== undefined) updateData.translations = translations;

    const { data, error } = await tenantDb
      .from('custom_option_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Custom option rule not found' });
      }
      console.error('Error updating custom option rule:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in PUT /custom-option-rules/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a custom option rule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { error } = await tenantDb
      .from('custom_option_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting custom option rule:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Custom option rule deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /custom-option-rules/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/custom-option-rules/bulk-translate
// @desc    AI translate all custom option rules in a store to target language
// @access  Private
router.post('/bulk-translate', async (req, res) => {
  try {
    const { store_id, fromLang, toLang } = req.body;

    if (!store_id || !fromLang || !toLang) {
      return res.status(400).json({
        success: false,
        message: 'store_id, fromLang, and toLang are required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get all custom option rules for this store
    const { data: rules, error } = await tenantDb
      .from('custom_option_rules')
      .select('*')
      .eq('store_id', store_id);

    if (error) {
      console.error('Error fetching custom option rules:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch custom option rules'
      });
    }

    if (!rules || rules.length === 0) {
      return res.json({
        success: true,
        message: 'No custom option rules found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each rule
    const results = {
      total: rules.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting Custom Option Rules translation: ${fromLang} → ${toLang} (${rules.length} rules)`);

    for (const rule of rules) {
      try {
        const ruleName = rule.translations?.[fromLang]?.display_label || rule.display_label || rule.name || `Rule ${rule.id}`;

        // Check if source translation exists
        if (!rule.translations || !rule.translations[fromLang]) {
          console.log(`⏭️  Skipping rule "${ruleName}": No ${fromLang} translation`);
          results.skipped++;
          results.skippedDetails.push({
            ruleId: rule.id,
            ruleName,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if target translation already exists with actual content
        const hasTargetTranslation = rule.translations[toLang] &&
          Object.values(rule.translations[toLang]).some(val =>
            typeof val === 'string' && val.trim().length > 0
          );

        if (hasTargetTranslation) {
          console.log(`⏭️  Skipping rule "${ruleName}": ${toLang} translation already exists`);
          results.skipped++;
          results.skippedDetails.push({
            ruleId: rule.id,
            ruleName,
            reason: `${toLang} translation already exists`
          });
          continue;
        }

        // Get source translation and translate each field
        console.log(`🔄 Translating rule "${ruleName}"...`);
        const sourceTranslation = rule.translations[fromLang];
        const translatedData = {};

        for (const [key, value] of Object.entries(sourceTranslation)) {
          if (typeof value === 'string' && value.trim()) {
            translatedData[key] = await translationService.aiTranslate(value, fromLang, toLang);
          }
        }

        // Save the translation
        const translations = rule.translations || {};
        translations[toLang] = translatedData;

        const { error: updateError } = await tenantDb
          .from('custom_option_rules')
          .update({
            translations,
            updated_at: new Date().toISOString()
          })
          .eq('id', rule.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`✅ Successfully translated rule "${ruleName}"`);
        results.translated++;
      } catch (error) {
        const ruleName = rule.translations?.[fromLang]?.display_label || rule.display_label || rule.name || `Rule ${rule.id}`;
        console.error(`❌ Error translating custom option rule "${ruleName}":`, error);
        results.failed++;
        results.errors.push({
          ruleId: rule.id,
          ruleName,
          error: error.message
        });
      }
    }

    console.log(`✅ Custom option rules translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = rules.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('custom_option');
      actualCost = totalItems * costPerItem;

      console.log(`💰 Custom Option bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Custom Option Translation (${fromLang} → ${toLang})`,
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
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} custom option rules`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (custom-option-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate custom option rules error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;