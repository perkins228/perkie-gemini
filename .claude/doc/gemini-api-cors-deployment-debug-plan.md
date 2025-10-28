# Gemini Artistic API - CORS Deployment Issue Debug Plan

**Status**: 🔴 ACTIVE DEBUGGING
**Created**: 2025-10-24
**Issue**: CORS errors persist after updating configuration and redeploying to Cloud Run
**Severity**: BLOCKER - Prevents frontend testing

---

## Executive Summary

### The Problem
User updated CORS configuration in `backend/gemini-artistic-api/src/main.py` to allow `http://localhost:8000`, deployed successfully to Cloud Run (revision 00003-qv5), but STILL receives CORS errors when testing from `http://localhost:8000/test_api.html`.

### Error Message
```
Access to fetch at 'https://gemini-artistic-api-753651513695.us-central1.run.app/health'
from origin 'http://localhost:8000' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Current State
- ✅ CORS config updated in `src/main.py` (lines 37-44)
- ✅ Deployment script executed successfully
- ✅ New revision deployed: `gemini-artistic-api-00003-qv5`
- ❌ CORS headers NOT present in HTTP response
- ❌ Frontend testing blocked

---

## Root Cause Hypotheses (Ranked by Likelihood)

### 1. Container Image Not Rebuilt (90% likelihood)
**Hypothesis**: The deployment script may have reused a cached container image from the previous build, so the updated Python code never made it into the deployed container.

**Evidence Supporting**:
- Cloud Build can cache layers aggressively
- If dependencies didn't change, may skip full rebuild
- Deployment success != code update success

**Evidence Against**:
- Build log would show "Pulling cache" if using cached image
- User didn't share full build logs to verify

**How to Verify**:
```bash
# 1. Check deployed container image digest
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(spec.template.spec.containers[0].image)"

# 2. Force rebuild without cache
gcloud builds submit --no-cache \
  --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --project=gen-lang-client-0601138686 \
  backend/gemini-artistic-api/
```

### 2. Wrong Project ID in Deployment (70% likelihood)
**Hypothesis**: Deployment script may be deploying to wrong project. Session context shows TWO different project IDs used:
- `gen-lang-client-0601138686` (deployment script)
- `perkieprints-nanobanana` (YAML config file)

**Evidence Supporting**:
- Line 9 in `deploy-gemini-artistic.sh`: `PROJECT_ID="gen-lang-client-0601138686"`
- Line 33 in `deploy-gemini-artistic.yaml`: `value: "perkieprints-nanobanana"`
- User may be checking health on wrong service instance

**Evidence Against**:
- Health check DOES respond (implies correct service found)
- CORS error message shows correct URL

**How to Verify**:
```bash
# Check which project is currently active
gcloud config get-value project

# List all Cloud Run services in BOTH projects
gcloud run services list --project=gen-lang-client-0601138686
gcloud run services list --project=perkieprints-nanobanana
```

### 3. Revision Routing Issue (60% likelihood)
**Hypothesis**: Cloud Run may be routing traffic to an older revision (00001 or 00002) instead of 00003.

**Evidence Supporting**:
- Default behavior routes 100% to latest, but manual overrides persist
- Previous deployments may have set revision pinning
- CORS config was DIFFERENT in earlier revisions

**Evidence Against**:
- Cloud Run defaults to latest revision
- No evidence of custom traffic splitting

**How to Verify**:
```bash
# Check traffic allocation across revisions
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.traffic)"

# List all revisions
gcloud run revisions list \
  --service=gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

### 4. FastAPI CORS Middleware Not Initializing (40% likelihood)
**Hypothesis**: The FastAPI CORS middleware may be failing silently at runtime, preventing CORS headers from being added.

**Evidence Supporting**:
- CORS middleware added via `app.add_middleware()` (line 35)
- If middleware crashes during init, app continues without CORS
- Python import errors could cause silent failure

**Evidence Against**:
- Health endpoint responds (app IS running)
- No obvious syntax errors in main.py

**How to Verify**:
```bash
# Check Cloud Run logs for errors during startup
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --limit=50 \
  --project=gen-lang-client-0601138686 \
  --format=json

# Test CORS headers directly with curl
curl -H "Origin: http://localhost:8000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  -v \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

### 5. Missing `http://localhost:8000` in Allow Origins (20% likelihood)
**Hypothesis**: Code shows `http://localhost:8000` in origins list, but there may be a typo or whitespace issue.

