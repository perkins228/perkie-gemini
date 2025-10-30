# Original + Processed Pet Image Storage Implementation Plan

## Executive Summary

**Problem**: Fulfillment staff need both ORIGINAL and PROCESSED pet images, but currently only processed images reach Shopify orders. Original uploads are lost after API processing.

**Solution**: Store original image as data URL alongside processed effects, then populate comprehensive cart properties matching order-custom-images.liquid expectations.

**Approach**: Extend existing working architecture with minimal changes, following our "elegant simplicity" rule.

## Current State Analysis

### What We Have (Working)
- ✅ Processed effects stored in `window.perkieEffects` as data URLs
- ✅ localStorage persistence for cross-page navigation  
- ✅ Cart integration with basic properties
- ✅ Order display system expecting detailed properties

### What's Missing (Critical Gaps)
- ❌ Original uploaded image is discarded after API processing
- ❌ Cart properties don't match order display expectations
- ❌ Missing: original_image_url, filename, timestamps
- ❌ Property naming mismatch between cart and order display

### Current Property Mismatch

**Cart Properties** (buy-buttons.liquid):
```
properties[Pet Name]           → Simple name
properties[Pet Session]        → Session key  
properties[Pet Effect]         → Effect name
properties[Pet Image URL]      → Processed URL only
properties[Has Custom Pet]     → Boolean flag
```

**Expected Properties** (order-custom-images.liquid):
```
_original_image_url     → MISSING!
_processed_image_url    → Have this
_image_filename         → MISSING!  
_effect_applied         → Have this
_session_id             → Have this
_editing_timestamp      → MISSING!
```

## Implementation Strategy

### Phase 1: Store Original Image (Pet Processor Changes)

**File**: `assets/pet-processor-v5-es5.js`

**Location**: `handleFileUpload` method (around line 270)

**Changes**:
1. Convert original file to data URL before API upload
2. Store in `window.perkieEffects` as `${sessionKey}_original`
3. Store metadata for cart properties

**Implementation**:
```javascript
// After line 272 (this.currentFile = resizedFile;)
// Add original image storage

// Convert original to data URL for storage
var self = this;
var reader = new FileReader();
reader.onload = function(e) {
  var originalDataUrl = e.target.result;
  var originalKey = self.currentSessionKey + '_original';
  
  // Store original image
  window.perkieEffects.set(originalKey, originalDataUrl);
  
  // Store metadata for cart properties
  var metadataKey = self.currentSessionKey + '_metadata';
  window.perkieEffects.set(metadataKey, {
    filename: self.currentFile.name,
    timestamp: new Date().toISOString(),
    fileSize: self.currentFile.size
  });
  
  console.log('✅ Stored original image:', originalKey);
};
reader.readAsDataURL(this.currentFile);
```

### Phase 2: Update Cart Properties (Buy Buttons Changes)

**File**: `snippets/buy-buttons.liquid`

**Location**: Lines 59-64 (hidden form fields)

**Changes**: Replace current basic properties with detailed structure

**Current**:
```html
<input type="hidden" name="properties[Pet Name]" id="pet-name-{{ section.id }}" value="">
<input type="hidden" name="properties[Pet Session]" id="pet-session-{{ section.id }}" value="">  
<input type="hidden" name="properties[Pet Effect]" id="pet-effect-{{ section.id }}" value="">
<input type="hidden" name="properties[Pet Image URL]" id="pet-image-url-{{ section.id }}" value="">
<input type="hidden" name="properties[Has Custom Pet]" id="has-custom-pet-{{ section.id }}" value="false">
```

**New Structure**:
```html
<!-- Original Properties (for order display) -->
<input type="hidden" name="properties[_original_image_url]" id="original-image-url-{{ section.id }}" value="">
<input type="hidden" name="properties[_processed_image_url]" id="processed-image-url-{{ section.id }}" value="">  
<input type="hidden" name="properties[_image_filename]" id="image-filename-{{ section.id }}" value="">
<input type="hidden" name="properties[_effect_applied]" id="effect-applied-{{ section.id }}" value="">
<input type="hidden" name="properties[_session_id]" id="session-id-{{ section.id }}" value="">
<input type="hidden" name="properties[_editing_timestamp]" id="editing-timestamp-{{ section.id }}" value="">

<!-- Legacy Properties (for backward compatibility) -->
<input type="hidden" name="properties[Pet Name]" id="pet-name-{{ section.id }}" value="">
<input type="hidden" name="properties[Has Custom Pet]" id="has-custom-pet-{{ section.id }}" value="false">
```

