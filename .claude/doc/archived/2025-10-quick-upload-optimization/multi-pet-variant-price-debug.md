# Multi-Pet Variant Price Update Bug - Root Cause Analysis

**Date**: 2025-10-20
**Status**: ROOT CAUSE IDENTIFIED
**Priority**: HIGH - Blocking multi-pet pricing functionality

---

## Problem Statement

When users enter multiple pet names in the pet name input field (e.g., "Bella, Milo"), the product variant does not auto-select to reflect the multi-pet pricing, and the price does not update accordingly.

**Expected Behavior:**
- User enters "Bella, Milo" (2 pets) → Auto-select "2 Pets" variant → Price updates to +$5
- User enters "Bella, Milo, Max" (3 pets) → Auto-select "3 Pets" variant → Price updates to +$10

**Actual Behavior:**
- User enters "Bella, Milo" → Nothing happens → Price stays at base (1 pet)

---

## Root Cause Analysis

### Investigation Summary

After thorough code investigation, I have identified **the root cause**:

**There is NO event listener on the pet name input field (`#pet-name-input-{{ section.id }}`) that triggers variant updates when the user types pet names.**

### Evidence

1. **Pet Name Input Exists** (Lines 82-100 in `ks-product-pet-selector.liquid`)
   - Input field: `id="pet-name-input-{{ section.id }}"`
   - Placeholder: "e.g., Bella, Milo, Max"
   - No JavaScript event listener attached to this element

2. **Variant Update Function Exists** (Lines 2862-2950 in `ks-product-pet-selector.liquid`)
   - Function: `updateVariantForPetCount(petCount)`
   - This function correctly:
     - Maps pet count to variant text ("1 Pet", "2 Pets", "3 Pets")
     - Finds the correct radio button/select option
     - Triggers the variant change
   - **BUT**: This function is ONLY called from `updatePetPricing()` (line 2858)

3. **updatePetPricing() Call Chain** (Lines 2814-2859)
   - Called when: `selectedPetsData.length` changes (line 2820)
   - `selectedPetsData` is updated when: User clicks to SELECT a processed pet from the pet selector UI (lines 3125-3183)
   - **NOT called when**: User types in the pet name input field

4. **Quick Upload Handler** (`assets/quick-upload-handler.js`)
   - This file validates that pet names match file count (lines 122-132)
   - It parses comma-separated names correctly
   - **BUT**: It does NOT trigger variant updates - only validates and displays upload status

### The Missing Link

The system has these working pieces:
1. ✅ Pet name input field
2. ✅ Comma-separated name parsing logic (in quick-upload-handler.js)
3. ✅ Variant selection function (`updateVariantForPetCount`)
4. ✅ Pricing update function (`updatePetPricing`)

**What's missing:**
❌ Event listener on pet name input that:
   - Counts comma-separated pet names
   - Calls `updateVariantForPetCount(petCount)` or `updatePetPricing()`

---

## Current Flow vs. Required Flow

### Current Flow (Broken)
```
User types "Bella, Milo"
  → No event listener
  → Nothing happens
  → Variant stays at "1 Pet"
  → Price stays at base
```

### Required Flow (Fix)
```
User types "Bella, Milo"
  → Input event listener fires
  → Parse comma-separated names
  → Count = 2
  → Call updateVariantForPetCount(2)
  → Select "2 Pets" variant
  → Price updates to base + $5
```

---

## Implementation Plan

### Solution Overview
Add an event listener to the pet name input field that:
1. Monitors `input` or `change` events
2. Parses comma-separated pet names (reuse existing logic from quick-upload-handler.js)
3. Counts valid pet names (trimmed, non-empty)
4. Calls `updatePetPricing()` which internally calls `updateVariantForPetCount()`

### File to Modify
**File**: `snippets/ks-product-pet-selector.liquid`

### Specific Changes

#### Change 1: Add Pet Name Input Event Listener

**Location**: Inside the `initPetSelector()` function, after line 1862 (after `saveEffectsToLocalStorage()` call)

