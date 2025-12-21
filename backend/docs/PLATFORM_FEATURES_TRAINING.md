# Platform Features Training Guide

This document trains the AI on core platform features like slot configurations, publishing, and store settings.

---

## Slot Configurations System

**User Question:** "How do slot configurations work?"

**Answer:** Slot configurations control the visual layout of storefront pages.

### Architecture

```
stores.configurations (JSONB)
    ↓
slot_configurations table (versioned)
    ↓
Page renders using UnifiedSlotRenderer
```

### Key Concepts

1. **Page Types**: homepage, category, product, cart, checkout, success, account, login, header
2. **Slots**: Named areas on each page (e.g., `product_title`, `add_to_cart_button`)
3. **Versioning**: draft → published workflow

### Database Structure

```sql
-- slot_configurations table
id, store_id, page_type, slot_id
config (JSONB)           -- Styling and content settings
status                   -- 'draft' or 'published'
version                  -- Version number
published_at             -- When published
has_unpublished_changes  -- Boolean flag
```

### How to Modify Slots

1. **Via Slot Editor** (Visual)
   - Go to Admin → Storefront → Edit [page type]
   - Click on slot to edit
   - Modify styling (colors, fonts, sizes)
   - Save (creates draft) → Publish

2. **Via API**
   ```javascript
   PATCH /api/slot-configurations/:pageType/:slotId
   {
     "config": {
       "styles": { "color": "#ff0000", "fontSize": "18px" }
     }
   }
   ```

3. **Via AI Chat**
   - "Change the product title color to red"
   - AI calls update_styling tool

### Versioning Flow

```
1. User edits slot → Creates DRAFT version
2. has_unpublished_changes = true
3. User clicks Publish →
   - Draft becomes Published
   - version increments
   - published_at updated
   - has_unpublished_changes = false
```

---

## Store Publishing System

**User Question:** "How do I publish store changes?"

**Answer:** Publishing makes draft changes live on the storefront.

### What Gets Published

1. **Slot Configurations** - Visual styling changes
2. **Theme Settings** - Colors, fonts, layout options
3. **CMS Content** - Pages and blocks

### Publishing Methods

1. **Publish All** (Recommended)
   - Admin → Storefront → Publish button
   - Publishes all pending changes at once

2. **Publish Per Page**
   - Go to specific page editor
   - Click Publish in the panel

3. **Via API**
   ```javascript
   POST /api/store-publishing/publish
   {
     "pageTypes": ["product", "category"]  // Optional, defaults to all
   }
   ```

### Publishing Status Check

```sql
-- Check what needs publishing
SELECT page_type, slot_id, has_unpublished_changes
FROM slot_configurations
WHERE store_id = 'xxx' AND has_unpublished_changes = true;
```

### Rollback

Currently manual - restore from previous version in database.

---

## Store Settings

**User Question:** "How do I change store settings?"

**Answer:** Store settings are stored in the `stores.settings` JSONB column.

### Settings Structure

```javascript
stores.settings = {
  // Theme settings
  theme: {
    primary_color: "#3b82f6",
    secondary_color: "#64748b",
    font_family: "Inter",
    header_bg_color: "#ffffff",
    breadcrumb_separator: "/",
    breadcrumb_item_text_color: "#666"
  },

  // Feature toggles
  show_category_in_breadcrumb: true,
  enable_guest_checkout: true,
  require_phone: false,

  // Regional settings
  currency: "EUR",
  locale: "en",
  timezone: "Europe/Amsterdam",

  // Stock settings
  show_stock_quantity: true,
  low_stock_threshold: 5,

  // Checkout settings
  min_order_amount: 0,
  enable_coupons: true
}
```

### How to Update Settings

1. **Via Admin Panel**
   - Admin → Settings → [Section]
   - Change values → Save

2. **Via API**
   ```javascript
   PATCH /api/stores/:storeId
   {
     "settings": {
       "theme": {
         "primary_color": "#ff0000"
       }
     }
   }
   ```

