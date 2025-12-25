# Custom DataLayer Events for Advanced Tracking

Custom DataLayer events allow you to track specific user interactions on your storefront and send that data to Google Tag Manager, analytics platforms, and marketing tools. This guide covers everything from basic setup to advanced tracking strategies.

## Table of Contents

1. [What is the DataLayer?](#what-is-the-datalayer)
2. [Built-in Events (Always Active)](#built-in-events-always-active)
3. [Creating Custom Events](#creating-custom-events)
4. [Trigger Types Explained](#trigger-types-explained)
5. [Using Event Parameters](#using-event-parameters)
6. [Connecting to Google Tag Manager](#connecting-to-google-tag-manager)
7. [Best Practices](#best-practices)

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

DainoStore automatically tracks essential e-commerce events. These are always active and follow Google's Enhanced Ecommerce specification:

| Event | When It Fires | Data Included |
|-------|--------------|---------------|
| `page_view` | Every page load | Page title, URL, store info |
| `view_item` | Product detail pages | Full product data |
| `view_item_list` | Category/collection pages | Product list data |
| `select_item` | Product click in lists | Product and position |
| `add_to_cart` | Add to cart action | Product, quantity, variant |
| `remove_from_cart` | Remove from cart | Product and quantity |
| `view_cart` | Cart page viewed | All cart items |
| `begin_checkout` | Checkout started | Cart items and value |
| `purchase` | Order completed | Full order details |
| `search` | Product search | Query and results count |

These events are automatically pushed to `window.dataLayer` and tracked in customer activity logs.

---

## Creating Custom Events

To create a custom event for tracking specific user interactions:

### Step 1: Navigate to Custom Events

1. Go to **Settings > Tracking & Data Layer**
2. Click the **DataLayer Events** tab
3. Click **New Event**

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

---

## Connecting to Google Tag Manager

Once your custom events are configured, set up GTM to use them:

### Step 1: Enable GTM in DainoStore

1. Go to **Settings > Tracking & Data Layer**
2. Enable **Google Tag Manager**
3. Enter your GTM Container ID (GTM-XXXXXX)
4. Save settings

### Step 2: Create a Custom Event Trigger in GTM

1. In GTM, go to **Triggers > New**
2. Choose **Custom Event**
3. Enter your event name (e.g., `wishlist_add`)
4. Save the trigger

### Step 3: Create a Tag Using the Trigger

1. Go to **Tags > New**
2. Choose your tag type (GA4 Event, Google Ads, etc.)
3. Configure the tag
4. Add your custom event trigger
5. Submit and publish

### Example: Tracking Wishlist Adds in GA4

**GTM Trigger:**
- Type: Custom Event
- Event Name: `wishlist_add`

**GTM Tag:**
- Type: GA4 Event
- Event Name: `add_to_wishlist`
- Parameters:
  - item_id: `{{DLV - item_id}}`
  - item_name: `{{DLV - item_name}}`

### Testing Your Setup

1. Use GTM Preview mode to test
2. Check the dataLayer in browser DevTools:
   ```javascript
   console.log(window.dataLayer);
   ```
3. Use the DainoStore **Test Datalayer** button to push a test event

---

## Best Practices

### Naming Conventions

Use consistent, descriptive event names:

```
Good:
- newsletter_signup
- product_share_facebook
- video_play_homepage
- checkout_address_complete

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
| `engagement` | video_play, share_click, review_helpful |
| `conversion` | newsletter_signup, account_create, refer_friend |
| `navigation` | menu_click, search_filter, pagination |

### Performance Considerations

- **Fire Once Per Session**: Enable for events that shouldn't repeat
- **Priority**: Use for events that must execute in order
- **Log to Backend**: Disable for high-frequency events to reduce API calls

### Data Quality

- Always validate event parameters
- Use consistent data types (strings vs numbers)
- Include enough context for meaningful analysis
- Test events before going live

### Privacy Compliance

- Don't capture PII (personally identifiable information) unless necessary
- Respect cookie consent settings
- Document what you're tracking for GDPR/CCPA compliance

---

## Common Use Cases

### Track Video Engagement

```
Event Name: video_play
Trigger Type: Click
CSS Selector: .video-play-button, [data-video-trigger]
Parameters:
{
  "video_id": "{{video_id}}",
  "video_title": "{{video_title}}",
  "page_type": "product"
}
```

### Track Product Comparison

```
Event Name: product_compare
Trigger Type: Click
CSS Selector: .compare-button
Parameters:
{
  "item_id": "{{product_id}}",
  "item_name": "{{product_name}}",
  "compare_list_size": "{{compare_count}}"
}
```

### Track Quick View Usage

```
Event Name: quick_view_open
Trigger Type: Click
CSS Selector: .quick-view-button
Parameters:
{
  "item_id": "{{product_id}}",
  "list_name": "{{category_name}}",
  "position": "{{product_position}}"
}
```

### Track Exit Intent

```
Event Name: exit_intent_shown
Trigger Type: Custom
Description: Track when exit popup is displayed
Parameters:
{
  "page_url": "{{page_url}}",
  "time_on_page": "{{session_duration}}",
  "cart_value": "{{cart_total}}"
}
```

---

## Need Help?

- **Test events**: Use the **Test Datalayer** button in Settings
- **View activity**: Check the **DataLayer Events** tab for recent events
- **Export data**: Use the **Export** tab to download your configuration
- **GTM debugging**: Use GTM Preview mode and browser DevTools
