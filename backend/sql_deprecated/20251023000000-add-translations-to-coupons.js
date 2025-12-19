'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add translations JSON column to coupons table
    await queryInterface.addColumn('coupons', 'translations', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"name": "...", "description": "..."}, "nl": {...}}'
    });

    // 2. Migrate existing coupon data to translations JSON
    await queryInterface.sequelize.query(`
      UPDATE coupons
      SET translations = json_build_object(
        'en', json_build_object(
          'name', name,
          'description', COALESCE(description, '')
        )
      )
      WHERE name IS NOT NULL;
    `);

    console.log('✓ Translations column added to coupons table successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove translations column
    await queryInterface.removeColumn('coupons', 'translations');

    console.log('✓ Translations column removed from coupons table');
  }
};
