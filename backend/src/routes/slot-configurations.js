const express = require('express');
const router = express.Router();
const path = require('path');
const ConnectionManager = require('../services/database/ConnectionManager');
const { authMiddleware } = require('../middleware/authMiddleware');

// Helper function to load page configuration from backend config files
async function loadPageConfig(pageType) {
  try {
    const configsDir = path.resolve(__dirname, '../configs/slot');
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
      case 'homepage':
        configPath = path.join(configsDir, 'homepage-config.js');
        configExport = 'homepageConfig';
        break;
      case 'header':
        configPath = path.join(configsDir, 'header-config.js');
        configExport = 'headerConfig';
        break;
      case 'account':
        configPath = path.join(configsDir, 'account-config.js');
        configExport = 'accountConfig';
        break;
      case 'login':
        configPath = path.join(configsDir, 'login-config.js');
        configExport = 'loginConfig';
        break;
      default:
        console.warn(`Unknown page type '${pageType}', falling back to minimal config`);
        return null;
    }

    const configModule = await import(configPath);
    const config = configModule[configExport];

    if (!config) {
      console.warn(`Config export '${configExport}' not found in ${configPath}`);
      return null;
    }

    return config;
  } catch (error) {
    console.error(`Failed to load ${pageType}-config.js:`, error);
    return null;
  }
}

// Helper function to build root slots from slot configuration
function buildRootSlots(slots) {
  if (!slots) return [];
  return Object.entries(slots)
    .filter(([_, slot]) => !slot.parentId || slot.parentId === null)
    .map(([slotId]) => slotId);
}

// Helper function to ensure configuration has slotDefinitions populated
async function ensureFullConfiguration(configuration, pageType) {
  // Check if slotDefinitions is missing or empty
  const hasSlotDefinitions = configuration?.slotDefinitions &&
    Object.keys(configuration.slotDefinitions).length > 0;

  // Check if slots is missing or empty
  const hasSlots = configuration?.slots &&
    Object.keys(configuration.slots).length > 0;

  // If we have everything, return as-is
  if (hasSlotDefinitions && hasSlots) {
    return configuration;
  }

  // Load full config from config file
  const pageConfig = await loadPageConfig(pageType);
  if (!pageConfig) {
    return configuration; // Return original if we can't load config
  }

  console.log(`📦 Populating full configuration for ${pageType} from config file`);

  // Merge with existing configuration, preferring existing values where they exist
  const fullConfiguration = {
    page_name: configuration?.page_name || pageConfig.page_name || pageType.charAt(0).toUpperCase() + pageType.slice(1),
    slot_type: configuration?.slot_type || pageConfig.slot_type || `${pageType}_layout`,
    slots: hasSlots ? configuration.slots : (pageConfig.slots || {}),
    rootSlots: configuration?.rootSlots?.length ? configuration.rootSlots : buildRootSlots(pageConfig.slots),
    slotDefinitions: hasSlotDefinitions ? configuration.slotDefinitions : (pageConfig.slotDefinitions || {}),
    metadata: {
      ...(configuration?.metadata || {}),
      created: configuration?.metadata?.created || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: `${pageType}-config.js`,
      pageType: pageType
    }
  };

  return fullConfiguration;
}

