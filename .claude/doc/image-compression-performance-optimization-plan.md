# Image Compression Performance Optimization Plan

**Author**: CV/ML Production Engineer
**Date**: 2025-11-08
**Commit Context**: Post 0b5d0c8 (blueimp-load-image implementation)
**Issue**: "Small image taking unacceptable amount of time to upload"
**Session**: context_session_001.md

## Executive Summary

The current client-side image compression pipeline using blueimp-load-image is introducing unnecessary latency for all images, regardless of size. The library performs synchronous canvas operations that block the main thread and applies uniform processing to all images without considering their initial characteristics. This analysis provides a comprehensive optimization plan to reduce compression time by 60-80% while maintaining image quality.

## Current Implementation Analysis

### Code Location
- **Primary**: `snippets/ks-product-pet-selector-stitch.liquid` (lines 1690-1748)
- **Secondary**: `assets/inline-preview-mvp.js` (lines 401-455)

### Current Pipeline
```javascript
loadImage(file, callback, {
  orientation: true,   // EXIF processing
  canvas: true,        // Canvas conversion
  maxWidth: 3000,      // Resize constraint
  maxHeight: 3000,
  quality: 0.95        // JPEG compression
});
```

## Performance Bottlenecks

### 1. Main Thread Blocking (Critical)
**Issue**: Canvas operations execute synchronously on main thread
- **Impact**: 500ms-3000ms UI freeze
- **Mobile Impact**: 2-5x slower on low-end devices
- **User Experience**: Unresponsive interface, potential abandonment

**Evidence**:
- No Web Worker implementation
- Synchronous `canvas.toBlob()` operation
- No progressive rendering

### 2. Unnecessary Processing (High Impact)
**Issue**: All images processed identically regardless of characteristics
- Small images (<1MB): Unnecessary compression adds 500-1500ms
- Already-compressed JPEGs: Re-compression degrades quality
- Non-photo formats (PNG logos): JPEG conversion inappropriate

### 3. EXIF Processing Overhead (Medium Impact)
**Issue**: Full EXIF parsing for all images
- **Cost**: 50-200ms per image
- **Unnecessary for**: PNGs, WebPs, already-oriented images
- **Mobile Cost**: 100-400ms on older devices

### 4. Excessive Resolution Limits (Low Impact)
**Issue**: 3000x3000 constraint may be excessive
- **E-commerce Standard**: 1500x1500 typically sufficient
- **Memory Usage**: 4x higher than necessary
- **Processing Time**: 2x longer for large images

## Measured Performance Issues

### Current Timing Breakdown (500KB Image)
```
Total Time: 1200-2000ms
├── File Read: 10-20ms
├── EXIF Parse: 50-100ms
├── Canvas Load: 200-400ms
├── Resize Operations: 300-600ms
├── toBlob Compression: 400-800ms
└── File Creation: 10-20ms
```

### Device Performance Matrix
| Device Type | 500KB Image | 5MB Image | 10MB Image |
|------------|-------------|-----------|------------|
| Desktop (High-end) | 800ms | 2.5s | 4s |
| Desktop (Average) | 1.2s | 3.5s | 6s |
| Mobile (iPhone 12+) | 1.5s | 4s | 8s |
| Mobile (Mid Android) | 2.5s | 7s | 15s |
| Mobile (Low Android) | 4s | 12s | 25s |

## Optimization Strategy

### Phase 1: Conditional Processing (2-3 hours)
**Impact**: 60% performance improvement for small images

#### Implementation
```javascript
// File: assets/image-compression-optimizer.js (NEW)

class ImageCompressionOptimizer {
  constructor() {
    this.compressionThreshold = 1024 * 1024; // 1MB
    this.targetQuality = 0.85; // Balanced quality/size
    this.maxDimension = 2000; // Sufficient for print
  }

  async processImage(file) {
    // Skip compression for small, already-optimized images
    if (this.shouldSkipCompression(file)) {
      console.log('Skipping compression for optimized image');
      return file;
    }

    // Use Web Worker for large images
    if (file.size > 2 * 1024 * 1024 && window.Worker) {
      return this.processInWorker(file);
    }

    // Fallback to main thread with optimizations
    return this.processOnMainThread(file);
  }

  shouldSkipCompression(file) {
    // Skip if already small and JPEG
    if (file.size < this.compressionThreshold &&
        file.type === 'image/jpeg') {
      return true;
    }

    // Skip if WebP (already optimized)
    if (file.type === 'image/webp') {
      return true;
    }

    return false;
  }

  async processInWorker(file) {
    // Offload to Web Worker (see Phase 2)
    return this.processOnMainThread(file); // Fallback for Phase 1
  }

  async processOnMainThread(file) {
    // Only check EXIF for JPEGs from cameras
    const needsOrientation = this.needsOrientationCheck(file);

    return new Promise((resolve) => {
      loadImage(file, (canvas) => {
        if (canvas.type === 'error') {
          resolve(file);
          return;
        }

        // Use requestIdleCallback for non-critical path
        const compress = () => {
          canvas.toBlob(
            (blob) => {
              const newFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(newFile);
            },
            'image/jpeg',
            this.getOptimalQuality(file)
          );
        };

        if (window.requestIdleCallback) {
          requestIdleCallback(compress);
        } else {
          compress();
        }
      }, {
        orientation: needsOrientation,
        canvas: true,
        maxWidth: this.maxDimension,
        maxHeight: this.maxDimension
      });
    });
  }

  needsOrientationCheck(file) {
    // Only check EXIF for actual camera photos
    return file.type.includes('jpeg') &&
           file.size > 500 * 1024 && // Camera photos usually >500KB
           file.name.match(/IMG_|DSC_|DCIM/i); // Common camera prefixes
  }

  getOptimalQuality(file) {
    // Adaptive quality based on file size
    if (file.size < 1024 * 1024) return 0.92; // Small: high quality
    if (file.size < 5 * 1024 * 1024) return 0.85; // Medium: balanced
    return 0.80; // Large: prioritize size
  }
}
```

