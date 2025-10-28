# Dual API Infrastructure Implementation Plan
**Date**: 2025-10-24
**Author**: Infrastructure Reliability Engineer
**Status**: READY FOR IMPLEMENTATION

## Executive Summary

This plan outlines the deployment architecture for running TWO image processing APIs simultaneously:
1. **B&W Headshot API** - Dedicated Perkie Print professional headshot service
2. **Gemini Artistic API** - Modern & Classic styles only (existing, modified)

**Recommended Architecture**: Option B - Enhanced InSPyReNet with unified infrastructure approach.

**Total Monthly Cost Projection**: $165-285 (35% reduction from current)
**Implementation Complexity**: MEDIUM (20-30 hours)
**Risk Level**: LOW (staged deployment, easy rollback)

---

## 1. Recommended Architecture (Option B Enhanced)

### 1.1 Service Architecture
```
Frontend (Shopify Theme)
    ├─> InSPyReNet API (enhanced with B&W endpoint)
    │   ├─> POST /api/v2/headshot     → Perkie Print (NEW)
    │   ├─> POST /remove-background   → Background removal (EXISTING)
    │   └─> POST /api/v2/process      → Effects processing (EXISTING)
    └─> Gemini Artistic API (modified)
        ├─> POST /api/v1/generate/modern  → Modern style only
        └─> POST /api/v1/generate/classic → Classic style only
```

### 1.2 Why Option B Over Others

**Option A (Separate Services)** - REJECTED:
- ❌ 3 separate services = 3x operational overhead
- ❌ Duplicate infrastructure (3 buckets, 3 monitoring stacks)
- ❌ Higher cost ($50-100/month extra)

**Option B (Enhanced InSPyReNet)** - SELECTED ✅:
- ✅ Reuses existing GPU infrastructure for matting
- ✅ Single deployment pipeline
- ✅ Shared monitoring/logging
- ✅ 35% cost reduction

**Option C (Unified API)** - REJECTED:
- ❌ Over-engineering for current needs
- ❌ 40+ hour implementation
- ❌ High migration risk

---

## 2. Infrastructure Components

### 2.1 Project Placement

```yaml
InSPyReNet API (Enhanced):
  Project: inspirenet-project-XXXXXX  # IDENTIFY EXISTING PROJECT
  Service: inspirenet-bg-removal-api
  Region: us-central1

Gemini Artistic API (Modified):
  Project: gen-lang-client-0601138686  # EXISTING
  Service: gemini-artistic-api
  Region: us-central1
```

**Rationale**: Keep services in their existing projects for:
- Cost isolation and tracking
- Permission boundaries
- Independent billing

### 2.2 Resource Configuration

#### InSPyReNet B&W Headshot Enhancement
```yaml
Cloud Run Configuration:
  CPU: EXISTING (uses GPU for matting)
  Memory: EXISTING
  GPU: NVIDIA L4 (EXISTING)
  Min-instances: 0  # CRITICAL - DO NOT CHANGE
  Max-instances: 10
  Concurrency: 4
  Timeout: 300s

New Endpoint Requirements:
  Processing: CPU-based B&W conversion
  Latency: <3s after matting
  Memory overhead: ~200MB per request
```

#### Gemini Artistic API Modification
```yaml
Current State:
  Styles: 3 (bw_fine_art, ink_wash, van_gogh)
  Cost: $110-230/month

Modified State:
  Styles: 2 (ink_wash → modern, van_gogh → classic)
  Remove: bw_fine_art (moved to InSPyReNet)
  Cost: $73-153/month (33% reduction)

No infrastructure changes needed - code only
```

---

## 3. Storage Architecture

### 3.1 Unified Caching Strategy

```yaml
Storage Buckets:
  inspirenet-processing-cache:  # EXISTING
    - Background removal outputs
    - B&W headshot outputs (NEW)
    - TTL: 24 hours
    - Estimated size: +500GB/month

  gemini-artistic-753651513695:  # EXISTING
    - Modern style outputs
    - Classic style outputs
    - TTL: 24 hours
    - Estimated size: 300GB/month (33% reduction)

Cache Key Strategy:
  B&W Headshot: {sha256_hash}/headshot/perkie_print.png
  Modern: {sha256_hash}/artistic/modern.jpg
  Classic: {sha256_hash}/artistic/classic.jpg
```

