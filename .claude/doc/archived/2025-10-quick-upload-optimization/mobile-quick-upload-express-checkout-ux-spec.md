# Mobile-Native Quick Upload UX Specification
**Mobile Commerce Architect | Express Checkout Design**
**Date:** 2025-10-20
**Project:** Perkie Prints - Scenario 3 Quick Upload (Express Path)
**Target:** 70% Mobile Traffic | 25% Express Buyer Segment
**Priority:** P0 - Critical Conversion Optimization

---

## Executive Summary

This specification defines a mobile-optimized **Quick Upload** user experience for express checkout customers who want to upload pet photos WITHOUT waiting for 3-11s AI processing. The design prioritizes **conversion velocity** over preview quality, enabling customers to reach checkout in ~5 seconds instead of 18+ seconds.

**Core Design Philosophy:**
> "Capture the sale now, perfect the product later"

**User Value Proposition:**
- Upload pet photo in 2-3 seconds
- Enter pet name in 2-3 seconds
- Add to cart immediately (no waiting)
- Order ships after approval via email

**Business Impact:**
- +25% conversion rate for express buyers
- -67% time to checkout (18s → 5s)
- Captures mobile users on poor networks
- Reduces cart abandonment from processing delays

---

## 1. Mobile Interaction Flow Architecture

### 1.1 Entry Point Decision Tree

```
Product Page Load (Mobile)
│
├─ Has saved pet in localStorage? (<60 days old)
│  ├─ YES → Show Scenario 2A: One-Click Selection (Instant)
│  │        User sees: "✅ Bella selected - Ready to order!"
│  │        Action: Add to Cart button ENABLED immediately
│  │
│  └─ NO → Show Upload Options
│           └─ User taps "Add Your Pet Photo" button
│                   ↓
│              Bottom Sheet Appears
│              ┌────────────────────────────────────┐
│              │  How would you like to add your    │
│              │  pet photo?                        │
│              │                                    │
│              │  [📸 Quick Add (30 sec)]          │ ← Scenario 3 (THIS SPEC)
│              │  Skip preview - Add to cart now   │
│              │                                    │
│              │  [🎨 Preview Styles (1 min)]      │ ← Scenario 1
│              │  See 4 professional effects       │
│              │                                    │
│              │  [🔄 I've Ordered Before]         │ ← Scenario 2B
│              │  Retrieve my previous pet photo   │
│              └────────────────────────────────────┘
```

**Design Rationale:**
- Bottom sheet is thumb-zone optimized (within 72px of bottom)
- Clear time expectations ("30 sec" vs "1 min")
- Visual icons for quick scanning
- Primary action (Quick Add) listed first for express buyers
- Non-modal (swipe down to dismiss)

---

### 1.2 Quick Upload Flow (Scenario 3 Detailed)

```
Step 1: User taps "Quick Add (30 sec)"
    ↓
Step 2: Native file picker opens
    - Camera option appears first (capture="environment")
    - Gallery option available as fallback
    - Multi-select enabled (multiple="true" if max_pets > 1)
    ↓
Step 3: User selects 1-3 photos
    ↓
Step 4: File validation (client-side)
    - Check: File type (image/*)
    - Check: File size (max 50MB per file)
    - Check: Number of files (max 3 per product)
    ↓ [PASS] ↓
Step 5: Inline modal appears - Pet Name Capture
    ┌────────────────────────────────────┐
    │  Add Your Pet                      │
    │                                    │
    │  📷 Bella_dog.jpg (2.3 MB)        │
    │  📷 Milo_cat.jpg (1.8 MB)         │
    │                                    │
    │  What are your pets' names?       │
    │  ┌──────────────────────────────┐ │
    │  │ Bella, Milo                  │ │ ← Auto-focus, mobile keyboard
    │  └──────────────────────────────┘ │
    │  (Separate multiple names with commas) │
    │                                    │
    │  [Cancel]     [Quick Add to Cart] │ ← 48px tap targets
    └────────────────────────────────────┘
    ↓
Step 6: User taps "Quick Add to Cart"
    ↓
Step 7: Upload Progress Indicator (GCS upload ~1-3s)
    ┌────────────────────────────────────┐
    │  Uploading your pets...            │
    │                                    │
    │  ▓▓▓▓▓▓▓▓▓▓░░░░░░ 2 of 2          │ ← Progress bar
    │                                    │
    │  Bella.jpg ✓ (1.2s)                │
    │  Milo.jpg ⏳ Uploading...           │
    │                                    │
    │  ⚠ Don't close this window         │
    └────────────────────────────────────┘
    ↓
Step 8: Upload success + Cart integration
    ┌────────────────────────────────────┐
    │  ✅ 2 Pets Added!                  │
    │                                    │
    │  [✓] Bella                         │ ← Thumbnail previews
    │  [✓] Milo                          │
    │                                    │
    │  We'll email you a preview for    │
    │  approval before shipping.        │
    │                                    │
    │  [View Cart] or [Continue Shopping]│
    └────────────────────────────────────┘
    ↓
Step 9: Add to Cart button ENABLED
    - Form fields populated:
      * _pet_name: "Bella, Milo"
      * _original_image_url: GCS URL
      * _processing_state: "uploaded_only"
      * _has_custom_pet: "true"
    - Button text changes: "Add to Cart" (enabled)
    - Background processing starts (async)
    ↓
Step 10: User completes checkout normally
    - Order placed with pending images
    - Background AI job processes images (3-11s)
    - Email sent when preview ready (~5 min)
    - Customer approves via email link
```

**Time Breakdown:**
- File selection: 2-3s (user time)
- File validation: <100ms
- Pet name entry: 2-3s (user time)
- GCS upload: 1-3s (2MB file on 4G)
- Form population: <50ms
- **Total: ~5 seconds to cart-enabled state**

---

## 2. Mobile UI Components

### 2.1 Upload Options Bottom Sheet

**Component:** `UploadOptionsBottomSheet`

