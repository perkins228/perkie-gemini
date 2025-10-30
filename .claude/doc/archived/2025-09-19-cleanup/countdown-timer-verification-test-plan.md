# Countdown Timer Verification Test Plan

**Date**: 2025-08-20  
**Target URL**: https://mn492f3r21ffju4g-2930573424.shopifypreview.com/pages/custom-image-processing  
**Objective**: Verify countdown timer accuracy WITHOUT ASSUMPTIONS about deployed changes

## Test Overview

We recently made changes to fix timer accuracy but need to verify what's ACTUALLY deployed and working on the preview site. This test plan captures real behavior vs expected behavior.

## What We THINK We Fixed (To Be Verified)
- Timer should show 85 seconds for cold starts (not 25-45s)
- Timer should show 7 seconds for warm starts  
- Two-phase progress messages should appear

## Test Environment Setup

### Browser Requirements
- Test on both desktop and mobile (70% mobile traffic)
- Use real devices when possible, not just browser dev tools
- Clear browser cache between test runs

### Data Collection Strategy
- Record all timer displays and actual processing times
- Capture console logs and network requests
- Take screenshots of timer states
- Document any discrepancies between expected vs actual

## Test Plan Execution Steps

### Phase 1: Initial Page Analysis

#### Step 1.1: Page Load Inspection
**Action**: Navigate to page and inspect initial state
**Data to Capture**:
- Page load time
- JavaScript files loaded (check if timer fixes are present)
- Console errors on page load
- Initial timer/UI state

**Playwright Commands**:
```javascript
// Navigate and wait for page load
await page.goto('https://mn492f3r21ffju4g-2930573424.shopifypreview.com/pages/custom-image-processing');
await page.waitForLoadState('networkidle');

// Capture initial state
await page.screenshot({ path: 'initial-page-state.png' });

// Check console messages
const consoleMessages = await page.locator('console').allTextContents();

// Verify JavaScript loaded
const scripts = await page.locator('script[src*="pet-processor"]').count();
```

#### Step 1.2: Upload Interface Inspection
**Action**: Locate and inspect upload interface elements
**Data to Capture**:
- Upload button/area visibility
- Drag-drop functionality present
- Timer UI elements (hidden/visible state)
- Effect selection buttons

### Phase 2: Cold Start Timer Test (First Request)

#### Step 2.1: First Upload Test
**Action**: Upload test image and measure full cold start behavior
**Data to Capture**:
- Timer countdown displayed value (expected: 85 seconds)
- Actual processing time (expected: ~11 seconds)
- Progress messages shown
- Any error states or timeouts

**Test Image**: Use consistent test image for all runs

**Detailed Measurements**:
```javascript
// Record start time
const startTime = Date.now();

// Upload image and start timer monitoring
await page.setInputFiles('input[type="file"]', 'test-images/test-pet.jpg');

// Monitor timer display
const timerElement = page.locator('[data-timer], .timer, .countdown'); // Multiple selectors
const initialTimerValue = await timerElement.textContent();

// Monitor every second for first 10 seconds
const timerValues = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  const currentValue = await timerElement.textContent();
  timerValues.push({
    second: i + 1,
    displayValue: currentValue,
    timestamp: Date.now() - startTime
  });
}

// Wait for completion and record actual time
await page.waitForSelector('.processing-complete, .result-image', { timeout: 120000 });
const actualProcessingTime = Date.now() - startTime;
```

#### Step 2.2: Progress Message Analysis
**Action**: Monitor progress messages during cold start
**Data to Capture**:
- Initial message displayed
- Message changes during processing
- Two-phase messaging (if implemented)
- Final completion message

### Phase 3: Warm Start Timer Test (Second Request)

#### Step 3.1: Second Upload Test (Same Session)
**Action**: Immediately upload another image to test warm start
**Data to Capture**:
- Timer countdown displayed value (expected: 7 seconds)
- Actual processing time (expected: ~3 seconds)
- Different behavior vs cold start
- Cache/session indicators

**Critical Timing**:
```javascript
// Wait minimal time between uploads
await page.waitForTimeout(2000);

// Start second upload immediately
const startTime2 = Date.now();
await page.setInputFiles('input[type="file"]', 'test-images/test-pet2.jpg');

// Monitor warm start timer
const timerElement2 = page.locator('[data-timer], .timer, .countdown');
const warmStartTimer = await timerElement2.textContent();

// Record actual warm processing time
await page.waitForSelector('.processing-complete, .result-image', { timeout: 30000 });
const actualWarmTime = Date.now() - startTime2;
```

### Phase 4: Cross-Device Testing

#### Step 4.1: Mobile Device Testing
**Action**: Repeat tests on mobile breakpoint/device
**Data to Capture**:
- Mobile timer display differences
- Touch interaction behavior
- Performance differences on mobile
- Responsive layout issues

