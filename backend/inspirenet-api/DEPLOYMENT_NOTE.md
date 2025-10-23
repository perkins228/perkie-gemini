# Deployment Status - 2025-10-04

## Current Status
First deployment (revision 00094-lig) completed successfully with:
- ✅ CORS middleware configured with explicit origins
- ✅ Rate limiting middleware added (10 req/min per IP)
- ✅ Duplicate CORS middleware removed
- ✅ slowapi dependency added

## Remaining CORS Cleanup
Second deployment in progress to remove redundant wildcard CORS headers from:
- Explicit OPTIONS endpoint handlers (lines 421-459 in main.py) - **REMOVED**
- Edge cache strategy (edge_cache_strategy.py line 88) - **REMOVED**

## Deployment Commands

### Quick Deploy (recommended)
```bash
cd backend/inspirenet-api
bash scripts/deploy-model-fix.sh
```

### Manual Deploy
```bash
gcloud run deploy inspirenet-bg-removal-api \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --max-instances 3 \
    --min-instances 0 \
    --concurrency 1 \
    --cpu 8 \
    --memory 32Gi \
    --timeout 600s \
    --gpu 1
```

**Note**: GPU container builds take 10-15 minutes.

## Testing After Deployment

### 1. Test CORS with Allowed Origin
```bash
curl -X OPTIONS https://inspirenet-bg-removal-api-vqqo2tr3yq-uc.a.run.app/api/v2/process-with-effects \
  -H "Origin: https://perkieprints.com" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"
```

**Expected**: Should see `access-control-allow-origin: https://perkieprints.com` (NOT `*`)

### 2. Test CORS with Disallowed Origin
```bash
curl -X OPTIONS https://inspirenet-bg-removal-api-vqqo2tr3yq-uc.a.run.app/api/v2/process-with-effects \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"
```

**Expected**: Should be rejected or not include evil.com in allowed origins

### 3. Test Rate Limiting
```bash
# Send 11 requests rapidly (should get 429 on 11th)
for i in {1..11}; do
  echo "Request $i:"
  curl -X POST https://inspirenet-bg-removal-api-vqqo2tr3yq-uc.a.run.app/api/v2/process \
    -F "file=@test-image.jpg" \
    -w "\nHTTP Status: %{http_code}\n"
  sleep 1
done
```

**Expected**: First 10 succeed (200), 11th returns 429 with rate limit error

## Current Revisions
- **Latest Ready**: inspirenet-bg-removal-api-00094-lig (deployed 2025-10-05 00:32)
- **Changes**: CORS + rate limiting base implementation

## Next Revision (Pending)
-  **Changes**: Remove redundant wildcard CORS headers
- **Expected Revision**: 00095 or higher
- **ETA**: When manual deployment completes

## Verification Checklist
- [ ] New revision deployed successfully
- [ ] CORS shows explicit origins (not wildcard)
- [ ] Rate limiting returns 429 after 10 requests
- [ ] Health endpoint responds correctly
- [ ] Staging URL (shopifypreview.com) can access API
- [ ] Production domain (perkieprints.com) can access API
- [ ] Unknown domains are rejected

## Rollback If Needed
```bash
# Rollback to previous revision
gcloud run services update-traffic inspirenet-bg-removal-api \
  --to-revisions=inspirenet-bg-removal-api-00091-mat=100 \
  --region=us-central1
```
