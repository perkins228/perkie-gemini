# InSPyReNet API 400 Bad Request - Debug Analysis & Fix

## Root Cause Analysis

### 1. Primary Issue: Wrong API Parameter
**Problem**: The API expects a **file**, not an **image_url**
- **Current Code** (inline-preview-mvp.js:311): `formData.append('image_url', imageUrl);`
- **Working Code** (pet-processor.js:1278): `formData.append('file', fixedFile);`
- **Impact**: API rejects the request because it doesn't recognize `image_url` parameter

### 2. Secondary Issue: Sending Data URL Instead of File
**Problem**: The code is sending a base64 data URL string instead of a File/Blob
- **Current Flow**: File → Data URL → FormData with string
- **Correct Flow**: File → FormData with File/Blob
- **Impact**: Even if parameter name was correct, API expects binary file data

### 3. Tertiary Issue: PetStorage.uploadToGCS Doesn't Exist
**Problem**: `window.PetStorage.uploadToGCS` is not a method in pet-storage.js
- **Attempted Call**: `window.PetStorage.uploadToGCS(file)` (line 290)
- **Reality**: PetStorage has no uploadToGCS method
- **Fallback**: Code falls back to data URL conversion (massive base64 string)

## Correct Implementation Pattern

### How pet-processor.js Works:
1. **Direct File Processing**: Sends File object directly to API
   ```javascript
   formData.append('file', file);  // File object, not URL
   ```

2. **GCS Upload AFTER Processing**:
   - First: Process image with InSPyReNet (get effects)
   - Then: Upload processed results to GCS via `/store-image` endpoint
   - Note: `uploadToGCS` is a method of PetProcessor class, NOT PetStorage

3. **Storage Flow**:
   - InSPyReNet returns base64 effects
   - Convert to data URLs
   - Upload to GCS via `/store-image` endpoint
   - Store GCS URLs in PetStorage

## The Fix

### Option A: Direct File Processing (Recommended)
**Change removeBackground to accept File, not URL**

```javascript
// CURRENT (WRONG):
async processImage(file) {
  const gcsUrl = await this.uploadToGCS(file);  // ❌ Creates data URL
  const effects = await this.removeBackground(gcsUrl);  // ❌ Sends URL
}

// FIXED:
async processImage(file) {
  // Skip upload, process file directly
  const effects = await this.removeBackground(file);  // ✅ Send File object

  // Then upload processed results to GCS if needed
  const gcsUrl = await this.uploadProcessedToGCS(effects.color);
}

async removeBackground(file) {  // Changed parameter
  const API_URL = '...api/v2/process-with-effects';

  const formData = new FormData();
  formData.append('file', file);  // ✅ File object, not URL
  formData.append('effects', 'enhancedblackwhite,color');

  const response = await fetch(`${API_URL}?return_all_effects=true`, {
    method: 'POST',
    body: formData
  });
  // ... rest stays the same
}
```

### Option B: Add GCS Upload After Processing
**Upload processed images to GCS using /store-image endpoint**

```javascript
async uploadProcessedToGCS(dataUrl, effect = 'color') {
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Create form data
  const formData = new FormData();
  const filename = `pet_${Date.now()}_${effect}.png`;
  formData.append('file', blob, filename);
  formData.append('session_id', `inline_${Date.now()}`);
  formData.append('image_type', `processed_${effect}`);
  formData.append('tier', 'temporary');

  // Upload to /store-image endpoint
  const apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image';
  const uploadResponse = await fetch(apiUrl, {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) {
    console.error('GCS upload failed:', uploadResponse.status);
    return null;
  }

  const result = await uploadResponse.json();
  return result.success ? result.url : null;
}
```

## Implementation Steps

