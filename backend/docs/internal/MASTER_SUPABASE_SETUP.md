# Master Supabase Database Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER SUPABASE DATABASE                  │
│                  (Platform Management)                       │
│                                                              │
│  Tables:                                                     │
│  ├── stores (all client stores registry)                    │
│  ├── users (platform users)                                 │
│  ├── subscriptions (billing plans)                          │
│  ├── billing_transactions (payments)                        │
│  ├── usage_metrics (resource tracking)                      │
│  ├── api_usage_logs (API monitoring)                        │
│  ├── integration_configs (DB/storage connections)           │
│  ├── store_teams (team members)                             │
│  └── ... (all platform management tables)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ manages
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              CLIENT DATABASES (per store)                    │
│                                                              │
│  Store 1 → Supabase DB 1 (or PostgreSQL/MySQL)             │
│    ├── products                                              │
│    ├── categories                                            │
│    ├── orders                                                │
│    └── customers                                             │
│                                                              │
│  Store 2 → Supabase DB 2                                    │
│    ├── products                                              │
│    ├── categories                                            │
│    └── ...                                                   │
│                                                              │
│  Store 3 → PostgreSQL                                       │
│    └── (e-commerce tables)                                   │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Create Master Supabase Project

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Click "New Project"

2. **Project Settings**
   ```
   Name: daino-master
   Database Password: [Generate strong password - SAVE THIS!]
   Region: Choose closest to your servers
   Pricing Plan: Pro (recommended for production)
   ```

3. **Save Connection Details**
   ```
   Project URL: https://[project-ref].supabase.co
   API URL: https://[project-ref].supabase.co/rest/v1/
   anon key: [public key]
   service_role key: [secret key - SAVE THIS!]
   ```

## Step 2: Master Database Tables

### Platform Management Tables

The master database contains **TWO types of tables**:

#### A. Existing Application Tables (Already in Codebase)
These are managed by Sequelize and auto-created:

```sql
-- Core platform tables
stores
users
login_attempts
store_teams
store_invitations
integration_configs
akeneo_import_statistics

-- Plugin system
plugins
plugin_configurations

-- Credits & jobs
credits
credit_transactions
credit_usage
jobs
job_histories

-- OAuth tokens
supabase_oauth_tokens
shopify_oauth_tokens

-- Media & content
media_assets
languages
translations

-- Settings
seo_settings
cookie_consent_settings
```

#### B. New Business Management Tables (Need Manual Creation)
These handle subscriptions, billing, and usage tracking:

```sql
-- Business management (NEW)
subscriptions
billing_transactions
usage_metrics
api_usage_logs
```

## Step 3: Run Master Database Migration

### Option A: Using Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard/project/[project-ref]
   - Navigate to "SQL Editor"

2. **Run Migration Script**
   - Click "New Query"
   - Copy and paste the entire content from:
     `backend/src/database/migrations/create-master-business-tables.sql`
   - Click "Run"

3. **Verify Tables Created**
   - Go to "Table Editor"
   - You should see: subscriptions, billing_transactions, usage_metrics, api_usage_logs

### Option B: Using psql Command Line

```bash
# Get connection string from Supabase dashboard (Settings > Database > Connection String)
psql "postgresql://postgres:[PASSWORD]@db.[project-ref].supabase.co:5432/postgres" \
  -f backend/src/database/migrations/create-master-business-tables.sql
```

## Step 4: Configure Backend Environment

Update your `.env` file:

```bash
# Master Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Encryption keys
INTEGRATION_ENCRYPTION_KEY=[generate-random-32-char-string]
SESSION_SECRET=[generate-random-32-char-string]

# Frontend URL (for OAuth callbacks)
FRONTEND_URL=https://www..dainostore.com
```

**Generate Secure Keys:**
```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 5: Initialize Backend Connection

Update `backend/src/database/connection.js` to use Supabase:

```javascript
const { Sequelize } = require('sequelize');

// Use DATABASE_URL for production (Supabase)
const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite::memory:', {
  dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  dialectOptions: process.env.DATABASE_URL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = { sequelize };
```

## Step 6: Test Master Database Connection

```bash
cd backend

# Test connection
node -e "
const { sequelize } = require('./src/database/connection');
sequelize.authenticate()
  .then(() => console.log('✅ Master DB connected'))
  .catch(err => console.error('❌ Connection failed:', err));
"
```

## Step 7: Sync Sequelize Models

This creates all the "existing application tables" (Type A):

```bash
cd backend

# Sync models (creates tables if they don't exist)
node -e "
const { sequelize } = require('./src/database/connection');
const models = require('./src/models');

sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ All models synced to master database');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
"
```

## Step 8: Verify All Tables Exist

```sql
-- Run in Supabase SQL Editor
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected tables (50+):**
```
- api_usage_logs ✓
- attributes
- attribute_sets
- attribute_values
- billing_transactions ✓
- carts
- categories
- cms_blocks
- cms_pages
- cookie_consent_settings
- coupons
- credits
- credit_transactions
- credit_usage
- customers
- integration_configs
- jobs
- job_histories
- languages
- login_attempts
- media_assets
- orders
- order_items
- payment_methods
- plugins
- plugin_configurations
- products
- product_attribute_values
- product_labels
- product_tabs
- product_variants
- seo_settings
- seo_templates
- shipping_methods
- shopify_oauth_tokens
- stores
- store_teams
- store_invitations
- supabase_oauth_tokens
- subscriptions ✓
- taxes
- translations
- usage_metrics ✓
- users
- wishlists
... and more
```

## Step 9: Create Default Subscription Plans

```sql
-- Run in Supabase SQL Editor or via API
INSERT INTO subscriptions (
  store_id,
  plan_name,
  status,
  price_monthly,
  max_products,
  max_orders_per_month,
  max_storage_gb,
  max_api_calls_per_month,
  started_at
)
SELECT
  id as store_id,
  'free' as plan_name,
  'trial' as status,
  0.00 as price_monthly,
  10 as max_products,
  100 as max_orders_per_month,
  1 as max_storage_gb,
  1000 as max_api_calls_per_month,
  NOW() as started_at
FROM stores;
```

## What Tables Go Where?

### Master Database (Supabase Project #1)

**Platform Management:**
- ✅ stores (all stores registry)
- ✅ users (all platform users)
- ✅ subscriptions (billing)
- ✅ billing_transactions (payments)
- ✅ usage_metrics (tracking)
- ✅ api_usage_logs (monitoring)
- ✅ integration_configs (connections to client DBs)
- ✅ store_teams (team management)
- ✅ plugins (platform plugins)
- ✅ credits (platform credits)
- ✅ jobs (background jobs)
- ✅ oauth_tokens (OAuth connections)

**Important:** Master DB does NOT contain:
- ❌ products (these go in client DBs)
- ❌ categories (these go in client DBs)
- ❌ orders (these go in client DBs)
- ❌ customers (these go in client DBs)

### Client Databases (Separate Supabase Projects or PostgreSQL)

**E-commerce Data (Per Store):**
- ✅ products
- ✅ categories
- ✅ orders
- ✅ order_items
- ✅ customers
- ✅ carts
- ✅ wishlists
- ✅ attributes
- ✅ coupons
- ✅ cms_pages
- ✅ cms_blocks
- ✅ seo_templates
- ✅ ... all store-specific e-commerce data

## Migration Path for Existing Data

If you have existing stores in SQLite/PostgreSQL:

```javascript
// Migrate to dual-database architecture
const DatabaseProvisioningService = require('./src/services/database/DatabaseProvisioningService');

async function migrateStore(storeId) {
  // 1. Create new client database (Supabase or PostgreSQL)
  const clientDbConfig = {
    type: 'supabase-database',
    projectUrl: 'https://[new-project].supabase.co',
    serviceRoleKey: '[service-role-key]'
  };

  // 2. Provision tables
  await DatabaseProvisioningService.provisionStore(storeId, clientDbConfig);

  // 3. Migrate data from old DB to new client DB
  // (TODO: Create migration script)

  // 4. Update integration_configs to point to new DB
  await IntegrationConfig.createOrUpdate(storeId, 'supabase-database', clientDbConfig);
}
```

## Architecture Benefits

### Master Database (1 Supabase Project)
- **Stores:** 1,000s of stores
- **Users:** 10,000s of platform users
- **Purpose:** Business operations, billing, monitoring
- **Queries:** Platform analytics, user management, billing

### Client Databases (1 per store or shared with isolation)
- **Products:** Per-store data
- **Orders:** Store-specific
- **Purpose:** E-commerce operations
- **Queries:** Product listings, order processing

## Next Steps After Setup

1. ✅ Master database created and configured
2. ⏳ Set up first client database for a test store
3. ⏳ Configure storage provider (Supabase Storage, Google Cloud, S3)
4. ⏳ Build subscription management UI
5. ⏳ Build usage analytics dashboard
6. ⏳ Integrate payment provider (Stripe)
7. ⏳ Test database provisioning flow
8. ⏳ Migrate existing stores

## Quick Start Commands

```bash
# 1. Update environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Install dependencies
cd backend && npm install

# 3. Sync models to master DB
npm run db:sync

# 4. Start server
npm start

# 5. Test master DB connection
curl http://localhost:5000/health
```

## Support

- Supabase Docs: https://supabase.com/docs
- Connection Issues: Check SSL settings and IP allowlist
- Table Creation: Use SQL Editor in Supabase dashboard
- Migration Help: Run migrations manually via psql or SQL Editor

## Summary

**You need:**
1. **1 Master Supabase Project** - Contains all platform management tables
2. **N Client Databases** - One per store (or shared), contains e-commerce data
3. **Storage Providers** - Independent (can be different per store)

**Master DB contains:**
- Platform tables (stores, users, subscriptions, billing, usage, admins)
- Connection info to client databases (integration_configs)

**Client DBs contain:**
- E-commerce tables (products, orders, customers, categories)
- Store-specific data only
