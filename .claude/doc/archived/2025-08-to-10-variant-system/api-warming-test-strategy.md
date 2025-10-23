# API Warming Functionality - Comprehensive Test Strategy

**Created**: 2025-10-02
**Purpose**: Validate frontend API warming implementation after warmup bug fix (16x16→32x32)
**Context**: Session context_session_20250921_162255.md
**API Revision**: 00091-mat (deployed and verified working)

---

## Executive Summary

This test strategy validates that the frontend warming code (`api-warmer.js`) correctly triggers the fixed backend `/warmup` endpoint and improves user experience by reducing cold starts from 30-60s to 3-5s.

### Critical Success Criteria
1. ✅ Warmup endpoint is called on page load
2. ✅ Response includes `error: false` (new field from fix)
3. ✅ Warming triggers on user intent (hover, focus, touch)
4. ✅ Cross-tab coordination prevents duplicate warming
5. ✅ Mobile viewport works correctly (70% of traffic)
6. ✅ Performance improvement measurable (3-5s vs 30-60s)

---

## Frontend Warming Implementation Analysis

### Location & Files
- **Primary Implementation**: `assets/api-warmer.js` (180 lines)
- **Secondary Client**: `assets/api-client.js` (lines 238-259 warmup method)
- **Integration Point**: `sections/ks-pet-processor-v5.liquid` (line 40)

### Warming Triggers (from api-warmer.js)

**1. Page Load (Line 173-177)**
```javascript
// Auto-warm on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => APIWarmer.warmOnLoad());
} else {
  APIWarmer.warmOnLoad();
}
```

**2. Intent-Based Warming (Line 122-153)**
Triggers on hover/focus/touch of:
- `.pet-upload-area`
- `.effect-selector`
- `.ks-pet-processor-section`
- `#pet-upload-trigger`
- `.pet-bg-remover`

**3. Retry Logic (Line 115-116)**
```javascript
this.warm(); // Immediate
setTimeout(() => this.warm(), 2000); // Retry after 2s
```

### Failsafes & Coordination

**Cross-Tab Coordination (Line 18-47)**
- Uses localStorage key `api_warming_active`
- 60-second lock to prevent duplicate warming
- BroadcastChannel for completion notification
- Automatic cleanup after 50s

**In-Tab Deduplication (Line 52-62)**
- Global state: `window.apiWarmingState`
- Prevents warming if already in progress
- Skips if warmed within 5 minutes (300000ms)

**Response Handling (Line 83-96)**
- Checks `data.model_ready` (primary success indicator)
- Checks `data.status === 'already_loaded'` (secondary)
- NEW: Should check `data.error === false` from fix

---

## Test Plan Overview

### Testing Approach: Chrome DevTools MCP
Use live Shopify staging site with Chrome DevTools MCP tools for realistic testing.

**Staging URL**: https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/

**Available Tools**:
- `mcp__chrome-devtools__navigate_page` - Navigate to pages
- `mcp__chrome-devtools__take_snapshot` - Capture page state
- `mcp__chrome-devtools__list_console_messages` - Monitor console logs
- `mcp__chrome-devtools__list_network_requests` - Track API calls
- `mcp__chrome-devtools__evaluate_script` - Execute JS for state inspection
- `mcp__chrome-devtools__resize_page` - Test mobile viewports
- `mcp__chrome-devtools__take_screenshot` - Visual verification

### Test Phases
1. **Phase 1**: Basic Functionality (Desktop)
2. **Phase 2**: Mobile Testing (70% traffic priority)
3. **Phase 3**: Cross-Tab Coordination
4. **Phase 4**: Performance Validation
5. **Phase 5**: Error Handling & Edge Cases

---

## Phase 1: Basic Functionality Testing (Desktop)

### Test 1.1: Page Load Warming
**Objective**: Verify warming triggers on page load

**Steps**:
1. Open new incognito window (clean state)
2. Navigate to staging background remover page: `/pages/pet-background-remover`
3. Monitor console messages for warming logs
4. Check network requests for `/warmup` call
5. Verify response includes new fields

