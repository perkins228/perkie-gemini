# Variant Event Dispatch Failure - Root Cause Analysis

**Date**: 2025-11-05
**Status**: CRITICAL - Variant matching works but price/cart updates fail
**Session**: context_session_001.md
**File**: `snippets/ks-product-pet-selector-stitch.liquid` (lines 1250-1405)

---

## Executive Summary

The pet selector successfully matches and updates the variant ID, but Shopify's theme does not visually update the price or add the correct variant to cart. **Root cause**: We're dispatching events but not triggering Shopify's pub/sub system that drives the actual UI updates.

### What Works ✅
- Variant matching logic (finds correct variant by public_title)
- Variant ID updates in DOM (`variantInput.value = matchingVariant.id`)
- Basic event dispatching (no errors)
- Console logging shows success messages

### What Fails ❌
- Price display doesn't update visually on page
- Cart shows wrong pet count after add-to-cart
- Shopify's theme components don't respond to our changes

---

## Root Cause Analysis

### The Shopify Event Flow

Shopify Dawn theme uses a **pub/sub architecture** for variant changes:

1. **User interaction** → `<variant-selects>` custom element
2. **variant-selects** dispatches → `PUB_SUB_EVENTS.optionValueSelectionChange`
3. **product-info** component subscribes → handles variant lookup & URL update
4. **product-info** publishes → `PUB_SUB_EVENTS.variantChange`
5. **Price components** subscribe → update price display

**Critical Discovery**: Our code bypasses this entire flow by directly setting `variantInput.value` and dispatching DOM events. Shopify's components never receive the `PUB_SUB_EVENTS` notifications.

### Code Evidence

#### What We're Doing (WRONG)
```javascript
// Line 1372: Direct value assignment
variantInput.value = matchingVariant.id;

// Lines 1379-1380: Basic DOM event
const changeEvent = new Event('change', { bubbles: true });
variantInput.dispatchEvent(changeEvent);

// Lines 1384-1391: Custom event (not Shopify's pub/sub)
const variantChangeEvent = new CustomEvent('variant:change', {
  bubbles: true,
  detail: { variant: matchingVariant, sectionId: form.dataset.sectionId || 'main' }
});
document.dispatchEvent(variantChangeEvent);

// Lines 1398-1413: Manual price update (bypasses Shopify components)
function updatePriceDisplay(variant) {
  const priceElement = document.querySelector('.price__regular .price-item--regular');
  priceElement.textContent = `$${(variant.price / 100).toFixed(2)}`;
}
```

**Why This Fails**:
- `change` event on `<input name="id">` doesn't trigger `<variant-selects>` logic
- Custom `variant:change` event is not part of Shopify's pub/sub system
- Manual DOM manipulation (`priceElement.textContent`) gets overridden by Shopify
- No `PUB_SUB_EVENTS` means no component communication

#### What Shopify Does (CORRECT)
```javascript
// global.js line 1069-1080
class VariantSelects extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', (event) => {
      const target = this.getInputForEventTarget(event.target);
      this.updateSelectionMetadata(event);

      // CRITICAL: Uses Shopify's publish() function
      publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
        data: {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
      });
    });
  }
}
```

```javascript
// product-info.js line 23-26
this.onVariantChangeUnsubscriber = subscribe(
  PUB_SUB_EVENTS.optionValueSelectionChange,
  this.handleOptionValueChange.bind(this)
);
```

---

## Why Console Shows Success But UI Doesn't Update

### Mystery: "✅ Price display updated: $80.00" but price stays $60.00

**Explanation**:
1. Our code executes: `priceElement.textContent = priceFormatted` (line 1412)
2. Console logs: "✅ Price display updated: $80.00"
3. **BUT** Shopify's product-info component ALSO subscribes to cart updates
4. When user clicks "Add to Cart", Shopify's code fetches the current page HTML
5. Shopify extracts price from HTML and updates DOM, **overwriting our change**
6. User sees original price ($60.00) because Shopify doesn't know variant changed

**Evidence**: product-info.js line 214-220
```javascript
publish(PUB_SUB_EVENTS.variantChange, {
  data: { sectionId: this.sectionId, html, variant }
});
```
This triggers price components to re-render from fetched HTML, which contains the OLD variant's price.

---

## Why Cart Shows Wrong Pet Count

### The Add-to-Cart Flow

1. User selects "2 Pets" → our code updates variant ID to match "2 Pets" variant
2. User clicks "Add to Cart" → `product-form.js` submits form
3. Form includes: `<input name="id" value="43096709988435">` (correct variant ID)
4. **BUT** cart drawer fetches product info via Shopify's Section Rendering API
5. API response includes variant data based on **URL** (not form submission)
6. URL still shows `?variant=OLD_VARIANT_ID` because we never updated it
7. Cart displays wrong pet count from URL variant, not form variant

**Evidence**: product-info.js line 170
```javascript
this.updateURL(productUrl, variant?.id);
```
This is ONLY called when `PUB_SUB_EVENTS.optionValueSelectionChange` fires, which our code doesn't trigger.

