"""
API v2 Endpoints
Enhanced endpoints with integrated background removal and effects processing
"""

import os
import uuid
import time
import logging
import gc
import torch
from typing import List, Optional, Dict, Any
from io import BytesIO
from PIL import Image

from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Query, Request, Form
from fastapi.responses import Response
from pydantic import BaseModel

from integrated_processor import IntegratedProcessor
from memory_efficient_integrated_processor import MemoryEfficientIntegratedProcessor
from enhanced_progress_manager import EnhancedProgressManager, create_progress_callback
from storage import CloudStorageManager
from memory_optimized_processor import MemoryOptimizedProcessor

logger = logging.getLogger(__name__)

# Global instances (will be initialized in main.py)
integrated_processor: Optional[IntegratedProcessor] = None
enhanced_progress_manager: Optional[EnhancedProgressManager] = None
limiter = None  # Will be set from main.py

# API v2 Router
router = APIRouter(prefix="/api/v2", tags=["v2"])

class ProcessingRequestV2(BaseModel):
    """Enhanced request model for v2 API"""
    effects: List[str] = ["enhancedblackwhite"]  # Default to enhanced B&W
    effect_params: Optional[Dict[str, Dict[str, Any]]] = None
    output_format: str = "png"
    quality: int = 95
    use_cache: bool = True
    return_all_effects: bool = True  # Return all effects or just the first one

class EffectSwitchRequest(BaseModel):
    """Request model for effect switching on existing background-removed image"""
    effect: str
    effect_params: Optional[Dict[str, Any]] = None
    output_format: str = "png"
    quality: int = 95

def initialize_v2_api(storage_manager: CloudStorageManager):
    """Initialize v2 API components"""
    global integrated_processor, enhanced_progress_manager
    
    enhanced_progress_manager = EnhancedProgressManager()
    integrated_processor = IntegratedProcessor(
        storage_manager=storage_manager,
        gpu_enabled=True
    )
    
    logger.info("API v2 initialized with integrated processor")

@router.get("/")
async def v2_root():
    """API v2 root endpoint"""
    return {
        "service": "Enhanced Background Removal + Effects API",
        "version": "2.0.0",
        "description": "Integrated background removal with advanced effects processing",
        "features": [
            "Enhanced Black & White (60% visual improvement)",
            "Optimized Pop Art (100x speedup)",
            "Integrated processing pipeline",
            "Advanced caching strategy",
            "Real-time progress tracking",
            "Effect switching capabilities"
        ],
        "available_effects": integrated_processor.get_available_effects() if integrated_processor else []
    }

@router.get("/effects")
async def get_available_effects():
    """Get list of available effects with detailed information"""
    if not integrated_processor:
        raise HTTPException(status_code=503, detail="Integrated processor not initialized")
    
    effects = integrated_processor.get_available_effects()
    effect_details = {}
    
    for effect in effects:
        try:
            effect_details[effect] = integrated_processor.get_effect_info(effect)
        except Exception as e:
            effect_details[effect] = {"error": str(e)}
    
    return {
        "available_effects": effects,
        "effect_details": effect_details,
        "recommended_effects": ["enhancedblackwhite", "optimized_popart"],
        "total_effects": len(effects)
    }

@router.get("/effect/{effect_name}")
async def get_effect_info(effect_name: str):
    """Get detailed information about a specific effect"""
    if not integrated_processor:
        raise HTTPException(status_code=503, detail="Integrated processor not initialized")
    
    try:
        effect_info = integrated_processor.get_effect_info(effect_name)
        return effect_info
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Effect '{effect_name}' not found or error: {str(e)}")

