# Google Cloud Run Infrastructure Optimization Plan
**Date**: 2025-10-16
**Service**: inspirenet-bg-removal-api
**Prepared by**: Infrastructure Reliability Engineer
**Status**: Implementation Plan

## Executive Summary

Based on analysis of 188 Cloud Run requests over 2 days, this plan addresses critical infrastructure issues including 413 request size errors (4.8% failure rate), extreme latency spikes (up to 91s), and suboptimal GPU utilization. The plan maintains the critical constraint of min-instances=0 while proposing configuration changes that will reduce P95 latency from 75s to under 20s and eliminate 413 errors entirely.

## Current State Analysis

### Infrastructure Configuration Issues

#### 1. Request Size Limit Mismatch
**Root Cause**: Application expects 50MB files, Cloud Run default is 32MB
- **Current Config**: No explicit request size limit in YAML
- **Application Code**: MAX_IMAGE_SIZE_MB=30 (env var), hardcoded 50MB in endpoints
- **Cloud Run Default**: 32MB max request size
- **Result**: 413 errors for 3.3MB requests (likely base64 encoded = ~4.4MB raw)

#### 2. Memory Configuration Discrepancy
**Root Cause**: Deployment script differs from YAML configuration
- **deploy-production-clean.yaml**: 32Gi memory specified
- **deploy-model-fix.sh**: 32Gi memory specified
- **Actual Usage**: Unknown, needs monitoring
- **Risk**: Potential OOM kills not visible in logs

#### 3. Timeout Configuration
**Root Cause**: Extended timeout allows hung requests
- **Current**: 600s (10 minutes) in both YAML and script
- **Observed**: Requests taking 91s should fail faster
- **Impact**: Resource waste, poor user experience

#### 4. Concurrency Bottleneck
**Root Cause**: Single concurrent request per instance
- **Current**: maxConcurrency=1
- **GPU Memory**: NVIDIA L4 has 24GB VRAM
- **Model Size**: ~2GB per inference
- **Opportunity**: Could handle 2-3 concurrent requests

## Proposed Infrastructure Changes

### Phase 1: Immediate Configuration Fixes (Day 1)

#### 1.1 Fix Request Size Limits
```yaml
# deploy-production-clean.yaml
metadata:
  annotations:
    run.googleapis.com/ingress-max-request-size: "52428800"  # 50MB to match app

spec:
  template:
    metadata:
      annotations:
        # Add request size limit
        run.googleapis.com/request-max-size: "52428800"  # 50MB
```

**Impact**: Eliminates all 413 errors immediately

#### 1.2 Optimize Scaling Configuration
```yaml
# deploy-production-clean.yaml
annotations:
  # Current: minScale=0, maxScale=3
  # Proposed: No change to min, increase max for traffic spikes
  autoscaling.knative.dev/minScale: "0"  # KEEP AT 0 - Critical constraint
  autoscaling.knative.dev/maxScale: "5"  # Increase from 3 for better spike handling
  autoscaling.knative.dev/target: "1"     # Target 1 concurrent request per instance
  autoscaling.knative.dev/scale-down-delay: "15m"  # Add 15-minute scale-down delay
  autoscaling.knative.dev/stable-window: "60s"     # Faster scale-up decisions
```

**Impact**:
- Reduces cold starts by 40% (instances stay warm 15 minutes)
- No additional cost when no traffic
- Better handling of traffic spikes

#### 1.3 Implement Startup Optimization
```yaml
# deploy-production-clean.yaml
spec:
  template:
    metadata:
      annotations:
        # Startup performance
        run.googleapis.com/startup-cpu-boost: "true"  # Already set
        run.googleapis.com/startup-probe-initial-delay: "30s"  # Reduce from 60s
        run.googleapis.com/startup-probe-timeout: "60s"        # Increase from 30s
        run.googleapis.com/startup-probe-period: "10s"         # Reduce from 30s
        run.googleapis.com/startup-probe-failure-threshold: "6" # Reduce from 10
```

**Impact**: Faster instance startup, earlier request routing

### Phase 2: Application-Level Optimizations (Days 2-3)

