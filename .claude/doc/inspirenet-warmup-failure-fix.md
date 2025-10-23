# InSPyReNet API Warmup Failure - Root Cause Analysis & Fix Plan

**Date**: 2025-10-02
**Session**: context_session_20250921_162255
**Status**: Root cause identified, implementation plan ready

---

## Executive Summary

**Critical Bug**: Warmup endpoint fails in production with `height and width must be > 0` error after ~53s, but returns HTTP 200 OK masking the failure.

**Root Cause**: Dynamic resize mode rounds image dimensions to nearest multiple of 32. A 16x16 warmup image becomes 0x0 after rounding: `int(round(16/32)) * 32 = 0`.

**Impact**:
- Production API appears healthy but warmup never succeeds
- Cold starts remain 30-60s because model warming fails silently
- Frontend warming strategies are ineffective
- User experience degraded without visible errors

**Fix Complexity**: Low (single constant change + error handling improvements)

---

## Root Cause Analysis

### 1. Error Flow Discovery

**Production Log Entry**:
```
ERROR:inspirenet_model:Warmup failed after 53.08s: height and width must be > 0
Timestamp: 2025-10-02T17:02:46.620275Z
Status: 200 OK (HTTP response)
Latency: 53.975s
User-Agent: iPhone iOS 26.0.0 with Chrome
```

**Critical Observations**:
1. Error occurs AFTER model loads (~30s model load + ~23s processing attempt)
2. Returns HTTP 200 despite internal failure
3. Error message indicates dimension validation failure
4. Happens during `model.process(dummy_image)` call

### 2. Code Investigation

**File**: `backend/inspirenet-api/src/inspirenet_model.py`

**Warmup Method (lines 296-378)**:
```python
def warmup(self) -> dict:
    # ... model loading ...

    # Line 325: Create 16x16 dummy image
    dummy_image = Image.new('RGB', (16, 16), color=(128, 128, 128))

    # Line 329: Process with model
    result = self.model.process(dummy_image, type='rgba')
    # ^ This is where the error occurs
```

**Deployment Config**: `backend/inspirenet-api/deploy-production-clean.yaml`
```yaml
# Line 89
- name: INSPIRENET_RESIZE
  value: "dynamic"  # <-- This is the problem
```

**Model Initialization (lines 114-118)**:
```python
self.model = Remover(
    mode=self.mode,         # 'base'
    device=device_str,      # 'cuda' or 'cpu'
    resize=self.resize_mode # 'dynamic' <-- Uses dynamic_resize transform
)
```

### 3. The Bug - transparent-background Package

**Source**: `transparent-background/utils.py::dynamic_resize`

```python
class dynamic_resize:
    def __init__(self, L=1280):
        self.L = L

    def __call__(self, img):
        size = list(img.size)  # [16, 16] from warmup

        # Check if resize needed (only if dimension > 1280)
        if (size[0] >= size[1]) and size[1] > self.L:
            size[0] = size[0] / (size[1] / self.L)
            size[1] = self.L
        elif (size[1] > size[0]) and size[0] > self.L:
            size[1] = size[1] / (size[0] / self.L)
            size[0] = self.L

        # CRITICAL BUG: Round to nearest 32x multiple
        # For 16x16: int(round(16/32)) * 32 = int(0.5) * 32 = 0 * 32 = 0
        size = (int(round(size[0] / 32)) * 32, int(round(size[1] / 32)) * 32)

        return img.resize(size, Image.BILINEAR)
        #              ^ Becomes (0, 0) for 16x16 input!
```

**Mathematical Proof**:
```
Input: 16x16 image
Step 1: No resize (16 < 1280, so conditions false)
Step 2: Round to 32x multiple
  - width:  int(round(16 / 32)) * 32 = int(0.5) * 32 = 0 * 32 = 0
  - height: int(round(16 / 32)) * 32 = int(0.5) * 32 = 0 * 32 = 0
Result: (0, 0) image

Minimum safe size for dynamic_resize:
- 17 pixels: int(round(17/32)) * 32 = int(0.53) * 32 = 0 * 32 = 0 ❌
- 24 pixels: int(round(24/32)) * 32 = int(0.75) * 32 = 0 * 32 = 0 ❌
- 32 pixels: int(round(32/32)) * 32 = int(1.0) * 32 = 1 * 32 = 32 ✅
```