### 1. Fix removeBackground Method (lines 306-335)
```javascript
async removeBackground(file) {  // Changed from imageUrl to file
  const API_URL = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects';

  // Create FormData with file, not URL
  const formData = new FormData();
  formData.append('file', file);  // Key change: 'file' not 'image_url'
  formData.append('effects', 'enhancedblackwhite,color');

  const response = await fetch(`${API_URL}?return_all_effects=true`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error:', errorText);
    throw new Error(`Background removal failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.effects) {
    throw new Error('No processed effects returned');
  }

  // API returns base64 data for each effect
  const effects = {};
  for (const [effectName, base64Data] of Object.entries(result.effects)) {
    effects[effectName] = `data:image/png;base64,${base64Data}`;
  }

  return effects;
}
```

### 2. Update processImage Method (lines 239-282)
```javascript
async processImage(file) {
  try {
    this.processingCancelled = false;
    this.showView('processing');

    // Skip GCS upload initially - process file directly
    console.log('🎨 Processing with AI...');
    this.updateProgress('Processing with AI...', '⏱️ 30-60 seconds...');

    // Send file directly to API (not URL)
    const effects = await this.removeBackground(file);  // Pass file directly
    if (this.processingCancelled) return;

    console.log('✅ Processing complete:', effects);

    // Store pet data with data URLs
    this.currentPet = {
      originalImage: null,  // Will upload later if needed
      processedImage: effects.enhancedblackwhite || effects.color,
      effects: {
        enhancedblackwhite: effects.enhancedblackwhite,
        color: effects.color
      }
    };

    // Optional: Upload to GCS after processing
    if (this.currentPet.processedImage) {
      const gcsUrl = await this.uploadProcessedToGCS(
        this.currentPet.processedImage,
        'color'
      );
      if (gcsUrl) {
        this.currentPet.gcsUrl = gcsUrl;
        console.log('✅ Uploaded to GCS:', gcsUrl);
      }
    }

    // Generate AI effects if enabled
    if (this.geminiEnabled) {
      await this.generateAIEffects(this.currentPet.processedImage);
    }

    // Show result
    this.showResult();

  } catch (error) {
    console.error('❌ Processing error:', error);
    this.showError(error.message || 'Failed to process image. Please try again.');
  }
}
```

### 3. Add uploadProcessedToGCS Method (new method after line 300)
```javascript
/**
 * Upload processed image to GCS via /store-image endpoint
 * Mirrors the functionality in pet-processor.js
 */
async uploadProcessedToGCS(dataUrl, effect = 'color') {
  try {
    console.log('📤 Uploading processed image to GCS...');

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create form data matching pet-processor.js format
    const formData = new FormData();
    const sessionKey = `inline_${Date.now()}`;
    const filename = `${sessionKey}_processed_${effect}_${Date.now()}.png`;

    formData.append('file', blob, filename);
    formData.append('session_id', sessionKey);
    formData.append('image_type', `processed_${effect}`);
    formData.append('tier', 'temporary'); // 7-day retention

    // Upload to /store-image endpoint
    const apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image';
    const uploadResponse = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`❌ GCS upload failed (${uploadResponse.status}):`, errorText);
      return null;
    }

    const result = await uploadResponse.json();

    if (result.success && result.url) {
      console.log(`✅ Processed image uploaded:`, result.url);
      return result.url;
    } else {
      console.error('❌ Upload succeeded but no URL returned:', result);
      return null;
    }

  } catch (error) {
    console.error('❌ GCS upload error:', error);
    return null;  // Non-critical - can work with data URLs
  }
}
```

### 4. Remove/Update uploadToGCS Method (lines 287-300)
```javascript
// Remove this entire method as it's not needed
// The uploadProcessedToGCS method replaces this functionality
```

## Testing Checklist

After implementing the fix:

1. **Verify API Call**:
   - [ ] Network tab shows POST to `/api/v2/process-with-effects`
   - [ ] Request payload contains `file` (binary), not `image_url`
   - [ ] Request returns 200 OK, not 400
   - [ ] Response contains effects object with base64 data

2. **Verify Processing Flow**:
   - [ ] Upload image triggers processing
   - [ ] Progress messages display correctly
   - [ ] Effects (Black & White, Color) are returned
   - [ ] Preview displays processed image
   - [ ] Effect selection works

3. **Verify GCS Upload** (optional):
   - [ ] Network tab shows POST to `/store-image`
   - [ ] Request contains file blob with metadata
   - [ ] Response returns GCS URL
   - [ ] URL is accessible in browser

4. **Verify Add to Cart**:
   - [ ] Selected effect is added to cart
   - [ ] Order properties include image data
   - [ ] Cart shows correct preview

## Summary

**Root Cause**: API expects `file` parameter with File/Blob, not `image_url` with string
**Quick Fix**: Change parameter name and pass File object directly
**Time to Fix**: 15 minutes
**Risk**: Low - isolated to inline-preview-mvp.js
**Testing**: Test on Shopify preview URL after deployment