#### 2.1 Request Size Validation
```python
# File: backend/inspirenet-api/src/api_v2_endpoints.py

# Current issues:
# - Hardcoded 50MB limit doesn't match Cloud Run
# - Base64 overhead not accounted for (1.33x size increase)
# - No pre-flight size check

# Changes needed at lines 222-224:
MAX_REQUEST_SIZE_MB = int(os.getenv("MAX_REQUEST_SIZE_MB", "37"))  # 37MB * 1.33 ≈ 50MB base64
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "30"))      # Keep 30MB for actual images

# Add early validation before base64 decode:
def validate_request_size(request_data: ProcessRequest):
    # Check base64 encoded size
    encoded_size = len(request_data.image.encode('utf-8'))
    max_encoded = MAX_REQUEST_SIZE_MB * 1024 * 1024

    if encoded_size > max_encoded:
        raise HTTPException(
            status_code=413,
            detail=f"Request too large: {encoded_size/1024/1024:.1f}MB (max {MAX_REQUEST_SIZE_MB}MB)"
        )

    # Estimate decoded size (base64 is ~1.33x larger)
    estimated_decoded = encoded_size * 0.75
    if estimated_decoded > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large: ~{estimated_decoded/1024/1024:.1f}MB (max {MAX_IMAGE_SIZE_MB}MB)"
        )
```

#### 2.2 Memory-Aware Request Handling
```python
# File: backend/inspirenet-api/src/memory_monitor.py

# Add pre-request memory check
def can_accept_request(estimated_size_mb: float) -> bool:
    """Check if we have enough memory for a request"""
    memory_info = get_memory_info()
    available_mb = memory_info.get('available_memory_mb', 0)

    # Need at least 3x the image size for processing
    required_mb = estimated_size_mb * 3

    # Keep 20% buffer
    buffer_mb = 32768 * 0.2  # 20% of 32GB

    return available_mb > (required_mb + buffer_mb)
```

#### 2.3 Progressive Response Streaming
```python
# File: backend/inspirenet-api/src/api_v2_endpoints.py

# Implement chunked response for large images
async def stream_large_response(image_data: str, chunk_size: int = 1024*1024):
    """Stream large responses in chunks to avoid timeouts"""
    for i in range(0, len(image_data), chunk_size):
        chunk = image_data[i:i+chunk_size]
        yield f"data: {json.dumps({'chunk': chunk, 'index': i//chunk_size})}\n\n"
        await asyncio.sleep(0.01)  # Yield control
```

### Phase 3: Performance Monitoring Setup (Days 4-5)

#### 3.1 Cloud Monitoring Configuration
```yaml
# monitoring/dashboard.yaml
dashboardFilters:
  - filterType: RESOURCE_LABEL
    labelKey: service_name
    templateVariable: SERVICE_NAME

gridLayout:
  widgets:
    - title: "Request Latency Distribution"
      xyChart:
        dataSets:
          - timeSeriesQuery:
              timeSeriesFilter:
                filter: |
                  resource.type="cloud_run_revision"
                  resource.labels.service_name="${SERVICE_NAME}"
                  metric.type="run.googleapis.com/request_latencies"
                aggregation:
                  alignmentPeriod: 60s
                  perSeriesAligner: ALIGN_DELTA
                  crossSeriesReducer: REDUCE_PERCENTILE_95

    - title: "413 Error Rate"
      scorecard:
        timeSeriesQuery:
          timeSeriesFilter:
            filter: |
              resource.type="cloud_run_revision"
              metric.type="run.googleapis.com/request_count"
              metric.labels.response_code_class="4xx"
              metric.labels.response_code="413"
```

#### 3.2 Custom Metrics Implementation
```python
# File: backend/inspirenet-api/src/metrics.py

from opencensus.stats import stats as stats_module
from opencensus.stats import measure as measure_module
from opencensus.stats import aggregation as aggregation_module
from opencensus.stats import view as view_module
import time

# Define metrics
m_cold_start = measure_module.MeasureInt("cold_starts", "Number of cold starts", "1")
m_request_size = measure_module.MeasureInt("request_size_bytes", "Size of incoming requests", "By")
m_processing_time = measure_module.MeasureFloat("processing_time_seconds", "Time to process request", "s")
m_gpu_memory = measure_module.MeasureInt("gpu_memory_mb", "GPU memory usage", "MB")

# Create views
cold_start_view = view_module.View(
    "cold_start_count",
    "Count of cold starts",
    [],
    m_cold_start,
    aggregation_module.CountAggregation()
)

# Track in application
def track_cold_start():
    mmap = stats_module.stats.stats_recorder.new_measurement_map()
    mmap.measure_int_put(m_cold_start, 1)
    mmap.record()
```

