# Custom Domain System - Complete Flow Documentation

## Overview

Allow store owners to use custom domains (e.g., `www.myshop.com`) instead of platform URLs (`/public/storecode`).

**Cost:** 0.5 credits per day (charged daily via Render cron service)

---

## Complete Request Flow

### Example: User visits `www.myshop.com/product/abc`

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Browser: GET www.myshop.com/product/abc                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Vercel (Frontend)                                            │
│    - Receives request                                            │
│    - Serves React app (index.html)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Frontend: App.jsx Routing (line 415-432)                    │
│    - Detects NOT on vercel.app/localhost                        │
│    - Matches custom domain routes                               │
│    - Route: /product/:productSlug matches                       │
│    - Renders: ProductDetail component                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. StoreProvider.jsx (line 321-356)                            │
│    - Detects isCustomDomain = true                              │
│    - Sets storeIdentifier = "www.myshop.com"                   │
│    - Makes API call: GET /api/public/stores?slug=www.myshop.com│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Backend: stores.js (line 322-344)                           │
│    - Receives slug = "www.myshop.com"                           │
│    - Detects dot in slug (domain format)                        │
│    - Queries: SELECT * FROM custom_domains                      │
│              WHERE domain = 'www.myshop.com'                    │
│              AND is_active = true                               │
│              AND verification_status = 'verified'               │
│    - Finds: store_id = '123-abc-456'                           │
│    - Returns: Store data for store_id '123-abc-456'            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Frontend: StoreProvider                                      │
│    - Receives store data (slug: 'hamid2', id: '123-abc-456')   │
│    - Sets store context for all components                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. ProductDetail Component                                      │
│    - Uses store context from StoreProvider                      │
│    - Fetches product data using store.id                        │
│    - Renders product page                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Code Components

### 1. Domain Resolution - Backend Middleware

**File:** `backend/src/middleware/domainResolver.js`

```javascript
// Line 76-104
const domainRecord = await CustomDomain.findOne({
  where: {
    domain: hostname, // "www.myshop.com"
    is_active: true,
    verification_status: 'verified'
  },
  include: [{
    model: Store,
    as: 'store'
  }]
});

// Attach to request for API endpoints
req.storeId = domainRecord.store_id;
req.storeSlug = domainRecord.store.slug;
```

**Purpose:** Backend API endpoints can use `req.storeId` directly

---

### 2. Store Lookup - Backend API

**File:** `backend/src/routes/stores.js`

```javascript
// Line 322-344
if (slug.includes('.')) {
  // Domain format detected (e.g., www.myshop.com)
  const CustomDomain = require('../models/CustomDomain');
  const domainRecord = await CustomDomain.findOne({
    where: {
      domain: slug,
      is_active: true,
      verification_status: 'verified'
    }
  });

  if (domainRecord) {
    where.id = domainRecord.store_id; // Find store by ID
  }
} else {
  where.slug = slug; // Regular slug lookup
}
```

**Purpose:** Frontend can query stores by domain name

---

### 3. Custom Domain Detection - Frontend

**File:** `src/components/storefront/StoreProvider.jsx`

```javascript
// Line 321-356
const hostname = window.location.hostname;

const isCustomDomain = !hostname.includes('vercel.app') &&
                      !hostname.includes('localhost');

if (isCustomDomain) {
  // Use hostname as identifier
  storeCacheKey = `store-domain-${hostname}`;
  storeIdentifier = hostname; // e.g., "www.myshop.com"

  // API call: /api/public/stores?slug=www.myshop.com
  const result = await StorefrontStore.filter({ slug: storeIdentifier });
}
```

**Purpose:** Detect custom domain and query correct store

---

### 4. Custom Domain Routing - Frontend

**File:** `src/App.jsx`

```javascript
// Line 415-432
{!window.location.hostname.includes('vercel.app') &&
 !window.location.hostname.includes('localhost') && (
  <>
    {/* Custom domain routes (no /public/:storeCode prefix) */}
    <Route path="/product/:productSlug" element={<ProductDetail />} />
    <Route path="/cart" element={<Cart />} />
    <Route path="/checkout" element={<Checkout />} />
  </>
)}

{/* Standard routes (WITH /public/:storeCode prefix) */}
<Route path="/public/:storeCode/product/:productSlug" element={<ProductDetail />} />
```

**Purpose:** Different route patterns for custom vs platform domains

---

## Database Schema

### custom_domains table

```sql
┌───────────────┬──────────────┬─────────────────────┬──────────────┐
│ domain        │ store_id     │ verification_status │ is_active    │
├───────────────┼──────────────┼─────────────────────┼──────────────┤
│ www.myshop.com│ 123-abc-456  │ verified            │ true         │
│ shop.test.com │ 789-def-012  │ verified            │ true         │
└───────────────┴──────────────┴─────────────────────┴──────────────┘
       │               │
       │               └─→ Foreign Key: stores.id
       └─→ Used for lookup in domainResolver & stores API
```

---

## URL Examples

### Traditional URLs (still work):
- `https://www..dainostore.com/public/hamid2`
- `https://www..dainostore.com/public/hamid2/product/abc`
- `https://www..dainostore.com/public/hamid2/cart`

### Custom Domain URLs (new):
- `https://www.myshop.com`
- `https://www.myshop.com/product/abc`
- `https://www.myshop.com/cart`

**Both work simultaneously!**

---

## DNS Configuration

### What Users Need to Add

