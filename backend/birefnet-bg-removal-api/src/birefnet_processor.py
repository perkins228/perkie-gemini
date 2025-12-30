"""
BiRefNet Background Removal Processor (Transformers/PyTorch)

High-quality background removal using BiRefNet via HuggingFace transformers.
Direct PyTorch inference at 2048px resolution with native GPU support.
Optimized for pet photos with fine fur/hair detail preservation.
"""

import os
import gc
import time
import logging
import threading
from typing import Optional, Tuple, List
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter
import psutil
import cv2

logger = logging.getLogger(__name__)


def enhance_mask(
    mask: Image.Image,
    threshold: float = 0.5,
    contrast_boost: float = 1.5,
    cleanup_kernel_size: int = 3,
    hard_floor: float = 0.0,
    hard_ceiling: float = 1.0
) -> Image.Image:
    """
    Enhance the segmentation mask for cleaner background removal.

    The raw model output is a probability mask (0-1) where uncertain areas
    produce semi-transparent gray regions. This function:
    1. Boosts contrast to push values toward 0 or 1
    2. Applies soft thresholding to reduce gray artifacts
    3. Applies hard floor/ceiling cutoffs to eliminate remaining grays
    4. Optionally applies morphological cleanup

    Args:
        mask: PIL Image (L mode) with values 0-255
        threshold: Center point for contrast curve (0-1)
        contrast_boost: How aggressively to push values to extremes (1.0-5.0)
        cleanup_kernel_size: Size of morphological kernel (0 to disable)
        hard_floor: Values below this become 0 (eliminates light gray shadows)
        hard_ceiling: Values above this become 1 (ensures solid foreground)

    Returns:
        Enhanced PIL Image mask
    """
    # Convert to numpy float
    mask_array = np.array(mask).astype(np.float32) / 255.0

    # Apply sigmoid-based contrast enhancement
    # This pushes values toward 0 or 1, reducing gray artifacts
    # Formula: 1 / (1 + exp(-contrast_boost * (x - threshold) * 10))
    centered = (mask_array - threshold) * 10 * contrast_boost
    enhanced = 1.0 / (1.0 + np.exp(-centered))

    # Apply hard floor cutoff - values below this become fully transparent
    # This eliminates stubborn gray shadow artifacts that sigmoid alone can't fix
    if hard_floor > 0:
        enhanced = np.where(enhanced < hard_floor, 0.0, enhanced)

    # Apply hard ceiling cutoff - values above this become fully opaque
    if hard_ceiling < 1.0:
        enhanced = np.where(enhanced > hard_ceiling, 1.0, enhanced)

    # Convert back to uint8
    enhanced_uint8 = (enhanced * 255).astype(np.uint8)

    # Optional morphological cleanup to smooth edges
    if cleanup_kernel_size > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (cleanup_kernel_size, cleanup_kernel_size)
        )
        # Close small holes in foreground
        enhanced_uint8 = cv2.morphologyEx(enhanced_uint8, cv2.MORPH_CLOSE, kernel)
        # Open to remove small noise
        enhanced_uint8 = cv2.morphologyEx(enhanced_uint8, cv2.MORPH_OPEN, kernel)

    return Image.fromarray(enhanced_uint8, mode='L')


