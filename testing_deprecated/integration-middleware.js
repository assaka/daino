// Integration Middleware for Existing DainoStore Application
// Easy drop-in integration for monitoring and testing

const DashboardServer = require('./monitoring/dashboard-server');
const ContractValidator = require('./api-contracts/contract-validator');
const ErrorDetector = require('./error-detection/error-detector');

class TestingIntegration {
  constructor(options = {}) {
    this.options = {
      enableMonitoring: process.env.NODE_ENV !== 'production' || options.enableMonitoring,
      enableContractValidation: process.env.NODE_ENV === 'development',
      enableErrorDetection: true,
      monitoringPort: options.monitoringPort || 3001,
      ...options
    };

    this.dashboardServer = null;
    this.contractValidator = null;
    this.errorDetector = null;
    this.initialized = false;
  }

  // Initialize all testing components
  async initialize() {
    if (this.initialized) return;

    console.log('🧪 Initializing testing stack...');

    try {
      // Initialize contract validator
      if (this.options.enableContractValidation) {
        this.contractValidator = new ContractValidator();
        console.log('✅ Contract validator initialized');
      }

      // Initialize error detector
      if (this.options.enableErrorDetection) {
        this.errorDetector = new ErrorDetector();
        console.log('✅ Error detector initialized');
      }

      // Initialize monitoring dashboard
      if (this.options.enableMonitoring) {
        this.dashboardServer = new DashboardServer({
          port: this.options.monitoringPort
        });
        await this.dashboardServer.start();
        console.log(`✅ Monitoring dashboard started on port ${this.options.monitoringPort}`);
      }

      this.initialized = true;
      console.log('🚀 Testing stack fully initialized');

    } catch (error) {
      console.error('❌ Failed to initialize testing stack:', error);
      throw error;
    }
  }

  // Express middleware for API monitoring
  createExpressMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

      // Track request start
      if (this.dashboardServer) {
        this.dashboardServer.getMonitor().trackApiCallStart(
          requestId,
          req.path,
          req.method,
          req.headers
        );
      }

      // Store request ID for error tracking
      req.testingRequestId = requestId;

      // Capture response
      const originalJson = res.json;
      const originalSend = res.send;

      const captureResponse = (data) => {
        const responseTime = Date.now() - startTime;
        
        // Track in monitoring
        if (this.dashboardServer) {
          this.dashboardServer.getMonitor().trackApiCallEnd(
            requestId,
            res.statusCode,
            JSON.stringify(data).length,
            this.detectTransformation(data, req.path)
          );
        }

        // Contract validation in development
        if (this.contractValidator && process.env.NODE_ENV === 'development') {
          this.validateResponseContract(req.path, req.method, data, res.statusCode);
        }

        // Error detection
        if (this.errorDetector && res.statusCode >= 400) {
          this.errorDetector.trackError(requestId, {
            message: `HTTP ${res.statusCode}`,
            status: res.statusCode
          }, req.path, req.method);
        }

        return data;
      };

      res.json = function(data) {
        const capturedData = captureResponse(data);
        return originalJson.call(this, capturedData);
      };

      res.send = function(data) {
        try {
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          captureResponse(parsedData);
        } catch (e) {
          // Non-JSON response
          captureResponse({ raw: data });
        }
        return originalSend.call(this, data);
      };

      // Error handling
      res.on('error', (error) => {
        if (this.errorDetector) {
          this.errorDetector.trackError(requestId, error, req.path, req.method);
        }
      });

