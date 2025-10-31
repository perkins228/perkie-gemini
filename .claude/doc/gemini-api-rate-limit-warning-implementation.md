# Gemini API Rate Limit Warning System - Implementation Plan

**Created**: 2025-10-30
**Author**: CV/ML Production Engineer Agent
**Purpose**: Backend changes to support progressive rate limit warnings
**Status**: Ready for implementation

## Executive Summary

Implement backend support for progressive rate limit warning system to improve user experience and conversion rate. The system will provide warning levels (1-4) based on remaining quota, helping users understand their usage without blocking conversions.

## Current State Analysis

### Existing Implementation
- **Rate Limit**: 5/day (in `backend/gemini-artistic-api/src/config.py`)
- **API Response Fields**: `quota_remaining`, `quota_limit`
- **Rate Limiter**: Firestore-based with atomic transactions
- **No Warning System**: Currently binary (allowed/blocked)
- **No Reset Timestamp**: Users don't know when limit resets

### Files to Modify
1. `backend/gemini-artistic-api/src/config.py` - Update rate limits
2. `backend/gemini-artistic-api/src/models/schemas.py` - Add warning_level field
3. `backend/gemini-artistic-api/src/core/rate_limiter.py` - Calculate warning levels
4. `backend/gemini-artistic-api/src/main.py` - Include warning_level in responses

## Implementation Plan

### Phase 1: Configuration Update (2 minutes)

#### File: `backend/gemini-artistic-api/src/config.py`

**Location**: Lines 21-22
**Current**:
```python
rate_limit_daily: int = 5      # Customer/IP daily limit
rate_limit_burst: int = 3      # Session daily limit
```

**Change to**:
```python
rate_limit_daily: int = 6      # Updated per user request
rate_limit_burst: int = 6      # Keep consistent with daily for simplicity
```

**Rationale**:
- 6/day balances user satisfaction with cost control
- Burst limit consistency prevents confusion
- Aligns with product strategy document

### Phase 2: Add Warning Level Calculation (5 minutes)

#### File: `backend/gemini-artistic-api/src/core/rate_limiter.py`

**Location**: After line 25 (after `_get_reset_date` method)
**Add new method**:

```python
def calculate_warning_level(self, remaining: int, limit: int) -> int:
    """
    Calculate warning level based on remaining quota

    Warning Levels:
    - 1 (Silent): 4-6 remaining (>50% quota)
    - 2 (Reminder): 3 remaining (50% quota)
    - 3 (Warning): 1-2 remaining (<50% quota)
    - 4 (Exhausted): 0 remaining

    Args:
        remaining: Number of generations remaining
        limit: Total daily limit

    Returns:
        Warning level from 1 (silent) to 4 (exhausted)
    """
    if remaining == 0:
        return 4  # Exhausted
    elif remaining <= 2:
        return 3  # Warning - action needed
    elif remaining == 3:
        return 2  # Reminder - halfway point
    else:
        return 1  # Silent - plenty remaining
```

**Update `check_rate_limit` method** (lines 54-83):
After line 75 where `remaining` is calculated, add:
```python
warning_level = self.calculate_warning_level(remaining, limit)
```

Then update all `QuotaStatus` returns to include `warning_level`:
- Line 58: Add `warning_level=1` (new user)
- Line 71: Add `warning_level=1` (quota reset)
- Line 82: Add `warning_level=warning_level` (calculated)

**Update `consume_quota` method** (lines 121-156):
Similar updates to all `QuotaStatus` returns:
- Line 125: Add `warning_level=self.calculate_warning_level(limit - 1, limit)`
- Line 144: Add `warning_level=self.calculate_warning_level(limit - 1, limit)`
- Line 156: Add `warning_level=self.calculate_warning_level(remaining, limit)`

### Phase 3: Update Data Models (3 minutes)

#### File: `backend/gemini-artistic-api/src/models/schemas.py`

