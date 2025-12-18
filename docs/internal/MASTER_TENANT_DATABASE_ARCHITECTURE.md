# Master-Tenant Database Architecture

## Database Structure

### Master DB (`rduywfunijdaqyhcyxpq`)
**Purpose:** Platform-level management and control

**Tables:**
- `users` - Agency users (store owners, admins)
- `stores` - Store registry (id, user_id, status, is_active, **slug**)
- `store_databases` - Tenant DB credentials (encrypted)
- `credit_balances` - Current credit balance per store
- `credit_transactions` - Credit purchase/usage history
- `subscriptions` - Billing plans
- `job_queue` - Background jobs

### Tenant DB (per store - e.g., `ksqlvpcwqnozlqyouwez`)
**Purpose:** Store-specific operational data

**Tables:**
- `stores` - Full store config (name, slug, settings, theme, contact, etc.)
- `products`, `categories`, `attributes`
- `orders`, `order_items`, `customers`
- `cms_pages`, `cms_blocks`, `email_templates`
- `wishlists`, `reviews`, `coupons`
- All store-specific operational data

## Operation Database Matrix

### Both Master AND Tenant

| Operation | Master DB | Tenant DB | Notes |
|-----------|-----------|-----------|-------|
| **Create Store** | Insert `stores` record (id, user_id, status, slug) | Insert `stores` record (full config) | Same store_id in both |
| **Delete Store** | Soft delete (status='suspended') | Hard delete or cascade | Master keeps history |
| **Change Slug** | Update `stores.slug` | Update `stores.slug` | Keep in sync for routing |

### Only Master DB

| Operation | Table | Notes |
|-----------|-------|-------|
| **Toggle Store Status** | `stores.status`, `stores.is_active` | For platform control (abuse, billing) |
| **Credits Purchase** | `credit_transactions`, `credit_balances` | Platform-level billing |
| **Credits Usage** | `credit_transactions` | Track AI, translations, plugin usage |
| **User Management** | `users` | Agency users (store owners) |
| **Store Ownership** | `stores.user_id` | Who owns which store |

### Only Tenant DB

| Operation | Tables | Notes |
|-----------|--------|-------|
| **Store Settings** | `stores` (name, email, currency, theme, settings) | Per-store configuration |
| **Products** | `products`, `product_translations`, `product_images` | Store catalog |
| **Categories** | `categories`, `category_translations` | Store navigation |
| **Orders** | `orders`, `order_items` | Store transactions |
| **Customers** | `customers`, `customer_addresses` | Store customers (NOT agency users) |
| **CMS** | `cms_pages`, `cms_blocks` | Store content |
| **Email Templates** | `email_templates` | Store communications |
| **All other store data** | Various | Everything else is tenant-specific |

## Code Patterns

### Master DB Queries
```javascript
// Use Supabase client (recommended)
const { masterSupabaseClient } = require('../database/masterConnection');
const { data, error } = await masterSupabaseClient.from('stores').select('*');

// Or Sequelize (if needed)
const { masterSequelize } = require('../database/masterConnection');
const [results] = await masterSequelize.query('SELECT ...');
```

### Tenant DB Queries
```javascript
const ConnectionManager = require('../services/database/ConnectionManager');

// Get tenant connection
const tenantDb = await ConnectionManager.getStoreConnection(storeId);

// Query tenant DB
const { data, error } = await tenantDb.from('products').select('*');
```

### Both Databases
```javascript
// Create store example
// 1. Create in master
await masterSupabaseClient.from('stores').insert({
  id: storeId,
  user_id: userId,
  status: 'active',
  slug: slug
});

// 2. Create in tenant
const tenantDb = await ConnectionManager.getStoreConnection(storeId);
await tenantDb.from('stores').insert({
  id: storeId,
  name: name,
  slug: slug,
  // ... full config
});
```

## Migration Checklist

- [x] Store creation/provisioning uses both DBs
- [x] Store dropdown fetches from master + tenant
- [x] Settings endpoints use tenant DB
- [x] Auth uses master DB for agency users
- [x] Slug stored in master DB for routing
- [ ] Storefront bootstrap uses tenant DB for all queries
- [ ] Product routes use tenant DB
- [ ] Category routes use tenant DB
- [ ] Order routes use tenant DB
- [ ] Customer routes use tenant DB

## Environment Variables

### Production (Render)
```bash
# Master DB
MASTER_DB_URL=postgresql://postgres.rduywfunijdaqyhcyxpq:...@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
MASTER_SUPABASE_URL=https://rduywfunijdaqyhcyxpq.supabase.co
MASTER_SUPABASE_SERVICE_KEY=eyJh...

# OAuth (Platform-level)
SUPABASE_OAUTH_CLIENT_ID=...
SUPABASE_OAUTH_CLIENT_SECRET=...

# Security
ENCRYPTION_KEY=... (for encrypting tenant credentials)

# DEPRECATED - Remove after full migration
DATABASE_URL=... (legacy combined database)
SUPABASE_DB_URL=... (legacy)
```
