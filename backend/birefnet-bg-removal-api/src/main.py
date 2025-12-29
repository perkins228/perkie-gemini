"""
BiRefNet Background Removal API

High-quality background removal service using BiRefNet.
Optimized for pet photos with fine fur/hair detail preservation.

Endpoints:
- POST /remove-background: Remove background from image
- POST /remove-background-batch: Batch background removal
- POST /apply-effect: Apply effect to image (color, blackwhite, etc.)
- POST /process: Combined bg removal + single effect in one call
- POST /process-with-effects: Combined bg removal + multiple effects (returns JSON with base64)
- POST /api/v2/process-with-effects: InSPyReNet-compatible endpoint
- POST /warmup: Warmup the model
- GET /health: Health check
- GET /model-info: Model information
- GET /effects: List available effects

Supported Effects:
- color: Original color image with background removed (no processing)
- blackwhite: Enhanced B&W with Tri-X film simulation
"""

import os
import io
import time
import logging
import hashlib
import base64
from contextlib import asynccontextmanager
from typing import Optional, Tuple

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from birefnet_processor import get_processor, BiRefNetProcessor, log_gpu_diagnostics
from effects import TriXPipeline, apply_blackwhite_effect

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment configuration
ENABLE_WARMUP_ON_STARTUP = os.getenv("ENABLE_WARMUP_ON_STARTUP", "true").lower() == "true"
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "30"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Effect processing resolution cap (to avoid slow effects on full-res images)
# Reduced from 2048 to 1024 for 70% faster B&W processing (33s -> 8-10s)
# Quality still excellent for mobile (70% of users), web preview, and prints
EFFECT_MAX_DIMENSION = int(os.getenv("EFFECT_MAX_DIMENSION", "1024"))


def resize_for_effect_processing(image: Image.Image, max_dimension: int = EFFECT_MAX_DIMENSION) -> Tuple[Image.Image, bool, Tuple[int, int]]:
    """
    Resize image to a manageable size for effect processing.

    This optimization prevents effects (like Tri-X B&W) from processing
    full-resolution images (e.g., 12MP = 37+ seconds) when they can process
    at a capped resolution much faster (e.g., 4MP = ~8 seconds).

    Args:
        image: Input PIL Image
        max_dimension: Maximum dimension for effect processing

    Returns:
        (resized_image, was_resized, original_size)
    """
    original_size = image.size
    max_dim = max(original_size)

    if max_dim <= max_dimension:
        return image, False, original_size

    scale = max_dimension / max_dim
    new_size = (
        int(original_size[0] * scale),
        int(original_size[1] * scale)
    )

    # Use LANCZOS for high-quality downscaling
    resized = image.resize(new_size, Image.Resampling.LANCZOS)

    logger.info(f"Resized for effect processing: {original_size} -> {new_size} "
               f"(scale: {scale:.2f}, ~{(new_size[0]*new_size[1]/1_000_000):.1f}MP)")

    return resized, True, original_size


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("BiRefNet API starting up...")

    # Run GPU diagnostics FIRST - before any model loading
    logger.info("="*60)
    logger.info("GPU/ONNX DIAGNOSTICS - Running at startup")
    logger.info("="*60)
    try:
        diagnostics = log_gpu_diagnostics()
        logger.info(f"Diagnostics result: {diagnostics}")
    except Exception as e:
        logger.error(f"GPU diagnostics failed: {e}")
    logger.info("="*60)

    # Warmup on startup if enabled
    if ENABLE_WARMUP_ON_STARTUP:
        try:
            processor = get_processor()
            warmup_result = processor.warmup()
            logger.info(f"Startup warmup: {warmup_result['status']}")
        except Exception as e:
            logger.warning(f"Startup warmup failed (non-fatal): {e}")

    yield

    logger.info("BiRefNet API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="BiRefNet Background Removal API",
    description="High-quality background removal using BiRefNet",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Processing-Time-Ms", "X-Model-Variant"]
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    processor = get_processor()

    return {
        "status": "healthy",
        "model_ready": processor.is_model_ready(),
        "model_variant": processor.model_variant,
        "timestamp": time.time()
    }


@app.get("/model-info")
async def model_info():
    """Get model information"""
    processor = get_processor()
    return processor.get_model_info()


@app.post("/warmup")
async def warmup():
    """Warmup the model for faster first inference"""
    processor = get_processor()
    result = processor.warmup()

    status_code = 200 if result["status"] == "success" else 503
    return JSONResponse(content=result, status_code=status_code)


@app.post("/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    alpha_matting: bool = Query(False, description="Enable alpha matting for smoother edges"),
    output_format: str = Query("png", enum=["png", "webp"], description="Output format"),
    quality: int = Query(95, ge=1, le=100, description="Output quality (for WebP)")
):
    """
    Remove background from an image using BiRefNet.

    Args:
        file: Image file (JPEG, PNG, WebP)
        alpha_matting: Enable alpha matting for smoother edges
        output_format: Output format (png or webp)
        quality: Output quality for WebP (1-100)

    Returns:
        Processed image with transparent background
    """
    start_time = time.time()

    # Validate file
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read and validate file size
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_IMAGE_SIZE_MB}MB"
        )

    logger.info(f"Processing image: {file.filename} ({file_size_mb:.2f}MB)")

    try:
        # Load image
        image = Image.open(io.BytesIO(content))

        # Get processor and process
        processor = get_processor()
        result = processor.remove_background(
            image,
            alpha_matting=alpha_matting
        )

        # Convert to output format
        output_buffer = io.BytesIO()

        if output_format == "webp":
            result.image.save(output_buffer, format="WEBP", quality=quality)
            content_type = "image/webp"
        else:
            result.image.save(output_buffer, format="PNG", optimize=False)
            content_type = "image/png"

        output_buffer.seek(0)
        output_bytes = output_buffer.read()

        total_time_ms = (time.time() - start_time) * 1000

        logger.info(f"Processed {file.filename}: {result.inference_time_ms:.0f}ms inference, "
                   f"{total_time_ms:.0f}ms total")

        return Response(
            content=output_bytes,
            media_type=content_type,
            headers={
                "X-Processing-Time-Ms": str(int(result.inference_time_ms)),
                "X-Total-Time-Ms": str(int(total_time_ms)),
                "X-Model-Variant": result.model_variant,
                "X-Input-Size": f"{result.input_size[0]}x{result.input_size[1]}",
                "X-Output-Size": f"{result.output_size[0]}x{result.output_size[1]}"
            }
        )

    except Exception as e:
        logger.error(f"Processing failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/remove-background-batch")
