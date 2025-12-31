// backend/src/services/AdminNavigationService.js

const { masterDbClient } = require('../database/masterConnection');

class AdminNavigationService {
  constructor() {
    // Cache for core navigation items from master DB
    this._coreNavCache = null;
    this._coreNavCacheTime = 0;
    this._cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get core navigation items from MASTER database
   * Returns all core items with their default settings
   * Cached for 5 minutes to reduce master DB queries
   */
  async getCoreNavigationFromMaster() {
    const now = Date.now();

    // Return cached data if still valid
    if (this._coreNavCache && (now - this._coreNavCacheTime) < this._cacheMaxAge) {
      return this._coreNavCache;
    }

    try {
      const { data: coreItems, error } = await masterDbClient
        .from('admin_navigation_core')
        .select('*')
        .order('default_order_position', { ascending: true });

      if (error) {
        console.error('Error fetching core navigation from master:', error.message);
        // Return cached data if available, even if stale
        if (this._coreNavCache) {
          return this._coreNavCache;
        }
        throw error;
      }

      // Update cache
      this._coreNavCache = coreItems || [];
      this._coreNavCacheTime = now;

      return this._coreNavCache;
    } catch (error) {
      console.error('Failed to fetch core navigation from master:', error.message);
      throw error;
    }
  }

  /**
   * Clear the core navigation cache
   * Call this when core items are updated in master DB
   */
  clearCoreNavCache() {
    this._coreNavCache = null;
    this._coreNavCacheTime = 0;
  }

  /**
   * Get tenant-specific customizations for core navigation
   * Returns overrides for visibility, order, and parent_key
   */
  async getTenantCustomizations(tenantDb) {
    try {
      const { data: customizations, error } = await tenantDb
        .from('admin_navigation_custom')
        .select('*');

      if (error) {
        console.error('Error fetching tenant customizations:', error.message);
        return [];
      }

      return customizations || [];
    } catch (error) {
      console.error('Failed to fetch tenant customizations:', error.message);
      return [];
    }
  }

  /**
   * Get core navigation items (no store required)
   * Used for main sidebar when no specific store is selected
   */
  async getCoreNavigation() {
    const coreItems = [
      { key: 'dashboard', label: 'Dashboard', icon: 'Home', route: '/admin', order_position: 1, category: 'main', is_core: true, is_visible: true, children: [] },
      { key: 'stores', label: 'Stores', icon: 'Store', route: '/admin/stores', order_position: 2, category: 'main', is_core: true, is_visible: true, children: [] },
      { key: 'settings', label: 'Settings', icon: 'Settings', route: '/admin/settings', order_position: 99, category: 'settings', is_core: true, is_visible: true, children: [] }
    ];

    return coreItems;
  }

  /**
   * Get complete navigation for a tenant
   * Merges: Master core items + Tenant customizations + Plugin items
   * @param {string} storeId - Store ID
   * @param {Object} tenantDb - Supabase client connection to tenant DB
   */
  async getNavigationForTenant(storeId, tenantDb) {
    try {
      // 1. Get core items from MASTER (cached)
      const coreItems = await this.getCoreNavigationFromMaster();

      // 2. Get tenant customizations
      const customizations = await this.getTenantCustomizations(tenantDb);
      const customMap = new Map(customizations.map(c => [c.core_nav_key, c]));

      // 3. Apply tenant customizations to core items
      const mergedCoreItems = coreItems.map(item => {
        const custom = customMap.get(item.key);
        return {
          key: item.key,
          label: item.label,
          icon: item.icon,
          route: item.route,
          parent_key: custom?.parent_key ?? item.parent_key,
          order_position: custom?.order_position ?? item.default_order_position,
          is_visible: custom?.is_visible ?? item.default_is_visible,
          is_core: true,
          plugin_id: null,
          category: item.category,
          description: item.description,
          badge: item.badge_config,
          type: item.type || 'standard'
        };
      });

      // 4. Get plugin navigation items from tenant DB
      const pluginNavItems = await this.getPluginNavigationItems(tenantDb);

      // 5. Combine and filter visible items
      const allItems = [...mergedCoreItems, ...pluginNavItems]
        .filter(item => item.is_visible);

      // 6. Build hierarchical tree
      return this.buildNavigationTree(allItems);

    } catch (error) {
      console.error('Error in getNavigationForTenant:', error.message);
      throw error;
    }
  }

  /**
   * Get plugin navigation items from tenant DB
   * Combines: admin_navigation_registry plugin items + file-based plugins + registry plugins
   */
  async getPluginNavigationItems(tenantDb) {
    try {
      // 1. Get tenant's installed & active plugins
      const { data: installedPlugins, error: pluginsError } = await tenantDb
        .from('plugins')
        .select('id')
        .eq('status', 'installed')
        .eq('is_enabled', true);

      if (pluginsError) {
        console.error('Error fetching plugins:', pluginsError.message);
      }

      const pluginIds = (installedPlugins || []).map(p => p.id);

      // 2a. Get active file-based plugins with adminNavigation from manifest
      const { data: fileBasedPlugins, error: filePluginsError } = await tenantDb
        .from('plugins')
        .select('id, name, manifest')
        .eq('status', 'installed')
        .eq('is_enabled', true);

      if (filePluginsError) {
        console.error('Error fetching file-based plugins:', filePluginsError.message);
      }

      // Parse adminNavigation from file-based plugins
      const fileBasedNavItems = (fileBasedPlugins || [])
        .filter(p => p.manifest?.adminNavigation)
        .map(p => {
          try {
            const nav = p.manifest.adminNavigation;
            if (nav && nav.enabled) {
              return {
                key: `plugin-${p.id}`,
                label: nav.label,
                icon: nav.icon || 'Package',
                route: nav.route,
                parent_key: nav.parentKey || null,
                order_position: nav.order || 100,
                is_core: false,
                plugin_id: p.id,
                is_visible: true,
                category: 'plugins',
                description: nav.description
              };
            }
          } catch (e) {
            // Ignore parse errors
          }
          return null;
        })
        .filter(Boolean);

      // 2b. Get active plugins from plugin_registry with adminNavigation
      const { data: registryPlugins, error: registryError } = await tenantDb
        .from('plugin_registry')
        .select('id, name, manifest')
        .eq('status', 'active');

      if (registryError) {
        console.error('Error fetching plugin_registry:', registryError.message);
      }

      // Parse adminNavigation from registry plugins
      const registryNavItems = (registryPlugins || [])
        .filter(p => p.manifest?.adminNavigation)
        .map(p => {
          try {
            const nav = p.manifest.adminNavigation;
            if (nav && nav.enabled) {
              return {
                key: `plugin-${p.id}`,
                label: nav.label,
                icon: nav.icon || 'Package',
                route: nav.route,
                parent_key: nav.parentKey || null,
                order_position: nav.order || 100,
                is_core: false,
                plugin_id: p.id,
                is_visible: true,
                category: 'plugins',
                description: nav.description
              };
            }
          } catch (e) {
            // Ignore parse errors
          }
          return null;
        })
        .filter(Boolean);

      // 3. Get plugin navigation items from admin_navigation_registry (plugin items only)
      let registryNavQuery = tenantDb
        .from('admin_navigation_registry')
        .select('*')
        .eq('is_core', false)
        .eq('is_visible', true)
        .order('order_position', { ascending: true });

      if (pluginIds.length > 0) {
        registryNavQuery = registryNavQuery.in('plugin_id', pluginIds);
      }

      const { data: registryItems, error: navError } = await registryNavQuery;

      if (navError) {
        console.error('Error fetching plugin navigation items:', navError.message);
      }

      // 4. Merge all plugin nav items (dedupe by key)
      const allPluginItems = [...(registryItems || []), ...fileBasedNavItems, ...registryNavItems];
      const uniqueItems = new Map();
      allPluginItems.forEach(item => {
        if (!uniqueItems.has(item.key)) {
          uniqueItems.set(item.key, item);
        }
      });

      return Array.from(uniqueItems.values());

    } catch (error) {
      console.error('Error fetching plugin navigation items:', error.message);
      return [];
    }
  }

  /**
   * Build hierarchical navigation tree
   * Uses snake_case throughout for consistency
   */
  buildNavigationTree(items) {
    const tree = [];
    const itemMap = new Map();
    const hasParent = new Set();

    // First pass: Create map of all items with empty children
    items.forEach(item => {
      itemMap.set(item.key, {
        key: item.key,
        label: item.label,
        icon: item.icon,
        route: item.route,
        parent_key: item.parent_key,
        order_position: item.order_position,
        is_visible: item.is_visible,
        is_core: item.is_core,
        plugin_id: item.plugin_id,
        category: item.category,
        description: item.description,
        badge: item.badge,
        type: item.type || 'standard',
        children: []
      });
    });

    // Second pass: Build hierarchy
    items.forEach(item => {
      const node = itemMap.get(item.key);

      if (item.parent_key && itemMap.has(item.parent_key)) {
        // Add as child to parent
        itemMap.get(item.parent_key).children.push(node);
        hasParent.add(item.key); // Mark this item as having a parent
      }
    });

    // Third pass: Add only root items (items without parents) to tree
    items.forEach(item => {
      if (!hasParent.has(item.key)) {
        tree.push(itemMap.get(item.key));
      }
    });

    // Sort children by order_position
    tree.forEach(item => this.sortChildren(item));

    return tree;
  }

  /**
   * Recursively sort children by order_position
   */
  sortChildren(item) {
    if (item.children && item.children.length > 0) {
      item.children.sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
      item.children.forEach(child => this.sortChildren(child));
    }
  }

  /**
   * Save tenant navigation customizations
   * Saves visibility, order, and parent_key overrides for core items
   */
  async saveNavigationCustomizations(tenantDb, items) {
    for (const item of items) {
      const { error } = await tenantDb
        .from('admin_navigation_custom')
        .upsert({
          core_nav_key: item.key,
          is_visible: item.is_visible,
          order_position: item.order_position,
          parent_key: item.parent_key,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'core_nav_key'
        });

      if (error) {
        console.error(`Error saving customization for ${item.key}:`, error.message);
      }
    }
  }

  /**
   * Register plugin navigation items in tenant DB
   * Called during plugin installation
   */
  async registerPluginNavigation(pluginId, navItems, tenantDb) {
    for (const item of navItems) {
      await tenantDb
        .from('admin_navigation_registry')
        .upsert({
          key: item.key,
          label: item.label,
          icon: item.icon,
          route: item.route,
          parent_key: item.parentKey || null,
          order_position: item.order || 100,
          is_core: false,
          plugin_id: pluginId,
          category: item.category || 'plugins',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });
    }
  }

  /**
   * @deprecated Core navigation now comes from master DB (admin_navigation_core)
   * This method is kept for backward compatibility during migration
   */
  async seedCoreNavigation(tenantDb) {
    console.warn('[DEPRECATED] seedCoreNavigation is deprecated - core items now come from master DB admin_navigation_core table');
    // No-op - core items are now in master DB
  }
}

module.exports = new AdminNavigationService();