### Phase 3: Update Cart Integration Logic

**File**: `snippets/buy-buttons.liquid`

**Location**: Lines 169-205 (petSelected event handler)

**Changes**: Populate all required properties from stored data

**New Logic**:
```javascript
document.addEventListener('petSelected', function(event) {
  const petData = event.detail;
  const sessionKey = petData.sessionKey;
  
  // Get stored metadata
  const metadataKey = sessionKey + '_metadata';
  const metadata = window.perkieEffects.get(metadataKey) || {};
  
  // Get original and processed images
  const originalKey = sessionKey + '_original';
  const originalImageUrl = window.perkieEffects.get(originalKey);
  const processedImageUrl = petData.effects[petData.primaryEffect];
  
  // Populate detailed properties
  document.getElementById(`original-image-url-${sectionId}`).value = originalImageUrl || '';
  document.getElementById(`processed-image-url-${sectionId}`).value = processedImageUrl || '';
  document.getElementById(`image-filename-${sectionId}`).value = metadata.filename || '';
  document.getElementById(`effect-applied-${sectionId}`).value = petData.primaryEffect || '';
  document.getElementById(`session-id-${sectionId}`).value = sessionKey || '';
  document.getElementById(`editing-timestamp-${sectionId}`).value = metadata.timestamp || '';
  
  // Legacy properties (backward compatibility)
  document.getElementById(`pet-name-${sectionId}`).value = petData.petName || '';
  document.getElementById(`has-custom-pet-${sectionId}`).value = 'true';
  
  console.log('✅ Cart updated with original + processed image data');
});
```

### Phase 4: Update localStorage Persistence

**File**: `assets/pet-processor-v5-es5.js`

**Location**: `saveEffectsToLocalStorage` method (line 1175)

**Changes**: Include original images and metadata in backup

**Updated Logic**:
```javascript
PetProcessorV5.prototype.saveEffectsToLocalStorage = function() {
  try {
    if (!window.perkieEffects || window.perkieEffects.size === 0) return;
    
    var effectsData = {};
    var metadataData = {};
    
    window.perkieEffects.forEach(function(value, key) {
      if (key.endsWith('_metadata')) {
        // Store metadata separately (not as data URL)
        metadataData[key] = value;
      } else if (value && typeof value === 'string' && value.startsWith('data:')) {
        // Store all data URLs (original + processed)
        effectsData[key] = value;
      }
    });
    
    if (Object.keys(effectsData).length > 0) {
      localStorage.setItem('perkieEffects_backup', JSON.stringify(effectsData));
      localStorage.setItem('perkieMetadata_backup', JSON.stringify(metadataData));
      console.log('✅ Backed up', Object.keys(effectsData).length, 'images +', Object.keys(metadataData).length, 'metadata');
    }
  } catch (error) {
    console.warn('Failed to backup effects to localStorage:', error);
  }
};
```

### Phase 5: Update Restore Logic

**File**: `snippets/ks-product-pet-selector.liquid`

**Location**: `restoreEffectsFromLocalStorage` function

**Changes**: Restore metadata alongside images

**Updated Logic**:
```javascript
function restoreEffectsFromLocalStorage() {
  try {
    // Restore images
    var effectsBackup = localStorage.getItem('perkieEffects_backup');
    if (effectsBackup) {
      var effectsData = JSON.parse(effectsBackup);
      Object.keys(effectsData).forEach(function(key) {
        window.perkieEffects.set(key, effectsData[key]);
      });
    }
    
    // Restore metadata
    var metadataBackup = localStorage.getItem('perkieMetadata_backup');
    if (metadataBackup) {
      var metadataData = JSON.parse(metadataBackup);
      Object.keys(metadataData).forEach(function(key) {
        window.perkieEffects.set(key, metadataData[key]);
      });
    }
    
    if (effectsBackup || metadataBackup) {
      console.log('✅ Restored effects from localStorage backup');
      return true;
    }
  } catch (error) {
    console.warn('Failed to restore effects from localStorage:', error);
  }
  return false;
}
```

