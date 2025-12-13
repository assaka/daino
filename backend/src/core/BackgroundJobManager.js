const { EventEmitter } = require('events');
const Job = require('../models/Job');
const JobHistory = require('../models/JobHistory');
const { masterSequelize } = require('../database/masterConnection');
const bullMQManager = require('./BullMQManager');

/**
 * Unified Background Job Manager
 * Handles all background jobs including Akeneo imports, plugin installations, etc.
 *
 * Now with BullMQ integration for persistent queues that survive deployments.
 */
class BackgroundJobManager extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.workers = new Map(); // Worker instances by type
    this.queues = new Map(); // Job queues by priority
    this.processing = new Set(); // Currently processing job IDs
    this.retryDelays = [5000, 30000, 300000, 1800000]; // 5s, 30s, 5m, 30m
    this.maxConcurrentJobs = 5;
    this.pollInterval = 5000; // 5 seconds
    this.shutdownTimeout = 30000; // 30 seconds
    this.initialized = false;
    this.useBullMQ = false; // Will be set during initialization
  }

  /**
   * Initialize the job manager
   */
  async initialize() {
    if (this.initialized) {
      console.log('ℹ️ Background Job Manager already initialized');
      return;
    }

    console.log('🔧 Initializing Background Job Manager...');

    // ALWAYS register job types first - this is critical and should never be skipped
    try {
      console.log('📝 Registering job types (CRITICAL - running first)...');
      this.registerJobTypes();
      console.log(`✅ Registered ${this.workers.size} job types`);
    } catch (error) {
      console.error('❌ CRITICAL: Job type registration failed:', error.message);
      console.error(error.stack);
      // Still try to continue - at least some jobs might have registered
    }

    try {
      // Try to initialize BullMQ
      this.useBullMQ = await bullMQManager.initialize();
      if (this.useBullMQ) {
        console.log('✅ BullMQ initialized - using persistent queue');
      } else {
        console.log('ℹ️ BullMQ not available - using database queue');
      }
    } catch (error) {
      console.error('❌ BullMQ initialization failed:', error.message);
      this.useBullMQ = false;
    }

    try {
      // Ensure database tables exist
      await this.ensureTablesExist();
      console.log('✅ Job tables verified');
    } catch (error) {
      console.error('❌ Job tables verification failed:', error.message);
      console.error('⚠️ Continuing anyway - jobs can still be scheduled');
    }

    try {
      // Start the job processor
      await this.start();
      console.log('✅ Job processor started');
    } catch (error) {
      console.error('❌ Job processor start failed:', error.message);
      console.error('⚠️ Continuing anyway - jobs can be scheduled but may not process');
    }

    try {
      // Schedule recurring system jobs
      await this.scheduleSystemJobs();
      console.log('✅ System jobs scheduled');
    } catch (error) {
      console.error('❌ System jobs scheduling failed:', error.message);
      // Don't throw - system jobs are optional
    }

    this.initialized = true;
    console.log(`✅ Background Job Manager initialization complete (${this.workers.size} job types registered)`);
  }

  /**
   * Ensure job-related database tables exist
   */
  async ensureTablesExist() {
    // Tables will be created by migrations, but we verify they exist
    try {
      await Job.findAll({ limit: 1 });
      await JobHistory.findAll({ limit: 1 });
    } catch (error) {
      console.warn('⚠️ Job tables may not exist:', error.message);
    }
  }

  /**
   * Register default job types and their handlers
   */
  registerJobTypes() {
    const jobTypes = [
      // Akeneo import jobs
      ['akeneo:import:categories', './jobs/AkeneoImportCategoriesJob'],
      ['akeneo:import:products', './jobs/AkeneoImportProductsJob'],
      ['akeneo:import:attributes', './jobs/AkeneoImportAttributesJob'],
      ['akeneo:import:families', './jobs/AkeneoImportFamiliesJob'],
      ['akeneo:import:all', './jobs/AkeneoImportAllJob'],

      // Plugin management jobs
      ['plugin:install', './jobs/PluginInstallJob'],
      ['plugin:uninstall', './jobs/PluginUninstallJob'],
      ['plugin:update', './jobs/PluginUpdateJob'],

      // System maintenance jobs
      ['system:cleanup', './jobs/SystemCleanupJob'],
      ['system:backup', './jobs/SystemBackupJob'],
      ['system:daily_credit_deduction', './jobs/DailyCreditDeductionJob'],
      ['system:dynamic_cron', './jobs/DynamicCronJob'],
      ['system:finalize_pending_orders', './jobs/FinalizePendingOrdersJob'],
      ['system:token_refresh', './jobs/TokenRefreshJob'],

      // Translation jobs
      ['translation:ui-labels:bulk', './jobs/UILabelsBulkTranslationJob'],

      // Shopify import jobs
      ['shopify:import:collections', './jobs/ShopifyImportCollectionsJob'],
      ['shopify:import:products', './jobs/ShopifyImportProductsJob'],
      ['shopify:import:all', './jobs/ShopifyImportAllJob'],

      // Amazon export jobs
      ['amazon:export:products', './jobs/AmazonExportProductsJob'],
      ['amazon:sync:inventory', './jobs/AmazonSyncInventoryJob'],

      // eBay export jobs
      ['ebay:export:products', './jobs/EbayExportProductsJob']
    ];

    for (const [type, path] of jobTypes) {
      try {
        const handlerClass = require(path);
        this.registerJobType(type, handlerClass);
      } catch (error) {
        console.error(`❌ Failed to register job type '${type}':`, error.message);
        // Continue registering other jobs even if one fails
      }
    }
  }

  /**
   * Register a job type with its handler
   */
  registerJobType(type, handlerClass) {
    if (!handlerClass) {
      console.error(`❌ Cannot register job type '${type}': handler class is undefined`);
      return;
    }

    this.workers.set(type, handlerClass);

    // Also register with BullMQ if available
    if (this.useBullMQ) {
      try {
        bullMQManager.registerJobType(type, handlerClass);
      } catch (error) {
        console.error(`❌ Failed to register '${type}' with BullMQ:`, error.message);
      }
    }

    console.log(`✅ Registered job type: ${type}`);
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(jobData) {
    const {
      type,
      payload = {},
      priority = 'normal',
      delay = 0,
      maxRetries = 3,
      storeId,
      userId,
      metadata = {}
    } = jobData;

    if (!this.workers.has(type)) {
      throw new Error(`Unknown job type: ${type}`);
    }

    const scheduledAt = new Date(Date.now() + delay);

    // Create job record in database (source of truth)
    // Use Supabase client directly to avoid Sequelize authentication issues
    let job;
    try {
      const { masterDbClient } = require('../database/masterConnection');
      const { v4: uuidv4 } = require('uuid');

      if (!masterDbClient) {
        console.error('❌ masterDbClient not available, falling back to Sequelize');
        // Fallback to Sequelize
        job = await Job.create({
          type,
          payload,
          priority,
          status: 'pending',
          scheduled_at: scheduledAt,
          max_retries: maxRetries,
          retry_count: 0,
          store_id: storeId,
          user_id: userId,
          metadata
        });
      } else {
        // Use Supabase client directly - map to job_queue table schema
        const jobData = {
          id: uuidv4(),
          job_type: type,  // job_queue uses 'job_type' not 'type'
          payload,
          priority,
          status: 'pending',
          max_retries: maxRetries,
          retry_count: 0,
          store_id: storeId,
          user_id: userId,
          metadata
          // Note: created_at will be set by database default
        };

        console.log('📝 Creating job via Supabase client:', { type, storeId });
        const { data, error } = await masterDbClient
          .from('job_queue')
          .insert(jobData)
          .select()
          .single();

        if (error) {
          console.error('❌ Supabase job creation failed:', error);
          throw new Error(`Failed to create job: ${error.message}`);
        }

        job = data;
        console.log('✅ Job created via Supabase:', job.id);
      }
    } catch (error) {
      console.error('❌ Failed to create job in database:', error.message);
      console.error('Database error details:', {
        error: error.name,
        message: error.message,
        code: error.code,
        type: type,
        storeId: storeId
      });
      throw new Error(`Failed to schedule job: ${error.message}`);
    }

    // If BullMQ is available, add to persistent queue
    if (this.useBullMQ) {
      try {
        await bullMQManager.addJob(type, {
          jobRecord: job.toJSON(),
          jobId: job.id,
        }, {
          priority,
          maxRetries,
          scheduledAt,
        });
        console.log(`📅 Job scheduled in BullMQ: ${type} (ID: ${job.id})`);
      } catch (error) {
        console.error('❌ Failed to add job to BullMQ, will use database queue:', error.message);
      }
    } else {
      console.log(`📅 Job scheduled in database: ${type} (ID: ${job.id}) for ${scheduledAt.toISOString()}`);
    }

    this.emit('job:scheduled', job);
    return job;
  }

  /**
   * Schedule a recurring job (cron-like)
   */
  async scheduleRecurringJob(jobData, cronExpression) {
    // For now, we'll implement basic recurring patterns
    // In production, you might want to use node-cron or similar
    const {
      type,
      payload = {},
      priority = 'normal',
      maxRetries = 3,
      storeId,
      userId,
      metadata = {}
    } = jobData;

    const nextRun = this.calculateNextRun(cronExpression);
    
    return this.scheduleJob({
      type,
      payload: {
        ...payload,
        isRecurring: true,
        cronExpression
      },
      priority,
      delay: nextRun.getTime() - Date.now(),
      maxRetries,
      storeId,
      userId,
      metadata
    });
  }

  /**
   * Start the job processor
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🚀 Starting background job processor...');

    // Resume any jobs that were running when the server shut down
    await this.resumeInterruptedJobs();

    // If using BullMQ, start workers
    if (this.useBullMQ) {
      console.log('🚀 Starting BullMQ workers...');
      await bullMQManager.startWorkers();
    } else {
      // Start the main processing loop (database queue)
      this.processLoop();
    }

    this.emit('manager:started');
  }

  /**
   * Stop the job processor gracefully
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('⏹️ Stopping background job processor...');
    this.isRunning = false;

    // If using BullMQ, close all connections
    if (this.useBullMQ) {
      await bullMQManager.close();
    } else {
      // Wait for current jobs to finish or timeout (database queue)
      const timeout = setTimeout(() => {
        console.warn('⚠️ Force stopping job processor (timeout reached)');
        this.processing.clear();
      }, this.shutdownTimeout);

      // Wait for all jobs to finish
      while (this.processing.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearTimeout(timeout);
    }

    this.emit('manager:stopped');
    console.log('✅ Background job processor stopped');
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    while (this.isRunning) {
      try {
        if (this.processing.size < this.maxConcurrentJobs) {
          const job = await this.getNextJob();
          if (job) {
            this.processJob(job);
          }
        }
      } catch (error) {
        console.error('❌ Error in job processing loop:', error);
      }

      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }

  /**
   * Get the next job to process
   */
  async getNextJob() {
    return Job.findOne({
      where: {
        status: 'pending',
        scheduled_at: { [masterSequelize.Sequelize.Op.lte]: new Date() }
      },
      order: [
        ['priority', 'DESC'], // High priority first
        ['scheduled_at', 'ASC'], // Older jobs first
        ['created_at', 'ASC']
      ]
    });
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    if (this.processing.has(job.id)) return;

    this.processing.add(job.id);
    
    try {
      console.log(`🔄 Processing job: ${job.type} (ID: ${job.id})`);
      
      // Update job status
      await job.update({ 
        status: 'running', 
        started_at: new Date() 
      });

      this.emit('job:started', job);

      // Get the job handler
      const HandlerClass = this.workers.get(job.type);
      if (!HandlerClass) {
        throw new Error(`No handler found for job type: ${job.type}`);
      }

      // Create and execute the job
      const handler = new HandlerClass(job);
      const result = await handler.execute();

      // Update job as completed
      await job.update({
        status: 'completed',
        completed_at: new Date(),
        result: result || {}
      });

      // Create job history record
      await JobHistory.create({
        job_id: job.id,
        status: 'completed',
        result: result || {},
        executed_at: new Date()
      });

      console.log(`✅ Job completed: ${job.type} (ID: ${job.id})`);
      this.emit('job:completed', job, result);

      // Handle recurring jobs
      if (job.payload.isRecurring) {
        await this.scheduleNextRecurrence(job);
      }

    } catch (error) {
      console.error(`❌ Job failed: ${job.type} (ID: ${job.id}):`, error);
      await this.handleJobFailure(job, error);
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Handle job failure and retries
   */
  async handleJobFailure(job, error) {
    const retryCount = job.retry_count + 1;
    const canRetry = retryCount <= job.max_retries;

    // Create history record for the failure
    await JobHistory.create({
      job_id: job.id,
      status: 'failed',
      error: {
        message: error.message,
        stack: error.stack,
        retry_count: retryCount
      },
      executed_at: new Date()
    });

    if (canRetry) {
      // Calculate retry delay (exponential backoff)
      const delayIndex = Math.min(retryCount - 1, this.retryDelays.length - 1);
      const retryDelay = this.retryDelays[delayIndex];
      const nextAttempt = new Date(Date.now() + retryDelay);

      await job.update({
        status: 'pending',
        retry_count: retryCount,
        scheduled_at: nextAttempt,
        last_error: error.message
      });

      console.log(`🔄 Job will retry in ${retryDelay/1000}s: ${job.type} (ID: ${job.id}, attempt ${retryCount}/${job.max_retries})`);
      this.emit('job:retry_scheduled', job, retryCount);
    } else {
      // Mark as permanently failed
      await job.update({
        status: 'failed',
        failed_at: new Date(),
        last_error: error.message
      });

      console.error(`💀 Job permanently failed: ${job.type} (ID: ${job.id})`);
      this.emit('job:failed', job, error);
    }
  }

  /**
   * Resume jobs that were interrupted by server restart
   */
  async resumeInterruptedJobs() {
    const interruptedJobs = await Job.findAll({
      where: { status: 'running' }
    });

    if (interruptedJobs.length > 0) {
      console.log(`🔄 Resuming ${interruptedJobs.length} interrupted jobs...`);
      
      for (const job of interruptedJobs) {
        await job.update({ 
          status: 'pending',
          scheduled_at: new Date() // Reschedule immediately
        });
      }
    }
  }

  /**
   * Schedule next recurrence for recurring jobs
   */
  async scheduleNextRecurrence(job) {
    const nextRun = this.calculateNextRun(job.payload.cronExpression);
    
    await this.scheduleJob({
      type: job.type,
      payload: job.payload,
      priority: job.priority,
      delay: nextRun.getTime() - Date.now(),
      maxRetries: job.max_retries,
      storeId: job.store_id,
      userId: job.user_id,
      metadata: job.metadata
    });
  }

  /**
   * Calculate next run time for cron expression (basic implementation)
   */
  calculateNextRun(cronExpression) {
    // Basic patterns: 'daily', 'weekly', 'hourly', etc.
    // In production, use a proper cron parser like node-cron
    const now = new Date();

    switch (cronExpression) {
      case 'every_5_minutes':
        return new Date(now.getTime() + 5 * 60 * 1000);
      case 'every_10_minutes':
        return new Date(now.getTime() + 10 * 60 * 1000);
      case 'every_15_minutes':
        return new Date(now.getTime() + 15 * 60 * 1000);
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      default:
        // Default to daily
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get job statistics
   */
  async getStatistics(timeRange = '24h') {
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

    const [totalJobs, completedJobs, failedJobs, pendingJobs, runningJobs] = await Promise.all([
      Job.count({ where: { created_at: { [masterSequelize.Sequelize.Op.gte]: since } } }),
      Job.count({ where: { status: 'completed', created_at: { [masterSequelize.Sequelize.Op.gte]: since } } }),
      Job.count({ where: { status: 'failed', created_at: { [masterSequelize.Sequelize.Op.gte]: since } } }),
      Job.count({ where: { status: 'pending' } }),
      Job.count({ where: { status: 'running' } })
    ]);

    return {
      total: totalJobs,
      completed: completedJobs,
      failed: failedJobs,
      pending: pendingJobs,
      running: runningJobs,
      success_rate: totalJobs > 0 ? (completedJobs / totalJobs * 100).toFixed(2) + '%' : '0%',
      currently_processing: this.processing.size
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === 'running') {
      throw new Error('Cannot cancel a running job');
    }

    await job.update({ 
      status: 'cancelled',
      cancelled_at: new Date()
    });

    this.emit('job:cancelled', job);
    return job;
  }

  /**
   * Get job details with history
   */
  async getJobDetails(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job) return null;

    const history = await JobHistory.findAll({
      where: { job_id: jobId },
      order: [['executed_at', 'DESC']]
    });

    // If using BullMQ, also get queue status
    let queueStatus = null;
    if (this.useBullMQ) {
      try {
        queueStatus = await bullMQManager.getJobStatus(job.type, jobId);
      } catch (error) {
        console.warn('Failed to get BullMQ status:', error.message);
      }
    }

    return {
      ...job.toJSON(),
      history,
      queueStatus
    };
  }

  /**
   * Get job status for polling (lightweight)
   */
  async getJobStatus(jobId) {
    const job = await Job.findByPk(jobId, {
      attributes: ['id', 'type', 'status', 'progress', 'progress_message', 'result', 'last_error']
    });

    if (!job) {
      return null;
    }

    return job.toJSON();
  }

  /**
   * Schedule system-level recurring jobs
   */
  async scheduleSystemJobs() {
    console.log('📅 Scheduling system jobs...');

    try {
      // Check if daily credit deduction job is already scheduled
      const existingJob = await Job.findOne({
        where: {
          type: 'system:daily_credit_deduction',
          status: 'pending'
        }
      });

      if (!existingJob) {
        // Schedule daily credit deduction job
        await this.scheduleRecurringJob({
          type: 'system:daily_credit_deduction',
          payload: {},
          priority: 'high', // High priority for billing-related tasks
          maxRetries: 3
        }, 'daily');

        console.log('✅ Scheduled daily credit deduction job');
      } else {
        console.log('ℹ️ Daily credit deduction job already scheduled');
      }

      // Check if pending orders finalization job is already scheduled
      const existingFinalizationJob = await Job.findOne({
        where: {
          type: 'system:finalize_pending_orders',
          status: 'pending'
        }
      });

      if (!existingFinalizationJob) {
        // Schedule pending orders finalization job (every 10 minutes)
        await this.scheduleRecurringJob({
          type: 'system:finalize_pending_orders',
          payload: {},
          priority: 'high', // High priority for customer-facing functionality
          maxRetries: 3
        }, 'every_10_minutes');

        console.log('✅ Scheduled pending orders finalization job (every 10 minutes)');
      } else {
        console.log('ℹ️ Pending orders finalization job already scheduled');
      }

      // Note: Database-driven cron jobs are now handled by unified-scheduler.js
      // which runs via Render cron (external) instead of internal polling

    } catch (error) {
      console.error('❌ Failed to schedule system jobs:', error.message);
      // Don't throw error to prevent server startup failure
    }
  }
}

// Export singleton instance
const jobManager = new BackgroundJobManager();

// CRITICAL: Register job types immediately on module load
// This ensures jobs are registered even if initialize() is never called or fails
console.log('📝 Pre-registering job types on module load...');
try {
  jobManager.registerJobTypes();
  console.log(`✅ Pre-registered ${jobManager.workers.size} job types at module load`);
} catch (error) {
  console.error('❌ CRITICAL: Failed to pre-register job types:', error.message);
  console.error(error.stack);
}

module.exports = jobManager;
// IMMEDIATE REGISTRATION - Run at module load time
console.log('🚀 IMMEDIATE: Registering job types at module load...');
jobManager.registerJobTypes();
console.log(`✅ IMMEDIATE: ${jobManager.workers.size} job types ready`);
