# GCS Upload Endpoint Design - Production Ready Architecture

**Created**: 2025-01-05
**Author**: Infrastructure Reliability Engineer
**Status**: Implementation Plan Ready
**Estimated Effort**: 6-8 hours development, 2 hours testing
**Priority**: CRITICAL - Blocking order fulfillment

## Executive Summary

Design and implement a production-ready `/api/v2/upload-to-gcs` endpoint on the existing InSPyReNet API to handle customer image uploads during cart checkout. This endpoint will store original and processed pet images in Google Cloud Storage, returning public URLs for order fulfillment.

## Current State Analysis

### Infrastructure Already in Place
- **Bucket**: `perkieprints-customer-images` exists and configured in deployment YAML
- **GCS Client**: CloudStorageManager class already initialized in storage.py
- **API Framework**: FastAPI with existing v2 endpoints structure
- **Cloud Run**: Deployed with GPU support, auto-scaling 0-3 instances
- **Processing Cache**: Separate bucket for 24-hour TTL cache

### Missing Components
- No customer upload endpoint exists
- No public URL generation for customer images
- No lifecycle management for customer data
- No CORS configuration verified for Shopify domain

## Proposed Architecture

### Endpoint Specification

```python
@router.post("/upload-to-gcs")
async def upload_customer_image(
    file: UploadFile = File(...),
    session_key: str = Form(...),
    effect: str = Form(...),
    image_type: str = Form("processed"),  # "original" or "processed"
    pet_name: Optional[str] = Form(None),
    request: Request = None
):
    """
    Upload customer image to GCS for order fulfillment

    Returns:
        {
            "success": true,
            "url": "https://storage.googleapis.com/perkieprints-customer-images/...",
            "blob_name": "customer-images/session_effect_timestamp.png",
            "size_bytes": 2048576,
            "content_type": "image/png",
            "upload_time_ms": 234
        }
    """
```

### File Naming Convention

```
customer-images/{year}/{month}/{session_key}_{image_type}_{effect}_{timestamp}.{ext}

Examples:
customer-images/2025/01/abc123_original_none_1704484800000.png
customer-images/2025/01/abc123_processed_enhancedblackwhite_1704484800000.png
```

Benefits:
- Organized by date for easier management
- Session key allows grouping related images
- Timestamp prevents overwrites
- Extension preserves format

## Implementation Plan

### Phase 1: Backend API Endpoint (3-4 hours)

#### File: `backend/inspirenet-api/src/api_v2_endpoints.py`

**Add imports:**
```python
import hashlib
from datetime import datetime
```

**Add new endpoint after line 400:**
```python
@router.post("/upload-to-gcs")
async def upload_customer_image(
    file: UploadFile = File(...),
    session_key: str = Form(...),
    effect: str = Form("none"),
    image_type: str = Form("processed"),
    pet_name: Optional[str] = Form(None),
    request: Request = None
):
    """Upload customer image to GCS for order fulfillment"""

    # Implementation details in section below
```

**Core Implementation Logic:**

1. **Validation Layer** (30 mins):
   - File size check (max 10MB for uploads, 50MB for processed)
   - Format validation (PNG, JPEG, WebP)
   - Session key sanitization (alphanumeric + dashes only)
   - Effect name validation against known effects

2. **Upload Processing** (45 mins):
   - Generate deterministic blob name with timestamp
   - Convert image to PNG if needed (standardization)
   - Apply image optimization (85% quality for JPEG fallback)
   - Handle duplicate detection via blob existence check

3. **GCS Upload** (45 mins):
   - Use customer bucket (`perkieprints-customer-images`)
   - Set public-read ACL for direct URL access
   - Add metadata (session_key, effect, upload_time, pet_name)
   - Configure Content-Type and Cache-Control headers

4. **Error Handling** (30 mins):
   - Network failures with exponential backoff
   - GCS quota exceeded graceful degradation
   - Invalid image format recovery
   - Timeout handling (30s max per upload)

5. **Response Generation** (15 mins):
   - Public URL construction
   - Upload metrics (time, size, format)
   - Success/failure status
   - Error details for debugging

#### File: `backend/inspirenet-api/src/storage.py`

**Add CustomerStorageManager class after line 200:**