def log_gpu_diagnostics() -> dict:
    """
    Log comprehensive GPU/CUDA diagnostics at startup.
    Returns diagnostic info dict for health checks.
    """
    diagnostics = {
        "torch_available": False,
        "cuda_available": False,
        "cuda_device_count": 0,
        "cuda_device_name": None,
        "cuda_memory_gb": None,
        "inference_device": "cpu",
    }

    try:
        import torch
        diagnostics["torch_available"] = True
        diagnostics["cuda_available"] = torch.cuda.is_available()
        diagnostics["cuda_device_count"] = torch.cuda.device_count()

        if torch.cuda.is_available():
            diagnostics["cuda_device_name"] = torch.cuda.get_device_name(0)
            diagnostics["cuda_memory_gb"] = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            diagnostics["inference_device"] = "cuda"

            logger.info(f"[GPU-DIAG] PyTorch CUDA available: YES")
            logger.info(f"[GPU-DIAG] CUDA device count: {torch.cuda.device_count()}")
            logger.info(f"[GPU-DIAG] CUDA device name: {torch.cuda.get_device_name(0)}")
            logger.info(f"[GPU-DIAG] CUDA memory: {diagnostics['cuda_memory_gb']:.1f} GB")
            logger.info(f"[GPU-DIAG] CUDA version: {torch.version.cuda}")
            logger.info(f"[GPU-DIAG] PyTorch version: {torch.__version__}")
        else:
            logger.warning("[GPU-DIAG] PyTorch CUDA available: NO - will use CPU")

    except ImportError:
        logger.warning("[GPU-DIAG] PyTorch not available")
    except Exception as e:
        logger.error(f"[GPU-DIAG] PyTorch CUDA check failed: {e}")

    return diagnostics


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
    BiRefNet background removal processor using HuggingFace transformers.

    Uses direct PyTorch inference for GPU acceleration without ONNX Runtime.
    Supports high-resolution processing up to 2048px for fine fur detail.
    """

    SUPPORTED_VARIANTS = [
        "ZhengPeng7/BiRefNet",
        "ZhengPeng7/BiRefNet-portrait",
        "ZhengPeng7/BiRefNet-general",
        "ZhengPeng7/BiRefNet-lite",
        "ZhengPeng7/BiRefNet-matting",         # Hair/fur matting at 1024x1024
        "ZhengPeng7/BiRefNet_HR-matting",      # BEST FOR PETS - 2048x2048
        "ZhengPeng7/BiRefNet_dynamic-matting", # Variable resolution matting
    ]

    def __init__(
        self,
        model_variant: str = "ZhengPeng7/BiRefNet-portrait",
        max_dimension: int = 1024,
        enable_preprocessing: bool = True
    ):
        """
        Initialize BiRefNet processor.

        Args:
            model_variant: HuggingFace model path
            max_dimension: Maximum image dimension for processing (1024 for BiRefNet-general)
            enable_preprocessing: Whether to resize large images before processing
        """
        self.model_variant = model_variant
        self.max_dimension = max_dimension
        self.enable_preprocessing = enable_preprocessing

        # Inference resolution - BiRefNet-general is trained at 1024x1024
        self.inference_size = (1024, 1024)

        self.model = None
        self.transform = None
        self.device = None
        self.model_loaded = False
        self.loading_lock = threading.Lock()
        self.load_start_time: Optional[float] = None

        logger.info(f"BiRefNet processor initialized (variant={model_variant}, "
                   f"max_dim={max_dimension}, inference_size={self.inference_size})")

    def load_model(self) -> None:
        """Load BiRefNet model via transformers"""
        with self.loading_lock:
            if self.model_loaded and self.model is not None:
                logger.info("Model already loaded, skipping...")
                return

            self.load_start_time = time.time()
            logger.info(f"[LOAD-TIMING] Starting model load (variant: {self.model_variant})...")

            try:
                import torch
                from transformers import AutoModelForImageSegmentation
                from torchvision import transforms

                # Stage 1: Determine device
                stage1_start = time.time()
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
                stage1_time = time.time() - stage1_start
                logger.info(f"[LOAD-TIMING] Stage 1 - Device detection: {stage1_time:.2f}s (using {self.device})")

                # Stage 2: Load model from HuggingFace
                stage2_start = time.time()
                logger.info(f"[LOAD-TIMING] Stage 2 - Loading model from {self.model_variant}...")

                self.model = AutoModelForImageSegmentation.from_pretrained(
                    self.model_variant,
                    trust_remote_code=True
                )
                self.model.to(self.device)
                self.model.eval()

                stage2_time = time.time() - stage2_start
                logger.info(f"[LOAD-TIMING] Stage 2 - Model load: {stage2_time:.2f}s")

                # Stage 3: Setup transform pipeline
                stage3_start = time.time()
                self.transform = transforms.Compose([
                    transforms.Resize(self.inference_size),
                    transforms.ToTensor(),
                    transforms.Normalize(
                        mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]
                    ),
                ])
                stage3_time = time.time() - stage3_start
                logger.info(f"[LOAD-TIMING] Stage 3 - Transform setup: {stage3_time:.2f}s")

                load_time = time.time() - self.load_start_time
                self.model_loaded = True
                self.load_start_time = None

                logger.info(f"[LOAD-TIMING] Total model load: {load_time:.2f}s")
                logger.info(f"[LOAD-TIMING] Breakdown: device={stage1_time:.2f}s, "
                           f"model={stage2_time:.2f}s, transform={stage3_time:.2f}s")
                logger.info(f"[GPU-DIAG] Model running on: {self.device}")
                logger.info(f"BiRefNet model loaded successfully in {load_time:.2f}s")

            except ImportError as e:
                logger.error(f"Failed to import required packages: {e}")
                self.model_loaded = False
                self.load_start_time = None
                raise RuntimeError(f"Required packages not installed: {e}")

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
            alpha_matting: Enable alpha matting for better edges (not used in transformers version)
            alpha_matting_foreground_threshold: Foreground threshold (not used)
            alpha_matting_background_threshold: Background threshold (not used)

        Returns:
            ProcessingResult with RGBA image and metadata
        """
        import torch
        from torchvision import transforms

        # Ensure model is loaded
        if not self.model_loaded or self.model is None:
            logger.info("Model not loaded, loading now...")
            self.load_model()

        if not self.model_loaded or self.model is None:
            raise RuntimeError("BiRefNet model failed to load")

        input_size = image.size

        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Preprocess (resize if too large for preprocessing, but we'll still process at inference_size)
        processed_image, scale = self.preprocess_image(image)

        logger.info(f"Processing image {input_size} with BiRefNet transformers "
                   f"(variant: {self.model_variant}, device: {self.device})")

        start_time = time.time()

        try:
            # Transform image for model
            input_tensor = self.transform(processed_image).unsqueeze(0).to(self.device)

            # Run inference
            with torch.no_grad():
                preds = self.model(input_tensor)[-1].sigmoid().cpu()

            # Post-process: resize mask back to original resolution
            pred = preds[0].squeeze()
            pred_pil = transforms.ToPILImage()(pred)

            # Resize mask to original input size (high-res output)
            mask = pred_pil.resize(input_size, Image.Resampling.BILINEAR)

            # Enhance mask to reduce gray artifacts and improve edge clarity
            # This pushes uncertain (gray) areas toward fully transparent or opaque
            # Parameters tuned for pet photos with complex backgrounds (sofas, furniture)
            enhanced_mask = enhance_mask(
                mask,
                threshold=0.60,       # Higher threshold - more areas become transparent
                contrast_boost=4.0,   # Very aggressive - steep sigmoid curve
                cleanup_kernel_size=5,  # Larger kernel for smoother edges
                hard_floor=0.25       # Kill all grays below 25% - eliminates shadow artifacts
            )

            logger.info(f"Mask enhanced: threshold=0.60, contrast=4.0, cleanup=5, floor=0.25")

            # Apply enhanced mask to original image for full resolution output
            result = image.copy()
            result.putalpha(enhanced_mask)

            inference_time = (time.time() - start_time) * 1000

            logger.info(f"BiRefNet processing completed in {inference_time:.0f}ms on {self.device}")

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
            if self.device == "cuda":
                import torch
                torch.cuda.empty_cache()
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

            # Process minimal test image to warm up CUDA
            logger.info("Warmup: Processing test image...")
            dummy_start = time.time()
            dummy_image = Image.new('RGB', (512, 512), color=(128, 128, 128))

            result = self.remove_background(dummy_image)

            dummy_process_time = time.time() - dummy_start
            total_time = time.time() - start_time

            # Cleanup
            gc.collect()
            if self.device == "cuda":
                import torch
                torch.cuda.empty_cache()

            logger.info(f"Warmup completed in {total_time:.2f}s "
                       f"(load: {model_load_time:.2f}s, process: {dummy_process_time:.2f}s)")

            return {
                "status": "success",
                "message": "Model warmed up successfully",
                "total_time": total_time,
                "model_load_time": model_load_time,
                "process_time": dummy_process_time,
                "model_variant": self.model_variant,
                "device": self.device,
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
        info = {
            "model_name": "BiRefNet",
            "model_variant": self.model_variant,
            "package": "transformers",
            "inference_backend": "pytorch",
            "inference_size": self.inference_size,
            "max_dimension": self.max_dimension,
            "preprocessing_enabled": self.enable_preprocessing,
            "status": "loaded" if self.model_loaded else "not_loaded",
            "ready": self.model_loaded and self.model is not None,
            "device": self.device if self.device else "not_initialized",
            "using_gpu": self.device == "cuda" if self.device else False,
            "supported_variants": self.SUPPORTED_VARIANTS
        }

        return info

    def is_model_ready(self) -> bool:
        """Check if model is ready for processing"""
        return self.model_loaded and self.model is not None

    def _clear_memory(self) -> None:
        """Clear memory before/after operations"""
        try:
            process = psutil.Process()
            mem_before = process.memory_info().rss / 1024**3

            gc.collect()
            gc.collect()

            if self.device == "cuda":
                import torch
                torch.cuda.empty_cache()

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
    - BIREFNET_MODEL_VARIANT: Model variant (default: ZhengPeng7/BiRefNet_HR-matting)
    - BIREFNET_MAX_DIMENSION: Max image dimension (default: 1024)
    """
    global _processor_instance

    if _processor_instance is None:
        variant = model_variant or os.getenv("BIREFNET_MODEL_VARIANT", "ZhengPeng7/BiRefNet_HR-matting")
        max_dim = max_dimension or int(os.getenv("BIREFNET_MAX_DIMENSION", "1024"))

        _processor_instance = BiRefNetProcessor(
            model_variant=variant,
            max_dimension=max_dim
        )

    return _processor_instance
