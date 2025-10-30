import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

BASE_URL = "https://3008-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai"

pages = [
    {"path": "/map", "name": "map"},
    {"path": "/feed", "name": "feed"},
    {"path": "/wallet", "name": "wallet"},
    {"path": "/profile", "name": "profile"},
    {"path": "/notifications", "name": "notifications"},
    {"path": "/settings", "name": "settings"},
]

def setup_driver():
    """Setup Chrome driver with console logging enabled"""
    chrome_options = Options()
    chrome_options.binary_location = "/usr/bin/chromium"
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--window-size=390,844')  # iPhone 14 Pro
    chrome_options.add_argument('--disable-gpu')
    
    # Enable browser logging
    chrome_options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    
    # Try to use chromedriver
    try:
        driver = webdriver.Chrome(options=chrome_options)
    except:
        # If chromedriver not found, try with service
        service = Service('/usr/bin/chromedriver')
        driver = webdriver.Chrome(service=service, options=chrome_options)
    
    return driver

def capture_page(driver, page_config):
    """Capture screenshot and console logs for a page"""
    url = f"{BASE_URL}{page_config['path']}"
    name = page_config['name']
    
    print(f"\n📸 Capturing {name}...")
    print(f"   URL: {url}")
    
    try:
        # Navigate to page
        driver.get(url)
        
        # Wait for page to load
        time.sleep(5)
        
        # Take screenshot
        screenshot_path = f"final-check-{name}.png"
        driver.save_screenshot(screenshot_path)
        print(f"   ✅ Screenshot saved: {screenshot_path}")
        
        # Get console logs
        logs = driver.get_log('browser')
        
        # Filter and categorize logs
        errors = []
        warnings = []
        info_logs = []
        
        for log in logs:
            level = log['level']
            message = log['message']
            
            if level == 'SEVERE':
                errors.append(message)
            elif level == 'WARNING':
                warnings.append(message)
            else:
                info_logs.append(message)
        
        # Print summary
        print(f"   📊 Console Logs:")
        print(f"      - Errors: {len(errors)}")
        print(f"      - Warnings: {len(warnings)}")
        print(f"      - Info: {len(info_logs)}")
        
        # Print errors if any
        if errors:
            print(f"\n   ❌ ERRORS FOUND:")
            for i, error in enumerate(errors[:10], 1):  # Show first 10
                # Extract URL from error message
                if "404" in error:
                    print(f"      {i}. [404] {error[:200]}")
                else:
                    print(f"      {i}. {error[:200]}")
        
        return {
            "page": name,
            "url": url,
            "errors": errors,
            "warnings": warnings,
            "info": info_logs,
            "screenshot": screenshot_path
        }
        
    except Exception as e:
        print(f"   ❌ Error capturing {name}: {str(e)}")
        return {
            "page": name,
            "url": url,
            "error": str(e)
        }

def main():
    print("=" * 70)
    print("🚀 Starting Comprehensive Page Analysis")
    print("=" * 70)
    
    driver = setup_driver()
    results = []
    
    try:
        for page_config in pages:
            result = capture_page(driver, page_config)
            results.append(result)
            time.sleep(2)  # Brief pause between pages
        
        # Save results to JSON
        with open('console-analysis-results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print("\n" + "=" * 70)
        print("✅ Analysis Complete!")
        print("=" * 70)
        
        # Print summary
        print("\n📊 SUMMARY:")
        print("-" * 70)
        for result in results:
            if 'errors' in result:
                error_count = len(result['errors'])
                warning_count = len(result['warnings'])
                status = "✅ CLEAN" if error_count == 0 else f"❌ {error_count} ERRORS"
                print(f"   {result['page']:15s} | {status:20s} | {warning_count} warnings")
        
        print("\n📁 Files created:")
        print("   - console-analysis-results.json (detailed results)")
        for result in results:
            if 'screenshot' in result:
                print(f"   - {result['screenshot']}")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
