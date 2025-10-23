# Pet Auto-Select Implementation Plan
**Date:** 2025-10-13
**Issue:** Customers upload pets but don't click to select them, causing orders without pet data
**Solution:** Auto-select single pet when available, leverage existing counter

---

## Current Implementation Analysis

### ✅ What Already Exists
1. **Counter in header**: Shows "(0/1)", "(0/2)", "(1/3)" etc. in title
2. **Counter location**: Inline with "Your Pets" title in header
3. **Counter updates**: Already updates when pets selected/deselected via `updatePetCounter()`
4. **Max pets enforcement**: "Add Another Pet" button disabled when limit reached
5. **Visual design**: Minimalist, mobile-optimized, hides on <320px screens

### 🎯 What We Need to Add
1. **Auto-selection logic** when exactly 1 pet available
2. **Visual confirmation** that pet was auto-selected
3. **"Add to Cart" button state** management
4. **Analytics tracking** for auto-select events

---

## Implementation Strategy

### Phase 1: Core Auto-Select Logic (2 hours)

#### File: `snippets/ks-product-pet-selector.liquid`

**Add to initialization (after `loadSavedPets()`, around line 2650):**

```javascript
// AUTO-SELECT LOGIC (New addition)
function attemptAutoSelect() {
  const maxPets = parseInt(petSelector.dataset.maxPets) || 1;
  const availablePets = document.querySelectorAll('.ks-pet-selector__pet:not(.ks-pet-selector__pet--no-effects)');
  const currentSelectedCount = selectedPetsData.length;

  // Only auto-select when:
  // 1. Exactly 1 pet is available
  // 2. No pets currently selected
  // 3. Works for any max_pets value (1, 2, or 3)
  if (availablePets.length === 1 && currentSelectedCount === 0) {
    const petEl = availablePets[0];
    const sessionKey = petEl.getAttribute('data-session-key');
    const petName = petEl.getAttribute('data-pet-name') || 'Your Pet';

    console.log('🎯 Auto-selecting single pet:', petName);

    // Use existing selectPet function (no new code path needed)
    selectPet(sessionKey, petName);

    // Show confirmation that auto-select happened
    showAutoSelectConfirmation(petName);

    // Track analytics
    trackAutoSelectEvent(petName, maxPets);
  }
}

// Call after pets are loaded
function initPetSelector() {
  loadSavedPets();

  // Wait for DOM to be ready, then attempt auto-select
  setTimeout(function() {
    attemptAutoSelect();
  }, 500);
}
```

---

### Phase 2: Visual Confirmation Banner (2 hours)

**Add after auto-selection (new function):**

```javascript
// Show confirmation that pet was auto-selected
function showAutoSelectConfirmation(petName) {
  const maxPets = parseInt(petSelector.dataset.maxPets) || 1;

  // Create confirmation banner HTML
  const confirmationHTML = `
    <div class="ks-pet-auto-confirm"
         id="pet-auto-confirm-${sectionId}"
         role="status"
         aria-live="polite">
      <div class="auto-confirm-content">
        <span class="auto-confirm-icon">✨</span>
        <span class="auto-confirm-text">
          <strong>${petName}</strong> selected
          ${maxPets > 1 ? ` (you can add up to ${maxPets - 1} more)` : ''}
        </span>
        <button type="button"
                class="auto-confirm-change"
                onclick="scrollToPetGrid()">
          Change
        </button>
      </div>
    </div>
  `;

  // Insert after header, before pet grid
  const petSelector = document.getElementById('pet-selector-' + sectionId);
  const header = document.getElementById('pet-selector-header-' + sectionId);

  if (header && petSelector) {
    header.insertAdjacentHTML('afterend', confirmationHTML);

    // Auto-hide after 8 seconds (user has been informed)
    setTimeout(function() {
      const banner = document.getElementById('pet-auto-confirm-' + sectionId);
      if (banner) {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-10px)';
        setTimeout(() => banner.remove(), 300);
      }
    }, 8000);
  }
}

// Scroll helper for "Change" button
function scrollToPetGrid() {
  const petContent = document.getElementById('pet-selector-content-' + sectionId);
  if (petContent) {
    petContent.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Remove confirmation banner when user wants to change
    const banner = document.getElementById('pet-auto-confirm-' + sectionId);
    if (banner) banner.remove();
  }
}
```

