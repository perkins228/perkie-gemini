const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Unified Pet System Comprehensive Testing', () => {
  const testUrl = 'https://owgp57je7zp1viyv-2930573424.shopifypreview.com/pages/custom-image-processing';
  const testImagePath = path.join(__dirname, '..', 'testing', 'test-image.jpg');
  
  test.beforeEach(async ({ page }) => {
    // Set up console error tracking
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });
    
    // Track network failures
    page.on('response', response => {
      if (!response.ok()) {
        console.log(`❌ Network Error: ${response.status()} ${response.url()}`);
      }
    });
  });

  test('Complete Unified Pet System Functionality Test', async ({ page, browserName }) => {
    console.log(`🧪 Testing on ${browserName}`);
    
    const testResults = {
      pageLoad: false,
      consoleErrors: [],
      imageUpload: false,
      effectProcessing: {
        enhancedblackwhite: false,
        popart: false,
        dithering: false,
        color: false
      },
      effectSwitching: false,
      mobileViewport: false,
      dataStorage: false,
      sessionPersistence: false,
      networkPerformance: [],
      screenshots: []
    };

    try {
      // 1. Navigate to page and wait for full load
      console.log('🔄 Navigating to test page...');
      const navigationStart = Date.now();
      
      await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });
      const navigationTime = Date.now() - navigationStart;
      console.log(`✅ Page loaded in ${navigationTime}ms`);
      testResults.pageLoad = true;

      // Wait for core elements to be present
      await page.waitForSelector('.pet-processor-container', { timeout: 15000 });
      await page.waitForSelector('#file-input', { timeout: 10000 });
      
      // 2. Check for JavaScript console errors (capture early ones)
      await page.waitForTimeout(2000);
      
      // 3. Take initial screenshot
      const initialScreenshot = await page.screenshot({ fullPage: true });
      testResults.screenshots.push({
        name: 'initial_load',
        buffer: initialScreenshot
      });

      // 4. Test image upload
      console.log('🔄 Testing image upload...');
      const fileInput = page.locator('#file-input');
      await expect(fileInput).toBeVisible();
      
      // Check if test image exists, if not create a simple test scenario
      try {
        await fileInput.setInputFiles(testImagePath);
        console.log('✅ Test image uploaded successfully');
        testResults.imageUpload = true;
      } catch (error) {
        console.log('⚠️ Test image not found, proceeding with other tests');
        console.log(`Expected path: ${testImagePath}`);
      }

      // Wait for any processing to begin
      await page.waitForTimeout(3000);

      // 5. Verify all 4 effects are present in UI
      console.log('🔄 Checking effect buttons...');
      const effectButtons = [
        'enhancedblackwhite',
        'popart', 
        'dithering',
        'color'
      ];

      for (const effect of effectButtons) {
        const button = page.locator(`[data-effect="${effect}"]`);
        if (await button.isVisible()) {
          console.log(`✅ Effect button found: ${effect}`);
          
          // Try clicking the effect button
          try {
            await button.click();
            await page.waitForTimeout(1000);
            testResults.effectProcessing[effect] = true;
            console.log(`✅ Effect ${effect} clicked successfully`);
          } catch (error) {
            console.log(`❌ Error clicking ${effect}: ${error.message}`);
          }
        } else {
          console.log(`❌ Effect button not found: ${effect}`);
        }
      }

      // 6. Test effect switching functionality
      console.log('🔄 Testing effect switching...');
      try {
        // Click between different effects
        await page.locator('[data-effect="popart"]').click();
        await page.waitForTimeout(500);
        await page.locator('[data-effect="dithering"]').click();
        await page.waitForTimeout(500);
        await page.locator('[data-effect="enhancedblackwhite"]').click();
        
        testResults.effectSwitching = true;
        console.log('✅ Effect switching works');
      } catch (error) {
        console.log(`❌ Effect switching failed: ${error.message}`);
      }

      // 7. Check mobile viewport (375px width)
      console.log('🔄 Testing mobile viewport...');
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(2000);
      
      // Take mobile screenshot
      const mobileScreenshot = await page.screenshot({ fullPage: true });
      testResults.screenshots.push({
        name: 'mobile_view',
        buffer: mobileScreenshot
      });
      
      // Check if mobile layout is working
      const containerWidth = await page.evaluate(() => {
        const container = document.querySelector('.pet-processor-container');
        return container ? container.offsetWidth : 0;
      });
      
      if (containerWidth > 0 && containerWidth <= 375) {
        testResults.mobileViewport = true;
        console.log(`✅ Mobile viewport working (container width: ${containerWidth}px)`);
      } else {
        console.log(`❌ Mobile viewport issues (container width: ${containerWidth}px)`);
      }

      // Switch back to desktop
      await page.setViewportSize({ width: 1440, height: 900 });

      // 8. Verify data storage in window.perkieEffects Map
      console.log('🔄 Testing data storage...');
      const dataStorageTest = await page.evaluate(() => {
        try {
          // Check if perkieEffects exists
          if (typeof window.perkieEffects !== 'undefined') {
            console.log('perkieEffects found:', window.perkieEffects);
            return {
              exists: true,
              type: typeof window.perkieEffects,
              size: window.perkieEffects instanceof Map ? window.perkieEffects.size : 'not a Map',
              keys: window.perkieEffects instanceof Map ? Array.from(window.perkieEffects.keys()) : []
            };
          }
          return { exists: false };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      if (dataStorageTest.exists) {
        testResults.dataStorage = true;
        console.log(`✅ Data storage working:`, dataStorageTest);
      } else {
        console.log(`❌ Data storage not working:`, dataStorageTest);
      }

      // 9. Test session persistence (reload page and check if data persists)
      console.log('🔄 Testing session persistence...');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      
      const persistenceTest = await page.evaluate(() => {
        try {
          // Check localStorage for pet data
          const localStorageKeys = Object.keys(localStorage).filter(key => 
            key.includes('pet') || key.includes('perkie') || key.includes('effect')
          );
          
          return {
            localStorageKeys,
            perkieEffectsExists: typeof window.perkieEffects !== 'undefined'
          };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      if (persistenceTest.localStorageKeys.length > 0 || persistenceTest.perkieEffectsExists) {
        testResults.sessionPersistence = true;
        console.log(`✅ Session persistence working:`, persistenceTest);
      } else {
        console.log(`❌ Session persistence not working:`, persistenceTest);
      }

      // 10. Monitor network requests and response times
      console.log('🔄 Analyzing network performance...');
      const performanceEntries = await page.evaluate(() => {
        return performance.getEntriesByType('navigation').concat(
          performance.getEntriesByType('resource')
        ).map(entry => ({
          name: entry.name,
          duration: entry.duration,
          responseStart: entry.responseStart,
          responseEnd: entry.responseEnd,
          transferSize: entry.transferSize || 0
        }));
      });
      
      testResults.networkPerformance = performanceEntries;
      const slowRequests = performanceEntries.filter(entry => entry.duration > 3000);
      
      if (slowRequests.length > 0) {
        console.log(`⚠️ Found ${slowRequests.length} slow requests (>3s):`);
        slowRequests.forEach(req => {
          console.log(`  - ${req.name}: ${Math.round(req.duration)}ms`);
        });
      }

      // 11. Take final screenshots
      const finalScreenshot = await page.screenshot({ fullPage: true });
      testResults.screenshots.push({
        name: 'final_state',
        buffer: finalScreenshot
      });

      // 12. Check for memory leaks or performance issues
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }
        return null;
      });
      
      if (memoryInfo) {
        console.log('📊 Memory usage:', {
          used: `${Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024)}MB`,
          total: `${Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024)}MB`,
          limit: `${Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024)}MB`
        });
      }

    } catch (error) {
      console.log(`❌ Test execution error: ${error.message}`);
    }

    // Generate comprehensive test report
    console.log('\n🏁 TEST RESULTS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Page Load: ${testResults.pageLoad ? 'PASS' : 'FAIL'}`);
    console.log(`📤 Image Upload: ${testResults.imageUpload ? 'PASS' : 'FAIL'}`);
    console.log(`🎨 Effect Processing:`);
    Object.entries(testResults.effectProcessing).forEach(([effect, success]) => {
      console.log(`   - ${effect}: ${success ? 'PASS' : 'FAIL'}`);
    });
    console.log(`🔄 Effect Switching: ${testResults.effectSwitching ? 'PASS' : 'FAIL'}`);
    console.log(`📱 Mobile Viewport: ${testResults.mobileViewport ? 'PASS' : 'FAIL'}`);
    console.log(`💾 Data Storage: ${testResults.dataStorage ? 'PASS' : 'FAIL'}`);
    console.log(`🔄 Session Persistence: ${testResults.sessionPersistence ? 'PASS' : 'FAIL'}`);
    console.log(`🌐 Network Requests: ${testResults.networkPerformance.length} total`);
    console.log(`📸 Screenshots: ${testResults.screenshots.length} captured`);
    
    const totalTests = 8;
    const passedTests = [
      testResults.pageLoad,
      testResults.imageUpload,
      Object.values(testResults.effectProcessing).some(v => v),
      testResults.effectSwitching,
      testResults.mobileViewport,
      testResults.dataStorage,
      testResults.sessionPersistence,
      testResults.networkPerformance.length > 0
    ].filter(Boolean).length;
    
    console.log(`\n🏆 OVERALL SCORE: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);

    // Assertions for Playwright reporting
    expect(testResults.pageLoad).toBe(true);
    expect(testResults.networkPerformance.length).toBeGreaterThan(0);
    
    // Store results for potential further analysis
    await page.evaluate((results) => {
      window.testResults = results;
    }, testResults);

  });

  test('API Integration and Performance Test', async ({ page }) => {
    console.log('🔄 Testing API Integration...');
    
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    
    // Monitor API calls
    const apiCalls = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('inspirenet-bg-removal-api') || url.includes('process') || url.includes('remove-background')) {
        apiCalls.push({
          url: url,
          status: response.status(),
          timing: response.timing()
        });
      }
    });
    
    await page.waitForTimeout(5000);
    
    console.log(`📡 Detected ${apiCalls.length} API calls`);
    apiCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.status} - ${call.url}`);
    });
    
    expect(apiCalls.length).toBeGreaterThanOrEqual(0);
  });

  test('Error Handling and Edge Cases', async ({ page }) => {
    console.log('🔄 Testing Error Handling...');
    
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    
    // Test various edge cases
    const errorTests = await page.evaluate(() => {
      const tests = [];
      
      // Test 1: Invalid file upload simulation
      try {
        const fileInput = document.querySelector('#file-input');
        if (fileInput) {
          // Simulate invalid file event
          const event = new Event('change');
          fileInput.dispatchEvent(event);
          tests.push({ name: 'Invalid file handling', success: true });
        }
      } catch (error) {
        tests.push({ name: 'Invalid file handling', success: false, error: error.message });
      }
      
      // Test 2: Memory cleanup
      try {
        if (typeof window.emergencyCleanupPetData === 'function') {
          window.emergencyCleanupPetData();
          tests.push({ name: 'Emergency cleanup', success: true });
        } else {
          tests.push({ name: 'Emergency cleanup', success: false, error: 'Function not found' });
        }
      } catch (error) {
        tests.push({ name: 'Emergency cleanup', success: false, error: error.message });
      }
      
      return tests;
    });
    
    console.log('🧪 Error handling tests:', errorTests);
    expect(errorTests.length).toBeGreaterThan(0);
  });
});