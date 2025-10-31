# Gemini Artistic API Deployment Plan

**Created**: 2025-10-30
**Project**: perkieprints-nanobanana (gen-lang-client-0601138686)
**Service**: gemini-artistic-api
**Purpose**: Deploy FastAPI application for AI-powered pet portrait generation

## Executive Summary

This plan outlines the complete deployment process for the Gemini Artistic API to Google Cloud Run. The API uses Google's Gemini 2.5 Flash Image model to generate artistic pet portraits with Firestore rate limiting and Cloud Storage caching. The deployment prioritizes cost optimization (scale to zero) while maintaining performance.

## Infrastructure Requirements

### 1. Google Cloud Services Required

#### 1.1 Core Services
- **Cloud Run**: Container hosting (CPU only, no GPU needed)
- **Artifact Registry**: Docker image storage
- **Cloud Build**: Container build pipeline
- **Secret Manager**: API key management
- **Firestore**: Rate limiting database
- **Cloud Storage**: Image caching bucket

#### 1.2 IAM Roles & Permissions
The Cloud Run service account needs:
- `roles/datastore.user` - Firestore access
- `roles/storage.objectAdmin` - Storage bucket access
- `roles/secretmanager.secretAccessor` - Secret Manager access
- `roles/logging.logWriter` - Cloud Logging
- `roles/monitoring.metricWriter` - Cloud Monitoring

### 2. Pre-Deployment Checklist

- [ ] Google Cloud SDK installed and authenticated
- [ ] Project ID verified: `gen-lang-client-0601138686`
- [ ] Billing enabled with budget alerts
- [ ] API key available: `[REDACTED - See Secret Manager]`
- [ ] Backend code complete in `backend/gemini-artistic-api/`
- [ ] Docker Desktop running (for local build testing)

## Step-by-Step Deployment Instructions

### Phase 1: Google Cloud Infrastructure Setup

#### Step 1.1: Enable Required APIs
```bash
# Set the project
gcloud config set project gen-lang-client-0601138686

# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

#### Step 1.2: Create Firestore Database
```bash
# Create Firestore database in native mode
gcloud firestore databases create \
  --location=us-central1 \
  --type=firestore-native

# Create indexes for rate limiting
cat > firestore.indexes.json << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "rate_limits",
      "fields": [
        {"fieldPath": "customer_id", "order": "ASCENDING"},
        {"fieldPath": "timestamp", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "rate_limits",
      "fields": [
        {"fieldPath": "session_id", "order": "ASCENDING"},
        {"fieldPath": "timestamp", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "rate_limits",
      "fields": [
        {"fieldPath": "ip_address", "order": "ASCENDING"},
        {"fieldPath": "timestamp", "order": "DESCENDING"}
      ]
    }
  ]
}
EOF

gcloud firestore indexes create --file=firestore.indexes.json
```

#### Step 1.3: Configure Cloud Storage Bucket
```bash
# Create or verify bucket exists
gsutil mb -p gen-lang-client-0601138686 \
  -c STANDARD \
  -l us-central1 \
  gs://perkieprints-processing-cache/ || echo "Bucket exists"

# Set CORS for frontend access
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://perkieprints-processing-cache

# Set lifecycle rule for automatic cleanup (7 days)
cat > lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 7}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://perkieprints-processing-cache

# Set uniform bucket-level access
gsutil uniformbucketlevelaccess set on gs://perkieprints-processing-cache
```

#### Step 1.4: Store API Key in Secret Manager
```bash
# Create secret for Gemini API key
echo -n "[REDACTED - See Secret Manager]" | \
  gcloud secrets create gemini-api-key \
    --data-file=- \
    --replication-policy="automatic"

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:753651513695-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### Step 1.5: Create Artifact Registry Repository
```bash
gcloud artifacts repositories create gemini-artistic \
  --repository-format=docker \
  --location=us-central1 \
  --description="Gemini Artistic API Docker images" \
  --quiet
```

### Phase 2: Application Preparation

#### Step 2.1: Prepare Environment Configuration
```bash
cd backend/gemini-artistic-api/

# Create .env file from example
cp .env.example .env

# Verify all values are correct in .env
# PROJECT_ID=gen-lang-client-0601138686
# PROJECT_NUMBER=753651513695
# GEMINI_API_KEY will be loaded from Secret Manager
# STORAGE_BUCKET=perkieprints-processing-cache
```

#### Step 2.2: Update Dockerfile for Production
```bash
# The existing Dockerfile is production-ready
# Verify it exists and has correct configuration
cat Dockerfile
```

#### Step 2.3: Create Cloud Build Configuration
```bash
cat > cloudbuild.yaml << 'EOF'
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:$SHORT_SHA', '.']

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:$SHORT_SHA']

  # Tag as latest
  - name: 'gcr.io/cloud-builders/docker'
    args: ['tag',
           'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:$SHORT_SHA',
           'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:latest']

  # Push latest tag
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:latest']

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:$SHORT_SHA'
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/gemini-artistic/api:latest'

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'
EOF
```

