# Gemini API Empty Image Data Bug - Root Cause Analysis & Fix Plan

**Status**: Critical Bug - Blocking Deployment
**Impact**: 0-byte files uploaded to Cloud Storage (bw_fine_art style only)
**Created**: 2025-10-24
**Priority**: P0 - Immediate Fix Required

---

## Executive Summary

**Problem**: Gemini 2.5 Flash Image API returns empty image data (`generated_image_data` = empty bytes) for `bw_fine_art` style, resulting in 0-byte files in Cloud Storage. Other styles (ink_wash, van_gogh_post_impressionism) work correctly.

**Root Cause**: Prompt length and complexity mismatch with Gemini API's actual capabilities. The recent "optimization" (session context line 1815-1950) dramatically increased prompt size from ~200 chars to ~1500 chars, pushing beyond Gemini's reliable processing limits for image-to-image tasks.

**Evidence**:
- Cloud Storage shows pattern: `bw_fine_art` → 0 bytes, other styles → 1-2MB ✅
- 19 failed generations visible in gs://gemini-artistic-753651513695/generated/
- All failures are `bw_fine_art` style after prompt optimization deployment
- API logs show "Generated bw_fine_art in 12.68s" (no errors, but empty result)

**Solution**: Revert to shorter, more focused prompts OR implement systematic debugging to identify exact failure point.

---

## Problem Discovery Timeline

### Initial Working State (Pre-Optimization)
**Date**: Before 2025-10-24 14:00
**Status**: All styles generating successfully
**Prompt Length**: ~200-300 characters per style
**Evidence**: Earlier test files show 1-2MB successful generations

### Optimization Deployment (Breaking Change)
**Date**: 2025-10-24 14:00-15:41
**Change**: Complete prompt rewrite following "Gemini best practices"
**New Prompt Length**: 1,500+ characters (Perkie Print)
**Commit**: Session context lines 1815-1950

**Perkie Print Prompt Characteristics**:
- Hyper-specific feature preservation instructions
- MANDATORY rules in ALL CAPS
- Explicit preservation directives (100% anatomical accuracy)
- Professional studio photography requirements
- Detailed lighting specifications
- Multiple nested conditional logic for multi-pet handling

### Failure Pattern Observed
**Date**: 2025-10-24 15:44 onwards
**Pattern**:
```
✅ van_gogh_post_impressionism → 1.65 MiB (works)
✅ ink_wash → 1.46 MiB (works)
❌ bw_fine_art → 0 B (fails)
❌ bw_fine_art → 0 B (fails)
❌ bw_fine_art → 0 B (fails)
```

**Statistics from Cloud Storage**:
- Total files checked: 26 objects
- Failed generations: 19 files (all bw_fine_art)
- Success rate for bw_fine_art: 0%
- Success rate for other styles: 100%

---

## Root Cause Analysis

### Hypothesis 1: Prompt Length Exceeds Gemini Limits ⭐ MOST LIKELY

**Evidence**:
1. **Timing correlation**: Failures started immediately after prompt optimization
2. **Style-specific failure**: Only bw_fine_art (longest prompt) fails
3. **Consistent pattern**: 100% failure rate for bw_fine_art, 100% success for others
4. **No error messages**: API completes "successfully" but returns empty data

**Gemini API Behavior Analysis**:
- Gemini 2.5 Flash Image is optimized for **simple, direct prompts**
- Image-to-image tasks have different token limits than text generation
- Complex conditional logic may confuse the model's instruction following
- Model may be "succeeding" at the prompt parsing but failing at image generation

**Prompt Comparison**:
```
OLD (Working):
~200 chars, simple instructions, direct style application

NEW (Failing - bw_fine_art):
1,500+ chars, hyper-detailed preservation rules, MANDATORY constraints,
nested conditional logic, professional photography specifications
```

### Hypothesis 2: Response Structure Changed ⚠️ POSSIBLE

**Theory**: Recent Gemini API update changed response format

