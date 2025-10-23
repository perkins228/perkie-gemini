# Crop & Zoom Feature Implementation Plan

**Document ID**: crop-zoom-implementation-plan
**Author**: CV/ML Production Engineer
**Date**: 2025-10-07
**Status**: Complete Implementation Plan

## Executive Summary

This document provides a complete, production-ready implementation plan for adding client-side crop and zoom functionality to the Perkie Prints pet image processor. The feature will be injected after background removal and effects application, allowing customers to refine their pet images before adding to cart.

## 1. Library Recommendation

### Selected Library: Cropper.js (v1.6.1)

**Justification:**
- **Bundle Size**: 39KB minified (acceptable for our performance budget)
- **ES5 Compatible**: Works with older browsers without transpilation
- **Mobile Support**: Excellent touch gesture support (pinch-zoom, rotation)
- **Image Quality**: Maintains source resolution, no quality degradation
- **Features**: Box/circle crop, zoom, rotation, aspect ratio lock
- **Performance**: Canvas-based rendering, efficient for large images
- **License**: MIT (commercial-friendly)

**Alternative Considered:**
- Croppie: 29KB but less mobile-friendly
- Custom Canvas API: Smaller (15KB) but requires 3-4 weeks development
- React-image-crop: Not compatible with our vanilla JS architecture

## 2. Processing Pipeline Integration

### Current Flow
```
Upload → BG Removal (API) → Effect Selection (Client) → GCS Upload → Cart
```

### New Flow with Crop/Zoom
```
Upload → BG Removal (API) → Effect Selection (Client) → [Crop/Zoom (Client)] → GCS Upload → Cart
```

### Integration Points in `assets/pet-processor.js`

```javascript
// Line 950-960: After effect selection, before savePetToSession
async handleSavePet() {
  // Existing validation...

  // NEW: Show crop/zoom interface
  if (this.shouldShowCropZoom()) {
    const croppedData = await this.showCropZoomInterface(effectData);
    if (croppedData) {
      effectData = croppedData;
    } else if (croppedData === false) {
      // User cancelled crop
      return false;
    }
  }

  // Continue with GCS upload...
}
```

## 3. Technical Implementation Details

### 3.1 New Files to Create

#### `assets/pet-crop-zoom.js` (Main Module)
```javascript
class PetCropZoom {
  constructor(petProcessor) {
    this.petProcessor = petProcessor;
    this.cropper = null;
    this.modalElement = null;
    this.minDPI = 200;
    this.minPixels = 1000; // Minimum 1000x1000 for print quality
  }

  async showCropInterface(imageData, metadata) {
    // Initialize Cropper.js
    // Show modal with crop interface
    // Handle touch events for mobile
    // Validate DPI on crop change
    // Return cropped image data
  }

  validateDPI(cropData, originalDimensions) {
    // Calculate final resolution
    // Check against 200 DPI requirement
    // Show warning if below threshold
  }

  async exportCroppedImage(cropper) {
    // Get canvas from cropper
    // Preserve metadata
    // Convert to blob with quality settings
    // Return data URL and metadata
  }
}
```

#### `assets/crop-zoom-styles.css` (Styles)
- Modal overlay styles
- Cropper.js custom theme
- Mobile-optimized controls
- DPI warning styles

### 3.2 Files to Modify

#### `assets/pet-processor.js`
**Changes Required:**
1. Import Cropper.js library (line ~10)
2. Initialize PetCropZoom instance (line ~250)
3. Add crop/zoom trigger after effect selection (line ~950)
4. Update GCS upload metadata (line ~1407)
5. Add crop metadata to localStorage structure (line ~1000)

#### `snippets/ks-product-pet-selector.liquid`
**Changes Required:**
1. Display crop indicator on thumbnails (line ~90)
2. Show crop metadata in selection UI
3. Add "Edit Crop" button for saved pets

#### `sections/ks-pet-bg-remover.liquid`
**Changes Required:**
1. Include Cropper.js library
2. Add crop/zoom modal container
3. Include crop-zoom-styles.css

## 4. 200 DPI Validation Strategy

### Calculation Formula
```javascript
function calculateDPI(pixelWidth, pixelHeight, printWidthInches, printHeightInches) {
  const widthDPI = pixelWidth / printWidthInches;
  const heightDPI = pixelHeight / printHeightInches;
  return Math.min(widthDPI, heightDPI);
}
```