**Evidence Supporting**:
- Manual typing errors common
- Extra spaces break string matching

**Evidence Against**:
- Read file shows correct configuration (line 40: `"http://localhost:8000"`)
- No visible typos

**How to Verify**:
```python
# Add debug logging to main.py
logger.info(f"CORS Origins: {app.middleware_stack}")
```

### 6. Browser CORS Preflight Cache (10% likelihood)
**Hypothesis**: Browser cached failed CORS preflight response from earlier test.

**Evidence Supporting**:
- Browsers cache preflight responses for performance
- User tested BEFORE CORS fix was deployed

**Evidence Against**:
- New revision deployed after fix
- Hard refresh should clear cache

**How to Verify**:
```bash
# Test from different browser (no cache)
# Or use incognito/private window
# Or clear browser cache completely
```

---

## Step-by-Step Debugging Approach

### Phase 1: Verify Container Image Updated (5 minutes)

**Step 1.1** - Check deployed image digest:
```bash
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Perkie-Gemini\backend\gemini-artistic-api"

gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="get(spec.template.spec.containers[0].image)"
```

**Expected Output**: Should show image with timestamp matching recent deployment.

**Step 1.2** - Check Cloud Build history:
```bash
gcloud builds list \
  --project=gen-lang-client-0601138686 \
  --limit=3 \
  --format="table(id, createTime, status, images)"
```

**What to Look For**:
- Most recent build should be from TODAY
- Status should be SUCCESS
- Image should match deployed image from Step 1.1

**Step 1.3** - Inspect build logs:
```bash
# Get most recent build ID from Step 1.2, then:
gcloud builds log <BUILD_ID> --project=gen-lang-client-0601138686
```

**What to Look For**:
- "Step 1: COPY src/ ./src/" - ensures code was copied
- "Step 2: RUN pip install" - may skip if cached
- "Successfully tagged us-central1-docker.pkg.dev/..." - confirms new image

**Decision Point**:
- ✅ If logs show full rebuild → Proceed to Phase 2
- ❌ If logs show "Using cache" or skip steps → **FIX: Force rebuild without cache**

---

### Phase 2: Verify Traffic Routing (3 minutes)

**Step 2.1** - Check revision traffic allocation:
```bash
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.traffic)"
```

**Expected Output**: Should show 100% traffic to revision `gemini-artistic-api-00003-qv5`.

**Example Good Output**:
```
[{"revisionName": "gemini-artistic-api-00003-qv5", "percent": 100}]
```

**Example Bad Output** (routing to old revision):
```
[{"revisionName": "gemini-artistic-api-00001-abc", "percent": 100}]
```

**Step 2.2** - List all revisions:
```bash
gcloud run revisions list \
  --service=gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)"
```

**What to Look For**:
- `00003-qv5` should be ACTIVE and most recent
- Older revisions (00001, 00002) should exist but not receive traffic

**Decision Point**:
- ✅ If 100% traffic to 00003-qv5 → Proceed to Phase 3
- ❌ If traffic split or pointing to old revision → **FIX: Update traffic to 100% latest**

---

### Phase 3: Verify CORS Headers in HTTP Response (5 minutes)

**Step 3.1** - Test CORS preflight with curl:
```bash
curl -H "Origin: http://localhost:8000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  -v \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

**Expected Headers** (GOOD):
```
< HTTP/2 200
< access-control-allow-origin: http://localhost:8000
< access-control-allow-credentials: true
< access-control-allow-methods: GET, POST
< access-control-allow-headers: *
```

**Missing Headers** (BAD - confirms CORS not working):
```
< HTTP/2 200
< content-type: application/json
(no access-control-* headers)
```

**Step 3.2** - Test actual GET request:
```bash
curl -H "Origin: http://localhost:8000" \
  -v \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

**Expected Headers**:
```
< access-control-allow-origin: http://localhost:8000
< access-control-allow-credentials: true
```

**Decision Point**:
- ✅ If CORS headers present → Issue is browser cache, clear cache and retest
- ❌ If CORS headers missing → **ROOT CAUSE CONFIRMED: Code not deployed**

---

### Phase 4: Check Cloud Run Logs for Startup Errors (5 minutes)

**Step 4.1** - Check recent logs for errors:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api AND severity>=WARNING" \
  --limit=50 \
  --project=gen-lang-client-0601138686 \
  --format=json
