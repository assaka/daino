// Automated Error Detection System
// Detects transformation issues, memory leaks, performance bottlenecks, and dead code

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class ErrorDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      memoryCheckInterval: options.memoryCheckInterval || 30000, // 30 seconds
      performanceThresholds: {
        responseTime: options.responseTimeThreshold || 1000,
        memoryLeak: options.memoryLeakThreshold || 50, // MB increase
        cpuUsage: options.cpuThreshold || 80,
        errorRate: options.errorRateThreshold || 5 // percentage
      },
      detectionRules: options.detectionRules || {},
      historySize: options.historySize || 1000,
      ...options
    };

    // Detection state
    this.detectionHistory = [];
    this.memoryBaseline = null;
    this.performanceBaseline = new Map();
    this.errorPatterns = new Map();
    this.suspiciousEndpoints = new Set();
    
    // Known issues database (learning from problems and solutions)
    this.knownIssues = new Map();
    this.solutionPatterns = new Map();
    
    this.initializeKnownIssues();
    this.startMemoryMonitoring();
  }

  initializeKnownIssues() {
    // Initialize with known transformation issues
    this.knownIssues.set('custom-mappings-transformation', {
      pattern: /custom-mappings.*transformation/i,
      severity: 'HIGH',
      category: 'TRANSFORMATION_BUG',
      description: 'Custom mappings endpoint being incorrectly transformed',
      solution: 'Add explicit skip-transform rule for custom-mappings endpoints',
      prevention: 'Always check endpoint patterns before applying transformations',
      detectionCriteria: {
        endpoint: /\/custom-mappings/,
        expectedStructure: { success: true, mappings: {} },
        incorrectStructure: Array.isArray
      }
    });

    this.knownIssues.set('endpoint-s-transformation', {
      pattern: /endpoints.*ending.*s.*transformed/i,
      severity: 'MEDIUM',
      category: 'TRANSFORMATION_BUG',
      description: 'Endpoints ending in "s" being incorrectly transformed',
      solution: 'Refine transformation rules to exclude stats, status, config endpoints',
      prevention: 'Use whitelist approach for transformation rather than pattern matching',
      detectionCriteria: {
        endpointPattern: /\/(stats|status|config|test|save)$/,
        shouldNotTransform: true
      }
    });

    this.knownIssues.set('memory-leak-event-listeners', {
      pattern: /memory.*leak.*event.*listeners/i,
      severity: 'HIGH',
      category: 'MEMORY_LEAK',
      description: 'Memory leak caused by unremoved event listeners',
      solution: 'Ensure all event listeners are properly cleaned up in componentWillUnmount or useEffect cleanup',
      prevention: 'Use weak references or automatic cleanup patterns'
    });

    this.knownIssues.set('n-plus-one-queries', {
      pattern: /n\+1.*quer(y|ies)/i,
      severity: 'HIGH',
      category: 'PERFORMANCE',
      description: 'N+1 query problem causing performance degradation',
      solution: 'Use eager loading, batch queries, or query optimization',
      prevention: 'Monitor query patterns and use database query analyzers'
    });
  }

  // Detect response transformation issues (critical for custom mappings bug)
  detectTransformationIssues(endpoint, method, response, expectedTransform) {
    const detection = {
      timestamp: new Date().toISOString(),
      type: 'TRANSFORMATION_ISSUE',
      endpoint,
      method,
      severity: 'MEDIUM'
    };

    // Check against known transformation issues
    const customMappingsIssue = this.knownIssues.get('custom-mappings-transformation');
    if (customMappingsIssue.detectionCriteria.endpoint.test(endpoint)) {
      const hasCorrectStructure = response && 
                                 typeof response === 'object' && 
                                 response.success && 
                                 response.mappings;
      
      const hasIncorrectStructure = Array.isArray(response);

      if (hasIncorrectStructure) {
        detection.severity = 'HIGH';
        detection.issue = 'custom-mappings-transformation';
        detection.details = {
          expected: 'Object with success and mappings properties',
          actual: 'Array (incorrectly transformed)',
          solution: customMappingsIssue.solution
        };

        this.emitDetection(detection);
        return detection;
      }
    }

    // Check for generic transformation issues
    const shouldTransform = this.shouldEndpointTransform(endpoint);
    const wasTransformed = this.detectIfTransformed(response);

    if (shouldTransform !== wasTransformed) {
      detection.issue = 'transformation-mismatch';
      detection.details = {
        endpoint,
        shouldTransform,
        wasTransformed,
        responseType: Array.isArray(response) ? 'array' : typeof response
      };

      this.emitDetection(detection);
      return detection;
    }

    return null;
  }

  shouldEndpointTransform(endpoint) {
    // Use same logic as the fixed client.js
    if (endpoint.includes('/custom-mappings')) return false;
    if (endpoint.includes('/storage/')) return false;
    if (endpoint.includes('/stats')) return false;
    if (endpoint.includes('/status')) return false;
    if (endpoint.includes('/config')) return false;
    if (endpoint.includes('/test')) return false;
    if (endpoint.includes('/save')) return false;

    return endpoint.includes('/list') || 
           (endpoint.endsWith('s') && !endpoint.match(/\/(stats|status|config|test|save)$/));
  }

  detectIfTransformed(response) {
    // Detect if response was transformed by checking structure
    if (Array.isArray(response)) {
      // Direct array response likely means transformation was applied
      return true;
    }

    if (response && typeof response === 'object' && response.success && response.data) {
      // Wrapper structure preserved, likely no transformation
      return false;
    }

    return false;
  }

  // Detect memory leaks
  detectMemoryLeaks() {
    const memUsage = process.memoryUsage();
    const currentHeapUsed = memUsage.heapUsed;

    if (this.memoryBaseline === null) {
      this.memoryBaseline = currentHeapUsed;
      return null;
    }

    const memoryIncrease = (currentHeapUsed - this.memoryBaseline) / 1024 / 1024; // MB

    if (memoryIncrease > this.options.performanceThresholds.memoryLeak) {
      const detection = {
        timestamp: new Date().toISOString(),
        type: 'MEMORY_LEAK',
        severity: memoryIncrease > 100 ? 'HIGH' : 'MEDIUM',
        details: {
          baseline: Math.round(this.memoryBaseline / 1024 / 1024),
          current: Math.round(currentHeapUsed / 1024 / 1024),
          increase: Math.round(memoryIncrease),
          threshold: this.options.performanceThresholds.memoryLeak
        },
        possibleCauses: this.identifyMemoryLeakCauses(memoryIncrease),
        solutions: this.getMemoryLeakSolutions()
      };

      this.emitDetection(detection);
      
      // Update baseline to prevent spam
      this.memoryBaseline = currentHeapUsed;
      
      return detection;
    }

    // Gradually adjust baseline for normal growth
    this.memoryBaseline = this.memoryBaseline * 0.999 + currentHeapUsed * 0.001;
    return null;
  }

  identifyMemoryLeakCauses(memoryIncrease) {
    const causes = [];
    
    if (memoryIncrease > 50) {
      causes.push('Large object retention in memory');
      causes.push('Unremoved event listeners');
      causes.push('Circular references preventing garbage collection');
    }
    
    if (memoryIncrease > 100) {
      causes.push('Major memory leak - possibly cache not being cleared');
      causes.push('Large arrays or objects being accumulated');
    }

    return causes;
  }

  getMemoryLeakSolutions() {
    return [
      'Check for unremoved event listeners in React components',
      'Verify cache cleanup mechanisms are working',
      'Look for circular references in object structures',
      'Review image/file handling for proper cleanup',
      'Check for setTimeout/setInterval cleanup'
    ];
  }

  // Detect performance bottlenecks
  detectPerformanceBottlenecks(endpoint, responseTime, details = {}) {
    const key = endpoint;
    
    if (!this.performanceBaseline.has(key)) {
      this.performanceBaseline.set(key, {
        average: responseTime,
        samples: 1,
        min: responseTime,
        max: responseTime,
        history: [responseTime]
      });
      return null;
    }

    const baseline = this.performanceBaseline.get(key);
    
    // Update baseline
    baseline.samples++;
    baseline.history.push(responseTime);
    baseline.min = Math.min(baseline.min, responseTime);
    baseline.max = Math.max(baseline.max, responseTime);
    baseline.average = (baseline.average * (baseline.samples - 1) + responseTime) / baseline.samples;
    
    // Keep only recent history
    if (baseline.history.length > 100) {
      baseline.history = baseline.history.slice(-100);
    }

    // Detect performance regression
    const recentAverage = baseline.history.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, baseline.history.length);
    const historicalAverage = baseline.average;
    const regressionThreshold = historicalAverage * 2; // 100% increase

    if (responseTime > this.options.performanceThresholds.responseTime || 
        responseTime > regressionThreshold) {
      
      const detection = {
        timestamp: new Date().toISOString(),
        type: 'PERFORMANCE_BOTTLENECK',
        severity: responseTime > regressionThreshold ? 'HIGH' : 'MEDIUM',
        endpoint,
        details: {
          responseTime,
          baseline: Math.round(historicalAverage),
          recentAverage: Math.round(recentAverage),
          threshold: this.options.performanceThresholds.responseTime,
          samples: baseline.samples,
          ...details
        },
        possibleCauses: this.identifyPerformanceCauses(responseTime, baseline),
        solutions: this.getPerformanceSolutions(endpoint)
      };

      this.emitDetection(detection);
      return detection;
    }

    return null;
  }

  identifyPerformanceCauses(responseTime, baseline) {
    const causes = [];
    
    if (responseTime > baseline.average * 3) {
      causes.push('Database query performance issue');
      causes.push('Network latency or timeout');
      causes.push('Memory pressure affecting response times');
    }

    if (responseTime > 5000) {
      causes.push('Possible N+1 query problem');
      causes.push('Large data processing without optimization');
      causes.push('External API timeout or slowdown');
    }

    return causes;
  }

  getPerformanceSolutions(endpoint) {
    const solutions = [
      'Add database query optimization and indexing',
      'Implement response caching where appropriate',
      'Add request timeout and circuit breaker patterns',
      'Review and optimize data processing logic'
    ];

    if (endpoint.includes('products')) {
      solutions.push('Add product list pagination or virtualization');
      solutions.push('Optimize product image loading');
    }

    if (endpoint.includes('integrations')) {
      solutions.push('Add retry logic for external API calls');
      solutions.push('Implement batch processing for large imports');
    }

    return solutions;
  }

  // Detect dead code (based on endpoint usage patterns)
  detectDeadCode(endpointStats) {
    const detections = [];
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    for (const [endpoint, stats] of endpointStats.entries()) {
      // Check for unused endpoints
      if (stats.totalCalls === 0 || stats.last24Hours.length === 0) {
        detections.push({
          timestamp: new Date().toISOString(),
          type: 'DEAD_CODE',
          severity: 'LOW',
          endpoint,
          details: {
            totalCalls: stats.totalCalls,
            lastCalled: stats.last24Hours.length > 0 ? 
                       new Date(Math.max(...stats.last24Hours.map(h => h.timestamp))) : 
                       'Never',
            recommendation: 'Consider removing unused endpoint or investigating why it\'s not used'
          }
        });
      }

      // Check for endpoints with consistently high error rates
      if (stats.totalCalls > 10 && (stats.failedCalls / stats.totalCalls) > 0.5) {
        detections.push({
          timestamp: new Date().toISOString(),
          type: 'FAILING_CODE',
          severity: 'HIGH',
          endpoint,
          details: {
            errorRate: ((stats.failedCalls / stats.totalCalls) * 100).toFixed(2),
            totalCalls: stats.totalCalls,
            failedCalls: stats.failedCalls,
            recommendation: 'Investigate and fix consistently failing endpoint'
          }
        });
      }
    }

    return detections;
  }

  // Detect suspicious error patterns
  detectErrorPatterns(errors) {
    const patterns = new Map();
    const detections = [];

    // Group errors by pattern
    errors.forEach(error => {
      const pattern = this.extractErrorPattern(error);
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern).push(error);
    });

    // Analyze patterns
    for (const [pattern, patternErrors] of patterns.entries()) {
      if (patternErrors.length > 5) { // Threshold for suspicious pattern
        const detection = {
          timestamp: new Date().toISOString(),
          type: 'ERROR_PATTERN',
          severity: patternErrors.length > 20 ? 'HIGH' : 'MEDIUM',
          pattern,
          details: {
            occurrences: patternErrors.length,
            firstSeen: patternErrors[0].timestamp,
            lastSeen: patternErrors[patternErrors.length - 1].timestamp,
            affectedEndpoints: [...new Set(patternErrors.map(e => e.endpoint))],
            sampleError: patternErrors[0].error
          },
          possibleCauses: this.identifyErrorCauses(pattern, patternErrors),
          solutions: this.getErrorSolutions(pattern)
        };

        detections.push(detection);
      }
    }

    return detections;
  }

  extractErrorPattern(error) {
    // Extract meaningful pattern from error message
    let pattern = error.error.message;
    
    // Remove specific IDs, numbers, and variable parts
    pattern = pattern.replace(/\b\d+\b/g, 'N');
    pattern = pattern.replace(/[a-f0-9-]{36}/g, 'UUID');
    pattern = pattern.replace(/\b\w+@\w+\.\w+\b/g, 'EMAIL');
    pattern = pattern.replace(/https?:\/\/[^\s]+/g, 'URL');
    
    return pattern;
  }

  identifyErrorCauses(pattern, errors) {
    const causes = [];
    
    if (pattern.includes('timeout')) {
      causes.push('Network timeout or slow external service');
      causes.push('Database query performance issue');
    }
    
    if (pattern.includes('validation')) {
      causes.push('Invalid input data format');
      causes.push('Missing required fields');
    }
    
    if (pattern.includes('transformation')) {
      causes.push('Response transformation logic error');
      causes.push('Incorrect endpoint transformation rules');
    }

    if (pattern.includes('permission') || pattern.includes('unauthorized')) {
      causes.push('Authentication or authorization issue');
      causes.push('Token expiration or invalid credentials');
    }

    return causes;
  }

  getErrorSolutions(pattern) {
    const solutions = [];
    
    if (pattern.includes('timeout')) {
      solutions.push('Increase timeout values or optimize slow operations');
      solutions.push('Add retry logic with exponential backoff');
    }
    
    if (pattern.includes('validation')) {
      solutions.push('Add client-side validation to prevent invalid requests');
      solutions.push('Improve error messages to guide users');
    }
    
    if (pattern.includes('transformation')) {
      solutions.push('Review and test transformation rules');
      solutions.push('Add explicit transformation exemptions for problematic endpoints');
    }

    return solutions;
  }

  // Start continuous monitoring
  startMemoryMonitoring() {
    setInterval(() => {
      this.detectMemoryLeaks();
    }, this.options.memoryCheckInterval);
  }

  // Process monitoring data and detect issues
  processMonitoringData(data) {
    const detections = [];

    // Analyze API calls for transformation issues
    if (data.apiCalls) {
      data.apiCalls.forEach(call => {
        const transformationIssue = this.detectTransformationIssues(
          call.endpoint,
          call.method,
          call.response,
          call.transformationApplied
        );
        if (transformationIssue) {
          detections.push(transformationIssue);
        }

        const performanceIssue = this.detectPerformanceBottlenecks(
          call.endpoint,
          call.responseTime,
          { method: call.method, statusCode: call.statusCode }
        );
        if (performanceIssue) {
          detections.push(performanceIssue);
        }
      });
    }

    // Analyze errors for patterns
    if (data.errors) {
      const errorPatternDetections = this.detectErrorPatterns(data.errors);
      detections.push(...errorPatternDetections);
    }

    // Analyze endpoint usage for dead code
    if (data.endpointStats) {
      const deadCodeDetections = this.detectDeadCode(data.endpointStats);
      detections.push(...deadCodeDetections);
    }

    return detections;
  }

  // Emit detection event
  emitDetection(detection) {
    this.detectionHistory.push(detection);
    
    // Keep history size manageable
    if (this.detectionHistory.length > this.options.historySize) {
      this.detectionHistory = this.detectionHistory.slice(-this.options.historySize);
    }

    this.emit('detection', detection);
    
    if (detection.severity === 'HIGH') {
      console.error(`🚨 HIGH SEVERITY DETECTION: ${detection.type}`, detection);
    }
  }

  // Get detection summary
  getDetectionSummary() {
    const now = Date.now();
    const last24Hours = this.detectionHistory.filter(detection => 
      now - new Date(detection.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    const summary = {
      total: last24Hours.length,
      high: last24Hours.filter(d => d.severity === 'HIGH').length,
      medium: last24Hours.filter(d => d.severity === 'MEDIUM').length,
      low: last24Hours.filter(d => d.severity === 'LOW').length,
      categories: {}
    };

    // Group by type
    last24Hours.forEach(detection => {
      if (!summary.categories[detection.type]) {
        summary.categories[detection.type] = 0;
      }
      summary.categories[detection.type]++;
    });

    return summary;
  }

  // Export detection report
  async exportDetectionReport(filePath) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this.getDetectionSummary(),
      detectionHistory: this.detectionHistory,
      knownIssues: Array.from(this.knownIssues.entries()),
      recommendations: this.generateRecommendations()
    };

    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const summary = this.getDetectionSummary();

    // High priority recommendations
    if (summary.categories.TRANSFORMATION_ISSUE > 0) {
      recommendations.push({
        priority: 'HIGH',
        type: 'TRANSFORMATION_ISSUE',
        message: 'Review API response transformation rules to prevent data corruption',
        action: 'Add explicit transformation rules for problematic endpoints'
      });
    }

    if (summary.categories.MEMORY_LEAK > 0) {
      recommendations.push({
        priority: 'HIGH',
        type: 'MEMORY_LEAK',
        message: 'Investigate memory leaks to prevent application crashes',
        action: 'Review event listener cleanup and cache management'
      });
    }

    if (summary.categories.PERFORMANCE_BOTTLENECK > 3) {
      recommendations.push({
        priority: 'MEDIUM',
        type: 'PERFORMANCE_BOTTLENECK',
        message: 'Multiple performance bottlenecks detected',
        action: 'Optimize slow endpoints and add performance monitoring'
      });
    }

    return recommendations;
  }
}

module.exports = ErrorDetector;