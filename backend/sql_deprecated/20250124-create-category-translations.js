const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Create category_translations table
    await queryInterface.createTable('category_translations', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: DataTypes.STRING(10),
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Add unique constraint
    await queryInterface.addConstraint('category_translations', {
      fields: ['category_id', 'language_code'],
      type: 'unique',
      name: 'category_translations_unique'
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('category_translations', ['category_id']);
    await queryInterface.addIndex('category_translations', ['language_code']);
    await queryInterface.addIndex('category_translations', ['name']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('category_translations');
  }
};
