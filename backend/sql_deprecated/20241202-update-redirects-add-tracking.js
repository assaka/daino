'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to existing redirects table
    await queryInterface.addColumn('redirects', 'entity_type', {
      type: Sequelize.ENUM('category', 'product', 'cms_page'),
      allowNull: true,
      comment: 'Type of entity that created this redirect'
    });

    await queryInterface.addColumn('redirects', 'entity_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'ID of the entity that created this redirect'
    });

    await queryInterface.addColumn('redirects', 'created_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('redirects', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Optional notes about why this redirect was created'
    });

    await queryInterface.addColumn('redirects', 'hit_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of times this redirect has been used'
    });

    await queryInterface.addColumn('redirects', 'last_used_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When this redirect was last used'
    });

    // Add new index for entity tracking
    await queryInterface.addIndex('redirects', ['entity_type', 'entity_id'], {
      name: 'idx_redirects_entity'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('redirects', 'idx_redirects_entity');
    
    // Remove columns
    await queryInterface.removeColumn('redirects', 'last_used_at');
    await queryInterface.removeColumn('redirects', 'hit_count');
    await queryInterface.removeColumn('redirects', 'notes');
    await queryInterface.removeColumn('redirects', 'created_by');
    await queryInterface.removeColumn('redirects', 'entity_id');
    await queryInterface.removeColumn('redirects', 'entity_type');
  }
};