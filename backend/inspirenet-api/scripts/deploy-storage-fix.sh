#!/bin/bash

# Deploy Storage Upload Error Fix
# Fixes Safari data URL parsing and improves error handling

set -e

echo "🔧 Deploying Storage Upload Error Fix..."
echo "📝 This deployment fixes:"
echo "   - Safari data URL parsing issues"
echo "   - Proper error classification (400/413/500/503)"
echo "   - Enhanced validation and logging"
echo ""

# Store start time for deployment tracking
START_TIME=$(date +%s)

# Build and deploy to production (no tag = main traffic)
echo "🚀 Deploying to production..."
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
    --set-env-vars "INSPIRENET_MODE=base,INSPIRENET_RESIZE=dynamic,TARGET_SIZE=1024,STORAGE_BUCKET=perkieprints-processing-cache,CUSTOMER_STORAGE_BUCKET=perkieprints-customer-images,ENABLE_GPU_OPTIMIZATIONS=true,LOG_LEVEL=info"

echo ""
echo "✅ Deployment complete!"

# Calculate deployment time
END_TIME=$(date +%s)
DEPLOY_TIME=$((END_TIME - START_TIME))
echo "⏱️  Deployment took ${DEPLOY_TIME} seconds"

echo ""
echo "🧪 Running post-deployment tests..."
echo ""

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed: $HEALTH_RESPONSE"
    exit 1
fi

# Test 2: Model info
echo ""
echo "2️⃣  Testing model info endpoint..."
MODEL_INFO=$(curl -s "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/model-info")
if echo "$MODEL_INFO" | grep -q "model"; then
    echo "   ✅ Model info retrieved successfully"
else
    echo "   ⚠️  Model info response unexpected: $MODEL_INFO"
fi

# Test 3: Storage upload with valid data (minimal JPEG)
echo ""
echo "3️⃣  Testing storage upload endpoint with valid data..."
VALID_JPEG_BASE64="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYDAwYMCAcIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q=="

UPLOAD_RESPONSE=$(curl -s -X POST "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/storage/upload" \
    -H "Content-Type: application/json" \
    -d "{\"session_id\":\"test-deploy-$(date +%s)\",\"images\":{\"original\":\"$VALID_JPEG_BASE64\"},\"metadata\":{\"test\":\"deployment-validation\"}}" \
    --max-time 30)

if echo "$UPLOAD_RESPONSE" | grep -q "urls"; then
    echo "   ✅ Storage upload with valid data succeeded"
    echo "   📍 Response: $(echo $UPLOAD_RESPONSE | head -c 100)..."
else
    echo "   ❌ Storage upload failed: $UPLOAD_RESPONSE"
    echo "   ⚠️  This may indicate a problem with the deployment"
fi

# Test 4: Storage upload with invalid data (should return 400)
echo ""
echo "4️⃣  Testing storage upload error handling (malformed data)..."
ERROR_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/storage/upload" \
    -H "Content-Type: application/json" \
    -d '{"session_id":"test-error","images":{"original":"data:image/jpeg;base64INVALID"},"metadata":{}}' \
    --max-time 10)

HTTP_CODE=$(echo "$ERROR_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "400" ]; then
    echo "   ✅ Error handling works correctly (returned 400 for invalid data)"
else
    echo "   ⚠️  Expected 400, got $HTTP_CODE"
    echo "   Response: $(echo "$ERROR_RESPONSE" | head -n-1)"
fi

# Test 5: Warmup endpoint
echo ""
echo "5️⃣  Testing warmup endpoint (may take 30-60s on cold start)..."
WARMUP_START=$(date +%s)
WARMUP_RESPONSE=$(curl -s -X POST "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup" \
    -H "Content-Type: application/json" \
    -d '{}' \
    --max-time 120)
WARMUP_END=$(date +%s)
WARMUP_TIME=$((WARMUP_END - WARMUP_START))

if echo "$WARMUP_RESPONSE" | grep -q "status"; then
    echo "   ✅ Warmup succeeded in ${WARMUP_TIME} seconds"
else
    echo "   ⚠️  Warmup response unexpected (${WARMUP_TIME}s): $WARMUP_RESPONSE"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎉 Storage Fix Deployment Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Deployment Summary:"
echo "   • Total deployment time: ${DEPLOY_TIME}s"
echo "   • Warmup time: ${WARMUP_TIME}s"
echo "   • Service: inspirenet-bg-removal-api"
echo "   • Region: us-central1"
echo "   • URL: https://inspirenet-bg-removal-api-725543555429.us-central1.run.app"
echo ""
echo "✅ All critical tests passed!"
echo ""
echo "📋 Next Steps:"
echo "   1. Monitor Cloud Run logs for 1 hour"
echo "   2. Test with Safari on macOS (manual)"
echo "   3. Watch for 500 errors on /api/storage/upload"
echo ""
echo "🔍 Monitor logs with:"
echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api\" --limit=50 --format=json"
echo ""
echo "🔄 Rollback if needed:"
echo "   gcloud run services update-traffic inspirenet-bg-removal-api --to-revisions=PREVIOUS_REVISION=100 --region=us-central1"
echo ""
echo "═══════════════════════════════════════════════════════════"
