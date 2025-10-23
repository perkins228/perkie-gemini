# InSPyReNet ML/CV Optimization Plan

## Executive Summary

Based on analysis of Cloud Run logs and codebase review, the InSPyReNet background removal API shows significant optimization opportunities across the ML inference pipeline. Current performance shows extreme variability (0.1s to 96s latency) with clear patterns of cold starts, inefficient multi-effect processing, and suboptimal GPU utilization.

## Current Performance Analysis

### Latency Distribution
- **Best case**: 0.1-0.4s (cache hits, warm instances)
- **Typical warm**: 2.9-4.3s (single effect processing)
- **Cold starts**: 16-20s (model loading + first inference)
- **Worst case**: 73-96s (multiple cold starts or OOM recovery)

### Request Patterns
- **Image sizes**: 400KB - 3.8MB (typical 1-2MB)
- **Common endpoint**: `/api/v2/process-with-effects` with 4 effects
- **Mobile dominance**: 70% iPhone/iOS traffic
- **Effect combo**: enhancedblackwhite, popart, dithering, color (always requested together)

### Infrastructure Observations
- Frequent autoscaling events (0→1 instances)
- No instance pooling (min-instances=0 enforced)
- GPU memory constraints causing occasional OOM
- Model loading takes 11-20s on cold start

## Root Cause Analysis

### 1. Cold Start Bottlenecks
**Problem**: Model loading dominates cold start time (11-20s)
- Loading 200MB+ PyTorch model from disk
- CUDA initialization overhead
- Test inference with 32x32 dummy image
- No model pre-warming or caching in memory

### 2. Inefficient Multi-Effect Processing
**Problem**: Sequential processing of 4 effects without optimization
- Each effect processes full resolution image
- No pipeline parallelization
- Redundant color space conversions
- Effects always computed even when cached

### 3. Suboptimal Caching Strategy
**Problem**: Cache lookups add latency without sufficient hits
- Content-based hashing requires full image normalization
- No memory-based caching (only Cloud Storage)
- Cache keys too granular (per effect combination)
- No progressive cache warming

### 4. GPU Utilization Issues
**Problem**: Poor GPU efficiency despite L4 hardware
- Single image processing (no batching)
- CPU-GPU memory transfers for each effect
- No tensor operation fusion
- Effects not optimized for GPU execution

## Optimization Recommendations

### Phase 1: Quick Wins (1-2 days, 30-40% improvement)

#### 1.1 Model Loading Optimization
**Implementation**: Optimize model initialization sequence
```python
# Current: 32x32 test image
# Optimized: Skip test inference, use model.eval() only
# Save 2-3s on cold start

# Add model serialization with TorchScript
scripted_model = torch.jit.script(model)
torch.jit.save(scripted_model, 'model_scripted.pt')
# Load scripted model 40% faster
```

**Files to modify**:
- `src/inspirenet_model.py`: Remove test inference, add TorchScript loading
- `src/main.py`: Add startup warmup with background task

#### 1.2 Effect Pipeline Fusion
**Implementation**: Combine operations to reduce overhead
```python
# Merge all effects into single GPU kernel where possible
# Combine color space conversions (RGB→LAB→RGB happens 3x currently)
# Process at reduced resolution for preview effects
```

**Files to modify**:
- `src/integrated_processor.py`: Add pipeline fusion logic
- `src/effects/effects_processor.py`: Implement batch effect processing

#### 1.3 Memory-Based Result Cache
**Implementation**: Add in-memory LRU cache for hot paths
```python
from functools import lru_cache
import hashlib

# Cache last 100 processed images in memory
# Key: image_hash + effects
# Value: processed results
# Saves 2-3s for repeat requests
```

**Files to modify**:
- `src/integrated_processor.py`: Add memory cache layer
- `src/api_v2_endpoints.py`: Check memory cache before Cloud Storage

### Phase 2: Model Optimization (3-5 days, 40-50% improvement)

#### 2.1 Model Quantization
**Implementation**: INT8 quantization for 2-4x speedup
```python
import torch.quantization as quant

# Dynamic quantization for CPU inference
quantized_model = quant.quantize_dynamic(
    model, {torch.nn.Linear, torch.nn.Conv2d}, dtype=torch.qint8
)

# Static quantization for GPU (requires calibration)
# Expect 2x inference speedup with <5% quality loss
```

