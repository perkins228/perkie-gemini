# Code Review: PetStorage Race Condition Fix

**Date**: 2025-11-06
**Reviewer**: Code Quality Reviewer
**Component**: Pet Processor - Add to Product Flow
**Severity**: CRITICAL
**Decision**: ⚠️ **CONDITIONAL GO** (see recommended improvements)

---

## Executive Summary

The proposed fix addresses a genuine script loading race condition where `PetStorage` may be undefined when `savePetData()` executes. The solution is **functionally correct** but has several concerns around user experience, error handling, and architectural approach.

**Score**: 6.5/10

**Verdict**: GO with mandatory improvements (listed in Recommended Actions)

---

## Code Review Summary

The debug specialist correctly identified a race condition bug where deferred script loading causes `PetStorage` to be undefined when "Add to Product" is clicked immediately after processing completes. The proposed polling-based wait loop is a valid defensive programming pattern, but the implementation needs refinement for production e-commerce use.

---

## Critical Issues

### None Identified

The fix correctly addresses the root cause and won't introduce new bugs.

---

## Major Concerns

### 1. Silent Degradation During Wait Period (UX Issue)

**Problem**: User clicks "Add to Product" → button disables → 0-2 seconds of silence → action completes

**Current Code**:
```javascript
while (typeof PetStorage === 'undefined' && retries < maxRetries) {
  await new Promise(resolve => setTimeout(resolve, 100));
  retries++;
}
```

**Issue**: No visual feedback during wait. Button appears "stuck" or "broken" to users.

**Impact**:
- Mobile users (70% of traffic) may think the button didn't work
- Multiple rapid clicks attempting to "fix" the stuck button
- Increased bounce rate during critical conversion moment

**Recommended Fix**:
```javascript
if (typeof PetStorage === 'undefined') {
  console.log('⏳ PetStorage not loaded yet, waiting...');

  // Show loading state to user
  const btn = this.container.querySelector('.add-to-cart-btn');
  const originalText = btn?.textContent || '';
  if (btn) {
    btn.textContent = '⏳ Preparing...';
    btn.disabled = true;
  }

  let retries = 0;
  const maxRetries = 20; // 2 seconds max (100ms * 20)

  while (typeof PetStorage === 'undefined' && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  // Restore button or show error
  if (typeof PetStorage === 'undefined') {
    console.error('❌ PetStorage failed to load after 2 seconds');
    if (btn) {
      btn.textContent = '❌ Failed - please try again';
      btn.disabled = false; // Re-enable for retry
      setTimeout(() => {
        btn.textContent = originalText;
      }, 3000);
    }
    return false;
  }

  // Success - restore button text before continuing
  if (btn) {
    btn.textContent = originalText;
  }
  console.log(`✅ PetStorage loaded after ${retries * 100}ms`);
}
```

**Why This Matters**: 70% mobile traffic means users expect instant visual feedback. A frozen button = broken experience.

---

### 2. Insufficient Error Telemetry

**Problem**: When timeout occurs, we don't know WHY PetStorage failed to load.

**Current Code**:
```javascript
if (typeof PetStorage === 'undefined') {
  console.error('❌ PetStorage failed to load after 2 seconds');
  // Show error to user...
  return false;
}
```

**Missing Context**:
- Was the script actually requested?
- Did it load but fail to execute?
- Was there a network error?
- Is there a JavaScript syntax error blocking execution?

**Recommended Addition**:
```javascript
if (typeof PetStorage === 'undefined') {
  // Enhanced debugging for production troubleshooting
  console.error('❌ PetStorage failed to load after 2 seconds');
  console.error('Debug info:', {
    scriptTag: document.querySelector('script[src*="pet-storage.js"]') ? 'present' : 'missing',
    allScripts: Array.from(document.scripts).map(s => s.src).filter(s => s.includes('pet-')),
    documentReadyState: document.readyState,
    deferredScriptsCount: document.querySelectorAll('script[defer]').length
  });

  // Log to analytics if available (for production monitoring)
  if (window.gtag) {
    gtag('event', 'pet_storage_load_failure', {
      'event_category': 'error',
      'event_label': 'script_load_timeout',
      'value': retries * 100
    });
  }

  // Show user-friendly error...
}
```

