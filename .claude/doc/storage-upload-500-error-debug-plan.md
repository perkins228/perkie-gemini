# Storage Upload 500 Error - Debug & Fix Plan

**Session**: 1736365200
**Date**: 2025-10-08
**Status**: Implementation Ready
**Priority**: Immediate (24 hours)

---

## Executive Summary

The `/api/storage/upload` endpoint is returning 500 errors when processing image uploads from Safari on macOS. Root cause analysis reveals inadequate error handling that treats client-side data format issues as server errors. The fix requires robust input validation, proper error classification (400 vs 500), and comprehensive logging.

---

## 1. Root Cause Analysis

### Primary Issue: Inadequate Data URL Parsing
**Location**: `backend/inspirenet-api/src/simple_storage_api.py` lines 52, 90

**Current Code:**
```python
# Line 52 - VULNERABLE CODE
header, base64_data = original_data.split(',', 1)
```

**Failure Modes:**
1. **ValueError**: If `original_data` contains no comma → crashes with 500
2. **No validation**: Assumes data URL is well-formed
3. **Wrong status code**: Client error (malformed data) → server error (500)

### Secondary Issues

#### 1. Base64 Decoding Without Validation
**Location**: Lines 53, 57, 91, 94

**Current Code:**
```python
image_bytes = base64.b64decode(base64_data)  # No validation flag
```

**Problems:**
- No `validate=True` parameter
- Silently accepts invalid base64
- Can decode garbage data

#### 2. Missing Input Validation
**Problems:**
- No check for empty `request.images`
- No validation of data URL format before parsing
- No size limits before decoding
- No content type validation before processing

#### 3. Generic Exception Handling
**Location**: Line 156

**Current Code:**
```python
except Exception as e:
    logger.error(f"Error uploading customer images: {str(e)}")
    raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
```

**Problems:**
- ALL errors become 500 (server error)
- Client errors (bad data) should be 400
- Infrastructure errors (GCS down) should be 503
- Only true application bugs should be 500

---

## 2. Safari-Specific Considerations

### Safari Data URL Behavior

Safari's `FileReader.readAsDataURL()` typically returns standard format:
```
data:image/jpeg;base64,/9j/4AAQSkZJRg...
```

However, edge cases that could cause issues:

1. **Empty files**: Safari might return `data:,` (comma but no base64)
2. **Corrupted reads**: Network interruption during FileReader
3. **Large files**: Safari might truncate or fail silently
4. **Special MIME types**: HEIC images converted to JPEG might have unusual formats

