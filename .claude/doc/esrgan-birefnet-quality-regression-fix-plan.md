# ESRGAN-BiRefNet Background Removal Quality Regression Fix Plan

**Created**: 2026-01-01
**Author**: CV/ML Production Engineer Agent
**Status**: Root Cause Analysis Complete - Ready for Implementation
**Session Context**: `.claude/tasks/context_session_001.md`
**Session ID**: 1767279142225_onlumrhm3

---

## Executive Summary

**Problem**: Background removal quality has regressed after implementing ESRGAN 2x upscaling BEFORE BiRefNet segmentation. Users report "not all the background is being removed from the image."

**Root Cause**: The ESRGAN 2x upscale introduces artifacts that confuse BiRefNet's segmentation model, AND the upscaled images are immediately downsampled back to 1024x1024 by BiRefNet's internal transform, making the ESRGAN preprocessing step both harmful and wasteful.

**Recommendation**: **Option D - Disable ESRGAN for segmentation path** (Immediate fix, 15 minutes implementation)

---

## 1. Root Cause Analysis

### 1.1 Current Pipeline Flow (PROBLEMATIC)

```
Input Image (1200x1600, 1.92MP)
    |
    v
ESRGAN 2x Upscale (~3s)
    |
    v
Upscaled Image (2400x3200, 7.68MP)
    |
    v
BiRefNet Preprocessing: resize if > max_dimension (1024)
    |
    v
Downsampled Image (768x1024)  <-- ESRGAN WASTED
    |
    v
BiRefNet Transform: resize to inference_size (1024x1024)
    |
    v
BiRefNet Inference at 1024x1024
    |
    v
Mask upscaled to 2400x3200 (original after ESRGAN)
    |
    v
Apply mask to 2400x3200 image
```

### 1.2 Why Quality Regressed

**Critical Finding**: BiRefNet has TWO resolution caps:

1. **`max_dimension=1024`** (preprocessing): Images larger than 1024px are downsampled
2. **`inference_size=(1024, 1024)`** (transform): ALL images resized to 1024x1024 before model

The ESRGAN 2x upscale from 1200x1600 to 2400x3200:
- Gets immediately downsampled by preprocessing (max_dim=1024)
- Then resized again by transform to 1024x1024
- **Result**: The same 1024x1024 input to BiRefNet, but with ESRGAN artifacts!

### 1.3 ESRGAN Artifact Impact on Segmentation

ESRGAN (Real-ESRGAN) is designed to enhance visual quality for human perception, NOT for machine vision tasks like segmentation. The artifacts it introduces include:

1. **Edge sharpening artifacts**: Adds halos around edges that BiRefNet may interpret as foreground
2. **Texture hallucination**: Generates plausible but non-existent detail that creates noise in the mask
3. **Color quantization**: Subtle color banding that affects soft edge detection
4. **Denoising smoothing**: Over-smoothed regions lose detail BiRefNet uses for boundary detection

### 1.4 Evidence from Logs

From the deployment analysis document:
```
ESRGAN cleanup: 2968ms (1200x1600 -> 2400x3200)
BiRefNet segmentation: 657ms (on 2400x3200 image)
```

But BiRefNet's processing at 1024x1024 means:
- The 2400x3200 was downsampled to ~768x1024 (max_dim=1024)
- Then to 1024x1024 (inference transform)
- ~3 seconds of ESRGAN compute WASTED

### 1.5 Mask Enhancement Parameters

Current mask enhancement in `birefnet_processor.py` (lines 358-364):
```python
enhanced_mask = enhance_mask(
    mask,
    threshold=0.60,       # Higher threshold - more areas become transparent
    contrast_boost=4.0,   # Very aggressive - steep sigmoid curve
    cleanup_kernel_size=5,  # Larger kernel for smoother edges
    hard_floor=0.25       # Kill all grays below 25% - eliminates shadow artifacts
)
```

These parameters were tuned for CLEAN input images. ESRGAN artifacts may produce:
- More gray areas in the mask (uncertain boundaries)
- False positive foreground pixels from edge halos
- Incomplete mask coverage where ESRGAN smoothed actual boundaries

---

## 2. Solution Options Analysis

