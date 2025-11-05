# Dynamic Pricing Based on Pet Count - Implementation Plan

**Document**: Technical implementation plan for pet count-based pricing
**Date**: 2025-11-05
**Session**: context_session_001.md
**Status**: IMPLEMENTATION PLAN - DO NOT EXECUTE WITHOUT APPROVAL

---

## Executive Summary

**Business Objective**: Implement dynamic pricing where customers pay additional fees based on pet count selection:
- 1 pet = Base price (no change)
- 2 pets = Base price + $5.00
- 3 pets = Base price + $10.00

**Chosen Approach**: **Product Variants Method** (Server-side enforcement)

**Rationale**:
- Cannot be bypassed by customers (server-side pricing)
- Native Shopify functionality (tax calculation, inventory, analytics)
- Transparent pricing (no surprise fees at checkout)
- Mobile-optimized (70% of traffic)
- Zero additional apps or external dependencies
- Works with all Shopify features (discounts, promotions, etc.)

**Implementation Time**: 6-8 hours
**Risk Level**: MEDIUM (requires product structure changes)
**Conversion Impact**: POSITIVE (transparent pricing reduces cart abandonment)

---

## Technical Requirements

### Acceptance Criteria

1. **Pricing Logic**:
   - ✅ 1 pet selection = Base product price
   - ✅ 2 pets selection = Base price + $5.00
   - ✅ 3 pets selection = Base price + $10.00
   - ✅ Price changes happen BEFORE add-to-cart (no checkout surprises)

2. **User Experience**:
   - ✅ Price updates immediately when pet count changes
   - ✅ Clear price display next to "Add to Cart" button
   - ✅ No customer-facing mention of "variants" (UX seamless)
   - ✅ Mobile-friendly (70% traffic requirement)

3. **Technical Enforcement**:
   - ✅ Pricing enforced server-side (cannot be bypassed)
   - ✅ Correct variant selected at add-to-cart
   - ✅ Proper tax calculation
   - ✅ Accurate inventory tracking

4. **Data Integrity**:
   - ✅ Pet count stored in line item properties
   - ✅ Variant selection persists across page reloads
   - ✅ Cart shows correct variant with correct price
   - ✅ Order data includes pet count for fulfillment

---

## Implementation Plan

### Phase 1: Product Structure Setup (2 hours)

#### Task 1.1: Create Product Variants in Shopify Admin

**Location**: Shopify Admin Dashboard → Products → [Target Product]

**Action**: Create 3 variants per custom product with "Number of Pets" option

**Variant Structure**:
```
Option Name: "Number of Pets"

Variant 1: "1 Pet"
- Price: [Base Price] (e.g., $29.99)
- SKU: [PRODUCT-SKU]-1PET
- Inventory: Track quantity

Variant 2: "2 Pets"
- Price: [Base Price + $5.00] (e.g., $34.99)
- SKU: [PRODUCT-SKU]-2PETS
- Inventory: Track quantity

Variant 3: "3 Pets"
- Price: [Base Price + $10.00] (e.g., $39.99)
- SKU: [PRODUCT-SKU]-3PETS
- Inventory: Track quantity
```

**Critical Notes**:
- Create variants ONLY for products with `custom` tag
- Maintain consistent SKU format for tracking
- Set inventory to "Track quantity" for all variants
- Ensure all variants have same base product settings (weight, HS code, etc.)

**Testing**:
- [ ] Verify all 3 variants appear in product admin
- [ ] Confirm pricing differences ($5/$10 increments)
- [ ] Check SKU uniqueness across all products

---

#### Task 1.2: Hide Default Variant Selector

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: After line 31 (after opening `<div class="pet-selector-stitch">`)

**Action**: Add CSS to hide Shopify's default variant picker

**Code to Add**:
```liquid
{% comment %} Hide default variant picker - we control variants via pet count {% endcomment %}
<style>
  /* Hide default Shopify variant picker for products with pet selector */
  .pet-selector-stitch ~ .product-form__controls .product-form__input--dropdown,
  .pet-selector-stitch ~ .product-form__controls variant-radios,
  .pet-selector-stitch ~ .product-form__controls variant-selects,
  .product-form__controls [name="id"] {
    display: none !important;
  }

  /* Ensure variant input exists but is hidden (required for form submission) */
  .product-form__controls input[name="id"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
</style>
```

**Rationale**:
- Customers should only see "Number of Pets" selector, not technical "variant" selector
- Hidden input still exists for form submission
- `!important` overrides Dawn theme's default styles

**Testing**:
- [ ] Default variant dropdown not visible on product page
- [ ] Pet count selector remains visible and functional
- [ ] Inspect element confirms hidden input exists with `name="id"`

---

### Phase 2: Pet Selector Integration (3 hours)

