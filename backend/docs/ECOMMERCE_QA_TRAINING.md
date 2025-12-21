# E-Commerce Q&A Training Guide

This document provides comprehensive Q&A training data for the AI assistant covering all e-commerce functionality.

---

## Coupons / Discount Codes

**User Question:** "How can I create a coupon?"

**Answer:** Create coupons through Admin → Coupons → Create New, or via API:

```javascript
POST /api/coupons
{
  "store_id": "abc-123",
  "code": "SAVE20",
  "name": "20% Off",
  "discount_type": "percentage",  // or "fixed"
  "discount_value": 20,
  "min_purchase_amount": 50,      // Optional minimum order
  "max_discount_amount": 100,     // Optional cap for percentage discounts
  "usage_limit": 100,             // Max total uses
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "is_active": true
}
```

**Discount types available:**
- `percentage` - Percentage off (e.g., 20% off)
- `fixed` - Fixed amount off (e.g., $10 off)

---

**User Question:** "How do I create a Buy X Get Y coupon?"

**Answer:** Use the `buy_quantity` and `get_quantity` fields:

```javascript
POST /api/coupons
{
  "store_id": "abc-123",
  "code": "BUY2GET1",
  "name": "Buy 2 Get 1 Free",
  "discount_type": "percentage",
  "discount_value": 100,          // 100% off the free item
  "buy_quantity": 2,              // Customer must buy 2
  "get_quantity": 1,              // Gets 1 free
  "is_active": true
}
```

---

**User Question:** "How do I limit a coupon to specific products or categories?"

**Answer:** Use the applicable filters:

```javascript
POST /api/coupons
{
  "store_id": "abc-123",
  "code": "SUMMER-SALE",
  "discount_type": "percentage",
  "discount_value": 30,
  "applicable_products": ["product-uuid-1", "product-uuid-2"],
  "applicable_categories": ["category-uuid-1"],
  "applicable_skus": ["SKU-001", "SKU-002"],
  "applicable_attribute_sets": [],
  "applicable_attributes": []
}
```

If all applicable arrays are empty, the coupon applies to the entire order.

---

**User Question:** "How do I translate coupon text?"

**Answer:** Coupons support translations via the `translations` JSONB field:

```javascript
PUT /api/coupons/:id
{
  "store_id": "abc-123",
  "translations": {
    "en": { "name": "Summer Sale", "description": "Get 20% off summer items" },
    "nl": { "name": "Zomer Uitverkoop", "description": "Krijg 20% korting op zomerartikelen" },
    "de": { "name": "Sommer Sale", "description": "Erhalten Sie 20% Rabatt auf Sommerartikel" }
  }
}
```

---

## Shipping Methods

**User Question:** "How do I set up shipping methods?"

**Answer:** Create shipping methods via Admin → Shipping Methods or API:

```javascript
POST /api/shipping
{
  "store_id": "abc-123",
  "name": "Standard Shipping",
  "type": "flat_rate",           // flat_rate, weight_based, price_based
  "flat_rate_cost": 5.99,
  "free_shipping_min_order": 50, // Free shipping above $50
  "min_delivery_days": 3,
  "max_delivery_days": 7,
  "is_active": true,
  "translations": {
    "en": { "name": "Standard Shipping", "description": "3-7 business days" },
    "nl": { "name": "Standaard Verzending", "description": "3-7 werkdagen" }
  }
}
```

---

**User Question:** "How do I set up weight-based shipping?"

**Answer:** Use `type: "weight_based"` with weight ranges:

```javascript
POST /api/shipping
{
  "store_id": "abc-123",
  "name": "Weight-Based Shipping",
  "type": "weight_based",
  "weight_ranges": [
    { "min_weight": 0, "max_weight": 1, "cost": 5.00 },
    { "min_weight": 1, "max_weight": 5, "cost": 10.00 },
    { "min_weight": 5, "max_weight": 20, "cost": 20.00 }
  ],
  "is_active": true
}
```

---

**User Question:** "How do I set up price-based shipping rates?"

**Answer:** Use `type: "price_based"` with price ranges:

```javascript
POST /api/shipping
{
  "store_id": "abc-123",
  "name": "Price-Based Shipping",
  "type": "price_based",
  "price_ranges": [
    { "min_price": 0, "max_price": 25, "cost": 7.99 },
    { "min_price": 25, "max_price": 50, "cost": 4.99 },
    { "min_price": 50, "max_price": null, "cost": 0 }  // Free above $50
  ],
  "is_active": true
}
```

---

**User Question:** "How do I restrict shipping to specific countries?"

**Answer:** Use the `countries` and `availability` fields:

```javascript
POST /api/shipping
{
  "store_id": "abc-123",
  "name": "EU Shipping",
  "availability": "specific",    // "all" or "specific"
  "countries": ["NL", "DE", "BE", "FR"],
  "flat_rate_cost": 9.99,
  "is_active": true
}
```

---

## Payment Methods

**User Question:** "How do I set up payment methods?"

**Answer:** Configure payment methods via Admin → Payment Methods or API:

```javascript
POST /api/payment-methods
{
  "store_id": "abc-123",
  "name": "Credit Card",
  "type": "stripe",              // credit_card, paypal, stripe, bank_transfer, cash_on_delivery
  "is_active": true,
  "sort_order": 1,
  "translations": {
    "en": { "name": "Credit Card", "description": "Pay securely with Visa, Mastercard" },
    "nl": { "name": "Creditcard", "description": "Betaal veilig met Visa, Mastercard" }
  }
}
```

**Available payment types:**
- `credit_card` - Credit/debit cards
- `debit_card` - Debit cards only
- `paypal` - PayPal
- `stripe` - Stripe integration
- `bank_transfer` - Manual bank transfer
- `cash_on_delivery` - Pay on delivery

---

## Tax Configuration

**User Question:** "How do I set up tax rates?"

**Answer:** Configure taxes via Admin → Tax Rules or API:

```javascript
POST /api/tax
{
  "store_id": "abc-123",
  "name": "EU VAT 21%",
  "rate": 21.0,
  "is_active": true,
  "translations": {
    "en": { "name": "VAT 21%", "description": "Value Added Tax" },
    "nl": { "name": "BTW 21%", "description": "Belasting Toegevoegde Waarde" }
  }
}
```

---

## CMS Pages

**User Question:** "How do I create a content page?"

**Answer:** Create CMS pages via Admin → CMS Pages or API:

```javascript
POST /api/cms-pages
{
  "store_id": "abc-123",
  "slug": "about-us",
  "is_active": true,
  "translations": {
    "en": {
      "title": "About Us",
      "content": "<h1>About Our Company</h1><p>We are...</p>",
      "meta_title": "About Us | My Store",
      "meta_description": "Learn about our company"
    },
    "nl": {
      "title": "Over Ons",
      "content": "<h1>Over Ons Bedrijf</h1><p>Wij zijn...</p>",
      "meta_title": "Over Ons | Mijn Winkel"
    }
  }
}
```

---

**User Question:** "How do I translate all CMS pages at once?"

**Answer:** Use bulk translation:

```javascript
POST /api/cms-pages/bulk-translate
{
  "store_id": "abc-123",
  "fromLang": "en",
  "toLang": "nl"
}

// Response:
{
  "success": true,
  "message": "Bulk translation completed. Translated: 5, Skipped: 2, Failed: 0",
  "data": {
    "total": 7,
    "translated": 5,
    "skipped": 2,
    "failed": 0,
    "creditsDeducted": 3.5
  }
}
```

---

**User Question:** "Can I delete system pages like the 404 page?"

**Answer:** No, system pages cannot be deleted. They are marked with `is_system: true` and are essential for site functionality:

```javascript
DELETE /api/cms-pages/:id

// Response for system page:
{
  "success": false,
  "message": "Cannot delete system pages. System pages like 404 are critical for site functionality."
}
```

You can modify their content but not delete them.

---

## Customer Management

**User Question:** "How do I view customer information?"

**Answer:** Access customers via Admin → Customers or API:

```javascript
GET /api/customers?store_id=abc-123&search=john&sort_by=created_at&sort_order=DESC

// Response includes:
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "customer-uuid",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "customer_type": "registered",  // or "guest"
        "total_orders": 5,
        "total_spent": 450.00,
        "last_order_date": "2024-01-15T...",
        "address_data": {
          "shipping_address": { "street": "...", "city": "...", "country": "NL" },
          "billing_address": { "street": "...", "city": "...", "country": "NL" }
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

**User Question:** "How do I blacklist a customer?"

**Answer:** Blacklist customers to prevent future orders:

```javascript
PUT /api/customers/:id/blacklist?store_id=abc-123
{
  "is_blacklisted": true,
  "blacklist_reason": "Multiple chargebacks"
}

// Response:
{
  "success": true,
  "message": "Customer blacklisted successfully",
  "data": {
    "is_blacklisted": true,
    "blacklist_reason": "Multiple chargebacks",
    "blacklisted_at": "2024-01-15T..."
  }
}
```

This also adds their email to the `blacklist_emails` table to prevent new registrations.

---

**User Question:** "What's the difference between registered and guest customers?"

**Answer:**

**Registered customers** (`customer_type: "registered"`):
- Have a password and can log in
- Addresses stored in `customer_addresses` table
- Can view order history
- Can have wishlist

**Guest customers** (`customer_type: "guest"`):
- No password, created during checkout
- Addresses stored on the order itself
- Cannot log in or view order history
- Email is used for order updates

---

## Email Templates

**User Question:** "How do I customize email templates?"

**Answer:** Edit templates via Admin → Email Templates or API:

```javascript
PUT /api/email-templates/:id?store_id=abc-123
{
  "is_active": true,
  "translations": {
    "en": {
      "subject": "Your order #{{order_number}} has been confirmed!",
      "template_content": "Dear {{customer_name}},\n\nThank you for your order...",
      "html_content": "<h1>Order Confirmed</h1><p>Dear {{customer_name}}...</p>"
    }
  }
}
```

---

**User Question:** "What email variables are available?"

**Answer:** Variables depend on the template type. Common variables include:

**Order emails:**
- `{{order_number}}` - Order reference number
- `{{customer_name}}` - Customer's full name
- `{{order_total}}` - Order total with currency
- `{{order_items}}` - List of ordered items
- `{{shipping_address}}` - Formatted shipping address
- `{{tracking_number}}` - Shipment tracking (for shipment emails)

**Customer emails:**
- `{{customer_name}}` - Customer's name
- `{{store_name}}` - Your store name
- `{{verification_link}}` - Email verification link

---

**User Question:** "How do I send a test email?"

**Answer:** Use the test endpoint:

```javascript
POST /api/email-templates/:id/test?store_id=abc-123
{
  "test_email": "your-email@example.com",
  "language_code": "en"
}

// Response:
{
  "success": true,
  "message": "Test email sent successfully"
}
```

---

**User Question:** "How do I restore an email template to defaults?"

**Answer:** For system templates, use the restore endpoint:

```javascript
POST /api/email-templates/:id/restore-default?store_id=abc-123

// Response:
{
  "success": true,
  "message": "Email template restored to default successfully"
}
```

Note: Only system templates can be restored. Custom templates cannot.

---

## Product Labels/Badges

**User Question:** "How do I create product labels like 'New' or 'Sale'?"

**Answer:** Create labels via Admin → Product Labels or API:

```javascript
POST /api/product-labels
{
  "store_id": "abc-123",
  "name": "New Arrival",
  "slug": "new-arrival",
  "text": "NEW",
  "background_color": "#22c55e",
  "color": "#ffffff",
  "position": "top-left",        // top-left, top-right, bottom-left, bottom-right
  "priority": 10,                // Higher = shown first if multiple labels
  "sort_order": 1,
  "is_active": true,
  "conditions": {},              // Optional: auto-apply conditions
  "translations": {
    "en": { "name": "New Arrival", "text": "NEW" },
    "nl": { "name": "Nieuw", "text": "NIEUW" }
  }
}
```

---

**User Question:** "Can I automatically apply labels based on conditions?"

**Answer:** Yes, use the `conditions` field:

```javascript
POST /api/product-labels
{
  "store_id": "abc-123",
  "name": "On Sale",
  "text": "SALE",
  "background_color": "#ef4444",
  "conditions": {
    "has_special_price": true,   // Apply when product has sale price
    "min_discount_percent": 10   // Only if discount is 10%+ off
  }
}
```

---

## Wishlist

**User Question:** "How does the wishlist work?"

**Answer:** Wishlists are session-based or user-based:

```javascript
// Add to wishlist (guest)
POST /api/wishlist
{
  "store_id": "abc-123",
  "session_id": "session-uuid",
  "product_id": "product-uuid"
}

