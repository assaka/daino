# How Heatmaps Work - Complete Guide

## 🗺️ What Are Heatmaps?

Heatmaps are **visual overlays** that show where users click, move their mouse, and scroll on your pages. They use color coding (red = hot/popular, blue = cold/unused) to reveal user behavior patterns.

---

## 🎯 Your Heatmap System Architecture

### Two Tracking Systems

Your store has **TWO separate but complementary** tracking systems:

#### 1. **Customer Activity** (Business Analytics)
📊 **Purpose:** What users do (business insights)
📁 **Storage:** `customer_activities` table
📍 **View:** `/admin/customer-activity`
📤 **DataLayer:** YES (sent to GTM)

**Events:**
- Page views
- Product views (with full metadata)
- Add to cart (with product details, SKU, variant)
- Remove from cart
- Checkout started
- Order completed
- Searches

**Volume:** 5-20 events per session
**Data:** High-level business events with metadata

#### 2. **Heatmap Interactions** (UX Analytics)
🗺️ **Purpose:** How users interact (UX optimization)
📁 **Storage:** `heatmap_interactions` table
📍 **View:** `/admin/heatmaps`
📤 **DataLayer:** NO (too high volume)

**Events:**
- **Mouse movements** (x/y coordinates every few hundred milliseconds)
- Clicks (with exact coordinates)
- Scrolls (depth tracking)
- Hovers (element interactions)
- Touch events (mobile)

**Volume:** 100s-1000s events per session
**Data:** Low-level interaction coordinates

---

## 🔄 How Heatmaps Collect Data

### Step 1: Tracking Script Loads

When user visits your storefront:

```javascript
// HeatmapTracker component loads
<HeatmapTrackerComponent storeId={store.id} />
```

### Step 2: Event Listeners Attach

```javascript
// Mouse move tracking (throttled)
document.addEventListener('mousemove', (e) => {
  recordInteraction({
    interaction_type: 'mouse_move',
    x_coordinate: e.clientX,
    y_coordinate: e.clientY,
    timestamp: new Date()
  });
});

// Click tracking
document.addEventListener('click', (e) => {
  recordInteraction({
    interaction_type: 'click',
    x_coordinate: e.clientX,
    y_coordinate: e.clientY,
    element_selector: getSelector(e.target)
  });
});

// Scroll tracking
window.addEventListener('scroll', () => {
  recordInteraction({
    interaction_type: 'scroll',
    scroll_position: window.scrollY,
    scroll_depth_percent: (window.scrollY / document.body.scrollHeight) * 100
  });
});
```

### Step 3: Batching

Instead of sending EVERY mouse move immediately (would be thousands of requests):

```javascript
// Batch accumulates events
const batch = [];

recordInteraction(interaction) {
  batch.push(interaction);

  // Send when batch reaches 50 events OR 5 seconds pass
  if (batch.length >= 50 || timeoutReached) {
    sendBatch(batch);
    batch = [];
  }
}
```

### Step 4: Send to Backend

```javascript
POST /api/heatmap/track-batch
{
  interactions: [
    {
      session_id: 'session_xxx',
      page_url: '/products/laptop',
      interaction_type: 'mouse_move',
      x_coordinate: 450,
      y_coordinate: 320,
      viewport_width: 1920,
      viewport_height: 1080
    },
    // ... 49 more events
  ]
}
```

### Step 5: Processing & Storage

```javascript
Backend (Event Bus)
  ↓
Normalize coordinates (different screen sizes)
  ↓
Store in heatmap_interactions table
  ↓
Associate with session in heatmap_sessions table
```

### Step 6: Visualization

When admin views `/admin/heatmaps`:

```javascript
GET /api/heatmap/data/:storeId?page_url=/products/laptop

// Returns normalized coordinates
{
  heatmapData: [
    { normalized_x: 50%, normalized_y: 30%, interaction_count: 145 },
    { normalized_x: 75%, normalized_y: 45%, interaction_count: 89 },
    // ...
  ]
}
```

