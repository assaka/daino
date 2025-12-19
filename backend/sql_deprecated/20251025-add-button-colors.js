const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    console.log('Adding button color columns to cookie_consent_settings...');

    // Accept button colors
    await queryInterface.addColumn('cookie_consent_settings', 'accept_button_bg_color', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#2563eb' // blue-600
    });

    await queryInterface.addColumn('cookie_consent_settings', 'accept_button_text_color', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#ffffff' // white
    });

    // Reject button colors
    await queryInterface.addColumn('cookie_consent_settings', 'reject_button_bg_color', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#ffffff' // white
    });

    await queryInterface.addColumn('cookie_consent_settings', 'reject_button_text_color', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#374151' // gray-700
    });

    // Save preferences button colors
    await queryInterface.addColumn('cookie_consent_settings', 'save_preferences_button_bg_color', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#16a34a' // green-600
    });

    await queryInterface.addColumn('cookie_consent_settings', 'save_preferences_button_text_color', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '#ffffff' // white
    });

    console.log('✅ Button color columns added successfully');
  },

  down: async (queryInterface) => {
    console.log('Removing button color columns...');

    await queryInterface.removeColumn('cookie_consent_settings', 'accept_button_bg_color');
    await queryInterface.removeColumn('cookie_consent_settings', 'accept_button_text_color');
    await queryInterface.removeColumn('cookie_consent_settings', 'reject_button_bg_color');
    await queryInterface.removeColumn('cookie_consent_settings', 'reject_button_text_color');
    await queryInterface.removeColumn('cookie_consent_settings', 'save_preferences_button_bg_color');
    await queryInterface.removeColumn('cookie_consent_settings', 'save_preferences_button_text_color');

    console.log('✅ Button color columns removed successfully');
  }
};
