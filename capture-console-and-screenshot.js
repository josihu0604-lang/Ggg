const playwright = require('playwright');

const pages = [
  { path: '/map', name: 'map' },
  { path: '/feed', name: 'feed' },
  { path: '/wallet', name: 'wallet' },
  { path: '/profile', name: 'profile' },
  { path: '/notifications', name: 'notifications' },
  { path: '/settings', name: 'settings' }
];

const baseUrl = 'https://3008-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai';

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro size
    deviceScaleFactor: 3,
  });
  
  const page = await context.newPage();
  
  // Track 404 errors
  const errors = {};
  
  page.on('response', response => {
    if (response.status() === 404) {
      const url = response.url();
      const pageName = page.url().split('/').pop() || 'root';
      if (!errors[pageName]) errors[pageName] = [];
      errors[pageName].push(url);
    }
  });

  for (const pageConfig of pages) {
    try {
      console.log(`\n📸 Capturing ${pageConfig.name}...`);
      await page.goto(`${baseUrl}${pageConfig.path}`, { 
        waitUntil: 'networkidle',
        timeout: 45000 
      });
      
      // Wait for content to render
      await page.waitForTimeout(3000);
      
      // Take screenshot
      await page.screenshot({ 
        path: `console-check-${pageConfig.name}.png`,
        fullPage: true
      });
      
      console.log(`✅ ${pageConfig.name} screenshot saved`);
    } catch (error) {
      console.error(`❌ Error capturing ${pageConfig.name}:`, error.message);
    }
  }
  
  // Print 404 errors summary
  console.log('\n\n🔍 404 Errors Summary:');
  console.log('='.repeat(60));
  for (const [pageName, urls] of Object.entries(errors)) {
    console.log(`\n${pageName.toUpperCase()} (${urls.length} errors):`);
    urls.forEach(url => console.log(`  - ${url}`));
  }
  
  await browser.close();
  console.log('\n✅ All screenshots captured!');
})();
