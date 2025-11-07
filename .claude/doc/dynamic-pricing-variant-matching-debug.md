# Dynamic Pricing Variant Matching - Debug Analysis & Implementation Plan

**Status**: CRITICAL PRODUCTION ISSUE - Blocking orders
**Created**: 2025-11-05
**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Session**: context_session_001.md

---

## Executive Summary

**Problem**: Pet count selector not updating product price or cart display when user selects different pet counts.

**Impact**:
- Customers see incorrect prices
- Cart shows wrong pet count ("Pets: 1 Pet" when user selected 3 pets)
- Potential revenue loss and order confusion

**Root Cause Categories Identified**:
1. **Data Structure Mismatch**: Variant matching logic assumes incorrect data format
2. **Scope Issue**: Form selector using `.closest()` when pet selector may be outside form
3. **Timing Issue**: `window.ShopifyAnalytics` may not be populated when function runs
4. **Property Name Mismatch**: Cart integration reading wrong line item properties

---

## Console Error Analysis

### Observed Console Errors

```
⚠️ No variant found for '1 Pet'
⚠️ No variant found for '2 Pets'
⚠️ No variant found for '3 Pets'
⚠️ Pet Selector: Could not find cart form (line 2177)
```

### Error Sequence

1. User selects pet count (1, 2, or 3)
2. `updateVariantSelection(petCount)` fires (line 1265)
3. Function attempts to read `window.ShopifyAnalytics.meta.product.variants`
4. **Variant matching fails** → "No variant found" warning
5. Function tries to find form → **Form not found** (line 2177)
6. Price and cart NOT updated
7. Cart displays incorrect data from previous state

---

## Root Cause Investigation

### Issue 1: Shopify Product Data Structure Unknown

**Current Code Assumption** (lines 1283-1288):
```javascript
const petCountText = petCount === 1 ? '1 Pet' : `${petCount} Pets`;
const matchingVariant = variants.find(v => {
  // Check if any variant option matches our pet count text
  return v.option1 === petCountText || v.option2 === petCountText || v.option3 === petCountText;
});
```

**Critical Questions**:
1. What is the ACTUAL structure of `window.ShopifyAnalytics.meta.product.variants`?
2. Are option values stored as `option1`, `option2`, `option3`?
3. Does the text EXACTLY match "1 Pet" / "2 Pets" / "3 Pets"?
4. Is the option name "Pets" stored anywhere in the variant object?
5. When is `window.ShopifyAnalytics` populated (page load vs AJAX)?

**Required Debugging**:
```javascript
// Add BEFORE variant matching logic (line 1275)
console.log('🔍 DEBUG: Full product data:', window.ShopifyAnalytics.meta.product);
console.log('🔍 DEBUG: Variants array:', variants);
console.log('🔍 DEBUG: First variant structure:', variants[0]);
console.log('🔍 DEBUG: Looking for:', petCountText);
```

**Possible Data Structures**:

**Option A - Shopify Standard Format**:
```json
{
  "id": 12345,
  "title": "1 Pet",
  "option1": "1 Pet",
  "option2": null,
  "option3": null,
  "price": 2900
}
```

**Option B - Shopify Verbose Format**:
```json
{
  "id": 12345,
  "title": "1 Pet",
  "options": ["1 Pet"],
  "option_values": [{"name": "Pets", "value": "1 Pet"}],
  "price": 2900
}
```

**Option C - Simplified Format**:
```json
{
  "id": 12345,
  "name": "1 Pet",
  "Pets": "1 Pet",
  "price": 2900
}
```

---

### Issue 2: Form Selector Failing

**Current Code** (line 1296):
```javascript
const form = container.closest('form[action*="/cart/add"]');
```

**Problem**: `.closest()` only traverses UP the DOM tree (parent → grandparent → etc).

**HTML Structure Questions**:
1. Is `.pet-selector-stitch` INSIDE or OUTSIDE the `<form>` tag?
2. Where is the form in the DOM relative to the pet selector?
3. Are there multiple forms on the page?

**Possible DOM Structures**:

**Case A - Pet Selector INSIDE Form** (`.closest()` works):
```html
<form action="/cart/add">
  <div class="pet-selector-stitch">
    <!-- Pet selector content -->
  </div>
  <input type="hidden" name="id" value="">
  <button name="add">Add to Cart</button>
</form>
```

