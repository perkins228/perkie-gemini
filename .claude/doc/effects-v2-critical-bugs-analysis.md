# Effects V2 Critical Bugs - Root Cause Analysis

**Date**: 2025-10-28
**Status**: ANALYSIS COMPLETE - Implementation Plan Ready
**Priority**: CRITICAL - 100% functionality broken
**Session**: context_session_001.md

---

## Executive Summary

Effects V2 has **5 critical bugs** preventing core functionality. Based on console logs and user testing, the system has:
- ❌ 0% GCS upload success (all URLs null)
- ❌ 0% Gemini API success (404 errors)
- ⚠️ 90° image rotation (EXIF not handled)
- ⚠️ Progress bar animation invisible
- ⚠️ Wrong default selection (Color instead of B&W)

**Root Cause**: Multiple integration issues between frontend (Effects V2) and backend APIs (InSPyReNet + Gemini).

---

## Issue #1: GCS Upload Failing (422 Error) ⚠️ HIGH PRIORITY

### Symptom
```
POST https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/store-image 422 (Unprocessable Content)
✅ GCS URLs obtained: {color: null, blackwhite: null, modern: null, classic: null}
```

### Root Cause Analysis

**Location**: `assets/effects-v2-loader.js` line 465 - `/store-image` endpoint

**Error Code**: 422 = Unprocessable Entity (validation error)

**Why 422 Occurs**:
1. Missing required fields in FormData
2. Invalid data format
3. Incorrect parameter names
4. File type validation failure

**Code Review - uploadToStorage() function (lines 454-479)**:
```javascript
async function uploadToStorage(dataUrl, sessionKey, effectName, apiUrl) {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const formData = new FormData();
    const filename = `${sessionKey}_${effectName}.jpg`;
    formData.append('file', blob, filename);         // ✅ File blob
    formData.append('session_key', sessionKey);      // ❓ Check backend expects this
    formData.append('effect_name', effectName);      // ❓ Check backend expects this

    const uploadResponse = await fetch(`${apiUrl}/store-image`, {
      method: 'POST',
      body: formData
    });
    // ...
```

**Investigation Required**:
1. **Check InSPyReNet API endpoint**: What does `/store-image` actually expect?
2. **Parameter names**: Does backend use `session_key` or `session_id`? `effect_name` or `effect`?
3. **Required fields**: Are there other required fields (customer_id, product_id)?
4. **File format**: Backend expects JPG but might require PNG (data URLs are PNG)

**Likely Fix Options**:

**Option A**: Parameter name mismatch
```javascript
// CURRENT (BROKEN):
formData.append('session_key', sessionKey);
formData.append('effect_name', effectName);

// IF BACKEND EXPECTS:
formData.append('session_id', sessionKey);  // Change: session_key → session_id
formData.append('effect', effectName);      // Change: effect_name → effect
```

**Option B**: Missing required fields
```javascript
// CURRENT (BROKEN):
formData.append('file', blob, filename);
formData.append('session_key', sessionKey);
formData.append('effect_name', effectName);

// ADD MISSING FIELDS:
formData.append('file', blob, filename);
formData.append('session_key', sessionKey);
formData.append('effect_name', effectName);
formData.append('customer_id', 'guest');    // NEW: May be required
formData.append('product_id', '');          // NEW: May be required
```

**Option C**: File format issue (PNG vs JPG)
```javascript
// CURRENT (BROKEN):
const filename = `${sessionKey}_${effectName}.jpg`;  // Claims JPG
formData.append('file', blob, filename);              // But blob is PNG

// FIX: Convert to JPEG or use correct extension
const filename = `${sessionKey}_${effectName}.png`;  // Match actual format
```

**Required Action**:
1. ✅ Check InSPyReNet API `/store-image` endpoint implementation
2. ✅ Review backend validation logic
3. ✅ Test with correct parameters
4. ✅ Add error logging (return error details from 422)

---

## Issue #2: Gemini API Endpoint Wrong (404 Error) 🔴 CRITICAL

### Symptom
```
POST https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app/generate-artistic net::ERR_FAILED 404 (Not Found)
```

### Root Cause: Incorrect Endpoint Path

**Current Call** (Line 121 in `gemini-artistic-client.js`):
```javascript
const result = await this.request('/generate-artistic', {  // ❌ WRONG ENDPOINT
  method: 'POST',
  body: formData,
  timeout: 60000
});
```

