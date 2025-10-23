# API Production Recovery & Infrastructure Hardening Plan

**Date**: 2025-09-19
**Priority**: P0 - PRODUCTION DOWN
**Issue**: Complete InSPyReNet API outage - all endpoints returning 500 errors
**Business Impact**: 100% customer image processing failure

## Executive Summary

The InSPyReNet background removal API is completely down with container startup failure. This plan provides immediate recovery steps, root cause identification, rollback procedures, and long-term infrastructure hardening to prevent future outages.

## IMMEDIATE RECOVERY ACTIONS (Execute NOW)

### Step 1: Check Container Logs (2 minutes)
```bash
# View last 50 container error logs
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="inspirenet-bg-removal-api"
  AND severity>=ERROR' \
  --limit=50 \
  --format=json \
  --project=perkieprints-processing

# Check startup failures specifically
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="inspirenet-bg-removal-api"
  AND (textPayload:"error" OR textPayload:"failed" OR textPayload:"exception")' \
  --limit=20 \
  --project=perkieprints-processing
```

### Step 2: Verify Active Revision Status (1 minute)
```bash
# List all revisions and their status
gcloud run revisions list \
  --service=inspirenet-bg-removal-api \
  --region=us-central1 \
  --project=perkieprints-processing \
  --format="table(name,status.conditions[0].status,metadata.creationTimestamp)"

# Check which revision is receiving traffic
gcloud run services describe inspirenet-bg-removal-api \
  --region=us-central1 \
  --project=perkieprints-processing \
  --format="value(status.traffic[0].revisionName)"
```

### Step 3: EMERGENCY ROLLBACK (5 minutes)
Based on the context, revision `00084-yiq` shows "True" status and is likely working:

```bash
# EXECUTE THIS NOW - Rollback to last known working revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=inspirenet-bg-removal-api-00084-yiq=100 \
  --region=us-central1 \
  --project=perkieprints-processing

# Verify rollback success
curl -v https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Test CORS headers
curl -X OPTIONS \
  https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects \
  -H "Origin: https://perkieprints.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

### Step 4: Verify Customer Functionality (2 minutes)
```bash
# Test health endpoint
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Test warmup endpoint
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup

# Monitor live traffic
gcloud logging tail 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="inspirenet-bg-removal-api"' \
  --project=perkieprints-processing
```

## ROOT CAUSE IDENTIFICATION

### Container Failure Analysis
The container is failing at startup before FastAPI can even respond to health checks.

**Most Likely Causes** (in order of probability):
1. **GPU/CUDA Driver Mismatch** - Recent Cloud Run update incompatible with CUDA version
2. **Model Loading OOM** - 32GB RAM insufficient for model initialization
3. **Corrupted Docker Image** - Bad build or registry corruption
4. **Environment Variable Missing** - Critical config not set
5. **Python Dependency Conflict** - Package version incompatibility

### Diagnostic Commands
```bash
# Check memory usage during startup
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="inspirenet-bg-removal-api"
  AND textPayload:"memory"' \
  --limit=10 \
  --project=perkieprints-processing

# Check GPU allocation
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="inspirenet-bg-removal-api"
  AND (textPayload:"cuda" OR textPayload:"gpu" OR textPayload:"GPU")' \
  --limit=20 \
  --project=perkieprints-processing

# Check Python errors
gcloud logging read 'resource.type="cloud_run_revision"
  AND resource.labels.service_name="inspirenet-bg-removal-api"
  AND (textPayload:"ImportError" OR textPayload:"ModuleNotFoundError")' \
  --limit=10 \
  --project=perkieprints-processing
```

## INFRASTRUCTURE HARDENING PLAN

### 1. Health Check Enhancement
Create separate health endpoints for container vs model readiness:

**File**: `backend/inspirenet-api/src/main.py`
```python
# Container health (always returns if container is running)
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "container": "ready",
        "timestamp": datetime.utcnow().isoformat()
    }

# Model readiness (returns 503 if model not loaded)
@app.get("/ready")
async def readiness_check():
    if not processor or not processor.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model loading, retry in 30s",
            headers={"Retry-After": "30"}
        )
    return {"status": "ready", "model": "loaded"}
```

### 2. Graceful Model Loading
Implement lazy loading with proper error handling:

**File**: `backend/inspirenet-api/src/inspirenet_processor.py`
```python
class InspirenetProcessor:
    def __init__(self):
        self.model = None
        self.model_loaded = False
        self.loading_error = None

    async def ensure_model_loaded(self):
        if self.model_loaded:
            return True

        try:
            print("Starting model load...")
            self.model = load_model()  # Your existing load logic
            self.model_loaded = True
            print("Model loaded successfully")
            return True
        except Exception as e:
            self.loading_error = str(e)
            print(f"Model loading failed: {e}")
            raise HTTPException(503, f"Model unavailable: {e}")
```

### 3. Deployment Configuration Updates
**File**: `backend/inspirenet-api/deploy-production-clean.yaml`
```yaml
spec:
  template:
    spec:
      containers:
      - image: IMAGE_URL
        resources:
          limits:
            cpu: "8"
            memory: "32Gi"
            nvidia.com/gpu: "1"
        startupProbe:
          httpGet:
            path: /health  # Container health only
            port: 8080
          initialDelaySeconds: 10
          timeoutSeconds: 5
          periodSeconds: 10
          failureThreshold: 10  # 100 seconds total
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready  # Model readiness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 20
          timeoutSeconds: 10
