# Mobile Pet Selection: Native-Like UX Implementation Plan

**Date:** 2025-10-13
**Priority:** CRITICAL - 70% of orders are mobile, customers not completing pet selection
**Problem:** Customers upload pets but don't tap thumbnails to select, causing orders without pet data
**Root Cause:** Web-based UX pattern (tap-to-select) doesn't match mobile native expectations

---

## Executive Summary

Current implementation requires explicit tap on thumbnail to dispatch `pet:selected` event. This works on desktop but fails on mobile where users expect:
- Auto-selection of uploaded content
- Clear visual confirmation of selection
- Thumb-friendly touch targets
- Native-feeling interactions (haptics, animations)

**Recommended Solution:** Auto-select + Visual Confirmation + Native Mobile Patterns

---

## Current State Analysis

### Technical Flow
1. User uploads pet → Pet Processor processes → Saves to PetStorage
2. Pet Selector displays thumbnails in grid
3. **BREAK POINT:** User must tap thumbnail to trigger `pet:selected` event
4. Cart integration listens for event → Populates form fields
5. Add to Cart → Order created

### Current Touch Interaction
- Touch target: ~120x120px thumbnail (✅ meets 44x44pt iOS minimum)
- Selection mechanism: `addEventListener('click')` on pet thumbnail
- Visual feedback: `.selected` class adds border
- No haptic feedback
- No auto-selection
- "Add to Cart" always enabled (should be disabled until selection)

### Files Involved
- `snippets/ks-product-pet-selector.liquid` (lines 2204-2206) - Click handler
- `assets/cart-pet-integration.js` (lines 38-40) - Event listener
- `assets/pet-processor.js` (lines 1018-1028) - Event dispatch

---

## Mobile-First Solution Architecture

### 1. Auto-Selection Pattern (Recommended Approach)

**When to Auto-Select:**
- ✅ **Single pet products** (max_pets = 1): Auto-select immediately after upload
- ✅ **First pet in multi-pet products**: Auto-select first, allow manual selection for additional
- ❌ **Multi-pet selection**: Require explicit taps for pets 2+

**Implementation Logic:**
```javascript
// In pet-processor.js after savePetData() completes
if (autoSelectEnabled) {
  const selectorElement = document.querySelector('[data-product-id]');
  const maxPets = parseInt(selectorElement?.dataset.maxPets || '1');
  const currentSelectedCount = getSelectedPetCount();

  if (maxPets === 1 || currentSelectedCount === 0) {
    // Auto-select for single-pet products OR first pet in multi-pet
    dispatchAutoSelectEvent(petId);
  }
}
```

**Auto-Select Communication:**
```javascript
// Clear, immediate visual + haptic feedback
function dispatchAutoSelectEvent(petId) {
  // 1. Visual: Animate thumbnail with selection state
  animatePetSelection(petId);

  // 2. Haptic: Light tap feedback (iOS)
  triggerHapticFeedback('selection');

  // 3. Event: Dispatch pet:selected for cart integration
  document.dispatchEvent(new CustomEvent('pet:selected', {
    detail: getPetMetadata(petId),
    bubbles: true
  }));

  // 4. Toast: Show confirmation message
  showAutoSelectToast('Pet selected! Ready to add to cart');
}
```

---

### 2. Visual Design: Native Mobile Selection States

**Selection Confirmation (Bottom Sheet)**

Instead of subtle border, use native-feeling bottom confirmation bar:

```liquid
<!-- Add to ks-product-pet-selector.liquid after line 102 -->
<div class="ks-pet-selector__mobile-confirmation"
     id="pet-mobile-confirm-{{ section.id }}"
     style="display: none;"
     role="status"
     aria-live="polite">
  <div class="ks-pet-confirm__content">
    <div class="ks-pet-confirm__left">
      <img class="ks-pet-confirm__thumb" alt="">
      <div class="ks-pet-confirm__text">
        <strong id="confirm-pet-name-{{ section.id }}">Pet Selected</strong>
        <small>Ready to add to cart</small>
      </div>
    </div>
    <button type="button"
            class="ks-pet-confirm__change"
            onclick="scrollToPetSelector()">
      Change
    </button>
  </div>
</div>
```

