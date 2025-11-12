"""
InSPyReNet model implementation for background removal.
Using the official InSPyReNet implementation from transparent-background package.
"""

import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
import logging
from typing import Tuple, Optional
import time
import cv2
import os
import gc
import threading
import psutil
from transparent_background import Remover

logger = logging.getLogger(__name__)

class InSPyReNetProcessor:
    """Official InSPyReNet implementation using transparent-background package"""
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        device: Optional[torch.device] = None,
        target_size: int = 1024,
        mode: str = 'base',
        resize_mode: str = 'static'
    ):
        self.device = device or torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.target_size = target_size
        self.mode = mode  # 'base', 'fast', or 'base-nightly'
        self.resize_mode = resize_mode  # 'static' or 'dynamic'
        self.model = None
        self.model_loaded = False
        self.load_start_time = None
        self.loading_lock = threading.Lock()
        self.load_attempts = 0
        self.max_load_attempts = 3
        
        # Model cache directory
        self.model_cache_dir = "/app/models"
        os.makedirs(self.model_cache_dir, exist_ok=True)
        
        logger.info(f"InSPyReNet processor initialized on {self.device} with mode={mode}, resize={resize_mode}")
    
    def load_model(self) -> None:
        """Load InSPyReNet model using transparent-background package with GPU/CPU fallback"""
        # Use lock to prevent concurrent loading attempts
        with self.loading_lock:
            if self.model_loaded and self.model is not None:
                logger.info("Model already loaded in memory, skipping...")
                return
                
            if self.load_start_time is not None:
                # Wait for ongoing loading to complete
                wait_time = 0
                while self.load_start_time is not None and wait_time < 60:
                    time.sleep(1)
                    wait_time += 1
                
                # Check if model loaded successfully
                if self.model_loaded and self.model is not None:
                    logger.info("Model loaded by another thread")
                    return
                    
            self.load_start_time = time.time()
            self.load_attempts += 1
            logger.info(f"Loading InSPyReNet model (attempt {self.load_attempts}/{self.max_load_attempts}, mode: {self.mode}, resize: {self.resize_mode})...")
            
            # Clear memory before loading
            self._clear_memory_for_loading()
        
            # Device diagnostics
            gpu_available = torch.cuda.is_available()
            logger.info(f"CUDA available: {gpu_available}")
            if gpu_available:
                logger.info(f"GPU device count: {torch.cuda.device_count()}")
                logger.info(f"Current device: {self.device}")
                # Log GPU memory status
                for i in range(torch.cuda.device_count()):
                    mem_allocated = torch.cuda.memory_allocated(i) / 1024**3
                    mem_reserved = torch.cuda.memory_reserved(i) / 1024**3
                    logger.info(f"GPU {i} memory: {mem_allocated:.2f}GB allocated, {mem_reserved:.2f}GB reserved")
            
            # Try to load model with proper device handling
            device_options = []
            
            # Prepare device options to try
            if gpu_available and 'cuda' in str(self.device):
                # Try GPU first - use simplified device string
                device_options.extend(['cuda', 'cuda:0'])
            
            # Always have CPU as fallback
            device_options.append('cpu')
        
            for device_str in device_options:
                try:
                    logger.info(f"Attempting to load model on device: {device_str}")
                    
                    # Clear any existing model
                    if self.model is not None:
                        del self.model
                        self.model = None
                        gc.collect()
                        if torch.cuda.is_available():
                            torch.cuda.empty_cache()
                    
                    # Initialize the official InSPyReNet model from transparent-background
                    # Use simplified device string without torch.device wrapper
                    self.model = Remover(
                        mode=self.mode,  # 'base' for high quality, 'fast' for speed
                        device=device_str,  # Pass string directly
                        resize=self.resize_mode  # 'static' for stability, 'dynamic' for better detail
                    )
                    
                    logger.info(f"Model instantiated on {device_str}, testing with dummy image...")
                    
                    # Test with minimal dummy image to reduce cold start time
                    dummy_image = Image.new('RGB', (32, 32), color='red')
                    test_result = self.model.process(dummy_image, type='rgba')
                    
                    if test_result is not None and isinstance(test_result, Image.Image):
                        self.model_loaded = True
                        self.device = torch.device(device_str)
                        load_time = time.time() - self.load_start_time
                        logger.info(f"✅ InSPyReNet model loaded successfully on {device_str} in {load_time:.2f}s!")
                        self.load_start_time = None
                        self.load_attempts = 0  # Reset attempts on success
                        
                        # Clean up test resources
                        dummy_image.close()
                        test_result.close()
                        gc.collect()
                        
                        return
                    else:
                        logger.warning(f"Model test failed on {device_str} - trying next device...")
                        if self.model:
                            del self.model
                            self.model = None
                        
                except ImportError as e:
                    logger.error(f"transparent-background package issue: {e}")
                    self.model_loaded = False
                    self.load_start_time = None
                    self.load_attempts = self.max_load_attempts  # Don't retry on import errors
                    raise RuntimeError(f"Failed to import transparent-background: {e}")
                    
                except RuntimeError as e:
                    logger.warning(f"Runtime error loading model on {device_str}: {e}")
                    if "out of memory" in str(e).lower() or "oom" in str(e).lower():
                        logger.warning("Out of memory error detected, clearing memory...")
                        self._clear_memory_for_loading()
                        time.sleep(2)  # Give system time to recover
                    continue
                    
                except Exception as e:
                    logger.warning(f"Failed to load model on {device_str}: {e}")
                    logger.warning(f"Error type: {type(e).__name__}")
                    if "CUDA" in str(e) or "GPU" in str(e):
                        logger.warning(f"GPU-related error on {device_str}, trying next device...")
                    continue
        
            # If we get here, all devices failed
            logger.error("❌ Failed to load InSPyReNet model on any device!")
            logger.error("Available devices tried: " + ", ".join(device_options))
            self.model_loaded = False
            self.model = None
            self.load_start_time = None
            
            # Check if we should retry
            if self.load_attempts < self.max_load_attempts:
                retry_delay = 5 * self.load_attempts  # Exponential backoff
                logger.info(f"Retrying model load in {retry_delay} seconds...")
                time.sleep(retry_delay)
                self.load_model()  # Recursive retry
            else:
                logger.error(f"Model loading failed after {self.max_load_attempts} attempts")
                raise RuntimeError("Failed to load InSPyReNet model after multiple attempts")

    def remove_background(self, image: Image.Image) -> Image.Image:
        """Main function to remove background from image using InSPyReNet"""
        # Verify model state before processing
        if not self.model_loaded or self.model is None:
            logger.info("Model not loaded, loading now...")
            self.load_model()
            
        if not self.model_loaded or self.model is None:
            raise RuntimeError("InSPyReNet model failed to load")
            
        logger.info(f"Processing image {image.size} with InSPyReNet (mode: {self.mode})")
        
        # Clear GPU memory before processing
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
        
        original_image = None
        if image.mode != 'RGB':
            original_image = image
            image = image.convert('RGB')
        
        start_time = time.time()
        
        try:
            # Use the official InSPyReNet model to remove background
            try:
                result_image = self.model.process(image, type='rgba')
            except Exception as e:
                if "No matching definition for argument type" in str(e):
                    logger.warning("NumPy type error detected, attempting workaround...")
                    # Workaround: Convert to numpy array and back to reset image data type
                    img_array = np.array(image, dtype=np.uint8)
                    image_fixed = Image.fromarray(img_array)
                    result_image = self.model.process(image_fixed, type='rgba')
                    logger.info("Workaround successful - processed with type conversion")
                else:
                    raise
            
            # Clean up converted image
            if original_image is not None:
                del image
                gc.collect()
            
            # Clear GPU memory after processing
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            
            processing_time = time.time() - start_time
            logger.info(f"InSPyReNet processing completed in {processing_time:.2f}s (model was cached: {self.model_loaded})")
            
            return result_image
            
        except Exception as e:
            logger.error(f"InSPyReNet processing failed: {e}")
            # Clean up resources
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            gc.collect()
            
            # Don't reset model state on processing failures - only on loading failures
            logger.error(f"Processing failed but keeping model loaded for retry: {e}")
            raise

    def get_model_info(self) -> dict:
        """Get model information and statistics"""
        base_info = {
            "model_name": "InSPyReNet (official)",
            "architecture": "Inverse Saliency Pyramid Reconstruction Network",
            "device": str(self.device),
            "target_size": self.target_size,
            "mode": self.mode,
            "resize_mode": self.resize_mode,
            "package": "transparent-background",
            "official": True
        }
        
        if not self.model_loaded or self.model is None:
            return {
                **base_info,
                "status": "not_loaded",
                "model_instance": None,
                "ready": False
            }
            
        return {
            **base_info,
            "status": "loaded",
            "model_instance": str(type(self.model).__name__),
            "ready": True,
            "model_object_id": id(self.model)
        }
    
    def force_model_load(self) -> bool:
        """Force model loading for warming up the API"""
        try:
            logger.info("Force loading InSPyReNet model...")
            self.model_loaded = False
            self.model = None
            self.load_model()
            return self.model_loaded
        except Exception as e:
            logger.error(f"Force model loading failed: {e}")
            return False
    
    def is_model_ready(self) -> bool:
        """Check if model is ready for processing"""
        return self.model_loaded and self.model is not None
    
    def warmup(self) -> dict:
        """
        Lightweight warmup method that initializes the model with minimal processing.
        Returns warmup status and timing information.
        """
        start_time = time.time()
        
        try:
            # Load model if not already loaded
            if not self.is_model_ready():
                logger.info("Warmup: Loading model...")
                model_load_start = time.time()
                self.load_model()
                model_load_time = time.time() - model_load_start
                
                if not self.is_model_ready():
                    return {
                        "status": "failed",
                        "message": "Model failed to load during warmup",
                        "total_time": time.time() - start_time,
                        "model_load_time": model_load_time
                    }
            else:
                model_load_time = 0
                logger.info("Warmup: Model already loaded")
            
            # Process minimal 32x32 pixel image for warmup
            # Note: Must be ≥32x32 for dynamic resize mode (rounds to nearest 32x multiple)
            # 16x16 would round to 0x0: int(round(16/32)) * 32 = 0
            logger.info("Warmup: Processing minimal test image...")
            dummy_start = time.time()
            dummy_image = Image.new('RGB', (32, 32), color=(128, 128, 128))
            
            # Use the model's process method directly for fastest warmup
            try:
                result = self.model.process(dummy_image, type='rgba')
            except Exception as e:
                if "No matching definition for argument type" in str(e):
                    logger.warning("NumPy type error in warmup, attempting workaround...")
                    # Workaround: Convert to numpy array and back to reset image data type
                    img_array = np.array(dummy_image, dtype=np.uint8)
                    dummy_image_fixed = Image.fromarray(img_array)
                    result = self.model.process(dummy_image_fixed, type='rgba')
                    logger.info("Warmup workaround successful - processed with type conversion")
                    dummy_image_fixed.close()
                else:
                    raise
            
            # Clean up immediately
            dummy_image.close()
            if result:
                result.close()
            
            dummy_process_time = time.time() - dummy_start
            total_time = time.time() - start_time
            
            # Force cleanup after warmup
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            logger.info(f"Warmup completed successfully in {total_time:.2f}s (model_load: {model_load_time:.2f}s, process: {dummy_process_time:.2f}s)")
            
            return {
                "status": "success",
                "message": "Model warmed up successfully",
                "total_time": total_time,
                "model_load_time": model_load_time,
                "process_time": dummy_process_time,
                "model_ready": True,
                "device": str(self.device),
                "mode": self.mode
            }
            
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"Warmup failed after {total_time:.2f}s: {e}")
            
            return {
                "status": "error",
                "message": f"Warmup failed: {str(e)}",
                "error_type": type(e).__name__,
                "total_time": total_time,
                "model_ready": self.is_model_ready()
            }
    
    def _clear_memory_for_loading(self) -> None:
        """Clear memory before model loading to prevent OOM errors"""
        try:
            # Log memory status before cleanup
            process = psutil.Process()
            mem_before = process.memory_info().rss / 1024**3
            logger.info(f"Memory before cleanup: {mem_before:.2f} GB")
            
            # Python garbage collection
            gc.collect()
            gc.collect()  # Run twice
            
            # Clear GPU memory if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                
                # Force GPU memory release
                for i in range(torch.cuda.device_count()):
                    with torch.cuda.device(i):
                        torch.cuda.empty_cache()
            
            # Log memory status after cleanup
            mem_after = process.memory_info().rss / 1024**3
            logger.info(f"Memory after cleanup: {mem_after:.2f} GB (freed {mem_before - mem_after:.2f} GB)")
            
        except Exception as e:
            logger.warning(f"Error during memory cleanup: {e}") 