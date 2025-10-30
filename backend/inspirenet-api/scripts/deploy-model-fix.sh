#!/bin/bash

# Deploy Model Fix Script
# Fixes InSPyReNet model loading issues with NumPy compatibility

set -e

echo "🔧 Deploying InSPyReNet Model Fix..."

# Build and deploy the image with compatibility fixes
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
    --gpu 1 \
    --set-env-vars "INSPIRENET_MODE=base,INSPIRENET_RESIZE=dynamic,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,ENABLE_GPU_OPTIMIZATIONS=true,LOG_LEVEL=info" \
    --tag model-fix

echo "✅ Deployment complete!"
echo "🧪 Testing model loading..."

# Test the warmup endpoint
echo "Testing warmup endpoint..."
curl -X POST "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup" \
    -H "Content-Type: application/json" \
    -d '{}' \
    --max-time 120

echo ""
echo "🔍 Checking model info..."
curl -s "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info" | jq

echo ""
echo "🎉 Model fix deployment complete!"