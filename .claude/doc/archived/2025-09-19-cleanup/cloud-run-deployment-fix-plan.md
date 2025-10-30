# Cloud Run Deployment Fix Implementation Plan

## Executive Summary
The InSPyReNet API deployment is failing due to Cloud Build's automatic detection system confusing this as a Node.js project instead of Python. The share-image endpoint code exists and is in the OpenAPI spec, but recent deployments are creating Node.js containers that fail to start.

## Root Cause Analysis

### Primary Issue: Node.js vs Python Detection
1. **Root Directory Contains Node.js Files**:
   - `package.json`, `package-lock.json`, and `node_modules/` exist in Production root
   - These are for the Shopify theme (frontend) development
   
2. **Cloud Build Buildpacks Detection**:
   - When using `gcloud run deploy --source .`, Google Cloud Buildpacks auto-detect project type
   - Presence of package.json causes Node.js buildpack selection
   - Creates container looking for `/workspace/index.js` instead of running Python

3. **Evidence from Logs**:
   ```
   Error: Cannot find module '/workspace/index.js'
   ```
   - This confirms Node.js runtime is being used instead of Python

### Secondary Issues
1. **GPU Quota**: Previously resolved by setting max-instances=1
2. **GCS_BUCKET_NAME**: Already added to deploy-production-clean.yaml
3. **Share-image endpoint**: Code exists and is registered in OpenAPI spec

## Current State Assessment

### Working Components
- ✅ Share-image endpoint code exists (api_v2_endpoints.py:655-746)
- ✅ OpenAPI spec includes /api/v2/share-image endpoint
- ✅ GCS_BUCKET_NAME environment variable configured
- ✅ GPU quota issue resolved (max-instances=1)
- ✅ Revision 00084-yiq serving traffic successfully

### Broken Components
- ❌ Latest deployments create Node.js containers
- ❌ Buildpack detection selecting wrong runtime
- ❌ Container fails to start (looking for index.js)

## Implementation Plan

### Phase 1: Immediate Fix - Force Python Dockerfile (15 minutes)

#### Option A: Deploy with Explicit Docker Build (RECOMMENDED)
```bash
cd backend/inspirenet-api

# Build Docker image locally
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=perkieprints-processing \
  --substitutions=_PROJECT_ID=perkieprints-processing

# This uses explicit Dockerfile, bypassing buildpack detection
```

#### Option B: Deploy Pre-built Image
```bash
cd backend/inspirenet-api

# Deploy using the image specified in deploy-production-clean.yaml
gcloud run services replace deploy-production-clean.yaml \
  --region=us-central1 \
  --project=perkieprints-processing
```

### Phase 2: Prevent Future Issues (30 minutes)

#### 1. Create Procfile for Explicit Python Declaration
**File**: `backend/inspirenet-api/Procfile`
```
web: python src/main.py
```

#### 2. Update .gcloudignore to Exclude Parent Files
**File**: `backend/inspirenet-api/.gcloudignore`
```
# Explicitly exclude all parent directory Node.js files
../*
../../*

# Include only necessary files
!Dockerfile
!requirements.txt
!src/**
!Procfile
```

#### 3. Create project.toml for Buildpack Configuration
**File**: `backend/inspirenet-api/project.toml`
```toml
[[build.env]]
name = "GOOGLE_RUNTIME"
value = "python"

[[build.env]]
name = "GOOGLE_RUNTIME_VERSION"
value = "3.11"
```

### Phase 3: Verify Deployment (15 minutes)

#### 1. Check Deployment Status
```bash
# Get latest revision
gcloud run services describe inspirenet-bg-removal-api \
  --region=us-central1 \
  --format="get(status.traffic[0].revisionName)"

# Check revision logs
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=inspirenet-bg-removal-api AND \
   resource.labels.revision_name=[REVISION_NAME]" \
  --limit=50
```

#### 2. Test Share-Image Endpoint
```bash
# Test health check
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Test share-image endpoint exists
curl -X POST \
  https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/share-image \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.jpg" \
  -F "platform=facebook" \
  -F "effect_type=enhancedblackwhite"
```

