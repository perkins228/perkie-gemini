# Server-First Upload Phase 1: Infrastructure Verification Plan

**Date**: 2025-11-06
**Author**: Infrastructure Reliability Engineer
**Phase**: 1 of 6
**Estimated Time**: 30 minutes
**Risk Level**: MINIMAL (verification only, no code changes)

## Executive Summary

Phase 1 verifies that existing InSPyReNet API infrastructure supports direct uploads from the Shopify product page. This is a critical go/no-go gate before implementing server-first upload to resolve localStorage quota errors affecting 70% of mobile customers.

## Critical Context

### Current State
- **Problem**: localStorage quota exceeded errors on mobile (3.4MB base64 strings per pet)
- **Impact**: 70% of mobile users cannot complete multi-pet orders (2-3 pets)
- **Solution**: Upload directly to server, store 100-byte GCS URLs instead

### Infrastructure Requirements
1. **CORS**: InSPyReNet API must accept requests from Shopify domain
2. **Endpoint**: `/store-image` must accept FormData uploads
3. **Response**: Must return GCS URLs for temporary storage
4. **Authentication**: Should work without complex auth from frontend

## Verification Tasks

### Task 1.1: CORS Configuration Test (15 minutes)

**Purpose**: Verify API allows cross-origin requests from product page

**Test Method**:
1. User opens product page in browser
2. Opens browser DevTools console (F12)
3. Runs the following test:

```javascript
// CORS Health Check Test
// Expected: 200 status, no CORS errors
fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health', {
  method: 'GET',
  mode: 'cors',
  credentials: 'omit'
}).then(response => {
  console.log('✅ CORS Test Status:', response.status);
  console.log('✅ Headers:', response.headers.get('access-control-allow-origin'));
  return response.text();
}).then(text => {
  console.log('✅ Response:', text);
}).catch(error => {
  console.error('❌ CORS ERROR:', error);
  console.error('❌ This means CORS is not configured properly');
});
```

**Success Criteria**:
- ✅ Returns 200 status
- ✅ No CORS errors in console
- ✅ Headers include proper CORS configuration

**Failure Indicators**:
- ❌ CORS policy error
- ❌ Network error
- ❌ Access denied

### Task 1.2: Store-Image Endpoint Test (15 minutes)

**Purpose**: Verify endpoint accepts uploads and returns GCS URLs

**Test Method**:
1. User stays on product page
2. Runs this comprehensive test in console:

```javascript
// Store-Image Endpoint Test
// Creates a small test image and uploads it
console.log('Starting upload test...');

// Create a valid test image (1x1 pixel PNG)
const base64png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const byteString = atob(base64png);
const arrayBuffer = new ArrayBuffer(byteString.length);
const uint8Array = new Uint8Array(arrayBuffer);
for (let i = 0; i < byteString.length; i++) {
  uint8Array[i] = byteString.charCodeAt(i);
}
const testBlob = new Blob([uint8Array], {type: 'image/png'});
const testFile = new File([testBlob], 'test-pet-upload.png', {type: 'image/png'});

console.log('Test file created:', testFile.name, testFile.size, 'bytes');

// Prepare FormData with required fields
const formData = new FormData();
formData.append('file', testFile);
formData.append('image_type', 'original');
formData.append('tier', 'temporary');

console.log('Uploading to InSPyReNet API...');

// Upload with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image', {
  method: 'POST',
  body: formData,
  signal: controller.signal
}).then(response => {
  clearTimeout(timeoutId);
  console.log('✅ Upload Status:', response.status);
  console.log('✅ Response Headers:', {
    contentType: response.headers.get('content-type'),
    cors: response.headers.get('access-control-allow-origin')
  });
  return response.json();
}).then(result => {
  console.log('✅ Upload Response:', result);
  if (result.success && result.url) {
    console.log('✅✅✅ SUCCESS: GCS URL =', result.url);
    console.log('✅ URL Format:', result.url.startsWith('gs://') ? 'Valid GCS' : 'Invalid format');
    console.log('✅ Ready for Phase 2 implementation');
  } else {
    console.error('❌ FAILED: Unexpected response format');
    console.error('❌ Response:', result);
  }
}).catch(error => {
  if (error.name === 'AbortError') {
    console.error('❌ TIMEOUT: Request took longer than 30 seconds');
  } else {
    console.error('❌ Upload ERROR:', error);
    console.error('❌ Error Type:', error.name);
    console.error('❌ Error Message:', error.message);
  }
});
```

**Success Criteria**:
- ✅ Returns 200/201 status
- ✅ Response contains `{success: true, url: "gs://..."}`
- ✅ No CORS errors
- ✅ No authentication errors
- ✅ Response time < 30 seconds

**Failure Indicators**:
- ❌ 403/401 Authentication error
- ❌ 405 Method not allowed
- ❌ 500 Server error
- ❌ CORS policy error
- ❌ Timeout after 30 seconds
- ❌ No URL in response