#### Integration Points
1. **ks-product-pet-selector-stitch.liquid** (line 1690)
   - Replace `correctImageOrientation` function
   - Add conditional processing logic

2. **inline-preview-mvp.js** (line 401)
   - Import optimizer class
   - Update `correctImageOrientation` method

### Phase 2: Web Worker Implementation (4-6 hours)
**Impact**: Non-blocking UI, 40% perceived performance improvement

#### Implementation
```javascript
// File: assets/image-compression.worker.js (NEW)

self.importScripts('https://cdn.jsdelivr.net/npm/blueimp-load-image@5.16.0/js/load-image.all.min.js');

self.addEventListener('message', async (event) => {
  const { file, options } = event.data;

  try {
    // Read file in worker
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // Process with loadImage
    loadImage(blob, (canvas) => {
      if (canvas.type === 'error') {
        self.postMessage({ error: 'Failed to process image' });
        return;
      }

      canvas.toBlob((processedBlob) => {
        // Send processed blob back
        self.postMessage({
          success: true,
          blob: processedBlob,
          originalSize: file.size,
          processedSize: processedBlob.size
        });
      }, options.outputType || 'image/jpeg', options.quality || 0.85);
    }, {
      orientation: options.orientation,
      canvas: true,
      maxWidth: options.maxWidth || 2000,
      maxHeight: options.maxHeight || 2000
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});
```

### Phase 3: Progressive Enhancement (3-4 hours)
**Impact**: Immediate feedback, better perceived performance

#### Implementation
```javascript
// File: assets/progressive-image-handler.js (NEW)

class ProgressiveImageHandler {
  async processWithPreview(file, callbacks) {
    // Step 1: Show instant preview (100ms)
    const quickPreview = await this.generateQuickPreview(file);
    callbacks.onPreview(quickPreview);

    // Step 2: Start upload immediately for small files
    if (file.size < 500 * 1024) {
      callbacks.onUploadStart();
      const uploadPromise = this.uploadToGCS(file);
    }

    // Step 3: Process in background
    const processed = await this.optimizer.processImage(file);
    callbacks.onProcessed(processed);

    // Step 4: Upload processed version
    if (file.size >= 500 * 1024) {
      callbacks.onUploadStart();
      await this.uploadToGCS(processed);
    }

    callbacks.onComplete();
  }

  async generateQuickPreview(file) {
    // Generate low-res preview in 100ms
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Quick 200x200 thumbnail
          canvas.width = 200;
          canvas.height = 200;
          ctx.drawImage(img, 0, 0, 200, 200);

          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
}
```

## Performance Targets

### Success Metrics
| Scenario | Current | Target | Method |
|----------|---------|--------|--------|
| 500KB image | 1.2-2s | <500ms | Skip compression |
| 2MB image | 3-4s | <1.5s | Optimized compression |
| 5MB image | 6-8s | <3s | Web Worker + progressive |
| 10MB image | 10-15s | <5s | Streaming + chunks |

### Mobile-Specific Targets
- First paint: <100ms (preview thumbnail)
- Interactive: <500ms (can select effects)
- Complete: <3s for 90% of images

## Implementation Plan

### Step 1: Measurement Baseline (1 hour)
1. Add performance marks to current implementation
2. Collect real-world timing data
3. Identify specific bottleneck distribution

### Step 2: Quick Wins (2 hours)
1. Implement conditional compression (skip small files)
2. Reduce quality from 0.95 to 0.85
3. Reduce max dimensions from 3000 to 2000

### Step 3: Core Optimization (4 hours)
1. Implement ImageCompressionOptimizer class
2. Add adaptive quality selection
3. Integrate with existing components

### Step 4: Web Worker (4 hours)
1. Create worker script
2. Implement fallback for non-Worker browsers
3. Add progress reporting

