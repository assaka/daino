// backend/src/routes/plugin-api.js
const express = require('express');
const router = express.Router();
const PluginExecutor = require('../core/PluginExecutor');
const PluginPurchaseService = require('../services/PluginPurchaseService');
const ConnectionManager = require('../services/database/ConnectionManager');
const { storeResolver } = require('../middleware/storeResolver');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');
const { transformComponentCode } = require('../utils/jsxTransformer');
// Note: cron_jobs is in tenant Supabase DB, not Sequelize

/**
 * Helper function to get tenant database connection from request
 * Extracts store_id from multiple sources (headers, query, body, user context)
 */
async function getTenantConnection(req) {
  // Try multiple sources for store_id
  const store_id =
    req.headers['x-store-id'] ||
    req.query.store_id ||
    req.body?.store_id ||
    req.storeId ||  // From storeResolver middleware
    req.user?.store_id ||
    req.user?.storeId;

  if (!store_id) {
    throw new Error('store_id is required (header X-Store-Id, query param, body, or user context)');
  }
  return await ConnectionManager.getStoreConnection(store_id);
}

/**
 * Ensure plugin_cron table exists in tenant database
 * This handles existing stores that don't have this table yet
 */
const ensuredPluginCronTables = new Set();
async function ensurePluginCronTable(tenantDb, storeId) {
  // Only run once per store per server session
  const cacheKey = storeId || 'default';
  if (ensuredPluginCronTables.has(cacheKey)) return;

  try {
    await tenantDb.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plugin_cron (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plugin_id UUID NOT NULL,
          cron_name VARCHAR(255) NOT NULL,
          description TEXT,
          cron_schedule VARCHAR(100) NOT NULL,
          timezone VARCHAR(50) DEFAULT 'UTC',
          handler_method VARCHAR(255) NOT NULL,
          handler_code TEXT,
          handler_params JSONB DEFAULT '{}'::jsonb,
          is_enabled BOOLEAN DEFAULT true,
          priority INTEGER DEFAULT 10,
          last_run_at TIMESTAMP WITH TIME ZONE,
          next_run_at TIMESTAMP WITH TIME ZONE,
          last_status VARCHAR(50),
          last_error TEXT,
          last_result JSONB,
          run_count INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          consecutive_failures INTEGER DEFAULT 0,
          max_runs INTEGER,
          max_failures INTEGER DEFAULT 5,
          timeout_seconds INTEGER DEFAULT 300,
          cron_job_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_plugin_cron_plugin_id ON plugin_cron(plugin_id);
        CREATE INDEX IF NOT EXISTS idx_plugin_cron_enabled ON plugin_cron(is_enabled) WHERE is_enabled = true;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_cron_unique_name ON plugin_cron(plugin_id, cron_name);
      `
    });
    ensuredPluginCronTables.add(cacheKey);
  } catch (error) {
    // Table might already exist or RPC not available, silently continue
    // The table creation will be attempted but if it fails,
    // we'll try the query anyway and let it fail with a proper error
    ensuredPluginCronTables.add(cacheKey);
  }
}

/**
 * GET /api/plugins
 * Get ALL plugins (installed + available) from plugin_registry table
 */
router.get('/', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    const { data: plugins, error } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      plugins: plugins || []
    });
  } catch (error) {
    console.error('Failed to get plugins:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/widgets
 * Get all available plugin widgets for slot editor
 */
router.get('/widgets', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    // Query plugin_widgets with join to plugin_registry
    const { data: widgets, error } = await tenantDb
      .from('plugin_widgets')
      .select(`
        widget_id, widget_name, description, category, icon,
        plugin_registry!inner(id, name, status, is_starter_template)
      `)
      .eq('is_enabled', true)
      .eq('plugin_registry.status', 'active')
      .or('is_starter_template.eq.false,is_starter_template.is.null', { foreignTable: 'plugin_registry' })
      .order('widget_name', { ascending: true });

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      widgets: (widgets || []).map(w => ({
        id: w.widget_id,
        name: w.widget_name,
        description: w.description,
        category: w.category || 'functional',
        icon: w.icon || 'Box',
        pluginName: w.plugin_registry?.name,
        pluginId: w.plugin_registry?.id
      }))
    });
  } catch (error) {
    console.error('Failed to get widgets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/widgets/:widgetId
 * Get a specific widget by ID
 */
router.get('/widgets/:widgetId', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { widgetId } = req.params;

    const { data: widget, error } = await tenantDb
      .from('plugin_widgets')
      .select('widget_id, widget_name, description, component_code, default_config, category, icon')
      .eq('widget_id', widgetId)
      .eq('is_enabled', true)
      .single();

    if (error || !widget) {
      return res.status(404).json({
        success: false,
        error: 'Widget not found'
      });
    }

    res.json({
      success: true,
      widget: {
        id: widget.widget_id,
        name: widget.widget_name,
        description: widget.description,
        componentCode: widget.component_code,
        config: widget.default_config,
        category: widget.category,
        icon: widget.icon
      }
    });
  } catch (error) {
    console.error('Failed to get widget:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/starters
 * Get starter templates for AI Studio
 * Fetches from master DB plugin_starters table (seeded from example-plugins)
 */
router.get('/starters', async (req, res) => {
  try {
    const { masterDbClient } = require('../database/masterConnection');

    if (!masterDbClient) {
      return res.status(500).json({
        success: false,
        error: 'Master database not available'
      });
    }

    // Fetch starters from master database
    const { data: starters, error } = await masterDbClient
      .from('plugin_starters')
      .select('id, name, slug, version, description, icon, starter_description, starter_prompt, display_order, category, type, difficulty, tags, plugin_structure')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      starters: (starters || []).map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.starter_description || s.description,
        icon: s.icon || '🔌',
        prompt: s.starter_prompt || `Install the ${s.name} plugin`,
        order: s.display_order || 0,
        category: s.category,
        type: s.type,
        difficulty: s.difficulty,
        tags: s.tags,
        hasCode: !!s.plugin_structure,
        source: 'system'
      }))
    });
  } catch (error) {
    console.error('Failed to get starter templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/starters/:slug
 * Get full plugin structure for a starter (for installation)
 */
router.get('/starters/:slug', async (req, res) => {
  try {
    const { masterDbClient } = require('../database/masterConnection');
    const { slug } = req.params;

    if (!masterDbClient) {
      return res.status(500).json({
        success: false,
        error: 'Master database not available'
      });
    }

    const { data: starter, error } = await masterDbClient
      .from('plugin_starters')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !starter) {
      return res.status(404).json({
        success: false,
        error: 'Starter not found'
      });
    }

    res.json({
      success: true,
      starter: {
        id: starter.id,
        name: starter.name,
        slug: starter.slug,
        description: starter.description,
        category: starter.category,
        type: starter.type,
        icon: starter.icon,
        difficulty: starter.difficulty,
        tags: starter.tags,
        isActive: starter.is_active
      },
      pluginStructure: starter.plugin_structure
    });
  } catch (error) {
    console.error('Failed to get starter:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/starters/seed
 * Seed plugin_starters table with plugin data
 * Accepts plugins array in POST body, or reads from filesystem if no body provided
 */
router.post('/starters/seed', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const { masterDbClient } = require('../database/masterConnection');

    if (!masterDbClient) {
      return res.status(500).json({
        success: false,
        error: 'Master database connection not available'
      });
    }

    // Icon mapping for categories
    const categoryIcons = {
      'commerce': '🛒',
      'marketing': '📣',
      'analytics': '📊',
      'compliance': '🔒',
      'utility': '🔧',
      'communication': '💬',
      'display': '🎨',
      'marketplace': '🏪'
    };

    let pluginsToSeed = [];

    // Check if plugins are provided in request body
    if (req.body && req.body.plugins && Array.isArray(req.body.plugins)) {
      pluginsToSeed = req.body.plugins;
    } else {
      // Fallback: Read from filesystem (for local development)
      try {
        const examplePluginsDir = path.join(__dirname, '../../../public/example-plugins');
        const files = await fs.readdir(examplePluginsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const fileName of jsonFiles) {
          const filePath = path.join(examplePluginsDir, fileName);
          const content = await fs.readFile(filePath, 'utf-8');
          pluginsToSeed.push(JSON.parse(content));
        }
      } catch (fsErr) {
        return res.status(400).json({
          success: false,
          error: 'No plugins provided in request body and filesystem not available. Send { "plugins": [...] } in POST body.'
        });
      }
    }

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < pluginsToSeed.length; i++) {
      try {
        const pluginData = pluginsToSeed[i];
        const plugin = pluginData.plugin || pluginData;

        const starterData = {
          name: plugin.name,
          slug: plugin.slug,
          version: plugin.version || '1.0.0',
          description: plugin.description,
          category: plugin.category || 'utility',
          type: plugin.type || 'feature',
          icon: categoryIcons[plugin.category] || '🔌',
          starter_description: plugin.manifest?.description || plugin.description,
          starter_prompt: `Install the ${plugin.name} plugin`,
          display_order: i + 1,
          is_active: true,
          author: plugin.author || 'DainoStore',
          tags: plugin.tags || plugin.manifest?.tags || [],
          difficulty: plugin.type === 'integration' ? 'advanced' : 'beginner',
          plugin_structure: pluginData, // Store full plugin data
          updated_at: new Date().toISOString()
        };

        // Upsert into plugin_starters
        const { error } = await masterDbClient
          .from('plugin_starters')
          .upsert(starterData, { onConflict: 'slug' });

        if (error) {
          console.warn(`Failed to seed ${plugin.slug}:`, error.message);
          failed++;
        } else {
          // Check if it was created or updated
          const { data: existing } = await masterDbClient
            .from('plugin_starters')
            .select('created_at, updated_at')
            .eq('slug', plugin.slug)
            .single();

          if (existing && existing.created_at === existing.updated_at) {
            created++;
          } else {
            updated++;
          }
        }
      } catch (parseErr) {
        console.warn(`Failed to process plugin at index ${i}:`, parseErr.message);
        failed++;
      }
    }

    res.json({
      success: true,
      message: `Seeded ${created} new, updated ${updated}, ${failed} failed`,
      total: pluginsToSeed.length,
      created,
      updated,
      failed
    });
  } catch (error) {
    console.error('Failed to seed starter templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/marketplace
 * Get all marketplace plugins
 */
router.get('/marketplace', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    const { data: plugins, error } = await tenantDb
      .from('plugin_marketplace')
      .select('id, name, slug, version, description, author_id, category, pricing_model, base_price, monthly_price, yearly_price, currency, license_type, downloads, active_installations, rating, reviews_count, icon_url, screenshots')
      .eq('status', 'approved')
      .order('downloads', { ascending: false });

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      plugins: plugins || []
    });
  } catch (error) {
    console.error('Failed to get marketplace plugins:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/purchase
 * Purchase a plugin from marketplace
 */
router.post('/purchase', async (req, res) => {
  try {
    const { pluginId, selectedPlan } = req.body;
    // TODO: Get tenantId and userId from authenticated session
    const tenantId = req.user?.tenantId || 'default-tenant';
    const userId = req.user?.id || 'default-user';

    const result = await PluginPurchaseService.purchasePlugin(
      pluginId,
      tenantId,
      selectedPlan,
      userId
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Failed to purchase plugin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/installed
 * Get all installed plugins for current tenant
 */
router.get('/installed', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    const { data: plugins, error } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      plugins: plugins || []
    });
  } catch (error) {
    console.error('Failed to get installed plugins:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/active
 * Get active plugins from normalized tables (for App.jsx initialization)
 * This endpoint loads plugins with their hooks, events, AND frontend scripts
 * OPTIMIZED: Now includes all plugin data in one call
 *
 * Only returns plugins that are:
 * 1. Active in plugin_registry (status = 'active')
 * 2. Enabled for this store in plugin_configurations (is_enabled = true)
 */
router.get('/active', async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get active plugins from plugin_registry table (exclude starter templates)
    const { data: allPlugins, error: pluginsError } = await tenantDb
      .from('plugin_registry')
      .select('id, name, version, description, author, category, status, type, manifest, created_at, updated_at')
      .eq('status', 'active')
      .or('is_starter_template.eq.false,is_starter_template.is.null')
      .order('created_at', { ascending: false });

    if (pluginsError) {
      throw new Error(pluginsError.message);
    }

    // Get store-specific plugin configurations to check which are enabled
    const { data: storeConfigs, error: configError } = await tenantDb
      .from('plugin_configurations')
      .select('plugin_id, is_enabled')
      .eq('store_id', store_id);

    if (configError) {
      console.warn('Could not fetch plugin configurations:', configError.message);
    }

    // Create a map of plugin_id -> is_enabled for quick lookup
    const configMap = new Map((storeConfigs || []).map(c => [c.plugin_id, c.is_enabled]));

    // Filter plugins: only include those that are enabled for this store
    // If no configuration exists for a plugin, include it (default enabled)
    // If configuration exists and is_enabled = false, exclude it
    const plugins = (allPlugins || []).filter(plugin => {
      const isEnabled = configMap.get(plugin.id);
      // If explicitly disabled (is_enabled === false), exclude
      if (isEnabled === false) {
        console.log(`Plugin "${plugin.name}" (${plugin.id}) is disabled for store ${store_id}`);
        return false;
      }
      return true;
    });

    // Load hooks and events for each plugin from normalized tables
    const pluginsWithData = await Promise.all(plugins.map(async (plugin) => {
      // Load hooks from plugin_hooks table (normalized structure)
      let hooks = [];
      try {
        const { data: hooksResult, error: hooksError } = await tenantDb
          .from('plugin_hooks')
          .select('hook_name, handler_function, priority, is_enabled')
          .eq('plugin_id', plugin.id)
          .eq('is_enabled', true)
          .order('priority', { ascending: true });

        if (hooksError) throw hooksError;

        hooks = (hooksResult || []).map(h => ({
          hook_name: h.hook_name,
          handler_code: h.handler_function,
          priority: h.priority || 10,
          enabled: h.is_enabled !== false
        }));
      } catch (hookError) {
        //
      }

      // Load events from normalized plugin_events table
      let events = [];
      try {
        const { data: eventsResult, error: eventsError } = await tenantDb
          .from('plugin_events')
          .select('event_name, listener_function, priority, is_enabled')
          .eq('plugin_id', plugin.id)
          .eq('is_enabled', true)
          .order('priority', { ascending: true });

        if (eventsError) throw eventsError;

        events = (eventsResult || []).map(e => ({
          event_name: e.event_name,
          listener_code: e.listener_function,
          priority: e.priority || 10,
          enabled: e.is_enabled !== false
        }));
      } catch (eventError) {
        // Events are optional
      }

      // Load frontend scripts from plugin_scripts table
      let frontendScripts = [];
      try {
        const { data: scriptsResult, error: scriptsError } = await tenantDb
          .from('plugin_scripts')
          .select('name, content, type, load_order')
          .eq('plugin_id', plugin.id)
          .eq('scope', 'frontend')
          .eq('is_enabled', true)
          .order('load_order', { ascending: true });

        if (scriptsError) throw scriptsError;

        frontendScripts = scriptsResult || [];
      } catch (scriptError) {
        // Scripts are optional
      }

      // Load widgets from plugin_widgets table
      let widgets = [];
      try {
        const { data: widgetsResult, error: widgetsError } = await tenantDb
          .from('plugin_widgets')
          .select('widget_id, widget_name, description, component_code, default_config, category, icon, is_enabled')
          .eq('plugin_id', plugin.id)
          .eq('is_enabled', true);

        if (widgetsError) throw widgetsError;

        widgets = (widgetsResult || []).map(w => ({
          widgetId: w.widget_id,
          widgetName: w.widget_name,
          description: w.description,
          componentCode: w.component_code,
          defaultConfig: w.default_config,
          category: w.category,
          icon: w.icon,
          is_enabled: w.is_enabled
        }));
      } catch (widgetError) {
        // Widgets are optional
      }

      // Parse manifest
      const manifest = typeof plugin.manifest === 'string' ? JSON.parse(plugin.manifest) : plugin.manifest;

      return {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        category: plugin.category,
        status: plugin.status,
        type: plugin.type,
        generated_by_ai: manifest?.generated_by_ai || plugin.type === 'ai-generated',
        hooks: hooks,
        events: events,
        frontendScripts: frontendScripts,
        widgets: widgets // Include widgets in response!
      };
    }));

    res.json({
      success: true,
      data: pluginsWithData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/registry
 * Get all active plugins with their hooks and events (for App.jsx initialization)
 * Updated to use Supabase
 */
router.get('/registry', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    // Prevent caching - always get fresh plugin data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { status } = req.query;

    // Get plugins from plugin_registry table
    let query = tenantDb
      .from('plugin_registry')
      .select('id, name, slug, version, description, author, category, status, type, manifest, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (status === 'active') {
      query = query.eq('status', 'active');
    }

    const { data: plugins, error: pluginsError } = await query;
    if (pluginsError) throw new Error(pluginsError.message);

    // Load hooks and events from normalized tables
    const pluginsWithData = await Promise.all((plugins || []).map(async (plugin) => {
      // Load hooks from plugin_hooks table
      let hooks = [];
      try {
        const { data: hooksResult } = await tenantDb
          .from('plugin_hooks')
          .select('hook_name, handler_function, priority, is_enabled')
          .eq('plugin_id', plugin.id)
          .eq('is_enabled', true)
          .order('priority', { ascending: true });

        hooks = (hooksResult || []).map(h => ({
          hook_name: h.hook_name,
          handler_code: h.handler_function,
          priority: h.priority || 10,
          enabled: h.is_enabled !== false
        }));
      } catch (hookError) {
      }

      // Load events from plugin_events table
      let events = [];
      try {
        const { data: eventsResult } = await tenantDb
          .from('plugin_events')
          .select('event_name, listener_function, priority, is_enabled')
          .eq('plugin_id', plugin.id)
          .eq('is_enabled', true)
          .order('priority', { ascending: true });

        events = (eventsResult || []).map(e => ({
          event_name: e.event_name,
          listener_code: e.listener_function,
          priority: e.priority || 10,
          enabled: e.is_enabled !== false
        }));
      } catch (eventError) {
      }

      const manifest = typeof plugin.manifest === 'string' ? JSON.parse(plugin.manifest) : plugin.manifest;

      return {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        category: plugin.category,
        status: plugin.status,
        type: plugin.type,
        generated_by_ai: manifest?.generated_by_ai || plugin.type === 'ai-generated',
        hooks: hooks,
        events: events
      };
    }));

    res.json({
      success: true,
      data: pluginsWithData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/active/:pluginId
 * Get a specific active plugin from normalized tables (for App.jsx initialization)
 */
router.get('/active/:pluginId', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    // Prevent caching - always get fresh plugin data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { pluginId } = req.params;

    // Get plugin details from plugin_registry
    const { data: plugin, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .eq('id', pluginId)
      .eq('status', 'active')
      .single();

    if (pluginError || !plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found or not active'
      });
    }

    // Load hooks from plugin_hooks table
    let hooks = [];
    try {
      const { data: hooksResult } = await tenantDb
        .from('plugin_hooks')
        .select('hook_name, handler_function, priority, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('priority', { ascending: true });

      hooks = (hooksResult || []).map(h => ({
        hook_name: h.hook_name,
        handler_code: h.handler_function,
        priority: h.priority || 10,
        enabled: h.is_enabled !== false
      }));
    } catch (hookError) {
    }

    // Load events from plugin_events table
    let events = [];
    try {
      const { data: eventsResult } = await tenantDb
        .from('plugin_events')
        .select('event_name, listener_function, priority, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('priority', { ascending: true });

      events = (eventsResult || []).map(e => ({
        event_name: e.event_name,
        listener_code: e.listener_function,
        priority: e.priority || 10,
        enabled: e.is_enabled !== false
      }));
    } catch (eventError) {
    }

    // Parse JSON fields
    const manifest = typeof plugin.manifest === 'string' ? JSON.parse(plugin.manifest) : plugin.manifest;

    res.json({
      success: true,
      data: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        category: plugin.category,
        status: plugin.status,
        type: plugin.type,
        generated_by_ai: manifest?.generated_by_ai || plugin.type === 'ai-generated',
        hooks: hooks,
        events: events,
        manifest: manifest
      }
    });
  } catch (error) {
    console.error('❌ Failed to get plugin details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/registry/:pluginId
 * Get a specific plugin with its hooks and events (for UnifiedPluginManager)
 * Updated to use Supabase client
 */
router.get('/registry/:pluginId', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);

    // Prevent caching - always get fresh plugin data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { pluginId } = req.params;

    // Get plugin details from plugin_registry
    const { data: plugin, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .eq('id', pluginId)
      .single();

    if (pluginError || !plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }

    // Load hooks from plugin_hooks table
    let hooks = [];
    try {
      const { data: hooksResult } = await tenantDb
        .from('plugin_hooks')
        .select('hook_name, handler_function, priority, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('priority', { ascending: true });

      hooks = (hooksResult || []).map(h => ({
        hook_name: h.hook_name,
        handler_code: h.handler_function,
        priority: h.priority || 10,
        enabled: h.is_enabled !== false
      }));
    } catch (hookError) {
    }

    // Load plugin_scripts from normalized table
    let pluginScripts = [];
    try {
      const { data: scriptsResult } = await tenantDb
        .from('plugin_scripts')
        .select('id, script_type, scope, file_name, file_content, load_priority, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('file_name', { ascending: true });

      pluginScripts = (scriptsResult || []).map(s => ({
        name: s.file_name,
        code: s.file_content,
        script_type: s.script_type,
        scope: s.scope,
        load_priority: s.load_priority
      }));
    } catch (scriptsError) {
    }

    // Load plugin_events from normalized table
    let pluginEvents = [];
    try {
      const { data: eventsResult } = await tenantDb
        .from('plugin_events')
        .select('id, event_name, file_name, listener_function, priority, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('event_name', { ascending: true })
        .order('priority', { ascending: true });

      pluginEvents = (eventsResult || []).map(e => ({
        name: e.file_name || `${e.event_name.replace(/\./g, '_')}.js`,
        code: e.listener_function,
        event_name: e.event_name,
        priority: e.priority || 10
      }));
    } catch (eventsError) {
    }

    // Load plugin_entities from normalized table
    let pluginEntities = [];
    try {
      const { data: entitiesResult } = await tenantDb
        .from('plugin_entities')
        .select('id, entity_name, table_name, description, schema_definition, migration_status, migration_version, create_table_sql, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('entity_name', { ascending: true });

      pluginEntities = (entitiesResult || []).map(e => ({
        name: `entities/${e.entity_name}.json`,
        code: JSON.stringify({
          entity_name: e.entity_name,
          table_name: e.table_name,
          description: e.description,
          schema_definition: e.schema_definition,
          migration_status: e.migration_status,
          migration_version: e.migration_version,
          create_table_sql: e.create_table_sql
        }, null, 2),
        entity_name: e.entity_name,
        table_name: e.table_name,
        migration_status: e.migration_status
      }));
    } catch (entitiesError) {
    }

    // Load plugin_controllers from normalized table
    let pluginControllers = [];
    try {
      const { data: controllersResult } = await tenantDb
        .from('plugin_controllers')
        .select('id, controller_name, description, method, path, handler_code, requires_auth, is_enabled')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('controller_name', { ascending: true });

      pluginControllers = (controllersResult || []).map(c => ({
        name: `controllers/${c.controller_name}.js`,
        code: c.handler_code,
        controller_name: c.controller_name,
        method: c.method,
        path: c.path,
        description: c.description,
        requires_auth: c.requires_auth
      }));
    } catch (controllersError) {
    }

    // Load plugin_migrations from normalized table
    let pluginMigrations = [];
    try {
      const { data: migrationsResult } = await tenantDb
        .from('plugin_migrations')
        .select('id, migration_name, migration_version, migration_description, status, up_sql, down_sql, executed_at')
        .eq('plugin_id', pluginId)
        .order('migration_version', { ascending: false });

      pluginMigrations = (migrationsResult || []).map(m => ({
        name: `migrations/${m.migration_version}_${m.migration_name.replace(/[^a-zA-Z0-9_]/g, '_')}.sql`,
        code: `-- Migration: ${m.migration_description}
-- Version: ${m.migration_version}
-- Status: ${m.status}
-- Executed: ${m.executed_at || 'Not executed'}

-- UP Migration
${m.up_sql || '-- No up SQL'}

-- DOWN Migration (Rollback)
${m.down_sql || '-- No down SQL'}`,
        migration_version: m.migration_version,
        migration_description: m.migration_description,
        migration_status: m.status,
        executed_at: m.executed_at
      }));
    } catch (migrationsError) {
    }

    // Load documentation from plugin_docs table (README only, NOT manifest)
    let pluginDocs = [];
    let readme = '# Plugin Documentation';
    try {
      const { data: docsResult } = await tenantDb
        .from('plugin_docs')
        .select('doc_type, file_name, content, format')
        .eq('plugin_id', pluginId)
        .eq('is_visible', true)
        .neq('doc_type', 'manifest')
        .order('display_order', { ascending: true })
        .order('doc_type', { ascending: true });

      pluginDocs = (docsResult || []).map(d => ({
        name: d.file_name,
        code: d.content,
        doc_type: d.doc_type,
        format: d.format
      }));

      // Get README content
      const readmeDoc = pluginDocs.find(d => d.doc_type === 'readme');
      if (readmeDoc) {
        readme = readmeDoc.code;
      }
    } catch (docsError) {
    }

    // Parse manifest from plugin_registry.manifest column
    const manifest = typeof plugin.manifest === 'string' ? JSON.parse(plugin.manifest) : (plugin.manifest || {});

    // Build allFiles from normalized tables
    let allFiles = [];

    // Add files from plugin_scripts table
    allFiles = allFiles.concat(pluginScripts);

    // Add files from plugin_events table (as event files)
    const eventFiles = pluginEvents.map(e => ({
      name: `events/${e.name}`,
      code: e.code,
      event_name: e.event_name,
      priority: e.priority
    }));
    allFiles = allFiles.concat(eventFiles);

    // Add files from plugin_entities table
    allFiles = allFiles.concat(pluginEntities);

    // Add files from plugin_controllers table
    allFiles = allFiles.concat(pluginControllers);

    // Add files from plugin_migrations table
    allFiles = allFiles.concat(pluginMigrations);

    // Add files from plugin_docs table
    allFiles = allFiles.concat(pluginDocs);

    // Add manifest.json as a file
    allFiles.push({
      name: 'manifest.json',
      code: JSON.stringify(manifest, null, 2),
      doc_type: 'manifest',
      format: 'json'
    });

    const generatedFiles = allFiles;

    // Organize files by type for DeveloperPluginEditor
    const controllers = [];
    const models = [];
    const components = [];

    generatedFiles.forEach(file => {
      const fileName = file.name || '';
      const code = file.code || '';
      const normalizedPath = fileName.replace(/^src\//, '');

      if (normalizedPath.includes('controllers/') || normalizedPath.endsWith('Controller.js')) {
        controllers.push({
          name: normalizedPath.split('/').pop().replace('.js', ''),
          code,
          path: fileName
        });
      } else if (normalizedPath.includes('models/') || normalizedPath.includes('Model.js')) {
        models.push({
          name: normalizedPath.split('/').pop().replace('.js', ''),
          code,
          path: fileName
        });
      } else if (normalizedPath.includes('components/') || normalizedPath.match(/\.(jsx|tsx)$/)) {
        components.push({
          name: normalizedPath.split('/').pop().replace(/\.(jsx?|tsx?)$/, ''),
          code,
          path: fileName
        });
      }
    });

    // Add admin pages from plugin_admin_pages table
    let adminPages = [];
    try {
      const { data: adminPagesResult } = await tenantDb
        .from('plugin_admin_pages')
        .select('page_key, page_name, route, component_code, icon, category, description')
        .eq('plugin_id', pluginId)
        .eq('is_enabled', true)
        .order('page_key', { ascending: true });

      // Transform to camelCase for frontend
      adminPages = (adminPagesResult || []).map(p => ({
        pageKey: p.page_key,
        pageName: p.page_name,
        route: p.route,
        componentCode: p.component_code,
        icon: p.icon,
        category: p.category,
        description: p.description
      }));
    } catch (adminError) {
    }

    // Load cron jobs from plugin_cron table
    let cronJobs = [];
    try {
      const storeId = req.headers['x-store-id'] || req.storeId;
      await ensurePluginCronTable(tenantDb, storeId);
      const { data: cronResult } = await tenantDb
        .from('plugin_cron')
        .select('*')
        .eq('plugin_id', pluginId)
        .order('cron_name', { ascending: true });

      cronJobs = cronResult || [];
    } catch (cronError) {
    }

    res.json({
      success: true,
      data: {
        ...plugin,
        generated_by_ai: manifest?.generated_by_ai || plugin.type === 'ai-generated',
        hooks: hooks,
        controllers,
        models,
        components,
        adminPages,
        cronJobs,
        manifest,
        readme,
        source_code: generatedFiles
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/plugins/:id/export
 * Export plugin as downloadable package
 */
router.get('/:id/export', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;

    // Get plugin metadata
    const { data: pluginInfo, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (pluginError || !pluginInfo) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }

    // Get scripts
    const { data: scripts } = await tenantDb
      .from('plugin_scripts')
      .select('file_name, file_content, script_type, scope, load_priority')
      .eq('plugin_id', id)
      .order('file_name', { ascending: true });

    // Get events
    const { data: events } = await tenantDb
      .from('plugin_events')
      .select('event_name, file_name, listener_function, priority')
      .eq('plugin_id', id)
      .order('event_name', { ascending: true });

    // Get hooks
    const { data: hooks } = await tenantDb
      .from('plugin_hooks')
      .select('hook_name, hook_type, handler_function, priority')
      .eq('plugin_id', id)
      .order('hook_name', { ascending: true });

    // Get widgets
    const { data: widgets } = await tenantDb
      .from('plugin_widgets')
      .select('widget_id, widget_name, description, component_code, default_config, category, icon')
      .eq('plugin_id', id);

    // Get entities
    const { data: entities } = await tenantDb
      .from('plugin_entities')
      .select('entity_name, table_name, model_code, schema_definition, description')
      .eq('plugin_id', id)
      .order('entity_name', { ascending: true });

    // Get migrations
    const { data: migrations } = await tenantDb
      .from('plugin_migrations')
      .select('migration_name, plugin_name, migration_version, up_sql')
      .eq('plugin_id', id)
      .order('migration_name', { ascending: true });

    // Get controllers
    const { data: controllers } = await tenantDb
      .from('plugin_controllers')
      .select('controller_name, method, path, handler_code, description')
      .eq('plugin_id', id)
      .order('controller_name', { ascending: true });

    // Get plugin data (key-value storage)
    const { data: pluginDataKV } = await tenantDb
      .from('plugin_data')
      .select('data_key, data_value')
      .eq('plugin_id', id)
      .order('data_key', { ascending: true });

    // Get plugin dependencies
    const { data: pluginDependencies } = await tenantDb
      .from('plugin_dependencies')
      .select('package_name, version, bundled_code')
      .eq('plugin_id', id)
      .order('package_name', { ascending: true });

    // Get plugin docs
    const { data: pluginDocs } = await tenantDb
      .from('plugin_docs')
      .select('title, content, doc_type, display_order, file_name')
      .eq('plugin_id', id)
      .order('display_order', { ascending: true })
      .order('title', { ascending: true });

    // Get admin pages
    const { data: adminPages } = await tenantDb
      .from('plugin_admin_pages')
      .select('page_key, page_name, route, component_code, description, icon, category, order_position')
      .eq('plugin_id', id)
      .order('order_position', { ascending: true });

    // Get admin scripts
    const { data: adminScripts } = await tenantDb
      .from('plugin_admin_scripts')
      .select('script_name, script_code, description, load_order')
      .eq('plugin_id', id)
      .order('load_order', { ascending: true });

    // Get cron jobs
    const storeIdForCron = req.headers['x-store-id'] || req.storeId;
    await ensurePluginCronTable(tenantDb, storeIdForCron);
    const { data: cronJobs } = await tenantDb
      .from('plugin_cron')
      .select('cron_name, cron_schedule, handler_method, description, is_enabled')
      .eq('plugin_id', id)
      .order('cron_name', { ascending: true });

    // Build package
    const packageData = {
      packageVersion: '1.0.0',
      exportedAt: new Date().toISOString(),

      plugin: {
        name: pluginInfo.name,
        slug: pluginInfo.slug,
        version: pluginInfo.version,
        description: pluginInfo.description,
        author: pluginInfo.author,
        category: pluginInfo.category,
        type: pluginInfo.type,
        framework: pluginInfo.framework,
        manifest: pluginInfo.manifest,
        permissions: pluginInfo.permissions,
        dependencies: pluginInfo.dependencies,
        tags: pluginInfo.tags
      },

      files: (scripts || []).map(s => ({
        name: s.file_name,
        content: s.file_content,
        type: s.script_type,
        scope: s.scope,
        priority: s.load_priority
      })),

      events: (events || []).map(e => ({
        eventName: e.event_name,
        fileName: e.file_name,
        listenerCode: e.listener_function,
        priority: e.priority
      })),

      hooks: (hooks || []).map(h => ({
        hookName: h.hook_name,
        hookType: h.hook_type,
        handlerCode: h.handler_function,
        priority: h.priority
      })),

      widgets: (widgets || []).map(w => ({
        widgetId: w.widget_id,
        widgetName: w.widget_name,
        description: w.description,
        componentCode: w.component_code,
        defaultConfig: w.default_config,
        category: w.category,
        icon: w.icon
      })),

      entities: (entities || []).map(e => ({
        name: e.entity_name,
        tableName: e.table_name,
        code: e.model_code,
        schemaDefinition: e.schema_definition,
        description: e.description
      })),

      migrations: (migrations || []).map(m => ({
        name: m.migration_name,
        pluginName: m.plugin_name,
        migrationVersion: m.migration_version,
        code: m.up_sql
      })),

      controllers: (controllers || []).map(c => ({
        name: c.controller_name,
        method: c.method,
        path: c.path,
        code: c.handler_code,
        description: c.description
      })),

      pluginData: (pluginDataKV || []).map(d => ({
        dataKey: d.data_key,
        dataValue: d.data_value
      })),

      pluginDependencies: (pluginDependencies || []).map(d => ({
        packageName: d.package_name,
        version: d.version,
        bundledCode: d.bundled_code
      })),

      pluginDocs: (pluginDocs || []).map(d => ({
        title: d.title,
        content: d.content,
        category: d.doc_type,
        orderPosition: d.display_order,
        fileName: d.file_name
      })),

      adminPages: (adminPages || []).map(p => ({
        pageKey: p.page_key,
        pageName: p.page_name,
        route: p.route,
        componentCode: p.component_code,
        description: p.description,
        icon: p.icon,
        category: p.category,
        orderPosition: p.order_position
      })),

      adminScripts: (adminScripts || []).map(s => ({
        scriptName: s.script_name,
        scriptCode: s.script_code,
        description: s.description,
        loadOrder: s.load_order
      })),

      cronJobs: (cronJobs || []).map(c => ({
        cronName: c.cron_name,
        cronSchedule: c.cron_schedule,
        handlerMethod: c.handler_method,
        description: c.description,
        isEnabled: c.is_enabled
      }))
    };

    res.json(packageData);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/import
 * Import a plugin from package file
 */
router.post('/import', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const packageData = req.body;

    // Generate new UUID
    const { randomUUID } = require('crypto');
    const pluginId = randomUUID();

    // Get creator_id from request (sent by frontend) or authenticated user
    let creatorId = packageData.userId || req.user?.id;

    // If still no creator, get first user as fallback
    if (!creatorId) {
      const { data: firstUser } = await tenantDb
        .from('users')
        .select('id')
        .limit(1)
        .single();
      creatorId = firstUser?.id;
    }

    // Ensure unique name and slug
    let uniqueName = packageData.plugin.name;
    let uniqueSlug = packageData.plugin.slug;
    let counter = 1;

    while (true) {
      const { data: existing } = await tenantDb
        .from('plugin_registry')
        .select('id')
        .or(`name.eq.${uniqueName},slug.eq.${uniqueSlug}`)
        .limit(1);

      if (!existing || existing.length === 0) break;

      counter++;
      uniqueName = `${packageData.plugin.name} (${counter})`;
      uniqueSlug = `${packageData.plugin.slug}-${counter}`;
    }

    // Create plugin_registry entry
    const { error: registryError } = await tenantDb
      .from('plugin_registry')
      .insert({
        id: pluginId,
        name: uniqueName,
        slug: uniqueSlug,
        version: packageData.plugin.version,
        description: packageData.plugin.description,
        author: packageData.plugin.author,
        category: packageData.plugin.category,
        type: packageData.plugin.type,
        framework: packageData.plugin.framework || 'react',
        status: 'active',
        creator_id: creatorId,
        is_installed: true,
        is_enabled: true,
        manifest: packageData.plugin.manifest,
        permissions: packageData.plugin.permissions,
        dependencies: packageData.plugin.dependencies,
        tags: packageData.plugin.tags
      });

    if (registryError) throw new Error(registryError.message);

    // Import files
    for (const file of packageData.files || []) {
      await tenantDb.from('plugin_scripts').insert({
        plugin_id: pluginId,
        file_name: file.name,
        file_content: file.content,
        script_type: file.type || 'js',
        scope: file.scope || 'frontend',
        load_priority: file.priority || 0,
        is_enabled: true
      });
    }

    // Import events
    for (const event of packageData.events || []) {
      const fileName = event.fileName || `${event.eventName.replace(/\./g, '_')}.js`;
      await tenantDb.from('plugin_events').insert({
        plugin_id: pluginId,
        event_name: event.eventName,
        file_name: fileName,
        listener_function: event.listenerCode,
        priority: event.priority || 10,
        is_enabled: true
      });
    }

    // Import hooks
    for (const hook of packageData.hooks || []) {
      await tenantDb.from('plugin_hooks').insert({
        plugin_id: pluginId,
        hook_name: hook.hookName,
        hook_type: hook.hookType || 'filter',
        handler_function: hook.handlerCode,
        priority: hook.priority || 10,
        is_enabled: true
      });
    }

    // Import widgets (with JSX transformation)
    for (const widget of packageData.widgets || []) {
      const uniqueWidgetId = `${widget.widgetId}-${pluginId.substring(0, 8)}`;

      // Transform JSX to React.createElement() if present
      let componentCode = widget.componentCode;
      if (componentCode) {
        const transformResult = await transformComponentCode(componentCode, `${widget.widgetId}.jsx`);
        if (transformResult.success) {
          componentCode = transformResult.code;
        } else {
          console.warn(`Warning: Failed to transform widget ${widget.widgetId}:`, transformResult.error);
        }
      }

      await tenantDb.from('plugin_widgets').insert({
        plugin_id: pluginId,
        widget_id: uniqueWidgetId,
        widget_name: widget.widgetName,
        description: widget.description,
        component_code: componentCode,
        default_config: widget.defaultConfig || {},
        category: widget.category || 'functional',
        icon: widget.icon || 'Box',
        is_enabled: true
      });
    }

    // Build table name mapping for migrations
    const tableNameMap = {};
    const uniqueSuffix = counter > 1 ? `_${counter}` : '';

    // Import entities
    for (const entity of packageData.entities || []) {
      const uniqueEntityName = `${entity.name}${uniqueSuffix}`;
      const baseTableName = entity.tableName || entity.name.toLowerCase().replace(/\s+/g, '_');
      const uniqueTableName = `${baseTableName}${uniqueSuffix}`;

      if (uniqueSuffix) {
        tableNameMap[baseTableName] = uniqueTableName;
      }

      await tenantDb.from('plugin_entities').insert({
        plugin_id: pluginId,
        entity_name: uniqueEntityName,
        table_name: uniqueTableName,
        model_code: entity.code,
        schema_definition: entity.schemaDefinition || {},
        description: entity.description || null
      });
    }

    // Import migrations
    for (const migration of packageData.migrations || []) {
      let migrationSql = migration.code;

      if (uniqueSuffix && Object.keys(tableNameMap).length > 0) {
        const sortedTableNames = Object.keys(tableNameMap).sort((a, b) => b.length - a.length);
        for (const originalTable of sortedTableNames) {
          const regex = new RegExp(`\\b${originalTable}\\b`, 'gi');
          migrationSql = migrationSql.replace(regex, tableNameMap[originalTable]);
        }
      }

      await tenantDb.from('plugin_migrations').insert({
        plugin_id: pluginId,
        plugin_name: migration.pluginName || uniqueName,
        migration_name: migration.name,
        migration_version: migration.migrationVersion || `v${Date.now()}`,
        up_sql: migrationSql
      });
    }

    // Import controllers
    for (const controller of packageData.controllers || []) {
      await tenantDb.from('plugin_controllers').insert({
        plugin_id: pluginId,
        controller_name: controller.name,
        method: controller.method || 'GET',
        path: controller.path || `/api/plugins/${uniqueSlug}/${controller.name}`,
        handler_code: controller.code,
        description: controller.description || null
      });
    }

    // Import plugin data
    for (const data of packageData.pluginData || []) {
      await tenantDb.from('plugin_data').insert({
        plugin_id: pluginId,
        data_key: data.dataKey,
        data_value: data.dataValue
      });
    }

    // Import plugin dependencies
    for (const dependency of packageData.pluginDependencies || []) {
      await tenantDb.from('plugin_dependencies').insert({
        plugin_id: pluginId,
        package_name: dependency.packageName,
        version: dependency.version,
        bundled_code: dependency.bundledCode
      });
    }

    // Import plugin docs
    for (const doc of packageData.pluginDocs || []) {
      const docType = doc.category || 'readme';
      const fileName = doc.fileName || (() => {
        switch(docType) {
          case 'readme': return 'README.md';
          case 'manifest': return 'manifest.json';
          case 'changelog': return 'CHANGELOG.md';
          case 'license': return 'LICENSE';
          case 'contributing': return 'CONTRIBUTING.md';
          default: return `${docType}.md`;
        }
      })();

      await tenantDb.from('plugin_docs').insert({
        plugin_id: pluginId,
        doc_type: docType,
        file_name: fileName,
        title: doc.title || docType.toUpperCase(),
        content: doc.content,
        format: docType === 'manifest' ? 'json' : 'markdown',
        display_order: doc.orderPosition || 0
      });
    }

    // Import admin pages (with JSX transformation)
    for (const page of packageData.adminPages || []) {
      // Transform JSX to React.createElement() if present
      let componentCode = page.componentCode;
      if (componentCode) {
        const transformResult = await transformComponentCode(componentCode, `${page.pageKey}.jsx`);
        if (transformResult.success) {
          componentCode = transformResult.code;
        } else {
          console.warn(`Warning: Failed to transform admin page ${page.pageKey}:`, transformResult.error);
        }
      }

      await tenantDb.from('plugin_admin_pages').insert({
        plugin_id: pluginId,
        page_key: page.pageKey,
        page_name: page.pageName,
        route: page.route,
        component_code: componentCode,
        description: page.description,
        icon: page.icon,
        category: page.category,
        order_position: page.orderPosition || 100,
        is_enabled: true
      });
    }

    // Import admin scripts
    for (const script of packageData.adminScripts || []) {
      await tenantDb.from('plugin_admin_scripts').insert({
        plugin_id: pluginId,
        script_name: script.scriptName,
        script_code: script.scriptCode,
        description: script.description,
        load_order: script.loadOrder || 100,
        is_enabled: true
      });
    }

    // Import cron jobs
    if (packageData.cronJobs && packageData.cronJobs.length > 0) {
      const storeId = req.headers['x-store-id'] || req.storeId;
      await ensurePluginCronTable(tenantDb, storeId);
      for (const cron of packageData.cronJobs) {
        await tenantDb.from('plugin_cron').insert({
          plugin_id: pluginId,
          cron_name: cron.cronName,
          cron_schedule: cron.cronSchedule,
          handler_method: cron.handlerMethod,
          description: cron.description || `Scheduled task: ${cron.cronName}`,
          is_enabled: cron.isEnabled !== false
        });
      }
    }

    res.json({
      success: true,
      message: 'Plugin imported successfully',
      plugin: {
        id: pluginId,
        name: uniqueName
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/plugins/registry/:id/files
 * Update a specific file in a plugin
 */
router.put('/registry/:id/files', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;
    const { path, content } = req.body;

    // Get current plugin
    const { data: plugin, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (pluginError || !plugin) {
      return res.status(404).json({ success: false, error: 'Plugin not found' });
    }

    const normalizePath = (p) => p.replace(/^\/+/, '').replace(/^src\//, '');
    const normalizedRequestPath = normalizePath(path);

    // Handle manifest.json
    if (normalizedRequestPath === 'manifest.json') {
      try {
        const manifestData = JSON.parse(content);
        await tenantDb.from('plugin_registry').update({ manifest: manifestData }).eq('id', id);
        return res.json({ success: true, message: 'Manifest saved successfully' });
      } catch (error) {
        return res.status(400).json({ success: false, error: `Failed to save manifest: ${error.message}` });
      }
    }

    // Handle documentation files
    const docTypeMap = { 'README.md': 'readme', 'CHANGELOG.md': 'changelog', 'LICENSE': 'license', 'CONTRIBUTING.md': 'contributing' };
    if (docTypeMap[normalizedRequestPath]) {
      const docType = docTypeMap[normalizedRequestPath];
      try {
        const { data: existing } = await tenantDb.from('plugin_docs').select('id').eq('plugin_id', id).eq('doc_type', docType);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_docs').update({ content, format: 'markdown' }).eq('plugin_id', id).eq('doc_type', docType);
        } else {
          await tenantDb.from('plugin_docs').insert({ plugin_id: id, doc_type: docType, file_name: normalizedRequestPath, content, format: 'markdown', is_visible: true });
        }
        return res.json({ success: true, message: 'Documentation saved successfully' });
      } catch (error) {
        return res.status(400).json({ success: false, error: `Failed to save documentation: ${error.message}` });
      }
    }

    // Handle event files
    if (normalizedRequestPath.startsWith('events/')) {
      const fileName = normalizedRequestPath.replace('events/', '');
      try {
        const { data: existing } = await tenantDb.from('plugin_events').select('event_name').eq('plugin_id', id).eq('file_name', fileName);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_events').update({ listener_function: content }).eq('plugin_id', id).eq('file_name', fileName);
        } else {
          const eventName = fileName.replace('.js', '').replace(/_/g, '.');
          await tenantDb.from('plugin_events').insert({ plugin_id: id, event_name: eventName, file_name: fileName, listener_function: content, priority: 10, is_enabled: true });
        }
        return res.json({ success: true, message: 'Event file saved successfully' });
      } catch (eventError) {
        return res.status(500).json({ success: false, error: `Failed to save event: ${eventError.message}` });
      }
    }

    // Handle hook files
    if (normalizedRequestPath.startsWith('hooks/')) {
      const hookName = normalizedRequestPath.replace('hooks/', '').replace('.js', '').replace(/_/g, '.');
      try {
        const { data: existing } = await tenantDb.from('plugin_hooks').select('id').eq('plugin_id', id).eq('hook_name', hookName);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_hooks').update({ handler_function: content }).eq('plugin_id', id).eq('hook_name', hookName);
        } else {
          await tenantDb.from('plugin_hooks').insert({ plugin_id: id, hook_name: hookName, handler_function: content, priority: 10, is_enabled: true });
        }
        return res.json({ success: true, message: 'Hook file saved successfully' });
      } catch (hookError) {
        return res.status(500).json({ success: false, error: `Failed to save hook: ${hookError.message}` });
      }
    }

    // Handle entity files
    if (normalizedRequestPath.startsWith('entities/')) {
      const entityFileName = normalizedRequestPath.replace('entities/', '').replace('.json', '');
      try {
        // Handle both string and object content (AI may return either)
        const entityData = typeof content === 'object' ? content : JSON.parse(content);
        const entityName = entityData.entity_name || entityFileName;
        const tableName = entityData.table_name;
        if (!tableName) return res.status(400).json({ success: false, error: 'Entity JSON must include table_name field' });

        const { data: existing } = await tenantDb.from('plugin_entities').select('id').eq('plugin_id', id).eq('entity_name', entityName);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_entities').update({ schema_definition: entityData.schema_definition, table_name: tableName, description: entityData.description || '' }).eq('plugin_id', id).eq('entity_name', entityName);
        } else {
          await tenantDb.from('plugin_entities').insert({ plugin_id: id, entity_name: entityName, table_name: tableName, description: entityData.description || '', schema_definition: entityData.schema_definition, migration_status: 'pending', is_enabled: true });
        }
        return res.json({ success: true, message: 'Entity saved successfully' });
      } catch (entityError) {
        return res.status(500).json({ success: false, error: `Failed to save entity: ${entityError.message}` });
      }
    }

    // Handle controller files
    if (normalizedRequestPath.startsWith('controllers/')) {
      const controllerFileName = normalizedRequestPath.replace('controllers/', '').replace('.js', '');
      try {
        const { data: existing } = await tenantDb.from('plugin_controllers').select('controller_name').eq('plugin_id', id).eq('controller_name', controllerFileName);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_controllers').update({ handler_code: content }).eq('plugin_id', id).eq('controller_name', controllerFileName);
          return res.json({ success: true, message: 'Controller handler code updated successfully' });
        } else {
          return res.status(404).json({ success: false, error: `Controller '${controllerFileName}' not found` });
        }
      } catch (controllerError) {
        return res.status(500).json({ success: false, error: `Failed to save controller: ${controllerError.message}` });
      }
    }

    // Handle migration files - save to plugin_migrations table
    if (normalizedRequestPath.startsWith('migrations/')) {
      const migrationFileName = normalizedRequestPath.replace('migrations/', '');
      try {
        // Extract version from filename (e.g., "1704200000_create_table.sql" -> "1704200000")
        const versionMatch = migrationFileName.match(/^(\d+)/);
        const migrationVersion = versionMatch ? versionMatch[1] : Date.now().toString();
        // Remove version prefix and .sql to get just the migration name
        const migrationName = migrationFileName.replace('.sql', '').replace(/^\d+_/, '');

        // Parse description from SQL comment if present
        const descMatch = content.match(/--\s*Migration:\s*(.+)/i);
        const description = descMatch ? descMatch[1].trim() : `Migration ${migrationName}`;

        const { data: existing } = await tenantDb.from('plugin_migrations').select('id').eq('plugin_id', id).eq('migration_version', migrationVersion);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_migrations').update({
            migration_name: migrationName,
            migration_description: description,
            up_sql: content
          }).eq('plugin_id', id).eq('migration_version', migrationVersion);
        } else {
          await tenantDb.from('plugin_migrations').insert({
            plugin_id: id,
            plugin_name: plugin.name || plugin.slug,
            migration_name: migrationName,
            migration_version: migrationVersion,
            migration_description: description,
            up_sql: content,
            status: 'pending'
          });
        }
        return res.json({ success: true, message: 'Migration saved successfully' });
      } catch (migrationError) {
        console.error('Migration save error:', migrationError);
        return res.status(500).json({ success: false, error: `Failed to save migration: ${migrationError.message}` });
      }
    }

    // Handle cron job files - save to plugin_cron table
    if (normalizedRequestPath.startsWith('cron/')) {
      const cronFileName = normalizedRequestPath.replace('cron/', '').replace('.json', '');
      try {
        // Ensure plugin_cron table exists (for existing stores)
        const storeId = req.headers['x-store-id'] || req.storeId;
        await ensurePluginCronTable(tenantDb, storeId);

        // Parse cron job definition (handle both string and object content)
        const cronData = typeof content === 'object' ? content : JSON.parse(content);
        const cronName = cronData.cron_name || cronFileName;

        const { data: existing } = await tenantDb.from('plugin_cron').select('id').eq('plugin_id', id).eq('cron_name', cronName);
        if (existing && existing.length > 0) {
          await tenantDb.from('plugin_cron').update({
            cron_schedule: cronData.schedule || cronData.cron_schedule,
            handler_method: cronData.handler_method || cronName,
            description: cronData.description,
            handler_code: cronData.handler_code,
            handler_params: cronData.handler_params || {},
            is_enabled: cronData.is_enabled !== false,
            updated_at: new Date().toISOString()
          }).eq('plugin_id', id).eq('cron_name', cronName);
        } else {
          await tenantDb.from('plugin_cron').insert({
            plugin_id: id,
            cron_name: cronName,
            cron_schedule: cronData.schedule || cronData.cron_schedule || '0 * * * *',
            handler_method: cronData.handler_method || cronName,
            description: cronData.description || `Scheduled task: ${cronName}`,
            handler_code: cronData.handler_code,
            handler_params: cronData.handler_params || {},
            is_enabled: cronData.is_enabled !== false
          });
        }
        return res.json({ success: true, message: 'Cron job saved successfully' });
      } catch (cronError) {
        console.error('Cron save error:', cronError);
        return res.status(500).json({ success: false, error: `Failed to save cron job: ${cronError.message}` });
      }
    }

    // Block other specialized files
    if (normalizedRequestPath.startsWith('admin/')) return res.status(400).json({ success: false, error: 'Admin pages have special handling' });
    if (normalizedRequestPath.startsWith('models/')) return res.status(400).json({ success: false, error: 'Models belong in plugin_entities table' });

    // Default: save to plugin_scripts
    try {
      const { data: existing } = await tenantDb.from('plugin_scripts').select('id').eq('plugin_id', id).eq('file_name', normalizedRequestPath);
      if (existing && existing.length > 0) {
        await tenantDb.from('plugin_scripts').update({ file_content: content }).eq('plugin_id', id).eq('file_name', normalizedRequestPath);
      } else {
        await tenantDb.from('plugin_scripts').insert({ plugin_id: id, file_name: normalizedRequestPath, file_content: content, script_type: 'js', scope: 'frontend', load_priority: 0, is_enabled: true });
      }
      await tenantDb.from('plugin_registry').update({ updated_at: new Date().toISOString() }).eq('id', id);
      res.json({ success: true, message: 'File saved successfully' });
    } catch (scriptError) {
      res.status(500).json({ success: false, error: `Failed to save file: ${scriptError.message}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/plugins/registry/:id/status
 * Toggle plugin status
 */
router.patch('/registry/:id/status', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;
    const { status } = req.body;

    await tenantDb.from('plugin_registry').update({ status }).eq('id', id);

    res.json({
      success: true,
      message: `Plugin ${status === 'active' ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Failed to update plugin status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/plugins/registry/:id
 * Delete a plugin
 */
router.delete('/registry/:id', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;

    await tenantDb.from('plugin_registry').delete().eq('id', id);

    res.json({ success: true, message: 'Plugin deleted successfully' });
  } catch (error) {
    console.error('Failed to delete plugin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/plugins/registry
 * Create a new plugin
 */
router.post('/registry', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const pluginData = req.body;

    const { randomUUID } = require('crypto');
    const id = randomUUID();
    const slug = pluginData.name.toLowerCase().replace(/\s+/g, '-');
    const creatorId = req.user?.id || null;

    const manifest = {
      name: pluginData.name,
      version: pluginData.version || '1.0.0',
      generated_by_ai: pluginData.generated_by_ai || false,
      generatedFiles: pluginData.generatedFiles || [],
      ...pluginData
    };

    await tenantDb.from('plugin_registry').insert({
      id,
      name: pluginData.name,
      slug,
      version: pluginData.version || '1.0.0',
      description: pluginData.description,
      author: pluginData.author || 'Unknown',
      category: pluginData.category || 'utility',
      status: pluginData.status || 'active',
      type: pluginData.generated_by_ai ? 'ai-generated' : 'custom',
      framework: 'react',
      manifest,
      creator_id: creatorId,
      is_installed: true,
      is_enabled: true
    });

    // Store generated files
    for (const file of pluginData.generatedFiles || []) {
      const fileName = file.name || file.filename || '';
      const fileContent = file.code || file.content || '';
      if (fileName && fileContent) {
        await tenantDb.from('plugin_scripts').insert({
          plugin_id: id, file_name: fileName, file_content: fileContent,
          script_type: 'js', scope: 'frontend', load_priority: 0, is_enabled: true
        });
      }
    }

    // Store hooks
    for (const hook of pluginData.hooks || []) {
      await tenantDb.from('plugin_hooks').insert({
        plugin_id: id,
        hook_name: hook.hook_name || hook.name,
        handler_function: hook.handler_code || hook.code || hook.handler,
        priority: hook.priority || 10,
        is_enabled: hook.enabled !== false
      });
    }

    // Store events
    for (const event of pluginData.events || []) {
      await tenantDb.from('plugin_events').insert({
        plugin_id: id,
        event_name: event.event_name || event.name,
        listener_function: event.listener_code || event.code || event.handler,
        priority: event.priority || 10,
        is_enabled: event.enabled !== false
      });
    }

    res.json({ success: true, message: 'Plugin created successfully', id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/plugins/:pluginId/scripts
 * Get all scripts for a plugin from plugin_scripts table
 */
router.get('/:pluginId/scripts', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId } = req.params;
    const { scope } = req.query; // 'frontend', 'backend', 'admin'

    // Prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Build query
    let query = tenantDb
      .from('plugin_scripts')
      .select('file_name, file_content, script_type, scope, load_priority')
      .eq('plugin_id', pluginId)
      .eq('is_enabled', true);

    if (scope) {
      query = query.eq('scope', scope);
    }

    const { data: scripts, error } = await query.order('load_priority', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: (scripts || []).map(s => ({
        name: s.file_name,
        content: s.file_content,
        type: s.script_type,
        scope: s.scope,
        priority: s.load_priority
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:pluginId/event-listeners
 * Create or update an event listener mapping
 */
router.post('/:pluginId/event-listeners', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId } = req.params;
    const { file_name, old_file_name, file_path, event_name, old_event_name, listener_function, priority = 10, description } = req.body;

    if (!event_name || !listener_function) {
      return res.status(400).json({
        success: false,
        error: 'event_name and listener_function are required'
      });
    }

    // Determine filename - use custom or generate from event_name
    const fileName = file_name || `${event_name.replace(/\./g, '_')}.js`;

    // Use plugin_events table (normalized structure)
    // Lookup by old_file_name or old_event_name (for editing existing events)
    let existing = [];

    if (old_file_name) {
      // Look up by old filename (most reliable for renames)
      const { data } = await tenantDb
        .from('plugin_events')
        .select('id, event_name')
        .eq('plugin_id', pluginId)
        .eq('file_name', old_file_name);
      existing = data || [];
    } else if (old_event_name) {
      // Fall back to old_event_name for backwards compatibility
      const { data } = await tenantDb
        .from('plugin_events')
        .select('id, event_name')
        .eq('plugin_id', pluginId)
        .eq('event_name', old_event_name);
      existing = data || [];
    }
    // else: New event creation - don't check for duplicates
    // Multiple listeners can listen to the same event with different handlers/files

    if (existing.length > 0) {
      // Update existing event (filename, event_name, and code)
      const { error } = await tenantDb
        .from('plugin_events')
        .update({
          event_name,
          file_name: fileName,
          listener_function,
          priority,
          updated_at: new Date().toISOString()
        })
        .eq('plugin_id', pluginId)
        .eq('id', existing[0].id);

      if (error) throw error;
    } else {
      // Insert new event with custom filename
      const { error } = await tenantDb
        .from('plugin_events')
        .insert({
          plugin_id: pluginId,
          event_name,
          file_name: fileName,
          listener_function,
          priority,
          is_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    }

    res.json({
      success: true,
      message: 'Event saved successfully'
    });
  } catch (error) {
    console.error('❌ Failed to save event:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Note: PUT and DELETE endpoints for plugin_event_listeners removed
// Table dropped - all events now use plugin_events table
// Event remapping handled via POST /api/plugins/:pluginId/event-listeners

/**
 * POST /api/plugins/:pluginId/controllers
 * Create a new controller
 */
router.post('/:pluginId/controllers', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId } = req.params;
    const { controller_name, method, path, handler_code, description, requires_auth = false } = req.body;

    if (!controller_name || !method || !path || !handler_code) {
      return res.status(400).json({
        success: false,
        error: 'controller_name, method, path, and handler_code are required'
      });
    }

    // Insert new controller
    const { error } = await tenantDb
      .from('plugin_controllers')
      .insert({
        plugin_id: pluginId,
        controller_name,
        method,
        path,
        handler_code,
        description: description || `${method} ${path}`,
        requires_auth,
        is_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Controller created successfully'
    });
  } catch (error) {
    console.error('❌ Failed to create controller:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/plugins/:pluginId/controllers/:controllerName
 * Update an existing controller
 */
router.put('/:pluginId/controllers/:controllerName', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId, controllerName } = req.params;
    const { controller_name, old_controller_name, method, path, handler_code, description, requires_auth } = req.body;

    // Use old_controller_name for lookup if provided, otherwise use controllerName from params
    const lookupName = old_controller_name || controllerName;

    // Update controller
    const { error } = await tenantDb
      .from('plugin_controllers')
      .update({
        controller_name: controller_name || lookupName,
        method,
        path,
        handler_code,
        description: description || `${method} ${path}`,
        requires_auth: requires_auth !== undefined ? requires_auth : false,
        updated_at: new Date().toISOString()
      })
      .eq('plugin_id', pluginId)
      .eq('controller_name', lookupName);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Controller updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// Plugin Cron Jobs - CRUD Operations
// ========================================

/**
 * GET /api/plugins/:pluginId/cron
 * Get all cron jobs for a plugin
 */
router.get('/:pluginId/cron', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const storeId = req.headers['x-store-id'] || req.storeId;
    await ensurePluginCronTable(tenantDb, storeId);
    const { pluginId } = req.params;

    const { data: cronJobs, error } = await tenantDb
      .from('plugin_cron')
      .select('*')
      .eq('plugin_id', pluginId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      cronJobs: cronJobs || []
    });
  } catch (error) {
    console.error('Failed to get plugin cron jobs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:pluginId/cron
 * Create a new cron job for a plugin
 */
router.post('/:pluginId/cron', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const storeId = req.headers['x-store-id'] || req.storeId;
    await ensurePluginCronTable(tenantDb, storeId);
    const { pluginId } = req.params;
    const {
      cron_name,
      cron_schedule,
      handler_method,
      description,
      handler_code,
      handler_params = {},
      timezone = 'UTC',
      is_enabled = true,
      timeout_seconds = 300,
      max_failures = 5
    } = req.body;

    if (!cron_name || !cron_schedule || !handler_method) {
      return res.status(400).json({
        success: false,
        error: 'cron_name, cron_schedule, and handler_method are required'
      });
    }

    // Get store_id and user_id from request
    const store_id =
      req.headers['x-store-id'] ||
      req.query.store_id ||
      req.body?.store_id ||
      req.storeId ||
      req.user?.store_id ||
      req.user?.storeId;
    const user_id = req.user?.id || req.user?.user_id || req.body?.user_id;

    // Get plugin info for naming
    const { data: pluginInfo } = await tenantDb
      .from('plugin_registry')
      .select('name, slug')
      .eq('id', pluginId)
      .single();

    // Insert new plugin_cron job in tenant database
    const { data, error } = await tenantDb
      .from('plugin_cron')
      .insert({
        plugin_id: pluginId,
        cron_name,
        cron_schedule,
        handler_method,
        description: description || `Scheduled task: ${cron_name}`,
        handler_code,
        handler_params,
        timezone,
        is_enabled,
        timeout_seconds,
        max_failures,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Sync to cron_jobs table (same tenant DB) for scheduling
    let cronJobId = null;
    try {
      console.log(`🔄 Syncing plugin cron to cron_jobs table...`);

      const { data: cronJob, error: cronError } = await tenantDb
        .from('cron_jobs')
        .insert({
          name: `[Plugin] ${pluginInfo?.name || pluginId}: ${cron_name}`,
          description: description || `Plugin cron job: ${cron_name}`,
          cron_expression: cron_schedule,
          timezone: timezone || 'UTC',
          job_type: 'plugin_job',
          configuration: {
            plugin_cron_id: data.id,
            plugin_id: pluginId,
            plugin_slug: pluginInfo?.slug,
            plugin_name: pluginInfo?.name,
            cron_name: cron_name,
            handler_method: handler_method,
            params: handler_params || {}
          },
          source_type: 'plugin',
          source_id: pluginId,
          source_name: pluginInfo?.name || pluginId,
          handler: handler_method,
          user_id: user_id || null,
          store_id: store_id,
          is_active: is_enabled !== false,
          is_paused: false,
          is_system: false,
          timeout_seconds: timeout_seconds || 300,
          max_failures: max_failures || 5,
          next_run_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (cronError) throw cronError;

      cronJobId = cronJob.id;

      // Update plugin_cron with the cron_job_id
      await tenantDb
        .from('plugin_cron')
        .update({ cron_job_id: cronJobId })
        .eq('id', data.id);

      data.cron_job_id = cronJobId;
      console.log(`✅ Synced plugin cron to cron_jobs: ${cronJobId}`);
    } catch (syncError) {
      console.error('⚠️ Failed to sync to cron_jobs:', syncError.message);
      console.error('   Full error:', syncError);
      // Don't fail the request - plugin_cron was created successfully
    }

    res.json({
      success: true,
      message: 'Cron job created successfully',
      cronJob: data,
      cronJobId: cronJobId
    });
  } catch (error) {
    console.error('Failed to create plugin cron job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/plugins/:pluginId/cron/:cronName
 * Update an existing cron job
 */
router.put('/:pluginId/cron/:cronName', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId, cronName } = req.params;
    const {
      cron_name,
      cron_schedule,
      handler_method,
      description,
      handler_code,
      handler_params,
      timezone,
      is_enabled,
      timeout_seconds,
      max_failures
    } = req.body;

    // Build update object with only provided fields
    const updateData = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that were actually provided
    if (cron_name !== undefined) updateData.cron_name = cron_name;
    if (cron_schedule !== undefined) updateData.cron_schedule = cron_schedule;
    if (handler_method !== undefined) updateData.handler_method = handler_method;
    if (description !== undefined) updateData.description = description;
    if (handler_code !== undefined) updateData.handler_code = handler_code;
    if (handler_params !== undefined) updateData.handler_params = handler_params;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled;
    if (timeout_seconds !== undefined) updateData.timeout_seconds = timeout_seconds;
    if (max_failures !== undefined) updateData.max_failures = max_failures;

    // Update cron job
    const { data, error } = await tenantDb
      .from('plugin_cron')
      .update(updateData)
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName)
      .select()
      .single();

    if (error) throw error;

    // Sync updates to cron_jobs table if linked
    if (data.cron_job_id) {
      try {
        const cronUpdateData = { updated_at: new Date().toISOString() };
        if (cron_schedule !== undefined) cronUpdateData.cron_expression = cron_schedule;
        if (description !== undefined) cronUpdateData.description = description;
        if (timezone !== undefined) cronUpdateData.timezone = timezone;
        if (is_enabled !== undefined) cronUpdateData.is_active = is_enabled;
        if (timeout_seconds !== undefined) cronUpdateData.timeout_seconds = timeout_seconds;
        if (max_failures !== undefined) cronUpdateData.max_failures = max_failures;
        if (handler_method !== undefined) cronUpdateData.handler = handler_method;

        if (Object.keys(cronUpdateData).length > 1) { // > 1 because updated_at is always there
          await tenantDb
            .from('cron_jobs')
            .update(cronUpdateData)
            .eq('id', data.cron_job_id);
          console.log(`✅ Synced plugin cron update to cron_jobs: ${data.cron_job_id}`);
        }
      } catch (syncError) {
        console.error('⚠️ Failed to sync update to cron_jobs:', syncError.message);
      }
    }

    res.json({
      success: true,
      message: 'Cron job updated successfully',
      cronJob: data
    });
  } catch (error) {
    console.error('Failed to update plugin cron job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/plugins/:pluginId/cron/:cronName
 * Delete a cron job
 */
router.delete('/:pluginId/cron/:cronName', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId, cronName } = req.params;

    // First get the cron_job_id before deleting
    const { data: cronData } = await tenantDb
      .from('plugin_cron')
      .select('cron_job_id')
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName)
      .single();

    // Delete from tenant plugin_cron
    const { error } = await tenantDb
      .from('plugin_cron')
      .delete()
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName);

    if (error) throw error;

    // Also delete from cron_jobs if linked
    if (cronData?.cron_job_id) {
      try {
        await tenantDb
          .from('cron_jobs')
          .delete()
          .eq('id', cronData.cron_job_id);
        console.log(`✅ Deleted plugin cron from cron_jobs: ${cronData.cron_job_id}`);
      } catch (syncError) {
        console.error('⚠️ Failed to delete from cron_jobs:', syncError.message);
      }
    }

    res.json({
      success: true,
      message: 'Cron job deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete plugin cron job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:pluginId/cron/:cronName/toggle
 * Toggle cron job enabled/disabled status
 */
router.post('/:pluginId/cron/:cronName/toggle', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId, cronName } = req.params;

    // Get current status
    const { data: existing, error: fetchError } = await tenantDb
      .from('plugin_cron')
      .select('is_enabled, cron_job_id')
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName)
      .single();

    if (fetchError) throw fetchError;

    // Toggle status
    const { data, error } = await tenantDb
      .from('plugin_cron')
      .update({
        is_enabled: !existing.is_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName)
      .select()
      .single();

    if (error) throw error;

    // Sync toggle to cron_jobs
    if (existing.cron_job_id) {
      try {
        await tenantDb
          .from('cron_jobs')
          .update({ is_active: data.is_enabled, updated_at: new Date().toISOString() })
          .eq('id', existing.cron_job_id);
        console.log(`✅ Synced toggle to cron_jobs: ${existing.cron_job_id} -> ${data.is_enabled ? 'active' : 'paused'}`);
      } catch (syncError) {
        console.error('⚠️ Failed to sync toggle to cron_jobs:', syncError.message);
      }
    }

    res.json({
      success: true,
      message: `Cron job ${data.is_enabled ? 'enabled' : 'disabled'}`,
      cronJob: data
    });
  } catch (error) {
    console.error('Failed to toggle plugin cron job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:pluginId/cron/:cronName/run
 * Manually trigger a cron job execution
 */
router.post('/:pluginId/cron/:cronName/run', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId, cronName } = req.params;

    // Get cron job details
    const { data: cronJob, error: fetchError } = await tenantDb
      .from('plugin_cron')
      .select('*')
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName)
      .single();

    if (fetchError) throw fetchError;
    if (!cronJob) {
      return res.status(404).json({
        success: false,
        error: 'Cron job not found'
      });
    }

    // Get plugin info
    const { data: plugin, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('id, name, slug')
      .eq('id', pluginId)
      .single();

    if (pluginError) throw pluginError;

    // TODO: Queue the job for immediate execution via BackgroundJobManager
    // For now, just update last_run_at to indicate it was triggered
    const { data, error } = await tenantDb
      .from('plugin_cron')
      .update({
        last_run_at: new Date().toISOString(),
        last_status: 'running',
        run_count: (cronJob.run_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('plugin_id', pluginId)
      .eq('cron_name', cronName)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Cron job '${cronName}' triggered for execution`,
      cronJob: data
    });
  } catch (error) {
    console.error('Failed to trigger plugin cron job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Dynamic Controller Execution - 100% Database-Driven
 * Route: /api/plugins/:pluginId/exec/*
 * Executes controllers from plugin_controllers table
 * pluginId can be either UUID or slug
 *
 * Uses optionalAuth to populate req.user if authenticated
 * Uses storeResolver to populate req.storeId from domain/referer
 */
router.all('/:pluginId/exec/*', optionalAuthMiddleware, storeResolver({ required: false }), async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { pluginId } = req.params;
    const controllerPath = '/' + (req.params[0] || '');
    const method = req.method;

    // Check if pluginId is UUID or slug
    const isUUID = pluginId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Get store_id for plugin configuration check
    const store_id =
      req.headers['x-store-id'] ||
      req.query.store_id ||
      req.body?.store_id ||
      req.storeId ||
      req.user?.store_id ||
      req.user?.storeId;

    // First check if the plugin is enabled for this store
    // Need to do separate queries since Supabase doesn't support raw SQL joins easily
    let pluginQuery = tenantDb.from('plugin_registry').select('id, status, name, slug');
    if (isUUID) {
      pluginQuery = pluginQuery.eq('id', pluginId);
    } else {
      pluginQuery = pluginQuery.eq('slug', pluginId);
    }
    const { data: pluginData, error: pluginError } = await pluginQuery.maybeSingle();

    if (pluginError || !pluginData) {
      return res.status(404).json({
        success: false,
        error: `Plugin not found: ${pluginId}`
      });
    }

    // Check if plugin is active in registry
    if (pluginData.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Plugin "${pluginData.name || pluginId}" is not active (status: ${pluginData.status})`
      });
    }

    // Check plugin configuration for this store
    if (store_id) {
      const { data: configData } = await tenantDb
        .from('plugin_configurations')
        .select('is_enabled')
        .eq('plugin_id', pluginData.id)
        .eq('store_id', store_id)
        .maybeSingle();

      if (configData && configData.is_enabled === false) {
        return res.status(403).json({
          success: false,
          error: `Plugin "${pluginData.name || pluginId}" is disabled for this store`
        });
      }
    }

    // Find matching controller in plugin_controllers table
    const { data: controllers, error: ctrlError } = await tenantDb
      .from('plugin_controllers')
      .select('*, plugin_registry!inner(slug, id)')
      .eq('plugin_id', pluginData.id)
      .eq('method', method)
      .eq('is_enabled', true);

    if (ctrlError) throw ctrlError;

    // Find matching controller by pattern (supports :id, :userId, etc.)
    const matchPath = (pattern, actual) => {
      const patternParts = pattern.split('/').filter(p => p);
      const actualParts = actual.split('/').filter(p => p);

      if (patternParts.length !== actualParts.length) return null;

      const params = {};
      let hasParams = false;

      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          // Capture parameter
          params[patternParts[i].substring(1)] = actualParts[i];
          hasParams = true;
        } else if (patternParts[i] !== actualParts[i]) {
          return null;
        }
      }
      return { params, hasParams };
    };

    // Sort controllers: exact matches first, then parameterized routes
    const sortedControllers = [...(controllers || [])].sort((a, b) => {
      const aHasParams = a.path.includes(':');
      const bHasParams = b.path.includes(':');
      if (aHasParams && !bHasParams) return 1;  // b (exact) before a (param)
      if (!aHasParams && bHasParams) return -1; // a (exact) before b (param)
      return 0;
    });

    let controller = null;
    let pathParams = null;

    for (const ctrl of sortedControllers) {
      const match = matchPath(ctrl.path, controllerPath);
      if (match !== null) {
        controller = ctrl;
        pathParams = match.params;
        break;
      }
    }

    if (!controller) {
      return res.status(404).json({
        success: false,
        error: `Controller not found: ${method} ${controllerPath}`,
        pluginId,
        availableControllers: (controllers || []).map(c => `${c.method} ${c.path}`)
      });
    }

    // Create execution context for the controller
    const context = {
      req: {
        body: req.body,
        query: req.query,
        params: { ...req.params, ...pathParams, 0: controllerPath },
        headers: req.headers,
        ip: req.ip,
        user: req.user,
        method: req.method
      },
      res: {
        json: (data) => {
          if (!res.headersSent) {
            res.json(data);
          }
        },
        status: (code) => {
          if (!res.headersSent) {
            res.status(code);
          }
          return {
            json: (data) => {
              if (!res.headersSent) {
                res.json(data);
              }
            }
          };
        }
      },
      supabase: tenantDb  // Pass Supabase client instead of sequelize
    };

    // Execute the controller handler code
    const handlerFunc = new Function('req', 'res', 'context', `
      const { supabase } = context;
      return (${controller.handler_code})(req, res, { supabase });
    `);

    await handlerFunc(context.req, context.res, context);

    // If handler didn't send a response, send a default success
    if (!res.headersSent) {
      res.json({ success: true, message: 'Controller executed successfully' });
    }

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * DELETE /api/plugins/registry/:id/files
 * Delete a specific file from a plugin
 */
router.delete('/registry/:id/files', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'File path is required'
      });
    }

    // Normalize paths for comparison
    const normalizePath = (p) => p.replace(/^\/+/, '').replace(/^src\//, '');
    const normalizedPath = normalizePath(path);

    let deleted = false;
    let attemptedTable = null;

    // Handle different file types based on path

    // Delete documentation files from plugin_docs (README, CHANGELOG, LICENSE)
    // NOTE: manifest.json is in plugin_registry.manifest, not plugin_docs
    if (normalizedPath === 'README.md' || normalizedPath === 'CHANGELOG.md' ||
        normalizedPath === 'LICENSE' || normalizedPath === 'CONTRIBUTING.md') {

      const docTypeMap = {
        'README.md': 'readme',
        'CHANGELOG.md': 'changelog',
        'LICENSE': 'license',
        'CONTRIBUTING.md': 'contributing'
      };

      const docType = docTypeMap[normalizedPath];
      attemptedTable = 'plugin_docs';

      try {
        const { error } = await tenantDb
          .from('plugin_docs')
          .delete()
          .eq('plugin_id', id)
          .eq('doc_type', docType);
        if (!error) deleted = true;
      } catch (err) {
        // Silently fail
      }
    }
    // Prevent deletion of manifest.json (it's in plugin_registry.manifest column)
    else if (normalizedPath === 'manifest.json') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete manifest.json. Edit it to modify plugin metadata.'
      });
    }
    // Delete from plugin_events table
    else if (normalizedPath.startsWith('events/')) {
      const fileName = normalizedPath.replace('events/', '');
      attemptedTable = 'plugin_events';
      try {
        const { data, error } = await tenantDb
          .from('plugin_events')
          .delete()
          .eq('plugin_id', id)
          .eq('file_name', fileName)
          .select();
        if (!error && data && data.length > 0) {
          deleted = true;
        }
      } catch (err) {
        // Silently fail
      }
    }
    // Delete from plugin_entities table
    else if (normalizedPath.startsWith('entities/')) {
      const fileName = normalizedPath.replace('entities/', '').replace('.json', '');
      attemptedTable = 'plugin_entities';
      try {
        const { data, error } = await tenantDb
          .from('plugin_entities')
          .delete()
          .eq('plugin_id', id)
          .eq('entity_name', fileName)
          .select();
        if (!error && data && data.length > 0) {
          deleted = true;
        }
      } catch (err) {
        // Silently fail
      }
    }
    // Delete from plugin_controllers table
    else if (normalizedPath.startsWith('controllers/')) {
      const fileName = normalizedPath.replace('controllers/', '').replace('.js', '');
      attemptedTable = 'plugin_controllers';
      try {
        const { data, error } = await tenantDb
          .from('plugin_controllers')
          .delete()
          .eq('plugin_id', id)
          .eq('controller_name', fileName)
          .select();
        if (!error && data && data.length > 0) {
          deleted = true;
        }
      } catch (err) {
        // Silently fail
      }
    }
    // Delete from plugin_cron table
    else if (normalizedPath.startsWith('cron/')) {
      const cronName = normalizedPath.replace('cron/', '').replace('.json', '');
      attemptedTable = 'plugin_cron';
      try {
        const storeId = req.headers['x-store-id'] || req.storeId;
        await ensurePluginCronTable(tenantDb, storeId);
        const { data, error } = await tenantDb
          .from('plugin_cron')
          .delete()
          .eq('plugin_id', id)
          .eq('cron_name', cronName)
          .select();
        if (!error && data && data.length > 0) {
          deleted = true;
        }
      } catch (err) {
        // Silently fail
      }
    }
    // Delete from plugin_hooks table
    else if (normalizedPath.startsWith('hooks/')) {
      // Convert file name to hook name: hooks/product.title.color.js -> product.title.color
      const hookName = normalizedPath.replace('hooks/', '').replace('.js', '').replace(/_/g, '.');
      attemptedTable = 'plugin_hooks';
      try {
        const { data, error } = await tenantDb
          .from('plugin_hooks')
          .delete()
          .eq('plugin_id', id)
          .eq('hook_name', hookName)
          .select();
        if (!error && data && data.length > 0) {
          deleted = true;
        }
      } catch (err) {
        // Silently fail
      }
    }
    // Delete from plugin_admin_pages table (only for admin page files like admin/settings.jsx)
    else if ((normalizedPath.includes('admin/') || normalizedPath.startsWith('admin')) &&
             (normalizedPath.endsWith('.jsx') || normalizedPath.endsWith('.tsx'))) {
      attemptedTable = 'plugin_admin_pages';

      // Extract page key from filename (settings.jsx -> settings)
      const baseFileName = normalizedPath.split('/').pop();
      const pageKey = baseFileName.replace(/\.(jsx|tsx)$/, '');

      try {
        const { data, error } = await tenantDb
          .from('plugin_admin_pages')
          .delete()
          .eq('plugin_id', id)
          .eq('page_key', pageKey)
          .select();

        if (!error && data && data.length > 0) {
          deleted = true;
        }
      } catch (err) {
        // Continue to fallback
      }

      // Also try matching by route if page_key didn't work
      if (!deleted) {
        try {
          const { data, error } = await tenantDb
            .from('plugin_admin_pages')
            .delete()
            .eq('plugin_id', id)
            .like('route', `%${pageKey}%`)
            .select();

          if (!error && data && data.length > 0) {
            deleted = true;
          }
        } catch (err) {
          // Continue to fallback
        }
      }
    }
    // Delete from plugin_scripts table (fallback for other files)
    else {
      attemptedTable = 'plugin_scripts';

      // Get the base filename without path prefixes
      const baseFileName = normalizedPath.split('/').pop();

      // Try multiple path variations to match the file
      const pathVariations = [
        normalizedPath,
        path,
        `/${normalizedPath}`,
        normalizedPath.replace(/^\/+/, ''),
        path.replace(/^\/+/, ''),
        path.replace(/^src\//, ''),
        // Also try with pages/ prefix for page components like settings.jsx
        `pages/${normalizedPath}`,
        `pages/${path.replace(/^\/+/, '')}`,
        `pages/${baseFileName}`,
        // And components/ prefix
        `components/${normalizedPath}`,
        `components/${path.replace(/^\/+/, '')}`,
        `components/${baseFileName}`,
        // Try just the base filename
        baseFileName,
        // Try removing pages/ or components/ prefix if present
        normalizedPath.replace(/^pages\//, ''),
        normalizedPath.replace(/^components\//, ''),
      ];

      // Remove duplicates
      const uniquePathVariations = [...new Set(pathVariations)];

      for (const pathVariation of uniquePathVariations) {
        try {
          const { data, error } = await tenantDb
            .from('plugin_scripts')
            .delete()
            .eq('plugin_id', id)
            .eq('file_name', pathVariation)
            .select();

          if (!error && data && data.length > 0) {
            deleted = true;
            break;
          }
        } catch (err) {
          // Continue to next variation
        }
      }

      // If still not deleted, try a LIKE query to match file ending with the base filename
      if (!deleted && baseFileName) {
        try {
          const { data, error } = await tenantDb
            .from('plugin_scripts')
            .delete()
            .eq('plugin_id', id)
            .like('file_name', `%${baseFileName}`)
            .select();

          if (!error && data && data.length > 0) {
            deleted = true;
          }
        } catch (err) {
          // Continue
        }
      }
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `File not found or could not be deleted. Attempted table: ${attemptedTable}`
      });
    }

    // ALSO delete from JSON fields (manifest.generatedFiles and source_code)
    // This ensures files don't reappear after deletion from normalized tables
    try {
      const { data: pluginData } = await tenantDb
        .from('plugin_registry')
        .select('manifest, source_code')
        .eq('id', id)
        .maybeSingle();

      if (pluginData) {
        let manifest = pluginData.manifest || {};
        let sourceCode = pluginData.source_code || [];

        // Remove from manifest.generatedFiles
        if (manifest.generatedFiles && Array.isArray(manifest.generatedFiles)) {
          manifest.generatedFiles = manifest.generatedFiles.filter(f => {
            const fName = f.name || f.filename || '';
            return fName !== normalizedPath && fName !== `/${normalizedPath}` && fName !== path;
          });
        }

        // Remove from source_code array
        if (Array.isArray(sourceCode)) {
          sourceCode = sourceCode.filter(f => {
            const fName = f.name || f.filename || '';
            return fName !== normalizedPath && fName !== `/${normalizedPath}` && fName !== path;
          });
        }

        // Update plugin_registry
        await tenantDb
          .from('plugin_registry')
          .update({
            manifest,
            source_code: sourceCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
    } catch (jsonError) {
      // Don't fail the request if JSON cleanup fails
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:id/run-migration
 * Execute an existing migration for a plugin
 * NOTE: Raw SQL execution requires RPC function 'execute_sql' in database
 */
router.post('/:id/run-migration', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;
    const { migration_version, migration_name } = req.body;

    const startTime = Date.now();

    // Get migration from database
    const { data: migrations, error: fetchError } = await tenantDb
      .from('plugin_migrations')
      .select('id, up_sql, migration_description, status')
      .eq('plugin_id', id)
      .eq('migration_version', migration_version);

    if (fetchError) throw fetchError;

    if (!migrations || migrations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Migration not found'
      });
    }

    const migration = migrations[0];

    if (migration.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Migration already executed'
      });
    }

    // Detect risky operations and build summary from migration SQL
    const warnings = [];
    const summary = [];
    const upSQL = migration.up_sql.toLowerCase();
    const originalSQL = migration.up_sql;

    // Count operations for summary
    const createTableMatches = originalSQL.match(/CREATE TABLE\s+(IF NOT EXISTS\s+)?(\w+)/gi) || [];
    const alterTableMatches = originalSQL.match(/ALTER TABLE\s+(\w+)/gi) || [];
    const createIndexMatches = originalSQL.match(/CREATE\s+(UNIQUE\s+)?INDEX/gi) || [];
    const addColumnMatches = originalSQL.match(/ADD COLUMN/gi) || [];
    const dropColumnMatches = originalSQL.match(/DROP COLUMN/gi) || [];
    const commentMatches = originalSQL.match(/COMMENT ON/gi) || [];

    if (createTableMatches.length > 0) {
      const tableNames = createTableMatches.map(m => m.replace(/CREATE TABLE\s+(IF NOT EXISTS\s+)?/i, '').trim());
      summary.push(`${createTableMatches.length} table(s) created: ${tableNames.join(', ')}`);
    }
    if (addColumnMatches.length > 0) {
      summary.push(`${addColumnMatches.length} column(s) added`);
    }
    if (createIndexMatches.length > 0) {
      summary.push(`${createIndexMatches.length} index(es) created`);
    }
    if (alterTableMatches.length > 0 && addColumnMatches.length === 0) {
      summary.push(`${alterTableMatches.length} table(s) altered`);
    }
    if (commentMatches.length > 0) {
      summary.push(`${commentMatches.length} comment(s) added`);
    }

    // Detect risky operations
    if (dropColumnMatches.length > 0) {
      warnings.push(`⚠️ DROPS ${dropColumnMatches.length} COLUMN(S) - Data will be permanently deleted!`);
      summary.push(`${dropColumnMatches.length} column(s) dropped`);
    }
    if (upSQL.includes('alter column') && upSQL.includes('type')) {
      const typeChangeCount = (upSQL.match(/alter column.*type/g) || []).length;
      warnings.push(`⚠️ CHANGES ${typeChangeCount} COLUMN TYPE(S) - May cause data loss or conversion errors!`);
    }
    if (upSQL.includes('drop table')) {
      const dropTableCount = (upSQL.match(/drop table/g) || []).length;
      warnings.push(`⚠️ DROPS ${dropTableCount} TABLE(S) - All data will be permanently deleted!`);
      summary.push(`${dropTableCount} table(s) dropped`);
    }

    // Execute migration via RPC (requires execute_sql function in Supabase)
    const { error: execError } = await tenantDb.rpc('execute_sql', { sql: migration.up_sql });
    if (execError) throw execError;

    // Update status
    const { error: updateError } = await tenantDb
      .from('plugin_migrations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime
      })
      .eq('id', migration.id);

    if (updateError) throw updateError;

    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      migrationVersion: migration_version,
      description: migration.migration_description,
      executionTime,
      summary: summary.length > 0 ? summary : ['Migration executed successfully'],
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error) {
    console.error('Failed to run migration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:id/generate-entity-migration
 * Generate a pending migration for an entity (CREATE or ALTER TABLE)
 * NOTE: Table existence check requires RPC function 'check_table_exists' in database
 */
router.post('/:id/generate-entity-migration', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;
    const { entity_name, table_name, schema_definition, is_update } = req.body;

    // Get plugin name from database
    const { data: pluginData, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('name')
      .eq('id', id)
      .maybeSingle();

    if (pluginError || !pluginData) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }

    const pluginName = pluginData.name;
    const migrationVersion = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

    // Check if table actually exists in database via RPC
    let tableExistsInDB = false;
    try {
      const { data: tableCheck } = await tenantDb.rpc('check_table_exists', { p_table_name: table_name });
      tableExistsInDB = tableCheck === true;
    } catch (rpcError) {
      // If RPC doesn't exist, assume table doesn't exist (safer)
      console.warn('check_table_exists RPC not available, assuming table does not exist');
    }

    // Generate SQL based on whether table exists in database
    let upSQL, downSQL, migrationDescription;
    let warnings = []; // Track risky operations for warnings

    if (tableExistsInDB) {

      // Get existing entity schema from database to compare
      const { data: existingEntityData } = await tenantDb
        .from('plugin_entities')
        .select('schema_definition')
        .eq('plugin_id', id)
        .eq('entity_name', entity_name)
        .maybeSingle();

      if (!existingEntityData) {
        return res.status(404).json({
          success: false,
          error: 'Entity not found in database. Cannot generate ALTER TABLE migration. Use CREATE TABLE instead.'
        });
      }

      const oldSchema = existingEntityData.schema_definition;
      const oldColumns = oldSchema.columns || [];
      const newColumns = schema_definition.columns || [];

      // Detect changes
      const oldColumnNames = oldColumns.map(c => c.name);
      const newColumnNames = newColumns.map(c => c.name);

      const addedColumns = newColumns.filter(c => !oldColumnNames.includes(c.name));
      const removedColumns = oldColumns.filter(c => !newColumnNames.includes(c.name));
      const modifiedColumns = newColumns.filter(newCol => {
        const oldCol = oldColumns.find(c => c.name === newCol.name);
        if (!oldCol) return false;
        return JSON.stringify(oldCol) !== JSON.stringify(newCol);
      });

      // Detect risky operations for warnings
      if (removedColumns.length > 0) {
        warnings.push(`⚠️ DROPS ${removedColumns.length} COLUMN(S) - Data will be permanently deleted!`);
      }
      if (modifiedColumns.length > 0) {
        const typeChanges = modifiedColumns.filter(col => {
          const oldCol = oldColumns.find(c => c.name === col.name);
          return oldCol.type !== col.type;
        });
        if (typeChanges.length > 0) {
          warnings.push(`⚠️ CHANGES ${typeChanges.length} COLUMN TYPE(S) - May cause data loss or conversion errors!`);
        }
      }

      // Generate ALTER TABLE migration (all uncommented)
      upSQL = `-- =====================================================\n`;
      upSQL += `-- ALTER TABLE migration for ${table_name}\n`;
      upSQL += `-- Generated from entity: ${entity_name}\n`;
      upSQL += `-- =====================================================\n\n`;

      if (warnings.length > 0) {
        upSQL += `-- ⚠️ WARNING: This migration contains risky operations!\n`;
        warnings.forEach(w => {
          upSQL += `-- ${w}\n`;
        });
        upSQL += `--\n-- Please review carefully before executing.\n`;
        upSQL += `-- Consider backing up your database first.\n`;
        upSQL += `-- =====================================================\n\n`;
      }

      if (addedColumns.length === 0 && removedColumns.length === 0 && modifiedColumns.length === 0) {
        upSQL += `-- No schema changes detected\n`;
        upSQL += `-- This migration was generated but no changes are needed\n`;
      } else {
        // Add new columns
        if (addedColumns.length > 0) {
          upSQL += `-- Added Columns (${addedColumns.length})\n`;
          upSQL += `-- =====================================================\n\n`;
          addedColumns.forEach(col => {
            upSQL += `ALTER TABLE ${table_name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`;
            if (col.default) upSQL += ` DEFAULT ${col.default}`;
            if (col.nullable === false) upSQL += ' NOT NULL';
            if (col.comment) upSQL += `;\nCOMMENT ON COLUMN ${table_name}.${col.name} IS '${col.comment}'`;
            upSQL += ';\n\n';
          });
        }

        // Modified columns (ALL UNCOMMENTED - user will see warnings)
        if (modifiedColumns.length > 0) {
          upSQL += `-- Modified Columns (${modifiedColumns.length})\n`;
          upSQL += `-- =====================================================\n\n`;
          modifiedColumns.forEach(col => {
            const oldCol = oldColumns.find(c => c.name === col.name);
            upSQL += `-- Column: ${col.name}\n`;
            upSQL += `--   Old: ${oldCol.type}${oldCol.nullable === false ? ' NOT NULL' : ''}${oldCol.default ? ` DEFAULT ${oldCol.default}` : ''}\n`;
            upSQL += `--   New: ${col.type}${col.nullable === false ? ' NOT NULL' : ''}${col.default ? ` DEFAULT ${col.default}` : ''}\n\n`;

            if (oldCol.type !== col.type) {
              upSQL += `ALTER TABLE ${table_name} ALTER COLUMN ${col.name} TYPE ${col.type};\n`;
            }
            if (col.nullable !== oldCol.nullable) {
              upSQL += `ALTER TABLE ${table_name} ALTER COLUMN ${col.name} ${col.nullable === false ? 'SET NOT NULL' : 'DROP NOT NULL'};\n`;
            }
            if (col.default !== oldCol.default) {
              upSQL += `ALTER TABLE ${table_name} ALTER COLUMN ${col.name} ${col.default ? `SET DEFAULT ${col.default}` : 'DROP DEFAULT'};\n`;
            }
            upSQL += '\n';
          });
        }

        // Removed columns (UNCOMMENTED - user will see warnings)
        if (removedColumns.length > 0) {
          upSQL += `-- Removed Columns (${removedColumns.length})\n`;
          upSQL += `-- =====================================================\n\n`;
          removedColumns.forEach(col => {
            upSQL += `-- Dropping ${col.name} (${col.type})\n`;
            upSQL += `ALTER TABLE ${table_name} DROP COLUMN IF EXISTS ${col.name};\n\n`;
          });
        }

        // New indexes
        const oldIndexes = oldSchema.indexes || [];
        const newIndexes = schema_definition.indexes || [];
        const addedIndexes = newIndexes.filter(newIdx =>
          !oldIndexes.some(oldIdx => oldIdx.name === newIdx.name)
        );

        if (addedIndexes.length > 0) {
          upSQL += `-- New Indexes (${addedIndexes.length})\n`;
          upSQL += `-- =====================================================\n\n`;
          addedIndexes.forEach(idx => {
            const columns = idx.columns.join(', ');
            const order = idx.order ? ` ${idx.order}` : '';
            upSQL += `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${table_name}(${columns}${order});\n`;
          });
          upSQL += '\n';
        }
      }

      downSQL = `-- =====================================================\n`;
      downSQL += `-- ROLLBACK for ALTER TABLE migration\n`;
      downSQL += `-- =====================================================\n`;
      downSQL += `-- ⚠️ Manual rollback required for ALTER TABLE changes\n`;
      downSQL += `-- Review the changes above and write appropriate rollback SQL\n\n`;

      if (addedColumns.length > 0) {
        downSQL += `-- Drop added columns:\n`;
        addedColumns.forEach(col => {
          downSQL += `-- ALTER TABLE ${table_name} DROP COLUMN IF EXISTS ${col.name};\n`;
        });
        downSQL += '\n';
      }

      migrationDescription = `Update ${table_name} table schema for ${entity_name} entity`;

    } else {
      // Generate CREATE TABLE migration
      upSQL = `CREATE TABLE IF NOT EXISTS ${table_name} (\n`;

      const columnDefs = schema_definition.columns.map(col => {
        let def = `  ${col.name} ${col.type}`;
        if (col.primaryKey) def += ' PRIMARY KEY';
        if (col.default) def += ` DEFAULT ${col.default}`;
        if (col.nullable === false) def += ' NOT NULL';
        return def;
      });

      upSQL += columnDefs.join(',\n');
      upSQL += '\n);\n\n';

      // Add indexes
      if (schema_definition.indexes && schema_definition.indexes.length > 0) {
        schema_definition.indexes.forEach(idx => {
          const columns = idx.columns.join(', ');
          const order = idx.order ? ` ${idx.order}` : '';
          upSQL += `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${table_name}(${columns}${order});\n`;
        });
        upSQL += '\n';
      }

      // Add comment
      upSQL += `COMMENT ON TABLE ${table_name} IS 'Entity table for ${entity_name}';`;

      downSQL = `DROP TABLE IF EXISTS ${table_name} CASCADE;`;
      migrationDescription = `Create ${table_name} table for ${entity_name} entity`;
    }

    // Determine migration file name
    let migrationFileName;
    if (tableExistsInDB) {
      // Generate descriptive name for ALTER TABLE based on changes
      let migrationNameParts = ['alter', table_name, 'table'];

      const { data: oldSchemaData } = await tenantDb
        .from('plugin_entities')
        .select('schema_definition')
        .eq('plugin_id', id)
        .eq('entity_name', entity_name)
        .maybeSingle();

      if (oldSchemaData) {
        const oldColumns = (oldSchemaData.schema_definition.columns || []).map(c => c.name);
        const newColumns = (schema_definition.columns || []).map(c => c.name);
        const addedCols = newColumns.filter(c => !oldColumns.includes(c));
        const removedCols = oldColumns.filter(c => !newColumns.includes(c));

        if (addedCols.length > 0 && addedCols.length <= 3) {
          migrationNameParts.push('add', ...addedCols);
        } else if (addedCols.length > 3) {
          migrationNameParts.push('add', `${addedCols.length}_columns`);
        }

        if (removedCols.length > 0 && removedCols.length <= 3) {
          migrationNameParts.push('drop', ...removedCols);
        } else if (removedCols.length > 3) {
          migrationNameParts.push('drop', `${removedCols.length}_columns`);
        }
      }

      migrationFileName = migrationNameParts.join('_') + '.sql';
    } else {
      // Simple name for CREATE TABLE
      migrationFileName = `create_${table_name}_table.sql`;
    }

    // Create PENDING migration (don't execute)
    const { error: insertError } = await tenantDb
      .from('plugin_migrations')
      .insert({
        plugin_id: id,
        plugin_name: pluginName,
        migration_name: migrationFileName,
        migration_version: migrationVersion,
        migration_description: migrationDescription,
        status: 'pending',
        up_sql: upSQL,
        down_sql: downSQL
      });

    if (insertError) throw insertError;

    res.json({
      success: true,
      migrationVersion,
      entityName: entity_name,
      tableName: table_name,
      status: 'pending',
      warnings: warnings.length > 0 ? warnings : undefined,
      message: 'Migration generated successfully. Review and run from migrations folder.'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/plugins/:id/admin-pages
 * Create or update admin pages for a plugin (AI-generated)
 */
router.post('/:id/admin-pages', async (req, res) => {
  try {
    const tenantDb = await getTenantConnection(req);
    const { id } = req.params;
    const { adminPages } = req.body;

    if (!adminPages || !Array.isArray(adminPages) || adminPages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'adminPages array is required'
      });
    }

    // Get plugin to verify it exists and get slug
    const { data: plugin, error: pluginError } = await tenantDb
      .from('plugin_registry')
      .select('id, slug, name')
      .eq('id', id)
      .single();

    if (pluginError || !plugin) {
      return res.status(404).json({ success: false, error: 'Plugin not found' });
    }

    const savedPages = [];

    for (const page of adminPages) {
      // Replace PLUGIN_SLUG placeholder with actual slug
      const route = (page.route || `/admin/plugins/${plugin.slug}/${page.pageKey}`)
        .replace(/PLUGIN_SLUG/g, plugin.slug);

      // Transform JSX to React.createElement() if present
      let componentCode = page.componentCode;
      if (componentCode) {
        const transformResult = await transformComponentCode(componentCode, `${page.pageKey}.jsx`);
        if (transformResult.success) {
          componentCode = transformResult.code;
        } else {
          console.warn(`Warning: Failed to transform admin page ${page.pageKey}:`, transformResult.error);
        }
      }

      const pageData = {
        plugin_id: id,
        page_key: page.pageKey,
        page_name: page.pageName,
        route: route,
        component_code: componentCode,
        icon: page.icon || 'Settings',
        category: page.category || 'settings',
        description: page.description || '',
        order_position: page.orderPosition || 100,
        is_enabled: true
      };

      // Check if page already exists (upsert)
      const { data: existing } = await tenantDb
        .from('plugin_admin_pages')
        .select('id')
        .eq('plugin_id', id)
        .eq('page_key', page.pageKey)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateError } = await tenantDb
          .from('plugin_admin_pages')
          .update({
            page_name: pageData.page_name,
            route: pageData.route,
            component_code: pageData.component_code,
            icon: pageData.icon,
            category: pageData.category,
            description: pageData.description,
            order_position: pageData.order_position
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        savedPages.push({ ...pageData, action: 'updated' });
      } else {
        // Insert new
        const { error: insertError } = await tenantDb
          .from('plugin_admin_pages')
          .insert(pageData);

        if (insertError) throw insertError;
        savedPages.push({ ...pageData, action: 'created' });
      }
    }

    // Update manifest to include admin navigation for these pages
    const { data: currentPlugin } = await tenantDb
      .from('plugin_registry')
      .select('manifest')
      .eq('id', id)
      .single();

    if (currentPlugin?.manifest || savedPages.length > 0) {
      const manifest = currentPlugin?.manifest || {};
      if (!manifest.adminPages) manifest.adminPages = [];

      // Add/update admin page entries in manifest
      for (const page of savedPages) {
        const existingIdx = manifest.adminPages.findIndex(p => p.pageKey === page.page_key);
        const pageEntry = {
          pageKey: page.page_key,
          pageName: page.page_name,
          route: page.route,
          icon: page.icon
        };
        if (existingIdx >= 0) {
          manifest.adminPages[existingIdx] = pageEntry;
        } else {
          manifest.adminPages.push(pageEntry);
        }
      }

      // Set adminNavigation for sidebar display (uses first admin page as main entry)
      // This is what AdminNavigationService looks for
      if (savedPages.length > 0 && !manifest.adminNavigation) {
        const firstPage = savedPages[0];
        manifest.adminNavigation = {
          enabled: true,
          label: plugin.name,
          icon: firstPage.icon || 'Puzzle',
          route: firstPage.route,
          description: `${plugin.name} settings and management`,
          order: 100
        };
      }

      await tenantDb
        .from('plugin_registry')
        .update({ manifest })
        .eq('id', id);
    }

    // Also register in admin_navigation_registry for immediate visibility
    const AdminNavigationService = require('../services/AdminNavigationService');
    for (const page of savedPages) {
      await AdminNavigationService.registerPluginNavigation(id, [{
        key: `plugin-${plugin.slug}-${page.page_key}`,
        label: page.page_name,
        icon: page.icon || 'Settings',
        route: page.route,
        category: 'plugins',
        order: page.order_position || 100
      }], tenantDb);
    }

    res.json({
      success: true,
      message: `${savedPages.length} admin page(s) saved`,
      pages: savedPages.map(p => ({
        pageKey: p.page_key,
        pageName: p.page_name,
        route: p.route,
        action: p.action
      }))
    });

  } catch (error) {
    console.error('Failed to save admin pages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
