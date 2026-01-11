/**
 * TenantMigrationService
 *
 * Handles automatic migrations for tenant databases.
 * Migrations run automatically when a store is accessed and has pending migrations.
 *
 * Migration tracking is stored in the master DB's store_databases table.
 */

const { masterDbClient } = require('../../database/masterConnection');

// Current schema version - increment this when adding new migrations
const CURRENT_SCHEMA_VERSION = 1;

// Migration definitions - each migration runs once per store
const MIGRATIONS = [
  {
    version: 1,
    name: 'add_plugin_cron_table',
    description: 'Creates plugin_cron table and execute_sql function',
    // SQL to run via execute_sql RPC (if available)
    sql: `
      -- Create execute_sql function if not exists
      CREATE OR REPLACE FUNCTION execute_sql(sql text)
      RETURNS void AS $func$
      BEGIN
        EXECUTE sql;
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;
      GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
      GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO anon;

      -- Create plugin_cron table
      CREATE TABLE IF NOT EXISTS plugin_cron (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plugin_id UUID NOT NULL,
        cron_name VARCHAR(255) NOT NULL,
        description TEXT,
        cron_schedule VARCHAR(100) NOT NULL,
        timezone VARCHAR(50) DEFAULT 'UTC',
        handler_method VARCHAR(255) NOT NULL,
        handler_code TEXT,
        handler_params JSONB DEFAULT '{}'::jsonb,
        is_enabled BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 10,
        last_run_at TIMESTAMP WITH TIME ZONE,
        next_run_at TIMESTAMP WITH TIME ZONE,
        last_status VARCHAR(50),
        last_error TEXT,
        last_result JSONB,
        run_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        consecutive_failures INTEGER DEFAULT 0,
        max_runs INTEGER,
        max_failures INTEGER DEFAULT 5,
        timeout_seconds INTEGER DEFAULT 300,
        cron_job_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_plugin_cron_plugin_id ON plugin_cron(plugin_id);
      CREATE INDEX IF NOT EXISTS idx_plugin_cron_enabled ON plugin_cron(is_enabled) WHERE is_enabled = true;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_cron_unique_name ON plugin_cron(plugin_id, cron_name);

      -- Enable RLS and create policy
      ALTER TABLE plugin_cron ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation_plugin_cron ON plugin_cron;
      CREATE POLICY tenant_isolation_plugin_cron ON plugin_cron
        FOR ALL
        USING (is_service_role())
        WITH CHECK (is_service_role());
    `,
    // Alternative: Try creating table directly via Supabase client (for simple tables)
    async runViaClient(tenantDb) {
      // First check if table exists
      const { error: checkError } = await tenantDb
        .from('plugin_cron')
        .select('id')
        .limit(1);

      // If table doesn't exist (PGRST116 means table not found)
      if (checkError && checkError.code === '42P01') {
        // Try to create via RPC if execute_sql exists
        try {
          await tenantDb.rpc('execute_sql', { sql: this.sql });
          return { success: true, method: 'rpc' };
        } catch (rpcError) {
          // execute_sql doesn't exist, can't create table via REST API
          return { success: false, error: 'execute_sql function not available', needsManualMigration: true };
        }
      } else if (!checkError) {
        // Table already exists
        return { success: true, method: 'already_exists' };
      }

      return { success: false, error: checkError?.message };
    }
  }
];

class TenantMigrationService {
  constructor() {
    this.migrationCache = new Map(); // Cache migration status per store
  }

  /**
   * Get current schema version for a store
   */
  async getStoreSchemaVersion(storeId) {
    if (!masterDbClient) return 0;

    try {
      const { data, error } = await masterDbClient
        .from('store_databases')
        .select('schema_version')
        .eq('store_id', storeId)
        .single();

      if (error || !data) return 0;
      return data.schema_version || 0;
    } catch (err) {
      console.error(`Error getting schema version for store ${storeId}:`, err.message);
      return 0;
    }
  }