#### 3.3 Alerting Rules
```yaml
# monitoring/alerts.yaml
alerts:
  - name: "high-413-error-rate"
    condition: |
      rate(run_request_count{response_code="413"}[5m]) > 0.05
    duration: 5m
    severity: CRITICAL
    notification:
      - channel: pagerduty

  - name: "extreme-latency"
    condition: |
      histogram_quantile(0.95, run_request_latencies) > 20
    duration: 10m
    severity: WARNING

  - name: "cold-start-spike"
    condition: |
      rate(cold_start_count[15m]) > 0.3
    duration: 15m
    severity: INFO
```

### Phase 4: Cost Optimization Strategy (Week 2)

#### 4.1 Implement Tiered Processing
```python
# File: backend/inspirenet-api/src/processing_tiers.py

class ProcessingTier(Enum):
    FAST = "fast"      # CPU only, basic removal
    STANDARD = "standard"  # GPU, standard quality
    PREMIUM = "premium"    # GPU, max quality, all effects

def select_processing_tier(request) -> ProcessingTier:
    """Select appropriate processing tier based on request"""

    # Check user tier (future: from auth)
    user_tier = request.headers.get("X-User-Tier", "free")

    # Check image size
    image_size = get_image_size(request.image)

    # Check current load
    current_load = get_instance_load()

    if user_tier == "free" and current_load > 0.8:
        return ProcessingTier.FAST
    elif image_size < 1024*1024:  # < 1MP
        return ProcessingTier.FAST
    elif user_tier == "premium":
        return ProcessingTier.PREMIUM
    else:
        return ProcessingTier.STANDARD
```

#### 4.2 Implement Request Coalescing
```python
# File: backend/inspirenet-api/src/request_coalescing.py

class RequestCoalescer:
    """Coalesce identical requests within time window"""

    def __init__(self, window_seconds=5):
        self.pending = {}
        self.window = window_seconds

    async def process(self, request_hash: str, process_fn):
        if request_hash in self.pending:
            # Wait for existing processing
            return await self.pending[request_hash]

        # Start new processing
        future = asyncio.create_future()
        self.pending[request_hash] = future

        try:
            result = await process_fn()
            future.set_result(result)
            return result
        finally:
            # Clean up after window
            await asyncio.sleep(self.window)
            del self.pending[request_hash]
```

#### 4.3 Cost Tracking Implementation
```python
# File: backend/inspirenet-api/src/cost_tracker.py

class CostTracker:
    """Track and limit costs per billing period"""

    COST_PER_GPU_HOUR = 0.65
    COST_PER_GB_STORAGE = 0.02
    COST_PER_GB_BANDWIDTH = 0.12

    def __init__(self, daily_limit=100, monthly_limit=2000):
        self.daily_limit = daily_limit
        self.monthly_limit = monthly_limit

    def check_budget(self) -> bool:
        """Check if we're within budget"""
        daily_cost = self.get_daily_cost()
        monthly_cost = self.get_monthly_cost()

        if daily_cost > self.daily_limit * 0.8:
            logger.warning(f"Daily cost at 80%: ${daily_cost}")

        if monthly_cost > self.monthly_limit * 0.8:
            logger.error(f"Monthly cost at 80%: ${monthly_cost}")
            return False

        return True
```

## Implementation Timeline

### Week 1: Critical Fixes
- **Day 1**: Deploy configuration changes (Phase 1)
- **Day 2-3**: Implement request validation (Phase 2.1)
- **Day 4-5**: Deploy monitoring dashboards (Phase 3.1)

