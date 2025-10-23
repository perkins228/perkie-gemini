# Share-Image Endpoint 404 Error - Root Cause Analysis & Implementation Plan

## Problem Summary

The `/api/v2/share-image` endpoint returns 404 "Not Found" despite:
- ✅ GCS_BUCKET_NAME environment variable being properly configured
- ✅ Endpoint definition existing in `backend/inspirenet-api/src/api_v2_endpoints.py` (lines 655-746)
- ✅ Router being included in main.py (line 161)
- ✅ Multiple redeployments attempted
- ✅ No Python syntax errors

## Root Cause Analysis

### Issue Confirmed
- **Current Status**: 404 Not Found for `POST /api/v2/share-image`
- **Expected**: 503 Service Unavailable (if CloudStorageManager fails) OR 400/422 (if request format wrong)
- **Actual Problem**: Endpoint is not registered in deployed FastAPI application

### Investigation Results

1. **Code Verification** ✅
   - Endpoint exists in `api_v2_endpoints.py` lines 655-746
   - Proper decorator: `@router.post("/share-image")`
   - Function signature correct: `async def upload_share_image(...)`
   - All imports present: `PIL`, `uuid`, `BytesIO`, etc.
   - No Python syntax errors

2. **Router Configuration** ✅
   - Router defined: `router = APIRouter(prefix="/api/v2", tags=["v2"])` (line 33)
   - Router included: `app.include_router(api_v2_router)` in main.py (line 161)

3. **Environment Variables** ✅
   - `GCS_BUCKET_NAME=perkieprints-processing-cache` deployed and verified
   - All required environment variables present

4. **Deployment Verification** ❌
   - OpenAPI spec does NOT include `/api/v2/share-image`
   - Multiple deployment attempts failed to register endpoint
   - Health endpoint shows recent timestamp (deployment successful)
   - Other API v2 endpoints working normally

### Likely Root Causes

1. **Docker Image Cache Issue**
   - Cloud Run may be using cached Docker layers that don't include latest code
   - `gcloud run deploy --source .` should rebuild, but may have cache issues

2. **File Not Included in Docker Build**
   - Changes to `api_v2_endpoints.py` may not be included in Docker image
   - Dockerfile might have copy issues or .dockerignore excluding changes

3. **Runtime Import Error**
   - Endpoint may fail to load due to import errors during runtime
   - Errors may be silent and not appear in OpenAPI spec

4. **Function Registration Failure**
   - FastAPI may skip endpoint registration due to runtime errors
   - Missing dependencies or import failures could cause silent skips

## Implementation Plan

### Phase 1: Force Clean Deployment (HIGH PRIORITY - 15 minutes)

1. **Build with No Cache**
   ```bash
   cd backend/inspirenet-api
   gcloud run deploy inspirenet-bg-removal-api \
       --source . \
       --region us-central1 \
       --no-cache \
       --tag share-image-debug \
       --set-env-vars "GCS_BUCKET_NAME=perkieprints-processing-cache,LOG_LEVEL=debug" \
       --max-instances 1 --min-instances 0 --allow-unauthenticated
   ```

2. **Verify Deployment**
   ```bash
   # Check OpenAPI spec for share-image endpoint
   curl -s "https://[URL]/openapi.json" | grep -i share
   
   # Test endpoint with proper multipart form data
   curl -X POST "https://[URL]/api/v2/share-image" \
        -F "file=@test-image.jpg" \
        -F "platform=facebook"
   ```

### Phase 2: Debug Deployment Issues (MEDIUM PRIORITY - 30 minutes)

1. **Check Container Logs**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api" \
       --limit 50 --format json
   ```

2. **Add Debug Logging**
   - Add endpoint registration confirmation in `api_v2_endpoints.py`
   - Log router initialization in main.py startup

3. **Test Local Environment**
   ```bash
   cd backend/inspirenet-api/src
   python -c "
   from api_v2_endpoints import router
   print('Router endpoints:', [route.path for route in router.routes])
   "
   ```

### Phase 3: Alternative Deployment Strategy (IF NEEDED - 45 minutes)

1. **Manual Docker Build**
   ```bash
   cd backend/inspirenet-api
   
   # Build image manually
   docker build -t share-image-fix .
   docker tag share-image-fix us-central1-docker.pkg.dev/perkieprints-processing/pet-bg-removal/inspirenet-bg-removal-api:share-image-fix
   docker push us-central1-docker.pkg.dev/perkieprints-processing/pet-bg-removal/inspirenet-bg-removal-api:share-image-fix
   
   # Deploy specific image
   gcloud run deploy inspirenet-bg-removal-api \
       --image us-central1-docker.pkg.dev/perkieprints-processing/pet-bg-removal/inspirenet-bg-removal-api:share-image-fix \
       --region us-central1
   ```

2. **Verify Code Inclusion**
   ```bash
   # Connect to deployed container and check files
   gcloud run services proxy inspirenet-bg-removal-api --port 8080
   # Check if api_v2_endpoints.py contains share-image endpoint
   ```

### Phase 4: Emergency Workaround (LAST RESORT - 60 minutes)

If endpoint registration continues to fail:

1. **Create Separate Sharing Service**
   - Deploy minimal sharing-only service
   - Update frontend to use different endpoint URL

2. **Move Endpoint to Different Router**
   - Add share-image to main.py directly instead of router
   - Test if router inclusion is the issue

## Expected Timeline & Success Criteria

- **Phase 1**: 15 minutes → Endpoint appears in OpenAPI spec
- **Phase 2**: 30 minutes → Identify root cause in logs
- **Phase 3**: 45 minutes → Manual deployment succeeds
- **Phase 4**: 60 minutes → Alternative solution working

### Success Criteria
- `GET /openapi.json` includes `/api/v2/share-image` endpoint
- `POST /api/v2/share-image` returns 422 (validation error) instead of 404
- Social sharing functionality restored on desktop
- Viral growth loop functional at peak excitement moment

## Business Impact

- **Current**: Desktop social sharing broken (30% of traffic)
- **Lost Opportunity**: ~15-20% of potential viral shares
- **Expected Fix Impact**: Restore 25-35% desktop share rate
- **Critical**: Peak excitement moment viral capture currently failing

## Next Steps

1. **Immediate**: Execute Phase 1 (no-cache deployment)
2. **If Phase 1 fails**: Move to Phase 2 (debug logs)
3. **Monitor**: Container startup logs during deployment
4. **Test**: Endpoint registration and basic functionality
5. **Validate**: End-to-end social sharing workflow

This is a **HIGH PRIORITY** fix required to restore core viral growth functionality at the most critical user engagement moment.