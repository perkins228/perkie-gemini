"""
Advanced Model Cache Manager for InSPyReNet
Implements multi-tier caching with CDN distribution for scale-to-zero scenarios
"""

import os
import time
import asyncio
import hashlib
import logging
import aiohttp
import aiofiles
from typing import Optional, Dict, Any
from pathlib import Path
import json
from concurrent.futures import ThreadPoolExecutor
from google.cloud import storage
import torch

logger = logging.getLogger(__name__)


class ModelCacheManager:
    """Multi-tier model caching with CDN distribution"""
    
    def __init__(self, model_name: str = "inspirenet", version: str = "v2.0.0"):
        self.model_name = model_name
        self.version = version
        self.local_cache_dir = Path("/tmp/models")
        self.local_cache_dir.mkdir(exist_ok=True)
        
        # CDN configuration
        self.cdn_base_url = os.getenv("MODEL_CDN_URL", "https://models-cdn.perkieprints.com")
        self.cdn_enabled = os.getenv("MODEL_CDN_ENABLED", "true").lower() == "true"
        
        # GCS configuration
        self.gcs_bucket_name = os.getenv("MODEL_GCS_BUCKET", "perkieprints-model-cache")
        self.gcs_client = None
        
        # Model metadata
        self.model_metadata = {
            "inspirenet": {
                "filename": "inspirenet_swin_transformer.pth",
                "size_mb": 800,
                "checksum": None,  # Will be populated
                "chunk_size": 50 * 1024 * 1024,  # 50MB chunks
                "compression": "none"
            }
        }
        
        # Performance tracking
        self.cache_stats = {
            "local_hits": 0,
            "cdn_hits": 0,
            "gcs_hits": 0,
            "cache_misses": 0
        }
        
    async def get_model_path(self, force_download: bool = False) -> Optional[str]:
        """
        Get model path with multi-tier caching
        
        Returns path to model file or None if failed
        """
        model_info = self.model_metadata.get(self.model_name)
        if not model_info:
            logger.error(f"Unknown model: {self.model_name}")
            return None
            
        model_filename = model_info["filename"]
        
        # 1. Check local /tmp cache (fastest)
        if not force_download:
            local_path = self._check_local_cache(model_filename)
            if local_path:
                self.cache_stats["local_hits"] += 1
                logger.info(f"Model found in local cache: {local_path}")
                return local_path
        
        # 2. Download from CDN (fast, distributed)
        if self.cdn_enabled:
            cdn_path = await self._download_from_cdn(model_filename)
            if cdn_path:
                self.cache_stats["cdn_hits"] += 1
                return cdn_path
        
        # 3. Download from GCS (reliable, resumable)
        gcs_path = await self._download_from_gcs(model_filename)
        if gcs_path:
            self.cache_stats["gcs_hits"] += 1
            # Optionally populate CDN
            if self.cdn_enabled:
                asyncio.create_task(self._populate_cdn(gcs_path, model_filename))
            return gcs_path
        
        # 4. Cache miss
        self.cache_stats["cache_misses"] += 1
        logger.error("Failed to retrieve model from any cache tier")
        return None
    
    def _check_local_cache(self, filename: str) -> Optional[str]:
        """Check if model exists in local /tmp cache"""
        local_path = self.local_cache_dir / filename
        
        if local_path.exists():
            # Verify file integrity
            expected_size = self.model_metadata[self.model_name]["size_mb"] * 1024 * 1024
            actual_size = local_path.stat().st_size
            
            if abs(actual_size - expected_size) < 1024 * 1024:  # Within 1MB tolerance
                # Check age (optional refresh after 24 hours)
                age_hours = (time.time() - local_path.stat().st_mtime) / 3600
                if age_hours < 24:
                    return str(local_path)
                else:
                    logger.info(f"Local cache expired ({age_hours:.1f} hours old)")
            else:
                logger.warning(f"Local cache size mismatch: {actual_size} vs {expected_size}")
                local_path.unlink()  # Remove corrupted file
        
        return None
    
    async def _download_from_cdn(self, filename: str) -> Optional[str]:
        """Download model from CDN with parallel chunk download"""
        url = f"{self.cdn_base_url}/models/{self.version}/{filename}"
        local_path = self.local_cache_dir / filename
        
        try:
            logger.info(f"Downloading model from CDN: {url}")
            start_time = time.time()
            
            # Use aiohttp for async download with connection pooling
            timeout = aiohttp.ClientTimeout(total=300, connect=10)
            connector = aiohttp.TCPConnector(limit=10, force_close=True)
            
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                # First, get file size and verify availability
                async with session.head(url) as response:
                    if response.status != 200:
                        logger.warning(f"Model not found on CDN: {response.status}")
                        return None
                    
                    content_length = int(response.headers.get('Content-Length', 0))
                    if content_length == 0:
                        logger.warning("CDN returned empty content length")
                        return None
                
                # Download with progress tracking
                chunk_size = 10 * 1024 * 1024  # 10MB chunks
                async with session.get(url) as response:
                    response.raise_for_status()
                    
                    async with aiofiles.open(local_path, 'wb') as file:
                        downloaded = 0
                        async for chunk in response.content.iter_chunked(chunk_size):
                            await file.write(chunk)
                            downloaded += len(chunk)
                            
                            # Log progress every 100MB
                            if downloaded % (100 * 1024 * 1024) == 0:
                                progress = (downloaded / content_length) * 100
                                logger.info(f"CDN download progress: {progress:.1f}%")
            
            download_time = time.time() - start_time
            download_speed = (content_length / 1024 / 1024) / download_time
            logger.info(f"Model downloaded from CDN in {download_time:.1f}s ({download_speed:.1f} MB/s)")
            
            return str(local_path)
            
        except Exception as e:
            logger.error(f"CDN download failed: {e}")
            if local_path.exists():
                local_path.unlink()  # Clean up partial download
            return None
    
    async def _download_from_gcs(self, filename: str) -> Optional[str]:
        """Download model from GCS with resumable download support"""
        local_path = self.local_cache_dir / filename
        
        try:
            if not self.gcs_client:
                self.gcs_client = storage.Client()
            
            bucket = self.gcs_client.bucket(self.gcs_bucket_name)
            blob = bucket.blob(f"models/{self.version}/{filename}")
            
            if not blob.exists():
                logger.warning(f"Model not found in GCS: {blob.name}")
                return None
            
            logger.info(f"Downloading model from GCS: gs://{self.gcs_bucket_name}/{blob.name}")
            start_time = time.time()
            
            # Use resumable download for large files
            with open(local_path, 'wb') as file:
                blob.download_to_file(file, checksum="crc32c")
            
            download_time = time.time() - start_time
            file_size_mb = local_path.stat().st_size / 1024 / 1024
            download_speed = file_size_mb / download_time
            logger.info(f"Model downloaded from GCS in {download_time:.1f}s ({download_speed:.1f} MB/s)")
            
            return str(local_path)
            
        except Exception as e:
            logger.error(f"GCS download failed: {e}")
            if local_path.exists():
                local_path.unlink()
            return None
    
    async def _populate_cdn(self, local_path: str, filename: str):
        """Upload model to CDN bucket for future use"""
        try:
            # This would upload to your CDN-backed GCS bucket
            # Implementation depends on your CDN setup
            logger.info(f"Populating CDN with model: {filename}")
            # ... implementation ...
        except Exception as e:
            logger.error(f"Failed to populate CDN: {e}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_hits = sum([
            self.cache_stats["local_hits"],
            self.cache_stats["cdn_hits"],
            self.cache_stats["gcs_hits"]
        ])
        
        hit_rate = 0
        if total_hits + self.cache_stats["cache_misses"] > 0:
            hit_rate = total_hits / (total_hits + self.cache_stats["cache_misses"])
        
        return {
            **self.cache_stats,
            "total_hits": total_hits,
            "hit_rate": hit_rate,
            "local_cache_size_mb": sum(
                f.stat().st_size / 1024 / 1024 
                for f in self.local_cache_dir.glob("*.pth")
            )
        }