**Correct Endpoint** (from `backend/gemini-artistic-api/src/main.py` line 94):
```python
@app.post("/api/v1/generate", response_model=GenerateResponse)
async def generate_artistic_style(request: Request, req: GenerateRequest):
```

**The Fix** (1-line change):
```javascript
// BEFORE (BROKEN):
const result = await this.request('/generate-artistic', {

// AFTER (FIXED):
const result = await this.request('/api/v1/generate', {
```

**Why This Happened**:
- Frontend client was created before backend API finalized
- Backend uses `/api/v1/generate` (RESTful versioned endpoint)
- Frontend assumed simpler `/generate-artistic` path
- No integration testing caught the mismatch

**Impact**:
- **Modern style**: 0% success rate
- **Classic style**: 0% success rate
- **User experience**: "Loading..." buttons never complete
- **Quota consumption**: None (request never reaches backend)

**Secondary Issue**: Request Format Mismatch

Backend expects **JSON body**, not FormData:

```python
# Backend expects (main.py line 95):
req: GenerateRequest  # Pydantic model with JSON fields

# GenerateRequest schema (models/schemas.py):
class GenerateRequest(BaseModel):
    image_data: str          # Base64 encoded image
    style: ArtisticStyle     # Enum: bw_fine_art, ink_wash, charcoal_realism
    customer_id: str = None
    session_id: str = None
```

**Current Frontend Call** (gemini-artistic-client.js lines 116-125):
```javascript
// BROKEN: Sends FormData, backend expects JSON
const formData = new FormData();
formData.append('image', imageBlob, 'pet.png');
formData.append('style', geminiStyle);

const result = await this.request('/generate-artistic', {  // Wrong endpoint
  method: 'POST',
  body: formData,  // ❌ Wrong format
  timeout: 60000
});
```

**The Complete Fix**:
```javascript
// STEP 1: Convert Blob to Base64
const base64Image = await this.blobToBase64(imageBlob);

// STEP 2: Send JSON body
const result = await this.request('/api/v1/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_data: base64Image,
    style: geminiStyle,
    session_id: `effects_v2_${Date.now()}`
  }),
  timeout: 60000
});

// STEP 3: Handle JSON response (not Blob)
// Backend returns: { image_url: "https://storage.googleapis.com/..." }
const imageUrl = result.image_url;
// Fetch the image from GCS
const imageResponse = await fetch(imageUrl);
return await imageResponse.blob();
```

**Required New Helper Method**:
```javascript
/**
 * Convert Blob to Base64 string
 * @param {Blob} blob - Image blob
 * @returns {Promise<string>} Base64 string (without data URL prefix)
 */
async blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]; // Remove "data:image/png;base64," prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**Impact of Full Fix**:
- Endpoint: `/generate-artistic` → `/api/v1/generate` ✅
- Request format: FormData → JSON ✅
- Response handling: Blob → JSON with GCS URL ✅
- Modern/Classic: 0% → 100% success rate ✅

**Files to Modify**:
1. `assets/gemini-artistic-client.js` (lines 116-135 - applyStyle method)
2. `assets/effects-v2-bundle-entry.js` (rebuild bundle)

**Estimated Fix Time**: 20-30 minutes

---

## Issue #3: Gemini CORS Not Configured 🟡 MEDIUM PRIORITY

### Symptom
```
Access to fetch at 'https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app/generate-artistic'
from origin 'https://perkieprints.com' has been blocked by CORS policy
```

### Root Cause: Production Domain Not in CORS Allowlist

**Current CORS Config** (backend/gemini-artistic-api/src/main.py lines 39-55):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://perkieprints-test.myshopify.com",  # ✅ Staging
        "https://testsite.perkieprints.com",        # ✅ Test site
        "http://localhost:3000",                     # ✅ Local dev
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "null"  # Allow file:// protocol
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

**Missing Origins**:
- ❌ `https://perkieprints.com` (production domain)
- ❌ `https://www.perkieprints.com` (www subdomain)

**The Fix** (2 lines to add):
```python
allow_origins=[
    "https://perkieprints.com",                  # ADD: Production
    "https://www.perkieprints.com",              # ADD: Production www
    "https://perkieprints-test.myshopify.com",   # Existing
    "https://testsite.perkieprints.com",         # Existing
    # ... rest of origins
],
```

**Why This Wasn't Caught**:
- Testing only done on staging URLs
- Production domain not used during development
- CORS errors only appear in browser console (not backend logs)

