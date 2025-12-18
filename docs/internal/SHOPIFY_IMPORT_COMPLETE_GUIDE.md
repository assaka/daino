# Shopify Import - Complete Guide

## Overview

This guide covers the complete Shopify import process, including products, collections, inventory, attributes, images, and more.

## Current Implementation Status

### ✅ Fully Implemented
- **Collections Import** - Shopify collections → SuprShop categories
- **Products Import** - Basic product data with variants
- **Shop Connection** - Direct access token authentication
- **Import Statistics** - Track success/failure rates

### 🚧 Partially Implemented
- **Product Images** - Structure exists, needs testing
- **Product Attributes** - Basic attributes created, needs variant mapping
- **Inventory Tracking** - Quantity imported, needs sync

### ❌ Not Yet Implemented
- **Customers Import** - API ready, import logic needed
- **Orders Import** - API ready, import logic needed
- **Real-time Sync** - Webhooks not configured
- **Incremental Updates** - Only full imports supported
- **Variant Options** - Size, color, etc. need proper mapping

---

## How Shopify Data Maps to SuprShop

### Collections → Categories

| Shopify Field | SuprShop Field | Notes |
|---------------|----------------|-------|
| `id` | `external_id` | Track original Shopify ID |
| `handle` | `slug` | URL-friendly identifier |
| `title` | `name` | Collection name |
| `body_html` | `description` | HTML description |
| `image` | `image` | Collection image URL |

**Current Status:** ✅ Fully working

---

### Products → Products

| Shopify Field | SuprShop Field | Notes |
|---------------|----------------|-------|
| `id` | `external_id` | Shopify product ID |
| `handle` | `slug` | URL key |
| `handle` | `sku` | Also used as SKU |
| `title` | `name` | Product name |
| `body_html` | `description` | HTML description |
| `status` | `status` | active/draft |
| `vendor` | Attribute | Custom attribute |
| `product_type` | Attribute | Custom attribute |
| `tags` | Attribute | Custom attribute |

**Current Status:** ✅ Working with slug fix

---

### Product Variants → Product Attributes

Shopify products can have multiple variants (e.g., Small/Medium/Large).

| Shopify Variant Field | SuprShop Mapping | Status |
|----------------------|------------------|--------|
| `option1` (e.g., Size) | Attribute: `option1` | 🚧 Needs improvement |
| `option2` (e.g., Color) | Attribute: `option2` | 🚧 Needs improvement |
| `option3` | Attribute: `option3` | 🚧 Needs improvement |
| `price` | `price` | ✅ Uses first variant |
| `compare_at_price` | `compare_price` | ✅ Working |
| `sku` | Attribute | 🚧 Per-variant SKU |
| `barcode` | Attribute | 🚧 Per-variant |
| `inventory_quantity` | `stock_quantity` | ✅ Summed across variants |
| `weight` | `weight` | ✅ First variant |

**Current Status:** 🚧 Basic import works, variant options need better mapping

---

### Product Images → Product Gallery

| Shopify Image Field | SuprShop Field | Status |
|--------------------|----------------|--------|
| `images[]` | `images` (JSON) | 🚧 Needs testing |
| `src` | Image URL | 🚧 Should download & store |
| `position` | Image order | 🚧 Needs implementation |
| `alt` | Alt text | ❌ Not captured |

**Current Status:** 🚧 URLs saved, local storage not implemented

---

### Inventory Management

| Shopify Field | SuprShop Field | Status |
|---------------|----------------|--------|
| `inventory_quantity` | `stock_quantity` | ✅ Summed |
| `inventory_management` | `manage_stock` | ✅ Working |
| `inventory_policy` | `allow_backorders` | ✅ Working |
| Multi-location inventory | N/A | ❌ Not supported |

**Current Status:** ✅ Basic inventory working

---

### Custom Attributes

The import automatically creates these attributes:

| Attribute | Type | Source Field |
|-----------|------|--------------|
| `vendor` | Text | `product.vendor` |
| `product_type` | Text | `product.product_type` |
| `tags` | Text | `product.tags` (comma-separated) |
| `barcode` | Text | `variant.barcode` |
| `option1`, `option2`, `option3` | Text | Variant options |

**Current Status:** ✅ Attributes created, values need better mapping

---

## Import Process

### Step 1: Connect Your Store

1. Go to **Admin → Shopify Integration**
2. Enter your shop domain and access token
3. Click **"Connect to Shopify"**

### Step 2: Import Collections First

Import collections before products so categories exist for product association.

```javascript
POST /api/shopify/import/collections
```

**Options:**
- `dry_run: true` - Preview without saving
- `overwrite: true` - Update existing collections

### Step 3: Import Products

```javascript
POST /api/shopify/import/products
```

**Options:**
- `dry_run: true` - Preview without saving
- `limit: 50` - Import only first 50 products
- `overwrite: true` - Update existing products

### Step 4: Verify Import

Check **Import Statistics** section to see:
- Total processed
- Successfully imported
- Failed imports
- Error details

---

## Common Issues & Solutions

### Issue: "column Product.external_id does not exist"

**Solution:** Run this migration in Supabase:
```sql
ALTER TABLE products
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id);
```

### Issue: "Product.slug cannot be null"

**Solution:** Already fixed in latest code. Shopify `handle` now maps to `slug`.

### Issue: "Validation isIn on import_method failed"

**Solution:** Already fixed. Uses `'manual'` instead of `'shopify'`.

### Issue: Images Not Showing

**Current Limitation:** Images are saved as URLs from Shopify. They're not downloaded/stored locally yet.

**Workaround:** Image URLs work but are external references.

### Issue: Variants Not Properly Mapped

**Current Limitation:** All variants are consolidated into a single product. Variant-specific pricing and options are stored as attributes but not fully functional.

**Future Enhancement Needed.**

---

## What Gets Imported

### ✅ Currently Imported

**Collections:**
- Collection name, description, handle
- Collection image URL
- Maps to categories in SuprShop

**Products:**
- Product name, description, handle
- First variant's price and compare price
- Total inventory across all variants
- Product status (active/draft)
- Product images (as URLs)
- Vendor and product type as attributes
- Tags
- Product collections (category associations)

### ❌ Not Yet Imported

**Product Data:**
- Individual variant prices
- Per-variant SKUs and barcodes
- Variant images
- Product metafields
- SEO fields (title, description)
- Multiple product images positions

**Other Data:**
- Customer data
- Order history
- Inventory by location
- Product reviews
- Discounts and promotions

---

## Import Data Structure

### Shopify Product JSON Structure
```json
{
  "id": 10304486179110,
  "title": "Gift Card",
  "handle": "gift-card",
  "body_html": "<p>Product description</p>",
  "vendor": "My Store",
  "product_type": "Gift Cards",
  "tags": ["gift", "card"],
  "status": "active",
  "variants": [
    {
      "id": 123456,
      "title": "$25",
      "price": "25.00",
      "sku": "GIFT-25",
      "inventory_quantity": 100,
      "weight": 0,
      "option1": "$25"
    }
  ],
  "images": [
    {
      "id": 789,
      "src": "https://cdn.shopify.com/...",
      "position": 1
    }
  ]
}
```

### Converted to SuprShop Product
```json
{
  "name": "Gift Card",
  "slug": "gift-card",
  "sku": "gift-card",
  "description": "<p>Product description</p>",
  "status": "active",
  "price": 25.00,
  "stock_quantity": 100,
  "external_id": "10304486179110",
  "external_source": "shopify",
  "images": ["https://cdn.shopify.com/..."],
  "attributes": {
    "vendor": "My Store",
    "product_type": "Gift Cards",
    "tags": "gift, card",
    "option1": "$25"
  }
}
```

---

## Advanced Import Options

### Dry Run Mode
Preview what will be imported without making changes:
```javascript
{
  "dry_run": true,
  "limit": 10
}
```

### Limited Import
Import only first N products for testing:
```javascript
{
  "limit": 50
}
```