**Add this code block**:
```javascript
// Monitor pet name input for multi-pet variant updates
var petNameInput = document.getElementById('pet-name-input-' + sectionId);
if (petNameInput) {
  // Debounce function to avoid excessive calls
  var petNameDebounceTimer;

  petNameInput.addEventListener('input', function(e) {
    clearTimeout(petNameDebounceTimer);

    petNameDebounceTimer = setTimeout(function() {
      var petNameValue = petNameInput.value.trim();

      // Parse comma-separated names (same logic as quick-upload-handler.js)
      var petNames = petNameValue.split(',')
        .map(function(n) { return n.trim(); })
        .filter(function(n) { return n.length > 0; });

      var petCount = petNames.length;

      console.log('🐾 Pet name input changed:', {
        rawValue: petNameValue,
        parsedNames: petNames,
        count: petCount
      });

      // Update variant and pricing if we have at least 1 pet name
      if (petCount > 0) {
        // Temporarily update selectedPetsData count to trigger pricing
        // (This is a placeholder until actual pet selection happens)
        var previousCount = selectedPetsData.length;

        // Call updateVariantForPetCount directly with the name count
        updateVariantForPetCount(petCount);

        // Also update pricing display (if pricing function checks selectedPetsData)
        // We need to ensure updatePetPricing uses the name count, not selectedPetsData.length
        updatePetPricing();
      }
    }, 500); // 500ms debounce
  });

  console.log('✅ Pet name input event listener attached');
}
```

#### Change 2: Modify updatePetPricing() to Use Pet Name Count

**Location**: Line 2814, function `updatePetPricing()`

**Current code**:
```javascript
function updatePetPricing() {
  var pricingContainer = document.getElementById('pet-pricing-' + sectionId);
  var basePriceEl = document.getElementById('base-price-' + sectionId);
  var feeElement = document.getElementById('pet-fee-display-' + sectionId);
  var totalElement = document.getElementById('total-price-' + sectionId);

  var selectedCount = selectedPetsData.length;  // <-- PROBLEM: Only uses selected pet count
  // ... rest of function
```

**Modified code**:
```javascript
function updatePetPricing() {
  var pricingContainer = document.getElementById('pet-pricing-' + sectionId);
  var basePriceEl = document.getElementById('base-price-' + sectionId);
  var feeElement = document.getElementById('pet-fee-display-' + sectionId);
  var totalElement = document.getElementById('total-price-' + sectionId);

  // MODIFIED: Use pet name count OR selected pet count, whichever is higher
  var selectedCount = selectedPetsData.length;
  var petNameInput = document.getElementById('pet-name-input-' + sectionId);
  var nameCount = 0;

  if (petNameInput && petNameInput.value.trim()) {
    var petNames = petNameInput.value.trim().split(',')
      .map(function(n) { return n.trim(); })
      .filter(function(n) { return n.length > 0; });
    nameCount = petNames.length;
  }

  // Use the higher of the two counts (in case user enters names before selecting pets)
  var effectiveCount = Math.max(selectedCount, nameCount);

  console.log('💰 updatePetPricing:', {
    selectedCount: selectedCount,
    nameCount: nameCount,
    effectiveCount: effectiveCount
  });

  // Continue with rest of function using effectiveCount instead of selectedCount
  var basePrice = parseFloat(petSelector.dataset.productPrice) / 100;
  var additionalFee = 0;

  if (effectiveCount <= 1) {
    feeElement.style.display = 'none';
    additionalFee = 0;
  } else if (effectiveCount === 2) {
    additionalFee = 5.00;
    feeElement.textContent = '+ $5.00 (additional pet)';
    feeElement.style.display = 'inline';
  } else if (effectiveCount >= 3) {
    additionalFee = 10.00;
    feeElement.textContent = '+ $10.00 (2 additional pets)';
    feeElement.style.display = 'inline';
  } else {
    feeElement.style.display = 'none';
  }

  var total = basePrice + additionalFee;
  totalElement.textContent = '$' + total.toFixed(2);

  if (effectiveCount >= 2) {
    pricingContainer.style.display = 'block';
    pricingContainer.classList.add('multiple-pets');
    pricingContainer.classList.remove('single-pet');
  } else {
    pricingContainer.style.display = 'none';
    pricingContainer.classList.remove('single-pet', 'multiple-pets');
  }

  // Update variant using effectiveCount
  updateVariantForPetCount(effectiveCount);
}
```

