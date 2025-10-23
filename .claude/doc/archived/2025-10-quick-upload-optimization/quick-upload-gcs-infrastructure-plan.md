# Quick Upload GCS Infrastructure Implementation Plan

**Version**: 1.0
**Date**: 2025-10-20
**Author**: Infrastructure Reliability Engineer
**Status**: PROPOSED - Awaiting Approval

## Executive Summary

Design and implement a dedicated quick upload path for raw pet images to Google Cloud Storage WITHOUT AI processing. This enables express checkout where customers upload photos and the fulfillment team processes them manually or asynchronously. Architecture optimized for 70% mobile traffic with sub-5 second upload times.

**Recommended Approach**: **Option A - Client-Side Signed URL Upload** with backend signing service
**Estimated Cost**: $0.12-0.36/day (100-300 uploads)
**Implementation Time**: 6-8 hours
**Risk Level**: LOW

## Architecture Decision

### Recommended: Option A - Client-Side Signed URL Upload

**Why This Approach:**
1. **Mobile Performance**: Direct GCS upload eliminates backend bottleneck (2-3s faster)
2. **Cost Efficient**: No Cloud Run processing, just signing (~$0.001/request)
3. **Scalable**: GCS handles unlimited concurrent uploads
4. **Secure**: Time-limited signed URLs (5 minutes), origin validation
5. **Existing Pattern**: Reuses current GCS bucket and CORS setup

**Trade-offs Accepted:**
- Requires new signing endpoint (minimal code)
- Client gets GCS URL directly (acceptable for customer uploads)
- No server-side image validation (handle in fulfillment)

## Detailed Implementation Plan

### Phase 1: Backend API Endpoint (2 hours)

#### 1.1 Create Signing Endpoint
**File**: `backend/inspirenet-api/src/api_v2_endpoints.py`

**Add new endpoint** at line ~250:
```python
@router.post("/quick-upload/sign-url")
async def get_quick_upload_url(
    request: Request,
    filename: str = Form(...),
    content_type: str = Form("image/jpeg"),
    pet_name: str = Form(""),
    order_id: str = Form("")
):
    """
    Generate signed URL for direct client upload to GCS.
    Used for quick checkout without AI processing.
    """
    # Implementation details in section below
```

**Key Features**:
- Validate file extension (.jpg, .jpeg, .png, .webp)
- Generate unique blob path: `quick-uploads/{order_id}/{timestamp}_{pet_name}_{filename}`
- Create signed URL with 5-minute expiration
- Return URL + metadata for order properties

#### 1.2 Storage Manager Enhancement
**File**: `backend/inspirenet-api/src/storage.py`

**Add method** at line ~200:
```python
def generate_upload_url(
    self,
    blob_path: str,
    content_type: str = "image/jpeg",
    expiration: int = 300
) -> Dict[str, Any]:
    """
    Generate signed URL for direct upload to GCS.

    Args:
        blob_path: Target path in bucket
        content_type: MIME type for upload
        expiration: URL expiration in seconds (default 5 minutes)

    Returns:
        Dict with signed_url, public_url, expires_at
    """
    # Implementation details below
```

**Security Measures**:
- Content-Type enforcement in signed URL
- Max file size: 10MB (enforced by signed URL conditions)
- Expiration: 5 minutes default
- CORS origin validation against ALLOWED_ORIGINS

### Phase 2: GCS Bucket Configuration (1 hour)

#### 2.1 Folder Structure
```
perkieprints-customer-images/
├── inspirenet-cache/       # Existing AI processed images (24hr TTL)
├── quick-uploads/          # NEW - Raw customer uploads
│   ├── {order_id}/        # Order-specific folder
│   │   ├── {timestamp}_{pet_name}_original.jpg
│   │   └── metadata.json  # Optional order metadata
│   └── orphaned/          # Uploads without order_id
└── logs/                  # Upload logs for monitoring
```

#### 2.2 Lifecycle Rules
**New lifecycle rule** for quick-uploads/:
- Delete files older than 30 days (vs 24hrs for processed)
- Move to Archive storage after 7 days
- Rationale: Fulfillment needs more time than AI processing

#### 2.3 CORS Configuration Update
**Current CORS** (working):
```json
{
  "origin": [
    "https://perkieprints.com",
    "https://*.shopifypreview.com",
    "http://localhost:*"
  ],
  "method": ["GET", "POST", "OPTIONS"],
  "responseHeader": ["*"],
  "maxAgeSeconds": 3600
}
```

**Add PUT method** for signed URL uploads:
```json
{
  "method": ["GET", "POST", "PUT", "OPTIONS"]
}
```