@router.get("/ws/enhanced-progress/{session_id}")
async def enhanced_progress_info(session_id: str):
    """HTTP GET fallback for WebSocket endpoint - provides session info"""
    try:
        if not enhanced_progress_manager:
            return {
                "error": "Progress manager not initialized",
                "endpoint": f"/ws/enhanced-progress/{session_id}",
                "protocol": "WebSocket required",
                "status": "unavailable"
            }
        
        session_info = enhanced_progress_manager.get_session_info(session_id)
        active_sessions = enhanced_progress_manager.get_active_sessions()
        
        return {
            "endpoint": f"/ws/enhanced-progress/{session_id}",
            "protocol": "WebSocket endpoint (use ws:// or wss://)",
            "session_id": session_id,
            "session_active": session_id in active_sessions,
            "session_info": session_info,
            "connection_stats": enhanced_progress_manager.get_connection_stats(),
            "message": "This is a WebSocket endpoint. Use WebSocket protocol to connect.",
            "websocket_url": f"ws://your-domain/api/v2/ws/enhanced-progress/{session_id}"
        }
    except Exception as e:
        return {
            "error": f"Failed to get session info: {str(e)}",
            "endpoint": f"/ws/enhanced-progress/{session_id}",
            "protocol": "WebSocket required"
        }

@router.websocket("/ws/enhanced-progress/{session_id}")
async def enhanced_progress_websocket(websocket: WebSocket, session_id: str):
    """Enhanced WebSocket endpoint for detailed progress tracking"""
    if not enhanced_progress_manager:
        await websocket.close(code=1000)
        return
    
    await enhanced_progress_manager.connect(websocket, session_id)
    try:
        while True:
            # Keep connection alive and handle client messages
            message = await websocket.receive_text()
            
            # Handle client requests (optional feature)
            try:
                import json
                data = json.loads(message)
                if data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "timestamp": time.time()}))
            except:
                pass
                
    except WebSocketDisconnect:
        enhanced_progress_manager.disconnect(session_id)

