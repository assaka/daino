/**
 * Database-Driven Plugin Registry
 * Creates and manages plugins entirely through database storage
 *
 * Uses Supabase REST API via ConnectionManager for all operations.
 * Tables must be pre-created in tenant databases during provisioning.
 */

const ConnectionManager = require('../services/database/ConnectionManager');

class PluginRegistry {
  constructor(storeId) {
    this.storeId = storeId;
    this.initialized = false;
    this.registeredPlugins = new Map();
    this.connection = null;
  }

  /**
   * Get database connection for this store
   * @private
   */
  async _getConnection() {
    if (!this.connection) {
      this.connection = await ConnectionManager.getConnection(this.storeId);
    }
    return this.connection;
  }

  /**
   * Initialize the plugin registry system
   */
  async initialize() {
    if (this.initialized) return;

    console.log(`🔌 Initializing Plugin Registry for store ${this.storeId}...`);

    // Get database connection
    await this._getConnection();

    // Load existing plugins from database
    await this.loadRegisteredPlugins();

    // Register custom-pricing plugin if not exists
    await this.ensureCustomPricingPlugin();

    this.initialized = true;
    console.log('✅ Plugin Registry initialized');
  }

  /**
   * Load registered plugins from database
   */
  async loadRegisteredPlugins() {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_registry')
        .select('*')
        .eq('status', 'active');

      if (error) {
        console.error('Error loading plugins:', error.message);
        return;
      }

      for (const plugin of (data || [])) {
        this.registeredPlugins.set(plugin.id, plugin);
      }

      console.log(`📦 Loaded ${(data || []).length} active plugins from database`);
    } catch (error) {
      console.error('Error loading plugins:', error.message);
    }
  }

  /**
   * Register a new plugin in database
   */
  async registerPlugin(pluginData) {
    try {
      const {
        id,
        name,
        version = '1.0.0',
        description = '',
        type = 'custom',
        category = 'utility',
        author = 'System',
        security_level = 'sandboxed',
        framework = 'react',
        manifest = {},
        permissions = [],
        dependencies = [],
        tags = []
      } = pluginData;

      const db = await this._getConnection();

      // Check if plugin already exists
      const { data: existing } = await db.from('plugin_registry')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        // Update existing plugin
        const { error } = await db.from('plugin_registry')
          .update({
            name,
            version,
            description,
            updated_at: now
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        // Insert new plugin
        const { error } = await db.from('plugin_registry')
          .insert({
            id,
            name,
            version,
            description,
            type,
            category,
            author,
            status: 'active',
            security_level,
            framework,
            manifest: manifest,
            permissions: permissions,
            dependencies: dependencies,
            tags: tags,
            created_at: now,
            updated_at: now
          });

        if (error) throw error;
      }

      this.registeredPlugins.set(id, { id, name, version, status: 'active', ...pluginData });

      console.log(`✅ Registered plugin: ${name} (${id})`);
      return { success: true, pluginId: id };
    } catch (error) {
      console.error('Error registering plugin:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all active plugins
   */
  async getActivePlugins() {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_registry')
        .select('*')
        .eq('status', 'active');

      if (error) {
        console.error('Error getting active plugins:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting active plugins:', error.message);
      return [];
    }
  }

  /**
   * Get plugin by ID
   */
  async getPlugin(pluginId) {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_registry')
        .select('*')
        .eq('id', pluginId)
        .maybeSingle();

      if (error) {
        console.error('Error getting plugin:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting plugin:', error.message);
      return null;
    }
  }

  /**
   * Update plugin status
   */
  async updatePluginStatus(pluginId, status) {
    try {
      const db = await this._getConnection();
      const { error } = await db.from('plugin_registry')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', pluginId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating plugin status:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete plugin
   */
  async deletePlugin(pluginId) {
    try {
      const db = await this._getConnection();
      const { error } = await db.from('plugin_registry')
        .delete()
        .eq('id', pluginId);

      if (error) throw error;
      this.registeredPlugins.delete(pluginId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting plugin:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register plugin hook
   */
  async registerPluginHook(pluginId, hookData) {
    try {
      const { hook_name, handler_code, priority = 10, enabled = true } = hookData;
      const db = await this._getConnection();

      // Check if hook exists
      const { data: existing } = await db.from('plugin_hooks')
        .select('id')
        .eq('plugin_id', pluginId)
        .eq('hook_name', hook_name)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from('plugin_hooks')
          .update({
            handler_code,
            priority,
            enabled
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('plugin_hooks')
          .insert({
            plugin_id: pluginId,
            hook_name,
            handler_code,
            priority,
            enabled,
            created_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error registering plugin hook:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plugin hooks
   */
  async getPluginHooks(pluginId = null) {
    try {
      const db = await this._getConnection();
      let query = db.from('plugin_hooks')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: true });

      if (pluginId) {
        query = query.eq('plugin_id', pluginId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting plugin hooks:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting plugin hooks:', error.message);
      return [];
    }
  }

  /**
   * Get hooks by hook name
   */
  async getHooksByName(hookName) {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_hooks')
        .select('*, plugin_registry!inner(id, name, status, security_level)')
        .eq('hook_name', hookName)
        .eq('enabled', true)
        .eq('plugin_registry.status', 'active')
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error getting hooks by name:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting hooks by name:', error.message);
      return [];
    }
  }

  /**
   * Get plugin endpoints
   */
  async getPluginEndpoints(pluginId) {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_endpoints')
        .select('*')
        .eq('plugin_id', pluginId)
        .eq('enabled', true);

      if (error) {
        console.error('Error getting plugin endpoints:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting plugin endpoints:', error.message);
      return [];
    }
  }

  /**
   * Register plugin script/module
   */
  async registerPluginScript(pluginId, scriptData) {
    try {
      const {
        name,
        code,
        type = 'module',
        order_index = 0,
        exports = [],
        imports = []
      } = scriptData;

      const db = await this._getConnection();
      const now = new Date().toISOString();

      // Check if script exists
      const { data: existing } = await db.from('plugin_scripts')
        .select('id')
        .eq('plugin_id', pluginId)
        .eq('name', name)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from('plugin_scripts')
          .update({
            code,
            type,
            order_index,
            exports,
            imports,
            updated_at: now
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('plugin_scripts')
          .insert({
            plugin_id: pluginId,
            name,
            code,
            type,
            order_index,
            exports,
            imports,
            created_at: now,
            updated_at: now
          });
        if (error) throw error;
      }

      console.log(`✅ Registered script: ${name} for plugin ${pluginId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error registering script:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plugin scripts
   */
  async getPluginScripts(pluginId) {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_scripts')
        .select('*')
        .eq('plugin_id', pluginId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error getting plugin scripts:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting plugin scripts:', error.message);
      return [];
    }
  }

  /**
   * Register plugin dependency
   */
  async registerPluginDependency(pluginId, depData) {
    try {
      const { package_name, version, code, exports = [] } = depData;
      const db = await this._getConnection();

      // Check if dependency exists
      const { data: existing } = await db.from('plugin_dependencies')
        .select('id')
        .eq('plugin_id', pluginId)
        .eq('package_name', package_name)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from('plugin_dependencies')
          .update({ version, code, exports })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('plugin_dependencies')
          .insert({
            plugin_id: pluginId,
            package_name,
            version,
            code,
            exports,
            created_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      console.log(`✅ Registered dependency: ${package_name}@${version} for plugin ${pluginId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error registering dependency:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plugin dependencies
   */
  async getPluginDependencies(pluginId) {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_dependencies')
        .select('*')
        .eq('plugin_id', pluginId);

      if (error) {
        console.error('Error getting plugin dependencies:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting plugin dependencies:', error.message);
      return [];
    }
  }

  /**
   * Set plugin data (key-value storage)
   */
  async setPluginData(pluginId, key, value) {
    try {
      const db = await this._getConnection();
      const now = new Date().toISOString();

      // Check if data exists
      const { data: existing } = await db.from('plugin_data')
        .select('id')
        .eq('plugin_id', pluginId)
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from('plugin_data')
          .update({ value, updated_at: now })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('plugin_data')
          .insert({
            plugin_id: pluginId,
            key,
            value,
            created_at: now,
            updated_at: now
          });
        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting plugin data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get plugin data
   */
  async getPluginData(pluginId, key) {
    try {
      const db = await this._getConnection();
      const { data, error } = await db.from('plugin_data')
        .select('value')
        .eq('plugin_id', pluginId)
        .eq('key', key)
        .maybeSingle();

      if (error) {
        console.error('Error getting plugin data:', error.message);
        return null;
      }

      return data?.value || null;
    } catch (error) {
      console.error('Error getting plugin data:', error.message);
      return null;
    }
  }

  /**
   * Delete plugin data
   */
  async deletePluginData(pluginId, key) {
    try {
      const db = await this._getConnection();
      const { error } = await db.from('plugin_data')
        .delete()
        .eq('plugin_id', pluginId)
        .eq('key', key);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting plugin data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ensure custom-pricing plugin exists (demo plugin)
   */
  async ensureCustomPricingPlugin() {
    const pluginId = 'custom-pricing-v2';

    try {
      const existing = await this.getPlugin(pluginId);

      if (!existing) {
        await this.registerPlugin({
          id: pluginId,
          name: 'Custom Pricing Plugin',
          version: '2.0.0',
          description: 'Database-driven pricing rules and discounts system',
          type: 'custom',
          category: 'commerce',
          author: 'System',
          security_level: 'trusted',
          permissions: ['database.read', 'database.write', 'api.pricing'],
          tags: ['pricing', 'discounts', 'loyalty', 'database']
        });
      }
    } catch (error) {
      // Table might not exist yet - that's OK, skip silently
      console.log('ℹ️ Custom pricing plugin not registered (table may not exist yet)');
    }
  }

  /**
   * Execute plugin code in sandbox
   * @param {string} pluginId - Plugin ID
   * @param {string} type - Execution type (api, hook, event)
   * @param {string} code - Code to execute
   * @param {Object} context - Execution context
   */
  async executePluginCode(pluginId, type, code, context) {
    const startTime = Date.now();

    try {
      // Create a sandboxed execution context
      const sandbox = {
        console: {
          log: (...args) => console.log(`[Plugin ${pluginId}]`, ...args),
          error: (...args) => console.error(`[Plugin ${pluginId}]`, ...args),
          warn: (...args) => console.warn(`[Plugin ${pluginId}]`, ...args)
        },
        ...context
      };

      // Execute the code
      // NOTE: In production, use vm2 or similar for proper sandboxing
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('context', `
        const { console, req, res, db, input, data, hookName, eventName } = context;
        ${code}
      `);

      const result = await fn(sandbox);

      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Error executing plugin ${pluginId} code:`, error);
      return {
        success: false,
        result: { error: error.message },
        executionTime: Date.now() - startTime
      };
    }
  }
}

// Cache for plugin registries per store
const registryCache = new Map();

/**
 * Get or create a PluginRegistry instance for a store
 * @param {string} storeId - Store UUID
 * @returns {Promise<PluginRegistry>}
 */
async function getPluginRegistry(storeId) {
  if (!storeId) {
    throw new Error('Store ID is required for plugin registry');
  }

  if (registryCache.has(storeId)) {
    return registryCache.get(storeId);
  }

  const registry = new PluginRegistry(storeId);
  await registry.initialize();
  registryCache.set(storeId, registry);

  return registry;
}

/**
 * Clear plugin registry cache for a store
 * @param {string} storeId - Store UUID (optional, clears all if not provided)
 */
function clearPluginRegistryCache(storeId = null) {
  if (storeId) {
    registryCache.delete(storeId);
  } else {
    registryCache.clear();
  }
}

module.exports = {
  PluginRegistry,
  getPluginRegistry,
  clearPluginRegistryCache
};
