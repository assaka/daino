const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ConnectionManager = require('../services/database/ConnectionManager');
const abTestingService = require('../services/analytics/ABTestingServiceSupabase');
const path = require('path');
const { pathToFileURL } = require('url');

// Helper functions to load configuration files from the frontend config directory
async function loadPageConfig(pageType) {
  try {
    const configsDir = path.resolve(__dirname, '../../../src/components/editor/slot/configs');
    let configPath, configExport;

    switch (pageType) {
      case 'cart':
        configPath = path.join(configsDir, 'cart-config.js');
        configExport = 'cartConfig';
        break;
      case 'category':
        configPath = path.join(configsDir, 'category-config.js');
        configExport = 'categoryConfig';
        break;
      case 'product':
        configPath = path.join(configsDir, 'product-config.js');
        configExport = 'productConfig';
        break;
      case 'checkout':
        configPath = path.join(configsDir, 'checkout-config.js');
        configExport = 'checkoutConfig';
        break;
      case 'success':
        configPath = path.join(configsDir, 'success-config.js');
        configExport = 'successConfig';
        break;
      case null:
      case undefined:
        throw new Error('pageType is required but was not provided');
      default:
        throw new Error(`Unknown page type '${pageType}'. Supported types: cart, category, product, checkout, success`);
    }

    // Convert to file:// URL for cross-platform ESM import compatibility
    const configUrl = pathToFileURL(configPath).href;
    const configModule = await import(configUrl);
    const config = configModule[configExport];

    if (!config) {
      throw new Error(`Config export '${configExport}' not found in ${configPath}`);
    }

    // Strip non-serializable data (React components, functions) for JSON storage
    const serializableConfig = JSON.parse(JSON.stringify(config, (key, value) => {
      // Skip functions and React components
      if (typeof value === 'function') return undefined;
      // Skip $$typeof (React element marker)
      if (key === '$$typeof') return undefined;
      return value;
    }));

    return serializableConfig;
  } catch (error) {
    console.error(`Failed to load ${pageType}-config.js:`, error);
    // Fallback to minimal config if import fails
    return {
      page_name: pageType.charAt(0).toUpperCase() + pageType.slice(1),
      slot_type: `${pageType}_layout`,
      slots: {},
      rootSlots: [],
      slotDefinitions: {},
      metadata: {}
    };
  }
}

// Helper: Find latest published configuration
async function findLatestPublished(storeId, pageType) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data, error } = await tenantDb
    .from('slot_configurations')
    .select('*')
    .eq('store_id', storeId)
    .eq('page_type', pageType)
    .eq('status', 'published')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Helper: Find latest acceptance configuration
async function findLatestAcceptance(storeId, pageType) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data, error } = await tenantDb
    .from('slot_configurations')
    .select('*')
    .eq('store_id', storeId)
    .eq('page_type', pageType)
    .eq('status', 'acceptance')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Helper: Find latest draft (includes both init and draft status)
