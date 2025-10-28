# Cloud Run GPU Deployment Failure - Root Cause Analysis & Implementation Plan

**Date**: 2025-10-28
**Project**: gen-lang-client-0601138686 (nanobanana)
**Service**: inspirenet-bg-removal-api-gemini
**Status**: DEPLOYMENT BLOCKED - Code Error

---

## Executive Summary

**Root Cause Identified**: Python ModuleNotFoundError - NOT a GPU quota issue
**Impact**: 100% deployment failure rate, container exits immediately on startup
**Risk Level**: Critical - blocks all deployment attempts
**Time to Fix**: 15-30 minutes (code cleanup only)

**The Good News**: This is a simple code issue, NOT an infrastructure problem. The container never got far enough to request GPU resources, so we don't even know if GPU quota is the issue yet.

---

## 1. Root Cause Analysis

### What Actually Happened

The container fails BEFORE it can even bind to port 8080. The error occurs during Python module imports at application startup:

```
ModuleNotFoundError: No module named 'effects.optimized_popart_effect'
```

**Error Location**: `src/effects/__init__.py` line 9

**Timeline**:
1. Container starts (0s)
2. Python begins executing `src/main.py` (0-2s)
3. Import chain: `main.py` → `api_v2_endpoints.py` → `integrated_processor.py` → `effects/__init__.py`
4. **CRASH**: `effects/__init__.py` tries to import deleted module `optimized_popart_effect`
5. Container exits with code 1 (~3s)
6. Cloud Run marks deployment as failed (never reached port binding)

### Why This Happened

During the style consolidation work (removing Pop Art, Halftone, 8-bit effects), files were deleted but imports were not cleaned up:

**Files Deleted** (from git status):
- `src/effects/popart_effect.py` (old version)
- `src/effects/optimized_popart_effect.py` (NOT present in Glob results)
- `src/effects/dithering_effect.py` (NOT present in Glob results)
- `src/effects/pet_optimized_eightbit_effect.py` (NOT present in Glob results)

**Imports Still Present** (`src/effects/__init__.py`):
```python
from .optimized_popart_effect import OptimizedPopArtEffect  # LINE 9 - CRASH
from .dithering_effect import DitheringEffect  # LINE 10 - Would crash if line 9 passed
from .pet_optimized_eightbit_effect import PetOptimizedEightBitEffect  # LINE 11 - Would crash
```

**Current Files Available**:
- `__init__.py` (broken imports)
- `base_effect.py` (working)
- `effects_processor.py` (working, but may reference deleted effects)
- `enhanced_blackwhite_effect.py` (working)
- `optimized_effects_processor.py` (status unknown)
- `popart_effect.py` (old version, not optimized)

---

## 2. Why GPU Quota Was NOT the Issue (Yet)

### Empty Logs Explained

The container logs are empty because:
1. The application crashed during module import (before logging initialized)
2. Python's `import` statement fails fast with ModuleNotFoundError
3. No application code executed (not even `logging.basicConfig()`)
4. Cloud Run only logs the crash traceback, not application logs

### GPU Resource Request Never Made

The container never got far enough to:
- Initialize FastAPI application
- Bind to port 8080
- Request GPU resources from Cloud Run
- Load PyTorch or CUDA libraries
- Initialize the InSPyReNet model

**Evidence**: The startup probe failed on TCP port check, meaning the Python process exited before uvicorn could start the HTTP server.

### GPU Quota Status

**Compute Engine GPU Quota**: No results from `gcloud compute project-info describe` grep
**Cloud Run GPU Quota**: Not checked (different quota namespace)
**Regional GPU Quota**: No results from `gcloud compute regions describe` grep

**Critical Note**: Cloud Run GPU quota is separate from Compute Engine. You need to check:
```bash
gcloud run services describe <service> --format="yaml(spec.template.spec.containers[0].resources)"
```

The working production service (`perkieprints-processing`) shows GPU quota IS available:
```yaml
resources:
  limits:
    nvidia.com/gpu: '1'
  requests:
    nvidia.com/gpu: '1'
```

---

## 3. Immediate Fix - Code Cleanup (15-30 minutes)

### Files Requiring Changes

#### 3.1. Fix `src/effects/__init__.py`

