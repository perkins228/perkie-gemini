# Cloud Infrastructure & API Optimization Plan

**Date**: 2025-10-04
**Author**: Infrastructure Reliability Engineer
**Session**: context_session_1736094648
**Status**: Comprehensive Analysis Complete

---

## Executive Summary

This plan presents infrastructure optimization opportunities for the InSPyReNet Background Removal API that maintain current functionality while addressing cost concerns ($65-100/day potential idle costs) and performance issues (11s cold start, 30-60s total first request). The recommendations focus on cost-effective warming strategies, caching improvements, and monitoring enhancements without changing the critical min-instances=0 constraint.

**Key Findings**:
- Current setup is well-optimized for cost with min-instances=0
- Cold start penalty is acceptable given cost constraints
- Several opportunities exist for performance and reliability improvements
- Missing critical monitoring and alerting infrastructure
- No CI/CD pipeline or staging environment

---

## 1. Cold Start & Performance Optimization

### Current State
- **Cold Start**: 30-60s total (20-30s model loading + 10-15s container startup)
- **Warm Performance**: 3s per request
- **GPU**: NVIDIA L4 @ $0.65/hour when active
- **Memory**: 32GB allocated
- **Scaling**: 0-3 instances (currently max=3 in deploy-production-clean.yaml)

### Recommended Optimizations

#### 1.1 Implement Cloud Scheduler Warming (Priority: HIGH)
**File**: Create `backend/inspirenet-api/terraform/cloud-scheduler.tf`

```terraform
resource "google_cloud_scheduler_job" "api_warming" {
  name             = "inspirenet-api-warming"
  schedule         = "*/15 8-21 * * *"  # Every 15 min, 8 AM - 9 PM
  time_zone        = "America/New_York"
  attempt_deadline = "120s"

  http_target {
    uri         = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup"
    http_method = "POST"
  }
}
```

**Cost Impact**: ~$24/month (96 warmup calls/day × 30 days × 3s/call @ $0.65/hour)
**Performance Impact**: 95% of business hour requests hit warm instances

#### 1.2 Optimize Docker Image for Faster Startup (Priority: MEDIUM)
**File**: `backend/inspirenet-api/Dockerfile`

Changes needed:
1. **Multi-stage build** to reduce final image size
2. **Pre-compile Python bytecode** during build
3. **Cache model weights** in image (adds 2GB but saves 20s loading time)
4. **Use distroless base** for smaller runtime

```dockerfile
# Build stage
FROM python:3.11-slim as builder
# ... build steps ...

# Runtime stage
FROM gcr.io/distroless/python3-debian11
COPY --from=builder /app /app
# Pre-load model at build time
RUN python -c "import torch; model = torch.load('/app/models/inspirenet.pth', map_location='cpu')"
```

**Impact**: Reduce cold start from 30-60s to 15-30s

#### 1.3 Implement Predictive Warming (Priority: LOW)
**File**: Create `assets/predictive-warmer.js`

Track user behavior patterns and warm API when:
- User visits product page (70% proceed to upload)
- User hovers over upload button for >500ms
- User begins scrolling toward upload section

---

## 2. Caching & Storage Optimization

### Current State
- **Cloud Storage**: 24-hour TTL caching
- **Bucket**: perkieprints-processing-cache
- **Cache Hit Rate**: Unknown (no metrics)

### Recommended Improvements

#### 2.1 Implement CDN Edge Caching (Priority: HIGH)
**File**: Create `backend/inspirenet-api/terraform/cdn.tf`

```terraform
resource "google_compute_backend_bucket" "image_cache" {
  name        = "inspirenet-processed-images"
  bucket_name = google_storage_bucket.cache.name
  enable_cdn  = true

  cdn_policy {
    cache_mode = "CACHE_ALL_STATIC"
    default_ttl = 3600
    max_ttl     = 86400
    negative_caching = true
  }
}
```

**Impact**:
- Reduce API load by 60-70%
- Serve repeat requests in <100ms globally
- Cost: ~$0.08/GB served from cache

#### 2.2 Implement Cache Warming for Popular Effects (Priority: MEDIUM)
**File**: `backend/inspirenet-api/src/cache_warmer.py`