**Visual Design:**
```
┌──────────────────────────────────────┐ ← Screen edge
│ Home                       [×]        │
│                                      │
│ ────────────────────────────────────│ ← Drag handle
│ How would you like to add your pet? │
│ (Choose one to get started)         │
│                                      │
│ ┌──────────────────────────────────┐│
│ │ 📸 Quick Add (30 sec)            ││ ← Primary action
│ │                                  ││
│ │ Upload photo • Skip preview      ││
│ │ Add to cart now                  ││
│ │                                  ││
│ │ ✓ Fastest checkout               ││
│ │ ✓ Approve via email before ship  ││
│ └──────────────────────────────────┘│
│                                      │
│ ┌──────────────────────────────────┐│
│ │ 🎨 Preview Styles (1 min)        ││ ← Secondary action
│ │                                  ││
│ │ See 4 professional effects       ││
│ │ Choose your favorite style       ││
│ │                                  ││
│ │ ✓ Full AI preview                ││
│ │ ✓ Select before checkout         ││
│ └──────────────────────────────────┘│
│                                      │
│ ┌──────────────────────────────────┐│
│ │ 🔄 I've Ordered Before           ││ ← Tertiary action
│ │                                  ││
│ │ Enter your order number to       ││
│ │ retrieve your previous pet photo ││
│ └──────────────────────────────────┘│
│                                      │
│ [Cancel]                             │ ← Thumb zone
└──────────────────────────────────────┘
```

**Technical Specs:**
- **Height**: 60-70% of viewport (dynamic)
- **Animation**: Slide up with spring physics (300ms)
- **Backdrop**: Semi-transparent black (opacity: 0.4)
- **Drag Handle**: 48px x 4px rounded bar (visual affordance)
- **Tap Targets**: Min 48px x 48px (Android) / 44px x 44px (iOS)
- **Dismiss Actions**:
  - Tap backdrop
  - Swipe down on sheet
  - Tap [Cancel] button
  - Tap [×] button (top right)

