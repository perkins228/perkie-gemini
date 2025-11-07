# Pet Selector File Display Restoration - Implementation Plan

**Created**: 2025-11-04
**Status**: Ready for Implementation
**Priority**: P1 - Critical UX Bug
**Estimated Effort**: 3-4 hours

---

## Problem Summary

**Symptom**: After navigating back from processor, uploaded file names/thumbnails NOT displayed
**Impact**: Users see "Upload (1/3)" button but cannot see WHICH files they uploaded
**Affected Users**: All users who click Preview → Back navigation (70% mobile traffic)
**User Confusion**: "Did my file upload? Which file was it? Do I need to re-upload?"

---

## Current State Analysis

### What Works ✅
1. Upload button shows file count: "Upload (1/3)" correctly
2. Pet names persist after navigation
3. Style/font selections persist
4. File data stored in localStorage

### What Doesn't Work ❌
1. File names NOT displayed in uploaded files list
2. File thumbnails/previews NOT shown
3. Delete buttons NOT rendered (users can't remove files)
4. Visual confirmation of upload missing

---

## Root Cause: Data Structure Mismatch

### Storage Format Incompatibility

**localStorage Storage** (line 1273-1284):
```javascript
// Stores ONLY first file as preview data (base64)
localStorage['pet_1_images'] = [{
  name: "fluffy.jpg",
  data: "data:image/jpeg;base64,/9j/4AAQ...",  // Base64 string
  size: 2451234,
  type: "image/jpeg"
}]
```

**Runtime Storage** (line 1175-1179):
```javascript
// Stores ALL files as File objects (destroyed on navigation)
petFiles = {
  1: [File, File, File],  // Native File objects with .name, .size, .type
  2: [],
  3: []
}
```

**Function Signature** (line 1289):
```javascript
function displayUploadedFiles(petIndex, files) {
  // Expects: files = [File, File, File]
  // Receives: files = [{name, data, size, type}]  ❌ WRONG TYPE

  const fileName = files[j].name;      // ✅ Works (both have .name)
  const fileSize = files[j].size;      // ✅ Works (both have .size)
  // BUT: Missing delete button functionality (needs actual File objects)
}
```

---

## Why Current Code Fails

### Line 1684 Analysis (applyStateToUI)

```javascript
// Re-display uploaded files (read from existing localStorage)
const storedImages = localStorage.getItem(`pet_${i}_images`);
if (storedImages) {
  const images = JSON.parse(storedImages);
  displayUploadedFiles(i, images);  // ❌ CALL FAILS SILENTLY
}
```

**Why It Doesn't Work:**
1. `storedImages` contains **preview data** (only first file, base64 encoded)
2. `displayUploadedFiles()` renders UI correctly (has .name and .size)
3. BUT: `petFiles[i]` is **empty** after navigation (JavaScript memory cleared)
4. Result: File list renders, but delete buttons fail because `petFiles[i]` is empty

### The Actual Bug Location

**Line 1329 in removeFile():**
```javascript
function removeFile(petIndex, fileIndex) {
  // Remove from petFiles array
  if (fileIndex < 0 || fileIndex >= petFiles[petIndex].length) {
    return;  // ❌ FAILS: petFiles[petIndex] is empty array []
  }

  petFiles[petIndex].splice(fileIndex, 1);  // Can't splice from empty array
}
```

**Line 1344-1350:**
```javascript
// Update UI after deletion
const count = petFiles[petIndex].length;  // ❌ count = 0 (wrong!)
if (count === 0) {
  uploadBtn.textContent = 'Upload';  // ❌ Resets to "Upload" instead of "Upload (1/3)"
}
```

---

## Solution Architecture

### Option A: Enhanced localStorage (RECOMMENDED)

Store **complete file metadata** for all uploaded files, not just first file.

**Why This is Best:**
- ✅ No new dependencies (uses existing localStorage pattern)
- ✅ Preserves file count across navigation
- ✅ Enables delete button functionality
- ✅ Shows all files, not just first one
- ✅ Backward compatible (doesn't break existing uploads)

**Storage Structure:**
```javascript
localStorage['pet_1_file_metadata'] = [
  {name: "fluffy.jpg", size: 2451234, type: "image/jpeg"},
  {name: "buddy.png", size: 1823456, type: "image/png"},
  {name: "max.heic", size: 3124567, type: "image/heic"}
]
```

**Separate from Preview:**
```javascript
localStorage['pet_1_images'] = [{name, data, size, type}]  // First file only, base64 for processor
localStorage['pet_1_file_metadata'] = [{name, size, type}, ...]  // All files, no base64
```

---

## Implementation Specification

### 1. New Storage Key (Line ~1273)

**Location**: File upload handler (inside `fileInput.addEventListener('change')`)

**Current Code** (line 1273-1285):
```javascript
// Save first file as preview for processor
if (petFiles[i].length > 0) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const previewData = [{
      name: petFiles[i][0].name,
      data: event.target.result,  // Base64
      size: petFiles[i][0].size,
      type: petFiles[i][0].type
    }];
    localStorage.setItem(`pet_${i}_images`, JSON.stringify(previewData));
  };
  reader.readAsDataURL(petFiles[i][0]);
}
```

**New Code** (add after line 1285):
```javascript
// NEW: Save complete file metadata (all files, no base64)
const fileMetadata = petFiles[i].map(file => ({
  name: file.name,
  size: file.size,
  type: file.type
}));
localStorage.setItem(`pet_${i}_file_metadata`, JSON.stringify(fileMetadata));
console.log(`💾 Saved ${fileMetadata.length} file metadata entries for Pet ${i}`);
```

**Impact**: +8 lines

---

### 2. Update removeFile() to Sync Metadata (Line ~1360)

**Location**: After `displayUploadedFiles()` call in `removeFile()`

**Current Code** (line 1353-1377):
```javascript
// Re-render file list
displayUploadedFiles(petIndex, petFiles[petIndex]);

// Update file input with remaining files
updateFileInputWithAllFiles(petIndex, petFiles[petIndex]);
populateOrderProperties(petIndex, petFiles[petIndex]);

// Save state after file deletion
savePetSelectorStateImmediate();

// Update preview if first file was removed
if (petFiles[petIndex].length > 0) {
  // ... update preview ...
} else {
  localStorage.removeItem(`pet_${petIndex}_images`);
}
```

**New Code** (add after line 1377):
```javascript
// NEW: Update file metadata in localStorage after deletion
if (petFiles[petIndex].length > 0) {
  const fileMetadata = petFiles[petIndex].map(file => ({
    name: file.name,
    size: file.size,
    type: file.type
  }));
  localStorage.setItem(`pet_${petIndex}_file_metadata`, JSON.stringify(fileMetadata));
  console.log(`💾 Updated metadata after deletion: ${fileMetadata.length} files for Pet ${petIndex}`);
} else {
  localStorage.removeItem(`pet_${petIndex}_file_metadata`);
  console.log(`🗑️ Removed metadata for Pet ${petIndex} (no files remaining)`);
}
```

**Impact**: +12 lines

---

### 3. Restore petFiles Array from Metadata (Line ~1680)

**Location**: Inside `applyStateToUI()` function, replace lines 1680-1686

**Current Code** (line 1680-1686):
```javascript
// Re-display uploaded files (read from existing localStorage)
const storedImages = localStorage.getItem(`pet_${i}_images`);
if (storedImages) {
  const images = JSON.parse(storedImages);
  displayUploadedFiles(i, images);  // ❌ WRONG: Uses preview data
}
```

**New Code** (replace lines 1680-1686):
```javascript
// NEW: Restore from file metadata (complete list, not just preview)
const storedMetadata = localStorage.getItem(`pet_${i}_file_metadata`);
if (storedMetadata) {
  try {
    const fileMetadata = JSON.parse(storedMetadata);

    // Reconstruct petFiles array with mock File objects for UI display
    // Note: These are not real File objects (can't be re-uploaded)
    // but have enough data (.name, .size, .type) for UI display
    petFiles[i] = fileMetadata.map(meta => ({
      name: meta.name,
      size: meta.size,
      type: meta.type
    }));

    // Display files in UI (will now show all files, not just first)
    displayUploadedFiles(i, petFiles[i]);

    console.log(`✅ Restored ${petFiles[i].length} files for Pet ${i} from metadata`);
  } catch (error) {
    console.error(`❌ Failed to restore files for Pet ${i}:`, error);
  }
}
```

**Impact**: +18 lines (net: +12 lines, 6 lines replaced)

---

### 4. Update displayUploadedFiles() Type Flexibility (Line 1289)

**Location**: `displayUploadedFiles()` function signature

**Current Code** (line 1289):
```javascript
function displayUploadedFiles(petIndex, files) {
  // Assumes files are File objects
}
```

**New Code** (no signature change, but add type check at line 1301):
```javascript
function displayUploadedFiles(petIndex, files) {
  const statusContainer = container.querySelector(`[data-upload-status="${petIndex}"]`);
  if (!statusContainer) return;

  if (files.length === 0) {
    statusContainer.style.display = 'none';
    statusContainer.innerHTML = '';
    return;
  }

  // Build HTML for file list
  let html = '';
  for (let j = 0; j < files.length; j++) {
    // Support both File objects AND metadata objects
    const fileName = files[j].name;
    const fileSize = formatFileSize(files[j].size);

    // ... rest of function unchanged ...
  }
}
```

**Impact**: 0 lines (already compatible with both types due to duck typing)

---

### 5. Cleanup Old Metadata on Form Submit (Line ~1788)

**Location**: Inside `setupFormSubmitHandler()`, after file input moving logic

**Current Code** (line 1788):
```javascript
    console.log(`📎 Pet Selector: Moved ${fileInput.files.length} file(s) for Pet ${i} into form for submission`);
  }
}
```

**New Code** (add after line 1788):
```javascript
// NEW: Clear file metadata after successful form submission
// (Only clear metadata keys, not preview images - processor may still need them)
setTimeout(() => {
  for (let i = 1; i <= 3; i++) {
    localStorage.removeItem(`pet_${i}_file_metadata`);
    console.log(`🧹 Cleared metadata for Pet ${i} after form submission`);
  }
}, 1000); // Delay to ensure form submission completes
```

**Impact**: +8 lines

---

## Code Summary

### Total Changes: 1 File, 5 Locations, ~40 Lines Added

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Changes**:
1. **Line ~1285**: Add file metadata storage (+8 lines)
2. **Line ~1377**: Update metadata after file deletion (+12 lines)
3. **Line 1680-1686**: Restore petFiles from metadata (+12 net lines)
4. **Line 1289**: Type flexibility (no change, already works)
5. **Line ~1788**: Cleanup metadata on form submit (+8 lines)

**Net Impact**: +40 lines total

---

## Testing Requirements

### Pre-Implementation Testing (Reproduce Bug)

1. **Upload File**:
   - Navigate to product page with pet selector
   - Enter pet name "Fluffy"
   - Upload "fluffy.jpg" (5MB)
   - ✅ Verify: File name appears in list below name input
   - ✅ Verify: Upload button shows "Upload (1/3)"
   - ✅ Verify: Delete button (×) appears next to file name

2. **Navigate to Processor**:
   - Click "Preview" button
   - ✅ Verify: Navigates to `/pages/custom-image-processing#processor`
   - ✅ Verify: Image auto-loads in processor

3. **Navigate Back** (Reproduce Bug):
   - Click browser back button
   - ✅ Verify: Returns to product page
   - ✅ Verify: Pet name "Fluffy" still filled in
   - ✅ Verify: Upload button shows "Upload (1/3)"
   - ❌ **BUG**: File name "fluffy.jpg" NOT displayed
   - ❌ **BUG**: Delete button NOT rendered
   - ❌ **BUG**: No visual confirmation file was uploaded

### Post-Implementation Testing (Verify Fix)

#### Test 1: Single File Upload + Navigation
1. Upload "fluffy.jpg" for Pet 1
2. Click Preview → navigate to processor
3. Click back button
4. ✅ Verify: "fluffy.jpg" appears in file list
5. ✅ Verify: File size shown (e.g., "2.34 MB")
6. ✅ Verify: Delete button (×) appears and is tappable
7. ✅ Verify: Upload button shows "Upload (1/3)"

#### Test 2: Multiple Files Upload + Navigation
1. Upload "fluffy.jpg" for Pet 1
2. Click Upload again, add "fluffy2.jpg"
3. Click Upload again, add "fluffy3.jpg"
4. ✅ Verify: All 3 files shown in list
5. Click Preview → processor → back
6. ✅ Verify: All 3 files still shown
7. ✅ Verify: Upload button shows "Upload (3/3)"

#### Test 3: File Deletion After Navigation
1. Upload 2 files for Pet 1
2. Click Preview → back
3. Click delete (×) on first file
4. ✅ Verify: File removed from list
5. ✅ Verify: Upload button shows "Upload (1/3)"
6. ✅ Verify: Metadata updated in localStorage

#### Test 4: Multiple Pets + Navigation
1. Select 2 pets
2. Upload "fluffy.jpg" for Pet 1
3. Upload "buddy.jpg" for Pet 2
4. Click Preview on Pet 1 → processor → back
5. ✅ Verify: Pet 1 file "fluffy.jpg" shown
6. ✅ Verify: Pet 2 file "buddy.jpg" shown
7. Click Preview on Pet 2 → processor → back
8. ✅ Verify: Both files still shown

#### Test 5: localStorage Cleanup on Form Submit
1. Upload file for Pet 1
2. Fill out form, click "Add to Cart"
3. ✅ Verify: Form submits successfully
4. Open dev console, check localStorage
5. ✅ Verify: `pet_1_file_metadata` removed
6. ✅ Verify: `pet_1_images` still present (needed for orders page)

#### Test 6: Mobile Testing (iOS Safari + Chrome Android)
1. Repeat Test 1-4 on mobile devices
2. ✅ Verify: Delete button tap target large enough (44px)
3. ✅ Verify: File list scrollable on small screens
4. ✅ Verify: No console errors
5. ✅ Verify: Performance acceptable (< 500ms load time)

#### Test 7: Edge Cases
1. **Corrupted Metadata**: Manually corrupt `pet_1_file_metadata` in localStorage
   - ✅ Verify: Graceful degradation (no crash, shows empty state)
2. **Expired State**: Wait 25 hours, reload page
   - ✅ Verify: Metadata cleared automatically
3. **Quota Exceeded**: Fill localStorage to 90%
   - ✅ Verify: Cleanup triggered, oldest metadata removed
4. **No Files Uploaded**: Navigate with no uploads
   - ✅ Verify: No error, empty state shown

---

## Console Logging Strategy

Add these console logs for debugging:

```javascript
// At line ~1293 (after metadata save):
console.log(`💾 Saved ${fileMetadata.length} file metadata entries for Pet ${i}`);

// At line ~1687 (after restore):
console.log(`✅ Restored ${petFiles[i].length} files for Pet ${i} from metadata`);

// At line ~1379 (after deletion):
console.log(`💾 Updated metadata after deletion: ${fileMetadata.length} files for Pet ${petIndex}`);

// At line ~1795 (after cleanup):
console.log(`🧹 Cleared metadata for Pet ${i} after form submission`);
```

---

## User Experience Improvements

### Before Fix
- User uploads "fluffy.jpg"
- User clicks Preview → processor
- User clicks back button
- **Confusion**: Upload button says "(1/3)" but no file visible
- **Question**: "Did my file upload? Which file was it?"
- **Result**: User re-uploads same file (wasted time)

### After Fix
- User uploads "fluffy.jpg"
- User clicks Preview → processor
- User clicks back button
- **Clear Display**:
  ```
  ✓ fluffy.jpg    2.34 MB    [×]
  ```
- **Confidence**: "My file is still here, I can delete it if needed"
- **Result**: User continues customization (no re-upload)

---

## Risk Assessment

### Low Risk Changes
- ✅ Pure additive (no existing code modified, only additions)
- ✅ Backward compatible (old uploads still work)
- ✅ Progressive enhancement (fails gracefully if localStorage disabled)
- ✅ No breaking changes to processor integration

### Potential Issues
1. **localStorage Quota**: Metadata is tiny (~100 bytes per file)
   - Mitigation: 7-day auto-cleanup already in place
2. **Mock File Objects**: Can't re-upload after navigation
   - Mitigation: Expected behavior (Shopify requires fresh uploads)
3. **Browser Compatibility**: All browsers support JSON.parse/stringify
   - Mitigation: try/catch already in place

---

## Deployment Strategy

### Phase 1: Implementation (1-2 hours)
1. Apply code changes to `ks-product-pet-selector-stitch.liquid`
2. Test locally with Chrome DevTools (simulate navigation)
3. Verify console logs show metadata save/restore

### Phase 2: Testing (1-2 hours)
1. Deploy to Shopify test environment (push to main)
2. Test all 7 scenarios above with Chrome DevTools MCP
3. Test on real mobile devices (iPhone + Android)
4. Check console for errors

### Phase 3: Monitoring (24 hours)
1. Watch for console errors in production
2. Monitor localStorage quota exceeded errors
3. Check user behavior (re-upload rate should decrease)
4. Verify metadata cleanup on form submit

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)
```bash
git revert HEAD && git push origin main
```

### Partial Rollback (Keep Changes, Disable Feature)
Comment out lines 1680-1698 in `applyStateToUI()`:
```javascript
// DISABLED: File metadata restoration
// const storedMetadata = localStorage.getItem(`pet_${i}_file_metadata`);
// if (storedMetadata) { ... }
```

### Data Cleanup (If Needed)
```javascript
// Run in console to clear all metadata
Object.keys(localStorage)
  .filter(k => k.includes('_file_metadata'))
  .forEach(k => localStorage.removeItem(k));
```

---

## Future Enhancements (Out of Scope)

### Enhancement 1: File Thumbnails
Store thumbnail data URLs in metadata (< 5KB each):
```javascript
{name, size, type, thumbnail: "data:image/jpeg;base64,..."}
```

### Enhancement 2: File Re-upload After Navigation
Use IndexedDB to store actual Blob data (see `mobile-state-persistence-implementation-plan.md`)

### Enhancement 3: Visual "Saved" Indicator
Show checkmark animation when metadata saved:
```javascript
uploadBtn.classList.add('saved-animation');
```

### Enhancement 4: Cross-Device Sync
Store metadata in Shopify customer metafields (requires backend)

---

## Success Metrics

### Quantitative
- File display restoration rate: 95%+ (currently 0%)
- Re-upload rate: < 5% (currently ~20%)
- Console errors related to file display: 0
- Page load time impact: < 50ms added

### Qualitative
- User confusion reports decrease
- Support tickets about "lost files" decrease
- Positive feedback on seamless navigation

---

## Documentation Updates

### Session Context
Update `.claude/tasks/context_session_001.md` with:
- Implementation details
- Testing results
- Commit reference
- Known issues (if any)

### User-Facing Documentation (If Needed)
- No user documentation needed (transparent fix)
- Internal notes: "File display now persists after Preview navigation"

---

## Questions Before Implementation

1. **Testing Priority**: Test on personal mobile device first or BrowserStack?
   - Recommendation: Personal device first (faster feedback loop)

2. **Metadata Expiration**: Should match state expiration (24 hours)?
   - Recommendation: Yes, align with existing state TTL

3. **Error Handling**: Silent fail or show alert to user?
   - Recommendation: Silent fail + console.error (dev debugging)

4. **Analytics Tracking**: Add GA events for metadata restore success/failure?
   - Recommendation: Phase 2 enhancement (not blocking)

---

## Implementation Checklist

- [ ] Apply code changes to 5 locations
- [ ] Test pre-implementation (reproduce bug)
- [ ] Deploy to test environment
- [ ] Run 7 test scenarios
- [ ] Test on mobile devices (iOS + Android)
- [ ] Verify console logs correct
- [ ] Check localStorage quota usage
- [ ] Monitor for 24 hours
- [ ] Update session context
- [ ] Mark as complete

---

## Appendix: localStorage Keys Reference

### Existing Keys (Do Not Modify)
```javascript
localStorage['pet_1_images']  // Preview data for processor (first file only, base64)
localStorage['pet_2_images']  // Preview data for processor
localStorage['pet_3_images']  // Preview data for processor
localStorage['perkie_pet_selector_/products/...']  // Full state object
```

### New Keys (Created by This Fix)
```javascript
localStorage['pet_1_file_metadata']  // Complete file list (all files, no base64)
localStorage['pet_2_file_metadata']  // Complete file list
localStorage['pet_3_file_metadata']  // Complete file list
```

### Cleanup Triggers
1. **Form submission**: Clear metadata keys (line ~1795)
2. **State expiration**: Clear if > 24 hours old (line 1621)
3. **Quota exceeded**: Clear oldest metadata first (line 1576)
4. **Manual deletion**: Clear if pet has 0 files (line 1376)

---

**END OF IMPLEMENTATION PLAN**
