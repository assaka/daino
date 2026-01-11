/**
 * TenantMigrationService
 *
 * Handles automatic migrations for tenant databases.
 * Migration definitions are stored in master DB's migrations table.
 * Migration tracking uses store_databases.schema_version.
 */

const { masterDbClient } = require('../../database/masterConnection');

class TenantMigrationService {
  constructor() {
    this.migrationsCache = null;
    this.cacheExpiry = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load all migrations from the database
   */
  async loadMigrations() {
    // Check cache
    if (this.migrationsCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.migrationsCache;
    }

    if (!masterDbClient) {
      console.warn('[Migration] No master DB client');
      return [];
    }

    try {
      const { data, error } = await masterDbClient
        .from('migrations')
        .select('id, version, name, description, sql_up')
        .order('version', { ascending: true });

      if (error) {
        console.error('[Migration] Error loading migrations:', error.message);
        return [];
      }

      this.migrationsCache = (data || []).map(m => ({
        version: m.version,
        name: m.name,
        description: m.description,
        sql: m.sql_up
      }));

      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      console.log(`[Migration] Loaded ${this.migrationsCache.length} migration(s) from database`);
      return this.migrationsCache;
    } catch (err) {
      console.error('[Migration] Error loading migrations:', err.message);
      return [];
    }
  }

  /**
   * Get the latest available migration version
   */
  async getLatestVersion() {
    const migrations = await this.loadMigrations();
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
      const latestVersion = await this.getLatestVersion();
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
    const allMigrations = await this.loadMigrations();
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
    const latestVersion = await this.getLatestVersion();
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
      console.log(`[Migration] Running: ${migration.name} (v${migration.version})`);
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
      const latestVersion = await this.getLatestVersion();

      // Get all active stores (exclude provisioning - DB not ready yet)
      const { data: stores, error: storesError } = await masterDbClient
        .from('stores')
        .select('id, name, status')
        .in('status', ['active', 'demo']);

      if (storesError) throw storesError;

      // Get store_databases info
      const { data: databases, error: dbError } = await masterDbClient
        .from('store_databases')
        .select('store_id, schema_version, has_pending_migration, last_migration_at');

      if (dbError) throw dbError;

      const dbMap = new Map((databases || []).map(d => [d.store_id, d]));

      return (stores || []).map(store => {
        const db = dbMap.get(store.id);
        const schemaVersion = db?.schema_version || 0;
        return {
          storeId: store.id,
          storeName: store.name,
          schemaVersion,
          latestVersion,
          hasPendingMigrations: schemaVersion < latestVersion,
          lastMigrationAt: db?.last_migration_at || null
        };
      });
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
    this.cacheExpiry = null;
  }

  /**
   * Flag all stores as having pending migrations (call when adding new migration)
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

      // Clear cache so new migrations are loaded
      this.clearCache();

      const count = data?.length || 0;
      console.log(`[Migration] Flagged ${count} stores for pending migration`);
      return { success: true, storesFlagged: count };
    } catch (err) {
      console.error('[Migration] Error flagging stores:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if store has pending migration flag set (fast - no migrations table query)
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
   * Get all stores with pending migrations (flag-based)
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

  /**
   * Get all available migrations
   */
  async getAllMigrations() {
    return await this.loadMigrations();
  }
}

module.exports = new TenantMigrationService();
