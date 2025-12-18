const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const translationService = require('../services/translation-service');
const creditService = require('../services/credit-service');
const ConnectionManager = require('../services/database/ConnectionManager');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// @route   GET /api/public/cms-blocks
// @desc    Get active CMS blocks for public display (redirect to working endpoint)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    
    // Redirect to the working clean endpoint
    const { store_id } = req.query;
    const queryString = new URLSearchParams(req.query).toString();
    const redirectUrl = `/api/public-cms-blocks?${queryString}`;
    
    // Internal redirect - make a request to our own working endpoint
    const axios = require('axios');
    const baseUrl = req.protocol + '://' + req.get('host');
    const fullUrl = `${baseUrl}${redirectUrl}`;
    
    const response = await axios.get(fullUrl);

    res.json(response.data);
    
  } catch (error) {
    console.error('🚨 Redirect failed, falling back to direct query:', error.message);
    
    // Fallback: execute the query directly if redirect fails
    try {
      const { store_id } = req.query;
      
      if (!store_id) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required'
        });
      }
      
      const tenantDb = await ConnectionManager.getStoreConnection(store_id);
      const { data: blocks, error } = await tenantDb
        .from('cms_blocks')
        .select('id, identifier, placement, sort_order, is_active')
        .eq('store_id', store_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('identifier', { ascending: true });

      if (error) {
        throw error;
      }
      
      res.json({
        success: true,
        data: blocks
      });
      
    } catch (fallbackError) {
      console.error('🚨 Fallback also failed:', fallbackError);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? fallbackError.message : 'Internal server error'
      });
    }
  }
});

// Helper function to check store ownership or team membership
const checkStoreAccess = async (storeId, userId, userRole) => {
  if (userRole === 'admin') return true;
  
  const { checkUserStoreAccess } = require('../utils/storeAccess');
  const access = await checkUserStoreAccess(userId, storeId);
  return !!access;
};

// @route   GET /api/cms-blocks
// @desc    Get CMS blocks (always includes all translations)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    const offset = (page - 1) * limit;
    const { getCMSBlocksWithAllTranslations } = require('../utils/cmsTenantHelpers');

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

    // Get blocks from tenant database
    const blocks = await getCMSBlocksWithAllTranslations(store_id, {});

    console.log(`🔍 CMS Blocks route - Fetched ${blocks.length} blocks with all translations from tenant DB`);

    // Apply search filter in memory if needed
    let filteredBlocks = blocks;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBlocks = blocks.filter(block => {
        // Search in English translations
        const enTitle = block.translations?.en?.title || '';
        const enContent = block.translations?.en?.content || '';
        const identifier = block.identifier || '';

        return enTitle.toLowerCase().includes(searchLower) ||
               enContent.toLowerCase().includes(searchLower) ||
               identifier.toLowerCase().includes(searchLower);
      });
    }

    // Apply pagination
    const total = filteredBlocks.length;
    const paginatedBlocks = filteredBlocks.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        blocks: paginatedBlocks,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get CMS blocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/cms-blocks/:id
