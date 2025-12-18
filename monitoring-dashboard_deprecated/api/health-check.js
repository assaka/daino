// Vercel API Route: Health Check Endpoint
// Monitors Render + Vercel + Supabase from Vercel deployment

export default async function handler(req, res) {
  // Enable CORS for dashboard access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const startTime = Date.now();
  const healthCheck = {
    timestamp: new Date().toISOString(),
    platforms: {},
    overallStatus: 'unknown',
    criticalIssues: [],
    checkDuration: 0
  };

  try {
    console.log('🔍 Running health check from Vercel...');

    // Get environment variables
    const renderUrl = process.env.RENDER_BACKEND_URL || 'https://backend.dainostore.com';
    const vercelUrl = process.env.VERCEL_FRONTEND_URL || 'https://www..dainostore.com';

    // Check Render Backend
    console.log('Checking Render backend...');
    const renderStart = Date.now();
    try {
      const renderResponse = await fetch(`${renderUrl}/health`, {
        method: 'GET',
        headers: { 'User-Agent': 'DainoStore-Monitor-Vercel' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      healthCheck.platforms.render = {
        healthy: renderResponse.ok,
        status: renderResponse.status,
        responseTime: Date.now() - renderStart,
        url: renderUrl
      };
    } catch (error) {
      healthCheck.platforms.render = {
        healthy: false,
        error: error.message,
        responseTime: Date.now() - renderStart,
        url: renderUrl
      };
    }

    // Check Custom Mappings Endpoint (the one that had the transformation bug!)
    console.log('Checking custom mappings endpoint...');
    try {
      const mappingsResponse = await fetch(`${renderUrl}/api/integrations/akeneo/custom-mappings`, {
        method: 'GET',
        headers: { 'User-Agent': 'DainoStore-Monitor-Vercel' },
        signal: AbortSignal.timeout(10000)
      });
      
      let transformationBugDetected = false;
      if (mappingsResponse.ok) {
        try {
          const data = await mappingsResponse.json();
          // Critical check: If response is array, the transformation bug is back!
          if (Array.isArray(data)) {
            transformationBugDetected = true;
            healthCheck.criticalIssues.push({
              severity: 'CRITICAL',
              issue: 'Transformation bug detected',
              description: 'Custom mappings endpoint returning array instead of object',
              endpoint: `${renderUrl}/api/integrations/akeneo/custom-mappings`
            });
          }
        } catch (parseError) {
          console.log('Could not parse custom mappings response');
        }
      }

      healthCheck.platforms.customMappings = {
        healthy: mappingsResponse.ok || mappingsResponse.status === 401,
        status: mappingsResponse.status,
        transformationBugDetected,
        protected: mappingsResponse.status === 401
      };
    } catch (error) {
      healthCheck.platforms.customMappings = {
        healthy: false,
        error: error.message
      };
    }

    // Check Vercel Frontend
    console.log('Checking Vercel frontend...');
    const vercelStart = Date.now();
    try {
      const vercelResponse = await fetch(vercelUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'DainoStore-Monitor-Vercel' },
        signal: AbortSignal.timeout(10000)
      });
      
      healthCheck.platforms.vercel = {
        healthy: vercelResponse.ok,
        status: vercelResponse.status,
        responseTime: Date.now() - vercelStart,
        url: vercelUrl
      };
    } catch (error) {
      healthCheck.platforms.vercel = {
        healthy: false,
        error: error.message,
        responseTime: Date.now() - vercelStart,
        url: vercelUrl
      };
    }

    // Test Database Connectivity (through backend)
    console.log('Testing database connectivity...');
    try {
      const dbTestResponse = await fetch(`${renderUrl}/api/products`, {
        method: 'GET',
        headers: { 'User-Agent': 'DainoStore-Monitor-Vercel' },
        signal: AbortSignal.timeout(15000) // Longer timeout for DB operations
      });
      
      healthCheck.platforms.database = {
        healthy: dbTestResponse.ok || dbTestResponse.status === 401,
        status: dbTestResponse.status,
        testEndpoint: '/api/products'
      };
    } catch (error) {
      healthCheck.platforms.database = {
        healthy: false,
        error: error.message
      };
    }

    // Determine overall status
    const renderOk = healthCheck.platforms.render?.healthy;
    const vercelOk = healthCheck.platforms.vercel?.healthy; 
    const dbOk = healthCheck.platforms.database?.healthy;
    const customMappingsOk = healthCheck.platforms.customMappings?.healthy;

    if (renderOk && vercelOk && dbOk && customMappingsOk) {
      healthCheck.overallStatus = 'healthy';
    } else if (!renderOk || !dbOk) {
      healthCheck.overallStatus = 'critical';
    } else {
      healthCheck.overallStatus = 'degraded';
    }

    // Add critical issues
    if (!renderOk) {
      healthCheck.criticalIssues.push({
        severity: 'CRITICAL',
        issue: 'Backend API unavailable',
        platform: 'render'
      });
    }

    if (!dbOk) {
      healthCheck.criticalIssues.push({
        severity: 'CRITICAL', 
        issue: 'Database connectivity issues',
        platform: 'supabase'
      });
    }

  } catch (error) {
    console.error('Health check failed:', error);
    healthCheck.error = error.message;
    healthCheck.overallStatus = 'error';
  }

  healthCheck.checkDuration = Date.now() - startTime;

  console.log('✅ Health check completed:', healthCheck.overallStatus);

  // Return appropriate HTTP status
  const httpStatus = healthCheck.overallStatus === 'healthy' ? 200 : 
                    healthCheck.overallStatus === 'degraded' ? 207 : 503;

  return res.status(httpStatus).json(healthCheck);
}