**Case B - Pet Selector OUTSIDE Form** (`.closest()` FAILS):
```html
<div class="pet-selector-stitch">
  <!-- Pet selector content -->
</div>

<form action="/cart/add">
  <input type="hidden" name="id" value="">
  <button name="add">Add to Cart</button>
</form>
```

**Fix for Case B**:
```javascript
// More robust form finder
const form = container.closest('form[action*="/cart/add"]') ||
              document.querySelector('form[action*="/cart/add"]') ||
              container.parentElement.querySelector('form[action*="/cart/add"]');
```

---

### Issue 3: Cart Display Wrong Pet Count

**Observed**: Cart shows "Pets: 1 Pet" when user selected 3 pets

**Possible Causes**:

1. **Old cart-pet-integration.js Still Running**:
   - Previous session documented removal of `cart-pet-thumbnails.js`
   - May still have legacy code populating cart properties

2. **Line Item Properties Not Updated**:
   - Hidden input `properties[Pets]` not being updated
   - Cart reads from line item properties, not variant options

3. **Static Value in Form**:
   - Form may have hardcoded `<input name="properties[Pets]" value="1 Pet">`
   - Variant selection updates variant ID but NOT properties

**Required Investigation**:
```javascript
// Add to updateVariantSelection() function after line 1308
console.log('🔍 DEBUG: Checking for Pets property input...');
const petsPropertyInput = form.querySelector('input[name="properties[Pets]"]');
if (petsPropertyInput) {
  console.log('🔍 DEBUG: Current Pets property value:', petsPropertyInput.value);
  console.log('🔍 DEBUG: Updating to:', petCountText);
  petsPropertyInput.value = petCountText;
} else {
  console.log('⚠️ DEBUG: No properties[Pets] input found - may need to create one');
}
```

---

### Issue 4: Timing - When Does ShopifyAnalytics Populate?

**Question**: Is `window.ShopifyAnalytics.meta.product` available when `updateVariantSelection()` runs?

**Scenarios**:

**Scenario A - Synchronous (Page Load)**:
- Shopify injects analytics data in `<head>` before pet selector loads
- Data should be available immediately
- Current code should work

**Scenario B - Asynchronous (AJAX)**:
- Analytics data loaded via separate request after DOM ready
- Race condition: pet selector initializes before data available
- Need to wait or poll for data

**Fix for Scenario B**:
```javascript
function updateVariantSelection(petCount) {
  // Wait for ShopifyAnalytics if not ready
  if (!window.ShopifyAnalytics || !window.ShopifyAnalytics.meta || !window.ShopifyAnalytics.meta.product) {
    console.warn('⏰ ShopifyAnalytics not ready, retrying in 500ms...');
    setTimeout(() => updateVariantSelection(petCount), 500);
    return;
  }

  // ... rest of function
}
```

---

## Alternative Data Sources for Variant Matching

If `window.ShopifyAnalytics` is unreliable, consider these alternatives:

### Option 1: Liquid-Injected JSON

**Liquid Code** (add to snippet before `<script>` tag):
```liquid
<script>
window.PERKIE_PRODUCT_VARIANTS = {{ product.variants | json }};
</script>
```

**JavaScript**:
```javascript
const variants = window.PERKIE_PRODUCT_VARIANTS ||
                 (window.ShopifyAnalytics?.meta?.product?.variants);
```

### Option 2: Fetch Product JSON

```javascript
async function getProductVariants() {
  const productHandle = window.location.pathname.split('/').pop();
  const response = await fetch(`/products/${productHandle}.js`);
  const product = await response.json();
  return product.variants;
}
```

### Option 3: Read from Existing Variant Picker

```javascript
// If Shopify's native variant picker exists on page
const variantSelect = document.querySelector('[name="id"]');
const selectedOption = variantSelect?.selectedOptions[0];
const variantData = JSON.parse(selectedOption?.dataset.variantData || '{}');
```

---

## Implementation Plan

### Phase 1: Diagnostic Logging (5-10 minutes)