**Deployment Required**:
- Edit `backend/gemini-artistic-api/src/main.py`
- Redeploy Gemini API to Cloud Run
- No frontend changes needed

**Priority**: Medium (only blocks production, staging works)

**Estimated Fix Time**: 5 minutes code + 10 minutes deployment

---

## Issue #4: Image Rotation 90 Degrees (EXIF Orientation) 🟡 MEDIUM PRIORITY

### Symptom
User uploads portrait image → Displays rotated 90° clockwise/counterclockwise

### Root Cause: EXIF Orientation Metadata Not Respected

**What Happens**:
1. Mobile camera captures image in landscape orientation (sensor horizontal)
2. Camera adds EXIF orientation tag (e.g., `Orientation: 6` = "Rotate 90° CW")
3. Image file is physically landscape, but EXIF says "display as portrait"
4. Modern image viewers respect EXIF and rotate automatically
5. **Canvas API ignores EXIF** → displays raw orientation (wrong)

**Technical Details**:

EXIF Orientation values:
- `1`: Normal (0°)
- `3`: Upside down (180°)
- `6`: Rotate 90° CW (portrait held vertically, sensor horizontal)
- `8`: Rotate 90° CCW

**Where EXIF Should Be Handled**:

**Option A: InSPyReNet API** (backend handles, frontend gets corrected image)
- ✅ PRO: Fixed once, works for all clients
- ✅ PRO: Consistent output orientation
- ❌ CON: Requires backend deployment
- ❌ CON: May lose original orientation intent

**Option B: Effects V2 Frontend** (before display)
- ✅ PRO: No backend changes needed
- ✅ PRO: Fast implementation
- ❌ CON: Must repeat for all display locations
- ❌ CON: Only fixes display, not storage

**Recommended: Option A (Backend Fix)**

**Implementation in InSPyReNet API**:

File: `backend/inspirenet-api/src/integrated_processor.py`

```python
from PIL import Image
from PIL.ExifTags import TAGS

def fix_image_orientation(image: Image.Image) -> Image.Image:
    """
    Rotate image according to EXIF orientation tag

    Args:
        image: PIL Image object

    Returns:
        PIL Image with corrected orientation (EXIF tag removed)
    """
    try:
        # Get EXIF data
        exif = image._getexif()
        if exif is None:
            return image  # No EXIF data

        # Find orientation tag (tag ID 274)
        orientation = None
        for tag_id, value in exif.items():
            tag_name = TAGS.get(tag_id, tag_id)
            if tag_name == 'Orientation':
                orientation = value
                break

        if orientation is None:
            return image  # No orientation tag

        # Apply rotation based on orientation
        if orientation == 2:
            # Mirrored horizontal
            image = image.transpose(Image.FLIP_LEFT_RIGHT)
        elif orientation == 3:
            # Rotated 180°
            image = image.rotate(180)
        elif orientation == 4:
            # Mirrored vertical
            image = image.transpose(Image.FLIP_TOP_BOTTOM)
        elif orientation == 5:
            # Mirrored horizontal + rotated 90° CCW
            image = image.transpose(Image.FLIP_LEFT_RIGHT).rotate(90, expand=True)
        elif orientation == 6:
            # Rotated 90° CW
            image = image.rotate(270, expand=True)
        elif orientation == 7:
            # Mirrored horizontal + rotated 90° CW
            image = image.transpose(Image.FLIP_LEFT_RIGHT).rotate(270, expand=True)
        elif orientation == 8:
            # Rotated 90° CCW
            image = image.rotate(90, expand=True)

        # Remove EXIF orientation tag (image is now physically correct)
        if hasattr(image, '_getexif'):
            exif_dict = image._getexif()
            if exif_dict and 274 in exif_dict:
                del exif_dict[274]

        return image

    except (AttributeError, KeyError, IndexError, TypeError):
        # If EXIF reading fails, return original
        return image

# Usage in process() method:
def process(self, image_path: str, effects: List[str]) -> dict:
    # Load image
    img = Image.open(image_path)

    # FIX: Apply EXIF orientation FIRST
    img = fix_image_orientation(img)

    # Continue with existing processing...
    img_array = np.array(img)
    # ... rest of processing
```

**Testing Strategy**:
1. Test images with different EXIF orientations (1, 3, 6, 8)
2. Test images without EXIF data (e.g., screenshots)
3. Verify orientation preserved through all effects
4. Test on mobile uploads (most common source)

