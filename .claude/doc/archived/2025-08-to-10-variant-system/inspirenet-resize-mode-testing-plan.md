# InSPyReNet API Resize Mode Testing Implementation Plan

## Executive Summary
Test changing the InSPyReNet API resize mode from "static" to "dynamic" to improve edge sharpness and quality. The dynamic mode produces sharper edges but may be less stable than static mode.

## Context & Background

### Current State Analysis
- **Current Configuration**: `INSPIRENET_RESIZE=static` (set in all deployment configurations)
- **Performance Metrics**: 11s cold start, 3s warm processing
- **Deployment**: Google Cloud Run with NVIDIA L4 GPU
- **Model**: InSPyReNet via transparent-background package
- **Traffic**: 70% mobile users requiring high-quality pet portraits

### Technical Discovery
Based on transparent-background package documentation:
- **Static Mode** (current): Less detailed prediction but more stable, was introduced to replace the --jit workaround
- **Dynamic Mode** (proposed): Better edge quality and sharper results but potentially less stable
- **Trade-off**: Edge sharpness vs processing stability

## Implementation Plan

### Phase 1: Testing Infrastructure Setup (2 hours)

#### 1.1 Create Comparison Test Script
**File**: `backend/inspirenet-api/tests/test_resize_mode_comparison.py`

```python
"""
Test script to compare static vs dynamic resize modes
Tests edge quality, processing stability, and performance
"""

import os
import time
import json
import numpy as np
from PIL import Image
import cv2
from typing import Dict, List, Tuple
import hashlib

class ResizeModeComparator:
    def __init__(self):
        self.test_images = [
            "backend/inspirenet-api/tests/Images/Tex.jpeg",
            "testing/IMG_2733.jpeg",
            "Sam.jpg"  # If available
        ]
        self.metrics = {
            'edge_sharpness': [],
            'processing_time': [],
            'stability_score': [],
            'memory_usage': []
        }

    def measure_edge_sharpness(self, image: Image.Image) -> float:
        """
        Measure edge sharpness using Laplacian variance
        Higher values indicate sharper edges
        """
        # Convert to grayscale for edge detection
        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGBA2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return laplacian.var()

    def measure_stability(self, results: List[Image.Image]) -> float:
        """
        Measure consistency across multiple runs
        Lower variance indicates better stability
        """
        # Compare pixel-wise differences between runs
        differences = []
        for i in range(len(results) - 1):
            diff = np.array(results[i]) - np.array(results[i + 1])
            differences.append(np.mean(np.abs(diff)))
        return np.std(differences) if differences else 0.0

    def run_comparison(self):
        """Execute comparison test between modes"""
        pass  # Implementation details below
```

#### 1.2 Create Edge Quality Analyzer
**File**: `backend/inspirenet-api/src/edge_quality_analyzer.py`

```python
"""
Analyze edge quality of background removal results
Focus on pet fur edges and fine details
"""

class EdgeQualityAnalyzer:
    def analyze_alpha_channel(self, image: Image.Image) -> Dict:
        """Analyze the alpha channel for edge quality metrics"""

    def detect_halos(self, image: Image.Image) -> float:
        """Detect white/light halos around edges"""

    def measure_fur_detail(self, image: Image.Image) -> float:
        """Measure preservation of fine fur details"""
```

### Phase 2: Local Testing Environment (1 hour)

#### 2.1 Create Docker Test Environment
**File**: `backend/inspirenet-api/docker-compose.test.yaml`

```yaml
version: '3.8'
services:
  api-static:
    build: .
    environment:
      - INSPIRENET_MODE=base
      - INSPIRENET_RESIZE=static
      - TARGET_SIZE=1024
      - LOG_LEVEL=debug
    ports:
      - "8001:8000"

  api-dynamic:
    build: .
    environment:
      - INSPIRENET_MODE=base
      - INSPIRENET_RESIZE=dynamic
      - TARGET_SIZE=1024
      - LOG_LEVEL=debug
    ports:
      - "8002:8000"
```

#### 2.2 Update Main Configuration
**Modify**: `backend/inspirenet-api/src/main.py` (line 184)

Add configuration validation and logging:
```python
# Line 184 - Add validation
resize_mode = os.getenv("INSPIRENET_RESIZE", "static")
if resize_mode not in ["static", "dynamic"]:
    logger.warning(f"Invalid resize_mode: {resize_mode}, defaulting to static")
    resize_mode = "static"
logger.info(f"Using resize_mode: {resize_mode}")
```

### Phase 3: Comparative Testing (2 hours)

#### 3.1 Test Suite Execution
1. **Edge Quality Tests**
   - Process 10 pet images with both modes
   - Measure edge sharpness scores
   - Analyze alpha channel quality
   - Detect halo artifacts

2. **Stability Tests**
   - Process same image 5 times with each mode
   - Measure pixel-wise consistency
   - Track processing time variance
   - Monitor memory usage patterns

3. **Performance Tests**
   - Measure processing time for various image sizes
   - Track GPU memory consumption
   - Monitor container stability

