"""Cloud Storage manager with SHA256 deduplication and caching"""
from google.cloud import storage
import hashlib
import base64
import logging
from typing import Optional, Tuple
from datetime import datetime
from src.config import settings

logger = logging.getLogger(__name__)


class StorageManager:
    """Manage Cloud Storage with deduplication and caching"""

    def __init__(self):
        self.client = storage.Client(project=settings.project_id)
        self.bucket = self.client.bucket(settings.storage_bucket)
        logger.info(f"Initialized storage: {settings.storage_bucket}")

    async def store_original_image(
        self,
        image_data: str,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Store original image with SHA256 deduplication

        Returns:
            (storage_url, image_hash)
        """
        # Decode and hash
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image_hash = hashlib.sha256(image_bytes).hexdigest()

        # Determine path
        if customer_id:
            blob_path = f"gemini-originals/customers/{customer_id}/{image_hash}.jpg"
        elif session_id:
            blob_path = f"gemini-originals/temp/{session_id}/{image_hash}.jpg"
        else:
            blob_path = f"gemini-originals/temp/anonymous/{image_hash}.jpg"

        blob = self.bucket.blob(blob_path)

        # Check if exists (deduplication)
        if blob.exists():
            logger.info(f"Original already exists: {blob_path}")
            return blob.public_url, image_hash

        # Upload
        blob.metadata = {
            'customer_id': customer_id or 'anonymous',
            'session_id': session_id or 'none',
            'upload_date': datetime.utcnow().isoformat(),
        }
        blob.upload_from_string(image_bytes, content_type='image/jpeg')
        logger.info(f"Stored original: {blob_path}")

        return blob.public_url, image_hash

    async def get_cached_generation(
        self,
        image_hash: str,
        style: str,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Check if we've already generated this image+style

        Cache key: {image_hash}_{style}.jpg
        """
        # Determine path
        if customer_id:
            blob_path = f"gemini-generated/customers/{customer_id}/{image_hash}_{style}.jpg"
        elif session_id:
            blob_path = f"gemini-generated/temp/{session_id}/{image_hash}_{style}.jpg"
        else:
            return None

        blob = self.bucket.blob(blob_path)

        if blob.exists():
            logger.info(f"Cache hit: {blob_path}")
            return blob.public_url

        return None

    async def store_generated_image(
        self,
        image_data: str,
        original_hash: str,
        style: str,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> str:
        """
        Store generated image

        Returns:
            storage_url
        """
        # Decode
        image_bytes = base64.b64decode(image_data)

        # Determine path
        if customer_id:
            blob_path = f"gemini-generated/customers/{customer_id}/{original_hash}_{style}.jpg"
        elif session_id:
            blob_path = f"gemini-generated/temp/{session_id}/{original_hash}_{style}.jpg"
        else:
            blob_path = f"gemini-generated/temp/anonymous/{original_hash}_{style}.jpg"

        blob = self.bucket.blob(blob_path)

        # Upload
        blob.metadata = {
            'customer_id': customer_id or 'anonymous',
            'session_id': session_id or 'none',
            'style': style,
            'original_hash': original_hash,
            'generated_date': datetime.utcnow().isoformat(),
        }
        blob.upload_from_string(image_bytes, content_type='image/jpeg')
        logger.info(f"Stored generated: {blob_path}")

        return blob.public_url


# Singleton instance
storage_manager = StorageManager()
