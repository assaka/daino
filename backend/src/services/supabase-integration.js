const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const ConnectionManager = require('./database/ConnectionManager');
const IntegrationConfig = require('../models/IntegrationConfig');
const IntegrationToken = require('../models/master/IntegrationToken');

/**
 * Supabase Integration Service
 * Handles Supabase OAuth authentication and API integration
 *
 * Configuration stored in integration_configs table with integration_type='supabase-oauth'
 * Project keys stored with integration_type='supabase-keys' and config_key=projectId
 */
class SupabaseIntegration {
  constructor() {
    // Trim whitespace from env vars (common issue with copy/paste)
    this.clientId = (process.env.SUPABASE_OAUTH_CLIENT_ID || 'pending_configuration').trim();
    this.clientSecret = (process.env.SUPABASE_OAUTH_CLIENT_SECRET || 'pending_configuration').trim();
    this.redirectUri = process.env.SUPABASE_OAUTH_REDIRECT_URI ||
                      `${process.env.BACKEND_URL || 'https://backend.dainostore.com'}/api/supabase/callback`;
    this.authorizationBaseUrl = 'https://api.supabase.com/v1/oauth/authorize';
    this.tokenUrl = 'https://api.supabase.com/v1/oauth/token';

    // Debug: Log what env vars we're receiving
    console.log('[SUPABASE_INIT] Environment check:', {
      hasClientId: !!process.env.SUPABASE_OAUTH_CLIENT_ID,
      clientIdLength: process.env.SUPABASE_OAUTH_CLIENT_ID?.length || 0,
      clientIdPreview: this.clientId.substring(0, 8) + '...',
      hasClientSecret: !!process.env.SUPABASE_OAUTH_CLIENT_SECRET,
      clientSecretLength: process.env.SUPABASE_OAUTH_CLIENT_SECRET?.length || 0
    });

    // Check if OAuth is properly configured
    this.oauthConfigured = this.clientId !== 'pending_configuration' &&
                           this.clientSecret !== 'pending_configuration';

    // Validate UUID format for client_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (this.oauthConfigured && !uuidRegex.test(this.clientId)) {
      console.error(`⚠️ [SUPABASE] SUPABASE_OAUTH_CLIENT_ID is not a valid UUID format!`);
      console.error(`   Value: "${this.clientId.substring(0, 8)}..." (length: ${this.clientId.length})`);
      console.error(`   Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
      this.oauthConfigured = false;
    }

    this.integrationType = 'supabase-oauth';
    this.keysIntegrationType = 'supabase-keys';
  }

  /**
   * Get Supabase OAuth token from integration_configs
   * Returns data in legacy format for compatibility
   */
  async getSupabaseToken(storeId) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

      if (!config || !config.config_data) {
        return null;
      }

      // Return in legacy format for compatibility
      // Note: IntegrationConfig already decrypts sensitive fields
      return {
        id: config.id,
        store_id: storeId,
        access_token: config.config_data.accessToken,
        refresh_token: config.config_data.refreshToken,
        expires_at: config.token_expires_at || config.config_data.expiresAt,
        project_url: config.config_data.projectUrl,
        service_role_key: config.config_data.serviceRoleKey,
        database_url: config.config_data.databaseUrl,
        storage_url: config.config_data.storageUrl,
        auth_url: config.config_data.authUrl,
        created_at: config.created_at,
        updated_at: config.updated_at
      };
    } catch (error) {
      console.error('[getSupabaseToken] Error:', error);
      return null;
    }
  }

  /**
   * Update Supabase OAuth token in integration_configs
   */
  async updateSupabaseToken(storeId, updates) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

      if (!config) {
        throw new Error('Supabase not configured for this store');
      }

      // Map legacy field names to new format
      const configData = { ...config.config_data };

      if (updates.access_token !== undefined) {
        configData.accessToken = updates.access_token;
      }
      if (updates.refresh_token !== undefined) {
        configData.refreshToken = updates.refresh_token;
      }
      if (updates.service_role_key !== undefined) {
        configData.serviceRoleKey = updates.service_role_key;
      }
      if (updates.project_url !== undefined) {
        configData.projectUrl = updates.project_url;
      }
      if (updates.database_url !== undefined) {
        configData.databaseUrl = updates.database_url;
      }
      if (updates.storage_url !== undefined) {
        configData.storageUrl = updates.storage_url;
      }
      if (updates.auth_url !== undefined) {
        configData.authUrl = updates.auth_url;
      }
      if (updates.anon_key !== undefined) {
        // No longer used but keep for compatibility
        configData.anonKey = updates.anon_key;
      }

      // Handle token expiration
      const tokenExpiresAt = updates.expires_at ? new Date(updates.expires_at) : config.token_expires_at;

      await IntegrationConfig.createOrUpdate(storeId, this.integrationType, configData);

      // Update token expiration if provided
      if (updates.expires_at) {
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        await tenantDb
          .from('integration_configs')
          .update({ token_expires_at: tokenExpiresAt, updated_at: new Date() })
          .eq('store_id', storeId)
          .eq('integration_type', this.integrationType);

        // Sync token expiry to master DB for efficient cron-based refresh
        try {
          await IntegrationToken.upsertToken(storeId, this.integrationType, {
            token_expires_at: tokenExpiresAt
          });
        } catch (syncError) {
          console.warn('[updateSupabaseToken] Failed to sync token expiry to master DB:', syncError.message);
          // Don't fail the main operation if master sync fails
        }
      }

      return true;
    } catch (error) {
      console.error('[updateSupabaseToken] Error:', error);
      throw error;
    }
  }

  /**
   * Delete Supabase OAuth token (deactivate integration)
   */
  async deleteSupabaseToken(storeId) {
    try {
      await IntegrationConfig.deactivate(storeId, this.integrationType);

      // Remove token tracking from master DB
      try {
        await IntegrationToken.deleteToken(storeId, this.integrationType);
      } catch (syncError) {
        console.warn('[deleteSupabaseToken] Failed to remove token from master DB:', syncError.message);
        // Don't fail the main operation if master sync fails
      }

      return true;
    } catch (error) {
      console.error('[deleteSupabaseToken] Error:', error);
      throw error;
    }
  }

  /**
   * Update Supabase config in integration_configs
   */
  async updateSupabaseConfig(storeId, updates) {
    try {
      const config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
      const configData = { ...(config?.config_data || {}) };

      if (updates.access_token !== undefined) {
        configData.accessToken = updates.access_token;
      }
      if (updates.refresh_token !== undefined) {
        configData.refreshToken = updates.refresh_token;
      }
      if (updates.service_role_key !== undefined) {
        configData.serviceRoleKey = updates.service_role_key;
      }
      if (updates.expires_at !== undefined) {
        configData.expiresAt = updates.expires_at;
      }
      if (updates.project_url !== undefined) {
        configData.projectUrl = updates.project_url;
      }
      if (updates.database_url !== undefined) {
        configData.databaseUrl = updates.database_url;
      }
      if (updates.storage_url !== undefined) {
        configData.storageUrl = updates.storage_url;
      }
      if (updates.auth_url !== undefined) {
        configData.authUrl = updates.auth_url;
      }
      if (updates.userEmail !== undefined) {
        configData.userEmail = updates.userEmail;
      }
      if (updates.connected !== undefined) {
        configData.connected = updates.connected;
      }

      await IntegrationConfig.createOrUpdate(storeId, this.integrationType, configData);

      return true;
    } catch (error) {
      console.error('[updateSupabaseConfig] Error:', error);
      throw error;
    }
  }

  /**
   * Check if OAuth token is expired
   */
  isTokenExpired(config) {
    if (!config || !config.expires_at) return true;
    return new Date(config.expires_at) <= new Date();
  }

  /**
   * Check if OAuth token is expiring soon (within 10 minutes)
   * Used for proactive refresh before actual expiry
   */
  isTokenExpiringSoon(config) {
    if (!config || !config.expires_at) return true;
    const expiresAt = new Date(config.expires_at);
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
    return expiresAt <= tenMinutesFromNow;
  }

  /**
   * Proactively refresh token if expired or expiring soon
   * Returns refreshed token or original if still valid
   */
  async ensureValidToken(storeId) {
    const token = await this.getSupabaseToken(storeId);
    if (!token) return null;

    if (this.isTokenExpiringSoon(token)) {
      console.log('Token expired or expiring soon, proactively refreshing...');
      try {
        const refreshResult = await this.refreshToken(storeId);
        if (refreshResult.success) {
          console.log('Proactive token refresh successful');
          // Return updated token
          return await this.getSupabaseToken(storeId);
        }
      } catch (error) {
        console.error('Proactive token refresh failed:', error.message);
        // Return original token, let the caller handle the failure
      }
    }
    return token;
  }

  /**
   * Generate OAuth authorization URL for Supabase
   */
  getAuthorizationUrl(storeId, state) {
    if (!this.oauthConfigured) {
      throw new Error('Supabase OAuth is not configured. Please add SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET environment variables.');
    }
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'email profile projects:read projects:write secrets:read storage:read storage:write database:read database:write',
      state: JSON.stringify({ storeId, state })
    });

    return `${this.authorizationBaseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, storeId) {
    let user = null; // Define user in outer scope
    let access_token = null; // Define in outer scope for error handling
    let refresh_token = null; // Define in outer scope for error handling
    let projectData = {}; // Define in outer scope for error handling
    
    try {
      console.log('Exchanging code for token:', {
        code: code.substring(0, 10) + '...',
        storeId,
        clientId: this.clientId,
        redirectUri: this.redirectUri
      });

      // Use form-urlencoded for OAuth token exchange (standard OAuth2 format)
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      });

      const response = await axios.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('Token exchange response:', JSON.stringify(response.data, null, 2));

      // Assign to outer scope variables
      access_token = response.data.access_token;
      refresh_token = response.data.refresh_token;
      const expires_in = response.data.expires_in;
      const token_type = response.data.token_type;
      
      user = response.data.user; // Assign user from response

      if (!access_token || !refresh_token) {
        throw new Error('Invalid token response from Supabase');
      }

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

      // Get user's projects using the access token
      // projectData already defined in outer scope
      try {
        // Fetch user's projects
        const projectsResponse = await axios.get('https://api.supabase.com/v1/projects', {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Projects response:', JSON.stringify(projectsResponse.data, null, 2));
        
        // Use the first project or let user select later
        if (projectsResponse.data && projectsResponse.data.length > 0) {
          const allProjects = projectsResponse.data;
          console.log(`Found ${allProjects.length} project(s) for user`);
          
          // Use the first project as default
          const firstProject = allProjects[0];
          // Use ref for URLs (not id) - ref is the project reference used in Supabase URLs
          const projectRef = firstProject.ref || firstProject.id;
          const projectId = firstProject.id;
          console.log('Using first project as default:', firstProject.name, 'ref:', projectRef, 'id:', projectId);

          // Fetch service role key for the project
          let serviceRoleKey = '';

          try {
            // Try the simpler /api-keys endpoint first (same as media storage OAuth)
            console.log('Fetching API keys from /api-keys endpoint...');
            const apiKeysResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
              }
            });

            console.log('API keys response received, extracting service_role key...');

            // Extract service_role key from response
            if (apiKeysResponse.data && Array.isArray(apiKeysResponse.data)) {
              const serviceKeyObj = apiKeysResponse.data.find(key => key.name === 'service_role' || key.name === 'service_role_key');
              serviceRoleKey = serviceKeyObj?.api_key || '';
            } else if (apiKeysResponse.data) {
              serviceRoleKey = apiKeysResponse.data.service_role || apiKeysResponse.data.service_role_key || '';
            }

            console.log('Extracted service role key:', serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'not found');

          } catch (apiKeysError) {
            console.error('Error fetching API keys from /api-keys:', apiKeysError.response?.data || apiKeysError.message);

            // Try the secrets endpoint as fallback
            try {
              console.log('Trying /config/secrets/project-api-keys endpoint as fallback...');
              const secretsResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}/config/secrets/project-api-keys`, {
                headers: {
                  'Authorization': `Bearer ${access_token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (secretsResponse.data && Array.isArray(secretsResponse.data)) {
                const serviceKeyObj = secretsResponse.data.find(key => key.name === 'service_role' || key.name === 'service_role_key');
                serviceRoleKey = serviceKeyObj?.api_key || '';
              }
              console.log('Fallback extracted service role key:', serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'not found');
            } catch (fallbackError) {
              console.error('Fallback API keys fetch also failed:', fallbackError.response?.data || fallbackError.message);
              serviceRoleKey = null;
            }
          }

          projectData = {
            project_url: `https://${projectRef}.supabase.co`,
            anon_key: null,  // No longer used,
            service_role_key: serviceRoleKey || null,
            database_url: `postgresql://postgres.[projectRef]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`,
            storage_url: `https://${projectRef}.supabase.co/storage/v1`,
            auth_url: `https://${projectRef}.supabase.co/auth/v1`
          };
        }
      } catch (projectError) {
        console.error('Error fetching projects:', projectError.response?.data || projectError.message);
        
        // Check if it's a scope error (403) vs other errors
        if (projectError.response?.status === 403 || projectError.message?.includes('scope')) {
          console.log('OAuth token lacks required scopes for project access');
          // Set pending values that will pass validation
          projectData = {
            project_url: 'https://pending-configuration.supabase.co',
            anon_key: null,  // No longer used,
            service_role_key: null,
            database_url: null,  // Use null for optional fields
            storage_url: null,
            auth_url: null
          };
        } else {
          // For other errors, still try to save with pending values
          projectData = {
            project_url: 'https://pending-configuration.supabase.co',
            anon_key: null,  // No longer used,
            service_role_key: null,
            database_url: null,
            storage_url: null,
            auth_url: null
          };
        }
      }

      // Save token to database
      const tokenData = {
        access_token,
        refresh_token,
        expires_at: expiresAt,
        ...projectData
      };

      console.log('Saving token data to database:', {
        storeId,
        project_url: tokenData.project_url,
        service_role_key: tokenData.service_role_key ? 'set' : 'not set',
        has_access_token: !!tokenData.access_token,
        has_refresh_token: !!tokenData.refresh_token,
        expires_at: tokenData.expires_at
      });

      // Check if this database is already being used by another store
      console.log('========================================');
      console.log('🔍 DUPLICATE DATABASE CHECK IN OAUTH');
      console.log('========================================');
      console.log('   project_url:', tokenData.project_url);
      console.log('   storeId:', storeId);

      const { masterDbClient } = require('../database/masterConnection');

      // Skip check for placeholder URLs
      const isPlaceholder = tokenData.project_url && (
        tokenData.project_url.includes('pending-configuration') ||
        tokenData.project_url === 'Configuration pending'
      );

      console.log('   isPlaceholder:', isPlaceholder);

      if (!isPlaceholder && tokenData.project_url) {
        try {
          const projectUrl = new URL(tokenData.project_url);
          const host = projectUrl.hostname;

          console.log('   Checking host:', host);

          const { data: existingDb, error: checkError } = await masterDbClient
            .from('store_databases')
            .select('store_id, host, is_active')
            .eq('host', host)
            .eq('is_active', true)
            .maybeSingle();

          console.log('   Query result:', existingDb);
          console.log('   Query error:', checkError);

          if (!checkError && existingDb && existingDb.store_id !== storeId) {
            console.error('❌ Database already in use by another store:', existingDb.store_id);
            const duplicateError = new Error('This Supabase database is already connected to another store. Please use a different Supabase project.');
            duplicateError.isDuplicateDatabase = true;
            throw duplicateError;
          }

          console.log('✅ Database URL is available');
        } catch (checkErr) {
          console.log('🔍 Caught error in duplicate check:');
          console.log('   Error message:', checkErr.message);
          console.log('   Has isDuplicateDatabase flag:', !!checkErr.isDuplicateDatabase);
          console.log('   Message includes "already connected":', checkErr.message?.includes('already connected'));

          // If it's our duplicate error, re-throw it
          if (checkErr.isDuplicateDatabase || checkErr.message?.includes('already connected') || checkErr.message?.includes('already being used')) {
            console.error('🚫 RE-THROWING DUPLICATE DATABASE ERROR TO CALLER');
            throw checkErr;
          }
          // Otherwise log and continue (don't block OAuth on check errors)
          console.error('⚠️ Non-duplicate error - continuing with OAuth:', checkErr.message);
        }
      } else {
        console.log('⏭️ Skipping duplicate check - isPlaceholder or no project_url');
      }

      // STEP 1: ALWAYS store in Redis (persists across server restarts)
      const tokenDataToStore = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        project_url: tokenData.project_url || 'https://pending-configuration.supabase.co',
        anon_key: null,
        service_role_key: tokenData.service_role_key || null,
        database_url: tokenData.database_url || null,
        storage_url: tokenData.storage_url || null,
        auth_url: tokenData.auth_url || null
      };

