# Order #35891 OLD Properties Root Cause Analysis

**Date**: 2025-11-05
**Order**: #35891 (placed Nov 5, 2025 at 2:52 PM)
**Severity**: CRITICAL - Production bug affecting order fulfillment
**Status**: ROOT CAUSE IDENTIFIED

---

## Problem Summary

Order #35891 shows OLD property names instead of NEW property names after we completed aggressive cleanup of the legacy property system:

**OLD properties in order** (SHOULD NOT EXIST):
- `_original_image_url`
- `_processed_image_url`
- `_pet_name`
- `_effect_applied`
- `_artist_notes`
- `_has_custom_pet: false`

**Expected NEW properties** (MISSING):
- `Pet 1 Name`
- `Pet 1 Images`
- `Style`
- `Font`
- `Pet 1 Processed Image URL`
- `Artist Notes`

---

## Timeline Analysis

| Time | Event | Commit/Action |
|------|-------|---------------|
| 10:25 AM | Disabled OLD property JavaScript creation | `d996001` |
| 2:21 PM | Removed legacy selector + OLD creation functions | `6d3f724` |
| 2:25 PM | Added artist notes to NEW selector | `cb94d24` |
| 2:52 PM | **Order #35891 placed with OLD properties** | 🚨 BUG |

**Critical Observation**: Order was placed 27 minutes AFTER cleanup commits were pushed to `origin/main`.

---

## Root Cause Identified

### THE SMOKING GUN: `snippets/buy-buttons.liquid`

The cleanup commit `6d3f724` removed ~450 lines of JavaScript that **dynamically created** OLD property fields, BUT there are **hardcoded static HTML inputs** in `snippets/buy-buttons.liquid` that were **never removed**.

**Location**: `snippets/buy-buttons.liquid` lines 62-69

```liquid
<!-- Pet Image Line Item Properties (Hidden) -->
<!-- Direct Google Cloud Storage URLs for employee access -->
<input type="hidden" name="properties[_original_image_url]" id="original-url-{{ section.id }}" value="">
<input type="hidden" name="properties[_processed_image_url]" id="processed-url-{{ section.id }}" value="">

<!-- Pet and processing metadata -->
<input type="hidden" name="properties[_pet_name]" id="pet-name-{{ section.id }}" value="">
<input type="hidden" name="properties[_effect_applied]" id="effect-applied-{{ section.id }}" value="">
<input type="hidden" name="properties[_artist_notes]" id="artist-notes-{{ section.id }}" value="">
<input type="hidden" name="properties[_has_custom_pet]" id="has-custom-pet-{{ section.id }}" value="false">
```

**Used by**:
- `sections/main-product.liquid` line 485 (renders buy-buttons)
- `sections/featured-product.liquid` (also renders buy-buttons)

**NEW selector status**:
- `sections/main-product.liquid` line 466 renders `ks-product-pet-selector-stitch` (NEW selector)
- NEW selector creates its own properties (Pet 1 Name, Style, Font, etc.)
- Both OLD and NEW property inputs exist in the SAME form

---

## How The Bug Occurs

### Execution Flow:

1. **Page Load**: `main-product.liquid` renders product page
2. **Render NEW selector**: Line 466 renders `ks-product-pet-selector-stitch.liquid`
   - Creates NEW property inputs: `properties[Pet 1 Name]`, `properties[Style]`, etc.
3. **Render buy buttons**: Line 485 renders `buy-buttons.liquid`
   - Creates OLD property inputs: `properties[_pet_name]`, `properties[_has_custom_pet]`, etc.
4. **User interaction**: User fills out pet selector (NEW system)
   - JavaScript populates NEW properties with values
   - OLD properties remain with default values (empty strings or "false")
5. **Form submission**: POST to `/cart/add`
   - Shopify receives BOTH property sets
   - OLD properties have priority or are listed first in form order
   - Result: Order shows OLD properties with default/empty values

### Why Cleanup Failed:

The cleanup commit `6d3f724` focused on:
- ✅ Deleting `snippets/ks-product-pet-selector.liquid` (legacy selector file)
- ✅ Removing JavaScript functions that created OLD properties dynamically
- ✅ Updating `order-custom-images.liquid` to display NEW properties
- ❌ **MISSED**: Static HTML inputs in `buy-buttons.liquid` that create OLD properties

**Analysis Error**: We searched for dynamic property creation in JavaScript (`createElement`, `appendChild`, field population) but did not search for static HTML property declarations in Liquid templates.

---

## Evidence Chain

### 1. Cleanup Commit Analysis

```bash
$ git show 6d3f724 --stat
assets/cart-pet-integration.js          |  299 ---
snippets/ks-product-pet-selector.liquid | 3520 -------------------------------
snippets/order-custom-images.liquid     |  149 +-
4 files changed, 350 insertions(+), 3878 deletions(-)
```

**What was removed**:
- 299 lines from `cart-pet-integration.js` (functions: `updateFormFields`, `clearFormFields`, etc.)
- 3520 lines from `ks-product-pet-selector.liquid` (entire file deleted)
- 149 lines changed in `order-custom-images.liquid` (rewritten for NEW properties)

**What was NOT touched**:
- ❌ `snippets/buy-buttons.liquid` (no changes)

### 2. Current State Verification

```bash
$ grep "properties\[_" snippets/buy-buttons.liquid
62: <input type="hidden" name="properties[_original_image_url]" ...>
63: <input type="hidden" name="properties[_processed_image_url]" ...>
66: <input type="hidden" name="properties[_pet_name]" ...>
67: <input type="hidden" name="properties[_effect_applied]" ...>
68: <input type="hidden" name="properties[_artist_notes]" ...>
69: <input type="hidden" name="properties[_has_custom_pet]" ...>
```

All 6 OLD property inputs still exist in production code.

### 3. cart-pet-integration.js Residual Code

Lines 201-224 in `cart-pet-integration.js` contain **validation code** (not creation code) that checks for OLD properties:

```javascript
// OLD SELECTOR: Legacy support for ks-product-pet-selector.liquid
else {
  var petNameInput = document.querySelector('[name="properties[_pet_name]"]');
  var hasCustomPetField = document.querySelector('[name="properties[_has_custom_pet]"]');

  // Check if we have either pet image OR pet name
  var hasPetImage = hasCustomPetField && hasCustomPetField.value === 'true';
  var hasPetName = petNameInput && petNameInput.value.trim() !== '';
```

This code **reads** OLD properties (for validation) but does NOT create them. The inputs exist because `buy-buttons.liquid` puts them in the HTML.

---

## Why Order #35891 Has OLD Properties

**Most Likely Scenario**:

1. User loaded product page at 2:50 PM (before Shopify deployed changes)
2. Page contained OLD property inputs from `buy-buttons.liquid`
3. User filled out pet selector and submitted order at 2:52 PM
4. Form submitted with OLD properties (empty values or defaults)
5. Shopify recorded OLD properties in order

**Alternative Scenario**:

1. Cleanup commits were pushed to GitHub at 2:21 PM and 2:25 PM
2. GitHub → Shopify auto-deploy takes 2-5 minutes typically
3. Deployment completed around 2:26-2:30 PM
4. BUT: User's browser had page cached from BEFORE deployment
5. Cached page contained OLD property inputs
6. User submitted order at 2:52 PM with cached OLD properties

**Deployment Timing Question**:

We need to verify WHEN Shopify actually deployed commit `cb94d24`:
- Committed: 2:25 PM
- Order placed: 2:52 PM (27 minutes later)
- Expected deploy time: 2-5 minutes
- Expected deployment: 2:27-2:30 PM

If deployment completed by 2:30 PM, then the user likely had a cached page from before deployment.

---

## Complete Code Path That Created OLD Properties

### Step-by-Step Execution:

**File 1**: `sections/main-product.liquid`
```liquid
{%- when 'custom' -%}
  {% render 'ks-product-pet-selector-stitch', product: product, section: section, block: block %}
  <!-- Creates: Pet 1 Name, Style, Font, Pet 1 Images, Artist Notes -->
```

