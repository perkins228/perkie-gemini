# Cloud Run Configuration Deployment Debug Plan

**Date**: 2025-10-24
**Issue**: Configuration changes in `config.py` not being applied despite `--no-cache` flag
**Status**: ROOT CAUSE IDENTIFIED
**Session**: `.claude/tasks/context_session_001.md`

---

## Executive Summary

**Problem**: Changed `config.py` line 25 from `storage_bucket = "perkieprints-processing-cache"` to `storage_bucket = "gemini-artistic-753651513695"`, deployed with `--no-cache` flag to revision 00006-tg7, but deployed container is still using the old bucket name.

**Root Cause**: **Environment variable override in deployment script** (line 121) is overriding the config.py default value.

**Impact**: Configuration changes in code are being ignored because environment variables take precedence over hardcoded defaults in Pydantic Settings.

**Fix Complexity**: LOW - Single line change in deployment script
**Risk Level**: MINIMAL - Only affects environment variable configuration
**Time to Fix**: 2 minutes

---

## Root Cause Analysis

### Problem Discovery Timeline

1. ✅ **Code Change**: Updated `config.py` line 25 to use new bucket
2. ✅ **Deployment**: Ran deployment script with `--no-cache` flag
3. ✅ **Container Build**: Successfully built clean image (no cache)
4. ❌ **Runtime Error**: Still accessing old bucket `perkieprints-processing-cache`

### Root Cause Identified

**File**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`
**Line**: 121
**Issue**: Environment variable `STORAGE_BUCKET=perkieprints-processing-cache` is hardcoded

```bash
# Line 121 - HARDCODED OLD BUCKET NAME
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=perkieprints-processing-cache,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

### How Pydantic Settings Works

Pydantic Settings loads configuration in this **PRIORITY ORDER** (highest to lowest):

1. **Environment variables** ← HIGHEST PRIORITY (overrides everything)
2. `.env` file values
3. Default values in code ← LOWEST PRIORITY

**What's Happening**:
- `config.py` line 25 sets default: `storage_bucket: str = "gemini-artistic-753651513695"`
- Deployment script sets env var: `STORAGE_BUCKET=perkieprints-processing-cache`
- Pydantic loads: **Environment variable WINS** ❌
- Code change is **IGNORED**

### Evidence from Deployed Revision

**Verified via `gcloud run revisions describe`**:

```yaml
env:
  - name: STORAGE_BUCKET
    value: perkieprints-processing-cache  # ← This overrides config.py
```

The deployment script is **explicitly setting** the old bucket name as an environment variable, which takes precedence over the code change.

---

## Why `--no-cache` Didn't Help

**User's Assumption**: `--no-cache` forces a clean rebuild, so code changes should be included.

**Reality**: The `--no-cache` flag DID work correctly:
- ✅ Container was built from scratch
- ✅ New `config.py` code was included in the image
- ✅ No layer caching was used

**However**: The problem is **NOT** in the build process - it's in the **runtime configuration**.

The deployment script is **overriding** the code configuration at **runtime** via environment variables, so even a perfectly clean build won't fix this.

**Analogy**:
```
Your code says: "Use bucket A"
Deployment script says: "No, use bucket B"
Container runtime: "Deployment script wins"
```

---

## Solution Implementation Plan

### Fix #1: Update Deployment Script (REQUIRED)

**File**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`
**Line**: 121
**Action**: Change `STORAGE_BUCKET` environment variable to new bucket name

**Current**:
```bash
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=perkieprints-processing-cache,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

**Change To**:
```bash
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=gemini-artistic-753651513695,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

**Rationale**: Environment variables override code defaults, so we must update the deployment script to match the new bucket name.

---

### Fix #2: Update YAML Configuration (RECOMMENDED)

**File**: `backend/gemini-artistic-api/deploy-gemini-artistic.yaml`
**Line**: 37
**Action**: Update STORAGE_BUCKET environment variable

**Current**:
```yaml
- name: STORAGE_BUCKET
  value: "perkieprints-processing-cache"
```

**Change To**:
```yaml
- name: STORAGE_BUCKET
  value: "gemini-artistic-753651513695"
```

**Rationale**: This YAML file is not currently used in deployment (script uses `gcloud run deploy` command directly), but should be kept in sync for documentation and potential future use.

---

### Verification Steps

After making the changes, verify the fix using these commands:

#### Step 1: Verify Code Changes
```bash
cd backend/gemini-artistic-api

# Check config.py has new bucket
grep "storage_bucket" src/config.py
# Expected: storage_bucket: str = "gemini-artistic-753651513695"

