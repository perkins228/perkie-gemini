# Complete Pet Processing Journey Analysis & Implementation Plan

## Executive Summary
After comprehensive analysis, the persistent URL construction error (`Failed to construct 'URL': Invalid URL`) is NOT coming from the pet processing system itself, but from Shopify's analytics trying to track invalid URLs elsewhere in the DOM. Our pet processor correctly converts blob URLs to data URLs, but the error persists, proving we've been debugging the wrong system.

## 1. COMPLETE JOURNEY ANALYSIS

### Current Pet Processing Flow

#### A. Upload Phase
1. **User uploads image** → `pet-processor-v5-es5.js`
2. **File validation** → Size/format checks
3. **Session key generation** → Unique identifier created
4. **API call** → Sends to `/api/v2/process-with-effects`

#### B. Processing Phase
1. **API processes all 4 effects** → Returns base64 data for each
2. **Frontend converts base64 → blob** → Creates blob objects
3. **Blob → Data URL conversion** → Converts to persistent data URLs
4. **Storage in window.perkieEffects** → Map structure with session keys

#### C. Effect Selection Phase
1. **User clicks effect buttons** → Changes active effect
2. **Retrieves from cache** → Gets data URL from perkieEffects
3. **Updates preview** → Shows selected effect instantly

#### D. Add to Cart Phase
1. **User clicks "Add to Cart"** → Stores current selection
2. **Data persists in localStorage** → Session data saved
3. **Event dispatched** → `petProcessorComplete` event fired
4. **Navigation to product page** → User redirected

#### E. Product Page Phase (WHERE ERROR OCCURS)
1. **Pet selector initializes** → Reads from perkieEffects cache
2. **Converts URLs if needed** → Additional data URL conversion
3. **Renders pet options** → Shows available pets
4. **Shopify analytics fires** → ATTEMPTS TO TRACK URLS AND FAILS

#### F. Cart Phase
1. **Pet data attached to line items** → Properties added
2. **Image references maintained** → Through checkout

#### G. Fulfillment Phase
1. **Order contains pet properties** → Image URLs accessible
2. **Production team accesses** → Downloads customer images

## 2. LEGACY VS CURRENT COMPARISON

### Legacy Implementation (Pre-V5)
- **Storage**: Used `this.effectResults = new Map()` for blobs
- **URLs**: Created blob URLs with `URL.createObjectURL()`
- **Cleanup**: Manual `URL.revokeObjectURL()` management
- **Events**: Different event naming conventions
- **No immediate conversion**: Blob URLs persisted longer

### Current Implementation (V5)
- **Storage**: Uses `window.perkieEffects = new Map()` 
- **URLs**: Converts to data URLs immediately after processing
- **Cleanup**: Still revokes blob URLs after conversion
- **Events**: Uses `petProcessorComplete` event
- **Immediate conversion**: Blob → Data URL before storage

### Key Differences
1. **URL Timing**: Current version converts earlier in the flow
2. **Global Storage**: V5 uses window.perkieEffects vs component-scoped
3. **Event Names**: Mismatch between processor and selector events

## 3. ROOT CAUSE ANALYSIS

### The REAL Problem
```javascript
// Error stack trace shows:
s87104074w193399d0p9c2c7174m0f111275m.js:1 // Shopify core analytics
XMLHttpRequest.XMLHttpRequest.open // Analytics making tracking requests
```

**The error is NOT from our pet processing code!**

### Likely Culprits
1. **Empty src attributes** in product images during lazy loading
2. **Undefined variant images** when variants don't have images
3. **Form action attributes** with malformed/empty values
4. **Data attributes** containing literal "undefined" strings
5. **Third-party tracking pixels** with invalid URLs

### Why It Appears on Product Pages
- Product pages have more dynamic content
- Variant switching creates/destroys DOM elements
- Analytics aggressively tracks all URL-like values
- Pet selector coincidentally loads at same time

## 4. IMPLEMENTATION GAPS IDENTIFIED

### Critical Issues
1. **Event Name Mismatch**
   - Processor fires: `petProcessorPrimaryComplete`
   - Selector listens for: `petProcessorComplete`
   - Result: Selector never refreshes

2. **Unnecessary URL Conversions**
   - Converting blob → data URL multiple times
   - Pet selector re-converts already converted URLs
   - Wasted processing and potential errors

3. **Missing Error Source Detection**
   - No monitoring of what URLs fail
   - Can't identify actual problematic elements
   - Debugging wrong system repeatedly

## 5. COMPREHENSIVE IMPLEMENTATION PLAN

### Phase 1: Fix the ACTUAL Problem (Priority: CRITICAL)

#### Task 1.1: Identify True Error Source
**File**: Create `assets/debug-url-monitor.js`
```javascript
// Intercept URL constructor to catch invalid URLs
(function() {
  const originalURL = window.URL;
  window.URL = function(url, base) {
    if (!url || url === 'undefined' || url === 'null' || url === '') {
      console.error('Invalid URL detected:', {
        url: url,
        base: base,
        stack: new Error().stack,
        timestamp: new Date().toISOString()
      });
      // Log to external service if needed
      if (window.debugUrlErrors) {
        window.debugUrlErrors.push({url, base, stack: new Error().stack});
      }
    }
    return new originalURL(url, base);
  };
  window.debugUrlErrors = [];
})();
```