### Phase 3: Build and Deploy

#### Step 3.1: Build Container Image
```bash
# Option A: Use Cloud Build (Recommended)
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --timeout=20m

# Option B: Build locally and push
docker build -t us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest .
docker push us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest
```

#### Step 3.2: Deploy to Cloud Run
```bash
gcloud run deploy gemini-artistic-api \
  --image us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --platform managed \
  --region us-central1 \
  --project gen-lang-client-0601138686 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300 \
  --concurrency 100 \
  --port 8080 \
  --service-account 753651513695-compute@developer.gserviceaccount.com \
  --set-env-vars "PROJECT_ID=gen-lang-client-0601138686" \
  --set-env-vars "PROJECT_NUMBER=753651513695" \
  --set-env-vars "STORAGE_BUCKET=perkieprints-processing-cache" \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash-image" \
  --set-env-vars "RATE_LIMIT_DAILY=6" \
  --set-env-vars "RATE_LIMIT_BURST=3" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --set-cloudsql-instances "" \
  --cpu-throttling \
  --execution-environment gen2
```

#### Step 3.3: Configure Service IAM
```bash
# Get the service account email
SERVICE_ACCOUNT="753651513695-compute@developer.gserviceaccount.com"

# Grant Firestore access
gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"

# Grant Storage access
gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"

# Grant logging access
gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/logging.logWriter"
```

### Phase 4: Monitoring and Alerting

#### Step 4.1: Set Up Budget Alerts
```bash
# Create budget alert for Gemini API costs
gcloud billing budgets create \
  --billing-account=$(gcloud beta billing accounts list --format="value(name)" --limit=1) \
  --display-name="Gemini API Daily Budget" \
  --budget-amount=10 \
  --threshold-rule=percent=50,basis=current-spend \
  --threshold-rule=percent=75,basis=current-spend \
  --threshold-rule=percent=90,basis=current-spend \
  --threshold-rule=percent=100,basis=current-spend
```

#### Step 4.2: Configure Cloud Monitoring
```bash
# Create uptime check
gcloud monitoring uptime-check-configs create \
  --display-name="Gemini API Health Check" \
  --resource-type="uptime-url" \
  --hostname="$(gcloud run services describe gemini-artistic-api --region us-central1 --format 'value(status.url)' | sed 's|https://||')" \
  --path="/health" \
  --period="5m" \
  --timeout="10s"

# Create alert policy for errors
cat > alert-policy.yaml << 'EOF'
displayName: "Gemini API Error Rate"
conditions:
  - displayName: "High error rate"
    conditionThreshold:
      filter: |
        resource.type="cloud_run_revision"
        resource.labels.service_name="gemini-artistic-api"
        metric.type="run.googleapis.com/request_count"
        metric.labels.response_code_class="5xx"
      comparison: COMPARISON_GT
      thresholdValue: 10
      duration: 60s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
notificationChannels: []
alertStrategy:
  autoClose: 86400s
EOF

gcloud alpha monitoring policies create --policy-from-file=alert-policy.yaml
```

#### Step 4.3: Set Up Logging
```bash
# Create log sink for error tracking
gcloud logging sinks create gemini-api-errors \
  storage.googleapis.com/perkieprints-processing-cache/logs/errors \
  --log-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="gemini-artistic-api"
    severity>=ERROR'
```

### Phase 5: Verification and Testing

#### Step 5.1: Get Service URL
```bash
# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe gemini-artistic-api \
  --region us-central1 \
  --format 'value(status.url)')

echo "Service deployed at: $SERVICE_URL"
```

#### Step 5.2: Test Health Endpoint
```bash
# Test health check
curl "${SERVICE_URL}/health"
# Expected: {"status":"healthy","model":"gemini-2.5-flash-image","version":"1.0.0"}
```

#### Step 5.3: Test API Documentation
```bash
# Check API documentation is available
echo "API Documentation: ${SERVICE_URL}/docs"
echo "Redoc Documentation: ${SERVICE_URL}/redoc"
```

#### Step 5.4: Test Generation Endpoint
```bash
# Create test image (1x1 pixel base64)
TEST_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

# Test single generation
curl -X POST "${SERVICE_URL}/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "'${TEST_IMAGE}'",
    "style": "bw_fine_art",
    "customer_id": "test-customer",
    "session_id": "test-session"
  }'
```

#### Step 5.5: Verify Rate Limiting
```bash
# Test quota endpoint
curl "${SERVICE_URL}/api/v1/quota?customer_id=test-customer"
# Expected: {"customer_id":"test-customer","remaining_daily":6,"remaining_session":3}
```

### Phase 6: Frontend Integration

#### Step 6.1: Update Frontend API URL
```bash
# The frontend needs to be updated with the new service URL
# Add to the Shopify theme settings or environment configuration:
echo "GEMINI_API_URL=${SERVICE_URL}"

# Update in relevant files:
# - assets/pet-processor-v5-es5.js
# - assets/pet-processor-unified.js
# - Any configuration files that reference the API
```

