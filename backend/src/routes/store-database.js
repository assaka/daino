const express = require('express');
const router = express.Router();
const { masterDbClient } = require('../database/masterConnection');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkStoreOwnership } = require('../middleware/storeAuth');

// Get default database provider for a store
router.get('/stores/:storeId/default-database-provider', 
  checkStoreOwnership,
  async (req, res) => {
    try {
      const { storeId } = req.params;

      const { data: store, error } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (error || !store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Get the default database provider from store settings
      const defaultProvider = store.settings?.default_database_provider || null;

      res.json({
        success: true,
        provider: defaultProvider,
        store_id: storeId
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch default database provider' 
      });
    }
  }
);

// Set default database provider for a store
router.post('/stores/:storeId/default-database-provider', 
  checkStoreOwnership,
  async (req, res) => {
    try {
      const { storeId } = req.params;
      const { provider } = req.body;
      
      // Validate provider - includes both database and storage providers
      const validDatabaseProviders = ['supabase', 'aiven', 'aws-rds', 'google-cloud-sql', 'azure-database', 'planetscale'];
      // Storage providers - match the frontend values exactly
      const validStorageProviders = ['supabase', 'cloudflare', 'aws-s3', 'google-storage', 'azure-blob'];
      const allValidProviders = [...new Set([...validDatabaseProviders, ...validStorageProviders])];
      
      if (!allValidProviders.includes(provider)) {
        return res.status(400).json({
          success: false,
          message: `Invalid database/storage provider: ${provider}`
        });
      }

      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Update store settings with default database provider
      // Also set as media storage provider if it's a storage-capable provider
      const currentSettings = store.settings || {};
      const updatedSettings = {
        ...currentSettings,
        default_database_provider: provider,
        default_database_provider_updated_at: new Date().toISOString()
      };

      // If the provider supports storage (like Supabase), also set it as media storage provider
      const storageCapableProviders = ['supabase', 'aws-s3', 'google-storage', 'azure-blob', 'cloudflare'];
      if (storageCapableProviders.includes(provider)) {
        updatedSettings.default_mediastorage_provider = provider;
        updatedSettings.default_mediastorage_provider_updated_at = new Date().toISOString();
      }

      // Update the store in master DB
      const { error: updateError } = await masterDbClient
        .from('stores')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to update store: ${updateError.message}`);
      }

      // Fetch updated store
      const { data: updatedStore } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      res.json({
        success: true,
        message: `${provider} set as default database provider`,
        provider: provider,
        store_id: storeId
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to set default database provider' 
      });
    }
  }
);

// Clear default database provider for a store
router.delete('/stores/:storeId/default-database-provider', 
  checkStoreOwnership,
  async (req, res) => {
    try {
      const { storeId } = req.params;

      const { data: store, error: fetchError } = await masterDbClient
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (fetchError || !store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Remove default database provider from store settings
      const currentSettings = store.settings || {};
      const updatedSettings = { ...currentSettings };
      delete updatedSettings.default_database_provider;
      delete updatedSettings.default_database_provider_updated_at;

      // Update the store in master DB
      const { error: updateError } = await masterDbClient
        .from('stores')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to update store: ${updateError.message}`);
      }
      
      res.json({
        success: true,
        message: 'Default database provider cleared',
        store_id: storeId
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to clear default database provider' 
      });
    }
  }
);

module.exports = router;