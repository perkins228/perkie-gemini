"""
Pop Art Effect
Port of exact Canvas algorithm with all preprocessing steps
"""

import numpy as np
import cv2
from typing import Dict, Any
from .base_effect import BaseEffect
import logging

logger = logging.getLogger(__name__)

class PopArtEffect(BaseEffect):
    """8-color pop art in Andy Warhol style - exact Canvas port with preprocessing"""
    
    def __init__(self, gpu_enabled: bool = True):
        super().__init__(gpu_enabled)
        
        # Pop Art configuration from Canvas test.html:1439 (exact values)
        self.COLOR_LEVELS = 3          # Fewer levels for more dramatic posterization
        self.CONTRAST_BOOST = 2.5      # Much higher contrast
        self.SATURATION_BOOST = 2.0    # Maximum saturation boost
        self.EDGE_ENHANCEMENT = 0.5    # Stronger edge definition
        
        # 8-color vibrant palette (exact Canvas)
        self.pop_colors = np.array([
            [255, 20, 147],   # Hot Pink/Magenta
            [0, 255, 127],    # Spring Green  
            [255, 165, 0],    # Orange
            [138, 43, 226],   # Blue Violet
            [255, 255, 0],    # Yellow
            [0, 191, 255],    # Deep Sky Blue
            [255, 69, 0],     # Red Orange
            [50, 205, 50],    # Lime Green
        ], dtype=np.uint8)
        
        logger.info("PopArt effect initialized with exact Canvas preprocessing")
        
    def apply(self, image: np.ndarray, quality: str = 'standard', **kwargs) -> np.ndarray:
        """
        Apply exact Canvas pop art algorithm with all preprocessing steps
        Ports exact Canvas algorithm from test.html:1439-1531
        """
        logger.info(f"Applying Canvas-exact PopArt effect")
        
        # Extract alpha channel if present
        rgb_image, alpha_channel = self.extract_alpha_channel(image)
        
        # Preprocess
        processed_image = self.preprocess_image(rgb_image)
        
        # Apply exact Canvas pop art pipeline
        result = self.create_pop_art_effect(processed_image)
        
        # Restore alpha channel
        result = self.postprocess_image(result, alpha_channel)
        
        logger.info("Canvas-exact PopArt effect applied successfully")
        return result
    
    def create_pop_art_effect(self, image: np.ndarray) -> np.ndarray:
        """
        Exact port of createPopArtEffect from Canvas test.html:1439
        """
        # Convert BGR to RGB for processing (Canvas uses RGB)
        data = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        height, width = data.shape[:2]
        
        output = np.zeros_like(data, dtype=np.uint8)
        
        # First pass: Apply contrast and saturation boost (MISSING in my original!)
        logger.debug("🔄 Applying contrast and saturation boost...")
        enhanced_data = self.apply_contrast_saturation_boost(data)
        
        # Second pass: Posterize and apply pop art color mapping
        logger.debug("🔄 Posterizing and applying color mapping...")
        for i in range(height):
            for j in range(width):
                alpha = enhanced_data[i, j, 3] if enhanced_data.shape[2] == 4 else 255
                
                if alpha == 0:
                    # Keep transparent
                    output[i, j] = [0, 0, 0]
                else:
                    r = enhanced_data[i, j, 0]
                    g = enhanced_data[i, j, 1] 
                    b = enhanced_data[i, j, 2]
                    
                    # Posterize colors to limited palette (MISSING in my original!)
                    step = 255 / (self.COLOR_LEVELS - 1)
                    r = round(r / step) * step
                    g = round(g / step) * step
                    b = round(b / step) * step
                    
                    # Apply pop art color mapping for extra punch
                    pop_colors = self.apply_pop_art_color_mapping(r, g, b)
                    
                    output[i, j, 0] = pop_colors['r']
                    output[i, j, 1] = pop_colors['g'] 
                    output[i, j, 2] = pop_colors['b']
        
        # Convert back to BGR
        result_bgr = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
        return result_bgr
    
    def apply_contrast_saturation_boost(self, data: np.ndarray) -> np.ndarray:
        """
        Apply contrast and saturation boost - exact Canvas preprocessing
        From test.html:1456 (CRITICAL MISSING STEP!)
        """
        enhanced_data = np.zeros_like(data, dtype=np.uint8)
        
        for i in range(data.shape[0]):
            for j in range(data.shape[1]):
                alpha = data[i, j, 3] if data.shape[2] == 4 else 255
                
                if alpha == 0:
                    # Keep transparent
                    enhanced_data[i, j] = [0, 0, 0, 0] if data.shape[2] == 4 else [0, 0, 0]
                else:
                    r = data[i, j, 0]
                    g = data[i, j, 1]
                    b = data[i, j, 2]
                    
                    # Optimized contrast boost (exact Canvas formula)
                    contrast_r = (r - 128) * self.CONTRAST_BOOST + 128
                    contrast_g = (g - 128) * self.CONTRAST_BOOST + 128
                    contrast_b = (b - 128) * self.CONTRAST_BOOST + 128
                    r = max(0, min(255, contrast_r))
                    g = max(0, min(255, contrast_g))
                    b = max(0, min(255, contrast_b))
                    
                    # Optimized saturation boost (exact Canvas formula)
                    lum = 0.299 * r + 0.587 * g + 0.114 * b
                    sat_r = lum + (r - lum) * self.SATURATION_BOOST
                    sat_g = lum + (g - lum) * self.SATURATION_BOOST
                    sat_b = lum + (b - lum) * self.SATURATION_BOOST
                    r = max(0, min(255, sat_r))
                    g = max(0, min(255, sat_g))
                    b = max(0, min(255, sat_b))
                    
                    enhanced_data[i, j, 0] = int(r)
                    enhanced_data[i, j, 1] = int(g)
                    enhanced_data[i, j, 2] = int(b)
                    if data.shape[2] == 4:
                        enhanced_data[i, j, 3] = alpha
        
        return enhanced_data
    
    def apply_pop_art_color_mapping(self, r: float, g: float, b: float) -> Dict[str, int]:
        """
        Apply 8-color pop art palette mapping - exact Canvas function
        From test.html:1570 (unchanged, this part was correct)
        """
        # ITU-R BT.709 luminance calculation (exact Canvas)
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        
        # Preserve very dark areas as black for definition (exact Canvas)
        if luminance < 40:
            return {'r': 0, 'g': 0, 'b': 0}
        
        # Fast range detection using optimized conditionals (exact Canvas)
        if luminance <= 70:
            target_color = self.pop_colors[3]  # Blue Violet
        elif luminance <= 100:
            target_color = self.pop_colors[5]  # Deep Sky Blue
        elif luminance <= 130:
            target_color = self.pop_colors[0]  # Hot Pink
        elif luminance <= 160:
            target_color = self.pop_colors[7]  # Lime Green
        elif luminance <= 190:
            target_color = self.pop_colors[1]  # Spring Green
        elif luminance <= 210:
            target_color = self.pop_colors[7]  # Lime Green (repeated)
        elif luminance <= 240:
            target_color = self.pop_colors[0]  # Hot Pink (repeated)
        else:
            target_color = self.pop_colors[5]  # Deep Sky Blue (repeated)
        
        # Hue-based variation for highly saturated colors (exact Canvas)
        max_channel = max(r, g, b)
        colorfulness = max_channel - min(r, g, b)
        
        # Only override for highly saturated colors (exact Canvas)
        if colorfulness > 60:
            if r == max_channel and r > g + 30 and r > b + 30:
                # Very red areas -> prefer red-orange or hot pink
                red_options = [self.pop_colors[0], self.pop_colors[6]]  # Hot Pink, Red Orange
                target_color = red_options[int((r + g + b) % 2)]
            elif g == max_channel and g > r + 30 and g > b + 30:
                # Very green areas -> prefer green options  
                green_options = [self.pop_colors[1], self.pop_colors[7]]  # Spring Green, Lime Green
                target_color = green_options[int((r + g + b) % 2)]
            elif b == max_channel and b > r + 30 and b > g + 30:
                # Very blue areas -> prefer blue options
                blue_options = [self.pop_colors[3], self.pop_colors[5]]  # Blue Violet, Deep Sky Blue
                target_color = blue_options[int((r + g + b) % 2)]
        
        return {
            'r': int(target_color[0]),
            'g': int(target_color[1]), 
            'b': int(target_color[2])
        }
    
    def get_effect_info(self) -> Dict[str, Any]:
        """Get information about this effect"""
        info = super().get_effect_info()
        info.update({
            'description': 'Bold pop art effect with high contrast, vibrant colors, and posterization in Andy Warhol style',
            'algorithm_source': 'Canvas test.html:1439-1531 (exact port with preprocessing)',
            'features': [
                'Contrast boost (2.5x)',
                'Saturation boost (2.0x)', 
                'Color posterization (3 levels)',
                '8-color vibrant palette',
                'ITU-R BT.709 luminance calculation',
                'Pet-optimized color ranges',
                'Hue-based variation for saturated colors'
            ],
            'preprocessing_values': {
                'contrast_boost': self.CONTRAST_BOOST,
                'saturation_boost': self.SATURATION_BOOST,
                'color_levels': self.COLOR_LEVELS,
                'edge_enhancement': self.EDGE_ENHANCEMENT
            },
            'palette_colors': [
                'Hot Pink/Magenta', 'Spring Green', 'Orange', 'Blue Violet',
                'Yellow', 'Deep Sky Blue', 'Red Orange', 'Lime Green'
            ]
        })
        return info 