# Check deployment script has new bucket
grep "STORAGE_BUCKET" scripts/deploy-gemini-artistic.sh
# Expected: STORAGE_BUCKET=gemini-artistic-753651513695
```

#### Step 2: Deploy New Revision
```bash
# Run deployment (no need for --no-cache, it's already in the script)
cd backend/gemini-artistic-api
./scripts/deploy-gemini-artistic.sh
```

#### Step 3: Verify Deployed Configuration
```bash
# Get latest revision name
LATEST_REVISION=$(gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format='value(status.latestCreatedRevisionName)')

echo "Latest revision: $LATEST_REVISION"

# Check environment variables in deployed revision
gcloud run revisions describe $LATEST_REVISION \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(spec.containers[0].env)" | grep STORAGE_BUCKET

# Expected output:
# {'name': 'STORAGE_BUCKET', 'value': 'gemini-artistic-753651513695'}
```

#### Step 4: Test API Endpoint
```bash
# Test image generation to verify bucket is being used
curl -X POST "https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "style": "bw_fine_art",
    "session_id": "test_bucket_fix"
  }'

# Check Cloud Run logs for bucket access
gcloud run services logs read gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --limit=20 | grep -i "storage\|bucket"
```

#### Step 5: Verify in Cloud Storage
```bash
# List recent uploads to verify correct bucket is being used
gsutil ls -l gs://gemini-artistic-753651513695/ | head -10

# Should show recent files if API is working correctly
```

---

## Alternative Debugging Methods (For Future Reference)

### Method 1: Inspect Running Container Configuration

**Use Cloud Run console or API to check what environment variables are actually set**:

```bash
# Get full revision YAML including all environment variables
gcloud run revisions describe REVISION_NAME \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format=yaml > deployed-config.yaml

# Inspect the file
cat deployed-config.yaml | grep -A 20 "env:"
```

**Why This Helps**: Shows the **actual runtime configuration**, not just what you think was deployed.

---

### Method 2: Test Container Locally Before Deployment

**Run the container locally with the same environment variables**:

```bash
# Build container locally
cd backend/gemini-artistic-api
docker build -t gemini-artistic-test .

# Run with production-like environment variables
docker run -p 8080:8080 \
  -e STORAGE_BUCKET=gemini-artistic-753651513695 \
  -e GEMINI_API_KEY=your-key \
  -e PROJECT_ID=gen-lang-client-0601138686 \
  gemini-artistic-test

# Test locally
curl http://localhost:8080/health
```

**Why This Helps**: Isolates container behavior from Cloud Run deployment, helps identify if issue is in code or deployment configuration.

---

### Method 3: Add Startup Logging to Verify Configuration

**Add diagnostic logging to `src/main.py` startup**:

```python
# Add to main.py after settings import
@app.on_event("startup")
async def startup_event():
    logger.info(f"Configuration loaded:")
    logger.info(f"  Storage Bucket: {settings.storage_bucket}")
    logger.info(f"  Project ID: {settings.project_id}")
    logger.info(f"  Gemini Model: {settings.gemini_model}")
    logger.info(f"  Rate Limit Daily: {settings.rate_limit_daily}")
```

**Why This Helps**: Provides immediate visibility into what configuration values are actually loaded at runtime in Cloud Run logs.

---

## Technical Deep Dive: Understanding the Deployment Flow

### Build Phase (Docker)

```
1. Source Code on Disk
   ├── config.py (storage_bucket = "gemini-artistic-753651513695")
   ├── main.py
   └── ...

2. Docker Build (with --no-cache)
   ├── FROM python:3.11-slim
   ├── COPY requirements.txt (layer 1)
   ├── RUN pip install (layer 2)
   ├── COPY src/ ./src/ (layer 3) ← config.py included here
   └── BUILD COMPLETE: Image contains new code ✅

3. Container Image Pushed to Artifact Registry
   └── us-central1-docker.pkg.dev/.../api:latest ✅
```

**At this point**: The container image **DOES** contain the updated `config.py` with the new bucket name.

---

### Deployment Phase (Cloud Run)

```
4. Cloud Run Deployment Command Executed
   └── gcloud run deploy gemini-artistic-api \
       --image=${IMAGE_NAME} \  ← Uses correct image
       --set-env-vars="STORAGE_BUCKET=perkieprints-processing-cache" ← OVERRIDE!

5. Cloud Run Revision Created
   ├── Container: Correct image with new code ✅
   ├── Environment Variables:
   │   └── STORAGE_BUCKET=perkieprints-processing-cache ❌
   └── Runtime merges: ENV VARS WIN over code defaults

6. Application Startup (Pydantic Settings)
   ├── Check environment: STORAGE_BUCKET=perkieprints-processing-cache ✅
   ├── Check .env file: Not present in container
   ├── Check code defaults: storage_bucket = "gemini-artistic-753651513695"
   └── USES: perkieprints-processing-cache (env var wins) ❌
