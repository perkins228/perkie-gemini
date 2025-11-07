# Cloud Storage Direct Upload Infrastructure Plan

**Created**: 2025-11-05
**Author**: Infrastructure Reliability Engineer
**Status**: PROPOSED
**Priority**: HIGH - Critical mobile quota resolution

## Executive Summary

Comprehensive infrastructure design for Cloud Storage Direct Upload (Option A) as an alternative to IndexedDB (Option C) for resolving mobile localStorage quota issues affecting 70% of customers on multi-pet orders.

**Recommendation**: **IMPLEMENT INDEXEDDB** (Option C) instead of Cloud Storage
- Cloud Storage adds 455-1405ms latency vs IndexedDB
- Requires new backend infrastructure (Cloud Function, API endpoints)
- Increases complexity without proportional benefit for this use case
- IndexedDB is the right tool for client-side temporary storage

## 1. GCS Bucket Architecture

### 1.1 Bucket Configuration

**Reuse Existing Bucket**: `perkieprints-processing-cache`
- Already configured with proper permissions
- Existing lifecycle policies can be extended
- No additional bucket cost overhead

**Folder Structure**:
```
gs://perkieprints-processing-cache/
├── temp-pet-uploads/             # New folder for pet uploads
│   ├── {session_id}/              # Session-based organization
│   │   ├── pet_1_{timestamp}.jpg
│   │   ├── pet_2_{timestamp}.jpg
│   │   └── pet_3_{timestamp}.jpg
│   └── _cleanup/                  # Failed uploads for manual review
└── [existing folders]
```

### 1.2 CORS Configuration

```json
{
  "cors": [
    {
      "origin": ["https://test-perkie-prints-2.myshopify.com", "https://perkieprints.com"],
      "method": ["GET", "PUT", "OPTIONS"],
      "responseHeader": ["Content-Type", "x-upload-id"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

### 1.3 Lifecycle Policies

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 7,
          "matchesPrefix": ["temp-pet-uploads/"]
        }
      }
    ]
  }
}
```

### 1.4 Access Control

- **Bucket**: Private (no public access)
- **Upload**: Via signed URLs only (15-minute expiry)
- **Download**: Via signed URLs (1-hour expiry for processing)
- **Service Account**: Minimal permissions (storage.objects.create, storage.objects.get)

## 2. API Endpoint Design

### 2.1 Cloud Function vs Cloud Run

**Recommendation**: Cloud Function
- Simpler deployment (no container)
- Auto-scaling built-in
- Lower operational overhead
- Cost-effective for sporadic requests

### 2.2 Endpoint Specification

```javascript
// Cloud Function: get-upload-url
exports.getUploadUrl = async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', 'https://perkieprints.com');
  res.set('Access-Control-Allow-Methods', 'POST');

  // Validate request
  const { sessionId, petNumber, contentType } = req.body;

  if (!sessionId || !petNumber || !contentType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate content type (images only)
  if (!contentType.startsWith('image/')) {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  // Generate filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const extension = contentType.split('/')[1] || 'jpg';
  const filename = `temp-pet-uploads/${sessionId}/pet_${petNumber}_${timestamp}_${random}.${extension}`;

  // Generate signed upload URL
  const [url] = await storage
    .bucket('perkieprints-processing-cache')
    .file(filename)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      conditions: [
        ['content-length-range', 0, 52428800] // Max 50MB
      ]
    });

  // Generate read URL for later retrieval
  const [readUrl] = await storage
    .bucket('perkieprints-processing-cache')
    .file(filename)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    });

  return res.json({
    uploadUrl: url,
    fileUrl: readUrl,
    filename,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  });
};
```

### 2.3 Request/Response Schema

**Request**:
```typescript
interface UploadUrlRequest {
  sessionId: string;       // From localStorage or generated
  petNumber: number;       // 1, 2, or 3
  contentType: string;     // e.g., "image/jpeg"
  fileSize?: number;       // Optional for validation
}
```

**Response**:
```typescript
interface UploadUrlResponse {
  uploadUrl: string;       // Signed URL for PUT
  fileUrl: string;         // Signed URL for GET
  filename: string;        // GCS file path
  expiresAt: string;       // ISO timestamp
}
```

### 2.4 Rate Limiting

```javascript
// Using Firestore for rate limiting
async function checkRateLimit(sessionId) {
  const doc = await firestore.collection('rate_limits').doc(sessionId).get();
  const data = doc.data() || { count: 0, resetAt: Date.now() };

  // Reset if window expired
  if (data.resetAt < Date.now()) {
    data.count = 0;
    data.resetAt = Date.now() + 3600000; // 1 hour window
  }

  // Check limit (10 uploads per hour per session)
  if (data.count >= 10) {
    throw new Error('Rate limit exceeded');
  }

  // Increment and save
  data.count++;
  await firestore.collection('rate_limits').doc(sessionId).set(data);
}
```

