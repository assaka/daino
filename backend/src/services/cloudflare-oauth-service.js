const axios = require('axios');
const crypto = require('crypto');

class CloudflareOAuthService {
  constructor(config = {}) {
    this.clientId = config.clientId || process.env.CLOUDFLARE_OAUTH_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.CLOUDFLARE_OAUTH_CLIENT_SECRET;
    this.redirectUri = config.redirectUri || process.env.CLOUDFLARE_OAUTH_REDIRECT_URI;
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
    this.authUrl = 'https://dash.cloudflare.com/oauth2/authorize';
    this.tokenUrl = 'https://api.cloudflare.com/client/v4/oauth2/token';
    
    // Store for PKCE challenges (in production, use Redis or database)
    this.pkceStore = new Map();
    
    console.log('🔐 CloudflareOAuthService initialized with:');
    console.log('  Client ID present:', !!this.clientId);
    console.log('  Client Secret present:', !!this.clientSecret);
    console.log('  Redirect URI:', this.redirectUri);
  }

  /**
   * Generate PKCE code challenge and verifier
   */
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  generateAuthUrl(storeId, scopes = ['zone:read', 'zone_settings:edit']) {
    const state = crypto.randomUUID();
    const pkce = this.generatePKCE();
    
    // Store PKCE data with state as key
    this.pkceStore.set(state, {
      codeVerifier: pkce.codeVerifier,
      storeId: storeId,
      createdAt: Date.now()
    });
    
    // Clean up old entries (older than 10 minutes)
    this.cleanupPKCEStore();
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state,
      scope: scopes.join(' '),
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, state) {
    try {
      // Retrieve PKCE data
      const pkceData = this.pkceStore.get(state);
      if (!pkceData) {
        throw new Error('Invalid or expired state parameter');
      }

      // Clean up used state
      this.pkceStore.delete(state);

      const tokenData = {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        code_verifier: pkceData.codeVerifier
      };

      const response = await axios.post(this.tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.error) {
        throw new Error(`OAuth error: ${response.data.error_description || response.data.error}`);
      }

      // Get user info and zones
      const userInfo = await this.getUserInfo(response.data.access_token);
      const zones = await this.getUserZones(response.data.access_token);

      return {
        success: true,
        storeId: pkceData.storeId,
        tokenData: {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          token_type: response.data.token_type,
          expires_in: response.data.expires_in,
          scope: response.data.scope,
          expires_at: Date.now() + (response.data.expires_in * 1000)
        },
        userInfo: userInfo,
        zones: zones
      };
    } catch (error) {
      console.error('OAuth token exchange failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken) {
    try {
      const tokenData = {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      };

      const response = await axios.post(this.tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.error) {
        throw new Error(`Token refresh error: ${response.data.error_description || response.data.error}`);
      }

      return {
        success: true,
        tokenData: {
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token || refreshToken, // Some OAuth providers don't return new refresh token
          token_type: response.data.token_type,
          expires_in: response.data.expires_in,
          scope: response.data.scope,
          expires_at: Date.now() + (response.data.expires_in * 1000)
        }
      };
    } catch (error) {
      console.error('Token refresh failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        return {
          id: response.data.result.id,
          email: response.data.result.email,
          first_name: response.data.result.first_name,
          last_name: response.data.result.last_name,
          username: response.data.result.username,
          organizations: response.data.result.organizations
        };
      } else {
        throw new Error('Failed to get user info');
      }
    } catch (error) {
      console.error('Failed to get user info:', error.message);
      return null;
    }
  }

  /**
   * Get user's zones
   */
  async getUserZones(accessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/zones`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          per_page: 50 // Get up to 50 zones
        }
      });

      if (response.data.success) {
        return response.data.result.map(zone => ({
          id: zone.id,
          name: zone.name,
          status: zone.status,
          plan: zone.plan?.name,
          name_servers: zone.name_servers
        }));
      } else {
        throw new Error('Failed to get zones');
      }
    } catch (error) {
      console.error('Failed to get zones:', error.message);
      return [];
    }
  }

  /**
   * Store OAuth credentials for a store
   */
  async storeCredentials(storeId, tokenData, zoneId = null) {
    try {
      const IntegrationConfig = require('../models/IntegrationConfig');
      
      // Encrypt sensitive data
      const encryptedTokenData = {
        access_token: this.encryptValue(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? this.encryptValue(tokenData.refresh_token) : null,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: tokenData.expires_at,
        scope: tokenData.scope
      };

      const configData = {
        oauth_enabled: true,
        token_data: encryptedTokenData,
        zone_id: zoneId,
        connected_at: new Date().toISOString(),
        last_refresh: null
      };

      // Create or update Cloudflare integration config
      const integrationConfig = await IntegrationConfig.createOrUpdate(storeId, 'cloudflare', configData);

      return {
        success: true,
        integration_id: integrationConfig.id
      };
    } catch (error) {
      console.error('Failed to store credentials:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get stored credentials for a store
   */
  async getStoredCredentials(storeId) {
    try {
      const IntegrationConfig = require('../models/IntegrationConfig');

      const integrationConfig = await IntegrationConfig.findByStoreAndType(storeId, 'cloudflare');

      if (!integrationConfig || !integrationConfig.config_data?.oauth_enabled) {
        return null;
      }

      const tokenData = integrationConfig.config_data.token_data;
      
      // Decrypt sensitive data
      const decryptedTokenData = {
        access_token: this.decryptValue(tokenData.access_token),
        refresh_token: tokenData.refresh_token ? this.decryptValue(tokenData.refresh_token) : null,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: tokenData.expires_at,
        scope: tokenData.scope
      };

      // Check if token needs refresh
      if (decryptedTokenData.expires_at && decryptedTokenData.expires_at < Date.now() + 300000) { // 5 minutes buffer
        console.log('Token expired, attempting refresh...');
        const refreshResult = await this.refreshToken(decryptedTokenData.refresh_token);
        
        if (refreshResult.success) {
          // Update stored credentials
          await this.storeCredentials(storeId, refreshResult.tokenData, integrationConfig.config_data.zone_id);
          return refreshResult.tokenData;
        } else {
          console.error('Token refresh failed:', refreshResult.error);
          return null;
        }
      }

      return decryptedTokenData;
    } catch (error) {
      console.error('Failed to get stored credentials:', error.message);
      return null;
    }
  }

  /**
   * Revoke OAuth access
   */
  async revokeAccess(storeId) {
    try {
      const credentials = await this.getStoredCredentials(storeId);
      
      if (credentials) {
        // Revoke token with Cloudflare
        try {
          await axios.post('https://api.cloudflare.com/client/v4/oauth2/revoke', {
            token: credentials.access_token,
            client_id: this.clientId,
            client_secret: this.clientSecret
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
        } catch (error) {
          console.warn('Failed to revoke token with Cloudflare:', error.message);
        }
      }

      // Remove from database
      const IntegrationConfig = require('../models/IntegrationConfig');
      await IntegrationConfig.update(
        { is_active: false },
        {
          where: {
            store_id: storeId,
            integration_type: 'cloudflare'
          }
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to revoke access:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make authenticated API request to Cloudflare
   */
  async makeAuthenticatedRequest(storeId, endpoint, options = {}) {
    const credentials = await this.getStoredCredentials(storeId);
    
    if (!credentials) {
      throw new Error('No valid Cloudflare credentials found for this store');
    }

    const requestOptions = {
      ...options,
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await axios({
        url,
        ...requestOptions
      });
      
      return response.data;
    } catch (error) {
      // If unauthorized, try to refresh token
      if (error.response?.status === 401) {
        console.log('Unauthorized, attempting token refresh...');
        const refreshResult = await this.refreshToken(credentials.refresh_token);
        
        if (refreshResult.success) {
          await this.storeCredentials(storeId, refreshResult.tokenData);
          
          // Retry request with new token
          requestOptions.headers['Authorization'] = `Bearer ${refreshResult.tokenData.access_token}`;
          const retryResponse = await axios({ url, ...requestOptions });
          return retryResponse.data;
        }
      }
      
      throw error;
    }
  }

  /**
   * Encrypt sensitive values
   */
  encryptValue(value) {
    const key = process.env.INTEGRATION_ENCRYPTION_KEY || 'daino-integration-default-key-change-in-production';
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `encrypted:${encrypted}`;
  }

  /**
   * Decrypt sensitive values
   */
  decryptValue(encryptedValue) {
    if (!encryptedValue.startsWith('encrypted:')) {
      return encryptedValue; // Not encrypted
    }
    
    const key = process.env.INTEGRATION_ENCRYPTION_KEY || 'daino-integration-default-key-change-in-production';
    const encrypted = encryptedValue.replace('encrypted:', '');
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Clean up expired PKCE data
   */
  cleanupPKCEStore() {
    const tenMinutesAgo = Date.now() - 600000; // 10 minutes
    
    for (const [state, data] of this.pkceStore.entries()) {
      if (data.createdAt < tenMinutesAgo) {
        this.pkceStore.delete(state);
      }
    }
  }

  /**
   * Validate OAuth configuration
   */
  validateConfig() {
    const errors = [];
    
    if (!this.clientId) {
      errors.push('CLOUDFLARE_OAUTH_CLIENT_ID is required');
    }
    
    if (!this.clientSecret) {
      errors.push('CLOUDFLARE_OAUTH_CLIENT_SECRET is required');
    }
    
    if (!this.redirectUri) {
      errors.push('CLOUDFLARE_OAUTH_REDIRECT_URI is required');
    }
    
    return errors;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      client_id_configured: !!this.clientId,
      client_secret_configured: !!this.clientSecret,
      redirect_uri: this.redirectUri,
      auth_url: this.authUrl,
      token_url: this.tokenUrl
    };
  }
}

module.exports = CloudflareOAuthService;