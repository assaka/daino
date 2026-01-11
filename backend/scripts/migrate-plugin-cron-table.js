/**
 * Migration Script: Create plugin_cron table for all stores
 *
 * Run this script to add the plugin_cron table to all existing tenant databases.
 *
 * Usage: node backend/scripts/migrate-plugin-cron-table.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { masterDbClient } = require('../src/database/masterConnection');
const ConnectionManager = require('../src/services/database/ConnectionManager');

const PLUGIN_CRON_SQL = `
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
  console.log('='.repeat(60));
  console.log('Plugin Cron Table Migration');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. Get all active stores from master database
    console.log('Fetching all stores from master database...');
    const { data: stores, error: storesError } = await masterDbClient
      .from('store_databases')
      .select('store_id, database_type')
      .eq('is_active', true);

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      console.log('No active stores found.');
      return;
    }

    console.log(`Found ${stores.length} active store(s).\n`);

    // 2. Iterate through each store and create the table
    let successCount = 0;
    let errorCount = 0;

    for (const store of stores) {
      const storeId = store.store_id;
      console.log(`[${successCount + errorCount + 1}/${stores.length}] Processing store: ${storeId}`);

      try {
        // Get connection to tenant database
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);

        // Try to execute SQL via RPC
        try {
          const { error: rpcError } = await tenantDb.rpc('execute_sql', { sql: PLUGIN_CRON_SQL });

          if (rpcError) {
            // RPC failed, try alternative method - check if table exists by querying it
            console.log(`   RPC failed, checking if table exists...`);
            const { error: checkError } = await tenantDb.from('plugin_cron').select('id').limit(1);

            if (checkError && checkError.message.includes('does not exist')) {
              console.log(`   ❌ Table does not exist and could not be created via RPC`);
              console.log(`   ⚠️  Please create manually in Supabase SQL Editor for store: ${storeId}`);
              errorCount++;
              continue;
            } else if (!checkError) {
              console.log(`   ✅ Table already exists`);
              successCount++;
              continue;
            }
          }
        } catch (rpcErr) {
          // RPC might not exist, check if table exists
          const { error: checkError } = await tenantDb.from('plugin_cron').select('id').limit(1);

          if (!checkError) {
            console.log(`   ✅ Table already exists`);
            successCount++;
            continue;
          }

          console.log(`   ❌ Could not create table: ${rpcErr.message}`);
          errorCount++;
          continue;
        }

        console.log(`   ✅ Table created successfully`);
        successCount++;

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    // 3. Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('');

    if (errorCount > 0) {
      console.log('For failed stores, please run this SQL manually in Supabase SQL Editor:');
      console.log('');
      console.log(PLUGIN_CRON_SQL);
    }

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateAllStores()
  .then(() => {
    console.log('Migration complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