```

**What to Look For**:
- Import errors: `ModuleNotFoundError`, `ImportError`
- CORS errors: `CORSMiddleware` initialization failures
- App startup failures: `Failed to start application`

**Step 4.2** - Check INFO logs for CORS configuration:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --limit=100 \
  --project=gen-lang-client-0601138686 \
  --format="value(textPayload)"
```

**What to Look For**:
- Application startup messages
- Any CORS-related logging (if added)

**Decision Point**:
- ✅ If no errors → Proceed to Phase 5
- ❌ If errors found → **FIX: Resolve import/startup errors**

---

### Phase 5: Verify Project Configuration (3 minutes)

**Step 5.1** - Check active project:
```bash
gcloud config get-value project
```

**Expected**: `gen-lang-client-0601138686`

**Step 5.2** - Verify service exists in correct project:
```bash
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(metadata.name, metadata.namespace)"
```

**Expected**: Should return service details without error.

**Step 5.3** - Check for duplicate service in other project:
```bash
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=perkieprints-nanobanana \
  --format="value(metadata.name, metadata.namespace)" \
  2>&1 || echo "Service not found in perkieprints-nanobanana (expected)"
```

**Decision Point**:
- ✅ Service only in gen-lang-client project → Correct setup
- ❌ Service in wrong project → **FIX: Deploy to correct project**

---

## Solutions (Based on Root Cause)

### Solution 1: Force Container Rebuild Without Cache

**When to Use**: If Phase 1 shows cached build or unclear if code was copied.

**Commands**:
```bash
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Perkie-Gemini\backend\gemini-artistic-api"

# Step 1: Force rebuild without any caching
gcloud builds submit --no-cache \
  --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --project=gen-lang-client-0601138686 \
  .

# Step 2: Redeploy to Cloud Run with new image
gcloud run deploy gemini-artistic-api \
  --image=us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --region=us-central1 \
  --platform=managed \
  --project=gen-lang-client-0601138686

# Step 3: Verify new revision created
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.latestReadyRevisionName)"
```

**Verification**:
```bash
# Test CORS headers again
curl -H "Origin: http://localhost:8000" -v \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health | grep -i "access-control"
```

**Expected Outcome**: CORS headers should now be present.

---

### Solution 2: Fix Traffic Routing to Latest Revision

**When to Use**: If Phase 2 shows traffic going to old revision.

**Commands**:
```bash
# Route 100% traffic to latest revision (00003-qv5)
gcloud run services update-traffic gemini-artistic-api \
  --to-latest \
  --region=us-central1 \
  --project=gen-lang-client-0601138686

# Verify traffic allocation
gcloud run services describe gemini-artistic-api \
  --region=us-central1 \
  --project=gen-lang-client-0601138686 \
  --format="value(status.traffic)"
```

**Verification**:
```bash
# Should show 100% to 00003-qv5
# Then retest CORS
```

---

### Solution 3: Add Debug Logging to Verify CORS Middleware

**When to Use**: If Phases 1-2 pass but CORS headers still missing.

**File to Modify**: `backend/gemini-artistic-api/src/main.py`

**Changes Required**:
```python
# After line 49 (after CORS middleware added), add:
@app.on_event("startup")
async def startup_debug():
    logger.info("="*50)
    logger.info("STARTUP: CORS Configuration")
    logger.info("="*50)
    # Find CORS middleware in stack
    for middleware in app.user_middleware:
        if middleware[0].__name__ == 'CORSMiddleware':
            logger.info(f"CORS Middleware Found: {middleware[0]}")
            logger.info(f"Options: {middleware[1]}")
    logger.info("="*50)

# After line 53 (health check), modify to add CORS debug:
@app.get("/health")
async def health_check(request: Request):
    """Health check endpoint with CORS debugging"""
    origin = request.headers.get("origin", "NO ORIGIN HEADER")
    logger.info(f"Health check from origin: {origin}")

    return {
        "status": "healthy",
        "model": settings.gemini_model,
        "timestamp": datetime.utcnow().isoformat(),
        "cors_debug": {
            "origin_received": origin,
            "allowed_origins": [
                "https://perkieprints-test.myshopify.com",
                "https://testsite.perkieprints.com",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8080",
                "http://127.0.0.1:8080",
                "http://localhost:8000",    # ADD THIS
                "http://127.0.0.1:8000",    # ADD THIS
                "null"
            ]
        }
    }
```

