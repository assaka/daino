# A/B Testing Integration Guide
## For Config Slot-Based Pages

This guide explains how A/B testing integrates with your slot-based page architecture, allowing you to test different layouts, components, and configurations dynamically.

---

## Architecture Overview

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ Inject A/B Test Context  │ ◄── Session ID, Device Type, User ID
│ (Middleware)             │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Load Base Slot Config    │ ◄── From DB or static config
│ (Category/Product/Cart)  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Apply A/B Test Variants  │ ◄── Merge test configs
│ (SlotConfigABTesting)    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Render Page with Slots   │ ◄── Modified config
│ (React Components)       │
└──────────────────────────┘
```

---

## Quick Start

### 1. Backend Setup (Page Config Endpoint)

```javascript
// routes/page-config.js
const express = require('express');
const router = express.Router();
const { injectABTestContext, applyABTestVariants } = require('../middleware/abTestingMiddleware');

// Apply middleware globally
router.use(injectABTestContext);

// Get page configuration with A/B test variants applied
router.get('/:pageType/:pageId?', applyABTestVariants, async (req, res) => {
  const { pageType, pageId } = req.params;

  // Load base configuration (from DB or static config)
  const baseConfig = await loadPageConfig(pageType, pageId);

  // Attach to request for middleware
  req.baseSlotConfig = baseConfig;

  // The applyABTestVariants middleware has already:
  // 1. Loaded active tests for this page type
  // 2. Assigned user to variants
  // 3. Merged variant configs into req.slotConfig

  res.json({
    success: true,
    config: req.slotConfig, // Modified config with A/B test variants
    abTests: req.abTests // Active tests and variant assignments
  });
});

module.exports = router;
```

### 2. Frontend Setup (React Component)

```jsx
// pages/CategoryPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SlotRenderer } from '../components/SlotRenderer';
import { useABTesting } from '../hooks/useABTest';

