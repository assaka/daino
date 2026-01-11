/**
 * TenantMigrationService
 *
 * Handles automatic migrations for tenant databases.
 * Migration tracking uses store_databases.schema_version in master DB.
 * Migration SQL files are in ./tenant/ directory.
 */

const fs = require('fs');
const path = require('path');
const { masterDbClient } = require('../../database/masterConnection');

// Directory containing migration SQL files
const MIGRATIONS_DIR = path.join(__dirname, 'tenant');

class TenantMigrationService {
  constructor() {
    this.migrationsCache = null;
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
      .sort();

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
   * Get the latest available migration version
   */
  getLatestVersion() {
    const migrations = this.loadMigrations();
    return migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) : 0;
  }

  /**
   * Get store's current schema version from master DB
   */
  async getStoreSchemaVersion(storeId) {
    if (!masterDbClient) return 0;

    try {
      const { data, error } = await masterDbClient
        .from('store_databases')
        .select('schema_version')
        .eq('store_id', storeId)
        .single();

      if (error) return 0;
      return data?.schema_version || 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Update store's schema version after successful migration
   */
  async updateStoreSchemaVersion(storeId, version) {
    if (!masterDbClient) return false;

    try {
      const latestVersion = this.getLatestVersion();
      const hasPending = version < latestVersion;

      const { error } = await masterDbClient
        .from('store_databases')
        .update({
          schema_version: version,
          has_pending_migration: hasPending,
          last_migration_at: new Date().toISOString()
        })
        .eq('store_id', storeId);

      return !error;
    } catch (err) {
      console.error(`[Migration] Error updating schema version:`, err.message);
      return false;
    }
  }

  /**
   * Get pending migrations for a store (based on schema_version)
   */
  async getPendingMigrations(storeId) {
    const allMigrations = this.loadMigrations();
    const currentVersion = await this.getStoreSchemaVersion(storeId);

    return allMigrations
      .filter(m => m.version > currentVersion)
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Check if store has pending migrations
   */
  async hasPendingMigrations(storeId) {
    const currentVersion = await this.getStoreSchemaVersion(storeId);
    const latestVersion = this.getLatestVersion();
    return currentVersion < latestVersion;
  }

  /**
   * Run pending migrations for a store
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
        const { error } = await tenantDb.rpc('execute_sql', { sql: migration.sql });

        if (error) {
          throw new Error(error.message);
        }

        const executionTime = Date.now() - startTime;
        await this.updateStoreSchemaVersion(storeId, migration.version);
        applied.push({ name: migration.name, version: migration.version, executionTime });
        console.log(`[Migration] ✅ ${migration.name} completed (${executionTime}ms)`);

      } catch (error) {
        const executionTime = Date.now() - startTime;
        failed.push({ name: migration.name, version: migration.version, error: error.message });
        console.error(`[Migration] ❌ ${migration.name} failed: ${error.message}`);
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
      const latestVersion = this.getLatestVersion();

      const { data: stores, error } = await masterDbClient
        .from('store_databases')
        .select('store_id, schema_version, has_pending_migration, last_migration_at')
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
   * Clear migrations cache
   */
  clearCache() {
    this.migrationsCache = null;
  }

  /**
   * Flag all stores as having pending migrations (call when deploying new migrations)
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
   * Check if store has pending migration flag set
   */
  async checkPendingMigrationFlag(storeId) {
    if (!masterDbClient) return false;

    try {
      const { data, error } = await masterDbClient
        .from('store_databases')
        .select('has_pending_migration, schema_version')
        .eq('store_id', storeId)
        .single();

      if (error) return false;

      // Also check actual version vs latest
      const latestVersion = this.getLatestVersion();
      return data?.has_pending_migration === true || (data?.schema_version || 0) < latestVersion;
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
      const latestVersion = this.getLatestVersion();

      const { data, error } = await masterDbClient
        .from('store_databases')
        .select('store_id, schema_version, last_migration_at')
        .eq('is_active', true)
        .or(`has_pending_migration.eq.true,schema_version.lt.${latestVersion}`);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[Migration] Error getting pending stores:', err.message);
      return [];
    }
  }
}

module.exports = new TenantMigrationService();
