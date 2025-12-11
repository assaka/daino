const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const AkeneoIntegration = require('../services/akeneo-integration');
const AkeneoSyncService = require('../services/akeneo-sync-service');
const IntegrationConfig = require('../models/IntegrationConfig');
const AkeneoCustomMapping = require('../models/AkeneoCustomMapping');
const creditService = require('../services/credit-service');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize, storeOwnerOnly, customerOnly, adminOnly } = require('../middleware/auth');
const { storeResolver } = require('../middleware/storeResolver');

// Debug route to test if integrations router is working
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Integrations router is working!',
    timestamp: new Date().toISOString()
  });
});


// Helper function to load Akeneo configuration (database only - no backward compatibility)
const loadAkeneoConfig = async (storeId, reqBody = null) => {
  // If configuration is provided in request body, use it (for testing purposes)
  if (reqBody && reqBody.baseUrl) {
    return {
      baseUrl: reqBody.baseUrl,
      clientId: reqBody.clientId,
      clientSecret: reqBody.clientSecret,
      username: reqBody.username,
      password: reqBody.password
    };
  }

  // Load from database only - clean database approach
  const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
  if (integrationConfig && integrationConfig.config_data) {
    console.log('🔧 Using Akeneo config from database:', {
      baseUrl: integrationConfig.config_data.baseUrl,
      clientId: integrationConfig.config_data.clientId,
      username: integrationConfig.config_data.username,
      hasSecret: !!integrationConfig.config_data.clientSecret,
      secretLength: integrationConfig.config_data.clientSecret?.length,
      hasPassword: !!integrationConfig.config_data.password
    });
    return integrationConfig.config_data;
  }

  // No fallback to environment variables - require proper configuration
  throw new Error('Akeneo integration not configured. Please save your configuration first.');
};