**1. CNAME Record**
```
Type:  CNAME
Name:  www (or @ for apex)
Value: cname.vercel-dns.com
TTL:   3600
```

**2. TXT Record (Verification)**
```
Type:  TXT
Name:  _daino-verification
Value: daino-verify-[token]
TTL:   300
```

### After DNS Propagation

- User clicks "Verify" button
- Backend checks TXT record exists
- If verified → domain activated
- Store accessible at custom domain

---

## Credit System Integration

### Daily Billing (Render Cron Service)

**File:** `backend/src/core/jobs/DailyCreditDeductionJob.js`

```javascript
// Runs daily at midnight UTC
// Charges for:
// 1. Published stores (1.0 credits/day)
// 2. Active custom domains (0.5 credits/day)

const activeCustomDomains = await CustomDomain.findAll({
  where: {
    is_active: true,
    verification_status: 'verified'
  }
});

for (const domain of activeCustomDomains) {
  await creditService.chargeDailyCustomDomainFee(
    domain.store.user_id,
    domain.id,
    domain.domain
  );
}
```

### Credit Deduction Logic

**File:** `backend/src/services/credit-service.js:236-302`

```javascript
async chargeDailyCustomDomainFee(userId, domainId, domainName) {
  // Get cost from service_credit_costs table
  const dailyCost = await ServiceCreditCost.getCostByKey('custom_domain_daily'); // 0.5

  // Check if domain is still active
  const domain = await CustomDomain.findByPk(domainId);

  // Get user balance
  const balance = await this.getBalance(userId);

  if (balance < dailyCost) {
    // Insufficient credits → deactivate domain
    await domain.update({
      is_active: false,
      metadata: {
        deactivated_reason: 'insufficient_credits'
      }
    });
    return { success: false, domain_deactivated: true };
  }

  // Deduct credits
  await this.deduct(userId, storeId, dailyCost, `Custom domain - daily charge (${domainName})`);
}
```

---

## Vercel Setup Required

### Manual Steps (One-time)

1. **Vercel Dashboard**
   - Go to: https://vercel.com/
   - Project: `daino-pearl`
   - Settings → Domains

2. **Add Custom Domains**
   - As users add domains, manually add them in Vercel
   - OR contact Vercel support for wildcard domain support

3. **SSL Certificates**
   - Vercel auto-provisions Let's Encrypt certificates
   - Automatic renewal
   - No configuration needed

---

## Testing Checklist

- [ ] Add test domain in Vercel project settings
- [ ] Add domain via CustomDomains.jsx UI
- [ ] Configure DNS records (CNAME + TXT)
- [ ] Verify domain ownership
- [ ] Visit custom domain URL
- [ ] Verify store loads correctly
- [ ] Check legacy /public/:storecode URL still works
- [ ] Run daily credit deduction job
- [ ] Verify 0.5 credits deducted
- [ ] Test insufficient credits → domain deactivation

---

## Architecture Diagram

```
                     ┌───────────────────┐
                     │  www.myshop.com   │
                     │    (User visit)   │
                     └─────────┬─────────┘
                               │
                ┌──────────────▼──────────────┐
                │     DNS Resolution          │
                │  CNAME → cname.vercel-dns.com│
                └──────────────┬──────────────┘
                               │
                ┌──────────────▼──────────────┐
                │    Vercel Frontend          │
                │  Serves React App           │
                └──────────────┬──────────────┘
                               │
              ┌────────────────▼────────────────┐
              │   App.jsx                       │
              │   - Detects custom domain       │
              │   - Routes to /product/:slug    │
              └────────────────┬────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │   StoreProvider.jsx             │
              │   - storeIdentifier = hostname  │
              │   - API: ?slug=www.myshop.com   │
              └────────────────┬────────────────┘
                               │
                               │ HTTP Request
                               │
                ┌──────────────▼──────────────┐
                │   Backend: stores.js        │
                │   - Detects domain format   │
                │   - Query custom_domains    │
                │   - Find store_id           │
                │   - Return store data       │
                └──────────────┬──────────────┘
                               │
              ┌────────────────▼────────────────┐
              │   Store Data Returned           │
              │   { id, slug, name, ... }       │
              └────────────────┬────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │   ProductDetail Component       │
              │   - Fetches product data        │
              │   - Renders product page        │
              └─────────────────────────────────┘
```

---

## Code References

| Component | File | Line | Purpose |
|-----------|------|------|---------|
| Domain Resolver Middleware | `backend/src/middleware/domainResolver.js` | 76-104 | Maps domain to store (backend) |
| Store API Domain Lookup | `backend/src/routes/stores.js` | 322-344 | Resolves domain to store |
| Custom Domain Detection | `src/components/storefront/StoreProvider.jsx` | 321-356 | Detects custom domain (frontend) |
| Custom Domain Routes | `src/App.jsx` | 415-432 | Routes for custom domains |
| Credit Deduction | `backend/src/services/credit-service.js` | 236-302 | Daily billing logic |
| Daily Job | `backend/src/core/jobs/DailyCreditDeductionJob.js` | 103-179 | Cron job execution |

---

## Summary

**The connection happens in 3 places:**

1. **Backend Middleware** (`domainResolver.js`): Attaches store info to API requests
2. **Backend Store API** (`stores.js:322-344`): Looks up store by domain when slug contains dot
3. **Frontend StoreProvider** (`StoreProvider.jsx:353-356`): Passes domain as identifier to API

**Result:** Seamless custom domain support with backward compatibility!
