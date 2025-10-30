# Pet Data Missing From Orders - Debug Analysis

**Date**: 2025-10-10
**Issue**: Pet data fields not appearing in Shopify order info
**Missing Fields**: `_original_image_url`, `_processed_image_url`, `_pet_name`, `_effect_applied`, `_artist_notes`

---

## Executive Summary

**ROOT CAUSE IDENTIFIED**: The data flow from Pet Processor to Shopify orders is COMPLETE and CORRECT in code. The issue is likely one of the following:

1. **Timing Issue**: Form fields populated AFTER form submission
2. **Event Listener Not Triggered**: `pet:selected` event not firing or being consumed
3. **Storage Corruption**: PetStorage data incomplete or malformed
4. **Form Isolation**: Multiple product forms causing data to go to wrong form instance

---

## Expected Data Flow (Design Intent)

### Step 1: Pet Processing & Storage
**File**: `assets/pet-processor.js` (Lines 939-1031)

```javascript
async savePetData() {
  // 1. Get pet name and artist notes from UI
  const petName = this.container.querySelector('.pet-name-input')?.value || 'Pet';
  const artistNote = this.getArtistNote();
  const selectedEffect = this.currentPet.selectedEffect || 'enhancedblackwhite';

  // 2. Upload to GCS if not already uploaded
  let gcsUrl = effectData.gcsUrl || '';
  let originalUrl = this.currentPet.originalUrl || '';

  if (!gcsUrl && effectData.dataUrl) {
    gcsUrl = await this.uploadToGCS(...); // Upload processed image
  }

  if (!originalUrl && this.currentPet.originalDataUrl) {
    originalUrl = await this.uploadToGCS(...); // Upload original image
  }

  // 3. Save to PetStorage with ALL metadata
  const petData = {
    name: petName,
    artistNote: artistNote,
    filename: this.currentPet.filename,
    effect: selectedEffect,
    thumbnail: effectData.dataUrl,  // Compressed thumbnail
    gcsUrl: gcsUrl,                 // Full-resolution processed URL
    originalUrl: originalUrl        // Full-resolution original URL
  };

  await PetStorage.save(this.currentPet.id, petData);

  // 4. Dispatch event for cart integration
  document.dispatchEvent(new CustomEvent('petProcessorComplete', {
    detail: {
      sessionKey: this.currentPet.id,
      gcsUrl: gcsUrl,
      originalUrl: originalUrl,
      effect: selectedEffect,
      name: petName,
      artistNote: artistNote
    }
  }));
}
```

**Expected Result**: Pet data saved to localStorage with structure:
```javascript
{
  petId: "pet_abc123",
  name: "Fluffy",
  artistNote: "She loves playing with toys",
  thumbnail: "data:image/jpeg;base64,...",
  gcsUrl: "https://storage.googleapis.com/.../processed.png",
  originalUrl: "https://storage.googleapis.com/.../original.png",
  effect: "enhancedblackwhite",
  timestamp: 1234567890
}
```

---

### Step 2: Pet Selection on Product Page
**File**: `snippets/ks-product-pet-selector.liquid` (Lines 2775-2817)

```javascript
// When user selects a pet from grid
var petDataForCart = {
  name: selectedPetsData.map(p => p.name).join(','),
  processedImage: selectedPetsData[0].processedImage,
  effect: selectedPetsData[0].effect,
  originalImage: selectedPetsData[0].originalImage,
  sessionKey: selectedPetsData[0].sessionKey,

  // Fetch from PetStorage.getMetadata()
  gcsUrl: window.PetStorage.getMetadata(sessionKey)?.gcsUrl || '',
  originalUrl: window.PetStorage.getMetadata(sessionKey)?.originalUrl || '',
  artistNote: window.PetStorage.getMetadata(sessionKey)?.artistNote || ''
};

// Dispatch event
document.dispatchEvent(new CustomEvent('pet:selected', {
  detail: petDataForCart
}));
```

**Expected Result**: `pet:selected` event fires with complete data including:
- `gcsUrl` (processed image URL)
- `originalUrl` (original image URL)
- `artistNote` (user notes)

---

### Step 3: Cart Integration Populates Form Fields
**File**: `assets/cart-pet-integration.js` (Lines 38-166)

