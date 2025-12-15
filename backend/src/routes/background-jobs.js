const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkStoreOwnership } = require('../middleware/storeAuth');
const jobManager = require('../core/BackgroundJobManager');
const { masterDbClient } = require('../database/masterConnection');

// Apply authentication to all job routes
router.use(authMiddleware);

/**
 * Get job queue status and statistics
 * GET /api/background-jobs/status
 */
router.get('/status', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;

    const stats = await jobManager.getStatistics(timeRange);

    // Get running and pending counts from master DB
    let runningJobs = [];
    let pendingCount = 0;

    if (masterDbClient) {
      const { data: running } = await masterDbClient
        .from('job_queue')
        .select('id, job_type, progress, started_at, store_id')
        .eq('status', 'running')
        .order('started_at', { ascending: true });

      const { count } = await masterDbClient
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      runningJobs = running || [];
      pendingCount = count || 0;
    }

    res.json({
      success: true,
      status: {
        is_running: jobManager.isRunning,
        is_initialized: jobManager.initialized,
        currently_processing: jobManager.processing.size,
        max_concurrent_jobs: jobManager.maxConcurrentJobs,
        poll_interval: jobManager.pollInterval
      },
      statistics: stats,
      queue: {
        pending: pendingCount,
        running: runningJobs.length
      },
      running_jobs: runningJobs.map(job => ({
        id: job.id,
        type: job.job_type,
        progress: job.progress,
        started_at: job.started_at,
        store_id: job.store_id
      }))
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
});

/**
 * Schedule a new background job
 * POST /api/background-jobs/schedule
 */
router.post('/schedule', async (req, res) => {
  try {
    const {
      type,
      payload = {},
      priority = 'normal',
      delay = 0,
      maxRetries = 3,
      storeId,
      metadata = {}
    } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Job type is required'
      });
    }

    // Verify store access if storeId is provided
    if (storeId) {
      req.params.storeId = storeId;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    const job = await jobManager.scheduleJob({
      type,
      payload,
      priority,
      delay,
      maxRetries,
      storeId,
      userId: req.user.id,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'Job scheduled successfully',
      job: {
        id: job.id,
        type: job.type || job.job_type,
        priority: job.priority,
        status: job.status,
        scheduled_at: job.scheduled_at,
        store_id: job.store_id
      }
    });
  } catch (error) {
    console.error('Error scheduling job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule job',
      error: error.message
    });
  }
});

/**
 * Get job status (lightweight for polling)
 * GET /api/background-jobs/:jobId/status
 */
router.get('/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobStatus = await jobManager.getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check store access if job has a store_id
    if (jobStatus.store_id) {
      req.params.storeId = jobStatus.store_id;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    res.json({
      success: true,
      job: jobStatus
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
      error: error.message
    });
  }
});

/**
 * Get job details with history
 * GET /api/background-jobs/:jobId
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!masterDbClient) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const { data: job, error } = await masterDbClient
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check store access if job has a store_id
    if (job.store_id) {
      req.params.storeId = job.store_id;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    const jobDetails = await jobManager.getJobDetails(jobId);

    res.json({
      success: true,
      job: jobDetails
    });
  } catch (error) {
    console.error('Error getting job details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job details',
      error: error.message
    });
  }
});

/**
 * Cancel a job
 * POST /api/background-jobs/:jobId/cancel
 */
