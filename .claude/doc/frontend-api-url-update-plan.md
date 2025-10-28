# Frontend API URL Update - Staging InSPyReNet Implementation Plan

**Date**: 2025-10-28
**Session Context**: `.claude/tasks/context_session_001.md`
**Priority**: HIGH - Unblocks style consolidation testing
**Estimated Time**: 2-3 hours

---

## Executive Summary

**Business Objective**: Update frontend to use new staging InSPyReNet API in gen-lang-client-0601138686 project for testing style consolidation changes.

**Current State**:
- Production API: `https://inspirenet-bg-removal-api-725543555429.us-central1.run.app` (perkieprints-processing)
- New Staging API: `https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app` (gen-lang-client-0601138686)
- Frontend hardcoded to production URL in `assets/api-client.js` line 9

**Target State**:
- Frontend configurable to use either production OR staging API
- Staging API handles: `color`, `enhancedblackwhite` (Modern/Classic via Gemini remain unchanged)
- Easy rollback mechanism if issues arise
- No impact to production deployment until explicitly switched

**Success Criteria**:
- All 4 styles work correctly (Original, B&W, Modern, Classic)
- No console errors related to API URL
- Mobile testing passes (70% of traffic)
- Deployment to staging Shopify environment successful

---

## Root Cause Analysis

**Why This Change is Needed**:

1. **Style Consolidation Implementation**: Backend has removed PopArt/Halftone/8-bit effects to simplify product offering
2. **Deployment Failure Fixed**: Staging API deployment is blocked by import errors (documented in `.claude/doc/cloud-run-gpu-deployment-failure-root-cause-analysis.md`)
3. **Testing Requirement**: Once deployment is fixed, we need frontend to test against new API
4. **Risk Mitigation**: Staging API isolates testing from production traffic

**Why Now**:
- Backend code cleanup must happen FIRST (fixes ModuleNotFoundError)
- Frontend update happens SECOND (after successful deployment verification)
- This plan assumes backend deployment will be successful after cleanup

---

## Technical Analysis

### Current Architecture

**API Integration Points**:

1. **InSPyReNet API Client** (`assets/api-client.js`):
   - Line 9: `this.baseUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';`
   - Handles: Background removal + color/enhancedblackwhite effects
   - Called by: `pet-processor.js` for background removal

2. **Gemini Artistic API Client** (`assets/gemini-artistic-client.js`):
   - Line 9: `this.baseUrl = 'https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app';`
   - Handles: Modern (ink_wash), Classic (van_gogh)
   - **NO CHANGES NEEDED** - Remains on production

3. **Pet Processor** (`assets/pet-processor.js`):
   - Imports both API clients
   - Orchestrates background removal → effect application
   - **NO CHANGES NEEDED** - URL change is transparent

### Files Containing API URL References

**Primary**:
- `assets/api-client.js` (line 9) - **MUST CHANGE**

**Testing/Debug** (optional updates):
- `testing/frontend-debug-script.js` (line 110) - URL check for debugging
- `tests/unified-pet-system.spec.js` (line 319) - Playwright test URL validation

### Configuration Strategy Decision

**Question**: Hardcoded URL vs Environment Variable vs Feature Flag?

**Analysis**:

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Hardcoded URL** | Simple, no complexity, fast deployment | Requires code commit to switch, no dynamic control | ❌ NOT RECOMMENDED |
| **Environment Variable** | Shopify theme doesn't support env vars | N/A - Not possible | ❌ NOT POSSIBLE |
| **Theme Settings Variable** | User-configurable in Shopify admin, dynamic | Requires theme settings schema update, visible to store owner | ✅ **RECOMMENDED** |
| **JavaScript Constant with Comments** | Simple, clear switching mechanism, documented | Still requires commit to switch | ✅ **RECOMMENDED FOR MVP** |

**Decision**: **JavaScript Constant with Comments** (simplest for MVP)

**Rationale**:
1. This is a staging test, not a long-term A/B test framework
2. Shopify GitHub auto-deployment makes commits fast (~1-2 minutes)
3. Clear comments make switching explicit and documented
4. No added complexity for one-time testing
5. Can upgrade to Theme Settings later if needed

**Rollback Strategy**: Simple git revert (< 2 minutes)

---

## Implementation Plan

