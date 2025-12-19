'use strict';

/**
 * Migration: Add auto_created columns to integration_category_mappings
 *
 * Adds columns to track automatically created categories during imports:
 * - auto_created: BOOLEAN - Whether category was auto-created
 * - auto_created_at: TIMESTAMP - When it was auto-created
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Adding auto_created columns to integration_category_mappings...');

    try {
      // Check if columns already exist
      const tableInfo = await queryInterface.describeTable('integration_category_mappings').catch(() => null);

      if (!tableInfo) {
        console.log('Table integration_category_mappings does not exist, skipping migration');
        return;
      }

      if (!tableInfo.auto_created) {
        await queryInterface.addColumn('integration_category_mappings', 'auto_created', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: true
        });
        console.log('Added auto_created column');
      } else {
        console.log('auto_created column already exists');
      }

      if (!tableInfo.auto_created_at) {
        await queryInterface.addColumn('integration_category_mappings', 'auto_created_at', {
          type: Sequelize.DATE,
          allowNull: true
        });
        console.log('Added auto_created_at column');
      } else {
        console.log('auto_created_at column already exists');
      }

      console.log('Migration completed successfully!');

    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('Removing auto_created columns from integration_category_mappings...');

    try {
      await queryInterface.removeColumn('integration_category_mappings', 'auto_created').catch(() => {});
      await queryInterface.removeColumn('integration_category_mappings', 'auto_created_at').catch(() => {});

      console.log('Rollback completed successfully!');

    } catch (error) {
      console.error('Error in rollback:', error);
      throw error;
    }
  }
};
