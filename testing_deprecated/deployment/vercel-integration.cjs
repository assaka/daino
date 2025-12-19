// Vercel Integration for Testing Stack
// Monitors Vercel deployments and frontend health

class VercelIntegration {
  constructor() {
    this.vercelApiUrl = 'https://api.vercel.com/v2';
    this.frontendUrl = process.env.VERCEL_FRONTEND_URL || 'https://www..dainostore.com';
    this.projectId = process.env.VERCEL_PROJECT_ID;
    this.teamId = process.env.VERCEL_TEAM_ID;
    this.apiToken = process.env.VERCEL_API_TOKEN; // Optional for deployment API access
  }

  // Check Vercel frontend deployment health
  async checkFrontendHealth() {
    try {
      console.log('🌐 Checking Vercel frontend health...');
      
      const startTime = Date.now();
      const response = await fetch(this.frontendUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'DainoStore-Testing-Stack'
        }
      });
      const responseTime = Date.now() - startTime;
      
      const isHealthy = response.ok;
      const contentLength = response.headers.get('content-length');
      
      console.log(`✅ Frontend Health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Response Time: ${responseTime}ms`);
      console.log(`   Content Size: ${contentLength || 'unknown'} bytes`);
      
      // Check if our enhanced API client loaded
      const htmlContent = await response.text();
      const hasApiDebugger = htmlContent.includes('api-debugger') || 
                           htmlContent.includes('apiDebugger');
      
      console.log(`   API Debugger Loaded: ${hasApiDebugger ? '✅' : '❌'}`);
      