async function findLatestDraft(userId, storeId, pageType) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data, error } = await tenantDb
    .from('slot_configurations')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('page_type', pageType)
    .in('status', ['init', 'draft'])
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Helper: Find configuration by ID
async function findById(configId, storeId) {
  if (!storeId) {
    throw new Error('storeId is required for findById');
  }
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data, error } = await tenantDb
    .from('slot_configurations')
    .select('*')
    .eq('id', configId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Helper: Upsert draft configuration
async function upsertDraft(userId, storeId, pageType, configuration = null, isNewChanges = true, isReset = false) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  // Try to find existing draft or init record
  const existingRecord = await findLatestDraft(userId, storeId, pageType);

  if (existingRecord) {
    // Handle init->draft transition
    if (existingRecord.status === 'init' && configuration) {
      const { data, error } = await tenantDb
        .from('slot_configurations')
        .update({
          configuration: configuration,
          status: 'draft',
          updated_at: new Date().toISOString(),
          has_unpublished_changes: isReset ? false : isNewChanges
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Update existing draft
    if (configuration) {
      const { data, error } = await tenantDb
        .from('slot_configurations')
        .update({
          configuration: configuration,
          updated_at: new Date().toISOString(),
          has_unpublished_changes: isReset ? false : isNewChanges
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
    return existingRecord;
  }

  // Determine version number
  const { data: maxVersionData } = await tenantDb
    .from('slot_configurations')
    .select('version_number')
    .eq('store_id', storeId)
    .eq('page_type', pageType)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxVersion = maxVersionData ? maxVersionData.version_number : 0;

  // If configuration is provided, create a draft; otherwise create an init record
  if (configuration) {
    const { data, error } = await tenantDb
      .from('slot_configurations')
      .insert({
        user_id: userId,
        store_id: storeId,
        configuration: configuration,
        version: '1.0',
        is_active: true,
        status: 'draft',
        version_number: (maxVersion || 0) + 1,
        page_type: pageType,
        parent_version_id: null,
        has_unpublished_changes: isReset ? false : isNewChanges
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Try to copy from latest published configuration instead of creating empty
    const latestPublished = await findLatestPublished(storeId, pageType);

    let configurationToUse;
    let statusToUse = 'init';
    if (latestPublished && latestPublished.configuration) {
      configurationToUse = latestPublished.configuration;
      statusToUse = 'draft'; // Set to draft since it's already populated from published
    } else {
      // Load full configuration from the appropriate config file
      const pageConfig = await loadPageConfig(pageType);
      // Use the full config as-is, only add/update metadata
      configurationToUse = {
        ...pageConfig,
        metadata: {
          ...(pageConfig.metadata || {}),
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          source: `${pageType}-config.js`,
          status: 'init'
        }
      };
      statusToUse = 'draft'; // Set to draft since it's already populated from config.js
    }

    // Create init/draft record
    const { data, error } = await tenantDb
      .from('slot_configurations')
      .insert({
        user_id: userId,
        store_id: storeId,
        configuration: configurationToUse,
        version: '1.0',
        is_active: true,
        status: statusToUse,
        version_number: (maxVersion || 0) + 1,
        page_type: pageType,
        parent_version_id: null,
        has_unpublished_changes: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Helper: Publish a draft to acceptance (preview environment)
async function publishToAcceptance(draftId, publishedByUserId, storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const draft = await findById(draftId, storeId);
  if (!draft || draft.status !== 'draft') {
    throw new Error('Draft not found or not in draft status');
  }

  const { data, error } = await tenantDb
    .from('slot_configurations')
    .update({
      status: 'acceptance',
      acceptance_published_at: new Date().toISOString(),
      acceptance_published_by: publishedByUserId
    })
    .eq('id', draftId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Helper: Publish acceptance to production
async function publishToProduction(acceptanceId, publishedByUserId, storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const acceptance = await findById(acceptanceId, storeId);
  if (!acceptance || acceptance.status !== 'acceptance') {
    throw new Error('Configuration not found or not in acceptance status');
  }

  const { data, error } = await tenantDb
    .from('slot_configurations')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: publishedByUserId
    })
    .eq('id', acceptanceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Helper: Publish a draft directly to production (legacy method)
async function publishDraft(draftId, publishedByUserId, storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const draft = await findById(draftId, storeId);
  if (!draft || draft.status !== 'draft') {
    throw new Error('Draft not found or already published');
  }

  const { data, error } = await tenantDb
    .from('slot_configurations')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: publishedByUserId,
      has_unpublished_changes: false
    })
    .eq('id', draftId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Helper: Get version history
async function getVersionHistory(storeId, pageType, limit = 20) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data, error } = await tenantDb
    .from('slot_configurations')
    .select('*')
    .eq('store_id', storeId)
    .eq('page_type', pageType)
    .eq('status', 'published')
    .order('version_number', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Helper: Create a draft from a specific version (for revert functionality)
async function createRevertDraft(versionId, userId, storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const targetVersion = await findById(versionId, storeId);
  if (!targetVersion || !['published', 'acceptance'].includes(targetVersion.status)) {
    throw new Error('Version not found or not in a revertible status');
  }

  // Check if there's an existing draft for this user/store/page
  const existingDraft = await findLatestDraft(userId, storeId, targetVersion.page_type);

  let revertMetadata = null;

  if (existingDraft) {
    // Store metadata about what we're replacing (for potential undo)
    revertMetadata = {
      replacedDraftId: existingDraft.id,
      originalConfiguration: existingDraft.configuration,
      originalParentVersionId: existingDraft.parent_version_id,
      originalCurrentEditId: existingDraft.current_edit_id,
      originalHasUnpublishedChanges: existingDraft.has_unpublished_changes
    };

    // Update existing draft with the reverted configuration
    const { data, error } = await tenantDb
      .from('slot_configurations')
      .update({
        configuration: targetVersion.configuration,
        updated_at: new Date().toISOString(),
        has_unpublished_changes: true,
        parent_version_id: targetVersion.id,
        current_edit_id: targetVersion.id,
        metadata: {
          ...((existingDraft.metadata && typeof existingDraft.metadata === 'object') ? existingDraft.metadata : {}),
          revertMetadata
        }
      })
      .eq('id', existingDraft.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Create new draft with the reverted configuration
    const { data: maxVersionData } = await tenantDb
      .from('slot_configurations')
      .select('version_number')
      .eq('store_id', storeId)
      .eq('page_type', targetVersion.page_type)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxVersion = maxVersionData ? maxVersionData.version_number : 0;

    const { data, error } = await tenantDb
      .from('slot_configurations')
      .insert({
        user_id: userId,
        store_id: storeId,
        configuration: targetVersion.configuration,
        version: targetVersion.version,
        is_active: true,
        status: 'draft',
        version_number: (maxVersion || 0) + 1,
        page_type: targetVersion.page_type,
        parent_version_id: targetVersion.id,
        current_edit_id: targetVersion.id,
        has_unpublished_changes: true,
        metadata: {
          revertMetadata: {
            noPreviousDraft: true
          }
        }
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Helper: Revert to a specific version (DEPRECATED - use createRevertDraft instead)
async function revertToVersion(versionId, userId, storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const targetVersion = await findById(versionId, storeId);
  if (!targetVersion || !['published', 'acceptance'].includes(targetVersion.status)) {
    throw new Error('Version not found or not in a revertible status');
  }

  // Mark all versions after this one as reverted
  const { error: updateError } = await tenantDb
    .from('slot_configurations')
    .update({
      status: 'reverted',
      current_edit_id: null
    })
    .eq('store_id', storeId)
    .eq('page_type', targetVersion.page_type)
    .in('status', ['published', 'acceptance'])
    .gt('version_number', targetVersion.version_number);

  if (updateError) throw updateError;

  // Get the next version number
  const { data: maxVersionData } = await tenantDb
    .from('slot_configurations')
    .select('version_number')
    .eq('store_id', storeId)
    .eq('page_type', targetVersion.page_type)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxVersion = maxVersionData ? maxVersionData.version_number : 0;

  // Create a new published version based on the target version
  const { data: newVersion, error } = await tenantDb
    .from('slot_configurations')
    .insert({
      user_id: userId,
      store_id: storeId,
      configuration: targetVersion.configuration,
      version: targetVersion.version,
      is_active: true,
      status: 'published',
      version_number: (maxVersion || 0) + 1,
      page_type: targetVersion.page_type,
      parent_version_id: targetVersion.id,
      current_edit_id: targetVersion.id,
      published_at: new Date().toISOString(),
      published_by: userId
    })
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

// Helper: Undo revert by either deleting draft or restoring previous draft state
async function undoRevert(draftId, userId, storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const revertDraft = await findById(draftId, storeId);
  if (!revertDraft || revertDraft.status !== 'draft' || !revertDraft.current_edit_id) {
    throw new Error('No revert draft found or draft is not a revert');
  }

  const revertMetadata = revertDraft.metadata?.revertMetadata;

  if (revertMetadata?.noPreviousDraft) {
    // No draft existed before revert - just delete the revert draft
    const { error } = await tenantDb
      .from('slot_configurations')
      .delete()
      .eq('id', draftId);

    if (error) throw error;
    return { restored: false, message: 'Revert draft deleted - no previous draft to restore' };
  } else if (revertMetadata) {
    // Restore the original draft state
    const updatedMetadata = { ...(revertDraft.metadata || {}) };
    delete updatedMetadata.revertMetadata;

    const { data, error } = await tenantDb
      .from('slot_configurations')
      .update({
        configuration: revertMetadata.originalConfiguration,
        parent_version_id: revertMetadata.originalParentVersionId,
        current_edit_id: revertMetadata.originalCurrentEditId,
        has_unpublished_changes: revertMetadata.originalHasUnpublishedChanges,
        updated_at: new Date().toISOString(),
        metadata: Object.keys(updatedMetadata).length > 0 ? updatedMetadata : null
      })
      .eq('id', draftId)
      .select()
      .single();

    if (error) throw error;
    return { restored: true, draft: data, message: 'Previous draft state restored' };
  } else {
    // No metadata available - just delete the revert draft (fallback)
    const { error } = await tenantDb
      .from('slot_configurations')
      .delete()
      .eq('id', draftId);

    if (error) throw error;
    return { restored: false, message: 'Revert draft deleted - no restoration metadata available' };
  }
}

// Helper: Set current editing configuration
async function setCurrentEdit(configId, userId, storeId, pageType) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  // Clear any existing current_edit_id for this user/store/page
  await tenantDb
    .from('slot_configurations')
    .update({ current_edit_id: null })
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('page_type', pageType);

  // Set the new current_edit_id
  const { data: config, error } = await tenantDb
    .from('slot_configurations')
    .update({ current_edit_id: configId })
    .eq('id', configId)
    .select()
    .single();

  if (error) throw error;
  return config;
}

// Helper: Get current editing configuration
async function getCurrentEdit(userId, storeId, pageType) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data, error } = await tenantDb
    .from('slot_configurations')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('page_type', pageType)
    .not('current_edit_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Get or create draft configuration for editing
router.get('/draft/:storeId/:pageType?', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;
    const userId = req.user.id;

    // Use upsert to get or create draft
    const draft = await upsertDraft(userId, storeId, pageType);

    res.json({
      success: true,
      data: draft
    });
  } catch (error) {
    console.error('Error getting/creating draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST endpoint to create/get draft with static configuration
router.post('/draft/:storeId/:pageType?', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;
    const { staticConfiguration } = req.body;
    const userId = req.user.id;

    // Use upsert to get or create draft with static configuration
    const draft = await upsertDraft(userId, storeId, pageType, staticConfiguration);

    res.json({
      success: true,
      data: draft
    });
  } catch (error) {
    console.error('Error getting/creating draft with static config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get unpublished changes status for all page types (read-only, no draft creation)
// Compares draft configuration with published configuration to detect actual differences
router.get('/unpublished-status/:storeId', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const pageTypes = ['cart', 'product', 'category', 'checkout', 'success', 'header', 'account', 'login'];

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get all drafts for this user/store
    const { data: drafts, error: draftsError } = await tenantDb
      .from('slot_configurations')
      .select('id, page_type, configuration, updated_at, status')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .in('status', ['init', 'draft']);

    if (draftsError) throw draftsError;

    // Get all published versions for this store
    const { data: published, error: publishedError } = await tenantDb
      .from('slot_configurations')
      .select('id, page_type, configuration')
      .eq('store_id', storeId)
      .eq('status', 'published')
      .order('version_number', { ascending: false });

    if (publishedError) throw publishedError;

    // Build status map by comparing draft vs published configurations
    const statusMap = {};
    let hasAnyUnpublishedChanges = false;

    for (const pageType of pageTypes) {
      const draft = drafts?.find(d => d.page_type === pageType);
      const latestPublished = published?.find(p => p.page_type === pageType);

      let hasChanges = false;

      if (draft && draft.configuration) {
        if (!latestPublished) {
          // Draft exists but no published version = has changes
          hasChanges = true;
        } else {
          // Compare configurations (stringify for deep comparison)
          const draftConfig = JSON.stringify(draft.configuration);
          const publishedConfig = JSON.stringify(latestPublished.configuration);
          hasChanges = draftConfig !== publishedConfig;
        }
      }

      statusMap[pageType] = {
        hasDraft: !!draft,
        hasUnpublishedChanges: hasChanges,
        draftId: draft?.id || null,
        updatedAt: draft?.updated_at || null
      };

      if (hasChanges) {
        hasAnyUnpublishedChanges = true;
      }
    }

    res.json({
      success: true,
      data: {
        hasAnyUnpublishedChanges,
        pageTypes: statusMap
      }
    });
  } catch (error) {
    console.error('Error getting unpublished status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Publish all drafts with unpublished changes
// Compares draft vs published to find actual differences
router.post('/publish-all/:storeId', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get all drafts for this user/store
    const { data: drafts, error: draftsError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('status', 'draft');

    if (draftsError) throw draftsError;

    // Get all published versions for this store
    const { data: published, error: publishedError } = await tenantDb
      .from('slot_configurations')
      .select('id, page_type, configuration')
      .eq('store_id', storeId)
      .eq('status', 'published')
      .order('version_number', { ascending: false });

    if (publishedError) throw publishedError;

    // Find drafts that differ from their published versions
    const draftsToPublish = [];
    for (const draft of (drafts || [])) {
      const latestPublished = published?.find(p => p.page_type === draft.page_type);

      let hasChanges = false;
      if (!latestPublished) {
        // No published version = has changes
        hasChanges = true;
      } else {
        // Compare configurations
        const draftConfig = JSON.stringify(draft.configuration);
        const publishedConfig = JSON.stringify(latestPublished.configuration);
        hasChanges = draftConfig !== publishedConfig;
      }

      if (hasChanges) {
        draftsToPublish.push(draft);
      }
    }

    if (draftsToPublish.length === 0) {
      return res.json({
        success: true,
        data: {
          publishedCount: 0,
          published: []
        },
        message: 'No drafts with unpublished changes found'
      });
    }

    // Publish all drafts with changes
    const publishedResults = [];
    for (const draft of draftsToPublish) {
      const result = await publishDraft(draft.id, userId, storeId);
      publishedResults.push({
        pageType: draft.page_type,
        id: result.id,
        versionNumber: result.version_number
      });
    }

    res.json({
      success: true,
      data: {
        publishedCount: publishedResults.length,
        published: publishedResults
      },
      message: `Successfully published ${publishedResults.length} page(s)`
    });
  } catch (error) {
    console.error('Error publishing all drafts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Public endpoint to get active slot configurations for storefront (matches old API)
router.get('/public/slot-configurations', async (req, res) => {
  try {
    const { store_id, page_type = 'cart' } = req.query;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // First try to find published version
    let configuration = await findLatestPublished(store_id, page_type);

    // If no published version, try to find draft
    if (!configuration) {
      const { data, error } = await tenantDb
        .from('slot_configurations')
        .select('*')
        .eq('store_id', store_id)
        .eq('status', 'draft')
        .eq('page_type', page_type)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      configuration = data;
    }

    if (!configuration) {
      // Create a new draft configuration with default content
      console.log('No configuration found, creating default draft for store:', store_id);

      try {
        // Get the first user to assign the configuration to
        const { data: firstUser, error: userError } = await tenantDb
          .from('users')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (userError) throw userError;

        if (!firstUser) {
          return res.status(500).json({ success: false, error: 'No users found in database' });
        }

        const userId = firstUser.id;

        // Create draft using the upsert method
        configuration = await upsertDraft(userId, store_id, page_type);
        console.log('Created default draft configuration:', configuration.id);

      } catch (error) {
        console.error('Error creating default draft configuration:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    res.json({ success: true, data: [configuration] });
  } catch (error) {
    console.error('Error fetching public slot configurations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get published configuration for display (used by storefront)
router.get('/published/:storeId/:pageType?', async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;

    console.log('[Slot Config API] Fetching published config:', { storeId, pageType });

    const published = await findLatestPublished(storeId, pageType);

    if (!published) {
      console.log('[Slot Config API] No published config found, returning empty');
      // Return default configuration if no published version exists
      return res.json({
        success: true,
        data: {
          configuration: {
            slots: {},
            metadata: {
              created: new Date().toISOString(),
              lastModified: new Date().toISOString()
            }
          }
        }
      });
    }

    console.log('[Slot Config API] Found published config, checking for A/B tests...');

    // Check for active A/B tests for this page (using Supabase)
    const activeTests = await abTestingService.findActiveForPage(storeId, pageType);

    console.log('[Slot Config API] Active A/B tests:', activeTests.length);

    if (activeTests.length === 0) {
      console.log('[Slot Config API] No A/B tests, returning original config');
      return res.json({
        success: true,
        data: published
      });
    }

    // Get session ID from header or generate one
    const sessionId = req.headers['x-session-id'] || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('[Slot Config API] Session ID:', sessionId);

    // Clone the configuration to avoid mutations
    const configWithTests = JSON.parse(JSON.stringify(published));

    // Apply A/B test overrides
    for (const test of activeTests) {
      console.log(`[Slot Config API] Processing test: ${test.name}`);

      try {
        // Get variant assignment for this session
        const assignment = await abTestingService.getVariant(test.id, sessionId, {
          storeId,
          deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
          context: {
            device_type: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
            user_agent: req.headers['user-agent']
          }
        });

        console.log(`[Slot Config API] Variant assigned:`, {
          test: test.name,
          variant: assignment.variant_name,
          is_control: assignment.is_control
        });

        if (assignment.is_control) {
          console.log(`[Slot Config API] Control variant assigned, no changes for test "${test.name}"`);
          continue;
        }

        // Get the variant configuration
        const variant = test.variants.find(v => v.id === assignment.variant_id);

        if (!variant || !variant.config || !variant.config.slot_overrides) {
          console.log(`[Slot Config API] No slot overrides in variant`);
          continue;
        }

        const slotOverrides = variant.config.slot_overrides;
        console.log(`[Slot Config API] Applying slot overrides:`, Object.keys(slotOverrides));

        // Apply each override
        Object.entries(slotOverrides).forEach(([slotId, override]) => {
          if (configWithTests.configuration.slots[slotId]) {
            // Merge override with existing slot
            const before = configWithTests.configuration.slots[slotId].content;
            configWithTests.configuration.slots[slotId] = {
              ...configWithTests.configuration.slots[slotId],
              ...override
            };
            console.log(`[Slot Config API] ✅ Overrode slot "${slotId}": "${before}" → "${override.content}"`);
          } else if (override.enabled !== false) {
            // Create new slot
            configWithTests.configuration.slots[slotId] = override;
            console.log(`[Slot Config API] ➕ Created new slot "${slotId}"`);
          }
        });

      } catch (error) {
        console.error(`[Slot Config API] Error processing test "${test.name}":`, error);
        // Continue with other tests
      }
    }

    console.log('[Slot Config API] ✅ Returning config with A/B test overrides applied');

    res.json({
      success: true,
      data: configWithTests
    });
  } catch (error) {
    console.error('Error getting published configuration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get acceptance configuration for preview (used by preview environment)
router.get('/acceptance/:storeId/:pageType?', async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;

    const acceptance = await findLatestAcceptance(storeId, pageType);

    if (!acceptance) {
      // Fall back to published configuration if no acceptance version exists
      const published = await findLatestPublished(storeId, pageType);

      if (!published) {
        // Return default configuration if neither acceptance nor published exists
        return res.json({
          success: true,
          data: {
            configuration: {
              slots: {},
              metadata: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
              }
            }
          }
        });
      }

      return res.json({
        success: true,
        data: published
      });
    }

    res.json({
      success: true,
      data: acceptance
    });
  } catch (error) {
    console.error('Error getting acceptance configuration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update draft configuration
router.put('/draft/:configId', authMiddleware, async (req, res) => {
  try {
    const { configId } = req.params;
    const { configuration, isReset = false, storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    const draft = await findById(configId, storeId);

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found'
      });
    }

    if (!['init', 'draft'].includes(draft.status)) {
      return res.status(400).json({
        success: false,
        error: 'Can only update draft or init configurations'
      });
    }

    if (draft.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to edit this draft'
      });
    }

    // Handle init->draft transition
    let newStatus = draft.status;
    if (draft.status === 'init') {
      console.log('🔄 ROUTE - Transitioning init->draft for config:', configId);
      newStatus = 'draft';
    }

    // For reset operations, set has_unpublished_changes = false
    // For normal edits, set has_unpublished_changes = true
    const { data: updatedDraft, error } = await tenantDb
      .from('slot_configurations')
      .update({
        configuration: configuration,
        status: newStatus,
        updated_at: new Date().toISOString(),
        has_unpublished_changes: isReset ? false : true
      })
      .eq('id', configId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: updatedDraft
    });
  } catch (error) {
    console.error('Error updating draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Publish a draft to acceptance (preview environment)
router.post('/publish-to-acceptance/:configId', authMiddleware, async (req, res) => {
  try {
    const { configId } = req.params;
    const { storeId } = req.body;
    const userId = req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    const acceptance = await publishToAcceptance(configId, userId, storeId);

    res.json({
      success: true,
      data: acceptance,
      message: 'Configuration published to acceptance successfully'
    });
  } catch (error) {
    console.error('Error publishing to acceptance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Publish acceptance to production
router.post('/publish-to-production/:configId', authMiddleware, async (req, res) => {
  try {
    const { configId } = req.params;
    const { storeId } = req.body;
    const userId = req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    const published = await publishToProduction(configId, userId, storeId);

    res.json({
      success: true,
      data: published,
      message: 'Configuration published to production successfully'
    });
  } catch (error) {
    console.error('Error publishing to production:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Publish a draft directly to production (legacy method for backward compatibility)
router.post('/publish/:configId', authMiddleware, async (req, res) => {
  try {
    const { configId } = req.params;
    const { storeId } = req.body;
    const userId = req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    const published = await publishDraft(configId, userId, storeId);

    res.json({
      success: true,
      data: published,
      message: 'Configuration published successfully'
    });
  } catch (error) {
    console.error('Error publishing draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get version history
router.get('/history/:storeId/:pageType?', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;
    const { limit = 20 } = req.query;

    const history = await getVersionHistory(
      storeId,
      pageType,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting version history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a revert draft (new approach - creates draft instead of publishing)
router.post('/revert-draft/:versionId', authMiddleware, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { storeId } = req.body;
    const userId = req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    // Get the version to revert to
    const targetVersion = await findById(versionId, storeId);

    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    const revertDraft = await createRevertDraft(
      versionId,
      userId,
      targetVersion.store_id
    );

    res.json({
      success: true,
      data: revertDraft,
      message: 'Revert draft created successfully. Publish to apply changes.',
      revertedFrom: {
        versionId: targetVersion.id,
        versionNumber: targetVersion.version_number
      }
    });
  } catch (error) {
    console.error('Error creating revert draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Revert to a specific version (DEPRECATED - use /revert-draft instead)
router.post('/revert/:versionId', authMiddleware, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { storeId } = req.body;
    const userId = req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    // Get the version to revert to
    const targetVersion = await findById(versionId, storeId);

    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    const newVersion = await revertToVersion(
      versionId,
      userId,
      targetVersion.store_id
    );

    res.json({
      success: true,
      data: newVersion,
      message: 'Successfully reverted to selected version'
    });
  } catch (error) {
    console.error('Error reverting version:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set current editing configuration
router.post('/set-current-edit/:configId', authMiddleware, async (req, res) => {
  try {
    const { configId } = req.params;
    const { storeId, pageType = 'cart' } = req.body;
    const userId = req.user.id;

    const config = await setCurrentEdit(configId, userId, storeId, pageType);

    res.json({
      success: true,
      data: config,
      message: 'Current edit configuration set successfully'
    });
  } catch (error) {
    console.error('Error setting current edit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current editing configuration
router.get('/current-edit/:storeId/:pageType?', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;
    const userId = req.user.id;

    const config = await getCurrentEdit(userId, storeId, pageType);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting current edit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Undo revert with smart restoration of previous draft state
router.post('/undo-revert/:draftId', authMiddleware, async (req, res) => {
  try {
    const { draftId } = req.params;
    const { storeId } = req.body;
    const userId = req.user.id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required in request body'
      });
    }

    // Get the draft to check ownership
    const draft = await findById(draftId, storeId);

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found'
      });
    }

    if (draft.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to undo this revert'
      });
    }

    const result = await undoRevert(draftId, userId, draft.store_id);

    res.json({
      success: true,
      data: result.draft || null,
      message: result.message,
      restored: result.restored
    });
  } catch (error) {
    console.error('Error undoing revert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a draft from published configuration (with has_unpublished_changes = false)
router.post('/create-draft-from-published', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType = 'cart', configuration } = req.body;
    const userId = req.user.id;

    // Use upsert with isNewChanges = false since this is a copy of published content
    const draft = await upsertDraft(userId, storeId, pageType, configuration, false);

    res.json({
      success: true,
      data: draft
    });
  } catch (error) {
    console.error('Error creating draft from published:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a draft
router.delete('/draft/:configId', authMiddleware, async (req, res) => {
  try {
    const { configId } = req.params;
    const { store_id: storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'store_id query parameter is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    const draft = await findById(configId, storeId);

    if (!draft) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found'
      });
    }

    if (draft.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Can only delete draft configurations'
      });
    }

    if (draft.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to delete this draft'
      });
    }

    const { error } = await tenantDb
      .from('slot_configurations')
      .delete()
      .eq('id', configId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Destroy layout - reset to default and delete all versions
router.post('/destroy/:storeId/:pageType?', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType = 'cart' } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ Destroying layout for store ${storeId}, page ${pageType}`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get count of configurations before deleting
    const { data: configsToDelete, error: countError } = await tenantDb
      .from('slot_configurations')
      .select('id')
      .eq('store_id', storeId)
      .eq('page_type', pageType);

    if (countError) throw countError;
    const deletedCount = configsToDelete ? configsToDelete.length : 0;

    // Delete all configurations (drafts and published versions) for this store/page
    const { error: deleteError } = await tenantDb
      .from('slot_configurations')
      .delete()
      .eq('store_id', storeId)
      .eq('page_type', pageType);

    if (deleteError) throw deleteError;

    console.log(`🗑️ Deleted ${deletedCount} configurations`);

    // Create a fresh draft with default configuration
    const newDraft = await upsertDraft(userId, storeId, pageType);

    console.log(`✅ Created fresh draft: ${newDraft.id}`);

    res.json({
      success: true,
      message: `Layout destroyed successfully. Deleted ${deletedCount} versions and created fresh draft.`,
      data: newDraft,
      deletedCount
    });
  } catch (error) {
    console.error('Error destroying layout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PATCH a specific slot within a published configuration (for admin theme sync)
// Used by ThemeLayout to sync button colors to slot configurations
// Route: PATCH /api/slot-configurations/:storeId/:pageType/slot/:slotId
// Note: This router is mounted at /api AND /api/slot-configurations in server.js
// Using the /api mount, so full path needs /slot-configurations prefix
router.patch('/slot-configurations/:storeId/:pageType/slot/:slotId', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType, slotId } = req.params;
    const { styles, className, content } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Find the published (active) configuration for this page type
    const { data: configs, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'published');

    if (findError) {
      throw findError;
    }

    // Find config matching the page type
    const existing = configs?.find(c => c.configuration?.metadata?.pageType === pageType);

    if (!existing) {
      // No published configuration exists - that's okay, the default config will be used
      // which already has the template variable {{settings.theme.add_to_cart_button_color}}
      return res.json({
        success: true,
        message: 'No published configuration found - default config will use theme settings',
        skipped: true
      });
    }

    // Update existing configuration
    const currentConfig = existing.configuration || {};
    const currentSlots = currentConfig.slots || {};

    // Update the specific slot
    if (!currentSlots[slotId]) {
      // Slot doesn't exist in saved config - create it
      currentSlots[slotId] = { id: slotId, styles: {} };
    }

    // Apply updates
    if (styles) {
      currentSlots[slotId].styles = { ...currentSlots[slotId].styles, ...styles };
    }
    if (className !== undefined) {
      currentSlots[slotId].className = className;
    }
    if (content !== undefined) {
      currentSlots[slotId].content = content;
    }

    const updatedConfiguration = {
      ...currentConfig,
      slots: currentSlots,
      metadata: {
        ...currentConfig.metadata,
        updatedAt: new Date().toISOString()
      }
    };

    const { data: updated, error: updateError } = await tenantDb
      .from('slot_configurations')
      .update({
        configuration: updatedConfiguration,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error patching slot configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;