#### Step 6.2: Test CORS Configuration
```bash
# Test CORS from frontend domain
curl -H "Origin: https://your-test-store.myshopify.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     "${SERVICE_URL}/api/v1/generate" -v
```

## Cost Optimization Measures

### 1. Scale to Zero Configuration
- **Min instances**: 0 (CRITICAL - never change)
- **Max instances**: 5 (adjust based on traffic)
- **Cold start**: ~5-10 seconds (acceptable for cost savings)

### 2. Resource Allocation
- **CPU**: 2 vCPU (sufficient for API operations)
- **Memory**: 2Gi (adequate for image processing)
- **No GPU**: Gemini API handles ML processing

### 3. Caching Strategy
- **Storage caching**: 7-day TTL for generated images
- **SHA256 deduplication**: Prevents duplicate processing
- **CDN potential**: Consider Cloud CDN for static assets

### 4. Monitoring Costs
```bash
# Check current month costs
gcloud billing accounts list
gcloud beta billing budgets list

# Monitor Cloud Run costs
gcloud run services describe gemini-artistic-api \
  --region us-central1 \
  --format="table(status.traffic[].percent,spec.template.spec.containers[].resources)"
```

## Rollback Procedures

### Emergency Rollback
```bash
# List available revisions
gcloud run revisions list --service gemini-artistic-api --region us-central1

# Rollback to previous revision
gcloud run services update-traffic gemini-artistic-api \
  --to-revisions=gemini-artistic-api-00001-abc=100 \
  --region us-central1

# Or redeploy last known good image
gcloud run deploy gemini-artistic-api \
  --image us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:last-known-good \
  --region us-central1
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Cold Start Timeouts
**Symptom**: First request after idle period times out
**Solution**:
- Increase timeout to 300s (already configured)
- Implement frontend retry logic
- Consider scheduled warm-up requests

#### 2. Rate Limit Errors
**Symptom**: 429 Too Many Requests
**Solution**:
- Check Firestore rate_limits collection
- Verify customer_id is being passed
- Review rate limit configuration

#### 3. CORS Errors
**Symptom**: Frontend can't reach API
**Solution**:
```bash
# Reapply CORS configuration
gsutil cors set cors.json gs://perkieprints-processing-cache
```

#### 4. Memory Errors
**Symptom**: Container killed (OOMKilled)
**Solution**:
```bash
# Increase memory allocation
gcloud run services update gemini-artistic-api \
  --memory 4Gi \
  --region us-central1
```

#### 5. Authentication Errors
**Symptom**: 403 Forbidden
**Solution**:
```bash
# Ensure service is publicly accessible
gcloud run services add-iam-policy-binding gemini-artistic-api \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region us-central1
```

## Security Checklist

- [x] API key stored in Secret Manager (not in code)
- [x] HTTPS only (Cloud Run default)
- [x] Rate limiting implemented (Firestore-based)
- [x] Input validation (Pydantic schemas)
- [x] Error messages sanitized (no stack traces)
- [x] Logging configured (Cloud Logging)
- [x] Budget alerts set ($10 daily cap)
- [x] Service account with minimal permissions

## Post-Deployment Tasks

### 1. Performance Testing
```bash
# Load test with Apache Bench
ab -n 100 -c 10 "${SERVICE_URL}/health"

# Monitor metrics
gcloud monitoring metrics-explorer
```

### 2. Documentation Update
- Update API documentation with service URL
- Add to team runbook
- Document rate limits for customers

### 3. Backup Strategy
```bash
# Export Firestore data periodically
gcloud firestore export gs://perkieprints-processing-cache/backups/firestore/$(date +%Y%m%d)
```

## Maintenance Schedule

### Daily
- Monitor error rates in Cloud Logging
- Check budget utilization

### Weekly
- Review Cloud Run metrics
- Clean up old container images
- Update rate limit quotas if needed

### Monthly
- Analyze cost reports
- Review and optimize resource allocation
- Update dependencies if security patches available

## Contact Information

**Service Owner**: Perkie Prints Development Team
**Project ID**: gen-lang-client-0601138686
**Service Name**: gemini-artistic-api
**Region**: us-central1

## Appendix: Quick Commands Reference

```bash
# Get service URL
gcloud run services describe gemini-artistic-api --region us-central1 --format 'value(status.url)'

# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" --limit 50

# Update environment variable
gcloud run services update gemini-artistic-api --update-env-vars KEY=VALUE --region us-central1

# Check service status
gcloud run services describe gemini-artistic-api --region us-central1

# List all revisions
gcloud run revisions list --service gemini-artistic-api --region us-central1

# Delete old revisions
gcloud run revisions delete [REVISION_NAME] --region us-central1

# Monitor real-time metrics
gcloud beta monitoring dashboards create --config-from-file=dashboard.json
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Next Review**: 2025-11-30