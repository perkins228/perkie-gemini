# Customer Journey Verification & Implementation Plan

## Executive Summary
The Perkie Prints customer journey is partially functional but has critical gaps preventing conversion. The main issues are:
1. Storage synchronization is incomplete (effect key mismatch)
2. Artist notes functionality completely missing
3. Pet selector not showing thumbnails despite storage sync attempt
4. Cart properties not being populated with pet data
5. GCS upload not implemented (using data URLs only)

## Root Cause Analysis

### Issue 1: Pet Selector Empty State (CRITICAL)
**Root Cause**: Storage key mismatch and incomplete synchronization
- pet-processor.js saves with keys: `enhancedblackwhite`, `popart`, `dithering`, `color`
- pet-selector expects different format in `perkieEffects_selected`
- syncToLegacyStorage() method exists but has bugs:
  - Line 348: Tries to access `this.currentPet.effects[selectedEffect]` 
  - Problem: Effects keys don't match (e.g., `popart` vs expected format)
  - Result: effectData is undefined, save fails silently

**Impact**: 100% conversion failure - customers cannot select their processed pets

### Issue 2: Artist Notes Missing (HIGH)
**Root Cause**: Feature not implemented in simplified pet-processor.js
- Old ES5 version had complete implementation (lines 25, 155-167, 324-344)
- New ES6 version has no artist notes functionality
- UI element missing from render() method
- No getArtistNote() method
- No artist notes in saveToCart() method

**Impact**: Loss of customer personalization requests, reduced product quality

### Issue 3: Cart Properties Not Populated (CRITICAL)
**Root Cause**: Integration between processor and buy-buttons incomplete
- buy-buttons.liquid expects properties: `_original_image_url`, `_processed_image_url`, `_artist_notes`
- pet-processor.js dispatches `petProcessorComplete` event but data not used
- No connection to populate hidden input fields in buy-buttons

**Impact**: Orders lack pet data, employees cannot fulfill custom products

### Issue 4: GCS Upload Not Implemented (MEDIUM)
**Root Cause**: Simplified version removed cloud upload functionality
- Using data URLs only (stored in localStorage/sessionStorage)
- No API endpoints called for GCS upload
- gcsUrl fields remain empty

**Impact**: Large data URLs in localStorage, potential quota issues, no permanent storage

## Implementation Plan

### Phase 1: Fix Storage Synchronization (2-3 hours)
**Files to modify:**
- `assets/pet-processor.js`

**Changes needed:**

1. **Fix effect key mapping in processImage() method (line ~211)**
```javascript
// Current (broken):
const effects = result.effects;
this.currentPet.effects = {
  enhancedblackwhite: { dataUrl: effects.blackwhite },
  popart: { dataUrl: effects.popart },
  // ...
};

// Should be:
this.currentPet.effects = {
  enhancedblackwhite: { 
    dataUrl: 'data:image/jpeg;base64,' + effects.blackwhite,
    gcsUrl: '' 
  },
  popart: { 
    dataUrl: 'data:image/jpeg;base64,' + effects.popart,
    gcsUrl: '' 
  },
  dithering: { 
    dataUrl: 'data:image/jpeg;base64,' + effects.dithering,
    gcsUrl: '' 
  },
  color: { 
    dataUrl: 'data:image/jpeg;base64,' + effects.color,
    gcsUrl: '' 
  }
};
```

2. **Fix saveToCart() method (lines 343-395)**
```javascript
// Add null check and proper data structure
saveToCart() {
  if (!this.currentPet) return;
  
  const petName = this.container.querySelector('.pet-name-input')?.value || 'Pet';
  const selectedEffect = this.currentPet.selectedEffect || 'enhancedblackwhite';
  
  // Map internal effect names to display names for consistency
  const effectMapping = {
    'enhancedblackwhite': 'blackwhite',
    'popart': 'popart',
    'dithering': 'dithering',
    'color': 'color'
  };
  
  const mappedEffect = effectMapping[selectedEffect] || selectedEffect;
  const effectData = this.currentPet.effects[selectedEffect];
  
  if (!effectData || !effectData.dataUrl) {
    console.error('Invalid effect data for:', selectedEffect);
    return;
  }
  
  // Create complete pet data object
  const petData = {
    sessionKey: this.currentPet.id,
    name: petName,
    filename: this.currentPet.filename,
    effect: mappedEffect,
    thumbnail: effectData.dataUrl,
    gcsUrl: effectData.gcsUrl || '',
    originalImage: this.currentPet.original,
    timestamp: Date.now()
  };
  
  // Save to both storage systems
  PetStorage.save(this.currentPet.id, petData);
  this.syncToLegacyStorage(this.currentPet.id, petData);
  
  // Populate cart form fields
  this.populateCartFields(petData);
  
  // Dispatch event
  document.dispatchEvent(new CustomEvent('petProcessorComplete', {
    detail: petData
  }));
}
```

