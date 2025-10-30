"""Main FastAPI application with API endpoints"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import time
import asyncio
from src.config import settings
from src.models.schemas import (
    GenerateRequest, GenerateResponse,
    BatchGenerateRequest, BatchGenerateResponse,
    QuotaStatus, StyleResult, ArtisticStyle
)
from src.core.gemini_client import gemini_client
from src.core.rate_limiter import rate_limiter
from src.core.storage_manager import storage_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Gemini Artistic API",
    description="Generate artistic pet portrait headshots using Gemini 2.5 Flash Image",
    version="1.0.0"
)

# CORS middleware - matching production InSPyReNet API configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://*.shopify.com",
        "https://*.shopifypreview.com",
        "https://*.myshopify.com",
        "http://localhost:*",
        "https://localhost:*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": settings.gemini_model,
        "styles": ["ink_wash", "van_gogh_post_impressionism"],
        "timestamp": time.time()
    }


@app.get("/model-info")
async def model_info():
    """Model information endpoint"""
    return {
        "model": settings.gemini_model,
        "project": settings.project_id,
        "styles": {
            "ink_wash": "Modern - East Asian ink wash style",
            "van_gogh_post_impressionism": "Classic - Van Gogh Post-Impressionist style"
        },
        "rate_limits": {
            "daily": settings.rate_limit_daily,
            "burst": settings.rate_limit_burst
        }
    }


@app.get("/api/v1/quota", response_model=QuotaStatus)
async def check_quota(
    request: Request,
    customer_id: str = None,
    session_id: str = None
):
    """Check remaining quota without consuming"""
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
    Generate single artistic style

    Flow:
    1. Check rate limit
    2. Store original image (returns hash)
    3. Check cache
    4. If cache hit: return instantly (no quota consumed)
    5. If cache miss: generate with Gemini
    6. Store generated image
    7. Consume quota
    """
    client_ip = request.client.host
    identifiers = {
        "customer_id": req.customer_id,
        "session_id": req.session_id,
        "ip_address": client_ip
    }

    try:
        # 1. Check rate limit
        quota_before = await rate_limiter.check_rate_limit(**identifiers)
        if not quota_before.allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Resets at {quota_before.reset_time}"
            )

        # 2. Store original
        original_url, original_hash = await storage_manager.store_original_image(
            image_data=req.image_data,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        # 3. Check cache
        cached_url = await storage_manager.get_cached_generation(
            image_hash=original_hash,
            style=req.style.value,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        if cached_url:
            # Cache hit!
            logger.info(f"Cache hit: {original_hash}_{req.style.value}")
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

        # 4. Generate with Gemini
        start_time = time.time()
        generated_image, processing_time = await gemini_client.generate_artistic_style(
            image_data=req.image_data,
            style=req.style
        )

        # 5. Store generated
        generated_url = await storage_manager.store_generated_image(
            image_data=generated_image,
            original_hash=original_hash,
            style=req.style.value,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        # 6. Consume quota
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
        logger.error(f"Error generating {req.style.value}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/batch-generate", response_model=BatchGenerateResponse)
async def batch_generate_styles(request: Request, req: BatchGenerateRequest):
    """
    Generate both artistic styles at once (parallel processing)

    Note: Consumes 2 quota (one per style)
    """
    client_ip = request.client.host
    identifiers = {
        "customer_id": req.customer_id,
        "session_id": req.session_id,
        "ip_address": client_ip
    }

    try:
        # Check rate limit (need at least 2 remaining)
        quota_before = await rate_limiter.check_rate_limit(**identifiers)
        if not quota_before.allowed or quota_before.remaining < 2:
            raise HTTPException(
                status_code=429,
                detail=f"Need 2 quota for batch generation. Current: {quota_before.remaining}"
            )

        # Store original
        original_url, original_hash = await storage_manager.store_original_image(
            image_data=req.image_data,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        # Generate both styles in parallel
        async def generate_style(style: ArtisticStyle):
            # Check cache first
            cached_url = await storage_manager.get_cached_generation(
                image_hash=original_hash,
                style=style.value,
                customer_id=req.customer_id,
                session_id=req.session_id
            )

            if cached_url:
                return StyleResult(
                    style=style.value,
                    image_url=cached_url,
                    cache_hit=True,
                    processing_time_ms=0
                )

            # Generate with Gemini
            start = time.time()
            generated_image, proc_time = await gemini_client.generate_artistic_style(
                image_data=req.image_data,
                style=style
            )

            # Store
            generated_url = await storage_manager.store_generated_image(
                image_data=generated_image,
                original_hash=original_hash,
                style=style.value,
                customer_id=req.customer_id,
                session_id=req.session_id
            )

            # Consume quota
            await rate_limiter.consume_quota(**identifiers, style=style.value)

            return StyleResult(
                style=style.value,
                image_url=generated_url,
                cache_hit=False,
                processing_time_ms=int(proc_time * 1000)
            )

        # Execute both styles in parallel
        start_total = time.time()
        results_list = await asyncio.gather(
            generate_style(ArtisticStyle.INK_WASH),
            generate_style(ArtisticStyle.VAN_GOGH_POST_IMPRESSIONISM),
            return_exceptions=True
        )

        # Check for errors
        for i, result in enumerate(results_list):
            if isinstance(result, Exception):
                style_name = ["ink_wash", "van_gogh_post_impressionism"][i]
                logger.error(f"Error generating {style_name}: {result}")
                raise HTTPException(status_code=500, detail=f"Error generating {style_name}: {str(result)}")

        # Build results dict
        results = {
            result.style: result
            for result in results_list
        }

        total_time = time.time() - start_total

        # Final quota check
        quota_after = await rate_limiter.check_rate_limit(**identifiers)

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
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
