# Bottleneck Identification Guide

**How to Find Real Performance Issues: Duplicate Calls, Slow Queries, and More**

---

## Table of Contents

1. [Frontend Bottlenecks](#frontend-bottlenecks)
2. [Backend Bottlenecks](#backend-bottlenecks)
3. [Database Query Analysis](#database-query-analysis)
4. [Network Issues](#network-issues)
5. [Tools & Setup](#tools--setup)
6. [Real-World Examples](#real-world-examples)

---

## Frontend Bottlenecks

### 1. Identify Duplicate API Calls (React Query DevTools)

**Step 1: Enable React Query DevTools**

Already enabled in your app! Just need to open it.

**Step 2: Open DevTools**

1. Visit your product page: https://www..dainostore.com/public/hamid2/product/...
2. Look for **React Query DevTools** icon (bottom-right corner, red flower icon)
3. Click to expand

**Step 3: Identify Duplicate Queries**

Look for:

```
Queries Panel:
┌─────────────────────────────────┬──────────┬─────────┐
│ Query Key                       │ Status   │ Obs     │
├─────────────────────────────────┼──────────┼─────────┤
│ ['products', 'list', 'store1']  │ success  │ 3       │  ← DUPLICATE! (3 observers)
│ ['product', 'id123']            │ success  │ 1       │  ← Good (1 observer)
│ ['translations', 'products']    │ loading  │ 2       │  ← Potentially duplicate
└─────────────────────────────────┴──────────┴─────────┘
```

**Red Flags:**
- **Observers > 1**: Same data fetched by multiple components
- **Multiple queries with similar keys**: Not using shared queries
- **Status "loading" multiple times**: Fetching same data repeatedly

**How to Fix:**
- Consolidate queries in parent component
- Use the same query key across components
- Lift query state up

---

### 2. Identify Slow API Calls (Browser Network Tab)

**Step 1: Open Network Tab**

1. F12 or Right-click → Inspect
2. Go to **"Network"** tab
3. Reload the page

**Step 2: Sort by Time**

Click the **"Time"** column header to sort by slowest

**Example Output:**
```
┌────────────────────────────┬──────────┬──────────┬─────────┐
│ Name                       │ Status   │ Type     │ Time    │
├────────────────────────────┼──────────┼──────────┼─────────┤
│ products?store_id=1        │ 200      │ xhr      │ 2.5s    │ ← SLOW!
│ translations/products      │ 200      │ xhr      │ 1.8s    │ ← SLOW!
│ product/by-slug/abc/full   │ 200      │ xhr      │ 850ms   │ ← Acceptable
│ ui-labels?store_id=1       │ 200      │ xhr      │ 150ms   │ ← Fast
└────────────────────────────┴──────────┴──────────┴─────────┘
```

**Red Flags:**
- Requests > 1 second (for API calls)
- Requests > 3 seconds (for any request)
- Multiple requests to same endpoint

**Step 3: Check Waterfall**

Click on **"Waterfall"** column to see request sequence:

```
Timeline (waterfall):
|─────────────────────────────────────────|
| DNS   | Connect | Waiting | Download    |
|──|────|─────────|──────────|───────|    |
  50ms  100ms     1.2s        200ms       | ← Most time in "Waiting" (backend)

Vs Good:
|────────────────────|
|─|─|──|─────|       |
  DNS=10ms, Waiting=50ms                  | ← Cached/Fast
```

**What Each Color Means:**
- **Queueing** (gray): Waiting for browser to start request
- **Stalled** (gray): Held up by browser limits
- **DNS Lookup** (green): Domain resolution
- **Initial Connection** (orange): TCP handshake
- **SSL/TLS** (purple): HTTPS negotiation
- **Request Sent** (blue): Sending request
- **Waiting (TTFB)** (green): **MOST IMPORTANT** - Server processing time
- **Content Download** (blue): Downloading response

**If "Waiting" is high → Backend problem**
**If "Content Download" is high → Large response problem**

---

### 3. Find N+1 Queries in Frontend

**Use Chrome DevTools Console:**

```javascript
// Paste this in console while on product page
let requestLog = [];
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  const timestamp = Date.now();
  requestLog.push({ url, timestamp });

  console.log(`[FETCH] ${url}`);

  return originalFetch.apply(this, args);
};

// After page loads, analyze:
setTimeout(() => {
  const urls = requestLog.map(r => r.url);
  const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);

  console.log('Total requests:', requestLog.length);
  console.log('Duplicate URLs:', [...new Set(duplicates)]);
  console.log('Full log:', requestLog);
}, 5000);
```

**Expected Output:**
```
[FETCH] /api/public/products?store_id=1
[FETCH] /api/translations/products/batch?ids=1,2,3
[FETCH] /api/translations/ui-labels?store_id=1

Total requests: 3
Duplicate URLs: []  ← Good!

-- OR --

Total requests: 15  ← BAD!
Duplicate URLs: [
  "/api/translations/products/batch?ids=1",  ← N+1 problem!
  "/api/translations/products/batch?ids=2",
  "/api/translations/products/batch?ids=3",
  ...
]
```

---

### 4. Measure Component Render Performance

**Use React DevTools Profiler:**

1. Install **React DevTools** extension
2. Open DevTools → **"Profiler"** tab
3. Click **Record** (circle button)
4. Navigate to product page
5. Click **Stop**

**Analyze Results:**

```
Flame Graph:
┌─────────────────────────────────────────┐
│ App (15.2ms)                            │
│  ├─ ProductDetail (12.8ms) ← SLOW!      │
│  │   ├─ ProductImage (8.2ms) ← SLOW!    │
│  │   ├─ ProductInfo (2.1ms)             │
│  │   └─ ProductTabs (1.5ms)             │
│  └─ Header (2.4ms)                      │
└─────────────────────────────────────────┘
```

**Red Flags:**
- Components taking > 16ms (blocks 60fps)
- Re-renders without prop changes
- Expensive calculations in render

**Ranked List:**
Shows components sorted by render time. Focus on top 3.

---

## Backend Bottlenecks

### 1. Enable Database Query Logging

**Step 1: Enable Logging**

Update `backend/src/config/database.js`:

```javascript
const config = {
  // ... existing config
  logging: (sql, timing) => {
    // Log slow queries (> 100ms)
    if (timing > 100) {
      console.log(`⚠️  SLOW QUERY (${timing}ms):`, sql);
    }

    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB ${timing}ms]`, sql);
    }
  },
  benchmark: true, // Enable timing
};
```

**Step 2: Set Environment Variable**

Add to Render.com environment:
```env
DB_QUERY_LOG=true
```

**Step 3: Check Logs**

Go to Render Dashboard → Backend Service → Logs

**Example Output:**
```
[DB 1250ms] SELECT * FROM products WHERE store_id = '...'  ← SLOW!
⚠️  SLOW QUERY (1250ms): SELECT * FROM products WHERE store_id = '...'

[DB 45ms] SELECT * FROM product_translations WHERE product_id IN (...)  ← Fast
[DB 2340ms] SELECT * FROM customer_activities WHERE created_at > ...  ← VERY SLOW!
```

**Red Flags:**
- Queries > 100ms
- Queries > 500ms (critical)
- Same query executed multiple times in logs
- Queries without WHERE clause (full table scans)

---

### 2. Find N+1 Queries in Backend

**Method 1: Count Queries Per Request**

Add middleware to `backend/src/server.js`:

```javascript
// Query counter middleware
let queryCount = 0;

// Before routes
app.use((req, res, next) => {
  queryCount = 0;

  // Track when response finishes
  res.on('finish', () => {
    if (queryCount > 10) {
      console.log(`⚠️  HIGH QUERY COUNT: ${req.method} ${req.path} - ${queryCount} queries`);
    }
  });

  next();
});

// In database config logging function:
logging: (sql) => {
  queryCount++;
  // ... rest of logging
}
```

**Example Output:**
```
GET /api/public/products - 3 queries  ← Good
⚠️  HIGH QUERY COUNT: GET /api/public/products/by-slug/abc/full - 47 queries  ← N+1!
```

**Method 2: Look for Loops with Queries**

Search codebase for anti-patterns:

```bash
# Find forEach/map with await (potential N+1)
grep -rn "forEach.*await\|map.*await" backend/src/routes/

# Find for loops with database queries
grep -rn "for.*findOne\|for.*findAll" backend/src/routes/
```

**Example Bad Code:**
```javascript
// ❌ N+1 Query
products.forEach(async (product) => {
  const translation = await Translation.findOne({
    where: { product_id: product.id }
  });
});

// ✅ Fixed with batch query
const productIds = products.map(p => p.id);
const translations = await Translation.findAll({
  where: { product_id: { [Op.in]: productIds } }
});
```

---

### 3. Analyze Query Execution Plans (PostgreSQL)

**Step 1: Connect to Database**

Via Render.com:
1. Go to Render Dashboard → Databases → PostgreSQL
2. Click "Connect" → "External Connection"
3. Use connection string with psql:

```bash
psql "postgresql://user:password@host:5432/database"
```

**Step 2: Analyze Queries**

```sql
-- Explain a slow query
EXPLAIN ANALYZE
SELECT p.*, pt.name, pt.description
FROM products p
LEFT JOIN product_translations pt ON p.id = pt.product_id
WHERE p.store_id = 'your-store-id';
```

**Example Output:**
```
Seq Scan on products p  (cost=0.00..1250.45 rows=100 width=500) (actual time=0.025..125.432 rows=100 loops=1)
  Filter: (store_id = 'uuid-here')
  Rows Removed by Filter: 9900

← RED FLAG: "Seq Scan" = scanning entire table (slow!)
← RED FLAG: "Rows Removed: 9900" = filtering after scan (inefficient!)
```

**Good Output:**
```
Index Scan using idx_products_store_id on products p  (cost=0.29..8.31 rows=1 width=500)
  Index Cond: (store_id = 'uuid-here')

← GOOD: "Index Scan" = using index (fast!)
← GOOD: "Index Cond" = filtering with index
```

**Red Flags:**
- **Seq Scan**: Full table scan (add index!)
- **Rows Removed by Filter > 90%**: Poor filtering
- **Nested Loop**: Potential N+1
- **cost > 1000**: Expensive query
- **actual time > 100ms**: Slow execution

**Step 3: Find Missing Indexes**

```sql
-- Find tables without indexes
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check if index is being used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Never used!
ORDER BY tablename;
```

---

### 4. Monitor API Response Times

**Add Timing Middleware**

Create `backend/src/middleware/timingMiddleware.js`:

```javascript
const timingMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.path;

    // Log slow requests
    if (duration > 500) {
      console.log(`⚠️  SLOW REQUEST (${duration}ms): ${req.method} ${path}`);
    }

    // Track in metrics (if using APM)
    if (global.metrics) {
      global.metrics.recordResponseTime(path, duration);
    }
  });

  next();
};

