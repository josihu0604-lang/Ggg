/**
 * Comprehensive Error Detection Script
 * Systematically detects and catalogs all errors across the ZZIK application
 */

const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://3002-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai';

// Pages to test
const PAGES = [
  { name: 'Feed', path: '/feed', description: 'Home feed page' },
  { name: 'Map', path: '/map', description: 'Interactive map page' },
  { name: 'Wallet', path: '/wallet', description: 'Digital wallet page' },
  { name: 'Profile', path: '/profile', description: 'User profile page' },
  { name: 'Root', path: '/', description: 'Root redirect page' },
  { name: 'Settings', path: '/settings', description: 'Settings page' },
  { name: 'Notifications', path: '/notifications', description: 'Notifications page' },
];

// Error categories
const ERROR_CATEGORIES = {
  CONSOLE_ERROR: 'Console Error',
  CONSOLE_WARN: 'Console Warning',
  NETWORK_ERROR: 'Network Error',
  CSS_ERROR: 'CSS/Style Error',
  JS_ERROR: 'JavaScript Error',
  REACT_ERROR: 'React Error',
  HYDRATION_ERROR: 'Hydration Mismatch',
  ACCESSIBILITY: 'Accessibility Issue',
  PERFORMANCE: 'Performance Warning',
  SECURITY: 'Security Issue',
  RESOURCE_404: '404 Resource Not Found',
  CORS_ERROR: 'CORS Error',
};

// Error severity levels
const SEVERITY = {
  CRITICAL: 'CRITICAL', // Blocks functionality
  HIGH: 'HIGH',         // Major UX/visual issue
  MEDIUM: 'MEDIUM',     // Noticeable but not blocking
  LOW: 'LOW',           // Minor cosmetic issue
};

class ErrorDetector {
  constructor() {
    this.errors = [];
    this.errorId = 1;
  }

  addError(error) {
    this.errors.push({
      id: this.errorId++,
      ...error,
      timestamp: new Date().toISOString(),
    });
  }