```javascript
// Frontend renders color overlay
coordinates.forEach(point => {
  const intensity = point.interaction_count;
  const color = intensityToColor(intensity); // Red = hot, Blue = cold

  drawCircle(point.x, point.y, color, opacity);
});
```

---

## 🎨 What You See in Heatmaps

### Click Heatmap
- **Red dots** = Most clicked areas
- **Blue dots** = Rarely clicked
- Shows: Buttons that work, CTAs that don't

### Movement Heatmap
- **Red areas** = Where eyes focus (mouse follows eyes)
- **Blue areas** = Ignored sections
- Shows: Content that engages, dead zones

### Scroll Heatmap
- **Color gradient** = How far users scroll
- **Fold line** = Where most users stop
- Shows: Content visibility, optimal placement

---

## 📊 How to Use Heatmaps

### 1. Enable Heatmap Tracking

Go to `/admin/heatmaps`

Toggle: **Enable Heatmap Tracking** = ON

### 2. Let Traffic Accumulate

- Need at least 100+ sessions for meaningful data
- More data = more accurate heatmaps
- Aim for 1000+ interactions per page

### 3. Select Page to Analyze

In `/admin/heatmaps`:
1. Enter page URL (e.g., `/products/laptop`)
2. Select date range
3. Choose interaction types (clicks, movements, scrolls)
4. Choose device type (desktop, mobile, tablet)

### 4. View Visualization

Heatmap overlay appears showing:
- Color intensity (red = popular, blue = unused)
- Click clusters
- Scroll depth
- Movement patterns

### 5. Make Decisions

**Example insights:**
- "CTA button is in cold zone" → Move it
- "Users don't scroll to footer" → Move important content up
- "Image gets lots of clicks but isn't clickable" → Make it clickable
- "Add to Cart button is missed" → Make it bigger/move it

---

## 🔍 What Data is Collected

### For Each Interaction:

```sql
-- heatmap_interactions table
{
  session_id: 'session_xxx',
  page_url: '/products/laptop',
  interaction_type: 'click',
  x_coordinate: 450,         -- Raw pixel position
  y_coordinate: 320,
  viewport_width: 1920,      -- User's screen size
  viewport_height: 1080,
  element_selector: '.add-to-cart-btn',
  element_tag: 'button',
  element_id: 'add-cart',
  element_class: 'btn btn-primary',
  timestamp_utc: '2025-01-07...',
  device_type: 'desktop',
  normalized_x: 23.4%,       -- Normalized for different screens
  normalized_y: 29.6%
}
```

### Why Normalize Coordinates?

Users have different screen sizes:
- Desktop: 1920x1080
- Laptop: 1366x768
- Mobile: 375x667

Normalization converts to percentages:
```javascript
normalized_x = (x_coordinate / viewport_width) * 100
normalized_y = (y_coordinate / viewport_height) * 100
```

This allows overlaying data from different devices!

---

## 🎨 Heatmap Types

### 1. Click Heatmap
**Shows:** Where users click
**Use for:**
- Button placement optimization
- CTA effectiveness
- Finding confusing UI

### 2. Movement Heatmap
**Shows:** Mouse movement patterns (proxy for eye tracking)
**Use for:**
- Content engagement
- Reading patterns
- Visual hierarchy

### 3. Scroll Heatmap
**Shows:** How far users scroll
**Use for:**
- Content placement
- Above/below fold optimization
- Page length decisions

### 4. Attention Heatmap
**Shows:** Time spent on elements (hover duration)
**Use for:**
- Content interest
- Confusion points (long hovers)
- Engagement metrics

---

## 📍 Where Everything Lives

### Frontend Tracking

**File:** `src/components/admin/heatmap/HeatmapTracker.jsx`

```jsx
// Automatically tracks interactions
<HeatmapTrackerComponent storeId={store.id} />

// Attached to your pages via layout/wrapper
```

### Backend API

**Routes:** `backend/src/routes/heatmap.js`

