# Dual Database Architecture

## Overview
Separate master database (platform management) from client databases (store data) with automatic table provisioning.

## Architecture

### Master Database (Platform DB)
**Purpose**: Manage platform operations, billing, monitoring, and client management

**Location**: Single centralized database (current SQLite/PostgreSQL)

**Contains**:
```
Platform Management:
├── stores (client stores registry)
├── users (platform admin users)
├── subscriptions (client subscriptions)
├── billing_transactions
├── usage_metrics
├── api_usage_logs
├── integration_configs (connection info to client DBs)
├── platform_settings
└── audit_logs

Business Intelligence:
├── store_analytics
├── revenue_reports
├── usage_statistics
└── performance_metrics
```

### Client Databases (Store DBs)
**Purpose**: Store-specific e-commerce data

**Location**: Multiple databases (one per store or shared with isolation)

**Contains**:
```
E-commerce Data:
├── products
├── categories
├── customers
├── orders
├── order_items
├── inventory
├── attributes
├── prices
├── discounts
├── cms_pages
├── media_library
└── seo_settings
```

## Database Provisioning Flow

### 1. Store Creation Process
```javascript
// When a new store is created:
1. Create store record in MASTER DB
2. User selects database option:
   a) "Create New Database" (Supabase)
   b) "Connect Existing Database" (PostgreSQL/MySQL)
3. Provision tables automatically
4. Set up connection in integration_configs
5. Initialize default data (categories, settings, etc.)
```

### 2. Automatic Table Import

**backend/src/services/database/DatabaseProvisioningService.js**:
```javascript
class DatabaseProvisioningService {
  async provisionStore(storeId, databaseConfig) {
    // 1. Test connection
    const connection = await this.testConnection(databaseConfig);

    // 2. Check existing tables
    const existingTables = await this.listTables(connection);

    // 3. Get required schema
    const requiredSchema = await this.getRequiredSchema();

    // 4. Create missing tables
    for (const table of requiredSchema) {
      if (!existingTables.includes(table.name)) {
        await this.createTable(connection, table);
      }
    }

    // 5. Run migrations if needed
    await this.runMigrations(connection);

    // 6. Seed initial data
    await this.seedInitialData(connection, storeId);

    // 7. Update master DB with connection info
    await this.saveConnection(storeId, databaseConfig);
  }
}
```

## Schema Definitions

### Master DB Schema

**backend/src/database/schemas/master/**:

```sql
-- stores table (already exists, extend it)
CREATE TABLE stores (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id),

  -- Database connection
  database_type VARCHAR(50), -- 'supabase-database', 'postgresql', 'mysql'
  database_host VARCHAR(255),
  database_name VARCHAR(255),
  database_status VARCHAR(50), -- 'active', 'suspended', 'provisioning'

  -- Storage connection
  storage_type VARCHAR(50), -- 'supabase-storage', 'google-cloud-storage', 'aws-s3'
  storage_status VARCHAR(50),

  -- Subscription
  subscription_plan VARCHAR(50), -- 'free', 'starter', 'professional', 'enterprise'
  subscription_status VARCHAR(50), -- 'active', 'trial', 'expired', 'cancelled'
  trial_ends_at TIMESTAMP,
  subscription_started_at TIMESTAMP,

  -- Resource usage
  product_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  storage_used_bytes BIGINT DEFAULT 0,
  api_calls_month INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- subscriptions table (NEW)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  plan_name VARCHAR(50) NOT NULL, -- 'free', 'starter', 'professional', 'enterprise'
  status VARCHAR(50) NOT NULL, -- 'active', 'trial', 'cancelled', 'expired'

  -- Pricing
  price_monthly DECIMAL(10,2),
  price_annual DECIMAL(10,2),
  billing_cycle VARCHAR(20), -- 'monthly', 'annual'

  -- Limits
  max_products INTEGER,
  max_orders_per_month INTEGER,
  max_storage_gb INTEGER,
  max_api_calls_per_month INTEGER,

  -- Dates
  started_at TIMESTAMP NOT NULL,
  trial_ends_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- billing_transactions table (NEW)
CREATE TABLE billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),

  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50), -- 'pending', 'completed', 'failed', 'refunded'

  payment_method VARCHAR(50), -- 'stripe', 'paypal', 'credit_card'
  payment_provider_id VARCHAR(255), -- External payment ID

  description TEXT,
  invoice_url VARCHAR(500),

  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- usage_metrics table (NEW)
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  metric_date DATE NOT NULL,

  -- Product metrics
  products_created INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_deleted INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,

  -- Order metrics
  orders_created INTEGER DEFAULT 0,
  orders_total_value DECIMAL(10,2) DEFAULT 0,

  -- Storage metrics
  storage_uploaded_bytes BIGINT DEFAULT 0,
  storage_deleted_bytes BIGINT DEFAULT 0,
  storage_total_bytes BIGINT DEFAULT 0,

  -- API metrics
  api_calls INTEGER DEFAULT 0,
  api_errors INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, metric_date)
);

-- api_usage_logs table (NEW)
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,

  ip_address VARCHAR(45),
  user_agent TEXT,

  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

```

### Client DB Schema

**backend/src/database/schemas/client/**:

All existing e-commerce tables (products, categories, orders, etc.)

## Database Connection Manager

**backend/src/services/database/ConnectionManager.js**:
```javascript
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

class ConnectionManager {
  static connections = new Map();

  /**
   * Get database connection for a specific store
   */
  static async getStoreConnection(storeId) {
    // Check cache
    if (this.connections.has(storeId)) {
      return this.connections.get(storeId);
    }

    // Get connection info from master DB
    const config = await IntegrationConfig.findOne({
      where: {
        store_id: storeId,
        integration_type: {
          [Op.in]: ['supabase-database', 'postgresql', 'mysql']
        },
        is_active: true
      }
    });

    if (!config) {
      throw new Error(`No database configured for store ${storeId}`);
    }

    // Create connection based on type
    const connection = await this._createConnection(
      config.integration_type,
      config.config_data
    );

    // Cache it
    this.connections.set(storeId, connection);

    return connection;
  }

  static async _createConnection(type, config) {
    switch (type) {
      case 'supabase-database': {
        return createClient(config.projectUrl, config.serviceRoleKey);
      }

      case 'postgresql': {
        return new Pool({
          host: config.host,
          port: config.port || 5432,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : false
        });
      }

      case 'mysql': {
        const mysql = require('mysql2/promise');
        return mysql.createPool({
          host: config.host,
          port: config.port || 3306,
          database: config.database,
          user: config.username,
          password: config.password
        });
      }

      default:
        throw new Error(`Unknown database type: ${type}`);
    }
  }

  /**
   * Execute query on store's database
   */
  static async query(storeId, sql, params = []) {
    const connection = await this.getStoreConnection(storeId);
    return await connection.query(sql, params);
  }

  /**
   * Get master DB connection (current application DB)
   */
  static getMasterConnection() {
    const { sequelize } = require('../../database/connection');
    return sequelize;
  }
}
```

## Table Schema Extractor

**backend/src/services/database/SchemaExtractor.js**:
```javascript
class SchemaExtractor {
  /**
   * Extract all table schemas from current models
   */
  static async extractSchemas() {
    const fs = require('fs').promises;
    const path = require('path');

    const schemas = [];

    // Read all model files
    const modelFiles = await fs.readdir(
      path.join(__dirname, '../../models')
    );

    for (const file of modelFiles) {
      if (file.endsWith('.js') && file !== 'index.js') {
        const model = require(`../../models/${file}`);

        if (model && model.tableName) {
          const schema = await this.modelToSQL(model);
          schemas.push(schema);
        }
      }
    }

    return schemas;
  }

