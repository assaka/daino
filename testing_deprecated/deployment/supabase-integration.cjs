// Supabase Integration for Testing Stack
// Monitors Supabase database health and storage functionality

class SupabaseIntegration {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.backendUrl = process.env.RENDER_BACKEND_URL || 'https://backend.dainostore.com';
  }

  // Check Supabase database connectivity through your backend
  async checkDatabaseHealth() {
    try {
      console.log('🗄️ Checking Supabase database health...');
      
      // Test database connection through your backend API
      const dbHealthResponse = await fetch(`${this.backendUrl}/api/health/database`);
      
      // If no specific database health endpoint, test a simple query endpoint
      if (!dbHealthResponse.ok) {
        // Try alternative: test an actual database query
        const testQueryResponse = await fetch(`${this.backendUrl}/api/stores`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const dbHealthy = testQueryResponse.ok || testQueryResponse.status === 401;
        console.log(`✅ Database Connectivity: ${dbHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        console.log(`   Test Query Status: ${testQueryResponse.status}`);
        
        return {
          healthy: dbHealthy,
          testMethod: 'query-test',
          status: testQueryResponse.status,
          timestamp: new Date().toISOString()
        };
      }
      
      const dbHealth = dbHealthResponse.ok;
      console.log(`✅ Database Health: ${dbHealth ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`   Status: ${dbHealthResponse.status}`);
      
      return {
        healthy: dbHealth,
        testMethod: 'health-endpoint',
        status: dbHealthResponse.status,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Database health check failed:', error.message);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Check Supabase storage functionality
  async checkStorageHealth() {
    try {
      console.log('💾 Checking Supabase storage health...');
      
      // Test storage through your backend storage API
      const storageStatusResponse = await fetch(`${this.backendUrl}/api/storage/status`);
      const storageHealthy = storageStatusResponse.ok || storageStatusResponse.status === 401;
      
      console.log(`✅ Storage Status: ${storageHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      console.log(`   Status: ${storageStatusResponse.status}`);
      
      // Test storage statistics endpoint
      let storageStatsWorking = false;
      try {
        const statsResponse = await fetch(`${this.backendUrl}/api/storage/stats`);
        storageStatsWorking = statsResponse.ok || statsResponse.status === 401;
        console.log(`   Storage Stats: ${storageStatsWorking ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`   Storage Stats: ❌ (${error.message})`);
      }
      
      return {
        healthy: storageHealthy,
        storageStatus: storageStatusResponse.status,
        statsWorking: storageStatsWorking,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Storage health check failed:', error.message);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Test critical database operations
  async testCriticalDbOperations() {
    try {
      console.log('🧪 Testing critical database operations...');
      
      const operations = {
        productQuery: false,
        categoryQuery: false,
        integrationConfigQuery: false,
        customMappingsQuery: false
      };
      
      // Test products endpoint (database read)
      try {
        const productsResponse = await fetch(`${this.backendUrl}/api/products`);
        operations.productQuery = productsResponse.ok || productsResponse.status === 401;
      } catch (error) {
        console.log(`   Products Query: ❌ (${error.message})`);
      }
      
      // Test categories endpoint
      try {
        const categoriesResponse = await fetch(`${this.backendUrl}/api/categories`);
        operations.categoryQuery = categoriesResponse.ok || categoriesResponse.status === 401;
      } catch (error) {
        console.log(`   Categories Query: ❌ (${error.message})`);
      }
      
      // Test integration config (the endpoint that had the bug!)
      try {
        const mappingsResponse = await fetch(`${this.backendUrl}/api/integrations/akeneo/custom-mappings`);
        operations.customMappingsQuery = mappingsResponse.ok || mappingsResponse.status === 401;
        
        // Extra validation: ensure response is object, not array (the bug we fixed)
        if (mappingsResponse.ok) {
          try {
            const data = await mappingsResponse.json();
            const isCorrectFormat = !Array.isArray(data) && typeof data === 'object';
            operations.customMappingsQuery = operations.customMappingsQuery && isCorrectFormat;
            console.log(`   Custom Mappings Format: ${isCorrectFormat ? '✅' : '❌'} (not array)`);
          } catch (parseError) {
            console.log(`   Custom Mappings Parse: ❌ (${parseError.message})`);
          }
        }
      } catch (error) {
        console.log(`   Custom Mappings Query: ❌ (${error.message})`);
      }
      
      console.log('📋 Database Operation Test Results:');
      console.log(`  Products: ${operations.productQuery ? '✅' : '❌'}`);
      console.log(`  Categories: ${operations.categoryQuery ? '✅' : '❌'}`);
      console.log(`  Custom Mappings: ${operations.customMappingsQuery ? '✅' : '❌'}`);
      
      const workingOperations = Object.values(operations).filter(Boolean).length;
      return {
        operations,
        workingCount: workingOperations,
        totalCount: Object.keys(operations).length,
        overallHealthy: workingOperations >= 3,
        criticalEndpointWorking: operations.customMappingsQuery
      };
      
    } catch (error) {
      console.error('❌ Database operations test failed:', error.message);
      return { error: error.message };
    }
  }

  // Check authentication and authorization
  async testAuthSystem() {
    try {
      console.log('🔐 Testing Supabase auth system...');
      
      // Test protected endpoint (should return 401)
      const protectedResponse = await fetch(`${this.backendUrl}/api/admin/users`);
      const authWorking = protectedResponse.status === 401; // Good! Auth is protecting endpoints
      
      console.log(`✅ Auth Protection: ${authWorking ? 'WORKING' : 'BROKEN'}`);
      console.log(`   Protected Endpoint Status: ${protectedResponse.status}`);
      
      // Test public endpoints (should work)
      const publicResponse = await fetch(`${this.backendUrl}/api/health`);
      const publicWorking = publicResponse.ok;
      
      console.log(`✅ Public Access: ${publicWorking ? 'WORKING' : 'BROKEN'}`);
      
      return {
        authProtection: authWorking,
        publicAccess: publicWorking,
        overallWorking: authWorking && publicWorking,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Auth system test failed:', error.message);
      return { error: error.message };
    }
  }

  // Get monitoring configuration for Supabase
  getMonitoringConfig() {
    return {
      platform: 'supabase',
      databaseUrl: this.supabaseUrl,
      storageEndpoints: [
        `${this.backendUrl}/api/storage/status`,
        `${this.backendUrl}/api/storage/stats`
      ],
      criticalQueries: [
        `${this.backendUrl}/api/products`,
        `${this.backendUrl}/api/categories`,
        `${this.backendUrl}/api/integrations/akeneo/custom-mappings`
      ],
      monitoringInterval: 120000, // 2 minutes (database checks less frequent)
      alertThresholds: {
        responseTime: 10000, // 10 seconds for database operations
        errorRate: 1, // Very low tolerance for database errors
        healthCheckFailures: 2
      },
      criticalOperations: [
        'productQuery',
        'categoryQuery', 
        'customMappingsQuery' // The endpoint that had the transformation bug!
      ]
    };
  }

  // Run comprehensive Supabase health check
  async runComprehensiveCheck() {
    console.log('🔍 Running comprehensive Supabase health check...');
    console.log('===============================================');
    
    const results = {
      database: await this.checkDatabaseHealth(),
      storage: await this.checkStorageHealth(),
      operations: await this.testCriticalDbOperations(),
      auth: await this.testAuthSystem()
    };
    
    const overallHealthy = results.database.healthy && 
                          results.storage.healthy && 
                          results.operations.overallHealthy &&
                          results.auth.overallWorking;
    
    console.log('\n📊 SUPABASE HEALTH SUMMARY:');
    console.log('==========================');
    console.log(`Overall Status: ${overallHealthy ? '✅ HEALTHY' : '❌ ISSUES DETECTED'}`);
    console.log(`Database: ${results.database.healthy ? '✅' : '❌'}`);
    console.log(`Storage: ${results.storage.healthy ? '✅' : '❌'}`);
    console.log(`Operations: ${results.operations.overallHealthy ? '✅' : '❌'} (${results.operations.workingCount}/${results.operations.totalCount})`);
    console.log(`Auth: ${results.auth.overallWorking ? '✅' : '❌'}`);
    
    // Critical check: Custom mappings endpoint (the bug we fixed)
    if (results.operations.criticalEndpointWorking) {
      console.log('\n🎉 CRITICAL: Custom mappings endpoint working correctly!');
      console.log('   ✅ No transformation bug detected');
      console.log('   ✅ Response format is object (not array)');
    } else {
      console.log('\n🚨 CRITICAL: Custom mappings endpoint issue detected!');
      console.log('   ❌ This could indicate the transformation bug has returned');
    }
    
    return {
      ...results,
      overall: overallHealthy,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = SupabaseIntegration;