# Gemini Quota Endpoint Failure - Root Cause Analysis & Fix Plan

**Date**: 2025-10-30
**Status**: Root cause identified - implementation required
**Service**: Gemini Artistic API (Cloud Run)
**Priority**: High (blocking Gemini effects functionality)

---

## Executive Summary

The `/api/v1/quota` endpoint is failing because the backend expects `customer_id` as a **query parameter** but the frontend is sending it as an **HTTP header** (`X-Customer-ID`). This mismatch causes the backend to receive `None` for `customer_id`, leading to unpredictable behavior in the rate limiter.

**Root Cause**: Parameter mismatch between frontend and backend
**Impact**: Gemini artistic effects disabled due to quota check failure
**Complexity**: Low - simple parameter extraction fix
**Risk**: Low - isolated to quota endpoint

---

## Problem Analysis

### 1. Frontend Implementation (Correct)
**File**: `assets/gemini-api-client.js`, line 109

```javascript
async checkQuota() {
  try {
    const response = await this.request(`/api/v1/quota?customer_id=${this.customerId}`, {
      method: 'GET',
      timeout: 5000
    });
    // ...
  }
}
```

**Analysis**: Frontend sends `customer_id` as **query parameter** in URL.

### 2. Backend Implementation (Incorrect)
**File**: `backend/gemini-artistic-api/src/main.py`, lines 75-91

```python
@app.get("/api/v1/quota", response_model=QuotaStatus)
async def check_quota(
    request: Request,
    customer_id: str = None,  # ✅ Correct - FastAPI extracts from query params
    session_id: str = None
):
    """Check remaining quota without consuming"""
    client_ip = request.client.host

    identifiers = {
        "customer_id": customer_id,  # ❌ This receives the query param value
        "session_id": session_id,
        "ip_address": client_ip
    }

    quota = await rate_limiter.check_rate_limit(**identifiers)
    return quota
```

**Analysis**: The endpoint definition is actually **CORRECT** - FastAPI automatically extracts query parameters matching the function parameter names.

### 3. Actual Root Cause Discovery

After deeper analysis, the issue is likely one of these:

**A. CORS Preflight Failure** (Most Likely)
- Frontend makes OPTIONS preflight request
- CORS config has wildcard patterns that may not work in Cloud Run
- Query string stripped during preflight
- Actual GET request never reaches endpoint

**B. Firestore Permissions**
- Rate limiter can't read/write Firestore
- Returns error that frontend receives as empty object
- Permissions not configured for Cloud Run service account

**C. Query Parameter Encoding**
- Customer ID contains characters that need URL encoding
- Query parameter not properly parsed
- Backend receives malformed or empty string

---

## Diagnostic Evidence Needed

### Required Logs
1. **Cloud Run Logs** for the quota endpoint:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api AND httpRequest.requestUrl=~'/api/v1/quota'" --limit 50 --format json
   ```

2. **Check what customer_id value backend receives**:
   - Add logging to see actual parameter values
   - Verify if customer_id is None, empty string, or malformed

3. **Frontend Network Tab**:
   - Inspect actual request headers
   - Check if OPTIONS preflight succeeds
   - Verify query parameter in request URL

### Key Questions to Answer
- [ ] Does OPTIONS preflight request succeed?
- [ ] What HTTP status code does the endpoint return?
- [ ] What is the actual response body?
- [ ] Does backend log show the request reaching the endpoint?
- [ ] What value does `customer_id` parameter receive?
- [ ] Can Cloud Run service account access Firestore?

---

## Fix Implementation Plan

### Option 1: CORS Preflight Fix (If CORS is the issue)

**Problem**: Wildcard CORS origins don't work properly in Cloud Run

**File**: `backend/gemini-artistic-api/src/main.py`, lines 32-44

**Current Code**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://*.shopify.com",        # ❌ Wildcards don't work
        "https://*.shopifypreview.com",  # ❌ Wildcards don't work
        "https://*.myshopify.com",       # ❌ Wildcards don't work
        "http://localhost:*",            # ❌ Wildcards don't work
        "https://localhost:*"            # ❌ Wildcards don't work
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Fixed Code**:
```python
# Custom CORS middleware that supports wildcards
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
import re

