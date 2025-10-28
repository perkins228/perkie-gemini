# Gemini Artistic API - Testing Guide

**Service URL**: https://gemini-artistic-api-753651513695.us-central1.run.app
**Status**: ✅ Deployed & Operational
**Last Verified**: 2025-10-24

---

## Quick Start Testing

### Option 1: Visual Testing (Recommended)

**Open the test page in your browser**:
```bash
# Navigate to the test page
cd backend/gemini-artistic-api
# Open test_api.html in your default browser
start test_api.html   # Windows
# or
open test_api.html    # Mac
# or
xdg-open test_api.html  # Linux
```

**Features**:
- ✅ Drag & drop pet photo upload
- ✅ Visual style selection (3 styles)
- ✅ Real-time API status indicator
- ✅ Side-by-side comparison view
- ✅ Processing time display
- ✅ Cache hit detection
- ✅ Quota tracking

---

## Option 2: Command Line Testing

### 1. Health Check (Instant)

```bash
curl -s https://gemini-artistic-api-753651513695.us-central1.run.app/health | python -m json.tool
```

**Expected Response**:
```json
{
    "status": "healthy",
    "model": "gemini-2.5-flash-image",
    "timestamp": "2025-10-24T00:57:12.399536"
}
```

---

### 2. Quota Check (Instant)

```bash
curl -s "https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/quota?session_id=test_user_001" | python -m json.tool
```

**Expected Response**:
```json
{
    "allowed": true,
    "remaining": 3,
    "limit": 3,
    "reset_time": "2025-10-25T00:00:00"
}
```

---

### 3. Image Generation Test

**Prerequisites**:
1. Have a pet photo ready (JPG or PNG)
2. Convert to base64 format

**Convert image to base64**:
```bash
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\pet.jpg")) | Set-Clipboard

# Mac/Linux
base64 path/to/pet.jpg | pbcopy
```

**Test Black & White Fine Art**:
```bash
curl -X POST "https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,<YOUR_BASE64_HERE>",
    "style": "bw_fine_art",
    "session_id": "test_user_001"
  }'
```

**Test Ink & Wash**:
```bash
curl -X POST "https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,<YOUR_BASE64_HERE>",
    "style": "ink_wash",
    "session_id": "test_user_001"
  }'
```

**Test Charcoal Realism**:
```bash
curl -X POST "https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,<YOUR_BASE64_HERE>",
    "style": "charcoal_realism",
    "session_id": "test_user_001"
  }'
```

**Expected Response** (success):
```json
{
  "success": true,
  "image_url": "https://storage.googleapis.com/...",
  "original_url": "https://storage.googleapis.com/...",
  "style": "bw_fine_art",
  "cache_hit": false,
  "quota_remaining": 2,
  "quota_limit": 3,
  "processing_time_ms": 3847
}
```

---

## Testing Scenarios

### Scenario 1: First-Time User (Session-Based)
**Goal**: Verify rate limiting for anonymous users

1. **Request 1** (should succeed):
   - session_id: "test_session_001"
   - Expected: quota_remaining = 2

2. **Request 2** (should succeed):
   - session_id: "test_session_001"
   - Expected: quota_remaining = 1

3. **Request 3** (should succeed):
   - session_id: "test_session_001"
   - Expected: quota_remaining = 0

4. **Request 4** (should FAIL with 429):
   - session_id: "test_session_001"
   - Expected: HTTP 429 "Rate limit exceeded"

---

### Scenario 2: Cache Hit Detection
**Goal**: Verify image deduplication saves quota

1. **First request** with a specific image:
   - Expected: cache_hit = false
   - Expected: quota consumed (remaining decreases)

2. **Second request** with SAME image + SAME style:
   - Expected: cache_hit = true
   - Expected: quota NOT consumed (remaining stays same)
   - Expected: processing_time_ms ≈ 0 (instant)

---

### Scenario 3: Multi-Style Testing
**Goal**: Verify all 3 styles work correctly

1. Upload same pet photo
2. Generate with "bw_fine_art"
3. Generate with "ink_wash"
4. Generate with "charcoal_realism"
5. **Verify**: All 3 styles create distinct artistic interpretations
6. **Verify**: All 3 are headshot-framed (not full body)

---

### Scenario 4: Multi-Pet Handling
**Goal**: Test headshot framing logic

**Test Images Needed**:
1. **Two pets touching** → Should create group headshot
2. **Two pets separated, both clear** → Should create group headshot
3. **Two pets, one blurry** → Should select clearest pet

---

## Performance Benchmarks

### Expected Latency