**Why This Matters**: Production debugging requires understanding failure modes. Console logs disappear; analytics data persists.

---

### 3. Inconsistent Error Handling Pattern

**Problem**: The proposed fix only protects `savePetData()`, but `PetStorage` is used in other places.

**Other Usage** (from grep results):
- Line 523: `loadEffectImages()` already has protection
- Line 1891: `savePetData()` → being fixed
- Unknown locations: `PetStorage.getAll()`, `PetStorage.emergencyCleanup()`, etc.

**Risk**: Partial fix creates inconsistent behavior. Other code paths may still fail.

**Recommended Action**:
Create a centralized `waitForPetStorage()` utility method to standardize the pattern:

```javascript
// Add to PetProcessor class (around line 200-300)
async waitForPetStorage(timeoutMs = 2000) {
  if (typeof PetStorage !== 'undefined') {
    return true; // Already available
  }

  console.log('⏳ Waiting for PetStorage to load...');
  const startTime = Date.now();
  const checkInterval = 100;

  while (typeof PetStorage === 'undefined' && (Date.now() - startTime) < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  const loaded = typeof PetStorage !== 'undefined';
  if (!loaded) {
    console.error(`❌ PetStorage failed to load after ${timeoutMs}ms`);
  } else {
    console.log(`✅ PetStorage loaded after ${Date.now() - startTime}ms`);
  }

  return loaded;
}
```

Then use it consistently:
```javascript
async savePetData() {
  // ... validation ...

  // Wait for PetStorage with user feedback
  const btn = this.container.querySelector('.add-to-cart-btn');
  const originalText = btn?.textContent || '';

  if (btn && typeof PetStorage === 'undefined') {
    btn.textContent = '⏳ Preparing...';
  }

  const loaded = await this.waitForPetStorage();

  if (!loaded) {
    if (btn) {
      btn.textContent = '❌ Failed - please try again';
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = originalText;
      }, 3000);
    }
    return false;
  }

  if (btn) {
    btn.textContent = originalText;
  }

  // ... rest of save logic ...
}
```

**Why This Matters**: DRY principle. Single source of truth for retry logic prevents drift and inconsistencies.

---

## Minor Issues

### 1. Magic Numbers Without Configuration

**Current Code**:
```javascript
const maxRetries = 20; // 2 seconds max (100ms * 20)
```

**Better Approach**:
```javascript
// At class level (around line 50-100)
static SCRIPT_LOAD_TIMEOUT_MS = 2000;
static SCRIPT_LOAD_CHECK_INTERVAL_MS = 100;

// In method
const maxRetries = Math.ceil(this.constructor.SCRIPT_LOAD_TIMEOUT_MS / this.constructor.SCRIPT_LOAD_CHECK_INTERVAL_MS);
```

**Why**: Makes timeout adjustable for testing/debugging without code changes.

---

### 2. Timing Assumption May Be Too Generous

**Current**: 2-second timeout (20 retries × 100ms)

**Concern**: For deferred scripts on normal connections, load time should be 100-500ms. A 2-second timeout suggests something is fundamentally broken.

**Consideration**: Should the timeout be shorter (500ms) to fail faster and surface underlying issues?

**Counter-argument**: Mobile users on slow networks may genuinely need 1-2 seconds.

**Recommendation**: Keep 2 seconds but add analytics to track actual wait times. If 95th percentile is < 500ms, we can reduce timeout in future.

---

### 3. Missing Accessibility Concern

**Current Error Message**:
```javascript
btn.textContent = '❌ Failed - please try again';
```

**Issue**: Screen reader users won't be notified of the state change without ARIA live region.

