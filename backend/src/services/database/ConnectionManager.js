const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const SupabaseAdapter = require('./adapters/SupabaseAdapter');
const PostgreSQLAdapter = require('./adapters/PostgreSQLAdapter');
const MySQLAdapter = require('./adapters/MySQLAdapter');

/**
 * KnexStyleQueryBuilder - Provides Knex-like query syntax that wraps Supabase adapter
 * Allows using familiar Knex patterns: db('table').where(...).select(...)
 */
class KnexStyleQueryBuilder {
  constructor(adapter, tableName) {
    this.adapter = adapter;
    this.tableName = tableName;
    this._filters = [];
    this._orFilters = [];
    this._orderBy = [];
    this._selectColumns = '*';
    this._limitValue = null;
    this._insertData = null;
    this._updateData = null;
    this._deleteFlag = false;
  }

  // SELECT columns
  select(columns = '*') {
    this._selectColumns = columns;
    return this;
  }

  // WHERE clause - supports multiple formats
  where(columnOrCallback, value) {
    if (typeof columnOrCallback === 'function') {
      // Callback style: .where(function() { this.whereNull('col').orWhere('col', val) })
      // This creates a grouped OR condition
      const subBuilder = new KnexSubQueryBuilder();
      columnOrCallback.call(subBuilder);
      const groupFilters = subBuilder.getFilters();
      if (groupFilters.length > 0) {
        // Store as a grouped OR condition
        this._filters.push({ type: 'orGroup', filters: groupFilters });
      }
    } else if (typeof columnOrCallback === 'object') {
      // Object style: .where({ col1: val1, col2: val2 })
      for (const [col, val] of Object.entries(columnOrCallback)) {
        this._filters.push({ type: 'eq', column: col, value: val });
      }
    } else {
      // Simple style: .where('column', value)
      this._filters.push({ type: 'eq', column: columnOrCallback, value });
    }
    return this;
  }

  whereNull(column) {
    this._filters.push({ type: 'is', column, value: null });
    return this;
  }

  whereNotNull(column) {
    this._filters.push({ type: 'not', column, operator: 'is', value: null });
    return this;
  }

  orWhere(column, operator, value) {
    if (value === undefined) {
      // Two-arg form: orWhere('column', value)
      this._orFilters.push({ type: 'eq', column, value: operator });
    } else {
      // Three-arg form: orWhere('column', '<=', value)
      this._orFilters.push({ type: 'operator', column, operator, value });
    }
    return this;
  }

  // ORDER BY
  orderBy(column, direction = 'asc') {
    this._orderBy.push({ column, ascending: direction.toLowerCase() !== 'desc' });
    return this;
  }

  // LIMIT
  limit(count) {
    this._limitValue = count;
    return this;
  }

  // INSERT
  insert(data) {
    this._insertData = data;
    return this;
  }

  // UPDATE
  update(data) {
    this._updateData = data;
    return this;
  }

  // DELETE
  delete() {
    this._deleteFlag = true;
    return this;
  }

