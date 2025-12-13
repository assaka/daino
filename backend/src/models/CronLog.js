const { DataTypes, Op } = require('sequelize');
const { masterSequelize } = require('../database/masterConnection');

/**
 * CronLog Model - Centralized logging for platform-level cron job executions
 *
 * This model tracks all cron job runs in the master database:
 * - Daily credit deduction
 * - Cleanup jobs
 * - Any scheduled platform tasks
 */
const CronLog = masterSequelize.define('CronLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  job_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Unique identifier for the cron job type (e.g., daily_credit_deduction)'
  },
  job_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'system',
    comment: 'Category: system, scheduled, manual'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'started',
    comment: 'Execution status: started, running, completed, failed, timeout'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When the job execution started'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the job execution completed'
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Execution duration in milliseconds'
  },
  result: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Success result data (counts, summaries)'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if failed'
  },
  error_stack: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Full stack trace for debugging'
  },
  server_instance: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Server/container that ran the job'
  },
  trigger_source: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'cron',
    comment: 'What triggered the job: cron, manual, api, retry'
  },
  triggered_by: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'User or system that triggered (for manual runs)'
  },
  stores_processed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of stores examined during execution'
  },
  stores_affected: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of stores that had changes applied'
  },
  items_processed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Generic counter for items processed'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional context-specific data'
  }
}, {
  tableName: 'cron_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // We don't need updated_at for logs
  indexes: [
    { fields: ['job_name'] },
    { fields: ['status'] },
    { fields: ['started_at'] },
    { fields: ['job_name', 'started_at'] },
    { fields: ['job_name', 'status', 'started_at'] }
  ]
});

// ============================================
// Instance Methods
// ============================================

/**
 * Mark the cron job as running
 */
CronLog.prototype.markAsRunning = async function() {
  await this.update({ status: 'running' });
};

/**
 * Mark the cron job as completed successfully
 * @param {Object} result - Result data to store
 * @param {Object} metrics - Optional metrics { stores_processed, stores_affected, items_processed }
 */
CronLog.prototype.markAsCompleted = async function(result = {}, metrics = {}) {
  const completedAt = new Date();
  const durationMs = completedAt - this.started_at;

  await this.update({
    status: 'completed',
    completed_at: completedAt,
    duration_ms: durationMs,
    result,
    stores_processed: metrics.stores_processed || this.stores_processed,
    stores_affected: metrics.stores_affected || this.stores_affected,
    items_processed: metrics.items_processed || this.items_processed
  });
};

/**
 * Mark the cron job as failed
 * @param {Error|string} error - Error object or message
 */
CronLog.prototype.markAsFailed = async function(error) {
  const completedAt = new Date();
  const durationMs = completedAt - this.started_at;

  await this.update({
    status: 'failed',
    completed_at: completedAt,
    duration_ms: durationMs,
    error_message: error.message || String(error),
    error_stack: error.stack || null
  });
};

/**
 * Update progress metrics during execution
 * @param {Object} metrics - { stores_processed, stores_affected, items_processed }
 */
CronLog.prototype.updateMetrics = async function(metrics) {
  const updateData = {};
  if (metrics.stores_processed !== undefined) updateData.stores_processed = metrics.stores_processed;
  if (metrics.stores_affected !== undefined) updateData.stores_affected = metrics.stores_affected;
  if (metrics.items_processed !== undefined) updateData.items_processed = metrics.items_processed;

  if (Object.keys(updateData).length > 0) {
    await this.update(updateData);
  }
};

// ============================================
// Static Methods
// ============================================

/**
 * Start a new cron log entry
 * @param {string} jobName - Name of the cron job
 * @param {Object} options - Optional settings
 * @returns {Promise<CronLog>} The created log entry
 */
CronLog.startLog = async function(jobName, options = {}) {
  return CronLog.create({
    job_name: jobName,
    job_type: options.job_type || 'system',
    status: 'started',
    started_at: new Date(),
    server_instance: options.server_instance || process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || 'unknown',
    trigger_source: options.trigger_source || 'cron',
    triggered_by: options.triggered_by || null,
    metadata: options.metadata || {}
  });
};

/**
 * Get recent logs for a specific job
 * @param {string} jobName - Job name to filter by
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<CronLog[]>}
 */
CronLog.getRecentLogs = function(jobName, limit = 10) {
  return CronLog.findAll({
    where: { job_name: jobName },
    order: [['started_at', 'DESC']],
    limit
  });
};

/**
 * Get the last execution for a specific job
 * @param {string} jobName - Job name
 * @returns {Promise<CronLog|null>}
 */
CronLog.getLastExecution = function(jobName) {
  return CronLog.findOne({
    where: { job_name: jobName },
    order: [['started_at', 'DESC']]
  });
};

/**
 * Get statistics for a cron job
 * @param {string} jobName - Job name
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Statistics object
 */
CronLog.getStats = async function(jobName, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const logs = await CronLog.findAll({
    where: {
      job_name: jobName,
      started_at: { [Op.gte]: cutoffDate }
    },
    attributes: ['status', 'duration_ms', 'stores_processed', 'stores_affected']
  });

  const totalRuns = logs.length;
  const successfulRuns = logs.filter(l => l.status === 'completed').length;
  const failedRuns = logs.filter(l => l.status === 'failed').length;
  const durations = logs.map(l => l.duration_ms).filter(d => d !== null);

  return {
    total_runs: totalRuns,
    successful_runs: successfulRuns,
    failed_runs: failedRuns,
    success_rate: totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(2) : 0,
    avg_duration_ms: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    max_duration_ms: durations.length > 0 ? Math.max(...durations) : 0,
    min_duration_ms: durations.length > 0 ? Math.min(...durations) : 0,
    total_stores_processed: logs.reduce((sum, l) => sum + (l.stores_processed || 0), 0),
    total_stores_affected: logs.reduce((sum, l) => sum + (l.stores_affected || 0), 0)
  };
};

/**
 * Get all logs within a time period
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {Promise<CronLog[]>}
 */
CronLog.getLogsInPeriod = function(startDate, endDate) {
  return CronLog.findAll({
    where: {
      started_at: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      }
    },
    order: [['started_at', 'DESC']]
  });
};

/**
 * Cleanup old logs
 * @param {number} daysToKeep - Number of days of logs to keep
 * @returns {Promise<number>} Number of deleted logs
 */
CronLog.cleanup = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await CronLog.destroy({
    where: {
      started_at: { [Op.lt]: cutoffDate }
    }
  });

  return result;
};

/**
 * Check if a job is currently running
 * @param {string} jobName - Job name
 * @returns {Promise<boolean>}
 */
CronLog.isJobRunning = async function(jobName) {
  const runningJob = await CronLog.findOne({
    where: {
      job_name: jobName,
      status: { [Op.in]: ['started', 'running'] }
    }
  });

  return !!runningJob;
};

module.exports = CronLog;
