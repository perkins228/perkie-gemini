#!/bin/bash

echo "🚀 Deploying EXIF fix to Cloud Run (CPU mode for quick deployment)..."

gcloud run deploy inspirenet-bg-removal-api \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --max-instances 10 \
    --min-instances 0 \
    --concurrency 4 \
    --cpu 4 \
    --memory 8Gi \
    --timeout 300s \
    --set-env-vars "INSPIRENET_MODE=base,INSPIRENET_RESIZE=dynamic,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,LOG_LEVEL=info"

echo "✅ Deployment complete!"