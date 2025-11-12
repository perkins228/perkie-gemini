"""
Simple Storage API for Customer Images
Just uploads original + processed image and returns URLs
No dashboard needed - URLs go directly into Shopify order properties
"""

import logging
import base64
from typing import Dict, Any
from datetime import datetime
import uuid
import hashlib
from google.cloud import storage
from fastapi import HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Security constraints
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB max
ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']


def validate_and_parse_data_url(data_url: str, image_type: str = "image") -> tuple:
    """
    Safely parse and validate a data URL.

    Args:
        data_url: The data URL string to parse
        image_type: Expected image type for logging (e.g., "original image")

    Returns:
        tuple: (image_bytes, mime_type)

    Raises:
        HTTPException: 400 for invalid input, 413 for size limits, 500 for unexpected errors
    """
    # Validate input is not empty
    if not data_url or not isinstance(data_url, str):
        logger.error(f"Invalid {image_type} data: empty or not a string")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {image_type} data: must be a non-empty string"
        )

    # Check for basic size sanity (before decoding) - ~15MB encoded = ~11MB decoded
    if len(data_url) > 15 * 1024 * 1024:
        logger.error(f"{image_type} data URL too large: {len(data_url)} chars")
        raise HTTPException(
            status_code=413,
            detail=f"{image_type} data URL exceeds maximum size"
        )

    try:
        # Handle data URL format
        if data_url.startswith('data:'):
            # Validate presence of comma separator
            if ',' not in data_url:
                logger.error(f"Malformed {image_type} data URL: no comma separator")
                logger.debug(f"Data URL prefix: {data_url[:100]}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data URL format: missing comma separator"
                )

            # Split header and data
            try:
                header, base64_data = data_url.split(',', 1)
            except ValueError as e:
                logger.error(f"Failed to split {image_type} data URL: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Malformed {image_type} data URL"
                )

            # Validate we have actual data after the comma
            if not base64_data or len(base64_data) < 10:
                logger.error(f"{image_type} data URL has no base64 data after comma")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data: no content after data URL header"
                )

            # Extract and validate MIME type
            try:
                if ':' in header and ';' in header:
                    mime_type = header.split(':')[1].split(';')[0]
                else:
                    logger.warning(f"Malformed {image_type} data URL header: {header}")
                    mime_type = 'image/jpeg'
            except (IndexError, ValueError) as e:
                logger.error(f"Failed to parse {image_type} MIME type from header: {e}")
                mime_type = 'image/jpeg'

            # Decode base64 with validation
            try:
                image_bytes = base64.b64decode(base64_data, validate=True)
            except Exception as e:
                logger.error(f"Base64 decode failed for {image_type}: {e}")
                logger.debug(f"Base64 prefix: {base64_data[:100]}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data: corrupt or invalid base64 encoding"
                )

        else:
            # Already base64 (no data URL prefix)
            logger.info(f"{image_type} provided as raw base64 (no data URL prefix)")

            try:
                image_bytes = base64.b64decode(data_url, validate=True)
                mime_type = 'image/jpeg'
            except Exception as e:
                logger.error(f"Base64 decode failed for raw {image_type} data: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data: corrupt or invalid base64 encoding"
                )

        # Validate decoded size
        if len(image_bytes) == 0:
            logger.error(f"{image_type} decoded to zero bytes")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {image_type}: file is empty"
            )

        # Validate MIME type
        if mime_type not in ALLOWED_CONTENT_TYPES:
            logger.error(f"Invalid {image_type} MIME type: {mime_type}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {mime_type}. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}"
            )

        logger.info(f"Successfully parsed {image_type}: {len(image_bytes)} bytes, type: {mime_type}")
        return image_bytes, mime_type

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Unexpected error during parsing (server error)
        logger.error(f"Unexpected error parsing {image_type} data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error processing {image_type} data"
        )


class ImageUploadRequest(BaseModel):
    session_id: str
    images: Dict[str, str]  # original and processed as data URLs
    metadata: Dict[str, Any]

class ImageUploadResponse(BaseModel):
    urls: Dict[str, str]  # original and processed URLs
    session_id: str


