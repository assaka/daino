#!/usr/bin/env node

/**
 * Migration runner to create custom_domains table and related tables
 *
 * Usage:
 *   node backend/src/database/migrations/run-create-custom-domains.js <storeId>
 */

const fs = require('fs');
const path = require('path');
const ConnectionManager = require('../src/services/database/ConnectionManager');

async function runMigration() {
  try {
    const storeId = process.argv[2];

    if (!storeId) {
      console.error('❌ Error: storeId is required');
      console.log('Usage: node run-create-custom-domains.js <storeId>');
      process.exit(1);
    }

    console.log('🚀 Starting migration: Create custom_domains tables');
    console.log(`📦 Store ID: ${storeId}`);

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'create-custom-domains-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');

    // Get store connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    console.log('✅ Connected to store database');

    // For Supabase, we can't execute raw SQL directly
    // We need to manually create the table using the Supabase client API
    // or use SQL directly through Supabase dashboard

    console.log('🔄 Creating custom_domains table...');

    // Since Supabase doesn't support raw SQL through the JS client easily,
    // we'll check if the table exists first by trying to query it
    const { error: checkError } = await tenantDb
      .from('custom_domains')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('ℹ️  custom_domains table already exists');

      // Verify the table structure
      const { data, error } = await tenantDb
        .from('custom_domains')
        .select('*')
        .limit(0);

      if (!error) {
        console.log('✅ custom_domains table is accessible and ready');
      }
    } else {
      console.error('❌ custom_domains table does not exist');
      console.log('\n📋 Please run the following SQL in your Supabase SQL Editor:');
      console.log('=' . repeat(80));
      console.log(migrationSQL);
      console.log('='.repeat(80));
      console.log('\nOr use the Supabase dashboard to create the table.');
      process.exit(1);
    }

    console.log('✅ Migration verification completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
