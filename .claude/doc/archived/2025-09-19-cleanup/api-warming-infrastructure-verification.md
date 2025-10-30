# API Warming Infrastructure Verification Plan

## Executive Summary
This document provides a comprehensive plan to verify the API warming fix from an infrastructure perspective, focusing on Google Cloud Run logs, metrics, resource patterns, and model loading verification.

## Context
- **Previous Issue**: Frontend called `/health` endpoint which used `asyncio.create_task()` for non-blocking async warming
- **Fix Applied**: Frontend now calls `/warmup` endpoint which is blocking/synchronous
- **Method Change**: Changed from GET to POST for `/warmup` endpoint
- **Expected Behavior**: Model loads completely (10-15s) before response returns

## 1. Cloud Run Logs Verification

### 1.1 Verify /warmup Endpoint Calls

#### Using Google Cloud Console:
```bash
# View logs for /warmup endpoint calls
gcloud logging read "resource.type=cloud_run_revision AND 
  resource.labels.service_name=inspirenet-bg-removal-api AND
  jsonPayload.endpoint=/warmup" \
  --limit=50 \
  --format="table(timestamp,jsonPayload.endpoint,jsonPayload.total_time,jsonPayload.model_ready)"
```

#### Key Log Patterns to Look For:
```
# Successful warming pattern
"Warmup endpoint called"
"Loading InSPyReNet model..."
"Model loaded successfully in X.Xs"
"Warmup endpoint completed in X.Xs"

# Failed warming pattern
"Warmup endpoint failed after X.Xs"
"Warmup failed: [error message]"
```

### 1.2 Compare /health vs /warmup Behavior

```bash
# Count /health calls (old behavior)
gcloud logging read "resource.type=cloud_run_revision AND 
  httpRequest.requestUrl=~'/health'" \
  --limit=100 \
  --format="value(timestamp)" | wc -l

# Count /warmup calls (new behavior)  
gcloud logging read "resource.type=cloud_run_revision AND
  httpRequest.requestUrl=~'/warmup'" \
  --limit=100 \
  --format="value(timestamp)" | wc -l
```

## 2. Metrics Showing Warming is Working

### 2.1 Request Duration Metrics

#### Cloud Run Console Metrics:
1. Navigate to Cloud Run > inspirenet-bg-removal-api > Metrics
2. Look for "Request latencies" chart
3. Expected patterns:
   - `/warmup` requests: 10-15 seconds (model loading)
   - `/health` requests: <100ms (quick response)
   - `/remove-background` after warming: 2-3 seconds
   - `/remove-background` cold start: 11+ seconds

#### Custom Metrics Query:
```sql
-- In Cloud Monitoring Metrics Explorer
SELECT 
  metric.type,
  resource.service_name,
  metric.labels.response_code_class
WHERE
  metric.type = "run.googleapis.com/request_latencies" AND
  resource.service_name = "inspirenet-bg-removal-api"
GROUP BY
  metric.labels.response_code_class
```

### 2.2 Success Rate Indicators

**Warming Working Properly:**
- `/warmup` endpoint: 200 responses with 10-15s latency
- Subsequent `/remove-background`: 200 responses with 2-3s latency
- No timeout errors on warmed requests

**Warming NOT Working:**
- `/warmup` endpoint: <1s response time (indicates async issue)
- First `/remove-background`: 11+ seconds or timeouts
- High rate of 504 Gateway Timeout errors

## 3. Expected Resource Usage Patterns

### 3.1 CPU Usage Patterns

**During Warming (Expected):**
```
Time     | CPU Usage | Memory    | Status
---------|-----------|-----------|------------------
0-1s     | 10-20%    | 500MB     | Container startup
1-2s     | 30-40%    | 800MB     | Python initialization
2-5s     | 60-80%    | 1.5GB     | Loading PyTorch
5-10s    | 80-100%   | 2.5GB     | Loading model weights
10-15s   | 90-100%   | 3.5GB     | Model initialization
15s+     | 5-10%     | 3.5GB     | Idle, ready for requests
```