**Current State** (BROKEN):
```python
from .effects_processor import EffectsProcessor
from .base_effect import BaseEffect
from .enhanced_blackwhite_effect import EnhancedBlackWhiteEffect
from .optimized_popart_effect import OptimizedPopArtEffect  # ❌ MODULE NOT FOUND
from .dithering_effect import DitheringEffect  # ❌ MODULE NOT FOUND
from .pet_optimized_eightbit_effect import PetOptimizedEightBitEffect  # ❌ MODULE NOT FOUND

__all__ = [
    "EffectsProcessor",
    "BaseEffect",
    "EnhancedBlackWhiteEffect",
    "OptimizedPopArtEffect",  # ❌ NOT EXPORTED
    "DitheringEffect",  # ❌ NOT EXPORTED
    "PetOptimizedEightBitEffect"  # ❌ NOT EXPORTED
]
```

**Required Changes**:
```python
"""
Effects Processing Package
Black & White processing only (artistic styles moved to Gemini API)
"""

from .effects_processor import EffectsProcessor
from .base_effect import BaseEffect
from .enhanced_blackwhite_effect import EnhancedBlackWhiteEffect

__all__ = [
    "EffectsProcessor",
    "BaseEffect",
    "EnhancedBlackWhiteEffect",
]
```

**Rationale**:
- Remove imports for deleted effect files
- Keep only B&W effect (per strategic decision to move artistic styles to Gemini)
- Clean `__all__` export list

#### 3.2. Verify `src/effects/effects_processor.py`

**Check Required**:
1. Does it import deleted effect classes?
2. Does it register deleted effects in `AVAILABLE_EFFECTS` dict?
3. Does it reference deleted effects in method implementations?

**Expected Issues**:
```python
from .optimized_popart_effect import OptimizedPopArtEffect  # Remove
from .dithering_effect import DitheringEffect  # Remove
from .pet_optimized_eightbit_effect import PetOptimizedEightBitEffect  # Remove

AVAILABLE_EFFECTS = {
    'blackwhite': EnhancedBlackWhiteEffect,
    'popart': OptimizedPopArtEffect,  # Remove
    'dithering': DitheringEffect,  # Remove
    '8bit': PetOptimizedEightBitEffect,  # Remove
}
```

**Required Changes**:
- Remove imports for deleted effects
- Remove effect registrations from `AVAILABLE_EFFECTS`
- Keep `blackwhite` effect only
- Update docstrings to reflect simplified effect set

#### 3.3. Check `src/integrated_processor.py`

**Potential Issues**:
- May import effects directly (bypassing `__init__.py`)
- May reference deleted effects in processing logic
- May have hardcoded effect names in validation

**Search Required**:
```python
# Look for these patterns:
from effects.optimized_popart_effect import *
from effects.dithering_effect import *
from effects.pet_optimized_eightbit_effect import *

# Or direct references:
if effect_type == 'popart':
if effect_type == 'dithering':
if effect_type == '8bit':
```

**Required Changes**: Remove all references to deleted effects

#### 3.4. Check `src/api_v2_endpoints.py`

**Potential Issues**:
- API endpoint definitions for deleted effects
- Effect type validation allowing deleted effects
- Response examples showing deleted effects

**Search Required**:
```python
# Look for endpoint definitions:
@router.post("/api/v2/process")
# Check supported effects in docstrings or validation

# Look for effect type validation:
allowed_effects = ['blackwhite', 'popart', 'dithering', '8bit', 'color']
```

**Required Changes**: Remove deleted effects from validation lists and documentation

---

## 4. Step-by-Step Implementation

### Phase 1: Code Cleanup (Local)

**Step 1.1**: Review current file state
```bash
cd backend/inspirenet-api
ls -la src/effects/
```

**Step 1.2**: Fix `src/effects/__init__.py`
- Remove imports: `optimized_popart_effect`, `dithering_effect`, `pet_optimized_eightbit_effect`
- Update `__all__` list to match remaining imports
- Add comment explaining artistic styles moved to Gemini

**Step 1.3**: Fix `src/effects/effects_processor.py`
- Search for deleted effect imports
- Remove from `AVAILABLE_EFFECTS` registration
- Update docstrings
- Verify no hardcoded references remain

