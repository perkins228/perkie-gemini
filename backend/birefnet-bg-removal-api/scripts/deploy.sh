#!/bin/bash
# BiRefNet Background Removal API - Deployment Script
#
# Usage:
#   ./scripts/deploy.sh [PROJECT_ID] [REGION]
#
# Example:
#   ./scripts/deploy.sh gen-lang-client-0601138686 us-central1

set -e

# Configuration
PROJECT_ID="${1:-gen-lang-client-0601138686}"
REGION="${2:-us-central1}"
SERVICE_NAME="birefnet-bg-removal-api"
IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/pet-bg-removal/${SERVICE_NAME}"

echo "=============================================="
echo "BiRefNet Background Removal API Deployment"
echo "=============================================="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo "Image: ${IMAGE_NAME}"
echo ""

# Set project
echo "Setting project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable run.googleapis.com --quiet
gcloud services enable artifactregistry.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet

# Create Artifact Registry repository if it doesn't exist
echo "Checking Artifact Registry..."
if ! gcloud artifacts repositories describe pet-bg-removal --location=${REGION} &>/dev/null; then
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create pet-bg-removal \
        --repository-format=docker \
        --location=${REGION} \
        --description="Pet background removal API images"
fi

# Build and push image
echo ""
echo "Building Docker image..."
echo "This may take 10-15 minutes (downloading BiRefNet model)..."
gcloud builds submit \
    --tag "${IMAGE_NAME}:latest" \
    --timeout=30m \
    --machine-type=e2-highcpu-8

# Update deploy.yaml with correct project ID
echo ""
echo "Updating deployment configuration..."
sed -i "s/PROJECT_ID/${PROJECT_ID}/g" deploy.yaml

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run services replace deploy.yaml \
    --region=${REGION}

# Get service URL
echo ""
echo "Getting service URL..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --region=${REGION} \
    --format='value(status.url)')

echo ""
echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Test endpoints:"
echo "  Health: curl ${SERVICE_URL}/health"
echo "  Warmup: curl -X POST ${SERVICE_URL}/warmup"
echo "  Model Info: curl ${SERVICE_URL}/model-info"
echo ""
echo "Remove background:"
echo "  curl -X POST -F 'file=@your-image.jpg' ${SERVICE_URL}/remove-background -o result.png"
echo ""
