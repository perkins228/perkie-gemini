# Background Removal Quality Regression Analysis & Implementation Plan

## Executive Summary
User reports quality regression in background removal after rollback from revision 00080-lqj to 00084-yiq. Analysis reveals the API is correctly configured with InSPyReNet "base" mode at 1024px, but there may be opportunities for quality improvements.

## Current Configuration Analysis

### Model Configuration (VERIFIED)
- **Package**: transparent-background v1.3.4 (latest stable)
- **Model**: InSPyReNet (official implementation)
- **Mode**: "base" (highest quality, 1024x1024 resolution)
- **Resize Mode**: "static" (more stable but potentially less sharp)
- **Target Size**: 1024px
- **Device**: NVIDIA L4 GPU (when available)

### Key Findings

1. **Model Version is Current**
   - Using transparent-background 1.3.4 (latest stable release)
   - InSPyReNet "base" mode is the highest quality setting
   - No newer stable versions available that would improve quality

2. **Potential Quality Issues Identified**

   a) **Resize Mode Setting**
   - Currently using "static" resize mode for stability
   - "dynamic" resize mode produces sharper edges but may be less stable
   - This could be causing perceived quality regression

   b) **Target Size Limitation**
   - Fixed at 1024px which matches the model's training resolution
   - Larger images are downscaled, potentially losing detail
   - Consider adaptive sizing based on input image dimensions

   c) **NumPy Type Workaround**
   - Code includes workaround for NumPy type errors (lines 214-222)
   - This conversion might introduce subtle quality degradation
   - Should investigate root cause and proper fix

3. **Rollback Impact Analysis**
   - Rollback from 00080-lqj to 00084-yiq was due to container failure
   - Both revisions use same image: "inspirenet-bg-removal-api:critical-fix"
   - Configuration appears identical between revisions
   - Quality regression likely not from code changes but from:
     - Different container initialization
     - Memory/GPU state differences
     - Possible model weight corruption

## Quality Comparison: Mode Settings

### Current: Base Mode (1024x1024)
- **Pros**: Highest quality, best detail preservation
- **Cons**: Higher memory usage (6GB for HD images), slower processing
- **Use Case**: Production quality for customer portraits

### Alternative: Fast Mode (384x384)
- **Pros**: 3x faster, less memory usage
- **Cons**: Significantly lower quality, loss of fine details
- **Use Case**: Not suitable for production pet portraits

### Alternative: Base-Nightly Mode
- **Pros**: Latest experimental improvements
- **Cons**: Unstable, can change without notice
- **Use Case**: Not recommended for production

## Recommended Implementation Plan

### Phase 1: Immediate Quality Verification (2-4 hours)

1. **Verify Model Weights Integrity**
   ```python
   # Add model checksum verification
   def verify_model_integrity(self):
       """Verify model weights are not corrupted"""
       if self.model is None:
           return False

       # Add hash check for model weights
       # Compare with known good hash
       return True
   ```

2. **Test Dynamic Resize Mode**
   - Change `INSPIRENET_RESIZE` from "static" to "dynamic"
   - Test on sample images for edge sharpness improvement
   - Monitor for stability issues

3. **Fix NumPy Type Error Root Cause**
   - Update numpy/Pillow versions to compatible ranges
   - Remove workaround if possible to avoid conversion overhead

### Phase 2: Quality Optimization (4-6 hours)

1. **Implement Adaptive Target Sizing**
   ```python
   def get_optimal_target_size(self, image_width, image_height):
       """Calculate optimal processing size based on input"""
       max_dim = max(image_width, image_height)

       if max_dim <= 1024:
           return 1024  # Use base resolution for small images
       elif max_dim <= 2048:
           return 1536  # Intermediate size for medium images
       else:
           return 2048  # Maximum practical size
   ```

2. **Add Quality Presets**
   ```python
   QUALITY_PRESETS = {
       'standard': {'mode': 'base', 'resize': 'static', 'target': 1024},
       'high': {'mode': 'base', 'resize': 'dynamic', 'target': 1536},
       'maximum': {'mode': 'base', 'resize': 'dynamic', 'target': 2048}
   }
   ```

