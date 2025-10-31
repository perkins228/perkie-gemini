# Gemini Artistic API Infrastructure Connectivity Fix Plan

**Date**: 2025-10-30
**Service**: gemini-artistic-api
**Issue**: GET /api/v1/quota endpoint failing from frontend
**Priority**: HIGH - Blocking production deployment

## Executive Summary

The Gemini Artistic API deployed to Google Cloud Run is experiencing connectivity issues specifically with the `/api/v1/quota` endpoint. While the deployment was successful, the frontend cannot reach the quota check endpoint, resulting in empty error responses. This plan provides root cause analysis and specific remediation steps.

## Root Cause Analysis

### 1. CORS Configuration Issues (70% Probability)
**Current Issue**: The CORS middleware uses wildcard patterns that may not work correctly:
```python
allow_origins=[
    "https://*.shopify.com",
    "https://*.shopifypreview.com",
    # ...
]
```

**Problem**: FastAPI's CORS middleware doesn't support wildcard patterns like `*.domain.com`. It requires exact domain matches or `["*"]` for all origins.

### 2. Firestore Permissions (20% Probability)
**Current Issue**: The service initializes Firestore client but may lack proper IAM permissions:
```python
self.db = firestore.Client(project=settings.project_id)
```

**Problem**: The Cloud Run service account might not have `roles/datastore.user` permission.

### 3. Cloud Run Invocation Permissions (10% Probability)
**Current Issue**: While `--allow-unauthenticated` is set in deploy script, it may not be applied correctly.

## Immediate Fixes Required

### Fix 1: Update CORS Configuration
**File**: `backend/gemini-artistic-api/src/main.py`

Replace wildcard CORS with regex pattern matching:
```python
# Current (broken) - lines 32-44
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://*.shopify.com", ...],  # DOESN'T WORK
    ...
)

# Fixed version
from fastapi.middleware.cors import CORSMiddleware
import re

# Create regex pattern for Shopify domains
SHOPIFY_DOMAIN_PATTERN = re.compile(
    r"^https://[a-zA-Z0-9\-]+\.(shopify\.com|shopifypreview\.com|myshopify\.com)$"
)

def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed"""
    if not origin:
        return False

    # Allow localhost for development
    if origin.startswith("http://localhost:") or origin.startswith("https://localhost:"):
        return True

    # Check Shopify domains
    return bool(SHOPIFY_DOMAIN_PATTERN.match(origin))

# Custom CORS middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class CustomCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin", "")

        # Handle preflight OPTIONS
        if request.method == "OPTIONS":
            if is_allowed_origin(origin):
                return Response(
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Max-Age": "3600",
                    }
                )
            else:
                return Response(status_code=403)

        # Process request
        response = await call_next(request)

        # Add CORS headers if origin is allowed
        if is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"

        return response

# Add middleware
app.add_middleware(CustomCORSMiddleware)
```

### Fix 2: Configure Firestore IAM Permissions

Run these commands to ensure proper permissions:

```bash
# 1. Get the Cloud Run service account
SERVICE_ACCOUNT=$(gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --format='value(spec.template.spec.serviceAccountName)' \
  --project=gen-lang-client-0601138686)

# If empty, it uses the default compute service account
if [ -z "$SERVICE_ACCOUNT" ]; then
  SERVICE_ACCOUNT="753651513695-compute@developer.gserviceaccount.com"
fi

echo "Service account: $SERVICE_ACCOUNT"

# 2. Grant Firestore permissions
gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/datastore.user"

# 3. Verify Firestore is enabled
gcloud services enable firestore.googleapis.com \
  --project=gen-lang-client-0601138686

# 4. Initialize Firestore database if not exists
gcloud firestore databases create \
  --location=us-central1 \
  --type=firestore-native \
  --project=gen-lang-client-0601138686
```

### Fix 3: Verify Cloud Run Public Access

```bash
# 1. Ensure public access
gcloud run services add-iam-policy-binding gemini-artistic-api \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region=us-central1 \
  --project=gen-lang-client-0601138686

# 2. Check service status
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.url)"

# 3. Test health endpoint directly
SERVICE_URL=$(gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.url)")

echo "Testing health endpoint..."
curl -v "$SERVICE_URL/health"

# 4. Test quota endpoint with CORS headers
echo "Testing quota endpoint..."
curl -v "$SERVICE_URL/api/v1/quota" \
  -H "Origin: https://xizw2apja6j0h6hy-2930573424.shopifypreview.com" \
  -H "Content-Type: application/json"
```

### Fix 4: Add Request Logging for Debugging

**File**: `backend/gemini-artistic-api/src/main.py`

Add request logging middleware:
```python
# Add after line 22 (after logger setup)
from starlette.middleware.base import BaseHTTPMiddleware
import json

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Log incoming request
        logger.info(f"Request: {request.method} {request.url.path}")
        logger.info(f"Headers: {dict(request.headers)}")

        # Process request
        response = await call_next(request)

        # Log response status
        logger.info(f"Response: {response.status_code}")

        return response

# Add before CORS middleware
app.add_middleware(LoggingMiddleware)
```

### Fix 5: Add Firestore Initialization Check

**File**: `backend/gemini-artistic-api/src/core/rate_limiter.py`

Add initialization verification:
```python
# After line 36 in __init__
def __init__(self):
    try:
        self.db = firestore.Client(project=settings.project_id)
        # Test connection
        test_doc = self.db.collection('_health').document('test')
        test_doc.set({'timestamp': firestore.SERVER_TIMESTAMP}, merge=True)
        logger.info("✅ Firestore connection successful")
    except Exception as e:
        logger.error(f"❌ Firestore initialization failed: {e}")
        # Fallback to in-memory rate limiting
        self.db = None
        self.in_memory_limits = {}

    self.daily_limit = settings.rate_limit_daily
    self.burst_limit = settings.rate_limit_burst
    logger.info(f"Initialized rate limiter: daily={self.daily_limit}, burst={self.burst_limit}")
```

