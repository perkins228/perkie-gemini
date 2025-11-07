# Order Data Field Cleanup - Implementation Plan

**Date**: 2025-11-04
**Session**: 001
**Scope**: Update `ks-product-pet-selector-stitch.liquid` (new selector ONLY)
**Goal**: Remove redundant fields, add selected style URL capture logic

---

## Executive Summary

### Objective
Clean up order data capture to remove 6 redundant fields while adding critical new functionality: capturing ONLY the selected style URL(s) per pet (not all 4 generated styles), plus original filename tracking.

### Current State Problems
1. **Missing Critical Data**: No selected style URLs captured (fulfillment needs the chosen style image)
2. **Missing Filename**: No original filename tracking per pet
3. **Redundant Fields**: 6 fields captured that duplicate other data or provide no fulfillment value
4. **All Styles Captured**: System generates 4 styles but we capture none of them properly

### Proposed Solution
- **REMOVE**: 6 redundant properties from all files
- **ADD**: Per-pet selected style URL properties (`Pet 1/2/3 Processed Image URL`)
- **ADD**: Per-pet filename properties (`Pet 1/2/3 Filename`)
- **KEEP**: Style selection (already working), Font selection (already working), Pet Order Number (per pet, already working)

### Impact Assessment
- **Risk Level**: MEDIUM-HIGH (data flow changes, new JavaScript logic required)
- **Files Modified**: 3-4 files (1 Liquid template, 1-2 JS files, possibly 1 CSS file)
- **Lines Changed**: ~150-200 lines (removals + additions)
- **Timeline**: 6-8 hours (3-4 implementation + 3-4 testing)
- **Rollback**: Straightforward (revert hidden field names, restore old logic)

---

## Part 1: Fields to REMOVE

### 1.1 Redundant Properties (Delete All References)

| Property Name | Reason for Removal | Current Locations |
|--------------|-------------------|-------------------|
| `_has_custom_pet` | Boolean flag - redundant (presence of pet name/image already indicates custom) | cart-pet-integration.js (lines 276-284, 311-316, 497, 689) |
| `_original_image_url` | Not needed for fulfillment - we only need processed style URL | cart-pet-integration.js (lines 248-259) |
| `_effect_applied` | Redundant - Style field already captures this (enhancedblackwhite/color/modern/sketch) | cart-pet-integration.js (lines 287-297) |
| `_font_style` | Redundant - Font field in new selector already captures this (Preppy/Classic/etc.) | cart-pet-integration.js (lines 195-224, 323-352) |
| `_previous_order_number` | Redundant - Already captured in per-pet "Pet 1/2/3 Order Number" fields | cart-pet-integration.js (lines 376-384, 417-422, 808) |
| `_is_repeat_customer` | Redundant - Order Type field captures this | cart-pet-integration.js (lines 387-395, 422) |

### 1.2 File-by-File Removal Plan

#### File: `assets/cart-pet-integration.js`

**CRITICAL NOTE**: This file handles the OLD pet selector (`ks-product-pet-selector.liquid`). The new selector does NOT use this integration file. However, we still need to check if any shared functions affect both selectors.

**Action**: AUDIT ONLY - Identify if any functions are shared with new selector
- Lines 182-297: `updateFormFields()` - Creates hidden fields for old selector
- Lines 354-402: `updateReturningCustomerFields()` - May be used by both selectors
- Lines 405-428: `clearReturningCustomerFields()` - May be used by both selectors

**Decision**:
- ❌ **DO NOT MODIFY** cart-pet-integration.js unless confirmed it affects new selector
- ✅ **INVESTIGATE FIRST**: Check if new selector calls any functions from this file
- ✅ **DOCUMENT**: Confirm new selector has standalone JavaScript (likely in Liquid file)

#### File: `snippets/ks-product-pet-selector-stitch.liquid`

**JavaScript Section** (likely lines 1200-1900):

**SEARCH FOR**:
- Any references to `_has_custom_pet`
- Any references to `_original_image_url`
- Any references to `_effect_applied`
- Any references to `_font_style` (Note: `Font` property should remain)
- Any references to `_previous_order_number` (Note: Per-pet order numbers should remain)
- Any references to `_is_repeat_customer`

**ACTION**:
1. Grep entire file for these property names
2. Remove any hidden field creation for these properties
3. Remove any JavaScript logic that populates these properties
4. Keep validation logic for `Font` and `Style` (non-underscore versions)

**Expected Findings**: Likely ZERO references (new selector uses cleaner property naming)

---

## Part 2: Fields to ADD

### 2.1 New Properties (Implement in New Selector Only)

