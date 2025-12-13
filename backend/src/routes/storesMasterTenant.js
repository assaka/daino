/**
 * Store Management Routes (Master-Tenant Architecture)
 *
 * POST /api/stores - Create new store
 * POST /api/stores/:id/connect-database - Connect Supabase database via OAuth
 * GET /api/stores - Get all user's stores
 * GET /api/stores/:id - Get store details
 * PATCH /api/stores/:id - Update store settings
 * PUT /api/stores/:id - Update store settings (alias for PATCH)
 * DELETE /api/stores/:id - Delete store
 *
 * Note: OAuth tokens stored in master integration_configs, not tenant supabase_oauth_tokens
 */

const express = require('express');
const router = express.Router();
const { masterDbClient } = require('../database/masterConnection');
const { authMiddleware } = require('../middleware/authMiddleware'); // Use same middleware as authMasterTenant
const ConnectionManager = require('../services/database/ConnectionManager');
const TenantProvisioningService = require('../services/database/TenantProvisioningService');
const { encryptDatabaseCredentials } = require('../utils/encryption');

// Master database models
const MasterStore = require('../models/master/MasterStore');
const StoreDatabase = require('../models/master/StoreDatabase');
const StoreHostname = require('../models/master/StoreHostname');
const SupabaseIntegration = require('../services/supabase-integration');

/**
 * Check if a database URL is already being used by another store
 * @param {string} projectUrl - Supabase project URL
 * @param {string} currentStoreId - Current store ID (to exclude from check)
 * @returns {Promise<{isDuplicate: boolean, existingStoreId?: string}>}
 */
async function checkDatabaseUrlDuplicate(projectUrl, currentStoreId = null) {
  try {
    if (!projectUrl) {
      return { isDuplicate: false };
    }

    // Skip check for placeholder/pending URLs
    const placeholderUrls = [
      'pending-configuration.supabase.co',
      'https://pending-configuration.supabase.co',
      'Configuration pending'
    ];

    if (placeholderUrls.some(placeholder => projectUrl.includes(placeholder))) {
      console.log('⏭️ Skipping duplicate check for placeholder URL:', projectUrl);
      return { isDuplicate: false };
    }

    // Extract hostname from project URL
    const url = new URL(projectUrl);
    const host = url.hostname;

    console.log('🔍 Checking for duplicate database URL:', { host, currentStoreId });

    // First, check if there are ANY records in store_databases (for debugging)
    const { data: allDbs, error: countError } = await masterDbClient
      .from('store_databases')
      .select('store_id, host, is_active')
      .limit(10);

    console.log('📊 Sample store_databases records:', allDbs?.length || 0);
    if (allDbs && allDbs.length > 0) {
      console.log('   Sample records:', allDbs.map(db => ({ store_id: db.store_id, host: db.host, is_active: db.is_active })));
    }

    // Query store_databases table to check if this host is already in use
    const { data: existingDb, error } = await masterDbClient
      .from('store_databases')
      .select('store_id, host, is_active')
      .eq('host', host)
      .eq('is_active', true)
      .maybeSingle();

    console.log('🔍 Query result for host', host, ':', existingDb);

    if (error) {
      console.error('Error checking for duplicate database:', error);
      // Don't block on query error - log and continue
      return { isDuplicate: false };
    }

    // If found and it's not the current store, it's a duplicate
    if (existingDb && existingDb.store_id !== currentStoreId) {
      console.log('❌ Database URL already in use by store:', existingDb.store_id);
      return {
        isDuplicate: true,
        existingStoreId: existingDb.store_id
      };
    }

    console.log('✅ Database URL is available');
    return { isDuplicate: false };
  } catch (error) {
    console.error('Error in checkDatabaseUrlDuplicate:', error);
    // Don't block on error - log and continue
    return { isDuplicate: false };
  }
}

/**
 * GET /api/stores/check-slug
 * Check if a store slug is available
 */
router.get('/check-slug', authMiddleware, async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: 'Slug is required'
      });
    }

    // Normalize the slug
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Check if any store with this slug exists (regardless of status)
    const { data: existingStore, error: checkError } = await masterDbClient
      .from('stores')
      .select('id, slug, status')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking slug availability:', checkError);
      throw new Error('Failed to check slug availability');
    }

    const isAvailable = !existingStore;

    res.json({
      success: true,
      slug: normalizedSlug,
      available: isAvailable,
      message: isAvailable
        ? 'This slug is available'
        : 'This slug is already taken. Please choose a different name.'
    });
  } catch (error) {
    console.error('Check slug error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check slug availability',
      details: error.message
    });
  }
});

/**
 * POST /api/stores
 * Create a new store in master DB
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    console.log('Creating store for user:', userId, 'name:', name);

    // Validate input
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Store name is required'
      });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Check if a store with this slug and status='pending_database' already exists
    const { data: existingStore, error: checkError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', slug)
      .eq('status', 'pending_database')
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for existing store:', checkError);
    }

    const { v4: uuidv4 } = require('uuid');
    let store;
    let storeId;
    let isUpdate = false;

    if (existingStore) {
      // Update existing pending_database store
      console.log('Found existing pending_database store, updating:', existingStore.id);
      storeId = existingStore.id;
      isUpdate = true;

      const { data: updatedStore, error: updateError } = await masterDbClient
        .from('stores')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update store: ${updateError.message}`);
      }

      store = updatedStore;
    } else {
      // Check store limit only for new stores
      const { count, error: countError } = await masterDbClient
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const maxStores = 5;
      if (count >= maxStores) {
        return res.status(403).json({
          success: false,
          error: `Maximum number of stores (${maxStores}) reached`,
          code: 'STORE_LIMIT_REACHED'
        });
      }

      // Create new store in master DB
      storeId = uuidv4();

      const { data: newStore, error: storeError } = await masterDbClient
        .from('stores')
        .insert({
          id: storeId,
          user_id: userId,
          slug: slug,
          status: 'pending_database',
          is_active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (storeError) {
        // Check for duplicate slug constraint violation
        if (storeError.code === '23505' && storeError.message.includes('idx_stores_slug')) {
          return res.status(409).json({
            success: false,
            error: 'A store with this name already exists. Please choose a different name.',
            code: 'DUPLICATE_STORE_NAME'
          });
        }
        throw new Error(`Failed to create store: ${storeError.message}`);
      }

      store = newStore;
    }

    res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate
        ? 'Existing pending store found. Please connect a database to activate it.'
        : 'Store created successfully. Please connect a database to activate it.',
      data: {
        store
      },
      isUpdate
    });
  } catch (error) {
    console.error('Store creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create store',
      details: error.message
    });
  }
});

/**
 * POST /api/stores/:id/connect-database
 * Connect Supabase database to store via OAuth
 */
