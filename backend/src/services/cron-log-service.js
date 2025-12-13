/**
 * Cron Log Service
 *
 * Simple service for logging cron executions to master DB using Supabase REST API.
 * Avoids Sequelize/PostgreSQL direct connection issues with pooler authentication.
 */

const { masterDbClient } = require('../database/masterConnection');

class CronLogService {
  /**
   * Start a new cron log entry
   * @param {string} jobName - Name of the cron job
   * @param {Object} options - Optional settings
   * @returns {Promise<Object>} The created log entry
   */
  static async startLog(jobName, options = {}) {
    if (!masterDbClient) {
      console.warn('masterDbClient not available, skipping cron log');
      return null;
    }

    try {
      const logEntry = {
        job_name: jobName,
        job_type: options.job_type || 'system',
        status: 'started',
        started_at: new Date().toISOString(),
        server_instance: options.server_instance || process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || 'unknown',
        trigger_source: options.trigger_source || 'cron',
        triggered_by: options.triggered_by || null,
        metadata: options.metadata || {},
        stores_processed: 0,
        stores_affected: 0,
        items_processed: 0
      };

      const { data, error } = await masterDbClient
        .from('cron_logs')
        .insert(logEntry)
        .select()
        .single();

      if (error) {
        console.warn('Failed to create cron log:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.warn('Error starting cron log:', err.message);
      return null;
    }
  }

  /**
   * Mark a cron log as completed
   * @param {string} logId - The log entry ID
   * @param {Object} result - Result data to store
   * @param {Object} metrics - Optional metrics
   */
  static async markCompleted(logId, result = {}, metrics = {}) {
    if (!masterDbClient || !logId) return;

    try {
      const { data: existing } = await masterDbClient
        .from('cron_logs')
        .select('started_at')
        .eq('id', logId)
        .single();

      const completedAt = new Date();
      const durationMs = existing?.started_at
        ? completedAt - new Date(existing.started_at)
        : null;

      const { error } = await masterDbClient
        .from('cron_logs')
        .update({
          status: 'completed',
          completed_at: completedAt.toISOString(),
          duration_ms: durationMs,
          result,
          stores_processed: metrics.stores_processed || 0,
          stores_affected: metrics.stores_affected || 0,
          items_processed: metrics.items_processed || 0
        })
        .eq('id', logId);

      if (error) {
        console.warn('Failed to update cron log:', error.message);
      }
    } catch (err) {
      console.warn('Error completing cron log:', err.message);
    }
  }

  /**
   * Mark a cron log as failed
   * @param {string} logId - The log entry ID
   * @param {Error|string} error - Error object or message
   */
  static async markFailed(logId, error) {
    if (!masterDbClient || !logId) return;

    try {
      const { data: existing } = await masterDbClient
        .from('cron_logs')
        .select('started_at')
        .eq('id', logId)
        .single();

      const completedAt = new Date();
      const durationMs = existing?.started_at
        ? completedAt - new Date(existing.started_at)
        : null;

      const { error: updateError } = await masterDbClient
        .from('cron_logs')
        .update({
          status: 'failed',
          completed_at: completedAt.toISOString(),
          duration_ms: durationMs,
          error_message: error.message || String(error),
          error_stack: error.stack || null
        })
        .eq('id', logId);

      if (updateError) {
        console.warn('Failed to update cron log:', updateError.message);
      }
    } catch (err) {
      console.warn('Error marking cron log as failed:', err.message);
    }
  }

  /**
   * Get recent logs for a job
   * @param {string} jobName - Job name
   * @param {number} limit - Max results
   */
  static async getRecentLogs(jobName, limit = 10) {
    if (!masterDbClient) return [];

    try {
      const { data, error } = await masterDbClient
        .from('cron_logs')
        .select('*')
        .eq('job_name', jobName)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Failed to fetch cron logs:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      console.warn('Error fetching cron logs:', err.message);
      return [];
    }
  }

  /**
   * Get stats for a job
   * @param {string} jobName - Job name
   * @param {number} days - Days to look back
   */
  static async getStats(jobName, days = 30) {
    if (!masterDbClient) return null;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await masterDbClient
        .from('cron_logs')
        .select('status, duration_ms, stores_processed, stores_affected')
        .eq('job_name', jobName)
        .gte('started_at', cutoffDate.toISOString());

      if (error) {
        console.warn('Failed to fetch cron stats:', error.message);
        return null;
      }

      const logs = data || [];
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
        total_stores_processed: logs.reduce((sum, l) => sum + (l.stores_processed || 0), 0),
        total_stores_affected: logs.reduce((sum, l) => sum + (l.stores_affected || 0), 0)
      };
    } catch (err) {
      console.warn('Error fetching cron stats:', err.message);
      return null;
    }
  }
}

module.exports = CronLogService;
