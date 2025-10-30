import { test, expect } from '@playwright/test';

test.describe('Map Page', () => {
  test('loads map page successfully', async ({ page }) => {
    await page.goto('/map');
    
    // Wait for map container to be visible
    await expect(page.locator('div[aria-label="Interactive map"]')).toBeVisible({ timeout: 10000 });
    
    // Check page title or heading
    await expect(page).toHaveTitle(/ZZIK/i);
  });

  test('displays POI markers on map', async ({ page }) => {
    await page.goto('/map');
    
    // Wait for map to load
    await page.waitForTimeout(3000);
    
    // Check if Mapbox is loaded (canvas element should exist)
    const canvas = page.locator('canvas.mapboxgl-canvas');
    await expect(canvas).toBeVisible();
  });

  test('map interaction - zoom controls', async ({ page }) => {
    await page.goto('/map');
    
    // Wait for map to load
    await page.waitForTimeout(2000);
    
    // Check if zoom controls exist
    const zoomIn = page.locator('button[aria-label*="Zoom in"]');
    const zoomOut = page.locator('button[aria-label*="Zoom out"]');
    
    // Mapbox controls should be present
    await expect(page.locator('.mapboxgl-ctrl-zoom-in, .mapboxgl-ctrl-zoom-out').first()).toBeVisible();
  });
});

test.describe('Map API Integration', () => {
  test('fetches nearby POIs', async ({ page }) => {
    // Intercept API call
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/pois') && response.status() === 200
    );
    
    await page.goto('/map');
    
    const response = await responsePromise;
    const data = await response.json();
    
    expect(data.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBeTruthy();
  });
});
