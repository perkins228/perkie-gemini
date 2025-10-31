# Gemini 2.5 Flash Image Response Extraction Fix

## Problem Statement

Generated images from Gemini 2.5 Flash Image API are being saved as 48-byte corrupted JPEG files in Google Cloud Storage, despite HTTP 200 success responses.

## Root Cause Analysis

### Current Assumptions (INCORRECT)
The code assumes Gemini 2.5 Flash Image returns:
- Base64-encoded image data in `response.text`
- Or base64-encoded image data in `response.parts[0].text`

### Actual Gemini 2.5 Flash Image Behavior
Based on the API documentation and the 48-byte corruption pattern:

**Gemini 2.5 Flash Image does NOT return generated images directly**. Instead, it returns:
1. **Text descriptions** of what it would generate
2. **Error messages** or safety filter responses
3. **Empty or minimal response** when image generation is not supported

The 48-byte file is likely one of:
- An error message being saved as JPEG
- Empty/null response being base64 decoded
- A text description being incorrectly treated as image data

### Key Finding
**Gemini 2.5 Flash (`gemini-2.5-flash`) is primarily a text model with image understanding capabilities, NOT an image generation model**. Google's image generation models are:
- Imagen 2 (not available via Gemini API)
- Imagen 3 (requires Vertex AI)
- Gemini Pro Vision (image understanding only)

## Solution Approaches

### Option 1: Use Correct Image Generation API (RECOMMENDED)

**Switch to Google's Vertex AI Imagen API**:
```python
# Use Vertex AI Python SDK
from google.cloud import aiplatform
from vertexai.preview.vision_models import ImageGenerationModel

model = ImageGenerationModel.from_pretrained("imagen-3")
response = model.generate_images(
    prompt="A pet portrait in Van Gogh style",
    number_of_images=1
)
# Returns actual image bytes
```

### Option 2: Use Alternative Image Generation Service

**Integrate with proven image generation APIs**:
1. **Stable Diffusion API** (via Replicate or Hugging Face)
2. **DALL-E 3** (via OpenAI API)
3. **Midjourney API** (unofficial)
4. **RunwayML API**

### Option 3: Fix Current Implementation (DIAGNOSTIC ONLY)

**Add debugging to understand what Gemini is actually returning**:

```python
# backend/gemini-artistic-api/src/core/gemini_client.py

# After line 193, add comprehensive logging:
if hasattr(response, 'text') and response.text:
    raw_response = response.text.strip()

    # Log the first 200 characters to understand what we're getting
    logger.info(f"Raw response preview: {raw_response[:200]}")
    logger.info(f"Response length: {len(raw_response)}")

    # Check if it's actually base64
    import re
    is_base64 = re.match(r'^[A-Za-z0-9+/]*={0,2}$', raw_response)
    logger.info(f"Looks like base64: {bool(is_base64)}")

    # Try to detect if it's text or image data
    if raw_response.startswith('{') or raw_response.startswith('['):
        logger.error("Response appears to be JSON, not image data")
        raise ValueError(f"Gemini returned JSON instead of image: {raw_response[:500]}")

    if len(raw_response) < 100:
        logger.error(f"Response too short to be an image: {raw_response}")
        raise ValueError(f"Response too short for image data: {raw_response}")

    # Attempt decode to verify it's valid base64
    try:
        test_decode = base64.b64decode(raw_response)
        logger.info(f"Base64 decode successful, bytes: {len(test_decode)}")

        # Check if it's a valid image format
        if test_decode[:2] == b'\xff\xd8':
            logger.info("Detected JPEG header")
        elif test_decode[:8] == b'\x89PNG\r\n\x1a\n':
            logger.info("Detected PNG header")
        else:
            logger.warning(f"Unknown image format, header: {test_decode[:10].hex()}")
    except:
        logger.error("Failed to decode as base64")
        raise ValueError("Response is not valid base64 image data")
```

## Implementation Plan

### Phase 1: Diagnostic (1 hour)
1. Add comprehensive logging to understand Gemini's actual response format
2. Save raw responses to files for analysis
3. Test with different prompts to see response patterns
4. Document actual response structure

### Phase 2: Validation (2 hours)
1. Research Gemini 2.5 Flash capabilities
2. Confirm if it supports image generation at all
3. Check if different prompt formats trigger image generation
4. Review Google's documentation for image generation models