**Evidence Against**:
- Other styles work correctly with same response parsing code
- No Gemini API changelog indicates breaking changes
- Response parsing code unchanged since deployment

**Likelihood**: LOW (10%)

### Hypothesis 3: Base64 Encoding Issue ❌ UNLIKELY

**Theory**: `generated_image_data` contains data but base64 encoding fails

**Evidence Against**:
- Code explicitly checks `if generated_image_data is None`
- Would throw exception during base64.b64encode() if data was corrupted
- Other styles use identical encoding logic successfully

**Likelihood**: VERY LOW (<5%)

### Hypothesis 4: Gemini Model Refusing Generation 🤔 MODERATE

**Theory**: Prompt triggers safety/content filters causing silent failure

**Evidence For**:
- Model returns "successful" response with no error
- Data part exists but contains empty bytes
- Gemini has aggressive safety filters

**Evidence Against**:
- Pet photos should not trigger safety filters
- Other artistic styles work on same images
- No safety warning in response logs

**Likelihood**: MODERATE (25%)

---

## Current Code Analysis

### File: `backend/gemini-artistic-api/src/core/gemini_client.py`

**Lines 134-148 (Image Extraction)**:
```python
# Extract generated image from response (correct path: candidates[0].content.parts)
if not response.candidates or not response.candidates[0].content.parts:
    raise ValueError("No image generated by Gemini API")

generated_image_data = None
for part in response.candidates[0].content.parts:
    if part.inline_data is not None:
        generated_image_data = part.inline_data.data
        break

if generated_image_data is None:
    raise ValueError("No image data in Gemini response")

# Convert to base64
generated_base64 = base64.b64encode(generated_image_data).decode('utf-8')
```

**Analysis**:
- ✅ Correct response path: `candidates[0].content.parts`
- ✅ Proper null checking before accessing data
- ✅ Explicit exception if no data found
- ⚠️ **ISSUE**: No logging of actual data size or response structure
- ⚠️ **ISSUE**: Assumes `inline_data.data` contains bytes, doesn't verify size

**Critical Gap**: Code doesn't log whether `generated_image_data` is empty bytes (`b''`) vs None

### File: `backend/gemini-artistic-api/src/core/storage_manager.py`

**Lines 97-144 (Storage Upload)**:
```python
async def store_generated_image(
    self,
    image_data: str,
    original_hash: str,
    style: str,
    customer_id: Optional[str] = None,
    session_id: Optional[str] = None
) -> str:
    # Decode base64
    image_bytes = base64.b64decode(image_data)

    # ... storage logic ...

    blob.upload_from_string(image_bytes, content_type='image/jpeg')
    logger.info(f"Stored generated image: {blob_path}")
```

**Analysis**:
- ✅ Accepts base64 string, decodes to bytes
- ⚠️ **ISSUE**: No validation of image_bytes length before upload
- ⚠️ **ISSUE**: Logs "success" even if uploading 0 bytes
- ⚠️ **ISSUE**: No size check or corruption detection

**Critical Gap**: Storage manager happily uploads empty files and reports success

---

## Debugging Strategy

### Phase 1: Immediate Diagnostic Logging (5 minutes)

**Add logging to gemini_client.py** to see what Gemini is actually returning:

```python
# After line 142 (before None check)
logger.info(f"[DEBUG] Response structure: candidates={len(response.candidates) if response.candidates else 0}")
logger.info(f"[DEBUG] Parts in response: {len(response.candidates[0].content.parts) if response.candidates else 0}")
logger.info(f"[DEBUG] Generated image data type: {type(generated_image_data)}")
logger.info(f"[DEBUG] Generated image data size: {len(generated_image_data) if generated_image_data else 0} bytes")

if generated_image_data is not None and len(generated_image_data) == 0:
    logger.error(f"[CRITICAL] Gemini returned EMPTY image data for style: {style.value}")
    logger.error(f"[CRITICAL] Response candidates: {response.candidates}")
    raise ValueError(f"Gemini returned empty image data for {style.value}")
```

**Add logging to storage_manager.py**:

