# Subscription Enforcement & Custom Domain Management

## Overview

This document explains two critical platform features:
1. **Subscription Enforcement** - How stores are secured when credits/subscriptions expire
2. **Custom Domain Management** - How to add custom DNS domains for stores

---

## Part 1: Subscription & Credit Enforcement

### How Store Access is Controlled

The platform implements **4 access levels** based on subscription status:

| Access Level | Description | What's Allowed |
|-------------|-------------|----------------|
| **FULL** | Active subscription with available quota | All operations |
| **READ_ONLY** | Limits exceeded or approaching expiration | Only GET requests, no modifications |
| **SUSPENDED** | Payment overdue or no subscription | Only billing/subscription management |
| **TERMINATED** | Store closed by admin | No access, contact support required |

### Automatic Enforcement

The system automatically enforces limits via middleware:

```javascript
// backend/src/middleware/subscriptionEnforcement.js

// Applied to all store routes
app.use('/api', requireActiveSubscription);

// Enforces read-only mode
app.use('/api', enforceReadOnly);

// Checks specific limits before creation
router.post('/products', checkResourceLimit('product'), createProduct);
router.post('/orders', checkResourceLimit('order'), createOrder);
router.post('/media', checkResourceLimit('storage'), uploadMedia);
```

### What Happens When Limits Are Reached?

#### 1. **No Active Subscription**
```json
{
  "success": false,
  "access_denied": true,
  "access_level": "suspended",
  "reason": "No active subscription - please subscribe to a plan",
  "actions": {
    "view_subscription": "/admin/subscription",
    "upgrade_plan": "/admin/subscription/upgrade"
  }
}
```
**Store is suspended** - Only billing pages accessible

#### 2. **Trial Expired**
```json
{
  "success": false,
  "access_level": "suspended",
  "reason": "Trial period expired - please upgrade to a paid plan",
  "actions": {
    "upgrade_plan": "/admin/subscription/upgrade"
  }
}
```

#### 3. **API Limit Exceeded**
```json
{
  "success": false,
  "access_level": "read_only",
  "reason": "API call limit exceeded (10,250/10,000)",
  "upgrade_required": true,
  "actions": {
    "upgrade_plan": "/admin/subscription/upgrade"
  }
}
```
**Store enters READ-ONLY mode** - Can view data but not modify

#### 4. **Product Limit Reached**
When trying to create a product:
```json
{
  "success": false,
  "limit_exceeded": true,
  "resource": "products",
  "current": 100,
  "limit": 100,
  "message": "Product limit reached. Upgrade to create more products.",
  "upgrade_url": "/admin/subscription/upgrade"
}
```

#### 5. **Payment Overdue (Grace Period)**
```json
{
  "success": false,
  "access_level": "read_only",
  "reason": "Payment overdue (3 days) - update payment to restore access"
}
```
- **Days 1-7:** READ-ONLY mode with warning
- **Day 8+:** SUSPENDED until payment updated

### Subscription Plans & Limits

Plans are stored in the `subscriptions` table:

```sql
SELECT
  plan_name,
  max_products,
  max_orders_per_month,
  max_storage_gb,
  max_api_calls_per_month,
  price_monthly
FROM subscriptions
WHERE store_id = 'your-store-id'
  AND status IN ('active', 'trial');
```

#### Example Plans:

| Plan | Products | Orders/mo | Storage | API Calls/mo | Price |
|------|----------|-----------|---------|--------------|-------|
| Free | 10 | 100 | 1 GB | 1,000 | $0 |
| Starter | 100 | 1,000 | 10 GB | 10,000 | $29.99 |
| Professional | 1,000 | 10,000 | 50 GB | 100,000 | $99.99 |
| Enterprise | Unlimited | Unlimited | 200 GB | Unlimited | $299.99 |

*Unlimited = -1 in database (no limit enforced)*

### Usage Tracking

Real-time usage is tracked automatically:

```javascript
// Middleware tracks every API call
app.use(apiLogger);
app.use(trackApiCall);

// Usage is aggregated daily in usage_metrics table
SELECT
  metric_date,
  api_calls,
  products_created,
  orders_created,
  storage_total_bytes
FROM usage_metrics
WHERE store_id = 'your-store-id'
  AND metric_date >= '2025-10-01'
ORDER BY metric_date DESC;
```

### Bypassing Enforcement (Admin Override)

Platform admins can override restrictions:

```javascript
// In authMiddleware.js
if (req.user.platformAdmin) {
  req.bypassLimits = true;
}

// In subscriptionEnforcement.js
if (req.bypassLimits) {
  return next(); // Skip all checks
}
```

### API Endpoints