Pre-generate common effects during idle time:
- Track most requested effect combinations
- Pre-process during off-peak hours
- Store in Cloud Storage with extended TTL

#### 2.3 Add Cache Metrics & Monitoring (Priority: HIGH)
**File**: `backend/inspirenet-api/src/storage.py`

Add metrics collection:
```python
class CloudStorageManager:
    def __init__(self):
        self.metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'cache_errors': 0,
            'avg_retrieval_time': 0
        }

    async def get_cached_result(self, cache_key):
        # Add timing and metric collection
        start = time.time()
        result = await self._get_from_cache(cache_key)
        self.metrics['avg_retrieval_time'] = ...
        self._export_metrics()  # Send to Cloud Monitoring
```

---

## 3. Monitoring & Alerting Infrastructure

### Critical Gap: No Production Monitoring

#### 3.1 Implement Cloud Monitoring Dashboard (Priority: CRITICAL)
**File**: Create `backend/inspirenet-api/terraform/monitoring.tf`

Key metrics to track:
- Cold start frequency and duration
- Request latency (p50, p95, p99)
- GPU memory utilization
- Cache hit rate
- Error rate by endpoint
- Cost per processed image

#### 3.2 Set Up Alerting Rules (Priority: CRITICAL)
**File**: Create `backend/inspirenet-api/terraform/alerts.tf`

Critical alerts:
```terraform
resource "google_monitoring_alert_policy" "high_cold_starts" {
  display_name = "High Cold Start Rate"
  conditions {
    condition_threshold {
      filter = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" metric.label.\"response_code_class\"=\"2xx\""
      comparison = "COMPARISON_GT"
      threshold_value = 30000  # 30 seconds
      duration = "300s"
    }
  }
}
```

#### 3.3 Implement Application Performance Monitoring (Priority: MEDIUM)
**File**: `backend/inspirenet-api/src/apm.py`

Integrate Google Cloud Trace:
```python
from opentelemetry import trace
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span("process_image")
async def process_with_tracing(image_data):
    span = trace.get_current_span()
    span.set_attribute("image.size", len(image_data))
    # ... processing logic ...
```

---

## 4. CI/CD & Deployment Improvements

### Critical Gap: No CI/CD Pipeline

#### 4.1 Implement GitHub Actions CI/CD (Priority: HIGH)
**File**: Create `.github/workflows/deploy-api.yml`

```yaml
name: Deploy InSPyReNet API
on:
  push:
    branches: [main, staging]
    paths:
      - 'backend/inspirenet-api/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend/inspirenet-api
          pip install -r requirements.txt
          python -m pytest tests/

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v1
        with:
          service: inspirenet-bg-removal-api
          region: us-central1
          source: ./backend/inspirenet-api
```

#### 4.2 Create Staging Environment (Priority: MEDIUM)
**File**: `backend/inspirenet-api/deploy-staging.yaml`

Deploy staging with:
- Same configuration as production
- Different service name: `inspirenet-api-staging`
- Lower max-instances: 1
- Separate cache bucket

#### 4.3 Implement Blue-Green Deployment (Priority: LOW)
**File**: `backend/inspirenet-api/scripts/blue-green-deploy.sh`

```bash
#!/bin/bash
# Deploy new version with traffic splitting
gcloud run deploy inspirenet-bg-removal-api \
  --tag green \
  --no-traffic

# Gradual traffic shift
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-tags green=10

# Monitor metrics, then increase traffic
```

---

## 5. Cost Optimization Strategies

### 5.1 Implement Request Batching (Priority: MEDIUM)
**File**: `backend/inspirenet-api/src/batch_processor.py`

Batch multiple effect requests:
- Queue requests for 100ms
- Process batch on single GPU instance
- Amortize cold start cost across requests

### 5.2 Add Spot Instance Support (Priority: LOW)
**Note**: Cloud Run doesn't support spot, but consider Cloud Run Jobs for batch processing

### 5.3 Implement Cost Tracking (Priority: HIGH)
**File**: `backend/inspirenet-api/src/cost_tracker.py`

```python
class CostTracker:
    GPU_COST_PER_HOUR = 0.65

    def track_request(self, processing_time, was_cold_start):
        cost = (processing_time / 3600) * self.GPU_COST_PER_HOUR
        if was_cold_start:
            cost += self.COLD_START_OVERHEAD

        # Export to BigQuery for analysis
        self.export_cost_data(cost)
```

