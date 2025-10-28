# Backend Critical Issues Fix Implementation Plan

## Executive Summary
Three critical backend issues are blocking Effects V2 functionality in production. This plan provides step-by-step fixes prioritized by business impact.

**Total Estimated Time**: 2-3 hours
**Risk Level**: Low (all changes are isolated and reversible)

---

## Issue 1: Gemini API CORS Configuration [CRITICAL - 30 mins]

### Root Cause
The Gemini Artistic API (Cloud Run service) lacks CORS headers for production domain `https://perkieprints.com`, causing browser to block requests.

### Current State
- **File**: `backend/gemini-artistic-api/src/main.py`
- **Lines**: 39-55 (CORS middleware configuration)
- **Problem**: Missing production domains in allowed_origins list

### Required Changes

#### File: `backend/gemini-artistic-api/src/main.py`

**Line 41-51**: Update allowed_origins list
```python
# OLD (current):
allow_origins=[
    "https://perkieprints-test.myshopify.com",
    "https://testsite.perkieprints.com",
    # ... local development origins
]

# NEW (add production):
allow_origins=[
    # Production domains (ADD THESE)
    "https://perkieprints.com",
    "https://www.perkieprints.com",

    # Staging/test domains (keep existing)
    "https://perkieprints-test.myshopify.com",
    "https://testsite.perkieprints.com",
    "https://perkieprints-staging.myshopify.com",

    # Local development (keep existing)
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "null"
]
```

### Deployment Steps
1. Update `backend/gemini-artistic-api/src/main.py` with production domains
2. Test locally: `cd backend/gemini-artistic-api && python src/main.py`
3. Build Docker image: `docker build -t gemini-artistic-api .`
4. Deploy to Cloud Run:
   ```bash
   gcloud run deploy gemini-artistic-api \
     --image gcr.io/perkieprints-nanobanana/gemini-artistic-api:latest \
     --project perkieprints-nanobanana \
     --region us-central1 \
     --platform managed
   ```
5. Verify CORS headers:
   ```bash
   curl -X OPTIONS https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app/api/v1/generate \
     -H "Origin: https://perkieprints.com" \
     -H "Access-Control-Request-Method: POST" -v
   ```

### Verification
- Should see header: `Access-Control-Allow-Origin: https://perkieprints.com`
- Test from production site: Modern/Classic buttons should work

---

## Issue 2: GCS Upload 422 Error [HIGH - 45 mins]

### Root Cause Analysis Required
The `/store-image` endpoint exists in `backend/inspirenet-api/src/customer_image_endpoints.py` but is returning 422 (Unprocessable Content).

### Current State
- **File**: `backend/inspirenet-api/src/customer_image_endpoints.py`
- **Lines**: 33-137 (store_customer_image endpoint)
- **Expected Fields**: file, session_id, image_type, tier (with others optional)
- **Frontend Sending**: file, session_key (not session_id!), effect_name (not image_type!)

### Problem Identification
**FIELD NAME MISMATCH**:
- Frontend sends `session_key` → Backend expects `session_id`
- Frontend sends `effect_name` → Backend expects `image_type`

### Required Changes

#### Option A: Fix Frontend (RECOMMENDED - Less Risk)
**File**: `assets/pet-processor-unified.js` (or wherever the upload code is)

Find the FormData construction and update field names:
```javascript
// OLD:
formData.append('session_key', sessionKey);
formData.append('effect_name', effectName);

// NEW:
formData.append('session_id', sessionKey);  // Map session_key to session_id
formData.append('image_type', `processed_${effectName}`);  // Map effect_name to image_type
```

#### Option B: Fix Backend (Alternative - More Flexible)
**File**: `backend/inspirenet-api/src/customer_image_endpoints.py`

**Line 36-41**: Accept both field names
```python
# OLD:
session_id: str = Form(...),
image_type: str = Form(...),

# NEW:
session_id: str = Form(None, alias="session_key"),  # Accept both names
image_type: str = Form(None, alias="effect_name"),   # Accept both names

# Then add validation:
if not session_id:
    session_id = Form(...).get("session_key")  # Fallback
if not image_type:
    image_type = Form(...).get("effect_name")   # Fallback
```

### Debugging Steps
1. Check API logs for exact validation error:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api-gemini" --limit 50 --project gen-lang-client-0601138686
   ```
2. Test endpoint directly with correct fields:
   ```bash
   curl -X POST https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/store-image \
     -F "file=@test.jpg" \
     -F "session_id=test_123" \
     -F "image_type=processed_color" \
     -F "tier=temporary"
   ```
3. If successful, confirms field name issue

### Implementation Priority
Go with **Option A (Frontend fix)** as it's cleaner and maintains API contract consistency.

---

## Issue 3: EXIF Orientation Loss [MEDIUM - 1 hour]

### Root Cause
EXIF orientation metadata is handled inconsistently in the processing pipeline.

### Current State
- **File**: `backend/inspirenet-api/src/integrated_processor.py`
- **Line 162**: Uses `ImageOps.exif_transpose()` but may not be applied correctly
- **Problem**: Orientation correction happens but may be lost during tensor conversion

### Investigation Findings
The code DOES attempt EXIF correction (line 162), but the issue might be:
1. The correction is applied but then lost during numpy/tensor conversion
2. The correction is not being applied to the final output
3. The correction is working but frontend is rotating again

### Required Changes

#### File: `backend/inspirenet-api/src/inspirenet_model.py`

Add EXIF preservation to the main processing method:
```python
def process_image(self, image_data: bytes) -> bytes:
    """Process image with EXIF orientation preservation"""

    # 1. Load and auto-orient BEFORE any processing
    input_image = Image.open(BytesIO(image_data))

    # CRITICAL: Apply EXIF rotation first
    try:
        input_image = ImageOps.exif_transpose(input_image)
        if input_image is None:
            input_image = Image.open(BytesIO(image_data))
    except Exception as e:
        logger.warning(f"EXIF transpose failed: {e}")

    # 2. Convert to RGB if needed (preserves orientation)
    if input_image.mode != 'RGB':
        input_image = input_image.convert('RGB')

    # 3. Continue with existing processing...
    # [rest of the method stays the same]
