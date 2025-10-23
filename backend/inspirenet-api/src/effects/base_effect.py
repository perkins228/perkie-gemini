"""
Base Effect Class
Provides consistent interface for all visual effects
"""

import numpy as np
from PIL import Image
from typing import Dict, Any
import torch
import cv2
import logging

logger = logging.getLogger(__name__)

class BaseEffect:
    """Base class for all effects - ensures consistent interface"""
    
    def __init__(self, gpu_enabled: bool = True):
        """Initialize effect with GPU capability"""
        self.gpu_enabled = gpu_enabled and torch.cuda.is_available()
        self.device = torch.device('cuda' if self.gpu_enabled else 'cpu')
        
        logger.info(f"Initialized {self.__class__.__name__} with device: {self.device}")
    
    def apply(self, image: np.ndarray, **kwargs) -> np.ndarray:
        """
        Apply effect to image - must be implemented by subclasses
        
        Args:
            image: Input image as numpy array (H, W, C) in BGR format
            **kwargs: Effect-specific parameters
            
        Returns:
            Processed image as numpy array (H, W, C) in BGR format
        """
        raise NotImplementedError(f"Effect {self.__class__.__name__} must implement apply() method")
    
    def get_quality_settings(self, quality: str = 'standard') -> Dict[str, Any]:
        """Get quality-specific settings for the effect"""
        settings = {
            'preview': {'scale': 0.5, 'quality': 70, 'iterations': 1},
            'standard': {'scale': 0.8, 'quality': 85, 'iterations': 2}, 
            'high': {'scale': 1.0, 'quality': 95, 'iterations': 3}
        }
        return settings.get(quality, settings['standard'])
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for effect application"""
        # Ensure image is in correct format (H, W, C) with values 0-255
        if image.dtype != np.uint8:
            image = np.clip(image, 0, 255).astype(np.uint8)
        
        # Handle different channel configurations
        if len(image.shape) == 2:
            # Grayscale to BGR
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        elif image.shape[2] == 4:
            # BGRA to BGR (remove alpha for processing)
            image = image[:, :, :3]
        
        return image
    
    def postprocess_image(self, image: np.ndarray, original_alpha: np.ndarray = None) -> np.ndarray:
        """Postprocess image after effect application"""
        # Ensure output is uint8
        if image.dtype != np.uint8:
            image = np.clip(image, 0, 255).astype(np.uint8)
        
        # Restore alpha channel if provided
        if original_alpha is not None:
            if len(image.shape) == 2:
                # Grayscale result
                image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            
            # Add alpha channel
            image = np.dstack([image, original_alpha])
        
        return image
    
    def extract_alpha_channel(self, image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Extract alpha channel from BGRA image"""
        if len(image.shape) == 3 and image.shape[2] == 4:
            rgb_image = image[:, :, :3]
            alpha_channel = image[:, :, 3]
            return rgb_image, alpha_channel
        else:
            return image, None
    
    def apply_edge_enhancement(self, image: np.ndarray, strength: float = 0.3) -> np.ndarray:
        """Apply edge enhancement using unsharp mask (common utility)"""
        # Convert to float for processing
        image_float = image.astype(np.float32)
        
        # Create Gaussian blur
        blurred = cv2.GaussianBlur(image_float, (0, 0), 1.0)
        
        # Unsharp mask
        enhanced = image_float + strength * (image_float - blurred)
        
        return np.clip(enhanced, 0, 255).astype(np.uint8)
    
    def create_edge_map(self, image: np.ndarray, threshold: float = 30.0) -> np.ndarray:
        """Create edge map for adaptive processing (common utility)"""
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Calculate gradients
        grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        
        # Magnitude
        magnitude = np.sqrt(grad_x**2 + grad_y**2)
        
        # Threshold
        edge_map = np.where(magnitude > threshold, magnitude, 0)
        
        return edge_map.astype(np.float32)
    
    def get_effect_info(self) -> Dict[str, Any]:
        """Get information about this effect"""
        return {
            'name': self.__class__.__name__.replace('Effect', '').lower(),
            'gpu_enabled': self.gpu_enabled,
            'device': str(self.device),
            'description': self.__doc__ or f"{self.__class__.__name__} visual effect"
        } 