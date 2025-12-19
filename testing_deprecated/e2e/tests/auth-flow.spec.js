// Authentication Flow E2E Tests
// Tests login, logout, role switching, and session management

const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start with fresh session
    await page.context().clearCookies();
    await page.goto('/admin/auth');
  });

  test('should display login form', async ({ page }) => {
    await expect(page).toHaveTitle(/DainoStore/);
    
    // Check login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check form labels
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Password')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Check for validation messages
    await expect(page.locator('.error, .text-red-500, [role="alert"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for error response
    await page.waitForResponse(response => 
      response.url().includes('/api/auth/login') && response.status() >= 400
    );
    
    // Check error message appears
    await expect(page.locator('.error, .text-red-500, [role="alert"]')).toBeVisible();
  });

  test('should handle successful login flow', async ({ page }) => {
    // Mock successful login response
    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: '1',
            email: 'test@example.com',
            role: 'store_owner',
            account_type: 'agency'
          },
          token: 'mock-jwt-token'
        })
      });
    });

    // Fill valid credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/admin\/(dashboard|stores)/);
    
    // Verify logged in state
    await expect(page.locator('[data-testid="user-menu"], .user-avatar')).toBeVisible();
  });

  test('should handle logout flow', async ({ page }) => {
    // Mock login first
    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: '1', email: 'test@example.com', role: 'store_owner' },
          token: 'mock-jwt-token'
        })
      });
    });

    // Mock logout
    await page.route('/api/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Logged out successfully' })
      });
    });

    // Login first
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/);

    // Find and click logout button
    await page.locator('[data-testid="user-menu"], .user-avatar').click();
    await page.locator('[data-testid="logout-button"], button:has-text("Logout")').click();

    // Verify redirected to login
    await page.waitForURL(/\/admin\/auth/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should handle session timeout', async ({ page }) => {
    // Mock expired token response
    await page.route('/api/**', async (route) => {
      if (route.request().headers().authorization) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Token expired'
          })
        });
      } else {
        await route.continue();
      }
    });

    // Try to access protected page
    await page.goto('/admin/dashboard');
    
    // Should redirect to login
    await page.waitForURL(/\/admin\/auth/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should persist login state across page refreshes', async ({ page }) => {
    // Mock successful login
    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: '1', email: 'test@example.com', role: 'store_owner' },
          token: 'mock-jwt-token'
        })
      });
    });

    // Mock user verification
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

    // Login
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/);

    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('[data-testid="user-menu"], .user-avatar')).toBeVisible();
  });

  test('should handle role-based redirects', async ({ page }) => {
    // Mock customer login
    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: '1', email: 'customer@example.com', role: 'customer' },
          token: 'mock-customer-token'
        })
      });
    });

    await page.fill('input[type="email"]', 'customer@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Customer should be redirected to storefront or customer dashboard
    await page.waitForURL(/\/(public|customer|storefront)/);
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show validation error
    const emailInput = page.locator('input[type="email"]');
    const validationMessage = await emailInput.getAttribute('validationMessage');
    expect(validationMessage).toBeTruthy();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('/api/auth/login', async (route) => {
      await route.abort('failed');
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show network error message
    await expect(page.locator('.error, .text-red-500, [role="alert"]')).toBeVisible();
    await expect(page.locator(':text("Network error"), :text("Unable to connect")')).toBeVisible();
  });

  test('should prevent multiple simultaneous login requests', async ({ page }) => {
    let requestCount = 0;
    
    await page.route('/api/auth/login', async (route) => {
      requestCount++;
      // Delay response to test race condition
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: '1', email: 'test@example.com', role: 'store_owner' },
          token: 'mock-jwt-token'
        })
      });
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Click submit button multiple times quickly
    await Promise.all([
      page.click('button[type="submit"]'),
      page.click('button[type="submit"]'),
      page.click('button[type="submit"]')
    ]);

    await page.waitForURL(/\/admin/);
    
    // Should only make one request
    expect(requestCount).toBe(1);
  });
});