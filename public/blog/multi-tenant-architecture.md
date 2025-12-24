# Multi-Tenant Architecture Explained

Understand how DainoStore isolates stores, scales efficiently, and maintains security across tenants.

---

## Overview

Multi-tenancy allows:
- Multiple stores on shared infrastructure
- Complete data isolation
- Independent configuration
- Efficient resource usage
- Easy scaling

---

## What Is Multi-Tenancy?

### Single-Tenant vs Multi-Tenant

**Single-Tenant**:
```
Store A -> Server A -> Database A
Store B -> Server B -> Database B
Store C -> Server C -> Database C
```

**Multi-Tenant**:
```
Store A -\
Store B --> Shared Server --> Separate Databases
Store C -/
```

### Benefits

| Benefit | Description |
|---------|-------------|
| Cost efficient | Shared resources |
| Easy updates | One codebase |
| Scalable | Add stores easily |
| Maintainable | Single deployment |

---

## Tenant Identification

### How Tenants Are Identified

Every request includes tenant context:

```javascript
// Via subdomain
store1.dainostore.com -> Store 1
store2.dainostore.com -> Store 2

// Via custom domain
mystore.com -> Store 1
anothershop.com -> Store 2

// Via header
X-Store-ID: store_123
```

### Request Flow

```
Request
    |
    v
[Load Balancer]
    |
    v
[Identify Tenant]
    |
    v
[Get Tenant Config]
    |
    v
[Route to Database]
    |
    v
[Process Request]
```

---

## Data Isolation

### Database Per Tenant

Each store gets its own database:

```
Store A -> database_store_a
Store B -> database_store_b
Store C -> database_store_c
```

### Benefits

| Benefit | Description |
|---------|-------------|
| Complete isolation | No data leakage |
| Independent backup | Per-store backups |
| Custom scaling | Scale as needed |
| Compliance | Data residency |

### Connection Management

```javascript
class ConnectionManager {
  async getConnection(storeId) {
    // Check pool
    if (this.pool[storeId]) {
      return this.pool[storeId];
    }

    // Get credentials
    const config = await this.getStoreConfig(storeId);

    // Create connection
    const connection = await createConnection(config);

    // Store in pool
    this.pool[storeId] = connection;

    return connection;
  }
}
```

---

## Application Layer

### Shared Codebase

All tenants run the same code:

```
/app
  /api        <- Shared API code
  /frontend   <- Shared UI code
  /services   <- Shared business logic
  /tenants    <- Tenant configs only
```

### Tenant Context

Every operation includes context:

```javascript
class TenantContext {
  constructor(storeId) {
    this.storeId = storeId;
    this.db = getConnection(storeId);
    this.config = getConfig(storeId);
  }

  async getProducts() {
    return this.db.query('SELECT * FROM products');
  }
}
```

### Middleware

Extract tenant from request:

```javascript
async function tenantMiddleware(req, res, next) {
  // From subdomain
  const subdomain = req.hostname.split('.')[0];

  // Or from custom domain
  const storeId = await lookupDomain(req.hostname);

  // Or from header
  const headerStoreId = req.headers['x-store-id'];

  req.tenant = new TenantContext(storeId);
  next();
}
```

---

## Storage Isolation

### File Storage

Each tenant has isolated storage:

```
/storage
  /store_123
    /products
    /media
    /documents
  /store_456
    /products
    /media
    /documents
```

### Access Control

```javascript
function getStoragePath(tenantId, path) {
  // Always prefix with tenant
  return `/storage/${tenantId}/${path}`;
}

function validateAccess(tenantId, requestedPath) {
  // Ensure path stays within tenant directory
  const resolved = path.resolve(requestedPath);
  const tenantRoot = `/storage/${tenantId}`;

  return resolved.startsWith(tenantRoot);
}
```

---

## Configuration Management

### Tenant Configuration

Each store has its own config:

```javascript
{
  "storeId": "store_123",
  "name": "My Store",
  "domain": "mystore.com",
  "settings": {
    "currency": "USD",
    "timezone": "America/New_York",
    "features": {
      "multiCurrency": true,
      "advancedReports": false
    }
  },
  "database": {
    "host": "db-123.cluster.com",
    "name": "store_123"
  }
}
```

### Feature Flags

Enable features per tenant:

```javascript
function hasFeature(tenantId, feature) {
  const config = getConfig(tenantId);
  return config.features[feature] === true;
}

// Usage
if (hasFeature('store_123', 'advancedReports')) {
  showAdvancedReports();
}
```

---

## Scaling Architecture

### Horizontal Scaling

Add more application servers:

```
[Load Balancer]
      |
  +---+---+---+
  |   |   |   |
[App1][App2][App3][App4]
      |
      v
[Database Pool]
```

### Database Scaling

Scale databases independently:

| Store Size | Database |
|------------|----------|
| Small | Shared pool |
| Medium | Dedicated instance |
| Large | Dedicated cluster |
| Enterprise | Custom infrastructure |

### Caching

Multi-level caching:

```
Request
    |
    v
[Edge Cache] <- Static assets
    |
    v
[Application Cache] <- Session, config
    |
    v
[Database Cache] <- Query results
```

