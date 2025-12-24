#!/usr/bin/env node
/**
 * Unified Scheduler
 *
 * Single entry point for ALL scheduled tasks:
 * - Akeneo imports (from cron_jobs table)
 * - Daily credit deduction (system job)
 * - OAuth token refresh (system job)
 * - Plugin cron jobs (from cron_jobs table)
 * - Any other scheduled tasks
 *
 * Triggered by Render Cron every hour: "0 * * * *"
 */

console.log('='.repeat(60));
console.log('UNIFIED SCHEDULER STARTED');
console.log('Timestamp:', new Date().toISOString());
console.log('='.repeat(60));

require('dotenv').config();

const { masterDbClient } = require('../src/database/masterConnection');
const ConnectionManager = require('../src/services/database/ConnectionManager');
const CronLogService = require('../src/services/cron-log-service');

// Track execution stats
const stats = {
  started_at: new Date(),
  jobs_found: 0,
  jobs_executed: 0,
  jobs_failed: 0,
  errors: []
};

/**
 * Get all due cron jobs across all tenants
 */
async function getDueCronJobs() {
  const dueJobs = [];

  try {
    // Get all active stores
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id, slug')
      .eq('is_active', true);

    if (storesError) {
      console.error('Error fetching stores:', storesError.message);
      return dueJobs;
    }

    console.log(`Found ${stores.length} active stores`);

    // Check each tenant for due jobs
    for (const store of stores) {
      try {
        const tenantDb = await ConnectionManager.getConnection(store.id);

        const { data: jobs, error: jobsError } = await tenantDb
          .from('cron_jobs')
          .select('*')
          .eq('is_active', true)
          .eq('is_paused', false)
          .lte('next_run_at', new Date().toISOString())
          .order('next_run_at', { ascending: true });

        if (jobsError) {
          console.error(`Error fetching jobs for store ${store.slug}:`, jobsError.message);
          continue;
        }

        if (jobs && jobs.length > 0) {
          console.log(`  Store ${store.slug}: ${jobs.length} due jobs`);
          jobs.forEach(job => {
            dueJobs.push({
              ...job,
              store_id: store.id,
              store_slug: store.slug,
              _tenantDb: tenantDb
            });
          });
        }
      } catch (err) {
        console.error(`Error connecting to tenant ${store.slug}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error in getDueCronJobs:', err.message);
  }

  return dueJobs;
}

/**
 * Execute a single cron job
 */
async function executeCronJob(cronJob) {
  const { id, name, job_type, configuration, store_id, store_slug, _tenantDb } = cronJob;

  console.log(`\n  Executing: ${name} (${job_type}) for store ${store_slug}`);

  const startTime = Date.now();
  let result = { success: false };

  try {
    // Create execution record
    const executionId = require('crypto').randomUUID();
    await _tenantDb.from('cron_job_executions').insert({
      id: executionId,
      cron_job_id: id,
      status: 'running',
      triggered_by: 'unified_scheduler',
      server_instance: 'render-cron'
    });

    // Route to appropriate handler based on job_type
    switch (job_type) {
      case 'akeneo_import':
        result = await executeAkeneoImport(cronJob);
        break;

      case 'system_job':
        result = await executeSystemJob(cronJob);
        break;

      case 'token_refresh':
        result = await executeTokenRefresh(cronJob);
        break;

      case 'plugin_job':
        result = await executePluginJob(cronJob);
        break;

      case 'webhook':
        result = await executeWebhook(cronJob);
        break;

      default:
        console.warn(`    Unknown job_type: ${job_type}`);
        result = { success: false, error: `Unknown job_type: ${job_type}` };
    }

    const duration = Date.now() - startTime;

    // Update execution record
    await _tenantDb
      .from('cron_job_executions')
      .update({
        status: result.success ? 'success' : 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        result: result,
        error_message: result.error || null
      })
      .eq('id', executionId);

    // Update cron_job stats and next_run_at
    const nextRun = calculateNextRun(cronJob.cron_expression, cronJob.timezone);
    await _tenantDb
      .from('cron_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString(),
        last_status: result.success ? 'success' : 'failed',
        last_error: result.error || null,
        run_count: (cronJob.run_count || 0) + 1,
        success_count: result.success ? (cronJob.success_count || 0) + 1 : cronJob.success_count,
        failure_count: result.success ? cronJob.failure_count : (cronJob.failure_count || 0) + 1,
        consecutive_failures: result.success ? 0 : (cronJob.consecutive_failures || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Handle one-time schedules
    if (cronJob.metadata?.schedule_type === 'once') {
      await _tenantDb
        .from('cron_jobs')
        .update({ is_active: false })
        .eq('id', id);
      console.log(`    Deactivated one-time schedule: ${name}`);
    }

    console.log(`    ${result.success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`);
    return result;

  } catch (error) {
    console.error(`    ERROR: ${error.message}`);
    stats.errors.push({ job: name, store: store_slug, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Execute Akeneo import job
 */
async function executeAkeneoImport(cronJob) {
  const { configuration, store_id } = cronJob;
  const { import_type, filters, options } = configuration;

  console.log(`    Akeneo ${import_type} import`);

  try {
    // Schedule background job for actual import
    const jobManager = require('../src/core/BackgroundJobManager');
    await jobManager.initialize();

    const jobTypeMap = {
      'categories': 'akeneo:import:categories',
      'products': 'akeneo:import:products',
      'attributes': 'akeneo:import:attributes',
      'families': 'akeneo:import:families',
      'all': 'akeneo:import:all'
    };

    const job = await jobManager.scheduleJob({
      type: jobTypeMap[import_type] || 'akeneo:import:products',
      payload: {
        storeId: store_id,
        filters: filters || {},
        options: options || {},
        source: 'unified_scheduler'
      },
      priority: 'normal',
      storeId: store_id,
      metadata: {
        triggered_by: 'unified_scheduler',
        cron_job_id: cronJob.id
      }
    });

    return { success: true, job_id: job.id, import_type };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute system job (credit deduction, etc.)
 */
async function executeSystemJob(cronJob) {
  const { configuration, name } = cronJob;
  const { job_class } = configuration;

  console.log(`    System job: ${job_class || name}`);

  try {
    if (job_class === 'DailyCreditDeductionJob' || name.includes('Credit Deduction')) {
      const DailyCreditDeductionJob = require('../src/core/jobs/DailyCreditDeductionJob');
      const job = new DailyCreditDeductionJob({
        id: `unified-${Date.now()}`,
        type: 'system:daily_credit_deduction',
        payload: {}
      });
      const result = await job.execute();
      return { success: true, ...result };
    }

    return { success: false, error: `Unknown system job: ${job_class}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute token refresh job
 */
async function executeTokenRefresh(cronJob) {
  const { configuration } = cronJob;
  const { bufferMinutes = 60, batchSize = 10 } = configuration || {};

  console.log(`    Token refresh (buffer: ${bufferMinutes}min)`);

  try {
    const TokenRefreshJob = require('../src/core/jobs/TokenRefreshJob');
    const job = new TokenRefreshJob({
      id: `unified-${Date.now()}`,
      type: 'system:token_refresh',
      payload: { bufferMinutes, batchSize }
    });
    const result = await job.execute();
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute plugin job
 */
async function executePluginJob(cronJob) {
  const { configuration, store_id } = cronJob;

  console.log(`    Plugin job: ${configuration.handler_method}`);

  try {
    // Plugin jobs are scheduled as background jobs
    const jobManager = require('../src/core/BackgroundJobManager');
    await jobManager.initialize();

    const job = await jobManager.scheduleJob({
      type: 'plugin:cron:execute',
      payload: {
        storeId: store_id,
        handler_method: configuration.handler_method,
        handler_params: configuration.handler_params || {}
      },
      priority: 'normal',
      storeId: store_id
    });

    return { success: true, job_id: job.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute webhook job
 */
async function executeWebhook(cronJob) {
  const { configuration } = cronJob;
  const { url, method = 'POST', headers = {}, body } = configuration;

  console.log(`    Webhook: ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Calculate next run time from cron expression
 */
function calculateNextRun(cronExpression, timezone = 'UTC') {
  try {
    const { parseExpression } = require('cron-parser');
    const interval = parseExpression(cronExpression, {
      currentDate: new Date(),
      tz: timezone
    });
    return interval.next().toDate();
  } catch (error) {
    // Fallback: 1 hour from now
    console.warn(`    Could not parse cron expression "${cronExpression}": ${error.message}`);
    return new Date(Date.now() + 60 * 60 * 1000);
  }
}

/**
 * Run system jobs that always execute (not dependent on cron_jobs table)
 */
async function runSystemJobs() {
  const systemResults = {
    token_refresh: null,
    daily_credit: null
  };

  // 1. Token Refresh - ALWAYS runs (hourly)
  console.log('\n[SYSTEM] Running token refresh...');
  try {
    const TokenRefreshJob = require('../src/core/jobs/TokenRefreshJob');
    const job = new TokenRefreshJob({
      id: `system-token-${Date.now()}`,
      type: 'system:token_refresh',
      payload: { bufferMinutes: 60, batchSize: 10 }
    });
    const result = await job.execute();
    systemResults.token_refresh = { success: true, ...result };
    console.log(`  Token refresh: ${result.refreshed || 0} refreshed, ${result.failed || 0} failed`);
    stats.jobs_executed++;
  } catch (error) {
    systemResults.token_refresh = { success: false, error: error.message };
    console.error(`  Token refresh FAILED: ${error.message}`);
    stats.jobs_failed++;
    stats.errors.push({ job: 'System: Token Refresh', store: 'system', error: error.message });
  }

  // 2. Credit Deduction - Only runs at midnight UTC (hour 0)
  const currentHour = new Date().getUTCHours();
  if (currentHour === 0) {
    console.log(`\n[SYSTEM] Running daily credit deduction (midnight UTC)...`);
    try {
      const DailyCreditDeductionJob = require('../src/core/jobs/DailyCreditDeductionJob');
      const job = new DailyCreditDeductionJob({
        id: `system-credit-${Date.now()}`,
        type: 'system:daily_credit_deduction',
        payload: {}
      });
      const result = await job.execute();
      systemResults.daily_credit = { success: true, ...result };
      console.log(`  Credit deduction: ${result.stores?.successful || 0} stores, ${result.custom_domains?.successful || 0} domains`);
      stats.jobs_executed++;
    } catch (error) {
      systemResults.daily_credit = { success: false, error: error.message };
      console.error(`  Credit deduction FAILED: ${error.message}`);
      stats.jobs_failed++;
      stats.errors.push({ job: 'System: Daily Credit Deduction', store: 'system', error: error.message });
    }
  } else {
    console.log(`\n[SYSTEM] Skipping daily credit deduction (current hour: ${currentHour}, runs at midnight UTC)`);
  }

  return systemResults;
}

/**
 * Main execution
 */
async function main() {
  let cronLog = null;

  try {
    // Start cron log entry
    cronLog = await CronLogService.startLog('unified_scheduler', {
      job_type: 'system',
      trigger_source: 'cron',
      metadata: { node_version: process.version }
    });
    if (cronLog) console.log('📝 Cron log started:', cronLog.id);

    // 1. Run system jobs first (token refresh, credit deduction)
    console.log('\n[1/4] Running system jobs...');
    await runSystemJobs();
    stats.jobs_found += 1; // Token refresh always runs

    // 2. Get all due jobs across all tenants
    console.log('\n[2/4] Fetching due cron jobs from database...');
    const dueJobs = await getDueCronJobs();
    stats.jobs_found += dueJobs.length;

    if (dueJobs.length === 0) {
      console.log('No tenant cron jobs due for execution.');
    } else {
      console.log(`\n[3/4] Executing ${dueJobs.length} tenant jobs...`);

      // 3. Execute each job
      for (const job of dueJobs) {
        try {
          const result = await executeCronJob(job);
          if (result.success) {
            stats.jobs_executed++;
          } else {
            stats.jobs_failed++;
          }
        } catch (error) {
          stats.jobs_failed++;
          stats.errors.push({
            job: job.name,
            store: job.store_slug,
            error: error.message
          });
        }
      }
    }

    // 4. Print summary
    console.log('\n[4/4] Execution Summary');
    console.log('='.repeat(60));
    console.log(`Jobs found:    ${stats.jobs_found}`);
    console.log(`Jobs executed: ${stats.jobs_executed}`);
    console.log(`Jobs failed:   ${stats.jobs_failed}`);
    console.log(`Duration:      ${Date.now() - stats.started_at.getTime()}ms`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(err => {
        console.log(`  - ${err.job} (${err.store}): ${err.error}`);
      });
    }

    // Mark cron log as completed
    if (cronLog) {
      await CronLogService.markCompleted(cronLog.id, {
        jobs_found: stats.jobs_found,
        jobs_executed: stats.jobs_executed,
        jobs_failed: stats.jobs_failed,
        errors: stats.errors
      }, {
        stores_processed: stats.jobs_found,
        stores_affected: stats.jobs_executed,
        items_processed: stats.jobs_executed
      });
      console.log('📝 Cron log completed:', cronLog.id);
    }

    console.log('='.repeat(60));
    console.log('UNIFIED SCHEDULER COMPLETED');
    console.log('='.repeat(60));

    process.exit(stats.jobs_failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);

    // Mark cron log as failed
    if (cronLog) {
      await CronLogService.markFailed(cronLog.id, error);
      console.log('📝 Cron log marked as failed:', cronLog.id);
    }

    process.exit(1);
  }
}

// Run
main();