async def remove_background_batch(
    files: list[UploadFile] = File(...),
    alpha_matting: bool = Query(False),
    output_format: str = Query("png", enum=["png", "webp"])
):
    """
    Remove background from multiple images.

    Returns JSON with base64-encoded results.
    """
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images per batch")

    processor = get_processor()
    results = []

    for file in files:
        try:
            content = await file.read()
            image = Image.open(io.BytesIO(content))

            result = processor.remove_background(image, alpha_matting=alpha_matting)

            # Convert to base64
            output_buffer = io.BytesIO()
            if output_format == "webp":
                result.image.save(output_buffer, format="WEBP", quality=95)
            else:
                result.image.save(output_buffer, format="PNG")

            output_buffer.seek(0)
            b64_data = base64.b64encode(output_buffer.read()).decode()

            results.append({
                "filename": file.filename,
                "success": True,
                "data": f"data:image/{output_format};base64,{b64_data}",
                "inference_time_ms": result.inference_time_ms,
                "size": f"{result.output_size[0]}x{result.output_size[1]}"
            })

        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })

    return {"results": results}


# =============================================================================
# EFFECTS ENDPOINTS
# =============================================================================

# Available effects registry
AVAILABLE_EFFECTS = {
    "color": {
        "name": "Original Color",
        "description": "Original color image with background removed (no additional processing)",
        "parameters": {}
    },
    "blackwhite": {
        "name": "Enhanced Black & White",
        "description": "Tri-X film simulation with adaptive sharpening and halation",
        "parameters": {
            "contrast": {"type": "float", "default": 1.12, "min": 0.8, "max": 1.5},
            "edge_strength": {"type": "float", "default": 0.9, "min": 0.0, "max": 1.5},
            "halation": {"type": "float", "default": 0.5, "min": 0.0, "max": 1.0},
            "grain": {"type": "float", "default": 0.08, "min": 0.0, "max": 0.2}
        }
    },
    # Alias for frontend compatibility (InSPyReNet uses 'enhancedblackwhite')
    "enhancedblackwhite": {
        "name": "Enhanced Black & White",
        "description": "Alias for 'blackwhite' - Tri-X film simulation",
        "parameters": {
            "contrast": {"type": "float", "default": 1.12, "min": 0.8, "max": 1.5},
            "edge_strength": {"type": "float", "default": 0.9, "min": 0.0, "max": 1.5},
            "halation": {"type": "float", "default": 0.5, "min": 0.0, "max": 1.0},
            "grain": {"type": "float", "default": 0.08, "min": 0.0, "max": 0.2}
        },
        "alias_of": "blackwhite"
    }
}

