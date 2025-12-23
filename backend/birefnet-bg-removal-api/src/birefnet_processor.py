"""
BiRefNet Background Removal Processor

High-quality background removal using BiRefNet via rembg package.
Optimized for pet photos with fine fur/hair detail preservation.
"""

import os
import gc
import time
import logging
import threading
from typing import Optional, Tuple
from dataclasses import dataclass

import numpy as np
from PIL import Image
import psutil

logger = logging.getLogger(__name__)


@dataclass
class ProcessingResult:
    """Result from background removal processing"""
    image: Image.Image
    inference_time_ms: float
    input_size: Tuple[int, int]
    output_size: Tuple[int, int]
    model_variant: str


class BiRefNetProcessor:
    """
    BiRefNet background removal processor using rembg package.

    Supports multiple model variants:
    - birefnet-general: Best for general use, good balance
    - birefnet-general-lite: Faster, slightly lower quality
    - birefnet-portrait: Optimized for human portraits
    - birefnet-massive: Trained on massive dataset, highest quality
    """

    SUPPORTED_VARIANTS = [
        "birefnet-general",
        "birefnet-general-lite",
        "birefnet-portrait",
        "birefnet-dis",
        "birefnet-hrsod",
        "birefnet-cod",
        "birefnet-massive"
    ]

    def __init__(
        self,
        model_variant: str = "birefnet-general",
        max_dimension: int = 2048,
        enable_preprocessing: bool = True
    ):
        """
        Initialize BiRefNet processor.

        Args:
            model_variant: Which BiRefNet variant to use
            max_dimension: Maximum image dimension for preprocessing
            enable_preprocessing: Whether to resize large images before processing
        """
        if model_variant not in self.SUPPORTED_VARIANTS:
            raise ValueError(f"Unsupported variant: {model_variant}. "
                           f"Supported: {self.SUPPORTED_VARIANTS}")

        self.model_variant = model_variant
        self.max_dimension = max_dimension
        self.enable_preprocessing = enable_preprocessing

        self.session = None
        self.model_loaded = False
        self.loading_lock = threading.Lock()
        self.load_start_time: Optional[float] = None

        logger.info(f"BiRefNet processor initialized (variant={model_variant}, "
                   f"max_dim={max_dimension})")

    def load_model(self) -> None:
        """Load BiRefNet model via rembg"""
        with self.loading_lock:
            if self.model_loaded and self.session is not None:
                logger.info("Model already loaded, skipping...")
                return

            self.load_start_time = time.time()
            logger.info(f"Loading BiRefNet model (variant: {self.model_variant})...")

            try:
                # Clear memory before loading
                self._clear_memory()

                from rembg import new_session

                # Load the specified variant
                self.session = new_session(self.model_variant)

                load_time = time.time() - self.load_start_time
                self.model_loaded = True
                self.load_start_time = None

                logger.info(f"BiRefNet model loaded successfully in {load_time:.2f}s")

            except ImportError as e:
                logger.error(f"Failed to import rembg: {e}")
                self.model_loaded = False
                self.load_start_time = None
                raise RuntimeError(f"rembg package not installed: {e}")

            except Exception as e:
                logger.error(f"Failed to load BiRefNet model: {e}")
                self.model_loaded = False
                self.load_start_time = None
                raise RuntimeError(f"Failed to load BiRefNet: {e}")

    def preprocess_image(
        self,
        image: Image.Image
    ) -> Tuple[Image.Image, float]:
        """
        Preprocess image: resize if too large.

        Args:
            image: Input PIL Image

        Returns:
            (processed_image, scale_factor)
        """
        if not self.enable_preprocessing:
            return image, 1.0

        original_size = image.size
        max_dim = max(original_size)

        if max_dim <= self.max_dimension:
            return image, 1.0

        scale = self.max_dimension / max_dim
        new_size = (
            int(original_size[0] * scale),
            int(original_size[1] * scale)
        )

        # Use LANCZOS for high-quality downscaling
        resized = image.resize(new_size, Image.Resampling.LANCZOS)

        logger.info(f"Preprocessed image: {original_size} -> {new_size} "
                   f"(scale: {scale:.2f})")

        return resized, scale

    def remove_background(
        self,
        image: Image.Image,
        alpha_matting: bool = False,
        alpha_matting_foreground_threshold: int = 240,
        alpha_matting_background_threshold: int = 10
    ) -> ProcessingResult:
        """
        Remove background from image using BiRefNet.

        Args:
            image: Input PIL Image (RGB or RGBA)
            alpha_matting: Enable alpha matting for better edges
            alpha_matting_foreground_threshold: Foreground threshold (0-255)
            alpha_matting_background_threshold: Background threshold (0-255)

        Returns:
            ProcessingResult with RGBA image and metadata
        """
        # Ensure model is loaded
        if not self.model_loaded or self.session is None:
            logger.info("Model not loaded, loading now...")
            self.load_model()

        if not self.model_loaded or self.session is None:
            raise RuntimeError("BiRefNet model failed to load")

        input_size = image.size

        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Preprocess (resize if too large)
        processed_image, scale = self.preprocess_image(image)

        logger.info(f"Processing image {input_size} with BiRefNet "
                   f"(variant: {self.model_variant})")

        start_time = time.time()

        try:
            from rembg import remove

            # Process with BiRefNet
            result = remove(
                processed_image,
                session=self.session,
                alpha_matting=alpha_matting,
                alpha_matting_foreground_threshold=alpha_matting_foreground_threshold,
                alpha_matting_background_threshold=alpha_matting_background_threshold
            )

            # Upscale back to original size if we downscaled
            if scale < 1.0:
                result = result.resize(input_size, Image.Resampling.LANCZOS)

            inference_time = (time.time() - start_time) * 1000

            logger.info(f"BiRefNet processing completed in {inference_time:.0f}ms")

            return ProcessingResult(
                image=result,
                inference_time_ms=inference_time,
                input_size=input_size,
                output_size=result.size,
                model_variant=self.model_variant
            )

        except Exception as e:
            logger.error(f"BiRefNet processing failed: {e}")
            gc.collect()
            raise

    def warmup(self) -> dict:
        """
        Warmup the model with a small test image.

        Returns:
            Warmup status and timing information
        """
        start_time = time.time()

        try:
            # Load model if not loaded
            if not self.model_loaded:
                logger.info("Warmup: Loading model...")
                model_load_start = time.time()
                self.load_model()
                model_load_time = time.time() - model_load_start

                if not self.model_loaded:
                    return {
                        "status": "failed",
                        "message": "Model failed to load during warmup",
                        "total_time": time.time() - start_time
                    }
            else:
                model_load_time = 0
                logger.info("Warmup: Model already loaded")

            # Process minimal test image
            logger.info("Warmup: Processing test image...")
            dummy_start = time.time()
            dummy_image = Image.new('RGB', (64, 64), color=(128, 128, 128))

            result = self.remove_background(dummy_image)

            dummy_process_time = time.time() - dummy_start
            total_time = time.time() - start_time

            # Cleanup
            gc.collect()

            logger.info(f"Warmup completed in {total_time:.2f}s "
                       f"(load: {model_load_time:.2f}s, process: {dummy_process_time:.2f}s)")

            return {
                "status": "success",
                "message": "Model warmed up successfully",
                "total_time": total_time,
                "model_load_time": model_load_time,
                "process_time": dummy_process_time,
                "model_variant": self.model_variant,
                "model_ready": True
            }

        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"Warmup failed after {total_time:.2f}s: {e}")

            return {
                "status": "error",
                "message": f"Warmup failed: {str(e)}",
                "total_time": total_time,
                "model_ready": self.model_loaded
            }

    def get_model_info(self) -> dict:
        """Get model information and status"""
        return {
            "model_name": "BiRefNet",
            "model_variant": self.model_variant,
            "package": "rembg",
            "max_dimension": self.max_dimension,
            "preprocessing_enabled": self.enable_preprocessing,
            "status": "loaded" if self.model_loaded else "not_loaded",
            "ready": self.model_loaded and self.session is not None,
            "supported_variants": self.SUPPORTED_VARIANTS
        }

    def is_model_ready(self) -> bool:
        """Check if model is ready for processing"""
        return self.model_loaded and self.session is not None

    def _clear_memory(self) -> None:
        """Clear memory before/after operations"""
        try:
            process = psutil.Process()
            mem_before = process.memory_info().rss / 1024**3

            gc.collect()
            gc.collect()

            mem_after = process.memory_info().rss / 1024**3

            if mem_before - mem_after > 0.1:
                logger.info(f"Cleared {mem_before - mem_after:.2f}GB memory")

        except Exception as e:
            logger.warning(f"Memory cleanup warning: {e}")


# Singleton instance for the API
_processor_instance: Optional[BiRefNetProcessor] = None


def get_processor(
    model_variant: str = None,
    max_dimension: int = None
) -> BiRefNetProcessor:
    """
    Get or create the global processor instance.

    Uses environment variables for defaults:
    - BIREFNET_MODEL_VARIANT: Model variant (default: birefnet-general)
    - BIREFNET_MAX_DIMENSION: Max image dimension (default: 2048)
    """
    global _processor_instance

    if _processor_instance is None:
        variant = model_variant or os.getenv("BIREFNET_MODEL_VARIANT", "birefnet-general")
        max_dim = max_dimension or int(os.getenv("BIREFNET_MAX_DIMENSION", "2048"))

        _processor_instance = BiRefNetProcessor(
            model_variant=variant,
            max_dimension=max_dim
        )

    return _processor_instance