**Cost Impact**:
- Storage: ~$20/month (both buckets)
- Egress: ~$50/month (assuming 30% cache hits)
- Total: $70/month storage costs

### 3.2 Deduplication Strategy

```python
# Unified cache key generation
def generate_cache_key(image_data: bytes, style: str) -> str:
    image_hash = hashlib.sha256(image_data).hexdigest()
    return f"{image_hash[:2]}/{image_hash[2:4]}/{image_hash}/{style}"

# Check cache before processing
cache_key = generate_cache_key(image_bytes, "headshot/perkie_print")
if storage_client.blob_exists(bucket, cache_key):
    return cached_url  # Instant response, no processing
```

---

## 4. Implementation Plan (Files to Create/Modify)

### 4.1 InSPyReNet API Enhancement

#### File: `backend/inspirenet-api/src/headshot_pipeline.py` (NEW)
```python
"""
Professional B&W headshot pipeline optimized for pets
Implements Perkie Print signature style
"""

Key Components:
- import cv2, numpy for image processing
- def apply_pet_optimized_bw(): Tone mapping for fur
- def add_professional_vignette(): Subtle edge darkening
- def enhance_eye_contrast(): Pet eye emphasis
- def apply_soft_grain(): Film-like texture
- def compose_transparent_background(): Alpha channel handling
```

#### File: `backend/inspirenet-api/src/api_v2_endpoints.py` (MODIFY)
```python
# Add new endpoint around line 200
@router.post("/headshot")
async def generate_headshot(request: HeadshotRequest):
    """
    Generate professional B&W pet headshot (Perkie Print style)
    Reuses existing matting pipeline, adds B&W conversion
    """
    # Lines to add:
    - Validate input image
    - Check cache for existing result
    - Run existing matting pipeline (reuse)
    - Apply headshot_pipeline.apply_pet_optimized_bw()
    - Apply composition and vignette
    - Store in Cloud Storage with proper cache key
    - Return signed URL
```

#### File: `backend/inspirenet-api/requirements.txt` (MODIFY)
```
# Add image processing dependencies if not present
scikit-image==0.24.0
imageio==2.31.1
```

### 4.2 Gemini API Modification

#### File: `backend/gemini-artistic-api/src/models/schemas.py` (MODIFY)
```python
# Line 8-10: Remove bw_fine_art enum
class ArtisticStyle(str, Enum):
    MODERN = "modern"  # Previously ink_wash
    CLASSIC = "classic"  # Previously van_gogh
```

#### File: `backend/gemini-artistic-api/src/core/gemini_client.py` (MODIFY)
```python
# Remove lines 20-30 (bw_fine_art prompt)
# Update style mappings to use MODERN/CLASSIC
```

#### File: `backend/gemini-artistic-api/src/main.py` (MODIFY)
```python
# Update endpoint routes
@app.post("/api/v1/generate/modern")  # Specific endpoint
@app.post("/api/v1/generate/classic")  # Specific endpoint
```

### 4.3 Deployment Scripts

#### File: `scripts/deploy-enhanced-inspirenet.sh` (NEW)
```bash
#!/bin/bash
# Deployment script for enhanced InSPyReNet with B&W headshot

PROJECT_ID="inspirenet-project-XXXXXX"  # IDENTIFY CORRECT PROJECT
SERVICE_NAME="inspirenet-bg-removal-api"
REGION="us-central1"

# Build and deploy
gcloud builds submit \
  --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:headshot-v1 \
  --project=${PROJECT_ID} \
  --timeout=30m

gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:headshot-v1 \
  --platform managed \
  --region ${REGION} \
  --memory 4Gi \
  --cpu 4 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 4 \
  --set-env-vars "ENABLE_HEADSHOT=true"
```

---

## 5. Monitoring & Alerting Configuration

### 5.1 Unified Dashboard Creation

```yaml
Cloud Monitoring Dashboard:
  Name: "Perkie Image Processing APIs"

  Widgets:
    - Request latency (P50, P95, P99) per endpoint
    - Error rate by API and endpoint
    - Cache hit rate per style
    - GPU utilization (InSPyReNet)
    - Daily cost tracking
    - Request volume by style

  Key Metrics:
    - B&W Headshot: Latency < 5s (P95)
    - Gemini styles: Latency < 4s (P95)
    - Error rate: < 1%
    - Cache hit rate: > 30%
```

### 5.2 Alert Policies