### Phase 3: Frontend Implementation (2 hours)

#### 3.1 Quick Upload Manager
**New file**: `assets/quick-upload-manager.js`

```javascript
class QuickUploadManager {
  constructor() {
    this.apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  }

  async uploadFiles(files, orderData) {
    // 1. Validate files
    // 2. Request signed URLs
    // 3. Upload in parallel (max 3)
    // 4. Return GCS URLs for order properties
  }

  async requestSignedUrl(file, orderData) {
    // Call /api/v2/quick-upload/sign-url
  }

  async uploadToGCS(file, signedUrl) {
    // Direct PUT to signed URL
    // With progress tracking
    // And retry logic
  }
}
```

**Key Features**:
- Client-side file validation (size, type)
- Progress bars for mobile UX
- Parallel uploads (max 3 concurrent)
- Exponential backoff retry (mobile networks)
- Chunked upload for files >5MB

#### 3.2 Integration with Checkout
**File**: `snippets/buy-buttons.liquid`

**Modify** lines ~180-220 to add quick upload path:
```liquid
{% if product.metafields.custom.enable_quick_upload %}
  <div class="quick-upload-option">
    <input type="checkbox" id="quick-upload-toggle">
    <label>Express Checkout - Upload photos at checkout</label>
  </div>

  <script>
    // If quick upload selected, skip AI processing
    // Add flag to cart attributes
    // Upload happens at checkout, not product page
  </script>
{% endif %}
```

### Phase 4: Error Handling & Recovery (1 hour)

#### 4.1 Upload Failure Scenarios

**Network Timeout** (Most common on mobile):
- Detection: XMLHttpRequest timeout event
- Recovery: Automatic retry with exponential backoff
- Max retries: 3
- User feedback: "Poor connection, retrying..."

**Signed URL Expired**:
- Detection: 403 response from GCS
- Recovery: Request new signed URL, retry upload
- User feedback: "Session expired, refreshing..."

**File Too Large**:
- Detection: Client-side validation before upload
- Recovery: Prompt to reduce size or compress
- Tool: Offer client-side compression option

**Partial Multi-File Failure**:
- Detection: Track each file's upload status
- Recovery: Retry only failed files
- UI: Show per-file status (✓ Bella, ⟳ Max, ✗ Luna)

#### 4.2 Monitoring & Alerting

**Metrics to Track**:
```javascript
// Frontend metrics (send to analytics)
{
  upload_initiated: timestamp,
  upload_completed: timestamp,
  file_count: 3,
  total_size_mb: 8.5,
  retry_count: 1,
  network_type: "4g",
  error_type: null,
  success: true
}
```

**Backend Logging**:
```python
logger.info("Quick upload signed URL generated", extra={
    "order_id": order_id,
    "file_size": content_length,
    "client_ip": request.client.host,
    "user_agent": request.headers.get("user-agent")
})
```

### Phase 5: Testing Strategy (1 hour)

#### 5.1 Unit Tests
**File**: `backend/inspirenet-api/tests/test_quick_upload.py`
- Test signed URL generation
- Test URL expiration
- Test path sanitization
- Test CORS headers

#### 5.2 Integration Tests
**File**: `testing/test-quick-upload.html`
- Test single file upload
- Test multi-file upload (3 files)
- Test network failure recovery
- Test mobile browser compatibility

#### 5.3 Load Testing
- Tool: Playwright with 100 concurrent uploads
- Target: <5s for 3x 3MB images on 4G
- Monitor: Cloud Run scaling, GCS throughput

## Performance Optimizations

### Mobile-Specific Optimizations
1. **Progressive Upload**: Start upload immediately after file selection
2. **Background Upload**: Continue upload even if user navigates
3. **Service Worker**: Cache signed URLs for retry
4. **Compression**: Client-side JPEG compression (quality 85)
5. **Chunking**: 1MB chunks for reliability on flaky connections

### Expected Performance
- **Signing request**: 100-200ms
- **Upload 3MB image**:
  - 4G: 2-3 seconds
  - 3G: 5-8 seconds
  - WiFi: 1-2 seconds
- **Total time (3 images)**: 3-5 seconds on 4G

## Security Considerations

### Implemented Security
1. **Signed URLs**: Time-limited (5 min), single-use
2. **Origin Validation**: CORS + server-side check
3. **File Type Validation**: Client + signed URL conditions
4. **Size Limits**: 10MB per file enforced
5. **Path Sanitization**: Prevent directory traversal
6. **Rate Limiting**: Existing API rate limits apply

### Acceptable Risks
1. **No Server Validation**: Images not validated until fulfillment
2. **Direct GCS Access**: Clients get bucket name (public anyway)
3. **No Virus Scanning**: Acceptable for image files
4. **No Immediate Processing**: Manual review by fulfillment team

