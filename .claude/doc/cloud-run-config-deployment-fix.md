# Cloud Run Configuration Deployment Fix - Implementation Plan

## Executive Summary
Python config changes aren't being applied to Cloud Run despite clean rebuilds because the deployment script explicitly sets environment variables that override the default values in config.py. Pydantic BaseSettings prioritizes environment variables over default values, causing the old bucket name to persist.

## Root Cause Analysis

### Primary Issue
**Location**: `scripts/deploy-gemini-artistic.sh` line 121
```bash
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=perkieprints-processing-cache,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3"
```

The deployment script explicitly sets `STORAGE_BUCKET=perkieprints-processing-cache` as an environment variable during deployment. This overrides the default value in `config.py` line 25.

### How Pydantic BaseSettings Works
1. Pydantic BaseSettings loads configuration in priority order:
   - Environment variables (highest priority)
   - .env file
   - Default values in class definition (lowest priority)
2. Since `STORAGE_BUCKET` is set via `--set-env-vars` in Cloud Run, it always overrides the Python default
3. The container IS getting the updated config.py file, but the environment variable takes precedence

### Why `--no-cache` Didn't Help
- The `--no-cache` flag correctly forces a clean Docker build
- The updated config.py IS being copied into the container
- BUT the environment variable from `--set-env-vars` overrides it at runtime
- This explains why revision 00006-tg7 still uses the old bucket

## Immediate Fix (2 minutes)

### Option 1: Update Deployment Script (RECOMMENDED)
**File**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`
**Line**: 121
**Change**:
```bash
# FROM (old):
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=perkieprints-processing-cache,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \

# TO (new):
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=gemini-artistic-753651513695,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

**Then redeploy**:
```bash
cd backend/gemini-artistic-api
./scripts/deploy-gemini-artistic.sh
```

### Option 2: Remove Environment Variable (Alternative)
**File**: `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh`
**Line**: 121
**Change**:
```bash
# Remove STORAGE_BUCKET from env vars, let config.py default take effect:
--set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
```

## Verification Steps

### 1. Check Current Configuration
```bash
# View current environment variables
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### 2. Test After Deployment
```bash
# Check new revision number
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.latestCreatedRevisionName)"

# Test the API
curl https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

### 3. Verify Storage Access
```bash
# Check if API can write to new bucket
# Monitor Cloud Run logs during test
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=gemini-artistic-api \
  AND textPayload:(storage OR bucket)" \
  --project=gen-lang-client-0601138686 \
  --limit=10
```

## Best Practices for Configuration Management

### 1. Environment Variable Strategy
**Current Issues**:
- Config values scattered across multiple files
- Easy to have mismatches between script and code
- Hard to track which values are actually deployed

**Recommended Approach**:
```bash
# Create a single source of truth
cat > backend/gemini-artistic-api/deploy.env <<EOF
GEMINI_MODEL=gemini-2.5-flash-image
PROJECT_ID=gen-lang-client-0601138686
STORAGE_BUCKET=gemini-artistic-753651513695
RATE_LIMIT_DAILY=5
RATE_LIMIT_BURST=3
EOF

# Update deployment script to use env file
--env-vars-file=deploy.env
```

### 2. Configuration as Code
**Better Pattern**: Use Terraform or Cloud Deploy for infrastructure
```hcl
# terraform/cloud_run.tf
resource "google_cloud_run_service" "api" {
  template {
    spec {
      containers {
        env {
          name  = "STORAGE_BUCKET"
          value = var.storage_bucket
        }
      }
    }
  }
}
```

### 3. Runtime Configuration
**Most Flexible**: Use Secret Manager for all config
```python
# config.py
def get_config_from_secret_manager():
    """Load all config from Secret Manager"""
    client = secretmanager.SecretManagerServiceClient()
    config = json.loads(get_secret("app-config"))
    return Settings(**config)
```

## Container Inspection Method

### How to Verify Container Contents
```bash
# 1. Get the container image digest
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(spec.template.spec.containers[0].image)"

# 2. Pull and inspect the image locally (requires Docker)
docker pull [IMAGE_URL]
docker run --rm -it [IMAGE_URL] cat /app/src/config.py

# 3. Or use Cloud Shell to inspect
gcloud run services logs gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --limit=50 | grep "storage_bucket"
```

## Alternative Deployment Methods

### 1. Direct Docker Build & Push (More Control)
```bash
# Build locally with explicit tag
docker build -t gcr.io/gen-lang-client-0601138686/gemini-artistic-api:v1.0.1 .

# Push to registry
docker push gcr.io/gen-lang-client-0601138686/gemini-artistic-api:v1.0.1

# Deploy specific version
gcloud run deploy gemini-artistic-api \
  --image=gcr.io/gen-lang-client-0601138686/gemini-artistic-api:v1.0.1 \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

### 2. Use Cloud Build with Substitutions
```yaml
# cloudbuild.yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/$PROJECT_ID/api:$SHORT_SHA', '.']
substitutions:
  _STORAGE_BUCKET: 'gemini-artistic-753651513695'
```

## Additional Files to Update

### 1. deploy-gemini-artistic.yaml
**Line**: 36-37
```yaml
# Update to match new bucket
- name: STORAGE_BUCKET
  value: "gemini-artistic-753651513695"
```

### 2. .env.example
**Line**: 14
```bash
# Update example to new bucket
STORAGE_BUCKET=gemini-artistic-753651513695
```

### 3. README.md
**Line**: 164
```bash
# Update documentation
STORAGE_BUCKET=gemini-artistic-753651513695
```

## Cost & Performance Impact

### No Impact
- Changing bucket name has zero cost impact
- Performance remains identical
- Min-instances stays at 0
- Same scaling behavior

### Benefits
- New bucket is in same project (better IAM management)
- Clearer ownership and billing
- No cross-project permissions needed

## Testing Checklist

After deployment with corrected bucket name:

1. [ ] Health endpoint returns 200 OK
2. [ ] Generate an artistic portrait successfully
3. [ ] Verify image saved to `gemini-artistic-753651513695` bucket
4. [ ] Check rate limiting still works
5. [ ] Verify cache hit on duplicate request
6. [ ] Monitor Cloud Run logs for any errors

## Summary

The issue is NOT with Docker build caching or source file copying. The Python config changes ARE being deployed correctly. The problem is that environment variables set via `--set-env-vars` in the deployment script override any default values in config.py due to Pydantic's configuration hierarchy.

**Immediate Action**: Update line 121 in `deploy-gemini-artistic.sh` to use the correct bucket name, then redeploy.

**Time to Fix**: 2 minutes to edit + 3 minutes to deploy = 5 minutes total

**Risk**: Zero - this is a simple configuration value change

---
*Document created: 2025-10-23*
*Author: Infrastructure Reliability Engineer*
*Session: context_session_001.md*