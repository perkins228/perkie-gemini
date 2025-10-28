"""FastAPI application for Gemini Artistic API"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
import asyncio
from datetime import datetime

from src.config import settings
from src.models.schemas import (
    GenerateRequest,
    GenerateResponse,
    QuotaStatus,
    ArtisticStyle,
    BatchGenerateRequest,
    BatchGenerateResponse,
    StyleResult
)
from src.core.gemini_client import gemini_client
from src.core.rate_limiter import rate_limiter
from src.core.storage_manager import storage_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Gemini Artistic API",
    description="Generate artistic pet portraits with headshot framing using Gemini 2.5 Flash Image",
    version="1.0.0"
)

# CORS middleware - configured for Shopify testsite + local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://perkieprints-test.myshopify.com",
        "https://testsite.perkieprints.com",
        "http://localhost:3000",  # For local development
        "http://127.0.0.1:3000",
        "http://localhost:8000",  # For local web server testing
        "http://127.0.0.1:8000",
        "http://localhost:8080",  # For local API testing
        "http://127.0.0.1:8080",
        "null"  # Allow file:// protocol for local HTML testing
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": settings.gemini_model,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/v1/quota", response_model=QuotaStatus)
async def check_quota(
    request: Request,
    customer_id: str = None,
    session_id: str = None
):
    """
    Check remaining quota without generating

    Query parameters:
    - customer_id: Customer ID (optional)
    - session_id: Session ID (optional)
    - IP address is auto-detected from request
    """
    client_ip = request.client.host

    identifiers = {
        "customer_id": customer_id,
        "session_id": session_id,
        "ip_address": client_ip
    }

    quota = await rate_limiter.check_rate_limit(**identifiers)
    return quota


@app.post("/api/v1/generate", response_model=GenerateResponse)
async def generate_artistic_style(request: Request, req: GenerateRequest):
    """
    Generate artistic style with headshot framing

    Flow:
    1. Check rate limit (before generation)
    2. Store original image (with deduplication)
    3. Check cache (same image + style already generated?)
    4. If cache hit: return instantly without consuming quota
    5. If cache miss: generate with Gemini
    6. Store generated image
    7. Consume quota (only after successful generation)
    """
    try:
        # 1. Extract identifiers for rate limiting
        client_ip = request.client.host
        identifiers = {
            "customer_id": req.customer_id,
            "session_id": req.session_id,
            "ip_address": client_ip
        }

        # 2. Check rate limit BEFORE generation
        quota_before = await rate_limiter.check_rate_limit(**identifiers)
        if not quota_before.allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Resets at {quota_before.reset_time}"
            )

        # 3. Store original image (returns hash for deduplication)
        original_url, original_hash = await storage_manager.store_original_image(
            image_data=req.image_data,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        # 4. Check cache - already generated this image + style?
        cached_url = await storage_manager.get_cached_generation(
            image_hash=original_hash,
            style=req.style.value,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        if cached_url:
            # Cache hit! Return instantly without consuming quota
            logger.info(f"Cache hit for {original_hash}_{req.style.value}")
            return GenerateResponse(
                success=True,
                image_url=cached_url,
                original_url=original_url,
                style=req.style.value,
                cache_hit=True,
                quota_remaining=quota_before.remaining,
                quota_limit=quota_before.limit,
                processing_time_ms=0
            )

        # 5. Cache miss - generate with Gemini
        start_time = time.time()
        generated_image, processing_time = await gemini_client.generate_artistic_style(
            image_data=req.image_data,
            style=req.style
        )

        # 6. Store generated image
        generated_url = await storage_manager.store_generated_image(
            image_data=generated_image,
            original_hash=original_hash,
            style=req.style.value,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        # 7. Consume quota AFTER successful generation
        quota_after = await rate_limiter.consume_quota(
            **identifiers,
            style=req.style.value
        )

        return GenerateResponse(
            success=True,
            image_url=generated_url,
            original_url=original_url,
            style=req.style.value,
            cache_hit=False,
            quota_remaining=quota_after.remaining,
            quota_limit=quota_after.limit,
            processing_time_ms=int(processing_time * 1000)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating artistic style: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate portrait: {str(e)}"
        )


@app.post("/api/v1/generate-batch", response_model=BatchGenerateResponse)
async def generate_batch_artistic_styles(request: Request, req: BatchGenerateRequest):
    """
    Generate all 3 artistic styles in parallel (batch generation)

    Flow:
    1. Check rate limit (need 3 quota available)
    2. Store original image once (deduplication)
    3. Generate all 3 styles concurrently using asyncio.gather()
    4. Store all generated images
    5. Consume 3 quota atomically
    6. Return all results

    WARNING: This consumes 3 quota per request
    """
    try:
        start_time = time.time()

        # 1. Extract identifiers for rate limiting
        client_ip = request.client.host
        identifiers = {
            "customer_id": req.customer_id,
            "session_id": req.session_id,
            "ip_address": client_ip
        }

        # 2. Check rate limit - need at least 3 quota
        quota_before = await rate_limiter.check_rate_limit(**identifiers)
        if not quota_before.allowed or quota_before.remaining < 3:
            raise HTTPException(
                status_code=429,
                detail=f"Insufficient quota for batch generation. Need 3, have {quota_before.remaining}. Resets at {quota_before.reset_time}"
            )

        # 3. Store original image once (returns hash for deduplication)
        original_url, original_hash = await storage_manager.store_original_image(
            image_data=req.image_data,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        # 4. Generate all 3 styles concurrently
        logger.info(f"Starting batch generation for {original_hash}")

        async def generate_single_style(style: ArtisticStyle):
            """Helper to generate a single style with caching"""
            style_start = time.time()

            # Check cache first
            cached_url = await storage_manager.get_cached_generation(
                image_hash=original_hash,
                style=style.value,
                customer_id=req.customer_id,
                session_id=req.session_id
            )

            if cached_url:
                # Cache hit
                logger.info(f"Cache hit for {original_hash}_{style.value}")
                return StyleResult(
                    style=style.value,
                    image_url=cached_url,
                    cache_hit=True,
                    processing_time_ms=int((time.time() - style_start) * 1000)
                )

            # Cache miss - generate new
            generated_image, gen_time = await gemini_client.generate_artistic_style(
                image_data=req.image_data,
                style=style
            )

            # Store generated image
            generated_url = await storage_manager.store_generated_image(
                image_data=generated_image,
                original_hash=original_hash,
                style=style.value,
                customer_id=req.customer_id,
                session_id=req.session_id
            )

            return StyleResult(
                style=style.value,
                image_url=generated_url,
                cache_hit=False,
                processing_time_ms=int((time.time() - style_start) * 1000)
            )

        # Execute all 3 generations in parallel
        results_list = await asyncio.gather(
            generate_single_style(ArtisticStyle.BW_FINE_ART),
            generate_single_style(ArtisticStyle.INK_WASH),
            generate_single_style(ArtisticStyle.CHARCOAL_REALISM)
        )

        # Convert list to dict
        results = {
            result.style: result
            for result in results_list
        }

        # 5. Consume batch quota (3 quota) AFTER successful generation
        try:
            quota_after = await rate_limiter.consume_batch_quota(
                count=3,
                **identifiers
            )
        except ValueError as e:
            # Shouldn't happen since we checked earlier, but handle gracefully
            raise HTTPException(
                status_code=429,
                detail=str(e)
            )

        total_time = time.time() - start_time
        logger.info(f"Batch generation completed in {total_time:.2f}s")

        return BatchGenerateResponse(
            success=True,
            original_url=original_url,
            results=results,
            quota_remaining=quota_after.remaining,
            quota_limit=quota_after.limit,
            total_processing_time_ms=int(total_time * 1000)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate batch portraits: {str(e)}"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug
    )
