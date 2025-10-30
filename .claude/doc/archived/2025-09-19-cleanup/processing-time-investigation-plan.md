# Cloud Run Processing Time Investigation Plan

## Executive Summary
Investigation plan to determine if commenting out the share-image endpoint has affected processing times. **Spoiler: It shouldn't have any impact.**

## Current State Analysis

### What Changed
1. **Backend**: Commented out `/api/v2/share-image` endpoint (lines 655-750 in api_v2_endpoints.py)
2. **Frontend**: Replaced server-side sharing with client-side implementation
3. **Core Processing**: UNCHANGED - All ML pipelines, effects, and processing endpoints remain identical

### Technical Assessment
**No performance impact expected** because:
- Commented code has zero runtime overhead (Python ignores it)
- Share endpoint was completely isolated from processing pipeline
- No shared resources between `/share-image` and `/process` endpoints
- Same GPU, memory, and CPU allocations
- Same model loading and caching logic

## Investigation Plan

### Phase 1: Quick Metrics Check (5 minutes)

#### 1.1 Cloud Run Dashboard
Navigate to: `https://console.cloud.google.com/run/detail/us-central1/inspirenet-bg-removal-api/metrics`

Check these metrics:
- **Request Latency Graph**: Compare before/after deployment time
- **Instance Count**: Look for unusual scaling patterns
- **Error Rate**: Check for increased failures
- **Cold Start Frequency**: More frequent than usual?

#### 1.2 Quick Health Check
```bash
# Test current processing time
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process \
  -F "file=@test-image.jpg" \
  -F "effect_type=enhancedblackwhite" \
  -w "\nTotal time: %{time_total}s\n"
```

### Phase 2: Detailed Log Analysis (15 minutes)

#### 2.1 Processing Time Logs
In Cloud Logging, run these queries:

```sql
-- Average processing times for last 24 hours
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
resource.labels.revision_name="inspirenet-bg-removal-api-00080-lqj"
jsonPayload.path="/api/v2/process"
jsonPayload.processing_time_ms

-- Compare with previous revision (00079)
resource.labels.revision_name="inspirenet-bg-removal-api-00079-XXX"
```

#### 2.2 Cold Start Analysis
```sql
-- Count cold starts
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
(textPayload:"Model loaded successfully" OR 
 textPayload:"Starting InSPyReNet API" OR
 textPayload:"Cold start detected")
```

#### 2.3 Error Pattern Analysis
```sql
-- Check for new error patterns
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
severity>=ERROR
NOT textPayload:"share-image"  -- Exclude expected share endpoint errors
```

### Phase 3: Infrastructure Investigation (if needed)

#### 3.1 GPU Availability Check
```bash
# Check GPU quota and usage
gcloud compute project-info describe --project=perkieprints-processing | grep -A5 "GPU"

# Check current GPU instances
gcloud compute instances list --filter="guestAccelerators:*" --project=perkieprints-processing
```

#### 3.2 Cloud Storage Performance
```sql
-- Check storage latency
resource.type="gcs_bucket"
resource.labels.bucket_name="perkieprints-processing-cache"
jsonPayload.latency_ms
```

#### 3.3 Network and CDN
- Check Cloud CDN hit rates if applicable
- Review Cloud Load Balancer metrics
- Check for regional network issues

## Expected Findings vs Red Flags

### Normal/Expected
✅ Cold start times: 30-60 seconds (unchanged)
✅ Warm processing: 3-5 seconds for standard images
✅ Effects processing: 8-12 seconds for multiple effects
✅ Memory usage: 8-12GB during processing
✅ Instance scaling: 0-3 instances based on load

### Red Flags to Investigate
❌ Warm processing >10 seconds consistently
❌ Cold starts >90 seconds
❌ Memory usage >20GB
❌ Error rate >5%
❌ Instance crashes or OOM kills

## Root Cause Analysis Matrix

| Symptom | Possible Cause | Investigation | Solution |
|---------|---------------|---------------|----------|
| Increased cold starts | More traffic causing scaling | Check request volume | Implement warming |
| Slower warm requests | GPU throttling | Check GPU metrics | Contact GCP support |
| Memory spikes | Memory leak | Check memory graphs | Review recent commits |
| Network timeouts | Storage issues | Check GCS latency | Review bucket config |
| Random slowdowns | Resource contention | Check co-tenancy | Consider dedicated resources |

## Remediation Options

### If Performance Degraded (unlikely)

#### Option 1: Rollback Test
```bash
# Roll back to previous revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=inspirenet-bg-removal-api-00079-XXX=100 \
  --region=us-central1
```

#### Option 2: Warming Strategy Enhancement
- Implement Cloud Scheduler to warm every 5 minutes during business hours
- Add frontend pre-warming on page load
- Use Cloud Tasks for distributed warming

#### Option 3: Infrastructure Optimization
- Increase `autoscaling.knative.dev/minScale` to 1 (costs $65/day)
- Optimize container startup time
- Implement request coalescing

## Cost-Benefit Analysis

### Current Setup (MIN_INSTANCES=0)
- **Cost**: ~$0.065 per processed image
- **Cold starts**: 30-60s on first request
- **Monthly cost**: Variable, ~$200-500 based on usage

### Alternative: Always-On (MIN_INSTANCES=1)
- **Cost**: $65-100/day baseline ($2000-3000/month)
- **Cold starts**: None
- **Business impact**: Not justified for current traffic

## Recommendations

1. **Most Likely**: No performance issue exists - perception bias from users noticing normal cold starts
2. **If Confirmed Slower**: Check infrastructure factors (GPU availability, network, storage)
3. **Not Related To**: Share-image endpoint commenting (technically impossible to affect processing)

## Action Items

- [ ] Check Cloud Run metrics dashboard
- [ ] Run processing time comparison queries
- [ ] Document actual findings
- [ ] If degradation confirmed, investigate infrastructure
- [ ] If no degradation, improve user feedback during cold starts

## Conclusion

The commented share-image endpoint **cannot technically affect processing performance** as it's completely isolated code that never touched the ML pipeline. Any observed slowdown is due to external factors like:
- Increased cold start frequency from traffic patterns
- GPU resource availability in us-central1
- Network/storage latency changes
- User perception of existing cold start times

Focus investigation on infrastructure metrics, not code changes.