---

## Diagnostic Questions Answered

### 1. Why does console show "✅ Price display updated" but price doesn't change?
**Answer**: Our code DOES update the DOM temporarily, but Shopify's components re-render from HTML fetched via AJAX, which contains the old variant's price. Our change gets overwritten within milliseconds.

### 2. Why does Shopify event dispatch succeed but cart shows wrong pet count?
**Answer**: We dispatch DOM events, but Shopify uses a **pub/sub system** (`publish()`/`subscribe()` functions). DOM events don't trigger pub/sub subscribers, so Shopify never knows the variant changed.

### 3. Is there legacy code interfering?
**Answer**: No, legacy code is not the issue. The problem is architectural - we're working outside Shopify's component communication system.

---

## Solution Strategy

### Option 1: Trigger Shopify's Variant Selector (RECOMMENDED)

Instead of directly setting `variantInput.value`, we should:
1. Find the `<variant-selects>` component
2. Locate the option inputs that match our desired variant
3. Programmatically change those inputs (trigger `change` event)
4. Let Shopify's flow handle the rest naturally

**Implementation**:
```javascript
function updateVariantSelection(petCount) {
  // Find variant-selects component
  const variantSelects = document.querySelector('variant-selects');
  if (!variantSelects) return;

  // Find the option that contains pet count (e.g., "Number of Pets" option)
  const petCountOption = variantSelects.querySelector('select[name="options[Number of Pets]"]');
  if (!petCountOption) return;

  // Set the value to match pet count
  const targetValue = `${petCount} ${petCount === 1 ? 'Pet' : 'Pets'}`;
  const targetOption = Array.from(petCountOption.options).find(
    opt => opt.textContent.trim() === targetValue
  );

  if (targetOption) {
    // Programmatically select the option
    targetOption.selected = true;

    // Dispatch change event on SELECT element (not input[name="id"])
    const changeEvent = new Event('change', { bubbles: true });
    petCountOption.dispatchEvent(changeEvent);

    // variant-selects will handle the rest via pub/sub
  }
}
```

**Why This Works**:
- Triggers `variant-selects` change listener (line 1069 in global.js)
- Fires `publish(PUB_SUB_EVENTS.optionValueSelectionChange, ...)`
- `product-info` subscribes and handles variant lookup
- URL updates automatically
- Price updates automatically
- All Shopify components receive notifications

### Option 2: Use Shopify's Publish Function Directly (ADVANCED)

If we have access to `window.publish()`:
```javascript
function updateVariantSelection(petCount) {
  const matchingVariant = findVariantByPetCount(petCount);
  if (!matchingVariant) return;

  // Use Shopify's pub/sub system
  if (typeof window.publish === 'function') {
    publish(PUB_SUB_EVENTS.variantChange, {
      data: {
        sectionId: 'main',
        variant: matchingVariant,
        html: document.documentElement // Full page HTML
      }
    });
  }
}
```

**Risks**:
- Requires Shopify's `publish()` function to be globally available
- May need to construct proper HTML context
- More fragile than Option 1

### Option 3: Trigger Product Form Update (HYBRID)

Combine our approach with Shopify's:
```javascript
function updateVariantSelection(petCount) {
  const matchingVariant = findVariantByPetCount(petCount);
  if (!matchingVariant) return;

  // 1. Update variant input (for add-to-cart)
  variantInput.value = matchingVariant.id;

  // 2. Find and trigger product-info component's update method
  const productInfo = document.querySelector('product-info');
  if (productInfo && productInfo.updateVariantInputs) {
    productInfo.updateVariantInputs(matchingVariant.id);
  }

  // 3. Manually update URL (since we're bypassing variant-selects)
  const url = new URL(window.location);
  url.searchParams.set('variant', matchingVariant.id);
  window.history.replaceState({}, '', url);

  // 4. Trigger Shopify's variant change event via pub/sub
  if (typeof window.publish === 'function') {
    publish(PUB_SUB_EVENTS.variantChange, {
      data: {
        sectionId: 'main',
        variant: matchingVariant
      }
    });
  }
}
```

---

## Enhanced Diagnostic Logging

To confirm our hypothesis, add this diagnostic code:

```javascript
// Add after line 1372 (variant ID update)
console.log('🔍 DEBUG: Variant input value BEFORE:', currentVariantId);
console.log('🔍 DEBUG: Variant input value AFTER:', variantInput.value);

// Check if value persists
setTimeout(() => {
  const actualValue = form.querySelector('input[name="id"]').value;
  console.log('🔍 DEBUG: Variant input 500ms later:', actualValue);
}, 500);

// Verify price element update
const priceElement = document.querySelector('.price__regular .price-item--regular');
console.log('🔍 DEBUG: Price element BEFORE update:', priceElement?.textContent);
// ... after price update ...
console.log('🔍 DEBUG: Price element AFTER update:', priceElement?.textContent);

setTimeout(() => {
  console.log('🔍 DEBUG: Price element 500ms later:',
    document.querySelector('.price__regular .price-item--regular')?.textContent
  );
}, 500);

// Check for Shopify components
const productForm = form.closest('product-form');
const variantSelects = document.querySelector('variant-selects');
const productInfo = document.querySelector('product-info');
console.log('🔍 DEBUG: product-form element:', productForm);
console.log('🔍 DEBUG: variant-selects element:', variantSelects);
console.log('🔍 DEBUG: product-info element:', productInfo);

// Check pub/sub availability
console.log('🔍 DEBUG: window.publish available:', typeof window.publish);
console.log('🔍 DEBUG: PUB_SUB_EVENTS available:', typeof window.PUB_SUB_EVENTS);
```

