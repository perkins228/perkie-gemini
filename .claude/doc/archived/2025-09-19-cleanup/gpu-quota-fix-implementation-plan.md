# GPU Quota Issue - Root Cause Analysis & Implementation Plan

## Executive Summary
The InSPyReNet background removal API deployment is failing due to GPU quota exhaustion in the us-central1 region. The service has been stuck on revision 00074-d2r since August 17, 2025, preventing critical updates from deploying.

## Root Cause Analysis

### Primary Issue: GPU Quota Exhaustion
**Error**: `Quota exceeded for total allowable count of GPUs per project per region`
- **Region**: us-central1
- **GPU Type**: NVIDIA L4 (implicit from Cloud Run GPU allocation)
- **Requested**: 1 GPU with max-scale=3 (potential for 3 GPUs)
- **Current Status**: Unable to allocate even 1 GPU for new revision

### Contributing Factors
1. **Regional Quota Limit**: The project has hit the maximum allowed L4 GPUs in us-central1
2. **Zombie Resources**: Potentially orphaned GPU allocations from failed deployments
3. **Configuration Issue**: maxScale=3 may be requesting more GPUs than quota allows
4. **Regional Congestion**: us-central1 is a popular region with high GPU demand

## Implementation Plan

### Phase 1: Immediate Mitigation (15-30 minutes)

#### Option A: Reduce maxScale to 1 (Recommended - Fastest)
```bash
# Update deployment configuration to use only 1 GPU maximum
gcloud run services update inspirenet-bg-removal-api \
    --region us-central1 \
    --max-instances 1 \
    --update-annotations autoscaling.knative.dev/maxScale=1
```

**Rationale**: 
- Reduces GPU requirement from potential 3 to guaranteed 1
- Maintains zero-cost base (min-instances=0)
- May fit within existing quota
- Minimal service disruption

#### Option B: Deploy Without GPU (Emergency Fallback)
```bash
# Remove GPU requirement temporarily
gcloud run deploy inspirenet-bg-removal-api \
    --region us-central1 \
    --source . \
    --no-gpu \
    --cpu 8 \
    --memory 32Gi \
    --max-instances 1
```

**Rationale**: 
- Gets service deployed immediately
- CPU-only processing (10-20x slower but functional)
- Allows critical bug fixes to deploy
- Can re-add GPU once quota resolved

### Phase 2: Clean Up Resources (30-45 minutes)

#### Step 1: Identify and Remove Orphaned Resources
```bash
# List all Cloud Run services in the region
gcloud run services list --region us-central1 --format="table(name,status.url)"

# Delete unused test services that might be holding GPUs
gcloud run services delete [SERVICE_NAME] --region us-central1

# Clean up old revisions
gcloud run revisions delete inspirenet-bg-removal-api-00073-8ns --region us-central1
gcloud run revisions delete inspirenet-bg-removal-api-00078-fes --region us-central1
gcloud run revisions delete inspirenet-bg-removal-api-00071-lkr --region us-central1
```

#### Step 2: Check for GKE Autopilot GPU Usage
```bash
# Check if any GKE clusters are using GPUs
gcloud container clusters list --region us-central1
```

### Phase 3: Request Quota Increase (1-2 hours setup, 24-48 hours approval)

#### Step 1: Check Current Quota
```bash
# View current GPU quotas
gcloud compute project-info describe --project=perkieprints-processing
```

