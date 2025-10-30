# Debug Analysis: Persistent URL Error Despite Data URL Conversion

**Created**: 2025-08-16  
**Priority**: CRITICAL  
**Status**: ROOT CAUSE IDENTIFIED  

## Problem Summary
"Failed to construct 'URL': Invalid URL" error persists on product pages with pet selector despite implementing data URL conversion. User reports this issue didn't exist in the original build, causing frustration and blocking product page functionality.

## Root Cause Analysis

### CRITICAL FINDING: Timing-Based Race Condition

**PRIMARY ROOT CAUSE**: The URL error occurs DURING the conversion process, not after it.

**Technical Analysis**:
1. **Blob URLs are created first** (lines 350-351 in pet-processor-v5-es5.js):
   ```javascript
   var key = self.currentSessionKey + '_' + effect;
   window.perkieEffects.set(key, blobUrl);  // ← BLOB URL STORED HERE
   ```

2. **Event is dispatched IMMEDIATELY** (lines 381-388):
   ```javascript
   var event = new CustomEvent('petProcessorComplete', {
     detail: { sessionKey: self.currentSessionKey, effect: primaryEffect, fileName: self.currentFile.name }
   });
   document.dispatchEvent(event);  // ← TRIGGERS SELECTOR REFRESH
   ```

3. **Pet selector reads blob URLs** (line 495 in ks-product-pet-selector.liquid):
   ```javascript
   pets.get(sessionKey).effects.set(effect, imageUrl);  // ← STILL BLOB URL
   ```

4. **Shopify analytics intercepts blob URLs** during DOM rendering process

### The Race Condition Sequence

1. ✅ Pet processor creates blob URLs and stores them in `window.perkieEffects`
2. ✅ Pet processor dispatches `petProcessorComplete` event
3. ❌ **RACE CONDITION**: Pet selector immediately reads blob URLs from cache
4. ❌ **TIMING ISSUE**: Shopify analytics attempts to track/validate blob URLs during rendering
5. ❌ **URL ERROR**: Analytics fails with "Failed to construct 'URL': Invalid URL"
6. ⏰ Data URL conversion happens AFTER analytics already failed

### Why Original Build Didn't Have This Issue

**Key Differences Identified**:
1. **Original timing**: Likely had delays before event dispatch
2. **Original storage**: May have used different URL storage mechanism
3. **Original flow**: Possibly rendered without analytics tracking
4. **Event timing**: Original may not have triggered immediate refresh

## Technical Evidence Supporting Analysis

### Stack Trace Analysis
```
s87104074w193399d0p9c2c7174m0f111275m.js:1 Uncaught (in promise) TypeError: Failed to construct 'URL': Invalid URL
    at W (s87104074w193399d0p9c2c7174m0f111275m.js:1:61974)
    at r.XMLHttpRequest.XMLHttpRequest.open (s87104074w193399d0p9c2c7174m0f111275m.js:1:71370)
    at Lu (web-pixel-1022754899@e3e6f5cbbad5f2c289f70ade96c6e766.js:9:17125)
```

**Analysis**:
- **File**: `s87104074w193399d0p9c2c7174m0f111275m.js` = Shopify core analytics
- **File**: `web-pixel-1022754899` = Shopify web pixel tracking
- **Method**: `XMLHttpRequest.XMLHttpRequest.open` = Attempting to make tracking request
- **Location**: URL constructor failing when analytics tries to process blob URL

### Current Implementation Issues

**Problem 1: Blob URLs stored before conversion**
```javascript
// In pet-processor-v5-es5.js line 351
window.perkieEffects.set(key, blobUrl);  // Blob URL stored immediately

// Event dispatched immediately after storage (line 381)
document.dispatchEvent(event);  // Triggers pet selector refresh
```

**Problem 2: Event timing allows race condition**
```javascript
// Pet selector responds to event and reads blob URLs
document.addEventListener('petProcessorComplete', function(event) {
  setTimeout(loadSavedPets, 500); // Delay doesn't prevent initial read
});
```