  /**
   * Update schema version for a store
   */
  async updateStoreSchemaVersion(storeId, version) {
    if (!masterDbClient) return false;

    try {
      const { error } = await masterDbClient
        .from('store_databases')
        .update({
          schema_version: version,
          last_migration_at: new Date().toISOString()
        })
        .eq('store_id', storeId);

      if (error) {
        console.error(`Error updating schema version for store ${storeId}:`, error.message);
        return false;
      }

      // Update cache
      this.migrationCache.set(storeId, version);
      return true;
    } catch (err) {
      console.error(`Error updating schema version for store ${storeId}:`, err.message);
      return false;
    }
  }

  /**
   * Check if store has pending migrations
   */
  async hasPendingMigrations(storeId) {
    // Check cache first
    if (this.migrationCache.has(storeId)) {
      return this.migrationCache.get(storeId) < CURRENT_SCHEMA_VERSION;
    }

    const currentVersion = await this.getStoreSchemaVersion(storeId);
    this.migrationCache.set(storeId, currentVersion);
    return currentVersion < CURRENT_SCHEMA_VERSION;
  }

  /**
   * Run pending migrations for a store using its tenant connection
   *
   * @param {string} storeId - Store UUID
   * @param {Object} tenantDb - Supabase client or adapter for the tenant DB
   * @returns {Object} Migration result
   */
  async runPendingMigrations(storeId, tenantDb) {
    const currentVersion = await this.getStoreSchemaVersion(storeId);

    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      return { success: true, message: 'No pending migrations', version: currentVersion };
    }

    console.log(`[Migration] Running migrations for store ${storeId} (v${currentVersion} -> v${CURRENT_SCHEMA_VERSION})`);

    const results = [];
    let newVersion = currentVersion;

    for (const migration of MIGRATIONS) {
      if (migration.version <= currentVersion) {
        continue; // Already applied
      }

      console.log(`[Migration] Running: ${migration.name} (v${migration.version})`);

      try {
        // Try running via client method first
        if (migration.runViaClient) {
          const result = await migration.runViaClient.call(migration, tenantDb);
          results.push({
            version: migration.version,
            name: migration.name,
            ...result
          });

          if (result.success) {
            newVersion = migration.version;
            console.log(`[Migration] ✅ ${migration.name} completed (${result.method})`);
          } else if (result.needsManualMigration) {
            console.log(`[Migration] ⚠️ ${migration.name} needs manual migration`);
            // Don't update version - migration is pending
            break;
          } else {
            console.error(`[Migration] ❌ ${migration.name} failed: ${result.error}`);
            break;
          }
        }
      } catch (error) {
        console.error(`[Migration] ❌ ${migration.name} error:`, error.message);
        results.push({
          version: migration.version,
          name: migration.name,
          success: false,
          error: error.message
        });
        break;
      }
    }

    // Update schema version if any migrations succeeded
    if (newVersion > currentVersion) {
      await this.updateStoreSchemaVersion(storeId, newVersion);
    }

    return {
      success: newVersion >= CURRENT_SCHEMA_VERSION,
      previousVersion: currentVersion,
      currentVersion: newVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
      results
    };
  }

  /**
   * Get migration status for all stores
   */
  async getAllMigrationStatus() {
    if (!masterDbClient) return [];

    try {
      const { data: stores, error } = await masterDbClient
        .from('store_databases')
        .select('store_id, schema_version, last_migration_at')
        .eq('is_active', true);

      if (error) throw error;

      return (stores || []).map(store => ({
        storeId: store.store_id,
        schemaVersion: store.schema_version || 0,
        targetVersion: CURRENT_SCHEMA_VERSION,
        hasPendingMigrations: (store.schema_version || 0) < CURRENT_SCHEMA_VERSION,
        lastMigrationAt: store.last_migration_at
      }));
    } catch (err) {
      console.error('Error getting migration status:', err.message);
      return [];
    }
  }

  /**
   * Clear migration cache (useful after manual migrations)
   */
  clearCache(storeId = null) {
    if (storeId) {
      this.migrationCache.delete(storeId);
    } else {
      this.migrationCache.clear();
    }
  }
}

// Export singleton instance
module.exports = new TenantMigrationService();
module.exports.CURRENT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
module.exports.MIGRATIONS = MIGRATIONS;