**Better Approach**:
```javascript
// Add ARIA live region to button parent
const container = btn.parentElement;
if (!container.querySelector('.sr-only-status')) {
  const statusDiv = document.createElement('div');
  statusDiv.className = 'sr-only-status';
  statusDiv.setAttribute('role', 'status');
  statusDiv.setAttribute('aria-live', 'polite');
  container.appendChild(statusDiv);
}

// Update status for screen readers
const status = container.querySelector('.sr-only-status');
if (status) {
  status.textContent = 'Failed to save pet data. Please try again.';
}

// Update button
btn.textContent = '❌ Failed - please try again';
```

**Priority**: Low (minor issue) but important for WCAG compliance.

---

## Suggestions

### 1. Consider Preloading Critical Scripts

**Alternative Approach**: Instead of waiting reactively, preload proactively.

**Implementation** (sections/ks-pet-processor-v5.liquid):
```liquid
{% comment %} Preload critical storage script {% endcomment %}
<link rel="preload" href="{{ 'pet-storage.js' | asset_url }}" as="script">

{% comment %} Load normally with defer {% endcomment %}
<script src="{{ 'pet-storage.js' | asset_url }}" defer></script>
```

**Impact**: Browser prioritizes pet-storage.js download, reducing race condition likelihood.

**Caveat**: Doesn't eliminate race condition, just reduces probability. Still need runtime protection.

---

### 2. Add Development Mode Warnings

**Suggestion**: Help future developers understand the wait loop.

```javascript
if (typeof PetStorage === 'undefined') {
  console.log('⏳ PetStorage not loaded yet, waiting...');

  // Development warning (only shows in console)
  if (window.location.hostname.includes('myshopify.com')) {
    console.warn('⚠️ DEVELOPER NOTE: PetStorage race condition detected. This is expected on first load with defer scripts. Waiting up to 2s for script to load.');
  }

  // ... retry loop ...
}
```

**Why**: Prevents confusion when developers see the wait loop executing during testing.

---

### 3. Future: Migrate to ES6 Modules

**Long-term Solution**: Eliminate script order dependencies entirely.

**Current** (script tags):
```html
<script src="pet-storage.js" defer></script>
<script src="pet-processor.js"></script>
```

**Future** (ES6 modules):
```javascript
// pet-processor.js
import { PetStorage } from './pet-storage.js';

// Guaranteed: PetStorage is available or import fails
```

**Blocker**: Requires module bundler or modern module support. Not compatible with current ES5 compatibility requirement.

**Recommendation**: Document as technical debt for future refactor.

---

## What's Done Well

### 1. ✅ Correct Problem Diagnosis

The debug specialist correctly identified:
- Race condition root cause
- Script loading timing issue
- Pre-existing bug (not a regression)
- Impact on conversion flow

### 2. ✅ Defensive Programming Approach

The polling pattern is appropriate for this scenario:
- Non-blocking (async/await)
- Bounded timeout (prevents infinite loops)
- Graceful degradation (returns false on failure)
- User feedback on error

### 3. ✅ Preserves Existing Behavior

The fix doesn't change any working code paths:
- "Process Another Pet" flow unchanged
- Effect switching unchanged
- Product page integration unchanged

### 4. ✅ Comprehensive Debug Documentation

The root cause analysis document is exemplary:
- Clear evidence from Chrome DevTools
- Step-by-step failure reproduction
- Impact assessment
- Multiple solution options

---

## Risk Assessment

### Low Risk ✅

**Breaking Changes**: None
**Regression Risk**: Minimal
**Performance Impact**: Negligible (0-2s one-time delay on slow connections)

### Scenarios That Could Break

1. **PetStorage script blocked by ad blocker**: Timeout triggers, user sees error (acceptable)
2. **JavaScript syntax error in pet-storage.js**: Timeout triggers, user sees error (acceptable)
3. **localStorage disabled**: PetStorage loads but save fails (already handled by existing try/catch)
4. **Very slow connection (> 2s script load)**: Timeout may be too short (monitor analytics)