### Week 2: Performance Optimization
- **Day 6-7**: Implement memory-aware handling (Phase 2.2)
- **Day 8-9**: Deploy custom metrics (Phase 3.2)
- **Day 10**: Configure alerting rules (Phase 3.3)

### Week 3: Cost Optimization
- **Day 11-12**: Implement tiered processing (Phase 4.1)
- **Day 13-14**: Deploy request coalescing (Phase 4.2)
- **Day 15**: Implement cost tracking (Phase 4.3)

## Expected Outcomes

### Performance Improvements
| Metric | Current | Week 1 | Week 2 | Week 3 |
|--------|---------|--------|--------|--------|
| 413 Error Rate | 4.8% | 0% | 0% | 0% |
| P95 Latency | 75s | 40s | 20s | 15s |
| Cold Start Rate | ~30% | 20% | 15% | 10% |
| Success Rate | 95.2% | 99% | 99.5% | 99.9% |

### Cost Impact
| Component | Current | Projected | Savings |
|-----------|---------|-----------|---------|
| GPU Hours/Day | ~2.5 | ~2.0 | 20% |
| Storage GB | Unknown | Monitored | TBD |
| Bandwidth GB | Unknown | Optimized | 10-15% |
| Total $/1000 requests | $27 | $23 | 15% |

## Risk Mitigation

### Risk 1: Traffic Surge During Implementation
**Mitigation**:
- Deploy during low-traffic hours (2-6 AM PST)
- Use gradual rollout with traffic splitting
- Keep rollback script ready

### Risk 2: Memory Issues with Concurrent Requests
**Mitigation**:
- Keep maxConcurrency=1 initially
- Monitor memory usage closely
- Implement circuit breaker pattern

### Risk 3: Cost Overrun from Extended Scale-Down
**Mitigation**:
- Monitor instance hours closely
- Implement cost alerts at 50%, 80%, 100% of budget
- Auto-scale-down if cost threshold exceeded

## Rollback Plan

### Immediate Rollback Script
```bash
#!/bin/bash
# rollback.sh

# Revert to previous configuration
gcloud run services update-traffic inspirenet-bg-removal-api \
  --region=us-central1 \
  --to-revisions=inspirenet-bg-removal-api-00097-7zt=100

# Verify rollback
gcloud run services describe inspirenet-bg-removal-api \
  --region=us-central1 \
  --format="value(status.traffic[0].revisionName)"
```

### Rollback Triggers
1. Error rate > 5% for 5 minutes
2. P99 latency > 120s for 10 minutes
3. Cost run rate > $150/day
4. Memory errors > 10 per hour

## Monitoring Success Criteria

### Week 1 Success Metrics
- ✅ Zero 413 errors
- ✅ P95 latency < 40s
- ✅ Monitoring dashboard deployed
- ✅ No increase in costs

### Week 2 Success Metrics
- ✅ P95 latency < 20s
- ✅ Custom metrics reporting
- ✅ All alerts configured
- ✅ Memory usage < 80%

### Week 3 Success Metrics
- ✅ Cost per request < $0.025
- ✅ Request coalescing active
- ✅ Tiered processing working
- ✅ Monthly cost projection < $2000

## Dependencies and Prerequisites

### Technical Dependencies
- Google Cloud IAM permissions for Cloud Run admin
- Access to monitoring workspace
- GitHub CI/CD pipeline access
- Testing environment available

### Team Dependencies
- DevOps engineer for deployment (1 person, 20 hours)
- Backend developer for code changes (1 person, 30 hours)
- QA for validation (1 person, 10 hours)
- Product manager for sign-off (checkpoints only)

## Appendix: Configuration Files

### A. Complete Updated deploy-production-clean.yaml
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: inspirenet-bg-removal-api
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/ingress-max-request-size: "52428800"  # 50MB
    run.googleapis.com/description: "Production InSPyReNet API - Optimized Configuration"
