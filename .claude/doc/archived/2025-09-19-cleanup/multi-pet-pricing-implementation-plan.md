# Multi-Pet Pricing Implementation Plan

## Executive Summary
**USER REQUIREMENT**: Implement tiered pricing for multi-pet orders (1 pet FREE, 2 pets +$5, 3 pets +$10 total). Current system shows incorrect "$0.05 Custom Image" fee that needs fixing.

## Context
- **User Decision**: Explicitly requested tiered pricing structure despite PM recommendation to keep everything free
- **Current Problem**: Static `custom_image_fee` shows "$0.05" instead of dynamic pricing
- **Business Data**: 50%+ orders have 2+ pets, 15% have 3 pets
- **Required Pricing**:
  - 1 pet = FREE (no additional cost)
  - 2 pets = $5.00 additional fee
  - 3 pets = $10.00 total additional fee

## Shopify Technical Analysis

### 1. Can We Implement Tiered Pricing Without Product Variants?

**ANSWER: Limited Options in Shopify**

**What's NOT Possible:**
- Line item properties cannot modify cart prices directly
- JavaScript price changes are display-only (can be bypassed)
- Cart API doesn't allow dynamic fee addition on basic Shopify plans

**What IS Possible:**

1. **Display-Only Pricing (Frontend)**
   - Show calculated fees in UI
   - Add fees as line item properties (for reference only)
   - ❌ Customers can modify/bypass via cart manipulation

2. **Product Variants (Recommended)**
   - Create variants: "Custom Art - 1 Pet", "Custom Art - 2 Pets (+$5)", "Custom Art - 3 Pets (+$10)"
   - JavaScript selects appropriate variant based on pet count
   - ✅ Shopify handles all pricing, taxes, checkout natively
   - ✅ Cannot be bypassed by customers

3. **Separate Line Items (Complex)**
   - Add "Additional Pet Processing Fee" product to cart
   - Manage fee product inventory
   - ❌ Poor checkout experience, complex inventory management

4. **Shopify Scripts (Plus/Enterprise Only)**
   - Dynamic cart modification via Ruby scripts
   - ✅ Clean solution but requires Shopify Plus ($2000+/month)

**RECOMMENDED: Product Variants + JavaScript Selection**

**Why This Works:**
- Shopify natively handles pricing, taxes, inventory
- JavaScript automatically selects correct variant based on pet count
- Customer cannot bypass pricing in cart
- Works with all Shopify plans
- Integrates cleanly with existing cart flow

**Setup Required:**
1. Create 3 variants per custom product:
   - "Custom Art - 1 Pet" (base price)
   - "Custom Art - 2 Pets" (base price + $5)  
   - "Custom Art - 3 Pets" (base price + $10)

2. JavaScript detects pet count and switches variant automatically
3. Pet selector shows live pricing updates
4. Cart/checkout shows correct prices

## Implementation Plan

### Phase 1: Remove Incorrect Fee Display (30 minutes)

**File: `snippets/ks-product-pet-selector.liquid`**

**Problem**: Lines 68-76 show static `custom_image_fee` regardless of pet count
```liquid
{% assign custom_fee_numeric = custom_image_fee | plus: 0 %}
{% if custom_fee_numeric > 0 %}
<div class="ks-pet-selector__price-info">
  <span class="ks-pet-selector__base-price">Product: <span id="base-price-{{ section.id }}">{{ product.price | money }}</span></span>
  <span class="ks-pet-selector__custom-fee">+ Custom Image: {{ custom_image_fee | money }}</span>
  <span class="ks-pet-selector__total">Total: <span id="total-price-{{ section.id }}">{{ product.price | plus: custom_image_fee | money }}</span></span>
</div>
{% endif %}
```

**Solution**: Replace with dynamic pricing container
```liquid
<div class="ks-pet-selector__price-info" id="pet-pricing-{{ section.id }}" style="display: none;">
  <div class="pricing-breakdown">
    <span class="ks-pet-selector__base-price">Product: <span id="base-price-{{ section.id }}">{{ product.price | money }}</span></span>
    <span class="ks-pet-selector__pet-fee" id="pet-fee-display-{{ section.id }}" style="display: none;"></span>
    <span class="ks-pet-selector__total">Total: <span id="total-price-{{ section.id }}"></span></span>
  </div>
</div>
```

### Phase 2: Add Dynamic Multi-Pet Pricing Logic (2 hours)

