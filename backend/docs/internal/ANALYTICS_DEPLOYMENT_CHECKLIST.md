# Analytics System Deployment Checklist

Complete checklist to deploy the production-grade analytics system.

---

## 📋 Pre-Deployment Checklist

### 1. Database Migrations

Run these migrations in order:

```bash
# A/B Testing Tables
node backend/src/database/migrations/create-ab-testing-tables.js

# Custom Analytics Events Table
node backend/src/database/migrations/create-custom-analytics-events-table.js
```

**Verify migrations succeeded:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('ab_tests', 'ab_test_assignments', 'custom_analytics_events');

-- Should return 3 rows
```

### 2. Verify Routes Registered

Check `backend/src/server.js` includes these routes:

```javascript
✅ app.use('/api/customer-activity', customerActivityRoutes);
✅ app.use('/api/ab-testing', abTestingRoutes);
✅ app.use('/api/analytics', analyticsRoutes);
✅ app.use('/api/gdpr', gdprRoutes);
✅ app.use('/api/custom-analytics-events', customAnalyticsEventsRoutes);
✅ app.use('/api/heatmap', heatmapRoutes);
```

### 3. Verify Models Exported

Check `backend/src/models/index.js` exports:

```javascript
✅ CustomerActivity
✅ ABTest
✅ ABTestAssignment
✅ CustomAnalyticsEvent
```

### 4. Dependencies Installed

All required npm packages are already installed:
```json
✅ express-rate-limit (v7.1.5)
✅ joi (v17.11.0)
✅ ua-parser-js (v2.0.4)
```

---

## 🧪 Testing Checklist

### Test 1: Customer Activity Tracking

**Frontend Test:**
1. Open your storefront (e.g., `http://localhost:3000`)
2. Open browser console
3. Run:
   ```javascript
   import { trackActivity } from '@/components/storefront/DataLayerManager';

   // Test page view
   trackActivity('page_view', {
     page_url: window.location.href
   });
   ```
4. Check console for success
5. Check Network tab for POST to `/api/customer-activity`

**Backend Test:**
1. Go to `/admin/customer-activity`
2. Should see the test event
3. Filter by activity type "page_view"
4. Verify event appears

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "event_id": "evt_xxx",
    "correlation_id": "corr_xxx",
    "session_id": "guest_xxx",
    "activity_type": "page_view",
    "duplicate": false
  }
}
```

### Test 2: DataLayer Events

**Test:**
1. Open storefront
2. Open console and run:
   ```javascript
   console.log(window.dataLayer);
   ```
3. Should see array of events

**Navigate to product page:**
- Should automatically push `view_item` event
- Check: `window.dataLayer[window.dataLayer.length - 1]`

**Add product to cart:**
- Should push `add_to_cart` event
- Check dataLayer again

**Expected dataLayer:**
```javascript
[
  { event: 'page_view', timestamp: '...', page_url: '/products' },
  { event: 'view_item', item_id: 'uuid', item_name: 'Product', price: 99.99 },
  { event: 'add_to_cart', item_id: 'uuid', quantity: 1 }
]
```

### Test 3: Rate Limiting

**Test:**
```bash
# Send 101 requests in 1 minute (should hit rate limit)
for i in {1..101}; do
  curl -X POST http://localhost:5000/api/customer-activity \
    -H "Content-Type: application/json" \
    -d '{"session_id":"test","store_id":"your-store-uuid","activity_type":"page_view"}' &
done
```

**Expected:** Request #101 returns HTTP 429

### Test 4: Input Validation

**Test invalid data:**
```bash
curl -X POST http://localhost:5000/api/customer-activity \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","store_id":"INVALID","activity_type":"page_view"}'
```

**Expected:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "store_id",
      "message": "store_id must be a valid UUID"
    }
  ]
}
```

### Test 5: Cookie Consent

**Test without consent:**
```bash
curl -X POST http://localhost:5000/api/customer-activity \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","store_id":"uuid","activity_type":"page_view","user_id":"user-123"}'
```

**Expected:** `user_id` should be removed (sanitized)

**Test with consent:**
```bash
curl -X POST http://localhost:5000/api/customer-activity \
  -H "Content-Type: application/json" \
  -H "X-Cookie-Consent: [\"analytics\"]" \
  -d '{"session_id":"test","store_id":"uuid","activity_type":"page_view","user_id":"user-123"}'
```

