# Real-ESRGAN Compatibility Fix Implementation Plan

**Created**: 2025-12-31
**Author**: CV/ML Production Engineer Agent
**Status**: Research Complete - Ready for Implementation
**Session Context**: `.claude/tasks/context_session_001.md`

---

## Executive Summary

The Real-ESRGAN cleanup step in the BiRefNet pipeline is failing due to a **torchvision compatibility issue**. The `basicsr` library (dependency of `realesrgan`) imports `torchvision.transforms.functional_tensor`, which was **removed in torchvision 0.15+** (PyTorch 2.0+).

**Recommended Solution**: Replace the `realesrgan` + `basicsr` stack with the **ai-forever/Real-ESRGAN** implementation, which does NOT depend on basicsr and works with modern PyTorch/torchvision.

---

## Root Cause Analysis

### The Problem

```
ModuleNotFoundError: No module named 'torchvision.transforms.functional_tensor'
```

### Technical Details

1. **Breaking Change in torchvision 0.15+**: The internal module `torchvision.transforms.functional_tensor` was renamed to `torchvision.transforms._functional_tensor` (private) and eventually the `rgb_to_grayscale` function was moved to `torchvision.transforms.functional`.

2. **basicsr Dependency**: The official `realesrgan` package depends on `basicsr>=1.4.2`, which contains a hardcoded import in `basicsr/data/degradations.py`:
   ```python
   from torchvision.transforms.functional_tensor import rgb_to_grayscale
   ```

3. **CUDA 11.8 Requirement**: Our Cloud Run deployment uses CUDA 11.8 for GPU support, which requires `torch>=2.0` and `torchvision>=0.15.0` - the exact versions that broke basicsr.

### Current Environment (from Dockerfile)
- Python 3.11
- PyTorch with CUDA 11.8 (`--index-url https://download.pytorch.org/whl/cu118`)
- `realesrgan==0.3.0`
- `basicsr>=1.4.2`

---

## Solution Options Analysis

### Option A: ai-forever/Real-ESRGAN (RECOMMENDED)

