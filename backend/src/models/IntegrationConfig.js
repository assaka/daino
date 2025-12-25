/**
 * IntegrationConfig - Pure service class (NO SEQUELIZE)
 *
 * This class provides methods to interact with integration_configs table
 * using ConnectionManager for proper tenant database isolation.
 *
 * All methods are static and use direct Supabase queries through ConnectionManager.
 */

const crypto = require('crypto');

const IntegrationConfig = {};

// Modern encryption helpers (Node.js 22+ compatible)
// The old createCipher/createDecipher used EVP_BytesToKey internally
// We need to replicate that for backwards compatibility
function evpBytesToKey(password, keyLen, ivLen) {
  const key = Buffer.alloc(keyLen);
  const iv = Buffer.alloc(ivLen);
  let tmp = Buffer.alloc(0);

  while (key.length + iv.length > tmp.length) {
    const hash = crypto.createHash('md5');
    hash.update(tmp);
    hash.update(Buffer.from(password));
    tmp = Buffer.concat([tmp, hash.digest()]);
  }

  tmp.copy(key, 0, 0, keyLen);
  tmp.copy(iv, 0, keyLen, keyLen + ivLen);

  return { key, iv };
}

function encryptLegacy(text, password) {
  const { key, iv } = evpBytesToKey(password, 32, 16); // AES-256-CBC
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptLegacy(encryptedHex, password) {
  const { key, iv } = evpBytesToKey(password, 32, 16); // AES-256-CBC
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Encryption/Decryption utilities
IntegrationConfig.getEncryptionKey = () => {
  // Use environment variable or generate a key
  // In production, this should be a secure, consistent key
  return process.env.INTEGRATION_ENCRYPTION_KEY || 'daino-integration-default-key-change-in-production';
};

IntegrationConfig.getSensitiveFields = (integrationType) => {
  const sensitiveFieldsMap = {
    // E-commerce platforms
    akeneo: ['clientSecret', 'password'],
    magento: ['apiKey', 'password'],
    shopify: ['accessToken', 'clientSecret', 'webhookSecret', 'apiSecret'],
    woocommerce: ['consumerSecret'],

    // Email/Marketing integrations
    brevo: ['apiKey', 'accessToken'],
    sendgrid: ['apiKey'],
    mailchimp: ['apiKey'],
    klaviyo: ['apiKey'],

    // Database integrations
    supabase: ['accessToken', 'refreshToken', 'serviceRoleKey', 'databaseUrl'],
    'supabase-database': ['accessToken', 'refreshToken', 'serviceRoleKey', 'connectionString'],
    'supabase-oauth': ['accessToken', 'refreshToken', 'serviceRoleKey', 'databaseUrl'],
    'supabase-keys': ['anonKey', 'serviceRoleKey'],
    postgresql: ['password', 'connectionString'],
    mysql: ['password', 'connectionString'],

    // Storage integrations
    'supabase-storage': ['serviceRoleKey', 'accessToken', 'refreshToken'],
    'google-cloud-storage': ['privateKey', 'credentials'],
    'gcs-storage': ['privateKey', 'credentials'],
    'aws-s3': ['accessKeyId', 'secretAccessKey', 'sessionToken'],
    's3-storage': ['accessKeyId', 'secretAccessKey', 'sessionToken'],
    'cloudflare-r2': ['accessKeyId', 'secretAccessKey'],
    'azure-blob': ['accountKey', 'connectionString'],
    'local-storage': [],

    // Marketplace integrations
    amazon: ['mwsAuthToken', 'awsAccessKeyId', 'awsSecretAccessKey'],
    ebay: ['appId', 'certId', 'devId', 'authToken'],
    'google-shopping': ['apiKey'],
    facebook: ['accessToken'],
    instagram: ['accessToken'],

    // Meta Commerce / Instagram Shopping
    'meta-commerce': ['accessToken', 'refreshToken'],
    'instagram-shopping': ['accessToken', 'refreshToken']
  };

  return sensitiveFieldsMap[integrationType] || [];
};

IntegrationConfig.encryptSensitiveData = (configData, integrationType) => {
  if (!configData || typeof configData !== 'object') {
    return configData;
  }

  const sensitiveFields = IntegrationConfig.getSensitiveFields(integrationType);
  const encrypted = { ...configData };
  const key = IntegrationConfig.getEncryptionKey();

  sensitiveFields.forEach(field => {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      try {
        // Use modern encryption (Node.js 22+ compatible)
        const encryptedValue = encryptLegacy(encrypted[field], key);
        encrypted[field] = `encrypted:${encryptedValue}`;
      } catch (error) {
      }
    }
  });

  return encrypted;
};

IntegrationConfig.decryptSensitiveData = (configData, integrationType) => {
  // Handle case where config_data is stored as a JSON string
  let parsedData = configData;
  if (typeof configData === 'string') {
    try {
      parsedData = JSON.parse(configData);
    } catch (e) {
      return configData;
    }
  }

  if (!parsedData || typeof parsedData !== 'object') {
    return parsedData;
  }

  // Use parsedData from here on
  configData = parsedData;

  const sensitiveFields = IntegrationConfig.getSensitiveFields(integrationType);
  const decrypted = { ...configData };
  const key = IntegrationConfig.getEncryptionKey();

  sensitiveFields.forEach(field => {
    if (decrypted[field] && typeof decrypted[field] === 'string' && decrypted[field].startsWith('encrypted:')) {

      try {
        const encryptedValue = decrypted[field].replace('encrypted:', '');
        // Use modern decryption (Node.js 22+ compatible)
        let decryptedValue = decryptLegacy(encryptedValue, key);

        // Handle double encryption (legacy issue)
        if (decryptedValue.startsWith('encrypted:')) {
          try {
            const encryptedValue2 = decryptedValue.replace('encrypted:', '');
            decryptedValue = decryptLegacy(encryptedValue2, key);
          } catch (doubleDecryptError) {
          }
        }

        decrypted[field] = decryptedValue;
      } catch (error) {
        // Keep encrypted value if decryption fails
      }
    }
  });

  return decrypted;
};

// Static method to update sync status (removed instance method - use static instead)
IntegrationConfig.updateSyncStatus = async function(configId, storeId, status, error = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updateData = {
      sync_status: status,
      sync_error: error,
      updated_at: new Date().toISOString()
    };

    if (status === 'success') {
      updateData.last_sync_at = new Date().toISOString();
    }

    const { error: updateError } = await tenantDb
      .from('integration_configs')
      .update(updateData)
      .eq('id', configId);

    if (updateError) {
      throw updateError;
    }

    return updateData;
  } catch (err) {
    throw err;
  }
};

