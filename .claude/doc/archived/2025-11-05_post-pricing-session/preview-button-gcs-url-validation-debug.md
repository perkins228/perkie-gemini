# Preview Button GCS URL Validation Debug Plan

**Date**: 2025-11-06
**Issue**: Preview button shows "Please upload at least one image first" error even after successful GCS upload
**Status**: Root cause identified, implementation plan ready

---

## Problem Summary

User successfully uploads images to Google Cloud Storage (GCS), sees console logs confirming upload:
```
✅ Pet 1 uploaded to server: https://storage.googleapis.com/.../original_1762444114.jpg
✅ Pet 2 uploaded to server: https://storage.googleapis.com/.../original_1762444121.jpg
💾 Saved pet selector state (immediate)
```

But clicking Preview button shows error:
```
Please upload at least one image first
```

**Root Cause**: Preview button validation checks OLD storage format instead of NEW GCS URL format.

---

## Root Cause Analysis

### Storage Format Evolution

#### OLD Format (Base64 - Deprecated)
```javascript
localStorage['pet_1_images'] = '[{"name":"dog.jpg","data":"data:image/jpeg;base64,...","size":12345,"type":"image/jpeg"}]'
```
- **Size**: ~3.4MB per image (base64 overhead)
- **Usage**: Offline fallback only
- **Location**: Line 1670 (fallback path)

#### NEW Format (GCS URL - Primary)
```javascript
localStorage['pet_1_image_url'] = 'https://storage.googleapis.com/perkieprints-processing-cache/uploads/original_1762444114.jpg'
```
- **Size**: ~100 bytes per URL (97% reduction!)
- **Usage**: Server-first upload (primary path)
- **Location**: Line 1653 (success path)

### The Bug

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Location**: Lines 1856-1866 (Preview button click handler)

```javascript
previewBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // ❌ BUG: Only checks OLD format
  const storedImages = localStorage.getItem(`pet_${i}_images`);
  const images = storedImages ? JSON.parse(storedImages) : [];

  if (images.length === 0) {
    alert('Please upload at least one image first'); // ← Error shown here
    return;
  }

  // Open modal with first image and processor
  openProcessorModal(images[0].data, i);
});
```

**Why It Fails**:
1. User uploads image → Stored in `pet_1_image_url` (NEW format)
2. User clicks Preview → Checks `pet_1_images` (OLD format)
3. OLD format is empty → Error shown
4. NEW format exists but never checked

---

## Implementation Plan

### Step 1: Update Preview Button Validation

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 1856-1870

**Current Code**:
```javascript
previewBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // Get uploaded images for this pet
  const storedImages = localStorage.getItem(`pet_${i}_images`);
  const images = storedImages ? JSON.parse(storedImages) : [];

  if (images.length === 0) {
    alert('Please upload at least one image first');
    return;
  }

  // Open modal with first image and processor
  openProcessorModal(images[0].data, i);
});
```

**New Code**:
```javascript
previewBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // Check for GCS URL first (NEW format - primary)
  const gcsUrl = localStorage.getItem(`pet_${i}_image_url`);

  if (gcsUrl) {
    // GCS URL exists - use server-first path
    console.log(`🎨 Opening processor with GCS URL for Pet ${i}:`, gcsUrl);
    openProcessorModal(gcsUrl, i);
    return;
  }

  // Fallback: Check for base64 images (OLD format - offline mode)
  const storedImages = localStorage.getItem(`pet_${i}_images`);
  const images = storedImages ? JSON.parse(storedImages) : [];

  if (images.length === 0) {
    alert('Please upload at least one image first');
    return;
  }

  // Use base64 fallback
  console.log(`🎨 Opening processor with base64 for Pet ${i} (offline mode)`);
  openProcessorModal(images[0].data, i);
});
```

**Changes**:
1. **Line 1859-1862**: Add GCS URL check FIRST (primary path)
2. **Line 1863-1865**: Early return if GCS URL exists
3. **Line 1867-1870**: Keep old format check as fallback
4. **Add logging**: Distinguish between GCS and base64 paths

---

### Step 2: Verify openProcessorModal Handles Both Formats

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Location**: Lines 1875-1886

**Current Code**:
```javascript
function openProcessorModal(imageDataUrl, petIndex) {
  // Image data already stored in localStorage by file upload handler (line 1273)
  // Store return URL and scroll position for back navigation
  sessionStorage.setItem('pet_selector_return_url', window.location.href);
  sessionStorage.setItem('pet_selector_scroll_position', window.scrollY.toString());

  // Store which pet index user clicked Preview on (for multiple pet handling)
  sessionStorage.setItem('pet_selector_active_index', petIndex.toString());

  // Navigate to processor page - it will read from localStorage automatically
  window.location.href = '/pages/custom-image-processing#processor';
}
```