### Scenarios That Are Covered

✅ Normal operation (PetStorage loads in < 500ms)
✅ Slow network (PetStorage loads in 500ms - 2s)
✅ Script error (timeout triggers error state)
✅ User retry after error (button re-enables)

---

## Alternative Solutions Analysis

### Option 1: Polling Wait Loop (Proposed) ⭐ **SELECTED**

**Pros**:
- Minimal code changes
- Handles race condition gracefully
- User gets clear feedback
- Non-breaking

**Cons**:
- Adds up to 2-second delay (rare)
- Still relies on deferred script loading
- Reactive rather than proactive

**Score**: 7/10

---

### Option 2: Remove `defer` from pet-storage.js

**Pros**:
- PetStorage loads immediately
- Guaranteed availability
- Zero wait time

**Cons**:
- Blocks DOM parsing (bad for Lighthouse score)
- Violates modern loading patterns
- Could cause other timing issues
- Hurts mobile performance (70% of traffic)

**Score**: 3/10 ❌ **REJECTED**

---

### Option 3: Inline Critical PetStorage Methods

**Pros**:
- Guaranteed immediate availability
- No waiting required
- Zero race condition risk

**Cons**:
- Code duplication (maintenance burden)
- Increases HTML size (bad for mobile)
- Violates DRY principle
- Creates two sources of truth

**Score**: 4/10 ❌ **REJECTED**

---

### Option 4: Use `async`/`defer` Combination

**Concept**: Load pet-storage.js with `async` (non-blocking, executes ASAP) instead of `defer` (executes after DOM).

```liquid
<script src="{{ 'pet-storage.js' | asset_url }}" async></script>
```

**Pros**:
- PetStorage loads/executes earlier
- Still non-blocking
- Reduces race condition window

**Cons**:
- Execution order not guaranteed
- Could execute before DOM ready (if PetStorage accesses DOM)
- Still need runtime protection

**Score**: 5/10 ⚠️ **POSSIBLE ALTERNATIVE**

---

### Option 5: Module-based Loading (Future)

**Concept**: Use ES6 modules with explicit imports.

```javascript
import { PetStorage } from './pet-storage.js';
```

**Pros**:
- Eliminates race conditions entirely
- Modern best practice
- Better dependency management

**Cons**:
- Requires build step or native module support
- Breaks ES5 compatibility requirement
- Major refactor

**Score**: 9/10 ⭐ **FUTURE RECOMMENDATION**

---

## Performance Analysis

### Timing Breakdown

**Best Case** (PetStorage already loaded):
- Check: 1ms
- Total delay: ~1ms

**Normal Case** (PetStorage loads in 100-500ms):
- Wait loop: 1-5 iterations
- Total delay: 100-500ms
- User experience: Seamless (button shows "Preparing...")

**Worst Case** (2-second timeout):
- Wait loop: 20 iterations
- Total delay: 2000ms
- User experience: Acceptable with loading state

**Failure Case** (timeout):
- Wait loop: 20 iterations
- Error display: 3 seconds
- Total delay: 5 seconds before retry
- User experience: Clear error, can retry

### Impact on Lighthouse Score

**Current Score**: Unknown
**Predicted Impact**: Negligible

**Reasoning**:
- Wait loop only executes on button click (not on page load)
- Doesn't affect LCP, FCP, or TTI metrics
- User-initiated action (not measured by Lighthouse)

---

## Edge Cases Analysis

### Edge Case 1: Rapid Multiple Clicks

**Scenario**: User clicks "Add to Product" 5 times in 1 second

**Current Code Behavior**:
```javascript
async saveToCart() {
  const saved = await this.savePetData();
  if (!saved) {
    return;  // Exit if save failed
  }
  // ...
}
```

**Issue**: Button disables on first click, but what if user clicks before disable?