# Effect name normalization (aliases)
EFFECT_ALIASES = {
    "enhancedblackwhite": "blackwhite"
}

def normalize_effect_name(effect_name: str) -> str:
    """Normalize effect name, resolving aliases"""
    return EFFECT_ALIASES.get(effect_name, effect_name)


@app.get("/effects")
async def list_effects():
    """List available effects and their parameters"""
    return {
        "effects": AVAILABLE_EFFECTS,
        "count": len(AVAILABLE_EFFECTS)
    }


@app.post("/apply-effect")
async def apply_effect(
    file: UploadFile = File(...),
    effect: str = Query("blackwhite", description="Effect to apply"),
    contrast: float = Query(1.12, ge=0.8, le=1.5, description="Contrast boost"),
    edge_strength: float = Query(0.9, ge=0.0, le=1.5, description="Edge sharpening"),
    halation: float = Query(0.5, ge=0.0, le=1.0, description="Glow/halation"),
    grain: float = Query(0.08, ge=0.0, le=0.2, description="Film grain"),
    output_format: str = Query("png", enum=["png", "webp", "jpeg"], description="Output format"),
    quality: int = Query(95, ge=1, le=100, description="Output quality")
):
    """
    Apply an effect to an image.

    Currently supported effects:
    - blackwhite: Enhanced Black & White (Tri-X film simulation)

    Args:
        file: Image file (JPEG, PNG, WebP) - can be RGB or RGBA
        effect: Effect name to apply
        contrast: Contrast boost factor (blackwhite only)
        edge_strength: Edge sharpening strength (blackwhite only)
        halation: Glow/halation strength (blackwhite only)
        grain: Film grain strength (blackwhite only)
        output_format: Output format (png, webp, or jpeg)
        quality: Output quality (for webp/jpeg)

    Returns:
        Processed image with effect applied
    """
    start_time = time.time()

    # Validate effect
    if effect not in AVAILABLE_EFFECTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown effect: {effect}. Available: {list(AVAILABLE_EFFECTS.keys())}"
        )

    # Validate file
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_IMAGE_SIZE_MB}MB"
        )

    logger.info(f"Applying {effect} to: {file.filename} ({file_size_mb:.2f}MB)")

    try:
        # Load image
        image = Image.open(io.BytesIO(content))
        original_mode = image.mode

        # Normalize effect name (handle aliases)
        normalized_effect = normalize_effect_name(effect)

        # Apply effect
        if normalized_effect == "color":
            # Color effect - return original (no processing)
            result_image = image.copy()
        elif normalized_effect == "blackwhite":
            result_image = apply_blackwhite_effect(
                image,
                contrast=contrast,
                edge_strength=edge_strength,
                halation=halation,
                grain=grain
            )
        else:
            raise HTTPException(status_code=400, detail=f"Effect '{effect}' not implemented")

        # Convert to output format
        output_buffer = io.BytesIO()

        if output_format == "webp":
            # WebP supports transparency
            result_image.save(output_buffer, format="WEBP", quality=quality)
            content_type = "image/webp"
        elif output_format == "jpeg":
            # JPEG doesn't support transparency - convert to RGB with white bg
            if result_image.mode == 'RGBA':
                # Create white background
                bg = Image.new('RGB', result_image.size, (255, 255, 255))
                bg.paste(result_image, mask=result_image.split()[3])
                result_image = bg
            elif result_image.mode == 'LA':
                result_image = result_image.convert('L')
            result_image.save(output_buffer, format="JPEG", quality=quality)
            content_type = "image/jpeg"
        else:  # png
            result_image.save(output_buffer, format="PNG", optimize=False)
            content_type = "image/png"

        output_buffer.seek(0)
        output_bytes = output_buffer.read()

        total_time_ms = (time.time() - start_time) * 1000

        logger.info(f"Applied {effect} to {file.filename}: {total_time_ms:.0f}ms")

        return Response(
            content=output_bytes,
            media_type=content_type,
            headers={
                "X-Processing-Time-Ms": str(int(total_time_ms)),
                "X-Effect": effect,
                "X-Input-Size": f"{image.size[0]}x{image.size[1]}",
                "X-Output-Size": f"{result_image.size[0]}x{result_image.size[1]}",
                "X-Output-Mode": result_image.mode
            }
        )

    except Exception as e:
        logger.error(f"Effect processing failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process")