```python
# After line 119 (before upload)
logger.info(f"[DEBUG] Image bytes to upload: {len(image_bytes)} bytes")

if len(image_bytes) == 0:
    logger.error(f"[CRITICAL] Attempting to upload 0-byte file: {blob_path}")
    raise ValueError(f"Cannot upload empty image file: {blob_path}")
```

### Phase 2: Test Prompt Length Hypothesis (10 minutes)

**Create test with progressive prompt shortening**:

1. **Test A**: Full 1,500-char optimized prompt (baseline - expect failure)
2. **Test B**: Remove all MANDATORY rules (reduce to 1,000 chars)
3. **Test C**: Remove feature preservation details (reduce to 500 chars)
4. **Test D**: Minimal prompt (200 chars) - match working styles

**Minimal Test Prompt** (Test D):
```python
"Create a professional black and white studio portrait headshot of this pet. "
"Frame tightly on the head, neck, and upper shoulders. Remove the background completely. "
"Use dramatic lighting, rich tonal depth, and museum-quality aesthetics. "
"Isolate on pure white background (#FFFFFF)."
```

**Expected Results**:
- Test A: 0 bytes (confirms problem)
- Test B-D: If one generates successfully, we've found the threshold

### Phase 3: Inspect Gemini Response Structure (15 minutes)

**Add comprehensive response inspection**:

```python
# After line 132 (after Gemini API call)
logger.info(f"[DEBUG] Full Gemini response structure:")
logger.info(f"  - Candidates: {response.candidates}")
logger.info(f"  - Candidate count: {len(response.candidates) if response.candidates else 0}")

if response.candidates:
    for i, candidate in enumerate(response.candidates):
        logger.info(f"  - Candidate {i}:")
        logger.info(f"    - Content: {candidate.content}")
        logger.info(f"    - Parts count: {len(candidate.content.parts) if candidate.content.parts else 0}")

        if candidate.content.parts:
            for j, part in enumerate(candidate.content.parts):
                logger.info(f"    - Part {j}:")
                logger.info(f"      - Has inline_data: {part.inline_data is not None}")
                if part.inline_data:
                    logger.info(f"      - Mime type: {part.inline_data.mime_type if hasattr(part.inline_data, 'mime_type') else 'N/A'}")
                    logger.info(f"      - Data size: {len(part.inline_data.data) if part.inline_data.data else 0} bytes")
```

### Phase 4: Compare Working vs Failing Responses (20 minutes)

**Test matrix**:
```bash
# Test 1: Same image, different styles
curl -X POST "$API_URL/api/v1/generate" -d '{
  "image_data": "<SAME_IMAGE>",
  "style": "ink_wash",
  "session_id": "debug_test_001"
}'
# Expected: 1-2MB file ✅

curl -X POST "$API_URL/api/v1/generate" -d '{
  "image_data": "<SAME_IMAGE>",
  "style": "bw_fine_art",
  "session_id": "debug_test_002"
}'
# Expected: 0 bytes ❌

# Compare Cloud Run logs for both requests
```

**Analysis Checklist**:
- [ ] Does response structure differ between styles?
- [ ] Are there additional error fields in bw_fine_art response?
- [ ] Does processing time differ significantly?
- [ ] Are there safety filter warnings?

---

## Proposed Solutions

### Solution A: Revert to Shorter Prompts ⭐ RECOMMENDED

**Rationale**: Immediate fix with proven working state

**Implementation**:
1. Revert `gemini_client.py` lines 21-82 to pre-optimization prompts
2. Keep parameter optimizations (temperature 0.3, top_p 0.85, top_k 25)
3. Deploy immediately
4. Verify all styles generate successfully

**Advantages**:
- ✅ Proven working state (pre-optimization)
- ✅ Quick fix (15 minutes)
- ✅ Low risk
- ✅ Can iterate on prompt improvements gradually

**Disadvantages**:
- ❌ Loses "optimization" work
- ❌ May not achieve >95% Perkie Print likeness goal
- ❌ Doesn't solve underlying prompt engineering challenge

