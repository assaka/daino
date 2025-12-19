'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add credit_cost column
    await queryInterface.addColumn('akeneo_schedules', 'credit_cost', {
      type: Sequelize.DECIMAL(5, 3),
      allowNull: false,
      defaultValue: 0.1,
      comment: 'Cost in credits per execution'
    });

    // Add last_credit_usage column
    await queryInterface.addColumn('akeneo_schedules', 'last_credit_usage', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'credit_usage',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Reference to the last credit usage record'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the columns in reverse order
    await queryInterface.removeColumn('akeneo_schedules', 'last_credit_usage');
    await queryInterface.removeColumn('akeneo_schedules', 'credit_cost');
  }
};