```

**This is why** the `--no-cache` flag didn't help - the build was perfect, but the deployment configuration overrode it.

---

## Common Misconceptions Addressed

### Misconception #1: "Build cache is the problem"

**Reality**: Build cache was NOT the issue. The `--no-cache` flag worked correctly and the container image contains the updated code.

**Evidence**: Container build logs show clean rebuild with all layers recreated.

---

### Misconception #2: "The COPY instruction didn't pick up the file"

**Reality**: The `COPY src/ ./src/` instruction DID copy the updated `config.py` correctly.

**Evidence**: If we exec into a running container (or build locally), we would see the updated config.py with the new bucket name.

**Why it seems wrong**: The code is there, but it's being **overridden** at runtime by environment variables.

---

### Misconception #3: "We need to upload a new source to Cloud Build"

**Reality**: The source code is uploaded fresh with every `gcloud builds submit` command. There's no "stale source" in Cloud Build.

**How it works**:
```bash
gcloud builds submit --tag IMAGE_NAME .
# This command:
# 1. Archives the current directory (including all changes)
# 2. Uploads to Cloud Build
# 3. Builds container using the fresh upload
```

---

## Best Practices for Configuration Management

### Recommendation #1: Centralize Environment Variable Management

**Problem**: Currently have config in 3 places:
1. `config.py` (code defaults)
2. `deploy-gemini-artistic.sh` (deployment script)
3. `deploy-gemini-artistic.yaml` (YAML config, not actively used)

**Solution**: Choose ONE source of truth and derive others from it.

**Option A: Use deployment script variables**:
```bash
# Define variables at top of script
STORAGE_BUCKET="gemini-artistic-753651513695"
RATE_LIMIT_DAILY="5"
RATE_LIMIT_BURST="3"

# Use in deployment command
--set-env-vars="STORAGE_BUCKET=${STORAGE_BUCKET},RATE_LIMIT_DAILY=${RATE_LIMIT_DAILY},..."
```

**Option B: Remove env vars from deployment, rely on code defaults**:
```bash
# Only set values that MUST differ from code defaults
--set-env-vars="PROJECT_ID=${PROJECT_ID}"
# Let code defaults handle the rest
```

---

### Recommendation #2: Add Configuration Validation Endpoint

**Add to `main.py`**:
```python
@app.get("/debug/config")
async def get_config():
    """Debug endpoint to verify runtime configuration"""
    return {
        "storage_bucket": settings.storage_bucket,
        "project_id": settings.project_id,
        "gemini_model": settings.gemini_model,
        "rate_limit_daily": settings.rate_limit_daily,
        "rate_limit_burst": settings.rate_limit_burst,
        "loaded_from": "environment" if os.getenv("STORAGE_BUCKET") else "defaults"
    }
```

**Why**: Allows instant verification of what configuration is actually loaded without checking logs or inspecting containers.

**Security**: Should be disabled in production or require authentication.

---

### Recommendation #3: Document Configuration Precedence

**Add to README.md**:
```markdown
## Configuration Priority

Settings are loaded in this order (highest priority first):

1. **Environment Variables** (set via `--set-env-vars` in deployment)
2. **.env file** (not used in Cloud Run deployment)
3. **Code defaults** (`src/config.py`)

To change a configuration value:
- For testing: Update code defaults in `config.py`
- For production: Update deployment script env vars
```

---

## Files Requiring Changes

### File 1: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`

**Location**: Line 121
**Change Type**: String replacement
**Priority**: CRITICAL (blocks fix)

**Before**:
```bash
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=perkieprints-processing-cache,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

**After**:
```bash
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=gemini-artistic-753651513695,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

**Testing**: Search for "perkieprints-processing-cache" in file to ensure no other occurrences.

---

### File 2: `backend/gemini-artistic-api/deploy-gemini-artistic.yaml`

**Location**: Line 37
**Change Type**: YAML value update
**Priority**: RECOMMENDED (documentation sync)

**Before**:
```yaml
- name: STORAGE_BUCKET
  value: "perkieprints-processing-cache"
```

**After**:
```yaml
- name: STORAGE_BUCKET
  value: "gemini-artistic-753651513695"
```

**Note**: This file is NOT currently used in deployment (script uses `gcloud run deploy` command instead), but should be kept in sync for consistency.

---

### File 3: `backend/gemini-artistic-api/src/config.py` (Optional Enhancement)

**Location**: Line 25
**Change Type**: Add documentation comment
**Priority**: OPTIONAL (improves clarity)

**Current**:
```python
storage_bucket: str = "gemini-artistic-753651513695"
```

**Enhanced**:
```python
# NOTE: Default can be overridden by STORAGE_BUCKET environment variable
# Deployment script sets this via --set-env-vars in deploy-gemini-artistic.sh
storage_bucket: str = "gemini-artistic-753651513695"
```