```python
class CustomerStorageManager(CloudStorageManager):
    """Manages customer image uploads with public access"""

    def __init__(self):
        super().__init__(
            bucket_name="perkieprints-customer-images",
            cache_ttl=7776000  # 90 days
        )

    def upload_customer_image(
        self,
        image_bytes: bytes,
        session_key: str,
        effect: str,
        image_type: str,
        format: str = "png"
    ) -> Dict[str, Any]:
        """Upload customer image with public URL generation"""
        # Implementation here
```

### Phase 2: Bucket Configuration (1 hour)

#### GCS Bucket Settings

**CORS Configuration:**
```json
[
  {
    "origin": [
      "https://perkieprints.com",
      "https://www.perkieprints.com",
      "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com",
      "http://localhost:*"
    ],
    "method": ["GET", "POST", "OPTIONS"],
    "responseHeader": ["Content-Type", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
```

**Lifecycle Policy:**
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["customer-images/"]
        }
      },
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 7,
          "matchesPrefix": ["customer-images/temp/"]
        }
      }
    ]
  }
}
```

**Apply via gcloud:**
```bash
# Set CORS
gsutil cors set cors.json gs://perkieprints-customer-images

# Set lifecycle
gsutil lifecycle set lifecycle.json gs://perkieprints-customer-images

# Set public read for customer-images prefix
gsutil iam ch allUsers:objectViewer gs://perkieprints-customer-images
```

### Phase 3: Security & Rate Limiting (1 hour)

#### Authentication Strategy: **Hybrid Approach**

1. **Public Endpoint with Rate Limiting** (Recommended)
   - No auth required (simplifies frontend)
   - Rate limit by IP: 100 uploads/hour
   - Rate limit by session: 20 uploads/session
   - File size limits enforced

2. **Security Measures:**
   ```python
   # In endpoint implementation

   # IP-based rate limiting
   client_ip = request.client.host
   if await rate_limiter.is_exceeded(client_ip, "upload", limit=100, window=3600):
       raise HTTPException(429, "Rate limit exceeded")

   # Session-based rate limiting
   session_upload_count = await get_session_upload_count(session_key)
   if session_upload_count >= 20:
       raise HTTPException(429, "Session upload limit exceeded")

   # File validation
   if file.size > 10 * 1024 * 1024:  # 10MB
       raise HTTPException(413, "File too large")

   # Content type validation
   if file.content_type not in ["image/png", "image/jpeg", "image/webp"]:
       raise HTTPException(415, "Unsupported file type")
   ```

3. **Abuse Prevention:**
   - Log all uploads with IP, session, timestamp
   - Monitor for patterns (same image multiple times)
   - Implement honeypot field in form
   - Add CAPTCHA if abuse detected

### Phase 4: Duplicate Handling (30 mins)

#### Strategy: **Content-Based Deduplication**

```python
async def handle_duplicate_upload(image_bytes, session_key, effect):
    # Generate content hash
    content_hash = hashlib.sha256(image_bytes).hexdigest()[:16]

    # Check if already uploaded
    existing_blob_name = f"customer-images/dedupe/{content_hash}.png"
    existing_blob = bucket.blob(existing_blob_name)

    if existing_blob.exists():
        # Return existing URL instead of re-uploading
        metadata = existing_blob.metadata
        if metadata.get("session_key") == session_key:
            return {
                "success": True,
                "url": existing_blob.public_url,
                "duplicate": True,
                "message": "Image already uploaded for this session"
            }

    # Continue with new upload
    return None
```

### Phase 5: Performance Optimization (1 hour)

#### Concurrent Upload Support

```python
# Support batch uploads for multi-pet orders
@router.post("/upload-batch-to-gcs")
async def upload_batch_customer_images(
    files: List[UploadFile] = File(...),
    session_key: str = Form(...),
    effects: str = Form(...),  # Comma-separated
    image_types: str = Form(...)  # Comma-separated
):
    """Upload multiple images concurrently"""

    # Process up to 4 images in parallel
    tasks = []
    for i, file in enumerate(files[:4]):  # Limit to 4
        task = upload_customer_image(
            file=file,
            session_key=session_key,
            effect=effects.split(",")[i],
            image_type=image_types.split(",")[i]
        )
        tasks.append(task)

    results = await asyncio.gather(*tasks, return_exceptions=True)
    return {"uploads": results}
