# Timer Fix Implementation Plan
**Date**: 2025-08-20
**Priority**: CRITICAL - Affecting 70% mobile user experience

## Current Issue Summary
- **Shows**: 25-45 seconds
- **Reality**: 75-85 seconds during cold starts  
- **Gap**: 30-50 seconds underestimation

## Implementation Strategy

### Phase 1: Core Timer Fix (Immediate - 30 minutes)
1. Update `getEstimatedProcessingTime()` to include warming time
2. Increase time cap from 45s to 120s
3. Add warming state detection

### Phase 2: Two-Phase Progress (45 minutes)
1. Split progress stages into warming and processing phases
2. Update messaging for each phase
3. Implement phase transition logic

### Phase 3: Mobile Optimization (1 hour)
1. Add sticky progress card for mobile
2. Implement engagement features
3. Add haptic feedback support

## Code Changes Required

### 1. Update Base Timing (Line 1296)
```javascript
// Current:
var baseTime = apiState.isWarm ? 7 : 25;

// Fixed:
var warmingTime = apiState.isWarm ? 0 : 60;
var processingTime = apiState.isWarm ? 7 : 25; 
var baseTime = warmingTime + processingTime;
```

### 2. Update Time Cap (Line 1339)
```javascript
// Current:
return Math.min(totalTime, 45);

// Fixed:
return Math.min(totalTime, 120);
```

### 3. Update Progress Stages (Lines 1084-1091)
Split into two-phase system with warming and processing stages.

## Testing Plan
1. Test cold start timing accuracy
2. Verify mobile experience
3. Check phase transitions
4. Validate user messaging

## Success Criteria
- Timer shows 75-85s for cold starts
- No "taking longer than usual" at 60s
- Clear two-phase progress
- Mobile engagement features working