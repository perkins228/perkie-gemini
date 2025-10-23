"""
Cloud Storage Manager for caching processed images
"""

import asyncio
import logging
import time
from typing import Optional, Dict, Any
import os
from io import BytesIO

try:
    from google.cloud import storage
    from google.api_core import exceptions as gcs_exceptions
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False
    storage = None
    gcs_exceptions = None

logger = logging.getLogger(__name__)


class CloudStorageManager:
    """Manages caching of processed images in Google Cloud Storage"""
    
    def __init__(self, bucket_name: str, cache_ttl: int = 86400):
        """
        Initialize storage manager
        
        Args:
            bucket_name: GCS bucket name for caching
            cache_ttl: Cache TTL in seconds (default 24 hours)
        """
        self.bucket_name = bucket_name
        self.cache_ttl = cache_ttl
        self.client = None
        self.bucket = None
        self.enabled = GOOGLE_CLOUD_AVAILABLE
        
        if not self.enabled:
            logger.warning("Google Cloud Storage not available. Caching disabled.")
            return
        
        try:
            self._initialize_client()
        except Exception as e:
            logger.error(f"Failed to initialize Google Cloud Storage: {e}")
            self.enabled = False
    
    def _initialize_client(self):
        """Initialize Google Cloud Storage client"""
        if not GOOGLE_CLOUD_AVAILABLE:
            return
            
        try:
            self.client = storage.Client()
            self.bucket = self.client.bucket(self.bucket_name)
            
            # Test bucket access
            if not self.bucket.exists():
                logger.warning(f"Bucket {self.bucket_name} does not exist")
                self.enabled = False
            else:
                logger.info(f"Connected to GCS bucket: {self.bucket_name}")
                
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
            self.enabled = False
    
    def _get_blob_name(self, cache_key: str) -> str:
        """Generate blob name from cache key"""
        # Validate cache key is a proper string hash
        if not isinstance(cache_key, str):
            raise TypeError(f"cache_key must be a string, not {type(cache_key).__name__}")
        if len(cache_key) < 2:
            raise ValueError(f"cache_key too short: {cache_key}")
        return f"inspirenet-cache/{cache_key[:2]}/{cache_key}.png"
    
    async def get_cached_result(self, cache_key: str) -> Optional[bytes]:
        """
        Get cached result from storage
        
        Args:
            cache_key: Cache key for the image
            
        Returns:
            Cached image bytes or None if not found
        """
        if not self.enabled:
            return None
            
        try:
            blob_name = self._get_blob_name(cache_key)
            blob = self.bucket.blob(blob_name)
            
            # Check if blob exists and is not expired
            if not blob.exists():
                return None
            
            # Check TTL
            if blob.time_created:
                age = time.time() - blob.time_created.timestamp()
                if age > self.cache_ttl:
                    # Delete expired blob asynchronously
                    asyncio.create_task(self._delete_blob_async(blob_name))
                    return None
            
            # Download blob content
            loop = asyncio.get_event_loop()
            content = await loop.run_in_executor(None, blob.download_as_bytes)
            
            logger.debug(f"Cache hit for key: {cache_key}")
            return content
            
        except gcs_exceptions.NotFound:
            return None
        except Exception as e:
            logger.error(f"Error retrieving cached result: {e}")
            return None
    
    async def cache_result(self, cache_key: str, image_data: bytes) -> bool:
        """
        Cache processed image result
        
        Args:
            cache_key: Cache key for the image
            image_data: Processed image bytes
            
        Returns:
            True if successfully cached, False otherwise
        """
        # Type validation to prevent critical parameter type errors (ALWAYS validate, even when disabled)
        if not isinstance(cache_key, str):
            logger.error(f"Invalid cache_key type: expected str, got {type(cache_key)}")
            raise TypeError(f"cache_key must be string, got {type(cache_key)}")
        
        if not isinstance(image_data, bytes):
            logger.error(f"Invalid image_data type: expected bytes, got {type(image_data)}")
            raise TypeError(f"image_data must be bytes, got {type(image_data)}")
        
        # Validate cache key format
        if len(cache_key) < 10 or len(cache_key) > 250:
            logger.error(f"Invalid cache_key length: {len(cache_key)}")
            raise ValueError(f"cache_key length must be between 10-250 characters, got {len(cache_key)}")
        
        if not self.enabled:
            return False
            
        try:
            blob_name = self._get_blob_name(cache_key)
            blob = self.bucket.blob(blob_name)
            
            # Set metadata
            blob.metadata = {
                "cache_key": cache_key,
                "model": "inspirenet",
                "created_at": str(int(time.time()))
            }
            
            # Set content type
            blob.content_type = "image/png"
            
            # Upload asynchronously
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: blob.upload_from_string(image_data, content_type="image/png")
            )
            
            logger.debug(f"Cached result for key: {cache_key}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching result: {e}")
            return False
    
    async def upload_processed_image(self, cache_key: str, image_data: bytes, effect: str = "processed") -> bool:
        """
        Upload processed image with effect-specific naming
        
        Args:
            cache_key: Cache key for the image
            image_data: Processed image bytes
            effect: Effect name for organizing storage
            
        Returns:
            True if successfully uploaded, False otherwise
        """
        # Type validation to prevent parameter mismatch errors
        if not isinstance(cache_key, str):
            logger.error(f"Invalid cache_key type: expected str, got {type(cache_key).__name__}. "
                        f"This is a critical error that indicates parameters are swapped.")
            raise TypeError(f"cache_key must be a string, not {type(cache_key).__name__}")
        
        if not isinstance(image_data, bytes):
            logger.error(f"Invalid image_data type: expected bytes, got {type(image_data).__name__}")
            raise TypeError(f"image_data must be bytes, not {type(image_data).__name__}")
        
        if not self.enabled:
            return False
            
        try:
            blob_name = f"inspirenet-cache/{effect}/{cache_key[:2]}/{cache_key}.png"
            blob = self.bucket.blob(blob_name)
            
            # Set metadata
            blob.metadata = {
                "cache_key": cache_key,
                "effect": effect,
                "model": "inspirenet",
                "created_at": str(int(time.time()))
            }
            
            # Set content type
            blob.content_type = "image/png"
            
            # Upload asynchronously
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: blob.upload_from_string(image_data, content_type="image/png")
            )
            
            logger.debug(f"Uploaded processed image for key: {cache_key}, effect: {effect}")
            return True
            
        except Exception as e:
            logger.error(f"Error uploading processed image: {e}")
            return False
    
    async def _delete_blob_async(self, blob_name: str):
        """Delete blob asynchronously"""
        try:
            blob = self.bucket.blob(blob_name)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, blob.delete)
            logger.debug(f"Deleted expired blob: {blob_name}")
        except Exception as e:
            logger.error(f"Error deleting blob {blob_name}: {e}")
    
    async def cleanup_expired_cache(self) -> int:
        """
        Clean up expired cache entries
        
        Returns:
            Number of deleted entries
        """
        if not self.enabled:
            return 0
            
        try:
            deleted_count = 0
            current_time = time.time()
            
            # List all blobs in cache directory
            blobs = self.client.list_blobs(
                self.bucket_name,
                prefix="inspirenet-cache/",
                max_results=1000
            )
            
            for blob in blobs:
                if blob.time_created:
                    age = current_time - blob.time_created.timestamp()
                    if age > self.cache_ttl:
                        await self._delete_blob_async(blob.name)
                        deleted_count += 1
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired cache entries")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}")
            return 0
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache statistics
        """
        if not self.enabled:
            return {
                "enabled": False,
                "total_entries": 0,
                "total_size_mb": 0
            }
        
        try:
            total_entries = 0
            total_size = 0
            expired_entries = 0
            current_time = time.time()
            
            # List all blobs in cache directory
            blobs = self.client.list_blobs(
                self.bucket_name,
                prefix="inspirenet-cache/"
            )
            
            for blob in blobs:
                total_entries += 1
                if blob.size:
                    total_size += blob.size
                
                if blob.time_created:
                    age = current_time - blob.time_created.timestamp()
                    if age > self.cache_ttl:
                        expired_entries += 1
            
            return {
                "enabled": True,
                "bucket_name": self.bucket_name,
                "total_entries": total_entries,
                "total_size_mb": total_size / (1024 * 1024),
                "expired_entries": expired_entries,
                "cache_ttl_hours": self.cache_ttl / 3600
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {
                "enabled": True,
                "error": str(e)
            }


class LocalCacheManager:
    """Local file-based cache manager for development/testing"""
    
    def __init__(self, cache_dir: str = "/tmp/inspirenet-cache", cache_ttl: int = 86400):
        self.cache_dir = cache_dir
        self.cache_ttl = cache_ttl
        
        # Create cache directory
        os.makedirs(cache_dir, exist_ok=True)
        logger.info(f"Using local cache directory: {cache_dir}")
    
    def _get_cache_path(self, cache_key: str) -> str:
        """Get local cache file path"""
        return os.path.join(self.cache_dir, f"{cache_key}.png")
    
    async def get_cached_result(self, cache_key: str) -> Optional[bytes]:
        """Get cached result from local storage"""
        try:
            cache_path = self._get_cache_path(cache_key)
            
            if not os.path.exists(cache_path):
                return None
            
            # Check TTL
            age = time.time() - os.path.getmtime(cache_path)
            if age > self.cache_ttl:
                os.remove(cache_path)
                return None
            
            with open(cache_path, 'rb') as f:
                return f.read()
                
        except Exception as e:
            logger.error(f"Error retrieving cached result: {e}")
            return None
    
    async def cache_result(self, cache_key: str, image_data: bytes) -> bool:
        """Cache result to local storage"""
        # Type validation to prevent critical parameter type errors
        if not isinstance(cache_key, str):
            logger.error(f"Invalid cache_key type: expected str, got {type(cache_key)}")
            raise TypeError(f"cache_key must be string, got {type(cache_key)}")
        
        if not isinstance(image_data, bytes):
            logger.error(f"Invalid image_data type: expected bytes, got {type(image_data)}")
            raise TypeError(f"image_data must be bytes, got {type(image_data)}")
        
        try:
            cache_path = self._get_cache_path(cache_key)
            
            with open(cache_path, 'wb') as f:
                f.write(image_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Error caching result: {e}")
            return False
    
    async def cleanup_expired_cache(self) -> int:
        """Clean up expired local cache entries"""
        try:
            deleted_count = 0
            current_time = time.time()
            
            for filename in os.listdir(self.cache_dir):
                if filename.endswith('.png'):
                    filepath = os.path.join(self.cache_dir, filename)
                    age = current_time - os.path.getmtime(filepath)
                    
                    if age > self.cache_ttl:
                        os.remove(filepath)
                        deleted_count += 1
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired local cache entries")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error during local cache cleanup: {e}")
            return 0 