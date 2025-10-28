#!/bin/bash

# Gemini Artistic API Deployment Script
# Deploys to Google Cloud Run

set -e  # Exit on error

# Configuration
PROJECT_ID="gen-lang-client-0601138686"
PROJECT_NUMBER="753651513695"
REGION="us-central1"
SERVICE_NAME="gemini-artistic-api"
IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/gemini-artistic/api:latest"

echo "========================================="
echo "Deploying Gemini Artistic API"
echo "========================================="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Step 1: Enable required APIs
echo "[1/6] Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  --project=${PROJECT_ID}

echo "✓ APIs enabled"
echo ""

# Step 2: Create Artifact Registry repository (if not exists)
echo "[2/6] Creating Artifact Registry repository..."
gcloud artifacts repositories create gemini-artistic \
  --repository-format=docker \
  --location=${REGION} \
  --project=${PROJECT_ID} \
  2>/dev/null || echo "Repository already exists"

echo "✓ Artifact Registry ready"
echo ""

# Step 3: Build container image (force clean build)
echo "[3/6] Building container image (forcing clean build with --no-cache)..."
gcloud builds submit \
  --tag ${IMAGE_NAME} \
  --project=${PROJECT_ID} \
  --no-cache \
  .

echo "✓ Container image built"
echo ""

# Step 4: Create service account (if not exists)
echo "[4/6] Creating service account..."
gcloud iam service-accounts create gemini-artistic-api \
  --display-name="Gemini Artistic API Service Account" \
  --project=${PROJECT_ID} \
  2>/dev/null || echo "Service account already exists"

echo "✓ Service account ready"
echo ""

# Step 5: Grant necessary permissions
echo "[5/6] Granting permissions..."
SERVICE_ACCOUNT="gemini-artistic-api@${PROJECT_ID}.iam.gserviceaccount.com"

# Firestore permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None

# Cloud Storage permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin" \
  --condition=None

echo "✓ Permissions granted"
echo ""

# Step 6: Create Secret Manager secret for API key
echo "[6/7] Creating Secret Manager secret for Gemini API key..."
echo -n "AIzaSyAP6X8DdL1kPlah25du8s_YzipwOnYd_7I" | \
  gcloud secrets create gemini-api-key \
  --data-file=- \
  --project=${PROJECT_ID} \
  2>/dev/null || echo "Secret already exists (OK)"

# Grant service account access to secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=${PROJECT_ID} \
  2>/dev/null || echo "Permission already granted (OK)"

echo "✓ Secret Manager configured"
echo ""

# Step 7: Deploy to Cloud Run
echo "[7/7] Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=${SERVICE_ACCOUNT} \
  --min-instances=0 \
  --max-instances=5 \
  --cpu=2 \
  --memory=2Gi \
  --timeout=300 \
  --concurrency=10 \
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="GEMINI_MODEL=gemini-2.5-flash-image,PROJECT_ID=${PROJECT_ID},STORAGE_BUCKET=gemini-artistic-753651513695,RATE_LIMIT_DAILY=5,RATE_LIMIT_BURST=3" \
  --project=${PROJECT_ID}

echo "✓ Deployment complete!"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --format='value(status.url)')

echo "========================================="
echo "✅ Deployment Successful!"
echo "========================================="
echo ""
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Test endpoints:"
echo "  Health: ${SERVICE_URL}/health"
echo "  Quota:  ${SERVICE_URL}/api/v1/quota?session_id=test"
echo ""
echo "Next steps:"
echo "  1. Test health endpoint: curl ${SERVICE_URL}/health"
echo "  2. Verify Firestore rate limiting is working"
echo "  3. Test image generation with sample pet photo"
echo ""
