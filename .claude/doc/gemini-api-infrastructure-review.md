# Gemini Artistic API - Infrastructure & Reliability Review

**Date**: 2025-10-30
**Reviewer**: Infrastructure Reliability Engineer
**Project**: perkieprints-nanobanana (gen-lang-client-0601138686)
**Service**: gemini-artistic-api

## Executive Summary

**GO/NO-GO Recommendation**: **CONDITIONAL GO** ✅

The infrastructure is production-viable with 5 critical changes required before full deployment:
1. Move API key to Secret Manager
2. Implement proper monitoring/alerting
3. Add storage lifecycle policies
4. Create staging environment
5. Implement health check improvements

**Cost Projection**: $18-22/month (within acceptable range)
**Risk Level**: Medium (mitigable with recommended changes)

---

## 1. Cross-Project Dependencies Analysis

### Current Architecture
```
┌─────────────────────────┐     ┌─────────────────────────┐
│  perkieprints-processing│     │ gen-lang-client-0601138686│
│   (Production - OFF-LIMITS)    │    (Gemini API - New)     │
│                         │     │                         │
│  ┌──────────────────┐  │     │  ┌──────────────────┐  │
│  │InSPyReNet API    │  │     │  │Gemini Artistic   │  │
│  │(GPU Cloud Run)   │  │     │  │API (CPU Cloud Run)│  │
│  └──────────────────┘  │     │  └──────────────────┘  │
│           │            │     │           │            │
│           ▼            │     │           ▼            │
│  ┌──────────────────┐  │     │  ┌──────────────────┐  │
│  │Cloud Storage     │◄─┼─────┼──│Firestore         │  │
│  │perkieprints-     │  │     │  │(Rate Limiting)   │  │
│  │processing-cache  │  │     │  └──────────────────┘  │
│  └──────────────────┘  │     │                        │
└─────────────────────────┘     └─────────────────────────┘
```

### Risk Assessment

**CRITICAL RISK**: Shared storage bucket across projects
- **Issue**: `perkieprints-processing-cache` shared between production and test
- **Blast Radius**: Gemini API could accidentally delete/overwrite production data
- **Probability**: Low (different path prefixes)
- **Impact**: High (production data loss)

### Recommendation

**IMMEDIATE ACTION**: Create separate storage bucket for Gemini API
```bash
# Create dedicated bucket
gsutil mb -p gen-lang-client-0601138686 \
  -c STANDARD \
  -l us-central1 \
  gs://gemini-artistic-cache/

# Set lifecycle rules (30-day TTL)
gsutil lifecycle set lifecycle.json gs://gemini-artistic-cache/
```

**Lifecycle Configuration** (`lifecycle.json`):
```json
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {
        "age": 30,
        "matchesPrefix": ["cache/", "temp/"]
      }
    }]
  }
}
```

**Benefits**:
- Complete isolation from production
- Independent lifecycle management
- Clear cost attribution
- No cross-project IAM complexity

---

## 2. Cost Optimization Analysis

### Current Cost Breakdown

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Gemini API | $2-5 | 1000 images @ $0.002-0.005 per image |
| Cloud Run | $3-5 | CPU only, scale to zero |
| Firestore | $2-3 | Rate limiting data (minimal) |
| Cloud Storage | $1-2 | Cache storage with lifecycle |
| Network Egress | $5-8 | Depends on image sizes |
| **TOTAL** | **$13-23** | Within budget |

### Hidden Costs Identified

1. **Artifact Registry**: $0.10/GB/month (accumulates with each build)
   - **Solution**: Implement cleanup policy (keep last 5 images)

2. **Cloud Build**: $0.003/minute
   - **Solution**: Optimize Dockerfile for faster builds (multi-stage)

3. **Firestore Reads**: $0.06 per 100k reads
   - **Solution**: Implement local caching for quota checks

### Cost Optimization Recommendations

**1. Replace Firestore with Redis Memorystore** (Save $2/month)
```yaml
# Better for rate limiting (ephemeral data)
type: redis
tier: basic
memory: 1GB
cost: $0.016/GB/hour (~$12/month)
```
**Decision**: Keep Firestore for now (simpler, serverless)

**2. Optimize Container Image** (Save build costs)
```dockerfile
# Multi-stage build
FROM python:3.11-slim as builder
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.11-slim
COPY --from=builder /root/.local /root/.local
COPY src/ ./src/
```

**3. Implement Request Batching** (Save 30-50% on Gemini API)
- Batch multiple styles in single request
- Already planned in `/api/v1/batch-generate`

---

## 3. Scalability Analysis

### Current Configuration Review

