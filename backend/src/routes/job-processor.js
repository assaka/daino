const express = require('express');
const router = express.Router();
const { masterDbClient } = require('../database/masterConnection');

// Import all job handlers
const UILabelsBulkTranslationJob = require('../core/jobs/UILabelsBulkTranslationJob');
const ShopifyImportCollectionsJob = require('../core/jobs/ShopifyImportCollectionsJob');
const ShopifyImportProductsJob = require('../core/jobs/ShopifyImportProductsJob');
const ShopifyImportAllJob = require('../core/jobs/ShopifyImportAllJob');
const AmazonExportProductsJob = require('../core/jobs/AmazonExportProductsJob');
const AmazonSyncInventoryJob = require('../core/jobs/AmazonSyncInventoryJob');
const EbayExportProductsJob = require('../core/jobs/EbayExportProductsJob');
const AkeneoImportCategoriesJob = require('../core/jobs/AkeneoImportCategoriesJob');
const AkeneoImportProductsJob = require('../core/jobs/AkeneoImportProductsJob');
const AkeneoImportAttributesJob = require('../core/jobs/AkeneoImportAttributesJob');
const AkeneoImportFamiliesJob = require('../core/jobs/AkeneoImportFamiliesJob');
const AkeneoImportAllJob = require('../core/jobs/AkeneoImportAllJob');
const PluginInstallJob = require('../core/jobs/PluginInstallJob');
const PluginUninstallJob = require('../core/jobs/PluginUninstallJob');
const PluginUpdateJob = require('../core/jobs/PluginUpdateJob');

// Map job types to their handler classes
const JOB_HANDLERS = {
  'translation:ui-labels:bulk': UILabelsBulkTranslationJob,
  'shopify:import:collections': ShopifyImportCollectionsJob,
  'shopify:import:products': ShopifyImportProductsJob,
  'shopify:import:all': ShopifyImportAllJob,
  'amazon:export:products': AmazonExportProductsJob,
  'amazon:sync:inventory': AmazonSyncInventoryJob,
  'ebay:export:products': EbayExportProductsJob,
  'akeneo:import:categories': AkeneoImportCategoriesJob,
  'akeneo:import:products': AkeneoImportProductsJob,
  'akeneo:import:attributes': AkeneoImportAttributesJob,
  'akeneo:import:families': AkeneoImportFamiliesJob,
  'akeneo:import:all': AkeneoImportAllJob,
  'plugin:install': PluginInstallJob,
  'plugin:uninstall': PluginUninstallJob,
  'plugin:update': PluginUpdateJob,
};

// Middleware to verify cron secret
const verifyCronSecret = (req, res, next) => {
  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.warn('⚠️ CRON_SECRET not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (cronSecret !== expectedSecret) {
    console.warn('⚠️ Invalid cron secret provided');
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

/**
 * POST /api/jobs/process-pending
 *
 * Processes pending jobs from the queue.
 * Called by cron every minute.
 *
 * Security: Requires X-Cron-Secret header
 */
router.post('/process-pending', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();
  const MAX_RUNTIME = 50000; // 50 seconds max
  const MAX_JOBS = 10; // Process up to 10 jobs per run

  try {
    console.log('🔍 Processing pending jobs...');

    if (!masterDbClient) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get all pending jobs, prioritized
    const jobTypes = Object.keys(JOB_HANDLERS);
    const { data: pendingJobs, error } = await masterDbClient
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .in('job_type', jobTypes)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(MAX_JOBS);

    if (error) {
      throw new Error(error.message);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('ℹ️ No pending jobs to process');
      return res.json({
        processed: 0,
        message: 'No pending jobs'
      });
    }

    console.log(`📋 Found ${pendingJobs.length} pending job(s)`);

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // Process jobs one at a time
    for (const job of pendingJobs) {
      // Check if we're running out of time
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME) {
        console.log(`⏰ Timeout approaching (${elapsed}ms), stopping for this run`);
        skipped = pendingJobs.length - processed - failed;
        break;
      }

      try {
        console.log(`🚀 Processing job ${job.id}: ${job.job_type}`);

        const HandlerClass = JOB_HANDLERS[job.job_type];
        if (!HandlerClass) {
          console.error(`❌ No handler for job type: ${job.job_type}`);
          skipped++;
          continue;
        }

        // Update to running
        await masterDbClient
          .from('job_queue')
          .update({
            status: 'running',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // Execute job (add type alias for compatibility)
        job.type = job.job_type;
        const handler = new HandlerClass(job);
        const result = await handler.execute();

        // Mark as completed
        await masterDbClient
          .from('job_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: result,
            progress: 100
          })
          .eq('id', job.id);

        console.log(`✅ Job ${job.id} completed`);
        processed++;

      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error.message);

        const retryCount = (job.retry_count || 0) + 1;
        const maxRetries = job.max_retries || 3;

        if (retryCount < maxRetries) {
          // Retry later
          await masterDbClient
            .from('job_queue')
            .update({
              status: 'pending',
              retry_count: retryCount,
              last_error: error.message
            })
            .eq('id', job.id);

          console.log(`   ↻ Will retry (${retryCount}/${maxRetries})`);
          skipped++; // Will be retried, not failed yet
        } else {
          // Failed permanently
          await masterDbClient
            .from('job_queue')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              last_error: error.message,
              retry_count: retryCount
            })
            .eq('id', job.id);

          console.log(`   ✗ Failed permanently`);
          failed++;
        }
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      processed,
      failed,
      skipped,
      duration,
      message: `Processed ${processed} job(s) in ${(duration / 1000).toFixed(2)}s`
    };

    console.log('📊 Summary:', summary);

    res.json(summary);

  } catch (error) {
    console.error('❌ Error processing jobs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/status
 *
 * Get current job queue status
 * Public endpoint (useful for monitoring)
 */
router.get('/status', async (req, res) => {
  try {
    if (!masterDbClient) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: pending },
      { count: running },
      { count: completed },
      { count: failed }
    ] = await Promise.all([
      masterDbClient
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      masterDbClient
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running'),
      masterDbClient
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', twentyFourHoursAgo),
      masterDbClient
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('updated_at', twentyFourHoursAgo),
    ]);

    res.json({
      queue: {
        pending: pending || 0,
        running: running || 0,
        completed_24h: completed || 0,
        failed_24h: failed || 0
      },
      healthy: (pending || 0) < 100 && (running || 0) < 10 // Simple health check
    });

  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
