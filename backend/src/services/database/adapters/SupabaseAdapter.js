/**
 * SupabaseAdapter - Supabase implementation of DatabaseAdapter
 *
 * Wraps Supabase client with generic database interface.
 * Routes use this adapter through ConnectionManager, making them DB-agnostic.
 */

const DatabaseAdapter = require('../DatabaseAdapter');
const SupabaseQueryBuilder = require('./SupabaseQueryBuilder');

class SupabaseAdapter extends DatabaseAdapter {
  constructor(supabaseClient, config = {}) {
    super(config);
    this.client = supabaseClient;
    this.type = 'supabase';
  }

  /**
   * Get query builder for a table
   * Returns wrapped Supabase query that implements generic interface
   */
  from(table) {
    const supabaseQuery = this.client.from(table);
    return new SupabaseQueryBuilder(supabaseQuery);
  }

  /**
   * Execute raw SQL query
   * Note: Supabase doesn't support arbitrary SQL, so this uses RPC functions
   */
  async raw(sql, params = []) {
    // For Supabase, raw queries need to be implemented as database functions
    // This is a limitation of Supabase's security model
    throw new Error('Raw SQL not supported by Supabase. Use RPC functions instead.');
  }

  /**
   * Execute an RPC function in Supabase
   * @param {string} functionName - Name of the RPC function
   * @param {Object} params - Parameters to pass to the function
   * @returns {Promise<Object>} Result with data and error
   */
  async rpc(functionName, params = {}) {
    return await this.client.rpc(functionName, params);
  }

  /**
   * Test database connection
   * Uses a method that works even if tables don't exist
   */
  async testConnection() {
    try {
      // DEBUG: Log connection attempt details
      const supabaseUrl = this.client?.supabaseUrl || this.config?.projectUrl || 'UNKNOWN';
      console.log('═'.repeat(60));
      console.log('🔌 DEBUG: SupabaseAdapter.testConnection()');
      console.log('═'.repeat(60));
      console.log('   Supabase URL:', supabaseUrl);
      console.log('   Has client:', !!this.client);
      console.log('   Client keys:', this.client ? Object.keys(this.client) : 'N/A');
      console.log('   Config keys:', this.config ? Object.keys(this.config) : 'N/A');
      console.log('═'.repeat(60));

      // DEBUG: First test basic network connectivity to Supabase (no credentials needed)
      console.log('🌐 DEBUG: Testing basic network connectivity...');
      try {
        const dns = require('dns').promises;
        const https = require('https');

        // Test 1: DNS resolution
        console.log('   [1/3] Testing DNS resolution for supabase.co...');
        const dnsResult = await dns.lookup('supabase.co');
        console.log('   ✅ DNS resolved: supabase.co ->', dnsResult.address);

        // Test 2: DNS for specific project URL
        if (supabaseUrl && supabaseUrl !== 'UNKNOWN') {
          try {
            const url = new URL(supabaseUrl);
            console.log(`   [2/3] Testing DNS resolution for ${url.hostname}...`);
            const projectDns = await dns.lookup(url.hostname);
            console.log(`   ✅ DNS resolved: ${url.hostname} ->`, projectDns.address);
          } catch (urlError) {
            console.log(`   ❌ Failed to resolve project URL: ${urlError.message}`);
          }
        }

        // Test 3: HTTPS connectivity to Supabase API
        console.log('   [3/3] Testing HTTPS connectivity to api.supabase.com...');
        const httpsTest = await new Promise((resolve, reject) => {
          const req = https.get('https://api.supabase.com/v1/projects', {
            timeout: 10000,
            headers: { 'User-Agent': 'DainoStore-NetworkTest/1.0' }
          }, (res) => {
            // We expect 401 (unauthorized) since we have no token - that's fine, it means network works
            console.log(`   ✅ HTTPS connection successful (status: ${res.statusCode})`);
            resolve(true);
          });
          req.on('error', (err) => {
            console.log(`   ❌ HTTPS connection failed: ${err.message}`);
            reject(err);
          });
          req.on('timeout', () => {
            req.destroy();
            console.log('   ❌ HTTPS connection timed out');
            reject(new Error('Connection timed out'));
          });
        });
      } catch (networkError) {
        console.log('═'.repeat(60));
        console.log('❌ NETWORK CONNECTIVITY ISSUE DETECTED');
        console.log('═'.repeat(60));
        console.log('   Error:', networkError.message);
        console.log('   This is NOT a Supabase credential issue.');
        console.log('   The container cannot reach Supabase servers.');
        console.log('   Possible causes:');
        console.log('   - DNS resolution failure');
        console.log('   - Firewall blocking outbound HTTPS');
        console.log('   - Docker network misconfiguration');
        console.log('   - SSL/TLS certificate issues');
        console.log('═'.repeat(60));
        // Continue anyway to get the actual Supabase error
      }

      console.log('   Attempting test query to "stores" table...');

      // Try to query any table - if it fails with "relation does not exist",
      // that's fine - the connection works, just no tables yet
      const { data, error } = await this.client
        .from('stores')
        .select('id')
        .limit(1);

      // No error = connection works
      if (!error) {
        return true;
      }

      // Check if error is just "table doesn't exist" - connection works, just no tables yet
      // PGRST205 = "Could not find the table in the schema cache" (PostgREST)
      // PGRST116 = "No rows returned" (PostgREST)
      // 42P01 = "relation does not exist" (PostgreSQL)
      const tableNotFoundCodes = ['PGRST205', 'PGRST116', '42P01', '42501'];
      const errorStr = JSON.stringify(error).toLowerCase();

      if (tableNotFoundCodes.includes(error.code) ||
          error.message?.toLowerCase().includes('relation') ||
          error.message?.toLowerCase().includes('does not exist') ||
          error.message?.toLowerCase().includes('not found') ||
          error.message?.toLowerCase().includes('schema cache') ||
          errorStr.includes('not found') ||
          errorStr.includes('does not exist')) {
        console.log('Supabase connection OK (table missing, will be created during provisioning)');
        return true;
      }

      // Any other error = actual connection problem
      console.error('Supabase connection test failed:', JSON.stringify(error, null, 2));
      return false;
    } catch (error) {
      console.error('Supabase connection test exception:', error.message);
      return false;
    }
  }

  /**
   * Close connection (Supabase handles this automatically)
   */
  async close() {
    // Supabase client doesn't need explicit closing
    // Connection pooling is handled by Supabase
    return Promise.resolve();
  }

  /**
   * Get underlying Supabase client (for advanced operations)
   * Use sparingly - prefer using the adapter methods
   */
  getClient() {
    return this.client;
  }
}

module.exports = SupabaseAdapter;
