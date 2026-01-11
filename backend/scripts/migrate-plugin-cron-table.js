/**
 * Migration Script: Create plugin_cron table AND execute_sql function for all stores
 *
 * This script adds the plugin_cron table and execute_sql function to all existing
 * tenant databases using:
 * 1. Direct PostgreSQL connections (if connectionString available)
 * 2. Supabase Management API (if OAuth access token available)
 *
 * Usage: node backend/scripts/migrate-plugin-cron-table.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { decryptDatabaseCredentials } = require('../src/utils/encryption');
const axios = require('axios');
const { Client } = require('pg');

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

/**
 * Execute SQL via Supabase Management API
 */
async function executeSqlViaManagementAPI(oauthAccessToken, projectId, sql) {
  const response = await axios.post(
    `https://api.supabase.com/v1/projects/${projectId}/database/query`,
    { query: sql },
    {
      headers: {
        'Authorization': `Bearer ${oauthAccessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

/**
 * Extract project ID from Supabase URL
 * E.g., https://abc123.supabase.co -> abc123
 */
function extractProjectId(projectUrl) {
  if (!projectUrl) return null;
  const match = projectUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

async function migrateAllStores() {
  console.log('='.repeat(70));
  console.log('Plugin Cron Table & Execute SQL Function Migration');
  console.log('='.repeat(70));
  console.log('');

  // Connect to master database via direct PostgreSQL
  const masterDbUrl = process.env.MASTER_DB_URL;
  if (!masterDbUrl) {
    throw new Error('MASTER_DB_URL environment variable is required');
  }

  console.log('Connecting to master database...');
  const masterClient = new Client({
    connectionString: masterDbUrl,
    ssl: { rejectUnauthorized: false }
  });
  await masterClient.connect();
  console.log('✅ Connected to master database\n');

  try {
    // 1. Get all active stores with their encrypted credentials
    console.log('Fetching all stores from master database...');
    const result = await masterClient.query(`
      SELECT store_id, database_type, connection_string_encrypted, host
      FROM store_databases
      WHERE is_active = true
    `);
    const stores = result.rows;

    if (!stores || stores.length === 0) {
      console.log('No active stores found.');
      await masterClient.end();
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
        const hasValidConnectionString = credentials.connectionString &&
          !credentials.connectionString.includes('[password]');

        // Check if we have OAuth tokens for Management API
        const hasOAuthAccess = credentials.accessToken && credentials.projectUrl;
        const projectId = extractProjectId(credentials.projectUrl);

        if (!hasValidConnectionString && !hasOAuthAccess) {
          console.log('   ⚠️  No valid connection string or OAuth token');

          if (credentials.connectionString?.includes('[password]')) {
            console.log('   ℹ️  Connection string has [password] placeholder');
          }

          if (store.database_type === 'supabase' && credentials.projectUrl) {
            console.log('   ℹ️  Supabase store without direct connection string or OAuth');
          }

          console.log('   ⚠️  Please run the SQL manually in Supabase SQL Editor');
          failedStores.push({ storeId, reason: 'No valid connection method available' });
          errorCount++;
          continue;
        }

        // Method 1: Try OAuth Management API first (if available)
        if (hasOAuthAccess && projectId) {
          console.log('   Trying Supabase Management API...');
          console.log(`   Project ID: ${projectId}`);

          try {
            // Create execute_sql function
            console.log('   Creating execute_sql function via API...');
            await executeSqlViaManagementAPI(credentials.accessToken, projectId, EXECUTE_SQL_FUNCTION);
            console.log('   ✅ execute_sql function created');

            // Create plugin_cron table
            console.log('   Creating plugin_cron table via API...');
            await executeSqlViaManagementAPI(credentials.accessToken, projectId, PLUGIN_CRON_TABLE);
            console.log('   ✅ plugin_cron table created');

            console.log('   ✅ Migration complete for this store (via Management API)');
            successCount++;
            continue;
          } catch (apiError) {
            console.log(`   ⚠️  Management API failed: ${apiError.response?.data?.message || apiError.message}`);

            // If we also have a direct connection string, try that next
            if (hasValidConnectionString) {
              console.log('   Falling back to direct PostgreSQL connection...');
            } else {
              console.log('   ❌ No fallback available');
              failedStores.push({ storeId, reason: `Management API failed: ${apiError.message}` });
              errorCount++;
              continue;
            }
          }
        }

        // Method 2: Connect directly via PostgreSQL
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
  } finally {
    // Close master connection
    await masterClient.end();
    console.log('\n✅ Master database connection closed');
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
