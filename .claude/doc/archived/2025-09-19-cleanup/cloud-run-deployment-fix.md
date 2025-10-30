# Cloud Run Deployment Fix Implementation Plan

**Date**: August 16, 2025  
**Issue**: Docker build failing with libgl1-mesa-glx package error despite Dockerfile updates  
**Root Cause**: Cloud Build cache using outdated Dockerfile + debian package changes

## Root Cause Analysis

The deployment is failing because:
1. **Cloud Build Cache**: Google Cloud Build is using a cached layer from an older Dockerfile that still references `libgl1-mesa-glx`
2. **Debian Package Changes**: The package `libgl1-mesa-glx` has been replaced by `libgl1` in newer Debian images
3. **Cache Invalidation Issue**: The cache bust comment at line 76 isn't sufficient to force a rebuild
4. **Build Context**: The `--source .` flag may be picking up cached build artifacts

## Implementation Plan

### Step 1: Force Clean Build (Immediate Fix)
**File**: `backend/inspirenet-api/scripts/deploy-clean-build.sh`
**Action**: Create new deployment script with cache-busting

```bash
#!/bin/bash
# Force clean build deployment script

# Delete any local build artifacts
rm -rf .build/
rm -rf __pycache__/

# Update Dockerfile with timestamp to force rebuild
echo "# Cache bust: $(date)" >> Dockerfile

# Deploy with explicit no-cache flags
gcloud builds submit \
    --config=cloudbuild-nocache.yaml \
    --substitutions=_DEPLOY_REGION=us-central1,_SERVICE_NAME=inspirenet-bg-removal-api \
    --timeout=30m \
    .
```

### Step 2: Create No-Cache Cloud Build Config
**File**: `backend/inspirenet-api/cloudbuild-nocache.yaml`
**Action**: Create explicit build configuration

```yaml
steps:
  # Build the container image with no cache
  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'build'
      - '--no-cache'  # Force fresh build
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/pet-bg-removal/${_SERVICE_NAME}:latest'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/pet-bg-removal/${_SERVICE_NAME}:${SHORT_SHA}'
      - '.'
    timeout: 900s

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/pet-bg-removal/${_SERVICE_NAME}'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${_SERVICE_NAME}'
      - '--image=us-central1-docker.pkg.dev/$PROJECT_ID/pet-bg-removal/${_SERVICE_NAME}:${SHORT_SHA}'
      - '--region=${_DEPLOY_REGION}'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--max-instances=3'
      - '--min-instances=0'
      - '--concurrency=1'
      - '--cpu=8'
      - '--memory=32Gi'
      - '--timeout=600s'
      - '--gpu=1'
      - '--gpu-type=nvidia-l4'
      - '--set-env-vars=INSPIRENET_MODE=base,INSPIRENET_RESIZE=static,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,ENABLE_GPU_OPTIMIZATIONS=true,LOG_LEVEL=info'

timeout: 1800s
options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

### Step 3: Update Dockerfile (Already Done, But Verify)
**File**: `backend/inspirenet-api/Dockerfile`
**Status**: Already updated with `libgl1` instead of `libgl1-mesa-glx`
**Action**: No changes needed, current version is correct

### Step 4: Alternative Deployment Method (If Above Fails)
**File**: `backend/inspirenet-api/scripts/deploy-prebuilt.sh`
**Action**: Build locally and push manually

```bash
#!/bin/bash
# Build locally and push to Artifact Registry

PROJECT_ID="perkieprints-processing"
SERVICE_NAME="inspirenet-bg-removal-api"
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE_URI="us-central1-docker.pkg.dev/${PROJECT_ID}/pet-bg-removal/${SERVICE_NAME}:${IMAGE_TAG}"

# Build locally with no cache
docker build --no-cache -t ${IMAGE_URI} .

# Push to Artifact Registry
docker push ${IMAGE_URI}

# Deploy the specific image
gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE_URI} \
    --region=us-central1 \
    --platform=managed \
    --allow-unauthenticated \
    --max-instances=3 \
    --min-instances=0 \
    --concurrency=1 \
    --cpu=8 \
    --memory=32Gi \
    --timeout=600s \
    --gpu=1 \
    --gpu-type=nvidia-l4 \
    --set-env-vars="INSPIRENET_MODE=base,INSPIRENET_RESIZE=static,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,ENABLE_GPU_OPTIMIZATIONS=true,LOG_LEVEL=info"
```

### Step 5: Verify Storage Endpoint Integration
**File**: `backend/inspirenet-api/src/main.py`
**Status**: Already imports and registers `simple_storage_api`
**Action**: No changes needed

## Critical Notes & Assumptions

### Infrastructure Constraints (DO NOT CHANGE)
- **GPU**: Must remain NVIDIA L4 (specified as `--gpu-type=nvidia-l4`)
- **Memory**: Must remain 32Gi for model loading
- **Region**: us-central1 (GPU availability)
- **Concurrency**: 1 request per instance (GPU memory constraints)

### Build Issues Resolution
- The root cause is **Cloud Build cache**, not the Dockerfile itself
- Using `--no-cache` flag forces Docker to rebuild all layers
- Alternative: Delete the Artifact Registry image to force complete rebuild

### Storage Endpoint
- New endpoint `/api/storage/upload` is already integrated in main.py
- Uses `perkieprints-customer-images` bucket
- Returns public URLs for Shopify order properties

### Cost Considerations
- Min instances = 0 for cost optimization ($0 base cost)
- GPU instances cost ~$0.065 per image processed
- Cloud Scheduler warmup during business hours (9AM-9PM)

## Deployment Sequence

1. **Immediate Action**: Run the clean build script
   ```bash
   cd backend/inspirenet-api
   chmod +x scripts/deploy-clean-build.sh
   ./scripts/deploy-clean-build.sh
   ```

2. **If Still Failing**: Use Cloud Build config
   ```bash
   gcloud builds submit --config=cloudbuild-nocache.yaml .
   ```

3. **Last Resort**: Build and push manually
   ```bash
   ./scripts/deploy-prebuilt.sh
   ```

4. **Verification**: Test endpoints
   ```bash
   # Health check
   curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health
   
   # Model info
   curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info
   
   # Storage endpoint (should return 422 without data)
   curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/storage/upload
   ```

## Why This Will Work

1. **Cache Bypass**: The `--no-cache` flag forces Docker to ignore all cached layers
2. **Explicit GPU Type**: Using `--gpu-type=nvidia-l4` ensures correct GPU allocation
3. **Clean Build Context**: Removing local artifacts prevents contamination
4. **Direct Image Specification**: Using specific image tags prevents version confusion

## Monitoring After Deployment

- Check Cloud Run logs for startup errors
- Verify GPU allocation in metrics
- Test cold start time (should be 30-60s)
- Confirm storage endpoint responds correctly
- Monitor memory usage (should stay under 80%)

## Rollback Plan

If deployment fails or causes issues:
```bash
# Rollback to working revision
gcloud run services update-traffic inspirenet-bg-removal-api \
    --to-revisions=inspirenet-bg-removal-api-00070-2ch=100 \
    --region=us-central1
```

This plan addresses the root cause (build cache) while maintaining all critical infrastructure requirements.