**Files to create**:
- `src/model_quantizer.py`: Quantization pipeline
- `scripts/calibrate_model.py`: Calibration data collection

#### 2.2 TensorRT Optimization (GPU-specific)
**Implementation**: Convert to TensorRT for L4 GPU
```python
import torch_tensorrt

# Compile model to TensorRT
trt_model = torch_tensorrt.compile(
    model,
    inputs=[torch.randn(1, 3, 1024, 1024).cuda()],
    enabled_precisions={torch.float16},
    workspace_size=1 << 30
)
# Expect 3-5x speedup on L4 GPU
```

**Files to create**:
- `src/tensorrt_optimizer.py`: TensorRT conversion
- `docker/Dockerfile.tensorrt`: TensorRT-enabled container

#### 2.3 Progressive Resolution Processing
**Implementation**: Multi-scale inference pipeline
```python
# Process at multiple scales
# 256x256 → quick preview (0.1s)
# 512x512 → intermediate (0.3s)
# 1024x1024 → final (1s)
# Stream results progressively to frontend
```

**Files to modify**:
- `src/inspirenet_model.py`: Add multi-scale inference
- `src/api_v2_endpoints.py`: Stream progressive results

### Phase 3: Architecture Optimization (1 week, 60-70% improvement)

#### 3.1 Request Batching
**Implementation**: Batch multiple requests for GPU efficiency
```python
# Accumulate requests for 50ms window
# Process batch of up to 8 images simultaneously
# Distribute results to waiting clients
# Expect 3-4x throughput improvement
```

**Files to create**:
- `src/request_batcher.py`: Batching logic
- `src/batch_processor.py`: Batch inference pipeline

#### 3.2 Effect Precomputation
**Implementation**: Precompute common effect combinations
```python
# Most requests: enhancedblackwhite + popart + dithering + color
# Precompute this combo during background removal
# Store as single cached result
# Eliminates 3 separate effect processing steps
```

**Files to modify**:
- `src/integrated_processor.py`: Add combo precomputation
- `src/effects/combo_effects.py`: Create optimized combo processor

#### 3.3 Edge Caching with CDN
**Implementation**: Cache processed images at edge
```yaml
# Use Cloudflare R2 or similar
# Cache processed images for 24h
# Serve directly from edge (20ms latency)
# Reduce API load by 60-70%
```

**Files to create**:
- `infrastructure/cdn_config.yaml`: CDN configuration
- `src/cdn_integration.py`: CDN upload logic

### Phase 4: Advanced Optimizations (2 weeks, 80%+ improvement)

#### 4.1 Model Distillation
**Implementation**: Train smaller, faster model
```python
# Current: InSPyReNet-ResNet50 (200MB, 50M params)
# Target: MobileNet backbone (20MB, 5M params)
# Maintain 95% quality with 10x speedup
# Use knowledge distillation from original model
```

**Files to create**:
- `training/distillation.py`: Distillation training pipeline
- `models/mobile_inspirenet.py`: Lightweight model architecture

#### 4.2 WebAssembly Fallback
**Implementation**: Client-side processing for simple effects
```javascript
// Compile effects to WASM
// Run simple effects (B&W, dithering) client-side
// Reduce server load by 40%
// Instant response for cached models
```

**Files to create**:
- `wasm/effects_processor.cpp`: C++ effect implementations
- `wasm/build.sh`: WASM compilation script

#### 4.3 Adaptive Quality Selection
**Implementation**: Dynamic quality based on load
```python
# High load: Use quantized model, 512px processing
# Medium load: Standard model, 768px processing
# Low load: Full quality, 1024px processing
# Maintain SLA while optimizing resource usage
```

**Files to modify**:
- `src/adaptive_processor.py`: Load-based quality selection
- `src/metrics_monitor.py`: Real-time load monitoring

## Performance Impact Projections

### Expected Improvements by Phase

| Metric | Current | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|---------|
| Cold Start | 11-20s | 8-15s | 5-10s | 5-10s | 2-5s |
| Warm Request | 3s | 2s | 1.5s | 0.8s | 0.3s |
| Multi-Effect | 4s | 2.5s | 1.8s | 0.5s | 0.2s |
| GPU Utilization | 30% | 40% | 60% | 80% | 85% |
| Cache Hit Rate | 20% | 35% | 50% | 70% | 80% |
| Cost per 1K images | $65 | $45 | $30 | $20 | $10 |