// Helper function to handle import operations with proper status tracking and credit management
const handleImportOperation = async (storeId, req, res, importFunction) => {
  try {
    const userId = req.user.id;
    
    // Check if user has enough credits for this operation (unless it's a dry run)
    const isDryRun = req.body.dryRun === true;
    if (!isDryRun) {
      console.log('💳 Checking credits for import operation...');
      const hasCredits = await creditService.hasEnoughCredits(userId, storeId, 0.1);
      
      if (!hasCredits) {
        const balance = await creditService.getBalance(userId, storeId);
        return res.status(402).json({
          success: false,
          message: 'Insufficient credits to perform this operation',
          error: `Required: 0.1 credits, Available: ${balance} credits`,
          error_code: 'INSUFFICIENT_CREDITS',
          required_credits: 0.1,
          available_credits: balance,
          credit_info: {
            message: 'Please purchase more credits to continue using Akeneo integrations',
            cost_per_operation: 0.1
          }
        });
      }
    }

    // Use the unified sync service approach
    const syncService = new AkeneoSyncService();
    await syncService.initialize(storeId);
    
    // Update sync status
    const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
    if (integrationConfig) {
      await IntegrationConfig.updateSyncStatus(integrationConfig.id, storeId, 'syncing');
    }

    try {
      const result = await importFunction(syncService.integration, storeId, req.body);
      
      // Deduct credits if operation was successful and not a dry run
      if (result.success && !isDryRun) {
        console.log('💳 Deducting credits for successful import operation...');
        try {
          // Determine import type from path
          let importType = 'manual_import';
          if (req.path.includes('/import-attributes')) importType = 'attributes';
          else if (req.path.includes('/import-families')) importType = 'families';
          else if (req.path.includes('/import-categories')) importType = 'categories';
          else if (req.path.includes('/import-products')) importType = 'products';
          else if (req.path.includes('/import-all')) importType = 'all';
          
          const creditUsage = await creditService.recordManualAkeneoUsage(
            userId,
            storeId,
            importType,
            {
              operation: req.path,
              filters: req.body.filters || {},
              settings: req.body.settings || {},
              result_summary: {
                total_processed: result.total || 0,
                successful: result.successful || 0,
                failed: result.failed || 0
              }
            }
          );
          
          // Add credit info to response
          result.credit_usage = {
            credits_deducted: creditUsage.credits_deducted,
            remaining_balance: creditUsage.remaining_balance,
            usage_id: creditUsage.usage_id
          };
          
          console.log(`💳 Successfully deducted ${creditUsage.credits_deducted} credits`);
        } catch (creditError) {
          console.error('❌ Error deducting credits:', creditError);
          // Don't fail the import if credit deduction fails, but log it
          result.credit_error = creditError.message;
        }
      }
      
      // Update sync status based on result
      if (integrationConfig) {
        await IntegrationConfig.updateSyncStatus(integrationConfig.id, storeId, result.success ? 'success' : 'error', result.error || null);
        
        // Track section-specific last import dates
        if (result.success && req.path.includes('/import-')) {
          const currentConfig = integrationConfig.config_data || {};
          const lastImportDates = currentConfig.lastImportDates || {};
          
          // Determine section from the endpoint
          let section = null;
          if (req.path.includes('/import-attributes')) section = 'attributes';
          else if (req.path.includes('/import-families')) section = 'families';
          else if (req.path.includes('/import-categories')) section = 'categories';
          else if (req.path.includes('/import-products')) section = 'products';
          
          if (section) {
            lastImportDates[section] = new Date().toISOString();
            const updatedConfigData = {
              ...currentConfig,
              lastImportDates
            };
            await IntegrationConfig.createOrUpdate(storeId, 'akeneo', updatedConfigData);
          }
        }
      }

      res.json(result);
    } catch (importError) {
      // Update sync status on error
      if (integrationConfig) {
        await IntegrationConfig.updateSyncStatus(integrationConfig.id, storeId, 'error', importError.message);
      }
      throw importError;
    }
  } catch (error) {
    console.error('Error in import operation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Test Akeneo connection
 * POST /api/integrations/akeneo/test-connection
 */
router.post('/akeneo/test-connection', 
  authMiddleware,
  storeResolver(),
  body('baseUrl').optional().isURL().withMessage('Valid base URL is required'),
  body('clientId').optional().notEmpty().withMessage('Client ID is required'),
  body('clientSecret').optional().notEmpty().withMessage('Client secret is required'),
  body('username').optional().notEmpty().withMessage('Username is required'),
  body('password').optional().notEmpty().withMessage('Password is required'),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const storeId = req.storeId;
    
    try {
      // Use the unified sync service approach
      const syncService = new AkeneoSyncService();
      await syncService.initialize(storeId);
      const result = await syncService.testConnection();

      // Get the integration config to save connection status
      const IntegrationConfig = require('../models/IntegrationConfig');
      let integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');

      if (!result.success) {
        // Provide more specific error messages for authentication failures
        let errorMessage = result.message;
        
        if (result.message.includes('401') || result.message.includes('Unauthorized')) {
          errorMessage = 'Akeneo authentication failed. Please check your credentials (Client ID, Client Secret, Username, and Password).';
        } else if (result.message.includes('403') || result.message.includes('Forbidden')) {
          errorMessage = 'Akeneo access denied. Please check if your user has the required permissions.';
        } else if (result.message.includes('404') || result.message.includes('Not Found')) {
          errorMessage = 'Akeneo API endpoint not found. Please check your Base URL.';
        } else if (result.message.includes('ENOTFOUND') || result.message.includes('ECONNREFUSED')) {
          errorMessage = 'Cannot connect to Akeneo server. Please check your Base URL and network connection.';
        }
        
        // Save failed connection status
        if (integrationConfig) {
          await IntegrationConfig.updateConnectionStatus(integrationConfig.id, storeId, 'failed', errorMessage);
        }
        
        return res.status(400).json({
          success: false,
          message: 'Akeneo connection test failed',
          error: errorMessage,
          details: result.message // Keep original error for debugging
        });
      }

      // Save successful connection status
      if (integrationConfig) {
        await IntegrationConfig.updateConnectionStatus(integrationConfig.id, storeId, 'success', null);
      }

      res.json(result);
    } catch (syncError) {
      // Save failed connection status for sync initialization errors
      try {
        let integrationConfigForError = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
        if (integrationConfigForError) {
          await IntegrationConfig.updateConnectionStatus(integrationConfigForError.id, storeId, 'failed', syncError.message);
        }
      } catch (statusUpdateError) {
        console.error('Failed to update connection status:', statusUpdateError);
      }
      
      // Handle sync service initialization errors
      return res.status(400).json({
        success: false,
        message: 'Failed to initialize Akeneo configuration',
        error: syncError.message
      });
    }
  } catch (error) {
    console.error('Error testing Akeneo connection:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get Akeneo connection status
 * GET /api/integrations/akeneo/connection-status
 */
router.get('/akeneo/connection-status', 
  authMiddleware,
  storeResolver(),
  async (req, res) => {
  try {
    const storeId = req.storeId;
    
    const IntegrationConfig = require('../models/IntegrationConfig');
    const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
    
    if (!integrationConfig) {
      return res.json({
        success: true,
        connectionStatus: {
          status: 'untested',
          message: null,
          testedAt: null
        }
      });
    }
    
    res.json({
      success: true,
      connectionStatus: {
        status: integrationConfig.connection_status || 'untested',
        message: integrationConfig.connection_error || null,
        testedAt: integrationConfig.connection_tested_at || null
      }
    });
  } catch (error) {
    console.error('Error retrieving Akeneo connection status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Unified Akeneo Sync - Single endpoint for all operations
 * POST /api/integrations/akeneo/sync
 */
router.post('/akeneo/sync',
  authMiddleware,
  storeResolver(),
  body('operations').isArray().withMessage('Operations must be an array'),
  body('operations.*').isIn(['categories', 'products', 'attributes', 'families']).withMessage('Invalid operation type'),
  body('locale').optional().isString().withMessage('Locale must be a string'),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  body('batchSize').optional().isInt({ min: 1, max: 200 }).withMessage('Batch size must be between 1 and 200'),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const storeId = req.storeId;
    const { operations = [], locale = 'en_US', dryRun = false, batchSize = 50 } = req.body;

    if (operations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one operation must be specified'
      });
    }

    console.log(`🚀 Starting unified Akeneo sync for store: ${storeId}`);
    console.log(`📋 Operations: ${operations.join(', ')}`);
    console.log(`⚙️ Options: locale=${locale}, dryRun=${dryRun}, batchSize=${batchSize}`);

    // Initialize sync service
    const syncService = new AkeneoSyncService();
    
    try {
      await syncService.initialize(storeId);
      
      // Execute sync operations
      const result = await syncService.sync(operations, {
        locale,
        dryRun,
        batchSize
      });

      res.json(result);
      
    } finally {
      // Always cleanup
      syncService.cleanup();
    }

  } catch (error) {
    console.error('Error in unified Akeneo sync:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get Akeneo sync status
 * GET /api/integrations/akeneo/sync/status
 */
router.get('/akeneo/sync/status', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const syncService = new AkeneoSyncService();
    
    try {
      await syncService.initialize(storeId);
      const status = await syncService.getStatus();
      res.json({
        success: true,
        ...status
      });
    } catch (initError) {
      // If initialization fails, return basic status
      res.json({
        success: true,
        status: 'not_configured',
        message: initError.message
      });
    } finally {
      syncService.cleanup();
    }
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Import categories from Akeneo with advanced settings
 * POST /api/integrations/akeneo/import-categories
 */
router.post('/akeneo/import-categories', 
  authMiddleware,
  storeResolver(),
  body('locale').optional().isString().withMessage('Locale must be a string'),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  body('filters').optional().isObject().withMessage('Filters must be an object'),
  body('settings').optional().isObject().withMessage('Settings must be an object'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const storeId = req.storeId;
  console.log('🔍 Import categories request body:', req.body);
  
  await handleImportOperation(storeId, req, res, async (integration, storeId, body) => {
    const { 
      locale = 'en_US', 
      dryRun = false, 
      filters = {},
      settings = {}
    } = body;
    
    console.log(`📦 Starting category import with dryRun: ${dryRun}, locale: ${locale}`);
    console.log(`🎯 Category filters:`, filters);
    console.log(`⚙️ Category settings:`, settings);
    
    // Process advanced category settings
    const importOptions = {
      locale,
      dryRun,
      filters,
      settings: {
        hideFromMenu: settings.hideFromMenu || false,
        setNewActive: settings.setNewActive !== undefined ? settings.setNewActive : true,
        ...settings
      }
    };
    
    return await integration.importCategories(storeId, importOptions);
  });
});

/**
 * Get categories from Akeneo
 * GET /api/integrations/akeneo/categories
 */
router.get('/akeneo/categories', authMiddleware, storeResolver(), async (req, res) => {
  const storeId = req.storeId;
  
  try {
    console.log('📂 Getting categories from Akeneo for store:', storeId);
    
    // Get Akeneo configuration
    const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');

    if (!integrationConfig) {
      return res.status(404).json({
        success: false,
        message: 'Akeneo integration not configured for this store'
      });
    }

    const config = integrationConfig.config_data;
    if (!config || !config.baseUrl || !config.clientId || !config.clientSecret || !config.username || !config.password) {
      console.error('❌ Incomplete configuration:', {
        hasBaseUrl: !!config?.baseUrl,
        hasClientId: !!config?.clientId,
        hasClientSecret: !!config?.clientSecret,
        hasUsername: !!config?.username,
        hasPassword: !!config?.password
      });
      return res.status(400).json({
        success: false,
        message: 'Incomplete Akeneo configuration'
      });
    }

    console.log('🔧 Using Akeneo config:', {
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      username: config.username,
      hasSecret: !!config.clientSecret,
      hasPassword: !!config.password
    });

    // Create integration instance and get categories
    const integration = new AkeneoIntegration(config);
    const categories = await integration.client.getAllCategories();
    
    console.log(`📦 Found ${categories.length} categories from Akeneo`);
    
    if (categories.length > 0) {
      console.log('📊 Sample categories:', categories.slice(0, 3).map(cat => ({
        code: cat.code,
        parent: cat.parent,
        labels: cat.labels
      })));
    }
    
    res.json({
      success: true,
      categories: categories,
      total: categories.length
    });
    
  } catch (error) {
    console.error('Error getting Akeneo categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get categories from Akeneo',
      error: error.message
    });
  }
});

/**
 * Import products from Akeneo with advanced settings
 * POST /api/integrations/akeneo/import-products
 */
router.post('/akeneo/import-products',
  authMiddleware,
  storeResolver(),
  body('locale').optional().isString().withMessage('Locale must be a string'),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  body('batchSize').optional().isInt({ min: 1, max: 200 }).withMessage('Batch size must be between 1 and 200'),
  body('filters').optional().isObject().withMessage('Filters must be an object'),
  body('settings').optional().isObject().withMessage('Settings must be an object'),
  body('customMappings').optional().isObject().withMessage('Custom mappings must be an object'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const storeId = req.storeId;
  console.log('🔍 Import products request body:', req.body);
  
  await handleImportOperation(storeId, req, res, async (integration, storeId, body) => {
    const { 
      locale = 'en_US', 
      dryRun = false, 
      batchSize = 50,
      filters = {},
      settings = {},
      customMappings: requestCustomMappings
    } = body;
    
    // Load custom mappings from database if not provided in request
    let customMappings = requestCustomMappings || {};

    // Check if custom mappings actually have content (not just empty arrays)
    const hasActualMappings = requestCustomMappings && (
      (requestCustomMappings.attributes && requestCustomMappings.attributes.length > 0) ||
      (requestCustomMappings.images && requestCustomMappings.images.length > 0) ||
      (requestCustomMappings.files && requestCustomMappings.files.length > 0)
    );

    // If no custom mappings provided in request, load from database
    if (!hasActualMappings) {
      try {
        console.log('🔍 Loading custom mappings from database...');
        const dbMappings = await AkeneoCustomMapping.getMappings(storeId);
        const hasDbMappings = dbMappings && (
          (dbMappings.attributes && dbMappings.attributes.length > 0) ||
          (dbMappings.images && dbMappings.images.length > 0) ||
          (dbMappings.files && dbMappings.files.length > 0)
        );
        if (hasDbMappings) {
          customMappings = dbMappings;
          console.log('✅ Loaded custom mappings from database:', JSON.stringify(customMappings, null, 2));
        } else {
          console.log('ℹ️ No custom mappings found in database');
        }
      } catch (mappingError) {
        console.warn('⚠️ Failed to load custom mappings from database:', mappingError.message);
        // Continue with import using empty mappings
      }
    } else {
      console.log('✅ Using custom mappings from request:', JSON.stringify(customMappings, null, 2));
    }
    
    console.log(`📦 Starting product import with dryRun: ${dryRun}, locale: ${locale}`);
    console.log(`🎯 Product filters:`, filters);
    console.log(`⚙️ Product settings:`, settings);
    console.log(`🗺️ Custom mappings:`, customMappings);
    
    // Save custom mappings to database if provided in request and not empty
    if (requestCustomMappings && Object.keys(requestCustomMappings).length > 0) {
      try {
        console.log('💾 Saving custom mappings to database during import...');
        await AkeneoCustomMapping.saveAllMappings(storeId, requestCustomMappings, req.user?.id);
        console.log('✅ Custom mappings saved successfully');
      } catch (mappingError) {
        console.warn('⚠️ Failed to save custom mappings during import:', mappingError.message);
        // Continue with import even if saving mappings fails
      }
    }
    
    // Process advanced product settings and filters
    const importOptions = {
      locale,
      dryRun,
      batchSize,
      filters: {
        families: filters.families || [],
        completeness: filters.completeness || 100,
        updatedSince: filters.updatedSince || 0,
        productModel: filters.productModel || 'all_variants_complete',
        ...filters
      },
      settings: {
        mode: settings.mode || 'standard',
        status: settings.status || 'enabled',
        includeImages: settings.includeImages !== undefined ? settings.includeImages : true,
        includeFiles: settings.includeFiles !== undefined ? settings.includeFiles : true,
        includeStock: settings.includeStock !== undefined ? settings.includeStock : true,
        downloadImages: settings.downloadImages !== undefined ? settings.downloadImages : true,
        ...settings
      },
      customMappings
    };
    
    return await integration.importProducts(storeId, importOptions);
  });
});

/**
 * Import attributes from Akeneo with advanced settings
 * POST /api/integrations/akeneo/import-attributes
 */
router.post('/akeneo/import-attributes', 
  authMiddleware,
  storeResolver(),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  body('filters').optional().isObject().withMessage('Filters must be an object'),
  body('settings').optional().isObject().withMessage('Settings must be an object'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const storeId = req.storeId;
  console.log('🔍 Import attributes request body:', req.body);
  
  await handleImportOperation(storeId, req, res, async (integration, storeId, body) => {
    const { 
      dryRun = false,
      filters = {},
      settings = {}
    } = body;
    
    console.log(`📦 Starting attribute import with dryRun: ${dryRun}`);
    console.log(`🎯 Attribute filters:`, filters);
    console.log(`⚙️ Attribute settings:`, settings);
    
    // Process advanced attribute settings and filters
    const importOptions = {
      dryRun,
      filters: {
        families: filters.families || [],
        updatedSince: filters.updatedSince || 0,
        ...filters
      },
      settings: {
        updatedInterval: settings.updatedInterval || 0,
        selectedFamilies: settings.selectedFamilies || [],
        ...settings
      }
    };
    
    return await integration.importAttributes(storeId, importOptions);
  });
});

/**
 * Import families from Akeneo
 * POST /api/integrations/akeneo/import-families
 */
router.post('/akeneo/import-families', 
  authMiddleware,
  storeResolver(),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  body('filters').optional().isObject().withMessage('Filters must be an object'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const storeId = req.storeId;
  console.log('🔍 Import families request body:', req.body);
  
  await handleImportOperation(storeId, req, res, async (integration, storeId, body) => {
    const { dryRun = false, filters = {} } = body;
    console.log(`📦 Starting family import with dryRun: ${dryRun}`);
    console.log(`🎯 Family filters:`, filters);
    return await integration.importFamilies(storeId, { dryRun, filters });
  });
});

/**
 * Import both categories and products from Akeneo
 * POST /api/integrations/akeneo/import-all
 */
router.post('/akeneo/import-all',
  authMiddleware,
  storeResolver(),
  body('locale').optional().isString().withMessage('Locale must be a string'),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const storeId = req.storeId;
  await handleImportOperation(storeId, req, res, async (integration, storeId, body) => {
    const { locale = 'en_US', dryRun = false } = body;
    return await integration.importAll(storeId, { locale, dryRun });
  });
});

/**
 * Get integration configuration status
 * GET /api/integrations/akeneo/config-status
 */
router.get('/akeneo/config-status', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    
    // Get config from database only (clean database approach)
    const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');
    
    let config = {};
    let hasConfig = false;
    
    if (integrationConfig && integrationConfig.config_data) {
      // Config found in database
      const configData = integrationConfig.config_data;
      config = {
        baseUrl: configData.baseUrl || '',
        clientId: configData.clientId || '',
        username: configData.username || '',
        // Provide placeholder values for sensitive fields if they exist
        clientSecret: configData.clientSecret ? '••••••••' : '',
        password: configData.password ? '••••••••' : '',
        locale: configData.locale || 'en_US',
        version: configData.version || '7',
        lastSync: integrationConfig.last_sync_at,
        syncStatus: integrationConfig.sync_status,
        lastImportDates: configData.lastImportDates || {}
      };
      hasConfig = !!(configData.baseUrl && configData.clientId && configData.clientSecret && configData.username && configData.password);
    } else {
      // No configuration found - clean database approach
      config = {
        baseUrl: '',
        clientId: '',
        username: '',
        clientSecret: '',
        password: '',
        locale: 'en_US',
        version: '7',
        lastSync: null,
        syncStatus: 'not_configured',
        lastImportDates: {}
      };
      hasConfig = false;
    }

    res.json({
      success: true,
      hasConfig,
      source: integrationConfig ? 'database' : 'not_configured',
      config
    });
  } catch (error) {
    console.error('Error getting Akeneo config status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get import statistics
 * GET /api/integrations/akeneo/stats
 */
router.get('/akeneo/stats', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    
    const ImportStatistic = require('../models/ImportStatistic');

    // Get latest import statistics for each import type (filtered by akeneo source)
    const latestStats = await ImportStatistic.getLatestStats(storeId, 'akeneo');
    
    // Ensure latestStats has all required properties
    if (!latestStats || typeof latestStats !== 'object') {
      console.error('Invalid latestStats returned:', latestStats);
      return res.json({
        success: true,
        stats: {
          categories: 0,
          attributes: 0,
          families: 0,
          products: 0
        },
        detailed_stats: {
          categories: { successful_imports: 0, total_processed: 0, failed_imports: 0, skipped_imports: 0 },
          attributes: { successful_imports: 0, total_processed: 0, failed_imports: 0, skipped_imports: 0 },
          families: { successful_imports: 0, total_processed: 0, failed_imports: 0, skipped_imports: 0 },
          products: { successful_imports: 0, total_processed: 0, failed_imports: 0, skipped_imports: 0 }
        }
      });
    }

    res.json({
      success: true,
      stats: {
        categories: latestStats?.categories?.successful_imports || 0,
        attributes: latestStats?.attributes?.successful_imports || 0,
        families: latestStats?.families?.successful_imports || 0,
        products: latestStats?.products?.successful_imports || 0
      },
      // Also return detailed stats for each import type
      detailed_stats: latestStats
    });
  } catch (error) {
    console.error('Error getting import stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      // Return safe defaults even on error
      stats: {
        categories: 0,
        attributes: 0,
        families: 0,
        products: 0
      }
    });
  }
});

/**
 * Get families from Akeneo
 * GET /api/integrations/akeneo/families
 */
router.get('/akeneo/families', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const syncService = new AkeneoSyncService();
    
    try {
      await syncService.initialize(storeId);
      const families = await syncService.integration.client.getAllFamilies();
      
      res.json({
        success: true,
        families: families.map(family => ({
          code: family.code,
          labels: family.labels,
          attributes: family.attributes
        })),
        total: families.length
      });
    } catch (initError) {
      return res.status(400).json({
        success: false,
        message: 'Failed to load families from Akeneo',
        error: initError.message
      });
    } finally {
      syncService.cleanup();
    }
  } catch (error) {
    console.error('Error getting Akeneo families:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get available locales (mock data - could be enhanced to fetch from Akeneo)
 * GET /api/integrations/akeneo/locales
 */
router.get('/akeneo/locales', (req, res) => {
  try {
    const commonLocales = [
      { code: 'en_US', name: 'English (US)' },
      { code: 'en_GB', name: 'English (UK)' },
      { code: 'fr_FR', name: 'French (France)' },
      { code: 'de_DE', name: 'German (Germany)' },
      { code: 'es_ES', name: 'Spanish (Spain)' },
      { code: 'it_IT', name: 'Italian (Italy)' },
      { code: 'pt_BR', name: 'Portuguese (Brazil)' },
      { code: 'nl_NL', name: 'Dutch (Netherlands)' },
      { code: 'zh_CN', name: 'Chinese (Simplified)' },
      { code: 'ja_JP', name: 'Japanese' }
    ];

    res.json({
      success: true,
      locales: commonLocales
    });
  } catch (error) {
    console.error('Error getting Akeneo locales:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get available channels from Akeneo
 * GET /api/integrations/akeneo/channels
 */
router.get('/akeneo/channels', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const config = await loadAkeneoConfig(storeId);

    if (!config.baseUrl || !config.clientId || !config.clientSecret || !config.username || !config.password) {
      return res.status(400).json({
        success: false,
        message: 'Akeneo configuration is incomplete. Please save your configuration first.'
      });
    }

    const integration = new AkeneoIntegration(config);
    const channels = await integration.client.getAllChannels();

    res.json({
      success: true,
      channels: channels.map(channel => ({
        code: channel.code,
        label: channel.labels ? Object.values(channel.labels)[0] || channel.code : channel.code
      }))
    });
  } catch (error) {
    console.error('Error getting Akeneo channels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load channels',
      error: error.message
    });
  }
});

/**
 * Get schedule configurations
 * GET /api/integrations/akeneo/schedules
 */
router.get('/akeneo/schedules', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const AkeneoSchedule = require('../models/AkeneoSchedule');
    
    const schedules = await AkeneoSchedule.findAll({
      where: { store_id: storeId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      schedules
    });
  } catch (error) {
    console.error('Error getting schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Create or update schedule
 * POST /api/integrations/akeneo/schedules
 */
router.post('/akeneo/schedules', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const AkeneoSchedule = require('../models/AkeneoSchedule');
    
    // Validate and convert date fields
    const scheduleData = {
      ...req.body,
      store_id: storeId
    };

    // Convert schedule_date if it's provided and not empty
    if (scheduleData.schedule_date && scheduleData.schedule_date !== '') {
      try {
        const date = new Date(scheduleData.schedule_date);
        if (isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid schedule date format. Please provide a valid date.'
          });
        }
        scheduleData.schedule_date = date.toISOString();
      } catch (dateError) {
        console.error('Date conversion error:', dateError);
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule date format. Please provide a valid date.'
        });
      }
    } else {
      // Set to null if empty or not provided
      scheduleData.schedule_date = null;
    }

    // Validate schedule type specific requirements
    if (scheduleData.schedule_type === 'once' && !scheduleData.schedule_date) {
      return res.status(400).json({
        success: false,
        message: 'Schedule date is required for one-time schedules.'
      });
    }

    if (req.body.id) {
      // Update existing schedule
      const existingSchedule = await AkeneoSchedule.findByPk(req.body.id);
      if (!existingSchedule || existingSchedule.store_id !== storeId) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found'
        });
      }

      const updatedSchedule = await AkeneoSchedule.update(req.body.id, scheduleData);
      res.json({
        success: true,
        message: 'Schedule updated successfully',
        schedule: updatedSchedule
      });
    } else {
      // Create new schedule
      const schedule = await AkeneoSchedule.create(scheduleData);
      res.json({
        success: true,
        message: 'Schedule created successfully',
        schedule
      });
    }
  } catch (error) {
    console.error('Error saving schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Delete schedule
 * DELETE /api/integrations/akeneo/schedules/:id
 */
router.delete('/akeneo/schedules/:id', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const AkeneoSchedule = require('../models/AkeneoSchedule');
    
    const scheduleToDelete = await AkeneoSchedule.findByPk(req.params.id);
    if (!scheduleToDelete || scheduleToDelete.store_id !== storeId) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    await AkeneoSchedule.destroy(req.params.id);
    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Save Akeneo configuration
 * POST /api/integrations/akeneo/save-config
 */
router.post('/akeneo/save-config',
  authMiddleware,
  storeResolver(),
  body('baseUrl').isURL().withMessage('Valid base URL is required'),
  body('clientId').notEmpty().withMessage('Client ID is required'),
  body('clientSecret').notEmpty().withMessage('Client secret is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { baseUrl, clientId, clientSecret, username, password, version = '7', locale = 'en_US' } = req.body;
    const storeId = req.storeId;

    // Test the connection first
    const integration = new AkeneoIntegration({
      baseUrl,
      clientId,
      clientSecret,
      username,
      password,
      version
    });

    const testResult = await integration.testConnection();

    if (!testResult.success) {
      // Provide more specific error messages for authentication failures
      let errorMessage = testResult.message;

      if (testResult.message.includes('401') || testResult.message.includes('Unauthorized')) {
        errorMessage = 'Akeneo authentication failed. Please check your credentials (Client ID, Client Secret, Username, and Password).';
      } else if (testResult.message.includes('403') || testResult.message.includes('Forbidden')) {
        errorMessage = 'Akeneo access denied. Please check if your user has the required permissions.';
      } else if (testResult.message.includes('404') || testResult.message.includes('Not Found')) {
        errorMessage = 'Akeneo API endpoint not found. Please check your Base URL.';
      } else if (testResult.message.includes('ENOTFOUND') || testResult.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to Akeneo server. Please check your Base URL and network connection.';
      }

      return res.status(400).json({
        success: false,
        message: 'Akeneo connection test failed - configuration not saved',
        error: errorMessage,
        details: testResult.message // Keep original error for debugging
      });
    }

    // Save configuration to database (will be encrypted automatically)
    const configData = {
      baseUrl,
      clientId,
      clientSecret,
      username,
      password,
      version,
      locale
    };

    await IntegrationConfig.createOrUpdate(storeId, 'akeneo', configData);

    res.json({
      success: true,
      message: 'Akeneo configuration saved successfully and connection verified!',
      note: 'Configuration has been securely stored in the database with sensitive data encrypted.'
    });
  } catch (error) {
    console.error('Error saving Akeneo configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Disconnect Akeneo integration
 * POST /api/integrations/akeneo/disconnect
 */
router.post('/akeneo/disconnect',
  authMiddleware,
  storeResolver(),
  async (req, res) => {
  try {
    const storeId = req.storeId;

    // Check if integration exists
    const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'akeneo');

    if (!integrationConfig) {
      return res.json({
        success: true,
        message: 'Akeneo integration was not configured'
      });
    }

    // Delete the integration config
    await IntegrationConfig.deleteByStoreAndType(storeId, 'akeneo');

    // Also delete custom mappings if they exist
    try {
      await AkeneoCustomMapping.destroy({ where: { store_id: storeId } });
    } catch (mappingError) {
      console.warn('Failed to delete custom mappings:', mappingError.message);
      // Continue even if mapping deletion fails
    }

    console.log(`🔌 Akeneo integration disconnected for store: ${storeId}`);

    res.json({
      success: true,
      message: 'Akeneo integration disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting Akeneo integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Akeneo integration',
      error: error.message
    });
  }
});

// ======================
// Akeneo Custom Mappings
// ======================

/**
 * Get custom mappings for a store
 * GET /api/integrations/akeneo/custom-mappings
 */
router.get('/akeneo/custom-mappings', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const mappings = await AkeneoCustomMapping.getMappings(req.storeId);
    
    const response = {
      success: true,
      mappings: mappings
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching custom mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom mappings',
      error: error.message
    });
  }
});

/**
 * Save custom mappings for a store
 * POST /api/integrations/akeneo/custom-mappings
 */
router.post('/akeneo/custom-mappings', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { attributes, images, files } = req.body;
    const userId = req.user?.id || null;
    
    const savedMappings = await AkeneoCustomMapping.saveAllMappings(
      req.storeId,
      { attributes, images, files },
      userId
    );
    
    res.json({
      success: true,
      mappings: savedMappings,
      message: 'Custom mappings saved successfully'
    });
  } catch (error) {
    console.error('Error saving custom mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save custom mappings',
      error: error.message
    });
  }
});

/**
 * Save specific mapping type for a store
 * PUT /api/integrations/akeneo/custom-mappings/:type
 */
router.put('/akeneo/custom-mappings/:type', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { type } = req.params;
    const { mappings } = req.body;
    const userId = req.user?.id || null;
    
    if (!['attributes', 'images', 'files'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mapping type. Must be attributes, images, or files'
      });
    }
    
    const savedMapping = await AkeneoCustomMapping.saveMappings(
      req.storeId,
      type,
      mappings,
      userId
    );
    
    res.json({
      success: true,
      mapping: savedMapping,
      message: `${type} mappings saved successfully`
    });
  } catch (error) {
    console.error(`Error saving ${type} mappings:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to save ${type} mappings`,
      error: error.message
    });
  }
});

/**
 * Delete custom mappings for a store
 * DELETE /api/integrations/akeneo/custom-mappings/:type?
 */
router.delete('/akeneo/custom-mappings/:type?', authMiddleware, storeResolver(), async (req, res) => {
  try {
    const { type } = req.params;
    
    if (type) {
      // Delete specific type
      if (!['attributes', 'images', 'files'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid mapping type. Must be attributes, images, or files'
        });
      }
      
      await AkeneoCustomMapping.destroy({
        where: {
          store_id: req.storeId,
          mapping_type: type
        }
      });
      
      res.json({
        success: true,
        message: `${type} mappings deleted successfully`
      });
    } else {
      // Delete all mappings for the store
      await AkeneoCustomMapping.destroy({
        where: {
          store_id: req.storeId
        }
      });
      
      res.json({
        success: true,
        message: 'All custom mappings deleted successfully'
      });
    }
  } catch (error) {
    console.error('Error deleting custom mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom mappings',
      error: error.message
    });
  }
});

