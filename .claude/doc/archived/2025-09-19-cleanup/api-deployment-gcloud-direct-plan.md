# API Deployment Plan - Direct gcloud run deploy Method

## Executive Summary
Deploy the InSPyReNet Background Removal API using the direct `gcloud run deploy --source` method (Option 2) to bypass Docker package issues encountered with Cloud Build. This approach simplifies deployment while maintaining all security and storage features.

## Current Situation Analysis

### Problem Context
- **Docker Build Failure**: cloudbuild.yaml failing due to package installation issues
- **Root Cause**: opencv-python-headless conflicts in Docker environment
- **Impact**: Unable to deploy critical security fixes and storage endpoints
- **Code Status**: All application code ready and tested locally

### Infrastructure State
- **Project**: perkieprints-processing
- **Service**: inspirenet-bg-removal-api
- **Current Revision**: inspirenet-bg-removal-api-00070-2ch (3 days old)
- **Region**: us-central1
- **GPU**: NVIDIA L4 with 32Gi memory
- **Storage Buckets**: perkieprints-customer-images configured with public access

## Deployment Strategy: Direct gcloud run deploy

### Why This Approach
1. **Bypasses Docker Issues**: Cloud Run builds container automatically
2. **Simpler Process**: Single command deployment
3. **Production Ready**: Same result as Cloud Build
4. **Faster Iteration**: No intermediate Docker registry steps
5. **Proven Success**: deploy-model-fix.sh already uses this method

### Pre-Deployment Checklist

#### 1. Code Verification
```bash
# Verify all security fixes are in place
grep -r "MAX_FILE_SIZE" backend/inspirenet-api/src/
grep -r "validate_image_data" backend/inspirenet-api/src/
grep -r "sanitize_filename" backend/inspirenet-api/src/

# Check storage endpoint exists
grep -r "/api/storage/upload" backend/inspirenet-api/src/
```

#### 2. Configuration Files
- **Verify .gcloudignore exists** with:
  ```
  **/tests/
  **/__pycache__/
  **/*.pyc
  .git/
  .gitignore
  README.md
  scripts/
  *.sh
  cloudbuild.yaml
  deploy-staging.yaml
  ```

#### 3. Environment Readiness
```bash
# Verify gcloud configuration
gcloud config get-value project  # Should show: perkieprints-processing
gcloud config get-value account  # Should show your account
gcloud auth application-default print-access-token  # Should succeed
```

## Deployment Command Structure

### Base Command (Recommended)
```bash
cd backend/inspirenet-api

gcloud run deploy inspirenet-bg-removal-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 3 \
  --min-instances 0 \
  --concurrency 1 \
  --cpu 8 \
  --memory 32Gi \
  --timeout 600s \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --set-env-vars "INSPIRENET_MODE=base,INSPIRENET_RESIZE=static,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,ENABLE_GPU_OPTIMIZATIONS=true,LOG_LEVEL=info,MAX_FILE_SIZE=10485760,DEPLOYMENT_ENV=production" \
  --tag secure-storage
```

### Additional Production Flags
```bash
# Add these for enhanced production deployment:
  --service-account inspirenet-api@perkieprints-processing.iam.gserviceaccount.com \
  --add-cloudsql-instances perkieprints-processing:us-central1:metrics \
  --update-labels environment=production,version=secure-storage \
  --revision-suffix secure-v1
```

## Step-by-Step Deployment Process

### Phase 1: Pre-Deployment Validation (5 minutes)

1. **Navigate to API directory**
   ```bash
   cd C:\Users\perki\OneDrive\Desktop\Perkie\Production\backend\inspirenet-api
   ```

2. **Run local syntax check**
   ```bash
   python -m py_compile src/*.py src/effects/*.py
   ```

3. **Verify storage bucket access**
   ```bash
   gsutil ls gs://perkieprints-customer-images/
   gsutil acl get gs://perkieprints-customer-images/
   ```

### Phase 2: Deploy with Monitoring (15-20 minutes)

1. **Execute deployment command**
   ```bash
   # Use the base command from above
   # Cloud Run will:
   # - Detect Python application
   # - Build container using buildpacks
   # - Push to Artifact Registry
   # - Deploy new revision
   ```

2. **Monitor build progress**
   - Watch for "Building using Buildpacks" message
   - Typical build time: 5-10 minutes
   - Look for "Successfully built image" confirmation

3. **Monitor deployment progress**
   - Watch for "Deploying Revision" message
   - GPU allocation may take 2-3 minutes
   - Look for "Service [inspirenet-bg-removal-api] revision [...] has been deployed"

### Phase 3: Post-Deployment Verification (10 minutes)

1. **Health Check**
   ```bash
   curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health
   # Expected: {"status":"healthy","model_loaded":false,"gpu_available":true}
   ```

2. **Model Info Check**
   ```bash
   curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info
   # Expected: JSON with model details
   ```