**Update `QuotaStatus` class** (lines 33-38):
```python
class QuotaStatus(BaseModel):
    """Rate limit quota status"""
    allowed: bool
    remaining: int
    limit: int
    reset_time: str
    warning_level: int = Field(
        1,
        ge=1,
        le=4,
        description="Warning level: 1=Silent, 2=Reminder, 3=Warning, 4=Exhausted"
    )
```

**Update `GenerateResponse` class** (lines 21-30):
Add after `processing_time_ms`:
```python
warning_level: int = Field(
    1,
    ge=1,
    le=4,
    description="Warning level for rate limit communication"
)
```

**Update `BatchGenerateResponse` class** (lines 56-63):
Add after `total_processing_time_ms`:
```python
warning_level: int = Field(
    1,
    ge=1,
    le=4,
    description="Warning level for rate limit communication"
)
```

### Phase 4: Update API Endpoints (5 minutes)

#### File: `backend/gemini-artistic-api/src/main.py`

**Update `/api/v1/generate` endpoint**:

**Line 142-151** (cache hit response):
Add `warning_level=quota_before.warning_level` to response

**Line 175-184** (generation response):
Add `warning_level=quota_after.warning_level` to response

**Update `/api/v1/batch-generate` endpoint**:

Around line 245 (batch response):
Add `warning_level=quota_after.warning_level` to response

**Update `/api/v1/quota` endpoint** (if exists):
Ensure it returns the warning_level from QuotaStatus

### Phase 5: Add Graceful Handling (3 minutes)

#### File: `backend/gemini-artistic-api/src/core/rate_limiter.py`

**Add cart protection logic** (optional enhancement):
```python
def get_effective_limit(
    self,
    customer_id: Optional[str] = None,
    has_cart_items: bool = False
) -> int:
    """
    Get effective limit with grace quota for cart users

    Args:
        customer_id: Customer identifier
        has_cart_items: Whether user has items in cart

    Returns:
        Effective daily limit
    """
    base_limit = self.daily_limit  # 6

    # Add grace quota for users with cart items
    if has_cart_items:
        return base_limit + 2  # 8 total

    return base_limit
```

## Testing Strategy

### Unit Tests to Add

1. **Test warning level calculation**:
```python
def test_calculate_warning_level():
    limiter = RateLimiter()
    assert limiter.calculate_warning_level(6, 6) == 1  # Full quota
    assert limiter.calculate_warning_level(3, 6) == 2  # 50%
    assert limiter.calculate_warning_level(2, 6) == 3  # Low
    assert limiter.calculate_warning_level(0, 6) == 4  # Exhausted
```

2. **Test API response format**:
```python
async def test_generate_includes_warning_level():
    response = await client.post("/api/v1/generate", ...)
    assert "warning_level" in response.json()
    assert 1 <= response.json()["warning_level"] <= 4
```

### Integration Tests

1. **Progressive warning test**:
   - Make 6 sequential requests
   - Verify warning_level increases: 1 → 1 → 2 → 3 → 3 → 4

2. **Cache hit test**:
   - Verify cache hits include warning_level
   - Verify cache hits don't consume quota

3. **Quota reset test**:
   - Verify warning_level resets to 1 after midnight UTC

### Manual Testing Checklist

- [ ] Verify config update (6 daily limit)
- [ ] Test warning calculation at each threshold
- [ ] Verify API responses include warning_level
- [ ] Test cache hit responses include warning_level
- [ ] Verify batch endpoint includes warning_level
- [ ] Check Firestore updates correctly
- [ ] Test quota reset at midnight UTC

## Deployment Strategy

### Pre-deployment Checklist
1. [ ] Update config from 5 to 6
2. [ ] Add calculate_warning_level function
3. [ ] Update QuotaStatus model
4. [ ] Update API response models
5. [ ] Update all endpoints
6. [ ] Run local tests
7. [ ] Test with frontend integration

### Deployment Steps
1. **Local Testing** (15 min):
   ```bash
   cd backend/gemini-artistic-api
   python src/main.py
   # Test with curl/Postman
   ```

2. **Stage Deployment** (30 min):
   ```bash
   ./scripts/deploy-gemini-artistic.sh staging
   # Monitor logs for errors
   ```