#### Task 2.1: Add Variant Mapping Data Attributes

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: Lines 28-31 (in opening `<div class="pet-selector-stitch">` tag)

**Current Code**:
```liquid
<div class="pet-selector-stitch"
     data-max-pets="{{ max_pets_per_product }}"
     data-product-id="{{ product.id }}"
     style="--pet-selector-primary: {{ scheme_button }}; ...">
```

**Updated Code**:
```liquid
<div class="pet-selector-stitch"
     data-max-pets="{{ max_pets_per_product }}"
     data-product-id="{{ product.id }}"
     data-variant-1-pet="{{ product.variants[0].id }}"
     data-variant-2-pets="{{ product.variants[1].id }}"
     data-variant-3-pets="{{ product.variants[2].id }}"
     data-price-1-pet="{{ product.variants[0].price | money_without_trailing_zeros }}"
     data-price-2-pets="{{ product.variants[1].price | money_without_trailing_zeros }}"
     data-price-3-pets="{{ product.variants[2].price | money_without_trailing_zeros }}"
     data-base-price="{{ product.price | money_without_trailing_zeros }}"
     style="--pet-selector-primary: {{ scheme_button }}; ...">
```

**Rationale**:
- Maps pet count (1/2/3) to specific Shopify variant IDs
- Provides price data for immediate UI updates
- All data available client-side without API calls

**Critical Note**:
- Assumes variants are ordered: index 0 = 1 pet, index 1 = 2 pets, index 2 = 3 pets
- If variant order differs, use Liquid filters to match by option value

**Testing**:
- [ ] Inspect element shows all `data-variant-*` attributes
- [ ] Variant IDs are valid (not null/undefined)
- [ ] Prices display correctly with currency formatting

---

#### Task 2.2: Update Pet Count Selection Handler

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: JavaScript section (search for `data-pet-count-radio` event handler)

**Current Code** (approximate lines 1200-1250):
```javascript
// Listen for pet count selection
container.querySelectorAll('[data-pet-count-radio]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    const selectedCount = parseInt(this.value);

    // Show/hide pet detail sections
    for (let i = 1; i <= 3; i++) {
      const petDetail = container.querySelector('[data-pet-index="' + i + '"]');
      if (petDetail) {
        petDetail.style.display = i <= selectedCount ? 'block' : 'none';
      }
    }
  });
});
```

**Updated Code**:
```javascript
// Listen for pet count selection
container.querySelectorAll('[data-pet-count-radio]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    const selectedCount = parseInt(this.value);

    // Show/hide pet detail sections
    for (let i = 1; i <= 3; i++) {
      const petDetail = container.querySelector('[data-pet-index="' + i + '"]');
      if (petDetail) {
        petDetail.style.display = i <= selectedCount ? 'block' : 'none';
      }
    }

    // ===== NEW: Update product variant based on pet count =====
    updateProductVariant(selectedCount);

    // ===== NEW: Update displayed price =====
    updateDisplayedPrice(selectedCount);
  });
});

// ===== NEW FUNCTION: Update Product Variant =====
function updateProductVariant(petCount) {
  const container = document.querySelector('.pet-selector-stitch');
  if (!container) return;

  // Get variant ID for selected pet count
  const variantId = container.getAttribute('data-variant-' + petCount + '-pet' + (petCount > 1 ? 's' : ''));
  if (!variantId) {
    console.error('Variant ID not found for pet count:', petCount);
    return;
  }

  // Update hidden variant input in product form
  const productForm = document.querySelector('product-form form');
  if (!productForm) {
    console.error('Product form not found');
    return;
  }

  let variantInput = productForm.querySelector('input[name="id"]');
  if (!variantInput) {
    // Create hidden input if it doesn't exist
    variantInput = document.createElement('input');
    variantInput.type = 'hidden';
    variantInput.name = 'id';
    productForm.appendChild(variantInput);
  }

  // Set variant ID value
  variantInput.value = variantId;

  // Trigger Shopify's variant change event (updates price display, inventory, etc.)
  const variantChangeEvent = new CustomEvent('variant:change', {
    detail: { variant: variantId },
    bubbles: true
  });
  productForm.dispatchEvent(variantChangeEvent);

  console.log('Updated variant to:', variantId, 'for pet count:', petCount);
}

// ===== NEW FUNCTION: Update Displayed Price =====
function updateDisplayedPrice(petCount) {
  const container = document.querySelector('.pet-selector-stitch');
  if (!container) return;

  // Get price for selected pet count
  const priceAttr = 'data-price-' + petCount + '-pet' + (petCount > 1 ? 's' : '');
  const newPrice = container.getAttribute(priceAttr);
  if (!newPrice) {
    console.error('Price not found for pet count:', petCount);
    return;
  }

  // Update price display in product form
  const priceElement = document.querySelector('.price__regular .price-item--regular');
  if (priceElement) {
    priceElement.textContent = newPrice;
  }

  // Update "Add to Cart" button text to show price (optional)
  const addToCartBtn = document.querySelector('product-form button[type="submit"]');
  if (addToCartBtn) {
    const originalText = addToCartBtn.getAttribute('data-original-text') || addToCartBtn.textContent;
    if (!addToCartBtn.getAttribute('data-original-text')) {
      addToCartBtn.setAttribute('data-original-text', originalText);
    }
    addToCartBtn.textContent = originalText + ' - ' + newPrice;
  }

  console.log('Updated price display to:', newPrice, 'for pet count:', petCount);
}
```

