'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('redirects', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      source_path: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'The original path that should redirect'
      },
      target_path: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'The new path to redirect to'
      },
      redirect_type: {
        type: Sequelize.ENUM('301', '302'),
        defaultValue: '301',
        allowNull: false,
        comment: '301 for permanent, 302 for temporary'
      },
      entity_type: {
        type: Sequelize.ENUM('category', 'product', 'cms_page'),
        allowNull: true,
        comment: 'Type of entity that created this redirect'
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of the entity that created this redirect'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional notes about why this redirect was created'
      },
      hit_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Number of times this redirect has been used'
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this redirect was last used'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('redirects', ['store_id', 'source_path'], {
      unique: true,
      name: 'idx_redirects_store_source_unique'
    });
    
    await queryInterface.addIndex('redirects', ['store_id', 'is_active'], {
      name: 'idx_redirects_store_active'
    });
    
    await queryInterface.addIndex('redirects', ['entity_type', 'entity_id'], {
      name: 'idx_redirects_entity'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('redirects');
  }
};