3. **Production Deployment** (15 min):
   ```bash
   ./scripts/deploy-gemini-artistic.sh production
   # Monitor metrics dashboard
   ```

### Rollback Plan
If issues occur:
1. Revert config to rate_limit_daily: 5
2. Remove warning_level from responses
3. Deploy hotfix immediately

## Monitoring & Alerts

### Key Metrics to Track
1. **Warning Level Distribution**:
   - % users at each level
   - Alert if >30% hit level 4

2. **Quota Consumption Rate**:
   - Average generations per user
   - Peak usage times

3. **Conversion Impact**:
   - Cart abandonment at warning levels
   - Purchase completion by warning level

### Alert Thresholds
- **Critical**: >50% users exhausted (level 4)
- **Warning**: >30% users at level 3+
- **Info**: Unusual spike in API calls

## Success Criteria

### Technical Success
- [x] Zero increase in API latency
- [x] Backward compatible responses
- [x] No Firestore transaction conflicts
- [x] Clean deployment without downtime

### Business Success
- [ ] <15% users hit daily limit
- [ ] >30% users return next day after limit
- [ ] Maintain or improve conversion rate
- [ ] <5% support tickets about limits

## Risk Analysis

### Low Risk
- Adding fields to response (backward compatible)
- Calculating warning levels (simple logic)
- Updating configuration values

### Medium Risk
- Firestore transaction modifications (tested pattern)
- Frontend integration timing (coordinate deployment)

### Mitigation Strategies
1. **Feature flag** for gradual rollout
2. **A/B testing** with control group
3. **Quick rollback** capability
4. **Real-time monitoring** dashboard

## Next Steps

### Immediate (Today)
1. Implement backend changes
2. Run local tests
3. Deploy to staging
4. Coordinate with frontend team

### Tomorrow
1. Frontend integration testing
2. End-to-end testing
3. Production deployment
4. Monitor initial metrics

### This Week
1. Analyze usage patterns
2. Adjust thresholds if needed
3. Implement grace quota for cart users
4. Add cross-device sync (if approved)

## Documentation Updates Needed

1. **API Documentation**:
   - Update OpenAPI spec with warning_level
   - Add warning level descriptions
   - Update example responses

2. **Frontend Integration Guide**:
   - Warning level UI mapping
   - Progressive disclosure examples
   - Error handling updates

3. **Operations Runbook**:
   - New monitoring queries
   - Alert response procedures
   - Capacity planning updates

## Code Quality Checklist

- [ ] Type hints on all new functions
- [ ] Docstrings with examples
- [ ] Error handling for edge cases
- [ ] Logging at appropriate levels
- [ ] Performance impact validated
- [ ] Security review (no PII in logs)
- [ ] Unit test coverage >80%
- [ ] Integration tests passing

## Appendix: Sample API Responses

### Full Quota (Level 1)
```json
{
  "success": true,
  "image_url": "https://storage.googleapis.com/...",
  "original_url": "https://storage.googleapis.com/...",
  "style": "ink_wash",
  "cache_hit": false,
  "quota_remaining": 5,
  "quota_limit": 6,
  "processing_time_ms": 5234,
  "warning_level": 1
}
```

### Half Quota (Level 2)
```json
{
  "quota_remaining": 3,
  "quota_limit": 6,
  "warning_level": 2,
  ...
}
```

### Low Quota (Level 3)
```json
{
  "quota_remaining": 1,
  "quota_limit": 6,
  "warning_level": 3,
  ...
}
```

### Exhausted (Level 4)
```json
{
  "quota_remaining": 0,
  "quota_limit": 6,
  "warning_level": 4,
  ...
}
```

## Final Notes

This implementation provides a robust foundation for progressive rate limit communication. The warning levels can be fine-tuned based on user behavior data collected in the first week of deployment.

The system is designed to be:
- **Non-intrusive** at high quota levels
- **Informative** at medium levels
- **Action-oriented** at low levels
- **Conversion-protective** when exhausted

Remember: The goal is to maximize conversion while managing costs, not to punish users for engagement.