**Step 1.4**: Fix `src/integrated_processor.py`
- Search for deleted effect imports
- Remove effect type checks for deleted effects
- Update validation logic

**Step 1.5**: Fix `src/api_v2_endpoints.py`
- Remove deleted effects from validation
- Update API documentation
- Update response examples

**Step 1.6**: Verify locally
```bash
python src/main.py  # Should start without ModuleNotFoundError
# Check for:
# - No import errors
# - FastAPI starts successfully
# - /health endpoint responds
```

### Phase 2: Deployment Test (Staging)

**Step 2.1**: Build Docker image locally
```bash
docker build -t test-inspirenet-api .
docker run -p 8080:8080 test-inspirenet-api
```

**Expected Result**: Container starts, binds to port 8080, /health responds

**Step 2.2**: Deploy to Cloud Run (gen-lang-client-0601138686)
```bash
cd backend/inspirenet-api
gcloud builds submit --config=cloudbuild-nanobanana.yaml --project=gen-lang-client-0601138686
```

**Step 2.3**: Monitor deployment
```bash
gcloud run services describe inspirenet-bg-removal-api-gemini \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.conditions)"
```

**Step 2.4**: Check logs for new errors
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api-gemini" \
  --project=gen-lang-client-0601138686 \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

### Phase 3: GPU Quota Verification (If Needed)

**IF** the container starts successfully but fails with GPU-related errors, THEN:

**Step 3.1**: Check Cloud Run GPU quota
```bash
# List available GPU types in region
gcloud run services describe inspirenet-bg-removal-api-gemini \
  --region=us-central1 \
  --project=gen-lang-client-0601138686

# Check GPU availability in us-central1
gcloud compute accelerator-types list --project=gen-lang-client-0601138686 --filter="zone:us-central1"
```

**Step 3.2**: Request GPU quota if needed
1. Go to: https://console.cloud.google.com/iam-admin/quotas?project=gen-lang-client-0601138686
2. Search for: "Cloud Run GPUs" or "NVIDIA L4 GPUs"
3. Select quota and click "Edit Quotas"
4. Request: 1 GPU in us-central1 region
5. Justification: "InSPyReNet background removal API for pet e-commerce platform"

**Expected Wait Time**: 24-48 hours for quota approval

**Step 3.3**: Deploy without GPU temporarily (if quota unavailable)

**Option A**: CPU-only deployment for testing
```yaml
# In deploy-to-nanobanana.yaml, comment out GPU config:
resources:
  limits:
    cpu: '8'
    memory: '32Gi'
    # nvidia.com/gpu: '1'  # Disabled for CPU testing
  requests:
    cpu: '4'
    memory: '32Gi'
    # nvidia.com/gpu: '1'  # Disabled for CPU testing
```

**Note**: The API will work on CPU but process images ~10-20x slower:
- GPU processing: ~3-5 seconds per image
- CPU processing: ~30-60 seconds per image

**Option B**: Use existing production GPU service
- Keep using `perkieprints-processing` project for GPU workloads
- Deploy simplified API to `gen-lang-client-0601138686` for non-GPU endpoints only

---

## 5. Long-Term Solution - Prevent Future Import Errors

### 5.1. Add Import Testing to CI/CD

**Create**: `backend/inspirenet-api/tests/test_imports.py`
```python
"""
Test that all imports work correctly
Catches ModuleNotFoundError before deployment
"""
import pytest

def test_main_imports():
    """Test that main.py imports succeed"""
    try:
        import sys
        sys.path.insert(0, 'src')
        import main
        assert True
    except ModuleNotFoundError as e:
        pytest.fail(f"Import failed: {e}")

def test_effects_imports():
    """Test that effects package imports succeed"""
    try:
        import sys
        sys.path.insert(0, 'src')
        from effects import EffectsProcessor, BaseEffect, EnhancedBlackWhiteEffect
        assert True
    except ModuleNotFoundError as e:
        pytest.fail(f"Effects import failed: {e}")

def test_api_imports():
    """Test that API endpoints import succeed"""
    try:
        import sys
        sys.path.insert(0, 'src')
        from api_v2_endpoints import router, initialize_v2_api
        assert True
    except ModuleNotFoundError as e:
        pytest.fail(f"API import failed: {e}")
```

