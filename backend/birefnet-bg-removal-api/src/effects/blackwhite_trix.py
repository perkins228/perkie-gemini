"""
Enhanced Black & White Effect (Tri-X Film Simulation)

Perkie Prints Optimized Image Pipeline (Phase 1 Basic)
------------------------------------------------------
Optimizations included:
1. Pre-Denoise (defensive processing for mobile uploads)
2. Linear Grayscale Conversion (prevents muddy darks in saturated colors)
3. Adaptive Unsharp Masking (fur texture sharpening without edge halos)
4. Screen-Blend Halation (glow effect that preserves white fur detail)

This module provides both OpenCV-based processing and PIL Image support
for seamless integration with the BiRefNet API.
"""

import cv2
import numpy as np
import logging
from typing import Optional, Tuple
from PIL import Image
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TriXParams:
    """Parameters for Tri-X film simulation"""
    gamma_correction: float = 1.02
    contrast_boost: float = 1.12
    edge_strength: float = 0.9      # Adjusted for adaptive masking
    halation_strength: float = 0.5  # Adjusted for Screen blend mode
    grain_strength: float = 0.08
    grain_size: float = 2.0
    denoise_strength: int = 3       # h parameter for denoising


class TriXPipeline:
    """
    Enhanced Black & White processing pipeline with Tri-X film simulation.

    Features:
    - Pre-denoising for mobile uploads
    - Linear colorspace conversion for accurate grayscale
    - Tri-X spectral weights (high green sensitivity)
    - Adaptive unsharp masking (fur texture without edge halos)
    - Screen-blend halation (preserves white fur detail)
    - Film grain simulation
    """

    def __init__(self, params: Optional[TriXParams] = None):
        """
        Initialize the Tri-X pipeline.

        Args:
            params: Optional custom parameters. Uses defaults if not provided.
        """
        self.params = params or TriXParams()
        logger.info(f"TriX Pipeline initialized with contrast={self.params.contrast_boost}, "
                   f"edge={self.params.edge_strength}, halation={self.params.halation_strength}")

    def linearize_srgb(self, image: np.ndarray) -> np.ndarray:
        """
        Convert sRGB to Linear RGB to handle colors correctly.
        Prevents 'muddy' darks when converting saturated colors (like red collars) to B&W.
        """
        image = image.astype(np.float32) / 255.0
        return np.where(image <= 0.04045, image / 12.92, ((image + 0.055) / 1.055) ** 2.4)

    def apply_gamma(self, image: np.ndarray) -> np.ndarray:
        """Re-apply gamma for display (standard sRGB gamma ~2.2)"""
        return np.where(image <= 0.0031308, 12.92 * image, 1.055 * (image ** (1 / 2.4)) - 0.055)

    def process_array(self, image: np.ndarray) -> np.ndarray:
        """
        Process a BGR or BGRA numpy array through the Tri-X pipeline.

        Args:
            image: Input image as numpy array (BGR or BGRA, uint8)

        Returns:
            Processed grayscale image as numpy array (uint8)
        """
        # Handle alpha channel if present
        has_alpha = image.shape[2] == 4 if len(image.shape) == 3 else False
        alpha_channel = None

        if has_alpha:
            alpha_channel = image[:, :, 3].copy()
            image = image[:, :, :3]  # Remove alpha for processing

        # ---------------------------------------------------------
        # STAGE 1: PRE-DENOISE (DISABLED - too slow on high-res images)
        # ---------------------------------------------------------
        # cv2.fastNlMeansDenoisingColored() is O(n²) and takes 30+ seconds
        # on 12MP images. Modern phone cameras don't need denoising.
        # Skipping this step reduces processing from ~37s to ~1s.

        # ---------------------------------------------------------
        # STAGE 2: PERCEPTUAL GRAYSCALE (Tri-X Spectral)
        # ---------------------------------------------------------
        # 1. Linearize color space
        linear_img = self.linearize_srgb(image)

        # 2. Apply Tri-X Spectral Weights (High Green bias)
        # Weights: [B, G, R] because OpenCV loads as BGR
        trix_weights = np.array([0.10, 0.72, 0.18])
        gray_linear = np.dot(linear_img, trix_weights)

        # 3. Re-apply Gamma to get back to visual grayscale
        gray = self.apply_gamma(gray_linear)

        # Clip to ensure valid range 0-1
        gray = np.clip(gray, 0, 1)

        # ---------------------------------------------------------
        # STAGE 3: FILM CHARACTERISTIC CURVE
        # ---------------------------------------------------------
        # Shadow Lift
        shadows = np.power(gray * 1.1, 1.25) * 0.92

        # Highlight Rolloff
        highlights = 1.0 - np.power((1.0 - gray) * 1.05, 0.75) * 0.95

        # S-Curve Blend at 40% gray
        mask = 1 / (1 + np.exp(-10 * (gray - 0.4)))
        gray = (shadows * (1 - mask)) + (highlights * mask)

        # Global Contrast Boost
        gray = (gray - 0.5) * self.params.contrast_boost + 0.5
        gray = np.clip(gray, 0, 1)

        # ---------------------------------------------------------
        # STAGE 4: ADAPTIVE UNSHARP MASKING
        # ---------------------------------------------------------
        # Create the Unsharp Mask (High Pass)
        gaussian = cv2.GaussianBlur(gray, (0, 0), sigmaX=2.0)
        unsharp_mask = gray - gaussian

        # Create "Edge Protection" Map (Sobel)
        # This finds strong edges (ears, silhouette) to AVOID sharpening them
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_mag = np.sqrt(sobel_x**2 + sobel_y**2)

        # We invert the map: High gradient = Low sharpening strength
        # This targets TEXTURE (fur) while ignoring EDGES (halos)
        sharpness_map = 1.0 - np.clip(gradient_mag * 5.0, 0, 1)

        # Apply sharpening weighted by this map
        gray = gray + (unsharp_mask * self.params.edge_strength * sharpness_map)
        gray = np.clip(gray, 0, 1)

        # ---------------------------------------------------------
        # STAGE 5: SCREEN-BLEND HALATION
        # ---------------------------------------------------------
        # Create the "Glow"
        bloom = cv2.GaussianBlur(gray, (0, 0), sigmaX=15) * self.params.halation_strength

        # Apply Screen Blend Mode: 1 - (1-Base)*(1-Blend)
        # Keeps white fur white, but adds glow to midtones
        gray = 1.0 - (1.0 - gray) * (1.0 - bloom)

        # ---------------------------------------------------------
        # STAGE 6: FILM GRAIN
        # ---------------------------------------------------------
        height, width = gray.shape
        noise = np.random.normal(0, self.params.grain_strength, (height, width))

        # Grain Mask: Stronger in shadows, weaker in highlights
        grain_mask = 1.2 - gray
        grain_mask = np.clip(grain_mask, 0.3, 1.0)

        gray = gray + (noise * grain_mask)

        # ---------------------------------------------------------
        # STAGE 7: FINAL OUTPUT
        # ---------------------------------------------------------
        # Convert back to 8-bit integer
        final_gray = np.clip(gray * 255, 0, 255).astype(np.uint8)

        # If original had alpha, create grayscale with alpha
        if alpha_channel is not None:
            # Convert grayscale to BGRA (gray, gray, gray, alpha)
            result = np.zeros((height, width, 4), dtype=np.uint8)
            result[:, :, 0] = final_gray  # B
            result[:, :, 1] = final_gray  # G
            result[:, :, 2] = final_gray  # R
            result[:, :, 3] = alpha_channel  # A
            return result

        return final_gray

    def process_pil(self, image: Image.Image) -> Image.Image:
        """
        Process a PIL Image through the Tri-X pipeline.

        Args:
            image: Input PIL Image (RGB or RGBA)

        Returns:
            Processed PIL Image (L for grayscale, LA or RGBA with alpha)
        """
        # Store original mode for alpha handling
        original_mode = image.mode
        has_alpha = original_mode in ('RGBA', 'LA')

        # Convert to numpy array
        if original_mode == 'RGBA':
            # Convert RGBA to BGRA for OpenCV
            arr = np.array(image)
            arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA)
        elif original_mode == 'RGB':
            arr = np.array(image)
            arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        elif original_mode == 'LA':
            # Grayscale with alpha - convert to BGRA first
            rgba = image.convert('RGBA')
            arr = np.array(rgba)
            arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA)
        elif original_mode == 'L':
            # Pure grayscale - convert to BGR
            rgb = image.convert('RGB')
            arr = np.array(rgb)
            arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        else:
            # Other modes - convert to RGB first
            rgb = image.convert('RGB')
            arr = np.array(rgb)
            arr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

        # Process through pipeline
        processed = self.process_array(arr)

        # Convert back to PIL
        if len(processed.shape) == 3 and processed.shape[2] == 4:
            # BGRA result - convert to RGBA PIL
            processed_rgba = cv2.cvtColor(processed, cv2.COLOR_BGRA2RGBA)
            return Image.fromarray(processed_rgba, mode='RGBA')
        else:
            # Grayscale result
            return Image.fromarray(processed, mode='L')


