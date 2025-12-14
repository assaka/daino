/**
 * Master Database Connection
 *
 * This connection is for the MASTER database which contains:
 * - users (agency/store owners only, includes credits column)
 * - stores (minimal registry)
 * - subscriptions
 * - credit_transactions
 * - store_databases (tenant connection credentials)
 * - store_hostnames (hostname mapping)
 * - job_queue (centralized queue)
 * - usage_metrics, billing_transactions
 *
 * The master DB is used for platform-level management and monitoring.
 * Tenant databases contain store-specific operational data.
 *
 * Uses Supabase REST API (masterDbClient) for all operations.
 */

const { createClient } = require('@supabase/supabase-js');

// ============================================
// MASTER DATABASE CONNECTION (Supabase REST API)
// ============================================

let masterDbClient = null;

// Use explicit MASTER_SUPABASE_URL and MASTER_SUPABASE_SERVICE_KEY
if (process.env.MASTER_SUPABASE_URL && process.env.MASTER_SUPABASE_SERVICE_KEY) {
  console.log('🔧 [MASTER DB] Initializing from MASTER_SUPABASE_URL...');
  masterDbClient = createClient(
    process.env.MASTER_SUPABASE_URL,
    process.env.MASTER_SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  console.log('✅ [MASTER DB] Client initialized from explicit env vars');
}
// Fallback: Try to parse from MASTER_DB_URL if it's a Supabase URL
else if (process.env.MASTER_DB_URL && process.env.MASTER_DB_URL.includes('.supabase.co')) {
  try {
    console.log('🔧 [MASTER DB] Attempting to initialize from MASTER_DB_URL...');

    // Extract project ref from pooler URL: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
    const urlMatch = process.env.MASTER_DB_URL.match(/postgres\.([^:]+):([^@]+)@aws-0-([^.]+)\.pooler\.supabase\.co/);

    if (urlMatch) {
      const [, projectRef, password, region] = urlMatch;
      const supabaseUrl = `https://${projectRef}.supabase.co`;

      console.log('🔧 [MASTER DB] Extracted from MASTER_DB_URL:');
      console.log('   - Project Ref:', projectRef);
      console.log('   - Region:', region);
      console.log('   - Supabase URL:', supabaseUrl);

      // Check if we have SUPABASE_SERVICE_ROLE_KEY or MASTER_SUPABASE_SERVICE_KEY
      const serviceKey = process.env.MASTER_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (serviceKey && serviceKey !== 'your-service-role-key-here') {
        masterDbClient = createClient(supabaseUrl, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        console.log('✅ [MASTER DB] Client initialized from MASTER_DB_URL + service key');
      } else {
        console.warn('⚠️ [MASTER DB] Service role key not available - masterDbClient will be null');
        console.warn('   Set MASTER_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY');
      }
    } else {
      console.warn('⚠️ [MASTER DB] Could not parse Supabase project ref from MASTER_DB_URL');
    }
  } catch (parseError) {
    console.error('❌ [MASTER DB] Error parsing MASTER_DB_URL:', parseError.message);
  }
} else {
  console.warn('⚠️ [MASTER DB] masterDbClient not initialized - no Supabase env vars found');
  console.warn('   Required: MASTER_SUPABASE_URL and MASTER_SUPABASE_SERVICE_KEY');
}

// ============================================
// CONNECTION TESTING
// ============================================

async function testMasterConnection() {
  try {
    if (!masterDbClient) {
      throw new Error('masterDbClient not initialized');
    }

    const { error } = await masterDbClient.from('stores').select('id').limit(1);
    if (error) {
      throw new Error(error.message);
    }

    console.log('✅ Master database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to master database:', error.message);
    throw error;
  }
}

// ============================================
// CONNECTION MANAGEMENT
// ============================================

async function closeMasterConnection() {
  // Supabase client doesn't need explicit closing
  console.log('Master database connection closed.');
}

// Log connection status on startup
if (masterDbClient) {
  console.log('ℹ️ Using masterDbClient (Supabase REST API) for master DB operations');
} else {
  console.error('❌ masterDbClient is NOT initialized - master DB operations will fail');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeMasterConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeMasterConnection();
  process.exit(0);
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
  masterDbClient,  // Supabase REST API client
  testMasterConnection,
  closeMasterConnection
};
