// backend/src/routes/admin-navigation.js
const express = require('express');
const router = express.Router();
const AdminNavigationService = require('../services/AdminNavigationService');
const ConnectionManager = require('../services/database/ConnectionManager');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');

/**
 * GET /api/admin/navigation
 * Get complete navigation tree for the current tenant DB
 */
router.get('/navigation', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    // Get store_id from header, query param, or JWT token (optional for main navigation)
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.user.store_id;

    // If no store_id, return core navigation without store-specific items
    if (!store_id) {
      const navigation = await AdminNavigationService.getCoreNavigation();
      return res.json({
        success: true,
        navigation
      });
    }

    // Try to get tenant DB connection with retry for race condition after store creation
    let tenantDb = null;
    let lastError = null;
    const maxRetries = 3;
    const retryDelay = 500; // 500ms between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        tenantDb = await ConnectionManager.getStoreConnection(store_id);
        break; // Success, exit retry loop
      } catch (connError) {
        lastError = connError;
        if (attempt < maxRetries && connError.message.includes('No database configured')) {
          console.log(`[Navigation] Retry ${attempt}/${maxRetries} for store ${store_id}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    if (!tenantDb) {
      console.warn(`[Navigation] Failed after ${maxRetries} retries for store ${store_id}:`, lastError?.message);
      // Return 503 with retry hint for frontend
      return res.status(503).json({
        success: false,
        error: lastError?.message || 'Database connection temporarily unavailable',
        retryable: true
      });
    }

    // Pass tenantDb to service
    const navigation = await AdminNavigationService.getNavigationForTenant(store_id, tenantDb);

    res.json({
      success: true,
      navigation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/navigation/seed
 * Seed core navigation items (run once) in tenant DB
 */
router.post('/navigation/seed', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const { store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    await AdminNavigationService.seedCoreNavigation(tenantDb);

    res.json({
      success: true,
      message: 'Core navigation seeded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/plugins/:pluginId/navigation
 * Update plugin navigation settings in manifest AND admin_navigation_registry
 */
router.put('/plugins/:pluginId/navigation', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const { adminNavigation } = req.body;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required (X-Store-Id header or query param)'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // 1. Update the manifest in the plugin_registry table
    await tenantDb
      .from('plugin_registry')
      .update({
        manifest: tenantDb.raw(`jsonb_set(COALESCE(manifest, '{}'::jsonb), '{adminNavigation}', ?::jsonb)`, [JSON.stringify(adminNavigation)]),
        updated_at: new Date().toISOString()
      })
      .eq('id', pluginId);

    // 2. Handle admin_navigation_registry
    if (adminNavigation.enabled) {
      // Get plugin info for navigation entry
      const { data: pluginInfo, error: pluginError } = await tenantDb
        .from('plugin_registry')
        .select('name, manifest')
        .eq('id', pluginId)
        .maybeSingle();

      if (pluginError) {
        console.error('Error fetching plugin:', pluginError.message);
      }

      if (pluginInfo) {
        const manifest = pluginInfo.manifest || {};

        // Calculate order_position
        let orderPosition;

        if (adminNavigation.order !== undefined && adminNavigation.order !== null) {
          orderPosition = adminNavigation.order;
        } else if (adminNavigation.relativeToKey && adminNavigation.position) {
          // Calculate based on relativeToKey and position
          const { data: relativeItem } = await tenantDb
            .from('admin_navigation_registry')
            .select('order_position')
            .eq('key', adminNavigation.relativeToKey)
            .maybeSingle();

          if (relativeItem) {
            if (adminNavigation.position === 'before') {
              orderPosition = relativeItem.order_position - 0.5;
            } else {
              orderPosition = relativeItem.order_position + 0.5;
            }
          } else {
            orderPosition = 100;
          }
        } else {
          orderPosition = 100;
        }

        // Upsert into admin_navigation_registry
        await tenantDb
          .from('admin_navigation_registry')
          .upsert({
            key: `plugin-${pluginId}`,
            label: adminNavigation.label || manifest.name || pluginInfo.name,
            icon: adminNavigation.icon || manifest.icon || 'Package',
            route: adminNavigation.route || `/admin/plugins/${pluginId}`,
            parent_key: adminNavigation.parentKey || null,
            order_position: orderPosition,
            is_visible: true,
            is_core: false,
            plugin_id: pluginId,
            category: 'plugins',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });
      }
    } else {
      // Navigation disabled - remove from registry
      await tenantDb
        .from('admin_navigation_registry')
        .delete()
        .eq('key', `plugin-${pluginId}`);
    }

    res.json({
      success: true,
      message: 'Plugin navigation settings updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/navigation/reorder
 * Update navigation order and visibility
 *
 * Order scheme:
 * - Top-level items: 10, 20, 30, 40... (increment by 10)
 * - Child items: 1, 2, 3, 4... (increment by 1 within parent)
 */
router.post('/navigation/reorder', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { items } = req.body;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required (X-Store-Id header or query param)'
      });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Normalize all items first, preserving array index for stable sorting
    const normalizedItems = items.map((item, arrayIndex) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      route: item.route,
      parent_key: item.parent_key ?? item.parentKey ?? null,
      order_position: item.order_position ?? item.orderPosition ?? item.order ?? 0,
      is_visible: item.is_visible ?? item.isVisible ?? true,
      _arrayIndex: arrayIndex // Preserve original array order for stable sorting
    }));

    // Separate top-level items and children
    const topLevelItems = normalizedItems.filter(item => !item.parent_key);
    const childItems = normalizedItems.filter(item => item.parent_key);

    // Sort top-level items by order_position, then by array index for stability
    topLevelItems.sort((a, b) => {
      if (a.order_position !== b.order_position) {
        return a.order_position - b.order_position;
      }
      return a._arrayIndex - b._arrayIndex;
    });

    // Recalculate top-level order positions: 10, 20, 30...
    topLevelItems.forEach((item, index) => {
      item.order_position = (index + 1) * 10;
    });

    // Group children by parent, preserving order within each group
    const childrenByParent = {};
    childItems.forEach(item => {
      if (!childrenByParent[item.parent_key]) {
        childrenByParent[item.parent_key] = [];
      }
      childrenByParent[item.parent_key].push(item);
    });

    // Sort each group by order_position (then array index), and reassign: 1, 2, 3...
    Object.keys(childrenByParent).forEach(parentKey => {
      const children = childrenByParent[parentKey];
      children.sort((a, b) => {
        if (a.order_position !== b.order_position) {
          return a.order_position - b.order_position;
        }
        return a._arrayIndex - b._arrayIndex;
      });
      children.forEach((child, index) => {
        child.order_position = index + 1;
      });
    });

    // Combine all items back together
    const allItems = [...topLevelItems, ...childItems];

    // Update each navigation item in the database
    for (const item of allItems) {
      if (!item.key) {
        continue;
      }

      // Check if this is a plugin item (key starts with 'plugin-')
      const isPluginItem = item.key.startsWith('plugin-');

      if (isPluginItem) {
        // For plugin items, INSERT or UPDATE in admin_navigation_registry
        const pluginId = item.key.replace('plugin-', '');

        await tenantDb
          .from('admin_navigation_registry')
          .upsert({
            key: item.key,
            label: item.label || 'Plugin Item',
            icon: item.icon || 'Package',
            route: item.route || '/admin',
            parent_key: item.parent_key,
            order_position: item.order_position,
            is_visible: item.is_visible,
            is_core: false,
            plugin_id: pluginId,
            category: 'plugins',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });
      } else {
        // For core items, just UPDATE
        await tenantDb
          .from('admin_navigation_registry')
          .update({
            order_position: item.order_position,
            is_visible: item.is_visible,
            parent_key: item.parent_key,
            updated_at: new Date().toISOString()
          })
          .eq('key', item.key);
      }
    }

    res.json({
      success: true,
      message: 'Navigation order updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