**Minimum safe warmup size: 32x32 pixels**

### 4. Secondary Issues Discovered

**Issue 1: Error Handling Masks Failure**

`backend/inspirenet-api/src/inspirenet_model.py` (lines 368-378):
```python
except Exception as e:
    total_time = time.time() - start_time
    logger.error(f"Warmup failed after {total_time:.2f}s: {e}")

    return {
        "status": "error",  # <-- Returns error status
        "message": f"Warmup failed: {str(e)}",
        # ... but endpoint returns HTTP 200 ...
    }
```

`backend/inspirenet-api/src/main.py` (lines 364-408):
```python
@app.post("/warmup")
async def warmup():
    # ...
    warmup_result = processor.warmup()

    # Line 393: Always returns 200 OK regardless of warmup_result['status']
    return warmup_result  # <-- Should check status and return 500 on error
```

**Issue 2: Inconsistent Warmup Image Sizes**

- Model loading test (line 123): Uses **32x32** dummy image ✅ WORKS
- Warmup method (line 325): Uses **16x16** dummy image ❌ FAILS
- Comment (line 322): Says "1x1 can cause issues" but doesn't mention 16x16 issues

**Issue 3: NumPy Type Workaround Incomplete**

Lines 331-340 have a workaround for NumPy type errors, but only catches specific message:
```python
if "No matching definition for argument type" in str(e):
    # Workaround...
```

This won't catch the dimension error, which has a different message.

---

## Impact Analysis

### Production Impact

1. **Warmup Endpoint Never Works**:
   - API logs show warmup failures in production
   - Frontend warming strategies (hover, page load) are ineffective
   - Cold starts remain 30-60s instead of 3-5s with successful warmup

2. **Silent Failure**:
   - HTTP 200 OK response masks the error
   - Monitoring tools don't detect the issue
   - Frontend assumes warmup succeeded

3. **User Experience**:
   - First-time users on cold containers wait 30-60s
   - Mobile users (70% of traffic) especially affected
   - Business hour warmup via Cloud Scheduler also fails

4. **Cost Efficiency Lost**:
   - Can't use min-instances=0 effectively if warmup doesn't work
   - Either pay $65-100/day for constant instance OR accept 60s cold starts
   - Current "smart warming strategy" provides no benefit

### Why Real Image Requests Work

Real product images are typically:
- 800x800 to 2000x2000 pixels
- Well above 32x32 minimum threshold
- Survive the 32x rounding in dynamic_resize

Example: 1024x1024 image
```
int(round(1024 / 32)) * 32 = int(32) * 32 = 1024 ✅
```

This is why production API works for actual requests but warmup fails.

---

## Implementation Plan

### Fix 1: Increase Warmup Image Size (CRITICAL - 5 min)

**File**: `backend/inspirenet-api/src/inspirenet_model.py`

**Location**: Line 325 in `warmup()` method

**Change**:
```python
# OLD (line 325):
dummy_image = Image.new('RGB', (16, 16), color=(128, 128, 128))

# NEW:
dummy_image = Image.new('RGB', (64, 64), color=(128, 128, 128))
```

**Rationale**:
- 64x64 is safely above 32x32 minimum: `int(round(64/32)) * 32 = 64`
- Small enough for fast warmup (minimal GPU computation)
- Larger than model loading test (32x32) for extra safety
- Well-tested dimension (common in ML/CV)

**Alternative Options Considered**:
1. **32x32**: Minimum safe size, but too close to edge case
2. **48x48**: Safe but arbitrary number
3. **64x64**: ✅ Chosen - standard power of 2, good safety margin
4. **128x128**: Overkill, wastes GPU cycles during warmup

### Fix 2: Add HTTP Status Code Error Handling (IMPORTANT - 10 min)

**File**: `backend/inspirenet-api/src/main.py`

**Location**: Lines 364-408 in `/warmup` endpoint