**Add CSS (in `<style>` section, around line 200):**

```css
/* Auto-selection confirmation banner */
.ks-pet-auto-confirm {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 12px 16px;
  margin: 12px 0;
  border-radius: 8px;
  animation: slideInConfirm 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

@keyframes slideInConfirm {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auto-confirm-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.auto-confirm-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.auto-confirm-text {
  flex: 1;
  font-size: 14px;
  min-width: 0;
}

.auto-confirm-text strong {
  font-weight: 600;
  color: white;
}

.auto-confirm-change {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.auto-confirm-change:hover {
  background: rgba(255, 255, 255, 0.3);
}

.auto-confirm-change:active {
  transform: scale(0.95);
}

/* Mobile optimizations */
@media (max-width: 750px) {
  .ks-pet-auto-confirm {
    margin: 12px -16px;
    border-radius: 0;
    position: sticky;
    top: 60px;
    z-index: 90;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .auto-confirm-content {
    justify-content: space-between;
  }

  .auto-confirm-change {
    min-height: 40px;
    padding: 8px 16px;
  }
}

/* Very small screens - stack vertically */
@media (max-width: 400px) {
  .auto-confirm-content {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .auto-confirm-text {
    text-align: center;
  }

  .auto-confirm-change {
    width: 100%;
  }
}
```

---

### Phase 3: "Add to Cart" Button Management (1 hour)

#### File: `assets/cart-pet-integration.js`

**Add button state management (after line 52):**

```javascript
// Initialize button state on page load
init: function() {
  var self = this;

  // Existing event listeners...
  document.addEventListener('pet:selected', function(e) {
    self.updateFormFields(e.detail);
    self.enableAddToCart(); // NEW: Enable button when pet selected
  });

  document.addEventListener('pet:removed', function(e) {
    self.clearFormFields();
    self.checkIfAnyPetsSelected(); // NEW: Check if button should be disabled
  });

  // NEW: Disable button initially for custom products
  document.addEventListener('DOMContentLoaded', function() {
    self.initializeButtonState();
  });
},

// NEW: Check if we should disable Add to Cart
initializeButtonState: function() {
  var customProducts = document.querySelectorAll('[data-max-pets]');

  if (customProducts.length > 0) {
    var hasSelectedPet = document.querySelector('[name="properties[_has_custom_pet]"]')?.value === 'true';

    if (!hasSelectedPet) {
      this.disableAddToCart();
    }
  }
},

// NEW: Disable Add to Cart button
disableAddToCart: function() {
  var buttons = document.querySelectorAll('form[action*="/cart/add"] button[name="add"]');

  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '↑ Select your pet above';
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  }
},

// NEW: Enable Add to Cart button
enableAddToCart: function() {
  var buttons = document.querySelectorAll('form[action*="/cart/add"] button[name="add"]');

  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || 'Add to Cart';
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';

    // Add success animation
    btn.classList.add('pet-selected-pulse');
    setTimeout(function() {
      btn.classList.remove('pet-selected-pulse');
    }, 600);
  }
},

// NEW: Check if any pets selected (for pet:removed event)
checkIfAnyPetsSelected: function() {
  var hasCustomPet = document.querySelector('[name="properties[_has_custom_pet]"]')?.value === 'true';

  if (!hasCustomPet) {
    this.disableAddToCart();
  }
}
```

**Add CSS for button animation (in theme.css or cart-pet-integration section):**