**Expected Results**:
```
Console:
✅ "🔥 Warming API based on user intent..." OR immediate warming
✅ "✅ API warmed successfully in X.Xs"

Network:
✅ POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup
✅ Status: 200 OK
✅ Response: {"status":"success","model_ready":true,"error":false,...}
```

**Chrome MCP Commands**:
```javascript
// 1. Navigate to page
mcp__chrome-devtools__navigate_page({
  url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/pages/pet-background-remover"
})

// 2. Wait for warming to complete (30-60s on cold start)
mcp__chrome-devtools__wait_for({
  text: "API warmed successfully",
  timeout: 90000
})

// 3. List console messages
mcp__chrome-devtools__list_console_messages()

// 4. Check network requests
mcp__chrome-devtools__list_network_requests({
  resourceTypes: ["xhr", "fetch"]
})

// 5. Inspect warming state
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    return {
      warmingState: window.apiWarmingState,
      localStorage: localStorage.getItem('api_warming_active'),
      timestamp: Date.now()
    }
  }`
})
```

**Success Criteria**:
- [ ] Warmup endpoint called within 3 seconds of page load
- [ ] Response received with `error: false`
- [ ] `window.apiWarmingState.isWarm === true`
- [ ] No console errors

---

### Test 1.2: Intent-Based Warming (Hover)
**Objective**: Verify warming triggers on user hover

**Steps**:
1. Open page with API NOT pre-warmed (clear localStorage)
2. Wait 5 seconds (no auto-warm)
3. Hover over pet upload area
4. Monitor warming trigger

**Expected Results**:
```
Console:
✅ "🔥 Warming API based on user intent..."
✅ Warmup call initiated
```

**Chrome MCP Commands**:
```javascript
// 1. Clear localStorage
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    localStorage.clear();
    window.apiWarmingState = {inProgress: false, isWarm: false, lastWarmTime: 0};
    return 'State cleared';
  }`
})

// 2. Take snapshot to find upload area
mcp__chrome-devtools__take_snapshot()

// 3. Hover over upload area (find uid from snapshot)
mcp__chrome-devtools__hover({
  uid: "UPLOAD_AREA_UID_FROM_SNAPSHOT"
})

// 4. Wait and check console
setTimeout(() => {
  mcp__chrome-devtools__list_console_messages()
}, 2000)
```

**Success Criteria**:
- [ ] Hover triggers warming (console message appears)
- [ ] Only ONE warming attempt (deduplication works)
- [ ] Warming completes successfully

---

### Test 1.3: Response Field Validation
**Objective**: Verify new `error` field is handled correctly

**Steps**:
1. Trigger warming
2. Capture response
3. Validate fields

**Expected Response Structure**:
```json
{
  "status": "success",
  "error": false,              // NEW FIELD from fix
  "model_ready": true,
  "total_time": 0.06,
  "model_load_time": null,
  "processing_time": 0.06,
  "device": "cuda",
  "model_type": "InSPyReNet"
}
```

**Chrome MCP Commands**:
```javascript
// Intercept warmup response
mcp__chrome-devtools__get_network_request({
  url: "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup"
})
```

**Success Criteria**:
- [ ] `error` field exists and is `false`
- [ ] `model_ready` is `true`
- [ ] No JavaScript errors parsing response
- [ ] `window.apiWarmingState.isWarm` set to true

---

## Phase 2: Mobile Testing (PRIORITY - 70% Traffic)

### Test 2.1: Mobile Viewport Warming
**Objective**: Verify warming works on mobile viewport

**Steps**:
1. Resize browser to mobile size (375x667 - iPhone SE)
2. Navigate to background remover page
3. Monitor warming behavior
4. Test touch-based intent warming

**Chrome MCP Commands**:
```javascript
// 1. Resize to mobile
mcp__chrome-devtools__resize_page({
  width: 375,
  height: 667
})

// 2. Navigate
mcp__chrome-devtools__navigate_page({
  url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/pages/pet-background-remover"
})

// 3. Take mobile screenshot
mcp__chrome-devtools__take_screenshot({
  fullPage: false
})

// 4. Monitor console
mcp__chrome-devtools__list_console_messages()

// 5. Trigger touch event on upload area
mcp__chrome-devtools__take_snapshot() // Find upload area uid
mcp__chrome-devtools__click({ uid: "UPLOAD_AREA_UID" })
```

