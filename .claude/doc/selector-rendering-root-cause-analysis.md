# Pet Selector Rendering Root Cause Analysis

**Date**: 2025-11-05
**Issue**: Test order #35888 shows OLD field names instead of NEW field names from stitch selector
**Symptom**: Order properties show `_pet_name`, `_effect_applied` instead of `Pet 1 Name`, `Style`

---

## Root Cause: CONFIRMED

**The stitch selector IS rendering in production, but it's NOT being used for order data capture.**

### Critical Discovery

1. **Current Production State** (Commit c09daf0):
   ```liquid
   {% render 'ks-product-pet-selector-stitch', product: product, section: section, block: block %}
   ```
   - The stitch selector IS rendering on product pages
   - It replaced the old selector in commit b5b5fcc (Nov 3, 2025)
   - This change is LIVE in production (confirmed by recent commits)

2. **Field Names in Each Selector**:

   **OLD Selector** (`ks-product-pet-selector.liquid`):
   ```liquid
   name="properties[_pet_name]"           <!-- Line 89 -->
   name="properties[_effect_applied]"     <!-- Hidden field -->
   name="properties[_processed_image_url]"
   name="properties[_original_image_url]"
   name="properties[_artist_notes]"
   ```

   **NEW Stitch Selector** (`ks-product-pet-selector-stitch.liquid`):
   ```liquid
   name="properties[Pet {{ i }} Name]"           <!-- Line 70 -->
   name="properties[Pet {{ i }} Images]"         <!-- Line 108 -->
   name="properties[Pet {{ i }} Order Number]"   <!-- Line 137 -->
   name="properties[Style]"                      <!-- Lines 154, 181, 208, 235 -->
   name="properties[Font]"                       <!-- Lines 271, 287, 301, 315, 329, 343 -->
   ```

3. **Order Data Reality**:
   ```
   Order #35888 shows:
   ✗ _pet_name: "Franky"
   ✗ _effect_applied: "enhancedblackwhite"

   Expected from stitch selector:
   ✓ Pet 1 Name: "Franky"
   ✓ Style: "Black & White" (or similar)
   ```

---

## Problem: Two Parallel Data Capture Systems

### The Disconnect

The stitch selector is rendering, but **cart-pet-integration.js** is still using OLD field names:

**File**: `assets/cart-pet-integration.js` (Lines ~60-150)

```javascript
// This code still populates OLD field names
var petNameField = form.querySelector('[name="properties[_pet_name]"]');
petNameField.value = petData.name || '';

var processedUrlField = form.querySelector('[name="properties[_processed_image_url]"]');
processedUrlField.value = petData.gcsUrl || petData.processedImage;

var originalUrlField = form.querySelector('[name="properties[_original_image_url]"]');
originalUrlField.value = petData.originalUrl || '';

var artistNotesField = form.querySelector('[name="properties[_artist_notes]"]');
artistNotesField.value = petData.artistNote || '';

var effectField = form.querySelector('[name="properties[_effect_applied]"]');
effectField.value = petData.effect || '';
```

### Why This Happens

The old selector was integrated with a JavaScript system that:
1. Listens for `pet:selected` event
2. Populates hidden form fields with OLD names
3. These fields are submitted to Shopify

The stitch selector has its OWN form fields with NEW names, but:
- The old JavaScript system still runs
- It still populates the OLD fields
- The NEW fields from stitch selector are NOT populated
- Both sets of fields exist in the form simultaneously

---

## Evidence Trail

### Git History Confirms Stitch Selector Is Live

```bash
b5b5fcc (Nov 3, 2025) - Switch to new Stitch UI pet selector on product pages
         Changed: {% render 'ks-product-pet-selector-stitch' %}

c09daf0 (Latest)     - Update from Shopify for theme perkie-gemini/main
         Still uses: {% render 'ks-product-pet-selector-stitch' %}
```

The stitch selector has been live since Nov 3, and all subsequent commits (including recent Nov 5 updates) maintain this rendering.

### Field Name Comparison