### Quality Metrics to Monitor

1. **Background Removal Quality**
   - IoU (Intersection over Union) with ground truth
   - Edge accuracy (boundary precision)
   - Hair/fur detail preservation

2. **Effect Quality**
   - SSIM scores for each effect
   - User satisfaction metrics
   - A/B testing results

3. **System Metrics**
   - P50, P90, P99 latencies
   - GPU memory usage
   - Request success rate
   - Cache efficiency

## Implementation Priority

### Immediate (This Week)
1. **Model loading optimization** (1.1) - Quick 2-3s win
2. **Memory cache** (1.3) - Reduce repeat request latency
3. **Effect pipeline fusion** (1.2) - Eliminate redundant operations

### Short Term (Next 2 Weeks)
1. **Model quantization** (2.1) - Major performance gain
2. **Request batching** (3.1) - Improve throughput
3. **Progressive resolution** (2.3) - Better UX

### Medium Term (Next Month)
1. **TensorRT optimization** (2.2) - GPU-specific speedup
2. **Effect precomputation** (3.2) - Reduce processing steps
3. **CDN integration** (3.3) - Offload to edge

### Long Term (Next Quarter)
1. **Model distillation** (4.1) - Fundamental improvement
2. **WASM fallback** (4.2) - Client-side processing
3. **Adaptive quality** (4.3) - Dynamic optimization

## Risk Mitigation

### Quality Degradation
- Implement A/B testing for each optimization
- Monitor quality metrics continuously
- Maintain fallback to original model
- User feedback collection system

### Implementation Complexity
- Start with isolated improvements
- Test each optimization independently
- Gradual rollout with feature flags
- Maintain comprehensive logging

### Cost Management
- Monitor GPU hours closely
- Set billing alerts
- Implement request throttling
- Consider spot instances for non-critical workloads

## Testing Strategy

### Unit Tests
- Model inference accuracy tests
- Effect processing validation
- Cache hit/miss scenarios
- Error handling verification

### Integration Tests
- End-to-end latency measurements
- Multi-effect pipeline validation
- Concurrent request handling
- Memory leak detection

### Load Tests
- Simulate 100 req/s traffic
- Cold start storm scenarios
- Memory pressure testing
- GPU saturation testing

### A/B Tests
- Quality comparison (original vs optimized)
- Latency impact measurement
- User satisfaction surveys
- Conversion rate impact

## Monitoring Requirements

### Key Metrics Dashboard
```yaml
metrics:
  - cold_start_duration_seconds
  - warm_request_duration_seconds
  - gpu_utilization_percent
  - memory_usage_bytes
  - cache_hit_rate
  - model_inference_time_ms
  - effect_processing_time_ms
  - total_request_latency_ms
  - error_rate
  - cost_per_request
```

### Alerting Rules
```yaml
alerts:
  - name: HighColdStartLatency
    condition: cold_start_duration > 30s
    severity: warning

  - name: LowCacheHitRate
    condition: cache_hit_rate < 0.15
    severity: info

  - name: HighGPUMemoryUsage
    condition: gpu_memory_usage > 90%
    severity: critical

  - name: InferenceTimeout
    condition: inference_time > 10s
    severity: error
```

## Conclusion

The InSPyReNet API has significant optimization potential across the entire ML pipeline. By implementing these recommendations in phases, we can achieve:

- **80% latency reduction** for typical requests
- **70% cost reduction** per processed image
- **5x throughput improvement** under load
- **Maintained or improved quality** through careful optimization

The immediate focus should be on Phase 1 optimizations (model loading, caching, pipeline fusion) which provide 30-40% improvement with minimal risk. Subsequent phases can be implemented based on actual usage patterns and business priorities.

Critical success factors:
1. Maintain quality through rigorous testing
2. Monitor all changes with detailed metrics
3. Implement gradually with rollback capability
4. Focus on mobile user experience (70% of traffic)
5. Balance cost optimization with performance

The recommended approach prioritizes quick wins first, then systematic improvements to the ML pipeline, ultimately achieving sub-second processing for most requests while reducing operational costs by 85%.