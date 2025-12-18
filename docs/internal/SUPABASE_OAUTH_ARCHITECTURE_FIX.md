# Supabase OAuth Architecture Fix

## Problem Identified

Currently, Supabase OAuth tokens are stored in the **MASTER database** via the `SupabaseOAuthToken` Sequelize model, which violates the tenant isolation principle.

### Current (WRONG) Architecture:
```
Master DB:
  - supabase_oauth_tokens table (Sequelize model)
    - access_token
    - refresh_token
    - project_url
    - service_role_key
    - etc.

Tenant DB:
  - integration_configs table
    - config_data JSONB (minimal metadata)
```

### Issues:
1. ❌ Master DB is queried for tenant-specific data
2. ❌ OAuth tokens are not tenant-isolated
3. ❌ Uses deprecated Sequelize model
4. ❌ Violates master-tenant architecture
5. ❌ `SupabaseOAuthToken.findByStore()` queries wrong database

## Correct Architecture

### All OAuth data should be in TENANT database:

```
Tenant DB Only:
  - integration_configs table
    - integration_type: 'supabase'
    - config_data: {
        access_token (encrypted)
        refresh_token (encrypted)
        expires_at
        project_url
        service_role_key (encrypted)
        database_url
        storage_url
        auth_url
        userEmail
        connected: true
      }
```

## Migration Steps

### Step 1: Update `exchangeCodeForToken()` to save to tenant DB

**File:** `backend/src/services/supabase-integration.js`

```javascript
// REMOVE: SupabaseOAuthToken.createOrUpdate()
// ADD: Save to integration_configs in tenant DB

const tenantDb = await ConnectionManager.getStoreConnection(storeId);

await tenantDb
  .from('integration_configs')
  .insert({
    id: uuidv4(),
    store_id: storeId,
    integration_type: 'supabase',
    is_active: true,
    config_data: {
      access_token: encrypt(access_token),
      refresh_token: encrypt(refresh_token),
      expires_at: expiresAt,
      project_url: projectData.project_url,
      service_role_key: encrypt(projectData.service_role_key),
      database_url: projectData.database_url,
      storage_url: projectData.storage_url,
      auth_url: projectData.auth_url,
      userEmail: user?.email,
      connected: true,
      connectedAt: new Date()
    },
    connection_status: 'success',
    created_at: new Date(),
    updated_at: new Date()
  })
  .onConflict(['store_id', 'integration_type'])
  .merge();
```

### Step 2: Replace all `SupabaseOAuthToken.findByStore()` calls

**Replace:**
```javascript
const token = await SupabaseOAuthToken.findByStore(storeId);
```

**With:**
```javascript
const tenantDb = await ConnectionManager.getStoreConnection(storeId);
const { data: integration } = await tenantDb
  .from('integration_configs')
  .select('*')
  .eq('store_id', storeId)
  .eq('integration_type', 'supabase')
  .eq('is_active', true)
  .maybeSingle();

if (!integration) {
  return null;
}

// Decrypt tokens
const token = {
  access_token: decrypt(integration.config_data.access_token),
  refresh_token: decrypt(integration.config_data.refresh_token),
  expires_at: integration.config_data.expires_at,
  project_url: integration.config_data.project_url,
  service_role_key: decrypt(integration.config_data.service_role_key),
  // ... other fields
};
```

### Step 3: Update all methods

Methods to update in `supabase-integration.js`:
- ✅ `exchangeCodeForToken()` - Save to tenant DB
- ✅ `refreshAccessToken()` - Query/update tenant DB
- ✅ `getValidToken()` - Query tenant DB
- ✅ `getSupabaseClient()` - Get keys from tenant DB
- ✅ `getSupabaseAdminClient()` - Get keys from tenant DB
- ✅ `testConnection()` - Query tenant DB
- ✅ `disconnect()` - Delete from tenant DB
- ✅ `getProjects()` - Query tenant DB
- ✅ `selectProject()` - Update tenant DB
- ✅ `getConnectionStatus()` - Query tenant DB only

### Step 4: Create Helper Functions