| Field Purpose | OLD Selector | NEW Stitch Selector | Order #35888 Shows |
|--------------|-------------|---------------------|-------------------|
| Pet Name | `_pet_name` | `Pet 1 Name` | `_pet_name` ✓ OLD |
| Effect | `_effect_applied` | `Style` | `_effect_applied` ✓ OLD |
| Processed Image | `_processed_image_url` | `Pet 1 Images` | Not in screenshot |
| Original Image | `_original_image_url` | N/A | Not in screenshot |
| Font | N/A | `Font` | Not in screenshot |

### Conclusion

**The OLD JavaScript system (cart-pet-integration.js) is capturing data into OLD field names, even though the stitch selector is rendering with NEW field names.**

---

## Verification Steps

### 1. Check Product Page DOM

Open product page in browser, inspect form:

```javascript
// Check which selector is rendering
document.querySelector('.pet-selector-stitch') !== null  // Should be true
document.querySelector('.ks-pet-selector') !== null      // Should be false or coexist

// Check which form fields exist
document.querySelectorAll('[name^="properties[Pet"]').length     // NEW fields
document.querySelectorAll('[name^="properties[_pet"]').length    // OLD fields
```

**Expected Result**: Both OLD and NEW fields may exist if cart-pet-integration.js is still creating hidden fields.

### 2. Check sections/main-product.liquid

```bash
git show HEAD:sections/main-product.liquid | grep "ks-product-pet-selector"
```

**Expected Output**:
```liquid
{% render 'ks-product-pet-selector-stitch', product: product, section: section, block: block %}
```

### 3. Check If Old Selector Is Also Rendering

Search for any other references:

```bash
grep -r "ks-product-pet-selector.liquid" sections/ snippets/ --exclude="*stitch*"
```

**Expected**: Should find NO references (old selector should not be rendering)

### 4. Check cart-pet-integration.js Status

```javascript
// In browser console on product page
console.log(typeof window.CartPetIntegration);  // Should show "object" or "function"

// Check if event listener is active
document.dispatchEvent(new CustomEvent('pet:selected', {
  detail: { name: 'TEST', effect: 'TEST' }
}));
// Then check if OLD fields got populated
console.log(document.querySelector('[name="properties[_pet_name]"]')?.value);
```

**Expected**: If `_pet_name` field shows "TEST", cart-pet-integration.js is still active.

---

## Selector Rendering Analysis

### Which Selector Is Rendering?

**CONFIRMED**: `ks-product-pet-selector-stitch.liquid`

**Location**: `sections/main-product.liquid` Line 466

```liquid
{% if show_pet_selector %}
  <div class="product__pet-selector" {{ block.shopify_attributes }}>
    {% comment %} Render new Stitch UI pet selector {% endcomment %}
    {% render 'ks-product-pet-selector-stitch', product: product, section: section, block: block %}
```

### How Selector Is Determined

**NOT** by metafields or product templates. It's **hardcoded** in main-product.liquid.

**Selection Logic**:
1. Product must have "custom" tag (case-insensitive check)
2. If tag exists, render stitch selector
3. No conditional logic to choose between old/new selector
4. Old selector is NO LONGER RENDERED anywhere

### Product Template/Metafield Configuration

**Stitch Selector Configuration**:
- **Max Pets**: Reads `product.metafields.custom.max_pets` (default: 1, max: 3)
- **Font Support**: Conditional render of `pet-font-selector` if `product.metafields.custom.supports_font_styles == true`
- **Custom Tag**: Product must have "custom" tag to show selector

**Old Selector Configuration** (no longer used):
- Max Pets: Read from metafield or block settings (default: 1, max: 10)
- Custom Image Fee: Block setting
- Preview Product Variant ID: Block setting

### Deployment Verification Steps

1. **Check GitHub Auto-Deployment**:
   ```bash
   git log --oneline -5
   # Look for "Update from Shopify" commits
   # These indicate successful deployments
   ```

   **Latest Deployment**: Commit c09daf0 "Update from Shopify for theme perkie-gemini/main"

2. **Verify Live Theme File**:
   - Access Shopify Admin > Themes > Customize
   - Navigate to product page with "custom" tag
   - Use browser DevTools to inspect DOM
   - Look for `<div class="pet-selector-stitch">`

