# Clean Cloud Run Deployment Plan for Share-Image Endpoint Fix

## Issue Summary

**Problem**: The `/api/v2/share-image` endpoint returns 404 Not Found despite:
- Code existing in `src/api_v2_endpoints.py` lines 655-746
- `GCS_BUCKET_NAME` environment variable properly configured
- Multiple deployment attempts completed

**Root Cause**: The deployed Docker container is using cached layers that don't include the share-image endpoint code. The endpoint was added AFTER the currently deployed image was built.

**Evidence**:
- OpenAPI spec at `/openapi.json` does NOT list the share-image endpoint
- Health endpoint shows recent timestamps (deployment successful)
- Other API v2 endpoints working normally
- Current deployed image: `inspirenet-bg-removal-api:critical-fix`

## Business Impact

- **Current State**: Desktop social sharing completely broken (30% of traffic)
- **Lost Viral Growth**: ~15-20% viral coefficient reduction at peak excitement moment
- **User Experience**: Users can process images but can't share them on desktop
- **Expected Recovery**: 25-35% desktop share rate once fixed

## Critical Constraints

1. **MUST maintain min-instances=0** to avoid $65-100/day GPU costs
2. **max-instances=1** due to GPU quota limits (recently reduced from 3)
3. **Cold starts acceptable** - using frontend warming strategies
4. **Cost control paramount** - this is a NEW BUILD, not yet with customers

## Deployment Strategy

### Phase 1: Clean Docker Build and Deploy (IMMEDIATE)

#### Step 1: Navigate to API Directory
```bash
cd C:\Users\perki\OneDrive\Desktop\Perkie\Production\backend\inspirenet-api
```

#### Step 2: Force Clean Build with No Cache
```bash
gcloud run deploy inspirenet-bg-removal-api \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --max-instances 1 \
    --min-instances 0 \
    --concurrency 1 \
    --cpu 8 \
    --memory 32Gi \
    --timeout 600s \
    --gpu 1 \
    --no-cache \
    --set-env-vars "INSPIRENET_MODE=base,INSPIRENET_RESIZE=static,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,GCS_BUCKET_NAME=perkieprints-processing-cache,ENABLE_GPU_OPTIMIZATIONS=true,LOG_LEVEL=info" \
    --tag share-fix
```

**Key Changes**:
- `--no-cache` forces complete rebuild without Docker layer caching
- `GCS_BUCKET_NAME=perkieprints-processing-cache` included in env vars
- `--tag share-fix` for deployment tracking
- `--max-instances 1` respects GPU quota limits
- `--min-instances 0` maintains cost control

### Phase 2: Verification Steps (5-10 minutes after deployment)

#### Step 1: Check OpenAPI Specification
```bash
curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/openapi.json | grep share-image
```
**Expected**: Should return the share-image endpoint definition

#### Step 2: Test Share-Image Endpoint Directly
```bash
# Create a test image file (1x1 pixel PNG)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > test.png

# Test the endpoint
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/share-image \
  -F "image=@test.png" \
  -F "platform=facebook" \
  -v
```
**Expected**: Either 200 OK with URL or 422/500 error (not 404)

#### Step 3: Verify Deployment Success
```bash
gcloud run services describe inspirenet-bg-removal-api --region us-central1 --format="value(status.latestReadyRevisionName)"
```
**Expected**: New revision number with share-fix tag

#### Step 4: Check Container Logs
```bash
gcloud run logs read --service inspirenet-bg-removal-api --region us-central1 --limit 50
```
**Look for**:
- "Share image endpoint registered" or similar
- No import errors for api_v2_endpoints
- Successful startup messages

### Phase 3: End-to-End Testing (10 minutes)

1. **Navigate to staging URL**: https://cf8yreszgs2ojdih-2930573424.shopifypreview.com/pages/custom-image-processing
2. **Upload test image** (Sam.jpg or any pet photo)
3. **Wait for processing** to complete
4. **Click social share button** (Facebook, Twitter, Pinterest)
5. **Verify**:
   - No 404 errors in console
   - Proper sharing modal/window opens
   - Image with watermark is shared (not just link)