// Static method to update connection status (replaces instance method)
IntegrationConfig.updateConnectionStatus = async function(configId, storeId, status, error = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updateData = {
      connection_status: status,
      connection_error: error,
      connection_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await tenantDb
      .from('integration_configs')
      .update(updateData)
      .eq('id', configId);

    if (updateError) {
      throw updateError;
    }

    return updateData;
  } catch (err) {
    throw err;
  }
};

// Static methods for common operations
IntegrationConfig.findByStoreAndType = async function(storeId, integrationType) {
  // Use ConnectionManager to avoid deprecated sequelize connection
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    // Ensure we have the id field
    if (!data.id) {
      throw new Error('Integration config data is missing required id field');
    }

    // Decrypt sensitive data before returning
    const decryptedConfigData = IntegrationConfig.decryptSensitiveData(data.config_data, integrationType);

    const decryptedData = {
      ...data,
      config_data: decryptedConfigData
    };

    // Create a simplified plain object (remove backward compatibility with Sequelize)
    return decryptedData;
  } catch (error) {
    throw error;
  }
};

IntegrationConfig.findByStoreAndTypes = async function(storeId, integrationTypes) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .in('integration_type', integrationTypes)
      .eq('is_active', true)
      .order('integration_type', { ascending: false }) // Prefer newer integrations
      .limit(1)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    // Decrypt sensitive data
    const decryptedData = {
      ...data,
      config_data: IntegrationConfig.decryptSensitiveData(data.config_data, data.integration_type)
    };

    return decryptedData;
  } catch (error) {
    throw error;
  }
};

