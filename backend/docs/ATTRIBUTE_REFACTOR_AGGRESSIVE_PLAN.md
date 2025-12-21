# Attribute Architecture Refactor - Aggressive Implementation Plan

## Overview
Complete refactor to normalized attribute architecture. No backward compatibility - break and fix approach.

## Phase 1: Database Layer (Foundation)

### Step 1.1: Create Migrations
**File:** `backend/src/migrations/20250115_create_normalized_attributes.js`

```javascript
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add translations to attributes table
    await queryInterface.addColumn('attributes', 'translations', {
      type: Sequelize.JSON,
      defaultValue: {},
      comment: 'Multilingual attribute labels: {"en": {"label": "Brand", "description": "..."}, "nl": {...}}'
    });

    // 2. Create attribute_values table
    await queryInterface.createTable('attribute_values', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'attributes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'URL-friendly code: samsung, black, etc.'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Extra data like hex colors, images, etc.'
      },
      translations: {
        type: Sequelize.JSON,
        defaultValue: {},
        comment: 'Value translations: {"en": {"label": "Black"}, "nl": {"label": "Zwart"}}'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add unique constraint
    await queryInterface.addConstraint('attribute_values', {
      fields: ['attribute_id', 'code'],
      type: 'unique',
      name: 'unique_attribute_code'
    });

    // Add index for faster lookups
    await queryInterface.addIndex('attribute_values', ['attribute_id']);

    // 3. Create product_attribute_values table
    await queryInterface.createTable('product_attribute_values', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'attributes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      value_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'attribute_values',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'For select/multiselect attributes'
      },
      text_value: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'For text attributes'
      },
      number_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'For number attributes'
      },
      date_value: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'For date attributes'
      },
      boolean_value: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        comment: 'For boolean attributes'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for faster queries
    await queryInterface.addIndex('product_attribute_values', ['product_id']);
    await queryInterface.addIndex('product_attribute_values', ['attribute_id']);
    await queryInterface.addIndex('product_attribute_values', ['value_id']);

    // 4. BREAKING: Remove old attributes.options column
    await queryInterface.removeColumn('attributes', 'options');

    // 5. BREAKING: Remove old products.attributes column
    await queryInterface.removeColumn('products', 'attributes');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('product_attribute_values');
    await queryInterface.dropTable('attribute_values');
    await queryInterface.removeColumn('attributes', 'translations');
    // Re-add old columns
    await queryInterface.addColumn('attributes', 'options', {
      type: Sequelize.JSON,
      defaultValue: []
    });
    await queryInterface.addColumn('products', 'attributes', {
      type: Sequelize.JSON,
      defaultValue: {}
    });
  }
};
```

### Step 1.2: Create Sequelize Models

**File:** `backend/src/models/AttributeValue.js`
```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const AttributeValue = sequelize.define('AttributeValue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attribute_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'attributes',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  translations: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Value translations: {"en": {"label": "Black"}, "nl": {"label": "Zwart"}}'
  }
}, {
  tableName: 'attribute_values',
  underscored: true
});

module.exports = AttributeValue;
```

**File:** `backend/src/models/ProductAttributeValue.js`
```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ProductAttributeValue = sequelize.define('ProductAttributeValue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  attribute_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'attributes',
      key: 'id'
    }
  },
  value_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'attribute_values',
      key: 'id'
    }
  },
  text_value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  number_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  date_value: {
    type: DataTypes.DATE,
    allowNull: true
  },
  boolean_value: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  }
}, {
  tableName: 'product_attribute_values',
  underscored: true
});

module.exports = ProductAttributeValue;
```

### Step 1.3: Update Model Relationships

**File:** `backend/src/models/index.js` (or associations file)
```javascript
const Attribute = require('./Attribute');
const AttributeValue = require('./AttributeValue');
const Product = require('./Product');
const ProductAttributeValue = require('./ProductAttributeValue');

// Attribute has many AttributeValues
Attribute.hasMany(AttributeValue, {
  foreignKey: 'attribute_id',
  as: 'values'
});
AttributeValue.belongsTo(Attribute, {
  foreignKey: 'attribute_id'
});

// Product has many ProductAttributeValues
Product.hasMany(ProductAttributeValue, {
  foreignKey: 'product_id',
  as: 'attributeValues'
});
ProductAttributeValue.belongsTo(Product, {
  foreignKey: 'product_id'
});

// ProductAttributeValue belongs to Attribute
ProductAttributeValue.belongsTo(Attribute, {
  foreignKey: 'attribute_id'
});

// ProductAttributeValue belongs to AttributeValue
ProductAttributeValue.belongsTo(AttributeValue, {
  foreignKey: 'value_id',
  as: 'value'
});

module.exports = {
  Attribute,
  AttributeValue,
  Product,
  ProductAttributeValue
};
```

