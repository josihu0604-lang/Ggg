const { chromium } = require('playwright');

async function captureAllPages() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone X size
    deviceScaleFactor: 2,
  });
  
  const pages = [
    { name: 'map', path: '/map' },
    { name: 'feed', path: '/feed' },
    { name: 'wallet', path: '/wallet' },
    { name: 'profile', path: '/profile' },
    { name: 'notifications', path: '/notifications' },
    { name: 'settings', path: '/settings' },
  ];
  
  const baseUrl = 'https://3007-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai';
  
  for (const page of pages) {
    console.log(`📸 Capturing ${page.name}...`);
    const browserPage = await context.newPage();
    
    try {
      await browserPage.goto(`${baseUrl}${page.path}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      await browserPage.waitForTimeout(2000); // Wait for any animations
      
      await browserPage.screenshot({ 
        path: `screenshot-${page.name}.png`,
        fullPage: true 
      });
      
      console.log(`✅ Saved screenshot-${page.name}.png`);
    } catch (error) {
      console.error(`❌ Error capturing ${page.name}:`, error.message);
    }
    
    await browserPage.close();
  }
  
  await browser.close();
  console.log('✅ All screenshots captured!');
}

captureAllPages();