```

### 4. Blue-Green Deployment Script
**File**: `backend/inspirenet-api/scripts/safe-deploy.sh`
```bash
#!/bin/bash
SERVICE="inspirenet-bg-removal-api"
REGION="us-central1"
PROJECT="perkieprints-processing"

# Deploy new revision without traffic
echo "Deploying new revision..."
NEW_REVISION=$(gcloud run deploy $SERVICE \
  --source . \
  --region $REGION \
  --project $PROJECT \
  --no-traffic \
  --format="value(metadata.name)")

echo "New revision: $NEW_REVISION"

# Test new revision
echo "Testing new revision health..."
NEW_URL=$(gcloud run services describe $SERVICE \
  --region $REGION \
  --project $PROJECT \
  --format="value(status.address.url)")

HEALTH_CHECK="${NEW_URL}/health"
for i in {1..10}; do
  if curl -f "$HEALTH_CHECK" > /dev/null 2>&1; then
    echo "Health check passed"
    break
  fi
  echo "Waiting for health check... ($i/10)"
  sleep 10
done

# Gradually shift traffic
echo "Shifting 10% traffic to new revision..."
gcloud run services update-traffic $SERVICE \
  --to-revisions=$NEW_REVISION=10 \
  --region $REGION \
  --project $PROJECT

echo "Monitor for 5 minutes..."
sleep 300

# Check error rate
ERROR_COUNT=$(gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND \
   resource.labels.revision_name=\"$NEW_REVISION\" AND \
   severity>=ERROR" \
  --limit=10 \
  --format="value(textPayload)" \
  --project=$PROJECT | wc -l)

if [ $ERROR_COUNT -gt 5 ]; then
  echo "High error rate detected, rolling back..."
  gcloud run services update-traffic $SERVICE \
    --to-revisions=$NEW_REVISION=0 \
    --region $REGION \
    --project $PROJECT
  exit 1
fi

# Complete migration
echo "No errors detected, shifting 100% traffic..."
gcloud run services update-traffic $SERVICE \
  --to-revisions=$NEW_REVISION=100 \
  --region $REGION \
  --project $PROJECT

echo "Deployment complete!"
```

## MONITORING SETUP

### 1. Uptime Monitoring
```bash
# Create uptime check
gcloud monitoring uptime-checks create api-health \
  --resource-type=cloud-run \
  --service=inspirenet-bg-removal-api \
  --location=us-central1 \
  --project=perkieprints-processing \
  --check-interval=60s \
  --timeout=10s \
  --path=/health
```

### 2. Alert Policy
```bash
# Create alert for API failures
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="API Health Check Failure" \
  --condition="resource.type=\"cloud_run_revision\" AND \
               metric.type=\"run.googleapis.com/request_count\" AND \
               metric.label.response_code_class=\"5xx\" AND \
               metric.value > 10" \
  --project=perkieprints-processing
```

### 3. Dashboard Creation
Create monitoring dashboard with:
- Request count and latency
- Error rate (5xx responses)
- Container CPU/Memory usage
- GPU utilization
- Model loading time
- Cold start frequency

## COST OPTIMIZATION MAINTAINED

**Critical Constraint**: Keep `min-instances: 0` to avoid $65-100/day idle GPU costs

### Warming Strategy (Instead of min-instances)
```javascript
// Frontend warming on page load
async function warmupAPI() {
  try {
    await fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup', {
      method: 'POST',
      mode: 'no-cors'  // Fire and forget
    });
  } catch (e) {
    // Ignore errors, this is best-effort
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', warmupAPI);
```

## VERIFICATION CHECKLIST

### Immediate (After Rollback)
- [ ] Health endpoint returns 200 OK
- [ ] CORS headers present in OPTIONS response
- [ ] Customer can upload and process images
- [ ] No 500 errors in logs

### Short-term (Within 24 hours)
- [ ] Implement separate health/ready endpoints
- [ ] Add comprehensive error logging
- [ ] Set up monitoring alerts
- [ ] Document rollback procedure

### Long-term (Within 1 week)
- [ ] Implement blue-green deployment
- [ ] Add automatic rollback on high error rate
- [ ] Create runbook for common issues
- [ ] Load test with realistic traffic

## EMERGENCY CONTACTS

- **Google Cloud Support**: [Create P1 ticket if needed]
- **On-call Engineer**: [Your contact]
- **Business Stakeholder**: [Contact for impact updates]

## LESSONS LEARNED

1. **Container health ≠ Application readiness** - Separate endpoints needed
2. **CORS errors often mask deeper issues** - Check basic health first
3. **Cloud Run "Ready" status is misleading** - Can show ready while container fails
4. **min-instances=0 is non-negotiable** - Use warming instead of always-on
5. **Rollback must be immediate option** - Keep 2-3 known good revisions

---

**Next Immediate Action**: Execute Step 1-3 NOW to restore service. Investigation can happen after recovery.