module.exports = timingMiddleware;
```

**Add to server.js:**
```javascript
app.use(timingMiddleware);
```

---

## Database Query Analysis

### 1. Find Slow Queries (Supabase Dashboard)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **"Database"** → **"Query Performance"**
4. Sort by **"Total Time"** or **"Mean Time"**

**Example:**
```
┌────────────────────────────────┬──────────┬───────────┬──────────┐
│ Query                          │ Calls    │ Mean Time │ Total    │
├────────────────────────────────┼──────────┼───────────┼──────────┤
│ SELECT * FROM products WHERE..│ 15,234   │ 850ms     │ 3.6h     │ ← CRITICAL!
│ SELECT * FROM customer_activ...│ 8,456    │ 1,200ms   │ 2.8h     │ ← CRITICAL!
│ SELECT * FROM product_trans... │ 45,123   │ 45ms      │ 34m      │ ← Acceptable
└────────────────────────────────┴──────────┴───────────┴──────────┘
```

**Focus on:**
- Queries with Mean Time > 100ms
- Queries with high call count
- Total time (calls × mean) - biggest impact

---

### 2. Check Database Connection Pool

**In Render Logs**, look for:

```
⚠️  Connection pool exhausted
⚠️  Waiting for available connection
⚠️  Too many connections
```

**Check current connections:**

```sql
-- Connect to database
SELECT
  count(*) as total_connections,
  state,
  application_name