**Rationale**:
- Separates concerns: variant selection and price display
- Triggers Shopify's native variant change event (ensures all theme features work)
- Updates both hidden form input and visible price display
- Console logs for debugging during testing

**Edge Cases Handled**:
- Missing variant ID → logs error, prevents crash
- Missing product form → logs error, prevents crash
- Missing price element → fails gracefully
- Preserves original "Add to Cart" text

**Testing**:
- [ ] Selecting 1 pet shows base price
- [ ] Selecting 2 pets shows base + $5
- [ ] Selecting 3 pets shows base + $10
- [ ] Price updates instantly (no page reload)
- [ ] Hidden input value changes correctly (inspect element)
- [ ] "Add to Cart" button text includes price

---

#### Task 2.3: Initialize Default Variant on Page Load

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: End of JavaScript section (before closing `</script>`)

**Code to Add**:
```javascript
// ===== INITIALIZATION: Set default variant on page load =====
(function() {
  const container = document.querySelector('.pet-selector-stitch');
  if (!container) return;

  // Check if a pet count is already selected (from session storage)
  const selectedRadio = container.querySelector('[data-pet-count-radio]:checked');

  if (selectedRadio) {
    // User has already selected pet count - restore variant
    const petCount = parseInt(selectedRadio.value);
    updateProductVariant(petCount);
    updateDisplayedPrice(petCount);
  } else {
    // No selection yet - default to 1 pet variant
    const defaultPetCount = 1;
    const defaultRadio = container.querySelector('[data-pet-count-radio][value="1"]');

    if (defaultRadio) {
      defaultRadio.checked = true;
      updateProductVariant(defaultPetCount);
      updateDisplayedPrice(defaultPetCount);
    }
  }
})();
```

**Rationale**:
- Ensures variant is ALWAYS set (prevents "no variant selected" errors)
- Restores previous selection if user navigates back
- Defaults to 1-pet variant (base price) if no selection
- Runs immediately on page load (IIFE pattern)

**Testing**:
- [ ] Fresh page load shows 1-pet price and variant
- [ ] Refreshing page after selection maintains choice
- [ ] "Add to Cart" works immediately without selecting pet count

---

### Phase 3: Cart Integration (2 hours)

#### Task 3.1: Add Pet Count to Line Item Properties

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: Find the add-to-cart handler (search for `properties[Pet`)

**Current Code** (approximate):
```javascript
// Add pet data to line item properties
properties['Pet 1 Name'] = petData.pets[0].name;
properties['Pet 1 Photo'] = petData.pets[0].photo;
// ... etc
```

**Updated Code**:
```javascript
// Add pet count to line item properties (for order fulfillment)
properties['Number of Pets'] = petData.selectedPetCount || 1;

// Add pet data to line item properties
properties['Pet 1 Name'] = petData.pets[0].name;
properties['Pet 1 Photo'] = petData.pets[0].photo;
// ... etc
```

**Rationale**:
- Provides redundant pet count data for order fulfillment
- Ensures consistency between variant selection and properties
- Visible in Shopify admin order details

**Testing**:
- [ ] Add to cart with 2 pets → line item properties show "Number of Pets: 2"
- [ ] Shopify admin order shows pet count in properties
- [ ] Cart displays correct pet count

---

#### Task 3.2: Validate Variant Selection Before Add to Cart

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: Add-to-cart validation section

**Code to Add**:
```javascript
// ===== VALIDATION: Ensure variant is selected before add to cart =====
function validateVariantSelection() {
  const productForm = document.querySelector('product-form form');
  if (!productForm) {
    console.error('Product form not found');
    return false;
  }

  const variantInput = productForm.querySelector('input[name="id"]');
  if (!variantInput || !variantInput.value) {
    alert('Please select number of pets before adding to cart.');
    return false;
  }

  return true;
}

// Attach validation to add-to-cart button
document.addEventListener('DOMContentLoaded', function() {
  const addToCartBtn = document.querySelector('product-form button[type="submit"]');
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', function(e) {
      if (!validateVariantSelection()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true); // Use capture phase to run before Shopify's handler
  }
});
```