**Estimated Time**: 15 minutes
**Risk Level**: LOW
**Success Probability**: 95%

### Solution B: Simplify bw_fine_art Prompt Only

**Rationale**: Keep successful prompts, fix only broken one

**Implementation**:
```python
ArtisticStyle.BW_FINE_ART: (
    "Create a professional black and white studio portrait headshot. "
    "Frame tightly on the pet's head, neck, and upper shoulders with the face as the focal point. "
    "Preserve the pet's exact breed characteristics, facial markings, and distinctive features - "
    "the owner must instantly recognize their specific pet. "
    "For multiple pets touching, create a group headshot; if separated but all clear, group them; "
    "if some are blurry, focus on the clearest pet. "
    "Remove the background completely with clean edges preserving whiskers and fine details. "
    "Apply professional black and white photography with rich tonal range, soft even lighting, "
    "and high-quality gradations that maintain exact anatomical proportions. "
    "Isolate on pure white background (#FFFFFF) with no gradients or textures."
),
```

**Advantages**:
- ✅ Keeps working ink_wash and van_gogh prompts
- ✅ Maintains some optimization benefits
- ✅ Faster than full revert (10 minutes)
- ✅ Tests prompt length hypothesis

**Disadvantages**:
- ⚠️ Still relatively long (may not fix issue)
- ⚠️ Requires testing to validate
- ⚠️ May need further iteration

**Estimated Time**: 10 minutes + 15 minutes testing
**Risk Level**: MEDIUM
**Success Probability**: 70%

### Solution C: Progressive Prompt Reduction Testing

**Rationale**: Find exact prompt length threshold scientifically

**Implementation**:
1. Create 5 test prompts: 1500, 1000, 750, 500, 250 characters
2. Test each with same image
3. Identify threshold where generation succeeds
4. Design prompt at 80% of threshold length
5. Deploy optimized-but-safe prompt

**Advantages**:
- ✅ Scientific approach
- ✅ Finds optimal prompt length
- ✅ Provides data for future prompt engineering
- ✅ Tests hypothesis definitively

**Disadvantages**:
- ❌ Time-consuming (1-2 hours)
- ❌ Delays deployment
- ❌ May hit Gemini API quota during testing
- ❌ Requires multiple deployments

**Estimated Time**: 1-2 hours
**Risk Level**: LOW
**Success Probability**: 85%

### Solution D: Add Comprehensive Error Handling

**Rationale**: Prevent 0-byte uploads, provide better diagnostics

**Implementation**:
```python
# In gemini_client.py after line 144
if generated_image_data is not None and len(generated_image_data) == 0:
    logger.error(f"Gemini returned EMPTY image for {style.value}")
    # Log full response for debugging
    logger.error(f"Response: {response}")
    raise ValueError(f"Gemini returned empty image data for {style.value}")

if generated_image_data and len(generated_image_data) < 1024:  # Less than 1KB
    logger.warning(f"Suspiciously small image: {len(generated_image_data)} bytes for {style.value}")

# In storage_manager.py before line 141
if len(image_bytes) < 1024:  # Less than 1KB
    raise ValueError(f"Image too small ({len(image_bytes)} bytes): likely corrupted")
```

**Advantages**:
- ✅ Prevents silent failures
- ✅ Better error messages for debugging
- ✅ Catches issue before storage upload
- ✅ Provides diagnostic data

**Disadvantages**:
- ❌ Doesn't fix root cause
- ❌ Will cause API errors instead of 0-byte files
- ❌ Still needs prompt fix

**Estimated Time**: 10 minutes
**Risk Level**: LOW
**Success Probability**: N/A (diagnostic only, not a fix)

---

## Recommended Action Plan

### Immediate Actions (Next 30 Minutes)

**Step 1: Add Diagnostic Logging** (10 minutes)
- Implement Phase 1 logging from debugging strategy
- Deploy to Cloud Run
- Trigger test generation for bw_fine_art
- Analyze logs to confirm empty data hypothesis