| Property Name | Type | Source | Purpose | Example Value |
|--------------|------|--------|---------|---------------|
| `Pet 1 Processed Image URL` | URL (GCS) | New selector JS | Selected style URL for fulfillment | `https://storage.googleapis.com/.../buddy-modern.jpg` |
| `Pet 2 Processed Image URL` | URL (GCS) | New selector JS | Selected style URL for fulfillment | `https://storage.googleapis.com/.../max-sketch.jpg` |
| `Pet 3 Processed Image URL` | URL (GCS) | New selector JS | Selected style URL for fulfillment | `https://storage.googleapis.com/.../luna-bw.jpg` |
| `Pet 1 Filename` | String | File input | Original filename for reference | `IMG_1234.jpg` |
| `Pet 2 Filename` | String | File input | Original filename for reference | `buddy_photo.png` |
| `Pet 3 Filename` | String | File input | Original filename for reference | `20231104_pet.heic` |

### 2.2 Data Flow for Selected Style URL

**CRITICAL UNDERSTANDING**: Customer journey and style selection logic

```
STEP 1: Upload & Processing
─────────────────────────────
Customer uploads image on product page
  ↓
Click "Preview" button
  ↓
Navigate to /pages/custom-image-processing#processor
  ↓
Pet Processor V5 processes image:
  - Background removal (InSPyReNet API)
  - 4 styles generated:
    1. enhancedblackwhite (InSPyReNet)
    2. color (InSPyReNet)
    3. modern (Gemini Artistic API)
    4. sketch (Gemini Artistic API)
  ↓
All 4 style URLs stored in localStorage:
  localStorage: perkie_pet_{petId} = {
    effects: {
      enhancedblackwhite: { gcsUrl: "https://..." },
      color: { gcsUrl: "https://..." },
      modern: { gcsUrl: "https://..." },
      sketch: { gcsUrl: "https://..." }
    }
  }
  ↓
Customer clicks "Continue to Product" button
  ↓

STEP 2: Style Selection (ON PRODUCT PAGE)
──────────────────────────────────────────
Navigate back to product page
  ↓
New selector renders 4 style radio buttons:
  - Black & White (value="enhancedblackwhite")
  - Color (value="color")
  - Modern (value="modern")
  - Sketch (value="sketch")
  ↓
Customer selects ONE style (e.g., "Modern")
  ↓
Hidden field populated:
  name="properties[Style]"
  value="modern"
  ↓

STEP 3: Add to Cart (CURRENT PROBLEM)
──────────────────────────────────────
Customer clicks "Add to Cart"
  ↓
❌ CURRENT: Style name captured but NOT the processed image URL
  - Order has: Style="modern"
  - Order MISSING: Pet 1 Processed Image URL (the actual modern.jpg GCS URL)
  ↓
❌ PROBLEM: Fulfillment team sees "modern" but has no image to print!

STEP 3: Add to Cart (PROPOSED SOLUTION)
────────────────────────────────────────
Customer clicks "Add to Cart"
  ↓
✅ NEW LOGIC: Before form submission
  ↓
1. Read selected style from radio button (e.g., "modern")
2. Read pet data from localStorage: perkie_pet_{petId}
3. Extract selected style URL:
   selectedStyleUrl = petData.effects[selectedStyle].gcsUrl
   // = petData.effects["modern"].gcsUrl
   // = "https://storage.googleapis.com/.../modern.jpg"
4. Populate hidden field:
   name="properties[Pet 1 Processed Image URL]"
   value="https://storage.googleapis.com/.../modern.jpg"
  ↓
✅ Order now includes:
  - Style="modern" (which style name)
  - Pet 1 Processed Image URL="https://..." (actual image to print)
  ↓
✅ Fulfillment team has everything needed!
```

### 2.3 Implementation Specifications

#### **File: `snippets/ks-product-pet-selector-stitch.liquid`**

**Location 1: Add Hidden Fields** (after line 363, before `</div>`)

```liquid
{% comment %} Hidden fields for selected style URLs (populated by JavaScript before form submit) {% endcomment %}
{% for i in (1..3) %}
  <input type="hidden"
         id="pet-{{ i }}-processed-url"
         name="properties[Pet {{ i }} Processed Image URL]"
         value=""
         data-pet-processed-url="{{ i }}">
  <input type="hidden"
         id="pet-{{ i }}-filename"
         name="properties[Pet {{ i }} Filename]"
         value=""
         data-pet-filename="{{ i }}">
{% endfor %}
```

**Location 2: Add JavaScript Logic** (in `<script>` section, after form submission handler)

**FIND**: Form submission handler (likely searching for `addEventListener('submit'` or similar)

**ADD**: New function to populate style URLs before submission

