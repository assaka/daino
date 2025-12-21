# Akeneo Import Refactor Notes

## TODO: Update After Attribute Architecture Refactor

Once the normalized attribute architecture is implemented, the Akeneo import system needs to be updated to:

## 1. Import Attributes and Attribute Values

### Current Akeneo Structure
```json
{
  "code": "color",
  "type": "pim_catalog_simpleselect",
  "labels": {
    "en_US": "Color",
    "nl_NL": "Kleur"
  },
  "options": [
    {
      "code": "black",
      "labels": {
        "en_US": "Black",
        "nl_NL": "Zwart"
      }
    }
  ]
}
```

### Required Mapping
- Akeneo Attribute → `attributes` table with `translations`
- Akeneo Attribute Options → `attribute_values` table with `translations`
- Map Akeneo locale codes (en_US, nl_NL) to system locales (en, nl)

## 2. Import Configurable Products (Product Models)

### Akeneo Product Model Structure
```json
{
  "code": "samsung_fridge",
  "family": "refrigerators",
  "family_variant": "fridge_by_color_size",
  "values": {
    "brand": [{"data": "Samsung"}],
    "description": [{"locale": "en_US", "data": "Great fridge"}]
  },
  "categories": ["refrigerators"]
}
```

### Akeneo Product Variant Structure
```json
{
  "identifier": "samsung_fridge_black_500l",
  "parent": "samsung_fridge",
  "family": "refrigerators",
  "values": {
    "color": [{"data": "black"}],
    "capacity": [{"data": "500L"}],
    "sku": [{"data": "SAM-FRIDGE-BLK-500"}]
  }
}
```

### Required Mapping
- Akeneo Product Model → Product (type: 'configurable')
- Akeneo Product Variants → Product (type: 'simple', parent_id: configurable product)
- Akeneo family_variant attributes → Product.configurable_attributes
- Link variant attributes to AttributeValue via ProductAttributeValue

## 3. Update Import Scripts

### Files to Update
- `backend/src/services/akeneo/attributeImporter.js` - NEW
- `backend/src/services/akeneo/productImporter.js` - UPDATE
- `backend/src/services/akeneo/configurableProductImporter.js` - NEW

### Key Changes

#### attributeImporter.js (NEW)
```javascript
async function importAkeneoAttributes(akeneoClient) {
  const akeneoAttributes = await akeneoClient.getAttributes();

  for (const akeneoAttr of akeneoAttributes) {
    // Map Akeneo type to system type
    const type = mapAkeneoType(akeneoAttr.type);

    // Create/update attribute with translations
    const attribute = await Attribute.upsert({
      code: akeneoAttr.code,
      type,
      translations: mapAkeneoLabels(akeneoAttr.labels)
    });

    // Import attribute options/values for select types
    if (akeneoAttr.options) {
      for (const option of akeneoAttr.options) {
        await AttributeValue.upsert({
          attribute_id: attribute.id,
          code: option.code,
          translations: mapAkeneoLabels(option.labels)
        });
      }
    }
  }
}

function mapAkeneoType(akeneoType) {
  const typeMap = {
    'pim_catalog_simpleselect': 'select',
    'pim_catalog_multiselect': 'multiselect',
    'pim_catalog_text': 'text',
    'pim_catalog_textarea': 'text',
    'pim_catalog_number': 'number',
    'pim_catalog_boolean': 'boolean',
    'pim_catalog_date': 'date'
  };
  return typeMap[akeneoType] || 'text';
}

function mapAkeneoLabels(akeneoLabels) {
  // Convert en_US → en, nl_NL → nl
  const translations = {};
  for (const [locale, label] of Object.entries(akeneoLabels)) {
    const langCode = locale.split('_')[0]; // en_US → en
    translations[langCode] = { label };
  }
  return translations;
}
```