**Description**: Replace the entire `realesrgan`/`basicsr` stack with the [ai-forever/Real-ESRGAN](https://github.com/ai-forever/Real-ESRGAN) implementation.

**Pros**:
- NO basicsr dependency
- Minimal dependencies: `numpy`, `opencv-python`, `Pillow`, `torch>=1.7`, `torchvision>=0.8.0`, `tqdm`, `huggingface-hub`
- Clean API with PIL Image input/output (matches our existing code pattern)
- Auto-downloads weights from Hugging Face
- Actively maintained
- Better face quality (bonus for pet photos with clear features)

**Cons**:
- Slightly different API than current implementation
- Model weights (~67MB for x2, ~67MB for x4) downloaded from Hugging Face

**Complexity**: Low (2-3 hours)

**Risk**: Low

### Option B: Spandrel Library

**Description**: Use [spandrel](https://github.com/chaiNNer-org/spandrel) for model loading and inference.

**Pros**:
- Unified interface for multiple architectures
- No basicsr dependency
- Supports Real-ESRGAN and many other models
- Security features for .pth loading

**Cons**:
- More abstraction layers
- Requires manual tensor preprocessing
- Model files must be downloaded separately
- Less straightforward for single-model use case

**Complexity**: Medium (3-4 hours)

**Risk**: Low-Medium

### Option C: Patch basicsr Import (NOT Recommended)

**Description**: Monkey-patch the import at runtime using `sys.modules`.

```python
import sys
import types
try:
    from torchvision.transforms.functional_tensor import rgb_to_grayscale
except ImportError:
    from torchvision.transforms.functional import rgb_to_grayscale
    functional_tensor = types.ModuleType("torchvision.transforms.functional_tensor")
    functional_tensor.rgb_to_grayscale = rgb_to_grayscale
    sys.modules["torchvision.transforms.functional_tensor"] = functional_tensor
```

**Pros**:
- Minimal code changes
- Keeps existing implementation

**Cons**:
- Fragile workaround that may break with future updates
- Doesn't fix the underlying architectural debt
- basicsr may have other incompatibilities lurking

**Complexity**: Low (1 hour)

**Risk**: Medium-High (maintenance burden)

### Option D: Pin Old Versions (NOT Recommended)

**Description**: Pin `torch==1.13.0` and `torchvision==0.14.0` to avoid the breaking change.

**Pros**:
- Zero code changes

**Cons**:
- CUDA 11.8 compatibility issues
- Old PyTorch loses performance optimizations
- Security vulnerabilities in old versions
- Prevents using latest BiRefNet optimizations

**Complexity**: Low (30 minutes)

**Risk**: High (security, compatibility)

### Option E: OpenCV Non-local Means Denoising (Fallback Alternative)

**Description**: If ML-based upscaling is overkill, use OpenCV's `fastNlMeansDenoisingColored()`.

**Pros**:
- Zero ML dependencies
- Very fast (CPU)
- No model downloads needed
- Already have opencv-python-headless installed

**Cons**:
- No upscaling (denoising only)
- Less effective than Real-ESRGAN
- May not sufficiently improve BiRefNet input quality

**Complexity**: Low (1-2 hours)

**Risk**: Low, but reduced effectiveness

---

## Recommended Implementation: Option A (ai-forever/Real-ESRGAN)

### Files to Modify

1. **`backend/birefnet-bg-removal-api/requirements.txt`**
   - Remove: `realesrgan==0.3.0`, `basicsr>=1.4.2`, `facexlib>=0.3.0`, `gfpgan>=1.3.8`
   - Add: `git+https://github.com/ai-forever/Real-ESRGAN.git` OR create local copy

2. **`backend/birefnet-bg-removal-api/src/cleanup.py`**
   - Rewrite to use ai-forever API instead of realesrgan/basicsr

3. **`backend/birefnet-bg-removal-api/Dockerfile`**
   - Update model baking section for new implementation
   - Pre-download weights to `/app/models/esrgan/`

### New cleanup.py Implementation

```python
"""
Stage 1: Image Cleanup & Upscaling
Uses ai-forever Real-ESRGAN implementation (no basicsr dependency).
"""
import logging
from PIL import Image
from typing import Optional
import os

logger = logging.getLogger(__name__)

# Lazy import flag
_ESRGAN_AVAILABLE: Optional[bool] = None
_MODEL_CACHE_DIR = os.environ.get('ESRGAN_MODEL_DIR', '/app/models/esrgan')


def _check_esrgan_available() -> bool:
    """Check if ai-forever ESRGAN can be imported"""
    global _ESRGAN_AVAILABLE
    if _ESRGAN_AVAILABLE is None:
        try:
            from RealESRGAN import RealESRGAN
            _ESRGAN_AVAILABLE = True
            logger.info("ai-forever Real-ESRGAN available")
        except ImportError as e:
            _ESRGAN_AVAILABLE = False
            logger.warning(f"Real-ESRGAN not available: {e}")
    return _ESRGAN_AVAILABLE


class CleanupProcessor:
    """Real-ESRGAN x2 upscaling + denoising processor

    Uses ai-forever implementation (no basicsr dependency).
    """

    def __init__(self, device=None, scale: int = 2):
        import torch
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.scale = scale
        self.model = None
        self.available = _check_esrgan_available()

        if self.available:
            self._load_model()
        else:
            logger.warning("CleanupProcessor: ESRGAN unavailable - passthrough mode")

    def _load_model(self):
        """Load ai-forever Real-ESRGAN model"""
        if not self.available:
            return

        import torch
        from RealESRGAN import RealESRGAN

        logger.info(f"Loading Real-ESRGAN x{self.scale} on {self.device}...")

        self.model = RealESRGAN(torch.device(self.device), scale=self.scale)

        # Check for local weights first (baked in Docker)
        weights_path = os.path.join(_MODEL_CACHE_DIR, f'RealESRGAN_x{self.scale}.pth')
        if os.path.exists(weights_path):
            self.model.load_weights(weights_path, download=False)
            logger.info(f"Loaded weights from: {weights_path}")
        else:
            # Auto-download from Hugging Face
            self.model.load_weights(f'weights/RealESRGAN_x{self.scale}.pth', download=True)
            logger.info("Downloaded weights from Hugging Face")

        logger.info("Real-ESRGAN model loaded successfully")

    def process(self, pil_image: Image.Image) -> Image.Image:
        """
        Upscale and denoise image.

        Args:
            pil_image: Input PIL Image (RGB or RGBA)

        Returns:
            Enhanced PIL Image, or original if ESRGAN unavailable
        """
        if not self.available or self.model is None:
            logger.info("ESRGAN unavailable - returning original")
            return pil_image

        import time
        start = time.time()

        try:
            # ai-forever API works directly with PIL Images (RGB)
            input_rgb = pil_image.convert('RGB')
            sr_image = self.model.predict(input_rgb)

            elapsed = (time.time() - start) * 1000
            logger.info(f"ESRGAN cleanup: {elapsed:.0f}ms ({pil_image.size} -> {sr_image.size})")

            return sr_image

        except Exception as e:
            logger.error(f"ESRGAN failed: {e}. Returning original.")
            return pil_image


# Singleton
_cleanup: CleanupProcessor = None


def get_cleanup():
    """Get or create singleton CleanupProcessor"""
    global _cleanup
    if _cleanup is None:
        _cleanup = CleanupProcessor(scale=2)
    return _cleanup
```

### Updated requirements.txt

```txt
# BiRefNet Background Removal API
# Core dependencies

# Web framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# BiRefNet via HuggingFace transformers
transformers>=4.39.0
timm>=0.9.12
accelerate>=0.28.0
einops>=0.7.0
kornia>=0.7.0

# Image processing
Pillow>=10.0.0
numpy>=1.24.0
opencv-python-headless>=4.8.0

# Real-ESRGAN (ai-forever - NO basicsr dependency)
# Install from GitHub for latest compatibility
# Alternative: Pin specific commit for reproducibility
git+https://github.com/ai-forever/Real-ESRGAN.git@main
huggingface-hub>=0.20.0

# GPU acceleration for effects pipeline
cupy-cuda11x>=12.0.0

# Cloud Storage
google-cloud-storage>=2.10.0

# Monitoring and utilities
psutil>=5.9.0
python-dotenv>=1.0.0

# Health checks
httpx>=0.25.0
```

### Dockerfile Updates

```dockerfile
# ============================================================
# 2. Pre-download Real-ESRGAN model weights (ai-forever)
# ============================================================
ENV ESRGAN_MODEL_DIR=/app/models/esrgan
RUN mkdir -p $ESRGAN_MODEL_DIR

# Download x2 model weights from Hugging Face
RUN python3 -c "\
import os; \
os.environ['ESRGAN_MODEL_DIR'] = '/app/models/esrgan'; \
from huggingface_hub import hf_hub_download; \
print('Downloading RealESRGAN_x2.pth...'); \
hf_hub_download( \
    repo_id='ai-forever/Real-ESRGAN', \
    filename='RealESRGAN_x2.pth', \
    local_dir='/app/models/esrgan', \
    local_dir_use_symlinks=False \
); \
print('Real-ESRGAN x2 model downloaded'); \
"

# Verify ESRGAN loads correctly
RUN python3 -c "\
import os; \
import torch; \
os.environ['ESRGAN_MODEL_DIR'] = '/app/models/esrgan'; \
from RealESRGAN import RealESRGAN; \
device = torch.device('cpu'); \
model = RealESRGAN(device, scale=2); \
model.load_weights('/app/models/esrgan/RealESRGAN_x2.pth', download=False); \
print('Real-ESRGAN verification successful'); \
"
```

---

## Implementation Steps

### Phase 1: Local Testing (1 hour)

1. Create test branch
2. Update requirements.txt (remove basicsr stack, add ai-forever)
3. Rewrite cleanup.py with new implementation
4. Test locally:
   ```bash
   cd backend/birefnet-bg-removal-api
   pip install -r requirements.txt
   python -c "from src.cleanup import get_cleanup; c = get_cleanup(); print(c.available)"
   ```

### Phase 2: Docker Build (1 hour)

1. Update Dockerfile with model baking
2. Build locally:
   ```bash
   docker build -t birefnet-test .
   ```
3. Test container:
   ```bash
   docker run -p 8080:8080 --gpus all birefnet-test
   # Test /health endpoint
   # Test /remove-background with sample image
   ```

### Phase 3: Cloud Run Deployment (30 min)

1. Deploy to Cloud Run with GPU
2. Monitor logs for ESRGAN initialization
3. Run integration tests with real images
4. Verify Enhanced B&W pipeline works end-to-end

### Phase 4: Performance Validation (30 min)

1. Compare processing times: old vs new ESRGAN
2. Verify image quality is equivalent or better
3. Monitor memory usage
4. Document any differences

---

## Risk Mitigation

### Fallback Strategy

If ai-forever implementation has issues, implement **Option E** (OpenCV denoising) as a lightweight fallback:

```python
def opencv_denoise_fallback(pil_image: Image.Image) -> Image.Image:
    """CPU-based denoising without ML models"""
    import cv2
    import numpy as np

    img_np = np.array(pil_image.convert('RGB'))
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    # Non-local means denoising (h=10 is good balance)
    denoised = cv2.fastNlMeansDenoisingColored(img_bgr, None, 10, 10, 7, 21)

    img_rgb = cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB)
    return Image.fromarray(img_rgb)
```

### Graceful Degradation

The current lazy-import pattern in cleanup.py already supports graceful degradation. If ESRGAN fails to load, images pass through unchanged. This behavior is preserved in the new implementation.

---

## Testing Checklist

- [ ] ai-forever package installs without basicsr
- [ ] Model weights download successfully
- [ ] CUDA inference works on L4 GPU
- [ ] PIL Image input/output works correctly
- [ ] Alpha channel handling (if needed)
- [ ] Memory usage is acceptable
- [ ] Processing time is comparable
- [ ] Docker build completes
- [ ] Cloud Run deployment succeeds
- [ ] End-to-end BiRefNet + Enhanced B&W pipeline works

---

## References

- [Real-ESRGAN Issue #944 - torchvision.transforms.functional_tensor](https://github.com/xinntao/Real-ESRGAN/issues/944)
- [BasicSR Issue #663 - Same problem](https://github.com/XPixelGroup/BasicSR/issues/663)
- [ai-forever/Real-ESRGAN GitHub](https://github.com/ai-forever/Real-ESRGAN)
- [ai-forever/Real-ESRGAN Hugging Face](https://huggingface.co/ai-forever/Real-ESRGAN)
- [Spandrel - Alternative loader](https://github.com/chaiNNer-org/spandrel)
- [Real-ESRGAN PR #911 - Fix attempt](https://github.com/xinntao/Real-ESRGAN/pull/911)

---

## Estimated Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Local testing | 1 hour |
| 2 | Docker build | 1 hour |
| 3 | Cloud Run deployment | 30 min |
| 4 | Performance validation | 30 min |
| **Total** | | **3 hours** |

---

## Assumptions

1. ai-forever/Real-ESRGAN is compatible with PyTorch 2.x + CUDA 11.8
2. Model weights from Hugging Face are accessible during Docker build
3. x2 upscaling is sufficient (not x4) - matches current implementation
4. FP16 inference is supported on L4 GPU
5. Hugging Face Hub is not rate-limited during builds

---

**Next Action**: Approve this plan, then proceed with Phase 1 (local testing) to validate the ai-forever implementation works before Docker/Cloud Run changes.