### Phase 3: Implementation (4-6 hours)

#### If Gemini doesn't support image generation:
1. **Integrate Vertex AI Imagen 3**:
   - Set up Vertex AI project
   - Install `google-cloud-aiplatform` SDK
   - Create new `imagen_client.py` module
   - Update API endpoints to use Imagen
   - Test image generation and storage

2. **Or integrate Stable Diffusion via Replicate**:
   - Sign up for Replicate API
   - Install `replicate` SDK
   - Create `stable_diffusion_client.py`
   - Implement style-specific prompts
   - Handle async generation and webhooks

#### If Gemini does support image generation:
1. Fix response parsing based on actual format
2. Update storage logic if needed
3. Add proper validation and error handling

## Specific Files to Modify

### For Diagnostic Phase
**File**: `backend/gemini-artistic-api/src/core/gemini_client.py`
- **Lines 193-210**: Add comprehensive logging
- **After line 206**: Add response format detection
- **New method**: Add `_analyze_response()` helper

### For Imagen Integration
**New File**: `backend/gemini-artistic-api/src/core/imagen_client.py`
```python
class ImagenClient:
    def __init__(self):
        self.project_id = "gen-lang-client-0601138686"
        self.location = "us-central1"
        aiplatform.init(project=self.project_id, location=self.location)

    async def generate_artistic_style(self, image_data, style, prompt):
        # Implementation here
```

**Modify**: `backend/gemini-artistic-api/src/api/v1/endpoints.py`
- Replace `gemini_client` with `imagen_client` calls
- Update response handling

### For Stable Diffusion Integration
**New File**: `backend/gemini-artistic-api/src/core/stable_diffusion_client.py`
```python
import replicate

class StableDiffusionClient:
    def __init__(self):
        self.api_token = os.getenv("REPLICATE_API_TOKEN")

    async def generate_artistic_style(self, image_data, style):
        # Use SDXL or SD3 for style transfer
```

## Testing Strategy

1. **Unit Tests**:
   - Mock Gemini responses with actual captured data
   - Test response parsing logic
   - Validate error handling

2. **Integration Tests**:
   - Test with real API calls
   - Verify image storage in GCS
   - Check image validity (headers, size, format)

3. **Validation Tests**:
   - Verify generated images are valid JPEGs/PNGs
   - Check file sizes are reasonable (>10KB)
   - Validate base64 encoding/decoding

## Risk Assessment

**High Risk**: Gemini 2.5 Flash may not support image generation at all
- **Mitigation**: Have Vertex AI Imagen as immediate fallback

**Medium Risk**: API costs for alternative services
- **Mitigation**: Implement caching and rate limiting

**Low Risk**: Response format changes
- **Mitigation**: Add version detection and flexible parsing

## Immediate Next Steps

1. **Run diagnostic code** to capture actual Gemini responses
2. **Save raw responses** to files for analysis:
   ```python
   with open(f'/tmp/gemini_response_{style}_{timestamp}.txt', 'w') as f:
       f.write(response.text if hasattr(response, 'text') else str(response))
   ```

3. **Check response patterns** to determine if it's:
   - Text description
   - JSON response
   - Error message
   - Actual base64 image data (unlikely given 48-byte size)

4. **Make decision** on whether to:
   - Fix Gemini integration (if it supports images)
   - Switch to Imagen 3 (most likely needed)
   - Use alternative service (Stable Diffusion, DALL-E)

## Assumptions

1. The 48-byte files are **not** valid images but rather error messages or text
2. Gemini 2.5 Flash is **not** an image generation model
3. Google's actual image generation requires **Vertex AI Imagen**
4. The current implementation mistakenly treats text responses as image data

## Success Criteria

- Generated images are valid JPEG/PNG files (>10KB)
- Images display correctly in browsers
- Artistic styles are visually applied to pet images
- Storage in GCS works with proper content types
- No more 48-byte corrupted files

## Timeline

- **Diagnostic Phase**: 1 hour
- **Decision & Research**: 2 hours
- **Implementation**: 4-6 hours
- **Testing**: 2 hours
- **Total**: 9-11 hours

## Recommendation

**STRONG RECOMMENDATION**: Switch to Vertex AI Imagen 3 or Stable Diffusion API. Gemini 2.5 Flash appears to be a text/vision understanding model, not an image generation model. The 48-byte corruption strongly suggests we're saving text responses as images.