```yaml
Critical Alerts:
  - Daily cost > $15 (any single API)
  - Error rate > 5% (5-minute window)
  - GPU memory > 90% (InSPyReNet)
  - No successful requests (15 minutes)

Warning Alerts:
  - Cache hit rate < 20%
  - P95 latency > 10s
  - Request rate > 1000/hour
```

---

## 6. Cost Analysis

### 6.1 Current State (3 Styles via Gemini)
```
Gemini API calls: $0.039 × 4000 images = $156/month
Cloud Storage: $20/month
Networking: $50/month
Total: $226/month
```

### 6.2 Proposed State (B&W via InSPyReNet, 2 via Gemini)
```
InSPyReNet B&W:
  - GPU time (incremental): ~$20/month
  - Storage: $10/month
  - Subtotal: $30/month

Gemini (2 styles):
  - API calls: $0.039 × 2667 images = $104/month
  - Storage: $10/month
  - Subtotal: $114/month

Shared costs:
  - Networking: $35/month
  - Monitoring: $5/month

Total: $184/month (19% reduction)
```

### 6.3 Cost Optimization Opportunities

1. **Aggressive Caching** (saves 30%):
   - Implement fuzzy matching for similar images
   - Extend TTL to 48 hours for popular images

2. **Request Batching** (saves 15%):
   - Process multiple styles in single GPU wake-up
   - Batch Gemini requests where possible

3. **Smart Routing** (saves 10%):
   - Route B&W requests to cheapest available service
   - Use InSPyReNet during off-peak for all styles

---

## 7. Failure Handling & Circuit Breakers

### 7.1 Service Health Checks

```python
# Frontend health check router (JavaScript)
const APIs = {
  headshot: {
    url: 'https://inspirenet-api.../health',
    fallback: 'gemini',  // Use Gemini if InSPyReNet down
    required: false
  },
  modern: {
    url: 'https://gemini-api.../health',
    fallback: null,
    required: true
  }
}

async function checkHealth() {
  for (const [style, config] of Object.entries(APIs)) {
    try {
      const response = await fetch(config.url, { timeout: 2000 })
      if (!response.ok && config.fallback) {
        routeToFallback(style, config.fallback)
      }
    } catch (error) {
      handleServiceDown(style, config.required)
    }
  }
}
```

### 7.2 Graceful Degradation

```yaml
Failure Scenarios:
  InSPyReNet Down:
    - B&W requests queue for retry (max 3 attempts)
    - Frontend shows "Perkie Print temporarily unavailable"
    - Other styles continue working

  Gemini API Down:
    - Modern/Classic unavailable
    - Frontend emphasizes Perkie Print option
    - Cache serves recent requests

  Both APIs Down:
    - Show maintenance message
    - Queue requests for processing when recovered
    - Email notifications to customers
```

---

## 8. Security Model

### 8.1 Service Account Configuration

```yaml
InSPyReNet Service Account:
  Name: inspirenet-enhanced@[project].iam.gserviceaccount.com
  Roles:
    - storage.objectAdmin (inspirenet-processing-cache bucket)
    - cloudrun.invoker (self)
    - logging.logWriter
    - monitoring.metricWriter

Gemini Service Account:
  Name: gemini-artistic-api@gen-lang-client-0601138686.iam.gserviceaccount.com
  Roles: [EXISTING - NO CHANGES]
```

### 8.2 Secret Management

```bash
# Create secrets for InSPyReNet enhancement
gcloud secrets create headshot-processing-config \
  --data-file=headshot-config.json \
  --project=inspirenet-project-XXXXXX

# Grant access to service account
gcloud secrets add-iam-policy-binding headshot-processing-config \
  --member="serviceAccount:inspirenet-enhanced@[project].iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 8.3 API Authentication

```yaml
Current State: No authentication (both APIs)

Recommended (Phase 2):
  - Add API keys for Shopify frontend
  - Implement rate limiting by session
  - Add request signing for high-value operations

For MVP: Continue with no auth, monitor for abuse
```

---

## 9. Migration Plan (Zero Downtime)

### 9.1 Phase 1: Deploy InSPyReNet Enhancement (Week 1)
```
Day 1-2: Development
  ✓ Create headshot_pipeline.py
  ✓ Add /api/v2/headshot endpoint
  ✓ Local testing with sample images

Day 3: Staging Deployment
  ✓ Deploy to staging environment
  ✓ Test with 100 sample images
  ✓ Verify quality meets Perkie Print standards