async def upload_customer_images(request: ImageUploadRequest) -> ImageUploadResponse:
    """
    Upload original and processed images to Google Cloud Storage
    Returns public URLs that can be saved directly in Shopify order properties
    """
    # Validate request structure
    if not request.images:
        raise HTTPException(
            status_code=400,
            detail="No images provided in request"
        )

    if 'original' not in request.images and 'processed' not in request.images:
        raise HTTPException(
            status_code=400,
            detail="At least one image (original or processed) must be provided"
        )

    # Validate session ID
    if not request.session_id or len(request.session_id) > 200:
        raise HTTPException(
            status_code=400,
            detail="Invalid session_id: must be 1-200 characters"
        )

    # Initialize GCS client with error handling
    try:
        client = storage.Client()
        bucket = client.bucket('perkieprints-customer-images')

        # Verify bucket exists (only checks metadata, doesn't load objects)
        if not bucket.exists():
            logger.error("GCS bucket 'perkieprints-customer-images' does not exist")
            raise HTTPException(
                status_code=503,
                detail="Storage service unavailable"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initialize GCS client: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Storage service initialization failed"
        )

    urls = {}

    # Upload original image
    if 'original' in request.images:
        try:
            # Parse and validate data URL
            image_bytes, mime_type = validate_and_parse_data_url(
                request.images['original'],
                "original image"
            )

            # Security validation: size limit
            if len(image_bytes) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Original image too large ({len(image_bytes) // 1024 // 1024}MB, max {MAX_FILE_SIZE // 1024 // 1024}MB)"
                )

            # Generate filename with timestamp and random UUID for security
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            random_id = uuid.uuid4().hex[:8]
            filename = f"orders/{request.session_id}/{timestamp}_{random_id}_original.jpg"

            # Upload to GCS
            blob = bucket.blob(filename)
            blob.upload_from_string(image_bytes, content_type=mime_type)
            blob.make_public()

            # Get public URL
            urls['original'] = f"https://storage.googleapis.com/perkieprints-customer-images/{filename}"

            logger.info(f"✓ Uploaded original image: {urls['original']} ({len(image_bytes) // 1024}KB)")

        except HTTPException:
            # Re-raise client/server errors
            raise
        except Exception as e:
            # GCS or other infrastructure errors
            logger.error(f"Failed to upload original image to GCS: {e}", exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Storage service temporarily unavailable"
            )

    # Upload processed image
    if 'processed' in request.images:
        try:
            # Parse and validate data URL
            image_bytes, mime_type = validate_and_parse_data_url(
                request.images['processed'],
                "processed image"
            )

            # Security validation: size limit
            if len(image_bytes) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Processed image too large ({len(image_bytes) // 1024 // 1024}MB, max {MAX_FILE_SIZE // 1024 // 1024}MB)"
                )

            # Generate filename with effect name and random UUID
            effect = request.metadata.get('effect', 'processed')
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            random_id = uuid.uuid4().hex[:8]
            filename = f"orders/{request.session_id}/{timestamp}_{random_id}_{effect}.jpg"

            # Upload to GCS
            blob = bucket.blob(filename)
            blob.upload_from_string(image_bytes, content_type=mime_type)
            blob.make_public()

            # Get public URL
            urls['processed'] = f"https://storage.googleapis.com/perkieprints-customer-images/{filename}"

            logger.info(f"✓ Uploaded processed image: {urls['processed']} ({len(image_bytes) // 1024}KB)")

        except HTTPException:
            # Re-raise client/server errors
            raise
        except Exception as e:
            # GCS or other infrastructure errors
            logger.error(f"Failed to upload processed image to GCS: {e}", exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Storage service temporarily unavailable"
            )

    # Add metadata as a JSON file (optional, for tracking)
    try:
        if request.metadata:
            import json
            import html
            
            # Sanitize metadata to prevent XSS
            sanitized_metadata = {}
            for key, value in request.metadata.items():
                if isinstance(value, str):
                    # HTML escape and truncate to reasonable length
                    sanitized_metadata[key] = html.escape(value[:500])
                else:
                    sanitized_metadata[key] = value
            
            metadata_filename = f"orders/{request.session_id}/metadata.json"
            metadata_blob = bucket.blob(metadata_filename)
            
            metadata_content = {
                'session_id': request.session_id[:100],  # Limit session ID length
                'urls': urls,
                'metadata': sanitized_metadata,
                'uploaded_at': datetime.utcnow().isoformat()
            }
            
            metadata_blob.upload_from_string(
                json.dumps(metadata_content, indent=2),
                content_type='application/json'
            )
        
        return ImageUploadResponse(
            urls=urls,
            session_id=request.session_id
        )

    except HTTPException:
        # Re-raise FastAPI exceptions (already have proper status codes)
        raise
    except Exception as e:
        # Truly unexpected errors - log with full traceback
        logger.error(f"Unexpected error in upload_customer_images: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error during image upload"
        )


# Add to main API
def register_storage_endpoints(app):
    """Register the storage endpoints with the main FastAPI app"""
    
    @app.post("/api/storage/upload", response_model=ImageUploadResponse)
    async def upload_images(request: ImageUploadRequest):
        """
        Simple endpoint to upload original + processed images
        Returns URLs that go directly into Shopify order properties
        """
        return await upload_customer_images(request)