// Add to wishlist (logged in)
POST /api/wishlist
{
  "store_id": "abc-123",
  "user_id": "customer-uuid",
  "product_id": "product-uuid"
}

// Get wishlist
GET /api/wishlist?store_id=abc-123&session_id=session-uuid

// Remove from wishlist
DELETE /api/wishlist?store_id=abc-123&product_id=product-uuid&session_id=session-uuid
```

---

## Cart Management

**User Question:** "How does the cart work?"

**Answer:** Carts are stored per session or user:

```javascript
// Get cart
GET /api/cart?store_id=abc-123&session_id=session-uuid

// Add/Update cart
POST /api/cart
{
  "store_id": "abc-123",
  "session_id": "session-uuid",
  "items": [
    {
      "product_id": "product-uuid",
      "quantity": 2,
      "variant_id": "variant-uuid",  // For configurable products
      "custom_options": {}
    }
  ]
}

// Clear cart
DELETE /api/cart?store_id=abc-123&session_id=session-uuid
```

Cart data is stored in the tenant database `carts` table with items as JSONB.

---

## Delivery Settings

**User Question:** "How do I configure delivery date options?"

**Answer:** Set up delivery settings via Admin → Delivery or API:

```javascript
POST /api/delivery
{
  "store_id": "abc-123",
  "enable_delivery_date": true,
  "enable_comments": true,
  "offset_days": 2,              // Minimum days from now
  "max_advance_days": 30,        // Maximum days in advance
  "blocked_dates": ["2024-12-25", "2024-01-01"],
  "blocked_weekdays": [0, 6],    // 0=Sunday, 6=Saturday
  "delivery_time_slots": [
    { "start_time": "09:00", "end_time": "12:00", "is_active": true },
    { "start_time": "13:00", "end_time": "17:00", "is_active": true }
  ]
}
```

---

**User Question:** "How do I set up vacation/out of office periods?"

**Answer:** Use the out_of_office fields:

```javascript
PUT /api/delivery/:id
{
  "store_id": "abc-123",
  "out_of_office_start": "2024-08-01",
  "out_of_office_end": "2024-08-15"
}
```

No deliveries can be scheduled during this period.

---

## SEO Settings

**User Question:** "How do I configure SEO settings?"

**Answer:** Set global SEO settings via Admin → SEO or API:

```javascript
POST /api/seo-settings
{
  "store_id": "abc-123",
  "meta_title_suffix": " | My Store",
  "default_meta_description": "Shop quality products at My Store",
  "robots_txt": "User-agent: *\nAllow: /",
  "google_analytics_id": "G-XXXXXXXX",
  "google_tag_manager_id": "GTM-XXXXX",
  "facebook_pixel_id": "123456789"
}
```

---

## URL Redirects

**User Question:** "How do I create URL redirects?"

**Answer:** Create redirects via Admin → Redirects or API:

```javascript
POST /api/redirects
{
  "store_id": "abc-123",
  "from_url": "/old-product-page",
  "to_url": "/new-product-page",
  "type": "301",                 // 301 (permanent) or 302 (temporary)
  "is_active": true
}
```

---

**User Question:** "Do redirects get created automatically when I change slugs?"

**Answer:** Yes! When you change a product, category, or page slug, redirects are automatically created:

```javascript
// This happens automatically when you update a slug
POST /api/redirects/slug-change
{
  "store_id": "abc-123",
  "entity_type": "product",
  "entity_id": "product-uuid",
  "old_slug": "old-name",
  "new_slug": "new-name",
  "entity_path_prefix": "/product"
}

