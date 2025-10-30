# Order Custom Properties Missing Data - Root Cause Analysis & Implementation Plan

**Session ID**: 1736096953
**Date**: 2025-01-05
**Status**: Ready for Implementation
**Priority**: CRITICAL - Blocks Order Fulfillment

---

## Executive Summary

Test order revealed **critical data missing** from custom properties that employees need for fulfillment. GCS URLs and artist notes are not being populated, causing orders to contain only compressed localStorage thumbnails instead of production-ready image URLs.

**Impact**: Orders cannot be fulfilled without full-resolution image URLs and special instructions.

---

## Problem Statement

### What's Missing in Orders:
1. **`_original_image_url`** - Empty (should contain GCS URL)
2. **`_processed_image_url`** - Contains compressed base64 thumbnail (~20KB) instead of GCS URL
3. **`_artist_notes`** - Empty (should contain user-provided notes)

### What Should Be Sent:
```
_original_image_url: https://storage.googleapis.com/perkieprints-customer-images/...
_processed_image_url: https://storage.googleapis.com/perkieprints-customer-images/...
_artist_notes: [user-provided text from pet processor]
```

### Current (Broken) State:
```
_original_image_url:                    ❌ EMPTY
_processed_image_url: data:image/jpeg;base64,/9j/4AAQ... ❌ COMPRESSED THUMBNAIL
_pet_name: Nigel,milo & Mika            ✅ OK
_effect_applied: enhancedblackwhite     ✅ OK
_artist_notes:                          ❌ EMPTY
_has_custom_pet: true                   ✅ OK
_font_style: classic                    ✅ OK
```

---

## Root Cause Analysis

### Investigation Results

After systematic code review, I identified **THREE separate but related root causes**:

### ROOT CAUSE #1: GCS URLs Are Never Generated (CRITICAL)
**Location**: `assets/pet-processor.js` lines 641, 964, 984

**Problem**:
- GCS URL field exists in data structure but is **ALWAYS empty string**
- No code actually uploads images to Google Cloud Storage
- Comment says "Will be set when uploading to GCS if needed" but upload never happens

**Evidence**:
```javascript
// Line 641 - Effect data structure initialization
effects[effectName] = {
  gcsUrl: '', // Will be set when uploading to GCS if needed  ❌ NEVER SET
  dataUrl: dataUrl
};

// Line 964 - Pet data saved to PetStorage
const petData = {
  name: petName,
  artistNote: artistNote,
  filename: this.currentPet.filename,
  effect: selectedEffect,
  thumbnail: effectData.dataUrl,
  gcsUrl: effectData.gcsUrl || ''  // ❌ Always empty - no upload happens
};

// Line 984 - Event dispatched with empty gcsUrl
document.dispatchEvent(new CustomEvent('petProcessorComplete', {
  detail: {
    sessionKey: this.currentPet.id,
    gcsUrl: effectData.gcsUrl,  // ❌ Empty
    originalUrl: this.currentPet.originalUrl || null,  // ❌ Also empty
    effect: selectedEffect,
    name: petName,
    artistNote: artistNote  // ⚠️ This is correct, but never reaches cart
  }
}));
```

**Impact**: Without GCS URLs, images cannot be accessed for fulfillment.

---

### ROOT CAUSE #2: buy-buttons.liquid Relies on Non-Existent syncSelectedToCloud Function
**Location**: `snippets/buy-buttons.liquid` lines 217-233

**Problem**:
- Code expects `processor.syncSelectedToCloud()` method to exist
- **This method does NOT exist** in `pet-processor.js`
- Function call silently fails, leaving URL fields empty

**Evidence**:
```javascript
// Lines 221-232 in buy-buttons.liquid
const processor = window.petProcessor || window.PetProcessorV5Instance;
if (processor && processor.syncSelectedToCloud) {  // ❌ Method doesn't exist
  processor.syncSelectedToCloud(primaryEffect, function(urls) {
    if (urls) {
      // Store cloud URLs directly in order properties
      document.getElementById(`original-url-${sectionId}`).value = urls.original || '';
      document.getElementById(`processed-url-${sectionId}`).value = urls.processed || '';
      console.log('✅ Cloud URLs saved to order properties');
    } else {
      console.warn('⚠️ Cloud upload failed, images will remain in localStorage only');
    }
  });
}
```

**Grep Verification**:
```bash
# Searched entire assets/ directory for syncSelectedToCloud
grep -r "syncSelectedToCloud" assets/
# Result: NO MATCHES FOUND
```

**Impact**: URL fields remain empty because expected function doesn't exist.

---

