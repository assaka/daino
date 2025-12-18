# DataLayer Event Collection Guide

Complete guide for understanding how analytics events are collected, tracked, and managed in your store.

---

## 🎯 Overview

Your store has **TWO tracking systems** working together:

### 1. Customer Activity Tracking (High-Level Events)
- **Purpose:** Business analytics (what users do)
- **Storage:** `customer_activities` table
- **Events:** Page views, product views, cart, checkout, orders, searches
- **View in:** `/admin/customer-activity`
- **DataLayer:** ✅ Yes, pushed to window.dataLayer for GTM

### 2. Heatmap Interaction Tracking (Detailed Behavior)
- **Purpose:** UX optimization (how users interact)
- **Storage:** `heatmap_interactions` table
- **Events:** Mouse moves, clicks (with coordinates), scrolls, hovers
- **View in:** `/admin/heatmaps` (visual overlay)
- **DataLayer:** ❌ No, only stored for heatmap visualization

**Both systems are integrated** but serve different purposes:
- Customer Activity = Business insights
- Heatmaps = UX insights

---

## 📊 Architecture

### Customer Activity Tracking
```
User Interaction (page view, add to cart, etc.)
         ↓
DataLayerManager.jsx (Frontend)
         ↓
   ┌────────────────┴────────────────┐
   ↓                                  ↓
window.dataLayer.push()        POST /api/customer-activity
   ↓                                  ↓
Google Tag Manager              Event Bus → Database
   ↓                                  ↓
GA4, Facebook Pixel          customer_activities table
   ↓                                  ↓
External Analytics            Admin: Customer Activity Page
```

### Heatmap Interaction Tracking
```
User Interaction (mouse move, click, scroll)
         ↓
HeatmapTracker.jsx (Frontend)
         ↓
POST /api/heatmap/track
         ↓
Event Bus → Database
         ↓
heatmap_interactions table
         ↓
Admin: Heatmaps Page (Visual Overlay)
```

**Key Difference:**
- **Customer Activity** → dataLayer → GTM → External analytics
- **Heatmap Interactions** → Direct to backend → Visualization only

**Why separate?**
- Heatmaps track EVERY mouse move (100s/1000s per session) = Too much for GTM
- Customer Activity tracks KEY events (5-20 per session) = Perfect for GTM/analytics

---

## 🔄 Automatic Event Collection

Your store **automatically** collects these events:

### 1. Page Views
**When:** Every page load
**DataLayer Event:**
```javascript
{
  event: 'page_view',
  timestamp: '2025-01-07T12:00:00Z',
  page_url: '/products/widget',
  page_title: 'Product Name - Store Name',
  referrer: 'https://google.com'
}
```

**Backend Storage:**
- activity_type: `'page_view'`
- page_url, referrer, timestamp

### 2. Product Views
**When:** User views product detail page
**DataLayer Event:**
```javascript
{
  event: 'view_item',
  timestamp: '2025-01-07T12:00:00Z',
  item_id: 'product-uuid',
  item_name: 'Product Name',
  item_category: 'Electronics',
  price: 99.99,
  currency: 'USD'
}
```

**Backend Storage:**
- activity_type: `'product_view'`
- product_id, page_url

### 3. Add to Cart
**When:** User adds product to cart
**DataLayer Event:**
```javascript
{
  event: 'add_to_cart',
  timestamp: '2025-01-07T12:00:00Z',
  item_id: 'product-uuid',
  item_name: 'Product Name',
  item_category: 'Electronics',
  price: 99.99,
  quantity: 1,
  currency: 'USD'
}
```

**Backend Storage:**
- activity_type: `'add_to_cart'`
- product_id, metadata: { quantity, price }

### 4. Remove from Cart
**When:** User removes product from cart
**DataLayer Event:**
```javascript
{
  event: 'remove_from_cart',
  item_id: 'product-uuid',
  item_name: 'Product Name',
  quantity: 1
}
```

**Backend Storage:**
- activity_type: `'remove_from_cart'`
- product_id

