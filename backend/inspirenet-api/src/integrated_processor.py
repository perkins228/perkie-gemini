"""
Integrated Processing Pipeline
Combines background removal with effects processing for optimal performance
"""

import time
import asyncio
import hashlib
import json
import logging
import gc
from typing import Dict, List, Optional, Any, Callable
from io import BytesIO
from PIL import Image, ImageOps
import numpy as np
import cv2

from inspirenet_model import InSPyReNetProcessor
from effects.effects_processor import EffectsProcessor
from storage import CloudStorageManager

logger = logging.getLogger(__name__)

class IntegratedProcessor:
    """Integrated pipeline for background removal + effects processing with caching"""
    
    def __init__(
        self,
        storage_manager: Optional[CloudStorageManager] = None,
        gpu_enabled: bool = True
    ):
        self.inspirenet_processor = InSPyReNetProcessor()
        self.model_processor = self.inspirenet_processor  # Add alias for memory-efficient processor
        self.effects_processor = EffectsProcessor(gpu_enabled=gpu_enabled)
        self.storage_manager = storage_manager
        
        # Performance tracking
        self.processing_stats = {
            'total_requests': 0,
            'bg_removal_time': [],
            'effects_time': [],
            'cache_hits': 0,
            'cache_misses': 0
        }
        
        logger.info("Integrated processor initialized")
    
    def _get_normalized_image_hash(self, image_data: bytes) -> str:
        """Generate normalized hash from image content, ignoring metadata"""
        try:
            # Open image and extract core pixel data
            from PIL import Image, ImageOps
            image = Image.open(BytesIO(image_data))

            # Apply EXIF orientation BEFORE hashing to ensure rotated images get consistent hashes
            oriented_image = ImageOps.exif_transpose(image)
            if oriented_image:
                image = oriented_image

            # Remove EXIF and other metadata by converting to standard format
            if image.mode in ('RGBA', 'LA'):
                # Preserve transparency
                normalized = Image.new('RGBA', image.size)
                normalized.paste(image, (0, 0))
            else:
                # Convert to RGB to remove metadata
                normalized = image.convert('RGB')
            
            # Save to buffer without metadata
            buffer = BytesIO()
            normalized.save(buffer, format='PNG', optimize=False)  # Disable optimization for consistency
            normalized_data = buffer.getvalue()
            
            # Hash the normalized pixel data
            return hashlib.sha256(normalized_data).hexdigest()
            
        except Exception as e:
            logger.warning(f"Failed to normalize image for hashing: {e}, using raw data hash")
            # Fallback to raw data hash if normalization fails
            return hashlib.sha256(image_data).hexdigest()
    
    def generate_cache_key(self, image_data: bytes, effect_name: str, params: Dict[str, Any]) -> str:
        """Generate cache key for background-removed image + specific effect"""
        # Use deterministic content hash by normalizing image data first
        content_hash = self._get_normalized_image_hash(image_data)
        params_str = json.dumps(params, sort_keys=True)
        cache_key = f"integrated_{effect_name}_{content_hash}_{hashlib.md5(params_str.encode()).hexdigest()}"
        return cache_key
    
    def generate_bg_cache_key(self, image_data: bytes) -> str:
        """Generate cache key for background removal only"""
        # Use deterministic content hash by normalizing image data first
        content_hash = self._get_normalized_image_hash(image_data)
        return f"bg_removal_{content_hash}"
    
    async def process_with_effects(
        self,
        image_data: bytes,
        effects: List[str],
        effect_params: Optional[Dict[str, Dict[str, Any]]] = None,
        use_cache: bool = True,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Process image with background removal and multiple effects
        
        Args:
            image_data: Raw image bytes
            effects: List of effect names to apply
            effect_params: Optional parameters for each effect
            use_cache: Whether to use caching
            progress_callback: Optional progress callback function
            
        Returns:
            Dictionary with results for each effect
        """
        start_time = time.time()
        self.processing_stats['total_requests'] += 1
        
        if progress_callback:
            await progress_callback("upload", 5, "Processing request...")
        
        # Initialize effect parameters
        if effect_params is None:
            effect_params = {}
        
        # Check if we have cached background-removed image
        bg_cache_key = self.generate_bg_cache_key(image_data)
        bg_removed_image = None
        bg_cache_hit = False
        
        if use_cache and self.storage_manager:
            try:
                if progress_callback:
                    await progress_callback("cache_check", 10, "Checking background removal cache...")
                
                cached_bg = await self.storage_manager.get_cached_result(bg_cache_key)
                if cached_bg:
                    bg_removed_image = Image.open(BytesIO(cached_bg))
                    bg_cache_hit = True
                    self.processing_stats['cache_hits'] += 1
                    
                    if progress_callback:
                        await progress_callback("cache_hit", 25, "Found cached background removal!")
                        
                    logger.info("Background removal cache hit")
                else:
                    self.processing_stats['cache_misses'] += 1
                    
            except Exception as e:
                logger.warning(f"Background cache lookup failed: {e}")
        
        # Remove background if not cached
        if bg_removed_image is None:
            if progress_callback:
                await progress_callback("bg_removal", 15, "Removing background with InSPyReNet...")
            
            bg_start_time = time.time()
            
            # Load and process image
            input_image = Image.open(BytesIO(image_data))
            
            # Log original dimensions
            logger.info(f"Original image dimensions: {input_image.size}, mode: {input_image.mode}")
            
            # Fix orientation based on EXIF data
            rotated_image = ImageOps.exif_transpose(input_image)
            if rotated_image:
                logger.info(f"After EXIF transpose: {rotated_image.size}, mode: {rotated_image.mode}")
                input_image = rotated_image
            else:
                logger.warning("ImageOps.exif_transpose returned None - using original image")
            bg_removed_image = await self._remove_background_async(input_image, progress_callback)
            
            bg_processing_time = time.time() - bg_start_time
            self.processing_stats['bg_removal_time'].append(bg_processing_time)
            
            # Cache background-removed image
            if use_cache and self.storage_manager:
                try:
                    # Type validation to prevent critical parameter type errors
                    if not isinstance(bg_cache_key, str):
                        logger.error(f"Invalid bg cache key type: {type(bg_cache_key)}")
                        raise TypeError(f"Background cache key must be string, got {type(bg_cache_key)}")
                    
                    # Validate cache key format
                    if len(bg_cache_key) > 250:  # Reasonable limit for cache keys
                        logger.warning("Background cache key too long, skipping cache")
                    elif any(ord(c) < 32 or ord(c) > 126 for c in bg_cache_key):  # Check for non-printable chars
                        logger.warning("Background cache key contains invalid characters, skipping cache")
                    else:
                        bg_buffer = BytesIO()
                        bg_removed_image.save(bg_buffer, format='PNG')
                        bg_data = bg_buffer.getvalue()
                        
                        if not isinstance(bg_data, bytes):
                            logger.error(f"Invalid bg data type: {type(bg_data)}")
                            raise TypeError(f"Background data must be bytes, got {type(bg_data)}")
                        
                        await self.storage_manager.cache_result(bg_cache_key, bg_data)
                        logger.info(f"Background removal result cached with key: {bg_cache_key[:32]}...")
                except Exception as e:
                    logger.warning(f"Failed to cache background removal: {e}")
        
        # Process effects
        if progress_callback:
            await progress_callback("effects_start", 40, f"Processing {len(effects)} effects...")
        
        effects_start_time = time.time()
        results = {}
        effect_cache_hits = {}
        
        # Convert PIL to numpy array for effects processing
        bg_removed_array = np.array(bg_removed_image)
        if bg_removed_array.shape[2] == 4:  # RGBA
            # Convert to BGR + alpha for OpenCV compatibility
            bgr_image = cv2.cvtColor(bg_removed_array[:, :, :3], cv2.COLOR_RGB2BGR)
            # CRITICAL FIX: Make each component contiguous BEFORE dstack
            # This prevents non-contiguous memory issues that cause Color effect to fail
            bgr_image = np.ascontiguousarray(bgr_image)
            alpha_channel = bg_removed_array[:, :, 3]
            alpha_channel = np.ascontiguousarray(alpha_channel)
            # Reconstruct BGRA from contiguous components
            bg_removed_cv = np.dstack([bgr_image, alpha_channel])
            logger.info(f"🔧 BGRA reconstruction: shape={bg_removed_cv.shape}, contiguous={bg_removed_cv.flags['C_CONTIGUOUS']}")
        else:  # RGB
            bg_removed_cv = cv2.cvtColor(bg_removed_array, cv2.COLOR_RGB2BGR)
            bg_removed_cv = np.ascontiguousarray(bg_removed_cv)
        
        # Process each effect
        for i, effect_name in enumerate(effects):
            effect_progress = 40 + int((i / len(effects)) * 45)
            
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
                        continue
                except Exception as e:
                    logger.warning(f"Effect cache lookup failed for {effect_name}: {e}")
            
            effect_cache_hits[effect_name] = False
            
            # Apply effect
            try:
                effect_params_for_effect = effect_params.get(effect_name, {})
                logger.info(f"Processing effect '{effect_name}' with params: {effect_params_for_effect}")
                
                effect_result = self.effects_processor.process_single_effect(
                    bg_removed_cv, effect_name, **effect_params_for_effect
                )
                
                # Validate effect result
                if effect_result is None:
                    logger.error(f"Effect '{effect_name}' returned None - processing failed")
                    results[effect_name] = None
                    continue
                
                if not hasattr(effect_result, 'shape') or len(effect_result.shape) < 3:
                    logger.error(f"Effect '{effect_name}' returned invalid result shape: {getattr(effect_result, 'shape', 'no shape')}")
                    results[effect_name] = None
                    continue
                
                # Convert result to bytes - PRESERVE ALPHA CHANNEL
                if effect_result.shape[2] == 4:  # BGRA format
                    # Convert BGRA to RGBA for PIL
                    result_rgba = cv2.cvtColor(effect_result, cv2.COLOR_BGRA2RGBA)
                    result_image = Image.fromarray(result_rgba, mode='RGBA')
                else:  # BGR format
                    # Convert BGR to RGB for PIL
                    result_rgb = cv2.cvtColor(effect_result, cv2.COLOR_BGR2RGB)
                    result_image = Image.fromarray(result_rgb, mode='RGB')
                
                result_buffer = BytesIO()
                result_image.save(result_buffer, format='PNG')
                result_bytes = result_buffer.getvalue()
                
                # Validate the result bytes
                if not result_bytes or len(result_bytes) < 100:  # Too small for valid PNG
                    logger.error(f"Effect '{effect_name}' produced invalid or too small result ({len(result_bytes) if result_bytes else 0} bytes)")
                    results[effect_name] = None
                    continue
                
                results[effect_name] = result_bytes
                logger.info(f"Effect '{effect_name}' processed successfully ({len(result_bytes)} bytes)")
                
                # Cache effect result
                if use_cache and self.storage_manager:
                    try:
                        # Type validation to prevent critical parameter type errors
                        if not isinstance(effect_cache_key, str):
                            logger.error(f"Invalid cache key type for {effect_name}: {type(effect_cache_key)}")
                            raise TypeError(f"Cache key must be string, got {type(effect_cache_key)}")
                        if not isinstance(result_bytes, bytes):
                            logger.error(f"Invalid result data type for {effect_name}: {type(result_bytes)}")
                            raise TypeError(f"Result data must be bytes, got {type(result_bytes)}")
                        
                        # Validate cache key format
                        if len(effect_cache_key) > 250:  # Reasonable limit for cache keys
                            logger.warning(f"Cache key too long for {effect_name}, skipping cache")
                        elif any(ord(c) < 32 or ord(c) > 126 for c in effect_cache_key):  # Check for non-printable chars
                            logger.warning(f"Cache key contains invalid characters for {effect_name}, skipping cache")
                        else:
                            await self.storage_manager.cache_result(effect_cache_key, result_bytes)
                            logger.info(f"Effect result cached for {effect_name} with key: {effect_cache_key[:32]}...")
                    except Exception as e:
                        logger.warning(f"Failed to cache effect {effect_name}: {e}")
                
                # Memory cleanup after each effect
                del effect_result, result_image, result_buffer
                if 'result_rgba' in locals():
                    del result_rgba
                if 'result_rgb' in locals():
                    del result_rgb
                gc.collect()
                        
            except Exception as e:
                logger.error(f"Failed to process effect {effect_name}: {e}")
                results[effect_name] = None
        
        effects_processing_time = time.time() - effects_start_time
        self.processing_stats['effects_time'].append(effects_processing_time)
        
        # Analyze processing results
        successful_effects = [name for name, result in results.items() if result is not None]
        failed_effects = [name for name, result in results.items() if result is None]
        
        # Log processing summary
        logger.info(f"Effects processing summary: {len(successful_effects)} successful, {len(failed_effects)} failed")
        if failed_effects:
            logger.warning(f"Failed effects: {failed_effects}")
        if successful_effects:
            logger.info(f"Successful effects: {successful_effects}")
        
        # Determine overall success
        processing_succeeded = len(successful_effects) > 0
        
        if progress_callback:
            if processing_succeeded:
                await progress_callback("complete", 100, f"Processing complete! {len(successful_effects)} effects succeeded.")
            else:
                await progress_callback("error", 100, f"Processing failed! All {len(failed_effects)} effects failed.")
        
        total_processing_time = time.time() - start_time
        
        # Compile response
        response = {
            'success': processing_succeeded,
            'results': results,
            'processing_time': {
                'total': total_processing_time,
                'background_removal': bg_processing_time if not bg_cache_hit else 0,
                'effects_processing': effects_processing_time
            },
            'cache_info': {
                'background_removal_hit': bg_cache_hit,
                'effect_cache_hits': effect_cache_hits,
                'total_cache_hits': sum(1 for hit in effect_cache_hits.values() if hit) + (1 if bg_cache_hit else 0),
                'total_operations': len(effects) + 1  # +1 for background removal
            },
            'effects_processed': successful_effects,  # Only include successful effects
            'failed_effects': failed_effects,
            'model_info': self.inspirenet_processor.get_model_info()
        }
        
        logger.info(f"Integrated processing completed in {total_processing_time:.3f}s "
                   f"(BG: {bg_processing_time if not bg_cache_hit else 0:.3f}s, "
                   f"Effects: {effects_processing_time:.3f}s)")
        
        return response
    
    async def _remove_background_async(self, image: Image.Image, progress_callback: Optional[Callable] = None) -> Image.Image:
        """Remove background asynchronously with progress updates"""
        loop = asyncio.get_event_loop()
        
        def remove_bg_sync():
            if progress_callback:
                # Update progress during background removal
                def bg_progress_update():
                    try:
                        loop.call_soon_threadsafe(
                            lambda: asyncio.create_task(
                                progress_callback("bg_removal", 25, "InSPyReNet processing...")
                            )
                        )
                    except:
                        pass
                
                # Simulate progress updates during processing
                import threading
                progress_thread = threading.Thread(target=bg_progress_update)
                progress_thread.daemon = True
                progress_thread.start()
            
            return self.inspirenet_processor.remove_background(image)
        
        return await loop.run_in_executor(None, remove_bg_sync)
    
    async def process_single_effect_only(
        self,
        bg_removed_image: Image.Image,
        effect_name: str,
        effect_params: Optional[Dict[str, Any]] = None,
        use_cache: bool = True
    ) -> bytes:
        """
        Process single effect on already background-removed image
        Useful for real-time effect switching
        """
        if effect_params is None:
            effect_params = {}
        
        # Convert to OpenCV format
        bg_removed_array = np.array(bg_removed_image)
        if bg_removed_array.shape[2] == 4:  # RGBA
            bgr_image = cv2.cvtColor(bg_removed_array[:, :, :3], cv2.COLOR_RGB2BGR)
            # CRITICAL FIX: Make each component contiguous BEFORE dstack
            bgr_image = np.ascontiguousarray(bgr_image)
            alpha_channel = bg_removed_array[:, :, 3]
            alpha_channel = np.ascontiguousarray(alpha_channel)
            # Reconstruct BGRA from contiguous components
            bg_removed_cv = np.dstack([bgr_image, alpha_channel])
        else:  # RGB
            bg_removed_cv = cv2.cvtColor(bg_removed_array, cv2.COLOR_RGB2BGR)
            bg_removed_cv = np.ascontiguousarray(bg_removed_cv)
        
        # Apply effect
        effect_result = self.effects_processor.process_single_effect(
            bg_removed_cv, effect_name, **effect_params
        )
        
        # Convert result to bytes - PRESERVE ALPHA CHANNEL
        if effect_result.shape[2] == 4:  # BGRA format
            # Convert BGRA to RGBA for PIL
            result_rgba = cv2.cvtColor(effect_result, cv2.COLOR_BGRA2RGBA)
            result_image = Image.fromarray(result_rgba, mode='RGBA')
        else:  # BGR format
            # Convert BGR to RGB for PIL
            result_rgb = cv2.cvtColor(effect_result, cv2.COLOR_BGR2RGB)
            result_image = Image.fromarray(result_rgb, mode='RGB')
        
        result_buffer = BytesIO()
        result_image.save(result_buffer, format='PNG')
        
        return result_buffer.getvalue()
    
    def get_available_effects(self) -> List[str]:
        """Get list of available effects from the effects processor"""
        return self.effects_processor.get_available_effects()
    
    def get_effect_info(self, effect_name: str) -> Dict[str, Any]:
        """Get information about a specific effect"""
        return self.effects_processor.get_effect_info(effect_name)
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics"""
        avg_bg_time = sum(self.processing_stats['bg_removal_time']) / len(self.processing_stats['bg_removal_time']) if self.processing_stats['bg_removal_time'] else 0
        avg_effects_time = sum(self.processing_stats['effects_time']) / len(self.processing_stats['effects_time']) if self.processing_stats['effects_time'] else 0
        
        return {
            'total_requests': self.processing_stats['total_requests'],
            'average_bg_removal_time': avg_bg_time,
            'average_effects_time': avg_effects_time,
            'cache_hit_rate': self.processing_stats['cache_hits'] / max(1, self.processing_stats['cache_hits'] + self.processing_stats['cache_misses']),
            'available_effects': list(self.effects_processor.get_available_effects()),
            'inspirenet_info': self.inspirenet_processor.get_model_info()
        }
    
    def get_available_effects(self) -> List[str]:
        """Get list of available effects"""
        return self.effects_processor.get_available_effects()
    
    def get_effect_info(self, effect_name: str) -> Dict[str, Any]:
        """Get information about a specific effect"""
        return self.effects_processor.get_effect_info(effect_name) 