```javascript
/**
 * Populate selected style URLs before form submission
 * Reads selected style from radio button and fetches corresponding GCS URL from localStorage
 */
function populateSelectedStyleUrls() {
  console.log('🔍 Populating selected style URLs for order...');

  // Get selected style (global selection)
  const selectedStyleRadio = document.querySelector('[data-style-radio]:checked');
  if (!selectedStyleRadio) {
    console.warn('⚠️ No style selected - skipping style URL population');
    return false; // Validation should catch this
  }

  const selectedStyle = selectedStyleRadio.value; // e.g., "modern", "enhancedblackwhite"
  console.log(`✅ Selected style: ${selectedStyle}`);

  // Get active pet count
  const petCountRadio = document.querySelector('[data-pet-count-radio]:checked');
  if (!petCountRadio) {
    console.warn('⚠️ No pet count selected - skipping');
    return false;
  }

  const petCount = parseInt(petCountRadio.value);
  console.log(`✅ Active pets: ${petCount}`);

  // For each active pet, populate processed URL and filename
  for (let i = 1; i <= petCount; i++) {
    // Get pet name to construct localStorage key
    const petNameInput = document.querySelector(`[data-pet-name-input="${i}"]`);
    const petName = petNameInput ? petNameInput.value.trim() : '';

    if (!petName) {
      console.warn(`⚠️ Pet ${i} has no name - skipping URL population`);
      continue;
    }

    // Construct localStorage key (matches pet-storage.js pattern)
    const storageKey = `perkie_pet_${petName.toLowerCase().replace(/\s+/g, '_')}`;
    const storedData = localStorage.getItem(storageKey);

    if (!storedData) {
      console.warn(`⚠️ No localStorage data found for pet ${i} (${petName}) - key: ${storageKey}`);
      continue;
    }

    let petData;
    try {
      petData = JSON.parse(storedData);
    } catch (e) {
      console.error(`❌ Failed to parse localStorage data for pet ${i}:`, e);
      continue;
    }

    // Extract selected style URL
    if (petData.effects && petData.effects[selectedStyle]) {
      const styleData = petData.effects[selectedStyle];
      const styleUrl = styleData.gcsUrl || styleData.dataUrl || '';

      if (styleUrl) {
        // Populate hidden field
        const urlField = document.querySelector(`[data-pet-processed-url="${i}"]`);
        if (urlField) {
          urlField.value = styleUrl;
          console.log(`✅ Pet ${i} processed URL set: ${styleUrl.substring(0, 60)}...`);
        }
      } else {
        console.warn(`⚠️ Pet ${i} style "${selectedStyle}" has no URL`);
      }
    } else {
      console.warn(`⚠️ Pet ${i} missing effect data for style "${selectedStyle}"`);
    }

    // Extract original filename from file input (NEW FUNCTIONALITY)
    const fileInput = document.querySelector(`[data-pet-file-input="${i}"]`);
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const filename = fileInput.files[0].name;
      const filenameField = document.querySelector(`[data-pet-filename="${i}"]`);
      if (filenameField) {
        filenameField.value = filename;
        console.log(`✅ Pet ${i} filename set: ${filename}`);
      }
    }
  }

  return true; // Success
}

// Hook into form submission (FIND EXISTING FORM SUBMIT HANDLER AND ADD THIS CALL)
// Look for something like:
//   form.addEventListener('submit', function(e) { ... });
// ADD inside that handler, BEFORE form submission:
//   if (!populateSelectedStyleUrls()) {
//     console.error('❌ Failed to populate style URLs');
//     // Don't block submission - let it proceed with validation errors
//   }
```

**Location 3: Integrate with Existing Form Submission**

**FIND**: Existing form submission handler (search for `submit` event listener)

**EXPECTED PATTERN** (lines may vary):
```javascript
productForm.addEventListener('submit', function(event) {
  event.preventDefault();

  // Existing validation logic here...

  // ADD NEW CALL HERE (before final submission):
  populateSelectedStyleUrls();

  // Rest of submission logic...
  this.submit();
});
```

---

## Part 3: Fields to KEEP (No Changes)

### 3.1 Properties That Should NOT Be Modified

| Property Name | Location | Reason to Keep | Notes |
|--------------|----------|----------------|-------|
| `Pet 1/2/3 Name` | Lines 70-72 | Required for personalization | Already working ✅ |
| `Pet 1/2/3 Images` | Lines 108-113 | Shopify file upload (original image) | Already working ✅ |
| `Pet 1/2/3 Order Number` | Lines 134-138 | For returning customers (per pet) | Already working ✅ |
| `Style` | Lines 154-257 | Selected style name (B&W/Color/Modern/Sketch) | Already working ✅ |
| `Font` | Lines 270-352 | Selected font (Preppy/Classic/etc.) | Already working ✅ |
| `Pet 1/2/3 Order Type` | Line 360 | Distinguishes new vs returning customer | Already working ✅ |
| `Pet 1/2/3 Processing State` | Line 361 | Tracks upload/processing status | May be used ✅ |
| `Pet 1/2/3 Upload Timestamp` | Line 362 | Timestamp for troubleshooting | May be used ✅ |