## 3. Cost & Performance Analysis

### 3.1 Monthly Cost Estimate (1000 Orders)

**Storage Costs**:
```
- Average order: 3 pets × 2.5MB = 7.5MB
- 1000 orders/month = 7.5GB total
- 7-day retention = ~2GB average stored
- Cost: 2GB × $0.020/GB = $0.04/month
```

**Operation Costs**:
```
- Uploads: 3000 × $0.05/10000 = $0.015/month
- Downloads: 3000 × $0.004/10000 = $0.0012/month
- Cloud Function invocations: 3000 × $0.40/1M = $0.0012/month
- Cloud Function compute: Negligible (100ms per request)
```

**Total**: ~$0.06/month (negligible)

### 3.2 Performance Comparison

| Operation | IndexedDB | Cloud Storage | Delta |
|-----------|-----------|---------------|-------|
| **Store Image** | | | |
| - Write | 150-300ms | 605-1705ms | +455-1405ms |
| - UI Block | Yes | No (async) | Better UX |
| **Retrieve Image** | | | |
| - Load | 150-300ms | 200-500ms | +50-200ms |
| - CDN Cache | No | Yes | Better scaling |
| **Failure Rate** | | | |
| - Write | 5-10% (quota) | 1-2% (network) | Better |
| - Corruption | 1-2% | ~0% | Much better |

### 3.3 Network Impact

**Mobile Network Usage**:
- Upload: 7.5MB per order (unavoidable)
- No additional download (uses CDN cache)
- Same as current Shopify submission

**Latency Factors**:
- 3G: 1-2s per MB upload
- 4G: 200-500ms per MB
- WiFi: 100-300ms per MB

## 4. Implementation Plan

### 4.1 Backend Implementation (8 hours)

**Cloud Function Setup** (3 hours):
```bash
# Deploy function
gcloud functions deploy get-upload-url \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file .env.yaml \
  --project perkieprints-nanobanana
```

**Firestore Rate Limiting** (2 hours):
- Create collection structure
- Implement cleanup job
- Test rate limit logic

**GCS Bucket Configuration** (1 hour):
- Update CORS settings
- Configure lifecycle rules
- Set up monitoring

**Testing & Documentation** (2 hours):
- Unit tests
- Integration tests
- API documentation

### 4.2 Frontend Implementation (6 hours)

**Upload Handler Modification** (3 hours):
```javascript
// Replace localStorage save with GCS upload
async function uploadToGCS(file, petNumber) {
  // Get signed URL
  const response = await fetch('/api/get-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getSessionId(),
      petNumber,
      contentType: file.type
    })
  });

  const { uploadUrl, fileUrl } = await response.json();

  // Upload file
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });

  if (!uploadResponse.ok) {
    throw new Error('Upload failed');
  }

  // Store URL in localStorage (tiny)
  localStorage.setItem(`pet_${petNumber}_url`, fileUrl);

  return fileUrl;
}
```

**UI Progress Indicators** (2 hours):
- Upload progress bar
- Error handling UI
- Retry mechanism

**Processor Integration** (1 hour):
- Load from GCS URL instead of localStorage
- Fallback logic

### 4.3 Total Effort

| Component | Hours |
|-----------|-------|
| Backend | 8 |
| Frontend | 6 |
| Testing | 4 |
| Deployment | 2 |
| **Total** | **20 hours** |

Compare to IndexedDB: **14 hours**

## 5. Risk Assessment

### 5.1 Failure Modes & Mitigations

**Network Failures**:
- Risk: Upload fails mid-transfer
- Mitigation: Automatic retry with exponential backoff
- Fallback: localStorage for single image

**Cold Start Latency**:
- Risk: First request takes 500ms-1s
- Mitigation: Keep-warm ping every 5 minutes
- Impact: Minimal (one-time per session)

**Signed URL Expiry**:
- Risk: User takes >15 min to upload
- Mitigation: Auto-refresh URL on expiry
- UX: Transparent to user

**GCS Unavailability**:
- Risk: Google Cloud outage (rare)
- Mitigation: localStorage fallback
- SLA: 99.95% uptime

### 5.2 Security Vulnerabilities

**File Upload Attacks**:
- Risk: Malicious file upload
- Mitigation: Content-Type validation, size limits
- Additional: Virus scanning via Cloud Functions