**Rationale**:
- Prevents "Add to Cart" without variant selection
- Shows user-friendly error message
- Stops event propagation to prevent form submission

**Testing**:
- [ ] Clicking "Add to Cart" without pet count shows alert
- [ ] Selecting pet count allows add to cart
- [ ] No console errors during validation

---

### Phase 4: Price Display UI Updates (1 hour)

#### Task 4.1: Add Price Breakdown Display (Optional Enhancement)

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: After pet count selector section (after line 48)

**Code to Add**:
```liquid
{% comment %} Price Breakdown Display {% endcomment %}
<div class="pet-selector__price-breakdown" data-price-breakdown style="display: none; margin-top: 1rem; padding: 1rem; background: var(--pet-selector-background); border: 1px solid #e0e0e0; border-radius: 8px;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
    <span>Base Price:</span>
    <span data-price-base>{{ product.price | money_without_trailing_zeros }}</span>
  </div>
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;" data-price-additional-row>
    <span data-price-additional-label>Additional Pets:</span>
    <span data-price-additional>$0.00</span>
  </div>
  <div style="display: flex; justify-content: space-between; font-weight: bold; padding-top: 0.5rem; border-top: 1px solid #e0e0e0;">
    <span>Total:</span>
    <span data-price-total>{{ product.price | money_without_trailing_zeros }}</span>
  </div>
</div>
```

**JavaScript to Add** (in pet count change handler):
```javascript
// Update price breakdown display
function updatePriceBreakdown(petCount) {
  const breakdown = document.querySelector('[data-price-breakdown]');
  if (!breakdown) return;

  const container = document.querySelector('.pet-selector-stitch');
  const basePrice = container.getAttribute('data-base-price');
  const totalPrice = container.getAttribute('data-price-' + petCount + '-pet' + (petCount > 1 ? 's' : ''));

  // Calculate additional fee
  let additionalFee = '$0.00';
  let showAdditional = false;

  if (petCount === 2) {
    additionalFee = '$5.00';
    showAdditional = true;
  } else if (petCount === 3) {
    additionalFee = '$10.00';
    showAdditional = true;
  }

  // Update breakdown elements
  breakdown.querySelector('[data-price-base]').textContent = basePrice;
  breakdown.querySelector('[data-price-additional]').textContent = additionalFee;
  breakdown.querySelector('[data-price-total]').textContent = totalPrice;

  // Show/hide additional fee row
  const additionalRow = breakdown.querySelector('[data-price-additional-row]');
  if (additionalRow) {
    additionalRow.style.display = showAdditional ? 'flex' : 'none';
  }

  // Show breakdown
  breakdown.style.display = 'block';
}
```

**Rationale**:
- Transparent pricing builds customer trust
- Reduces cart abandonment (no surprise fees)
- Clear value communication for multi-pet orders

**Testing**:
- [ ] Selecting 1 pet hides additional fee row
- [ ] Selecting 2 pets shows "+$5.00" additional fee
- [ ] Selecting 3 pets shows "+$10.00" additional fee
- [ ] Total price matches product price display

---

### Phase 5: Session Persistence (1 hour)

#### Task 5.1: Save Variant Selection to PetStorage

**File**: `assets/pet-storage.js`

**Location**: In `PetStorage.save()` method

**Current Code** (approximate):
```javascript
PetStorage.save = function(productId, petData) {
  var key = 'pet_data_' + productId;
  var dataToSave = {
    selectedPetCount: petData.selectedPetCount || 1,
    pets: petData.pets || [],
    timestamp: new Date().toISOString()
  };
  localStorage.setItem(key, JSON.stringify(dataToSave));
};
```

**Updated Code**:
```javascript
PetStorage.save = function(productId, petData) {
  var key = 'pet_data_' + productId;

  // Get selected variant ID from product form
  var variantId = null;
  var productForm = document.querySelector('product-form form');
  if (productForm) {
    var variantInput = productForm.querySelector('input[name="id"]');
    if (variantInput) {
      variantId = variantInput.value;
    }
  }

  var dataToSave = {
    selectedPetCount: petData.selectedPetCount || 1,
    selectedVariantId: variantId, // NEW: Save variant ID
    pets: petData.pets || [],
    timestamp: new Date().toISOString()
  };

  localStorage.setItem(key, JSON.stringify(dataToSave));
  console.log('Saved pet data with variant:', variantId);
};
```

**Rationale**:
- Preserves variant selection across page reloads
- Ensures consistency between pet count and variant
- Enables "Continue Customization" feature

**Testing**:
- [ ] Select 2 pets → reload page → variant still shows 2-pet price
- [ ] localStorage contains `selectedVariantId` field
- [ ] Variant ID matches selected pet count

---

#### Task 5.2: Restore Variant Selection on Page Load

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: Page load initialization (update Task 2.3 code)