### 3.2 System Properties to Preserve

**Do NOT modify**:
- Pet name input fields (data-pet-name-input)
- Style radio buttons (data-style-radio)
- Font radio buttons (data-font-radio)
- File input elements (data-pet-file-input)
- Pet count selector (data-pet-count-radio)
- Existing validation logic for above fields

---

## Part 4: Implementation Order

### Phase 1: Discovery & Audit (1-2 hours)

**Goal**: Understand current state and confirm assumptions

1. **Search for Redundant Properties** (30 min)
   ```bash
   # In Git Bash or terminal
   cd "c:\Users\perki\OneDrive\Desktop\Perkie\Perkie-Gemini"

   # Search new selector for old property names
   grep -n "_has_custom_pet\|_original_image_url\|_effect_applied\|_font_style\|_previous_order_number\|_is_repeat_customer" snippets/ks-product-pet-selector-stitch.liquid

   # Expected: Zero results (new selector doesn't use these)
   ```

2. **Verify New Selector Independence** (30 min)
   - Confirm `ks-product-pet-selector-stitch.liquid` does NOT include cart-pet-integration.js
   - Search for `<script src` or `asset_url | script_tag` in new selector
   - Confirm all JavaScript is inline in Liquid file (likely yes)

3. **Map Form Submission Flow** (30 min)
   - Read JavaScript section (lines ~1200-1900)
   - Identify form submission handler
   - Document current validation logic
   - Identify where to insert `populateSelectedStyleUrls()` call

4. **Test localStorage Data Structure** (30 min)
   - Use Chrome DevTools on test URL
   - Upload test image and process
   - Inspect localStorage: `perkie_pet_*` keys
   - Verify structure matches expected:
     ```javascript
     {
       petId: "...",
       effects: {
         enhancedblackwhite: { gcsUrl: "https://..." },
         color: { gcsUrl: "https://..." },
         modern: { gcsUrl: "https://..." },
         sketch: { gcsUrl: "https://..." }
       }
     }
     ```

**Checkpoint**: Document findings in session context before proceeding

### Phase 2: Add Hidden Fields (30 min)

**Goal**: Add new hidden input fields for processed URLs and filenames

1. **Backup Current File**
   ```bash
   cp snippets/ks-product-pet-selector-stitch.liquid snippets/ks-product-pet-selector-stitch.liquid.backup
   ```

2. **Add Hidden Fields** (15 min)
   - Location: After line 363 (after existing hidden fields)
   - Add 6 new hidden inputs (3 for URLs, 3 for filenames)
   - Use provided code snippet from Section 2.3 Location 1

3. **Verify HTML Structure** (15 min)
   - Deploy to test environment
   - Inspect DOM in Chrome DevTools
   - Confirm hidden fields exist with correct attributes:
     - `data-pet-processed-url="1"`, `data-pet-processed-url="2"`, etc.
     - `data-pet-filename="1"`, `data-pet-filename="2"`, etc.

**Checkpoint**: Hidden fields exist but values still empty

### Phase 3: Implement JavaScript Logic (2-3 hours)

**Goal**: Add function to populate hidden fields before form submission

1. **Add `populateSelectedStyleUrls()` Function** (1 hour)
   - Location: In `<script>` section (after line ~1650, before form handler)
   - Copy provided code from Section 2.3 Location 2
   - Adjust localStorage key pattern if needed (based on Phase 1 findings)

2. **Integrate with Form Submission** (30 min)
   - FIND: Existing form submit handler (search for `addEventListener('submit'`)
   - ADD: Call to `populateSelectedStyleUrls()` BEFORE form submission
   - VERIFY: Function returns true/false for error handling

3. **Add Console Logging** (30 min)
   - Ensure comprehensive logging for debugging:
     - Selected style
     - Active pet count
     - Each pet's name, localStorage key, found data
     - Populated URLs and filenames
     - Any errors or missing data

4. **Test Locally in HTML File** (1 hour)
   - Create test file: `testing/test-style-url-population.html`
   - Mock localStorage data structure
   - Mock form submission
   - Verify function correctly reads and populates fields
   - Test edge cases:
     - No style selected
     - Missing pet name
     - Missing localStorage data
     - Partial pet data (1 of 3 pets has data)

**Checkpoint**: Function works in isolated test, ready for integration testing

### Phase 4: Integration Testing (2-3 hours)

**Goal**: Test complete user flow in real Shopify environment

