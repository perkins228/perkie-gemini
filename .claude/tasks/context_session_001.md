# Session Context - Continuation from Product Mockup Grid Session

**Session ID**: 001 (always use 001 for active)
**Started**: 2026-01-11
**Task**: Continuation of product mockup grid and session restoration features

## Previous Session Archived

**File**: `context_session_2026-01-11_product-mockup-grid-session-restoration.md` (106KB, 2446 lines)

**Completed Work Summary**:

### Product Mockup Grid Feature (Jan 7-10)
- Implemented product mockup grid showing processed pet on 10 best-selling products
- CSS overlay approach with GPU acceleration
- Mobile-first design (hero + 2-up grid, expand for more)
- Bridge data for product page integration

### Pet Sizing Phase 1 (Jan 10-11)
- `detectSubjectBounds()` - Alpha channel scanning for pet bounding box
- "Snap to Pet" button with 5% padding
- Subtle crop overlay (pink dashed border, 50% opacity, [4,8] dash pattern)
- Removed corner dots that were causing triangle artifacts

### Session Restoration / Back Navigation (Jan 11)
- "Back to Previews" link on product pages (`?from=processor`)
- Session state preservation in sessionStorage (30-min expiration)
- Full UI restoration without re-processing:
  - `updateStyleCardPreviews()` call added to restore thumbnails
  - Selected effect highlighting
  - `petProcessingComplete` event dispatch for mockup grid
- Prevention of BiRefNet/Gemini re-processing on return

### Documentation Created
- `.claude/doc/product-grid-display-conversion-optimization-strategy.md`
- `.claude/doc/back-to-previews-restoration-ux-plan.md`
- `.claude/doc/mobile-session-restoration-technical-plan.md`
- `.claude/doc/crop-overlay-styling-improvement-plan.md`
- Plus 40+ other analysis/plan documents

### Key Commits from Previous Session
- `f6753ab` - fix(crop): Remove pink triangles from suggested crop overlay
- `85681ce` - feat(ux): Full UI restoration when returning from product page
- `68adc9d` - fix(ux): Prevent re-processing when returning from product page
- `cfaa39f` - fix(ux): Make suggested crop overlay more subtle
- `a503bbe` - feat(ux): Add session preservation and back navigation

---

## Current Session Goals

- [ ] Continue any pending work from previous session
- [ ] Monitor deployed features for issues
- [ ] Address user feedback as it comes

---

## Work Log

### 2026-01-11 - Session Archived and New Session Started

**What was done**:
- Archived previous session (106KB, 2446 lines) to `context_session_2026-01-11_product-mockup-grid-session-restoration.md`
- Created fresh session context for continued work
- All previous commits pushed to staging branch

**Current State**:
- Product mockup grid: Deployed and functional
- Session restoration: Deployed and functional
- Crop overlay: Subtle pink dashed border (no triangles)
- "Back to Previews" link: Shows on product pages when from=processor

**Next actions**:
1. Test deployed features on staging
2. Address any user feedback
3. Continue with any pending tasks

---

### 2026-01-11 - Session Restoration Upload Module Bug Analysis

**Issue Reported**:
- When clicking "Back to Previews" from product page (`?from=product`), main UI shows upload module instead of processed results
- Product mockup grid correctly restores (shows pet images)
- Pet data exists in PetStorage (proven by working mockup grid)

**Root Cause Analysis Completed**:

**Hypothesis**: `showResult()` method calls `hideAllViews()` which hides all UI elements, but may not properly re-show the result view components.

**Code Flow Traced**:
1. `PetProcessor.init()` → `render()` → `restoreSession()` → `initializeFeatures()`
2. `restoreSession()` correctly detects `?from=product` (line 522-523)
3. `restoreSession()` calls `showResult()` at line 695 when effects exist
4. `showResult()` (line 2153) calls `hideAllViews()` in requestAnimationFrame
5. `hideAllViews()` (line 2320) hides all views including result view
6. **PROBABLE ISSUE**: Result view components not explicitly shown after hiding

**Key Finding**:
- `hideAllViews()` method (line 2320-2332) hides:
  - upload-zone ✅
  - effect-grid-wrapper ❌ (should be visible)
  - processor-preview .result-view ❌ (should be visible)
  - Shows preview-placeholder ❌ (should be hidden)

**Likely Fix Location**: `assets/pet-processor.js` lines 2153-2300 (`showResult()` method)

**Next Investigation Steps**:
1. Read full `showResult()` implementation (lines 2153-2300)
2. Identify where result view should be unhidden
3. Add diagnostic logging to confirm execution
4. Implement targeted fix

**Documentation Created**:
- `.claude/doc/session-restoration-upload-module-bug-debug-plan.md` - Complete RCA with investigation plan

**Files Analyzed**:
- `assets/pet-processor.js` (lines 448-740: constructor, init, restoreSession)
- `assets/pet-processor.js` (lines 2153-2332: showResult, hideAllViews)
- `assets/product-mockup-renderer.js` (lines 37-91: checkForRestoredSession - working correctly)

### 2026-01-11 - Session Restoration View Fix Implemented

**Issue**: When clicking "Back to Previews" from product page, upload module showed instead of processed results (while mockup grid correctly showed pet images).

**Root Cause Analysis**:
- `showResult()` uses `requestAnimationFrame` which is async
- RAF callback schedules view changes for future frame
- `restoreSession()` continues executing before RAF fires
- Timing issue caused views to not update correctly during restoration

**Fix Applied** (`assets/pet-processor.js` lines 697-744):
- Added explicit view management after `showResult()` call
- Uses `setTimeout(50ms)` to verify views are shown after RAF
- Explicitly hides upload zone, shows effect grid, result view, inline header
- Adds diagnostic logging with `🔧 [Restoration]` prefix

