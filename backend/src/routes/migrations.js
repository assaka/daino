// Migration endpoint - run database migrations on production
const express = require('express');
const router = express.Router();
const ConnectionManager = require('../services/database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');

/**
 * POST /api/migrations/make-creator-id-nullable
 * Make creator_id nullable in plugin_registry table
 * NOTE: This runs on tenant DB since plugin_registry is tenant-specific
 */
router.post('/make-creator-id-nullable', async (req, res) => {
  try {
    console.log('🔄 Running migration: make creator_id nullable...');

    // Get store_id from request
    const store_id = req.headers['x-store-id'] || req.query.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        error: 'store_id is required for tenant-specific migration'
      });
    }

    const connection = await ConnectionManager.getStoreConnection(store_id);
    const sequelize = connection.sequelize;

    // Check if already nullable
    const [columns] = await sequelize.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'plugin_registry'
      AND column_name = 'creator_id'
    `);

    if (columns[0]?.is_nullable === 'YES') {
      return res.json({
        success: true,
        message: 'creator_id is already nullable',
        column: columns[0]
      });
    }

    // Make nullable
    await sequelize.query(`
      ALTER TABLE plugin_registry
      ALTER COLUMN creator_id DROP NOT NULL
    `);

    // Verify
    const [updated] = await sequelize.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'plugin_registry'
      AND column_name = 'creator_id'
    `);

    console.log('✅ Migration completed');

    res.json({
      success: true,
      message: 'creator_id is now nullable',
      before: columns[0],
      after: updated[0]
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/migrations/add-store-id-to-theme-defaults
 * Add store_id column to theme_defaults table for store-scoped custom themes
 * NOTE: This runs on MASTER DB
 */
router.post('/add-store-id-to-theme-defaults', async (req, res) => {
  try {
    console.log('🔄 Running migration: add store_id to theme_defaults...');

    // Check if column already exists
    const { data: columns, error: checkError } = await masterDbClient
      .rpc('get_column_info', {
        p_table_name: 'theme_defaults',
        p_column_name: 'store_id'
      });

    // If RPC doesn't exist, try raw query approach
    if (checkError) {
      console.log('Using alternative check method...');

      // Try to select with store_id to see if it exists
      const { error: testError } = await masterDbClient
        .from('theme_defaults')
        .select('store_id')
        .limit(1);

      if (!testError) {
        return res.json({
          success: true,
          message: 'store_id column already exists in theme_defaults'
        });
      }

      // Column doesn't exist, need to add it via Supabase SQL Editor
      return res.json({
        success: false,
        message: 'Column does not exist. Please run this SQL in Supabase SQL Editor:',
        sql: `
ALTER TABLE theme_defaults
ADD COLUMN store_id UUID NULL REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_theme_defaults_store_id
ON theme_defaults(store_id) WHERE store_id IS NOT NULL;
        `.trim()
      });
    }

    if (columns && columns.length > 0) {
      return res.json({
        success: true,
        message: 'store_id column already exists in theme_defaults'
      });
    }

    // Need to add via SQL Editor since Supabase client doesn't support DDL
    res.json({
      success: false,
      message: 'Column does not exist. Please run this SQL in Supabase SQL Editor:',
      sql: `
ALTER TABLE theme_defaults
ADD COLUMN store_id UUID NULL REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_theme_defaults_store_id
ON theme_defaults(store_id) WHERE store_id IS NOT NULL;
      `.trim()
    });

  } catch (error) {
    console.error('❌ Migration check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/migrations/normalize-product-files
 * Add media_asset_id FK to product_files and populate from file_url matching
 * This normalizes the schema to avoid duplicate file_url columns
 */
router.post('/normalize-product-files', async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        error: 'store_id is required'
      });
    }

    console.log(`🔄 Running migration: normalize-product-files for store ${store_id}`);

    const connection = await ConnectionManager.getStoreConnection(store_id);
    const db = connection; // Supabase client

    // Step 1: Check if media_asset_id column already exists
    const { data: existingCol } = await db
      .from('product_files')
      .select('media_asset_id')
      .limit(1);

    const columnExists = existingCol !== null && !existingCol?.error;

    if (!columnExists) {
      // Need to add column via raw SQL
      console.log('   Adding media_asset_id column...');

      // For Supabase, we need to use rpc or SQL editor
      // Return the SQL to run manually
      return res.json({
        success: false,
        requiresManualSQL: true,
        message: 'Please run this SQL in Supabase SQL Editor first:',
        sql: `
-- Step 1: Add media_asset_id column
ALTER TABLE product_files
ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_product_files_media_asset_id
ON product_files(media_asset_id);

-- Step 3: Populate media_asset_id from file_url matching
UPDATE product_files pf
SET media_asset_id = ma.id
FROM media_assets ma
WHERE pf.file_url = ma.file_url
  AND pf.store_id = ma.store_id
  AND pf.media_asset_id IS NULL;

-- Step 4 (Optional - run later after verifying): Drop duplicate columns
-- ALTER TABLE product_files DROP COLUMN file_url;
-- ALTER TABLE product_files DROP COLUMN mime_type;
-- ALTER TABLE product_files DROP COLUMN file_size;
        `.trim()
      });
    }

    // Column exists, populate media_asset_id from file_url matching
    console.log('   Populating media_asset_id from file_url matching...');

    // Get product_files without media_asset_id
    const { data: unlinkedFiles, error: fetchError } = await db
      .from('product_files')
      .select('id, file_url')
      .eq('store_id', store_id)
      .is('media_asset_id', null);

    if (fetchError) {
      throw new Error(`Failed to fetch product_files: ${fetchError.message}`);
    }

    let linkedCount = 0;
    let notFoundCount = 0;

    for (const pf of unlinkedFiles || []) {
      // Find matching media_asset
      const { data: mediaAsset } = await db
        .from('media_assets')
        .select('id')
        .eq('store_id', store_id)
        .eq('file_url', pf.file_url)
        .single();

      if (mediaAsset) {
        // Update product_file with media_asset_id
        const { error: updateError } = await db
          .from('product_files')
          .update({ media_asset_id: mediaAsset.id })
          .eq('id', pf.id);

        if (!updateError) {
          linkedCount++;
        }
      } else {
        notFoundCount++;
      }
    }

    console.log(`✅ Migration completed: ${linkedCount} linked, ${notFoundCount} not found in media_assets`);

    res.json({
      success: true,
      message: 'product_files normalized',
      stats: {
        totalProcessed: (unlinkedFiles || []).length,
        linkedToMediaAssets: linkedCount,
        noMatchingMediaAsset: notFoundCount
      }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/migrations/normalize-product-files-all
 * Run normalize-product-files migration for ALL stores
 */
router.post('/normalize-product-files-all', async (req, res) => {
  try {
    console.log('🔄 Running migration: normalize-product-files for ALL stores');

    // Get all stores
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id, name');

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    const results = [];

    for (const store of stores || []) {
      try {
        const connection = await ConnectionManager.getStoreConnection(store.id);

        // Get unlinked files count
        const { data: unlinkedFiles } = await connection
          .from('product_files')
          .select('id, file_url')
          .eq('store_id', store.id)
          .is('media_asset_id', null);

        let linkedCount = 0;

        for (const pf of unlinkedFiles || []) {
          const { data: mediaAsset } = await connection
            .from('media_assets')
            .select('id')
            .eq('store_id', store.id)
            .eq('file_url', pf.file_url)
            .single();

          if (mediaAsset) {
            await connection
              .from('product_files')
              .update({ media_asset_id: mediaAsset.id })
              .eq('id', pf.id);
            linkedCount++;
          }
        }

        results.push({
          store: store.name,
          storeId: store.id,
          processed: (unlinkedFiles || []).length,
          linked: linkedCount
        });

      } catch (storeError) {
        results.push({
          store: store.name,
          storeId: store.id,
          error: storeError.message
        });
      }
    }

    console.log('✅ Migration completed for all stores');

    res.json({
      success: true,
      message: 'Migration completed for all stores',
      results
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