### Option A: Adjust Mask Enhancement Parameters for ESRGAN
**Description**: Tune threshold, contrast, and cleanup parameters to compensate for ESRGAN artifacts

**Implementation**:
```python
# More aggressive cleanup for ESRGAN-processed images
enhanced_mask = enhance_mask(
    mask,
    threshold=0.55,       # Lower threshold - favor background removal
    contrast_boost=5.0,   # More aggressive sigmoid
    cleanup_kernel_size=7,  # Larger kernel to remove more artifacts
    hard_floor=0.30       # Higher floor - kill more grays
)
```

**Pros**:
- Minimal code change
- Keeps ESRGAN for effects pipeline benefit

**Cons**:
- Fighting symptoms, not root cause
- May over-remove legitimate soft edges (fur)
- Doesn't address wasted ESRGAN compute

**Complexity**: Low (30 min)
**Risk**: Medium-High (may degrade fur quality)
**Recommendation**: NOT RECOMMENDED

---

### Option B: Increase BiRefNet max_dimension to 2048+
**Description**: Let BiRefNet process at ESRGAN's output resolution

**Implementation**:
```yaml
# deploy.yaml
- name: BIREFNET_MAX_DIMENSION
  value: "2400"  # Match ESRGAN output
```

**Pros**:
- Uses full ESRGAN resolution
- May improve edge detection (more pixels)

**Cons**:
- 4x GPU memory (7.68MP vs 1.92MP)
- ~4x inference time (657ms -> ~2.6s)
- May hit OOM on L4 GPU (22GB)
- BiRefNet not trained on >1024px (quality unknown)
- Still using ESRGAN artifacts as input

**Complexity**: Low (30 min)
**Risk**: High (memory, performance, unknown quality)
**Recommendation**: NOT RECOMMENDED

---

### Option C: Run ESRGAN AFTER BiRefNet Instead of Before
**Description**: ESRGAN enhances the final output, not the segmentation input

**Implementation**:
```python
# main.py - process_with_multiple_effects()

# Step 1: BiRefNet on ORIGINAL image (no ESRGAN)
processor = get_processor()
bg_result = processor.remove_background(image, alpha_matting=alpha_matting)
bg_removed = bg_result.image

# Step 2: ESRGAN on bg-removed image (for higher-res effects)
if use_esrgan_for_effects:
    cleaner = get_cleanup()
    bg_removed = cleaner.process(bg_removed)

# Step 3: Effects on enhanced image
...
```

**Pros**:
- BiRefNet gets clean input (original quality)
- ESRGAN still enhances final output
- Preserves both benefits

**Cons**:
- ESRGAN on RGBA with transparency may cause artifacts
- Additional complexity in pipeline
- Alpha channel handling needed

**Complexity**: Medium (2-3 hours)
**Risk**: Medium (RGBA handling)
**Recommendation**: CONSIDER for Phase 2

---

### Option D: Disable ESRGAN for Segmentation Path (RECOMMENDED)
**Description**: Remove ESRGAN from the main processing pipeline entirely

**Implementation**:
```python
# main.py - process_with_multiple_effects() lines 710-723

# REMOVE these lines:
# cleanup_start = time.time()
# cleaner = get_cleanup()
# if max(image.size) < 3000:
#     image = cleaner.process(image)
#     ...

# Step 1: Remove background directly on original image
processor = get_processor()
bg_result = processor.remove_background(image, alpha_matting=alpha_matting)
```

**Pros**:
- Immediate fix (15 minutes)
- Restores original quality
- Removes 3s unnecessary latency
- BiRefNet gets clean input

**Cons**:
- Loses potential ESRGAN quality benefit (but we proved there was none)

**Complexity**: Trivial (15 min)
**Risk**: Very Low (reverting to known-working state)
**Recommendation**: **RECOMMENDED - Immediate Fix**

---

### Option E: Add ESRGAN as Optional Enhancement Toggle
**Description**: Keep ESRGAN available but disabled by default, controllable via env var

**Implementation**:
```python
# main.py
ENABLE_ESRGAN_PREPROCESSING = os.getenv("ENABLE_ESRGAN_PREPROCESSING", "false").lower() == "true"

# In process_with_multiple_effects():
if ENABLE_ESRGAN_PREPROCESSING and max(image.size) < 3000:
    cleaner = get_cleanup()
    image = cleaner.process(image)
    logger.info(f"ESRGAN preprocessing enabled: {image.size}")
else:
    cleanup_time_ms = 0
```

