/**
 * Unified Analytics Event Bus
 * Handles all analytics events with retry logic, deduplication, and batch processing
 * Architecture designed to easily migrate to Redis queue
 */

const crypto = require('crypto');

class EventBus {
  constructor() {
    // In-memory queue (will be replaced with Redis)
    this.eventQueue = [];
    this.processingQueue = new Set(); // Track events being processed
    this.processedEvents = new Map(); // Deduplication cache (idempotency)
    this.subscribers = new Map(); // Event type -> handlers
    this.correlationIds = new Map(); // Session -> correlation ID mapping

    // Configuration
    this.config = {
      batchSize: 50,
      batchTimeout: 5000, // 5 seconds
      maxRetries: 3,
      retryDelay: 1000, // Base delay for exponential backoff
      deduplicationTTL: 300000, // 5 minutes
      maxQueueSize: 10000 // Prevent memory overflow
    };

    // Batch processing
    this.batchTimer = null;
    this.isProcessing = false;

    // Start background workers
    this.startWorkers();
    this.startCleanup();
  }

  /**
   * Publish an event to the bus
   * @param {string} eventType - Type of event (e.g., 'customer_activity', 'heatmap_interaction')
   * @param {object} eventData - Event payload
   * @param {object} options - Options (priority, idempotencyKey, etc.)
   * @returns {Promise<object>} Result with event ID
   */
  async publish(eventType, eventData, options = {}) {
    try {
      // Generate event ID
      const eventId = options.eventId || this.generateEventId();

      // Generate or use provided idempotency key
      const idempotencyKey = options.idempotencyKey ||
        this.generateIdempotencyKey(eventType, eventData);

      // Check for duplicate events (idempotency)
      if (this.isDuplicate(idempotencyKey)) {
        return {
          success: true,
          eventId: this.processedEvents.get(idempotencyKey),
          duplicate: true
        };
      }

      // Get or create correlation ID for this session
      const correlationId = this.getCorrelationId(eventData.session_id);

      // Create event envelope
      const event = {
        id: eventId,
        type: eventType,
        data: eventData,
        metadata: {
          idempotencyKey,
          correlationId,
          timestamp: new Date().toISOString(),
          priority: options.priority || 'normal', // high, normal, low
          retryCount: 0,
          source: options.source || 'unknown',
          version: '1.0.0'
        }
      };

      // Check queue size limit
      if (this.eventQueue.length >= this.config.maxQueueSize) {
        this.dropLowPriorityEvents();
      }

      // Add to queue
      this.eventQueue.push(event);

      // Mark as seen (for deduplication)
      this.processedEvents.set(idempotencyKey, eventId);

      // Trigger batch processing if needed
      this.scheduleBatchProcessing();

      return {
        success: true,
        eventId,
        duplicate: false,
        correlationId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subscribe to event types
   * @param {string|string[]} eventTypes - Event type(s) to subscribe to
   * @param {function} handler - Async handler function
   * @param {object} options - Handler options (priority, batchHandler, etc.)
   */
  subscribe(eventTypes, handler, options = {}) {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    types.forEach(type => {
      if (!this.subscribers.has(type)) {
        this.subscribers.set(type, []);
      }

      this.subscribers.get(type).push({
        handler,
        batchHandler: options.batchHandler || false,
        priority: options.priority || 0,
        name: options.name || handler.name || 'anonymous'
      });

      // Sort handlers by priority (higher priority first)
      this.subscribers.get(type).sort((a, b) => b.priority - a.priority);

    });
  }

  /**
   * Unsubscribe from event types
   */
  unsubscribe(eventTypes, handlerName) {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    types.forEach(type => {
      if (this.subscribers.has(type)) {
        const handlers = this.subscribers.get(type);
        this.subscribers.set(
          type,
          handlers.filter(h => h.name !== handlerName)
        );
      }
    });
  }

  /**
   * Schedule batch processing
   */
  scheduleBatchProcessing() {
    // Process immediately if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.processBatch();
    } else {
      // Schedule batch processing with timeout
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.batchTimeout);
    }
  }

  /**
   * Process batch of events
   */
  async processBatch() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Get batch from queue
    const batchSize = Math.min(this.config.batchSize, this.eventQueue.length);
    const batch = this.eventQueue.splice(0, batchSize);

    // Group events by type for batch handlers
    const eventsByType = new Map();
    const individualEvents = [];

    batch.forEach(event => {
      const handlers = this.subscribers.get(event.type) || [];
      const hasBatchHandler = handlers.some(h => h.batchHandler);

      if (hasBatchHandler) {
        if (!eventsByType.has(event.type)) {
          eventsByType.set(event.type, []);
        }
        eventsByType.get(event.type).push(event);
      } else {
        individualEvents.push(event);
      }
    });

    // Process batch handlers
    for (const [eventType, events] of eventsByType) {
      await this.processBatchForType(eventType, events);
    }

    // Process individual events
    for (const event of individualEvents) {
      await this.processEvent(event);
    }

    this.isProcessing = false;

    // Continue processing if more events in queue
    if (this.eventQueue.length > 0) {
      this.scheduleBatchProcessing();
    }
  }

