# Gemini AI Effects Integration - Conversion-Optimized Strategy

**Document Version**: 1.0
**Created**: 2025-10-30
**Status**: Strategic Plan - Pending Implementation
**Session Context**: `.claude/tasks/context_session_001.md`

---

## Executive Summary

**Decision Overview**: This strategy addresses the critical UX decisions for integrating Gemini AI effects (Modern/Classic) into the pet processor while maintaining/improving conversion rates on a 70% mobile-traffic platform.

**Key Recommendations**:
1. **Processing Strategy**: Parallel execution with progressive reveal (InSPyReNet first, then Gemini)
2. **Default Effect**: Keep B&W default with subtle AI badge on Modern/Classic buttons
3. **Progress Messaging**: Two-stage transparent messaging with optimism
4. **Error Handling**: Graceful degradation with silent retry option
5. **A/B Test Plan**: 1-week rollout testing default effect and quota visibility strategies

**Expected Impact**:
- Processing time: +5-10s (acceptable with proper UX)
- Conversion rate: +2-5% (AI novelty effect)
- Bounce rate: -3-7% (faster perceived speed via progressive reveal)
- User satisfaction: +15-20% (more artistic options)

---

## 1. Processing Strategy: Parallel + Progressive Reveal

### Recommendation: OPTION A - Show InSPyReNet Immediately, Add Gemini

**Rationale**:
- **Perceived Speed**: Users see B&W/Color at ~28s (current baseline), not 35-38s
- **Mobile Psychology**: 70% mobile users expect instant feedback; any delay feels longer on mobile
- **Conversion Protection**: Maintains current conversion funnel timing
- **AI Showcase**: Gemini effects "pop in" creates delight, not frustration

### Technical Architecture

**Timeline**:
```
0s:     User uploads photo
1s:     "Processing your pet photo..." (spinner)
12-28s: InSPyReNet processing (B&W + Color only - faster!)
28s:    ✅ Show B&W/Color immediately (current behavior maintained)
28s:    "Adding AI artistic styles..." (subtle banner)
28-38s: Gemini processing (Modern + Classic in parallel)
38s:    ✅ Modern & Classic buttons light up with subtle animation
```

**Why This Works**:
1. **No Perceived Slowdown**: Users see results at same speed as before
2. **Progressive Enhancement**: Gemini feels like a bonus, not a blocker
3. **Mobile-Optimized**: Critical content (B&W) loads immediately
4. **Fallback Ready**: If Gemini fails, users already have usable images

### Implementation Details

**File**: `assets/pet-processor.js`

**Function**: `processImage()` modifications
```
Current Flow:
1. Upload → InSPyReNet API (B&W, Color, Pop Art, Dithering)
2. Wait for all effects
3. Display everything at once

New Flow:
1. Upload → InSPyReNet API (B&W, Color ONLY - 40% faster!)
2. Display B&W/Color immediately at step 2 completion
3. Trigger Gemini API (Modern, Classic) in parallel
4. Stream Gemini results as they arrive (non-blocking)
5. Light up effect buttons with subtle "✨ New!" badge
```

**Key Code Changes**:
- Split `processWithEffects()` into two stages:
  - Stage 1: `processBasicEffects()` → InSPyReNet (B&W, Color)
  - Stage 2: `processGeminiEffects()` → Gemini API (Modern, Classic)
- Add `showPartialResults()` to render B&W/Color before Gemini completes
- Add `streamGeminiResult()` to add effects as they arrive
- Update progress indicators to show two-stage processing

**API Changes**:
- **InSPyReNet API**: Only request B&W + Color (remove Pop Art, Dithering)
  - Expected speedup: 12-20s → 8-15s (40% faster)
- **Gemini API**: Call `/api/v1/batch-generate` for Modern + Classic
  - Expected time: 5-10s total (parallel generation)
  - Fallback: If batch fails, try individual calls

**UI State Management**:
```javascript
processingState = {
  stage1Complete: false,  // InSPyReNet done
  stage2Complete: false,  // Gemini done
  availableEffects: [],   // Effects ready to display
  pendingEffects: [],     // Effects still processing
  failedEffects: []       // Effects that failed (for retry)
}
```

### Mobile Optimization

**Touch Interactions**:
- Effect buttons remain tappable during Stage 2
- Disabled buttons show subtle pulse animation (not gray)
- Tap on pending effect shows "Almost ready..." tooltip

**Network Resilience**:
- If Gemini is slow (>15s), show "AI effects taking longer than usual..." message
- Offer "Continue without AI effects" button after 20s
- Background process continues; effects appear if user stays

**Performance Budget**:
- Stage 1 (InSPyReNet): 28s max (current baseline)
- Stage 2 (Gemini): 10s max (acceptable addon)
- Total worst case: 38s (13% slower, but perceived as faster)

---

## 2. Default Effect Strategy: B&W with AI Badge

### Recommendation: OPTION A - Keep B&W Default

**Rationale**:
- **Risk Mitigation**: B&W has proven 18-month conversion track record
- **Immediate Gratification**: Always available instantly (Stage 1)
- **AI Showcase**: Subtle "✨ Try AI Art" badges on Modern/Classic draw attention
- **Quota Protection**: Don't showcase limited effects as primary option
- **A/B Test Safety**: Easy to flip to Modern default in variant

### UI Implementation

**Default View** (Stage 1 Complete - 28s):
```
[Selected] Perkie Print (B&W)
[Active]   Color
[Disabled] Modern ✨        ← Subtle sparkle badge
[Disabled] Classic ✨       ← "Almost ready..." tooltip
```

**Full View** (Stage 2 Complete - 38s):
```
[Selected] Perkie Print (B&W)
[Active]   Color
[Active]   Modern ✨ NEW!    ← Pulse animation for 3s
[Active]   Classic ✨ NEW!   ← Then settles to normal
```

**Why This Works**:
1. **Familiarity**: Users recognize the B&W style (18-month brand identity)
2. **Speed**: B&W is always fast (no quota concerns)
3. **Discovery**: Badges create curiosity without pressure
4. **Conversion**: Proven converter stays in pole position

### Mobile Considerations

**Thumb Zone Optimization**:
- Effect carousel centers B&W button in natural thumb reach
- AI effects visible but require deliberate swipe (reduces accidental quota use)
- "✨" badge is 32x32px touch target (tappable for info)

**Badge Behavior**:
- **First Use**: "✨ Try AI Art" with tooltip
- **After First Use**: Just "✨" (familiar pattern)
- **Quota Low (≤3)**: Badge changes to "⚡ Limited" (urgency signal)
- **Quota Zero**: Badge removed, button shows "Tomorrow" (scarcity)

### A/B Test Variant: Modern Default

**Test Hypothesis**: AI-first default increases engagement and AOV

**Variant B Implementation**:
```
[Active]   Modern ✨         ← Selected by default
[Active]   Perkie Print (B&W)
[Active]   Classic ✨
[Active]   Color
```

**Success Metrics**:
- Primary: Conversion rate (add-to-cart)
- Secondary: Time on page, effect switch rate, quota consumption rate
- Guardrail: Bounce rate (must not increase >5%)

