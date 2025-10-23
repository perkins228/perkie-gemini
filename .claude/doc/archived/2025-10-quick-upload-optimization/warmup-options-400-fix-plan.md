# Warmup OPTIONS 400 Error - Implementation Plan

**Date**: 2025-01-05
**Agent**: debug-specialist
**Session**: 1736094648
**Priority**: CRITICAL
**Business Impact**: HIGH - Affects 70% of customers (mobile)

---

## Executive Summary

**Problem**: 15.4% of CORS preflight OPTIONS requests to `/warmup` endpoint fail with HTTP 400, causing 12-16 second delays and defeating the pre-warming strategy. This particularly impacts mobile users (70% of revenue).

**Root Cause**: Startup race condition - OPTIONS requests arrive before FastAPI's CORSMiddleware is fully initialized, causing default uvicorn handler to reject them with 400 Bad Request.

**Impact**:
- 1 in 6-7 warmup attempts fail
- Failed warmup = full 30-60s cold start instead of instant
- Mobile users experience loading delays
- Pre-warming strategy ineffective

**Solution**: Three-pronged approach
1. Add explicit OPTIONS handlers for critical endpoints
2. Migrate to FastAPI lifespan pattern for guaranteed initialization
3. Add readiness probe to prevent premature traffic routing

**Estimated Effort**: 2-3 hours implementation + 1 hour testing
**Risk Level**: LOW - Additive changes, no breaking modifications

---

## Detailed Root Cause Analysis

### The Race Condition

**Timeline of Failure** (from logs):
```
T+0.000s: Container starts, Uvicorn begins initialization
T+0.754s: Uvicorn running on http://0.0.0.0:8080
T+0.755s: TCP health probe succeeds
T+0.793s: OPTIONS /warmup arrives ← 38ms after probe
T+0.793s: HTTP 400 Bad Request returned
T+0.800s: FastAPI middleware chain fully active (too late)
```

**What Happens**:

1. **Container Starts**: Cloud Run allocates GPU, starts Python process
2. **Uvicorn Starts**: Begins listening on port 8080
3. **Health Probe Succeeds**: TCP connection successful (line 40-43 of deploy config)
4. **Cloud Run Routes Traffic**: Marks container "ready"
5. **OPTIONS Arrives**: Browser sends preflight request
6. **Middleware Not Ready**: CORSMiddleware not in request handling chain yet
7. **Default Handler Rejects**: Uvicorn's base handler returns 400 for unknown OPTIONS
8. **Middleware Activates**: ~10ms later, but request already failed

### Why This Happens

**FastAPI Startup Sequence**:
```python
1. app = FastAPI()                                    # App object created
2. app.add_middleware(CORSMiddleware, ...)           # Middleware registered
3. app.include_router(api_v2_router)                 # Routes registered
4. @app.on_event("startup")                          # Startup handlers queued
5. uvicorn.run("main:app", ...)                      # Server starts
6. → TCP port opens (health probe passes)            # Traffic routed
7. → Run startup event handlers                      # May not complete
8. → Middleware chain built                          # May not complete
```

**Gap**: Steps 7-8 may not complete before step 6 allows traffic through.

**Health Probe Config** (deploy-production-clean.yaml:40-43):
```yaml
run.googleapis.com/health-check-path: "/health"
run.googleapis.com/health-check-interval: "30s"
run.googleapis.com/health-check-timeout: "10s"
run.googleapis.com/health-check-failure-threshold: "3"
```

**Problem**: Health check verifies `/health` responds, but doesn't verify middleware is ready for `/warmup` OPTIONS.

### Evidence from 48-Hour Logs

**Failure Statistics**:
- Total OPTIONS requests: 52
- Successful: 44 (84.6%)
- Failed: 8 (15.4%)
- All failures on `/warmup` endpoint
- 6 out of 8 (75%) during container startup