#### 3. Verify with Playwright
- Navigate to staging URL
- Upload image and process
- Click share button
- Confirm no 404 errors

## Alternative Solutions Considered

### 1. Move Backend to Separate Repository
- **Pros**: Complete isolation from frontend Node.js files
- **Cons**: Complicates development workflow
- **Decision**: Not necessary if buildpack configuration works

### 2. Use Cloud Build Triggers
- **Pros**: Automated deployment on git push
- **Cons**: Already have GitHub integration for frontend
- **Decision**: Consider for future automation

### 3. Pre-build and Push Docker Images
- **Pros**: Full control over container
- **Cons**: Requires container registry management
- **Decision**: Use cloudbuild.yaml approach (hybrid)

## Risk Mitigation

### Deployment Risks
1. **Risk**: Breaking currently working service
   - **Mitigation**: Deploy to new revision, test before routing traffic
   
2. **Risk**: Cold start performance degradation
   - **Mitigation**: Maintain current warming strategies
   
3. **Risk**: Cost increase from failed deployments
   - **Mitigation**: Set deployment timeout limits

### Rollback Plan
```bash
# If new deployment fails, route traffic back to working revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=inspirenet-bg-removal-api-00084-yiq=100 \
  --region=us-central1
```

## Success Criteria

### Immediate Success (Day 1)
- [ ] Python container deploys successfully
- [ ] Share-image endpoint returns 200/422 (not 404)
- [ ] Social sharing works on desktop
- [ ] No Node.js errors in logs

### Long-term Success (Week 1)
- [ ] 25-35% desktop share rate achieved
- [ ] Viral coefficient increases by 15-20%
- [ ] No deployment failures from buildpack confusion
- [ ] Monitoring alerts configured

## Cost Implications

### Current State
- Failed deployments: ~$5-10/day in wasted build resources
- Missing viral growth: ~$500-1000/month opportunity cost

### After Fix
- Clean deployments: $0.50/deployment
- Restored viral growth: +$500-1000/month revenue
- ROI: 100x within first month

## Timeline

### Day 1 (Today)
1. **Hour 1**: Execute Phase 1 - Force Python deployment
2. **Hour 2**: Verify deployment and test endpoints
3. **Hour 3**: Update staging and test with Playwright

### Day 2
1. Implement Phase 2 preventive measures
2. Document deployment process
3. Set up monitoring alerts

## Key Commands for Immediate Execution

```bash
# Navigate to API directory
cd backend/inspirenet-api

# Option 1: Use Cloud Build with explicit Dockerfile
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=perkieprints-processing

# Option 2: Direct deployment with YAML config
gcloud run services replace deploy-production-clean.yaml \
  --region=us-central1

# Verify deployment
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/openapi.json | grep share-image

# Test actual endpoint
# Create test file first
echo "test" > test.txt

# Test endpoint (will fail validation but proves endpoint exists)
curl -X POST \
  https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/share-image \
  -F "file=@test.txt" \
  -F "platform=facebook"
```

## Monitoring Post-Deployment

### Key Metrics to Track
1. **Endpoint Availability**: /api/v2/share-image returns non-404
2. **Container Type**: Logs show Python/Uvicorn, not Node.js
3. **Share Success Rate**: Track successful shares vs attempts
4. **Cold Start Time**: Monitor first request latency

### Alert Configuration
```yaml
# Cloud Monitoring alert for 404s on share-image
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
jsonPayload.path="/api/v2/share-image"
jsonPayload.status=404
```

## Conclusion

The root cause is definitively identified: Cloud Build's buildpack detection is choosing Node.js due to package.json files in the parent directory. The solution is straightforward - force Python deployment using explicit Dockerfile through cloudbuild.yaml. This will restore the share-image endpoint functionality and enable viral growth at the peak excitement moment.

**Next Action**: Execute the Cloud Build command to deploy Python container with share-image endpoint.

---

*Document created: 2025-08-28*
*Priority: CRITICAL - Blocking viral growth feature*
*Estimated Resolution: 1-2 hours*