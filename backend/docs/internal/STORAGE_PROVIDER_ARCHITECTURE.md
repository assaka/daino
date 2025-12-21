# Storage Provider Architecture

## Overview
Separate database and media storage integrations to allow independent configuration and provider selection.

## Current Architecture Issues
- Supabase is treated as a single monolithic integration
- Can't use Supabase DB with Google Cloud Storage
- Can't use different providers for different purposes
- Tight coupling between database and storage concerns

## Proposed Architecture

### 1. Database Integrations (Independent)
```
integrations/database/
├── supabase-database
├── postgresql
├── mysql
└── mongodb
```

Each database integration manages:
- Connection credentials
- Schema management
- Data operations
- Migration support

### 2. Storage Integrations (Independent)
```
integrations/storage/
├── supabase-storage
├── google-cloud-storage
├── aws-s3
├── cloudflare-r2
├── azure-blob
└── local-filesystem
```

Each storage integration manages:
- File uploads
- File retrieval
- Bucket/container management
- CDN configuration

## Implementation Plan

### Phase 1: Update Integration Types

**IntegrationConfig.js** - Add new types:
```javascript
integration_type: {
  type: DataTypes.STRING(50),
  allowNull: false,
  validate: {
    isIn: [[
      // Existing
      'akeneo', 'magento', 'shopify', 'woocommerce',

      // New - Database Integrations
      'supabase-database',
      'postgresql',
      'mysql',

      // New - Storage Integrations
      'supabase-storage',
      'google-cloud-storage',
      'aws-s3',
      'cloudflare-r2',
      'local-storage'
    ]]
  }
}
```

### Phase 2: Create Storage Provider Abstraction

**backend/src/services/storage/StorageProvider.js** (Base Class):
```javascript
class StorageProvider {
  constructor(config) {
    this.config = config;
  }

  // Abstract methods all providers must implement
  async upload(file, path, options) { throw new Error('Not implemented'); }
  async delete(path) { throw new Error('Not implemented'); }
  async getSignedUrl(path, expiresIn) { throw new Error('Not implemented'); }
  async listFiles(prefix, options) { throw new Error('Not implemented'); }
  async exists(path) { throw new Error('Not implemented'); }
  async copy(fromPath, toPath) { throw new Error('Not implemented'); }
  async move(fromPath, toPath) { throw new Error('Not implemented'); }

  // Optional methods with default implementations
  async getStats() {
    return { totalFiles: 0, totalSize: 0 };
  }
}
```

### Phase 3: Implement Provider-Specific Classes

**backend/src/services/storage/providers/SupabaseStorageProvider.js**:
```javascript
const StorageProvider = require('../StorageProvider');

class SupabaseStorageProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.supabaseClient = createClient(
      config.projectUrl,
      config.serviceRoleKey
    );
  }

  async upload(file, path, options = {}) {
    const { data, error } = await this.supabaseClient
      .storage
      .from(options.bucket || 'suprshop-assets')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: options.upsert || false
      });

    if (error) throw error;
    return data;
  }

  // ... implement other methods
}
```

**backend/src/services/storage/providers/GoogleCloudStorageProvider.js**:
```javascript
const StorageProvider = require('../StorageProvider');
const { Storage } = require('@google-cloud/storage');

class GoogleCloudStorageProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.storage = new Storage({
      projectId: config.projectId,
      credentials: config.credentials
    });
    this.bucket = this.storage.bucket(config.bucketName);
  }

  async upload(file, path, options = {}) {
    const blob = this.bucket.file(path);
    await blob.save(file.buffer, {
      contentType: file.mimetype,
      metadata: options.metadata || {}
    });

    return {
      path,
      url: blob.publicUrl()
    };
  }

  // ... implement other methods
}
```

### Phase 4: Storage Manager (Factory)

**backend/src/services/storage/StorageManager.js**:
```javascript
const SupabaseStorageProvider = require('./providers/SupabaseStorageProvider');
const GoogleCloudStorageProvider = require('./providers/GoogleCloudStorageProvider');
const AwsS3StorageProvider = require('./providers/AwsS3StorageProvider');
const { IntegrationConfig } = require('../../models');

class StorageManager {
  static async getProvider(storeId) {
    // Check which storage integration is active for this store
    const storageConfig = await IntegrationConfig.findOne({
      where: {
        store_id: storeId,
        integration_type: {
          [Op.in]: [
            'supabase-storage',
            'google-cloud-storage',
            'aws-s3',
            'cloudflare-r2'
          ]
        },
        is_active: true
      }
    });

    if (!storageConfig) {
      throw new Error('No storage provider configured for this store');
    }

    // Factory pattern - instantiate the appropriate provider
    switch (storageConfig.integration_type) {
      case 'supabase-storage':
        return new SupabaseStorageProvider(storageConfig.config_data);

      case 'google-cloud-storage':
        return new GoogleCloudStorageProvider(storageConfig.config_data);

      case 'aws-s3':
        return new AwsS3StorageProvider(storageConfig.config_data);

      default:
        throw new Error(`Unknown storage provider: ${storageConfig.integration_type}`);
    }
  }

  static async upload(storeId, file, path, options) {
    const provider = await this.getProvider(storeId);
    return await provider.upload(file, path, options);
  }

  static async delete(storeId, path) {
    const provider = await this.getProvider(storeId);
    return await provider.delete(path);
  }

  // ... proxy other methods
}

module.exports = StorageManager;
```

### Phase 5: Update Routes to Use Storage Manager

