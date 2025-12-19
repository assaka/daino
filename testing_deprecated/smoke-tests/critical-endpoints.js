// Critical Endpoints Smoke Tests
// Quick validation of critical API endpoints during pre-commit

import axios from 'axios';

class CriticalEndpointsTest {
  constructor() {
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:5000';
    this.timeout = 5000;
    this.results = [];
  }

  async runTests() {
    console.log('🔥 Running critical endpoints smoke tests...');
    
    const criticalEndpoints = [
      {
        name: 'Health Check',
        method: 'GET',
        endpoint: '/health',
        expectedStatus: 200,
        skipAuth: true,
        critical: true
      },
      {
        name: 'Custom Mappings (Transformation Bug Prevention)',
        method: 'GET', 
        endpoint: '/api/integrations/akeneo/custom-mappings',
        expectedStatus: [200, 401], // 401 is ok for auth test
        validateStructure: true,
        transformationSensitive: true
      },
      {
        name: 'Storage Status',
        method: 'GET',
        endpoint: '/api/storage/status', 
        expectedStatus: [200, 401],
        transformationSensitive: true
      },
      {
        name: 'Products Stats',
        method: 'GET',
        endpoint: '/api/products/stats',
        expectedStatus: [200, 401],
        transformationSensitive: true
      }
    ];

    for (const test of criticalEndpoints) {
      await this.runSingleTest(test);
    }

    this.printResults();
    
    const criticalFailures = this.results.filter(r => r.failed && r.critical);
    if (criticalFailures.length > 0) {
      process.exit(1);
    }
  }

  async runSingleTest(test) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const config = {
        method: test.method,
        url: `${this.baseURL}${test.endpoint}`,
        timeout: this.timeout,
        validateStatus: () => true // Don't throw on any status
      };

      const response = await axios(config);
      const result = {
        name: test.name,
        endpoint: test.endpoint,
        status: response.status,
        failed: false,
        critical: test.critical,
        warnings: []
      };

      // Check expected status
      const expectedStatuses = Array.isArray(test.expectedStatus) ? 
                              test.expectedStatus : [test.expectedStatus];
      
      if (!expectedStatuses.includes(response.status)) {
        result.failed = true;
        result.error = `Expected status ${expectedStatuses}, got ${response.status}`;
      }

      // Validate response structure for transformation-sensitive endpoints
      if (test.transformationSensitive && response.status === 200) {
        const structureValidation = this.validateResponseStructure(response.data, test.endpoint);
        if (structureValidation.error) {
          result.failed = true;
          result.error = structureValidation.error;
        }
        result.warnings.push(...structureValidation.warnings);
      }

      this.results.push(result);
      
      if (result.failed) {
        console.log(`  ❌ Failed: ${result.error}`);
      } else {
        console.log(`  ✅ Passed`);
        if (result.warnings.length > 0) {
          result.warnings.forEach(warning => console.log(`    ⚠️  ${warning}`));
        }
      }

    } catch (error) {
      this.results.push({
        name: test.name,
        endpoint: test.endpoint,
        failed: true,
        critical: test.critical,
        error: `Request failed: ${error.message}`
      });
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }

  validateResponseStructure(data, endpoint) {
    const warnings = [];
    let error = null;

    // Custom mappings endpoint - critical transformation check
    if (endpoint.includes('/custom-mappings')) {
      if (Array.isArray(data)) {
        error = 'Custom mappings returned array - indicates incorrect transformation';
      } else if (data && typeof data === 'object') {
        if (!data.success) {
          warnings.push('Response missing success field');
        }
        if (!data.mappings) {
          warnings.push('Response missing mappings field');  
        }
        if (data.mappings && typeof data.mappings === 'object') {
          if (!data.mappings.attributes) {
            warnings.push('Mappings missing attributes array');
          }
          if (!data.mappings.images) {
            warnings.push('Mappings missing images array');
          }
          if (!data.mappings.files) {
            warnings.push('Mappings missing files array');
          }
        }
      }
    }

    // Storage endpoints - should not be transformed
    if (endpoint.includes('/storage/')) {
      if (Array.isArray(data)) {
        error = 'Storage endpoint returned array - indicates incorrect transformation';
      } else if (data && data.success && !data.data) {
        warnings.push('Storage response structure may be incorrect');
      }
    }

    // Stats endpoints - should maintain flat structure
    if (endpoint.includes('/stats')) {
      if (Array.isArray(data)) {
        error = 'Stats endpoint returned array - indicates incorrect transformation';
      } else if (data && data.success && data.data) {
        // Stats should be flat in the response, not wrapped in data
        warnings.push('Stats response may be over-wrapped');
      }
    }

    return { error, warnings };
  }

  printResults() {
    console.log('\n📋 Smoke Test Results:');
    
    const passed = this.results.filter(r => !r.failed).length;
    const failed = this.results.filter(r => r.failed).length;
    const criticalFailed = this.results.filter(r => r.failed && r.critical).length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (criticalFailed > 0) {
      console.log(`🚨 Critical Failures: ${criticalFailed}`);
    }

    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.results.filter(r => r.failed).forEach(result => {
        const criticality = result.critical ? '🚨 CRITICAL' : '⚠️  WARNING';
        console.log(`  ${criticality} ${result.name}: ${result.error}`);
      });
    }

    // Show transformation warnings
    const transformationWarnings = this.results
      .filter(r => r.warnings && r.warnings.length > 0)
      .flatMap(r => r.warnings.map(w => `${r.name}: ${w}`));

    if (transformationWarnings.length > 0) {
      console.log('\n🔄 Transformation Warnings:');
      transformationWarnings.forEach(warning => {
        console.log(`  ⚠️  ${warning}`);
      });
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CriticalEndpointsTest();
  tester.runTests().catch(error => {
    console.error('Smoke tests failed:', error);
    process.exit(1);
  });
}

export default CriticalEndpointsTest;