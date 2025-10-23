# Testing Customer Image Storage Implementation

## Quick Test Steps

### 1. Test Backend API Locally (if running locally)

```bash
cd inspirenet-bg-removal-api

# Start the API locally
python src/main.py

# In another terminal, run the test suite
python test_customer_storage.py --url http://localhost:8080
```

### 2. Test Production API

```bash
# Test against your deployed API
python test_customer_storage.py --url https://inspirenet-bg-removal-fczsrfvzra-uc.a.run.app
```

### 3. Manual Frontend Test

1. Go to your Shopify store's pet background remover page
2. Open browser Developer Console (F12)
3. Upload a pet image
4. Apply an effect (e.g., Enhanced Black & White)
5. Click "Save Pet Image"
6. Enter a pet name
7. Check console for any errors

### 4. Verify Storage in Google Cloud Console

1. Go to: https://console.cloud.google.com/storage/browser/perkieprints-customer-images
2. Navigate to `customer-images/temporary/`
3. You should see folders with session IDs
4. Inside each session folder, you'll find:
   - `original_[timestamp].png` - Original uploaded image
   - `processed_enhancedblackwhite_[timestamp].png` - Processed image

## Detailed Test Scenarios

### Test 1: Basic Upload Flow
```javascript
// In browser console on your Shopify store
// This tests the full integration

// 1. Check if the API endpoint is reachable
fetch('https://inspirenet-bg-removal-fczsrfvzra-uc.a.run.app/store-image', {
  method: 'POST'
}).then(r => console.log('API Status:', r.status));

// 2. Monitor network requests
// Go to Network tab in DevTools
// Upload an image and save it
// Look for POST request to /store-image
// Should return 200 with URL in response
```

### Test 2: Check Storage Statistics
```bash
# Run this to see current storage usage
cd inspirenet-bg-removal-api
python monitor_customer_storage.py --bucket perkieprints-customer-images
```

Expected output:
```
Storage Usage by Tier:
┌─────────────────┬───────┬────────────┬──────────┬─────────────────────┬──────────────────┬───────────────────────┬──────────────────┬────────┬────────┐
│ Tier            │ Count │ Size (MB)  │ Size (GB) │ Storage Cost/Month  │ Ops Cost/Month   │ Total Cost/Month      │ Retention (days) │ Oldest │ Newest │
├─────────────────┼───────┼────────────┼──────────┼─────────────────────┼──────────────────┼───────────────────────┼──────────────────┼────────┼────────┤
│ temporary       │ X     │ X.XX       │ X.XXX     │ $X.XX              │ $X.XX            │ $X.XX                │ 7                │ Date   │ Date   │
│ order_pending   │ 0     │ 0.0        │ 0.0       │ $0.00              │ $0.00            │ $0.00                │ 30               │ N/A    │ N/A    │
│ order_completed │ 0     │ 0.0        │ 0.0       │ $0.00              │ $0.00            │ $0.00                │ 180              │ N/A    │ N/A    │
│ archived        │ 0     │ 0.0        │ 0.0       │ $0.00              │ $0.00            │ $0.00                │ 730              │ N/A    │ N/A    │
│ TOTAL          │ X     │ X.XX       │ X.XXX     │ $X.XX              │ $X.XX            │ $X.XX                │ -                │ -      │ -      │
└─────────────────┴───────┴────────────┴──────────┴─────────────────────┴──────────────────┴───────────────────────┴──────────────────┴────────┴────────┘
```

### Test 3: API Endpoint Direct Test
```bash
# Test with curl (replace session_id with a unique value)
SESSION_ID="test-$(date +%s)"

# Create a test image
curl -X POST https://inspirenet-bg-removal-fczsrfvzra-uc.a.run.app/store-image \
  -F "file=@test-image.png" \
  -F "session_id=$SESSION_ID" \
  -F "image_type=original" \
  -F "pet_name=Test Pet" \
  -F "tier=temporary"

# Check if it was stored
curl https://inspirenet-bg-removal-fczsrfvzra-uc.a.run.app/session/$SESSION_ID/images
```