async def process_with_effect(
    file: UploadFile = File(...),
    effect: str = Query("blackwhite", description="Effect to apply after bg removal"),
    alpha_matting: bool = Query(False, description="Enable alpha matting"),
    contrast: float = Query(1.12, ge=0.8, le=1.5, description="Contrast boost"),
    edge_strength: float = Query(0.9, ge=0.0, le=1.5, description="Edge sharpening"),
    halation: float = Query(0.5, ge=0.0, le=1.0, description="Glow/halation"),
    grain: float = Query(0.08, ge=0.0, le=0.2, description="Film grain"),
    output_format: str = Query("png", enum=["png", "webp", "jpeg"], description="Output format"),
    quality: int = Query(95, ge=1, le=100, description="Output quality")
):
    """
    Combined endpoint: Remove background AND apply effect in one call.

    This is more efficient than calling /remove-background then /apply-effect
    because it avoids encoding/decoding the intermediate image.

    Args:
        file: Image file (JPEG, PNG, WebP)
        effect: Effect to apply after background removal
        alpha_matting: Enable alpha matting for smoother edges
        contrast: Contrast boost factor (blackwhite only)
        edge_strength: Edge sharpening strength (blackwhite only)
        halation: Glow/halation strength (blackwhite only)
        grain: Film grain strength (blackwhite only)
        output_format: Output format (png, webp, or jpeg)
        quality: Output quality (for webp/jpeg)

    Returns:
        Processed image with background removed and effect applied
    """
    start_time = time.time()

    # Validate effect
    if effect not in AVAILABLE_EFFECTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown effect: {effect}. Available: {list(AVAILABLE_EFFECTS.keys())}"
        )

    # Validate file
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_IMAGE_SIZE_MB}MB"
        )

    logger.info(f"Processing with {effect}: {file.filename} ({file_size_mb:.2f}MB)")

    try:
        # Load image
        image = Image.open(io.BytesIO(content))

        # Step 1: Remove background
        processor = get_processor()
        bg_result = processor.remove_background(image, alpha_matting=alpha_matting)
        bg_removed = bg_result.image

        bg_time_ms = bg_result.inference_time_ms

        # Step 2: Apply effect
        effect_start = time.time()

        # Normalize effect name (handle aliases)
        normalized_effect = normalize_effect_name(effect)

        if normalized_effect == "color":
            # Color effect - return bg-removed image (no additional processing)
            result_image = bg_removed.copy()
        elif normalized_effect == "blackwhite":
            # Resize for optimized effect processing
            bg_for_effect, was_resized, original_size = resize_for_effect_processing(bg_removed)

            result_image = apply_blackwhite_effect(
                bg_for_effect,
                contrast=contrast,
                edge_strength=edge_strength,
                halation=halation,
                grain=grain
            )

            # Upscale back to original resolution if we downscaled
            if was_resized:
                result_image = result_image.resize(original_size, Image.Resampling.LANCZOS)
        else:
            raise HTTPException(status_code=400, detail=f"Effect '{effect}' not implemented")

        effect_time_ms = (time.time() - effect_start) * 1000

        # Convert to output format
        output_buffer = io.BytesIO()

        if output_format == "webp":
            result_image.save(output_buffer, format="WEBP", quality=quality)
            content_type = "image/webp"
        elif output_format == "jpeg":
            # JPEG doesn't support transparency - convert to RGB with white bg
            if result_image.mode == 'RGBA':
                bg = Image.new('RGB', result_image.size, (255, 255, 255))
                bg.paste(result_image, mask=result_image.split()[3])
                result_image = bg
            elif result_image.mode == 'LA':
                result_image = result_image.convert('L')
            result_image.save(output_buffer, format="JPEG", quality=quality)
            content_type = "image/jpeg"
        else:  # png
            result_image.save(output_buffer, format="PNG", optimize=False)
            content_type = "image/png"

        output_buffer.seek(0)
        output_bytes = output_buffer.read()

        total_time_ms = (time.time() - start_time) * 1000

        logger.info(f"Processed {file.filename}: bg={bg_time_ms:.0f}ms, effect={effect_time_ms:.0f}ms, "
                   f"total={total_time_ms:.0f}ms")

        return Response(
            content=output_bytes,
            media_type=content_type,
            headers={
                "X-Total-Time-Ms": str(int(total_time_ms)),
                "X-BG-Removal-Time-Ms": str(int(bg_time_ms)),
                "X-Effect-Time-Ms": str(int(effect_time_ms)),
                "X-Model-Variant": bg_result.model_variant,
                "X-Effect": effect,
                "X-Input-Size": f"{bg_result.input_size[0]}x{bg_result.input_size[1]}",
                "X-Output-Size": f"{result_image.size[0]}x{result_image.size[1]}"
            }
        )

    except Exception as e:
        logger.error(f"Combined processing failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-with-effects")