**File: `snippets/ks-product-pet-selector.liquid`**

**Add after line 900 in JavaScript section:**

```javascript
// Calculate and display multi-pet pricing
function updateMultiPetPricing() {
  var petCount = countSelectedPets();
  var pricingContainer = document.getElementById('pet-pricing-' + sectionId);
  var basePriceEl = document.getElementById('base-price-' + sectionId);
  var feeEl = document.getElementById('pet-fee-display-' + sectionId);
  var totalEl = document.getElementById('total-price-' + sectionId);
  
  if (petCount === 0) {
    pricingContainer.style.display = 'none';
    return;
  }
  
  // Get base product price
  var basePrice = parseFloat(petSelector.dataset.productPrice) || 0;
  var additionalFee = 0;
  
  // Calculate tiered pricing
  if (petCount === 1) {
    additionalFee = 0; // First pet is FREE
    feeEl.style.display = 'none';
  } else if (petCount === 2) {
    additionalFee = 500; // $5.00 for 2nd pet
    feeEl.textContent = '+ 1 Additional Pet: $5.00';
    feeEl.style.display = 'block';
  } else if (petCount === 3) {
    additionalFee = 1000; // $10.00 total for 2nd+3rd pets
    feeEl.textContent = '+ 2 Additional Pets: $10.00';
    feeEl.style.display = 'block';
  }
  
  var totalPrice = basePrice + additionalFee;
  totalEl.textContent = formatMoney(totalPrice);
  pricingContainer.style.display = 'block';
  
  // Trigger variant selection if enabled
  updateProductVariantForPetCount(petCount, totalPrice);
}

function countSelectedPets() {
  // Count pets from multi-pet session data
  try {
    var sessionData = localStorage.getItem('pet_session_pet-bg-remover');
    if (sessionData) {
      var parsed = JSON.parse(sessionData);
      return (parsed.processedPets || []).length;
    }
  } catch (e) {
    console.warn('Could not count selected pets:', e);
  }
  
  // Fallback: count selected pets in current UI
  return document.querySelectorAll('.ks-pet-selector__pet.selected').length;
}

function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}
```

### Phase 3: Product Variant Integration (3 hours)

**IMPORTANT**: This requires creating product variants in Shopify admin first.

**File: `snippets/ks-product-pet-selector.liquid`**

**Add variant selection logic:**

```javascript
// Update product variant based on pet count
function updateProductVariantForPetCount(petCount, totalPrice) {
  if (!window.productVariants) return;
  
  // Find variant that matches pet count
  var targetVariant = null;
  
  window.productVariants.forEach(function(variant) {
    var title = variant.title.toLowerCase();
    
    if (petCount === 1 && (title.includes('1 pet') || title.includes('single'))) {
      targetVariant = variant;
    } else if (petCount === 2 && title.includes('2 pet')) {
      targetVariant = variant;
    } else if (petCount === 3 && title.includes('3 pet')) {
      targetVariant = variant;
    }
  });
  
  if (targetVariant) {
    // Update variant selection in product form
    var variantInput = document.querySelector('input[name="id"]');
    if (variantInput && variantInput.value !== targetVariant.id.toString()) {
      variantInput.value = targetVariant.id;
      
      // Trigger Shopify's variant change handling
      variantInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('Selected variant for', petCount, 'pets:', targetVariant.title);
    }
  }
}

// Hook into pet selection events
document.addEventListener('petSelected', function(e) {
  setTimeout(updateMultiPetPricing, 100);
});

// Hook into pet deletion
window.originalDeletePet = window.deletePet;
window.deletePet = function(sessionKey) {
  if (window.originalDeletePet) {
    window.originalDeletePet(sessionKey);
  }
  setTimeout(updateMultiPetPricing, 500);
};
```

### Phase 4: Backend Price Enforcement (1 hour)

**For TRUE price enforcement, create variants in Shopify admin:**

1. **For each "Custom" tagged product, create variants:**
   - "Custom Art - 1 Pet" (original price)
   - "Custom Art - 2 Pets" (original price + $5.00)
   - "Custom Art - 3 Pets" (original price + $10.00)

2. **Set up variant options in Shopify:**
   - Option Name: "Pet Count"
   - Option Values: "1 Pet", "2 Pets", "3 Pets"

3. **Update inventory/SKUs as needed**

## Critical Limitations & Workarounds