3. **Update syncToLegacyStorage() method (lines 401-435)**
```javascript
syncToLegacyStorage(petId, data) {
  try {
    // Get existing effects
    let effects = {};
    const stored = localStorage.getItem('perkieEffects_selected');
    if (stored) {
      try {
        effects = JSON.parse(stored);
      } catch (e) {
        effects = {};
      }
    }
    
    // Store in format expected by pet selector
    effects[petId] = {
      sessionKey: petId,
      effect: data.effect,
      thumbnail: data.thumbnail,
      gcsUrl: data.gcsUrl || '',
      name: data.name,
      filename: data.filename,
      originalImage: data.originalImage,
      timestamp: data.timestamp
    };
    
    // Also store individual effect thumbnails for selector
    if (data.thumbnail) {
      localStorage.setItem(`pet_${petId}_${data.effect}`, data.thumbnail);
    }
    
    // Save main effects object
    localStorage.setItem('perkieEffects_selected', JSON.stringify(effects));
    
    // Update window object for immediate access
    window.perkieEffects = new Map(Object.entries(effects));
    
    console.log('✅ Synced to legacy storage:', petId, 'with effect:', data.effect);
  } catch (error) {
    console.error('Failed to sync to legacy storage:', error);
  }
}
```

### Phase 2: Add Artist Notes (2 hours)
**Files to modify:**
- `assets/pet-processor.js`

**Changes needed:**

1. **Update render() method to include artist notes UI (after line 89)**
```javascript
<!-- Artist Notes Section -->
<div class="artist-notes-section">
  <label for="artist-notes-${this.sectionId}">Note for the Artist (Optional)</label>
  <textarea 
    id="artist-notes-${this.sectionId}" 
    class="artist-notes-input"
    placeholder="Any special requests about your pet's personality or features"
    rows="3"
    maxlength="500"></textarea>
  <div class="char-count">
    <span id="char-count-${this.sectionId}">0</span>/500
  </div>
</div>
```

