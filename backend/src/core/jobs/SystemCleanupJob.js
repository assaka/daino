const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');

/**
 * Background job handler for system cleanup tasks
 */
class SystemCleanupJob extends BaseJobHandler {
  async execute() {
    this.log('Starting system cleanup job');

    const payload = this.getPayload();
    const {
      cleanupOldJobs = true,
      cleanupOldHistory = true,
      jobRetentionDays = 30,
      historyRetentionDays = 90
    } = payload;

    const results = {};

    try {
      await this.updateProgress(10, 'Starting cleanup operations...');

      if (cleanupOldJobs) {
        await this.updateProgress(25, 'Cleaning up old job records...');
        const deletedJobs = await this.cleanupOldJobs(jobRetentionDays);
        results.deletedJobs = deletedJobs;
        this.log(`Cleaned up ${deletedJobs} old job records`);
      }

      if (cleanupOldHistory) {
        await this.updateProgress(60, 'Cleaning up old job history...');
        const deletedHistory = await this.cleanupOldHistory(historyRetentionDays);
        results.deletedHistory = deletedHistory;
        this.log(`Cleaned up ${deletedHistory} old history records`);
      }

      await this.updateProgress(100, 'System cleanup completed');

      const result = {
        success: true,
        message: 'System cleanup completed successfully',
        results,
        settings: {
          jobRetentionDays,
          historyRetentionDays
        }
      };

      this.log(`System cleanup completed: ${JSON.stringify(results)}`);
      return result;

    } catch (error) {
      this.log(`System cleanup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Clean up old completed/failed/cancelled jobs
   */
  async cleanupOldJobs(daysOld = 30) {
    if (!masterDbClient) {
      this.log('masterDbClient not available, skipping job cleanup', 'warn');
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Delete old completed jobs
    const { data: deletedCompleted, error: err1 } = await masterDbClient
      .from('job_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', cutoffDate.toISOString())
      .select('id');

    // Delete old failed jobs
    const { data: deletedFailed, error: err2 } = await masterDbClient
      .from('job_queue')
      .delete()
      .eq('status', 'failed')
      .lt('failed_at', cutoffDate.toISOString())
      .select('id');

    // Delete old cancelled jobs
    const { data: deletedCancelled, error: err3 } = await masterDbClient
      .from('job_queue')
      .delete()
      .eq('status', 'cancelled')
      .lt('cancelled_at', cutoffDate.toISOString())
      .select('id');

    if (err1) this.log(`Error cleaning completed jobs: ${err1.message}`, 'warn');
    if (err2) this.log(`Error cleaning failed jobs: ${err2.message}`, 'warn');
    if (err3) this.log(`Error cleaning cancelled jobs: ${err3.message}`, 'warn');

    return (deletedCompleted?.length || 0) + (deletedFailed?.length || 0) + (deletedCancelled?.length || 0);
  }

  /**
   * Clean up old job history records
   */
  async cleanupOldHistory(daysOld = 90) {
    if (!masterDbClient) {
      this.log('masterDbClient not available, skipping history cleanup', 'warn');
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data: deleted, error } = await masterDbClient
      .from('job_history')
      .delete()
      .lt('executed_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      this.log(`Error cleaning history: ${error.message}`, 'warn');
      return 0;
    }

    return deleted?.length || 0;
  }
}

module.exports = SystemCleanupJob;