  async detectErrorsForPage(page, pageInfo, viewport) {
    const pageErrors = [];
    const consoleMessages = [];
    const networkErrors = [];
    const failedRequests = [];

    // Console message listener
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text, location: msg.location() });

      if (type === 'error') {
        this.addError({
          category: ERROR_CATEGORIES.CONSOLE_ERROR,
          severity: this.classifyConsoleSeverity(text),
          page: pageInfo.name,
          viewport,
          message: text,
          location: msg.location(),
          details: `Console error detected: ${text}`,
        });
      } else if (type === 'warning') {
        this.addError({
          category: ERROR_CATEGORIES.CONSOLE_WARN,
          severity: SEVERITY.MEDIUM,
          page: pageInfo.name,
          viewport,
          message: text,
          location: msg.location(),
          details: `Console warning: ${text}`,
        });
      }
    });

    // Page error listener
    page.on('pageerror', error => {
      this.addError({
        category: ERROR_CATEGORIES.JS_ERROR,
        severity: SEVERITY.CRITICAL,
        page: pageInfo.name,
        viewport,
        message: error.message,
        stack: error.stack,
        details: `JavaScript error: ${error.message}`,
      });
    });

    // Request failed listener
    page.on('requestfailed', request => {
      const failure = request.failure();
      networkErrors.push({ url: request.url(), failure });

      this.addError({
        category: this.classifyNetworkError(request.url(), failure),
        severity: SEVERITY.HIGH,
        page: pageInfo.name,
        viewport,
        message: `Request failed: ${request.url()}`,
        details: `${failure?.errorText || 'Unknown error'}`,
        url: request.url(),
      });
    });

    // Response listener for failed requests
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });

        const category = response.status() === 404 
          ? ERROR_CATEGORIES.RESOURCE_404 
          : ERROR_CATEGORIES.NETWORK_ERROR;

        this.addError({
          category,
          severity: response.status() >= 500 ? SEVERITY.CRITICAL : SEVERITY.HIGH,
          page: pageInfo.name,
          viewport,
          message: `HTTP ${response.status()}: ${response.url()}`,
          details: `${response.statusText()} - ${response.url()}`,
          url: response.url(),
          statusCode: response.status(),
        });
      }
    });

    try {
      console.log(`\n[${viewport}] Testing ${pageInfo.name} (${pageInfo.path})...`);
      
      // Navigate to page
      const response = await page.goto(`${BASE_URL}${pageInfo.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Check for navigation errors
      if (!response || !response.ok()) {
        this.addError({
          category: ERROR_CATEGORIES.NETWORK_ERROR,
          severity: SEVERITY.CRITICAL,
          page: pageInfo.name,
          viewport,
          message: `Page failed to load: ${response?.status() || 'No response'}`,
          details: `Navigation error for ${pageInfo.path}`,
          statusCode: response?.status(),
        });
      }

      // Wait for any dynamic content
      await page.waitForTimeout(3000);

      // Check for React hydration errors
      await this.checkHydrationErrors(page, pageInfo, viewport);

      // Check for CSS issues
      await this.checkCSSIssues(page, pageInfo, viewport);

      // Check for accessibility issues
      await this.checkAccessibility(page, pageInfo, viewport);

      // Check for performance issues
      await this.checkPerformance(page, pageInfo, viewport);

      // Check for broken images
      await this.checkBrokenImages(page, pageInfo, viewport);

      // Check for missing elements
      await this.checkMissingElements(page, pageInfo, viewport);

    } catch (error) {
      this.addError({
        category: ERROR_CATEGORIES.JS_ERROR,
        severity: SEVERITY.CRITICAL,
        page: pageInfo.name,
        viewport,
        message: error.message,
        stack: error.stack,
        details: `Page test failed: ${error.message}`,
      });
    }

    return { consoleMessages, networkErrors, failedRequests };
  }

  async checkHydrationErrors(page, pageInfo, viewport) {
    // Check for common hydration error patterns
    const bodyHTML = await page.evaluate(() => document.body.outerHTML);
    
    // React hydration errors often show in console or as mismatched content
    if (bodyHTML.includes('Hydration failed') || bodyHTML.includes('did not match')) {
      this.addError({
        category: ERROR_CATEGORIES.HYDRATION_ERROR,
        severity: SEVERITY.HIGH,
        page: pageInfo.name,
        viewport,
        message: 'React hydration mismatch detected',
        details: 'Server-rendered HTML does not match client-side React',
      });
    }
  }

  async checkCSSIssues(page, pageInfo, viewport) {
    // Check for elements with no computed styles
    const unstyledElements = await page.evaluate(() => {
      const issues = [];
      const elements = document.querySelectorAll('*');
      
      for (let i = 0; i < Math.min(elements.length, 100); i++) {
        const el = elements[i];
        const styles = window.getComputedStyle(el);
        
        // Check for visibility issues
        if (styles.display === 'none' && el.textContent?.trim()) {
          // Element has content but is hidden
          continue; // This might be intentional
        }

        // Check for broken layout
        if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.children.length === 0 && el.textContent?.trim()) {
          issues.push({
            tag: el.tagName,
            classes: el.className,
            id: el.id,
            issue: 'Element has no dimensions',
          });
        }

        // Check for missing styles
        if (styles.cssText === '') {
          issues.push({
            tag: el.tagName,
            classes: el.className,
            id: el.id,
            issue: 'No computed styles',
          });
        }
      }
      
      return issues.slice(0, 10); // Limit to first 10
    });

    unstyledElements.forEach(issue => {
      this.addError({
        category: ERROR_CATEGORIES.CSS_ERROR,
        severity: SEVERITY.MEDIUM,
        page: pageInfo.name,
        viewport,
        message: `CSS issue: ${issue.issue}`,
        details: `Element: ${issue.tag}${issue.id ? '#' + issue.id : ''}${issue.classes ? '.' + issue.classes.split(' ').join('.') : ''}`,
      });
    });

    // Check for broken backdrop-filter (Liquid Glass)
    const backdropFilterSupport = await page.evaluate(() => {
      const testEl = document.createElement('div');
      testEl.style.backdropFilter = 'blur(10px)';
      return testEl.style.backdropFilter !== '';
    });

    if (!backdropFilterSupport) {
      this.addError({
        category: ERROR_CATEGORIES.CSS_ERROR,
        severity: SEVERITY.HIGH,
        page: pageInfo.name,
        viewport,
        message: 'backdrop-filter not supported',
        details: 'Liquid Glass design system may not render correctly',
      });
    }

    // Check for overlapping elements (z-index issues)
    const zIndexIssues = await page.evaluate(() => {
      const issues = [];
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (let i = 0; i < Math.min(elements.length, 50); i++) {
        const el = elements[i];
        const styles = window.getComputedStyle(el);
        const zIndex = parseInt(styles.zIndex);
        
        if (zIndex > 9999) {
          issues.push({
            tag: el.tagName,
            classes: el.className,
            zIndex,
            issue: 'Extremely high z-index',
          });
        }
      }
      
      return issues;
    });

    zIndexIssues.forEach(issue => {
      this.addError({
        category: ERROR_CATEGORIES.CSS_ERROR,
        severity: SEVERITY.LOW,
        page: pageInfo.name,
        viewport,
        message: `Z-index issue: ${issue.issue}`,
        details: `Element: ${issue.tag} with z-index ${issue.zIndex}`,
      });
    });
  }

  async checkAccessibility(page, pageInfo, viewport) {
    // Check for missing alt text on images
    const missingAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.alt).length;
    });

    if (missingAlt > 0) {
      this.addError({
        category: ERROR_CATEGORIES.ACCESSIBILITY,
        severity: SEVERITY.MEDIUM,
        page: pageInfo.name,
        viewport,
        message: `${missingAlt} images missing alt text`,
        details: 'Images without alt text harm accessibility',
      });
    }

    // Check for buttons without accessible names
    const unnamedButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.filter(btn => {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        return !text && !ariaLabel;
      }).length;
    });

    if (unnamedButtons > 0) {
      this.addError({
        category: ERROR_CATEGORIES.ACCESSIBILITY,
        severity: SEVERITY.HIGH,
        page: pageInfo.name,
        viewport,
        message: `${unnamedButtons} buttons without accessible names`,
        details: 'Buttons need text content or aria-label',
      });
    }

    // Check for form inputs without labels
    const unlabeledInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.filter(input => {
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        return !hasLabel && !ariaLabel && input.type !== 'hidden';
      }).length;
    });

    if (unlabeledInputs > 0) {
      this.addError({
        category: ERROR_CATEGORIES.ACCESSIBILITY,
        severity: SEVERITY.MEDIUM,
        page: pageInfo.name,
        viewport,
        message: `${unlabeledInputs} form inputs without labels`,
        details: 'Form inputs need associated labels or aria-label',
      });
    }
  }

  async checkPerformance(page, pageInfo, viewport) {
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: perf?.domContentLoadedEventEnd - perf?.domContentLoadedEventStart,
        loadComplete: perf?.loadEventEnd - perf?.loadEventStart,
        totalSize: performance.getEntriesByType('resource').reduce((acc, r) => acc + (r.transferSize || 0), 0),
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });

    if (metrics.domContentLoaded > 3000) {
      this.addError({
        category: ERROR_CATEGORIES.PERFORMANCE,
        severity: SEVERITY.MEDIUM,
        page: pageInfo.name,
        viewport,
        message: `Slow DOM Content Loaded: ${Math.round(metrics.domContentLoaded)}ms`,
        details: 'DOM took longer than 3 seconds to load',
      });
    }

    if (metrics.totalSize > 5 * 1024 * 1024) {
      this.addError({
        category: ERROR_CATEGORIES.PERFORMANCE,
        severity: SEVERITY.MEDIUM,
        page: pageInfo.name,
        viewport,
        message: `Large page size: ${(metrics.totalSize / 1024 / 1024).toFixed(2)}MB`,
        details: `Page loads ${metrics.resourceCount} resources`,
      });
    }
  }

  async checkBrokenImages(page, pageInfo, viewport) {
    const brokenImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.complete || img.naturalHeight === 0).map(img => ({
        src: img.src,
        alt: img.alt,
      }));
    });

    brokenImages.forEach(img => {
      this.addError({
        category: ERROR_CATEGORIES.RESOURCE_404,
        severity: SEVERITY.HIGH,
        page: pageInfo.name,
        viewport,
        message: `Broken image: ${img.src}`,
        details: `Image failed to load${img.alt ? ` (alt: ${img.alt})` : ''}`,
        url: img.src,
      });
    });
  }

  async checkMissingElements(page, pageInfo, viewport) {
    // Check for expected elements based on page
    const expectedElements = {
      Feed: ['nav', 'main', '[role="navigation"]'],
      Map: ['nav', '[aria-label*="map" i], [aria-label*="Map" i]'],
      Wallet: ['nav', 'main'],
      Profile: ['nav', 'main', 'img, svg'], // Profile picture
    };

    const expected = expectedElements[pageInfo.name] || [];
    
    for (const selector of expected) {
      const exists = await page.locator(selector).count() > 0;
      if (!exists) {
        this.addError({
          category: ERROR_CATEGORIES.CSS_ERROR,
          severity: SEVERITY.HIGH,
          page: pageInfo.name,
          viewport,
          message: `Missing expected element: ${selector}`,
          details: `Page should contain element matching ${selector}`,
        });
      }
    }
  }

  classifyConsoleSeverity(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('failed') || lowerMsg.includes('error') || lowerMsg.includes('exception')) {
      return SEVERITY.CRITICAL;
    }
    if (lowerMsg.includes('warning') || lowerMsg.includes('deprecated')) {
      return SEVERITY.MEDIUM;
    }
    return SEVERITY.HIGH;
  }

  classifyNetworkError(url, failure) {
    if (failure?.errorText?.includes('CORS')) {
      return ERROR_CATEGORIES.CORS_ERROR;
    }
    if (url.includes('/api/')) {
      return ERROR_CATEGORIES.NETWORK_ERROR;
    }
    return ERROR_CATEGORIES.RESOURCE_404;
  }

  generateReport() {
    const report = {
      summary: {
        totalErrors: this.errors.length,
        bySeverity: {
          critical: this.errors.filter(e => e.severity === SEVERITY.CRITICAL).length,
          high: this.errors.filter(e => e.severity === SEVERITY.HIGH).length,
          medium: this.errors.filter(e => e.severity === SEVERITY.MEDIUM).length,
          low: this.errors.filter(e => e.severity === SEVERITY.LOW).length,
        },
        byCategory: {},
        byPage: {},
      },
      errors: this.errors,
    };

    // Count by category
    Object.values(ERROR_CATEGORIES).forEach(cat => {
      report.summary.byCategory[cat] = this.errors.filter(e => e.category === cat).length;
    });

    // Count by page
    PAGES.forEach(page => {
      report.summary.byPage[page.name] = this.errors.filter(e => e.page === page.name).length;
    });

    return report;
  }
}

async function main() {
  console.log('🔍 Starting comprehensive error detection...\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Pages to test: ${PAGES.length}`);
  console.log(`Viewports: Desktop (1920x1080) + Mobile (390x844)\n`);

  const detector = new ErrorDetector();
  const browser = await chromium.launch({ headless: true });

  // Test desktop viewport
  console.log('\n=== DESKTOP VIEWPORT (1920x1080) ===');
  const desktopContext = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
  });
  const desktopPage = await desktopContext.newPage();

  for (const pageInfo of PAGES) {
    await detector.detectErrorsForPage(desktopPage, pageInfo, 'desktop');
  }

  await desktopContext.close();

  // Test mobile viewport
  console.log('\n=== MOBILE VIEWPORT (iPhone 12) ===');
  const mobileContext = await browser.newContext({
    ...devices['iPhone 12'],
  });
  const mobilePage = await mobileContext.newPage();

  for (const pageInfo of PAGES) {
    await detector.detectErrorsForPage(mobilePage, pageInfo, 'mobile');
  }

  await mobileContext.close();
  await browser.close();

  // Generate report
  const report = detector.generateReport();
  
  console.log('\n\n=== ERROR DETECTION SUMMARY ===');
  console.log(`Total errors detected: ${report.summary.totalErrors}`);
  console.log('\nBy Severity:');
  console.log(`  🔴 CRITICAL: ${report.summary.bySeverity.critical}`);
  console.log(`  🟠 HIGH: ${report.summary.bySeverity.high}`);
  console.log(`  🟡 MEDIUM: ${report.summary.bySeverity.medium}`);
  console.log(`  🟢 LOW: ${report.summary.bySeverity.low}`);
  
  console.log('\nBy Category:');
  Object.entries(report.summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      if (count > 0) console.log(`  ${cat}: ${count}`);
    });

  console.log('\nBy Page:');
  Object.entries(report.summary.byPage)
    .sort((a, b) => b[1] - a[1])
    .forEach(([page, count]) => {
      if (count > 0) console.log(`  ${page}: ${count}`);
    });

  // Save detailed report
  const reportPath = path.join(__dirname, 'ERROR_CATALOG.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Detailed report saved to: ${reportPath}`);

  // Generate markdown report
  await generateMarkdownReport(report);

  console.log('\n🎉 Error detection complete!');
  process.exit(0);
}

