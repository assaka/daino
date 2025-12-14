const { Queue, Worker, QueueScheduler } = require('bullmq');
const Redis = require('ioredis');

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
    this.connection = null;
    this.queues = new Map();
    this.workers = new Map();
    this.schedulers = new Map();
    this.jobHandlers = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize BullMQ with Redis connection
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create ioredis connection for BullMQ
      const redisConfig = this.getRedisConfig();

      if (!redisConfig) {
        console.warn('BullMQ: Redis not configured, falling back to database queue');
        return false;
      }

      this.connection = new Redis(redisConfig);

      // Test connection
      await this.connection.ping();
      console.log('BullMQ: Redis connection established');

      // Handle connection events
      this.connection.on('error', (err) => {
        console.error('BullMQ Redis Error:', err);
      });

      this.connection.on('connect', () => {
        console.log('BullMQ: Connected to Redis');
      });

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('BullMQ: Failed to initialize:', error.message);
      console.warn('BullMQ: Will fall back to database queue');
      return false;
    }
  }

  /**
   * Get Redis configuration compatible with ioredis
   */
  getRedisConfig() {
    // Check if Redis is disabled
    if (process.env.REDIS_ENABLED === 'false') {
      return null;
    }

    // Use REDIS_URL if available (Render.com managed Redis)
    if (process.env.REDIS_URL) {
      return process.env.REDIS_URL;
    }

    // Build config from individual parameters
    if (process.env.REDIS_HOST) {
      const config = {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: parseInt(process.env.REDIS_DB || '0', 10),
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        retryStrategy: (times) => {
          if (times > 10) {
            return null; // Stop retrying
          }
          return Math.min(times * 50, 3000); // Exponential backoff
        },
      };

      if (process.env.REDIS_PASSWORD) {
        config.password = process.env.REDIS_PASSWORD;
      }

      return config;
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
      // Create queue with default options (use sanitized name)
      const queue = new Queue(queueName, {
        connection: this.connection,
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

      // Also create a scheduler for delayed jobs
      const scheduler = new QueueScheduler(queueName, {
        connection: this.connection,
      });
      this.schedulers.set(jobType, scheduler);

      console.log(`BullMQ: Created queue: ${queueName} (for ${jobType})`);
    }

    return this.queues.get(jobType);
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobType, jobData, options = {}) {
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

    // Add job to queue
    const job = await queue.add(jobType, jobData, bullMQOptions);

    console.log(`BullMQ: Added job ${job.id} to queue ${jobType}`);
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

    const worker = new Worker(
      queueName,
      async (job) => {
        console.log(`BullMQ: Processing job ${job.id} of type ${jobType}`);

        try {
          // Create handler instance with job data
          const handler = new HandlerClass(job.data.jobRecord);

          // Set up progress callback
          handler.updateProgress = async (progress, message) => {
            await job.updateProgress(progress);

            // Also update the database Job model
            if (job.data.jobRecord && job.data.jobRecord.id) {
              const { Job } = require('../models'); // Master DB model for job tracking
              await Job.update(
                {
                  progress,
                  progress_message: message,
                },
                {
                  where: { id: job.data.jobRecord.id },
                }
              );
            }
          };

          // Execute the job
          const result = await handler.execute();

          console.log(`BullMQ: Job ${job.id} completed successfully`);
          return result;

        } catch (error) {
          console.error(`BullMQ: Job ${job.id} failed:`, error);
          throw error;
        }
      },
      {
        connection: this.connection,
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

    this.workers.set(jobType, worker);
    console.log(`BullMQ: Created worker for ${queueName} (${jobType})`);

    return worker;
  }

  /**
   * Start workers for all registered job types
   */
  async startWorkers() {
    if (!this.isInitialized) {
      throw new Error('BullMQ not initialized. Call initialize() first.');
    }

    console.log('BullMQ: Starting workers for all registered job types');

    for (const jobType of this.jobHandlers.keys()) {
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

    // Close all schedulers
    for (const scheduler of this.schedulers.values()) {
      await scheduler.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // Close Redis connection
    if (this.connection) {
      await this.connection.quit();
    }

    this.isInitialized = false;
    console.log('BullMQ: All connections closed');
  }

  /**
   * Check if BullMQ is available and initialized
   */
  isAvailable() {
    return this.isInitialized && this.connection && this.connection.status === 'ready';
  }
}

// Singleton instance
const bullMQManager = new BullMQManager();

module.exports = bullMQManager;