**CRITICAL**: Use Chrome DevTools MCP with Shopify test URL (ask user for current URL)

1. **Test Single Pet Flow** (45 min)
   - Select 1 pet
   - Enter pet name
   - Upload image
   - Click Preview → Process image
   - Return to product page
   - Select style (e.g., "Modern")
   - Select font
   - Click "Add to Cart"
   - **VERIFY**:
     - Console logs show correct function execution
     - Hidden fields populated with correct values
     - Cart API (`/cart.js`) shows properties:
       - `Pet 1 Name`: "Buddy"
       - `Pet 1 Processed Image URL`: "https://storage.googleapis.com/..."
       - `Pet 1 Filename`: "IMG_1234.jpg"
       - `Style`: "modern"
       - `Font`: "classic"

2. **Test Multi-Pet Flow** (45 min)
   - Select 3 pets
   - Enter names for all 3
   - Upload images for all 3 (requires 3 separate Preview sessions)
   - Return to product page (state should restore)
   - Select style (applies to all 3)
   - Select font (applies to all 3)
   - Click "Add to Cart"
   - **VERIFY**:
     - All 3 pets have processed URLs populated
     - All 3 pets have filenames populated
     - Single style applies to all (expected behavior)

3. **Test Edge Cases** (45 min)
   - **No style selected**: Should trigger validation (existing logic)
   - **No pet image uploaded**: Should trigger validation (existing logic)
   - **localStorage cleared mid-session**:
     - Should log warning
     - Should not block submission (file upload still happens)
   - **Style changed after image processing**:
     - Upload image
     - Process with "Modern" style
     - Return to product page
     - Select "Sketch" style instead
     - VERIFY: Sketch URL populated (not Modern URL)

4. **Test Returning Customer Flow** (45 min)
   - Check "Use Existing Perkie Print" for Pet 1
   - Enter previous order number
   - VERIFY:
     - No file upload required
     - No processed URL required (customer reusing old design)
     - Order number captured correctly

**Checkpoint**: All user flows work correctly, data captured as expected

### Phase 5: Order Verification (1 hour)

**Goal**: Verify data appears correctly in Shopify orders

1. **Complete Test Purchase** (30 min)
   - Use test payment method
   - Complete checkout
   - Get order number

2. **Inspect Order Properties** (30 min)
   - Open order in Shopify admin (or use test order API)
   - VERIFY line_item.properties includes:
     - ✅ `Pet 1 Name`: "Buddy"
     - ✅ `Pet 1 Processed Image URL`: "https://storage.googleapis.com/..."
     - ✅ `Pet 1 Filename`: "IMG_1234.jpg"
     - ✅ `Style`: "modern"
     - ✅ `Font`: "classic"
     - ❌ NO `_has_custom_pet` (removed)
     - ❌ NO `_original_image_url` (removed)
     - ❌ NO `_effect_applied` (removed)
     - ❌ NO `_font_style` (removed - use `Font` instead)
     - ❌ NO `_previous_order_number` (use `Pet X Order Number` instead)
     - ❌ NO `_is_repeat_customer` (removed)

**Success Criteria**: Order contains all new fields, none of old redundant fields

---

## Part 5: Rollback Plan

### If Critical Issues Found After Deployment

**Symptoms of Failure**:
- Processed URLs not captured in orders
- Orders missing critical data for fulfillment
- JavaScript errors blocking "Add to Cart"
- localStorage quota errors

### Immediate Rollback Steps

1. **Revert to Previous Commit** (5 min)
   ```bash
   git log --oneline -5  # Find commit before changes
   git revert <commit-hash>  # Revert specific commit
   git push origin main  # Auto-deploy to Shopify
   ```

2. **Alternative: Manual Revert** (15 min)
   - Restore backup file:
     ```bash
     cp snippets/ks-product-pet-selector-stitch.liquid.backup snippets/ks-product-pet-selector-stitch.liquid
     git add snippets/ks-product-pet-selector-stitch.liquid
     git commit -m "ROLLBACK: Restore pet selector to working state"
     git push origin main
     ```

3. **Verify Rollback** (10 min)
   - Test "Add to Cart" functionality
   - Verify no JavaScript errors
   - Confirm orders still capture data (even if redundant)

### Debugging Before Rollback

**If issues found but not critical**, debug first:

1. **Check Console Logs**
   - Open Chrome DevTools console
   - Look for 🔍/✅/⚠️/❌ log messages from `populateSelectedStyleUrls()`
   - Identify which step is failing

2. **Check localStorage**
   - DevTools → Application → Local Storage
   - Search for `perkie_pet_*` keys
   - Verify structure matches expected (effects object exists)