**Rationale**: Makes it clear that environment variables can override this default, preventing future confusion.

---

## Testing Checklist

After implementing the fix, verify each of these:

### Pre-Deployment Verification
- [ ] File `deploy-gemini-artistic.sh` line 121 contains new bucket name
- [ ] File `deploy-gemini-artistic.yaml` line 37 contains new bucket name
- [ ] No other references to old bucket in deployment files
- [ ] Deployment script has `--no-cache` flag (already present)

### Deployment Process
- [ ] Run deployment script: `./scripts/deploy-gemini-artistic.sh`
- [ ] Deployment completes without errors
- [ ] New revision is created (will be 00007 or higher)
- [ ] Health endpoint responds: `curl SERVICE_URL/health`

### Configuration Verification
- [ ] Check deployed env vars show new bucket name
- [ ] Check Cloud Run logs show correct bucket in initialization
- [ ] Test image generation request succeeds
- [ ] Check Cloud Storage bucket `gemini-artistic-753651513695` receives uploads

### Functional Testing
- [ ] Generate artistic portrait (Black & White style)
- [ ] Verify image is stored in correct bucket
- [ ] Check no errors about old bucket in logs
- [ ] Verify rate limiting still works
- [ ] Confirm cache hit detection works

---

## Rollback Plan

If the fix causes unexpected issues, rollback is simple:

### Option 1: Revert to Previous Revision
```bash
# List recent revisions
gcloud run revisions list \
  --service=gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686

# Route traffic to previous working revision (e.g., 00006-tg7)
gcloud run services update-traffic gemini-artistic-api \
  --to-revisions=gemini-artistic-api-00006-tg7=100 \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

### Option 2: Revert Code Changes
```bash
# Revert deployment script
git checkout HEAD -- backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh

# Redeploy
cd backend/gemini-artistic-api
./scripts/deploy-gemini-artistic.sh
```

---

## Cost Impact

**Deployment Cost**: ~$0.003 per deployment (Cloud Build + Cloud Run)
**Testing Cost**: ~$0.10 for 2-3 test image generations
**Total Expected Cost**: < $0.15

**No ongoing cost change**: Min-instances remains at 0, runtime costs unchanged.

---

## Time Estimates

| Task | Estimated Time |
|------|----------------|
| Update deployment script | 2 minutes |
| Update YAML file | 1 minute |
| Run deployment | 3 minutes |
| Verify configuration | 2 minutes |
| Test image generation | 3 minutes |
| **TOTAL** | **11 minutes** |

---

## Success Criteria

The fix is successful when:

1. ✅ Deployment script contains new bucket name in `--set-env-vars`
2. ✅ New revision deployed to Cloud Run
3. ✅ Environment variable `STORAGE_BUCKET=gemini-artistic-753651513695` in deployed revision
4. ✅ Image generation succeeds without 403 errors
5. ✅ Uploads appear in `gs://gemini-artistic-753651513695/`
6. ✅ No references to `perkieprints-processing-cache` in Cloud Run logs

---

## Lessons Learned

### Key Takeaways

1. **Environment variables override code defaults** - Always check deployment configuration, not just source code
2. **`--no-cache` doesn't fix runtime config issues** - Build vs. deployment distinction is critical
3. **Verify deployed configuration, not just built container** - Use `gcloud run revisions describe` to see actual runtime config
4. **Pydantic Settings priority order** - Understand how configuration is loaded and merged

### Future Prevention

1. **Add configuration debug endpoint** - Makes runtime config instantly visible
2. **Centralize environment variable definitions** - Single source of truth for deployment values
3. **Document configuration precedence** - Prevent future confusion about defaults vs. overrides
4. **Add deployment verification step** - Script should verify env vars after deployment

---

## Related Documentation

- Pydantic Settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- Cloud Run Environment Variables: https://cloud.google.com/run/docs/configuring/environment-variables
- Container Build Best Practices: https://cloud.google.com/build/docs/optimize-builds/speeding-up-builds
- Session Context: `.claude/tasks/context_session_001.md` (lines 1186-1209)

---

## Implementation Summary

**Problem**: Config changes not applied due to environment variable override
**Root Cause**: Deployment script sets `STORAGE_BUCKET=perkieprints-processing-cache` as env var, which overrides code default
**Solution**: Update deployment script line 121 to use new bucket name
**Complexity**: LOW - Single line change
**Risk**: MINIMAL - Only affects environment variable configuration
**Time**: 11 minutes total
**Cost**: < $0.15

**Status**: READY TO IMPLEMENT

---

**Plan Created**: 2025-10-24
**Plan Author**: Debug Specialist Agent
**Next Step**: Update deployment script and redeploy