@router.post("/process-with-effects")
async def process_with_effects(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    
    # Accept effects from form data (for backward compatibility)
    form_effects: Optional[str] = Form(default=None, description="Effects from form data"),

    effect_params: Optional[str] = Query(default=None, description="JSON string of effect parameters"),
    output_format: str = Query(default="png", description="Output format"),
    quality: int = Query(default=95, description="Quality for lossy formats"),
    use_cache: bool = Query(default=True, description="Use caching"),
    effect: str = Query(default="enhancedblackwhite", description="Single effect to process and return (legacy)"),
    effects: Optional[str] = Query(default=None, description="Multiple effects as comma-separated string"),
    return_all_effects: bool = Query(default=False, description="Return JSON with all effects instead of PNG blob"),
    load_single_effect: bool = Query(default=False, description="Process only the first/primary effect for progressive loading"),
    session_id: Optional[str] = Query(default=None, description="Session ID for progress tracking")
):
    """
    Process image with background removal and multiple effects
    
    Enhanced endpoint that combines background removal with effects processing
    Supports real-time progress tracking and advanced caching
    """
    if not integrated_processor or not enhanced_progress_manager:
        raise HTTPException(status_code=503, detail="Integrated processor not initialized")
    
    start_time = time.time()
    
    # Generate session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())
    
    try:
        # Validate file
        if not file.content_type or not file.content_type.startswith('image/'):
            if enhanced_progress_manager:
                await enhanced_progress_manager.send_error(
                    session_id, "validation", "Invalid file type. Please upload an image."
                )
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        image_data = await file.read()
        
        if len(image_data) > 50 * 1024 * 1024:  # 50MB limit
            if enhanced_progress_manager:
                await enhanced_progress_manager.send_error(
                    session_id, "validation", "File too large. Maximum size is 50MB."
                )
            raise HTTPException(status_code=413, detail="File too large (max 50MB)")
        
        # Detect mobile request and optimize large images
        user_agent = request.headers.get("User-Agent", "")
        is_mobile = "Mobile" in user_agent or "iPhone" in user_agent or "Android" in user_agent
        original_size_mb = len(image_data) / 1024 / 1024
        
        # Check image dimensions before processing
        try:
            img_check = Image.open(BytesIO(image_data))
            width, height = img_check.size
            total_pixels = width * height
            max_pixels = 4096 * 4096  # Maximum 16 megapixels
            
            if total_pixels > max_pixels:
                logger.warning(f"Image too large: {width}x{height} = {total_pixels/1e6:.1f} megapixels")
                if enhanced_progress_manager:
                    await enhanced_progress_manager.send_error(
                        session_id, "validation", 
                        f"Image dimensions too large ({width}x{height}). Maximum supported is 4096x4096."
                    )
                raise HTTPException(status_code=413, detail="Image dimensions too large. Maximum 4096x4096.")
            
            img_check.close()
            del img_check
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Failed to check image dimensions: {e}")
        
        # More aggressive optimization for mobile and large images
        max_image_size_mb = float(os.getenv("MAX_IMAGE_SIZE_MB", "30"))
        mobile_max_size = int(os.getenv("MOBILE_MAX_SIZE", "1280"))
        
        # Optimize if mobile, large image, or PNG format
        is_png = image_data[:8] == b'\x89PNG\r\n\x1a\n'
        should_optimize = is_mobile or original_size_mb > 0.5 or is_png
        
        if should_optimize:
            logger.info(f"Image optimization triggered (mobile={is_mobile}, size={original_size_mb:.1f}MB, png={is_png})")
            try:
                # Clear memory before optimization
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                # Open and optimize image
                img = Image.open(BytesIO(image_data))
                logger.info(f"Original dimensions: {img.size}, format: {img.format}")
                
                # More aggressive size limit for mobile
                max_size = mobile_max_size if is_mobile else 1536
                
                # Optimize using memory-efficient processor
                img_optimized = MemoryOptimizedProcessor.optimize_image_for_processing(img, max_size=max_size)
                
                # Save optimized image with more compression
                buffer = BytesIO()
                
                # For mobile or large images, prefer JPEG to save memory
                if is_mobile and img_optimized.mode == 'RGBA':
                    # Convert RGBA to RGB for JPEG (mobile doesn't need transparency for processing)
                    rgb_image = Image.new('RGB', img_optimized.size, (255, 255, 255))
                    rgb_image.paste(img_optimized, mask=img_optimized.split()[3] if img_optimized.mode == 'RGBA' else None)
                    rgb_image.save(buffer, format='JPEG', quality=80, optimize=True)
                    rgb_image.close()
                elif img_optimized.mode == 'RGBA':
                    # Keep PNG for non-mobile RGBA images
                    img_optimized.save(buffer, format='PNG', compress_level=9, optimize=True)
                else:
                    # Convert to RGB if needed
                    if img_optimized.mode != 'RGB':
                        img_optimized = img_optimized.convert('RGB')
                    img_optimized.save(buffer, format='JPEG', quality=85, optimize=True)
                
                image_data = buffer.getvalue()
                optimized_size_mb = len(image_data) / 1024 / 1024
                logger.info(f"Image optimized: {original_size_mb:.1f}MB -> {optimized_size_mb:.1f}MB")
                
                # Clean up immediately
                img.close()
                img_optimized.close()
                del img, img_optimized
                buffer.close()
                gc.collect()
                
                if enhanced_progress_manager:
                    await enhanced_progress_manager.send_progress(
                        session_id, "optimization", 10, 
                        f"Image optimized for processing ({optimized_size_mb:.1f}MB)"
                    )
            except Exception as e:
                logger.warning(f"Image optimization failed: {e}, proceeding with original")
                gc.collect()
        
        # Use form_effects if provided and URL param effects is not set
        if form_effects and not effects:
            effects = form_effects
            logger.info(f"Using effects from form data: {effects}")
        elif effects:
            logger.info(f"Using effects from URL query param: {effects}")
        
        # Determine effects to process
        if load_single_effect:
            # Progressive loading mode - process only the primary effect first
            primary_effect = effect if effect else "enhancedblackwhite"
            effects_list = [primary_effect]
            logger.info(f"Progressive loading mode: processing only primary effect '{primary_effect}'")
        elif return_all_effects and effects:
            # Multiple effects mode - parse comma-separated effects
            effects_list = [e.strip() for e in effects.split(',') if e.strip()]
            logger.info(f"Processing multiple effects for JSON response: {effects_list}")
            logger.info(f"DEBUG: return_all_effects={return_all_effects}, effects param='{effects}'")
        else:
            # Legacy single effect mode
            effects_list = [effect]
            logger.info(f"Processing single effect for PNG response: {effect}")
            logger.info(f"DEBUG: return_all_effects={return_all_effects}, single effect='{effect}'")
        
        # Parse effect parameters
        parsed_effect_params = {}
        if effect_params:
            try:
                import json
                parsed_effect_params = json.loads(effect_params)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in effect_params")
        
        # Validate effects before processing
        if not integrated_processor:
            raise HTTPException(status_code=503, detail="Integrated processor not initialized")
        
        available_effects = integrated_processor.get_available_effects()
        invalid_effects = [e for e in effects_list if e not in available_effects]
        
        if invalid_effects:
            logger.error(f"Invalid effects requested: {invalid_effects}. Available: {available_effects}")
            if enhanced_progress_manager:
                await enhanced_progress_manager.send_error(
                    session_id, "validation", 
                    f"Invalid effects requested: {invalid_effects}. Available: {available_effects}"
                )
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid effects: {invalid_effects}. Available effects: {available_effects}"
            )
        
        logger.info(f"All effects validated successfully: {effects_list}")
        
        # Create progress callback
        progress_callback = create_progress_callback(enhanced_progress_manager, session_id)
        
        # Choose processor based on conditions
        use_memory_efficient = os.getenv("USE_MEMORY_EFFICIENT_PROCESSOR", "true").lower() == "true"
        
        if use_memory_efficient and (is_mobile or original_size_mb > 2.0 or len(effects_list) > 3):
            # Use memory-efficient processor for mobile, large images, or many effects
            logger.info(f"Using memory-efficient processor (mobile={is_mobile}, size={original_size_mb:.1f}MB, effects={len(effects_list)})")
            memory_processor = MemoryEfficientIntegratedProcessor(
                integrated_processor.model_processor,
                integrated_processor.storage_manager,
                integrated_processor.effects_processor
            )
            result = await memory_processor.process_image_with_effects(
                image_data, effects_list, parsed_effect_params,
                use_cache=use_cache, session_id=session_id,
                progress_callback=progress_callback
            )
        else:
            # Use standard integrated processor
            result = await integrated_processor.process_with_effects(
                image_data=image_data,
                effects=effects_list,
                effect_params=parsed_effect_params,
                use_cache=use_cache,
                progress_callback=progress_callback
            )
        
        # Check if processing actually succeeded
        if not result or not result.get('success'):
            logger.error(f"Processing pipeline failed for session {session_id}")
            if enhanced_progress_manager:
                await enhanced_progress_manager.send_error(
                    session_id, "processing", "Effects processing pipeline failed"
                )
            raise HTTPException(
                status_code=500, 
                detail="Effects processing pipeline failed completely"
            )
        
        # Send completion summary
        await enhanced_progress_manager.send_completion_summary(
            session_id=session_id,
            success=result['success'],
            total_time=result['processing_time']['total'],
            results_summary={
                "effects_processed": len(result['effects_processed']),
                "effects_list": result['effects_processed']
            },
            cache_summary=result['cache_info']
        )
        
        # Return response based on request type
        if return_all_effects or load_single_effect:
            # JSON response with effects (base64 encoded)
            import base64
            effects_data = {}
            failed_effects = []
            
            for effect_name in effects_list:
                if effect_name in result['results'] and result['results'][effect_name]:
                    # Convert bytes to base64 string
                    effect_bytes = result['results'][effect_name]
                    base64_string = base64.b64encode(effect_bytes).decode('utf-8')
                    effects_data[effect_name] = base64_string
                    logger.info(f"Added effect '{effect_name}' to JSON response ({len(effect_bytes)} bytes)")
                else:
                    failed_effects.append(effect_name)
                    logger.error(f"Effect '{effect_name}' failed or returned None - this should not happen in production")
                    # Check if this is a storage error from parameter mismatch
                    if 'storage' in str(result.get('error', '')).lower() or 'cache_key' in str(result.get('error', '')).lower():
                        logger.critical(f"Storage error detected - possible parameter mismatch bug! Error: {result.get('error', 'Unknown')}")
            
            # If no effects succeeded, this is a critical error
            if not effects_data:
                error_detail = f"All effects processing failed. Effects attempted: {effects_list}, all failed: {failed_effects}"
                logger.error(f"CRITICAL: All effects failed for session {session_id}. {error_detail}")
                if enhanced_progress_manager:
                    await enhanced_progress_manager.send_error(
                        session_id, "processing", error_detail
                    )
                raise HTTPException(status_code=500, detail=error_detail)
            
            # If some effects failed, log but don't fail the entire request
            if failed_effects:
                logger.warning(f"Some effects failed for session {session_id}: {failed_effects}. Successful: {list(effects_data.keys())}")
                if enhanced_progress_manager:
                    await enhanced_progress_manager.send_progress(
                        session_id, "warning", 95,
                        f"Some effects failed: {failed_effects}. {len(effects_data)} succeeded."
                    )
            
            json_response = {
                "success": True,
                "effects": effects_data,
                "processing_time": result['processing_time'],
                "cache_info": result['cache_info'],
                "session_id": session_id,
                "total_effects": len(effects_data),
                "failed_effects": failed_effects if failed_effects else None,
                "progressive_mode": load_single_effect  # Flag to indicate this is progressive loading
            }
            
            logger.info(f"Returning JSON response with {len(effects_data)} effects (failed: {len(failed_effects)}, progressive: {load_single_effect})")
            
            # Add response headers to optimize compression
            response_headers = {
                "X-Processing-Time": str(result['processing_time']['total']),
                "X-Cache-Hits": str(result['cache_info']['total_cache_hits']),
                "X-Session-ID": session_id,
                "X-Effects-Count": str(len(effects_data)),
                "X-Compression-Hint": "json-with-base64",  # Hint for client-side optimization
                "Cache-Control": "no-cache"  # Prevent caching of large responses
            }
            
            from fastapi.responses import JSONResponse
            return JSONResponse(content=json_response, headers=response_headers)
            
        else:
            # Legacy PNG response (single effect)
            if effect in result['results'] and result['results'][effect]:
                result_bytes = result['results'][effect]
                
                media_type = f"image/{output_format}"
                
                return Response(
                    content=result_bytes,
                    media_type=media_type,
                    headers={
                        "X-Processing-Time": str(result['processing_time']['total']),
                        "X-Cache-Hits": str(result['cache_info']['total_cache_hits']),
                        "X-Session-ID": session_id,
                        "X-Effect": effect,
                        "X-Available-Effects": ",".join(result['effects_processed'])
                    }
                )
            else:
                error_detail = f"Failed to process effect: {effect}. Effect not found in results or returned None."
                logger.error(f"Single effect processing failed for session {session_id}: {error_detail}")
                if enhanced_progress_manager:
                    await enhanced_progress_manager.send_error(
                        session_id, "processing", error_detail
                    )
                raise HTTPException(status_code=500, detail=error_detail)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing failed for session {session_id}: {e}")
        
        if enhanced_progress_manager:
            await enhanced_progress_manager.send_error(
                session_id, "processing", f"Processing failed: {str(e)}"
            )
        
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@router.post("/process")
async def process(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    effect: str = Query(default="enhancedblackwhite", description="Effect to process"),
    effect_params: Optional[str] = Query(default=None, description="JSON string of effect parameters"),
    output_format: str = Query(default="png", description="Output format"),
    quality: int = Query(default=95, description="Quality for lossy formats"),
    use_cache: bool = Query(default=True, description="Use caching"),
    session_id: Optional[str] = Query(default=None, description="Session ID for progress tracking"),
    thumbnail: Optional[str] = Query(default=None, description="Request thumbnail version")
):
    """
    Legacy process endpoint for backward compatibility
    Redirects to process-with-effects with single effect processing
    """
    # This endpoint provides backward compatibility for frontend code
    # that still calls /api/v2/process instead of /api/v2/process-with-effects
    
    return await process_with_effects(
        request=request,
        background_tasks=background_tasks,
        file=file,
        effect_params=effect_params,
        output_format=output_format,
        quality=quality,
        use_cache=use_cache,
        effect=effect,
        effects=None,  # Single effect mode
        return_all_effects=False,  # Return PNG blob for backward compatibility
        session_id=session_id
    )

