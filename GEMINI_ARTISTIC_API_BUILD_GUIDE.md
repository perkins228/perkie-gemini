# Building the Gemini Artistic API from Scratch

**Purpose**: Step-by-step guide to recreate the Gemini Artistic API implementation
**Target Audience**: Developers building similar artistic image generation services
**Tech Stack**: Python FastAPI, Google Gemini 2.5 Flash Image, Cloud Run, Firestore, Cloud Storage

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Core Implementation](#core-implementation)
4. [Cloud Infrastructure](#cloud-infrastructure)
5. [Deployment](#deployment)
6. [Testing & Verification](#testing--verification)
7. [Common Pitfalls](#common-pitfalls)

---

## Prerequisites

### Google Cloud Account
- **Project**: Create or use existing GCP project
- **Billing**: Enabled with budget alerts configured
- **APIs to Enable**:
  ```bash
  gcloud services enable run.googleapis.com
  gcloud services enable firestore.googleapis.com
  gcloud services enable storage.googleapis.com
  gcloud services enable artifactregistry.googleapis.com
  gcloud services enable cloudbuild.googleapis.com
  gcloud services enable secretmanager.googleapis.com
  ```

### Gemini API Access
- **API Key**: Obtain from Google AI Studio (https://aistudio.google.com/app/apikey)
- **Model**: Verify access to `gemini-2.5-flash-image` (image generation model)
- **Test Access**:
  ```python
  import google.generativeai as genai
  genai.configure(api_key="YOUR_API_KEY")
  model = genai.GenerativeModel(model_name="gemini-2.5-flash-image")
  # Should not raise errors
  ```

### Local Development Tools
- Python 3.11+
- Docker Desktop (for containerization)
- gcloud CLI (authenticated to your project)
- Git (for version control)

---

## Project Setup

### Step 1: Create Directory Structure

```bash
mkdir -p gemini-artistic-api
cd gemini-artistic-api

# Create Python package structure
mkdir -p src/core
mkdir -p src/models
mkdir -p scripts
mkdir -p tests

# Create empty __init__.py files
touch src/__init__.py
touch src/core/__init__.py
touch src/models/__init__.py
```

### Step 2: Create requirements.txt

```txt
# requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
google-generativeai==0.3.1
google-cloud-firestore==2.13.1
google-cloud-storage==2.13.0
pillow==10.1.0
python-multipart==0.0.6
```

### Step 3: Create .env.example

```bash
# .env.example
PROJECT_ID=your-project-id
PROJECT_NUMBER=your-project-number
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-image
GEMINI_TEMPERATURE=0.7
GEMINI_TOP_P=0.9
GEMINI_TOP_K=40
RATE_LIMIT_DAILY=5
RATE_LIMIT_BURST=3
STORAGE_BUCKET=your-storage-bucket-name
CACHE_TTL_SECONDS=604800
DAILY_COST_CAP=10.0
ALERT_THRESHOLDS=0.5,0.75,0.9
API_HOST=0.0.0.0
API_PORT=8080
DEBUG=false
```

### Step 4: Create .gitignore

```gitignore
# .gitignore
.env
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
.vscode/
.idea/
*.log
.DS_Store
```

---

## Core Implementation

### Step 1: Configuration (src/config.py)

```python
"""Application configuration using Pydantic settings"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Google Cloud Project
    project_id: str
    project_number: str

    # Gemini API Configuration
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash-image"
    gemini_temperature: float = 0.7
    gemini_top_p: float = 0.9
    gemini_top_k: int = 40

    # Rate Limiting
    rate_limit_daily: int = 5      # Customer/IP daily limit
    rate_limit_burst: int = 3      # Session daily limit

    # Storage Configuration
    storage_bucket: str
    cache_ttl_seconds: int = 604800  # 7 days

    # Cost Controls
    daily_cost_cap: float = 10.0
    alert_thresholds: List[float] = [0.5, 0.75, 0.9]

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    debug: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
```

### Step 2: Pydantic Schemas (src/models/schemas.py)

```python
"""Request/response schemas for API validation"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict


class ArtisticStyle(str, Enum):
    """Available artistic styles"""
    BW_FINE_ART = "bw_fine_art"                             # "Perkie Print"
    INK_WASH = "ink_wash"                                   # "Modern"
    VAN_GOGH_POST_IMPRESSIONISM = "van_gogh_post_impressionism"  # "Classic"


class GenerateRequest(BaseModel):
    """Request to generate single artistic style"""
    image_data: str = Field(..., description="Base64 encoded image")
    style: ArtisticStyle = Field(..., description="Style to apply")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")


class GenerateResponse(BaseModel):
    """Response with generated image"""
    success: bool
    image_url: str
    original_url: str
    style: str
    cache_hit: bool = False
    quota_remaining: int
    quota_limit: int
    processing_time_ms: int


class QuotaStatus(BaseModel):
    """Rate limit quota status"""
    allowed: bool
    remaining: int
    limit: int
    reset_time: str


class BatchGenerateRequest(BaseModel):
    """Request to generate all 2 styles at once"""
    image_data: str = Field(..., description="Base64 encoded image")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")


class StyleResult(BaseModel):
    """Result for single style in batch"""
    style: str
    image_url: str
    cache_hit: bool = False
    processing_time_ms: int


class BatchGenerateResponse(BaseModel):
    """Response with all 2 generated styles"""
    success: bool
    original_url: str
    results: Dict[str, StyleResult]
    quota_remaining: int
    quota_limit: int
    total_processing_time_ms: int
```

### Step 3: Gemini Client (src/core/gemini_client.py)

```python
"""Gemini API client with artistic style prompts"""
import google.generativeai as genai
from google.generativeai import types
import base64
import time
import logging
from typing import Tuple
from io import BytesIO
from PIL import Image
from src.config import settings
from src.models.schemas import ArtisticStyle

logger = logging.getLogger(__name__)

# Configure Gemini API
genai.configure(api_key=settings.gemini_api_key)


# Artistic style prompts optimized for Gemini 2.5 Flash Image
STYLE_PROMPTS = {
    ArtisticStyle.INK_WASH: (
        "Create a portrait in East Asian ink wash style. "
        "Frame tightly on head, neck, and upper shoulders with face as focal point. "
        "Maintain identical facial features, fur color, and eye shape. Keep the pet’s head orientation and pose consistent, ensuring that its unique markings and expression remain true to the reference. "
        "For multiple pets touching, create group; if separated but clear, group; if mixed clarity, choose clearest. "
        "Remove background completely. "
        "Apply flowing ink gradients for features, spontaneous brush strokes for fur texture. "
        "Use minimal expressive lines capturing personality. "
        "Isolate on pure white background (#FFFFFF) with no gradients or textures."
    ),
    ArtisticStyle.VAN_GOGH_POST_IMPRESSIONISM: (
        "Create a Van Gogh Post-Impressionist portrait. "
        "Tightly frame the pet's head, neck, and upper chest with face as focal point. "
        "Maintain identical facial features, fur color, and eye shape. Keep the pet’s head orientation and pose consistent, ensuring that its unique markings and expression remain true to the reference. "
        "For multiple pets: if touching create group; if separated but clear create group; if mixed clarity choose clearest. "
        "Remove background completely. "
        "Apply Van Gogh style with thick impasto brushstrokes, vibrant expressive colors (blues, yellows, greens, ochres), "
        "swirling patterns in fur, bold dark outlines, complementary color layers. "
        "Reference Arles period (1888-1889) technique. "
        "Isolate on pure white background (#FFFFFF)."
    ),
}


class GeminiClient:
    """Client for Gemini 2.5 Flash Image API"""

    def __init__(self):
        self.model_name = settings.gemini_model
        self.model = genai.GenerativeModel(model_name=self.model_name)
        logger.info(f"Initialized Gemini client: {self.model_name}")

    async def generate_artistic_style(
        self,
        image_data: str,
        style: ArtisticStyle
    ) -> Tuple[str, float]:
        """
        Generate artistic portrait with headshot framing

        Args:
            image_data: Base64 encoded image
            style: Artistic style to apply

        Returns:
            Tuple of (generated_image_base64, processing_time_seconds)
        """
        start_time = time.time()

        try:
            # Decode base64 image
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)

            # Convert to PIL Image
            input_image = Image.open(BytesIO(image_bytes))

            # Get style prompt
            prompt = STYLE_PROMPTS[style]

            # Generate with Gemini
            logger.info(f"Generating {style.value}...")
            response = self.model.generate_content(
                contents=[prompt, input_image],
                generation_config=types.GenerationConfig(
                    temperature=settings.gemini_temperature,
                    top_p=settings.gemini_top_p,
                    top_k=settings.gemini_top_k,
                )
            )

            # Extract generated image
            if not response.parts:
                raise ValueError("No image generated by Gemini")

            generated_image_data = None
            for part in response.parts:
                if part.inline_data is not None:
                    generated_image_data = part.inline_data.data
                    break

            # Validate
            if generated_image_data is None or len(generated_image_data) == 0:
                raise ValueError(f"Empty image data for {style.value}")

            # Convert to base64
            generated_base64 = base64.b64encode(generated_image_data).decode('utf-8')

            processing_time = time.time() - start_time
            logger.info(f"Generated {style.value} in {processing_time:.2f}s")

            return generated_base64, processing_time

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise


# Singleton instance
gemini_client = GeminiClient()
```

### Step 4: Rate Limiter (src/core/rate_limiter.py)

```python
"""Firestore-based rate limiting with atomic transactions"""
from google.cloud import firestore
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from src.config import settings
from src.models.schemas import QuotaStatus

logger = logging.getLogger(__name__)


class RateLimiter:
    """Three-tier rate limiting using Firestore"""

    def __init__(self):
        self.db = firestore.Client(project=settings.project_id)
        self.daily_limit = settings.rate_limit_daily
        self.burst_limit = settings.rate_limit_burst
        logger.info(f"Initialized rate limiter: daily={self.daily_limit}, burst={self.burst_limit}")

    def _get_reset_date(self) -> datetime:
        """Get next midnight UTC reset time"""
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(days=1)
        return tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

    async def check_rate_limit(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> QuotaStatus:
        """
        Check rate limit without consuming quota

        Priority: customer_id > session_id > ip_address
        """
        # Determine which quota to check
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}')
            limit = self.daily_limit
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}')
            limit = self.burst_limit
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}')
            limit = self.daily_limit

        # Get current status
        doc = doc_ref.get()

        if not doc.exists:
            # First use - allow
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat()
            )

        data = doc.to_dict()
        current_count = data.get('count', 0)
        reset_date = data.get('reset_date')

        # Check if quota needs reset
        if reset_date < self._get_reset_date():
            return QuotaStatus(
                allowed=True,
                remaining=limit,
                limit=limit,
                reset_time=self._get_reset_date().isoformat()
            )

        # Check if under limit
        remaining = max(0, limit - current_count)
        allowed = remaining > 0

        return QuotaStatus(
            allowed=allowed,
            remaining=remaining,
            limit=limit,
            reset_time=reset_date.isoformat()
        )

    async def consume_quota(
        self,
        customer_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        style: Optional[str] = None
    ) -> QuotaStatus:
        """
        Atomically consume quota using Firestore transaction

        This prevents race conditions with concurrent requests
        """
        # Determine which quota to consume
        if customer_id:
            doc_ref = self.db.collection('rate_limits').document(f'customer_{customer_id}')
            limit = self.daily_limit
        elif session_id:
            doc_ref = self.db.collection('rate_limits').document(f'session_{session_id}')
            limit = self.burst_limit
        else:
            doc_ref = self.db.collection('rate_limits').document(f'ip_{ip_address}')
            limit = self.daily_limit

        # Atomic transaction
        @firestore.transactional
        def increment_count(transaction, doc_ref):
            snapshot = doc_ref.get(transaction=transaction)

            if not snapshot.exists:
                # First use - initialize
                transaction.set(doc_ref, {
                    'count': 1,
                    'reset_date': self._get_reset_date(),
                    'last_used': firestore.SERVER_TIMESTAMP,
                    'style': style
                })
                return QuotaStatus(
                    allowed=True,
                    remaining=limit - 1,
                    limit=limit,
                    reset_time=self._get_reset_date().isoformat()
                )

            data = snapshot.to_dict()
            current_count = data.get('count', 0)
            reset_date = data.get('reset_date')

            # Check if quota needs reset
            if reset_date < self._get_reset_date():
                transaction.update(doc_ref, {
                    'count': 1,
                    'reset_date': self._get_reset_date(),
                    'last_used': firestore.SERVER_TIMESTAMP,
                    'style': style
                })
                return QuotaStatus(
                    allowed=True,
                    remaining=limit - 1,
                    limit=limit,
                    reset_time=self._get_reset_date().isoformat()
                )

            # Increment count
            new_count = current_count + 1
            transaction.update(doc_ref, {
                'count': new_count,
                'last_used': firestore.SERVER_TIMESTAMP,
                'style': style
            })

            return QuotaStatus(
                allowed=True,
                remaining=max(0, limit - new_count),
                limit=limit,
                reset_time=reset_date.isoformat()
            )

        # Execute transaction
        transaction = self.db.transaction()
        return increment_count(transaction, doc_ref)


# Singleton instance
rate_limiter = RateLimiter()
```

### Step 5: Storage Manager (src/core/storage_manager.py)

```python
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
            blob_path = f"originals/customers/{customer_id}/{image_hash}.jpg"
        elif session_id:
            blob_path = f"originals/temp/{session_id}/{image_hash}.jpg"
        else:
            blob_path = f"originals/temp/anonymous/{image_hash}.jpg"

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
            blob_path = f"generated/customers/{customer_id}/{image_hash}_{style}.jpg"
        elif session_id:
            blob_path = f"generated/temp/{session_id}/{image_hash}_{style}.jpg"
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
            blob_path = f"generated/customers/{customer_id}/{original_hash}_{style}.jpg"
        elif session_id:
            blob_path = f"generated/temp/{session_id}/{original_hash}_{style}.jpg"
        else:
            blob_path = f"generated/temp/anonymous/{original_hash}_{style}.jpg"

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
```

### Step 6: Main FastAPI Application (src/main.py)

```python
"""Main FastAPI application with API endpoints"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import time
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for your domains
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
        "timestamp": time.time()
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


@app.post("/api/v1/batch-generate", response_model=BatchGenerateResponse)
async def batch_generate_styles(request: Request, req: BatchGenerateRequest):
    """
    Generate all 3 artistic styles at once

    Note: Consumes 3 quota (one per style)
    """
    client_ip = request.client.host
    identifiers = {
        "customer_id": req.customer_id,
        "session_id": req.session_id,
        "ip_address": client_ip
    }

    # Check rate limit (need at least 3 remaining)
    quota_before = await rate_limiter.check_rate_limit(**identifiers)
    if not quota_before.allowed or quota_before.remaining < 3:
        raise HTTPException(
            status_code=429,
            detail=f"Need 3 quota for batch generation. Current: {quota_before.remaining}"
        )

    # Store original
    original_url, original_hash = await storage_manager.store_original_image(
        image_data=req.image_data,
        customer_id=req.customer_id,
        session_id=req.session_id
    )

    # Generate all 3 styles
    results = {}
    total_time = 0

    for style in ArtisticStyle:
        # Check cache
        cached_url = await storage_manager.get_cached_generation(
            image_hash=original_hash,
            style=style.value,
            customer_id=req.customer_id,
            session_id=req.session_id
        )

        if cached_url:
            # Cache hit
            results[style.value] = StyleResult(
                style=style.value,
                image_url=cached_url,
                cache_hit=True,
                processing_time_ms=0
            )
        else:
            # Generate
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

            results[style.value] = StyleResult(
                style=style.value,
                image_url=generated_url,
                cache_hit=False,
                processing_time_ms=int(proc_time * 1000)
            )
            total_time += proc_time

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
```

---

## Cloud Infrastructure

### Step 1: Create Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Expose port
EXPOSE 8080

# Run application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Step 2: Create Cloud Run Configuration

```yaml
# deploy-gemini-artistic.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: gemini-artistic-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "5"
    spec:
      containerConcurrency: 10
      timeoutSeconds: 300
      containers:
      - name: gemini-artistic-api
        image: REGION-docker.pkg.dev/PROJECT_ID/REPO/api:latest
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: "2000m"
            memory: "2Gi"
        env:
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: gemini-api-key
              key: api-key
        - name: PROJECT_ID
          value: "YOUR_PROJECT_ID"
        - name: PROJECT_NUMBER
          value: "YOUR_PROJECT_NUMBER"
        - name: GEMINI_MODEL
          value: "gemini-2.5-flash-image"
        - name: STORAGE_BUCKET
          value: "YOUR_BUCKET_NAME"
```

### Step 3: Create Deployment Script

```bash
#!/bin/bash
# scripts/deploy-gemini-artistic.sh

set -e

PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME="gemini-artistic-api"
REPO_NAME="gemini-artistic"

echo "🚀 Deploying Gemini Artistic API..."

# Create Artifact Registry repository
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID \
  --quiet || true

# Build and push container
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/api:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300

echo "✅ Deployment complete!"
gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format 'value(status.url)'
```

### Step 4: Setup Cloud Storage

```bash
# Create storage bucket
gsutil mb -p your-project-id -c STANDARD -l us-central1 gs://your-bucket-name

# Set lifecycle policy for auto-deletion of temp files
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 7,
          "matchesPrefix": ["generated/temp/", "originals/temp/"]
        }
      },
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 180,
          "matchesPrefix": ["generated/customers/", "originals/customers/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://your-bucket-name

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

### Step 5: Setup Firestore

```bash
# Enable Firestore in Native mode
gcloud firestore databases create --region=us-central1 --project=your-project-id

# Create indexes (optional - auto-created on first use)
gcloud firestore indexes composite create \
  --collection-group=rate_limits \
  --field-config field-path=reset_date,order=ASCENDING \
  --field-config field-path=count,order=ASCENDING
```

### Step 6: Setup Secret Manager

```bash
# Create secret for Gemini API key
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  --project=your-project-id

# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Deployment

### Option 1: Automated Deployment Script

```bash
chmod +x scripts/deploy-gemini-artistic.sh
./scripts/deploy-gemini-artistic.sh
```

### Option 2: Manual Deployment

```bash
# 1. Build container
docker build -t gemini-artistic-api .

# 2. Tag for Artifact Registry
docker tag gemini-artistic-api \
  us-central1-docker.pkg.dev/your-project-id/gemini-artistic/api:latest

# 3. Push to registry
docker push us-central1-docker.pkg.dev/your-project-id/gemini-artistic/api:latest

# 4. Deploy to Cloud Run
gcloud run deploy gemini-artistic-api \
  --image us-central1-docker.pkg.dev/your-project-id/gemini-artistic/api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash-image
```

---

## Testing & Verification

### Test Health Endpoint

```bash
SERVICE_URL=$(gcloud run services describe gemini-artistic-api \
  --region us-central1 --format 'value(status.url)')

curl $SERVICE_URL/health
```

### Test Quota Check

```bash
curl "$SERVICE_URL/api/v1/quota?session_id=test_session"
```

### Test Image Generation

```bash
# Convert image to base64
base64 -i test_pet.jpg -o test_pet.b64

# Generate portrait
curl -X POST "$SERVICE_URL/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,'$(cat test_pet.b64)'",
    "style": "bw_fine_art",
    "session_id": "test_session"
  }'
```

---

## Common Pitfalls

### 1. Model Name Error
**Problem**: "Invalid model: gemini-2.5-flash"
**Solution**: Use exact model name: `gemini-2.5-flash-image`

### 2. CORS Issues
**Problem**: Frontend can't connect to API
**Solution**: Configure CORS origins in FastAPI:
```python
allow_origins=[
    "https://your-domain.com",
    "https://*.shopify.com",
]
```

### 3. Rate Limit Race Conditions
**Problem**: Multiple requests exceed quota
**Solution**: Use Firestore transactions (already implemented in rate_limiter.py)

### 4. Empty Image Data
**Problem**: Gemini returns 0-byte image
**Solution**: Validate response parts before processing (already handled in gemini_client.py)

### 5. High Costs
**Problem**: Unexpected GCP bills
**Solution**:
- Keep `min-instances: 0` (scale to zero)
- Set up billing alerts
- Monitor quota consumption
- Implement caching (already included)

### 6. Firestore Permission Denied
**Problem**: Can't write to Firestore
**Solution**:
```bash
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:YOUR_COMPUTE_SA" \
  --role="roles/datastore.user"
```

### 7. Storage 404 Errors
**Problem**: Can't access stored images
**Solution**: Make bucket public:
```bash
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

---

## Performance Optimization Tips

1. **Enable HTTP/2**: Cloud Run uses HTTP/2 by default
2. **Implement Caching**: SHA256-based deduplication (already included)
3. **Batch Processing**: Use `/api/v1/batch-generate` for multiple styles
4. **Connection Pooling**: Reuse Firestore and Storage clients (singletons)
5. **Async Processing**: All methods use `async/await`

---

## Cost Optimization Tips

1. **Scale to Zero**: Always set `min-instances: 0`
2. **Cache Aggressively**: Implement frontend caching too
3. **Rate Limiting**: Prevent abuse (already included)
4. **Lifecycle Policies**: Auto-delete temp files after 7 days
5. **Monitor Usage**: Set up billing alerts at 50%, 75%, 90%

---

## Next Steps

1. **Frontend Integration**: Build JavaScript client
2. **Analytics**: Track usage and performance
3. **A/B Testing**: Measure conversion impact
4. **Additional Styles**: Add more artistic styles
5. **Authentication**: Add Shopify customer auth
6. **Multi-Region**: Deploy to multiple regions

---

**Estimated Build Time**: 4-6 hours for experienced developer
**Monthly Cost**: $150-300 (depends on usage)
**Complexity**: Intermediate (requires GCP and Python knowledge)
