import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('bottom dock navigation works', async ({ page }) => {
    await page.goto('/map');
    
    // Check if bottom dock exists
    const bottomDock = page.locator('nav, div').filter({ hasText: /map|feed|wallet|profile/i }).first();
    await expect(bottomDock).toBeVisible({ timeout: 5000 });
  });

  test('navigate between main pages', async ({ page }) => {
    // Start at map
    await page.goto('/map');
    await expect(page).toHaveURL(/\/map/);
    
    // Navigate to feed
    await page.goto('/feed');
    await expect(page).toHaveURL(/\/feed/);
    
    // Navigate to wallet
    await page.goto('/wallet');
    await expect(page).toHaveURL(/\/wallet/);
    
    // Navigate to profile
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('pages load without errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    // Test each page
    const pages = ['/map', '/feed', '/wallet', '/profile'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
    }
    
    // Should have no uncaught errors
    expect(errors).toHaveLength(0);
  });
});

test.describe('Responsive Design', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    
    // Page should be responsive
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/map');
    
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
