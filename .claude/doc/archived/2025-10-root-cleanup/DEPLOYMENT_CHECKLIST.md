# 🚀 Deployment Checklist - Simple URL Storage Solution

## What Needs Deployment

### 1. Backend API Changes ✅ 
**Files:** `backend/inspirenet-api/src/simple_storage_api.py`

The storage endpoint needs to be deployed to your existing Cloud Run API:

```bash
cd backend/inspirenet-api
gcloud run deploy inspirenet-bg-removal-api \
  --source . \
  --region us-central1
```

**Status:** This will be included automatically in your next API deployment.

### 2. Frontend Changes to Shopify Theme 🔄
**Files to push:**
- `assets/pet-processor-v5-es5.js` - Added syncSelectedToCloud() method
- `snippets/buy-buttons.liquid` - Changed to save GCS URLs in order properties
- `snippets/order-custom-images.liquid` - Updated to show clickable URLs

**Deploy with:**
```bash
shopify theme push --only assets/pet-processor-v5-es5.js \
                    --only snippets/buy-buttons.liquid \
                    --only snippets/order-custom-images.liquid
```

### 3. Google Cloud Storage Bucket Configuration ⚠️
**IMPORTANT:** Your bucket needs public read access for the URLs to work.

Check current settings:
```bash
gsutil iam get gs://perkie-prints-images
```

If needed, enable public access:
```bash
# Make bucket publicly readable (employees can click URLs)
gsutil iam ch allUsers:objectViewer gs://perkie-prints-images

# Or for more control, set individual object ACLs in the upload code
```

## Pre-Deployment Testing

Before deploying, test locally:

1. **Test the API endpoint locally:**
```bash
cd backend/inspirenet-api
python src/main.py
# API will run on http://localhost:8000
```

2. **Test with the test file:**
```bash
# Open in browser
testing/complete-flow-test.html
```

## Deployment Steps

### Step 1: Deploy API (5 minutes)
```bash
cd backend/inspirenet-api

# Deploy to Cloud Run (includes new storage endpoint)
gcloud run deploy inspirenet-bg-removal-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated

# Verify endpoint is working
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health
```

### Step 2: Deploy Shopify Theme (2 minutes)
```bash
# From project root
shopify theme push --theme <your-theme-id> \
  --only assets/pet-processor-v5-es5.js \
  --only snippets/buy-buttons.liquid \
  --only snippets/order-custom-images.liquid
```

### Step 3: Verify GCS Permissions (1 minute)
```bash
# Check if bucket is publicly readable
gsutil acl get gs://perkie-prints-images

# If not public, make it public
gsutil iam ch allUsers:objectViewer gs://perkie-prints-images
```

## Post-Deployment Verification

1. **Test Upload Flow:**
   - Go to pet background remover page
   - Upload an image
   - Select an effect
   - Add to cart
   - Check browser console for "Cloud URLs saved to order properties"

2. **Verify Order Properties:**
   - Complete a test order
   - In Shopify Admin → Orders → View order
   - Check "Additional details" section
   - Should see `_original_image_url` and `_processed_image_url` with clickable links

3. **Test Employee Access:**
   - Click the URLs in the order
   - Should open images directly in browser
   - Can right-click → Save As to download

## Rollback Plan

If issues occur, rollback is simple:

```bash
# Revert Shopify theme files
shopify theme push --theme <your-theme-id> \
  --only assets/pet-processor-v5-es5.js \
  --only snippets/buy-buttons.liquid \
  --only snippets/order-custom-images.liquid \
  --force

# Images will still save to localStorage as before
```

## Notes

- **No database changes** - Uses existing GCS bucket
- **No new infrastructure** - Reuses existing API
- **Backward compatible** - localStorage remains primary storage
- **Non-blocking** - Upload failures don't break customer flow
- **URLs are permanent** - Once uploaded, images stay accessible

## Estimated Time: 10 minutes total

1. API deployment: 5 minutes
2. Shopify theme: 2 minutes  
3. Verification: 3 minutes

## Support

If you encounter issues:
1. Check Cloud Run logs: `gcloud run logs read --service inspirenet-bg-removal-api`
2. Check browser console for JavaScript errors
3. Verify GCS bucket permissions
4. Test with a simple curl command to the storage endpoint