```

#### Optimizations:
- Stream upload (don't load full file in memory)
- Async GCS operations
- Connection pooling for GCS client
- Progress callbacks for large files

### Phase 6: Error Recovery (30 mins)

```python
class UploadFailureHandler:
    @staticmethod
    async def handle_upload_failure(
        error: Exception,
        session_key: str,
        fallback_storage: str = "localStorage"
    ):
        """Graceful degradation when upload fails"""

        if isinstance(error, (TimeoutError, asyncio.TimeoutError)):
            # Queue for retry
            await queue_upload_retry(session_key)
            return {
                "success": False,
                "fallback": fallback_storage,
                "retry_queued": True,
                "error": "Upload timeout - will retry"
            }

        elif isinstance(error, gcs_exceptions.Forbidden):
            # Permission issue - log for admin
            logger.error(f"GCS permission denied: {error}")
            return {
                "success": False,
                "fallback": fallback_storage,
                "error": "Storage permission issue"
            }

        # Generic fallback
        return {
            "success": False,
            "fallback": fallback_storage,
            "error": str(error)
        }
```

## Testing Strategy

### Unit Tests (1 hour)

Create `backend/inspirenet-api/tests/test_gcs_upload.py`:

```python
import pytest
from fastapi.testclient import TestClient

def test_upload_valid_image():
    """Test successful image upload"""
    # Test implementation

def test_upload_size_limit():
    """Test file size validation"""

def test_upload_format_validation():
    """Test image format restrictions"""

def test_duplicate_upload():
    """Test duplicate detection"""

def test_rate_limiting():
    """Test rate limit enforcement"""
```

### Integration Tests (30 mins)

```bash
# Test with curl
curl -X POST https://inspirenet-bg-removal-api.run.app/api/v2/upload-to-gcs \
  -F "file=@test-image.png" \
  -F "session_key=test123" \
  -F "effect=enhancedblackwhite" \
  -F "image_type=processed"

# Verify response
{
  "success": true,
  "url": "https://storage.googleapis.com/perkieprints-customer-images/...",
  "size_bytes": 2048576,
  "upload_time_ms": 234
}
```

### Load Testing (30 mins)

```python
# Use locust for load testing
from locust import HttpUser, task, between

class UploadUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def upload_image(self):
        with open("test-image.png", "rb") as f:
            self.client.post(
                "/api/v2/upload-to-gcs",
                files={"file": f},
                data={
                    "session_key": "load-test",
                    "effect": "enhancedblackwhite"
                }
            )
