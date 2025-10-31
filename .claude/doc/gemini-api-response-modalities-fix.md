# Gemini API Response Modalities Fix - Implementation Plan

## Executive Summary

**URGENT**: Current `google-generativeai==0.3.1` is outdated and DOES NOT support `response_modalities` parameter. Must upgrade to newer SDK to enable image generation with Gemini 2.5 Flash Image.

## Critical Issue

**Error**: `GenerationConfig.__init__() got an unexpected keyword argument 'response_modalities'`

**Root Cause**:
- Currently installed: `google-generativeai==0.3.1` (December 2023 version)
- This version predates image generation capabilities
- `response_modalities` parameter introduced in later versions

## Solution Path

### Option 1: Upgrade to Latest google-generativeai (DEPRECATED)
- Latest version: `google-generativeai==0.8.5` (April 2025)
- Status: **LEGACY** - Support ended August 31, 2025
- **NOT RECOMMENDED** - Using deprecated package

### Option 2: Migrate to New Google GenAI SDK (RECOMMENDED)
- Package: `google-genai==1.47.0` (October 29, 2025)
- Status: **ACTIVE** - Current recommended SDK
- Supports all latest features including image generation
- Different API syntax from old SDK

## Implementation Plan - Option 2 (Recommended)

### Phase 1: Update Dependencies (15 minutes)

**File**: `backend/gemini-artistic-api/requirements.txt`
```diff
- google-generativeai==0.3.1
+ google-genai==1.47.0
```

### Phase 2: Update Import Statements (10 minutes)

**File**: `backend/gemini-artistic-api/src/core/gemini_client.py`

**Lines 1-5** - Update imports:
```python
# OLD (current)
import google.generativeai as genai
from google.generativeai import types

# NEW (required)
from google import genai
from google.genai import types
from PIL import Image
import io
```

### Phase 3: Update Client Initialization (20 minutes)

**Lines 70-75** - Change initialization:
```python
# OLD (current)
genai.configure(api_key=self.settings.gemini_api_key)
self.model = genai.GenerativeModel(
    model_name=self.settings.gemini_model,
    safety_settings=self.safety_settings
)

# NEW (required)
self.client = genai.Client(api_key=self.settings.gemini_api_key)
self.model_name = self.settings.gemini_model
```

### Phase 4: Update Generation Method (30 minutes)

**Lines 140-210** - Complete rewrite of generation logic:
```python
# OLD (current)
generation_config = types.GenerationConfig(
    response_modalities=["IMAGE"],  # FAILS HERE
    temperature=0.7,
    # ...
)
response = await self.model.generate_content_async(
    full_prompt,
    generation_config=generation_config,
    safety_settings=self.safety_settings
)

# NEW (required)
response = await self.client.models.generate_content(
    model=self.model_name,
    contents=[full_prompt, pil_image],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],  # NOW WORKS
        image_config=types.ImageConfig(
            aspect_ratio="1:1",
        ),
        temperature=0.7,
        top_p=self.settings.gemini_top_p,
        top_k=self.settings.gemini_top_k,
    )
)
```

### Phase 5: Update Response Extraction (20 minutes)

**Lines 195-220** - Fix response parsing:
```python
# OLD (current)
if response.parts:
    for part in response.parts:
        if hasattr(part, 'inline_data') and part.inline_data:
            # Complex extraction logic

# NEW (required)
for part in response.parts:
    if part.inline_data is not None:
        # Direct image extraction
        image_bytes = part.inline_data.data
        return base64.b64encode(image_bytes).decode('utf-8')
```

### Phase 6: Update Error Handling (15 minutes)

**Lines 180-195** - Adapt error handling for new SDK:
```python
# Check prompt feedback (different structure in new SDK)
if hasattr(response, 'prompt_feedback'):
    # Handle blocked prompts

# Check candidates (simplified in new SDK)
if not response.parts:
    raise ValueError("No image generated")
```

## Testing Plan

1. **Local Testing** (30 minutes)
   - Install new SDK: `pip install google-genai==1.47.0`
   - Test with sample image
   - Verify base64 image data returned

2. **API Testing** (20 minutes)
   - Test `/api/v1/generate` endpoint
   - Test `/api/v1/batch-generate` endpoint
   - Verify both Modern and Classic styles

3. **Deployment** (10 minutes)
   - Update requirements.txt
   - Deploy to Cloud Run
   - Monitor logs for errors

## Alternative Quick Fix (NOT Recommended)

If migration is too complex, there's a hacky workaround:

**Remove response_modalities entirely** and rely on prompt engineering:
```python
# Remove this line completely
response_modalities=["IMAGE"],

# Add to prompt instead
full_prompt = f"Generate an image only, no text. {prompt} Output: [IMAGE]"
```

This MAY work but is unreliable and not guaranteed.

## Risk Assessment

**Migration Risks**:
- API changes between SDKs (MEDIUM)
- Breaking changes in response format (LOW)
- Incompatible safety settings (LOW)

**Mitigation**:
- Keep old code as fallback
- Test thoroughly before deployment
- Monitor error rates after deployment

## Timeline

**Total Time**: 2-3 hours
- SDK migration: 1.5 hours
- Testing: 1 hour
- Deployment: 30 minutes

## Decision Required

**RECOMMENDED**: Migrate to `google-genai==1.47.0` (new SDK)
- Future-proof solution
- Active support
- Better documentation
- All latest features

**NOT RECOMMENDED**: Stay on old SDK
- Already deprecated
- No support after August 2025
- Missing critical features

## Next Steps

1. **IMMEDIATE**: Confirm SDK migration approach
2. **TODAY**: Update dependencies and code
3. **TODAY**: Test locally with new SDK
4. **TODAY**: Deploy fixed version

## References

- [Google GenAI SDK Documentation](https://googleapis.github.io/python-genai/)
- [Migration Guide](https://github.com/googleapis/python-genai)
- [Gemini 2.5 Flash Image Docs](https://ai.google.dev/gemini-api/docs/image-generation)
- [PyPI google-genai](https://pypi.org/project/google-genai/)

## Critical Notes

1. **Version Mismatch**: `google-generativeai==0.3.1` is from December 2023, before image generation existed
2. **SDK Change**: Google deprecated old SDK, new `google-genai` is required
3. **API Differences**: New SDK has different API structure, not drop-in replacement
4. **Time Sensitive**: Old SDK support ended August 2025

---

**Created**: 2025-10-31
**Author**: cv-ml-production-engineer
**Status**: URGENT - Blocking production
**Approval**: Pending implementation decision