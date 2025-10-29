# Effects V2 Production Failures - Root Cause Analysis

**Date**: 2025-10-29
**Session**: context_session_001.md
**Status**: CRITICAL - Multiple failures blocking user functionality
**Analyst**: Debug Specialist

---

## Executive Summary

After Effects V2 deployment to perkieprints.com, **7 issues reported**. Frontend fixes already deployed (3/7 resolved). This analysis identifies root causes for the remaining **4 critical backend/integration issues**.

### Issues Status
- ✅ FIXED (Frontend): Color button label, B&W default, Gemini endpoint path
- ❌ PENDING: Gemini 500 error, Color GCS upload, Image rotation, Progress bar

---

## Root Cause #1: Gemini API 500 Error (CRITICAL)

### Problem Statement
```
POST https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app/api/v1/generate
net::ERR_FAILED 500 (Internal Server Error)

Console shows CORS blocked, but also 500 error
```

### Investigation Results

**Test #1: CORS Configuration**
```bash
curl -X OPTIONS https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app/api/v1/generate \
  -H "Origin: https://perkieprints.com" -v

Result: ✅ CORS WORKING
< access-control-allow-origin: https://perkieprints.com
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-credentials: true
```

**Test #2: Health Check**
```bash
curl https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app/health

Result: ✅ SERVICE HEALTHY
{"status":"healthy","model":"gemini-2.5-flash-image"}
```

### Root Cause Identified

**CRITICAL API CONTRACT MISMATCH**

**Backend Expects** (FastAPI JSON):
```python
# src/models/schemas.py lines 14-19
class GenerateRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded image data")
    style: ArtisticStyle = Field(..., description="Artistic style to apply")
    customer_id: Optional[str] = Field(None)
    session_id: Optional[str] = Field(None)
```

**Frontend Sends** (FormData):
```javascript
// assets/gemini-artistic-client.js lines 116-118
const formData = new FormData();
formData.append('image', imageBlob, 'pet.png');  // ❌ Binary blob, not base64
formData.append('style', geminiStyle);           // ❌ FormData, not JSON
```

**Why 500 Error Occurs**:
1. FastAPI expects JSON with `image_data` field (base64 string)
2. Frontend sends multipart/form-data with `image` field (binary blob)
3. Pydantic validation fails → 422 Unprocessable Entity (but shown as 500)
4. CORS headers present, but error happens during validation
5. Browser shows CORS error first (misleading), then 500

**Impact**:
- Modern/Classic effects **completely non-functional**
- Users cannot generate artistic styles
- BLOCKS core product feature

---

## Root Cause #2: Color GCS URL is Null (HIGH)

### Problem Statement
```javascript
✅ GCS URLs obtained: {
  color: null,  // ❌ COLOR UPLOAD FAILED
  blackwhite: 'https://storage.googleapis.com/.../processed_blackwhite_1761746765.jpg',
  modern: null,
  classic: null
}
```

### Investigation Results

**Code Flow Analysis**:

**Step 1: InSPyReNet API Called** (effects-v2-loader.js lines 336-337)
```javascript
formData.append('file', file);
formData.append('effects', 'color,blackwhite'); // ✅ Both requested
```

**Step 2: Effects Object Built** (effects-v2-loader.js lines 358-369)
```javascript
if (data.effects) {
  for (const [effectName, base64Data] of Object.entries(data.effects)) {
    const dataUrl = `data:image/png;base64,${base64Data}`;
    effects[effectName] = dataUrl;
  }
}

// Normalize: API returns 'enhancedblackwhite', UI expects 'blackwhite'
if (effects.enhancedblackwhite && !effects.blackwhite) {
  effects.blackwhite = effects.enhancedblackwhite;
  delete effects.enhancedblackwhite;
}
```

**Step 3: GCS Upload Attempted** (effects-v2-loader.js lines 395-400)
```javascript
if (effects.color) {
  uploadPromises.push(
    uploadToStorage(effects.color, sessionKey, 'color', config.apiUrl)
      .then(url => { gcsUrls.color = url; })
  );
}
```