// Creates: /product/old-name → /product/new-name (301)
```

---

## A/B Testing

**User Question:** "How do I set up A/B tests?"

**Answer:** Create experiments via Admin → A/B Testing or API:

```javascript
POST /api/ab-testing/:storeId
{
  "name": "Button Color Test",
  "description": "Test red vs blue buy button",
  "hypothesis": "Red button will increase conversions",
  "variants": [
    { "id": "control", "name": "Control (Blue)", "weight": 50, "is_control": true },
    { "id": "variant-a", "name": "Red Button", "weight": 50 }
  ],
  "traffic_allocation": 1.0,     // 100% of traffic
  "primary_metric": "conversion_rate",
  "min_sample_size": 1000,
  "confidence_level": 0.95
}
```

---

**User Question:** "How do I start an A/B test?"

**Answer:** Start the test after configuration:

```javascript
POST /api/ab-testing/:storeId/test/:testId/start

// Response:
{
  "success": true,
  "data": {
    "status": "running",
    "start_date": "2024-01-15T..."
  }
}
```

---

**User Question:** "How do I get A/B test results?"

**Answer:** View results including statistical significance:

```javascript
GET /api/ab-testing/:storeId/test/:testId/results

// Response:
{
  "success": true,
  "data": {
    "variants": [
      {
        "id": "control",
        "name": "Control",
        "visitors": 5000,
        "conversions": 250,
        "conversion_rate": 5.0
      },
      {
        "id": "variant-a",
        "name": "Red Button",
        "visitors": 5000,
        "conversions": 300,
        "conversion_rate": 6.0,
        "improvement": 20,
        "is_significant": true
      }
    ],
    "confidence": 0.97,
    "recommended_winner": "variant-a"
  }
}
```

---

## Credits System

**User Question:** "How do I check my credit balance?"

**Answer:** View credits via the user dashboard or API:

```javascript
GET /api/credits/transactions?limit=50

// Response:
{
  "success": true,
  "data": [
    {
      "id": "tx-uuid",
      "transaction_type": "purchase",
      "amount_usd": 10.00,
      "credits_amount": 100,
      "status": "completed",
      "description": "Credit purchase",
      "created_at": "2024-01-15T..."
    }
  ],
  "total": 25
}
```

---

**User Question:** "How do credits get charged?"

**Answer:** Credits are deducted for various services:

1. **Store publishing** - Daily charge for published stores
2. **AI translations** - Per item translated
3. **AI-powered features** - Chat, content generation

View uptime report:
```javascript
GET /api/credits/uptime-report?days=30&store_id=abc-123

// Shows publishing costs for the period
```

---

## Order Management

**User Question:** "How can I refund an order?"

**Answer:** Process refunds via Admin → Orders or API:

```javascript
POST /api/orders/:orderId/refund
{
  "store_id": "abc-123",
  "refund_amount": 50.00,        // Partial or full refund
  "refund_reason": "Customer request",
  "restock_items": true          // Return items to stock
}
```

The system will:
1. Process refund through payment provider (Stripe, PayPal, etc.)
2. Optionally restock items
3. Update order status
4. Send refund notification email

---

**User Question:** "How do I send a shipping notification?"

**Answer:** Add tracking and notify customer:

```javascript
POST /api/orders/:orderId/ship
{
  "store_id": "abc-123",
  "tracking_number": "1Z999AA10123456784",
  "carrier": "UPS",
  "notify_customer": true
}
```

This sends the shipment notification email with tracking info.

---

**User Question:** "How do I resend an invoice?"

**Answer:** Send invoice email:

```javascript
POST /api/orders/:orderId/send-invoice
{
  "store_id": "abc-123"
}
```

---

## Cookie Consent

**User Question:** "I want to translate the cookie consent text"

**Answer:** Cookie consent settings support full translations:

```javascript
PUT /api/cookie-consent-settings/:id?store_id=abc-123
{
  "translations": {
    "en": {
      "banner_title": "Cookie Notice",
      "banner_description": "We use cookies to improve your experience...",
      "accept_all_button": "Accept All",
      "reject_all_button": "Reject All",
      "customize_button": "Customize"
    },
    "nl": {
      "banner_title": "Cookie Melding",
      "banner_description": "Wij gebruiken cookies om uw ervaring te verbeteren...",
      "accept_all_button": "Alles Accepteren",
      "reject_all_button": "Alles Weigeren",
      "customize_button": "Aanpassen"
    }
  }
}
```

Or use AI translation:
```javascript
POST /api/cookie-consent-settings/:id/translate
{
  "store_id": "abc-123",
  "fromLang": "en",
  "toLang": "nl"
}
```

---

## Configurable Products / Custom Options

**User Question:** "How does custom options work for products?"

**Answer:** Configurable products have variants based on attributes:

```javascript
// Create a configurable product
POST /api/products
{
  "store_id": "abc-123",
  "name": "T-Shirt",
  "type": "configurable",
  "configurable_attributes": ["size", "color"]  // Attributes that define variants
}

