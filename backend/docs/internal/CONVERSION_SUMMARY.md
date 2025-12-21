# Sequelize to ConnectionManager Conversion - Summary Report

## Date: 2025-11-20

## Overview

This project requires replacing all Sequelize ORM usage with ConnectionManager across 100+ files. The conversion separates **Master Database** operations (platform data) from **Tenant Database** operations (per-store data).

## Current Status

### Files Analyzed
- **Total files with Sequelize usage**: 100+
- **Files converted so far**: 2
- **Files partially converted**: Several (using ConnectionManager but incorrectly)

### Files Already Converted (Fully)
1. ✅ `backend/src/routes/orders.js` - Converted diagnostic endpoints
2. ✅ `backend/src/routes/cart.js` - Already using ConnectionManager correctly

### Files Needing Conversion (High Priority)

#### Critical Issue Found: Mixed Master/Tenant Usage

Many files use `ConnectionManager.getConnection(store_id)` which returns Sequelize models, but then query the `Store` model. **This is incorrect** because:

- `Store` model exists in BOTH master and tenant DBs
- Platform-level store data (user_id, stripe_account_id, settings) lives in **master DB**
- Store-specific product/order data lives in **tenant DB**

**Files with this pattern:**
- `backend/src/routes/payments.js` (15+ instances)
- `backend/src/routes/configurable-products.js`
- `backend/src/routes/database-provisioning.js`
- `backend/src/routes/store-provisioning.js`
- `backend/src/routes/store-database.js`
- `backend/src/routes/supabase-setup.js`
- And many more...

### Correct Patterns

#### For Master DB (Store registry, User, Credits, Subscriptions)

```javascript
// Option 1: Use master Supabase client (RECOMMENDED)
const { masterDbClient } = require('../database/masterConnection');
const { data: store, error } = await masterDbClient
  .from('stores')
  .select('*')
  .eq('id', storeId)
  .single();

// Option 2: Use master Sequelize
const masterSequelize = ConnectionManager.getMasterConnection();
// Run raw query or use master models

// Option 3: Use master models directly
const { MasterStore } = require('../models/master');
const store = await MasterStore.findByPk(storeId);
```

#### For Tenant DB (Products, Orders, Customers, etc.)

```javascript
const tenantDb = await ConnectionManager.getStoreConnection(storeId);

const { data: products, error } = await tenantDb
  .from('products')
  .select('*')
  .eq('store_id', storeId);

if (error) throw error;
```

## Key Conversion Requirements

### 1. Master DB Models (Use Master Connection)
- User, MasterUser
- Store (minimal - for platform operations), MasterStore
- Subscription, Credit, CreditTransaction, CreditUsage, ServiceCreditCost
- CustomDomain
- Job, JobHistory, CronJob, CronJobExecution
- StoreDatabase, StoreHostname, CreditBalance

### 2. Tenant DB Models (Use Tenant Connection)
- Product, ProductTranslation, ProductVariant, Category
- Order, OrderItem, Customer
- Cart, Wishlist, CmsPage, CmsBlock
- Attribute, AttributeValue, Tax, ShippingMethod
- IntegrationConfig, SupabaseOAuthToken, ShopifyOAuthToken
- ALL other store-specific models

### 3. Hybrid Operations

Some operations need BOTH connections:

```javascript
// Get store info from master DB
const { masterDbClient } = require('../database/masterConnection');
const { data: store } = await masterDbClient
  .from('stores')
  .select('*')
  .eq('id', storeId)
  .single();

// Get tenant data
const tenantDb = await ConnectionManager.getStoreConnection(storeId);
const { data: products } = await tenantDb
  .from('products')
  .select('*')
  .eq('store_id', storeId);
```

## Files Requiring Immediate Attention

### High Priority Routes (Core Business Logic)

1. **payments.js** - 15+ instances of incorrect Store model usage
   - Lines: 64-66, 184-186, 270-272, 420, 703-705, 1343, 1773, 1911, 2258, 2291, 2476, 2487
   - Issue: Using `getConnection()` then `Store.findByPk()` - should use master DB