**Updated Initialization Code**:
```javascript
// ===== INITIALIZATION: Restore variant from session storage =====
(function() {
  const container = document.querySelector('.pet-selector-stitch');
  if (!container) return;

  const productId = container.getAttribute('data-product-id');

  // Try to load saved pet data from PetStorage
  let savedData = null;
  if (typeof PetStorage !== 'undefined') {
    savedData = PetStorage.load(productId);
  }

  // Check if a pet count is already selected
  let selectedRadio = container.querySelector('[data-pet-count-radio]:checked');

  // If no radio checked but we have saved data, restore selection
  if (!selectedRadio && savedData && savedData.selectedPetCount) {
    const savedPetCount = savedData.selectedPetCount;
    const radioToCheck = container.querySelector('[data-pet-count-radio][value="' + savedPetCount + '"]');
    if (radioToCheck) {
      radioToCheck.checked = true;
      selectedRadio = radioToCheck;
    }
  }

  if (selectedRadio) {
    // Restore variant for selected pet count
    const petCount = parseInt(selectedRadio.value);
    updateProductVariant(petCount);
    updateDisplayedPrice(petCount);

    // Restore price breakdown if present
    if (typeof updatePriceBreakdown === 'function') {
      updatePriceBreakdown(petCount);
    }
  } else {
    // No selection - default to 1 pet
    const defaultRadio = container.querySelector('[data-pet-count-radio][value="1"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
      updateProductVariant(1);
      updateDisplayedPrice(1);
    }
  }
})();
```

**Rationale**:
- Seamless experience across page navigation
- Reduces user friction (no need to re-select)
- Maintains pricing consistency

**Testing**:
- [ ] Select 3 pets → navigate away → return → still shows 3 pets and $10 fee
- [ ] Clear localStorage → page defaults to 1 pet
- [ ] No console errors during restoration

---

### Phase 6: Testing & Validation (2 hours)

#### Task 6.1: Manual Testing Checklist

**Pre-Testing Setup**:
1. Create test product with 3 variants (1/2/3 pets)
2. Set prices: $29.99 / $34.99 / $39.99
3. Add `custom` tag to product
4. Deploy code changes to test environment

**Test Scenarios**:

**Scenario 1: First-Time User Flow**
- [ ] Load product page → defaults to 1 pet, $29.99
- [ ] Select 2 pets → price changes to $34.99 instantly
- [ ] Select 3 pets → price changes to $39.99 instantly
- [ ] Select 1 pet again → price reverts to $29.99
- [ ] Add to cart with 3 pets → cart shows $39.99 variant
- [ ] Check cart → correct variant, correct price, pet count in properties

**Scenario 2: Session Persistence**
- [ ] Select 3 pets, fill pet details
- [ ] Navigate to another page
- [ ] Return to product page → still shows 3 pets, $39.99
- [ ] Pet details still populated (names, photos)
- [ ] Add to cart → correct $39.99 variant

**Scenario 3: Mobile Experience** (70% of traffic)
- [ ] Test on iOS Safari (most common)
- [ ] Pet count selector buttons are touch-friendly (min 44x44px)
- [ ] Price updates immediately on touch
- [ ] No layout shifts or flickering
- [ ] Add to cart button visible without scrolling (important!)

**Scenario 4: Edge Cases**
- [ ] Refresh page without selecting pet count → defaults to 1 pet, $29.99
- [ ] Try to add to cart without uploading photos → validation blocks (if implemented)
- [ ] Clear localStorage → page still functional, defaults to 1 pet
- [ ] Inspect hidden variant input → value matches selected pet count
- [ ] Check browser console → no JavaScript errors

**Scenario 5: Cart & Checkout**
- [ ] Add 2-pet product → cart shows $34.99
- [ ] Add 3-pet product (same product) → two line items, different variants
- [ ] Edit quantity in cart → price per item correct
- [ ] Proceed to checkout → Shopify checkout shows correct prices
- [ ] Complete test order → order confirmation shows correct variant

**Scenario 6: Admin Verification**
- [ ] Check Shopify admin order
- [ ] Variant shown: "2 Pets" or "3 Pets" (not just SKU)
- [ ] Line item properties show "Number of Pets: 2"
- [ ] Pet names and photos present in properties
- [ ] Tax calculated correctly on higher variant prices

---

#### Task 6.2: Browser Compatibility Testing

**Target Browsers** (70% mobile priority):

**Mobile** (Priority 1):
- [ ] iOS Safari 15+ (majority of mobile traffic)
- [ ] Chrome Mobile (Android)
- [ ] Samsung Internet

**Desktop** (Priority 2):
- [ ] Chrome 90+ (most common)
- [ ] Safari 14+
- [ ] Firefox 88+
- [ ] Edge 90+

