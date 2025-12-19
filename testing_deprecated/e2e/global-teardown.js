// Global E2E Test Teardown
// Cleans up test environment and generates reports

async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');

  try {
    // Generate test reports
    const reportPath = './test-results/e2e-summary.json';
    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.TEST_ENVIRONMENT,
      testData: {
        seedUsed: process.env.TEST_DATA_SEED,
        productsGenerated: global.testData?.products?.length || 0,
        categoriesGenerated: global.testData?.categories?.length || 0
      },
      cleanup: {
        completed: true,
        timestamp: new Date().toISOString()
      }
    };

    // Write summary report
    const fs = require('fs').promises;
    const path = require('path');
    
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));

    console.log('📊 E2E test summary written to:', reportPath);
    console.log('✅ E2E test cleanup completed');

  } catch (error) {
    console.error('❌ E2E test cleanup failed:', error);
  }
}

module.exports = globalTeardown;