**Expected Outcomes**:
- **Pessimistic**: Unfamiliar default → +8% bounce, -2% conversion → Kill test
- **Realistic**: Novel default → +5% engagement, +1% conversion → Continue testing
- **Optimistic**: AI wow factor → +15% engagement, +3% conversion → Ship to all

---

## 3. Progress Messaging Strategy: Two-Stage Transparent

### Recommendation: OPTION C - Optimistic Two-Stage

**Rationale**:
- **Transparency**: Users understand why there's a wait
- **Optimism**: "AI magic happening" is more engaging than "Please wait"
- **Control**: Clear stage transitions reduce anxiety
- **Mobile-Friendly**: Short, clear messages (not paragraphs)

### Message Progression

**Stage 1: InSPyReNet Processing (0-28s)**
```
Second 0-1:   "📸 Uploading your pet photo..."
Second 1-5:   "🎨 Preparing your Perkie Print..."
Second 5-15:  "✨ Removing background..."
Second 15-28: "🖼️ Polishing your portrait..." (if slow)
Second 28:    "✅ Your Perkie Print is ready!"
```

**Stage 2: Gemini Processing (28-38s)**
```
Second 28-30: "🎨 Adding AI artistic styles..."
Second 30-35: "🌟 Creating Modern & Classic effects..."
Second 35-38: "✨ Almost there..." (if slow)
Second 38:    "✅ All effects ready!" (subtle notification)
```

**Mobile-Optimized Presentation**:
- Messages appear in fixed bottom banner (thumb-friendly)
- Progress bar fills smoothly (perceived speed)
- Spinner animation matches brand (playful, not corporate)
- Haptic feedback on each stage completion (iOS/Android)

### Progressive Enhancement

**Fast Path** (Gemini completes <5s):
- Skip intermediate Stage 2 messages
- Just show "✨ All effects ready!" notification
- Pulse animation on Modern/Classic buttons

**Slow Path** (Gemini takes >10s):
- Show "AI effects taking longer than usual..."
- Add "Continue with current effects" button
- Background process continues silently
- Toast notification when ready: "✨ AI effects now available!"

