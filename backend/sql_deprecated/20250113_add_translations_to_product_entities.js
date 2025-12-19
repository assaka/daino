module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add translations column to product_tabs
    await queryInterface.addColumn('product_tabs', 'translations', {
      type: Sequelize.JSON,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"name": "...", "content": "..."}, "nl": {...}}'
    });

    // Add translations column to product_labels
    await queryInterface.addColumn('product_labels', 'translations', {
      type: Sequelize.JSON,
      defaultValue: {},
      comment: 'Multilingual translations: {"en": {"text": "..."}, "nl": {...}}'
    });

    console.log('✅ Added translations columns to product_tabs and product_labels');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product_tabs', 'translations');
    await queryInterface.removeColumn('product_labels', 'translations');
    console.log('✅ Removed translations columns from product_tabs and product_labels');
  }
};
