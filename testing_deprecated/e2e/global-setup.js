// Global E2E Test Setup
// Prepares test environment and creates test data

const { chromium } = require('@playwright/test');
const ContractValidator = require('../api-contracts/contract-validator');
const TestDataGenerators = require('../api-contracts/test-data-generators');

async function globalSetup() {
  console.log('🚀 Setting up E2E test environment...');

  // Initialize test data generators
  const testDataGen = new TestDataGenerators();
  const contractValidator = new ContractValidator();

  // Create test database state
  await setupTestDatabase(testDataGen);
  
  // Warm up the application
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Visit main pages to warm up
    console.log('📱 Warming up application...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Warm up admin pages
    await page.goto('http://localhost:5173/admin/auth');
    await page.waitForTimeout(1000);

    console.log('✅ Application warmed up successfully');
  } catch (error) {
    console.warn('⚠️ Application warmup failed:', error.message);
  } finally {
    await browser.close();
  }

  // Store test configuration for tests
  process.env.TEST_DATA_SEED = '12345';
  process.env.TEST_ENVIRONMENT = 'e2e';

  console.log('✅ E2E test environment ready');
}

async function setupTestDatabase(testDataGen) {
  console.log('🗄️ Setting up test database...');
  
  try {
    // Generate test data
    const testStore = testDataGen.generateStore({
      slug: 'test-store',
      name: 'Test Store',
      status: 'active'
    });

    const testUser = testDataGen.generateUser({
      email: 'test@example.com',
      role: 'store_owner',
      account_type: 'agency',
      is_active: true,
      email_verified: true
    });

    const testProducts = Array.from({ length: 5 }, () => 
      testDataGen.generateProduct({ status: 'active', visibility: 'both' })
    );

    const testCategories = Array.from({ length: 3 }, () => 
      testDataGen.generateCategory({ is_active: true })
    );

    // Store test data for use in tests
    global.testData = {
      store: testStore,
      user: testUser,
      products: testProducts,
      categories: testCategories,
      customMappings: testDataGen.generateAkeneoCustomMappingResponse()
    };

    console.log('✅ Test data generated');
    console.log(`📊 Generated: ${testProducts.length} products, ${testCategories.length} categories`);

  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
}

module.exports = globalSetup;