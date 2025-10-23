# Deploy Customer Storage Update

## Quick Deploy Steps

1. **Navigate to API directory**:
```bash
cd inspirenet-bg-removal-api
```

2. **Deploy to Cloud Run**:
```bash
gcloud run deploy inspirenet-bg-removal-api \
  --source . \
  --region us-central1 \
  --set-env-vars CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images
```

This will:
- Build and deploy the latest code
- Set the customer storage bucket environment variable
- Update the service with all new endpoints

3. **Verify deployment** (after ~2-3 minutes):
```bash
python quick_health_check.py
```

## What Gets Deployed

- ✅ `/store-image` endpoint for customer uploads
- ✅ `/session/{id}/images` endpoint for retrieving images
- ✅ `/session/{id}/complete-order` for order completion
- ✅ `/storage/stats` for monitoring
- ✅ All other customer storage endpoints

## Expected Health Check Output

After successful deployment:
```
[OK] API is healthy
[OK] Storage stats working
[OK] Store image endpoint exists
[OK] Session endpoint exists
[SUCCESS] All health checks passed!
```

## Testing After Deployment

1. **Frontend Test**:
   - Go to your Shopify store
   - Upload and save a pet image
   - Check browser console for success

2. **Backend Verification**:
   - Check Google Cloud Storage bucket
   - Run: `python monitor_customer_storage.py`

3. **API Direct Test**:
   ```bash
   python test_customer_storage.py --url https://inspirenet-bg-removal-api-725543555429.us-central1.run.app
   ```