# Multi-GCS URL Architecture Implementation Plan

## Date: 2025-10-28
## Author: Project Manager E-commerce Agent
## Status: READY FOR IMPLEMENTATION
## Context: .claude/tasks/context_session_001.md

---

## Executive Summary

This plan details the implementation of multi-GCS URL storage architecture for Effects V2, enabling complete effect preservation in the cloud. The system will upload all generated effects (Color, B&W, Modern, Classic) to Google Cloud Storage immediately after creation, storing all URLs in localStorage for future pet-selector integration.

**Business Impact**: Enables customers to browse all previously generated effects when adding pets to products, significantly improving the purchase flow and reducing regeneration overhead.

**Technical Scope**: Modify Effects V2 to upload and track multiple GCS URLs per pet, preparing for future pet-selector that will allow effect selection at cart addition.

---

## Business Requirements

### User Journey (FINAL)

**Effects V2 Flow** (Current Implementation Focus):
1. Customer uploads pet image
2. InSPyReNet removes background → Creates Color + B&W effects
3. System uploads BOTH Color + B&W to GCS immediately
4. User clicks Modern → Gemini generates → Uploads Modern to GCS
5. User clicks Classic → Gemini generates → Uploads Classic to GCS
6. ALL generated effect GCS URLs saved to localStorage

**Pet Selector Flow** (Future Implementation):
- Customer browses saved pets from localStorage
- Each pet displays ALL effects they've generated
- Customer chooses which specific effect to add to product
- Only the selected effect's GCS URL goes to cart/order