**Success Criteria**:
- [ ] Warming triggers on mobile viewport
- [ ] Touch events work (line 149: passive: true)
- [ ] No mobile-specific console errors
- [ ] Performance acceptable on mobile

---

### Test 2.2: Mobile Network Conditions
**Objective**: Test warming on slow mobile networks

**Steps**:
1. Emulate Slow 4G network
2. Test warming behavior
3. Verify timeout handling

**Chrome MCP Commands**:
```javascript
// 1. Set network throttling
mcp__chrome-devtools__emulate_network({
  throttlingOption: "Slow 4G"
})

// 2. Trigger warming
// ... (same as Test 1.1)

// 3. Monitor for timeout issues
```

**Expected Behavior**:
- 90-second timeout (line 247 in api-client.js)
- Graceful failure if timeout exceeded
- Retry logic kicks in (2s delay)

**Success Criteria**:
- [ ] Warming completes or fails gracefully
- [ ] No frozen UI during slow warming
- [ ] User sees appropriate feedback

---

## Phase 3: Cross-Tab Coordination Testing

### Test 3.1: Duplicate Prevention
**Objective**: Verify only one tab warms the API

**Steps**:
1. Open Tab 1 to background remover page
2. Immediately open Tab 2 to same page
3. Monitor which tab performs warming
4. Verify coordination via localStorage

**Manual Test** (Chrome MCP doesn't support multiple tabs easily):
1. Open staging URL in Tab 1
2. Open console in both tabs
3. Quickly open Tab 2 to same URL
4. Check console logs in both tabs

**Expected Results**:
```
Tab 1 Console:
✅ "API warmed successfully in X.Xs"
✅ localStorage.getItem('api_warming_active') set

Tab 2 Console:
✅ "Another tab is warming the API, skipping..."
✅ BroadcastChannel message received when Tab 1 completes
```

**Verification via Single Tab** (Chrome MCP):
```javascript
// Simulate cross-tab scenario
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    // Set localStorage as if another tab is warming
    localStorage.setItem('api_warming_active', Date.now().toString());

    // Try to warm - should be blocked
    return APIWarmer.warm();
  }`
})

// Should return false (blocked by coordination)
```

**Success Criteria**:
- [ ] Only one warming attempt across tabs
- [ ] localStorage lock works (60s duration)
- [ ] BroadcastChannel notifies other tabs
- [ ] State synced: `window.apiWarmingState.isWarm` true in all tabs

---

### Test 3.2: Lock Expiry Handling
**Objective**: Verify stale locks don't permanently block warming

**Steps**:
1. Set old timestamp in localStorage (>60s ago)
2. Attempt warming
3. Verify lock is ignored

**Chrome MCP Commands**:
```javascript
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    // Set stale lock (90 seconds old)
    const staleTime = Date.now() - 90000;
    localStorage.setItem('api_warming_active', staleTime.toString());

    // Try warming - should succeed (lock expired)
    APIWarmer.warm().then(result => {
      console.log('Warming result with stale lock:', result);
    });

    return 'Stale lock test initiated';
  }`
})
```

**Success Criteria**:
- [ ] Stale lock (>60s) is ignored
- [ ] New warming attempt succeeds
- [ ] New timestamp written to localStorage

---

## Phase 4: Performance Validation

### Test 4.1: Cold Start vs Warm Performance
**Objective**: Measure actual performance improvement

**Test Scenario A - COLD START (No Warmup)**:
```javascript
// 1. Clear all state
localStorage.clear();
sessionStorage.clear();

// 2. Disable auto-warming temporarily
window.APIWarmer = null; // Prevent auto-warm

// 3. Upload a test pet image
// 4. Measure processing time
```

**Test Scenario B - WARM START (With Warmup)**:
```javascript
// 1. Warm the API first
await APIWarmer.warm();

// 2. Wait for confirmation (model_ready: true)
// 3. Upload same test pet image
// 4. Measure processing time
```