async function generateMarkdownReport(report) {
  const lines = [];
  
  lines.push('# 🐛 ZZIK Error Catalog');
  lines.push('');
  lines.push('**Comprehensive error detection report**');
  lines.push('');
  lines.push(`- **Generated**: ${new Date().toISOString()}`);
  lines.push(`- **Total Errors**: ${report.summary.totalErrors}`);
  lines.push(`- **Pages Tested**: ${PAGES.length} (Desktop + Mobile)`);
  lines.push('');
  
  lines.push('## 📊 Executive Summary');
  lines.push('');
  lines.push('### By Severity');
  lines.push('');
  lines.push('| Severity | Count | Impact |');
  lines.push('|----------|-------|--------|');
  lines.push(`| 🔴 CRITICAL | ${report.summary.bySeverity.critical} | Blocks core functionality |`);
  lines.push(`| 🟠 HIGH | ${report.summary.bySeverity.high} | Major UX/visual issues |`);
  lines.push(`| 🟡 MEDIUM | ${report.summary.bySeverity.medium} | Noticeable but not blocking |`);
  lines.push(`| 🟢 LOW | ${report.summary.bySeverity.low} | Minor cosmetic issues |`);
  lines.push('');
  
  lines.push('### By Category');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  Object.entries(report.summary.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      if (count > 0) lines.push(`| ${cat} | ${count} |`);
    });
  lines.push('');
  
  lines.push('### By Page');
  lines.push('');
  lines.push('| Page | Desktop | Mobile | Total |');
  lines.push('|------|---------|--------|-------|');
  PAGES.forEach(page => {
    const desktopErrors = report.errors.filter(e => e.page === page.name && e.viewport === 'desktop').length;
    const mobileErrors = report.errors.filter(e => e.page === page.name && e.viewport === 'mobile').length;
    const total = desktopErrors + mobileErrors;
    if (total > 0) {
      lines.push(`| ${page.name} | ${desktopErrors} | ${mobileErrors} | ${total} |`);
    }
  });
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 🔴 Critical Errors (Immediate Fix Required)');
  lines.push('');
  const criticalErrors = report.errors.filter(e => e.severity === SEVERITY.CRITICAL);
  if (criticalErrors.length === 0) {
    lines.push('✅ No critical errors detected!');
  } else {
    criticalErrors.forEach((error, idx) => {
      lines.push(`### ${idx + 1}. [${error.category}] ${error.message}`);
      lines.push('');
      lines.push(`- **Page**: ${error.page} (${error.viewport})`);
      lines.push(`- **ID**: ${error.id}`);
      lines.push(`- **Details**: ${error.details}`);
      if (error.url) lines.push(`- **URL**: ${error.url}`);
      if (error.statusCode) lines.push(`- **Status Code**: ${error.statusCode}`);
      if (error.location) lines.push(`- **Location**: ${JSON.stringify(error.location)}`);
      lines.push('');
    });
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 🟠 High Priority Errors');
  lines.push('');
  const highErrors = report.errors.filter(e => e.severity === SEVERITY.HIGH);
  if (highErrors.length === 0) {
    lines.push('✅ No high priority errors detected!');
  } else {
    highErrors.slice(0, 20).forEach((error, idx) => { // Limit to first 20
      lines.push(`### ${idx + 1}. [${error.category}] ${error.message}`);
      lines.push('');
      lines.push(`- **Page**: ${error.page} (${error.viewport})`);
      lines.push(`- **Details**: ${error.details}`);
      if (error.url) lines.push(`- **URL**: ${error.url}`);
      lines.push('');
    });
    if (highErrors.length > 20) {
      lines.push(`*... and ${highErrors.length - 20} more high priority errors (see JSON report)*`);
      lines.push('');
    }
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 🟡 Medium Priority Issues');
  lines.push('');
  const mediumErrors = report.errors.filter(e => e.severity === SEVERITY.MEDIUM);
  if (mediumErrors.length === 0) {
    lines.push('✅ No medium priority issues detected!');
  } else {
    lines.push(`**Total**: ${mediumErrors.length} issues`);
    lines.push('');
    
    // Group by category
    const byCategory = {};
    mediumErrors.forEach(err => {
      if (!byCategory[err.category]) byCategory[err.category] = [];
      byCategory[err.category].push(err);
    });
    
    Object.entries(byCategory).forEach(([cat, errors]) => {
      lines.push(`### ${cat} (${errors.length})`);
      lines.push('');
      errors.slice(0, 5).forEach(error => {
        lines.push(`- **[${error.page}/${error.viewport}]** ${error.message}`);
      });
      if (errors.length > 5) {
        lines.push(`- *... and ${errors.length - 5} more*`);
      }
      lines.push('');
    });
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 🟢 Low Priority Issues');
  lines.push('');
  const lowErrors = report.errors.filter(e => e.severity === SEVERITY.LOW);
  if (lowErrors.length === 0) {
    lines.push('✅ No low priority issues detected!');
  } else {
    lines.push(`**Total**: ${lowErrors.length} issues`);
    lines.push('');
    lines.push('*(See ERROR_CATALOG.json for complete list)*');
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 🎯 Recommended Actions');
  lines.push('');
  lines.push('### Immediate (Critical)');
  lines.push('');
  if (criticalErrors.length > 0) {
    const actionItems = new Set();
    criticalErrors.forEach(err => {
      if (err.category.includes('Network')) {
        actionItems.add('- Fix failed API endpoints and network requests');
      }
      if (err.category.includes('JavaScript')) {
        actionItems.add('- Debug and fix JavaScript runtime errors');
      }
      if (err.message.includes('failed to load')) {
        actionItems.add('- Fix page navigation and loading issues');
      }
    });
    actionItems.forEach(action => lines.push(action));
  } else {
    lines.push('✅ No immediate actions required!');
  }
  lines.push('');
  
  lines.push('### Short Term (High Priority)');
  lines.push('');
  if (highErrors.length > 0) {
    const actionItems = new Set();
    highErrors.forEach(err => {
      if (err.category.includes('404')) {
        actionItems.add('- Fix broken resource links (images, scripts, etc.)');
      }
      if (err.category.includes('CSS')) {
        actionItems.add('- Fix CSS rendering and layout issues');
      }
      if (err.category.includes('Accessibility')) {
        actionItems.add('- Improve accessibility (alt text, labels, ARIA)');
      }
    });
    actionItems.forEach(action => lines.push(action));
  } else {
    lines.push('✅ No high priority actions required!');
  }
  lines.push('');
  
  lines.push('### Medium Term (Optimization)');
  lines.push('');
  lines.push('- Address console warnings and deprecations');
  lines.push('- Optimize page load performance');
  lines.push('- Improve CSS specificity and style organization');
  lines.push('- Enhance error handling and user feedback');
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## 📝 Notes');
  lines.push('');
  lines.push('- This report was generated automatically using Playwright');
  lines.push('- Errors are detected across desktop (1920x1080) and mobile (iPhone 12) viewports');
  lines.push('- See `ERROR_CATALOG.json` for complete error details including stack traces');
  lines.push('- Some errors may be false positives or environment-specific');
  lines.push('');

  const mdPath = path.join(__dirname, 'ERROR_CATALOG.md');
  fs.writeFileSync(mdPath, lines.join('\n'));
  console.log(`✅ Markdown report saved to: ${mdPath}`);
}

main().catch(error => {
  console.error('❌ Error detection failed:', error);
  process.exit(1);
});
