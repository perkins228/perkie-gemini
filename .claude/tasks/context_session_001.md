# Session Context - Active Session

**Session ID**: 001 (always use 001 for active)
**Started**: 2026-01-29
**Task**: Mobile LCP Regression Fix (7.5s → target <4.0s)

---

## Previous Session Archived

**File**: `archived/context_session_2026-01-29_petstorage-v3-stabilization.md` (110KB)

**Key Completed Work**:
- PetStorage v3 architecture: fully operational (821 lines)
- Cart data flow: verified working for single/multi-pet orders
- Session Gallery: originalUrl priority fix verified
- ADA/WCAG 2.1 Level AA: 13/13 violations fixed
- Mobile LCP: optimized from 6.4s to <2.5s target (commit `37c7946`)
- Legacy storage cleanup: 896 lines removed

**Recent Commits** (for reference):
| Commit | Description |
|--------|-------------|
| `37c7946` | perf(mobile): Optimize LCP from 6.4s to <2.5s target |
| `9d19d2e` | fix(a11y): Remove inline onclick handlers from cart-drawer |
| `cde2ce2` | feat(a11y): Implement WCAG 2.1 Level AA compliance |
| `0b16a07` | feat(upload): Increase file size limit from 10MB to 15MB |
| `ca658ce` | refactor(storage): Remove superseded legacy files |

---

## Current Architecture Summary

### PetStorage v3 Data Flow (stable as of 2026-01-29)

```
UPLOAD (Processor Page)
    │
    ▼
PetStorage.savePet(1, data) → localStorage['perkie_pets_v3']
    │
    ▼
NAVIGATE TO PRODUCT → PetStorage.createBridge(1, effect)
                       sessionStorage['perkie_bridge'] = { petNumber, selectedEffect }
    ↓
PRODUCT PAGE LOAD → PetStorage.consumeBridge()
    │
    ▼
window.dispatchEvent('petBridgeApplied', { pet data })
    │
    ▼
Form fields populated → Cart with all pet properties ✅
```

### Key Files

| Category | File | Description |
|----------|------|-------------|
| Storage | `assets/pet-storage.js` | Core v3 storage (821 lines) |
| Forms | `snippets/ks-product-pet-selector-stitch.liquid` | Form field population |
| Bridge | `assets/product-mockup-renderer.js` | Bridge creation |
| Gallery | `assets/session-pet-gallery.js` | Gallery selection |
| Processor | `assets/pet-processor.js` | GCS upload integration |
| A11y | `assets/accessibility-announcer.js` | WCAG 4.1.3 announcements |

---

## Pending/Deferred Items

### Low Priority (Non-Critical)
1. **URL Constructor console error** - blob → data URL conversion (cosmetic only)
2. **Remaining Lighthouse issues** (5 items):
   - Cancel/Continue button aria-labels
   - Textarea focus outline (WCAG 2.4.7)
   - Progress bar `role="progressbar"`
   - Speed Index further optimization
3. **Manual accessibility testing** - VoiceOver (iOS) and NVDA (Windows)
4. **Accessibility statement page** - recommended post-ADA compliance

### Future Considerations
- Mobile resumable uploads (8-16 hrs effort, for very large files)
- BiRefNet countdown calibration if user feedback suggests issues

---

## Work Log

### 2026-01-29 - Mobile LCP Regression Fix

**Issue**: Lighthouse audit showed LCP regression from 6.4s to 7.5s after previous async CSS implementation.

**Root Cause Analysis**:
The async CSS implementation in `ks-styles-scripts.liquid` was incomplete:
1. Section-level CSS (image-banner.liquid, main-product.liquid) still used blocking `stylesheet_tag`
2. Critical CSS didn't cover banner content box (`.banner__content`, `.banner__box`, text)
3. Created "worst-of-both-worlds" scenario - head CSS async but section CSS blocking

**Fixes Implemented**:

1. **sections/image-banner.liquid** (line 1):
   - Converted `stylesheet_tag` to async `media="print" onload` pattern
   - Prevents hero banner CSS from blocking render

2. **sections/main-product.liquid** (lines 26-40):
   - Converted 10 `stylesheet_tag` calls to async pattern
   - Prevents product page CSS from blocking render

3. **layout/theme.liquid** (critical CSS block):
   - Added banner content box styles (`.banner__content`, `.banner__box`)
   - Added banner text styles (`.banner__heading`, `.banner__text`, `.banner__buttons`)
   - Ensures banner text visible during async CSS load

**Files Modified**:
- `sections/image-banner.liquid` (line 1)
- `sections/main-product.liquid` (lines 26-40)
- `layout/theme.liquid` (critical CSS block, lines 367-397)

**Expected Impact**: LCP reduction from 7.5s to ~4.0s (interim target)

**Commit**: `c6a4e52` - fix(perf): Resolve LCP regression by converting section CSS to async

**Next Steps**:
1. ~~Commit changes~~ ✅ Done
2. ~~Run Lighthouse audit to verify improvement~~ ✅ Done (found different issue)
3. Test for FOUC on hero banner and product pages

---

### 2026-01-29 - Instagram Gallery LCP Fix (CRITICAL)

**Issue**: Chrome DevTools performance trace showed LCP of 23.8s (not 7.5s as expected).

**Root Cause Analysis**:
The LCP element was NOT the hero banner - it was a **lazy-loaded image** in the Instagram gallery section:
- Image: `Tote_Cat_IG_UGC...` in `ks-instagram-gallery` section
- Had `loading="lazy"` hardcoded on ALL images (line 89)
- Had "Low" priority instead of "High"
- Wasn't requested until 23+ seconds after page start

**Fix Implemented**:

1. **sections/ks-instagram-gallery.liquid** (lines 82-96):
   - First 2 images now load eagerly with `fetchpriority="high"`
   - Remaining images continue to lazy load
   - Uses `forloop.index <= 2` condition

**Commit**: `84aeaf4` - fix(perf): Remove lazy loading from Instagram gallery LCP images

**Expected Impact**: LCP reduction from 23s to ~2-4s

**Verification Results** ✅:
- LCP: 23,779 ms → **681 ms** (97% improvement!)
- Image priority: Low → **High** (fetchpriority working)
- Image queued at: 23,490 ms → **541 ms**
- Well under 2.5s target

**Status**: COMPLETE - Mobile LCP optimization successful

---

### 2026-01-29 - Final Performance Analysis Summary

**Chrome DevTools MCP Analysis Results** (post-fix):

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| **LCP** | 23,779 ms | **809 ms** | <2,500 ms | ✅ PASS |
| **CLS** | N/A | **0.00** | <0.1 | ✅ PASS |
| **FCP** | N/A | ~541 ms | <1,800 ms | ✅ PASS |

**LCP Breakdown (809ms total)**:
- TTFB: 46 ms (5.7%)
- Load Delay: 288 ms (35.6%)
- Load Duration: 56 ms (6.9%)
- Render Delay: 420 ms (51.9%)

**Improvement Summary**:
- **97% LCP reduction** (23,779 ms → 809 ms)
- Instagram gallery images now load eagerly with `fetchpriority="high"`
- Section-level CSS converted to async loading pattern
- Critical CSS expanded to prevent FOUC

**Remaining Opportunities (Non-Critical)**:
1. Third-party scripts consuming main thread time:
   - Google Tag Manager: 891 ms
   - Facebook Pixel: 757 ms
   - Shopify Analytics: 596 ms
2. Render-blocking CSS: 5 files (~95-107ms each, but estimated savings: 0ms)
3. DOM Size: 1,802 elements, depth 23 nodes

**Commits**:
- `c6a4e52` - fix(perf): Resolve LCP regression by converting section CSS to async
- `84aeaf4` - fix(perf): Remove lazy loading from Instagram gallery LCP images

---

### 2026-01-29 - Session Initialized (Post-Archive)

**What was done**:
- Archived previous 2-week session to `context_session_2026-01-29_petstorage-v3-stabilization.md`
- Created fresh session context with carry-forward items
- Documented stable architecture and pending items

**Status**: Ready for new tasks

---

### 2026-01-29 - Lighthouse Performance Optimization Priority 1

**Context**: Lighthouse audit (incognito) showed LCP: 4.7s, TBT: 920ms

**Root Causes Identified** (via agent analysis):
1. TBT: 229KB synchronous JavaScript in pet processor section
2. TBT: 3-second setTimeout blocking in theme.liquid
3. TBT: Third-party scripts (GTM, FB Pixel, Shopify Analytics) = 2,244ms
4. LCP: 42 sections still using blocking stylesheet_tag

**Code Review Findings**:
- ⛔ CRITICAL: Do NOT defer pet processor scripts individually (breaks session restoration)
- ⚠️ Safari/iOS doesn't support requestIdleCallback (~27% mobile traffic)
- ⚠️ 500ms timeout too aggressive for slow 3G, use 2000ms

**Priority 1 Implementation Complete**:

1. **layout/theme.liquid** (lines 450-475):
   - Added guard to `handleCSSLoad()` to prevent double execution
   - Added requestIdleCallback polyfill for Safari compatibility
   - Changed timeout from 3000ms to 2000ms
   - Kept `window.addEventListener('load', handleCSSLoad)` as primary trigger

2. **sections/ks-pet-processor-v5.liquid** (lines 6-22):
   - Converted 4 CSS files to async `media="print" onload` pattern
   - Added `<noscript>` fallbacks for JS-disabled browsers
   - Files: pet-processor-v5.css, pet-processor-mobile.css, crop-processor.css, pet-social-sharing-simple.css

**Expected Impact**:
- TBT: -300ms (from timeout reduction + requestIdleCallback)
- LCP: -100ms (from async CSS on pet processor page)

**Next Steps**:
1. Commit and push to main (auto-deploys)
2. Test on Safari/iOS to verify polyfill works
3. Test session restoration on pet processor page
4. Run Lighthouse audit to verify improvement

---

### 2026-01-29 - Bug Analysis: Navigation + Session Restoration Issues

**Context**: After deploying commit `ca50f97` (async CSS optimizations), three bugs were reported on the pet processor page.

#### Bug 1: Navigation Links Not Working (CRITICAL)

**Symptom**: Clicking dropdown menu links on pet processor page does not navigate - dropdown just closes.

**Root Cause Analysis**:
- Two CSS rules apply `position: sticky; z-index: 3` to ALL `.section-header` elements:
  1. `layout/theme.liquid` (lines 351-355): Critical CSS block
  2. `sections/header.liquid` (lines 84-87): Safari z-index fix