**Correlation Analysis**:
```
Failure 1: 2025-10-17 22:29:41 → Startup found within 20 logs
Failure 2: 2025-10-18 14:03:05 → Startup found within 20 logs
Failure 3: 2025-10-18 17:22:44 → Startup found within 20 logs
Failure 4: 2025-10-18 21:46:02 → Startup found within 20 logs
Failure 5: 2025-10-18 21:58:20 → No startup (possible high-load scenario)
Failure 6: 2025-10-20 02:22:10 → Startup found within 20 logs
Failure 7: 2025-10-20 02:35:42 → Startup 38ms before (SMOKING GUN)
Failure 8: 2025-10-20 02:51:42 → No startup (possible high-load scenario)
```

**Pattern**: 75% of failures have clear startup correlation.

### Why 12-16 Second Latency?

User reported OPTIONS taking 12-16 seconds. This is NOT processing time, it's:

1. **Cold Start in Progress**: Model loading takes 20-30s
2. **OPTIONS Fails at T+1s**: Request rejected during startup
3. **Browser Retry Logic**: Modern browsers retry failed preflight
4. **Second Attempt Succeeds**: At T+30s when model loaded
5. **Total Perceived Latency**: 30s cold start - 18s already elapsed = 12s remaining

The 12-16s is what the USER PERCEIVES, not the actual OPTIONS processing time.

---

## Implementation Plan

### Solution 1: Add Explicit OPTIONS Handlers [REQUIRED]

**Purpose**: Guarantee OPTIONS handling even before middleware chain is active

**Implementation**:

#### File: `backend/inspirenet-api/src/main.py`

**Add after line 358 (before `@app.post("/warmup")`):**

```python
@app.options("/warmup")
async def warmup_options(request: Request):
    """
    Explicit OPTIONS handler for /warmup endpoint.
    Handles CORS preflight even before middleware chain is fully active.
    Critical for preventing 400 errors during container startup.
    """
    # Get origin from request headers
    origin = request.headers.get("origin", "")

    # Check if origin is allowed
    is_allowed = False

    # Check explicit origins
    if origin in ALLOWED_ORIGINS:
        is_allowed = True

    # Check Shopify preview regex
    elif origin and ".shopifypreview.com" in origin and origin.startswith("https://"):
        is_allowed = True

    # Build response headers
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-ID, User-Agent, Cache-Control, X-Requested-With",
        "Access-Control-Expose-Headers": "Content-Length, X-Processing-Time, X-Cache-Hits, X-Session-ID",
        "Access-Control-Max-Age": "3600",
    }

    if is_allowed:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return Response(status_code=200, headers=headers)
```

**Also add OPTIONS handlers for other critical endpoints:**

```python
@app.options("/api/v2/process-with-effects")
async def process_with_effects_options(request: Request):
    """Explicit OPTIONS handler for process-with-effects endpoint"""
    origin = request.headers.get("origin", "")
    is_allowed = origin in ALLOWED_ORIGINS or (".shopifypreview.com" in origin and origin.startswith("https://"))

    headers = {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-ID, User-Agent, Cache-Control, X-Requested-With",
        "Access-Control-Max-Age": "3600",
    }

    if is_allowed:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return Response(status_code=200, headers=headers)

@app.options("/api/storage/upload")
async def storage_upload_options(request: Request):
    """Explicit OPTIONS handler for storage upload endpoint"""
    origin = request.headers.get("origin", "")
    is_allowed = origin in ALLOWED_ORIGINS or (".shopifypreview.com" in origin and origin.startswith("https://"))

    headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-ID",
        "Access-Control-Max-Age": "3600",
    }

    if is_allowed:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"

    return Response(status_code=200, headers=headers)
```

**Rationale**:
- Explicit handlers are registered BEFORE app starts accepting traffic
- No dependency on middleware chain being active
- Follows FastAPI routing priority (explicit routes > middleware)
- Matches CORS policy exactly (no divergence from CORSMiddleware config)
- Provides fallback for startup race condition

**Risk**: LOW - Additive change, doesn't modify existing behavior

**Testing**:
```bash
# Test during cold start (within first 5 seconds of deployment)
curl -X OPTIONS https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
  -H "Origin: https://perkieprints.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Expected: 200 OK with CORS headers, even during startup
```

---

### Solution 2: Migrate to FastAPI Lifespan Pattern [RECOMMENDED]

**Purpose**: Ensure startup completes BEFORE traffic is routed