**Add to Cloud Build** (`cloudbuild-nanobanana.yaml`):
```yaml
steps:
  # Step 0: Run import tests before building
  - name: 'python:3.11-slim'
    entrypoint: bash
    args:
      - '-c'
      - |
        pip install pytest
        cd backend/inspirenet-api
        pytest tests/test_imports.py -v
    timeout: '120s'

  # Step 1: Build the Docker image (existing)
  - name: 'gcr.io/cloud-builders/docker'
    # ... rest of build config
```

**Benefit**: Catch import errors in 30 seconds instead of after 20-minute Docker build

### 5.2. Add Pre-Deployment Validation

**Create**: `backend/inspirenet-api/scripts/validate-deployment.sh`
```bash
#!/bin/bash
set -e

echo "🔍 Validating deployment configuration..."

# Test imports
echo "Testing Python imports..."
cd "$(dirname "$0")/.."
python3 -c "import sys; sys.path.insert(0, 'src'); import main" || {
    echo "❌ Import validation failed"
    exit 1
}

# Test Docker build
echo "Testing Docker build..."
docker build -t test-inspirenet-api . || {
    echo "❌ Docker build failed"
    exit 1
}

# Test container startup
echo "Testing container startup..."
docker run --rm -d --name test-inspirenet -p 8081:8080 test-inspirenet-api
sleep 10

# Test health endpoint
curl -f http://localhost:8081/health || {
    echo "❌ Health check failed"
    docker stop test-inspirenet
    exit 1
}

docker stop test-inspirenet
echo "✅ Deployment validation passed"
```

**Usage Before Deployment**:
```bash
cd backend/inspirenet-api
./scripts/validate-deployment.sh
# If passes, proceed with gcloud builds submit
```

### 5.3. Improve Error Handling in Dockerfile

**Current Issue**: Dockerfile doesn't validate imports at build time

**Improvement** (add to `Dockerfile` after copying code):
```dockerfile
# Copy application code
COPY src/ ./src/

# Verify critical imports including psutil
RUN python3 -c "import fastapi; import uvicorn; import torch; import psutil; import transparent_background; print('✅ All critical dependencies working')"

# Add import validation for effects
RUN python3 -c "import sys; sys.path.insert(0, 'src'); from effects import EffectsProcessor, BaseEffect, EnhancedBlackWhiteEffect; print('✅ Effects imports working')"

# Add full application import test
RUN python3 -c "import sys; sys.path.insert(0, 'src'); import main; print('✅ Application imports working')"
```

**Benefit**: Docker build fails fast if imports broken (at build time, not deployment time)

---

## 6. Verification Checklist

### Code Cleanup Complete
- [ ] `src/effects/__init__.py` cleaned (only B&W effect imported)
- [ ] `src/effects/effects_processor.py` updated (deleted effects removed)
- [ ] `src/integrated_processor.py` verified (no deleted effect references)
- [ ] `src/api_v2_endpoints.py` updated (validation updated)
- [ ] Local test: `python src/main.py` starts successfully
- [ ] Docker test: Container builds and starts locally

### Deployment Successful
- [ ] Cloud Build completes without errors
- [ ] Docker image pushed to Artifact Registry
- [ ] Cloud Run deployment succeeds (no timeout errors)
- [ ] Service shows "Ready" status
- [ ] `/health` endpoint responds (200 OK)
- [ ] Container logs show successful startup

### GPU Functionality (If Required)
- [ ] PyTorch detects CUDA device
- [ ] InSPyReNet model loads successfully
- [ ] Image processing uses GPU (check logs for device info)
- [ ] Processing times are fast (3-5s per image, not 30-60s)

### If GPU Quota Issue Discovered
- [ ] GPU quota request submitted to Google Cloud
- [ ] Justification provided
- [ ] Waiting for approval (24-48 hours)
- [ ] Alternative CPU deployment tested (if needed immediately)

---

## 7. Commands Reference

### Diagnostic Commands

**Check deployment status**:
```bash
gcloud run services describe inspirenet-bg-removal-api-gemini \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

**Fetch latest logs**:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api-gemini" \
  --project=gen-lang-client-0601138686 \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

**Check GPU quota**:
```bash
# Compute Engine quotas
gcloud compute project-info describe --project=gen-lang-client-0601138686 \
  --format="value(quotas)" | grep -i gpu

