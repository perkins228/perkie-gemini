#!/bin/bash

# Deploy InSPyReNet API to gen-lang-client-0601138686 (Staging/Testing)
# This script deploys the updated API with only B&W and Color effects

set -e

PROJECT_ID="gen-lang-client-0601138686"
SERVICE_NAME="inspirenet-bg-removal-api-gemini"
REGION="us-central1"
REPOSITORY="inspirenet-api"
IMAGE_NAME="inspirenet-bg-removal-api"
IMAGE_TAG="style-consolidation"

echo "=================================================="
echo "Deploying InSPyReNet API to Staging (NanoBanana)"
echo "=================================================="
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo "Effects: color, enhancedblackwhite (only)"
echo "=================================================="
echo ""

# Set the project
echo "Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo "Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPOSITORY \
  --repository-format=docker \
  --location=$REGION \
  --description="InSPyReNet API container images" \
  2>/dev/null || echo "Repository already exists"

# Create GCS buckets if they don't exist
echo "Creating GCS buckets..."
gsutil mb -p $PROJECT_ID -l $REGION gs://perkieprints-nanobanana-cache 2>/dev/null || echo "Cache bucket already exists"
gsutil mb -p $PROJECT_ID -l $REGION gs://perkieprints-nanobanana-customer-images 2>/dev/null || echo "Customer images bucket already exists"

# Set CORS for customer images bucket
echo "Setting CORS for customer images bucket..."
cat > cors-config.json <<EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set cors-config.json gs://perkieprints-nanobanana-customer-images
rm cors-config.json

# Build and deploy using Cloud Build
echo "Building and deploying using Cloud Build..."
cd "$(dirname "$0")/.."

gcloud builds submit \
  --config=cloudbuild-nanobanana.yaml \
  --timeout=40m

echo "Build and deployment complete!"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')

echo ""
echo "=================================================="
echo "Deployment Complete!"
echo "=================================================="
echo "Service URL: $SERVICE_URL"
echo "Project: $PROJECT_ID"
echo ""
echo "Next Steps:"
echo "1. Test the API: curl $SERVICE_URL/health"
echo "2. Update frontend to use: $SERVICE_URL"
echo "3. Test B&W and Color effects"
echo "4. Test Modern/Classic via Gemini API"
echo "=================================================="
