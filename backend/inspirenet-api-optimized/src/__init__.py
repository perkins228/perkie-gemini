"""
InSPyReNet Background Removal API - Source Package
Production-ready pet background removal with effects processing
"""

__version__ = "2.0.0"
__author__ = "Perkie Prints"
__description__ = "InSPyReNet Background Removal API with Effects Processing"

# Package-level imports for easier access
from .integrated_processor import IntegratedProcessor
from .memory_efficient_integrated_processor import MemoryEfficientIntegratedProcessor
from .inspirenet_model import InSPyReNetProcessor
# Note: storage.py is at the same level, but main.py uses absolute import
# Keeping consistent with main.py's import pattern
try:
    from storage import CloudStorageManager
except ImportError:
    # Fallback to relative import if needed
    from .storage import CloudStorageManager

__all__ = [
    "IntegratedProcessor",
    "MemoryEfficientIntegratedProcessor", 
    "InSPyReNetProcessor",
    "CloudStorageManager"
]