# API Critical Errors Root Cause Analysis & Fix Implementation Plan

**Date**: 2025-09-19
**Issue**: Production-impacting API errors preventing customer image processing
**Priority**: P0 - Critical production outage

## Executive Summary

The InSPyReNet API is experiencing complete service failure with 500 Internal Server Error on all endpoints, including health checks. This is NOT a CORS configuration issue - the API container itself is failing to start or respond properly.

## Root Cause Analysis

### Primary Issue: API Container Failure
**Verdict**: The API service is completely down - returning 500 errors on ALL endpoints including `/health`

**Evidence**:
- `curl /health` returns 500 Internal Server Error (should never fail)
- `curl /warmup` returns 500 Internal Server Error
- `curl /api/v2/process-with-effects` returns 500 Internal Server Error
- All endpoints return generic Google Frontend 500 error page

### Why CORS Appears Broken
The CORS errors are **secondary symptoms** of the primary container failure:
1. Browser makes preflight OPTIONS request
2. Container returns 500 error instead of proper CORS headers
3. Browser blocks request due to failed preflight
4. Frontend sees "CORS blocked" but real issue is API failure

### Container Analysis
**Current State**:
- Cloud Run service status: "Ready" (misleading)
- Active revision: `inspirenet-bg-removal-api-00080-lqj`
- Image: `us-central1-docker.pkg.dev/perkieprints-processing/pet-bg-removal/inspirenet-bg-removal-api:critical-fix`
- Configuration: 32GB RAM, NVIDIA L4 GPU, min-instances=0

**Likely Root Causes**:
1. **Model Loading Failure**: PyTorch/InSPyReNet model failing to load on startup
2. **CUDA/GPU Issues**: GPU allocation or CUDA driver problems
3. **Memory Issues**: OOM during model initialization (4GB+ model)
4. **Container Corruption**: Bad image build or deployment corruption
5. **Environment Variable Issues**: Missing or incorrect configuration

## Container Startup Sequence Investigation

### Expected Startup Flow
1. Container starts → FastAPI app initializes
2. Health check endpoint becomes available (should return 200)
3. Model loads lazily on first request (not during startup)
4. Processing endpoints become available

### Current Failure Point
The container is failing at step 1-2 - even basic FastAPI health check returns 500.

## Technical Details

### CORS Configuration Analysis
The CORS setup in `main.py` is **correctly configured**:
- `allow_origins=["*"]` - Allows all origins
- `allow_methods` includes OPTIONS
- Custom CORS middleware for OPTIONS handling
- Explicit OPTIONS endpoints for all processing routes

**CORS is NOT the root cause** - container failure prevents CORS headers from being sent.

### Deployment Configuration
- Using Cloud Run gen2 with GPU support
- Min instances: 0 (cost optimization)
- Startup probe: 60s initial delay, 30s timeout
- Health check: 30s interval, 10s timeout
- Request timeout: 600s

## Immediate Fix Strategy

### Phase 1: Emergency Diagnostics (15 minutes)
1. **Check container logs** for startup errors
2. **Verify image integrity** and recent deployment
3. **Test basic container startup** without GPU
4. **Identify exact failure point** in startup sequence

### Phase 2: Container Recovery (30 minutes)
1. **Redeploy with known good image** if corruption suspected
2. **Rollback to previous working revision** if recent deployment caused issue
3. **Adjust resource limits** if memory/GPU allocation issue
4. **Enable debug logging** for detailed error tracking

### Phase 3: Model Loading Fix (60 minutes)
1. **Implement graceful model loading** with better error handling
2. **Add model loading retries** with exponential backoff
3. **Separate model loading** from container startup
4. **Enhance health check** to distinguish container vs model readiness

## Implementation Commands

### 1. Emergency Diagnostics
```bash
# Check current container logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="inspirenet-bg-removal-api"' --limit=50 --project=perkieprints-processing

# Check container startup logs specifically
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="inspirenet-bg-removal-api" AND textPayload:"Starting production"' --limit=10 --project=perkieprints-processing

# Verify image tags
gcloud container images list-tags us-central1-docker.pkg.dev/perkieprints-processing/pet-bg-removal/inspirenet-bg-removal-api --limit=5 --project=perkieprints-processing
```