**Priority**: Medium (affects UX but not blocking functionality)

**Estimated Fix Time**: 2-3 hours (implementation + testing + deployment)

---

## Issue #5: Progress Bar Animation Not Visible ⚠️ LOW PRIORITY

### Symptom
User reports: "Progress bar has no animation"

### Root Cause Analysis

**Shimmer Animation Exists** (assets/effects-v2.css lines 298-325):
```css
.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
```

**Possible Causes**:

**Cause A: CSS Not Loaded/Cached**
- Browser cached old version without shimmer
- Hard refresh (Ctrl+Shift+R) would fix

**Cause B: `::after` Element Not Visible**
- Parent `.progress-bar` needs `position: relative` (check line 280)
- `overflow: hidden` may be missing (shimmer escapes bounds)

**Cause C: Animation Too Subtle**
- `rgba(255, 255, 255, 0.3)` = 30% white opacity
- On light background, may be invisible
- Contrast too low

**Cause D: Animation Timing Off**
- 2s per sweep may be too fast/slow to notice
- User may have `prefers-reduced-motion` enabled

**Investigation Required**:

1. **Check CSS Load Order** (sections/ks-effects-processor-v2.liquid):
```liquid
<!-- Verify these are present: -->
{{ 'effects-v2.css' | asset_url | stylesheet_tag }}
{{ 'effects-v2-mobile.css' | asset_url | stylesheet_tag }}
```

2. **Check Parent Element CSS**:
```css
/* Required for ::after positioning */
.progress-bar {
  position: relative;  /* ✅ Must have this */
  overflow: hidden;    /* ✅ Prevents shimmer overflow */
  /* ... */
}
```

3. **Test Contrast**:
```css
/* CURRENT (subtle): */
rgba(255, 255, 255, 0.3)  /* 30% white */

/* MORE VISIBLE: */
rgba(255, 255, 255, 0.5)  /* 50% white - try this */
```

**The Likely Fix** (increase shimmer opacity):
```css
.progress-bar::after {
  /* ... */
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.5),  /* CHANGE: 0.3 → 0.5 */
    transparent
  );
  /* ... */
}
```

**Alternative Fix** (add glow effect):
```css
.progress-bar::after {
  /* ... */
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);  /* ADD: Glow */
  /* ... */
}
```