### Validation Points
1. **Pre-crop**: Show current DPI based on product dimensions
2. **During crop**: Live DPI calculation with visual indicator
3. **Post-crop**: Final validation before save

### User Feedback
```javascript
// Visual DPI indicator
if (currentDPI >= 300) {
  indicator = "✅ Excellent quality (300+ DPI)";
} else if (currentDPI >= 200) {
  indicator = "✓ Good quality (200+ DPI)";
} else if (currentDPI >= 150) {
  indicator = "⚠️ Acceptable (150-200 DPI)";
} else {
  indicator = "❌ Too low for print (< 150 DPI)";
  // Prevent save
}
```

## 5. GCS Upload Specification

### Filename Convention
```
{sessionKey}_cropped_{effect}_{timestamp}.png
```

### Metadata Structure
```json
{
  "original": {
    "width": 3000,
    "height": 2250,
    "url": "gcs_url_original"
  },
  "processed": {
    "width": 3000,
    "height": 2250,
    "effect": "enhancedblackwhite",
    "url": "gcs_url_processed"
  },
  "cropped": {
    "x": 500,
    "y": 300,
    "width": 2000,
    "height": 1500,
    "rotation": 0,
    "scaleX": 1,
    "scaleY": 1,
    "finalWidth": 2000,
    "finalHeight": 1500,
    "dpi": 250,
    "url": "gcs_url_cropped"
  }
}
```

### Upload Format
- **Format**: PNG for transparency, JPEG for photos
- **Quality**: 95% for JPEG, lossless for PNG
- **Max Size**: 10MB after compression
- **Fallback**: Progressive JPEG if size > 10MB

## 6. Memory Management

### Large Image Handling
```javascript
class MemoryManager {
  constructor() {
    this.maxCanvasSize = 4096 * 4096; // 16MP max
    this.warningThreshold = 3000 * 3000; // 9MP warning
  }

  async processLargeImage(imageData) {
    // Check dimensions
    if (width * height > this.maxCanvasSize) {
      // Downsample maintaining aspect ratio
      const scale = Math.sqrt(this.maxCanvasSize / (width * height));
      return this.resizeImage(imageData, scale);
    }
    return imageData;
  }

  cleanup() {
    // Revoke object URLs
    // Clear canvas references
    // Force garbage collection hints
  }
}
```

### Mobile Optimization
1. **Lazy Loading**: Load Cropper.js only when needed
2. **Canvas Pooling**: Reuse canvas elements
3. **Debounced Updates**: Throttle crop preview updates
4. **Progressive Rendering**: Show low-res preview during interaction

## 7. Integration with Existing Systems

### localStorage Structure Update
```javascript
{
  "pet_session_key": {
    "id": "unique_id",
    "name": "Pet Name",
    "originalDataUrl": "data:image/png;base64...",
    "effects": {
      "enhancedblackwhite": {
        "dataUrl": "data:image/png;base64...",
        "gcsUrl": "https://storage.googleapis.com/...",
        "cropData": {  // NEW
          "x": 500,
          "y": 300,
          "width": 2000,
          "height": 1500,
          "applied": true
        }
      }
    }
  }
}
```

### Session Management Updates
- Add `hasCrop` flag to pet data
- Store crop history for undo
- Preserve crop data across page reloads

## 8. Mobile-First UI/UX Design

### Touch Controls
```javascript
// Gesture handlers
cropper.on('touchstart', handlePinchStart);
cropper.on('touchmove', handlePinchZoom);
cropper.on('touchend', handlePinchEnd);

// Rotation gesture
cropper.on('rotate', handleRotation);
```

### Mobile UI Elements
1. **Bottom Sheet Modal**: Slides up from bottom
2. **Large Touch Targets**: 48px minimum
3. **Gesture Hints**: Show pinch/rotate animations
4. **Preset Crops**: Quick 1:1, 4:3, 16:9 buttons

## 9. Performance Metrics

### Target Benchmarks
- **Initialization**: < 200ms
- **Crop Preview Update**: < 16ms (60 FPS)
- **Final Export**: < 500ms for 3000x3000
- **Memory Usage**: < 150MB peak on mobile

### Monitoring Points
```javascript
performance.mark('crop-start');
// ... crop operation
performance.mark('crop-end');
performance.measure('crop-duration', 'crop-start', 'crop-end');
```

## 10. Implementation Timeline

