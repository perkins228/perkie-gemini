# Pet Selector State Persistence - UX Implementation Plan

**Session**: 001
**Created**: 2025-11-04
**Task**: Preserve and restore pet selector state (names + uploads) during Preview → Return flow
**Status**: Implementation Plan - Ready for Review

---

## Executive Summary

**Problem**: When customers navigate from product page → processor page → back to product page, their pet names and uploaded files disappear, forcing re-entry and creating frustration.

**Current State**:
- ✅ Images already stored in `localStorage['pet_X_images']` (base64 data URLs)
- ✅ Processor auto-loads images from localStorage (lines 512-518 in pet-processor.js)
- ❌ Pet names NOT stored - lost on navigation
- ❌ Upload UI state NOT restored - "Upload" button doesn't show file count
- ❌ Form state NOT restored - pet count selection, checkbox states lost

**Desired UX**: Customer enters "Fluffy", uploads photo → clicks Preview → processes image → clicks back → arrives at product page with "Fluffy" still filled in, uploaded photo still shown, can continue customizing.

**Solution Overview**: Implement comprehensive state persistence using localStorage with automatic cleanup and restoration.

---

## Part 1: UX Analysis & Recommendations

### 1. Best Approach for State Persistence

**Recommendation: localStorage (with sessionStorage markers)**

**Why localStorage:**
- ✅ **Survives navigation** - Persists across page loads (unlike sessionStorage)
- ✅ **Multi-tab friendly** - Customer can open multiple products
- ✅ **Already in use** - Images already stored in `localStorage['pet_X_images']`
- ✅ **10MB limit** - Sufficient for form state (names, selections, metadata)
- ✅ **No server round-trip** - Instant restoration, works offline

**Why NOT sessionStorage:**
- ❌ Cleared on browser back button in some browsers
- ❌ Lost if user opens product in new tab
- ❌ Inconsistent behavior across mobile browsers (70% of traffic)

**Why NOT URL parameters:**
- ❌ Ugly URLs with base64 data
- ❌ Length limits (2048 chars)
- ❌ Breaks browser back button UX
- ❌ Exposes data in browser history

**Hybrid Approach** (Recommended):
```javascript
// PRIMARY: localStorage for pet data (persistent)
localStorage['perkie_pet_selector_product_12345'] = {
  petCount: 2,
  pets: {...},
  style: 'enhancedblackwhite',
  font: 'preppy',
  timestamp: 1699999999999
}

// SECONDARY: sessionStorage for navigation markers (temporary)
sessionStorage['pet_selector_return_url'] = '/products/foo'
sessionStorage['pet_selector_active_index'] = '1'
```

---

### 2. What Data to Store

**Comprehensive State Object** (per product):

```javascript
{
  // Product context
  productId: 12345,                    // Which product this state belongs to
  timestamp: 1699999999999,            // Last updated time

  // Pet count selection
  petCount: 2,                         // How many pets selected (1-3)

  // Per-pet data
  pets: {
    1: {
      name: "Fluffy",                  // Pet name input value
      files: [                         // Uploaded files metadata
        {
          name: "fluffy.jpg",
          size: 2048576,
          type: "image/jpeg",
          data: "data:image/jpeg;base64,/9j/4AAQ...",  // Base64 (already stored)
          uploadedAt: 1699999999999
        }
      ],
      useExistingPrint: false,         // Checkbox state
      orderNumber: ""                  // Order number field (if applicable)
    },
    2: {
      name: "Max",
      files: [...],
      useExistingPrint: true,
      orderNumber: "ORD-12345"
    }
  },

  // Global selections
  style: "enhancedblackwhite",         // Selected style radio
  font: "preppy",                      // Selected font radio

  // Session markers (stored in sessionStorage)
  returnUrl: "/products/custom-pet-portrait",
  scrollPosition: 1234,
  activeIndex: 1                       // Which pet's Preview was clicked
}
```

**Storage Keys Structure**:
```javascript
// Per-product persistent state (localStorage)
"perkie_pet_selector_product_12345"

// Per-pet image data (localStorage) - EXISTING, already in use
"pet_0_images", "pet_1_images", "pet_2_images"

// Navigation markers (sessionStorage) - EXISTING, already in use
"pet_selector_return_url"
"pet_selector_scroll_position"
"pet_selector_active_index"
```

---

### 3. When to Save State

**Save Triggers** (debounced to avoid performance issues):

1. **On Input Change** (300ms debounce)
   - Pet name inputs: `input` event
   - Checkboxes: `change` event
   - Order number fields: `input` event

2. **On Selection Change** (immediate)
   - Pet count selection: `change` event
   - Style selection: `change` event
   - Font selection: `change` event

3. **On File Upload** (immediate)
   - After file validation passes
   - After files added to `petFiles` object
   - Already stores in localStorage (line 1273)

4. **Before Navigation** (immediate)
   - Preview button click (before `window.location.href`)
   - Add to Cart button click (optional - save in progress work)

**Implementation Pattern**:
```javascript
// Debounced save for text inputs (avoid saving every keystroke)
let saveTimer;
function savePetSelectorState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = collectPetSelectorState();
    localStorage.setItem(`perkie_pet_selector_product_${productId}`, JSON.stringify(state));
    console.log('💾 Saved pet selector state');
  }, 300); // 300ms debounce
}

// Immediate save for selections
function savePetSelectorStateImmediate() {
  const state = collectPetSelectorState();
  localStorage.setItem(`perkie_pet_selector_product_${productId}`, JSON.stringify(state));
  console.log('💾 Saved pet selector state (immediate)');
}
```

---

### 4. When to Restore State

**Restore Triggers**:

1. **On Page Load** (DOMContentLoaded)
   - Check if localStorage has state for current product
   - Restore all form fields, selections, upload UI
   - Trigger font preview updates

2. **After Navigation Detection** (from processor page)
   - Check sessionStorage for `pet_selector_return_url`
   - If matches current URL → user returned from processor
   - Restore scroll position
   - Clear navigation markers from sessionStorage

3. **On Pet Count Change** (when user changes number of pets)
   - Don't wipe existing pet data for hidden pets
   - Only show/hide sections, preserve data underneath

