'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('slot_configurations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      configuration: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Complete slot configuration JSON including slots, components, and metadata'
      },
      version: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '1.0',
        comment: 'Configuration schema version'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this configuration is currently active'
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

    // Add indexes
    await queryInterface.addIndex('slot_configurations', ['user_id', 'store_id'], {
      unique: true,
      name: 'unique_user_store_config'
    });
    
    await queryInterface.addIndex('slot_configurations', ['store_id'], {
      name: 'idx_store_id'
    });
    
    await queryInterface.addIndex('slot_configurations', ['is_active'], {
      name: 'idx_is_active'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('slot_configurations');
  }
};