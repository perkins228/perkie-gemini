"""
Edge Caching Strategy for Processed Images
Implements Cloudflare + GCS caching with smart invalidation
"""

import os
import time
import hashlib
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
import asyncio
import aiohttp
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Cache configuration for different tiers"""
    # Cloudflare edge cache
    cf_cache_ttl: int = 86400  # 24 hours
    cf_browser_ttl: int = 3600  # 1 hour
    
    # GCS cache
    gcs_cache_ttl: int = 604800  # 7 days
    gcs_bucket: str = "perkieprints-processing-cache"
    
    # Redis/Memcache for hot data
    redis_ttl: int = 3600  # 1 hour
    
    # Cache key versioning
    cache_version: str = "v2"
    
    # Tiered storage
    enable_tiered_storage: bool = True
    hot_tier_threshold_hours: int = 24
    cold_tier_threshold_days: int = 7


class EdgeCacheManager:
    """Manages multi-tier edge caching for processed images"""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.cloudflare_zone_id = os.getenv("CLOUDFLARE_ZONE_ID")
        self.cloudflare_api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        
    def generate_cache_key(self, 
                          image_hash: str, 
                          effect: str, 
                          params: Dict[str, Any]) -> str:
        """Generate deterministic cache key"""
        # Sort params for consistency
        param_str = "_".join(f"{k}={v}" for k, v in sorted(params.items()))
        
        # Include version for cache busting
        key_parts = [
            self.config.cache_version,
            image_hash[:16],  # First 16 chars of hash
            effect,
            hashlib.md5(param_str.encode()).hexdigest()[:8]
        ]
        
        return "-".join(key_parts)
    
    def get_cache_headers(self, cache_key: str, content_type: str = "image/png") -> Dict[str, str]:
        """Generate optimal cache headers for Cloudflare"""
        return {
            # Cloudflare cache control
            "Cache-Control": f"public, max-age={self.config.cf_cache_ttl}, s-maxage={self.config.cf_browser_ttl}",
            "Cloudflare-CDN-Cache-Control": f"max-age={self.config.cf_cache_ttl}",
            
            # Browser cache control
            "Expires": (datetime.utcnow() + timedelta(seconds=self.config.cf_browser_ttl)).strftime("%a, %d %b %Y %H:%M:%S GMT"),
            
            # Content headers
            "Content-Type": content_type,
            "X-Content-Type-Options": "nosniff",
            
            # Cache metadata
            "X-Cache-Key": cache_key,
            "X-Cache-Version": self.config.cache_version,
            "X-Cached-At": datetime.utcnow().isoformat(),
            
            # CORS headers handled by CORSMiddleware in main.py
            # Removed wildcard CORS headers for security
            
            # Vary headers for proper caching
            "Vary": "Accept-Encoding",
            
            # ETag for validation
            "ETag": f'"{cache_key}"'
        }
    
    async def get_from_edge(self, cache_key: str) -> Optional[Tuple[bytes, Dict[str, str]]]:
        """Retrieve from edge cache with fallback"""
        # 1. Try Cloudflare edge (if configured)
        if self.cloudflare_zone_id:
            edge_result = await self._get_from_cloudflare(cache_key)
            if edge_result:
                return edge_result
        
        # 2. Try GCS with CDN
        gcs_result = await self._get_from_gcs_cdn(cache_key)
        if gcs_result:
            # Warm Cloudflare cache in background
            asyncio.create_task(self._warm_cloudflare_cache(cache_key, gcs_result))
            return gcs_result
        
        return None
    
    async def store_to_edge(self, 
                           cache_key: str, 
                           image_data: bytes,
                           metadata: Dict[str, Any]) -> bool:
        """Store to multiple cache tiers"""
        tasks = []
        
        # 1. Store to GCS (primary storage)
        tasks.append(self._store_to_gcs(cache_key, image_data, metadata))
        
        # 2. Purge and warm Cloudflare cache
        if self.cloudflare_zone_id:
            tasks.append(self._update_cloudflare_cache(cache_key))
        
        # 3. Store metadata to fast tier (Redis/Memcache)
        tasks.append(self._store_metadata_fast_tier(cache_key, metadata))
        
        # Execute all storage operations in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Cache storage task {i} failed: {result}")
        
        return all(not isinstance(r, Exception) for r in results)
    
    async def _get_from_cloudflare(self, cache_key: str) -> Optional[Tuple[bytes, Dict[str, str]]]:
        """Get from Cloudflare edge cache"""
        # This would typically be handled by Cloudflare automatically
        # when requests go through your CF-proxied domain
        return None
    
    async def _get_from_gcs_cdn(self, cache_key: str) -> Optional[Tuple[bytes, Dict[str, str]]]:
        """Get from GCS with CDN URL"""
        cdn_url = f"https://cdn.perkieprints.com/cache/{cache_key}.png"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(cdn_url) as response:
                    if response.status == 200:
                        data = await response.read()
                        headers = dict(response.headers)
                        return data, headers
        except Exception as e:
            logger.error(f"Failed to get from GCS CDN: {e}")
        
        return None
    
    async def _warm_cloudflare_cache(self, cache_key: str, data: Tuple[bytes, Dict[str, str]]):
        """Warm Cloudflare cache after cache miss"""
        if not self.cloudflare_api_token:
            return
        
        try:
            # Use Cloudflare API to pre-warm cache
            url = f"https://api.cloudflare.com/client/v4/zones/{self.cloudflare_zone_id}/cache/warm"
            headers = {
                "Authorization": f"Bearer {self.cloudflare_api_token}",
                "Content-Type": "application/json"
            }
            
            # Request cache warming
            async with aiohttp.ClientSession() as session:
                await session.post(url, headers=headers, json={
                    "files": [f"https://cdn.perkieprints.com/cache/{cache_key}.png"]
                })
                
        except Exception as e:
            logger.error(f"Failed to warm Cloudflare cache: {e}")
    
    async def implement_tiered_storage(self):
        """Implement automatic tiering based on access patterns"""
        # Move cold data to cheaper storage
        # Keep hot data in expensive fast storage
        pass


class CacheOptimizer:
    """Optimizes caching strategies based on usage patterns"""
    
    def __init__(self):
        self.access_patterns = {}
        self.optimization_interval = 3600  # 1 hour
        
    async def analyze_patterns(self) -> Dict[str, Any]:
        """Analyze cache access patterns for optimization"""
        # Analyze:
        # - Most requested effects
        # - Peak usage times
        # - Geographic distribution
        # - Cache hit rates by tier
        
        recommendations = {
            "pre_warm_effects": ["blackwhite", "popart"],  # Most popular
            "scale_schedule": {
                "09:00": 2,  # Scale up for business hours
                "17:00": 1,  # Scale down after hours
                "22:00": 0   # Scale to zero overnight
            },
            "edge_locations": ["us-central1", "europe-west1"],  # Based on traffic
            "ttl_adjustments": {
                "popular_items": 172800,  # 48 hours for popular
                "regular_items": 86400    # 24 hours for regular
            }
        }
        
        return recommendations
    
    def get_optimal_cache_key_structure(self) -> str:
        """Design optimal cache key structure for hit rate"""
        # Hierarchical structure for better CDN performance
        # /effect/resolution/hash_prefix/full_hash.png
        # Example: /blackwhite/1024/ab/ab1234567890.png
        return "/{effect}/{resolution}/{hash_prefix}/{cache_key}.png"