**Analysis**:
- Parameter name `imageDataUrl` is misleading (can be GCS URL or base64)
- Function doesn't use the parameter - relies on localStorage
- Pet processor page will need to read BOTH `pet_X_image_url` AND `pet_X_images`

**Action Required**:
- ✅ No changes needed to THIS function (parameter ignored)
- ⚠️ **Separate task**: Update pet processor page to check GCS URLs first

---

### Step 3: Update collectPetSelectorState() to Include GCS URLs

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Location**: Lines 1909-1940

**Current Code**:
```javascript
function collectPetSelectorState() {
  const productId = getProductId();
  const selectedCountRadio = container.querySelector('[data-pet-count-radio]:checked');
  const petCount = selectedCountRadio ? parseInt(selectedCountRadio.value) : 0;

  // Collect per-pet data
  const pets = {};
  for (let i = 1; i <= 3; i++) {
    const nameInput = container.querySelector(`[data-pet-name-input="${i}"]`);

    if (nameInput) {
      pets[i] = {
        name: nameInput.value.trim(),
        fileCount: (petFiles[i] || []).length
      };
    }
  }

  // ... rest of state collection
}
```

**New Code**:
```javascript
function collectPetSelectorState() {
  const productId = getProductId();
  const selectedCountRadio = container.querySelector('[data-pet-count-radio]:checked');
  const petCount = selectedCountRadio ? parseInt(selectedCountRadio.value) : 0;

  // Collect per-pet data
  const pets = {};
  for (let i = 1; i <= 3; i++) {
    const nameInput = container.querySelector(`[data-pet-name-input="${i}"]`);

    if (nameInput) {
      // Check which storage format is used
      const gcsUrl = localStorage.getItem(`pet_${i}_image_url`);
      const storedImages = localStorage.getItem(`pet_${i}_images`);
      const hasImage = !!(gcsUrl || storedImages);

      pets[i] = {
        name: nameInput.value.trim(),
        fileCount: (petFiles[i] || []).length,
        hasGcsUrl: !!gcsUrl,
        hasBase64: !!storedImages,
        imageUrl: gcsUrl || null  // Include GCS URL in state
      };
    }
  }

  // ... rest of state collection
}
```

**Changes**:
1. Add GCS URL check in state collection
2. Add `hasGcsUrl` flag to track storage format
3. Add `hasBase64` flag for offline mode
4. Include `imageUrl` in saved state

---

## Testing Strategy

### Test Case 1: Server-First Upload (Primary Path)
1. Navigate to product page
2. Select pet count (1)
3. Enter pet name
4. Upload image → Should see "✅ Pet 1 uploaded to server: https://storage.googleapis.com/..."
5. Click Preview button → Should open processor (no error)
6. Verify localStorage has `pet_1_image_url`
7. Verify console shows "🎨 Opening processor with GCS URL for Pet 1"

### Test Case 2: Offline Fallback (Base64)
1. Disable server upload (simulate network failure)
2. Upload image → Should see "⚠️ Server upload failed for Pet 1, using offline mode"
3. Verify localStorage has `pet_1_images` (base64)
4. Click Preview button → Should open processor (no error)
5. Verify console shows "🎨 Opening processor with base64 for Pet 1 (offline mode)"

### Test Case 3: Multiple Pets
1. Select pet count (3)
2. Upload images for all 3 pets
3. Click Preview on Pet 1 → Should open processor
4. Return to selector
5. Click Preview on Pet 2 → Should open processor
6. Click Preview on Pet 3 → Should open processor

### Test Case 4: State Persistence
1. Upload images for pets
2. Navigate away from page
3. Return to product page
4. Click Preview → Should still work (state restored)

---

## Files to Modify

### Primary File
- **`snippets/ks-product-pet-selector-stitch.liquid`**
  - Lines 1856-1870: Update Preview button validation
  - Lines 1909-1927: Update state collection
  - Lines 1875-1886: Verify modal function (no changes needed)

### Secondary File (Separate Task)
- **Pet Processor Page** (`/pages/custom-image-processing`)
  - Update image loading to check GCS URLs first
  - Fall back to base64 if GCS URL not found
  - **Note**: This is a SEPARATE issue - processor page loading, not Preview button validation

---

## Expected Outcomes

