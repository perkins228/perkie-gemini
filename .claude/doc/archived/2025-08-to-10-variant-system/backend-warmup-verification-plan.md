# Backend Verification Plan: InSPyReNet API Warming Functionality

## Executive Summary
Comprehensive verification plan for the deployed warmup fix on Google Cloud Run revision 00091-mat. This plan provides specific Cloud Logging queries, metrics monitoring strategies, and correlation methods to verify the warming behavior is functioning correctly in production.

## Service Configuration
- **Service**: inspirenet-bg-removal-api
- **Project**: perkieprints-processing
- **Region**: us-central1
- **Current Revision**: inspirenet-bg-removal-api-00091-mat (100% traffic)
- **GPU**: NVIDIA L4
- **Min Instances**: 0 (CRITICAL - must remain 0 for cost control)
- **Max Instances**: 10
- **API URL**: https://inspirenet-bg-removal-api-725543555429.us-central1.run.app

## Part 1: Cloud Logging Queries

### 1.1 Warmup Success/Failure Rate
```sql
-- Query to check warmup endpoint success rate (last 24 hours)
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
resource.labels.revision_name="inspirenet-bg-removal-api-00091-mat"
jsonPayload.path="/warmup"
timestamp >= "2025-10-02T00:00:00Z"

-- Success filter
jsonPayload.response.error=false

-- Failure filter
jsonPayload.response.error=true
```

**Expected Results:**
- Success rate: >95% after initial deployment
- Error field: Should be `false` for successful warmups
- HTTP status: Always 200 (even on internal errors)

### 1.2 Model Load Time Analysis
```sql
-- Query for model loading duration
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
"Loading InSPyReNet model"
OR "Model loaded successfully"
OR "Model loading took"
timestamp >= "2025-10-02T00:00:00Z"

-- Parse duration from log messages
```

**Expected Results:**
- Cold start model load: 30-35 seconds
- Log pattern: "Model loading took X.Xs"
- Should only occur once per container instance

### 1.3 Processing Time Verification
```sql
-- Query for actual image processing times (not warmup)
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
resource.labels.revision_name="inspirenet-bg-removal-api-00091-mat"
(jsonPayload.path="/remove-background" OR jsonPayload.path="/api/v2/process")
jsonPayload.duration_ms>0
timestamp >= "2025-10-02T00:00:00Z"

-- Group by container instance to identify warm vs cold
```

**Expected Results:**
- Warm container: 3-5 seconds per request
- Cold container first request: 30-60 seconds
- Pattern: First request slow, subsequent fast

### 1.4 Dimension-Related Errors
```sql
-- Query for any dimension errors (should be zero)
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
resource.labels.revision_name="inspirenet-bg-removal-api-00091-mat"
("height and width must be > 0" OR "dimension" OR "0x0" OR "invalid size")
severity>=ERROR
timestamp >= "2025-10-02T00:00:00Z"
```

**Expected Results:**
- Count: 0 errors (fix should eliminate these)
- Previous revision had: "height and width must be > 0"
- Current revision: No dimension errors

### 1.5 Container Lifecycle Events
```sql
-- Query for container startup/shutdown events
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
("Container started" OR "Container terminated" OR "Starting container" OR "Stopping container")
timestamp >= "2025-10-02T00:00:00Z"

-- Correlate with instance IDs
```

**Expected Results:**
- Container lifespan: 15 minutes idle timeout
- Scale-down events after no traffic
- Scale-up events on new requests

## Part 2: Metrics to Monitor

### 2.1 Latency Metrics

| Endpoint | Cold Start | Warm | Target |
|----------|------------|------|---------|
| `/warmup` | 30-35s | 0.1s | <40s cold, <1s warm |
| `/remove-background` | 30-60s | 3-5s | <60s cold, <10s warm |
| `/api/v2/process` | 30-60s | 3-5s | <60s cold, <10s warm |