  // Execute the query and return results
  async then(resolve, reject) {
    try {
      const result = await this._execute();
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  async _execute() {
    const client = this.adapter.getClient();
    let query = client.from(this.tableName);

    // Handle INSERT
    if (this._insertData) {
      const { data, error } = await query.insert(this._insertData).select();
      if (error) throw new Error(error.message);
      return data;
    }

    // Handle UPDATE
    if (this._updateData) {
      query = query.update(this._updateData);
      // Apply filters for UPDATE
      for (const filter of this._filters) {
        query = this._applyFilter(query, filter);
      }
      const { data, error } = await query.select();
      if (error) throw new Error(error.message);
      return data;
    }

    // Handle DELETE
    if (this._deleteFlag) {
      // Apply filters for DELETE
      for (const filter of this._filters) {
        query = this._applyFilter(query, filter);
      }
      const { error } = await query.delete();
      if (error) throw new Error(error.message);
      return true;
    }

    // Handle SELECT
    query = query.select(this._selectColumns);

    // Apply filters
    for (const filter of this._filters) {
      query = this._applyFilter(query, filter);
    }

    // Apply OR filters (combined with OR logic)
    if (this._orFilters.length > 0) {
      const orConditions = this._orFilters.map(f => {
        if (f.type === 'eq') return `${f.column}.eq.${f.value}`;
        if (f.type === 'operator') {
          const opMap = { '<=': 'lte', '>=': 'gte', '<': 'lt', '>': 'gt', '=': 'eq' };
          return `${f.column}.${opMap[f.operator] || 'eq'}.${f.value}`;
        }
        return null;
      }).filter(Boolean).join(',');
      if (orConditions) {
        query = query.or(orConditions);
      }
    }

    // Apply ordering
    for (const order of this._orderBy) {
      query = query.order(order.column, { ascending: order.ascending });
    }

    // Apply limit
    if (this._limitValue) {
      query = query.limit(this._limitValue);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  _applyFilter(query, filter) {
    switch (filter.type) {
      case 'eq':
        return query.eq(filter.column, filter.value);
      case 'is':
        return query.is(filter.column, filter.value);
      case 'not':
        return query.not(filter.column, filter.operator, filter.value);
      case 'operator': {
        const opMap = { '<=': 'lte', '>=': 'gte', '<': 'lt', '>': 'gt', '=': 'eq' };
        const method = opMap[filter.operator] || 'eq';
        return query[method](filter.column, filter.value);
      }
      case 'orGroup': {
        // Build OR condition string for Supabase
        // Format: "col.is.null,col.lte.value"
        const conditions = filter.filters.map(f => {
          if (f.type === 'is' && f.value === null) {
            return `${f.column}.is.null`;
          } else if (f.type === 'eq') {
            return `${f.column}.eq.${f.value}`;
          } else if (f.type === 'operator') {
            const opMap = { '<=': 'lte', '>=': 'gte', '<': 'lt', '>': 'gt', '=': 'eq' };
            const op = opMap[f.operator] || 'eq';
            // Format date values properly
            const val = f.value instanceof Date ? f.value.toISOString() : f.value;
            return `${f.column}.${op}.${val}`;
          }
          return null;
        }).filter(Boolean).join(',');

        if (conditions) {
          return query.or(conditions);
        }
        return query;
      }
      default:
        return query;
    }
  }

  // First result only
  async first() {
    this._limitValue = 1;
    const results = await this._execute();
    return results[0] || null;
  }
}

/**
 * KnexSubQueryBuilder - Handles callback-style where clauses
 * Used for: .where(function() { this.whereNull('col').orWhere('col', val) })
 */
class KnexSubQueryBuilder {
  constructor() {
    this._filters = [];
  }

  whereNull(column) {
    this._filters.push({ type: 'is', column, value: null, logic: 'and' });
    return this;
  }

  orWhere(column, operator, value) {
    if (value === undefined) {
      this._filters.push({ type: 'eq', column, value: operator, logic: 'or' });
    } else {
      this._filters.push({ type: 'operator', column, operator, value, logic: 'or' });
    }
    return this;
  }

  getFilters() {
    // Convert to format that main builder understands
    // For OR logic with NULL checks, we need special handling
    if (this._filters.length === 0) return [];

    // If we have a whereNull followed by orWhere, we need to combine them
    // This matches the pattern: where(function() { this.whereNull('start_date').orWhere('start_date', '<=', now) })
    // Which means: start_date IS NULL OR start_date <= now
    const combined = [];
    for (const filter of this._filters) {
      if (filter.logic === 'or') {
        // OR filters go to a special category
        combined.push({ ...filter, _isOr: true });
      } else {
        combined.push(filter);
      }
    }
    return combined;
  }
}

/**
 * ConnectionManager - Manages database connections for stores
 *
 * UPDATED for Master-Tenant Architecture:
 * - Master DB connection (platform data: users, stores, subscriptions, credits)
 * - Tenant DB connections (per-store data: products, orders, customers)
 * - Connection pooling and caching
 * - Multi-database query routing
 *
 * Uses StoreDatabase model from master DB to fetch encrypted tenant credentials
 */
class ConnectionManager {
  static connections = new Map();
  static masterConnection = null;

  /**
   * Get the master database connection (platform DB)
   * Contains: users (agencies), stores (minimal), subscriptions, credits, monitoring
   *
   * @deprecated Use masterDbClient from masterConnection.js directly instead.
   * This method uses Sequelize which has pooler authentication issues.
   */
  static getMasterConnection() {
    console.warn('⚠️ DEPRECATED: getMasterConnection() is deprecated. Use masterDbClient from masterConnection.js instead.');
    if (!this.masterConnection) {
      const { masterSequelize } = require('../../database/masterConnection');
      this.masterConnection = masterSequelize;
    }
    return this.masterConnection;
  }

  /**
   * Get store-specific database connection (client DB)
   * Contains: products, categories, orders, customers, etc.
   *
   * @param {string} storeId - Store UUID
   * @param {boolean} cache - Whether to use cached connection (default: true)
   * @returns {Promise<Object>} Database connection object
   */
  static async getStoreConnection(storeId, cache = true) {
    // Validate store ID
    if (!storeId || storeId === 'undefined') {
      throw new Error('Valid store ID is required');
    }

    // Check cache first
    if (cache && this.connections.has(storeId)) {
      const cached = this.connections.get(storeId);
      return cached.connection || cached; // Return just the connection, not the wrapper object
    }

    // Get connection configuration from master DB (use Supabase client to avoid Sequelize auth issues)
    const { masterDbClient } = require('../../database/masterConnection');
    const { decryptDatabaseCredentials } = require('../../utils/encryption');

    const { data: storeDb, error } = await masterDbClient
      .from('store_databases')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch database config: ${error.message}`);
    }

    if (!storeDb) {
      throw new Error(
        `No database configured for store ${storeId}. ` +
        'Please connect a database first.'
      );
    }

    if (!storeDb.is_active) {
      throw new Error(`Database for store ${storeId} is inactive`);
    }

    // Decrypt credentials from master DB
    const credentials = decryptDatabaseCredentials(storeDb.connection_string_encrypted);

    // Create connection based on database type
    const connection = await this._createConnection(
      storeDb.database_type,
      credentials,
      storeId
    );

    // Test the connection
    try {
      await this._testConnection(connection, storeDb.database_type);
    } catch (error) {
      console.error(`Failed to connect to database for store ${storeId}:`, error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Cache the connection
    if (cache) {
      this.connections.set(storeId, {
        connection,
        type: storeDb.database_type,
        createdAt: new Date()
      });
    }

    return connection;
  }

  /**
   * Create a database connection based on database type
   * @private
   */
  static async _createConnection(type, credentials, storeId) {
    switch (type) {
      case 'supabase':
        return this._createSupabaseConnection(credentials);

      case 'postgresql':
        return this._createPostgreSQLConnection(credentials);

      case 'mysql':
        return this._createMySQLConnection(credentials);

      default:
        throw new Error(`Unknown database type: ${type}`);
    }
  }

  /**
   * Create Supabase client connection
   * @private
   */
  static _createSupabaseConnection(config) {
    if (!config.projectUrl) {
      throw new Error('Supabase projectUrl is required');
    }

    if (!config.serviceRoleKey) {
      throw new Error('Supabase serviceRoleKey is required');
    }

    const supabaseClient = createClient(config.projectUrl, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: config.schema || 'public'
      }
    });

    // Wrap Supabase client in adapter for generic interface
    return new SupabaseAdapter(supabaseClient, config);
  }

  /**
   * Create PostgreSQL connection pool
   * @private
   */
  static _createPostgreSQLConnection(config) {
    if (!config.host || !config.database) {
      throw new Error('PostgreSQL host and database are required');
    }

    const pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username || config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    // Wrap PostgreSQL pool in adapter for generic interface
    return new PostgreSQLAdapter(pool, config);
  }

  /**
   * Create MySQL connection pool
   * @private
   */
  static _createMySQLConnection(config) {
    if (!config.host || !config.database) {
      throw new Error('MySQL host and database are required');
    }

    const mysql = require('mysql2/promise');

    const pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username || config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: config.maxConnections || 10,
      queueLimit: 0
    });

    // Wrap MySQL pool in adapter for generic interface
    return new MySQLAdapter(pool, config);
  }

  /**
   * Test database connection
   * @private
   */
  static async _testConnection(connection, type) {
    // All adapters now implement testConnection() method
    const isConnected = await connection.testConnection();

    if (!isConnected) {
      throw new Error(`Failed to connect to ${type} database`);
    }
  }

  /**
   * Execute a query on a store's database
   *
   * @param {string} storeId - Store UUID
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Query results
   */
  static async query(storeId, sql, params = []) {
    const connectionInfo = await this.getStoreConnection(storeId);
    const connection = connectionInfo.connection || connectionInfo;
    const type = connectionInfo.type;

    switch (type) {
      case 'supabase-database':
      case 'supabase':
        // Supabase uses its own query syntax
        throw new Error('Use Supabase client methods directly instead of raw SQL');

      case 'postgresql':
      case 'mysql':
        const result = await connection.query(sql, params);
        return result.rows || result[0]; // PostgreSQL returns .rows, MySQL returns array

      default:
        throw new Error(`Query not supported for type: ${type}`);
    }
  }

  /**
   * Execute a query on the master database
   *
   * @deprecated Use masterDbClient from masterConnection.js directly instead.
   * This method uses Sequelize which has pooler authentication issues.
   *
   * @param {string} sql - SQL query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Query results
   */
  static async queryMaster(sql, options = {}) {
    console.warn('⚠️ DEPRECATED: queryMaster() is deprecated. Use masterDbClient from masterConnection.js instead.');
    const sequelize = this.getMasterConnection();
    const [results] = await sequelize.query(sql, options);
    return results;
  }

  /**
   * Get a Knex-like connection for a store
   * Uses Supabase REST API instead of Sequelize to avoid pooler authentication issues
   *
   * @param {string} storeId - Store UUID
   * @returns {Promise<Function>} Knex-like callable connection
   */
  static async getConnection(storeId) {
    // Check cache first
    const cacheKey = `knex_connection_${storeId}`;
    if (this.connections.has(cacheKey)) {
      return this.connections.get(cacheKey);
    }

    // Get the store connection (returns SupabaseAdapter or other adapter)
    const adapter = await this.getStoreConnection(storeId);

    // Create a Knex-like callable wrapper
    const knexLikeConnection = this._createKnexLikeWrapper(adapter);

    // Cache the connection
    this.connections.set(cacheKey, knexLikeConnection);

    return knexLikeConnection;
  }

  /**
   * Create a Knex-like callable wrapper around a database adapter
   * Allows using both syntaxes:
   * - Knex-style: db('table').where(...).select(...)
   * - Supabase-style: db.from('table').select(...).eq(...)
   *
   * @private
   */
  static _createKnexLikeWrapper(adapter) {
    // Create a callable function that returns a query builder for a table
    const wrapper = (tableName) => {
      return new KnexStyleQueryBuilder(adapter, tableName);
    };

    // Support Supabase-style .from() method
    wrapper.from = (tableName) => {
      // Return the adapter's query builder for Supabase-style queries
      return adapter.from(tableName);
    };

    // Attach the adapter for direct access if needed
    wrapper.adapter = adapter;
    wrapper.type = adapter.type;

    // Also expose getClient for compatibility
    wrapper.getClient = () => adapter.getClient();

    return wrapper;
  }

  /**
   * Get connection info for a store
   *
   * @param {string} storeId - Store UUID
   * @returns {Promise<Object>} Connection information (without sensitive data)
   */
  static async getConnectionInfo(storeId) {
    const { StoreDatabase } = require('../../models/master');
    const storeDb = await StoreDatabase.findByStoreId(storeId);

    if (!storeDb) {
      return null;
    }

    return {
      type: storeDb.database_type,
      status: storeDb.connection_status,
      lastTested: storeDb.last_connection_test,
      isActive: storeDb.is_active,
      host: storeDb.host, // Non-sensitive
      // Don't expose sensitive connection details (credentials are encrypted)
      hasConfiguration: !!storeDb.connection_string_encrypted
    };
  }

  /**
   * Clear cached connection for a store
   *
   * @param {string} storeId - Store UUID (optional, clears all if not provided)
   */
  static clearCache(storeId = null) {
    if (storeId) {
      const connectionInfo = this.connections.get(storeId);
      if (connectionInfo) {
        // Close connection if it has an end method
        if (connectionInfo.connection?.end) {
          connectionInfo.connection.end().catch(console.error);
        }
        this.connections.delete(storeId);
      }
    } else {
      // Clear all connections
      for (const [id, info] of this.connections.entries()) {
        if (info.connection?.end) {
          info.connection.end().catch(console.error);
        }
      }
      this.connections.clear();
    }
  }

  /**
   * Get all cached connections (for monitoring)
   */
  static getCachedConnections() {
    const cached = [];
    for (const [storeId, info] of this.connections.entries()) {
      cached.push({
        storeId,
        type: info.type,
        cachedSince: info.createdAt
      });
    }
    return cached;
  }

  /**
   * Test connection for a store without caching
   *
   * @param {string} storeId - Store UUID
   * @returns {Promise<Object>} Connection test result
   */
  static async testStoreConnection(storeId) {
    try {
      const connection = await this.getStoreConnection(storeId, false);
      return {
        success: true,
        message: 'Successfully connected to store database',
        storeId
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        storeId
      };
    }
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  static async closeAll() {
    console.log('Closing all database connections...');

    for (const [storeId, info] of this.connections.entries()) {
      try {
        if (info.connection?.end) {
          await info.connection.end();
          console.log(`Closed connection for store ${storeId}`);
        }
      } catch (error) {
        console.error(`Error closing connection for store ${storeId}:`, error.message);
      }
    }

    this.connections.clear();

    // Close master connection
    if (this.masterConnection) {
      try {
        await this.masterConnection.close();
        console.log('Closed master database connection');
      } catch (error) {
        console.error('Error closing master connection:', error.message);
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await ConnectionManager.closeAll();
});

process.on('SIGINT', async () => {
  await ConnectionManager.closeAll();
});

module.exports = ConnectionManager;
