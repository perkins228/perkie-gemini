# Production Logger Integration Guide

## Overview

The `production-logger.js` module provides a clean, production-safe logging solution that:
- ✅ Shows full logs in development/staging
- ✅ Hides verbose logs in production
- ✅ Always logs errors (sanitized in production)
- ✅ No manual environment detection needed

---

## Quick Start

### 1. Add Logger Script to Theme

In your Liquid layout file, add **before** other scripts:

```liquid
<!-- layouts/theme.liquid or sections that use pet processor -->
{{ 'production-logger.js' | asset_url | script_tag }}
```

### 2. Update Existing JavaScript Files

**Before:**
```javascript
// pet-processor.js (OLD)
console.log('Processing image...');
console.error('Upload failed:', error);
console.warn('Cache is full');
```

**After:**
```javascript
// pet-processor.js (NEW)
const logger = new Logger('PetProcessor');

logger.log('Processing image...');  // Only dev/staging
logger.error('Upload failed', error);  // Always (sanitized in prod)
logger.warn('Cache is full');  // Only dev/staging
```

---

## Usage Examples

### Basic Logging

```javascript
const logger = new Logger('PetStorage');

// Info logs (dev/staging only)
logger.log('Saving pet data to localStorage');
logger.log('Session ID:', sessionId);

// Warnings (dev/staging only)
logger.warn('Storage is 80% full, running cleanup');

// Errors (always logged, sanitized in production)
logger.error('Failed to save to localStorage', error);
```

### Performance Timing

```javascript
const logger = new Logger('ImageUpload');

const startTime = performance.now();
await uploadImage(file);
const duration = performance.now() - startTime;

// Logs in dev/staging, or in production if > 5s
logger.perf('Image upload', duration);
```

### Grouped Logs (Dev/Staging Only)

```javascript
const logger = new Logger('CartIntegration');

logger.group('Adding pet to cart', () => {
  logger.log('Pet ID:', petId);
  logger.log('Product ID:', productId);
  logger.log('Font style:', fontStyle);
});
```

### Table Data (Dev/Staging Only)

```javascript
const logger = new Logger('PetData');

const pets = [
  { id: 1, name: 'Max', effect: 'blackwhite' },
  { id: 2, name: 'Luna', effect: 'popart' }
];

logger.table(pets, 'Current pets in session');
```

### Debug Logging

```javascript
const logger = new Logger('APIClient');

// Only shows in development (not even staging)
logger.debug('Request payload:', payload);
logger.debug('Response headers:', headers);
```

### Environment Detection

```javascript
const logger = new Logger('FeatureFlag');

if (logger.isDevelopment()) {
  // Enable experimental features in dev
  enableExperimentalMode();
}

if (logger.isProductionMode()) {
  // Initialize production-only services
  initializeAnalytics();
}
```

---

## Migration Priority

### High Priority Files (Do These First)
These files have the most console statements:

1. **assets/pet-processor.js** (~50+ console statements)
2. **assets/pet-storage.js** (~20+ console statements)
3. **assets/api-warmer.js** (~15+ console statements)
4. **assets/cart-pet-integration.js** (~10+ console statements)

### Medium Priority
5. **assets/pet-processor-unified.js**
6. **assets/product-info.js**
7. **snippets/ks-product-pet-selector.liquid** (inline scripts)

### Low Priority
Other files with occasional console usage.

---

## Migration Process (Per File)

### Step 1: Add Logger Instance

At the top of the file:

```javascript
// pet-processor.js
const logger = new Logger('PetProcessor');
```

### Step 2: Find & Replace

Use your editor's find & replace:

**Replace console.log:**
- Find: `console.log\(`
- Replace: `logger.log(`

**Replace console.warn:**
- Find: `console.warn\(`
- Replace: `logger.warn(`

**Replace console.error:**
- Find: `console.error\(`
- Replace: `logger.error(`

**Replace console.debug:**
- Find: `console.debug\(`
- Replace: `logger.debug(`

### Step 3: Fix Error Calls

Error logging requires 2 parameters:

```javascript
// BEFORE
console.error('Upload failed:', error);

// AFTER
logger.error('Upload failed', error);
```

### Step 4: Test

1. Open in staging (shopifypreview.com)
2. Check console - should see `[DEV]` or `[STAGING]` prefix
3. Verify production domain shows no verbose logs

---

## Special Cases

### Inline Liquid Scripts

For JavaScript inside Liquid templates:

```liquid
<script>
  // Make sure logger is loaded first
  const logger = new Logger('InlineScript');

  document.addEventListener('DOMContentLoaded', function() {
    logger.log('Page loaded');
  });
</script>
```

### ES5 Compatible Files

The logger is already ES5-compatible (no arrow functions, const/let converted):

```javascript
// Works in ES5 mode
var logger = new Logger('ES5Component');
logger.log('This works in old browsers');
```

### Conditional Debug Code

```javascript
const logger = new Logger('Debugger');

// Entire debug block only runs in dev
if (logger.isDevelopment()) {
  // This code is completely skipped in production
  logger.log('Debug mode active');
  window.debugAPI = api;  // Expose debugging interface
}
```

---

## Expected Impact

### Before Migration
- 200+ console statements in production
- Sensitive data potentially leaked
- Browser console cluttered for users
- No environment-aware logging

### After Migration
- ~5-10 console statements in production (errors only)
- Sanitized error messages
- Clean user experience
- Full debugging in dev/staging

---

## Rollout Plan

### Week 1: High Priority Files (2-3 hours)
- Migrate pet-processor.js
- Migrate pet-storage.js
- Migrate api-warmer.js
- Test in staging

### Week 2: Medium Priority Files (1-2 hours)
- Migrate cart-pet-integration.js
- Migrate product-info.js
- Test in staging

### Week 3: Complete & Verify (1 hour)
- Migrate remaining files
- Test in production (after launch)
- Verify no console pollution

---

## Testing Checklist

- [ ] Logger loads without errors
- [ ] `[DEV]` prefix shows in localhost
- [ ] `[STAGING]` prefix shows in shopifypreview.com
- [ ] `[PROD]` prefix shows in perkieprints.com
- [ ] Verbose logs hidden in production
- [ ] Errors still logged in production (sanitized)
- [ ] No breaking changes to functionality
- [ ] No performance impact (logger is lightweight)

---

## Troubleshooting

### Logger not defined
**Problem:** `Uncaught ReferenceError: Logger is not defined`
**Solution:** Make sure `production-logger.js` is loaded before other scripts

### Still seeing logs in production
**Problem:** Logs still appearing on perkieprints.com
**Solution:** Check hostname detection - may need to update `isProduction` logic

### Missing error details
**Problem:** Need more error context in production
**Solution:** Add monitoring service integration in `sendToMonitoring()` method

---

## Future Enhancements

Once we have real users and monitoring needs:

1. **Error Tracking Service**
   - Integrate Sentry or similar
   - Automatic error reporting
   - Stack trace capture

2. **Performance Monitoring**
   - Automatic performance tracking
   - User session replay
   - Custom metrics

3. **User Context**
   - Add user ID to logs
   - Session tracking
   - A/B test variant logging

**But not before we need it!** Start simple, add complexity when pain demands it.
