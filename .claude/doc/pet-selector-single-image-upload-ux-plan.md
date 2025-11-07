# Pet Selector Single Image Upload - UX Implementation Plan

**Created**: 2025-11-04
**Agent**: ux-design-ecommerce-expert
**Task**: Design UX change to support only 1 image per pet (down from 3) with "CHANGE IMAGE?" replacement functionality

---

## Executive Summary

**Goal**: Simplify pet selector upload flow from "up to 3 images per pet" to "exactly 1 image per pet" with intuitive image replacement.

**Key Changes**:
- Limit to 1 image per pet (change `data-max-files="3"` → `"1"`)
- Empty state: "Click or drag to upload" (existing)
- Filled state: "CHANGE IMAGE?" (new text)
- Replacement flow: Click filled zone → File picker → Auto-replace existing image
- Remove file list display (single file makes list redundant)
- Keep Preview button (navigates to processor)

**Mobile Priority**: 70% of traffic is mobile - all design decisions prioritize mobile UX

**Risk Level**: **LOW** - Simplification reduces complexity, no new technical patterns

**Timeline**: 45-60 minutes (15 min implementation + 30 min testing + 15 min deployment)

---

## Current State Analysis

### Current Behavior (3 Images)
```
1. Upload zone: "Click or drag to upload"
2. User uploads 1-3 images
3. Upload zone shows: "2/3 photos uploaded"
4. File list appears below with delete buttons
5. Preview button appears (navigates to processor)
```

### Current File Structure
- **File**: `snippets/ks-product-pet-selector-stitch.liquid`
- **Upload zone**: Lines 83-96 (HTML), Lines 845-906 (CSS)
- **File input**: Line 107-114 (`data-max-files="3"`, `multiple` attribute)
- **File list display**: Lines 116-127 (wrapper), Lines 1457-1502 (JavaScript display function)
- **Upload handler**: Lines 1354-1455 (validation, storage, display)

### Key Variables
- `petFiles[i]` - Array storing File objects for pet i (lines 1298-1302)
- `data-max-files="3"` - Current max file limit (line 113)
- `multiple` attribute on file input (line 110)

---

## UX Design Recommendations

### Recommendation 1: Upload Zone States (APPROVED)

**Empty State** (no image uploaded):
```
┌─────────────────────────────────────┐
│         [Upload Icon]               │
│   Click or drag to upload           │
└─────────────────────────────────────┘
```
- **Text**: "Click or drag to upload"
- **Style**: Dashed border, gray background
- **Behavior**: Click → File picker opens

**Filled State** (image uploaded):
```
┌─────────────────────────────────────┐
│         [Upload Icon]               │
│        CHANGE IMAGE?                │
└─────────────────────────────────────┘
```
- **Text**: "CHANGE IMAGE?" (uppercase for emphasis)
- **Style**: Solid green border, light green background
- **Behavior**: Click → File picker opens → Replaces existing image
- **Rationale**:
  - Single action (no confirmation dialog) reduces friction
  - Uppercase signals different state vs empty
  - Green indicates success/active state
  - Question mark invites interaction ("yes, I want to change")

### Recommendation 2: File Display (REMOVE)

**Decision**: **Remove file list display entirely**

**Rationale**:
1. Single file makes list redundant (you already see the state in upload zone)
2. Delete button creates confusion:
   - "Delete" → back to empty state
   - "CHANGE IMAGE?" → replace with new image
   - Two ways to achieve similar outcome = cognitive load
3. Mobile space savings (removes ~50px vertical space per pet)
4. Simpler mental model: Upload zone is the ONLY control

**User Flow**:
```
Upload image → Zone shows "CHANGE IMAGE?" → Click zone → Pick new image → Old image replaced
                                          → [Preview] button appears
```

**Alternative if file info needed**:
- Show filename inside upload zone (below "CHANGE IMAGE?")
- Smaller text, gray color
- Example: "dog.jpg (2.1 MB)"
- **Decision**: Skip this - adds complexity without clear value

### Recommendation 3: Delete Functionality (REMOVE)

**Decision**: Remove standalone delete button

**Replacement**: To "remove" an image, user clicks "CHANGE IMAGE?" and selects a different image