  /**
   * Process batch of events for a specific type
   */
  async processBatchForType(eventType, events) {
    const handlers = this.subscribers.get(eventType) || [];
    const batchHandlers = handlers.filter(h => h.batchHandler);

    for (const handlerInfo of batchHandlers) {
      try {
        await handlerInfo.handler(events);
      } catch (error) {

        // Re-queue events for retry
        events.forEach(event => {
          if (event.metadata.retryCount < this.config.maxRetries) {
            event.metadata.retryCount++;
            this.eventQueue.push(event);
          } else {
          }
        });
      }
    }
  }

  /**
   * Process individual event
   */
  async processEvent(event, retryCount = 0) {
    const handlers = this.subscribers.get(event.type) || [];
    const individualHandlers = handlers.filter(h => !h.batchHandler);

    if (individualHandlers.length === 0) {
      return;
    }

    // Mark as processing
    this.processingQueue.add(event.id);

    try {
      // Execute all handlers
      await Promise.all(
        individualHandlers.map(handlerInfo =>
          handlerInfo.handler(event)
            .catch(error => {
              console.error(`[EVENT BUS] Handler error (${handlerInfo.name}):`, {
                error: error.message,
                eventType: event.type,
                eventId: event.id
              });
              throw error; // Re-throw to trigger retry logic
            })
        )
      );

      // Remove from processing queue
      this.processingQueue.delete(event.id);
    } catch (error) {
      // Retry logic with exponential backoff
      if (retryCount < this.config.maxRetries) {
        const backoffDelay = this.config.retryDelay * Math.pow(2, retryCount);

        setTimeout(() => {
          event.metadata.retryCount = retryCount + 1;
          this.processEvent(event, retryCount + 1);
        }, backoffDelay);
      } else {
        this.processingQueue.delete(event.id);
      }
    }
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate idempotency key from event data
   */
  generateIdempotencyKey(eventType, eventData) {
    const hash = crypto.createHash('sha256');
    hash.update(eventType);
    hash.update(JSON.stringify(eventData));
    return hash.digest('hex');
  }

  /**
   * Check if event is duplicate
   */
  isDuplicate(idempotencyKey) {
    return this.processedEvents.has(idempotencyKey);
  }

  /**
   * Get or create correlation ID for session
   */
  getCorrelationId(sessionId) {
    if (!sessionId) {
      return this.generateCorrelationId();
    }

    if (!this.correlationIds.has(sessionId)) {
      this.correlationIds.set(sessionId, this.generateCorrelationId());
    }

    return this.correlationIds.get(sessionId);
  }

  /**
   * Generate correlation ID
   */
  generateCorrelationId() {
    return `corr_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Drop low priority events when queue is full
   */
  dropLowPriorityEvents() {
    const lowPriorityEvents = this.eventQueue.filter(e => e.metadata.priority === 'low');
    const dropCount = Math.min(lowPriorityEvents.length, Math.floor(this.eventQueue.length * 0.1));

    for (let i = 0; i < dropCount; i++) {
      const index = this.eventQueue.indexOf(lowPriorityEvents[i]);
      if (index > -1) {
        this.eventQueue.splice(index, 1);
      }
    }
  }

  /**
   * Start background workers
   */
  startWorkers() {
    // Worker to ensure batch processing continues
    setInterval(() => {
      if (!this.isProcessing && this.eventQueue.length > 0) {
        this.processBatch();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start cleanup job for deduplication cache
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const ttl = this.config.deduplicationTTL;

      // Clean up old processed events
      for (const [key, eventId] of this.processedEvents) {
        // Simple TTL based on event ID timestamp
        const eventTimestamp = parseInt(eventId.split('_')[1]);
        if (now - eventTimestamp > ttl) {
          this.processedEvents.delete(key);
        }
      }
    }, 60000); // Run every minute
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      queueSize: this.eventQueue.length,
      processingCount: this.processingQueue.size,
      subscriberCount: this.subscribers.size,
      processedCacheSize: this.processedEvents.size,
      correlationCacheSize: this.correlationIds.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Flush queue (process all events immediately)
   * Useful for graceful shutdown
   */
  async flush() {
    while (this.eventQueue.length > 0) {
      await this.processBatch();
    }
  }
}

// Singleton instance
const eventBus = new EventBus();

module.exports = eventBus;
