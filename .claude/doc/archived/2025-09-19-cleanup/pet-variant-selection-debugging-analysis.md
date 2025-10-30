# Pet Variant Selection Debugging Root Cause Analysis

## Problem Summary

The `updateVariantForPetCount` function exists and is exposed globally but:
1. **Not being called automatically** when pets are selected
2. **Manual calls work but don't update variants**
3. **Console shows "Pet selected for cart integration"** which isn't in pet selector code

## Root Cause Analysis

### Issue 1: Function Not Being Called Automatically ❌

**Expected Flow**:
1. User clicks pet thumbnail → `selectPet()` called 
2. `selectPet()` calls `updatePetPricing()` (line 2346)
3. `updatePetPricing()` calls `updateVariantForPetCount()` (line 2089)

**Actual Flow**:
✅ Step 1: Pet selection works (console shows "Pet selected for cart integration")
✅ Step 2: `updatePetPricing()` is called
❌ Step 3: `updateVariantForPetCount()` is NOT called or exits early

### Issue 2: Why Function Exits Early

**Critical Discovery**: The function has two early exit conditions:

#### Exit Condition 1: Sync Lock (lines 2095-2098)
```javascript
if (window.variantSyncDisabled) {
  console.log('⏸️ Variant update skipped (sync in progress)');
  return;
}
```
**Hypothesis**: `window.variantSyncDisabled` may be set to `true` and never reset.

#### Exit Condition 2: No Variant Selector Found (lines 2101-2102)
```javascript
var variantSelector = document.querySelector('select[name="id"], input[name="id"][type="radio"], .product-form__input select');
if (!variantSelector) return;
```
**Hypothesis**: The variant selector query isn't finding the right elements on product pages.

### Issue 3: Console Message Source Mystery ✅ SOLVED

**Mystery**: "Pet selected for cart integration" message not in pet selector code.

**Solution Found**: Message comes from `snippets/buy-buttons.liquid:175`
- This confirms pet selection events ARE working
- The `petSelected` CustomEvent is being dispatched correctly (line 2352-2358)
- Buy buttons are receiving the event properly

## Diagnostic Steps Required

### Step 1: Check Sync Lock Status
```javascript
// Run in console during pet selection
console.log('variantSyncDisabled status:', window.variantSyncDisabled);
```

### Step 2: Verify Variant Selector Exists
```javascript
// Run in console on product page
var variantSelector = document.querySelector('select[name="id"], input[name="id"][type="radio"], .product-form__input select');
console.log('Found variant selector:', variantSelector);
console.log('Selector type:', variantSelector?.tagName);
```

### Step 3: Add Debug Logging to Function
Add console.log at key points to trace execution:

```javascript
function updateVariantForPetCount(petCount) {
  console.log('🔥 updateVariantForPetCount called with:', petCount);
  
  if (window.variantSyncDisabled) {
    console.log('⏸️ Variant update skipped (sync in progress)');
    return;
  }
  console.log('✅ Sync lock check passed');
  
  var variantSelector = document.querySelector('select[name="id"], input[name="id"][type="radio"], .product-form__input select');
  if (!variantSelector) {
    console.log('❌ No variant selector found');
    return;
  }
  console.log('✅ Found variant selector:', variantSelector);
  
  // ... rest of function
}
```

### Step 4: Test Manual Function Call with Debugging
```javascript
// Clear sync lock if it exists
window.variantSyncDisabled = false;

// Call with debug
window.updateVariantForPetCount(2);
```

## Likely Root Causes (Ranked by Probability)

### 1. HIGH: Variant Selector Not Found (90% confidence)
**Problem**: The CSS selector isn't matching the actual variant elements on the product page.

**Common Issues**:
- Product uses different form structure than expected
- Variant inputs have different names/IDs than standard
- Elements are dynamically generated after page load

**Fix Strategy**: Update selector to match actual product page HTML structure.

### 2. MEDIUM: Sync Lock Stuck True (60% confidence)  
**Problem**: `window.variantSyncDisabled` is set to true somewhere and never reset.

**Evidence**: Function has sync lock mechanism but may have race condition.

**Fix Strategy**: Add proper sync lock cleanup and timeout.

### 3. LOW: Race Condition with DOM (30% confidence)
**Problem**: Function runs before variant elements are fully loaded.

**Fix Strategy**: Add DOM ready check or retry mechanism.

## Implementation Plan

### Phase 1: Immediate Debugging (15 minutes)
1. Add console.log statements to trace execution
2. Check variant selector availability
3. Verify sync lock status
4. Test with cleared sync lock

### Phase 2: Variant Selector Fix (30 minutes)
1. Inspect actual product page HTML structure
2. Update CSS selector to match real elements
3. Add fallback selectors for different product types
4. Test variant selection works

### Phase 3: Sync Lock Improvement (20 minutes)
1. Add timeout for sync lock (prevent permanent lock)
2. Add proper cleanup on function completion
3. Add debugging for sync lock state changes

### Phase 4: Robustness Improvements (15 minutes)
1. Add retry mechanism for DOM race conditions
2. Add error handling for malformed variant data
3. Add validation for variant text matching

## Expected Outcomes

After fixes:
1. ✅ Console shows "🔥 updateVariantForPetCount called with: X"
2. ✅ Console shows "Selected variant for X pet(s): [variant name]"
3. ✅ Variant selector updates when pets selected
4. ✅ Product price changes reflect multi-pet fees
5. ✅ URL updates with correct variant ID

## Testing Commands

### Debug Current State
```javascript
// Check all key components
console.log('Function exists:', typeof window.updateVariantForPetCount);
console.log('Sync disabled:', window.variantSyncDisabled);
console.log('Selector found:', document.querySelector('select[name="id"], input[name="id"][type="radio"], .product-form__input select'));
console.log('Pet count:', window.selectedPetsData?.length || 0);
```

### Force Function Execution
```javascript
// Clear locks and force execution
window.variantSyncDisabled = false;
window.updateVariantForPetCount(2);
```

### Verify Variant Structure
```javascript
// Inspect actual form structure
console.log('All name="id" elements:', document.querySelectorAll('[name="id"]'));
console.log('Product form:', document.querySelector('.product-form, form[action*="/cart/add"]'));
```

## Files to Modify

1. **snippets/ks-product-pet-selector.liquid** (lines 2093-2143)
   - Add debug logging
   - Fix variant selector query
   - Improve sync lock handling

## Success Criteria

- ✅ Function called automatically when pets selected
- ✅ Function completes without early exits  
- ✅ Console shows all debug messages in correct order
- ✅ Variant selection updates product price/URL
- ✅ Manual function calls work correctly

## Risk Assessment: VERY LOW
- Changes are debugging/logging additions only
- No functionality removal or breaking changes
- Easy rollback capability
- Isolated to single function

## Time Estimate: 1.5 hours total
- Investigation: 30 minutes
- Implementation: 45 minutes  
- Testing: 15 minutes