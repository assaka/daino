# Integration Mapping Architecture

## Overview

We use a **two-layer mapping system** to handle different types of integrations:

1. **Generic Layer**: `integration_attribute_mappings` - Simple attribute mappings (all platforms)
2. **Platform-Specific Layer**: Platform-specific tables - Complex mappings with business logic

---

## 🎯 When to Use Each Layer

### Use `integration_attribute_mappings` (Generic Layer)

**For: Simple, direct attribute mappings**

✅ **Use Cases:**
- Simple attribute name mapping: `vendor` → `brand`
- Cross-platform attribute normalization: `colour` → `color`
- Direct 1:1 attribute mapping without logic
- Platforms with simple attribute structures (Shopify, WooCommerce, BigCommerce)

❌ **Don't Use For:**
- Category hierarchies
- Attribute sets/families
- Complex many-to-many relationships
- Custom business logic or transformations
- Platform-specific features

**Example:**
```javascript
// Shopify → DainoStore
integration_attribute_mappings:
  shopify."vendor" → brand
  shopify."product_type" → product_type
  shopify."tags" → tags

// WooCommerce → DainoStore
integration_attribute_mappings:
  woocommerce."pa_color" → color
  woocommerce."pa_size" → size
```

---

### Use Platform-Specific Tables (Platform Layer)

**For: Complex mappings with business logic and hierarchies**

✅ **Use Cases:**
- Category hierarchies and tree structures
- Attribute sets/families
- Many-to-many relationships
- Custom field mappings with transformations
- Platform-specific features
- Locales and channel mappings

❌ **Don't Use For:**
- Simple attribute name changes
- Cross-platform generic attributes

**Example Tables:**

#### Akeneo
```sql
-- Complex mappings for PIM-specific features
akeneo_mappings (
  akeneo_code,
  akeneo_type,        -- 'category', 'attribute_set', 'family', 'channel', 'locale'
  entity_type,
  entity_id,
  mapping_metadata JSONB  -- Complex transformation rules
)

akeneo_category_mappings (
  akeneo_category_code,
  akeneo_parent_code,   -- Hierarchy support
  daino_category_id,
  locale_mappings JSONB  -- Multi-locale support
)

akeneo_family_mappings (
  akeneo_family_code,
  daino_attribute_set_id,
  attribute_mappings JSONB  -- Which attributes belong to this family
)
```

#### Magento
```sql
magento_mappings (
  magento_code,
  magento_type,       -- 'category', 'attribute_set', 'store_view', 'customer_group'
  entity_type,
  entity_id
)

magento_attribute_set_mappings (
  magento_attribute_set_id,
  daino_attribute_set_id,
  attribute_group_mappings JSONB  -- Attribute groups within sets
)

magento_category_mappings (
  magento_category_id,
  magento_path,       -- Full category path
  daino_category_id,
  store_view_id      -- Multi-store support
)
```

---

## 📋 Complete Mapping Architecture

### Layer 1: Generic Attribute Mapping (All Platforms)

```
┌─────────────────────────────────────────────────┐
│   integration_attribute_mappings                │
│                                                 │
│   Shopify:     vendor → brand                  │
│   Magento:     manufacturer → brand            │
│   Akeneo:      brand_name → brand              │
│   WooCommerce: pa_brand → brand                │
│                                                 │
│   Universal attribute-level mapping             │
└─────────────────────────────────────────────────┘
```

### Layer 2: Platform-Specific Mappings

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Akeneo Tables   │  │ Magento Tables  │  │ Shopify Tables  │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • akeneo_       │  │ • magento_      │  │ (None needed -  │
│   mappings      │  │   mappings      │  │  simple enough  │
│                 │  │                 │  │  for generic    │
│ • akeneo_       │  │ • magento_      │  │  layer only)    │
│   category_     │  │   attribute_    │  │                 │
│   mappings      │  │   set_mappings  │  └─────────────────┘
│                 │  │                 │
│ • akeneo_       │  │ • magento_      │
│   family_       │  │   category_     │
│   mappings      │  │   mappings      │
│                 │  │                 │
│ • akeneo_       │  │ • magento_      │
│   channel_      │  │   store_view_   │
│   mappings      │  │   mappings      │
└─────────────────┘  └─────────────────┘
```

---

## 🔄 Integration Flow Examples

### Example 1: Shopify (Simple - Generic Layer Only)

```javascript
// Shopify Product Import
{
  vendor: "Nike",
  product_type: "Shoes",
  tags: "athletic,running"
}

