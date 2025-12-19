/**
 * Query store database configuration directly
 */

const { masterDbClient } = require('../src/database/masterConnection');

const storeId = 'f48974ce-d153-4dc4-a99b-b15c27e45cd2';

async function queryStoreDb() {
  console.log('🔍 Querying store_databases for store:', storeId);

  // Wait for connection to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Check store_databases table
    const { data: storeDb, error } = await masterDbClient
      .from('store_databases')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error querying store_databases:', error);
      process.exit(1);
    }

    if (!storeDb) {
      console.log('❌ No database configuration found!');
      console.log('\n📋 Checking all store_databases records...');

      const { data: allDbs, error: allError } = await masterDbClient
        .from('store_databases')
        .select('store_id, database_type, is_active, connection_status');

      if (!allError) {
        console.log('Total records in store_databases:', allDbs?.length || 0);
        if (allDbs && allDbs.length > 0) {
          console.log('\nExisting store databases:');
          allDbs.forEach(db => {
            console.log(`  - Store: ${db.store_id}, Type: ${db.database_type}, Active: ${db.is_active}, Status: ${db.connection_status}`);
          });
        }
      }

      process.exit(1);
    }

    console.log('\n✅ Database configuration found:');
    console.log(JSON.stringify(storeDb, null, 2));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    process.exit(0);
  }
}

queryStoreDb();
