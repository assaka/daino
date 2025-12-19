'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add user_id column to stores table
    await queryInterface.addColumn('stores', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true, // Start as nullable to avoid breaking existing stores
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for better query performance
    await queryInterface.addIndex('stores', ['user_id']);

    // Optional: Migrate existing data by matching owner_email to user email
    // This will link existing stores to their users based on email match
    await queryInterface.sequelize.query(`
      UPDATE stores 
      SET user_id = users.id 
      FROM users 
      WHERE stores.owner_email = users.email 
      AND stores.user_id IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index
    await queryInterface.removeIndex('stores', ['user_id']);
    
    // Remove column
    await queryInterface.removeColumn('stores', 'user_id');
  }
};