// ======================
// File Upload Integration
// ======================

const multer = require('multer');
const storageManager = require('../services/storage-manager');

// Configure multer for general file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload for file manager
  },
  fileFilter: (req, file, cb) => {
    // Allow images for file manager
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * Universal file upload endpoint for File Manager
 * POST /api/integrations/upload
 */
router.post('/upload', 
  authMiddleware,
  storeResolver(),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file provided'
        });
      }

      const storeId = req.storeId;

      console.log(`📤 File Manager upload: ${req.file.originalname} for store ${storeId}`);

      // Upload options for file manager
      const options = {
        folder: 'file-manager',
        public: true,
        metadata: {
          store_id: storeId,
          uploaded_by: req.user.id,
          upload_type: 'file_manager',
          original_name: req.file.originalname,
          upload_source: 'file_manager'
        }
      };

      // Use unified storage manager
      const uploadResult = await storageManager.uploadFile(storeId, req.file, options);

      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload file',
          error: uploadResult.error
        });
      }

      // Return format expected by File Manager
      res.json({
        success: true,
        message: 'File uploaded successfully',
        file_url: uploadResult.url,
        filename: uploadResult.filename,
        size: uploadResult.size,
        provider: uploadResult.provider,
        fallback_used: uploadResult.fallbackUsed || false,
        upload_details: uploadResult
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Debug route to analyze Akeneo product attributes and identify numeric conversion issues
router.post('/akeneo/debug-attributes', authMiddleware, storeResolver(), async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Akeneo attribute debug request for store:', req.storeId);
    
    const { productData, limit = 1 } = req.body;
    
    // If specific product data is provided, debug that
    if (productData) {
      console.log('🧪 [DEBUG] Analyzing provided product data...');
      
      const AkeneoMapping = require('../services/akeneo-mapping');
      const mapping = new AkeneoMapping();
      
      const debugResult = mapping.debugProductAttributes(productData, 'en_US');
      
      return res.json({
        success: true,
        debug_type: 'single_product',
        product_debug: debugResult,
        recommendations: [
          'Check problematic attributes that stringify to "[object Object]"',
          'Review numeric attribute extraction logic',
          'Ensure proper data type conversion before database insertion'
        ]
      });
    }
    
    // Otherwise, fetch and debug products from Akeneo
    console.log('🧪 [DEBUG] Fetching and analyzing products from Akeneo...');
    
    const akeneoConfig = await loadAkeneoConfig(req.storeId);
    if (!akeneoConfig) {
      return res.status(400).json({
        success: false,
        message: 'Akeneo configuration not found. Please configure Akeneo integration first.'
      });
    }
    
    const akeneoIntegration = new AkeneoIntegration();
    await akeneoIntegration.initialize(req.storeId);
    
    // Fetch a small number of products for debugging
    const products = await akeneoIntegration.client.getProducts({ limit });
    
    if (!products || products.length === 0) {
      return res.json({
        success: true,
        debug_type: 'no_products',
        message: 'No products found in Akeneo to debug',
        products_count: 0
      });
    }
    
    const AkeneoMapping = require('../services/akeneo-mapping');
    const mapping = new AkeneoMapping();
    
    const debugResults = [];
    let totalProblematicAttributes = 0;
    
    // Debug each product
    products.forEach(product => {
      const debugResult = mapping.debugProductAttributes(product, 'en_US');
      debugResults.push(debugResult);
      totalProblematicAttributes += debugResult.problematicAttributes.length;
    });
    
    // Compile summary
    const summary = {
      total_products_analyzed: products.length,
      total_problematic_attributes: totalProblematicAttributes,
      common_issues: [],
      recommendations: []
    };
    
    // Analyze common issues
    const issueTypes = {};
    debugResults.forEach(result => {
      result.problematicAttributes.forEach(attr => {
        const issue = attr.issue;
        if (!issueTypes[issue]) {
          issueTypes[issue] = [];
        }
        issueTypes[issue].push({
          product: result.productId,
          attribute: attr.attributeCode,
          stringValue: attr.stringValue
        });
      });
    });
    
    summary.common_issues = Object.keys(issueTypes).map(issue => ({
      issue_type: issue,
      count: issueTypes[issue].length,
      examples: issueTypes[issue].slice(0, 3) // Show first 3 examples
    }));
    
    // Generate recommendations
    if (totalProblematicAttributes > 0) {
      summary.recommendations = [
        'Fix numeric conversion logic in AkeneoMapping class',
        'Add proper error handling for complex objects',
        'Implement data validation before database insertion',
        'Consider using custom attribute mappings for problematic fields'
      ];
    } else {
      summary.recommendations = [
        'No issues detected in sampled products',
        'Consider testing with more products or specific product identifiers'
      ];
    }
    
    res.json({
      success: true,
      debug_type: 'multiple_products',
      summary,
      detailed_results: debugResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Akeneo attribute debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug Akeneo attributes',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;