### 5. Checkout Started
**When:** User proceeds to checkout
**DataLayer Event:**
```javascript
{
  event: 'begin_checkout',
  timestamp: '2025-01-07T12:00:00Z',
  items: [...],  // All cart items
  value: 299.97,
  currency: 'USD'
}
```

**Backend Storage:**
- activity_type: `'checkout_started'`
- metadata: { cart_value, item_count }

### 6. Order Completed
**When:** Purchase is finalized
**DataLayer Event:**
```javascript
{
  event: 'purchase',
  transaction_id: 'order-uuid',
  value: 299.97,
  currency: 'USD',
  items: [...]
}
```

**Backend Storage:**
- activity_type: `'order_completed'`
- metadata: { order_id, order_total }

### 7. Search
**When:** User searches for products
**DataLayer Event:**
```javascript
{
  event: 'search',
  search_term: 'laptop',
  results_count: 24
}
```

**Backend Storage:**
- activity_type: `'search'`
- search_query: 'laptop'

---

## 📍 Where to Find Things

### Configuration (Tracking & Data Layer Page)
**URL:** `/admin/analytics` or `/admin/analytics-settings`

**What you can do:**
- ✅ Configure Google Tag Manager
- ✅ Set GTM container ID
- ✅ View current event collection (DataLayer Events tab)
- ✅ See event structure and templates
- ✅ Import/export configurations
- 🔜 Create custom events (coming soon)

### View Collected Data (Customer Activity Page)
**URL:** `/admin/customer-activity`

**What you can see:**
- ✅ All collected events in real-time
- ✅ Filter by event type (page_view, product_view, etc.)
- ✅ Filter by date range
- ✅ Search by session ID
- ✅ Pagination & export
- ✅ Statistics (total events, unique sessions, unique users)

---

## 🔧 How It Works

### Frontend (DataLayerManager.jsx)

Located at: `src/components/storefront/DataLayerManager.jsx`

**Key Functions:**

1. **pushToDataLayer(event)**
   ```javascript
   pushToDataLayer({
     event: 'custom_event',
     data: {...}
   });
   ```
   Pushes event to `window.dataLayer` for GTM

2. **trackEvent(eventName, eventData)**
   ```javascript
   trackEvent('newsletter_signup', {
     email: user.email,
     source: 'footer'
   });
   ```
   Convenience wrapper for pushToDataLayer

3. **trackActivity(activityType, data)**
   ```javascript
   trackActivity('product_view', {
     product_id: product.id,
     product_name: product.name
   });
   ```
   Sends event to backend AND dataLayer

**Pre-built Tracking Functions:**
- `trackProductView(product)` - Product page views
- `trackAddToCart(product, quantity)` - Cart additions
- `trackRemoveFromCart(product)` - Cart removals
- `trackPurchase(order)` - Order completions
- `trackSearch(searchTerm, resultCount)` - Product searches

### Backend Event Processing

1. **API Endpoint:** `POST /api/customer-activity`
2. **Validation:** Joi schema validation
3. **Rate Limiting:** 100 requests/minute
4. **Consent Check:** Respects cookie consent
5. **Event Bus:** Queued with retry logic
6. **Database:** Stored in `customer_activities` table

### Event Flow Example

```javascript
// 1. User adds product to cart
<button onClick={() => {
  addToCart(product);
  trackAddToCart(product, 1); // ← Triggers tracking
}}>
  Add to Cart
</button>

// 2. trackAddToCart() function
export const trackAddToCart = (product, quantity = 1) => {
  // Push to dataLayer (for GTM)
  trackEvent('add_to_cart', {
    item_id: product.id,
    item_name: product.name,
    price: product.price,
    quantity
  });

  // Send to backend (for database)
  trackActivity('add_to_cart', {
    product_id: product.id,
    metadata: { quantity, price: product.price }
  });
};

// 3. Result:
// ✅ window.dataLayer has the event (GTM can process it)
// ✅ Backend has stored it (queryable in Customer Activity)
```