```javascript
// Listen for pet:selected event
document.addEventListener('pet:selected', function(e) {
  self.updateFormFields(e.detail);
});

updateFormFields: function(petData) {
  // Find all product forms
  var forms = document.querySelectorAll('form[action*="/cart/add"]');

  for (var i = 0; i < forms.length; i++) {
    var form = forms[i];

    // Create/update hidden fields
    var petNameField = form.querySelector('[name="properties[_pet_name]"]');
    petNameField.value = petData.name || '';

    var processedUrlField = form.querySelector('[name="properties[_processed_image_url]"]');
    processedUrlField.value = petData.gcsUrl || petData.processedImage;

    var originalUrlField = form.querySelector('[name="properties[_original_image_url]"]');
    originalUrlField.value = petData.originalUrl || '';

    var artistNotesField = form.querySelector('[name="properties[_artist_notes]"]');
    artistNotesField.value = petData.artistNote || '';

    var effectField = form.querySelector('[name="properties[_effect_applied]"]');
    effectField.value = petData.effect || '';
  }
}
```

**Expected Result**: Hidden form fields populated with values before form submission.

---

### Step 4: Form Submission to Shopify
**File**: `snippets/buy-buttons.liquid` (Lines 61-68)

```liquid
<!-- Pet Image Line Item Properties (Hidden) -->
<input type="hidden" name="properties[_original_image_url]"
       id="original-url-{{ section.id }}" value="">
<input type="hidden" name="properties[_processed_image_url]"
       id="processed-url-{{ section.id }}" value="">
<input type="hidden" name="properties[_pet_name]"
       id="pet-name-{{ section.id }}" value="">
<input type="hidden" name="properties[_effect_applied]"
       id="effect-applied-{{ section.id }}" value="">
<input type="hidden" name="properties[_artist_notes]"
       id="artist-notes-{{ section.id }}" value="">
<input type="hidden" name="properties[_has_custom_pet]"
       id="has-custom-pet-{{ section.id }}" value="false">
```

**Expected Result**: Form submits to `/cart/add` with all properties, Shopify saves them as line item properties visible in order details.

---

## Potential Break Points (Root Causes)

### Break Point #1: GCS Upload Failure (HIGH PROBABILITY)
**Location**: `assets/pet-processor.js`, Line 957-993

**Hypothesis**: If GCS upload fails, `gcsUrl` and `originalUrl` remain empty strings.

**Evidence**:
- Code has fallback: `gcsUrl = effectData.gcsUrl || '';`
- If upload fails, returns `null`, which becomes empty string
- Console shows: `⚠️ Processed image upload failed, will use thumbnail`

**Test**:
```javascript
// Check PetStorage for missing URLs
const pets = window.PetStorage.getAll();
Object.entries(pets).forEach(([id, pet]) => {
  console.log(`Pet ${id}:`);
  console.log(`  - gcsUrl: ${pet.gcsUrl ? 'YES' : 'NO'}`);
  console.log(`  - originalUrl: ${pet.originalUrl ? 'YES' : 'NO'}`);
  console.log(`  - artistNote: ${pet.artistNote ? 'YES' : 'NO'}`);
});
```

**Fix Required**: Ensure GCS upload succeeds before saving to PetStorage, or retry failed uploads.

---

### Break Point #2: PetStorage.getMetadata() Returns Incomplete Data (HIGH PROBABILITY)
**Location**: `assets/pet-storage.js`, Line 262-276

**Hypothesis**: Pet saved without GCS URLs, so `getMetadata()` returns empty strings.

**Evidence**:
- `getMetadata()` reads from localStorage
- If pet was saved BEFORE GCS upload completed, URLs will be missing
- Code in pet-processor.js uploads AFTER saving to localStorage

**Test**:
```javascript
// Check what getMetadata returns
const sessionKey = 'pet_abc123'; // Replace with actual pet ID
const metadata = window.PetStorage.getMetadata(sessionKey);
console.log('Metadata:', metadata);
```

**Fix Required**: Update PetStorage after GCS upload completes, not before.

---

### Break Point #3: Timing Issue - Form Submits Before Fields Updated (MEDIUM PROBABILITY)
**Location**: `assets/cart-pet-integration.js`, Line 296-308

**Hypothesis**: User clicks "Add to Cart" too quickly after selecting pet, before `pet:selected` event propagates.

**Evidence**:
- Event listener is asynchronous
- `updateFormFields()` modifies DOM, which may not complete before form submits
- No confirmation that fields are populated before submission

