/**
 * Manual fix: Create store_databases record for a specific store
 *
 * Run this script with your store details to fix "Unnamed Store" issue
 *
 * Usage:
 *   STORE_ID="your-store-id" \
 *   PROJECT_URL="https://xxx.supabase.co" \
 *   SERVICE_ROLE_KEY="your-service-role-key" \
 *   ANON_KEY="your-anon-key" \
 *   node backend/scripts/manual-fix-store-database.cjs
 */

require('dotenv').config();
const StoreDatabase = require('../src/models/master/StoreDatabase');

async function manualFixStoreDatabase() {
  // Get parameters from environment or prompt
  const storeId = process.env.STORE_ID || '362b6c32-e248-4d17-81f5-bb7008f368ae';
  const projectUrl = process.env.PROJECT_URL;
  const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
  const anonKey = process.env.ANON_KEY;

  console.log('🔧 Manual Store Database Fix\n');
  console.log('Store ID:', storeId);
  console.log('Project URL:', projectUrl ? '✅ Provided' : '❌ Missing');
  console.log('Service Role Key:', serviceRoleKey ? '✅ Provided' : '❌ Missing');
  console.log('Anon Key:', anonKey ? '✅ Provided' : '❌ Missing');
  console.log('');

  if (!projectUrl || !serviceRoleKey) {
    console.error('❌ Missing required credentials!');
    console.error('');
    console.error('Please run with:');
    console.error('  STORE_ID="your-store-id" \\');
    console.error('  PROJECT_URL="https://xxx.supabase.co" \\');
    console.error('  SERVICE_ROLE_KEY="eyJh..." \\');
    console.error('  ANON_KEY="eyJh..." \\');
    console.error('  node backend/scripts/manual-fix-store-database.cjs');
    console.error('');
    console.error('Get these from your Supabase dashboard:');
    console.error('  1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT');
    console.error('  2. Go to Settings → API');
    console.error('  3. Copy Project URL, service_role key, and anon key');
    process.exit(1);
  }

  try {
    console.log('📝 Creating store_databases record...\n');

    const credentials = {
      projectUrl,
      serviceRoleKey,
      anonKey,
      connectionString: null
    };

    const storeDb = await StoreDatabase.createWithCredentials(
      storeId,
      'supabase',
      credentials
    );

    console.log('✅ Success! store_databases record created.');
    console.log('');
    console.log('Store Database ID:', storeDb.id);
    console.log('Store ID:', storeDb.store_id);
    console.log('Database Type:', storeDb.database_type);
    console.log('Status:', storeDb.connection_status);
    console.log('');
    console.log('🎉 Your store should now display correctly in the selector!');
    console.log('   Refresh your admin page to see the changes.');

  } catch (error) {
    if (error.message?.includes('unique constraint')) {
      console.log('ℹ️ Record already exists for this store');
      console.log('   The store should already be working correctly.');
    } else {
      console.error('❌ Failed to create record:', error.message);
      throw error;
    }
  }
}

manualFixStoreDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
