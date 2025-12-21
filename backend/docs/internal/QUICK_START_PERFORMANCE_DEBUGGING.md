# Quick Start: Performance Debugging

**How to Find Bottlenecks in Your Site RIGHT NOW**

---

## 🚀 Method 1: Browser Console (Easiest - 2 minutes)

### Find Duplicate API Calls

**Step 1:** Visit your slow page
```
https://www..dainostore.com/public/hamid2/product/kenwood...
```

**Step 2:** Open browser console (F12)

**Step 3:** Copy and paste this script:

```javascript
// Copy from: scripts/browser-performance-check.js
// Or paste this shortened version:

(function() {
  const requests = [];
  const originalFetch = window.fetch;

  window.fetch = function(...args) {
    const url = args[0];
    const start = performance.now();
    requests.push({ url, start });

    return originalFetch.apply(this, args).then(res => {
      requests[requests.length - 1].duration = performance.now() - start;
      if (res.headers.get('X-Cache')) {
        requests[requests.length - 1].cached = res.headers.get('X-Cache');
      }
      return res;
    });
  };

  setTimeout(() => {
    console.log('📊 ANALYSIS:');
    console.log(`Total requests: ${requests.length}`);

    const urls = requests.map(r => r.url.split('?')[0]);
    const duplicates = urls.filter((url, i) => urls.indexOf(url) !== i);
    console.log(`Duplicates: ${[...new Set(duplicates)].length}`);

    const slow = requests.filter(r => r.duration > 500);
    console.log(`Slow (>500ms): ${slow.length}`);

    if (duplicates.length) {
      console.log('\n❌ DUPLICATES FOUND:');
      [...new Set(duplicates)].forEach(url => {
        const count = urls.filter(u => u === url).length;
        console.log(`  ${count}x ${url}`);
      });
    }

    if (slow.length) {
      console.log('\n⚠️  SLOW REQUESTS:');
      slow.forEach(r => {
        console.log(`  ${Math.round(r.duration)}ms - ${r.url}`);
      });
    }

    const hits = requests.filter(r => r.cached === 'HIT').length;
    const total = requests.filter(r => r.cached).length;
    console.log(`\n💾 Cache hit rate: ${total ? ((hits/total)*100).toFixed(1) : 0}%`);

  }, 5000);

  console.log('⏳ Monitoring for 5 seconds...');
})();
```

**Step 4:** Wait 5 seconds

**Step 5:** Check results in console

**What to Look For:**
```
✅ Good:
Total requests: 3
Duplicates: 0
Slow (>500ms): 0
Cache hit rate: 85%

❌ Bad:
Total requests: 25  ← Too many!
Duplicates: 8       ← Fix these!
Slow (>500ms): 5    ← Backend problem!
Cache hit rate: 15% ← Cache not working!
```

---

## 🔍 Method 2: Network Tab (3 minutes)

### Visual Analysis

**Step 1:** Open DevTools (F12) → **Network** tab

**Step 2:** Reload page (Ctrl+R)

**Step 3:** Click **"Time"** column to sort by slowest

### What to Check:

**1. Duplicate Requests**
Look for same URL appearing multiple times:
```
/api/public/products?store_id=1  (450ms)
/api/public/products?store_id=1  (380ms)  ← DUPLICATE!
/api/public/products?store_id=1  (420ms)  ← DUPLICATE!
```

**Fix:** React Query deduplication issue - check component structure

**2. Slow Requests (>500ms)**
```
/api/public/products/by-slug/abc/full  (2,300ms)  ← SLOW!
```

**Fix:** Enable DB_QUERY_LOG on backend to see which queries are slow

**3. Large Payloads (>1MB)**
```
/api/public/products  (Size: 5.2 MB)  ← TOO LARGE!
```

**Fix:** Add pagination, limit fields, compress response

**4. Check X-Cache Header**
Click request → **Headers** tab → **Response Headers**
```
X-Cache: MISS  ← First load (OK)
X-Cache: HIT   ← Cached! (Good)
(no X-Cache)   ← Not cached (check why)
```

---

## 🗄️ Method 3: Backend Logs (5 minutes)

### Enable Query Logging

**Step 1:** Add to Render Environment

1. Go to Render Dashboard
2. daino-backend → Environment
3. Add variable:
   ```
   Key: DB_QUERY_LOG
   Value: true
   ```
4. Click "Save Changes"
5. Wait for auto-redeploy (~2 min)

**Step 2:** Check Logs

1. daino-backend → **Logs** tab
2. Visit your product page
3. Watch logs in real-time

### What You'll See:

**Good:**
```
[GET] /api/public/products - 120ms (2 queries)
[DB 45ms] SELECT * FROM products WHERE...
[DB 30ms] SELECT * FROM product_translations WHERE...
```

**Bad:**
```
⚠️  SLOW REQUEST (2,340ms, 47 queries): GET /api/public/products/by-slug/abc/full
⚠️  SLOW QUERY (1,250ms): SELECT * FROM customer_activities WHERE...
⚠️  HIGH QUERY COUNT (47 queries): GET /api/public/products/by-slug/abc/full (2,340ms)
```

**Red Flags:**
- `SLOW REQUEST (>500ms)` = Endpoint optimization needed
- `SLOW QUERY (>100ms)` = Database index missing
- `HIGH QUERY COUNT (>20)` = N+1 query problem

---

## 📊 Method 4: React Query DevTools (2 minutes)

### Check for Duplicate Queries

**Step 1:** Visit your product page

**Step 2:** Look for **React Query** icon (bottom-right, red flower)

**Step 3:** Click to open

### What to Check:

**1. Observers Count**
```
Query: ['product', 'abc123']
Observers: 3  ← DUPLICATE! Same query used in 3 places
```

**Fix:** Lift query to parent, pass data as props

**2. Query Status**
```
Query: ['products', 'list']
Status: loading
Fetches: 8  ← Refetching too often!
```

**Fix:** Increase staleTime (already done ✅)

**3. Cache Hits**
```
Query: ['product', 'abc123']
Data: {...}
Data Updated: 2 minutes ago
isFetching: false  ← Using cache! ✅
```

---

## 🎯 Method 5: Lighthouse Report (5 minutes)

### Comprehensive Analysis

**Run Lighthouse:**

```bash
npx lighthouse https://www..dainostore.com/public/hamid2/product/kenwood... --view
```

**Or in Chrome DevTools:**
1. F12 → **"Lighthouse"** tab
2. Select **"Performance"**
3. Click **"Analyze page load"**

### Key Metrics to Check:

```
Performance Score: 45 / 100  ← Target: >90

Metrics:
┌────────────────────────────┬─────────┬──────────┐
│ Metric                     │ Value   │ Target   │
├────────────────────────────┼─────────┼──────────┤
│ First Contentful Paint     │ 2.8s    │ <1.8s    │ ← Preconnect helps
│ Largest Contentful Paint   │ 5.2s    │ <2.5s    │ ← Image lazy loading helps
│ Total Blocking Time        │ 850ms   │ <200ms   │ ← Code splitting helps
│ Cumulative Layout Shift    │ 0.15    │ <0.1     │
│ Speed Index                │ 4.3s    │ <3.4s    │
└────────────────────────────┴─────────┴──────────┘
```

**Diagnostics Section Shows:**
- ❌ Eliminate render-blocking resources
- ❌ Reduce unused JavaScript
- ❌ Serve images in next-gen formats
- ❌ Properly size images

---

## ⚡ Quick Actions You Can Do NOW

### Action 1: Check for Duplicates (30 seconds)

```bash
# In browser console on product page:
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/api/'))
  .forEach(r => console.log(r.name));

# Look for repeated URLs
```

### Action 2: Check Cache Status (30 seconds)

```bash
# Visit this URL:
https://backend.dainostore.com/health/cache

# Check "keys" value (should be growing)
```

### Action 3: Check Slow Endpoints (1 minute)

```bash
# In DevTools Network tab:
# 1. Reload page
# 2. Right-click header row → Add "Time" column if not visible
# 3. Click "Time" to sort
# 4. Note any requests >1 second
```

### Action 4: Enable Backend Logging (2 minutes)

```
1. Render Dashboard → daino-backend → Environment
2. Add: DB_QUERY_LOG = true
3. Add: LOG_REQUEST_TIMING = true
4. Save (auto-redeploys)
5. Check Logs tab in 2 minutes
```

---

## 📋 Interpretation Guide

### If you see:

**Duplicate API calls:**
→ Check React Query DevTools for multiple observers
→ Fix: Consolidate queries in parent component

**Requests >1 second:**
→ Check backend logs for slow queries
→ Fix: Add database indexes, optimize queries

**Many API calls (>10 per page):**
→ You have N+1 problem
→ Fix: Use batch endpoints we created

**Low cache hit rate (<50%):**
→ Redis might not be connected
→ Fix: Check /health/cache, verify REDIS_URL

**Large payloads (>1MB):**
→ Too much data returned
→ Fix: Add pagination, field selection

**High query count (>20 per request):**
→ N+1 in backend
→ Fix: Use batch queries, JOINs instead of loops

---

## 🎯 Priority Order

**Start here (highest impact):**

1. ✅ **Run browser console script** (finds duplicates instantly)
2. ✅ **Check Network tab** (visual overview)
3. ✅ **Enable DB_QUERY_LOG** (see slow queries)
4. ✅ **Check React Query DevTools** (duplicate query detection)
5. ✅ **Run Lighthouse** (overall metrics)

**30 minutes of debugging will reveal 80% of issues!**

---

## Real Example: Finding Your Bottleneck

**Scenario:** Product page loading in 5+ seconds

**Step 1:** Browser console script
```
Result: 15 API requests, 8 duplicates
→ Issue: Too many requests
```

**Step 2:** Network tab inspection
```
/api/translations/products/batch?ids=1  (450ms)
/api/translations/products/batch?ids=2  (420ms)
/api/translations/products/batch?ids=3  (380ms)
...
→ Issue: N+1 queries on translations
```

**Step 3:** React Query DevTools
```
['translation', 'product', '1'] - Observers: 1
['translation', 'product', '2'] - Observers: 1
['translation', 'product', '3'] - Observers: 1
→ Issue: Not using batch hook
```

**Fix:**
```javascript
// Instead of calling individual products:
const { data } = useBatchProductTranslations([id1, id2, id3], lang);

// Result: 1 request instead of 3
```

**After fix:** 15 requests → 3 requests, 5s → 1.2s ✅

---

## Summary: 3-Step Process

### 1. Identify (Use Tools)
- Browser console script
- Network tab
- React Query DevTools

### 2. Measure (Quantify Impact)
- How many duplicates?
- How slow?
- How many queries?

### 3. Fix (Apply Solutions)
- Use batch endpoints
- Add caching
- Add indexes
- Optimize queries

---

**🎯 START HERE:**

1. Open https://www..dainostore.com/public/hamid2/product/kenwood...
2. Press F12 → Console tab
3. Paste: scripts/browser-performance-check.js (full content)
4. Wait 5 seconds
5. See your bottlenecks!

Then check the detailed guide: **BOTTLENECK_IDENTIFICATION_GUIDE.md**

---

**Last Updated:** 2025-11-08