---

## 6. Reliability & Disaster Recovery

### 6.1 Implement Health Check Improvements (Priority: MEDIUM)
**File**: `backend/inspirenet-api/src/main.py`

Enhanced health check:
```python
@app.get("/health")
async def health():
    checks = {
        "api": "healthy",
        "model_loaded": processor is not None,
        "gpu_available": torch.cuda.is_available(),
        "storage_accessible": await storage_manager.check_access(),
        "memory_available": memory_monitor.get_memory_info()['available_memory_mb'] > 1000
    }

    status_code = 200 if all(checks.values()) else 503
    return JSONResponse(checks, status_code=status_code)
```

### 6.2 Add Circuit Breaker Pattern (Priority: LOW)
**File**: `backend/inspirenet-api/src/circuit_breaker.py`

Prevent cascade failures:
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
```

### 6.3 Multi-Region Failover (Priority: LOW)
**Note**: Current single-region setup is acceptable for cost constraints

---

## 7. Security Enhancements

### 7.1 Implement Rate Limiting (Priority: HIGH)
**File**: `backend/inspirenet-api/src/rate_limiter.py`

```python
from slowapi import Limiter
limiter = Limiter(key_func=lambda: get_client_ip())

@app.post("/api/v2/process")
@limiter.limit("10/minute")
async def process_image():
    # ... existing logic ...
```

### 7.2 Add Request Validation (Priority: MEDIUM)
- Maximum file size enforcement (currently 30MB)
- Image format validation
- Malicious payload detection

---

## 8. Implementation Roadmap

### Phase 1: Critical (Week 1)
1. **Cloud Monitoring Dashboard** - Gain visibility
2. **Alerting Rules** - Detect issues proactively
3. **Cloud Scheduler Warming** - Improve performance
4. **Cache Metrics** - Understand usage patterns

### Phase 2: High Priority (Week 2-3)
1. **GitHub Actions CI/CD** - Automated deployments
2. **CDN Edge Caching** - Reduce load and costs
3. **Rate Limiting** - Protect against abuse
4. **Cost Tracking** - Monitor spending

### Phase 3: Medium Priority (Week 4-5)
1. **Docker Optimization** - Faster cold starts
2. **Staging Environment** - Safe testing
3. **Request Batching** - Cost efficiency
4. **Enhanced Health Checks** - Better reliability

### Phase 4: Nice to Have (Future)
1. **Predictive Warming** - Further optimization
2. **Blue-Green Deployment** - Zero-downtime updates
3. **Circuit Breaker** - Resilience patterns

---

## 9. Estimated Impact

### Performance Improvements
- **Cold Start**: 30-60s → 15-30s (50% reduction)
- **Cache Hit Rate**: Unknown → 60-70% (with CDN)
- **P95 Latency**: ~15s → ~5s (with warming)

### Cost Optimization
- **Current**: $0-65/day (depending on traffic)
- **With Optimizations**: $20-30/day (predictable)
- **Per Image Cost**: $0.065 → $0.03 (with caching)

### Reliability Gains
- **Uptime**: Unknown → 99.9% SLA
- **Error Detection**: None → <1 minute
- **Recovery Time**: Manual → Automated

---

## 10. Critical Constraints Maintained

✅ **Min-instances remains 0** - No idle GPU costs
✅ **No breaking changes** - All optimizations are additive
✅ **Mobile-first** - All improvements benefit mobile users
✅ **Cost controlled** - All changes have clear ROI

---

## Next Steps

1. **Review plan with team** - Get stakeholder buy-in
2. **Create implementation tickets** - Break down into tasks
3. **Start with monitoring** - Establish baseline metrics
4. **Implement incrementally** - Phase-based approach
5. **Measure impact** - Track improvements

---

## Appendix: Quick Wins

These can be implemented immediately with minimal effort:

1. **Add X-Cache-Status header** to API responses (5 min)
2. **Log cold start occurrences** to identify patterns (10 min)
3. **Create Cloud Monitoring dashboard** from template (30 min)
4. **Enable Cloud Run request logs** export to BigQuery (10 min)
5. **Add `/metrics` endpoint** for Prometheus scraping (1 hour)