**Change**:
```python
@app.post("/warmup")
async def warmup():
    """
    Lightweight warmup endpoint that initializes the model with minimal processing.
    Designed for frontend warming strategies to reduce cold start impact.
    """
    if processor is None:
        # Return 503 Service Unavailable instead of 200
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": "Processor not initialized",
                "warmup_time": 0,
                "model_ready": False
            }
        )

    logger.info("Warmup endpoint called")
    start_time = time.time()

    try:
        # Use the processor's warmup method
        warmup_result = processor.warmup()

        # Add endpoint-specific metadata
        warmup_result.update({
            "endpoint": "/warmup",
            "timestamp": time.time(),
            "container_ready": True
        })

        # NEW: Check warmup status and return appropriate HTTP code
        if warmup_result.get("status") == "error":
            logger.error(f"Warmup failed: {warmup_result.get('message')}")
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content=warmup_result
            )

        logger.info(f"Warmup endpoint completed in {warmup_result.get('total_time', 0):.2f}s")
        return warmup_result  # 200 OK only if successful

    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Warmup endpoint exception after {total_time:.2f}s: {e}")

        # Return 500 Internal Server Error
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Warmup failed: {str(e)}",
                "error_type": type(e).__name__,
                "total_time": total_time,
                "model_ready": processor.is_model_ready() if processor else False,
                "endpoint": "/warmup",
                "timestamp": time.time(),
                "container_ready": True
            }
        )
```

**Rationale**:
- HTTP 500 signals actual failure to monitoring/frontend
- Frontend can retry or show error to user
- Monitoring systems can alert on 500 status codes
- Follows REST best practices

### Fix 3: Align Model Loading Test Size (CONSISTENCY - 5 min)

**File**: `backend/inspirenet-api/src/inspirenet_model.py`

**Location**: Line 123 in `load_model()` method

**Change**:
```python
# OLD (line 123):
dummy_image = Image.new('RGB', (32, 32), color='red')

# NEW:
dummy_image = Image.new('RGB', (64, 64), color='red')
```

**Rationale**:
- Consistency: Both warmup and model loading use same test size
- Avoids confusion about "why different sizes?"
- Same safety margin for both operations

### Fix 4: Update Comments (DOCUMENTATION - 2 min)

**File**: `backend/inspirenet-api/src/inspirenet_model.py`

**Location**: Line 322 (warmup method comment)

**Change**:
```python
# OLD (line 322):
# Process minimal 16x16 pixel image for warmup (1x1 can cause issues with some models)

# NEW:
# Process minimal 64x64 pixel image for warmup
# Note: Must be ≥32x32 for dynamic resize mode (rounds to 32x multiple)
# Larger sizes (64x64) provide safety margin and are standard in ML/CV
```

**Location**: Line 122 (model loading comment)

**Add before line 122**:
```python
# Test with 64x64 dummy image to verify model loads correctly
# Size chosen to work with both static and dynamic resize modes
# (dynamic mode requires ≥32x32 after rounding to 32x multiple)
```

### Fix 5: Add Validation Guard (DEFENSIVE - 10 min)

**File**: `backend/inspirenet-api/src/inspirenet_model.py`

**Location**: After line 325 in `warmup()` method

**Add validation**:
```python
dummy_image = Image.new('RGB', (64, 64), color=(128, 128, 128))

# NEW: Defensive validation for resize mode
if self.resize_mode == 'dynamic':
    # Ensure image size is safe for dynamic resize (min 32x32 after rounding)
    width, height = dummy_image.size
    if width < 24 or height < 24:  # 24 is minimum to round to 32
        logger.warning(f"Warmup image {width}x{height} may be too small for dynamic resize, using 64x64")
        dummy_image.close()
        dummy_image = Image.new('RGB', (64, 64), color=(128, 128, 128))
```

**Rationale**:
- Defensive programming prevents future regressions
- Warns developers if warmup size is changed incorrectly
- Self-healing: automatically fixes size if too small

---

## Testing Plan

### Unit Tests (Before Deployment)

**Test File**: `backend/inspirenet-api/tests/test_warmup_fix.py` (NEW)

