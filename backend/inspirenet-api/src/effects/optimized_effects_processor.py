"""
Optimized Effects Processor
Enhanced with parallel processing capabilities and GPU memory management
"""

import numpy as np
import cv2
from typing import Dict, List, Optional, Any, Tuple
from PIL import Image
import asyncio
import time
import logging
import torch
import concurrent.futures
from functools import partial

from .base_effect import BaseEffect
from .enhanced_blackwhite_effect import EnhancedBlackWhiteEffect
from .dithering_effect import DitheringEffect
from .optimized_popart_effect import OptimizedPopArtEffect
from .pet_optimized_eightbit_effect import PetOptimizedEightBitEffect

logger = logging.getLogger(__name__)

class OptimizedEffectsProcessor:
    """Enhanced effects processor with parallel capabilities and GPU optimization"""
    
    SUPPORTED_EFFECTS = {
        'color': 'Original color with background removed',
        'enhancedblackwhite': 'Enhanced B&W with 60% visual improvement and research-informed processing',
        'dithering': 'Floyd-Steinberg dithering with spaced dots - Canvas algorithm port',
        'popart': 'Optimized pop art with 10x+ performance improvement and ITU-R BT.709 processing',
        'retro8bit': 'Pet-optimized 8-bit with enhanced color science, 8x8 chunky blocks, and 7x speedup',
        'watercolor': '4-stage watercolor with bleeding and texture (TODO)',
        'mosaic': 'Adaptive mosaic with variable tile sizes (TODO)'
    }
    
    def __init__(
        self, 
        gpu_enabled: bool = True,
        max_workers: int = 4,
        enable_gpu_memory_management: bool = True
    ):
        """Initialize effects processor with enhanced capabilities"""
        self.gpu_enabled = gpu_enabled and torch.cuda.is_available()
        self.enable_gpu_memory_management = enable_gpu_memory_management
        self.effects = {}
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers)
        self._initialize_effects()
        
        # Performance tracking
        self.effect_timings = {effect: [] for effect in self.SUPPORTED_EFFECTS.keys()}
        self.gpu_memory_clears = 0
        
        logger.info(f"OptimizedEffectsProcessor initialized with {len(self.effects)} effects "
                   f"(GPU: {self.gpu_enabled}, Workers: {max_workers})")
    
    def _initialize_effects(self):
        """Initialize optimized effect instances"""
        try:
            # Color effect (no processing needed)
            self.effects['color'] = None
            
            # Enhanced Black & White effect
            self.effects['enhancedblackwhite'] = EnhancedBlackWhiteEffect(self.gpu_enabled)
            
            # Floyd-Steinberg Dithering effect
            self.effects['dithering'] = DitheringEffect(self.gpu_enabled)
            
            # Optimized Pop Art effect
            self.effects['popart'] = OptimizedPopArtEffect(self.gpu_enabled)
            
            # Pet-Optimized 8-bit Retro effect
            self.effects['retro8bit'] = PetOptimizedEightBitEffect(self.gpu_enabled)
            
            logger.info("Optimized effects initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize effects: {e}")
            raise
    
    def _manage_gpu_memory(self):
        """Clear GPU memory cache when needed"""
        if self.enable_gpu_memory_management and self.gpu_enabled:
            torch.cuda.empty_cache()
            self.gpu_memory_clears += 1
            logger.debug("GPU memory cache cleared")
    
    def _process_image_region(
        self, 
        region: np.ndarray, 
        effect_instance: BaseEffect,
        effect_name: str,
        **kwargs
    ) -> np.ndarray:
        """Process a single image region (for parallel processing)"""
        try:
            return effect_instance.apply(region, **kwargs)
        except Exception as e:
            logger.error(f"Failed to process region with {effect_name}: {e}")
            return region
    
    def _split_image_for_parallel(
        self, 
        image: np.ndarray, 
        num_splits: int = 4
    ) -> Tuple[List[np.ndarray], List[Tuple[int, int, int, int]]]:
        """Split image into regions for parallel processing"""
        h, w = image.shape[:2]
        
        # Calculate optimal split based on image size
        if h * w < 1000000:  # Small images don't benefit from splitting
            return [image], [(0, 0, h, w)]
        
        # Split into grid
        split_h = int(np.sqrt(num_splits))
        split_w = num_splits // split_h
        
        regions = []
        coords = []
        
        for i in range(split_h):
            for j in range(split_w):
                y1 = i * (h // split_h)
                y2 = (i + 1) * (h // split_h) if i < split_h - 1 else h
                x1 = j * (w // split_w)
                x2 = (j + 1) * (w // split_w) if j < split_w - 1 else w
                
                # Add overlap to prevent edge artifacts
                overlap = 10
                y1_ext = max(0, y1 - overlap)
                y2_ext = min(h, y2 + overlap)
                x1_ext = max(0, x1 - overlap)
                x2_ext = min(w, x2 + overlap)
                
                regions.append(image[y1_ext:y2_ext, x1_ext:x2_ext])
                coords.append((y1, x1, y2, x2))
        
        return regions, coords
    
    def _merge_processed_regions(
        self,
        regions: List[np.ndarray],
        coords: List[Tuple[int, int, int, int]],
        original_shape: Tuple[int, ...]
    ) -> np.ndarray:
        """Merge processed regions back into full image"""
        if len(regions) == 1:
            return regions[0]
        
        # Create output image
        output = np.zeros(original_shape, dtype=regions[0].dtype)
        
        # Merge regions with blending at overlaps
        for region, (y1, x1, y2, x2) in zip(regions, coords):
            # Extract the non-overlapped part
            overlap = 10
            if region.shape[0] > (y2 - y1) or region.shape[1] > (x2 - x1):
                # Region has overlap, extract center
                y_start = overlap if y1 > 0 else 0
                y_end = region.shape[0] - overlap if y2 < original_shape[0] else region.shape[0]
                x_start = overlap if x1 > 0 else 0
                x_end = region.shape[1] - overlap if x2 < original_shape[1] else region.shape[1]
                
                output[y1:y2, x1:x2] = region[y_start:y_end, x_start:x_end]
            else:
                output[y1:y2, x1:x2] = region
        
        return output
    
    def process_single_effect_parallel(
        self, 
        image: np.ndarray, 
        effect_name: str,
        num_workers: int = 2,
        **kwargs
    ) -> np.ndarray:
        """
        Process single effect with optional parallel region processing
        
        For large images, splits into regions and processes in parallel
        """
        if effect_name not in self.SUPPORTED_EFFECTS:
            raise ValueError(f"Unknown effect: {effect_name}")
        
        start_time = time.time()
        
        try:
            if effect_name == 'color':
                # Color effect - return original
                result = image.copy()
            else:
                effect_instance = self.effects.get(effect_name)
                if not effect_instance:
                    raise NotImplementedError(f"Effect '{effect_name}' not yet implemented")
                
                # Check if image is large enough for parallel processing
                h, w = image.shape[:2]
                if h * w > 2000000 and num_workers > 1:  # > 2MP
                    logger.debug(f"Using parallel processing for {effect_name} ({h}x{w})")
                    
                    # Split image
                    regions, coords = self._split_image_for_parallel(image, num_workers)
                    
                    # Process regions in parallel
                    process_func = partial(
                        self._process_image_region,
                        effect_instance=effect_instance,
                        effect_name=effect_name,
                        **kwargs
                    )
                    
                    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                        processed_regions = list(executor.map(process_func, regions))
                    
                    # Merge results
                    result = self._merge_processed_regions(
                        processed_regions, coords, image.shape
                    )
                else:
                    # Process normally for smaller images
                    result = effect_instance.apply(image, **kwargs)
            
            processing_time = time.time() - start_time
            self.effect_timings[effect_name].append(processing_time)
            
            # Manage GPU memory after heavy effects
            if effect_name in ['popart', 'retro8bit'] and self.gpu_enabled:
                self._manage_gpu_memory()
            
            logger.info(f"Effect '{effect_name}' processed in {processing_time:.3f}s")
            return result
            
        except Exception as e:
            logger.error(f"Failed to process effect '{effect_name}': {e}")
            raise
    
    async def process_multiple_effects_async(
        self,
        image: np.ndarray,
        effect_names: List[str],
        parallel_effects: int = 3,
        **kwargs
    ) -> Dict[str, np.ndarray]:
        """
        Process multiple effects asynchronously in parallel batches
        """
        results = {}
        total_start_time = time.time()
        
        logger.info(f"Processing {len(effect_names)} effects in parallel batches of {parallel_effects}")
        
        # Process in batches
        for i in range(0, len(effect_names), parallel_effects):
            batch = effect_names[i:i + parallel_effects]
            batch_start = time.time()
            
            # Create tasks for batch
            loop = asyncio.get_event_loop()
            tasks = []
            
            for effect_name in batch:
                task = loop.run_in_executor(
                    self.executor,
                    self.process_single_effect_parallel,
                    image,
                    effect_name,
                    1,  # Don't use region parallelism when doing effect parallelism
                    **kwargs.get(effect_name, {})
                )
                tasks.append((effect_name, task))
            
            # Wait for batch to complete
            for effect_name, task in tasks:
                try:
                    result = await task
                    results[effect_name] = result
                except Exception as e:
                    logger.error(f"Failed to process effect '{effect_name}': {e}")
                    results[effect_name] = None
            
            batch_time = time.time() - batch_start
            logger.info(f"Batch {i//parallel_effects + 1} completed in {batch_time:.3f}s")
            
            # Clear GPU memory between batches
            if i + parallel_effects < len(effect_names):
                self._manage_gpu_memory()
        
        total_time = time.time() - total_start_time
        logger.info(f"Processed {len(effect_names)} effects in {total_time:.3f}s total")
        
        return results
    
    def get_effect_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for effects"""
        stats = {}
        
        for effect_name, timings in self.effect_timings.items():
            if timings:
                stats[effect_name] = {
                    'avg_time': sum(timings) / len(timings),
                    'min_time': min(timings),
                    'max_time': max(timings),
                    'total_runs': len(timings)
                }
        
        stats['gpu_memory_clears'] = self.gpu_memory_clears
        stats['gpu_enabled'] = self.gpu_enabled
        
        return stats
    
    def optimize_for_batch_processing(self, batch_size: int):
        """Optimize settings for batch processing"""
        if batch_size > 10:
            # For large batches, be more aggressive with memory management
            self.enable_gpu_memory_management = True
            logger.info(f"Optimized for batch size {batch_size}: GPU memory management enabled")
        
        # Adjust thread pool size
        optimal_workers = min(batch_size, 8)
        if self.executor._max_workers != optimal_workers:
            self.executor.shutdown(wait=False)
            self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=optimal_workers)
            logger.info(f"Adjusted thread pool to {optimal_workers} workers")
    
    def get_available_effects(self) -> List[str]:
        """Get list of available effects"""
        available = []
        
        for effect_name in self.SUPPORTED_EFFECTS.keys():
            if effect_name == 'color':
                available.append(effect_name)
            elif effect_name in self.effects and self.effects[effect_name] is not None:
                available.append(effect_name)
                
        return available
    
    def get_effect_info(self, effect_name: str) -> Dict[str, Any]:
        """Get information about a specific effect with performance data"""
        if effect_name not in self.SUPPORTED_EFFECTS:
            raise ValueError(f"Unknown effect: {effect_name}")
        
        base_info = {
            'name': effect_name,
            'description': self.SUPPORTED_EFFECTS[effect_name],
            'implemented': effect_name in self.effects and self.effects[effect_name] is not None
        }
        
        # Add performance data if available
        if effect_name in self.effect_timings and self.effect_timings[effect_name]:
            timings = self.effect_timings[effect_name]
            base_info['performance'] = {
                'avg_processing_time': sum(timings) / len(timings),
                'runs': len(timings)
            }
        
        if effect_name != 'color' and base_info['implemented']:
            effect_instance = self.effects[effect_name]
            base_info.update(effect_instance.get_effect_info())
        
        return base_info
    
    def __del__(self):
        """Cleanup resources"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)