# Regional quotas
gcloud compute regions describe us-central1 --project=gen-lang-client-0601138686 \
  --format="value(quotas)" | grep -i gpu

# Available GPU types
gcloud compute accelerator-types list --project=gen-lang-client-0601138686 \
  --filter="zone:us-central1"
```

**Test health endpoint**:
```bash
# After deployment succeeds
curl https://[service-url]/health

# Or locally
curl http://localhost:8080/health
```

### Deployment Commands

**Build and deploy**:
```bash
cd backend/inspirenet-api
gcloud builds submit --config=cloudbuild-nanobanana.yaml \
  --project=gen-lang-client-0601138686
```

**Deploy specific image**:
```bash
gcloud run services replace deploy-to-nanobanana.yaml \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

**Rollback deployment**:
```bash
# Get previous revision
gcloud run revisions list --service=inspirenet-bg-removal-api-gemini \
  --region=us-central1 \
  --project=gen-lang-client-0601138686

# Rollback to specific revision
gcloud run services update-traffic inspirenet-bg-removal-api-gemini \
  --to-revisions=<REVISION_NAME>=100 \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

### Local Testing Commands

**Test Python imports**:
```bash
cd backend/inspirenet-api
python3 -c "import sys; sys.path.insert(0, 'src'); import main"
```

**Build Docker locally**:
```bash
docker build -t test-inspirenet-api .
docker run -p 8080:8080 test-inspirenet-api
```

**Check container logs**:
```bash
docker logs <container_id>
```

---

## 8. Cost Impact Analysis

### Current Cost (Deployment Failed)
- **Cloud Build**: $0.003/build-minute × 20 minutes = $0.06 per failed attempt
- **Failed attempts**: 3+ attempts = $0.18 wasted
- **Cloud Run**: $0 (no instances running due to failure)

### Fixed Deployment Cost (Estimated)

**With GPU** (if quota approved):
- **Cold start**: ~30-60s (one-time per instance)
- **Per-request**: ~3-5s processing @ $0.65/1000 GPU-seconds = $0.002-0.003 per image
- **Idle cost**: $0 (min-instances=0 as configured)
- **Monthly estimate**: 500 images × $0.003 = $1.50/month + request costs

**Without GPU** (CPU fallback):
- **Cold start**: ~10-20s (faster than GPU)
- **Per-request**: ~30-60s processing @ $0.00002400/vCPU-second = $0.001-0.002 per image
- **Idle cost**: $0 (min-instances=0)
- **Monthly estimate**: 500 images × $0.0015 = $0.75/month + request costs

**Cost Comparison**:
- GPU: Faster (5s vs 45s) but 2-3x more expensive per image
- CPU: Slower but cheaper for low-volume testing
- Break-even: ~1000 images/month (user patience matters more than cost)

### Cost Optimization Recommendations

1. **Testing Phase** (first 2-4 weeks):
   - Use CPU deployment if GPU quota unavailable
   - Validates code, API, integration without GPU cost
   - Acceptable for staging/testing (<100 images/week)

2. **Production Phase** (after validation):
   - Request GPU quota for fast processing
   - Set min-instances=0 (as configured) to avoid idle costs
   - Use frontend warming strategies (already implemented)

3. **Multi-Project Strategy**:
   - **gen-lang-client-0601138686**: Development, testing, low-volume
   - **perkieprints-processing**: Production GPU workloads
   - Separate billing and quota management

---

## 9. Questions Answered

### Q1: Root Cause - Why is the container failing to start?

**Answer**: Python `ModuleNotFoundError` during import phase. The `src/effects/__init__.py` file imports three deleted effect modules:
- `optimized_popart_effect.py` (deleted)
- `dithering_effect.py` (deleted)
- `pet_optimized_eightbit_effect.py` (deleted)

The container crashes before FastAPI/uvicorn starts, before binding to port 8080, and before requesting any GPU resources.

**Not GPU quota** - the container never got far enough to request GPU.

### Q2: GPU Quota - How do we check if GPU quota exists for Cloud Run?

**Answer**: Cloud Run GPU quota is different from Compute Engine quota. To check:

```bash
# Check if service can deploy with GPU
gcloud run services describe <service-name> --format="yaml(spec.template.spec.containers[0].resources)"

