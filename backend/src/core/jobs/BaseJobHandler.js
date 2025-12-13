const { EventEmitter } = require('events');
const JobHistory = require('../../models/JobHistory');

/**
 * Base class for all background job handlers
 */
class BaseJobHandler extends EventEmitter {
  constructor(job) {
    super();
    this.job = job;
    this.startTime = null;
    this.progress = 0;
    this.isAborted = false;
  }

  /**
   * Execute the job - to be implemented by subclasses
   */
  async execute() {
    throw new Error('execute() method must be implemented by subclasses');
  }

  /**
   * Start job execution with tracking
   */
  async start() {
    this.startTime = Date.now();
    
    try {
      // Mark job as started
      await this.job.markAsStarted();
      await JobHistory.recordJobStart(this.job.id);
      
      console.log(`🔄 Starting job: ${this.job.type} (ID: ${this.job.id})`);
      this.emit('job:started');

      // Execute the actual job logic
      const result = await this.execute();

      // Calculate duration
      const duration = Date.now() - this.startTime;

      // Mark job as completed
      await this.job.markAsCompleted(result);
      await JobHistory.recordJobCompletion(this.job.id, result, duration);

      console.log(`✅ Job completed: ${this.job.type} (ID: ${this.job.id}) in ${duration}ms`);
      this.emit('job:completed', result);

      return result;
    } catch (error) {
      const duration = this.startTime ? Date.now() - this.startTime : null;
      
      console.error(`❌ Job failed: ${this.job.type} (ID: ${this.job.id}):`, error);
      
      // Record failure in history
      await JobHistory.recordJobFailure(this.job.id, error, duration);
      
      // Handle retry logic
      const canRetry = this.job.retry_count < this.job.max_retries;
      await this.job.markAsFailed(error, canRetry);

      if (canRetry) {
        await JobHistory.recordJobRetry(this.job.id, this.job.retry_count + 1, this.job.scheduled_at);
      }

      this.emit('job:failed', error);
      throw error;
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(progress, message = null) {
    if (this.isAborted) return;

    this.progress = Math.max(0, Math.min(100, progress));

    // Only call job.updateProgress if it's a method (not available in direct execution mode)
    if (typeof this.job.updateProgress === 'function') {
      await this.job.updateProgress(this.progress, message);
    }

    // Only record to JobHistory if we have a real job ID (not system jobs)
    if (this.job.id && !String(this.job.id).startsWith('system-')) {
      try {
        await JobHistory.recordJobProgress(this.job.id, this.progress, message || `Progress: ${this.progress}%`);
      } catch (err) {
        // Ignore history errors for direct execution
      }
    }

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
    await JobHistory.recordJobCancellation(this.job.id, reason);
    this.emit('job:aborted', reason);
    throw new Error(reason);
  }

  /**
   * Check if the job should be aborted
   */
  checkAbort() {
    if (this.isAborted) {
      throw new Error('Job was aborted');
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
    const prefix = `[${this.job.type}:${this.job.id}]`;
    
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
      this.checkAbort(); // Check for abort between batches
      
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
      jobType: this.job.type,
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