**Test Focus**:
- Price updates trigger correctly
- Hidden variant input updates
- Add to cart submits correct variant
- No console errors

---

#### Task 6.3: Performance Testing

**Metrics to Check**:
- [ ] Page load time (should not increase significantly)
- [ ] Price update latency (<100ms)
- [ ] localStorage write time (<50ms)
- [ ] Add to cart response time (should match current)

**Tools**:
- Chrome DevTools Performance tab
- Network tab (check for extra API calls - should be zero)
- Lighthouse audit (should maintain score)

---

### Phase 7: Rollback Plan (If Issues Arise)

#### Rollback Procedure

**If Critical Issues Found**:

1. **Immediate Rollback** (5 minutes):
   ```liquid
   <!-- In snippets/ks-product-pet-selector-stitch.liquid -->
   <!-- Comment out new JavaScript functions -->
   <!--
   function updateProductVariant(petCount) { ... }
   function updateDisplayedPrice(petCount) { ... }
   -->

   <!-- Re-enable default variant selector -->
   <!-- Remove the display:none CSS added in Task 1.2 -->
   ```

2. **Revert Variant Structure** (15 minutes):
   - Shopify Admin → Products → Delete 2-pet and 3-pet variants
   - Keep only single default variant
   - Original pricing structure restored

3. **Clear Customer Sessions** (Optional):
   - Add emergency localStorage clear on page load (temporary)
   ```javascript
   // Emergency cleanup - remove after 24 hours
   localStorage.removeItem('pet_data_' + productId);
   ```

**Rollback Decision Criteria**:
- Cart abandonment rate increases >10%
- JavaScript errors affecting >5% of users
- Incorrect variant selected at checkout
- Customer complaints about pricing confusion

---

## Technical Considerations

### 1. Shopify Variant Limitations

**Issue**: Shopify allows max 100 variants per product
**Impact**: Not an issue (we only need 3 variants per product)
**Mitigation**: None needed

### 2. Price Display Conflicts

**Issue**: Shopify theme (Dawn) may have multiple price elements
**Impact**: Need to update all price displays, not just one
**Solution**: Use CSS selectors to target all `.price__regular` elements

**Code Enhancement**:
```javascript
// Update ALL price displays on page
function updateDisplayedPrice(petCount) {
  const container = document.querySelector('.pet-selector-stitch');
  const newPrice = container.getAttribute('data-price-' + petCount + '-pet' + (petCount > 1 ? 's' : ''));

  // Update all price elements (sticky header, product page, etc.)
  document.querySelectorAll('.price__regular .price-item--regular').forEach(function(el) {
    el.textContent = newPrice;
  });
}
```

### 3. Variant Change Event Compatibility

**Issue**: Some Shopify apps listen for variant changes
**Impact**: Our custom variant updates may not trigger third-party apps
**Solution**: Dispatch Shopify's standard variant change event

**Already Implemented in Task 2.2**:
```javascript
const variantChangeEvent = new CustomEvent('variant:change', {
  detail: { variant: variantId },
  bubbles: true
});
productForm.dispatchEvent(variantChangeEvent);
```

### 4. Tax Calculation

**Issue**: Multi-jurisdiction tax rates must apply to correct variant prices
**Impact**: Shopify handles this automatically (server-side)
**Verification**: Test orders in different tax jurisdictions during Phase 6

### 5. Discount Code Compatibility

**Issue**: Percentage discounts should apply to variant prices, not base price
**Impact**: Shopify handles this automatically (server-side)
**Verification**: Test with discount codes during Phase 6

### 6. Inventory Tracking

**Issue**: Each variant needs separate inventory tracking
**Impact**: Fulfillment team needs to track variant-specific inventory
**Solution**: Use SKU differentiation (e.g., `PRODUCT-1PET`, `PRODUCT-2PETS`)

### 7. SEO Implications

**Issue**: Product URLs may include variant IDs (e.g., `?variant=123456`)
**Impact**: Minimal - search engines see base product URL
**Mitigation**: Use canonical URLs (already handled by Shopify)

### 8. Analytics Tracking

**Issue**: Need to track which variants convert better
**Impact**: Positive - easier tracking than custom properties
**Solution**: Shopify analytics automatically track by variant

---

## Edge Cases & Error Handling

### Edge Case 1: User Selects Pet Count But Doesn't Upload Photos

**Scenario**: User selects 3 pets, but only uploads 1 photo

**Current Behavior**: Unknown (depends on existing validation)

**Recommended Handling**:
```javascript
// Add validation before add-to-cart
function validatePetPhotos() {
  const selectedCount = getSelectedPetCount();
  const uploadedCount = countUploadedPhotos();

  if (uploadedCount < selectedCount) {
    alert('Please upload ' + selectedCount + ' pet photo(s) before adding to cart.');
    return false;
  }
  return true;
}
```

