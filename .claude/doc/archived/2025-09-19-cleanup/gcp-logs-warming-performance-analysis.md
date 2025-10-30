# Google Cloud Run Logs Analysis - API Warming Performance Investigation

## Executive Summary
After fixing the API warming bug (commit 7805f6f), where frontend was calling `/health` instead of `/warmup`, users report perceived slower processing. This plan provides a comprehensive log analysis strategy to determine if there's actual performance degradation or if it's a perception issue due to the blocking nature of proper warming (10-15s) vs the previous non-blocking behavior (100ms).

## Context & Problem Statement

### The Bug Fix
- **Before**: Frontend called `/health` endpoint for warming
  - `/health` used `asyncio.create_task()` - non-blocking
  - Returned in <100ms while model loaded asynchronously
  - Users experienced 11s cold starts when uploading
  
- **After**: Frontend correctly calls `/warmup` endpoint
  - `/warmup` is synchronous/blocking - waits for full model load
  - Takes 10-15s to complete warming
  - Users who upload after warming get instant processing

### User Perception Issue
- **Before**: Fast "warming" (100ms) → Slow processing (11s)
- **After**: Slow warming (10-15s) → Fast processing (3s)
- **Perception**: System feels slower because warming is now visible

## Implementation Plan

### Phase 1: Log Collection Setup (30 minutes)

#### 1.1 Create Log Query Scripts
**File**: `backend/inspirenet-api/scripts/analyze-warming-logs.sh`

```bash
#!/bin/bash
# Script to collect and analyze warming-related logs

PROJECT_ID="perkie-prints-production"
SERVICE_NAME="inspirenet-bg-removal-api"
REGION="us-central1"

# Time ranges (adjust based on deployment date)
BEFORE_FIX="2025-08-15T00:00:00Z TO 2025-08-17T23:59:59Z"
AFTER_FIX="2025-08-18T00:00:00Z TO 2025-08-20T23:59:59Z"
```

#### 1.2 Define Key Metrics Collection
**Changes needed**:
- Request patterns for `/warmup` vs `/health`
- Processing times for `/remove-background` after warming
- Instance scaling behavior
- Memory/CPU utilization patterns
- Error rates and timeout patterns

### Phase 2: Data Collection Queries (1 hour)

#### 2.1 Warming Request Patterns
**Query 1: Count warming attempts**
```sql
-- Before fix (health endpoint)
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
httpRequest.requestUrl=~"/health"
timestamp>="2025-08-15T00:00:00Z" AND timestamp<="2025-08-17T23:59:59Z"

-- After fix (warmup endpoint)  
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
httpRequest.requestUrl=~"/warmup"
timestamp>="2025-08-18T00:00:00Z"
```

**Expected insights**:
- Frequency of warming calls
- Pattern changes after fix
- Potential over-warming issues

#### 2.2 Processing Time Analysis
**Query 2: Background removal latencies**
```sql
resource.type="cloud_run_revision"
resource.labels.service_name="inspirenet-bg-removal-api"
httpRequest.requestUrl=~"/remove-background"
httpRequest.latency

-- Group by:
-- 1. Before/after warming fix
-- 2. Instance age (cold vs warm)
-- 3. Time of day patterns
```

**Metrics to extract**:
- P50, P90, P99 latencies
- Cold start frequency
- Warm instance hit rate

#### 2.3 Instance Scaling Behavior
**Query 3: Instance lifecycle**
```sql
resource.type="cloud_run_revision"
metric.type="run.googleapis.com/container/instance_count"

-- Analyze:
-- Scale-up patterns
-- Instance lifetime
-- Concurrent request handling
```

**Key questions**:
- Are instances scaling differently after fix?
- Is there more aggressive scale-down?
- Are we hitting max instances more often?

#### 2.4 Memory/CPU Patterns
**Query 4: Resource utilization**
```sql
resource.type="cloud_run_revision"
metric.type=~"container/cpu/utilizations|container/memory/utilizations"

-- Focus on:
-- Warmup phase utilization
-- Processing phase utilization
-- Idle patterns
```

**Anomalies to identify**:
- Memory leaks
- CPU throttling
- Resource exhaustion

### Phase 3: Analysis Framework (2 hours)

#### 3.1 Create Analysis Script
**File**: `backend/inspirenet-api/scripts/warming-performance-analyzer.py`

```python
"""
Analyzes Cloud Run logs to determine actual vs perceived performance impact
"""

import pandas as pd
import json
from datetime import datetime, timedelta

class WarmingPerformanceAnalyzer:
    def __init__(self):
        self.before_fix_date = datetime(2025, 8, 17, 23, 59, 59)
        self.after_fix_date = datetime(2025, 8, 18, 0, 0, 0)
    
    def analyze_request_patterns(self, logs_df):
        """Compare request patterns before/after fix"""
        # Analysis logic here
        pass
    
    def calculate_actual_processing_times(self, logs_df):
        """Extract real processing times excluding warming"""
        # Analysis logic here
        pass
    
    def identify_timeout_patterns(self, logs_df):
        """Find timeout and retry patterns"""
        # Analysis logic here
        pass
    
    def generate_report(self):
        """Generate comprehensive performance report"""
        # Report generation here
        pass
```

#### 3.2 Metrics Comparison Framework
**Key comparisons needed**:

1. **Warming Effectiveness**
   - Before: How many cold starts despite "warming"?
   - After: How many true warm hits?

2. **User Experience Timeline**
   - Before: Time from page load to successful processing
   - After: Time from page load to successful processing
   - Include warming wait time in UX calculation