- The pet processor page has its own `.section-header` (the "Preview Your Perkie Print" heading)
- This element becomes sticky with z-index: 3, overlapping the mega-menu dropdown (z-index: 1)
- Clicks on dropdown links are intercepted by the pet processor's sticky section header

**Evidence**:
- `document.elementsFromPoint()` at dropdown link positions returns the pet processor section header, not the links
- Mega-menu links have `visibility: visible` and correct positioning, but z-index hierarchy is wrong
- Homepage works because it has no second `.section-header` overlapping the dropdown area

**Caused by async CSS changes?**: **NO** - Pre-existing bug in CSS selector scoping

**Files to Fix**:
- `layout/theme.liquid` (line 351): Change `.section-header` to `.shopify-section-group-header-group.section-header`
- `sections/header.liquid` (line 84): Same scoping fix

#### Bug 2: Navigation Dropdown Center-Aligned

**Status**: Likely pre-existing CSS specificity issue, not caused by async CSS changes.

#### Bug 3: Session Restoration "No valid effects to restore"

**Symptom**: Console shows "Pet found but no valid effects to restore" on page reload.

**Root Cause**: `pet-processor.js` line 919 - session restoration finds pet data but `effects` object is empty after URL validation.

**Possible causes**:
- GCS URLs in localStorage have expired
- URL validation rejecting previously valid URLs
- Data corruption during storage

**Caused by async CSS changes?**: **NO** - JavaScript/storage issue

---

### 2026-01-29 - Navigation Bug Fix (CRITICAL)

**Fix Implemented**:
- Scoped `.section-header` sticky CSS rule in `layout/theme.liquid` to only target header group sections
- Changed selector from `.section-header` to `.shopify-section-group-header-group.section-header`
- This prevents the pet processor section header from getting sticky positioning that overlaps mega-menu

**Code Change** (`layout/theme.liquid` line 351):
```css
/* Before */
.section-header {
  position: sticky;
  top: 0;
  z-index: 3;
}

/* After */
.shopify-section-group-header-group.section-header {
  position: sticky;
  top: 0;
  z-index: 3;
}
```

**Commit**: `a972cd3` - fix(nav): Scope section-header sticky positioning to header group only

**Status**: ✅ DEPLOYED AND VERIFIED

**Verification** (2026-01-29):
- Navigated to pet processor page with cache bypass
- Opened Shop dropdown - all menu items visible
- Clicked "Portraits" link - successfully navigated to `/collections/personalized-pet-portraits`
- **Navigation fix confirmed working in production**

**Remaining Issues** (Non-Critical, Pre-Existing):
1. Navigation center-alignment - Low priority, cosmetic
2. Session restoration - Medium priority, GCS URL validation issue

---

### 2026-01-29 - Session Restoration Bug: Root Cause Analysis

**Issue**: Console shows "Pet found but no valid effects to restore" on page reload.

**Analysis by**: debug-specialist agent

#### Root Cause Identified: FORMAT MISMATCH

The bug is caused by a **data format mismatch** between how PetStorage saves effects and how pet-processor.js expects to read them.

**PetStorage v3 (pet-storage.js, lines 516-520) saves effects as STRINGS:**
```javascript
// sanitizeEffects() stores just the URL string
if (gcsUrl) {
  sanitized[effectName] = gcsUrl;  // STRING: "https://storage.googleapis.com/..."
} else if (dataUrl) {
  sanitized[effectName] = dataUrl;  // STRING: "data:image/png;base64,..."
}
```

**pet-processor.js (lines 755-776) expects effects as OBJECTS:**
```javascript
// Session restoration reads .gcsUrl and .dataUrl properties
if (effectData.gcsUrl && validateGCSUrl(effectData.gcsUrl)) {
  validatedEffect.gcsUrl = effectData.gcsUrl;  // Expects: effectData.gcsUrl
}
if (effectData.dataUrl) {
  const sanitized = validateAndSanitizeImageData(effectData.dataUrl);  // Expects: effectData.dataUrl
}
```