@router.get("/download-effect/{session_id}/{effect_name}")
async def download_effect(session_id: str, effect_name: str, output_format: str = "png"):
    """
    Download specific effect result from a previous processing session
    Enables effect switching without reprocessing
    """
    # This would require session result caching - simplified for now
    raise HTTPException(status_code=501, detail="Effect download endpoint not yet implemented - use process-with-effects")

@router.post("/switch-effect")
async def switch_effect(
    session_id: str,
    request: EffectSwitchRequest
):
    """
    Switch to a different effect on an already processed image
    Requires the background-removed image to be cached
    """
    # This would enable instant effect switching - simplified for now
    raise HTTPException(status_code=501, detail="Effect switching endpoint not yet implemented")

@router.get("/stats")
async def get_processing_stats():
    """Get detailed processing statistics"""
    if not integrated_processor:
        raise HTTPException(status_code=503, detail="Integrated processor not initialized")
    
    stats = integrated_processor.get_processing_stats()
    
    # Add progress manager stats
    if enhanced_progress_manager:
        progress_stats = enhanced_progress_manager.get_connection_stats()
        stats["progress_tracking"] = progress_stats
    
    return stats

@router.post("/headshot")
async def create_perkie_print_headshot(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Query(default="png", description="Output format (png recommended)"),
    quality: int = Query(default=95, description="Quality for lossy formats"),
    use_cache: bool = Query(default=True, description="Use caching"),
    session_id: Optional[str] = Query(default=None, description="Session ID for progress tracking")
):
    """
    Generate professional Perkie Print headshot

    This endpoint creates the signature Perkie Print style:
    - Gallery-quality black & white conversion optimized for pets
    - Professional headshot composition (4:5 portrait ratio)
    - Transparent background with soft neck fade
    - >95% pet likeness (professional photography standard)
    - Museum-quality output suitable for print-on-demand

    Returns:
        PNG image with BGRA channels (black & white + alpha)
    """
    if not integrated_processor or not enhanced_progress_manager:
        raise HTTPException(status_code=503, detail="Integrated processor not initialized")

    start_time = time.time()

    # Generate session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())

    try:
        # Validate file
        if not file.content_type or not file.content_type.startswith('image/'):
            if enhanced_progress_manager:
                await enhanced_progress_manager.send_error(
                    session_id, "validation", "Invalid file type. Please upload an image."
                )
            raise HTTPException(status_code=400, detail="File must be an image")

        # Read image data
        image_data = await file.read()

        if len(image_data) > 50 * 1024 * 1024:  # 50MB limit
            if enhanced_progress_manager:
                await enhanced_progress_manager.send_error(
                    session_id, "validation", "File too large. Maximum size is 50MB."
                )
            raise HTTPException(status_code=413, detail="File too large (max 50MB)")

        # Validate image dimensions
        try:
            img_check = Image.open(BytesIO(image_data))
            width, height = img_check.size
            total_pixels = width * height
            max_pixels = 4096 * 4096  # Maximum 16 megapixels

            if total_pixels > max_pixels:
                logger.warning(f"Image too large: {width}x{height}")
                if enhanced_progress_manager:
                    await enhanced_progress_manager.send_error(
                        session_id, "validation",
                        f"Image dimensions too large ({width}x{height}). Maximum 4096x4096."
                    )
                raise HTTPException(status_code=413, detail="Image dimensions too large")

            img_check.close()
            del img_check
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to validate image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Send initial progress
        if enhanced_progress_manager:
            await enhanced_progress_manager.send_progress(
                session_id,
                stage="initialization",
                progress=0.0,
                message="Starting Perkie Print headshot generation..."
            )

        # Process with Perkie Print headshot effect
        # This uses InSPyReNet matting + professional B&W pipeline
        logger.info(f"Processing Perkie Print headshot for session {session_id}")

        # Create progress callback
        progress_callback = create_progress_callback(enhanced_progress_manager, session_id)

        # Process with integrated processor
        # Force single effect: perkie_print_headshot
        result = await integrated_processor.process_with_effects(
            image_data,
            effects=["perkie_print_headshot"],  # Our new effect
            effect_params=None,
            use_cache=use_cache,
            progress_callback=progress_callback
        )

        # Extract the result from nested structure
        # integrated_processor returns: {'success': bool, 'results': {effect_name: bytes}}
        if isinstance(result, dict):
            if not result.get('success', False):
                failed = result.get('failed_effects', [])
                raise HTTPException(
                    status_code=500,
                    detail=f"Processing failed for effects: {', '.join(failed)}"
                )

            results_dict = result.get('results', {})
            if "perkie_print_headshot" in results_dict:
                output_image = results_dict["perkie_print_headshot"]
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Effect result not found. Available: {list(results_dict.keys())}"
                )
        elif isinstance(result, bytes):
            output_image = result
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected processing result type: {type(result)}"
            )

        # Send completion progress
        if enhanced_progress_manager:
            await enhanced_progress_manager.send_progress(
                session_id,
                stage="complete",
                progress=1.0,
                message="Perkie Print headshot generated successfully!"
            )

        processing_time = time.time() - start_time
        logger.info(f"Perkie Print headshot generated in {processing_time:.2f}s for session {session_id}")

        # Get confidence score from processor if available
        confidence_score = None
        try:
            # Access the effect processor to get confidence score
            if hasattr(integrated_processor, 'effects_processor'):
                effects_proc = integrated_processor.effects_processor
                if hasattr(effects_proc, 'effects') and 'perkie_print_headshot' in effects_proc.effects:
                    headshot_effect = effects_proc.effects['perkie_print_headshot']
                    if hasattr(headshot_effect, '_last_crop_confidence'):
                        confidence_score = headshot_effect._last_crop_confidence
        except Exception as e:
            logger.debug(f"Could not retrieve confidence score: {e}")

        # Build response headers
        response_headers = {
            "X-Processing-Time": f"{processing_time:.2f}",
            "X-Session-ID": session_id,
            "X-Effect-Name": "perkie_print_headshot",
            "Cache-Control": "public, max-age=86400"  # Cache for 24 hours
        }

        # Add confidence score if available
        if confidence_score is not None:
            response_headers["X-Crop-Confidence"] = f"{confidence_score:.2f}"
            confidence_level = "high" if confidence_score > 0.8 else "medium" if confidence_score > 0.6 else "low"
            response_headers["X-Crop-Confidence-Level"] = confidence_level
            logger.info(f"Crop confidence: {confidence_score:.2f} ({confidence_level})")

        # Return image
        return Response(
            content=output_image,
            media_type=f"image/{output_format}",
            headers=response_headers
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate Perkie Print headshot: {e}", exc_info=True)
        if enhanced_progress_manager:
            await enhanced_progress_manager.send_error(
                session_id, "processing",
                f"Failed to generate headshot: {str(e)}"
            )
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")
    finally:
        # Cleanup
        if 'img_check' in locals():
            try:
                del img_check
            except:
                pass
        gc.collect()

@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check for v2 API"""
    health_info = {
        "status": "healthy",
        "timestamp": time.time(),
        "components": {}
    }
    
    # Check integrated processor
    if integrated_processor:
        try:
            processor_stats = integrated_processor.get_processing_stats()
            health_info["components"]["integrated_processor"] = {
                "status": "healthy",
                "total_requests": processor_stats.get("total_requests", 0),
                "available_effects": len(processor_stats.get("available_effects", []))
            }
        except Exception as e:
            health_info["components"]["integrated_processor"] = {
                "status": "error",
                "error": str(e)
            }
    else:
        health_info["components"]["integrated_processor"] = {
            "status": "not_initialized"
        }
    
    # Check progress manager
    if enhanced_progress_manager:
        try:
            progress_stats = enhanced_progress_manager.get_connection_stats()
            health_info["components"]["progress_manager"] = {
                "status": "healthy",
                "active_connections": progress_stats["active_connections"]
            }
        except Exception as e:
            health_info["components"]["progress_manager"] = {
                "status": "error",
                "error": str(e)
            }
    else:
        health_info["components"]["progress_manager"] = {
            "status": "not_initialized"
        }
    
    # Overall status
    component_statuses = [comp.get("status") for comp in health_info["components"].values()]
    if any(status == "error" for status in component_statuses):
        health_info["status"] = "degraded"
    elif any(status == "not_initialized" for status in component_statuses):
        health_info["status"] = "initializing"
    
    return health_info

# DEPRECATED: Server-side share-image endpoint - replaced with client-side solution (2025-08-28)
# Keeping code commented for 30-day rollback period before deletion
# See .claude/tasks/context_session_001.md for refactoring rationale
#
# @router.post("/share-image")
# async def upload_share_image(
#     file: UploadFile = File(...),
#     platform: str = Form(...),
#     effect_type: str = Form(default="enhancedblackwhite")
# ):
#     """
#     Upload watermarked image for social sharing with temporary public URL.
#     Images are automatically deleted after 24 hours.
#     
#     Args:
#         file: Watermarked image file (JPEG/PNG, max 5MB)
#         platform: Social platform (facebook, twitter, pinterest, etc.)
#         effect_type: Effect type for tracking
#         
#     Returns:
#         Public URL for sharing on social platforms
#     """
#     start_time = time.time()
#     
#     # Validate file size (max 5MB for sharing)
#     if file.size > 5_000_000:
#         raise HTTPException(400, "File too large for sharing (max 5MB)")
#     
#     # Validate file type
#     if file.content_type not in ["image/jpeg", "image/png"]:
#         raise HTTPException(400, "Invalid file type. Only JPEG/PNG supported")
#     
#     try:
#         # Read file data
#         image_data = await file.read()
#         
#         # Verify it's a valid image and has reasonable dimensions
#         img = Image.open(BytesIO(image_data))
#         if img.width > 2000 or img.height > 2000:
#             raise HTTPException(400, "Image dimensions too large (max 2000px)")
#         
#         # Generate unique filename for sharing
#         share_id = str(uuid.uuid4())
#         timestamp = int(time.time())
#         filename = f"shares/{platform}/{timestamp}_{share_id}.jpg"
#         
#         # Initialize storage manager if needed
#         storage_manager = CloudStorageManager(
#             bucket_name=os.getenv("GCS_BUCKET_NAME", "perkie-temporary-shares"),
#             cache_ttl=86400  # 24 hour TTL
#         )
#         
#         if not storage_manager.enabled:
#             raise HTTPException(503, "Image sharing service temporarily unavailable")
#         
#         # Upload to GCS with public access and TTL
#         blob = storage_manager.bucket.blob(filename)
#         blob.upload_from_string(
#             image_data,
#             content_type="image/jpeg"
#         )
#         
#         # Make blob publicly accessible
#         blob.make_public()
#         
#         # Set lifecycle metadata for auto-deletion
#         blob.metadata = {
#             "expires": str(timestamp + 86400),  # 24 hours from now
#             "platform": platform,
#             "effect_type": effect_type
#         }
#         blob.patch()
#         
#         # Get public URL
#         public_url = blob.public_url
#         
#         # Log sharing event for analytics
#         logger.info(f"Share image uploaded: {platform} - {effect_type} - {share_id}")
#         
#         processing_time = time.time() - start_time
#         
#         return {
#             "url": public_url,
#             "expires_at": timestamp + 86400,
#             "share_id": share_id,
#             "processing_time": processing_time
#         }
#         
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Failed to upload share image: {e}")
#         raise HTTPException(500, f"Failed to prepare image for sharing: {str(e)}")
#     finally:
#         # Clean up
#         await file.close() 