3. **Error Patterns**
   - Before: Timeout errors during processing
   - After: Timeout errors during warming

### Phase 4: Dashboard Creation (1 hour)

#### 4.1 Cloud Monitoring Dashboard
**File**: `backend/inspirenet-api/monitoring/warming-dashboard.json`

Dashboard panels needed:
1. Warming request rate (per hour)
2. Processing latency distribution
3. Cold start frequency
4. Instance count over time
5. Error rate comparison
6. Cost per request analysis

#### 4.2 Alert Configuration
**File**: `backend/inspirenet-api/monitoring/warming-alerts.yaml`

Alerts to configure:
```yaml
alerts:
  - name: excessive-warming
    condition: warming_requests > 10 per minute
    notification: email
  
  - name: processing-degradation
    condition: p99_latency > 15s
    notification: slack
  
  - name: cold-start-spike
    condition: cold_starts > 30% of requests
    notification: pagerduty
```

### Phase 5: Performance Testing (2 hours)

#### 5.1 Synthetic Load Testing
**File**: `backend/inspirenet-api/tests/warming-load-test.py`

Test scenarios:
1. **Scenario A**: No warming, immediate upload
2. **Scenario B**: Warming, wait for completion, upload
3. **Scenario C**: Warming, upload during warming
4. **Scenario D**: Multiple concurrent warmings

#### 5.2 A/B Testing Framework
**Approach**:
- Deploy two versions temporarily
- Version A: Current (calls /warmup)
- Version B: Rollback (calls /health)
- Compare actual metrics side-by-side

### Phase 6: Root Cause Analysis (1 hour)

#### 6.1 Hypothesis Testing

**Hypothesis 1: Blocking warming creates perception issue**
- Test: Measure actual processing times post-warming
- Expected: Processing is faster, but total time feels longer

**Hypothesis 2: Warming causes memory pressure**
- Test: Compare memory usage patterns
- Expected: Higher baseline memory after warming

**Hypothesis 3: Over-warming from multiple tabs**
- Test: Check warming frequency per user
- Expected: Multiple warming attempts despite safeguards

**Hypothesis 4: Instance recycling issues**
- Test: Instance lifetime analysis
- Expected: Instances dying before benefit realized

#### 6.2 Data Correlation Analysis
Correlate:
- Warming time vs processing time
- Instance age vs performance
- Memory usage vs latency
- Concurrent requests vs error rate

### Phase 7: Optimization Recommendations

Based on findings, potential optimizations:

#### 7.1 If Perception Issue Confirmed
1. **Add warming progress indicator**
   - Show warming status in UI
   - Educate users about one-time warming benefit

2. **Implement smart warming**
   - Warm on intent signals (hover, focus)
   - Not on page load

3. **Add warming bypass option**
   - Let power users skip warming
   - Accept cold start trade-off

#### 7.2 If Actual Performance Issue Confirmed
1. **Optimize warming endpoint**
   - Lighter weight model initialization
   - Progressive model loading

2. **Implement warming cache**
   - Share warmed state across instances
   - Use Redis/Memorystore

3. **Adjust instance configuration**
   - Increase min instances (cost trade-off)
   - Tune memory allocation
   - Adjust CPU limits

### Phase 8: Implementation Priority

**Immediate Actions** (Today):
1. Run log queries to get raw data
2. Calculate before/after metrics
3. Identify if issue is real or perceived

**Short-term** (This Week):
1. If perceived: Implement UI feedback
2. If real: Deploy hotfix for critical issues
3. Set up monitoring dashboard

**Long-term** (Next Sprint):
1. Implement comprehensive solution
2. A/B test optimizations
3. Document learnings

## Critical Commands Reference

### GCloud CLI Commands
```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api" --limit=100 --format=json

# Export logs for analysis
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=inspirenet-bg-removal-api AND timestamp>='2025-08-18T00:00:00Z'" --format=json > after_fix_logs.json

# View metrics
gcloud monitoring metrics list --filter="metric.type:run.googleapis.com"

# Check current instance configuration
gcloud run services describe inspirenet-bg-removal-api --region=us-central1
```

### Analysis Queries
```bash
# Warming frequency
gcloud logging read "httpRequest.requestUrl=~'/warmup' AND timestamp>='2025-08-18'" --format="value(timestamp)" | sort | uniq -c

# Processing latencies
gcloud logging read "httpRequest.requestUrl=~'/remove-background'" --format="csv(httpRequest.latency,timestamp)" > latencies.csv

# Error analysis
gcloud logging read "severity>=ERROR AND resource.labels.service_name='inspirenet-bg-removal-api'" --format=json
```

## Success Metrics

**Objective verification of**:
1. Actual processing time change (target: <10% degradation)
2. Cold start reduction (target: >80% reduction)
3. Error rate change (target: <5% increase)
4. Cost per request (target: <$0.01 increase)
5. User completion rate (target: maintain or improve)

## Risk Mitigation

**If critical issue found**:
1. Immediate rollback plan ready
2. Hotfix branch prepared
3. Communication to users drafted
4. Cost monitoring alerts in place

## Timeline

- **Hour 1-2**: Data collection and initial analysis
- **Hour 3-4**: Deep dive into specific patterns
- **Hour 5-6**: Report generation and recommendations
- **Hour 7-8**: Implementation planning or fixes

## Conclusion

This analysis will definitively answer whether the warming fix caused actual performance degradation or if it's a perception issue. The structured approach ensures we make data-driven decisions rather than reacting to user perception alone.

**Expected outcome**: Likely a perception issue due to visible warming time, but data will confirm. The fix eliminated 11s cold starts, which is a massive improvement despite the upfront warming cost.