      return {
        healthy: isHealthy,
        url: this.frontendUrl,
        status: response.status,
        responseTime,
        contentLength: parseInt(contentLength) || 0,
        hasApiDebugger,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Vercel health check failed:', error.message);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test critical frontend functionality
  async testCriticalFrontendFeatures() {
    try {
      console.log('🧪 Testing critical frontend features on Vercel...');
      
      const features = {
        pageLoads: false,
        apiClientLoaded: false,
        routingWorks: false,
        assetsLoaded: false
      };
      
      // Test main page load
      const mainPageResponse = await fetch(this.frontendUrl);
      features.pageLoads = mainPageResponse.ok;
      
      // Test critical routes
      const criticalRoutes = [
        '/admin',
        '/admin/integrations',
        '/admin/products'
      ];
      
      let workingRoutes = 0;
      for (const route of criticalRoutes) {
        try {
          const routeResponse = await fetch(`${this.frontendUrl}${route}`);
          // 200 or 404 is ok (SPA routing), 500+ is not
          if (routeResponse.status < 500) {
            workingRoutes++;
          }
        } catch (error) {
          console.log(`   Route ${route}: Error`);
        }
      }
      
      features.routingWorks = workingRoutes >= criticalRoutes.length / 2;
      
      // Check if assets are loading (JS/CSS bundles)
      const htmlContent = await mainPageResponse.text();
      const hasJSAssets = htmlContent.includes('.js') && !htmlContent.includes('script src=""');
      const hasCSSAssets = htmlContent.includes('.css') || htmlContent.includes('style');
      
      features.assetsLoaded = hasJSAssets && hasCSSAssets;
      features.apiClientLoaded = htmlContent.includes('api') || htmlContent.includes('client');
      
      console.log('📋 Frontend Feature Test Results:');
      console.log(`  Page Loading: ${features.pageLoads ? '✅' : '❌'}`);
      console.log(`  API Client: ${features.apiClientLoaded ? '✅' : '❌'}`);
      console.log(`  Routing: ${features.routingWorks ? '✅' : '❌'} (${workingRoutes}/${criticalRoutes.length} routes)`);
      console.log(`  Assets: ${features.assetsLoaded ? '✅' : '❌'}`);
      
      return {
        features,
        overallHealth: Object.values(features).filter(Boolean).length >= 3,
        workingRoutes,
        totalRoutes: criticalRoutes.length
      };
      
    } catch (error) {
      console.error('❌ Frontend feature test failed:', error.message);
      return { error: error.message };
    }
  }

  // Check if our enhanced API client is working in production
  async validateApiClientIntegration() {
    try {
      console.log('🔧 Validating API client integration on Vercel...');
      
      // Since we can't directly check client-side code execution,
      // we'll test the API endpoints that our frontend calls
      const backendUrl = process.env.RENDER_BACKEND_URL || 'https://backend.dainostore.com';
      
      const apiTests = [
        {
          name: 'Custom Mappings API',
          endpoint: '/api/integrations/akeneo/custom-mappings',
          critical: true
        },
        {
          name: 'Products API',
          endpoint: '/api/products',
          critical: false
        },
        {
          name: 'Storage API',
          endpoint: '/api/storage/status',
          critical: false
        }
      ];
      
      const results = [];
      for (const test of apiTests) {
        try {
          const response = await fetch(`${backendUrl}${test.endpoint}`);
          const isWorking = response.ok || response.status === 401; // 401 is OK for protected endpoints
          
          results.push({
            name: test.name,
            endpoint: test.endpoint,
            working: isWorking,
            status: response.status,
            critical: test.critical
          });
          
        } catch (error) {
          results.push({
            name: test.name,
            endpoint: test.endpoint,
            working: false,
            error: error.message,
            critical: test.critical
          });
        }
      }
      
      console.log('📋 API Integration Test Results:');
      results.forEach(result => {
        const status = result.working ? '✅' : '❌';
        const criticality = result.critical ? '🚨' : 'ℹ️';
        console.log(`  ${criticality} ${status} ${result.name}: ${result.status || result.error}`);
      });
      
      const criticalFailures = results.filter(r => r.critical && !r.working);
      return {
        results,
        criticalFailures: criticalFailures.length,
        overallWorking: criticalFailures.length === 0
      };
      
    } catch (error) {
      console.error('❌ API client integration test failed:', error.message);
      return { error: error.message };
    }
  }

  // Get monitoring configuration for Vercel
  getMonitoringConfig() {
    return {
      platform: 'vercel',
      frontendUrl: this.frontendUrl,
      healthEndpoint: this.frontendUrl,
      criticalRoutes: [
        `${this.frontendUrl}/admin`,
        `${this.frontendUrl}/admin/integrations`,
        `${this.frontendUrl}/admin/products`
      ],
      monitoringInterval: 60000, // 1 minute
      alertThresholds: {
        responseTime: 3000, // 3 seconds for Vercel
        errorRate: 5,
        healthCheckFailures: 2
      },
      features: [
        'pageLoads',
        'apiClientLoaded', 
        'routingWorks',
        'assetsLoaded'
      ]
    };
  }

  // Check Vercel build status (if API token provided)
  async checkBuildStatus() {
    if (!this.apiToken || !this.projectId) {
      console.log('ℹ️ Vercel API token not configured - skipping build status check');
      return { skipped: true };
    }

    try {
      const response = await fetch(`${this.vercelApiUrl}/projects/${this.projectId}/deployments?limit=1`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Vercel API responded with ${response.status}`);
      }

      const data = await response.json();
      const latestDeployment = data.deployments[0];

      console.log('🚀 Latest Vercel Deployment:');
      console.log(`   State: ${latestDeployment.state}`);
      console.log(`   URL: ${latestDeployment.url}`);
      console.log(`   Created: ${new Date(latestDeployment.createdAt).toLocaleString()}`);

      return {
        state: latestDeployment.state,
        url: latestDeployment.url,
        createdAt: latestDeployment.createdAt,
        healthy: latestDeployment.state === 'READY'
      };

    } catch (error) {
      console.error('❌ Vercel build status check failed:', error.message);
      return { error: error.message };
    }
  }
}

module.exports = VercelIntegration;