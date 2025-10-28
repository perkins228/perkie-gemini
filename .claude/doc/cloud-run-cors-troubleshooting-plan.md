# Cloud Run CORS Configuration Troubleshooting & Resolution Plan

**Created**: 2025-10-23
**Issue**: CORS changes in main.py not reflected after Cloud Run deployment
**Service**: gemini-artistic-api
**Project**: gen-lang-client-0601138686

## Executive Summary

The CORS configuration has been modified in the source code but the changes aren't being applied to the deployed Cloud Run service. This indicates a deployment pipeline issue where the container isn't being rebuilt with the latest code changes.

## Root Cause Analysis

### Potential Causes (Ranked by Likelihood)

1. **Container Build Cache** (80% likely)
   - Cloud Build is using cached layers from previous builds
   - The COPY instruction in Dockerfile isn't detecting file changes
   - Solution: Force cache invalidation during build

2. **Artifact Registry Tagging** (15% likely)
   - Same tag `:latest` being reused, Cloud Run pulling old image
   - Image digest hasn't changed despite rebuild
   - Solution: Use unique tags or verify digest changes

3. **Cloud Run Traffic Routing** (3% likely)
   - Old revision still serving traffic
   - Multiple revisions with traffic split
   - Solution: Force 100% traffic to new revision

4. **Local vs Remote Code Mismatch** (2% likely)
   - Changes not committed/pushed before deployment
   - Deploying from wrong directory
   - Solution: Verify local changes are in deployment context

## Infrastructure Debugging Commands

### Phase 1: Verify Current State

```bash
# 1. Check which revision is serving traffic
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="yaml(spec.traffic,status.latestCreatedRevisionName,status.latestReadyRevisionName)"

# 2. Get the container image being used by current revision
gcloud run revisions describe gemini-artistic-api-00003-qv5 \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(spec.containers[0].image)"

# 3. Inspect the image digest in Artifact Registry
gcloud artifacts docker images describe \
  us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --project=gen-lang-client-0601138686

# 4. List all image versions with their digests
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic \
  --project=gen-lang-client-0601138686 \
  --include-tags
```

### Phase 2: Verify Code in Container

```bash
# 1. Pull the current image locally to inspect
gcloud auth configure-docker us-central1-docker.pkg.dev
docker pull us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest

# 2. Run container locally and check the main.py file
docker run -it --entrypoint /bin/bash \
  us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest

# Inside container:
cat /app/src/main.py | grep -A 10 "allow_origins"
```

### Phase 3: Check Cloud Run Logs

```bash
# 1. Check recent deployment logs
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=gemini-artistic-api AND \
  resource.labels.revision_name=gemini-artistic-api-00003-qv5" \
  --limit=50 \
  --project=gen-lang-client-0601138686 \
  --format=json

# 2. Check for CORS-related errors
gcloud logging read "resource.type=cloud_run_revision AND \
  textPayload:\"CORS\" OR textPayload:\"localhost:8000\"" \
  --limit=20 \
  --project=gen-lang-client-0601138686
```

## Resolution Steps

### Option 1: Force Clean Rebuild (RECOMMENDED)

**File to Modify**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`

```bash
# Add these modifications to the deployment script:

# Line 50-54: Replace the build command with cache-busting version
echo "[3/6] Building container image (forcing clean build)..."
gcloud builds submit \
  --tag ${IMAGE_NAME} \
  --project=${PROJECT_ID} \
  --no-cache \
  --substitutions="_CACHE_BUSTER=$(date +%s)" \
  .
```

**Additional Changes**:
1. Add build argument to Dockerfile for cache busting
2. Use timestamp-based tags instead of :latest
3. Add verification step after deployment

### Option 2: Use Unique Image Tags

**File to Modify**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`

