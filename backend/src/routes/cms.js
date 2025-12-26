const express = require('express');
const { body, validationResult } = require('express-validator');
const ConnectionManager = require('../services/database/ConnectionManager');
const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const {
  getCMSPageWithAllTranslations,
  getCMSPagesWithAllTranslations,
  saveCMSPageTranslations
} = require('../utils/cmsTenantHelpers');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Basic CRUD operations for CMS pages
router.get('/', async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get pages (system pages first, then by created_at)
    const { data: pages, error: pagesError, count } = await tenantDb
      .from('cms_pages')
      .select('*', { count: 'exact' })
      .eq('store_id', store_id)
      .order('is_system', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (pagesError) {
      throw new Error(pagesError.message);
    }

    // Load all translations for pages
    const pageIds = (pages || []).map(p => p.id);
    let translations = [];

    if (pageIds.length > 0) {
      const { data: trans } = await tenantDb
        .from('cms_page_translations')
        .select('*')
        .in('cms_page_id', pageIds);

      translations = trans || [];
    }

    // Group translations by page
    const transByPage = {};
    translations.forEach(t => {
      if (!transByPage[t.cms_page_id]) transByPage[t.cms_page_id] = {};
      transByPage[t.cms_page_id][t.language_code] = t;
    });

    // Add translations to pages
    const pagesWithTranslations = (pages || []).map(page => ({
      ...page,
      translations: transByPage[page.id] || {}
    }));

    res.json({
      success: true,
      data: {
        pages: pagesWithTranslations,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching CMS pages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Use helper to get page with all translations
    const page = await getCMSPageWithAllTranslations(store_id, req.params.id);

    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, page.store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: page });
  } catch (error) {
    console.error('Error fetching CMS page:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.post('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id, translations, ...pageData } = req.body;

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    console.log('Creating CMS page with data:', JSON.stringify({ ...pageData, store_id }, null, 2));

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Generate UUID for the page
    const pageId = uuidv4();

    // Create the page without translations
    const { data: page, error: pageError } = await tenantDb
      .from('cms_pages')
      .insert({
        id: pageId,
        ...pageData,
        store_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pageError) {
      throw new Error(pageError.message);
    }

    console.log('CMS page created successfully:', page.id);

    // Save translations to normalized table
    if (translations) {
      await saveCMSPageTranslations(store_id, page.id, translations);
      console.log('CMS page translations saved successfully');
    }

    // Fetch page with all translations to return
    const pageWithTranslations = await getCMSPageWithAllTranslations(store_id, page.id);

    res.status(201).json({ success: true, message: 'Page created successfully', data: pageWithTranslations });
  } catch (error) {
    console.error('Error creating CMS page:', error);
    console.error('Error details:', error.message);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get the page first to check if it exists
    const { data: page, error: fetchError } = await tenantDb
      .from('cms_pages')
      .select('*')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, page.store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { translations, ...pageData } = req.body;

    console.log('Updating CMS page:', req.params.id, 'with data:', JSON.stringify(pageData, null, 2));

    // Update page without translations
    const { error: updateError } = await tenantDb
      .from('cms_pages')
      .update({
        ...pageData,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('store_id', store_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log('CMS page updated successfully:', req.params.id);

    // Save translations to normalized table
    if (translations) {
      await saveCMSPageTranslations(store_id, req.params.id, translations);
      console.log('CMS page translations saved successfully');
    }

    // Fetch page with all translations to return
    const pageWithTranslations = await getCMSPageWithAllTranslations(store_id, req.params.id);

    res.json({ success: true, message: 'Page updated successfully', data: pageWithTranslations });
  } catch (error) {
    console.error('Error updating CMS page:', error);
    console.error('Error details:', error.message);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

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

    // Get the page first to check if it exists
    const { data: page, error: fetchError } = await tenantDb
      .from('cms_pages')
      .select('*')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    // Prevent deletion of system pages
    if (page.is_system) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete system pages. System pages like 404 are critical for site functionality.'
      });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, page.store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Delete translations first
    await tenantDb
      .from('cms_page_translations')
      .delete()
      .eq('cms_page_id', req.params.id);

    // Delete the page
    const { error: deleteError } = await tenantDb
      .from('cms_pages')
      .delete()
      .eq('id', req.params.id)
      .eq('store_id', store_id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting CMS page:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   POST /api/cms-pages/:id/translate
// @desc    AI translate a single CMS page to target language
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

    // Get the page with all translations
    const page = await getCMSPageWithAllTranslations(store_id, req.params.id);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'CMS page not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, page.store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists
    if (!page.translations || !page.translations[fromLang]) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this page`
      });
    }

    // Translate the page
    const updatedPage = await translationService.aiTranslateEntity('cms_page', req.params.id, fromLang, toLang);

    res.json({
      success: true,
      message: `CMS page translated to ${toLang} successfully`,
      data: updatedPage
    });
  } catch (error) {
    console.error('Translate CMS page error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/cms-pages/bulk-translate
// @desc    AI translate all CMS pages in a store to target language
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

    // Get all pages for this store with all translations
    const pages = await getCMSPagesWithAllTranslations(store_id, { store_id });

    if (pages.length === 0) {
      return res.json({
        success: true,
        message: 'No CMS pages found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each page
    const results = {
      total: pages.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting CMS page translation: ${fromLang} → ${toLang} (${pages.length} pages)`);

    for (const page of pages) {
      try {
        const pageTitle = page.translations?.[fromLang]?.title || page.title || page.slug || `Page ${page.id}`;

        // Check if source translation exists
        if (!page.translations || !page.translations[fromLang]) {
          console.log(`⏭️  Skipping page "${pageTitle}": No ${fromLang} translation`);
          results.skipped++;
          results.skippedDetails.push({
            pageId: page.id,
            pageTitle,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if ALL target fields have content (field-level check)
        const sourceFields = Object.entries(page.translations[fromLang] || {});
        const targetTranslation = page.translations[toLang] || {};

        const allFieldsTranslated = sourceFields.every(([key, value]) => {
          if (!value || typeof value !== 'string' || !value.trim()) return true; // Ignore empty source fields
          const targetValue = targetTranslation[key];
          return targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;
        });

        if (allFieldsTranslated && sourceFields.length > 0) {
          console.log(`⏭️  Skipping page "${pageTitle}": All fields already translated`);
          results.skipped++;
          results.skippedDetails.push({
            pageId: page.id,
            pageTitle,
            reason: `All fields already translated`
          });
          continue;
        }

        // Translate the page
        console.log(`🔄 Translating page "${pageTitle}"...`);
        await translationService.aiTranslateEntity('cms_page', page.id, fromLang, toLang);
        console.log(`✅ Successfully translated page "${pageTitle}"`);
        results.translated++;
      } catch (error) {
        const pageTitle = page.translations?.[fromLang]?.title || page.title || page.slug || `Page ${page.id}`;
        console.error(`❌ Error translating CMS page "${pageTitle}":`, error);
        results.failed++;
        results.errors.push({
          pageId: page.id,
          pageTitle,
          error: error.message
        });
      }
    }

    console.log(`✅ CMS page translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = pages.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('cms_page');
      actualCost = totalItems * costPerItem;

      console.log(`💰 CMS Page bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk CMS Page Translation (${fromLang} → ${toLang})`,
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
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} cms pages`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (cms-page-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate CMS pages error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;