FROM pg_stat_activity
WHERE datname = 'your_database'
GROUP BY state, application_name;
```

**Expected:**
```
total_connections | state  | application_name
------------------+--------+-----------------
3                 | active | daino-backend  ← Good (within pool limit)
2                 | idle   | daino-backend
```

**Bad:**
```
total_connections | state  | application_name
------------------+--------+-----------------
15                | active | daino-backend  ← BAD! (exceeds pool max=10)
10                | idle   | daino-backend  ← Connection leak!
```

---

## Network Issues

### 1. Check for Large Payloads

**In Network Tab:**

Click on a request → **"Response"** tab

**Example:**
```json
{
  "success": true,
  "data": {
    "products": [...],  // 100 products
    "total": 10000
  }
}

Size: 5.2 MB  ← TOO LARGE!
```

**Red Flags:**
- Response > 1MB (for JSON)
- Response > 5MB (for any API call)
- Including unnecessary data (full objects when only IDs needed)

**Fix:**
- Add pagination
- Use field selection (?fields=id,name)
- Compress responses (gzip/brotli)

---

### 2. Check TTFB (Time to First Byte)

**In Network Tab:**

Click request → **"Timing"** tab

```
Timing breakdown:
┌──────────────────────┬─────────┐
│ Queueing             │ 2ms     │
│ Stalled              │ 0ms     │
│ DNS Lookup           │ 12ms    │
│ Initial connection   │ 45ms    │
│ SSL                  │ 78ms    │
│ Request sent         │ 1ms     │
│ Waiting (TTFB)       │ 1,250ms │ ← SLOW!
│ Content Download     │ 120ms   │
└──────────────────────┴─────────┘
Total: 1,508ms
```

**If TTFB > 500ms → Backend optimization needed**
**If Download > 200ms → Payload too large**

---

## Tools & Setup

### Essential Tools

#### 1. **Chrome DevTools**
- Network tab: API calls, timing
- Performance tab: Render performance
- Lighthouse: Overall metrics

#### 2. **React Query DevTools**
Already enabled! Look for icon in bottom-right corner.

#### 3. **React Developer Tools**
- Profiler: Component render times
- Components: Props debugging

#### 4. **Database GUI Tools**

**pgAdmin** (PostgreSQL):
```bash
# Install
npm install -g pgadmin