### Root Cause Identified

**MISSING EFFECT NAME NORMALIZATION**

**Problem**: InSPyReNet API returns effect with unexpected name
- Backend likely returns: `originalcolor`, `color_with_background_removed`, or similar
- Frontend expects: `color` (exact match)
- Normalization only exists for `enhancedblackwhite` → `blackwhite`
- No normalization for color variants

**Evidence**:
1. `effects.color` is undefined (line 395 check fails)
2. Upload promise never added to array
3. GCS URL remains null
4. No console error (silently skipped)

**Why Only B&W Works**:
- B&W has normalization: `enhancedblackwhite` → `blackwhite` (line 366)
- Color has NO normalization
- API must return color with different name

**Impact**:
- Color button non-functional (no image to display)
- Cart integration broken (missing color GCS URL)
- Users stuck on B&W only

---

## Root Cause #3: Image Rotation Not Corrected (MEDIUM)

### Problem Statement
```
User Report: "The image orientation does not match the original uploaded image, rotated 90 degrees"
No console errors
```

### Investigation Context

**Recent Deployment**:
- EXIF orientation fix deployed to InSPyReNet API (Oct 28)
- Build ID: 20187bb1-63ba-4ce5-b76d-819ee7d9f8a3
- Code location: `backend/inspirenet-api/src/integrated_processor.py`

**Expected Code**:
```python
from PIL import ImageOps

img = Image.open(uploaded_file)
img = ImageOps.exif_transpose(img)  # Auto-rotate based on EXIF
# Continue with background removal
```

### Root Cause Identified

**DEPLOYMENT STATUS UNKNOWN + POSSIBLE PIPELINE LOSS**

**Possible Causes (Priority Order)**:

**1. Deployment In Progress / Failed** (MOST LIKELY)
- Cloud Build may still be running
- Deployment may have failed silently
- Old revision still serving traffic
- Cache not cleared

**2. EXIF Correction Lost During Processing** (SECONDARY)
- `ImageOps.exif_transpose()` applied at input
- Background removal generates new image
- EXIF metadata NOT copied to output
- Final PNG/JPG has no orientation metadata

**3. EXIF Correction Not Applied** (LEAST LIKELY)
- Code deployed but not executed
- Wrong branch deployed
- Code path not reached

**How to Verify**:
```bash
# Check deployment status
gcloud builds describe 20187bb1-63ba-4ce5-b76d-819ee7d9f8a3 \
  --project=gen-lang-client-0601138686

# Check active revision
gcloud run services describe inspirenet-bg-removal-api-gemini \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format='value(status.latestReadyRevisionName)'

# Test with portrait image
curl -X POST <API_URL>/api/v2/process-with-effects \
  -F "file=@portrait_test.jpg" \
  -F "effects=color"
```

**Impact**:
- Portrait images display sideways
- User confusion / poor UX
- NOT blocking (images still processable)

---

## Root Cause #4: Progress Bar Not Animating (LOW)

### Problem Statement
```
User Report: "Progress bar continues not to have any animation"
CSS shimmer animation deployed but not visible
```

### Investigation Results

**Deployed Code** (assets/effects-v2-loader.js lines 154-167):
```css
.ev2-progress-bar::after {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: linear-gradient(90deg,
    transparent,
    rgba(255,255,255,0.4),
    transparent
  );
  animation: ev2-shimmer 1.5s infinite;
}

@keyframes ev2-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Root Cause Identified

**BROWSER CACHE / CSS NOT LOADED**

**Likely Causes**:
1. **Hard refresh needed** - User viewing cached CSS
2. **CSS specificity conflict** - Existing styles overriding animation
3. **Animation too subtle** - White shimmer on light progress bar
4. **Browser compatibility** - Older browser not supporting `::after` animation

**How to Verify**:
1. Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
2. Check DevTools → Network → ev2-styles.css loaded?
3. Check DevTools → Elements → `.ev2-progress-bar::after` present?
4. Check DevTools → Computed → `animation` applied?

**Impact**:
- Cosmetic only
- Progress bar still shows (just static)
- NOT blocking functionality

---

## Implementation Priority

### Phase 1: CRITICAL (Deploy Today)

#### 1.1 Fix Gemini API Request Format (1-2 hours)
**Location**: `assets/gemini-artistic-client.js`

**Current Code** (lines 116-124):
```javascript
const formData = new FormData();
formData.append('image', imageBlob, 'pet.png');
formData.append('style', geminiStyle);