**File 2**: `sections/main-product.liquid` (same file, later in template)
```liquid
{%- when 'buy_buttons' -%}
  {%- render 'buy-buttons',
    block: block,
    product: product,
    product_form_id: product_form_id,
    section_id: section.id,
    show_pickup_availability: true
  -%}
```

**File 3**: `snippets/buy-buttons.liquid` (rendered by step 2)
```liquid
<input type="hidden" name="properties[_pet_name]" id="pet-name-{{ section.id }}" value="">
<input type="hidden" name="properties[_has_custom_pet]" id="has-custom-pet-{{ section.id }}" value="false">
<!-- ... 4 more OLD property inputs ... -->
```

**Result**: Single product form contains BOTH property sets:
- NEW properties from `ks-product-pet-selector-stitch.liquid`
- OLD properties from `buy-buttons.liquid`

When form submits to `/cart/add`, Shopify processes all properties. If OLD properties are listed first in HTML order, they may take precedence or both sets may be sent.

---

## Why We Missed This

### Analysis Gaps in Cleanup Process:

1. **Focused on JavaScript, not Liquid templates**:
   - Searched for `createElement`, `appendChild`, field creation functions
   - Did NOT search for static `<input name="properties[_` in Liquid files

2. **Assumed buy-buttons.liquid was "safe"**:
   - File name suggests it only handles button rendering
   - Did not suspect it contained property creation logic
   - Never reviewed its contents during cleanup

3. **Did not test end-to-end after cleanup**:
   - Cleanup commits pushed without placing a test order
   - Would have caught this immediately if we tested actual order submission

4. **Session context incomplete**:
   - Session context (lines 345-505) documented property removal from `cart-pet-integration.js`
   - Did NOT mention searching Liquid templates for static property inputs
   - Did NOT include `buy-buttons.liquid` in files analyzed

---

## Impact Assessment

### Orders Affected:
- **All orders placed after cleanup commits** (Nov 5, 2025 2:25 PM onwards)
- **Until buy-buttons.liquid is fixed**

### Data Integrity:
- Orders show OLD property names with default/empty values
- NEW property data may be present but not visible in fulfillment view
- Staff cannot see pet customization details (name, style, font)

### Fulfillment Risk:
- **CRITICAL**: Staff may fulfill orders incorrectly without pet data
- Artist notes missing (quality/style preferences not communicated)
- Order type unknown (new vs. returning customer)

---

## Fix Implementation Plan

### Phase 1: Immediate Fix (30 minutes)

**Goal**: Remove OLD property inputs from `buy-buttons.liquid`

**File**: `snippets/buy-buttons.liquid`

**Changes**:
```diff
-        <!-- Pet Image Line Item Properties (Hidden) -->
-        <!-- Direct Google Cloud Storage URLs for employee access -->
-        <input type="hidden" name="properties[_original_image_url]" id="original-url-{{ section.id }}" value="">
-        <input type="hidden" name="properties[_processed_image_url]" id="processed-url-{{ section.id }}" value="">
-
-        <!-- Pet and processing metadata -->
-        <input type="hidden" name="properties[_pet_name]" id="pet-name-{{ section.id }}" value="">
-        <input type="hidden" name="properties[_effect_applied]" id="effect-applied-{{ section.id }}" value="">
-        <input type="hidden" name="properties[_artist_notes]" id="artist-notes-{{ section.id }}" value="">
-        <input type="hidden" name="properties[_has_custom_pet]" id="has-custom-pet-{{ section.id }}" value="false">
```

**Test**:
1. Deploy change to Shopify test environment
2. Load product page with pet selector
3. Fill out pet customization (name, style, font)
4. Add to cart
5. Inspect cart data (`/cart.js`) to verify:
   - NEW properties present (Pet 1 Name, Style, Font)
   - OLD properties NOT present (_pet_name, _has_custom_pet)
6. Complete test order
7. Verify order shows NEW properties in Shopify admin

### Phase 2: Verify No Other Static Inputs (1 hour)

**Goal**: Ensure no other files contain hardcoded OLD property inputs

