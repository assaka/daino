// Vercel API Route: Deployment Status
// Comprehensive monitoring of all deployment platforms

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const deploymentStatus = {
    timestamp: new Date().toISOString(),
    platforms: {
      render: {},
      vercel: {},
      supabase: {},
      monitoring: {}
    },
    summary: {
      totalPlatforms: 4,
      healthyPlatforms: 0,
      criticalIssues: 0,
      warnings: 0
    },
    uptime: {},
    alerts: []
  };

  try {
    const renderUrl = process.env.RENDER_BACKEND_URL || 'https://backend.dainostore.com';
    const vercelUrl = process.env.VERCEL_FRONTEND_URL || 'https://www..dainostore.com';

    // Render Backend Status
    try {
      const renderHealthResponse = await fetch(`${renderUrl}/health`, {
        signal: AbortSignal.timeout(10000)
      });
      
      // Test critical endpoints
      const criticalEndpoints = [
        '/api/integrations/akeneo/custom-mappings',
        '/api/products',
        '/api/storage/status'
      ];
      
      const endpointResults = [];
      for (const endpoint of criticalEndpoints) {
        try {
          const endpointStart = Date.now();
          const endpointResponse = await fetch(`${renderUrl}${endpoint}`, {
            signal: AbortSignal.timeout(10000)
          });
          
          endpointResults.push({
            endpoint,
            healthy: endpointResponse.ok || endpointResponse.status === 401,
            status: endpointResponse.status,
            responseTime: Date.now() - endpointStart
          });
        } catch (error) {
          endpointResults.push({
            endpoint,
            healthy: false,
            error: error.message
          });
        }
      }

      deploymentStatus.platforms.render = {
        name: 'Render Backend',
        healthy: renderHealthResponse.ok,
        status: renderHealthResponse.status,
        url: renderUrl,
        endpoints: endpointResults,
        criticalEndpointsWorking: endpointResults.filter(e => e.healthy).length
      };

      if (renderHealthResponse.ok) {
        deploymentStatus.summary.healthyPlatforms++;
      } else {
        deploymentStatus.summary.criticalIssues++;
      }
    } catch (error) {
      deploymentStatus.platforms.render = {
        name: 'Render Backend',
        healthy: false,
        error: error.message
      };
      deploymentStatus.summary.criticalIssues++;
    }

    // Vercel Frontend Status
    try {
      const vercelStart = Date.now();
      const vercelResponse = await fetch(vercelUrl, {
        signal: AbortSignal.timeout(10000)
      });
      
      deploymentStatus.platforms.vercel = {
        name: 'Vercel Frontend',
        healthy: vercelResponse.ok,
        status: vercelResponse.status,
        url: vercelUrl,
        responseTime: Date.now() - vercelStart,
        contentLength: vercelResponse.headers.get('content-length')
      };

      if (vercelResponse.ok) {
        deploymentStatus.summary.healthyPlatforms++;
      } else {
        deploymentStatus.summary.warnings++;
      }
    } catch (error) {
      deploymentStatus.platforms.vercel = {
        name: 'Vercel Frontend', 
        healthy: false,
        error: error.message
      };
      deploymentStatus.summary.warnings++;
    }

    // Supabase Status (via backend)
    try {
      const productsResponse = await fetch(`${renderUrl}/api/products`, {
        signal: AbortSignal.timeout(15000)
      });
      
      const storageResponse = await fetch(`${renderUrl}/api/storage/stats`, {
        signal: AbortSignal.timeout(15000)
      });

      deploymentStatus.platforms.supabase = {
        name: 'Supabase Database & Storage',
        healthy: (productsResponse.ok || productsResponse.status === 401) && 
                (storageResponse.ok || storageResponse.status === 401),
        database: {
          status: productsResponse.status,
          healthy: productsResponse.ok || productsResponse.status === 401
        },
        storage: {
          status: storageResponse.status,
          healthy: storageResponse.ok || storageResponse.status === 401
        }
      };

      if (deploymentStatus.platforms.supabase.healthy) {
        deploymentStatus.summary.healthyPlatforms++;
      } else {
        deploymentStatus.summary.criticalIssues++;
      }
    } catch (error) {
      deploymentStatus.platforms.supabase = {
        name: 'Supabase Database & Storage',
        healthy: false,
        error: error.message
      };
      deploymentStatus.summary.criticalIssues++;
    }

    // Monitoring Dashboard Status (this app!)
    deploymentStatus.platforms.monitoring = {
      name: 'Monitoring Dashboard',
      healthy: true,
      deployedOn: 'vercel',
      version: '1.0.0',
      features: [
        'Real-time health checks',
        'Transformation bug detection', 
        'Cross-platform monitoring',
        'Automated alerts'
      ]
    };
    deploymentStatus.summary.healthyPlatforms++;

    // Calculate uptime (mock data for now - would be stored in database in real implementation)
    deploymentStatus.uptime = {
      render: { percentage: 99.5, lastDown: null },
      vercel: { percentage: 99.8, lastDown: null },
      supabase: { percentage: 99.9, lastDown: null },
      monitoring: { percentage: 100, lastDown: null }
    };

    // Generate alerts based on status
    if (deploymentStatus.summary.criticalIssues > 0) {
      deploymentStatus.alerts.push({
        severity: 'CRITICAL',
        message: `${deploymentStatus.summary.criticalIssues} platform(s) experiencing critical issues`,
        timestamp: new Date().toISOString()
      });
    }

    // Check for transformation bug specifically
    const customMappingsEndpoint = deploymentStatus.platforms.render?.endpoints?.find(e => 
      e.endpoint === '/api/integrations/akeneo/custom-mappings'
    );
    
    if (customMappingsEndpoint && !customMappingsEndpoint.healthy) {
      deploymentStatus.alerts.push({
        severity: 'HIGH',
        message: 'Custom mappings endpoint failing - transformation bug may have returned!',
        endpoint: customMappingsEndpoint.endpoint,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Deployment status check failed:', error);
    deploymentStatus.error = error.message;
  }

  // Overall health percentage
  deploymentStatus.summary.healthPercentage = Math.round(
    (deploymentStatus.summary.healthyPlatforms / deploymentStatus.summary.totalPlatforms) * 100
  );

  return res.status(200).json(deploymentStatus);
}