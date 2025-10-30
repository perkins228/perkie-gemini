"""
Effects Processing Package
Advanced image effects for background-removed pet images
"""

from .effects_processor import EffectsProcessor
from .base_effect import BaseEffect
from .enhanced_blackwhite_effect import EnhancedBlackWhiteEffect
from .optimized_popart_effect import OptimizedPopArtEffect
from .dithering_effect import DitheringEffect
from .pet_optimized_eightbit_effect import PetOptimizedEightBitEffect

__all__ = [
    "EffectsProcessor",
    "BaseEffect",
    "EnhancedBlackWhiteEffect",
    "OptimizedPopArtEffect", 
    "DitheringEffect",
    "PetOptimizedEightBitEffect"
]