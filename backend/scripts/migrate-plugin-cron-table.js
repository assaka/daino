/**
 * Migration Script: Create plugin_cron table AND execute_sql function for all stores
 *
 * This script adds the plugin_cron table and execute_sql function to all existing
 * tenant databases using direct PostgreSQL connections.
 *
 * Usage: node backend/scripts/migrate-plugin-cron-table.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { masterDbClient } = require('../src/database/masterConnection');
const { decryptDatabaseCredentials } = require('../src/utils/encryption');

// SQL to create the execute_sql function (needed for future migrations via REST API)
const EXECUTE_SQL_FUNCTION = `
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $
BEGIN
  EXECUTE sql;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO anon;
`;

// SQL to create the plugin_cron table
const PLUGIN_CRON_TABLE = `
CREATE TABLE IF NOT EXISTS plugin_cron (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  cron_name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_schedule VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  handler_method VARCHAR(255) NOT NULL,
  handler_code TEXT,
  handler_params JSONB DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_status VARCHAR(50),
  last_error TEXT,
  last_result JSONB,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  max_runs INTEGER,
  max_failures INTEGER DEFAULT 5,
  timeout_seconds INTEGER DEFAULT 300,
  cron_job_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_cron_plugin_id ON plugin_cron(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_cron_enabled ON plugin_cron(is_enabled) WHERE is_enabled = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_cron_unique_name ON plugin_cron(plugin_id, cron_name);
`;

async function migrateAllStores() {
  console.log('='.repeat(70));
  console.log('Plugin Cron Table & Execute SQL Function Migration');
  console.log('='.repeat(70));
  console.log('');

  try {
    // 1. Get all active stores with their encrypted credentials
    console.log('Fetching all stores from master database...');
    const { data: stores, error: storesError } = await masterDbClient
      .from('store_databases')
      .select('store_id, database_type, connection_string_encrypted, host')
      .eq('is_active', true);

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      console.log('No active stores found.');
      return;
    }

    console.log(`Found ${stores.length} active store(s).\n`);

    // 2. Iterate through each store
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const failedStores = [];

    for (const store of stores) {
      const storeId = store.store_id;
      console.log(`\n[${successCount + errorCount + skippedCount + 1}/${stores.length}] Processing store: ${storeId}`);
      console.log(`   Database type: ${store.database_type}`);
      console.log(`   Host: ${store.host || 'N/A'}`);

      try {
        // Decrypt credentials
        if (!store.connection_string_encrypted) {
          console.log('   ⚠️  No encrypted credentials found, skipping...');
          skippedCount++;
          continue;
        }

        const credentials = decryptDatabaseCredentials(store.connection_string_encrypted);

        // Check if we have a valid connection string
        if (!credentials.connectionString) {
          console.log('   ⚠️  No connectionString in credentials');

          // Try to construct one for Supabase if we have the details
          if (store.database_type === 'supabase' && credentials.projectUrl) {
            console.log('   ℹ️  Supabase store without direct connection string');
            console.log('   ⚠️  Please run the SQL manually in Supabase SQL Editor');
            failedStores.push({ storeId, reason: 'No direct connection string - Supabase OAuth store' });
            errorCount++;
            continue;
          }

          skippedCount++;
          continue;
        }

        // Check for password placeholder
        if (credentials.connectionString.includes('[password]')) {
          console.log('   ⚠️  Connection string has [password] placeholder');
          console.log('   ⚠️  Please run the SQL manually in Supabase SQL Editor');
          failedStores.push({ storeId, reason: 'Connection string has password placeholder' });
          errorCount++;
          continue;
        }

        // Connect directly via PostgreSQL
        const { Client } = require('pg');
        const pgClient = new Client({
          connectionString: credentials.connectionString,
          ssl: { rejectUnauthorized: false }
        });

        console.log('   Connecting to PostgreSQL...');
        await pgClient.connect();

        // First, create the execute_sql function
        console.log('   Creating execute_sql function...');
        try {
          await pgClient.query(EXECUTE_SQL_FUNCTION);
          console.log('   ✅ execute_sql function created');
        } catch (funcError) {
          if (funcError.message.includes('already exists')) {
            console.log('   ✅ execute_sql function already exists');
          } else {
            console.log(`   ⚠️  execute_sql function error: ${funcError.message}`);
          }
        }

        // Then, create the plugin_cron table
        console.log('   Creating plugin_cron table...');
        try {
          await pgClient.query(PLUGIN_CRON_TABLE);
          console.log('   ✅ plugin_cron table created');
        } catch (tableError) {
          if (tableError.message.includes('already exists')) {
            console.log('   ✅ plugin_cron table already exists');
          } else {
            throw tableError;
          }
        }

        await pgClient.end();
        console.log('   ✅ Migration complete for this store');
        successCount++;

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        failedStores.push({ storeId, reason: err.message });
        errorCount++;
      }
    }

    // 3. Summary
    console.log('\n');
    console.log('='.repeat(70));
    console.log('Migration Summary');
    console.log('='.repeat(70));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('');

    if (failedStores.length > 0) {
      console.log('Failed stores that need manual migration:');
      console.log('-'.repeat(70));
      for (const { storeId, reason } of failedStores) {
        console.log(`  Store: ${storeId}`);
        console.log(`  Reason: ${reason}`);
        console.log('');
      }

      console.log('\nFor failed stores, please run this SQL manually in the Supabase SQL Editor:');
      console.log('='.repeat(70));
      console.log('\n-- Step 1: Create execute_sql function');
      console.log(EXECUTE_SQL_FUNCTION);
      console.log('\n-- Step 2: Create plugin_cron table');
      console.log(PLUGIN_CRON_TABLE);
    }

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateAllStores()
  .then(() => {
    console.log('\nMigration complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
