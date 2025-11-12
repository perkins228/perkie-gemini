"""
Minimal Test Endpoints for Step-by-Step Image Processing Debug
Works with the existing InSPyReNet API structure
"""

import uuid
import time
import logging
import json
import os
from typing import Optional, Dict, Any, List
from io import BytesIO

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import Response, JSONResponse, FileResponse
from PIL import Image
import tempfile

from inspirenet_model import InSPyReNetProcessor
from effects.effects_processor import EffectsProcessor
from storage import CloudStorageManager

logger = logging.getLogger(__name__)

# Test router
test_router = APIRouter(prefix="/test", tags=["test"])

# Global instances (will be initialized by main.py)
inspirenet_processor: Optional[InSPyReNetProcessor] = None
effects_processor: Optional[EffectsProcessor] = None
temp_storage: Dict[str, Dict[str, bytes]] = {}  # Simple in-memory storage for test sessions

def initialize_test_endpoints():
    """Initialize test endpoint components"""
    global inspirenet_processor, effects_processor
    
    inspirenet_processor = InSPyReNetProcessor()
    effects_processor = EffectsProcessor(gpu_enabled=True)
    
    logger.info("Test endpoints initialized")

@test_router.get("/health")
async def test_health():
    """Test endpoint health check"""
    return {
        "success": True,
        "message": "Test endpoints are running",
        "timestamp": time.time(),
        "components": {
            "inspirenet_processor": inspirenet_processor is not None,
            "effects_processor": effects_processor is not None,
            "gpu_available": inspirenet_processor.device != "cpu" if inspirenet_processor else False
        }
    }