```yaml
service: gemini-artistic-api
scaling:
  min-instances: 0      # ✅ Good for cost
  max-instances: 5      # ⚠️ May be low for spikes
resources:
  cpu: 2                # ✅ Appropriate
  memory: 2Gi           # ✅ Sufficient
  timeout: 300s         # ⚠️ Too generous
  concurrency: 80       # ✅ Default is fine
```

### Performance Characteristics

**Cold Start Analysis**:
- Python container: ~3-5 seconds
- Firestore init: ~1-2 seconds
- First request: ~5-7 seconds total
- **Acceptable?** YES (with proper UX feedback)

### Recommendations

**1. Adjust Scaling Parameters**:
```bash
gcloud run services update gemini-artistic-api \
  --max-instances=10 \
  --timeout=60 \
  --concurrency=100
```

**2. Implement Readiness Probe**:
```python
@app.get("/_ah/ready")
async def readiness():
    # Check Firestore connection
    # Check Gemini API availability
    return {"status": "ready"}
```

**3. Add Startup Optimization**:
```python
# Lazy load heavy dependencies
def get_gemini_client():
    global _client
    if _client is None:
        _client = genai.GenerativeModel(...)
    return _client
```

---

## 4. Reliability & Monitoring

### Current State: ❌ No Monitoring

### Required Monitoring Stack

**1. Application Metrics** (Cloud Monitoring)
```python
# Add to main.py
from google.cloud import monitoring_v3

metrics = {
    "request_latency": ["p50", "p95", "p99"],
    "gemini_api_latency": ["p50", "p95", "p99"],
    "error_rate": ["4xx", "5xx", "gemini_errors"],
    "cache_hit_rate": "percentage",
    "rate_limit_violations": "count",
    "daily_cost": "cumulative"
}
```

**2. Alerting Policy Configuration**
```yaml
alerts:
  - name: high-error-rate
    condition: error_rate > 5%
    duration: 5m
    notification: email, slack

  - name: cost-spike
    condition: daily_cost > $8
    notification: email, pagerduty

  - name: service-down
    condition: uptime_check_failure
    duration: 2m
    notification: pagerduty
```

**3. SLO Definition**
```yaml
slos:
  availability:
    target: 99.0%  # Reasonable for non-critical service
    measurement: successful_requests / total_requests

  latency:
    target: 95% requests < 10s
    measurement: latency_p95
```

**4. Dashboard Creation**
```bash
# Create custom dashboard
gcloud monitoring dashboards create \
  --config-from-file=dashboard.yaml
```

---

## 5. Security Review

### Critical Issues

**1. API Key in Code** ⚠️ **CRITICAL**
```python
# CURRENT (BAD)
gemini_api_key: str = "[REDACTED - See Secret Manager]"

# RECOMMENDED
from google.cloud import secretmanager

def get_api_key():
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_ID}/secrets/gemini-api-key/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")
```

**2. No Request Authentication**
- Current: `--allow-unauthenticated`
- Risk: Anyone can call API
- Recommendation: Implement API key validation or JWT

**3. CORS Configuration**
```python
# Add origin validation
origins = [
    "https://*.myshopify.com",
    "https://perkieprints.com",
    "http://localhost:3000"  # Dev only
]
```

### Security Implementation Plan

```bash
# Step 1: Store API key in Secret Manager
echo -n "YOUR_API_KEY" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Step 2: Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Step 3: Update deployment
gcloud run services update gemini-artistic-api \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

---

## 6. Disaster Recovery

### Current Gaps

1. **No Backup Strategy**
   - Firestore: No automated backups
   - Storage: No versioning enabled

2. **Single Region Deployment**
   - Risk: us-central1 outage affects service
   - Impact: Service unavailable

### DR Implementation

**1. Enable Firestore Backups**:
```bash
gcloud firestore databases update \
  --backup-schedule-config \
  --retention=7d \
  --daily-backup-time=03:00
```

**2. Storage Versioning** (for critical data):
```bash
gsutil versioning set on gs://gemini-artistic-cache/
```

**3. Multi-Region Consideration**:
- **Decision**: NOT NEEDED (non-critical service)
- Cold standby sufficient (redeploy in 10 minutes)

---

## 7. Deployment Strategy

### Current Issues
- Direct production deployment
- No staging environment
- Manual script execution
- No automated testing

### Recommended CI/CD Pipeline

**1. GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy Gemini API

on:
  push:
    branches: [main]
    paths:
      - 'backend/gemini-artistic-api/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend/gemini-artistic-api
          pip install -r requirements.txt
          pytest tests/

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          # Deploy to staging environment

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: |
          # Deploy with approval
```

