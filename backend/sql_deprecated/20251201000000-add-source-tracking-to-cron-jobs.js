'use strict';

/**
 * Migration: Add source tracking to cron_jobs table
 *
 * This enables the unified scheduler by allowing cron_jobs to track their source:
 * - user: Manually created by users
 * - plugin: Registered by a plugin's manifest.cron
 * - integration: Created by integrations (Akeneo, Shopify, etc.)
 * - system: System-level jobs (credit deduction, cleanup, etc.)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add source_type column
      await queryInterface.addColumn('cron_jobs', 'source_type', {
        type: Sequelize.ENUM('user', 'plugin', 'integration', 'system'),
        defaultValue: 'user',
        allowNull: false,
        comment: 'Source of the cron job: user, plugin, integration, or system'
      }, { transaction });

      // Add source_id column (references plugin_id, akeneo_schedule_id, etc.)
      await queryInterface.addColumn('cron_jobs', 'source_id', {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Reference ID to the source (plugin_id, akeneo_schedule_id, etc.)'
      }, { transaction });

      // Add source_name for easier identification
      await queryInterface.addColumn('cron_jobs', 'source_name', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Human-readable source name (plugin name, integration name)'
      }, { transaction });

      // Add handler column for plugin/integration jobs
      await queryInterface.addColumn('cron_jobs', 'handler', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Handler method name for plugin/integration jobs'
      }, { transaction });

      // Create index for source lookups
      await queryInterface.addIndex('cron_jobs', ['source_type', 'source_id'], {
        name: 'idx_cron_jobs_source',
        transaction
      });

      // Create index for source_name
      await queryInterface.addIndex('cron_jobs', ['source_name'], {
        name: 'idx_cron_jobs_source_name',
        transaction
      });

      // Update the job_type constraint to include new types
      // First, we need to modify the check constraint or enum
      // Since job_type is validated at the model level, we'll update the model instead
      // But we should also update the cron_job_types table

      // Insert new job types for integrations and plugins
      await queryInterface.sequelize.query(`
        INSERT INTO cron_job_types (type_name, display_name, description, configuration_schema, default_configuration, category, icon)
        VALUES
          ('akeneo_import', 'Akeneo Import', 'Scheduled Akeneo PIM data import', '{
            "type": "object",
            "properties": {
              "import_type": {"type": "string", "enum": ["categories", "products", "attributes", "families", "all"]},
              "akeneo_schedule_id": {"type": "string", "format": "uuid"},
              "filters": {"type": "object"},
              "options": {"type": "object"}
            },
            "required": ["import_type"]
          }', '{"import_type": "products"}', 'integration', 'download'),

          ('plugin_job', 'Plugin Job', 'Scheduled job registered by a plugin', '{
            "type": "object",
            "properties": {
              "plugin_id": {"type": "string"},
              "plugin_slug": {"type": "string"},
              "handler": {"type": "string"},
              "params": {"type": "object"}
            },
            "required": ["plugin_slug", "handler"]
          }', '{}', 'plugin', 'puzzle'),

          ('shopify_sync', 'Shopify Sync', 'Scheduled Shopify data synchronization', '{
            "type": "object",
            "properties": {
              "sync_type": {"type": "string", "enum": ["products", "collections", "orders", "all"]},
              "direction": {"type": "string", "enum": ["import", "export", "both"]}
            },
            "required": ["sync_type"]
          }', '{"sync_type": "products", "direction": "import"}', 'integration', 'refresh')
        ON CONFLICT (type_name) DO NOTHING
      `, { transaction });

      await transaction.commit();
      console.log('✅ Added source tracking columns to cron_jobs table');

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes
      await queryInterface.removeIndex('cron_jobs', 'idx_cron_jobs_source', { transaction });
      await queryInterface.removeIndex('cron_jobs', 'idx_cron_jobs_source_name', { transaction });

      // Remove columns
      await queryInterface.removeColumn('cron_jobs', 'handler', { transaction });
      await queryInterface.removeColumn('cron_jobs', 'source_name', { transaction });
      await queryInterface.removeColumn('cron_jobs', 'source_id', { transaction });
      await queryInterface.removeColumn('cron_jobs', 'source_type', { transaction });

      // Remove the ENUM type
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_cron_jobs_source_type"',
        { transaction }
      );

      // Remove new job types
      await queryInterface.sequelize.query(`
        DELETE FROM cron_job_types
        WHERE type_name IN ('akeneo_import', 'plugin_job', 'shopify_sync')
      `, { transaction });

      await transaction.commit();
      console.log('✅ Removed source tracking columns from cron_jobs table');

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
