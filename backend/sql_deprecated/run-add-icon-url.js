#!/usr/bin/env node

/**
 * Migration runner to add icon_url column to payment_methods table
 *
 * Usage:
 *   node backend/src/database/migrations/run-add-icon-url.js <storeId>
 */

const fs = require('fs');
const path = require('path');
const ConnectionManager = require('../src/services/database/ConnectionManager');

async function runMigration() {
  try {
    const storeId = process.argv[2];

    if (!storeId) {
      console.error('❌ Error: storeId is required');
      console.log('Usage: node run-add-icon-url.js <storeId>');
      process.exit(1);
    }

    console.log('🚀 Starting migration: Add icon_url to payment_methods');
    console.log(`📦 Store ID: ${storeId}`);

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-icon-url-to-payment-methods.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');

    // Get store connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    console.log('✅ Connected to store database');

    // Execute the migration using Supabase client's RPC
    console.log('🔄 Running migration...');

    // For Supabase, we need to use the raw SQL query
    const { error } = await tenantDb.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Try alternative approach if exec_sql RPC doesn't exist
      console.log('📝 Trying alternative migration approach...');

      // Split into statements and execute
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await tenantDb.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            console.error('❌ Error executing statement:', stmtError);
            throw stmtError;
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');

    // Verify the column was added
    console.log('🔍 Verifying migration...');
    const { data: testData, error: testError } = await tenantDb
      .from('payment_methods')
      .select('id, icon_url')
      .limit(1);

    if (testError) {
      console.error('❌ Verification failed:', testError);
    } else {
      console.log('✅ Verification successful - icon_url column is accessible');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