**Priority**: Low (cosmetic issue, doesn't block functionality)

**Estimated Fix Time**: 15 minutes

---

## Issue #6: Default Selection Wrong 🟡 MEDIUM PRIORITY

### Symptom
User requirement: "B&W should be selected by default"
Current behavior: Color is selected by default

### Root Cause: Hardcoded Default in showResult()

**Current Code** (effects-v2-loader.js line 436):
```javascript
showResult(container, sectionId, {
  sessionKey,
  effects,
  currentEffect: 'color'  // ❌ HARDCODED: Color selected by default
});
```

**Button Order** (lines 143-158):
```javascript
<button class="effect-btn" data-effect="blackwhite">
  <span class="effect-icon">⚫</span>
  <span class="effect-name">B&W</span>
</button>
<button class="effect-btn active" data-effect="color">  <!-- active class on Color -->
  <span class="effect-icon">🎨</span>
  <span class="effect-name">Original</span>
</button>
```

**The Fix** (2 changes):

**Change 1**: Update default effect (line 436)
```javascript
// BEFORE:
currentEffect: 'color'

// AFTER:
currentEffect: 'blackwhite'
```

**Change 2**: Move `active` class to B&W button (line 143)
```javascript
// BEFORE:
<button class="effect-btn" data-effect="blackwhite">
  <!-- B&W -->
</button>
<button class="effect-btn active" data-effect="color">  <!-- Color has 'active' -->
  <!-- Original -->
</button>

// AFTER:
<button class="effect-btn active" data-effect="blackwhite">  <!-- B&W has 'active' -->
  <!-- B&W -->
</button>
<button class="effect-btn" data-effect="color">  <!-- Color no 'active' -->
  <!-- Original -->
</button>
```

**Impact**:
- User uploads image → Sees B&W version first (as requested)
- "Original" button available to switch to color
- Aligns with user expectation (B&W most popular for pet portraits)

**Priority**: Medium (UX preference, easy fix)

**Estimated Fix Time**: 5 minutes

---

## Issue #7: Text Label "Original" → "Color" 🟢 LOW PRIORITY

### Symptom
User request: "Original should be renamed Color"

### Root Cause: Button label text

**Current Code** (effects-v2-loader.js line 149):
```javascript
<button class="effect-btn" data-effect="color">
  <span class="effect-icon">🎨</span>
  <span class="effect-name">Original</span>  <!-- ❌ Says "Original" -->
</button>
```

**The Fix** (1 word change):
```javascript
<button class="effect-btn" data-effect="color">
  <span class="effect-icon">🎨</span>
  <span class="effect-name">Color</span>  <!-- ✅ Now says "Color" -->
</button>
```

**Priority**: Low (cosmetic text change)

**Estimated Fix Time**: 2 minutes

---

## Implementation Plan

### Phase 1: Critical Fixes (Blocking Functionality) - 2 Hours

**1. Fix Gemini API Endpoint + Request Format** (30 min)
- File: `assets/gemini-artistic-client.js`
- Changes:
  - Add `blobToBase64()` helper method
  - Update `applyStyle()` to send JSON body
  - Change endpoint: `/generate-artistic` → `/api/v1/generate`
  - Handle JSON response with GCS URL
- Test: Click Modern → Should generate and display
- Test: Click Classic → Should generate and display

**2. Investigate + Fix GCS Upload 422 Error** (60 min)
- Step A: Check InSPyReNet `/store-image` endpoint (15 min)
  - Review backend validation logic
  - Identify required parameters
  - Check parameter naming (session_key vs session_id)
- Step B: Update frontend uploadToStorage() (15 min)
  - Fix parameter names if incorrect
  - Add missing required fields
  - Correct file format if needed
- Step C: Add error logging (15 min)
  - Log 422 response body (validation errors)
  - Add debug console logs for troubleshooting
- Step D: Test upload flow (15 min)
  - Upload image → Check console for GCS URLs
  - Verify localStorage has gcsUrls object with non-null values

**3. Add Production Domain to Gemini CORS** (15 min)
- File: `backend/gemini-artistic-api/src/main.py`
- Add: `https://perkieprints.com` and `https://www.perkieprints.com`
- Deploy to Cloud Run
- Test from production domain

**4. Rebuild Bundle + Deploy** (15 min)
- Run: `npm run build:effects`
- Commit changes
- Push to staging branch → Auto-deploy
- Verify bundle size < 50KB

### Phase 2: Medium Priority Fixes (UX Issues) - 1.5 Hours

**5. Fix Default Selection (B&W instead of Color)** (10 min)
- File: `assets/effects-v2-loader.js`
- Change line 436: `currentEffect: 'blackwhite'`
- Move `active` class to B&W button (line 143)
- Test: Upload → Should show B&W first

**6. Rename "Original" → "Color"** (5 min)
- File: `assets/effects-v2-loader.js`
- Change line 149: `Original` → `Color`
- Test: Verify button text updated

**7. Fix EXIF Orientation (Backend)** (1 hour)
- File: `backend/inspirenet-api/src/integrated_processor.py`
- Add `fix_image_orientation()` method
- Call before processing in `process()` method
- Test with rotated mobile photos (EXIF orientations 3, 6, 8)
- Deploy to staging API

**8. Rebuild Bundle + Deploy** (15 min)
- Run: `npm run build:effects`
- Commit all Phase 2 changes
- Push to staging → Auto-deploy

### Phase 3: Low Priority Fixes (Polish) - 30 Minutes

**9. Enhance Progress Bar Shimmer** (15 min)
- File: `assets/effects-v2.css`
- Increase shimmer opacity: `0.3` → `0.5`
- OR add glow: `box-shadow: 0 0 10px rgba(255, 255, 255, 0.5)`
- Test: Upload image → Verify shimmer visible during 30-80s wait

**10. Final Bundle + Deploy** (15 min)
- Run: `npm run build:effects`
- Commit Phase 3 changes
- Push to staging
- Full regression test (all 4 effects + upload + share + reset)

### Phase 4: Comprehensive Testing - 1 Hour

**Test Matrix**:

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| 1. Upload 5MB image | ✅ Progress bar animates, reaches 100% | ⏳ |
| 2. Display Color effect | ✅ Image appears (not rotated, correct orientation) | ⏳ |
| 3. Switch to B&W | ✅ Instant switch, B&W displays | ⏳ |
| 4. Click Modern | ✅ "Loading...", generates in 5-15s, displays | ⏳ |
| 5. Click Classic | ✅ "Loading...", generates in 5-15s, displays | ⏳ |
| 6. Check localStorage | ✅ gcsUrls has 4 non-null values (color, blackwhite, modern, classic) | ⏳ |
| 7. Check console | ✅ No 422 errors, no 404 errors, no CORS errors | ⏳ |
| 8. Share Color | ✅ Web Share API works / clipboard copy | ⏳ |
| 9. Share Modern | ✅ Web Share API works / clipboard copy | ⏳ |
| 10. Reset + Retry | ✅ Can upload new image, all effects work | ⏳ |
| 11. Mobile test | ✅ All features work on iPhone/Android | ⏳ |
| 12. Artist note | ✅ Can type, saves to localStorage | ⏳ |

---

## Files to Modify

### Frontend Files (3 files):
1. **assets/gemini-artistic-client.js** (50 lines modified)
   - Add `blobToBase64()` helper
   - Update `applyStyle()` method
   - Change endpoint path
   - Update request format (FormData → JSON)
   - Handle JSON response

2. **assets/effects-v2-loader.js** (10 lines modified)
   - Line 149: "Original" → "Color"
   - Line 143: Add `active` class to B&W button
   - Line 147: Remove `active` class from Color button
   - Line 436: `currentEffect: 'blackwhite'`
   - Lines 454-479: Fix `uploadToStorage()` parameters (if needed)
   - Add error logging for 422 debugging

3. **assets/effects-v2.css** (2 lines modified)
   - Line 314: Increase shimmer opacity `0.3` → `0.5`

### Backend Files (2 files):
4. **backend/gemini-artistic-api/src/main.py** (2 lines added)
   - Add production domains to CORS allowlist

5. **backend/inspirenet-api/src/integrated_processor.py** (80 lines added)
   - Add `fix_image_orientation()` method
   - Call in `process()` method

---

## Risk Assessment

### High Risk (Require Backend Changes):
- ⚠️ GCS upload fix (if backend parameters wrong)
- ⚠️ EXIF orientation fix (requires API deployment)
- ⚠️ Gemini CORS (requires API deployment)

### Medium Risk (Frontend Only):
- 🟡 Gemini endpoint fix (well-defined change)
- 🟡 Default selection (simple logic change)

### Low Risk (Cosmetic):
- 🟢 Text label change
- 🟢 Progress bar animation

---

## Success Criteria

### Must Have (Phase 1):
- ✅ Modern style: 0% → 100% success rate
- ✅ Classic style: 0% → 100% success rate
- ✅ GCS URLs: All null → 4 non-null values
- ✅ Console: No 404, 422, or CORS errors

### Should Have (Phase 2):
- ✅ B&W selected by default
- ✅ "Color" button instead of "Original"
- ✅ Images display in correct orientation (no 90° rotation)

### Nice to Have (Phase 3):
- ✅ Progress bar shimmer clearly visible

---

## Rollback Plan

If deployment breaks:
1. **Instant rollback**: Git revert last commit → Push to staging
2. **Frontend only**: Previous bundle cached in browser (5 min manual clear)
3. **Backend Gemini**: Revert Cloud Run to previous revision (3 min)
4. **Backend InSPyReNet**: Revert Cloud Run to previous revision (3 min)

**Rollback Time**: < 5 minutes for frontend, < 10 minutes for backend

---

## Next Steps

**RECOMMENDED ORDER**:

1. ✅ User approves this implementation plan
2. ✅ Start with Phase 1 (Critical Fixes) - highest impact
3. ✅ Deploy + test Phase 1 before proceeding
4. ✅ If Phase 1 successful → Continue to Phase 2
5. ✅ Full regression test after each phase

**Estimated Total Time**: 5 hours (2h Phase 1 + 1.5h Phase 2 + 0.5h Phase 3 + 1h Testing)

---

## Documentation References

**Session Context**: .claude/tasks/context_session_001.md
**Related Docs**:
- .claude/doc/effects-v2-migration-phases-1-4-summary.md (implementation history)
- .claude/doc/effects-v2-mobile-architecture.md (mobile UX guidance)
- CLAUDE.md (project architecture)

**API Endpoints**:
- InSPyReNet: `https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app`
- Gemini: `https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app`

**Key Files**:
- Frontend: `assets/effects-v2-loader.js`, `assets/gemini-artistic-client.js`, `assets/effects-v2.css`
- Backend: `backend/gemini-artistic-api/src/main.py`, `backend/inspirenet-api/src/integrated_processor.py`

---

**Status**: Ready for implementation approval