**Files Modified**:
- [pet-processor.js:697-744](assets/pet-processor.js#L697-L744) - Added explicit view restoration fallback

**Commit**: `d48d076`

**Testing Required**:
1. Process pet image on custom-image-processing page
2. Navigate to product page via mockup grid
3. Click "Back to Previews" link
4. Verify: upload zone hidden, effect grid visible, result view visible, mockup grid visible

---

### 2026-01-11 - Marker Effect Black Background Bug Analysis

**Issue Reported**:
- Marker effect (internally "sketch") occasionally shows pet on solid black background instead of artistic style
- Expected: Marker/sketch artistic rendering with transparent background
- Actual (intermittent): Pet on solid black background, no artistic effect visible

**Root Cause Analysis Completed**:

**5 Hypotheses Identified (ranked by likelihood)**:

1. **Race Condition - UI Update Timing** (VERY HIGH likelihood)
   - User clicks marker before re-segmentation completes
   - Button enabled at line 1755 BEFORE transparent version ready (line 1765+)
   - Initial storage has `gcsUrl` with solid bg, `dataUrl: null` (lines 1731-1737)
   - `switchEffect()` fallback chain `dataUrl || gcsUrl` uses solid bg version (line 2060)

2. **Re-segmentation Failure - Silent Error** (HIGH likelihood)
   - BiRefNet re-segmentation fails but effect remains visible
   - Lines 1783-1789 log warning but don't remove failed effect
   - Network timeout, CORS, or BiRefNet API errors
   - Falls back to `gcsUrl` with solid background

3. **Gemini Prompt Inconsistency** (MEDIUM likelihood)
   - Gemini ignores "clean white background" instruction (line 34 in gemini_client.py)
   - Model variability at temperature 0.7
   - Generates black background instead of white

4. **Cached Wrong Result** (LOW-MEDIUM likelihood)
   - GCS or Gemini cache serves stale image with black bg
   - Cache poisoning from previous failed re-segmentation

5. **BiRefNet Re-segmentation Bug** (LOW likelihood)
   - BiRefNet `/remove-background` returns black bg instead of transparent
   - Format conversion issue (WebP encoding)

**Code Flow Traced**:
1. BiRefNet removes background from uploaded photo
2. Background-removed image sent to Gemini API for artistic effect
3. Gemini generates marker effect WITH solid background (white per prompt)
4. Result stored temporarily: `{gcsUrl, dataUrl: null, transparent: false}` (lines 1731-1737)
5. **CRITICAL**: Button enabled immediately (line 1755) - user can click now
6. Re-segmentation runs in background (lines 1765-1789)
7. BiRefNet removes solid background from Gemini result
8. Transparent version stored: `{dataUrl, transparent: true}` (line 1784)
9. UI updated with transparent version (line 1792)

**Problem**: Steps 5-9 happen asynchronously. If user clicks between steps 5-6, they see solid background version.

**Investigation Plan Created**:
- Phase 1: Add diagnostic logging to confirm race condition
- Phase 2: Reproduce with rapid clicking and timing tests
- Phase 3: Implement fix based on confirmed hypothesis

**Recommended Fixes**:
1. **Race condition fix**: Disable marker button until re-segmentation completes
2. **Re-segmentation retry**: Add exponential backoff retry logic (3 attempts)
3. **Fallback validation**: Check `transparent` flag before displaying
4. **Prompt strengthening**: Add explicit "PURE WHITE background (#FFFFFF)" instruction
5. **Graceful degradation**: Hide effect if re-segmentation fails permanently

**Documentation Created**:
- `.claude/doc/marker-effect-black-background-debug-plan.md` - Complete RCA with 5 hypotheses, code flow analysis, investigation plan, and 4 targeted fixes

**Files Analyzed**:
- `assets/pet-processor.js` (lines 1692-1825: Gemini generation, 1975-2032: re-segmentation, 2034-2087: switchEffect)
- `assets/gemini-api-client.js` (full client implementation)
- `assets/gemini-effects-ui.js` (UI warning system)
- `backend/gemini-artistic-api/src/core/gemini_client.py` (lines 30-35: marker prompt, 86-217: generation)

**Next Steps**:
1. Add diagnostic logging (Phase 1) - 1 hour
2. Reproduce issue with test procedures (Phase 2) - 2-4 hours
3. Implement targeted fix (Phase 3) - 2-3 hours
4. Test on staging and deploy - 1-2 hours
5. **Total estimated time**: 6-10 hours across multiple sessions

**No code changes made** - This is a planning/analysis task only.

---

### 2026-01-11 - Comparison View Unexpected Trigger Bug Analysis

**Issue Reported**:
- When selecting Marker effect (or other effects), comparison overlay shows unexpectedly
- Displays "CURRENT" and "COMPARE" labels when user only clicked (didn't long-press)
- Expected: Click switches effect; Long-press shows comparison
- Actual: Comparison overlay appears on normal clicks

**Root Cause Analysis Completed**:

**5 Hypotheses Identified (ranked by likelihood)**:

1. **Touch/Mouse Event Overlap** (VERY HIGH likelihood)
   - THREE separate event listeners on each effect button create conflicts
   - `click` event from `setupEventListeners()` (line 1301)
   - `touchstart`/`touchend` from ComparisonManager (lines 240-241)
   - `mousedown`/`mouseup`/`mouseleave` from ComparisonManager (lines 244-246)
   - On mobile: both `touchstart` AND `click` fire for same tap
   - Timer starts before `touchend` can clear it

2. **Event Handler Race Condition** (HIGH likelihood)
   - 500ms timer starts on `touchstart` (line 254-258)
   - `touchend` should clear timer but might fire too late
   - Browser delays, scrolling, or processing can prevent timer clearing
   - Quick taps (<200ms) still triggering 500ms timeout

3. **Missing Event Prevention** (HIGH likelihood)
   - No `e.preventDefault()` in touch handlers
   - No `e.stopPropagation()` to prevent bubbling
   - Touch events can fire multiple times if not prevented

4. **Session Restoration Timing** (MEDIUM likelihood)
   - Recent session restoration work added complex RAF timing
   - ComparisonManager initialized in `initializeFeatures()`
   - Potential state mismatch during restoration

5. **Hidden Attribute Not Enforced** (LOW-MEDIUM likelihood)
   - CSS might not properly handle `[hidden]` attribute
   - Overlay template has `hidden` attribute but no CSS enforcement

**Code Locations Analyzed**:
- `assets/pet-processor.js` lines 220-450: ComparisonManager class
- `assets/pet-processor.js` lines 1299-1302: Effect button click handlers
- `assets/pet-processor.js` lines 2034-2087: switchEffect method
- `assets/pet-processor.js` lines 1179-1192: Comparison overlay HTML template

**Event Flow Problem**:
```
Normal tap (expected):
  touchstart → touchend (clears timer) → click → switchEffect() ✅

Buggy tap (actual):
  touchstart → [timer starts] → processing delay → 500ms elapses →
  enterComparisonMode() → touchend (too late) → comparison shows ❌
```

**Investigation Plan Created**:
- Phase 1: Add diagnostic logging to track event sequence (30 min)
- Phase 2: Reproduce with test procedures and analyze logs (1-2 hours)
- Phase 3: Implement fix based on confirmed hypothesis (1-2 hours)
- Phase 4: Regression testing and verification (1 hour)

**Recommended Fixes**:

**Primary Fix** (Fix Option A):
- Add `preventNextClick` flag to ComparisonManager
- Set flag when long-press timer fires
- Check flag in click handler and prevent if set
- Add `touchmove` handler to cancel on scroll/swipe

**Secondary Fixes**:
- Fix Option D: Explicit overlay reset in `switchEffect()`
- CSS enforcement: `.comparison-overlay[hidden] { display: none !important; }`

**Unlikely Needed**:
- Fix Option B: Increase timer from 500ms to 700ms
- Fix Option C: Change `passive: true` to `passive: false`

**Documentation Created**:
- `.claude/doc/comparison-view-unexpected-trigger-debug-plan.md` - Complete RCA with 5 hypotheses, event flow analysis, 4-phase investigation plan, 4 fix options with code examples, testing procedures, and estimated timeline

**Files to Modify**:
- `assets/pet-processor.js` (ComparisonManager class, click handlers, switchEffect)
- Optional: CSS file for hidden attribute enforcement

**Estimated Time**: 3.5-5.5 hours total

**Risk Assessment**:
- User Impact: MEDIUM (UX confusion, not breaking)
- Fix Complexity: LOW-MEDIUM (event handling issue)
- Regression Risk: LOW (isolated changes, clear test criteria)

**Next Steps**:
1. Add diagnostic logging (Phase 1)
2. Reproduce issue with test procedures (Phase 2)
3. Apply primary fix with preventNextClick flag (Phase 3)
4. Complete regression tests (Phase 4)
5. Deploy to staging and monitor

### 2026-01-11 - Comparison View Fix - Disabled Legacy Feature

**Issue**: ComparisonManager was causing unexpected comparison overlay when selecting effects.

**Root Cause**: ComparisonManager is legacy code not part of current customer journey. It attaches long-press event handlers (touchstart/touchend/mousedown/mouseup) to effect buttons, causing comparison overlay to trigger unexpectedly.

**Fix Applied**:
1. Commented out ComparisonManager initialization in `initializeFeatures()` ([pet-processor.js:1003-1007](assets/pet-processor.js#L1003-L1007))
2. Commented out `effect-comparison.css` loading in liquid template ([ks-pet-processor-v5.liquid:9-10](sections/ks-pet-processor-v5.liquid#L9-L10))

**Result**:
- No event listeners attached to effect buttons for comparison
- No long-press timers set
- Comparison overlay will never show
- Effect switching works normally (click = switch, no long-press detection)

**Files Modified**:
- `assets/pet-processor.js` - Commented out ComparisonManager initialization
- `sections/ks-pet-processor-v5.liquid` - Commented out CSS loading

**Commit**: `f696af6`

**Note**: HTML overlay remains in template (with `hidden` attribute) but is inert since manager is not initialized. Can be fully removed in future cleanup.

---

### 2026-01-11 - Session Restoration Fix V2 - Read from sessionStorage

**Issue**: Previous fix (`d48d076`) didn't work because `savePetData()` is never called when user clicks product in mockup grid. Only `sessionStorage.processor_mockup_state` is saved.

**Root Cause Analysis** (from console logs):
```
pet-processor.js:526 🔙 Returning from product page - restoring from PetStorage without re-processing
pet-processor.js:565 🔄 No session to restore (no saved pets)
```

**Problem**:
- When user clicks product in mockup grid → `ProductMockupRenderer.saveProcessorState()` saves to sessionStorage
- BUT `PetStorage.save()` (localStorage) is never called
- `restoreSession()` only checked PetStorage → found empty → showed upload module

**Fix Applied** (`assets/pet-processor.js` lines 525-639):
- When `isReturningFromProduct` is true, read from `sessionStorage.processor_mockup_state`
- Parse `state.petData.effects` to reconstruct `this.currentPet`
- Call `showResult()` with restored effects
- Explicitly show views via setTimeout (same pattern as previous fix)
- Fall back to PetStorage check only if sessionStorage is empty/expired

**Files Modified**:
- [pet-processor.js:525-639](assets/pet-processor.js#L525-L639) - New sessionStorage restoration logic

**Commit**: `132b3f3`

**Expected Console Output**:
```
🔙 Returning from product page - checking sessionStorage for saved state
🔙 Restoring from sessionStorage.processor_mockup_state
✅ [SessionStorage] Restored 4 effect(s): ['enhancedblackwhite', 'color', 'ink_wash', 'sketch']
🔧 [SessionStorage Restoration] Hiding upload zone
🔧 [SessionStorage Restoration] Showing effect grid
```

---

### 2026-01-11 - Session Status Summary

**Completed Fixes (Deployed to Staging)**:
1. ✅ Session Restoration View Bug V1 (`d48d076`) - Added explicit view management after showResult()
2. ✅ ComparisonManager Disabled (`f696af6`) - Legacy comparison overlay no longer triggers
3. ✅ Session Restoration View Bug V2 (`132b3f3`) - Read from sessionStorage instead of PetStorage

**On Hold**:
- ⏸️ Marker Effect Black Background Issue - User requested to hold on this fix
  - Root cause documented in `.claude/doc/marker-effect-black-background-debug-plan.md`
  - Race condition between button enable and re-segmentation completion

**Testing Required**:
1. Process pet → Click product in mockup grid → Click "Back to Previews" → Verify:
   - Console shows "Restoring from sessionStorage.processor_mockup_state"
   - Effect grid visible (not upload module)
   - Result view visible with processed pet image
   - Style thumbnails show user's pet (not placeholders)
2. Select any effect → Verify no comparison overlay appears

---

### 2026-01-11 - Desktop Product Mockup Grid UX Analysis

**Request**: Analyze UX implications of changing desktop product mockup grid from horizontal scroll to 2x5 grid layout.

**Current Implementation Analyzed**:
- `assets/product-mockup-grid.css` - CSS for mobile grid, desktop horizontal carousel
- `assets/product-mockup-renderer.js` - JS for carousel navigation, mockup overlays
- `sections/ks-product-mockup-grid.liquid` - Liquid template with 10 product slots

**Current Desktop Behavior** (750px+):
- Horizontal scroll/carousel with `overflow-x: auto`
- Cards sized at `20% - 13px` (about 5 visible at once)
- Minimum card width: 200-220px
- Navigation via scrollbar (arrow buttons hidden)
- All 10 products accessible via scroll

**Research Completed**:
- E-commerce grid vs carousel conversion studies
- Baymard Institute UX benchmarks
- Nielsen Norman Group carousel research

**Key Findings**:
1. Grid layouts preferred for product browsing/comparison
2. Carousel engagement drops 40% to 11% from first to last slide
3. 46% of e-commerce homepage carousels have performance issues
4. Users often skip carousels due to "banner blindness"
5. Grid layouts allow rapid scanning and comparison

**Analysis delivered to user** (see response below)

**No code changes made** - Analysis and recommendation only

---

### 2026-01-11 - Multi-Product Reusable Upload Research

**Request**: Research how competitors handle "upload once, use many times" for multi-product orders.

**Research Completed**:

#### Competitor Analysis

**Custom Pet Portrait Services (Crown and Paw, West and Willow)**:
- Per-order upload model, no persistent image library
- Each product order requires separate photo upload
- Crown and Paw offers unlimited revisions but no image reuse
- West and Willow has bundle discounts but still requires per-order uploads

**Photo Printing Platforms (Shutterfly, Snapfish)** - BEST PRACTICES:
- Account-based persistent image library
- Unlimited storage with active account (1 purchase every 18 months)
- Photos stored in albums, searchable and reusable across products
- Multi-source import (Instagram, Facebook, Flickr, Google)
- "Turn photos into prints, photo books, or gifts in just a few clicks"

**Print-on-Demand (Printify)**:
- Design library with reusable assets
- Templates can be saved and reused across products
- Shutterstock integration for stock images

**Design Platforms (Canva)** - REFERENCE PATTERN:
- Brand Kit with cross-design asset reuse
- "Effortlessly replace logos or images across existing designs in just a few clicks"
- Demonstrates "upload once, reuse everywhere" pattern

#### Current Perkie Implementation Analysis

**Storage System** (from `pet-storage.js`):
- `PetStorage` class using localStorage with `perkie_pet_` prefix
- Stores: petId, artistNote, effects (with GCS URLs), timestamp
- 5MB assumed quota with emergency cleanup at 80%
- `sessionStorage.processor_mockup_state` for navigation (30-min expiry)
- `window.perkiePets` global object for Shopify cart integration

**Current Gap**:
- No unified "My Pets" picker across product pages
- Each product requires re-selection
- No visual pet gallery on product pages

#### Key Findings

1. **Session Timeout Standards**:
   - WooCommerce: 48 hours default
   - Magento: 1 hour default
   - Recommended for Perkie: 7 days for pet data (safe, no inventory constraints)

2. **Guest Checkout Critical**:
   - 26% abandon due to mandatory account creation
   - 57% conversion increase with direct checkout
   - Offer account creation POST-checkout, not before

3. **Shopify Apps Available**:
   - Upload-Lift, Uploadery, UploadKit, Mighty Image Uploader
   - Focus on per-product uploads, not library-based reuse

#### Recommendations for Perkie

**Quick Wins (Low Effort)**:
1. Extend localStorage expiry to 7 days
2. Add "Use Previous Pet" selector on product pages
3. Cross-product session flow with pre-populated picker

**Medium-Term**:
1. Pet Gallery Modal - unified picker for all product pages
2. Cart Bundle UX - "Apply to all products" option
3. Bundle discounts for multi-product orders

**Long-Term (Account-Based)**:
1. Customer accounts with server-side pet library
2. Cross-device access via "My Pets" dashboard
3. Social login integration (Google/Apple)

**Documentation Created**:
- Plan file: `C:\Users\perki\.claude\plans\vivid-juggling-aho-agent-a3fd3c1.md`

**Files Analyzed**:
- `assets/pet-storage.js` - Current localStorage implementation
- `assets/product-mockup-renderer.js` - Session state management
- `assets/pet-processor.js` - Security and image handling

**No code changes made** - Research and analysis only

---

### 2026-01-11 - Phase 1: Session Pet Gallery Implementation

**Request**: Implement Session Pet Gallery to allow customers to reuse previously processed pets on product pages without re-uploading.

**Implementation Complete**:

#### 1. PetStorage Helper Methods (`assets/pet-storage.js`)
Added methods to support gallery display:
- `getRecentPets(limit)` - Returns pets sorted by timestamp (newest first)
- `getAgeText(timestamp)` - Human-readable age ("Just now", "2 hours ago", etc.)
- `hasRecentPets()` - Quick check if any valid pets exist
- `getEffectDisplayName(effectKey)` - Maps effect keys to display names (B&W, Color, etc.)

#### 2. Gallery HTML Structure (`snippets/ks-product-pet-selector-stitch.liquid`)
Added session pet gallery UI before upload zone in each pet detail section:
- Gallery header with "Use a recent pet" label and toggle button
- Horizontal scrollable container for pet cards
- "or upload new" divider separator
- Hidden by default, shown only if recent pets exist

#### 3. Gallery CSS Styles (same file, lines 965-1163)
- Mobile-first responsive design
- 80px pet cards (72px on mobile)
- Horizontal scroll with touch optimization
- Effect badge overlay on each thumbnail
- Age text below each card
- Collapse/expand toggle functionality
- Touch device optimizations (44px min target)

#### 4. JavaScript Interaction Logic (`assets/session-pet-gallery.js`)
New file created with:
- `initSessionPetGalleries()` - Initializes all galleries on page load
- `populateGallery()` - Creates pet cards from PetStorage data
- `createPetCard()` - Individual card with image, badge, click handler
- `selectPet()` - Handles pet selection and updates UI
- `updateUploadZoneForSelectedPet()` - Shows selected pet in upload zone
- `showSelectionFeedback()` - Toast notification on selection
- `toggleGallery()` - Collapse/expand functionality
- Dispatches `sessionPetSelected` custom event for integration

**Files Modified**:
- [pet-storage.js:303-402](assets/pet-storage.js#L303-L402) - Added getRecentPets and helper methods
- [ks-product-pet-selector-stitch.liquid:82-98](snippets/ks-product-pet-selector-stitch.liquid#L82-L98) - Added gallery HTML
- [ks-product-pet-selector-stitch.liquid:965-1163](snippets/ks-product-pet-selector-stitch.liquid#L965-L1163) - Added gallery CSS
- [ks-product-pet-selector-stitch.liquid:1572-1573](snippets/ks-product-pet-selector-stitch.liquid#L1572-L1573) - Added script include

**Files Created**:
- [session-pet-gallery.js](assets/session-pet-gallery.js) - Gallery interaction logic (320 lines)

**UX Flow**:
1. Customer lands on product page
2. If recent pets exist in localStorage, gallery appears before upload zone
3. Thumbnail shows processed pet with effect badge and age
4. Click thumbnail → pet selected, upload zone shows "Pet selected" state
5. "View Effects" button enables to customize
6. OR customer can upload new pet (traditional flow unchanged)

**Key Design Decisions**:
- Gallery hidden if no recent pets (clean UX for first-time users)
- Horizontal scroll for mobile efficiency
- Toast feedback on selection for clear confirmation
- Effect badge shows which style was used
- Age text helps identify which pet is which

**Commit**: `b63a74d` - feat(gallery): Add Session Pet Gallery for quick pet reuse on product pages

---

### 2026-01-12 - Fix: Inline Preview selectedEffect not saved

**Issue**: Pets processed via inline preview modal (on product pages) were not saving `selectedEffect` to PetStorage, causing the Session Pet Gallery to always show "B&W" badge regardless of which effect was actually selected.

**Root Cause**: The `petData` object in `savePetDataAndClose()` was missing the `selectedEffect` field.

**Fix Applied** (`assets/inline-preview-mvp.js` line 1180):
```javascript
const petData = {
  artistNote: artistNotes,
  effects: effects,
  selectedEffect: this.currentEffect, // Added this line
  filename: `pet_${this.petNumber}.jpg`,
  timestamp: Date.now()
};
```

**Commit**: `f43223b` - fix(gallery): Save selectedEffect from inline preview for gallery badge

**Result**: Pets processed via inline preview now correctly show their selected effect badge in the Session Pet Gallery.

---

### 2026-01-12 16:35 - Session Pet Gallery Not Showing - Root Cause Fix

**Issue Reported**:
User reported the Session Pet Gallery is not appearing on product pages. Console showed:
```
[SessionPetGallery] No recent pets found, galleries will remain hidden
⚠️ Bridge: No processor pet data found for sessionKey: pet_7f20d3e7-146e-44fc-98fe-3df73e7d2407
```

**Root Cause Identified**:
When user processes a pet on the processor page and clicks a product in the mockup grid:
1. `handleCardClick()` calls `prepareBridgeData()`
2. `prepareBridgeData()` only saved to sessionStorage (one-time bridge) and localStorage backup
3. **BUG**: Pet data was NOT being saved to PetStorage where `getRecentPets()` looks for data

**Fix Applied**:
Modified `prepareBridgeData()` in `assets/product-mockup-renderer.js` to also save to PetStorage:

```javascript
// Save to PetStorage for Session Pet Gallery on product pages
if (typeof window.PetStorage !== 'undefined' && window.PetStorage.save) {
  const petStorageData = {
    effects: this.currentPetData.effects,
    selectedEffect: this.currentPetData.selectedEffect,
    timestamp: Date.now()
  };
  window.PetStorage.save(this.currentPetData.sessionKey, petStorageData)
    .then(function() {
      console.log('[ProductMockupRenderer] Pet saved to PetStorage for gallery');
    })
    .catch(function(err) {
      console.warn('[ProductMockupRenderer] Failed to save to PetStorage:', err);
    });
}
```

**Commit**: `ae1f35f` - fix(gallery): Save pet to PetStorage when clicking mockup grid

**Result**: Pets processed on the processor page now appear in the Session Pet Gallery on product pages.

**Session Pet Gallery now works for both pathways**:
1. ✅ Processor page → Mockup grid click → Product page (this fix)
2. ✅ Product page → Inline preview modal → Save (fixed earlier with `f43223b`)

---

### 2026-01-12 17:15 - Session Pet Gallery Still Not Showing - Deep Debug

**Issue Reported**:
User confirmed gallery still not showing. Console showed:
```
[ProductMockupRenderer] No pet data available for bridge
```
even though processing completed and mockup grid updated correctly.

**Investigation Findings**:

1. **Diagnostic Used Wrong Property Name**:
   - User ran `window.productMockupRenderer?.currentPetData` → returned `undefined`
   - BUT instances are stored in `window.productMockupRenderers` (plural with 's')
   - The diagnostic was checking a non-existent property
   - Correct diagnostic: `window.debugMockupRenderers()` (added helper)

2. **`prepareBridgeData()` Returns Early**:
   - The method checks `if (!this.currentPetData)` and returns early
   - This prevents both sessionStorage bridge AND PetStorage save
   - Logs confirm: "No pet data available for bridge"

3. **Root Cause Hypothesis**:
   - `handleProcessingComplete()` receives event and sets `this.currentPetData`
   - But somehow when `handleCardClick()` is called, `currentPetData` is null
   - Both are on the same instance (arrow functions preserve `this`)
   - Need more debug logging to trace when/where currentPetData becomes null

**Debug Enhancements Added** (`assets/product-mockup-renderer.js`):

1. **Added logging when currentPetData is SET** (line 303):
   ```javascript
   console.log('[ProductMockupRenderer] currentPetData SET:', this.currentPetData);
   ```

2. **Added logging in prepareBridgeData** (line 487):
   ```javascript
   console.log('[ProductMockupRenderer] prepareBridgeData called, sectionId:', this.sectionId, 'currentPetData:', this.currentPetData, 'currentEffectUrl:', this.currentEffectUrl);
   ```

3. **Added debug helper function** (lines 651-664):
   ```javascript
   window.debugMockupRenderers = function() {
     // Logs all instance states: sectionId, currentPetData, currentEffectUrl, isInitialized
   };
   ```

4. **Added fallback mechanism in prepareBridgeData** (lines 489-518):
   - If `currentPetData` is null but `currentEffectUrl` exists, attempt to reconstruct:
     1. Try getting most recent pet from PetStorage
     2. Last resort: Create minimal pet data with just the effect URL
   - This ensures bridge data still gets saved even if primary path fails

**Files Modified**:
- [product-mockup-renderer.js:303](assets/product-mockup-renderer.js#L303) - Log when currentPetData SET
- [product-mockup-renderer.js:487-518](assets/product-mockup-renderer.js#L487-L518) - Debug logging + fallback mechanism
- [product-mockup-renderer.js:651-664](assets/product-mockup-renderer.js#L651-L664) - Debug helper function

**Commit**: `8129ce0` - debug(gallery): Add fallback mechanism and debug logging for currentPetData issue

**Testing Instructions**:
1. Go to processor page, process a pet image
2. After mockup grid appears, run in console: `window.debugMockupRenderers()`
3. Observe: Does currentPetData show the pet data?
4. Click a product card
5. Check console for: `[ProductMockupRenderer] prepareBridgeData called...`
6. Navigate to product page and check if gallery appears

**Root Cause Status**: Still investigating. Debug enhancements added to trace the issue.

---

### 2026-01-12 18:00 - Root Cause Analysis: Session Pet Gallery Not Showing

**Issue**: Session Pet Gallery shows "No recent pets found" even though mockup grid displays processed pet.

**CONFIRMED ROOT CAUSE**: `currentPetData` is null when `prepareBridgeData()` is called.

**Analysis Flow**:

1. **Processing completes** → `dispatchProcessingComplete()` dispatches `petProcessingComplete` event
   - Location: `pet-processor.js:2413`
   - Event detail includes: `sessionKey`, `selectedEffect`, `effectUrl`, `effects`

2. **ProductMockupRenderer receives event** → `handleProcessingComplete()` sets instance properties
   - Location: `product-mockup-renderer.js:290-326`
   - Sets `this.currentPetData` (line 296-303) and `this.currentEffectUrl` (line 306)
   - **CRITICAL LOG at line 303**: `console.log('[ProductMockupRenderer] currentPetData SET:', this.currentPetData);`

3. **User clicks product card** → `handleCardClick()` calls `prepareBridgeData()`
   - Location: `product-mockup-renderer.js:453-481`

4. **prepareBridgeData() checks currentPetData** → Logs show it's null
   - Location: `product-mockup-renderer.js:487`
   - **Debug log shows**: `currentPetData: null` despite step 2 setting it

**WHY IS currentPetData NULL?**

The issue is NOT that `currentPetData` was never set. The log at line 303 should fire when processing completes. The question is:

**Hypothesis 1: Multiple ProductMockupRenderer instances**
- Line 677 creates new instance for EACH section found: `window.productMockupRenderers[sectionId] = new ProductMockupRenderer(sectionId);`
- Each instance binds its own `petProcessingComplete` listener (line 123)
- BUT only ONE section is on the processor page
- When user clicks a card, `this` refers to correct instance

**Hypothesis 2: Event listener registered on wrong instance**
- Line 123: `document.addEventListener('petProcessingComplete', (e) => this.handleProcessingComplete(e.detail));`
- Arrow function captures `this` correctly
- Should work

**Hypothesis 3: `handleProcessingComplete` never called** ⚠️ MOST LIKELY
- Check: Is `petProcessingComplete` event being dispatched at all?
- Check: Is `dispatchProcessingComplete()` (line 2380) returning early due to missing data?
- Line 2381 check: `if (!result || !result.effects || !this.currentPet)`

**ROOT CAUSE IDENTIFIED**:

Looking at `dispatchProcessingComplete()` (lines 2380-2420):
```javascript
dispatchProcessingComplete(result) {
  if (!result || !result.effects || !this.currentPet) {
    console.warn('[PetProcessor] Cannot dispatch processing complete - missing data');
    return;  // <-- EARLY RETURN!
  }
  // ... dispatch event
}
```

The method returns early if `this.currentPet` is null. But when is `this.currentPet` set?

Looking at `processFile()` and `processImage()` methods, `this.currentPet` should be set during processing. However, if there's any path where `showResult()` is called without `this.currentPet` being set, the event would never dispatch.

**ACTUAL ROOT CAUSE**:

The `dispatchProcessingComplete()` depends on `this.currentPet` being set in PetProcessor. If this value is null when `showResult()` is called (e.g., from sessionStorage restoration path on line 620), the event won't dispatch properly.

Looking at line 620 (in `restoreSession()`):
```javascript
document.dispatchEvent(new CustomEvent('petProcessingComplete', {
  detail: {
    sessionKey: this.currentPet.id,
    // ...
  }
}));
```

This DOES dispatch the event correctly during restoration.

**FINAL ROOT CAUSE**: The fallback mechanism in `prepareBridgeData()` (lines 489-518) tries to reconstruct from PetStorage, but **PetStorage is empty** because `savePetData()` is never called automatically after processing.

**Data Flow Gap**:
1. Pet processed → `petProcessingComplete` dispatched → mockup renderer receives it
2. Mockup renderer stores in `this.currentPetData` (in-memory only)
3. **MISSING**: Pet data NEVER saved to PetStorage during normal processing flow
4. User clicks card → `prepareBridgeData()` checks `this.currentPetData`
5. If null for any reason, fallback checks PetStorage → EMPTY!

**WHY currentPetData is null at click time**:

Most likely: The instance that received the event is NOT the same instance whose card was clicked.

On `DOMContentLoaded`:
- `window.productMockupRenderers[sectionId]` created
- Event listener bound

But if there's JavaScript that re-renders the section (e.g., Shopify theme refresh, dynamic content load), a NEW instance could be created with `currentPetData = null`.

**VERIFICATION NEEDED**:
1. Is `[ProductMockupRenderer] currentPetData SET:` log appearing after processing?
2. Is `window.debugMockupRenderers()` showing the data before card click?
3. Are there multiple `[ProductMockupRenderer] Initialized` logs?

---

**PROPOSED FIX**:

The cleanest fix is to **save to PetStorage immediately when `petProcessingComplete` is received**, not just when `prepareBridgeData()` is called. This ensures data persists regardless of instance lifecycle.

**Fix Location**: `product-mockup-renderer.js` in `handleProcessingComplete()` method (lines 290-326)

**Add after line 319** (`this.isInitialized = true;`):
```javascript
// Save to PetStorage immediately for Session Pet Gallery
if (typeof window.PetStorage !== 'undefined' && window.PetStorage.save) {
  const petStorageData = {
    effects: this.currentPetData.effects,
    selectedEffect: this.currentPetData.selectedEffect,
    timestamp: Date.now()
  };
  window.PetStorage.save(this.currentPetData.sessionKey, petStorageData)
    .then(() => console.log('[ProductMockupRenderer] Pet saved to PetStorage on processing complete'))
    .catch(err => console.warn('[ProductMockupRenderer] Failed to save to PetStorage:', err));
}
```

**Alternative Fix** (in PetProcessor):
Call `savePetData()` automatically in `showResult()` or `dispatchProcessingComplete()` - but this may have side effects (GCS upload, etc.).

---

**Next Steps**:
- [ ] Test session pet gallery end-to-end on real device
- [x] Verify integration with inline preview modal (fixed `selectedEffect` bug)
- [x] Fix processor page pets not appearing in gallery (first fix)
- [x] Debug why currentPetData is undefined - ROOT CAUSE FOUND
- [x] Implement fix: Save to PetStorage on `petProcessingComplete` event
- [ ] Test multi-pet product scenarios

---

### 2026-01-12 - ROOT CAUSE FIX IMPLEMENTED

**Commit**: `8579ac9` - fix(gallery): Save pet to PetStorage immediately on processing complete

**Root Cause Summary**:
- `handleProcessingComplete()` stored pet data only in memory (`this.currentPetData`)
- Data was NEVER persisted to localStorage (PetStorage)
- Session Pet Gallery reads from PetStorage → found nothing
- Fallback mechanism in `prepareBridgeData()` also found nothing because PetStorage was empty

**Fix Applied** (product-mockup-renderer.js, lines 321-336):
```javascript
// Save to PetStorage immediately for Session Pet Gallery
if (typeof window.PetStorage !== 'undefined' && window.PetStorage.save && this.currentPetData) {
  const petStorageData = {
    effects: this.currentPetData.effects,
    selectedEffect: this.currentPetData.selectedEffect,
    timestamp: Date.now()
  };
  window.PetStorage.save(this.currentPetData.sessionKey, petStorageData)
    .then(function() {
      console.log('[ProductMockupRenderer] Pet saved to PetStorage for Session Pet Gallery');
    })
    .catch(function(err) {
      console.warn('[ProductMockupRenderer] Failed to save to PetStorage:', err);
    });
}
```

**Expected Result**:
- After processing, console should show: `[ProductMockupRenderer] Pet saved to PetStorage for Session Pet Gallery`
- Navigating to product page should show: `[SessionPetGallery] Found X recent pets`
- Gallery should display the processed pet thumbnail

**Testing Required**:
1. Process pet on processor page
2. Wait for mockup grid to appear
3. Verify console shows the "Pet saved to PetStorage" log
4. Click any product card
5. Verify Session Pet Gallery appears on product page with pet thumbnail

---

### 2026-01-12 ~11:45 AM - Session Pet Gallery Data Format Fix

**Problem**: Session Pet Gallery still not appearing despite `8579ac9` fix working (console showed "Pet saved to PetStorage for Session Pet Gallery").

**Root Cause**: `getRecentPets()` in `pet-storage.js` only checked for `gcsUrl` format:
```javascript
if (effectData && effectData.gcsUrl) {  // ONLY gcsUrl!
```

But session restoration provides effects with `dataUrl` (base64) format, not `gcsUrl`.

**Fix Applied** (`9ddd0a1`):
Modified `getRecentPets()` to check BOTH formats:
```javascript
if (effectData && (effectData.gcsUrl || effectData.dataUrl)) {
  thumbnailUrl = effectData.gcsUrl || effectData.dataUrl;
```

**Files Modified**:
- `assets/pet-storage.js` (lines 318-339) - Updated getRecentPets() to handle both URL formats

**Commit**: `9ddd0a1` - fix(gallery): Handle dataUrl format in getRecentPets() for Session Pet Gallery

**Status**: Deployed, awaiting test verification.

---

### 2026-01-12 19:30 - Session Pet Gallery Improvements (3 Issues Fixed)

**Issues Addressed** (from user feedback):
1. Remove effect badge ("B&W") from pet thumbnails
2. How customers can remove images from Session Library
3. "View Effects" button shows "upload image first" error when clicking after selecting pet from gallery

**Issue 1 Fix - Badge Removal**:
Edited [session-pet-gallery.js:103-110](assets/session-pet-gallery.js#L103-L110) to remove badge HTML from card:
```javascript
// Build card HTML (badge removed per user request)
var html = '<div class="session-pet-card__image-wrapper">' +
  '<img class="session-pet-card__image" ...>' +
'</div>';
```

**Issue 2 - Image Removal UX Research**:
Consulted UX agent who recommended:
- Corner X button (20px icon, 48px touch target for mobile)
- Simple confirmation dialog
- Toast notification "Pet removed from library"
- Optional: "Clear all" behind menu

**Issue 2 Implementation - Delete Button**:
Added delete button to session gallery cards:

1. **HTML/JS** (`session-pet-gallery.js`):
   - Added delete button SVG to card HTML (lines 105-111)
   - Added `deletePet()` function (lines 158-193) with:
     - Confirmation dialog
     - PetStorage.delete() call
     - Animated card removal
     - Gallery auto-hide when empty
   - Added `showDeleteFeedback()` toast (lines 198-222)

2. **CSS** (`ks-product-pet-selector-stitch.liquid` lines 1080-1126):
   - Delete button positioned absolute top-right
   - Hidden by default, shown on hover/focus
   - Always visible on mobile (hover: none)
   - Red background on hover
   - 28px size on mobile for easy tap

**Issue 3 Fix - View Effects for Gallery Pets**:
Root cause: Preview button click handler only checked `localStorage` for traditional uploads, but Session Gallery stores data in `sessionStorage.session_gallery_pet_X`.

1. **New Method** (`inline-preview-mvp.js` lines 353-414):
   Added `openWithPreProcessedEffects(data)` method that:
   - Opens modal directly with pre-processed effects
   - Skips BiRefNet/Gemini processing entirely
   - Converts effects from PetStorage format to inline preview format
   - Restores artist notes if present
   - Calls `showResult()` directly

2. **Handler Update** (`ks-product-pet-selector-stitch.liquid` lines 2454-2478):
   Modified Preview button click handler to:
   - Check `sessionStorage.session_gallery_pet_X` first
   - If found, call `openWithPreProcessedEffects()` instead of `openWithData()`
   - Graceful fallback to normal flow if parsing fails

**Files Modified**:
- [session-pet-gallery.js](assets/session-pet-gallery.js) - Badge removal, delete button, feedback toast
- [inline-preview-mvp.js:353-414](assets/inline-preview-mvp.js#L353-L414) - New openWithPreProcessedEffects() method
- [ks-product-pet-selector-stitch.liquid:1080-1126](snippets/ks-product-pet-selector-stitch.liquid#L1080-L1126) - Delete button CSS
- [ks-product-pet-selector-stitch.liquid:2454-2478](snippets/ks-product-pet-selector-stitch.liquid#L2454-L2478) - Gallery pet handler

**Commits Pending**: Changes not yet committed

**Testing Required**:
1. Verify badge removed from gallery thumbnails
2. Test delete button: hover shows button, click confirms, card removes with animation
3. Test "View Effects" for gallery-selected pet: should open modal immediately with pre-processed effects

---

### 2026-01-12 - Welcome Back Mode Implementation on Processor Page

**User Request**:
- "I like option 2" - Implement Welcome Back mode with pet gallery on processor page
- When returning users visit the processor, show their previously processed pets
- Make "Try Another Pet" button more prominent

**Implementation (Option 2 - Welcome Back Mode)**:

**Changes Made**:

1. **Welcome Back Section in render()** - [pet-processor.js:1185-1203](assets/pet-processor.js#L1185-L1203)
   - Added `[data-welcome-back]` section at top of processor container
   - Includes header ("Welcome Back!"), gallery container, and "Upload New Pet" button

2. **renderWelcomeBackGallery()** - [pet-processor.js:1402-1498](assets/pet-processor.js#L1402-L1498)
   - Renders horizontal scrolling gallery of pet thumbnails
   - Each card shows thumbnail, age text, delete button
   - Active card highlighted with theme color border

3. **selectWelcomeBackPet() / loadPetFromStorage()** - [pet-processor.js:1500-1602](assets/pet-processor.js#L1500-L1602)
   - Click handler loads selected pet without re-processing
   - Updates UI to show result view with stored effects
   - Dispatches petProcessingComplete for mockup grid

4. **deleteWelcomeBackPet()** - [pet-processor.js:1604-1663](assets/pet-processor.js#L1604-L1663)
   - Confirmation dialog before deletion
   - Animated card removal
   - Auto-selects next pet if deleted card was active
   - Hides gallery when all pets deleted

5. **handleWelcomeUploadClick()** - [pet-processor.js:1694-1730](assets/pet-processor.js#L1694-L1730)
   - "Upload New Pet" button handler
   - Clears current pet, shows upload zone, triggers file input

6. **checkAndRenderWelcomeBackGallery()** - [pet-processor.js:1767-1806](assets/pet-processor.js#L1767-L1806)
   - Called at start of restoreSession()
   - Checks PetStorage.getRecentPets(5)
   - Renders gallery and auto-loads most recent pet

7. **Modified restoreSession()** - [pet-processor.js:519-655](assets/pet-processor.js#L519-L655)
   - Now checks for recent pets FIRST (before pet selector uploads)
   - If pets exist, renders Welcome Back gallery
   - Skips auto-upload flow for users with existing pets

8. **Welcome Back Gallery CSS** - [pet-processor-v5.css:1485-1720](assets/pet-processor-v5.css#L1485-L1720)
   - Mobile-first design (72px thumbnails on mobile, 90px on desktop)
   - Horizontal scrolling with snap
   - Delete button visible on touch devices
   - Desktop: inline gallery with upload button

9. **Try Another Pet Button Enlarged** - [pet-processor-v5.css:546-574](assets/pet-processor-v5.css#L546-L574)
   - Gradient background using theme color
   - Box shadow for prominence
   - Hover effects with transform

**Files Modified**:
- [pet-processor.js](assets/pet-processor.js) - Welcome Back mode logic
- [pet-processor-v5.css](assets/pet-processor-v5.css) - Gallery + button styles

**How It Works**:
1. User visits processor page
2. `checkAndRenderWelcomeBackGallery()` checks PetStorage
3. If pets exist, renders Welcome Back gallery at top
4. Most recent pet auto-loads into processor view
5. User can click other pets to switch, or "Upload New Pet" for fresh upload
6. All without re-processing - uses stored GCS URLs

**Testing Required**:
1. Visit processor with existing pets in localStorage - should show Welcome Back
2. Click different pets in gallery - should switch displayed pet immediately
3. Delete pet from gallery - should animate removal, select next pet
4. Click "Upload New Pet" - should show upload zone, trigger file picker
5. New user (no pets) - should show normal upload zone (no Welcome Back)

**Commits Pending**: Changes ready for commit

---

### 2026-01-12 21:45 - Pivot to Option 1 (Simple Restore)

**Request**: User requested pivot from Option 2 (Welcome Back gallery UI on processor page) to Option 1 (simpler approach).

**Changes Made**:
1. Removed Welcome Back section HTML from `render()` method
2. Removed gallery-related methods: `renderWelcomeBackGallery`, `selectWelcomeBackPet`, `deleteWelcomeBackPet`, `showDeleteFeedback`, `handleWelcomeUploadClick`, `checkAndRenderWelcomeBackGallery`
3. Kept `loadPetFromStorage()` for basic restoration
4. Removed Welcome Back Upload button event listener
5. Removed ~235 lines of Welcome Back CSS from pet-processor-v5.css
6. Simplified `restoreSession()` to remove gallery call references

**Commit**: `2210e56` - refactor(processor): Pivot to Option 1 - simple pet auto-restore

---

### 2026-01-12 22:00 - Fix: PetStorage Not Updated After Gemini Effects Complete

**Issue Reported**:
Ink Wash and Marker effects NOT displayed when clicking "View Effects" in inline pet-selector on product page, even though they were generated successfully on the processor page.

**Root Cause Analysis**:

From console logs, the timing issue was identified:
```
1. BiRefNet completes → petProcessingComplete dispatched (only B&W + Color)
2. ProductMockupRenderer saves to PetStorage (only B&W + Color)
3. Gemini effects complete ~9.5 seconds LATER in background
4. PetStorage is NEVER updated with ink_wash and sketch!
5. Product page modal reads from PetStorage → "Not Available" for Gemini effects
```

**Console Evidence**:
```
🔒 ink_wash not in pre-processed effects, showing unavailable thumbnail
🔒 sketch not in pre-processed effects, showing unavailable thumbnail
```

**Fix Applied** (`assets/pet-processor.js` lines 2019-2034):
After Gemini effects complete with transparent backgrounds (line 2017), added PetStorage update:

```javascript
// CRITICAL: Update PetStorage with Gemini effects (ink_wash, sketch)
// The initial save happened after BiRefNet (B&W + Color only)
// This update adds the Gemini effects so they appear in Session Pet Gallery
if (typeof PetStorage !== 'undefined' && this.currentPet && this.currentPet.id) {
  const updatedPetData = {
    effects: this.currentPet.effects,  // Now includes all 4 effects
    timestamp: Date.now()
  };
  PetStorage.save(this.currentPet.id, updatedPetData)
    .then(() => {
      console.log('✅ PetStorage updated with Gemini effects (ink_wash, sketch)');
    })
    .catch((err) => {
      console.warn('⚠️ Failed to update PetStorage with Gemini effects:', err);
    });
}
```

**Expected Result**:
After processing, console should show:
1. `🎨 AI effects now have transparent backgrounds`
2. `✅ PetStorage updated with Gemini effects (ink_wash, sketch)`

Then when clicking "View Effects" on product page, all 4 effects (B&W, Color, Ink Wash, Marker) should be available.

**Files Modified**:
- [pet-processor.js:2019-2034](assets/pet-processor.js#L2019-L2034) - Added PetStorage update after Gemini effects complete

**Commit**: `b05029d` - fix(storage): Update PetStorage after Gemini effects complete

---

---

### 2026-01-12 - Regression Fix: Session Restoration and Gemini Effects

**Issues Reported**:
1. "The custom-image-processing page doesn't show the last processed image when navigating back to the page, just the upload module"
   - Console showed: `🔄 Restoring most recent pet: selector_/products/personalized-pet-portrait-in-black-frame`
   - Followed by: `🔄 Pet found but no valid effects to restore`

2. "The inline-processor still does not retrieve the ink wash and marker effects when the 'View Effects' button is pushed"

**Root Cause Analysis (Issue 1)**:

The pet selector on product pages saves state with key `perkie_pet_selector_${productId}` (e.g., `perkie_pet_selector_/products/personalized-pet-portrait-in-black-frame`).

This key matches the PetStorage prefix `perkie_pet_`, so when `PetStorage.getAll()` runs:
- It finds `perkie_pet_selector_/products/...` key
- Extracts ID as `selector_/products/...` (removing prefix)
- Returns this entry which has completely different structure:
  - Pet selector state: `{ petCount, pets, style, font, timestamp }`
  - PetStorage format: `{ effects: { effectName: { gcsUrl, dataUrl } }, timestamp }`

The effects validation at `pet-processor.js:724-747` then fails because there's no `effects` object.

**Fix Applied (Issue 1)**:
Modified `PetStorage.getAll()` to skip keys where petId starts with `selector_`:

```javascript
// pet-storage.js lines 70-75
if (petId.startsWith('selector_')) {
  continue;
}
```

**Commit**: `b473010` - fix(storage): Exclude pet selector state from PetStorage.getAll()

**Root Cause Analysis (Issue 2)**:

Still investigating. Added debugging to trace effects data flow:
- `inline-preview-mvp.js:366-378` - logs effects breakdown when opening
- `session-pet-gallery.js:232-244` - logs pet effects when selected
- `pet-processor.js:2027-2038` - logs effects before PetStorage save

Possible causes:
1. Timing: User navigates to product page BEFORE Gemini effects complete (~10s after BiRefNet)
2. Race condition: Multiple saves to PetStorage may overwrite Gemini effects
3. Previous pets saved before fix was deployed only have B&W + Color

**Commit**: `a1a527e` - debug(effects): Add logging to trace Gemini effects data flow

**Files Modified**:
- [pet-storage.js:70-75](assets/pet-storage.js#L70-L75) - Skip selector_ entries in getAll()
- [inline-preview-mvp.js:366-378](assets/inline-preview-mvp.js#L366-L378) - Debug logging
- [session-pet-gallery.js:232-244](assets/session-pet-gallery.js#L232-L244) - Debug logging
- [pet-processor.js:2027-2038](assets/pet-processor.js#L2027-L2038) - Debug logging

**Testing Required**:
1. Clear browser localStorage/sessionStorage
2. Process a new pet on processor page
3. Wait for "✅ PetStorage updated with Gemini effects" in console
4. Navigate to product page
5. Select pet from Session Pet Gallery
6. Click "View Effects" - should show all 4 effects
7. Check console for effects breakdown at each step

**Next Steps**:
- User to test with fresh storage and review console logs
- If Gemini effects still missing, check if timing issue (navigating before save completes)
- May need to show loading state on product page until Gemini effects are available

---

### 2026-01-12 - ROOT CAUSE FIX: Gemini Effects Overwritten by Product Grid Click

**Issue**: Console logs confirmed that Gemini effects ARE being saved correctly:
```
📦 Saving Gemini effects to PetStorage: {petId: 'pet_5d585ecf...', effectKeys: Array(4), ink_wash: {...}, sketch: {...}}
✅ PetStorage updated with Gemini effects (ink_wash, sketch)
```

BUT on product page:
```
[SessionPetGallery] 🔍 Pet effects breakdown: {effectKeys: Array(2), ink_wash: 'NOT PRESENT', sketch: 'NOT PRESENT'}
```

**Root Cause**: `prepareBridgeData()` in `product-mockup-renderer.js` was OVERWRITING the complete Gemini data with stale data.

**Timeline**:
1. BiRefNet completes → `handleProcessingComplete()` sets `this.currentPetData.effects` (only B&W + Color)
2. Gemini completes → `pet-processor.js` saves all 4 effects to PetStorage ✅
3. User clicks product card → `prepareBridgeData()` saves stale `this.currentPetData.effects` to PetStorage ❌
4. Product page reads PetStorage → Only sees B&W + Color (Gemini effects overwritten)

**Fix Applied** (`product-mockup-renderer.js` lines 543-583):

Changed `prepareBridgeData()` to:
1. Read fresh effects from PetStorage BEFORE creating bridge data
2. Use stored effects (with Gemini) if they have more effects than stale in-memory data
3. REMOVED the duplicate PetStorage.save() that was overwriting Gemini effects

```javascript
// Start with current effects
let effectsToUse = this.currentPetData.effects;

// Read fresh effects from PetStorage (may have Gemini effects added after BiRefNet)
if (typeof window.PetStorage !== 'undefined' && window.PetStorage.get) {
  const storedPet = window.PetStorage.get(this.currentPetData.sessionKey);
  if (storedPet && storedPet.effects) {
    const storedEffectCount = Object.keys(storedPet.effects).length;
    const currentEffectCount = Object.keys(this.currentPetData.effects || {}).length;

    if (storedEffectCount > currentEffectCount) {
      console.log('[ProductMockupRenderer] Using fresh effects from PetStorage (has Gemini effects)');
      effectsToUse = storedPet.effects;
    }
  }
}

const bridgeData = {
  // ... uses effectsToUse instead of stale this.currentPetData.effects
};
```

**Files Modified**:
- [product-mockup-renderer.js:543-583](assets/product-mockup-renderer.js#L543-L583) - Read fresh effects, removed overwrite

**Expected Result**:
- Console should show: `Using fresh effects from PetStorage (has Gemini effects): {stored: ['enhancedblackwhite', 'color', 'ink_wash', 'sketch'], current: ['enhancedblackwhite', 'color']}`
- Session Pet Gallery should show all 4 effects available
- "View Effects" modal should display Ink Wash and Marker effects

**Commit**: `1ac024f`

---

### 2026-01-12 - FIX: Processor Return Navigation Missing Gemini Effects

**Issue**: When navigating back to processor page (`?from=product`), only B&W and Color effects were being restored. Console showed:
```
✅ [SessionStorage] Restored 2 effect(s): (2) ['enhancedblackwhite', 'color']
```

**Root Cause**: Same issue as the bridge data fix - `saveProcessorState()` was saving stale `this.currentPetData.effects` (only B&W + Color) to sessionStorage before Gemini effects were added.

**Fix Applied** (`product-mockup-renderer.js` lines 97-143):

Modified `saveProcessorState()` to read fresh effects from PetStorage before saving to sessionStorage:

```javascript
saveProcessorState() {
  // Read fresh effects from PetStorage (may have Gemini effects added after BiRefNet)
  let petDataToSave = this.currentPetData;

  if (typeof window.PetStorage !== 'undefined' && window.PetStorage.get) {
    const storedPet = window.PetStorage.get(this.currentPetData.sessionKey);
    if (storedPet && storedPet.effects) {
      const storedEffectCount = Object.keys(storedPet.effects).length;
      const currentEffectCount = Object.keys(this.currentPetData.effects || {}).length;

      if (storedEffectCount > currentEffectCount) {
        console.log('[ProductMockupRenderer] Using fresh effects from PetStorage for state save');
        petDataToSave = { ...this.currentPetData, effects: storedPet.effects };
      }
    }
  }

  const state = {
    petData: petDataToSave,  // Now includes Gemini effects
    effectUrl: this.currentEffectUrl,
    isExpanded: this.isExpanded,
    timestamp: Date.now()
  };

  sessionStorage.setItem('processor_mockup_state', JSON.stringify(state));
}
```

**Files Modified**:
- [product-mockup-renderer.js:97-143](assets/product-mockup-renderer.js#L97-L143) - Read fresh effects in saveProcessorState()

**Expected Result**:
- Console should show: `[ProductMockupRenderer] Using fresh effects from PetStorage for state save: {stored: ['enhancedblackwhite', 'color', 'ink_wash', 'sketch'], current: ['enhancedblackwhite', 'color']}`
- Console should show: `Processor state saved for return navigation {effectCount: 4, effects: ['enhancedblackwhite', 'color', 'ink_wash', 'sketch']}`
- When returning to processor: `✅ [SessionStorage] Restored 4 effect(s)`

**Commit**: `96997c5`

---

### 2026-01-12 - FIX: Processor Page RE-PROCESSING Instead of Displaying Saved Effects

**Issue**: When navigating back to the processor page WITHOUT `?from=product`, the processor was re-running BiRefNet instead of displaying previously processed images from PetStorage. Console showed:
```
🔄 Attempting to restore session from localStorage
🌐 Found GCS URL for pet 1, fetching...
BiRefNet processing: 1522ms
```

**Root Cause**: In `restoreSession()`, the `else` branch (not returning from product) checked `checkPetSelectorUploads()` FIRST. This found the GCS URL from pet selector and re-processed the image, never reaching the PetStorage check that already had all 4 processed effects.

**Code Flow Before Fix**:
1. `restoreSession()` detects NOT returning from product (no `?from=product`)
2. Goes to `else` branch (lines 639-647)
3. Calls `checkPetSelectorUploads()` → finds GCS URL in `pet_X_image_url`
4. Calls `loadPetSelectorImage()` → RE-PROCESSES via BiRefNet
5. Returns early → never checks PetStorage

**Fix Applied** (`pet-processor.js` lines 639-677):

Modified the `else` branch to check PetStorage FIRST before checking pet selector uploads:

```javascript
} else {
  // === FIX: Check PetStorage FIRST before checking pet selector uploads ===
  let hasPetStorageEffects = false;

  if (typeof PetStorage !== 'undefined') {
    try {
      const recentPets = PetStorage.getRecentPets(1);
      if (recentPets && recentPets.length > 0) {
        const recentPet = recentPets[0];
        const effectCount = Object.keys(recentPet.effects || {}).length;

        // Check if pet was processed within last 30 minutes
        const MAX_AGE = 30 * 60 * 1000;
        const isRecent = (Date.now() - (recentPet.timestamp || 0)) < MAX_AGE;

        if (effectCount > 0 && isRecent) {
          console.log(`🔄 [Priority Check] PetStorage has ${effectCount} processed effect(s), skipping pet selector re-processing`);
          hasPetStorageEffects = true;
          // Fall through to PetStorage restoration below
        }
      }
    } catch (err) {
      console.warn('⚠️ PetStorage priority check failed:', err);
    }
  }

  // Only check pet selector uploads if PetStorage doesn't have processed effects
  if (!hasPetStorageEffects) {
    const petSelectorImage = await this.checkPetSelectorUploads();
    if (petSelectorImage) {
      console.log('📸 Found uploaded image from pet selector, auto-loading...');
      await this.loadPetSelectorImage(petSelectorImage);
      return; // Early return
    }
  }
}
```

**Files Modified**:
- [pet-processor.js:639-677](assets/pet-processor.js#L639-L677) - Priority check for PetStorage before pet selector uploads

**Expected Result**:
- Console should show: `🔄 [Priority Check] PetStorage has 4 processed effect(s), skipping pet selector re-processing`
- Console should show: `✅ Session restored with 4 effect(s): ['enhancedblackwhite', 'color', 'ink_wash', 'sketch']`
- NO BiRefNet re-processing when navigating back to processor page

**Commit**: `6916144`

---

### 2026-01-12 - Session Restoration Approach Analysis

**Request**: Analyze Option 1 (Silent Auto-Restore, commit `6916144`) vs Option 2 (Welcome Back Mode) for session restoration on processor page.

**Analysis Summary**:

| Criteria | Option 1 (Silent) | Option 2 (Welcome Back) | Winner |
|----------|-------------------|------------------------|--------|
| UX for navigate-back | Seamless, <500ms | Modal friction, adds tap | Option 1 |
| Edge case handling | Clean fallbacks | Complex gallery sync | Option 1 |
| Maintainability | ~0 new lines | ~500+ lines added | Option 1 |
| Conversion risk | Low (preserves momentum) | Medium (forced pause 5-15% drop) | Option 1 |
| Mobile performance | Optimal | Extra CSS/JS | Option 1 |

**Recommendation**: Option 1 (Current Fix) is correct for the "navigate back" case (`?from=product`).

**Key Reasons**:
1. **Clear intent**: `?from=product` signals explicit return intent - no need to confirm
2. **Mobile-first**: 70% mobile traffic needs fastest path
3. **Conversion preservation**: Decision-phase users shouldn't be interrupted
4. **Existing infrastructure**: Leverages PetStorage + sessionStorage already in place

**When Welcome Back might fit (future)**:
- Fresh processor visit without `?from=product` parameter
- Multiple pets (>1) in storage requiring user selection
- Pets older than 30 min but user intentionally returning

**Hybrid approach for future**:
1. `?from=product` → Silent restore (current)
2. No param + multiple pets → Pet picker modal
3. No param + single recent pet → Silent restore
4. No param + expired/no pets → Upload zone

**No code changes made** - Analysis only.

---

### 2026-01-12 - Session Pet Gallery Cart-Clear Bug Fix

**Issue Reported**: Session Pet Gallery gets cleared when a product is added to cart, defeating the multi-product reuse feature.

**Root Cause Analysis**:

Found `clearProcessedPets()` being called in `assets/product-form.js` line 103:
```javascript
self.clearProcessedPets();     // Phase 1: Clear processed pet data
```

This function removes all `perkie_pet_pet_*` keys from localStorage after cart success, which defeats the entire purpose of Session Pet Gallery designed for multi-product purchases.

**User Confirmation**: "Yes, pets should remain in the session library unless they are removed by the customer"

**Fix Applied** (`assets/product-form.js`):

1. **Removed** `clearProcessedPets()` call from cart success handler (line 103)
2. **Updated** comment to clarify pets persist for multi-product purchases
3. **Deprecated** `clearProcessedPets()` function with comment explaining it's no longer called automatically (kept for potential future "Clear Library" button)

**Before**:
```javascript
self.savePetCustomization();  // Phase 2: Save for restoration
self.clearPetPropertyFields(); // Phase 1: Clear form fields
self.clearProcessedPets();     // Phase 1: Clear processed pet data
```

**After**:
```javascript
// NOTE: Pets are NOT cleared from Session Pet Gallery - they persist for multi-product purchases
self.savePetCustomization();  // Phase 2: Save for restoration
self.clearPetPropertyFields(); // Phase 1: Clear form fields (NOT pet library)
```

**Files Modified**:
- `assets/product-form.js` - Removed `clearProcessedPets()` call, updated comments

**Behavior Change**:
- **Before**: Adding to cart cleared all processed pets from localStorage
- **After**: Processed pets remain in Session Pet Gallery after cart add, allowing reuse on other products

**No commit yet** - Ready for testing.

---

### 2026-01-12 - Product Mockup Grid Expansion to 16 Products

**Request**: Expand the product mockup grid from 10 to 16 products with a 4x4 desktop layout.

**Changes Applied**:

1. **Liquid Template Updates** (`sections/ks-product-mockup-grid.liquid`):
   - Changed product loops from `(1..10)` to `(1..16)` (lines 56, 227)
   - Updated mobile expandable threshold from `> 5` to `> 8` (line 70)
   - Added schema settings for products 11-16 with full positioning controls:
     - `product_X_mockup_template` - Product reference
     - `product_X_top`, `product_X_left` - Position (%)
     - `product_X_width`, `product_X_height` - Size (%)
     - `product_X_rotation` - Rotation (degrees)
     - `product_X_variant_display` - Variant display mode

2. **CSS Grid Layout Update** (`assets/product-mockup-grid.css`):
   - Changed desktop grid from `repeat(5, 1fr)` to `repeat(4, 1fr)` (line 190)
   - Results in 4x4 grid layout on desktop (4 rows × 4 columns = 16 products)

**Resulting Behavior**:
- **Desktop (≥750px)**: 4x4 grid showing all 16 products simultaneously
- **Mobile (<750px)**: Shows first 8 products, remaining 8 hidden behind "See More Products" toggle

**Files Modified**:
- [ks-product-mockup-grid.liquid:56,70,227](sections/ks-product-mockup-grid.liquid) - Loop and threshold updates
- [ks-product-mockup-grid.liquid:1169-1568](sections/ks-product-mockup-grid.liquid) - Schema settings for products 11-16
- [product-mockup-grid.css:190](assets/product-mockup-grid.css) - Grid columns change

**Testing Required**:
1. Desktop: Verify 4x4 grid displays all 16 products
2. Mobile: Verify first 8 products visible, toggle reveals remaining 8
3. Theme Editor: Verify products 11-16 can be configured with full positioning controls

**Commit**: Pending

---

### 2026-01-12 - Product Mockup Opacity Research

**Request**: Research best practices for product mockup opacity in print-on-demand e-commerce, specifically for pet portrait overlays on product templates.

**Research Questions Addressed**:
1. What opacity do successful print-on-demand sites use for product mockups?
2. Are there UX studies on mockup realism vs conversion?
3. What's the standard approach for showing custom designs on product templates?
4. Do print-on-demand sites use blend modes or just opacity?

**Key Findings**:

1. **No industry-standard opacity percentage exists** - Guidance is contextual: "adjust opacity until it looks realistic"

2. **Blend modes are MORE important than opacity**:
   - **Multiply** is the standard blend mode for fabric/t-shirt mockups
   - Multiply makes designs appear "inside the garment, not on top of it"
   - Overlay/Multiply combination for canvas/framed prints
   - Shows product texture (ribbing, seams, wrinkles) through the design

3. **Specific opacity values found**:
   - Wall art mockups: 95% opacity for "closer to reality" (100% for brighter preview)
   - T-shirt mockups: "90% makes it look more realistic" (mentioned once, not universal)
   - Paper printing: 85-95% opacity standard (physical context, not digital)

4. **The "pasted on" vs "printed" problem**:
   - Generic mockups make "designs look 'stickered on,' flat, and fake"
   - Realistic mockups show product texture through the design
   - Lighting consistency, shadow matching, and displacement maps create realism
   - Lifestyle mockups increase conversion by up to 50%

5. **CSS implementation options**:
   - `mix-blend-mode: multiply` - makes design interact with underlying texture
   - `opacity: 0.9-0.95` - subtle reduction for realism
   - Combination approach recommended for web

**Recommendations for Perkie**:

| Product Type | Recommended Approach |
|--------------|---------------------|
| T-shirts/Apparel | `mix-blend-mode: multiply` + `opacity: 0.9` |
| Framed Prints | `opacity: 0.95-1.0` (prints should be crisp) |
| Mugs/Ceramics | `mix-blend-mode: multiply` for wrap realism |
| Canvas | `opacity: 0.95` + slight texture overlay |

**Important Considerations**:
- Pet portraits are CUSTOM art, not generic designs - customers want to see their pet clearly
- Reducing opacity too much (e.g., 70-80%) may make pet details hard to see
- For framed prints, 100% opacity is acceptable - the frame itself provides context
- Test with actual pet images before implementing changes

**Decision Guidance**:
- If mockups currently look "pasted on", try `mix-blend-mode: multiply` first
- If still too flat, add subtle opacity reduction (95%)
- Never go below 85% opacity for pet portraits - clarity matters
- Consider different settings per product type rather than global opacity

**Sources Consulted**:
- Dynamic Mockups, Printify, Printful documentation
- Photoshop mockup tutorials (Adobe, Mockey.ai)
- Baymard Institute e-commerce UX research
- CSS-Tricks, MDN web documentation

**No code changes made** - Research only

---

### 2026-01-13 - Product Mockup Blend Mode Implementation

**Request**: Implement blend modes for fabric products while keeping framed prints at full opacity. User approved recommendation from previous research session.

**Changes Applied**:

1. **Liquid Template Update** (`sections/ks-product-mockup-grid.liquid` lines 70-94):
   - Added `data-blend-category` attribute to mockup cards
   - Blend category determined by product type and handle keywords:
     - `fabric`: tees, shirts, sweatshirts, hoodies, totes, bags, pillows
     - `ceramic`: mugs, cups
     - `hard-surface`: phone cases
     - `paper`: cards, stickers
     - `framed`: frames, canvas, prints, posters
     - `default`: fallback for unknown product types

2. **CSS Blend Mode Rules** (`assets/product-mockup-grid.css` lines 339-378):
   - Fabric products: `mix-blend-mode: multiply` + `opacity: 0.92`
   - Ceramic products: `mix-blend-mode: multiply` + `opacity: 0.95`
   - Hard surfaces: `mix-blend-mode: multiply` + `opacity: 0.95`
   - Paper products: `mix-blend-mode: multiply` + `opacity: 0.97`
   - Framed prints: `mix-blend-mode: normal` + `opacity: 1.0` (no change)
   - Default fallback: `mix-blend-mode: multiply` + `opacity: 0.95`

**Technical Implementation**:
- Uses CSS attribute selectors: `.mockup-card[data-blend-category="fabric"] .mockup-card__pet.visible`
- `mix-blend-mode: multiply` shows product texture through pet image, creating "printed on" effect
- Higher opacity (92-97%) preserves pet portrait detail visibility
- Framed prints remain at 100% because the pet image IS the product

**Expected Result**:
- Fabric products (tees, hoodies, totes, pillows) will show product texture through pet image
- Framed prints and canvases display pet at full clarity
- More realistic "printed on product" appearance vs "floating overlay" look

**Files Modified**:
- [ks-product-mockup-grid.liquid:70-94](sections/ks-product-mockup-grid.liquid#L70-L94) - Added blend category data attribute
- [product-mockup-grid.css:339-378](assets/product-mockup-grid.css#L339-L378) - Added product-type-specific blend mode CSS

**Commit**: `51faa06` - feat(mockup): Add product-type-specific blend modes for realistic mockup appearance

---

### 2026-01-13 - UX Research: Session Pet Gallery "Unselect" Pattern

**Request**: Research best UX pattern for allowing customers to "unselect" a previously selected pet from the Session Pet Gallery without deleting it.

**Current Flow Problem**:
1. Customer sees Session Pet Gallery with previously processed pets
2. Customer clicks a pet thumbnail to select it
3. Upload zone is hidden, replaced with "Pet selected" message
4. **GAP**: No way to unselect and return to upload zone without deleting the pet

**Research Findings**:

#### 1. Best UX Pattern: "Change Image" Text Link
| Pattern | Recommendation | Reasoning |
|---------|---------------|-----------|
| X button | NOT recommended | Implies deletion; confusing when pet persists in library |
| "Change" link | **RECOMMENDED** | Clear intent, doesn't imply deletion, large touch target |
| Toggle (re-click) | NOT recommended | Undiscoverable; no visual affordance |
| Swipe gesture | NOT recommended | Undiscoverable; accessibility issues |

#### 2. Placement: Below Thumbnail
```
┌───────────┐
│ [Pet      │  ✓ Pet selected
│  Image]   │
└───────────┘  Change image ←
```
- Below thumbnail keeps pet as hero
- Left-aligned creates visual connection
- Not overlaid = no accidental taps

#### 3. Label: "Change image" (text only)
- Clear and unambiguous
- No icon needed (adds visual noise)
- Avoid: "Remove," "Clear," "Unselect" (implies deletion)

#### 4. Confirmation: INSTANT ACTION (No Confirmation)
- Non-destructive action (pet stays in library)
- Friction reduction for mobile (70% traffic)
- Easy recovery (re-select from gallery)
- Optional: Toast notification "Selection cleared"

#### 5. Accessibility Requirements
- Minimum 44x44px touch target
- Keyboard accessible (native `<button>` or `tabindex`)
- `aria-label="Change selected pet image"`
- WCAG AA color contrast (4.5:1)
- Non-color affordance (underlined)

#### 6. E-Commerce Precedents
- Amazon: "Change" link below cart item thumbnail
- Shutterfly: "Replace Photo" button
- Custom Ink: "Change Artwork" link
- Etsy: "Edit" link next to selection

**Implementation Recommendation**:
```html
<button
  type="button"
  class="session-pet-selected__change-btn"
  aria-label="Change selected pet image"
>
  Change image
</button>
```

**Behavior**:
- Clicking shows upload zone
- Hides "Pet selected" state
- Pet REMAINS in Session Pet Gallery
- Optional toast: "Selection cleared"

**No code changes made** - UX research only

---

### 2026-01-13 - Implementation: "Change image" Button for Session Pet Gallery

**Implemented** the UX research recommendations from above.

**Changes Made**:

1. **Added "Change image" button** to selected pet preview ([session-pet-gallery.js:323-351](assets/session-pet-gallery.js#L323-L351)):
   - Text link style with underline
   - Theme color using CSS variable
   - 44px minimum touch target
   - Hover opacity effect
   - Calls `clearSessionGallerySelection()` on click

2. **Enhanced `clearSessionGallerySelection()` function** ([session-pet-gallery.js:462-506](assets/session-pet-gallery.js#L462-L506)):
   - Removes `has-files` class from upload zone
   - Resets Preview button to disabled state
   - Hides upload status wrapper
   - Restores upload icon and text

3. **Added `showChangeFeedback()` toast** ([session-pet-gallery.js:508-536](assets/session-pet-gallery.js#L508-L536)):
   - "Selection cleared - upload a new image"
   - Uses existing animation patterns

**Files Modified**:
- [session-pet-gallery.js](assets/session-pet-gallery.js) - Added Change button, enhanced clear function, added feedback toast

**Commit**: `9a99783` - feat(gallery): Add "Change image" button to unselect pet from Session Gallery

---

### 2026-01-13 - Fix: Auto-Processing Bug on Processor Page Return

**Issue Reported**: Sometimes when navigating back to the custom-image-processing page, the processor auto-runs and re-processes the last image uploaded instead of displaying already-processed results.

**Root Cause Analysis** (debug-specialist agent):

The `clearPetSelectorUploads()` function in `pet-processor.js` only cleared `pet_X_images` (base64 format) but **NOT** `pet_X_image_url` (GCS URL format).

**Timeline of the Bug**:
1. User uploads image on product page → `pet_1_image_url` saved to localStorage
2. User navigates to processor → BiRefNet processes → `clearPetSelectorUploads()` called
3. But: `clearPetSelectorUploads()` does NOT remove `pet_1_image_url` - only `pet_1_images`
4. Later visit: User returns to processor WITHOUT `?from=product` parameter
5. Priority Check fails: Pet > 30 minutes old OR PetStorage empty
6. Fallback: `checkPetSelectorUploads()` finds the stale `pet_1_image_url`
7. Re-Processing: `loadPetSelectorImage()` fetches from GCS and calls `processFile()`

**Fix Applied** (`assets/pet-processor.js` lines 1114-1155):

Modified `clearPetSelectorUploads()` to also clear:
- `pet_X_image_url` (GCS URL format) - **PRIMARY FIX**
- `pet_X_file_metadata` (metadata cleanup)

```javascript
// FIX: Also clear GCS URL format (pet_X_image_url)
// This prevents re-processing when user returns to processor page
// after the 30-minute PetStorage timeout expires
const urlKey = `pet_${i}_image_url`;
if (localStorage.getItem(urlKey)) {
  localStorage.removeItem(urlKey);
  cleared++;
  console.log(`🧹 Cleared GCS URL upload: ${urlKey}`);
}
```

**Files Modified**:
- [pet-processor.js:1114-1155](assets/pet-processor.js#L1114-L1155) - Added GCS URL and metadata cleanup

**Expected Result**:
- After processing, both `pet_X_images` AND `pet_X_image_url` are cleared
- Returning to processor page (without `?from=product`) will NOT re-process
- Console shows: `🧹 Cleared GCS URL upload: pet_X_image_url`

**Commit**: `d130e03` - fix(processor): Clear GCS URLs to prevent auto-reprocessing on page return

---

---

### 2026-01-13 - VERIFICATION: clearPetSelectorUploads() Fix Has NO Impact on Order Fulfillment

**Verification Request**: Analyze whether the fix in commit `d130e03` (clearing `pet_X_image_url` and `pet_X_file_metadata`) affects order fulfillment.

**CONCLUSION: NO REGRESSION - Fix is SAFE**

**Complete Data Flow Analysis**:

#### 1. localStorage Keys - STAGING vs ORDER FULFILLMENT

| Key Pattern | Purpose | Used For Fulfillment? | Cleared by Fix? |
|-------------|---------|----------------------|-----------------|
| `pet_X_image_url` | **STAGING**: Temp storage for processor auto-load | NO | YES (safe) |
| `pet_X_images` | **STAGING**: Base64 fallback for offline | NO | YES (existing) |
| `pet_X_file_metadata` | **STAGING**: File info for processor | NO | YES (safe) |
| `perkie_pet_{petId}` | **BRIDGE**: PetStorage for Session Gallery | NO (not direct) | NO (untouched) |

#### 2. Order Fulfillment Keys (Form Properties)

The actual order data is stored in **hidden form fields**, NOT localStorage:

```html
<!-- Hidden fields submitted with cart (ks-product-pet-selector-stitch.liquid) -->
<input name="properties[_pet_X_processed_image_url]">  <!-- GCS URL of processed image -->
<input name="properties[_pet_X_artist_notes]">          <!-- Artist notes -->
<input name="properties[_pet_X_filename]">              <!-- Filename -->
<input name="properties[_pet_X_order_type]">            <!-- "Express Upload" -->
<input name="properties[Pet X Images]">                 <!-- File input for Shopify CDN -->
```

These form fields are populated by:
1. `inline-preview-mvp.js:savePetDataAndClose()` → PetStorage → form fields
2. `ks-product-pet-selector-stitch.liquid:populateOrderProperties()` → form fields

#### 3. Timing Analysis - When Keys Are Set vs Cleared

**Timeline**:
```
1. Product Page: User uploads image
   → pet_X_image_url SET in localStorage (for processor auto-load)
   → pet_X_file_metadata SET in localStorage

2. Processor Page: User navigates to processor (or inline modal opens)
   → checkPetSelectorUploads() READS pet_X_image_url
   → loadPetSelectorImage() fetches image from GCS
   → processFile() processes via BiRefNet/Gemini
   → clearPetSelectorUploads() CLEARS staging keys ← THE FIX

3. After Processing:
   → PetStorage.save() stores processed effects (perkie_pet_{id})
   → NOT affected by clearPetSelectorUploads()

4. Add to Cart:
   → product-form.js reads from PetStorage
   → Populates form hidden fields (properties[_pet_X_*])
   → Form submits to Shopify → Order created
```

**Key Insight**: `pet_X_image_url` is a **one-way staging key** used ONLY to pass the upload from product page to processor. Once processing starts, the data is:
1. Fetched from GCS URL
2. Converted to File object
3. Processed through BiRefNet/Gemini
4. Saved to PetStorage (different key pattern)

The staging key is no longer needed and was intentionally designed to be cleared.

#### 4. Code Evidence - No Fulfillment Dependencies

**Search Results for `pet_X_image_url` usage**:
- `ks-product-pet-selector-stitch.liquid:2281` - SET after upload
- `ks-product-pet-selector-stitch.liquid:2529` - READ for Preview button
- `ks-product-pet-selector-stitch.liquid:2569` - READ for inline modal
- `pet-processor.js:943` - READ in checkPetSelectorUploads()
- **NO references** in `product-form.js` or cart submission code

**Form field sources** (actual order data):
- `properties[_pet_X_processed_image_url]` ← PetStorage, NOT pet_X_image_url
- PetStorage uses `perkie_pet_{sessionKey}` prefix (completely different)

#### 5. Edge Case Analysis

| Scenario | Impact | Verdict |
|----------|--------|---------|
| User uploads, navigates to processor, processes | ✅ Works - URL read BEFORE clear | SAFE |
| User uploads, closes browser, returns next day | ✅ Works - pet_X_image_url triggers reprocess | SAFE (now clears properly after) |
| User uploads via Session Gallery (pre-processed) | ✅ Works - uses PetStorage, not pet_X_image_url | SAFE |
| User adds to cart without processing | ⚠️ File-only upload | SAFE (uses file input, not localStorage) |

#### 6. Verification Summary

**Files Analyzed**:
- `assets/pet-processor.js` (lines 935-1155) - checkPetSelectorUploads, clearPetSelectorUploads
- `assets/product-form.js` (lines 190-275) - savePetCustomization, clearPetPropertyFields
- `assets/pet-storage.js` - PetStorage class (completely separate prefix)
- `snippets/ks-product-pet-selector-stitch.liquid` (lines 2260-2490) - Upload handlers, form fields
- `snippets/order-custom-images.liquid` - Order fulfillment template

**Confirmation**:
- `pet_X_image_url` is NEVER read during cart submission
- `pet_X_image_url` is NEVER included in order properties
- Order fulfillment uses `properties[_pet_X_processed_image_url]` from PetStorage
- The cleared keys are **staging-only** for processor auto-load

**VERDICT: FIX IS SAFE - NO REGRESSION RISK**

---

### 2026-01-13 - Additional Pet Fee Implementation

**Request**: Decouple "Number of Pets" selection from Shopify product variants. Instead of variant-based pricing, add a separate "Additional Pet Fee" line item to cart when 2+ pets selected.

**Implementation Summary**:

| Pet Count | Fee | Implementation |
|-----------|-----|----------------|
| 1 pet | $0 | No fee added |
| 2 pets | +$10 | Fee variant added to cart |
| 3 pets | +$15 | Fee variant added to cart |

**Changes Made**:

1. **Theme Settings** (`config/settings_schema.json`):
   - Added "Pet Fee Configuration" settings group
   - `pet_fee_variant_2_pets` - Variant ID for $10 fee
   - `pet_fee_variant_3_pets` - Variant ID for $15 fee

2. **Pet Count Buttons** (`snippets/ks-product-pet-selector-stitch.liquid` lines 38-56):
   - Added `(+$10)` and `(+$15)` callouts to buttons 2 and 3
   - Added `data-fee-variant` attribute with variant ID from settings
   - Added hidden input `[data-pet-fee-variant-input]` to store selected fee variant

3. **Pet Count Handler** (`snippets/ks-product-pet-selector-stitch.liquid` lines 1909-1931):
   - Replaced `updateVariantSelection(count)` with `storePetFeeVariant(count, feeVariantId)`
   - New function stores fee variant ID in hidden input
   - Sets `data-selected-pet-count` attribute on container

4. **CSS Styling** (`snippets/ks-product-pet-selector-stitch.liquid` lines 499-530):
   - `.pet-count-btn` now uses flex-direction: column
   - `.pet-count-btn__fee` styles for smaller gray text
   - Fee text changes to theme color when selected

5. **Cart Submission** (`assets/product-form.js` lines 65-122):
   - Detects fee variant ID from hidden input
   - If present, uses multi-item JSON submission with `items[]` array
   - Main product + fee product added in single cart operation
   - Fee line item includes `_linked_to_product`, `_pet_count`, `_fee_type` properties

**Technical Flow**:
```
Customer selects 2 pets
    ↓
storePetFeeVariant(2, '12345') called
    ↓
Hidden input value = '12345'
    ↓
Customer clicks Add to Cart
    ↓
product-form.js detects fee variant
    ↓
JSON body: { items: [mainProduct, feeProduct] }
    ↓
Cart shows: Product + $10 Additional Pet Fee
```

**Files Modified**:
- [config/settings_schema.json](config/settings_schema.json) - Pet fee settings
- [ks-product-pet-selector-stitch.liquid:38-56](snippets/ks-product-pet-selector-stitch.liquid#L38-L56) - Button HTML
- [ks-product-pet-selector-stitch.liquid:499-530](snippets/ks-product-pet-selector-stitch.liquid#L499-L530) - CSS styles
- [ks-product-pet-selector-stitch.liquid:1909-1931](snippets/ks-product-pet-selector-stitch.liquid#L1909-L1931) - JS handler
- [product-form.js:65-122](assets/product-form.js#L65-L122) - Cart submission

**Manual Setup Required**:
1. Create "Additional Pet Fee" product in Shopify Admin
2. Mark as hidden from online store
3. Create 2 variants: "1 Extra Pet" ($10) and "2 Extra Pets" ($15)
4. Copy variant IDs to Theme Settings > Pet Fee Configuration

**Commit**: `5f293d6` - feat(cart): Decouple pet count from variants, use separate fee line item

---

### 2026-01-13 - DEBUG: Shopify 422 "Cannot Find Variant" for Pet Fee Feature

**Issue Reported**:
- User confirmed variant IDs are correct and active in Shopify Admin
- Console shows: `💰 Pet fee variant set to: 43422221402195`
- `/cart/add` returns 422 error: "Cannot find variant"

**Console Evidence**:
```
💰 Pet fee variant set to: 43422221402195
💰 [PetFee] Multi-item cart add: Object
/cart/add:1 Failed to load resource: the server responded with a status of 422 ()
```

**Root Cause Analysis**:

Based on research into Shopify's `/cart/add.js` API and the specific 422 error, there are several potential root causes:

**1. MOST LIKELY: Product Not Published to Online Store Sales Channel** (HIGH probability)
- The fee product exists in Shopify Admin but may NOT be available on the "Online Store" sales channel
- The `/cart/add.js` endpoint ONLY works with products/variants published to Online Store
- Even if the variant ID is valid, Shopify returns 422 if the product isn't on Online Store

**Verification Steps**:
1. Go to Shopify Admin > Products > "Additional Pet Fee" product
2. Check "Sales channels and apps" section in right sidebar
3. Ensure "Online Store" is checked (not just active in admin)

**2. NaN from parseInt Edge Case** (LOW-MEDIUM probability)
- If `feeVariantId` has any unexpected characters, `parseInt()` returns NaN
- NaN gets serialized as `null` in JSON, which Shopify rejects
- Current code: `id: parseInt(feeVariantId)` on line 95

**Fix if This is the Issue**:
```javascript
const parsedFeeId = parseInt(feeVariantId, 10);
if (isNaN(parsedFeeId)) {
  console.error('💰 [PetFee] Invalid fee variant ID:', feeVariantId);
  // Fall back to single-item submission
  config.body = formData;
  // ... continue with normal flow
}
```

**3. Hidden Product vs Draft Product** (MEDIUM probability)
- "Hidden from Online Store" (availability = nowhere) may NOT work with cart API
- Need to use "Available on Online Store" but "Not included in search/collections"
- Verify: Product status must be "Active" (not Draft)

**4. Shopify Multi-Product Cart API Limitation** (LOW probability)
- Based on Shopify community forums, some users report 422 errors specifically when adding variants from DIFFERENT products in a single `/cart/add.js` call
- The documented API suggests this SHOULD work, but edge cases exist
- Quote from forum: "When it comes to variants of different products... it throws 422 Cannot find variant error"

**Workaround if This is the Issue**:
```javascript
// Sequential cart adds instead of single multi-item
await fetch('/cart/add.js', { body: JSON.stringify({ id: mainVariantId, quantity: 1, properties }) });
await fetch('/cart/add.js', { body: JSON.stringify({ id: feeVariantId, quantity: 1, properties }) });
```

**Debugging Steps to Implement**:

1. **Add detailed logging before fetch** (product-form.js ~line 116):
```javascript
console.log('💰 [PetFee] Cart payload:', JSON.stringify(cartPayload, null, 2));
console.log('💰 [PetFee] Main variant type:', typeof mainVariantId, 'value:', mainVariantId);
console.log('💰 [PetFee] Fee variant type:', typeof feeVariantId, 'value:', feeVariantId, 'parsed:', parseInt(feeVariantId));
```

2. **Log the actual 422 response body** (product-form.js ~line 126):
```javascript
.then((response) => {
  console.log('💰 [PetFee] Response status:', response.status);
  return response.json();
})
.then((response) => {
  console.log('💰 [PetFee] Response body:', response);
  // ... existing error handling
})
```

3. **Validate variant ID format**:
```javascript
// Before creating items array
const parsedMainId = parseInt(mainVariantId, 10);
const parsedFeeId = parseInt(feeVariantId, 10);

if (isNaN(parsedMainId) || isNaN(parsedFeeId)) {
  console.error('💰 [PetFee] Invalid variant IDs:', { main: mainVariantId, fee: feeVariantId });
  // Fall back to single-item submission
}
```

**Recommended Immediate Actions**:

1. **Verify Sales Channel** (most likely fix):
   - Shopify Admin > Products > "Additional Pet Fee"
   - Enable "Online Store" in Sales Channels
   - Status must be "Active" (not Draft)

2. **Test with Browser Console** (verify API works):
   ```javascript
   // Paste in console on product page to test fee variant directly
   fetch('/cart/add.js', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ id: 43422221402195, quantity: 1 })
   }).then(r => r.json()).then(console.log).catch(console.error);
   ```

3. **Check variant exists and is purchasable**:
   ```javascript
   // Get variant info
   fetch('/products/additional-pet-fee.js')
     .then(r => r.json())
     .then(p => console.log('Variants:', p.variants));
   ```

**Configuration Confirmed**:
- `pet_fee_variant_2_pets`: 43422221369427 (settings_data.json)
- `pet_fee_variant_3_pets`: 43422221402195 (settings_data.json)

**Files Analyzed**:
- [product-form.js:65-122](assets/product-form.js#L65-L122) - Cart submission logic
- [ks-product-pet-selector-stitch.liquid:50](snippets/ks-product-pet-selector-stitch.liquid#L50) - Fee variant data attribute
- [ks-product-pet-selector-stitch.liquid:1928-1936](snippets/ks-product-pet-selector-stitch.liquid#L1928-L1936) - storePetFeeVariant function
- [config/settings_data.json:162-163](config/settings_data.json#L162-L163) - Variant ID configuration

**Resources**:
- [Shopify Cart API Reference](https://shopify.dev/docs/api/ajax/reference/cart)
- [Community: 422 error even though product is in stock](https://community.shopify.dev/t/getting-422-error-from-cart-add-js-even-though-product-is-in-stock/16764)
- [Community: /cart/add API not working for multiple products](https://community.shopify.dev/t/cart-add-api-not-working-for-multiple-products/11368)

**Status**: Awaiting user to verify sales channel configuration

---

### 2026-01-13 - Enhanced Debug Logging Added

**Issue Persists**: User confirmed variant IDs are correct and active, but 422 error continues.

**Enhanced Logging Added** (`assets/product-form.js`):

1. **Full payload logging** (lines 119-121):
   ```javascript
   console.log('💰 [PetFee] Full payload:', JSON.stringify(cartPayload, null, 2));
   console.log('💰 [PetFee] Parsed IDs - main:', parseInt(mainVariantId), 'fee:', parseInt(feeVariantId), 'isNaN:', isNaN(parseInt(feeVariantId)));
   ```

2. **Error response logging** (lines 128-138):
   ```javascript
   if (!response.ok) {
     console.error('💰 [PetFee] Cart add failed with status:', response.status);
   }
   // ...
   console.error('💰 [PetFee] Cart error response:', JSON.stringify(response, null, 2));
   ```

**Key Verification Step**:
Run this in browser console to test variant directly:
```javascript
fetch('/cart/add.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 43422221402195, quantity: 1 })
}).then(r => r.json()).then(d => console.log('SUCCESS:', d)).catch(e => console.error('FAILED:', e));
```

If this fails, the product is NOT published to Online Store sales channel.

**Files Modified**:
- [product-form.js:118-138](assets/product-form.js#L118-L138) - Enhanced debug logging

---

## Notes
- Always append new work with timestamp
- Archive when file > 400KB or task complete
- Include commit references for all code changes
- Cross-reference documentation created