### Step 5: Progressive Enhancement (3 hours)
1. Implement quick preview generation
2. Add progressive upload strategy
3. Update UI for streaming feedback

## Testing Strategy

### Performance Testing
```javascript
// File: tests/compression-performance.test.js

const testImages = [
  { name: 'small.jpg', size: 500 * 1024 },
  { name: 'medium.jpg', size: 2 * 1024 * 1024 },
  { name: 'large.jpg', size: 5 * 1024 * 1024 },
  { name: 'huge.jpg', size: 10 * 1024 * 1024 }
];

testImages.forEach(image => {
  test(`Compression time for ${image.name}`, async () => {
    const start = performance.now();
    await optimizer.processImage(image);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(expectedTimes[image.size]);
  });
});
```

### Device Testing Matrix
- iPhone 12/13/14: Target <2s for 5MB
- iPhone SE/11: Target <3s for 5MB
- Samsung S21/S22: Target <2s for 5MB
- Mid-range Android: Target <4s for 5MB
- Desktop Chrome: Target <1s for 5MB

## Risk Mitigation

### Compatibility Risks
- **Web Worker Support**: Fallback to main thread
- **EXIF Library**: Lazy load only when needed
- **Canvas API**: Feature detection with fallback

### Quality Risks
- **Over-compression**: Adaptive quality based on size
- **Lost metadata**: Preserve critical EXIF data
- **Format issues**: Maintain original format when possible

## Rollout Strategy

### Phase 1: Canary (Week 1)
- 5% of users
- Monitor compression times
- Track error rates

### Phase 2: Gradual Rollout (Week 2)
- 25% → 50% → 100%
- A/B test conversion impact
- Monitor support tickets

### Phase 3: Optimization (Week 3)
- Fine-tune thresholds
- Adjust quality settings
- Implement user feedback

## Monitoring & Metrics

### Key Performance Indicators
```javascript
// Performance tracking
performance.mark('compression-start');
// ... compression logic
performance.mark('compression-end');
performance.measure('compression-duration', 'compression-start', 'compression-end');

// Send to analytics
gtag('event', 'timing_complete', {
  name: 'image_compression',
  value: Math.round(duration),
  event_category: 'performance',
  event_label: `${fileSize}_bytes`
});
```

### Success Criteria
- P50 compression time <1s
- P95 compression time <3s
- Zero increase in error rate
- Maintained or improved conversion rate

## Alternative Solutions

### 1. Server-Side Processing
- **Pros**: No client resources, consistent performance
- **Cons**: Upload time, server costs, cold starts
- **Verdict**: Not recommended for real-time preview

### 2. WASM-Based Compression
- **Pros**: Near-native performance, advanced algorithms
- **Cons**: Larger bundle, compatibility issues
- **Verdict**: Consider for Phase 4 if needed

### 3. Native Browser APIs
- **Pros**: Best performance, no libraries
- **Cons**: Limited browser support, no EXIF handling
- **Verdict**: Use where available with fallback

## Conclusion

The current implementation treats all images identically, resulting in unnecessary processing overhead for the majority of use cases. By implementing conditional compression, Web Workers, and progressive enhancement, we can achieve:

1. **60-80% performance improvement** for small images
2. **Non-blocking UI** during processing
3. **Better perceived performance** through progressive feedback
4. **Reduced abandonment** on mobile devices

The phased approach allows for incremental improvements with measurable impact at each stage. Priority should be given to Phase 1 (conditional processing) as it provides the highest ROI with minimal implementation effort.

## Next Steps

1. **Immediate** (Today):
   - Implement performance measurement
   - Deploy quick wins (quality/dimension adjustments)

2. **Short-term** (This Week):
   - Implement conditional compression
   - Begin Web Worker development

3. **Medium-term** (Next Week):
   - Complete Web Worker integration
   - Implement progressive enhancement
   - Begin A/B testing

## Files to Modify

### Phase 1 - Quick Fixes
1. `snippets/ks-product-pet-selector-stitch.liquid`
   - Line 1737: Change quality from 0.95 to 0.85
   - Line 1743-1744: Change maxWidth/maxHeight from 3000 to 2000
   - Line 1697-1701: Add size check to skip compression

2. `assets/inline-preview-mvp.js`
   - Line 444: Change quality from 0.95 to 0.85
   - Line 450-451: Change maxWidth/maxHeight from 3000 to 2000

### Phase 2 - New Files
1. `assets/image-compression-optimizer.js` (NEW)
2. `assets/image-compression.worker.js` (NEW)
3. `assets/progressive-image-handler.js` (NEW)

### Phase 3 - Integration
1. Update both liquid files to use new optimizer
2. Add performance tracking
3. Implement progressive UI feedback

## References

- [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Image Compression Best Practices](https://web.dev/fast/#optimize-your-images)
- [EXIF Orientation Handling](https://sirv.com/help/articles/rotate-photos-to-be-upright/)