/**
 * Check and potentially fix the store database configuration
 * This script connects directly to Supabase master DB
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const storeId = 'f48974ce-d153-4dc4-a99b-b15c27e45cd2';

// Use environment variables to connect to master DB
const MASTER_SUPABASE_URL = process.env.MASTER_SUPABASE_URL;
const MASTER_SUPABASE_SERVICE_KEY = process.env.MASTER_SUPABASE_SERVICE_KEY;

if (!MASTER_SUPABASE_URL || !MASTER_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing MASTER_SUPABASE_URL or MASTER_SUPABASE_SERVICE_KEY');
  console.log('\nPlease set these environment variables in backend/.env:');
  console.log('  MASTER_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  MASTER_SUPABASE_SERVICE_KEY=your-service-role-key');
  process.exit(1);
}

const supabase = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_SERVICE_KEY);

async function checkAndFix() {
  console.log('🔍 Checking database configuration for store:', storeId);
  console.log('=' .repeat(70));

  try {
    // 1. Check if store exists
    console.log('\n1️⃣ Checking if store exists...');
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError) {
      console.error('❌ Error fetching store:', storeError.message);
      process.exit(1);
    }

    if (!store) {
      console.error('❌ Store not found!');
      process.exit(1);
    }

    console.log('✅ Store exists:');
    console.log('   - ID:', store.id);
    console.log('   - User ID:', store.user_id);
    console.log('   - Slug:', store.slug);
    console.log('   - Status:', store.status);
    console.log('   - Is Active:', store.is_active);

    // 2. Check if database configuration exists
    console.log('\n2️⃣ Checking store_databases table...');
    const { data: storeDb, error: dbError } = await supabase
      .from('store_databases')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (dbError) {
      console.error('❌ Error querying store_databases:', dbError.message);
      process.exit(1);
    }

    if (!storeDb) {
      console.log('❌ No database configuration found!');
      console.log('\n📋 This store needs a tenant database configured.');
      console.log('\n💡 Options:');
      console.log('   1. Run the onboarding wizard');
      console.log('   2. Use the database provisioning API');
      console.log('   3. Check if this store should use a shared/default database');

      // List all existing store databases
      console.log('\n📊 Checking other stores with databases...');
      const { data: allStoreDbs, error: allError } = await supabase
        .from('store_databases')
        .select('store_id, database_type, host, is_active, connection_status')
        .limit(10);

      if (!allError && allStoreDbs && allStoreDbs.length > 0) {
        console.log(`\nFound ${allStoreDbs.length} store(s) with database configurations:`);
        allStoreDbs.forEach((db, idx) => {
          console.log(`\n${idx + 1}. Store ID: ${db.store_id}`);
          console.log(`   - Type: ${db.database_type}`);
          console.log(`   - Host: ${db.host || 'N/A'}`);
          console.log(`   - Active: ${db.is_active}`);
          console.log(`   - Status: ${db.connection_status}`);
        });
      } else {
        console.log('No other stores have database configurations yet.');
      }

      process.exit(1);
    }

    console.log('✅ Database configuration found:');
    console.log('   - ID:', storeDb.id);
    console.log('   - Database Type:', storeDb.database_type);
    console.log('   - Host:', storeDb.host || 'N/A');
    console.log('   - Port:', storeDb.port || 'N/A');
    console.log('   - Database Name:', storeDb.database_name || 'N/A');
    console.log('   - Is Active:', storeDb.is_active);
    console.log('   - Connection Status:', storeDb.connection_status);
    console.log('   - Has Encrypted Credentials:', !!storeDb.connection_string_encrypted);

    if (!storeDb.is_active) {
      console.log('\n⚠️  Database is INACTIVE!');
      console.log('Would you like to activate it? (This would need manual confirmation)');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Diagnostic complete');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkAndFix();