```python
"""
Test warmup functionality with dynamic resize mode.
Validates fix for 16x16 image dimension bug.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from PIL import Image
from inspirenet_model import InSPyReNetProcessor

def test_warmup_with_dynamic_resize():
    """Test warmup succeeds with 64x64 image in dynamic mode"""
    processor = InSPyReNetProcessor(
        target_size=1024,
        mode='base',
        resize_mode='dynamic'  # Critical: This is production config
    )

    result = processor.warmup()

    assert result['status'] == 'success', f"Warmup failed: {result}"
    assert result['model_ready'] == True
    assert result['total_time'] > 0
    print(f"✅ Warmup succeeded in {result['total_time']:.2f}s")

def test_small_image_dimensions():
    """Test that various small images work with dynamic resize"""
    from transparent_background.utils import dynamic_resize

    resize_fn = dynamic_resize(L=1280)

    test_cases = [
        (16, 16, "Should fail - rounds to 0x0"),
        (32, 32, "Minimum safe - rounds to 32x32"),
        (64, 64, "Warmup size - rounds to 64x64"),
        (48, 48, "Safe - rounds to 32x32"),
    ]

    for width, height, desc in test_cases:
        img = Image.new('RGB', (width, height), color='gray')
        try:
            resized = resize_fn(img)
            result_size = resized.size
            print(f"✅ {width}x{height} -> {result_size[0]}x{result_size[1]} ({desc})")
            assert result_size[0] > 0 and result_size[1] > 0, f"Invalid dimensions: {result_size}"
        except Exception as e:
            print(f"❌ {width}x{height} failed: {e} ({desc})")
            if width >= 32:
                raise  # Should not fail for ≥32x32

if __name__ == "__main__":
    print("Testing warmup fix for dynamic resize bug...")
    print("\n1. Testing small image dimensions:")
    test_small_image_dimensions()

    print("\n2. Testing warmup with dynamic resize:")
    test_warmup_with_dynamic_resize()

    print("\n✅ All tests passed!")
```

### Integration Tests (After Deployment)

**1. Local Test (Before Push)**:
```bash
cd backend/inspirenet-api
python tests/test_warmup_fix.py
```

**2. Cloud Run Test (After Deployment)**:
```bash
# Test warmup endpoint
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup

# Should return:
# Status: 200 OK
# Body: {"status": "success", "model_ready": true, ...}

# If fails, should return:
# Status: 500 Internal Server Error
# Body: {"status": "error", "message": "...", ...}
```

**3. Frontend Integration Test**:
- Open Shopify staging: `https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/`
- Navigate to pet background remover page
- Monitor browser console for warmup requests
- Verify subsequent processing is fast (3-5s, not 30-60s)

**4. Mobile Test (iPhone - 70% of traffic)**:
- Open staging on actual iPhone or iPhone simulator
- Test warmup on page load
- Verify processing time improvement

### Validation Criteria

**Success Metrics**:
1. ✅ Warmup endpoint returns HTTP 200 (not 500)
2. ✅ Warmup completes in 30-35s (model load) + <1s (processing)
3. ✅ Subsequent requests process in 3-5s (not 30-60s)
4. ✅ No "height and width must be > 0" errors in logs
5. ✅ Frontend warming strategies show "model_ready: true"

**Failure Detection**:
1. ❌ HTTP 500 from /warmup endpoint
2. ❌ "height and width must be > 0" in logs
3. ❌ Warmup takes >60s
4. ❌ Subsequent requests still slow (30s+)

---

## Deployment Procedure

### Step 1: Code Changes (Estimated: 30 min)

1. Update `backend/inspirenet-api/src/inspirenet_model.py`:
   - Line 123: 32x32 → 64x64 (model loading test)
   - Line 322-325: 16x16 → 64x64 (warmup image)
   - Add validation guard
   - Update comments

2. Update `backend/inspirenet-api/src/main.py`:
   - Lines 364-408: Add HTTP status code handling in `/warmup`

3. Create `backend/inspirenet-api/tests/test_warmup_fix.py`:
   - Add unit tests for warmup functionality

### Step 2: Local Testing (Estimated: 15 min)

```bash
cd backend/inspirenet-api

# Run warmup test
python tests/test_warmup_fix.py

# Expected output:
# ✅ 32x32 -> 32x32 (Minimum safe)
# ✅ 64x64 -> 64x64 (Warmup size)
# ✅ Warmup succeeded in ~30s
```

### Step 3: Commit Changes (Estimated: 5 min)

