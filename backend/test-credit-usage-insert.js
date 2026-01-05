/**
 * Test script to verify credit_usage table insert in master DB
 * Run: node test-credit-usage-insert.js
 */

require('dotenv').config();

const { masterDbClient } = require('./src/database/masterConnection');
const { v4: uuidv4 } = require('uuid');

async function testCreditUsageInsert() {
  const testUserId = '8b2126b9-8693-4861-96a9-e6a064c98c98';

  console.log('Testing credit_usage insert to master DB...\n');

  // First verify user exists
  console.log('1. Checking if user exists in master DB...');
  const { data: user, error: userError } = await masterDbClient
    .from('users')
    .select('id, email, credits')
    .eq('id', testUserId)
    .maybeSingle();

  if (userError) {
    console.error('   ❌ Error fetching user:', userError.message);
    return;
  }

  if (!user) {
    console.error('   ❌ User not found in master DB');
    return;
  }

  console.log('   ✅ User found:', { id: user.id, email: user.email, credits: user.credits });

  // Try to insert a test record
  console.log('\n2. Inserting test credit_usage record...');

  const testRecord = {
    id: uuidv4(),
    user_id: testUserId,
    store_id: null,  // Nullable
    credits_used: 0.001,  // Tiny test amount
    usage_type: 'test_insert',
    reference_id: 'test-' + Date.now(),
    reference_type: 'diagnostic_test',
    description: 'Test insert to verify credit_usage table works',
    metadata: {
      test: true,
      timestamp: new Date().toISOString()
    }
  };

  console.log('   Insert data:', JSON.stringify(testRecord, null, 2));

  const { data: insertResult, error: insertError } = await masterDbClient
    .from('credit_usage')
    .insert(testRecord)
    .select();

  if (insertError) {
    console.error('\n   ❌ INSERT FAILED!');
    console.error('   Error message:', insertError.message);
    console.error('   Error code:', insertError.code);
    console.error('   Error details:', JSON.stringify(insertError, null, 2));
    return;
  }

  console.log('\n   ✅ INSERT SUCCESSFUL!');
  console.log('   Inserted record:', JSON.stringify(insertResult, null, 2));

  // Verify by reading it back
  console.log('\n3. Verifying record exists...');
  const { data: verifyData, error: verifyError } = await masterDbClient
    .from('credit_usage')
    .select('*')
    .eq('id', testRecord.id)
    .single();

  if (verifyError) {
    console.error('   ❌ Verification failed:', verifyError.message);
    return;
  }

  console.log('   ✅ Record verified in database');
  console.log('   Record:', JSON.stringify(verifyData, null, 2));

  // Clean up test record
  console.log('\n4. Cleaning up test record...');
  const { error: deleteError } = await masterDbClient
    .from('credit_usage')
    .delete()
    .eq('id', testRecord.id);

  if (deleteError) {
    console.error('   ⚠️ Could not delete test record:', deleteError.message);
  } else {
    console.log('   ✅ Test record deleted');
  }

  console.log('\n✅ credit_usage table is working correctly!');
}

testCreditUsageInsert()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
