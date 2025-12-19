const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    console.log('Adding category translation columns to cookie_consent_settings_translations...');

    // Add columns for category translations
    await queryInterface.addColumn('cookie_consent_settings_translations', 'necessary_name', {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'necessary_description', {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'analytics_name', {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'analytics_description', {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'marketing_name', {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'marketing_description', {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'functional_name', {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'functional_description', {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('cookie_consent_settings_translations', 'save_preferences_button_text', {
      type: DataTypes.STRING,
      allowNull: true
    });

    console.log('✅ Columns added successfully');
  },

  down: async (queryInterface) => {
    console.log('Removing category translation columns...');

    await queryInterface.removeColumn('cookie_consent_settings_translations', 'necessary_name');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'necessary_description');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'analytics_name');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'analytics_description');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'marketing_name');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'marketing_description');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'functional_name');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'functional_description');
    await queryInterface.removeColumn('cookie_consent_settings_translations', 'save_preferences_button_text');

    console.log('✅ Columns removed successfully');
  }
};
