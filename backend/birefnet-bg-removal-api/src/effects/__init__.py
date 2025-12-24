"""
Effects Module for BiRefNet Background Removal API

Available effects:
- blackwhite: Enhanced Black & White (optimized pipeline)
- (more effects can be added here)

Note: Using enhanced_blackwhite (faster) instead of blackwhite_trix (slower).
The enhanced version is ~60% faster while maintaining professional film characteristics.
"""

# Use the faster enhanced B&W instead of Tri-X
from .enhanced_blackwhite import EnhancedBlackWhitePipeline, apply_enhanced_blackwhite

# Keep Tri-X available for comparison/fallback
from .blackwhite_trix import TriXPipeline, apply_blackwhite_effect as apply_trix_effect

# Default to faster enhanced version
apply_blackwhite_effect = apply_enhanced_blackwhite

__all__ = [
    'EnhancedBlackWhitePipeline',
    'apply_enhanced_blackwhite',
    'apply_blackwhite_effect',  # Points to enhanced version
    'TriXPipeline',
    'apply_trix_effect',  # Original Tri-X for comparison
]
