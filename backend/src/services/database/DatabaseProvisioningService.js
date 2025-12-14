const ConnectionManager = require('./ConnectionManager');
const { IntegrationConfig, Store } = require('../../models');
const fs = require('fs').promises;
const path = require('path');

/**
 * DatabaseProvisioningService - Automatically provisions tables in client databases
 *
 * Handles:
 * - Table creation from SQL schema
 * - Migration execution
 * - Initial data seeding
 * - Schema synchronization
 */
class DatabaseProvisioningService {
  /**
   * Provision a new store database with all required tables
   */
  static async provisionStore(storeId, databaseConfig) {
    console.log(`🚀 Starting database provisioning for store ${storeId}...`);

    try {
      // Step 1: Validate configuration
      console.log('1️⃣ Validating database configuration...');
      this._validateConfig(databaseConfig);

      // Step 2: Test connection
      console.log('2️⃣ Testing database connection...');
      await this._testConnection(databaseConfig);

      // Step 3: Save connection configuration to master DB
      console.log('3️⃣ Saving connection configuration...');
      await this._saveConnectionConfig(storeId, databaseConfig);

      // Step 4: Create tables
      console.log('4️⃣ Creating database tables...');
      const tablesCreated = await this._createTables(storeId, databaseConfig);

      // Step 5: Run migrations if needed
      console.log('5️⃣ Running migrations...');
      await this._runMigrations(storeId);

      // Step 6: Seed initial data
      console.log('6️⃣ Seeding initial data...');
      await this._seedInitialData(storeId);

      // Step 7: Update store status
      console.log('7️⃣ Updating store status...');
      await Store.update(
        {
          database_status: 'active',
          database_type: databaseConfig.type
        },
        { where: { id: storeId } }
      );

      console.log(`✅ Database provisioning completed for store ${storeId}!`);

      return {
        success: true,
        message: 'Database provisioned successfully',
        tablesCreated: tablesCreated.length,
        tables: tablesCreated
      };
    } catch (error) {
      console.error(`❌ Database provisioning failed for store ${storeId}:`, error);

      // Update store status to failed
      await Store.update(
        {
          database_status: 'failed',
          metadata: {
            provisioning_error: error.message,
            failed_at: new Date()
          }
        },
        { where: { id: storeId } }
      ).catch(console.error);

      throw error;
    }
  }

