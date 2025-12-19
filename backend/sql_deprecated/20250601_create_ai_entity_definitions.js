/**
 * Migration: Create AI Entity Definitions
 * Database-driven entity schemas for dynamic AI admin operations
 *
 * This table stores metadata about all admin entities that AI can interact with,
 * enabling dynamic intent detection and entity operations without hardcoding.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;

    // AI Entity Definitions - Schema for all admin entities
    await queryInterface.createTable('ai_entity_definitions', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      // Entity identification
      entity_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique entity name: product_tabs, seo_settings, languages, etc.'
      },
      display_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Human-readable name: Product Tabs, SEO Settings, etc.'
      },
      description: {
        type: DataTypes.TEXT,
        comment: 'Description of what this entity represents and manages'
      },
      // Database mapping
      table_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Primary database table: product_tabs, seo_settings, etc.'
      },
      related_tables: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Related tables: [{name, relation_type, foreign_key}]'
      },
      // Operations configuration
      supported_operations: {
        type: DataTypes.JSON,
        defaultValue: ['list', 'get', 'create', 'update', 'delete'],
        comment: 'Allowed operations for this entity'
      },
      // Field definitions for AI understanding
      fields: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Field definitions: [{name, type, required, description, ai_hints}]'
      },
      // Primary key configuration
      primary_key: {
        type: DataTypes.STRING(50),
        defaultValue: 'id',
        comment: 'Primary key column name'
      },
      // Tenant isolation
      tenant_column: {
        type: DataTypes.STRING(50),
        defaultValue: 'store_id',
        comment: 'Column used for tenant isolation (null = master DB only)'
      },
      // AI interaction hints
      intent_keywords: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Keywords that trigger this entity: [rename, update, change, modify]'
      },
      example_prompts: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Example user prompts for AI training'
      },
      example_responses: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Example AI responses for training'
      },
      // API configuration
      api_endpoint: {
        type: DataTypes.STRING(255),
        comment: 'REST API endpoint: /api/product-tabs'
      },
      // Validation rules
      validation_rules: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Validation rules for each field'
      },
      // Feature flags
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      requires_confirmation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether changes require user confirmation before applying'
      },
      is_destructive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this entity has destructive operations (delete, etc.)'
      },
      // Category for grouping
      category: {
        type: DataTypes.STRING(100),
        defaultValue: 'general',
        comment: 'Category: products, settings, content, marketing, etc.'
      },
      // Priority for intent matching
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
        comment: 'Priority for intent matching (higher = checked first)'
      },
      // Timestamps
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('ai_entity_definitions', ['entity_name']);
    await queryInterface.addIndex('ai_entity_definitions', ['table_name']);
    await queryInterface.addIndex('ai_entity_definitions', ['category']);
    await queryInterface.addIndex('ai_entity_definitions', ['is_active']);
    await queryInterface.addIndex('ai_entity_definitions', ['priority']);

    console.log('AI Entity Definitions table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_entity_definitions');
    console.log('AI Entity Definitions table dropped');
  }
};