### Phase 1: Core Implementation (Week 1)
- Day 1-2: Integrate Cropper.js library
- Day 3-4: Build crop/zoom interface
- Day 5: DPI validation system

### Phase 2: Mobile Optimization (Week 2)
- Day 1-2: Touch gesture support
- Day 3: Mobile UI refinements
- Day 4-5: Performance optimization

### Phase 3: Integration & Testing (Week 3)
- Day 1-2: GCS upload integration
- Day 3: localStorage updates
- Day 4-5: Cross-browser testing

## 11. Testing Strategy

### Unit Tests
```javascript
// test-crop-validation.js
describe('DPI Validation', () => {
  test('calculates correct DPI for crop', () => {
    const result = calculateDPI(2000, 1500, 8, 6);
    expect(result).toBe(250);
  });

  test('prevents save below minimum DPI', () => {
    const result = validateCrop(500, 375, 8, 6);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('DPI too low');
  });
});
```

### Integration Tests
1. Upload → Crop → Save flow
2. Effect → Crop → Effect change
3. Mobile gesture handling
4. Memory leak detection

## 12. Rollback Strategy

### Feature Flag
```javascript
window.FEATURE_FLAGS = {
  CROP_ZOOM_ENABLED: true  // Can disable remotely
};
```

### Graceful Degradation
- If Cropper.js fails to load, skip to GCS upload
- Store uncropped version as fallback
- Monitor error rates via analytics

## 13. Security Considerations

### Input Validation
- Max file size: 50MB
- Allowed formats: JPEG, PNG, WebP
- EXIF data stripping for privacy
- CSP headers for canvas operations

### Client-Side Limits
```javascript
const LIMITS = {
  maxImageSize: 50 * 1024 * 1024,  // 50MB
  maxDimensions: 10000,  // 10k pixels
  minDimensions: 100,    // 100 pixels
  maxZoom: 10,          // 10x zoom
  minZoom: 0.1          // 0.1x zoom
};
```

## 14. Analytics Tracking

### Events to Track
```javascript
// Feature usage
track('crop_zoom_opened', { trigger: 'manual|auto' });
track('crop_applied', {
  cropRatio: width/height,
  zoomLevel: scale,
  rotation: degrees,
  dpi: calculatedDPI
});
track('crop_cancelled', { reason: 'user|validation' });

// Performance
track('crop_performance', {
  initTime: ms,
  exportTime: ms,
  imageSize: bytes
});
```

## 15. Future Enhancements

### Phase 2 Features (Not in MVP)
1. **Smart Crop**: AI-powered auto-crop suggestions
2. **Filters**: Additional Instagram-style filters
3. **Text Overlay**: Add pet names to images
4. **Templates**: Pre-designed crop templates
5. **Batch Processing**: Crop multiple pets at once

## Critical Implementation Notes

### ⚠️ MUST DO
1. **ES5 Transpilation**: Ensure Cropper.js is ES5-compatible
2. **Mobile Testing**: Test on real devices, not just dev tools
3. **Memory Cleanup**: Explicitly revoke blob URLs
4. **DPI Validation**: Never allow < 150 DPI for print
5. **Error Boundaries**: Graceful fallbacks at every step

### 🚫 MUST NOT DO
1. **Don't block UI**: Keep crop operations async
2. **Don't cache large images**: Clear after use
3. **Don't auto-crop**: Always user-initiated
4. **Don't lose original**: Keep uncropped backup
5. **Don't ignore mobile**: 70% of traffic is mobile

## Conclusion

This implementation plan provides a production-ready approach to adding crop/zoom functionality to the pet processor. The solution prioritizes mobile performance, maintains print quality standards, and integrates seamlessly with the existing pipeline. Expected development time is 3 weeks with proper testing.

## Appendix: Code Integration Points

### File: `assets/pet-processor.js`
- Line 10: Add Cropper.js import
- Line 250: Initialize PetCropZoom
- Line 950-960: Inject crop UI trigger
- Line 1000: Update localStorage structure
- Line 1407: Modify GCS upload metadata

### File: `snippets/ks-product-pet-selector.liquid`
- Line 90: Add crop indicator
- Line 120: Show crop metadata

### File: `sections/ks-pet-bg-remover.liquid`
- Add: Cropper.js library include
- Add: Crop modal container
- Add: Crop styles

---
*End of Implementation Plan*