**Goal**: Understand actual data structures before fixing

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Change 1** - Add diagnostic logging (insert after line 1266):
```javascript
function updateVariantSelection(petCount) {
  console.log(`🔄 Updating variant selection for ${petCount} pet(s)...`);

  // DIAGNOSTIC: Log entire ShopifyAnalytics structure
  console.log('🔍 DEBUG: window.ShopifyAnalytics:', window.ShopifyAnalytics);
  console.log('🔍 DEBUG: window.ShopifyAnalytics.meta:', window.ShopifyAnalytics?.meta);
  console.log('🔍 DEBUG: window.ShopifyAnalytics.meta.product:', window.ShopifyAnalytics?.meta?.product);

  // Get product data from global window object (set by Shopify)
  if (!window.ShopifyAnalytics || !window.ShopifyAnalytics.meta || !window.ShopifyAnalytics.meta.product) {
    console.warn('⚠️ Product data not available, cannot update variant');

    // DIAGNOSTIC: Check alternative data sources
    console.log('🔍 DEBUG: Checking alternative sources...');
    console.log('🔍 DEBUG: window.product:', window.product);
    console.log('🔍 DEBUG: window.meta:', window.meta);
    return;
  }

  const productData = window.ShopifyAnalytics.meta.product;
  const variants = productData.variants;

  // DIAGNOSTIC: Log variant structure
  console.log('🔍 DEBUG: Variants array length:', variants.length);
  console.log('🔍 DEBUG: First variant full object:', variants[0]);
  console.log('🔍 DEBUG: All variant titles:', variants.map(v => v.title || v.name || v.option1));

  // ... rest of function
}
```

**Change 2** - Add form finder diagnostic (insert after line 1296):
```javascript
const form = container.closest('form[action*="/cart/add"]');

// DIAGNOSTIC: Log form search results
console.log('🔍 DEBUG: container element:', container);
console.log('🔍 DEBUG: Form found via closest:', form);
console.log('🔍 DEBUG: All forms on page:', document.querySelectorAll('form[action*="/cart/add"]'));

if (!form) {
  console.warn('⚠️ Add-to-cart form not found via .closest()');

  // DIAGNOSTIC: Try alternative selectors
  const formAlt1 = document.querySelector('form[action*="/cart/add"]');
  const formAlt2 = container.parentElement?.querySelector('form[action*="/cart/add"]');
  console.log('🔍 DEBUG: Form via document.querySelector:', formAlt1);
  console.log('🔍 DEBUG: Form via parentElement:', formAlt2);
  return;
}
```

**Change 3** - Add properties diagnostic (insert after line 1308):
```javascript
variantInput.value = matchingVariant.id;
console.log(`✅ Variant updated: ${matchingVariant.name} (ID: ${matchingVariant.id}, Price: $${(matchingVariant.price / 100).toFixed(2)})`);

// DIAGNOSTIC: Check for Pets property input
console.log('🔍 DEBUG: Checking for properties[Pets] input...');
const petsPropertyInput = form.querySelector('input[name="properties[Pets]"]');
if (petsPropertyInput) {
  console.log('🔍 DEBUG: Found properties[Pets], current value:', petsPropertyInput.value);
  console.log('🔍 DEBUG: Updating to:', petCountText);
  petsPropertyInput.value = petCountText;
} else {
  console.log('⚠️ DEBUG: No properties[Pets] input found');
  console.log('🔍 DEBUG: All property inputs:', form.querySelectorAll('input[name^="properties"]'));
}
```

### Phase 2: Fix Based on Diagnostic Results (30-60 minutes)

**After running Phase 1 diagnostics, implement fixes based on findings.**

**Scenario A - Data Structure Mismatch Fix**:
```javascript
// Replace rigid matching (lines 1283-1288) with flexible search
const petCountText = petCount === 1 ? '1 Pet' : `${petCount} Pets`;

// Try multiple matching strategies
const matchingVariant = variants.find(v => {
  // Strategy 1: Check option1/option2/option3 (current approach)
  if (v.option1 === petCountText || v.option2 === petCountText || v.option3 === petCountText) {
    return true;
  }

  // Strategy 2: Check title/name
  if (v.title === petCountText || v.name === petCountText) {
    return true;
  }

  // Strategy 3: Case-insensitive partial match
  const variantStr = JSON.stringify(v).toLowerCase();
  if (variantStr.includes(petCountText.toLowerCase())) {
    return true;
  }

  return false;
});
```