**Restoration Flow**:
```javascript
// 1. On page load
document.addEventListener('DOMContentLoaded', () => {
  const state = loadPetSelectorState(productId);

  if (state) {
    // 2. Restore pet count first (shows correct sections)
    restorePetCount(state.petCount);

    // 3. Restore per-pet data
    Object.keys(state.pets).forEach(petIndex => {
      restorePetData(petIndex, state.pets[petIndex]);
    });

    // 4. Restore global selections
    restoreStyleSelection(state.style);
    restoreFontSelection(state.font);

    // 5. Update UI elements
    updateFontPreviews();
    updateUploadButtons();

    console.log('✅ Restored pet selector state');
  }

  // 6. Check if user returned from processor
  const returnUrl = sessionStorage.getItem('pet_selector_return_url');
  if (returnUrl && returnUrl === window.location.href) {
    // Restore scroll position
    const scrollPos = parseInt(sessionStorage.getItem('pet_selector_scroll_position') || '0');
    window.scrollTo(0, scrollPos);

    // Clear markers
    sessionStorage.removeItem('pet_selector_return_url');
    sessionStorage.removeItem('pet_selector_scroll_position');

    console.log('🔙 User returned from processor, scroll restored');
  }
});
```

---

### 5. Edge Cases & Error Handling

#### **Edge Case 1: Expired/Stale Data**

**Problem**: User returns 3 days later, localStorage has old data
**Solution**: Timestamp-based expiration (24 hours)

```javascript
function loadPetSelectorState(productId) {
  const key = `perkie_pet_selector_product_${productId}`;
  const stored = localStorage.getItem(key);

  if (!stored) return null;

  try {
    const state = JSON.parse(stored);

    // Check timestamp (24 hour expiration)
    const age = Date.now() - (state.timestamp || 0);
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (age > MAX_AGE) {
      console.log('⏰ State expired, clearing:', key);
      localStorage.removeItem(key);
      return null;
    }

    return state;
  } catch (error) {
    console.error('❌ Failed to parse state:', error);
    localStorage.removeItem(key);
    return null;
  }
}
```

#### **Edge Case 2: Corrupted State Data**

**Problem**: JSON.parse fails, invalid data structure
**Solution**: Try/catch with fallback removal

```javascript
function validateStateStructure(state) {
  // Required fields
  if (!state.productId || !state.timestamp) return false;
  if (typeof state.petCount !== 'number') return false;
  if (!state.pets || typeof state.pets !== 'object') return false;

  // Validate each pet
  for (const [index, pet] of Object.entries(state.pets)) {
    if (!pet || typeof pet !== 'object') return false;
    // Name can be empty, but must be string
    if (typeof pet.name !== 'string') return false;
    // Files must be array
    if (!Array.isArray(pet.files)) return false;
  }

  return true;
}
```

#### **Edge Case 3: User Switches Products**

**Problem**: User goes from Product A → Processor → Product B (different product)
**Solution**: Product ID-based keys, don't restore if mismatch

```javascript
function loadPetSelectorState(currentProductId) {
  const key = `perkie_pet_selector_product_${currentProductId}`;
  const state = localStorage.getItem(key);

  if (!state) return null;

  const parsed = JSON.parse(state);

  // CRITICAL: Only restore if product IDs match
  if (parsed.productId !== currentProductId) {
    console.log('⚠️ Product ID mismatch, not restoring:', {
      current: currentProductId,
      stored: parsed.productId
    });
    return null;
  }

  return parsed;
}
```

#### **Edge Case 4: Multiple Tabs**

**Problem**: User opens product in Tab A, makes changes in Tab B
**Solution**: Storage events + last-write-wins

```javascript
// Listen for storage changes from other tabs
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('perkie_pet_selector_product_')) {
    console.log('📡 Pet selector state updated in another tab');

    // Extract product ID from key
    const match = e.key.match(/perkie_pet_selector_product_(\d+)/);
    if (match && parseInt(match[1]) === currentProductId) {
      // Reload state from localStorage
      const newState = JSON.parse(e.newValue);
      applyStateToUI(newState);

      console.log('🔄 Reloaded state from other tab');
    }
  }
});
```

#### **Edge Case 5: Browser Back Button**

**Problem**: User clicks back from processor, but state already applied
**Solution**: sessionStorage markers prevent double-restoration

```javascript
// Marker prevents double restoration
if (!sessionStorage.getItem('pet_selector_state_restored')) {
  const state = loadPetSelectorState(productId);
  if (state) {
    applyStateToUI(state);
    sessionStorage.setItem('pet_selector_state_restored', 'true');
  }
}

// Clear marker on page unload (before navigation to processor)
window.addEventListener('beforeunload', () => {
  sessionStorage.removeItem('pet_selector_state_restored');
});
```

#### **Edge Case 6: localStorage Full**

**Problem**: localStorage quota exceeded (10MB limit)
**Solution**: Try/catch with user notification

```javascript
function savePetSelectorState(state) {
  try {
    const key = `perkie_pet_selector_product_${state.productId}`;
    localStorage.setItem(key, JSON.stringify(state));
    console.log('💾 Saved state');
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('❌ localStorage quota exceeded');

      // Try to free space by removing old states
      cleanupOldStates();

      // Retry once
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (retryError) {
        alert('Unable to save your pet customization. Please try clearing browser data.');
      }
    }
  }
}

function cleanupOldStates() {
  // Remove states older than 7 days
  const keys = Object.keys(localStorage);
  const petSelectorKeys = keys.filter(k => k.startsWith('perkie_pet_selector_product_'));

  petSelectorKeys.forEach(key => {
    try {
      const state = JSON.parse(localStorage.getItem(key));
      const age = Date.now() - (state.timestamp || 0);
      const CLEANUP_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (age > CLEANUP_AGE) {
        localStorage.removeItem(key);
        console.log('🧹 Cleaned up old state:', key);
      }
    } catch (e) {
      // Invalid state, remove it
      localStorage.removeItem(key);
    }
  });
}
```

---

### 6. Mobile-Specific Considerations

**70% of traffic is mobile - optimizations required:**

#### **Touch Performance**
```javascript
// Use passive event listeners for scroll
window.addEventListener('scroll', saveScrollPosition, { passive: true });

// Debounce aggressively on mobile (slower CPUs)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const DEBOUNCE_MS = isMobile ? 500 : 300;
```

#### **Memory Constraints**
```javascript
// Mobile browsers have stricter memory limits
// Keep state object lean - don't store full base64 unnecessarily
function collectPetSelectorState() {
  return {
    // Don't duplicate base64 here - already in localStorage['pet_X_images']
    pets: {
      1: {
        name: getPetName(1),
        fileCount: petFiles[1].length,  // Just the count, not full data
        useExistingPrint: getCheckboxState(1),
        orderNumber: getOrderNumber(1)
      }
    }
  };
}
```