### Alternative Approach (If Clean Deploy Fails)

#### Manual Docker Build and Push
```bash
# Build with explicit no-cache
docker build --no-cache -t gcr.io/perkieprints-processing/inspirenet-bg-removal-api:share-fix-manual .

# Push to Google Container Registry
docker push gcr.io/perkieprints-processing/inspirenet-bg-removal-api:share-fix-manual

# Deploy specific image
gcloud run deploy inspirenet-bg-removal-api \
    --image gcr.io/perkieprints-processing/inspirenet-bg-removal-api:share-fix-manual \
    --region us-central1 \
    --platform managed \
    --max-instances 1 \
    --min-instances 0 \
    [other flags as above]
```

## Expected Timeline

- **Deployment Build**: 15-20 minutes (complete Docker rebuild)
- **Container Startup**: 2-3 minutes
- **Verification**: 5-10 minutes
- **Total Time**: 25-35 minutes

## Risks and Mitigations

### Risk 1: Deployment Fails Due to GPU Quota
- **Mitigation**: Already reduced max-instances to 1
- **Fallback**: Deploy without GPU temporarily for testing

### Risk 2: Code Has Syntax/Import Errors
- **Mitigation**: Test locally first
```bash
cd backend/inspirenet-api
python src/main.py
# Check if server starts and /api/v2/share-image registers
```

### Risk 3: GCS Permissions Issue
- **Mitigation**: Using existing bucket with proven permissions
- **Verification**: Other endpoints already use same bucket successfully

### Risk 4: Cold Start Times After Deploy
- **Expected**: First request will take 30-60s (model loading)
- **Mitigation**: Frontend warming already implemented
- **User Impact**: Minimal - warming happens on page load

## Success Criteria

✅ **Technical Success**:
- `/api/v2/share-image` returns 200 OK (not 404)
- OpenAPI spec includes share-image endpoint
- Social sharing works end-to-end on desktop
- No console errors related to 404s

✅ **Business Success**:
- Desktop share rate increases from 0% to 25-35%
- Viral coefficient improves by 15-20%
- User satisfaction with sharing functionality
- Peak excitement moment properly captured

## Post-Deployment Monitoring

1. **Check Share Rate Metrics** (after 24 hours)
   - Monitor Google Analytics for share events
   - Track platform-specific sharing rates

2. **Monitor Costs**
   - Verify min-instances=0 maintained
   - Check daily GPU costs remain near $0
   - Monitor GCS storage costs ($5-20/month expected)

3. **Error Monitoring**
   - Check Cloud Run logs for errors
   - Monitor frontend console for issues
   - Track user complaints about sharing

## Rollback Plan

If deployment causes critical issues:

```bash
# Rollback to previous revision
gcloud run services update-traffic inspirenet-bg-removal-api \
    --region us-central1 \
    --to-revisions PREVIOUS_REVISION=100
```

**Note**: Get PREVIOUS_REVISION from:
```bash
gcloud run revisions list --service inspirenet-bg-removal-api --region us-central1
```

## Key Commands Summary

```bash
# Main deployment command
cd backend/inspirenet-api
gcloud run deploy inspirenet-bg-removal-api --source . --no-cache --region us-central1 --max-instances 1 --min-instances 0 --gpu 1 --memory 32Gi --cpu 8 --tag share-fix --set-env-vars "GCS_BUCKET_NAME=perkieprints-processing-cache,[other vars]"

# Verification
curl -s https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/openapi.json | grep share-image

# Logs
gcloud run logs read --service inspirenet-bg-removal-api --region us-central1 --limit 50
```

## Contact for Issues

If deployment issues arise:
1. Check Cloud Run console for detailed error messages
2. Review container startup logs
3. Test endpoint with curl before frontend testing
4. Verify all environment variables are set correctly

---

**Document Status**: COMPLETE
**Priority**: CRITICAL - Social sharing broken for 30% of traffic
**Estimated Fix Time**: 25-35 minutes
**Cost Impact**: Maintains $0 base cost with min-instances=0