**backend/src/routes/images.js**:
```javascript
const StorageManager = require('../services/storage/StorageManager');

router.post('/upload', authMiddleware, storeResolver(), upload.single('image'), async (req, res) => {
  try {
    // StorageManager automatically detects and uses the configured provider
    const result = await StorageManager.upload(
      req.storeId,
      req.file,
      `products/${req.file.originalname}`,
      { public: true }
    );

    res.json({
      success: true,
      url: result.url,
      path: result.path
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

### Phase 6: UI Components

**src/components/admin/integrations/DatabaseIntegrations.jsx**:
```jsx
<div className="integrations-grid">
  <IntegrationCard
    title="Supabase Database"
    description="PostgreSQL database hosted on Supabase"
    integrationType="supabase-database"
    icon={Database}
  />

  <IntegrationCard
    title="PostgreSQL"
    description="Custom PostgreSQL database connection"
    integrationType="postgresql"
    icon={Database}
  />
</div>
```

**src/components/admin/integrations/StorageIntegrations.jsx**:
```jsx
<div className="integrations-grid">
  <IntegrationCard
    title="Supabase Storage"
    description="Object storage from Supabase"
    integrationType="supabase-storage"
    icon={HardDrive}
  />

  <IntegrationCard
    title="Google Cloud Storage"
    description="Scalable storage from Google Cloud"
    integrationType="google-cloud-storage"
    icon={Cloud}
  />

  <IntegrationCard
    title="AWS S3"
    description="Amazon S3 object storage"
    integrationType="aws-s3"
    icon={Cloud}
  />

  <IntegrationCard
    title="Cloudflare R2"
    description="Zero egress fee storage"
    integrationType="cloudflare-r2"
    icon={Cloud}
  />
</div>
```

## Migration Strategy

### Option 1: Automatic Migration (Recommended)
```javascript
// Migration: backend/src/database/migrations/split-supabase-integration.js
async function up() {
  // Find all existing 'supabase' integrations
  const supabaseConfigs = await IntegrationConfig.findAll({
    where: { integration_type: 'supabase' }
  });

  for (const config of supabaseConfigs) {
    // Create database integration
    await IntegrationConfig.create({
      store_id: config.store_id,
      integration_type: 'supabase-database',
      config_data: {
        projectUrl: config.config_data.projectUrl,
        connected: config.config_data.connected,
        // ... database-specific fields
      },
      is_active: config.is_active
    });

    // Create storage integration
    await IntegrationConfig.create({
      store_id: config.store_id,
      integration_type: 'supabase-storage',
      config_data: {
        projectUrl: config.config_data.projectUrl,
        serviceRoleKey: config.config_data.serviceRoleKey,
        // ... storage-specific fields
      },
      is_active: config.is_active
    });

    // Mark old integration as inactive (don't delete for rollback)
    await config.update({ is_active: false });
  }
}
```

### Option 2: Gradual Migration
- Keep 'supabase' type working
- Add new 'supabase-database' and 'supabase-storage' types
- Let users manually migrate
- Deprecate 'supabase' after 3 months

## Benefits

### 1. **Flexibility**
- Use Supabase DB with Google Cloud Storage
- Use PostgreSQL with AWS S3
- Mix and match as needed

### 2. **Cost Optimization**
- Choose cheapest storage provider
- Use Cloudflare R2 for zero egress fees
- Keep database where your app is hosted

### 3. **Vendor Independence**
- Not locked into one provider
- Easy to switch providers
- A/B test different providers

### 4. **Better Organization**
- Clear separation of concerns
- Easier to debug issues
- Independent configuration

### 5. **Scalability**
- Database and storage scale independently
- Can use different regions
- Optimize each service separately

## Configuration Examples

### Example 1: Supabase Everything
```json
{
  "database": {
    "type": "supabase-database",
    "projectUrl": "https://xyz.supabase.co",
    "serviceRoleKey": "..."
  },
  "storage": {
    "type": "supabase-storage",
    "projectUrl": "https://xyz.supabase.co",
    "serviceRoleKey": "..."
  }
}
```

### Example 2: Supabase DB + Google Storage
```json
{
  "database": {
    "type": "supabase-database",
    "projectUrl": "https://xyz.supabase.co",
    "serviceRoleKey": "..."
  },
  "storage": {
    "type": "google-cloud-storage",
    "projectId": "my-project",
    "bucketName": "my-bucket",
    "credentials": {...}
  }
}
```

### Example 3: PostgreSQL + AWS S3
```json
{
  "database": {
    "type": "postgresql",
    "host": "db.example.com",
    "port": 5432,
    "database": "mystore",
    "username": "dbuser",
    "password": "..."
  },
  "storage": {
    "type": "aws-s3",
    "region": "us-east-1",
    "bucket": "my-store-assets",
    "accessKeyId": "...",
    "secretAccessKey": "..."
  }
}
```

## Next Steps

1. **Phase 1**: Update IntegrationConfig model ✅
2. **Phase 2**: Create StorageProvider base class ✅
3. **Phase 3**: Implement Supabase provider ✅
4. **Phase 4**: Implement Google Cloud provider
5. **Phase 5**: Create StorageManager factory
6. **Phase 6**: Update all routes to use StorageManager
7. **Phase 7**: Create UI components for each provider
8. **Phase 8**: Run migration script
9. **Phase 9**: Update documentation
10. **Phase 10**: Deprecate old 'supabase' type

## Timeline
- Week 1: Phases 1-3 (Foundation)
- Week 2: Phases 4-5 (Managers & Providers)
- Week 3: Phases 6-7 (Routes & UI)
- Week 4: Phases 8-10 (Migration & Docs)