**Current Code** (main.py:164-210, DEPRECATED):
```python
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global processor, storage_manager

    logger.info("Starting production InSPyReNet Background Removal API...")
    # ... initialization code ...
```

**New Code** (replace above):

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Ensures initialization completes before traffic routing begins.

    Replaces deprecated @app.on_event("startup") pattern.
    """
    global processor, storage_manager

    # STARTUP PHASE
    logger.info("Starting production InSPyReNet Background Removal API...")

    try:
        # Initialize storage manager
        bucket_name = os.getenv("STORAGE_BUCKET", "perkieprints-processing-cache")
        storage_manager = CloudStorageManager(bucket_name)

        # Initialize processor
        target_size = int(os.getenv("TARGET_SIZE", "1024"))
        mode = os.getenv("INSPIRENET_MODE", "base")
        resize_mode = os.getenv("INSPIRENET_RESIZE", "static")

        processor = InSPyReNetProcessor(
            target_size=target_size,
            mode=mode,
            resize_mode=resize_mode
        )

        logger.info("InSPyReNet processor initialized (model will load on first request)")

        # Initialize API v2 components
        initialize_v2_api(storage_manager)
        logger.info("API v2 initialized with JSON response support")

        # Initialize customer image storage
        customer_bucket = os.getenv("CUSTOMER_STORAGE_BUCKET", "perkieprints-customer-images")
        initialize_customer_storage(customer_bucket)
        logger.info(f"Customer image storage initialized with bucket: {customer_bucket}")

        # Skip model loading during startup to prevent timeout
        logger.info("Skipping model pre-loading during startup (will load on first request)")

        # Log configuration
        min_instances = int(os.getenv("MIN_INSTANCES", "0"))
        logger.info(f"Configuration: MIN_INSTANCES={min_instances}")

        logger.info("Production InSPyReNet API started successfully")
        logger.info("🚦 Application ready to accept traffic")

    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise

    # Application is now ready - yield control to FastAPI
    # Traffic will only be routed AFTER this yield point
    yield

    # SHUTDOWN PHASE
    logger.info("Shutting down InSPyReNet API...")

    # Cleanup resources
    if processor:
        logger.info("Cleaning up processor resources...")
        # Add any cleanup needed

    if storage_manager:
        logger.info("Closing storage connections...")
        # Add any cleanup needed

    logger.info("Shutdown complete")


# Update FastAPI app initialization (line 44-48)
app = FastAPI(
    title="InSPyReNet Background Removal API",
    description="Production API for pet background removal with effects processing",
    version="2.0.1",
    lifespan=lifespan  # ← Add this parameter
)
```

**Rationale**:
- Modern FastAPI pattern (replaces deprecated `@app.on_event`)
- Guarantees startup completes before traffic routing
- Clear separation of startup/shutdown phases
- Better error handling and logging
- Future-proof (won't break in FastAPI 1.x or 2.x)

**Risk**: LOW - Well-documented pattern, FastAPI handles backward compatibility

**Testing**:
```bash
# Deploy new version
# Immediately send OPTIONS request
# Should wait for lifespan context to complete before accepting traffic
```

---

### Solution 3: Add Readiness Probe [HIGHLY RECOMMENDED]

**Purpose**: Separate "alive" (health) from "ready" (can handle traffic)

**Implementation**:

#### File: `backend/inspirenet-api/src/main.py`

**Add new endpoint after `/health` (line 321):**

```python
@app.get("/readiness")
@app.head("/readiness")
async def readiness_check():
    """
    Readiness probe for Cloud Run startup.
    Returns 200 only when application is fully initialized and ready for traffic.

    Differs from /health which returns 200 as soon as TCP connection works.
    This prevents OPTIONS 400 errors during startup race conditions.
    """
    # Check that all critical components are initialized
    if processor is None:
        return Response(
            status_code=503,
            content=json.dumps({
                "ready": False,
                "reason": "Processor not initialized"
            }),
            media_type="application/json"
        )

    if storage_manager is None:
        return Response(
            status_code=503,
            content=json.dumps({
                "ready": False,
                "reason": "Storage manager not initialized"
            }),
            media_type="application/json"
        )

    # Check memory health
    memory_info = memory_monitor.get_memory_info()
    memory_healthy = not memory_monitor.check_memory_pressure()

    if not memory_healthy:
        return Response(
            status_code=503,
            content=json.dumps({
                "ready": False,
                "reason": "High memory pressure",
                "memory": memory_info
            }),
            media_type="application/json"
        )

    # All checks passed
    return {
        "ready": True,
        "status": "healthy",
        "timestamp": time.time(),
        "components": {
            "processor": "initialized",
            "storage": "connected" if storage_manager.enabled else "disabled",
            "memory": "healthy"
        }
    }
```

#### File: `backend/inspirenet-api/deploy-production-clean.yaml`

**Update startup probe config (lines 45-50):**

```yaml
# Startup probe configuration - Use /readiness for reliable startup detection
run.googleapis.com/startup-probe-path: "/readiness"  # ← Changed from /health
run.googleapis.com/startup-probe-initial-delay: "60s"
run.googleapis.com/startup-probe-timeout: "30s"
run.googleapis.com/startup-probe-period: "10s"  # ← Reduced from 30s for faster detection
run.googleapis.com/startup-probe-failure-threshold: "10"
```

**Keep health check as-is (lines 39-43):**

```yaml
# Health check configuration - Keep using /health for liveness
run.googleapis.com/health-check-path: "/health"
run.googleapis.com/health-check-interval: "30s"
run.googleapis.com/health-check-timeout: "10s"
run.googleapis.com/health-check-failure-threshold: "3"
```

**Rationale**:
- **Startup probe** (`/readiness`): Checks if app is ready for FIRST traffic
- **Health probe** (`/health`): Checks if app is still alive during operation
- Separates "can handle traffic" from "is responsive"
- Standard Kubernetes/Cloud Run pattern
- Prevents premature traffic routing

**Risk**: LOW - Additive change, health probe unchanged

**Testing**:
```bash
# During deployment, watch logs
# Should see "Application ready to accept traffic" BEFORE first OPTIONS

# Verify readiness endpoint
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/readiness
# Should return 503 during startup, 200 when ready
```

---

## Implementation Sequence

### Phase 1: Quick Fix (30 minutes)

**Goal**: Stop OPTIONS 400 errors immediately

**Steps**:
1. Add explicit OPTIONS handlers to `main.py`
   - `/warmup` OPTIONS handler
   - `/api/v2/process-with-effects` OPTIONS handler
   - `/api/storage/upload` OPTIONS handler

2. Deploy to Cloud Run
   ```bash
   cd backend/inspirenet-api
   ./scripts/deploy-model-fix.sh
   ```

3. Test immediately after deployment
   ```bash
   # Within 10 seconds of deployment completing
   curl -X OPTIONS https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
     -H "Origin: https://perkieprints.com" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```

4. Monitor logs for 24 hours
   - Look for OPTIONS 400 errors
   - Should drop from 15.4% to < 1%

**Expected Result**: OPTIONS 400 errors eliminated

**Risk**: LOW - No breaking changes

**Rollback**: Previous revision still available

---

### Phase 2: Modernize Startup (1 hour)

**Goal**: Implement FastAPI best practices, prevent future issues

**Steps**:
1. Migrate to lifespan pattern
   - Replace `@app.on_event("startup")` with `@asynccontextmanager`
   - Update `FastAPI()` initialization with `lifespan` parameter
   - Add shutdown cleanup logic

2. Add `/readiness` endpoint
   - Comprehensive component checks
   - 503 until fully ready

3. Update Cloud Run startup probe
   - Change from `/health` to `/readiness`
   - Reduce period to 10s for faster detection

4. Deploy and test
   ```bash
   # Should see "Application ready" log before first OPTIONS
   gcloud logging read \
     "resource.type=cloud_run_revision AND \
      resource.labels.service_name=inspirenet-bg-removal-api AND \
      timestamp>=now-10m" \
     --limit=50 --format=json
   ```

**Expected Result**:
- No deprecation warnings
- Faster startup detection
- Zero OPTIONS 400 errors

**Risk**: LOW - Lifespan is well-tested FastAPI pattern

---

### Phase 3: Monitoring & Validation (30 minutes)

**Goal**: Verify fix and prevent regression

**Steps**:
1. Add structured logging for OPTIONS requests
   ```python
   @app.middleware("http")
   async def log_options_requests(request, call_next):
       if request.method == "OPTIONS":
           start = time.time()
           response = await call_next(request)
           duration = time.time() - start

           logger.info(f"OPTIONS {request.url.path} → {response.status_code} ({duration*1000:.1f}ms)")

           if response.status_code >= 400:
               logger.warning(f"OPTIONS failure: {request.url.path} from {request.headers.get('origin')}")

           return response
       return await call_next(request)
   ```

2. Create monitoring query
   ```bash
   # Query for OPTIONS failures
   gcloud logging read \
     'resource.type=cloud_run_revision AND
      textPayload=~"OPTIONS.*400" AND
      timestamp>=now-24h' \
     --limit=100 --format=json
   ```

3. Validate over 48 hours
   - OPTIONS success rate > 99%
   - No startup-related failures
   - Latency < 100ms for OPTIONS

**Expected Result**:
- OPTIONS success rate: 44/52 (84.6%) → 51/52 (99%+)
- Average OPTIONS latency: < 50ms
- Zero startup race conditions

---

## Files to Modify

### Backend Changes

#### 1. `backend/inspirenet-api/src/main.py`

**Changes**:
- Line 44-48: Add `lifespan` parameter to FastAPI init
- Line 164-210: Replace with lifespan context manager
- After line 321: Add `/readiness` endpoint
- After line 358: Add explicit OPTIONS handlers for:
  - `/warmup`
  - `/api/v2/process-with-effects`
  - `/api/storage/upload`
- After line 150: Add OPTIONS logging middleware (optional)

**Lines Added**: ~150
**Lines Modified**: ~50
**Risk**: LOW

#### 2. `backend/inspirenet-api/deploy-production-clean.yaml`

**Changes**:
- Line 46: Change startup probe from `/health` to `/readiness`
- Line 49: Change period from 30s to 10s

**Lines Modified**: 2
**Risk**: LOW

### No Frontend Changes Required

The frontend (`assets/api-warmer.js`) is already correct. No modifications needed.

---

## Testing Plan

### Unit Tests

**File**: `backend/inspirenet-api/tests/test_cors_startup.py` (NEW)

```python
"""
Test CORS OPTIONS handling during startup race conditions
"""
import asyncio
import httpx
import pytest

API_URL = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"

@pytest.mark.asyncio
async def test_warmup_options_during_cold_start():
    """Test OPTIONS request immediately after deployment"""
    # This test should be run IMMEDIATELY after deployment
    # to catch startup race condition

    async with httpx.AsyncClient() as client:
        response = await client.options(
            f"{API_URL}/warmup",
            headers={
                "Origin": "https://perkieprints.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            },
            timeout=30.0
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "https://perkieprints.com"

@pytest.mark.asyncio
async def test_options_endpoints_all():
    """Test all critical OPTIONS endpoints"""
    endpoints = [
        "/warmup",
        "/api/v2/process-with-effects",
        "/api/storage/upload"
    ]

    async with httpx.AsyncClient() as client:
        for endpoint in endpoints:
            response = await client.options(
                f"{API_URL}{endpoint}",
                headers={
                    "Origin": "https://perkieprints.com",
                    "Access-Control-Request-Method": "POST"
                }
            )

            assert response.status_code == 200, f"OPTIONS {endpoint} failed with {response.status_code}"
            assert "access-control-allow-methods" in response.headers

@pytest.mark.asyncio
async def test_readiness_probe():
    """Test new readiness endpoint"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_URL}/readiness")
        data = response.json()

        # Should be ready in warm state
        assert response.status_code == 200
        assert data["ready"] is True
        assert "components" in data
