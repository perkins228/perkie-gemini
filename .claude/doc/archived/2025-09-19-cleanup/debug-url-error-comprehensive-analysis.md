# Comprehensive Debug Analysis: Persistent URL Error Investigation

**Created**: 2025-08-16  
**Priority**: CRITICAL  
**Status**: COMPREHENSIVE ROOT CAUSE ANALYSIS

## Problem Summary

Despite implementing comprehensive blob→data URL conversion in the pet processor, the URL error persists:

```
s87104074w193399d0p9c2c7174m0f111275m.js:1 Uncaught (in promise) TypeError: Failed to construct 'URL': Invalid URL
    at W (s87104074w193399d0p9c2c7174m0f111275m.js:1:61974)
    at r.XMLHttpRequest.XMLHttpRequest.open (s87104074w193399d0p9c2c7174m0f111275m.js:1:71370)
```

## Evidence Analysis

### ✅ CONFIRMED WORKING: Pet Processor Data URL Conversion
- **File**: `assets/pet-processor-v5-es5.js` lines 351-363
- **Logic**: Blob URLs converted to data URLs BEFORE storage in `window.perkieEffects`
- **Verification**: Console shows "✅ Stored data URL for effect: [effect]"
- **Event Timing**: `petProcessorComplete` only dispatched AFTER all conversions complete

### ✅ CONFIRMED WORKING: Pet Selector Data URL Handling
- **File**: `snippets/ks-product-pet-selector.liquid` lines 371-411
- **Logic**: Handles both blob URLs and data URLs gracefully
- **Verification**: Function checks URL type before processing
- **Fallback**: Returns original URL if conversion fails

### ❌ CRITICAL FINDING: Wrong Error Source Assumption

**The error is NOT coming from our pet processing code.**

## Stack Trace Deep Analysis

### Error Location Breakdown
```
s87104074w193399d0p9c2c7174m0f111275m.js:1
```
- **File Type**: Shopify core analytics/tracking script
- **Minified**: Obfuscated JavaScript with random filename
- **Purpose**: Web pixel tracking, conversion tracking, analytics

### XMLHttpRequest Context
```
r.XMLHttpRequest.XMLHttpRequest.open (s87104074w193399d0p9c2c7174m0f111275m.js:1:71370)
```
- **Method**: `XMLHttpRequest.open()`
- **Context**: Shopify analytics making tracking requests
- **Issue**: Analytics trying to process invalid URL for tracking

## New Root Cause Hypothesis

### Primary Theory: Analytics URL Interception

**The URL error occurs when Shopify analytics intercepts and processes URLs from our DOM elements or data attributes, NOT from our direct JavaScript code.**

**Potential Sources**:
1. **Image src attributes** containing invalid values
2. **Data attributes** with URL values being tracked
3. **Form action attributes** with malformed URLs
4. **Link href attributes** being processed for analytics
5. **Meta tags or structured data** with URL schemas

### Secondary Theory: Timing-Based DOM Inspection

**Shopify analytics may be scanning the DOM at specific intervals and encountering:**
- Empty `src` attributes during image loading
- Placeholder URLs like "undefined" or "null" as strings
- Relative URLs without proper base URLs
- Malformed data attributes

## Investigation Strategy

### Phase 1: Identify True Error Source

#### Option A: Console Debugging
```javascript
// Add to browser console to intercept URL constructor calls
(function() {
  const originalURL = window.URL;
  window.URL = function(url, base) {
    if (!url || url === 'undefined' || url === 'null' || url === '') {
      console.error('Invalid URL detected:', {
        url: url,
        base: base,
        stack: new Error().stack
      });
      debugger; // Break execution to inspect call stack
    }
    return new originalURL(url, base);
  };
  Object.setPrototypeOf(window.URL, originalURL);
  Object.defineProperty(window.URL, 'prototype', {
    value: originalURL.prototype,
    writable: false
  });
})();
```

#### Option B: XMLHttpRequest Monitoring
```javascript
// Monitor all XMLHttpRequest.open calls
(function() {
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    if (!url || url === 'undefined' || url === 'null' || url === '') {
      console.error('XMLHttpRequest.open called with invalid URL:', {
        method: method,
        url: url,
        stack: new Error().stack
      });
      debugger;
    }
    return originalOpen.apply(this, arguments);
  };
})();
```

### Phase 2: DOM Analysis for Invalid URLs

