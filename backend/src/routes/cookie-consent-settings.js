const express = require('express');
const { body, validationResult } = require('express-validator');
const ConnectionManager = require('../services/database/ConnectionManager');
const { Op } = require('sequelize');
const { authorize } = require('../middleware/auth');
const { authMiddleware } = require('../middleware/authMiddleware');
const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const {
  getCookieConsentSettingsWithTranslations,
  getCookieConsentSettingsById,
  createCookieConsentSettingsWithTranslations,
  updateCookieConsentSettingsWithTranslations,
  deleteCookieConsentSettings
} = require('../utils/cookieConsentHelpers');
const router = express.Router();

// Helper function to check store access (ownership or team membership)
const checkStoreAccess = async (storeId, userId, userRole) => {
  if (userRole === 'admin') return true;
  
  const { checkUserStoreAccess } = require('../utils/storeAccess');
  const access = await checkUserStoreAccess(userId, storeId);
  return access !== null;
};

// @route   GET /api/cookie-consent-settings
// @desc    Get cookie consent settings
// @access  Public/Private
router.get('/', async (req, res) => {
  try {
    const { store_id } = req.query;
    
    // Check if this is a public request
    const isPublicRequest = req.originalUrl.includes('/api/public/cookie-consent-settings');
    const where = {};
    
    if (isPublicRequest) {
      // Public access - only return settings for specific store
      if (store_id) where.store_id = store_id;
    } else {
      // Authenticated access - check authentication
      if (!req.user) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }
      
      // Filter by store access (ownership + team membership)
      if (req.user.role !== 'admin') {
        const { getUserStoresForDropdown } = require('../utils/storeAccess');
        const accessibleStores = await getUserStoresForDropdown(req.user.id);
        const storeIds = accessibleStores.map(store => store.id);
        console.log(`GET cookie-consent-settings: User ${req.user.id} has access to stores:`, storeIds);
        console.log(`Requested store_id: ${store_id}`);
        console.log(`Store ${store_id} is accessible:`, storeIds.includes(store_id));
        where.store_id = { [Op.in]: storeIds };
      }

      if (store_id) {
        where.store_id = store_id;
      }
    }

    const lang = getLanguageFromRequest(req);

    // If store_id is specified, use it for the helper function
    // Note: store_id is required for getCookieConsentSettingsWithTranslations
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id parameter is required'
      });
    }

    const settings = await getCookieConsentSettingsWithTranslations(store_id, where, lang);

    if (isPublicRequest) {
      // Return just the array for public requests (for compatibility)
      res.json(settings);
    } else {
      // Return wrapped response for authenticated requests
      res.json({
        success: true,
        data: settings
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/cookie-consent-settings/:id
// @desc    Get cookie consent settings by ID
// @access  Private
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.query;
    const lang = getLanguageFromRequest(req);

    // Store ID is required to query the tenant database
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id query parameter is required'
      });
    }

    // Now get the full settings with translations using the correct store_id
    const settings = await getCookieConsentSettingsById(store_id, req.params.id, lang);

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Get tenant connection for store access check
    const tenantDb = await ConnectionManager.getStoreConnection(settings.store_id);

    const { data: storeInfo } = await tenantDb
      .from('stores')
      .select('id', 'name', 'user_id')
      .eq('id', settings.store_id)
      .single();

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, settings.store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get cookie consent settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/cookie-consent-settings
// @desc    Create or update cookie consent settings (upsert based on store_id)
// @access  Private
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), [
  body('store_id').isUUID().withMessage('Store ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id } = req.body;

    // Check store access
    const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Extract translations from request body
    const { translations, ...settingsData } = req.body;

    console.log('Cookie consent POST - translations from request:', JSON.stringify(translations, null, 2));
    console.log('Cookie consent POST - settingsData:', JSON.stringify(settingsData, null, 2));

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // UPSERT: Check if settings already exist for this store
    const { data: existingSettings } = await tenantDb
      .from('cookie_consent_settings')
      .select('*')
      .eq('store_id', store_id)
      .maybeSingle();

    let settings;
    let isNew = false;

    if (existingSettings) {
      // Update existing settings
      settings = await updateCookieConsentSettingsWithTranslations(
        store_id,
        existingSettings.id,
        settingsData,
        translations || {}
      );
    } else {
      // Create new settings
      settings = await createCookieConsentSettingsWithTranslations(store_id, settingsData, translations || {});
      isNew = true;
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Cookie consent settings created successfully' : 'Cookie consent settings updated successfully',
      data: settings,
      isNew
    });
  } catch (error) {
    console.error('Create/Update cookie consent settings error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Store ID:', req.body.store_id);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      details: error.errors?.map(e => ({field: e.path, message: e.message})) || null
    });
  }
});