---

## Testing Plan

### Test Case 1: Two Pet Names
1. Navigate to a custom product page
2. Enter "Bella, Milo" in pet name input
3. **Expected**:
   - Variant auto-selects to "2 Pets"
   - Price shows base price + $5.00
   - Console shows: `🐾 Pet name input changed: {count: 2}`

### Test Case 2: Three Pet Names
1. Enter "Bella, Milo, Max" in pet name input
2. **Expected**:
   - Variant auto-selects to "3 Pets"
   - Price shows base price + $10.00
   - Console shows: `🐾 Pet name input changed: {count: 3}`

### Test Case 3: Back to One Pet
1. Clear input
2. Enter "Bella"
3. **Expected**:
   - Variant auto-selects to "1 Pet"
   - Price shows base price (no additional fee)
   - Pricing container hidden

### Test Case 4: Debouncing
1. Type "Bella, M" (pause mid-word)
2. **Expected**: No update until user stops typing for 500ms
3. Complete to "Bella, Milo"
4. **Expected**: After 500ms, variant updates to "2 Pets"

### Test Case 5: Invalid Input
1. Enter "Bella,  , Milo" (empty name between commas)
2. **Expected**: Count = 2 (empty strings filtered out)
3. Variant selects "2 Pets"

---

## Edge Cases & Considerations

### 1. User Flow Scenarios

**Scenario A: Express Upload (Quick Upload)**
- User enters "Bella, Milo" → Variant updates → Uploads files → Adds to cart
- ✅ Pricing will be correct at checkout

**Scenario B: Standard (AI Preview)**
- User enters "Bella" → Processes with AI → Comes back to product page
- ❓ **Question**: Should variant stay at "1 Pet" or update if they add more names later?
- **Answer**: Variant should follow the pet name count in real-time

**Scenario C: Returning Customer**
- User already has processed pets in localStorage
- User enters "Bella, Milo" in name input
- ✅ Variant should update based on name count, regardless of selected pets

### 2. Conflict Resolution

**What if selectedPetsData.length ≠ nameCount?**

Example:
- User has 1 processed pet selected (selectedPetsData.length = 1)
- User enters "Bella, Milo, Max" (nameCount = 3)
- Which count should win?

**Proposed Logic**: Use `Math.max(selectedCount, nameCount)`
- Rationale: User's intent in the name field is more current
- If they're typing 3 names, they plan to add 3 pets eventually
- Variant should reflect the higher count for accurate pricing

### 3. Debouncing

**Why 500ms?**
- Prevents excessive variant updates while user is typing
- Balances responsiveness with performance
- Avoids triggering Shopify's variant change handler dozens of times

**Alternative**: Use `change` event instead of `input` event
- Triggers only when user leaves the field (blur)
- Less responsive but fewer updates
- **Recommendation**: Stick with debounced `input` for better UX

### 4. Multi-Variant Products

**Question**: What if product has other variant options besides pet count?
- Example: Size (S, M, L) + Pet Count (1, 2, 3)

**Answer**: Current `updateVariantForPetCount()` only targets the pet count dimension
- It searches for labels containing "1 Pet", "2 Pets", "3 Pets"
- Other variant dimensions remain unchanged
- ✅ Should work correctly

### 5. Validation

**Should we validate name count matches file count before allowing add to cart?**
- This is ALREADY handled in `quick-upload-handler.js` (lines 127-132)
- Validation happens when user selects files, not when typing names
- ✅ No additional validation needed in the input listener

---

## Assumptions

1. **Product Variants Exist**: Products have "1 Pet", "2 Pets", "3 Pets" variants configured in Shopify
2. **Naming Convention**: Variant labels use exact text "1 Pet", "2 Pets", "3 Pets" (case-insensitive match)
3. **Comma Separator**: Pet names are separated by commas (consistent with placeholder text)
4. **Pricing Tiers**:
   - 1 Pet: Base price (no additional fee)
   - 2 Pets: Base price + $5.00
   - 3+ Pets: Base price + $10.00

---

## Risks & Mitigation

