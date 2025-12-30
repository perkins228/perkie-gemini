"""
Stage 1: Image Cleanup & Upscaling
Uses Real-ESRGAN to fix noise and blur in user uploads before segmentation.
This preprocessing stage ensures BiRefNet receives clean, high-resolution input
for more accurate fur detection.
"""
import cv2
import torch
import numpy as np
import logging
from PIL import Image
from realesrgan import RealESRGANer
from basicsr.archs.rrdbnet_arch import RRDBNet

logger = logging.getLogger(__name__)


class CleanupProcessor:
    """Real-ESRGAN x2 upscaling + denoising processor"""

    def __init__(self, device=None):
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        # Use x2 model for speed (we don't need 4k upscale, just denoising)
        self.model_name = 'RealESRGAN_x2plus'
        self.load_model()

    def load_model(self):
        """Load RRDBNet generator and RealESRGANer upsampler"""
        logger.info(f"Loading Real-ESRGAN model on {self.device}...")

        # Load RRDBNet (Generator)
        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=23,
            num_grow_ch=32,
            scale=2
        )

        self.upsampler = RealESRGANer(
            scale=2,
            model_path=None,  # Auto-download or use cached RealESRGAN_x2plus.pth
            model=model,
            tile=400,  # Tile size to prevent OOM on GPU
            tile_pad=10,
            pre_pad=0,
            half=True if self.device == 'cuda' else False,  # FP16 for GPU
            device=self.device
        )

        logger.info("Real-ESRGAN model loaded successfully")

    def process(self, pil_image: Image.Image) -> Image.Image:
        """
        Upscale 2x + denoise before segmentation.

        This preprocessing stage removes mobile sensor noise and JPEG artifacts,
        giving BiRefNet cleaner edges to work with for fur detection.

        Args:
            pil_image: Input PIL Image (RGB or RGBA)

        Returns:
            Enhanced PIL Image (2x upscaled + denoised)
        """
        import time
        start = time.time()

        # Convert PIL -> CV2 (BGR format for OpenCV)
        img_np = np.array(pil_image.convert('RGB'))
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # Inference (Upscale + Denoise)
        try:
            output, _ = self.upsampler.enhance(img_bgr, outscale=2)
            elapsed = (time.time() - start) * 1000
            logger.info(f"ESRGAN cleanup completed: {elapsed:.0f}ms")

        except RuntimeError as e:
            logger.error(f"ESRGAN failed: {e}. Returning original image.")
            return pil_image

        # Convert CV2 -> PIL (RGB format)
        img_rgb = cv2.cvtColor(output, cv2.COLOR_BGR2RGB)
        return Image.fromarray(img_rgb)


# Singleton instance
_cleanup: CleanupProcessor = None


def get_cleanup():
    """Get or create singleton CleanupProcessor instance"""
    global _cleanup
    if _cleanup is None:
        _cleanup = CleanupProcessor()
    return _cleanup
