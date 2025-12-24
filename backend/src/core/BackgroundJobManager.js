const { EventEmitter } = require('events');
const { masterDbClient } = require('../database/masterConnection');
const bullMQManager = require('./BullMQManager');
const { v4: uuidv4 } = require('uuid');

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

        // Register job types with BullMQ now that it's initialized
        console.log('📝 Registering job types with BullMQ...');
        for (const [type, handlerClass] of this.workers) {
          try {
            bullMQManager.registerJobType(type, handlerClass);
          } catch (err) {
            console.error(`❌ Failed to register '${type}' with BullMQ:`, err.message);
          }
        }
        console.log(`✅ Registered ${this.workers.size} job types with BullMQ`);
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
      if (!masterDbClient) {
        console.warn('⚠️ masterDbClient not available, skipping table verification');
        return;
      }
      const { error: jobError } = await masterDbClient
        .from('job_queue')
        .select('id')
        .limit(1);

      const { error: historyError } = await masterDbClient
        .from('job_history')
        .select('id')
        .limit(1);

      if (jobError) console.warn('⚠️ job_queue table check failed:', jobError.message);
      if (historyError) console.warn('⚠️ job_history table check failed:', historyError.message);
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
      ['ebay:export:products', './jobs/EbayExportProductsJob'],

      // Meta Commerce / Instagram Shopping jobs
      ['meta-commerce:sync:products', './jobs/MetaCommerceSyncJob'],

      // Integration category jobs
      ['integration:create:categories', './jobs/IntegrationCreateCategoriesJob'],

      // Marketing & CRM jobs
      ['marketing:campaign:send', './jobs/CampaignSendJob'],
      ['marketing:automation:process', './jobs/AutomationProcessJob'],
      ['marketing:abandoned_cart', './jobs/AbandonedCartJob'],
      ['marketing:rfm:calculate', './jobs/RfmCalculateJob'],
      ['marketing:sync:contacts', './jobs/MarketingSyncJob']
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

    // Create job record in master database (centralized job queue)
    let job;
    try {
      if (!masterDbClient) {
        throw new Error('Master database not available');
      }

      const jobRecord = {
        id: uuidv4(),
        job_type: type,
        payload,
        priority,
        status: 'pending',
        scheduled_at: scheduledAt.toISOString(),
        max_retries: maxRetries,
        retry_count: 0,
        store_id: storeId,
        user_id: userId,
        metadata
      };

      console.log('📝 Creating job in master DB:', { type, storeId });
      const { data, error } = await masterDbClient
        .from('job_queue')
        .insert(jobRecord)
        .select()
        .single();

      if (error) {
        console.error('❌ Job creation failed:', error);
        throw new Error(`Failed to create job: ${error.message}`);
      }

      job = data;
      job.type = job.job_type; // Add alias for compatibility
      console.log('✅ Job created:', job.id);
    } catch (error) {
      console.error('❌ Failed to create job in database:', error.message);
      throw new Error(`Failed to schedule job: ${error.message}`);
    }

    // If BullMQ is available, add to persistent queue
    console.log(`📋 Job scheduling - useBullMQ: ${this.useBullMQ}, bullMQManager.isInitialized: ${bullMQManager.isInitialized}`);
    if (this.useBullMQ && bullMQManager.isInitialized) {
      try {
        await bullMQManager.addJob(type, {
          jobRecord: job,
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
      console.log(`📅 Job scheduled in database queue (BullMQ not available): ${type} (ID: ${job.id})`);
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

    // If using BullMQ, start workers as primary
    if (this.useBullMQ) {
      console.log('🚀 Starting BullMQ workers (primary)...');
      await bullMQManager.startWorkers();
    }

    // Always start database queue as fallback (picks up stale pending jobs)
    console.log('🚀 Starting database queue (fallback for stale jobs)...');
    this.processLoop();

    this.emit('manager:started');
  }

  /**
   * Stop the job processor gracefully
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('⏹️ Stopping background job processor...');
    this.isRunning = false;

    // Close BullMQ if it was running
    if (this.useBullMQ) {
      await bullMQManager.close();
    }

    // Wait for current database queue jobs to finish or timeout
    const timeout = setTimeout(() => {
      console.warn('⚠️ Force stopping job processor (timeout reached)');
      this.processing.clear();
    }, this.shutdownTimeout);

    while (this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    clearTimeout(timeout);

    this.emit('manager:stopped');
    console.log('✅ Background job processor stopped');
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    let cleanupCounter = 0;

    while (this.isRunning) {
      try {
        if (this.processing.size < this.maxConcurrentJobs) {
          const job = await this.getNextJob();
          if (job) {
            this.processJob(job);
          }
        }

        // Cleanup stuck 'cancelling' jobs every 12 iterations (about 1 minute)
        cleanupCounter++;
        if (cleanupCounter >= 12) {
          cleanupCounter = 0;
          await this.cleanupStuckCancellingJobs();
        }
      } catch (error) {
        console.error('❌ Error in job processing loop:', error);
      }

      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }

  /**
   * Cleanup jobs stuck in 'cancelling' state for more than 2 minutes
   */
  async cleanupStuckCancellingJobs() {
    if (!masterDbClient) return;

    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const { data: stuckJobs, error } = await masterDbClient
        .from('job_queue')
        .select('id, job_type')
        .eq('status', 'cancelling')
        .lt('updated_at', twoMinutesAgo);

      if (error) {
        console.error('❌ Error finding stuck cancelling jobs:', error.message);
        return;
      }

      if (stuckJobs && stuckJobs.length > 0) {
        console.log(`🧹 Found ${stuckJobs.length} stuck 'cancelling' jobs, marking as cancelled`);

        for (const job of stuckJobs) {
          await masterDbClient
            .from('job_queue')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_error: 'Marked as cancelled by cleanup (stuck in cancelling state)'
            })
            .eq('id', job.id);

          console.log(`🧹 Cleaned up stuck job: ${job.job_type} (${job.id})`);
        }
      }
    } catch (err) {
      console.error('❌ Error in cleanupStuckCancellingJobs:', err.message);
    }
  }

  /**
   * Get the next job to process
   * When BullMQ is active, only pick up stale jobs (pending > 30s) as fallback
   */
  async getNextJob() {
    if (!masterDbClient) return null;

    // When BullMQ is running, only pick up stale jobs as fallback
    // This prevents double-processing while catching jobs that BullMQ failed to process
    const staleThreshold = this.useBullMQ ? 5000 : 0; // 5 seconds if BullMQ active
    const maxScheduledAt = new Date(Date.now() - staleThreshold).toISOString();

    const { data: job, error } = await masterDbClient
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', maxScheduledAt)
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error fetching next job:', error.message);
      return null;
    }

    if (job) {
      // Add type alias for compatibility
      job.type = job.job_type;
    }

    return job;
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    if (this.processing.has(job.id)) return;

    this.processing.add(job.id);
    const jobType = job.type || job.job_type;

    try {
      console.log(`🔄 [DB Queue] Processing job: ${jobType} (ID: ${job.id})`);

      // Check if job was already cancelled before we start
      if (masterDbClient) {
        const { data: currentJob } = await masterDbClient
          .from('job_queue')
          .select('status')
          .eq('id', job.id)
          .single();

        if (currentJob?.status === 'cancelling' || currentJob?.status === 'cancelled') {
          console.log(`🔄 [DB Queue] Job ${job.id} was cancelled - skipping`);
          await this.updateJob(job.id, {
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          });
          return;
        }
      }

      // Update job status in master DB
      await this.updateJob(job.id, {
        status: 'running',
        started_at: new Date().toISOString()
      });

      this.emit('job:started', job);

      // Get the job handler
      const HandlerClass = this.workers.get(jobType);
      if (!HandlerClass) {
        throw new Error(`No handler found for job type: ${jobType}`);
      }

      // Create the job handler
      const handler = new HandlerClass(job);

      // Set up progress callback to update database with cancellation check
      const originalUpdateProgress = handler.updateProgress.bind(handler);
      handler.updateProgress = async (progress, message) => {
        // Check for cancellation on every progress update
        if (masterDbClient) {
          const { data: currentJob } = await masterDbClient
            .from('job_queue')
            .select('status')
            .eq('id', job.id)
            .single();

          if (currentJob?.status === 'cancelling' || currentJob?.status === 'cancelled') {
            console.log(`🔄 [DB Queue] Job ${job.id} cancellation detected - throwing`);
            throw new Error('Job was cancelled by user');
          }
        }

        // Call original to emit events
        await originalUpdateProgress(progress, message);

        // Update progress in master DB
        try {
          await this.updateJob(job.id, {
            progress,
            progress_message: message
          });
        } catch (err) {
          console.error('Failed to update job progress:', err.message);
        }
      };

      // Execute the job
      const result = await handler.execute();

      // Update job as completed in master DB
      await this.updateJob(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: result || {}
      });

      // Create job history record in master DB
      await this.createJobHistory({
        job_id: job.id,
        status: 'completed',
        result: result || {},
        executed_at: new Date().toISOString()
      });

      console.log(`✅ Job completed: ${jobType} (ID: ${job.id})`);
      this.emit('job:completed', job, result);

      // Handle recurring jobs
      if (job.payload?.isRecurring) {
        await this.scheduleNextRecurrence(job);
      }

    } catch (error) {
      console.error(`❌ Job failed: ${jobType} (ID: ${job.id}):`, error);
      await this.handleJobFailure(job, error);
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Update a job in the master database
   * @param {string} jobId - Job ID
   * @param {object} updates - Fields to update
   */
  async updateJob(jobId, updates) {
    if (!masterDbClient) {
      console.warn('⚠️ masterDbClient not available for job update');
      return;
    }

    try {
      const { error } = await masterDbClient
        .from('job_queue')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) {
        console.error(`❌ Failed to update job ${jobId}:`, error.message);
        throw error;
      }
    } catch (err) {
      console.error(`❌ Error updating job ${jobId}:`, err.message);
    }
  }

  /**
   * Create a job history record in master database
   * @param {object} historyData - History data including job_id
   */
  async createJobHistory(historyData) {
    if (!masterDbClient) {
      console.warn('⚠️ masterDbClient not available for job history');
      return;
    }

    try {
      const { error } = await masterDbClient
        .from('job_history')
        .insert({
          id: uuidv4(),
          ...historyData
        });

      if (error) {
        console.error('❌ Failed to create job history:', error.message);
        // Don't throw - history is not critical
      }
    } catch (err) {
      console.error('❌ Error creating job history:', err.message);
    }
  }

  /**
   * Handle job failure and retries
   */
  async handleJobFailure(job, error) {
    const jobType = job.type || job.job_type;

    // Check if this was a cancellation - don't retry cancelled jobs
    const isCancellation = error.message?.includes('cancelled') ||
                           error.message?.includes('canceled') ||
                           error.message?.includes('Job was cancelled');

    if (isCancellation) {
      console.log(`🔄 [DB Queue] Job ${job.id} was cancelled - marking as cancelled (no retry)`);
      await this.updateJob(job.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        last_error: error.message
      });
      await this.createJobHistory({
        job_id: job.id,
        status: 'cancelled',
        error: { message: error.message },
        executed_at: new Date().toISOString()
      });
      this.emit('job:cancelled', job);
      return;
    }

    const retryCount = (job.retry_count || 0) + 1;
    const canRetry = retryCount <= (job.max_retries || 3);

    // Create history record for the failure in master DB
    await this.createJobHistory({
      job_id: job.id,
      status: 'failed',
      error: {
        message: error.message,
        stack: error.stack,
        retry_count: retryCount
      },
      executed_at: new Date().toISOString()
    });

    if (canRetry) {
      // Calculate retry delay (exponential backoff)
      const delayIndex = Math.min(retryCount - 1, this.retryDelays.length - 1);
      const retryDelay = this.retryDelays[delayIndex];
      const nextAttempt = new Date(Date.now() + retryDelay);

      await this.updateJob(job.id, {
        status: 'pending',
        retry_count: retryCount,
        scheduled_at: nextAttempt.toISOString(),
        last_error: error.message
      });

      console.log(`🔄 Job will retry in ${retryDelay/1000}s: ${jobType} (ID: ${job.id}, attempt ${retryCount}/${job.max_retries || 3})`);
      this.emit('job:retry_scheduled', job, retryCount);
    } else {
      // Mark as permanently failed in master DB
      await this.updateJob(job.id, {
        status: 'failed',
        failed_at: new Date().toISOString(),
        last_error: error.message
      });

      console.error(`💀 Job permanently failed: ${jobType} (ID: ${job.id})`);
      this.emit('job:failed', job, error);
    }
  }

  /**
   * Resume jobs that were interrupted by server restart
   * Note: With centralized master DB, we reset running jobs to pending on startup.
   */
  async resumeInterruptedJobs() {
    if (!masterDbClient) {
      console.warn('⚠️ masterDbClient not available, skipping interrupted jobs check');
      return;
    }

    try {
      // Reset any jobs that were running when the server shut down
      const { data: interruptedJobs, error } = await masterDbClient
        .from('job_queue')
        .select('id')
        .eq('status', 'running');

      if (error) {
        console.error('❌ Error fetching interrupted jobs:', error.message);
        return;
      }

      if (interruptedJobs && interruptedJobs.length > 0) {
        console.log(`🔄 Resuming ${interruptedJobs.length} interrupted jobs...`);

        const { error: updateError } = await masterDbClient
          .from('job_queue')
          .update({
            status: 'pending',
            scheduled_at: new Date().toISOString()
          })
          .eq('status', 'running');

        if (updateError) {
          console.error('❌ Error resuming interrupted jobs:', updateError.message);
        }
      }
    } catch (err) {
      console.error('❌ Error in resumeInterruptedJobs:', err.message);
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
    if (!masterDbClient) {
      return {
        total: 0, completed: 0, failed: 0, pending: 0, running: 0,
        success_rate: '0%', currently_processing: this.processing.size
      };
    }

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

    // Count jobs in time range
    const { count: totalJobs } = await masterDbClient
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sinceISO);

    const { count: completedJobs } = await masterDbClient
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', sinceISO);

    const { count: failedJobs } = await masterDbClient
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', sinceISO);

    // Current queue status (no time filter)
    const { count: pendingJobs } = await masterDbClient
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: runningJobs } = await masterDbClient
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running');

    const total = totalJobs || 0;
    const completed = completedJobs || 0;

    return {
      total,
      completed,
      failed: failedJobs || 0,
      pending: pendingJobs || 0,
      running: runningJobs || 0,
      success_rate: total > 0 ? (completed / total * 100).toFixed(2) + '%' : '0%',
      currently_processing: this.processing.size
    };
  }

  /**
   * Cancel a job (works for both pending and running jobs)
   */
  async cancelJob(jobId) {
    console.log(`[CANCEL-MGR] cancelJob called for ${jobId}`);

    if (!masterDbClient) {
      throw new Error('masterDbClient not available');
    }

    const { data: job, error } = await masterDbClient
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      console.log(`[CANCEL-MGR] Job ${jobId} not found`);
      throw new Error('Job not found');
    }

    console.log(`[CANCEL-MGR] Job ${jobId} current status: ${job.status}`);

    if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
      throw new Error(`Cannot cancel a job with status: ${job.status}`);
    }

    // For running jobs, set status to 'cancelling' so the worker knows to abort
    // For pending jobs, set directly to 'cancelled'
    const newStatus = job.status === 'running' ? 'cancelling' : 'cancelled';
    console.log(`[CANCEL-MGR] Setting job ${jobId} status to: ${newStatus}`);

    await this.updateJob(jobId, {
      status: newStatus,
      cancelled_at: new Date().toISOString()
    });

    console.log(`[CANCEL-MGR] Job ${jobId} status updated to ${newStatus}`);

    // Also try to remove from BullMQ if available (for pending jobs)
    if (this.bullMQManager && job.job_type && job.status === 'pending') {
      try {
        const queue = this.bullMQManager.getQueue(job.job_type);
        if (queue) {
          const bullJob = await queue.getJob(`job-${jobId}`);
          if (bullJob) {
            await bullJob.remove();
            console.log(`Removed job ${jobId} from BullMQ queue`);
          }
        }
      } catch (bullError) {
        console.warn(`Could not remove job from BullMQ: ${bullError.message}`);
      }
    }

    job.type = job.job_type;
    job.status = newStatus;
    this.emit('job:cancelled', job);
    return job;
  }

  /**
   * Get job details with history
   */
  async getJobDetails(jobId) {
    if (!masterDbClient) return null;

    const { data: job, error } = await masterDbClient
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) return null;

    const { data: history } = await masterDbClient
      .from('job_history')
      .select('*')
      .eq('job_id', jobId)
      .order('executed_at', { ascending: false });

    // If using BullMQ, also get queue status
    let queueStatus = null;
    if (this.useBullMQ) {
      try {
        queueStatus = await bullMQManager.getJobStatus(job.job_type, jobId);
      } catch (error) {
        console.warn('Failed to get BullMQ status:', error.message);
      }
    }

    job.type = job.job_type;
    return {
      ...job,
      history: history || [],
      queueStatus
    };
  }

  /**
   * Get job status for polling (lightweight)
   */
  async getJobStatus(jobId) {
    if (!masterDbClient) return null;

    const { data: job, error } = await masterDbClient
      .from('job_queue')
      .select('id, job_type, status, progress, progress_message, result, last_error')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return null;
    }

    job.type = job.job_type;
    return job;
  }

  /**
   * Schedule system-level recurring jobs
   */
  async scheduleSystemJobs() {
    console.log('📅 Scheduling system jobs...');

    if (!masterDbClient) {
      console.warn('⚠️ masterDbClient not available, skipping system jobs scheduling');
      return;
    }

    try {
      // Check if daily credit deduction job is already scheduled
      const { data: existingJob } = await masterDbClient
        .from('job_queue')
        .select('id')
        .eq('job_type', 'system:daily_credit_deduction')
        .eq('status', 'pending')
        .limit(1)
        .single();

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
      const { data: existingFinalizationJob } = await masterDbClient
        .from('job_queue')
        .select('id')
        .eq('job_type', 'system:finalize_pending_orders')
        .eq('status', 'pending')
        .limit(1)
        .single();

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

      // Schedule marketing automation processing (every 5 minutes)
      await this.scheduleMarketingJob('marketing:automation:process', 'every_5_minutes');

      // Schedule abandoned cart detection (every 15 minutes)
      await this.scheduleMarketingJob('marketing:abandoned_cart', 'every_15_minutes');

      // Schedule RFM score calculation (daily)
      await this.scheduleMarketingJob('marketing:rfm:calculate', 'daily');

      // Schedule marketing contact sync (hourly)
      await this.scheduleMarketingJob('marketing:sync:contacts', 'hourly');

    } catch (error) {
      console.error('❌ Failed to schedule system jobs:', error.message);
      // Don't throw error to prevent server startup failure
    }
  }

  /**
   * Helper to schedule marketing jobs if not already scheduled
   */
  async scheduleMarketingJob(jobType, schedule) {
    try {
      const { data: existingJob } = await masterDbClient
        .from('job_queue')
        .select('id')
        .eq('job_type', jobType)
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (!existingJob) {
        await this.scheduleRecurringJob({
          type: jobType,
          payload: {},
          priority: 'normal',
          maxRetries: 3
        }, schedule);
        console.log(`✅ Scheduled ${jobType} (${schedule})`);
      } else {
        console.log(`ℹ️ ${jobType} already scheduled`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not schedule ${jobType}: ${error.message}`);
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
