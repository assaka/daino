const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { masterDbClient } = require('../database/masterConnection');

/**
 * BullMQ Manager - Persistent Job Queue System
 *
 * Provides a persistent, Redis-backed job queue that survives deployments.
 * Integrates with existing BackgroundJobManager and Job model.
 *
 * Features:
 * - Persistent queue (survives server restarts/deployments)
 * - Progress tracking
 * - Automatic retries with exponential backoff
 * - Priority queue support
 * - Delayed/scheduled jobs
 * - Job events and monitoring
 */
class BullMQManager {
  constructor() {
    this.connectionConfig = null;  // Store config, not connection instance
    this.queues = new Map();
    this.workers = new Map();
    this.jobHandlers = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize BullMQ with Redis connection config
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if Redis is disabled
      if (process.env.REDIS_ENABLED === 'false') {
        console.warn('BullMQ: Redis disabled, falling back to database queue');
        return false;
      }

      // Build connection config (BullMQ will create its own connections)
      // BullMQ requires maxRetriesPerRequest: null for proper operation
      const bullMQOptions = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        // Reconnection settings for managed Redis (Render)
        retryStrategy: (times) => {
          if (times > 10) {
            console.error(`BullMQ: Redis reconnect failed after ${times} attempts`);
            return null; // Stop retrying
          }
          const delay = Math.min(times * 200, 5000);
          console.log(`BullMQ: Redis reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
        // Keep connection alive
        keepAlive: 30000,
        connectTimeout: 10000,
        // Don't queue commands when disconnected
        enableOfflineQueue: true,
        // Reconnect on error
        reconnectOnError: (err) => {
          const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
          if (targetErrors.some(e => err.message.includes(e))) {
            console.log(`BullMQ: Reconnecting due to ${err.message}`);
            return true;
          }
          return false;
        },
      };

      if (process.env.REDIS_URL) {
        const redisUrl = process.env.REDIS_URL;
        console.log(`BullMQ: REDIS_URL starts with: ${redisUrl.substring(0, 20)}...`);

        // Try using the URL directly first - ioredis supports URL strings
        // Check if it's a TLS URL (rediss://)
        const needsTLS = redisUrl.startsWith('rediss://');
        console.log(`BullMQ: Using TLS: ${needsTLS}`);

        if (needsTLS) {
          // For TLS connections, parse and configure properly
          const url = new URL(redisUrl);
          this.connectionConfig = {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            username: url.username && url.username !== 'default' ? url.username : undefined,
            tls: {
              rejectUnauthorized: false,
            },
            family: 4,
            ...bullMQOptions,
          };
          console.log(`BullMQ: TLS config - host: ${url.hostname}, port: ${url.port}`);
        } else {
          // For non-TLS, try using the URL directly
          const url = new URL(redisUrl);
          this.connectionConfig = {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            username: url.username && url.username !== 'default' ? url.username : undefined,
            family: 4,
            ...bullMQOptions,
          };
          console.log(`BullMQ: Non-TLS config - host: ${url.hostname}, port: ${url.port}`);
        }
      } else if (process.env.REDIS_HOST) {
        this.connectionConfig = {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          db: parseInt(process.env.REDIS_DB || '0', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          ...bullMQOptions,
        };
      } else {
        console.warn('BullMQ: Redis not configured, falling back to database queue');
        return false;
      }

      // Test connection with a temporary connection
      const testConnection = new Redis(this.connectionConfig);

      await testConnection.ping();
      console.log('BullMQ: Redis connection established');

      // Close test connection - BullMQ will create its own
      await testConnection.quit();

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('BullMQ: Failed to initialize:', error.message);
      console.warn('BullMQ: Will fall back to database queue');
      return false;
    }
  }

  /**
   * Get Redis configuration compatible with ioredis and BullMQ
   * BullMQ requires maxRetriesPerRequest: null
   */
  getRedisConfig() {
    // Check if Redis is disabled
    if (process.env.REDIS_ENABLED === 'false') {
      return null;
    }

    // BullMQ requires these settings
    const bullMQOptions = {
      maxRetriesPerRequest: null,  // Required by BullMQ
      enableReadyCheck: false,
    };

    // Use REDIS_URL if available (Render.com managed Redis)
    if (process.env.REDIS_URL) {
      return {
        ...bullMQOptions,
        // Parse the URL and merge with BullMQ options
        url: process.env.REDIS_URL,
      };
    }

    // Build config from individual parameters
    if (process.env.REDIS_HOST) {
      return {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: parseInt(process.env.REDIS_DB || '0', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        ...bullMQOptions,
      };
    }

    return null;
  }

  /**
   * Sanitize job type for use as queue name (BullMQ doesn't allow colons)
   */
  sanitizeQueueName(jobType) {
    return jobType.replace(/:/g, '-');
  }

  /**
   * Register a job handler
   */
  registerJobType(jobType, handlerClass) {
    this.jobHandlers.set(jobType, handlerClass);
    console.log(`BullMQ: Registered job type: ${jobType}`);
  }

  /**
   * Get or create a queue for a job type
   */
  getQueue(jobType) {
    if (!this.isInitialized) {
      throw new Error('BullMQ not initialized. Call initialize() first.');
    }

    const queueName = this.sanitizeQueueName(jobType);

    if (!this.queues.has(jobType)) {
      // Create queue with its own connection (BullMQ best practice)
      const queue = new Queue(queueName, {
        connection: this.connectionConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5 seconds
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep max 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });

      this.queues.set(jobType, queue);
      console.log(`BullMQ: Created queue: ${queueName} (for ${jobType})`);
    }

    return this.queues.get(jobType);
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobType, jobData, options = {}) {
    const queueName = this.sanitizeQueueName(jobType);
    const queue = this.getQueue(jobType);

    // Map priority from string to number
    const priorityMap = {
      low: 10,
      normal: 5,
      high: 2,
      urgent: 1,
    };

    const bullMQOptions = {
      priority: priorityMap[options.priority] || 5,
      attempts: options.maxRetries || 3,
      jobId: jobData.jobId ? `job-${jobData.jobId}` : undefined,
    };

    // Add delay if scheduled_at is provided
    if (options.scheduledAt) {
      const delay = new Date(options.scheduledAt) - new Date();
      if (delay > 0) {
        bullMQOptions.delay = delay;
      }
    }

    // Add job to queue (use sanitized name as job name too for consistency)
    const job = await queue.add(queueName, jobData, bullMQOptions);

    console.log(`BullMQ: Added job ${job.id} to queue "${queueName}" (type: ${jobType})`);
    return job;
  }

  /**
   * Create a worker to process jobs
   */
  createWorker(jobType) {
    if (!this.isInitialized) {
      throw new Error('BullMQ not initialized. Call initialize() first.');
    }

    if (this.workers.has(jobType)) {
      return this.workers.get(jobType);
    }

    const HandlerClass = this.jobHandlers.get(jobType);
    if (!HandlerClass) {
      throw new Error(`No handler registered for job type: ${jobType}`);
    }

    const queueName = this.sanitizeQueueName(jobType);

    // Worker options for long-running jobs (like imports)
    // Default lockDuration is 30s which is too short for import jobs
    const workerOptions = {
      connection: this.connectionConfig,
      lockDuration: 600000,      // 10 minutes - time before job is considered stalled
      stalledInterval: 300000,   // 5 minutes - how often to check for stalled jobs
      maxStalledCount: 1,        // Only retry stalled jobs once
    };

    const worker = new Worker(
      queueName,
      async (job) => {
        console.log(`BullMQ: Processing job ${job.id} of type ${jobType}`);
        console.log(`BullMQ: Job data:`, JSON.stringify(job.data, null, 2).substring(0, 500));
        const jobRecordId = job.data.jobRecord?.id;
        console.log(`BullMQ: jobRecordId = ${jobRecordId}`);

        // Update job status to 'running' in master DB
        if (jobRecordId && masterDbClient) {
          try {
            await masterDbClient
              .from('job_queue')
              .update({
                status: 'running',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', jobRecordId);
            console.log(`BullMQ: Job ${jobRecordId} status updated to 'running'`);
          } catch (err) {
            console.error('Failed to update job status to running:', err.message);
          }
        }

        try {
          // Create handler instance with job data
          const handler = new HandlerClass(job.data.jobRecord);

          // Set up progress callback
          handler.updateProgress = async (progress, message) => {
            // Check for cancellation on every progress update
            await handler.checkAbort();

            console.log(`BullMQ: Updating progress for job ${jobRecordId}: ${progress}% - ${message}`);
            await job.updateProgress(progress);

            // Also update the job_queue table in master DB
            if (jobRecordId && masterDbClient) {
              try {
                const { error } = await masterDbClient
                  .from('job_queue')
                  .update({
                    progress,
                    progress_message: message,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', jobRecordId);

                if (error) {
                  console.error('DB error updating progress:', error);
                } else {
                  console.log(`BullMQ: Progress saved to DB for job ${jobRecordId}`);
                }
              } catch (err) {
                console.error('Failed to update job progress in DB:', err.message);
              }
            } else {
              console.warn(`BullMQ: Cannot save progress - jobRecordId=${jobRecordId}, masterDbClient=${!!masterDbClient}`);
            }
          };

          // Execute the job
          const result = await handler.execute();

          // Update job status to 'completed' in master DB
          if (jobRecordId && masterDbClient) {
            try {
              await masterDbClient
                .from('job_queue')
                .update({
                  status: 'completed',
                  progress: 100,
                  result: result,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jobRecordId);
            } catch (err) {
              console.error('Failed to update job status to completed:', err.message);
            }
          }

          console.log(`BullMQ: Job ${job.id} completed successfully`);
          return result;

        } catch (error) {
          console.error(`BullMQ: Job ${job.id} failed:`, error);

          // Check if this was a cancellation
          const isCancellation = error.message?.includes('cancelled') ||
                                 error.message?.includes('canceled') ||
                                 error.message?.includes('Job was cancelled');

          // Update job status in master DB
          if (jobRecordId && masterDbClient) {
            try {
              if (isCancellation) {
                // Job was cancelled - mark as cancelled, not failed
                // Include partial results if available
                const updateData = {
                  status: 'cancelled',
                  last_error: error.message,
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };

                // Save partial result if available (attached by job handler)
                if (error.partialResult) {
                  updateData.result = error.partialResult;
                  console.log(`BullMQ: Saving partial result for cancelled job ${jobRecordId}:`, error.partialResult);
                }

                await masterDbClient
                  .from('job_queue')
                  .update(updateData)
                  .eq('id', jobRecordId);
                console.log(`BullMQ: Job ${jobRecordId} marked as cancelled`);
              } else {
                // Regular failure
                await masterDbClient
                  .from('job_queue')
                  .update({
                    status: 'failed',
                    last_error: error.message,
                    failed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', jobRecordId);
              }
            } catch (err) {
              console.error('Failed to update job status:', err.message);
            }
          }

          throw error;
        }
      },
      {
        ...workerOptions,
        concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '5', 10),
      }
    );

    // Worker event handlers
    worker.on('completed', (job, result) => {
      console.log(`BullMQ: Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`BullMQ: Job ${job.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error(`BullMQ: Worker error for ${jobType}:`, err);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`BullMQ: Job ${jobId} stalled for ${jobType} - will be retried`);
    });

    worker.on('ready', () => {
      console.log(`BullMQ: Worker for ${queueName} is READY to process jobs`);
    });

    worker.on('closing', () => {
      console.log(`BullMQ: Worker for ${queueName} is closing`);
    });

    worker.on('closed', () => {
      console.log(`BullMQ: Worker for ${queueName} has closed`);
    });

    this.workers.set(jobType, worker);
    console.log(`BullMQ: Created worker for ${queueName} (${jobType})`);
    console.log(`BullMQ: Worker is now listening on queue "${queueName}"`);

    return worker;
  }

  /**
   * Start workers for all registered job types
   */
  async startWorkers() {
    if (!this.isInitialized) {
      console.error('BullMQ: Cannot start workers - not initialized');
      console.error('BullMQ: connectionConfig:', this.connectionConfig ? 'set' : 'NOT SET');
      throw new Error('BullMQ not initialized. Call initialize() first.');
    }

    console.log('BullMQ: Starting workers for all registered job types');
    console.log('BullMQ: Registered job handlers:', Array.from(this.jobHandlers.keys()));
    console.log(`BullMQ: ${this.jobHandlers.size} job types registered`);

    for (const jobType of this.jobHandlers.keys()) {
      const queueName = this.sanitizeQueueName(jobType);
      console.log(`BullMQ: Creating worker for queue "${queueName}"`);
      this.createWorker(jobType);
    }

    console.log(`BullMQ: Started ${this.workers.size} workers`);
  }

  /**
   * Get job status from BullMQ
   */
  async getJobStatus(jobType, jobId) {
    const queue = this.getQueue(jobType);
    const job = await queue.getJob(`job-${jobId}`);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      id: jobId,
      type: jobType,
      status: this.mapBullMQState(state),
      progress,
      data: job.data,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
    };
  }

  /**
   * Map BullMQ state to our job status
   */
  mapBullMQState(bullMQState) {
    const stateMap = {
      waiting: 'pending',
      active: 'running',
      completed: 'completed',
      failed: 'failed',
      delayed: 'pending',
      paused: 'pending',
    };

    return stateMap[bullMQState] || 'pending';
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(jobType) {
    const queue = this.getQueue(jobType);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get statistics for all queues
   */
  async getAllQueueStats() {
    const stats = {};

    for (const jobType of this.queues.keys()) {
      stats[jobType] = await this.getQueueStats(jobType);
    }

    return stats;
  }

  /**
   * Gracefully close all connections
   */
  async close() {
    console.log('BullMQ: Closing all connections...');

    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // No need to close a shared connection anymore - each queue/worker manages its own

    this.isInitialized = false;
    console.log('BullMQ: All connections closed');
  }

  /**
   * Check if BullMQ is available and initialized
   */
  isAvailable() {
    return this.isInitialized && this.connectionConfig !== null;
  }
}

// Singleton instance
const bullMQManager = new BullMQManager();

module.exports = bullMQManager;