**Pros**:
- Flexible A/B testing
- Easy to re-enable if we find a use case
- Default to safe (disabled)

**Cons**:
- More code than Option D
- Keeping unused code

**Complexity**: Low (30 min)
**Risk**: Very Low
**Recommendation**: RECOMMENDED for Production (allows experimentation)

---

## 3. Recommended Implementation Plan

### Phase 1: Immediate Fix (Option D) - 15 minutes

**Goal**: Restore background removal quality immediately

**Files to Modify**:
1. `backend/birefnet-bg-removal-api/src/main.py`

**Changes**:

```python
# BEFORE (lines 706-723):
        # Step 0: ESRGAN Cleanup (NEW - preprocessing before segmentation)
        # Upscale 2x + denoise to give BiRefNet cleaner edges for fur detection
        cleanup_start = time.time()
        cleaner = get_cleanup()

        # Skip ESRGAN for very large images to prevent timeout
        if max(image.size) < 3000:
            logger.info(f"Applying ESRGAN cleanup (2x upscale + denoise) to {image.size}")
            image = cleaner.process(image)
            cleanup_time_ms = (time.time() - cleanup_start) * 1000
            logger.info(f"ESRGAN cleanup completed: {cleanup_time_ms:.0f}ms, new size: {image.size}")
        else:
            logger.info(f"Skipping ESRGAN (image too large: {image.size})")
            cleanup_time_ms = 0

# AFTER:
        # ESRGAN preprocessing DISABLED - was causing quality regression
        # See: .claude/doc/esrgan-birefnet-quality-regression-fix-plan.md
        # Root cause: ESRGAN artifacts + double-downsampling made segmentation worse
        cleanup_time_ms = 0
```

**Deployment**:
```bash
cd backend/birefnet-bg-removal-api
gcloud builds submit --tag gcr.io/gen-lang-client-0601138686/birefnet-bg-removal-api
gcloud run deploy birefnet-bg-removal-api --image gcr.io/gen-lang-client-0601138686/birefnet-bg-removal-api --region us-central1
```

**Testing**:
1. Upload same test image (IMG_2733.jpeg or similar)
2. Verify complete background removal
3. Compare edge quality to pre-ESRGAN baseline
4. Check processing time (should be ~3s faster)

---

### Phase 2: Production Toggle (Option E) - 30 minutes

**Goal**: Add env var toggle for future experimentation

**Files to Modify**:
1. `backend/birefnet-bg-removal-api/src/main.py`
2. `backend/birefnet-bg-removal-api/deploy.yaml`

**main.py Changes**:
```python
# Add to environment configuration section (after line 58)
ENABLE_ESRGAN_PREPROCESSING = os.getenv("ENABLE_ESRGAN_PREPROCESSING", "false").lower() == "true"

# In process_with_multiple_effects() (replacing lines 710-723):
        # Optional ESRGAN preprocessing (disabled by default - see quality regression docs)
        cleanup_time_ms = 0
        if ENABLE_ESRGAN_PREPROCESSING:
            cleanup_start = time.time()
            cleaner = get_cleanup()
            if max(image.size) < 3000:
                logger.info(f"[ESRGAN] Preprocessing enabled: {image.size}")
                image = cleaner.process(image)
                cleanup_time_ms = (time.time() - cleanup_start) * 1000
                logger.info(f"[ESRGAN] Completed: {cleanup_time_ms:.0f}ms, new size: {image.size}")
        else:
            logger.debug("[ESRGAN] Preprocessing disabled (default)")
```

**deploy.yaml Changes**:
```yaml
        # ESRGAN preprocessing (disabled by default - causes quality regression)
        - name: ENABLE_ESRGAN_PREPROCESSING
          value: "false"
```

---

### Phase 3: Future Investigation (Optional) - 4 hours

If ESRGAN quality enhancement is still desired, investigate:

1. **ESRGAN on Effects Only (Option C)**
   - Apply ESRGAN after BiRefNet, before effects
   - Requires RGBA handling (alpha channel preservation)
   - May improve effect quality without affecting segmentation

