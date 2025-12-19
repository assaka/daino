#!/usr/bin/env node

/**
 * Process Import/Export Jobs (Cron Script)
 *
 * Processes pending import and export jobs from various sources:
 * - Shopify imports (collections, products)
 * - Amazon exports and inventory syncs
 * - eBay exports
 * - Akeneo imports (products, categories, attributes, families)
 *
 * Runs every 5 minutes via Render cron.
 * Users receive email notifications when jobs complete.
 *
 * Usage:
 * - Scheduled via Render cron: (every 5 minutes)
 * - Processes multiple jobs if time permits
 */

require('dotenv').config();
const { sequelize } = require('../src/database/connection');
const Job = require('../src/models/Job');

// Import job handlers
const ShopifyImportCollectionsJob = require('../src/core/jobs/ShopifyImportCollectionsJob');
const ShopifyImportProductsJob = require('../src/core/jobs/ShopifyImportProductsJob');
const ShopifyImportAllJob = require('../src/core/jobs/ShopifyImportAllJob');
const AmazonExportProductsJob = require('../src/core/jobs/AmazonExportProductsJob');
const AmazonSyncInventoryJob = require('../src/core/jobs/AmazonSyncInventoryJob');
const EbayExportProductsJob = require('../src/core/jobs/EbayExportProductsJob');
const AkeneoImportCategoriesJob = require('../src/core/jobs/AkeneoImportCategoriesJob');
const AkeneoImportProductsJob = require('../src/core/jobs/AkeneoImportProductsJob');
const AkeneoImportAttributesJob = require('../src/core/jobs/AkeneoImportAttributesJob');
const AkeneoImportFamiliesJob = require('../src/core/jobs/AkeneoImportFamiliesJob');
const AkeneoImportAllJob = require('../src/core/jobs/AkeneoImportAllJob');

const MAX_RUNTIME = 280000; // 280 seconds (4m40s) - leave buffer for cron timeout (5 min)
const MAX_JOBS_PER_RUN = 5; // Process up to 5 jobs per run

// Map job types to their handler classes
const JOB_HANDLERS = {
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
};

async function processImportExportJobs() {
  console.log('🔍 Checking for pending import/export jobs...');
  const startTime = Date.now();

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Get job types we can process
    const jobTypes = Object.keys(JOB_HANDLERS);

    // Find pending jobs
    const pendingJobs = await Job.findAll({
      where: {
        type: jobTypes,
        status: 'pending'
      },
      order: [
        ['priority', 'ASC'], // High priority first
        ['created_at', 'ASC'] // Then oldest first (FIFO)
      ],
      limit: MAX_JOBS_PER_RUN
    });

    if (pendingJobs.length === 0) {
      console.log('ℹ️ No pending import/export jobs found');
      return { processed: 0, message: 'No jobs to process' };
    }

    console.log(`📋 Found ${pendingJobs.length} pending job(s) to process`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const job of pendingJobs) {
      // Check if we're running out of time
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME) {
        console.log(`⏰ Approaching timeout (${elapsed}ms), stopping for this run`);
        console.log(`   ${pendingJobs.length - processedCount} job(s) remaining for next run`);
        break;
      }

      try {
        console.log(`\n🚀 Processing job ${job.id}: ${job.type}`);
        console.log(`   Store: ${job.store_id}, Priority: ${job.priority}`);

        // Get the handler class for this job type
        const HandlerClass = JOB_HANDLERS[job.type];

        if (!HandlerClass) {
          console.error(`❌ No handler found for job type: ${job.type}`);
          skippedCount++;
          continue;
        }

        // Update status to running
        await job.update({
          status: 'running',
          started_at: new Date()
        });

        // Create handler and execute
        const handler = new HandlerClass(job);
        const result = await handler.execute();

        // Update status to completed
        await job.update({
          status: 'completed',
          completed_at: new Date(),
          result: result,
          progress: 100
        });

        console.log(`✅ Job ${job.id} completed successfully`);
        if (result) {
          // Log key metrics if available
          if (result.imported) console.log(`   - Imported: ${result.imported}`);
          if (result.exported) console.log(`   - Exported: ${result.exported}`);
          if (result.total) console.log(`   - Total: ${result.total}`);
          if (result.failed) console.log(`   - Failed: ${result.failed}`);
        }

        processedCount++;

      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error.message);

        // Increment retry count
        const retryCount = (job.retry_count || 0) + 1;
        const maxRetries = job.max_retries || 3;

        if (retryCount < maxRetries) {
          // Mark for retry
          await job.update({
            status: 'pending',
            retry_count: retryCount,
            error_message: error.message
          });
          console.log(`   ↻ Job ${job.id} will be retried (attempt ${retryCount}/${maxRetries})`);
        } else {
          // Max retries reached, mark as failed
          await job.update({
            status: 'failed',
            completed_at: new Date(),
            error_message: error.message,
            retry_count: retryCount
          });
          console.log(`   ✗ Job ${job.id} failed permanently after ${retryCount} attempts`);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n📊 Summary:`);
    console.log(`   - Processed: ${processedCount} job(s)`);
    console.log(`   - Skipped: ${skippedCount} job(s)`);
    console.log(`   - Duration: ${(totalTime / 1000).toFixed(2)}s`);

    return {
      processed: processedCount,
      skipped: skippedCount,
      duration: totalTime,
      message: `Processed ${processedCount} import/export job(s)`
    };

  } catch (error) {
    console.error('❌ Error processing import/export jobs:', error);
    throw error;
  } finally {
    // Close database connection
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
(async () => {
  try {
    const result = await processImportExportJobs();
    console.log('✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
})();