IntegrationConfig.createOrUpdate = async function(storeId, integrationType, configData) {
  const ConnectionManager = require('../services/database/ConnectionManager');
  const { v4: uuidv4 } = require('uuid');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Encrypt sensitive data before saving
    const encryptedData = IntegrationConfig.encryptSensitiveData(configData, integrationType);

    // First try to find active config
    const { data: existingConfig } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .maybeSingle();

    if (existingConfig) {
      // Update existing
      const updateData = {
        config_data: encryptedData,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { data: updated, error: updateError } = await tenantDb
        .from('integration_configs')
        .update(updateData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return {
        ...updated,
        config_data: IntegrationConfig.decryptSensitiveData(updated.config_data, integrationType)
      };
    } else {
      // Create new
      const newConfig = {
        id: uuidv4(),
        store_id: storeId,
        integration_type: integrationType,
        config_data: encryptedData,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error: createError } = await tenantDb
        .from('integration_configs')
        .insert(newConfig)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return {
        ...created,
        config_data: IntegrationConfig.decryptSensitiveData(created.config_data, integrationType)
      };
    }
  } catch (error) {
    throw error;
  }
};

IntegrationConfig.getActiveConfigs = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    // Decrypt sensitive data for all configs
    return (data || []).map(config => ({
      ...config,
      config_data: IntegrationConfig.decryptSensitiveData(config.config_data, config.integration_type)
    }));
  } catch (error) {
    throw error;
  }
};

IntegrationConfig.deleteByStoreAndType = async function(storeId, integrationType) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .delete()
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .select();

    if (error) {
      throw error;
    }

    return data && data.length > 0;
  } catch (error) {
    throw error;
  }
};

// ============================================
// Token Refresh Methods (for OAuth integrations)
// ============================================

/**
 * Check if token needs refresh (within 1 hour of expiry)
 */
IntegrationConfig.needsTokenRefresh = function(config) {
  if (!config || !config.token_expires_at) return false;
  const expiresAt = new Date(config.token_expires_at);
  const buffer = 60 * 60 * 1000; // 1 hour buffer
  return expiresAt <= new Date(Date.now() + buffer);
};

/**
 * Update OAuth tokens after refresh
 */