### 3.2 Memory Usage Verification

```bash
# Check memory usage during warming
gcloud monitoring read \
  "compute.googleapis.com/instance/memory/utilization" \
  --filter='resource.type="cloud_run_revision" AND 
            resource.labels.service_name="inspirenet-bg-removal-api"' \
  --format="table(points.value,points.interval.endTime)" \
  --start-time="2025-08-18T00:00:00Z"
```

**Expected Memory Pattern:**
- Baseline: 500MB-800MB (container + Python)
- During warming: Gradual increase to 3.5GB
- After warming: Stable at 3.5GB
- GPU memory (if visible): ~4GB allocated for model

### 3.3 GPU Usage Patterns (NVIDIA L4)

```bash
# GPU metrics (if available in Cloud Monitoring)
gcloud monitoring read \
  "custom.googleapis.com/gpu/utilization" \
  --filter='resource.labels.service_name="inspirenet-bg-removal-api"'
```

**Expected GPU Pattern:**
- During warming: 60-80% GPU utilization
- Model loaded: GPU memory ~4GB allocated
- Processing images: 80-100% GPU utilization for 2-3s
- Idle: 0% GPU utilization, memory retained

## 4. Model Loading Verification

### 4.1 Direct Verification via Logs

```bash
# Check for model loading confirmation
gcloud logging read "resource.type=cloud_run_revision AND 
  'Model loaded successfully' OR 'InSPyReNet model ready'" \
  --limit=20 \
  --format="table(timestamp,textPayload)"
```

### 4.2 Model State Verification

Check the `/model-info` endpoint response:
```bash
# From local machine or Cloud Shell
curl -X GET https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info

# Expected response when model is loaded:
{
  "model_loaded": true,
  "model_name": "InSPyReNet",
  "device": "cuda",
  "input_size": 1024,
  "memory_usage_mb": 3500,
  "preprocessing_enabled": true
}
```

### 4.3 Warming Success Verification

```bash
# Test warming endpoint directly
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup \
  -H "Content-Type: application/json" \
  -w "\nTime: %{time_total}s\n"

# Expected response (after 10-15s):
{
  "status": "success",
  "model_ready": true,
  "total_time": 12.5,
  "warmup_operations": ["model_load", "gpu_init", "test_inference"],
  "container_ready": true
}
```

## 5. Cloud Run Specific Considerations

### 5.1 Container Lifecycle

**Key Points:**
- Containers stay warm for ~15 minutes of inactivity
- Min instances = 0 (critical for cost control)
- Max instances = 10
- Cold starts are expected and acceptable

### 5.2 Concurrency Considerations

```yaml
# Current configuration
spec:
  containerConcurrency: 1  # One request at a time
  timeoutSeconds: 120      # 2-minute timeout
```

**Verification:**
- Check if warming requests block other requests (expected)
- Verify timeout is sufficient for warming (120s > 15s warming)

### 5.3 Cost Monitoring

```bash
# Monitor warming-related costs
gcloud billing budgets list --billing-account=YOUR_BILLING_ACCOUNT

# Check instance hours
gcloud monitoring read \
  "run.googleapis.com/container/instance_count" \
  --filter='resource.labels.service_name="inspirenet-bg-removal-api"' \
  --format="table(points.value,points.interval.endTime)"
```

**Expected Costs:**
- Warming requests: ~$0.01 per warmup
- Daily warming costs: $0.60-1.50 (acceptable)
- GPU idle time: Should remain at $0 (min-instances=0)

## 6. Verification Checklist

### Quick Verification Steps:

1. **[ ] Check /warmup endpoint is being called**
   ```bash
   gcloud logging read "httpRequest.requestUrl=~'/warmup'" --limit=10
   ```