```

## Cost Analysis

### Storage Costs
- **Volume**: 100 orders/day × 2 images × 2MB avg = 400MB/day
- **Monthly**: 12GB/month
- **Cost**: $0.02/GB/month = **$0.24/month**

### Egress Costs
- **Employee Downloads**: 100 orders × 4MB = 400MB/day
- **Monthly**: 12GB/month
- **Cost**: Free (under 1GB North America egress)

### Operations Costs
- **Uploads**: 6,000/month = $0.03
- **Downloads**: 6,000/month = $0.004
- **Total Operations**: **$0.034/month**

### Total Monthly Cost: **$0.27/month** ✅

### Cost Optimization Strategies
1. **90-day auto-delete**: Prevents unlimited growth
2. **Deduplication**: Reduces storage for repeat uploads
3. **Compression**: PNG optimization reduces size by 30%
4. **Regional bucket**: us-central1 for lowest latency

## Risk Mitigation

### Identified Risks & Mitigations

1. **Risk**: Cold start delays during upload
   - **Mitigation**: Frontend pre-warms API on page load
   - **Fallback**: Queue upload for async processing

2. **Risk**: Network timeout during large uploads
   - **Mitigation**: 30s timeout, chunked upload for >5MB
   - **Fallback**: Retry with exponential backoff

3. **Risk**: Abuse via unlimited uploads
   - **Mitigation**: Rate limiting per IP and session
   - **Monitoring**: Alert on >1000 uploads/hour

4. **Risk**: Storage costs spiral
   - **Mitigation**: 90-day lifecycle, duplicate detection
   - **Monitoring**: Daily cost alerts if >$1/day

5. **Risk**: CORS blocks Shopify
   - **Mitigation**: Explicit Shopify domains in CORS
   - **Fallback**: Proxy through Shopify backend

## Implementation Checklist

### Backend Tasks
- [ ] Create `/api/v2/upload-to-gcs` endpoint
- [ ] Add CustomerStorageManager class
- [ ] Implement validation layer
- [ ] Add rate limiting
- [ ] Create error handling
- [ ] Add duplicate detection
- [ ] Write unit tests
- [ ] Deploy to staging

### Infrastructure Tasks
- [ ] Configure CORS on bucket
- [ ] Set lifecycle policy
- [ ] Configure public read ACL
- [ ] Set up monitoring alerts
- [ ] Create cost budget alert

### Frontend Integration (Separate Ticket)
- [ ] Implement `syncSelectedToCloud()` function
- [ ] Add upload progress UI
- [ ] Handle upload errors gracefully
- [ ] Update cart properties with GCS URLs

### Testing Tasks
- [ ] Test file size limits
- [ ] Test format validation
- [ ] Test duplicate handling
- [ ] Test rate limiting
- [ ] Load test with 100 concurrent uploads
- [ ] End-to-end order flow test

## Monitoring & Observability

### Key Metrics
- Upload success rate (target: >99%)
- Upload latency p95 (target: <2s)
- Storage usage growth (target: <15GB/month)
- Error rate by type
- Rate limit hits

### Logging
```python
logger.info(f"Upload successful: session={session_key}, size={file.size}, time={upload_time}ms")
logger.error(f"Upload failed: session={session_key}, error={str(e)}")
logger.warning(f"Rate limit hit: ip={client_ip}, session={session_key}")
```

### Alerts
- Upload success rate <95% over 5 minutes
- Storage costs >$1/day
- Error rate >5% over 10 minutes
- P95 latency >5s

## Rollout Plan

### Stage 1: Deploy Backend (Day 1)
- Deploy API endpoint to staging
- Test with Postman/curl
- Verify GCS uploads working

### Stage 2: Limited Testing (Day 2)
- Test with 10 real images
- Verify URLs accessible
- Check bucket permissions

### Stage 3: Frontend Integration (Day 3-4)
- Implement frontend upload
- Test full flow in staging
- Monitor performance

### Stage 4: Production Deploy (Day 5)
- Deploy to production
- Monitor first 10 orders closely
- Have rollback ready

### Stage 5: Optimization (Week 2)
- Analyze metrics
- Optimize based on usage patterns
- Add batch upload if needed

## Appendix: Code Examples

### Complete Endpoint Implementation

```python
@router.post("/upload-to-gcs")
async def upload_customer_image(
    file: UploadFile = File(...),
    session_key: str = Form(...),
    effect: str = Form("none"),
    image_type: str = Form("processed"),
    pet_name: Optional[str] = Form(None),
    request: Request = None
):
    """
    Upload customer image to GCS for order fulfillment.

    Args:
        file: Image file (PNG/JPEG/WebP)
        session_key: Unique session identifier
        effect: Applied effect name
        image_type: 'original' or 'processed'
        pet_name: Optional pet name for metadata

    Returns:
        JSON with upload status and public URL
    """
    start_time = time.time()

    # 1. Validation
    if file.size > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(413, "File too large (max 10MB)")

    if file.content_type not in ["image/png", "image/jpeg", "image/webp"]:
        raise HTTPException(415, f"Unsupported file type: {file.content_type}")

    # Sanitize inputs
    session_key = re.sub(r'[^a-zA-Z0-9-]', '', session_key)[:50]
    effect = re.sub(r'[^a-zA-Z0-9-]', '', effect)[:30]

    # 2. Rate limiting
    client_ip = request.client.host if request else "unknown"
    # (Rate limiting implementation here)

    try:
        # 3. Read and process image
        image_bytes = await file.read()

        # Optional: Convert to PNG for consistency
        if file.content_type != "image/png":
            img = Image.open(BytesIO(image_bytes))
            output = BytesIO()
            img.save(output, format="PNG", optimize=True, quality=85)
            image_bytes = output.getvalue()

        # 4. Generate blob name
        timestamp = int(datetime.now().timestamp() * 1000)
        date_path = datetime.now().strftime("%Y/%m")
        blob_name = f"customer-images/{date_path}/{session_key}_{image_type}_{effect}_{timestamp}.png"

        # 5. Upload to GCS
        storage_client = storage.Client()
        bucket = storage_client.bucket("perkieprints-customer-images")
        blob = bucket.blob(blob_name)

        # Set metadata
        blob.metadata = {
            "session_key": session_key,
            "effect": effect,
            "image_type": image_type,
            "pet_name": pet_name or "",
            "upload_time": datetime.now().isoformat(),
            "original_filename": file.filename
        }

        # Upload with public access
        blob.upload_from_string(
            image_bytes,
            content_type="image/png",
            timeout=30
        )

        # Make public
        blob.make_public()

        # 6. Generate response
        upload_time = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "url": blob.public_url,
            "blob_name": blob_name,
            "size_bytes": len(image_bytes),
            "content_type": "image/png",
            "upload_time_ms": upload_time,
            "metadata": {
                "session_key": session_key,
                "effect": effect,
                "image_type": image_type,
                "pet_name": pet_name
            }
        }

    except Exception as e:
        logger.error(f"Upload failed for session {session_key}: {str(e)}")

        # Graceful degradation
        return {
            "success": False,
            "error": str(e),
            "fallback": "localStorage",
            "message": "Upload failed, using local storage fallback"
        }