## Expected Results

### Scenario A: Full Success (GO for Phase 2)
```
✅ CORS Test: 200 OK, proper headers
✅ Upload Test: 200 OK, returns GCS URL
Decision: PROCEED to Phase 2 implementation
```

### Scenario B: CORS Failure (FIXABLE)
```
❌ CORS Test: Blocked by CORS policy
✅ Upload Test: Not tested (blocked by CORS)
Decision: ADD CORS headers to API, then retry
Fix Required: Add Shopify domain to allowed origins
```

### Scenario C: Endpoint Failure (INVESTIGATE)
```
✅ CORS Test: 200 OK
❌ Upload Test: 404/405/500 error
Decision: INVESTIGATE endpoint configuration
Possible Issues:
- Endpoint not deployed
- Missing required fields
- File size/type restrictions
```

### Scenario D: Authentication Required (COMPLEX)
```
✅ CORS Test: 200 OK
❌ Upload Test: 401/403 error
Decision: EVALUATE authentication requirements
Options:
- Add public upload endpoint
- Implement token-based auth
- Use signed URLs instead
```

## User Instructions

### For Testing

1. **Open your Shopify product page** in Chrome/Edge browser
2. **Press F12** to open DevTools
3. **Click Console tab**
4. **Copy and paste Task 1.1 code**, press Enter
5. **Wait for results** (should be immediate)
6. **Copy and paste Task 1.2 code**, press Enter
7. **Wait for results** (up to 30 seconds)
8. **Screenshot the console output**
9. **Share results** for analysis

### What to Look For

**Green Checkmarks (✅)**: Things are working
**Red X's (❌)**: Problems detected
**Console Errors**: Red text indicates issues

## Risk Assessment

### No Risk (Verification Only)
- ✅ No code changes made
- ✅ No deployments required
- ✅ No production impact
- ✅ Read-only testing
- ✅ Uses minimal test data (< 1KB)

### Potential Findings Risk
- ⚠️ CORS not configured: 1-2 hour fix required
- ⚠️ Endpoint issues: 2-4 hour investigation
- ⚠️ Authentication required: 4-8 hour implementation

## Decision Matrix

| CORS Status | Endpoint Status | Decision | Next Action | Time Impact |
|-------------|-----------------|----------|-------------|-------------|
| ✅ Working | ✅ Working | **GO** | Proceed to Phase 2 | None |
| ❌ Blocked | - | **HOLD** | Configure CORS | +1-2 hours |
| ✅ Working | ❌ 404/405 | **HOLD** | Fix endpoint | +2-4 hours |
| ✅ Working | ❌ 401/403 | **HOLD** | Add auth | +4-8 hours |
| ✅ Working | ❌ 500 | **HOLD** | Debug server | +2-4 hours |

## Fallback Options

If infrastructure verification fails:

1. **Option A**: Fix infrastructure issues (1-8 hours additional)
2. **Option B**: Implement IndexedDB solution instead (19 hours total)
3. **Option C**: Deploy separate upload service (12 hours)
4. **Option D**: Use Shopify Files API (requires investigation)

## Success Metrics

### Phase 1 Success
- [x] CORS test executed
- [x] Upload test executed
- [ ] Results documented
- [ ] GO/NO-GO decision made

### Overall Project Success (Post-Implementation)
- 0% localStorage quota errors
- 100% multi-pet order completion
- <10 second total workflow
- >95% upload success rate with fallback

## Next Steps

### If GO Decision:
1. Proceed immediately to Phase 2: Upload Handler Implementation
2. Begin code modifications in `ks-product-pet-selector-stitch.liquid`
3. Implement retry logic and fallback mechanism
4. Expected time: 1.5 hours

### If NO-GO Decision:
1. Document exact failure points
2. Estimate fix time for each issue
3. Re-evaluate IndexedDB vs server-first approach
4. Schedule infrastructure fixes if viable

## Appendix: Technical Details

### Current InSPyReNet API Configuration
- **URL**: https://inspirenet-bg-removal-api-725543555429.us-central1.run.app
- **Project**: perkieprints-processing
- **Service**: inspirenet-bg-removal-api
- **Runtime**: Cloud Run with GPU
- **Region**: us-central1

### Expected /store-image Parameters
- `file`: Image file (multipart/form-data)
- `image_type`: "original" | "processed"
- `tier`: "temporary" | "permanent"
- Returns: `{success: boolean, url: string, error?: string}`

### Storage Configuration
- **Bucket**: perkieprints-processing-cache
- **Temporary TTL**: 24 hours
- **Format**: gs://bucket/path/to/file.ext

## Conclusion

Phase 1 is a critical verification step that requires no code changes and poses no risk. It will definitively determine whether we can proceed with the 6-hour server-first solution or need to pivot to the 19-hour IndexedDB approach. User testing in browser console provides immediate, actionable results.