**Recommended Protection**:
```javascript
async saveToCart() {
  // Prevent concurrent saves
  if (this._saving) {
    console.log('⏸️ Save already in progress');
    return;
  }

  this._saving = true;

  try {
    const saved = await this.savePetData();
    if (!saved) {
      return;
    }
    // ... redirect logic ...
  } finally {
    this._saving = false;
  }
}
```

---

### Edge Case 2: PetStorage Loads During Wait Loop

**Scenario**: PetStorage becomes available on 10th retry

**Current Behavior**: ✅ Correctly exits loop and continues

**Verification Needed**: None (logic is correct)

---

### Edge Case 3: Browser Back Button After Error

**Scenario**:
1. User gets "Failed - please try again" error
2. User clicks browser back button
3. User re-uploads image and tries again

**Potential Issue**: Button state may be corrupted

**Recommended Protection**: Add cleanup in constructor/init:
```javascript
constructor(container, sectionId) {
  // ... existing code ...

  // Reset any corrupted button states from previous sessions
  const btn = this.container.querySelector('.add-to-cart-btn');
  if (btn && btn.textContent.includes('Failed')) {
    btn.textContent = 'Add to Product';
    btn.disabled = false;
  }
}
```

---

### Edge Case 4: localStorage Disabled

**Scenario**: User has localStorage disabled (privacy mode, browser settings)

**Current Protection**: Existing try/catch in PetStorage.save():
```javascript
} catch (error) {
  console.error('❌ Failed to save pet:', error);
  if (error.name === 'QuotaExceededError') {
    alert('Storage is full. Please refresh the page and try again.');
  }
  return false;
}
```

**Gap**: No specific handling for localStorage disabled (SecurityError)

**Recommended Addition**:
```javascript
} catch (error) {
  console.error('❌ Failed to save pet:', error);
  if (error.name === 'QuotaExceededError') {
    alert('Storage is full. Please refresh the page and try again.');
  } else if (error.name === 'SecurityError') {
    alert('Browser storage is disabled. Please enable storage or use a different browser.');
  }
  return false;
}
```

---

## Recommended Actions

### MUST DO (Before Deployment) 🔴