**Monitoring Query:**
```yaml
# Cloud Monitoring metric for P95 latency
fetch cloud_run_revision
| metric 'run.googleapis.com/request_latencies'
| filter resource.service_name == 'inspirenet-bg-removal-api'
| filter resource.revision_name == 'inspirenet-bg-removal-api-00091-mat'
| group_by 1m, [value_latencies: percentile(value.latencies, 95)]
| filter metric.route =~ '/warmup|/remove-background|/api/v2/process'
```

### 2.2 GPU Memory Usage

**Expected Patterns:**
- Initial allocation: ~2GB on model load
- Processing spike: +500MB-1GB per image
- Stable after warmup: ~2.5GB baseline
- Memory release: After 15 min idle

**Monitoring Query:**
```yaml
# GPU memory utilization
fetch cloud_run_revision
| metric 'run.googleapis.com/container/gpu/memory_used'
| filter resource.service_name == 'inspirenet-bg-removal-api'
| group_by 1m, [value_memory: mean(value.memory_used)]
```

### 2.3 Instance Scaling Patterns

**Expected Behavior:**
- Scale to 0: When no traffic for 15 minutes
- Scale up: 1 instance per 3 concurrent requests
- Max instances: 10 (configured limit)
- Target concurrency: 1 (GPU constraint)

**Monitoring Query:**
```yaml
# Instance count over time
fetch cloud_run_revision
| metric 'run.googleapis.com/container/instance_count'
| filter resource.service_name == 'inspirenet-bg-removal-api'
| group_by 1m, [value_count: mean(value.instance_count)]
```

## Part 3: Test Scenarios & Verification

### 3.1 Cold Start Test
```bash
# Wait for all instances to scale to 0 (15+ min idle)
# Then trigger warmup
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nTime: %{time_total}s\n"

# Expected: 30-35s response time, error: false
```

### 3.2 Warm Request Test
```bash
# Immediately after warmup succeeds, send processing request
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process \
  -H "Content-Type: application/json" \
  -F "image=@test_image.jpg" \
  -F "effect=blackwhite" \
  -w "\nTime: %{time_total}s\n"

# Expected: 3-5s response time (not 30-60s)
```

### 3.3 Concurrent Warmup Test
```bash
# Send 3 warmup requests simultaneously
for i in {1..3}; do
  curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
    -H "Content-Type: application/json" \
    -d '{}' &
done
wait

# Expected: All return success, no errors
```

### 3.4 Error Recovery Test
```bash
# Intentionally cause error (if possible) then retry
# Monitor logs for graceful handling
# Verify subsequent warmups still work
```

## Part 4: Frontend-Backend Correlation

### 4.1 Correlation Strategy

**Frontend Request Tracking:**
1. Frontend adds unique request ID header: `X-Warmup-Request-ID`
2. Log this ID in both frontend and backend
3. Correlate using Cloud Logging query

**Implementation:**
```javascript
// Frontend warming code
const requestId = `warmup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
fetch('/warmup', {
  headers: {
    'X-Warmup-Request-ID': requestId
  }
});
console.log(`Warmup initiated: ${requestId}`);
```

```python
# Backend logging (in main.py)
request_id = request.headers.get('X-Warmup-Request-ID', 'unknown')
logger.info(f"Warmup request received: {request_id}")
```

### 4.2 End-to-End Timing Verification

**Correlation Query:**
```sql
-- Match frontend and backend logs by request ID
(resource.type="cloud_run_revision" AND jsonPayload.request_id=~"warmup-.*")
OR (resource.type="browser" AND jsonPayload.message=~"Warmup initiated:.*")
timestamp >= "2025-10-02T00:00:00Z"