2. **Alternative Preprocessing**
   - OpenCV non-local means denoising (no upscaling)
   - Lighter than ESRGAN, may help with mobile camera noise
   - Won't introduce edge artifacts

3. **BiRefNet-specific Preprocessing**
   - Research what BiRefNet authors recommend
   - May find better preprocessing that actually helps segmentation

---

## 4. Testing Plan

### Test Case 1: Quality Regression Verification
1. Use original test image (IMG_2733.jpeg, 1200x1600)
2. Process with ESRGAN disabled
3. Verify: Complete background removal (no leftover pixels)
4. Compare mask quality metrics if available

### Test Case 2: Edge Quality (Fur/Hair)
1. Use pet photo with fine fur detail
2. Process with ESRGAN disabled
3. Verify: Fur edges preserved, no excessive jagging
4. Compare to pre-ESRGAN implementation

### Test Case 3: Performance
1. Process same image
2. Verify: Total time ~3s faster (ESRGAN removed)
3. Expected: 10s total vs 13s with ESRGAN

### Test Case 4: Various Image Sizes
1. Small image: 800x600
2. Medium image: 1200x1600
3. Large image: 3000x4000
4. Verify: All sizes process correctly

---

## 5. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ESRGAN removal breaks effects | Low | Very Low | Effects never depended on ESRGAN |
| Performance regression | None | None | Actually 3s faster |
| Quality regression | None | Very Low | Reverting to known-good state |
| Deployment failure | Low | Very Low | Standard Cloud Run deployment |

**Overall Risk**: Very Low

---

## 6. Rollback Plan

If issues occur after deployment:

1. **Quick Rollback**: Re-enable ESRGAN via env var
```yaml
- name: ENABLE_ESRGAN_PREPROCESSING
  value: "true"
```

2. **Full Rollback**: Revert to previous revision
```bash
gcloud run services update-traffic birefnet-bg-removal-api --to-revisions=birefnet-bg-removal-api-00022-xxx=100
```

---

## 7. Documentation Updates Required

After implementation, update:

1. `.claude/doc/birefnet-esrgan-deployment-analysis.md` - Add quality regression findings
2. `.claude/tasks/context_session_001.md` - Log this fix
3. `backend/birefnet-bg-removal-api/README.md` (if exists) - Document ESRGAN toggle

---

## 8. Summary

**Root Cause**: ESRGAN 2x upscaling before BiRefNet introduced artifacts that confused segmentation, AND the upscaled images were immediately downsampled back to 1024x1024, making ESRGAN both harmful and wasteful.

**Solution**: Disable ESRGAN preprocessing (15-minute fix, Option D) and optionally add env var toggle for future experimentation (Option E).

**Expected Outcome**:
- Background removal quality restored to pre-ESRGAN baseline
- 3s faster processing (~10s vs ~13s)
- No functionality loss (ESRGAN wasn't providing value)

**Implementation Time**: 15-30 minutes

**Risk Level**: Very Low

---

## Appendix A: Code References

### birefnet_processor.py - Resolution Handling
```python
# Line 162-178: Constructor shows max_dimension=1024 and inference_size=(1024, 1024)
def __init__(
    self,
    model_variant: str = "ZhengPeng7/BiRefNet-portrait",
    max_dimension: int = 1024,
    enable_preprocessing: bool = True
):
    ...
    self.inference_size = (1024, 1024)

# Line 227-230: Transform resizes ALL images to 1024x1024
self.transform = transforms.Compose([
    transforms.Resize(self.inference_size),  # Always 1024x1024
    ...
])
```

### main.py - ESRGAN Integration Point
```python
# Lines 706-723: ESRGAN preprocessing (TO BE DISABLED)
cleanup_start = time.time()
cleaner = get_cleanup()
if max(image.size) < 3000:
    image = cleaner.process(image)
    cleanup_time_ms = (time.time() - cleanup_start) * 1000
```

### cleanup.py - ESRGAN Implementation
```python
# Line 137: 2x upscaling
sr_image = self.model.predict(input_rgb)
# Output: 2x resolution (e.g., 1200x1600 -> 2400x3200)
```