**Search Commands**:
```bash
# Search all Liquid files for OLD property inputs
grep -r 'properties\[_pet_name\]' snippets/ sections/ templates/
grep -r 'properties\[_has_custom_pet\]' snippets/ sections/ templates/
grep -r 'properties\[_effect_applied\]' snippets/ sections/ templates/
grep -r 'properties\[_original_image_url\]' snippets/ sections/ templates/
grep -r 'properties\[_processed_image_url\]' snippets/ sections/ templates/
grep -r 'properties\[_artist_notes\]' snippets/ sections/ templates/
grep -r 'properties\[_font_style\]' snippets/ sections/ templates/
grep -r 'properties\[_order_type\]' snippets/ sections/ templates/
```

**Expected Results**:
- After Phase 1 fix: ZERO matches for OLD property inputs
- If matches found: Document and remove in same commit

### Phase 3: Clean Up cart-pet-integration.js Validation Code (2 hours)

**Goal**: Remove OLD selector validation code (lines 201-224)

**Justification**:
- OLD selector deleted (ks-product-pet-selector.liquid removed in 6d3f724)
- OLD property inputs deleted (buy-buttons.liquid fixed in Phase 1)
- Validation code is now dead code (OLD properties no longer exist)

**File**: `assets/cart-pet-integration.js`

**Changes**:
```diff
-      // OLD SELECTOR: Legacy support for ks-product-pet-selector.liquid
-      else {
-        var petNameInput = document.querySelector('[name="properties[_pet_name]"]');
-        var hasCustomPetField = document.querySelector('[name="properties[_has_custom_pet]"]');
-
-        // Check if we have either pet image OR pet name
-        var hasPetImage = hasCustomPetField && hasCustomPetField.value === 'true';
-        var hasPetName = petNameInput && petNameInput.value.trim() !== '';
-
-        if (hasPetImage || hasPetName) {
-          this.enableAddToCart();
-        } else {
-          this.disableAddToCart();
-        }
-
-        // ... (rest of OLD validation code, ~24 lines)
-      }
```