### ROOT CAUSE #3: Artist Notes Not Passed From pet:selected Event
**Location**: `snippets/ks-product-pet-selector.liquid` lines 2775-2784

**Problem**:
- `pet:selected` event payload does NOT include `artistNote` field
- Artist notes exist in PetStorage metadata but aren't included in event
- `cart-pet-integration.js` never receives artist notes to populate form field

**Evidence**:
```javascript
// Lines 2775-2784 - pet:selected event payload
var petDataForCart = selectedPetsData.length > 0 ? {
  name: selectedPetsData.map(function(pet) { return pet.name; }).join(','),
  processedImage: selectedPetsData[0].processedImage,
  effect: selectedPetsData[0].effect,
  originalImage: selectedPetsData[0].originalImage,
  // ❌ NO artistNote field here!
  // ❌ NO originalUrl field here!
  pets: selectedPetsData,
  totalFee: selectedPetsData.length > 1 ? (selectedPetsData.length === 2 ? 5 : 10) : 0
} : null;
```

**Artist Notes ARE Captured Earlier**:
```javascript
// pet-processor.js line 960 - Notes ARE saved to PetStorage
const petData = {
  name: petName,
  artistNote: artistNote,  // ✅ Saved correctly
  filename: this.currentPet.filename,
  effect: selectedEffect,
  thumbnail: effectData.dataUrl,
  gcsUrl: effectData.gcsUrl || ''
};
```

**Impact**: Artist notes never reach cart form fields, leaving `_artist_notes` empty in order.

---

## Data Flow Diagram

### Current (Broken) Flow:
```
1. User uploads pet → pet-processor.js
   ├─ Saves to PetStorage: { artistNote: "notes", gcsUrl: "" }  ❌ Empty gcsUrl
   └─ Dispatches: petProcessorComplete { gcsUrl: "", artistNote: "notes" }

2. User navigates to product page → ks-product-pet-selector.liquid
   ├─ Loads pet from PetStorage
   ├─ User selects pet
   └─ Dispatches: pet:selected { name, processedImage, effect }  ❌ NO artistNote, NO URLs

3. Cart integration listens → cart-pet-integration.js
   ├─ Receives: { name, processedImage, effect }  ❌ Missing fields
   └─ Populates form fields:
       • _pet_name ✅
       • _effect_applied ✅
       • _processed_image_url = compressImageUrl(processedImage)  ❌ Compressed thumbnail
       • _original_image_url = ???  ❌ Not in event payload
       • _artist_notes = ???  ❌ Not in event payload

4. buy-buttons.liquid attempts cloud upload → FAILS
   ├─ Calls: processor.syncSelectedToCloud()  ❌ Method doesn't exist
   └─ URL fields remain empty

5. Order submitted with:
   ├─ _processed_image_url: base64 thumbnail  ❌ Wrong
   ├─ _original_image_url: empty  ❌ Wrong
   └─ _artist_notes: empty  ❌ Wrong
```

---

## Implementation Plan

### PHASE 1: Add GCS Upload Functionality (CRITICAL - 4-6 hours)

**File**: `assets/pet-processor.js`

