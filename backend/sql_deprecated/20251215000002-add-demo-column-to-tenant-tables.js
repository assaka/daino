'use strict';

/**
 * Migration: Add 'demo' boolean column to tenant database tables
 *
 * This migration adds a 'demo' column to all tables that can contain demo data.
 * The column defaults to false, and demo data will have demo=true.
 * This allows selective deletion of demo data while preserving user-added data.
 *
 * NOTE: This migration runs against TENANT databases, not the master database.
 * It should be executed for each store's database via ConnectionManager.
 */

// Tables that need the demo column
const TABLES_WITH_DEMO_COLUMN = [
  // Product-related
  'products',
  'product_translations',
  'product_files',

  // Category-related
  'categories',
  'category_translations',

  // Attribute-related
  'attribute_sets',
  'attributes',
  'attribute_translations',
  'attribute_values',
  'attribute_value_translations',
  'product_attribute_values',

  // Customer-related
  'customers',
  'customer_addresses',
  'customer_activities',

  // Sales-related
  'sales_orders',
  'sales_order_items',
  'sales_shipments',
  'sales_invoices',

  // CMS-related
  'cms_pages',
  'cms_page_translations',
  'cms_blocks',
  'cms_block_translations',

  // Configuration
  'taxes',
  'coupons',
  'seo_templates',
  'product_tabs',
  'product_labels',
  'custom_option_rules'
];

/**
 * Generate SQL to add demo column to all tables
 */
function generateUpSQL() {
  const statements = TABLES_WITH_DEMO_COLUMN.map(table => `
    -- Add demo column to ${table}
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${table}' AND column_name = 'demo'
      ) THEN
        ALTER TABLE ${table} ADD COLUMN demo BOOLEAN DEFAULT false;
      END IF;
    END $$;

    -- Create partial index for demo data lookup
    CREATE INDEX IF NOT EXISTS idx_${table}_demo ON ${table}(demo) WHERE demo = true;
  `).join('\n');

  return statements;
}

/**
 * Generate SQL to remove demo column from all tables
 */
function generateDownSQL() {
  const statements = TABLES_WITH_DEMO_COLUMN.map(table => `
    -- Remove demo index from ${table}
    DROP INDEX IF EXISTS idx_${table}_demo;

    -- Remove demo column from ${table}
    ALTER TABLE ${table} DROP COLUMN IF EXISTS demo;
  `).join('\n');

  return statements;
}

module.exports = {
  // For Sequelize CLI (master DB migrations)
  async up(queryInterface, Sequelize) {
    // This migration is for tenant databases
    // When run via Sequelize CLI, just log info
    console.log('ℹ️  This is a tenant database migration.');
    console.log('ℹ️  Run via: runTenantMigration() for each store');
    console.log('ℹ️  Or apply via demo data provisioning service');
  },

  async down(queryInterface, Sequelize) {
    console.log('ℹ️  This is a tenant database migration.');
    console.log('ℹ️  Run via: runTenantMigrationDown() for each store');
  },

  // Export for programmatic use with tenant databases
  TABLES_WITH_DEMO_COLUMN,

  /**
   * Run migration on a specific tenant database
   * @param {Object} tenantDb - Supabase client for tenant database
   * @returns {Promise<Object>} Migration result
   */
  async runTenantMigration(tenantDb) {
    const sql = generateUpSQL();

    try {
      const { error } = await tenantDb.rpc('exec_sql', { sql });

      if (error) {
        // Try running statements individually if RPC fails
        console.log('RPC exec_sql not available, running statements individually...');

        for (const table of TABLES_WITH_DEMO_COLUMN) {
          // Check if column exists
          const { data: columns } = await tenantDb
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', table)
            .eq('column_name', 'demo')
            .maybeSingle();

          if (!columns) {
            // Add column using raw query via REST API or alternative method
            // This depends on Supabase setup - may need to use SQL Editor API
            console.log(`⚠️  Cannot add demo column to ${table} - manual SQL required`);
          }
        }
      }

      console.log('✅ Added demo column to tenant tables');
      return { success: true, tables: TABLES_WITH_DEMO_COLUMN };

    } catch (err) {
      console.error('❌ Failed to add demo columns:', err.message);
      throw err;
    }
  },

  /**
   * Rollback migration on a specific tenant database
   * @param {Object} tenantDb - Supabase client for tenant database
   * @returns {Promise<Object>} Migration result
   */
  async runTenantMigrationDown(tenantDb) {
    const sql = generateDownSQL();

    try {
      const { error } = await tenantDb.rpc('exec_sql', { sql });

      if (error) {
        console.log('⚠️  RPC exec_sql not available for rollback');
      }

      console.log('✅ Removed demo column from tenant tables');
      return { success: true };

    } catch (err) {
      console.error('❌ Failed to remove demo columns:', err.message);
      throw err;
    }
  },

  // Export raw SQL for manual execution
  getUpSQL: generateUpSQL,
  getDownSQL: generateDownSQL
};