**Chrome MCP Performance Test**:
```javascript
// Performance test script
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    const testImage = /* create test blob */;

    // Test 1: Cold start (disable warming)
    const originalWarmer = window.APIWarmer;
    window.APIWarmer = null;

    const coldStartTime = performance.now();
    // Trigger processing...
    const coldEndTime = performance.now();
    const coldDuration = coldEndTime - coldStartTime;

    // Test 2: After warming
    window.APIWarmer = originalWarmer;
    await APIWarmer.warm();

    const warmStartTime = performance.now();
    // Trigger processing...
    const warmEndTime = performance.now();
    const warmDuration = warmEndTime - warmStartTime;

    return {
      coldStart: coldDuration,
      warmStart: warmDuration,
      improvement: ((coldDuration - warmDuration) / coldDuration * 100).toFixed(1) + '%'
    };
  }`
})
```

**Expected Results**:
- Cold Start: 30-60 seconds
- Warm Start: 3-5 seconds
- Improvement: 80-90%

**Success Criteria**:
- [ ] Cold start: >25 seconds
- [ ] Warm start: <10 seconds
- [ ] Improvement: >75%
- [ ] User perceives clear difference

---

### Test 4.2: Warmup Duration Monitoring
**Objective**: Track how long warmup itself takes

**Chrome MCP Commands**:
```javascript
// Monitor warmup duration
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    const startTime = performance.now();
    const result = await APIWarmer.warm();
    const duration = performance.now() - startTime;

    return {
      success: result,
      durationMs: duration,
      durationSeconds: (duration / 1000).toFixed(2),
      state: window.apiWarmingState
    };
  }`
})

// Check network timing
mcp__chrome-devtools__get_network_request({
  url: "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup"
})
// Response includes: total_time, model_load_time, processing_time
```

**Expected Timing**:
- First warmup (cold): 30-60s (model loading)
- Subsequent warmup (warm): <1s (already loaded check)

**Success Criteria**:
- [ ] First warmup completes in <90s
- [ ] Subsequent warmups complete in <2s
- [ ] User sees progress indication during long warmups

---

## Phase 5: Error Handling & Edge Cases

### Test 5.1: Network Failure Handling
**Objective**: Verify graceful degradation when warming fails

**Steps**:
1. Block network access temporarily
2. Trigger warming
3. Verify error handling

**Chrome MCP Commands**:
```javascript
// Simulate network failure
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    // Override fetch to simulate failure
    const originalFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error('Network error'));

    const result = await APIWarmer.warm();

    // Restore fetch
    window.fetch = originalFetch;

    return {
      warmingResult: result,
      errorHandled: !result, // Should be false on failure
      stateAfterError: window.apiWarmingState
    };
  }`
})
```

**Expected Behavior** (from api-warmer.js line 101-108):
```javascript
catch (e) {
  // Silent fail is acceptable for warming, but log for debugging
  console.debug('API warmup error (non-critical):', e.message);
  return false;
} finally {
  // Always clear the in-progress flag
  window.apiWarmingState.inProgress = false;
}
```

**Success Criteria**:
- [ ] Error caught and logged (console.debug)
- [ ] No user-facing error message
- [ ] `inProgress` flag cleared in finally block
- [ ] User can still upload images (cold start fallback)

---

### Test 5.2: Response Error Field Handling
**Objective**: Test new `error: true` response handling

**Scenario**: API returns success status but `error: true`

**Mock Response Test**:
```javascript
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    // Mock fetch to return error response
    const originalFetch = window.fetch;
    window.fetch = (url) => {
      if (url.includes('/warmup')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'error',
            error: true,  // NEW FIELD indicating failure
            model_ready: false,
            message: 'Warmup failed'
          })
        });
      }
      return originalFetch(url);
    };

    const result = await APIWarmer.warm();
    window.fetch = originalFetch;

    return {
      warmingSucceeded: result,
      stateIsWarm: window.apiWarmingState.isWarm
    };
  }`
})
```

**IMPORTANT FINDING**:
Current code (line 85-95) does NOT check `error` field!