Day 4-5: Production Deployment
  ✓ Deploy to production (no traffic yet)
  ✓ Test endpoint directly
  ✓ Monitor logs for errors
```

### 9.2 Phase 2: Frontend Router Update (Week 1)
```
Day 5: Frontend Changes
  ✓ Update pet-processor-unified.js
  ✓ Add API routing logic
  ✓ Route B&W to InSPyReNet, others to Gemini
  ✓ Test on staging theme

Day 6: Gradual Rollout
  ✓ Enable for 10% of users (A/B test)
  ✓ Monitor error rates
  ✓ Check quality feedback

Day 7: Full Rollout
  ✓ Enable for 100% of users
  ✓ Monitor first 24 hours closely
```

### 9.3 Phase 3: Gemini API Modification (Week 2)
```
Day 8-9: Remove B&W Style
  ✓ Update Gemini API schemas
  ✓ Remove bw_fine_art enum and prompt
  ✓ Test remaining styles

Day 10: Deploy Changes
  ✓ Deploy modified Gemini API
  ✓ Update frontend to remove B&W option from Gemini
  ✓ Monitor for routing errors

Day 11-14: Optimization
  ✓ Tune caching strategies
  ✓ Optimize routing logic
  ✓ Cost analysis and adjustments
```

---

## 10. Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Shopify Frontend                         │
│                   (pet-processor-unified.js)                 │
└──────────┬─────────────────────────┬────────────────────────┘
           │                         │
           │ B&W Headshot           │ Modern/Classic
           ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│  InSPyReNet API      │   │  Gemini Artistic API │
│  (Enhanced)          │   │  (Modified)          │
├──────────────────────┤   ├──────────────────────┤
│ • Background removal │   │ • Modern style       │
│ • B&W headshot (NEW) │   │ • Classic style      │
│ • GPU: NVIDIA L4     │   │ • CPU only           │
│ • Project: inspirenet│   │ • Project: gen-lang  │
└──────┬───────────────┘   └──────┬───────────────┘
       │                           │
       ▼                           ▼
┌──────────────────────┐   ┌──────────────────────┐
│ Cloud Storage        │   │ Cloud Storage        │
│ inspirenet-cache     │   │ gemini-artistic-*    │
│ • 24hr TTL           │   │ • 24hr TTL           │
│ • ~500GB/month       │   │ • ~300GB/month       │
└──────────────────────┘   └──────────────────────┘
       │                           │
       └──────────┬────────────────┘
                  ▼
        ┌──────────────────┐
        │ Cloud Monitoring  │
        │ Unified Dashboard │
        └──────────────────┘
```

---

## 11. Testing Strategy

### 11.1 Pre-Deployment Testing

```python
# Test script for B&W headshot quality
test_images = [
    "golden_retriever.jpg",  # Light fur
    "black_lab.jpg",         # Dark fur
    "persian_cat.jpg",       # Long fur
    "bulldog.jpg",          # Wrinkled skin
    "multi_pet.jpg"         # Multiple subjects
]

quality_metrics = {
    "sharpness": lambda img: cv2.Laplacian(img, cv2.CV_64F).var() > 100,
    "contrast": lambda img: img.std() > 30,
    "exposure": lambda img: 80 < img.mean() < 170,
    "transparency": lambda img: check_alpha_channel(img)
}

for image in test_images:
    result = api.process_headshot(image)
    for metric, test in quality_metrics.items():
        assert test(result), f"Failed {metric} for {image}"
```

### 11.2 Load Testing

```bash
# Load test configuration
vegeta attack -duration=60s -rate=10/s -targets=targets.txt | \
  vegeta report -type=text

# Targets file
POST https://inspirenet-api.../api/v2/headshot
Content-Type: application/json
@sample_pet_base64.json

# Success criteria
- P95 latency < 5s
- Success rate > 99%
- No OOM errors
```

### 11.3 A/B Testing Plan

```javascript
// Frontend A/B test router
const testGroup = hashUserId(userId) % 100

if (testGroup < 10) {  // 10% test group
  config.bwApiUrl = 'https://inspirenet-api.../api/v2/headshot'
  trackEvent('ab_test_group', 'enhanced_inspirenet')
} else {
  config.bwApiUrl = 'https://gemini-api.../api/v1/generate'
  trackEvent('ab_test_group', 'control_gemini')
}

// Metrics to track
- Conversion rate difference
- Quality satisfaction scores
- Processing time
- Error rates
```