router.post('/:id/connect-database', authMiddleware, async (req, res) => {
  try {
    console.log('========================================');
    console.log('🚀 CONNECT-DATABASE ENDPOINT HIT');
    console.log('========================================');

    const storeId = req.params.id;

    console.log('📥 connect-database request:', {
      storeId,
      bodyKeys: Object.keys(req.body),
      useOAuth: req.body.useOAuth,
      autoProvision: req.body.autoProvision
    });

    const {
      projectUrl: manualProjectUrl,
      serviceRoleKey: manualServiceKey,
      anonKey: manualAnonKey,
      connectionString: manualConnectionString,
      storeName,
      storeSlug,
      useOAuth,
      autoProvision,
      themePreset  // Theme preset name to apply during provisioning
    } = req.body;

    console.log('🔍 Request body keys:', Object.keys(req.body));
    console.log('🔍 serviceRoleKey provided:', !!manualServiceKey);

    let projectUrl, serviceRoleKey, anonKey, connectionString, oauthAccessToken, projectId;

    // If using OAuth, get credentials from Redis (or memory fallback)
    if (useOAuth) {
      console.log('Using OAuth credentials for store:', storeId);

      let oauthToken = null;

      // Check Redis first
      try {
        const { getRedisClient } = require('../config/redis');
        const redisClient = getRedisClient();

        console.log('🔍 Redis client available:', !!redisClient);

        if (redisClient) {
          const redisKey = `oauth:pending:${storeId}`;
          console.log('🔍 Checking Redis key:', redisKey);

          const tokenDataStr = await redisClient.get(redisKey);
          console.log('🔍 Redis get result:', tokenDataStr ? 'found' : 'not found');

          if (tokenDataStr) {
            oauthToken = JSON.parse(tokenDataStr);
            console.log('✅ OAuth tokens retrieved from Redis:', {
              has_access_token: !!oauthToken.access_token,
              has_project_url: !!oauthToken.project_url,
              has_service_role_key: !!oauthToken.service_role_key
            });
          } else {
            console.log('❌ No data found in Redis for key:', redisKey);
          }
        } else {
          console.log('❌ Redis client not available');
        }
      } catch (redisError) {
        console.error('❌ Redis retrieval error:', redisError.message);
      }

      // Check memory fallback
      console.log('🔍 Checking memory fallback...');
      console.log('  global.pendingOAuthTokens exists:', !!global.pendingOAuthTokens);
      if (global.pendingOAuthTokens) {
        console.log('  Map size:', global.pendingOAuthTokens.size);
        console.log('  Has storeId?', global.pendingOAuthTokens.has(storeId));
      }

      if (!oauthToken && global.pendingOAuthTokens && global.pendingOAuthTokens.has(storeId)) {
        oauthToken = global.pendingOAuthTokens.get(storeId);
        console.log('✅ OAuth tokens retrieved from memory (fallback)');
      }

      if (!oauthToken) {
        console.error('❌ No OAuth token found in Redis OR memory for storeId:', storeId);
        return res.status(400).json({
          success: false,
          error: 'No OAuth connection found. Please connect your Supabase account first. Try OAuth again.'
        });
      }

      console.log('✅ OAuth token retrieved:', {
        project_url: oauthToken.project_url,
        has_access_token: !!oauthToken.access_token,
        has_service_role_key: !!oauthToken.service_role_key
      });

      projectUrl = oauthToken.project_url;
      serviceRoleKey = manualServiceKey || oauthToken.service_role_key || null; // Use manual if provided
      anonKey = oauthToken.anon_key;
      oauthAccessToken = oauthToken.access_token; // For running migrations via API

      console.log('🔑 ServiceRoleKey source:', manualServiceKey ? 'Manual (from frontend)' : (oauthToken.service_role_key ? 'OAuth token' : 'None'));

      // Extract project ID from project URL
      if (projectUrl) {
        projectId = new URL(projectUrl).hostname.split('.')[0];
        console.log('📍 Project ID extracted:', projectId);
      }

      // If auto-provisioning, use OAuth API - no connection string needed
      if (autoProvision) {
        console.log('🚀 Auto-provisioning mode - will use Supabase Management API');
        // Connection string not needed for OAuth API mode
        connectionString = null;
      } else {
        // Manual provisioning - require connection string
        if (!manualConnectionString) {
          return res.status(400).json({
            success: false,
            error: 'Database connection string is required for provisioning'
          });
        }
        connectionString = manualConnectionString;
        console.log('Using user-provided connection string for OAuth provisioning');
      }
    } else {
      // Use manual credentials
      projectUrl = manualProjectUrl;
      serviceRoleKey = manualServiceKey;
      anonKey = manualAnonKey;
      connectionString = manualConnectionString;
    }

    console.log('🔍 Validation check:', {
      projectUrl: projectUrl ? 'present' : 'missing',
      serviceRoleKey: serviceRoleKey ? 'present' : 'missing',
      oauthAccessToken: oauthAccessToken ? 'present' : 'missing',
      autoProvision: autoProvision,
      useOAuth: useOAuth
    });

    // Validate required fields
    if (!autoProvision) {
      // Manual mode - require both projectUrl and serviceRoleKey
      if (!projectUrl || !serviceRoleKey) {
        return res.status(400).json({
          success: false,
          error: 'Supabase projectUrl and serviceRoleKey are required for manual provisioning'
        });
      }
    } else {
      // Auto-provision OAuth mode - only require projectUrl and oauthAccessToken
      if (!projectUrl) {
        return res.status(400).json({
          success: false,
          error: 'Supabase projectUrl is required'
        });
      }
      if (!oauthAccessToken) {
        return res.status(400).json({
          success: false,
          error: 'OAuth access token is required for auto-provisioning'
        });
      }
      console.log('✅ Auto-provision mode validated - using OAuth API');
    }

    // Get store from master DB (use Supabase client to avoid Sequelize connection issues)
    console.log('🔍 Fetching store from master DB via Supabase client...');
    console.log('   StoreId:', storeId);
    console.log('   masterDbClient available:', !!masterDbClient);

    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    console.log('🔍 Store query result:', {
      found: !!store,
      error: storeError?.message || 'none',
      errorCode: storeError?.code,
      errorDetails: storeError?.details
    });

    if (storeError || !store) {
      console.error('❌ Store not found:', storeError?.message);
      console.error('   Error details:', JSON.stringify(storeError, null, 2));

      // Try to list all stores to debug
      try {
        const { data: allStores } = await masterDbClient
          .from('stores')
          .select('id')
          .limit(5);
        console.log('   All stores in master DB (first 5):', allStores?.map(s => s.id));
      } catch (listError) {
        console.error('   Could not list stores:', listError.message);
      }

      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    console.log('✅ Store found:', {
      id: store.id,
      status: store.status,
      is_active: store.is_active
    });

    if (store.status !== 'pending_database') {
      return res.status(400).json({
        success: false,
        error: 'Store already has a database connected',
        code: 'ALREADY_CONNECTED'
      });
    }

    // Check if this database URL is already being used by another store
    console.log('========================================');
    console.log('🔍 DUPLICATE DATABASE CHECK STARTING');
    console.log('========================================');
    console.log('   projectUrl:', projectUrl);
    console.log('   storeId:', storeId);

    const duplicateCheck = await checkDatabaseUrlDuplicate(projectUrl, storeId);

    console.log('🔍 Duplicate check result:', duplicateCheck);

    if (duplicateCheck.isDuplicate) {
      console.error('❌ Database URL is already in use by another store:', duplicateCheck.existingStoreId);

      // Revert store status back to pending_database
      await masterDbClient
        .from('stores')
        .update({ status: 'pending_database', updated_at: new Date().toISOString() })
        .eq('id', storeId);

      return res.status(409).json({
        success: false,
        error: 'This Supabase database is already connected to another store. Please use a different Supabase project.',
        code: 'DATABASE_ALREADY_IN_USE'
      });
    }

    console.log('✅ Database URL is available for use');

    // Validate service role key before proceeding
    if (serviceRoleKey && projectUrl) {
      console.log('🔑 Validating service role key...');
      try {
        const { createClient } = require('@supabase/supabase-js');
        const testClient = createClient(projectUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // Try a simple query to validate the key
        const { error: testError } = await testClient.from('_test_connection_').select('id').limit(1);

        // Check for authentication errors (not "table not found" which is expected)
        if (testError) {
          const isAuthError = testError.message?.toLowerCase().includes('invalid api key') ||
                              testError.message?.toLowerCase().includes('invalid jwt') ||
                              testError.message?.toLowerCase().includes('jwt') ||
                              testError.code === 'PGRST301';

          if (isAuthError) {
            console.error('❌ Service role key validation failed:', testError.message);
            return res.status(401).json({
              success: false,
              error: 'Invalid Service Role Key. Please check your Supabase Dashboard → Settings → API and copy the correct service_role key.',
              code: 'INVALID_SERVICE_ROLE_KEY',
              hint: testError.hint || 'The key should start with "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"'
            });
          }
          // Table not found is OK - means connection works
          console.log('✅ Service role key validated (table not found is expected)');
        } else {
          console.log('✅ Service role key validated successfully');
        }
      } catch (validationError) {
        console.error('❌ Service role key validation error:', validationError.message);
        return res.status(401).json({
          success: false,
          error: 'Failed to validate Service Role Key. Please ensure you copied the correct key from Supabase Dashboard.',
          code: 'SERVICE_KEY_VALIDATION_FAILED',
          details: validationError.message
        });
      }
    }

    // Update store status to provisioning (use Supabase client)
    console.log('🔄 Updating store status to provisioning...');
    const { error: updateError } = await masterDbClient
      .from('stores')
      .update({ status: 'provisioning', updated_at: new Date().toISOString() })
      .eq('id', storeId);

    if (updateError) {
      console.error('❌ Failed to update store status:', updateError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to update store status'
      });
    }

    console.log('✅ Store status updated to provisioning');

    // 1. Validate and encrypt credentials
    if (!connectionString) {
      console.warn('No connection string provided, attempting to build from project URL...');
      // Try to build connection string from projectUrl
      try {
        const projectRef = new URL(projectUrl).hostname.split('.')[0];
        connectionString = `postgresql://postgres.${projectRef}:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
        console.log('Generated connection string template:', connectionString.substring(0, 50) + '...');
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Database connection string is required. Please provide the PostgreSQL connection string from Supabase Settings → Database.'
        });
      }
    }

    // Setup database credentials and connection
    let storeDb = null;
    let tenantDb = null;

    if (!autoProvision) {
      // Manual mode - store credentials and create full PostgreSQL connection
      const credentials = {
        projectUrl,
        serviceRoleKey,
        anonKey,
        connectionString
      };

      console.log('Creating StoreDatabase record with credentials (manual mode)');

      storeDb = await StoreDatabase.createWithCredentials(
        storeId,
        'supabase',
        credentials
      );

      // Test connection
      const connectionTest = await storeDb.testConnection();

      if (!connectionTest) {
        await store.update({ status: 'pending_database' });
        return res.status(503).json({
          success: false,
          error: 'Failed to connect to database. Please check credentials.',
          code: 'CONNECTION_FAILED'
        });
      }

      // Get tenant DB connection
      tenantDb = await ConnectionManager.getStoreConnection(storeId);
    } else {
      // Auto-provision OAuth mode - create Supabase client for tenant DB operations
      console.log('🚀 Auto-provision OAuth mode - creating Supabase client for tenant');

      // We have projectUrl from OAuth, but might not have serviceRoleKey
      // For now, we can't create tenant records without serviceRoleKey
      // So migrations+seed must handle everything

      // If serviceRoleKey already provided (manual input), skip Management API fetch
      if (serviceRoleKey) {
        console.log('✅ serviceRoleKey provided manually - skipping Management API fetch');

        // Create Supabase client for tenant operations
        const { createClient } = require('@supabase/supabase-js');
        tenantDb = createClient(projectUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        console.log('✅ Tenant Supabase client created');

        // CRITICAL: Store credentials in store_databases table for ConnectionManager
        console.log('📝 Creating StoreDatabase record with manual serviceRoleKey...');
        const credentials = {
          projectUrl,
          serviceRoleKey,
          anonKey,
          connectionString: connectionString || null
        };

        storeDb = await StoreDatabase.createWithCredentials(
          storeId,
          'supabase',
          credentials
        );
        console.log('✅ StoreDatabase record created - ConnectionManager can now fetch tenant data');
      }
      // Option: Use Management API to fetch serviceRoleKey if not provided
      else if (oauthAccessToken && projectId) {
        try {
          console.log('🔍 serviceRoleKey not provided - attempting to fetch via Management API...');
          const axios = require('axios');

          // Try multiple endpoints to get service_role key
          let fetchedKey = null;

          // Attempt 1: /api-keys endpoint
          try {
            const keysResponse = await axios.get(
              `https://api.supabase.com/v1/projects/${projectId}/api-keys`,
              {
                headers: {
                  'Authorization': `Bearer ${oauthAccessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            console.log('API keys response:', keysResponse.data);

            if (Array.isArray(keysResponse.data)) {
              const serviceKey = keysResponse.data.find(k => k.name === 'service_role');
              fetchedKey = serviceKey?.api_key;
            } else if (keysResponse.data && keysResponse.data.service_role) {
              fetchedKey = keysResponse.data.service_role;
            }
          } catch (err1) {
            console.warn('Attempt 1 failed:', err1.response?.data || err1.message);
          }

          // Attempt 2: /settings endpoint
          if (!fetchedKey) {
            try {
              const settingsResponse = await axios.get(
                `https://api.supabase.com/v1/projects/${projectId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${oauthAccessToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );

              console.log('Project settings response:', settingsResponse.data);
              fetchedKey = settingsResponse.data?.service_api_keys?.service_role;
            } catch (err2) {
              console.warn('Attempt 2 failed:', err2.response?.data || err2.message);
            }
          }

          if (fetchedKey) {
            serviceRoleKey = fetchedKey;
            console.log('✅ serviceRoleKey fetched via Management API');

            // Create Supabase client for tenant operations
            const { createClient } = require('@supabase/supabase-js');
            tenantDb = createClient(projectUrl, serviceRoleKey, {
              auth: {
                persistSession: false,
                autoRefreshToken: false
              }
            });
            console.log('✅ Tenant Supabase client created');

            // CRITICAL: Store credentials in store_databases table for ConnectionManager
            console.log('📝 Creating StoreDatabase record for auto-provision mode...');
            const credentials = {
              projectUrl,
              serviceRoleKey,
              anonKey,
              connectionString: connectionString || null
            };

            storeDb = await StoreDatabase.createWithCredentials(
              storeId,
              'supabase',
              credentials
            );
            console.log('✅ StoreDatabase record created - ConnectionManager can now fetch tenant data');
          } else {
            console.error('❌ Could not fetch serviceRoleKey from any endpoint');
            console.log('   OAuth app needs "secrets:read" and "api_keys:read" scopes');

            // CRITICAL FIX: Create store_databases record anyway without serviceRoleKey
            // This ensures the connection shows as "active" in UI, user can add key later
            console.log('📝 Creating StoreDatabase record WITHOUT serviceRoleKey (will require manual configuration)...');
            const credentials = {
              projectUrl,
              serviceRoleKey: null,  // Will need to be configured manually
              anonKey,
              connectionString: connectionString || null
            };

            storeDb = await StoreDatabase.createWithCredentials(
              storeId,
              'supabase',
              credentials
            );
            console.log('✅ StoreDatabase record created - connection visible in UI, but needs service role key');
          }
        } catch (keyError) {
          console.error('⚠️ Error fetching serviceRoleKey:', keyError.message);

          // CRITICAL FIX: Create store_databases record anyway even on error
          console.log('📝 Creating StoreDatabase record after key fetch error (will require manual configuration)...');
          const credentials = {
            projectUrl,
            serviceRoleKey: null,  // Will need to be configured manually
            anonKey,
            connectionString: connectionString || null
          };

          storeDb = await StoreDatabase.createWithCredentials(
            storeId,
            'supabase',
            credentials
          );
          console.log('✅ StoreDatabase record created - connection visible in UI, but needs service role key');
        }
      }
    }

    // 4. Get user password hash from master DB
    console.log('🔍 Fetching user details from master DB for tenant provisioning...');
    const { data: masterUser, error: userError } = await masterDbClient
      .from('users')
      .select('password, first_name, last_name')
      .eq('id', req.user.id)
      .single();

    if (userError) {
      console.warn('⚠️ Could not fetch user from master DB:', userError.message);
    }

    console.log('✅ User data fetched:', {
      hasPassword: !!masterUser?.password,
      firstName: masterUser?.first_name,
      lastName: masterUser?.last_name
    });

    // 5. Provision tenant database (create tables, seed data)
    const provisioningResult = await TenantProvisioningService.provisionTenantDatabase(
      tenantDb,
      storeId,
      {
        userId: req.user.id,
        userEmail: req.user.email,
        userPasswordHash: masterUser?.password || null,
        userFirstName: masterUser?.first_name || req.user.first_name,
        userLastName: masterUser?.last_name || req.user.last_name,
        storeName: storeName || 'My Store',
        storeSlug: storeSlug || `store-${Date.now()}`,
        force: false,
        // OAuth credentials for API-based provisioning
        oauthAccessToken: oauthAccessToken || null,
        projectId: projectId || null,
        autoProvision: autoProvision || false,
        // Theme preset to apply to store settings
        themePreset: themePreset || 'default'
      }
    );

    console.log('provisioningResult', provisioningResult);


    if (!provisioningResult.success) {
      // Revert store status using Supabase client
      await masterDbClient
        .from('stores')
        .update({ status: 'pending_database', updated_at: new Date().toISOString() })
        .eq('id', storeId);

      console.log('masterDbClient storeId', storeId);
      console.log('masterDbClient', res);

      return res.status(500).json({
        success: false,
        error: 'Failed to provision tenant database',
        details: provisioningResult.errors
      });
    }

    // 5. Hostname mapping (skipped - using custom_domains table instead)
    console.log('⏭️ Skipping hostname mapping (using custom_domains table)');

    // Note: OAuth tokens are now stored in integration_configs in master DB
    // The supabase_oauth_tokens table in tenant DB is obsolete

    // 6. Activate store and save slug (use Supabase client)
    console.log('🎉 Activating store and saving slug...');
    const slug = storeSlug || `store-${Date.now()}`;
    const { error: activateError } = await masterDbClient
      .from('stores')
      .update({
        status: 'active',
        is_active: true,
        slug: slug,
        theme_preset: themePreset || 'default',  // Save selected theme preset
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    if (activateError) {
      console.error('❌ Failed to activate store:', activateError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to activate store'
      });
    }

    console.log('✅ Store activated successfully!');

    res.json({
      success: true,
      message: 'Database connected and store activated successfully!',
      data: {
        store: {
          id: storeId,
          status: 'active',
          is_active: true
        },
        provisioning: provisioningResult
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);

    // Revert store status (use Supabase client)
    try {
      await masterDbClient
        .from('stores')
        .update({ status: 'pending_database', updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      console.log('Store status reverted to pending_database');
    } catch (revertError) {
      console.error('Failed to revert store status:', revertError);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to connect database',
      details: error.message
    });
  }
});

/**
 * GET /api/stores/dropdown
 * Get stores for dropdown (simple format)
 * Includes both owned stores AND stores user is a team member of
 */
router.get('/dropdown', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { masterDbClient } = require('../database/masterConnection');

    // 1. Get stores owned by user
    const { data: ownedStores, error: ownedError } = await masterDbClient
      .from('stores')
      .select('id, user_id, slug, status, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ownedError) {
      throw new Error(ownedError.message);
    }

    // 2. Get stores where user is a team member (from store_teams in master DB)
    console.log('[Dropdown] Checking store_teams for user:', userId);
    const { data: teamMemberships, error: teamError } = await masterDbClient
      .from('store_teams')
      .select('store_id, role, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (teamError) {
      console.warn('[Dropdown] Error fetching team memberships:', teamError.message);
    }
    console.log('[Dropdown] Team memberships found:', teamMemberships?.length || 0, teamMemberships);

    // Get the store IDs where user is a team member (excluding owned stores)
    const ownedStoreIds = new Set((ownedStores || []).map(s => s.id));
    const teamStoreIds = (teamMemberships || [])
      .filter(m => !ownedStoreIds.has(m.store_id))
      .map(m => m.store_id);

    console.log('[Dropdown] Team store IDs (excluding owned):', teamStoreIds);

    // 3. Fetch team member stores details
    let teamStores = [];
    if (teamStoreIds.length > 0) {
      const { data: teamStoreData, error: teamStoreError } = await masterDbClient
        .from('stores')
        .select('id, user_id, slug, status, is_active, created_at, updated_at')
        .in('id', teamStoreIds);

      console.log('[Dropdown] Team stores query result:', teamStoreData, 'error:', teamStoreError);

      if (!teamStoreError && teamStoreData) {
        // Filter to only active stores
        teamStores = teamStoreData.filter(s => s.is_active && s.status === 'active');
        console.log('[Dropdown] Active team stores:', teamStores.length);
      }
    }

    // Create a map of team memberships for role lookup
    const teamRoleMap = {};
    (teamMemberships || []).forEach(m => {
      teamRoleMap[m.store_id] = m.role;
    });

    // Combine owned and team stores
    const stores = [
      ...(ownedStores || []).map(s => ({ ...s, membership_type: 'owner' })),
      ...teamStores.map(s => ({ ...s, membership_type: 'team_member', team_role: teamRoleMap[s.id] }))
    ];

    if (stores.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Try to fetch published status separately (in case column doesn't exist yet)
    let publishedMap = {};
    try {
      const storeIds = stores.map(s => s.id);
      const { data: publishedData } = await masterDbClient
        .from('stores')
        .select('id, published, published_at')
        .in('id', storeIds);

      if (publishedData) {
        publishedData.forEach(item => {
          publishedMap[item.id] = {
            published: item.published,
            published_at: item.published_at
          };
        });
      }
    } catch (pubError) {
      console.warn('⚠️ Published column not available yet (migration pending):', pubError.message);
      // Default all stores to published: false if column doesn't exist
    }

    // Fetch domain information from custom_domains_lookup
    let domainMap = {};
    try {
      const storeIds = stores.map(s => s.id);

      // Fetch ALL active verified domains for these stores
      const { data: allDomainData, error: allDomainError } = await masterDbClient
        .from('custom_domains_lookup')
        .select('store_id, domain, is_verified, is_active, ssl_status, is_primary')
        .in('store_id', storeIds)
        .eq('is_verified', true)
        .eq('is_active', true);

      if (allDomainError) {
        console.warn('⚠️ Error fetching domain data:', allDomainError.message);
      } else if (allDomainData) {
        // Group domains by store_id
        const domainsByStore = {};
        allDomainData.forEach(item => {
          if (!domainsByStore[item.store_id]) {
            domainsByStore[item.store_id] = [];
          }
          domainsByStore[item.store_id].push(item);
        });

        // For each store, determine domain status
        Object.entries(domainsByStore).forEach(([storeId, domains]) => {
          const primaryDomain = domains.find(d => d.is_primary);
          const activeDomainCount = domains.length;

          if (primaryDomain) {
            // Has a primary domain set
            const domainStatus = primaryDomain.ssl_status === 'active' ? 'active' : 'ssl_pending';
            domainMap[storeId] = {
              custom_domain: primaryDomain.domain,
              domain_status: domainStatus,
              has_domains_without_primary: false,
              active_domain_count: activeDomainCount
            };
          } else if (activeDomainCount > 0) {
            // Has active domains but no primary set
            domainMap[storeId] = {
              custom_domain: null,
              domain_status: 'needs_primary',
              has_domains_without_primary: true,
              active_domain_count: activeDomainCount
            };
          }
        });
      }
    } catch (domainErr) {
      console.warn('⚠️ Could not fetch domain information:', domainErr.message);
    }

    // Simple mapping - no tenant DB queries, just master DB data
    const enrichedStores = (stores || []).map((store) => {
      return {
        id: store.id,
        user_id: store.user_id,
        name: store.name || store.slug || 'Unnamed Store',
        slug: store.slug,
        status: store.status,
        is_active: store.is_active,
        published: publishedMap[store.id]?.published || false,
        published_at: publishedMap[store.id]?.published_at || null,
        created_at: store.created_at,
        updated_at: store.updated_at,
        // Domain info
        custom_domain: domainMap[store.id]?.custom_domain || null,
        domain_status: domainMap[store.id]?.domain_status || null,
        has_domains_without_primary: domainMap[store.id]?.has_domains_without_primary || false,
        active_domain_count: domainMap[store.id]?.active_domain_count || 0,
        // Membership info
        membership_type: store.membership_type || 'owner',
        team_role: store.team_role || null
      };
    });

    console.log(`[Dropdown] Returning ${enrichedStores.length} stores for user ${userId} (owned: ${(ownedStores || []).length}, team: ${teamStores.length})`);

    res.json({
      success: true,
      data: enrichedStores
    });
  } catch (error) {
    console.error('Get stores dropdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stores',
      details: error.message
    });
  }
});

/**
 * GET /api/stores
 * Get all stores for current user (owned + team member)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get owned stores
    const ownedStores = await MasterStore.findByUser(userId);

    // 2. Get stores where user is a team member (from master DB)
    const { data: teamMemberships, error: teamError } = await masterDbClient
      .from('store_teams')
      .select('store_id, role, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (teamError) {
      console.warn('Error fetching team memberships:', teamError.message);
    }

    // Get team member store IDs (excluding owned)
    const ownedStoreIds = new Set(ownedStores.map(s => s.id));
    const teamStoreIds = (teamMemberships || [])
      .filter(m => !ownedStoreIds.has(m.store_id))
      .map(m => m.store_id);

    // 3. Fetch team member stores
    let teamStores = [];
    if (teamStoreIds.length > 0) {
      const { data: teamStoreData } = await masterDbClient
        .from('stores')
        .select('id, status, is_active, created_at, slug, theme_preset')
        .in('id', teamStoreIds)
        .eq('is_active', true);

      teamStores = teamStoreData || [];
    }

    // Create role lookup map
    const teamRoleMap = {};
    (teamMemberships || []).forEach(m => {
      teamRoleMap[m.store_id] = m.role;
    });

    // Enrich with hostname info
    const enrichedStores = await Promise.all(
      [
        ...ownedStores.map(s => ({ ...s, membership_type: 'owner' })),
        ...teamStores.map(s => ({ ...s, membership_type: 'team_member', team_role: teamRoleMap[s.id] }))
      ].map(async (store) => {
        const hostnames = await StoreHostname.findByStore(store.id);
        const primaryHostname = hostnames.find(h => h.is_primary);

        return {
          id: store.id,
          status: store.status,
          is_active: store.is_active,
          created_at: store.created_at,
          hostname: primaryHostname?.hostname || null,
          slug: primaryHostname?.slug || store.slug || null,
          membership_type: store.membership_type,
          team_role: store.team_role || null,
          theme_preset: store.theme_preset || 'default'
        };
      })
    );

    res.json({
      success: true,
      data: {
        stores: enrichedStores,
        total: enrichedStores.length
      }
    });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stores'
    });
  }
});

/**
 * GET /api/stores/:id/health
 * Quick health check - just query tenant DB stores table
 * Returns healthy/empty status and updates store_databases.is_active accordingly
 */
router.get('/:id/health', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;
    console.log(`[Health] Checking health for store ${storeId}`);

    // Helper to mark store as unhealthy and remove db config
    const markStoreUnhealthy = async () => {
      try {
        // Update stores.status to pending_database
        const { error: storeError } = await masterDbClient
          .from('stores')
          .update({ status: 'pending_database', updated_at: new Date().toISOString() })
          .eq('id', storeId);

        if (storeError) {
          console.warn(`[Health] Failed to update stores.status for ${storeId}:`, storeError);
        } else {
          console.log(`[Health] Set stores.status=pending_database for store ${storeId}`);
        }

        // Delete store_databases row
        const { data, error } = await masterDbClient
          .from('store_databases')
          .delete()
          .eq('store_id', storeId)
          .select();

        if (error) {
          console.warn(`[Health] Delete store_databases error for ${storeId}:`, error);
        } else {
          console.log(`[Health] Deleted store_databases row for store ${storeId}:`, data);
        }

        // Clear connection cache
        ConnectionManager.clearCache(storeId);
      } catch (err) {
        console.warn(`[Health] Failed to mark store unhealthy for ${storeId}:`, err.message);
      }
    };

    // Quick check: try to query tenant DB stores table
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);
      const { data, error } = await tenantDb
        .from('stores')
        .select('id')
        .limit(1);

      console.log(`[Health] Store ${storeId} query result:`, {
        hasData: !!data,
        dataLength: data?.length,
        error: error ? { code: error.code, message: error.message } : null
      });

      // Check for table not found errors (table dropped)
      const tableNotFoundCodes = ['PGRST204', 'PGRST116', '42P01', '42501'];
      const isTableMissing = error && (
        tableNotFoundCodes.includes(error.code) ||
        error.message?.toLowerCase().includes('does not exist') ||
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('schema cache')
      );

      if (isTableMissing) {
        console.log(`[Health] Store ${storeId}: Table missing, marking unhealthy`);
        await markStoreUnhealthy();
        return res.json({
          success: true,
          data: {
            status: 'empty',
            message: 'Store database tables missing',
            actions: ['provision_database', 'remove_store']
          }
        });
      }

      // If query succeeds with no error and data is an array, DB is healthy
      if (!error && Array.isArray(data)) {
        return res.json({
          success: true,
          data: { status: 'healthy' }
        });
      }

      // Any other error - mark unhealthy
      console.log(`[Health] Store ${storeId}: Query failed, marking unhealthy`);
      await markStoreUnhealthy();
      return res.json({
        success: true,
        data: {
          status: 'empty',
          message: 'Store database needs provisioning',
          actions: ['provision_database', 'remove_store']
        }
      });
    } catch (connError) {
      // Connection failed - DB not configured or unreachable
      console.log(`[Health] Store ${storeId}: Connection failed:`, connError.message);
      await markStoreUnhealthy();
      return res.json({
        success: true,
        data: {
          status: 'empty',
          message: 'Database connection failed',
          actions: ['provision_database', 'remove_store']
        }
      });
    }
  } catch (error) {
    console.error('Store health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check store health',
      details: error.message
    });
  }
});

