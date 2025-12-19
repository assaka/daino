module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Starting normalized attributes migration...');

    // 1. Add translations to attributes table
    console.log('📝 Adding translations column to attributes table...');
    await queryInterface.addColumn('attributes', 'translations', {
      type: Sequelize.JSON,
      defaultValue: {},
      comment: 'Multilingual attribute labels: {"en": {"label": "Brand", "description": "..."}, "nl": {...}}'
    });

    // 2. Create attribute_values table
    console.log('📝 Creating attribute_values table...');
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
    console.log('📝 Adding unique constraint to attribute_values...');
    await queryInterface.addConstraint('attribute_values', {
      fields: ['attribute_id', 'code'],
      type: 'unique',
      name: 'unique_attribute_code'
    });

    // Add index for faster lookups
    console.log('📝 Adding index to attribute_values...');
    await queryInterface.addIndex('attribute_values', ['attribute_id']);

    // 3. Create product_attribute_values table
    console.log('📝 Creating product_attribute_values table...');
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
    console.log('📝 Adding indexes to product_attribute_values...');
    await queryInterface.addIndex('product_attribute_values', ['product_id']);
    await queryInterface.addIndex('product_attribute_values', ['attribute_id']);
    await queryInterface.addIndex('product_attribute_values', ['value_id']);

    // 4. BREAKING: Remove old attributes.options column
    console.log('⚠️  Removing old attributes.options column...');
    await queryInterface.removeColumn('attributes', 'options');

    // 5. BREAKING: Remove old products.attributes column
    console.log('⚠️  Removing old products.attributes column...');
    await queryInterface.removeColumn('products', 'attributes');

    console.log('✅ Normalized attributes migration complete!');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rolling back normalized attributes migration...');

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

    console.log('✅ Rollback complete!');
  }
};
