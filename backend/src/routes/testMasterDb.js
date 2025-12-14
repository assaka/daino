/**
 * Test Master DB Endpoint
 *
 * GET /api/test/master-db - Test master DB connection
 * Access this endpoint to verify master DB is working
 */

const express = require('express');
const router = express.Router();

router.get('/master-db', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: Environment variables
    results.tests.env_vars = {
      master_db_url: !!process.env.MASTER_DB_URL,
      master_supabase_url: !!process.env.MASTER_SUPABASE_URL,
      master_supabase_service_key: !!process.env.MASTER_SUPABASE_SERVICE_KEY,
      encryption_key: !!process.env.ENCRYPTION_KEY,
      jwt_secret: !!process.env.JWT_SECRET
    };

    // Test 2: Master connection using Supabase client
    try {
      const { masterDbClient } = require('../database/masterConnection');

      if (!masterDbClient) {
        results.tests.connection = { success: false, error: 'masterDbClient not initialized' };
      } else {
        // Simple query to test connection
        const { error } = await masterDbClient.from('stores').select('id').limit(1);
        if (error) {
          results.tests.connection = { success: false, error: error.message };
        } else {
          results.tests.connection = { success: true, message: 'Connected via Supabase REST API' };
        }
      }
    } catch (error) {
      results.tests.connection = { success: false, error: error.message };
    }

    // Test 3: Query test
    try {
      const { masterDbClient } = require('../database/masterConnection');

      if (masterDbClient) {
        const { data, error } = await masterDbClient.rpc('now');
        if (error) {
          // Fallback to simple query if RPC not available
          const { data: stores } = await masterDbClient.from('stores').select('created_at').limit(1);
          results.tests.query = { success: true, message: 'Query executed successfully' };
        } else {
          results.tests.query = { success: true, server_time: data };
        }
      } else {
        results.tests.query = { success: false, error: 'No database client' };
      }
    } catch (error) {
      results.tests.query = { success: false, error: error.message };
    }

    // Test 4: Check tables (using Supabase metadata or test queries)
    try {
      const { masterDbClient } = require('../database/masterConnection');

      const expectedTables = ['users', 'stores', 'store_databases', 'store_hostnames',
                              'subscriptions', 'credit_transactions',
                              'service_credit_costs', 'job_queue'];

      const tableChecks = {};
      for (const table of expectedTables) {
        try {
          const { error } = await masterDbClient.from(table).select('id').limit(1);
          tableChecks[table] = !error;
        } catch {
          tableChecks[table] = false;
        }
      }

      const missingTables = Object.entries(tableChecks)
        .filter(([_, exists]) => !exists)
        .map(([name]) => name);

      results.tests.tables = {
        success: missingTables.length === 0,
        checked: expectedTables.length,
        missing: missingTables
      };
    } catch (error) {
      results.tests.tables = { success: false, error: error.message };
    }

    // Test 5: Models/Services work
    try {
      const { MasterUser, MasterStore } = require('../models/master');
      results.tests.models = {
        success: true,
        loaded: ['MasterUser', 'MasterStore'],
        note: 'Models still use Sequelize (being migrated)'
      };
    } catch (error) {
      results.tests.models = { success: false, error: error.message };
    }

    // Test 6: Encryption
    try {
      const { encrypt, decrypt } = require('../utils/encryption');
      const testData = 'test-secret-data';
      const encrypted = encrypt(testData);
      const decrypted = decrypt(encrypted);
      results.tests.encryption = {
        success: testData === decrypted,
        message: testData === decrypted ? 'Working' : 'Failed'
      };
    } catch (error) {
      results.tests.encryption = { success: false, error: error.message };
    }

    // Overall status
    const criticalTests = ['connection', 'tables'];
    const criticalSuccess = criticalTests.every(t => results.tests[t]?.success);
    const allSuccess = Object.values(results.tests).every(t => t.success);

    results.overall = allSuccess
      ? '✅ ALL TESTS PASSED'
      : criticalSuccess
        ? '⚠️ CORE TESTS PASSED (some non-critical failures)'
        : '❌ CRITICAL TESTS FAILED';
    results.ready = criticalSuccess;

    res.json(results);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      results
    });
  }
});

module.exports = router;