### Risk 1: Variant Not Found
**Scenario**: Product doesn't have "2 Pets" variant
**Impact**: Variant won't update, price stays at base
**Mitigation**:
- `updateVariantForPetCount()` already handles this gracefully (fails silently)
- Add console warning if variant not found
- Fallback: Show manual variant selector

### Risk 2: Infinite Loop with Variant Sync
**Scenario**: `updateVariantForPetCount()` triggers variant change → variant change listener updates pet count → triggers `updateVariantForPetCount()` again
**Impact**: Browser freeze, infinite loop
**Mitigation**:
- Existing `window.variantSyncDisabled` flag (line 2866) prevents this
- Already implemented in current code
- ✅ No additional work needed

### Risk 3: Debounce Delay Feels Laggy
**Scenario**: 500ms feels too slow for users
**Impact**: Poor UX, feels unresponsive
**Mitigation**:
- Test with 500ms first
- If too slow, reduce to 300ms
- If still issues, consider using `change` event instead

### Risk 4: Name Parsing Edge Cases
**Scenario**: User enters "Bella,Milo" (no space), or "Bella , , Milo" (multiple commas)
**Impact**: Incorrect pet count
**Mitigation**:
- Existing parsing logic handles this (`.trim()` and `.filter()`)
- Empty strings are filtered out
- ✅ Already robust

---

## Alternative Solutions Considered

### Alternative 1: Only Update on Blur
**Approach**: Listen to `blur` event instead of `input`
**Pros**: Fewer updates, simpler logic
**Cons**: Less responsive, user must click away from input to see price change
**Decision**: REJECTED - Poor UX for dynamic pricing

### Alternative 2: Parse Names on Quick Upload Button Click
**Approach**: Only count names when user clicks "Quick Upload"
**Pros**: Simpler implementation
**Cons**: Price doesn't update until user tries to upload, confusing UX
**Decision**: REJECTED - Users need to see price before committing to upload

### Alternative 3: Sync selectedPetsData with Pet Names
**Approach**: Automatically create placeholder entries in `selectedPetsData` for each name
**Pros**: Keeps all logic in one place (`updatePetPricing` doesn't need modification)
**Cons**:
- Pollutes `selectedPetsData` with non-existent pets
- Complicates cart integration (adds pets that don't have images)
- Can cause cart errors if user adds to cart before processing
**Decision**: REJECTED - Too complex, error-prone

---

## Questions for User (if any)

### Question 1: Should Pricing Update Immediately or on Blur?
- **Immediate (debounced `input`)**: Price updates as user types (after 500ms pause)
- **On Blur (`change`)**: Price updates when user clicks away from input field

**Recommendation**: Immediate (debounced `input`) for better UX

### Question 2: What if Pet Name Count < Selected Pet Count?
Example:
- User has 3 processed pets selected
- User edits name input to "Bella" (1 name)
- Should variant drop to "1 Pet" or stay at "3 Pets"?

**Current Plan**: Use `Math.max()` - keep at "3 Pets"
**Alternative**: Use name count always - drop to "1 Pet"

**Recommendation**: Use `Math.max()` to avoid unexpected price drops

---

## Next Steps

1. **Implement** the two code changes outlined above
2. **Deploy** to staging environment
3. **Test** all test cases on staging URL
4. **Monitor** console logs for any errors
5. **Verify** pricing matches expectations at checkout
6. **Deploy** to production after successful staging tests

---

## Related Files

- `snippets/ks-product-pet-selector.liquid` (PRIMARY - contains all logic)
- `assets/quick-upload-handler.js` (reference for name parsing logic)
- `assets/cart-pet-integration.js` (cart integration - may need updates)

---

## Success Criteria

✅ User enters "Bella, Milo" → Variant auto-selects "2 Pets" within 500ms
✅ Price updates to show +$5.00 additional fee
✅ User enters "Bella, Milo, Max" → Variant selects "3 Pets", price shows +$10.00
✅ User clears to "Bella" → Variant selects "1 Pet", no additional fee
✅ Console shows clear debug logs for troubleshooting
✅ No infinite loops or performance issues
✅ Works on mobile and desktop browsers
✅ Debouncing prevents excessive API calls

---

**End of Root Cause Analysis & Implementation Plan**
