# Gemini API Critical Error Fix - Implementation Plan

**Created**: 2025-10-24
**Priority**: CRITICAL
**Status**: Production Blocking Error
**Author**: CV/ML Production Engineer

## Executive Summary

The Gemini API integration is failing with `module 'google.generativeai' has no attribute 'models'`. This is a critical API call error that's blocking all artistic portrait generation in production.

## Error Analysis

### Current Error
```python
# Line 104 in gemini_client.py
response = genai.models.generate_content(  # ERROR: 'models' attribute doesn't exist
    model=self.model_name,
    contents=[prompt, input_image],
    config=types.GenerateContentConfig(...)
)
```

### Root Cause
The `google.generativeai` library (v0.8.x) does NOT have a `genai.models` module. The correct API pattern for Gemini 2.5 Flash Image requires using `GenerativeModel` class directly.

## Implementation Plan

### Step 1: Fix Gemini Client API Calls
**File**: `backend/gemini-artistic-api/src/core/gemini_client.py`

#### Changes Required (Lines 66-143):

1. **Update imports** (Line 2-3):
```python
# Current (WRONG):
from google.generativeai import types

# Fixed:
from google.generativeai import GenerativeModel, GenerationConfig
```

2. **Initialize model instance** (Lines 69-71):
```python
# Current:
def __init__(self):
    self.model_name = settings.gemini_model
    logger.info(f"Initialized Gemini client with model: {settings.gemini_model}")

# Fixed:
def __init__(self):
    self.model_name = settings.gemini_model
    # Create model instance for image generation
    self.model = GenerativeModel(
        model_name=settings.gemini_model,
        generation_config=GenerationConfig(
            temperature=settings.gemini_temperature,
            top_p=settings.gemini_top_p,
            top_k=settings.gemini_top_k,
        )
    )
    logger.info(f"Initialized Gemini client with model: {settings.gemini_model}")
```

3. **Fix generate_content call** (Lines 103-113):
```python
# Current (WRONG):
response = genai.models.generate_content(
    model=self.model_name,
    contents=[prompt, input_image],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        temperature=settings.gemini_temperature,
        top_p=settings.gemini_top_p,
        top_k=settings.gemini_top_k,
    )
)

# Fixed:
# For Gemini 2.5 Flash with image generation
response = self.model.generate_content(
    [prompt, input_image],
    generation_config=GenerationConfig(
        temperature=settings.gemini_temperature,
        top_p=settings.gemini_top_p,
        top_k=settings.gemini_top_k,
    )
)
```

### Step 2: Verify Image Response Handling

The current image extraction logic (lines 115-127) needs validation for the new API response format:

```python
# Current extraction logic - may need adjustment
for part in response.parts:
    if part.inline_data is not None:
        generated_image_data = part.inline_data.data
        break
```

**Note**: The response format for `gemini-2.5-flash-image` may differ. We need to check if it returns:
- `response.parts[0].inline_data.data` (current assumption)
- `response.candidates[0].content.parts[0].inline_data.data` (alternative)
- Or a different structure entirely

### Step 3: Add Error Handling for Model Initialization

Add try-catch around model initialization to catch configuration errors early:

```python
def __init__(self):
    self.model_name = settings.gemini_model
    try:
        self.model = GenerativeModel(
            model_name=settings.gemini_model,
            generation_config=GenerationConfig(
                temperature=settings.gemini_temperature,
                top_p=settings.gemini_top_p,
                top_k=settings.gemini_top_k,
            )
        )
        logger.info(f"Initialized Gemini client with model: {settings.gemini_model}")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini model: {e}")
        raise RuntimeError(f"Gemini model initialization failed: {e}")
```

### Step 4: Test & Validate

Create a minimal test script to validate the fix:

**File**: `backend/gemini-artistic-api/test_gemini_fix.py`
```python
import asyncio
import base64
from src.core.gemini_client import gemini_client
from src.models.schemas import ArtisticStyle

async def test_api():
    # Use a small test image
    with open("test_pet.jpg", "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    try:
        result, time = await gemini_client.generate_artistic_style(
            image_data=f"data:image/jpeg;base64,{image_data}",
            style=ArtisticStyle.BW_FINE_ART
        )
        print(f"✅ Success! Generated image in {time:.2f}s")
        print(f"Image size: {len(result)} bytes")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
```

### Step 5: Deploy Fix

1. **Test locally first**:
```bash
cd backend/gemini-artistic-api
python test_gemini_fix.py
```

2. **Deploy to Cloud Run**:
```bash
./scripts/deploy-gemini-artistic.sh
```

3. **Verify in production**:
```bash
curl -X POST https://gemini-artistic-api-753651513695.us-central1.run.app/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"image_data": "...", "style": "bw_fine_art", "session_id": "test"}'
```

## Alternative Solutions (If Primary Fix Fails)

### Option A: Use Different API Pattern
If the GenerativeModel class doesn't support image generation for `gemini-2.5-flash-image`, try:

```python
# Alternative 1: Use gemini-1.5-flash instead (known to work)
self.model = GenerativeModel('gemini-1.5-flash')

# Alternative 2: Use vision model specifically
self.model = GenerativeModel('gemini-1.5-flash-vision')
```

### Option B: Downgrade/Upgrade Library
Check if a specific version of google-generativeai supports the models attribute:

```bash
# Try newer version
pip install google-generativeai==0.8.5

# Or specific version with models support
pip install google-generativeai==0.7.2
```

### Option C: Use REST API Directly
If the Python SDK doesn't support image generation properly, use the REST API:

```python
import httpx

async def generate_via_rest(image_data: str, prompt: str):
    url = f"https://generativelanguage.googleapis.com/v1/models/{self.model_name}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.gemini_api_key
    }
    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/jpeg", "data": image_data}}
            ]
        }],
        "generationConfig": {
            "temperature": settings.gemini_temperature,
            "topP": settings.gemini_top_p,
            "topK": settings.gemini_top_k
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=body, headers=headers)
        return response.json()
```

## Critical Assumptions

1. **Model Name**: We're assuming `gemini-2.5-flash-image` is the correct model name
2. **API Version**: We're using google-generativeai>=0.8.0
3. **Image Input**: PIL Image object is acceptable input format
4. **Response Format**: The response contains image data in `parts[0].inline_data.data`

## Implementation Steps

1. **Immediate (5 minutes)**:
   - [ ] Update gemini_client.py with correct API calls
   - [ ] Fix imports and model initialization
   - [ ] Remove the non-existent `genai.models` reference

2. **Testing (10 minutes)**:
   - [ ] Create test script
   - [ ] Test with sample image
   - [ ] Verify response format

3. **Deployment (15 minutes)**:
   - [ ] Deploy fixed code to Cloud Run
   - [ ] Test all 3 artistic styles
   - [ ] Verify rate limiting still works

## Success Criteria

- ✅ API returns 200 status code
- ✅ Generated images are returned as base64
- ✅ All 3 artistic styles work
- ✅ No Python attribute errors
- ✅ Processing time < 5 seconds

## Rollback Plan

If the fix doesn't work:
1. Check Cloud Run logs for detailed error
2. Try alternative solutions (A, B, or C)
3. Consider using different Gemini model version
4. As last resort, switch to different AI provider

## Notes for Implementation

- The `response_modalities=["IMAGE"]` parameter might not be needed/supported in the GenerativeModel API
- The model name might need to be `gemini-1.5-flash` instead of `gemini-2.5-flash-image`
- Check if image generation requires a specific API endpoint or configuration
- Monitor API costs closely after deployment

## Post-Fix Monitoring

After deployment:
1. Check Cloud Run logs for any new errors
2. Monitor response times
3. Verify image quality meets requirements
4. Check Firestore rate limiting is still functional
5. Monitor daily costs

## References

- [Google Generative AI Python SDK](https://github.com/google/generative-ai-python)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [GenerativeModel Class Reference](https://ai.google.dev/api/python/google/generativeai/GenerativeModel)