# Attribute Translation Implementation Plan

## Current State

### Product Model
- **`attributes`** (JSON): Stores key-value pairs like `{"brand": "Samsung", "color": "Black"}`
- **`translations`** (JSON): Stores product name/description translations
- Structure: `{"en": {"name": "...", "description": "..."}, "nl": {...}}`

### Attribute Model
- **`name`**: Attribute display name (e.g., "Brand")
- **`code`**: Unique code (e.g., "brand")
- **`options`**: JSON array for select/multiselect types

## Implementation Strategy

### Option 1: Extend Product Translations (RECOMMENDED)
Store attribute translations in the existing `product.translations` field.

**Pros:**
- No database migration needed
- Translations are product-specific
- Follows existing translation pattern
- Easy to implement

**Cons:**
- Not reusable across products
- Duplication if same attribute appears on multiple products

**Structure:**
```json
{
  "en": {
    "name": "Samsung Refrigerator",
    "description": "...",
    "short_description": "...",
    "attributes": {
      "brand": {
        "label": "Brand",
        "value": "Samsung"
      },
      "color": {
        "label": "Color",
        "value": "Black"
      },
      "capacity": {
        "label": "Capacity",
        "value": "500L"
      }
    }
  },
  "nl": {
    "name": "Samsung Koelkast",
    "description": "...",
    "short_description": "...",
    "attributes": {
      "brand": {
        "label": "Merk",
        "value": "Samsung"
      },
      "color": {
        "label": "Kleur",
        "value": "Zwart"
      },
      "capacity": {
        "label": "Capaciteit",
        "value": "500L"
      }
    }
  }
}
```

### Option 2: Add Translations to Attribute Model
Add a `translations` JSONB column to the `attributes` table for global attribute label translations.

**Pros:**
- Reusable across all products
- Single source of truth
- More efficient for common attributes

**Cons:**
- Requires database migration
- Doesn't translate attribute VALUES (only labels)
- Still need per-product value translations

**Structure (Attribute table):**
```json
// In attributes table
{
  "en": {
    "label": "Brand",
    "description": "Product manufacturer"
  },
  "nl": {
    "label": "Merk",
    "description": "Productfabrikant"
  }
}
```

**Structure (Product translations for values):**
```json
// In products.translations
{
  "en": {
    "attribute_values": {
      "brand": "Samsung",
      "color": "Black"
    }
  },
  "nl": {
    "attribute_values": {
      "brand": "Samsung",  // Brand names often stay same
      "color": "Zwart"
    }
  }
}
```

### Option 3: Hybrid Approach (MOST FLEXIBLE)
Combine both approaches:
- Global attribute label translations in `attributes` table
- Product-specific value translations in `products.translations`

**Pros:**
- Best of both worlds
- Reusable labels, custom values
- Most flexible and maintainable

**Cons:**
- More complex implementation
- Requires database migration

## Recommended Implementation Steps

### Phase 1: Extend Product Translations (Quick Win)
1. Update admin product form to include attribute translation fields
2. Modify backend product routes to save attribute translations
3. Update storefront ProductTabs component to use translated attributes
4. Add helper function to get translated attribute

### Phase 2: Add Global Attribute Translations (Optional Enhancement)
1. Add migration to add `translations` column to `attributes` table
2. Create admin interface to manage attribute translations
3. Update attribute API endpoints
4. Modify ProductTabs to use global + product-specific translations

## Implementation Code Examples

### Frontend: Admin Product Form
```jsx
// In EntityTranslationTabs.jsx or ProductForm.jsx
<div className="space-y-4">
  <h3>Attribute Translations</h3>
  {Object.keys(product.attributes || {}).map(attrKey => (
    <div key={attrKey} className="border p-4 rounded">
      <h4 className="font-medium">{attrKey}</h4>
      {languages.map(lang => (
        <div key={lang.code}>
          <label>{lang.name} Label</label>
          <input
            value={translations[lang.code]?.attributes?.[attrKey]?.label || ''}
            onChange={(e) => handleAttributeTranslation(lang.code, attrKey, 'label', e.target.value)}
          />
          <label>{lang.name} Value</label>
          <input
            value={translations[lang.code]?.attributes?.[attrKey]?.value || ''}
            onChange={(e) => handleAttributeTranslation(lang.code, attrKey, 'value', e.target.value)}
          />
        </div>
      ))}
    </div>
  ))}
</div>
```

### Backend: Product Routes
```javascript
// In backend/src/routes/products.js
// When saving product, ensure attributes translations are included
router.put('/:id', async (req, res) => {
  const { translations } = req.body;

  // Validate translations structure includes attributes
  // translations[lang].attributes[key] = { label: '...', value: '...' }

  await product.update({ translations });
  res.json({ success: true, data: product });
});
```