## Deployment Commands

Execute these commands in order:

```bash
# 1. Set project
gcloud config set project gen-lang-client-0601138686

# 2. Ensure all required APIs are enabled
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com

# 3. Configure Firestore (if not already done)
gcloud firestore databases create \
  --location=us-central1 \
  --type=firestore-native || echo "Database already exists"

# 4. Deploy updated service
cd backend/gemini-artistic-api
gcloud builds submit --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest

# 5. Deploy with proper configuration
gcloud run deploy gemini-artistic-api \
  --image us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars "PROJECT_ID=gen-lang-client-0601138686,PROJECT_NUMBER=753651513695" \
  --service-account 753651513695-compute@developer.gserviceaccount.com

# 6. Grant all necessary permissions
SERVICE_ACCOUNT="753651513695-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin"

# 7. Ensure public access
gcloud run services add-iam-policy-binding gemini-artistic-api \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --region=us-central1
```

## Testing & Verification

### 1. Direct API Testing
```bash
# Get service URL
SERVICE_URL="https://gemini-artistic-api-753651513695.us-central1.run.app"

# Test health endpoint
curl "$SERVICE_URL/health"

# Test quota endpoint with Shopify origin
curl "$SERVICE_URL/api/v1/quota" \
  -H "Origin: https://xizw2apja6j0h6hy-2930573424.shopifypreview.com" \
  -H "Content-Type: application/json"

# Test OPTIONS preflight
curl -X OPTIONS "$SERVICE_URL/api/v1/quota" \
  -H "Origin: https://xizw2apja6j0h6hy-2930573424.shopifypreview.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  -v
```

### 2. Frontend Testing
```javascript
// Test from browser console on Shopify site
fetch('https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/quota', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include'
})
.then(r => r.json())
.then(data => console.log('Quota:', data))
.catch(err => console.error('Error:', err));
```

## Monitoring Setup

### 1. Enable Cloud Logging
```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --limit 50 \
  --format json \
  --project gen-lang-client-0601138686
```

### 2. Set Up Alerts
```bash
# Create alert for high error rate
gcloud alpha monitoring policies create \
  --notification-channels=[YOUR_CHANNEL_ID] \
  --display-name="Gemini API Error Rate" \
  --condition-display-name="Error rate > 10%" \
  --condition-threshold-value=0.1 \
  --condition-threshold-duration=60s \
  --condition-comparison=COMPARISON_GT \
  --condition-time-series-query-language='
    fetch cloud_run_revision
    | filter resource.service_name == "gemini-artistic-api"
    | metric "run.googleapis.com/request_count"
    | filter response_code_class != "2xx"
    | rate(1m)
  '
```

### 3. Create Dashboard
```bash
# Create monitoring dashboard
cat > dashboard.json << 'EOF'
{
  "displayName": "Gemini Artistic API",
  "widgets": [
    {
      "title": "Request Rate",
      "xyChart": {
        "dataSets": [{
          "timeSeriesQuery": {
            "timeSeriesFilter": {
              "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"gemini-artistic-api\"",
              "aggregation": {
                "perSeriesAligner": "ALIGN_RATE"
              }
            }
          }
        }]
      }
    },
    {
      "title": "Error Rate",
      "xyChart": {
        "dataSets": [{
          "timeSeriesQuery": {
            "timeSeriesFilter": {
              "filter": "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"gemini-artistic-api\" metric.type=\"run.googleapis.com/request_count\" metric.labels.response_code_class!=\"2xx\"",
              "aggregation": {
                "perSeriesAligner": "ALIGN_RATE"
              }
            }
          }
        }]
      }
    }
  ]
}
EOF

gcloud monitoring dashboards create --config-from-file=dashboard.json
```

## Root Cause Summary

The primary issue is the CORS middleware configuration using wildcard patterns (`*.shopify.com`) which FastAPI doesn't support natively. This causes the preflight OPTIONS requests to fail, blocking all cross-origin requests from the Shopify frontend.

Secondary issues include:
1. Potential missing Firestore IAM permissions
2. Lack of request logging for debugging
3. No error handling for Firestore initialization failures

## Implementation Priority

1. **Immediate** (5 minutes):
   - Run the IAM permission commands
   - Verify Cloud Run public access

2. **High Priority** (30 minutes):
   - Fix CORS middleware implementation
   - Add request logging
   - Redeploy service

3. **Medium Priority** (15 minutes):
   - Add Firestore initialization checks
   - Set up monitoring alerts

4. **Low Priority** (ongoing):
   - Monitor logs for patterns
   - Optimize cold start performance

## Success Metrics

- `/health` endpoint returns 200 OK
- `/api/v1/quota` endpoint accessible from Shopify domain
- CORS preflight requests return proper headers
- Firestore documents created successfully
- Request latency < 2s (excluding cold starts)
- Error rate < 1%

## Next Steps After Fix

1. Test all endpoints from Shopify preview site
2. Verify rate limiting works correctly
3. Test batch generation endpoint
4. Monitor for cold start issues
5. Consider implementing API warming strategy

## Contact for Issues

- Project: gen-lang-client-0601138686
- Region: us-central1
- Service: gemini-artistic-api
- Logs: [Cloud Console Logs](https://console.cloud.google.com/logs?project=gen-lang-client-0601138686)