### Test 4: Frontend Integration Check
```javascript
// Run this in your browser console to check if the frontend is configured correctly
const remover = document.querySelector('.ks-pet-bg-remover')?.__petBgRemover;
if (remover) {
  console.log('API URL:', remover.apiUrl);
  console.log('Should be:', 'https://inspirenet-bg-removal-fczsrfvzra-uc.a.run.app');
  
  // Test the uploadImageToStorage method
  const testBlob = new Blob(['test'], {type: 'image/png'});
  remover.uploadImageToStorage(testBlob, 'test')
    .then(url => console.log('Upload successful:', url))
    .catch(err => console.error('Upload failed:', err));
}
```

## Troubleshooting Guide

### Issue 1: 404 Error on /store-image
**Symptom**: `POST /store-image 404 Not Found`

**Check**:
1. Is the API deployed with the latest code?
2. Run: `gcloud run services describe inspirenet-bg-removal --region us-central1`
3. Check the deployment timestamp

**Fix**:
```bash
cd inspirenet-bg-removal-api
gcloud run deploy inspirenet-bg-removal --source . --region us-central1
```

### Issue 2: 403 Forbidden / Authentication Error
**Symptom**: `403 Forbidden` or `DefaultCredentialsError`

**Check**:
1. Service account permissions in Google Cloud Console
2. Environment variables in Cloud Run

**Fix**:
```bash
# Update Cloud Run environment variables
gcloud run services update inspirenet-bg-removal \
  --update-env-vars CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images \
  --region us-central1
```

### Issue 3: Images Not Appearing in Storage
**Symptom**: Upload succeeds but no images in bucket

**Check**:
1. Check API logs: `gcloud run logs read --service inspirenet-bg-removal`
2. Verify bucket name matches in code and environment

### Issue 4: CORS Errors
**Symptom**: `CORS policy: No 'Access-Control-Allow-Origin'`

**Check**:
1. API CORS configuration in `main.py`
2. Should allow your Shopify domain

## Success Criteria Checklist

- [ ] No errors in browser console when saving pet image
- [ ] Network tab shows successful POST to /store-image (200 status)
- [ ] Response contains a public URL starting with `https://storage.googleapis.com/`
- [ ] Images appear in Google Cloud Storage bucket
- [ ] Storage statistics show correct counts and sizes
- [ ] Lifecycle policies are active (check in GCS console)
- [ ] Frontend gracefully handles any errors

## Quick Health Check Script

Create this file as `quick_health_check.py`:

```python
import requests
import json

API_URL = "https://inspirenet-bg-removal-fczsrfvzra-uc.a.run.app"

print("Customer Image Storage Health Check")
print("=" * 50)

# Check API health
try:
    r = requests.get(f"{API_URL}/health")
    print(f"✓ API Health: {r.status_code}")
    print(f"  Response: {r.json()}")
except Exception as e:
    print(f"✗ API Health Check Failed: {e}")

# Check storage stats endpoint
try:
    r = requests.get(f"{API_URL}/storage/stats")
    if r.status_code == 200:
        stats = r.json()
        print(f"\n✓ Storage Stats Endpoint: Working")
        print(f"  Total Images: {stats.get('total_images', 0)}")
        print(f"  Monthly Cost: ${stats.get('estimated_monthly_cost', 0):.2f}")
    else:
        print(f"\n✗ Storage Stats: {r.status_code}")
except Exception as e:
    print(f"\n✗ Storage Stats Failed: {e}")

# Test store-image endpoint exists
try:
    r = requests.post(f"{API_URL}/store-image")
    print(f"\n✓ Store Image Endpoint: {r.status_code} (expected 422 for missing data)")
except Exception as e:
    print(f"\n✗ Store Image Endpoint Failed: {e}")

print("\n" + "=" * 50)
print("If all checks pass, the backend is ready!")
```

Run it with: `python quick_health_check.py`

## Next Steps After Testing

1. **If everything works**: 
   - Monitor costs weekly with `monitor_customer_storage.py`
   - Set up alerts in Google Cloud Console for budget

2. **If issues found**:
   - Check API logs: `gcloud run logs read`
   - Verify all environment variables are set
   - Ensure latest code is deployed

3. **Performance optimization**:
   - Consider implementing CDN for image delivery
   - Add image compression before storage
   - Implement resumable uploads for large files