'use strict';

/**
 * Add 'cancelling' status to job_queue status check constraint
 * This allows jobs to be marked as 'cancelling' when a cancel request is received
 * for a running job, so the worker knows to abort.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the existing constraint and recreate with new valid values
    await queryInterface.sequelize.query(`
      -- Drop the existing check constraint
      ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_status_check;

      -- Add new constraint with 'cancelling' included
      ALTER TABLE job_queue ADD CONSTRAINT job_queue_status_check
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'cancelling'));
    `);

    console.log('Added cancelling status to job_queue status constraint');
  },

  async down(queryInterface, Sequelize) {
    // Revert to original constraint without 'cancelling'
    // First update any 'cancelling' jobs to 'cancelled'
    await queryInterface.sequelize.query(`
      UPDATE job_queue SET status = 'cancelled' WHERE status = 'cancelling';

      ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_status_check;

      ALTER TABLE job_queue ADD CONSTRAINT job_queue_status_check
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
    `);
  }
};