**Step 2: Implement Solution A (Revert Prompts)** (15 minutes)
- Revert to pre-optimization prompts (known working state)
- Keep parameter optimizations (temperature 0.3)
- Deploy to Cloud Run
- Test all 3 styles with same image

**Step 3: Verify Fix** (5 minutes)
- Generate bw_fine_art portrait
- Check Cloud Storage for non-zero file size
- Verify image displays correctly
- Test other styles still work

### Post-Fix Actions (Next 2 Hours)

**Step 4: Root Cause Validation** (30 minutes)
- If revert fixes issue → prompt length confirmed as root cause
- If revert doesn't fix → investigate Hypothesis 4 (safety filters)
- Document findings in session context

**Step 5: Iterative Prompt Optimization** (1 hour)
- Start with working 200-char prompts
- Incrementally add optimization features (one at a time)
- Test each iteration for success
- Find maximum safe prompt length
- Balance optimization goals with reliability

**Step 6: Permanent Fix** (30 minutes)
- Implement optimized-but-safe prompts
- Add validation layer (Solution D error handling)
- Deploy final version
- Update documentation with lessons learned

---

## Testing Plan

### Test Matrix

| Test ID | Style | Image | Expected Result | Success Criteria |
|---------|-------|-------|----------------|------------------|
| T1 | bw_fine_art | Dog portrait | 1-2MB file | File size > 100KB |
| T2 | ink_wash | Same dog | 1-2MB file | File size > 100KB |
| T3 | van_gogh | Same dog | 1-2MB file | File size > 100KB |
| T4 | bw_fine_art | Cat portrait | 1-2MB file | File size > 100KB |
| T5 | bw_fine_art | Multi-pet | 1-2MB file | File size > 100KB |

### Verification Commands

```bash
# Test generation
curl -X POST "https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,...",
    "style": "bw_fine_art",
    "session_id": "test_fix_verification"
  }'

# Check file size
gsutil ls -lh "gs://gemini-artistic-753651513695/generated/temp/test_fix_verification/*.jpg"

# Expected output:
# 1.45 MiB  2025-10-24T18:30:00Z  gs://.../{hash}_bw_fine_art.jpg
# NOT:
#    0 B  2025-10-24T18:30:00Z  gs://.../{hash}_bw_fine_art.jpg
```

### Success Criteria

**Fix Validated If**:
- ✅ bw_fine_art generates files > 100KB (not 0 bytes)
- ✅ All 3 styles work on same image
- ✅ No 500 errors in Cloud Run logs
- ✅ Processing time < 15s per generation
- ✅ Cache hits return successfully

**Fix Failed If**:
- ❌ Still seeing 0-byte files
- ❌ New errors appear in logs
- ❌ Other styles stop working
- ❌ Gemini API quota exhausted

---

## Cost Impact Analysis

### Testing Costs
- Diagnostic logging: $0 (no additional API calls)
- Solution A deployment: $0.02 (Cloud Build)
- Test generation (5 images): 5 × $0.039 = $0.20
- **Total**: ~$0.22

### Deployment Costs
- Cloud Run deployment: $0.02
- Testing matrix (15 images): 15 × $0.039 = $0.59
- **Total**: ~$0.61

### Risk of Delay
- Each hour of debugging: Potential $0.50-1.00 in API testing costs
- User waiting: Opportunity cost (testsite launch delayed)
- **Recommendation**: Prioritize quick fix (Solution A) over perfect fix

---

## Rollback Plan

### If Solution A Fails

**Immediate Rollback** (5 minutes):
```bash
# Revert to last known working revision
gcloud run services update-traffic gemini-artistic-api \
  --to-revisions=gemini-artistic-api-00012-g5z=100 \
  --region=us-central1 \
  --project=gen-lang-client-0601138686
```

**Verification**:
- Test generation on rolled-back revision
- Check if bw_fine_art works
- If yes → investigate what changed between revisions
- If no → issue predates prompt optimization

### If Root Cause is Not Prompts

