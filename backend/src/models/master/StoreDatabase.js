/**
 * StoreDatabase Model (Master Database)
 *
 * Stores encrypted tenant database connection credentials
 * Uses Supabase REST API via masterDbClient
 */

const { v4: uuidv4 } = require('uuid');
const { masterDbClient } = require('../../database/masterConnection');
const {
  encryptDatabaseCredentials,
  decryptDatabaseCredentials
} = require('../../utils/encryption');

const TABLE_NAME = 'store_databases';

/**
 * StoreDatabase - Supabase-based model for database credentials
 */
class StoreDatabase {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new store database record
   * @param {Object} data - Database data
   * @returns {Promise<StoreDatabase>}
   */
  static async create(data) {
    const now = new Date().toISOString();
    const record = {
      id: data.id || uuidv4(),
      store_id: data.store_id,
      database_type: data.database_type,
      connection_string_encrypted: data.connection_string_encrypted,
      host: data.host || null,
      port: data.port || null,
      database_name: data.database_name || 'postgres',
      is_active: data.is_active !== undefined ? data.is_active : true,
      is_primary: data.is_primary !== undefined ? data.is_primary : true,
      last_connection_test: data.last_connection_test || null,
      connection_status: data.connection_status || 'pending',
      created_at: now,
      updated_at: now
    };

    const { data: result, error } = await masterDbClient
      .from(TABLE_NAME)
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create store database: ${error.message}`);
    }

    return new StoreDatabase(result);
  }

  /**
   * Find database by ID
   * @param {string} id - Database UUID
   * @returns {Promise<StoreDatabase|null>}
   */
  static async findByPk(id) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find database: ${error.message}`);
    }

    return data ? new StoreDatabase(data) : null;
  }

  /**
   * Find one database matching criteria
   * @param {Object} options - Query options with 'where' clause
   * @returns {Promise<StoreDatabase|null>}
   */
  static async findOne(options = {}) {
    let query = masterDbClient.from(TABLE_NAME).select('*');

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find database: ${error.message}`);
    }

    return data ? new StoreDatabase(data) : null;
  }

  /**
   * Find all databases matching criteria
   * @param {Object} options - Query options
   * @returns {Promise<StoreDatabase[]>}
   */
  static async findAll(options = {}) {
    let query = masterDbClient.from(TABLE_NAME).select('*');

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        query = query.eq(key, value);
      }
    }

    if (options.order) {
      for (const [field, direction] of options.order) {
        query = query.order(field, { ascending: direction === 'ASC' });
      }
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find databases: ${error.message}`);
    }

    return (data || []).map(row => new StoreDatabase(row));
  }

  /**
   * Find by store ID
   * @param {string} storeId - Store UUID
   * @returns {Promise<StoreDatabase|null>}
   */
  static async findByStoreId(storeId) {
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error querying store_databases:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    // Return instance with getCredentials method
    const instance = new StoreDatabase(data);
    return instance;
  }

  /**
   * Find all active connections
   * @returns {Promise<StoreDatabase[]>}
   */
  static async findAllActive() {
    return this.findAll({
      where: {
        is_active: true,
        connection_status: 'connected'
      }
    });
  }

  /**
   * Create and store encrypted credentials
   * @param {string} storeId - Store UUID
   * @param {string} databaseType - Database type
   * @param {Object} credentials - Credentials object
   * @returns {Promise<StoreDatabase>}
   */
  static async createWithCredentials(storeId, databaseType, credentials) {
    // Encrypt credentials
    const encryptedCredentials = encryptDatabaseCredentials(credentials);

    // Extract host from projectUrl
    let host = null;
    if (credentials.projectUrl) {
      try {
        host = new URL(credentials.projectUrl).hostname;
      } catch (e) {
        console.warn('Could not parse projectUrl:', e.message);
      }
    }

    // Upsert record (handles reconnection case)
    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .upsert({
        id: uuidv4(),
        store_id: storeId,
        database_type: databaseType,
        connection_string_encrypted: encryptedCredentials,
        host: host,
        port: null,
        database_name: 'postgres',
        is_active: true,
        is_primary: true,
        connection_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'store_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create store_databases record: ${error.message}`);
    }

    // Also create integration_config for supabase-oauth so storage service can find it
    if (databaseType === 'supabase' && credentials.projectUrl && credentials.serviceRoleKey) {
      try {
        const ConnectionManager = require('../../services/database/ConnectionManager');
        const tenantDb = await ConnectionManager.getStoreConnection(storeId);

        // Check if integration_config already exists
        const { data: existingConfig } = await tenantDb
          .from('integration_configs')
          .select('id')
          .eq('store_id', storeId)
          .eq('integration_type', 'supabase-oauth')
          .maybeSingle();

        if (!existingConfig) {
          // Create new integration_config
          await tenantDb
            .from('integration_configs')
            .insert({
              id: uuidv4(),
              store_id: storeId,
              integration_type: 'supabase-oauth',
              config_key: 'default',
              display_name: 'Supabase (Store Database)',
              config_data: {
                projectUrl: credentials.projectUrl,
                serviceRoleKey: credentials.serviceRoleKey,
                connectionType: 'provisioning',
                configuredAt: new Date().toISOString()
              },
              is_active: true,
              is_primary: true,
              connection_status: 'success',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        } else {
          // Update existing config with service role key
          await tenantDb
            .from('integration_configs')
            .update({
              config_data: {
                projectUrl: credentials.projectUrl,
                serviceRoleKey: credentials.serviceRoleKey,
                connectionType: 'provisioning',
                configuredAt: new Date().toISOString()
              },
              connection_status: 'success',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConfig.id);
        }
      } catch (integrationError) {
        // Don't fail the whole operation if integration_config fails
      }
    }

    return new StoreDatabase(data);
  }

  /**
   * Update database record
   * @param {Object} updates - Fields to update
   * @returns {Promise<StoreDatabase>}
   */
  async update(updates) {
    updates.updated_at = new Date().toISOString();

    const { data, error } = await masterDbClient
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', this.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update database: ${error.message}`);
    }

    Object.assign(this, data);
    return this;
  }

  /**
   * Save current instance
   * @returns {Promise<StoreDatabase>}
   */
  async save() {
    const updates = { ...this };
    delete updates.id;
    delete updates.created_at;
    return this.update(updates);
  }

  /**
   * Delete database record
   * @returns {Promise<boolean>}
   */
  async destroy() {
    const { error } = await masterDbClient
      .from(TABLE_NAME)
      .delete()
      .eq('id', this.id);

    if (error) {
      throw new Error(`Failed to delete database: ${error.message}`);
    }

    return true;
  }

  /**
   * Get decrypted credentials
   * @returns {Object}
   */
  getCredentials() {
    try {
      return decryptDatabaseCredentials(this.connection_string_encrypted);
    } catch (error) {
      console.error('Failed to decrypt credentials:', error.message);
      throw new Error('Unable to decrypt database credentials');
    }
  }

  /**
   * Set credentials (encrypts before storage)
   * @param {Object} credentials - Database credentials object
   */
  setCredentials(credentials) {
    try {
      this.connection_string_encrypted = encryptDatabaseCredentials(credentials);

      // Extract non-sensitive info for quick reference
      if (credentials.projectUrl) {
        const url = new URL(credentials.projectUrl);
        this.host = url.hostname;
      }
    } catch (error) {
      console.error('Failed to encrypt credentials:', error.message);
      throw new Error('Unable to encrypt database credentials');
    }
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const credentials = this.getCredentials();

      // Import dynamically to avoid circular dependency
      const { createClient } = require('@supabase/supabase-js');

      if (this.database_type === 'supabase') {
        const client = createClient(
          credentials.projectUrl,
          credentials.serviceRoleKey
        );

        // Test with simple query
        const { data, error } = await client
          .from('stores')
          .select('id')
          .limit(1);

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        await this.update({
          connection_status: 'connected',
          last_connection_test: new Date().toISOString()
        });

        return true;
      }

      return false;

    } catch (error) {
      console.error('Connection test failed:', error.message);
      await this.update({
        connection_status: 'failed',
        last_connection_test: new Date().toISOString()
      });

      return false;
    }
  }

  /**
   * Mark as active
   * @returns {Promise<void>}
   */
  async activate() {
    await this.update({
      is_active: true,
      connection_status: 'connected'
    });
  }

  /**
   * Mark as inactive
   * @returns {Promise<void>}
   */
  async deactivate() {
    await this.update({ is_active: false });
  }

  /**
   * Get data values (Sequelize compatibility)
   */
  get dataValues() {
    return { ...this };
  }
}

module.exports = StoreDatabase;