2. **configurable-products.js** - Mixed usage
   - Uses tenant models correctly for products
   - May need master DB for store validation

3. **database-provisioning.js** - Core infrastructure
   - Manages store databases
   - Needs careful master/tenant separation

4. **store-provisioning.js** - Store creation
   - Critical for onboarding
   - Must use master DB for store creation

5. **supabase-setup.js** - Database setup
   - Infrastructure critical
   - Needs master DB operations

### Medium Priority Routes

6. **users.js** - User management (master DB)
7. **credits.js**, **creditsMasterTenant.js** - Credit system (master DB)
8. **job-processor.js**, **cron-jobs.js** - Background jobs (master DB)
9. **integrations.js**, **shopify.js**, **amazon.js**, **ebay.js** - Integration management (tenant DB)
10. **plugin-api.js**, **plugin-creation.js** - Plugin system
11. **translations.js** - Translation system (tenant DB)
12. **customer-activity.js**, **heatmap.js** - Analytics (tenant DB)

### Services (Critical)

1. **credit-service.js** - Credit operations (master DB)
2. **supabase-integration.js**, **supabase-setup.js** - Database management
3. **shopify-integration.js**, **shopify-import-service.js** - Shopify sync (tenant DB)
4. **akeneo-*.js** - Akeneo PIM integration (tenant DB)
5. **translation-service.js** - Translation service (tenant DB)
6. **analytics/*.js** - Analytics services (tenant DB)
7. **storage/StorageManager.js** - Media storage (tenant DB)

### Middleware (Important)

1. **usageTracking.js** - Track API usage (master DB for credits)
2. **subscriptionEnforcement.js** - Subscription limits (master DB)
3. **tenantResolver.js**, **domainResolver.js** - Tenant resolution (both DBs)
4. **storeAuth.js**, **auth.js** - Authentication (master DB for users)

## Conversion Strategy

### Phase 1: Fix Critical Mixed Usage (Priority)

Files that incorrectly use `getConnection()` for master data:

1. Identify all `getConnection()` + `Store.findByPk()` patterns
2. Replace with master DB queries
3. Test thoroughly (Stripe integration, payment flows critical)

### Phase 2: Convert Routes (Systematic)

1. Start with already-converted files as templates
2. Convert tenant operations to `getStoreConnection()`
3. Convert master operations to master connection
4. Test each endpoint

### Phase 3: Convert Services

1. Identify data source (master vs tenant)
2. Apply appropriate ConnectionManager method
3. Update error handling

### Phase 4: Convert Middleware

1. Careful testing required (affects all requests)
2. Performance monitoring (middleware runs on every request)

### Phase 5: Handle Migrations and Seeds

1. Many may be deprecated
2. Some need to stay for legacy support
3. Mark clearly which are still active

## Testing Requirements

For each converted file:

1. ✅ Unit test critical functions
2. ✅ Integration test API endpoints
3. ✅ Test with multiple stores
4. ✅ Test error cases
5. ✅ Performance test (connection caching)
6. ✅ Test master/tenant isolation

## Risks and Mitigation

### Risk 1: Data Leakage Between Tenants
**Mitigation:** Always include `store_id` in tenant queries, validate store access

### Risk 2: Performance Degradation
**Mitigation:** ConnectionManager caches connections, batch queries where possible

### Risk 3: Breaking Existing Functionality
**Mitigation:** Comprehensive testing, gradual rollout, feature flags

### Risk 4: Stripe/Payment Issues
**Mitigation:** Extra careful with payments.js, test in sandbox first

### Risk 5: Mixed Master/Tenant Data
**Mitigation:** Clear documentation, code reviews, explicit connection usage

## Automated Conversion Opportunities

Some patterns can be automated with find/replace:

### Pattern 1: Simple FindByPk (Tenant)
```javascript
// Before
const { Product } = require('../models');
const product = await Product.findByPk(productId);

// After (requires store_id in context)
const tenantDb = await ConnectionManager.getStoreConnection(store_id);
const { data: product } = await tenantDb
  .from('products')
  .select('*')
  .eq('id', productId)
  .single();
```

### Pattern 2: FindAll with Where (Tenant)
```javascript
// Before
const products = await Product.findAll({ where: { store_id: storeId } });

// After
const tenantDb = await ConnectionManager.getStoreConnection(storeId);
const { data: products } = await tenantDb
  .from('products')
  .select('*')
  .eq('store_id', storeId);
```

### Pattern 3: Store Lookup (Master)
```javascript
// Before
const connection = await ConnectionManager.getConnection(store_id);
const { Store } = connection.models;
const store = await Store.findByPk(store_id);

// After
const { masterDbClient } = require('../database/masterConnection');
const { data: store } = await masterDbClient
  .from('stores')
  .select('*')
  .eq('id', store_id)
  .single();
```

## Recommended Approach

Given the scale (100+ files), I recommend:

### Option A: Systematic File-by-File (Current Approach)
- **Pros:** Thorough, controlled, testable
- **Cons:** Time-consuming, may take days/weeks
- **Best for:** Production systems, critical applications

### Option B: Automated with Manual Review
- **Pros:** Faster, consistent patterns
- **Cons:** Risk of missed edge cases, requires extensive testing
- **Best for:** Non-production, with good test coverage

### Option C: Hybrid Approach (RECOMMENDED)
1. **Automate simple patterns** (simple findAll, findByPk)
2. **Manually convert complex files** (payments, provisioning, integrations)
3. **Create helper functions** for common operations
4. **Incremental deployment** with feature flags

## Next Immediate Steps

1. ✅ **Fix payments.js** - Critical for revenue
2. ✅ **Fix store-provisioning.js** - Critical for onboarding
3. ✅ **Fix supabase-setup.js** - Infrastructure
4. ✅ **Create helper utilities** for common patterns
5. ✅ **Write comprehensive tests** for converted files
6. ✅ **Deploy to staging** for integration testing
7. ✅ **Monitor performance and errors**
8. ✅ **Gradual production rollout**

## Helper Functions to Create

```javascript
// backend/src/utils/dbHelpers.js

/**
 * Get store from master DB
 */
