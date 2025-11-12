"""
Memory-optimized processor for mobile images
Handles large images with multiple effects without running out of memory
"""

import gc
import torch
from PIL import Image
import numpy as np
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

class MemoryOptimizedProcessor:
    @staticmethod
    def optimize_image_for_processing(image: Image.Image, max_size: int = 2048) -> Image.Image:
        """
        Optimize image size for processing while maintaining aspect ratio
        Mobile images can be very large (4000x3000+)
        """
        width, height = image.size
        
        # Calculate scaling factor
        if width > max_size or height > max_size:
            scale = min(max_size / width, max_size / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            logger.info(f"Resizing image from {width}x{height} to {new_width}x{new_height}")
            
            # Use LANCZOS for high-quality downsampling
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Force garbage collection after resize
            gc.collect()
            
        return image
    
    @staticmethod
    def clear_gpu_memory():
        """Clear GPU memory cache"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
            gc.collect()
    
    @staticmethod
    def process_image_in_chunks(image_array: np.ndarray, process_func, chunk_size: int = 1024):
        """
        Process large images in chunks to avoid memory overflow
        """
        height, width = image_array.shape[:2]
        result = np.zeros_like(image_array)
        
        for y in range(0, height, chunk_size):
            for x in range(0, width, chunk_size):
                y_end = min(y + chunk_size, height)
                x_end = min(x + chunk_size, width)
                
                # Process chunk
                chunk = image_array[y:y_end, x:x_end]
                processed_chunk = process_func(chunk)
                result[y:y_end, x:x_end] = processed_chunk
                
                # Clear memory after each chunk
                del chunk, processed_chunk
                gc.collect()
        
        return result
    
    @staticmethod
    def save_image_optimized(image: Image.Image, format: str = 'PNG', quality: int = 95) -> bytes:
        """
        Save image with memory optimization
        """
        buffer = BytesIO()
        
        # For PNG, use compression level to reduce memory usage
        if format.upper() == 'PNG':
            image.save(buffer, format='PNG', compress_level=6, optimize=True)
        elif format.upper() in ['JPEG', 'JPG']:
            # Convert RGBA to RGB for JPEG
            if image.mode == 'RGBA':
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                rgb_image.paste(image, mask=image.split()[3])
                image = rgb_image
            image.save(buffer, format='JPEG', quality=quality, optimize=True)
        else:
            image.save(buffer, format=format)
        
        result = buffer.getvalue()
        buffer.close()
        
        # Force garbage collection
        gc.collect()
        
        return result
    
    @staticmethod
    def process_with_memory_limit(func, *args, **kwargs):
        """
        Process with memory monitoring and cleanup
        """
        # Clear memory before processing
        gc.collect()
        MemoryOptimizedProcessor.clear_gpu_memory()
        
        try:
            # Run the processing function
            result = func(*args, **kwargs)
            
            # Clear memory after processing
            gc.collect()
            MemoryOptimizedProcessor.clear_gpu_memory()
            
            return result
            
        except Exception as e:
            # Emergency memory cleanup
            gc.collect()
            MemoryOptimizedProcessor.clear_gpu_memory()
            raise e