**Implementation**: Add to Task 3.2 validation function

---

### Edge Case 2: User Clears Pet Count Selection

**Scenario**: User unchecks pet count radio button (rare, but possible)

**Current Behavior**: All pet detail sections hidden

**Recommended Handling**:
```javascript
// In pet count change handler
if (!selectedRadio || !selectedRadio.checked) {
  // Default back to 1 pet
  const defaultRadio = container.querySelector('[data-pet-count-radio][value="1"]');
  if (defaultRadio) {
    defaultRadio.checked = true;
    updateProductVariant(1);
    updateDisplayedPrice(1);
  }
}
```

**Implementation**: Add to Task 2.2 change handler

---

### Edge Case 3: Product Has Existing Variants (Size, Color, etc.)

**Scenario**: Product already has variants for size or color

**Issue**: Combining "Number of Pets" with existing variant options creates variant explosion
- Example: 3 sizes × 3 pet counts = 9 variants
- Example: 3 sizes × 2 colors × 3 pet counts = 18 variants

**Recommended Solution**:

**Option A: Pet Count as Separate Product**
- Create separate products: "Canvas Print - 1 Pet", "Canvas Print - 2 Pets", "Canvas Print - 3 Pets"
- Each has own size/color variants
- Pros: Clean variant structure
- Cons: Product duplication

**Option B: Pet Count as Line Item Property (NOT Variant)**
- Keep existing variants (size, color)
- Pet count stored ONLY in properties (not as variant)
- Charge via separate "Pet Processing Fee" product in cart
- Pros: No variant explosion
- Cons: Fee can be bypassed (removed from cart)

**Option C: Conditional Variant Structure**
- Products with size/color: Pet count as line item property
- Products without variants: Pet count as variant (this implementation plan)
- Pros: Best of both worlds
- Cons: Two different pricing systems

**Decision Required**: User must choose approach for products with existing variants

---

### Edge Case 4: Variant Sold Out

**Scenario**: 2-pet variant is sold out, but 1-pet and 3-pet available

**Current Behavior**: Shopify blocks add-to-cart for sold-out variants

**Recommended Handling**:
```javascript
// Check variant availability before updating
function updateProductVariant(petCount) {
  const variantId = getVariantId(petCount);

  // Check if variant is available
  const variant = getVariantDetails(variantId);
  if (!variant.available) {
    alert('Sorry, ' + petCount + '-pet customization is currently unavailable. Please select a different pet count.');

    // Disable radio button
    const radio = container.querySelector('[data-pet-count-radio][value="' + petCount + '"]');
    if (radio) {
      radio.disabled = true;
      radio.parentElement.classList.add('pet-count-btn--unavailable');
    }

    return false;
  }

  // Continue with variant update
  // ...
}
```

**Implementation**: Add to Task 2.2 (or skip if inventory always unlimited)

---

### Edge Case 5: Price Changes During Session

**Scenario**: Admin changes variant prices while user is customizing

**Current Behavior**: Page shows cached prices from page load

**Recommended Handling**:
- Accept this limitation (extremely rare scenario)
- User will see updated price at checkout
- Shopify's cart validates prices server-side (user cannot manipulate)

**No Action Required**: Edge case too rare to handle

---

## Success Metrics

### Conversion Metrics (Track Pre/Post Implementation)

**Primary KPIs**:
- [ ] Add-to-cart rate (should maintain or improve)
- [ ] Cart abandonment rate (should not increase)
- [ ] Checkout completion rate (should maintain or improve)

**Secondary KPIs**:
- [ ] Average order value (should increase - more multi-pet orders?)
- [ ] Revenue per visitor (should increase with pricing)
- [ ] 2-pet vs 3-pet selection ratio (business intelligence)

**User Experience Metrics**:
- [ ] JavaScript errors in console (should be zero)
- [ ] Price update latency (should be <100ms)
- [ ] Mobile bounce rate (should not increase)

**Business Metrics**:
- [ ] Daily revenue from 2-pet and 3-pet variants
- [ ] Customer support tickets about pricing (should be low)
- [ ] Refund/return rate (should not increase)

### Tracking Implementation

**Google Analytics Event Tracking**:
```javascript
// Track pet count selection
gtag('event', 'select_pet_count', {
  'event_category': 'Product Customization',
  'event_label': petCount + ' Pets',
  'value': getVariantPrice(petCount)
});

// Track variant add-to-cart
gtag('event', 'add_to_cart', {
  'event_category': 'Ecommerce',
  'event_label': 'Variant: ' + petCount + ' Pets',
  'value': getVariantPrice(petCount)
});
```

