/**
 * Dynamic Plugin API Handler
 * Database-driven plugin execution using Supabase REST API
 */

const express = require('express');
const router = express.Router();
const { getPluginRegistry } = require('../core/PluginRegistry');
const { authMiddleware } = require('../middleware/authMiddleware');
const { storeResolver } = require('../middleware/storeResolver');

// Generic plugin endpoint handler - routes to database-stored plugin code
router.all('/dynamic/:pluginId/*', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const path = req.params[0]; // Everything after /dynamic/:pluginId/
    const method = req.method;

    console.log(`🔌 Dynamic plugin request: ${method} ${pluginId}/${path}`);

    // Get plugin registry for this store
    const pluginRegistry = await getPluginRegistry(req.storeId);

    // Get plugin endpoints from database
    const endpoints = await pluginRegistry.getPluginEndpoints(pluginId);
    const endpoint = endpoints.find(ep =>
      ep.method === method &&
      matchPath(ep.path, `/${path}`) &&
      ep.enabled
    );

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: `Plugin endpoint not found: ${method} /${path}`,
        pluginId
      });
    }

    // Execute the plugin endpoint code
    const context = {
      req: {
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers,
        user: req.user,
        storeId: req.storeId
      },
      res: {
        json: (data) => res.json(data),
        status: (code) => res.status(code),
        send: (data) => res.send(data)
      }
    };

    // Execute plugin code in sandbox
    const execution = await pluginRegistry.executePluginCode(
      pluginId,
      'api',
      endpoint.handler_code,
      context
    );

    if (!execution.success) {
      return res.status(500).json({
        success: false,
        error: 'Plugin execution failed',
        details: execution.result?.error
      });
    }

    // If the plugin code didn't send a response, send the result
    if (!res.headersSent) {
      res.json({
        success: true,
        data: execution.result,
        executionTime: execution.executionTime
      });
    }

  } catch (error) {
    console.error('Error in dynamic plugin handler:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint for debugging - no auth required
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Plugin registry is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Plugin management endpoints
router.get('/registry', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const pluginRegistry = await getPluginRegistry(req.storeId);
    const { category, type, status } = req.query;

    // Get all plugins and filter in memory (simpler than building dynamic query)
    let plugins = await pluginRegistry.getActivePlugins();

    // Apply filters if provided
    if (status && status !== 'active') {
      // Need to get all plugins for non-active status
      const db = await pluginRegistry._getConnection();
      const { data, error } = await db.from('plugin_registry')
        .select('*')
        .eq('status', status)
        .order('name', { ascending: true });

      if (error) throw error;
      plugins = data || [];
    }

    if (category) {
      plugins = plugins.filter(p => p.category === category);
    }

    if (type) {
      plugins = plugins.filter(p => p.type === type);
    }

    res.json({
      success: true,
      data: plugins,
      count: plugins.length
    });
  } catch (error) {
    console.error('Error getting plugin registry:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register new plugin
router.post('/registry', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const pluginRegistry = await getPluginRegistry(req.storeId);
    const result = await pluginRegistry.registerPlugin(req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Plugin registered successfully',
        pluginId: result.pluginId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error registering plugin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get plugin details
router.get('/registry/:pluginId', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const plugin = await pluginRegistry.getPlugin(pluginId);

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found'
      });
    }

    // Get hooks, endpoints, and scripts
    const [hooks, endpoints, scripts, dependencies] = await Promise.all([
      pluginRegistry.getPluginHooks(pluginId),
      pluginRegistry.getPluginEndpoints(pluginId),
      pluginRegistry.getPluginScripts(pluginId),
      pluginRegistry.getPluginDependencies(pluginId)
    ]);

    res.json({
      success: true,
      data: {
        ...plugin,
        hooks,
        endpoints,
        scripts,
        dependencies
      }
    });
  } catch (error) {
    console.error('Error getting plugin details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update plugin status
router.patch('/registry/:pluginId/status', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'error'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, inactive, or error'
      });
    }

    const pluginRegistry = await getPluginRegistry(req.storeId);
    const result = await pluginRegistry.updatePluginStatus(pluginId, status);

    if (result.success) {
      res.json({
        success: true,
        message: `Plugin status updated to ${status}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating plugin status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete plugin
router.delete('/registry/:pluginId', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const result = await pluginRegistry.deletePlugin(pluginId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Plugin deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'Plugin not found'
      });
    }
  } catch (error) {
    console.error('Error deleting plugin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get plugin scripts
router.get('/registry/:pluginId/scripts', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const scripts = await pluginRegistry.getPluginScripts(pluginId);

    res.json({
      success: true,
      data: scripts,
      count: scripts.length
    });
  } catch (error) {
    console.error('Error getting plugin scripts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register plugin script
router.post('/registry/:pluginId/scripts', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const result = await pluginRegistry.registerPluginScript(pluginId, req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Script registered successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error registering plugin script:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get plugin hooks
router.get('/registry/:pluginId/hooks', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const hooks = await pluginRegistry.getPluginHooks(pluginId);

    res.json({
      success: true,
      data: hooks,
      count: hooks.length
    });
  } catch (error) {
    console.error('Error getting plugin hooks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register plugin hook
router.post('/registry/:pluginId/hooks', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const result = await pluginRegistry.registerPluginHook(pluginId, req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Hook registered successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error registering plugin hook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Plugin hooks execution endpoint
router.post('/hooks/:hookName', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { hookName } = req.params;
    const { input, context = {} } = req.body;

    const pluginRegistry = await getPluginRegistry(req.storeId);

    // Get all active hooks for this hook name
    const hooks = await pluginRegistry.getHooksByName(hookName);

    let result = input;
    const executionResults = [];

    for (const hook of hooks) {
      try {
        const execution = await pluginRegistry.executePluginCode(
          hook.plugin_id,
          'hook',
          hook.handler_code,
          { input: result, context, hookName }
        );

        if (execution.success) {
          result = execution.result;
          executionResults.push({
            pluginId: hook.plugin_id,
            success: true,
            executionTime: execution.executionTime
          });
        } else {
          executionResults.push({
            pluginId: hook.plugin_id,
            success: false,
            error: execution.result?.error
          });
        }
      } catch (error) {
        console.error(`Error executing hook ${hookName} for plugin ${hook.plugin_id}:`, error);
        executionResults.push({
          pluginId: hook.plugin_id,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: result,
      hookExecutions: executionResults,
      hooksExecuted: hooks.length
    });
  } catch (error) {
    console.error('Error executing hooks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Plugin data endpoints
router.get('/registry/:pluginId/data/:key', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId, key } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const value = await pluginRegistry.getPluginData(pluginId, key);

    res.json({
      success: true,
      data: value
    });
  } catch (error) {
    console.error('Error getting plugin data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/registry/:pluginId/data/:key', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId, key } = req.params;
    const { value } = req.body;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const result = await pluginRegistry.setPluginData(pluginId, key, value);

    if (result.success) {
      res.json({
        success: true,
        message: 'Plugin data saved'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error setting plugin data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/registry/:pluginId/data/:key', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { pluginId, key } = req.params;
    const pluginRegistry = await getPluginRegistry(req.storeId);

    const result = await pluginRegistry.deletePluginData(pluginId, key);

    if (result.success) {
      res.json({
        success: true,
        message: 'Plugin data deleted'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting plugin data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to match paths with parameters
function matchPath(pattern, actual) {
  // Simple path matching - could be enhanced with proper regex
  const patternParts = pattern.split('/').filter(p => p);
  const actualParts = actual.split('/').filter(p => p);

  if (patternParts.length !== actualParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const actualPart = actualParts[i];

    // Skip parameter parts (start with :)
    if (patternPart.startsWith(':')) {
      continue;
    }

    if (patternPart !== actualPart) {
      return false;
    }
  }

  return true;
}

// Export just the router (no initialization needed)
module.exports = {
  router
};
