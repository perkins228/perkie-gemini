"""
Customer Image Storage Manager
Handles storage of customer original and edited images with lifecycle management
"""

import asyncio
import logging
import time
import hashlib
import json
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from io import BytesIO
import os

try:
    from google.cloud import storage
    from google.api_core import exceptions as gcs_exceptions
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False
    storage = None
    gcs_exceptions = None

logger = logging.getLogger(__name__)


class CustomerStorageManager:
    """Manages customer image storage with automatic lifecycle management"""
    
    # Storage tiers and their retention policies
    STORAGE_TIERS = {
        'temporary': {
            'days': 7,
            'description': 'Temporary images not associated with orders'
        },
        'order_pending': {
            'days': 30,
            'description': 'Images waiting for order completion'
        },
        'order_completed': {
            'days': 180,  # 6 months
            'description': 'Images from completed orders'
        },
        'archived': {
            'days': 730,  # 2 years
            'description': 'Long-term archive for reorders'
        }
    }
    
    def __init__(self, bucket_name: str):
        """
        Initialize customer storage manager
        
        Args:
            bucket_name: GCS bucket name for customer images
        """
        self.bucket_name = bucket_name
        self.client = None
        self.bucket = None
        self.enabled = GOOGLE_CLOUD_AVAILABLE
        
        if not self.enabled:
            logger.warning("Google Cloud Storage not available. Customer storage disabled.")
            return
        
        try:
            self._initialize_client()
            self._setup_lifecycle_policies()
        except Exception as e:
            logger.error(f"Failed to initialize Customer Storage: {e}")
            self.enabled = False
    
    def _initialize_client(self):
        """Initialize Google Cloud Storage client"""
        if not GOOGLE_CLOUD_AVAILABLE:
            return
            
        try:
            self.client = storage.Client()
            self.bucket = self.client.bucket(self.bucket_name)
            
            # Create bucket if it doesn't exist
            if not self.bucket.exists():
                logger.info(f"Creating bucket {self.bucket_name}")
                self.bucket = self.client.create_bucket(
                    self.bucket_name,
                    location="us-central1"
                )
                logger.info(f"Created bucket {self.bucket_name}")
            else:
                logger.info(f"Connected to existing bucket: {self.bucket_name}")
                
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
            self.enabled = False
    
    def _setup_lifecycle_policies(self):
        """Set up lifecycle policies for automatic purging"""
        if not self.enabled:
            return
            
        try:
            # Create lifecycle rules for each tier
            rules = []
            
            # Rule for temporary images (7 days)
            rules.append({
                "action": {"type": "Delete"},
                "condition": {
                    "age": 7,
                    "matchesPrefix": ["customer-images/temporary/"]
                }
            })
            
            # Rule for pending order images (30 days)
            rules.append({
                "action": {"type": "Delete"},
                "condition": {
                    "age": 30,
                    "matchesPrefix": ["customer-images/order_pending/"]
                }
            })
            
            # Rule for completed order images (180 days)
            rules.append({
                "action": {"type": "Delete"},
                "condition": {
                    "age": 180,
                    "matchesPrefix": ["customer-images/order_completed/"]
                }
            })
            
            # Rule for archived images (2 years)
            rules.append({
                "action": {"type": "Delete"},
                "condition": {
                    "age": 730,
                    "matchesPrefix": ["customer-images/archived/"]
                }
            })
            
            # Apply lifecycle rules
            self.bucket.lifecycle_rules = rules
            self.bucket.patch()
            
            logger.info("Lifecycle policies configured for automatic purging")
            
        except Exception as e:
            logger.error(f"Failed to setup lifecycle policies: {e}")
    
    def _generate_filename(self, session_id: str, image_type: str, 
                          original_filename: Optional[str] = None) -> str:
        """Generate unique filename for storage"""
        timestamp = int(time.time())
        
        # Extract extension from original filename if provided
        ext = 'png'
        if original_filename:
            parts = original_filename.split('.')
            if len(parts) > 1:
                ext = parts[-1].lower()
        
        # Don't include session_id in filename since it's added by _get_storage_path
        return f"{image_type}_{timestamp}.{ext}"
    
    def _get_storage_path(self, tier: str, session_id: str, 
                         filename: str) -> str:
        """Get full storage path for a file"""
        return f"customer-images/{tier}/{session_id}/{filename}"
    
    async def store_image(
        self,
        image_data: bytes,
        session_id: str,
        image_type: str,
        tier: str = 'temporary',
        metadata: Optional[Dict[str, str]] = None,
        original_filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Optional[str]:
        """
        Store customer image with lifecycle management
        
        Args:
            image_data: Image bytes to store
            session_id: Unique session identifier
            image_type: Type of image (original, processed_effect_name, etc.)
            tier: Storage tier (temporary, order_pending, order_completed, archived)
            metadata: Additional metadata to store
            original_filename: Original filename for extension detection
            content_type: MIME type of the image
            
        Returns:
            Public URL of stored image or None if failed
        """
        if not self.enabled:
            logger.warning("Storage not enabled, returning None")
            return None
        
        if tier not in self.STORAGE_TIERS:
            logger.error(f"Invalid storage tier: {tier}")
            return None
            
        try:
            # Generate filename
            filename = self._generate_filename(session_id, image_type, original_filename)
            blob_path = self._get_storage_path(tier, session_id, filename)
            
            # Create blob
            blob = self.bucket.blob(blob_path)
            
            # Set metadata
            blob_metadata = {
                "session_id": session_id,
                "image_type": image_type,
                "tier": tier,
                "uploaded_at": datetime.utcnow().isoformat(),
                "size_bytes": str(len(image_data))
            }
            
            if metadata:
                blob_metadata.update(metadata)
            
            blob.metadata = blob_metadata
            
            # Set content type
            if not content_type:
                if image_type.endswith('.jpg') or image_type.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                else:
                    content_type = 'image/png'
            
            blob.content_type = content_type
            
            # Set cache control for public access
            blob.cache_control = "public, max-age=3600"
            
            # Upload asynchronously
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: blob.upload_from_string(image_data, content_type=content_type)
            )
            
            # Get public URL (bucket already has public access via IAM)
            public_url = blob.public_url
            
            logger.info(f"Stored {image_type} for session {session_id} in {tier} tier: {public_url}")
            
            # Track storage metrics
            await self._track_storage_metric(tier, len(image_data))
            
            return public_url
            
        except Exception as e:
            logger.error(f"Error storing customer image: {e}")
            return None
    
    async def link_order_to_session(
        self,
        order_number: str,
        session_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Link a Shopify order to a storage session
        
        Args:
            order_number: Shopify order number
            session_id: Session identifier
            metadata: Additional order metadata (customer name, items, etc.)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            return False
            
        try:
            # Create order mapping file
            mapping_path = f"order-mappings/{order_number}.json"
            blob = self.bucket.blob(mapping_path)
            
            # Prepare mapping data
            mapping_data = {
                "order_number": order_number,
                "session_id": session_id,
                "linked_at": datetime.utcnow().isoformat(),
                "metadata": metadata or {}
            }
            
            # Upload mapping
            blob.upload_from_string(
                json.dumps(mapping_data, indent=2),
                content_type="application/json"
            )
            
            logger.info(f"Linked order {order_number} to session {session_id}")
            
            # Also move images to order_pending tier
            await self.move_to_tier(session_id, "temporary", "order_pending")
            
            return True
            
        except Exception as e:
            logger.error(f"Error linking order to session: {e}")
            return False
    
    async def get_order_images(
        self,
        order_number: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get all images associated with an order
        
        Args:
            order_number: Shopify order number
            
        Returns:
            Dictionary with session_id and image URLs, or None if not found
        """
        if not self.enabled:
            return None
            
        try:
            # Get order mapping
            mapping_path = f"order-mappings/{order_number}.json"
            blob = self.bucket.blob(mapping_path)
            
            if not blob.exists():
                logger.warning(f"No mapping found for order {order_number}")
                return None
            
            # Download mapping data
            mapping_data = json.loads(blob.download_as_text())
            session_id = mapping_data.get("session_id")
            
            if not session_id:
                logger.error(f"No session_id in mapping for order {order_number}")
                return None
            
            # Get all images for this session
            images = await self.get_session_images(session_id)
            
            return {
                "order_number": order_number,
                "session_id": session_id,
                "images": images,
                "metadata": mapping_data.get("metadata", {})
            }
            
        except Exception as e:
            logger.error(f"Error getting order images: {e}")
            return None
    
    async def move_to_tier(
        self,
        session_id: str,
        from_tier: str,
        to_tier: str
    ) -> bool:
        """
        Move all images for a session to a different storage tier
        
        Args:
            session_id: Session identifier
            from_tier: Current storage tier
            to_tier: Target storage tier
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            return False
            
        if from_tier not in self.STORAGE_TIERS or to_tier not in self.STORAGE_TIERS:
            logger.error(f"Invalid tier: {from_tier} or {to_tier}")
            return False
            
        try:
            # List all blobs for this session in the source tier
            prefix = f"customer-images/{from_tier}/{session_id}/"
            blobs = list(self.client.list_blobs(self.bucket_name, prefix=prefix))
            
            if not blobs:
                logger.warning(f"No images found for session {session_id} in {from_tier}")
                return False
            
            # Copy each blob to new tier
            for source_blob in blobs:
                # Generate new path
                filename = source_blob.name.split('/')[-1]
                new_path = f"customer-images/{to_tier}/{session_id}/{filename}"
                
                # Copy blob
                destination_blob = self.bucket.copy_blob(
                    source_blob,
                    self.bucket,
                    new_path
                )
                
                # Update metadata
                if destination_blob.metadata:
                    destination_blob.metadata['tier'] = to_tier
                    destination_blob.metadata['moved_at'] = datetime.utcnow().isoformat()
                    destination_blob.patch()
                
                # Delete source blob
                source_blob.delete()
                
            logger.info(f"Moved {len(blobs)} images from {from_tier} to {to_tier} for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error moving images between tiers: {e}")
            return False
    
    async def mark_order_completed(self, session_id: str, order_id: str) -> bool:
        """
        Mark images as associated with a completed order
        
        Args:
            session_id: Session identifier
            order_id: Shopify order ID
            
        Returns:
            True if successful
        """
        # Move from temporary or pending to completed
        for from_tier in ['temporary', 'order_pending']:
            success = await self.move_to_tier(session_id, from_tier, 'order_completed')
            if success:
                # Update metadata with order ID
                await self._update_session_metadata(
                    session_id, 
                    'order_completed',
                    {'order_id': order_id, 'order_completed_at': datetime.utcnow().isoformat()}
                )
                return True
        
        return False
    
    async def _update_session_metadata(
        self,
        session_id: str,
        tier: str,
        metadata_updates: Dict[str, str]
    ):
        """Update metadata for all images in a session"""
        try:
            prefix = f"customer-images/{tier}/{session_id}/"
            blobs = self.client.list_blobs(self.bucket_name, prefix=prefix)
            
            for blob in blobs:
                if blob.metadata:
                    blob.metadata.update(metadata_updates)
                else:
                    blob.metadata = metadata_updates
                blob.patch()
                
        except Exception as e:
            logger.error(f"Error updating session metadata: {e}")
    
    async def get_session_images(
        self,
        session_id: str,
        tier: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all images for a session
        
        Args:
            session_id: Session identifier
            tier: Specific tier to search (None searches all)
            
        Returns:
            List of image information dictionaries
        """
        if not self.enabled:
            return []
            
        try:
            images = []
            
            # Search in specific tier or all tiers
            tiers_to_search = [tier] if tier else list(self.STORAGE_TIERS.keys())
            
            for search_tier in tiers_to_search:
                prefix = f"customer-images/{search_tier}/{session_id}/"
                blobs = self.client.list_blobs(self.bucket_name, prefix=prefix)
                
                for blob in blobs:
                    image_info = {
                        'url': blob.public_url,
                        'name': blob.name,
                        'size': blob.size,
                        'content_type': blob.content_type,
                        'created': blob.time_created.isoformat() if blob.time_created else None,
                        'tier': search_tier,
                        'metadata': blob.metadata or {}
                    }
                    images.append(image_info)
            
            return images
            
        except Exception as e:
            logger.error(f"Error getting session images: {e}")
            return []
    
    async def _track_storage_metric(self, tier: str, size_bytes: int):
        """Track storage metrics for monitoring"""
        try:
            # This could be extended to send metrics to monitoring service
            logger.debug(f"Storage metric - Tier: {tier}, Size: {size_bytes} bytes")
        except Exception as e:
            logger.error(f"Error tracking storage metric: {e}")
    
    async def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get storage statistics by tier
        
        Returns:
            Dictionary with storage statistics
        """
        if not self.enabled:
            return {"enabled": False}
            
        try:
            stats = {
                "enabled": True,
                "bucket": self.bucket_name,
                "tiers": {}
            }
            
            for tier, config in self.STORAGE_TIERS.items():
                prefix = f"customer-images/{tier}/"
                blobs = list(self.client.list_blobs(self.bucket_name, prefix=prefix, max_results=1000))
                
                total_size = sum(blob.size or 0 for blob in blobs)
                total_count = len(blobs)
                
                stats["tiers"][tier] = {
                    "description": config['description'],
                    "retention_days": config['days'],
                    "total_images": total_count,
                    "total_size_mb": round(total_size / (1024 * 1024), 2),
                    "estimated_monthly_cost": round(total_size / (1024 * 1024 * 1024) * 0.02, 2)  # ~$0.02 per GB
                }
            
            # Calculate totals
            stats["total_images"] = sum(t["total_images"] for t in stats["tiers"].values())
            stats["total_size_mb"] = sum(t["total_size_mb"] for t in stats["tiers"].values())
            stats["estimated_monthly_cost"] = sum(t["estimated_monthly_cost"] for t in stats["tiers"].values())
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
            return {"enabled": True, "error": str(e)}
    
    async def cleanup_expired_images(self, dry_run: bool = True) -> Dict[str, int]:
        """
        Manually cleanup expired images
        
        Args:
            dry_run: If True, only report what would be deleted
            
        Returns:
            Dictionary with cleanup statistics
        """
        if not self.enabled:
            return {"error": "Storage not enabled"}
            
        try:
            cleanup_stats = {}
            current_time = datetime.utcnow()
            
            for tier, config in self.STORAGE_TIERS.items():
                prefix = f"customer-images/{tier}/"
                blobs = list(self.client.list_blobs(self.bucket_name, prefix=prefix))
                
                expired_count = 0
                expired_size = 0
                
                for blob in blobs:
                    if blob.time_created:
                        age_days = (current_time - blob.time_created).days
                        
                        if age_days > config['days']:
                            expired_count += 1
                            expired_size += blob.size or 0
                            
                            if not dry_run:
                                blob.delete()
                                logger.info(f"Deleted expired image: {blob.name}")
                
                cleanup_stats[tier] = {
                    "expired_count": expired_count,
                    "expired_size_mb": round(expired_size / (1024 * 1024), 2),
                    "retention_days": config['days']
                }
            
            cleanup_stats["dry_run"] = dry_run
            cleanup_stats["total_expired"] = sum(t["expired_count"] for t in cleanup_stats.values() if isinstance(t, dict))
            
            return cleanup_stats
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return {"error": str(e)}