2. **Add artist notes event handler in bindEvents() (after line 140)**
```javascript
// Artist notes handling
const notesField = this.container.querySelector(`#artist-notes-${this.sectionId}`);
const charCount = this.container.querySelector(`#char-count-${this.sectionId}`);
if (notesField) {
  notesField.addEventListener('input', (e) => {
    const length = e.target.value.length;
    if (charCount) charCount.textContent = length;
  });
}
```

3. **Add getArtistNote() method (after line 342)**
```javascript
getArtistNote() {
  const noteField = this.container.querySelector(`#artist-notes-${this.sectionId}`);
  return noteField ? noteField.value.trim() : '';
}
```

4. **Update saveToCart() to include artist notes**
```javascript
const petData = {
  // ... existing fields ...
  artistNote: this.getArtistNote()
};
```

### Phase 3: Wire Cart Properties (2 hours)
**Files to modify:**
- `assets/pet-processor.js`

**Changes needed:**

1. **Add populateCartFields() method (after saveToCart)**
```javascript
populateCartFields(petData) {
  // Find product form in parent document
  const productForm = document.querySelector('form[action*="/cart/add"]');
  if (!productForm) {
    console.warn('Product form not found');
    return;
  }
  
  // Populate hidden fields
  const fields = {
    '_original_image_url': petData.originalImage || '',
    '_processed_image_url': petData.thumbnail || '',
    '_pet_name': petData.name || '',
    '_effect_applied': petData.effect || '',
    '_artist_notes': petData.artistNote || '',
    '_has_custom_pet': 'true'
  };
  
  Object.entries(fields).forEach(([name, value]) => {
    let input = productForm.querySelector(`input[name="properties[${name}]"]`);
    if (!input) {
      // Create field if it doesn't exist
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = `properties[${name}]`;
      productForm.appendChild(input);
    }
    input.value = value;
  });
  
  console.log('✅ Cart properties populated');
}
```

### Phase 4: Implement GCS Upload (4-6 hours) - DEFERRED
**Note**: This is lower priority as data URLs are working. Can be implemented later for optimization.

**Would require:**
- API endpoint for GCS upload
- Async upload after processing
- URL replacement in storage
- Error handling for upload failures

### Phase 5: Fix Pet Selector Display (1 hour)
**Files to modify:**
- `snippets/ks-product-pet-selector.liquid`

**Changes needed:**

1. **Update loadSavedPets() function (lines 855-900)**
```javascript
function loadSavedPets() {
  console.log('🐕 Loading saved pets...');
  const contentEl = document.getElementById(`pet-selector-content-${sectionId}`);
  const emptyEl = document.getElementById(`pet-selector-empty-${sectionId}`);
  
  // Check localStorage for saved pets
  const savedEffects = localStorage.getItem('perkieEffects_selected');
  
  if (!savedEffects) {
    // Show empty state
    if (contentEl) contentEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  
  try {
    const pets = JSON.parse(savedEffects);
    const petKeys = Object.keys(pets);
    
    if (petKeys.length === 0) {
      // Show empty state
      if (contentEl) contentEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    
    // Build pet grid HTML
    let html = '<div class="ks-pet-selector__pets">';
    
    petKeys.forEach(key => {
      const pet = pets[key];
      html += `
        <div class="ks-pet-selector__pet" data-pet-id="${key}">
          <img src="${pet.thumbnail}" alt="${pet.name}" class="ks-pet-selector__pet-image">
          <div class="ks-pet-selector__pet-name">${pet.name}</div>
          <div class="ks-pet-selector__pet-effect">${pet.effect}</div>
          <button class="ks-pet-selector__select-btn" data-pet-id="${key}">Select</button>
          <button class="ks-pet-selector__remove-btn" data-pet-id="${key}">×</button>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Update UI
    if (contentEl) {
      contentEl.innerHTML = html;
      contentEl.style.display = 'block';
    }
    if (emptyEl) emptyEl.style.display = 'none';
    
    // Bind pet selection events
    bindPetSelectionEvents();
    
  } catch (e) {
    console.error('Error loading pets:', e);
    // Show empty state on error
    if (contentEl) contentEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
  }
}
```

## Testing Checklist

### Pre-Implementation Tests
- [ ] Verify IMG_2733.jpeg exists in testing directory
- [ ] Verify test-assets/sample-pet.jpg exists as fallback
- [ ] Check current localStorage state for any existing data
- [ ] Document current console errors

### Post-Implementation Tests

#### 1. Image Upload & Processing
- [ ] Upload IMG_2733.jpeg successfully
- [ ] API processes image (20-30 seconds)
- [ ] All 4 effects generated and visible
- [ ] Can switch between effects smoothly
- [ ] Effects have proper data URLs (not undefined)

#### 2. Pet Name & Artist Notes
- [ ] Pet name input accepts text
- [ ] Artist notes textarea appears
- [ ] Character counter works (0/500)
- [ ] Both values persist when switching effects

#### 3. Storage Synchronization
- [ ] Check localStorage has `perkieEffects_selected` key
- [ ] Verify pet data structure is complete
- [ ] Check window.perkieEffects Map has entries
- [ ] Verify thumbnail URLs are valid data URLs

#### 4. Pet Selector Display
- [ ] Navigate to product page with "custom" tag
- [ ] Pet selector shows saved pets (not empty state)
- [ ] Thumbnail images display correctly
- [ ] Pet name and effect label visible
- [ ] Select button works
- [ ] Remove button works

#### 5. Cart Integration
- [ ] Click "Add to Cart" in processor
- [ ] Check form has populated hidden fields
- [ ] Add product to cart
- [ ] Verify cart API call includes properties
- [ ] Check order in Shopify admin has metadata

#### 6. Multiple Pets Flow
- [ ] Process first pet (IMG_2733.jpeg)
- [ ] Process second pet (sample-pet.jpg)
- [ ] Both appear in selector
- [ ] Can select different pets
- [ ] Can remove individual pets
- [ ] Storage persists page refresh

## Risk Assessment

### Current State Risks (WITHOUT fixes)
- **CRITICAL**: 100% conversion failure - no custom orders possible
- **HIGH**: Customer frustration - feature appears broken
- **HIGH**: Lost revenue - core business model non-functional
- **MEDIUM**: Support burden - customers complaining about broken feature

### Implementation Risks
- **LOW**: Code changes are localized to 2 files
- **LOW**: No database migrations needed
- **LOW**: Backward compatible with existing data
- **MEDIUM**: localStorage quota could fill with data URLs
- **MEDIUM**: Testing time needed (4-6 hours comprehensive)

### Post-Implementation Risks
- **LOW**: System will be functional for core use case
- **MEDIUM**: GCS upload still missing (data URLs only)
- **LOW**: Some edge cases may remain
- **MEDIUM**: Performance impact of data URLs in localStorage

## Recommendations

### Immediate Actions (Today)
1. Implement Phase 1 (Storage Sync) - 2-3 hours
2. Implement Phase 2 (Artist Notes) - 2 hours
3. Implement Phase 3 (Cart Properties) - 2 hours
4. Implement Phase 5 (Selector Display) - 1 hour
5. Test complete flow - 2 hours

### Follow-up Actions (This Week)
1. Implement GCS upload for permanent storage
2. Add progress indicators for upload
3. Implement storage quota management
4. Add analytics tracking for conversion

### Long-term Improvements (Next Sprint)
1. Migrate to IndexedDB for better storage
2. Implement image compression before storage
3. Add multi-pet cart management UI
4. Create employee dashboard for order fulfillment

## Success Metrics
- [ ] Pet selector shows thumbnails (not empty state)
- [ ] Complete order with pet data in Shopify admin
- [ ] Artist notes appear in order properties
- [ ] No console errors during flow
- [ ] Flow works on mobile devices
- [ ] Page refresh doesn't lose pet data

## Estimated Timeline
- **Phase 1-3, 5**: 7-8 hours implementation
- **Testing**: 2-3 hours
- **Total**: 9-11 hours for MVP functionality
- **Phase 4 (GCS)**: Additional 4-6 hours when needed

## Critical Notes for Implementation
1. **DO NOT** change effect names without updating ALL references
2. **ENSURE** data URLs include proper prefix (`data:image/jpeg;base64,`)
3. **TEST** with actual test images (IMG_2733.jpeg, sample-pet.jpg)
4. **VERIFY** localStorage writes after each save
5. **CHECK** console for errors at each step
6. **MAINTAIN** backward compatibility with existing storage