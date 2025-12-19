// Render.com Integration for Testing Stack
// Monitors Render deployments and API health

class RenderIntegration {
  constructor() {
    this.renderApiUrl = 'https://api.render.com/v1';
    this.backendUrl = process.env.RENDER_BACKEND_URL || 'https://backend.dainostore.com';
    this.apiKey = process.env.RENDER_API_KEY; // Optional for private API access
  }

  // Monitor Render deployment health
  async checkDeploymentHealth() {
    try {
      console.log('🚀 Checking Render deployment health...');
      
      // Check backend API health
      const healthResponse = await fetch(`${this.backendUrl}/health`);
      const isHealthy = healthResponse.ok;
      
      console.log(`✅ Backend Health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`   Status: ${healthResponse.status}`);
      console.log(`   Response Time: ${healthResponse.headers.get('x-response-time') || 'unknown'}ms`);
      
      // Test critical API endpoints on Render
      const criticalEndpoints = [
        '/api/health',
        '/api/integrations/akeneo/custom-mappings',
        '/api/storage/status',
        '/api/products/stats'
      ];
      
      const endpointResults = [];
      for (const endpoint of criticalEndpoints) {
        try {
          const startTime = Date.now();
          const response = await fetch(`${this.backendUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          const responseTime = Date.now() - startTime;
          
          endpointResults.push({
            endpoint,
            status: response.status,
            responseTime,
            healthy: response.ok || response.status === 401 // 401 is OK for auth-protected endpoints
          });
          
        } catch (error) {
          endpointResults.push({
            endpoint,
            status: 'ERROR',
            responseTime: 0,
            healthy: false,
            error: error.message
          });
        }
      }
      
      return {
        overall: isHealthy,
        backend: {
          url: this.backendUrl,
          healthy: isHealthy,
          status: healthResponse.status
        },
        endpoints: endpointResults,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Render health check failed:', error.message);
      return {
        overall: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Check if deployment supports our testing features
  async validateTestingCompatibility() {
    try {
      console.log('🧪 Validating Render testing compatibility...');
      
      const compatibility = {
        healthEndpoint: false,
        customMappingsEndpoint: false,
        transformationLogic: false,
        performanceMonitoring: false
      };
      
      // Test health endpoint
      const healthCheck = await fetch(`${this.backendUrl}/health`);
      compatibility.healthEndpoint = healthCheck.ok;
      
      // Test custom mappings endpoint (the one that had the bug)
      const customMappingsCheck = await fetch(`${this.backendUrl}/api/integrations/akeneo/custom-mappings`);
      compatibility.customMappingsEndpoint = customMappingsCheck.status !== 404;
      
      // Test if response headers indicate monitoring support
      const monitoringHeaders = customMappingsCheck.headers.get('x-response-time') || 
                              customMappingsCheck.headers.get('x-request-id');
      compatibility.performanceMonitoring = !!monitoringHeaders;
      
      console.log('📋 Render Compatibility Results:');
      console.log(`  Health Endpoint: ${compatibility.healthEndpoint ? '✅' : '❌'}`);
      console.log(`  Custom Mappings: ${compatibility.customMappingsEndpoint ? '✅' : '❌'}`);
      console.log(`  Performance Headers: ${compatibility.performanceMonitoring ? '✅' : '❌'}`);
      
      return compatibility;
      
    } catch (error) {
      console.error('❌ Compatibility check failed:', error.message);
      return { error: error.message };
    }
  }

  // Monitor Render deployment logs for issues
  async checkDeploymentLogs() {
    console.log('📋 Render deployment monitoring...');
    
    // Since we can't access Render logs directly without API key,
    // we'll monitor through health checks and error detection
    const healthStatus = await this.checkDeploymentHealth();
    
    if (!healthStatus.overall) {
      console.log('🚨 DEPLOYMENT ISSUE DETECTED:');
      console.log(`   Backend unhealthy: ${this.backendUrl}`);
      console.log(`   Timestamp: ${healthStatus.timestamp}`);
      
      // Alert about critical failures
      const criticalFailures = healthStatus.endpoints?.filter(e => 
        !e.healthy && e.endpoint.includes('custom-mappings')
      );
      
      if (criticalFailures?.length > 0) {
        console.log('🔴 CRITICAL: Custom mappings endpoint failing on Render');
        console.log('   This could indicate the transformation bug has returned!');
      }
    }
    
    return healthStatus;
  }

  // Integration with our testing dashboard
  getMonitoringConfig() {
    return {
      platform: 'render',
      backendUrl: this.backendUrl,
      healthEndpoint: `${this.backendUrl}/health`,
      criticalEndpoints: [
        `${this.backendUrl}/api/integrations/akeneo/custom-mappings`,
        `${this.backendUrl}/api/storage/status`,
        `${this.backendUrl}/api/products/stats`
      ],
      monitoringInterval: 30000, // 30 seconds
      alertThresholds: {
        responseTime: 5000, // 5 seconds for Render
        errorRate: 10, // Higher threshold for serverless cold starts
        healthCheckFailures: 3
      }
    };
  }
}

module.exports = RenderIntegration;