### Test Cases Needed
1. Empty file (0 bytes)
2. Tiny file (1 byte)
3. Corrupted data URL (no comma)
4. Invalid base64 (contains spaces, newlines)
5. Wrong MIME type (not image/*)
6. Oversized file (> 10MB)
7. HEIC image from iPhone (Safari converts to JPEG)

---

## 3. Implementation Plan

### File to Modify
**Path**: `backend/inspirenet-api/src/simple_storage_api.py`

### Changes Required

#### Step 1: Add Input Validation Helper
**Location**: Add before `upload_customer_images` function

```python
def validate_and_parse_data_url(data_url: str, image_type: str = "image") -> tuple[bytes, str]:
    """
    Safely parse and validate a data URL.

    Args:
        data_url: The data URL string to parse
        image_type: Expected image type for logging

    Returns:
        tuple: (image_bytes, mime_type)

    Raises:
        HTTPException: 400 for invalid input, 500 for processing errors
    """
    # Validate input is not empty
    if not data_url or not isinstance(data_url, str):
        logger.error(f"Invalid {image_type} data: empty or not a string")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {image_type} data: must be a non-empty string"
        )

    # Check for basic size sanity (before decoding)
    if len(data_url) > 15 * 1024 * 1024:  # ~15MB encoded = ~11MB decoded
        logger.error(f"{image_type} data URL too large: {len(data_url)} chars")
        raise HTTPException(
            status_code=413,
            detail=f"{image_type} data URL exceeds maximum size"
        )

    try:
        # Handle data URL format
        if data_url.startswith('data:'):
            # Validate presence of comma separator
            if ',' not in data_url:
                logger.error(f"Malformed {image_type} data URL: no comma separator")
                logger.debug(f"Data URL prefix: {data_url[:100]}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data URL format: missing comma separator"
                )

            # Split header and data
            try:
                header, base64_data = data_url.split(',', 1)
            except ValueError as e:
                logger.error(f"Failed to split {image_type} data URL: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Malformed {image_type} data URL"
                )

            # Validate we have actual data after the comma
            if not base64_data or len(base64_data) < 10:
                logger.error(f"{image_type} data URL has no base64 data after comma")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data: no content after data URL header"
                )

            # Extract and validate MIME type
            try:
                if ':' in header and ';' in header:
                    mime_type = header.split(':')[1].split(';')[0]
                else:
                    # Malformed header, use default
                    logger.warning(f"Malformed {image_type} data URL header: {header}")
                    mime_type = 'image/jpeg'
            except (IndexError, ValueError) as e:
                logger.error(f"Failed to parse {image_type} MIME type from header: {e}")
                mime_type = 'image/jpeg'

            # Decode base64 with validation
            try:
                image_bytes = base64.b64decode(base64_data, validate=True)
            except Exception as e:
                logger.error(f"Base64 decode failed for {image_type}: {e}")
                logger.debug(f"Base64 prefix: {base64_data[:100]}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data: corrupt or invalid base64 encoding"
                )

        else:
            # Already base64 (no data URL prefix)
            logger.info(f"{image_type} provided as raw base64 (no data URL prefix)")

            try:
                image_bytes = base64.b64decode(data_url, validate=True)
                mime_type = 'image/jpeg'  # Default for raw base64
            except Exception as e:
                logger.error(f"Base64 decode failed for raw {image_type} data: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {image_type} data: corrupt or invalid base64 encoding"
                )

        # Validate decoded size
        if len(image_bytes) == 0:
            logger.error(f"{image_type} decoded to zero bytes")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid {image_type}: file is empty"
            )

        # Validate MIME type
        if mime_type not in ALLOWED_CONTENT_TYPES:
            logger.error(f"Invalid {image_type} MIME type: {mime_type}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {mime_type}. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}"
            )

        logger.info(f"Successfully parsed {image_type}: {len(image_bytes)} bytes, type: {mime_type}")
        return image_bytes, mime_type

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Unexpected error during parsing (server error)
        logger.error(f"Unexpected error parsing {image_type} data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error processing {image_type} data"
        )
```

#### Step 2: Replace Image Processing Logic
**Location**: Replace lines 46-82 (original image processing)

```python
# Upload original image
if 'original' in request.images:
    try:
        # Parse and validate data URL
        image_bytes, mime_type = validate_and_parse_data_url(
            request.images['original'],
            "original image"
        )

        # Security validation: size limit
        if len(image_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Original image too large ({len(image_bytes) // 1024 // 1024}MB, max {MAX_FILE_SIZE // 1024 // 1024}MB)"
            )

        # Generate secure filename
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        random_id = uuid.uuid4().hex[:8]
        filename = f"orders/{request.session_id}/{timestamp}_{random_id}_original.jpg"

        # Upload to GCS
        blob = bucket.blob(filename)
        blob.upload_from_string(image_bytes, content_type=mime_type)
        blob.make_public()

        # Get public URL
        urls['original'] = f"https://storage.googleapis.com/perkieprints-customer-images/{filename}"

        logger.info(f"✓ Uploaded original image: {urls['original']} ({len(image_bytes) // 1024}KB)")

    except HTTPException:
        # Re-raise client/server errors
        raise
    except Exception as e:
        # GCS or other infrastructure errors
        logger.error(f"Failed to upload original image to GCS: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Storage service temporarily unavailable"
        )
```

#### Step 3: Replace Processed Image Logic
**Location**: Replace lines 84-120 (processed image)

Use identical pattern as above, just change:
- `"original image"` → `"processed image"`
- `filename` suffix from `_original.jpg` → `_{effect}.jpg`

#### Step 4: Add Request-Level Validation
**Location**: Beginning of `upload_customer_images` function (after line 38)

```python
# Validate request structure
if not request.images:
    raise HTTPException(
        status_code=400,
        detail="No images provided in request"
    )

if 'original' not in request.images and 'processed' not in request.images:
    raise HTTPException(
        status_code=400,
        detail="At least one image (original or processed) must be provided"
    )

# Validate session ID
if not request.session_id or len(request.session_id) > 200:
    raise HTTPException(
        status_code=400,
        detail="Invalid session_id: must be 1-200 characters"
    )
```

#### Step 5: Improve GCS Initialization
**Location**: Replace lines 39-41

```python
# Initialize GCS client with error handling
try:
    client = storage.Client()
    bucket = client.bucket('perkieprints-customer-images')

    # Verify bucket exists (only checks metadata, doesn't load objects)
    if not bucket.exists():
        logger.error("GCS bucket 'perkieprints-customer-images' does not exist")
        raise HTTPException(
            status_code=503,
            detail="Storage service unavailable"
        )

except HTTPException:
    raise
except Exception as e:
    logger.error(f"Failed to initialize GCS client: {e}", exc_info=True)
    raise HTTPException(
        status_code=503,
        detail="Storage service initialization failed"
    )
```

#### Step 6: Update Top-Level Exception Handler
**Location**: Replace lines 156-158

```python
except HTTPException:
    # Re-raise FastAPI exceptions (already have proper status codes)
    raise
except Exception as e:
    # Truly unexpected errors - log with full traceback
    logger.error(f"Unexpected error in upload_customer_images: {e}", exc_info=True)
    raise HTTPException(
        status_code=500,
        detail="Internal server error during image upload"
    )
```

---

## 4. Error Classification Matrix

| Error Type | Status Code | Example |
|------------|-------------|---------|
| Missing data | 400 | No images in request |
| Malformed data URL | 400 | No comma in data URL |
| Invalid base64 | 400 | Corrupt base64 encoding |
| Empty file | 400 | Zero bytes after decoding |
| Wrong file type | 400 | image/svg+xml (not allowed) |
| File too large | 413 | > 10MB |
| GCS unavailable | 503 | Bucket doesn't exist |
| GCS permission error | 503 | No write access |
| Unexpected error | 500 | Programming bug |

**Key Principle**:
- 400 = Client's fault (bad data)
- 413 = Client's fault (too big)
- 503 = Infrastructure issue (temporary)
- 500 = Our bug (code error)

---

## 5. Logging Strategy

### Log Levels

**INFO** - Successful operations:
```python
logger.info(f"✓ Uploaded original image: {url} ({size}KB)")
logger.info(f"Successfully parsed original image: {len(bytes)} bytes, type: {mime}")
```

**WARNING** - Recoverable issues:
```python
logger.warning(f"Malformed data URL header, using default MIME: {header}")
```

**ERROR** - Client errors (400s):
```python
logger.error(f"Invalid original data: empty or not a string")
logger.error(f"Base64 decode failed for original: {e}")
logger.debug(f"Data URL prefix: {data_url[:100]}")  # Safe truncation
```

**ERROR + exc_info** - Server errors (500s):
```python
logger.error(f"Unexpected error parsing original data: {e}", exc_info=True)
logger.error(f"Failed to upload to GCS: {e}", exc_info=True)
```

### What NOT to Log
- Full data URLs (too large, may contain sensitive data)
- Full base64 data
- Complete stack traces for client errors (400s)

### What TO Log
- First 100 chars of problematic data (for debugging)
- Image sizes (before and after decode)
- MIME types
- Session IDs
- Upload URLs
- Error types and messages

---

## 6. Testing Plan

### Unit Tests
**Location**: Create `backend/inspirenet-api/tests/test_storage_upload.py`

```python
import pytest
from fastapi import HTTPException
from src.simple_storage_api import validate_and_parse_data_url

def test_valid_data_url():
    """Test standard data URL parsing"""
    data_url = "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    image_bytes, mime_type = validate_and_parse_data_url(data_url, "test")
    assert len(image_bytes) > 0
    assert mime_type == "image/jpeg"

def test_malformed_no_comma():
    """Test Safari edge case: no comma in data URL"""
    data_url = "data:image/jpeg;base64/9j/4AAQSkZJRg..."  # Missing comma
    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")
    assert exc.value.status_code == 400
    assert "comma separator" in str(exc.value.detail)

def test_empty_data_url():
    """Test empty data after comma"""
    data_url = "data:image/jpeg;base64,"  # Comma but no data
    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")
    assert exc.value.status_code == 400

def test_invalid_base64():
    """Test invalid base64 characters"""
    data_url = "data:image/jpeg;base64,This is not base64!!!"
    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")
    assert exc.value.status_code == 400
    assert "base64" in str(exc.value.detail).lower()

def test_oversized_data_url():
    """Test data URL size limit"""
    # Create a 20MB base64 string
    large_data = "A" * (20 * 1024 * 1024)
    data_url = f"data:image/jpeg;base64,{large_data}"
    with pytest.raises(HTTPException) as exc:
        validate_and_parse_data_url(data_url, "test")
    assert exc.value.status_code == 413

def test_raw_base64():
    """Test raw base64 without data URL prefix"""
    # Valid base64 for 1x1 JPEG
    base64_data = "/9j/4AAQSkZJRg..."
    image_bytes, mime_type = validate_and_parse_data_url(base64_data, "test")
    assert mime_type == "image/jpeg"
```

### Integration Tests
**Location**: Create `backend/inspirenet-api/tests/test_storage_integration.py`

Test actual endpoint with:
1. Valid Safari data URL
2. Valid Chrome data URL
3. Malformed data URL (no comma)
4. Invalid base64
5. Empty file
6. Oversized file
7. Wrong MIME type

### Browser-Specific Tests
**Location**: `testing/storage-upload-safari-test.html`

Manual test page for Safari:
- Upload various file sizes
- Test HEIC → JPEG conversion
- Test interrupted uploads
- Monitor console for errors

---

## 7. Deployment Strategy

### Pre-Deployment Checks
1. Run all unit tests: `pytest backend/inspirenet-api/tests/test_storage_upload.py`
2. Run integration tests: `pytest backend/inspirenet-api/tests/test_storage_integration.py`
3. Code review by code-quality-reviewer agent
4. Verify logging doesn't leak sensitive data

### Deployment Steps
1. Deploy to staging Cloud Run
2. Test with Safari on macOS (manual)
3. Monitor staging logs for 1 hour
4. Deploy to production Cloud Run
5. Monitor production logs for 24 hours

### Rollback Plan
If new errors appear:
1. Revert to previous Cloud Run revision
2. Analyze logs to identify issue
3. Fix and redeploy

### Monitoring
Add alerts for:
- `error_rate{endpoint="/api/storage/upload"} > 1%` for 5 minutes
- `http_status{endpoint="/api/storage/upload",code="500"} > 5` in 5 minutes

---

## 8. Prevention & Long-Term Improvements

### Immediate Prevention (This Fix)
- ✅ Proper input validation
- ✅ Correct error status codes
- ✅ Comprehensive logging
- ✅ Safari edge case handling

### Short-Term (Next Sprint)
1. **Add API authentication** - Prevent abuse
2. **Implement rate limiting per session** - 10 uploads/hour max
3. **Add request ID tracking** - Correlate frontend to backend logs
4. **Client-side validation** - Catch issues before upload

### Medium-Term (Next Month)
1. **Switch to multipart/form-data** - More efficient than base64 data URLs
2. **Add image format verification** - Check actual file headers, not just MIME
3. **Implement virus scanning** - ClamAV integration
4. **Add upload analytics** - Track success rates by browser/OS

### Frontend Improvements
**Location**: `assets/pet-processor.js`

Add validation before upload:
```javascript
async uploadOriginalImage(file) {
  // Validate file before reading
  if (!file || file.size === 0) {
    console.error('Invalid file: empty or null');
    return null;
  }

  if (file.size > 10 * 1024 * 1024) {
    console.error('File too large:', file.size);
    return null;
  }

  // Convert file to data URL with error handling
  let dataUrl;
  try {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Validate data URL format
        if (!reader.result || typeof reader.result !== 'string') {
          reject(new Error('FileReader returned invalid result'));
          return;
        }
        if (!reader.result.startsWith('data:')) {
          reject(new Error('FileReader did not return a data URL'));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Failed to read file:', error);
    return null;
  }

  // Continue with upload...
}
```

---

## 9. Success Metrics

### Immediate (24 Hours)
- ✅ Zero 500 errors on `/api/storage/upload`
- ✅ All errors properly classified (400, 413, 503)
- ✅ Detailed logs for all failures
- ✅ Safari uploads working correctly

### Short-Term (1 Week)
- ✅ Upload success rate > 99%
- ✅ Mean time to identify upload failures < 5 minutes
- ✅ Zero customer complaints about upload errors

### Long-Term (1 Month)
- ✅ Comprehensive test coverage (>90%)
- ✅ Automated browser testing for Safari, Chrome, Firefox
- ✅ Monitoring dashboard for upload health

---

## 10. Files to Create/Modify

### Files to Modify
1. **`backend/inspirenet-api/src/simple_storage_api.py`**
   - Add `validate_and_parse_data_url()` helper function
   - Replace original image processing logic (lines 46-82)
   - Replace processed image processing logic (lines 84-120)
   - Add request validation (after line 38)
   - Improve GCS initialization (lines 39-41)
   - Update exception handler (lines 156-158)

### Files to Create
1. **`backend/inspirenet-api/tests/test_storage_upload.py`**
   - Unit tests for validation function
   - Edge case tests for Safari

2. **`backend/inspirenet-api/tests/test_storage_integration.py`**
   - End-to-end tests for upload endpoint
   - Browser-specific test cases

3. **`testing/storage-upload-safari-test.html`**
   - Manual testing page for Safari
   - File upload UI with console logging

### Documentation to Update
1. **`.claude/tasks/context_session_1736365200.md`**
   - Append completion status
   - Link to this implementation plan

---

## 11. Risk Assessment

### Low Risk
- ✅ Changes are isolated to error handling
- ✅ No changes to core business logic
- ✅ Backward compatible (same API contract)
- ✅ Easy to rollback (Cloud Run revisions)

### Medium Risk
- ⚠️ New validation might be too strict (false positives)
  - **Mitigation**: Comprehensive testing before deploy
  - **Fallback**: Can relax validation if needed

### High Risk
- ❌ None identified

---

## 12. Questions & Assumptions

### Assumptions
1. Safari's FileReader API returns standard data URL format (confirmed in testing)
2. GCS bucket `perkieprints-customer-images` exists and has proper permissions
3. Current error is happening at parsing stage (confirmed by 60ms latency)
4. No authentication is required for upload endpoint (per current design)

### Open Questions
1. **Should we log the session_id in errors?**
   - YES - helps correlate with frontend logs
   - Sanitize to prevent injection

2. **Should we validate image content (not just MIME type)?**
   - NICE TO HAVE - check file headers
   - Can be added in phase 2

3. **Should we switch from data URLs to multipart/form-data?**
   - FUTURE IMPROVEMENT - more efficient
   - Requires frontend changes
   - Better for large files

---

## Implementation Notes

### Code Style
- Follow existing Python style (4 spaces, type hints)
- Use descriptive variable names
- Add docstrings to new functions
- Keep line length < 120 chars

### Testing Requirements
- All new functions must have unit tests
- Integration tests for all error paths
- Manual testing on Safari required before deploy

### Review Requirements
- Code review by `code-quality-reviewer` agent
- Security review of error messages (no data leakage)
- Performance review (minimal overhead)

---

**Plan Status**: Ready for Implementation
**Estimated Time**: 4-6 hours (including testing)
**Reviewer**: code-quality-reviewer, infrastructure-reliability-engineer
**Next Step**: Implement changes in `simple_storage_api.py`