router.post('/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`[CANCEL] Received cancel request for job ${jobId}`);

    if (!masterDbClient) {
      console.log(`[CANCEL] Database not available`);
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const { data: job, error } = await masterDbClient
      .from('job_queue')
      .select('id, store_id, status')
      .eq('id', jobId)
      .single();

    console.log(`[CANCEL] Job ${jobId} current status: ${job?.status}`);

    if (error || !job) {
      console.log(`[CANCEL] Job ${jobId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check store access if job has a store_id
    if (job.store_id) {
      // Set storeId in params for checkStoreOwnership middleware
      req.params.storeId = job.store_id;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    console.log(`[CANCEL] Calling jobManager.cancelJob for ${jobId}`);
    const cancelledJob = await jobManager.cancelJob(jobId);
    console.log(`[CANCEL] Job ${jobId} status after cancel: ${cancelledJob.status}`);

    res.json({
      success: true,
      message: 'Job cancelled successfully',
      job: {
        id: cancelledJob.id,
        status: cancelledJob.status,
        cancelled_at: cancelledJob.cancelled_at
      }
    });
  } catch (error) {
    console.error('[CANCEL] Error cancelling job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel job',
      error: error.message
    });
  }
});

/**
 * Get jobs for a specific store
 * GET /api/background-jobs/store/:storeId
 */
router.get('/store/:storeId', checkStoreOwnership, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { limit = 50, status, type } = req.query;

    if (!masterDbClient) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    // Query job_queue in master database, filtered by store_id
    let query = masterDbClient
      .from('job_queue')
      .select('id, job_type, priority, status, progress, progress_message, scheduled_at, started_at, completed_at, failed_at, cancelled_at, retry_count, max_retries, last_error, result, created_at, updated_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('job_type', type);

    const { data: jobs, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Map job_type to type for frontend compatibility
    const mappedJobs = (jobs || []).map(job => ({
      ...job,
      type: job.job_type
    }));

    res.json({
      success: true,
      jobs: mappedJobs,
      count: mappedJobs.length
    });
  } catch (error) {
    console.error('Error getting store jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get store jobs',
      error: error.message
    });
  }
});

/**
 * Get job history timeline
 * GET /api/background-jobs/:jobId/history
 */
router.get('/:jobId/history', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!masterDbClient) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const { data: job, error: jobError } = await masterDbClient
      .from('job_queue')
      .select('id, store_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check store access if job has a store_id
    if (job.store_id) {
      req.params.storeId = job.store_id;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    const { data: history, error: historyError } = await masterDbClient
      .from('job_history')
      .select('*')
      .eq('job_id', jobId)
      .order('executed_at', { ascending: true });

    if (historyError) {
      throw new Error(historyError.message);
    }

    res.json({
      success: true,
      job_id: jobId,
      history: history || []
    });
  } catch (error) {
    console.error('Error getting job history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job history',
      error: error.message
    });
  }
});

/**
 * Get recent job activity
 * GET /api/background-jobs/activity/recent
 */
router.get('/activity/recent', async (req, res) => {
  try {
    const { limit = 100, storeId } = req.query;

    // If storeId provided, check access
    if (storeId) {
      req.params.storeId = storeId;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    if (!masterDbClient) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    let query = masterDbClient
      .from('job_history')
      .select('*, job_queue!inner(id, job_type, store_id, user_id)')
      .order('executed_at', { ascending: false })
      .limit(parseInt(limit));

    if (storeId) {
      query = query.eq('job_queue.store_id', storeId);
    }

    const { data: activity, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      activity: activity || [],
      count: activity?.length || 0
    });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent activity',
      error: error.message
    });
  }
});

/**
 * Get job statistics
 * GET /api/background-jobs/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { timeRange = '24h', storeId } = req.query;

    // If storeId provided, check access
    if (storeId) {
      req.params.storeId = storeId;
      let accessGranted = false;
      await checkStoreOwnership(req, res, () => { accessGranted = true; });
      if (!accessGranted) {
        return; // Response already sent by middleware
      }
    }

    if (!masterDbClient) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    // Calculate the since date
    const since = new Date();
    switch (timeRange) {
      case '1h':
        since.setHours(since.getHours() - 1);
        break;
      case '24h':
        since.setHours(since.getHours() - 24);
        break;
      case '7d':
        since.setDate(since.getDate() - 7);
        break;
      case '30d':
        since.setDate(since.getDate() - 30);
        break;
    }

    const sinceISO = since.toISOString();

    // Get statistics from job_history
    let baseQuery = masterDbClient.from('job_history').select('status');

    if (storeId) {
      // Join with job_queue to filter by store_id
      const { data: history } = await masterDbClient
        .from('job_history')
        .select('status, job_queue!inner(store_id)')
        .eq('job_queue.store_id', storeId)
        .gte('executed_at', sinceISO);

      const stats = (history || []).reduce((acc, h) => {
        acc[h.status] = (acc[h.status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        statistics: {
          total_events: history?.length || 0,
          completed: stats.completed || 0,
          failed: stats.failed || 0,
          retries: stats.retried || 0,
          time_range: timeRange
        },
        time_range: timeRange,
        store_id: storeId
      });
    } else {
      const { data: history } = await masterDbClient
        .from('job_history')
        .select('status')
        .gte('executed_at', sinceISO);

      const stats = (history || []).reduce((acc, h) => {
        acc[h.status] = (acc[h.status] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        statistics: {
          total_events: history?.length || 0,
          completed: stats.completed || 0,
          failed: stats.failed || 0,
          retries: stats.retried || 0,
          time_range: timeRange
        },
        time_range: timeRange,
        store_id: null
      });
    }
  } catch (error) {
    console.error('Error getting job statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job statistics',
      error: error.message
    });
  }
});

module.exports = router;
