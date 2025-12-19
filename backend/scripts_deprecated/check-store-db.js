/**
 * Diagnostic script to check store database configuration
 * Run with: node check-store-db.js
 */

const { masterDbClient } = require('./src/database/masterConnection');

const storeId = 'f48974ce-d153-4dc4-a99b-b15c27e45cd2';

async function checkStoreDatabase() {
  console.log('🔍 Checking database configuration for store:', storeId);
  console.log('='.repeat(60));

  try {
    // Check if store exists
    console.log('\n1️⃣ Checking if store exists in stores table...');
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError) {
      console.error('❌ Error fetching store:', storeError.message);
      return;
    }

    if (!store) {
      console.error('❌ Store not found in stores table!');
      return;
    }

    console.log('✅ Store exists:');
    console.log('   - ID:', store.id);
    console.log('   - User ID:', store.user_id);
    console.log('   - Slug:', store.slug);
    console.log('   - Status:', store.status);
    console.log('   - Is Active:', store.is_active);
    console.log('   - Created:', store.created_at);

    // Check store_databases table
    console.log('\n2️⃣ Checking store_databases table...');
    const { data: storeDb, error: dbError } = await masterDbClient
      .from('store_databases')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (dbError) {
      console.error('❌ Error fetching database config:', dbError.message);
      return;
    }

    if (!storeDb) {
      console.error('❌ No database configuration found in store_databases table!');
      console.log('\n🔧 This is the problem! The store needs a database configured.');
      console.log('\n💡 Solutions:');
      console.log('   1. Run the onboarding wizard to configure a database');
      console.log('   2. Manually insert a record in store_databases table');
      console.log('   3. Use the database provisioning API');
      return;
    }

    console.log('✅ Database configuration exists:');
    console.log('   - ID:', storeDb.id);
    console.log('   - Database Type:', storeDb.database_type);
    console.log('   - Host:', storeDb.host);
    console.log('   - Port:', storeDb.port);
    console.log('   - Database Name:', storeDb.database_name);
    console.log('   - Is Active:', storeDb.is_active);
    console.log('   - Connection Status:', storeDb.connection_status);
    console.log('   - Last Connection Test:', storeDb.last_connection_test);
    console.log('   - Has Encrypted Credentials:', !!storeDb.connection_string_encrypted);

    // Check if active
    console.log('\n3️⃣ Checking database status...');
    if (!storeDb.is_active) {
      console.error('❌ Database configuration exists but is INACTIVE!');
      console.log('\n💡 Solution: Set is_active = true in store_databases table');
      return;
    }

    console.log('✅ Database configuration is active');

    // Test connection
    console.log('\n4️⃣ Testing connection...');
    const ConnectionManager = require('./src/services/database/ConnectionManager');

    try {
      const connection = await ConnectionManager.getStoreConnection(storeId, false);
      console.log('✅ Successfully connected to store database!');
      console.log('   - Connection type:', connection.constructor.name);
    } catch (connError) {
      console.error('❌ Failed to connect:', connError.message);
      console.log('\n💡 Check the encrypted credentials and database connectivity');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    process.exit(0);
  }
}

checkStoreDatabase();