// Public endpoint to get default config from static files (for editor fallback)
router.get('/defaults/:pageType', async (req, res) => {
  try {
    const { pageType } = req.params;
    const config = await loadPageConfig(pageType);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `No default config found for page type: ${pageType}`
      });
    }

    // Return only serializable parts (no functions)
    const serializableConfig = {
      page_name: config.page_name,
      slot_type: config.slot_type,
      slots: config.slots || {},
      metadata: config.metadata || {},
      cmsBlocks: config.cmsBlocks || [],
      views: config.views ? config.views.map(v => ({ id: v.id, label: v.label })) : []
    };

    res.json({ success: true, data: serializableConfig });
  } catch (error) {
    console.error('Error loading default config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public endpoint to get active slot configurations for storefront
router.get('/public', async (req, res) => {
  try {
    const { store_id, page_name, slot_type } = req.query;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: configurations, error } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('store_id', store_id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Filter by page_name and slot_type if provided (stored in configuration JSON)
    let filtered = configurations || [];
    if (page_name || slot_type) {
      filtered = configurations.filter(config => {
        const conf = config.configuration || {};
        if (page_name && conf.page_name !== page_name) return false;
        if (slot_type && conf.slot_type !== slot_type) return false;
        return true;
      });
    }

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching public slot configurations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get slot configurations (authenticated)
router.get('/slot-configurations', authMiddleware, async (req, res) => {
  try {
    const { store_id, page_name, slot_type, is_active } = req.query;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    let query = tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('user_id', req.user.id);

    if (store_id) query = query.eq('store_id', store_id);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data: configurations, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Filter by page_name and slot_type if provided (stored in configuration JSON)
    let filtered = configurations || [];
    if (page_name || slot_type) {
      filtered = configurations.filter(config => {
        const conf = config.configuration || {};
        if (page_name && conf.page_name !== page_name) return false;
        if (slot_type && conf.slot_type !== slot_type) return false;
        return true;
      });
    }

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching slot configurations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single slot configuration
router.get('/slot-configurations/:id', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: configuration, error } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!configuration || error) {
      return res.status(404).json({ success: false, error: 'Configuration not found' });
    }

    res.json({ success: true, data: configuration });
  } catch (error) {
    console.error('Error fetching slot configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update draft slot configuration with static defaults
router.post('/draft/:storeId/:pageType', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType } = req.params;
    const { staticConfiguration } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Check if a draft configuration already exists for this user/store and pageType
    const { data: existing, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('store_id', storeId)
      .eq('is_active', false)
      .maybeSingle();

    // If draft exists for the same page type, check if it needs full configuration
    if (existing && !findError) {
      const existingPageType = existing.configuration?.metadata?.pageType;
      if (existingPageType === pageType) {
        // Ensure full configuration (populate slotDefinitions if null)
        const fullConfiguration = await ensureFullConfiguration(existing.configuration, pageType);

        // If configuration was updated, save it to database
        if (fullConfiguration !== existing.configuration) {
          console.log('📦 Updating existing draft with full configuration for:', pageType);
          const { data: updated, error: updateError } = await tenantDb
            .from('slot_configurations')
            .update({
              configuration: fullConfiguration,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) {
            throw updateError;
          }

          console.log('✅ Returning updated draft with full configuration for user/store/page:', req.user.id, storeId, pageType);
          return res.json({ success: true, data: updated });
        }

        console.log('✅ Returning existing draft slot configuration for user/store/page:', req.user.id, storeId, pageType);
        return res.json({ success: true, data: existing });
      }

      // Different page type - update with new configuration if staticConfiguration provided
      if (staticConfiguration) {
        console.log('🔄 Updating draft with new page configuration:', pageType);

        const { data: updated, error: updateError } = await tenantDb
          .from('slot_configurations')
          .update({
            configuration: staticConfiguration,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        return res.json({ success: true, data: updated });
      }

      // Return existing draft even if page type doesn't match
      return res.json({ success: true, data: existing });
    }

    // Create new draft configuration with full config from file
    let newConfig;
    if (staticConfiguration) {
      newConfig = staticConfiguration;
    } else {
      // Load full configuration from config file
      newConfig = await ensureFullConfiguration({
        metadata: {
          pageType: pageType,
          created: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
      }, pageType);
    }

    console.log('➕ Creating new draft slot configuration for user/store/page:', req.user.id, storeId, pageType);

    const { data: newConfiguration, error: createError } = await tenantDb
      .from('slot_configurations')
      .insert({
        user_id: req.user.id,
        store_id: storeId,
        configuration: newConfig,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    res.json({ success: true, data: newConfiguration });
  } catch (error) {
    console.error('Error creating draft slot configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create slot configuration
router.post('/slot-configurations', authMiddleware, async (req, res) => {
  try {
    const { page_name, slot_type, configuration, is_active, store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Include page_name and slot_type in the configuration JSON
    const fullConfiguration = {
      ...configuration,
      page_name,
      slot_type
    };

    // Check if a configuration already exists for this user/store
    const { data: existing, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('store_id', store_id || req.user.active_store_id)
      .maybeSingle();

    if (existing && !findError) {
      // Update the existing configuration (since we only allow one per user/store)
      console.log('🔄 Updating existing slot configuration for user/store:', req.user.id, store_id);

      const { data: updated, error: updateError } = await tenantDb
        .from('slot_configurations')
        .update({
          configuration: fullConfiguration,
          is_active: is_active !== undefined ? is_active : true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return res.json({ success: true, data: updated });
    }

    // Create new configuration
    console.log('➕ Creating new slot configuration for user/store:', req.user.id, store_id);

    const { data: newConfiguration, error: createError } = await tenantDb
      .from('slot_configurations')
      .insert({
        user_id: req.user.id,
        store_id: store_id || req.user.active_store_id,
        configuration: fullConfiguration,
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    res.json({ success: true, data: newConfiguration });
  } catch (error) {
    console.error('Error creating slot configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update slot configuration
router.put('/slot-configurations/:id', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: configuration, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!configuration || findError) {
      return res.status(404).json({ success: false, error: 'Configuration not found' });
    }

    const { page_name, slot_type, configuration: newConfig, is_active } = req.body;

    // Include page_name and slot_type in the configuration JSON
    const fullConfiguration = {
      ...newConfig,
      page_name,
      slot_type
    };

    const updateData = {
      configuration: fullConfiguration,
      updated_at: new Date().toISOString()
    };

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const { data: updated, error: updateError } = await tenantDb
      .from('slot_configurations')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating slot configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Merge new slots from default config into existing published configuration
// This allows adding new features (like sort/view controls) without losing customizations
router.post('/merge-defaults/:storeId/:pageType', authMiddleware, async (req, res) => {
  try {
    const { storeId, pageType } = req.params;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Load default config from file
    const defaultConfig = await loadPageConfig(pageType);
    if (!defaultConfig) {
      return res.status(404).json({
        success: false,
        error: `No default config found for page type: ${pageType}`
      });
    }

    // Find published configuration for this page type
    const { data: existing, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing || findError) {
      return res.status(404).json({
        success: false,
        error: 'No published configuration found for this store'
      });
    }

    // Get existing slots
    const existingSlots = existing.configuration?.slots || {};
    const defaultSlots = defaultConfig.slots || {};

    // Merge: add new slots from default that don't exist in current config
    const mergedSlots = { ...existingSlots };
    let addedSlots = [];

    for (const [slotId, slotConfig] of Object.entries(defaultSlots)) {
      if (!existingSlots[slotId]) {
        mergedSlots[slotId] = slotConfig;
        addedSlots.push(slotId);
      }
    }

    if (addedSlots.length === 0) {
      return res.json({
        success: true,
        message: 'Configuration is already up to date',
        addedSlots: []
      });
    }

    // Update the configuration with merged slots
    const updatedConfiguration = {
      ...existing.configuration,
      slots: mergedSlots,
      metadata: {
        ...(existing.configuration?.metadata || {}),
        lastModified: new Date().toISOString(),
        mergedFrom: `${pageType}-config.js`
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

    console.log(`✅ Merged ${addedSlots.length} new slots into ${pageType} config for store ${storeId}:`, addedSlots);

    res.json({
      success: true,
      message: `Added ${addedSlots.length} new slots`,
      addedSlots,
      data: updated
    });
  } catch (error) {
    console.error('Error merging default slots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete slot configuration
router.delete('/slot-configurations/:id', authMiddleware, async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    // Get tenant connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: configuration, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!configuration || findError) {
      return res.status(404).json({ success: false, error: 'Configuration not found' });
    }

    const { error: deleteError } = await tenantDb
      .from('slot_configurations')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({ success: true, message: 'Configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting slot configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH a specific slot within a configuration (for admin theme sync)
// Used by ThemeLayout to sync button colors to slot configurations
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
    const { data: existing, error: findError } = await tenantDb
      .from('slot_configurations')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    // Check if this is the right page type
    if (existing && existing.configuration?.metadata?.pageType !== pageType) {
      return res.status(404).json({
        success: false,
        error: `No active configuration found for page type: ${pageType}`
      });
    }

    if (!existing) {
      // No published configuration exists yet - create one with defaults
      const defaultConfig = await loadPageConfig(pageType);
      if (!defaultConfig) {
        return res.status(404).json({
          success: false,
          error: `No default config found for page type: ${pageType}`
        });
      }

      // Create new configuration with the slot update
      const newSlots = { ...defaultConfig.slots };
      if (newSlots[slotId]) {
        if (styles) {
          newSlots[slotId].styles = { ...newSlots[slotId].styles, ...styles };
        }
        if (className !== undefined) {
          newSlots[slotId].className = className;
        }
        if (content !== undefined) {
          newSlots[slotId].content = content;
        }
      }

      const newConfiguration = {
        ...defaultConfig,
        slots: newSlots,
        metadata: {
          ...defaultConfig.metadata,
          pageType,
          updatedAt: new Date().toISOString()
        }
      };

      const { data: created, error: createError } = await tenantDb
        .from('slot_configurations')
        .insert({
          user_id: req.user.id,
          store_id: storeId,
          configuration: newConfiguration,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return res.json({ success: true, data: created, created: true });
    }

    // Update existing configuration
    const currentConfig = existing.configuration || {};
    const currentSlots = currentConfig.slots || {};

    // Update the specific slot
    if (!currentSlots[slotId]) {
      // Slot doesn't exist in saved config - load from default and add
      const defaultConfig = await loadPageConfig(pageType);
      if (defaultConfig?.slots?.[slotId]) {
        currentSlots[slotId] = { ...defaultConfig.slots[slotId] };
      } else {
        currentSlots[slotId] = { id: slotId };
      }
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