IntegrationConfig.updateTokens = async function(storeId, integrationType, tokenData, configKey = 'default') {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Find existing config
    const existingConfig = await this.findByStoreTypeAndKey(storeId, integrationType, configKey);
    if (!existingConfig) {
      throw new Error(`Configuration not found for type: ${integrationType}`);
    }

    // Merge new token data with existing config_data
    const updatedConfigData = {
      ...existingConfig.config_data,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || existingConfig.config_data.refreshToken
    };

    // Encrypt sensitive data
    const encryptedData = this.encryptSensitiveData(updatedConfigData, integrationType);

    const updateData = {
      config_data: encryptedData,
      token_expires_at: tokenData.expiresAt ? new Date(tokenData.expiresAt).toISOString() : null,
      last_token_refresh_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await tenantDb
      .from('integration_configs')
      .update(updateData)
      .eq('id', existingConfig.id);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

// ============================================
// Storage Integration Methods
// ============================================

/**
 * Get primary storage configuration for a store
 */
IntegrationConfig.getPrimaryStorage = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .eq('is_primary', true)
      .like('integration_type', '%-storage')
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      ...data,
      config_data: this.decryptSensitiveData(data.config_data, data.integration_type)
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get all storage configurations for a store
 */
IntegrationConfig.getAllStorageConfigs = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .like('integration_type', '%-storage')
      .order('is_primary', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(config => ({
      ...config,
      config_data: this.decryptSensitiveData(config.config_data, config.integration_type)
    }));
  } catch (error) {
    throw error;
  }
};

/**
 * Set a storage config as primary (unsets others)
 */
IntegrationConfig.setPrimaryStorage = async function(storeId, configId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Unset all other storage configs as primary
    await tenantDb
      .from('integration_configs')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .like('integration_type', '%-storage');

    // Set the specified config as primary
    const { error } = await tenantDb
      .from('integration_configs')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', configId)
      .eq('store_id', storeId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

// ============================================
// Config Key Support (for multiple configs of same type)
// ============================================

/**
 * Find config by store, type, and config_key
 */
IntegrationConfig.findByStoreTypeAndKey = async function(storeId, integrationType, configKey = 'default') {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .eq('config_key', configKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      ...data,
      config_data: this.decryptSensitiveData(data.config_data, integrationType)
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Create or update config with config_key support
 */
IntegrationConfig.createOrUpdateWithKey = async function(storeId, integrationType, configData, configKey = 'default', options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');
  const { v4: uuidv4 } = require('uuid');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Encrypt sensitive data before saving
    const encryptedData = this.encryptSensitiveData(configData, integrationType);

    // Try to find existing config with same key
    const { data: existingConfig } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .eq('config_key', configKey)
      .maybeSingle();

    if (existingConfig) {
      // Update existing
      const updateData = {
        config_data: encryptedData,
        is_active: true,
        updated_at: new Date().toISOString(),
        ...(options.displayName && { display_name: options.displayName }),
        ...(options.isPrimary !== undefined && { is_primary: options.isPrimary }),
        ...(options.tokenExpiresAt && { token_expires_at: options.tokenExpiresAt }),
        ...(options.oauthScopes && { oauth_scopes: options.oauthScopes })
      };

      const { data: updated, error: updateError } = await tenantDb
        .from('integration_configs')
        .update(updateData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return {
        ...updated,
        config_data: this.decryptSensitiveData(updated.config_data, integrationType)
      };
    } else {
      // Create new
      const newConfig = {
        id: uuidv4(),
        store_id: storeId,
        integration_type: integrationType,
        config_key: configKey,
        config_data: encryptedData,
        is_active: true,
        is_primary: options.isPrimary || false,
        display_name: options.displayName || null,
        token_expires_at: options.tokenExpiresAt || null,
        oauth_scopes: options.oauthScopes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: created, error: createError } = await tenantDb
        .from('integration_configs')
        .insert(newConfig)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return {
        ...created,
        config_data: this.decryptSensitiveData(created.config_data, integrationType)
      };
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Update usage stats for storage configs
 */
IntegrationConfig.updateStorageStats = async function(configId, storeId, stats) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updateData = {
      total_files: stats.totalFiles,
      total_size_bytes: stats.totalSizeBytes,
      updated_at: new Date().toISOString()
    };

    const { error } = await tenantDb
      .from('integration_configs')
      .update(updateData)
      .eq('id', configId)
      .eq('store_id', storeId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

/**
 * Delete/deactivate a config
 */
IntegrationConfig.deactivate = async function(storeId, integrationType, configKey = 'default') {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('integration_configs')
      .update({
        is_active: false,
        is_primary: false,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .eq('config_key', configKey);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

/**
 * Find primary email provider among configured ones
 * @param {string} storeId - Store ID
 * @param {Array} providerTypes - Array of provider types to check (e.g., ['brevo', 'sendgrid'])
 * @returns {Promise<Object|null>} Primary email provider config or null
 */
IntegrationConfig.findPrimaryEmailProvider = async function(storeId, providerTypes) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .in('integration_type', providerTypes)
      .eq('is_active', true)
      .eq('is_primary', true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      config_data: this.decryptSensitiveData(data.config_data, data.integration_type)
    };
  } catch (error) {
    console.error('Error finding primary email provider:', error.message);
    return null;
  }
};

/**
 * Unset is_primary for specified integration types
 * @param {string} storeId - Store ID
 * @param {Array} providerTypes - Array of provider types to unset
 */
IntegrationConfig.unsetPrimaryForTypes = async function(storeId, providerTypes) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    await tenantDb
      .from('integration_configs')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .in('integration_type', providerTypes);
  } catch (error) {
    console.error('Error unsetting primary for types:', error.message);
  }
};

module.exports = IntegrationConfig;