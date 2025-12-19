// Real-time Performance Monitor
// Tracks API performance, error rates, and response times with alerts

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxDataPoints: options.maxDataPoints || 1000,
      alertThresholds: {
        responseTime: options.responseTimeThreshold || 2000, // ms
        errorRate: options.errorRateThreshold || 5, // percentage
        memoryUsage: options.memoryThreshold || 80, // percentage
        cpuUsage: options.cpuThreshold || 80 // percentage
      },
      metricsRetention: options.metricsRetention || 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };

    // Metrics storage
    this.metrics = {
      apiCalls: [],
      errors: [],
      performance: [],
      system: [],
      alerts: [],
      endpointStats: new Map(),
      transformationIssues: []
    };

    // Real-time tracking
    this.activeRequests = new Map();
    this.circuitBreakers = new Map();
    
    // Start system monitoring
    this.startSystemMonitoring();
    
    // Clean old data periodically
    setInterval(() => this.cleanOldData(), 60000); // Every minute
  }

  // Track API call start
  trackApiCallStart(requestId, endpoint, method, headers = {}) {
    const startTime = Date.now();
    const callData = {
      requestId,
      endpoint,
      method,
      startTime,
      headers,
      userAgent: headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    this.activeRequests.set(requestId, callData);
    return callData;
  }

  // Track API call completion
  trackApiCallEnd(requestId, statusCode, responseSize = 0, transformationApplied = false) {
    const callData = this.activeRequests.get(requestId);
    if (!callData) {
      console.warn(`No active request found for ID: ${requestId}`);
      return;
    }

    const endTime = Date.now();
    const responseTime = endTime - callData.startTime;

    const completedCall = {
      ...callData,
      endTime,
      responseTime,
      statusCode,
      responseSize,
      transformationApplied,
      success: statusCode >= 200 && statusCode < 300,
      timestamp: new Date().toISOString()
    };

    // Store metrics
    this.metrics.apiCalls.push(completedCall);
    this.updateEndpointStats(completedCall);
    
    // Check for alerts
    this.checkResponseTimeAlert(completedCall);
    this.checkErrorRateAlert(completedCall);
    
    // Track transformation issues (critical for custom mappings bug prevention)
    if (this.shouldTrackTransformation(completedCall.endpoint)) {
      this.trackTransformationCompliance(completedCall);
    }

    // Remove from active requests
    this.activeRequests.delete(requestId);

    // Emit event for real-time updates
    this.emit('apiCall', completedCall);

    // Cleanup old data if needed
    if (this.metrics.apiCalls.length > this.options.maxDataPoints) {
      this.metrics.apiCalls = this.metrics.apiCalls.slice(-this.options.maxDataPoints);
    }

    return completedCall;
  }

  // Track transformation compliance (critical for preventing custom mappings bug)
  trackTransformationCompliance(callData) {
    const { endpoint, transformationApplied, statusCode } = callData;
    
    // Define rules for transformation compliance
    const shouldTransform = this.shouldEndpointTransform(endpoint);
    const isCompliant = shouldTransform === transformationApplied;

    if (!isCompliant && statusCode >= 200 && statusCode < 300) {
      const issue = {
        timestamp: new Date().toISOString(),
        requestId: callData.requestId,
        endpoint,
        method: callData.method,
        expectedTransformation: shouldTransform,
        actualTransformation: transformationApplied,
        severity: this.getTransformationSeverity(endpoint),
        responseTime: callData.responseTime
      };

      this.metrics.transformationIssues.push(issue);
      
      // Emit high-severity alerts immediately
      if (issue.severity === 'HIGH') {
        this.emitAlert({
          type: 'TRANSFORMATION_VIOLATION',
          severity: 'HIGH',
          endpoint,
          message: `Critical transformation rule violation in ${endpoint}`,
          details: issue
        });
      }
    }
  }

  shouldEndpointTransform(endpoint) {
    // Rules based on the actual bug that was fixed
    if (endpoint.includes('/custom-mappings')) return false;
    if (endpoint.includes('/storage/')) return false;
    if (endpoint.includes('/stats')) return false;
    if (endpoint.includes('/status')) return false;
    if (endpoint.includes('/config')) return false;
    if (endpoint.includes('/test')) return false;
    if (endpoint.includes('/save')) return false;

    // Default: transform list endpoints
    return endpoint.includes('/list') || 
           (endpoint.endsWith('s') && !endpoint.match(/\/(stats|status|config|test|save)$/));
  }

  shouldTrackTransformation(endpoint) {
    // Track transformation for critical endpoints
    return endpoint.includes('/custom-mappings') ||
           endpoint.includes('/storage/') ||
           endpoint.includes('/integrations/') ||
           endpoint.endsWith('s');
  }

  getTransformationSeverity(endpoint) {
    if (endpoint.includes('/custom-mappings')) return 'HIGH';
    if (endpoint.includes('/orders') || endpoint.includes('/payments')) return 'HIGH';
    if (endpoint.includes('/integrations/')) return 'MEDIUM';
    return 'LOW';
  }

  // Track errors
  trackError(requestId, error, endpoint, method) {
    const errorData = {
      requestId,
      endpoint,
      method,
      error: {
        message: error.message,
        stack: error.stack,
        status: error.status || 500,
        name: error.name
      },
      timestamp: new Date().toISOString()
    };

    this.metrics.errors.push(errorData);
    this.emit('error', errorData);

    // Check for error rate alerts
    this.checkErrorRateAlert({ endpoint, success: false });

    return errorData;
  }

  // Update endpoint statistics
  updateEndpointStats(callData) {
    const key = `${callData.method} ${callData.endpoint}`;
    
    if (!this.metrics.endpointStats.has(key)) {
      this.metrics.endpointStats.set(key, {
        endpoint: callData.endpoint,
        method: callData.method,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        avgResponseTime: 0,
        last24Hours: [],
        transformationCompliance: { violations: 0, total: 0 }
      });
    }

    const stats = this.metrics.endpointStats.get(key);
    stats.totalCalls++;
    
    if (callData.success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    // Response time stats
    stats.totalResponseTime += callData.responseTime;
    stats.minResponseTime = Math.min(stats.minResponseTime, callData.responseTime);
    stats.maxResponseTime = Math.max(stats.maxResponseTime, callData.responseTime);
    stats.avgResponseTime = stats.totalResponseTime / stats.totalCalls;

    // 24-hour rolling window
    const now = Date.now();
    stats.last24Hours = stats.last24Hours.filter(call => 
      now - call.timestamp < 24 * 60 * 60 * 1000
    );
    stats.last24Hours.push({
      timestamp: now,
      responseTime: callData.responseTime,
      success: callData.success
    });

    // Track transformation compliance
    if (this.shouldTrackTransformation(callData.endpoint)) {
      stats.transformationCompliance.total++;
      const shouldTransform = this.shouldEndpointTransform(callData.endpoint);
      if (shouldTransform !== callData.transformationApplied) {
        stats.transformationCompliance.violations++;
      }
    }
  }

  // Check response time alerts
  checkResponseTimeAlert(callData) {
    if (callData.responseTime > this.options.alertThresholds.responseTime) {
      this.emitAlert({
        type: 'SLOW_RESPONSE',
        severity: callData.responseTime > this.options.alertThresholds.responseTime * 2 ? 'HIGH' : 'MEDIUM',
        endpoint: callData.endpoint,
        responseTime: callData.responseTime,
        threshold: this.options.alertThresholds.responseTime,
        message: `Slow response detected: ${callData.responseTime}ms for ${callData.endpoint}`
      });
    }
  }

  // Check error rate alerts
  checkErrorRateAlert(callData) {
    const key = `${callData.method} ${callData.endpoint}`;
    const stats = this.metrics.endpointStats.get(key);
    
    if (stats && stats.totalCalls > 10) { // Only alert after some calls
      const errorRate = (stats.failedCalls / stats.totalCalls) * 100;
      
      if (errorRate > this.options.alertThresholds.errorRate) {
        this.emitAlert({
          type: 'HIGH_ERROR_RATE',
          severity: errorRate > this.options.alertThresholds.errorRate * 2 ? 'HIGH' : 'MEDIUM',
          endpoint: callData.endpoint,
          errorRate: errorRate.toFixed(2),
          threshold: this.options.alertThresholds.errorRate,
          message: `High error rate detected: ${errorRate.toFixed(2)}% for ${callData.endpoint}`
        });
      }
    }
  }

  // Emit alert
  emitAlert(alert) {
    const alertData = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      ...alert
    };

    this.metrics.alerts.push(alertData);
    this.emit('alert', alertData);

    // Log high-severity alerts
    if (alert.severity === 'HIGH') {
      console.error(`🚨 HIGH SEVERITY ALERT: ${alert.message}`, alertData);
    }

    return alertData;
  }

  // Start system monitoring
  startSystemMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const systemMetrics = {
        timestamp: new Date().toISOString(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          usagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        activeRequests: this.activeRequests.size
      };

      this.metrics.system.push(systemMetrics);
      this.emit('systemMetrics', systemMetrics);

      // Check system alerts
      if (systemMetrics.memory.usagePercentage > this.options.alertThresholds.memoryUsage) {
        this.emitAlert({
          type: 'HIGH_MEMORY_USAGE',
          severity: 'MEDIUM',
          memoryUsage: systemMetrics.memory.usagePercentage.toFixed(2),
          threshold: this.options.alertThresholds.memoryUsage,
          message: `High memory usage: ${systemMetrics.memory.usagePercentage.toFixed(2)}%`
        });
      }

      // Cleanup old system metrics
      if (this.metrics.system.length > this.options.maxDataPoints) {
        this.metrics.system = this.metrics.system.slice(-this.options.maxDataPoints);
      }
    }, 5000); // Every 5 seconds
  }

  // Get current performance summary
  getPerformanceSummary() {
    const now = Date.now();
    const last24Hours = this.metrics.apiCalls.filter(call => 
      now - new Date(call.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    const totalCalls = last24Hours.length;
    const successfulCalls = last24Hours.filter(call => call.success).length;
    const failedCalls = totalCalls - successfulCalls;

    const responseTimes = last24Hours.map(call => call.responseTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const recentAlerts = this.metrics.alerts.filter(alert => 
      now - new Date(alert.timestamp).getTime() < 60 * 60 * 1000 // Last hour
    );

    const transformationIssues = this.metrics.transformationIssues.filter(issue =>
      now - new Date(issue.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    return {
      period: '24h',
      summary: {
        totalCalls,
        successfulCalls,
        failedCalls,
        successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(2) : 0,
        avgResponseTime: Math.round(avgResponseTime),
        activeRequests: this.activeRequests.size
      },
      alerts: {
        total: recentAlerts.length,
        high: recentAlerts.filter(alert => alert.severity === 'HIGH').length,
        medium: recentAlerts.filter(alert => alert.severity === 'MEDIUM').length,
        low: recentAlerts.filter(alert => alert.severity === 'LOW').length
      },
      transformationCompliance: {
        totalIssues: transformationIssues.length,
        highSeverity: transformationIssues.filter(issue => issue.severity === 'HIGH').length,
        endpointsAffected: new Set(transformationIssues.map(issue => issue.endpoint)).size
      },
      topEndpoints: this.getTopEndpoints(),
      slowestEndpoints: this.getSlowestEndpoints()
    };
  }

  getTopEndpoints(limit = 10) {
    return Array.from(this.metrics.endpointStats.entries())
      .map(([key, stats]) => ({
        endpoint: key,
        totalCalls: stats.totalCalls,
        successRate: stats.totalCalls > 0 ? (stats.successfulCalls / stats.totalCalls * 100).toFixed(2) : 0,
        avgResponseTime: Math.round(stats.avgResponseTime)
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, limit);
  }

  getSlowestEndpoints(limit = 10) {
    return Array.from(this.metrics.endpointStats.entries())
      .map(([key, stats]) => ({
        endpoint: key,
        avgResponseTime: Math.round(stats.avgResponseTime),
        maxResponseTime: stats.maxResponseTime,
        totalCalls: stats.totalCalls
      }))
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, limit);
  }

  // Get detailed endpoint analytics
  getEndpointAnalytics(endpoint, method) {
    const key = `${method} ${endpoint}`;
    const stats = this.metrics.endpointStats.get(key);
    
    if (!stats) {
      return null;
    }

    const now = Date.now();
    const recent = stats.last24Hours.filter(call => 
      now - call.timestamp < 60 * 60 * 1000 // Last hour
    );

    return {
      ...stats,
      recentHour: {
        totalCalls: recent.length,
        successfulCalls: recent.filter(call => call.success).length,
        avgResponseTime: recent.length > 0 
          ? Math.round(recent.reduce((sum, call) => sum + call.responseTime, 0) / recent.length)
          : 0
      },
      transformationCompliance: {
        ...stats.transformationCompliance,
        complianceRate: stats.transformationCompliance.total > 0 
          ? ((stats.transformationCompliance.total - stats.transformationCompliance.violations) / stats.transformationCompliance.total * 100).toFixed(2)
          : 100
      }
    };
  }

  // Clean old data
  cleanOldData() {
    const cutoff = Date.now() - this.options.metricsRetention;
    
    this.metrics.apiCalls = this.metrics.apiCalls.filter(call => 
      new Date(call.timestamp).getTime() > cutoff
    );
    
    this.metrics.errors = this.metrics.errors.filter(error => 
      new Date(error.timestamp).getTime() > cutoff
    );
    
    this.metrics.alerts = this.metrics.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoff
    );

    this.metrics.transformationIssues = this.metrics.transformationIssues.filter(issue =>
      new Date(issue.timestamp).getTime() > cutoff
    );
  }

  // Export metrics for reporting
  async exportMetrics(filePath) {
    const report = {
      exportedAt: new Date().toISOString(),
      summary: this.getPerformanceSummary(),
      rawMetrics: {
        apiCalls: this.metrics.apiCalls,
        errors: this.metrics.errors,
        alerts: this.metrics.alerts,
        system: this.metrics.system,
        transformationIssues: this.metrics.transformationIssues
      },
      endpointStats: Array.from(this.metrics.endpointStats.entries())
    };

    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    return report;
  }

  // Get real-time dashboard data
  getDashboardData() {
    return {
      summary: this.getPerformanceSummary(),
      recentAlerts: this.metrics.alerts.slice(-10),
      systemMetrics: this.metrics.system.slice(-1)[0],
      activeRequests: this.activeRequests.size,
      endpointStats: Array.from(this.metrics.endpointStats.entries()).slice(0, 10),
      transformationIssues: this.metrics.transformationIssues.slice(-5)
    };
  }
}

module.exports = PerformanceMonitor;