### 1. Shopify Technical Constraints

**What This Implementation CANNOT Do:**
- ❌ Prevent customers from manually changing variants in cart
- ❌ Enforce pricing if customer bypasses JavaScript
- ❌ Work with cart manipulation tools/browser extensions
- ❌ Handle complex tax calculations for fees

**What This Implementation CAN Do:**
- ✅ Show correct pricing in product UI
- ✅ Automatically select appropriate variant
- ✅ Work for 99% of normal customer behavior
- ✅ Provide clear pricing communication

### 2. Edge Cases & Solutions

**User deletes pet after variant selection:**
```javascript
// Add to deletePet function
function updatePricingAfterDeletion() {
  setTimeout(function() {
    updateMultiPetPricing();
    // Force re-selection if needed
    var petCount = countSelectedPets();
    if (petCount === 0) {
      // Reset to default variant
      var defaultVariant = window.productVariants[0];
      if (defaultVariant) {
        document.querySelector('input[name="id"]').value = defaultVariant.id;
      }
    }
  }, 200);
}
```

**Session expiration:**
- Pet count persists in localStorage
- Pricing calculations work cross-page
- Fallback to UI count if session data missing

**Mobile storage limits:**
- Pricing logic doesn't depend on image storage
- Only pet count needed for calculations

### 3. Implementation Priority (User Explicit Request)

1. **Phase 1**: Fix $0.05 display (30 mins) - IMMEDIATE
2. **Phase 2**: Add tiered pricing display (2 hours) - THIS WEEK  
3. **Phase 3**: Variant integration (3 hours) - FOR ENFORCEMENT
4. **Phase 4**: Shopify variant setup (1 hour) - ADMIN TASK

**Note**: User explicitly requested this pricing despite PM concerns. Implement as requested with clear pricing communication.

## Testing Requirements

### 1. Pricing Display Tests
- **1 pet selected**: Shows "Product: $X.XX" + "Total: $X.XX" (no additional fee)
- **2 pets selected**: Shows "+ 1 Additional Pet: $5.00" + correct total
- **3 pets selected**: Shows "+ 2 Additional Pets: $10.00" + correct total
- **Pet deletion**: Pricing updates immediately when pet removed

### 2. Variant Selection Tests (if implemented)
- **1 pet**: "1 Pet" variant automatically selected
- **2 pets**: "2 Pets" variant automatically selected  
- **3 pets**: "3 Pets" variant automatically selected
- **Cart verification**: Correct variant/price in cart matches selection

### 3. Cross-Page Persistence
- Process pets on `/pages/pet-background-remover`
- Navigate to product page
- Verify correct pet count and pricing display
- Add to cart and verify checkout price

### 4. Mobile Testing (70% of users)
- Pricing display readable on mobile
- Touch interactions don't break pricing updates
- Variant selection works on mobile Safari/Chrome

## Files That Will Be Modified

1. **`snippets/ks-product-pet-selector.liquid`**
   - Lines 68-76: Remove static fee display
   - Add dynamic pricing container and JavaScript logic
   - Total changes: ~50 lines

2. **`sections/main-product.liquid`** (if variant support added)
   - Modify pet selector block settings
   - Add variant configuration options

## Rollback Plan

**If pricing causes conversion issues:**
1. Comment out `updateMultiPetPricing()` calls
2. Hide pricing display: `pricingContainer.style.display = 'none'`
3. Return to free model immediately
4. Monitor impact for 24-48 hours

## Direct Answers to Technical Questions

**Q: Can we implement tiered pricing without creating product variants?**
**A: Yes, for display only. No, for true price enforcement.**

**Q: What's the simplest way to add dynamic fees in Shopify?**
**A: JavaScript price display + product variants for enforcement.**

**Q: How do we handle this in the cart/checkout flow?**
**A: Variant selection handles pricing; line item properties store pet data.**

**Q: What are the technical limitations we need to work around?**
**A: Shopify line items can't have dynamic pricing without variants or Shopify Plus scripts.**

## Summary: Implementation Path

1. **Quick Fix** (30 min): Remove "$0.05" display bug
2. **Pricing Display** (2 hours): Show correct tiered pricing  
3. **Enforcement** (4 hours): Add variants + automatic selection
4. **Testing** (2 hours): Verify across devices and user flows

**Total Effort**: ~8.5 hours for complete implementation with price enforcement