/**
 * POST /api/stores/:id/reprovision
 * Re-provision an empty/cleared tenant database
 * Used when the tenant DB was cleared but store still exists in master
 */
router.post('/:id/reprovision', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;
    const { storeName, storeSlug } = req.body;

    // Verify store exists in master DB
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('id, user_id, status, is_active, slug')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Check ownership
    if (store.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only store owner can reprovision the database'
      });
    }

    // Get user info for provisioning
    const { data: masterUser } = await masterDbClient
      .from('users')
      .select('password, first_name, last_name')
      .eq('id', req.user.id)
      .maybeSingle();

    // Get OAuth credentials for Management API provisioning
    let oauthAccessToken = null;
    let projectId = null;

    // First, get project URL from store_databases (master DB) - this always works
    try {
      const storeDb = await StoreDatabase.findByStoreId(storeId);
      if (storeDb && storeDb.host) {
        // Host format: xxx.supabase.co - extract project ID
        const hostMatch = storeDb.host.match(/([^.]+)\.supabase\.co/);
        if (hostMatch) {
          projectId = hostMatch[1];
          console.log('Found projectId from store_databases:', projectId);
        }
      }
    } catch (dbError) {
      console.log('Could not get project ID from store_databases:', dbError.message);
    }

    // Try to get OAuth token from integration_configs (tenant DB)
    // This may fail if tenant DB is empty, but we'll still have projectId
    try {
      const token = await SupabaseIntegration.getSupabaseToken(storeId);

      if (token && token.access_token) {
        // Check if token is expired
        if (SupabaseIntegration.isTokenExpired(token)) {
          // Try to refresh
          try {
            const refreshResult = await SupabaseIntegration.refreshAccessToken(storeId);
            oauthAccessToken = refreshResult.access_token;
          } catch (refreshError) {
            console.log('Token refresh failed:', refreshError.message);
          }
        } else {
          oauthAccessToken = token.access_token;
        }

        // Also extract project ID from project URL if we don't have it yet
        if (!projectId && token.project_url && !token.project_url.includes('pending-configuration')) {
          const projectMatch = token.project_url.match(/https:\/\/([^.]+)\.supabase\.co/);
          if (projectMatch) {
            projectId = projectMatch[1];
          }
        }
      }
    } catch (oauthError) {
      console.log('Could not get OAuth token from tenant DB (expected if tables dropped):', oauthError.message);
    }

    // If we still don't have OAuth token but have projectId, check Redis/memory for pending OAuth
    if (!oauthAccessToken && projectId) {
      try {
        const { getRedisClient } = require('../config/redis');
        const redisClient = getRedisClient();

        if (redisClient) {
          const redisKey = `oauth:pending:${storeId}`;
          const tokenDataStr = await redisClient.get(redisKey);
          if (tokenDataStr) {
            const tokenData = JSON.parse(tokenDataStr);
            oauthAccessToken = tokenData.access_token;
            console.log('Found OAuth token in Redis');
          }
        }

        // Check memory fallback
        if (!oauthAccessToken && global.pendingOAuthTokens && global.pendingOAuthTokens.has(storeId)) {
          const tokenData = global.pendingOAuthTokens.get(storeId);
          oauthAccessToken = tokenData.access_token;
          console.log('Found OAuth token in memory');
        }
      } catch (redisError) {
        console.log('Redis/memory check failed:', redisError.message);
      }
    }

    console.log('Reprovision OAuth credentials:', {
      hasAccessToken: !!oauthAccessToken,
      projectId: projectId || 'not found'
    });

    // Check if we have enough credentials for reprovisioning
    if (!oauthAccessToken && projectId) {
      // We have projectId but no OAuth token - token was lost when DB was cleared
      // User needs to reconnect Supabase to get a new access token
      return res.status(400).json({
        success: false,
        error: 'Supabase connection lost',
        message: 'The Supabase connection credentials were lost when the database was cleared. Please reconnect your Supabase account in Database Integrations to restore the connection, then try reprovisioning again.',
        requiresReconnection: true,
        redirectTo: '/admin/database-integrations'
      });
    }

    if (!projectId) {
      // No database configuration found
      return res.status(400).json({
        success: false,
        error: 'No database configured',
        message: 'No Supabase database is configured for this store. Please set up your database connection first.',
        redirectTo: '/admin/database-integrations'
      });
    }

    // Run re-provisioning
    const result = await TenantProvisioningService.reprovisionTenantDatabase(storeId, {
      userId: req.user.id,
      userEmail: req.user.email,
      userPasswordHash: masterUser?.password || null,
      userFirstName: masterUser?.first_name || req.user.first_name,
      userLastName: masterUser?.last_name || req.user.last_name,
      storeName: storeName || store.slug || 'My Store',
      storeSlug: storeSlug || store.slug || `store-${Date.now()}`,
      oauthAccessToken,
      projectId
    });

    if (result.success) {
      // Update store status to active if it wasn't
      if (store.status !== 'active' || !store.is_active) {
        await masterDbClient
          .from('stores')
          .update({
            status: 'active',
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', storeId);
      }

      // Clear connection cache
      ConnectionManager.clearCache(storeId);
    }

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Store reprovision error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reprovision store',
      details: error.message
    });
  }
});