**2. Staging Environment**:
```bash
# Create staging service
gcloud run deploy gemini-artistic-api-staging \
  --image $IMAGE \
  --min-instances 0 \
  --max-instances 2  # Lower limits for staging
```

**3. Canary Deployment**:
```bash
# Deploy with traffic splitting
gcloud run services update-traffic gemini-artistic-api \
  --to-revisions=LATEST=10  # 10% canary
```

---

## 8. Simplification Opportunities

### Over-Engineering Assessment

| Component | Current | Simplified Alternative | Recommendation |
|-----------|---------|----------------------|----------------|
| Firestore for rate limiting | Complex transactions | In-memory + Redis | **Keep Firestore** (serverless) |
| Artifact Registry | Private registry | Docker Hub | **Keep AR** (security) |
| Secret Manager | Secure but complex | Environment variables | **Use Secret Manager** (security) |
| Cloud Storage paths | Complex hierarchy | Simple flat structure | **Simplify paths** |

### Recommended Simplifications

**1. Simplify Storage Paths**:
```python
# Current (complex)
path = f"cache/{year}/{month}/{day}/{session}/{style}/{hash}.jpg"

# Simplified
path = f"cache/{hash[:2]}/{hash}.jpg"  # Sharded by first 2 chars
```

**2. Remove Unnecessary Abstraction**:
- Combine rate limiter into single module
- Merge storage manager with main logic
- Reduce configuration options

---

## Implementation Priority

### Phase 1: Security & Reliability (Week 1)
1. ✅ Move API key to Secret Manager
2. ✅ Create separate storage bucket
3. ✅ Implement basic monitoring
4. ✅ Add health check improvements

### Phase 2: Optimization (Week 2)
1. ✅ Set up GitHub Actions CI/CD
2. ✅ Create staging environment
3. ✅ Implement storage lifecycle
4. ✅ Optimize container image

### Phase 3: Enhancement (Week 3)
1. ✅ Add comprehensive alerting
2. ✅ Implement SLO tracking
3. ✅ Set up Firestore backups
4. ✅ Document runbooks

---

## Final Recommendations

### Must-Have Before Production
1. **API Key in Secret Manager** (security)
2. **Separate Storage Bucket** (isolation)
3. **Basic Monitoring** (visibility)
4. **Staging Environment** (safety)
5. **Alerting for Costs** (budget control)

### Nice-to-Have
1. Comprehensive SLO tracking
2. Automated canary deployments
3. Multi-region failover
4. Request authentication

### Cost Impact
- Current: $18-22/month
- With improvements: $20-25/month
- ROI: Worth the $2-3 increase for reliability

### Risk Assessment
- **Current Risk**: Medium-High
- **After Changes**: Low
- **Acceptable for Production**: YES (with changes)

---

## GO/NO-GO Decision

**CONDITIONAL GO** ✅

**Conditions**:
1. Implement Phase 1 security changes (1-2 days)
2. Set up basic monitoring (2-3 hours)
3. Create staging environment (1 hour)
4. Document incident response (1 hour)

**Timeline**: 3-4 days to production-ready

**Budget Impact**: Within acceptable range ($20-25/month)

**Business Value**: High (new revenue stream, better UX)

---

## Appendix: Quick Implementation Scripts

### A. Security Setup
```bash
#!/bin/bash
# setup-security.sh

# Create secret
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# Grant access
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service
gcloud run services update gemini-artistic-api \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest
```

### B. Monitoring Setup
```bash
#!/bin/bash
# setup-monitoring.sh

# Create uptime check
gcloud monitoring uptime-checks create \
  --display-name="Gemini API Health" \
  --resource-type="generic-node" \
  --hostname="gemini-artistic-api.run.app" \
  --path="/health"

# Create alert policy
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="5xx errors > 5%" \
  --condition-threshold-value=0.05
```

### C. Storage Setup
```bash
#!/bin/bash
# setup-storage.sh

# Create bucket
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://gemini-artistic-cache/

# Set CORS
cat > cors.json <<EOF
[{
  "origin": ["https://*.myshopify.com", "https://perkieprints.com"],
  "method": ["GET", "POST"],
  "maxAgeSeconds": 3600
}]
EOF
gsutil cors set cors.json gs://gemini-artistic-cache/

# Set lifecycle
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {"age": 30}
    }]
  }
}
EOF
gsutil lifecycle set lifecycle.json gs://gemini-artistic-cache/
```

---

**Document Version**: 1.0
**Next Review**: After Phase 1 implementation
**Contact**: infrastructure-reliability-engineer@perkieprints