// Uses: integration_attribute_mappings ONLY
↓
{
  brand: "Nike",          // vendor → brand (via integration_attribute_mappings)
  product_type: "Shoes",  // direct mapping
  tags: "athletic,running"
}
```

**Why no platform-specific table?**
- Shopify has flat structure
- No attribute sets/families
- No complex hierarchies
- Simple 1:1 attribute mapping sufficient

---

### Example 2: Akeneo (Complex - Both Layers)

```javascript
// Akeneo Product Import
{
  family: "clothing",
  categories: ["master", "men", "men_shirts"],
  values: {
    brand_name: [{data: "Nike", locale: "en_US"}],
    color: [{data: "Red", locale: "en_US"}],
    size: [{data: "L", scope: "ecommerce"}],
    material: [{data: "Cotton", locale: "en_US"}]  // Akeneo uses "material"
  }
}

// Uses: BOTH layers

// 1. Platform-Specific Layer (akeneo_family_mappings)
family: "clothing" → daino_attribute_set_id: "uuid-123"

// 2. Platform-Specific Layer (akeneo_category_mappings)
categories: ["master", "men", "men_shirts"]
  → Resolves hierarchy
  → daino_category_ids: ["uuid-a", "uuid-b", "uuid-c"]

// 3. Generic Layer (integration_attribute_mappings) ← YES, Akeneo uses this too!
Check table for akeneo mappings:
  akeneo."brand_name" → "brand" (found in integration_attribute_mappings)
  akeneo."color" → "color" (found in integration_attribute_mappings)
  akeneo."size" → "size" (found in integration_attribute_mappings)
  akeneo."material" → "material" (found in integration_attribute_mappings)

↓
{
  attribute_set_id: "uuid-123",    // from akeneo_family_mappings
  category_ids: ["uuid-a", "uuid-b", "uuid-c"],  // from akeneo_category_mappings
  attributes: {
    brand: "Nike",                 // from integration_attribute_mappings
    color: "Red",
    size: "L"
  }
}
```

**Why both layers?**
- ✅ Generic layer: Simple attribute name mapping (`brand_name` → `brand`)
- ✅ Platform layer: Complex family/category/locale/channel logic

---

### Example 3: Magento (Complex - Both Layers)

```javascript
// Magento Product Import
{
  attribute_set_id: 4,
  category_ids: [2, 5, 12],
  manufacturer: "Adidas",
  color: 45,  // Option ID, needs lookup
  custom_layout: "product-full-width"
}

// Uses: BOTH layers

// 1. Platform-Specific Layer (magento_attribute_set_mappings)
attribute_set_id: 4 → daino_attribute_set_id: "uuid-456"

// 2. Platform-Specific Layer (magento_category_mappings)
category_ids: [2, 5, 12]
  → Maps Magento category IDs to DainoStore
  → daino_category_ids: ["uuid-x", "uuid-y", "uuid-z"]

// 3. Platform-Specific Layer (magento_attribute_option_mappings)
color: 45 → "Blue" (lookup option value)

// 4. Generic Layer (integration_attribute_mappings)
manufacturer → brand
color → color

↓
{
  attribute_set_id: "uuid-456",   // from magento_attribute_set_mappings
  category_ids: ["uuid-x", "uuid-y", "uuid-z"],  // from magento_category_mappings
  attributes: {
    brand: "Adidas",              // from integration_attribute_mappings
    color: "Blue",                // from magento_attribute_option_mappings
    custom_layout: "product-full-width"
  }
}
```

---

## 📊 Decision Matrix: Which Layer to Use?

| Mapping Type | Generic Layer | Platform Layer | Example |
|-------------|---------------|----------------|---------|
| **Simple attribute name** | ✅ Yes | ❌ No | `vendor` → `brand` |
| **Cross-platform attribute** | ✅ Yes | ❌ No | `colour` → `color` |
| **Category hierarchy** | ❌ No | ✅ Yes | Akeneo category tree |
| **Attribute sets/families** | ❌ No | ✅ Yes | Akeneo families, Magento attribute sets |
| **Locales/channels** | ❌ No | ✅ Yes | Akeneo locales, Magento store views |
| **Option value lookups** | ❌ No | ✅ Yes | Magento color option ID → name |
| **Custom transformations** | ❌ No | ✅ Yes | Price format, unit conversions |
| **Many-to-many relationships** | ❌ No | ✅ Yes | Product → multiple categories |

---

## 🏗️ Complete Table Structure

### Generic Tables (All Platforms)
```sql
1. integration_attribute_mappings
   - Simple attribute name mappings
   - Works for: Shopify, WooCommerce, BigCommerce, Akeneo, Magento, etc.