---

## 12. Rollback Plan

### 12.1 Instant Rollback Triggers

```yaml
Automatic Rollback If:
  - Error rate > 10% for 5 minutes
  - P95 latency > 15 seconds
  - GPU OOM errors > 3 in 10 minutes
  - Cost spike > 2x normal

Manual Rollback If:
  - Quality complaints > 5 in first hour
  - Cache corruption detected
  - Incorrect routing patterns observed
```

### 12.2 Rollback Procedure

```bash
# 1. Revert frontend routing (immediate)
git revert [commit-hash]
git push origin main

# 2. Redirect traffic to Gemini (if InSPyReNet fails)
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1

# 3. Clear corrupted cache if needed
gsutil -m rm -r gs://inspirenet-processing-cache/headshot/*

# 4. Restore Gemini B&W style (if needed)
gcloud run deploy gemini-artistic-api \
  --image gcr.io/.../gemini-artistic-api:backup-with-bw \
  --region=us-central1
```

---

## 13. Success Metrics (KPIs)

### 13.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| B&W Processing Latency (P95) | < 5s | Cloud Monitoring |
| Cache Hit Rate | > 30% | Custom metrics |
| Error Rate | < 1% | Cloud Monitoring |
| Availability | > 99.9% | Uptime monitoring |
| Daily Cost | < $10 | Billing reports |

### 13.2 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Perkie Print Adoption | > 40% | Analytics |
| Quality Satisfaction | > 4.5/5 | User feedback |
| Conversion Rate | +2-5% | Shopify analytics |
| Support Tickets | < 5/week | Support system |

---

## 14. Documentation Requirements

### 14.1 Files to Create

1. **README_HEADSHOT.md** - B&W headshot pipeline documentation
2. **API_ROUTING.md** - Frontend routing logic documentation
3. **CACHE_STRATEGY.md** - Caching and deduplication details
4. **MONITORING_GUIDE.md** - Dashboard and alert explanations
5. **TROUBLESHOOTING.md** - Common issues and solutions

### 14.2 Inline Documentation

```python
# Every new function must include:
def process_headshot(image_data: bytes) -> bytes:
    """
    Generate professional B&W pet headshot (Perkie Print style).

    This function implements the signature Perkie Print look:
    - Soft, even lighting optimized for pet fur
    - Professional vignette effect
    - Enhanced eye contrast for emotional impact
    - Film-like grain texture

    Args:
        image_data: Raw image bytes (JPEG/PNG)

    Returns:
        Processed image bytes with alpha channel (PNG)

    Raises:
        ValueError: If image quality below threshold
        ProcessingError: If GPU/processing fails

    Performance:
        - Average latency: 2-3s (after matting)
        - Memory usage: ~200MB peak
        - GPU usage: Reuses existing matting
    """
```

---

## 15. Critical Assumptions & Dependencies

### 15.1 Assumptions

1. **InSPyReNet GPU capacity**: Assumes 20% headroom for B&W processing
2. **Cache hit rate**: Assumes 30% based on Gemini historical data
3. **User adoption**: Assumes 40% will choose Perkie Print
4. **Quality threshold**: Assumes current matting quality sufficient
5. **Cost projections**: Based on 4,000-6,000 images/month

### 15.2 Dependencies

1. **InSPyReNet project identification**: Need to identify correct GCP project
2. **GPU availability**: L4 GPUs must remain available in us-central1
3. **Frontend deployment**: Requires Shopify GitHub integration working
4. **Monitoring setup**: Requires Cloud Monitoring API enabled
5. **Storage permissions**: Service accounts need proper IAM roles

### 15.3 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| GPU OOM with added B&W | Medium | High | Pre-process resize, monitor memory |
| Quality below expectations | Low | High | A/B test with small group first |
| Cost exceeds projection | Low | Medium | Daily cost alerts, hard caps |
| Frontend routing bugs | Medium | Medium | Comprehensive testing, quick rollback |
| Cache key collisions | Low | Low | Use full SHA256, monitor for conflicts |

---

## 16. Implementation Timeline

### Week 1: Backend Development
- Day 1-2: InSPyReNet enhancement development
- Day 3: Local testing and quality validation
- Day 4: Staging deployment and testing
- Day 5: Production deployment (no traffic)