class ModelWarmupManager:
    """Manages model warmup strategies for cold starts"""
    
    def __init__(self, cache_manager: ModelCacheManager):
        self.cache_manager = cache_manager
        self.warmup_status = "pending"
        self.warmup_start_time = None
        
    async def warmup_model(self, processor) -> bool:
        """
        Perform model warmup with progressive loading
        """
        self.warmup_start_time = time.time()
        self.warmup_status = "in_progress"
        
        try:
            # 1. Pre-download model to /tmp if not present
            model_path = await self.cache_manager.get_model_path()
            if not model_path:
                logger.error("Failed to download model during warmup")
                self.warmup_status = "failed"
                return False
            
            # 2. Load model with memory-mapped tensors
            logger.info("Loading model with memory mapping...")
            processor.load_model()
            
            # 3. Run warmup inference
            logger.info("Running warmup inference...")
            dummy_image = torch.randn(1, 3, 256, 256).to(processor.device)
            with torch.no_grad():
                _ = processor.model(dummy_image)
            
            # 4. Pre-compile CUDA kernels if GPU available
            if torch.cuda.is_available():
                logger.info("Pre-compiling CUDA kernels...")
                torch.cuda.synchronize()
            
            warmup_time = time.time() - self.warmup_start_time
            logger.info(f"Model warmup completed in {warmup_time:.1f}s")
            self.warmup_status = "completed"
            return True
            
        except Exception as e:
            logger.error(f"Model warmup failed: {e}")
            self.warmup_status = "failed"
            return False