### Phase 1: Pre-Deployment Verification (Do NOT proceed until complete)

**CRITICAL**: Backend deployment MUST succeed before frontend changes.

**Checklist**:
- [ ] Backend code cleanup completed (`.claude/doc/cloud-run-gpu-deployment-failure-root-cause-analysis.md`)
- [ ] `src/effects/__init__.py` imports fixed
- [ ] `src/effects/effects_processor.py` registrations updated
- [ ] Local test passes: `python src/main.py` starts without errors
- [ ] Cloud Run deployment succeeds
- [ ] Health check passes: `GET https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/health`
- [ ] Manual API test: `POST /api/v2/process-with-effects?return_all_effects=true` returns `color` and `enhancedblackwhite` effects

**DO NOT PROCEED** until ALL checkboxes above are complete.

---

### Phase 2: Frontend URL Update (15-20 minutes)

#### Step 2.1: Update `assets/api-client.js`

**Current Code** (line 7-14):
```javascript
export class APIClient {
  constructor() {
    this.baseUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
    this.cache = new Map();
    this.pending = new Map();
    this.maxRetries = 2;
    this.timeout = 30000; // 30 seconds
  }
```

**New Code** (STAGING):
```javascript
export class APIClient {
  constructor() {
    // ============================================================
    // API URL CONFIGURATION
    // ============================================================
    // STAGING: Style consolidation testing (gen-lang-client-0601138686)
    // - Handles: color, enhancedblackwhite only
    // - Removed: popart, halftone, 8bit effects
    this.baseUrl = 'https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app';

    // PRODUCTION (switch back if staging has issues):
    // this.baseUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
    // ============================================================

    this.cache = new Map();
    this.pending = new Map();
    this.maxRetries = 2;
    this.timeout = 30000; // 30 seconds
  }
```

**Rationale**:
- Clear block comment makes switching explicit
- Documents which project/configuration is active
- Easy to revert: uncomment production, comment staging
- No code logic changes, just URL swap

#### Step 2.2: Update Testing/Debug Files (Optional)

**File**: `testing/frontend-debug-script.js`

**Current** (line 110):
```javascript
if (url && url.includes('inspirenet-bg-removal-api')) {
```

**Change**: No change needed - this is a generic string check that works for both URLs.

**File**: `tests/unified-pet-system.spec.js`

**Current** (line 319):
```javascript
if (url.includes('inspirenet-bg-removal-api') || url.includes('process') || url.includes('remove-background')) {
```

**Change**: No change needed - this is also a generic check.

**Recommendation**: Leave test files unchanged unless specific URL validation is needed.

#### Step 2.3: Verify Gemini API Client (No Changes)

**File**: `assets/gemini-artistic-client.js`

**Current** (line 9):
```javascript
this.baseUrl = 'https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app';
```

**Change**: ✅ **NO CHANGE NEEDED**

**Rationale**: Gemini API for Modern/Classic styles is already working in production. No need to test a different instance.

---

### Phase 3: Local Testing (15-20 minutes)

**Critical Note**: Shopify theme local testing is limited. Use staging deployment for full testing.

#### Step 3.1: Code Review Checklist

- [ ] Only `assets/api-client.js` modified (1 file)
- [ ] URL change documented with comments
- [ ] Production URL preserved in comments for rollback
- [ ] No other code logic changed
- [ ] Git diff shows ONLY the baseUrl line change

#### Step 3.2: Static Analysis

**Check for Hardcoded URLs**:
```bash
# Search for any other references to production API URL
grep -r "inspirenet-bg-removal-api-725543555429" assets/
```

**Expected Result**: Only commented-out line in `api-client.js`

**Check for API Client Instantiation**:
```bash
# Ensure no code creates APIClient with custom baseUrl
grep -r "new APIClient" assets/
```

**Expected Result**: APIClient is imported and instantiated without arguments (uses constructor default)

#### Step 3.3: Browser Console Testing (Desktop)

Open `testing/pet-processor-v5-test.html` (or any test page) in browser:

1. **Open DevTools Console**
2. **Check API Client Initialization**:
   ```javascript
   // After page loads
   console.log(window.apiClient?.baseUrl);
   // Expected: "https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app"
   ```