      try {
        const { getRedisClient } = require('../config/redis');
        const redisClient = getRedisClient();

        if (redisClient) {
          const redisKey = `oauth:pending:${storeId}`;
          await redisClient.setEx(
            redisKey,
            600, // Expire after 10 minutes
            JSON.stringify(tokenDataToStore)
          );
          console.log('✅ OAuth tokens stored in Redis');
          console.log('🔑 Redis key:', redisKey);
        } else {
          console.warn('⚠️ Redis not available, using memory fallback');
          if (!global.pendingOAuthTokens) {
            global.pendingOAuthTokens = new Map();
          }
          global.pendingOAuthTokens.set(storeId, tokenDataToStore);
          console.log('✅ OAuth tokens stored in memory (fallback)');
        }
      } catch (redisError) {
        console.error('❌ Redis error, using memory fallback:', redisError.message);
        if (!global.pendingOAuthTokens) {
          global.pendingOAuthTokens = new Map();
        }
        global.pendingOAuthTokens.set(storeId, tokenDataToStore);
        console.log('✅ OAuth tokens stored in memory (fallback)');
      }

      return { 
        success: true, 
        project: {
          url: projectData.project_url || 'Configuration pending'
        },
        user
      };
    } catch (error) {
      console.error('Error exchanging code for token:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      // If it's our duplicate database error, store it and re-throw
      if (error.isDuplicateDatabase || error.message?.includes('already connected')) {
        console.error('🚫 Re-throwing duplicate database error from outer catch');

        // Store error in Redis/memory for frontend to retrieve
        try {
          const { getRedisClient } = require('../config/redis');
          const redisClient = getRedisClient();

          if (redisClient) {
            await redisClient.setEx(`oauth:error:${storeId}`, 60, error.message);
            console.log('✅ Stored OAuth error in Redis');
          } else {
            if (!global.oauthErrors) {
              global.oauthErrors = new Map();
            }
            global.oauthErrors.set(storeId, { message: error.message, timestamp: Date.now() });
            console.log('✅ Stored OAuth error in memory');
          }
        } catch (storeErr) {
          console.error('⚠️ Failed to store OAuth error:', storeErr.message);
        }

        throw error;
      }

      // More specific error messages
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors?.map(e => `${e.path}: ${e.message}`).join(', ') || 'Unknown validation error';
        console.error('Sequelize validation error details:', error.errors);

        // Check if we have the access token (connection actually succeeded)
        if (access_token && refresh_token) {
          console.log('Connection successful despite validation warning - returning success with limited scope');
          // Return success with limited scope since we have valid tokens
          return {
            success: true,
            project: {
              url: projectData?.project_url || 'https://pending-configuration.supabase.co'
            },
            user: user || { email: 'Connected' },
            limitedScope: true,
            message: 'Connected with limited permissions. Some features may be restricted.'
          };
        }

        // Only throw error if we don't have valid tokens
        throw new Error(`Unable to save connection details. Please try reconnecting.`);
      } else if (error.response?.status === 400) {
        throw new Error('Invalid OAuth request: ' + (error.response?.data?.error_description || error.response?.data?.error || 'Bad request'));
      } else if (error.response?.status === 401) {
        throw new Error('Invalid OAuth credentials: ' + (error.response?.data?.error_description || 'Unauthorized'));
      } else {
        throw new Error('Failed to connect to Supabase: ' + (error.response?.data?.error || error.message));
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(storeId) {
    try {
      // Check if OAuth is configured
      if (!this.oauthConfigured) {
        throw new Error('Supabase OAuth not configured - set SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET');
      }

      const token = await this.getSupabaseToken(storeId);
      console.log('[SUPABASE_REFRESH] Token data from store:', {
        storeId,
        tokenFound: !!token,
        hasAccessToken: !!token?.access_token,
        hasRefreshToken: !!token?.refresh_token,
        refreshTokenPreview: token?.refresh_token ? token.refresh_token.substring(0, 20) + '...' : null,
        expiresAt: token?.expires_at
      });

      if (!token) {
        throw new Error('No Supabase token found for this store');
      }

      if (!token.refresh_token) {
        throw new Error('No refresh_token found in stored token data');
      }

      // Debug logging
      console.log('[SUPABASE_REFRESH] Attempting token refresh:', {
        storeId,
        clientId: this.clientId.substring(0, 8) + '...',
        clientIdLength: this.clientId.length,
        hasRefreshToken: !!token.refresh_token,
        refreshTokenLength: token.refresh_token?.length,
        tokenUrl: this.tokenUrl
      });

      // Use form-urlencoded for OAuth token refresh (standard OAuth2 format)
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await axios.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const expires_at = new Date(Date.now() + expires_in * 1000);

      // Update token in tenant database (also syncs to master DB)
      await this.updateSupabaseToken(storeId, {
        access_token,
        refresh_token: refresh_token || token.refresh_token,
        expires_at
      });

      // Visual confirmation logging
      console.log('═'.repeat(60));
      console.log('✅ SUPABASE TOKEN REFRESH SUCCESSFUL');
      console.log('═'.repeat(60));
      console.log(`   Store ID:      ${storeId}`);
      console.log(`   Old Expiry:    ${token.expires_at || 'unknown'}`);
      console.log(`   New Expiry:    ${expires_at.toISOString()}`);
      console.log(`   Expires In:    ${expires_in} seconds (${Math.round(expires_in/60)} minutes)`);
      console.log(`   Refresh Time:  ${new Date().toISOString()}`);
      console.log('═'.repeat(60));

      return { success: true, access_token, expires_at, expires_in };
    } catch (error) {
      // Visual failure logging
      console.log('═'.repeat(60));
      console.log('❌ SUPABASE TOKEN REFRESH FAILED');
      console.log('═'.repeat(60));
      console.log(`   Store ID:      ${storeId}`);
      console.log(`   Error Status:  ${error.response?.status || 'N/A'}`);
      console.log(`   Error Message: ${error.response?.data?.message || error.response?.data?.error || error.message}`);
      console.log(`   Attempt Time:  ${new Date().toISOString()}`);
      console.log('═'.repeat(60));

      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error_description ||
                          error.response?.data?.error ||
                          error.message;
      throw new Error('Failed to refresh Supabase token: ' + errorMessage);
    }
  }

  /**
   * Alias for refreshAccessToken - provides consistent naming
   */
  async refreshToken(storeId) {
    return this.refreshAccessToken(storeId);
  }

  /**
   * Get valid access token (refresh if expired)
   */
  async getValidToken(storeId) {
    const token = await this.getSupabaseToken(storeId);
    if (!token) {
      throw new Error('Supabase not connected for this store');
    }

    // Check if token is expired
    if (this.isTokenExpired(token)) {
      const refreshResult = await this.refreshAccessToken(storeId);
      return refreshResult.access_token;
    }

    return token.access_token;
  }

  /**
   * Get Supabase client for a store (using service role key)
   * Since we're removing anon key dependency, this now uses service role key
   */
  async getSupabaseClient(storeId) {
    // Just redirect to admin client since we only use service role key now
    return this.getSupabaseAdminClient(storeId);
  }

  /**
   * Get Supabase admin client (with service role key)
   */
  async getSupabaseAdminClient(storeId) {
    const token = await this.getSupabaseToken(storeId);
    if (!token) {
      throw new Error('Supabase not connected for this store');
    }

    if (!token.project_url || token.project_url === 'pending_configuration' || token.project_url === 'https://pending-configuration.supabase.co') {
      throw new Error('Supabase project URL not configured. Please complete the Supabase setup.');
    }

    if (!token.service_role_key) {
      throw new Error('Service role key not available. Please reconnect with admin permissions.');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      token.project_url,
      token.service_role_key,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    return supabaseAdmin;
  }

  /**
   * Test Supabase connection
   */
  async testConnection(storeId) {
    try {
      const token = await this.getSupabaseToken(storeId);
      if (!token) {
        throw new Error('Supabase not connected for this store');
      }

      // First, just test if the access token is valid
      try {
        console.log('Testing Supabase OAuth token validity...');
        
        // Test token validity by fetching projects (this is the standard way)
        let projectsTestResponse;
        let projects = [];
        
        try {
          projectsTestResponse = await axios.get('https://api.supabase.com/v1/projects', {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          projects = projectsTestResponse.data || [];
          console.log('Token is valid, found', projects.length, 'projects');
        } catch (scopeError) {
          console.log('Projects endpoint failed:', scopeError.response?.status, scopeError.response?.data);
          
          // Check if it's a 401 (unauthorized) or 403 (forbidden) error
          if (scopeError.response?.status === 401) {
            // Token is invalid or user revoked authorization
            console.error('OAuth token is invalid or revoked');
            
            // Auto-disconnect the invalid connection
            console.log('Auto-disconnecting revoked authorization during test');
            
            // Store the project URL before deleting
            const lastProjectUrl = token.project_url;
            
            // Delete the invalid token
            await this.deleteSupabaseToken(storeId);

            // Update config to mark as disconnected
            const tenantDb = await ConnectionManager.getStoreConnection(storeId);
            const { data: config } = await tenantDb
              .from('integration_configs')
              .select('*')
              .eq('store_id', storeId)
              .eq('integration_type', this.integrationType)
              .eq('is_active', true)
              .maybeSingle();
            if (config?.data) {
              await tenantDb
                .from('integration_configs')
                .update({
                  is_active: false,
                  connection_status: 'failed',
                  config_data: {
                    ...config.data.config_data,
                    connected: false,
                    autoDisconnected: true,
                    autoDisconnectedAt: new Date(),
                    revokedAt: new Date(),
                    revokedDetected: true,
                    disconnectedReason: 'Authorization was revoked in Supabase',
                    lastKnownProjectUrl: lastProjectUrl,
                    message: 'Authorization was revoked and connection was automatically removed.'
                  },
                  updated_at: new Date()
                })
                .eq('id', config.data.id);
            }
            
            throw new Error('Authorization was revoked and the connection has been automatically removed. Please reconnect.');
          }
          
          // If scope error (403), check if we have a project_url already saved
          if (token.project_url && token.project_url !== 'pending_configuration' && token.project_url !== 'https://pending-configuration.supabase.co') {
            console.log('Using existing project URL for connection test:', token.project_url);
            
            // Try to test the connection using the stored project URL
            if (token.anon_key && token.anon_key !== 'pending_configuration') {
              console.log('Testing connection with stored project credentials...');
              
              // Test connection by trying to create a Supabase client
              const { createClient } = require('@supabase/supabase-js');
              try {
                const testClient = createClient(token.project_url, token.anon_key);
                // Simple test - this will work if the URL and key are valid
                console.log('✅ Basic Supabase client connection test passed');
                
                return {
                  success: true,
                  message: 'Connected to Supabase project (limited scope - please reconnect for full features)',
                  projects: 1,
                  projectUrl: token.project_url,
                  hasProjects: true,
                  limitedScope: true
                };
              } catch (clientError) {
                console.error('Supabase client test failed:', clientError.message);
                throw new Error('Stored project credentials are invalid. Please reconnect to Supabase.');
              }
            } else {
              throw new Error('OAuth token requires the projects:read scope. Please reconnect to Supabase to update permissions.');
            }
          } else {
            throw new Error('OAuth token requires the projects:read scope for initial setup. Please reconnect to Supabase.');
          }
        }
        
        // Use the projects from our test response (projects variable already declared above)
        let projectInfo = null;
        
        // If we have projects and no project_url saved, update it
        if (projects.length > 0 && (!token.project_url || token.project_url === '')) {
          const firstProject = projects[0];
          projectInfo = {
            id: firstProject.id,
            name: firstProject.name,
            url: `https://${firstProject.id}.supabase.co`
          };
          
          // Fetch API keys for the project
          let anonKey = token.anon_key || '';
          let serviceRoleKey = token.service_role_key || '';
          
          try {
            const apiKeysResponse = await axios.get(`https://api.supabase.com/v1/projects/${firstProject.id}/config/secrets/project-api-keys`, {
              headers: {
                'Authorization': `Bearer ${token.access_token}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log('Test connection - API keys response:', JSON.stringify(apiKeysResponse.data, null, 2));
            
            // Extract anon and service_role keys from response
            if (apiKeysResponse.data && Array.isArray(apiKeysResponse.data)) {
              const anonKeyObj = apiKeysResponse.data.find(key => key.name === 'anon' || key.name === 'anon_key');
              const serviceKeyObj = apiKeysResponse.data.find(key => key.name === 'service_role' || key.name === 'service_role_key');
              
              if (anonKeyObj?.api_key) anonKey = anonKeyObj.api_key;
              if (serviceKeyObj?.api_key) serviceRoleKey = serviceKeyObj.api_key;
            } else if (apiKeysResponse.data) {
              // Handle different response format
              if (apiKeysResponse.data.anon || apiKeysResponse.data.anon_key) {
                anonKey = apiKeysResponse.data.anon || apiKeysResponse.data.anon_key;
              }
              if (apiKeysResponse.data.service_role || apiKeysResponse.data.service_role_key) {
                serviceRoleKey = apiKeysResponse.data.service_role || apiKeysResponse.data.service_role_key;
              }
            }
            
            console.log('Test connection - Extracted API keys:', { 
              anonKey: anonKey ? anonKey.substring(0, 20) + '...' : 'not found',
              serviceRoleKey: serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'not found'
            });
            
          } catch (apiKeysError) {
            console.error('Test connection - Error fetching API keys:', apiKeysError.response?.data || apiKeysError.message);
            // Continue with existing keys
          }
          
          // Save the project info and API keys
          await this.updateSupabaseToken(storeId, {
            project_url: projectInfo.url,
            anon_key: null,  // No longer used,
            service_role_key: serviceRoleKey || null
          });
          
          console.log('Updated token with first project:', projectInfo.name);
        }

        // Update connection status
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        const config = await tenantDb
          .from('integration_configs')
          .select('*')
          .eq('store_id', storeId)
          .eq('integration_type', this.integrationType)
          .eq('is_active', true)
          .maybeSingle();
        if (config?.data) {
          await tenantDb
            .from('integration_configs')
            .update({
              connection_status: 'success',
              connection_error: null,
              connection_tested_at: new Date(),
              updated_at: new Date()
            })
            .eq('id', config.data.id);
        }

        return {
          success: true,
          message: projects.length > 0 
            ? `Connected to Supabase with ${projects.length} project(s)` 
            : 'Connected to Supabase (no projects yet)',
          projects: projects.length,
          projectUrl: token.project_url || projectInfo?.url,
          hasProjects: projects.length > 0
        };
        
      } catch (error) {
        console.error('Token validation failed:', error.response?.status, error.response?.data);
        
        // If it's a 401, token is invalid or expired
        if (error.response?.status === 401) {
          // Try to refresh the token
          try {
            console.log('Token expired, attempting to refresh...');
            await this.refreshAccessToken(storeId);
            
            // Retry the test with the new token
            return await this.testConnection(storeId);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            throw new Error('Authentication failed. Please reconnect to Supabase.');
          }
        }
        
        throw new Error(`Connection test failed: ${error.response?.data?.message || error.message}`);
      }
      
    } catch (error) {
      // Update connection status
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);
      const config = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('store_id', storeId)
        .eq('integration_type', this.integrationType)
        .eq('is_active', true)
        .maybeSingle();
      if (config?.data) {
        await tenantDb
          .from('integration_configs')
          .update({
            connection_status: 'failed',
            connection_error: error.message,
            connection_tested_at: new Date(),
            updated_at: new Date()
          })
          .eq('id', config.data.id);
      }

      console.error('Connection test error:', error);
      throw error;
    }
  }

  /**
   * Disconnect Supabase OAuth integration
   *
   * IMPORTANT: This only removes OAuth tokens from integration_configs.
   * It does NOT delete store_databases - the tenant DB connection must remain
   * intact so the admin can still access the panel and reconnect.
   */
  async disconnect(storeId) {
    try {
      console.log('Disconnecting Supabase OAuth for store:', storeId);

      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // 1. Delete OAuth tokens from integration_configs where integration_type='supabase-oauth'
      console.log('Deleting supabase-oauth from integration_configs...');
      const { error: integrationDeleteError } = await tenantDb
        .from('integration_configs')
        .delete()
        .eq('store_id', storeId)
        .eq('integration_type', this.integrationType);

      if (integrationDeleteError) {
        console.error('Error deleting from integration_configs:', integrationDeleteError);
      } else {
        console.log('✓ Deleted supabase-oauth from integration_configs');
      }

      // Also delete supabase-keys if present
      const { error: keysDeleteError } = await tenantDb
        .from('integration_configs')
        .delete()
        .eq('store_id', storeId)
        .eq('integration_type', this.keysIntegrationType);

      if (!keysDeleteError) {
        console.log('✓ Deleted supabase-keys from integration_configs');
      }

      // NOTE: We intentionally DO NOT delete from store_databases in master DB.
      // The store_databases record contains the tenant DB connection credentials.
      // Deleting it would lock the user out of the admin panel, preventing reconnection.
      // The store_databases record should only be deleted when the store itself is deleted.
      console.log('ℹ️ Keeping store_databases record intact for admin access');

      console.log('✅ Supabase OAuth disconnection completed');
      return {
        success: true,
        message: 'Supabase OAuth disconnected. You can reconnect anytime from the integrations page.',
        note: 'To fully revoke access, go to your Supabase account settings and remove the DainoStore app authorization.'
      };
    } catch (error) {
      console.error('Error disconnecting Supabase:', error);
      throw new Error('Failed to disconnect Supabase: ' + error.message);
    }
  }

  /**
   * Get available projects for the connected account
   */
  async getProjects(storeId) {
    try {
      const token = await this.getSupabaseToken(storeId);

      // All Supabase connections are OAuth-based (stored in tenant DB)
      if (!token) {
        throw new Error('Supabase not connected for this store');
      }

      // Get valid token (refresh if needed)
      const accessToken = await this.getValidToken(storeId);

      // Fetch projects from Supabase API
      const response = await axios.get('https://api.supabase.com/v1/projects', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const projects = response.data || [];
      
      // Format projects for frontend and check which have keys configured
      const formattedProjects = await Promise.all(projects.map(async project => {
        // Check if we have keys stored for this project
        const storedKeys = await this.getProjectKeys(storeId, project.id);
        const hasKeys = storedKeys && storedKeys.anonKey && storedKeys.anonKey !== 'pending_configuration';
        
        return {
          id: project.id,
          name: project.name,
          url: `https://${project.id}.supabase.co`,
          region: project.region,
          organizationId: project.organization_id,
          createdAt: project.created_at,
          isCurrent: token.project_url === `https://${project.id}.supabase.co`,
          hasKeysConfigured: hasKeys,
          status: project.status || 'ACTIVE'
        };
      }));

      return {
        success: true,
        projects: formattedProjects,
        currentProjectUrl: token.project_url
      };
    } catch (error) {
      console.error('Error fetching projects:', error.response?.data || error.message);
      
      // Check if it's a scope error
      if (error.response?.status === 403 || error.message?.includes('scope')) {
        return {
          success: false,
          message: 'Cannot fetch projects. Please reconnect with proper permissions.',
          requiresReconnection: true
        };
      }
      
      throw new Error('Failed to fetch projects: ' + error.message);
    }
  }

  /**
   * Select a different project
   */
  async selectProject(storeId, projectId) {
    try {
      const token = await this.getSupabaseToken(storeId);
      if (!token) {
        throw new Error('Supabase not connected for this store');
      }

      // Get valid token
      const accessToken = await this.getValidToken(storeId);

      // Fetch project details
      const projectResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const project = projectResponse.data;
      if (!project) {
        throw new Error('Project not found');
      }

      // Try to fetch API keys for the new project
      let anonKey = 'pending_configuration';
      let serviceRoleKey = null;

      try {
        console.log(`Fetching API keys for project ${projectId}...`);
        const apiKeysResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}/config/secrets/project-api-keys`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('API keys response structure:', JSON.stringify(apiKeysResponse.data, null, 2));

        if (apiKeysResponse.data && Array.isArray(apiKeysResponse.data)) {
          const anonKeyObj = apiKeysResponse.data.find(key => key.name === 'anon' || key.name === 'anon_key');
          const serviceKeyObj = apiKeysResponse.data.find(key => key.name === 'service_role' || key.name === 'service_role_key');
          
          anonKey = anonKeyObj?.api_key || 'pending_configuration';
          serviceRoleKey = serviceKeyObj?.api_key || null;
          
          console.log('Found API keys:', {
            anon: anonKey ? 'present' : 'missing',
            service_role: serviceRoleKey ? 'present' : 'missing'
          });
        } else if (apiKeysResponse.data && typeof apiKeysResponse.data === 'object') {
          // Handle different response format
          anonKey = apiKeysResponse.data.anon || apiKeysResponse.data.anon_key || 'pending_configuration';
          serviceRoleKey = apiKeysResponse.data.service_role || apiKeysResponse.data.service_role_key || null;
        }
      } catch (apiKeysError) {
        console.error('Error fetching API keys for new project:', apiKeysError.response?.data || apiKeysError.message);
        
        // Try alternative endpoint for project configuration
        try {
          console.log('Trying alternative endpoint for project config...');
          const configResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}/config`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (configResponse.data?.api?.anon_key) {
            anonKey = configResponse.data.api.anon_key;
            console.log('Found anon key from config endpoint');
          }
          if (configResponse.data?.api?.service_role_key) {
            serviceRoleKey = configResponse.data.api.service_role_key;
            console.log('Found service role key from config endpoint');
          }
        } catch (configError) {
          console.error('Alternative config endpoint also failed:', configError.message);
        }
      }

      // First check if we have stored keys for this project
      const storedKeys = await this.getProjectKeys(storeId, projectId);
      if (storedKeys && storedKeys.anonKey) {
        console.log('Using stored keys for project:', projectId);
        anonKey = storedKeys.anonKey;
        serviceRoleKey = storedKeys.serviceRoleKey || serviceRoleKey;
      }

      const projectUrl = `https://${projectId}.supabase.co`;

      // Preserve existing service role key if new one wasn't fetched
      const currentToken = await this.getSupabaseToken(storeId);
      const preservedServiceRoleKey = serviceRoleKey || currentToken?.service_role_key || null;

      console.log('Service role key handling:', {
        fetchedNewKey: !!serviceRoleKey,
        hadExistingKey: !!currentToken?.service_role_key,
        willPreserveKey: !!preservedServiceRoleKey
      });

      // Update token with new project details in tenant DB
      await this.updateSupabaseToken(storeId, {
        project_url: projectUrl,
        anon_key: anonKey,
        service_role_key: preservedServiceRoleKey,
        database_url: `postgresql://postgres.[projectRef]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`,
        storage_url: `https://${projectId}.supabase.co/storage/v1`,
        auth_url: `https://${projectId}.supabase.co/auth/v1`
      });

      // Store the keys for this project if we have them (use preserved key)
      if (anonKey && anonKey !== 'pending_configuration') {
        await this.upsertProjectKeys(storeId, projectId, projectUrl, {
          anonKey: anonKey,
          serviceRoleKey: preservedServiceRoleKey
        });
      }

      // Update IntegrationConfig as well
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);
      const { data: configData } = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('store_id', storeId)
        .eq('integration_type', this.integrationType)
        .eq('is_active', true)
        .maybeSingle();
      if (configData) {
        await tenantDb
          .from('integration_configs')
          .update({
            config_data: {
              ...configData.config_data,
              projectUrl: `https://${projectId}.supabase.co`,
              projectName: project.name,
              projectId: projectId,
              anonKey: anonKey,
              lastUpdated: new Date()
            },
            updated_at: new Date()
          })
          .eq('id', configData.id);
      }

      return {
        success: true,
        message: `Switched to project: ${project.name}`,
        project: {
          id: projectId,
          name: project.name,
          url: `https://${projectId}.supabase.co`
        }
      };
    } catch (error) {
      console.error('Error selecting project:', error);
      throw new Error('Failed to select project: ' + error.message);
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(storeId) {
    try {
      // Get config and token using IntegrationConfig
      let config, token;
      try {
        config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);

        // IMPORTANT: ALWAYS check Redis for pending OAuth tokens FIRST
        // This handles reconnection cases where old tokens exist but new ones are in Redis
        let foundPendingTokens = false;
        try {
          const { getRedisClient } = require('../config/redis');
          const redisClient = getRedisClient();

          if (redisClient) {
            const redisKey = `oauth:pending:${storeId}`;
            const tokenDataStr = await redisClient.get(redisKey);

            if (tokenDataStr) {
              console.log('🔄 Found pending OAuth tokens in Redis (reconnection detected)');
              const tokenData = JSON.parse(tokenDataStr);
              foundPendingTokens = true;

              // Save to integration_configs (overwrites any existing old tokens)
              const configData = {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: tokenData.expires_at,
                projectUrl: tokenData.project_url,
                serviceRoleKey: tokenData.service_role_key,
                databaseUrl: tokenData.database_url,
                storageUrl: tokenData.storage_url,
                authUrl: tokenData.auth_url,
                connected: true
              };

              await IntegrationConfig.createOrUpdateWithKey(
                storeId,
                this.integrationType,
                configData,
                'default',
                { displayName: 'Supabase' }
              );

              // Update token expiration
              const tenantDb = await ConnectionManager.getStoreConnection(storeId);
              await tenantDb
                .from('integration_configs')
                .update({ token_expires_at: tokenData.expires_at, updated_at: new Date() })
                .eq('store_id', storeId)
                .eq('integration_type', this.integrationType);

              // Sync token expiry to master DB for cron-based refresh
              try {
                console.log('📝 Syncing token expiry to integration_tokens in master DB...');
                await IntegrationToken.upsertToken(storeId, this.integrationType, {
                  token_expires_at: tokenData.expires_at
                });
                console.log('✅ Token synced to integration_tokens in master DB');
              } catch (syncError) {
                console.warn('[getConnectionStatus] Failed to sync token expiry to master DB:', syncError.message);
              }

              // IMPORTANT: Also insert into store_databases in master DB
              // This is required for ConnectionManager to find the store's database
              if (tokenData.project_url && tokenData.service_role_key) {
                console.log('📦 Inserting into store_databases in master...');
                try {
                  const { masterDbClient } = require('../database/masterConnection');
                  const { v4: uuidv4 } = require('uuid');
                  const { encryptDatabaseCredentials } = require('../utils/encryption');

                  // Extract host from project URL
                  let host = null;
                  try {
                    host = new URL(tokenData.project_url).hostname;
                  } catch (e) {
                    console.warn('Could not parse projectUrl:', e.message);
                  }

                  // Encrypt credentials for store_databases
                  const credentials = {
                    projectUrl: tokenData.project_url,
                    serviceRoleKey: tokenData.service_role_key,
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token
                  };
                  const encryptedCredentials = encryptDatabaseCredentials(credentials);

                  // Upsert into store_databases (always set is_primary=true for main connection)
                  const { data: storeDbRecord, error: storeDbError } = await masterDbClient
                    .from('store_databases')
                    .upsert({
                      id: uuidv4(),
                      store_id: storeId,
                      database_type: 'supabase',
                      connection_string_encrypted: encryptedCredentials,
                      host: host,
                      port: null,
                      database_name: 'postgres',
                      is_active: true,
                      is_primary: true, // Primary connection - cannot be deleted
                      connection_status: 'connected',
                      last_connection_test: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }, {
                      onConflict: 'store_id',
                      ignoreDuplicates: false
                    })
                    .select()
                    .single();

                  if (storeDbError) {
                    console.error('❌ Failed to insert into store_databases:', storeDbError.message);
                  } else {
                    console.log('✅ Inserted into store_databases in master (is_primary=true):', storeDbRecord?.id);
                  }
                } catch (storeDbInsertError) {
                  console.error('❌ Error inserting into store_databases:', storeDbInsertError.message);
                }
              }

              // Clean up Redis
              await redisClient.del(redisKey);
              console.log('🧹 Cleaned up pending tokens from Redis');

              // Set token from saved data
              token = {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                service_role_key: tokenData.service_role_key,
                project_url: tokenData.project_url,
                expires_at: tokenData.expires_at
              };

              // Update config reference
              config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
            }
          }

          // Check memory fallback for pending tokens
          if (!foundPendingTokens && global.pendingOAuthTokens && global.pendingOAuthTokens.has(storeId)) {
            console.log('🔄 Found pending OAuth tokens in memory (reconnection detected)');
            const tokenData = global.pendingOAuthTokens.get(storeId);
            foundPendingTokens = true;

            // Save to integration_configs
            const configData = {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiresAt: tokenData.expires_at,
              projectUrl: tokenData.project_url,
              serviceRoleKey: tokenData.service_role_key,
              databaseUrl: tokenData.database_url,
              storageUrl: tokenData.storage_url,
              authUrl: tokenData.auth_url,
              connected: true
            };

            await IntegrationConfig.createOrUpdateWithKey(
              storeId,
              this.integrationType,
              configData,
              'default',
              { displayName: 'Supabase' }
            );

            // Update token expiration
            const tenantDb2 = await ConnectionManager.getStoreConnection(storeId);
            await tenantDb2
              .from('integration_configs')
              .update({ token_expires_at: tokenData.expires_at, updated_at: new Date() })
              .eq('store_id', storeId)
              .eq('integration_type', this.integrationType);

            // Sync token expiry to master DB for cron-based refresh
            try {
              console.log('📝 Syncing token expiry to integration_tokens in master DB (memory fallback)...');
              await IntegrationToken.upsertToken(storeId, this.integrationType, {
                token_expires_at: tokenData.expires_at
              });
              console.log('✅ Token synced to integration_tokens in master DB');
            } catch (syncError) {
              console.warn('[getConnectionStatus] Failed to sync token expiry to master DB:', syncError.message);
            }

            // IMPORTANT: Also insert into store_databases in master DB (memory fallback path)
            if (tokenData.project_url && tokenData.service_role_key) {
              console.log('📦 Inserting into store_databases in master (memory fallback)...');
              try {
                const { masterDbClient } = require('../database/masterConnection');
                const { v4: uuidv4 } = require('uuid');
                const { encryptDatabaseCredentials } = require('../utils/encryption');

                let host = null;
                try {
                  host = new URL(tokenData.project_url).hostname;
                } catch (e) {
                  console.warn('Could not parse projectUrl:', e.message);
                }

                const credentials = {
                  projectUrl: tokenData.project_url,
                  serviceRoleKey: tokenData.service_role_key,
                  accessToken: tokenData.access_token,
                  refreshToken: tokenData.refresh_token
                };
                const encryptedCredentials = encryptDatabaseCredentials(credentials);

                // Upsert into store_databases (always set is_primary=true for main connection)
                const { data: storeDbRecord, error: storeDbError } = await masterDbClient
                  .from('store_databases')
                  .upsert({
                    id: uuidv4(),
                    store_id: storeId,
                    database_type: 'supabase',
                    connection_string_encrypted: encryptedCredentials,
                    host: host,
                    port: null,
                    database_name: 'postgres',
                    is_active: true,
                    is_primary: true, // Primary connection - cannot be deleted
                    connection_status: 'connected',
                    last_connection_test: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'store_id',
                    ignoreDuplicates: false
                  })
                  .select()
                  .single();

                if (storeDbError) {
                  console.error('❌ Failed to insert into store_databases:', storeDbError.message);
                } else {
                  console.log('✅ Inserted into store_databases in master (is_primary=true):', storeDbRecord?.id);
                }
              } catch (storeDbInsertError) {
                console.error('❌ Error inserting into store_databases:', storeDbInsertError.message);
              }
            }

            // Clean up memory
            global.pendingOAuthTokens.delete(storeId);
            console.log('🧹 Cleaned up pending tokens from memory');

            // Set token from saved data
            token = {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
              service_role_key: tokenData.service_role_key,
              project_url: tokenData.project_url,
              expires_at: tokenData.expires_at
            };

            // Update config reference
            config = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
          }
        } catch (pendingTokenError) {
          console.error('[getConnectionStatus] Error checking for pending tokens:', pendingTokenError);
        }

        // If no pending tokens were found, just get existing token (don't refresh during status check)
        // Token refresh is handled by the hourly cron job
        if (!token) {
          token = await this.getSupabaseToken(storeId);
        }
      } catch (dbError) {
        // DB might not be accessible yet, continue without config
        console.error('[getConnectionStatus] Error accessing DB:', dbError.message);
        config = null;
        token = null;
      }

      // Check if OAuth is configured for new connections
      if (!this.oauthConfigured && !token) {
        return {
          connected: false,
          message: 'Supabase OAuth is not configured. Please contact your administrator to set up Supabase OAuth credentials.',
          oauthConfigured: false,
          connectionStatus: 'not_configured'
        };
      }

      // Check if authorization was revoked
      if (config && config.connection_status === 'failed' && config.config_data?.revokedDetected) {
        // Automatically disconnect invalid connection
        console.log('Auto-disconnecting revoked authorization for store:', storeId);

        const lastProjectUrl = token?.project_url || config.config_data?.projectUrl;

        // Deactivate the integration
        await this.deleteSupabaseToken(storeId);

        // Update config to show disconnected with revocation history
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);
        await tenantDb
          .from('integration_configs')
          .update({
            is_active: false,
            connection_status: 'failed',
            config_data: {
              connected: false,
              autoDisconnected: true,
              autoDisconnectedAt: new Date(),
              disconnectedReason: 'Authorization was revoked in Supabase',
              lastKnownProjectUrl: lastProjectUrl,
              userEmail: config.config_data?.userEmail
            },
            updated_at: new Date()
          })
          .eq('store_id', storeId)
          .eq('integration_type', this.integrationType);

        return {
          connected: false,
          message: 'Authorization was revoked. Connection has been automatically removed.',
          oauthConfigured: true,
          authorizationRevoked: true,
          autoDisconnected: true,
          hasToken: false,
          userEmail: config.config_data?.userEmail,
          lastKnownProjectUrl: lastProjectUrl
        };
      }
      
      // Quick connection verification with short timeout
      // If it fails/times out, still return connected but flag as unverified
      let connectionVerified = false;
      if (token && token.project_url && token.project_url !== 'https://pending-configuration.supabase.co') {
        console.log('[getConnectionStatus] Token exists, doing quick verification...');

        // Check if token is expired based on stored expiry time
        if (token.expires_at) {
          const expiresAt = new Date(token.expires_at);
          const now = new Date();
          if (expiresAt < now) {
            console.log('[getConnectionStatus] Token appears expired, marking as needing refresh');
            token._needsRefresh = true;
          }
        }

        // Quick database verification - simple SELECT 1 query
        try {
          const tenantDb = await ConnectionManager.getStoreConnection(storeId);
          const { error } = await tenantDb.from('integration_configs').select('id').limit(1);
          if (!error) {
            connectionVerified = true;
            console.log('[getConnectionStatus] Database connection verified');
          } else {
            console.log('[getConnectionStatus] Database query failed:', error.message);
            token._verificationFailed = true;
          }
        } catch (verifyError) {
          console.log('[getConnectionStatus] Database verification failed:', verifyError.message);
          token._verificationFailed = true;
        }
      }

      // Check if we have an OAuth token (all Supabase connections are OAuth-based)
      // Trust the actual OAuth token presence, not stale config flags
      if (!token) {
        // No token in integration_configs - check store_databases (provisioning credentials)
        try {
          const StoreDatabase = require('../models/master/StoreDatabase');
          const storeDb = await StoreDatabase.findByStoreId(storeId);

          if (storeDb && storeDb.database_type === 'supabase') {
            const dbCredentials = storeDb.getCredentials();
            if (dbCredentials && dbCredentials.projectUrl && dbCredentials.serviceRoleKey) {
              // Return connected status using store_databases credentials
              return {
                connected: true,
                projectUrl: dbCredentials.projectUrl,
                connectionStatus: storeDb.connection_status || 'success',
                oauthConfigured: this.oauthConfigured,
                hasOAuthToken: false,  // No OAuth token, only service role key
                hasServiceRoleKey: true,
                storageReady: true,
                source: 'store_databases',
                message: 'Connected via service role key. Connect with OAuth for automatic token refresh.'
              };
            }
          }
        } catch (dbError) {
          // Could not check store_databases
        }

        // No connection found in either place
        let hasOrphanedAuthorization = false;
        let wasAutoDisconnected = false;
        let lastKnownProjectUrl = null;

        if (config && config.config_data?.disconnectedAt && config.config_data?.userEmail) {
          // If we have a disconnectedAt timestamp and userEmail, the app might still be authorized
          hasOrphanedAuthorization = !config.config_data?.autoDisconnected;
          wasAutoDisconnected = !!config.config_data?.autoDisconnected;
          lastKnownProjectUrl = config.config_data?.lastKnownProjectUrl;
        }

        return {
          connected: false,
          message: wasAutoDisconnected
            ? 'Connection was automatically removed after authorization was revoked.'
            : hasOrphanedAuthorization
              ? 'Supabase disconnected locally. You may need to revoke access in your Supabase account settings.'
              : 'Supabase not connected',
          oauthConfigured: true,
          hasOrphanedAuthorization,
          wasAutoDisconnected,
          lastKnownProjectUrl,
          connectionStatus: 'disconnected'
        };
      }

      // Get project URL from OAuth token
      const projectUrl = token.project_url;

      const isExpired = this.isTokenExpired(token);
      
      // If token is expired and we don't have a service role key, show as disconnected
      // Service role keys don't expire, so we can still use Supabase even if OAuth token expires
      if (isExpired && !token.service_role_key) {
        return {
          connected: false,
          message: 'Supabase connection expired',
          oauthConfigured: true,
          tokenExpired: isExpired,
          connectionStatus: 'failed'
        };
      }
      
      // If connection test recently failed, check if we actually have valid credentials
      // Don't immediately return disconnected if we have a valid project URL and service role key
      if (config && config.connection_status === 'failed') {
        const hasValidProjectUrl = token.project_url &&
                                    token.project_url !== 'pending_configuration' &&
                                    token.project_url !== 'https://pending-configuration.supabase.co';
        let hasValidServiceKey = token.service_role_key &&
                                    token.service_role_key !== 'pending_configuration' &&
                                    token.service_role_key !== '';

        // If no service key in token, check store_databases
        if (!hasValidServiceKey && hasValidProjectUrl) {
          try {
            const StoreDatabase = require('../models/master/StoreDatabase');
            const storeDb = await StoreDatabase.findByStoreId(storeId);
            if (storeDb && storeDb.database_type === 'supabase') {
              const dbCredentials = storeDb.getCredentials();
              if (dbCredentials && dbCredentials.serviceRoleKey) {
                hasValidServiceKey = true;
              }
            }
          } catch (dbError) {
            // Could not check store_databases
          }
        }

        // If we have valid credentials, update status to success and continue
        if (hasValidProjectUrl && hasValidServiceKey) {
          try {
            await IntegrationConfig.updateConnectionStatus(config.id, storeId, 'success');
          } catch (updateError) {
            // Could not update status
          }
          // Continue to return connected status below
        } else {
          return {
            connected: false,
            message: 'Supabase connection failed - please reconnect',
            oauthConfigured: true,
            connectionStatus: 'failed'
          };
        }
      }

      // Check if connection has limited scope
      const hasLimitedScope = token.project_url === 'https://pending-configuration.supabase.co' || 
                              token.project_url === 'pending_configuration';

      // If service role key is missing, flag it but don't fetch during status check
      // Fetching API keys can be slow and should be done explicitly when needed
      if (!token.service_role_key && !hasLimitedScope) {
        console.log('[getConnectionStatus] Service role key missing - flagging for later fetch');
        // Don't block status check with API call - just return connected with flag
        token._needsApiKeyFetch = true;
      }

      // Check if service role key is properly configured
      let hasValidServiceKey = token.service_role_key &&
                                  token.service_role_key !== 'pending_configuration' &&
                                  token.service_role_key !== '';

      // If no service key in token, check store_databases (entered during store creation)
      if (!hasValidServiceKey) {
        try {
          const StoreDatabase = require('../models/master/StoreDatabase');
          const storeDb = await StoreDatabase.findByStoreId(storeId);
          if (storeDb && storeDb.database_type === 'supabase') {
            const dbCredentials = storeDb.getCredentials();
            if (dbCredentials && dbCredentials.serviceRoleKey) {
              hasValidServiceKey = true;
            }
          }
        } catch (dbError) {
          // Could not check store_databases
        }
      }

      return {
        connected: true,
        connectionVerified,
        projectUrl: projectUrl || 'Unknown',
        expiresAt: token.expires_at,
        isExpired,
        connectionStatus: config?.connection_status || 'success',
        lastTestedAt: config?.connection_tested_at,
        oauthConfigured: true,
        limitedScope: hasLimitedScope,
        userEmail: config?.config_data?.userEmail,
        hasServiceRoleKey: hasValidServiceKey,
        requiresManualConfiguration: !hasValidServiceKey && !hasLimitedScope,
        storageReady: hasValidServiceKey
      };
    } catch (error) {
      console.error('Error getting connection status:', error);
      return {
        connected: false,
        error: error.message,
        connectionStatus: 'error'
      };
    }
  }

  /**
   * Get token info without throwing errors
   */
  async getTokenInfo(storeId) {
    try {
      const token = await this.getSupabaseToken(storeId);
      if (!token) {
        return null;
      }
      return {
        project_url: token.project_url,
        service_role_key: token.service_role_key,
        access_token: token.access_token
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }

  /**
   * Try to fetch and update API keys for the current project
   */
  async fetchAndUpdateApiKeys(storeId) {
    try {
      const token = await this.getSupabaseToken(storeId);
      if (!token || !token.project_url || token.project_url === 'pending_configuration') {
        return { success: false, message: 'No project configured' };
      }

      // Extract project ID from URL
      const projectIdMatch = token.project_url.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (!projectIdMatch) {
        return { success: false, message: 'Invalid project URL format' };
      }
      const projectId = projectIdMatch[1];

      // Get valid access token
      const accessToken = await this.getValidToken(storeId);

      let serviceRoleKey = null;
      let updated = false;

      // First check if project is active
      try {
        console.log(`Checking project status for ${projectId}...`);
        const projectResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Project status:', projectResponse.data?.status);
        
        if (projectResponse.data?.status === 'INACTIVE') {
          console.log('Project is INACTIVE - cannot fetch API keys');
          return { 
            success: false, 
            message: 'Supabase project is inactive. Please activate the project in your Supabase dashboard to enable storage operations.',
            projectStatus: 'INACTIVE',
            requiresProjectActivation: true 
          };
        }
      } catch (statusError) {
        console.log('Could not check project status:', statusError.message);
      }

      // Try to fetch API keys
      try {
        console.log(`Attempting to fetch API keys for project ${projectId}...`);
        const apiKeysResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}/config/secrets/project-api-keys`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('API keys response status:', apiKeysResponse.status);
        console.log('API keys response data:', JSON.stringify(apiKeysResponse.data, null, 2));

        if (apiKeysResponse.data && Array.isArray(apiKeysResponse.data)) {
          const serviceKeyObj = apiKeysResponse.data.find(key => key.name === 'service_role' || key.name === 'service_role_key');
          serviceRoleKey = serviceKeyObj?.api_key;
          console.log('Found service role key:', !!serviceRoleKey);
        }
      } catch (error) {
        console.log('Primary API keys endpoint failed:');
        console.log('  Status:', error.response?.status);
        console.log('  Status Text:', error.response?.statusText);
        console.log('  Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.log('  Error Message:', error.message);
        
        // Check if it's a permission error or not found
        if (error.response?.status === 403) {
          console.log('OAuth token lacks secrets:read scope');
          return { 
            success: false, 
            message: 'OAuth token lacks permission to fetch API keys (missing secrets:read scope)',
            requiresReconnection: true 
          };
        } else if (error.response?.status === 404) {
          console.log('API keys endpoint not available - this might be a Supabase API limitation');
          // Don't return error for 404, continue trying alternative methods
        }
        
        // Try alternative endpoints
        try {
          console.log('Trying alternative config endpoint...');
          const configResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}/config`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('Config endpoint response:', JSON.stringify(configResponse.data, null, 2));
          
          if (configResponse.data?.api) {
            serviceRoleKey = configResponse.data.api.service_role_key;
            console.log('Found service role key via config endpoint');
          }
        } catch (altError) {
          console.log('Config endpoint also failed:', altError.response?.status, altError.response?.data?.message || altError.message);
        }
        
        // Try project details endpoint (might have public keys)
        try {
          console.log('Trying project details endpoint...');
          const projectResponse = await axios.get(`https://api.supabase.com/v1/projects/${projectId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('Project details response:', JSON.stringify(projectResponse.data, null, 2));
          
          // Check if project details contain any API info
          if (projectResponse.data?.api_url || projectResponse.data?.endpoint) {
            console.log('Found project API URL:', projectResponse.data.api_url || projectResponse.data.endpoint);
          }
        } catch (projError) {
          console.log('Project details endpoint failed:', projError.response?.status, projError.message);
        }
      }

      // Update if we found new key
      if (serviceRoleKey && serviceRoleKey !== token.service_role_key) {
        await this.updateSupabaseToken(storeId, { service_role_key: serviceRoleKey });
        updated = true;
        console.log('Updated service role key for project');
      }

      // If no service role key was found, indicate manual configuration is needed
      if (!serviceRoleKey && !token.service_role_key) {
        return {
          success: false,
          updated: false,
          hasServiceRoleKey: false,
          requiresManualConfiguration: true,
          message: 'Service role key could not be fetched automatically. The Supabase Management API does not provide access to project API keys through OAuth. Please manually configure your service role key from your Supabase dashboard.',
          instructions: [
            '1. Go to your Supabase dashboard',
            '2. Select your project',
            '3. Navigate to Settings > API',
            '4. Copy the "service_role" secret key',
            '5. Enter it in the Supabase integration settings'
          ]
        };
      }

      return {
        success: true,
        updated,
        hasServiceRoleKey: !!serviceRoleKey || !!token.service_role_key,
        existingKeys: {
          hasServiceRoleKey: !!token.service_role_key
        }
      };
    } catch (error) {
      console.error('Error fetching API keys:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Manually update project configuration (for limited scope connections)
   */
  async updateProjectConfig(storeId, config) {
    try {
      const token = await this.getSupabaseToken(storeId);
      if (!token) {
        throw new Error('Supabase not connected for this store');
      }

      // Use provided projectId or extract from URL
      let projectId = config.projectId;
      
      if (!projectId && token.project_url) {
        const match = token.project_url.match(/https:\/\/([^.]+)\.supabase\.co/);
        if (match) {
          projectId = match[1];
        }
      }

      // Update token with new configuration
      const updateData = {};
      if (config.projectUrl) {
        updateData.project_url = config.projectUrl;
        // Extract project ID from new URL if provided
        const newMatch = config.projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
        if (newMatch) {
          projectId = newMatch[1];
        }
      }
      // No longer update anon_key since we don't use it
      if (config.serviceRoleKey) {
        updateData.service_role_key = config.serviceRoleKey;
      }
      if (config.databaseUrl) {
        updateData.database_url = config.databaseUrl;
      }
      if (config.storageUrl) {
        updateData.storage_url = config.storageUrl;
      }
      if (config.authUrl) {
        updateData.auth_url = config.authUrl;
      }

      await this.updateSupabaseToken(storeId, updateData);

      // Store keys for this specific project
      if (projectId && (config.anonKey || config.serviceRoleKey)) {
        await this.upsertProjectKeys(storeId, projectId,
          config.projectUrl || token.project_url, {
          anonKey: config.anonKey,
          serviceRoleKey: config.serviceRoleKey
        });
        console.log(`Stored keys for project ${projectId}`);
      }

      // Also update IntegrationConfig
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);
      const { data: integrationConfig } = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('store_id', storeId)
        .eq('integration_type', this.integrationType)
        .eq('is_active', true)
        .maybeSingle();
      if (integrationConfig) {
        await tenantDb
          .from('integration_configs')
          .update({
            config_data: {
              ...integrationConfig.config_data,
              ...config,
              manuallyConfigured: true,
              manuallyConfiguredAt: new Date()
            },
            updated_at: new Date()
          })
          .eq('id', integrationConfig.id);
      }

      return {
        success: true,
        message: 'Project configuration updated successfully'
      };
    } catch (error) {
      console.error('Error updating project config:', error);
      throw error;
    }
  }

  /**
   * Helper: Upsert project keys using IntegrationConfig
   * Uses integration_type='supabase-keys' with config_key=projectId
   */
  async upsertProjectKeys(storeId, projectId, projectUrl, keys) {
    try {
      const configData = {
        projectId: projectId,
        projectUrl: projectUrl,
        anonKey: keys.anonKey || null,
        serviceRoleKey: keys.serviceRoleKey || null
      };

      const result = await IntegrationConfig.createOrUpdateWithKey(
        storeId,
        this.keysIntegrationType,
        configData,
        projectId, // Use projectId as config_key
        { displayName: `Supabase Project: ${projectId}` }
      );

      return {
        projectId,
        projectUrl,
        anonKey: keys.anonKey,
        serviceRoleKey: keys.serviceRoleKey
      };
    } catch (error) {
      console.error('[upsertProjectKeys] Error:', error);
      throw error;
    }
  }

  /**
   * Helper: Get project keys from IntegrationConfig
   */
  async getProjectKeys(storeId, projectId) {
    try {
      const config = await IntegrationConfig.findByStoreTypeAndKey(
        storeId,
        this.keysIntegrationType,
        projectId
      );

      if (!config || !config.config_data) return null;

      return {
        anonKey: config.config_data.anonKey,
        serviceRoleKey: config.config_data.serviceRoleKey,
        projectUrl: config.config_data.projectUrl
      };
    } catch (error) {
      console.error('[getProjectKeys] Error:', error);
      return null;
    }
  }

  /**
   * Helper: Delete all project keys for a store
   */
  async deleteAllProjectKeys(storeId) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Delete all supabase-keys configs for this store
      const { data, error } = await tenantDb
        .from('integration_configs')
        .delete()
        .eq('store_id', storeId)
        .eq('integration_type', this.keysIntegrationType)
        .select();

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('[deleteAllProjectKeys] Error:', error);
      return 0;
    }
  }

  /**
   * Store manual Supabase credentials (used by supabase-setup service)
   * This is for direct credential entry without OAuth
   */
  async storeManualCredentials(storeId, credentials) {
    try {
      const configData = {
        projectUrl: credentials.project_url,
        serviceRoleKey: credentials.service_role_key,
        connected: true,
        connectionType: 'manual'
      };

      await IntegrationConfig.createOrUpdateWithKey(
        storeId,
        this.integrationType,
        configData,
        'default',
        { displayName: 'Supabase (Manual)' }
      );

      // Update connection status
      const savedConfig = await IntegrationConfig.findByStoreAndType(storeId, this.integrationType);
      if (savedConfig) {
        await IntegrationConfig.updateConnectionStatus(savedConfig.id, storeId, 'success');
      }

      // IMPORTANT: Also insert into store_databases in master DB
      if (credentials.project_url && credentials.service_role_key) {
        console.log('📦 Inserting into store_databases in master (manual credentials)...');
        try {
          const { masterDbClient } = require('../database/masterConnection');
          const { v4: uuidv4 } = require('uuid');
          const { encryptDatabaseCredentials } = require('../utils/encryption');

          let host = null;
          try {
            host = new URL(credentials.project_url).hostname;
          } catch (e) {
            console.warn('Could not parse projectUrl:', e.message);
          }

          const credentialsToStore = {
            projectUrl: credentials.project_url,
            serviceRoleKey: credentials.service_role_key
          };
          const encryptedCredentials = encryptDatabaseCredentials(credentialsToStore);

          // Upsert into store_databases (always set is_primary=true for main connection)
          const { data: storeDbRecord, error: storeDbError } = await masterDbClient
            .from('store_databases')
            .upsert({
              id: uuidv4(),
              store_id: storeId,
              database_type: 'supabase',
              connection_string_encrypted: encryptedCredentials,
              host: host,
              port: null,
              database_name: 'postgres',
              is_active: true,
              is_primary: true, // Primary connection - cannot be deleted
              connection_status: 'connected',
              last_connection_test: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'store_id',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (storeDbError) {
            console.error('❌ Failed to insert into store_databases:', storeDbError.message);
          } else {
            console.log('✅ Inserted into store_databases in master (is_primary=true):', storeDbRecord?.id);
          }
        } catch (storeDbInsertError) {
          console.error('❌ Error inserting into store_databases:', storeDbInsertError.message);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('[storeManualCredentials] Error:', error);
      throw error;
    }
  }
}

module.exports = new SupabaseIntegration();