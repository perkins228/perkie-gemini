# API Warming Test Verification Plan - 2025-08-18

## Context: Critical Bug Fix Implemented
**Issue**: Frontend was calling wrong endpoint `/health` instead of `/warmup`
- `/health` uses non-blocking async, returns in <100ms while model loads for 11s
- `/warmup` uses blocking sync, returns only when model is fully loaded
- **Files Modified**: `pet-processor-v5-es5.js` line 1443, `pet-processor-unified.js` line 810
- **Changes**: Endpoint `/health` → `/warmup`, Method GET → POST

## Expected Behavior After Fix
1. **Warming Call**: `/warmup` should take 10-15 seconds (blocking)
2. **Model Loading**: Model should be fully loaded after warmup completes
3. **Processing Speed**: Subsequent processing should be ~3s (not 11s)
4. **Session Limit**: Max 1 warmup per browser session
5. **Global Cooldown**: 15-minute throttle across all tabs/windows

## Test Scenarios

### 1. Basic Warming Verification
**Objective**: Confirm endpoint change is working
- Open browser DevTools (Network tab)
- Navigate to pet processor page
- **Expected**: Network request to `/warmup` endpoint (POST method)
- **Verify**: No requests to `/health` endpoint
- **Timing**: Request should take 10-15 seconds to complete

### 2. Cold Start Elimination Test
**Objective**: Verify model is properly warmed
- Complete Test 1 (wait for warmup to finish)
- Upload test image immediately after warmup completes
- **Expected**: Processing time ~3 seconds (not 11s)
- **Watch For**: No "Loading model..." delays

### 3. Session Limit Verification
**Objective**: Confirm max 1 warmup per session
- Complete Test 1
- Refresh the page
- **Expected**: No new `/warmup` request (session already warmed)
- **Verify**: Console shows "Session already has warming attempt"

### 4. Global Cooldown Test
**Objective**: Verify 15-minute throttle works
- Complete Test 1
- Open new tab/window to same page
- **Expected**: No `/warmup` request in new tab
- **Verify**: Console shows "Global warmup cooldown active"

### 5. Warm State Persistence Test
**Objective**: Verify 10-minute warm window
- Complete Test 1 (wait for warmup)
- Wait 5 minutes
- Upload test image
- **Expected**: Still fast processing (~3s)
- **Status**: Should show as "warm" state

## How to Check Correct Endpoint

### Browser DevTools Method
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR" 
4. Navigate to pet processor page
5. **Look For**:
   - ✅ POST request to `https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup`
   - ❌ NO requests to `/health` endpoint

### Console Log Method
1. Open DevTools Console
2. Navigate to pet processor page
3. **Look For**:
   - ✅ "🔥 Starting API warmup..." message
   - ✅ "✅ API warmed successfully in [time]s" after 10-15s
   - ❌ NO "/health" mentions in console

## Timing Verification

### Warmup Timing
- **Expected**: 10-15 seconds for `/warmup` to complete
- **Red Flag**: If completes in <5 seconds (likely calling wrong endpoint)
- **Monitor**: DevTools Network tab "Time" column

### Processing Timing After Warmup
- **Expected**: ~3 seconds for background removal
- **Success**: Processing starts immediately, no model loading delay
- **Failure**: 11-second delay indicates warmup failed

### Performance Measurement
```javascript
// Run in console to measure timing
console.time('warmup');
// Navigate to page, wait for warmup to complete
console.timeEnd('warmup'); // Should show 10-15 seconds
```

## Edge Cases to Test

### 1. Upload During Warmup
- Navigate to page
- Immediately upload image while warming in progress
- **Expected**: Should queue upload or show warming progress
- **Watch For**: Unexpected 11s delay during upload

### 2. Network Interruption
- Start warmup process
- Disable network briefly during warming
- Re-enable network
- **Expected**: Graceful error handling, retry capability