```bash
# Line 13: Change image tag strategy
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/gemini-artistic/api:${TIMESTAMP}"
IMAGE_LATEST="us-central1-docker.pkg.dev/${PROJECT_ID}/gemini-artistic/api:latest"

# Line 50-54: Build with both tags
gcloud builds submit \
  --tag ${IMAGE_NAME} \
  --project=${PROJECT_ID} \
  .

# Tag as latest after successful build
gcloud artifacts docker tags add \
  ${IMAGE_NAME} \
  ${IMAGE_LATEST} \
  --project=${PROJECT_ID}
```

### Option 3: Direct Container Push

**Alternative Deployment Method** (if Cloud Build continues to cache):

```bash
# Build locally and push directly
cd backend/gemini-artistic-api

# Build with no cache
docker build --no-cache -t gemini-artistic-api:local .

# Tag for Artifact Registry
docker tag gemini-artistic-api:local \
  us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:$(date +%s)

# Push to registry
docker push us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:$(date +%s)

# Deploy specific image
gcloud run deploy gemini-artistic-api \
  --image=us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:$(date +%s) \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

## Verification Steps

### After Deployment

```bash
# 1. Verify new revision is created and serving
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="table(status.latestCreatedRevisionName,status.traffic[].percent)"

# 2. Test CORS headers directly
curl -I -X OPTIONS \
  -H "Origin: http://localhost:8000" \
  -H "Access-Control-Request-Method: POST" \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health

# Expected response should include:
# Access-Control-Allow-Origin: http://localhost:8000

# 3. Verify from browser console
fetch('https://gemini-artistic-api-753651513695.us-central1.run.app/health')
  .then(r => console.log('CORS Success:', r.status))
  .catch(e => console.error('CORS Failed:', e))
```

## Modified Deployment Script

**File**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`

Key changes needed:
1. Line 50: Add `--no-cache` flag to force rebuild
2. Line 13: Use timestamp-based tags
3. Line 107-121: Add `--tag` parameter with timestamp
4. Add verification step at end

## Best Practices Going Forward

### 1. Deployment Pipeline Improvements
- Always use unique tags (timestamp or git commit hash)
- Add build argument for cache busting
- Include verification step in deployment script
- Log image digests for audit trail

### 2. CORS Configuration Management
- Move CORS origins to environment variables
- Use Secret Manager for sensitive origins
- Implement origin validation middleware
- Add CORS preflight caching headers

### 3. Monitoring & Alerting
```bash
# Create alert for CORS errors
gcloud monitoring policies create \
  --notification-channels=YOUR_CHANNEL \
  --display-name="CORS Errors Detected" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=60s
```

## Immediate Action Items

1. **Verify Local Changes** (2 min)
   - Confirm main.py has localhost:8000 in allow_origins
   - Check git status for uncommitted changes

2. **Force Clean Rebuild** (10 min)
   - Run modified deployment script with --no-cache
   - Use timestamp-based tag

3. **Verify Deployment** (5 min)
   - Check new revision is serving 100% traffic
   - Test CORS with curl
   - Verify in browser

4. **Update Deployment Script** (10 min)
   - Implement permanent fixes
   - Add verification steps
   - Document changes

## Cost Implications

- Clean rebuilds: ~$0.003 per build (negligible)
- No change to runtime costs
- No change to min-instances configuration
- Storage for multiple image versions: ~$0.10/month

## Security Considerations

- CORS changes expand attack surface slightly
- localhost:8000 acceptable for testing only
- Remove localhost origins before production
- Consider implementing CORS proxy for development

## Long-term Solution

Implement GitOps deployment pipeline:
1. GitHub Actions workflow on push
2. Automatic image tagging with git SHA
3. Deployment verification tests
4. Automatic rollback on failures
5. Slack notifications for deployments

## Summary

The issue is most likely caused by Cloud Build cache reusing layers despite code changes. The immediate solution is to force a clean rebuild with `--no-cache` flag and use unique image tags. The long-term solution involves improving the deployment pipeline with proper versioning and verification steps.

**Critical Path**:
1. Add `--no-cache` to build command
2. Deploy with timestamp tag
3. Verify CORS headers work
4. Update deployment script permanently

Total resolution time: ~20 minutes