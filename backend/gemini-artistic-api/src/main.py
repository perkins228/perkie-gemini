"""Main FastAPI application with API endpoints"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import time
import asyncio
import uuid
import json
from datetime import datetime, timedelta
from google.cloud import storage, secretmanager
from google.oauth2 import service_account
from src.config import settings
import hashlib
from src.models.schemas import (
    GenerateRequest, GenerateResponse,
    BatchGenerateRequest, BatchGenerateResponse,
    CustomGenerateRequest,
    QuotaStatus, StyleResult, ArtisticStyle,
    SignedUrlRequest, SignedUrlResponse,
    ConfirmUploadRequest, ConfirmUploadResponse,
    SendEmailRequest, SendEmailResponse
)
from src.core.gemini_client import gemini_client
from src.core.rate_limiter import rate_limiter
from src.core.storage_manager import storage_manager
# from src.core.email_client import email_client  # TODO: Enable when email client is ready

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load GCS signer credentials from Secret Manager
def load_signer_credentials():
    """Load service account credentials for signing GCS URLs from Secret Manager"""
    try:
        client = secretmanager.SecretManagerServiceClient()
        secret_name = f"projects/{settings.project_id}/secrets/gcs-signer-key/versions/latest"
        response = client.access_secret_version(request={"name": secret_name})
        key_json = response.payload.data.decode("UTF-8")
        credentials_info = json.loads(key_json)
        credentials = service_account.Credentials.from_service_account_info(credentials_info)
        logger.info("✅ GCS signer credentials loaded from Secret Manager")
        return credentials
    except Exception as e:
        logger.error(f"❌ Failed to load GCS signer credentials: {e}")
        raise

# Load credentials at startup
gcs_signer_credentials = load_signer_credentials()

# Create FastAPI app
app = FastAPI(
    title="Gemini Artistic API",
    description="Generate artistic pet portrait headshots using Gemini 2.5 Flash Image",
    version="1.0.0"
)

# CORS middleware - Allow all origins for testing (wildcards don't work in FastAPI)
# TODO: Implement custom CORS middleware with regex patterns for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (wildcards like *.shopify.com don't work)
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": settings.gemini_model,
        "custom_model": settings.gemini_custom_model,
        "styles": ["ink_wash", "pen_and_marker", "custom"],
        "rate_limits": {
            "named": settings.rate_limit_daily,
            "custom": settings.rate_limit_custom_daily
        },
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
            "pen_and_marker": "Sketch - Contemporary pen and marker illustration"
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
    session_id: str = None,
    quota_type: str = "named"
):
    """Check remaining quota without consuming. quota_type: 'named' (10/day) or 'custom' (3/day)"""
    client_ip = request.client.host

    identifiers = {
        "customer_id": customer_id,
        "session_id": session_id,
        "ip_address": client_ip
    }

    quota = await rate_limiter.check_rate_limit(**identifiers, quota_type=quota_type)
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
        # 1. Check rate limit (named styles: 10/day)
        quota_before = await rate_limiter.check_rate_limit(**identifiers, quota_type="named")
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
                processing_time_ms=0,
                warning_level=quota_before.warning_level
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

        # 6. Consume quota (named pool)
        quota_after = await rate_limiter.consume_quota(
            **identifiers,
            style=req.style.value,
            quota_type="named"
        )

        return GenerateResponse(
            success=True,
            image_url=generated_url,
            original_url=original_url,
            style=req.style.value,
            cache_hit=False,
            quota_remaining=quota_after.remaining,
            quota_limit=quota_after.limit,
            processing_time_ms=int(processing_time * 1000),
            warning_level=quota_after.warning_level
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating {req.style.value}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/generate-custom", response_model=GenerateResponse)
async def generate_custom_style(request: Request, req: CustomGenerateRequest):
    """
    Generate image from a custom prompt (no preset style).

    Used by the inline Gemini processor on product pages.
    Same rate limiting and caching as named styles.
    Returns 400 (not 500) on safety blocks.
    """
    client_ip = request.client.host
    identifiers = {
        "customer_id": req.customer_id,
        "session_id": req.session_id,
        "ip_address": client_ip
    }

    try:
        # 1. Check rate limit (custom prompts: 3/day — separate pool)
        quota_before = await rate_limiter.check_rate_limit(**identifiers, quota_type="custom")
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

        # 3. Hash prompt for cache key
        prompt_hash = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()

        # 4. Check cache
        cached_url = await storage_manager.get_cached_generation(
            image_hash=original_hash,
            style="custom",
            customer_id=req.customer_id,
            session_id=req.session_id,
            prompt_hash=prompt_hash
        )

        if cached_url:
            logger.info(f"Cache hit: custom prompt {prompt_hash[:16]}")
            return GenerateResponse(
                success=True,
                image_url=cached_url,
                original_url=original_url,
                style="custom",
                cache_hit=True,
                quota_remaining=quota_before.remaining,
                quota_limit=quota_before.limit,
                processing_time_ms=0,
                warning_level=quota_before.warning_level
            )

        # 5. Generate with Gemini using custom prompt
        generated_image, processing_time = await gemini_client.generate_from_custom_prompt(
            image_data=req.image_data,
            prompt=req.prompt
        )

        # 6. Store generated
        generated_url = await storage_manager.store_generated_image(
            image_data=generated_image,
            original_hash=original_hash,
            style="custom",
            customer_id=req.customer_id,
            session_id=req.session_id,
            prompt_hash=prompt_hash,
            prompt_text=req.prompt
        )

        # 7. Consume quota (custom pool)
        quota_after = await rate_limiter.consume_quota(
            **identifiers,
            style="custom",
            quota_type="custom"
        )

        return GenerateResponse(
            success=True,
            image_url=generated_url,
            original_url=original_url,
            style="custom",
            cache_hit=False,
            quota_remaining=quota_after.remaining,
            quota_limit=quota_after.limit,
            processing_time_ms=int(processing_time * 1000),
            warning_level=quota_after.warning_level
        )

    except HTTPException:
        raise
    except ValueError as e:
        error_msg = str(e)
        if "safety_blocked" in error_msg:
            raise HTTPException(
                status_code=400,
                detail="Your prompt was flagged by content safety filters. Please try a different description."
            )
        logger.error(f"Error generating custom style: {e}")
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        logger.error(f"Error generating custom style: {e}")
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
        # Check rate limit (need at least 2 remaining, named pool)
        quota_before = await rate_limiter.check_rate_limit(**identifiers, quota_type="named")
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

            # Consume quota (named pool)
            await rate_limiter.consume_quota(**identifiers, style=style.value, quota_type="named")

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
            generate_style(ArtisticStyle.PEN_AND_MARKER),
            return_exceptions=True
        )

        # Check for errors
        for i, result in enumerate(results_list):
            if isinstance(result, Exception):
                style_name = ["ink_wash", "pen_and_marker"][i]
                logger.error(f"Error generating {style_name}: {result}")
                raise HTTPException(status_code=500, detail=f"Error generating {style_name}: {str(result)}")

        # Build results dict
        results = {
            result.style: result
            for result in results_list
        }

        total_time = time.time() - start_total

        # Final quota check (named pool)
        quota_after = await rate_limiter.check_rate_limit(**identifiers, quota_type="named")

        return BatchGenerateResponse(
            success=True,
            original_url=original_url,
            results=results,
            quota_remaining=quota_after.remaining,
            quota_limit=quota_after.limit,
            total_processing_time_ms=int(total_time * 1000),
            warning_level=quota_after.warning_level
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/upload/signed-url", response_model=SignedUrlResponse)
async def generate_signed_upload_url(request: Request, req: SignedUrlRequest):
    """
    Generate signed URL for direct GCS upload

    This allows clients to upload images directly to GCS without proxying through this API,
    reducing latency and eliminating cold start issues.

    Returns:
        - signed_url: URL for direct upload (PUT method)
        - public_url: Final public URL after upload
        - upload_id: Unique identifier for this upload
    """
    try:
        # No generation rate limit check here — uploads must work even when
        # generation quota is exhausted (upload-only fallback for orders).
        # Abuse prevention: signed URLs expire in 15 minutes + file size limits.

        # Generate unique path
        upload_id = str(uuid.uuid4())
        timestamp = int(time.time())

        # Determine blob path based on identifiers
        if req.customer_id:
            blob_path = f"originals/customers/{req.customer_id}/{timestamp}_{upload_id}.jpg"
        elif req.session_id:
            blob_path = f"originals/sessions/{req.session_id}/{timestamp}_{upload_id}.jpg"
        else:
            # Anonymous uploads to temp folder
            date = datetime.utcnow().strftime('%Y%m%d')
            blob_path = f"temp/uploads/{date}/{req.session_id or 'anon'}_{timestamp}.jpg"

        # Create signed URL using dedicated service account credentials
        storage_client = storage.Client(
            project=settings.project_id,
            credentials=gcs_signer_credentials
        )
        bucket = storage_client.bucket("perkieprints-uploads")
        blob = bucket.blob(blob_path)

        # Generate signed URL for PUT (upload) using service account key
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),  # URL expires in 15 minutes
            method="PUT",
            content_type=req.file_type,
        )

        # Public URL (after upload completes)
        public_url = f"https://storage.googleapis.com/perkieprints-uploads/{blob_path}"

        logger.info(f"Generated signed URL for upload: {upload_id}")

        return SignedUrlResponse(
            signed_url=signed_url,
            public_url=public_url,
            upload_id=upload_id,
            blob_path=blob_path,
            expires_in=900,  # 15 minutes in seconds
            method="PUT",
            content_type=req.file_type
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating signed URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/upload/confirm", response_model=ConfirmUploadResponse)
async def confirm_upload(req: ConfirmUploadRequest):
    """
    Confirm successful upload and update metadata

    This endpoint is optional - it allows verification that the file exists
    and updates metadata for tracking purposes.
    """
    try:
        storage_client = storage.Client(project=settings.project_id)
        bucket = storage_client.bucket("perkieprints-uploads")
        blob = bucket.blob(req.blob_path)

        # Check if blob exists
        if not blob.exists():
            raise HTTPException(
                status_code=404,
                detail="Upload not found. File may not have been uploaded successfully."
            )

        # Update metadata
        metadata = {
            "upload_id": req.upload_id,
            "customer_id": req.customer_id or "anonymous",
            "session_id": req.session_id or "none",
            "confirmed_at": datetime.utcnow().isoformat(),
        }
        blob.metadata = metadata
        blob.patch()

        # Reload to get updated info
        blob.reload()

        logger.info(f"Upload confirmed: {req.upload_id}")

        return ConfirmUploadResponse(
            success=True,
            upload_id=req.upload_id,
            size=blob.size,
            content_type=blob.content_type,
            public_url=blob.public_url,
            created=blob.time_created.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# TODO: Enable when email client is ready
# @app.post("/api/v1/send-email", response_model=SendEmailResponse)
async def send_processed_images_email_disabled(request: Request, req: SendEmailRequest):
    """
    Send email with processed pet images

    Features:
    - Generates signed URLs (24hr expiry) for all images
    - Uses HTML template with download buttons
    - Rate limited separately from image generation
    - Reuses existing Firestore rate limiter
    """
    client_ip = request.client.host
    identifiers = {
        "customer_id": req.customer_id,
        "session_id": req.session_id,
        "ip_address": client_ip
    }

    try:
        # 1. Check email rate limit (separate from image generation)
        # Email quotas are tracked separately with higher limits
        quota_before = await rate_limiter.check_rate_limit(**identifiers)

        if not quota_before.allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Email rate limit exceeded. Resets at {quota_before.reset_time}"
            )

        # 2. Generate signed URLs for all images (24hr expiry)
        logger.info(f"Generating signed URLs for {len(req.image_urls)} images")
        signed_urls = email_client.generate_signed_urls(
            list(req.image_urls.values()),
            expiry_hours=settings.signed_url_expiry_hours
        )

        # Map back to original keys
        signed_url_map = {}
        for key, url in req.image_urls.items():
            signed_url_map[key] = signed_urls.get(url, url)

        # 3. Build email HTML
        customer_name = req.to_name or "Valued Customer"
        html_content = email_client.build_email_html(
            customer_name=customer_name,
            image_data=signed_url_map,
            order_id=req.order_id
        )

        # 4. Send email via Sender.net
        logger.info(f"Sending email to {req.to_email}")
        email_result = await email_client.send_email(
            to_email=req.to_email,
            to_name=req.to_name,
            subject=req.subject or "Your Pet Images from Perkie Prints",
            html_content=html_content
        )

        if not email_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=email_result.get("error", "Failed to send email")
            )

        # 5. Consume email quota (tracked separately from image generation)
        await rate_limiter.consume_quota(
            **identifiers,
            style="email"  # Track as email type
        )

        # 6. Get final quota
        quota_after = await rate_limiter.check_rate_limit(**identifiers)

        logger.info(f"✅ Email sent successfully. Message ID: {email_result.get('message_id')}")

        return SendEmailResponse(
            success=True,
            message_id=email_result.get("message_id"),
            signed_urls=signed_url_map,
            quota_remaining=quota_after.remaining,
            quota_limit=quota_after.limit
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