#### 3.2 Test Metrics Collection
```python
# Metrics to collect
metrics = {
    'edge_quality': {
        'sharpness_score': float,  # Laplacian variance
        'fur_detail_score': float,  # Custom metric
        'halo_score': float,  # Lower is better
        'alpha_smoothness': float
    },
    'stability': {
        'consistency_score': float,  # Std dev across runs
        'crash_count': int,
        'timeout_count': int,
        'memory_spike_count': int
    },
    'performance': {
        'avg_processing_time': float,
        'p95_processing_time': float,
        'memory_peak': float,
        'gpu_utilization': float
    }
}
```

### Phase 4: Staging Deployment Test (2 hours)

#### 4.1 Create Staging Configuration
**File**: `backend/inspirenet-api/deploy-staging-dynamic.yaml`

Copy existing staging config and modify:
```yaml
env:
  - name: INSPIRENET_RESIZE
    value: "dynamic"  # Changed from static
  - name: ENABLE_METRICS_COLLECTION
    value: "true"
```

#### 4.2 A/B Testing Setup
1. Deploy two Cloud Run services:
   - `inspirenet-api-static` (current)
   - `inspirenet-api-dynamic` (test)

2. Route 10% traffic to dynamic version initially

3. Monitor metrics:
   - Error rates
   - Processing times
   - Memory usage patterns
   - Customer feedback (if available)

### Phase 5: Results Analysis & Decision (1 hour)

#### 5.1 Create Comparison Report
**File**: `backend/inspirenet-api/tests/resize_mode_results.md`

Template:
```markdown
# Resize Mode Comparison Results

## Executive Summary
- Edge Quality Improvement: X%
- Stability Impact: Y%
- Performance Change: Z%

## Detailed Metrics
### Edge Quality
- Static Mode: [metrics]
- Dynamic Mode: [metrics]
- Visual Comparison: [side-by-side images]

### Stability Analysis
- Crash/Error Rate
- Processing Consistency
- Memory Stability

### Recommendations
[Based on data]
```

#### 5.2 Decision Criteria
**GO with Dynamic if:**
- Edge quality improvement > 20%
- Stability degradation < 5%
- No increase in error rates
- Processing time increase < 10%

**STAY with Static if:**
- Stability issues detected
- Error rate increases
- Memory usage spikes > 20%
- Minimal edge quality improvement

### Phase 6: Production Rollout (If Approved)

#### 6.1 Gradual Rollout Plan
1. **Week 1**: 5% traffic to dynamic
2. **Week 2**: 20% traffic if stable
3. **Week 3**: 50% traffic if metrics positive
4. **Week 4**: 100% if all criteria met

#### 6.2 Update All Deployment Configurations
Files to modify:
- `deploy-production-clean.yaml` (line 89)
- `deploy-simple.sh` (line 16)
- `Dockerfile` (line 68)
- `deploy-staging.yaml` (line 74)
- `cloudbuild-nocache.yaml` (line 40)
- `scripts/deploy-model-fix.sh` (line 23)

#### 6.3 Rollback Plan
```bash
# Quick rollback script
#!/bin/bash
gcloud run services update-traffic inspirenet-bg-removal-api \
    --to-revisions=static-version=100 \
    --region=us-central1
```

## Risk Assessment

### Identified Risks
1. **Stability Issues** (Medium)
   - Dynamic mode may cause inconsistent outputs
   - Mitigation: Comprehensive stability testing, gradual rollout

2. **Memory Spikes** (Low-Medium)
   - Dynamic resizing may use more memory
   - Mitigation: Monitor memory usage, set appropriate limits

3. **Processing Time Increase** (Low)
   - Dynamic mode might be slower
   - Mitigation: Performance testing, caching optimization

4. **Edge Case Failures** (Medium)
   - Certain image types may fail with dynamic mode
   - Mitigation: Extensive testing with diverse images

## Success Metrics

### Primary Metrics
- **Edge Sharpness Score**: Target 20%+ improvement
- **Customer Satisfaction**: Monitor support tickets for quality complaints
- **Error Rate**: Must remain < 0.1%
- **P95 Processing Time**: Must stay < 4s

### Secondary Metrics
- Alpha channel smoothness improvement
- Fur detail preservation score
- Halo artifact reduction
- Memory usage consistency

## Timeline

**Total Estimated Time**: 8 hours

1. **Day 1** (3 hours)
   - Testing infrastructure setup
   - Local environment configuration
   - Initial test runs

2. **Day 2** (3 hours)
   - Comprehensive testing
   - Staging deployment
   - Metrics collection

3. **Day 3** (2 hours)
   - Results analysis
   - Decision making
   - Documentation

## Next Steps

1. Review this plan with stakeholders
2. Allocate GPU resources for testing
3. Prepare test image dataset
4. Set up monitoring dashboards
5. Execute Phase 1

## Appendix

### A. Sample Test Images
Recommend testing with:
- Long-haired pets (challenging fur edges)
- Dark pets on dark backgrounds
- White pets on light backgrounds
- Multiple pets in one image
- Low contrast scenarios

### B. Monitoring Dashboard
Key metrics to track:
- Real-time edge quality scores
- Processing time percentiles
- Memory usage patterns
- Error logs with resize_mode tag

### C. Documentation Updates
If dynamic mode is adopted:
- Update API documentation
- Add notes about edge quality improvements
- Document any known limitations
- Update troubleshooting guide