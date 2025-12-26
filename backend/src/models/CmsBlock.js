const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const CmsBlock = sequelize.define('CmsBlock', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  identifier: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  placement: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: ['content']  // Default placement locations as array
  },
  // SEO fields
  meta_title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  meta_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  meta_keywords: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Foreign key
  store_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    }
  }
  // Translations now stored in normalized cms_block_translations table
  // Removed translations JSON column - using normalized table for better search performance
}, {
  tableName: 'cms_blocks',
  indexes: [
    {
      unique: true,
      fields: ['identifier', 'store_id']  // Unique identifier per store
    }
  ]
  // Removed hooks that referenced block.translations
  // Identifier must be provided when creating blocks
});

module.exports = CmsBlock;