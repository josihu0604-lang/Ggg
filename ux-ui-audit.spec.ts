import { test, expect, devices } from '@playwright/test';

const BASE_URL = 'https://3001-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai';

test.describe('UX/UI Complete Audit', () => {
  // Desktop viewport
  test.use({ ...devices['Desktop Chrome'] });

  test('Homepage (Feed) - Desktop', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/desktop-feed.png',
      fullPage: true 
    });
    
    // Check key elements
    expect(await page.locator('h1').textContent()).toContain('홈 피드');
    expect(await page.locator('.liquid-glass-offer').count()).toBeGreaterThan(0);
    expect(await page.locator('.icon-btn').count()).toBe(4);
  });

  test('Map Page - Desktop', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await page.waitForTimeout(3000); // Wait for map to load
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/desktop-map.png',
      fullPage: true 
    });
    
    // Check map canvas exists
    const canvas = page.locator('canvas.mapboxgl-canvas');
    await expect(canvas).toBeVisible();
  });

  test('Wallet Page - Desktop', async ({ page }) => {
    await page.goto(`${BASE_URL}/wallet`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/desktop-wallet.png',
      fullPage: true 
    });
    
    expect(await page.locator('h1').textContent()).toContain('지갑');
    expect(await page.locator('text=0 PTS').count()).toBeGreaterThan(0);
  });

  test('Profile Page - Desktop', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/desktop-profile.png',
      fullPage: true 
    });
    
    expect(await page.locator('h1').textContent()).toContain('프로필');
    expect(await page.locator('text=총 체크인').count()).toBeGreaterThan(0);
  });
});

test.describe('Mobile UX/UI Audit', () => {
  // Mobile viewport
  test.use({ ...devices['iPhone 14 Pro'] });

  test('Homepage (Feed) - Mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/mobile-feed.png',
      fullPage: true 
    });
    
    // Check responsive elements
    const bottomDock = page.locator('nav');
    await expect(bottomDock).toBeVisible();
  });

  test('Map Page - Mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/mobile-map.png',
      fullPage: true 
    });
  });

  test('Wallet Page - Mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/wallet`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/mobile-wallet.png',
      fullPage: true 
    });
  });

  test('Profile Page - Mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/mobile-profile.png',
      fullPage: true 
    });
  });
});

test.describe('Navigation Flow Audit', () => {
  test('Bottom navigation works correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    
    // Test navigation to Map
    await page.click('text=지도');
    await expect(page).toHaveURL(/\/map/);
    await page.waitForTimeout(2000);
    
    // Test navigation to Wallet
    await page.click('text=지갑');
    await expect(page).toHaveURL(/\/wallet/);
    
    // Test navigation to Profile
    await page.click('text=프로필');
    await expect(page).toHaveURL(/\/profile/);
    
    // Test navigation back to Feed
    await page.click('text=홈');
    await expect(page).toHaveURL(/\/feed/);
    
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/navigation-test.png',
      fullPage: true 
    });
  });

  test('Active state indication', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await page.waitForLoadState('networkidle');
    
    // Check active state on map button
    const mapButton = page.locator('text=지도').locator('..');
    await expect(mapButton).toHaveAttribute('data-active', 'true');
  });
});

test.describe('Design System Audit', () => {
  test('Liquid Glass effect applied', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    
    // Check for liquid glass classes
    const glassElements = await page.locator('.liquid-glass-offer').count();
    expect(glassElements).toBeGreaterThan(0);
  });

  test('Animations working', async ({ page }) => {
    await page.goto(`${BASE_URL}/wallet`);
    await page.waitForLoadState('networkidle');
    
    // Check for animation class
    const animated = page.locator('.animate-liquid-appear');
    await expect(animated).toBeVisible();
  });

  test('Dark mode active', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    
    // Check body background
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Should be dark (not white)
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });
});

test.describe('Accessibility Audit', () => {
  test('ARIA labels present', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    
    // Check for aria-current on active nav item
    const activeLink = page.locator('[aria-current="page"]');
    await expect(activeLink).toBeVisible();
  });

  test('Interactive elements keyboard accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/feed`);
    await page.waitForLoadState('networkidle');
    
    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Take screenshot showing focus state
    await page.screenshot({ 
      path: '/home/user/webapp/screenshots/accessibility-keyboard.png',
      fullPage: true 
    });
  });
});