// @desc    Get CMS block by ID (always includes all translations)
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    const { getCMSBlockWithAllTranslations } = require('../utils/cmsTenantHelpers');

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

    // Get block from tenant database
    const block = await getCMSBlockWithAllTranslations(store_id, req.params.id);

    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'CMS block not found'
      });
    }

    console.log(`🔍 CMS Block by ID - Fetched block ${req.params.id} with all translations from tenant DB:`, {
      blockId: block.id,
      identifier: block.identifier,
      translationKeys: Object.keys(block.translations || {})
    });

    res.json({
      success: true,
      data: block
    });
  } catch (error) {
    console.error('Get CMS block error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/cms-blocks
// @desc    Create new CMS block
// @access  Private
router.post('/', [
  body('title').notEmpty().withMessage('Block title is required'),
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

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Process placement field - ensure it's an array
    const blockData = { ...req.body };

    if (blockData.placement) {
      // Handle over-serialized JSON strings
      let placement = blockData.placement;

      // If it's a string, try to parse it multiple times to handle over-serialization
      if (typeof placement === 'string') {
        try {
          // Keep parsing until we get a proper array or can't parse anymore
          while (typeof placement === 'string' && (placement.startsWith('[') || placement.startsWith('"'))) {
            placement = JSON.parse(placement);
          }
          // If after parsing we still have a string, convert to array
          if (typeof placement === 'string') {
            placement = [placement];
          }
        } catch (e) {
          console.error('Failed to parse placement string:', e);
          placement = [blockData.placement]; // Use original string as single item
        }
      }

      // Handle arrays that contain nested serialized strings
      if (Array.isArray(placement)) {
        const cleanedPlacement = [];
        for (const item of placement) {
          if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('"'))) {
            try {
              // Try to parse nested serialized arrays
              let parsed = item;
              while (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('"'))) {
                parsed = JSON.parse(parsed);
              }
              // If we got an array, spread it; if string, add it
              if (Array.isArray(parsed)) {
                cleanedPlacement.push(...parsed);
              } else if (typeof parsed === 'string') {
                cleanedPlacement.push(parsed);
              }
            } catch (e) {
              // If parsing fails, use the original item
              cleanedPlacement.push(item);
            }
          } else {
            cleanedPlacement.push(item);
          }
        }
        placement = cleanedPlacement;
      }

      // Handle complex object format from original form
      if (typeof placement === 'object' && placement.position) {
        placement = Array.isArray(placement.position)
          ? placement.position
          : [placement.position];
      }

      // Ensure we have an array
      if (!Array.isArray(placement)) {
        placement = ['content']; // Default fallback
      }

      blockData.placement = placement;
      console.log('✅ Processed placement data (CREATE):', blockData.placement);
    } else {
      blockData.placement = ['content']; // Default fallback
    }

    // Generate UUID for the block
    const blockId = uuidv4();

    // Create block in tenant database
    const { data: block, error } = await tenantDb
      .from('cms_blocks')
      .insert({
        id: blockId,
        identifier: blockData.identifier,
        is_active: blockData.is_active !== undefined ? blockData.is_active : true,
        placement: blockData.placement,
        sort_order: blockData.sort_order || 0,
        store_id: store_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Save translations if provided
    if (blockData.translations) {
      const { saveCMSBlockTranslations } = require('../utils/cmsTenantHelpers');
      await saveCMSBlockTranslations(store_id, block.id, blockData.translations);
    }

    res.status(201).json({
      success: true,
      message: 'CMS block created successfully',
      data: block
    });
  } catch (error) {
    console.error('Create CMS block error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/cms-blocks/:id
// @desc    Update CMS block
// @access  Private
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('Block title cannot be empty')
], async (req, res) => {
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
      const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if block exists
    const { data: existingBlock, error: fetchError } = await tenantDb
      .from('cms_blocks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existingBlock) {
      return res.status(404).json({
        success: false,
        message: 'CMS block not found'
      });
    }

    // Process placement field - ensure it's an array
    const updateData = { ...req.body };

    if (updateData.placement) {
      // Handle over-serialized JSON strings
      let placement = updateData.placement;

      // If it's a string, try to parse it multiple times to handle over-serialization
      if (typeof placement === 'string') {
        try {
          // Keep parsing until we get a proper array or can't parse anymore
          while (typeof placement === 'string' && (placement.startsWith('[') || placement.startsWith('"'))) {
            placement = JSON.parse(placement);
          }
          // If after parsing we still have a string, convert to array
          if (typeof placement === 'string') {
            placement = [placement];
          }
        } catch (e) {
          console.error('Failed to parse placement string:', e);
          placement = [updateData.placement]; // Use original string as single item
        }
      }

      // Handle arrays that contain nested serialized strings
      if (Array.isArray(placement)) {
        const cleanedPlacement = [];
        for (const item of placement) {
          if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('"'))) {
            try {
              // Try to parse nested serialized arrays
              let parsed = item;
              while (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('"'))) {
                parsed = JSON.parse(parsed);
              }
              // If we got an array, spread it; if string, add it
              if (Array.isArray(parsed)) {
                cleanedPlacement.push(...parsed);
              } else if (typeof parsed === 'string') {
                cleanedPlacement.push(parsed);
              }
            } catch (e) {
              // If parsing fails, use the original item
              cleanedPlacement.push(item);
            }
          } else {
            cleanedPlacement.push(item);
          }
        }
        placement = cleanedPlacement;
      }

      // Handle complex object format from original form
      if (typeof placement === 'object' && placement.position) {
        placement = Array.isArray(placement.position)
          ? placement.position
          : [placement.position];
      }

      // Ensure we have an array
      if (!Array.isArray(placement)) {
        placement = ['content']; // Default fallback
      }

      updateData.placement = placement;
      console.log('✅ Processed placement data:', updateData.placement);
    }

    // Handle translations if provided
    const { translations, ...blockData } = updateData;

    // Build update object
    const updateFields = {};
    if (blockData.identifier !== undefined) updateFields.identifier = blockData.identifier;
    if (blockData.is_active !== undefined) updateFields.is_active = blockData.is_active;
    if (blockData.placement !== undefined) updateFields.placement = blockData.placement;
    if (blockData.sort_order !== undefined) updateFields.sort_order = blockData.sort_order;
    updateFields.updated_at = new Date().toISOString();

    // Update main block fields (excluding translations)
    const { error: updateError } = await tenantDb
      .from('cms_blocks')
      .update(updateFields)
      .eq('id', req.params.id);

    if (updateError) {
      throw updateError;
    }

    // Save translations to normalized table if provided
    if (translations && typeof translations === 'object') {
      const { saveCMSBlockTranslations } = require('../utils/cmsTenantHelpers');
      await saveCMSBlockTranslations(store_id, req.params.id, translations);
      console.log(`✅ CMS block ${req.params.id} translations saved to tenant DB`);
    }

    // Fetch updated block with all translations
    const { getCMSBlockWithAllTranslations } = require('../utils/cmsTenantHelpers');
    const updatedBlock = await getCMSBlockWithAllTranslations(store_id, req.params.id);

    res.json({
      success: true,
      message: 'CMS block updated successfully',
      data: updatedBlock
    });
  } catch (error) {
    console.error('Update CMS block error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/cms-blocks/:id
// @desc    Delete CMS block
// @access  Private
router.delete('/:id', async (req, res) => {
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
      const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if block exists
    const { data: block, error: fetchError } = await tenantDb
      .from('cms_blocks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !block) {
      return res.status(404).json({
        success: false,
        message: 'CMS block not found'
      });
    }

    // Delete translations first
    await tenantDb
      .from('cms_block_translations')
      .delete()
      .eq('cms_block_id', req.params.id);

    // Delete the block
    const { error: deleteError } = await tenantDb
      .from('cms_blocks')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'CMS block deleted successfully'
    });
  } catch (error) {
    console.error('Delete CMS block error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/cms-blocks/:id/translate
// @desc    AI translate a single CMS block to target language
// @access  Private
router.post('/:id/translate', [
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

    // Get block with all translations from tenant database
    const { getCMSBlockWithAllTranslations } = require('../utils/cmsTenantHelpers');
    const block = await getCMSBlockWithAllTranslations(store_id, req.params.id);

    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'CMS block not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists
    if (!block.translations || !block.translations[fromLang]) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this block`
      });
    }

    // Translate the block
    const updatedBlock = await translationService.aiTranslateEntity('cms_block', req.params.id, fromLang, toLang);

    res.json({
      success: true,
      message: `CMS block translated to ${toLang} successfully`,
      data: updatedBlock
    });
  } catch (error) {
    console.error('Translate CMS block error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/cms-blocks/bulk-translate
// @desc    AI translate all CMS blocks in a store to target language
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
      const hasAccess = await checkStoreAccess(store_id, req.user.id, req.user.role);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get all blocks for this store with all translations from tenant DB
    const { getCMSBlocksWithAllTranslations } = require('../utils/cmsTenantHelpers');
    const blocks = await getCMSBlocksWithAllTranslations(store_id, {});

    console.log(`📦 Loaded ${blocks.length} CMS blocks from database with ALL translations`);
    if (blocks.length > 0) {
      console.log(`🔍 First block structure:`, JSON.stringify({
        id: blocks[0].id,
        identifier: blocks[0].identifier,
        translations: blocks[0].translations,
        hasTranslations: !!blocks[0].translations,
        translationKeys: blocks[0].translations ? Object.keys(blocks[0].translations) : 'none'
      }, null, 2));
    }

    if (blocks.length === 0) {
      return res.json({
        success: true,
        message: 'No CMS blocks found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each block
    const results = {
      total: blocks.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting CMS blocks translation: ${fromLang} → ${toLang} (${blocks.length} blocks)`);

    for (const block of blocks) {
      try {
        const blockTitle = block.translations?.[fromLang]?.title || block.title || block.identifier;

        // Check if source translation exists
        if (!block.translations || !block.translations[fromLang]) {
          results.skipped++;
          results.skippedDetails.push({
            blockId: block.id,
            blockTitle,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if ALL target fields have content (field-level check)
        const sourceFields = Object.entries(block.translations[fromLang] || {});
        const targetTranslation = block.translations[toLang] || {};

        const allFieldsTranslated = sourceFields.every(([key, value]) => {
          if (!value || typeof value !== 'string' || !value.trim()) return true; // Ignore empty source fields
          const targetValue = targetTranslation[key];
          return targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;
        });

        if (allFieldsTranslated && sourceFields.length > 0) {
          console.log(`⏭️  Skipping block "${blockTitle}": All fields already translated`);
          results.skipped++;
          results.skippedDetails.push({
            blockId: block.id,
            blockTitle,
            reason: `All fields already translated`
          });
          continue;
        }

        // Translate the block
        console.log(`🔄 Translating block "${blockTitle}"...`);
        await translationService.aiTranslateEntity('cms_block', block.id, fromLang, toLang);
        console.log(`✅ Successfully translated block "${blockTitle}"`);
        results.translated++;
      } catch (error) {
        const blockTitle = block.translations?.[fromLang]?.title || block.title || block.identifier;
        console.error(`❌ Error translating CMS block "${blockTitle}":`, error);
        results.failed++;
        results.errors.push({
          blockId: block.id,
          blockTitle,
          error: error.message
        });
      }
    }

    console.log(`✅ CMS blocks translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = blocks.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('cms_block');
      actualCost = totalItems * costPerItem;

      console.log(`💰 CMS Block bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk CMS Block Translation (${fromLang} → ${toLang})`,
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
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} cms blocks`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (cms-block-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate CMS blocks error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;