async function getMasterStore(storeId) {
  const { masterDbClient } = require('../database/masterConnection');
  const { data: store, error } = await masterDbClient
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();
  if (error) throw new Error(`Store not found: ${error.message}`);
  return store;
}

/**
 * Get user from master DB
 */
async function getMasterUser(userId) {
  const { masterDbClient } = require('../database/masterConnection');
  const { data: user, error } = await masterDbClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`User not found: ${error.message}`);
  return user;
}

/**
 * Get products from tenant DB
 */
async function getTenantProducts(storeId, filters = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  let query = tenantDb.from('products').select('*').eq('store_id', storeId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category_id) query = query.contains('category_ids', [filters.category_id]);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

module.exports = { getMasterStore, getMasterUser, getTenantProducts };
```

## Conclusion

This is a **large-scale refactoring** affecting 100+ files. The most critical issue is the mixed master/tenant usage in files like `payments.js`.

**Recommended priority order:**
1. Fix payments.js (revenue critical)
2. Fix store provisioning files (onboarding critical)
3. Convert remaining routes systematically
4. Convert services
5. Convert middleware
6. Handle migrations

**Estimated effort:**
- With systematic approach: 2-3 days for routes, 1-2 days for services, 1 day for middleware
- Total: ~5-7 days for complete conversion
- Additional 2-3 days for comprehensive testing

**Current progress:** ~2% complete (2 files fully converted out of 100+)

---

**Files Modified in This Session:**
1. `backend/src/routes/orders.js` - Fixed diagnostic endpoints
2. `SEQUELIZE_TO_CONNECTIONMANAGER_MIGRATION.md` - Created comprehensive guide
3. `CONVERSION_SUMMARY.md` - This summary document