```bash
git add backend/inspirenet-api/src/inspirenet_model.py
git add backend/inspirenet-api/src/main.py
git add backend/inspirenet-api/tests/test_warmup_fix.py

git commit -m "$(cat <<'EOF'
Fix critical warmup failure in dynamic resize mode

Root Cause:
- Warmup used 16x16 image with dynamic resize mode
- dynamic_resize rounds to 32x multiple: int(round(16/32))*32 = 0
- Results in 0x0 image causing "height and width must be > 0" error
- Error was masked by HTTP 200 response despite internal failure

Changes:
1. Increase warmup image from 16x16 to 64x64 (safe for dynamic resize)
2. Align model loading test to 64x64 for consistency
3. Add HTTP 500 status for warmup failures (was returning 200)
4. Add defensive validation for dynamic resize mode
5. Update comments to document size requirements

Testing:
- Unit tests in tests/test_warmup_fix.py
- Validates dynamic resize behavior with various sizes
- Confirms warmup succeeds in production config (dynamic mode)

Impact:
- Warmup endpoint now works correctly in production
- Cold starts reduced from 60s to 3-5s after warmup
- Frontend warming strategies now effective
- Mobile users (70% traffic) benefit from faster loads

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 4: Deploy to Cloud Run (Estimated: 10 min)

```bash
cd backend/inspirenet-api/scripts
./deploy-model-fix.sh

# Monitor deployment
gcloud run services describe inspirenet-bg-removal-api \
  --region us-central1 \
  --format='value(status.url)'
```

### Step 5: Verify Production (Estimated: 10 min)

```bash
# 1. Test warmup endpoint
curl -X POST \
  https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
  -H "Content-Type: application/json" \
  -v

# Expected: HTTP 200, status: "success", model_ready: true

# 2. Test real image processing (verify warmup helped)
# Upload test image via frontend
# Should complete in 3-5s (not 30-60s)

# 3. Check logs for errors
gcloud logging read \
  "resource.type=cloud_run_revision \
   AND resource.labels.service_name=inspirenet-bg-removal-api \
   AND severity>=ERROR" \
  --limit 50 \
  --format json

# Expected: No "height and width must be > 0" errors
```

### Step 6: Monitor (First 24 hours)

**Metrics to Watch**:
1. Warmup endpoint success rate (should be ~100%)
2. Average processing time for first request per container (should be 3-5s)
3. Error logs (should see no dimension errors)
4. User-reported cold start times (should improve)

**Cloud Logging Queries**:
```
# Warmup successes
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
"Warmup completed successfully"

# Warmup failures (should be 0)
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
"Warmup failed"

# Dimension errors (should be 0)
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
"height and width must be > 0"
```

---

## Risk Assessment

### Low Risk Areas ✅

1. **Warmup Image Size Change**:
   - Changing 16x16 → 64x64 is safe
   - 64x64 is well-tested standard size
   - No risk of breaking existing functionality

2. **Model Loading Test Size**:
   - Already using 32x32, increasing to 64x64 is conservative
   - Only affects startup test, not production processing

3. **Comment Updates**:
   - Zero risk, documentation only

### Medium Risk Areas ⚠️

1. **HTTP Status Code Changes**:
   - **Risk**: Frontend might not handle 500 status correctly
   - **Mitigation**: Frontend should already handle errors (it's a warmup optimization)
   - **Testing**: Test error handling before production deployment

2. **Validation Guard**:
   - **Risk**: Could log warnings unnecessarily
   - **Mitigation**: Only triggers if size < 24 (which won't happen with 64x64)
   - **Testing**: Unit test validates behavior

### Zero Risk Areas 🔒

1. **No changes to actual image processing**:
   - Real product images unaffected
   - Same InSPyReNet model and parameters
   - Same effects processing

2. **No changes to API contracts**:
   - Response structure unchanged
   - Only HTTP status codes improved (more correct)

3. **Backwards compatible**:
   - Frontend works with both old and new versions
   - No breaking changes to API

---

## Rollback Plan

**If deployment fails or causes issues:**

### Quick Rollback (5 min)

```bash
# Revert to previous Cloud Run revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100