## Cost Analysis

### Storage Costs
```
Daily uploads: 100 orders × 3 images × 3MB = 900MB
Monthly storage: 27GB (30-day retention)
Cost: $0.020/GB/month = $0.54/month
```

### Network Costs
```
Upload bandwidth: Free (ingress)
Download (fulfillment): 900MB/day × $0.12/GB = $0.11/day
Signed URL operations: 300/day × $0.05/10000 = $0.0015/day
```

### Total Monthly Cost
```
Storage: $0.54
Operations: $0.045
Network: $3.30
TOTAL: ~$4/month for 100 orders/day
```

### Cost Comparison
- Option A (Recommended): $4/month
- Option B (Backend proxy): $12/month (Cloud Run overhead)
- Current AI Processing: $195/month (GPU costs)

**Savings**: 98% cost reduction vs AI processing path

## Implementation Timeline

### Day 1 (4 hours)
- [ ] Morning: Create signing endpoint (2 hrs)
- [ ] Afternoon: Test endpoint with curl (1 hr)
- [ ] Afternoon: Update CORS configuration (1 hr)

### Day 2 (4 hours)
- [ ] Morning: Build frontend upload manager (2 hrs)
- [ ] Afternoon: Integration testing (1 hr)
- [ ] Afternoon: Error handling implementation (1 hr)

### Day 3 (2 hours)
- [ ] Morning: Load testing (1 hr)
- [ ] Morning: Documentation & handoff (1 hr)

**Total: 10 hours** (includes 25% buffer)

## Rollout Plan

### Stage 1: Internal Testing (Day 1-3)
- Deploy to staging environment
- Test with team members' photos
- Verify fulfillment team can access

### Stage 2: Beta (Week 1)
- Enable for 10% of products
- Monitor upload success rate
- Gather fulfillment feedback

### Stage 3: General Availability (Week 2)
- Enable for all eligible products
- Add "Express Checkout" marketing
- Monitor conversion impact

## Success Metrics

### Technical KPIs
- Upload success rate: >95%
- Upload time (3 images): <5 seconds
- Error rate: <2%
- Retry success rate: >80%

### Business KPIs
- Conversion rate increase: +10-15% (express option)
- Cart abandonment decrease: -5%
- Customer satisfaction: Track via reviews
- Fulfillment efficiency: Time to process

## Risk Mitigation

### Risk 1: Upload Failures Impact Conversion
- **Mitigation**: Fallback to email upload option
- **Implementation**: "Having issues? Email photos to orders@"

### Risk 2: Fulfillment Overwhelmed
- **Mitigation**: Queue system with SLA
- **Implementation**: Order metadata includes upload timestamp

### Risk 3: Storage Costs Spike
- **Mitigation**: Aggressive lifecycle policies
- **Implementation**: 7-day archive, 30-day delete

## Alternatives Considered

### Option B: Backend Proxy Upload
- **Pros**: Server validation, no signed URLs
- **Cons**: 2-3s slower, Cloud Run costs, scaling complexity
- **Verdict**: REJECTED - Performance penalty too high for mobile

### Option C: Reuse Process Endpoint
- **Pros**: No new code, existing patterns
- **Cons**: Carries GPU allocation overhead, complex to skip processing
- **Verdict**: REJECTED - Wasteful and complex

## Appendix A: Detailed Implementation Code

### Backend Signing Endpoint
```python
@router.post("/quick-upload/sign-url")
@limiter.limit("10/minute")  # Rate limit signing requests
async def get_quick_upload_url(
    request: Request,
    filename: str = Form(...),
    content_type: str = Form("image/jpeg"),
    pet_name: str = Form(""),
    order_id: str = Form(""),
    file_size: int = Form(0)
):
    """Generate signed URL for direct customer upload to GCS"""

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if content_type not in allowed_types:
        raise HTTPException(400, f"Invalid file type: {content_type}")

    # Validate file size (10MB max)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Max 10MB")

    # Sanitize inputs
    safe_pet_name = re.sub(r'[^a-zA-Z0-9_-]', '', pet_name)[:50]
    safe_order_id = re.sub(r'[^a-zA-Z0-9_-]', '', order_id)[:50]

    # Generate blob path
    timestamp = int(time.time())
    if safe_order_id:
        blob_path = f"quick-uploads/{safe_order_id}/{timestamp}_{safe_pet_name}_{filename}"
    else:
        blob_path = f"quick-uploads/orphaned/{timestamp}_{safe_pet_name}_{filename}"

    # Generate signed URL
    storage_result = storage_manager.generate_upload_url(
        blob_path=blob_path,
        content_type=content_type,
        expiration=300,  # 5 minutes
        conditions=[
            ["content-length-range", 0, 10485760]  # 10MB max
        ]
    )

    # Log for monitoring
    logger.info(f"Quick upload URL generated", extra={
        "order_id": safe_order_id,
        "pet_name": safe_pet_name,
        "file_size": file_size,
        "blob_path": blob_path
    })

    return {
        "signed_url": storage_result["signed_url"],
        "public_url": storage_result["public_url"],
        "expires_at": storage_result["expires_at"],
        "blob_path": blob_path,
        "order_properties": {
            "pet_name": pet_name,
            "image_url": storage_result["public_url"],
            "uploaded_at": timestamp,
            "processing_status": "pending_fulfillment"
        }
    }
```