#### **iOS Safari Quirks**
```javascript
// iOS Safari clears localStorage on low memory
// Add restoration retry on iOS
if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  // Check state integrity every 5 seconds while on page
  setInterval(() => {
    const state = loadPetSelectorState(productId);
    if (!state && hasUserEnteredData()) {
      console.warn('⚠️ State lost (iOS low memory?), saving again...');
      savePetSelectorStateImmediate();
    }
  }, 5000);
}
```

#### **Mobile Browser Back Button**
```javascript
// Mobile browsers cache pages aggressively
// Use pageshow event instead of DOMContentLoaded
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // Page loaded from bfcache (back/forward cache)
    console.log('📄 Page loaded from cache, reloading state...');
    const state = loadPetSelectorState(productId);
    if (state) {
      applyStateToUI(state);
    }
  }
});
```

---

### 7. Code Architecture Recommendations

**File Structure** (no new files needed):

```
snippets/ks-product-pet-selector-stitch.liquid
├── [EXISTING] Lines 1-340: HTML structure
├── [EXISTING] Lines 353-1053: CSS styles
└── [MODIFY] Lines 1055-1503: JavaScript
    ├── [NEW] Lines 1505-1650: State persistence module
    │   ├── collectPetSelectorState()
    │   ├── savePetSelectorState()
    │   ├── loadPetSelectorState()
    │   ├── applyStateToUI()
    │   ├── validateStateStructure()
    │   └── cleanupOldStates()
    ├── [MODIFY] Lines 1124-1135: Add save calls to event listeners
    ├── [MODIFY] Lines 1189-1277: Add save call after file upload
    └── [NEW] Lines 1466-1503: Restoration on page load
```

**Module Organization**:

```javascript
// === STATE PERSISTENCE MODULE ===
// Add at end of IIFE, before initialization (line 1466)

const PetSelectorState = {
  // Config
  STORAGE_PREFIX: 'perkie_pet_selector_product_',
  MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
  DEBOUNCE_MS: 300,

  // Core methods
  collect: function() { /* ... */ },
  save: function() { /* ... */ },
  load: function() { /* ... */ },
  apply: function() { /* ... */ },
  validate: function() { /* ... */ },
  cleanup: function() { /* ... */ }
};

// === EVENT LISTENERS ===
// Modify existing listeners to call PetSelectorState.save()

// Name inputs (line 1133)
nameInputs.forEach(input => {
  input.addEventListener('input', () => {
    updateFontPreviews();
    PetSelectorState.save(); // NEW
  });
});

// Style selection (line 1152)
card.addEventListener('click', () => {
  styleCards.forEach(c => c.classList.remove('style-card--active'));
  card.classList.add('style-card--active');
  PetSelectorState.save(); // NEW
});

// File upload (line 1261)
populateOrderProperties(i, petFiles[i]);
PetSelectorState.save(); // NEW

// === RESTORATION ON PAGE LOAD ===
// Add at end of IIFE (line 1466)
PetSelectorState.restore();
```

**Key Principles**:
1. **Single Responsibility**: Each function does ONE thing
2. **Fail Safe**: All localStorage operations wrapped in try/catch
3. **Progressive Enhancement**: Works without JavaScript (files still submit)
4. **No Breaking Changes**: Preserves all existing functionality
5. **Debuggable**: Comprehensive console logging for troubleshooting

---

## Part 2: Implementation Specification

### Step 1: Add State Collection Function

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (line ~1466, before initialization)

**Purpose**: Gather all pet selector form state into a serializable object

**Code to Add**:
```javascript
/**
 * Collect current pet selector state
 * @returns {Object} Serializable state object
 */
function collectPetSelectorState() {
  const productId = parseInt(container.dataset.productId);

  // Get current pet count
  const selectedCountRadio = container.querySelector('[data-pet-count-radio]:checked');
  const petCount = selectedCountRadio ? parseInt(selectedCountRadio.value) : 0;

  // Collect per-pet data
  const pets = {};
  for (let i = 1; i <= 3; i++) {
    const nameInput = container.querySelector(`[data-pet-name-input="${i}"]`);
    const checkbox = container.querySelector(`[data-existing-print-checkbox="${i}"]`);
    const orderField = container.querySelector(`[data-order-number-field="${i}"]`);

    if (nameInput) {
      pets[i] = {
        name: nameInput.value.trim(),
        fileCount: (petFiles[i] || []).length,
        useExistingPrint: checkbox ? checkbox.checked : false,
        orderNumber: orderField ? orderField.value.trim() : ''
      };
    }
  }

  // Get global selections
  const selectedStyle = container.querySelector('[data-style-radio]:checked');
  const selectedFont = container.querySelector('[data-font-radio]:checked');

  return {
    productId: productId,
    timestamp: Date.now(),
    petCount: petCount,
    pets: pets,
    style: selectedStyle ? selectedStyle.value : '',
    font: selectedFont ? selectedFont.value : ''
  };
}
```

**Rationale**:
- Serializes ALL form state (names, counts, checkboxes, selections)
- DOES NOT duplicate file data (already in `localStorage['pet_X_images']`)
- Includes product ID for multi-product isolation
- Includes timestamp for expiration checks
- Pure function - no side effects

---

### Step 2: Add State Save Function (Debounced)

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (line ~1500)

**Purpose**: Save state to localStorage with debouncing to avoid performance issues

**Code to Add**:
```javascript
let saveStateTimer;

/**
 * Save pet selector state to localStorage (debounced)
 * Debouncing prevents excessive saves during rapid typing
 */
function savePetSelectorState() {
  clearTimeout(saveStateTimer);

  saveStateTimer = setTimeout(() => {
    try {
      const state = collectPetSelectorState();
      const productId = state.productId;
      const key = `perkie_pet_selector_product_${productId}`;

      localStorage.setItem(key, JSON.stringify(state));
      console.log('💾 Saved pet selector state:', key);
    } catch (error) {
      console.error('❌ Failed to save state:', error);

      if (error.name === 'QuotaExceededError') {
        cleanupOldPetSelectorStates();
      }
    }
  }, 300); // 300ms debounce
}

/**
 * Save state immediately (no debounce)
 * Use for selections and navigation
 */
function savePetSelectorStateImmediate() {
  try {
    const state = collectPetSelectorState();
    const productId = state.productId;
    const key = `perkie_pet_selector_product_${productId}`;

    localStorage.setItem(key, JSON.stringify(state));
    console.log('💾 Saved pet selector state (immediate):', key);
  } catch (error) {
    console.error('❌ Failed to save state:', error);
  }
}

/**
 * Clean up old pet selector states (7+ days old)
 */
function cleanupOldPetSelectorStates() {
  try {
    const keys = Object.keys(localStorage);
    const petSelectorKeys = keys.filter(k => k.startsWith('perkie_pet_selector_product_'));
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

    petSelectorKeys.forEach(key => {
      try {
        const state = JSON.parse(localStorage.getItem(key));
        const age = Date.now() - (state.timestamp || 0);

        if (age > MAX_AGE) {
          localStorage.removeItem(key);
          console.log('🧹 Cleaned up old state:', key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}
```