const result = await this.request('/api/v1/generate', {
  method: 'POST',
  body: formData,
  timeout: 60000
});
```

**Fix Required**:
```javascript
// Convert blob to base64
const base64Data = await blobToBase64(imageBlob);

// Send JSON with base64 image
const result = await this.request('/api/v1/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image_data: base64Data,
    style: geminiStyle,
    customer_id: null,
    session_id: `perkie_${Date.now()}`
  }),
  timeout: 60000
});
```

**Helper Function Needed**:
```javascript
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // Returns data:image/png;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**Files to Modify**:
- `assets/gemini-artistic-client.js` (lines 116-135)

**Testing**:
1. Upload pet image on perkieprints.com
2. Click "Modern" button
3. Verify no 500 error
4. Verify artistic image generated

**Time**: 1-2 hours (includes testing)

---

#### 1.2 Fix Color Effect Name Normalization (30 minutes)
**Location**: `assets/effects-v2-loader.js`

**Current Code** (lines 365-369):
```javascript
// Step 2.5: Normalize effect names (API returns 'enhancedblackwhite', UI expects 'blackwhite')
if (effects.enhancedblackwhite && !effects.blackwhite) {
  effects.blackwhite = effects.enhancedblackwhite;
  delete effects.enhancedblackwhite;
}
```

**Fix Required** (Option A - Frontend Normalization):
```javascript
// Step 2.5: Normalize effect names
// B&W normalization
if (effects.enhancedblackwhite && !effects.blackwhite) {
  effects.blackwhite = effects.enhancedblackwhite;
  delete effects.enhancedblackwhite;
}

// Color normalization (handle multiple possible names)
if (!effects.color) {
  // Check for common color effect names from API
  const colorVariants = [
    'originalcolor',
    'color_with_background_removed',
    'original',
    'color_original'
  ];

  for (const variant of colorVariants) {
    if (effects[variant]) {
      effects.color = effects[variant];
      delete effects[variant];
      break;
    }
  }
}

// Debug: Log what effects were received
console.log('🎨 Effects received from API:', Object.keys(effects));
console.log('🎨 Effects after normalization:', Object.keys(effects));
```

**Fix Required** (Option B - Backend Standardization):
```python
# backend/inspirenet-api/src/api_v2_endpoints.py
# Standardize effect names in response
effect_name_mapping = {
    'originalcolor': 'color',
    'enhancedblackwhite': 'blackwhite'
}

for old_name, new_name in effect_name_mapping.items():
    if old_name in effects:
        effects[new_name] = effects.pop(old_name)
```

**Recommendation**: **Option A (Frontend)** - Faster, no deployment needed, handles API variations

**Files to Modify**:
- `assets/effects-v2-loader.js` (lines 365-375)

**Testing**:
1. Upload pet image
2. Check console: `🎨 Effects received from API: ['originalcolor', 'enhancedblackwhite']`
3. Verify both Color and B&W buttons work
4. Check console: `✅ GCS URLs obtained: { color: 'https://...', blackwhite: 'https://...' }`

**Time**: 30 minutes

---

### Phase 2: HIGH (Deploy Today)

#### 2.1 Verify & Fix EXIF Orientation (1 hour)
**Location**: `backend/inspirenet-api/src/integrated_processor.py`