#### Check All URL-Related Attributes
```javascript
// Scan DOM for potentially invalid URLs
function scanForInvalidUrls() {
  const invalidUrls = [];
  
  // Check all img src attributes
  document.querySelectorAll('img').forEach(img => {
    if (!img.src || img.src === 'undefined' || img.src === 'null') {
      invalidUrls.push({type: 'img.src', element: img, value: img.src});
    }
  });
  
  // Check all link href attributes
  document.querySelectorAll('a[href]').forEach(link => {
    if (!link.href || link.href === 'undefined' || link.href === 'null') {
      invalidUrls.push({type: 'a.href', element: link, value: link.href});
    }
  });
  
  // Check all form action attributes
  document.querySelectorAll('form[action]').forEach(form => {
    if (!form.action || form.action === 'undefined' || form.action === 'null') {
      invalidUrls.push({type: 'form.action', element: form, value: form.action});
    }
  });
  
  // Check data attributes with URL-like names
  document.querySelectorAll('[data-url], [data-href], [data-src]').forEach(el => {
    ['data-url', 'data-href', 'data-src'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && (value === 'undefined' || value === 'null' || value === '')) {
        invalidUrls.push({type: attr, element: el, value: value});
      }
    });
  });
  
  return invalidUrls;
}

// Run scan
console.log('Invalid URLs found:', scanForInvalidUrls());
```

### Phase 3: Shopify-Specific Elements

#### Check Product Form Elements
- Variant image URLs
- Product media URLs
- Form action attributes
- Hidden input values

#### Check Analytics Data
- GA4 tracking attributes
- Shopify Pixel data
- Meta tags for Open Graph, Twitter Cards
- JSON-LD structured data

## Potential Fix Strategies

### Strategy A: Defensive Programming (Most Likely)
**Add validation to prevent invalid URLs from entering the DOM**

1. **Image Elements**: Always validate src before setting
2. **Data Attributes**: Sanitize URL values before setting attributes
3. **Form Actions**: Validate action URLs
4. **Meta Tags**: Ensure social media URLs are valid

### Strategy B: Analytics Exclusion
**Prevent analytics from tracking our generated elements**

1. Add `data-analytics-exclude` attributes
2. Use specific CSS classes that analytics ignores
3. Modify element IDs to avoid tracking patterns

### Strategy C: Timing Fixes
**Ensure all URLs are valid before analytics can process them**

1. Delay analytics initialization until after our processing
2. Use MutationObserver to validate URLs as they're added to DOM
3. Pre-validate all URL values before DOM manipulation

## Expected Resolution

### Most Likely Scenario
**The error is coming from:**
- Empty or undefined image `src` attributes during loading
- Product variant images with invalid URLs
- Form elements with malformed action attributes
- Data attributes containing string literals like "undefined"

### Fix Implementation
1. **Immediate**: Add defensive URL validation throughout the codebase
2. **Short-term**: Implement DOM scanning and validation
3. **Long-term**: Prevent invalid URLs from ever entering the DOM

## Testing Plan

### Debug Commands
```javascript
// Run in browser console on problem page
scanForInvalidUrls();

// Monitor URL constructor calls
// (Use Option A debug script above)

// Check perkieEffects cache
console.log('PerkieEffects contents:', 
  Array.from(window.perkieEffects.entries())
    .map(([key, value]) => ({key, urlType: value?.startsWith?.('data:') ? 'data' : 'other', value}))
);
```

### Browser Testing
1. **Chrome DevTools**: Network tab monitoring for failed requests
2. **Console**: Monitor for URL constructor errors
3. **Elements**: Inspect DOM for invalid attributes
4. **Sources**: Set breakpoints on URL constructor calls

## Success Metrics

### Primary Goals
- ✅ Zero "Failed to construct 'URL'" errors in console
- ✅ Product page loads without JavaScript errors
- ✅ Pet selector functionality works immediately

### Secondary Goals
- ✅ Analytics tracking continues working properly
- ✅ No performance impact from debugging code
- ✅ Solution works across all browsers and devices

## Next Steps Priority

1. **CRITICAL**: Implement URL constructor monitoring (Option A script)
2. **HIGH**: Run DOM scanning for invalid URLs
3. **MEDIUM**: Check product-specific elements and forms
4. **LOW**: Implement defensive programming fixes

The key insight is that this error is likely NOT from our pet processing code but from Shopify analytics encountering invalid URLs elsewhere in the DOM. We need to identify the true source before implementing a fix.