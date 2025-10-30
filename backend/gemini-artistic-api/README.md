# Gemini Artistic API

Google Gemini 2.5 Flash Image API service for generating artistic pet portrait styles.

## Overview

This API generates two artistic styles to replace production InSPyReNet effects:
- **Modern** (Ink Wash) - Replaces Pop Art
- **Classic** (Van Gogh Post-Impressionism) - Replaces Dithering

Combined with production Enhanced B&W and Color effects, users get 4 total styles.

## Architecture

- **FastAPI** application with async/await
- **Gemini 2.5 Flash Image** for artistic generation
- **Cloud Firestore** for rate limiting (5/day per customer)
- **Cloud Storage** for caching with SHA256 deduplication
- **Cloud Run** deployment (scale to zero, no GPU needed)

## Prerequisites

1. **Google Cloud Project**: `gen-lang-client-0601138686` (perkieprints-nanobanana)
2. **APIs Enabled**:
   - Cloud Run
   - Cloud Firestore
   - Cloud Storage
   - Secret Manager
   - Artifact Registry
   - Cloud Build

3. **Local Development**:
   - Python 3.11+
   - gcloud CLI authenticated
   - Docker (optional, for local container testing)

## Setup Infrastructure

### 1. Enable Required APIs

```bash
gcloud services enable run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project=gen-lang-client-0601138686
```

### 2. Create Firestore Database

```bash
gcloud firestore databases create \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

### 3. Configure Storage Bucket

The API uses the existing `perkieprints-processing-cache` bucket with the following structure:
```
perkieprints-processing-cache/
├── gemini-originals/
│   ├── customers/{customer_id}/{image_hash}.jpg
│   └── temp/{session_id}/{image_hash}.jpg
└── gemini-generated/
    ├── customers/{customer_id}/{image_hash}_{style}.jpg
    └── temp/{session_id}/{image_hash}_{style}.jpg
```

Set lifecycle policy for temp files (7-day auto-delete):
```bash
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {
        "age": 7,
        "matchesPrefix": ["gemini-originals/temp/", "gemini-generated/temp/"]
      }
    }]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://perkieprints-processing-cache
```

### 4. Store API Key in Secret Manager (Optional)

For production, store the Gemini API key in Secret Manager:
```bash
echo -n "AIzaSyAP6X8DdL1kPlah25du8s_YzipwOnYd_7I" | \
  gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  --project=gen-lang-client-0601138686

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:753651513695-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=gen-lang-client-0601138686
```

## Local Development

### 1. Install Dependencies

```bash
cd backend/gemini-artistic-api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (defaults are already configured)
```

### 3. Run Locally

```bash
python src/main.py
```

API will be available at: http://localhost:8080

### 4. Test Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Model info
curl http://localhost:8080/model-info

# Check quota
curl "http://localhost:8080/api/v1/quota?session_id=test123"
```

## Deployment

### Quick Deploy

```bash
cd backend/gemini-artistic-api
chmod +x scripts/deploy-gemini-artistic.sh
./scripts/deploy-gemini-artistic.sh
```

### Manual Deploy

```bash
# Set project
gcloud config set project gen-lang-client-0601138686

# Build and push
gcloud builds submit --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest

# Deploy to Cloud Run
gcloud run deploy gemini-artistic-api \
  --image us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300
```

## API Endpoints

### `GET /health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "model": "gemini-2.5-flash-image",
  "styles": ["ink_wash", "van_gogh_post_impressionism"],
  "timestamp": 1234567890.123
}
```

### `GET /model-info`
Get model and configuration information.

### `GET /api/v1/quota`
Check rate limit quota without consuming.

**Query Parameters**:
- `customer_id` (optional): Customer identifier
- `session_id` (optional): Session identifier

**Response**:
```json
{
  "allowed": true,
  "remaining": 5,
  "limit": 5,
  "reset_time": "2025-10-31T00:00:00+00:00"
}
```

### `POST /api/v1/generate`
Generate a single artistic style.

**Request Body**:
```json
{
  "image_data": "data:image/jpeg;base64,...",
  "style": "ink_wash",  // or "van_gogh_post_impressionism"
  "customer_id": "optional_customer_id",
  "session_id": "optional_session_id"
}
```

**Response**:
```json
{
  "success": true,
  "image_url": "https://storage.googleapis.com/...",
  "original_url": "https://storage.googleapis.com/...",
  "style": "ink_wash",
  "cache_hit": false,
  "quota_remaining": 4,
  "quota_limit": 5,
  "processing_time_ms": 5234
}
```

### `POST /api/v1/batch-generate`
Generate both artistic styles in parallel.

**Request Body**:
```json
{
  "image_data": "data:image/jpeg;base64,...",
  "customer_id": "optional_customer_id",
  "session_id": "optional_session_id"
}
```

**Response**:
```json
{
  "success": true,
  "original_url": "https://storage.googleapis.com/...",
  "results": {
    "ink_wash": {
      "style": "ink_wash",
      "image_url": "https://storage.googleapis.com/...",
      "cache_hit": false,
      "processing_time_ms": 5234
    },
    "van_gogh_post_impressionism": {
      "style": "van_gogh_post_impressionism",
      "image_url": "https://storage.googleapis.com/...",
      "cache_hit": false,
      "processing_time_ms": 6123
    }
  },
  "quota_remaining": 3,
  "quota_limit": 5,
  "total_processing_time_ms": 6500
}
```

## Rate Limiting

Three-tier rate limiting using Firestore:
1. **Customer ID**: 5 generations per day (highest priority)
2. **Session ID**: 3 generations per day (burst protection)
3. **IP Address**: 5 generations per day (fallback)

## Caching Strategy

- **SHA256-based deduplication**: Same image always generates same hash
- **7-day TTL**: Temp files auto-delete after 7 days
- **Cache hit = free**: No quota consumed on cache hits
- **Per-style caching**: Each style cached separately

## Cost Estimates

- **Gemini API**: ~$0.002-0.005 per image
- **Cloud Run**: ~$5/month (scale to zero)
- **Firestore**: ~$5/month
- **Storage**: ~$10/month (7-day cache)
- **Total**: ~$20-25/month

## Monitoring

Check service logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --limit 50 \
  --project=gen-lang-client-0601138686
```

## Troubleshooting

### Cold Start Times
First request may take 5-10s due to container startup. Subsequent requests are fast (~2-5s).

### Rate Limit Exceeded
Returns 429 status code. Check quota with `/api/v1/quota` endpoint.

### Gemini API Errors
Check logs for Gemini-specific errors. Verify API key and model name are correct.

### CORS Issues
CORS is configured for Shopify domains. Add additional origins in `src/main.py` if needed.

## Frontend Integration

See main repository documentation for frontend integration examples with `assets/pet-processor-v5-es5.js`.
