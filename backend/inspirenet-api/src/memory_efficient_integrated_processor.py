"""
Memory-efficient integrated processor for background removal and effects
Processes effects sequentially with immediate cleanup to prevent OOM errors
"""

import os
import cv2
import time
import hashlib
import gc
import torch
import numpy as np
from PIL import Image, ImageOps
from io import BytesIO
import logging
from typing import Dict, List, Optional, Tuple, Any, Callable
import asyncio

from effects.optimized_effects_processor import OptimizedEffectsProcessor
from storage import CloudStorageManager
from memory_monitor import memory_monitor

logger = logging.getLogger(__name__)

class MemoryEfficientIntegratedProcessor:
    """Memory-efficient processor that handles effects sequentially"""
    
    def __init__(
        self,
        model_processor,
        storage_manager: Optional[CloudStorageManager] = None,
        effects_processor: Optional[OptimizedEffectsProcessor] = None
    ):
        self.model_processor = model_processor
        self.storage_manager = storage_manager
        self.effects_processor = effects_processor or OptimizedEffectsProcessor()
        
        # Memory management settings from environment
        self.effects_batch_size = int(os.getenv("EFFECTS_BATCH_SIZE", "2"))
        self.memory_threshold_cpu = float(os.getenv("MEMORY_THRESHOLD_CPU", "0.75"))
        self.memory_threshold_gpu = float(os.getenv("MEMORY_THRESHOLD_GPU", "0.80"))
        self.enable_streaming = os.getenv("ENABLE_STREAMING", "true").lower() == "true"
        
        logger.info(f"Memory-efficient processor initialized with batch_size={self.effects_batch_size}")
    
    def generate_cache_key(self, image_data: bytes, effect_name: str = None, effect_params: dict = None) -> str:
        """Generate cache key for processed images"""
        hasher = hashlib.sha256()
        hasher.update(image_data)
        
        if effect_name:
            hasher.update(effect_name.encode())
            if effect_params:
                hasher.update(str(sorted(effect_params.items())).encode())
        
        return hasher.hexdigest()
    
    async def _process_single_effect_with_cleanup(
        self,
        bg_removed_cv: np.ndarray,
        effect_name: str,
        effect_params: dict,
        session_id: str,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[str, Optional[bytes]]:
        """Process a single effect with immediate memory cleanup"""
        
        logger.info(f"Processing effect: {effect_name}")
        start_time = time.time()
        
        try:
            # Check memory before processing
            if memory_monitor.check_memory_pressure():
                logger.warning(f"Memory pressure detected before {effect_name}, forcing cleanup")
                memory_monitor.force_cleanup()
                await asyncio.sleep(0.1)  # Give system time to recover
            
            # Process effect
            effect_result = self.effects_processor.process_single_effect(
                bg_removed_cv, effect_name, **effect_params
            )
            
            # Convert result to bytes
            if effect_result.shape[2] == 4:  # BGRA format
                result_rgba = cv2.cvtColor(effect_result, cv2.COLOR_BGRA2RGBA)
                result_image = Image.fromarray(result_rgba, mode='RGBA')
            else:  # BGR format
                result_rgb = cv2.cvtColor(effect_result, cv2.COLOR_BGR2RGB)
                result_image = Image.fromarray(result_rgb, mode='RGB')
            
            # Save to buffer with compression
            result_buffer = BytesIO()
            if result_image.mode == 'RGBA':
                result_image.save(result_buffer, format='PNG', compress_level=6, optimize=True)
            else:
                result_image.save(result_buffer, format='JPEG', quality=90, optimize=True)
            
            result_bytes = result_buffer.getvalue()
            
            # If storage manager available, upload immediately and return URL
            if self.storage_manager and self.enable_streaming:
                try:
                    # Generate storage key
                    storage_key = f"effects/{session_id}/{effect_name}_{int(time.time())}.png"
                    
                    # Upload to storage - returns bool, not URL
                    upload_success = await self.storage_manager.upload_processed_image(
                        storage_key, result_bytes, effect_name
                    )
                    
                    if upload_success:
                        logger.info(f"Effect {effect_name} uploaded successfully")
                    else:
                        logger.error(f"Failed to upload {effect_name} to storage")
                    
                    # Always set effect_url to None since storage doesn't return URLs
                    effect_url = None
                    # DON'T delete result_bytes - we need to return it!
                    
                except Exception as e:
                    logger.error(f"Failed to upload {effect_name} to storage: {e}")
                    # Check for parameter type errors
                    if "cache_key must be a string" in str(e) or "TypeError" in str(e.__class__.__name__):
                        logger.critical(f"CRITICAL: Parameter type error detected - this is a bug! {e}")
                    effect_url = None
                    # Keep the result_bytes so processing doesn't fail entirely
            else:
                effect_url = None
            
            # Cleanup immediately
            del effect_result
            if 'result_rgba' in locals():
                del result_rgba
            if 'result_rgb' in locals():
                del result_rgb
            result_image.close()
            del result_image
            result_buffer.close()
            del result_buffer
            
            # Force garbage collection
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            processing_time = time.time() - start_time
            logger.info(f"Effect {effect_name} processed in {processing_time:.2f}s")
            
            return effect_url, result_bytes
            
        except Exception as e:
            logger.error(f"Failed to process effect {effect_name}: {e}")
            # Ensure cleanup on error
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            return None, None
    
    async def process_image_with_effects(
        self,
        image_data: bytes,
        effects: List[str],
        effect_params: Dict[str, dict] = None,
        use_cache: bool = True,
        session_id: str = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Process image with multiple effects using memory-efficient approach"""
        
        start_time = time.time()
        effect_params = effect_params or {}
        session_id = session_id or f"session_{int(time.time())}"
        
        # Initialize response structure
        results = {}
        effect_urls = {}
        effect_cache_hits = {}
        
        logger.info(f"Starting memory-efficient processing for {len(effects)} effects")
        
        # Step 1: Background removal (with caching)
        if progress_callback:
            await progress_callback("background_removal", 10, "Removing background...")
        
        bg_cache_key = self.generate_cache_key(image_data)
        bg_removed_image = None
        bg_cache_hit = False
        
        # Check cache for background removal
        if use_cache and self.storage_manager:
            try:
                cached_bg = await self.storage_manager.get_cached_result(bg_cache_key)
                if cached_bg:
                    bg_removed_image = Image.open(BytesIO(cached_bg))
                    bg_cache_hit = True
                    logger.info("Background removal cache hit")
            except Exception as e:
                logger.warning(f"Cache lookup failed: {e}")
        
        # Remove background if not cached
        if bg_removed_image is None:
            image = Image.open(BytesIO(image_data))
            # Fix orientation based on EXIF data
            image = ImageOps.exif_transpose(image)
            bg_removed_image = self.model_processor.remove_background(image)
            image.close()
            del image
            
            # Cache the result
            if use_cache and self.storage_manager:
                try:
                    buffer = BytesIO()
                    bg_removed_image.save(buffer, format='PNG')
                    await self.storage_manager.cache_result(bg_cache_key, buffer.getvalue())
                    buffer.close()
                except Exception as e:
                    logger.warning(f"Failed to cache background removal: {e}")
        
        # Convert to OpenCV format
        bg_removed_array = np.array(bg_removed_image)
        if bg_removed_array.shape[2] == 4:  # RGBA
            bgr_image = cv2.cvtColor(bg_removed_array[:, :, :3], cv2.COLOR_RGB2BGR)
            alpha_channel = bg_removed_array[:, :, 3]
            bg_removed_cv = np.dstack([bgr_image, alpha_channel])
        else:  # RGB
            bg_removed_cv = cv2.cvtColor(bg_removed_array, cv2.COLOR_RGB2BGR)
        
        # Clean up PIL image
        bg_removed_image.close()
        del bg_removed_image, bg_removed_array
        gc.collect()
        
        if progress_callback:
            await progress_callback("effects_processing", 30, "Processing effects...")
        
        # Step 2: Process effects in batches
        processed_count = 0
        
        for i in range(0, len(effects), self.effects_batch_size):
            batch_effects = effects[i:i + self.effects_batch_size]
            
            logger.info(f"Processing batch {i//self.effects_batch_size + 1}: {batch_effects}")
            
            # Process each effect in the batch
            for effect_name in batch_effects:
                effect_progress = 30 + int((processed_count / len(effects)) * 60)
                
                if progress_callback:
                    await progress_callback("effects_processing", effect_progress, f"Applying {effect_name}...")
                
                # Check effect cache
                effect_cache_key = self.generate_cache_key(
                    image_data, effect_name, effect_params.get(effect_name, {})
                )
                
                cached_effect = None
                if use_cache and self.storage_manager:
                    try:
                        cached_effect = await self.storage_manager.get_cached_result(effect_cache_key)
                        if cached_effect:
                            effect_cache_hits[effect_name] = True
                            results[effect_name] = cached_effect
                            logger.info(f"Effect cache hit for {effect_name}")
                            processed_count += 1
                            continue
                    except Exception as e:
                        logger.warning(f"Effect cache lookup failed for {effect_name}: {e}")
                
                effect_cache_hits[effect_name] = False
                
                # Process effect with cleanup
                effect_url, effect_data = await self._process_single_effect_with_cleanup(
                    bg_removed_cv,
                    effect_name,
                    effect_params.get(effect_name, {}),
                    session_id,
                    progress_callback
                )
                
                if effect_url:
                    effect_urls[effect_name] = effect_url
                
                if effect_data:
                    results[effect_name] = effect_data
                    
                    # Cache the result
                    if use_cache and self.storage_manager:
                        try:
                            # Ensure we're passing string cache key and bytes data in correct order
                            if not isinstance(effect_cache_key, str):
                                logger.error(f"Invalid cache key type for {effect_name}: {type(effect_cache_key)}")
                                raise TypeError(f"Cache key must be string, got {type(effect_cache_key)}")
                            if not isinstance(effect_data, bytes):
                                logger.error(f"Invalid effect data type for {effect_name}: {type(effect_data)}")
                                raise TypeError(f"Effect data must be bytes, got {type(effect_data)}")
                            
                            await self.storage_manager.cache_result(effect_cache_key, effect_data)
                            logger.info(f"Effect result cached for {effect_name} with key: {effect_cache_key[:32]}...")
                        except Exception as e:
                            logger.warning(f"Failed to cache effect {effect_name}: {e}")
                else:
                    results[effect_name] = None
                
                processed_count += 1
            
            # Force cleanup after each batch
            if i + self.effects_batch_size < len(effects):
                logger.info("Batch processed, forcing memory cleanup")
                memory_monitor.force_cleanup()
                await asyncio.sleep(0.2)  # Give system time to recover
        
        # Final cleanup
        del bg_removed_cv
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        if progress_callback:
            await progress_callback("complete", 100, "Processing complete!")
        
        total_processing_time = time.time() - start_time
        
        # Compile response
        response = {
            'success': True,
            'results': results,
            'effect_urls': effect_urls if effect_urls else None,
            'processing_time': {
                'total': total_processing_time
            },
            'cache_info': {
                'background_removal_hit': bg_cache_hit,
                'effect_cache_hits': effect_cache_hits,
                'total_cache_hits': sum(1 for hit in effect_cache_hits.values() if hit) + (1 if bg_cache_hit else 0),
                'total_operations': len(effects) + 1
            },
            'effects_processed': list(effects),
            'memory_info': memory_monitor.get_memory_info() if hasattr(memory_monitor, 'get_memory_info') else {}
        }
        
        return response