```

**Run**:
```bash
cd backend/inspirenet-api/tests
pytest test_cors_startup.py -v
```

### Integration Tests

**Test 1: Cold Start OPTIONS**
```bash
# Trigger cold start by waiting for scale-to-zero (15+ minutes idle)
# Then immediately test OPTIONS

# Wait for idle
sleep 900

# Trigger multiple OPTIONS rapidly
for i in {1..10}; do
  curl -X OPTIONS https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
    -H "Origin: https://perkieprints.com" \
    -H "Access-Control-Request-Method: POST" \
    -w "\nStatus: %{http_code}, Time: %{time_total}s\n" &
done
wait

# Expected: All return 200 OK
```

**Test 2: Readiness During Startup**
```bash
# Immediately after deployment, check readiness
./scripts/deploy-model-fix.sh

# Within 5 seconds of deployment
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/readiness -v

# Expected: 503 until ready, then 200
```

**Test 3: Frontend Integration**
```bash
# Open Shopify staging in Chrome
# Open DevTools → Network tab
# Filter for "warmup"
# Clear network log
# Reload page

# Expected:
# 1. OPTIONS /warmup → 200 OK (< 100ms)
# 2. POST /warmup → 200 OK (cold: 30s, warm: < 1s)
# 3. Console: "✅ API warmed successfully"
```

### Load Test

**Test 4: Concurrent OPTIONS During Startup**
```python
# File: backend/inspirenet-api/tests/test_concurrent_options.py