```

### Akeneo-Specific Tables

**YES! Akeneo uses BOTH layers:**
- `integration_attribute_mappings` for simple attribute name mappings
- Platform-specific tables for families, categories, channels, locales

```sql
2. akeneo_mappings
   - Generic entity mappings (legacy, can be deprecated)

3. akeneo_family_mappings
   - Akeneo family → DainoStore attribute_set
   - Includes attribute group configurations

4. akeneo_category_mappings
   - Akeneo category tree → DainoStore categories
   - Supports hierarchies and locales

5. akeneo_channel_mappings
   - Akeneo channels (ecommerce, mobile, etc.) → DainoStore configuration

6. akeneo_locale_mappings
   - Akeneo locales (en_US, fr_FR) → DainoStore languages

7. akeneo_attribute_option_mappings (if needed)
   - Akeneo option codes → DainoStore option values
```

### Magento-Specific Tables
```sql
8. magento_mappings
   - Generic entity mappings

9. magento_attribute_set_mappings
   - Magento attribute set → DainoStore attribute_set
   - Includes attribute group mappings

10. magento_category_mappings
    - Magento categories → DainoStore categories
    - Supports multi-store and paths

11. magento_store_view_mappings
    - Magento store views → DainoStore languages/currencies

12. magento_customer_group_mappings (if needed)
    - Magento customer groups → DainoStore customer segments

13. magento_attribute_option_mappings
    - Magento option IDs → DainoStore option values
```

### Shopify/WooCommerce (Simple Platforms)
```
No platform-specific tables needed!
Use integration_attribute_mappings only.
```

---

## 🎯 Summary

**Two-Layer Architecture:**

1. **Generic Layer** (`integration_attribute_mappings`)
   - For ALL platforms
   - Simple attribute name mappings
   - Cross-platform normalization
   - Fast, lightweight

2. **Platform-Specific Layer** (e.g., `akeneo_*`, `magento_*`)
   - For complex platforms (Akeneo, Magento, SAP, etc.)
   - Hierarchies, families, channels, locales
   - Business logic and transformations
   - Custom features per platform

**Benefits:**
- ✅ Simple platforms (Shopify, WooCommerce) use generic layer only
- ✅ Complex platforms (Akeneo, Magento) use both layers
- ✅ No code duplication - generic layer shared
- ✅ Platform-specific complexity isolated in dedicated tables
- ✅ Easy to add new platforms
- ✅ User can configure mappings at both levels

---

## 🚀 Next Steps

1. ✅ **integration_attribute_mappings** - Already created
2. ⏳ **Keep existing akeneo_* tables** - Already have them
3. ⏳ **Create magento_* tables** - When Magento integration starts
4. ⏳ **AttributeMappingService** - Works with generic layer ✅
5. ⏳ **AkeneoImportService** - Uses BOTH layers (already does!)
6. ⏳ **MagentoImportService** - Will use BOTH layers (future)
7. ⏳ **ShopifyImportService** - Uses generic layer only ✅

---

## 📝 Code Example

```javascript
// Shopify (Simple - Generic Layer Only)
class ShopifyImportService {
  constructor(storeId) {
    this.attributeMapper = new AttributeMappingService(storeId, 'shopify');
    // No platform-specific mapper needed!
  }

  async importProduct(product) {
    // Uses integration_attribute_mappings only
    const { attributes } = await this.attributeMapper.processProductAttributes({
      vendor: product.vendor,
      product_type: product.product_type
    });
  }
}

// Akeneo (Complex - Both Layers)
class AkeneoImportService {
  constructor(storeId) {
    this.attributeMapper = new AttributeMappingService(storeId, 'akeneo');
    this.akeneoMapper = new AkeneoMappingService(storeId);  // Platform-specific!
  }

  async importProduct(product) {
    // 1. Platform-specific: Map family to attribute set
    const attributeSet = await this.akeneoMapper.mapFamily(product.family);

    // 2. Platform-specific: Map category hierarchy
    const categories = await this.akeneoMapper.mapCategories(product.categories);

    // 3. Generic: Map attribute names
    const { attributes } = await this.attributeMapper.processProductAttributes(product.values);

    return {
      attribute_set_id: attributeSet.id,
      category_ids: categories.map(c => c.id),
      attributes: attributes
    };
  }
}
```

---

**This architecture gives you the best of both worlds: simplicity for simple platforms, power for complex ones!** 🎯