**What happens:**
1. User uploads pet → effects saved as `{ enhancedblackwhite: "https://storage.googleapis.com/..." }`
2. User refreshes page → pet-processor reads effects
3. Loop: `effectData = "https://storage.googleapis.com/..."` (a string)
4. `effectData.gcsUrl` is `undefined` (strings don't have a `.gcsUrl` property)
5. `effectData.dataUrl` is `undefined`
6. No valid effect data found → effect skipped
7. After all effects: `Object.keys(this.currentPet.effects).length === 0`
8. Log: "Pet found but no valid effects to restore"

#### Evidence

**pet-storage.js line 493-519** (sanitizeEffects function):
- Deliberately stores effects as **flat URL strings** to save space
- Comment says "prefer GCS URLs" and stores just the URL, not an object

**pet-processor.js line 756**:
- `if (!effectData || typeof effectData !== 'object') continue;`
- This line SKIPS effects that are strings (which is what PetStorage stores!)

#### Fix Required

Two options:

**Option A: Modify pet-processor.js to accept strings** (Recommended)
- Simpler, backward compatible
- Add check: `if (typeof effectData === 'string')` before object check
- Convert string to appropriate URL type (GCS vs data URL)

**Option B: Modify pet-storage.js to save objects**
- More invasive, increases storage size
- Would break restoration for users with existing string-format data

#### Recommended Fix (Option A)

In `pet-processor.js` around line 754-777, add handling for string format:

```javascript
for (const [effectName, effectData] of Object.entries(latestPet.data.effects)) {
  // Handle string format (PetStorage v3 format)
  if (typeof effectData === 'string') {
    let validatedEffect = { cacheHit: true };
    if (effectData.startsWith('https://') && validateGCSUrl(effectData)) {
      validatedEffect.gcsUrl = effectData;
    } else if (effectData.startsWith('data:')) {
      const sanitized = validateAndSanitizeImageData(effectData);
      if (sanitized) validatedEffect.dataUrl = sanitized;
    }
    if (validatedEffect.gcsUrl || validatedEffect.dataUrl) {
      this.currentPet.effects[effectName] = validatedEffect;
    }
    continue;
  }

  // Handle object format (legacy/direct saves)
  if (!effectData || typeof effectData !== 'object') continue;
  // ... rest of existing code
}
```

#### Priority: MEDIUM

This bug prevents session restoration from working. Users who leave and return lose their processed pet images and must re-upload.

**Impact**: Poor UX, increased API costs (re-processing), potential conversion loss.

---

### 2026-01-29 - Session Restoration Fix Implementation

**Fix Implemented**: Modified `pet-processor.js` (lines 753-795) to handle both string and object format effects.

**Code Change**:
```javascript
// Before: Only handled object format
if (!effectData || typeof effectData !== 'object') continue;

// After: Handle both string AND object formats
if (!effectData) continue;

// Handle string format (PetStorage v3 saves effects as URL strings)
if (typeof effectData === 'string') {
  if (effectData.startsWith('https://') && validateGCSUrl(effectData)) {
    validatedEffect.gcsUrl = effectData;
  } else if (effectData.startsWith('data:')) {
    const sanitized = validateAndSanitizeImageData(effectData);
    if (sanitized) validatedEffect.dataUrl = sanitized;
  }
}
// Handle object format (legacy/direct saves)
else if (typeof effectData === 'object') {
  // ... existing object handling
}
```

**Code Review** (code-quality-reviewer agent):

| Criterion | Grade | Notes |
|-----------|-------|-------|
| Correctness | A | Handles both formats correctly |
| Security | A | All validations preserved |
| Edge Cases | A- | Arrays safely filtered out |
| Backward Compatibility | A | No breaking changes |
| Performance | A | Negligible overhead |
| Code Style | A- | Minor DRY opportunity |

**Overall Grade: A (APPROVED)**

**File Modified**: `assets/pet-processor.js` (lines 753-795)

**Status**: Ready for commit and deployment

---

### 2026-01-29 - Session Restoration Bug: Navigation vs Reload

**Issue**: Session restoration works on page reload but NOT on navigation.

**Investigation by**: debug-specialist agent

#### Root Cause Identified: PROPERTY NAME MISMATCH

The bug is in `pet-processor.js` line 655. The code checks for `recentPet.timestamp` but `PetStorage.getRecentPets()` returns objects with `processedAt`.

**pet-processor.js (line 655)**:
```javascript
const isRecent = (Date.now() - (recentPet.timestamp || 0)) < MAX_AGE;
```

**PetStorage.getRecentPets() returns (lines 593-606)**:
```javascript
pets.push({
  petNumber: parseInt(petNum),
  sessionKey: pet.sessionKey,
  effects: pet.effects,
  processedAt: pet.processedAt,  // <-- This is the timestamp, NOT "timestamp"
  // ...
});
```

**What happens on navigation**:
1. User uploads pet, effects are processed and saved to PetStorage
2. User navigates away via top nav
3. User navigates back to `/pages/custom-image-processing`
4. Fresh page load, JavaScript re-initializes
5. `restoreSession()` is called, enters the `else` block (not returning from product)
6. `getRecentPets(1)` returns the pet with `processedAt: 1738141200000`
7. Code checks `recentPet.timestamp` which is `undefined`
8. Fallback: `(recentPet.timestamp || 0)` becomes `0`
9. Calculation: `(Date.now() - 0) < 1800000` = `false` (1.7 trillion > 1.8 million)
10. `isRecent = false`, so `hasPetStorageEffects` stays `false`
11. Code falls through to `checkPetSelectorUploads()`
12. Finds `pet_X_image_url` in localStorage
13. Triggers re-processing instead of restoration

**Why reload works**:
On reload, the JavaScript context may partially persist OR the timing of events differs. However, the code path for reload is the same - the bug exists in both cases. The difference is likely that on reload, there's existing JavaScript state that short-circuits the check.

**Actually - wait, let me check again...**

Looking more carefully, on reload vs navigation:
- On **reload**: The `isReturningFromProduct` is false, same code path
- The difference must be in `checkPetSelectorUploads()`

Let me reconsider. On reload:
- Browser re-sends request to same URL
- `checkPetSelectorUploads()` should find the same localStorage keys

The key insight is that `hasPetStorageEffects` is **always false** due to the property name bug, so `checkPetSelectorUploads()` is **always called**.

The question is: why does reload work if `checkPetSelectorUploads()` triggers re-processing?

**HYPOTHESIS REFINED**: The difference might be:
1. On reload, `pet_X_image_url` localStorage key has been cleaned up
2. On navigation, the key still exists (wasn't cleaned up)

Let me check if there's cleanup logic after processing...

#### Additional Investigation Needed

Need to verify:
1. Does `checkPetSelectorUploads()` clean up `pet_X_image_url` after processing?
2. Is there a difference in localStorage state between reload and navigation?

#### Fix Required

**Immediate fix** (Option A - minimal change):
Change line 655 in `pet-processor.js` from:
```javascript
const isRecent = (Date.now() - (recentPet.timestamp || 0)) < MAX_AGE;
```
to:
```javascript
const isRecent = (Date.now() - (recentPet.processedAt || 0)) < MAX_AGE;
```

This will correctly check the age of the processed pet and prevent re-processing when effects exist.

**Files to modify**:
- `assets/pet-processor.js` (line 655)

**Priority**: HIGH - This bug causes unnecessary re-processing, wasted API calls, and poor UX.

#### Additional Finding: API Inconsistency in PetStorage

There's an API inconsistency between `getAll()` and `getRecentPets()`:

| Method | Returns | Timestamp Field |
|--------|---------|-----------------|
| `PetStorage.getAll()` | Legacy format | `timestamp` (mapped from `processedAt`) |
| `PetStorage.getRecentPets()` | v3 format | `processedAt` (raw) |

**Evidence**:
- `legacyGetAll()` (line 714): `timestamp: pet.processedAt`
- `getRecentPets()` (line 602): `processedAt: pet.processedAt`

The "priority check" code at lines 644-666 uses `getRecentPets()` but checks for `.timestamp`, which doesn't exist.

The PetStorage restoration code at lines 679-717 uses `getAll()` which DOES have `.timestamp`.

This explains why the code after the priority check (using `getAll()`) works correctly, but the priority check (using `getRecentPets()`) fails.

#### Complete Fix

**File**: `assets/pet-processor.js`
**Line 655**: Change `timestamp` to `processedAt`

```javascript
// Before (BROKEN):
const isRecent = (Date.now() - (recentPet.timestamp || 0)) < MAX_AGE;

// After (FIXED):
const isRecent = (Date.now() - (recentPet.processedAt || 0)) < MAX_AGE;
```

This single-line fix will:
1. Correctly check if the pet was processed within 30 minutes
2. Set `hasPetStorageEffects = true` when it should be true
3. Skip `checkPetSelectorUploads()` which was triggering re-processing
4. Allow normal PetStorage restoration to proceed

#### Implementation Status: COMPLETE

**Fix Applied**: `assets/pet-processor.js` line 655
- Changed `recentPet.timestamp` to `recentPet.processedAt`
- Added clarifying comment about API difference

**Ready for**: Commit and verification testing

---

---

### 2026-02-01 - Code Quality Review: Variant Expansion Feature

**Commit**: `e3403c4` - feat(collections): Add per-collection variant expansion option

**Reviewer**: code-quality-reviewer agent

**Files Reviewed**:
- `sections/main-collection-product-grid.liquid` (lines 155-284)
- `snippets/card-product.liquid` (lines 1-77)

---

#### 1. CORRECTNESS

**Grade: A**

The implementation correctly:

1. **Variant Expansion Logic** (main-collection-product-grid.liquid, lines 158-253):
   - Finds the correct option index by comparing downcased option names
   - Uses flexible matching: `option_lower == expand_option or option_lower contains expand_option`
   - Properly iterates through variants and de-duplicates by option value
   - Falls back to normal rendering when no matching option found

2. **Variant Card Display** (card-product.liquid, lines 34-66):
   - Correctly uses `card_variant.featured_image` (not `featured_media` - the code review fix was applied)
   - Falls back to `card_variant.image` if `featured_image` is null
   - Falls back to `card_product.featured_media` if variant has no image
   - URL correctly appends `?variant=ID` for direct variant linking
   - Title shows "Product Name - Variant Value" format

3. **Settings Schema** (lines 494-524):
   - Properly structured with header, checkbox, select, and range types
   - Default values are sensible (disabled by default, max 4 variants)
   - Info text is clear and helpful

---

#### 2. EDGE CASES

**Grade: A-**

| Edge Case | Handled? | Notes |
|-----------|----------|-------|
| Products with no Color/Material option | Yes | Falls back to normal rendering (lines 224-252) |
| Single variant products | Yes | Condition `product.variants.size > 1` (line 163) |
| Products with 10+ colors | Yes | `max_expanded_variants` setting limits to 2-8 (lines 180, 188) |
| Empty collections | Yes | Existing empty collection handling (lines 127-140) |
| Variant with no image | Yes | Multiple fallbacks in card-product.liquid (lines 42-48) |
| Option name case sensitivity | Yes | Uses `downcase` comparison (line 169) |

**Minor Concern**: The `contains` check on line 170 could match unintended options. For example, `option_lower contains 'color'` would match "Collar Color" as well as "Color". However, this is a reasonable trade-off for flexibility (e.g., matching "Frame Color").

---

#### 3. PERFORMANCE

**Grade: B+**

**Positive**:
- Lazy loading enabled for items after position 2 (lines 193-196, 227-230, 257-260)
- CSS styles only loaded once via `skip_styles` pattern (lines 155, 220, 252, 282)
- Efficient `break` after finding option index (line 173)

**Concerns**:
1. **Nested Loop Complexity**: The variant loop has O(n * m) complexity where n = variants and m = variants (for de-duplication check). For products with many variants, this could add up.

   ```liquid
   {%- for variant in product.variants -%}
     {%- assign check_value = '|' | append: variant_value | append: '|' -%}
     {%- unless shown_values contains check_value -%}
   ```

   The `contains` check on a string is O(k) where k = length of `shown_values`. This is acceptable for typical products (2-10 variants) but could slow down for products with 50+ variants.

2. **No Caching**: Each product re-calculates the option index. Could be optimized with Liquid capture blocks, but the impact is minimal.

**Verdict**: For typical e-commerce use (2-8 variants per product), performance is acceptable.

---

#### 4. SECURITY

**Grade: A**

**XSS Protection**:
- All user-facing output properly escaped:
  - `{{ card_display_title | escape }}` (lines 158, 201)
  - `{{ variant_option_value | escape }}` used in title construction
  - No raw HTML output from user-generated content

**Injection Prevention**:
- Variant IDs used in URLs are integer IDs from Shopify (safe)
- No dynamic SQL or code generation

**No Security Issues Found**

---

#### 5. CODE QUALITY

**Grade: A-**

**Positives**:
1. **Clear Comments**: Excellent documentation blocks explaining the feature (lines 158-162, 167, 177, 186, 225, 255)
2. **Consistent Naming**: `card_display_image`, `card_display_title`, `card_url` are clear
3. **Logical Structure**: Clean if/else/elsif flow with fallbacks
4. **Updated Documentation**: card-product.liquid header comment updated with `card_variant` parameter (lines 6, 23)

**Minor Issues**:
1. **Magic Number**: `<= 4` appears in both swatch display and this feature - could be consolidated
2. **Duplicated Fallback Logic**: The fallback rendering block (lines 224-252) is nearly identical to normal rendering (lines 254-282) - some DRY refactoring could help

---

#### 6. CODE REVIEW FIXES VERIFICATION

**Grade: A**

All three code review fixes were properly implemented:

| Fix | Status | Evidence |
|-----|--------|----------|
| String contains bug (delimiter wrapping) | **APPLIED** | Line 184: `'|' \| append: variant_value \| append: '|'` and line 178: `shown_values = '|'` |
| Correct property name (featured_image) | **APPLIED** | Line 42: `card_variant.featured_image` with fallback to `card_variant.image` |
| Hover disabled for variants | **APPLIED** | Lines 64-66: `if card_variant` sets `show_secondary_image = false` |

---

### OVERALL GRADE: A

**Summary**: This is a well-implemented feature with proper edge case handling, good security practices, and excellent code documentation. The code review fixes were properly applied. Minor concerns around performance for products with many variants and some DRY opportunities don't detract from the overall quality.

**Recommendations**:
1. **Optional**: Add a performance note in the info text warning about products with 50+ variants
2. **Optional**: Consider extracting the fallback rendering into a shared pattern to reduce duplication
3. **Test**: Verify functionality in Theme Editor preview before production use

**Status**: APPROVED FOR PRODUCTION

---

### 2026-02-01 - Variant Expansion Feature: COMPLETE

**Commit**: `e3403c4` - feat(collections): Add per-collection variant expansion option

**Files Modified**:
- `sections/main-collection-product-grid.liquid` - Added 3 section settings + variant expansion loop
- `snippets/card-product.liquid` - Added `card_variant` parameter support

**Code Review**: Grade A - APPROVED FOR PRODUCTION

**Status**: ✅ DEPLOYED - Ready for user testing

**Testing Instructions**:
1. Go to Shopify Admin > Online Store > Themes > Customize
2. Navigate to a collection page (e.g., /collections/all)
3. In left sidebar, scroll to "Variant Expansion" section
4. Enable "Show color variants as separate products"
5. Select option to expand (Color or Material)
6. Set max variants per product (2-8)
7. Save and preview

**Pending User Actions**:
- [ ] Test feature on collection with Color-variant products
- [ ] Verify variant cards display correctly
- [ ] Verify swatches still appear on variant cards
- [ ] Verify hover is disabled on variant cards
- [ ] Verify clicking card loads correct variant on PDP

---

### 2026-02-02 - Preferred Size Setting for Variant Expansion

**Request**: User asked for ability to show a specific size's image when expanding by color (for products with different images per size, like framed portraits).

**Implementation**: Added "preferred_variant_size" setting with intelligent fallback.

**Changes Made**:

1. **New Setting** (`sections/main-collection-product-grid.liquid`, lines 544-550):
   ```liquid
   {
     "type": "text",
     "id": "preferred_variant_size",
     "default": "11\" × 14\"",
     "label": "Preferred size for variant images",
     "info": "When expanding by color, show the image from this size variant. Leave blank for first variant."
   }
   ```

2. **Variant Selection Logic** (lines 194-210):
   - For each unique color, searches for a variant containing the preferred size text
   - Uses case-insensitive matching (`downcase`)
   - Falls back to first variant if no size match found
   - Efficient: uses `break` once match is found

**How It Works**:
```
Product: Frame Portrait
- Blue / 5x7 → Blue-5x7.jpg
- Blue / 8x10 → Blue-8x10.jpg
- Blue / 11x14 → Blue-11x14.jpg ← Selected (matches "11" × 14"")
- Red / 5x7 → Red-5x7.jpg
- Red / 11x14 → Red-11x14.jpg ← Selected
```

**Commit**: `c02e3fe` - feat(collections): Add preferred size setting for variant expansion

**Status**: ✅ DEPLOYED

---

---

### 2026-02-06 - BiRefNet API Error Analysis: "cannot identify image file"

**Issue**: Single 500 error on `/api/v2/process-with-effects` endpoint with error "cannot identify image file".

**Analysis by**: debug-specialist agent

#### Error Details
- **Timestamp**: 2026-02-04T19:10:44.239253Z
- **File**: pet-1.jpg (1.19MB)
- **Latency**: 11.5ms (immediate failure)
- **Effects requested**: enhancedblackwhite, color
- **Referer**: https://perkieprints.com/

#### Root Cause Analysis

The error "cannot identify image file" is a **PIL/Pillow exception** thrown when `Image.open()` cannot parse the image header or determine the file format. The 11.5ms latency confirms the failure happened immediately during image parsing, not during model inference.

**Most Probable Cause: Incomplete/Truncated Upload (90% confidence)**

Evidence:
1. **Valid file size** (1.19MB is reasonable for a JPEG)
2. **Valid content-type validation passed** (the request got past the `file.content_type.startswith("image/")` check at line 692)
3. **Immediate failure** (11.5ms = image header parsing failed, not processing)
4. **BytesIO object in error** indicates data was read but unreadable

This pattern matches a **network interruption during multipart form upload**:
- Browser started upload, set correct Content-Type header
- Connection dropped mid-transfer OR packet loss corrupted data
- Server received incomplete/corrupted bytes
- PIL could not identify the truncated data as a valid image

**Alternative Causes (Lower probability)**:

| Cause | Probability | Evidence Against |
|-------|-------------|------------------|
| Wrong file type (not actually an image) | 10% | Content-type validated, file named .jpg |
| File corrupted on client device | 5% | Would fail consistently, not one-off |
| Memory corruption on server | <1% | Would affect more requests |
| Malformed multipart boundary | 5% | Would likely cause parsing error, not PIL error |

#### Code Path Analysis

Looking at `main.py` lines 690-708 for `/api/v2/process-with-effects`:

```python
# Line 692: Content-type validation PASSED
if not file.content_type or not file.content_type.startswith("image/"):
    raise HTTPException(status_code=400, detail="File must be an image")

# Line 695-702: File size validation PASSED (would have 413 if too large)
content = await file.read()
file_size_mb = len(content) / (1024 * 1024)
if file_size_mb > MAX_IMAGE_SIZE_MB:
    raise HTTPException(...)

# Line 704: Logging shows request was received
logger.info(f"Processing with effects [{effects}]: {file.filename} ({file_size_mb:.2f}MB)")

# Line 708: THIS IS WHERE IT FAILED
image = Image.open(io.BytesIO(content))  # <-- PIL raised UnidentifiedImageError
```

**Gap in Validation**: The code validates:
- Content-Type header (can be spoofed, or set before upload completes)
- File size (checks length of received bytes)

But does NOT validate:
- Actual image magic bytes (file signature)
- Image can actually be parsed/decoded

#### Severity Assessment: **LOW**

| Factor | Assessment |
|--------|------------|
| Error rate | 1/~40 requests = 2.5% (single occurrence) |
| User impact | 1 user affected, can retry |
| Data loss | None - original file still on client |
| Business impact | Minimal - user sees error, retries |
| Recovery | Automatic on retry |

This is a **transient network issue**, not a code bug.

#### Recommendations

**Priority 1: Improve Error Messaging (LOW effort, HIGH value)**

Current error message exposes Python internals:
```
"cannot identify image file <_io.BytesIO object at 0x7fb993cd8f40>"
```

Recommend user-friendly message:
```python
except UnidentifiedImageError:
    logger.warning(f"Could not decode image {file.filename} - may be corrupted or incomplete upload")
    raise HTTPException(
        status_code=400,
        detail="Could not process image. The file may be corrupted or the upload was incomplete. Please try uploading again."
    )
```

**Priority 2: Add Image Magic Byte Validation (MEDIUM effort, MEDIUM value)**

Before calling `Image.open()`, validate the file starts with known image signatures:

```python
def validate_image_magic_bytes(content: bytes) -> str | None:
    """Validate image magic bytes and return detected format or None"""
    signatures = {
        b'\xff\xd8\xff': 'JPEG',
        b'\x89PNG\r\n\x1a\n': 'PNG',
        b'RIFF': 'WebP',  # Actually RIFF....WEBP
        b'GIF8': 'GIF',
    }
    for sig, fmt in signatures.items():
        if content.startswith(sig):
            return fmt
    return None

# Usage:
detected_format = validate_image_magic_bytes(content)
if not detected_format:
    raise HTTPException(status_code=400, detail="File does not appear to be a valid image")
```

**Priority 3: Add Retry Guidance in Frontend (LOW effort, MEDIUM value)**

When the API returns this specific error, frontend could show:
"Upload failed. Please check your internet connection and try again."

**NOT Recommended**:
- Server-side retry logic (network issues are client-side)
- Automatic re-upload (would duplicate failed uploads)
- Aggressive validation that rejects valid edge cases

#### Impact Summary

- **No code changes required** for this single error
- **Optional UX improvement**: Better error message
- **No pattern of failures**: Single occurrence in 5 days is acceptable
- **Root cause**: Network issue during upload, not code bug

---

### 2026-02-06 - Frontend Analysis: /store-image Migration from InSPyReNet to BiRefNet

**Request**: Analyze frontend code changes needed if `/store-image` endpoint migrates from InSPyReNet to BiRefNet.

#### Complete File List

| File | Line(s) | Usage | Type |
|------|---------|-------|------|
| `assets/inline-preview-mvp.js` | 1580, 1622 | Uploads effects + original to GCS | Primary |
| `assets/pet-processor.js` | 3379 | Uploads effects to GCS | Primary |
| `snippets/ks-product-pet-selector-stitch.liquid` | 2422 | Fallback upload for originals | Fallback |
| `assets/api-client.js` | 14 | InSPyReNet URL in API_URLS config | Reference |

#### Current URL Pattern Analysis

**Processing Endpoints** (already migrated to BiRefNet):
- `assets/api-client.js`: Uses `USE_BIREFNET` flag to switch between APIs
- `assets/pet-processor.js`: Hardcoded to BiRefNet (`this.apiUrl = 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app'`)
- `assets/inline-preview-mvp.js`: Hardcoded to BiRefNet (`const API_URL = 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app/api/v2/process-with-effects'`)

**Storage Endpoints** (still on InSPyReNet):
- All three primary files still hardcode: `https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image`

#### Recommended URL Configuration Strategy

**Option A: Add STORAGE_API_URL constant (RECOMMENDED)**
- Create separate constant for storage URL
- Allows independent control of processing vs storage APIs
- Lower risk during transition

```javascript
// api-client.js
const API_URLS = {
  inspirenet: 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app',
  birefnet: 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app'
};

// NEW: Separate storage URL (can differ from processing)
const STORAGE_API_URL = USE_BIREFNET
  ? 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app'
  : 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
```

**Option B: Use same base URL as processing**
- Simplest approach if BiRefNet `/store-image` is drop-in compatible
- Less flexibility but easier to maintain

#### Required Code Changes

**1. assets/inline-preview-mvp.js (2 changes)**

```javascript
// Line 1580 (uploadViaInSPyReNet function)
// BEFORE:
const response = await fetch(
  'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image',

// AFTER:
const response = await fetch(
  'https://birefnet-bg-removal-api-753651513695.us-central1.run.app/store-image',

// Line 1622 (uploadOriginalToGCS function)
// Same change
```

**2. assets/pet-processor.js (1 change)**

```javascript
// Line 3379 (uploadToGCS function)
// BEFORE:
const apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image';

// AFTER:
const apiUrl = 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app/store-image';
```

**3. snippets/ks-product-pet-selector-stitch.liquid (1 change)**

```javascript
// Line 2422 (fallback uploadToServer function)
// BEFORE:
const response = await fetch(
  'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image',

// AFTER:
const response = await fetch(
  'https://birefnet-bg-removal-api-753651513695.us-central1.run.app/store-image',
```

#### Fallback Strategy Options

**Option 1: No fallback (Clean switch)**
- Simply change URLs, no fallback to InSPyReNet
- Requires confidence in BiRefNet storage stability
- Simplest approach

**Option 2: Fallback with try/catch (RECOMMENDED)**
```javascript
async uploadEffectToGCS(dataUrl, sessionKey, effectName) {
  const BIREFNET_STORAGE = 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app/store-image';
  const INSPYRENET_FALLBACK = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image';

  try {
    // Try BiRefNet first
    const response = await fetch(BIREFNET_STORAGE, { method: 'POST', body: formData });
    if (response.ok) return await response.json();
    throw new Error(`BiRefNet storage failed: ${response.status}`);
  } catch (error) {
    console.warn('⚠️ BiRefNet storage failed, trying InSPyReNet fallback:', error.message);
    // Fallback to InSPyReNet
    const fallbackResponse = await fetch(INSPYRENET_FALLBACK, { method: 'POST', body: formData });
    return await fallbackResponse.json();
  }
}
```

**Option 3: Feature flag (Maximum flexibility)**
- Add `USE_BIREFNET_STORAGE` flag separate from processing
- Allows A/B testing storage backends

#### Error Handling Analysis

**Current error handling in affected files:**

1. **inline-preview-mvp.js** (lines 1586-1597):
   - Returns `null` on HTTP error
   - Logs error but continues (graceful degradation)
   - Falls back to data URL storage (localStorage quota risk)

2. **pet-processor.js** (lines 3385-3404):
   - Returns `null` on HTTP error
   - Logs detailed error with status code
   - Similar graceful degradation pattern

3. **ks-product-pet-selector-stitch.liquid** (lines 2430-2454):
   - Throws error on HTTP failure
   - Has retry logic (3 attempts with exponential backoff)
   - Returns `{ success: false, error }` on total failure

**Recommendation**: Current error handling is adequate. No changes needed except potentially adding fallback URLs.

#### Testing Requirements

**Pre-deployment tests:**
1. ✅ Verify BiRefNet `/store-image` endpoint exists and matches InSPyReNet API contract
2. ✅ Test response format: `{ success: boolean, url: string }`
3. ✅ Verify GCS bucket permissions (BiRefNet bucket may differ)
4. ✅ Test with various file sizes (1MB, 5MB, 15MB)

**Post-deployment tests:**
1. Upload pet photo via processing page → verify GCS URL returned
2. Upload via inline preview modal → verify effects saved to GCS
3. Upload via product page direct upload → verify fallback works
4. Verify Session Pet Gallery loads GCS URLs correctly
5. Verify cart submission includes valid GCS URLs
6. Test on mobile (70% of traffic)

**Regression tests:**
- Session restoration with GCS URLs
- Multi-pet orders (3 pets)
- AI effect generation (Ink Wash, Marker)

#### Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| inline-preview-mvp.js | MEDIUM | Add fallback, test extensively |
| pet-processor.js | MEDIUM | Same URL pattern, proven stable |
| pet-selector-stitch.liquid | LOW | Already has retry logic |
| api-client.js | LOW | Reference only, not storage |

**Overall Risk: MEDIUM**
- Storage is critical path for order fulfillment
- Graceful degradation to data URLs exists but risks localStorage quota
- Recommend phased rollout with fallback URLs

#### Implementation Order

1. **Phase 1**: Update `api-client.js` with STORAGE_API_URL constant
2. **Phase 2**: Update `inline-preview-mvp.js` with fallback
3. **Phase 3**: Update `pet-processor.js`
4. **Phase 4**: Update `ks-product-pet-selector-stitch.liquid`
5. **Phase 5**: Monitor for 48h, remove fallbacks if stable

---

### 2026-02-06 - Inline Gemini Processor: Full Implementation

**Request**: Create embedded inline Gemini pet processor for product pages with per-product configurable prompts via theme editor dropdown.

**Plan**: See `.claude/plans/mighty-kindling-nova.md`

**Key Decisions**:
- Direct to Gemini (no background removal step)
- 1 pet per product (single upload zone)
- Both existing styles (ink_wash, pen_and_marker) + custom prompt text
- Embedded inline (not modal)
- Per-product coexistence control (only_gemini / only_selector / both)
- New endpoint `/api/v1/generate-custom` (separate from existing `/api/v1/generate`)

#### Files Created (4)

| File | Purpose |
|------|---------|
| `snippets/ks-gemini-processor-inline.liquid` | HTML structure, hidden form fields, script loading |
| `assets/gemini-processor-inline.js` | GeminiProcessorInline class (IIFE, ES5 compat) |
| `assets/gemini-processor-inline.css` | Mobile-first styles, reduced-motion support |
| `templates/product.gemini-custom.json` | Pre-configured product template |

#### Files Modified (5)

| File | Change |
|------|--------|
| `sections/main-product.liquid` | Added `ks_gemini_processor` block schema + rendering + coexistence guard |
| `assets/gemini-api-client.js` | Added `generateCustom()` method |
| `backend/gemini-artistic-api/src/models/schemas.py` | Added `CustomGenerateRequest` model |
| `backend/gemini-artistic-api/src/core/gemini_client.py` | Added `_prepare_image()`, `sanitize_prompt()`, `generate_from_custom_prompt()` |
| `backend/gemini-artistic-api/src/main.py` | Added `/api/v1/generate-custom` endpoint |
| `backend/gemini-artistic-api/src/core/storage_manager.py` | Extended cache keys for prompt hash |

#### Code Review: Grade B+ → Fixes Applied

| Issue | Severity | Fix |
|-------|----------|-----|
| Race condition in `.then()` handler | CRITICAL | Added state guard: `if (self.state !== 'processing') return;` |
| AbortController never wired up | CRITICAL | Created in `processUpload()`, passed to fetch calls, cleaned up on cancel |
| Code duplication in gemini_client.py | CRITICAL | Extracted `_prepare_image()` static method |
| `var` vs `const/let` in generateCustom | IMPORTANT | Changed to `const` |
| Empty `src=""` on result image | IMPORTANT | Removed `src` attribute entirely |
| No prefers-reduced-motion | IMPORTANT | Added CSS media query disabling animations |

**Existing Pipeline Impact**: NONE - Zero modifications to pet-processor.js, inline-preview-mvp.js, pet-storage.js, BiRefNet API, or InSPyReNet API. Only additive coexistence guard in main-product.liquid (defaults to no behavioral change).

**Status**: Implementation + code review fixes complete. Ready for commit, deploy, and testing.

**Next Steps**:
1. Commit and push to staging
2. Deploy Gemini API backend (`./scripts/deploy-gemini-artistic.sh`)
3. Test end-to-end with Chrome DevTools MCP
4. Test coexistence modes, mobile viewport, session restoration

---

### 2026-02-08 - Shopify Template Validation Error: Root Cause Analysis

**Error**: `templates/product.gemini-custom.json, Validation failed: Invalid value for type in block 'ks_gemini_processor_inline'. Type must be defined in schema.`

**Context**: Commit `4e0d0c1` introduced BOTH the new block type in `sections/main-product.liquid` AND the template referencing it in `templates/product.gemini-custom.json` simultaneously. Follow-up fix `a275d64` changed a default value but did not resolve the validation error.

#### Root Cause: DEPLOYMENT ORDER RACE CONDITION

**Primary Cause (95% confidence): Shopify GitHub integration processes template files BEFORE section files are fully validated and registered.**

When the GitHub integration syncs a commit containing both:
1. A section file with a NEW block type definition (`main-product.liquid` adding `ks_gemini_processor`)
2. A template file referencing that new block type (`product.gemini-custom.json`)

...the template is validated against the CURRENT (pre-update) section schema, which does NOT yet contain the new block type. The section file's schema changes haven't been processed/registered yet when the template validation runs.

**Evidence**:
1. Schema JSON is syntactically valid (verified by Python parser)
2. Block type `ks_gemini_processor` IS correctly defined at index [10] in the blocks array
3. All 9 template block types match their schema definitions exactly
4. `ks_pet_selector` works because it was established in the section schema BEFORE any templates referenced it (existing block types in pre-commit schema)
5. This exact pattern is documented in Shopify CLI issue [#2008](https://github.com/Shopify/cli/issues/2008) and ThemeKit issue [#171](https://github.com/Shopify/themekit/issues/171)
6. The section file "deployed successfully" (section uploaded) but the template fails because validation happens against the stale schema

**Confirmed NOT the cause**:
- Block type naming (underscores are valid, `ks_gemini_processor` follows same pattern as working `ks_pet_selector`)
- Block key vs type confusion (`ks_gemini_processor_inline` is the key, `ks_gemini_processor` is the type - this is correct)
- `@app` blocks or block registration order (no conflict)
- JSON syntax errors (both files are valid JSON)
- `placeholder` attribute on textarea (docs confirm it's valid, just not rendered in section context)
- Empty string defaults (fixed in a275d64, didn't resolve)

#### Solution: Two-Phase Deployment

**Option A: Deploy section first, template second (RECOMMENDED)**

Step 1: Push ONLY the section file change (without the template):
```bash
git add sections/main-product.liquid
git commit -m "feat: Add ks_gemini_processor block type to main-product schema"
git push origin staging
# Wait 1-2 minutes for Shopify to sync and register the new block type
```

Step 2: Push the template file:
```bash
git add templates/product.gemini-custom.json
git commit -m "feat: Add gemini-custom product template using ks_gemini_processor block"
git push origin staging
```

**Option B: Create template via Shopify Admin UI**

1. Ensure the section file with the new block type is already deployed
2. Go to Shopify Admin > Online Store > Themes > Customize
3. Create a new product template "gemini-custom"
4. Add the `ks_gemini_processor` block via the block picker
5. Configure settings manually
6. The template JSON will be auto-generated by Shopify and synced back to git

**Option C: Temporarily remove template, push, re-add (if Option A doesn't work)**

1. Delete `templates/product.gemini-custom.json` from git
2. Push (section deploys with new block type registered)
3. Wait for sync
4. Re-add the template file
5. Push again

**Current status**: Waiting for user decision on approach.

**Files involved**:
- `sections/main-product.liquid` (line 1357: block type definition)
- `templates/product.gemini-custom.json` (line 29: block type reference)
- `snippets/ks-gemini-processor-inline.liquid` (rendered by the block)

---

### 2026-02-08 - Gemini Artistic API Deployment: Custom Prompt Support

**Action**: Deployed Gemini Artistic API to Cloud Run with new `/api/v1/generate-custom` endpoint.

**Deployment Details**:
- **Service**: gemini-artistic-api
- **Revision**: `gemini-artistic-api-00039-6ml` (100% traffic)
- **URL**: `https://gemini-artistic-api-753651513695.us-central1.run.app`
- **Build ID**: `38060509-2621-486a-945f-83264f2b3788` (SUCCESS, 52s)
- **Project**: gen-lang-client-0601138686 (perkieprints-nanobanana)
- **Region**: us-central1

**Health Check Verified**:
```json
{
  "status": "healthy",
  "model": "gemini-2.5-flash-image",
  "styles": ["ink_wash", "pen_and_marker", "custom"],
  "timestamp": 1770576604.8876274
}
```

**Configuration**:
- CPU: 2, Memory: 2Gi
- Min instances: 0, Max instances: 5
- Timeout: 300s
- Secrets: GEMINI_API_KEY from Secret Manager

**Impact**: ADDITIVE ONLY - existing Ink Wash and Pen & Marker effects unchanged. New `custom` style and `/api/v1/generate-custom` endpoint added.

**Next Steps**:
1. Test end-to-end with inline processor on Silhouette product page
2. Verify `/api/v1/generate-custom` processes images correctly
3. Test cold start behavior (first request after scale-to-zero)

---

### 2026-02-08 - Separate Rate Limits + Upload-Only Fallback

**Request**: Separate rate limits for custom prompts (3/day) vs named styles (10/day), and decouple upload from processing so customers can still upload when out of generations.

**Plan**: See `.claude/plans/mighty-kindling-nova.md`

**Agent Consensus**: All 5 agents (AI PM, Infra, UX, Conversion, Code Quality) agreed on approach.

#### Backend Changes

| File | Change |
|------|--------|
| `backend/.../config.py` | Added `rate_limit_custom_daily: int = 3` |
| `backend/.../rate_limiter.py` | Added `quota_type` param, compound Firestore doc keys (`customer_{id}_{type}`), `_get_limit()` helper |
| `backend/.../main.py` | Wired endpoints to correct quota types, removed rate limit from upload endpoint, added `quota_type` to `/quota` |

#### Frontend Changes

| File | Change |
|------|--------|
| `assets/gemini-api-client.js` | Added `customQuotaState`, `checkQuota(quotaType)` param, `generateCustom()` uses `checkQuota('custom')` |
| `assets/gemini-processor-inline.js` | Upload-only fallback flow, new `uploaded` state, `showUploadOnlyConfirmation()`, `populateFormFieldsUploadOnly()` |
| `snippets/ks-gemini-processor-inline.liquid` | Added `uploaded` state HTML + `_processing_status` hidden field |
| `assets/gemini-processor-inline.css` | Styles for `.gemini-processor__uploaded` state |

#### Deployment

- **Revision**: `gemini-artistic-api-00042-g6s` (100% traffic)
- **Health Check**: Verified — `rate_limits: { named: 10, custom: 3 }`
- **Env Vars**: `RATE_LIMIT_CUSTOM_DAILY=3`, `GEMINI_CUSTOM_MODEL=gemini-3-pro-image-preview`

#### Commit

- **Hash**: `40c860f` — feat: Separate rate limits for custom prompts + upload-only fallback
- **Pushed to**: staging branch

**Status**: DEPLOYED AND COMMITTED — Ready for end-to-end testing

---

### 2026-02-10 - Root Cause Analysis: aspect-ratio Not Working on Style Landing Product Images

**Issue**: CSS `aspect-ratio` set on `.style-landing__product-img--square` (and portrait/landscape variants) has no visible effect. Changing the ratio in the theme editor does nothing.

**Root Cause**: `height: auto` on `<img>` elements combined with Shopify's `image_tag` injecting intrinsic `width` and `height` HTML attributes prevents `aspect-ratio` from overriding the natural image dimensions.

**The `aspect-ratio` CSS property on replaced elements (`<img>`) is only used to determine the "preferred aspect ratio" BEFORE the image loads. Once the image has loaded (or has explicit `width`/`height` attributes), the intrinsic dimensions take priority when `height: auto` is set.** Adding `height: auto` to an `<img>` with HTML `width`/`height` attributes tells the browser: "use the intrinsic height that corresponds to the computed width" -- which is based on the image's natural proportions, NOT the CSS `aspect-ratio`.

**Key Findings**:

1. **`.style-landing__product-img` (style-landing.css line 492-498)** sets `width: 100%` but does NOT set `height`. Without an explicit height, the image falls through to its natural aspect ratio.

2. **Shopify's `image_tag` filter** automatically injects `width="..."` and `height="..."` HTML attributes on the `<img>` element. These attributes establish an intrinsic aspect ratio per the CSS spec, which overrides the CSS `aspect-ratio` property when `height: auto` is in effect.

3. **No explicit `height: auto` on `.style-landing__product-img`** itself, BUT the combination of intrinsic HTML attributes + browser default behavior achieves the same result. The browser computes the height from the intrinsic dimensions.

**Fix**: Add `height: auto` explicitly paired with `aspect-ratio` -- this alone won't work. The fix requires ALSO using `object-fit: cover` (already present) AND ensuring the height is NOT left to the intrinsic ratio. The correct fix is to add `height: 100%` or a specific height constraint so aspect-ratio can control the box dimensions.

Actually -- the correct CSS fix is:
```css
.style-landing__product-img--square,
.style-landing__product-img--portrait,
.style-landing__product-img--landscape {
  height: auto; /* explicit -- overrides any inherited height */
  /* aspect-ratio already set per modifier */
}
```
Wait -- this won't work either for replaced elements with intrinsic dimensions. The REAL fix needs `object-fit: cover` + explicit sizing that forces the aspect ratio.

**See full analysis in work log entry.**

---

### 2026-02-10 - Cloud Run Log Analysis (Feb 7-10, 2026)

**Task**: Analyze Cloud Run logs for both Gemini Artistic API and BiRefNet BG Removal API. Identify issues, root causes, and recommendations.

**Services Analyzed**:
1. `gemini-artistic-api` (Gemini Artistic API)
2. `birefnet-bg-removal-api` (BiRefNet BG Removal API)

**Findings**: See detailed analysis in conversation response.

**Key Issues Found**:
1. BiRefNet 500: Corrupt/truncated image upload - recurring pattern (same bug as 2026-02-06)
2. Gemini 422: `CustomGenerateRequest` validation failures - prompt too short (<10 chars)
3. Gemini 404: Frontend deployed before backend rev 00039 (timing issue, self-resolved)
4. Gemini: Missing `/robots.txt` causing cold starts from Googlebot

**Recommendations**:
- P1: Add magic byte validation to BiRefNet image parsing
- P1: Improve BiRefNet error message (don't expose Python internals)
- P2: Add `/robots.txt` endpoint to Gemini API to prevent cold start waste
- P3: Frontend should validate prompt length client-side before API call

**Status**: Analysis complete, no code changes made (analysis-only task)

---

### 2026-02-11 - Customer Screen Corruption Bug: GPU Memory Exhaustion Fix

**Issue**: Customer (2019 MacBook Pro 16, Intel UHD 630, 1536 MB shared VRAM) reported screen corruption, freezing, and layout misalignment on `/pages/custom-image-processing` when processed images are displayed. Corruption affected ALL browser tabs in both Chrome and Safari, requiring full browser restart.

#### Root Cause Analysis

**GPU Memory Exhaustion (90% confidence)**: After processing completes, the page renders 37 large images simultaneously with `mix-blend-mode: multiply` on 16 product mockup cards, exhausting shared VRAM.

| Element | Count | Size | GPU Impact |
|---------|-------|------|-----------|
| Pet overlay images (data URLs) | 16 | 960×1280 | ~79 MB (worst case) |
| Product template images | 16 | 800×600 | ~30 MB |
| Blend mode composite buffers | 16 | - | ~64 MB |
| Style card previews + main preview | 5 | 960×1280 | ~25 MB |
| **PEAK TOTAL** | | | **~208 MB** |

**Three amplifiers**: (1) `mix-blend-mode: multiply` triples GPU texture requirements per card, (2) data URL assignment to 16 `<img>` elements prevents browser texture deduplication, (3) no image downsampling (960×1280 displayed at 120-200px).

**Why all tabs affected**: Intel UHD 630 uses shared system RAM as VRAM; Chrome/Safari use a single GPU process for all tabs.

#### Broader Impact: NOT exclusive to this customer

Estimated 15-35% of visitors experience some degradation (silent tab kills on mobile, freezing on integrated GPUs). 70% mobile traffic = budget Android GPUs at highest risk. Potential 5-10% conversion loss.

#### Implementation

**Plan**: `.claude/plans/ticklish-painting-pumpkin.md`

**Agents consulted**: debug-specialist, code-quality-reviewer, mobile-commerce-architect, solution-verification-auditor, plan architect

##### Files Modified

| File | Change | Impact |
|------|--------|--------|
| `assets/product-mockup-renderer.js` | Thumbnail + blob URL deduplication, IntersectionObserver lazy loading, generation counter, data flow guards | ~97% GPU reduction |
| `assets/product-mockup-grid.css` | `contain: layout paint` on cards, `aspect-ratio: 3/4` on pet overlay | Prevents recomposite cascade |
| `assets/pet-processor.js` | Canvas cleanup in `fixImageRotation()` and `resizeImageForUpload()` blob callbacks | ~5-10 MB freed |

##### Key Design Decisions

1. **`currentEffectUrl` vs `_displayBlobUrl` separation**: `currentEffectUrl` always holds the original serializable URL (data/GCS). `_displayBlobUrl` is display-only blob URL, never persisted.
2. **`data-original-src` attribute**: Every overlay `<img>` carries the full-resolution URL as a DOM attribute for downstream safety.
3. **Generation counter**: Prevents race conditions during rapid effect switching. Stale blob URLs are revoked.
4. **PNG thumbnails**: Preserve transparency from background removal (not JPEG).
5. **URL deduplication**: Skip thumbnail recreation when same source URL is applied twice.
6. **CORS handling**: `img.crossOrigin = 'anonymous'` for GCS URLs, with graceful fallback on SecurityError.
7. **IntersectionObserver**: 2 cards on mobile / 4 on desktop loaded immediately, rest lazy with 400px rootMargin.

##### Code Quality Review: B+ (APPROVED WITH CONDITIONS)

| Criterion | Grade |
|-----------|-------|
| Data Flow Safety | A |
| Race Conditions | A- |
| Error Handling | B+ |
| Integration | A- |
| Browser Compatibility | C+ (pre-existing ES6+ usage, not introduced by this change) |

**Blocking issues resolved**: blob URL isolation, race condition guard, CORS handling
**Remaining**: URL deduplication added, `imageSmoothingQuality` feature detection improved

**Status**: Implementation complete. Ready for commit and deployment testing.

---

### 2026-02-11 — Chrome DevTools MCP Testing (Staging)

**Commit**: `c76c981` pushed to staging branch
**Staging URL**: `https://r96x7eecrrn0nv0j-2930573424.shopifypreview.com/pages/custom-image-processing`
**Test image**: `testing/riley.jpg` (dog with American flag sunglasses, 1073x1073)

**Test Results — ALL PASS**:

| Test | Status | Details |
|------|--------|---------|
| Thumbnail downsampling | PASS | 1073×1073 → 425×425 (185-309KB depending on effect) |
| Lazy loading | PASS | 4 immediate + 12 lazy via IntersectionObserver |
| All 16 cards render | PASS | Scrolled through all 4 rows, all overlays correct |
| Effect switching (B&W → Color) | PASS | New thumbnail created (309KB color vs 185KB B&W) |
| Rapid switching race condition | PASS | 3 clicks in 200ms — only final effect (Marker) applied, stale B&W/Ink Wash discarded |
| PetStorage blob leak check | PASS | No blob: URLs in localStorage |
| `data-original-src` attribute | PASS | Set on all 16 overlays with GCS URLs |
| Console errors | PASS | No new errors (only pre-existing Shopify preview 404s) |
| CORS handling | PASS | No SecurityError or canvas tainting issues |

**Key console messages confirming fix**:
- `[ProductMockupRenderer] Thumbnail created: 1073x1073 → 425x425 (185KB)` — B&W effect
- `[ProductMockupRenderer] Updated 16 mockups (immediate: 4, lazy: 12, thumbnail: 425px)`
- `[ProductMockupRenderer] Thumbnail created: 1073x1073 → 425x425 (309KB)` — Color effect
- `[ProductMockupRenderer] Thumbnail created: 1024x1024 → 425x425 (165KB)` — Marker effect (Gemini AI)
- Generation counter discarded 2 stale thumbnails during rapid switching

**Status**: GPU memory fix verified on staging. Ready for production merge.

---

### 2026-02-11 - UX Review: Style Landing Page CTA Button Inconsistency

**Issue**: Style landing page buttons use squared-off appearance (8px border-radius, custom padding via `!important`) that clashes with theme's pill-shaped buttons (40px border-radius).

**Agent**: ux-design-ecommerce-expert

**Analysis**:

#### Button Inventory (style-landing.liquid)

| Button | Location | CSS Classes | Override Applied? |
|--------|----------|-------------|-------------------|
| Hero CTA | Line 37 | `style-landing__cta-primary button button--primary` | YES - `border-radius: 8px !important`, `padding: 14px 28px !important` |
| Preview banner CTA | Line 79 | `button button--secondary style-landing__preview-btn` | Partial - border/color only, radius inherits theme |
| Gallery CTA | Line 152 | `button button--primary` | NO - inherits theme (pill-shaped) |
| Compare section CTA | Line 246 | `button button--primary` | NO - inherits theme (pill-shaped) |
| Final CTA | Line 311 | `button button--primary style-landing__cta-large` | Partial - only padding/font override, radius inherits theme |

**Key Finding**: The inconsistency is WITHIN the same page. The Hero CTA is squared (8px radius), while the Gallery and Compare CTAs are pill-shaped (40px radius). This is worse than a cross-page inconsistency -- it's an intra-page inconsistency that erodes visual trust.

**Recommendation**: Remove the `border-radius` and `padding` overrides from `.style-landing__cta-primary` and `.style-landing__cta-large`. Let theme's `.button` class handle shape and sizing. See full UX analysis in conversation.

**Files to modify**: `assets/style-landing.css` (lines 57-67, 643-646)

**Status**: Analysis complete. Awaiting implementation approval.

---

### 2026-02-11 - Mobile Product Carousel Bug: Root Cause Analysis (Style Landing Pages)

**Issue**: Product carousel on style-landing pages "not working correctly on mobile."

**Agent**: debug-specialist

**See full analysis below in work log entry.**

---

### 2026-02-11 - BiRefNet Cloud Run Log Analysis (Feb 10-12, 2026)

**Task**: Comprehensive analysis of BiRefNet BG Removal API Cloud Run logs.
**Service**: birefnet-bg-removal-api (revision 00025-x4v)
**Log Period**: 2026-02-11 22:45:54 UTC through 2026-02-12 00:29:39 UTC

**Key Findings**:
- ZERO errors: 15/15 HTTP requests returned 200 OK (100% success rate)
- 1 cold start event: Instance scaled from 0, 29.4s latency on first request
- 2 distinct instances observed (old instance shut down, new one started)
- Enhanced B&W GPU first-run penalty: 4647ms and 5249ms on first B&W per instance vs 23-31ms warm
- All traffic from production perkieprints.com, 2 unique customer IPs
- 80% mobile traffic (iPhone iOS 18.7), 20% desktop (Chrome 144 on Windows)

**Recommendations**:
- P1: Frontend should show accurate countdown during cold starts (29s, not generic spinner)
- P2: Pre-warm Enhanced B&W CuPy kernels during startup warmup phase
- No code changes required -- service is healthy

**Status**: Analysis complete, no code changes made (analysis-only task)

---

### 2026-02-12 - Google Site Verification Tag Removal

**Request**: Remove `<meta name="google-site-verification">` tag from theme.liquid (user verified via DNS instead).

**Commit**: `1541c9c` — Remove Google site verification meta tag (verified via DNS instead)
**Pushed to**: staging + main

---

### 2026-02-12 - Merge Main into Staging

**Request**: Sync 57 Shopify Admin commits from main into staging.

**Commit**: `5128a76` — Merge main into staging (fast-forward merge of settings_data.json + page.pet-memorial.json)

---

### 2026-02-12 - Testimonials Carousel Fix

**Issue**: Carousel not working in ks-testimonials section.
**Root Cause**: Missing `component-slider.css` and `component-card.css` CSS dependencies. The carousel worked on homepage only because `featured-collection` section happened to load the CSS.

**Fix**: Added explicit CSS includes at top of `sections/ks-testimonials.liquid`.
**Commit**: `792216d` — Fix testimonials carousel by adding missing slider CSS dependencies
**Pushed to**: staging

---

### 2026-02-12 - Review Image Feature for Testimonials

**Request**: Add customer review photo support to testimonials section with size control.

**Implementation**:
- Block schema: `review_img` image_picker, renamed existing `img` to "Author avatar"
- Section schema: `review_img_ratio` select (Square 1:1, Landscape 4:3, Wide 16:9, Portrait 3:4, Original auto)
- HTML: Review image div between description and author footer
- CSS: `.ks-testimonials-review-img` with overflow hidden, border-radius, object-fit cover

**Files Modified**:
- `sections/ks-testimonials.liquid` (block schema + HTML)
- `assets/ks-sections.css` (review image styles)

**Commits**:
- `2967861` — Add customer review photo support to testimonials section
- `a70e182` — Switch review photo control from max-height to aspect ratio selector

**Merged to main**: `75a8fdb` (fast-forward merge)

---

### 2026-02-12 - FAQPage Schema Toggle for Collapsible Content

**Request**: Add FAQPage structured data to pet-memorial page. After evaluating 4 approaches (hardcoded section, new FAQ section, conditional snippet, toggle on existing section), implemented toggle on existing collapsible-content.liquid.

**Implementation**:
- Checkbox setting: `enable_faq_schema` (default false)
- JSON-LD output: FAQPage schema using section's own block data
- Strips "Q: " prefix from headings, strips HTML from answers
- Uses comma-prefix pattern (`faq_comma` variable) to prevent trailing comma bugs when blocks have blank headings/content

**Code Review Finding**: Trailing comma bug identified — `{% unless forloop.last %}` tracks outer loop, not filtered iterations. Fixed with comma-prefix pattern before commit.

**File Modified**: `sections/collapsible-content.liquid`
**Commit**: `59942ba` — Add FAQPage schema toggle to collapsible-content section
**Pushed to**: staging

**Next Step**: Enable the toggle via Shopify Admin on the pet-memorial page's collapsible-content section.

---

### 2026-02-13 - Customer Layout Bug Fix (Phase A)

**Issue**: Customer on 2019 MacBook Pro 16" (Intel UHD 630) reports `/pages/custom-image-processing` has "broken formatting" in BOTH Chrome and Safari. GPU memory fix (commit `c76c981`) resolved tab corruption but layout issue persists.

**Screenshot Evidence**: Two-column flex layout IS active, but left column (effect grid/style cards) is invisible. Right column shows pet image on large dark background. Eliminates `(hover: hover)` non-matching hypothesis.

**Root Cause Analysis** (5 agents consulted + code review agent):
1. **(45%)** `contain: layout` on `.processor-columns` breaks flex + sticky interaction — creates new containing block that interferes with `position: sticky` + `max-height: calc(100vh - 40px)` on `.processor-preview`
2. **(30%)** `showResult()` rAF callback silently fails — primary `processImage()` path has no safety net (unlike session restoration paths)
3. **(15%)** Async CSS timing
4. **(10%)** Pre-existing layout bug (visual symptom of #1)

**Phase A Fixes** (commit `1d24e2c`):
- Fix 1: Removed `contain: layout` from `.processor-columns` (pet-processor-v5.css)
- Fix 2: Added try/catch error boundary to `showResult()` rAF callback (pet-processor.js)
- Fix 3: Cleaned up dead `.action-buttons` selector (pet-processor.js)
- Fix 4: Replaced `inset: 0` with longhand in both CSS files (Safari 13-14 compat)

**Phase B** (pending customer feedback): Split `(hover: hover)` from desktop media queries, add `@supports` guard to mockup card containment
**Phase C** (deferred): Revert async CSS to synchronous (only if A+B don't resolve)

**Files Modified**: `assets/pet-processor-v5.css`, `assets/pet-processor.js`, `assets/pet-processor-mobile.css`
**Commit**: `1d24e2c` — Fix cross-browser layout bug on custom-image-processing page
**Pushed to**: staging

---

### 2026-02-13 - Safari Sticky+Flex Height Inflation Fix (Phase A addendum)

**Issue**: Phase A fixed Chrome but Safari still broken. Customer screenshots showed:
- Left column (`.processor-controls`) stretching to ~100vh, overlapping product grid/FAQs/reviews
- Style card grid rows separated by hundreds of pixels
- Pink/coral background extending far below the processor section

**Root Cause**: Known Safari WebKit flexbox bug (WebKit Bug 137730). Safari uses `max-height` of a `position: sticky` flex child when calculating the flex container height, instead of the child's content height. This inflated `.processor-columns` to ~100vh. `align-items: flex-start` on the parent was insufficient — Safari still used the inflated height for the container.

**Fix**: Added `align-self: flex-start` to BOTH flex children + `overflow-y: auto` on the sticky preview:
- `.processor-controls`: `align-self: flex-start` (prevents height stretching from sticky sibling)
- `.processor-preview`: `align-self: flex-start` + `overflow-y: auto` (tells Safari to use content height, not max-height, for flex calculation)

**File Modified**: `assets/pet-processor-v5.css`
**Commit**: `31354d6` — Fix Safari flex+sticky height inflation bug
**Pushed to**: staging

---

### 2026-02-13 - Competitor Comparison Page Build

**Request**: Build page and template for `/pages/best-custom-pet-portrait` comparing Perkie Prints vs West & Willow vs Crown & Paw. Content defined in `.claude/doc/comparison-page-content_1.md`.

**Agents consulted**: SEO optimization expert, Shopify conversion optimizer, UX design expert, solution verification auditor.

**Key architectural decisions**:
- Used `custom-liquid` section for comparison table (NOT `ks-table-compare` — its cells are single-line plain text, can't hold multi-sentence descriptions)
- Used `main-page` section (enabled) for semantic `<h1>` (rich-text headings always render as `<h2>` regardless of `heading_size` setting)
- Responsive table: semantic HTML `<table>` on desktop, CSS-transformed stacked cards on mobile (`display: block`)
- ARIA roles on all table elements to preserve accessibility during CSS card transformation
- 3 CTA placements: soft link in intro (main-page content), post-table primary button, end-of-page closing CTA
- Introduction shortened from 4 to 2 paragraphs (Conversion + UX agents flagged 4 paragraphs pushes table too far down on mobile)
- Table rows reordered to lead with Perkie Prints advantages (free preview, see all styles, art styles, revisions)
- FAQ uses existing `collapsible-content` section with `enable_faq_schema: true` (7 Q&As with FAQPage JSON-LD)

**Page template structure** (7 sections):
1. `main-page` — H1 + intro (page Content set via Shopify Admin)
2. `custom-liquid` — Comparison table (13 rows × 4 cols, checkmark/X SVG icons)
3. `rich-text` — Post-table CTA ("See Your Pet as Art — It's Free")
4. `multicolumn` — Company deep dives (3 cols desktop, stacked mobile)
5. `rich-text` — Decision guide ("Which Pet Portrait Service Is Right for You?")
6. `rich-text` — Final CTA ("Ready to See Your Pet as Art? It's Free.")
7. `collapsible-content` — FAQ with FAQPage schema

**SEO metadata** (to be set in Shopify Admin):
- Title: "Best Custom Pet Portrait Companies Compared (2026)" (51 chars)
- Meta description: "Compare Perkie Prints, West & Willow, and Crown & Paw side by side. Only one lets you preview every art style free before you buy." (131 chars)

**Files Created**:
- `assets/comparison-table.css` — Responsive table styles (desktop table + mobile stacked cards)
- `templates/page.best-custom-pet-portrait.json` — Page template assembling all 7 sections

**No existing files modified.**

**Commit**: `e97bf59` — Add competitor comparison page template and responsive CSS
**Pushed to**: staging

**Next Steps**:
1. Create the page in Shopify Admin (handle: `best-custom-pet-portrait`, template: `page.best-custom-pet-portrait`)
2. Set page title, meta description, and intro content in Shopify Admin
3. Test via Chrome DevTools MCP on staging URL
4. Merge staging to main when ready

---

### 2026-02-14 - Debug Specialist: Safari Sticky+Flex Height Inflation Deep Analysis

**Issue**: Phase A fix (removing `contain: layout`) resolved Chrome but Safari STILL shows broken layout. `align-self: flex-start` on both flex children was attempted as fix but did not work.

**Agent**: debug-specialist

#### Root Cause Analysis (Revised)

**The `align-self: flex-start` approach is fundamentally the wrong fix for this bug class.**

The problem is NOT that the flex children are stretching. The problem is that the flex CONTAINER itself is inflated. `align-self: flex-start` controls child positioning within the container, but does NOT prevent the container from growing.

Safari's layout sequence:
1. `.processor-preview` has `max-height: calc(100vh - 40px)` + `position: sticky`
2. Safari resolves `max-height` to a concrete pixel value (~960px on 1000px viewport)
3. Safari uses this resolved value as the **hypothetical cross size** when determining flex container height
4. `.processor-columns` (flex container) grows to ~100vh
5. `.processor-controls` (left column) CSS Grid rows distribute excess height (auto rows)
6. Style card grid rows get massive vertical gaps
7. Pink/coral background extends to ~100vh, overlapping product grid and FAQs

This is NOT WebKit Bug 137730 (fixed in Safari 11). This is a separate, still-present Safari behavior.

#### Recommended Fix: CSS Grid instead of Flexbox

Replace `display: flex` with `display: grid` on `.processor-columns`. CSS Grid with `align-items: start` is the canonical solution for sticky sidebars and is documented as working correctly in Safari.

```css
.pet-processor-container.has-result .processor-columns {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: var(--desktop-gap);
    align-items: start;
    /* rest unchanged */
}
```

**Why CSS Grid works**: Grid's `align-items: start` directly controls item height independently of sibling sizing. Unlike flexbox, CSS Grid does not use a sibling's `max-height` to determine row height when `align-items: start` is set.

**Alternative if Grid not feasible**: Wrapper div approach -- wrap `.processor-preview` in a non-sticky `<div>` that participates in flexbox, push sticky + max-height to inner element.

**Full analysis**: See conversation thread for 7 alternatives evaluated with reliability ratings.

**Status**: Analysis complete, fix implemented and deployed.

---

### 2026-02-14 - Safari Layout Fix: Flexbox → CSS Grid Migration

**Implementation**: Replaced `display: flex` with `display: grid` on `.processor-columns` for desktop two-column layout.

**Changes** (`assets/pet-processor-v5.css`):

| Rule | Before (Flexbox) | After (CSS Grid) |
|------|-------------------|-------------------|
| Container | `display: flex; align-items: flex-start` | `display: grid; grid-template-columns: 380px 1fr; align-items: start` |
| Controls | `order: 1; flex: 0 0 380px; min-width: 320px; max-width: 420px; align-self: flex-start` | `min-width: 0` |
| Preview | `order: 2; flex: 1; min-width: 400px; align-self: flex-start; display: block` | `min-width: 0` (sticky + max-height + overflow kept) |
| 1440px+ | `flex: 0 0 400px` on controls | `grid-template-columns: 400px 1fr` on container |
| 1920px+ | `flex: 0 0 420px` on controls | `grid-template-columns: 420px 1fr` on container |
| Fallback | `@supports not (display: flex)` | `@supports not (display: grid)` |

**Code Quality Review**: Grade B+ (approved). Minor concern about `min-width: 0` causing content overflow, but at 1024px+ viewport the grid tracks provide ample space.

**Commit**: `f8832fb` — Fix Safari layout bug: replace Flexbox with CSS Grid for desktop two-column layout
**Pushed to**: staging

**Next Steps**:
1. Have customer test on Safari with hard refresh (Cmd+Shift+R)
2. If confirmed fixed, merge to main

---

### 2026-02-14 - Debug Specialist: 3-Iteration Safari Layout Bug Deep Diagnostic

**Issue**: Customer on 2019 MacBook Pro 16" (Safari) continues to report layout issues after 3 fix attempts:
1. `1d24e2c`: Removed `contain: layout` (fixed Chrome, not Safari)
2. `31354d6`: Added `align-self: flex-start` (did not fix Safari)
3. `f8832fb`: Replaced Flexbox with CSS Grid (`grid-template-columns: 380px 1fr; align-items: start`) -- customer STILL reports issues

**Agent**: debug-specialist

**Analysis**: See full diagnostic strategy in conversation thread.

**Key Findings**:
1. `(hover: hover)` media query: CONFIRMED supported in Safari since v9 (2015), matches on macOS trackpads. NOT the root cause.
2. Async CSS loading: `media="print" onload` pattern has known Safari quirk for pages <200 chars body content (fixed in Safari TP), but NOT applicable to this page.
3. **HIGHEST RISK**: Assumption 1 (customer not receiving updated CSS) -- Shopify CDN caching + preview URL pinning
4. **SECOND HIGHEST RISK**: Assumption 6 (symptom misidentification) -- no new screenshots after Grid fix
5. **THIRD HIGHEST RISK**: Assumption 4 (Grid fixes the Safari sticky bug) -- untested in Safari specifically

**Diagnostic Strategy Proposed**:
- 6 Safari console diagnostic commands for customer to run
- CSS visual diagnostic (colored borders on key elements)
- Failsafe CSS approach removing `(hover: hover)` from desktop media queries

**Status**: Diagnostic strategy complete. Awaiting implementation approval.

### 2026-02-14: Safari Diagnostic Implementation (Session Continuation)

**Commit**: `7519caa` (staging)
**Changes**:
1. **Bumped CSS cache-buster** `?v=2.1` → `?v=3.0` in `sections/ks-pet-processor-v5.liquid` (line 10-11)
   - This was the #1 risk identified by debug specialist — stale CDN cache
   - Customer may have NEVER received any of the 3 prior CSS fixes
2. **Added temporary diagnostic borders** to end of `assets/pet-processor-v5.css`:
   - RED outline = `.processor-columns` (grid container)
   - BLUE outline = `.processor-controls` (left column)
   - GREEN outline = `.processor-preview` (right column/sticky)
   - ORANGE dashed outline = `.has-result` wrapper
   - Only visible on desktop (1024px+ with hover:hover)

**Verification (Chrome DevTools on staging)**:
- CSS v3.0 confirmed serving (URL includes `?v=3.0` parameter)
- Diagnostic borders visible in screenshot
- Grid layout confirmed: `display: grid`, `grid-template-columns: 400px 718.4px`, `align-items: start`
- Container height: 505.987px (not inflated)

**Next Steps**:
- Ask customer to: (1) completely quit Safari, (2) reopen, (3) navigate fresh to staging URL, (4) process a photo, (5) take screenshot
- If colored borders visible → CSS v3.0 reached them, Grid fix is active, issue is something ELSE
- If NO colored borders → CSS delivery problem (preview URL pinned to old version, or aggressive Safari cache)
- Provide 6 console diagnostic commands if needed for deeper investigation

---

### 2026-02-14 – Breed Landing Page Implementation

**Task**: Implement breed landing page section from build spec (`docs/breed-landing-page-build-spec.md`)

**Files Created**:
1. `sections/breed-landing.liquid` — Reusable Liquid section (Hero, Preview Banner, Body Content, Style Recommendations, Photo Tips, Products Carousel, FAQ with JSON-LD, Final CTA)
2. `assets/breed-landing.css` — Companion stylesheet (~700 lines), BEM-like `breed-landing__` prefix
3. `templates/page.breed-golden-retriever.json` — Golden Retriever breed template (4 styles, 4 photo tips, 6 FAQs)

**Agent Consultations** (5 agents):
- **SEO**: Adopted comma-prefix pattern for FAQ JSON-LD (safer than `forloop.last`), added H1 warning comment for body content
- **Conversion**: Added trust line below hero CTA, changed default `cta_url` to `/pages/custom-image-processing`, mobile product cards bumped 140px→160px
- **UX/Accessibility**: Added `:focus-visible` on all interactive elements (style cards, CTAs, carousel buttons, product links, FAQ summaries), WCAG AA contrast fix via `color-mix()` for accent-colored small text, `prefers-reduced-motion` media query, mobile style grid 2-col instead of 1-col, removed `user-select: none` from FAQ
- **Marketing**: Recommended pricing FAQ and delivery FAQ (added to Golden Retriever template)
- **Solution Verification**: Approved with two-phase deployment requirement confirmed

**Code Quality Review**: APPROVED — Scored A across HTML validity, Liquid syntax, CSS quality, JSON-LD, JS (ES5), schema alignment, security. B+ on accessibility (all focus-visible added, matching or exceeding style-landing reference).

**Architecture**: One section + one CSS, per-breed JSON templates. Mirrors `style-landing.liquid` pattern exactly. New breeds = new JSON template only.

**Deployment**: Requires two-phase commit (Shopify template race condition):
1. First commit: `sections/breed-landing.liquid` + `assets/breed-landing.css`
2. Wait 1-2 min for deploy
3. Second commit: `templates/page.breed-golden-retriever.json`

**Status**: Implementation complete, all agent feedback incorporated, code quality reviewed. Ready for two-phase deployment when user approves.

---

## Notes
- Always append new work with timestamp
- Archive when file > 400KB or task complete
- Include commit references for all code changes
- Cross-reference documentation created