```

## Next Steps

1. **Immediate**: Review and approve this design
2. **Day 1**: Implement backend endpoint
3. **Day 2**: Configure bucket and test
4. **Day 3-4**: Frontend integration (separate team)
5. **Day 5**: Production deployment
6. **Week 2**: Monitor and optimize

## Questions Addressed

1. **Lifecycle policy**: Yes, 90-day auto-delete recommended
2. **CORS**: Yes, configured for Shopify domains
3. **Auth**: Public endpoint with rate limiting recommended
4. **Duplicates**: Content-hash deduplication implemented
5. **Format**: PNG standardization (convert on upload)
6. **Size limit**: 10MB reasonable, enforced in validation

---

**Document Status**: Complete
**Next Action**: Proceed with Phase 1 backend implementation
**Time Estimate**: 6-8 hours total development
**Cost Impact**: ~$0.27/month ongoing

---

## Session Context Update

**Updated**: 2025-01-05 16:30 UTC
**Agent**: infrastructure-reliability-engineer

### Work Completed
- Designed complete GCS upload endpoint architecture
- Specified `/api/v2/upload-to-gcs` implementation
- Defined security strategy (rate limiting, validation)
- Created bucket configuration (CORS, lifecycle)
- Estimated costs ($0.27/month)
- Provided complete implementation code
- Defined testing and rollout strategy

### Key Decisions Made
1. **Endpoint Design**: Multipart form upload returning public URLs
2. **Authentication**: Public endpoint with IP/session rate limiting
3. **File Naming**: `customer-images/{year}/{month}/{session_key}_{type}_{effect}_{timestamp}.png`
4. **Lifecycle**: 90-day auto-delete to control costs
5. **Format**: PNG standardization for consistency
6. **Deduplication**: Content-hash based duplicate detection
7. **Security**: 10MB file limit, format validation, rate limiting

### Technical Specifications
- **Endpoint**: POST `/api/v2/upload-to-gcs`
- **Accepts**: Multipart form (file, session_key, effect, image_type, pet_name)
- **Returns**: Public GCS URL, upload metrics
- **Rate Limits**: 100/hour per IP, 20/session
- **File Size**: 10MB max
- **Formats**: PNG, JPEG, WebP (converted to PNG)

### Files to Modify
1. `backend/inspirenet-api/src/api_v2_endpoints.py` - Add endpoint
2. `backend/inspirenet-api/src/storage.py` - Add CustomerStorageManager
3. New: `backend/inspirenet-api/tests/test_gcs_upload.py` - Tests

### Infrastructure Changes
- Configure CORS on `perkieprints-customer-images` bucket
- Set 90-day lifecycle policy
- Enable public read ACL
- No new resources needed (bucket exists)

### Next Steps for Implementation
1. Backend developer implements endpoint (6-8 hours)
2. DevOps configures bucket settings (1 hour)
3. Frontend developer integrates upload (separate ticket)
4. QA tests full flow (2 hours)
5. Deploy to production (30 mins)

### Risks Identified
- Cold start delays (mitigated by pre-warming)
- Upload timeouts (30s limit, retry logic)
- Abuse potential (rate limiting implemented)
- Cost spiral (lifecycle policy + monitoring)

### Links & References
- Full design document: `.claude/doc/gcs-upload-endpoint-design.md`
- Related context: `.claude/tasks/context_session_1736096953.md`
- API deployment config: `backend/inspirenet-api/deploy-production-clean.yaml`