3. **Implement Edge Enhancement Post-Processing**
   ```python
   def enhance_edges(self, mask):
       """Apply edge enhancement to improve perceived quality"""
       # Use guided filter or morphological operations
       # to refine edges without artifacts
       return enhanced_mask
   ```

### Phase 3: Testing & Validation (2-3 hours)

1. **Create Quality Test Suite**
   - Collect 20-30 diverse pet images
   - Include challenging cases (fluffy fur, similar backgrounds)
   - Compare outputs across different settings

2. **A/B Testing Framework**
   - Deploy quality variants to different endpoints
   - Measure user satisfaction metrics
   - Track processing times and error rates

3. **Performance Monitoring**
   - Log quality scores for each processing request
   - Track model loading times and memory usage
   - Monitor for OOM errors with larger target sizes

### Phase 4: Deployment Strategy (1-2 hours)

1. **Staged Rollout**
   - Deploy to staging environment first
   - Test with 10% production traffic
   - Monitor for quality complaints

2. **Configuration Management**
   - Make quality settings configurable via environment variables
   - Allow per-request quality overrides
   - Implement fallback to stable settings on errors

3. **Documentation Updates**
   - Document quality settings and trade-offs
   - Create troubleshooting guide for quality issues
   - Update API documentation with quality parameters

## Critical Implementation Notes

### Memory Considerations
- Higher quality settings require more GPU memory
- Current L4 GPU has 24GB VRAM (sufficient for 2048px processing)
- Implement automatic fallback to lower quality on OOM

### Cold Start Impact
- Model loading already takes 20-30s
- Quality improvements should not significantly increase this
- Consider caching processed results more aggressively

### Cost Implications
- Higher quality = longer processing time = higher GPU costs
- Estimate: +20-30% processing time for maximum quality
- Consider offering quality tiers with different pricing

## Risk Mitigation

1. **Rollback Plan**
   - Keep current settings as "stable" preset
   - Implement feature flags for new quality modes
   - Monitor error rates closely after deployment

2. **Quality Regression Prevention**
   - Add automated quality testing to CI/CD
   - Implement visual regression tests
   - Store reference outputs for comparison

3. **User Communication**
   - Notify users of quality improvements
   - Provide option to choose quality level
   - Collect feedback on perceived quality

## Success Metrics

1. **Quality Metrics**
   - Edge sharpness score improvement >15%
   - User satisfaction rating >4.5/5
   - Support tickets about quality <5/week

2. **Performance Metrics**
   - Processing time <5s for standard quality (warm)
   - OOM errors <0.1% of requests
   - Cold start time maintained <60s

3. **Business Metrics**
   - Conversion rate improvement >2%
   - Reduced refund requests by >10%
   - Customer retention improvement >5%

## Next Steps

1. **Immediate Action** (Today)
   - Test dynamic resize mode on staging
   - Verify model weights integrity
   - Create quality test image set

2. **Short Term** (This Week)
   - Implement adaptive sizing
   - Deploy quality presets
   - Begin A/B testing

3. **Long Term** (This Month)
   - Full quality optimization rollout
   - Customer feedback collection
   - Consider alternative models (RMBG-2.0, BiRefNet)

## Alternative Model Consideration

If quality issues persist, consider evaluating:
- **RMBG-2.0**: Newer model with reported improvements
- **BiRefNet**: Better handling of fine details
- **SAM2**: Segment Anything Model v2 for complex scenes

However, InSPyReNet remains the gold standard for pet portrait background removal when properly configured.

## Conclusion

The quality regression is likely due to:
1. Static resize mode limiting edge sharpness
2. Fixed 1024px processing missing details in larger images
3. Possible model state issues from the container failure

The recommended approach is to optimize current InSPyReNet configuration before considering model changes, as it's already using the highest quality model available in the transparent-background package.