# Check available GPU types in region
gcloud compute accelerator-types list --filter="zone:us-central1" --project=gen-lang-client-0601138686

# Request quota at:
# https://console.cloud.google.com/iam-admin/quotas?project=gen-lang-client-0601138686
# Search for: "Cloud Run GPUs" or "NVIDIA L4 GPUs in us-central1"
```

**Current Status**: Unknown (container failed before GPU request). The working production service in `perkieprints-processing` successfully uses GPU, proving GPU is available in THAT project.

### Q3: Verification - How can we verify GPU availability before deployment?

**Answer**:
1. **Fix code issues first** (this blocks all verification)
2. **Deploy with CPU only** (remove GPU config temporarily)
3. **Check logs** for CUDA/GPU detection messages
4. **Request GPU quota** if needed (24-48 hour wait)
5. **Re-deploy with GPU** after quota approved

**Cannot verify GPU until container starts successfully.**

### Q4: Logs - Why are container logs completely empty?

**Answer**: The Python process crashes during module import, BEFORE:
- `logging.basicConfig()` is called
- FastAPI application initializes
- Any application-level logging occurs

Cloud Run only captures the Python traceback (which it did - showing ModuleNotFoundError), but there are no application logs because the application never started.

**This is expected behavior** for import-time crashes.

### Q5: Quick Fix - Can we deploy without GPU temporarily for testing?

**Answer**: **Yes, and you should do this!**

**Option 1**: Remove GPU requirement temporarily
```yaml
# In deploy-to-nanobanana.yaml
resources:
  limits:
    cpu: '8'
    memory: '32Gi'
    # nvidia.com/gpu: '1'  # Commented out for testing