---

## 🎨 Using DataLayer in Your Components

### Example 1: Track Custom Button Click

```jsx
import { trackEvent, trackActivity } from '@/components/storefront/DataLayerManager';

function PromoB anner() {
  const handleBannerClick = () => {
    // Push to dataLayer
    trackEvent('promo_click', {
      banner_title: 'Summer Sale',
      destination: '/sale'
    });

    // Optionally send to backend
    trackActivity('page_view', {
      page_url: '/sale',
      metadata: { source: 'promo_banner' }
    });
  };

  return <button onClick={handleBannerClick}>Shop Sale</button>;
}
```

### Example 2: Track Form Submission

```jsx
import { trackEvent } from '@/components/storefront/DataLayerManager';

function NewsletterForm() {
  const handleSubmit = async (email) => {
    // Track newsletter signup
    trackEvent('newsletter_signup', {
      email_hash: hashEmail(email), // Don't send PII to GTM
      form_location: 'footer',
      timestamp: new Date().toISOString()
    });

    // Submit form...
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Example 3: Track Scroll Depth

```jsx
import { trackEvent } from '@/components/storefront/DataLayerManager';

function ProductDescription() {
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / document.body.scrollHeight) * 100;

      if (scrollPercent >= 75 && !scrollTracked) {
        trackEvent('scroll_depth', {
          depth: 75,
          page_url: window.location.href
        });
        setScrollTracked(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
}
```

---

## 🔍 Viewing Collected Data

### In Customer Activity Page

1. **Navigate to** `/admin/customer-activity`
2. **Filter by activity type** - Select specific events
3. **Filter by date** - View events in time range
4. **Search by session** - Track individual user journeys
5. **Export data** - Download as CSV for analysis

### Event Details Shown

For each event you'll see:
- **Activity Type** - Badge showing event type
- **Page URL** - Where the event occurred
- **Session ID** - Unique session identifier
- **User ID** - If user is logged in
- **Product Details** - If event involves a product
- **Search Query** - For search events
- **Timestamp** - When it occurred

### Statistics Dashboard

At the top of Customer Activity page:
- **Total Activities** - All events collected
- **Unique Sessions** - Number of different visitors
- **Unique Users** - Logged-in users
- **Orders** - Completed purchase events

---

## 🚀 Future: Custom Event Configuration

The database and backend are ready for custom events. Soon you'll be able to:

### Create Custom Events via UI

```
Event Name: add_to_wishlist
Display Name: Add to Wishlist
Trigger: Click on .wishlist-button
Parameters:
  - product_id: {{product_id}}
  - product_name: {{product_name}}
  - category: {{category}}
```

### Use Event Templates

Choose from pre-configured templates:
- Newsletter Signup
- Add to Wishlist
- Scroll Depth Tracking
- Video Engagement
- Product Filter Used
- Promo Banner Click
- Quick View Opened
- Coupon Applied
- Live Chat Opened
- Size Guide Viewed

### Variable Replacement

Use placeholders that auto-fill:
- `{{product_id}}` - Current product ID
- `{{product_name}}` - Product name
- `{{category_name}}` - Category name
- `{{price}}` - Product price
- `{{page_url}}` - Current page URL
- `{{page_title}}` - Page title
- `{{user_id}}` - User ID (if logged in)

---

## 🧪 Testing Events

### Check DataLayer in Browser

```javascript
// Open browser console
console.log(window.dataLayer);

// Output:
[
  { event: 'page_view', timestamp: '...', page_url: '/products' },
  { event: 'add_to_cart', item_id: 'uuid', item_name: 'Widget', price: 99.99 },
  ...
]
```

### Listen to DataLayer Events

```javascript
// In browser console
window.addEventListener('dataLayerPush', (e) => {
  console.log('New event:', e.detail);
});
```

### Check Backend Storage

1. Go to `/admin/customer-activity`
2. Filter by session ID
3. See all events for that session

---

## 📈 Integration with GTM

### Automatic Integration

If GTM is enabled in `/admin/analytics`:
1. All dataLayer events automatically available in GTM
2. Create triggers in GTM based on event names
3. Set up tags to send to GA4, Facebook Pixel, etc.

### GTM Trigger Example

In Google Tag Manager:
```
Trigger Type: Custom Event
Event Name: add_to_cart

Tag: GA4 Event
Event Name: add_to_cart
Event Parameters:
  - item_id: {{dlv - item_id}}
  - item_name: {{dlv - item_name}}
  - price: {{dlv - price}}
```

---

## 🔐 Privacy & Consent

### Cookie Consent Integration

Events respect user consent:

```javascript
// If user hasn't consented to analytics:
// - Event still pushed to dataLayer
// - But PII is removed before backend storage
// - IP address, user agent, user ID = null
```

See `GDPR_CONSENT_GUIDE.md` for details.

---

## 📁 File Locations

### Frontend
- `src/components/storefront/DataLayerManager.jsx` - Event collection
- `src/hooks/useCookieConsent.js` - Consent checking
- `src/hooks/useABTest.js` - A/B test event tracking

### Backend
- `backend/src/routes/customer-activity.js` - Event storage API
- `backend/src/routes/custom-analytics-events.js` - Event configuration API
- `backend/src/services/analytics/EventBus.js` - Event processing
- `backend/src/models/CustomerActivity.js` - Data model
- `backend/src/models/CustomAnalyticsEvent.js` - Event config model

### Admin Pages
- `src/pages/admin/AnalyticsSettings.jsx` - **Configure** events & GTM
- `src/pages/admin/CustomerActivity.jsx` - **View** collected data

---

## 🛠️ Developer Guide

### Adding a New Event Type

1. **In your component:**
   ```jsx
   import { trackEvent, trackActivity } from '@/components/storefront/DataLayerManager';

   const handleCustomAction = () => {
     trackEvent('custom_action', {
       action_type: 'button_click',
       button_id: 'special-offer'
     });

     trackActivity('custom_action', {
       metadata: { action: 'special-offer-clicked' }
     });
   };
   ```

2. **View in Admin:**
   - Go to `/admin/customer-activity`
   - Filter by session or date
   - See your custom events

3. **Use in GTM:**
   - Create custom trigger for event name
   - Send to GA4/Facebook/etc.

### Event Naming Conventions

Follow Google Analytics 4 naming:
- Use **snake_case** (add_to_cart, not addToCart)
- Be specific (newsletter_footer_signup, not signup)
- Use standard names when possible:
  - `view_item` (not product_view)
  - `add_to_cart` (not cart_add)
  - `purchase` (not order_complete)

### Required Parameters

Minimum parameters for good tracking:
```javascript
{
  event: 'event_name',      // Required
  timestamp: '...',          // Auto-added
  ...your_custom_data       // Event-specific
}
```

---

## 📊 Analytics Queries

### Common Questions You Can Answer

With the collected data in Customer Activity page:

**1. What pages do users visit most?**
- Filter by: `activity_type = 'page_view'`
- Group by: page_url
- Sort by: count

**2. Which products are viewed most?**
- Filter by: `activity_type = 'product_view'`
- Group by: product_id
- See product names in results

**3. What's the add-to-cart rate?**
- Count: `activity_type = 'product_view'`
- Count: `activity_type = 'add_to_cart'`
- Calculate: (cart / views) * 100

**4. What are users searching for?**
- Filter by: `activity_type = 'search'`
- View: search_query column
- Identify: popular search terms

**5. Where do users drop off in checkout?**
- Filter by session_id
- Order by: timestamp
- See: event sequence

### Export for Advanced Analysis

1. Apply filters in Customer Activity
2. Click "Export" button
3. Download CSV
4. Analyze in Excel/Google Sheets/Python

---

## 🔮 Upcoming Features

### Custom Event Builder (In Development)

Soon you'll be able to create custom events via UI:

```
┌─────────────────────────────────────┐
│ Create Custom Event                 │
├─────────────────────────────────────┤
│ Event Name: *    [wishlist_add]     │
│ Display Name: *  [Add to Wishlist]  │
│ Description:     [Track wishlist...] │
│                                      │
│ Trigger Type: *  [Click ▼]          │
│ CSS Selector:    [.wishlist-btn]    │
│                                      │
│ Event Parameters:                    │
│  + product_id: {{product_id}}       │
│  + product_name: {{product_name}}   │
│                                      │
│ ☑ Send to Backend                   │
│ ☑ Enabled                            │
│                                      │
│ [Create Event]  [Cancel]            │
└─────────────────────────────────────┘
```

Features coming:
- Visual event builder
- Event templates library
- Variable picker ({{product_id}}, etc.)
- Trigger condition editor
- Event testing tool
- Event preview
- Bulk import/export

---

## 🎯 Best Practices

### 1. Track What Matters

✅ **Do track (Customer Activity Events):**
- User intent (searches, filters)
- Engagement (video views, scrolls)
- Conversions (add to cart, purchase)
- Errors (404s, failed searches)
- High-level interactions

✅ **Do track (Heatmap Interactions):**
- **Mouse movements** (essential for heatmap visualization)
  - Tracks x/y coordinates every few hundred milliseconds
  - Shows user attention and browsing patterns
  - Creates the actual "heat" in heatmaps
- **Clicks with coordinates** (where users click)
- **Scroll depth** (how far users scroll)
- **Hover events** (what users hover over)
- **Touch events** (mobile interactions)

**Important:** Mouse moves are ONLY for heatmaps, not sent to GTM/dataLayer

❌ **Don't track:**
- PII without consent (emails, passwords)
- Sensitive data (credit card numbers)
- Every keystroke (privacy concern)
- Mouse moves in Customer Activity (too much data for business analytics)

### 2. Use Descriptive Event Names

```javascript
// ✅ Good
trackEvent('newsletter_footer_signup', {...});
trackEvent('product_quick_view_opened', {...});

// ❌ Bad
trackEvent('click', {...});
trackEvent('event1', {...});
```

### 3. Include Context

```javascript
// ✅ Good - Has context
{
  event: 'filter_applied',
  filter_type: 'price',
  filter_value: '0-100',
  category: 'Electronics',
  page_url: '/category/electronics'
}

// ❌ Bad - No context
{
  event: 'filter_applied'
}
```

### 4. Respect Consent

```javascript
import { useCookieConsent } from '@/hooks/useCookieConsent';

const { hasAnalyticsConsent } = useCookieConsent();

if (hasAnalyticsConsent) {
  trackEvent('...'); // Only track with consent
}
```

---

## 📞 Need Help?

### Check These First

1. **Events not appearing in dataLayer?**
   - Check browser console for errors
   - Verify DataLayerManager is imported
   - Check `window.dataLayer` in console

2. **Events not in Customer Activity page?**
   - Check if backend is running
   - Verify network requests in DevTools
   - Check rate limiting (max 100/min)
   - Verify consent header is sent

3. **GTM not receiving events?**
   - Verify GTM container ID in `/admin/analytics`
   - Check GTM preview mode
   - Confirm dataLayer is populated

### Debug Mode

```javascript
// Enable debug logging
localStorage.setItem('analytics_debug', 'true');

// Check logs in console
// You'll see detailed event tracking info
```

---

## 🎉 Summary

✅ **Automatic collection** of 7 core ecommerce events
✅ **Dual tracking** - dataLayer (GTM) + backend (database)
✅ **Easy viewing** in Customer Activity admin page
✅ **GDPR compliant** with consent integration
✅ **Production-ready** with rate limiting and validation
✅ **Extensible** - ready for custom events

**Configuration:** `/admin/analytics` → DataLayer Events tab
**View Data:** `/admin/customer-activity`
**Integration:** Works seamlessly with GTM, GA4, Facebook Pixel

Your analytics event system is production-ready and collecting valuable insights! 🚀