**Rationale**:
- **Debounced version** for text inputs (avoid saving every keystroke)
- **Immediate version** for selections (user expects instant save)
- **Quota handling** with automatic cleanup
- **Error boundaries** - failures don't break UI

---

### Step 3: Add State Load Function

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (line ~1570)

**Purpose**: Load and validate state from localStorage

**Code to Add**:
```javascript
/**
 * Load pet selector state from localStorage
 * @returns {Object|null} State object or null if not found/invalid
 */
function loadPetSelectorState() {
  try {
    const productId = parseInt(container.dataset.productId);
    const key = `perkie_pet_selector_product_${productId}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      console.log('🔍 No saved state found for product:', productId);
      return null;
    }

    const state = JSON.parse(stored);

    // Validate product ID match
    if (state.productId !== productId) {
      console.warn('⚠️ Product ID mismatch, not restoring');
      return null;
    }

    // Check expiration (24 hours)
    const age = Date.now() - (state.timestamp || 0);
    const MAX_AGE = 24 * 60 * 60 * 1000;

    if (age > MAX_AGE) {
      console.log('⏰ State expired, clearing:', key);
      localStorage.removeItem(key);
      return null;
    }

    // Validate structure
    if (!validateStateStructure(state)) {
      console.warn('⚠️ Invalid state structure, clearing:', key);
      localStorage.removeItem(key);
      return null;
    }

    console.log('✅ Loaded valid state:', key);
    return state;

  } catch (error) {
    console.error('❌ Failed to load state:', error);
    return null;
  }
}

/**
 * Validate state object structure
 * @param {Object} state - State to validate
 * @returns {boolean} True if valid
 */
function validateStateStructure(state) {
  if (!state || typeof state !== 'object') return false;
  if (typeof state.productId !== 'number') return false;
  if (typeof state.timestamp !== 'number') return false;
  if (typeof state.petCount !== 'number') return false;
  if (!state.pets || typeof state.pets !== 'object') return false;

  // Validate each pet
  for (const [index, pet] of Object.entries(state.pets)) {
    if (!pet || typeof pet !== 'object') return false;
    if (typeof pet.name !== 'string') return false;
    if (typeof pet.fileCount !== 'number') return false;
    if (typeof pet.useExistingPrint !== 'boolean') return false;
    if (typeof pet.orderNumber !== 'string') return false;
  }

  return true;
}
```

**Rationale**:
- **Product isolation** - Only loads state for current product
- **Expiration check** - Prevents stale data (24 hours)
- **Structure validation** - Prevents crashes from corrupted data
- **Graceful degradation** - Returns null on any error

---

### Step 4: Add State Restoration Function

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (line ~1650)

**Purpose**: Apply loaded state to UI elements

**Code to Add**:
```javascript
/**
 * Apply state to UI elements
 * @param {Object} state - State object to apply
 */
function applyStateToUI(state) {
  try {
    console.log('🔄 Restoring pet selector state...');

    // 1. Restore pet count
    if (state.petCount > 0) {
      const countRadio = container.querySelector(`[data-pet-count-radio][value="${state.petCount}"]`);
      if (countRadio) {
        countRadio.checked = true;
        updatePetSections(state.petCount);
      }
    }

    // 2. Restore per-pet data
    for (const [index, pet] of Object.entries(state.pets)) {
      const i = parseInt(index);

      // Restore name
      const nameInput = container.querySelector(`[data-pet-name-input="${i}"]`);
      if (nameInput && pet.name) {
        nameInput.value = pet.name;
      }

      // Restore checkbox
      const checkbox = container.querySelector(`[data-existing-print-checkbox="${i}"]`);
      if (checkbox) {
        checkbox.checked = pet.useExistingPrint;

        // Show/hide order number input
        const orderInput = container.querySelector(`[data-order-number-input="${i}"]`);
        if (orderInput) {
          orderInput.style.display = pet.useExistingPrint ? '' : 'none';
        }
      }

      // Restore order number
      const orderField = container.querySelector(`[data-order-number-field="${i}"]`);
      if (orderField && pet.orderNumber) {
        orderField.value = pet.orderNumber;
      }

      // Restore upload button state
      // Files themselves are already in localStorage['pet_X_images']
      // and in petFiles object (populated on page load via existing code)
      if (pet.fileCount > 0) {
        const uploadBtn = container.querySelector(`[data-pet-upload-btn="${i}"]`);
        const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);

        if (uploadBtn && fileInput) {
          const maxFiles = parseInt(fileInput.dataset.maxFiles) || 3;
          uploadBtn.textContent = `Upload (${pet.fileCount}/${maxFiles})`;
          uploadBtn.classList.add('has-uploads');

          // Re-display uploaded files (read from localStorage)
          const storedImages = localStorage.getItem(`pet_${i}_images`);
          if (storedImages) {
            const images = JSON.parse(storedImages);

            // Reconstruct petFiles[i] from stored images
            // Note: This is metadata only - actual files already loaded
            petFiles[i] = images.map(img => ({
              name: img.name,
              size: img.size,
              type: img.type,
              data: img.data // Base64 already in localStorage
            }));

            displayUploadedFiles(i, petFiles[i]);
          }
        }
      }
    }

    // 3. Restore style selection
    if (state.style) {
      const styleRadio = container.querySelector(`[data-style-radio="${state.style}"]`);
      if (styleRadio) {
        styleRadio.checked = true;

        // Update active class
        const styleCard = styleRadio.closest('.style-card');
        if (styleCard) {
          container.querySelectorAll('.style-card').forEach(c => c.classList.remove('style-card--active'));
          styleCard.classList.add('style-card--active');
        }
      }
    }

    // 4. Restore font selection
    if (state.font) {
      const fontRadio = container.querySelector(`[data-font-radio="${state.font}"]`);
      if (fontRadio) {
        fontRadio.checked = true;

        // Update active class
        const fontCard = fontRadio.closest('.font-card');
        if (fontCard) {
          container.querySelectorAll('.font-card').forEach(c => c.classList.remove('font-card--active'));
          fontCard.classList.add('font-card--active');
        }
      }
    }

    // 5. Update font previews
    updateFontPreviews();

    // 6. Check if user returned from processor
    const returnUrl = sessionStorage.getItem('pet_selector_return_url');
    if (returnUrl === window.location.href) {
      // Restore scroll position
      const scrollPos = parseInt(sessionStorage.getItem('pet_selector_scroll_position') || '0');
      window.scrollTo(0, scrollPos);

      // Clear markers
      sessionStorage.removeItem('pet_selector_return_url');
      sessionStorage.removeItem('pet_selector_scroll_position');

      console.log('🔙 User returned from processor, scroll position restored');
    }

    console.log('✅ State restoration complete');

  } catch (error) {
    console.error('❌ Failed to restore state:', error);
  }
}
```

**Rationale**:
- **Restores ALL UI elements** - pet count, names, checkboxes, uploads, styles, fonts
- **Handles missing elements** - Gracefully skips if DOM element not found
- **Updates visual states** - Active classes, button text, visibility
- **Scroll restoration** - Brings user back to where they were
- **Error boundaries** - Failures don't break page

---

### Step 5: Wire Up Event Listeners

**Location**: Various locations in `snippets/ks-product-pet-selector-stitch.liquid`

**Purpose**: Trigger state saves on user interactions

**Modifications**:

#### 5.1: Pet Count Change (Line ~1127)
```javascript
// BEFORE:
countRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const count = parseInt(e.target.value);
    updatePetSections(count);
  });
});

