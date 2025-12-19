const express = require('express');
const { body, validationResult } = require('express-validator');
const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const ConnectionManager = require('../services/database/ConnectionManager');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const {
  getCategoriesWithTranslations,
  getCategoriesWithAllTranslations,
  getCategoryById,
  createCategoryWithTranslations,
  updateCategoryWithTranslations,
  deleteCategory
} = require('../utils/categoryTenantHelpers');
const router = express.Router();

// Helper function to check store access (ownership or team membership)
const checkStoreAccess = async (storeId, userId, userRole) => {
  if (userRole === 'admin') return true;
  
  const { checkUserStoreAccess } = require('../utils/storeAccess');
  const access = await checkUserStoreAccess(userId, storeId);
  return access !== null;
};

// @route   GET /api/categories
// @desc    Get categories (authenticated users only)
// @access  Private

router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { page = 1, limit = 100, parent_id, search, include_all_translations } = req.query;
    const store_id = req.headers['x-store-id'] || req.query.store_id;
    const offset = (page - 1) * limit;

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

    const where = {};
    if (parent_id) where.parent_id = parent_id;

    const lang = getLanguageFromRequest(req);

    // Get categories with translations (all or single language)
    let categories, total;

    if (include_all_translations === 'true') {
      // For admin translation management, fetch all translations from tenant DB
      const allCategories = await getCategoriesWithAllTranslations(store_id, where);

      // Apply search filter if needed
      let filteredCategories = allCategories;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredCategories = allCategories.filter(cat =>
          cat.name?.toLowerCase().includes(searchLower) ||
          cat.description?.toLowerCase().includes(searchLower)
        );
      }

      total = filteredCategories.length;
      categories = filteredCategories.slice(offset, offset + parseInt(limit));
    } else {
      // Use optimized pagination and search from tenant DB
      const result = await getCategoriesWithTranslations(
        store_id,
        where,
        lang,
        { limit: parseInt(limit), offset, search }
      );
      categories = result.rows;
      total = result.count;
    }

    res.json({
      success: true,
      data: {
        categories: categories,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/categories/:id
// @desc    Get category by ID
// @access  Private
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
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

    const lang = getLanguageFromRequest(req);
    const category = await getCategoryById(store_id, req.params.id, lang);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/categories
// @desc    Create new category
// @access  Private
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), [
  body('name').notEmpty().withMessage('Category name is required'),
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

    console.log('🔍 POST /api/categories - Access check:', {
      user_id: req.user.id,
      user_role: req.user.role,
      store_id: store_id,
      body: req.body
    });

    // Check store access
    const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);

    console.log('🔑 Store access check result:', {
      user_id: req.user.id,
      store_id: store_id,
      hasAccess: hasAccess
    });

    if (!hasAccess) {
      console.log('❌ Access denied for user', req.user.id, 'to store', store_id);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    console.log('✅ Access granted for user', req.user.id, 'to store', store_id);

    // Extract translations from request body
    const { translations, ...categoryData } = req.body;

    const category = await createCategoryWithTranslations(store_id, categoryData, translations || {});

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), [
  body('name').optional().notEmpty().withMessage('Category name cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Get store_id from request body
    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
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

    // Extract translations from request body
    const { translations, ...categoryData } = req.body;

    const category = await updateCategoryWithTranslations(store_id, req.params.id, categoryData, translations || {});

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/categories/all
// @desc    Delete ALL categories for a store
// @access  Private (Admin/Store Owner)
router.delete('/all', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
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

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get all categories for this store (excluding root categories - those with no parent_id)
    const { data: allCategories } = await tenantDb
      .from('categories')
      .select('id, parent_id')
      .eq('store_id', store_id);

    if (!allCategories || allCategories.length === 0) {
      return res.json({
        success: true,
        message: 'No categories to delete',
        data: { deleted: 0, skippedRootCategories: 0 }
      });
    }

    // Separate root categories (no parent_id) from child categories
    const rootCategories = allCategories.filter(c => !c.parent_id);
    const categoriesToDelete = allCategories.filter(c => c.parent_id);

    if (categoriesToDelete.length === 0) {
      return res.json({
        success: true,
        message: 'No categories to delete (only root categories exist, which are protected)',
        data: { deleted: 0, skippedRootCategories: rootCategories.length }
      });
    }

    const categoryIds = categoriesToDelete.map(c => c.id);

    // Delete in order: category_translations -> categories
    // 1. Delete category_translations for non-root categories
    const { error: ctError } = await tenantDb
      .from('category_translations')
      .delete()
      .in('category_id', categoryIds);

    if (ctError) console.warn('Warning deleting category_translations:', ctError.message);

    // 2. Delete non-root categories only
    const { error: deleteError } = await tenantDb
      .from('categories')
      .delete()
      .in('id', categoryIds);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`🗑️ Deleted ${categoriesToDelete.length} categories for store ${store_id} (${rootCategories.length} root categories preserved)`);

    res.json({
      success: true,
      message: `Successfully deleted ${categoriesToDelete.length} categories (${rootCategories.length} root categories preserved)`,
      data: { deleted: categoriesToDelete.length, skippedRootCategories: rootCategories.length }
    });
  } catch (error) {
    console.error('Delete all categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private
router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    // Get store_id from query params
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
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

    await deleteCategory(store_id, req.params.id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/categories/:id/translate
// @desc    AI translate a single category to target language
// @access  Private
router.post('/:id/translate', authMiddleware, authorize(['admin', 'store_owner']), [
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

    const { fromLang, toLang, store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const category = await getCategoryById(store_id, req.params.id, fromLang);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, category.store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists (from normalized table)
    if (!category.name && !category.description) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this category`
      });
    }

    // Translate each field using AI
    const translatedData = {};
    if (category.name) {
      translatedData.name = await translationService.aiTranslate(category.name, fromLang, toLang);
    }
    if (category.description) {
      translatedData.description = await translationService.aiTranslate(category.description, fromLang, toLang);
    }

    // Save the translation using normalized tables
    const translations = {};
    translations[toLang] = translatedData;

    const updatedCategory = await updateCategoryWithTranslations(
      req.params.id,
      {},
      translations
    );

    res.json({
      success: true,
      message: `Category translated to ${toLang} successfully`,
      data: updatedCategory
    });
  } catch (error) {
    console.error('Translate category error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/categories/bulk-translate
// @desc    AI translate all categories in a store to target language
// @access  Private
router.post('/bulk-translate', authMiddleware, authorize(['admin', 'store_owner']), [
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
    const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all categories for this store with all translations from tenant DB
    const categories = await getCategoriesWithAllTranslations(store_id, {});

    if (categories.length === 0) {
      return res.json({
        success: true,
        message: 'No categories found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each category
    const results = {
      total: categories.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting category translation: ${fromLang} → ${toLang} (${categories.length} categories)`);

    for (const category of categories) {
      try {
        const categoryName = category.name || `Category ${category.id}`;

        // Check if source translation exists
        if (!category.name && !category.description) {
          console.log(`⏭️  Skipping category "${categoryName}": No ${fromLang} translation`);
          results.skipped++;
          results.skippedDetails.push({
            categoryId: category.id,
            categoryName,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if ALL target fields have content (field-level check)
        const sourceFields = Object.entries(category.translations[fromLang] || {});
        const targetTranslation = category.translations[toLang] || {};

        const allFieldsTranslated = sourceFields.every(([key, value]) => {
          if (!value || typeof value !== 'string' || !value.trim()) return true; // Ignore empty source fields
          const targetValue = targetTranslation[key];
          return targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;
        });

        if (allFieldsTranslated && sourceFields.length > 0) {
          console.log(`⏭️  Skipping category "${categoryName}": All fields already translated`);
          results.skipped++;
          results.skippedDetails.push({
            categoryId: category.id,
            categoryName,
            reason: `All fields already translated`
          });
          continue;
        }

        // Translate the category (uses aiTranslateEntity for field-level translation)
        console.log(`🔄 Translating category "${categoryName}"...`);
        await translationService.aiTranslateEntity('category', category.id, fromLang, toLang);
        console.log(`✅ Successfully translated category "${categoryName}"`);
        results.translated++;
      } catch (error) {
        const categoryName = category.name || `Category ${category.id}`;
        console.error(`❌ Error translating category "${categoryName}":`, error);
        results.failed++;
        results.errors.push({
          categoryId: category.id,
          categoryName,
          error: error.message
        });
      }
    }

    console.log(`✅ Category translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = categories.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('category');
      actualCost = totalItems * costPerItem;

      console.log(`💰 Category bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Category Translation (${fromLang} → ${toLang})`,
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
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} categories`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (category-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate categories error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;