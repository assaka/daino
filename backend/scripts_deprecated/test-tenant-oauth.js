#!/usr/bin/env node
/**
 * Test script to check OAuth tokens in tenant DB
 */

require('dotenv').config();
const ConnectionManager = require('./src/services/database/ConnectionManager');

async function checkTenantOAuth() {
  const storeId = process.argv[2];

  if (!storeId) {
    console.log('Usage: node test-tenant-oauth.js <store-id>');
    console.log('Example: node test-tenant-oauth.js 123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  console.log('Checking OAuth tokens for storeId:', storeId);
  console.log('='.repeat(60));

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    console.log('✅ Tenant DB connected');

    // Check supabase_oauth_tokens
    const { data: tokens, error: tokenError } = await tenantDb
      .from('supabase_oauth_tokens')
      .select('*')
      .eq('store_id', storeId);

    console.log('\nsupabase_oauth_tokens table:');
    if (tokenError) {
      console.log('❌ Error:', tokenError.message);
    } else if (!tokens || tokens.length === 0) {
      console.log('❌ No tokens found');
    } else {
      console.log(`✅ Found ${tokens.length} token(s)`);
      tokens.forEach((token, i) => {
        console.log(`\nToken ${i + 1}:`);
        console.log('  - ID:', token.id);
        console.log('  - Store ID:', token.store_id);
        console.log('  - Project URL:', token.project_url);
        console.log('  - Has access_token:', !!token.access_token);
        console.log('  - Has refresh_token:', !!token.refresh_token);
        console.log('  - Has service_role_key:', !!token.service_role_key);
        console.log('  - Expires at:', token.expires_at);
        console.log('  - Access token starts with:', token.access_token?.substring(0, 20) + '...');
      });
    }

    // Check integration_configs
    const { data: configs, error: configError } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', 'supabase');

    console.log('\nintegration_configs table:');
    if (configError) {
      console.log('❌ Error:', configError.message);
    } else if (!configs || configs.length === 0) {
      console.log('❌ No config found');
    } else {
      console.log(`✅ Found ${configs.length} config(s)`);
      configs.forEach((config, i) => {
        console.log(`\nConfig ${i + 1}:`);
        console.log('  - ID:', config.id);
        console.log('  - Is Active:', config.is_active);
        console.log('  - Connection Status:', config.connection_status);
        console.log('  - Config Data:', JSON.stringify(config.config_data, null, 2));
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('DONE');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkTenantOAuth();
