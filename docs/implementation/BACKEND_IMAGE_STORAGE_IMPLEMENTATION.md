# Backend Customer Image Storage Implementation

## Overview

This implementation provides a complete backend solution for storing customer original and edited images with automatic lifecycle management to prevent excessive storage costs.

## Key Features

### 1. **Tiered Storage System**
- **Temporary (7 days)**: For images not associated with orders
- **Order Pending (30 days)**: For images waiting for order completion  
- **Order Completed (180 days)**: For images from completed orders
- **Archived (2 years)**: Long-term storage for potential reorders

### 2. **Automatic Lifecycle Management**
- Images automatically deleted based on tier retention policies
- No manual intervention required for routine cleanup
- Cost-effective storage management

### 3. **Storage Endpoints**
- `POST /store-image`: Upload customer images
- `GET /session/{session_id}/images`: Retrieve session images
- `POST /session/{session_id}/complete-order`: Mark order as completed
- `POST /session/{session_id}/move-tier`: Move images between tiers
- `GET /storage/stats`: Get storage statistics
- `POST /storage/cleanup`: Manual cleanup (with dry-run option)

## Setup Instructions

### 1. Create Google Cloud Storage Bucket

```bash
# Run the setup script
python setup_customer_storage.py \
  --project-id YOUR_PROJECT_ID \
  --bucket-name perkieprints-customer-images \
  --location us-central1
```

### 2. Configure Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create service account: `perkieprints-api`
3. Grant roles:
   - Storage Object Admin
   - Storage Object Viewer
4. Download JSON key
5. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
   ```

### 3. Deploy Backend

Add environment variables:
```bash
export CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images
export GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json
```

## API Usage

### Upload Customer Image

```javascript
const formData = new FormData();
formData.append('file', imageBlob);
formData.append('session_id', sessionId);
formData.append('image_type', 'original'); // or 'processed_enhancedblackwhite'
formData.append('pet_name', petName);
formData.append('pet_id', petId);
formData.append('effect_applied', 'enhancedblackwhite');
formData.append('tier', 'temporary'); // default tier

const response = await fetch('https://api.perkieprints.com/store-image', {
  method: 'POST',
  body: formData
});

const result = await response.json();
// Returns: { success: true, url: "https://storage.googleapis.com/...", ... }
```

### Complete Order

```javascript
// When order is completed in Shopify
const formData = new FormData();
formData.append('order_id', shopifyOrderId);

await fetch(`https://api.perkieprints.com/session/${sessionId}/complete-order`, {
  method: 'POST',
  body: formData
});
// Images automatically moved to order_completed tier (6-month retention)
```

### Get Session Images

```javascript
const response = await fetch(`https://api.perkieprints.com/session/${sessionId}/images`);
const data = await response.json();
// Returns list of all images for the session with public URLs
```

## Monitoring and Management

### 1. Monitor Storage Usage

```bash
# View storage statistics and costs
python monitor_customer_storage.py --bucket perkieprints-customer-images

# Generate charts for access patterns
python monitor_customer_storage.py --access-days 30
```

### 2. Manual Cleanup Options

```bash
# Clean up old temporary images (dry run)
python cleanup_customer_storage.py age --tier temporary --days 7

# Actually execute cleanup
python cleanup_customer_storage.py age --tier temporary --days 7 --execute

# Emergency cleanup to free space
python cleanup_customer_storage.py emergency --target-gb 10 --execute

# Clean up specific sessions
python cleanup_customer_storage.py session --sessions abc123 def456 --execute

# Remove large objects
python cleanup_customer_storage.py large --threshold 50 --execute
```

## Cost Management

### Estimated Monthly Costs
- Storage: $0.02 per GB
- Operations: $0.005 per 1000 operations
- Typical usage (1000 customers/month): ~$5-20/month

### Cost Optimization
1. **Automatic Lifecycle Policies**: Images deleted automatically
2. **Tiered Storage**: Different retention for different use cases
3. **Compression**: Images compressed before storage
4. **Monitoring**: Regular cost tracking and alerts

## Frontend Integration

Update `ks-pet-bg-remover.js` to use the new endpoint:

```javascript
async uploadImageToStorage(imageBlob, purpose) {
  const formData = new FormData();
  formData.append('file', imageBlob);
  formData.append('session_id', this.currentSessionId);
  formData.append('image_type', purpose);
  
  if (this.currentPetData) {
    formData.append('pet_name', this.currentPetData.petName);
    formData.append('pet_id', this.currentPetData.petId);
  }
  
  try {
    const response = await fetch(`${this.apiUrl}/store-image`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Failed to upload image:', error);
    // Fallback to data URL
    return await this.createDataUrl(imageBlob);
  }
}
```

## Security Considerations

1. **Access Control**: Images are publicly accessible via URLs
2. **Rate Limiting**: Implement rate limits on upload endpoint
3. **File Validation**: Only accept image files, size limits enforced
4. **CORS**: Configured for your domain only

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check service account permissions
2. **Quota Exceeded**: Run emergency cleanup script
3. **Slow Uploads**: Consider implementing resumable uploads
4. **Missing Images**: Check tier and retention policy

### Debug Commands

```bash
# Check bucket configuration
gsutil lifecycle get gs://perkieprints-customer-images

# List recent uploads
gsutil ls -l gs://perkieprints-customer-images/customer-images/temporary/

# Check specific session
gsutil ls -r gs://perkieprints-customer-images/customer-images/*/SESSION_ID/
```

## Next Steps

1. Set up monitoring alerts for storage costs
2. Implement customer download links with expiration
3. Add background job for regular cleanup verification
4. Consider CDN integration for faster delivery
5. Implement image optimization pipeline

## Support

For issues or questions:
- Check logs in Cloud Console
- Review storage metrics with monitor script
- Use cleanup scripts for manual intervention
- Contact DevOps team for infrastructure issues