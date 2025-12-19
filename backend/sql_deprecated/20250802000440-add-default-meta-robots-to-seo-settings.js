'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable('seo_settings');
      
      if (!tableDescription.default_meta_robots) {
        await queryInterface.addColumn('seo_settings', 'default_meta_robots', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'index, follow'
        });
        console.log('✅ Added default_meta_robots column to seo_settings table');
      } else {
        console.log('⚠️ Column default_meta_robots already exists in seo_settings table');
      }
    } catch (error) {
      console.error('❌ Error adding default_meta_robots column:', error);
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    try {
      await queryInterface.removeColumn('seo_settings', 'default_meta_robots');
      console.log('✅ Removed default_meta_robots column from seo_settings table');
    } catch (error) {
      console.error('❌ Error removing default_meta_robots column:', error);
      throw error;
    }
  }
};