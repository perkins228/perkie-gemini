# Original Image Storage Implementation Plan

## Executive Summary

**CRITICAL GAP**: The pet processor system currently NEVER stores original uploaded images, only processed versions. This is a fundamental architecture flaw that prevents order fulfillment and customer service recovery.

**Business Impact**: 
- Cannot fulfill orders if processed image is corrupted
- No fallback for customer disputes
- No ability to reprocess with different effects
- Fulfillment team lacks critical source material

**Proposed Solution**: Hybrid cloud storage approach with parallel upload of originals alongside API processing.

## Current Architecture Analysis

### Data Flow (BROKEN)
```
1. User uploads image → Browser File object (memory only)
2. File sent to InSPyReNet API for processing
3. API returns processed image URLs
4. Original File object lost (never uploaded anywhere)
5. Order admin expects _original_image_url but it's never populated
```

### Key Files Involved
- `assets/pet-processor.js` - Handles file upload (line 485: stores File object locally)
- `assets/cart-pet-integration.js` - Populates line item properties (missing original URL)
- `backend/inspirenet-api/src/simple_storage_api.py` - Existing upload endpoint (unused)
- `snippets/order-custom-images.liquid` - Expects `_original_image_url` (lines 151-152)

## Proposed Solution Architecture

### Option A: Parallel Upload (RECOMMENDED) ⭐
Upload original to Cloud Storage WHILE sending to API for processing.

**Advantages**:
- Fastest user experience (parallel operations)
- Original secured immediately
- No API modification needed
- Works with existing ES5 constraints

**Implementation**:
1. User uploads image
2. **Parallel Operations**:
   - Upload original to Cloud Storage via simple endpoint
   - Send to InSPyReNet for processing
3. Store both URLs in line item properties

### Option B: API-Integrated Storage
Modify InSPyReNet API to store originals during processing.

**Advantages**:
- Single request (simpler frontend)
- Atomic operation

**Disadvantages**:
- Increases API response time
- Requires API deployment
- Higher GPU instance costs

### Option C: Deferred Upload
Store original after processing completes.

**Disadvantages**:
- Risk of browser closing
- Slower perceived performance
- Complex error handling

## Detailed Implementation Plan (Option A)

### Phase 1: API Endpoint Setup (2 hours)

#### 1.1 Create Simple Upload Endpoint
**File**: `backend/inspirenet-api/src/original_upload_endpoint.py`
```python
@app.post("/upload-original")
async def upload_original(
    file: UploadFile,
    session_id: str
) -> dict:
    """
    Upload original pet image to Cloud Storage
    Returns public URL for Shopify order storage
    """
    # Validate file (size, type)
    # Generate secure filename
    # Upload to GCS bucket
    # Return public URL
```

**Security Requirements**:
- Max file size: 50MB (mobile photos)
- Allowed types: image/jpeg, image/png, image/webp
- Filename sanitization with UUID
- Rate limiting: 10 uploads/minute per IP

#### 1.2 Storage Configuration
**Bucket**: `perkieprints-customer-images`
**Structure**: `originals/{year}/{month}/{session_id}/{timestamp}_{uuid}_original.jpg`
**Retention**: 
- Hot storage: 30 days
- Nearline: 90 days  
- Coldline: 1 year
- Delete after 1 year

### Phase 2: Frontend Integration (4 hours)

#### 2.1 Modify Pet Processor
**File**: `assets/pet-processor.js`
**Changes at line 462-487**:

