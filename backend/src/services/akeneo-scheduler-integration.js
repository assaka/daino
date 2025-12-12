const jobManager = require('../core/BackgroundJobManager');
const AkeneoSchedule = require('../models/AkeneoSchedule');

/**
 * Akeneo Scheduler Integration - SIMPLIFIED VERSION
 *
 * Since AkeneoSchedule now writes directly to cron_jobs table,
 * this service only provides utility functions for manual execution
 * and status checking.
 *
 * The sync logic has been removed - cron_jobs IS the source of truth.
 */
class AkeneoSchedulerIntegration {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the scheduler integration
   * NOTE: No longer syncs - just initializes job manager
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize the job manager
    await jobManager.initialize();

    this.initialized = true;
    console.log('Akeneo Scheduler Integration initialized (unified cron_jobs table)');
  }

  /**
   * Trigger an immediate Akeneo import (manual execution)
   * This creates a background job directly
   */
  async triggerImmediateImport(scheduleOrConfig) {
    const config = scheduleOrConfig.configuration || scheduleOrConfig;
    const storeId = scheduleOrConfig.store_id || config.store_id;
    const importType = config.import_type || scheduleOrConfig.import_type;

    console.log(`Triggering immediate Akeneo import: ${importType} for store ${storeId}`);

    try {
      const jobType = this.getJobTypeFromImportType(importType);

      const job = await jobManager.scheduleJob({
        type: jobType,
        payload: {
          storeId: storeId,
          locale: config.options?.locale || 'en_US',
          dryRun: config.options?.dryRun || false,
          filters: config.filters || {},
          downloadImages: config.options?.downloadImages !== false,
          batchSize: config.options?.batchSize || 50,
          customMappings: config.options?.customMappings || {},
          scheduleId: scheduleOrConfig.id
        },
        priority: 'high',
        delay: 0,
        maxRetries: 3,
        storeId: storeId,
        userId: null,
        metadata: {
          source: 'akeneo_schedule',
          schedule_id: scheduleOrConfig.id,
          triggered_by: 'manual',
          import_type: importType
        }
      });

      console.log(`Triggered immediate import job ${job.id}`);
      return job;

    } catch (error) {
      console.error(`Failed to trigger immediate import: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert import type to background job type
   */
  getJobTypeFromImportType(importType) {
    const typeMapping = {
      'categories': 'akeneo:import:categories',
      'products': 'akeneo:import:products',
      'attributes': 'akeneo:import:attributes',
      'families': 'akeneo:import:families',
      'all': 'akeneo:import:all'
    };

    return typeMapping[importType] || 'akeneo:import:products';
  }

  /**
   * Get status of Akeneo schedules for a store
   */
  async getScheduleStatus(storeId) {
    try {
      const schedules = await AkeneoSchedule.findAll({
        where: { store_id: storeId }
      });

      const activeSchedules = schedules.filter(s => s.is_active && s.status !== 'paused');
      const pausedSchedules = schedules.filter(s => s.status === 'paused');

      return {
        initialized: this.initialized,
        schedules: {
          total: schedules.length,
          active: activeSchedules.length,
          paused: pausedSchedules.length
        },
        next_runs: activeSchedules
          .filter(s => s.next_run)
          .sort((a, b) => new Date(a.next_run) - new Date(b.next_run))
          .slice(0, 5)
          .map(s => ({
            id: s.id,
            import_type: s.import_type,
            next_run: s.next_run
          }))
      };

    } catch (error) {
      console.error('Error getting schedule status:', error);
      return {
        initialized: this.initialized,
        error: error.message
      };
    }
  }

  // ============================================
  // DEPRECATED METHODS - Kept for compatibility
  // These do nothing now since sync is eliminated
  // ============================================

  /**
   * @deprecated No longer needed - AkeneoSchedule writes directly to cron_jobs
   */
  async syncAllSchedulesToCronJobs() {
    console.log('syncAllSchedulesToCronJobs is deprecated - AkeneoSchedule writes directly to cron_jobs');
    return;
  }

  /**
   * @deprecated No longer needed - AkeneoSchedule writes directly to cron_jobs
   */
  async syncScheduleToCronJob(schedule) {
    console.log('syncScheduleToCronJob is deprecated - AkeneoSchedule writes directly to cron_jobs');
    return null;
  }

  /**
   * @deprecated No longer needed - handled automatically
   */
  async onScheduleCreatedOrUpdated(schedule) {
    console.log('onScheduleCreatedOrUpdated is deprecated - cron_jobs updated directly');
    return null;
  }

  /**
   * @deprecated No longer needed - handled automatically
   */
  async onScheduleDeleted(scheduleId) {
    console.log('onScheduleDeleted is deprecated - cron_jobs deleted directly');
    return;
  }

  /**
   * @deprecated No longer needed - handled automatically
   */
  async onSchedulePausedOrResumed(schedule) {
    console.log('onSchedulePausedOrResumed is deprecated - cron_jobs updated directly');
    return null;
  }

  /**
   * @deprecated Use getScheduleStatus instead
   */
  async getIntegrationStatus() {
    return {
      initialized: this.initialized,
      message: 'Use getScheduleStatus(storeId) for schedule information'
    };
  }
}

// Export singleton instance
const akeneoSchedulerIntegration = new AkeneoSchedulerIntegration();
module.exports = akeneoSchedulerIntegration;