**Employee View** (Order Management):
- Pet name
- Selected effect name (e.g., "modern")
- Selected effect GCS URL (customer's choice)
- Artist notes
- (Optional: All GCS URLs for reference)

---

## Data Architecture

### Current Architecture (BEFORE)

```javascript
// localStorage structure - Effects V2 current
{
  petId: "pet_123_abc",
  name: "Riley",
  thumbnail: "data:image/jpeg;base64,...", // Compressed
  effect: "color", // Last viewed
  gcsUrl: "https://storage.googleapis.com/.../riley.jpg", // Single URL
  artistNote: "",
  timestamp: 1234567890
}

// window.perkiePets - Current
{
  pets: [{
    sessionKey: "pet_123_abc",
    petName: "Riley",
    gcsUrl: "https://storage.googleapis.com/.../riley.jpg", // Single
    artistNote: ""
  }]
}
```

### New Architecture (AFTER)

```javascript
// localStorage structure - Multi-GCS
{
  petId: "pet_123_abc",
  name: "Riley",
  thumbnail: "data:image/jpeg;base64,...", // Compressed (unchanged)
  currentEffect: "modern", // Last viewed effect (was 'effect')
  gcsUrls: { // NEW: Object instead of single string
    color: "https://storage.googleapis.com/.../riley_color.jpg",
    enhancedblackwhite: "https://storage.googleapis.com/.../riley_bw.jpg",
    modern: "https://storage.googleapis.com/.../riley_modern.jpg",
    classic: null // Not generated yet
  },
  artistNote: "",
  timestamp: 1234567890
}

// window.perkiePets - Multi-GCS
{
  pets: [{
    sessionKey: "pet_123_abc",
    petName: "Riley",
    currentEffect: "modern", // Last viewed
    gcsUrls: { // NEW: All URLs available
      color: "https://...",
      enhancedblackwhite: "https://...",
      modern: "https://...",
      classic: null
    },
    artistNote: ""
  }]
}

// Cart Line Item - After pet-selector (FUTURE)
{
  petSessionKey: "pet_123_abc",
  petName: "Riley",
  selectedEffect: "modern", // Customer's choice
  gcsUrl: "https://storage.googleapis.com/.../riley_modern.jpg", // ONLY selected
  artistNote: ""
}
```

---

## Implementation Steps

### Phase 1: Storage Manager Updates (2-3 hours)

#### Step 1.1: Update StorageManager Schema
**File**: `assets/storage-manager.js`

**Current save() method** (lines 77-126):
```javascript
// BEFORE
save(sessionKey, data) {
  const storageData = {
    petId: sessionKey,
    name: data.name || 'My Pet',
    thumbnail: compressedThumb,
    effect: data.effect || 'color',
    gcsUrl: data.gcsUrl || null, // Single URL
    artistNote: data.artistNote || '',
    timestamp: data.timestamp || Date.now()
  };
}
```

**Updated save() method**:
```javascript
// AFTER
save(sessionKey, data) {
  // Get existing data to preserve previously uploaded URLs
  const existing = this.get(sessionKey);

  const storageData = {
    petId: sessionKey,
    name: data.name || 'My Pet',
    thumbnail: compressedThumb,
    currentEffect: data.currentEffect || data.effect || 'color', // Renamed field
    gcsUrls: data.gcsUrls || existing?.gcsUrls || {}, // Multi-URL object
    artistNote: data.artistNote || '',
    timestamp: data.timestamp || Date.now()
  };
}
```

#### Step 1.2: Update getPetsForCart() Method
**File**: `assets/storage-manager.js` (lines 204-230)

```javascript
// BEFORE
getPetsForCart() {
  return pets.map(pet => ({
    sessionKey: pet.petId,
    petName: pet.name,
    gcsUrl: pet.gcsUrl || '', // Single URL
    artistNote: pet.artistNote || ''
  }));
}

// AFTER
getPetsForCart() {
  return pets.map(pet => ({
    sessionKey: pet.petId,
    petName: pet.name,
    currentEffect: pet.currentEffect || 'color',
    gcsUrls: pet.gcsUrls || {}, // All URLs
    artistNote: pet.artistNote || ''
  }));
}
```

#### Step 1.3: Add URL Update Helper Method
**File**: `assets/storage-manager.js`

Add new method after save():
```javascript
/**
 * Updates a single GCS URL for a pet without overwriting other URLs
 * @param {string} sessionKey - Pet session ID
 * @param {string} effectName - Effect name (color, enhancedblackwhite, modern, classic)
 * @param {string} gcsUrl - GCS URL for the effect
 */
updateEffectUrl(sessionKey, effectName, gcsUrl) {
  const pet = this.get(sessionKey);
  if (!pet) {
    console.warn(`StorageManager: Pet ${sessionKey} not found`);
    return false;
  }

  // Initialize gcsUrls if missing
  if (!pet.gcsUrls) {
    pet.gcsUrls = {};
  }

  // Update specific effect URL
  pet.gcsUrls[effectName] = gcsUrl;

  // Save back to storage
  return this.save(sessionKey, pet);
}
```

---

### Phase 2: Upload Strategy Implementation (3-4 hours)

#### Step 2.1: Modify uploadToStorage() for Effect Names
**File**: `assets/effects-v2-loader.js` (lines 351-380)

```javascript
// BEFORE
async function uploadToStorage(blob, sessionKey) {
  const formData = new FormData();
  formData.append('file', blob, `${sessionKey}.jpg`);
  formData.append('session_key', sessionKey);
  // ...
}

// AFTER - Add effect name parameter
async function uploadToStorage(blob, sessionKey, effectName = 'color') {
  const formData = new FormData();
  // Include effect name in filename for clarity
  formData.append('file', blob, `${sessionKey}_${effectName}.jpg`);
  formData.append('session_key', sessionKey);
  formData.append('effect_name', effectName); // Optional metadata

  try {
    const storageUrl = container.getAttribute('data-storage-url') ||
                       'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';

    const response = await fetch(`${storageUrl}/store-image`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Uploaded ${effectName} to GCS:`, result.url);
      return result.url;
    }
  } catch (error) {
    console.warn(`⚠️ Failed to upload ${effectName} to storage:`, error);
    return null;
  }
}
```

#### Step 2.2: Implement Parallel Upload for Initial Effects
**File**: `assets/effects-v2-loader.js` (handleFileUpload method)

```javascript
// AFTER InSPyReNet processing (line ~330)
async function handleFileUpload(file) {
  // ... existing processing ...

  // Convert base64 to data URLs
  effects.color = `data:image/png;base64,${data.processed_image}`;
  effects.enhancedblackwhite = `data:image/png;base64,${data.effects.enhancedblackwhite}`;

  // NEW: Parallel upload of Color + B&W to GCS
  showProgress(60, 'Uploading to cloud...', 'Saving your effects (1/2)');

  const uploadPromises = [];

  // Upload Color effect
  const colorBlob = await fetch(effects.color).then(r => r.blob());
  uploadPromises.push(uploadToStorage(colorBlob, sessionKey, 'color'));

  // Upload B&W effect
  const bwBlob = await fetch(effects.enhancedblackwhite).then(r => r.blob());
  uploadPromises.push(uploadToStorage(bwBlob, sessionKey, 'enhancedblackwhite'));

  // Wait for both uploads
  const [colorUrl, bwUrl] = await Promise.all(uploadPromises);

  showProgress(75, 'Saving...', 'Almost done!');

  // Initialize gcsUrls object
  const gcsUrls = {
    color: colorUrl,
    enhancedblackwhite: bwUrl,
    modern: null,
    classic: null
  };

  // Save to localStorage with multiple URLs
  await storageManager.save(sessionKey, {
    name: file.name.replace(/\.[^/.]+$/, ''),
    filename: file.name,
    thumbnail: effects.color, // Compressed by StorageManager
    currentEffect: 'color',
    gcsUrls: gcsUrls, // NEW: Multiple URLs
    timestamp: Date.now()
  });

  // Store effects in container for switching
  container.dataset.sessionKey = sessionKey;
  container.dataset.currentEffect = 'color';
  container.dataset.effects = JSON.stringify(effects);
  container.dataset.gcsUrls = JSON.stringify(gcsUrls); // NEW: Track URLs

  showProgress(100, 'Complete!', 'Your image is ready');
  showResult(effects);
}
```

#### Step 2.3: Update Gemini Effect Generation
**File**: `assets/effects-v2-loader.js` (generateGeminiEffect method)

```javascript
async function generateGeminiEffect(effectName) {
  // ... existing Gemini generation code ...

  // After successful generation (line ~520)
  if (styledBlob) {
    // Store styled blob as object URL
    const objectUrl = URL.createObjectURL(styledBlob);
    effects[effectName] = objectUrl;

    // NEW: Upload to GCS immediately
    try {
      const gcsUrl = await uploadToStorage(styledBlob, sessionKey, effectName);

      if (gcsUrl) {
        // Update localStorage with new GCS URL
        storageManager.updateEffectUrl(sessionKey, effectName, gcsUrl);

        // Update container dataset
        const gcsUrls = JSON.parse(container.dataset.gcsUrls || '{}');
        gcsUrls[effectName] = gcsUrl;
        container.dataset.gcsUrls = JSON.stringify(gcsUrls);

        console.log(`✅ ${effectName} uploaded to GCS:`, gcsUrl);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to upload ${effectName} to GCS:`, error);
      // Continue anyway - effect still works locally
    }

    // Switch to new effect
    switchToEffect(effectName);
  }
}
```

---

### Phase 3: Progress Feedback Updates (1 hour)

#### Step 3.1: Enhanced Progress Messages
**File**: `assets/effects-v2-loader.js`

```javascript
// For initial upload (Color + B&W)
function showUploadProgress(current, total) {
  const percent = 60 + (15 * current / total); // 60-75% range
  showProgress(
    percent,
    'Uploading to cloud...',
    `Saving effect ${current} of ${total}`
  );
}

// For Gemini effects
function showGeminiUploadProgress(effectName) {
  showProgress(
    90,
    `Uploading ${effectName}...`,
    'Saving to cloud'
  );
}
```

#### Step 3.2: Add Upload Status Indicators
```javascript
// Visual feedback for upload status
function updateEffectButton(effectName, status) {
  const button = document.querySelector(`[data-effect="${effectName}"]`);
  if (!button) return;

  switch(status) {
    case 'uploading':
      button.innerHTML = `${button.textContent} ⏫`;
      break;
    case 'uploaded':
      button.innerHTML = `${button.textContent} ☁️`;
      break;
    case 'failed':
      button.innerHTML = `${button.textContent} ⚠️`;
      break;
  }
}
```

---

### Phase 4: Testing & Validation (2-3 hours)

#### Test Cases

1. **Initial Upload Flow**:
   - Upload 5MB image
   - Verify Color + B&W both upload to GCS
   - Check localStorage has both URLs
   - Verify effects work without network

2. **Gemini Generation Flow**:
   - Click Modern button
   - Verify Modern uploads to GCS
   - Check localStorage updated with Modern URL
   - Click Classic button
   - Verify Classic uploads to GCS
   - Check localStorage has all 4 URLs

3. **Partial Upload Handling**:
   - Simulate Color upload success, B&W failure
   - Verify Color URL saved, B&W null
   - Verify app continues functioning

4. **Storage Inspection**:
   ```javascript
   // Check localStorage structure
   const pet = storageManager.get('pet_123_abc');
   console.log('GCS URLs:', pet.gcsUrls);
   // Should show: {color: "https://...", enhancedblackwhite: "https://...", ...}

   // Check window.perkiePets
   console.log('Cart data:', window.perkiePets);
   // Should include gcsUrls object
   ```

5. **Network Failure Resilience**:
   - Disconnect network after processing
   - Verify effects still switch locally
   - Reconnect and verify upload retry

---

## GCS Naming Convention

**Pattern**: `{sessionKey}_{effectName}.jpg`

**Examples**:
```
pet_1698765432_abc123_color.jpg
pet_1698765432_abc123_bw.jpg
pet_1698765432_abc123_modern.jpg
pet_1698765432_abc123_classic.jpg
```

**Benefits**:
- Clear effect identification
- Easy debugging in GCS console
- Prevents overwrites
- Supports future effect additions

---

## Error Handling Strategy

### Upload Failures

**Approach**: Best-effort with graceful degradation

```javascript
// Upload failure handling
async function handleUploadWithFallback(blob, sessionKey, effectName) {
  try {
    const url = await uploadToStorage(blob, sessionKey, effectName);
    if (url) {
      storageManager.updateEffectUrl(sessionKey, effectName, url);
      return url;
    }
  } catch (error) {
    console.warn(`Upload failed for ${effectName}:`, error);
  }

  // Store null for failed uploads
  storageManager.updateEffectUrl(sessionKey, effectName, null);

  // Show warning but don't block
  showToast(`⚠️ Cloud save failed for ${effectName}. Effect saved locally.`, 'warning');

  return null;
}
```

### Partial Upload Success

**Strategy**: Save what succeeds, mark failures as null

```javascript
// Example: Color uploads, B&W fails
{
  gcsUrls: {
    color: "https://storage.googleapis.com/.../color.jpg",
    enhancedblackwhite: null, // Failed upload
    modern: null, // Not generated yet
    classic: null
  }
}
```

**Future pet-selector handling**:
- Show all effects with URLs
- Gray out effects without URLs
- Offer retry upload option

---

## Migration & Backwards Compatibility

### Handling Existing Pets

**Migration strategy for pets with single gcsUrl**:

```javascript
// In StorageManager.get() method
get(sessionKey) {
  const pet = /* ... existing retrieval ... */;

  // Migrate old format to new
  if (pet && pet.gcsUrl && !pet.gcsUrls) {
    pet.gcsUrls = {
      [pet.effect || 'color']: pet.gcsUrl,
      color: null,
      enhancedblackwhite: null,
      modern: null,
      classic: null
    };
    delete pet.gcsUrl; // Remove old field

    // Rename effect to currentEffect
    pet.currentEffect = pet.effect || 'color';
    delete pet.effect;

    // Save migrated format
    this.save(sessionKey, pet);
  }

  return pet;
}
```

### Cart Compatibility

**Temporary dual support**:
```javascript
// getPetsForCart() - Support both formats during transition
getPetsForCart() {
  return pets.map(pet => ({
    sessionKey: pet.petId,
    petName: pet.name,
    currentEffect: pet.currentEffect || pet.effect || 'color',
    gcsUrl: pet.gcsUrl || pet.gcsUrls?.[pet.currentEffect], // Fallback
    gcsUrls: pet.gcsUrls || { [pet.effect || 'color']: pet.gcsUrl }, // Both formats
    artistNote: pet.artistNote || ''
  }));
}
```

---

## Performance Considerations

### Storage Impact

**Per Pet Storage**:
- Thumbnail: ~40KB (compressed)
- Pet data: ~600 bytes (4 URLs + metadata)
- **Total**: ~41KB per pet
- **Capacity**: ~120 pets (5MB quota)

**Comparison**:
- Old: ~40.2KB per pet (single URL)
- New: ~40.6KB per pet (4 URLs)
- **Impact**: +1% storage increase (negligible)

### Network Impact

**Upload Volume**:
- Initial: 2 uploads (Color + B&W) - parallel
- Gemini: 1-2 uploads (on-demand)
- **Total**: 2-4 uploads per session

**Bandwidth**:
- Per upload: ~500KB-2MB (after processing)
- Total session: 2-8MB upload
- **Mobile consideration**: Acceptable for 4G/5G

### Processing Time

**Parallel Upload Strategy**:
```javascript
// Upload both initial effects simultaneously
const [colorUrl, bwUrl] = await Promise.all([
  uploadToStorage(colorBlob, sessionKey, 'color'),
  uploadToStorage(bwBlob, sessionKey, 'enhancedblackwhite')
]);
// Time: ~2-3 seconds (vs 4-6 sequential)
```

---

## Future Pet-Selector Integration Points

### Data Available for Pet-Selector

```javascript
// What pet-selector will receive
window.perkiePets = {
  pets: [{
    sessionKey: "pet_123_abc",
    petName: "Riley",
    currentEffect: "modern",
    gcsUrls: {
      color: "https://...",
      enhancedblackwhite: "https://...",
      modern: "https://...",
      classic: null
    },
    artistNote: ""
  }]
};
```

### Pet-Selector Requirements

1. **Effect Preview Grid**:
   - Show thumbnails of all available effects
   - Highlight effects with GCS URLs
   - Gray out unavailable effects

2. **Selection Logic**:
   ```javascript
   // Pet-selector will call
   function selectEffectForProduct(sessionKey, effectName) {
     const pet = perkiePets.find(p => p.sessionKey === sessionKey);
     const gcsUrl = pet.gcsUrls[effectName];

     if (!gcsUrl) {
       showError('This effect needs to be generated first');
       return;
     }

     // Add to cart with specific effect
     addToCart({
       petSessionKey: sessionKey,
       petName: pet.petName,
       selectedEffect: effectName,
       gcsUrl: gcsUrl, // Only the selected URL
       artistNote: pet.artistNote
     });
   }
   ```

3. **Regeneration Option**:
   - For effects without URLs
   - Trigger Effects V2 to generate missing effects

---

## Success Metrics

### Technical Metrics
- ✅ All 4 effects uploadable to GCS
- ✅ Multiple URLs stored per pet
- ✅ Backwards compatibility maintained
- ✅ Upload failures handled gracefully
- ✅ Storage increase < 2%

### Business Metrics (Post-Implementation)
- [ ] Pet-selector integration ready
- [ ] Effect selection at cart functional
- [ ] Order data includes selected effect
- [ ] Employee visibility of effect choice

### Performance Targets
- Upload time: < 3s per effect (parallel)
- Storage per pet: < 50KB
- Success rate: > 95% for uploads
- Local functionality: 100% without network

---

## Risk Mitigation

### Risk 1: GCS Rate Limiting
**Mitigation**: Queue uploads, implement exponential backoff

### Risk 2: Storage Quota Exceeded
**Mitigation**: Already fixed - effects not stored, only URLs

### Risk 3: Network Failures
**Mitigation**: Best-effort uploads, local functionality preserved

### Risk 4: Backwards Compatibility
**Mitigation**: Migration logic for old format, dual support period

---

## Implementation Timeline

### Day 1 (4-5 hours)
- [ ] Phase 1: Storage Manager updates (2-3 hours)
- [ ] Phase 2.1: Upload function updates (1 hour)
- [ ] Phase 2.2: Initial effects parallel upload (1 hour)

### Day 2 (3-4 hours)
- [ ] Phase 2.3: Gemini upload integration (1-2 hours)
- [ ] Phase 3: Progress feedback (1 hour)
- [ ] Phase 4: Testing & validation (1-2 hours)

### Total Effort: 7-9 hours

---

## Questions Resolved

1. **Partial uploads**: Save successful URLs, mark failures as null
2. **Effect names**: Confirmed (color, enhancedblackwhite, modern, classic)
3. **Artist notes**: Per pet (all effects share same note)

---

## Deployment Checklist

### Pre-Deployment
- [ ] Review code changes with team
- [ ] Test on staging environment
- [ ] Verify GCS bucket permissions
- [ ] Check upload endpoint availability

### Testing
- [ ] Upload 10 test pets
- [ ] Generate all 4 effects for 3 pets
- [ ] Verify localStorage structure
- [ ] Check GCS bucket for files
- [ ] Test network failure scenarios

### Post-Deployment
- [ ] Monitor upload success rate
- [ ] Check GCS bandwidth usage
- [ ] Verify storage growth rate
- [ ] Gather user feedback

---

## Appendix: Code Examples

### Complete Upload Flow
```javascript
// Full implementation example
async function processAndUploadAllEffects(file, sessionKey) {
  // 1. Process with InSPyReNet
  const response = await processWithInspyrenet(file);
  const effects = {
    color: response.color,
    enhancedblackwhite: response.blackwhite
  };

  // 2. Upload initial effects
  const uploadResults = await Promise.all([
    uploadToStorage(effects.color, sessionKey, 'color'),
    uploadToStorage(effects.enhancedblackwhite, sessionKey, 'enhancedblackwhite')
  ]);

  // 3. Save to localStorage
  const gcsUrls = {
    color: uploadResults[0],
    enhancedblackwhite: uploadResults[1],
    modern: null,
    classic: null
  };

  storageManager.save(sessionKey, {
    name: file.name,
    thumbnail: effects.color,
    currentEffect: 'color',
    gcsUrls: gcsUrls,
    timestamp: Date.now()
  });

  // 4. On-demand Gemini generation
  async function generateArtisticStyle(style) {
    const styledImage = await geminiClient.applyStyle(effects.color, style);
    const gcsUrl = await uploadToStorage(styledImage, sessionKey, style);
    storageManager.updateEffectUrl(sessionKey, style, gcsUrl);
    return gcsUrl;
  }

  return { effects, gcsUrls, generateArtisticStyle };
}
```

---

## Next Steps

1. **Immediate**: Implement Phase 1-2 (Storage + Upload changes)
2. **Day 2**: Complete Phase 3-4 (UI feedback + Testing)
3. **Future**: Design pet-selector component with effect grid
4. **Later**: Implement cart integration with selected effects

---

## Success Criteria

✅ **Ready for Implementation** when:
1. All GCS URLs properly stored in localStorage
2. Backwards compatibility maintained
3. Upload failures handled gracefully
4. Testing shows 95%+ success rate
5. Pet-selector has all needed data

---

**Document Version**: 1.0
**Last Updated**: 2025-10-28
**Status**: APPROVED FOR IMPLEMENTATION