```javascript
POST /api/heatmap/track         // Single interaction
POST /api/heatmap/track-batch   // Batch of interactions
GET  /api/heatmap/data/:storeId // Get heatmap data for visualization
```

### Database

**Tables:**
- `heatmap_interactions` - Individual interaction events
- `heatmap_sessions` - Session aggregates

**Models:**
- `backend/src/models/HeatmapInteraction.js`
- `backend/src/models/HeatmapSession.js`

### Visualization

**File:** `src/components/admin/heatmap/HeatmapVisualization.jsx`

Renders the actual heatmap overlay using Canvas API or SVG.

---

## 🚀 Quick Start

### Enable Heatmaps

1. Go to `/admin/heatmaps`
2. Toggle **Enable Heatmap Tracking** = ON
3. Visit your storefront pages
4. Browse normally (click, scroll, move mouse)
5. Return to `/admin/heatmaps`
6. Enter page URL to visualize
7. See color overlay showing interaction patterns!

---

## 🔬 Technical Details

### Throttling

Mouse movements are throttled to prevent overwhelming the server:

```javascript
let lastCapture = 0;
const THROTTLE_MS = 100; // Capture every 100ms max

document.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastCapture < THROTTLE_MS) return;

  lastCapture = now;
  recordInteraction({ ... });
});
```

### Batching

Events are batched before sending:
- **Batch size:** 50 interactions
- **Batch timeout:** 5 seconds
- **Prevents:** 1000s of individual HTTP requests

### Viewport Normalization

Coordinates are normalized so heatmaps work across devices:

```javascript
// Desktop user: 1920x1080, clicked at (960, 540)
normalized_x = (960 / 1920) * 100 = 50%
normalized_y = (540 / 1080) * 100 = 50%

// Mobile user: 375x667, clicked at (187.5, 333.5)
normalized_x = (187.5 / 375) * 100 = 50%
normalized_y = (333.5 / 667) * 100 = 50%

// Both users clicked the SAME element (center of screen)!
```

---

## 🎯 Heatmaps vs Customer Activity

### When to Use Each

| Question | Use This |
|----------|----------|
| "What products are popular?" | Customer Activity |
| "Where do users click on product page?" | Heatmaps |
| "How many add-to-carts today?" | Customer Activity |
| "Is my CTA button visible?" | Heatmaps (scroll depth) |
| "What are users searching for?" | Customer Activity |
| "Do users see our trust badges?" | Heatmaps (attention/scroll) |
| "What's our conversion rate?" | Customer Activity |
| "Is our layout confusing?" | Heatmaps (movement patterns) |

### Complementary Insights

**Customer Activity tells you:**
- User added Product X to cart (WHAT)
- 50 products viewed today (HOW MANY)
- Conversion rate is 2.5% (BUSINESS METRIC)

**Heatmaps tell you:**
- User's mouse hovered over "Add to Cart" for 5 seconds before clicking (WHY - hesitation?)
- 80% of users don't scroll past hero image (UX PROBLEM)
- Product images get more clicks than product names (DESIGN INSIGHT)

---

## 🎉 Summary

### Heatmaps = Visual UX Analytics

✅ **Track:** Mouse moves, clicks, scrolls with exact coordinates
✅ **Batch:** 50 events per request (efficient)
✅ **Normalize:** Works across all screen sizes
✅ **Visualize:** Color overlay showing hot/cold zones
✅ **Purpose:** UX optimization, layout decisions
✅ **View:** `/admin/heatmaps`

### Customer Activity = Business Analytics

✅ **Track:** Page views, cart, orders with full product metadata
✅ **Store:** Enhanced data (SKU, variant, brand, quantity, value)
✅ **DataLayer:** Sent to GTM for external analytics
✅ **Purpose:** Conversion tracking, product performance
✅ **View:** `/admin/customer-activity` (with dashboard!)

### Together They Power

- **Customer Activity** = Know WHAT users do
- **Heatmaps** = Understand HOW they do it
- **Combined** = Complete picture for optimization

Your analytics system is now world-class! 🚀
