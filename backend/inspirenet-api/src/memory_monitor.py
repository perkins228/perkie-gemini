"""
Memory monitoring and management for GPU/CPU resources
"""

import os
import gc
import time
import psutil
import logging
import torch
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class MemoryMonitor:
    """Monitor and manage memory usage to prevent OOM crashes"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.memory_threshold = float(os.getenv("MEMORY_THRESHOLD_CPU", "0.75"))  # Default 75%
        self.gpu_memory_threshold = float(os.getenv("MEMORY_THRESHOLD_GPU", "0.80"))  # Default 80%
        self.last_cleanup = time.time()
        self.cleanup_interval = int(os.getenv("MEMORY_CLEANUP_INTERVAL", "30"))  # Default 30 seconds
        
    def get_memory_info(self) -> Dict[str, float]:
        """Get current memory usage statistics"""
        info = {
            'cpu_memory_percent': self.process.memory_percent(),
            'cpu_memory_mb': self.process.memory_info().rss / 1024 / 1024,
            'available_memory_mb': psutil.virtual_memory().available / 1024 / 1024,
            'total_memory_mb': psutil.virtual_memory().total / 1024 / 1024,
        }
        
        if torch.cuda.is_available():
            info['gpu_memory_allocated_mb'] = torch.cuda.memory_allocated() / 1024 / 1024
            info['gpu_memory_reserved_mb'] = torch.cuda.memory_reserved() / 1024 / 1024
            info['gpu_memory_percent'] = torch.cuda.memory_allocated() / torch.cuda.get_device_properties(0).total_memory
        
        return info
    
    def check_memory_pressure(self) -> bool:
        """Check if system is under memory pressure"""
        memory_info = self.get_memory_info()
        
        # Check CPU memory
        cpu_memory_ratio = memory_info['cpu_memory_mb'] / memory_info['total_memory_mb']
        if cpu_memory_ratio > self.memory_threshold:
            logger.warning(f"High CPU memory usage: {cpu_memory_ratio:.1%}")
            return True
        
        # Check GPU memory if available
        if 'gpu_memory_percent' in memory_info:
            if memory_info['gpu_memory_percent'] > self.gpu_memory_threshold:
                logger.warning(f"High GPU memory usage: {memory_info['gpu_memory_percent']:.1%}")
                return True
        
        return False
    
    def force_cleanup(self) -> None:
        """Force memory cleanup"""
        logger.info("Forcing memory cleanup...")
        
        # Python garbage collection
        gc.collect()
        gc.collect()  # Run twice to catch circular references
        
        # Clear GPU cache
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
        
        # Log memory after cleanup
        memory_info = self.get_memory_info()
        logger.info(f"Memory after cleanup: CPU={memory_info['cpu_memory_mb']:.0f}MB, "
                   f"Available={memory_info['available_memory_mb']:.0f}MB")
        
        if 'gpu_memory_allocated_mb' in memory_info:
            logger.info(f"GPU memory after cleanup: Allocated={memory_info['gpu_memory_allocated_mb']:.0f}MB, "
                       f"Reserved={memory_info['gpu_memory_reserved_mb']:.0f}MB")
        
        self.last_cleanup = time.time()
    
    def should_cleanup(self) -> bool:
        """Check if cleanup should be performed"""
        # Force cleanup if interval exceeded
        if time.time() - self.last_cleanup > self.cleanup_interval:
            return True
        
        # Force cleanup if under memory pressure
        return self.check_memory_pressure()
    
    def log_memory_status(self) -> None:
        """Log current memory status"""
        memory_info = self.get_memory_info()
        logger.info(f"Memory status: CPU={memory_info['cpu_memory_mb']:.0f}MB ({memory_info['cpu_memory_percent']:.1f}%), "
                   f"Available={memory_info['available_memory_mb']:.0f}MB")
        
        if 'gpu_memory_allocated_mb' in memory_info:
            logger.info(f"GPU memory: Allocated={memory_info['gpu_memory_allocated_mb']:.0f}MB, "
                       f"Usage={memory_info['gpu_memory_percent']:.1%}")

# Global memory monitor instance
memory_monitor = MemoryMonitor()