function CategoryPage() {
  const { categoryId } = useParams();
  const [pageConfig, setPageConfig] = useState(null);

  useEffect(() => {
    // Fetch page config with A/B test variants applied
    fetch(`/api/page-config/category/${categoryId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPageConfig(data.config);

          // Log active A/B tests for debugging
          console.log('Active A/B Tests:', data.abTests);
        }
      });
  }, [categoryId]);

  if (!pageConfig) return <div>Loading...</div>;

  // Render slots with A/B test modifications applied
  return (
    <div className="category-page">
      <SlotRenderer config={pageConfig} />
    </div>
  );
}
```

---

## Use Cases & Examples

### Use Case 1: Test Different Hero CTAs

**Scenario**: Test "Shop Now" vs "Explore Collection" button text on category pages

```javascript
// Create test via API or admin panel
const test = {
  name: 'Hero CTA Button Test',
  store_id: 'store-123',
  variants: [
    {
      id: 'control',
      name: 'Control (Shop Now)',
      is_control: true,
      weight: 1,
      config: {} // No changes
    },
    {
      id: 'variant_1',
      name: 'Variant A (Explore Collection)',
      weight: 1,
      config: {
        slot_overrides: {
          'hero-slot': {
            props: {
              buttonText: 'Explore Collection',
              buttonColor: '#4ecdc4'
            }
          }
        }
      }
    }
  ],
  primary_metric: 'add_to_cart_rate',
  metadata: {
    target_pages: ['category']
  }
};
```

**How it works:**
1. User visits category page
2. Backend loads base slot config (with "Shop Now" button)
3. A/B test middleware assigns user to variant_1
4. Slot override merges new button text into hero-slot props
5. Frontend renders hero with "Explore Collection" button
6. Track conversions when user adds to cart

### Use Case 2: Test Product Card Layouts

**Scenario**: Test grid vs list view for product listings

```javascript
const test = {
  name: 'Product Card Layout Test',
  variants: [
    {
      id: 'control',
      name: 'Control (Grid)',
      is_control: true,
      weight: 1,
      config: {}
    },
    {
      id: 'variant_1',
      name: 'List View',
      weight: 1,
      config: {
        component_props: {
          'product-grid': {
            layout: 'list',
            columns: 1,
            showDescriptionPreview: true,
            imagePosition: 'left'
          }
        }
      }
    }
  ],
  metadata: {
    target_pages: ['category', 'search']
  }
};
```

### Use Case 3: Test Adding Trust Badges

**Scenario**: Test adding trust badges above "Add to Cart" button

```javascript
const test = {
  name: 'Trust Badges Test',
  variants: [
    {
      id: 'control',
      name: 'Control (No Badges)',
      is_control: true,
      weight: 1,
      config: {}
    },
    {
      id: 'variant_1',
      name: 'With Trust Badges',
      weight: 1,
      config: {
        slot_overrides: {
          'trust-badges': {
            enabled: true,
            component: 'TrustBadges',
            position: 5, // Above add to cart button
            props: {
              badges: [
                { icon: 'secure', text: 'Secure Checkout' },
                { icon: 'shipping', text: 'Free Shipping' },
                { icon: 'returns', text: '30-Day Returns' }
              ],
              layout: 'horizontal'
            }
          }
        }
      }
    }
  ],
  metadata: {
    target_pages: ['product']
  }
};
```

**Frontend Usage:**
```jsx
// The SlotRenderer automatically handles new slots added by variants
<SlotRenderer config={pageConfig} />

// Or manually check for variant:
const { variant } = useABTest('trust-badges-test');
{variant?.config?.slot_overrides?.['trust-badges']?.enabled && (
  <TrustBadges {...variant.config.slot_overrides['trust-badges'].props} />
)}
```

### Use Case 4: Test Complete Cart Page Redesign

**Scenario**: Test a completely new cart layout

```javascript
const test = {
  name: 'Cart Page Redesign',
  variants: [
    {
      id: 'control',
      name: 'Original Cart',
      is_control: true,
      weight: 1,
      config: {}
    },
    {
      id: 'variant_1',
      name: 'Redesigned Cart',
      weight: 1,
      config: {
        page_template: 'cart_v2', // Use different template
        slot_configuration: {
          page_template: 'cart_v2',
          slots: [
            {
              id: 'cart-header',
              component: 'CartHeader',
              props: { showProgressBar: true }
            },
            {
              id: 'cart-items',
              component: 'CartItemsCompact',
              props: { layout: 'compact' }
            },
            {
              id: 'recommended-products',
              component: 'CartRecommendations',
              props: { title: 'Complete Your Purchase', limit: 4 }
            },
            {
              id: 'cart-summary',
              component: 'CartSummarySticky',
              props: { position: 'sticky', showTrustBadges: true }
            }
          ]
        }
      }
    }
  ],
  metadata: {
    target_pages: ['cart']
  }
};
```

### Use Case 5: Test Checkout Flow Simplification

**Scenario**: Test single-page vs multi-step checkout

```javascript
const test = {
  name: 'Checkout Flow Test',
  variants: [
    {
      id: 'control',
      name: 'Multi-Step Checkout',
      is_control: true,
      weight: 1,
      config: {}
    },
    {
      id: 'variant_1',
      name: 'Single Page Checkout',
      weight: 1,
      config: {
        feature_flags: {
          single_page_checkout: true,
          express_checkout: true,
          guest_checkout_first: true
        },
        slot_overrides: {
          'checkout-steps': {
            enabled: false // Remove step indicator
          },
          'checkout-form': {
            component: 'CheckoutFormSinglePage',
            props: {
              showAllSections: true,
              collapsible: false
            }
          }
        }
      }
    }
  ],
  metadata: {
    target_pages: ['checkout']
  }
};
```

---

## Tracking Conversions

### Automatic Tracking

The system automatically tracks conversions for certain events:

```javascript
// In ABTestingService.js
// Automatically tracks "order_completed" as conversion for tests with that metric
async trackActivityEvent(event) {
  if (event.data.activity_type === 'order_completed') {
    // Find all active tests and mark conversion
    await this.trackConversion(testId, sessionId, orderValue);
  }
}
```

### Manual Tracking

```jsx
// Frontend - Track when user adds to cart
import { useABTest } from '../hooks/useABTest';

function ProductPage() {
  const { trackConversion } = useABTest('trust-badges-test');

  const handleAddToCart = async () => {
    // Add to cart logic...

    // Track conversion
    await trackConversion();
  };

  return (
    <button onClick={handleAddToCart}>Add to Cart</button>
  );
}
```

```jsx
// Track with value and custom metrics
const handlePurchase = async (orderTotal) => {
  await trackConversion(orderTotal, {
    items_count: cartItems.length,
    discount_used: hasDiscount
  });
};
```

---

## Configuration Merging Rules

### Priority Order (Highest to Lowest)

1. **Complete slot_configuration** - Completely replaces base config
2. **slot_overrides** - Merges into specific slots
3. **component_props** - Merges into component props only
4. **style_overrides** - Adds CSS overrides
5. **feature_flags** - Adds feature flags

### Merge Examples

**Base Config:**
```json
{
  "slots": [
    {
      "id": "hero",
      "component": "Hero",
      "props": {
        "title": "Welcome",
        "buttonText": "Shop Now",
        "backgroundColor": "#333"
      }
    }
  ]
}
```

**Variant with slot_overrides:**
```json
{
  "slot_overrides": {
    "hero": {
      "props": {
        "buttonText": "Explore Collection",
        "buttonColor": "#4ecdc4"
      }
    }
  }
}
```

**Merged Result:**
```json
{
  "slots": [
    {
      "id": "hero",
      "component": "Hero",
      "props": {
        "title": "Welcome",          // Original
        "buttonText": "Explore Collection", // Overridden
        "backgroundColor": "#333",    // Original
        "buttonColor": "#4ecdc4"     // Added
      }
    }
  ]
}
```

---

## API Reference

### Get Variant Assignment

```http
GET /api/ab-testing/variant/:testId
Headers: X-Session-ID: <session-id>

Response:
{
  "success": true,
  "data": {
    "test_id": "test-123",
    "variant_id": "variant_1",
    "variant_name": "Variant A",
    "config": { ... },
    "is_control": false
  }
}
```

### Get Active Tests for Page

```http
GET /api/ab-testing/active/:storeId?pageType=category
Headers: X-Session-ID: <session-id>

Response:
{
  "success": true,
  "data": [
    {
      "test_id": "test-123",
      "test_name": "Hero CTA Test",
      "variant_id": "variant_1",
      "variant_name": "Explore Collection",
      "config": { ... },
      "is_control": false
    }
  ]
}
```

### Track Conversion

```http
POST /api/ab-testing/conversion/:testId
Headers: X-Session-ID: <session-id>
Content-Type: application/json

Body:
{
  "value": 159.99,
  "metrics": {
    "items_count": 3,
    "category": "electronics"
  }
}

Response:
{
  "success": true,
  "data": {
    "assignment_id": "assignment-456"
  }
}
```

---

## Best Practices

### 1. Always Include Control Variant

```javascript
variants: [
  {
    id: 'control',
    name: 'Control',
    is_control: true,
    weight: 1,
    config: {} // No changes
  },
  // ... other variants
]
```

### 2. Use Descriptive Names

```javascript
{
  name: 'Hero CTA Button Test - Shop Now vs Explore',
  description: 'Testing whether "Explore Collection" increases engagement',
  hypothesis: 'Using "Explore" will increase click-through rate by 15%'
}
```

### 3. Set Appropriate Traffic Allocation

```javascript
{
  traffic_allocation: 0.5 // Only 50% of users see test
}
```

### 4. Define Clear Success Metrics

```javascript
{
  primary_metric: 'add_to_cart_rate',
  secondary_metrics: [
    'time_on_page',
    'product_views',
    'bounce_rate'
  ]
}
```

### 5. Target Specific Pages

```javascript
{
  metadata: {
    target_pages: ['category', 'search'], // Only these pages
    target_devices: ['desktop'] // Optional device targeting
  }
}
```

### 6. Set Minimum Sample Size

```javascript
{
  min_sample_size: 1000, // Need 1000 users per variant
  confidence_level: 0.95 // 95% confidence required
}
```

---

## Debugging

### Check Active Tests

```javascript
// In browser console
fetch('/api/ab-testing/active/your-store-id')
  .then(r => r.json())
  .then(console.log);
```

### View Applied Variants

```javascript
// Check what variants are applied to current page
console.log(pageConfig.abTests);
```

### Force Variant (Development Only)

```javascript
// Manually set variant in localStorage for testing
localStorage.setItem('force_variant_test-123', 'variant_1');
```

---

## Migration Path to Redis

The current implementation uses in-memory queues. When you're ready for Redis:

```javascript
// eventBus will automatically use Redis when available
// Just install Redis and update config:

const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// EventBus.js will detect Redis and use it for:
// - Event queue (persistent)
// - Deduplication cache (distributed)
// - Assignment cache (shared across servers)
```

---

## Summary

✅ **Slot-based pages work seamlessly with A/B testing**
- Variants can modify slot configurations
- Variants can override component props
- Variants can add/remove entire slots
- Variants can replace entire page templates

✅ **Easy to use from frontend**
- React hooks for variant assignment
- Automatic config merging
- Simple conversion tracking

✅ **Production-ready**
- Rate limiting and validation
- Event bus with retry logic
- Deduplication and idempotency
- Statistical analysis of results

✅ **Scalable architecture**
- Redis-ready design
- Caching at multiple levels
- Efficient batch processing