-- Calculate end-to-end latency
```

**Expected Timeline:**
1. T+0s: Frontend initiates warmup
2. T+1s: Request reaches Cloud Run
3. T+2s: Container starts (if cold)
4. T+32s: Model loads
5. T+35s: Warmup completes
6. T+36s: Frontend receives response

## Part 5: Red Flags & Alert Conditions

### 5.1 Critical Red Flags (Immediate Action)

| Indicator | Threshold | Action Required |
|-----------|-----------|----------------|
| Warmup error rate | >5% | Check logs, possible regression |
| Dimension errors | >0 | Fix failed, investigate |
| Model load time | >60s | GPU issue or resource constraint |
| Memory usage | >8GB | Memory leak, restart needed |
| HTTP 500s | >1% | Service degradation |

### 5.2 Warning Indicators (Monitor)

| Indicator | Threshold | Concern |
|-----------|-----------|---------|
| Warmup time | >40s | Slower than expected |
| Processing after warmup | >10s | Warmup not effective |
| Instance count | >5 sustained | Unusual traffic or inefficiency |
| Cold start frequency | >10/hour | Too many scale-downs |

### 5.3 Success Indicators

| Indicator | Target | Validates |
|-----------|--------|-----------|
| Warmup success | 100% | Fix working |
| No dimension errors | 0 | Root cause resolved |
| Warm processing | <5s | Model stays loaded |
| Memory stable | ~2.5GB | No leaks |

## Part 6: Monitoring Dashboard Configuration

### 6.1 Key Charts to Create

1. **Warmup Success Rate** (Line chart, 1-min intervals)
2. **Request Latency P50/P95/P99** (Multi-line, by endpoint)
3. **Instance Count vs Traffic** (Dual axis)
4. **GPU Memory Usage** (Area chart)
5. **Error Rate by Type** (Stacked bar)
6. **Cold Start Frequency** (Histogram, hourly buckets)

### 6.2 Alert Policies

```yaml
# Critical Alert: Warmup Failures
alert_policy:
  display_name: "InSPyReNet Warmup Failures"
  conditions:
    - display_name: "High warmup error rate"
      condition_threshold:
        filter: |
          resource.type="cloud_run_revision"
          resource.labels.service_name="inspirenet-bg-removal-api"
          jsonPayload.path="/warmup"
          jsonPayload.response.error=true
        aggregations:
          - alignment_period: 300s
            per_series_aligner: ALIGN_RATE
        comparison: COMPARISON_GT
        threshold_value: 0.05  # 5% error rate
  notification_channels: ["email", "slack"]
```

## Part 7: 24-Hour Monitoring Checklist

### Hour 0-1 (Immediate)
- [ ] Verify warmup endpoint returns `{"error": false}`
- [ ] Check for dimension errors (should be 0)
- [ ] Confirm model loads only once per container
- [ ] Test warm request is <5s

### Hour 1-4 (Early Validation)
- [ ] Monitor warmup success rate (>95%)
- [ ] Check memory usage stability
- [ ] Verify scale-to-zero still works
- [ ] Correlate frontend warming attempts

### Hour 4-12 (Business Hours)
- [ ] Track real traffic patterns
- [ ] Monitor cold start frequency
- [ ] Check processing times remain <5s warm
- [ ] Verify no memory leaks

### Hour 12-24 (Full Cycle)
- [ ] Review overnight behavior
- [ ] Check Cloud Scheduler warmup jobs
- [ ] Analyze cost impact
- [ ] Document any anomalies

## Part 8: Rollback Criteria

**Immediate Rollback If:**
1. Warmup error rate >10%
2. Processing times degrade >2x
3. Memory usage >10GB
4. HTTP 500 rate >5%
5. Dimension errors reappear

**Rollback Command:**
```bash
# Quick traffic shift to previous revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions "inspirenet-bg-removal-api-00090-xxx=100" \
  --region us-central1
```

## Summary

This verification plan provides comprehensive monitoring and validation for the warmup fix deployed to revision 00091-mat. The key success metrics are:

1. **Warmup Success**: 100% success rate with `error: false`
2. **No Dimension Errors**: Zero "height and width must be > 0" errors
3. **Performance**: 3-5s processing after warmup (not 30-60s)
4. **Stability**: Memory ~2.5GB, proper scaling behavior
5. **Cost**: No increase in instance hours due to fix

Execute the Cloud Logging queries and monitoring setup within the first hour of deployment. Continue monitoring for 24 hours to ensure stability under real traffic conditions.