### Frontend: ProductTabs Component
```javascript
// In ProductTabs.jsx - Update the attributes useEffect
useEffect(() => {
  if (!containerRef.current || !product?.attributes) return;

  const attributesContainers = containerRef.current.querySelectorAll('[data-attributes-container]');
  if (!attributesContainers || attributesContainers.length === 0) return;

  const attributes = product.attributes;
  const currentLang = getCurrentLanguage();

  // Get translations for current language
  const attributeTranslations = product.translations?.[currentLang]?.attributes || {};

  if (!attributes || Object.keys(attributes).length === 0) {
    attributesContainers.forEach(container => {
      container.innerHTML = '<p class="text-gray-500">No specifications available for this product.</p>';
    });
    return;
  }

  const attributesHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${Object.entries(attributes).map(([key, value]) => {
        // Get translated label and value, fallback to original
        const translatedLabel = attributeTranslations[key]?.label || key.replace(/_/g, ' ');
        const translatedValue = attributeTranslations[key]?.value || value;

        return `
          <div class="flex justify-between py-2 border-b border-gray-100">
            <span class="font-medium capitalize">${translatedLabel}</span>
            <span>${String(translatedValue ?? '')}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  attributesContainers.forEach(container => {
    container.innerHTML = attributesHTML;
  });
}, [product, tabsData, activeTabIndex, currentLang]);
```

### Helper Utility Function
```javascript
// Create src/utils/attributeTranslationUtils.js
import { getCurrentLanguage } from './translationUtils';

/**
 * Get translated attribute label and value
 * @param {string} attributeKey - Attribute key (e.g., "brand")
 * @param {*} attributeValue - Original attribute value
 * @param {Object} product - Product object with translations
 * @param {string} lang - Language code (optional, defaults to current)
 * @returns {Object} { label: string, value: string }
 */
export function getTranslatedAttribute(attributeKey, attributeValue, product, lang = null) {
  const currentLang = lang || getCurrentLanguage();

  // Get attribute translations for current language
  const attributeTranslations = product.translations?.[currentLang]?.attributes || {};
  const attrTranslation = attributeTranslations[attributeKey] || {};

  // Fallback chain: translation → original → formatted key
  const label = attrTranslation.label || attributeKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const value = attrTranslation.value || attributeValue;

  return { label, value };
}

/**
 * Get all translated attributes for a product
 * @param {Object} product - Product object
 * @param {string} lang - Language code (optional)
 * @returns {Array} Array of { key, label, value } objects
 */
export function getAllTranslatedAttributes(product, lang = null) {
  if (!product?.attributes || Object.keys(product.attributes).length === 0) {
    return [];
  }

  return Object.entries(product.attributes).map(([key, value]) => {
    const { label, value: translatedValue } = getTranslatedAttribute(key, value, product, lang);
    return { key, label, value: translatedValue };
  });
}
```

## Database Migration (Phase 2 - Optional)

```javascript
// backend/migrations/YYYYMMDD-add-translations-to-attributes.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('attributes', 'translations', {
      type: Sequelize.JSON,
      defaultValue: {},
      comment: 'Multilingual translations for attribute labels'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('attributes', 'translations');
  }
};
```

## Testing Checklist

- [ ] Admin can add attribute translations for each language
- [ ] Attribute translations are saved to database
- [ ] Storefront displays translated attribute labels
- [ ] Storefront displays translated attribute values
- [ ] Fallback works when translation missing
- [ ] Language switching updates attribute display
- [ ] Works on both desktop and mobile layouts
- [ ] Works with different attribute types (text, select, etc.)

## Migration Path for Existing Data

If you have existing products with untranslated attributes:

```javascript
// Script: backend/migrate-attribute-translations.js
const Product = require('./models/Product');

async function migrateAttributeTranslations() {
  const products = await Product.findAll();

  for (const product of products) {
    if (!product.attributes || Object.keys(product.attributes).length === 0) continue;

    const translations = product.translations || {};

    // For each language, copy attributes to translation structure
    for (const lang of ['en', 'nl']) {
      if (!translations[lang]) translations[lang] = {};
      if (!translations[lang].attributes) translations[lang].attributes = {};

      // Copy original attributes as English translations
      for (const [key, value] of Object.entries(product.attributes)) {
        translations[lang].attributes[key] = {
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: value
        };
      }
    }

    await product.update({ translations });
    console.log(`Migrated attributes for product: ${product.id}`);
  }
}
```

## Next Steps

1. **Choose approach**: Recommend starting with Phase 1 (product translations)
2. **Update admin form**: Add attribute translation fields to product editor
3. **Update backend**: Ensure attribute translations are saved
4. **Update storefront**: Implement translated attribute rendering in ProductTabs
5. **Test thoroughly**: Verify translations work across languages
6. **Phase 2 (optional)**: Add global attribute translations if needed