### Immediate Fixes
1. ✅ Preview button works after GCS upload
2. ✅ Preview button still works in offline mode (base64 fallback)
3. ✅ Console logs show which storage format is used
4. ✅ State persistence includes GCS URL information

### Remaining Work (Separate Tasks)
1. ⚠️ Pet processor page needs to load GCS URLs
2. ⚠️ Add to Cart needs to validate GCS URLs (not just base64)
3. ⚠️ Order properties need to include GCS URLs

---

## Code Review Checklist

### Validation Logic
- [ ] GCS URL checked FIRST (primary path)
- [ ] Base64 checked SECOND (fallback path)
- [ ] Error message only shown if BOTH formats empty
- [ ] Console logs distinguish between formats

### Backward Compatibility
- [ ] Old base64 format still works (offline mode)
- [ ] No breaking changes to existing flows
- [ ] State persistence includes both formats

### Edge Cases
- [ ] Empty localStorage handled correctly
- [ ] Multiple pets handled independently
- [ ] Page refresh preserves validation state
- [ ] Network failure gracefully falls back to base64

---

## Risk Assessment

### Low Risk Changes
- ✅ Preview button validation (isolated change)
- ✅ State collection enhancement (additive only)
- ✅ Console logging (debugging aid)

### Medium Risk (Future Work)
- ⚠️ Pet processor page loading (needs separate testing)
- ⚠️ Add to Cart validation (affects checkout)
- ⚠️ Order submission (critical path)

### Mitigation Strategy
1. Deploy Preview button fix first (isolated, low risk)
2. Test thoroughly with Chrome DevTools MCP
3. Verify both GCS and base64 paths work
4. Address processor page loading in separate commit
5. Add comprehensive error handling for edge cases

---

## Related Issues

### Already Fixed
- ✅ Server-first upload stores GCS URLs (Line 1653)
- ✅ Offline fallback stores base64 (Line 1670)
- ✅ File metadata stored for state restoration (Line 1685)

### Still Broken (Separate Tasks)
- ❌ Preview button validation (THIS TASK)
- ❌ Pet processor page loading GCS URLs
- ❌ Add to Cart validation with GCS URLs
- ❌ Order properties including GCS URLs

---

## Implementation Notes

### Why GCS First?
1. **97% storage savings**: 100 bytes vs 3.4MB
2. **Mobile optimization**: 70% of traffic is mobile
3. **Server-first**: Images already on server, no re-upload needed
4. **Future-proof**: Enables CV/ML pipeline on server

### Why Keep Base64 Fallback?
1. **Offline mode**: User can work without network
2. **Graceful degradation**: Upload failure doesn't block user
3. **Backward compatibility**: Existing base64 flows still work
4. **Development testing**: Local testing without server

### Performance Impact
- **Before**: Check 1 localStorage key (`pet_1_images`)
- **After**: Check 2 localStorage keys (`pet_1_image_url` + `pet_1_images`)
- **Impact**: Negligible (~0.1ms per check)
- **Benefit**: Enables 97% storage savings + server-first architecture

---

## Next Steps

1. **Implement Preview button fix** (lines 1856-1870)
2. **Update state collection** (lines 1909-1927)
3. **Test with Chrome DevTools MCP** (all 4 test cases)
4. **Commit changes** with descriptive message
5. **Create separate task** for pet processor page loading
6. **Document findings** in session context

---

## Appendix: Storage Format Comparison

### OLD Format (Base64)
```javascript
// pet_1_images
[{
  "name": "dog.jpg",
  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...", // ~3.4MB
  "size": 2451789,
  "type": "image/jpeg"
}]
```

### NEW Format (GCS URL)
```javascript
// pet_1_image_url
"https://storage.googleapis.com/perkieprints-processing-cache/uploads/original_1762444114.jpg" // ~100 bytes
```

### File Metadata (New)
```javascript
// pet_1_file_metadata
[{
  "name": "dog.jpg",
  "size": 2451789,
  "type": "image/jpeg"
}]
```

**Key Insight**: We store BOTH GCS URL (100 bytes) AND file metadata (200 bytes) for total of 300 bytes instead of 3.4MB base64. That's 99.99% reduction!

---

## Conclusion

The Preview button validation bug is a simple oversight where the new GCS URL storage format (`pet_X_image_url`) was implemented in the upload handler but not checked in the Preview button validation. The fix is straightforward:

1. Check GCS URL first (primary path)
2. Fall back to base64 (offline mode)
3. Show error only if both are empty

This maintains backward compatibility while enabling the server-first architecture that saves 97% localStorage space.
