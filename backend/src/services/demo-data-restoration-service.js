'use strict';

const ConnectionManager = require('./database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');
const StorageManager = require('./storage-manager');

/**
 * Demo Data Restoration Service
 *
 * Clears all demo data from a store and restores it to active state.
 * Only deletes rows where demo=true, preserving user-added data.
 * Also removes demo files from storage.
 */
class DemoDataRestorationService {
  constructor(storeId) {
    this.storeId = storeId;
    this.tenantDb = null;
  }

  /**
   * Initialize tenant database connection
   */
  async initialize() {
    this.tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
  }

  /**
   * Delete demo files from storage
   * @returns {Promise<number>} Number of files deleted
   */
  async deleteDemoFilesFromStorage() {
    let filesDeleted = 0;

    try {
      // Get all demo media_assets with their file paths
      const { data: demoAssets, error } = await this.tenantDb
        .from('media_assets')
        .select('id, file_path, file_url')
        .eq('store_id', this.storeId)
        .eq('demo', true);

      if (error) {
        console.warn('[DemoRestore] Error fetching demo media_assets:', error.message);
        return 0;
      }

      if (!demoAssets || demoAssets.length === 0) {
        console.log('[DemoRestore] No demo files to delete from storage');
        return 0;
      }

      console.log(`[DemoRestore] Deleting ${demoAssets.length} demo files from storage...`);

      for (const asset of demoAssets) {
        try {
          if (asset.file_path && !asset.file_path.startsWith('http')) {
            await StorageManager.deleteFile(this.storeId, asset.file_path);
            filesDeleted++;
          }
        } catch (deleteErr) {
          // Don't fail the whole operation if one file fails
          console.warn(`[DemoRestore] Could not delete file ${asset.file_path}: ${deleteErr.message}`);
        }
      }

      console.log(`[DemoRestore] Deleted ${filesDeleted} demo files from storage`);
      return filesDeleted;

    } catch (err) {
      console.error('[DemoRestore] Error deleting demo files:', err.message);
      return filesDeleted;
    }
  }

  /**
   * Tables to clear in correct order (respecting foreign key constraints)
   * Order matters: child tables must be cleared before parent tables
   */
  static TABLES_TO_CLEAR = [
    // Order-related (must be first due to FKs)
    'sales_order_items',
    'sales_shipments',
    'sales_invoices',
    'sales_orders',

    // Customer-related
    'customer_activities',
    'customer_addresses',
    'customers',

    // Product-related (order matters for FKs)
    'product_files',
    'product_attribute_values',
    'product_translations',
    'products',

    // Media assets (after product_files due to FK)
    'media_assets',

    // Attribute-related
    'attribute_value_translations',
    'attribute_values',
    'attribute_translations',
    'attributes',
    'attribute_sets',

    // Category-related
    'category_translations',
    'categories',

    // CMS-related
    'cms_page_translations',
    'cms_pages',
    'cms_block_translations',
    'cms_blocks',

    // Configuration
    'custom_option_rules',
    'product_tabs',
    'product_labels',
    'taxes',
    'coupons',
    'seo_templates'
  ];

  /**
   * Restore store by clearing all demo data
   * @returns {Promise<Object>} Restoration result
   */
  async restoreStore() {
    await this.initialize();
    console.log(`[DemoRestore] Starting restoration for store: ${this.storeId}`);

    const deletedCounts = {};
    const errors = [];

    try {
      // Delete demo files from storage BEFORE deleting database records
      const filesDeleted = await this.deleteDemoFilesFromStorage();
      deletedCounts['storage_files'] = filesDeleted;

      for (const table of DemoDataRestorationService.TABLES_TO_CLEAR) {
        try {
          // Delete rows where demo=true and store_id matches
          const { data, error, count } = await this.tenantDb
            .from(table)
            .delete()
            .eq('store_id', this.storeId)
            .eq('demo', true)
            .select('id');

          if (error) {
            // Try without store_id filter for tables that might not have it
            const { data: retryData, error: retryError } = await this.tenantDb
              .from(table)
              .delete()
              .eq('demo', true)
              .select('id');

            if (retryError) {
              console.warn(`[DemoRestore] Warning: Could not clear ${table}: ${retryError.message}`);
              errors.push({ table, error: retryError.message });
              deletedCounts[table] = 0;
            } else {
              deletedCounts[table] = retryData?.length || 0;
              console.log(`[DemoRestore] Deleted ${deletedCounts[table]} demo rows from ${table}`);
            }
          } else {
            deletedCounts[table] = data?.length || 0;
            console.log(`[DemoRestore] Deleted ${deletedCounts[table]} demo rows from ${table}`);
          }
        } catch (tableError) {
          console.warn(`[DemoRestore] Error clearing ${table}: ${tableError.message}`);
          errors.push({ table, error: tableError.message });
          deletedCounts[table] = 0;
        }
      }

      // Update store status to 'active' and set published=false (paused)
      console.log('[DemoRestore] Updating store status to active...');
      const { error: updateError } = await masterDbClient
        .from('stores')
        .update({
          status: 'active',
          published: false, // Paused state
          updated_at: new Date().toISOString()
        })
        .eq('id', this.storeId);

      if (updateError) {
        throw new Error(`Failed to update store status: ${updateError.message}`);
      }

      const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
      console.log(`[DemoRestore] Restoration complete. Total rows deleted: ${totalDeleted}`);

      return {
        success: true,
        deletedCounts,
        totalDeleted,
        errors: errors.length > 0 ? errors : null,
        newStatus: 'active',
        published: false
      };

    } catch (error) {
      console.error('[DemoRestore] Restoration failed:', error);
      throw error;
    }
  }

  /**
   * Check if store has demo data
   * @returns {Promise<Object>} Demo data status
   */
  async checkDemoStatus() {
    await this.initialize();

    const demoDataCounts = {};
    let hasDemoData = false;

    // Check a few key tables for demo data
    const tablesToCheck = ['products', 'categories', 'customers', 'sales_orders'];

    for (const table of tablesToCheck) {
      try {
        const { data, error } = await this.tenantDb
          .from(table)
          .select('id', { count: 'exact' })
          .eq('store_id', this.storeId)
          .eq('demo', true)
          .limit(1);

        if (!error && data && data.length > 0) {
          hasDemoData = true;
          demoDataCounts[table] = true;
        } else {
          demoDataCounts[table] = false;
        }
      } catch (err) {
        demoDataCounts[table] = 'unknown';
      }
    }

    return {
      hasDemoData,
      tables: demoDataCounts
    };
  }
}

module.exports = DemoDataRestorationService;