**Scenario B - Form Selector Fix**:
```javascript
// Replace single selector (line 1296) with fallback chain
const form = container.closest('form[action*="/cart/add"]') ||
              document.querySelector('form[action*="/cart/add"]') ||
              container.parentElement?.querySelector('form[action*="/cart/add"]');
```

**Scenario C - Add Missing Properties Input**:
```javascript
// After updating variant ID (line 1308), ensure properties[Pets] exists
variantInput.value = matchingVariant.id;

// Update or create properties[Pets] input
let petsPropertyInput = form.querySelector('input[name="properties[Pets]"]');
if (!petsPropertyInput) {
  petsPropertyInput = document.createElement('input');
  petsPropertyInput.type = 'hidden';
  petsPropertyInput.name = 'properties[Pets]';
  form.appendChild(petsPropertyInput);
  console.log('✅ Created properties[Pets] input');
}
petsPropertyInput.value = petCountText;
console.log(`✅ Properties[Pets] set to: ${petCountText}`);
```

**Scenario D - Timing Fix (ShopifyAnalytics Not Ready)**:
```javascript
// Replace immediate check (line 1269) with retry logic
function updateVariantSelection(petCount, retryCount = 0) {
  console.log(`🔄 Updating variant selection for ${petCount} pet(s)... (attempt ${retryCount + 1})`);

  if (!window.ShopifyAnalytics || !window.ShopifyAnalytics.meta || !window.ShopifyAnalytics.meta.product) {
    if (retryCount < 5) {
      console.warn(`⏰ ShopifyAnalytics not ready, retrying in ${500 * (retryCount + 1)}ms...`);
      setTimeout(() => updateVariantSelection(petCount, retryCount + 1), 500 * (retryCount + 1));
      return;
    } else {
      console.error('❌ ShopifyAnalytics never loaded after 5 attempts');
      return;
    }
  }

  // ... rest of function
}
```

### Phase 3: Price Display Fix (15-30 minutes)

**Current Code** (lines 1316-1334) assumes specific DOM structure.

**Robust Price Update Function**:
```javascript
function updatePriceDisplay(variant) {
  // Strategy 1: Shopify Dawn theme standard selectors
  let priceElement = document.querySelector('.price__regular .price-item--regular');

  // Strategy 2: Alternative price selectors (if Dawn doesn't match)
  if (!priceElement) {
    priceElement = document.querySelector('[data-product-price]') ||
                   document.querySelector('.product__price') ||
                   document.querySelector('.price .price-item');
  }

  if (!priceElement) {
    console.warn('⚠️ Price display element not found');
    console.log('🔍 DEBUG: All elements with "price" in class:',
                document.querySelectorAll('[class*="price"]'));
    return;
  }

  // Format price (variant.price is in cents)
  const priceFormatted = `$${(variant.price / 100).toFixed(2)}`;
  priceElement.textContent = priceFormatted;
  console.log(`✅ Price display updated: ${priceFormatted}`);

  // Trigger Shopify's variant change event for other theme components
  if (typeof window.variantChange === 'function') {
    window.variantChange(variant);
  }

  // Dispatch custom event for other scripts
  document.dispatchEvent(new CustomEvent('variantChanged', {
    detail: { variant, price: variant.price }
  }));
}
```

---

## Testing Checklist

### Phase 1: Diagnostic Logging Tests

1. **Deploy with diagnostic logging**
2. **Open browser console** (F12)
3. **Navigate to product page** with variants
4. **Select different pet counts** (1 → 2 → 3)
5. **Capture console output** for each selection
6. **Document actual data structures** found

### Phase 2: Fix Verification Tests

After implementing fixes based on diagnostics:

**Test 1 - Variant Matching**:
- [ ] Select "1 Pet" → Variant ID updates correctly
- [ ] Select "2 Pets" → Variant ID updates correctly
- [ ] Select "3 Pets" → Variant ID updates correctly
- [ ] Console shows "✅ Variant updated" (not "⚠️ No variant found")

**Test 2 - Price Display**:
- [ ] Select "1 Pet" → Price shows $29 (or correct 1-pet price)
- [ ] Select "2 Pets" → Price shows $34 (or correct 2-pet price)
- [ ] Select "3 Pets" → Price shows $39 (or correct 3-pet price)
- [ ] Price updates smoothly without page refresh

