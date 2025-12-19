#!/usr/bin/env node

/**
 * Diagnostic Script: Check Media Storage Status
 *
 * This script checks the current status of media storage configuration
 * for all stores in the system.
 */

require('dotenv').config();
const { masterDbClient } = require('./src/database/masterConnection');
const supabaseIntegration = require('./src/services/supabase-integration');

async function checkMediaStorageStatus() {
  console.log('='.repeat(80));
  console.log('MEDIA STORAGE DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
  console.log();

  // 1. Check Environment Variables
  console.log('1. ENVIRONMENT CONFIGURATION');
  console.log('-'.repeat(80));
  console.log('✓ MASTER_DB_URL:', process.env.MASTER_DB_URL ? 'SET' : '❌ NOT SET');
  console.log('✓ SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : '❌ NOT SET');
  console.log('✓ DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : '❌ NOT SET');
  console.log();

  console.log('OAuth Configuration:');
  console.log('✓ SUPABASE_OAUTH_CLIENT_ID:', process.env.SUPABASE_OAUTH_CLIENT_ID ? 'SET ✓' : '❌ NOT SET');
  console.log('✓ SUPABASE_OAUTH_CLIENT_SECRET:', process.env.SUPABASE_OAUTH_CLIENT_SECRET ? 'SET ✓' : '❌ NOT SET');
  console.log('✓ SUPABASE_OAUTH_REDIRECT_URI:', process.env.SUPABASE_OAUTH_REDIRECT_URI || '❌ NOT SET');
  console.log('✓ BACKEND_URL:', process.env.BACKEND_URL || '❌ NOT SET');
  console.log();

  // 2. Check Master Database Connection
  console.log('2. MASTER DATABASE CONNECTION');
  console.log('-'.repeat(80));

  if (!masterDbClient) {
    console.log('❌ Master database client is not initialized!');
    console.log('   This prevents accessing store configurations.');
    console.log();
    console.log('ACTION REQUIRED: Set MASTER_DB_URL in your .env file');
    return;
  }

  try {
    const { data: stores, error } = await masterDbClient
      .from('stores')
      .select('id, name, settings')
      .limit(10);

    if (error) {
      console.log('❌ Error querying stores:', error.message);
      return;
    }

    if (!stores || stores.length === 0) {
      console.log('⚠️  No stores found in database');
      console.log('   You may need to create a store first.');
      return;
    }

    console.log(`✓ Found ${stores.length} store(s)`);
    console.log();

    // 3. Check Each Store's Media Storage Configuration
    console.log('3. STORE MEDIA STORAGE STATUS');
    console.log('-'.repeat(80));

    for (const store of stores) {
      console.log();
      console.log(`Store: ${store.name} (${store.id})`);
      console.log('  Settings:');
      console.log('    - Default Media Storage Provider:',
        store.settings?.default_mediastorage_provider ||
        store.settings?.default_database_provider ||
        'NOT SET'
      );

      // Check Supabase connection status
      try {
        const connectionStatus = await supabaseIntegration.getConnectionStatus(store.id);

        console.log('  Supabase Connection:');
        console.log('    - Connected:', connectionStatus.connected ? '✓ YES' : '❌ NO');
        console.log('    - Project URL:', connectionStatus.projectUrl || 'Not configured');
        console.log('    - Has Service Role Key:', connectionStatus.hasServiceRoleKey ? '✓ YES' : '❌ NO');
        console.log('    - Storage Ready:', connectionStatus.storageReady ? '✓ YES' : '❌ NO');
        console.log('    - Status:', connectionStatus.connectionStatus);

        if (connectionStatus.message) {
          console.log('    - Message:', connectionStatus.message);
        }

        if (connectionStatus.requiresManualConfiguration) {
          console.log('    ⚠️  ACTION REQUIRED: Manual service role key configuration needed');
        }

        if (!connectionStatus.connected) {
          console.log();
          console.log('    📋 TO FIX:');
          console.log('       1. Go to your application');
          console.log('       2. Navigate to Integrations → Supabase');
          console.log('       3. Click "Connect Supabase Account"');
          console.log('       4. Complete the OAuth flow');
        } else if (!connectionStatus.storageReady) {
          console.log();
          console.log('    📋 TO FIX:');
          console.log('       1. Ensure your Supabase project is active');
          console.log('       2. Manually add service role key in integration settings');
          console.log('       3. Get key from: Supabase Dashboard → Settings → API');
        }

      } catch (error) {
        console.log('  Supabase Connection: ❌ ERROR');
        console.log('    Error:', error.message);
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    console.log(error.stack);
  }

  process.exit(0);
}

// Run the diagnostic
checkMediaStorageStatus().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