async def process_with_multiple_effects(
    file: UploadFile = File(...),
    effects: str = Query("color,blackwhite", description="Comma-separated list of effects to apply"),
    alpha_matting: bool = Query(False, description="Enable alpha matting"),
    return_all_effects: bool = Query(True, description="Return all effects in JSON response"),
    contrast: float = Query(1.12, ge=0.8, le=1.5, description="Contrast boost (for blackwhite)"),
    edge_strength: float = Query(0.9, ge=0.0, le=1.5, description="Edge sharpening (for blackwhite)"),
    halation: float = Query(0.5, ge=0.0, le=1.0, description="Glow/halation (for blackwhite)"),
    grain: float = Query(0.08, ge=0.0, le=0.2, description="Film grain (for blackwhite)"),
    output_format: str = Query("png", enum=["png", "webp"], description="Output format")
):
    """
    Remove background and apply multiple effects in one call.

    This endpoint matches the InSPyReNet /api/v2/process-with-effects pattern.
    Returns JSON with all requested effects as base64-encoded images.

    Args:
        file: Image file (JPEG, PNG, WebP)
        effects: Comma-separated list of effects (e.g., "color,blackwhite")
        alpha_matting: Enable alpha matting for smoother edges
        return_all_effects: Return all effects in JSON (default True)
        contrast: Contrast boost factor (for blackwhite)
        edge_strength: Edge sharpening strength (for blackwhite)
        halation: Glow/halation strength (for blackwhite)
        grain: Film grain strength (for blackwhite)
        output_format: Output format for images (png or webp)

    Returns:
        JSON with all effects as base64-encoded images:
        {
            "success": true,
            "effects": {
                "color": "data:image/png;base64,...",
                "blackwhite": "data:image/png;base64,..."
            },
            "timing": {...}
        }
    """
    start_time = time.time()

    # Parse effects list
    effects_list = [e.strip().lower() for e in effects.split(",") if e.strip()]

    if not effects_list:
        raise HTTPException(status_code=400, detail="No effects specified")

    # Validate all effects
    invalid_effects = [e for e in effects_list if e not in AVAILABLE_EFFECTS]
    if invalid_effects:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown effects: {invalid_effects}. Available: {list(AVAILABLE_EFFECTS.keys())}"
        )

    # Validate file
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_IMAGE_SIZE_MB}MB"
        )

    logger.info(f"Processing with effects [{effects}]: {file.filename} ({file_size_mb:.2f}MB)")

    try:
        # Load image
        image = Image.open(io.BytesIO(content))

        # Step 1: Remove background
        processor = get_processor()
        bg_result = processor.remove_background(image, alpha_matting=alpha_matting)
        bg_removed = bg_result.image

        bg_time_ms = bg_result.inference_time_ms

        # Step 2: Resize for effect processing (optimization)
        # Processing effects on 12MP images takes 30+ seconds
        # Processing at 4MP takes ~8 seconds with minimal quality loss
        bg_for_effects, was_resized, original_size = resize_for_effect_processing(bg_removed)

        if was_resized:
            logger.info(f"Effects will process at {bg_for_effects.size} instead of {original_size}")

        # Step 3: Apply each effect at optimized resolution
        effect_results = {}
        effect_timings = {}

        for effect_name in effects_list:
            effect_start = time.time()

            # Normalize effect name (handle aliases like enhancedblackwhite -> blackwhite)
            normalized_name = normalize_effect_name(effect_name)

            if normalized_name == "color":
                # Color effect - return bg-removed image (no additional processing)
                # Use original resolution since there's no heavy processing
                result_image = bg_removed.copy()
            elif normalized_name == "blackwhite":
                # Apply effect at optimized resolution
                result_image = apply_blackwhite_effect(
                    bg_for_effects,
                    contrast=contrast,
                    edge_strength=edge_strength,
                    halation=halation,
                    grain=grain
                )
                # Upscale back to original resolution if we downscaled
                if was_resized:
                    upscale_start = time.time()
                    result_image = result_image.resize(original_size, Image.Resampling.LANCZOS)
                    upscale_time = (time.time() - upscale_start) * 1000
                    logger.debug(f"Upscaled {effect_name} to {original_size} in {upscale_time:.0f}ms")
            else:
                continue  # Skip unknown effects (shouldn't happen after validation)

            # Use original effect_name as key so frontend gets expected names
            effect_timings[effect_name] = (time.time() - effect_start) * 1000

            # Encode to base64
            output_buffer = io.BytesIO()
            if output_format == "webp":
                result_image.save(output_buffer, format="WEBP", quality=95)
                mime_type = "image/webp"
            else:
                # optimize=False for faster encoding (5s -> 1-2s), transparency preserved
                result_image.save(output_buffer, format="PNG", optimize=False)
                mime_type = "image/png"

            output_buffer.seek(0)
            b64_data = base64.b64encode(output_buffer.read()).decode()
            effect_results[effect_name] = f"data:{mime_type};base64,{b64_data}"

        total_time_ms = (time.time() - start_time) * 1000

        logger.info(f"Processed {file.filename} with {len(effects_list)} effects: "
                   f"bg={bg_time_ms:.0f}ms, total={total_time_ms:.0f}ms")

        return {
            "success": True,
            "effects": effect_results,
            "timing": {
                "bg_removal_ms": int(bg_time_ms),
                "effects_ms": {k: int(v) for k, v in effect_timings.items()},
                "total_ms": int(total_time_ms)
            },
            "input_size": f"{bg_result.input_size[0]}x{bg_result.input_size[1]}",
            "output_size": f"{bg_result.output_size[0]}x{bg_result.output_size[1]}",
            "model_variant": bg_result.model_variant,
            "effects_applied": effects_list
        }

    except Exception as e:
        logger.error(f"Multi-effect processing failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# COMPATIBILITY ENDPOINT (matches InSPyReNet API v2 exactly)
# =============================================================================

@app.post("/api/v2/process-with-effects")
async def api_v2_process_with_effects(
    file: UploadFile = File(...),
    effects: str = Query("color,blackwhite", description="Comma-separated effects"),
    alpha_matting: bool = Query(False, description="Enable alpha matting"),
    return_all_effects: bool = Query(True, description="Return all effects"),
    contrast: float = Query(1.12, ge=0.8, le=1.5),
    edge_strength: float = Query(0.9, ge=0.0, le=1.5),
    halation: float = Query(0.5, ge=0.0, le=1.0),
    grain: float = Query(0.08, ge=0.0, le=0.2),
    output_format: str = Query("png", enum=["png", "webp"])
):
    """
    API v2 compatible endpoint for InSPyReNet drop-in replacement.
    Redirects to /process-with-effects with same parameters.
    """
    return await process_with_multiple_effects(
        file=file,
        effects=effects,
        alpha_matting=alpha_matting,
        return_all_effects=return_all_effects,
        contrast=contrast,
        edge_strength=edge_strength,
        halation=halation,
        grain=grain,
        output_format=output_format
    )


# Run with uvicorn
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting BiRefNet API on {host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        workers=1,
        log_level="info"
    )