| Scenario | Expected Time | Acceptable? |
|----------|---------------|-------------|
| Health check | < 500ms | ✅ |
| Quota check | < 1s | ✅ |
| Cold start (first request) | 5-15s | ✅ (testsite) |
| Warm request | 2-5s | ✅ |
| Cache hit | < 500ms | ✅ |

### Cost Tracking

**Test Budget**: $1/day during testing phase
- ~25 image generations = $0.98
- Monitor actual costs in GCP billing

---

## Monitoring & Troubleshooting

### Check Cloud Run Logs

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --limit 50 \
  --project=gen-lang-client-0601138686 \
  --format=json

# Stream live logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --project=gen-lang-client-0601138686
```

### Check Firestore Rate Limiting

```bash
# View rate limit documents (requires Firestore access)
gcloud firestore collections list --project=gen-lang-client-0601138686
```

### Check Cloud Storage

```bash
# List generated images
gsutil ls gs://perkieprints-processing-cache/generated/

# Check bucket size
gsutil du -s gs://perkieprints-processing-cache/
```

---

## Common Issues & Solutions

### Issue: "Rate limit exceeded" on first request
**Solution**: Reset Firestore rate limit document or use new session_id

### Issue: Slow response times (> 10s)
**Cause**: Cold start (expected behavior)
**Solution**: Wait for warm-up, subsequent requests will be faster

### Issue: 500 Internal Server Error
**Check**:
1. Cloud Run logs for error details
2. Gemini API key is valid
3. Firestore is initialized
4. Secret Manager permissions

### Issue: Generated image is full body, not headshot
**Cause**: Prompt not being followed correctly
**Action**: Report with image URL for prompt tuning

### Issue: CORS error in browser
**Check**: Verify your domain is in CORS whitelist (main.py line 37)

---

## Testing Checklist

### Immediate Tests (30 minutes)
- [x] ✅ Health endpoint responding
- [x] ✅ Quota endpoint responding
- [ ] Test Black & White Fine Art style
- [ ] Test Modern Ink & Wash style
- [ ] Test Charcoal Realism style
- [ ] Verify rate limiting (4th request = 429)
- [ ] Verify cache hits work correctly
- [ ] Check Cloud Storage uploads
- [ ] Monitor Cloud Run logs

### Performance Tests (24 hours)
- [ ] Measure cold start latency
- [ ] Measure warm request latency
- [ ] Test with various image sizes (50KB - 10MB)
- [ ] Test multi-pet handling (touching)
- [ ] Test multi-pet handling (separated)
- [ ] Verify cost accumulation

### Integration Tests (Week 2)
- [ ] Shopify staging integration
- [ ] Mobile device testing
- [ ] Cross-browser compatibility
- [ ] Session management integration
- [ ] Error handling UI

---

## Success Criteria

**Pass Criteria** (proceed to frontend integration):
- ✅ All 3 styles generate successfully
- ✅ Generated images are headshot-framed
- ✅ Rate limiting works (429 after quota exhausted)
- ✅ Cache hits return instantly (< 1s)
- ✅ Warm response time < 5 seconds
- ✅ No 500 errors in logs
- ✅ Daily cost < $1 during testing

**If any fail**:
1. Document the issue
2. Check agent recommendations (.claude/doc/)
3. Implement recommended optimizations
4. Re-test

---

## Next Steps After Testing

### Week 2: Frontend Integration
1. Create `assets/artistic-styles.js` (ES5 compatible)
2. Build Portrait Styles UI component
3. Add to `sections/ks-pet-bg-remover.liquid`
4. Mobile carousel implementation
5. Test on Shopify staging

### Week 3: Optimization
1. Add image preprocessing (20% cost savings)
2. Adjust temperature 0.7 → 0.4 (consistency)
3. Implement retry logic
4. Add ML monitoring
5. Quality validation checks

### Week 4: A/B Testing
1. Deploy to testsite theme
2. Configure analytics tracking
3. 30-day test: Control vs Treatment
4. Success metrics: +3% conversion OR +5% AOV

---

## Support & Resources

**Documentation**:
- Full implementation: `GEMINI_ARTISTIC_API_IMPLEMENTATION.md`
- API reference: `README.md`
- Infrastructure review: `.claude/doc/gemini-api-deployment-infrastructure-review.md`
- CV/ML review: `.claude/doc/gemini-api-cv-ml-production-review.md`

**Monitoring**:
- Cloud Run: https://console.cloud.google.com/run?project=gen-lang-client-0601138686
- Billing: https://console.cloud.google.com/billing?project=gen-lang-client-0601138686
- Logs: https://console.cloud.google.com/logs?project=gen-lang-client-0601138686

**Emergency Rollback**:
```bash
gcloud run services delete gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

---

**Happy Testing!** 🎨🐾