#### productImporter.js (UPDATE)
```javascript
async function importAkeneoProduct(akeneoProduct) {
  const transaction = await sequelize.transaction();

  try {
    // Import base product
    const product = await Product.upsert({
      sku: akeneoProduct.identifier,
      type: akeneoProduct.parent ? 'simple' : 'configurable',
      parent_id: akeneoProduct.parent ? findParentId(akeneoProduct.parent) : null,
      translations: extractTranslations(akeneoProduct.values)
    }, { transaction });

    // Import product attributes using normalized structure
    await importProductAttributes(product.id, akeneoProduct.values, transaction);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function importProductAttributes(productId, akeneoValues, transaction) {
  for (const [attrCode, values] of Object.entries(akeneoValues)) {
    const attribute = await Attribute.findOne({ where: { code: attrCode } });
    if (!attribute) continue;

    for (const value of values) {
      if (attribute.type === 'select' || attribute.type === 'multiselect') {
        // Find attribute value by code
        const attributeValue = await AttributeValue.findOne({
          where: {
            attribute_id: attribute.id,
            code: value.data
          }
        });

        if (attributeValue) {
          await ProductAttributeValue.create({
            product_id: productId,
            attribute_id: attribute.id,
            value_id: attributeValue.id
          }, { transaction });
        }
      } else {
        // Store direct value for text/number
        const valueField = attribute.type === 'number' ? 'number_value' : 'text_value';
        await ProductAttributeValue.create({
          product_id: productId,
          attribute_id: attribute.id,
          [valueField]: value.data
        }, { transaction });
      }
    }
  }
}
```

#### configurableProductImporter.js (NEW)
```javascript
async function importAkeneoProductModel(akeneoModel) {
  // Create parent configurable product
  const configurableProduct = await Product.create({
    sku: akeneoModel.code,
    type: 'configurable',
    translations: extractTranslations(akeneoModel.values),
    configurable_attributes: extractConfigurableAttributes(akeneoModel.family_variant)
  });

  // Import all variants
  const variants = await akeneoClient.getProductsByParent(akeneoModel.code);
  for (const variant of variants) {
    await importAkeneoProduct(variant);
  }

  return configurableProduct;
}

async function extractConfigurableAttributes(familyVariantCode) {
  const familyVariant = await akeneoClient.getFamilyVariant(familyVariantCode);
  const variantAttributes = familyVariant.variant_attribute_sets[0].attributes;

  // Map to attribute IDs
  const attributeIds = [];
  for (const attrCode of variantAttributes) {
    const attr = await Attribute.findOne({ where: { code: attrCode } });
    if (attr) attributeIds.push(attr.id);
  }

  return attributeIds;
}
```

## 4. Import Command Updates

### CLI Command
```bash
# Full import with attributes
node backend/scripts/import-from-akeneo.js --full

# Just attributes
node backend/scripts/import-from-akeneo.js --attributes-only

# Just products (assumes attributes already imported)
node backend/scripts/import-from-akeneo.js --products-only
```

## 5. Testing Checklist

After implementing:
- [ ] Akeneo attributes imported to `attributes` table with translations
- [ ] Akeneo attribute options imported to `attribute_values` with translations
- [ ] Simple products imported with correct attribute values
- [ ] Product models imported as configurable products
- [ ] Product variants linked to parent via parent_id
- [ ] Configurable attributes stored correctly
- [ ] All translations preserved (en, nl, etc.)
- [ ] Attribute filters work with imported data
- [ ] Product variants switch correctly on storefront

## 6. Data Integrity Considerations

- **Incremental imports**: Handle updates without duplicating attribute values
- **Deleted products**: Handle Akeneo products that no longer exist
- **Attribute changes**: Handle when Akeneo attribute types change
- **Missing attributes**: Log warnings for unmapped attributes
- **Locale mapping**: Ensure en_US, en_GB both map to 'en'

## 7. Future Enhancements

- Scheduled imports (cron job)
- Webhook support for real-time sync
- Import progress tracking
- Conflict resolution UI
- Dry-run mode for testing imports

## Priority: AFTER Attribute Architecture Refactor

This work should be done **AFTER** the normalized attribute architecture is fully implemented and tested. The current Akeneo import will break once the `products.attributes` JSON column is removed.

## Estimated Effort

- Attribute importer: 4 hours
- Product importer updates: 6 hours
- Configurable product importer: 8 hours
- Testing and fixes: 6 hours

**Total: ~24 hours**