#### Get Store Access Level
```bash
GET /api/database-provisioning/subscription

Response:
{
  "success": true,
  "subscription": {
    "plan_name": "professional",
    "status": "active",
    "limits": {
      "max_products": 1000,
      "max_orders_per_month": 10000,
      "max_storage_gb": 50,
      "max_api_calls_per_month": 100000
    }
  }
}
```

#### Get Usage Metrics
```bash
GET /api/database-provisioning/usage?startDate=2025-10-01&endDate=2025-10-24

Response:
{
  "success": true,
  "totals": {
    "products_created": 45,
    "orders_created": 128,
    "api_calls": 5420,
    "storage_total_bytes": 2147483648
  },
  "daily_metrics": [...]
}
```

---

## Part 2: Custom Domain Management

### Architecture

```
User's Domain (shop.example.com)
         ↓
    DNS Records
         ↓
  CNAME → stores.daino.app
         ↓
   Platform Router
         ↓
  Resolve to Store ID
         ↓
   Serve Store Content
```

### How It Works

1. **User adds domain** → Verification token generated
2. **User adds DNS records** → CNAME + TXT verification record
3. **Platform verifies ownership** → Check DNS records
4. **Domain activated** → SSL certificate provisioned
5. **Store accessible** → shop.example.com works!

### Setup Process

#### Step 1: Add Domain via API

```bash
POST /api/custom-domains/add
Content-Type: application/json
Authorization: Bearer <token>

{
  "domain": "shop.example.com",
  "isPrimary": true,
  "verificationMethod": "txt",
  "sslProvider": "letsencrypt"
}

Response:
{
  "success": true,
  "domain": {
    "id": "abc-123",
    "domain": "shop.example.com",
    "verification_status": "pending",
    "verification_token": "daino-verify-a1b2c3d4..."
  },
  "verification_instructions": {
    "steps": [...]
  }
}
```

#### Step 2: Add DNS Records

Go to your domain provider (Cloudflare, Namecheap, etc.) and add:

**Required Records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | @ or shop | stores.daino.app | 3600 |
| TXT | _daino-verification | daino-verify-a1b2c3d4... | 300 |

**Example for Cloudflare:**
```
Type: CNAME
Name: shop
Target: stores.daino.app
Proxy: Off (DNS only)
TTL: Auto

Type: TXT
Name: _daino-verification.shop
Content: daino-verify-a1b2c3d4e5f6g7h8i9j0
TTL: Auto
```

#### Step 3: Verify Domain

Wait 5-60 minutes for DNS propagation, then:

```bash
POST /api/custom-domains/:id/verify

Response (Success):
{
  "success": true,
  "message": "Domain verified successfully",
  "domain": {
    "verification_status": "verified",
    "verified_at": "2025-10-24T10:30:00Z",
    "ssl_status": "pending"
  }
}

Response (Failed):
{
  "success": false,
  "message": "Domain verification failed",
  "details": {
    "txt_record": false,
    "cname_record": true
  },
  "instructions": {...}
}
```

#### Step 4: Check DNS Configuration

```bash
POST /api/custom-domains/:id/check-dns

Response:
{
  "success": true,
  "configured": true,
  "records": [
    {
      "type": "CNAME",
      "name": "@",
      "expected": "stores.daino.app",
      "actual": ["stores.daino.app"],
      "configured": true
    },
    {
      "type": "TXT",
      "name": "_daino-verification",
      "expected": "daino-verify-...",
      "actual": ["daino-verify-..."],
      "configured": true
    }
  ]
}
```

#### Step 5: SSL Certificate Provisioning

After verification, SSL is automatically provisioned:

```bash
POST /api/custom-domains/:id/provision-ssl

Response:
{
  "success": true,
  "message": "SSL certificate provisioning initiated",
  "status": "pending",
  "note": "SSL certificates are typically issued within 5-15 minutes"
}
```

### Database Schema

```sql
-- Custom domains table
CREATE TABLE custom_domains (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  domain VARCHAR(255) UNIQUE NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,

  -- Verification
  verification_status VARCHAR(50), -- 'pending', 'verified', 'failed'
  verification_token VARCHAR(255),
  verified_at TIMESTAMP,

  -- SSL
  ssl_status VARCHAR(50), -- 'pending', 'active', 'failed', 'expired'
  ssl_provider VARCHAR(50),
  ssl_issued_at TIMESTAMP,
  ssl_expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/custom-domains/add` | Add new domain |
| GET | `/api/custom-domains` | List all domains |
| GET | `/api/custom-domains/:id` | Get domain details |
| POST | `/api/custom-domains/:id/verify` | Verify ownership |
| POST | `/api/custom-domains/:id/check-dns` | Check DNS config |
| POST | `/api/custom-domains/:id/set-primary` | Set as primary |
| DELETE | `/api/custom-domains/:id` | Remove domain |
| POST | `/api/custom-domains/:id/provision-ssl` | Provision SSL |