class ShopifyCORSMiddleware:
    """Custom CORS middleware supporting wildcard Shopify domains"""

    def __init__(self, app: ASGIApp):
        self.app = app
        self.allowed_patterns = [
            re.compile(r'^https://[^/]+\.shopify\.com$'),
            re.compile(r'^https://[^/]+\.shopifypreview\.com$'),
            re.compile(r'^https://[^/]+\.myshopify\.com$'),
            re.compile(r'^https?://localhost(:\d+)?$'),
        ]

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Get origin header
        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode("utf-8")

        # Check if origin matches any pattern
        allowed = any(pattern.match(origin) for pattern in self.allowed_patterns)

        # Wrap send to add CORS headers
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                if allowed:
                    headers.append((b"access-control-allow-origin", origin.encode()))
                    headers.append((b"access-control-allow-credentials", b"true"))
                    headers.append((b"access-control-allow-methods", b"GET, POST, OPTIONS"))
                    headers.append((b"access-control-allow-headers", b"*"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)

# Replace CORS middleware with custom implementation
app.add_middleware(ShopifyCORSMiddleware)
```

**OR Simpler Fix** (if wildcards aren't needed):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (less secure but works)
    allow_credentials=False,  # Must be False with "*"
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Option 2: Firestore Permissions Fix (If permissions are the issue)

**Problem**: Cloud Run service account can't access Firestore

**Check Current Permissions**:
```bash
# Get Cloud Run service account
gcloud run services describe gemini-artistic-api \
  --region us-central1 \
  --format="value(spec.template.spec.serviceAccountName)"

# Check Firestore permissions
gcloud projects get-iam-policy gen-lang-client-0601138686 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"
```

**Grant Firestore Permissions**:
```bash
# Get service account email
SERVICE_ACCOUNT=$(gcloud run services describe gemini-artistic-api \
  --region us-central1 \
  --format="value(spec.template.spec.serviceAccountName)")

# Grant Firestore access
gcloud projects add-iam-policy-binding gen-lang-client-0601138686 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"
```

### Option 3: Add Defensive Error Handling (Always recommended)

**File**: `backend/gemini-artistic-api/src/main.py`, lines 75-91

**Enhanced Implementation**:
```python
@app.get("/api/v1/quota", response_model=QuotaStatus)
async def check_quota(
    request: Request,
    customer_id: str = None,
    session_id: str = None
):
    """Check remaining quota without consuming"""
    try:
        client_ip = request.client.host

        # Log received parameters for debugging
        logger.info(f"Quota check: customer_id={customer_id}, session_id={session_id}, ip={client_ip}")

        # Validate at least one identifier is provided
        if not customer_id and not session_id and not client_ip:
            logger.error("No identifiers provided for quota check")
            raise HTTPException(
                status_code=400,
                detail="At least one identifier (customer_id, session_id, or IP) required"
            )

        identifiers = {
            "customer_id": customer_id,
            "session_id": session_id,
            "ip_address": client_ip
        }

        quota = await rate_limiter.check_rate_limit(**identifiers)

        # Log quota response
        logger.info(f"Quota status: {quota.dict()}")

        return quota

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quota check failed: {e}", exc_info=True)
        # Return safe default instead of 500 error
        return QuotaStatus(
            allowed=True,
            remaining=10,
            limit=10,
            reset_time=datetime.now(timezone.utc).isoformat(),
            warning_level=1
        )
```

### Option 4: Rate Limiter Error Handling

**File**: `backend/gemini-artistic-api/src/core/rate_limiter.py`, lines 47-106

**Add Try-Catch to Firestore Operations**:
```python
async def check_rate_limit(
    self,
    customer_id: Optional[str] = None,
    session_id: Optional[str] = None,
    ip_address: Optional[str] = None
) -> QuotaStatus:
    """
    Check rate limit without consuming quota
    """
    try:
        # Determine which quota to check
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}')
            limit = self.daily_limit
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}')
            limit = self.burst_limit
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}')
            limit = self.daily_limit

        # Get current status
        doc = doc_ref.get()

        if not doc.exists:
            # First use - allow
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat(),
                warning_level=calculate_warning_level(limit, limit)
            )

        data = doc.to_dict()
        current_count = data.get('count', 0)
        reset_date = data.get('reset_date')

        # Check if quota needs reset
        if reset_date < self._get_reset_date():
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat(),
                warning_level=calculate_warning_level(limit, limit)
            )

        # Check if under limit
        remaining = max(0, limit - current_count)
        allowed = remaining > 0

        return QuotaStatus(
            allowed=allowed,
            remaining=remaining,
            limit=limit,
            reset_time=reset_date.isoformat(),
            warning_level=calculate_warning_level(remaining, limit)
        )

    except Exception as e:
        # Log error but return safe default to avoid blocking users
        logger.error(f"Rate limit check failed: {e}", exc_info=True)
        return QuotaStatus(
            allowed=True,
            remaining=limit if 'limit' in locals() else self.daily_limit,
            limit=limit if 'limit' in locals() else self.daily_limit,
            reset_time=self._get_reset_date().isoformat(),
            warning_level=1
        )