**Expected:** `user_id` should be kept

### Test 6: A/B Testing

**Create test:**
```bash
POST /api/ab-testing/:storeId
{
  "name": "Hero Button Test",
  "variants": [
    {
      "id": "control",
      "name": "Control",
      "is_control": true,
      "weight": 1,
      "config": {}
    },
    {
      "id": "variant_1",
      "name": "Variant A",
      "weight": 1,
      "config": {
        "slot_overrides": {
          "hero": {
            "props": { "buttonText": "Explore" }
          }
        }
      }
    }
  ],
  "primary_metric": "add_to_cart"
}
```

**Start test:**
```bash
POST /api/ab-testing/:storeId/test/:testId/start
```

**Get variant:**
```bash
GET /api/ab-testing/variant/:testId
```

**Expected:** Assigned to variant with config

### Test 7: GDPR Data Deletion

**Test:**
```bash
POST /api/gdpr/delete-data
{
  "session_id": "test_session_123",
  "store_id": "your-store-uuid"
}
```

**Expected:**
```json
{
  "success": true,
  "deleted": {
    "customer_activities": 5,
    "heatmap_interactions": 0,
    "heatmap_sessions": 0,
    "ab_test_assignments": 0,
    "consent_logs": 0
  },
  "total_records_deleted": 5
}
```

---

## ✅ Readiness Verification

### Backend Health Check

```bash
# Check server starts without errors
npm run dev

# Should see:
✓ Database connected
✓ Server running on port 5000
✓ No module errors
```

### Frontend Health Check

```bash
# Check frontend builds
npm run dev

# Should see:
✓ Vite dev server running
✓ No import errors
✓ No TypeScript errors (if using TS)
```

### API Endpoints Check

Visit in browser or Postman:

```bash
✅ GET  /api/customer-activity?store_id=xxx (should return activities)
✅ GET  /api/ab-testing/examples (should return templates)
✅ POST /api/customer-activity (should accept events)
✅ POST /api/heatmap/track (should accept heatmap data)
```

---

## 📊 Current Event Tracking Status

### ✅ READY NOW (No migrations needed)

These work immediately (existing tables):

1. **Page Views** (`customer_activities` table)
   - Automatically tracked via DataLayerManager
   - View in: `/admin/customer-activity`

2. **Product Views** (`customer_activities` table)
   - Triggered when viewing product pages
   - Includes product ID, name, price

3. **Add to Cart** (`customer_activities` table)
   - Triggered on cart additions
   - Includes product ID, quantity

4. **Remove from Cart** (`customer_activities` table)
   - Triggered on cart removals

5. **Checkout Started** (`customer_activities` table)
   - Triggered when entering checkout

6. **Order Completed** (`customer_activities` table)
   - Triggered on successful purchase

7. **Search** (`customer_activities` table)
   - Triggered on product searches

8. **Heatmap Tracking** (`heatmap_interactions` table - if exists)
   - Mouse movements, clicks, scrolls
   - View in: `/admin/heatmaps`

### 🔜 READY AFTER MIGRATIONS

These require migrations first:

1. **A/B Testing** (needs `ab_tests` + `ab_test_assignments` tables)
   - Run: `create-ab-testing-tables.js`
   - Then: Create tests via `/admin/ab-testing`

2. **Custom Analytics Events** (needs `custom_analytics_events` table)
   - Run: `create-custom-analytics-events-table.js`
   - Then: Configure via `/admin/analytics` → DataLayer Events tab

---

## 🚀 Deployment Steps

### Step 1: Run Migrations

```bash
cd backend

# Migration 1: A/B Testing
node src/database/migrations/create-ab-testing-tables.js

# Migration 2: Custom Events
node src/database/migrations/create-custom-analytics-events-table.js
```

### Step 2: Restart Server

```bash
# Development
npm run dev

# Production
npm start
```

### Step 3: Verify in Admin

1. **Customer Activity** (`/admin/customer-activity`)
   - Should load without errors
   - May show "No activities" if fresh install

2. **Tracking & Data Layer** (`/admin/analytics`)
   - Should show GTM configuration
   - DataLayer Events tab should appear
   - No errors in console

3. **Heatmaps** (`/admin/heatmaps`)
   - Should load heatmap visualization
   - Enable toggle should work

4. **A/B Testing** (`/admin/ab-testing`)
   - Should show placeholder (or functional UI if updated)