```javascript
/**
 * Get Supabase integration config from tenant DB
 */
async function getSupabaseConfig(storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { data: integration } = await tenantDb
    .from('integration_configs')
    .select('*')
    .eq('store_id', storeId)
    .eq('integration_type', 'supabase')
    .eq('is_active', true)
    .maybeSingle();

  if (!integration) {
    return null;
  }

  // Decrypt sensitive fields
  return {
    id: integration.id,
    access_token: decrypt(integration.config_data.access_token),
    refresh_token: decrypt(integration.config_data.refresh_token),
    expires_at: new Date(integration.config_data.expires_at),
    project_url: integration.config_data.project_url,
    service_role_key: integration.config_data.service_role_key
      ? decrypt(integration.config_data.service_role_key)
      : null,
    database_url: integration.config_data.database_url,
    storage_url: integration.config_data.storage_url,
    auth_url: integration.config_data.auth_url,
    userEmail: integration.config_data.userEmail,
    connected: integration.config_data.connected !== false,
    config: integration
  };
}

/**
 * Update Supabase config in tenant DB
 */
async function updateSupabaseConfig(storeId, updates) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Encrypt sensitive fields before saving
  const encryptedUpdates = { ...updates };
  if (updates.access_token) {
    encryptedUpdates.access_token = encrypt(updates.access_token);
  }
  if (updates.refresh_token) {
    encryptedUpdates.refresh_token = encrypt(updates.refresh_token);
  }
  if (updates.service_role_key) {
    encryptedUpdates.service_role_key = encrypt(updates.service_role_key);
  }

  const { data: existing } = await tenantDb
    .from('integration_configs')
    .select('config_data')
    .eq('store_id', storeId)
    .eq('integration_type', 'supabase')
    .eq('is_active', true)
    .maybeSingle();

  const updatedConfigData = {
    ...existing?.config_data,
    ...encryptedUpdates
  };

  await tenantDb
    .from('integration_configs')
    .update({
      config_data: updatedConfigData,
      updated_at: new Date()
    })
    .eq('store_id', storeId)
    .eq('integration_type', 'supabase');
}
```

### Step 5: Remove Deprecated Code

**Delete:**
- `backend/src/models/SupabaseOAuthToken.js`
- Any references to `SupabaseOAuthToken` model
- `supabase_oauth_tokens` table from master DB schema

### Step 6: Add Encryption Utilities

Use existing encryption from `backend/src/utils/encryption.js`:
```javascript
const { encrypt, decrypt } = require('../utils/encryption');
```

## Benefits of This Fix

1. ✅ **Tenant Isolation** - Each tenant's OAuth tokens in their own DB
2. ✅ **No Master DB Queries** - All queries go to tenant DB only
3. ✅ **Consistent Architecture** - Follows master-tenant pattern
4. ✅ **Single Source of Truth** - `integration_configs` has everything
5. ✅ **Simpler Code** - No Sequelize model, direct DB queries
6. ✅ **Better Security** - Encrypted at rest in tenant DB

## Testing Plan

1. Test OAuth connection flow
2. Test token refresh
3. Test connection status check
4. Test project selection
5. Test media storage upload
6. Verify no master DB queries for tenant data

## Rollout

1. Implement changes in development
2. Test thoroughly
3. Create migration script to move existing tokens
4. Deploy to production
5. Verify all stores still connected
6. Remove deprecated code

## Migration Script for Existing Tokens

```javascript
// migrate-oauth-to-tenant.js
const {masterSequelize} = require('./masterConnection');
const ConnectionManager = require('./ConnectionManager');
const {encrypt} = require('./encryption');

async function migrateOAuthTokens() {
    // Get all OAuth tokens from master DB
    const [tokens] = await masterSequelize.query(
        'SELECT * FROM supabase_oauth_tokens'
    );

    for (const token of tokens) {
        try {
            const tenantDb = await ConnectionManager.getStoreConnection(token.store_id);

            // Insert into integration_configs
            await tenantDb
                .from('integration_configs')
                .insert({
                    store_id: token.store_id,
                    integration_type: 'supabase',
                    is_active: true,
                    config_data: {
                        access_token: encrypt(token.access_token),
                        refresh_token: encrypt(token.refresh_token),
                        expires_at: token.expires_at,
                        project_url: token.project_url,
                        service_role_key: token.service_role_key
                            ? encrypt(token.service_role_key)
                            : null,
                        connected: true,
                        migratedFrom: 'master_db',
                        migratedAt: new Date()
                    },
                    connection_status: 'success',
                    created_at: token.created_at || new Date(),
                    updated_at: new Date()
                })
                .onConflict(['store_id', 'integration_type'])
                .merge();

            console.log(`✅ Migrated OAuth token for store ${token.store_id}`);
        } catch (error) {
            console.error(`❌ Failed to migrate store ${token.store_id}:`, error.message);
        }
    }

    console.log('Migration complete!');
}

migrateOAuthTokens().catch(console.error);
```

## Next Steps

1. ✅ Review this migration plan
2. ⏳ Implement helper functions
3. ⏳ Update all methods to use tenant DB
4. ⏳ Test in development
5. ⏳ Run migration script
6. ⏳ Deploy to production
7. ⏳ Clean up deprecated code