**Accessibility:**
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby="upload-options-title"`
- Focus trap within sheet
- Escape key to dismiss (keyboard users)

**Mobile Optimizations:**
- **Thumb Zone Placement**: Primary action at bottom
- **Touch Feedback**: 100ms press state with scale(0.98)
- **Scroll Behavior**: Sheet scrollable if content overflows
- **Safe Area**: Respects iOS notch/home indicator
- **Haptic Feedback**: Light tap on open (iOS)

**States:**
1. **Hidden** (default)
2. **Sliding In** (animation)
3. **Open** (interactive)
4. **Sliding Out** (animation)
5. **Closed** (removed from DOM)

---

### 2.2 Pet Name Capture Modal

**Component:** `PetNameCaptureModal`

**Single Pet Entry:**
```
┌────────────────────────────────────┐
│  Add Your Pet                 [×]  │
│                                    │
│  📷 Bella_dog.jpg                  │
│  2.3 MB • Ready to upload          │
│                                    │
│  What's your pet's name?           │
│  ┌──────────────────────────────┐ │
│  │ [Bella________________]       │ │ ← Auto-focus, native keyboard
│  └──────────────────────────────┘ │
│  Required for personalization     │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ [Want to see styles first?]  │ │ ← Quick escape hatch
│  └──────────────────────────────┘ │
│                                    │
│  [Cancel]     [Quick Add to Cart] │ ← Primary action (green)
└────────────────────────────────────┘
```

**Multi-Pet Entry (2-3 pets):**
```
┌────────────────────────────────────┐
│  Add Your Pets (2 selected)  [×]  │
│                                    │
│  📷 Dog_photo.jpg                  │
│  📷 Cat_photo.jpg                  │
│                                    │
│  What are your pets' names?        │
│  ┌──────────────────────────────┐ │
│  │ [Bella, Milo______________]   │ │ ← Comma-separated input
│  └──────────────────────────────┘ │
│  Separate multiple names with commas │
│                                    │
│  Example: "Bella, Milo, Max"       │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ [Want to see styles first?]  │ │
│  └──────────────────────────────┘ │
│                                    │
│  [Cancel]     [Quick Add to Cart] │
└────────────────────────────────────┘
```

**Technical Specs:**
- **Size**: 90% width, auto height (centered)
- **Animation**: Fade + scale from 0.95 to 1.0 (200ms)
- **Backdrop**: Semi-transparent black (opacity: 0.6)
- **Input Auto-focus**: Triggers keyboard immediately
- **Input Type**: `text` with `autocapitalize="words"`
- **Input Validation**:
  - Required: true
  - Max length: 100 chars
  - Pattern: `[A-Za-z0-9, \-']+` (letters, numbers, comma, hyphen, apostrophe)
  - Sanitization: Remove special chars, trim whitespace
- **Keyboard Type**: Default text keyboard (mobile)

**Multi-Pet Logic:**
- Detect comma-separated names on submit
- Count names vs file count
- If mismatch:
  - **More names than files**: Show warning "You uploaded 2 photos but entered 3 names. Please match the count."
  - **Fewer names than files**: Show warning "You uploaded 3 photos but only entered 2 names. Add one more."
  - **Match**: Proceed to upload

**Error States:**
```
┌────────────────────────────────────┐
│  Add Your Pet                 [×]  │
│                                    │
│  📷 Bella_dog.jpg                  │
│                                    │
│  What's your pet's name?           │
│  ┌──────────────────────────────┐ │
│  │ [___________________________] │ │
│  └──────────────────────────────┘ │
│  ❌ Pet name is required           │ ← Error message (red)
│                                    │
│  [Cancel]     [Quick Add to Cart] │ ← Button disabled until valid
└────────────────────────────────────┘
```

**Accessibility:**
- `role="dialog"`
- `aria-labelledby="pet-name-modal-title"`
- Input has `aria-describedby` pointing to help text
- Error messages use `aria-live="polite"`
- Focus returns to trigger button on close

**Mobile Optimizations:**
- **Fixed Positioning**: Prevents scroll during modal
- **Viewport Lock**: `body { overflow: hidden }` when open
- **Input Zoom Prevention**: `font-size: 16px` (iOS Safari)
- **Safe Area Padding**: Bottom padding for iOS home indicator
- **Keyboard Overlap**: Modal shifts up when keyboard appears

---

### 2.3 Upload Progress Indicator

**Component:** `UploadProgressIndicator`

**Single File Upload:**
```
┌────────────────────────────────────┐
│  Uploading your pet...             │
│                                    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 75%            │ ← Animated progress bar
│                                    │
│  📷 Bella_dog.jpg                  │
│  ⏳ 1.2 MB of 2.3 MB               │
│                                    │
│  ⚠ Keep this window open           │
└────────────────────────────────────┘
```

**Multi-File Upload:**
```
┌────────────────────────────────────┐
│  Uploading your pets...            │
│                                    │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░ 2 of 3          │ ← File count progress
│                                    │
│  📷 Bella_dog.jpg ✅ (1.2s)        │ ← Completed
│  📷 Milo_cat.jpg ⏳ 45%            │ ← In progress
│  📷 Max_dog.jpg ⏸ Queued           │ ← Waiting
│                                    │
│  ⚠ Keep this window open           │
└────────────────────────────────────┘
```

**Technical Specs:**
- **Layout**: Full-screen overlay (blocks interaction)
- **Progress Bar**:
  - Height: 8px
  - Border-radius: 4px
  - Animation: Smooth transition (200ms)
  - Color: Primary brand green (#4CAF50)
- **Update Frequency**: Every 200ms (prevents janky animation)
- **Progress Calculation**:
  - Single file: `(loaded / total) * 100`
  - Multi-file: `(completedFiles / totalFiles) * 100`

**Upload States:**
1. **Queued** (`⏸ Queued`) - Waiting in upload queue
2. **Uploading** (`⏳ 45%`) - Active upload with percentage
3. **Completed** (`✅ 1.2s`) - Success with upload time
4. **Failed** (`❌ Retry`) - Error with retry button

**Error Recovery:**
```
┌────────────────────────────────────┐
│  Upload failed                     │
│                                    │
│  📷 Bella_dog.jpg ✅ (1.2s)        │
│  📷 Milo_cat.jpg ❌ Network error  │
│  📷 Max_dog.jpg ⏸ Queued           │
│                                    │
│  [Try Again] or [Cancel Upload]    │
└────────────────────────────────────┘
```

**Network Handling:**
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Timeout**: 30s per file
- **Resume Support**: Chunked upload with resumable session
- **Offline Detection**: Show clear message if network unavailable

**Accessibility:**
- `role="status"`
- `aria-live="polite"` for progress updates
- `aria-busy="true"` during upload
- Screen reader announces percentage every 25%

---

### 2.4 Success Toast Notification

**Component:** `SuccessToast`

**Visual Design:**
```
┌────────────────────────────────────┐
│  ✅ 2 Pets Added!                  │ ← Auto-dismiss in 5s
│                                    │
│  [✓] Bella  [✓] Milo               │ ← Thumbnail previews
│                                    │
│  We'll email you a preview before  │
│  shipping. Check your inbox!       │
│                                    │
│  [View Cart]  [×]                  │ ← Optional action
└────────────────────────────────────┘
```

**Technical Specs:**
- **Position**: Bottom of screen (above safe area)
- **Animation In**: Slide up + fade (300ms ease-out)
- **Animation Out**: Slide down + fade (300ms ease-in)
- **Auto-dismiss**: 5 seconds
- **Manual Dismiss**: Tap [×] or swipe down
- **Stacking**: Max 3 toasts, oldest dismissed first
- **Haptic Feedback**: Success vibration pattern (iOS)

**States:**
1. **Success** (green background)
2. **Warning** (yellow background)
3. **Error** (red background)
4. **Info** (blue background)

**Content Variations:**
- Single pet: "✅ Bella Added!"
- Multi-pet: "✅ 2 Pets Added! (Bella, Milo)"
- Background processing: "⚙️ Processing in background..."
- Processing complete: "✅ Preview ready! Check your email."

**Accessibility:**
- `role="status"`
- `aria-live="polite"`
- `aria-atomic="true"`
- Focus management on dismiss

---

## 3. Multi-File Upload UX Patterns

### 3.1 Upload Count Strategy

**Question:** How many files should user upload if they enter "Bella, Milo" (2 pets)?

**Answer:** **OPTION C** - Open native picker with `multiple` attribute, let user select any count, then validate.

**Rationale:**
1. **Native UX Familiarity**: Users understand native file pickers (gallery selection)
2. **Flexibility**: Some users might upload 1 group photo of 2 pets
3. **Error Prevention**: Validation happens AFTER selection (clear error messaging)
4. **Mobile Pattern**: Standard mobile pattern (Photos app multi-select)

**Implementation:**
```html
<!-- File input with multi-select -->
<input
  type="file"
  accept="image/*"
  capture="environment"
  multiple
  id="quick-upload-input"
  data-max-files="3"
  style="display: none;">
```

**Validation Flow:**
```javascript
function handleFileSelection(files) {
  const maxFiles = parseInt(petSelector.dataset.maxPets) || 1;

  // Validation: Too many files
  if (files.length > maxFiles) {
    showErrorToast(`You can only upload ${maxFiles} photo(s) for this product.`);
    return;
  }

  // Validation: File size (max 50MB per file)
  for (let file of files) {
    if (file.size > 50 * 1024 * 1024) {
      showErrorToast(`${file.name} is too large. Max 50MB per file.`);
      return;
    }
  }

  // Validation: File type
  for (let file of files) {
    if (!file.type.startsWith('image/')) {
      showErrorToast(`${file.name} is not an image file.`);
      return;
    }
  }

  // All validations passed - show pet name modal
  showPetNameModal(files);
}
```

---

### 3.2 Name-to-File Matching

**Scenario:** User uploads 2 files, enters "Bella, Milo, Max" (3 names)

**Error Handling:**
```
┌────────────────────────────────────┐
│  Name Count Mismatch          [×]  │
│                                    │
│  ❌ You uploaded 2 photos but      │
│     entered 3 names.               │
│                                    │
│  📷 Dog_photo1.jpg                 │
│  📷 Dog_photo2.jpg                 │
│                                    │
│  Names entered: Bella, Milo, Max   │
│                                    │
│  Please either:                    │
│  • Add 1 more photo                │
│  • Remove "Max" from names         │
│                                    │
│  [Fix Names]  [Upload More Photos] │
└────────────────────────────────────┘
```

**Name Matching Logic:**
```javascript
function validateNameFileMatch(files, petNamesString) {
  const petNames = petNamesString
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);

  // Perfect match - proceed
  if (files.length === petNames.length) {
    return { valid: true };
  }

  // Mismatch - show error
  return {
    valid: false,
    fileCount: files.length,
    nameCount: petNames.length,
    message: `You uploaded ${files.length} photo(s) but entered ${petNames.length} name(s). Please match the count.`
  };
}
```

**Recovery Actions:**
1. **Fix Names** → Re-opens pet name modal with current input pre-filled
2. **Upload More Photos** → Re-opens file picker, appends to existing files
3. **Remove Photos** → Shows photo list with [×] buttons to remove files

---

### 3.3 Multi-Pet Progress States

**Upload Sequence:**
```
File 1: Bella_dog.jpg (2.3 MB)
File 2: Milo_cat.jpg (1.8 MB)
File 3: Max_dog.jpg (3.1 MB)

Sequential Upload Strategy (NOT parallel):
1. Upload Bella_dog.jpg → Complete (1.5s)
2. Upload Milo_cat.jpg → Complete (1.2s)
3. Upload Max_dog.jpg → Complete (2.1s)

Total: ~5s on 4G LTE
```

**Why Sequential?**
- Simpler progress tracking
- More reliable on poor networks
- Prevents API rate limiting
- Better error isolation
- Predictable completion order

**Alternative: Parallel Upload (for future optimization)**
- Upload all 3 simultaneously
- Faster on good networks (~2s total)
- More complex error handling
- Risk: One failure doesn't block others

---

## 4. Progress & Feedback States

### 4.1 State Machine

```
State: IDLE (Initial)
  ↓ User taps "Add Your Pet Photo"
State: OPTIONS_SHOWN
  ↓ User taps "Quick Add"
State: FILE_PICKER_OPEN
  ↓ User selects file(s)
State: VALIDATING_FILES
  ↓ Validation passes
State: NAME_CAPTURE_SHOWN
  ↓ User enters name + taps "Quick Add to Cart"
State: UPLOADING (substates: QUEUED, ACTIVE, COMPLETED, FAILED)
  ↓ All uploads complete
State: SYNCING_TO_CART
  ↓ Form fields populated
State: SUCCESS
  ↓ Toast shown + dismissed
State: IDLE (Ready for next action)
```

**Error States:**
- `FILE_VALIDATION_FAILED` → Show error toast → Return to OPTIONS_SHOWN
- `UPLOAD_FAILED` → Show retry UI → Allow manual retry or cancel
- `NETWORK_OFFLINE` → Show offline warning → Disable upload buttons

---

### 4.2 Loading States

**Micro-interactions:**

1. **Button Press (Immediate Feedback)**
   ```
   Touch down → scale(0.98) + opacity(0.8)
   Touch up → scale(1.0) + opacity(1.0)
   Duration: 100ms
   ```

2. **File Selection (System Delay)**
   ```
   File picker opens → No loader (native UI handles)
   File picker closes → Show "Processing..." for 200-500ms
   ```

3. **Upload Progress (Network Delay)**
   ```
   0-25%: "Starting upload..."
   25-75%: "Uploading... [progress bar]"
   75-100%: "Finishing up..."
   Complete: "✅ Uploaded!" (500ms) → Fade out
   ```

4. **Cart Sync (Fast Operation)**
   ```
   Show: "Adding to cart..." (spinner)
   Duration: <500ms typical
   Complete: "✅ Added!" (toast)
   ```

---

### 4.3 Success Feedback

**Visual:**
- ✅ Green checkmark icon
- Success toast with pet names
- Thumbnail previews of uploaded images
- "View Cart" button (optional CTA)

**Haptic:**
- iOS: Success notification (medium impact)
- Android: Success vibration (50ms)

**Audio:**
- None (avoid interrupting user)

**Persistent:**
- Pet selector widget updates with uploaded pets
- Add to Cart button enabled (color change)
- Pet thumbnails visible in product page

**Example Success State:**
```
Product Page (After Upload)
┌────────────────────────────────────┐
│  Your Pets (2/3)                   │ ← Updated count
│                                    │
│  ┌──────┐  ┌──────┐               │
│  │ [B] │  │ [M] │                │ ← Thumbnails
│  │ Bella│  │ Milo │                │
│  └──────┘  └──────┘               │
│  Processing... Preview via email   │
│                                    │
│  [Add Another Pet] (1 slot left)   │
│                                    │
│  [Add to Cart] ← ENABLED (green)   │
└────────────────────────────────────┘
```

---

## 5. Error Handling & Recovery

### 5.1 Error Taxonomy

**Client-Side Errors (Immediate):**

| Error | Cause | Message | Recovery |
|-------|-------|---------|----------|
| File too large | File > 50MB | "Photo is too large. Max 50MB per file." | Re-select smaller file |
| Wrong file type | Not image/* | "Please select an image file (JPG, PNG, HEIC)." | Re-select valid file |
| Too many files | Files > max_pets | "You can only upload 3 photos for this product." | Remove files or deselect |
| Empty pet name | Name field blank | "Pet name is required for personalization." | Enter name |
| Name mismatch | Names ≠ files | "You uploaded 2 photos but entered 3 names." | Fix names or files |

**Network Errors (During Upload):**

| Error | Cause | Message | Recovery |
|-------|-------|---------|----------|
| Network offline | No connection | "No internet connection. Check your network." | Auto-retry when online |
| Upload timeout | Request > 30s | "Upload is taking too long. Try again." | Manual retry button |
| Server error | API returns 500 | "Something went wrong. Please try again." | Manual retry button |
| Rate limit | Too many requests | "Please wait a moment and try again." | Auto-retry after 5s |

**Storage Errors (Rare):**

| Error | Cause | Message | Recovery |
|-------|-------|---------|----------|
| localStorage full | Storage quota exceeded | "Storage full. Please clear old pet photos." | Show cleanup UI |
| GCS upload fails | Bucket unavailable | "Cloud upload failed. Retrying..." | Auto-retry 3x |

---

### 5.2 Retry Strategies

**Automatic Retry (Network Errors):**
```javascript
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

async function uploadWithRetry(file, petId, attemptNumber = 0) {
  try {
    const result = await uploadToGCS(file, petId);
    return result;
  } catch (error) {
    if (attemptNumber < MAX_RETRIES) {
      // Show retry notification
      showRetryToast(`Retrying upload... (${attemptNumber + 1}/${MAX_RETRIES})`);

      // Wait before retry
      await sleep(RETRY_DELAYS[attemptNumber]);

      // Recursive retry
      return uploadWithRetry(file, petId, attemptNumber + 1);
    } else {
      // Max retries exceeded
      throw new Error('Upload failed after 3 attempts');
    }
  }
}
```

**Manual Retry (User-Triggered):**
```
┌────────────────────────────────────┐
│  Upload Failed                     │
│                                    │
│  ❌ Network error after 3 attempts │
│                                    │
│  📷 Bella_dog.jpg ✅               │
│  📷 Milo_cat.jpg ❌ Failed         │
│                                    │
│  [Try Again] or [Upload Later]     │
└────────────────────────────────────┘
```

**Partial Success Handling:**
```javascript
// If 2 of 3 files uploaded successfully
function handlePartialSuccess(uploadResults) {
  const successfulUploads = uploadResults.filter(r => r.success);
  const failedUploads = uploadResults.filter(r => !r.success);

  if (successfulUploads.length > 0 && failedUploads.length > 0) {
    showWarningToast(
      `${successfulUploads.length} of ${uploadResults.length} pets uploaded. ` +
      `Retry failed uploads?`
    );

    // Offer to retry only failed files
    showRetryButton(() => {
      const failedFiles = failedUploads.map(r => r.file);
      retryUploadFiles(failedFiles);
    });
  }
}
```

---

### 5.3 Offline Mode

**Detection:**
```javascript
// Check connection status
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

function handleOffline() {
  // Disable upload buttons
  disableQuickUploadButtons();

  // Show offline banner
  showOfflineBanner('No internet connection. Uploads disabled.');

  // Pause active uploads (if resumable)
  pauseActiveUploads();
}

function handleOnline() {
  // Re-enable upload buttons
  enableQuickUploadButtons();

  // Hide offline banner
  hideOfflineBanner();

  // Resume paused uploads
  resumePausedUploads();
}
```

**Offline UI:**
```
┌────────────────────────────────────┐
│  ⚠ No Internet Connection          │ ← Sticky banner
│  Uploads disabled until reconnected│
└────────────────────────────────────┘

Product Page
┌────────────────────────────────────┐
│  Your Pets (0/3)                   │
│                                    │
│  [Add Your Pet Photo] ← DISABLED   │ ← Grayed out
│  (grey, with offline icon)         │
│                                    │
│  ⚠ Connect to internet to upload   │
└────────────────────────────────────┘
```

---

### 5.4 Graceful Degradation

**Poor Network (3G/2G):**
- Show longer upload estimates ("~10-15 seconds")
- Compress images client-side before upload (reduce size 40-60%)
- Disable multi-file upload (force 1 file at a time)
- Show "Slow connection detected" warning

**Older Browsers (No ES6):**
- Use ES5 transpiled version of quick-upload-handler.js
- Polyfill Promise, fetch, FormData
- Fallback to XMLHttpRequest for uploads
- Disable advanced animations (use simple opacity transitions)

**Insufficient Storage:**
```
┌────────────────────────────────────┐
│  Storage Full                      │
│                                    │
│  You have 42 saved pet photos.     │
│  Remove old photos to upload new.  │
│                                    │
│  [Manage Saved Pets]               │
└────────────────────────────────────┘
```

---

## 6. Performance Optimization

### 6.1 Target Metrics

**Time to Cart Enable (Critical):**
- **Target:** < 5 seconds (from upload tap to cart button enabled)
- **Critical:** < 8 seconds
- **Breakdown:**
  - File selection: 2-3s (user time)
  - Name capture: 2-3s (user time)
  - GCS upload: 1-3s (network)
  - Form sync: <100ms (JS)

**Network Performance:**
| Network | File Size | Upload Time | Total to Cart |
|---------|-----------|-------------|---------------|
| Fast 4G (20 Mbps) | 2MB | ~1s | ~5s ✅ |
| Slow 4G (4 Mbps) | 2MB | ~4s | ~8s ⚠️ |
| Fast 3G (1.6 Mbps) | 2MB | ~10s | ~14s ❌ |

**Client-Side Optimizations:**

1. **Image Compression (Before Upload)**
   ```javascript
   async function compressImage(file, maxWidth = 1200, quality = 0.8) {
     // Compress to max 1200px width, 80% quality
     // Typical reduction: 3MB → 800KB (73% savings)
     const compressed = await imageCompression(file, {
       maxWidthOrHeight: maxWidth,
       useWebWorker: true,
       quality: quality
     });
     return compressed;
   }
   ```
   **Impact:** 3MB file → 800KB = ~70% faster upload

2. **Lazy Load Quick Upload Module**
   ```javascript
   // Only load quick-upload-handler.js when user taps "Add Pet Photo"
   async function loadQuickUploadModule() {
     if (!window.QuickUploadHandler) {
       await import('/assets/quick-upload-handler.js');
     }
     return window.QuickUploadHandler;
   }
   ```
   **Impact:** -8KB from initial page load

3. **Thumbnail Generation (Client-Side)**
   ```javascript
   async function generateThumbnail(file, size = 200) {
     // Generate 200x200 thumbnail for UI preview
     // Avoids re-downloading full image from GCS
     const thumbnail = await createThumbnail(file, size, 0.6);
     return thumbnail;
   }
   ```
   **Impact:** 200KB thumbnail vs 3MB full image = 15x faster

---

### 6.2 Network Optimization

**Chunked Upload (for large files > 5MB):**
```javascript
async function uploadLargeFile(file, petId) {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Create resumable upload session
  const sessionUrl = await initializeUploadSession(petId, file.name);

  // Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    await uploadChunk(sessionUrl, chunk, i, totalChunks);

    // Update progress
    const progress = ((i + 1) / totalChunks) * 100;
    updateProgressBar(progress);
  }

  // Finalize upload
  const gcsUrl = await finalizeUpload(sessionUrl);
  return gcsUrl;
}
```

**Benefits:**
- Resume after network interruption
- Better progress tracking
- Handles large files (10MB+) reliably

**Connection Pooling:**
```javascript
// Reuse HTTP connections for multiple uploads
const uploadClient = axios.create({
  baseURL: 'https://storage.googleapis.com',
  timeout: 30000,
  maxRedirects: 0,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});
```

---

### 6.3 Mobile-Specific Optimizations

**iOS Safari:**
- Use `input[type=file]` with `capture="environment"` for camera
- Avoid HEIC files (convert to JPEG client-side)
- Handle iOS 13+ file size limits (check `File.size`)
- Prevent zoom on input focus (`font-size: 16px`)

**Android Chrome:**
- Enable `accept="image/*"` for gallery access
- Support WebP format (lighter than JPEG)
- Handle permission prompts gracefully
- Test on low-end devices (Samsung A series)

**Responsive Images:**
```html
<!-- Serve different image sizes based on viewport -->
<picture>
  <source media="(max-width: 480px)"
          srcset="thumbnail-small.jpg">
  <source media="(max-width: 768px)"
          srcset="thumbnail-medium.jpg">
  <img src="thumbnail-large.jpg" alt="Pet preview">
</picture>
```

**Touch Performance:**
- Use `passive: true` for scroll listeners
- Debounce touch events (prevent double-tap)
- Use CSS `contain` property for layout optimization
- Enable GPU acceleration (`will-change: transform`)

---

## 7. Accessibility Requirements

### 7.1 WCAG 2.1 AA Compliance

**Keyboard Navigation:**
- All interactive elements focusable with Tab
- Logical tab order (top to bottom, left to right)
- Visible focus indicators (2px outline)
- Escape key closes modals
- Enter key submits forms

**Screen Reader Support:**
- Semantic HTML (`<button>`, `<input>`, `<label>`)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic updates
- ARIA busy states during loading
- Alt text for all images

**Color Contrast:**
- Text: Min 4.5:1 ratio (WCAG AA)
- Interactive elements: Min 3:1 ratio
- Error messages: Red with icon (not color alone)
- Success states: Green with icon

**Touch Targets:**
- Minimum 44x44px (iOS) / 48x48px (Android)
- Adequate spacing (8px minimum between targets)
- Large tap areas for primary actions

**Form Accessibility:**
```html
<label for="pet-name-input">
  Pet Name <span class="required">*</span>
</label>
<input
  type="text"
  id="pet-name-input"
  name="pet_name"
  required
  aria-required="true"
  aria-describedby="pet-name-help"
  aria-invalid="false">
<small id="pet-name-help" class="form-help">
  Required for personalization
</small>

<!-- Error state -->
<div id="pet-name-error" role="alert" aria-live="assertive">
  Pet name is required
</div>
```

---

### 7.2 Voice Control Support

**iOS VoiceOver Commands:**
- "Tap Add Your Pet Photo" → Opens bottom sheet
- "Choose Quick Add" → Selects quick upload option
- "Enter Bella in Pet Name field" → Inputs text
- "Tap Quick Add to Cart" → Submits upload

**Android TalkBack Commands:**
- Same as VoiceOver
- Support "double tap to activate" gestures
- Announce progress updates every 25%

**Speech Recognition:**
- Ensure input fields support dictation
- Validate voice-entered names gracefully
- Provide visual confirmation of dictated text

---

### 7.3 Reduced Motion Support

```css
/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .bottom-sheet {
    animation: none;
    transition: opacity 0.2s;
  }

  .progress-bar {
    animation: none;
  }

  .success-toast {
    animation: none;
    transition: opacity 0.2s;
  }
}
```

**Impact:**
- Users with vestibular disorders avoid motion sickness
- Simpler animations reduce cognitive load
- Faster perceived performance

---

## 8. Testing Strategy

### 8.1 Mobile Device Matrix

**iOS Devices:**
| Device | OS Version | Browser | Priority |
|--------|------------|---------|----------|
| iPhone 15 Pro | iOS 17 | Safari | P0 |
| iPhone 12 | iOS 16 | Safari | P0 |
| iPhone SE (2nd gen) | iOS 15 | Safari | P1 |
| iPhone 8 | iOS 14 | Safari | P2 |

**Android Devices:**
| Device | OS Version | Browser | Priority |
|--------|------------|---------|----------|
| Google Pixel 6 | Android 13 | Chrome | P0 |
| Samsung Galaxy S21 | Android 12 | Chrome | P0 |
| Samsung Galaxy A52 | Android 11 | Chrome | P1 |
| OnePlus 8T | Android 11 | Chrome | P2 |

**Network Conditions:**
- Fast 4G LTE (20 Mbps)
- Slow 4G (4 Mbps)
- Fast 3G (1.6 Mbps)
- Offline mode
- Flaky network (packet loss simulation)

---

### 8.2 Test Scenarios

**TC1: Happy Path - Single Pet Quick Upload**
```
Preconditions:
- User on product page (mobile)
- No saved pets in localStorage
- Network: Fast 4G

Steps:
1. Tap "Add Your Pet Photo"
2. Verify: Bottom sheet appears
3. Tap "Quick Add (30 sec)"
4. Verify: Native file picker opens
5. Select photo from gallery (2MB)
6. Verify: Pet name modal appears
7. Enter "Bella" in name field
8. Tap "Quick Add to Cart"
9. Verify: Upload progress indicator appears
10. Verify: Progress bar animates 0% → 100%
11. Verify: Success toast appears "✅ Bella Added!"
12. Verify: Add to Cart button enabled
13. Verify: Pet thumbnail appears in selector widget

Expected Results:
- Time to cart: < 5s
- No errors in console
- Form fields populated correctly
- Background processing starts

Pass Criteria: All steps complete without errors, time < 8s
```

**TC2: Multi-Pet Upload with Name Validation**
```
Preconditions:
- Product allows max_pets = 3
- Network: Slow 4G

Steps:
1. Tap "Add Your Pet Photo" → "Quick Add"
2. Select 2 photos from gallery
3. Enter "Bella, Milo, Max" (3 names)
4. Tap "Quick Add to Cart"
5. Verify: Error modal appears
6. Verify: Message "You uploaded 2 photos but entered 3 names"
7. Tap "Fix Names"
8. Remove "Max" from input (now "Bella, Milo")
9. Tap "Quick Add to Cart"
10. Verify: Upload proceeds
11. Verify: Success "✅ 2 Pets Added!"

Pass Criteria: Error detected, user corrects, upload succeeds
```

**TC3: Network Failure with Retry**
```
Preconditions:
- Simulate network timeout (mock API)
- Network: Slow 3G

Steps:
1. Upload 1 photo + enter name
2. Tap "Quick Add to Cart"
3. Verify: Upload starts
4. Trigger network error (mock 500 response)
5. Verify: Retry toast "Retrying upload... (1/3)"
6. Wait 1 second
7. Verify: Automatic retry attempt
8. Trigger 2nd failure
9. Verify: Retry toast "Retrying upload... (2/3)"
10. Wait 2 seconds
11. Trigger 3rd failure
12. Verify: Error modal "Upload failed after 3 attempts"
13. Tap "Try Again"
14. Mock success response
15. Verify: Upload succeeds
16. Verify: Success toast appears

Pass Criteria: Automatic retries work, manual retry succeeds
```

**TC4: Offline Mode Detection**
```
Steps:
1. Open product page
2. Enable airplane mode (device settings)
3. Tap "Add Your Pet Photo"
4. Verify: Offline banner appears
5. Verify: Upload buttons disabled
6. Disable airplane mode
7. Verify: Offline banner disappears
8. Verify: Upload buttons re-enabled
9. Proceed with upload
10. Verify: Upload succeeds

Pass Criteria: Offline state detected, UI updates, recovers when online
```

**TC5: Large File Compression**
```
Preconditions:
- Device has 10MB photo
- Network: Fast 4G

Steps:
1. Upload 10MB photo
2. Verify: Client-side compression triggers
3. Verify: "Compressing image..." message shown
4. Verify: Compressed to ~2MB (80% reduction)
5. Verify: Upload proceeds with compressed file
6. Verify: Success toast appears
7. Verify: Full-res image preserved in localStorage

Pass Criteria: Compression works, upload time < 8s
```

**TC6: localStorage Full Recovery**
```
Preconditions:
- Fill localStorage to quota (mock)
- Try to upload new pet

Steps:
1. Upload photo + enter name
2. Attempt to save to localStorage
3. Verify: Error modal "Storage full. Clear old pets?"
4. Tap "Manage Saved Pets"
5. Verify: Pet management UI appears
6. Delete 2 old pets
7. Retry upload
8. Verify: Upload succeeds

Pass Criteria: Storage error detected, user recovers, upload succeeds
```

---

### 8.3 Performance Benchmarks

**Key Metrics:**
| Metric | Target | Critical | Measurement |
|--------|--------|----------|-------------|
| Time to Interactive (TTI) | < 3s | < 5s | Lighthouse |
| First Input Delay (FID) | < 100ms | < 300ms | Core Web Vitals |
| Upload Time (2MB, 4G) | < 3s | < 5s | Network tab |
| Total to Cart Enable | < 5s | < 8s | Custom tracking |
| Client Compression Time | < 1s | < 2s | Performance API |
| localStorage Write | < 50ms | < 200ms | Performance API |
| Form Sync Time | < 50ms | < 100ms | Performance API |

**Monitoring Code:**
```javascript
// Track upload performance
performance.mark('upload-start');

// ... upload logic ...

performance.mark('upload-complete');
performance.measure('upload-duration', 'upload-start', 'upload-complete');

const uploadTime = performance.getEntriesByName('upload-duration')[0].duration;

// Send to analytics
gtag('event', 'timing_complete', {
  name: 'quick_upload',
  value: Math.round(uploadTime),
  event_category: 'pet_upload',
  network_type: navigator.connection.effectiveType
});
```

---

## 9. Analytics & Tracking

### 9.1 Key Events

**Upload Funnel:**
```javascript
// Event 1: User initiates quick upload
gtag('event', 'quick_upload_initiated', {
  product_id: productId,
  max_pets: maxPets,
  device_type: 'mobile',
  network_type: navigator.connection.effectiveType
});

// Event 2: File selected
gtag('event', 'quick_upload_file_selected', {
  file_count: files.length,
  total_size_mb: totalSizeMB,
  device_type: 'mobile'
});

// Event 3: Pet name entered
gtag('event', 'quick_upload_name_entered', {
  pet_count: petNames.length,
  device_type: 'mobile'
});

// Event 4: Upload started
gtag('event', 'quick_upload_started', {
  file_count: files.length,
  total_size_mb: totalSizeMB,
  device_type: 'mobile'
});

// Event 5: Upload completed
gtag('event', 'quick_upload_completed', {
  file_count: files.length,
  upload_duration_sec: durationSec,
  success: true,
  device_type: 'mobile'
});

// Event 6: Add to cart enabled
gtag('event', 'add_to_cart_enabled', {
  scenario: 'quick_upload',
  time_to_enable_sec: timeToEnableSec,
  device_type: 'mobile'
});
```

**Error Tracking:**
```javascript
// Upload failure
gtag('event', 'quick_upload_error', {
  error_type: 'network_timeout',
  retry_attempt: retryCount,
  file_size_mb: fileSizeMB,
  network_type: navigator.connection.effectiveType,
  device_type: 'mobile'
});

// Validation error
gtag('event', 'quick_upload_validation_error', {
  error_type: 'name_file_mismatch',
  file_count: fileCount,
  name_count: nameCount,
  device_type: 'mobile'
});
```

---

### 9.2 Conversion Metrics

**Scenario 3 KPIs:**
| Metric | Baseline | Target | Critical |
|--------|----------|--------|----------|
| Quick Upload Adoption | N/A | 25% of uploads | 15% |
| Time to Cart Enable | 18s | 5s | 8s |
| Upload Success Rate | N/A | 95% | 85% |
| Scenario 3 → Purchase | N/A | 25% | 15% |
| Mobile Conversion Rate | 1.73% | 4.0% | 2.5% |

**Funnel Analysis:**
```
100 Mobile Visitors → Product Page
    ↓ (30% engage with pet selector)
30 Users → Tap "Add Your Pet Photo"
    ↓ (60% choose Quick Upload)
18 Users → Quick Upload Flow
    ↓ (90% upload success)
16 Users → Cart Button Enabled
    ↓ (25% conversion)
4 Orders → Completed Purchase

Conversion: 4% (target achieved)
```

---

## 10. Implementation Checklist

### 10.1 Phase 1: Core Components (Week 1)

**Files to Create:**
- [ ] `assets/quick-upload-handler.js` (ES5)
- [ ] `assets/upload-options-ui.js` (bottom sheet)
- [ ] `assets/pet-name-capture.js` (name modal)
- [ ] `assets/upload-progress.js` (progress indicator)
- [ ] `assets/toast-notifications.js` (toast system)
- [ ] `assets/quick-upload.css` (styles)

**Files to Modify:**
- [ ] `snippets/ks-product-pet-selector.liquid` (add upload trigger)
- [ ] `assets/pet-storage.js` (add `processingState` field)
- [ ] `assets/cart-pet-integration.js` (handle uploaded_only state)

**Testing:**
- [ ] Unit tests for file validation
- [ ] Unit tests for name-file matching
- [ ] Integration test for upload flow

---

### 10.2 Phase 2: Upload & Progress (Week 2)

**Functionality:**
- [ ] GCS upload integration (reuse existing `uploadToGCS`)
- [ ] Progress tracking (single + multi-file)
- [ ] Error handling + retry logic
- [ ] Offline detection
- [ ] Client-side compression

**Testing:**
- [ ] Device testing (iPhone, Android)
- [ ] Network condition testing (3G, 4G)
- [ ] Error scenario testing (timeout, 500, etc.)
- [ ] Performance benchmarks

---

### 10.3 Phase 3: Polish & Launch (Week 3)

**Polish:**
- [ ] Haptic feedback (iOS)
- [ ] Animation refinements
- [ ] Accessibility audit
- [ ] Copy review + refinement
- [ ] Analytics integration

**Launch:**
- [ ] Deploy to staging
- [ ] QA sign-off
- [ ] Beta test with 10 users
- [ ] Monitor metrics for 48 hours
- [ ] Deploy to production

---

## 11. Success Criteria

**Launch Readiness:**
- ✅ All P0 test cases pass
- ✅ Time to cart < 8s on Slow 4G
- ✅ Upload success rate > 85%
- ✅ Zero critical bugs
- ✅ WCAG AA accessibility compliance
- ✅ Analytics tracking verified

**Post-Launch (30 Days):**
- ✅ Quick Upload adoption > 15%
- ✅ Scenario 3 → Purchase > 15%
- ✅ Mobile conversion > 2.5%
- ✅ Upload success rate > 90%
- ✅ Customer complaints < 5 per week

**Optimization Targets (90 Days):**
- 🎯 Quick Upload adoption > 25%
- 🎯 Scenario 3 → Purchase > 25%
- 🎯 Mobile conversion > 4.0%
- 🎯 Time to cart < 5s average
- 🎯 Upload success rate > 95%

---

## 12. Appendix

### A. Mobile UX Best Practices Applied

1. **Thumb Zone Optimization** ✅
   - Primary actions within 72px of bottom edge
   - Large tap targets (48x48px minimum)
   - Bottom sheets for contextual actions

2. **Native Patterns** ✅
   - iOS-style bottom sheets
   - Native file picker integration
   - System keyboard handling
   - Platform-specific haptics

3. **Progressive Disclosure** ✅
   - Show complexity only when needed
   - Clear hierarchy (Quick → Preview → Lookup)
   - Inline validation with immediate feedback

4. **Performance-First** ✅
   - < 5s target for critical path
   - Client-side compression
   - Lazy module loading
   - Optimistic UI updates

5. **Error Prevention** ✅
   - Validate before upload (not after)
   - Clear constraints (max files, size)
   - Helpful error messages
   - Easy recovery paths

### B. Technical Architecture Summary

```
┌─────────────────────────────────────┐
│  Product Page                       │
│  (snippets/ks-product-pet-selector) │
└─────────────┬───────────────────────┘
              │ User taps "Add Pet"
              ↓
┌─────────────────────────────────────┐
│  Upload Options Bottom Sheet        │
│  (assets/upload-options-ui.js)      │
└─────────────┬───────────────────────┘
              │ User taps "Quick Add"
              ↓
┌─────────────────────────────────────┐
│  Native File Picker                 │
│  (input[type=file, capture])        │
└─────────────┬───────────────────────┘
              │ User selects file(s)
              ↓
┌─────────────────────────────────────┐
│  Pet Name Capture Modal             │
│  (assets/pet-name-capture.js)       │
└─────────────┬───────────────────────┘
              │ User enters name(s)
              ↓
┌─────────────────────────────────────┐
│  Quick Upload Handler               │
│  (assets/quick-upload-handler.js)   │
│  - Validate files + names           │
│  - Compress images                  │
│  - Upload to GCS (with retry)       │
│  - Save to localStorage             │
│  - Dispatch pet:selected event      │
└─────────────┬───────────────────────┘
              │ Upload complete
              ↓
┌─────────────────────────────────────┐
│  Cart Pet Integration               │
│  (assets/cart-pet-integration.js)   │
│  - Populate form fields             │
│  - Enable Add to Cart button        │
│  - Update pet selector widget       │
└─────────────────────────────────────┘
```

### C. Decision Log

**Decision 1: Bottom Sheet vs Modal for Upload Options**
- **Chosen:** Bottom Sheet
- **Rationale:** Mobile-native pattern, thumb-zone optimized, dismissible
- **Alternatives Considered:** Full-screen modal, inline expansion
- **Date:** 2025-10-20

**Decision 2: Sequential vs Parallel Multi-File Upload**
- **Chosen:** Sequential
- **Rationale:** Simpler progress tracking, better error isolation
- **Alternatives Considered:** Parallel upload
- **Trade-off:** 2-3s slower for 3 files, but more reliable
- **Date:** 2025-10-20

**Decision 3: Client-Side Compression Strategy**
- **Chosen:** Auto-compress > 2MB files to ~800KB
- **Rationale:** 70% faster upload, negligible quality loss
- **Alternatives Considered:** Server-side compression, no compression
- **Trade-off:** +1s client processing, -5s network time
- **Date:** 2025-10-20

**Decision 4: Name-File Matching Validation**
- **Chosen:** Validate after user input, show clear error
- **Rationale:** Flexible (allows 1 group photo for 2 pets), recoverable
- **Alternatives Considered:** Force 1:1 mapping, auto-generate names
- **Date:** 2025-10-20

---

**END OF SPECIFICATION**

---

## Quick Reference

**Time to Cart Target:** < 5s (Critical: < 8s)
**Upload Success Target:** > 95% (Critical: > 85%)
**Device Priority:** iPhone 12/15 Pro, Galaxy S21, Pixel 6
**Network Priority:** Fast 4G, Slow 4G, Fast 3G
**Browser Priority:** iOS Safari, Android Chrome
**Conversion Target:** 4.0% mobile (Current: 1.73%)

**Key Files:**
- `assets/quick-upload-handler.js` - Main logic
- `snippets/ks-product-pet-selector.liquid` - UI entry point
- `assets/cart-pet-integration.js` - Cart sync

**Key Events:**
- `quick_upload_initiated`
- `quick_upload_completed`
- `add_to_cart_enabled`

**Critical Paths:**
1. Product Page → Upload → Name → Cart (< 5s)
2. Upload Error → Retry → Success (< 10s)
3. Offline → Online → Upload (< 5s after reconnect)
