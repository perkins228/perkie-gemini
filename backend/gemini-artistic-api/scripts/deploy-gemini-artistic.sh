#!/bin/bash
# Deployment script for Gemini Artistic API

set -e

# Configuration
PROJECT_ID="gen-lang-client-0601138686"
PROJECT_NUMBER="753651513695"
REGION="us-central1"
SERVICE_NAME="gemini-artistic-api"
REPO_NAME="gemini-artistic"

echo "🚀 Deploying Gemini Artistic API to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Create Artifact Registry repository (if doesn't exist)
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID \
  --quiet 2>/dev/null || echo "Repository already exists"

# Build and push container
echo "🔨 Building container image..."
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars PROJECT_ID=$PROJECT_ID,PROJECT_NUMBER=$PROJECT_NUMBER,GEMINI_MODEL=gemini-2.5-flash-image \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Service URL:"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)'
echo ""
echo "📊 Test with:"
echo "  curl \$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')/health"