# Or rollback code
git revert HEAD
git push origin staging
# Wait for auto-deployment
```

### Partial Rollback Options

**If only HTTP status codes are problematic:**
- Keep warmup image size fix (critical)
- Revert HTTP 500 responses (keep HTTP 200)
- Still fixes core issue, just masks errors again

**If warmup size causes issues** (unlikely):
- Try intermediate size: 48x48 or 56x56
- Still above 32x32 minimum
- Less GPU computation than 64x64

---

## Future Improvements (Out of Scope)

These are NOT part of this fix but worth considering later:

### 1. Support Static Resize Mode for Warmup
- Add environment variable: `WARMUP_RESIZE_MODE=static`
- Use static resize for warmup even if production uses dynamic
- Avoids dynamic resize complexity during warmup

### 2. Cache Warmed Model Weights
- Save model state after first warmup to disk
- Load from cache on subsequent cold starts
- Could reduce 30s model load to 5-10s

### 3. Warmup Metrics Dashboard
- Track warmup success rate
- Monitor warmup latency over time
- Alert on failures

### 4. Intelligent Warmup Size
- Auto-detect resize mode and choose appropriate size
- Static mode: use 16x16 (fast)
- Dynamic mode: use 64x64 (safe)

### 5. Test Coverage Expansion
- Add pytest suite for all resize modes
- Test edge cases (1x1, 15x15, 31x31, 33x33)
- Integration tests with actual Cloud Run

---

## Questions & Assumptions

### Assumptions Made

1. ✅ **Dynamic resize is required for production**:
   - Deploy config specifies `INSPIRENET_RESIZE=dynamic`
   - Assumed this is intentional for quality reasons
   - Not changing resize mode, only warmup size

2. ✅ **64x64 is acceptable warmup size**:
   - Assumption: Slightly more GPU computation is acceptable
   - Alternative: Could use 32x32 (minimum safe) for faster warmup
   - Chose 64x64 for safety margin and standardization

3. ✅ **HTTP 500 is appropriate for warmup failures**:
   - Assumption: Frontend/monitoring can handle 500 status
   - Alternative: Could use 503 Service Unavailable
   - Chose 500 to signal internal error vs temporary unavailability

4. ✅ **No need to modify transparent-background package**:
   - Assumption: Package is external dependency, shouldn't fork
   - Working around limitation rather than fixing upstream
   - Appropriate: We control warmup image size

### Questions for Review

1. **Should warmup use static resize instead of dynamic?**
   - Pro: Faster warmup, no dimension constraints
   - Con: Inconsistent with production config
   - Current plan: Keep dynamic, use larger image

2. **Is 64x64 the right size, or should we use 32x32?**
   - 32x32: Minimum safe, fastest warmup
   - 64x64: Current choice, safety margin
   - 128x128: Conservative but slower

3. **Should we add warmup metrics to monitoring?**
   - Out of scope for this fix
   - But would help detect future issues
   - Recommend as follow-up task

4. **Should we test on staging before production?**
   - Current plan: Deploy directly to production (low risk)
   - Alternative: Deploy to staging, test, then promote
   - Staging environment may not exist for API

---

## Success Definition

**This fix is successful if:**

1. ✅ Warmup endpoint returns HTTP 200 (not 500) after model loads
2. ✅ No "height and width must be > 0" errors in production logs
3. ✅ Warmup completes in ~30s (model load) instead of failing at 53s
4. ✅ Subsequent image processing requests complete in 3-5s (not 30-60s)
5. ✅ Frontend warming strategies show "model_ready: true" status
6. ✅ Mobile users (70% traffic) experience faster load times
7. ✅ Cloud Scheduler warmup during business hours works correctly

**Red flags that indicate failure:**

1. ❌ Warmup still fails with dimension errors
2. ❌ Warmup succeeds but subsequent requests are slow
3. ❌ New errors appear in logs
4. ❌ Real image processing breaks
5. ❌ GPU memory issues (unlikely with small warmup image)

---

## Coordination Requirements

### Sub-Agents to Consult

Per CLAUDE.md rules, this task requires:

1. ✅ **debug-specialist**: Root cause analysis (THIS DOCUMENT)
2. **infrastructure-reliability-engineer**: Review Cloud Run impact
3. **code-quality-reviewer**: Review code changes before commit
4. **solution-verification-auditor**: Validate implementation plan

### Files to Update Session Context

After implementation, append to:
- `.claude/tasks/context_session_20250921_162255.md`

Include:
- Fix applied (warmup image size)
- Deployment timestamp
- Validation results
- Monitoring setup
- Any issues encountered

---

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Code changes | 30 min | 30 min |
| Local testing | 15 min | 45 min |
| Commit & push | 5 min | 50 min |
| Cloud Run deployment | 10 min | 60 min |
| Production verification | 10 min | 70 min |
| Monitoring setup | 10 min | 80 min |
| **Total** | **~1.5 hours** | - |

**Plus 24-hour monitoring period for full validation**

---

## Appendix A: Detailed Error Stack

**Full error from production logs**:
```
ERROR:inspirenet_model:Warmup failed after 53.08s: height and width must be > 0
Timestamp: 2025-10-02T17:02:46.620275Z