  /**
   * Convert Sequelize model to SQL CREATE TABLE statement
   */
  static async modelToSQL(model) {
    const tableName = model.tableName;
    const attributes = model.rawAttributes;

    const columns = [];

    for (const [name, attr] of Object.entries(attributes)) {
      const columnDef = this.attributeToSQL(name, attr);
      columns.push(columnDef);
    }

    return {
      name: tableName,
      sql: `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columns.join(',\n  ')}\n);`,
      indexes: this.extractIndexes(model)
    };
  }

  static attributeToSQL(name, attr) {
    // Convert Sequelize DataType to SQL
    // Implementation details...
  }
}
```

## Provisioning API

**backend/src/routes/database-provisioning.js**:
```javascript
router.post('/provision', authMiddleware, async (req, res) => {
  const { storeId, databaseType, config } = req.body;

  try {
    const provisioningService = new DatabaseProvisioningService();

    // Start provisioning (async)
    const job = await provisioningService.provisionStore(
      storeId,
      databaseType,
      config
    );

    res.json({
      success: true,
      message: 'Database provisioning started',
      jobId: job.id,
      status: 'provisioning'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/provision/:jobId/status', authMiddleware, async (req, res) => {
  const { jobId } = req.params;

  const job = await ProvisioningJob.findByPk(jobId);

  res.json({
    success: true,
    status: job.status,
    progress: job.progress,
    message: job.message,
    tablesCreated: job.tables_created,
    totalTables: job.total_tables
  });
});
```

## Usage Example

### Creating a new store with database:

```javascript
// 1. Create store in master DB
const store = await Store.create({
  name: 'My Shop',
  slug: 'my-shop',
  owner_id: userId,
  database_type: 'supabase-database',
  database_status: 'provisioning'
});

// 2. Provision database and tables
const job = await DatabaseProvisioningService.provisionStore(store.id, {
  type: 'supabase-database',
  projectUrl: 'https://xyz.supabase.co',
  serviceRoleKey: 'eyJ...'
});

// 3. Monitor provisioning
// Frontend polls /provision/:jobId/status

// 4. Once complete, store is ready
await store.update({ database_status: 'active' });
```

### Querying store data:

```javascript
// Queries go to the STORE's database
const products = await ConnectionManager.query(
  storeId,
  'SELECT * FROM products WHERE is_active = true'
);

// Business metrics go to MASTER database
const storeStats = await Store.findOne({
  where: { id: storeId },
  include: [
    { model: Subscription },
    { model: UsageMetrics }
  ]
});
```

## Benefits

1. **Scalability**: Each store has its own database
2. **Isolation**: Client data is completely separate
3. **Flexibility**: Use different database providers per store
4. **Security**: Connection credentials stored in master DB only
5. **Multi-tenancy**: Clear separation of platform vs client data
6. **Business Intelligence**: Centralized monitoring and analytics
7. **Billing**: Track usage and subscriptions easily
8. **Compliance**: Data residency requirements per client

## Migration Path

1. ✅ Update IntegrationConfig model (done)
2. ⏳ Create master DB tables (subscriptions, billing, usage_metrics)
3. ⏳ Build ConnectionManager
4. ⏳ Build DatabaseProvisioningService
5. ⏳ Build SchemaExtractor
6. ⏳ Update all routes to use ConnectionManager
7. ⏳ Create provisioning UI
8. ⏳ Migrate existing stores

## Next Steps

1. Create master DB migration for new tables
2. Implement ConnectionManager
3. Implement DatabaseProvisioningService
4. Update routes to query store databases
5. Build provisioning UI
6. Test with multiple stores