**Test**:
```javascript
// Add logging to form submission
document.addEventListener('submit', function(e) {
  var form = e.target;
  if (form.action && form.action.indexOf('/cart/add') > -1) {
    console.log('Form submitting with values:');
    console.log('  - pet_name:', form.querySelector('[name="properties[_pet_name]"]')?.value);
    console.log('  - processed_url:', form.querySelector('[name="properties[_processed_image_url]"]')?.value);
    console.log('  - original_url:', form.querySelector('[name="properties[_original_image_url]"]')?.value);
    console.log('  - artist_notes:', form.querySelector('[name="properties[_artist_notes]"]')?.value);
  }
}, true);
```

**Fix Required**: Add synchronous confirmation that fields are populated before allowing form submission.

---

### Break Point #4: Multiple Forms Causing Selector Confusion (LOW PROBABILITY)
**Location**: `assets/cart-pet-integration.js`, Line 59-62

**Hypothesis**: Multiple product forms on page (quick buy, sticky add-to-cart, etc.), and wrong form gets data.

**Evidence**:
- Code updates ALL forms: `querySelectorAll('form[action*="/cart/add"]')`
- Section ID used in field IDs, but selector may mismatch

**Test**:
```javascript
// Check how many forms exist
const forms = document.querySelectorAll('form[action*="/cart/add"]');
console.log(`Found ${forms.length} product forms`);
forms.forEach((form, i) => {
  console.log(`Form ${i}: ${form.id || 'no-id'}`);
});
```

**Fix Required**: Ensure correct form is targeted based on section context.

---

### Break Point #5: Event Not Firing At All (LOW PROBABILITY)
**Location**: `snippets/ks-product-pet-selector.liquid`, Line 2813

**Hypothesis**: `pet:selected` event never dispatches due to error in pet selector logic.

**Evidence**:
- Event wrapped in conditional: `if (petDataForCart)`
- If `selectedPetsData` is empty or malformed, event won't fire
- `PetStorage.getMetadata()` may throw error if sessionKey is invalid

**Test**:
```javascript
// Monitor for event firing
document.addEventListener('pet:selected', function(e) {
  console.log('✅ pet:selected event received:', e.detail);
});

// Also check if event is being dispatched
const originalDispatch = document.dispatchEvent;
document.dispatchEvent = function(event) {
  if (event.type === 'pet:selected') {
    console.log('🔥 pet:selected being dispatched:', event.detail);
  }
  return originalDispatch.call(this, event);
};
```

**Fix Required**: Add error handling and logging around event dispatch.

---

## Files Requiring Investigation

### Primary Files (High Priority)
1. **`assets/pet-processor.js`** (Lines 939-1031)
   - Check: GCS upload success rate
   - Check: PetStorage.save() includes all fields
   - Check: Event dispatch timing

2. **`assets/cart-pet-integration.js`** (Lines 38-166)
   - Check: Event listener is attached
   - Check: updateFormFields() completes before form submit
   - Check: Correct forms are targeted

3. **`snippets/ks-product-pet-selector.liquid`** (Lines 2775-2825)
   - Check: PetStorage.getMetadata() returns complete data
   - Check: Event dispatches with all required fields

### Secondary Files (Medium Priority)
4. **`assets/pet-storage.js`** (Lines 56-100, 262-276)
   - Check: save() method stores all fields correctly
   - Check: getMetadata() returns complete metadata

5. **`snippets/buy-buttons.liquid`** (Lines 61-68)
   - Check: Hidden fields exist in form
   - Check: Field IDs match what cart-pet-integration targets

---

## Recommended Testing Procedure

