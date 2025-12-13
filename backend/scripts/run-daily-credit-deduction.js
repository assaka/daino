#!/usr/bin/env node
/**
 * Run Daily Credit Deduction
 *
 * This script can be executed:
 * 1. As a Render Cron Job (scheduled daily)
 * 2. Manually from command line
 * 3. Via API endpoint
 *
 * Logs execution to master DB cron_logs table for monitoring
 */

console.log('=== DAILY CREDIT DEDUCTION SCRIPT STARTED ===');
console.log('Timestamp:', new Date().toISOString());

// Log env vars (masked)
console.log('ENV CHECK:');
console.log('  MASTER_DB_URL:', process.env.MASTER_DB_URL ? 'SET (' + process.env.MASTER_DB_URL.substring(0, 30) + '...)' : '❌ NOT SET');
console.log('  MASTER_SUPABASE_URL:', process.env.MASTER_SUPABASE_URL ? 'SET' : '❌ NOT SET');
console.log('  MASTER_SUPABASE_SERVICE_KEY:', process.env.MASTER_SUPABASE_SERVICE_KEY ? 'SET (length: ' + process.env.MASTER_SUPABASE_SERVICE_KEY.length + ')' : '❌ NOT SET');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

require('dotenv').config();

console.log('Loading DailyCreditDeductionJob...');
const DailyCreditDeductionJob = require('../src/core/jobs/DailyCreditDeductionJob');
console.log('DailyCreditDeductionJob loaded successfully');

// Load CronLogService for logging (uses Supabase REST API, avoids Sequelize issues)
let CronLogService = null;
try {
  CronLogService = require('../src/services/cron-log-service');
  console.log('CronLogService loaded successfully');
} catch (err) {
  console.warn('CronLogService not available:', err.message);
}

async function runDailyDeduction() {
  console.log('runDailyDeduction() called');
  let cronLog = null;

  try {
    // Start cron log entry
    if (CronLogService) {
      try {
        cronLog = await CronLogService.startLog('daily_credit_deduction', {
          job_type: 'system',
          trigger_source: require.main === module ? 'cron' : 'api',
          metadata: {
            script_version: '1.0',
            node_version: process.version
          }
        });
        if (cronLog) console.log('📝 Cron log started:', cronLog.id);
      } catch (logErr) {
        console.warn('Failed to start cron log (table may not exist yet):', logErr.message);
      }
    }

    const mockJob = {
      id: `manual-${Date.now()}`,
      type: 'system:daily_credit_deduction',
      payload: {},
      priority: 'high',
      status: 'running',
      scheduled_at: new Date(),
      created_at: new Date()
    };

    console.log('Creating DailyCreditDeductionJob instance...');
    const job = new DailyCreditDeductionJob(mockJob);
    console.log('Calling job.execute()...');
    const result = await job.execute();
    console.log('Job execution completed');
    console.log('Full result:', JSON.stringify(result, null, 2));

    // Mark cron log as completed
    if (CronLogService && cronLog) {
      try {
        const storesProcessed = result.stores?.processed || 0;
        const storesAffected = result.stores?.successful || 0;
        const domainsProcessed = result.custom_domains?.processed || 0;
        const domainsAffected = result.custom_domains?.successful || 0;

        await CronLogService.markCompleted(cronLog.id, result, {
          stores_processed: storesProcessed + domainsProcessed,
          stores_affected: storesAffected + domainsAffected,
          items_processed: storesProcessed + domainsProcessed
        });
        console.log('📝 Cron log completed:', cronLog.id);
      } catch (logErr) {
        console.warn('Failed to complete cron log:', logErr.message);
      }
    }

    console.log(`Daily Credit Deduction: ${result.stores?.successful || 0}/${result.stores?.processed || 0} stores, ${result.custom_domains?.successful || 0}/${result.custom_domains?.processed || 0} domains`);
    console.log('=== DAILY CREDIT DEDUCTION SCRIPT FINISHED ===');
    process.exit(0);

  } catch (error) {
    console.error('=== DAILY CREDIT DEDUCTION FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Mark cron log as failed
    if (CronLogService && cronLog) {
      try {
        await CronLogService.markFailed(cronLog.id, error);
        console.log('📝 Cron log marked as failed:', cronLog.id);
      } catch (logErr) {
        console.warn('Failed to mark cron log as failed:', logErr.message);
      }
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runDailyDeduction();
}

module.exports = runDailyDeduction;