// Add variants
POST /api/configurable-products/:productId/variants
{
  "store_id": "abc-123",
  "variants": [
    {
      "sku": "TSHIRT-S-RED",
      "price": 29.99,
      "stock_quantity": 50,
      "attribute_values_map": {
        "size": "S",
        "color": "Red"
      }
    },
    {
      "sku": "TSHIRT-M-RED",
      "price": 29.99,
      "stock_quantity": 30,
      "attribute_values_map": {
        "size": "M",
        "color": "Red"
      }
    }
  ]
}
```

---

**User Question:** "How do I get all variants for a configurable product?"

**Answer:** Fetch variants via API:

```javascript
GET /api/configurable-products/:productId/variants?store_id=abc-123

// Response:
{
  "success": true,
  "data": {
    "variants": [
      {
        "id": "variant-uuid",
        "sku": "TSHIRT-S-RED",
        "price": 29.99,
        "stock_quantity": 50,
        "attribute_values_map": {
          "size": "S",
          "color": "Red"
        },
        "is_in_stock": true
      }
    ],
    "configurable_attributes": ["size", "color"],
    "available_options": {
      "size": ["S", "M", "L", "XL"],
      "color": ["Red", "Blue", "Black"]
    }
  }
}
```

---

## Analytics

**User Question:** "How do I track analytics events?"

**Answer:** The platform tracks various events automatically:

```javascript
// Track consent change
POST /api/analytics/consent-change
{
  "categories_accepted": ["necessary", "analytics", "marketing"]
}

// Get event stats
GET /api/analytics/stats

// Response:
{
  "success": true,
  "data": {
    "total_events": 15000,
    "events_per_type": {
      "page_view": 10000,
      "add_to_cart": 2000,
      "purchase": 500
    }
  }
}
```

---

## Common Translation Pattern

**User Question:** "How do translations work across the platform?"

**Answer:** Most entities support multi-language translations:

1. **Products, Categories** - Separate translations table
2. **Coupons, Labels** - JSONB `translations` column
3. **Shipping, Payment, Tax** - Separate translations table
4. **CMS Pages** - Separate translations table
5. **Email Templates** - Separate translations table
6. **Cookie Consent** - JSONB `translations` column

All support:
- Manual editing per language
- Single-item AI translation
- Bulk AI translation for entire entity type

Translation API pattern:
```javascript
// Single item
POST /api/:entity/:id/translate
{
  "fromLang": "en",
  "toLang": "nl"
}

// Bulk translate
POST /api/:entity/bulk-translate
{
  "store_id": "abc-123",
  "fromLang": "en",
  "toLang": "nl"
}
```

---

## AI Chat Commands Summary

The AI assistant can help with these common tasks:

| User Says | Action Taken |
|-----------|--------------|
| "Create a coupon for 20% off" | Creates coupon via API |
| "Set up free shipping over $50" | Creates shipping method |
| "Translate all products to Dutch" | Runs bulk translation |
| "Blacklist customer@email.com" | Blacklists customer |
| "Refund order #12345" | Processes refund |
| "Add tracking number to order" | Updates shipment info |
| "Create a 'Sale' product label" | Creates product label |
| "Set up delivery time slots" | Configures delivery |
| "Create an A/B test" | Sets up experiment |
| "Show my credit balance" | Displays transactions |