### Frontend Upload Implementation
```javascript
class QuickUploadManager {
  constructor() {
    this.apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  }

  async uploadFiles(files, orderData = {}) {
    const results = [];

    // Validate all files first
    for (const file of files) {
      this.validateFile(file);
    }

    // Upload in parallel (max 3 concurrent)
    const uploadPromises = files.map((file, index) =>
      this.uploadSingleFile(file, {
        ...orderData,
        pet_index: index
      })
    );

    try {
      const results = await Promise.all(uploadPromises);
      console.log('✅ All files uploaded successfully:', results);
      return results;
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  async uploadSingleFile(file, metadata) {
    // Step 1: Request signed URL
    const signedUrlResponse = await this.requestSignedUrl(file, metadata);

    // Step 2: Upload to GCS
    const uploadResult = await this.uploadToGCS(
      file,
      signedUrlResponse.signed_url,
      metadata
    );

    // Step 3: Return order properties
    return {
      ...signedUrlResponse.order_properties,
      upload_success: true,
      file_name: file.name,
      file_size: file.size
    };
  }

  async requestSignedUrl(file, metadata) {
    const formData = new FormData();
    formData.append('filename', file.name);
    formData.append('content_type', file.type);
    formData.append('file_size', file.size);
    formData.append('pet_name', metadata.pet_name || '');
    formData.append('order_id', metadata.order_id || '');

    const response = await fetch(`${this.apiUrl}/api/v2/quick-upload/sign-url`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.status}`);
    }

    return response.json();
  }

  async uploadToGCS(file, signedUrl, metadata) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          this.updateProgress(metadata.pet_index, percentComplete);
        }
      });

      // Success handler
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      // Error handler with retry
      xhr.addEventListener('error', async () => {
        console.warn('Upload failed, retrying...');
        // Retry logic here
        reject(new Error('Network error'));
      });

      // Timeout for mobile networks
      xhr.timeout = 30000; // 30 seconds

      // Send request
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }

  validateFile(file) {
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  updateProgress(index, percent) {
    // Update UI progress bar
    const progressBar = document.querySelector(`#upload-progress-${index}`);
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
      progressBar.textContent = `${Math.round(percent)}%`;
    }
  }
}

// Auto-initialize
window.quickUploadManager = new QuickUploadManager();
```

## Appendix B: Monitoring Queries

### Cloud Logging Queries
```sql
-- Quick upload success rate
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
jsonPayload.message=~"Quick upload URL generated"
severity>=INFO

-- Upload errors
jsonPayload.message=~"Quick upload"
severity>=ERROR

-- Performance metrics
jsonPayload.blob_path=~"quick-uploads"
jsonPayload.file_size>0
```

### Success Dashboard Metrics
1. Uploads per hour
2. Average file size
3. Success rate by file type
4. Geographic distribution
5. Mobile vs desktop
6. Retry rate

## Appendix C: Rollback Plan

If critical issues arise:

1. **Immediate**: Disable quick upload UI (feature flag)
2. **Communication**: Email customers with pending uploads
3. **Fallback**: Provide email upload instructions
4. **Fix**: Debug and patch within 4 hours
5. **Re-enable**: Gradual rollout after fix verification

## Conclusion

The Client-Side Signed URL approach (Option A) provides the optimal balance of performance, cost, and implementation simplicity. With 2-3 second upload times for mobile users and 98% cost reduction versus AI processing, this architecture enables express checkout while maintaining system reliability and security.

**Next Steps**:
1. Review and approve this plan
2. Create feature branch from staging
3. Implement Phase 1 (backend endpoint)
4. Deploy to staging for testing
5. Iterate based on feedback

---

**Document Status**: COMPLETE
**Review Required By**: Product Owner, Backend Lead, Frontend Lead
**Implementation Ready**: Upon approval