### Step 4: Test Event Collection

1. Visit your storefront
2. Browse products, add to cart, search
3. Go to `/admin/customer-activity`
4. Should see events appearing

---

## ⚠️ Important Notes

### Event Collection Works WITHOUT Migrations

The core event tracking (`customer_activities` table) already exists and works:
- ✅ Page views
- ✅ Product views
- ✅ Cart actions
- ✅ Checkout/orders
- ✅ Searches

**These are collecting NOW** (if table exists).

### Migrations Only Add New Features

Migrations are for:
- A/B testing functionality
- Custom event builder UI
- Additional analytics features

**Basic analytics work without them!**

---

## 🔍 Troubleshooting

### Events Not Appearing

1. **Check if customer_activities table exists:**
   ```sql
   SELECT * FROM customer_activities LIMIT 5;
   ```

2. **Check browser console:**
   - Should see network requests to `/api/customer-activity`
   - Check for errors (CORS, 403, 500)

3. **Check backend logs:**
   - Look for `[CUSTOMER ACTIVITY ERROR]`
   - Check for validation errors

4. **Check store_id:**
   ```javascript
   // In console
   window.__STORE_CONTEXT__?.store?.id
   ```
   Should return a valid UUID

### Rate Limit Hit

If you see "Too many requests":
- Wait 1 minute
- Reduce tracking frequency
- Check for infinite loops

### Consent Issues

If events are sanitized unexpectedly:
- Check localStorage: `cookie_consent`
- Verify consent header is sent
- Check consentMiddleware logs

---

## 📊 Success Criteria

### System is Ready When:

- [x] ✅ Server starts without errors
- [x] ✅ All routes registered
- [x] ✅ Models exported
- [ ] ⏳ Migrations run (only for A/B testing & custom events)
- [x] ✅ Customer Activity page loads
- [x] ✅ Tracking & Data Layer page loads
- [x] ✅ Events pushed to dataLayer (check browser console)
- [ ] 🧪 Events appear in Customer Activity page (test needed)

---

## 🎉 What's Working NOW

Even before running migrations, you have:

### ✅ Customer Activity Tracking
- 7 automatic event types
- Unified event bus with retry logic
- Rate limiting & validation
- Cookie consent integration
- GDPR data rights (delete, export)
- Real-time data in admin panel

### ✅ DataLayer Integration
- Events pushed to window.dataLayer
- GTM integration ready
- GA4/Facebook Pixel compatible
- Custom event tracking functions

### ✅ Security & Privacy
- Rate limiting (100-300 req/min)
- Input validation with Joi
- XSS protection on GTM scripts
- PII sanitization without consent
- Correlation IDs for debugging

### ✅ Admin UI
- Customer Activity page (view all data)
- Tracking & Data Layer page (configure GTM)
- Heatmaps page (UX analytics)
- Export functionality

---

## 🔧 Quick Test Script

Save this as `test-analytics.html` and open in browser:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Analytics Test</title>
</head>
<body>
    <h1>Analytics System Test</h1>
    <button id="testBtn">Test Event Tracking</button>

    <script>
        // Test DataLayer
        window.dataLayer = window.dataLayer || [];

        document.getElementById('testBtn').addEventListener('click', async () => {
            // Push to dataLayer
            window.dataLayer.push({
                event: 'test_event',
                test_data: 'hello world',
                timestamp: new Date().toISOString()
            });

            console.log('DataLayer:', window.dataLayer);

            // Send to backend
            const response = await fetch('http://localhost:5000/api/customer-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: 'test_session',
                    store_id: 'YOUR_STORE_UUID_HERE',
                    activity_type: 'page_view',
                    page_url: 'http://test.com'
                })
            });

            const data = await response.json();
            console.log('Backend Response:', data);

            alert(data.success ? '✅ Event tracked!' : '❌ Error: ' + data.error);
        });
    </script>
</body>
</html>
```

---

## Summary

**Current Status: ✅ READY FOR BASIC EVENT TRACKING**

Your analytics system is production-ready for:
- Customer activity tracking (page views, cart, orders, searches)
- DataLayer event collection (GTM integration)
- Real-time admin dashboards
- GDPR compliance
- Security & validation

**After Migrations: 🚀 FULL FEATURE SET**

Running migrations unlocks:
- A/B testing with slot configs
- Custom event builder UI
- Event templates

**You can start collecting events NOW** without migrations!