## Phase 2: Backend API

### Step 2.1: Attribute Values Admin Routes

**File:** `backend/src/routes/attribute-values.js`
```javascript
const express = require('express');
const router = express.Router();
const { AttributeValue, Attribute } = require('../models');

// Get all values for an attribute
router.get('/attributes/:attributeId/values', async (req, res) => {
  try {
    const values = await AttributeValue.findAll({
      where: { attribute_id: req.params.attributeId },
      order: [['sort_order', 'ASC']]
    });

    res.json({ success: true, data: values });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create attribute value
router.post('/attributes/:attributeId/values', async (req, res) => {
  try {
    const { code, translations, metadata, sort_order } = req.body;

    const value = await AttributeValue.create({
      attribute_id: req.params.attributeId,
      code,
      translations,
      metadata: metadata || {},
      sort_order: sort_order || 0
    });

    res.json({ success: true, data: value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update attribute value
router.put('/attributes/:attributeId/values/:valueId', async (req, res) => {
  try {
    const value = await AttributeValue.findByPk(req.params.valueId);
    if (!value) {
      return res.status(404).json({ success: false, error: 'Value not found' });
    }

    await value.update(req.body);
    res.json({ success: true, data: value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete attribute value
router.delete('/attributes/:attributeId/values/:valueId', async (req, res) => {
  try {
    const value = await AttributeValue.findByPk(req.params.valueId);
    if (!value) {
      return res.status(404).json({ success: false, error: 'Value not found' });
    }

    await value.destroy();
    res.json({ success: true, message: 'Value deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### Step 2.2: Update Product Routes

**File:** `backend/src/routes/products.js` - Update GET endpoint
```javascript
// Get single product (storefront)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: ProductAttributeValue,
          as: 'attributeValues',
          include: [
            {
              model: Attribute,
              attributes: ['id', 'code', 'type', 'translations']
            },
            {
              model: AttributeValue,
              as: 'value',
              attributes: ['id', 'code', 'translations', 'metadata']
            }
          ]
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Transform to frontend-friendly format
    const currentLang = req.query.lang || 'en';
    const formattedProduct = {
      ...product.toJSON(),
      attributes: product.attributeValues.map(pav => {
        const attr = pav.Attribute;
        const attrLabel = attr.translations?.[currentLang]?.label ||
                         attr.translations?.en?.label ||
                         attr.code;

        let value, valueLabel;
        if (pav.value_id && pav.value) {
          // Select/multiselect attribute
          value = pav.value.code;
          valueLabel = pav.value.translations?.[currentLang]?.label ||
                      pav.value.translations?.en?.label ||
                      pav.value.code;
        } else {
          // Text/number/date/boolean attribute
          value = pav.text_value || pav.number_value || pav.date_value || pav.boolean_value;
          valueLabel = value;
        }

        return {
          code: attr.code,
          label: attrLabel,
          value: valueLabel,
          rawValue: value,
          type: attr.type,
          metadata: pav.value?.metadata || null
        };
      })
    };

    // Remove the raw attributeValues array
    delete formattedProduct.attributeValues;

    res.json({ success: true, data: formattedProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Update POST/PUT endpoints:**
```javascript
// Create/Update product with attributes
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { attributes, ...productData } = req.body;

    // Create product
    const product = await Product.create(productData, { transaction });

    // Create product attribute values
    if (attributes && Array.isArray(attributes)) {
      for (const attr of attributes) {
        const { attribute_id, value_id, text_value, number_value, date_value, boolean_value } = attr;

        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id,
          value_id,
          text_value,
          number_value,
          date_value,
          boolean_value
        }, { transaction });
      }
    }

    await transaction.commit();
    res.json({ success: true, data: product });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { attributes, ...productData } = req.body;
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Update product
    await product.update(productData, { transaction });

    // Delete old attribute values
    await ProductAttributeValue.destroy({
      where: { product_id: product.id },
      transaction
    });

    // Create new attribute values
    if (attributes && Array.isArray(attributes)) {
      for (const attr of attributes) {
        const { attribute_id, value_id, text_value, number_value, date_value, boolean_value } = attr;

        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id,
          value_id,
          text_value,
          number_value,
          date_value,
          boolean_value
        }, { transaction });
      }
    }

    await transaction.commit();
    res.json({ success: true, data: product });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Phase 3: Admin UI

### Step 3.1: Attribute Value Manager Component

**File:** `src/components/admin/AttributeValueManager.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

export default function AttributeValueManager({ attributeId, attribute }) {
  const [values, setValues] = useState([]);
  const [editingValue, setEditingValue] = useState(null);
  const [languages, setLanguages] = useState([]);

  useEffect(() => {
    loadValues();
    loadLanguages();
  }, [attributeId]);

  const loadValues = async () => {
    const response = await apiClient.get(`attributes/${attributeId}/values`);
    if (response.success) {
      setValues(response.data);
    }
  };

  const loadLanguages = async () => {
    const response = await apiClient.get('languages');
    if (response.success) {
      setLanguages(response.data.languages || response.data);
    }
  };

  const handleSave = async (valueData) => {
    if (valueData.id) {
      // Update
      await apiClient.put(`attributes/${attributeId}/values/${valueData.id}`, valueData);
    } else {
      // Create
      await apiClient.post(`attributes/${attributeId}/values`, valueData);
    }
    loadValues();
    setEditingValue(null);
  };

  const handleDelete = async (valueId) => {
    if (confirm('Delete this value? Products using it will be affected.')) {
      await apiClient.delete(`attributes/${attributeId}/values/${valueId}`);
      loadValues();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Attribute Values</h3>
        <button
          onClick={() => setEditingValue({ code: '', translations: {}, metadata: {} })}
          className="btn btn-primary">
          Add Value
        </button>
      </div>

      {/* Values List */}
      <div className="space-y-2">
        {values.map(value => (
          <div key={value.id} className="border p-4 rounded flex justify-between items-center">
            <div>
              <div className="font-medium">{value.code}</div>
              <div className="text-sm text-gray-600">
                {languages.map(lang => (
                  <span key={lang.code} className="mr-4">
                    {lang.code}: {value.translations?.[lang.code]?.label || '-'}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setEditingValue(value)}
                className="btn btn-sm btn-secondary">
                Edit
              </button>
              <button
                onClick={() => handleDelete(value.id)}
                className="btn btn-sm btn-danger">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingValue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h4 className="text-lg font-medium mb-4">
              {editingValue.id ? 'Edit' : 'Add'} Value
            </h4>

            {/* Code */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Code</label>
              <input
                type="text"
                value={editingValue.code}
                onChange={(e) => setEditingValue({ ...editingValue, code: e.target.value })}
                className="input w-full"
                placeholder="e.g., samsung, black"
              />
            </div>

            {/* Translations */}
            {languages.map(lang => (
              <div key={lang.code} className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  {lang.name} Label
                </label>
                <input
                  type="text"
                  value={editingValue.translations?.[lang.code]?.label || ''}
                  onChange={(e) => setEditingValue({
                    ...editingValue,
                    translations: {
                      ...editingValue.translations,
                      [lang.code]: {
                        ...editingValue.translations?.[lang.code],
                        label: e.target.value
                      }
                    }
                  })}
                  className="input w-full"
                  placeholder={`e.g., Samsung, Black (${lang.code})`}
                />
              </div>
            ))}

            {/* Metadata (for colors, etc.) */}
            {attribute?.code === 'color' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Hex Color</label>
                <input
                  type="color"
                  value={editingValue.metadata?.hex || '#000000'}
                  onChange={(e) => setEditingValue({
                    ...editingValue,
                    metadata: { ...editingValue.metadata, hex: e.target.value }
                  })}
                  className="w-full h-10"
                />
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingValue(null)}
                className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleSave(editingValue)}
                className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 3.2: Update Product Form

**File:** `src/components/admin/ProductAttributeSelector.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

export default function ProductAttributeSelector({ productAttributes = [], onChange }) {
  const [attributes, setAttributes] = useState([]);
  const [selectedAttributes, setSelectedAttributes] = useState(productAttributes);

  useEffect(() => {
    loadAttributes();
  }, []);

  const loadAttributes = async () => {
    const response = await apiClient.get('admin/attributes');
    if (response.success) {
      setAttributes(response.data);
    }
  };

  const loadAttributeValues = async (attributeId) => {
    const response = await apiClient.get(`attributes/${attributeId}/values`);
    return response.success ? response.data : [];
  };

  const handleAddAttribute = () => {
    setSelectedAttributes([...selectedAttributes, {
      attribute_id: '',
      value_id: null,
      text_value: null
    }]);
  };

  const handleRemoveAttribute = (index) => {
    const updated = selectedAttributes.filter((_, i) => i !== index);
    setSelectedAttributes(updated);
    onChange(updated);
  };

  const handleAttributeChange = async (index, field, value) => {
    const updated = [...selectedAttributes];
    updated[index] = { ...updated[index], [field]: value };

    // If attribute changed, load its values
    if (field === 'attribute_id') {
      const attr = attributes.find(a => a.id === value);
      if (attr && (attr.type === 'select' || attr.type === 'multiselect')) {
        const values = await loadAttributeValues(value);
        updated[index].availableValues = values;
      }
    }

    setSelectedAttributes(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Product Attributes</h3>
        <button onClick={handleAddAttribute} className="btn btn-primary">
          Add Attribute
        </button>
      </div>

      {selectedAttributes.map((selected, index) => {
        const attribute = attributes.find(a => a.id === selected.attribute_id);

        return (
          <div key={index} className="border p-4 rounded space-y-2">
            {/* Attribute Selector */}
            <div>
              <label className="block text-sm font-medium mb-1">Attribute</label>
              <select
                value={selected.attribute_id}
                onChange={(e) => handleAttributeChange(index, 'attribute_id', e.target.value)}
                className="input w-full">
                <option value="">Select attribute...</option>
                {attributes.map(attr => (
                  <option key={attr.id} value={attr.id}>
                    {attr.translations?.en?.label || attr.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Value Input (conditional on type) */}
            {attribute && (
              <>
                {(attribute.type === 'select' || attribute.type === 'multiselect') && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Value</label>
                    <select
                      value={selected.value_id || ''}
                      onChange={(e) => handleAttributeChange(index, 'value_id', e.target.value)}
                      className="input w-full">
                      <option value="">Select value...</option>
                      {(selected.availableValues || []).map(val => (
                        <option key={val.id} value={val.id}>
                          {val.translations?.en?.label || val.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {attribute.type === 'text' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Value</label>
                    <input
                      type="text"
                      value={selected.text_value || ''}
                      onChange={(e) => handleAttributeChange(index, 'text_value', e.target.value)}
                      className="input w-full"
                    />
                  </div>
                )}

                {attribute.type === 'number' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Value</label>
                    <input
                      type="number"
                      value={selected.number_value || ''}
                      onChange={(e) => handleAttributeChange(index, 'number_value', parseFloat(e.target.value))}
                      className="input w-full"
                    />
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => handleRemoveAttribute(index)}
              className="btn btn-sm btn-danger">
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

## Phase 4: Storefront UI

### Step 4.1: Update ProductTabs Component

**File:** `src/components/storefront/ProductTabs.jsx` - Update attributes useEffect
```javascript
// Render attributes dynamically
useEffect(() => {
  if (!containerRef.current) return;

  const attributesContainers = containerRef.current.querySelectorAll('[data-attributes-container]');
  if (!attributesContainers || attributesContainers.length === 0) return;

  // NEW: Use normalized attributes from API response
  const attributes = product?.attributes || [];

  if (attributes.length === 0) {
    attributesContainers.forEach(container => {
      container.innerHTML = '<p class="text-gray-500">No specifications available for this product.</p>';
    });
    return;
  }

  const attributesHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${attributes.map(attr => `
        <div class="flex justify-between py-2 border-b border-gray-100">
          <span class="font-medium capitalize">${attr.label}</span>
          <span>${attr.value}${attr.metadata?.hex ? ` <span class="inline-block w-4 h-4 rounded" style="background-color: ${attr.metadata.hex}"></span>` : ''}</span>
        </div>
      `).join('')}
    </div>
  `;

  attributesContainers.forEach(container => {
    container.innerHTML = attributesHTML;
  });
}, [product, tabsData, activeTabIndex]);
```

## Phase 5: Data Migration

### Step 5.1: Migration Script

**File:** `backend/migrate-attributes-to-normalized.js`
```javascript
const { Sequelize } = require('sequelize');
const Attribute = require('./src/models/Attribute');
const AttributeValue = require('./src/models/AttributeValue');
const Product = require('./src/models/Product');
const ProductAttributeValue = require('./src/models/ProductAttributeValue');

async function migrateAttributes() {
  console.log('🚀 Starting attribute migration...');

  // Get all products with old attributes JSON
  const products = await Product.findAll({
    where: {
      attributes: {
        [Sequelize.Op.ne]: null
      }
    }
  });

  console.log(`📦 Found ${products.length} products with attributes`);

  // Get all attributes
  const attributes = await Attribute.findAll();
  const attributeMap = {};
  attributes.forEach(attr => {
    attributeMap[attr.code] = attr;
  });

  for (const product of products) {
    console.log(`\n📝 Processing product: ${product.id}`);

    if (!product.attributes || typeof product.attributes !== 'object') {
      continue;
    }

    for (const [attrKey, attrValue] of Object.entries(product.attributes)) {
      const attribute = attributeMap[attrKey];

      if (!attribute) {
        console.warn(`  ⚠️  Attribute "${attrKey}" not found in attributes table, skipping`);
        continue;
      }

      console.log(`  ✓ Processing ${attrKey} = ${attrValue}`);

      if (attribute.type === 'select' || attribute.type === 'multiselect') {
        // Find or create attribute value
        const code = String(attrValue).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        let [attributeValue] = await AttributeValue.findOrCreate({
          where: {
            attribute_id: attribute.id,
            code
          },
          defaults: {
            translations: {
              en: { label: attrValue }
            },
            sort_order: 0
          }
        });

        // Create product attribute value
        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id: attribute.id,
          value_id: attributeValue.id
        });

        console.log(`    → Created with value_id: ${attributeValue.id}`);
      } else {
        // For text/number attributes
        const valueField = attribute.type === 'number' ? 'number_value' : 'text_value';
        const value = attribute.type === 'number' ? parseFloat(attrValue) : attrValue;

        await ProductAttributeValue.create({
          product_id: product.id,
          attribute_id: attribute.id,
          [valueField]: value
        });

        console.log(`    → Created with ${valueField}: ${value}`);
      }
    }
  }

  console.log('\n✅ Migration complete!');
}

// Run migration
migrateAttributes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
```

## Execution Order

1. ✅ Run migration: `node backend/src/migrations/20250115_create_normalized_attributes.js`
2. ✅ Create models: AttributeValue.js, ProductAttributeValue.js
3. ✅ Set up model relationships
4. ✅ Create attribute-values.js routes
5. ✅ Update product routes (GET/POST/PUT)
6. ✅ Run data migration script
7. ✅ Create admin UI components
8. ✅ Update storefront ProductTabs
9. ✅ Test thoroughly
10. ✅ Deploy and monitor for issues

## Breaking Changes to Fix

### Expected Errors:
1. **Products API returns 500** - attributes field missing
   - Fix: Update all product queries to include attributeValues
2. **Admin product form breaks** - can't save attributes
   - Fix: Update ProductForm to use ProductAttributeSelector
3. **Storefront tabs show no attributes** - wrong data structure
   - Fix: Update ProductTabs useEffect to use new format
4. **Filters don't work** - looking for old attributes field
   - Fix: Update filter queries to use product_attribute_values table

## Timeline
- Phase 1 (DB): 2 hours
- Phase 2 (API): 3 hours
- Phase 3 (Admin UI): 4 hours
- Phase 4 (Storefront): 2 hours
- Phase 5 (Migration): 2 hours
- Testing/Fixes: 3 hours

**Total: ~16 hours**

## Ready to Start?

Start with Step 1.1: Create the migration file. This will be the foundation for everything else.
