'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('akeneo_schedules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      import_type: {
        type: Sequelize.ENUM('attributes', 'families', 'categories', 'products', 'all'),
        allowNull: false
      },
      schedule_type: {
        type: Sequelize.ENUM('once', 'daily', 'weekly', 'monthly'),
        allowNull: false,
        defaultValue: 'once'
      },
      schedule_time: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Format: "HH:MM" for daily, "MON-09:00" for weekly, "1-09:00" for monthly'
      },
      schedule_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'For one-time schedules'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      last_run: {
        type: Sequelize.DATE,
        allowNull: true
      },
      next_run: {
        type: Sequelize.DATE,
        allowNull: true
      },
      filters: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false,
        comment: 'Filters for the import: {channels: [], families: [], attributes: {}, categories: []}'
      },
      options: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: false,
        comment: 'Import options: {locale: "en_US", dryRun: false, batchSize: 50}'
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'running', 'completed', 'failed', 'paused'),
        defaultValue: 'scheduled',
        allowNull: false
      },
      last_result: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Result of last execution'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('akeneo_schedules', ['store_id']);
    await queryInterface.addIndex('akeneo_schedules', ['next_run']);
    await queryInterface.addIndex('akeneo_schedules', ['is_active']);
    await queryInterface.addIndex('akeneo_schedules', ['status']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('akeneo_schedules');
  }
};
