"""
Effects Module for BiRefNet Background Removal API

Available effects:
- blackwhite: Enhanced Black & White (Tri-X film simulation)
- (more effects can be added here)
"""

from .blackwhite_trix import TriXPipeline, apply_blackwhite_effect

__all__ = [
    'TriXPipeline',
    'apply_blackwhite_effect'
]
