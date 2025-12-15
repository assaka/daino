'use strict';

/**
 * Migration: Add 'demo' status to stores table
 *
 * This enables demo data provisioning feature:
 * - Stores with demo data have status='demo'
 * - Demo stores cannot be published/run
 * - Demo data can be cleared to restore store to 'active' status
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Update the CHECK constraint on stores.status to include 'demo'
      // This runs on the master database
      await queryInterface.sequelize.query(`
        ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_status_check;
        ALTER TABLE stores ADD CONSTRAINT stores_status_check
        CHECK (status IN (
          'pending_database',
          'provisioning',
          'active',
          'demo',
          'suspended',
          'inactive'
        ));
      `);

      console.log('✅ Added demo status to stores table');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Revert to original constraint (without 'demo')
      // First update any demo stores to 'active'
      await queryInterface.sequelize.query(`
        UPDATE stores SET status = 'active' WHERE status = 'demo';
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_status_check;
        ALTER TABLE stores ADD CONSTRAINT stores_status_check
        CHECK (status IN (
          'pending_database',
          'provisioning',
          'active',
          'suspended',
          'inactive'
        ));
      `);

      console.log('✅ Removed demo status from stores table');
    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
};