### Domain Resolution Middleware

Request routing based on hostname:

```javascript
// backend/src/middleware/domainResolver.js
app.use(async (req, res, next) => {
  const hostname = req.hostname;

  // Check if it's a custom domain
  const customDomain = await CustomDomain.findOne({
    where: { domain: hostname, is_active: true }
  });

  if (customDomain) {
    req.storeId = customDomain.store_id;
    req.customDomain = customDomain;
  }

  next();
});
```

### SSL Certificate Management

**Automatic Renewal:**
```javascript
// Run daily via cron job
async function renewExpiringCertificates() {
  const expiringDomains = await CustomDomain.findAll({
    where: {
      ssl_expires_at: {
        [Op.lte]: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      ssl_auto_renew: true
    }
  });

  for (const domain of expiringDomains) {
    await CustomDomainService.provisionSSLCertificate(domain.id);
  }
}
```

### Common DNS Providers Setup

#### Cloudflare
1. Log in to https://dash.cloudflare.com/
2. Select your domain
3. Go to DNS > Records
4. Add CNAME and TXT records
5. Set Proxy to "DNS only" (orange cloud OFF)

#### Namecheap
1. Log in to https://www.namecheap.com/
2. Domain List > Manage
3. Advanced DNS
4. Add CNAME and TXT records

#### GoDaddy
1. Log in to https://dcc.godaddy.com/
2. My Products > DNS
3. Add CNAME and TXT records

#### Google Domains
1. Log in to https://domains.google.com/
2. My domains > Manage
3. DNS > Custom records
4. Add CNAME and TXT records

### Troubleshooting

#### Domain Not Verifying
```bash
# Check DNS propagation
dig TXT _daino-verification.shop.example.com
dig CNAME shop.example.com

# Common issues:
# 1. DNS not propagated (wait 5-60 minutes)
# 2. Wrong record name (should include subdomain)
# 3. Cloudflare proxy enabled (must be DNS only)
# 4. TTL too high (reduce to 300-3600)
```

#### SSL Not Provisioning
- Ensure domain is verified first
- Check that domain resolves correctly
- Verify CNAME points to platform domain
- Check for CAA records blocking certificate issuance

### Security Considerations

1. **Domain Verification Required** - Prevents domain hijacking
2. **TXT Record Verification** - Proves domain ownership
3. **SSL Enforcement** - HTTPS required for all custom domains
4. **Rate Limiting** - Prevent abuse of verification attempts
5. **Audit Logging** - All domain changes logged

### Limitations

- Maximum 5 custom domains per store (configurable)
- Free plan: 0 custom domains
- Starter plan: 1 custom domain
- Professional plan: 3 custom domains
- Enterprise plan: Unlimited

---

## Integration with Subscription System

Custom domains respect subscription limits:

```javascript
// Check domain limit before adding
router.post('/add', requireActiveSubscription, async (req, res) => {
  const subscription = await Subscription.findOne({
    where: { store_id: req.storeId, status: 'active' }
  });

  const currentDomains = await CustomDomain.count({
    where: { store_id: req.storeId }
  });

  const maxDomains = getMaxDomainsForPlan(subscription.plan_name);

  if (currentDomains >= maxDomains) {
    return res.status(403).json({
      success: false,
      limit_exceeded: true,
      message: `Domain limit reached. Upgrade to add more domains.`,
      current: currentDomains,
      limit: maxDomains
    });
  }

  // ... continue adding domain
});
```

## Summary

### Subscription Enforcement
- ✅ **Automatic enforcement** based on usage and subscription status
- ✅ **4 access levels**: Full, Read-Only, Suspended, Terminated
- ✅ **Graceful degradation**: Read-only before suspension
- ✅ **Real-time tracking**: API calls, storage, resources monitored
- ✅ **Grace periods**: 7 days for payment issues

### Custom Domains
- ✅ **DNS verification** via TXT records
- ✅ **Automatic SSL** provisioning with Let's Encrypt
- ✅ **Multiple domains** per store (plan-dependent)
- ✅ **Primary domain** selection
- ✅ **CDN integration** ready (Cloudflare, CloudFront)

## Next Steps

1. Run database migrations:
   ```bash
   psql < backend/src/database/migrations/create-custom-domains-table.sql
   ```

2. Add routes to server.js:
   ```javascript
   const customDomainRoutes = require('./routes/custom-domains');
   app.use('/api/custom-domains', customDomainRoutes);
   ```

3. Apply subscription middleware:
   ```javascript
   const { requireActiveSubscription, enforceReadOnly } = require('./middleware/subscriptionEnforcement');
   app.use('/api', requireActiveSubscription, enforceReadOnly);
   ```

4. Set environment variables:
   ```bash
   PLATFORM_DOMAIN=daino.app
   ```