**Test 3 - Form Integration**:
- [ ] Hidden input `name="id"` has correct variant ID
- [ ] Hidden input `properties[Pets]` has correct text value
- [ ] Console shows "✅ Form found" (not "⚠️ Could not find cart form")

**Test 4 - Cart Display**:
- [ ] Add 1-pet product to cart → Cart shows "Pets: 1 Pet"
- [ ] Add 2-pet product to cart → Cart shows "Pets: 2 Pets"
- [ ] Add 3-pet product to cart → Cart shows "Pets: 3 Pets"
- [ ] Cart shows correct price for each variant

**Test 5 - Multi-Product Scenarios**:
- [ ] Test product with `max_pets = 1` (only 1 Pet option)
- [ ] Test product with `max_pets = 2` (1 Pet, 2 Pets options)
- [ ] Test product with `max_pets = 3` (all options)

**Test 6 - Edge Cases**:
- [ ] Page load → Select pet count immediately (timing test)
- [ ] Fast clicking between pet counts (race condition test)
- [ ] Browser back/forward navigation (state persistence test)

---

## Rollback Strategy

If fixes cause issues:

1. **Immediate Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Partial Rollback** (diagnostic logging only):
   - Remove all `console.log('🔍 DEBUG: ...)` lines
   - Keep existing logic untouched
   - Deploy cleaned version

3. **Emergency Fallback**:
   - Comment out entire `updateVariantSelection()` function
   - Remove event listener call (line 1341)
   - Price won't update, but site remains functional

---

## Success Criteria

**Phase 1 Complete When**:
- All diagnostic logs captured
- Actual data structures documented
- Root cause(s) identified with certainty

**Phase 2 Complete When**:
- All 6 test categories pass
- No console errors during variant selection
- Cart displays correct pet count and price
- Works across all product types (1-pet, 2-pet, 3-pet)

**Production Ready When**:
- User confirms variant selection works on live test environment
- No regressions in existing functionality
- Orders submitted successfully with correct pricing

---

## Files to Modify

### Primary File
- `snippets/ks-product-pet-selector-stitch.liquid` (lines 1265-1334)

### Potential Secondary Files
- `assets/cart-pet-integration.js` (if cart display logic interfering)
- `layout/theme.liquid` (if missing Shopify analytics injection)

---

## Timeline Estimate

| Phase | Task | Time |
|-------|------|------|
| 1 | Add diagnostic logging | 10 min |
| 1 | Deploy to test environment | 2 min |
| 1 | Test and capture console output | 15 min |
| 1 | Analyze results | 15 min |
| **1 Total** | | **~45 min** |
| 2 | Implement fixes (based on findings) | 30-60 min |
| 2 | Test all scenarios | 30 min |
| 2 | Adjust and retry | 15 min |
| **2 Total** | | **~1-2 hours** |
| 3 | Final verification | 15 min |
| 3 | Documentation update | 10 min |
| **3 Total** | | **~25 min** |
| **TOTAL** | | **~2-3 hours** |

---

## Next Steps

1. **User Review**: Review this plan and approve Phase 1 (diagnostic logging)
2. **Provide Test URL**: Share current Shopify test environment URL
3. **Deploy Phase 1**: Implement diagnostic logging
4. **Capture Console Output**: Test pet count selections and document findings
5. **Implement Phase 2**: Fix based on diagnostic results
6. **Final Testing**: Verify all scenarios work correctly

---

## Critical Questions for User

Before proceeding, please confirm:

1. **Variant Option Name**: Is the product option called exactly "Pets" (capital P)?
2. **Variant Values**: Are the variant values exactly "1 Pet", "2 Pets", "3 Pets" (with capital P)?
3. **Product Examples**: Can you provide links to 1-pet, 2-pet, and 3-pet products on test environment?
4. **Expected Prices**: What are the correct prices for 1-pet, 2-pet, and 3-pet variants?
5. **Cart Display**: Where in the cart should the pet count appear (drawer, page, both)?

---

## References

- **Session Context**: `.claude/tasks/context_session_001.md` (lines 4770-4884)
- **Previous Variant Work**: Session documented dynamic pricing implementation
- **Cart Integration**: `assets/cart-pet-integration.js` (form field population logic)
- **Shopify Variant API**: https://shopify.dev/docs/api/liquid/objects/variant

---

**END OF DEBUG PLAN**