```

#### File: `backend/inspirenet-api/src/integrated_processor.py`

Ensure EXIF handling is consistent:
```python
# Line 160-170: Update the existing EXIF handling
try:
    # Apply EXIF orientation BEFORE any processing
    rotated_image = ImageOps.exif_transpose(input_image)
    if rotated_image is not None:
        input_image = rotated_image
        logger.info("Applied EXIF orientation correction")
    else:
        logger.warning("No EXIF orientation data found")
except Exception as e:
    logger.error(f"EXIF processing failed: {e}")
    # Continue with original image

# IMPORTANT: Ensure we're working with the rotated image throughout
```

### Testing Protocol
1. Create test images with different EXIF orientations:
   - Portrait (Orientation=6: Rotate 90 CW)
   - Landscape (Orientation=1: Normal)
   - Upside down (Orientation=3: Rotate 180)

2. Test each through the API:
   ```bash
   curl -X POST https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/remove-background \
     -F "file=@portrait_with_exif.jpg" \
     -o output.png
   ```

3. Verify output orientation matches original viewing orientation

### Alternative Quick Fix
If EXIF handling proves complex, add a flag to disable double-rotation:
```python
# In frontend, detect if image was already rotated
if (imageWasProcessedByBackend) {
    // Don't apply client-side EXIF correction
    skipExifRotation = true;
}
```

---

## Implementation Order & Timeline

### Phase 1: CRITICAL (Today - 30 mins)
1. **Fix Gemini CORS** [15 mins]
   - Update `main.py` with production origins
   - Deploy to Cloud Run
   - Verify with curl test
   - **Blocker**: Modern/Classic effects completely broken without this

### Phase 2: HIGH (Today - 45 mins)
2. **Fix GCS Upload Field Names** [30 mins]
   - Update frontend FormData field names OR
   - Update backend to accept both field names
   - Test upload functionality
   - **Impact**: Cart functionality broken without this

3. **Quick EXIF Investigation** [15 mins]
   - Test if issue is backend or frontend
   - Determine if double-rotation is occurring
   - Plan proper fix approach

### Phase 3: MEDIUM (Tomorrow - 1 hour)
4. **Implement EXIF Fix** [45 mins]
   - Update image processing pipeline
   - Add comprehensive EXIF handling
   - Test with various orientations
   - **Impact**: Poor UX but not blocking sales

5. **Verification & Documentation** [15 mins]
   - Run full end-to-end tests
   - Update deployment documentation
   - Log all changes in session context

---

## Risk Mitigation

### Rollback Plan
Each change can be rolled back independently:
1. **CORS**: Redeploy previous Cloud Run revision
2. **Field Names**: Revert frontend or backend changes
3. **EXIF**: Feature flag to disable if issues arise

### Monitoring
- Watch Cloud Run logs during deployment
- Monitor error rates in production
- Check Shopify conversion metrics

### Testing Checklist
- [ ] CORS headers present for perkieprints.com
- [ ] Modern effect generates image
- [ ] Classic effect generates image
- [ ] Images upload to GCS successfully
- [ ] Images appear in cart correctly
- [ ] Portrait images display right-side-up
- [ ] Landscape images display correctly
- [ ] No JavaScript errors in console

---

## Critical Commands Reference

### View Cloud Run Logs
```bash
# Gemini API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" --limit 20 --project perkieprints-nanobanana

# InSPyReNet API logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api-gemini" --limit 20 --project gen-lang-client-0601138686
```

### Deploy Updates
```bash
# Gemini API
cd backend/gemini-artistic-api
gcloud run deploy gemini-artistic-api --source . --project perkieprints-nanobanana --region us-central1

# InSPyReNet API
cd backend/inspirenet-api
./scripts/deploy-to-nanobanana.sh
```

### Test Endpoints
```bash
# Test CORS
curl -I -X OPTIONS <API_URL>/endpoint \
  -H "Origin: https://perkieprints.com" \
  -H "Access-Control-Request-Method: POST"

# Test upload
curl -X POST <API_URL>/store-image \
  -F "file=@test.jpg" \
  -F "session_id=test" \
  -F "image_type=processed"
```

---

## Success Criteria
1. ✅ Modern/Classic effects work on perkieprints.com
2. ✅ Images upload to GCS without 422 errors
3. ✅ Portrait images display with correct orientation
4. ✅ No console errors in production
5. ✅ All tests pass in staging before production

---

## Notes & Assumptions
- Assuming Cloud Run deployments don't require infrastructure changes
- Assuming we have deployment permissions for both projects
- Assuming frontend code is accessible for field name updates
- EXIF handling may require additional testing with real customer images
- Consider adding monitoring/alerting for these specific endpoints

---

## Next Steps After Implementation
1. Monitor error rates for 24 hours
2. Check conversion metrics
3. Gather user feedback on image orientation
4. Consider implementing progress indicators for Gemini processing
5. Add integration tests for cross-origin requests