3. **Test Health Check** (if page exposes API client):
   ```javascript
   fetch('https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/health')
     .then(r => r.json())
     .then(console.log);
   // Expected: { status: "healthy", model_loaded: true }
   ```

---

### Phase 4: Staging Deployment (10-15 minutes)

#### Step 4.1: Git Commit & Push

```bash
# Stage changes
git add assets/api-client.js

# Commit with clear message
git commit -m "Config: Switch InSPyReNet API to staging for style consolidation testing

- Update API baseUrl to gen-lang-client-0601138686 project
- Staging API URL: inspirenet-bg-removal-api-gemini-753651513695
- Handles: color, enhancedblackwhite effects only
- Gemini API unchanged (Modern/Classic styles)
- Production URL preserved in comments for easy rollback

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main (GitHub auto-deploys to Shopify staging)
git push origin main
```

**Expected Timeline**:
- Git push: ~5 seconds
- GitHub processes webhook: ~10-20 seconds
- Shopify deployment: ~1-2 minutes
- Total: **~2-3 minutes** from push to live

#### Step 4.2: Deployment Verification

**Wait for GitHub Deployment**:
1. Check GitHub repository **Actions** tab
2. Wait for workflow to complete (green checkmark)
3. Verify no errors in deployment logs

**Shopify Theme Verification**:
1. Log into Shopify admin
2. Go to **Online Store → Themes**
3. Check theme version updated (latest commit message visible)
4. No error notifications in Shopify admin

---

### Phase 5: Functional Testing (30-40 minutes)

#### Test Plan Overview

**Test Scope**:
- All 4 effect styles (Original, B&W, Modern, Classic)
- Mobile + Desktop (70% mobile traffic priority)
- Background removal + effect application
- Error handling and fallbacks

**Test Environment**: Shopify staging store URL (not localhost)

#### Test Case 1: Background Removal + Color (Original)

**Mobile (Priority)**:
1. Open staging store on mobile device (or Chrome DevTools mobile emulation)
2. Navigate to Pet Background Remover page
3. Upload pet image (test with dog/cat)
4. Verify API call to `inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app`
5. Wait for background removal completion (~3-5s warm, ~11s cold start)
6. Verify "Original" style shows background-removed image
7. Check console for errors (should be clean)

**Desktop**:
1. Repeat steps 1-7 on desktop browser
2. Verify no console errors
3. Confirm image orientation correct (EXIF preserved)

**Expected Result**:
- ✅ Background removed successfully
- ✅ Image displayed without rotation issues
- ✅ Console shows request to staging API URL
- ✅ No 404 or CORS errors

#### Test Case 2: Black & White Effect

**Mobile**:
1. After uploading image (from Test Case 1)
2. Click "B&W" effect button
3. Verify instant switching (no new API call needed)
4. Check image rendering quality

**Desktop**:
1. Repeat steps 1-4
2. Verify effect quality matches expectations

**Expected Result**:
- ✅ B&W effect applied instantly (<100ms)
- ✅ Effect loaded from `window.perkieApiEffects.enhancedblackwhite`
- ✅ No additional network requests
- ✅ Image quality acceptable (high-contrast B&W)

#### Test Case 3: Modern Effect (Gemini API)

**Mobile**:
1. After uploading image
2. Click "Modern" effect button
3. Verify Gemini API call (NOT InSPyReNet staging API)
4. Wait for Gemini processing (~15-20s)
5. Check artistic style rendering (ink wash)

**Desktop**:
1. Repeat steps 1-5
2. Verify rate limit counter increments (localStorage)

**Expected Result**:
- ✅ Gemini API called: `https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app`
- ✅ **NOT staging InSPyReNet API** (this is critical)
- ✅ Modern style applied successfully
- ✅ Rate limit tracking works (5 requests/day)

#### Test Case 4: Classic Effect (Gemini API)

**Mobile**:
1. Repeat Test Case 3 with "Classic" button
2. Verify Van Gogh post-impressionism style
3. Check rate limit decrements

**Desktop**:
1. Repeat mobile steps
2. Verify cross-browser compatibility (Chrome, Safari, Firefox)

**Expected Result**:
- ✅ Classic style applied via Gemini API
- ✅ No calls to InSPyReNet staging API
- ✅ Rate limiting enforced

#### Test Case 5: Error Handling