### 2. Emergency Recovery Options

#### Option A: Rollback to Previous Working Revision
```bash
# Rollback to previous known good revision
gcloud run services update-traffic inspirenet-bg-removal-api \
    --to-revisions=inspirenet-bg-removal-api-00084-yiq=100 \
    --region=us-central1 \
    --project=perkieprints-processing
```

#### Option B: Force Redeploy with Debug Mode
```bash
# Redeploy with enhanced debug logging
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
    --set-env-vars "LOG_LEVEL=debug,ENABLE_STARTUP_LOGGING=true,SKIP_MODEL_PRELOAD=true" \
    --tag emergency-debug
```

### 3. Health Check Verification
```bash
# Test after recovery
curl -v https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Test CORS specifically
curl -X OPTIONS https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects \
    -H "Origin: https://perkieprints.com" \
    -H "Access-Control-Request-Method: POST" \
    -v
```

## Prevention Strategy

### 1. Enhanced Monitoring
- Add startup success/failure metrics
- Container health vs model readiness distinction
- Memory usage monitoring during startup
- GPU allocation verification

### 2. Graceful Degradation
- Separate container health from model readiness
- Return 503 "Service Unavailable" instead of 500 during model loading
- Implement model loading retry logic
- Add circuit breaker for repeated failures

### 3. Deployment Safety
- Blue/green deployment with health verification
- Automatic rollback on health check failures
- Pre-deployment image validation
- Canary deployment for model updates

## Files to Modify After Recovery

### 1. Enhanced Health Check (`main.py`)
```python
@app.get("/health")
async def health_check():
    # Always return 200 for container health
    # Separate model readiness status
    container_healthy = True  # Container is running
    model_ready = processor.is_model_ready() if processor else False

    return {
        "status": "healthy" if container_healthy else "unhealthy",
        "container_ready": container_healthy,
        "model_ready": model_ready,
        "model_status": "ready" if model_ready else "loading"
    }
```

### 2. Graceful Model Loading
```python
@app.middleware("http")
async def model_readiness_check(request, call_next):
    # Skip for health/status endpoints
    if request.url.path in ["/health", "/", "/warmup"]:
        return await call_next(request)

    # Return 503 if model not ready (instead of 500)
    if not processor or not processor.is_model_ready():
        return JSONResponse(
            status_code=503,
            content={
                "error": "Model is loading, please try again",
                "retry_after": 30,
                "status": "loading"
            }
        )

    return await call_next(request)
```

## Success Criteria

### Immediate (Recovery)
- [ ] API health endpoint returns 200 OK
- [ ] CORS preflight requests succeed (200 OK with proper headers)
- [ ] Container startup logs show successful initialization

### Short-term (Stability)
- [ ] Model loading succeeds within 60 seconds
- [ ] Processing endpoints return 503 (not 500) during model loading
- [ ] All CORS-required headers present in responses

### Long-term (Prevention)
- [ ] Monitoring alerts for container failures
- [ ] Automatic rollback on deployment failures
- [ ] Graceful degradation during model loading
- [ ] Clear separation of container vs model health

## Timeline

- **T+0**: Begin diagnostics and log analysis
- **T+15min**: Identify root cause and recovery strategy
- **T+30min**: Execute recovery (rollback or redeploy)
- **T+45min**: Verify API functionality and CORS resolution
- **T+60min**: Implement preventive measures
- **T+120min**: Full monitoring and alerting setup

## Risk Assessment

**Current Risk**: HIGH - Complete API outage affecting all customers
**Recovery Risk**: LOW - Multiple recovery options available
**Prevention Risk**: MEDIUM - Requires careful monitoring implementation

## Next Steps

1. **IMMEDIATE**: Execute diagnostic commands to identify root cause
2. **URGENT**: Implement chosen recovery strategy (rollback recommended)
3. **SHORT-TERM**: Enhance health checks and error handling
4. **LONG-TERM**: Implement comprehensive monitoring and prevention

---

**Note**: This is a container failure, not a CORS issue. The CORS errors are symptoms of the underlying API failure. Focus on container recovery first, then address the root cause of the startup failure.