/**
 * DELETE /api/stores/:id/permanent
 * Permanently delete store from master DB
 * Used when tenant DB is cleared and user wants to remove the store entirely
 */
router.delete('/:id/permanent', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;

    // Verify store exists and get user_id
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('id, user_id')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Check ownership
    if (store.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only store owner can permanently delete the store'
      });
    }

    // Delete related records first (store_databases, store_hostnames, etc.)
    await masterDbClient
      .from('store_databases')
      .delete()
      .eq('store_id', storeId);

    await masterDbClient
      .from('store_hostnames')
      .delete()
      .eq('store_id', storeId);

    await masterDbClient
      .from('custom_domains_lookup')
      .delete()
      .eq('store_id', storeId);

    await masterDbClient
      .from('store_teams')
      .delete()
      .eq('store_id', storeId);

    // Finally delete the store
    const { error: deleteError } = await masterDbClient
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Clear any cached connections
    ConnectionManager.clearCache(storeId);

    res.json({
      success: true,
      message: 'Store permanently deleted'
    });
  } catch (error) {
    console.error('Permanent delete store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to permanently delete store',
      details: error.message
    });
  }
});

/**
 * GET /api/stores/:id
 * Get store details (from master + tenant)
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;

    // Get from master DB using Supabase client
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Get hostname (skipped - using custom_domains instead)
    const primaryHostname = null;

    // Get connection info (skipped - causes Sequelize issues)
    const connectionInfo = null;

    // Get user credits (single source of truth: users.credits)
    let userCredits = null;
    try {
      const { data: user } = await masterDbClient
        .from('users')
        .select('credits')
        .eq('id', store.user_id)
        .maybeSingle();
      userCredits = user ? parseFloat(user.credits || 0) : 0;
    } catch (err) {
      console.warn('Could not fetch user credits:', err.message);
    }

    // Get tenant data if store is active
    let tenantStoreData = null;
    if (store.status === 'active' && store.is_active) {
      try {
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const { data } = await tenantDb
          .from('stores')
          .select('*')
          .limit(1)
          .single();

        tenantStoreData = data;
      } catch (error) {
        console.warn('Failed to get tenant store data:', error.message);
      }
    }

    res.json({
      success: true,
      data: {
        store: {
          id: store.id,
          status: store.status,
          is_active: store.is_active,
          published: store.published || false,
          published_at: store.published_at || null,
          slug: store.slug,
          created_at: store.created_at
        },
        hostname: primaryHostname?.hostname || null,
        slug: primaryHostname?.slug || null,
        connection: connectionInfo,
        credits: userCredits !== null ? {
          balance: userCredits
        } : null,
        tenantData: tenantStoreData
      }
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get store details'
    });
  }
});

/**
 * PATCH /api/stores/:id
 * Update store settings
 * - Master DB fields (published, status, etc.) update in master DB
 * - Other fields update in tenant DB
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;
    const updates = req.body;

    // Get store from master DB using Supabase client
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Separate master DB updates from tenant DB updates
    const masterDbFields = ['published', 'published_at', 'status', 'is_active', 'slug'];
    const masterUpdates = {};
    const tenantUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (masterDbFields.includes(key)) {
        masterUpdates[key] = value;
      } else {
        tenantUpdates[key] = value;
      }
    }

    let masterResult = null;
    let tenantResult = null;

    // Update master DB if there are master fields
    if (Object.keys(masterUpdates).length > 0) {
      masterUpdates.updated_at = new Date().toISOString();

      const { data: masterData, error: masterError } = await masterDbClient
        .from('stores')
        .update(masterUpdates)
        .eq('id', storeId)
        .select()
        .single();

      if (masterError) {
        throw new Error(`Master DB update failed: ${masterError.message}`);
      }

      masterResult = masterData;
      console.log('✅ Master DB updated:', Object.keys(masterUpdates));

      // Clear storefront bootstrap cache if published status changed
      if ('published' in masterUpdates) {
        try {
          const { deletePattern } = require('../utils/cacheManager');
          const deletedCount = await deletePattern(`bootstrap:${store.slug}:*`);
          console.log(`✅ Cleared ${deletedCount} bootstrap cache keys for store:`, store.slug);
        } catch (cacheError) {
          console.warn('⚠️ Failed to clear cache:', cacheError.message);
        }
      }
    }

    // Update tenant DB if there are tenant fields AND store is operational
    if (Object.keys(tenantUpdates).length > 0) {
      if (store.status !== 'active' || !store.is_active) {
        return res.status(400).json({
          success: false,
          error: 'Store is not operational - cannot update tenant settings'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const { data: tenantData, error: tenantError } = await tenantDb
        .from('stores')
        .update(tenantUpdates)
        .eq('id', storeId)
        .select()
        .single();

      if (tenantError) {
        throw new Error(`Tenant DB update failed: ${tenantError.message}`);
      }

      tenantResult = tenantData;
      console.log('✅ Tenant DB updated:', Object.keys(tenantUpdates));
    }

    res.json({
      success: true,
      message: 'Store updated successfully',
      data: {
        master: masterResult,
        tenant: tenantResult
      }
    });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update store',
      details: error.message
    });
  }
});

/**
 * PUT /api/stores/:id
 * Update store settings - alias for PATCH
 * - Master DB fields (published, status, etc.) update in master DB
 * - Other fields update in tenant DB
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;
    const updates = req.body;

    // Get store from master DB using Supabase client
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Separate master DB updates from tenant DB updates
    const masterDbFields = ['published', 'published_at', 'status', 'is_active', 'slug'];
    const masterUpdates = {};
    const tenantUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (masterDbFields.includes(key)) {
        masterUpdates[key] = value;
      } else {
        tenantUpdates[key] = value;
      }
    }

    let masterResult = null;
    let tenantResult = null;

    // Update master DB if there are master fields
    if (Object.keys(masterUpdates).length > 0) {
      masterUpdates.updated_at = new Date().toISOString();

      const { data: masterData, error: masterError } = await masterDbClient
        .from('stores')
        .update(masterUpdates)
        .eq('id', storeId)
        .select()
        .single();

      if (masterError) {
        throw new Error(`Master DB update failed: ${masterError.message}`);
      }

      masterResult = masterData;
      console.log('✅ Master DB updated:', Object.keys(masterUpdates));

      // Clear storefront bootstrap cache if published status changed
      if ('published' in masterUpdates) {
        try {
          const { deletePattern } = require('../utils/cacheManager');
          const deletedCount = await deletePattern(`bootstrap:${store.slug}:*`);
          console.log(`✅ Cleared ${deletedCount} bootstrap cache keys for store:`, store.slug);
        } catch (cacheError) {
          console.warn('⚠️ Failed to clear cache:', cacheError.message);
        }
      }
    }

    // Update tenant DB if there are tenant fields AND store is operational
    if (Object.keys(tenantUpdates).length > 0) {
      if (store.status !== 'active' || !store.is_active) {
        return res.status(400).json({
          success: false,
          error: 'Store is not operational - cannot update tenant settings'
        });
      }

      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      const { data: tenantData, error: tenantError } = await tenantDb
        .from('stores')
        .update(tenantUpdates)
        .eq('id', storeId)
        .select()
        .single();

      if (tenantError) {
        throw new Error(`Tenant DB update failed: ${tenantError.message}`);
      }

      tenantResult = tenantData;
      console.log('✅ Tenant DB updated:', Object.keys(tenantUpdates));
    }

    res.json({
      success: true,
      message: 'Store updated successfully',
      data: {
        master: masterResult,
        tenant: tenantResult
      }
    });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update store',
      details: error.message
    });
  }
});

/**
 * GET /api/stores/:id/settings
 * Get store settings (from tenant DB)
 */
