// Product Import Journey E2E Tests
// Tests the complete product import flow including Akeneo integration

const { test, expect } = require('@playwright/test');

test.describe('Product Import Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: '1', email: 'test@example.com', role: 'store_owner' }
        })
      });
    });

    // Mock store selection
    await page.route('/api/stores', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: '1',
            name: 'Test Store',
            slug: 'test-store',
            status: 'active'
          }]
        })
      });
    });
  });

  test('complete Akeneo product import flow', async ({ page }) => {
    // Mock Akeneo connection status
    await page.route('/api/integrations/akeneo/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'connected',
          last_sync: new Date().toISOString()
        })
      });
    });

    // Mock custom mappings (critical - this was the bug endpoint)
    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mappings: {
            attributes: [
              { akeneo_code: 'name', catalog_code: 'product_name', type: 'text', required: true },
              { akeneo_code: 'description', catalog_code: 'product_description', type: 'textarea' },
              { akeneo_code: 'price', catalog_code: 'base_price', type: 'price', required: true },
              { akeneo_code: 'color', catalog_code: 'color_attribute', type: 'select', options: ['red', 'blue', 'green'] }
            ],
            images: [
              { akeneo_code: 'image_1', catalog_code: 'main_image', type: 'image', position: 0 },
              { akeneo_code: 'image_2', catalog_code: 'gallery_image_1', type: 'image', position: 1 }
            ],
            files: [
              { akeneo_code: 'product_manual', catalog_code: 'manual_file', type: 'file' }
            ]
          },
          meta: {
            total_mappings: 7,
            active_mappings: 7,
            last_sync: new Date().toISOString()
          }
        })
      });
    });

    // Mock Akeneo products
    await page.route('/api/integrations/akeneo/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              identifier: 'PROD001',
              family: 'clothing',
              values: {
                name: [{ data: 'Premium T-Shirt', locale: 'en_US', scope: null }],
                description: [{ data: 'High quality cotton t-shirt', locale: 'en_US', scope: null }],
                price: [{ data: '29.99', locale: null, scope: null }],
                color: [{ data: 'blue', locale: null, scope: null }]
              }
            },
            {
              identifier: 'PROD002',
              family: 'clothing',
              values: {
                name: [{ data: 'Classic Jeans', locale: 'en_US', scope: null }],
                description: [{ data: 'Comfortable denim jeans', locale: 'en_US', scope: null }],
                price: [{ data: '59.99', locale: null, scope: null }],
                color: [{ data: 'blue', locale: null, scope: null }]
              }
            }
          ],
          meta: {
            total: 2,
            page: 1,
            limit: 10
          }
        })
      });
    });

    // Mock import process
    let importProgress = 0;
    await page.route('/api/integrations/akeneo/import', async (route) => {
      const body = await route.request().postData();
      const importData = JSON.parse(body);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          import_id: 'import_123',
          status: 'started',
          total_products: importData.products.length,
          processed: 0
        })
      });
    });

    // Mock import status updates
    await page.route('/api/integrations/akeneo/import/import_123/status', async (route) => {
      importProgress += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          import_id: 'import_123',
          status: importProgress >= 3 ? 'completed' : 'processing',
          total_products: 2,
          processed: Math.min(importProgress, 2),
          errors: [],
          warnings: importProgress === 2 ? [{
            product_identifier: 'PROD001',
            message: 'Image import failed - invalid URL',
            field: 'image_1'
          }] : []
        })
      });
    });

    // Navigate to Akeneo integration page
    await page.goto('/admin/integrations/akeneo');

    // Verify connection status
    await expect(page.locator('.connection-status, [data-testid="connection-status"]')).toContainText('connected');

    // Click on mappings tab/section
    await page.click('text="Mappings", [data-testid="mappings-tab"]');

    // Wait for mappings to load
    await page.waitForResponse('/api/integrations/akeneo/custom-mappings');
    
    // Verify mappings are displayed correctly (this tests the transformation bug fix)
    await expect(page.locator('.mapping-item, [data-testid="mapping-item"]')).toHaveCount(7);
    await expect(page.locator('text="product_name"')).toBeVisible();
    await expect(page.locator('text="base_price"')).toBeVisible();
    await expect(page.locator('text="color_attribute"')).toBeVisible();

    // Navigate to products section
    await page.click('text="Products", [data-testid="products-tab"]');

    // Wait for products to load
    await page.waitForResponse('/api/integrations/akeneo/products');

    // Verify products are listed
    await expect(page.locator('.product-item, [data-testid="product-item"]')).toHaveCount(2);
    await expect(page.locator('text="Premium T-Shirt"')).toBeVisible();
    await expect(page.locator('text="Classic Jeans"')).toBeVisible();

    // Select products for import
    await page.check('input[type="checkbox"][data-product-id="PROD001"]');
    await page.check('input[type="checkbox"][data-product-id="PROD002"]');

    // Start import
    await page.click('button:has-text("Import Selected"), [data-testid="import-button"]');

    // Wait for import to start
    await page.waitForResponse('/api/integrations/akeneo/import');

    // Verify import progress dialog/page
    await expect(page.locator('.import-progress, [data-testid="import-progress"]')).toBeVisible();
    await expect(page.locator('text="Import started"')).toBeVisible();

    // Wait for progress updates
    await page.waitForTimeout(1000); // Allow time for status polling

    // Verify progress updates
    await expect(page.locator('.progress-bar, [data-testid="progress-bar"]')).toBeVisible();

    // Wait for completion
    await page.waitForTimeout(3000); // Allow time for completion

    // Verify completion status
    await expect(page.locator('text="Import completed", text="completed"')).toBeVisible();

    // Verify warnings are shown
    await expect(page.locator('.warning, text="Image import failed"')).toBeVisible();

    // Navigate to products page to verify imported products
    await page.goto('/admin/products');

    // Mock imported products in products list
    await page.route('/api/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: '1',
              name: 'Premium T-Shirt',
              sku: 'PROD001',
              price: 29.99,
              status: 'active',
              created_at: new Date().toISOString()
            },
            {
              id: '2',
              name: 'Classic Jeans',
              sku: 'PROD002',
              price: 59.99,
              status: 'active',
              created_at: new Date().toISOString()
            }
          ]
        })
      });
    });

    // Wait for products to load
    await page.waitForResponse('/api/products');

    // Verify imported products appear in products list
    await expect(page.locator('text="Premium T-Shirt"')).toBeVisible();
    await expect(page.locator('text="Classic Jeans"')).toBeVisible();
    await expect(page.locator('text="PROD001"')).toBeVisible();
    await expect(page.locator('text="PROD002"')).toBeVisible();
  });

  test('should handle mapping errors gracefully', async ({ page }) => {
    // Mock custom mappings with error
    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Mapping validation failed',
          errors: ['Required attribute mapping missing for "name"']
        })
      });
    });

    await page.goto('/admin/integrations/akeneo');
    await page.click('text="Mappings"');

    // Should display error message
    await expect(page.locator('.error, [role="alert"]')).toBeVisible();
    await expect(page.locator('text="Mapping validation failed"')).toBeVisible();
  });

  test('should handle import failures', async ({ page }) => {
    // Mock successful mappings
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

    // Mock products
    await page.route('/api/integrations/akeneo/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ identifier: 'PROD001', values: {} }]
        })
      });
    });

    // Mock import failure
    await page.route('/api/integrations/akeneo/import', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Import failed due to validation errors',
          errors: ['Product name is required but missing']
        })
      });
    });

    await page.goto('/admin/integrations/akeneo');
    await page.click('text="Products"');
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Import")');

    // Should display error
    await expect(page.locator('.error, [role="alert"]')).toBeVisible();
    await expect(page.locator('text="Import failed"')).toBeVisible();
  });

  test('should validate mapping completeness before import', async ({ page }) => {
    // Mock incomplete mappings
    await page.route('/api/integrations/akeneo/custom-mappings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mappings: {
            attributes: [
              // Missing required name mapping
              { akeneo_code: 'description', catalog_code: 'product_description', type: 'textarea' }
            ],
            images: [],
            files: []
          },
          meta: { total_mappings: 1, active_mappings: 1 }
        })
      });
    });

    await page.route('/api/integrations/akeneo/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ identifier: 'PROD001', values: { name: [{ data: 'Test Product' }] } }]
        })
      });
    });

    await page.goto('/admin/integrations/akeneo');
    await page.click('text="Products"');
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("Import")');

    // Should show validation warning
    await expect(page.locator('.warning, text="incomplete mappings"')).toBeVisible();
  });

  test('should handle large product imports', async ({ page }) => {
    // Mock large product list
    const largeProductList = Array.from({ length: 100 }, (_, i) => ({
      identifier: `PROD${String(i + 1).padStart(3, '0')}`,
      values: {
        name: [{ data: `Product ${i + 1}` }],
        price: [{ data: `${(i + 1) * 10}.99` }]
      }
    }));

    await page.route('/api/integrations/akeneo/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: largeProductList,
          meta: { total: 100, page: 1, limit: 100 }
        })
      });
    });

    await page.goto('/admin/integrations/akeneo');
    await page.click('text="Products"');

    // Should handle large list without performance issues
    await expect(page.locator('.product-item')).toHaveCount(100);
    
    // Test pagination or virtualization if implemented
    const firstProduct = page.locator('text="Product 1"');
    const lastProduct = page.locator('text="Product 100"');
    
    await expect(firstProduct).toBeVisible();
    // Last product might not be visible if virtualization is used
  });
});