### 3. Multiple Tab Race Condition
- Open 3 tabs to pet processor simultaneously
- **Expected**: Only one warmup attempt globally
- **Verify**: 15-minute cooldown prevents multiple concurrent warmups

### 4. Mobile Device Testing
- Test on actual mobile device (not just devtools)
- **Focus**: Battery impact, timing consistency
- **Expected**: Same 10-15s warmup timing

### 5. Session Storage Edge Cases
- Clear browser storage mid-warmup
- **Expected**: Graceful degradation, no crashes
- **Monitor**: Error handling in console

## Testing Without Live Site Access

### Local Development Method
```bash
# Start local Shopify development
shopify theme serve

# Monitor in browser
# 1. Open DevTools
# 2. Navigate to pet processor page
# 3. Verify network requests
```

### File Inspection Method
```bash
# Verify code changes directly
grep -n "warmup" assets/pet-processor-v5-es5.js
grep -n "warmup" assets/pet-processor-unified.js

# Should show POST to /warmup, not GET to /health
```

### Test Image Upload
- Use small test image (< 1MB) 
- Monitor complete upload flow
- Time each phase: upload → processing → result

## Success Criteria

### ✅ Warming Working Correctly
- Network shows POST to `/warmup` taking 10-15s
- No `/health` requests visible
- Console shows successful warmup messages
- Subsequent uploads process in ~3s

### ✅ Session Management Working
- Max 1 warmup per browser session
- 15-minute global cooldown enforced
- 10-minute warm state maintained

### ✅ Performance Improved
- Cold start elimination (11s → 3s processing)
- Consistent fast processing after warmup
- No unexpected delays during upload

### ❌ Red Flags (Fix Failed)
- Still seeing `/health` requests
- Warmup completing in <5 seconds
- Upload still takes 11s after warmup
- Multiple warmup attempts in same session

## Performance Impact Measurement

### Before Fix (Expected Problems)
- `/health` returns immediately (~100ms)
- Upload still has 11s cold start
- Users abandon during unexpected delay
- ~30-40% conversion loss from poor experience

### After Fix (Expected Results)
- `/warmup` takes 10-15s but fully loads model
- Upload processes in ~3s consistently  
- Predictable fast experience
- ~15-25% conversion improvement

## API Endpoint Testing

### Direct API Test (Optional)
```bash
# Test warmup endpoint directly
curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/warmup

# Should take 10-15 seconds to respond
# Response should indicate model is loaded
```

### Health Check Comparison
```bash
# Compare with health endpoint
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Should respond immediately (~100ms)
# Does NOT load the model
```

## Critical Test Priority

### High Priority (Must Test)
1. ✅ Endpoint change verification (Network tab)
2. ✅ Timing verification (10-15s warmup)
3. ✅ Processing speed after warmup (~3s)
4. ✅ Session limit (max 1 per session)

### Medium Priority (Should Test)
1. Global cooldown (15-minute throttle)
2. Upload during warmup behavior
3. Mobile device consistency
4. Error handling edge cases

### Low Priority (Nice to Test)
1. Multiple tab race conditions
2. Network interruption recovery
3. Storage clearing edge cases
4. Direct API endpoint testing

## Expected Conversion Impact

### Technical Impact
- **Cold Start Elimination**: 30-40% of users who abandoned will complete
- **Processing Speed**: Consistent ~3s experience builds confidence
- **Predictable UX**: Users know what to expect

### Business Impact
- **Upload Completion Rate**: 68% → 78-83% (conservative estimate)
- **Revenue Impact**: Meaningful but not transformational
- **ROI**: Highest possible for 1-line code change

## Next Steps After Validation

If warming fix is confirmed working:
1. **Monitor Conversion Metrics**: Track upload completion rates
2. **Add UX Improvements**: Progress indicators for warming process
3. **A/B Testing**: Compare warmed vs non-warmed user cohorts
4. **Mobile Optimization**: Native progress patterns for 70% mobile traffic

**Key Success Metric**: Upload abandonment during processing should drop significantly once warmup is working properly.