3. **Check Hidden Field Values**
   - DevTools → Elements → Search for `data-pet-processed-url`
   - Inspect value attribute (should be GCS URL after function runs)

4. **Check Cart API**
   - Fetch `/cart.js` after adding to cart
   - Inspect `line_items[0].properties`
   - Verify new properties exist

---

## Part 6: Testing Checklist

### Pre-Deployment Testing (Local HTML)

- [ ] `populateSelectedStyleUrls()` function parses localStorage correctly
- [ ] Function handles missing pet name gracefully
- [ ] Function handles missing localStorage data gracefully
- [ ] Function extracts correct style URL based on selected radio button
- [ ] Function extracts filename from file input
- [ ] Function populates hidden fields correctly
- [ ] Console logs provide clear debugging information

### Integration Testing (Shopify Test URL)

**Single Pet Flow**:
- [ ] Upload image → Process → Return to product page
- [ ] Select style (B&W/Color/Modern/Sketch)
- [ ] Select font (or No Text)
- [ ] Add to cart
- [ ] Verify `/cart.js` properties include:
  - [ ] `Pet 1 Name`
  - [ ] `Pet 1 Processed Image URL` (GCS URL)
  - [ ] `Pet 1 Filename`
  - [ ] `Style`
  - [ ] `Font`

**Multi-Pet Flow (2 Pets)**:
- [ ] Upload 2 images → Process both → Return
- [ ] Select style (applies to both)
- [ ] Select font (applies to both)
- [ ] Add to cart
- [ ] Verify both pets have processed URLs
- [ ] Verify both pets have filenames

**Multi-Pet Flow (3 Pets)**:
- [ ] Upload 3 images → Process all → Return
- [ ] Select style (applies to all)
- [ ] Select font (applies to all)
- [ ] Add to cart
- [ ] Verify all 3 pets have processed URLs
- [ ] Verify all 3 pets have filenames

**Returning Customer Flow**:
- [ ] Check "Use Existing Perkie Print"
- [ ] Enter previous order number
- [ ] Add to cart
- [ ] Verify order number captured
- [ ] Verify no processed URL required (customer reusing design)

**Edge Cases**:
- [ ] No style selected → Validation error (existing logic)
- [ ] No font selected (on font-enabled product) → Validation error (existing logic)
- [ ] localStorage cleared → Graceful warning, submission not blocked
- [ ] File input empty → Validation error (existing logic)
- [ ] Style changed after processing → Correct style URL used

**Browser Compatibility**:
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Mobile Safari (iPhone)
- [ ] Chrome (Android)
- [ ] Edge (desktop)

**Console Verification**:
- [ ] No JavaScript errors
- [ ] All console logs show expected values
- [ ] localStorage structure matches expected

### Order Verification (Shopify Admin)

- [ ] Complete test purchase (single pet)
- [ ] Complete test purchase (multi-pet)
- [ ] Inspect order properties in Shopify admin
- [ ] Verify new properties present:
  - [ ] `Pet 1/2/3 Processed Image URL`
  - [ ] `Pet 1/2/3 Filename`
- [ ] Verify old properties ABSENT:
  - [ ] ❌ `_has_custom_pet`
  - [ ] ❌ `_original_image_url`
  - [ ] ❌ `_effect_applied`
  - [ ] ❌ `_font_style`
  - [ ] ❌ `_previous_order_number`
  - [ ] ❌ `_is_repeat_customer`

### Fulfillment Staff Testing

- [ ] Share test order with fulfillment staff
- [ ] Verify they can access processed image URL
- [ ] Verify they can identify original filename
- [ ] Verify they have all info needed to fulfill order
- [ ] Gather feedback on any missing data

---

## Part 7: Risk Assessment

### Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation |
|------|-----------|--------|----------|------------|
| **localStorage structure different than expected** | MEDIUM | HIGH | 🟡 MEDIUM-HIGH | Phase 1 audit confirms structure before implementation |
| **Function doesn't execute on form submit** | LOW | HIGH | 🟡 MEDIUM | Comprehensive logging + test in isolated HTML first |
| **Style URL missing for selected style** | MEDIUM | HIGH | 🟡 MEDIUM-HIGH | Fallback to dataUrl if gcsUrl missing + log warning |
| **Filename capture fails on some file types** | LOW | MEDIUM | 🟢 LOW | Use `files[0].name` (works for all types) |
| **Multi-pet localStorage keys don't match** | HIGH | MEDIUM | 🟡 MEDIUM-HIGH | Test multi-pet flow extensively in Phase 4 |
| **Old selector still in use on some products** | LOW | LOW | 🟢 LOW | Only modify new selector, old selector unaffected |
| **Returning customer flow breaks** | LOW | MEDIUM | 🟢 LOW | Test extensively, preserve existing order number logic |
| **Mobile performance degradation** | LOW | LOW | 🟢 LOW | Function is lightweight, runs once on submit |