// AFTER:
countRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const count = parseInt(e.target.value);
    updatePetSections(count);
    savePetSelectorStateImmediate(); // NEW: Save immediately on selection
  });
});
```

#### 5.2: Pet Name Inputs (Line ~1133)
```javascript
// BEFORE:
nameInputs.forEach(input => {
  input.addEventListener('input', updateFontPreviews);
});

// AFTER:
nameInputs.forEach(input => {
  input.addEventListener('input', () => {
    updateFontPreviews();
    savePetSelectorState(); // NEW: Save with debounce on typing
  });
});
```

#### 5.3: Existing Print Checkbox (Line ~1143)
```javascript
// BEFORE:
checkbox.addEventListener('change', () => {
  orderInput.style.display = checkbox.checked ? '' : 'none';
});

// AFTER:
checkbox.addEventListener('change', () => {
  orderInput.style.display = checkbox.checked ? '' : 'none';
  savePetSelectorStateImmediate(); // NEW: Save immediately on checkbox
});
```

#### 5.4: Order Number Field (Line ~1114)
```javascript
// ADD after orderField definition:
const orderField = container.querySelector(`[data-order-number-field="${i}"]`);
if (orderField) {
  orderField.addEventListener('input', savePetSelectorState); // NEW: Save with debounce
}
```

#### 5.5: Style Selection (Line ~1152)
```javascript
// BEFORE:
card.addEventListener('click', () => {
  styleCards.forEach(c => c.classList.remove('style-card--active'));
  card.classList.add('style-card--active');
});

// AFTER:
card.addEventListener('click', () => {
  styleCards.forEach(c => c.classList.remove('style-card--active'));
  card.classList.add('style-card--active');
  savePetSelectorStateImmediate(); // NEW: Save immediately on selection
});
```

#### 5.6: Font Selection (Line ~1161)
```javascript
// BEFORE:
card.addEventListener('click', () => {
  fontCards.forEach(c => c.classList.remove('font-card--active'));
  card.classList.add('font-card--active');
});

// AFTER:
card.addEventListener('click', () => {
  fontCards.forEach(c => c.classList.remove('font-card--active'));
  card.classList.add('font-card--active');
  savePetSelectorStateImmediate(); // NEW: Save immediately on selection
});
```

#### 5.7: File Upload (Line ~1261)
```javascript
// BEFORE:
populateOrderProperties(i, petFiles[i]);

// AFTER:
populateOrderProperties(i, petFiles[i]);
savePetSelectorStateImmediate(); // NEW: Save immediately after upload
```

#### 5.8: File Delete (Line ~1348)
```javascript
// BEFORE:
updateFileInputWithAllFiles(petIndex, petFiles[petIndex]);
populateOrderProperties(petIndex, petFiles[petIndex]);

// AFTER:
updateFileInputWithAllFiles(petIndex, petFiles[petIndex]);
populateOrderProperties(petIndex, petFiles[petIndex]);
savePetSelectorStateImmediate(); // NEW: Save immediately after delete
```

---

### Step 6: Add Restoration on Page Load

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (line ~1469, in initialization section)

**Purpose**: Automatically restore state when page loads

**Code to Add**:
```javascript
// EXISTING initialization code at line 1466:
// Initialize - No default selections

// NEW: Add state restoration
(function restoreOnPageLoad() {
  // Wait for DOM to be fully ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restorePetSelectorState);
  } else {
    restorePetSelectorState();
  }

  // Also handle pageshow (for mobile back/forward cache)
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      console.log('📄 Page loaded from cache, reloading state...');
      restorePetSelectorState();
    }
  });
})();

