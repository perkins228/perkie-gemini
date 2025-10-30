# Update Shopify Theme with Storage Fix

## Quick Update Steps

### Option 1: Via Shopify Admin (Recommended)

1. Go to your Shopify Admin
2. Navigate to **Online Store > Themes**
3. Click **Actions > Edit code** on your current theme
4. Find `assets/ks-pet-bg-remover.js`
5. Copy the entire contents of your local `assets/ks-pet-bg-remover.js` file
6. Paste and save

### Option 2: Via Shopify CLI

```bash
# If you have Shopify CLI installed
shopify theme push --only assets/ks-pet-bg-remover.js
```

## What Changed

The JavaScript file was updated to:
1. **Remove hardcoded fallback** - It will now try to upload to the API first
2. **Use correct session IDs** - Fixed session ID tracking for uploads
3. **Include pet metadata** - Pet names will be stored with images

## Testing After Update

1. **Clear browser cache** (Important!)
   - Chrome: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - Or open Developer Tools > Network tab > check "Disable cache"

2. **Test upload**:
   - Go to your pet background remover page
   - Upload a pet image
   - Apply an effect
   - Click "Save Pet Image"
   - Enter pet name

3. **Check console** for these messages:
   ```
   📤 Uploading original image to storage...
   ✅ Successfully uploaded original image: https://storage.googleapis.com/...
   📤 Uploading processed_enhancedblackwhite image to storage...
   ✅ Successfully uploaded processed_enhancedblackwhite image: https://storage.googleapis.com/...
   ```

4. **Verify in Google Cloud Storage**:
   ```bash
   cd inspirenet-bg-removal-api
   python monitor_customer_storage.py --bucket perkieprints-customer-images
   ```

   You should see:
   ```
   Storage Usage by Tier:
   temporary: 2 images, X.XX MB
   ```

## Troubleshooting

If you still see "Using data URL storage" in console:
1. Hard refresh the page (Ctrl+Shift+R)
2. Check that the JS file was updated in Shopify
3. Verify API URL is correct in theme settings

If you see upload errors:
1. Check browser console for specific error messages
2. Verify API is still running: `python quick_health_check.py`
3. Check CORS settings if seeing cross-origin errors