### Critical Assumptions

**ASSUMPTION 1**: localStorage key format is `perkie_pet_{petName}`
- **Validation**: Inspect localStorage in Phase 1
- **Risk**: If wrong, function won't find data
- **Mitigation**: Adjust key construction based on findings

**ASSUMPTION 2**: Pet Processor stores all 4 style URLs in effects object
- **Validation**: Inspect localStorage after processing in Phase 1
- **Risk**: If structure different, extraction fails
- **Mitigation**: Add fallback logic for missing styles

**ASSUMPTION 3**: New selector has inline JavaScript, no external dependencies
- **Validation**: Review file structure in Phase 1
- **Risk**: If uses external JS, changes may need to span multiple files
- **Mitigation**: Identify dependencies early, adjust plan accordingly

**ASSUMPTION 4**: Style selection is global (applies to all pets)
- **Validation**: Confirm in UI and existing property structure
- **Risk**: If per-pet styles needed, logic becomes much more complex
- **Mitigation**: This seems correct based on current UI (single style selector)

**ASSUMPTION 5**: GCS URLs are available when customer returns to product page
- **Validation**: Test upload → process → return flow in Phase 1
- **Risk**: If upload is async and incomplete, URLs may be missing
- **Mitigation**: Add fallback to dataUrl, log warning

---

## Part 8: Data Migration Concerns

### Existing Carts

**Question**: What happens to carts created BEFORE this change?

**Analysis**:
- Carts created before deployment have old property structure
- When customer checks out, old properties will be in order
- NEW selectors won't affect old carts (cart data already stored)

**Decision**: NO MIGRATION NEEDED
- Old carts will complete with old properties (no harm)
- New carts will use new property structure
- Both are acceptable for fulfillment (we can handle both formats)

### Existing Orders

**Question**: Should we update old orders to new format?

**Analysis**:
- Old orders already fulfilled → No need to update
- Old orders pending fulfillment → May benefit from new data
- Updating orders is complex and risky

**Decision**: NO RETROACTIVE UPDATES
- Keep old orders as-is with old property structure
- Fulfillment staff can handle both formats
- Document differences in fulfillment guide

### localStorage Compatibility

**Question**: What happens to existing localStorage data?

**Analysis**:
- Existing pets in localStorage use current structure
- New function reads existing structure → should work
- No localStorage schema change needed

**Decision**: NO CLEANUP REQUIRED
- Existing localStorage data compatible with new logic
- Function reads what's already there
- No migration script needed

---

## Part 9: Success Metrics

### Immediate Success (Day 1)

- [ ] **Zero JavaScript errors** in console after deployment
- [ ] **100% of test orders** contain new properties
- [ ] **0% of test orders** contain old redundant properties
- [ ] **All test flows pass** (single, multi-pet, returning customer)

### Short-Term Success (Week 1)

- [ ] **Zero fulfillment issues** related to missing data
- [ ] **Fulfillment staff confirm** they have all needed information
- [ ] **No customer complaints** about checkout process
- [ ] **No "incomplete order" reports** from fulfillment

### Long-Term Success (Month 1)

- [ ] **Data analysis confirms** all orders have processed URLs
- [ ] **Fulfillment time reduced** (staff have direct image links)
- [ ] **Remake rate stable or decreased** (correct images printed)
- [ ] **Zero rollbacks** needed due to data issues

---

## Part 10: Timeline Estimate

### Optimistic Timeline (6 hours)
- Phase 1 (Discovery): 1 hour
- Phase 2 (Hidden Fields): 20 min
- Phase 3 (JavaScript): 1.5 hours
- Phase 4 (Integration Testing): 2 hours
- Phase 5 (Order Verification): 30 min
- Documentation: 30 min

### Realistic Timeline (8 hours)
- Phase 1 (Discovery): 1.5 hours (unexpected findings, additional research)
- Phase 2 (Hidden Fields): 30 min (deployment + verification)
- Phase 3 (JavaScript): 2.5 hours (debugging, edge cases)
- Phase 4 (Integration Testing): 2.5 hours (multiple test cycles)
- Phase 5 (Order Verification): 1 hour (complete purchase + inspection)
- Documentation: 30 min

### Pessimistic Timeline (12 hours)
- Phase 1 (Discovery): 2 hours (localStorage structure different, requires research)
- Phase 2 (Hidden Fields): 1 hour (unexpected DOM issues)
- Phase 3 (JavaScript): 4 hours (major debugging, multiple iterations)
- Phase 4 (Integration Testing): 3 hours (multiple failures, fixes needed)
- Phase 5 (Order Verification): 1 hour
- Bug fixes and refinement: 1 hour