**Staging API Timeout**:
1. Upload very large image (>10MB)
2. Verify timeout handling (30s default)
3. Check user-facing error message

**Gemini API Rate Limit**:
1. Use DevTools to set localStorage rate limit to max
2. Attempt Modern/Classic effect
3. Verify user-facing error: "Rate limit exceeded..."

**Network Offline**:
1. Toggle DevTools offline mode
2. Attempt upload
3. Verify graceful failure message

**Expected Result**:
- ✅ Clear error messages shown to user
- ✅ No console stack traces visible to user
- ✅ Retry logic works (max 2 retries)

#### Test Case 6: Comparison Mode (Advanced)

**Mobile Long-Press**:
1. Upload image
2. Long-press any effect button (500ms)
3. Verify comparison overlay appears
4. Swipe left/right to compare effects

**Desktop**:
1. Repeat with mouse long-press
2. Verify comparison mode works

**Expected Result**:
- ✅ Comparison mode loads all effects
- ✅ InSPyReNet effects (color, B&W) load from staging API
- ✅ Gemini effects (Modern, Classic) load from Gemini API
- ✅ Smooth swipe/navigation between effects

---

### Phase 6: Monitoring & Validation (Ongoing)

#### Metrics to Track

**API Performance**:
- Staging API response times (target: <3s warm, <11s cold)
- Error rate (target: <1%)
- CORS errors (target: 0)

**User Experience**:
- Effect switching speed (target: <100ms for cached effects)
- Mobile vs Desktop conversion (baseline: 2.8% blended)
- Support tickets related to image processing

**Cost** (Infrastructure Engineer to monitor):
- Staging API costs (target: <$5/day during testing)
- GPU instance hours (target: min-instances=0 enforced)
- Storage costs (GCS bucket for cached images)

#### Monitoring Dashboard

**Google Cloud Console**:
1. Navigate to Cloud Run → `inspirenet-bg-removal-api-gemini`
2. Monitor:
   - Request count
   - Request latency (p50, p95, p99)
   - Error rate
   - Instance count (should scale to 0 when idle)

**Shopify Analytics**:
1. Online Store → Analytics → Behavior
2. Track page views to Pet Background Remover
3. Monitor conversion funnel (upload → effect → add to cart)

**Browser Console (for each test session)**:
1. Check for errors/warnings
2. Monitor network tab for failed requests
3. Verify correct API URLs in request headers

---

## Risk Assessment & Mitigation

### High-Risk Issues

#### Risk 1: Staging API Returns Wrong Effect Types

**Probability**: Medium
**Impact**: High (blocks all image processing)

**Symptoms**:
- Frontend expects `color`, `enhancedblackwhite` but receives `popart`, `dithering`
- Console error: "Effect not found in API response"
- User sees error message instead of processed image

**Root Cause**: Backend deployment still has old effects registered

**Mitigation**:
- **Phase 1 checklist MUST be complete** before frontend changes
- Test backend manually with curl/Postman FIRST:
  ```bash
  curl -X POST "https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/api/v2/process-with-effects?return_all_effects=true" \
       -F "file=@test_pet.jpg" \
       -F "effects=color,enhancedblackwhite" \
       -F "session_id=test_123"

  # Expected response JSON:
  # { "effects": { "color": "base64...", "enhancedblackwhite": "base64..." } }
  ```
- If wrong effects returned, DO NOT proceed with frontend changes

**Rollback**: Revert `api-client.js` to production URL (2 minutes)

#### Risk 2: CORS Configuration Missing/Incorrect

**Probability**: Low (same CORS as production)
**Impact**: High (all requests blocked)

**Symptoms**:
- Console error: "Access to fetch at ... has been blocked by CORS policy"
- Network tab shows OPTIONS preflight failed
- No image processing occurs

**Root Cause**: Staging API CORS headers not configured for Shopify domain

**Mitigation**:
- Staging API should inherit CORS config from production
- Test with curl to verify headers:
  ```bash
  curl -X OPTIONS "https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app/api/v2/process-with-effects" \
       -H "Origin: https://perkie-prints-staging.myshopify.com" \
       -H "Access-Control-Request-Method: POST" \
       -v

  # Expected headers:
  # Access-Control-Allow-Origin: *
  # Access-Control-Allow-Methods: GET, POST, OPTIONS
  ```