#### Task 1.1: Create Cloud Upload Method
```javascript
/**
 * Upload images to Google Cloud Storage
 * @param {string} sessionKey - Pet session identifier
 * @param {string} effect - Effect name (e.g., 'enhancedblackwhite')
 * @param {Function} callback - Called with {original: url, processed: url}
 */
async syncSelectedToCloud(sessionKey, effect, callback) {
  try {
    const pet = this.processedPets.find(p => p.id === sessionKey);
    if (!pet) {
      console.error('❌ Pet not found:', sessionKey);
      callback(null);
      return;
    }

    const effectData = pet.effects[effect];
    if (!effectData || !effectData.dataUrl) {
      console.error('❌ Effect data not found:', effect);
      callback(null);
      return;
    }

    // Upload processed image
    const processedUrl = await this.uploadToGCS(effectData.dataUrl, sessionKey, effect);

    // Upload original if exists
    let originalUrl = null;
    if (pet.originalDataUrl) {
      originalUrl = await this.uploadToGCS(pet.originalDataUrl, sessionKey, 'original');
    }

    // Update gcsUrl in pet data
    effectData.gcsUrl = processedUrl;
    pet.originalUrl = originalUrl;

    // Update PetStorage
    await PetStorage.save(sessionKey, {
      name: pet.name,
      artistNote: pet.artistNote || '',
      filename: pet.filename,
      effect: effect,
      thumbnail: effectData.dataUrl,
      gcsUrl: processedUrl,
      originalUrl: originalUrl
    });

    // Return URLs
    callback({
      original: originalUrl,
      processed: processedUrl
    });

  } catch (error) {
    console.error('❌ Cloud upload failed:', error);
    callback(null);
  }
}

/**
 * Upload single image to GCS
 * @param {string} dataUrl - Base64 data URL
 * @param {string} sessionKey - Pet identifier
 * @param {string} effectName - Effect name
 * @returns {Promise<string>} GCS URL
 */
async uploadToGCS(dataUrl, sessionKey, effectName) {
  // Convert dataUrl to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Generate filename
  const timestamp = Date.now();
  const filename = `${sessionKey}_${effectName}_${timestamp}.png`;

  // Create form data
  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('sessionKey', sessionKey);
  formData.append('effect', effectName);

  // Upload to backend endpoint (needs to be created)
  const uploadResponse = await fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/upload-to-gcs', {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status}`);
  }

  const result = await uploadResponse.json();
  return result.url;  // GCS public URL
}
```

**Implementation Notes**:
- Add methods to PetProcessorV5 class
- Expose on window.petProcessor and window.PetProcessorV5Instance
- Handle errors gracefully with fallbacks
- Log upload progress for debugging

---

### PHASE 2: Create Backend GCS Upload Endpoint (3-4 hours)

**File**: `backend/inspirenet-api/src/api_v2_endpoints.py`

#### Task 2.1: Add GCS Upload Route
```python
@app.post("/api/v2/upload-to-gcs")
async def upload_to_gcs(
    file: UploadFile = File(...),
    sessionKey: str = Form(...),
    effect: str = Form(...)
):
    """
    Upload processed image to Google Cloud Storage
    Returns public URL for order fulfillment
    """
    try:
        # Generate unique filename
        timestamp = int(time.time())
        filename = f"{sessionKey}_{effect}_{timestamp}.png"
        blob_name = f"customer-images/{filename}"

        # Read file content
        contents = await file.read()

        # Upload to GCS bucket
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(
            contents,
            content_type="image/png"
        )

        # Make publicly accessible
        blob.make_public()

        # Return public URL
        public_url = blob.public_url

        logger.info(f"✅ Uploaded to GCS: {public_url}")

        return {
            "success": True,
            "url": public_url,
            "filename": filename,
            "blob_name": blob_name
        }

    except Exception as e:
        logger.error(f"❌ GCS upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Implementation Notes**:
- Use existing GCS client from API
- Set 90-day lifecycle policy (align with existing cache)
- Add CORS configuration for Shopify domain
- Include error handling for quota/permission issues
- Test with staging bucket first

---

### PHASE 3: Fix pet:selected Event Payload (1 hour)

**File**: `snippets/ks-product-pet-selector.liquid`

#### Task 3.1: Add Missing Fields to Event (Lines 2775-2784)
```javascript
// Get metadata for first selected pet
var firstPetMetadata = window.PetStorage ?
  window.PetStorage.getMetadata(selectedPetsData[0].sessionKey) : null;

var petDataForCart = selectedPetsData.length > 0 ? {
  // Existing fields
  name: selectedPetsData.map(function(pet) { return pet.name; }).join(','),
  processedImage: selectedPetsData[0].processedImage,
  effect: selectedPetsData[0].effect,
  originalImage: selectedPetsData[0].originalImage,

  // NEW: Add missing fields from PetStorage metadata
  artistNote: firstPetMetadata ? firstPetMetadata.artistNote : '',
  originalUrl: firstPetMetadata ? firstPetMetadata.originalUrl : '',
  gcsUrl: firstPetMetadata ? firstPetMetadata.gcsUrl : '',
  sessionKey: selectedPetsData[0].sessionKey,

  // Multi-pet support
  pets: selectedPetsData,
  totalFee: selectedPetsData.length > 1 ? (selectedPetsData.length === 2 ? 5 : 10) : 0
} : null;
```

**Implementation Notes**:
- Read metadata from PetStorage.getMetadata()
- Include sessionKey for cloud upload
- Maintain backward compatibility with existing fields

---

### PHASE 4: Update Cart Integration to Handle New Fields (1-2 hours)

**File**: `assets/cart-pet-integration.js`

#### Task 4.1: Add Artist Notes Field Population (After line 141)
```javascript
// Create or update artist notes field (NEW)
var artistNotesField = form.querySelector('[name="properties[_artist_notes]"]');
if (!artistNotesField) {
  artistNotesField = document.createElement('input');
  artistNotesField.type = 'hidden';
  artistNotesField.name = 'properties[_artist_notes]';
  artistNotesField.id = 'artist-notes-' + sectionId;
  form.appendChild(artistNotesField);
}
if (petData.artistNote) {
  artistNotesField.value = petData.artistNote;
}

// Update original URL field to use GCS URL (NEW)
if (originalUrlField && petData.originalUrl) {
  originalUrlField.value = petData.originalUrl;  // Use GCS URL, not compressed
}

// CRITICAL FIX: Store GCS URL instead of compressed thumbnail
if (processedUrlField && petData.gcsUrl) {
  processedUrlField.value = petData.gcsUrl;  // Use GCS URL
} else if (processedUrlField && petData.processedImage) {
  // Fallback to processedImage if GCS not available yet
  processedUrlField.value = petData.processedImage;
}
```

**Implementation Notes**:
- Prioritize GCS URLs over base64 thumbnails
- Add fallback for cases where GCS upload hasn't completed
- Validate URLs before setting (check for "https://storage.googleapis.com")

---

### PHASE 5: Update buy-buttons.liquid Integration (1 hour)

**File**: `snippets/buy-buttons.liquid`

#### Task 5.1: Fix Cloud Upload Trigger (Lines 217-233)
```javascript
// Get pet processor instance
const processor = window.petProcessor || window.PetProcessorV5Instance;

// Check if we need to upload to cloud
const needsUpload = !metadata || !metadata.gcsUrl || !metadata.originalUrl;

if (processor && processor.syncSelectedToCloud && needsUpload) {
  console.log('📤 Uploading images to cloud storage...');

  processor.syncSelectedToCloud(sessionKey, primaryEffect, function(urls) {
    if (urls) {
      // Store cloud URLs directly in order properties
      document.getElementById(`original-url-${sectionId}`).value = urls.original || '';
      document.getElementById(`processed-url-${sectionId}`).value = urls.processed || '';
      console.log('✅ Cloud URLs saved to order properties:', urls);
    } else {
      console.warn('⚠️ Cloud upload failed, using cached URLs if available');

      // Fallback: Try to use cached URLs from PetStorage
      if (metadata && metadata.gcsUrl) {
        document.getElementById(`processed-url-${sectionId}`).value = metadata.gcsUrl;
      }
      if (metadata && metadata.originalUrl) {
        document.getElementById(`original-url-${sectionId}`).value = metadata.originalUrl;
      }
    }
  });
} else if (metadata && metadata.gcsUrl) {
  // URLs already exist in metadata, use them directly
  console.log('✅ Using cached GCS URLs from metadata');
  document.getElementById(`original-url-${sectionId}`).value = metadata.originalUrl || '';
  document.getElementById(`processed-url-${sectionId}`).value = metadata.gcsUrl || '';
}
```

**Implementation Notes**:
- Check if URLs already exist before uploading
- Add multi-level fallbacks (cloud → cached → base64)
- Log all steps for debugging

---

### PHASE 6: Update PetStorage Schema (30 minutes)

**File**: `assets/pet-storage.js`

#### Task 6.1: Add Missing Fields to Storage Schema (Line 67)
```javascript
const storageData = {
  petId,
  name: data.name || 'Pet',
  filename: data.filename || '',
  thumbnail: compressedThumbnail,
  gcsUrl: data.gcsUrl || '',
  originalUrl: data.originalUrl || '',  // NEW
  artistNote: data.artistNote || '',    // NEW (was missing)
  effect: data.effect || 'original',
  timestamp: Date.now()
};
```

#### Task 6.2: Update getMetadata Method (Line 264)
```javascript
static getMetadata(sessionKey) {
  const pet = this.get(sessionKey);
  if (!pet) return null;

  return {
    sessionKey: sessionKey,
    name: pet.name || pet.petName || 'Pet',
    effect: pet.effect || 'enhancedblackwhite',
    artistNote: pet.artistNote || '',
    filename: pet.filename || 'pet.jpg',
    timestamp: pet.timestamp || Date.now(),
    gcsUrl: pet.gcsUrl || '',
    originalUrl: pet.originalUrl || ''  // NEW
  };
}
```

---

## Testing Plan

### Pre-Deployment Validation

#### Test 1: GCS Upload Functionality
```javascript
// Test in browser console after deployment
const processor = window.petProcessor;
processor.syncSelectedToCloud('test_pet_123', 'enhancedblackwhite', (urls) => {
  console.log('URLs:', urls);
  // Expected: { original: "https://storage.googleapis.com/...", processed: "https://..." }
});
```

#### Test 2: End-to-End Order Flow
1. Upload pet with artist notes: "Make eyes brighter"
2. Select effect: enhancedblackwhite
3. Save and navigate to product page
4. Select pet
5. Add to cart
6. Complete checkout
7. **Verify order properties**:
   - `_original_image_url`: https://storage.googleapis.com/... ✅
   - `_processed_image_url`: https://storage.googleapis.com/... ✅
   - `_artist_notes`: "Make eyes brighter" ✅

#### Test 3: Fallback Scenarios
- Test with API offline (should use cached URLs)
- Test with no GCS URLs (should still save order with base64 fallback)
- Test without artist notes (should handle empty gracefully)

#### Test 4: Multi-Pet Orders
- Test with 2 pets (verify first pet's URLs are used)
- Test with 3 pets (verify first pet's URLs are used)
- Verify all pet names appear in `_pet_name` field

---

## Deployment Strategy

### Recommended Order:

1. **Backend First** (PHASE 2)
   - Deploy GCS upload endpoint to API
   - Test with Postman/curl
   - Verify bucket permissions and CORS

2. **Frontend Updates** (PHASES 1, 3, 4, 5, 6)
   - Update all frontend files in single commit
   - Deploy to staging via git push
   - Test complete flow on staging URL

3. **Validation** (Testing Plan)
   - Run all test scenarios
   - Verify order properties in Shopify admin
   - Check GCS bucket for uploaded images

4. **Production Deployment**
   - Merge staging → main
   - Monitor first few orders closely
   - Verify fulfillment team can access images

---

## Risks & Mitigations

### Risk 1: GCS Upload Failures
**Mitigation**: Implement fallback to save order with base64 URLs if GCS fails

### Risk 2: API Costs
**Mitigation**:
- Set lifecycle policy (90 days)
- Monitor bucket size
- Estimate: ~50KB/image × 100 orders/day = 5MB/day = 150MB/month (~$0.02/month storage)

### Risk 3: Cold Start Delays
**Mitigation**:
- Upload happens async, doesn't block cart
- Use cached URLs if upload is slow
- Show loading indicator during upload

### Risk 4: CORS Issues
**Mitigation**:
- Add Shopify domain to bucket CORS config
- Test from staging URL before production

---

## Success Criteria

✅ All order custom properties populated correctly:
- `_original_image_url`: GCS URL
- `_processed_image_url`: GCS URL
- `_artist_notes`: User-provided text

✅ Images accessible to fulfillment team via GCS URLs

✅ Fallback mechanism works if GCS upload fails

✅ No increase in cart abandonment rate

✅ Storage costs < $5/month

---

## Files Modified

### Frontend
1. `assets/pet-processor.js` - Add syncSelectedToCloud() and uploadToGCS()
2. `assets/pet-storage.js` - Add originalUrl and artistNote to schema
3. `assets/cart-pet-integration.js` - Add artist notes field handling
4. `snippets/ks-product-pet-selector.liquid` - Add fields to pet:selected event
5. `snippets/buy-buttons.liquid` - Fix cloud upload trigger

### Backend
6. `backend/inspirenet-api/src/api_v2_endpoints.py` - Add /upload-to-gcs endpoint
7. `backend/inspirenet-api/deploy-production-clean.yaml` - Update env vars if needed

### Testing
8. Create `testing/gcs-upload-test.html` - Test upload functionality
9. Update `.claude/tasks/context_session_1736096953.md` - Document completion

---

## Estimated Timeline

- **Phase 1**: 4-6 hours (frontend upload logic)
- **Phase 2**: 3-4 hours (backend endpoint)
- **Phase 3**: 1 hour (event payload)
- **Phase 4**: 1-2 hours (cart integration)
- **Phase 5**: 1 hour (buy-buttons)
- **Phase 6**: 30 minutes (storage schema)
- **Testing**: 2-3 hours (end-to-end validation)

**Total**: 12-17 hours

---

## Next Steps

1. Review this plan with team
2. Confirm GCS bucket exists and has correct permissions
3. Assign implementation to engineer
4. Create tracking issue/ticket
5. Begin with Phase 2 (backend) for quickest validation

---

## Appendix: Alternative Solutions Considered

### Alternative 1: Upload During Processing (Rejected)
**Pros**: Images ready immediately
**Cons**: Slows down processing, user must wait for upload
**Reason Rejected**: UX impact too high, processing already takes 3-11s

### Alternative 2: Backend Stores Images Automatically (Rejected)
**Pros**: No frontend changes needed
**Cons**: Backend doesn't know which effect user selects
**Reason Rejected**: Effect selection happens in cart, not processor

### Alternative 3: Use Shopify File Storage (Rejected)
**Pros**: No GCS costs
**Cons**: More complex API, file size limits, slower access
**Reason Rejected**: GCS is already integrated and proven

---

**Plan Created By**: debug-specialist agent
**Date**: 2025-01-05
**Review Status**: Pending
