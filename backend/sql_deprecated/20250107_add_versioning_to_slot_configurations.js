'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns for versioning
    await queryInterface.addColumn('slot_configurations', 'status', {
      type: Sequelize.ENUM('draft', 'published', 'reverted'),
      allowNull: false,
      defaultValue: 'published',
      comment: 'Status of the configuration version'
    });

    await queryInterface.addColumn('slot_configurations', 'version_number', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Version number for tracking configuration history'
    });

    await queryInterface.addColumn('slot_configurations', 'page_type', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Type of page this configuration applies to (e.g., cart, checkout)'
    });

    await queryInterface.addColumn('slot_configurations', 'published_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when this version was published'
    });

    await queryInterface.addColumn('slot_configurations', 'published_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'User who published this version'
    });

    await queryInterface.addColumn('slot_configurations', 'parent_version_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'slot_configurations',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Reference to the parent version this was based on'
    });

    // Remove the unique constraint on user_id and store_id
    await queryInterface.removeIndex('slot_configurations', 'unique_user_store_config');

    // Add new indexes for versioning
    await queryInterface.addIndex('slot_configurations', ['user_id', 'store_id', 'status', 'page_type'], {
      name: 'idx_user_store_status_page'
    });

    await queryInterface.addIndex('slot_configurations', ['store_id', 'status', 'page_type', 'version_number'], {
      name: 'idx_store_status_page_version'
    });

    await queryInterface.addIndex('slot_configurations', ['parent_version_id'], {
      name: 'idx_parent_version'
    });

    // Update existing records to have published status and version 1
    await queryInterface.sequelize.query(`
      UPDATE slot_configurations 
      SET status = 'published', 
          version_number = 1,
          page_type = 'cart',
          published_at = CURRENT_TIMESTAMP
      WHERE is_active = true
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('slot_configurations', 'idx_user_store_status_page');
    await queryInterface.removeIndex('slot_configurations', 'idx_store_status_page_version');
    await queryInterface.removeIndex('slot_configurations', 'idx_parent_version');

    // Re-add the original unique constraint
    await queryInterface.addIndex('slot_configurations', ['user_id', 'store_id'], {
      unique: true,
      name: 'unique_user_store_config'
    });

    // Remove columns
    await queryInterface.removeColumn('slot_configurations', 'parent_version_id');
    await queryInterface.removeColumn('slot_configurations', 'published_by');
    await queryInterface.removeColumn('slot_configurations', 'published_at');
    await queryInterface.removeColumn('slot_configurations', 'page_type');
    await queryInterface.removeColumn('slot_configurations', 'version_number');
    await queryInterface.removeColumn('slot_configurations', 'status');
  }
};