### Overwrite Existing
Update existing products instead of skipping:
```javascript
{
  "overwrite": true
}
```

### Full Import
Import both collections and products in one call:
```javascript
POST /api/shopify/import/full
{
  "product_limit": 100
}
```

---

## Performance Considerations

### Import Speed

| Catalog Size | Estimated Time |
|--------------|----------------|
| 10 products | ~30 seconds |
| 100 products | ~2-3 minutes |
| 1,000 products | ~15-20 minutes |
| 10,000 products | ~2-3 hours |

### Rate Limits

Shopify enforces rate limits:
- **REST API:** 2 requests/second
- **Bucket size:** 40 requests
- **Automatic retry:** Built into the client

The integration automatically handles rate limiting with exponential backoff.

---

## Future Enhancements Needed

### High Priority
1. **Download and Store Images Locally**
   - Currently saves Shopify CDN URLs
   - Should download to Supabase storage
   - Maintain image positions

2. **Proper Variant Support**
   - Create configurable products
   - Map variant options to product variations
   - Support per-variant pricing and inventory

3. **Inventory Sync**
   - Two-way sync between Shopify and SuprShop
   - Update inventory in real-time
   - Handle multi-location inventory

### Medium Priority
4. **Webhook Integration**
   - Listen for product updates in Shopify
   - Auto-sync changes without manual imports
   - Handle product deletions

5. **Customer Import**
   - Import customer data
   - Map to SuprShop customers
   - Preserve customer groups/tags

6. **Order Import**
   - Import order history
   - Track order status
   - Sync fulfillment status

### Low Priority
7. **Metafields Support**
   - Import custom metafields
   - Map to SuprShop custom attributes

8. **SEO Data**
   - Import meta titles and descriptions
   - Handle redirects

9. **Product Reviews**
   - Import reviews if available
   - Map to SuprShop review system

---

## API Scopes Required

For full feature support, configure these scopes in your Shopify custom app:

### Current (Minimum)
- ✅ `read_products` - Product data
- ✅ `read_product_listings` - Product listings
- ✅ `read_inventory` - Inventory levels
- ✅ `read_content` - Collections/content

### For Future Features
- `read_customers` - Customer import
- `read_orders` - Order import
- `read_fulfillments` - Order fulfillment
- `write_inventory` - Two-way inventory sync
- `write_products` - Product updates back to Shopify

---

## Troubleshooting

### Products Import Partially

**Symptom:** Some products fail to import

**Common Causes:**
1. Missing required fields (name, slug, SKU)
2. Duplicate slugs/SKUs
3. Invalid attribute values
4. Missing categories

**Solution:** Check error details in Import Statistics

### Images Not Displaying

**Current Limitation:** Images are stored as external Shopify URLs, not downloaded locally.

**Temporary Workaround:** Images will display but are hosted on Shopify CDN.

### Inventory Incorrect

**Note:** Inventory is summed across all variants. If you have variants with different stock levels, the total is used.

---

## Testing Guide

### Test with Development Store

1. Create a Shopify development store (free)
2. Add sample products
3. Connect to SuprShop
4. Use dry run mode first:
   ```
   { "dry_run": true, "limit": 5 }
   ```
5. Review preview
6. Run actual import

### Verify Import Results

After import, check:
- [ ] Products appear in Products list
- [ ] Categories created from collections
- [ ] Product images visible (external URLs)
- [ ] Prices imported correctly
- [ ] Inventory quantities correct
- [ ] Product status (active/draft) preserved
- [ ] Vendor and product type saved as attributes

---

## Support

For issues or questions:
1. Check Import Statistics for error details
2. Review server logs for detailed error messages
3. Verify Shopify API scopes are correct
4. Test connection using "Test Connection" button
5. Check database migrations are applied

## Related Documentation

- [SHOPIFY_INTEGRATION.md](SHOPIFY_INTEGRATION.md) - Technical implementation
- [SHOPIFY_SETUP_GUIDE.md](SHOPIFY_SETUP_GUIDE.md) - Initial setup
