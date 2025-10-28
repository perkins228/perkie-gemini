"""Cloud Storage manager with deduplication and caching"""
from google.cloud import storage
import base64
import hashlib
import logging
from datetime import datetime
from typing import Optional, Tuple
from src.config import settings

logger = logging.getLogger(__name__)


class StorageManager:
    """Manages image storage with deduplication"""

    def __init__(self):
        self.client = storage.Client(project=settings.project_id)
        self.bucket = self.client.bucket(settings.storage_bucket)
        logger.info(f"Initialized storage manager for bucket: {settings.storage_bucket}")

    async def get_cached_generation(
        self,
        image_hash: str,
        style: str,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Check if we've already generated this image + style combination

        Cache key: {image_hash}_{style}.jpg

        Returns:
            URL if cached, None if not found
        """
        # Determine path based on customer vs session
        if customer_id:
            blob_path = f"generated/customers/{customer_id}/{image_hash}_{style}.jpg"
        elif session_id:
            blob_path = f"generated/temp/{session_id}/{image_hash}_{style}.jpg"
        else:
            return None

        blob = self.bucket.blob(blob_path)

        if blob.exists():
            logger.info(f"Cache hit: {blob_path}")
            # Return public URL
            return blob.public_url

        return None

    async def store_original_image(
        self,
        image_data: str,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Store original uploaded image with deduplication

        Returns:
            (storage_url, image_hash)
        """
        # Decode base64 and calculate SHA256
        image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
        image_hash = hashlib.sha256(image_bytes).hexdigest()

        # Determine storage path
        if customer_id:
            blob_path = f"originals/customers/{customer_id}/{image_hash}.jpg"
        elif session_id:
            blob_path = f"originals/temp/{session_id}/{image_hash}.jpg"
        else:
            blob_path = f"originals/temp/anonymous/{image_hash}.jpg"

        blob = self.bucket.blob(blob_path)

        # Check if already exists (deduplication)
        if blob.exists():
            logger.info(f"Original image already exists: {blob_path}")
            return blob.public_url, image_hash

        # Upload with metadata
        blob.metadata = {
            'customer_id': customer_id or 'anonymous',
            'session_id': session_id or 'none',
            'upload_date': datetime.utcnow().isoformat(),
            'content_type': 'image/jpeg'
        }

        blob.upload_from_string(image_bytes, content_type='image/jpeg')
        logger.info(f"Stored original: {blob_path}")

        return blob.public_url, image_hash

    async def store_generated_image(
        self,
        image_data: str,
        original_hash: str,
        style: str,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> str:
        """
        Store generated artistic image

        Args:
            image_data: Base64 encoded generated image
            original_hash: Hash of original image (for cache key)
            style: Style that was applied
            customer_id: Customer ID (if logged in)
            session_id: Session ID (if anonymous)

        Returns:
            storage_url
        """
        # Decode base64
        image_bytes = base64.b64decode(image_data)

        # Determine storage path (cache key: hash_style.jpg)
        if customer_id:
            blob_path = f"generated/customers/{customer_id}/{original_hash}_{style}.jpg"
        elif session_id:
            blob_path = f"generated/temp/{session_id}/{original_hash}_{style}.jpg"
        else:
            blob_path = f"generated/temp/anonymous/{original_hash}_{style}.jpg"

        blob = self.bucket.blob(blob_path)

        # Upload with metadata
        blob.metadata = {
            'customer_id': customer_id or 'anonymous',
            'session_id': session_id or 'none',
            'style': style,
            'original_hash': original_hash,
            'generated_date': datetime.utcnow().isoformat(),
            'content_type': 'image/jpeg'
        }

        blob.upload_from_string(image_bytes, content_type='image/jpeg')
        logger.info(f"Stored generated image: {blob_path}")

        return blob.public_url


# Singleton instance
storage_manager = StorageManager()