router.get('/:id/settings', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;

    // Get store from master DB using Supabase client
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    // Check if store is operational (status='active' and is_active=true)
    if (storeError || !store || store.status !== 'active' || !store.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Store is not operational'
      });
    }

    // Get settings from tenant DB
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Get store settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get store settings'
    });
  }
});

/**
 * PUT /api/stores/:id/settings
 * Update store settings (in tenant DB)
 */
router.put('/:id/settings', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;
    const updates = req.body;

    console.log('🐛 PUT /api/stores/:id/settings DEBUG:', {
      storeId,
      body: updates,
      hasSettings: !!updates.settings,
      settingsKeys: updates.settings ? Object.keys(updates.settings) : []
    });

    // Get store from master DB using Supabase client
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    // Check if store is operational (status='active' and is_active=true)
    if (storeError || !store || store.status !== 'active' || !store.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Store is not operational'
      });
    }

    // Get current store data from tenant DB
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: currentStore, error: fetchError } = await tenantDb
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Merge settings if provided
    let finalUpdates = { ...updates };
    if (updates.settings) {
      const currentSettings = currentStore.settings || {};
      const incomingSettings = updates.settings || {};
      finalUpdates.settings = {
        ...currentSettings,
        ...incomingSettings
      };
      console.log('🔄 Merged settings:', finalUpdates.settings);
    }

    // Update in tenant DB
    const { data, error } = await tenantDb
      .from('stores')
      .update(finalUpdates)
      .eq('id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    console.log('✅ Store settings updated successfully');

    // Clear Redis bootstrap cache so storefront gets fresh settings
    try {
      const { deletePattern } = require('../utils/cacheManager');
      const deletedCount = await deletePattern(`bootstrap:${store.slug}:*`);
      console.log(`✅ Cleared ${deletedCount} bootstrap cache keys for store:`, store.slug);
    } catch (cacheError) {
      console.warn('⚠️ Failed to clear bootstrap cache:', cacheError.message);
    }

    res.json({
      success: true,
      message: 'Store settings updated successfully',
      data: data,
      settings: data.settings
    });
  } catch (error) {
    console.error('Update store settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update store settings',
      message: error.message
    });
  }
});