## Data URL Size Considerations

### Shopify Property Limits
- **Line Item Properties**: 255 characters per property
- **Solution**: Store data URLs in localStorage, truncate if needed for cart
- **Fallback**: Store first 250 characters for cart, full URL in localStorage

### Truncation Strategy
```javascript
// In cart integration logic
var truncatedOriginal = originalImageUrl ? originalImageUrl.substring(0, 250) : '';
var truncatedProcessed = processedImageUrl ? processedImageUrl.substring(0, 250) : '';

document.getElementById(`original-image-url-${sectionId}`).value = truncatedOriginal;
document.getElementById(`processed-image-url-${sectionId}`).value = truncatedProcessed;
```

### Storage Size Estimates
- **Original Image**: ~2MB → ~2.7MB base64 
- **Processed Images**: 4 effects × ~1.5MB → ~8MB base64
- **Total**: ~11MB per pet session
- **localStorage Limit**: ~5-10MB (browser dependent)

**Mitigation**: Clean up old sessions automatically after 24 hours.

## Implementation Timeline

### Phase 1: Core Storage (Day 1)
- [ ] Add original image capture to pet processor
- [ ] Store metadata alongside images
- [ ] Test storage/retrieval of original images

### Phase 2: Cart Integration (Day 1)  
- [ ] Update buy-buttons.liquid with detailed properties
- [ ] Update cart integration logic
- [ ] Test cart properties population

### Phase 3: Persistence Updates (Day 1)
- [ ] Update localStorage backup to include originals
- [ ] Update restore logic in pet selector
- [ ] Test cross-page persistence

### Phase 4: Testing & Validation (Day 2)
- [ ] End-to-end testing: upload → process → navigate → add to cart
- [ ] Verify order-custom-images.liquid displays correctly
- [ ] Test storage size limits and cleanup
- [ ] Mobile testing for data URL handling

## Risk Assessment

### LOW RISK ✅
- **Extends existing working architecture** (no breaking changes)
- **Graceful degradation** if storage fails (falls back to processed only)
- **Backward compatibility** maintained with legacy properties
- **Easy rollback** if issues arise (single file modifications)

### MITIGATION STRATEGIES
- **Storage Overflow**: Auto-cleanup old sessions after 24 hours
- **Property Truncation**: Store full URLs in localStorage, truncated in cart
- **Cross-Browser Issues**: Comprehensive localStorage error handling
- **Performance Impact**: Lazy loading of large data URLs

## Success Metrics

### Technical Success
- [ ] Original images stored alongside processed images
- [ ] All 6 required properties populated in cart
- [ ] order-custom-images.liquid displays both original and processed
- [ ] Cross-page persistence maintains original images
- [ ] Storage cleanup prevents browser limits

### Business Success  
- [ ] Fulfillment staff can access original images in orders
- [ ] Quality control process improved with original/processed comparison
- [ ] Customer service can resolve image-related issues
- [ ] Print production has access to source files

## Assumptions

1. **Data URL Approach**: Acceptable for temporary storage (24-hour cleanup)
2. **Property Truncation**: Order display can handle truncated URLs (localStorage has full)
3. **Storage Limits**: 11MB per session within browser localStorage limits
4. **Performance**: Modern browsers handle large data URLs efficiently  
5. **Compatibility**: ES5 approach works across all target browsers

## Next Steps

After implementing this plan:
1. **Monitor storage usage** and implement aggressive cleanup if needed
2. **Consider CDN migration** if data URL approach proves problematic
3. **Add compression** for data URLs if storage becomes an issue
4. **Implement admin panel** for fulfillment staff to access images directly

This solution provides immediate value while maintaining our architectural principles of simplicity and elegance. It solves the critical business need for original image access without over-engineering the solution.