import asyncio
import httpx
import time

async def send_options():
    async with httpx.AsyncClient() as client:
        start = time.time()
        response = await client.options(
            "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup",
            headers={"Origin": "https://perkieprints.com"},
            timeout=30.0
        )
        duration = time.time() - start
        return response.status_code, duration

async def main():
    # Send 20 concurrent OPTIONS during cold start
    tasks = [send_options() for _ in range(20)]
    results = await asyncio.gather(*tasks)

    successes = sum(1 for code, _ in results if code == 200)
    failures = sum(1 for code, _ in results if code != 200)
    avg_time = sum(dur for _, dur in results) / len(results)

    print(f"Results: {successes} success, {failures} failures")
    print(f"Average time: {avg_time:.3f}s")
    print(f"Success rate: {successes/len(results)*100:.1f}%")

    assert successes >= 19, "Expected at least 95% success rate"
    assert avg_time < 5.0, "Expected OPTIONS to complete in < 5s"

if __name__ == "__main__":
    asyncio.run(main())
```

**Run**:
```bash
# Trigger cold start first (wait 15+ min idle)
python test_concurrent_options.py

# Expected: ≥95% success rate, <5s average latency
```

---

## Validation Criteria

### Success Criteria

**Must Have**:
- ✅ OPTIONS /warmup success rate > 99% (up from 84.6%)
- ✅ Zero OPTIONS 400 errors in 48-hour window
- ✅ OPTIONS latency < 100ms average
- ✅ No FastAPI deprecation warnings
- ✅ Readiness probe correctly gates traffic

**Nice to Have**:
- ✅ Structured logging for OPTIONS requests
- ✅ Monitoring dashboard for CORS health
- ✅ Alert on OPTIONS failure rate > 5%

### Monitoring Queries

**Query 1: OPTIONS Success Rate**
```bash
gcloud logging read \
  'resource.type=cloud_run_revision AND
   resource.labels.service_name=inspirenet-bg-removal-api AND
   textPayload=~"OPTIONS /warmup" AND
   timestamp>=now-24h' \
  --limit=1000 --format=json | \
  jq '[.[] | select(.textPayload | contains("OPTIONS /warmup"))] |
      {total: length,
       failures: [.[] | select(.textPayload | contains("400"))] | length,
       success_rate: (1 - ([.[] | select(.textPayload | contains("400"))] | length / length)) * 100}'