### Phase 1: Confirm Data Flow Integrity
```javascript
// 1. Check PetStorage after processing
console.group('🔍 PetStorage Check');
const pets = window.PetStorage.getAll();
console.log('Total pets:', Object.keys(pets).length);
Object.entries(pets).forEach(([id, pet]) => {
  console.log(`Pet ${id}:`, {
    name: pet.name,
    gcsUrl: pet.gcsUrl?.substring(0, 50) + '...',
    originalUrl: pet.originalUrl?.substring(0, 50) + '...',
    artistNote: pet.artistNote
  });
});
console.groupEnd();

// 2. Monitor pet:selected event
document.addEventListener('pet:selected', function(e) {
  console.group('✅ pet:selected Event');
  console.log('Event detail:', e.detail);
  console.log('Has gcsUrl:', !!e.detail.gcsUrl);
  console.log('Has originalUrl:', !!e.detail.originalUrl);
  console.log('Has artistNote:', !!e.detail.artistNote);
  console.groupEnd();
});

// 3. Check form fields before submission
document.addEventListener('submit', function(e) {
  const form = e.target;
  if (form.action && form.action.includes('/cart/add')) {
    console.group('🛒 Form Submission');
    console.log('pet_name:', form.querySelector('[name="properties[_pet_name]"]')?.value);
    console.log('processed_url:', form.querySelector('[name="properties[_processed_image_url]"]')?.value);
    console.log('original_url:', form.querySelector('[name="properties[_original_image_url]"]')?.value);
    console.log('artist_notes:', form.querySelector('[name="properties[_artist_notes]"]')?.value);
    console.log('effect_applied:', form.querySelector('[name="properties[_effect_applied]"]')?.value);
    console.groupEnd();
  }
}, true);
```

### Phase 2: Reproduce Issue in Test Environment
1. Open Shopify staging product page with "custom" tag
2. Open browser DevTools console
3. Run Phase 1 test code
4. Process a pet image with name "TestPet" and artist note "Test note"
5. Select the pet from pet selector
6. Click "Add to Cart"
7. Check cart drawer for line item properties
8. Place test order
9. Check order details in Shopify admin for properties

### Phase 3: Identify Missing Data Point
Based on console logs:
- **If PetStorage missing data**: Issue is in pet-processor.js save logic
- **If event missing data**: Issue is in ks-product-pet-selector.liquid metadata fetch
- **If form fields empty**: Issue is in cart-pet-integration.js updateFormFields
- **If form fields have data but order doesn't**: Issue is Shopify-side (unlikely)

---

## Most Likely Root Cause (Hypothesis)

**PRIMARY THEORY**: GCS upload happens AFTER PetStorage.save(), so metadata is incomplete when pet selector reads it.

**Evidence**:
1. pet-processor.js saves pet data immediately (line 1007)
2. GCS upload happens before save (lines 959-993) but may fail silently
3. If upload fails, `gcsUrl` and `originalUrl` are empty strings
4. Pet selector reads from PetStorage.getMetadata() which returns empty strings
5. Form fields get populated with empty strings
6. Shopify saves empty strings as line item properties

**Critical Code Path**:
```
pet-processor.js:savePetData()
  → uploadToGCS() [may fail, returns null]
  → gcsUrl = null || '' → empty string
  → PetStorage.save(petData with empty gcsUrl)
  → Event dispatches
  → Pet selector reads PetStorage.getMetadata()
  → Returns empty gcsUrl
  → cart-pet-integration sets field value to ''
  → Shopify saves empty property
```

**Fix**: Ensure GCS upload succeeds before saving, or update PetStorage after upload completes.

---

## Recommended Implementation Plan

See separate file: `.claude/doc/pet-data-missing-orders-fix-plan.md`

**Summary of Fixes**:
1. Add GCS upload retry logic with exponential backoff
2. Update PetStorage AFTER successful GCS upload
3. Add validation before event dispatch
4. Add form field validation before submission
5. Add comprehensive error logging

**Estimated Effort**: 4-6 hours implementation + 2-3 hours testing

---

## Questions for User

1. **When did this issue start occurring?** (Check if correlates with recent GCS upload implementation)
2. **Are ANY fields present in orders, or ALL missing?** (Helps narrow down break point)
3. **Do you see console warnings about GCS upload failures?** (`⚠️ Processed image upload failed`)
4. **Can you share a sample order showing missing data?** (Verify issue exists)
5. **Are you testing on staging or production?** (Different environments may have different issues)

---

## Next Steps

1. **User confirms issue exists** → Run Phase 1 testing procedure
2. **Identify exact break point** → Implement targeted fix
3. **Test fix in staging** → Verify all fields populate correctly
4. **Deploy to production** → Monitor for 24 hours
5. **Create regression test** → Prevent future occurrences

---

## Dependencies

- **PetStorage API** (pet-storage.js)
- **Pet Processor** (pet-processor.js)
- **Cart Integration** (cart-pet-integration.js)
- **Pet Selector** (ks-product-pet-selector.liquid)
- **GCS Upload API** (/store-image endpoint)
- **Shopify Line Item Properties** (native Shopify feature)