---

## Security Model

### Tenant Isolation

Security boundaries:

| Layer | Isolation |
|-------|-----------|
| Network | Separate VPCs optional |
| Database | Separate databases |
| Storage | Separate directories |
| Memory | Process isolation |
| Logging | Tagged by tenant |

### Access Control

```javascript
function authorize(user, resource, action) {
  // Verify user belongs to tenant
  if (user.tenantId !== resource.tenantId) {
    throw new ForbiddenError('Cross-tenant access denied');
  }

  // Check permissions
  if (!user.hasPermission(action)) {
    throw new ForbiddenError('Permission denied');
  }

  return true;
}
```

### Audit Logging

All actions logged with tenant:

```javascript
{
  "timestamp": "2024-01-15T10:30:00Z",
  "tenantId": "store_123",
  "userId": "user_456",
  "action": "product.update",
  "resourceId": "prod_789",
  "changes": {...}
}
```

---

## Provisioning

### Store Creation

Automated provisioning:

```javascript
async function provisionStore(config) {
  // 1. Create database
  const database = await createDatabase(config.name);

  // 2. Run migrations
  await runMigrations(database);

  // 3. Create admin user
  await createAdminUser(database, config.admin);

  // 4. Configure DNS
  await setupDomain(config.domain);

  // 5. Initialize settings
  await initializeSettings(database, config.settings);

  return { storeId: database.id };
}
```

### Migration Flow

```
Request New Store
    |
    v
[Validate Request]
    |
    v
[Provision Database]
    |
    v
[Run Schema Migrations]
    |
    v
[Create Admin User]
    |
    v
[Configure Domain]
    |
    v
[Initialize Store]
    |
    v
Store Ready!
```

---

## Performance Optimization

### Query Optimization

Always scope by tenant:

```sql
-- Good: Tenant-scoped query
SELECT * FROM products
WHERE store_id = 'store_123'
AND status = 'active';

-- Bad: Cross-tenant query risk
SELECT * FROM products
WHERE status = 'active';
```

### Connection Pooling

Efficient pool management:

```javascript
const pools = new Map();

function getPool(storeId) {
  if (!pools.has(storeId)) {
    pools.set(storeId, createPool({
      min: 2,
      max: 10,
      database: `db_${storeId}`
    }));
  }
  return pools.get(storeId);
}
```

### Resource Limits

Per-tenant limits:

| Resource | Limit |
|----------|-------|
| API requests | 1000/min |
| Storage | 10GB |
| Database connections | 20 |
| Background jobs | 5 concurrent |

---

## Monitoring

### Per-Tenant Metrics

Track metrics by tenant:

```javascript
metrics.increment('api.requests', {
  tenant: storeId,
  endpoint: path,
  status: response.status
});

metrics.histogram('api.latency', duration, {
  tenant: storeId,
  endpoint: path
});
```

### Dashboards

View by tenant:
- Request volume
- Error rates
- Resource usage
- Performance metrics

### Alerting

Tenant-specific alerts:
- High error rate
- Resource limits approaching
- Unusual activity
- Performance degradation

---

## Disaster Recovery

### Backup Strategy

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full backup | Daily | 30 days |
| Incremental | Hourly | 7 days |
| Transaction logs | Continuous | 7 days |

### Recovery Options

```javascript
async function recoverTenant(storeId, pointInTime) {
  // Stop traffic
  await disableStore(storeId);

  // Restore database
  await restoreDatabase(storeId, pointInTime);

  // Verify integrity
  await verifyData(storeId);

  // Resume traffic
  await enableStore(storeId);
}
```

---

## Best Practices

### Development

1. **Always include tenant context** - Never query without scope
2. **Test isolation** - Verify no cross-tenant access
3. **Use connection pooling** - Efficient resource use
4. **Log with tenant ID** - Easy debugging
5. **Feature flags per tenant** - Controlled rollouts

### Operations

1. **Monitor per tenant** - Individual health
2. **Set resource limits** - Prevent abuse
3. **Automate provisioning** - Consistent setup
4. **Regular backups** - Per-tenant recovery
5. **Security audits** - Verify isolation

### Security

1. **Validate tenant on every request** - No shortcuts
2. **Scope all queries** - Database isolation
3. **Separate credentials** - Per-tenant access
4. **Encrypt at rest** - Data protection
5. **Audit logging** - Track all actions

---

## Common Questions

**Q: Can tenants share data?**
A: By design, no. Each tenant is completely isolated.

**Q: What happens if one tenant has issues?**
A: Other tenants are unaffected due to isolation.

**Q: How do updates work?**
A: Updates deployed once, all tenants updated.

**Q: Can tenants have custom code?**
A: Yes, through plugins with isolated scope.

---

## Next Steps

After understanding architecture:

1. **Review security** - Verify isolation
2. **Set up monitoring** - Per-tenant metrics
3. **Plan scaling** - Growth strategy
4. **Document procedures** - Operations guide
5. **Test recovery** - Disaster preparedness

See our Shopify Migration guide for importing store data.