```javascript
if (response.ok) {
  const data = await response.json();
  if (data.model_ready) {  // Only checks model_ready
    console.log(`✅ API warmed successfully...`);
    window.apiWarmingState.isWarm = true;
  } else if (data.status === 'already_loaded') {
    // ...
  }
  return data.model_ready;
}
```

**RECOMMENDATION**: Update api-warmer.js to check error field:
```javascript
if (response.ok) {
  const data = await response.json();

  // Check new error field from fix
  if (data.error === true) {
    console.warn('API warmup reported error:', data);
    return false;
  }

  if (data.model_ready) {
    // ... rest of code
  }
}
```

**Success Criteria**:
- [ ] `error: true` responses are detected
- [ ] State NOT set to warm when error occurs
- [ ] Retry logic can attempt again

---

### Test 5.3: Timeout Handling
**Objective**: Verify 90-second timeout works

**Test**:
```javascript
// This would require API to hang - difficult to test
// Alternative: Check timeout is configured correctly
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    // Find timeout value in api-client.js
    const client = new (window.APIClient || class {});
    return {
      defaultTimeout: 30000, // from api-client.js line 13
      warmupTimeout: 90000   // from api-client.js line 247
    };
  }`
})
```

**Success Criteria**:
- [ ] Warmup uses 90s timeout (not default 30s)
- [ ] Timeout triggers abort controller
- [ ] User gets feedback after timeout

---

## Phase 6: Integration Testing

### Test 6.1: Full User Flow
**Objective**: Test complete workflow with warming

**Steps**:
1. Land on background remover page (cold)
2. Page auto-warms API
3. User uploads pet image
4. Processing completes quickly
5. User applies effects
6. User adds to cart

**Chrome MCP Full Flow**:
```javascript
// 1. Navigate (triggers auto-warm)
mcp__chrome-devtools__navigate_page({
  url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/pages/pet-background-remover"
})

// 2. Wait for warming to complete
mcp__chrome-devtools__wait_for({
  text: "API warmed successfully",
  timeout: 90000
})

// 3. Take snapshot to find upload button
mcp__chrome-devtools__take_snapshot()

// 4. Upload test image
mcp__chrome-devtools__upload_file({
  uid: "UPLOAD_BUTTON_UID",
  filePath: "C:\\path\\to\\test-pet.jpg"
})

// 5. Monitor processing
mcp__chrome-devtools__wait_for({
  text: "Processing complete",
  timeout: 10000  // Should be fast if warmed
})

// 6. Verify timing
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    return {
      wasWarmed: window.apiWarmingState.isWarm,
      processingTime: /* extract from UI */
    };
  }`
})
```

**Success Criteria**:
- [ ] Warming completes before user uploads
- [ ] Processing takes <10s (warmed)
- [ ] No errors in console
- [ ] User experience smooth

---

### Test 6.2: Product Page Integration
**Objective**: Test warming on product pages with pet selector

**Pages to Test**:
- Product pages with pet image upload
- Should warming trigger here too?

**Current Implementation**:
api-warmer.js line 124-130 includes `.pet-upload-area` - check if exists on product pages.

**Chrome MCP Commands**:
```javascript
// Navigate to product page
mcp__chrome-devtools__navigate_page({
  url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/products/[product-handle]"
})

// Check if warming triggers
mcp__chrome-devtools__list_console_messages()

// Check if pet upload area exists
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    return {
      petUploadAreaExists: !!document.querySelector('.pet-upload-area'),
      petProcessorExists: !!document.querySelector('.ks-pet-processor-section'),
      apiWarmerLoaded: !!window.APIWarmer
    };
  }`
})
```

**Success Criteria**:
- [ ] Warming triggers on product pages IF pet upload available
- [ ] No warming on non-pet product pages (unnecessary)

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Verify staging URL is accessible
- [ ] Verify API revision 00091-mat is deployed
- [ ] Clear browser cache and localStorage
- [ ] Open Chrome DevTools console
- [ ] Have test pet image ready (800x800+, JPEG/PNG)

### Desktop Tests (1-2 hours)
- [ ] Test 1.1: Page Load Warming ✓/✗
- [ ] Test 1.2: Intent-Based Warming ✓/✗
- [ ] Test 1.3: Response Field Validation ✓/✗
- [ ] Test 4.1: Cold vs Warm Performance ✓/✗
- [ ] Test 5.1: Network Failure Handling ✓/✗

### Mobile Tests (30-60 min)
- [ ] Test 2.1: Mobile Viewport Warming ✓/✗
- [ ] Test 2.2: Mobile Network Conditions ✓/✗

### Cross-Tab Tests (30 min)
- [ ] Test 3.1: Duplicate Prevention ✓/✗
- [ ] Test 3.2: Lock Expiry Handling ✓/✗

### Integration Tests (30 min)
- [ ] Test 6.1: Full User Flow ✓/✗
- [ ] Test 6.2: Product Page Integration ✓/✗

---

## Chrome MCP Quick Reference

### Essential Commands for This Test

**1. Start Testing Session**
```javascript
// List all pages
mcp__chrome-devtools__list_pages()

