/**
 * TenantMigrationService
 *
 * Handles automatic migrations for tenant databases.
 * Migration tracking is stored in master DB's tenant_migrations table.
 * Migration SQL files are in ./tenant/ directory.
 */

const fs = require('fs');
const path = require('path');
const { masterDbClient } = require('../../database/masterConnection');

// Directory containing migration SQL files
const MIGRATIONS_DIR = path.join(__dirname, 'tenant');

class TenantMigrationService {
  constructor() {
    this.migrationsCache = null; // Cache loaded migrations
  }

  /**
   * Load all migration files from the tenant directory
   * Files should be named: 001_description.sql, 002_description.sql, etc.
   */
  loadMigrations() {
    if (this.migrationsCache) {
      return this.migrationsCache;
    }

    const migrations = [];

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.warn(`[Migration] Migrations directory not found: ${MIGRATIONS_DIR}`);
      return migrations;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure alphabetical order (001, 002, etc.)

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`[Migration] Skipping invalid migration file: ${file}`);
        continue;
      }

      const version = parseInt(match[1], 10);
      const name = match[2];
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Extract description from first comment line
      const descMatch = sql.match(/^-- Description:\s*(.+)$/m);
      const description = descMatch ? descMatch[1] : name.replace(/_/g, ' ');

      migrations.push({
        version,
        name: file.replace('.sql', ''),
        description,
        sql,
        filePath
      });
    }

    this.migrationsCache = migrations;
    console.log(`[Migration] Loaded ${migrations.length} migration(s)`);
    return migrations;
  }

  /**
   * Get applied migrations for a store from master DB
   */
  async getAppliedMigrations(storeId) {
    if (!masterDbClient) return [];

    try {
      const { data, error } = await masterDbClient
        .from('tenant_migrations')
        .select('migration_name, migration_version, applied_at, success')
        .eq('store_id', storeId)
        .eq('success', true)
        .order('migration_version', { ascending: true });

      if (error) {
        console.error(`[Migration] Error fetching applied migrations:`, error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error(`[Migration] Error fetching applied migrations:`, err.message);
      return [];
    }
  }

  /**
   * Record a migration as applied in master DB
   */
  async recordMigration(storeId, migration, success, errorMessage = null, executionTimeMs = null) {
    if (!masterDbClient) return false;

    try {
      const { error } = await masterDbClient
        .from('tenant_migrations')
        .upsert({
          store_id: storeId,
          migration_name: migration.name,
          migration_version: migration.version,
          description: migration.description,
          applied_at: new Date().toISOString(),
          success,
          error_message: errorMessage,
          execution_time_ms: executionTimeMs
        }, {
          onConflict: 'store_id,migration_name'
        });

      if (error) {
        console.error(`[Migration] Error recording migration:`, error.message);
        return false;
      }

      // Also update store_databases
      if (success) {
        // Check if there are more pending migrations
        const allMigrations = this.loadMigrations();
        const latestVersion = Math.max(...allMigrations.map(m => m.version));
        const hasPending = migration.version < latestVersion;

        await masterDbClient
          .from('store_databases')
          .update({
            schema_version: migration.version,
            has_pending_migration: hasPending,
            last_migration_at: new Date().toISOString()
          })
          .eq('store_id', storeId);
      }

      return true;
    } catch (err) {
      console.error(`[Migration] Error recording migration:`, err.message);
      return false;
    }
  }

  /**
   * Get pending migrations for a store
   */
  async getPendingMigrations(storeId) {
    const allMigrations = this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations(storeId);
    const appliedNames = new Set(appliedMigrations.map(m => m.migration_name));

    return allMigrations.filter(m => !appliedNames.has(m.name));
  }

  /**
   * Check if store has pending migrations
   */
  async hasPendingMigrations(storeId) {
    const pending = await this.getPendingMigrations(storeId);
    return pending.length > 0;
  }

  /**
   * Run pending migrations for a store
   *
   * @param {string} storeId - Store UUID
   * @param {Object} tenantDb - Supabase client for the tenant DB
   * @returns {Object} Migration result
   */
  async runPendingMigrations(storeId, tenantDb) {
    const pendingMigrations = await this.getPendingMigrations(storeId);

    if (pendingMigrations.length === 0) {
      return {
        success: true,
        message: 'No pending migrations',
        applied: [],
        failed: []
      };
    }

    console.log(`[Migration] Running ${pendingMigrations.length} migration(s) for store ${storeId}`);

    const applied = [];
    const failed = [];

    for (const migration of pendingMigrations) {
      console.log(`[Migration] Running: ${migration.name}`);
      const startTime = Date.now();

      try {
        // Try to execute via RPC (execute_sql function)
        const { error } = await tenantDb.rpc('execute_sql', { sql: migration.sql });

        if (error) {
          throw new Error(error.message);
        }

        const executionTime = Date.now() - startTime;
        await this.recordMigration(storeId, migration, true, null, executionTime);
        applied.push({ name: migration.name, version: migration.version, executionTime });
        console.log(`[Migration] ✅ ${migration.name} completed (${executionTime}ms)`);

      } catch (error) {
        const executionTime = Date.now() - startTime;
        await this.recordMigration(storeId, migration, false, error.message, executionTime);
        failed.push({ name: migration.name, version: migration.version, error: error.message });
        console.error(`[Migration] ❌ ${migration.name} failed: ${error.message}`);

        // Stop on first failure
        break;
      }
    }

    return {
      success: failed.length === 0,
      message: failed.length === 0
        ? `Applied ${applied.length} migration(s)`
        : `Applied ${applied.length}, failed ${failed.length}`,
      applied,
      failed,
      pending: pendingMigrations.length - applied.length - failed.length
    };
  }

  /**
   * Get migration status for all stores
   */
  async getAllMigrationStatus() {
    if (!masterDbClient) return [];

    try {
      const allMigrations = this.loadMigrations();
      const latestVersion = allMigrations.length > 0
        ? Math.max(...allMigrations.map(m => m.version))
        : 0;

      const { data: stores, error } = await masterDbClient
        .from('store_databases')
        .select('store_id, schema_version, last_migration_at')
        .eq('is_active', true);

      if (error) throw error;

      return (stores || []).map(store => ({
        storeId: store.store_id,
        schemaVersion: store.schema_version || 0,
        latestVersion,
        hasPendingMigrations: (store.schema_version || 0) < latestVersion,
        lastMigrationAt: store.last_migration_at
      }));
    } catch (err) {
      console.error('[Migration] Error getting status:', err.message);
      return [];
    }
  }

  /**
   * Clear migrations cache (useful when adding new migration files)
   */
  clearCache() {
    this.migrationsCache = null;
  }

  /**
   * Flag all stores as having pending migrations
   * Call this when deploying new migrations
   */
  async flagAllStoresForMigration() {
    if (!masterDbClient) return { success: false, error: 'No master DB client' };

    try {
      const { data, error } = await masterDbClient
        .from('store_databases')
        .update({ has_pending_migration: true })
        .eq('is_active', true)
        .select('store_id');

      if (error) throw error;

      const count = data?.length || 0;
      console.log(`[Migration] Flagged ${count} stores for pending migration`);
      return { success: true, storesFlagged: count };
    } catch (err) {
      console.error('[Migration] Error flagging stores:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if store has pending migration (using the flag)
   */
  async checkPendingMigrationFlag(storeId) {
    if (!masterDbClient) return false;

    try {
      const { data, error } = await masterDbClient
        .from('store_databases')
        .select('has_pending_migration')
        .eq('store_id', storeId)
        .single();

      if (error) return false;
      return data?.has_pending_migration === true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get all stores with pending migrations
   */
  async getStoresWithPendingMigrations() {
    if (!masterDbClient) return [];

    try {
      const { data, error } = await masterDbClient
        .from('store_databases')
        .select('store_id, schema_version, last_migration_at')
        .eq('is_active', true)
        .eq('has_pending_migration', true);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[Migration] Error getting pending stores:', err.message);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new TenantMigrationService();
