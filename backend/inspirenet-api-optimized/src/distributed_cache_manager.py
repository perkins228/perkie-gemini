"""
Distributed Cache Manager with Redis/Memcache
Supports scale-to-zero with smart connection pooling
"""

import os
import time
import asyncio
import pickle
import logging
from typing import Optional, Any, Dict
from dataclasses import dataclass
import redis.asyncio as redis
from aiocache import Cache, cached
from aiocache.serializers import PickleSerializer
import json

logger = logging.getLogger(__name__)


@dataclass
class DistributedCacheConfig:
    """Configuration for distributed caching"""
    # Redis configuration
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_ttl: int = 3600  # 1 hour default
    redis_max_connections: int = 10
    
    # Memcache configuration  
    memcache_servers: list = None
    memcache_ttl: int = 1800  # 30 minutes
    
    # Circuit breaker for failures
    failure_threshold: int = 5
    recovery_timeout: int = 60
    
    # Compression for large objects
    compression_threshold: int = 1024  # 1KB


class DistributedCacheManager:
    """Manages distributed caching with automatic failover"""
    
    def __init__(self, config: DistributedCacheConfig):
        self.config = config
        self.redis_client = None
        self.memcache_client = None
        self.failure_count = 0
        self.last_failure_time = 0
        self._initialized = False
        
    async def initialize(self):
        """Lazy initialization of cache connections"""
        if self._initialized:
            return
            
        try:
            # Initialize Redis with connection pooling
            if self.config.redis_url and self.config.redis_url != "redis://localhost:6379":
                self.redis_client = await redis.from_url(
                    self.config.redis_url,
                    encoding="utf-8",
                    decode_responses=False,
                    max_connections=self.config.redis_max_connections,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30
                )
                
                # Test connection
                await self.redis_client.ping()
                logger.info("Redis connection established")
                
            # Initialize Memcache if configured
            if self.config.memcache_servers:
                self.memcache_client = Cache(
                    Cache.MEMCACHED,
                    endpoint=self.config.memcache_servers[0],
                    port=11211,
                    serializer=PickleSerializer(),
                    timeout=5
                )
                logger.info("Memcache connection established")
                
            self._initialized = True
            
        except Exception as e:
            logger.warning(f"Failed to initialize distributed cache: {e}")
            self._initialized = False
    
    async def get(self, key: str, tier: str = "all") -> Optional[Any]:
        """Get value from distributed cache with fallback"""
        if not await self._should_use_cache():
            return None
            
        # Ensure initialization
        await self.initialize()
        
        # Try Redis first (if tier is "all" or "redis")
        if tier in ["all", "redis"] and self.redis_client:
            try:
                value = await self.redis_client.get(f"inspirenet:{key}")
                if value:
                    logger.debug(f"Redis cache hit: {key}")
                    return pickle.loads(value) if isinstance(value, bytes) else value
            except Exception as e:
                logger.error(f"Redis get error: {e}")
                await self._handle_failure()
        
        # Try Memcache (if tier is "all" or "memcache")
        if tier in ["all", "memcache"] and self.memcache_client:
            try:
                value = await self.memcache_client.get(f"inspirenet:{key}")
                if value:
                    logger.debug(f"Memcache hit: {key}")
                    return value
            except Exception as e:
                logger.error(f"Memcache get error: {e}")
        
        return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None, tier: str = "all") -> bool:
        """Set value in distributed cache"""
        if not await self._should_use_cache():
            return False
            
        await self.initialize()
        
        success = False
        ttl = ttl or self.config.redis_ttl
        
        # Serialize value
        serialized = pickle.dumps(value)
        
        # Store in Redis
        if tier in ["all", "redis"] and self.redis_client:
            try:
                await self.redis_client.setex(
                    f"inspirenet:{key}",
                    ttl,
                    serialized
                )
                success = True
                logger.debug(f"Stored in Redis: {key}")
            except Exception as e:
                logger.error(f"Redis set error: {e}")
                await self._handle_failure()
        
        # Store in Memcache for hot data
        if tier in ["all", "memcache"] and self.memcache_client and len(serialized) < 1048576:  # < 1MB
            try:
                await self.memcache_client.set(
                    f"inspirenet:{key}",
                    value,
                    ttl=min(ttl, self.config.memcache_ttl)
                )
                logger.debug(f"Stored in Memcache: {key}")
            except Exception as e:
                logger.error(f"Memcache set error: {e}")
        
        return success
    
    async def cache_model_metadata(self, model_info: Dict[str, Any]) -> bool:
        """Cache model metadata for fast startup checks"""
        metadata = {
            "loaded_at": time.time(),
            "model_info": model_info,
            "instance_id": os.getenv("K_REVISION", "unknown"),
            "gpu_available": model_info.get("device", "").startswith("cuda")
        }
        
        return await self.set("model:metadata", metadata, ttl=300)  # 5 minutes
    
    async def get_warm_instances(self) -> Dict[str, Any]:
        """Get information about warm instances"""
        instances = {}
        
        # Scan for instance metadata
        if self.redis_client:
            try:
                cursor = 0
                pattern = "inspirenet:instance:*"
                
                while True:
                    cursor, keys = await self.redis_client.scan(
                        cursor, 
                        match=pattern,
                        count=100
                    )
                    
                    for key in keys:
                        instance_data = await self.redis_client.get(key)
                        if instance_data:
                            instances[key] = pickle.loads(instance_data)
                    
                    if cursor == 0:
                        break
                        
            except Exception as e:
                logger.error(f"Failed to get warm instances: {e}")
        
        return instances
    
    async def register_instance(self, instance_id: str) -> bool:
        """Register this instance as warm"""
        instance_data = {
            "instance_id": instance_id,
            "started_at": time.time(),
            "revision": os.getenv("K_REVISION", "unknown"),
            "service": os.getenv("K_SERVICE", "unknown"),
            "gpu": torch.cuda.is_available() if 'torch' in globals() else False
        }
        
        return await self.set(
            f"instance:{instance_id}",
            instance_data,
            ttl=120  # 2 minutes - instances should refresh
        )
    
    async def _should_use_cache(self) -> bool:
        """Check if cache should be used (circuit breaker)"""
        if self.failure_count >= self.config.failure_threshold:
            if time.time() - self.last_failure_time < self.config.recovery_timeout:
                return False
            else:
                # Reset after recovery timeout
                self.failure_count = 0
                logger.info("Distributed cache circuit breaker reset")
        
        return True
    
    async def _handle_failure(self):
        """Handle cache failure"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.config.failure_threshold:
            logger.warning(f"Distributed cache circuit breaker opened after {self.failure_count} failures")
    
    async def close(self):
        """Close cache connections"""
        if self.redis_client:
            await self.redis_client.close()
        
        self._initialized = False


class SmartCacheWarming:
    """Intelligent cache warming strategies"""
    
    def __init__(self, cache_manager: DistributedCacheManager):
        self.cache = cache_manager
        self.warming_queue = asyncio.Queue()
        
    async def warm_critical_paths(self):
        """Warm critical cache paths on startup"""
        critical_keys = [
            "model:metadata",
            "effects:available",
            "processing:stats"
        ]
        
        tasks = []
        for key in critical_keys:
            tasks.append(self._warm_key(key))
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def predictive_warming(self, access_log: Dict[str, int]):
        """Predictively warm cache based on access patterns"""
        # Sort by access frequency
        sorted_keys = sorted(access_log.items(), key=lambda x: x[1], reverse=True)
        
        # Warm top 20% of keys
        top_20_percent = int(len(sorted_keys) * 0.2)
        for key, _ in sorted_keys[:top_20_percent]:
            await self.warming_queue.put(key)
    
    async def _warm_key(self, key: str):
        """Warm a specific cache key"""
        # This would fetch from slower storage and populate fast cache
        pass