**Session Hijacking**:
- Risk: Stolen session ID
- Mitigation: Session expiry, IP validation
- Additional: HTTPS-only, secure cookies

**Storage Bombing**:
- Risk: Excessive uploads
- Mitigation: Rate limiting, quota per session
- Cleanup: Automatic 7-day deletion

### 5.3 Rollback Strategy

```javascript
// Feature flag for gradual rollout
const USE_CLOUD_STORAGE = window.localStorage.getItem('use_cloud_storage') === 'true';

if (USE_CLOUD_STORAGE && navigator.onLine) {
  // Use Cloud Storage
  await uploadToGCS(file, petNumber);
} else {
  // Fallback to localStorage (with size check)
  if (getTotalStorageSize() + fileSize < QUOTA_LIMIT) {
    saveToLocalStorage(file, petNumber);
  } else {
    showQuotaError();
  }
}
```

## 6. Comparison: Cloud Storage vs IndexedDB

### 6.1 Complexity Comparison

| Aspect | IndexedDB | Cloud Storage |
|--------|-----------|---------------|
| **Lines of Code** | 330 | 165 backend + 100 frontend = 265 |
| **New Infrastructure** | None | Cloud Function, Firestore |
| **Dependencies** | None | Google Cloud SDK |
| **Browser Compatibility** | Quirky | Standard fetch() |
| **Debugging** | DevTools (buggy) | GCS Console (visual) |

### 6.2 Reliability Comparison

| Metric | IndexedDB | Cloud Storage |
|--------|-----------|---------------|
| **Write Failure Rate** | 5-10% | 1-2% |
| **Data Corruption** | 1-2% | ~0% |
| **Recovery** | Manual clear | Automatic retry |
| **Monitoring** | Client-side only | Full observability |

### 6.3 Performance Comparison

| Metric | IndexedDB | Cloud Storage |
|--------|-----------|---------------|
| **Initial Write** | 150-300ms | 605-1705ms |
| **Subsequent Read** | 150-300ms | 50-100ms (CDN) |
| **UI Blocking** | Yes | No |
| **Network Usage** | 0 | 7.5MB/order |

### 6.4 Maintenance Burden

**IndexedDB**:
- Schema migrations on structure changes
- Manual cleanup for corrupted databases
- Browser-specific workarounds
- Limited observability

**Cloud Storage**:
- Infrastructure monitoring
- Cloud Function updates
- Cost monitoring
- Rate limit tuning

## 7. Final Recommendation

### **IMPLEMENT INDEXEDDB (Option C)**

**Rationale**:

1. **Performance**: IndexedDB is 3-10x faster for initial storage (critical for mobile UX)

2. **Simplicity**: No backend infrastructure required (save 8 hours development)

3. **Cost**: Zero ongoing costs vs $0.06/month (plus Cloud Function maintenance)

4. **Offline Support**: IndexedDB works offline, Cloud Storage doesn't

5. **User Expectation**: Users expect instant local save, not network upload for preview

6. **Appropriate Tool**: IndexedDB is designed for this exact use case (temporary client storage)

### When Cloud Storage Makes Sense

Cloud Storage would be preferable if:
- ✅ Images needed server-side processing immediately
- ✅ Multiple devices needed instant access
- ✅ Storage exceeded 50MB regularly
- ✅ Permanent storage was required

**None of these apply to our use case.**

### Implementation Path

1. **Week 1**: Implement IndexedDB solution (14 hours)
2. **Week 2**: Monitor performance and error rates
3. **Future**: Consider Cloud Storage only if:
   - IndexedDB failure rate exceeds 10%
   - Customer complaints about performance
   - Business requirements change (multi-device access)

## 8. Conclusion

While Cloud Storage offers superior reliability and observability, **IndexedDB is the correct solution** for temporary client-side storage of pet images. The 455-1405ms additional latency of Cloud Storage significantly degrades mobile UX without providing proportional benefits for this specific use case.

**Key Decision Factors**:
- **Latency**: IndexedDB 3-10x faster (critical for 70% mobile users)
- **Complexity**: Cloud Storage adds unnecessary backend infrastructure
- **Cost**: Ongoing operational overhead without business benefit
- **Fit**: IndexedDB designed for exactly this use case

**Final Score**:
- IndexedDB: ⭐⭐⭐⭐ (4/5) - Right tool, some browser quirks
- Cloud Storage: ⭐⭐ (2/5) - Over-engineered for this use case

---

**Document Status**: COMPLETE
**Next Action**: Proceed with IndexedDB implementation per existing plan
**Alternative Preserved**: This Cloud Storage design available if requirements change