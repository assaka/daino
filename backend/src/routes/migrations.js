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

module.exports = router;