**Rollback**: Revert `api-client.js` (2 minutes) OR fix backend CORS (10 minutes)

#### Risk 3: Cold Start Times Exceed Timeout

**Probability**: Medium (30-60s cold start vs 30s timeout)
**Impact**: Medium (first user sees error, subsequent users OK)

**Symptoms**:
- First request after idle period times out
- User sees "Request timed out" error
- Second attempt succeeds (instance now warm)

**Root Cause**: Default 30s timeout in `api-client.js` insufficient for cold starts

**Mitigation**:
- **Already handled**: `api-client.js` line 28 has 45s timeout for initial processing
- Consider frontend pre-warming (page load triggers background warmup call)
- Monitor cold start frequency (should be rare with usage)

**Rollback**: Not needed (timeout already generous), but can increase to 60s if needed

### Medium-Risk Issues

#### Risk 4: Mobile Network Timeout

**Probability**: Medium (cellular connections vary)
**Impact**: Low (retry logic handles this)

**Symptoms**:
- Mobile users see intermittent failures
- Desktop users unaffected
- Console shows "Network error" or timeout

**Root Cause**: Slow 3G/4G connections + large image uploads

**Mitigation**:
- Retry logic already implemented (max 2 retries with exponential backoff)
- Consider image compression before upload (future enhancement)
- Monitor mobile vs desktop error rates separately

**Rollback**: Not needed (inherent network issue)

#### Risk 5: Cached Effects from Old API

**Probability**: Low
**Impact**: Low (visual inconsistency only)

**Symptoms**:
- User switches between production and staging
- Sees mixed effect results (some old PopArt, some new B&W)
- localStorage shows stale data

**Root Cause**: Frontend caching doesn't distinguish API version

**Mitigation**:
- `api-client.js` cleanup() method already revokes blob URLs
- localStorage keys are session-specific (`session_id=perkie_${Date.now()}`)
- Recommend: Clear localStorage before staging tests (`localStorage.clear()`)

**Rollback**: User clears browser cache or localStorage

### Low-Risk Issues

#### Risk 6: Gemini API Unaffected but Users Confused

**Probability**: Low
**Impact**: Low (no functional issue)

**Symptoms**:
- User reports "Modern/Classic still works but Original/B&W broken"
- Confusion about which API is failing

**Root Cause**: Dual-API architecture not obvious to end users

**Mitigation**:
- Clear error messages distinguish InSPyReNet vs Gemini failures
- Internal documentation explains split (this plan)
- Support team trained on architecture

**Rollback**: N/A (not a failure mode)

---

## Rollback Procedure

### Fast Rollback (< 5 minutes)

**If staging API has critical issues during testing:**

1. **Revert `api-client.js`**:
   ```javascript
   // Change line 9 back to production:
   this.baseUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
   ```

2. **Commit & Push**:
   ```bash
   git add assets/api-client.js
   git commit -m "Rollback: Restore production InSPyReNet API URL

   Staging API experiencing issues, reverting to stable production."
   git push origin main
   ```

3. **Wait for Deployment**: ~2-3 minutes (GitHub auto-deploy)

4. **Verify**: Test one image upload on staging store

**Expected Outcome**: Production API restored, all effects working

### Full Rollback (if commit causes other issues)

**Use Git revert** (preserves history):
```bash
# Find commit hash
git log --oneline -5

# Revert the API URL change commit
git revert <commit_hash>

# Push revert commit
git push origin main
```

**Timeline**: ~5 minutes total

---

## Agent Coordination

### Infrastructure Reliability Engineer

**Consultation Needed**: YES

**Questions**:
1. Has the staging API deployment succeeded after code cleanup?
2. Is GPU detection working (`device=cuda` confirmed)?
3. Are Cloud Run metrics showing healthy instances?
4. Is min-instances=0 enforced (cost control)?
5. What's the cold start time distribution (p50, p95, p99)?

**Deliverables**:
- Confirmation of successful staging API deployment
- Health check passing (GET /health returns 200)
- API endpoint test (POST /api/v2/process-with-effects works)
- Performance baseline (latency, error rate)

### Mobile Commerce Architect

**Consultation Needed**: YES (70% of traffic is mobile)