```javascript
async processFile(file) {
  // Validate file
  if (!file.type.startsWith('image/')) {
    this.showError('Please select an image file');
    return;
  }
  
  // NEW: Upload original in parallel
  const uploadPromise = this.uploadOriginal(file);
  const processPromise = this.callAPI(file);
  
  try {
    // Wait for both operations
    const [originalUrl, processedResult] = await Promise.all([
      uploadPromise,
      processPromise
    ]);
    
    // Store complete pet data
    const petData = {
      id: `pet_${crypto.randomUUID()}`,
      filename: file.name,
      originalFile: file,  // Keep for local preview
      originalUrl: originalUrl,  // NEW: Cloud Storage URL
      ...processedResult
    };
    
    this.addPet(petData);
  } catch (error) {
    this.handleError(error);
  }
}

// NEW: Upload original to Cloud Storage
async uploadOriginal(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', this.getSessionId());
  
  const response = await fetch(`${this.apiUrl}/upload-original`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload original');
  }
  
  const data = await response.json();
  return data.url;
}
```

#### 2.2 Update Cart Integration (ES5)
**File**: `assets/cart-pet-integration.js`
**Add at line 100**:

```javascript
// Create or update original image URL field
var originalUrlField = form.querySelector('[name="properties[_original_image_url]"]');
if (!originalUrlField) {
  originalUrlField = document.createElement('input');
  originalUrlField.type = 'hidden';
  originalUrlField.name = 'properties[_original_image_url]';
  originalUrlField.id = 'original-url-' + sectionId;
  form.appendChild(originalUrlField);
}
originalUrlField.value = petData.originalUrl || '';
```

### Phase 3: Mobile Optimization (2 hours)

#### 3.1 Image Compression
Before upload, resize images client-side for mobile:

```javascript
async compressForUpload(file) {
  // Skip if already small
  if (file.size < 2 * 1024 * 1024) return file;
  
  // Resize to max 2048px maintaining aspect ratio
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  // ... compression logic ...
  
  return new File([blob], file.name, { type: 'image/jpeg' });
}
```

#### 3.2 Progressive Upload with Feedback
Show upload progress for better mobile UX:

```javascript
// Use XMLHttpRequest for progress tracking
const xhr = new XMLHttpRequest();
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) {
    const percentComplete = (e.loaded / e.total) * 100;
    this.updateProgress('Securing original...', percentComplete);
  }
};
```

### Phase 4: Error Handling & Recovery (2 hours)

#### 4.1 Retry Logic
Implement exponential backoff for network failures:

```javascript
async uploadWithRetry(file, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.uploadOriginal(file);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### 4.2 Fallback Storage
If upload fails, store in IndexedDB temporarily:

```javascript
async storeLocalFallback(file, sessionId) {
  const db = await openDB('PerkiePrints', 1);
  await db.put('pending_uploads', {
    id: sessionId,
    file: file,
    timestamp: Date.now()
  });
}
```

## Performance Considerations

### Expected Latencies
- **Original Upload**: 1-3s on 4G (parallel with processing)
- **API Processing**: 3s warm, 11s cold
- **Total Time**: No change (parallel operations)

### Mobile Optimization (70% Traffic)
- Client-side compression before upload
- Progressive feedback during upload
- Retry with exponential backoff
- IndexedDB fallback for offline

### Cost Analysis
- **Storage**: ~$0.02/GB/month (hot storage)
- **Bandwidth**: ~$0.12/GB egress
- **Expected**: $50-100/month for 5000 orders

## Security Considerations

### Upload Security
- File type validation (MIME + magic bytes)
- Size limits (50MB max)
- Filename sanitization
- Rate limiting
- CORS configuration

### Storage Security
- Public read for order fulfillment
- No directory listing
- UUID in filenames
- Time-based organization

### Privacy
- 1-year retention policy
- GDPR compliance logging
- Customer data deletion on request

## Migration & Rollback Plan

### Deployment Steps
1. Deploy API endpoint (no impact)
2. Test with staging environment
3. Update frontend with feature flag
4. Gradual rollout (10% → 50% → 100%)
5. Monitor error rates

### Rollback Strategy
- Feature flag to disable uploads
- Fallback to current behavior
- No data loss (additive change)

## Testing Strategy

### Unit Tests
- File validation logic
- Upload retry mechanism
- Error handling

### Integration Tests
- End-to-end upload flow
- Network failure scenarios
- Mobile device testing

### Performance Tests
- Upload times on 3G/4G/5G
- Concurrent upload handling
- Memory usage on mobile

## Monitoring & Alerting

### Key Metrics
- Upload success rate (target: >99%)
- Upload latency P50/P95/P99
- Storage usage growth
- Error rates by type

### Alerts
- Upload success rate <95%
- Latency P95 >5s
- Storage quota approaching
- Repeated failures from IP

## Implementation Timeline

### Week 1
- Day 1-2: API endpoint development
- Day 3-4: Frontend integration
- Day 5: Testing and bug fixes

### Week 2
- Day 1-2: Mobile optimization
- Day 3-4: Error handling
- Day 5: Staging deployment

### Week 3
- Day 1-2: Production testing
- Day 3: Gradual rollout
- Day 4-5: Monitoring and optimization

## Critical Success Factors

1. **Zero Impact on UX**: Parallel upload must not slow processing
2. **Mobile Performance**: Must work on 3G connections
3. **100% Capture Rate**: Every order must have original
4. **Error Recovery**: Graceful handling of failures
5. **Cost Control**: Storage costs under budget

## Recommended Next Steps

1. **IMMEDIATE**: Implement basic upload endpoint (2 hours)
2. **TODAY**: Update cart integration to capture URL (1 hour)
3. **TOMORROW**: Add mobile optimization (2 hours)
4. **THIS WEEK**: Deploy to staging for testing
5. **NEXT WEEK**: Production rollout with monitoring

## Alternative Approaches Considered

### Browser-to-Browser Storage
Store in IndexedDB and sync later.
**Rejected**: Risk of data loss if browser cleared.

### Base64 in Line Items
Store image as base64 in Shopify properties.
**Rejected**: Size limits, performance impact.

### CDN Direct Upload
Use Cloudflare/Fastly for uploads.
**Rejected**: Additional vendor complexity.

## Appendix: Code Examples

### Complete Upload Function (ES5 Compatible)
```javascript
function uploadOriginalImage(file, callback) {
  var xhr = new XMLHttpRequest();
  var formData = new FormData();
  
  formData.append('file', file);
  formData.append('session_id', getSessionId());
  
  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      var percent = (e.loaded / e.total) * 100;
      updateProgress('Uploading original: ' + percent + '%');
    }
  };
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      var response = JSON.parse(xhr.responseText);
      callback(null, response.url);
    } else {
      callback(new Error('Upload failed'));
    }
  };
  
  xhr.onerror = function() {
    callback(new Error('Network error'));
  };
  
  xhr.open('POST', API_URL + '/upload-original');
  xhr.send(formData);
}
```

### Session ID Generation
```javascript
function getSessionId() {
  var stored = localStorage.getItem('perkie_session_id');
  if (stored) return stored;
  
  var newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('perkie_session_id', newId);
  return newId;
}
```

## Questions Answered

1. **Should we upload originals BEFORE or AFTER API processing?**
   - **BEFORE/PARALLEL**: Ensures capture even if processing fails

2. **Can we modify the API to store originals during processing?**
   - **YES**, but parallel upload is faster and more reliable

3. **What's the most efficient architecture to minimize latency?**
   - **Parallel upload + processing**: No added latency

4. **How do we handle large images on mobile (70% traffic)?**
   - **Client-side compression + progressive upload + retry logic**

5. **Should we use signed URLs or public URLs for originals?**
   - **Public URLs**: Simpler for fulfillment team access

## Contact for Questions

This plan addresses the critical gap in order fulfillment data capture. The parallel upload approach provides the best balance of performance, reliability, and user experience while maintaining ES5 compatibility for mobile devices.

---
*Document Version: 1.0*
*Created: 2025-08-31*
*Status: Ready for Implementation*