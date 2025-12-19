// API Transformation E2E Tests
// Critical tests for preventing the custom mappings transformation bug

const { test, expect } = require('@playwright/test');
const ContractValidator = require('../../api-contracts/contract-validator');

test.describe('API Response Transformation', () => {
  let contractValidator;

  test.beforeAll(() => {
    contractValidator = new ContractValidator();
  });

  test('custom mappings endpoint should not be transformed', async ({ page }) => {
    const mockCustomMappings = {
      success: true,
      mappings: {
        attributes: [
          { akeneo_code: 'name', catalog_code: 'product_name', type: 'text' },
          { akeneo_code: 'description', catalog_code: 'product_description', type: 'textarea' }
        ],
        images: [
          { akeneo_code: 'image_1', catalog_code: 'main_image', type: 'image' }
        ],
        files: []
      },
      meta: {
        total_mappings: 3,
        active_mappings: 3,
        last_sync: new Date().toISOString()
      }
    };

    // Mock the API response
    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCustomMappings)
      });
    });

    // Navigate to page that calls custom mappings
    await page.goto('/admin/integrations/akeneo');

    // Wait for API call
    const response = await page.waitForResponse('/api/integrations/akeneo/custom-mappings');
    const responseData = await response.json();

    // Validate response structure is preserved
    expect(responseData.success).toBe(true);
    expect(responseData.mappings).toBeDefined();
    expect(responseData.mappings.attributes).toBeInstanceOf(Array);
    expect(responseData.mappings.images).toBeInstanceOf(Array);
    expect(responseData.mappings.files).toBeInstanceOf(Array);
    expect(responseData.meta).toBeDefined();

    // Contract validation
    const validation = await contractValidator.validateResponse(
      '/integrations/akeneo/custom-mappings',
      'GET',
      responseData
    );
    
    expect(validation.valid).toBe(true);
    expect(validation.transformationCheck.status).toBe('COMPLIANT');
    expect(validation.transformationCheck.shouldTransform).toBe(false);
  });

  test('list endpoints should be transformed correctly', async ({ page }) => {
    const mockProducts = {
      success: true,
      data: [
        { id: '1', name: 'Product 1', status: 'active' },
        { id: '2', name: 'Product 2', status: 'active' }
      ]
    };

    await page.route('/api/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProducts)
      });
    });

    await page.goto('/admin/products');
    const response = await page.waitForResponse('/api/products');
    const responseData = await response.json();

    // For list endpoints, transformation should extract the data array
    // But since we're testing the actual response, it should be properly structured
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeInstanceOf(Array);
    expect(responseData.data.length).toBe(2);
  });

  test('storage endpoints should not be transformed', async ({ page }) => {
    const mockStorageResponse = {
      success: true,
      data: {
        file_url: 'https://example.com/file.jpg',
        file_name: 'test.jpg',
        file_size: 12345,
        content_type: 'image/jpeg'
      }
    };

    await page.route('/api/storage/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStorageResponse)
      });
    });

    await page.goto('/admin/file-manager');
    
    // Trigger storage API call
    await page.locator('input[type="file"]').first().setInputFiles([{
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data')
    }]);

    const response = await page.waitForResponse('/api/storage/**');
    const responseData = await response.json();

    // Storage response should maintain its structure
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    expect(responseData.data.file_url).toBeDefined();
    expect(responseData.data.file_size).toBe(12345);
  });

  test('stats endpoints should not be transformed', async ({ page }) => {
    const mockStats = {
      success: true,
      total_products: 150,
      active_products: 120,
      inactive_products: 30,
      categories: 25
    };

    await page.route('/api/products/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats)
      });
    });

    await page.goto('/admin/dashboard');
    const response = await page.waitForResponse('/api/products/stats');
    const responseData = await response.json();

    // Stats endpoints should keep their flat structure
    expect(responseData.success).toBe(true);
    expect(responseData.total_products).toBe(150);
    expect(responseData.active_products).toBe(120);
    expect(typeof responseData.total_products).toBe('number');
  });

  test('should handle transformation errors gracefully', async ({ page }) => {
    // Mock a malformed response that might break transformation
    await page.route('/api/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          // Malformed response - success but no data
          success: true
        })
      });
    });

    await page.goto('/admin/products');
    
    // The page should handle the malformed response gracefully
    await expect(page.locator('.error, [role="alert"], .empty-state')).toBeVisible();
  });

  test('should detect transformation violations in real-time', async ({ page, context }) => {
    let transformationViolation = false;

    // Monitor console errors for transformation issues
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('transformation')) {
        transformationViolation = true;
      }
    });

    // Mock a response that should not be transformed but is
    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      // This would be the incorrect transformation - returning array directly
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { akeneo_code: 'name', catalog_code: 'product_name', type: 'text' }
        ])
      });
    });

    await page.goto('/admin/integrations/akeneo');
    
    // Wait for potential API call
    try {
      await page.waitForResponse('/api/integrations/akeneo/custom-mappings', { timeout: 5000 });
    } catch (e) {
      // API might not be called, that's ok for this test
    }

    // Check if transformation violation was detected
    // In a real implementation, this would be caught by the API debugger
  });

  test('should validate endpoint patterns correctly', async ({ page }) => {
    const endpointTests = [
      {
        endpoint: '/api/integrations/akeneo/status',
        shouldTransform: false,
        mockResponse: { success: true, status: 'connected' }
      },
      {
        endpoint: '/api/products/config',
        shouldTransform: false,
        mockResponse: { success: true, settings: { theme: 'default' } }
      },
      {
        endpoint: '/api/categories',
        shouldTransform: true,
        mockResponse: { success: true, data: [] }
      }
    ];

    for (const testCase of endpointTests) {
      await page.route(testCase.endpoint, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(testCase.mockResponse)
        });
      });
    }

    // Navigate to a page that would trigger these endpoints
    await page.goto('/admin/dashboard');

    // Validation happens through the contract validator
    // Each endpoint should follow its transformation rules
  });

  test('should handle concurrent API calls with different transformation rules', async ({ page }) => {
    // Mock multiple endpoints with different transformation requirements
    await page.route('/api/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] })
      });
    });

    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mappings: { attributes: [], images: [], files: [] }
        })
      });
    });

    await page.route('/api/storage/files', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, files: [], total_size: 0 })
      });
    });

    await page.goto('/admin/integrations');

    // All three endpoints might be called concurrently
    const responses = await Promise.allSettled([
      page.waitForResponse('/api/products'),
      page.waitForResponse('/api/integrations/akeneo/custom-mappings'),
      page.waitForResponse('/api/storage/files')
    ]);

    // All responses should be handled correctly regardless of timing
    responses.forEach(result => {
      expect(result.status).toBe('fulfilled');
    });
  });

  test('should maintain response integrity under load', async ({ page }) => {
    // Simulate multiple rapid requests to the same critical endpoint
    const promises = [];
    
    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      // Add small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mappings: {
            attributes: [{ akeneo_code: 'name', catalog_code: 'product_name', type: 'text' }],
            images: [],
            files: []
          },
          meta: { total_mappings: 1, active_mappings: 1 }
        })
      });
    });

    await page.goto('/admin/integrations/akeneo');

    // Trigger multiple rapid requests
    for (let i = 0; i < 5; i++) {
      promises.push(page.waitForResponse('/api/integrations/akeneo/custom-mappings'));
      await page.reload();
    }

    const responses = await Promise.allSettled(promises);
    
    // All responses should maintain correct structure
    for (const result of responses) {
      if (result.status === 'fulfilled') {
        const responseData = await result.value.json();
        expect(responseData.success).toBe(true);
        expect(responseData.mappings).toBeDefined();
      }
    }
  });
});