const StorageInterface = require('./storage-interface');
const { v4: uuidv4 } = require('uuid');
const ConnectionManager = require('./database/ConnectionManager');

/**
 * Flexible Storage Manager
 * Makes it easy to change media paths by switching between different storage providers
 * All providers implement the same interface for consistent behavior
 */
class StorageManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.fallbackProvider = null;
    
    // Initialize available providers
    this.initializeProviders();
  }

  /**
   * Initialize and register all available storage providers
   */
  initializeProviders() {
    // Register Supabase provider (if available)
    try {
      const SupabaseStorageProvider = require('./supabase-storage-provider');
      this.registerProvider('supabase', new SupabaseStorageProvider());
    } catch (e) {
      console.log('Supabase storage provider not available:', e.message);
    }

    // Register Local storage provider (if available)
    try {
      const LocalStorageProvider = require('./local-storage-provider');
      this.registerProvider('local', new LocalStorageProvider());
    } catch (e) {
      console.log('Local storage provider not available:', e.message);
    }

    // Register AWS S3 provider (if available)
    try {
      const S3StorageProvider = require('./s3-storage-provider');
      this.registerProvider('s3', new S3StorageProvider());
    } catch (e) {
      console.log('S3 storage provider not available:', e.message);
    }

    // Register Google Cloud Storage provider (if available)
    try {
      const GCSStorageProvider = require('./gcs-storage-provider');
      this.registerProvider('gcs', new GCSStorageProvider());
    } catch (e) {
      console.log('GCS storage provider not available:', e.message);
    }

    // Set default provider (prefer cloud storage)
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.includes('supabase')) {
      this.setProvider('supabase');
    } else if (availableProviders.includes('s3')) {
      this.setProvider('s3');
    } else if (availableProviders.includes('gcs')) {
      this.setProvider('gcs');
    } else if (availableProviders.includes('local')) {
      this.setProvider('local');
    }
  }

  /**
   * Register a storage provider
   * @param {string} name - Provider name
   * @param {StorageInterface} provider - Provider instance
   */
  registerProvider(name, provider) {
    if (!(provider instanceof StorageInterface)) {
      console.warn(`Provider '${name}' does not implement StorageInterface`);
    }
    this.providers.set(name, provider);
    console.log(`📦 Registered storage provider: ${name}`);
  }

  /**
   * Set the active storage provider (easily change media paths!)
   * @param {string} providerName - Name of the provider to use
   */
  setProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Storage provider '${providerName}' is not registered`);
    }
    this.currentProvider = this.providers.get(providerName);
    console.log(`🔄 Switched to storage provider: ${providerName} - All media paths will now use ${providerName}`);
  }

  /**
   * Get current active provider
   * @returns {StorageInterface} Current storage provider
   */
  getCurrentProvider() {
    if (!this.currentProvider) {
      throw new Error('No storage provider is currently set. Call setProvider() first.');
    }
    return this.currentProvider;
  }

  /**
   * Helper to add timeout to a promise
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise that rejects on timeout
   */
  _withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }

  /**
   * Get storage provider for a specific store (store-aware)
   * Checks store configuration to determine best available provider
   * @param {string} storeId - Store identifier
   * @returns {Promise<Object>} Provider info with type and instance
   */
  async getStorageProvider(storeId) {
    // First check if store has a default media storage provider configured
    try {
      const { masterDbClient } = require('../database/masterConnection');

      const { data: store, error } = await masterDbClient
        .from('stores')
        .select('settings')
        .eq('id', storeId)
        .maybeSingle();

      if (error) {
        console.log(`Could not check store default provider:`, error.message);
        throw error;
      }

      // Check for default_mediastorage_provider first, then fall back to default_database_provider
      const defaultProvider = store?.settings?.default_mediastorage_provider ||
                             store?.settings?.default_database_provider;

      if (defaultProvider) {
        console.log(`Store ${storeId} has default storage provider: ${defaultProvider}`);

        // Check if it's Supabase and configured
        if (defaultProvider === 'supabase' && this.providers.has('supabase')) {
          try {
            const supabaseIntegration = require('./supabase-integration');
            // Add 3 second timeout to prevent hanging
            const connectionStatus = await this._withTimeout(
              supabaseIntegration.getConnectionStatus(storeId),
              3000
            );

            if (connectionStatus.connected) {
              return {
                type: 'supabase',
                provider: this.providers.get('supabase'),
                name: 'Supabase Storage'
              };
            }
          } catch (error) {
            console.log(`Supabase configured but not connected for store ${storeId}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.log(`Could not check store default provider:`, error.message);
    }

    // Check if Supabase is configured for this store (fallback to direct check)
    if (this.providers.has('supabase')) {
      try {
        const supabaseIntegration = require('./supabase-integration');
        // Add 3 second timeout to prevent hanging
        const connectionStatus = await this._withTimeout(
          supabaseIntegration.getConnectionStatus(storeId),
          3000
        );

        if (connectionStatus.connected) {
          return {
            type: 'supabase',
            provider: this.providers.get('supabase'),
            name: 'Supabase Storage'
          };
        }
      } catch (error) {
        console.log(`Supabase not available for store ${storeId}:`, error.message);
      }
    }

    // Check other providers in order of preference
    const preferenceOrder = ['s3', 'gcs'];
    for (const providerType of preferenceOrder) {
      if (this.providers.has(providerType)) {
        // For cloud providers, check store-specific configuration
        // TODO: Add store-specific configuration checks for S3, GCS, etc.
        return {
          type: providerType,
          provider: this.providers.get(providerType),
          name: this.getProviderDisplayName(providerType)
        };
      }
    }
    
    // No providers available - provide a helpful error message
    throw new Error('No storage provider is configured for this store. Please connect Supabase, AWS S3, or Google Cloud Storage in the integrations settings.');
  }

  /**
   * Check if a provider is available for a specific store
   * @param {string} providerType - Provider type to check
   * @param {string} storeId - Store identifier
   * @returns {Promise<boolean>} True if provider is available
   */
  async isProviderAvailable(providerType, storeId) {
    if (!this.providers.has(providerType)) {
      return false;
    }

    if (providerType === 'supabase') {
      try {
        const supabaseIntegration = require('./supabase-integration');
        // Add 3 second timeout to prevent hanging
        const connectionStatus = await this._withTimeout(
          supabaseIntegration.getConnectionStatus(storeId),
          3000
        );
        return connectionStatus.connected;
      } catch (error) {
        console.log(`Timeout or error checking Supabase availability:`, error.message);
        return false;
      }
    }

    // For other providers, assume available if registered
    // TODO: Add proper configuration checks
    return true;
  }

  /**
   * Get display name for provider
   * @param {string} providerType - Provider type
   * @returns {string} Display name
   */
  getProviderDisplayName(providerType) {
    const names = {
      'supabase': 'Supabase Storage',
      'gcs': 'Google Cloud Storage', 
      's3': 'Amazon S3',
      'local': 'Local Storage'
    };
    return names[providerType] || providerType;
  }

  /**
   * Get list of available providers
   * @returns {Array<string>} Provider names
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Upload a file using the store-configured provider with fallback support
   * @param {string} storeId - Store identifier
   * @param {Object} file - File object
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with provider info
   */
  async uploadFile(storeId, file, options = {}) {
    console.log(`[StorageManager] Starting upload for store: ${storeId}`);
    console.log(`[StorageManager] File details:`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      hasBuffer: !!file.buffer
    });
    console.log(`[StorageManager] Options:`, options);
    
    try {
      const storeProvider = await this.getStorageProvider(storeId);
      console.log(`[StorageManager] Using provider: ${storeProvider.type}`);
      
      const result = await storeProvider.provider.uploadFile(storeId, file, options);
      
      console.log(`📦 Storage Manager: Upload completed via ${storeProvider.type}`);
      console.log(`[StorageManager] Full result:`, result);
      console.log(`   Result URL: ${result.url}`);
      console.log(`   Result bucket: ${result.bucket}`);
      
      // Track file in media_assets table for all uploads
      // This ensures category, product, and library uploads all appear in Media Library
      try {
        // Determine the folder based on upload type with new consolidated structure
        // Use simple folder names for database, not full paths
        let folder = 'library';
        if (options.folder === 'category' || options.type === 'category' || options.folder?.startsWith('category')) {
          folder = 'category';
        } else if (options.folder === 'product' || options.folder === 'products' || options.type === 'product' || options.folder?.startsWith('product')) {
          folder = 'product';
        } else if (options.folder && !options.folder.includes('/')) {
          // Only use custom folder if it's a simple name (no path)
          folder = options.folder;
        }

        // Get tenant DB connection
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);

        const filePath = result.path || result.fullPath;

        // Check if asset already exists for this store and file path
        const { data: existingAsset, error: findError } = await tenantDb
          .from('media_assets')
          .select('*')
          .eq('store_id', storeId)
          .eq('file_path', filePath)
          .maybeSingle();

        if (findError) {
          throw findError;
        }

        const assetData = {
          store_id: storeId,
          file_name: result.filename || result.name,
          original_name: result.originalname || file.originalname,
          file_path: filePath,
          file_url: result.url || result.publicUrl,
          mime_type: result.mimetype || result.mimeType,
          file_size: result.size,
          folder: folder,
          uploaded_by: options.userId || null,
          demo: options.demo || false,
          metadata: {
            bucket: result.bucket,
            provider: storeProvider.type,
            ...result.metadata
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('📦 Creating media_assets record:', {
          file_name: assetData.file_name,
          file_path: assetData.file_path,
          mime_type: assetData.mime_type,
          folder: assetData.folder
        });

        let mediaAssetId;

        if (existingAsset) {
          // Update existing record with new upload data
          const { error: updateError } = await tenantDb
            .from('media_assets')
            .update({
              ...assetData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAsset.id);

          if (updateError) {
            throw updateError;
          }
          mediaAssetId = existingAsset.id;
        } else {
          // Create new record
          const newId = uuidv4();
          const { error: insertError } = await tenantDb
            .from('media_assets')
            .insert({
              id: newId,
              ...assetData
            });

          if (insertError) {
            throw insertError;
          }
          mediaAssetId = newId;
        }

        return {
          ...result,
          provider: storeProvider.type,
          fallbackUsed: false,
          mediaAssetId
        };
      } catch (dbError) {
        console.error('❌ Failed to track media asset in database:');
        console.error('   Error:', dbError.message);
        console.error('   Code:', dbError.code);
        console.error('   Details:', dbError.details);
        console.error('   Hint:', dbError.hint);
        console.error('   Full error:', JSON.stringify(dbError, null, 2));
        // Don't fail the upload if database tracking fails
      }

      return {
        ...result,
        provider: storeProvider.type,
        fallbackUsed: false
      };
    } catch (error) {
      console.error(`Storage provider error for store ${storeId}:`, error.message);
      
      // In production, if no storage provider is configured, throw a clear error
      if (error.message.includes('No storage provider is configured')) {
        throw new Error('No storage provider is configured. Please connect a storage provider (Supabase, AWS S3, or Google Cloud Storage) in the integrations settings.');
      }
      
      // Try fallback provider if available and not in production
      if (this.fallbackProvider && process.env.NODE_ENV !== 'production') {
        console.log(`🔄 Attempting fallback to ${this.fallbackProvider.getProviderName()}...`);
        try {
          const result = await this.fallbackProvider.uploadFile(storeId, file, options);
          return {
            ...result,
            provider: this.fallbackProvider.getProviderName(),
            fallbackUsed: true
          };
        } catch (fallbackError) {
          console.error(`Fallback provider also failed:`, fallbackError.message);
          throw new Error(`Both store provider and fallback storage providers failed. Store: ${error.message}, Fallback: ${fallbackError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Upload multiple files
   * @param {string} storeId - Store identifier
   * @param {Array} files - Array of file objects
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload results
   */
  async uploadMultipleFiles(storeId, files, options = {}) {
    const storeProvider = await this.getStorageProvider(storeId);
    return await storeProvider.provider.uploadMultipleFiles(storeId, files, options);
  }

  /**
   * Delete a file
   * @param {string} storeId - Store identifier
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Deletion result
   */
  async deleteFile(storeId, filePath) {
    const storeProvider = await this.getStorageProvider(storeId);
    return await storeProvider.provider.deleteFile(storeId, filePath);
  }

  /**
   * List files
   * @param {string} storeId - Store identifier
   * @param {string} folder - Folder path
   * @param {Object} options - List options
   * @returns {Promise<Object>} File list
   */
  async listFiles(storeId, folder = null, options = {}) {
    console.log('🔍 StorageManager.listFiles called with:', { storeId, folder, options });

    const storeProvider = await this.getStorageProvider(storeId);
    console.log('📦 Using storage provider:', { type: storeProvider.type, config: !!storeProvider.provider });

    const startTime = Date.now();
    const result = await storeProvider.provider.listFiles(storeId, folder, options);
    const duration = Date.now() - startTime;

    console.log(`✅ Provider.listFiles completed in ${duration}ms:`, {
      filesCount: result?.files?.length || 0,
      resultKeys: Object.keys(result || {})
    });

    // Add provider info to the response
    return {
      ...result,
      provider: storeProvider.type
    };
  }

  /**
   * Get storage statistics
   * @param {string} storeId - Store identifier
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats(storeId) {
    const storeProvider = await this.getStorageProvider(storeId);
    return await storeProvider.provider.getStorageStats(storeId);
  }

  /**
   * Switch to a different provider (makes changing media paths easy!)
   * @param {string} newProviderName - Name of the new provider
   * @param {string} storeId - Store ID for testing connection
   * @returns {Promise<Object>} Switch result
   */
  async switchProvider(newProviderName, storeId = null) {
    if (!this.providers.has(newProviderName)) {
      throw new Error(`Provider '${newProviderName}' is not registered`);
    }

    const oldProvider = this.currentProvider?.getProviderName();
    const newProvider = this.providers.get(newProviderName);

    // Test connection if store ID provided
    if (storeId) {
      try {
        await newProvider.testConnection(storeId);
      } catch (error) {
        throw new Error(`Cannot switch to '${newProviderName}': connection test failed - ${error.message}`);
      }
    }

    this.setProvider(newProviderName);

    return {
      success: true,
      message: `Successfully switched from '${oldProvider}' to '${newProviderName}' - All media paths will now use ${newProviderName}`,
      oldProvider,
      newProvider: newProviderName
    };
  }

  /**
   * Get current provider name
   * @returns {string} Current provider name
   */
  getCurrentProviderName() {
    return this.currentProvider ? this.currentProvider.getProviderName() : null;
  }

  /**
   * Test connection to store's configured provider
   * @param {string} storeId - Store identifier  
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(storeId) {
    const storeProvider = await this.getStorageProvider(storeId);
    return await storeProvider.provider.testConnection(storeId);
  }

  /**
   * Set fallback provider for redundancy
   * @param {string} providerName - Name of the fallback provider
   */
  setFallbackProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Fallback storage provider '${providerName}' is not registered`);
    }
    this.fallbackProvider = this.providers.get(providerName);
    console.log(`🛡️  Set fallback storage provider: ${providerName}`);
  }
}

module.exports = new StorageManager();