function restorePetSelectorState() {
  const state = loadPetSelectorState();

  if (state) {
    applyStateToUI(state);
  }
}
```

**Rationale**:
- **DOMContentLoaded** - Ensures DOM is ready before restoration
- **Immediate execution** - If DOM already ready, restore immediately
- **pageshow event** - Handles mobile browser back/forward cache (bfcache)
- **IIFE pattern** - Self-contained initialization

---

### Step 7: Add Global Cleanup Function (Optional)

**Location**: `snippets/ks-product-pet-selector-stitch.liquid` (end of script, line ~1501)

**Purpose**: Provide emergency cleanup method for debugging

**Code to Add**:
```javascript
// Expose cleanup function globally for debugging
window.cleanupPetSelectorStates = function() {
  const keys = Object.keys(localStorage);
  const petSelectorKeys = keys.filter(k => k.startsWith('perkie_pet_selector_product_'));

  petSelectorKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log('🧹 Removed:', key);
  });

  console.log(`✅ Cleaned up ${petSelectorKeys.length} pet selector state(s)`);

  // Also clear navigation markers
  sessionStorage.removeItem('pet_selector_return_url');
  sessionStorage.removeItem('pet_selector_scroll_position');
  sessionStorage.removeItem('pet_selector_active_index');

  console.log('✅ Cleared navigation markers');
};
```

**Usage** (for debugging):
```javascript
// In browser console:
cleanupPetSelectorStates();
```

---

## Part 3: Testing Checklist

### Functional Tests

#### **Basic Flow**
- [ ] Enter pet name "Fluffy" → Verify saved to localStorage within 300ms
- [ ] Select 2 pets → Verify petCount saved immediately
- [ ] Select "Black & White" style → Verify style saved immediately
- [ ] Select "Preppy" font → Verify font saved immediately
- [ ] Upload image → Verify upload button shows "Upload (1/3)"
- [ ] Click Preview → Navigate to processor → Image auto-loads
- [ ] Click back → Return to product page
- [ ] **VERIFY**: Pet name "Fluffy" still filled in
- [ ] **VERIFY**: Upload button still shows "Upload (1/3)"
- [ ] **VERIFY**: Style still selected "Black & White"
- [ ] **VERIFY**: Font still selected "Preppy"
- [ ] **VERIFY**: Scroll position restored to where user was

#### **Multiple Pets**
- [ ] Select 3 pets
- [ ] Enter "Fluffy", "Max", "Bella"
- [ ] Upload images for Pet 1 and Pet 3 (skip Pet 2)
- [ ] Click Preview on Pet 3 → Processor loads Pet 3's image
- [ ] Click back → All 3 names still filled, uploads intact

#### **Checkbox & Order Number**
- [ ] Check "Use Existing Perkie Print" → Order number field appears
- [ ] Enter order number "ORD-12345"
- [ ] Navigate away and back
- [ ] **VERIFY**: Checkbox still checked
- [ ] **VERIFY**: Order number still "ORD-12345"
- [ ] **VERIFY**: Order number field still visible

#### **File Management**
- [ ] Upload 3 images for Pet 1
- [ ] Delete 2nd image
- [ ] Navigate to processor and back
- [ ] **VERIFY**: Only 2 images shown (correct ones)
- [ ] **VERIFY**: Upload button shows "Upload (2/3)"

#### **Multiple Products**
- [ ] Go to Product A → Enter "Fluffy"
- [ ] Go to Product B → Enter "Max"
- [ ] Go back to Product A
- [ ] **VERIFY**: Shows "Fluffy" (not "Max")
- [ ] Go back to Product B
- [ ] **VERIFY**: Shows "Max" (not "Fluffy")

### Edge Case Tests

#### **Expiration**
- [ ] Set state with `timestamp` 25 hours ago (manually in localStorage)
- [ ] Reload page
- [ ] **VERIFY**: State NOT restored (expired)
- [ ] **VERIFY**: Expired state removed from localStorage

#### **Corrupted Data**
- [ ] Set invalid JSON in localStorage key
- [ ] Reload page
- [ ] **VERIFY**: Page doesn't crash
- [ ] **VERIFY**: Invalid state removed from localStorage

#### **Product ID Mismatch**
- [ ] Manually change `productId` in saved state to different product
- [ ] Reload page
- [ ] **VERIFY**: State NOT restored (wrong product)

#### **localStorage Full**
- [ ] Fill localStorage with junk data (approach quota)
- [ ] Try to save state
- [ ] **VERIFY**: Cleanup function runs
- [ ] **VERIFY**: Old states (7+ days) removed
- [ ] **VERIFY**: Current state saves successfully

#### **Browser Back Button**
- [ ] Fill in pet selector
- [ ] Click Preview → Navigate to processor
- [ ] Use browser back button (not "Return to Product" if added)
- [ ] **VERIFY**: State restored
- [ ] **VERIFY**: Scroll position restored

### Mobile Tests (70% of traffic)

#### **iOS Safari**
- [ ] Fill in pet selector on iPhone
- [ ] Navigate to processor and back
- [ ] **VERIFY**: State restored correctly
- [ ] Put browser in background for 30 seconds (low memory test)
- [ ] Return to page
- [ ] **VERIFY**: State still intact (or re-saved if lost)

#### **Android Chrome**
- [ ] Fill in pet selector on Android
- [ ] Navigate to processor and back
- [ ] **VERIFY**: State restored correctly
- [ ] Use Android back button (not browser back)
- [ ] **VERIFY**: State restored correctly

#### **Mobile Performance**
- [ ] Type pet name rapidly on mobile
- [ ] **VERIFY**: No lag or stuttering (debounce working)
- [ ] Select style multiple times quickly
- [ ] **VERIFY**: Saves only final selection (immediate save working)

#### **Mobile Scroll Restoration**
- [ ] Scroll halfway down page on mobile
- [ ] Click Preview → Navigate to processor
- [ ] Click back
- [ ] **VERIFY**: Scroll position restored to halfway point

### Multi-Tab Tests

#### **Concurrent Editing**
- [ ] Open product in Tab A
- [ ] Enter "Fluffy" in Tab A
- [ ] Open same product in Tab B
- [ ] **VERIFY**: Tab B shows "Fluffy" (if storage event listener added)
- [ ] Enter "Max" in Tab B
- [ ] Switch to Tab A, reload
- [ ] **VERIFY**: Tab A now shows "Max" (last write wins)

### Console Tests

#### **Debug Logging**
- [ ] Open browser console
- [ ] Fill in pet selector
- [ ] **VERIFY**: See "💾 Saved pet selector state" messages
- [ ] Navigate to processor and back
- [ ] **VERIFY**: See "✅ Loaded valid state" message
- [ ] **VERIFY**: See "🔙 User returned from processor" message

#### **Cleanup Function**
- [ ] Open browser console
- [ ] Run `cleanupPetSelectorStates()`
- [ ] **VERIFY**: All states removed
- [ ] **VERIFY**: See "✅ Cleaned up X pet selector state(s)" message

---

## Part 4: Success Metrics

### UX Metrics (Measure Post-Implementation)

1. **State Restoration Success Rate**
   - **Target**: 95%+ of users returning from processor have state restored
   - **How to measure**: Google Analytics event tracking
     - Event: `pet_selector_state_restored`
     - Event: `pet_selector_state_not_found`
   - **Threshold**: If < 95%, investigate localStorage issues

2. **Re-Upload Rate**
   - **Target**: < 5% of users re-upload same image after processor
   - **How to measure**: Track file upload events with session markers
     - Event: `pet_image_uploaded`
     - Event: `pet_image_re_uploaded` (if same file within 10 minutes)
   - **Threshold**: If > 5%, state restoration failing

3. **Cart Abandonment Rate (Pet Products)**
   - **Target**: Decrease by 10-15%
   - **How to measure**: Shopify Analytics - Cart abandonment funnel
   - **Rationale**: Less friction = more completions

4. **Average Time on Product Page**
   - **Target**: Decrease by 20-30 seconds
   - **How to measure**: Google Analytics - Average time on page
   - **Rationale**: No re-entering data = faster checkout

5. **Mobile vs Desktop Parity**
   - **Target**: Mobile state restoration = Desktop state restoration
   - **How to measure**: Segment restoration events by device type
   - **Threshold**: If mobile < 90% of desktop, investigate mobile-specific issues

### Technical Metrics

1. **localStorage Usage**
   - **Monitor**: Average state size in bytes
   - **Alert if**: > 5KB per product (should be ~2KB)
   - **Action**: Optimize state structure

2. **Page Load Performance**
   - **Monitor**: Time to restore state
   - **Target**: < 50ms
   - **How to measure**: Performance marks in console
     ```javascript
     performance.mark('restore-start');
     applyStateToUI(state);
     performance.mark('restore-end');
     performance.measure('restore-duration', 'restore-start', 'restore-end');
     ```

3. **Error Rate**
   - **Monitor**: localStorage errors, parse errors
   - **Target**: < 0.1% of page loads
   - **How to track**: Send errors to Google Analytics
     ```javascript
     if (error) {
       gtag('event', 'exception', {
         description: error.message,
         fatal: false
       });
     }
     ```

---

## Part 5: Rollout Strategy

### Phase 1: Development & Testing (Week 1)

**Day 1-2**: Implement core functions
- Add `collectPetSelectorState()`
- Add `savePetSelectorState()` + debouncing
- Add `loadPetSelectorState()` + validation
- Add `applyStateToUI()`
- Test on local Shopify test environment

**Day 3-4**: Wire up event listeners
- Modify all 8 event listener locations
- Add page load restoration
- Test on all devices (desktop, mobile, tablet)

**Day 5-7**: Edge case handling
- Add expiration logic
- Add cleanup function
- Handle corrupted data
- Test multi-tab scenarios
- Test localStorage quota

### Phase 2: Limited Rollout (Week 2)

**Deploy to Test Environment**:
- Push to `main` branch (auto-deploys to Shopify test)
- **DO NOT deploy to production yet**
- Test with real URLs (ask user for current test URL)
- Use Chrome DevTools MCP for browser automation testing

**Internal Testing**:
- Run through complete testing checklist (Part 3)
- Test on actual mobile devices (iOS Safari, Android Chrome)
- Verify console logging works correctly
- Check localStorage keys are correct

**Adjust Based on Findings**:
- Fix any bugs discovered
- Optimize performance if needed
- Adjust debounce timings if too slow/fast

### Phase 3: Production Deployment (Week 3)

**Pre-Launch Checks**:
- [ ] All tests passing (100% green)
- [ ] No console errors on test environment
- [ ] Mobile tested on real devices
- [ ] Code reviewed by team
- [ ] Rollback plan ready (git revert)

**Launch**:
1. Deploy to production (push to production branch, if exists)
2. Monitor for 24 hours
3. Check error logs
4. Check restoration success rate
5. Gather user feedback

**Post-Launch Monitoring**:
- Monitor success metrics (Part 4) for 2 weeks
- Investigate any < 95% restoration rate
- Iterate if mobile behaving differently than desktop

### Phase 4: Optimization (Week 4+)

**Based on Data**:
- If restoration slow → optimize `applyStateToUI()`
- If localStorage growing → optimize state structure
- If mobile issues → add mobile-specific handling
- If quota errors → reduce expiration from 24h to 12h

**Optional Enhancements** (if metrics good):
- Add "Resume Customization" banner when state detected
- Add animation when restoring state (smooth fade-in)
- Add toast notification: "We saved your customization!"

---

## Part 6: Alternative Approaches (Not Recommended)

### Alternative 1: Use Hidden Form Fields

**How it would work**:
```html
<input type="hidden" name="restored_pet_1_name" value="Fluffy">
<input type="hidden" name="restored_style" value="enhancedblackwhite">
```

**Pros**:
- No JavaScript required
- Works without localStorage

**Cons**:
- ❌ Requires server-side logic (Shopify Liquid can't do this)
- ❌ State lost on page refresh (not saved anywhere)
- ❌ Can't restore uploads (files not in DOM)
- ❌ Requires form submission to save (doesn't help with Preview flow)

**Verdict**: Not suitable for this use case

---

### Alternative 2: Use Cookies

**How it would work**:
```javascript
document.cookie = `pet_selector_state=${JSON.stringify(state)}; max-age=86400`;
```

**Pros**:
- Survives navigation
- Sent to server on every request

**Cons**:
- ❌ 4KB size limit (too small for multiple pets + base64 images)
- ❌ Sent on EVERY request (performance overhead)
- ❌ Cookie consent issues (GDPR/CCPA)
- ❌ More complex to parse and manage

**Verdict**: Not suitable due to size limits

---

### Alternative 3: Use IndexedDB

**How it would work**:
```javascript
const db = await idb.openDB('perkie', 1);
await db.put('petSelector', state);
```

**Pros**:
- Larger storage (50MB+)
- Structured data
- Better for binary files

**Cons**:
- ❌ Async API (complex to use)
- ❌ Requires polyfill library (not native in older browsers)
- ❌ Overkill for simple form state
- ❌ 10x more complex than localStorage

**Verdict**: Overengineering for this use case

---

### Alternative 4: Use URL Hash Parameters

**How it would work**:
```javascript
window.location.hash = `#pet1=Fluffy&style=blackwhite`;
```

**Pros**:
- No storage needed
- Shareable URLs

**Cons**:
- ❌ Can't store base64 images (URL too long)
- ❌ Visible in URL (ugly)
- ❌ Breaks browser back button behavior
- ❌ Lost on hard refresh if not re-applied

**Verdict**: Not suitable for complex state with images

---

## Part 7: Future Enhancements (Post-MVP)

### Enhancement 1: Cross-Device State Sync

**Use Case**: Customer starts customization on phone, continues on desktop

**Implementation**:
- Store state in Shopify customer metafields (requires login)
- Sync via Shopify Storefront API
- Fallback to localStorage if not logged in

**Complexity**: High (requires backend integration)
**Priority**: Low (nice-to-have)

---

### Enhancement 2: State History (Undo/Redo)

**Use Case**: Customer wants to undo font change

**Implementation**:
```javascript
const stateHistory = [];
let currentIndex = 0;