#### Step 4.2: Browser Compatibility
**Action**: Test across major browsers
**Browsers**: Chrome, Safari, Firefox, Edge
**Data to Capture**:
- Browser-specific timer behavior
- JavaScript compatibility issues
- Performance variations

### Phase 5: Error Scenarios

#### Step 5.1: Network Interruption Test
**Action**: Test timer behavior with network issues
**Data to Capture**:
- Timer behavior during network loss
- Error recovery mechanisms
- Timeout handling

#### Step 5.2: Large File Test
**Action**: Test with larger image file
**Data to Capture**:
- Timer accuracy with extended processing
- UI responsiveness during long operations
- Memory usage patterns

## Data Collection Template

### Test Run Record
```
Test Run #: ___
Date/Time: ___
Browser: ___
Device: ___

COLD START TEST:
- Timer Display Initial: ___ seconds
- Timer Display After 5s: ___ seconds  
- Timer Display After 10s: ___ seconds
- Actual Processing Time: ___ ms
- Progress Messages: ___

WARM START TEST:
- Timer Display Initial: ___ seconds
- Actual Processing Time: ___ ms
- Behavior Differences: ___

DISCREPANCIES:
- Expected vs Actual Timer: ___
- Expected vs Actual Processing: ___
- Missing Features: ___
- Unexpected Behaviors: ___
```

## Success Criteria

### Timer Accuracy
- ✅ Cold start timer shows 85 seconds (±5 seconds acceptable)
- ✅ Warm start timer shows 7 seconds (±2 seconds acceptable)
- ✅ Timer countdown properly decrements
- ✅ Timer accuracy within 10% of actual processing time

### Progress Communication
- ✅ Two-phase progress messages appear
- ✅ Messages are user-friendly (not technical)
- ✅ Clear expectation management for cold vs warm

### Performance Consistency
- ✅ Cold starts consistently ~11 seconds (±3 seconds)
- ✅ Warm starts consistently ~3 seconds (±1 second)
- ✅ No unexpected timeouts or errors

## Failure Investigation Steps

### If Timer Shows Wrong Values
1. Inspect JavaScript console for errors
2. Check network requests to API endpoints
3. Verify timer update mechanism in code
4. Test with different image sizes/types

### If Processing Times Don't Match Timer
1. Monitor actual API response times
2. Check for caching issues
3. Verify API endpoint being used
4. Test during different times of day (cold start variations)

### If Progress Messages Missing
1. Check JavaScript implementation
2. Verify UI element selectors
3. Test with different user flows
4. Check mobile vs desktop differences

## Implementation Notes

### Playwright Specific Commands
```javascript
// Wait for timer element to appear
await page.waitForSelector('[data-timer]', { timeout: 5000 });

// Monitor multiple potential timer selectors
const timerSelectors = [
  '[data-timer]',
  '.countdown-timer',
  '.processing-timer', 
  '.eta-display',
  '.time-remaining'
];

// Take screenshots at key moments
await page.screenshot({ path: `timer-state-${Date.now()}.png` });

// Monitor console for timer-related logs
page.on('console', msg => {
  if (msg.text().includes('timer') || msg.text().includes('countdown')) {
    console.log('Timer Log:', msg.text());
  }
});
```

### Network Monitoring
```javascript
// Monitor API requests
page.on('request', request => {
  if (request.url().includes('inspirenet') || request.url().includes('process')) {
    console.log('API Request:', request.url(), request.method());
  }
});

page.on('response', response => {
  if (response.url().includes('inspirenet') || response.url().includes('process')) {
    console.log('API Response:', response.url(), response.status(), 'Time:', Date.now());
  }
});
```

## Expected Deliverables

1. **Test Results Summary**: Complete data collection for all test scenarios
2. **Discrepancy Report**: Detailed list of expected vs actual behaviors  
3. **Performance Metrics**: Actual timing data vs expected values
4. **Browser Compatibility Matrix**: Results across different browsers/devices
5. **Bug Report**: Any issues found with reproduction steps
6. **Deployment Verification**: Confirmation of which changes are actually live

## Risk Assessment

### High Risk Areas
- Cold start timer accuracy (critical for user expectations)
- Mobile performance differences (70% of traffic)
- API availability during testing
- Cache/session management between tests

### Mitigation Strategies
- Test multiple times to confirm consistency
- Use incognito/private browsing for clean sessions
- Test during different times to account for API cold starts
- Document any external factors affecting results

## Post-Test Actions

### If Tests Pass
- Document successful deployment
- Update context file with verification results
- Plan any additional monitoring

### If Tests Fail
- Create detailed bug report with reproduction steps
- Identify which changes didn't deploy properly
- Plan remediation strategy
- Update implementation if needed

---

**Note**: This test plan focuses on empirical observation rather than assumptions. The goal is to document what's ACTUALLY happening on the preview site versus what we expect to be happening.