      next();
    };
  }

  // Detect if response was transformed
  detectTransformation(data, endpoint) {
    // Logic from the fixed client.js
    if (endpoint.includes('/custom-mappings')) return false;
    if (endpoint.includes('/storage/')) return false;
    if (endpoint.includes('/stats')) return false;
    if (endpoint.includes('/status')) return false;
    if (endpoint.includes('/config')) return false;

    // If response is array directly, likely transformed
    if (Array.isArray(data)) return true;
    
    // If wrapped response with data array, check if it should be transformed
    if (data && data.success && Array.isArray(data.data)) {
      const shouldTransform = endpoint.includes('/list') || 
                            (endpoint.endsWith('s') && !endpoint.match(/(stats|status|config|test|save)$/));
      return shouldTransform;
    }

    return false;
  }

  // Validate response against contract
  async validateResponseContract(endpoint, method, response, statusCode) {
    try {
      const validation = await this.contractValidator.validateResponse(
        endpoint,
        method,
        response,
        statusCode
      );

      if (!validation.valid) {
        console.warn('🔴 Contract validation failed:', {
          endpoint,
          method,
          errors: validation.errors,
          transformationIssues: validation.transformationCheck
        });
      } else if (validation.transformationCheck?.status === 'VIOLATION') {
        console.warn('⚠️  Transformation rule violation:', {
          endpoint,
          method,
          rule: validation.transformationCheck.rule
        });
      }
    } catch (error) {
      console.error('Contract validation error:', error);
    }
  }

  // Frontend client enhancement
  enhanceApiClient(apiClient) {
    if (!apiClient) return;

    const originalRequest = apiClient.request;
    
    apiClient.request = async function(method, endpoint, data, customHeaders) {
      const startTime = Date.now();
      
      try {
        const response = await originalRequest.call(this, method, endpoint, data, customHeaders);
        const responseTime = Date.now() - startTime;

        // In development, validate critical endpoints
        if (process.env.NODE_ENV === 'development') {
          if (endpoint.includes('custom-mappings') && Array.isArray(response)) {
            console.error('🚨 CRITICAL: Custom mappings endpoint returned array - transformation bug detected!');
          }
        }

        return response;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`API request failed: ${method} ${endpoint} (${responseTime}ms)`, error);
        throw error;
      }
    };

    return apiClient;
  }

  // Get monitoring dashboard URL
  getDashboardUrl() {
    return this.dashboardServer ? `http://localhost:${this.options.monitoringPort}` : null;
  }

  // Get current monitoring data
  getMonitoringData() {
    return this.dashboardServer ? this.dashboardServer.getMonitor().getDashboardData() : null;
  }

  // Export current metrics
  async exportMetrics() {
    if (!this.dashboardServer) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `./testing/reports/metrics-${timestamp}.json`;
    
    return await this.dashboardServer.getMonitor().exportMetrics(filePath);
  }

  // Manual testing helpers
  async testCriticalEndpoints() {
    const CriticalEndpointsTest = require('./smoke-tests/critical-endpoints');
    const tester = new CriticalEndpointsTest();
    return await tester.runTests();
  }

  async validateContracts() {
    if (!this.contractValidator) return null;

    const TestDataGenerators = require('./api-contracts/test-data-generators');
    const generator = new TestDataGenerators();

    // Test critical endpoints
    const testCases = [
      {
        endpoint: '/integrations/akeneo/custom-mappings',
        method: 'GET',
        response: generator.generateAkeneoCustomMappingResponse()
      },
      {
        endpoint: '/products',
        method: 'GET', 
        response: generator.generateListResponse([generator.generateProduct()])
      }
    ];

    const results = [];
    for (const testCase of testCases) {
      const validation = await this.contractValidator.validateResponse(
        testCase.endpoint,
        testCase.method,
        testCase.response
      );
      results.push(validation);
    }

    return results;
  }

  // Health check
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {}
    };

    // Check monitoring dashboard
    if (this.dashboardServer) {
      try {
        const response = await fetch(`http://localhost:${this.options.monitoringPort}/health`);
        health.components.monitoring = {
          status: response.ok ? 'healthy' : 'unhealthy',
          port: this.options.monitoringPort
        };
      } catch (error) {
        health.components.monitoring = {
          status: 'error',
          error: error.message
        };
      }
    }

    // Check contract validator
    if (this.contractValidator) {
      health.components.contractValidator = {
        status: 'healthy',
        schemas: this.contractValidator.schemas.size,
        transformationRules: this.contractValidator.transformationRules.size
      };
    }

    // Check error detector
    if (this.errorDetector) {
      const summary = this.errorDetector.getDetectionSummary();
      health.components.errorDetector = {
        status: summary.high > 0 ? 'warning' : 'healthy',
        detections: summary.total,
        highSeverity: summary.high
      };
    }

    // Overall status
    const hasErrors = Object.values(health.components).some(c => c.status === 'error');
    const hasWarnings = Object.values(health.components).some(c => c.status === 'warning');
    
    if (hasErrors) {
      health.status = 'error';
    } else if (hasWarnings) {
      health.status = 'warning';
    }

    return health;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down testing stack...');

    try {
      if (this.dashboardServer) {
        await this.dashboardServer.stop();
        console.log('✅ Monitoring dashboard stopped');
      }

      if (this.errorDetector) {
        // Export final error report
        await this.errorDetector.exportDetectionReport('./testing/reports/final-error-report.json');
        console.log('✅ Final error report exported');
      }

      console.log('✅ Testing stack shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Export singleton instance
let testingIntegration = null;

function initializeTesting(options = {}) {
  if (!testingIntegration) {
    testingIntegration = new TestingIntegration(options);
  }
  return testingIntegration;
}

function getTestingInstance() {
  return testingIntegration;
}

module.exports = {
  TestingIntegration,
  initializeTesting,
  getTestingInstance
};