function undo() {
  if (currentIndex > 0) {
    currentIndex--;
    applyStateToUI(stateHistory[currentIndex]);
  }
}

function redo() {
  if (currentIndex < stateHistory.length - 1) {
    currentIndex++;
    applyStateToUI(stateHistory[currentIndex]);
  }
}
```

**Complexity**: Medium
**Priority**: Low (not requested)

---

### Enhancement 3: Auto-Save Indicator

**Use Case**: Visual feedback that customization is being saved

**Implementation**:
```html
<div class="auto-save-indicator">
  <span class="saving" style="display: none;">Saving...</span>
  <span class="saved" style="display: none;">✓ Saved</span>
</div>
```

```javascript
function showSavingIndicator() {
  document.querySelector('.saving').style.display = 'inline';
  document.querySelector('.saved').style.display = 'none';

  setTimeout(() => {
    document.querySelector('.saving').style.display = 'none';
    document.querySelector('.saved').style.display = 'inline';

    setTimeout(() => {
      document.querySelector('.saved').style.display = 'none';
    }, 2000);
  }, 300);
}
```

**Complexity**: Low
**Priority**: Medium (good UX enhancement)

---

### Enhancement 4: Resume Customization Banner

**Use Case**: Make it obvious to customer that their work was saved

**Implementation**:
```html
<div class="resume-banner" style="display: none;">
  <p>✓ We saved your customization for Fluffy</p>
  <button onclick="clearState()">Start Fresh</button>
