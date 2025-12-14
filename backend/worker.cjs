#!/usr/bin/env node
/**
 * Background Worker Service
 *
 * Dedicated worker process for processing background jobs via BullMQ.
 * This runs as a separate Render service and processes jobs from the Redis queue.
 *
 * Jobs are scheduled by the main backend service and processed here.
 */

console.log('='.repeat(60));
console.log('BACKGROUND WORKER STARTING');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('='.repeat(60));

require('dotenv').config();

const BackgroundJobManager = require('./src/core/BackgroundJobManager');

// Track worker stats
const stats = {
  started_at: new Date(),
  jobs_processed: 0,
  jobs_failed: 0,
  last_job_at: null
};

// Graceful shutdown handling
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Shutting down gracefully...`);
  console.log('Worker stats:', {
    uptime: `${Math.round((Date.now() - stats.started_at.getTime()) / 1000)}s`,
    jobs_processed: stats.jobs_processed,
    jobs_failed: stats.jobs_failed
  });

  try {
    await BackgroundJobManager.stop();
    console.log('Worker shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  stats.jobs_failed++;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  stats.jobs_failed++;
});

/**
 * Main worker initialization
 */
async function main() {
  try {
    console.log('\n[1/3] Initializing BackgroundJobManager...');
    await BackgroundJobManager.initialize();

    console.log('[2/3] Registering job event handlers...');

    // Listen for job completion events
    BackgroundJobManager.on('job:completed', (job) => {
      stats.jobs_processed++;
      stats.last_job_at = new Date();
      console.log(`[JOB COMPLETED] ${job.type} (${job.id})`);
    });

    BackgroundJobManager.on('job:failed', (job, error) => {
      stats.jobs_failed++;
      stats.last_job_at = new Date();
      console.error(`[JOB FAILED] ${job.type} (${job.id}):`, error?.message || error);
    });

    BackgroundJobManager.on('job:progress', (job, progress) => {
      console.log(`[JOB PROGRESS] ${job.type} (${job.id}): ${progress}%`);
    });

    console.log('[3/3] Worker ready and listening for jobs...');
    console.log('='.repeat(60));
    console.log('BACKGROUND WORKER RUNNING');
    console.log('='.repeat(60));

    // Keep the process alive
    // The BullMQ workers inside BackgroundJobManager will process jobs

    // Periodic health log (every 5 minutes)
    setInterval(() => {
      const uptime = Math.round((Date.now() - stats.started_at.getTime()) / 1000 / 60);
      console.log(`[HEALTH] Uptime: ${uptime}min | Processed: ${stats.jobs_processed} | Failed: ${stats.jobs_failed}`);
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Start the worker
main();