3. **Via AI Chat**
   - "Change the primary color to red"
   - "Enable guest checkout"
   - "Set minimum order to $50"

### Common Settings Queries

```sql
-- Get theme settings
SELECT settings->'theme' FROM stores WHERE id = 'xxx';

-- Check if feature enabled
SELECT settings->>'enable_guest_checkout' FROM stores WHERE id = 'xxx';

-- Update specific setting
UPDATE stores
SET settings = jsonb_set(settings, '{theme,primary_color}', '"#ff0000"')
WHERE id = 'xxx';
```

---

## Theme Customization

**User Question:** "How do I customize the theme?"

**Answer:** Theme settings control colors, fonts, and layout.

### Theme Settings Location

1. **Global Theme**: `stores.settings.theme`
2. **Page-specific**: `slot_configurations.config.styles`

### Customizable Elements

| Element | Setting Path | Example |
|---------|-------------|---------|
| Primary color | `theme.primary_color` | `#3b82f6` |
| Header background | `theme.header_bg_color` | `#ffffff` |
| Font family | `theme.font_family` | `Inter` |
| Button color | `theme.button_color` | `#3b82f6` |
| Link color | `theme.link_color` | `#2563eb` |

### Via Slot Editor

Each slot can have custom styles:
- Background color
- Text color
- Font size
- Padding/margin
- Border
- Shadow

---

## Page Configuration (stores.configurations)

**User Question:** "What is stores.configurations?"

**Answer:** The `configurations` JSONB column stores page-level settings.

### Structure

```javascript
stores.configurations = {
  homepage: {
    layout: "default",
    slots_enabled: ["hero", "featured_products", "categories"]
  },
  product: {
    image_gallery_position: "left",
    show_related_products: true,
    tabs_enabled: ["description", "specifications", "reviews"]
  },
  category: {
    products_per_page: 24,
    default_sort: "position",
    show_filters: true
  }
}
```

### Difference from slot_configurations

| `stores.configurations` | `slot_configurations` |
|------------------------|----------------------|
| Page-level settings | Individual slot styling |
| No versioning | Has draft/published versioning |
| Quick toggles | Detailed CSS properties |
| Layout choices | Visual customization |

---

## Cart Versioning

**User Question:** "How does cart versioning work?"

**Answer:** Cart page slots support versioning like other pages.

### Flow

1. User edits cart layout in Slot Editor
2. Changes saved as DRAFT
3. Click Publish to make live
4. Old version archived

### Cart-specific Slots

- `cart_items` - Product list
- `cart_summary` - Subtotal, taxes, total
- `cart_coupons` - Coupon input
- `cart_shipping` - Shipping calculator
- `cart_actions` - Checkout button

---

## API Reference

### Slot Configurations

```
GET    /api/slot-configurations/:pageType           - List all slots for page
GET    /api/slot-configurations/:pageType/:slotId   - Get specific slot
PATCH  /api/slot-configurations/:pageType/:slotId   - Update slot (creates draft)
POST   /api/slot-configurations/publish             - Publish all drafts
POST   /api/slot-configurations/:pageType/publish   - Publish page drafts
```

### Store Settings

```
GET    /api/stores/:storeId                         - Get store with settings
PATCH  /api/stores/:storeId                         - Update store settings
GET    /api/stores/:storeId/settings                - Get just settings
PATCH  /api/stores/:storeId/settings                - Update just settings
```

### Store Publishing

```
GET    /api/store-publishing/status                 - Check what needs publishing
POST   /api/store-publishing/publish                - Publish all changes
POST   /api/store-publishing/publish/:pageType      - Publish specific page
```

---

## Common AI Chat Commands

Users can ask the AI:

- "Show me unpublished changes"
- "Publish all changes"
- "Change the header background to blue"
- "Update the product title font size to 24px"
- "Enable guest checkout"
- "Set minimum order amount to 25 euros"
- "What slots are on the product page?"
- "List all theme settings"