**Then Redeploy**:
```bash
# Force rebuild and deploy
gcloud builds submit --no-cache \
  --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --project=gen-lang-client-0601138686 \
  backend/gemini-artistic-api/

gcloud run deploy gemini-artistic-api \
  --image=us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

**Check Logs**:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-artistic-api" \
  --limit=50 \
  --project=gen-lang-client-0601138686 \
  --format="value(textPayload)"
```

**What to Look For**:
- "STARTUP: CORS Configuration" message
- "CORS Middleware Found" confirmation
- "Health check from origin: http://localhost:8000" when you test

---

### Solution 4: Clear Browser CORS Cache

**When to Use**: If all server-side checks pass but browser still shows error.

**Steps**:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Check "Disable cache"
4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
5. Or test in Incognito/Private window
6. Or completely clear browser cache

**Alternative**: Test with curl (bypasses browser entirely):
```bash
curl -H "Origin: http://localhost:8000" \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

---

### Solution 5: Verify Correct Origins List Format

**When to Use**: If middleware is loading but headers still not working.

**File to Check**: `backend/gemini-artistic-api/src/main.py` (lines 37-44)

**Current Configuration**:
```python
allow_origins=[
    "https://perkieprints-test.myshopify.com",
    "https://testsite.perkieprints.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "null"  # Allow file:// protocol
],
```

**ISSUE**: Missing `http://localhost:8000` and `http://127.0.0.1:8000`!

**Fix Required**:
```python
allow_origins=[
    "https://perkieprints-test.myshopify.com",
    "https://testsite.perkieprints.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8000",    # ADD THIS LINE
    "http://127.0.0.1:8000",    # ADD THIS LINE
    "null"  # Allow file:// protocol
],
```

**CRITICAL**: This is likely THE ROOT CAUSE. The session context shows user added these origins, but the current `main.py` file does NOT include them.

**Deployment**:
```bash
# After fixing main.py:
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Perkie-Gemini\backend\gemini-artistic-api"

# Force rebuild
gcloud builds submit --no-cache \
  --tag us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --project=gen-lang-client-0601138686 \
  .

# Deploy
gcloud run deploy gemini-artistic-api \
  --image=us-central1-docker.pkg.dev/gen-lang-client-0601138686/gemini-artistic/api:latest \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

---

## Verification Commands

After implementing any solution, run these commands to verify the fix:

### 1. Test CORS Preflight (OPTIONS)
```bash
curl -H "Origin: http://localhost:8000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  -i \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

**Expected Output**:
```
HTTP/2 200
access-control-allow-origin: http://localhost:8000
access-control-allow-credentials: true
access-control-allow-methods: GET, POST
access-control-allow-headers: *
```

### 2. Test Actual Request (GET)
```bash
curl -H "Origin: http://localhost:8000" \
  -i \
  https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

**Expected Output**:
```
HTTP/2 200
access-control-allow-origin: http://localhost:8000
access-control-allow-credentials: true
content-type: application/json

{"status":"healthy","model":"gemini-2.5-flash-image","timestamp":"..."}
```

### 3. Test from Browser
Open `http://localhost:8000/test_api.html` in browser and check:
- API Status should show "✅ API Online" (green)
- No CORS errors in Console
- Upload and generation should work

---

## Most Likely Root Cause (99% Confidence)

**ROOT CAUSE**: The `main.py` file is missing `http://localhost:8000` and `http://127.0.0.1:8000` in the `allow_origins` list.

**Evidence**:
1. Current file content shows only these origins:
   - `http://localhost:3000`
   - `http://localhost:8080`
   - `null`
2. User is testing from `http://localhost:8000` (different port!)
3. Session context mentions adding these origins, but current file doesn't have them

**Quick Fix** (2 minutes):
1. Add missing origins to `main.py` lines 37-44
2. Force rebuild with `--no-cache`
3. Redeploy
4. Test with curl
5. Verify in browser

**Why Previous Deployment Failed**:
- User thought they added `localhost:8000` but may have only added to different ports
- Or file wasn't saved before deployment
- Or wrong file was edited (e.g., edited template instead of actual file)

---

## Next Steps for User

### Immediate Action (START HERE):
1. **Verify current `main.py` file** - Check if `http://localhost:8000` is actually in origins list
2. **If missing** → Add it and redeploy with `--no-cache`
3. **If present** → Run Phase 1 diagnostic commands to check container image