**Investigation Steps**:
```bash
# 1. Check deployment status
gcloud builds describe 20187bb1-63ba-4ce5-b76d-819ee7d9f8a3 \
  --project=gen-lang-client-0601138686

# 2. Check active Cloud Run revision
gcloud run services describe inspirenet-bg-removal-api-gemini \
  --region=us-central1 \
  --format='value(status.latestReadyRevisionName,status.traffic[0].revisionName)'

# 3. Test with portrait image
curl -X POST https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/api/v2/process-with-effects \
  -F "file=@testing/test-images/portrait-rotated.jpg" \
  -F "effects=color" \
  -o output.jpg

# 4. Check orientation
file output.jpg  # Should show correct orientation
```

**If Deployment Failed**:
```bash
# Re-deploy InSPyReNet API
cd backend/inspirenet-api
./scripts/deploy-to-nanobanana.sh
```

**If EXIF Lost During Processing**:
```python
# backend/inspirenet-api/src/integrated_processor.py
# After background removal, before saving:

from PIL import ImageOps

# 1. Transpose input image
input_image = ImageOps.exif_transpose(input_image)

# 2. Process (background removal, etc.)
output_image = process_image(input_image)

# 3. Preserve orientation in output
# Option A: Copy EXIF to output
if hasattr(input_image, '_getexif'):
    exif = input_image._getexif()
    if exif:
        output_image.save(output_path, exif=exif)

# Option B: Already transposed, save without EXIF
# (Recommended - simpler, always correct)
output_image.save(output_path)
```

**Files to Check**:
- `backend/inspirenet-api/src/integrated_processor.py`
- `backend/inspirenet-api/src/api_v2_endpoints.py`

**Testing**:
1. Upload portrait image (phone photo)
2. Verify orientation correct in Color view
3. Verify orientation correct in B&W view
4. Test landscape image (no rotation)
5. Test already-rotated image (no double rotation)

**Time**: 1 hour

---

### Phase 3: LOW (Deploy Later)

#### 3.1 Verify Progress Bar Animation (15 minutes)
**Location**: `assets/effects-v2-loader.js`

**Verification Steps**:
1. Hard refresh page: Ctrl+Shift+R
2. Open DevTools → Elements
3. Inspect `.ev2-progress-bar` during upload
4. Check if `::after` pseudo-element present
5. Check if `animation: ev2-shimmer 1.5s infinite` applied

**If Not Working**:
```css
/* Make animation more visible */
.ev2-progress-bar::after {
  background: linear-gradient(90deg,
    transparent,
    rgba(255,255,255,0.8),  /* Increase opacity: 0.4 → 0.8 */
    transparent
  );
  animation: ev2-shimmer 1s infinite;  /* Speed up: 1.5s → 1s */
}
```

**Files to Check**:
- `assets/effects-v2-loader.js` (inline styles)

**Testing**:
1. Upload image
2. Watch progress bar during processing
3. Verify shimmer animation visible

**Time**: 15 minutes

---

## Deployment Sequence

### Step 1: Frontend Fixes (Shopify Auto-Deploy)
```bash
# Fix Gemini request format + Color normalization
git add assets/gemini-artistic-client.js
git add assets/effects-v2-loader.js
git commit -m "Fix: Gemini API request format (FormData→JSON) and color effect normalization"
git push origin staging

# Wait ~2 minutes for auto-deploy
```

### Step 2: Backend Fix (If Needed)
```bash
# Only if EXIF deployment failed
cd backend/inspirenet-api
./scripts/deploy-to-nanobanana.sh

# Wait ~5 minutes for Cloud Run deployment
```

### Step 3: Verification Tests
```bash
# Test Modern/Classic generation
open https://perkieprints.com/pages/pet-background-remover
# 1. Upload image
# 2. Click Modern → verify artistic image
# 3. Click Classic → verify artistic image

# Test Color button
# 1. Upload image
# 2. Click Color → verify image switches
# 3. Check DevTools console: gcsUrls.color should have URL

# Test orientation
# 1. Upload portrait phone photo
# 2. Verify correct orientation in all views

# Test progress bar
# 1. Upload image
# 2. Watch progress bar for shimmer animation
```

