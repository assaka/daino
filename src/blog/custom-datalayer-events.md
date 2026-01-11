# Custom DataLayer Events for Advanced Tracking

Custom DataLayer events allow you to track specific user interactions on your storefront and send that data to Google Tag Manager, analytics platforms, and marketing tools. This guide covers everything from basic setup to advanced tracking strategies.

## Table of Contents

1. [What is the DataLayer?](#what-is-the-datalayer)
2. [Built-in Events (Always Active)](#built-in-events-always-active)
3. [Programmatic Tracking API](#programmatic-tracking-api)
4. [Checkout Funnel Tracking](#checkout-funnel-tracking)
5. [Creating Custom Events](#creating-custom-events)
6. [Trigger Types Explained](#trigger-types-explained)
7. [Using Event Parameters](#using-event-parameters)
8. [Connecting to Google Tag Manager](#connecting-to-google-tag-manager)
9. [Best Practices](#best-practices)

---

## What is the DataLayer?

The `dataLayer` is a JavaScript array that stores and transfers data between your website and Google Tag Manager (GTM). When events occur on your storefront, they're "pushed" to the dataLayer, where GTM can read them and trigger tags accordingly.

```javascript
// Example dataLayer push
window.dataLayer.push({
  event: 'add_to_cart',
  ecommerce: {
    currency: 'USD',
    value: 29.99,
    items: [{
      item_id: 'SKU_12345',
      item_name: 'Blue Widget',
      price: 29.99,
      quantity: 1
    }]
  }
});
```

DainoStore automatically manages the dataLayer for you, pushing events when customers interact with your store.

---

## Built-in Events (Always Active)

DainoStore automatically tracks essential e-commerce events. These are always active and follow Google's Enhanced Ecommerce (GA4) specification:

### Core Ecommerce Events

| Event | When It Fires | Data Included |
|-------|--------------|---------------|
| `page_view` | Every page load | Page title, URL, store info |
| `view_item` | Product detail pages | Full product data |
| `view_item_list` | Category/collection pages | Product list data |
| `select_item` | Product click in lists | Product and position |
| `add_to_cart` | Add to cart action | Product, quantity, variant |
| `remove_from_cart` | Remove from cart | Product and quantity |
| `view_cart` | Cart page viewed | All cart items, total |
| `begin_checkout` | Checkout started | Cart items and value |
| `purchase` | Order completed | Full order details |
| `search` | Product search | Query and results count |

### Checkout Funnel Events

| Event | When It Fires | Data Included |
|-------|--------------|---------------|
| `add_shipping_info` | Shipping method selected | Shipping tier, cart items, total |
| `add_payment_info` | Payment method selected | Payment type, cart items, coupon |
| `checkout_progress` | Checkout step completed | Step number, step name, cart data |

### Engagement Events

| Event | When It Fires | Data Included |
|-------|--------------|---------------|
| `add_to_wishlist` | Product added to wishlist | Product data |
| `view_promotion` | Promotion banner viewed | Promotion details |
| `select_promotion` | Promotion clicked | Promotion details |
| `quick_view` | Quick view opened | Product data |

### Coupon Events

| Event | When It Fires | Data Included |
|-------|--------------|---------------|
| `coupon_applied` | Coupon successfully applied | Coupon code, discount, cart total |
| `coupon_removed` | Coupon removed from cart | Coupon code, cart total |

### Other Events

| Event | When It Fires | Data Included |
|-------|--------------|---------------|
| `newsletter_signup` | Newsletter form submitted | Form location |
| `filter_applied` | Product filter used | Filter type, value, results count |

All events are automatically pushed to `window.dataLayer` and tracked in customer activity logs.

---

## Programmatic Tracking API

DainoStore exposes a global `window.daino` object for programmatic tracking. This is useful for custom integrations or slot-based components.

### Available Methods

```javascript
// Core tracking
window.daino.trackEvent(eventName, eventData)
window.daino.trackActivity(activityType, data)
window.daino.pushToDataLayer(event)

// Product tracking
window.daino.trackProductView(product)
window.daino.trackProductImpressions(products, listName)
window.daino.trackProductClick(product, position, listName)
window.daino.trackAddToCart(product, quantity, variant)
window.daino.trackRemoveFromCart(product, quantity)
window.daino.trackViewCart(cartItems, cartTotal)
window.daino.trackQuickView(product)

// Checkout tracking
window.daino.trackBeginCheckout(cartItems, cartTotal)
window.daino.trackCheckoutStep(stepNumber, stepName, cartItems, cartTotal, additionalData)
window.daino.trackShippingMethodSelected(shippingMethod, cartItems, cartTotal)
window.daino.trackPaymentMethodSelected(paymentMethod, cartItems, cartTotal, couponCode)
window.daino.trackPurchase(order)

// Engagement tracking
window.daino.trackAddToWishlist(product)
window.daino.trackSearch(query, resultsCount, filters)
window.daino.trackPromotionView(promotions)
window.daino.trackPromotionClick(promotion)
window.daino.trackNewsletterSignup(source)
window.daino.trackFilterApplied(filterType, filterValue, resultsCount)
window.daino.trackCouponApplied(couponCode, discountAmount, cartTotal)
window.daino.trackCouponRemoved(couponCode, cartTotal)
```

### Usage Examples

#### Track a Product View

```javascript
window.daino?.trackProductView({
  id: 'prod_123',
  name: 'Blue Widget',
  price: 29.99,
  category_name: 'Widgets',
  brand: 'Acme',
  sku: 'SKU-001'
});
```

#### Track Add to Cart

```javascript
window.daino?.trackAddToCart(
  {
    id: 'prod_123',
    name: 'Blue Widget',
    price: 29.99,
    category_name: 'Widgets'
  },
  2,  // quantity
  { id: 'var_456', name: 'Large / Blue' }  // optional variant
);
```

#### Track Checkout Step

```javascript
window.daino?.trackCheckoutStep(
  2,  // step number (1-indexed)
  'Shipping Information',
  cartItems,
  cartTotal,
  {
    shipping_method: 'Express',
    coupon_code: 'SAVE10'
  }
);
```

#### Track Shipping Method Selection

```javascript
window.daino?.trackShippingMethodSelected(
  {
    name: 'Express Shipping',
    cost: 9.99,
    tier: 'express'
  },
  cartItems,
  cartTotal
);
```

#### Track Payment Method Selection

```javascript
window.daino?.trackPaymentMethodSelected(
  {
    name: 'Credit Card',
    type: 'stripe',
    code: 'stripe'
  },
  cartItems,
  cartTotal,
  'SAVE10'  // optional coupon code
);
```

> **Note:** Always use optional chaining (`?.`) when calling `window.daino` methods to handle cases where the DataLayerManager hasn't initialized yet.

---

## Checkout Funnel Tracking

DainoStore provides comprehensive checkout funnel tracking to help you understand where customers drop off in the purchase process.

### Checkout Steps

The checkout process is tracked with step numbers:

| Step | Name | Event |
|------|------|-------|
| 1 | Cart View | `view_cart` |
| 2 | Begin Checkout | `begin_checkout` |
| 3 | Shipping Info | `checkout_progress` + `add_shipping_info` |
| 4 | Payment Info | `checkout_progress` + `add_payment_info` |
| 5 | Order Review | `checkout_progress` |
| 6 | Purchase | `purchase` |

### Data Captured at Each Step

#### Begin Checkout (`begin_checkout`)

```javascript
{
  event: 'begin_checkout',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    items: [
      {
        item_id: 'prod_123',
        item_name: 'Blue Widget',
        price: 29.99,
        quantity: 2
      }
    ]
  }
}
```

#### Shipping Method Selected (`add_shipping_info`)

```javascript
{
  event: 'add_shipping_info',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    shipping_tier: 'Express Shipping',
    items: [/* cart items */]
  }
}
```

#### Payment Method Selected (`add_payment_info`)

```javascript
{
  event: 'add_payment_info',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    payment_type: 'Credit Card',
    coupon: 'SAVE10',
    items: [/* cart items */]
  }
}
```

#### Checkout Progress (`checkout_progress`)

```javascript
{
  event: 'checkout_progress',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    checkout_step: 3,
    checkout_step_name: 'Shipping Method',
    items: [/* cart items */],
    shipping_method: 'Express',
    payment_method: 'stripe',
    coupon_code: 'SAVE10'
  }
}
```

### Setting Up Checkout Funnels in GA4

1. In GA4, go to **Configure > Events**
2. Create a funnel report using:
   - `begin_checkout` as the first step
   - `add_shipping_info` as shipping step
   - `add_payment_info` as payment step
   - `purchase` as conversion

This lets you visualize where customers abandon the checkout process.

---

## Creating Custom Events

To create a custom event for tracking specific user interactions:

### Step 1: Navigate to Custom Events

1. Go to **Analytics** in your admin sidebar (or visit `/admin/analytics`)
2. Click the **DataLayer Events** tab
3. Click **+ New Event** button

### Step 2: Configure the Event

Fill in the required fields:

- **Event Name**: Technical name used in dataLayer (e.g., `wishlist_add`)
- **Display Name**: Human-readable name (e.g., "Add to Wishlist")
- **Description**: What this event tracks
- **Trigger Type**: How the event is triggered (see next section)
- **Category**: Group events by type (ecommerce, engagement, conversion, navigation)

### Step 3: Set the Trigger Selector

For click and form triggers, specify which elements trigger the event:

```css
/* Examples of CSS selectors */
.wishlist-button           /* Class selector */
#newsletter-form           /* ID selector */
[data-track="video-play"]  /* Attribute selector */
button.add-review          /* Combined selector */
```

### Step 4: Add Event Parameters

Define what data to capture with each event:

```json
{
  "item_id": "{{product_id}}",
  "item_name": "{{product_name}}",
  "source": "product_page"
}
```

Use `{{variable}}` syntax to capture dynamic values from the page context.

### Step 5: Configure Options

- **Enabled**: Toggle the event on/off
- **Fire Once Per Session**: Prevent duplicate events in the same session
- **Log to Backend**: Save the event to your customer_activities table for reporting
- **Priority**: Control execution order (higher = first)

---

## Trigger Types Explained

Choose the appropriate trigger type for your tracking needs:

### Click Trigger

Fires when a user clicks an element matching your CSS selector.

**Best for:**
- Add to wishlist buttons
- Share buttons
- Video play buttons
- Navigation links
- CTA buttons

**Example:**
```
Trigger Type: Click
CSS Selector: .wishlist-button, [data-action="wishlist"]
```

### Page Load Trigger

Fires when a page matching certain conditions loads.

**Best for:**
- Special page views (promo pages, landing pages)
- Exit intent tracking
- Category-specific tracking

### Form Submit Trigger

Fires when a form is submitted.

**Best for:**
- Newsletter signups
- Contact form submissions
- Review submissions
- Account registrations

**Example:**
```
Trigger Type: Form Submit
CSS Selector: #newsletter-form, .contact-form
```

### Scroll Trigger

Fires when users scroll to a certain depth on the page.

**Best for:**
- Content engagement
- Reading progress
- Lazy-load triggers

### Timer Trigger

Fires after a specified time on page.

**Best for:**
- Engagement time tracking
- Delayed popups
- Session duration events

### Custom (Code) Trigger

For advanced cases where you need custom JavaScript logic.

### Automatic Trigger

Fires based on system events (order completion, account creation, etc.)

---

## Using Event Parameters

Event parameters let you capture context about each interaction.

### Static Parameters

Fixed values that don't change:

```json
{
  "event_category": "engagement",
  "source": "product_page",
  "version": "2.0"
}
```

### Dynamic Parameters

Use template variables to capture dynamic values:

```json
{
  "item_id": "{{product_id}}",
  "item_name": "{{product_name}}",
  "item_price": "{{product_price}}",
  "page_url": "{{page_url}}",
  "user_logged_in": "{{user_authenticated}}"
}
```

### Available Template Variables

| Variable | Description |
|----------|-------------|
| `{{product_id}}` | Current product ID |
| `{{product_name}}` | Product name |
| `{{product_price}}` | Product price |
| `{{product_sku}}` | Product SKU |
| `{{category_name}}` | Current category |
| `{{page_url}}` | Current page URL |
| `{{page_title}}` | Page title |
| `{{user_authenticated}}` | Whether user is logged in |
| `{{session_id}}` | Current session ID |
| `{{cart_total}}` | Current cart total |
| `{{cart_items_count}}` | Number of items in cart |

---

## Connecting to Google Tag Manager

Once your custom events are configured, set up GTM to use them:

### Step 1: Enable GTM in DainoStore

1. Go to **Analytics** in your admin sidebar (or visit `/admin/analytics`)
2. In the **GTM Configuration** tab, enable **Google Tag Manager**
3. Enter your GTM Container ID (GTM-XXXXXX)
4. Click **Save Settings**

### Step 2: Create a Custom Event Trigger in GTM

1. In GTM, go to **Triggers > New**
2. Choose **Custom Event**
3. Enter your event name (e.g., `add_shipping_info`)
4. Save the trigger

### Step 3: Create a Tag Using the Trigger

1. Go to **Tags > New**
2. Choose your tag type (GA4 Event, Google Ads, etc.)
3. Configure the tag
4. Add your custom event trigger
5. Submit and publish

### Example: Tracking Checkout Steps in GA4

**GTM Trigger:**
- Type: Custom Event
- Event Name: `add_shipping_info`

**GTM Tag:**
- Type: GA4 Event
- Event Name: `add_shipping_info`
- Parameters:
  - shipping_tier: `{{DLV - ecommerce.shipping_tier}}`
  - value: `{{DLV - ecommerce.value}}`
  - currency: `{{DLV - ecommerce.currency}}`

### Testing Your Setup

1. Use GTM Preview mode to test
2. Check the dataLayer in browser DevTools:
   ```javascript
   console.log(window.dataLayer);
   ```
3. Use the DainoStore **Test Datalayer** button to push a test event
4. Monitor the **Customer Activity** tab for backend-logged events

---

## Best Practices

### Naming Conventions

Use consistent, descriptive event names following GA4 conventions:

```
Good:
- add_shipping_info
- add_payment_info
- checkout_progress
- coupon_applied

Avoid:
- click1
- event_123
- myevent
```

### Event Categories

Group related events for easier analysis:

| Category | Example Events |
|----------|---------------|
| `ecommerce` | add_to_wishlist, product_compare, quick_view |
| `checkout` | add_shipping_info, add_payment_info, checkout_progress |
| `engagement` | video_play, share_click, review_helpful |
| `conversion` | newsletter_signup, account_create, refer_friend |
| `navigation` | menu_click, search_filter, pagination |

### Performance Considerations

- **Fire Once Per Session**: Enable for events that shouldn't repeat
- **Priority**: Use for events that must execute in order
- **Log to Backend**: Disable for high-frequency events to reduce API calls
- **Optional Chaining**: Always use `window.daino?.method()` for safe calls

### Data Quality

- Always validate event parameters
- Use consistent data types (strings vs numbers)
- Include enough context for meaningful analysis
- Test events before going live

### Privacy Compliance

- Don't capture PII (personally identifiable information) unless necessary
- Respect cookie consent settings
- Document what you're tracking for GDPR/CCPA compliance
- Events respect the user's consent preferences automatically

---

## Common Use Cases

### Track Video Engagement

```javascript
window.daino?.trackEvent('video_play', {
  video_id: 'vid_123',
  video_title: 'Product Demo',
  page_type: 'product'
});
```

### Track Product Comparison

```javascript
window.daino?.trackEvent('product_compare', {
  item_id: product.id,
  item_name: product.name,
  compare_list_size: compareList.length
});
```

### Track Quick View Usage

```javascript
window.daino?.trackQuickView({
  id: product.id,
  name: product.name,
  price: product.price,
  category_name: product.category
});
```

### Track Exit Intent

```javascript
window.daino?.trackEvent('exit_intent_shown', {
  page_url: window.location.href,
  time_on_page: sessionDuration,
  cart_value: cartTotal
});
```

### Track Coupon Usage

```javascript
// When coupon is applied
window.daino?.trackCouponApplied('SAVE20', 15.99, 79.99);

// When coupon is removed
window.daino?.trackCouponRemoved('SAVE20', 79.99);
```

---

## Debugging & Troubleshooting

### Check DataLayer Contents

```javascript
// View all dataLayer events
console.table(window.dataLayer);

// Filter for specific events
window.dataLayer.filter(e => e.event === 'add_to_cart');
```

### Listen for DataLayer Pushes

```javascript
window.addEventListener('dataLayerPush', (e) => {
  console.log('DataLayer event:', e.detail);
});
```

### Verify Tracking API Availability

```javascript
if (window.daino) {
  console.log('Tracking API available');
  console.log('Available methods:', Object.keys(window.daino));
} else {
  console.log('Tracking API not yet initialized');
}
```

---

## Need Help?

- **Test events**: Use the **Test Datalayer** button in the Analytics page
- **View activity**: Check the **Customer Activity** page (`/admin/customer-activity`) for logged events
- **Export data**: Use the **Export** tab in Analytics to download your configuration
- **GTM debugging**: Use GTM Preview mode and browser DevTools
- **Analytics Dashboard**: View conversion funnels and event metrics at `/admin/analytics-dashboard`