**Questions**:
1. Are there mobile-specific timeout considerations?
2. Should we compress images before upload on mobile?
3. Any known issues with blob URL handling on iOS Safari?
4. Mobile network retry strategy sufficient (2 retries)?

**Deliverables**:
- Mobile testing recommendations beyond this plan
- iOS Safari specific test cases
- Network condition testing matrix (4G, 3G, slow WiFi)

### UX Design E-commerce Expert

**Consultation Needed**: OPTIONAL (low user-facing impact)

**Questions**:
1. Should error messages distinguish between InSPyReNet and Gemini API failures?
2. Any user-facing indication that we're in "testing mode"?
3. Loading states sufficient for cold start scenarios (30-60s)?

**Deliverables**:
- Error message copy improvements (if needed)
- Loading state UX recommendations

### Code Quality Reviewer

**Consultation Needed**: YES (before deployment)

**Questions**:
1. Is the comment-based URL switching approach clean enough?
2. Should we extract baseUrl to a config constant at file top?
3. Any concerns about hardcoded URLs in test files?

**Deliverables**:
- Code review of `api-client.js` changes
- Recommendations for config management approach
- Test file update requirements (if any)

### Solution Verification Auditor

**Consultation Needed**: OPTIONAL (after implementation)

**Questions**:
1. Does this plan address all root causes?
2. Are testing procedures comprehensive enough?
3. Any gaps in rollback strategy?

**Deliverables**:
- Implementation plan verification audit
- Risk assessment validation
- Testing checklist approval

---

## Success Metrics

### Deployment Success

- [ ] Git commit pushed successfully
- [ ] GitHub deployment workflow completes (green checkmark)
- [ ] Shopify theme updated to latest version
- [ ] No error notifications in Shopify admin

### Functional Success

- [ ] Background removal works (color effect)
- [ ] B&W effect applies instantly (no additional API call)
- [ ] Modern effect calls Gemini API (NOT staging InSPyReNet)
- [ ] Classic effect calls Gemini API (NOT staging InSPyReNet)
- [ ] All effects render correctly on mobile
- [ ] All effects render correctly on desktop
- [ ] Error handling works (timeout, network offline)

### Performance Success

- [ ] API response time: <3s warm, <11s cold start (p95)
- [ ] Effect switching: <100ms for cached effects
- [ ] Error rate: <1% of requests
- [ ] CORS errors: 0

### Cost Success (Infrastructure to monitor)

- [ ] Staging API costs: <$5/day during testing period
- [ ] Min-instances=0 enforced (no idle costs)
- [ ] No unexpected quota overage charges

---

## Post-Deployment Actions

### Week 1: Active Monitoring

**Daily Tasks**:
1. Check Cloud Run metrics dashboard (request count, latency, errors)
2. Review Shopify analytics (conversion funnel, page views)
3. Monitor support tickets related to image processing
4. Test on mobile device personally (eat own dog food)

**Weekly Review**:
- Aggregate metrics vs baseline (production API)
- Document any issues discovered
- Share findings with team

### Week 2-4: Data Collection

**Objectives**:
1. Validate style consolidation decision (B&W vs PopArt)
2. Measure conversion impact (if any)
3. Assess user feedback/complaints
4. Evaluate cost savings (fewer effects = less processing)

**Metrics to Track**:
- Effect usage distribution (which styles most popular?)
- Conversion rate before/after (target: maintain 2.8% baseline)
- API cost per order (target: <$0.10/order)
- Support ticket volume (target: no increase)

### Production Cutover Decision

**Criteria for Promotion to Production**:
- [ ] 2+ weeks of successful staging operation
- [ ] Error rate <0.5% consistently
- [ ] No critical bugs reported
- [ ] Cost metrics acceptable
- [ ] User feedback neutral or positive
- [ ] Team consensus on promotion

**Cutover Process**:
1. **Backend**: Deploy staging API code to production project (perkieprints-processing)
2. **Frontend**: Update `api-client.js` back to production URL (different API, same code)
3. **Monitoring**: Watch closely for first 24 hours

---

## Documentation Updates Required

### Update `CLAUDE.md`

**Section**: "🚀 API Endpoints"