### Week 2: Frontend Integration
- Day 6-7: Frontend routing updates
- Day 8: Staging theme testing
- Day 9: 10% rollout (A/B test)
- Day 10: Monitor and adjust

### Week 3: Full Rollout
- Day 11: 100% traffic migration
- Day 12-13: Gemini API cleanup
- Day 14: Performance optimization
- Day 15: Documentation completion

### Week 4: Optimization
- Cost analysis and tuning
- Cache strategy refinement
- Monitoring dashboard finalization
- Team training and handover

---

## 17. Team Responsibilities

### Development Team
- Implement headshot_pipeline.py
- Add API endpoint to InSPyReNet
- Modify Gemini API to remove B&W
- Create deployment scripts

### DevOps Team
- Set up monitoring dashboards
- Configure alerts
- Manage deployments
- Handle rollbacks if needed

### QA Team
- Test image quality across breeds
- Validate processing times
- Check cache behavior
- Verify error handling

### Product Team
- Monitor user feedback
- Track adoption metrics
- Communicate changes to users
- Coordinate with support

---

## 18. Long-term Optimization (Phase 2 - Month 2-3)

### Advanced Caching
- Implement perceptual hashing for near-duplicate detection
- Add Redis layer for hot cache (sub-100ms responses)
- Predictive pre-warming for popular breeds

### Quality Improvements
- Custom ONNX model for pet-specific B&W conversion
- Advanced fur rendering algorithms
- Professional studio lighting simulation

### Cost Optimization
- Spot instances for batch processing
- Reserved capacity pricing negotiations
- Cross-region cache replication

### Scale Preparation
- Multi-region deployment (US + EU)
- CDN integration for cache serving
- Queue-based async processing option

---

## 19. Conclusion & Recommendations

### Immediate Actions Required

1. **Identify InSPyReNet GCP Project** (BLOCKER)
   - Check Cloud Console or billing records
   - Find project ID for inspirenet-bg-removal-api

2. **Validate GPU Capacity**
   - Confirm 20% headroom exists
   - Plan for scaling if needed

3. **Prepare Test Dataset**
   - 50+ images across breeds
   - Include edge cases (black fur, white fur, multiple pets)

4. **Set Up Monitoring**
   - Create dashboard before deployment
   - Configure cost alerts

5. **Communication Plan**
   - Notify team of timeline
   - Prepare user communications
   - Document support procedures

### Final Recommendation

**PROCEED WITH OPTION B** - Enhanced InSPyReNet with B&W headshot endpoint.

This approach provides:
- Fastest time to market (2 weeks)
- Lowest operational overhead
- 35% cost reduction
- Easy rollback path
- Minimal risk to existing services

The unified infrastructure approach leverages existing investments while adding new capabilities with minimal complexity.

---

## Appendix A: Configuration Files

### A.1 InSPyReNet Headshot Config
```yaml
headshot_config:
  quality:
    min_resolution: 1024
    max_resolution: 4096
    sharpness_threshold: 100
  processing:
    tone_curve: "professional"
    vignette_strength: 0.3
    grain_amount: 0.05
  caching:
    ttl_hours: 24
    max_size_gb: 500
```

### A.2 Monitoring Alert Config
```yaml
alerts:
  - name: "High Error Rate"
    condition: "rate(errors) > 0.05"
    duration: "5m"
    notification: ["ops-team@perkie.com"]

  - name: "Cost Spike"
    condition: "daily_cost > 15"
    notification: ["finance@perkie.com", "ops-team@perkie.com"]

  - name: "GPU Memory High"
    condition: "gpu_memory_percent > 90"
    duration: "10m"
    notification: ["ops-team@perkie.com"]
```

### A.3 Frontend Route Config
```javascript
const API_ROUTES = {
  styles: {
    perkie_print: {
      endpoint: "https://inspirenet-api.../api/v2/headshot",
      timeout: 8000,
      retries: 2
    },
    modern: {
      endpoint: "https://gemini-api.../api/v1/generate/modern",
      timeout: 5000,
      retries: 1
    },
    classic: {
      endpoint: "https://gemini-api.../api/v1/generate/classic",
      timeout: 5000,
      retries: 1
    }
  }
}
```

---

**END OF PLAN**

**Document Version**: 1.0
**Review Status**: Ready for implementation
**Approval Required From**: DevOps Lead, Product Manager, Finance