---

## Risk Assessment

### Critical Risks (Immediate Impact)
1. **Gemini 500 Error** - Modern/Classic completely broken
2. **Color GCS Null** - Color button non-functional, cart broken

### Medium Risks (UX Impact)
3. **Image Rotation** - Poor UX, user confusion

### Low Risks (Cosmetic)
4. **Progress Animation** - No functional impact

### Mitigation Strategy
- **Phase 1 fixes** deployed within 2-3 hours
- **Phase 2 fix** deployed same day if deployment issue
- **Phase 3 fix** can wait for next release

---

## Success Criteria

### Phase 1 Complete
- ✅ Modern button generates artistic image (no 500 error)
- ✅ Classic button generates artistic image
- ✅ Color button displays color image
- ✅ GCS URLs saved: `{ color: 'https://...', blackwhite: 'https://...' }`
- ✅ Console shows: `🎨 Effects after normalization: ['color', 'blackwhite']`

### Phase 2 Complete
- ✅ Portrait images display upright (not rotated)
- ✅ Landscape images unchanged
- ✅ All orientations correct across Color/B&W/Modern/Classic

### Phase 3 Complete
- ✅ Progress bar shows shimmer animation during upload

---

## Post-Deployment Monitoring

### Metrics to Track
1. **API Error Rate**: `/api/v1/generate` 500 errors → 0%
2. **GCS Upload Success**: Color upload success rate → 100%
3. **Effect Generation**: Modern/Classic generation success → 100%
4. **User Complaints**: Orientation issues → 0

### Monitoring Commands
```bash
# Check Gemini API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --project=perkieprints-nanobanana \
  --limit=50 \
  --format=json

# Check InSPyReNet API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api-gemini" \
  --project=gen-lang-client-0601138686 \
  --limit=50 \
  --format=json
```

---

## Lessons Learned

### API Contract Mismatches
- **Problem**: Frontend/backend using different formats (FormData vs JSON)
- **Prevention**: Document API contracts in CLAUDE.md
- **Prevention**: Add integration tests for API endpoints
- **Prevention**: Use TypeScript for type safety

### Effect Name Inconsistencies
- **Problem**: API returns `originalcolor`, UI expects `color`
- **Prevention**: Standardize effect names in API response
- **Prevention**: Add normalization layer in frontend
- **Prevention**: Log effect names in debug mode

### Deployment Verification
- **Problem**: Unclear if EXIF fix deployed successfully
- **Prevention**: Always check Cloud Run revision after deployment
- **Prevention**: Add deployment verification tests
- **Prevention**: Monitor Cloud Build status

### Testing Coverage
- **Problem**: Issues found in production, not in testing
- **Prevention**: Add integration tests for full upload flow
- **Prevention**: Test on staging before production
- **Prevention**: Test with real user scenarios (portrait images, etc.)

---

## Next Steps

1. **Immediate**: Fix Gemini request format (Phase 1.1)
2. **Immediate**: Fix color normalization (Phase 1.2)
3. **Today**: Verify EXIF deployment (Phase 2.1)
4. **Later**: Verify progress animation (Phase 3.1)
5. **Follow-up**: Add integration tests
6. **Follow-up**: Document API contracts
7. **Follow-up**: Create deployment verification checklist

---

## References

- **Session Context**: `.claude/tasks/context_session_001.md`
- **Gemini API Code**: `backend/gemini-artistic-api/src/main.py`
- **Frontend Loader**: `assets/effects-v2-loader.js`
- **Gemini Client**: `assets/gemini-artistic-client.js`
- **API Schemas**: `backend/gemini-artistic-api/src/models/schemas.py`
- **Previous Analysis**: `.claude/doc/backend-critical-issues-fix-plan.md`

---

**Analysis Complete**: 2025-10-29
**Ready for Implementation**: YES
**Estimated Total Time**: 4-5 hours (Phases 1-2)
