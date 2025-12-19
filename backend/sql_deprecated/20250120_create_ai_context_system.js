/**
 * Migration: Create AI Context System
 * Database-backed context for AI plugin generation with RAG support
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;

    // 1. AI Context Documents - Main knowledge base
    await queryInterface.createTable('ai_context_documents', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Type: architecture, api_reference, best_practices, tutorial, etc.'
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Markdown or plain text content'
      },
      category: {
        type: DataTypes.STRING(100),
        comment: 'commerce, marketing, analytics, integration, core'
      },
      tags: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Array of tags for filtering'
      },
      metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Additional metadata (author, source, version, etc.)'
      },
      priority: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Higher priority = more important for context'
      },
      mode: {
        type: DataTypes.STRING(50),
        comment: 'Which builder mode: nocode, developer, all'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      store_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Null = global, otherwise store-specific'
      },
      embedding_vector: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON array of vector embeddings for RAG (future use)'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('ai_context_documents', ['type', 'is_active']);
    await queryInterface.addIndex('ai_context_documents', ['category']);
    await queryInterface.addIndex('ai_context_documents', ['mode']);
    await queryInterface.addIndex('ai_context_documents', ['store_id']);
    await queryInterface.addIndex('ai_context_documents', ['priority']);

    // 2. AI Plugin Examples - Real working plugin code
    await queryInterface.createTable('ai_plugin_examples', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      description: {
        type: DataTypes.TEXT
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      complexity: {
        type: DataTypes.ENUM('simple', 'intermediate', 'advanced'),
        defaultValue: 'simple'
      },
      code: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Complete plugin code'
      },
      files: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Array of {name, code, description}'
      },
      features: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'List of features this plugin demonstrates'
      },
      use_cases: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'When to use this plugin pattern'
      },
      tags: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'How many times this was used as reference'
      },
      rating: {
        type: DataTypes.DECIMAL(3, 2),
        comment: 'Quality rating (1-5)'
      },
      is_template: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Can be used as starting template'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      embedding_vector: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('ai_plugin_examples', ['category', 'is_active']);
    await queryInterface.addIndex('ai_plugin_examples', ['complexity']);
    await queryInterface.addIndex('ai_plugin_examples', ['is_template']);
    await queryInterface.addIndex('ai_plugin_examples', ['usage_count']);

    // 3. AI Code Patterns - Reusable snippets
    await queryInterface.createTable('ai_code_patterns', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      pattern_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'database, api, validation, ui_component, email, etc.'
      },
      description: {
        type: DataTypes.TEXT
      },
      code: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      language: {
        type: DataTypes.STRING(50),
        defaultValue: 'javascript'
      },
      framework: {
        type: DataTypes.STRING(100),
        comment: 'sequelize, express, react, etc.'
      },
      parameters: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Required/optional parameters'
      },
      example_usage: {
        type: DataTypes.TEXT,
        comment: 'How to use this pattern'
      },
      tags: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      embedding_vector: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('ai_code_patterns', ['pattern_type', 'is_active']);
    await queryInterface.addIndex('ai_code_patterns', ['framework']);

    // 4. AI User Preferences - Remember user choices
    await queryInterface.createTable('ai_user_preferences', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Null for anonymous sessions'
      },
      session_id: {
        type: DataTypes.STRING(255),
        comment: 'For tracking anonymous users'
      },
      store_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      preferred_mode: {
        type: DataTypes.STRING(50),
        comment: 'nocode, developer'
      },
      coding_style: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Preferences: indentation, quotes, naming conventions'
      },
      favorite_patterns: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Array of pattern IDs user frequently uses'
      },
      recent_plugins: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Recently created plugin types'
      },
      categories_interest: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Categories user works with most'
      },
      context_preferences: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'What context to include/exclude'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('ai_user_preferences', ['user_id']);
    await queryInterface.addIndex('ai_user_preferences', ['session_id']);
    await queryInterface.addIndex('ai_user_preferences', ['store_id']);

    // 5. AI Context Usage - Track what context is helpful
    await queryInterface.createTable('ai_context_usage', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      document_id: {
        type: DataTypes.INTEGER,
        comment: 'Reference to ai_context_documents'
      },
      example_id: {
        type: DataTypes.INTEGER,
        comment: 'Reference to ai_plugin_examples'
      },
      pattern_id: {
        type: DataTypes.INTEGER,
        comment: 'Reference to ai_code_patterns'
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      session_id: {
        type: DataTypes.STRING(255)
      },
      query: {
        type: DataTypes.TEXT,
        comment: 'User query that triggered this context'
      },
      was_helpful: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: 'User feedback'
      },
      generated_plugin_id: {
        type: DataTypes.INTEGER,
        comment: 'Link to created plugin if successful'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('ai_context_usage', ['document_id']);
    await queryInterface.addIndex('ai_context_usage', ['example_id']);
    await queryInterface.addIndex('ai_context_usage', ['pattern_id']);
    await queryInterface.addIndex('ai_context_usage', ['created_at']);

    console.log('✅ AI Context System tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ai_context_usage');
    await queryInterface.dropTable('ai_user_preferences');
    await queryInterface.dropTable('ai_code_patterns');
    await queryInterface.dropTable('ai_plugin_examples');
    await queryInterface.dropTable('ai_context_documents');
    console.log('✅ AI Context System tables dropped');
  }
};