// Navigate to staging
mcp__chrome-devtools__navigate_page({
  url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/pages/pet-background-remover"
})
```

**2. Monitor Warming**
```javascript
// Check console for warming messages
mcp__chrome-devtools__list_console_messages()

// Check network for /warmup call
mcp__chrome-devtools__list_network_requests({
  resourceTypes: ["xhr", "fetch"]
})

// Get specific warmup request details
mcp__chrome-devtools__get_network_request({
  url: "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup"
})
```

**3. Inspect State**
```javascript
// Check warming state
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    return {
      apiWarmingState: window.apiWarmingState,
      localStorage_warming: localStorage.getItem('api_warming_active'),
      APIWarmerExists: !!window.APIWarmer,
      currentTime: Date.now()
    };
  }`
})
```

**4. Mobile Testing**
```javascript
// Resize to mobile (iPhone SE)
mcp__chrome-devtools__resize_page({
  width: 375,
  height: 667
})

// Emulate slow network
mcp__chrome-devtools__emulate_network({
  throttlingOption: "Slow 4G"
})
```

**5. Visual Verification**
```javascript
// Take screenshot
mcp__chrome-devtools__take_screenshot({
  fullPage: false,
  format: "png"
})

// Take page snapshot (text-based)
mcp__chrome-devtools__take_snapshot()
```

---

## Expected Issues & Solutions

### Issue 1: Warming Not Triggered
**Symptoms**: No console logs, no network request

**Diagnostic**:
```javascript
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    return {
      APIWarmerExists: typeof APIWarmer !== 'undefined',
      scriptLoaded: !!document.querySelector('script[src*="api-warmer"]'),
      readyState: document.readyState
    };
  }`
})
```

**Possible Causes**:
- Script not loaded (defer attribute delay)
- JavaScript error preventing execution
- Element selectors not matching (line 124-130)

**Solution**: Check console for errors, verify script loaded

---

### Issue 2: Error Field Not Checked
**Symptoms**: Code marks API as warm even when `error: true`

**Current Code Gap**: api-warmer.js doesn't check `error` field

**Solution**: Update code to check error field BEFORE setting isWarm

**Recommended Fix**:
```javascript
// In api-warmer.js around line 84-96
if (response.ok) {
  const data = await response.json();

  // NEW: Check error field from backend fix
  if (data.error === true) {
    console.warn('API warmup reported error:', data.message || 'Unknown error');
    return false;
  }

  if (data.model_ready) {
    // ... existing code
  }
}
```

---

### Issue 3: Cross-Tab Coordination Fails
**Symptoms**: Multiple tabs warming simultaneously

**Diagnostic**:
```javascript
// Check localStorage lock
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const lockValue = localStorage.getItem('api_warming_active');
    const now = Date.now();
    return {
      lockExists: !!lockValue,
      lockTimestamp: lockValue ? parseInt(lockValue) : null,
      ageMs: lockValue ? now - parseInt(lockValue) : null,
      isExpired: lockValue ? (now - parseInt(lockValue)) > 60000 : null
    };
  }`
})
```

**Possible Causes**:
- BroadcastChannel not supported (Safari)
- localStorage access blocked (privacy mode)
- Race condition on simultaneous page loads

**Solution**: Test in different browsers, check privacy settings

---

