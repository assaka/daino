const { EventEmitter } = require('events');
const { masterDbClient } = require('../../database/masterConnection');

/**
 * Base class for all background job handlers
 *
 * Job handlers implement the execute() method which contains the actual job logic.
 * BackgroundJobManager handles job lifecycle (status updates, history tracking).
 */
class BaseJobHandler extends EventEmitter {
  constructor(job) {
    super();
    this.job = job;
    this.startTime = null;
    this.progress = 0;
    this.isAborted = false;
    this.lastCancellationCheck = 0;
    this.cancellationCheckInterval = 5000; // Check every 5 seconds
  }

  /**
   * Execute the job - to be implemented by subclasses
   */
  async execute() {
    throw new Error('execute() method must be implemented by subclasses');
  }

  /**
   * Update job progress
   */
  async updateProgress(progress, message = null) {
    if (this.isAborted) return;

    this.progress = Math.max(0, Math.min(100, progress));
    this.emit('progress', this.progress, message);

    if (message) {
      console.log(`📊 Job ${this.job.id} progress: ${this.progress}% - ${message}`);
    }
  }

  /**
   * Abort the job
   */
  async abort(reason = 'Job aborted') {
    this.isAborted = true;
    this.emit('job:aborted', reason);
    throw new Error(reason);
  }

  /**
   * Check if the job should be aborted (checks local flag and database)
   */
  async checkAbort() {
    if (this.isAborted) {
      throw new Error('Job was cancelled');
    }

    // Periodically check database for cancellation (not every call, to avoid DB spam)
    const now = Date.now();
    if (now - this.lastCancellationCheck > this.cancellationCheckInterval) {
      this.lastCancellationCheck = now;
      await this.checkCancellationStatus();
    }
  }

  /**
   * Check database for cancellation status
   */
  async checkCancellationStatus() {
    if (!masterDbClient || !this.job.id) return;

    try {
      const { data: job } = await masterDbClient
        .from('job_queue')
        .select('status')
        .eq('id', this.job.id)
        .single();

      if (job && (job.status === 'cancelling' || job.status === 'cancelled')) {
        this.isAborted = true;
        this.log('Job cancellation detected from database', 'warn');
        throw new Error('Job was cancelled by user');
      }
    } catch (error) {
      if (error.message === 'Job was cancelled by user') {
        throw error; // Re-throw cancellation error
      }
      // Ignore other database errors, don't abort job due to DB check failure
      console.warn('Failed to check cancellation status:', error.message);
    }
  }

  /**
   * Get job payload with validation
   */
  getPayload() {
    return this.job.payload || {};
  }

  /**
   * Get required payload field
   */
  getRequiredPayload(field) {
    const payload = this.getPayload();
    if (!(field in payload)) {
      throw new Error(`Required payload field missing: ${field}`);
    }
    return payload[field];
  }

  /**
   * Log a message with job context
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const jobType = this.job.type || this.job.job_type || 'unknown';
    const prefix = `[${jobType}:${this.job.id}]`;

    switch (level) {
      case 'error':
        console.error(`${timestamp} ${prefix} ❌`, message);
        break;
      case 'warn':
        console.warn(`${timestamp} ${prefix} ⚠️`, message);
        break;
      case 'debug':
        console.log(`${timestamp} ${prefix} 🔍`, message);
        break;
      default:
        console.log(`${timestamp} ${prefix} ℹ️`, message);
    }
  }

  /**
   * Validate required services or dependencies
   */
  async validateDependencies(dependencies = []) {
    for (const dependency of dependencies) {
      if (!dependency.check || typeof dependency.check !== 'function') {
        throw new Error(`Invalid dependency configuration: ${dependency.name}`);
      }

      const isValid = await dependency.check();
      if (!isValid) {
        throw new Error(`Dependency check failed: ${dependency.name} - ${dependency.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout(operation, timeoutMs = 300000) { // 5 minutes default
    return Promise.race([
      operation,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Batch process items with progress tracking
   */
  async batchProcess(items, processor, batchSize = 10, progressCallback = null) {
    const results = [];
    const total = items.length;
    let processed = 0;

    for (let i = 0; i < total; i += batchSize) {
      await this.checkAbort(); // Check for abort/cancellation between batches

      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(item => processor(item, i + batch.indexOf(item)))
      );

      results.push(...batchResults);
      processed += batch.length;

      // Update progress
      const progressPercent = Math.floor((processed / total) * 100);
      await this.updateProgress(
        progressPercent,
        `Processed ${processed}/${total} items`
      );

      // Custom progress callback
      if (progressCallback) {
        await progressCallback(processed, total, batchResults);
      }
    }

    return results;
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break; // Don't wait after the last attempt
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.log(`Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms: ${error.message}`, 'warn');

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Get execution context information
   */
  getContext() {
    return {
      jobId: this.job.id,
      jobType: this.job.type || this.job.job_type,
      storeId: this.job.store_id,
      userId: this.job.user_id,
      priority: this.job.priority,
      retryCount: this.job.retry_count,
      maxRetries: this.job.max_retries,
      progress: this.progress,
      isAborted: this.isAborted,
      startTime: this.startTime,
      executionTime: this.startTime ? Date.now() - this.startTime : 0
    };
  }
}

module.exports = BaseJobHandler;