```css
@keyframes petSelectedPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.pet-selected-pulse {
  animation: petSelectedPulse 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

### Phase 4: Analytics Tracking (1 hour)

**Add tracking function (in ks-product-pet-selector.liquid):**

```javascript
// Track auto-selection analytics
function trackAutoSelectEvent(petName, maxPets) {
  // Google Analytics 4
  if (window.gtag) {
    gtag('event', 'pet_auto_selected', {
      'pet_name': petName,
      'max_pets': maxPets,
      'device_type': window.innerWidth < 750 ? 'mobile' : 'desktop',
      'page_location': window.location.href
    });
  }

  // Shopify Analytics
  if (window.ShopifyAnalytics) {
    window.ShopifyAnalytics.lib.track('Pet Auto Selected', {
      petName: petName,
      maxPets: maxPets,
      isMobile: window.innerWidth < 750,
      timestamp: new Date().toISOString()
    });
  }

  console.log('📊 Analytics: Pet auto-selected', { petName, maxPets });
}

// Track manual selection changes (add to existing selectPet function)
function selectPet(sessionKey, petName) {
  // ... existing selection logic ...

  // Track if this was a manual change (not auto-select)
  if (!isAutoSelecting) {
    trackManualSelectEvent(petName);
  }
}

function trackManualSelectEvent(petName) {
  if (window.gtag) {
    gtag('event', 'pet_manually_selected', {
      'pet_name': petName,
      'device_type': window.innerWidth < 750 ? 'mobile' : 'desktop'
    });
  }
}
```

---

## Updated Counter Behavior

### No Changes Needed! ✅

Your existing `updatePetCounter()` function already handles everything:
- Shows "(0/1)", "(1/2)", "(2/3)" etc.
- Only displays for `max_pets > 1`
- Updates when `selectPet()` is called
- Auto-select will trigger this via existing `selectPet()` function

**The counter will automatically update from (0/2) → (1/2) when auto-select happens!**

---

## User Flow Examples

### Example 1: Single-Pet Product (max_pets = 1)
```
1. Customer uploads pet "Buddy" → Saved to PetStorage
2. Customer navigates to "Custom Pet Portrait" page
3. Page loads → Pet selector shows
4. AUTO-SELECT triggers → selectPet("buddy_123", "Buddy")
5. Counter shows: "Your Pets" (no counter, max_pets = 1)
6. Green banner shows: "✨ Buddy selected"
7. "Add to Cart" enabled
8. Customer clicks "Add to Cart" → Order has all pet data ✅
```

### Example 2: Multi-Pet Product (max_pets = 2)
```
1. Customer has 1 pet "Max" in storage
2. Customer navigates to "2-Pet Canvas" page
3. AUTO-SELECT triggers → selectPet("max_456", "Max")
4. Counter shows: "Your Pets (1/2)"
5. Green banner: "✨ Max selected (you can add up to 1 more)"
6. "Add to Cart" enabled (can proceed with 1 pet)
7. Customer can optionally add 2nd pet or proceed with 1
```

### Example 3: Multiple Pets Available
```
1. Customer has 3 pets in storage
2. Customer navigates to any product page
3. NO AUTO-SELECT (multiple pets, user must choose)
4. Counter shows: "Your Pets (0/1)" or "(0/2)" etc.
5. Customer clicks desired pet
6. Counter updates: "(1/1)" or "(1/2)"
7. "Add to Cart" enabled
```

---

## Edge Cases Handled

### ✅ User Changes Selection After Auto-Select
- Click "Change" button → Scrolls to pet grid
- Click different pet → Replaces auto-selected pet
- Counter updates accordingly
- Existing `selectPet()` logic handles everything

### ✅ User Deselects Auto-Selected Pet
- Click same pet thumbnail → Deselects (existing behavior)
- Counter updates: (1/2) → (0/2)
- "Add to Cart" becomes disabled
- Banner auto-hides

### ✅ Page Refresh / Back Button
- `loadSavedPets()` restores pets from localStorage
- Selected state persists (existing behavior)
- No duplicate auto-selection (checks `currentSelectedCount === 0`)

### ✅ Multiple Products in Same Session
- Each product page gets its own auto-select attempt
- Counter resets per page
- Selection state independent per product

---

## Testing Checklist

### Manual Testing (Staging)
- [ ] **Single pet + max_pets=1**: Auto-selects immediately
- [ ] **Single pet + max_pets=2**: Auto-selects, shows "(1/2)"
- [ ] **Single pet + max_pets=3**: Auto-selects, shows "(1/3)"
- [ ] **Multiple pets available**: No auto-select, requires click
- [ ] **No pets available**: Shows empty state
- [ ] **Green banner appears**: After auto-select
- [ ] **Banner auto-hides**: After 8 seconds
- [ ] **"Change" button works**: Scrolls to grid, removes banner
- [ ] **Counter updates**: From (0/2) → (1/2) on auto-select
- [ ] **"Add to Cart" enabled**: After auto-select
- [ ] **"Add to Cart" disabled**: Initially (before selection)
- [ ] **Form fields populated**: Check hidden inputs have values
- [ ] **Order has pet data**: Place test order, verify all 5 fields

### Mobile Testing (iOS/Android)
- [ ] Sticky banner works on mobile
- [ ] Touch targets are thumb-friendly (40px+)
- [ ] Counter visible and readable
- [ ] No horizontal scroll
- [ ] Auto-select works on 3G connection

### Browser Testing
- [ ] Chrome (desktop + mobile)
- [ ] Safari (desktop + iOS)
- [ ] Firefox (desktop + mobile)
- [ ] Edge (desktop)

### Analytics Verification
- [ ] `pet_auto_selected` event fires
- [ ] `pet_manually_selected` event fires
- [ ] Device type tracked correctly
- [ ] Pet name captured

---

## Rollback Plan

### Feature Flag (Optional)
```javascript
// Add at top of auto-select logic
var AUTO_SELECT_ENABLED = true; // Toggle in theme settings