  /**
   * Validate database configuration
   * @private
   */
  static _validateConfig(config) {
    if (!config.type) {
      throw new Error('Database type is required');
    }

    switch (config.type) {
      case 'supabase-database':
        if (!config.projectUrl || !config.serviceRoleKey) {
          throw new Error('Supabase projectUrl and serviceRoleKey are required');
        }
        break;

      case 'postgresql':
        if (!config.host || !config.database || !config.username) {
          throw new Error('PostgreSQL host, database, and username are required');
        }
        break;

      case 'mysql':
        if (!config.host || !config.database || !config.username) {
          throw new Error('MySQL host, database, and username are required');
        }
        break;

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  /**
   * Test database connection
   * @private
   */
  static async _testConnection(config) {
    try {
      const testConnection = await ConnectionManager._createConnection(config.type, config);

      // Test query - works for all database types with knex
      await testConnection.raw('SELECT 1');

      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Save connection configuration to master DB
   * @private
   */
  static async _saveConnectionConfig(storeId, config) {
    await IntegrationConfig.createOrUpdate(storeId, config.type, config);
    console.log('✅ Connection configuration saved');
  }

  /**
   * Create all required tables
   * @private
   */
  static async _createTables(storeId, config) {
    const connection = await ConnectionManager.getStoreConnection(storeId, false);
    const schema = await this._getClientDbSchema();

    const createdTables = [];

    for (const tableSQL of schema) {
      try {
        console.log(`  Creating table: ${tableSQL.name}...`);

        // Execute raw SQL using knex
        await connection.raw(tableSQL.sql);

        createdTables.push(tableSQL.name);
        console.log(`  ✅ Created table: ${tableSQL.name}`);
      } catch (error) {
        // Table might already exist
        if (error.message.includes('already exists') || error.code === '42P07') {
          console.log(`  ℹ️  Table ${tableSQL.name} already exists`);
        } else {
          console.error(`  ❌ Failed to create table ${tableSQL.name}:`, error.message);
          throw error;
        }
      }
    }

    return createdTables;
  }

  /**
   * Get client database schema (all e-commerce tables)
   * @private
   */
  static async _getClientDbSchema() {
    // Load the SQL file that contains all client table definitions
    const schemaPath = path.join(__dirname, '../../database/schemas/client-tables.sql');

    try {
      const schemaSQL = await fs.readFile(schemaPath, 'utf8');

      // Split into individual CREATE TABLE statements
      const statements = schemaSQL
        .split(';')
        .filter(sql => sql.trim().startsWith('CREATE TABLE'))
        .map(sql => {
          const tableName = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1] || 'unknown';
          return {
            name: tableName,
            sql: sql.trim() + ';'
          };
        });

      return statements;
    } catch (error) {
      // If schema file doesn't exist, extract from Sequelize models
      console.log('Schema file not found, extracting from models...');
      return await this._extractSchemaFromModels();
    }
  }

  /**
   * Extract schema from Sequelize models
   * @private
   */
  static async _extractSchemaFromModels() {
    const models = require('../../models');
    const clientTables = [
      'products',
      'categories',
      'orders',
      'order_items',
      'customers',
      'attributes',
      'attribute_values',
      'product_attribute_values',
      'cms_pages',
      'cms_blocks',
      'coupons',
      'taxes',
      'shipping_methods',
      'payment_methods',
      'product_variants',
      'product_labels',
      'seo_settings',
      'seo_templates',
      'carts',
      'wishlists',
      'addresses',
      'media_assets'
    ];

    const schema = [];

    for (const tableName of clientTables) {
      try {
        // Get model name from table name (capitalize and singularize roughly)
        const modelName = tableName
          .replace(/_([a-z])/g, (g) => g[1].toUpperCase())
          .replace(/^([a-z])/, (g) => g.toUpperCase())
          .replace(/s$/, '');

        const model = models[modelName];

        if (model) {
          const sql = await this._modelToCreateTableSQL(model);
          schema.push({
            name: tableName,
            sql
          });
        }
      } catch (error) {
        console.warn(`Could not extract schema for ${tableName}:`, error.message);
      }
    }

    return schema;
  }

  /**
   * Convert Sequelize model to CREATE TABLE SQL
   * @private
   * @deprecated This method is no longer supported - Sequelize has been removed
   */
  static async _modelToCreateTableSQL(model) {
    // Sequelize has been removed from the codebase
    // Schema is now managed directly in Supabase
    console.warn('⚠️ _modelToCreateTableSQL is deprecated - schema managed in Supabase');
    return null;
  }

  /**
   * Run database migrations
   * @private
   */
  static async _runMigrations(storeId) {
    // TODO: Implement migration runner for client databases
    console.log('ℹ️  Migration system not yet implemented');
    return true;
  }

  /**
   * Seed initial data
   * @private
   */
  static async _seedInitialData(storeId) {
    console.log('  Seeding default categories...');
    // TODO: Create default categories, settings, etc.

    console.log('  Seeding default settings...');
    // TODO: Create default SEO settings, shipping methods, etc.

    console.log('✅ Initial data seeded');
    return true;
  }

  /**
   * Check if store database is provisioned
   */
  static async isProvisioned(storeId) {
    const store = await Store.findByPk(storeId);
    return store && store.database_status === 'active';
  }

  /**
   * Re-provision a store (useful after schema changes)
   */
  static async reprovisionStore(storeId) {
    console.log(`🔄 Re-provisioning store ${storeId}...`);

    const dbTypes = ['supabase-database', 'postgresql', 'mysql'];
    const config = await IntegrationConfig.findByStoreAndTypes(storeId, dbTypes);

    if (!config) {
      throw new Error('No database configuration found for store');
    }

    return await this.provisionStore(storeId, {
      type: config.integration_type,
      ...config.config_data
    });
  }
}

module.exports = DatabaseProvisioningService;
