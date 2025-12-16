const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ProductTab = sequelize.define('ProductTab', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  store_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: function() {
      return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  tab_type: {
    type: DataTypes.STRING,
    defaultValue: 'text',
    allowNull: false,
    validate: {
      isIn: [['text', 'description', 'attributes', 'attribute_set', 'attribute_sets']] // attribute_sets kept for backward compat
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attribute_ids: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  attribute_set_ids: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  translations: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Multilingual translations: {"en": {"name": "...", "content": "..."}, "nl": {...}}'
  }
}, {
  tableName: 'product_tabs',
  indexes: [
    {
      unique: true,
      fields: ['store_id', 'slug']
    }
  ],
  hooks: {
    beforeCreate: (tab) => {
      console.log('🔧 ProductTab beforeCreate hook:', { name: tab.name, slug: tab.slug, tab_type: tab.tab_type });
      
      // Always generate slug if not provided
      if (!tab.slug && tab.name) {
        tab.slug = tab.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        console.log('✅ Generated slug from name:', tab.slug);
      }
      // Fallback: if still no slug, generate one from tab type
      if (!tab.slug) {
        tab.slug = `${tab.tab_type || 'tab'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('⚠️ Generated fallback slug:', tab.slug);
      }
      
      console.log('🎯 Final slug before create:', tab.slug);
    },
    beforeUpdate: (tab) => {
      console.log('🔧 ProductTab beforeUpdate hook:', { name: tab.name, slug: tab.slug, changed: tab.changed() });
      
      if (tab.changed('name') && !tab.changed('slug')) {
        tab.slug = tab.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        console.log('✅ Updated slug from name change:', tab.slug);
      }
      // Ensure slug is never null
      if (!tab.slug) {
        tab.slug = `${tab.tab_type || 'tab'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('⚠️ Generated fallback slug on update:', tab.slug);
      }
    },
    beforeValidate: (tab) => {
      console.log('🔧 ProductTab beforeValidate hook:', { name: tab.name, slug: tab.slug });
      
      // Final safety check before validation
      if (!tab.slug && tab.name) {
        tab.slug = tab.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        console.log('✅ Generated slug in beforeValidate from name:', tab.slug);
      }
      if (!tab.slug) {
        tab.slug = `${tab.tab_type || 'tab'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('⚠️ Generated final fallback slug in beforeValidate:', tab.slug);
      }
      
      console.log('🎯 Final slug before validation:', tab.slug);
    },
    beforeSave: (tab) => {
      console.log('🔧 ProductTab beforeSave hook (last chance):', { name: tab.name, slug: tab.slug });
      
      // Absolute final check - this should never be null when saving
      if (!tab.slug) {
        tab.slug = `emergency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('🚨 EMERGENCY: Generated emergency slug in beforeSave:', tab.slug);
      }
    }
  }
});

module.exports = ProductTab;