**Shopify Analytics**:
- Track by variant in Shopify admin dashboard
- "Products" → "All products" → filter by variant
- View conversion rate by variant

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cart abandonment increases | Medium | High | A/B test first, easy rollback |
| JavaScript errors on old browsers | Low | Medium | ES5 compatibility already in place |
| Variant confusion for customers | Low | Low | Hide technical variant UI |
| Admin accidentally deletes variants | Low | High | Document variant structure clearly |
| Third-party app compatibility issues | Medium | Medium | Test with all installed apps |
| Mobile UX degradation | Low | High | Prioritize mobile testing (70% traffic) |
| Price display conflicts | Medium | Low | Test all theme sections |
| Inventory tracking complexity | Low | Medium | Clear SKU naming convention |

**Overall Risk Level**: **MEDIUM**

**Recommended Approach**:
1. Implement on test environment first
2. A/B test on 10% of traffic for 1 week
3. Monitor metrics closely
4. Full rollout if metrics positive

---

## Appendix A: Files Modified Summary

| File | Lines Changed | Type | Purpose |
|------|---------------|------|---------|
| `snippets/ks-product-pet-selector-stitch.liquid` | ~200 (new) | Add | Variant mapping, price updates, JS logic |
| `assets/pet-storage.js` | ~10 (modify) | Edit | Save/restore variant selection |
| Shopify Admin (Product Variants) | N/A | Admin | Create 3 variants per product |

**Total Code Changes**: ~210 lines (mostly JavaScript)

---

## Appendix B: Testing URLs

**Test Environment**:
- URL: [Ask user for current test URL - expires periodically]
- Product: [Identify specific test product with custom tag]
- Test Account: [User's test account]

**Test Product Requirements**:
- Must have `custom` tag
- Must have 3 variants created (1/2/3 pets)
- Prices: Base / Base+$5 / Base+$10

---

## Appendix C: Alternative Approaches Considered

### Approach 1: Dynamic Price Adjustment (Client-Side)
**Why Rejected**: Can be bypassed by customers inspecting/modifying JavaScript

### Approach 2: Separate Fee Products
**Why Rejected**: Confusing checkout experience, can be removed from cart

### Approach 3: Shopify Scripts
**Why Rejected**: Requires Shopify Plus (not available)

### Approach 4: Draft Order API
**Why Rejected**: Complex implementation, requires backend service

### Approach 5: Line Item Properties Only
**Why Rejected**: Cannot enforce pricing server-side

**Chosen Approach: Product Variants**
- ✅ Server-side enforcement (cannot be bypassed)
- ✅ Native Shopify functionality
- ✅ Transparent pricing (reduces abandonment)
- ✅ Works with all Shopify features

---

## Appendix D: Communication Plan

### Customer Communication

**Product Page Copy Suggestion**:
```
"Number of Pets"
1 Pet - [Base Price]
2 Pets - [Base Price + $5.00] (Additional pet processing)
3 Pets - [Base Price + $10.00] (Additional pet processing)

ℹ️ Why the difference? Each additional pet requires extra AI processing and design work to create your perfect print.
```

**FAQ Addition**:
```
Q: Why do 2 or 3 pets cost more?
A: Each pet requires individual AI background removal and artistic processing. The additional $5-$10 covers the extra computational resources and processing time for your additional furry friends!
```

### Internal Communication

**To Fulfillment Team**:
- Check variant name in order: "1 Pet", "2 Pets", or "3 Pets"
- Verify pet count matches uploaded photos
- Line item properties include "Number of Pets" for redundancy

**To Customer Support**:
- Customers see pricing upfront (no surprise fees)
- Pricing is per product (not per order)
- If customer asks why: "Extra AI processing for each additional pet"

---

## Next Steps After Implementation

1. **Monitor metrics** for 2 weeks post-launch
2. **Collect customer feedback** via post-purchase survey
3. **Analyze variant performance** in Shopify analytics
4. **Consider dynamic pricing** based on complexity (future enhancement)
5. **Test upsell opportunities** ("Add another pet for just $5!")

---

## Final Recommendations

### Pre-Implementation
- [ ] Review this plan with shopify-conversion-optimizer agent
- [ ] Consult solution-verification-auditor for implementation verification
- [ ] Create test product with 3 variants in Shopify admin
- [ ] Set up A/B testing framework (if available)

### During Implementation
- [ ] Test on Chrome DevTools MCP with Shopify test URL (ask user for URL)
- [ ] Verify each phase before moving to next
- [ ] Document any deviations from plan
- [ ] Take screenshots of working implementation

### Post-Implementation
- [ ] Monitor error logs for 48 hours
- [ ] Compare conversion metrics week-over-week
- [ ] Gather customer feedback
- [ ] Update session context with results

---

**End of Implementation Plan**

**Status**: READY FOR REVIEW
**Next Action**: Await user approval to proceed with implementation
**Estimated Total Time**: 6-8 hours
**Risk Level**: MEDIUM (mitigated by testing and rollback plan)
