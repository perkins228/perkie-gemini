#!/bin/bash
# ============================================================================
# DEPLOY OPTIMIZED INSPIRENET API
# ============================================================================
# Project: gen-lang-client-0601138686 (perkieprints-nanobanana)
# Purpose: Build and deploy optimized InSPyReNet API
#
# Expected cold start: 15-20s (vs 81-92s production)
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="gen-lang-client-0601138686"
REGION="us-central1"
SERVICE_NAME="inspirenet-bg-removal-test"

echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}DEPLOYING OPTIMIZED INSPIRENET API${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}ERROR: gcloud CLI not found. Please install Google Cloud SDK.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}Not authenticated. Running gcloud auth login...${NC}"
    gcloud auth login
fi

# Set project
echo -e "${YELLOW}Setting project to $PROJECT_ID...${NC}"
gcloud config set project $PROJECT_ID

# Create Artifact Registry repository if it doesn't exist
echo -e "${YELLOW}Ensuring Artifact Registry repository exists...${NC}"
if ! gcloud artifacts repositories describe pet-bg-removal --location=$REGION &> /dev/null; then
    echo -e "${YELLOW}Creating Artifact Registry repository...${NC}"
    gcloud artifacts repositories create pet-bg-removal \
        --repository-format=docker \
        --location=$REGION \
        --description="Pet background removal API images"
else
    echo -e "${GREEN}Artifact Registry repository already exists.${NC}"
fi

# Submit build
echo ""
echo -e "${YELLOW}============================================================================${NC}"
echo -e "${YELLOW}SUBMITTING BUILD TO CLOUD BUILD${NC}"
echo -e "${YELLOW}============================================================================${NC}"
echo ""
echo -e "${YELLOW}This will take approximately 25-30 minutes for the first build.${NC}"
echo -e "${YELLOW}Subsequent builds will be faster (10-15 min) due to layer caching.${NC}"
echo ""

gcloud builds submit \
    --config=cloudbuild.yaml \
    --project=$PROJECT_ID

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================================================${NC}"
    echo -e "${GREEN}DEPLOYMENT SUCCESSFUL!${NC}"
    echo -e "${GREEN}============================================================================${NC}"
    echo ""

    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format='value(status.url)')

    echo "Service URL: $SERVICE_URL"
    echo ""
    echo "Endpoints:"
    echo "  - POST $SERVICE_URL/remove-background"
    echo "  - POST $SERVICE_URL/api/v2/process"
    echo "  - GET  $SERVICE_URL/health"
    echo "  - GET  $SERVICE_URL/startup"
    echo ""
    echo -e "${YELLOW}Testing startup probe...${NC}"
    curl -s "$SERVICE_URL/startup" | jq . || echo "Waiting for service to be ready..."
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "  1. Test cold start: Wait 10 minutes, then send a request"
    echo "  2. Monitor logs: gcloud run logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
    echo "  3. Check metrics: Cloud Console > Cloud Run > $SERVICE_NAME"
    echo ""
    echo -e "${GREEN}Expected cold start time: 15-20 seconds (vs 81-92s production)${NC}"
else
    echo ""
    echo -e "${RED}============================================================================${NC}"
    echo -e "${RED}DEPLOYMENT FAILED${NC}"
    echo -e "${RED}============================================================================${NC}"
    echo ""
    echo "Check Cloud Build logs for details:"
    echo "  https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
    exit 1
fi
