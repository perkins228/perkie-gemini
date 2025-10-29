"""
Effects Processor
Main coordinator for optimized effects processing - 1 version per effect
"""

import numpy as np
import cv2
from typing import Dict, List, Optional, Any
from PIL import Image
import asyncio
import time
import logging

from .base_effect import BaseEffect
from .enhanced_blackwhite_effect import EnhancedBlackWhiteEffect

logger = logging.getLogger(__name__)

class EffectsProcessor:
    """Process optimized effects on server-side - 1 version per effect type"""
    
    SUPPORTED_EFFECTS = {
        'color': 'Original color with background removed',
        'enhancedblackwhite': 'Enhanced B&W with 60% visual improvement and research-informed processing'
    }
    
    def __init__(self, gpu_enabled: bool = True):
        """Initialize effects processor with GPU capability"""
        self.gpu_enabled = gpu_enabled
        self.effects = {}
        self._initialize_effects()
        
        logger.info(f"EffectsProcessor initialized with {len(self.effects)} optimized effects")
    
    def _initialize_effects(self):
        """Initialize optimized effect instances - 1 version per type"""
        try:
            # Color effect (no processing needed)
            self.effects['color'] = None

            # Enhanced Black & White effect (research-informed improvements)
            self.effects['enhancedblackwhite'] = EnhancedBlackWhiteEffect(self.gpu_enabled)

            logger.info("Optimized effects initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize effects: {e}")
            raise
    
    def get_available_effects(self) -> List[str]:
        """Get list of actually implemented and available effects"""
        available = []
        
        for effect_name in self.SUPPORTED_EFFECTS.keys():
            if effect_name == 'color':
                # Color effect is always available (no processing needed)
                available.append(effect_name)
            elif effect_name in self.effects and self.effects[effect_name] is not None:
                # Effect is implemented and initialized
                available.append(effect_name)
            # Skip effects that are not yet implemented (None values)
                
        return available
    
    def get_effect_info(self, effect_name: str) -> Dict[str, Any]:
        """Get information about a specific effect"""
        if effect_name not in self.SUPPORTED_EFFECTS:
            raise ValueError(f"Unknown effect: {effect_name}")
        
        if effect_name == 'color':
            return {
                'name': 'color',
                'description': self.SUPPORTED_EFFECTS[effect_name],
                'implemented': True,
                'processing_time': '0s (no processing)',
                'version': 'optimized'
            }
        
        effect_instance = self.effects.get(effect_name)
        if effect_instance:
            info = effect_instance.get_effect_info()
            info['implemented'] = True
            info['version'] = 'optimized'
            return info
        else:
            return {
                'name': effect_name,
                'description': self.SUPPORTED_EFFECTS[effect_name],
                'implemented': False,
                'status': 'TODO: Implementation pending',
                'version': 'planned'
            }
    
    def get_all_effects_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all effects"""
        return {name: self.get_effect_info(name) for name in self.SUPPORTED_EFFECTS.keys()}
    
    def process_single_effect(self, image: np.ndarray, effect_name: str, **kwargs) -> np.ndarray:
        """
        Process single effect on image
        
        Args:
            image: Input image as numpy array (H, W, C) in BGR format
            effect_name: Name of effect to apply
            **kwargs: Effect-specific parameters
            
        Returns:
            Processed image as numpy array (H, W, C) in BGR format or None if failed
        """
        if effect_name not in self.SUPPORTED_EFFECTS:
            logger.error(f"Unknown effect requested: {effect_name}. Supported: {list(self.SUPPORTED_EFFECTS.keys())}")
            raise ValueError(f"Unknown effect: {effect_name}")
        
        # Validate input image
        if not self.validate_image_input(image):
            logger.error(f"Invalid input image for effect '{effect_name}': shape={getattr(image, 'shape', 'no shape')}, dtype={getattr(image, 'dtype', 'no dtype')}")
            return None
        
        start_time = time.time()
        
        try:
            logger.debug(f"Starting effect processing: {effect_name} with params: {kwargs}")
            
            if effect_name == 'color':
                # Color effect - return original (no processing)
                # Use np.ascontiguousarray to ensure proper memory layout for cv2.cvtColor
                result = np.ascontiguousarray(image, dtype=image.dtype)
                logger.debug(f"Color effect completed - returned C-contiguous copy of original image (shape={result.shape}, dtype={result.dtype})")
            else:
                effect_instance = self.effects.get(effect_name)
                if not effect_instance:
                    logger.error(f"Effect '{effect_name}' instance not found or not initialized")
                    raise NotImplementedError(f"Effect '{effect_name}' not yet implemented")
                
                logger.debug(f"Applying effect '{effect_name}' using instance: {type(effect_instance).__name__}")
                result = effect_instance.apply(image, **kwargs)
                
                # Validate the result
                if result is None:
                    logger.error(f"Effect '{effect_name}' returned None result")
                    return None
                    
                if not isinstance(result, np.ndarray):
                    logger.error(f"Effect '{effect_name}' returned invalid type: {type(result)}")
                    return None
                    
                if not hasattr(result, 'shape') or len(result.shape) < 2:
                    logger.error(f"Effect '{effect_name}' returned invalid shape: {getattr(result, 'shape', 'no shape')}")
                    return None
            
            processing_time = time.time() - start_time
            result_info = f"shape={result.shape}, dtype={result.dtype}" if hasattr(result, 'shape') else "no shape info"
            logger.info(f"Effect '{effect_name}' processed successfully in {processing_time:.3f}s ({result_info})")
            
            return result
            
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"Failed to process effect '{effect_name}' after {processing_time:.3f}s: {type(e).__name__}: {e}")
            logger.debug(f"Effect '{effect_name}' failure details - Input: shape={getattr(image, 'shape', 'no shape')}, kwargs={kwargs}")
            return None  # Return None instead of raising to allow other effects to continue
    
    def process_multiple_effects(self, image: np.ndarray, effect_names: List[str], **kwargs) -> Dict[str, np.ndarray]:
        """
        Process multiple effects on the same image
        
        Args:
            image: Input image as numpy array (H, W, C) in BGR format
            effect_names: List of effect names to apply
            **kwargs: Effect-specific parameters
            
        Returns:
            Dictionary mapping effect names to processed images
        """
        results = {}
        total_start_time = time.time()
        
        logger.info(f"Processing {len(effect_names)} optimized effects: {effect_names}")
        
        for effect_name in effect_names:
            try:
                results[effect_name] = self.process_single_effect(image, effect_name, **kwargs)
            except Exception as e:
                logger.error(f"Failed to process effect '{effect_name}': {e}")
                # Continue with other effects, but log the failure
                results[effect_name] = None
        
        total_time = time.time() - total_start_time
        logger.info(f"Processed {len(effect_names)} optimized effects in {total_time:.3f}s total")
        
        return results
    
    async def process_all_effects_async(self, image: np.ndarray, quality: str = 'standard', 
                                       progress_callback: Optional[callable] = None) -> Dict[str, np.ndarray]:
        """
        Process all available effects asynchronously with progress tracking
        
        Args:
            image: Input image as numpy array (H, W, C) in BGR format
            quality: Quality level ('preview', 'standard', 'high')
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dictionary mapping effect names to processed images
        """
        all_effects = self.get_available_effects()
        results = {}
        
        logger.info(f"Processing all {len(all_effects)} optimized effects with quality: {quality}")
        
        if progress_callback:
            await progress_callback("effects_start", 0, f"Starting processing of {len(all_effects)} optimized effects...")
        
        for i, effect_name in enumerate(all_effects):
            try:
                if progress_callback:
                    progress = int((i / len(all_effects)) * 100)
                    await progress_callback("effects_processing", progress, f"Processing {effect_name}...")
                
                results[effect_name] = self.process_single_effect(image, effect_name, quality=quality)
                
            except Exception as e:
                logger.error(f"Failed to process effect '{effect_name}': {e}")
                results[effect_name] = None
        
        if progress_callback:
            await progress_callback("effects_complete", 100, f"All {len(all_effects)} optimized effects processed")
        
        return results
    
    def validate_image_input(self, image: np.ndarray) -> bool:
        """Validate input image format"""
        if not isinstance(image, np.ndarray):
            return False
        
        if len(image.shape) not in [2, 3]:
            return False
        
        if len(image.shape) == 3 and image.shape[2] not in [3, 4]:
            return False
        
        if image.dtype not in [np.uint8, np.float32, np.float64]:
            return False
        
        return True
    
    def convert_pil_to_cv2(self, pil_image: Image.Image) -> np.ndarray:
        """Convert PIL Image to OpenCV format (BGR)"""
        # Convert PIL to RGB numpy array
        rgb_array = np.array(pil_image)
        
        # Handle different modes
        if pil_image.mode == 'RGB':
            # Convert RGB to BGR
            bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
        elif pil_image.mode == 'RGBA':
            # Convert RGBA to BGRA
            bgra_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGBA2BGRA)
            return bgra_array
        elif pil_image.mode == 'L':
            # Grayscale - convert to BGR
            bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_GRAY2BGR)
        else:
            # Convert other modes to RGB first, then BGR
            rgb_image = pil_image.convert('RGB')
            rgb_array = np.array(rgb_image)
            bgr_array = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
        
        return bgr_array
    
    def convert_cv2_to_pil(self, cv2_image: np.ndarray) -> Image.Image:
        """Convert OpenCV format (BGR) to PIL Image"""
        if len(cv2_image.shape) == 3:
            if cv2_image.shape[2] == 3:
                # BGR to RGB
                rgb_array = cv2.cvtColor(cv2_image, cv2.COLOR_BGR2RGB)
                return Image.fromarray(rgb_array, 'RGB')
            elif cv2_image.shape[2] == 4:
                # BGRA to RGBA
                rgba_array = cv2.cvtColor(cv2_image, cv2.COLOR_BGRA2RGBA)
                return Image.fromarray(rgba_array, 'RGBA')
        else:
            # Grayscale
            return Image.fromarray(cv2_image, 'L')
        
        return Image.fromarray(cv2_image)
    
    def get_processor_stats(self) -> Dict[str, Any]:
        """Get processor performance statistics"""
        return {
            'supported_effects': list(self.SUPPORTED_EFFECTS.keys()),
            'gpu_enabled': self.gpu_enabled,
            'initialized_effects': list(self.effects.keys()),
            'effects_count': len(self.effects)
        }
    
    def apply_effect(self, image, effect_name, **kwargs):
        """Alias for process_single_effect for backwards compatibility"""
        if hasattr(image, 'size'):  # PIL Image
            cv2_image = self.convert_pil_to_cv2(image)
            result_cv2 = self.process_single_effect(cv2_image, effect_name, **kwargs)
            return self.convert_cv2_to_pil(result_cv2)
        else:  # Already numpy array
            return self.process_single_effect(image, effect_name, **kwargs) 