3. **Check Form Field Names**:
   ```javascript
   // In browser console on product page
   Array.from(document.querySelectorAll('input[name^="properties"]'))
     .map(input => input.name)
     .forEach(name => console.log(name));
   ```

   **Expected** (if stitch selector is working):
   ```
   properties[Pet 1 Name]
   properties[Pet 1 Images]
   properties[Style]
   properties[Font]
   ```

   **Actual** (if old system is still capturing):
   ```
   properties[_pet_name]
   properties[_processed_image_url]
   properties[_original_image_url]
   properties[_effect_applied]
   properties[_artist_notes]
   ```

---

## Root Cause Summary

### The Problem

**Two data capture systems running in parallel**:

1. **Visual UI**: Stitch selector renders with NEW field names
2. **Data Capture**: cart-pet-integration.js populates OLD field names

### Why It Happens

When switching from old selector to stitch selector:
- ✓ Updated Liquid template to render stitch selector
- ✓ Removed old selector from rendering
- ✗ **MISSED**: Did NOT update cart-pet-integration.js to use new field names
- ✗ **MISSED**: Did NOT remove/disable cart-pet-integration.js

### Impact

- Users see stitch selector UI (correct)
- Users fill out stitch selector fields (correct)
- JavaScript captures data into OLD field names (incorrect)
- NEW field values are IGNORED (incorrect)
- Order shows OLD field names with potentially stale data (incorrect)

---

## Files Requiring Changes

### 1. cart-pet-integration.js (HIGH PRIORITY)

**Current State**: Uses old field names
```javascript
'[name="properties[_pet_name]"]'
'[name="properties[_effect_applied]"]'
```

**Required Change**: Update to new field names
```javascript
'[name="properties[Pet 1 Name]"]'    // For single pet
'[name="properties[Pet 2 Name]"]'    // For multi-pet
'[name="properties[Style]"]'
'[name="properties[Font]"]'
```

### 2. Stitch Selector JavaScript (IF EXISTS)

**Location**: Check if stitch selector has its own JS file

Search for:
```bash
grep -r "pet-selector-stitch" assets/ --include="*.js"
```

**Required**: Ensure stitch selector has proper form submission handling

### 3. Buy Buttons (IF STILL USING OLD FIELDS)

**File**: `snippets/buy-buttons.liquid`

Check if it still creates old hidden fields:
```bash
grep "properties\[_pet" snippets/buy-buttons.liquid
```

**Required**: Remove old hidden fields if stitch selector creates its own

---

## Implementation Plan

See separate document: `.claude/doc/stitch-selector-data-capture-fix-plan.md`

**Priority Tasks**:
1. Audit which form fields are actually being submitted
2. Update cart-pet-integration.js to use new field names
3. Ensure stitch selector properly captures all data
4. Remove/disable old data capture system
5. Test end-to-end: UI → Form → Order

**Estimated Effort**: 3-4 hours implementation + 2 hours testing

---

## Questions for User

1. **Is the stitch selector UI visible on product pages?** (Confirm visual rendering)
2. **Do you see BOTH old and new field names in form when inspecting DOM?**
3. **Is cart-pet-integration.js still loaded on product pages?** (Check Network tab)
4. **Are there any JavaScript errors in console related to pet selection?**
5. **Does the stitch selector have its own JavaScript file for form handling?**

---

## Next Steps

1. ✓ **Confirmed**: Stitch selector is rendering in production
2. ✓ **Identified**: Old JavaScript system still populating old field names
3. **TODO**: Create implementation plan to fix data capture
4. **TODO**: Update cart-pet-integration.js or replace with stitch-specific logic
5. **TODO**: Test in staging environment before deploying

---

## Dependencies

- **Stitch Selector Template**: `snippets/ks-product-pet-selector-stitch.liquid`
- **Old Cart Integration**: `assets/cart-pet-integration.js`
- **Product Template**: `sections/main-product.liquid`
- **Buy Buttons**: `snippets/buy-buttons.liquid`
- **Pet Storage API**: `assets/pet-storage.js`
- **Shopify Line Item Properties**: Native Shopify feature