3. **Storage Endpoint Test**
   ```bash
   # Test new storage upload endpoint
   curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/storage/upload \
     -H "Content-Type: application/json" \
     -d '{
       "session_id": "test-123",
       "images": {
         "original": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
       },
       "metadata": {"test": true}
     }'
   # Expected: {"urls": {...}, "session_id": "test-123"}
   ```

4. **Warmup Test (Optional)**
   ```bash
   curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
     --max-time 120
   # Expected: {"status":"warmed","model_loaded":true}
   ```

5. **Check Revision Status**
   ```bash
   gcloud run services describe inspirenet-bg-removal-api \
     --region us-central1 \
     --format "value(status.latestReadyRevisionName)"
   ```

## Rollback Strategy

### If Deployment Fails
```bash
# Rollback to previous working revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --region us-central1 \
  --to-revisions inspirenet-bg-removal-api-00070-2ch=100
```

### If Issues Found After Deployment
```bash
# List all revisions
gcloud run revisions list \
  --service inspirenet-bg-removal-api \
  --region us-central1

# Route traffic back to stable revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION_NAME=100
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **Build Fails with Package Errors**
   - Solution: Cloud Run buildpacks handle dependencies better than manual Docker
   - If persists: Remove problematic packages from requirements.txt temporarily

2. **GPU Not Available**
   - Check: Ensure `--gpu 1 --gpu-type nvidia-l4` flags are included
   - Verify: Region us-central1 supports L4 GPUs

3. **Storage Permission Errors**
   - Check: Service account has storage.objectAdmin role
   - Verify: Bucket CORS allows API domain

4. **Cold Start Too Long**
   - Expected: First request takes 30-60s
   - Solution: Implement frontend warming on page load

5. **Memory Errors**
   - Check logs: `gcloud run logs read --service inspirenet-bg-removal-api`
   - Solution: May need to increase memory limit

## Success Criteria

### Deployment Success Indicators
- ✅ Health endpoint returns 200 OK
- ✅ Model info endpoint returns model details
- ✅ Storage upload endpoint accepts and returns URLs
- ✅ No error logs in first 5 minutes
- ✅ GPU metrics show availability

### Business Success Metrics
- ✅ Background removal processing works
- ✅ Storage URLs accessible from Shopify
- ✅ Cold start under 60 seconds
- ✅ Warm requests under 5 seconds

## Cost Considerations

### Estimated Costs
- **GPU Instance**: $0.00 when idle (minScale=0)
- **Processing**: ~$0.065 per image processed
- **Storage**: ~$0.02 per GB per month
- **Network**: ~$0.12 per GB egress

### Cost Optimization
- minScale=0 saves ~$65/day when no traffic
- Frontend warming reduces cold start complaints
- GCS caching reduces repeated processing

## Security Validations

### Implemented Security Features
- ✅ File size validation (10MB max)
- ✅ Content type validation (JPEG, PNG, WebP only)
- ✅ Filename sanitization
- ✅ Session ID validation
- ✅ Rate limiting headers

### Post-Deployment Security Check
```bash
# Test file size limit
curl -X POST [API_URL]/api/storage/upload \
  -d '{"images": {"original": "[11MB base64 string]"}}' \
  # Should return: 413 Payload Too Large

# Test invalid content type
curl -X POST [API_URL]/api/storage/upload \
  -d '{"images": {"original": "data:text/plain;base64,dGVzdA=="}}' \
  # Should return: 400 Bad Request
```

## Next Steps After Deployment

1. **Update Frontend Configuration**
   - Verify API URL in Shopify theme settings
   - Test pet processor end-to-end flow

2. **Monitor Performance**
   ```bash
   gcloud monitoring metrics-explorer
   # Monitor: CPU, Memory, GPU utilization
   ```

3. **Set Up Alerts**
   ```bash
   gcloud alpha monitoring policies create \
     --notification-channels=[CHANNEL_ID] \
     --display-name="API Error Rate High"
   ```

4. **Schedule Warming (Optional)**
   - Create Cloud Scheduler job for business hours
   - Hit /warmup endpoint every 10 minutes 9am-9pm

## Summary

The direct `gcloud run deploy --source` approach is the recommended deployment method because:
1. **Simplicity**: Single command, no Docker complexity
2. **Reliability**: Cloud Run buildpacks handle dependencies
3. **Speed**: Faster than debugging Docker issues
4. **Production-Ready**: Same result as Cloud Build
5. **Proven**: Already working in deploy-model-fix.sh

This deployment will enable the new storage endpoint at `/api/storage/upload` required for the Shopify integration while maintaining all GPU processing capabilities and security features.

## Questions Answered

1. **Is this the best approach given Docker issues?**
   - Yes, it bypasses Docker complexity while achieving the same result

2. **Additional flags for production?**
   - Add service account, labels, and revision suffix as shown above

3. **Pre-deployment checks?**
   - Code validation, bucket access, and gcloud auth verification

4. **Verification of success?**
   - Health check, storage endpoint test, and revision status confirmation