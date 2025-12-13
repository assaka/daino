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
 */

const { Sequelize } = require('sequelize');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// MASTER DATABASE CONNECTION (PostgreSQL/Supabase)
// ============================================

// Use MASTER_DB_URL for database connection
const masterDbUrl = process.env.MASTER_DB_URL;
const useMasterDbUrl = !!masterDbUrl;

console.log('🔧 [MASTER CONNECTION INIT] MASTER_DB_URL:', masterDbUrl ? masterDbUrl.substring(0, 80) + '...' : '❌ NOT SET');
console.log('🔧 [MASTER CONNECTION INIT] Will use URL-based connection:', useMasterDbUrl);

if (!masterDbUrl) {
  console.warn('⚠️ [MASTER CONNECTION] MASTER_DB_URL not set! Checking fallback env vars...');
  console.warn('⚠️ MASTER_DB_HOST:', process.env.MASTER_DB_HOST ? 'SET' : 'NOT SET');
  console.warn('⚠️ MASTER_DB_USER:', process.env.MASTER_DB_USER ? 'SET' : 'NOT SET');
  console.warn('⚠️ MASTER_DB_PASSWORD:', process.env.MASTER_DB_PASSWORD ? 'SET (length: ' + (process.env.MASTER_DB_PASSWORD?.length || 0) + ')' : 'NOT SET');
  console.warn('⚠️ MASTER_DB_NAME:', process.env.MASTER_DB_NAME || 'postgres (default)');
} else {
  // Parse the URL to show what's being used (sanitized)
  try {
    const url = new URL(masterDbUrl.replace('postgresql://', 'http://'));
    console.log('🔧 [MASTER CONNECTION] Parsed from MASTER_DB_URL:');
    console.log('   - Host:', url.hostname);
    console.log('   - Port:', url.port || '5432');
    console.log('   - Database:', url.pathname.substring(1));
    console.log('   - Username:', url.username);
    console.log('   - Password length:', url.password?.length || 0);
    console.log('   - Password first 3 chars:', url.password?.substring(0, 3) + '...' || 'NONE');
  } catch (e) {
    console.error('❌ Failed to parse MASTER_DB_URL:', e.message);
  }
}

// Create Sequelize connection - use connection string directly if available
const sequelizeOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '+00:00',
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: true
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    // Disable prepared statements for Supabase transaction pooler (PgBouncer)
    prepareBeforeExecute: false
  },
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /TimeoutError/
    ]
  }
};

let masterSequelize;
if (useMasterDbUrl) {
  // Use connection string directly - Sequelize handles parsing
  console.log('🔧 [MASTER CONNECTION] Using connection string directly with Sequelize');
  masterSequelize = new Sequelize(masterDbUrl, sequelizeOptions);
} else {
  // Fallback to individual env vars
  console.log('🔧 [MASTER CONNECTION] Using individual env vars for Sequelize');
  masterSequelize = new Sequelize({
    ...sequelizeOptions,
    host: process.env.MASTER_DB_HOST,
    port: process.env.MASTER_DB_PORT || 5432,
    database: process.env.MASTER_DB_NAME || 'postgres',
    username: process.env.MASTER_DB_USER,
    password: process.env.MASTER_DB_PASSWORD
  });
}

// ============================================
// SUPABASE CLIENT (if using Supabase for master DB)
// ============================================

let masterDbClient = null;

// Use explicit MASTER_SUPABASE_URL and MASTER_SUPABASE_SERVICE_KEY
if (process.env.MASTER_SUPABASE_URL && process.env.MASTER_SUPABASE_SERVICE_KEY) {
  console.log('🔧 [MASTER SUPABASE] Initializing from MASTER_SUPABASE_URL...');
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
  console.log('✅ [MASTER SUPABASE] Client initialized from explicit env vars');
}
// Fallback: Try to parse from MASTER_DB_URL if it's a Supabase URL
else if (masterDbUrl && masterDbUrl.includes('.supabase.co')) {
  try {
    console.log('🔧 [MASTER SUPABASE] Attempting to initialize from MASTER_DB_URL...');

    // Extract project ref from pooler URL: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
    const urlMatch = masterDbUrl.match(/postgres\.([^:]+):([^@]+)@aws-0-([^.]+)\.pooler\.supabase\.co/);

    if (urlMatch) {
      const [, projectRef, password, region] = urlMatch;
      const supabaseUrl = `https://${projectRef}.supabase.co`;

      console.log('🔧 [MASTER SUPABASE] Extracted from MASTER_DB_URL:');
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
        console.log('✅ [MASTER SUPABASE] Client initialized from MASTER_DB_URL + service key');
      } else {
        console.warn('⚠️ [MASTER SUPABASE] Service role key not available - masterDbClient will be null');
        console.warn('   Set MASTER_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY');
      }
    } else {
      console.warn('⚠️ [MASTER SUPABASE] Could not parse Supabase project ref from MASTER_DB_URL');
    }
  } catch (parseError) {
    console.error('❌ [MASTER SUPABASE] Error parsing MASTER_DB_URL:', parseError.message);
  }
} else {
  console.warn('⚠️ [MASTER SUPABASE] masterDbClient not initialized - no Supabase env vars found');
}

// ============================================
// CONNECTION TESTING
// ============================================

async function testMasterConnection() {
  try {
    await masterSequelize.authenticate();
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
  try {
    await masterSequelize.close();
    console.log('Master database connection closed.');
  } catch (error) {
    console.error('Error closing master database connection:', error);
    throw error;
  }
}

// Skip Sequelize connection test on startup - we primarily use masterDbClient (Supabase REST API)
// The Sequelize connection is only used by legacy models (Job, JobHistory)
// Enable test with MASTER_DB_TEST_CONNECTION=true if debugging is needed
if (process.env.MASTER_DB_TEST_CONNECTION === 'true') {
  console.log('🔧 Testing master Sequelize connection (MASTER_DB_TEST_CONNECTION=true)...');
  testMasterConnection()
    .then(() => {
      console.log('✅ Master DB Sequelize connection test PASSED');
    })
    .catch(err => {
      console.error('❌ Master DB Sequelize connection test FAILED:', err.message);
    });
} else {
  console.log('ℹ️ Skipping Sequelize connection test (set MASTER_DB_TEST_CONNECTION=true to enable)');
  console.log('ℹ️ Using masterDbClient (Supabase REST API) for master DB operations');
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
  masterSequelize,
  masterDbClient,
  testMasterConnection,
  closeMasterConnection
};