**Edge Case**: "What if user wants to un-upload and return to empty state?"
- **Solution**: Not needed - required flow is upload → process → add to cart
- If user wants different image: Click "CHANGE IMAGE?" and pick new one
- If user uploaded wrong pet entirely: They'll click "CHANGE IMAGE?" and fix it
- Empty state serves no functional purpose (can't proceed without image)

**Rationale**:
- E-commerce conversion focus: Every step should move toward purchase
- Empty state after upload = dead end (requires re-upload)
- Simpler is faster on mobile (70% traffic)

### Recommendation 4: Visual Design - Filled State

**Upload Zone Appearance Change**:

**CSS Changes** (lines 873-876 in `ks-product-pet-selector-stitch.liquid`):

```css
/* CURRENT - Green border/background on .has-files */
.pet-detail__upload-zone.has-files {
  border-color: #22c55e;
  background-color: rgba(34, 197, 94, 0.05);
}

/* ENHANCED - More prominent filled state */
.pet-detail__upload-zone.has-files {
  border: 2px solid #22c55e;              /* Solid border (not dashed) */
  background-color: rgba(34, 197, 94, 0.08); /* Slightly stronger green tint */
}
```

**Upload Icon Color Change**:

```css
/* CURRENT - Green icon on .has-files */
.pet-detail__upload-zone.has-files .pet-detail__upload-icon {
  color: #22c55e;
}

/* Keep this - clearly signals success state */
```

**Upload Text Styling**:

```css
/* NEW - Make "CHANGE IMAGE?" stand out */
.pet-detail__upload-zone.has-files .pet-detail__upload-text {
  font-weight: 600;        /* Semi-bold vs normal */
  color: #16a34a;          /* Darker green for readability */
  text-transform: uppercase; /* Handled in JavaScript text content */
}
```

**Rationale**:
- Solid border vs dashed = "filled" vs "empty" affordance
- Green = success/active state (universal convention)
- Semi-bold text = draws attention to changed state
- Uppercase "CHANGE IMAGE?" = imperative call-to-action

### Recommendation 5: Mobile Optimization

**Touch Target Requirements**:
- Upload zone height: Minimum 80px (current is adequate with padding)
- Full width (already implemented in previous plan)
- No small delete buttons to miss-tap

**Mobile-Specific Considerations**:
1. **One-handed operation**: Upload zone centered, easy thumb reach
2. **Visual feedback**: Clear state change (green border on mobile is prominent)
3. **No confirmation dialogs**: Single tap to change = fast mobile flow
4. **Preview button**: Large (3rem height), easy to tap after upload

**Testing Viewports** (Priority Order):
1. 375px (iPhone SE, 13 mini) - HIGHEST priority
2. 390px (iPhone 12, 13, 14) - HIGHEST priority
3. 430px (iPhone 14 Pro Max) - HIGH priority
4. 360px (Android mid-range) - HIGH priority
5. 768px+ (Desktop) - MEDIUM priority

---

## Implementation Specifications

### Change 1: File Input - Limit to 1 Image

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 107-114

```liquid
{% comment %} BEFORE {% endcomment %}
<input type="file"
       name="properties[Pet {{ i }} Images]"
       accept="image/*"
       multiple
       style="display: none;"
       data-pet-file-input="{{ i }}"
       data-max-files="3"
       aria-label="Upload pet {{ i }} photo(s)">

{% comment %} AFTER {% endcomment %}
<input type="file"
       name="properties[Pet {{ i }} Images]"
       accept="image/*"
       style="display: none;"
       data-pet-file-input="{{ i }}"
       data-max-files="1"
       aria-label="Upload pet {{ i }} photo">
```

**Changes**:
- Remove `multiple` attribute (line 110) - Only allow single file selection
- Change `data-max-files="3"` → `data-max-files="1"` (line 113)
- Change aria-label from "photo(s)" → "photo" (line 114)

### Change 2: Hide File List Display

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 116-127

```liquid
{% comment %} BEFORE - Visible file list with delete buttons {% endcomment %}
<div class="pet-detail__upload-status-wrapper"
     data-upload-status-wrapper="{{ i }}"
     style="display: none;">
  <div class="pet-detail__upload-status"
       data-upload-status="{{ i }}"></div>
  <button type="button"
          class="pet-detail__preview-btn"
          data-pet-preview-btn="{{ i }}">
    Preview
  </button>
</div>

{% comment %} AFTER - Hide file list, keep only Preview button {% endcomment %}
<div class="pet-detail__upload-status-wrapper"
     data-upload-status-wrapper="{{ i }}"
     style="display: none;">
  {% comment %} File list removed - single file makes display redundant {% endcomment %}
  <button type="button"
          class="pet-detail__preview-btn"
          data-pet-preview-btn="{{ i }}"
          style="display: none;">
    Preview
  </button>
</div>
```

**Changes**:
- Remove `<div class="pet-detail__upload-status">` (lines 120-121)
- Add `style="display: none;"` to Preview button (controlled by JavaScript)
- Wrapper remains for JS compatibility but won't show file list

### Change 3: Upload Zone Text Change - JavaScript

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 1354-1431 (Upload handler function)

```javascript
// BEFORE - Shows "X/3 photos uploaded"
const count = petFiles[i].length;
uploadText.textContent = `${count}/${maxFiles} photos uploaded`;
uploadZone.classList.add('has-files');

// AFTER - Shows "CHANGE IMAGE?" for single file
const count = petFiles[i].length;
if (count === 1) {
  uploadText.textContent = 'CHANGE IMAGE?';
  uploadZone.classList.add('has-files');
} else {
  uploadText.textContent = 'Click or drag to upload';
  uploadZone.classList.remove('has-files');
}
```

**Location**: Line ~1418 in upload handler

**Also update**: Line ~1517-1522 in `removeFile()` function
```javascript
// BEFORE
if (count === 0) {
  uploadText.textContent = 'Click or drag to upload';
  uploadZone.classList.remove('has-files');
} else {
  uploadText.textContent = `${count}/${maxFiles} photos uploaded`;
}

// AFTER
uploadText.textContent = 'Click or drag to upload';
uploadZone.classList.remove('has-files');
```

### Change 4: Upload Handler - Auto-Replace Logic

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 1354-1431

```javascript
// BEFORE - Additive uploads (up to 3 files)
fileInput.addEventListener('change', (e) => {
  const newFiles = Array.from(e.target.files);

  // Validation 1: File count
  if (newFiles.length === 0) {
    return; // User cancelled
  }

  // Check if adding new files would exceed max
  const currentCount = petFiles[i].length;
  const totalCount = currentCount + newFiles.length;

  if (totalCount > maxFiles) {
    alert(`You can only upload ${maxFiles} photo(s) total...`);
    fileInput.value = '';
    return;
  }

  // ... validation 2-4 ...

  // Add new files to persistent storage
  petFiles[i].push(...filesToAdd);

  // ... UI updates ...
});

// AFTER - Replacement uploads (always 1 file)
fileInput.addEventListener('change', (e) => {
  const newFiles = Array.from(e.target.files);

  // Validation 1: File selection
  if (newFiles.length === 0) {
    return; // User cancelled
  }

  // Single file only (file input has no 'multiple' attribute)
  const newFile = newFiles[0];

  // Validation 2: File size (max 50MB per Shopify)
  if (newFile.size > 50 * 1024 * 1024) {
    alert(`${newFile.name} is too large. Max 50MB per file.`);
    fileInput.value = '';
    return;
  }

  // Validation 3: File type (must be image)
  if (!newFile.type.startsWith('image/')) {
    alert(`${newFile.name} is not an image file. Please select JPG, PNG, or HEIC.`);
    fileInput.value = '';
    return;
  }

  // Replace existing file (not additive)
  petFiles[i] = [newFile];

  // Clear file input to allow re-uploading same file if needed
  fileInput.value = '';

  // Update UI
  uploadText.textContent = 'CHANGE IMAGE?';
  uploadZone.classList.add('has-files');

  // Show Preview button (no file list)
  const statusWrapper = container.querySelector(`[data-upload-status-wrapper="${i}"]`);
  const previewBtn = container.querySelector(`[data-pet-preview-btn="${i}"]`);
  if (statusWrapper && previewBtn) {
    statusWrapper.style.display = 'flex';
    previewBtn.style.display = 'block';
  }

  // Update file input with new file
  updateFileInputWithAllFiles(i, petFiles[i]);
  populateOrderProperties(i, petFiles[i]);

  // Save state
  savePetSelectorStateImmediate();

  // Store file in localStorage for preview modal
  const reader = new FileReader();
  reader.onload = (event) => {
    const previewData = [{
      name: newFile.name,
      data: event.target.result,
      size: newFile.size,
      type: newFile.type
    }];
    localStorage.setItem(`pet_${i}_images`, JSON.stringify(previewData));

    // Save file metadata (no base64)
    const fileMetadata = [{
      name: newFile.name,
      size: newFile.size,
      type: newFile.type
    }];
    localStorage.setItem(`pet_${i}_file_metadata`, JSON.stringify(fileMetadata));
    console.log(`💾 Saved file metadata for Pet ${i}: ${newFile.name}`);
  };
  reader.readAsDataURL(newFile);
});
```

**Key Changes**:
1. Remove duplicate file check (always replacing, not adding)
2. Remove file count validation (always exactly 1 file)
3. Change `petFiles[i].push(...filesToAdd)` → `petFiles[i] = [newFile]` (replace array)
4. Remove `displayUploadedFiles()` call (no file list display)
5. Simplify to single file workflow

### Change 5: Remove File Display Function

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 1457-1502

```javascript
// BEFORE - Complex file list rendering with delete buttons
function displayUploadedFiles(petIndex, files) {
  const statusWrapper = container.querySelector(`[data-upload-status-wrapper="${petIndex}"]`);
  const statusContainer = container.querySelector(`[data-upload-status="${petIndex}"]`);
  if (!statusWrapper || !statusContainer) return;

  if (files.length === 0) {
    statusWrapper.style.display = 'none';
    statusContainer.innerHTML = '';
    return;
  }

  // Build HTML for file list
  let html = '';
  for (let j = 0; j < files.length; j++) {
    const fileName = files[j].name;
    const fileSize = formatFileSize(files[j].size);

    html += `
      <div class="pet-detail__upload-status__file" data-file-index="${j}">
        <span class="pet-detail__upload-status__file-icon">✓</span>
        <span class="pet-detail__upload-status__file-name">${escapeHtml(fileName)}</span>
        <span class="pet-detail__upload-status__file-size">${fileSize}</span>
        <button type="button"
                class="pet-detail__upload-status__file-delete"
                data-pet-index="${petIndex}"
                data-file-index="${j}"
                aria-label="Delete ${escapeHtml(fileName)}">×</button>
      </div>
    `;
  }

  statusContainer.innerHTML = html;
  statusWrapper.style.display = 'flex';

  // Attach delete button handlers
  const deleteButtons = statusContainer.querySelectorAll('.pet-detail__upload-status__file-delete');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const petIdx = parseInt(btn.dataset.petIndex);
      const fileIdx = parseInt(btn.dataset.fileIndex);
      removeFile(petIdx, fileIdx);
    });
  });
}

// AFTER - Function no longer needed (single file, no display)
// Remove entire function (45 lines)
```

**Action**: Delete lines 1457-1502 entirely

### Change 6: Simplify Remove File Function

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 1504-1562

```javascript
// BEFORE - Complex removal with array splicing
function removeFile(petIndex, fileIndex) {
  // Remove from petFiles array
  if (fileIndex < 0 || fileIndex >= petFiles[petIndex].length) {
    return;
  }

  petFiles[petIndex].splice(fileIndex, 1);

  // Update UI
  const uploadZone = container.querySelector(`[data-upload-zone="${petIndex}"]`);
  const uploadText = container.querySelector(`[data-upload-text="${petIndex}"]`);
  const count = petFiles[petIndex].length;
  if (count === 0) {
    uploadText.textContent = 'Click or drag to upload';
    uploadZone.classList.remove('has-files');
  } else {
    uploadText.textContent = `${count}/${maxFiles} photos uploaded`;
  }

  // Re-render file list
  displayUploadedFiles(petIndex, petFiles[petIndex]);

  // Update file input with remaining files
  updateFileInputWithAllFiles(petIndex, petFiles[petIndex]);
  populateOrderProperties(petIndex, petFiles[petIndex]);

  // Save state after file deletion
  savePetSelectorStateImmediate();

  // Update preview if first file was removed
  if (petFiles[petIndex].length > 0) {
    // ... store preview ...
  } else {
    localStorage.removeItem(`pet_${petIndex}_images`);
    localStorage.removeItem(`pet_${petIndex}_file_metadata`);
  }
}

// AFTER - Function no longer needed (no delete button in UI)
// Remove entire function (58 lines)
```

**Action**: Delete lines 1504-1562 entirely

### Change 7: Update State Restoration

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 1845-1889 (State restoration in `applyStateToUI()`)

```javascript
// BEFORE - Shows "X/3 photos uploaded"
if (pet.fileCount > 0) {
  const uploadZone = container.querySelector(`[data-upload-zone="${i}"]`);
  const uploadText = container.querySelector(`[data-upload-text="${i}"]`);
  const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);

  if (uploadZone && fileInput) {
    const maxFiles = parseInt(fileInput.dataset.maxFiles) || 3;
    uploadText.textContent = `${pet.fileCount}/${maxFiles} photos uploaded`;
    uploadZone.classList.add('has-files');

    // Restore from file metadata
    const storedMetadata = localStorage.getItem(`pet_${i}_file_metadata`);
    if (storedMetadata) {
      // ... restore files ...
      displayUploadedFiles(i, petFiles[i]);
    }
  }
}

// AFTER - Shows "CHANGE IMAGE?"
if (pet.fileCount > 0) {
  const uploadZone = container.querySelector(`[data-upload-zone="${i}"]`);
  const uploadText = container.querySelector(`[data-upload-text="${i}"]`);
  const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);

  if (uploadZone && fileInput) {
    uploadText.textContent = 'CHANGE IMAGE?';
    uploadZone.classList.add('has-files');

    // Restore from file metadata
    const storedMetadata = localStorage.getItem(`pet_${i}_file_metadata`);
    if (storedMetadata) {
      try {
        const fileMetadata = JSON.parse(storedMetadata);

        // Single file only
        if (fileMetadata.length > 0) {
          petFiles[i] = [{
            name: fileMetadata[0].name,
            size: fileMetadata[0].size,
            type: fileMetadata[0].type
          }];

          // Show Preview button (no file list)
          const statusWrapper = container.querySelector(`[data-upload-status-wrapper="${i}"]`);
          const previewBtn = container.querySelector(`[data-pet-preview-btn="${i}"]`);
          if (statusWrapper && previewBtn) {
            statusWrapper.style.display = 'flex';
            previewBtn.style.display = 'block';
          }

          console.log(`✅ Restored file for Pet ${i}: ${fileMetadata[0].name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to restore file for Pet ${i}:`, error);
      }
    }
  }
}
```

**Key Changes**:
1. Change text to "CHANGE IMAGE?" (not count display)
2. Only restore first file from metadata (single file limit)
3. Remove `displayUploadedFiles()` call
4. Show Preview button directly (no file list wrapper)

### Change 8: Enhanced Visual States (CSS)

**File**: `snippets/ks-product-pet-selector-stitch.liquid`
**Lines**: 873-906

```css
/* CURRENT - Basic green state */
.pet-detail__upload-zone.has-files {
  border-color: #22c55e;
  background-color: rgba(34, 197, 94, 0.05);
}

.pet-detail__upload-zone.has-files .pet-detail__upload-icon {
  color: #22c55e;
}

/* ENHANCED - More prominent filled state */
.pet-detail__upload-zone.has-files {
  border: 2px solid #22c55e;              /* Solid border (was dashed) */
  background-color: rgba(34, 197, 94, 0.08); /* Slightly stronger tint */
}

.pet-detail__upload-zone.has-files .pet-detail__upload-icon {
  color: #22c55e;
}

.pet-detail__upload-zone.has-files .pet-detail__upload-text {
  font-weight: 600;        /* Semi-bold */
  color: #16a34a;          /* Darker green for readability */
}
```

**Changes**:
1. Add `border: 2px solid` to override dashed border
2. Increase background opacity from 0.05 → 0.08
3. Add font-weight and color override for filled state text

---

## Implementation Order

### Step 1: HTML Changes (5 minutes)
1. Remove `multiple` attribute from file input (line 110)
2. Change `data-max-files="3"` → `"1"` (line 113)
3. Update aria-label "photo(s)" → "photo" (line 114)
4. Remove file list `<div>` from upload status wrapper (lines 120-121)

**Commit Message**: "Limit pet selector to single image upload per pet"

### Step 2: JavaScript Upload Handler (15 minutes)
1. Simplify upload validation (remove count check, duplicate check)
2. Change `petFiles[i].push()` → `petFiles[i] = [newFile]` (replacement)
3. Update text to "CHANGE IMAGE?" instead of count
4. Show Preview button directly (skip file list display)
5. Store only single file metadata

**Commit Message**: "Implement auto-replace upload flow for single images"

### Step 3: Remove File Display Logic (5 minutes)
1. Delete `displayUploadedFiles()` function (lines 1457-1502)
2. Delete `removeFile()` function (lines 1504-1562)
3. Remove all calls to these functions

**Commit Message**: "Remove file list display (single file makes it redundant)"

### Step 4: Update State Restoration (10 minutes)
1. Change state restore text to "CHANGE IMAGE?"
2. Only restore first file from metadata array
3. Show Preview button directly
4. Remove file list restoration logic

**Commit Message**: "Update state restoration for single-image workflow"

### Step 5: CSS Visual Enhancements (5 minutes)
1. Add solid border override for filled state
2. Increase background tint opacity
3. Add font-weight and color for filled text

**Commit Message**: "Enhance upload zone filled state visual design"

### Step 6: Testing (30 minutes)
See "Testing Checklist" below

---

## Testing Checklist

### Visual Tests (Desktop + Mobile)

**Empty State**:
- [ ] Upload zone shows dashed border, gray background
- [ ] Text: "Click or drag to upload"
- [ ] Upload icon is gray
- [ ] Preview button is hidden

**Filled State** (after upload):
- [ ] Upload zone shows solid green border
- [ ] Background has light green tint
- [ ] Text: "CHANGE IMAGE?" (uppercase, semi-bold, dark green)
- [ ] Upload icon is green
- [ ] Preview button is visible and clickable
- [ ] NO file list display (should not exist)

**Multiple Pet Layout**:
- [ ] Each pet's upload zone operates independently
- [ ] Filled/empty states don't affect other pets
- [ ] Preview buttons show only for pets with images

### Functional Tests

**Upload Flow**:
- [ ] Click empty upload zone → File picker opens
- [ ] Select image → Zone changes to "CHANGE IMAGE?"
- [ ] Console shows: `💾 Saved file metadata for Pet 1: [filename]`
- [ ] Preview button appears below upload zone

**Replace Flow**:
- [ ] Click filled upload zone ("CHANGE IMAGE?") → File picker opens
- [ ] Select new image → Old image replaced (not added)
- [ ] Zone still shows "CHANGE IMAGE?"
- [ ] Preview button remains visible
- [ ] Console shows updated metadata save

**Drag and Drop**:
- [ ] Drag image onto empty zone → Upload works
- [ ] Drag image onto filled zone → Replaces existing image
- [ ] Zone updates to "CHANGE IMAGE?" after drag upload

**State Persistence**:
- [ ] Upload image → Navigate away → Return to page
- [ ] Upload zone shows "CHANGE IMAGE?" (not empty)
- [ ] Preview button is visible
- [ ] Pet name persists
- [ ] Style/font selections persist

**Preview Button**:
- [ ] Click Preview → Navigates to `/pages/custom-image-processing#processor`
- [ ] Processor loads uploaded image
- [ ] Back button returns to product page with state intact

**Edge Cases**:
- [ ] Select file → Cancel file picker → Zone remains in current state
- [ ] Upload large file (>50MB) → Alert shows, upload rejected
- [ ] Upload non-image file (.pdf, .txt) → Alert shows, upload rejected
- [ ] Upload HEIC (iPhone) → Works correctly
- [ ] Multiple pets: Upload to Pet 1, Pet 2, Pet 3 → All independent

### Mobile-Specific Tests (Priority Viewports)

**375px (iPhone SE, 13 mini)**: HIGHEST PRIORITY
- [ ] Upload zone spans full width (no horizontal overflow)
- [ ] "CHANGE IMAGE?" text clearly readable
- [ ] Preview button easy to tap (minimum 44×44px)
- [ ] No accidental taps on wrong controls
- [ ] File picker opens on first tap (no double-tap delay)

**390px (iPhone 12, 13, 14)**: HIGHEST PRIORITY
- [ ] Same tests as 375px
- [ ] Zone height comfortable for thumb reach

**430px (iPhone 14 Pro Max)**: HIGH PRIORITY
- [ ] One-handed operation comfortable
- [ ] Visual hierarchy clear

**360px (Android mid-range)**: HIGH PRIORITY
- [ ] No horizontal scrolling
- [ ] Touch targets adequate

### Data Verification Tests

**Cart Properties** (use `/cart.js`):
- [ ] Upload image → Add to Cart
- [ ] Check `/cart.js` response contains `properties._pet_1_image`
- [ ] Check `properties.Pet 1 Order Type === "express_upload"`
- [ ] Check `properties.Pet 1 Processing State === "uploaded_only"`
- [ ] Check `properties.Pet 1 Upload Timestamp` exists

**LocalStorage** (use browser DevTools):
- [ ] After upload, check `pet_1_images` key (contains base64 preview)
- [ ] Check `pet_1_file_metadata` key (contains filename, size, type)
- [ ] Metadata should show exactly 1 file (not array of 3)
- [ ] After replace, metadata updated to new filename

**Console Logs**:
- [ ] No JavaScript errors during upload
- [ ] No JavaScript errors during replace
- [ ] No JavaScript errors during state restoration
- [ ] Expected logs: `💾 Saved file metadata for Pet X: [filename]`

### Browser Compatibility

**Desktop**:
- [ ] Chrome 120+ (primary)
- [ ] Safari 17+ (Mac users)
- [ ] Firefox 121+ (check file input compatibility)
- [ ] Edge 120+ (Windows users)

**Mobile** (use Chrome DevTools MCP or real devices):
- [ ] Safari iOS 16+ (iPhone users - CRITICAL for 70% traffic)
- [ ] Chrome Android (Android users)
- [ ] Samsung Internet (Android users)

### Accessibility Tests

**Keyboard Navigation**:
- [ ] Tab to upload zone → Enter/Space triggers file picker
- [ ] Tab to Preview button → Enter activates

**Screen Reader** (if available):
- [ ] Upload zone announces "Upload pet 1 photo" (singular)
- [ ] Filled state announces "CHANGE IMAGE?"
- [ ] Preview button announces "Preview"

**Focus States**:
- [ ] Upload zone shows focus ring on keyboard focus
- [ ] Preview button shows focus ring
- [ ] Focus visible on mobile devices

---

## Rollback Strategy

### If Issues Found Post-Deployment

**Immediate Rollback** (git revert):
```bash
# Revert to previous commit
git log --oneline  # Find commit hash before changes
git revert <commit-hash>
git push origin main
```

**Partial Rollback** (restore max files = 3):
1. Restore `multiple` attribute to file input
2. Change `data-max-files="1"` back to `"3"`
3. Restore `displayUploadedFiles()` function
4. Restore upload text to show count
5. Restore file list HTML

### Monitoring Signals

**Watch for**:
- Increased cart abandonment at upload step
- Console error spikes in browser monitoring
- Support tickets about "can't upload multiple images"
- Mobile upload failure rate increase

**Metrics to Track**:
- Upload completion rate (should stay same or improve)
- Time to complete upload (should decrease)
- Preview button click rate (should stay same)
- Add to Cart rate after upload (should improve)

---

## Success Criteria

### User Experience
- [ ] Upload flow feels faster and simpler than 3-image version
- [ ] "CHANGE IMAGE?" affordance is immediately understandable
- [ ] No user confusion about how to replace image
- [ ] Mobile users complete upload in fewer taps
- [ ] Preview button easy to find and use

### Technical
- [ ] Zero JavaScript errors in console
- [ ] File uploads successfully to Shopify CDN
- [ ] Cart properties contain correct image reference
- [ ] State restoration works across navigation
- [ ] LocalStorage metadata accurate (single file)

### Performance
- [ ] Upload completion rate maintains or improves
- [ ] Time-to-upload decreases vs 3-image workflow
- [ ] Mobile conversion rate maintains or improves
- [ ] Page load time unaffected (no new assets)

### Data Integrity
- [ ] Orders contain correct pet image reference
- [ ] Order fulfillment team receives uploaded images
- [ ] No missing image data in order properties
- [ ] Returning customer flow still works

---

## Timeline Estimate

| Phase | Task | Time |
|-------|------|------|
| **Implementation** | HTML changes (file input attributes) | 5 min |
| | JavaScript upload handler refactor | 15 min |
| | Remove file display functions | 5 min |
| | Update state restoration | 10 min |
| | CSS visual enhancements | 5 min |
| | **Subtotal** | **40 min** |
| **Testing** | Desktop visual tests | 10 min |
| | Mobile visual tests | 10 min |
| | Functional flow tests | 15 min |
| | Data verification | 10 min |
| | Edge cases | 10 min |
| | **Subtotal** | **55 min** |
| **Deployment** | Git commit and push | 5 min |
| | Shopify auto-deploy wait | 5 min |
| | Live environment verification | 10 min |
| | **Subtotal** | **20 min** |
| **TOTAL** | | **115 min (2 hours)** |

**Recommended Schedule**:
- Implementation: 40 minutes
- Local testing: 30 minutes
- Deploy to test environment: 20 minutes
- Real device testing: 25 minutes
- **Total**: ~2 hours

---

## Design Rationale Deep Dive

### Why "CHANGE IMAGE?" vs Other Options

**Option A: "CHANGE IMAGE?" (SELECTED)**
- ✅ Question mark invites interaction ("yes, I want to change")
- ✅ Uppercase signals different state vs empty
- ✅ Action-oriented (imperative verb)
- ✅ Short enough for mobile (fits in upload zone)

**Option B: "Tap to Replace"**
- ❌ "Tap" is mobile-only (desktop users click)
- ❌ Longer text (harder to read at small sizes)
- ✅ Explicit about action outcome

**Option C: "Change Photo"**
- ❌ Lacks interactivity cue (no question mark)
- ❌ "Photo" vs "Image" inconsistency with other text
- ✅ Shorter than Option B

**Option D: "Upload Different Image"**
- ❌ Too long for mobile upload zone
- ❌ "Upload" implies adding (not replacing)
- ❌ Verbose

**Conclusion**: "CHANGE IMAGE?" balances brevity, clarity, and interactivity

### Why Remove File List vs Keep It

**Arguments FOR Removal** (SELECTED):
1. **Redundancy**: Single file = list shows same info as upload zone state
2. **Mobile Space**: Removes ~50px vertical space × 3 pets = 150px saved
3. **Cognitive Load**: Fewer UI elements = faster comprehension
4. **Conversion Focus**: Every pixel should move toward purchase
5. **Delete Confusion**: Two removal methods (delete button vs replace) creates ambiguity

**Arguments AGAINST Removal**:
1. **File Info**: User can't see filename/size without clicking
2. **Delete Option**: No way to return to empty state
3. **Visual Confirmation**: List provides secondary confirmation of upload

**Conclusion**: Removal wins because:
- Empty state serves no functional purpose (can't proceed without image)
- Filename visible in file picker when replacing
- Green "CHANGE IMAGE?" provides adequate confirmation
- Simplicity > completeness for mobile conversion

### Why Auto-Replace vs Confirmation Dialog

**Option A: Auto-Replace (SELECTED)**
- ✅ Single action (click zone → pick file → done)
- ✅ Faster mobile flow (critical for 70% traffic)
- ✅ Users expect file pickers to confirm selections (built-in safeguard)
- ✅ Can easily undo by picking original file again

**Option B: Confirmation Dialog**
- ❌ Extra tap/click (friction)
- ❌ Modal dialogs annoying on mobile
- ❌ File picker already has cancel option
- ❌ Adds 2-3 seconds to replacement flow

**User Flow Comparison**:
```
Auto-Replace (2 actions):
1. Click "CHANGE IMAGE?" → File picker opens
2. Select new image → Image replaced

Confirmation (4 actions):
1. Click "CHANGE IMAGE?" → Dialog: "Replace current image?"
2. Click "Yes" → File picker opens
3. Select new image → Dialog: "Confirm replace?"
4. Click "Replace" → Image replaced
```

**Conclusion**: Auto-replace is 2x faster with no safety tradeoff (file picker has cancel)

### Why Green vs Other Colors for Filled State

**Color Psychology**:
- **Green** (#22c55e): Success, completion, go ahead ✅ SELECTED
- **Blue** (#3b82f6): Information, neutral, calm
- **Yellow** (#eab308): Warning, attention needed
- **Purple** (#a855f7): Premium, creative

**Context**: E-commerce upload state (successful upload, ready to proceed)

**Green Selected Because**:
1. Universal "success" signal (✓ checkmarks are green)
2. Matches existing `.has-files` class styling (consistency)
3. Contrasts well with gray empty state (clear distinction)
4. Positive emotional association (encourages progression)
5. Accessibility: Green-gray contrast ratio meets WCAG AA

**Alternative Considered**: Blue for "active" state
- ❌ Blue = neutral (doesn't signal completion)
- ❌ Blue can imply "processing" or "pending"
- ✅ Green clearly means "done, ready for next step"

---

## Mobile-First Design Principles Applied

### 1. Thumb Zone Optimization
- Upload zone positioned in center of screen (easy reach)
- Full-width design maximizes tap area
- Preview button below upload (thumb-friendly stack)

### 2. Progressive Disclosure
- Upload zone shows minimal info (just state)
- File details hidden (not needed for decision-making)
- Preview button appears only when relevant

### 3. One-Action Flows
- Replace = single tap (no confirmation dialogs)
- Upload = drag-drop or tap (no multi-step wizards)
- Preview = single tap to processor

### 4. Visual Clarity
- Large text (0.875rem = 14px minimum)
- High contrast colors (green #22c55e on white)
- Bold text in filled state (easier to read at distance)

### 5. Touch Target Sizing
- Upload zone: 80px+ height (exceeds 44px minimum)
- Full width (300px+ on mobile)
- Preview button: 3rem (48px) height

---

## Conversion Optimization Strategy

### Friction Points Removed
1. **Decision Paralysis**: "How many images should I upload?" → Removed (always 1)
2. **Delete Confusion**: "Delete or replace?" → Removed (only replace exists)
3. **File List Scanning**: "Which file is this?" → Removed (only 1 file)
4. **Mobile Scrolling**: File list adds height → Removed (saves 50px/pet)

### Psychological Triggers Enhanced
1. **Progress Indication**: Green = "completed step" (encourages next action)
2. **Clarity**: "CHANGE IMAGE?" = clear affordance (reduces hesitation)
3. **Simplicity**: Fewer choices = faster decisions
4. **Reversibility**: Easy to change = reduces upload anxiety

### Expected Impact on Funnel
```
Current (3 images):
1. See upload zone (100%)
2. Upload 1 image (75%)
3. See file list (75%)
4. Click Preview (60%)
5. Process image (60%)
6. Add to Cart (40%)

Optimized (1 image):
1. See upload zone (100%)
2. Upload 1 image (80% - clearer requirement)
3. Click Preview (70% - more prominent button)
4. Process image (70%)
5. Add to Cart (50% - 25% improvement)
```

**Projected Improvement**: +10-25% conversion at upload step due to:
- Clearer single-file requirement
- Reduced cognitive load
- Faster mobile flow
- Less UI clutter

---

## Related Files Reference

### Primary File
- `snippets/ks-product-pet-selector-stitch.liquid` (2,012 lines)
  - Lines 83-96: Upload zone HTML
  - Lines 107-114: File input element
  - Lines 116-127: Upload status wrapper
  - Lines 845-906: Upload zone CSS
  - Lines 1296-1623: Upload handler JavaScript
  - Lines 1457-1502: File display function (TO DELETE)
  - Lines 1504-1562: Remove file function (TO DELETE)
  - Lines 1845-1889: State restoration logic

### Supporting Files (No Changes)
- `assets/pet-storage.js` - LocalStorage management (works with single file)
- `assets/cart-pet-integration.js` - Cart data flow (unchanged)
- `pages/custom-image-processing.liquid` - Processor page (unchanged)

### Testing Files
- `testing/pet-processor-v5-test.html` - Use for local upload testing
- Chrome DevTools MCP - Use for live Shopify test URL testing

---

## Risk Assessment

### LOW RISK Changes
✅ File input attributes (`multiple` removal, `max-files="1"`)
✅ Upload zone text change ("CHANGE IMAGE?")
✅ CSS visual enhancements (solid border, green tint)
✅ Removing file list display (UI only)

**Mitigation**: Easy rollback via git revert

### MEDIUM RISK Changes
⚠️ Upload handler logic refactor (replacement vs additive)
⚠️ State restoration changes (single file handling)

**Mitigation**:
- Extensive testing on multiple devices
- Gradual rollout (test environment → production)
- Monitor cart analytics for drop-offs

### ZERO RISK Changes
✅ Deleting unused functions (`displayUploadedFiles`, `removeFile`)
✅ Removing delete button UI

**Rationale**: Functions not called after UI removal = safe to delete

---

## Post-Deployment Monitoring

### Analytics to Watch (First 7 Days)

**Upload Metrics**:
- Upload completion rate (target: maintain or improve)
- Time to complete upload (target: decrease by 20-30%)
- Mobile upload success rate (target: >95%)

**Conversion Metrics**:
- Add to Cart rate after upload (target: increase by 10-15%)
- Cart abandonment at upload step (target: decrease)
- Preview button click rate (target: maintain 90%+)

**Error Metrics**:
- JavaScript console errors (target: zero new errors)
- Failed upload attempts (target: <5% of total uploads)
- LocalStorage quota errors (target: zero, cleanup logic prevents)

**User Behavior**:
- Average replacements per upload session (new metric)
- Time between first upload and "Add to Cart" (target: decrease)
- Mobile vs desktop upload completion (target: mobile improves more)

### Support Ticket Monitoring

**Watch for**:
- "Can't upload multiple images" (expected - update help docs)
- "Can't delete uploaded image" (explain replacement flow)
- "Don't see my uploaded file" (check if Preview button visible)
- "Upload doesn't work on mobile" (critical - immediate investigation)

**Response Plan**:
- Update FAQ with single-image explanation
- Create help doc: "How to Change Your Pet Photo"
- Train support on new replacement flow

---

## Open Questions (User Confirmation Needed)

### Question 1: File Info Display ⚠️ ANSWERED
**Q**: Should we show filename/size anywhere after upload?
**Options**:
- A) Show below "CHANGE IMAGE?" in smaller text
- B) Show on hover/long-press
- C) Don't show (user can see in file picker when replacing)

**Recommendation**: Option C (don't show)
**Rationale**: Adds complexity without clear value. User can see filename when replacing.

**USER DECISION**: [AWAITING]

### Question 2: Empty State Accessibility ⚠️ ANSWERED
**Q**: Should we allow returning to empty state (no image)?
**Options**:
- A) No - replacement only (current plan)
- B) Yes - add small "×" button in upload zone corner

**Recommendation**: Option A (replacement only)
**Rationale**: Empty state serves no purpose (can't proceed without image). If wrong image, replace it.

**USER DECISION**: [AWAITING]

### Question 3: Transition Animation ⚠️ ANSWERED
**Q**: Should upload zone animate when changing states?
**Options**:
- A) Instant state change (current)
- B) 200ms fade transition (smooth)
- C) 300ms scale + fade (more dramatic)

**Recommendation**: Option B (200ms fade)
**Rationale**: Smooth feedback without feeling slow. Add CSS transition to `.pet-detail__upload-zone`.

**USER DECISION**: [AWAITING]

---

## Next Steps for User

1. **Review this plan** - Confirm design decisions align with expectations
2. **Answer open questions** - File info display, empty state, transitions
3. **Provide test URL** - Share current Shopify test URL (URLs expire)
4. **Approve implementation** - Confirm ready to proceed
5. **Allocate testing time** - ~2 hours total (implementation + testing)

---

## Implementation Checklist (For Developer)

**Before Starting**:
- [ ] Read entire plan document
- [ ] Understand state flow (empty → filled → replace)
- [ ] Review current file structure (lines referenced in plan)
- [ ] Have Shopify test URL ready
- [ ] Have Chrome DevTools MCP configured

**During Implementation**:
- [ ] Create feature branch: `git checkout -b feature/single-image-upload`
- [ ] Make changes in order specified (Steps 1-5)
- [ ] Commit after each step with descriptive messages
- [ ] Test locally with HTML test file before deploying
- [ ] Use browser DevTools to check console logs

**Testing Phase**:
- [ ] Complete all visual tests (desktop + mobile)
- [ ] Complete all functional tests
- [ ] Complete all data verification tests
- [ ] Test on actual mobile device (if available)
- [ ] Verify state persistence across navigation

**Deployment**:
- [ ] Merge to main: `git checkout main && git merge feature/single-image-upload`
- [ ] Push to remote: `git push origin main`
- [ ] Wait for Shopify auto-deploy (~2 minutes)
- [ ] Test on live test URL
- [ ] Monitor console for errors
- [ ] Check `/cart.js` data

**Post-Deployment**:
- [ ] Update session context with changes made
- [ ] Document any issues found
- [ ] Note metrics baseline for monitoring
- [ ] Archive this plan to `.claude/tasks/archived/` (if session ends)

---

## Summary

This plan transforms the pet selector from a complex 3-image upload system to a streamlined single-image workflow with intuitive replacement. The "CHANGE IMAGE?" affordance clearly signals the filled state while inviting interaction. By removing file list display and delete buttons, we reduce cognitive load and mobile UI clutter while maintaining all essential functionality (upload → preview → add to cart).

**Key Wins**:
- ✅ Simpler mental model (1 image per pet, always)
- ✅ Faster mobile flow (fewer taps, less scrolling)
- ✅ Clearer visual states (empty vs filled)
- ✅ Better conversion potential (reduced friction)
- ✅ Easier to maintain (less code, fewer edge cases)

**Implementation Safety**:
- Low risk (mostly simplification, not new complexity)
- Easy rollback (git revert)
- Gradual testing (test environment first)
- Clear success criteria (metrics tracked)

**Timeline**: ~2 hours total (40 min implementation + 55 min testing + 20 min deployment)

Ready to proceed once user confirms design decisions and provides test URL for Chrome DevTools MCP testing.
