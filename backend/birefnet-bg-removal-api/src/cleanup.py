"""
Stage 1: Image Cleanup & Upscaling
Uses ai-forever Real-ESRGAN implementation (no basicsr dependency).
Compatible with PyTorch 2.x and modern torchvision.

This preprocessing stage enhances image quality before BiRefNet segmentation:
- 2x upscaling for higher resolution output
- Denoising to reduce mobile camera noise and JPEG artifacts
- Better edge detection for fur/hair details
"""
import logging
import os
from PIL import Image
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import flag
_ESRGAN_AVAILABLE: Optional[bool] = None
_MODEL_CACHE_DIR = os.environ.get('ESRGAN_MODEL_DIR', '/app/models/esrgan')


def _patch_huggingface_hub():
    """
    Patch huggingface_hub for ai-forever Real-ESRGAN compatibility.

    The ai-forever Real-ESRGAN library imports `cached_download` from huggingface_hub,
    but this function was deprecated in 0.18.0 and removed in 0.20.0.
    We add a shim to allow the import to succeed (we don't actually use it).
    """
    try:
        import huggingface_hub
        if not hasattr(huggingface_hub, 'cached_download'):
            # Add deprecated function as shim
            def cached_download(*args, **kwargs):
                raise DeprecationWarning(
                    "cached_download is deprecated, use hf_hub_download instead"
                )
            huggingface_hub.cached_download = cached_download
            logger.info("Added huggingface_hub.cached_download compatibility shim")
    except Exception as e:
        logger.warning(f"Failed to patch huggingface_hub: {e}")


def _check_esrgan_available() -> bool:
    """Check if ai-forever Real-ESRGAN can be imported"""
    global _ESRGAN_AVAILABLE
    if _ESRGAN_AVAILABLE is None:
        try:
            # Apply compatibility patch before importing RealESRGAN
            _patch_huggingface_hub()
            from RealESRGAN import RealESRGAN
            _ESRGAN_AVAILABLE = True
            logger.info("ai-forever Real-ESRGAN available")
        except ImportError as e:
            _ESRGAN_AVAILABLE = False
            logger.warning(f"Real-ESRGAN not available (will skip cleanup): {e}")
    return _ESRGAN_AVAILABLE


class CleanupProcessor:
    """Real-ESRGAN x2 upscaling + denoising processor

    Uses ai-forever implementation which has no basicsr dependency
    and is compatible with PyTorch 2.x / modern torchvision.
    """

    def __init__(self, device=None, scale: int = 2):
        import torch
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.scale = scale
        self.model = None
        self.model_name = f'RealESRGAN_x{scale}'
        self.available = _check_esrgan_available()

        if self.available:
            self._load_model()
        else:
            logger.warning("CleanupProcessor created but ESRGAN unavailable - will passthrough images")

    def _load_model(self):
        """Load ai-forever Real-ESRGAN model"""
        if not self.available:
            return

        import torch
        from RealESRGAN import RealESRGAN

        logger.info(f"Loading Real-ESRGAN x{self.scale} on {self.device}...")

        try:
            self.model = RealESRGAN(torch.device(self.device), scale=self.scale)

            # Check for local weights first (baked in Docker)
            weights_path = os.path.join(_MODEL_CACHE_DIR, f'RealESRGAN_x{self.scale}.pth')
            if os.path.exists(weights_path):
                self.model.load_weights(weights_path, download=False)
                logger.info(f"Loaded weights from local cache: {weights_path}")
            else:
                # Auto-download from Hugging Face
                self.model.load_weights(f'weights/RealESRGAN_x{self.scale}.pth', download=True)
                logger.info("Downloaded weights from Hugging Face")

            logger.info("Real-ESRGAN model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load Real-ESRGAN model: {e}")
            self.model = None
            self.available = False

    def process(self, pil_image: Image.Image) -> Image.Image:
        """
        Upscale 2x + denoise before segmentation.

        This preprocessing stage removes mobile sensor noise and JPEG artifacts,
        giving BiRefNet cleaner edges to work with for fur detection.

        Args:
            pil_image: Input PIL Image (RGB or RGBA)

        Returns:
            Enhanced PIL Image (2x upscaled + denoised), or original if ESRGAN unavailable
        """
        # If ESRGAN not available, return original image (graceful degradation)
        if not self.available or self.model is None:
            logger.info("ESRGAN unavailable - returning original image (no cleanup)")
            return pil_image

        import time
        start = time.time()

        try:
            # ai-forever API works directly with PIL Images (RGB)
            input_rgb = pil_image.convert('RGB')

            # Run super-resolution
            sr_image = self.model.predict(input_rgb)

            elapsed = (time.time() - start) * 1000
            logger.info(f"ESRGAN cleanup completed: {elapsed:.0f}ms ({pil_image.size} -> {sr_image.size})")

            return sr_image

        except RuntimeError as e:
            logger.error(f"ESRGAN failed: {e}. Returning original image.")
            return pil_image
        except Exception as e:
            logger.error(f"ESRGAN unexpected error: {e}. Returning original image.")
            return pil_image


# Singleton instance
_cleanup: CleanupProcessor = None


def get_cleanup():
    """Get or create singleton CleanupProcessor instance"""
    global _cleanup
    if _cleanup is None:
        _cleanup = CleanupProcessor(scale=2)
    return _cleanup
