# Shopify Dawn Variant Integration Analysis
**Issue**: Variant updates but price/cart don't reflect changes
**Date**: 2025-11-05
**Priority**: CRITICAL - Blocking Conversion

## Executive Summary

The pet selector successfully updates the variant ID and dispatches events, but Shopify Dawn's product-info component doesn't recognize the change. This causes:

1. **Price Display**: Shows wrong price (original variant price, not updated variant price)
2. **Cart Items**: Shows wrong pet count ("1 Pet" instead of "2 Pets")
3. **Order Data**: Wrong variant ends up in cart despite correct console logs

**Root Cause**: Our code directly manipulates variant inputs and dispatches generic events, but Dawn's architecture requires triggering through its pub/sub system with specific event patterns.

---

## Shopify Dawn Architecture Analysis

### 1. Custom Element System

Dawn uses custom HTML elements for variant management:

```javascript
// Core Components (assets/product-info.js)
<product-info>          // Main container (lines 1-426)
  <variant-selects>     // Variant selector wrapper (line 402)
    <product-form>      // Form submission handler (assets/product-form.js)
```

**Key Insight**: Dawn doesn't use traditional DOM event listeners. It uses a pub/sub system defined in `assets/constants.js`.

### 2. Pub/Sub Event System

```javascript
// From assets/constants.js (lines 3-9)
const PUB_SUB_EVENTS = {
  cartUpdate: 'cart-update',
  quantityUpdate: 'quantity-update',
  optionValueSelectionChange: 'option-value-selection-change',  // ← Key event
  variantChange: 'variant-change',                               // ← Response event
  cartError: 'cart-error',
};
```

**Event Flow**:
```
User Interaction
    ↓
optionValueSelectionChange (publish)
    ↓
product-info.handleOptionValueChange() (subscribe)
    ↓
Fetch new variant data from Shopify
    ↓
Update DOM elements (price, SKU, inventory)
    ↓
variantChange (publish)
    ↓
Other components respond (cart, analytics, etc.)
```

### 3. Product Info Component Behavior

**From `assets/product-info.js` (lines 23-26, 63-80)**:

```javascript
connectedCallback() {
  this.onVariantChangeUnsubscriber = subscribe(
    PUB_SUB_EVENTS.optionValueSelectionChange,  // Listens for THIS
    this.handleOptionValueChange.bind(this)
  );
  // ...
}

handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
  if (!this.contains(event.target)) return;

  this.resetProductFormState();

  const productUrl = target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
  this.pendingRequestUrl = productUrl;
  const shouldSwapProduct = this.dataset.url !== productUrl;
  const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;

  this.renderProductInfo({
    requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues, shouldFetchFullPage),
    targetId: target.id,
    callback: shouldSwapProduct
      ? this.handleSwapProduct(productUrl, shouldFetchFullPage)
      : this.handleUpdateProductInfo(productUrl),
  });
}
```

**Critical Discovery**:
1. product-info listens for `optionValueSelectionChange` (NOT generic 'change')
2. It fetches fresh HTML from Shopify's server with variant data
3. It updates ALL price elements by ID (lines 195-199):
   - `price-${sectionId}` (main price)
   - `Sku-${sectionId}` (SKU display)
   - `Inventory-${sectionId}` (stock info)
   - `Volume-${sectionId}` (volume pricing)
   - `Price-Per-Item-${sectionId}` (per-item pricing)

### 4. Price Update Mechanism

**From `assets/product-info.js` (lines 180-212)**:

```javascript
handleUpdateProductInfo(productUrl) {
  return (html) => {
    const variant = this.getSelectedVariant(html);

    // ... other updates ...

    const updateSourceFromDestination = (id, shouldHide = (source) => false) => {
      const source = html.getElementById(`${id}-${this.sectionId}`);

      // Scope to main product only - exclude complementary products
      const destination = Array.from(this.querySelectorAll(`#${id}-${this.dataset.section}`))
        .find(el => !el.closest('.complementary-products, .card-wrapper'));

      if (source && destination) {
        destination.innerHTML = source.innerHTML;  // ← Replaces entire HTML
        destination.classList.toggle('hidden', shouldHide(source));
      }
    };

    updateSourceFromDestination('price');  // ← Updates price by fetching from server
    // ... other fields ...

    publish(PUB_SUB_EVENTS.variantChange, {
      data: {
        sectionId: this.sectionId,
        html,
        variant,
      },
    });
  };
}
```

**Key Insight**: Dawn doesn't read prices from variant data attributes. It fetches the entire rendered HTML from Shopify's server and swaps price element innerHTML.

---

## Current Implementation Analysis

### What Our Code Does (Lines 2961-3068 in pet-selector)

```javascript
function updateVariantForPetCount(petCount) {
  console.log('🔥 updateVariantForPetCount called with:', petCount);

  // Method 1: Update variant-selects radio buttons
  var variantRadios = variantSelectsElement.querySelectorAll('input[type="radio"]');
  variantRadios.forEach(function(radio) {
    if (/* matches target variant */) {
      radio.checked = true;
      radio.click();  // ← Triggers click
      radio.dispatchEvent(new Event('change', { bubbles: true }));  // ← Generic event
      found = true;
    }
  });

  // Method 2: Update option selects
  // Method 3: Update direct variant ID inputs
}
```

### Why This Fails

1. **Wrong Event Type**: We dispatch generic `'change'` events
   - Dawn expects: `PUB_SUB_EVENTS.optionValueSelectionChange`
   - We send: `new Event('change')`

2. **No Pub/Sub Integration**: We don't use Dawn's publish() function
   - Dawn's system: `publish(PUB_SUB_EVENTS.optionValueSelectionChange, { data })`
   - Our system: Direct DOM manipulation

3. **Missing Event Data**: Dawn expects specific data structure
   - Required: `{ event, target, selectedOptionValues }`
   - We provide: Empty event object

4. **No Server Fetch**: We update DOM directly
   - Dawn: Fetches fresh HTML from `/products/foo?variant=123&section_id=xxx`
   - Us: Change input value and hope for the best

5. **Price Element Mismatch**: We target wrong selectors
   - Our code: `.price__regular .price-item--regular`
   - Dawn expects: `#price-${sectionId}` (entire container)

---

## Why Console Shows "Success" But UI Doesn't Update

### Console Logs Show:
```
✅ Variant updated: 2 Pets (ID: 42893695557806) Price: $80.00
✅ Price display updated: $80.00
✅ Dispatched variant change event
```

### What Actually Happens:

1. **Our code runs**: Updates hidden input `name="id"` to new variant ID
2. **Console log succeeds**: Reads the value we just set
3. **Events dispatched**: Generic 'change' and 'variant:change' events fire
4. **BUT**: product-info component never hears these events
5. **Result**: Dawn's internal state still points to original variant
6. **Cart submission**: Uses Dawn's internal state (wrong variant)

### The Smoking Gun

**From `assets/product-info.js` (lines 224-231)**:

```javascript
updateVariantInputs(variantId) {
  this.querySelectorAll(
    `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
  ).forEach((productForm) => {
    const input = productForm.querySelector('input[name="id"]');
    input.value = variantId ?? '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
```

**Key Discovery**: Dawn sets the variant input AFTER fetching from server. When we set it first, Dawn overwrites it back to the original value if we trigger the wrong event flow.

---

## Correct Integration Strategy

### Option 1: Use Dawn's Pub/Sub System (RECOMMENDED)

**Trigger variant change through Dawn's architecture**:

```javascript
// Find the variant radio/select that matches our target
const targetRadio = document.querySelector(`input[value="${variantId}"]`);

if (targetRadio) {
  // Simulate user clicking the radio button
  // This triggers Dawn's internal handlers which fire optionValueSelectionChange
  targetRadio.click();

  // Dawn will:
  // 1. Detect the radio change
  // 2. Publish optionValueSelectionChange
  // 3. Fetch fresh HTML from Shopify
  // 4. Update ALL price elements
  // 5. Publish variantChange for other components
}
```

**Why this works**:
- Leverages Dawn's existing event flow
- No custom pub/sub integration needed
- Gets fresh HTML from Shopify (correct prices)
- Updates ALL related elements automatically

### Option 2: Integrate with Pub/Sub System (COMPLEX)

**Publish the event Dawn expects**:

```javascript
// Import pub/sub functions (need to expose them globally)
const publish = window.publish;  // Must be exposed by constants.js

// Get variant data
const selectedVariant = productData.variants.find(v => v.id === variantId);
const optionValues = selectedVariant.options.map(opt => opt.toLowerCase());

// Publish the event Dawn listens for
publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
  data: {
    event: new Event('change'),
    target: variantSelectsElement,
    selectedOptionValues: optionValues
  }
});
```

**Challenges**:
- Requires modifying constants.js to expose publish() globally
- Need to construct proper selectedOptionValues array
- Must ensure event.target is correct element
- More fragile (depends on internal API)

### Option 3: Trigger Native Shopify Event (HYBRID)

**Use Shopify's section rendering API**:

```javascript
function updateVariantForPetCount(petCount) {
  // 1. Find matching variant
  const matchingVariant = productData.variants.find(v => {
    return v.title === targetVariantText;
  });

  if (!matchingVariant) return;

  // 2. Update variant input (for form submission)
  const variantInput = document.querySelector('input[name="id"]');
  variantInput.value = matchingVariant.id;

  // 3. Fetch section with new variant
  const sectionId = document.querySelector('product-info').dataset.section;
  const url = `${window.location.pathname}?variant=${matchingVariant.id}&section_id=${sectionId}`;

  fetch(url)
    .then(response => response.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 4. Update price element
      const newPrice = doc.getElementById(`price-${sectionId}`);
      const currentPrice = document.getElementById(`price-${sectionId}`);
      if (newPrice && currentPrice) {
        currentPrice.innerHTML = newPrice.innerHTML;
      }

      // 5. Publish variantChange for other components
      publish(PUB_SUB_EVENTS.variantChange, {
        data: {
          sectionId: sectionId,
          html: doc,
          variant: matchingVariant
        }
      });
    });
}
```

**Benefits**:
- Gets correct prices from Shopify
- Updates cart properly
- Works with Dawn's architecture

**Challenges**:
- Still need publish() exposed
- More complex implementation
- Duplicates Dawn's logic

---

## Recommended Solution: Option 1 (Simulate User Click)

### Implementation Plan

**File**: `snippets/ks-product-pet-selector.liquid` (lines 2961-3068)

**Changes**:

```javascript
function updateVariantForPetCount(petCount) {
  console.log('🔄 Updating variant for pet count:', petCount);

  // Prevent infinite loop
  if (window.variantSyncDisabled) {
    console.log('⏸️ Variant update skipped (sync in progress)');
    return;
  }

  // Determine target variant text
  var targetVariantText = '';
  if (petCount === 0 || petCount === 1) {
    targetVariantText = '1 Pet';
  } else if (petCount === 2) {
    targetVariantText = '2 Pets';
  } else if (petCount >= 3) {
    targetVariantText = '3 Pets';
  }

  console.log('🎯 Target variant:', targetVariantText);

  // CRITICAL FIX: Find variant radio/select and simulate user interaction
  var variantSelectsElement = document.querySelector('variant-selects');
  if (!variantSelectsElement) {
    console.warn('⚠️ variant-selects element not found');
    return;
  }

  // Find matching radio button
  var variantRadios = variantSelectsElement.querySelectorAll('input[type="radio"]');
  var matchingRadio = null;

  variantRadios.forEach(function(radio) {
    var label = variantSelectsElement.querySelector('label[for="' + radio.id + '"]');
    if (label) {
      var labelText = label.textContent.trim().toLowerCase();
      var targetLower = targetVariantText.toLowerCase();

      if (labelText === targetLower || labelText.startsWith(targetLower)) {
        matchingRadio = radio;
      }
    }
  });

  if (matchingRadio) {
    console.log('✅ Found matching variant radio');

    // CRITICAL: Simulate real user interaction
    // This triggers Dawn's internal handlers properly
    matchingRadio.checked = true;

    // Use MouseEvent for more realistic simulation
    var clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    matchingRadio.dispatchEvent(clickEvent);

    // Let Dawn's handlers process the change
    setTimeout(function() {
      console.log('✅ Variant update complete');
    }, 100);

    return;
  }

  console.warn('⚠️ No matching variant found for:', targetVariantText);
}
```

### Why This Works

1. **Native Event Flow**: Clicking the radio triggers Dawn's built-in handlers
2. **Proper Event Cascade**:
   - Radio click → Dawn detects → publishes optionValueSelectionChange
   - product-info subscribes → fetches HTML → updates prices
   - Publishes variantChange → other components update
3. **No Custom Integration**: Works with existing architecture
4. **Reliable**: Uses same path as manual user selection

---

## Additional Issues to Fix

### 1. Price Display Elements

**Current Code** (searching for wrong selectors):
```javascript
var priceElement = document.querySelector('.price__regular .price-item--regular');
```

**Should Remove**: Price updates should be handled entirely by Dawn's product-info component after variant change.

### 2. Event Duplication

**Current Code** dispatches multiple events:
```javascript
radio.click();
radio.dispatchEvent(new Event('change', { bubbles: true }));
```

**Should Be**: Just click(), Dawn handles the rest.

### 3. Cart Integration

**Current State**: Cart shows wrong variant because product-form reads from Dawn's internal state, not our updated input.

**Fix**: Once variant change triggers properly through Dawn, cart will automatically use correct variant.

---

## Testing Strategy

### Test Cases

1. **Single Pet Selection**
   - Expected: Variant "1 Pet" selected
   - Price: Shows 1 pet price
   - Cart: Contains "1 Pet" variant

2. **Two Pet Selection**
   - Expected: Variant "2 Pets" selected
   - Price: Shows 2 pets price (base + fee)
   - Cart: Contains "2 Pets" variant

3. **Three Pet Selection**
   - Expected: Variant "3 Pets" selected
   - Price: Shows 3 pets price (base + 2× fee)
   - Cart: Contains "3 Pets" variant

4. **Rapid Changes**
   - Change from 1 → 2 → 3 quickly
   - Each change should update price
   - Final cart should reflect last selection

### Console Verification

After fix, should see:
```
🔄 Updating variant for pet count: 2
🎯 Target variant: 2 Pets
✅ Found matching variant radio
✅ Variant update complete
[Dawn's logs showing optionValueSelectionChange → fetch → variantChange]
```

### DOM Verification

Check these elements update:
```javascript
// Main price container (should be updated by Dawn)
document.getElementById('price-template--xxx__main');

// Variant input (should be updated by Dawn)
document.querySelector('input[name="id"]').value;  // Should be correct variant ID

// Cart drawer/notification (after add to cart)
// Should show correct variant title and price
```

---

## Implementation Steps

1. **Update `updateVariantForPetCount()` function** (lines 2961-3068)
   - Remove all price update logic
   - Remove generic event dispatching
   - Keep only radio button click simulation
   - Use MouseEvent for realistic interaction

2. **Remove manual price updates** (throughout pet-selector)
   - Delete `updatePriceDisplay()` calls
   - Delete `.price__regular` selectors
   - Trust Dawn to handle prices

3. **Clean up event listeners**
   - Remove redundant 'change' event dispatching
   - Remove 'variant:change' custom events
   - Let Dawn's pub/sub handle all events

4. **Test on Shopify test environment**
   - Use Chrome DevTools MCP with test URL
   - Test all 3 pet count scenarios
   - Verify cart contains correct variants
   - Check order confirmation shows correct data

5. **Monitor for issues**
   - Watch console for errors
   - Check if prices update immediately
   - Verify no race conditions
   - Test on mobile and desktop

---

## Risk Assessment

### Low Risk
- Simulating user clicks is a standard pattern
- Works with Dawn's existing architecture
- No modification to Shopify core files

### Medium Risk
- Timing issues if Dawn handlers are slow
- May need debouncing for rapid changes
- Could conflict with other JS on page

### Mitigation
- Add timeout for Dawn to process (100ms)
- Maintain sync lock (variantSyncDisabled flag)
- Test thoroughly before deploying

---

## Alternative: KondaSoft Product Component

**Observation**: The site uses KondaSoft's `ks-product.js` components.

**From `assets/ks-product.js` (lines 197-254)**:

KondaSoft has a sticky ATC component with variant synchronization:
```javascript
onMainProductFormVariantChange() {
  this.variantSelector.value = this.mainVariantInput.value;
  this.variantSelector.dispatchEvent(new Event("change"));
}
```

**Potential Issue**: If KondaSoft components are intercepting variant changes, we may need to trigger their events too.

**Investigation Needed**:
- Check if KondaSoft overrides Dawn's variant handling
- Test if clicking radio updates KondaSoft's sticky ATC
- Verify KondaSoft doesn't block Dawn's pub/sub

---

## Success Criteria

**Must Have**:
1. ✅ Variant updates when pet count changes
2. ✅ Price displays correct variant price
3. ✅ Cart contains correct variant ID and title
4. ✅ Add to cart sends correct variant data

**Nice to Have**:
1. ✅ Smooth transition (no flicker)
2. ✅ Works on mobile and desktop
3. ✅ No console errors
4. ✅ Fast response (<100ms)

---

## Appendix: Dawn's Variant Change Flow

```
USER ACTION
    ↓
[1] Radio Button Click
    ↓
[2] variant-selects detects change
    ↓
[3] variant-selects publishes:
    PUB_SUB_EVENTS.optionValueSelectionChange
    └─ data: {
         event: MouseEvent
         target: radio element
         selectedOptionValues: ['2 pets']
       }
    ↓
[4] product-info subscribes and receives event
    ↓
[5] product-info.handleOptionValueChange()
    └─ Builds URL: /products/foo?option_values=2+pets&section_id=xxx
    └─ Fetches HTML from Shopify
    ↓
[6] product-info.handleUpdateProductInfo()
    └─ Parses HTML response
    └─ Updates DOM elements:
        • #price-{sectionId}
        • #Sku-{sectionId}
        • #Inventory-{sectionId}
        • input[name="id"] (variant ID)
    ↓
[7] product-info publishes:
    PUB_SUB_EVENTS.variantChange
    └─ data: {
         sectionId: 'template--xxx__main'
         html: DOMParser result
         variant: { id, price, title, ... }
       }
    ↓
[8] Other components subscribe and update:
    • price-per-item (volume pricing)
    • enhanced-product-form (analytics)
    • cart-notification (preview)
    • Any custom listeners
```

**Our Goal**: Insert at step [1] and let Dawn handle [2-8] automatically.

---

## Next Steps

1. **Implement Solution**: Update `updateVariantForPetCount()` to use click simulation
2. **Remove Dead Code**: Delete manual price update logic
3. **Test Locally**: Use Chrome DevTools MCP with Shopify test URL
4. **Deploy**: Commit to main branch (auto-deploys to test environment)
5. **Verify**: Check console, prices, and cart on test site
6. **Monitor**: Watch for any edge cases or timing issues

---

## Conclusion

The variant update failure is caused by bypassing Dawn's pub/sub architecture. Our code directly manipulates DOM elements and dispatches generic events that Dawn doesn't recognize.

**Fix**: Simulate real user interaction (radio button click) to trigger Dawn's built-in variant change flow. This ensures:
- Correct price fetching from Shopify
- Proper variant ID in form
- Accurate cart items
- Consistent with Dawn's architecture

**Estimated Effort**: 2-3 hours (1 hour coding, 1-2 hours testing)

**Risk Level**: Low (using standard user interaction pattern)

**Impact**: HIGH - Fixes conversion-blocking bug where customers see wrong prices