**Recommended**: Allocate 8-10 hours for implementation + testing + contingency

---

## Part 11: File Modification Summary

### Files to MODIFY

| File | Changes | Lines Affected | Risk |
|------|---------|---------------|------|
| `snippets/ks-product-pet-selector-stitch.liquid` | Add 6 hidden fields | +12 lines (after line 363) | 🟢 LOW |
| `snippets/ks-product-pet-selector-stitch.liquid` | Add JavaScript function | +80 lines (in `<script>` section) | 🟡 MEDIUM |
| `snippets/ks-product-pet-selector-stitch.liquid` | Modify form submit handler | ~5 lines (add function call) | 🟡 MEDIUM |
| `assets/cart-pet-integration.js` | **NO CHANGES** (old selector only) | 0 lines | 🟢 NONE |

### Files to DELETE

**NONE** - All changes are additive or removals within existing files

### Files to CREATE

| File | Purpose | Risk |
|------|---------|------|
| `testing/test-style-url-population.html` | Local testing of new function | 🟢 NONE (test only) |

---

## Part 12: Documentation Updates Needed

After implementation complete:

1. **Update Order Data Capture Analysis**
   - File: `.claude/doc/order-data-capture-analysis.md`
   - Section 2.3: Update to reflect new properties
   - Section 2.1: Remove redundant properties
   - Section 7: Update data flow diagram

2. **Update CLAUDE.md**
   - Section on order properties (if exists)
   - Known issues (remove any related to old properties)

3. **Create Fulfillment Guide**
   - NEW FILE: `.claude/doc/fulfillment-order-properties-guide.md`
   - Explain all properties and their purpose
   - Show example order with annotations
   - List old vs new property mappings

4. **Update Session Context**
   - File: `.claude/tasks/context_session_001.md`
   - Document implementation details
   - Link to commit hashes
   - Record any issues encountered and solutions

---

## Part 13: Final Notes & Considerations

### Why This Approach?

**Additive First**: We ADD new fields before removing old ones (if both existed)
- Benefit: Zero data loss risk during transition
- Drawback: Brief period of redundant data (acceptable)

**New Selector Only**: We ONLY modify the new selector, not the old one
- Benefit: Zero risk to existing products using old selector
- Drawback: Two systems coexist temporarily (acceptable, old will be phased out)

**Client-Side Logic**: We populate URLs in JavaScript, not server-side
- Benefit: No Liquid limitations, direct localStorage access
- Drawback: Requires JavaScript enabled (already required for current flow)

### Alternative Approaches Considered

**Alternative 1: Capture All 4 Style URLs**
- Capture all 4 processed URLs regardless of selection
- Fulfillment staff picks correct one based on Style property
- **Rejected**: Unnecessary data bloat, confusing for staff

**Alternative 2: Server-Side URL Population**
- Store style URLs in Shopify metafields
- Populate from server side during checkout
- **Rejected**: Overly complex, requires backend changes, metafield limits

**Alternative 3: Modify Old Selector Too**
- Update both old and new selectors simultaneously
- **Rejected**: Unnecessary risk, old selector being phased out

### Future Improvements

**Post-Launch Enhancements** (not in this scope):

1. **Validate URL Format**
   - Add regex check for GCS URL format
   - Block submission if URL invalid or missing
   - Currently: We log warning but don't block

2. **Cache Bust URLs**
   - Add `?v={timestamp}` to GCS URLs
   - Prevent CDN caching issues
   - Currently: URLs are static (may be fine)

3. **Thumbnail Preview in Cart**
   - Show selected style thumbnail in cart
   - Uses the populated URL
   - Currently: Cart display was removed (by design)

4. **Image Quality Validation**
   - Check if URL is accessible (HEAD request)
   - Verify image dimensions meet minimum
   - Currently: We trust the URL exists

---

## Summary

**This plan updates the NEW pet selector ONLY** to:
1. ❌ **Remove** 6 redundant properties (none currently in new selector)
2. ✅ **Add** selected style URL capture (1 URL per pet based on Style selection)
3. ✅ **Add** original filename capture (1 filename per pet)
4. ✅ **Keep** all existing working properties (Style, Font, Pet Order Number)

**Risk Level**: MEDIUM-HIGH (data flow changes, new JavaScript)
**Timeline**: 8-10 hours (discovery + implementation + testing)
**Rollback**: Simple (git revert or restore backup file)

**Next Step**: User approval to proceed with Phase 1 (Discovery & Audit)

---

**Document Version**: 1.0
**Created**: 2025-11-04
**Author**: project-manager-ecommerce agent
**Review Required**: Solution verification auditor, code quality reviewer, debug specialist