// @route   PUT /api/cookie-consent-settings/:id
// @desc    Update cookie consent settings
// @access  Private
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    // Get store_id from request
    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Get full settings with translations
    const existingSettingsData = await getCookieConsentSettingsById(store_id, req.params.id);
    if (!existingSettingsData) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(existingSettingsData.store_id);

    // Get the full model instance
    const { data: existingSettings } = await tenantDb
      .from('cookie_consent_settings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!existingSettings) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, existingSettings.store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Extract translations from request body
    const { translations, ...settingsData } = req.body;

    // Update using helper
    const settings = await updateCookieConsentSettingsWithTranslations(
      existingSettings.store_id,
      req.params.id,
      settingsData,
      translations || {}
    );

    res.json({
      success: true,
      message: 'Cookie consent settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/cookie-consent-settings/:id
// @desc    Delete cookie consent settings
// @access  Private
router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    // Get store_id from query params for DELETE requests
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id query parameter is required'
      });
    }

    // Get full settings with translations
    const existingSettingsData = await getCookieConsentSettingsById(store_id, req.params.id);
    if (!existingSettingsData) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(existingSettingsData.store_id);

    const { data: settings } = await tenantDb
      .from('cookie_consent_settings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, settings.store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await deleteCookieConsentSettings(settings.store_id, req.params.id);

    res.json({
      success: true,
      message: 'Cookie consent settings deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/cookie-consent-settings/:id/translate
// @desc    AI translate cookie consent settings to target language
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

    // Get store_id from request
    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Get full settings with translations
    const existingSettingsData = await getCookieConsentSettingsById(store_id, req.params.id);
    if (!existingSettingsData) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(existingSettingsData.store_id);

    const { data: settings } = await tenantDb
      .from('cookie_consent_settings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    // Get store separately since we can't join across tables
    const { data: Store } = await tenantDb
      .from('stores')
      .select('id', 'name', 'user_id')
      .eq('id', settings.store_id)
      .single();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Cookie consent settings not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, Store.id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists
    if (!settings.translations || !settings.translations[fromLang]) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for cookie consent settings`
      });
    }

    // Translate the settings
    const updatedSettings = await translationService.aiTranslateEntity('cookie_consent', req.params.id, fromLang, toLang);

    res.json({
      success: true,
      message: `Cookie consent settings translated to ${toLang} successfully`,
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/cookie-consent-settings/bulk-translate
// @desc    AI translate all cookie consent settings in a store to target language
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

    // Get tenant connection
    const connection = await ConnectionManager.getStoreConnection(store_id);

    // Get cookie consent settings for this store with ALL translations
    const lang = getLanguageFromRequest(req);
    const settingsRecords = await getCookieConsentSettingsWithTranslations(store_id, { store_id }, lang);

    if (settingsRecords.length === 0) {
      return res.json({
        success: true,
        message: 'No cookie consent settings found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each settings record
    const results = {
      total: settingsRecords.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    for (const settings of settingsRecords) {
      try {
        const settingsName = settings.translations?.[fromLang]?.banner_text || `Settings ${settings.id}`;

        // Check if source translation exists
        if (!settings.translations || !settings.translations[fromLang]) {
          results.skipped++;
          results.skippedDetails.push({
            settingsId: settings.id,
            settingsName,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if ALL fields are translated (field-level check like Product Labels)
        const sourceFields = Object.entries(settings.translations[fromLang] || {});
        const targetTranslation = settings.translations[toLang] || {};

        const allFieldsTranslated = sourceFields.every(([key, value]) => {
          if (!value || typeof value !== 'string' || !value.trim()) return true; // Ignore empty source fields
          const targetValue = targetTranslation[key];
          return targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;
        });

        if (allFieldsTranslated && sourceFields.length > 0) {
          results.skipped++;
          results.skippedDetails.push({
            settingsId: settings.id,
            settingsName,
            reason: `All fields already translated`
          });
          continue;
        }

        // Translate the settings (only empty fields)
        const sourceTranslation = settings.translations[fromLang];

        // Start with existing target translation (preserve already translated fields)
        const translatedData = { ...(targetTranslation || {}) };

        let fieldCount = 0;
        for (const [key, value] of Object.entries(sourceTranslation)) {
          const targetValue = translatedData[key];
          const targetHasContent = targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;

          if (typeof value === 'string' && value.trim() && !targetHasContent) {
            translatedData[key] = await translationService.aiTranslate(value, fromLang, toLang);
            fieldCount++;
          }
        }

        // Save the translation using normalized tables
        const translations = settings.translations || {};
        translations[toLang] = translatedData;

        await updateCookieConsentSettingsWithTranslations(store_id, settings.id, {}, translations);
        results.translated++;
      } catch (error) {
        const settingsName = settings.translations?.[fromLang]?.banner_title || `Settings ${settings.id}`;
        results.failed++;
        results.errors.push({
          settingsId: settings.id,
          settingsName,
          error: error.message
        });
      }
    }

    // Deduct credits for ALL items (including skipped)
    const totalItems = settingsRecords.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('cookie_consent');
      actualCost = totalItems * costPerItem;

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Cookie Consent Translation (${fromLang} → ${toLang})`,
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
      } catch (deductError) {
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;