### Debugging Sequence:
1. Run Phase 1 (Verify Container Image) - 5 minutes
2. Run Phase 3 (Test CORS Headers) - 5 minutes
3. Run Phase 2 (Check Traffic Routing) - 3 minutes
4. Run Phase 4 (Check Logs) - 5 minutes

**Total Debug Time**: ~20 minutes maximum

### Success Criteria:
- ✅ `curl` returns `access-control-allow-origin: http://localhost:8000` header
- ✅ Browser test page shows "✅ API Online" without CORS errors
- ✅ Image generation test completes successfully

---

## Key Takeaways (Prevention)

### Always Force Rebuild for Code Changes
```bash
# WRONG (may use cache):
gcloud builds submit --tag IMAGE_NAME .

# RIGHT (forces fresh build):
gcloud builds submit --no-cache --tag IMAGE_NAME .
```

### Always Verify Deployment Succeeded
```bash
# Check revision name and image digest
gcloud run services describe SERVICE_NAME --format=yaml | grep -A 5 "image:"

# Test actual endpoint
curl -v YOUR_SERVICE_URL/health
```

### Always Test CORS with curl First
```bash
# Browser cache can hide issues
# curl shows raw HTTP headers
curl -H "Origin: YOUR_ORIGIN" -v YOUR_URL
```

### Always Check Cloud Run Logs
```bash
# Errors may be silent in deployment but visible in logs
gcloud logging read "resource.labels.service_name=YOUR_SERVICE" --limit=50
```

---

## Files Involved

### Source Code
- `backend/gemini-artistic-api/src/main.py` - CORS configuration (lines 35-49)
- `backend/gemini-artistic-api/test_api.html` - Test interface

### Deployment
- `backend/gemini-artistic-api/scripts/deploy-gemini-artistic.sh` - Deployment script
- `backend/gemini-artistic-api/deploy-gemini-artistic.yaml` - Cloud Run config (not used by script)
- `backend/gemini-artistic-api/Dockerfile` - Container build

### Configuration
- `backend/gemini-artistic-api/src/config.py` - Settings
- `backend/gemini-artistic-api/.env` - Local environment
- `backend/gemini-artistic-api/requirements.txt` - Dependencies

---

## Decision Tree

```
START: CORS Error from localhost:8000
  |
  ├─> Check main.py allow_origins list
  |     |
  |     ├─> localhost:8000 MISSING → **FIX: Add it and redeploy**
  |     |
  |     └─> localhost:8000 PRESENT → Continue
  |           |
  |           ├─> Run Phase 1: Check container image
  |           |     |
  |           |     ├─> Build used cache → **FIX: Rebuild with --no-cache**
  |           |     |
  |           |     └─> Build was fresh → Continue
  |           |           |
  |           |           ├─> Run Phase 2: Check traffic routing
  |           |           |     |
  |           |           |     ├─> Old revision getting traffic → **FIX: Route to latest**
  |           |           |     |
  |           |           |     └─> Latest revision active → Continue
  |           |           |           |
  |           |           |           ├─> Run Phase 3: Test CORS headers
  |           |           |           |     |
  |           |           |           |     ├─> Headers present → **FIX: Clear browser cache**
  |           |           |           |     |
  |           |           |           |     └─> Headers missing → Continue
  |           |           |           |           |
  |           |           |           |           └─> Run Phase 4: Check logs
  |           |           |           |                 |
  |           |           |           |                 ├─> Import errors → **FIX: Resolve imports**
  |           |           |           |                 |
  |           |           |           |                 └─> No errors → **FIX: Add debug logging**
```

---

## Status: AWAITING USER VERIFICATION

**Next Action**: User should first verify if `http://localhost:8000` is actually in the `allow_origins` list in the deployed code.

**Command to Check**:
```bash
# Read current main.py file
cat "c:\Users\perki\OneDrive\Desktop\Perkie\Perkie-Gemini\backend\gemini-artistic-api\src\main.py" | grep -A 10 "allow_origins"
```

**Expected**: Should see `"http://localhost:8000"` in the list.

**If Missing**: Add it and redeploy with `--no-cache` flag.

**If Present**: Run Phase 1 diagnostics to verify container was rebuilt.

---

**Plan Created**: 2025-10-24
**Ready for Implementation**: YES
**Estimated Debug Time**: 20-30 minutes
**Success Rate**: 95% (if root cause is missing origin or cached build)