#### Step 2: Request Quota Increase
1. Go to [Google Cloud Console Quotas](https://console.cloud.google.com/iam-admin/quotas)
2. Filter by:
   - Service: Compute Engine API
   - Region: us-central1
   - Metric: NVIDIA_L4_GPUS or GPUS_ALL_REGIONS
3. Request increase from current (likely 1) to 4
4. Justification template:
```
We run a production AI image processing service that requires GPU acceleration for real-time customer requests. Our service processes pet images with AI background removal for e-commerce. We need 4 L4 GPUs to handle:
- 1 GPU for production traffic
- 1 GPU for staging/testing
- 2 GPUs for burst capacity during peak hours
Current limitation is blocking critical production deployments.
```

### Phase 4: Long-term Solution - Multi-Region Deployment (2-4 hours)

#### Option A: Add Secondary Region (us-west1)
```yaml
# deploy-multi-region.yaml
regions:
  primary: us-central1
  secondary: us-west1
  
load_balancing:
  type: geographic
  failover: automatic
```

#### Option B: Move to Different Region
Consider regions with better GPU availability:
- **us-west1**: Often has better L4 availability
- **us-east1**: Larger region with more resources
- **europe-west4**: If latency acceptable

```bash
# Deploy to new region
gcloud run deploy inspirenet-bg-removal-api \
    --region us-west1 \
    --source . \
    --gpu 1 \
    --max-instances 2
```

### Phase 5: Update Configuration Files

#### Update deploy-production-clean.yaml
```yaml
metadata:
  annotations:
    # Add quota management annotations
    run.googleapis.com/gpu-quota-aware: "true"
    run.googleapis.com/fallback-cpu-mode: "true"
    
spec:
  template:
    metadata:
      annotations:
        # Reduce maxScale to fit quota
        autoscaling.knative.dev/maxScale: "1"  # Changed from 3
```

#### Update deploy-model-fix.sh
```bash
#!/bin/bash
# Add quota check before deployment
QUOTA_CHECK=$(gcloud compute regions describe us-central1 --format="value(quotas[?name=='NVIDIA_L4_GPUS'].limit)")

if [ -z "$QUOTA_CHECK" ] || [ "$QUOTA_CHECK" -lt "1" ]; then
    echo "WARNING: GPU quota may be insufficient"
    read -p "Deploy without GPU? (y/n) " -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        GPU_FLAG=""
    else
        exit 1
    fi
else
    GPU_FLAG="--gpu 1"
fi

gcloud run deploy inspirenet-bg-removal-api \
    --region us-central1 \
    --max-instances 1 \
    $GPU_FLAG \
    # ... rest of configuration
```

## Verification Steps

### Step 1: Verify Deployment Success
```bash
# Check if new revision deployed
gcloud run services describe inspirenet-bg-removal-api \
    --region us-central1 \
    --format="value(status.latestReadyRevisionName)"

# Should show revision newer than 00074-d2r
```

### Step 2: Test API Functionality
```bash
# Test health endpoint
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Test model info
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info
```

### Step 3: Monitor Performance
```bash
# Check logs for errors
gcloud run services logs read inspirenet-bg-removal-api \
    --region us-central1 \
    --limit 50
```

## Cost Implications

### Current Blocked State
- **Cost**: $0/day (service running old revision)
- **Impact**: Cannot deploy fixes or improvements
- **Risk**: Service degradation over time

### After Fix Implementation
- **maxScale=1**: Max $65/day when active (usually $0 with min=0)
- **maxScale=3**: Max $195/day if all instances active
- **CPU-only fallback**: ~$20/day when active (10-20x slower)

## Risk Mitigation

### Rollback Plan
```bash
# If issues occur, rollback to working revision
gcloud run services update-traffic inspirenet-bg-removal-api \
    --region us-central1 \
    --to-revisions inspirenet-bg-removal-api-00074-d2r=100
```

### Monitoring Setup
```bash
# Set up alert for GPU quota issues
gcloud alpha monitoring policies create \
    --notification-channels=[CHANNEL_ID] \
    --display-name="GPU Quota Alert" \
    --condition-display-name="GPU Quota Exceeded" \
    --condition-expression='
      resource.type="cloud_run_revision" AND
      metric.type="run.googleapis.com/request_count" AND
      metric.label.response_code_class="5xx"'
```

## Timeline & Priority

### Immediate (Now - 30 minutes)
1. ✅ Reduce maxScale to 1
2. ✅ Attempt deployment
3. ✅ Verify functionality

### Today (1-2 hours)
1. Clean up unused resources
2. Submit quota increase request
3. Document configuration changes

### This Week (2-5 days)
1. Receive quota approval
2. Test increased capacity
3. Implement multi-region failover

## Success Criteria
- [ ] New revision (>00074-d2r) deployed successfully
- [ ] API endpoints responding normally
- [ ] Processing time <11s (first request) and <3s (warm)
- [ ] No GPU quota errors in logs
- [ ] Cost remains <$100/day

## Alternative Solutions Considered

### 1. Switch to Different GPU Type
- **T4 GPUs**: Cheaper but slower
- **A100 GPUs**: Faster but much more expensive
- **Decision**: Stay with L4 for best price/performance

### 2. Implement GPU Sharing
- Multiple services share single GPU
- **Challenge**: Cloud Run doesn't support GPU sharing
- **Decision**: Not feasible with current platform

### 3. Move to GKE Autopilot
- More control over GPU allocation
- **Challenge**: Higher operational complexity
- **Decision**: Keep Cloud Run for simplicity

## Recommendations

### Immediate Action Required
1. **Deploy with maxScale=1** - This should work within quota
2. **Clean up old revisions** - Free any orphaned resources
3. **Request quota increase** - Prepare for future growth

### Long-term Strategy
1. **Implement multi-region deployment** - Avoid single region bottlenecks
2. **Set up quota monitoring** - Proactive alerts before hitting limits
3. **Consider reserved capacity** - For predictable GPU availability

## Contact & Escalation
- **Primary**: Deploy with reduced maxScale
- **Escalation**: Google Cloud Support ticket for quota increase
- **Emergency**: Deploy CPU-only version if needed

---

**Document Status**: Implementation ready
**Priority**: CRITICAL - Production deployment blocked
**Estimated Resolution Time**: 30 minutes for immediate fix, 24-48 hours for full quota resolution