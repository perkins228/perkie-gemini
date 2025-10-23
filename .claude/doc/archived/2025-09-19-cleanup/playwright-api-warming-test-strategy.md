# Playwright API Warming Test Strategy

## Context: Verifying Critical API Warming Fix

**Date**: 2025-08-18
**Issue**: API warming was calling `/health` endpoint instead of `/warmup` 
**Fix Applied**: Changed endpoint from `/health` to `/warmup` in 2 files:
- `assets/pet-processor-v5-es5.js` line 1443
- `assets/pet-processor-unified.js` line 810

**Expected Impact**: Eliminates 11-second cold starts, 30% conversion improvement potential

## Test Strategy Overview

### What We're Testing
1. ✅ Frontend calls `/warmup` endpoint (not `/health`)
2. ✅ Warmup takes 10-15 seconds (proves model loading)
3. ✅ After warmup, processing is fast (~3s not 11s)  
4. ✅ Session limits work (max 1 per session)
5. ✅ Global cooldown enforced (15-minute throttle)

### Where to Test
- **Live Pet Processor Page**: `/pages/pet-background-remover`
- **Direct URL**: `https://your-store.myshopify.com/pages/pet-background-remover`

## Playwright Test Implementation

### 1. Navigate to Pet Processor Page

```javascript
// Navigate to the actual pet processor page
await page.goto('https://your-store.myshopify.com/pages/pet-background-remover');

// Wait for page load and processor initialization
await page.waitForSelector('.ks-pet-processor-v5');
await page.waitForFunction(() => window.petProcessorV5);

// Verify we're on the correct page
const heading = await page.locator('h1').textContent();
expect(heading).toContain('Preview Your Perkie Print');
```

### 2. Monitor Network Requests for /warmup

```javascript
// Set up network request monitoring
const networkRequests = [];
page.on('request', request => {
  if (request.url().includes('inspirenet-bg-removal-api')) {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      timestamp: Date.now()
    });
  }
});

// Wait for warmup request to complete
const warmupRequest = await page.waitForRequest(
  request => request.url().includes('/warmup'),
  { timeout: 20000 }
);

// Verify request details
expect(warmupRequest.method()).toBe('POST');
expect(warmupRequest.url()).toContain('/warmup');
```

### 3. Measure Timing

```javascript
// Measure warmup timing
const warmupStart = Date.now();

await page.waitForResponse(
  response => response.url().includes('/warmup'),
  { timeout: 30000 }
);

const warmupDuration = Date.now() - warmupStart;

// Verify timing expectations
expect(warmupDuration).toBeGreaterThan(8000);  // Should take > 8s
expect(warmupDuration).toBeLessThan(20000);    // Should complete < 20s

console.log(`✅ Warmup completed in ${warmupDuration/1000}s`);
```

### 4. Verify the Fix is Working

```javascript
// Check console logs for warming messages
const consoleLogs = [];
page.on('console', msg => {
  if (msg.text().includes('warmup') || msg.text().includes('API')) {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now()
    });
  }
});

// Look for success indicators
const successLogs = consoleLogs.filter(log => 
  log.text().includes('✅ API warmed up successfully')
);
expect(successLogs.length).toBeGreaterThan(0);

// Verify NO /health requests
const healthRequests = networkRequests.filter(req => 
  req.url.includes('/health')
);
expect(healthRequests).toHaveLength(0);
```

### 5. Test Session Limits

```javascript
// Test 1: First warmup should work
await page.goto('/pages/pet-background-remover', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Clear previous session data
await page.evaluate(() => {
  sessionStorage.removeItem('petProcessor_sessionWarmupDone');
  localStorage.removeItem('petProcessor_lastWarmupAttempt');
});

// Refresh and verify warmup happens
await page.reload({ waitUntil: 'networkidle' });
const firstWarmup = await page.waitForRequest('/warmup', { timeout: 5000 });
expect(firstWarmup).toBeTruthy();

// Test 2: Second warmup should be skipped
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// No new warmup request should occur
const recentRequests = networkRequests.filter(req => 
  req.url.includes('/warmup') && 
  req.timestamp > Date.now() - 3000
);
expect(recentRequests).toHaveLength(0);
```

## What to Look For in Console Logs

### Success Indicators ✅
```
🔥 Starting API warmup (this may take 10-15 seconds)...
✅ API warmed up successfully
```

### Expected Skip Messages ✅  
```
⏭️ Skipping warmup - already done this session
⏳ Skipping warmup - global cooldown active (X min remaining)
```

### Red Flags 🚨
```
⚠️ API warmup failed (cold start expected)
GET /health (should be POST /warmup)
Warmup completed in < 3 seconds (too fast)
```

### Storage Inspection
```javascript
// Check localStorage for warming state
const storageState = await page.evaluate(() => ({
  lastWarmupSuccess: localStorage.getItem('petProcessor_lastWarmupSuccess'),
  lastWarmupAttempt: localStorage.getItem('petProcessor_lastWarmupAttempt'),
  sessionWarmupDone: sessionStorage.getItem('petProcessor_sessionWarmupDone')
}));

console.log('Storage State:', storageState);
```

## Comprehensive Test Suite

### Test 1: Basic Warming Verification
1. Navigate to pet processor page
2. Monitor network for POST to `/warmup`
3. Verify 10-15 second duration
4. Check console for success message
5. Verify storage state updated

### Test 2: Session Limits
1. Verify first warmup executes
2. Refresh page - warmup should be skipped
3. Check console for skip message
4. Open new tab - should still skip (same session)