@test_router.post("/process-step-by-step")
async def process_step_by_step(
    file: UploadFile = File(...),
    effects: str = Query(default="enhancedblackwhite,popart,eightbit", description="Comma-separated effects"),
    save_intermediates: bool = Query(default=True, description="Save intermediate files")
):
    """
    Process image step by step with detailed logging and intermediate file saving
    """
    if not inspirenet_processor or not effects_processor:
        raise HTTPException(status_code=500, detail="Test endpoints not initialized")
    
    session_id = str(uuid.uuid4())
    results = {
        "session_id": session_id,
        "original_image": {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": 0
        },
        "steps": [],
        "total_processing_time": 0,
        "errors": []
    }
    
    start_time = time.time()
    
    try:
        # Read image data
        image_data = await file.read()
        results["original_image"]["size"] = len(image_data)
        
        # Parse effects list
        effect_list = [e.strip() for e in effects.split(",") if e.strip()]
        
        logger.info(f"[{session_id}] Starting step-by-step processing")
        logger.info(f"[{session_id}] Image: {file.filename} ({len(image_data)} bytes)")
        logger.info(f"[{session_id}] Effects: {effect_list}")
        
        # Step 1: Load and validate image
        step_start = time.time()
        try:
            original_image = Image.open(BytesIO(image_data))
            if original_image.mode not in ['RGB', 'RGBA']:
                original_image = original_image.convert('RGB')
            
            step_result = {
                "step": "image_loading",
                "success": True,
                "processing_time": (time.time() - step_start) * 1000,
                "details": {
                    "mode": original_image.mode,
                    "size": original_image.size,
                    "format": original_image.format
                }
            }
            results["steps"].append(step_result)
            
            # Save original if requested
            if save_intermediates:
                if session_id not in temp_storage:
                    temp_storage[session_id] = {}
                
                original_bytes = BytesIO()
                original_image.save(original_bytes, format='PNG')
                temp_storage[session_id]["00_original.png"] = original_bytes.getvalue()
            
        except Exception as e:
            step_result = {
                "step": "image_loading",
                "success": False,
                "processing_time": (time.time() - step_start) * 1000,
                "error": str(e)
            }
            results["steps"].append(step_result)
            results["errors"].append(f"Image loading failed: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")
        
        # Step 2: Background Removal
        step_start = time.time()
        try:
            logger.info(f"[{session_id}] Starting background removal...")
            
            # Process background removal
            bg_removed_image = await _remove_background_async(original_image)
            
            step_result = {
                "step": "background_removal",
                "success": True,
                "processing_time": (time.time() - step_start) * 1000,
                "details": {
                    "input_size": original_image.size,
                    "output_size": bg_removed_image.size,
                    "has_transparency": bg_removed_image.mode == 'RGBA'
                }
            }
            results["steps"].append(step_result)
            
            # Save background-removed image
            if save_intermediates:
                bg_bytes = BytesIO()
                bg_removed_image.save(bg_bytes, format='PNG')
                temp_storage[session_id]["01_bg_removed.png"] = bg_bytes.getvalue()
            
        except Exception as e:
            step_result = {
                "step": "background_removal",
                "success": False,
                "processing_time": (time.time() - step_start) * 1000,
                "error": str(e)
            }
            results["steps"].append(step_result)
            results["errors"].append(f"Background removal failed: {str(e)}")
            # Continue with original image for effects testing
            bg_removed_image = original_image
        
        # Step 3: Apply Effects
        for i, effect_name in enumerate(effect_list):
            step_start = time.time()
            try:
                logger.info(f"[{session_id}] Applying effect: {effect_name}")
                
                # Apply effect to background-removed image
                effect_result = await _apply_effect_async(bg_removed_image, effect_name)
                
                step_result = {
                    "step": f"effect_{effect_name}",
                    "success": True,
                    "processing_time": (time.time() - step_start) * 1000,
                    "details": {
                        "effect_name": effect_name,
                        "input_size": bg_removed_image.size,
                        "output_size": effect_result.size if hasattr(effect_result, 'size') else None
                    }
                }
                results["steps"].append(step_result)
                
                # Save effect result
                if save_intermediates:
                    effect_bytes = BytesIO()
                    if isinstance(effect_result, Image.Image):
                        effect_result.save(effect_bytes, format='PNG')
                    else:
                        # If it's already bytes
                        effect_bytes.write(effect_result)
                        effect_bytes.seek(0)
                    
                    temp_storage[session_id][f"02_{effect_name}.png"] = effect_bytes.getvalue()
                
            except Exception as e:
                step_result = {
                    "step": f"effect_{effect_name}",
                    "success": False,
                    "processing_time": (time.time() - step_start) * 1000,
                    "error": str(e)
                }
                results["steps"].append(step_result)
                results["errors"].append(f"Effect {effect_name} failed: {str(e)}")
        
        results["total_processing_time"] = (time.time() - start_time) * 1000
        
        logger.info(f"[{session_id}] Processing complete in {results['total_processing_time']:.2f}ms")
        
        return JSONResponse({
            "success": True,
            "results": results,
            "available_files": list(temp_storage.get(session_id, {}).keys()) if save_intermediates else [],
            "download_base_url": f"/test/download/{session_id}"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{session_id}] Unexpected error: {str(e)}")
        results["errors"].append(f"Unexpected error: {str(e)}")
        results["total_processing_time"] = (time.time() - start_time) * 1000
        
        return JSONResponse({
            "success": False,
            "results": results,
            "error": str(e)
        }, status_code=500)

@test_router.get("/session/{session_id}")
async def get_session_files(session_id: str):
    """Get list of files for a test session"""
    if session_id not in temp_storage:
        raise HTTPException(status_code=404, detail="Session not found")
    
    files = []
    for filename, data in temp_storage[session_id].items():
        files.append({
            "filename": filename,
            "size": len(data),
            "download_url": f"/test/download/{session_id}/{filename}"
        })
    
    return {
        "session_id": session_id,
        "files": files,
        "total_files": len(files)
    }

@test_router.get("/download/{session_id}/{filename}")
async def download_file(session_id: str, filename: str):
    """Download a specific file from a test session"""
    if session_id not in temp_storage:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if filename not in temp_storage[session_id]:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_data = temp_storage[session_id][filename]
    
    return Response(
        content=file_data,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@test_router.post("/cleanup")
async def cleanup_sessions():
    """Clean up all test sessions"""
    global temp_storage
    session_count = len(temp_storage)
    temp_storage.clear()
    
    return {
        "success": True,
        "message": f"Cleaned up {session_count} sessions",
        "remaining_sessions": 0
    }

@test_router.get("/available-effects")
async def get_available_effects():
    """Get list of available effects for testing"""
    if not effects_processor:
        raise HTTPException(status_code=500, detail="Effects processor not initialized")
    
    available_effects = effects_processor.get_available_effects()
    
    return {
        "effects": available_effects,
        "count": len(available_effects),
        "default_test_effects": ["enhancedblackwhite", "popart", "eightbit"]
    }

# Helper functions
async def _remove_background_async(image: Image.Image) -> Image.Image:
    """Async wrapper for background removal"""
    import asyncio
    
    def remove_bg_sync():
        return inspirenet_processor.remove_background(image)
    
    return await asyncio.get_event_loop().run_in_executor(None, remove_bg_sync)

async def _apply_effect_async(image: Image.Image, effect_name: str) -> Image.Image:
    """Async wrapper for effect application"""
    import asyncio
    
    def apply_effect_sync():
        # Convert PIL to numpy array (cv2 format)
        cv2_image = effects_processor.convert_pil_to_cv2(image)
        
        # Process the effect
        result_cv2 = effects_processor.process_single_effect(cv2_image, effect_name)
        
        # Convert back to PIL
        return effects_processor.convert_cv2_to_pil(result_cv2)
    
    return await asyncio.get_event_loop().run_in_executor(None, apply_effect_sync) 