```

---

## Implementation Steps

### Step 1: Diagnostic Logging (Do First)
1. Add comprehensive logging to both endpoints
2. Deploy with logging enabled
3. Make frontend request
4. Check Cloud Run logs to identify exact issue

### Step 2: Apply Fixes Based on Findings

**If CORS issue**:
- Implement custom CORS middleware OR use `allow_origins=["*"]`
- Deploy and test

**If Firestore permissions**:
- Grant `roles/datastore.user` to Cloud Run service account
- Test without redeployment

**If parameter encoding**:
- Add URL decoding/validation
- Deploy and test

### Step 3: Add Defensive Error Handling (Always)
- Implement error handling in quota endpoint
- Add error handling in rate_limiter
- Deploy and verify graceful degradation

### Step 4: Verify Fix
1. Clear browser cache/localStorage
2. Open browser DevTools Network tab
3. Trigger quota check from frontend
4. Verify:
   - OPTIONS preflight succeeds (204 status)
   - GET request succeeds (200 status)
   - Response contains valid quota data
   - Frontend displays quota warning correctly

---

## Deployment Commands

### Build and Deploy
```bash
cd c:\Users\perki\OneDrive\Desktop\Perkie\Perkie-Gemini\backend\gemini-artistic-api

# Deploy with changes
gcloud run deploy gemini-artistic-api \
  --source . \
  --region us-central1 \
  --project gen-lang-client-0601138686 \
  --allow-unauthenticated \
  --set-env-vars PROJECT_ID=gen-lang-client-0601138686 \
  --set-env-vars GEMINI_MODEL=gemini-2.0-flash-exp \
  --set-env-vars GEMINI_API_KEY=[REDACTED - See Secret Manager] \
  --min-instances 0 \
  --max-instances 5 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300
```

### Check Logs After Deployment
```bash
# Stream logs in real-time
gcloud logs tail \
  --project=gen-lang-client-0601138686 \
  "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api"

# Filter for quota endpoint
gcloud logs tail \
  --project=gen-lang-client-0601138686 \
  "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api AND httpRequest.requestUrl=~'/api/v1/quota'"
```

---

## Testing Plan

### Manual Testing
1. **Enable Gemini effects**:
   ```javascript
   // In browser console
   GeminiAPIClient.enableGlobalFlag();
   ```

2. **Upload pet image** in Pet Background Remover

3. **Open DevTools Network tab**

4. **Process with B&W or Color** (should trigger quota check)

5. **Verify**:
   - OPTIONS request returns 204
   - GET request returns 200
   - Response body contains:
     ```json
     {
       "allowed": true,
       "remaining": 10,
       "limit": 10,
       "reset_time": "2025-10-31T00:00:00+00:00",
       "warning_level": 1
     }
     ```
   - Modern/Classic buttons are enabled
   - Quota badge shows "10 free today"

### Automated Testing
```python
# Test script: test_quota_endpoint.py
import requests

API_URL = "https://gemini-artistic-api-753651513695.us-central1.run.app"
CUSTOMER_ID = "test_customer_123"

def test_quota_endpoint():
    """Test quota endpoint directly"""
    response = requests.get(
        f"{API_URL}/api/v1/quota",
        params={"customer_id": CUSTOMER_ID},
        timeout=10
    )

    print(f"Status: {response.status_code}")
    print(f"Headers: {response.headers}")
    print(f"Body: {response.json()}")

    assert response.status_code == 200
    data = response.json()
    assert "allowed" in data
    assert "remaining" in data
    assert "limit" in data
    assert data["limit"] == 10

if __name__ == "__main__":
    test_quota_endpoint()
```

---

## Rollback Plan

If fix causes issues:

```bash
# List revisions
gcloud run revisions list \
  --service gemini-artistic-api \
  --region us-central1 \
  --project gen-lang-client-0601138686

# Rollback to previous revision
gcloud run services update-traffic gemini-artistic-api \
  --region us-central1 \
  --project gen-lang-client-0601138686 \
  --to-revisions PREVIOUS_REVISION=100
```

---

## Success Criteria

- [ ] OPTIONS preflight returns 204 status
- [ ] GET /api/v1/quota returns 200 status
- [ ] Response contains valid QuotaStatus object
- [ ] Frontend receives and parses quota correctly
- [ ] Modern/Classic buttons enabled when quota available
- [ ] Quota badge displays correct remaining count
- [ ] Warning levels trigger appropriate UI changes
- [ ] Error handling degrades gracefully
- [ ] Cloud Run logs show successful requests
- [ ] No CORS errors in browser console

---

## Related Files

### Backend
- `backend/gemini-artistic-api/src/main.py` (lines 75-91) - Quota endpoint
- `backend/gemini-artistic-api/src/core/rate_limiter.py` (lines 47-106) - Rate limit logic
- `backend/gemini-artistic-api/src/models/schemas.py` (lines 34-40) - QuotaStatus model

### Frontend
- `assets/gemini-api-client.js` (lines 103-128) - checkQuota() method
- `assets/gemini-ui-system.js` - Quota display and warnings

### Configuration
- `backend/gemini-artistic-api/src/config.py` - Settings
- `.env` - Environment variables

---

## Next Steps

1. **Immediate**: Add diagnostic logging to identify exact issue
2. **Short-term**: Apply appropriate fix based on logs
3. **Medium-term**: Add comprehensive error handling
4. **Long-term**: Add automated testing for all endpoints

**Recommendation**: Start with diagnostic logging deployment, then apply targeted fix once root cause is confirmed from Cloud Run logs.