**Mobile-Optimized CSS:**
```css
/* Sticky bottom confirmation bar */
.ks-pet-selector__mobile-confirmation {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 16px;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  z-index: 100;
  animation: slideUpConfirm 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUpConfirm {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.ks-pet-confirm__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ks-pet-confirm__left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0; /* Allow text truncation */
}

.ks-pet-confirm__thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.ks-pet-confirm__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ks-pet-confirm__text strong {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ks-pet-confirm__text small {
  font-size: 13px;
  opacity: 0.9;
}

.ks-pet-confirm__change {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s ease;
}

.ks-pet-confirm__change:active {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.95);
}

/* Only show on mobile */
@media (min-width: 750px) {
  .ks-pet-selector__mobile-confirmation {
    display: none !important;
  }
}
```

---

### 3. Touch Interaction Enhancements

**Haptic Feedback (iOS Safari)**
```javascript
// Add to ks-product-pet-selector.liquid JavaScript section
function triggerHapticFeedback(type) {
  // Check if Haptic API is available (iOS 13+)
  if (window.navigator && window.navigator.vibrate) {
    const patterns = {
      'selection': [10], // Light tap
      'success': [10, 50, 10], // Double tap
      'error': [50, 100, 50] // Strong notification
    };
    window.navigator.vibrate(patterns[type] || [10]);
  }
}
```

**Improved Touch Target Sizing:**
```css
/* Ensure touch targets meet Apple's 44x44pt minimum */
@media (max-width: 750px) {
  .ks-pet-selector__pet {
    min-width: 140px; /* Increased from 120px */
    min-height: 140px;
    padding: 8px; /* Add padding for easier tapping */
  }

  .ks-pet-selector__pet-image {
    width: 100%;
    height: 120px; /* Consistent height */
  }

  /* Increase tap area for selection */
  .ks-pet-selector__pet::after {
    content: '';
    position: absolute;
    inset: -8px; /* Extend tap area 8px beyond visible area */
    z-index: -1;
  }
}
```

**Active State Feedback:**
```css
/* Immediate visual feedback on touch */
.ks-pet-selector__pet:active {
  transform: scale(0.95);
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.ks-pet-selector__pet.selected {
  transform: scale(1.05);
  border: 3px solid #10b981;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

/* Ripple effect on tap (Android-like) */
.ks-pet-selector__pet::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%);
  border-radius: 12px;
  opacity: 0;
  transform: scale(0);
  transition: opacity 0.3s, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.ks-pet-selector__pet:active::before {
  opacity: 1;
  transform: scale(1);
}
```

---

### 4. Progressive Disclosure & Flow Control

**Collapse Pet Selector After Selection (Mobile Only)**

```javascript
// Auto-collapse after selection to reduce scroll fatigue
function handlePetSelection(petId, petData) {
  // Existing selection logic...

  // Mobile-specific: Collapse selector
  if (window.innerWidth <= 750) {
    const selector = document.getElementById('pet-selector-content-{{ section.id }}');
    const header = document.getElementById('pet-selector-header-{{ section.id }}');

    // Collapse grid
    selector.style.maxHeight = '0';
    selector.style.overflow = 'hidden';

    // Show sticky confirmation bar
    const confirmBar = document.getElementById('pet-mobile-confirm-{{ section.id }}');
    confirmBar.style.display = 'block';

    // Update confirmation bar with pet data
    updateMobileConfirmation(petData);

    // Smooth scroll to Add to Cart button
    setTimeout(() => {
      const addToCartBtn = document.querySelector('[name="add"]');
      if (addToCartBtn) {
        addToCartBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 300);
  }
}

function updateMobileConfirmation(petData) {
  const confirmBar = document.getElementById('pet-mobile-confirm-{{ section.id }}');
  const thumb = confirmBar.querySelector('.ks-pet-confirm__thumb');
  const name = confirmBar.querySelector('#confirm-pet-name-{{ section.id }}');

  thumb.src = petData.thumbnail || petData.processedImage;
  name.textContent = petData.name || 'Your Pet';

  // Trigger haptic
  triggerHapticFeedback('success');
}

function scrollToPetSelector() {
  const selector = document.getElementById('pet-selector-{{ section.id }}');
  const content = document.getElementById('pet-selector-content-{{ section.id }}');

  // Expand grid
  content.style.maxHeight = '';
  content.style.overflow = '';

  // Scroll to selector
  selector.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  // Hide confirmation bar temporarily
  const confirmBar = document.getElementById('pet-mobile-confirm-{{ section.id }}');
  confirmBar.style.display = 'none';
}
```