### Issue 4: Mobile Touch Not Working
**Symptoms**: Hover works but touch doesn't trigger warming

**Diagnostic**: Check if touch events registered

**Code Check**: Line 149 in api-warmer.js
```javascript
el.addEventListener('touchstart', warmOnIntent, { once: true, passive: true });
```

**Test**:
```javascript
// Simulate touch event
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const uploadArea = document.querySelector('.pet-upload-area');
    if (uploadArea) {
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [{ clientX: 100, clientY: 100 }]
      });
      uploadArea.dispatchEvent(touchEvent);
      return 'Touch event dispatched';
    }
    return 'Upload area not found';
  }`
})
```

---

## Success Metrics Summary

### Must Pass (Critical)
- ✅ Warmup endpoint called on page load: **YES/NO**
- ✅ Response includes `error: false`: **YES/NO**
- ✅ Mobile viewport works: **YES/NO**
- ✅ Performance improvement >75%: **YES/NO**

### Should Pass (Important)
- ✅ Intent-based warming works: **YES/NO**
- ✅ Cross-tab coordination works: **YES/NO**
- ✅ Error handling graceful: **YES/NO**
- ✅ No console errors: **YES/NO**

### Nice to Have (Optimization)
- ✅ Warmup completes in <60s: **YES/NO**
- ✅ BroadcastChannel works: **YES/NO**
- ✅ Visual feedback during warming: **YES/NO**

---

## Test Report Template

```
# API Warming Test Report
Date: YYYY-MM-DD
Tester: [Name]
Staging URL: https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/
API Revision: 00091-mat

## Desktop Tests
- Page Load Warming: ✓/✗ - [notes]
- Intent Warming: ✓/✗ - [notes]
- Response Validation: ✓/✗ - [notes]
- Performance: Cold=XXs, Warm=XXs, Improvement=XX%

## Mobile Tests
- Mobile Viewport: ✓/✗ - [notes]
- Slow Network: ✓/✗ - [notes]
- Touch Events: ✓/✗ - [notes]

## Cross-Tab Tests
- Duplicate Prevention: ✓/✗ - [notes]
- Lock Expiry: ✓/✗ - [notes]

## Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Reproduction steps
   - Recommended fix

## Overall Result
PASS / FAIL / PARTIAL

## Recommendations
- [Action items]
```

---

## Next Steps After Testing

### If All Tests Pass
1. Monitor production metrics for 24 hours
2. Track warmup success rate (target >95%)
3. Measure user-facing performance improvements
4. Consider adding warmup analytics dashboard

### If Tests Fail
1. Document specific failure points
2. Create bug reports with reproduction steps
3. Prioritize fixes by severity:
   - **P0**: Warming doesn't work at all
   - **P1**: Error field not checked (silent failures)
   - **P2**: Cross-tab coordination issues
   - **P3**: Minor UX improvements

### Code Improvements Identified
1. **Add error field check** in api-warmer.js (line 85)
2. **Add visual feedback** during long warmups
3. **Consider warmup analytics** (track success/failure rates)
4. **Add retry limit** (currently retries indefinitely)

---

## Appendix: Testing Tools & Resources

### Chrome DevTools MCP Tools Used
- `list_pages` - Browser tab management
- `navigate_page` - Page navigation
- `take_snapshot` - Element inspection
- `list_console_messages` - Console monitoring
- `list_network_requests` - Network monitoring
- `get_network_request` - Request detail inspection
- `evaluate_script` - State inspection
- `resize_page` - Viewport testing
- `emulate_network` - Network throttling
- `take_screenshot` - Visual verification
- `wait_for` - Async operation waiting

### Test Resources Needed
- Test pet image (800x800+, JPEG, realistic pet photo)
- Multiple browser tabs for cross-tab testing
- Network throttling capability
- Performance monitoring tools

### Related Files
- `assets/api-warmer.js` - Primary warming implementation
- `assets/api-client.js` - Secondary warmup method
- `sections/ks-pet-processor-v5.liquid` - Integration point
- `testing/verify-warming-failsafes.html` - Existing test harness
- `.claude/tasks/context_session_20250921_162255.md` - Session context

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Status**: Ready for execution
