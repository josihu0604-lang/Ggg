const { chromium, devices } = require('@playwright/test');

const BASE_URL = 'https://3001-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai';

(async () => {
  const browser = await chromium.launch();
  
  console.log('🎨 Starting UI Capture...\n');

  // Desktop captures
  console.log('📱 Desktop Screenshots...');
  const desktopContext = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 }
  });
  const desktopPage = await desktopContext.newPage();

  const pages = [
    { url: '/feed', name: 'feed' },
    { url: '/map', name: 'map', wait: 3000 },
    { url: '/wallet', name: 'wallet' },
    { url: '/profile', name: 'profile' }
  ];

  for (const { url, name, wait = 1000 } of pages) {
    console.log(`  Capturing desktop-${name}...`);
    await desktopPage.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(wait);
    await desktopPage.screenshot({ 
      path: `screenshots/desktop-${name}.png`,
      fullPage: true 
    });
  }

  await desktopContext.close();

  // Mobile captures
  console.log('\n📱 Mobile Screenshots...');
  const mobileContext = await browser.newContext(devices['iPhone 14 Pro']);
  const mobilePage = await mobileContext.newPage();

  for (const { url, name, wait = 1000 } of pages) {
    console.log(`  Capturing mobile-${name}...`);
    await mobilePage.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(wait);
    await mobilePage.screenshot({ 
      path: `screenshots/mobile-${name}.png`,
      fullPage: true 
    });
  }

  // Test navigation flow
  console.log('\n🔄 Testing Navigation Flow...');
  await mobilePage.goto(`${BASE_URL}/feed`, { waitUntil: 'networkidle' });
  
  // Click through all navigation items
  await mobilePage.click('text=지도');
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: 'screenshots/nav-map.png' });
  
  await mobilePage.click('text=지갑');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: 'screenshots/nav-wallet.png' });
  
  await mobilePage.click('text=프로필');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: 'screenshots/nav-profile.png' });
  
  await mobilePage.click('text=홈');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: 'screenshots/nav-feed.png' });

  await mobileContext.close();

  console.log('\n✅ All screenshots captured!');
  console.log('📂 Screenshots saved to: /home/user/webapp/screenshots/\n');

  await browser.close();
  
  // List all captured files
  const fs = require('fs');
  const files = fs.readdirSync('screenshots').filter(f => f.endsWith('.png'));
  console.log('📸 Captured files:');
  files.forEach(f => console.log(`  - ${f}`));
  
  process.exit(0);
})();