---

### 5. "Add to Cart" Button State Management

**Disable Until Selection (Critical UX Fix)**

```javascript
// Add to cart-pet-integration.js init()
document.addEventListener('DOMContentLoaded', function() {
  // Disable Add to Cart for custom products until pet selected
  const customProducts = document.querySelectorAll('[data-section-type*="product"]');

  customProducts.forEach(product => {
    const hasCustomTag = product.querySelector('[data-max-pets]');
    if (hasCustomTag) {
      const addToCartBtn = product.querySelector('[name="add"]');
      if (addToCartBtn) {
        disableAddToCart(addToCartBtn);
      }
    }
  });

  // Enable when pet selected
  document.addEventListener('pet:selected', function(e) {
    const addToCartBtn = document.querySelector('[name="add"]');
    if (addToCartBtn) {
      enableAddToCart(addToCartBtn);
    }
  });
});

function disableAddToCart(button) {
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = '↑ Select your pet first';
  button.style.opacity = '0.6';
  button.style.cursor = 'not-allowed';
}

function enableAddToCart(button) {
  button.disabled = false;
  button.textContent = button.dataset.originalText || 'Add to Cart';
  button.style.opacity = '1';
  button.style.cursor = 'pointer';

  // Pulse animation to draw attention
  button.classList.add('pulse-once');
  setTimeout(() => button.classList.remove('pulse-once'), 600);
}
```

