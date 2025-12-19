const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Create cookie_consent_settings_translations table
    await queryInterface.createTable('cookie_consent_settings_translations', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      cookie_consent_settings_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'cookie_consent_settings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      language_code: {
        type: DataTypes.STRING(10),
        allowNull: false
      },
      banner_text: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      accept_button_text: {
        type: DataTypes.STRING,
        allowNull: true
      },
      reject_button_text: {
        type: DataTypes.STRING,
        allowNull: true
      },
      settings_button_text: {
        type: DataTypes.STRING,
        allowNull: true
      },
      privacy_policy_text: {
        type: DataTypes.STRING,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Add unique constraint
    await queryInterface.addConstraint('cookie_consent_settings_translations', {
      fields: ['cookie_consent_settings_id', 'language_code'],
      type: 'unique',
      name: 'cookie_consent_settings_translations_unique'
    });

    // Add index for faster lookups
    await queryInterface.addIndex('cookie_consent_settings_translations', ['cookie_consent_settings_id']);
    await queryInterface.addIndex('cookie_consent_settings_translations', ['language_code']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('cookie_consent_settings_translations');
  }
};