**Impact**:
- Simplifies validation logic (only NEW selector path remains)
- Removes ~50 lines of dead code
- Eliminates false positives (validation looking for fields that don't exist)

### Phase 4: Update Documentation (30 minutes)

**Files to Update**:
1. `.claude/tasks/context_session_001.md`
   - Add root cause analysis summary
   - Document buy-buttons.liquid fix
   - Update cleanup completion status

2. `CLAUDE.md` (if relevant)
   - Add note about checking Liquid templates during cleanup
   - Document static vs. dynamic property creation

3. Create runbook: `.claude/doc/order-properties-troubleshooting-guide.md`
   - How to verify property capture
   - How to debug missing order data
   - Common pitfalls (static HTML inputs, cached pages, deployment timing)

---

## Prevention Strategies

### For Future Cleanups:

1. **Search both JavaScript AND Liquid files**:
   ```bash
   # JavaScript: Dynamic property creation
   grep -r 'createElement.*input' assets/
   grep -r 'name.*properties\[' assets/

   # Liquid: Static property inputs
   grep -r '<input.*properties\[' snippets/ sections/ templates/
   grep -r 'name=.*properties\[' snippets/ sections/ templates/
   ```

2. **Test end-to-end before declaring cleanup complete**:
   - Place actual test order
   - Verify order properties in Shopify admin
   - Check fulfillment view displays correctly

3. **Document all files analyzed**:
   - Session context should list EVERY file reviewed
   - Explicitly state "searched Liquid templates: found X files"
   - Include negative results ("no matches found in sections/")

4. **Use Chrome DevTools MCP for testing**:
   - Inspect form inputs before submission
   - Check `/cart.js` response after add-to-cart
   - Verify property names match expectations

5. **Deployment verification**:
   - After pushing commits, wait 5-10 minutes for Shopify deployment
   - Clear browser cache and reload page
   - Verify changes are live before considering task complete

---

## Lessons Learned

### Technical Lessons:

1. **Property creation can be static OR dynamic**:
   - JavaScript: `createElement`, `appendChild`, field population
   - Liquid: `<input type="hidden" name="properties[...]">`
   - Both paths must be checked during cleanup

2. **Shopify theme architecture**:
   - `sections/main-product.liquid` orchestrates multiple snippets
   - `buy-buttons.liquid` is NOT just for buttons (contains form inputs)
   - Multiple snippets can create properties in same form

3. **Cleanup commits should be atomic**:
   - Remove ALL references to OLD system in single commit
   - Don't assume "disabled" JavaScript means properties won't be created
   - Static HTML inputs can bypass JavaScript entirely

### Process Lessons:

1. **Grep is not enough**:
   - Searched for JavaScript patterns (`createElement`, `updateFormFields`)
   - Did NOT search for Liquid patterns (`<input name="properties[_`)
   - Need to search BOTH languages during cleanup

2. **Test assumptions**:
   - Assumed cleanup was complete based on code review
   - Should have placed test order immediately after deploy
   - Would have caught bug within 5 minutes

3. **Session context needs negative evidence**:
   - Document what was NOT found, not just what was changed
   - Example: "Searched 47 Liquid files, found 0 static OLD property inputs"
   - Helps catch false negatives

---

## Immediate Next Steps

1. **Deploy Phase 1 fix immediately** (remove OLD properties from buy-buttons.liquid)
2. **Place test order** to verify fix works
3. **Check recent orders** (Nov 5 2:25 PM - present) for data integrity
4. **Contact affected customers** if order data is incomplete
5. **Execute Phase 2-4** (verification, cleanup, documentation)

---

## Files Referenced

### Modified in Cleanup (6d3f724, cb94d24):
- `assets/cart-pet-integration.js` (removed 299 lines, but validation code remains)
- `snippets/ks-product-pet-selector.liquid` (DELETED)
- `snippets/order-custom-images.liquid` (rewritten for NEW properties)
- `snippets/ks-product-pet-selector-stitch.liquid` (added Artist Notes)

### NOT Modified (ROOT CAUSE):
- ❌ `snippets/buy-buttons.liquid` (contains 6 OLD property inputs, lines 62-69)

### Uses buy-buttons.liquid:
- `sections/main-product.liquid` (line 485)
- `sections/featured-product.liquid`

### Session Context:
- `.claude/tasks/context_session_001.md` (lines 345-505: cleanup work log)
- `.claude/tasks/archived/context_session_2025-11-05_dynamic-pricing-variant-integration.md`

---

## Success Criteria

### Fix is complete when:

1. ✅ `buy-buttons.liquid` has NO OLD property inputs (lines 62-69 removed)
2. ✅ Grep search for `properties\[_` returns ZERO matches in Liquid files
3. ✅ Test order placed with NEW selector shows ONLY NEW properties
4. ✅ Fulfillment view displays all pet data correctly (name, style, font, URLs, notes)
5. ✅ No JavaScript errors in console related to missing OLD property fields
6. ✅ `cart-pet-integration.js` validation code cleaned up (OLD selector path removed)
7. ✅ Session context updated with root cause and fix details
8. ✅ Documentation created for future troubleshooting

---

## Conclusion

**ROOT CAUSE**: Hardcoded OLD property inputs in `snippets/buy-buttons.liquid` (lines 62-69) were never removed during cleanup commit `6d3f724`. These static HTML inputs create OLD properties that override/coexist with NEW properties, resulting in orders showing OLD property names with empty values.

**FIX**: Remove lines 62-69 from `buy-buttons.liquid`, verify no other static inputs exist, clean up residual validation code, test end-to-end.

**PREVENTION**: Always search BOTH JavaScript and Liquid files during property cleanup, test with actual orders before declaring cleanup complete, document negative search results in session context.

**TIMELINE**: Critical bug caused by incomplete cleanup analysis. Order #35891 placed 27 minutes after cleanup commits, indicating either deployment delay or browser cache caused user to submit form with OLD properties.

**IMPACT**: All orders from Nov 5 2:25 PM onwards may show OLD properties until fix is deployed. Staff may lack pet customization data needed for fulfillment. Immediate fix required.