### Test 3: Global Cooldown
1. Clear session storage only (keep localStorage)
2. Refresh page
3. Verify warmup is skipped due to global cooldown
4. Check console for cooldown message

### Test 4: Processing Speed After Warmup  
1. Wait for warmup to complete
2. Upload test image
3. Measure processing time
4. Verify < 5 seconds (not 11+ seconds)

### Test 5: No /health Requests
1. Monitor all network requests during session
2. Filter for API calls
3. Verify zero requests to `/health` endpoint
4. Confirm all warming uses `/warmup`

## Expected Results

### Before Fix (Broken State) 🚨
- GET requests to `/health` endpoint
- Warmup completes in < 1 second  
- Processing still takes 11+ seconds
- Cold starts persist despite "warming"

### After Fix (Working State) ✅
- POST requests to `/warmup` endpoint
- Warmup takes 10-15 seconds
- Processing completes in ~3 seconds
- Session and cooldown limits enforced
- Console shows proper warming messages

## Browser Testing Matrix

### Desktop Testing
- **Chrome**: Primary test browser
- **Safari**: Secondary verification  
- **Edge**: Windows compatibility

### Mobile Testing
- **iOS Safari**: 70% of traffic
- **Chrome Android**: Primary mobile browser
- **Samsung Internet**: Regional variant

## Performance Validation

### Key Metrics to Track
1. **Warmup Duration**: 10-15s (cold start) vs 0-2s (cached)
2. **Processing Time**: 3s (warmed) vs 11s (cold)  
3. **Network Requests**: POST /warmup (not GET /health)
4. **Session Behavior**: Max 1 warmup per session
5. **Cooldown Period**: 15 minutes between attempts

### Success Criteria
- ✅ Warmup endpoint called correctly
- ✅ Proper timing (10-15s for cold start)  
- ✅ Fast processing after warmup (~3s)
- ✅ Session limits enforced
- ✅ No /health endpoint requests
- ✅ Console messages indicate success

## Real-World Test Scenarios

### Scenario 1: First-Time User
1. New browser session
2. Navigate to pet processor page
3. Observe automatic warmup (10-15s)
4. Upload image → fast processing (3s)

### Scenario 2: Returning User (Same Session)
1. Already warmed session
2. Refresh page or navigate back
3. No warmup occurs (session skip)
4. Upload works immediately

### Scenario 3: Power User (Multiple Tabs)
1. Open multiple tabs to pet processor
2. Only first tab triggers warmup
3. Other tabs skip due to session state
4. All tabs benefit from warm API

### Scenario 4: Global Cooldown Test
1. Clear session storage only
2. Return within 15 minutes  
3. Warmup skipped (global cooldown)
4. Return after 15 minutes → new warmup allowed

## Automated Playwright Test Code

```javascript
import { test, expect } from '@playwright/test';

test.describe('API Warming Fix Verification', () => {
  let networkRequests = [];

  test.beforeEach(async ({ page }) => {
    // Monitor network requests
    networkRequests = [];
    page.on('request', request => {
      if (request.url().includes('inspirenet-bg-removal-api')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    // Clear storage for clean test
    await page.goto('/pages/pet-background-remover');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should call /warmup endpoint with correct timing', async ({ page }) => {
    const warmupStart = Date.now();
    
    // Navigate and trigger warmup
    await page.goto('/pages/pet-background-remover', { waitUntil: 'networkidle' });
    
    // Wait for warmup request
    await page.waitForRequest(
      request => request.url().includes('/warmup'),
      { timeout: 20000 }
    );
    
    // Wait for warmup to complete  
    await page.waitForResponse(
      response => response.url().includes('/warmup'),
      { timeout: 30000 }
    );
    
    const warmupDuration = Date.now() - warmupStart;
    
    // Verify timing and request details
    expect(warmupDuration).toBeGreaterThan(8000);
    const warmupRequests = networkRequests.filter(req => 
      req.url.includes('/warmup') && req.method === 'POST'
    );
    expect(warmupRequests.length).toBe(1);
    
    // Verify no /health requests
    const healthRequests = networkRequests.filter(req => 
      req.url.includes('/health')
    );
    expect(healthRequests).toHaveLength(0);
  });

  test('should enforce session limits', async ({ page }) => {
    // First load should trigger warmup
    await page.goto('/pages/pet-background-remover', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const initialWarmups = networkRequests.filter(req => 
      req.url.includes('/warmup')
    ).length;
    
    // Reload should skip warmup
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const finalWarmups = networkRequests.filter(req => 
      req.url.includes('/warmup')
    ).length;
    
    expect(finalWarmups).toBe(initialWarmups); // No new warmup requests
  });
});
```

## Manual Verification Steps

1. **Open DevTools** → Network tab
2. **Navigate** to `/pages/pet-background-remover`  
3. **Watch Network** for POST to `/warmup` (~10-15s duration)
4. **Check Console** for "✅ API warmed up successfully"
5. **Upload Image** to verify fast processing (~3s)
6. **Refresh Page** to verify session skip
7. **Check Storage** for proper state tracking

## Success Indicators Summary

| Test | Expected Result | Failure Indicator |
|------|----------------|-------------------|
| Endpoint | POST to `/warmup` | GET to `/health` |
| Timing | 10-15 seconds | < 3 seconds |
| Processing | ~3s after warmup | Still 11+ seconds |
| Session Limit | Max 1 per session | Multiple warmups |
| Console | Success messages | Error/failure logs |
| Storage | Proper state tracking | Missing/incorrect data |

This comprehensive test strategy will verify that the critical API warming fix is working correctly and delivering the expected 30% conversion improvement from eliminating cold starts.