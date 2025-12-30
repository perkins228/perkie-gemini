"""
Effects Module for BiRefNet Background Removal API

Available effects:
- blackwhite: Enhanced Black & White (GPU-accelerated pipeline)
- (more effects can be added here)

Pipeline Evolution:
1. blackwhite_trix: Original Tri-X film simulation (slow, high quality)
2. enhanced_blackwhite: CPU-optimized version (60% faster, Phase 1)
3. enhanced_blackwhite_gpu: GPU-accelerated (70-80% faster than CPU)

Default: GPU-accelerated version with automatic CPU fallback
"""

# GPU-accelerated Enhanced B&W (default, 70-80% faster)
from .enhanced_blackwhite_gpu import (
    EnhancedBlackWhitePipelineGPU,
    apply_enhanced_blackwhite_gpu,
    get_gpu_processor
)

# CPU-optimized Enhanced B&W (fallback)
from .enhanced_blackwhite import EnhancedBlackWhitePipeline, apply_enhanced_blackwhite

# Keep Tri-X available for comparison
from .blackwhite_trix import TriXPipeline, apply_blackwhite_effect as apply_trix_effect

# Default to GPU-accelerated version (automatic CPU fallback if GPU unavailable)
apply_blackwhite_effect = apply_enhanced_blackwhite_gpu

__all__ = [
    # GPU-accelerated (default)
    'EnhancedBlackWhitePipelineGPU',
    'apply_enhanced_blackwhite_gpu',
    'get_gpu_processor',
    # CPU-optimized (fallback)
    'EnhancedBlackWhitePipeline',
    'apply_enhanced_blackwhite',
    # Default function (points to GPU version)
    'apply_blackwhite_effect',
    # Original Tri-X (for comparison)
    'TriXPipeline',
    'apply_trix_effect',
]