</div>
```

```javascript
// Show banner if state was restored
if (state) {
  const banner = document.querySelector('.resume-banner');
  banner.querySelector('p').textContent = `✓ We saved your customization for ${state.pets[1].name}`;
  banner.style.display = 'block';
}
```

**Complexity**: Low
**Priority**: Medium (good UX enhancement)

---

## Part 8: Risk Assessment

### Risk 1: localStorage Not Available

**Scenario**: User has localStorage disabled (privacy mode, browser settings)

**Impact**: State not saved, user forced to re-enter data

**Mitigation**:
```javascript
function isLocalStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// At initialization:
if (!isLocalStorageAvailable()) {
  console.warn('⚠️ localStorage not available, state persistence disabled');
  // Gracefully degrade - form still works, just doesn't save
}
```

**Probability**: Low (< 1% of users)
**Severity**: Medium (poor UX but not broken)

---

### Risk 2: iOS Safari Low Memory Clears localStorage

**Scenario**: iOS clears localStorage when memory pressure high

**Impact**: State lost on low-end iPhones

**Mitigation**:
```javascript
// iOS-specific: Check state integrity every 5 seconds
if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  setInterval(() => {
    const state = loadPetSelectorState();
    if (!state && hasUserEnteredData()) {
      console.warn('⚠️ State lost (iOS low memory?), saving again...');
      savePetSelectorStateImmediate();
    }
  }, 5000);
}
```

**Probability**: Low (< 5% of iOS users)
**Severity**: Medium (annoying but recoverable)

---

### Risk 3: State Structure Changes (Breaking Changes)

**Scenario**: Future update changes state structure, old states invalid

**Impact**: Corrupted states cause crashes or wrong restorations

**Mitigation**:
```javascript
const STATE_VERSION = 1; // Increment when structure changes

function collectPetSelectorState() {
  return {
    version: STATE_VERSION,
    // ... rest of state
  };
}

function loadPetSelectorState() {
  const state = JSON.parse(stored);

  if (state.version !== STATE_VERSION) {
    console.warn('⚠️ State version mismatch, clearing old state');
    localStorage.removeItem(key);
    return null;
  }

  // ... rest of loading logic
}
```

**Probability**: Medium (if we change state structure)
**Severity**: Low (graceful degradation)

---

### Risk 4: Performance Impact on Low-End Devices

**Scenario**: Debouncing and state saves slow down page on old phones

**Impact**: Laggy typing, poor UX

**Mitigation**:
```javascript
// Adaptive debouncing based on device performance
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

const DEBOUNCE_MS = isLowEnd ? 1000 : (isMobile ? 500 : 300);
```

**Probability**: Low (< 10% of users)
**Severity**: Low (adjustable debounce)

---

### Risk 5: Multi-Product Collision

**Scenario**: Product IDs collide, state from Product A applied to Product B

**Impact**: Wrong pet names/styles shown

**Mitigation**:
- Already mitigated by product ID check in `loadPetSelectorState()`
- Shopify product IDs are unique integers, no collision possible

**Probability**: Near zero
**Severity**: Medium (confusing but not breaking)

---

## Summary & Next Steps

### What This Plan Delivers

✅ **Complete state persistence** for pet selector (names, uploads, selections)
✅ **Seamless return flow** from processor page (scroll position restored)
✅ **Mobile-optimized** for 70% of traffic (iOS/Android tested)
✅ **Robust error handling** (expiration, corruption, quota)
✅ **No breaking changes** (progressive enhancement)
✅ **Debuggable** (comprehensive console logging)

### Implementation Effort

**Lines of Code**: ~350 lines (7 new functions + 8 listener modifications)
**Files Modified**: 1 file (`snippets/ks-product-pet-selector-stitch.liquid`)
**Testing Time**: 2 days (functional + edge cases + mobile)
**Total Time**: 5-7 days (dev + test + deploy)

### Success Criteria

1. **Restoration Rate**: 95%+ of users returning from processor have state intact
2. **No Errors**: < 0.1% of page loads have localStorage errors
3. **Performance**: < 50ms to restore state on page load
4. **Mobile Parity**: Mobile restoration = Desktop restoration (within 5%)

### Immediate Next Steps

1. **Review this plan** with team/user
2. **Get approval** to proceed with implementation
3. **Start Phase 1** (Development & Testing)
4. **Use Chrome DevTools MCP** to test on real Shopify test URL
5. **Deploy to test environment** (push to `main` branch)
6. **Run complete testing checklist** (Part 3)
7. **Monitor metrics** post-launch (Part 4)

---

## Questions for Clarification

Before proceeding with implementation, please confirm:

1. **State expiration**: Is 24 hours acceptable, or should it be longer/shorter?
2. **localStorage quota**: If quota exceeded, should we show alert or fail silently?
3. **Visual feedback**: Should we add "Saved" indicator, or keep it invisible?
4. **Resume banner**: Should we add "We saved your work" banner, or too intrusive?
5. **Analytics tracking**: Should we add Google Analytics events for restoration success/failure?

---

**End of Plan**

**Status**: Ready for Review
**Next Action**: Await user approval to proceed with implementation
**Contact**: Update `.claude/tasks/context_session_001.md` when work begins