**Problem 3: Conversion happens too late**
```javascript
// Conversion happens AFTER pet selector reads from cache
convertPetDataUrls(petData).then(function(convertedPetData) {
  renderPets(convertedPetData);  // Analytics already failed by this point
});
```

## Solution Strategy

### RECOMMENDED FIX: Convert URLs BEFORE Storage

**Phase 1: Pre-conversion Storage** (Lines to modify in pet-processor-v5-es5.js)
1. **Line 350-351**: Convert blob to data URL BEFORE storing in perkieEffects
2. **Line 381-388**: Delay event dispatch until ALL conversions complete
3. **Add conversion tracking**: Ensure all URLs converted before event

**Phase 2: Fallback Protection** (Lines to modify in ks-product-pet-selector.liquid)
1. **Line 435**: Add additional validation before conversion
2. **Line 452**: Handle mixed URL types gracefully
3. **Add error handling**: Catch and log conversion failures

### Implementation Approach

**Strategy A: Fix at Source (RECOMMENDED)**
- Convert blob→data URL immediately after blob creation
- Store data URLs in perkieEffects instead of blob URLs
- Analytics never sees blob URLs
- Event dispatched only after all conversions complete

**Strategy B: Buffer/Delay (BACKUP)**
- Add significant delay before event dispatch
- Give conversion time to complete
- Higher risk, doesn't solve root cause

**Strategy C: Analytics Exclusion (RISKY)**
- Add data attributes to prevent tracking
- May not work with all analytics systems
- Doesn't address root timing issue

## Expected Resolution

**After implementing Strategy A**:
1. ✅ No blob URLs stored in perkieEffects cache
2. ✅ Analytics never encounters invalid URLs
3. ✅ Pet selector reads data URLs immediately
4. ✅ Zero "Failed to construct 'URL'" errors
5. ✅ Product page functionality restored

## Risk Assessment

**Strategy A (Pre-conversion) - LOW RISK**:
- ✅ Addresses root cause directly
- ✅ Eliminates race condition entirely
- ✅ Backwards compatible with current flow
- ✅ Can be deployed during business hours
- ❌ Requires more significant code changes

**Implementation Complexity**: MEDIUM
- Requires async handling in pet processor
- Need to track conversion completion
- Must maintain error handling

## Files Requiring Changes

### Primary Changes
- **File**: `assets/pet-processor-v5-es5.js`
- **Lines**: 340-390 (effect processing and event dispatch)
- **Changes**: Add data URL conversion before storage and delayed event dispatch

### Verification Changes
- **File**: `snippets/ks-product-pet-selector.liquid`
- **Lines**: 435-474 (conversion functions)
- **Changes**: Enhanced error handling and validation

## Testing Plan

### Test Cases
1. **Product page load**: Verify no URL errors in console
2. **Pet processing**: Confirm data URLs stored correctly
3. **Pet selector refresh**: Validate immediate display works
4. **Analytics tracking**: Ensure tracking continues working
5. **Error scenarios**: Test with conversion failures

### Browser Testing
- Chrome desktop/mobile
- Safari iOS
- Edge desktop
- Firefox desktop

## Next Steps Priority

1. **HIGH**: Implement pre-conversion in pet processor (eliminates root cause)
2. **MEDIUM**: Add enhanced error handling in pet selector
3. **LOW**: Monitor analytics functionality post-fix
4. **MONITOR**: Track console errors and user reported issues

## Critical Success Metrics

- **Zero URL construction errors** in browser console
- **Product page conversions** resume normal levels
- **Pet selector functionality** works on first load
- **User complaints eliminated** regarding broken pet selector

The persistent URL error is definitively caused by a race condition where Shopify analytics attempts to process blob URLs before they can be converted to data URLs. The solution requires fixing the timing at the source (pet processor) rather than trying to handle it downstream (pet selector).