**Current**:
```
Production URL: `https://inspirenet-bg-removal-api-725543555429.us-central1.run.app`
```

**After Staging Testing**:
```
Production URL: `https://inspirenet-bg-removal-api-725543555429.us-central1.run.app`
Staging URL: `https://inspirenet-bg-removal-api-gemini-753651513695.us-central1.run.app` (style consolidation testing)
```

### Update `.claude/tasks/context_session_001.md`

**Append to Work Log**:
```markdown
### 2025-10-28 - Frontend API URL Update for Staging InSPyReNet Testing
**Completed by**: Project Manager E-commerce
**Task**: Update frontend to use new staging InSPyReNet API for style consolidation testing

**Changes**:
- Updated `assets/api-client.js` baseUrl to staging API URL
- Documented switching mechanism with comments
- Preserved production URL for easy rollback

**Testing**:
- Verified all 4 effects work (Original, B&W, Modern, Classic)
- Mobile and desktop testing passed
- No CORS or API errors

**Deployment**:
- Commit: [<hash>] - Config: Switch InSPyReNet API to staging
- GitHub auto-deployment: ~2 minutes
- Shopify staging store updated successfully

**Next Steps**:
- Monitor staging API performance for 2-4 weeks
- Collect data on effect usage distribution
- Decide on production cutover based on metrics

**Session Context**: .claude/tasks/context_session_001.md
```

---

## Open Questions (Require Decisions)

### Question 1: Staging Duration

**Question**: How long should frontend use staging API before promoting to production?

**Options**:
- A) 1 week (fast iteration, higher risk)
- B) 2 weeks (balanced, recommended)
- C) 4 weeks (conservative, complete data)

**Recommendation**: **B) 2 weeks** - Balances data collection with iteration speed.

**Decision Maker**: Product team + Infrastructure Engineer

---

### Question 2: Dual API Permanent Split

**Question**: Should InSPyReNet and Gemini APIs remain permanently split, or eventually consolidate?

**Context**: Current architecture has:
- InSPyReNet API: Background removal + deterministic effects (B&W)
- Gemini API: Generative artistic styles (Modern, Classic)

**Options**:
- A) Keep split (current state, simpler backend, clear responsibilities)
- B) Proxy all requests through InSPyReNet (single frontend integration, more complex backend)
- C) Move B&W to Gemini too (simplest, but Gemini is non-deterministic and slower)

**Recommendation**: **A) Keep split** - Each API optimized for its task. InSPyReNet for fast deterministic processing, Gemini for slow generative art.

**Decision Maker**: Product strategy + CV/ML engineer

---

### Question 3: Theme Settings Config (Future Enhancement)

**Question**: Should we add API URL to Shopify theme settings for non-technical switching?

**Pros**:
- Store owner can switch without code commit
- Useful for A/B testing different API versions
- No developer needed for testing

**Cons**:
- Added complexity in theme settings schema
- Risk of accidental production changes by non-technical user
- Not needed for one-time staging test

**Recommendation**: **Defer to future** - Implement only if we need frequent API switching or multi-tenant architecture.

**Decision Maker**: Product team

---

## Conclusion

This implementation plan provides a **low-risk, well-tested approach** to switching the frontend to use the new staging InSPyReNet API for style consolidation testing.

**Key Principles Followed**:
1. ✅ **Root Cause Focus**: Identified exact files and lines requiring changes
2. ✅ **Simplicity**: Minimal code changes (1 file, 1 line effectively)
3. ✅ **Rollback Ready**: Clear, fast rollback procedure (< 5 minutes)
4. ✅ **Testing First**: Comprehensive test plan before production
5. ✅ **Agent Coordination**: Engaged infrastructure, mobile, and quality agents
6. ✅ **Risk Mitigation**: Identified all failure modes with mitigations
7. ✅ **Documentation**: Clear plan for team reference

**Estimated Total Time**: 2-3 hours (excluding backend deployment prerequisite)

**Next Action**: Wait for Infrastructure Reliability Engineer confirmation that backend deployment is successful, then execute Phase 2 (Frontend URL Update).

---

**Plan Author**: Project Manager E-commerce Agent
**Session Context**: `.claude/tasks/context_session_001.md`
**Related Documentation**:
- `.claude/doc/cloud-run-gpu-deployment-failure-root-cause-analysis.md` (backend prerequisite)
- `.claude/doc/style-consolidation-implementation-plan.md` (overall strategy)