1. **Add Loading State Feedback** (Major Concern #1)
   - Show "⏳ Preparing..." text while waiting
   - Restore original text on success/failure
   - Estimated effort: 10 minutes

2. **Add Centralized Wait Utility** (Major Concern #3)
   - Create `waitForPetStorage()` method
   - Use consistently across all PetStorage access points
   - Estimated effort: 30 minutes

3. **Enhance Error Telemetry** (Major Concern #2)
   - Add debug context logging
   - Add analytics event (if gtag available)
   - Estimated effort: 15 minutes

4. **Add Concurrent Save Protection** (Edge Case #1)
   - Add `_saving` flag
   - Prevent multiple simultaneous saves
   - Estimated effort: 10 minutes

### SHOULD DO (Before Next Sprint) 🟡

5. **Add ARIA Live Region** (Minor Issue #3)
   - Improve screen reader accessibility
   - Estimated effort: 20 minutes

6. **Add Preload Hint** (Suggestion #1)
   - Reduce race condition probability
   - Estimated effort: 5 minutes

7. **Extract Magic Numbers** (Minor Issue #1)
   - Make timeout configurable
   - Estimated effort: 5 minutes

8. **Add Button State Cleanup** (Edge Case #3)
   - Reset corrupted states in constructor
   - Estimated effort: 10 minutes

### NICE TO HAVE (Technical Debt) 🟢

9. **Add Development Warnings** (Suggestion #2)
   - Help future developers understand wait loop
   - Estimated effort: 5 minutes

10. **Track Wait Time Analytics** (Minor Issue #2)
    - Monitor actual wait times in production
    - Inform future timeout optimization
    - Estimated effort: 15 minutes

11. **Document ES6 Module Migration** (Suggestion #3)
    - Add to technical debt backlog
    - Create migration plan
    - Estimated effort: 1 hour (documentation only)

---

## Testing Checklist

### Unit Testing (Manual)

- [ ] **Fast connection**: PetStorage loads immediately (0-100ms wait)
- [ ] **Slow connection**: Simulate Slow 3G (500ms-2s wait)
- [ ] **Script blocked**: Block pet-storage.js in DevTools → verify error shown
- [ ] **Rapid clicks**: Click "Add to Product" 10 times rapidly → verify single save
- [ ] **Browser back**: Error → back → retry → verify success
- [ ] **localStorage disabled**: Verify appropriate error message

### Integration Testing (Chrome DevTools MCP)

- [ ] **Complete flow**: Upload → process → add to product → verify localStorage
- [ ] **Product page**: Verify pet selector shows saved data
- [ ] **Order properties**: Verify properties populated correctly
- [ ] **Mobile Safari**: Test on real iOS device (70% mobile traffic)
- [ ] **Android Chrome**: Test on real Android device

### Regression Testing

- [ ] **"Process Another Pet"**: Verify still works after fix
- [ ] **Effect switching**: Verify not affected by wait loop
- [ ] **Artist notes**: Verify captured correctly
- [ ] **GCS upload**: Verify processed images uploaded

### Performance Testing

- [ ] **Lighthouse**: Verify no score degradation
- [ ] **Network waterfall**: Verify script load order unchanged
- [ ] **Console logs**: Verify appropriate logging (not too verbose)

### Accessibility Testing

- [ ] **Screen reader**: Test error announcement with NVDA/VoiceOver
- [ ] **Keyboard navigation**: Verify button accessible via keyboard
- [ ] **High contrast**: Verify error text visible in high contrast mode

---

## Go/No-Go Decision

### ⚠️ **CONDITIONAL GO**

**Requirements**:
1. ✅ Implement MUST DO improvements (items 1-4)
2. ✅ Test on real Shopify test URL with network throttling
3. ✅ Verify on actual mobile devices (iOS + Android)

**Reasoning**:
- Core fix is sound and addresses real bug
- User experience concerns can be mitigated with loading state
- Risk is low with proper error handling
- Production e-commerce requires high quality bar

**If improvements not made**: **NO-GO**

**Why**: Silent 2-second delay with no feedback is unacceptable for conversion-critical flow on mobile-first platform (70% mobile traffic).

---

## Final Score Breakdown

| Criterion | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Correctness | 9/10 | 30% | 2.7 |
| Performance | 7/10 | 20% | 1.4 |
| User Experience | 4/10 | 25% | 1.0 |
| Maintainability | 7/10 | 15% | 1.05 |
| Error Handling | 6/10 | 10% | 0.6 |

**Total Score**: 6.75/10 → **6.5/10** (rounded)

**With MUST DO improvements**: **8.5/10**

---

## Summary

**Root Cause**: Script loading race condition - correctly diagnosed ✅
**Proposed Fix**: Polling wait loop - functionally correct ✅
**User Experience**: Needs improvement with loading state 🟡
**Error Handling**: Adequate but can be enhanced 🟡
**Testing Required**: Critical - real Shopify URL + mobile devices 🔴

**Decision**: **CONDITIONAL GO** - Implement MUST DO improvements before deployment

**Estimated Total Effort**: 1.5 hours (including testing)

**Risk Level**: LOW (with improvements)

**Production Ready**: YES (after improvements)

---

## Appendix: Implementation Diff

### Recommended Final Implementation

```javascript
// Add to PetProcessor class (around line 200-300)
/**
 * Wait for PetStorage to become available (handles deferred script loading race condition)
 * @param {number} timeoutMs - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} - True if loaded, false if timeout
 */
async waitForPetStorage(timeoutMs = 2000) {
  if (typeof PetStorage !== 'undefined') {
    return true; // Already available
  }

  console.log('⏳ Waiting for PetStorage to load...');
  const startTime = Date.now();
  const checkInterval = 100;

  while (typeof PetStorage === 'undefined' && (Date.now() - startTime) < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  const loaded = typeof PetStorage !== 'undefined';
  const waitTime = Date.now() - startTime;

  if (!loaded) {
    console.error(`❌ PetStorage failed to load after ${waitTime}ms`);

    // Enhanced debugging
    console.error('Debug info:', {
      scriptTag: document.querySelector('script[src*="pet-storage.js"]') ? 'present' : 'missing',
      documentReadyState: document.readyState,
      deferredScriptsCount: document.querySelectorAll('script[defer]').length
    });

    // Analytics (if available)
    if (window.gtag) {
      gtag('event', 'pet_storage_load_failure', {
        'event_category': 'error',
        'event_label': 'script_load_timeout',
        'value': waitTime
      });
    }
  } else {
    console.log(`✅ PetStorage loaded after ${waitTime}ms`);

    // Track successful load times (for optimization)
    if (window.gtag && waitTime > 100) {
      gtag('event', 'pet_storage_load_success', {
        'event_category': 'performance',
        'event_label': 'script_load_wait',
        'value': waitTime
      });
    }
  }

  return loaded;
}

// Modified savePetData method (lines 1843-1913)
async savePetData() {
  if (!this.currentPet || !this.currentPet.effects) {
    console.error('❌ No current pet or effects available');
    return false;
  }

  // Wait for PetStorage with user feedback
  const btn = this.container.querySelector('.add-to-cart-btn');
  const originalText = btn?.textContent || 'Add to Product';

  if (typeof PetStorage === 'undefined') {
    // Show loading state
    if (btn) {
      btn.textContent = '⏳ Preparing...';
      btn.disabled = true;
    }

    const loaded = await this.waitForPetStorage();

    if (!loaded) {
      // Show error state
      if (btn) {
        btn.textContent = '❌ Failed - please try again';
        btn.disabled = false; // Re-enable for retry

        // Restore after 3 seconds
        setTimeout(() => {
          btn.textContent = originalText;
        }, 3000);
      }
      return false;
    }

    // Restore button text on success
    if (btn) {
      btn.textContent = originalText;
    }
  }

  // Rest of existing method unchanged
  const petName = this.container.querySelector('.pet-name-input')?.value || 'Pet';
  const artistNote = this.getArtistNote();
  const selectedEffect = this.currentPet.selectedEffect || 'enhancedblackwhite';
  const effectData = this.currentPet.effects[selectedEffect];

  if (!effectData || (!effectData.dataUrl && !effectData.gcsUrl)) {
    console.error('❌ Effect data not found for:', selectedEffect);
    return false;
  }

  // ... rest of existing upload and save logic ...
}

// Modified saveToCart method (lines 1915-1966)
async saveToCart() {
  // Prevent concurrent saves
  if (this._saving) {
    console.log('⏸️ Save already in progress');
    return;
  }

  this._saving = true;

  try {
    const saved = await this.savePetData();
    if (!saved) {
      return;  // Exit if save failed
    }

    // ... existing redirect logic ...
  } finally {
    this._saving = false;
  }
}
```

### Files Modified

1. **assets/pet-processor.js**
   - Add `waitForPetStorage()` method (~50 lines)
   - Modify `savePetData()` method (~15 lines changed)
   - Modify `saveToCart()` method (~10 lines changed)
   - **Total**: ~75 lines changed/added

2. **sections/ks-pet-processor-v5.liquid** (optional)
   - Add preload hint for pet-storage.js (~1 line)

### Estimated Changes

- **Lines added**: ~60
- **Lines modified**: ~15
- **Breaking changes**: 0
- **Test coverage needed**: 15 test cases

---

**Review Completed**: 2025-11-06
**Next Action**: Implement MUST DO improvements, then deploy to test environment
**Follow-up**: Monitor analytics for wait times, adjust timeout if needed