```

**Query 2: Startup Race Conditions**
```bash
gcloud logging read \
  'resource.type=cloud_run_revision AND
   resource.labels.service_name=inspirenet-bg-removal-api AND
   (textPayload=~"OPTIONS.*400" OR textPayload=~"Uvicorn running") AND
   timestamp>=now-24h' \
  --limit=500 --format=json | \
  jq -r '.[] | [.timestamp, .textPayload] | @tsv' | \
  sort
```

**Query 3: Readiness vs Health**
```bash
gcloud logging read \
  'resource.type=cloud_run_revision AND
   resource.labels.service_name=inspirenet-bg-removal-api AND
   (textPayload=~"/readiness" OR textPayload=~"/health") AND
   timestamp>=now-1h' \
  --limit=100 --format=json | \
  jq -r '.[] | [.timestamp, .textPayload] | @tsv'
```

---

## Rollback Plan

### If Phase 1 Fails (OPTIONS Handlers)

**Symptoms**:
- OPTIONS still failing
- New errors introduced
- CORS headers incorrect

**Rollback**:
```bash
# Revert to previous revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=inspirenet-bg-removal-api-00097-7zt=100 \
  --region=us-central1 \
  --project=perkieprints-processing

# Verify
curl -X OPTIONS https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
  -H "Origin: https://perkieprints.com" -v
