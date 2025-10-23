"""
Customer Image Storage Endpoints
Handles storage of customer uploaded and processed images
"""

import logging
import time
from typing import Optional, Dict, Any
from io import BytesIO

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import JSONResponse

from customer_storage import CustomerStorageManager

logger = logging.getLogger(__name__)

# Global instance (will be initialized in main.py)
customer_storage: Optional[CustomerStorageManager] = None

# Customer Image Router
router = APIRouter(tags=["customer-images"])


def initialize_customer_storage(bucket_name: str = "perkieprints-customer-images"):
    """Initialize customer storage manager"""
    global customer_storage
    
    customer_storage = CustomerStorageManager(bucket_name=bucket_name)
    logger.info(f"Customer storage initialized with bucket: {bucket_name}")


@router.post("/store-image")
async def store_customer_image(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    image_type: str = Form(...),
    pet_name: Optional[str] = Form(None),
    pet_id: Optional[str] = Form(None),
    effect_applied: Optional[str] = Form(None),
    tier: str = Form(default="temporary")
):
    """
    Store customer image with lifecycle management
    
    Args:
        file: Image file to upload
        session_id: Unique session identifier
        image_type: Type of image (original, processed_enhancedblackwhite, etc.)
        pet_name: Optional pet name for metadata
        pet_id: Optional pet ID for metadata
        effect_applied: Effect applied to processed images
        tier: Storage tier (temporary, order_pending, order_completed)
    
    Returns:
        JSON with success status and public URL
    """
    if not customer_storage or not customer_storage.enabled:
        raise HTTPException(
            status_code=503,
            detail="Customer storage service is not available"
        )
    
    # Validate file
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}"
        )
    
    # File size limit (50MB)
    max_size = 50 * 1024 * 1024
    
    try:
        # Read file content
        content = await file.read()
        
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is 50MB"
            )
        
        # Prepare metadata
        metadata = {
            "original_filename": file.filename,
            "content_type": file.content_type,
            "upload_timestamp": str(int(time.time()))
        }
        
        if pet_name:
            metadata["pet_name"] = pet_name
        if pet_id:
            metadata["pet_id"] = pet_id
        if effect_applied:
            metadata["effect_applied"] = effect_applied
        
        # Store image
        public_url = await customer_storage.store_image(
            image_data=content,
            session_id=session_id,
            image_type=image_type,
            tier=tier,
            metadata=metadata,
            original_filename=file.filename,
            content_type=file.content_type
        )
        
        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to store image"
            )
        
        logger.info(f"Stored {image_type} for session {session_id}: {public_url}")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "url": public_url,
                "session_id": session_id,
                "image_type": image_type,
                "tier": tier,
                "filename": file.filename
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error storing customer image: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/session/{session_id}/images")
async def get_session_images(
    session_id: str,
    tier: Optional[str] = Query(None, description="Filter by storage tier")
):
    """
    Get all images for a session
    
    Args:
        session_id: Session identifier
        tier: Optional tier filter
    
    Returns:
        List of images with metadata
    """
    if not customer_storage or not customer_storage.enabled:
        raise HTTPException(
            status_code=503,
            detail="Customer storage service is not available"
        )
    
    try:
        images = await customer_storage.get_session_images(session_id, tier)
        
        return {
            "success": True,
            "session_id": session_id,
            "image_count": len(images),
            "images": images
        }
        
    except Exception as e:
        logger.error(f"Error retrieving session images: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve images: {str(e)}"
        )


@router.post("/session/{session_id}/complete-order")
async def complete_order(
    session_id: str,
    order_id: str = Form(...)
):
    """
    Mark session images as associated with a completed order
    Moves images to order_completed tier for longer retention
    
    Args:
        session_id: Session identifier
        order_id: Shopify order ID
    
    Returns:
        Success status
    """
    if not customer_storage or not customer_storage.enabled:
        raise HTTPException(
            status_code=503,
            detail="Customer storage service is not available"
        )
    
    try:
        success = await customer_storage.mark_order_completed(session_id, order_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"No images found for session {session_id}"
            )
        
        logger.info(f"Marked session {session_id} as completed with order {order_id}")
        
        return {
            "success": True,
            "session_id": session_id,
            "order_id": order_id,
            "message": "Images moved to order_completed tier with 6-month retention"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing order: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete order: {str(e)}"
        )


@router.post("/session/{session_id}/move-tier")
async def move_session_tier(
    session_id: str,
    from_tier: str = Form(...),
    to_tier: str = Form(...)
):
    """
    Move session images between storage tiers
    
    Args:
        session_id: Session identifier
        from_tier: Current tier
        to_tier: Target tier
    
    Returns:
        Success status
    """
    if not customer_storage or not customer_storage.enabled:
        raise HTTPException(
            status_code=503,
            detail="Customer storage service is not available"
        )
    
    valid_tiers = ["temporary", "order_pending", "order_completed", "archived"]
    
    if from_tier not in valid_tiers or to_tier not in valid_tiers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Valid tiers: {valid_tiers}"
        )
    
    try:
        success = await customer_storage.move_to_tier(session_id, from_tier, to_tier)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"No images found for session {session_id} in tier {from_tier}"
            )
        
        return {
            "success": True,
            "session_id": session_id,
            "from_tier": from_tier,
            "to_tier": to_tier
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving session tier: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to move session: {str(e)}"
        )


@router.get("/storage/stats")
async def get_storage_stats():
    """
    Get storage statistics by tier
    
    Returns:
        Storage statistics including costs
    """
    if not customer_storage or not customer_storage.enabled:
        raise HTTPException(
            status_code=503,
            detail="Customer storage service is not available"
        )
    
    try:
        stats = await customer_storage.get_storage_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting storage stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get storage stats: {str(e)}"
        )


@router.post("/storage/cleanup")
async def cleanup_expired_images(
    dry_run: bool = Query(default=True, description="If true, only show what would be deleted")
):
    """
    Manually cleanup expired images
    
    Args:
        dry_run: If true, only report what would be deleted
    
    Returns:
        Cleanup statistics
    """
    if not customer_storage or not customer_storage.enabled:
        raise HTTPException(
            status_code=503,
            detail="Customer storage service is not available"
        )
    
    try:
        stats = await customer_storage.cleanup_expired_images(dry_run=dry_run)
        
        return {
            "success": True,
            "dry_run": dry_run,
            "cleanup_stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Cleanup failed: {str(e)}"
        )