def apply_blackwhite_effect(
    image: Image.Image,
    contrast: float = 1.12,
    edge_strength: float = 0.9,
    halation: float = 0.5,
    grain: float = 0.08
) -> Image.Image:
    """
    Apply Enhanced Black & White effect to a PIL Image.

    Convenience function with customizable parameters.

    Args:
        image: Input PIL Image (RGB or RGBA)
        contrast: Contrast boost factor (default: 1.12)
        edge_strength: Edge sharpening strength (default: 0.9)
        halation: Glow/halation strength (default: 0.5)
        grain: Film grain strength (default: 0.08)

    Returns:
        Processed PIL Image with transparent background preserved
    """
    params = TriXParams(
        contrast_boost=contrast,
        edge_strength=edge_strength,
        halation_strength=halation,
        grain_strength=grain
    )

    pipeline = TriXPipeline(params)
    return pipeline.process_pil(image)


# CLI support for standalone testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: python blackwhite_trix.py <input_image_path> <output_image_path>")
        print("\nOptional parameters:")
        print("  --contrast <float>  Contrast boost (default: 1.12)")
        print("  --edge <float>      Edge sharpening (default: 0.9)")
        print("  --halation <float>  Glow strength (default: 0.5)")
        print("  --grain <float>     Film grain (default: 0.08)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Load image
    img = Image.open(input_path)
    print(f"Loaded: {input_path} ({img.size}, {img.mode})")

    # Process
    processor = TriXPipeline()
    result = processor.process_pil(img)

    # Save
    result.save(output_path)
    print(f"Saved: {output_path} ({result.size}, {result.mode})")