Stack trace (inferred from code flow):
1. POST /warmup endpoint called (main.py:364)
2. processor.warmup() invoked (main.py:383)
3. Model loads successfully in ~30s (inspirenet_model.py:308)
4. Create 16x16 dummy image (inspirenet_model.py:325)
5. Call model.process() (inspirenet_model.py:329)
6. transparent_background.Remover.process() called
7. Transform pipeline: dynamic_resize(img)
8. Round 16/32 = 0.5 -> int(0.5) * 32 = 0
9. img.resize((0, 0)) called
10. PIL.Image.resize() raises error: "height and width must be > 0"
11. Exception caught in warmup() (inspirenet_model.py:368)
12. Returns {"status": "error", ...} (inspirenet_model.py:372)
13. Endpoint returns HTTP 200 with error status (main.py:393)
```

## Appendix B: Related Code Locations

**Files involved in fix**:
1. `backend/inspirenet-api/src/inspirenet_model.py`
   - Line 123: Model loading test image size
   - Line 322-325: Warmup image creation
   - Line 329: Model process call (where error occurs)
   - Line 368-378: Error handling

2. `backend/inspirenet-api/src/main.py`
   - Line 364-408: /warmup endpoint

3. `backend/inspirenet-api/deploy-production-clean.yaml`
   - Line 89: INSPIRENET_RESIZE=dynamic (root configuration)

**External dependency**:
- `transparent-background==1.3.4`
  - Location: `C:\Users\perki\AppData\Roaming\Python\Python313\site-packages\transparent_background\`
  - File: `utils.py::dynamic_resize`
  - Issue: Rounds dimensions to 32x multiple, causing 16x16 -> 0x0

## Appendix C: Alternative Solutions Considered

### Alternative 1: Switch to Static Resize
**Approach**: Change `INSPIRENET_RESIZE=static` in deployment config

**Pros**:
- Eliminates dimension rounding issue
- Faster processing (no dynamic size calculation)
- Simpler logic

**Cons**:
- May reduce output quality for large/small images
- Changes production behavior (not just warmup)
- Would need extensive testing with real images
- Unknown why dynamic was chosen initially

**Decision**: REJECTED - Too risky, changes production behavior

### Alternative 2: Fork transparent-background Package
**Approach**: Modify dynamic_resize to handle small images better

**Pros**:
- Fixes root cause in library
- Could contribute back upstream

**Cons**:
- Maintenance burden (tracking upstream changes)
- Deployment complexity (custom package)
- Over-engineering for simple warmup issue

**Decision**: REJECTED - Not worth maintenance overhead

### Alternative 3: Skip Warmup Processing
**Approach**: Only load model, don't run test inference

**Pros**:
- Avoids dimension issue entirely
- Faster warmup

**Cons**:
- Doesn't verify model works correctly
- GPU may not be fully initialized
- Defeats purpose of warmup (testing full pipeline)

**Decision**: REJECTED - Warmup should test full path

### Alternative 4: Add Dynamic Resize Check in Warmup
**Approach**: Detect resize mode and choose size accordingly

```python
if self.resize_mode == 'dynamic':
    dummy_size = 64  # Safe for dynamic
else:
    dummy_size = 16  # Faster for static
dummy_image = Image.new('RGB', (dummy_size, dummy_size), ...)
```

**Pros**:
- Optimizes warmup for each mode
- Handles future mode changes

**Cons**:
- More complex code
- Premature optimization (static mode not used)

**Decision**: CONSIDERED but chose simpler fix (always use 64x64)

### Alternative 5: Use 32x32 (Minimum Safe Size)
**Approach**: Use exactly the minimum safe size for dynamic resize

**Pros**:
- Faster than 64x64 (less GPU computation)
- Minimum that works

**Cons**:
- No safety margin (edge case)
- Less standard size than 64x64
- Inconsistent with model loading test (32x32)

**Decision**: REJECTED in favor of 64x64 for safety margin

---

**END OF IMPLEMENTATION PLAN**
