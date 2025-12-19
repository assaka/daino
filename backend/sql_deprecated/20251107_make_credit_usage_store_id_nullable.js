'use strict';

/**
 * Migration: Make credit_usage.store_id nullable for global features
 *
 * This allows credit usage to be tracked for features that are not
 * store-specific, such as UI labels translation.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change store_id column to be nullable
    await queryInterface.changeColumn('credit_usage', 'store_id', {
      type: Sequelize.UUID,
      allowNull: true, // Changed from false to true
      references: {
        model: 'stores',
        key: 'id'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert: Make store_id required again
    // Note: This will fail if there are any null values in the column
    await queryInterface.changeColumn('credit_usage', 'store_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id'
      }
    });
  }
};