2. **[ ] Verify warming takes 10-15 seconds**
   - Check request latency in Cloud Run metrics
   - Should see 10-15s duration for /warmup calls

3. **[ ] Confirm model loading in logs**
   ```bash
   gcloud logging read "'Model loaded successfully'" --limit=5
   ```

4. **[ ] Test subsequent request speed**
   - After warming, requests should take 2-3s, not 11s

5. **[ ] Monitor memory usage**
   - Should see increase to ~3.5GB during warming
   - Memory should remain allocated after warming

6. **[ ] Verify no min-instances cost**
   - Ensure min-instances remains at 0
   - Check billing for unexpected GPU idle charges

## 7. Troubleshooting Guide

### If Warming Appears Not Working:

1. **Symptom: /warmup returns in <1 second**
   - **Check**: Response body for error messages
   - **Likely Cause**: Model already loaded or async behavior
   - **Fix**: Verify endpoint implementation is synchronous

2. **Symptom: Still getting 11s delays after warming**
   - **Check**: Container instance ID in logs
   - **Likely Cause**: Different container instance handling request
   - **Fix**: Verify session affinity or accept cold starts

3. **Symptom: Timeouts on /warmup endpoint**
   - **Check**: Cloud Run timeout configuration
   - **Likely Cause**: Timeout < warming time
   - **Fix**: Increase timeout to 120s+

4. **Symptom: High warming frequency**
   - **Check**: Frontend cooldown logic
   - **Likely Cause**: Cooldown not working
   - **Fix**: Verify localStorage/sessionStorage logic

## 8. Performance Baseline

### Expected Metrics Post-Fix:

| Metric | Cold Start | After Warming | Target |
|--------|------------|---------------|---------|
| First Request | 11-15s | 2-3s | <3s |
| Model Load Time | 10-15s | 0s (cached) | N/A |
| Memory Usage | 500MB→3.5GB | 3.5GB stable | <4GB |
| GPU Utilization | 60-80% | 0% idle | Efficient |
| Success Rate | 85-90% | 98-99% | >95% |

## 9. Monitoring Dashboard Setup

### Create Custom Dashboard:

1. **Cloud Run Service Health**
   - Request count by endpoint
   - Latency by endpoint (p50, p95, p99)
   - Error rate

2. **Warming Effectiveness**
   - /warmup call frequency
   - /warmup duration distribution
   - Subsequent request latencies

3. **Resource Utilization**
   - CPU usage over time
   - Memory usage over time
   - GPU utilization (if available)
   - Container instance count

4. **Cost Tracking**
   - Compute hours per day
   - GPU hours per day
   - Request count vs cost correlation

## 10. Success Criteria

### Warming is Working When:

✅ `/warmup` endpoint shows in logs with 10-15s duration  
✅ Memory increases to 3.5GB and stays allocated  
✅ Subsequent requests complete in 2-3s  
✅ No timeout errors on warmed sessions  
✅ Model loading messages appear in logs  
✅ No unexpected GPU idle costs (min-instances=0)  
✅ 15-25% improvement in upload completion rate  

### Red Flags:

❌ `/warmup` returns in <1 second  
❌ First request after warming still takes 11s  
❌ Memory drops after warming completes  
❌ High rate of timeout errors  
❌ GPU costs increasing (check min-instances)  
❌ No improvement in user conversion metrics  

## Summary

The API warming fix changes the fundamental behavior from non-blocking async (`/health`) to blocking sync (`/warmup`). This ensures the model is fully loaded before the response returns, eliminating the race condition where users could upload before warming completed.

Key verification points:
1. `/warmup` endpoint being called (not `/health`)
2. 10-15 second warming duration
3. Model fully loaded before response
4. Subsequent requests are fast (2-3s)
5. No increase in idle GPU costs

The infrastructure verification confirms the technical fix is working, while business metrics will validate the conversion impact over time.