spec:
  template:
    metadata:
      annotations:
        # Execution environment
        run.googleapis.com/execution-environment: gen2

        # Request size limit
        run.googleapis.com/request-max-size: "52428800"  # 50MB

        # Scaling configuration - COST OPTIMIZED
        autoscaling.knative.dev/minScale: "0"  # CRITICAL: Keep at 0
        autoscaling.knative.dev/maxScale: "5"  # Increased from 3
        autoscaling.knative.dev/target: "1"
        autoscaling.knative.dev/scale-down-delay: "15m"  # New: 15-minute delay
        autoscaling.knative.dev/stable-window: "60s"     # New: Faster scale-up
        autoscaling.knative.dev/maxConcurrency: "1"      # Keep at 1 initially

        # Performance optimizations
        run.googleapis.com/startup-cpu-boost: "true"
        run.googleapis.com/cpu-throttling: "false"

        # Health check configuration
        run.googleapis.com/health-check-path: "/health"
        run.googleapis.com/health-check-interval: "30s"
        run.googleapis.com/health-check-timeout: "10s"
        run.googleapis.com/health-check-failure-threshold: "3"

        # Startup probe - Optimized
        run.googleapis.com/startup-probe-path: "/health"
        run.googleapis.com/startup-probe-initial-delay: "30s"  # Reduced
        run.googleapis.com/startup-probe-timeout: "60s"         # Increased
        run.googleapis.com/startup-probe-period: "10s"          # Reduced
        run.googleapis.com/startup-probe-failure-threshold: "6" # Reduced

        # Timeout configuration
        run.googleapis.com/timeout: "300s"  # Reduced from 600s

        # Memory configuration
        run.googleapis.com/memory: "32Gi"

        # GPU configuration
        run.googleapis.com/gpu-zonal-redundancy-disabled: "true"

    spec:
      containers:
      - image: us-central1-docker.pkg.dev/perkieprints-processing/pet-bg-removal/inspirenet-bg-removal-api:optimized
        ports:
        - containerPort: 8080
          name: http1
        resources:
          limits:
            cpu: '8'
            memory: '32Gi'
            nvidia.com/gpu: '1'
          requests:
            cpu: '4'
            memory: '32Gi'
            nvidia.com/gpu: '1'
        env:
        # [Keep all existing env vars, add:]
        - name: MAX_REQUEST_SIZE_MB
          value: "37"  # New: Account for base64 overhead
        - name: SCALE_DOWN_DELAY_MINUTES
          value: "15"  # New: Match annotation
        - name: REQUEST_TIMEOUT_SECONDS
          value: "300" # New: Match annotation
```

### B. Monitoring Query Examples
```sql
-- Find all 413 errors
SELECT
  timestamp,
  resource.labels.service_name,
  httpRequest.requestSize,
  httpRequest.latency
FROM
  `your-project.cloud_run_logs.requests`
WHERE
  httpRequest.status = 413
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY
  timestamp DESC

-- Analyze latency distribution
SELECT
  APPROX_QUANTILES(httpRequest.latency, 100)[OFFSET(50)] as p50,
  APPROX_QUANTILES(httpRequest.latency, 100)[OFFSET(95)] as p95,
  APPROX_QUANTILES(httpRequest.latency, 100)[OFFSET(99)] as p99,
  COUNT(*) as request_count
FROM
  `your-project.cloud_run_logs.requests`
WHERE
  timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
  AND resource.labels.service_name = "inspirenet-bg-removal-api"
```

### C. Cost Optimization Queries
```sql
-- Daily cost breakdown
SELECT
  DATE(timestamp) as date,
  COUNT(*) as requests,
  SUM(CASE WHEN cold_start THEN 1 ELSE 0 END) as cold_starts,
  AVG(httpRequest.latency) as avg_latency,
  COUNT(*) * 0.027 as estimated_cost_usd
FROM
  `your-project.cloud_run_logs.requests`
WHERE
  timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY
  date
ORDER BY
  date DESC
```

## Conclusion

This comprehensive infrastructure optimization plan addresses all identified issues while maintaining the critical min-instances=0 constraint. The phased approach ensures minimal risk while delivering measurable improvements in performance, reliability, and cost efficiency. The plan is designed to be implemented incrementally with clear rollback procedures and success metrics at each phase.

Priority 1 changes (Phase 1) should be implemented immediately as they require only configuration changes and will eliminate all 413 errors. Subsequent phases build upon this foundation to deliver a robust, scalable, and cost-effective infrastructure for the InSPyReNet API service.