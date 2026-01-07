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