```

**Time to Rollback**: < 2 minutes

### If Phase 2 Fails (Lifespan Migration)

**Symptoms**:
- Startup hangs
- Container fails health checks
- Application won't accept traffic

**Rollback**:
```bash
# Same as Phase 1 rollback
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=<previous-working-revision>=100 \
  --region=us-central1 \
  --project=perkieprints-processing
```

**Time to Rollback**: < 2 minutes

### If Phase 3 Fails (Readiness Probe)

**Symptoms**:
- Startup probe keeps failing
- Container never becomes ready
- Traffic not routing

**Rollback**:
```bash
# Revert deploy config
git checkout backend/inspirenet-api/deploy-production-clean.yaml

# Redeploy with original config
cd backend/inspirenet-api
./scripts/deploy-model-fix.sh
```

**Time to Rollback**: < 5 minutes

---

## Risk Assessment

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OPTIONS handlers break existing CORS | LOW | HIGH | Match CORSMiddleware config exactly, test extensively |
| Lifespan migration causes startup hang | LOW | HIGH | Add timeout, test locally first |
| Readiness probe too strict | MEDIUM | MEDIUM | Use same checks as /health initially |
| Increased latency for OPTIONS | LOW | LOW | Handlers are lightweight, < 1ms overhead |
| Breaking change to frontend | NONE | HIGH | No frontend changes required |

### Mitigation Strategies

**For Each Phase**:
1. Deploy to staging first (if available)
2. Test extensively before production
3. Monitor logs for 1 hour after deployment
4. Keep previous revision ready for instant rollback
5. Deploy during low-traffic hours

**Specific Mitigations**:

**OPTIONS Handlers**:
- Copy CORS config EXACTLY from CORSMiddleware
- Test with all allowed origins
- Test with disallowed origins (should still work, just no CORS headers)
- Test during cold start specifically

**Lifespan Migration**:
- Test locally with `uvicorn src.main:app --reload`
- Add startup timeout (2 minutes max)
- Log each initialization step
- Verify shutdown cleanup doesn't block

**Readiness Probe**:
- Start with lenient checks (processor exists, storage exists)
- Don't check model loading (too slow)
- Don't check memory until proven stable
- Use same timeout as health probe initially

---

## Additional Improvements (Future)

### Low Priority Optimizations

**1. Frontend Warmup Frequency**
- **Issue**: /warmup is 43% of all traffic
- **Analysis**: Check if cross-tab coordination working
- **Fix**: Reduce warmup frequency, increase cache duration
- **Effort**: 1 hour

**2. OPTIONS Response Caching**
- **Issue**: Each OPTIONS requires server round-trip
- **Fix**: Increase `max-age` from 3600s to 7200s
- **Impact**: Reduce OPTIONS traffic by ~50%
- **Effort**: 5 minutes

**3. Instance Warmth Persistence**
- **Issue**: Frequent scale-to-zero causes repeated cold starts
- **Options**:
  - Option A: Keep 1 instance warm (cost: $65-100/day) ❌
  - Option B: Increase idle timeout (Cloud Run setting)
  - Option C: Scheduled warmup (current approach, keep)
- **Recommendation**: Keep current approach, accept occasional cold starts

**4. Monitoring Dashboard**
- **Metrics to Track**:
  - OPTIONS success rate by endpoint
  - Cold start frequency
  - Warmup effectiveness (cold starts avoided)
  - Average response time by endpoint
- **Tool**: Cloud Monitoring or Grafana
- **Effort**: 2-3 hours

---

## Documentation Updates Required

### Files to Update

1. **README.md**
   - Add section on OPTIONS handling
   - Document readiness vs health probes
   - Update startup sequence diagram

2. **CLAUDE.md**
   - Update "Known Issues" section (remove this issue once fixed)
   - Add "OPTIONS Startup Fix" to implementation status
   - Document new `/readiness` endpoint

3. **.claude/tasks/context_session_active.md**
   - Add entry for this fix
   - Date, files changed, testing results
   - Link to this implementation plan

4. **Backend API Documentation**
   - Document `/readiness` endpoint
   - Document explicit OPTIONS handlers
   - Update CORS configuration notes

---

## Questions for Review

Before implementation, confirm:

1. ✅ **Approval for explicit OPTIONS handlers?**
   - Adds ~150 lines of code
   - Duplicates some CORS logic from middleware
   - Standard pattern for this issue

2. ✅ **Approval for lifespan migration?**
   - Replaces deprecated pattern
   - Modest refactor (~50 lines changed)
   - Future-proof

3. ✅ **Approval for readiness probe?**
   - Changes Cloud Run startup behavior
   - May increase startup time by 1-2 seconds
   - Standard Kubernetes/Cloud Run pattern

4. ⚠️ **Should we fix frontend warmup frequency?**
   - Currently 43% of traffic
   - Seems high but functional
   - Can defer to later

5. ⚠️ **Acceptable cold start behavior?**
   - Current: 30-60s first request after idle
   - After fix: Same, but warmup will work reliably
   - Alternative: Keep min-instances=1 (cost: $65-100/day)

---

## Success Metrics (Post-Implementation)

**Immediate (24 hours)**:
- OPTIONS 400 errors: 8 → 0
- OPTIONS success rate: 84.6% → 99%+
- Average OPTIONS latency: Unknown → < 100ms
- Startup race conditions: 6 → 0

**Medium Term (1 week)**:
- No OPTIONS failures observed
- No startup-related errors
- Cold start warmup success rate: ~85% → ~99%
- User-reported loading delays: Monitor for decrease

**Long Term (1 month)**:
- Sustained 99%+ OPTIONS success
- No regression in startup times
- Mobile conversion rate: Monitor for improvement
- API costs: Unchanged (no min-instances increase)

---

## Conclusion

This is a **textbook startup race condition** with a **well-established solution pattern**. The fix is:

1. **Low Risk**: Additive changes, no breaking modifications
2. **High Impact**: Fixes 15.4% failure rate, critical for 70% of customers
3. **Well-Tested**: Standard FastAPI and Cloud Run patterns
4. **Future-Proof**: Migrates to modern FastAPI lifespan pattern

**Recommendation**: Implement Phase 1 immediately (OPTIONS handlers), then Phase 2 (lifespan + readiness) within 1 week.

**Estimated Total Effort**:
- Implementation: 2-3 hours
- Testing: 1 hour
- Monitoring: 1 hour
- **Total**: 4-5 hours

**Expected Outcome**: OPTIONS 400 errors eliminated, pre-warming strategy fully functional, mobile user experience improved.

---

## Appendix: Related Issues

### Previous Warmup Fixes

1. **2025-10-02: 16x16 → 32x32 Image Fix**
   - Issue: Dynamic resize made 16x16 → 0x0
   - Fix: Changed warmup image to 32x32
   - Status: ✅ Fixed
   - Related: Different issue (dimension validation, not CORS)

2. **2025-10-05: CORS Hardening**
   - Issue: CORS configuration security
   - Fix: Explicit origins, regex for Shopify
   - Status: ✅ Complete
   - Related: This fix builds on that work

### Current Issue Comparison

| Issue | Previous | Current |
|-------|----------|---------|
| Symptom | 400 errors | 400 errors |
| Endpoint | /warmup POST | /warmup OPTIONS |
| Cause | Image dimension validation | Startup race condition |
| Fix | Change image size | Add OPTIONS handlers |
| Fixed | 2025-10-02 | Pending |

---

**Document Version**: 1.0
**Last Updated**: 2025-01-05
**Next Review**: After Phase 1 implementation
**Owner**: debug-specialist (analysis), infrastructure-reliability-engineer (implementation)