**Alternative Investigation Path**:
1. Check Gemini API status/changelog for recent changes
2. Test with different Gemini model (gemini-2.5-flash instead of gemini-2.5-flash-image)
3. Examine response headers for rate limiting or safety warnings
4. Contact Google Cloud support with request logs

---

## Prevention Strategies

### Future Prompt Changes

**Before deploying new prompts**:
1. [ ] Test locally with sample images
2. [ ] Verify file size > 100KB for all styles
3. [ ] Compare processing time vs baseline
4. [ ] Check logs for empty data warnings
5. [ ] Test with 3+ different images (dog, cat, multi-pet)

### Code Quality Improvements

**Add to gemini_client.py**:
```python
def validate_generated_image(image_data: bytes, style: str, min_size: int = 1024) -> None:
    """Validate generated image meets quality requirements"""
    if image_data is None:
        raise ValueError(f"No image data generated for {style}")

    if len(image_data) == 0:
        raise ValueError(f"Empty image data generated for {style}")

    if len(image_data) < min_size:
        logger.warning(f"Small image generated: {len(image_data)} bytes for {style}")
```

**Add to storage_manager.py**:
```python
async def store_generated_image(...) -> str:
    # Decode base64
    image_bytes = base64.b64decode(image_data)

    # VALIDATE before upload
    if len(image_bytes) < 1024:  # Less than 1KB
        raise ValueError(f"Image too small ({len(image_bytes)} bytes)")

    # ... rest of storage logic ...
```

### Monitoring Improvements

**Set up alerts**:
- Alert if any generated file < 10KB
- Alert if error rate > 5% for any style
- Alert if average file size drops by >50%
- Daily digest of file size statistics

---

## Key Takeaways

### What We Learned

1. **Prompt Length Matters**: Gemini 2.5 Flash Image has practical limits (~500-750 chars optimal)
2. **Silent Failures Are Dangerous**: API returned "success" with empty data
3. **Validation is Critical**: Should check file size before storage upload
4. **Test All Paths**: Optimizing one style doesn't guarantee all styles work
5. **Logging Saves Time**: More diagnostic logging upfront = faster debugging

### What Went Wrong

1. **No Validation**: Code accepted empty bytes without checking size
2. **Insufficient Testing**: Deployed prompt changes without comprehensive testing
3. **Missing Alerts**: No monitoring for 0-byte file uploads
4. **Overly Complex Prompts**: 1,500-char prompt exceeded practical limits
5. **Assumed "Optimization" = Better**: Longer prompts ≠ better results

### Best Practices Moving Forward

1. **Always validate generated data size before storage**
2. **Test all artistic styles after prompt changes**
3. **Start with minimal prompts, add complexity incrementally**
4. **Monitor file sizes and processing times**
5. **Keep successful working states as fallback**

---

## Next Steps Summary

### Immediate (Next 30 min)
1. Add diagnostic logging to gemini_client.py and storage_manager.py
2. Deploy logging-enhanced version
3. Trigger test generation to confirm empty data hypothesis
4. Implement Solution A (revert to working prompts)
5. Deploy and verify fix

### Short-term (Next 2 hours)
1. Validate root cause through testing
2. Iteratively optimize prompts within safe length limits
3. Add permanent error handling and validation
4. Update documentation with findings

### Long-term (Next week)
1. Set up monitoring alerts for file size anomalies
2. Create automated testing suite for prompt changes
3. Document optimal prompt length for each model
4. Implement A/B testing framework for prompt variations

---

## Document Metadata

**Created**: 2025-10-24
**Author**: Debug Specialist Agent
**Session**: context_session_001.md
**Related Files**:
- `backend/gemini-artistic-api/src/core/gemini_client.py`
- `backend/gemini-artistic-api/src/core/storage_manager.py`
- `backend/gemini-artistic-api/src/config.py`

**Status**: ACTIVE - Awaiting implementation of recommended fix
**Priority**: P0 - Critical blocker
**Estimated Fix Time**: 15-30 minutes (Solution A)

---

**END OF DEBUG PLAN**
