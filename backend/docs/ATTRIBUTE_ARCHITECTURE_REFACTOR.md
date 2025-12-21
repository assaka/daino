# Attribute Architecture Refactor - Normalized Approach

## Current Architecture (Problematic)

### Products Table
```json
// products.attributes (JSON column)
{
  "brand": "Samsung",
  "color": "Black",
  "capacity": "500L"
}
```

**Problems:**
- ❌ No referential integrity (can't join to Attribute table)
- ❌ No validation against Attribute.options
- ❌ Can't filter/search efficiently across products
- ❌ Can't translate values centrally
- ❌ Duplicate data if same value used on multiple products
- ❌ No way to change "Black" to "Schwarz" globally

### Attributes Table
```sql
CREATE TABLE attributes (
  id UUID PRIMARY KEY,
  name VARCHAR,        -- "Brand", "Color"
  code VARCHAR UNIQUE, -- "brand", "color"
  type ENUM('text', 'number', 'select', 'multiselect', ...),
  options JSON,        -- ["Samsung", "LG", "Sony"]
  store_id UUID
);
```

**Problems with options JSON:**
- ❌ No translations
- ❌ No metadata (hex codes for colors, images, etc.)
- ❌ No referential integrity

## Proposed Architecture (Normalized)

### 1. Keep Attributes Table (with translations)
```sql
CREATE TABLE attributes (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE NOT NULL,          -- "brand", "color", "capacity"
  type ENUM('text', 'number', 'select', 'multiselect', 'boolean', 'date'),
  is_required BOOLEAN,
  is_filterable BOOLEAN,
  is_searchable BOOLEAN,
  is_configurable BOOLEAN,               -- Can be used for product variants
  sort_order INTEGER,
  store_id UUID,

  -- Add translations column
  translations JSON DEFAULT '{}'         -- {"en": {"label": "Brand"}, "nl": {"label": "Merk"}}
);
```

### 2. NEW: Attribute Values Table
```sql
CREATE TABLE attribute_values (
  id UUID PRIMARY KEY,
  attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE,

  -- For internal reference and API
  code VARCHAR,                          -- "samsung", "black", "500l"

  -- Sorting
  sort_order INTEGER DEFAULT 0,

  -- Metadata (for colors, images, etc.)
  metadata JSON DEFAULT '{}',            -- {"hex": "#000000", "image_url": "..."}

  -- Translations for the value
  translations JSON DEFAULT '{}',        -- {"en": {"label": "Black"}, "nl": {"label": "Zwart"}}

  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(attribute_id, code)
);
```

**Examples:**
```json
// Attribute: brand (select)
// attribute_values entries:
[
  {
    "id": "uuid-1",
    "attribute_id": "brand-attr-uuid",
    "code": "samsung",
    "sort_order": 1,
    "translations": {
      "en": { "label": "Samsung" },
      "nl": { "label": "Samsung" },
      "de": { "label": "Samsung" }
    }
  },
  {
    "id": "uuid-2",
    "attribute_id": "brand-attr-uuid",
    "code": "lg",
    "sort_order": 2,
    "translations": {
      "en": { "label": "LG" },
      "nl": { "label": "LG" },
      "de": { "label": "LG" }
    }
  }
]

// Attribute: color (select)
[
  {
    "id": "uuid-3",
    "attribute_id": "color-attr-uuid",
    "code": "black",
    "metadata": { "hex": "#000000" },
    "translations": {
      "en": { "label": "Black" },
      "nl": { "label": "Zwart" },
      "de": { "label": "Schwarz" }
    }
  }
]
```

### 3. NEW: Product Attribute Values Table (Bridge Table)
```sql
CREATE TABLE product_attribute_values (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID REFERENCES attributes(id) ON DELETE CASCADE,

  -- For select/multiselect attributes - reference to attribute_values
  value_id UUID REFERENCES attribute_values(id) ON DELETE SET NULL,

  -- For text/number/date attributes - direct value storage
  text_value TEXT,
  number_value DECIMAL(10,2),
  date_value DATE,
  boolean_value BOOLEAN,

  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(product_id, attribute_id, value_id)
);
```

**Examples:**
```json
// Product "Samsung RS66A8101B1" has:
[
  {
    "product_id": "product-uuid",
    "attribute_id": "brand-attr-uuid",
    "value_id": "uuid-1"  // Points to Samsung in attribute_values
  },
  {
    "product_id": "product-uuid",
    "attribute_id": "color-attr-uuid",
    "value_id": "uuid-3"  // Points to Black in attribute_values
  },
  {
    "product_id": "product-uuid",
    "attribute_id": "capacity-attr-uuid",
    "text_value": "500L"  // Free text, no value_id
  },
  {
    "product_id": "product-uuid",
    "attribute_id": "weight-attr-uuid",
    "number_value": 95.5  // Numeric value
  }
]
```

### 4. Remove products.attributes JSON column (optional)
Can keep it for backwards compatibility but prefer using product_attribute_values.

## Benefits of This Approach

### 1. **Centralized Translations**
```sql
-- Change "Black" to "Zwart" globally for all products
UPDATE attribute_values
SET translations = jsonb_set(translations, '{nl,label}', '"Zwart"')
WHERE code = 'black';
```

### 2. **Efficient Filtering**
```sql
-- Find all Samsung products
SELECT p.* FROM products p
JOIN product_attribute_values pav ON p.id = pav.product_id
JOIN attribute_values av ON pav.value_id = av.id
JOIN attributes a ON av.attribute_id = a.id
WHERE a.code = 'brand' AND av.code = 'samsung';

-- Find all Black products
SELECT p.* FROM products p
JOIN product_attribute_values pav ON p.id = pav.product_id
JOIN attribute_values av ON pav.value_id = av.id
JOIN attributes a ON av.attribute_id = a.id
WHERE a.code = 'color' AND av.code = 'black';
```

### 3. **Faceted Search / Filters**
```sql
-- Get all unique brands with product counts
SELECT
  av.code,
  av.translations->>'en' as label,
  COUNT(DISTINCT pav.product_id) as product_count
FROM attribute_values av
JOIN attributes a ON av.attribute_id = a.id
JOIN product_attribute_values pav ON av.id = pav.value_id
WHERE a.code = 'brand'
  AND a.is_filterable = true
GROUP BY av.id
ORDER BY av.sort_order;
```

### 4. **Configurable Products (Variants)**
```sql
-- Get all color options for a configurable product
SELECT av.code, av.translations, av.metadata
FROM attribute_values av
JOIN product_attribute_values pav ON av.id = pav.value_id
JOIN products p ON pav.product_id = p.id
WHERE p.parent_id = 'configurable-product-uuid'
  AND pav.attribute_id = 'color-attr-uuid';
```

## Migration Strategy

### Phase 1: Create New Tables (Non-Breaking)
1. Create `attribute_values` table
2. Create `product_attribute_values` table
3. Add `translations` to `attributes` table
4. Keep existing `products.attributes` JSON for backwards compatibility

### Phase 2: Migrate Data
```javascript
// Script: backend/migrate-to-normalized-attributes.js

async function migrateAttributes() {
  const products = await Product.findAll();
  const attributes = await Attribute.findAll();

  for (const product of products) {
    if (!product.attributes) continue;

    for (const [attrKey, attrValue] of Object.entries(product.attributes)) {
      // Find the attribute by code
      const attribute = attributes.find(a => a.code === attrKey);
      if (!attribute) {
        console.warn(`Attribute ${attrKey} not found in attributes table`);
        continue;
      }

      if (attribute.type === 'select' || attribute.type === 'multiselect') {
        // Find or create attribute_value
        let [attrValue, created] = await AttributeValue.findOrCreate({
          where: {
            attribute_id: attribute.id,
            code: attrValue.toLowerCase().replace(/\s+/g, '-')
          },
          defaults: {
            translations: {
              en: { label: attrValue }
            }
          }
        });

        // Create product_attribute_values entry
        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id: attribute.id,
          value_id: attrValue.id
        });
      } else {
        // For text/number attributes, store direct value
        const valueField = attribute.type === 'number' ? 'number_value' : 'text_value';

        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id: attribute.id,
          [valueField]: attrValue
        });
      }
    }
  }
}
```

### Phase 3: Update Application Code
1. Update backend API to read from `product_attribute_values`
2. Update admin to manage attribute values with translations
3. Update storefront to display translated attributes
4. Update filters to use normalized structure

### Phase 4: Deprecate Old Structure (Optional)
1. Remove `products.attributes` JSON column
2. Remove `attributes.options` JSON column

## API Response Structure

### Get Product (Storefront)
```json
{
  "id": "product-uuid",
  "name": "Samsung RS66A8101B1",
  "attributes": [
    {
      "code": "brand",
      "label": "Merk",              // Translated attribute name
      "value": "Samsung",           // Translated value
      "metadata": null,
      "type": "select"
    },
    {
      "code": "color",
      "label": "Kleur",
      "value": "Zwart",
      "metadata": { "hex": "#000000" },
      "type": "select"
    },
    {
      "code": "capacity",
      "label": "Capaciteit",
      "value": "500L",
      "metadata": null,
      "type": "text"
    }
  ]
}
```

### Get Attribute Values (Admin)
```json
// GET /api/admin/attributes/:id/values
{
  "success": true,
  "data": {
    "attribute": {
      "id": "brand-uuid",
      "code": "brand",
      "translations": {
        "en": { "label": "Brand" },
        "nl": { "label": "Merk" }
      }
    },
    "values": [
      {
        "id": "value-1",
        "code": "samsung",
        "sort_order": 1,
        "translations": {
          "en": { "label": "Samsung" },
          "nl": { "label": "Samsung" }
        }
      },
      {
        "id": "value-2",
        "code": "lg",
        "sort_order": 2,
        "translations": {
          "en": { "label": "LG" },
          "nl": { "label": "LG" }
        }
      }
    ]
  }
}
```

## Code Changes Required

### 1. New Models
- `backend/src/models/AttributeValue.js`
- `backend/src/models/ProductAttributeValue.js`

### 2. New Routes
- `POST /api/admin/attributes/:id/values` - Create attribute value
- `GET /api/admin/attributes/:id/values` - List attribute values
- `PUT /api/admin/attributes/:id/values/:valueId` - Update attribute value
- `DELETE /api/admin/attributes/:id/values/:valueId` - Delete attribute value

### 3. Update Existing Routes
- `GET /api/storefront/products/:id` - Include normalized attributes
- `POST /api/admin/products` - Save to product_attribute_values
- `PUT /api/admin/products/:id` - Update product_attribute_values

### 4. Admin UI Components
- `AttributeValueManager.jsx` - Manage values for select attributes
- `ProductAttributeSelector.jsx` - Select attribute values when editing products
- Update `EntityTranslationTabs.jsx` to show attribute translations

### 5. Storefront Components
- Update `ProductTabs.jsx` to use normalized attributes
- Update filter components to use attribute_values

## Timeline Estimate

- **Phase 1 (Tables)**: 2-4 hours
- **Phase 2 (Migration)**: 4-8 hours
- **Phase 3 (API/UI)**: 8-16 hours
- **Phase 4 (Cleanup)**: 2-4 hours

**Total: 16-32 hours**

## Recommendation

This normalized approach is the **proper e-commerce architecture** used by Magento, Shopware, and other enterprise platforms. It provides:

✅ Centralized translations
✅ Efficient filtering and search
✅ Referential integrity
✅ Scalability
✅ Proper variant management

**Start with Phase 1 & 2** to get the foundation in place, then gradually migrate the UI (Phase 3).