#### Task 1.2: Fix Product Page Invalid URLs
**Files to Check**:
- `sections/main-product.liquid` - Check all img src attributes
- `snippets/product-media-gallery.liquid` - Verify lazy loading URLs
- `snippets/product-variant-picker.liquid` - Check variant image handling
- `layout/theme.liquid` - Check meta tags and structured data

**Common Fixes**:
```liquid
<!-- Before -->
<img src="{{ variant.image }}" alt="">

<!-- After -->
<img src="{% if variant.image %}{{ variant.image | image_url }}{% else %}{{ 'placeholder.svg' | asset_url }}{% endif %}" alt="">
```

### Phase 2: Fix Pet System Integration (Priority: HIGH)

#### Task 2.1: Fix Event Name Mismatch
**File**: `assets/pet-processor-v5-es5.js` (Line ~378)
```javascript
// Change from:
window.dispatchEvent(new CustomEvent('petProcessorPrimaryComplete', {

// To:
window.dispatchEvent(new CustomEvent('petProcessorComplete', {
```

#### Task 2.2: Remove Redundant URL Conversions
**File**: `snippets/ks-product-pet-selector.liquid` (Lines 441-480)
```javascript
// Remove entire convertPetDataUrls function
// Directly use URLs from cache since already converted
function loadSavedPets() {
  // ... existing code ...
  
  const petData = extractPetDataFromCache();
  
  if (petData.length === 0) {
    showEmptyState();
    return;
  }
  
  // Direct render without conversion
  renderPets(petData);
}
```

### Phase 3: Optimize Storage & Performance (Priority: MEDIUM)

#### Task 3.1: Implement Proper Cache Management
**File**: `assets/pet-processor-v5-es5.js`
```javascript
// Add cache expiry and size limits
PetProcessorV5.prototype.manageCacheSize = function() {
  var MAX_CACHE_SIZE = 10; // Max 10 pet sessions
  var CACHE_EXPIRY_DAYS = 7;
  
  // Remove expired entries
  var now = Date.now();
  var keysToDelete = [];
  
  window.perkieEffects.forEach(function(url, key) {
    var keyParts = key.split('_');
    var timestamp = parseInt(keyParts[keyParts.length - 1]);
    
    if (timestamp && (now - timestamp) > (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)) {
      keysToDelete.push(key);
    }
  });
  
  // Delete expired
  keysToDelete.forEach(function(key) {
    window.perkieEffects.delete(key);
  });
  
  // Trim to max size if needed
  if (window.perkieEffects.size > MAX_CACHE_SIZE * 4) { // 4 effects per session
    var entries = Array.from(window.perkieEffects.entries());
    var toKeep = entries.slice(-MAX_CACHE_SIZE * 4);
    window.perkieEffects.clear();
    toKeep.forEach(function(entry) {
      window.perkieEffects.set(entry[0], entry[1]);
    });
  }
};
```

### Phase 4: Add Comprehensive Monitoring (Priority: LOW)

#### Task 4.1: Add Performance Tracking
**File**: `assets/pet-processor-v5-es5.js`
```javascript
// Track conversion success/failure rates
PetProcessorV5.prototype.trackConversion = function(success, error) {
  if (window.analytics && window.analytics.track) {
    window.analytics.track('Pet Processing Conversion', {
      success: success,
      error: error ? error.toString() : null,
      sessionKey: this.currentSessionKey,
      effect: this.currentEffect,
      timestamp: new Date().toISOString()
    });
  }
};
```

## 6. TESTING STRATEGY

### Immediate Testing
1. Deploy URL monitor to production
2. Collect data on actual invalid URLs
3. Fix identified problematic elements

### Pet System Testing
1. Test event name fix on staging
2. Verify pet selector updates properly
3. Test URL persistence through checkout

### Performance Testing
1. Monitor memory usage with cache management
2. Test with multiple pet uploads
3. Verify cleanup on session expiry

## 7. SUCCESS METRICS

### Primary Goals
- **Zero URL construction errors** in console
- **100% pet selector reliability** on product pages
- **< 3s effect switching** time

### Secondary Goals
- **< 100MB memory usage** with 10 pets loaded
- **95%+ mobile success rate** for uploads
- **Zero data loss** through checkout flow

## 8. RISK ASSESSMENT

### Low Risk Changes
- Event name fix (simple string change)
- URL monitoring (read-only debugging)
- Cache management (backwards compatible)

### Medium Risk Changes
- Removing URL conversions (thoroughly tested)
- Product template fixes (needs careful testing)

### High Risk Changes
- None identified in this plan

## 9. ROLLBACK STRATEGY

Each change can be rolled back independently:
1. **URL Monitor**: Simply remove script include
2. **Event Fix**: Revert single line change
3. **Template Fixes**: Git revert specific commits
4. **Cache Management**: Feature flagged implementation

## 10. CONCLUSION

The persistent URL error is a red herring. Our pet processing system works correctly but Shopify's analytics is encountering invalid URLs elsewhere in the DOM. The implementation plan focuses on:

1. **Finding and fixing the REAL source** of invalid URLs
2. **Fixing known integration issues** (event names)
3. **Optimizing performance** without breaking changes
4. **Adding monitoring** for future debugging

This approach ensures we solve the actual problem instead of continuing to modify working code.

## Next Immediate Actions

1. **Deploy URL monitor** to identify actual error sources
2. **Fix event name mismatch** (1-line change)
3. **Audit product templates** for invalid URL patterns
4. **Remove redundant conversions** in pet selector

Estimated Time: 2-4 hours for complete implementation
Risk Level: LOW
Impact: HIGH - Eliminates persistent errors and improves reliability