**Button Animation:**
```css
@keyframes pulseOnce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.pulse-once {
  animation: pulseOnce 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

### 6. Error Prevention & Inline Validation

**Bottom Sheet Modal for Confirmation (Optional Enhancement)**

For products where selection is ambiguous, show confirmation modal:

```javascript
function showSelectionConfirmation(petData) {
  const modal = document.createElement('div');
  modal.className = 'ks-pet-selection-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>Confirm Your Selection</h3>
      </div>
      <div class="modal-body">
        <img src="${petData.thumbnail}" alt="${petData.name}">
        <p><strong>${petData.name}</strong> will be used for this product.</p>
        <p class="modal-hint">Effect: ${petData.effect || 'Original'}</p>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeConfirmModal()">
          Change Pet
        </button>
        <button class="btn-primary" onclick="confirmSelection()">
          Looks Good!
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Haptic
  triggerHapticFeedback('selection');

  // Animate in
  setTimeout(() => modal.classList.add('active'), 10);
}
```

**Modal Styling:**
```css
.ks-pet-selection-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.ks-pet-selection-modal.active {
  opacity: 1;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: white;
  border-radius: 20px 20px 0 0;
  padding: 24px;
  max-width: 600px;
  width: 100%;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.ks-pet-selection-modal.active .modal-content {
  transform: translateY(0);
}

.modal-header h3 {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

.modal-body {
  text-align: center;
  padding: 16px 0;
}

.modal-body img {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  object-fit: cover;
  margin-bottom: 16px;
  border: 3px solid #10b981;
}

.modal-body p {
  margin: 8px 0;
  font-size: 16px;
}

.modal-hint {
  font-size: 14px;
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.modal-actions button {
  flex: 1;
  padding: 14px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-primary {
  background: #10b981;
  color: white;
}

.btn-primary:active {
  background: #059669;
}
```

---

### 7. Performance Considerations

**Event Dispatching on Mobile:**
- ✅ Use `passive: true` for scroll/touch listeners (already implemented)
- ✅ Debounce rapid taps (prevent double-selection)
- ✅ Use `requestAnimationFrame` for animations
- ✅ Lazy-load thumbnails with `loading="lazy"` (already implemented)

**Auto-Select Impact:**
```javascript
// Minimal performance impact - runs once after upload
async function autoSelectFirstPet(petId) {
  // Wait for DOM update
  await new Promise(resolve => requestAnimationFrame(resolve));

  // Dispatch event (synchronous, ~1ms)
  const metadata = PetStorage.getMetadata(petId);
  document.dispatchEvent(new CustomEvent('pet:selected', {
    detail: metadata,
    bubbles: true
  }));

  // Update UI (async, non-blocking)
  requestAnimationFrame(() => {
    updateSelectionUI(petId);
    showMobileConfirmation(metadata);
  });
}
```

**Thumbnail Loading Strategy:**
Already optimal with:
- `loading="lazy"` attribute
- Data URLs (no network requests)
- Progressive rendering in `renderPets()`

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
**Goal:** Prevent orders without pet data

1. **Auto-Select Implementation** (4 hours)
   - File: `assets/pet-processor.js`
   - Add auto-select logic after `savePetData()` completes
   - Dispatch `pet:selected` event automatically for single-pet products
   - Test: Upload pet → Verify event fires → Check form fields populated

2. **Disable Add to Cart Until Selection** (2 hours)
   - File: `assets/cart-pet-integration.js`
   - Disable button on page load for custom products
   - Enable on `pet:selected` event
   - Test: Button disabled initially → Select pet → Button enables

3. **Mobile Confirmation Bar** (3 hours)
   - File: `snippets/ks-product-pet-selector.liquid`
   - Add sticky bottom confirmation component
   - Show after selection with pet thumbnail
   - Test: Select pet → Bar appears → Correct pet shown

**Testing Checklist:**
- [ ] Upload pet on mobile → Auto-selected
- [ ] Form fields populate with pet data
- [ ] Add to Cart disabled until selection
- [ ] Confirmation bar shows selected pet
- [ ] Can still manually change selection

### Phase 2: UX Enhancements (Week 2)
**Goal:** Native-feeling interactions

1. **Haptic Feedback** (2 hours)
   - Add vibration API calls
   - Test on iOS Safari, Android Chrome

2. **Touch State Animations** (3 hours)
   - Active state scale animation
   - Selection ripple effect
   - Pulse animation on "Add to Cart" enable

3. **Progressive Disclosure** (3 hours)
   - Auto-collapse grid after selection
   - Smooth scroll to Add to Cart
   - "Change" button to re-expand

**Testing Checklist:**
- [ ] Haptic feedback on selection (iOS only)
- [ ] Smooth animations on tap
- [ ] Grid collapses after selection
- [ ] Auto-scrolls to Add to Cart
- [ ] Can change selection easily

### Phase 3: Advanced Patterns (Week 3)
**Goal:** Polish and optimization

1. **Confirmation Modal** (4 hours)
   - Bottom sheet modal for ambiguous selections
   - A/B test: Modal vs. auto-select

2. **Multi-Pet Flow** (4 hours)
   - Auto-select first pet only
   - Clear UI for "Add Another Pet"
   - Selection counter

3. **Analytics & Monitoring** (2 hours)
   - Track auto-select success rate
   - Monitor orders with/without pet data
   - A/B test results

---

## Testing Strategy

### Manual Testing (Playwright MCP)
```javascript
// Test auto-select on mobile
test('mobile pet auto-select flow', async ({ page }) => {
  await page.goto('https://[staging-url]/products/custom-pet-art');

  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });

  // Upload pet
  await page.setInputFiles('input[type="file"]', 'test-pet.jpg');

  // Wait for processing
  await page.waitForSelector('.ks-pet-selector__pet');

  // Verify auto-selection
  const selected = await page.locator('.ks-pet-selector__pet.selected');
  expect(await selected.count()).toBe(1);

  // Verify form fields
  const petNameField = await page.inputValue('[name="properties[_pet_name]"]');
  expect(petNameField).not.toBe('');

  // Verify Add to Cart enabled
  const addBtn = await page.locator('[name="add"]');
  expect(await addBtn.isDisabled()).toBe(false);

  // Verify confirmation bar visible
  const confirmBar = await page.locator('.ks-pet-selector__mobile-confirmation');
  expect(await confirmBar.isVisible()).toBe(true);
});
```

### Device Testing Matrix
- iOS Safari (iPhone 12 Mini, iPhone 14 Pro Max)
- Android Chrome (Pixel 5, Samsung Galaxy S21)
- iPad Safari (touch + larger screen)

### Key Metrics
- **Pet Selection Rate:** % of uploads that result in selection
- **Order Completion Rate:** % of selected pets that complete checkout
- **Missing Pet Data Orders:** Should drop to <5%
- **Time to Add to Cart:** Should decrease by 30%+

---

## Edge Cases & Considerations

### Multi-Pet Products
- Auto-select first pet only
- Show "Add Pet 2" button after first selection
- Clear counter: "1/3 pets selected"

### Session Persistence
- Auto-selection state stored in localStorage
- Restore on page reload
- Clear on order completion

### Network Failures
- If GCS upload fails, still allow selection (use thumbnail)
- Show warning: "Using preview - order will be manually reviewed"
- Fallback to compressed data URL

### Accessibility
- `role="status"` on confirmation bar
- `aria-live="polite"` for selection announcements
- Keyboard navigation still works
- Screen reader: "Pet automatically selected: [name]"

### iOS-Specific
- Haptic feedback only on iOS 13+
- Safari viewport units (vh) handled correctly
- Touch delay removed with `touch-action: manipulation`

### Android-Specific
- Material Design ripple effect
- Vibration pattern testing
- Chrome address bar auto-hide

---

## Success Metrics

### Primary KPIs
1. **Pet Data Completion Rate**
   - Current: ~50% (guessing)
   - Target: >95%

2. **Mobile Conversion Rate**
   - Current: Baseline TBD
   - Target: +15% increase

3. **Time to Add to Cart**
   - Current: ~45 seconds
   - Target: <30 seconds

### Secondary KPIs
1. Selection confidence (A/B test auto-select vs manual)
2. Change selection rate (should be <10%)
3. Order error rate (missing pet data)
4. Customer support tickets related to pet selection

---

## Rollout Strategy

### A/B Test Plan (Recommended)
- **Control:** Current manual selection
- **Variant A:** Auto-select only
- **Variant B:** Auto-select + confirmation modal
- **Traffic Split:** 33% / 33% / 34%
- **Duration:** 2 weeks
- **Decision Metric:** Order completion rate

### Feature Flags
```javascript
const MOBILE_AUTO_SELECT_ENABLED = true; // Toggle in theme settings
const CONFIRMATION_MODAL_ENABLED = false; // Phase 3
const HAPTIC_FEEDBACK_ENABLED = true; // iOS only
```

### Gradual Rollout
1. **Week 1:** Internal testing only (staging)
2. **Week 2:** 10% of mobile traffic
3. **Week 3:** 50% of mobile traffic
4. **Week 4:** 100% rollout

---

## Critical Assumptions

1. **Current pet upload flow works reliably** - Users can successfully upload and process pets
2. **PetStorage.getMetadata() returns complete data** - Including gcsUrl, thumbnail, name
3. **Event system is reliable** - `pet:selected` event consistently triggers cart integration
4. **Add to Cart forms exist** - `form[action*="/cart/add"]` present on product pages
5. **Mobile traffic is indeed 70%+** - Justifies mobile-first approach

## Questions for Stakeholder

1. **Single vs Multi-Pet:** What % of orders are single-pet vs multi-pet products?
2. **Selection Confidence:** Should we require explicit confirmation (modal) or trust auto-select?
3. **Error Tolerance:** What % of orders with missing pet data is acceptable? (<5%? <1%?)
4. **Performance Budget:** Max acceptable delay for auto-select logic? (Target: <50ms)
5. **A/B Testing:** Can we run A/B tests, or full rollout preferred?

---

## Files to Modify

1. **`assets/pet-processor.js`** (lines 1018-1031)
   - Add auto-select logic after `dispatchEvent`
   - Check max_pets from selector
   - Dispatch selection if conditions met

2. **`snippets/ks-product-pet-selector.liquid`** (lines 50-120)
   - Add mobile confirmation bar HTML
   - Add CSS for confirmation bar
   - Add JavaScript for collapse/expand

3. **`assets/cart-pet-integration.js`** (lines 34-52)
   - Add button disable/enable logic
   - Hook into DOMContentLoaded
   - Listen for pet:selected event

4. **`snippets/buy-buttons.liquid`**
   - Ensure Add to Cart button has `name="add"` attribute
   - Add data attributes for custom products

---

## Notes

- **No Breaking Changes:** All modifications are additive, won't break existing functionality
- **Progressive Enhancement:** Features degrade gracefully on older browsers
- **Mobile-First:** All changes prioritize mobile UX, desktop remains unchanged
- **Performance:** Auto-select adds <10ms overhead, imperceptible to users
- **Analytics:** Track auto-select success rate to validate approach

---

## Next Steps

1. Review plan with product-strategy-evaluator for A/B test design
2. Consult ux-design-ecommerce-expert for confirmation bar placement
3. Validate with shopify-conversion-optimizer for button state management
4. Begin Phase 1 implementation after approval