function attemptAutoSelect() {
  if (!AUTO_SELECT_ENABLED) return; // Feature flag check

  // ... rest of logic
}
```

### Emergency Disable
If issues arise, set `AUTO_SELECT_ENABLED = false` and redeploy theme.

### Monitoring Metrics (First 48 Hours)
- **Pet data completion rate**: Should increase to 95%+
- **Add-to-cart rate**: Should remain stable or improve
- **Support tickets**: Monitor for confusion
- **Analytics events**: Verify auto-select firing correctly

---

## Implementation Timeline

**Total Time: 6-8 hours**

- **Day 1 Morning (2 hours)**: Implement auto-select logic
- **Day 1 Afternoon (2 hours)**: Add confirmation banner
- **Day 2 Morning (1 hour)**: Button state management
- **Day 2 Afternoon (1 hour)**: Analytics tracking
- **Day 3 (2-3 hours)**: Testing on staging
- **Day 4**: Deploy to production, monitor

---

## Files to Modify

1. **`snippets/ks-product-pet-selector.liquid`** (~100 lines added)
   - Add `attemptAutoSelect()` function
   - Add `showAutoSelectConfirmation()` function
   - Add `scrollToPetGrid()` function
   - Add `trackAutoSelectEvent()` function
   - Add CSS for confirmation banner

2. **`assets/cart-pet-integration.js`** (~50 lines added)
   - Add `initializeButtonState()` method
   - Add `disableAddToCart()` method
   - Add `enableAddToCart()` method
   - Add `checkIfAnyPetsSelected()` method

3. **Theme CSS (optional)** (~10 lines)
   - Add `.pet-selected-pulse` animation

---

## Success Criteria

**Primary KPIs:**
1. **95%+ orders have complete pet data** (up from ~50%)
2. **No increase in cart abandonment** (maintain current rate)
3. **No increase in support tickets** (customer confusion)

**Secondary KPIs:**
1. **Auto-select success rate**: >90% of single-pet scenarios
2. **Manual change rate**: <10% (users changing auto-selection)
3. **Time to add-to-cart**: Decrease by 20% (fewer steps)

---

## Questions Before Implementation?

1. Should we add feature flag for easy rollback?
2. Should confirmation banner be dismissible (X button)?
3. Should we track when users click "Change" after auto-select?
4. Any specific analytics events you want tracked?

Ready to implement! Let me know if you'd like me to start coding.