/**
 * POST /api/stores/:id/apply-theme-preset
 * Apply a theme preset to the store (fetches colors from master and saves to tenant)
 */
router.post('/:id/apply-theme-preset', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;
    const { presetName } = req.body;

    if (!presetName) {
      return res.status(400).json({
        success: false,
        error: 'presetName is required'
      });
    }

    console.log(`🎨 Applying theme preset "${presetName}" to store ${storeId}`);

    // Get store from master DB
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store || store.status !== 'active' || !store.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Store is not operational'
      });
    }

    // Fetch theme preset from master theme_defaults table
    const { data: preset, error: presetError } = await masterDbClient
      .from('theme_defaults')
      .select('theme_settings, preset_name, display_name')
      .eq('preset_name', presetName)
      .eq('is_active', true)
      .maybeSingle();

    if (presetError || !preset) {
      return res.status(404).json({
        success: false,
        error: `Theme preset "${presetName}" not found`
      });
    }

    console.log(`📦 Found preset "${preset.display_name}" with ${Object.keys(preset.theme_settings || {}).length} theme settings`);

    // Get tenant DB connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current store data from tenant DB
    const { data: currentStore, error: fetchError } = await tenantDb
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Merge preset theme settings into store settings
    const currentSettings = currentStore.settings || {};
    const themeSettings = preset.theme_settings || {};

    // Extract pagination settings from theme_settings if present
    const paginationSettings = {
      buttonBgColor: themeSettings.pagination_button_bg_color,
      buttonTextColor: themeSettings.pagination_button_text_color,
      buttonHoverBgColor: themeSettings.pagination_button_hover_bg_color,
      buttonBorderColor: themeSettings.pagination_button_border_color,
      activeBgColor: themeSettings.pagination_active_bg_color,
      activeTextColor: themeSettings.pagination_active_text_color
    };

    const updatedSettings = {
      ...currentSettings,
      theme_preset: presetName,  // Store preset name in tenant settings
      theme: {
        ...(currentSettings.theme || {}),
        ...themeSettings  // Apply all preset colors
      },
      // Apply pagination settings if present in preset
      ...(themeSettings.pagination_active_bg_color && {
        pagination: {
          ...(currentSettings.pagination || {}),
          ...paginationSettings
        }
      })
    };

    // Update in tenant DB
    const { data: updatedStore, error: updateError } = await tenantDb
      .from('stores')
      .update({ settings: updatedSettings })
      .eq('id', storeId)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Update theme_preset reference in master stores table
    await masterDbClient
      .from('stores')
      .update({
        theme_preset: presetName,
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    console.log(`✅ Theme preset "${presetName}" applied successfully to store ${storeId}`);

    // Clear Redis bootstrap cache
    try {
      const { deletePattern } = require('../utils/cacheManager');
      const deletedCount = await deletePattern(`bootstrap:${store.slug}:*`);
      console.log(`✅ Cleared ${deletedCount} bootstrap cache keys for store:`, store.slug);
    } catch (cacheError) {
      console.warn('⚠️ Failed to clear bootstrap cache:', cacheError.message);
    }

    res.json({
      success: true,
      message: `Theme preset "${preset.display_name}" applied successfully`,
      data: {
        store_id: storeId,
        preset_name: presetName,
        theme_settings: preset.theme_settings
      }
    });
  } catch (error) {
    console.error('Apply theme preset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply theme preset',
      message: error.message
    });
  }
});

/**
 * DELETE /api/stores/:id
 * Delete store (soft delete - suspend)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const storeId = req.params.id;

    // Get store from master DB using Supabase client
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Soft delete - suspend the store
    const { error: suspendError } = await masterDbClient
      .from('stores')
      .update({
        status: 'suspended',
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    if (suspendError) {
      throw new Error(suspendError.message);
    }

    res.json({
      success: true,
      message: 'Store suspended successfully'
    });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete store'
    });
  }
});

module.exports = router;