```

**Option 2**: Use existing production GPU service
- Keep using `perkieprints-processing` for GPU workloads
- Use `gen-lang-client-0601138686` for testing/staging only

**Recommendation**:
1. Fix code issues (15-30 min)
2. Deploy to CPU first (validates code)
3. Request GPU quota (submit request)
4. Re-deploy with GPU after quota approved (24-48 hours)

---

## 10. Next Steps

### Immediate (Next 30 Minutes)
1. **Fix code issues** following Phase 1 instructions above
2. **Test locally**: Verify imports work
3. **Build Docker image**: Test container startup locally
4. **Deploy to Cloud Run**: Attempt deployment again

### Short-Term (Next 24 Hours)
1. **Verify deployment success**: Check service health
2. **Test API endpoints**: Ensure B&W processing works
3. **Check GPU detection**: Review logs for GPU messages
4. **Request GPU quota** if needed

### Medium-Term (Next Week)
1. **Implement CI/CD improvements**: Add import testing
2. **Add pre-deployment validation**: Catch errors earlier
3. **Update documentation**: Reflect simplified effect set
4. **Monitor costs**: Track GPU usage and costs

### Long-Term (Next Month)
1. **Evaluate GPU vs CPU costs**: Data-driven decision
2. **Optimize cold start times**: Further performance improvements
3. **Multi-project strategy**: Separate dev/prod workloads
4. **A/B test processing speed**: User impact analysis

---

## 11. Risk Assessment

### Risks Mitigated by This Fix

✅ **Code import errors**: Fixed by cleaning up deleted imports
✅ **Deployment timeouts**: Container will start within startup probe limits
✅ **Cost waste**: No more failed builds ($0.06 per failed attempt)
✅ **Development blocked**: Can proceed with testing once code fixed

### Remaining Risks

⚠️ **GPU quota unavailable**: May need to request (24-48 hour wait)
⚠️ **GPU cost higher than expected**: Monitor and optimize
⚠️ **Cold start times**: May need frontend warming strategies
⚠️ **Different project quotas**: May have different limits than production

### Mitigation Strategies

1. **GPU quota risk**: Deploy to CPU first, request quota in parallel
2. **Cost risk**: Set min-instances=0, use Cloud Billing alerts
3. **Cold start risk**: Implement frontend warming (already done in production)
4. **Quota difference risk**: Document and track quota usage across projects

---

## 12. Success Metrics

### Code Fix Success
- ✅ Python imports succeed locally
- ✅ Docker container starts locally
- ✅ `/health` endpoint responds (200 OK)
- ✅ No ModuleNotFoundError in logs

### Deployment Success
- ✅ Cloud Build completes successfully
- ✅ Docker image pushed to registry
- ✅ Cloud Run service shows "Ready" status
- ✅ Service URL accessible and responding

### GPU Functionality Success (If Required)
- ✅ PyTorch detects CUDA device in logs
- ✅ InSPyReNet model loads on GPU
- ✅ Processing times: 3-5s per image (GPU) or 30-60s (CPU)
- ✅ No GPU-related errors in logs

### Cost Success
- ✅ No idle GPU costs (min-instances=0 working)
- ✅ Per-image cost: <$0.005 (GPU) or <$0.002 (CPU)
- ✅ Monthly cost: <$10 for testing phase

---

## Appendix A: File Change Summary

### Files Requiring Changes

| File | Change Type | Priority | Complexity |
|------|-------------|----------|------------|
| `src/effects/__init__.py` | Remove imports | Critical | Low |
| `src/effects/effects_processor.py` | Remove registrations | Critical | Low |
| `src/integrated_processor.py` | Remove references | High | Medium |
| `src/api_v2_endpoints.py` | Update validation | High | Medium |

### Files to Verify (May Not Need Changes)

| File | Check For | Priority |
|------|-----------|----------|
| `src/main.py` | Direct effect imports | Low |
| `src/storage.py` | Effect-related storage paths | Low |
| `tests/*.py` | Tests for deleted effects | Medium |

### Files to Delete (If Present)

| File | Status | Reason |
|------|--------|--------|
| `src/effects/optimized_popart_effect.py` | Already deleted | Not in Glob results |
| `src/effects/dithering_effect.py` | Already deleted | Not in Glob results |
| `src/effects/pet_optimized_eightbit_effect.py` | Already deleted | Not in Glob results |

---

## Appendix B: Comparison with Working Production

### Configuration Differences

| Setting | Production (Working) | Staging (Failing) | Impact |
|---------|---------------------|-------------------|--------|
| **Project** | perkieprints-processing | gen-lang-client-0601138686 | Different quota |
| **Service Name** | inspirenet-bg-removal-api | inspirenet-bg-removal-api-gemini | Different instance |
| **Image Tag** | critical-fix | style-consolidation | Different code |
| **Startup Probe Delay** | 60s | 120s | More time allowed |
| **Startup Probe Timeout** | 30s | 60s | More time allowed |
| **Startup Probe Failures** | 10 | 15 | More retries allowed |

### Why Production Works

1. **Code is clean**: No deleted imports in production image
2. **GPU quota approved**: Project has GPU quota already
3. **Proven configuration**: Been running successfully for weeks/months

### Why Staging Fails

1. **Code has broken imports**: Style consolidation deleted files but not imports
2. **GPU quota unknown**: New project, may not have GPU quota yet
3. **Never reached GPU check**: Failed on imports before GPU request

**Key Insight**: Fix code first, then GPU quota becomes relevant.

---

## Appendix C: Related Documentation

### Internal Documentation
- `.claude/doc/style-consolidation-implementation-plan.md` - Why effects were deleted
- `.claude/doc/pipeline-consolidation-strategy-evaluation.md` - Strategic decision
- `.claude/tasks/context_session_001.md` - Current work context

### Google Cloud Documentation
- [Cloud Run GPU Support](https://cloud.google.com/run/docs/configuring/gpus)
- [Cloud Run Startup Probes](https://cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run Troubleshooting](https://cloud.google.com/run/docs/troubleshooting)
- [GPU Quota Requests](https://cloud.google.com/compute/docs/gpus/gpu-quota)

### Project Files
- `backend/inspirenet-api/deploy-to-nanobanana.yaml` - Cloud Run config (needs code fix first)
- `backend/inspirenet-api/cloudbuild-nanobanana.yaml` - Build config
- `backend/inspirenet-api/Dockerfile` - Container definition
- `backend/inspirenet-api/src/main.py` - Application entry point

---

**End of Root Cause Analysis**

**Prepared by**: Infrastructure Reliability Engineer Agent
**Date**: 2025-10-28
**Status**: Ready for Implementation
**Estimated Fix Time**: 15-30 minutes (code cleanup) + 20 minutes (rebuild/deploy) = 35-50 minutes total