**Expected Output (if hypothesis correct)**:
```
🔍 DEBUG: Variant input value BEFORE: 43096709988434
🔍 DEBUG: Variant input value AFTER: 43096709988435
🔍 DEBUG: Variant input 500ms later: 43096709988435 ✅ (persists)
🔍 DEBUG: Price element BEFORE update: $60.00
🔍 DEBUG: Price element AFTER update: $80.00
🔍 DEBUG: Price element 500ms later: $60.00 ❌ (reverted!)
🔍 DEBUG: product-form element: <product-form>
🔍 DEBUG: variant-selects element: <variant-selects>
🔍 DEBUG: product-info element: <product-info>
🔍 DEBUG: window.publish available: function
🔍 DEBUG: PUB_SUB_EVENTS available: object
```

---

## Implementation Plan

### Phase 1: Verify Hypothesis (1 hour)
1. Add diagnostic logging to confirm:
   - Price reverts after our update
   - Variant ID persists but URL doesn't change
   - Shopify components exist and have `publish()`
2. Test on Shopify test URL with Chrome DevTools MCP
3. Document exact reversion timing and component availability

### Phase 2: Implement Option 1 (2-3 hours)
1. Locate `<variant-selects>` and option selectors
2. Map pet count to option values
3. Programmatically trigger option change
4. Remove manual price update code (let Shopify handle it)
5. Test add-to-cart flow end-to-end

### Phase 3: Fallback to Option 3 if Needed (2 hours)
1. If Option 1 fails (no accessible selectors), use hybrid approach
2. Implement URL update manually
3. Call `publish()` directly if available
4. Keep variant input update for add-to-cart

### Phase 4: Verification (1 hour)
1. Test all pet count selections (1-3 pets)
2. Verify price updates correctly
3. Add to cart and verify cart shows correct pet count
4. Test returning customer orders with existing Perkie Prints
5. Mobile testing

---

## Risk Assessment

### Option 1 Risks
- **Low Risk**: Uses Shopify's intended flow
- **Potential Issue**: May not find option selectors if product uses variant IDs instead of options
- **Mitigation**: Check product variant structure, may need to map pet count → variant ID

### Option 2 Risks
- **Medium Risk**: Relies on Shopify internals
- **Potential Issue**: `publish()` may not be globally accessible
- **Mitigation**: Feature detection, fallback to Option 1 or 3

### Option 3 Risks
- **Medium Risk**: Hybrid approach may cause conflicts
- **Potential Issue**: Manual URL update + pub/sub may double-trigger
- **Mitigation**: Careful event sequencing, debouncing

---

## Files to Modify

1. **`snippets/ks-product-pet-selector-stitch.liquid`** (lines 1357-1419)
   - Replace direct variant input update with Option 1 implementation
   - Remove manual `updatePriceDisplay()` function
   - Add diagnostic logging temporarily

2. **Testing Required**
   - Shopify test URL (ask user for current URL)
   - Chrome DevTools MCP for console inspection
   - Test all pet count options (1, 2, 3 pets)
   - Test add-to-cart with different variants

---

## Next Steps

1. **Ask user for current Shopify test URL**
2. **Add diagnostic logging** (Phase 1)
3. **Test with Chrome DevTools MCP** to confirm hypothesis
4. **Implement Option 1** (recommended approach)
5. **Update `context_session_001.md`** with findings and commit reference

---

## References

- **Shopify Dawn Pub/Sub**: `assets/global.js` lines 1-50 (PUB_SUB_EVENTS definition)
- **VariantSelects**: `assets/global.js` lines 1063-1126
- **ProductInfo**: `assets/product-info.js` lines 19-360
- **Product Form**: `assets/product-form.js` lines 1-165
- **Buy Buttons**: `snippets/buy-buttons.liquid` lines 27-117
- **Current Implementation**: `snippets/ks-product-pet-selector-stitch.liquid` lines 1250-1429

---

## Key Takeaways

1. **Don't bypass Shopify's component system** - Use pub/sub, not direct DOM manipulation
2. **Trigger events on the right elements** - Change events on variant selectors, not variant inputs
3. **Let Shopify handle UI updates** - Don't manually update price, URL, etc.
4. **Test with real Shopify environment** - Local HTML can't replicate component interactions
5. **Use Chrome DevTools MCP** - Essential for debugging component communication