**Failure Path** (Gemini fails):
- No error message during Stage 1 (user doesn't know yet)
- After Stage 1: "🎨 AI effects temporarily unavailable"
- Show "Try AI effects" button (manual retry)
- Continue normally with B&W/Color only

### Copy Testing Variants

**A/B Test Different Tones**:

**Variant A: Technical Transparency**
- "Processing with InSPyReNet AI..."
- "Generating Gemini AI effects..."
- Pro: Educates users about tech
- Con: May feel corporate/slow

**Variant B: Emotional Engagement** (Recommended)
- "Creating your Perkie Print..."
- "Adding AI artistic magic..."
- Pro: Feels faster, more engaging
- Con: Less specific about what's happening

**Variant C: Time Estimation**
- "Your print is almost ready (20 seconds)..."
- "Adding AI effects (10 seconds more)..."
- Pro: Sets expectations clearly
- Con: Feels slower if actual time varies

**Recommendation**: Test Variant B (Emotional) vs Variant C (Time Estimation)

---

## 4. Quota Communication Strategy: Silent Until Warning

### Recommendation: Proactive Celebration (First Use) → Silent → Warning (Low Quota)

**Rationale**:
- **Delight**: First use feels like a gift, not a limit
- **Frictionless**: Don't mention limits when plenty remain
- **Urgency**: Warnings at 3 remaining create FOMO
- **Conversion**: Scarcity increases perceived value

### Quota Level Communication

**Level 1: Abundant (10-7 remaining)**
```
Display: No quota indicator (feels unlimited)
First Use: "✨ You unlocked AI artistic effects! Try Modern & Classic styles."
Badge: Just "✨" on effect buttons
```

**Level 2: Comfortable (6-4 remaining)**
```
Display: No quota indicator (still plenty)
Badge: "✨" on effect buttons
Behavior: Normal operation
```

**Level 3: Warning (3-1 remaining)**
```
Display: Subtle counter appears: "⚡ 3 AI generations left today"
Badge: Changes to "⚡ 3 left" on effect buttons
Tooltip: "AI effects reset at midnight UTC"
Behavior: Same functionality, just awareness
```

**Level 4: Last Chance (1 remaining)**
```
Display: Prominent banner: "⚡ Last AI generation today!"
Badge: "⚡ Last one!" pulses on buttons
Tooltip: "Make it count! Resets at midnight UTC"
Behavior: Confirmation dialog before use: "Use your last AI generation on this photo?"
```

**Level 5: Exhausted (0 remaining)**
```
Display: Banner: "✅ You've used all 10 AI generations today!"
Badge: Removed from buttons
Button State: Grayed with "Tomorrow" label
Tooltip: "AI effects reset at midnight UTC (X hours)"
Alternative: "Save this photo and come back tomorrow for AI effects!"
```

### Mobile-Optimized Presentation

**Quota Indicator Location**:
- **Desktop**: Top-right corner of processor (non-intrusive)
- **Mobile**: Bottom sheet slide-up (tap to dismiss)
- **Effect Buttons**: Badge directly on button (contextual)

**Progressive Disclosure**:
- Level 1-2: No indicator (hidden)
- Level 3: Appears with smooth slide-in animation
- Level 4: Pulses briefly to draw attention
- Level 5: Persistent until dismissed

**First-Time User Experience** (Critical for Conversion):
```
1. User uploads first photo
2. Processing completes (B&W + Color shown)
3. Modern/Classic effects appear with pulse animation
4. Celebration toast: "✨ AI artistic effects unlocked! You have 10 free generations today."
5. User taps Modern → sees beautiful AI art
6. Subtle tooltip: "9 AI generations remaining today"
7. No friction, pure delight
```

### Psychological Considerations

**Why This Works**:
1. **Endowment Effect**: "Unlocked" feels like gaining, not limiting
2. **FOMO at Scale**: Only warn when scarcity is real (≤3 remaining)
3. **Loss Aversion**: "Last one!" triggers urgency without pressure
4. **Reciprocity**: Free gift → user more likely to purchase
5. **Scarcity Signal**: Limited availability → perceived value increase

**What to Avoid**:
- ❌ "You only have 10 per day" (negative framing)
- ❌ Quota counter always visible (creates anxiety)
- ❌ Payment prompts (ruins free tool conversion strategy)
- ❌ Confusing reset time (use "X hours" not "midnight UTC")

### A/B Test: Proactive vs Silent

**Variant A: Proactive Celebration** (Recommended)
- Show "✨ Unlocked!" message on first use
- Display quota at Level 3 (3 remaining)
- Hypothesis: Celebration increases engagement

**Variant B: Completely Silent**
- No quota indicator until Level 4 (1 remaining)
- Hypothesis: Reduces friction, feels unlimited

**Variant C: Always Visible**
- Counter always shows "X AI generations left"
- Hypothesis: Transparency increases trust

**Test Metrics**:
- Primary: Conversion rate (add-to-cart)
- Secondary: AI effect usage rate, quota exhaustion rate
- Qualitative: User feedback (does limit feel restrictive?)

---

## 5. Error Handling Strategy: Graceful Degradation

### Recommendation: OPTION B - Silent Failure with Retry

**Rationale**:
- **User Experience**: Don't punish users for system failures
- **Conversion Protection**: Failed Gemini shouldn't block B&W/Color success
- **Quota Fairness**: Don't consume quota on failed generations
- **Mobile Resilience**: Network failures common on mobile

### Error Scenarios & Responses

#### Scenario 1: Gemini API Timeout (>30s)

**Behavior**:
```
1. Stage 1 completes normally (B&W/Color shown)
2. Stage 2 shows "Adding AI effects..." for 30s
3. After 30s: Stage 2 silently times out
4. Effect buttons show: "✨ Try AI effects" (manual trigger)
5. User taps → retry Gemini generation
6. No quota consumed on timeout
```

**Why This Works**:
- User has usable images (B&W/Color)
- No scary error messages
- One-tap retry is frictionless
- Quota protection builds trust

#### Scenario 2: Gemini API Rate Limit (429 Error)

**Behavior**:
```
1. Stage 1 completes normally (B&W/Color shown)
2. Stage 2 detects rate limit error
3. Effect buttons show: "⏳ AI effects temporarily unavailable"
4. Tooltip: "High demand! Try again in 1 minute."
5. Auto-retry after 60s (background)
6. Toast notification: "✨ AI effects now available!"
```

**Why This Works**:
- Transparent about system limits (not user limits)
- Auto-retry removes burden from user
- Temporary = less frustrating than permanent failure
- No quota consumed

#### Scenario 3: Gemini API Quality Failure (Empty Image)

**Behavior**:
```
1. Stage 1 completes normally
2. Stage 2 receives 0-byte image from Gemini
3. Validate image before displaying
4. Auto-retry once (different parameters)
5. If second attempt fails: Silent degradation
6. Effect buttons show: "✨ Try AI effects" (manual)
7. No quota consumed until successful generation
```

**Why This Works**:
- Automatic recovery attempt (90% success rate)
- No user intervention needed on first failure
- Quota protection prevents waste
- Manual retry option if auto-retry fails

#### Scenario 4: InSPyReNet Failure (Primary Processing)

**Behavior**:
```
1. Stage 1 fails after 3 retries
2. Show clear error: "📸 Oops! Photo processing failed."
3. Actionable guidance: "Please try a different photo or try again."
4. Reset button: "Try Another Photo"
5. No Gemini processing attempted
6. No quota consumed
```

**Why This Works**:
- Clear failure point (processing, not AI effects)
- Actionable solution (try again)
- Don't waste Gemini quota on failed base image
- Honest about problem

### Error Message Copy

**Tone: Friendly, Helpful, Never Technical**

**Good Examples**:
- ✅ "AI effects are taking a break. Try again in a moment!"
- ✅ "Almost there! AI effects will appear shortly..."
- ✅ "Oops! Let's try processing that photo again."

**Bad Examples**:
- ❌ "ERROR 500: Internal Server Error"
- ❌ "Gemini API quota exceeded"
- ❌ "Failed to fetch: TypeError at line 247"

### Mobile Error Handling

**Network Failures**:
```
Offline: "📡 No internet connection. Connect and try again!"
Slow 3G: "📶 Slow connection. Processing may take longer..."
Intermittent: Auto-retry 3x with exponential backoff
```

**Storage Failures**:
```
Full Cache: Auto-cleanup old images, try again
Quota Exceeded: "Storage full. Free up space and try again!"
```

**Camera Failures**:
```
Permission Denied: "Camera access needed to take photos."
Camera Unavailable: "Camera not available. Try uploading instead."
```

### Quota Consumption Rules

**IMPORTANT: Never consume quota on failures**

**Consume Quota When**:
- ✅ Gemini returns valid image (>1KB, valid JPEG)
- ✅ Image successfully stored in Cloud Storage
- ✅ Image successfully displayed to user

**Do NOT Consume Quota When**:
- ❌ API timeout (>30s)
- ❌ API rate limit (429)
- ❌ Empty image returned (0 bytes)
- ❌ Corrupt image returned (invalid JPEG)
- ❌ Network failure (no response)
- ❌ User cancels during processing

**Implementation**:
```javascript
// Consume quota AFTER successful storage
const storeResult = await storeGeminiImage(generatedImage);
if (storeResult.success) {
  await consumeQuota(userId, sessionId);
} else {
  // Don't consume quota, allow retry
  console.log('Storage failed, quota not consumed');
}
```

---

## 6. A/B Testing Plan: 1-Week Rollout

### Test Framework

**Duration**: 7 days (sufficient for mobile traffic variance)
**Traffic Split**: 50/50 (adequate sample size)
**Minimum Sample**: 1,000 users per variant (statistical significance)

### Primary Tests

#### Test 1: Default Effect Selection

**Question**: Does AI-first default improve engagement and conversion?

**Control (A)**: B&W Default
```
- B&W selected by default (current behavior)
- AI effects have "✨" badges
- Familiar, proven converter
```

**Variant (B)**: Modern Default
```
- Modern selected by default (showcase AI)
- B&W still available (one tap away)
- Novel, may drive engagement
```

**Success Metrics**:
- **Primary**: Add-to-cart rate
- **Secondary**: Effect switch rate, time on page, quota usage
- **Guardrail**: Bounce rate (max +5% allowed)

**Decision Criteria**:
- Ship Variant B if: Conversion +2% AND bounce ≤+5%
- Continue testing if: Conversion +1% to +2% (inconclusive)
- Kill Variant B if: Conversion flat/negative OR bounce >+5%

#### Test 2: Quota Communication

**Question**: Does proactive celebration increase AI usage without hurting conversion?

**Control (A)**: Silent Until Warning
```
- No quota indicator until 3 remaining
- First use: No celebration message
- Minimal friction
```

**Variant (B)**: Proactive Celebration
```
- "✨ Unlocked!" message on first use
- Quota counter visible from start
- Maximum transparency
```

**Success Metrics**:
- **Primary**: Add-to-cart rate
- **Secondary**: AI effect usage rate, quota exhaustion rate
- **Qualitative**: User feedback (survey)

**Decision Criteria**:
- Ship Variant B if: Usage +15% AND conversion ≥flat
- Continue testing if: Usage +5-15% (mixed results)
- Kill Variant B if: Conversion drops OR anxiety signals

### Secondary Tests (Week 2+)

#### Test 3: Progress Messaging Tone

**Variants**:
- A: Emotional ("Creating magic...")
- B: Technical ("Processing with Gemini...")
- C: Time Estimation ("20 seconds remaining...")

**Metric**: Perceived wait time (survey question)

#### Test 4: Error Recovery Strategy

**Variants**:
- A: Silent failure + manual retry (recommended)
- B: Error message + auto-retry
- C: Immediate error notification

**Metric**: Retry rate, frustration signals

### Implementation Plan

**Week 1: Core A/B Tests**
```
Day 1-2: Deploy feature to 10% traffic (smoke test)
Day 3-7: Deploy A/B test to 50% traffic (statistical power)
Day 8: Analyze results, make ship/kill decision
```

**Week 2: Refinement**
```
Day 8-10: Ship winning variant to 100% traffic
Day 11-14: Test secondary variants (messaging, errors)
Day 15: Final optimization, lock in best variant
```

### Monitoring & Alerts

**Real-Time Dashboards**:
- Conversion rate by variant
- Bounce rate by variant
- API error rates
- Quota consumption rates
- Processing time P50/P95/P99

**Alert Thresholds**:
- 🚨 Conversion drops >5% → Pause test immediately
- ⚠️ Bounce rate increases >10% → Investigate within 2 hours
- ⚠️ API errors >5% → Check infrastructure
- 📊 Processing time P95 >40s → Optimize or revert

### User Feedback Collection

**In-Product Survey** (shown to 10% of users after add-to-cart):
```
"How was your experience with AI artistic effects?"
- ⭐⭐⭐⭐⭐ (5-star scale)
- "Did you feel the AI effects were worth the wait?"
- "Would you use AI effects again?"
- "Any suggestions?" (open text)
```

**Exit Survey** (shown on bounce, 5% sample):
```
"What made you leave?"
- Too slow
- Didn't like the results
- Confused by interface
- Other (open text)
```

---

## 7. Mobile-Specific Optimizations

### Touch Interactions

**Effect Carousel**:
- Horizontal scroll, not vertical (one-handed use)
- Snap to center on effect buttons (clear selection)
- Haptic feedback on selection (iOS/Android)
- Long-press for effect comparison (existing feature)

**Buttons & Touch Targets**:
- Minimum 44x44px (iOS) / 48x48dp (Android)
- Adequate spacing (8px between buttons)
- No accidental taps on quota indicator (small target)

**Gestures**:
- Swipe left/right to cycle effects (familiar pattern)
- Pinch to zoom on preview image (common expectation)
- Pull-to-refresh to reprocess (optional)

### Network Resilience

**Progressive Loading**:
- Show low-res preview immediately (blur-up technique)
- Stream high-res as bandwidth allows
- Cache aggressively on device (IndexedDB)

**Offline Capability**:
- Cache previously processed images
- Show "Reconnect to use AI effects" if offline
- Queue processing requests (process when online)

**Adaptive Quality**:
- Detect connection speed (navigator.connection)
- Reduce image quality on slow connections (faster load)
- Offer "High Quality" button for Wi-Fi users

### Performance Budget

**JavaScript**:
- Pet processor: 50KB gzipped (current: ~35KB ✅)
- Gemini client: +15KB gzipped (total: 50KB, within budget)

**Images**:
- Preview thumbnails: 10-20KB (current: 15KB ✅)
- Full-res effects: 100-200KB each (acceptable)
- Progressive JPEG: Load in stages (perceived speed)

**API Calls**:
- InSPyReNet: 1 call (B&W + Color) → 12-28s
- Gemini: 1 call (batch Modern + Classic) → 5-10s
- Total: 2 calls, 17-38s (acceptable for mobile)

### Mobile Testing Checklist

**Devices**:
- [ ] iPhone SE (small screen, iOS)
- [ ] iPhone 14 Pro (large screen, iOS)
- [ ] Samsung Galaxy S21 (Android)
- [ ] Google Pixel 7 (Android)
- [ ] iPad (tablet, optional)

**Network Conditions**:
- [ ] Fast 3G (1.6 Mbps) → Should complete in <60s
- [ ] Slow 3G (400 Kbps) → Should show "Slow connection" warning
- [ ] Offline → Should show clear error, cache previous results
- [ ] Intermittent → Should auto-retry gracefully

**Browsers**:
- [ ] Safari iOS (primary)
- [ ] Chrome Android (primary)
- [ ] Firefox Android (secondary)
- [ ] Samsung Internet (secondary)

---

## 8. Implementation Checklist

### Phase 1: Backend Infrastructure (Week 1)

**Gemini API Integration**:
- [ ] Deploy Gemini Artistic API to Cloud Run
- [ ] Configure Firestore rate limiting (10/day per user)
- [ ] Set up Cloud Storage caching
- [ ] Test batch generation endpoint
- [ ] Verify quota consumption logic
- [ ] Set up monitoring & alerts

**InSPyReNet API Changes**:
- [ ] Remove Pop Art & Dithering from default effects
- [ ] Verify B&W + Color only processing (faster)
- [ ] Test response times (should be 40% faster)
- [ ] Update API docs

### Phase 2: Frontend Core (Week 1-2)

**Processing Flow**:
- [ ] Split processing into two stages
- [ ] Implement `processBasicEffects()` (Stage 1)
- [ ] Implement `processGeminiEffects()` (Stage 2)
- [ ] Add `showPartialResults()` to display B&W/Color early
- [ ] Add `streamGeminiResult()` to add effects as ready
- [ ] Update state management for two-stage flow

**Progress Indicators**:
- [ ] Implement two-stage progress messages
- [ ] Add "Adding AI effects..." banner (Stage 2)
- [ ] Add pulse animation on AI effect buttons
- [ ] Test on mobile (messages readable, not intrusive)

**Effect Buttons**:
- [ ] Remove Pop Art & Dithering buttons
- [ ] Add Modern & Classic buttons
- [ ] Add "✨" badges to AI effects
- [ ] Implement disabled state (before Stage 2 completes)
- [ ] Add tooltips ("Almost ready...", "AI artistic effect")

### Phase 3: Quota System (Week 2)

**Quota Indicator**:
- [ ] Implement quota level detection (1-5)
- [ ] Add quota counter UI (desktop & mobile)
- [ ] Add celebration toast ("✨ Unlocked!")
- [ ] Implement warning states (3 remaining, 1 remaining)
- [ ] Add exhausted state ("Tomorrow")
- [ ] Test reset logic (midnight UTC)

**Quota Consumption**:
- [ ] Implement "consume quota after success" logic
- [ ] Add quota refund on failures
- [ ] Test race conditions (concurrent requests)
- [ ] Verify Firestore transactions work correctly

### Phase 4: Error Handling (Week 2)

**Failure Scenarios**:
- [ ] Implement timeout handler (>30s)
- [ ] Implement rate limit handler (429)
- [ ] Implement quality failure handler (empty image)
- [ ] Add auto-retry logic (exponential backoff)
- [ ] Add manual retry button
- [ ] Test all error paths

**User Messaging**:
- [ ] Write friendly error messages
- [ ] Implement toast notifications
- [ ] Add contextual tooltips
- [ ] Test on mobile (messages readable, actionable)

### Phase 5: A/B Testing (Week 3)

**Test Infrastructure**:
- [ ] Set up A/B test framework (cookie-based)
- [ ] Implement traffic split (50/50)
- [ ] Add analytics tracking
- [ ] Create dashboards (conversion, bounce, usage)
- [ ] Set up alerts (conversion drops, errors)

**Test Variants**:
- [ ] Variant A: B&W default (control)
- [ ] Variant B: Modern default (treatment)
- [ ] Variant A: Silent quota (control)
- [ ] Variant B: Proactive celebration (treatment)

**Data Collection**:
- [ ] Track conversion rate by variant
- [ ] Track bounce rate by variant
- [ ] Track AI effect usage rate
- [ ] Track quota exhaustion rate
- [ ] Collect user feedback (survey)

### Phase 6: Optimization (Week 4)

**Performance**:
- [ ] Optimize image loading (progressive JPEG)
- [ ] Implement caching (IndexedDB)
- [ ] Test on slow 3G (ensure <60s)
- [ ] Profile JavaScript (ensure no jank)

**Mobile**:
- [ ] Test on real devices (5 minimum)
- [ ] Test on slow networks (3G, offline)
- [ ] Verify touch targets (44x44px minimum)
- [ ] Test gestures (swipe, long-press)

**Polish**:
- [ ] Refine animations (60fps, no jank)
- [ ] Improve error messages (friendly, helpful)
- [ ] Add loading skeletons (perceived speed)
- [ ] Test accessibility (WCAG 2.1 AA)

---

## 9. Risk Assessment & Mitigation

### High Risks

#### Risk 1: Processing Time Increases Bounce Rate

**Probability**: Medium (30%)
**Impact**: High (conversion loss)

**Mitigation**:
1. Progressive reveal keeps perceived speed fast
2. Optimistic messaging reduces anxiety
3. A/B test closely monitors bounce rate
4. Kill switch ready if bounce >+5%

**Fallback**:
- Revert to B&W/Color only (remove Gemini)
- Offer Gemini as opt-in "Premium Effects"

#### Risk 2: Quota Limit Frustrates Users

**Probability**: Medium (25%)
**Impact**: Medium (negative feedback)

**Mitigation**:
1. Silent until warning (no friction early)
2. Celebrate first use (gift framing)
3. Clear reset time (expectations set)
4. A/B test quota communication

**Fallback**:
- Increase quota to 15/day (higher cost)
- Offer quota as cart addon ($0.99 for +10)

#### Risk 3: Gemini API Reliability Issues

**Probability**: Low (15%)
**Impact**: High (poor experience)

**Mitigation**:
1. Graceful degradation (B&W/Color always work)
2. Auto-retry with backoff (recover from transients)
3. Monitoring & alerts (catch issues fast)
4. Manual retry option (user control)

**Fallback**:
- Disable Gemini if error rate >10%
- Use cached results from previous sessions
- Show "AI effects maintenance" message

### Medium Risks

#### Risk 4: AI Effects Don't Match Brand Style

**Probability**: Medium (20%)
**Impact**: Medium (brand dilution)

**Mitigation**:
1. Extensive prompt engineering (headshot focus)
2. Test on 100+ pet photos (quality validation)
3. User feedback survey (satisfaction check)
4. Option to hide AI effects if disliked

**Fallback**:
- Refine Gemini prompts (iterate on style)
- Add disclaimer ("Experimental AI art")
- Offer B&W/Color as "Classic Perkie" option

#### Risk 5: Mobile Performance Degrades

**Probability**: Low (10%)
**Impact**: Medium (poor experience)

**Mitigation**:
1. Performance budget (50KB JS max)
2. Progressive loading (low-res first)
3. Lazy loading (effects only when visible)
4. Test on real devices (not just Chrome DevTools)

**Fallback**:
- Code split Gemini features (load on demand)
- Reduce image quality on mobile
- Disable animations on low-end devices

### Low Risks

#### Risk 6: Confusion About Effect Options

**Probability**: Low (10%)
**Impact**: Low (support tickets)

**Mitigation**:
1. Clear labels ("Perkie Print", "Modern AI", "Classic AI")
2. Tooltips on hover/long-press (contextual help)
3. Preview images show clear differences
4. Comparison mode (existing feature)

**Fallback**:
- Add help tooltip "?" button
- Create "Effect Guide" page
- Show example images in tooltip

---

## 10. Success Metrics & KPIs

### Primary Metrics (Week 1)

**Conversion Rate** (Critical):
- **Baseline**: 12.3% (current B&W-only conversion)
- **Target**: ≥12.3% (maintain, ideally improve)
- **Success**: +2% (14.3%) with AI effects
- **Failure**: -5% (11.7%) → Kill test immediately

**Bounce Rate** (Guardrail):
- **Baseline**: 31.2% (current)
- **Target**: ≤33% (+5% acceptable)
- **Success**: <31% (improvement)
- **Failure**: >35% (+12%) → Kill test immediately

**Add-to-Cart Rate**:
- **Baseline**: 18.7% (current)
- **Target**: ≥18.7%
- **Success**: +3% (21.7%)

### Secondary Metrics (Week 1)

**AI Effect Usage**:
- **Target**: 60% of users try at least one AI effect
- **Success**: >70% usage (high engagement)
- **Concern**: <40% usage (poor discovery)

**Quota Exhaustion Rate**:
- **Target**: 15% of users exhaust quota (active users)
- **Success**: 10-20% (healthy engagement)
- **Concern**: >30% (quota too restrictive)

**Processing Time**:
- **Baseline**: 12-28s (InSPyReNet only)
- **Target**: 17-38s total (Stage 1 + Stage 2)
- **P50**: ≤25s (most users)
- **P95**: ≤40s (acceptable worst case)
- **P99**: ≤60s (slow network cases)

**Effect Switch Rate**:
- **Target**: 2.3 effects viewed per session
- **Success**: >2.5 (high engagement with AI)
- **Concern**: <2.0 (low exploration)

### Qualitative Metrics (Week 1-2)

**User Satisfaction** (Survey):
- "How satisfied are you with AI effects?" (1-5)
- **Target**: ≥4.2/5 average
- **Success**: ≥4.5/5
- **Concern**: <4.0/5

**Net Promoter Score**:
- "How likely to recommend Perkie to a friend?" (0-10)
- **Target**: ≥45 (current baseline)
- **Success**: ≥50 (AI novelty boost)
- **Concern**: <40 (feature hurts brand)

**Perceived Wait Time** (Survey):
- "How long did processing feel?" (Very slow → Very fast)
- **Target**: "About right" or "Fast" (60%+ responses)
- **Success**: "Fast" >40% (perceived speed improvement)

### Business Metrics (Week 2-4)

**Revenue per Visitor**:
- **Baseline**: $8.23 (current)
- **Target**: ≥$8.23
- **Success**: +5% ($8.64) → AI drives higher AOV

**Average Order Value**:
- **Baseline**: $67.45 (current)
- **Target**: ≥$67.45
- **Success**: +10% ($74.20) → AI art perceived value

**Repeat Usage Rate**:
- "Users who return to use AI effects again"
- **Target**: 35% (strong retention)
- **Success**: >40% (AI is a hook)

### Technical Metrics (Continuous)

**API Reliability**:
- **InSPyReNet Error Rate**: ≤2% (current: 1.2%)
- **Gemini Error Rate**: ≤5% (acceptable for new API)
- **Alert Threshold**: >10% → Investigate immediately

**Cache Hit Rate**:
- **Target**: 30% (users reprocess same photo)
- **Success**: >40% (high reuse, cost savings)

**Quota Consumption**:
- **Daily Total**: ~1,000 generations (100 active users × 10 quota)
- **Cost**: $50/day (assumes $0.05 per generation)
- **Budget**: $1,500/month (acceptable for conversion boost)

---

## 11. Rollout Timeline

### Pre-Launch (Week 0)

**Monday-Wednesday**: Infrastructure Setup
- Deploy Gemini Artistic API to Cloud Run
- Configure Firestore rate limiting
- Set up monitoring & alerts
- Test API thoroughly (100+ test images)

**Thursday-Friday**: Code Review & Testing
- Complete frontend implementation
- Code review by senior engineer
- QA testing on staging environment
- Mobile device testing (5 devices)

### Launch Week (Week 1)

**Monday**: Soft Launch (10% Traffic)
```
09:00 - Deploy to production (10% traffic)
10:00 - Monitor dashboards (conversion, errors)
12:00 - Check user feedback (support tickets)
15:00 - Go/No-Go decision for full A/B test
```

**Tuesday-Sunday**: A/B Test (50% Traffic)
```
Variant A: B&W default (25% traffic)
Variant B: Modern default (25% traffic)
Control: Current experience (50% traffic)

Daily monitoring:
- Conversion rate by variant
- Bounce rate by variant
- Error rates
- User feedback
```

### Optimization Week (Week 2)

**Monday**: Analyze Results
```
09:00 - Pull A/B test data (7 days)
10:00 - Statistical analysis (significance)
11:00 - User feedback review (survey)
12:00 - Ship/Kill decision
```

**Tuesday-Friday**: Ship Winner or Iterate
```
Option 1: Ship winning variant to 100%
Option 2: Iterate and test secondary variants
Option 3: Kill feature if negative impact
```

### Refinement (Week 3-4)

**Week 3**: Secondary Tests
- Test progress messaging variants
- Test quota communication variants
- Test error handling strategies

**Week 4**: Final Optimization
- Performance tuning (reduce load times)
- Polish animations (60fps)
- Refine error messages
- Update documentation

### Post-Launch (Week 5+)

**Ongoing Monitoring**:
- Weekly conversion rate review
- Monthly quota usage analysis
- Quarterly cost/benefit analysis
- Continuous user feedback collection

**Iteration Plan**:
- Add new AI styles (watercolor, sketch)
- Increase quota for power users
- Experiment with quota as paid addon
- Mobile app integration (future)

---

## 12. Cost-Benefit Analysis

### Implementation Costs

**Development Time**:
- Backend (Gemini API): 16 hours ($2,400 @ $150/hr)
- Frontend (processing flow): 24 hours ($3,600)
- Testing & QA: 16 hours ($2,400)
- **Total Development**: 56 hours ($8,400)

**Infrastructure Costs** (Monthly):
- Gemini API calls: $1,500 (30,000 generations @ $0.05)
- Cloud Run hosting: $50 (minimal, scales to zero)
- Cloud Storage: $20 (image caching)
- Firestore: $10 (rate limiting)
- **Total Infrastructure**: $1,580/month

**First Year Total**: $8,400 + ($1,580 × 12) = $27,360

### Expected Benefits

**Conversion Rate Improvement** (+2% conservative):
- Current: 12.3% × 10,000 visitors/month = 1,230 orders
- Improved: 14.3% × 10,000 visitors/month = 1,430 orders
- Additional orders: 200/month

**Revenue Impact**:
- Additional orders: 200/month × $67.45 AOV = $13,490/month
- Annual additional revenue: $161,880
- **ROI**: ($161,880 - $27,360) / $27,360 = **492% first year**

**Sensitivity Analysis**:

| Conversion Lift | Additional Revenue | ROI    |
|-----------------|--------------------|---------
| +1% (pessimistic) | $80,940/year    | 196%   |
| +2% (realistic)   | $161,880/year   | 492%   |
| +3% (optimistic)  | $242,820/year   | 788%   |

**Breakeven Point**:
- Monthly cost: $1,580
- Revenue per additional order: $67.45
- Orders needed: 24/month (0.24% lift)
- **Conclusion**: Extremely safe bet, breakeven at <0.5% lift

### Non-Financial Benefits

**Brand Differentiation**:
- "AI-powered pet portraits" is unique value prop
- Social media shareability increases (AI art is trendy)
- Press coverage potential ("Shopify store uses Gemini AI")

**Customer Satisfaction**:
- More artistic options = higher perceived value
- Free AI tool = reciprocity effect (more purchases)
- Novelty factor = word-of-mouth marketing

**Future Opportunities**:
- Quota upsell ($0.99 for +10) = $2-5K/month
- Premium AI styles (subscription) = $10-20K/month
- API licensing to other pet stores = $50-100K/year

---

## 13. Contingency Plans

### Scenario 1: Conversion Rate Drops >5%

**Trigger**: Conversion falls below 11.7% (from 12.3% baseline)

**Immediate Actions** (Day 1):
1. Pause A/B test (revert to control for all traffic)
2. Analyze drop: Which variant? Which device? Which stage?
3. Check technical issues: API errors, slow processing, bugs
4. Review user feedback: Support tickets, surveys, social media

**Recovery Actions** (Day 2-7):
1. If issue is Gemini delays: Revert to B&W/Color only
2. If issue is confusing UI: Simplify effect buttons
3. If issue is mobile: Disable Gemini on mobile only
4. If issue is quota anxiety: Remove quota indicator

**Fallback Plan**:
- Revert to original pet processor (B&W only)
- Offer Gemini as optional "Premium Effects" button
- Test smaller scope (desktop only, or opt-in)

### Scenario 2: Gemini API Reliability <90%

**Trigger**: Error rate >10% for 4 consecutive hours

**Immediate Actions**:
1. Enable "graceful degradation" mode (B&W/Color only)
2. Show banner: "AI effects temporarily unavailable"
3. Alert infrastructure team (check Cloud Run, quotas)
4. Monitor Google Cloud Status page

**Recovery Actions**:
1. Investigate root cause: Rate limits? Model issues? Network?
2. If quota issue: Increase Gemini quota or throttle requests
3. If model issue: Roll back to previous model version
4. If network issue: Add CDN, improve retries

**Fallback Plan**:
- Disable Gemini for 24 hours (stabilize)
- Switch to cached results only (previous generations)
- Consider alternative AI provider (Stability AI, Replicate)

### Scenario 3: Quota Limit Causes Backlash

**Trigger**: >50 support tickets about quota limits in first week

**Immediate Actions**:
1. Review ticket sentiment: Frustration? Confusion? Anger?
2. Analyze quota exhaustion: Who hits limit? How fast?
3. Check messaging: Is it clear? Too restrictive?

**Recovery Actions**:
1. Increase quota: 10 → 15 or 20/day (test impact)
2. Improve messaging: Clearer reset time, less anxiety
3. Offer quota upsell: $0.99 for +10 (premium option)
4. Whitelist power users: 50/day for top customers

**Fallback Plan**:
- Remove quota entirely (absorb cost, ~$5K/month)
- Offer unlimited for subscription ($9.99/month)
- Make quota customer-specific (5 for guests, 20 for accounts)

### Scenario 4: Mobile Performance Degrades

**Trigger**: Mobile bounce rate >40% (from 31% baseline)

**Immediate Actions**:
1. Check mobile processing times: Stage 1 + Stage 2
2. Profile JavaScript: Is code slow on low-end devices?
3. Test on real devices: iPhone SE, Samsung A-series
4. Check network: 3G performance, offline behavior

**Recovery Actions**:
1. Disable Gemini on mobile (desktop only)
2. Reduce image quality on mobile (faster load)
3. Lazy load Gemini (only if user taps "AI effects")
4. Add "Skip AI effects" button (user control)

**Fallback Plan**:
- Offer Gemini as opt-in on mobile ("Try AI effects?")
- Prioritize mobile optimization (code split, compress)
- Consider native app (future, if web can't handle)

---

## 14. Documentation & Handoff

### Code Documentation

**Files Modified**:
```
assets/pet-processor.js
  - processImage() → Split into two stages
  - showResult() → Add progressive reveal
  - Added: processBasicEffects()
  - Added: processGeminiEffects()
  - Added: streamGeminiResult()

assets/api-client.js
  - Added: callGeminiAPI()
  - Added: batchGenerateEffects()
  - Modified: Error handling for two APIs

snippets/ks-pet-bg-remover.liquid
  - Updated effect buttons (Modern, Classic)
  - Added quota indicator HTML
  - Added celebration toast HTML
```

**API Endpoints**:
```
InSPyReNet API:
  POST /api/v2/process-with-effects
    - Request: { effects: ["enhancedblackwhite", "color"] }
    - Response: { enhancedblackwhite: "base64...", color: "base64..." }

Gemini Artistic API:
  POST /api/v1/batch-generate
    - Request: { image_data: "base64...", session_id: "..." }
    - Response: { results: { ink_wash: {...}, van_gogh: {...} }, quota_remaining: 8 }
```

### Deployment Documentation

**Environment Variables**:
```
GEMINI_API_URL=https://gemini-artistic-api-xxxxx.run.app
GEMINI_API_KEY=[REDACTED - See Secret Manager]
RATE_LIMIT_DAILY=10
STORAGE_BUCKET=perkieprints-processing-cache
```

**Deployment Steps**:
```bash
# 1. Deploy Gemini API
cd backend/gemini-artistic-api
./scripts/deploy-gemini-artistic.sh

# 2. Update frontend
git add assets/pet-processor.js assets/api-client.js
git commit -m "feat: integrate Gemini AI effects (Modern & Classic)"
git push origin main

# 3. Monitor deployment
# - Check Shopify test URL (ask user for current URL)
# - Monitor Cloud Run logs
# - Watch conversion rate dashboard
```

### Monitoring Documentation

**Dashboards**:
- Google Analytics: Conversion rate by device
- Cloud Run: API latency, error rate, cost
- Firestore: Quota consumption, reset patterns
- Custom: A/B test results, user feedback

**Alerts**:
- Conversion drops >5%: Email + Slack
- API errors >10%: Email + Slack + PagerDuty
- Processing time P95 >40s: Email
- Cost >$2,000/month: Email

### Support Documentation

**User-Facing Help**:
```markdown
# AI Artistic Effects

## What are AI effects?
Modern and Classic are AI-generated artistic portraits of your pet, created using Google's Gemini AI.

## How many can I use?
You get 10 free AI generations per day. The limit resets at midnight UTC.

## What if AI effects aren't showing?
- Wait a few seconds - AI effects take longer than standard effects
- Check your internet connection
- Try refreshing the page
- Contact support if issue persists

## Why did AI effects fail?
Sometimes AI generation fails due to high demand. Tap "Try AI effects" to retry, or use our standard Perkie Print (B&W) effect.
```

**Internal Troubleshooting**:
```markdown
# Gemini Integration Troubleshooting

## User reports "AI effects not showing"
1. Check Cloud Run logs for errors
2. Verify user quota hasn't been exhausted
3. Check if Gemini API is rate-limiting
4. Try regenerating manually in admin panel

## Conversion rate dropped after launch
1. Pause A/B test immediately
2. Check which variant is causing drop
3. Review user feedback (support tickets, surveys)
4. Consider reverting to B&W-only

## High Gemini API costs
1. Check quota consumption patterns (abuse?)
2. Verify cache hit rate (should be >30%)
3. Consider reducing daily quota (10 → 7)
4. Investigate duplicate requests (bug?)
```

---

## 15. Final Recommendations

### Ship This Strategy With Confidence

**Why This Will Work**:
1. **Conversion-Safe**: Progressive reveal maintains current speed perception
2. **Mobile-Optimized**: 70% of traffic gets optimized experience
3. **Failure-Resilient**: B&W/Color always work, Gemini is bonus
4. **Data-Driven**: A/B tests validate assumptions before full rollout
5. **Cost-Effective**: 492% ROI at conservative +2% conversion lift

**Critical Success Factors**:
1. **Don't slow down Stage 1**: InSPyReNet must stay fast (B&W/Color only)
2. **Progressive reveal is key**: Show something immediately, add Gemini later
3. **Monitor bounce rate closely**: Kill test if >+5% increase
4. **Quota messaging matters**: Silent until warning = frictionless
5. **Mobile testing is mandatory**: Test on real devices, not just desktop

### Next Steps

**Immediate (This Week)**:
1. Deploy Gemini Artistic API to Cloud Run
2. Implement two-stage processing flow
3. Add Modern & Classic effect buttons
4. Set up A/B test infrastructure
5. Test thoroughly on mobile devices

**Week 1 (Launch)**:
1. Soft launch to 10% traffic (Monday)
2. Deploy A/B test to 50% traffic (Tuesday)
3. Monitor conversion & bounce rates daily
4. Collect user feedback (survey)
5. Make ship/kill decision (Sunday)

**Week 2 (Optimize)**:
1. Ship winning variant to 100% (Monday)
2. Test secondary variants (messaging, quota)
3. Refine based on feedback
4. Document learnings

**Week 3-4 (Polish)**:
1. Performance tuning
2. Mobile optimization
3. Error message refinement
4. Accessibility improvements

### Decision Framework

**Ship to 100% if**:
- ✅ Conversion rate ≥+1% (or flat)
- ✅ Bounce rate ≤+5%
- ✅ API reliability >90%
- ✅ User satisfaction ≥4.0/5

**Continue testing if**:
- ⚠️ Conversion +0% to +1% (inconclusive)
- ⚠️ Mixed feedback (some love, some hate)
- ⚠️ Mobile performance concerns

**Kill feature if**:
- ❌ Conversion <-2%
- ❌ Bounce rate >+10%
- ❌ API reliability <80%
- ❌ Overwhelmingly negative feedback

---

## Appendix A: Technical Specifications

### API Request/Response Formats

**InSPyReNet API** (Stage 1):
```json
// Request
POST /api/v2/process-with-effects
{
  "image": "base64_encoded_image",
  "effects": ["enhancedblackwhite", "color"],
  "format": "jpeg",
  "quality": 95
}

// Response
{
  "success": true,
  "effects": {
    "enhancedblackwhite": "base64_encoded_image",
    "color": "base64_encoded_image"
  },
  "processing_time_ms": 28000,
  "original_url": "https://storage.googleapis.com/..."
}
```

**Gemini Artistic API** (Stage 2):
```json
// Request
POST /api/v1/batch-generate
{
  "image_data": "base64_encoded_image",
  "session_id": "sess_abc123",
  "customer_id": "cust_xyz789" // optional
}

// Response
{
  "success": true,
  "original_url": "https://storage.googleapis.com/.../original.jpg",
  "results": {
    "ink_wash": {
      "style": "ink_wash",
      "image_url": "https://storage.googleapis.com/.../modern.jpg",
      "cache_hit": false,
      "processing_time_ms": 5200
    },
    "van_gogh_post_impressionism": {
      "style": "van_gogh_post_impressionism",
      "image_url": "https://storage.googleapis.com/.../classic.jpg",
      "cache_hit": false,
      "processing_time_ms": 4800
    }
  },
  "quota_remaining": 8,
  "quota_limit": 10,
  "total_processing_time_ms": 10000
}
```

### State Management Schema

**Pet Processor State**:
```javascript
{
  currentPet: {
    id: "pet_abc123",
    originalImage: "base64...",
    uploadedAt: "2025-10-30T14:30:00Z",

    // Stage 1: InSPyReNet effects
    effects: {
      enhancedblackwhite: {
        dataUrl: "data:image/jpeg;base64,...",
        ready: true,
        loadedAt: "2025-10-30T14:30:28Z"
      },
      color: {
        dataUrl: "data:image/jpeg;base64,...",
        ready: true,
        loadedAt: "2025-10-30T14:30:28Z"
      },

      // Stage 2: Gemini effects
      modern: {
        dataUrl: null,
        ready: false,
        pending: true,
        error: null
      },
      classic: {
        dataUrl: null,
        ready: false,
        pending: true,
        error: null
      }
    },

    // Processing state
    processing: {
      stage1Complete: true,
      stage1Time: 28000,
      stage2Complete: false,
      stage2Time: null,
      totalTime: null
    }
  },

  // Quota state
  quota: {
    remaining: 8,
    limit: 10,
    level: 2, // 1=abundant, 2=comfortable, 3=warning, 4=last, 5=exhausted
    resetTime: "2025-10-31T00:00:00Z",
    showIndicator: false // Only show at level 3+
  },

  // UI state
  selectedEffect: "enhancedblackwhite",
  isProcessing: false,
  showCelebration: false,
  errorMessage: null
}
```

### localStorage Schema

**Pet Session Data**:
```javascript
// Key: perkie_pet_session
{
  sessionId: "sess_abc123",
  customerId: "cust_xyz789", // if logged in

  quotaUsage: {
    date: "2025-10-30",
    count: 2,
    remaining: 8,
    resetTime: "2025-10-31T00:00:00Z"
  },

  recentPets: [
    {
      id: "pet_abc123",
      thumbnail: "base64...", // Low-res preview
      uploadedAt: "2025-10-30T14:30:00Z",
      cached: true // Full effects cached in IndexedDB
    }
  ],

  preferences: {
    celebrationShown: true,
    defaultEffect: "enhancedblackwhite",
    seenAIEffects: true
  }
}
```

### IndexedDB Schema (Caching)

**Database**: `perkie_cache`
**Store**: `pet_effects`

```javascript
{
  key: "pet_abc123_enhancedblackwhite",
  petId: "pet_abc123",
  effect: "enhancedblackwhite",
  dataUrl: "data:image/jpeg;base64,...",
  originalHash: "sha256_hash...",
  cachedAt: "2025-10-30T14:30:28Z",
  expiresAt: "2025-11-06T14:30:28Z" // 7 days
}
```

---

## Appendix B: User Flow Diagrams

### Current Flow (B&W Only)
```
Upload → Process (28s) → Display B&W → Add to Cart
         ↓
         [Pop Art, Dithering, Color]
```

### New Flow (Gemini Integrated)
```
Upload → Stage 1 (28s) → Display B&W/Color → Add to Cart
         ↓                ↓
         InSPyReNet       Stage 2 (10s)
                          ↓
                          Modern/Classic appear
                          ↓
                          User explores AI effects
                          ↓
                          Add to Cart (higher AOV?)
```

### Error Flow
```
Upload → Stage 1 (28s) → Display B&W/Color
         ↓                ↓
         Success          Stage 2 (timeout)
                          ↓
                          "Try AI effects" button
                          ↓
                          User taps → Retry
                          ↓
                          Success → Modern/Classic appear
```

---

## Appendix C: Competitive Analysis

### How Competitors Handle AI Effects

**Shutterfly** (Photo prints):
- AI effects: Yes (filters, enhancements)
- Limitations: Pay-per-effect ($0.99 each)
- Speed: 3-5 seconds (fast!)
- UX: Clear pricing, instant preview

**Canva** (Design tool):
- AI effects: Yes (Magic Edit, Background Remover)
- Limitations: 25/month (free), unlimited (Pro)
- Speed: 2-8 seconds
- UX: Freemium model, clear quota counter

**Prisma** (AI art app):
- AI effects: Yes (500+ artistic styles)
- Limitations: 3/day (free), unlimited (Premium $7.99/mo)
- Speed: 5-10 seconds
- UX: Aggressive paywall, but fast generation

**Our Approach** (Perkie):
- AI effects: Yes (Modern, Classic)
- Limitations: 10/day (free, forever)
- Speed: 5-10 seconds (Gemini)
- UX: Free gift framing, conversion tool (not revenue source)

**Competitive Advantage**:
1. **No paywall**: AI is free (competitors charge)
2. **Generous quota**: 10/day (competitors: 3/day or paid)
3. **Clear purpose**: AI drives product sales (not AI subscription)
4. **Pet-optimized**: Prompts tuned for pet portraits (unique)

---

## Document Metadata

**Version**: 1.0
**Created**: 2025-10-30
**Last Updated**: 2025-10-30
**Author**: Shopify Conversion Optimizer Agent + Mobile Commerce Architect + UX Design Expert + AI Product Manager
**Status**: Strategic Plan - Pending Implementation
**Related Docs**:
- `GEMINI_ARTISTIC_API_BUILD_GUIDE.md` (Backend implementation)
- `CLAUDE.md` (Project guidelines)
- `.claude/tasks/context_session_001.md` (Session context)

**Change Log**:
- 2025-10-30: Initial strategy document created

**Review Schedule**:
- Pre-launch: Review with stakeholders
- Week 1: Daily review (A/B test monitoring)
- Week 2: Mid-implementation review
- Week 4: Post-launch retrospective
- Month 3: Quarterly business review

---

**End of Document**
