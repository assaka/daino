const IntegrationConfig = require('../../models/IntegrationConfig');

/**
 * StorageManager - Factory for storage providers
 *
 * Automatically detects which storage provider is configured for a store
 * and instantiates the appropriate provider class.
 */
class StorageManager {
  static providerCache = new Map();

  /**
   * Get the active storage provider for a store
   * @param {string} storeId - Store ID
   * @param {boolean} cache - Whether to use cached provider (default: true)
   * @returns {Promise<StorageProvider>} - Configured storage provider instance
   */
  static async getProvider(storeId, cache = true) {
    // Check cache first
    if (cache && this.providerCache.has(storeId)) {
      return this.providerCache.get(storeId);
    }

    // Find active storage integration for this store
    const storageTypes = [
      'supabase-storage',
      'google-cloud-storage',
      'aws-s3',
      'cloudflare-r2',
      'local-storage',
      'supabase' // Legacy - fallback to old integration
    ];

    const storageConfig = await IntegrationConfig.findByStoreAndTypes(storeId, storageTypes);

    if (!storageConfig) {
      throw new Error(`No storage provider configured for store ${storeId}. Please configure a storage integration first.`);
    }

    // Instantiate the appropriate provider
    const provider = await this._createProvider(storageConfig.integration_type, storageConfig.config_data);

    // Cache the provider
    if (cache) {
      this.providerCache.set(storeId, provider);
    }

    return provider;
  }

  /**
   * Create a provider instance based on integration type
   * @private
   */
  static async _createProvider(integrationType, config) {
    switch (integrationType) {
      case 'supabase-storage': {
        const SupabaseStorageProvider = require('./providers/SupabaseStorageProvider');
        return new SupabaseStorageProvider(config);
      }

      case 'google-cloud-storage': {
        const GoogleCloudStorageProvider = require('./providers/GoogleCloudStorageProvider');
        return new GoogleCloudStorageProvider(config);
      }

      case 'aws-s3': {
        const AwsS3StorageProvider = require('./providers/AwsS3StorageProvider');
        return new AwsS3StorageProvider(config);
      }

      case 'cloudflare-r2': {
        const CloudflareR2StorageProvider = require('./providers/CloudflareR2StorageProvider');
        return new CloudflareR2StorageProvider(config);
      }

      case 'local-storage': {
        const LocalStorageProvider = require('./providers/LocalStorageProvider');
        return new LocalStorageProvider(config);
      }

      case 'supabase': {
        // Legacy fallback - treat as supabase-storage
        const SupabaseStorageProvider = require('./providers/SupabaseStorageProvider');
        return new SupabaseStorageProvider(config);
      }

      default:
        throw new Error(`Unknown storage provider type: ${integrationType}`);
    }
  }

  /**
   * Clear provider cache for a store (useful after config changes)
   */
  static clearCache(storeId = null) {
    if (storeId) {
      this.providerCache.delete(storeId);
    } else {
      this.providerCache.clear();
    }
  }

  /**
   * Upload a file using the configured provider
   */
  static async upload(storeId, file, path, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.upload(file, path, options);
  }

  /**
   * Upload multiple files using the configured provider
   */
  static async uploadMultiple(storeId, files, basePath, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.uploadMultiple(files, basePath, options);
  }

  /**
   * Delete a file using the configured provider
   */
  static async delete(storeId, path, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.delete(path, options);
  }

  /**
   * Get file URL using the configured provider
   */
  static async getUrl(storeId, path, expiresIn = 3600, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.getUrl(path, expiresIn, options);
  }

  /**
   * List files using the configured provider
   */
  static async listFiles(storeId, prefix, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.listFiles(prefix, options);
  }

  /**
   * Check if file exists using the configured provider
   */
  static async exists(storeId, path, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.exists(path, options);
  }

  /**
   * Copy file using the configured provider
   */
  static async copy(storeId, fromPath, toPath, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.copy(fromPath, toPath, options);
  }

  /**
   * Move file using the configured provider
   */
  static async move(storeId, fromPath, toPath, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.move(fromPath, toPath, options);
  }

  /**
   * Get storage statistics using the configured provider
   */
  static async getStats(storeId, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.getStats(options);
  }

  /**
   * Create bucket using the configured provider
   */
  static async createBucket(storeId, bucketName, options = {}) {
    const provider = await this.getProvider(storeId);
    return await provider.createBucket(bucketName, options);
  }

  /**
   * List buckets using the configured provider
   */
  static async listBuckets(storeId) {
    const provider = await this.getProvider(storeId);
    return await provider.listBuckets();
  }

  /**
   * Test connection using the configured provider
   */
  static async testConnection(storeId) {
    const provider = await this.getProvider(storeId, false); // Don't cache test connections
    return await provider.testConnection();
  }

  /**
   * Get information about the configured provider
   */
  static async getProviderInfo(storeId) {
    const storageTypes = [
      'supabase-storage',
      'google-cloud-storage',
      'aws-s3',
      'cloudflare-r2',
      'local-storage',
      'supabase'
    ];

    const storageConfig = await IntegrationConfig.findByStoreAndTypes(storeId, storageTypes);

    if (!storageConfig) {
      return null;
    }

    return {
      type: storageConfig.integration_type,
      isActive: storageConfig.is_active,
      connectionStatus: storageConfig.connection_status,
      lastTested: storageConfig.connection_tested_at,
      // Don't expose sensitive config data
      hasConfig: !!storageConfig.config_data
    };
  }

  /**
   * Switch to a different storage provider
   */
  static async switchProvider(storeId, newProviderType, config) {
    // Deactivate current provider
    await IntegrationConfig.update(
      { is_active: false },
      {
        where: {
          store_id: storeId,
          integration_type: {
            [Op.in]: [
              'supabase-storage',
              'google-cloud-storage',
              'aws-s3',
              'cloudflare-r2',
              'local-storage'
            ]
          }
        }
      }
    );

    // Create or activate new provider
    await IntegrationConfig.createOrUpdate(storeId, newProviderType, config);

    // Clear cache
    this.clearCache(storeId);

    return {
      success: true,
      message: `Storage provider switched to ${newProviderType}`,
      provider: newProviderType
    };
  }
}

module.exports = StorageManager;