# Connect using Supabase connection string
```

**Supabase Studio**:
Direct access via dashboard.supabase.com

#### 5. **APM Tools** (Recommended for Production)

**New Relic** (Free tier available):
```bash
npm install newrelic

# Create newrelic.js config
# Add to server.js:
require('newrelic');
```

**DataDog** (14-day trial):
```bash
npm install dd-trace

# Initialize:
require('dd-trace').init();
```

---

## Real-World Examples

### Example 1: Finding Duplicate API Calls

**Symptoms:**
- Page loads slowly
- Network tab shows same endpoint called 3+ times

**Debug:**
1. Open React Query DevTools
2. Look for query with "Observers: 3"
3. Click query → See which components are using it

**Found:**
```
Query: ['product', 'abc123']
Observers: 3
- ProductDetail.jsx:100
- RelatedProducts.jsx:45
- RecentlyViewed.jsx:23
```

**Fix:**
Move query to parent component, pass data as props.

---

### Example 2: Finding Slow Database Query

**Symptoms:**
- API endpoint takes 2+ seconds
- High "Waiting" time in Network tab

**Debug:**
1. Enable database query logging
2. Check Render logs
3. Found:

```
⚠️  SLOW QUERY (2,340ms):
SELECT * FROM customer_activities
WHERE store_id = '...'
ORDER BY created_at DESC
```

**Analyze:**
```sql
EXPLAIN ANALYZE [the query];

Result: Seq Scan on customer_activities (2,340ms)
```

**Fix:**
```sql
CREATE INDEX idx_customer_activities_store_created
ON customer_activities(store_id, created_at DESC);
```

**After:** Query now 45ms ✅

---

### Example 3: Finding N+1 in Translations

**Symptoms:**
- Product page makes 50+ API calls
- Network waterfall shows sequential requests

**Debug:**
1. Use fetch logger in console
2. Found:

```
[FETCH] /api/translations/products/batch?ids=1
[FETCH] /api/translations/products/batch?ids=2
[FETCH] /api/translations/products/batch?ids=3
...
[FETCH] /api/translations/products/batch?ids=50
```

**Fix:**
Use batch hook:
```javascript
// ❌ Before
products.map(p => useQuery(['translation', p.id], () => fetch(...)))

// ✅ After
const productIds = products.map(p => p.id);
const { data } = useBatchProductTranslations(productIds, lang);
```

**After:** 50 requests → 1 request ✅

---

## Quick Reference: What to Check First

### Frontend is Slow

1. ✅ Network tab → Sort by Time
2. ✅ React Query DevTools → Check Observers
3. ✅ Network tab → Check for duplicate requests
4. ✅ Lighthouse → Check Performance score

### Backend is Slow

1. ✅ Enable query logging
2. ✅ Check Render logs for slow queries
3. ✅ Add timing middleware
4. ✅ Check database indexes

### Database is Slow

1. ✅ EXPLAIN ANALYZE slow queries
2. ✅ Check for Seq Scans
3. ✅ Verify indexes exist and are used
4. ✅ Check connection pool usage

---

## Automated Monitoring Script

Save as `check-performance.js`:

```javascript
// Run: node check-performance.js https://your-site.com/product/abc

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const requests = [];

  page.on('request', req => {
    requests.push({
      url: req.url(),
      method: req.method(),
      start: Date.now()
    });
  });

  page.on('response', async res => {
    const req = requests.find(r => r.url === res.url());
    if (req) {
      req.duration = Date.now() - req.start;
      req.status = res.status();
      req.size = (await res.buffer()).length;
    }
  });

  await page.goto(process.argv[2]);
  await page.waitForLoadState('networkidle');

  // Analyze
  const apiRequests = requests.filter(r => r.url.includes('/api/'));
  const slowRequests = apiRequests.filter(r => r.duration > 500);
  const duplicates = apiRequests.filter((r, i, arr) =>
    arr.findIndex(x => x.url === r.url) !== i
  );

  console.log(`Total API requests: ${apiRequests.length}`);
  console.log(`Slow requests (>500ms): ${slowRequests.length}`);
  console.log(`Duplicate requests: ${duplicates.length}`);

  if (slowRequests.length) {
    console.log('\nSlow requests:');
    slowRequests.forEach(r => {
      console.log(`  ${r.duration}ms - ${r.url}`);
    });
  }

  await browser.close();
})();
```

---

**Last Updated:** 2025-11-08
**Status:** Complete Guide Ready for Use
