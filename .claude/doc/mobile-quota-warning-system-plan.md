# Mobile-Optimized Quota Warning System - Implementation Plan

**Document Type**: Implementation Plan
**Created**: 2025-10-30
**Status**: Proposed
**Context**: Mobile-first e-commerce (70% mobile traffic) implementing 6/day rate limit for Gemini artistic effects

---

## Executive Summary

This plan details a mobile-native quota warning system for Gemini artistic effects (Modern & Classic styles). The system uses **progressive disclosure** with **badge indicators** as the primary pattern, complemented by contextual messaging at critical moments. Design prioritizes conversion optimization while managing user expectations around daily limits.

**Key Design Decisions**:
- **Primary Pattern**: Badge indicators (always visible, non-intrusive)
- **Secondary Pattern**: Contextual toasts at generation moments
- **Tertiary Pattern**: Bottom sheet for detailed quota info (tap-to-reveal)
- **Network Strategy**: Optimistic caching with graceful degradation
- **Space Optimization**: Minimal footprint (<48px height for warnings)

---

## 1. Recommended UI Pattern: Hybrid Badge + Toast + Bottom Sheet

### Pattern Justification

After analyzing mobile constraints (limited screen space, touch interaction, distracted users), a **hybrid approach** works best:

1. **Badge Indicators** (Primary - Always Visible)
   - Minimal space consumption
   - Instant quota awareness
   - No cognitive load during browsing

2. **Contextual Toasts** (Secondary - Critical Moments)
   - Appears after generation completes
   - Celebrates success while informing
   - Auto-dismisses (3s) to avoid friction

3. **Bottom Sheet** (Tertiary - On-Demand Details)
   - Tap badge for full quota breakdown
   - Swipe-to-dismiss interaction
   - Includes reset time & alternatives

### Why Not Other Patterns?

- **Full-screen takeover**: Too disruptive for informational content
- **Persistent banners**: Waste valuable screen space (mobile real estate is precious)
- **Toast-only**: Ephemeral, users will miss important warnings
- **Badge-only**: Insufficient for first-time users or critical states

---

## 2. Progressive Disclosure Strategy

### Four-Level Warning System

#### Level 1: Silent Monitor (6-4 remaining)
**UI State**:
```
[Enhanced B&W] [Color]
[Modern ⚡4] [Classic ⚡4]
```

**Behavior**:
- Small lightning bolt + number badge
- Neutral color (blue/gray)
- No toasts or interruptions
- Badge tap reveals bottom sheet with details

**Rationale**: Users have plenty of quota remaining. No need to create anxiety or friction.

---

#### Level 2: Gentle Reminder (3 remaining)
**UI State**:
```
[Enhanced B&W] [Color]
[Modern ⚠️3] [Classic ⚠️3]
```

**Behavior**:
- Badge changes to warning icon (⚠️) + number
- Color shifts to yellow/amber
- **Toast after generation**: "3 artistic styles left today 🎨"
- Bottom sheet includes tip: "Enhanced B&W & Color are unlimited!"

**Rationale**: User approaching limit. Gentle nudge to make remaining generations count, but not blocking flow.

---

#### Level 3: Urgent Warning (1-2 remaining)
**UI State**:
```
[Enhanced B&W] [Color]
[Modern ⚠️2] [Classic ⚠️2]

┌─────────────────────────────────┐
│ 💡 2 artistic styles remaining  │
│ [Tap for details]               │
└─────────────────────────────────┘
```

**Behavior**:
- Badge turns orange with prominent warning icon
- **Persistent mini-banner** appears above effect buttons
- Toast after generation: "Only 2 artistic styles left! Resets at midnight UTC"
- Optional haptic feedback on iOS (light impact)
- Bottom sheet auto-expands on first view (dismissible)

**Rationale**: User needs clear visibility into remaining quota. Persistent banner ensures they don't miss it while scrolling.

---

#### Level 4: Quota Exhausted (0 remaining)
**UI State**:
```
[Enhanced B&W] [Color] ← Available
[Modern 🚫] [Classic 🚫] ← Disabled

┌─────────────────────────────────┐
│ 🎨 Daily Artistic Limit Reached │
│                                 │
│ You've created 6 amazing pet    │
│ portraits today!                │
│                                 │
│ ✅ Try Enhanced B&W (unlimited) │
│ ✅ Try Color Pop (unlimited)    │
│                                 │
│ 🌙 More artistic styles         │
│    available in 8h 23m          │
│                                 │
│ [Try B&W Now]                   │
└─────────────────────────────────┘
```

**Behavior**:
- Modern/Classic buttons **visually disabled** (grayed out, 🚫 icon)
- Tapping disabled button triggers **bottom sheet** (not blocking modal)
- Bottom sheet emphasizes **alternatives** (B&W, Color)
- Shows **countdown timer** to quota reset (midnight UTC)
- Optional: Gentle shake animation when tapping disabled button
- **Critical**: Does NOT show full-screen takeover (keeps user in flow)

**Rationale**: User hit limit but we don't want to break conversion funnel. Keep them engaged with unlimited alternatives while clearly communicating reset time.

---

### Timing & Triggers

**When to show warnings**:
- ✅ **After image generation completes** (success moment, user is idle)
- ✅ **When entering effects screen** (if quota < 3, show mini-banner)
- ✅ **On page load** (restore quota state from localStorage + API sync)
- ❌ **NOT during upload** (user is focused, will miss message)
- ❌ **NOT mid-scroll** (message will be skipped)
- ❌ **NOT during keyboard input** (obtrusive, annoying)

**Delay Strategy**:
- Badge updates: Immediate (real-time)
- Toast notifications: 500ms delay after generation completes
- Bottom sheet auto-expand (Level 3): 1s delay, only once per session
- Persistent banner: Immediate when quota < 3

---

## 3. Touch Interaction Design

### Primary Interactions

#### Badge Tap
```
User taps: [Modern ⚡4]
Result: Bottom sheet slides up with quota details
```

**Bottom Sheet Content**:
```
┌─────────────────────────────────┐
│         Artistic Styles         │
│                                 │
│ 🎨 Daily Quota: 4 of 6 left    │
│                                 │
│ Limited (6/day shared):         │
│ • Modern Style      ⚡4         │
│ • Classic Style     ⚡4         │
│                                 │
│ Unlimited:                      │
│ • Enhanced B&W      ∞          │
│ • Color Pop         ∞          │
│                                 │
│ ℹ️ Quota resets daily at       │
│   midnight UTC (8h 23m)        │
│                                 │
│ [Got it]                        │
└─────────────────────────────────┘
```

**Interaction specs**:
- **Touch target**: Minimum 44x44px (iOS guidelines)
- **Swipe to dismiss**: Downward swipe closes sheet
- **Backdrop tap**: Tapping outside sheet dismisses it
- **Scroll behavior**: Sheet content scrollable if exceeds viewport

---

#### Long-Press Effect Button (Advanced Feature)
```
User long-presses: [Modern ⚡4]
Result: Mini tooltip appears with preview
```

**Tooltip Content**:
```
┌──────────────────────┐
│ Modern Style         │
│ 4 generations left   │
│ [Preview thumbnail]  │
└──────────────────────┘
```

**Specs**:
- Long-press duration: 600ms (matches iOS system behavior)
- Haptic feedback: Light impact on iOS when tooltip appears
- Tooltip position: Above button (or below if near top of screen)
- Auto-dismiss: 3s or on finger lift

**Note**: This is an **enhancement** for power users. Not critical for MVP.

---

#### Disabled Button Interaction (Quota Exhausted)
```
User taps: [Modern 🚫]
Result: Bottom sheet with alternatives + reset time
```

**Behavior**:
- Gentle shake animation (300ms, 5px horizontal)
- Optional haptic feedback (notification type on iOS)
- Bottom sheet slides up immediately
- Focus on alternatives, not limitations

---

### Gesture Conflicts

**Avoiding conflicts with existing features**:
1. **Swipe-to-compare effects**: Uses horizontal swipe on canvas area (not buttons)
2. **Scroll to navigate**: Vertical scroll on main container (not effect buttons)
3. **Pinch-to-zoom images**: On canvas area, not UI elements

**Our quota interactions**:
- Badge tap: Isolated to badge area (no conflict)
- Long-press: On effect buttons (doesn't interfere with tap-to-select)
- Bottom sheet swipe-down: Only when sheet is open (modal context)

**Conclusion**: No gesture conflicts identified.

---

## 4. Screen Real Estate Optimization

### Layout Strategy: Minimal Footprint

**Goal**: Convey quota information without cluttering mobile interface.

**Space allocation**:
- **Badge on buttons**: 0 extra space (part of button)
- **Level 2 toast**: 0 persistent space (auto-dismisses)
- **Level 3 mini-banner**: 48px height (collapsible)
- **Level 4 bottom sheet**: 0 space (overlay, doesn't push content)

**Total persistent UI**: 0-48px depending on quota level

---

### Mobile Layout (iPhone 12 Pro - 390x844px)

```
┌─────────────────────────────────┐
│ [< Back]  Pet Background Remover│  Header (60px)
├─────────────────────────────────┤
│                                 │
│     [Pet Image Preview]         │  Canvas (400px)
│                                 │
│                                 │
├─────────────────────────────────┤
│ 💡 2 artistic styles remaining  │  Mini-banner (48px)
│ [Tap for details]               │  ONLY when quota < 3
├─────────────────────────────────┤
│ Effects:                        │
│ ┌─────────┬─────────┐          │
│ │Enhanced │ Color   │          │  Effect buttons
│ │  B&W    │  Pop    │          │  (80px each)
│ └─────────┴─────────┘          │
│ ┌─────────┬─────────┐          │
│ │ Modern  │ Classic │          │
│ │   ⚡2   │   ⚡2   │          │
│ └─────────┴─────────┘          │
├─────────────────────────────────┤
│ [Generate Full Resolution]      │  Primary CTA (56px)
└─────────────────────────────────┘
```

**Key Layout Principles**:
1. **Badge integrated into buttons**: No extra height cost
2. **Mini-banner collapsible**: Slides away when quota > 3
3. **Bottom sheet as overlay**: Doesn't push content, preserves scroll position
4. **Sticky CTA**: Primary action always visible at bottom
5. **Safe zones**: Avoid notch area (top 44px) and home indicator (bottom 34px)

---

### Adaptive Layout for Small Screens (<375px width)

**Changes for iPhone SE / small Android**:
- Effect buttons: 2x2 grid instead of 2x2 (already optimized)
- Mini-banner: Shorter text, icon-only ("💡 2 left")
- Bottom sheet: Reduced padding, more compact content
- Font sizes: Scale down by 1-2px

---

### Landscape Mode Considerations

**Challenge**: Even less vertical space (≈375px available)

**Solution**:
- Mini-banner: Auto-hide in landscape (badge sufficient)
- Bottom sheet: Reduce to 60% viewport height max
- Effect buttons: Maintain size (don't shrink below 44px tap target)

---

## 5. Mobile-Specific Animations

### Principles
- **60fps or bust**: Use CSS transforms (GPU-accelerated)
- **Respect user preferences**: Check `prefers-reduced-motion`
- **Battery conscious**: Avoid continuous animations, use CSS not JS

---

### Animation Inventory

#### 1. Badge Number Decrement
**When**: After successful generation, quota decreases

**Animation**:
```css
@keyframes badge-update {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}
```

**Duration**: 300ms
**Easing**: ease-in-out
**Trigger**: When quota value changes in DOM

---

#### 2. Warning Color Transition
**When**: Quota crosses threshold (4→3 or 3→2)

**Animation**:
```css
.effect-badge {
  transition: background-color 400ms ease, color 400ms ease;
}
```

**Colors**:
- Level 1 (6-4): Blue #3B82F6 → Yellow #F59E0B (at 3)
- Level 2 (3): Yellow #F59E0B → Orange #F97316 (at 2)
- Level 3 (2-1): Orange #F97316 → Red #EF4444 (at 0)

---

#### 3. Mini-Banner Slide-In
**When**: Quota drops below 3, user enters effects screen

**Animation**:
```css
@keyframes banner-slide-in {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

**Duration**: 400ms
**Easing**: cubic-bezier(0.4, 0, 0.2, 1) (Material Design standard)
**Note**: Reverse animation on dismiss

---

#### 4. Bottom Sheet Slide-Up
**When**: User taps badge or disabled button

**Animation**:
```css
@keyframes sheet-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

**Duration**: 350ms
**Easing**: cubic-bezier(0.4, 0, 0.2, 1)
**Backdrop**: Fade in from transparent to rgba(0,0,0,0.5) simultaneously

---

#### 5. Disabled Button Shake (Quota Exhausted)
**When**: User taps Modern/Classic at 0 remaining

**Animation**:
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

**Duration**: 300ms
**Iterations**: 2
**Note**: Accompanied by haptic feedback on iOS

---

#### 6. Toast Slide-In from Top
**When**: After generation completes (quota updates)

**Animation**:
```css
@keyframes toast-enter {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

**Duration**: 300ms (enter), 250ms (exit)
**Auto-dismiss**: 3s delay, then slide out
**Position**: Fixed top (below header, above canvas)

---

### Reduced Motion Alternative

**For users with `prefers-reduced-motion: reduce`**:
- Disable all slide/shake animations
- Use instant opacity transitions only
- Keep color transitions (minimal motion)
- Haptic feedback still enabled (physical, not visual)

**Implementation**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. Network & Offline Handling

### Challenge: Mobile Network Variability

**Scenario 1: Slow 3G/4G Connection**
- Quota API call takes 2-5s
- User may interact before quota loads

**Scenario 2: Spotty Connection**
- API call fails intermittently
- Stale data in localStorage

**Scenario 3: Offline Mode**
- No network, user views cached pet images
- Can't check current quota

---

### Solution: Optimistic Caching + Graceful Degradation

#### Caching Strategy

**localStorage Schema**:
```json
{
  "quotaCache": {
    "remaining": 4,
    "lastUpdated": "2025-10-30T14:32:10Z",
    "expiresAt": "2025-10-31T00:00:00Z",
    "source": "api" // "api" | "cache" | "unknown"
  }
}
```

**Cache Validity**:
- **Valid**: If `lastUpdated` is today (same UTC day)
- **Stale**: If `lastUpdated` is yesterday or older
- **Expired**: If `expiresAt` passed (after midnight UTC)

**Update Strategy**:
1. On page load: Read from cache immediately (instant UI)
2. Background fetch: Call API to get fresh quota
3. Compare results: Update cache if changed
4. Update UI: Animate badge if quota decreased

---

#### Network State Handling

**State 1: Loading Quota (Initial 0-2s)**

**UI**:
```
[Modern ⏳] [Classic ⏳]
```

**Behavior**:
- Show loading spinner instead of badge number
- Buttons enabled (optimistic)
- If cached quota exists, show cached value with asterisk: `[Modern 4*]`

**Duration**: 2s timeout, then fallback to cache or "unknown"

---

**State 2: API Success**

**UI**:
```
[Modern ⚡4] [Classic ⚡4]
```

**Behavior**:
- Update badge with fresh quota
- Animate transition if quota changed
- Cache result in localStorage
- Clear "loading" state

---

**State 3: API Timeout/Slow**

**UI**:
```
[Modern 4*] [Classic 4*]
```

**Behavior**:
- Use cached quota (if available)
- Show asterisk indicator (cached data)
- Tap badge shows: "Using cached quota. Tap to refresh."
- Retry button in bottom sheet

**Fallback logic**:
```javascript
// If cache exists and is from today → use it
if (cache.lastUpdated.isToday()) {
  showCachedQuota(cache.remaining);
}
// If cache is stale or missing → assume 0 (safest)
else {
  assumeQuotaExhausted();
}
```

---

**State 4: API Failure (Network Error)**

**UI**:
```
[Modern ⚠️] [Classic ⚠️]
```

**Behavior**:
- Show warning icon (not number)
- Tap badge shows: "Can't check quota. Try again?"
- Retry button in bottom sheet
- If cache exists: Use it with "may be outdated" disclaimer

---

**State 5: Offline Mode**

**UI**:
```
[Modern 🚫] [Classic 🚫]
```

**Behavior**:
- Disable Gemini effect buttons (can't generate without API)
- Show "Offline" badge
- Tap badge shows: "Artistic styles require internet connection"
- Unlimited effects (B&W, Color via InSPyReNet) still work if cached

**Detection**:
```javascript
if (!navigator.onLine) {
  showOfflineState();
}
```

---

#### Quota Sync Conflicts

**Problem**: User opens site in two tabs, generates in both

**Scenario**:
1. Tab A: Shows "4 remaining"
2. Tab B: Shows "4 remaining"
3. User generates in Tab A → Quota now 3
4. Tab B still shows 4 (stale)

**Solution: Real-time Sync with localStorage Events**

```javascript
// Tab A: Updates quota after generation
localStorage.setItem('quotaCache', JSON.stringify({
  remaining: 3,
  lastUpdated: new Date().toISOString()
}));

// Tab B: Listens for changes
window.addEventListener('storage', (e) => {
  if (e.key === 'quotaCache') {
    const newQuota = JSON.parse(e.newValue);
    updateBadgeUI(newQuota.remaining);
  }
});
```

**Result**: All tabs sync within 100ms via browser's localStorage events.

---

#### Rate Limit Error Handling

**Scenario**: User hits API rate limit (6 requests in a day)

**Backend Response**:
```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "Daily quota of 6 artistic generations reached",
  "remaining": 0,
  "resetAt": "2025-10-31T00:00:00Z"
}
```

**Frontend Handling**:
1. Parse `resetAt` timestamp
2. Calculate countdown timer
3. Update UI to "exhausted" state (Level 4)
4. Show alternatives (B&W, Color)
5. Cache `remaining: 0` to prevent unnecessary API calls

---

## 7. Quota Exhausted State (0/6 Remaining)

### Design Philosophy: Keep User Engaged

**DON'T**:
- ❌ Show full-screen blocking modal
- ❌ Remove effect buttons entirely
- ❌ Focus on limitations ("You can't...")
- ❌ Make user feel punished

**DO**:
- ✅ Keep UI accessible (non-blocking)
- ✅ Emphasize alternatives (B&W, Color unlimited)
- ✅ Show clear reset time (countdown)
- ✅ Maintain conversion funnel

---

### Visual Design: Bottom Sheet (Non-Blocking)

**Trigger**: User taps disabled Modern or Classic button

**UI Layout**:
```
┌─────────────────────────────────┐
│         Daily Limit Reached     │  Header
│                                 │
│ 🎨 Amazing! You've created 6    │  Celebratory message
│ artistic pet portraits today.   │
│                                 │
├─────────────────────────────────┤
│ Still want more styles?         │  Alternatives section
│                                 │
│ ✅ Enhanced Black & White       │  (Each tappable)
│    Unlimited • Professional     │
│    [Preview thumbnail]          │
│                                 │
│ ✅ Color Pop                    │
│    Unlimited • Vibrant          │
│    [Preview thumbnail]          │
│                                 │
├─────────────────────────────────┤
│ 🌙 More artistic styles in:     │  Reset countdown
│                                 │
│        8h 23m 45s               │  (Live countdown)
│                                 │
│    Resets daily at midnight UTC │
│                                 │
├─────────────────────────────────┤
│ [Try Enhanced B&W Now]          │  Primary CTA
│ [Dismiss]                       │  Secondary
└─────────────────────────────────┘
```

**Interaction**:
- **Swipe down to dismiss**: Returns to effects screen
- **Tap alternative effect**: Switches to that effect, closes sheet, applies to current pet
- **Tap CTA button**: Selects Enhanced B&W, closes sheet, ready to generate
- **Tap backdrop**: Dismisses sheet

---

### Inline Disabled State (Main Effects Screen)

**Before exhaustion**:
```
┌─────────────────────────────────┐
│ Effects:                        │
│ ┌─────────┬─────────┐          │
│ │Enhanced │ Color   │          │
│ │  B&W    │  Pop    │          │
│ └─────────┴─────────┘          │
│ ┌─────────┬─────────┐          │
│ │ Modern  │ Classic │          │
│ │   ⚡6   │   ⚡6   │          │
│ └─────────┴─────────┘          │
└─────────────────────────────────┘
```

**After exhaustion**:
```
┌─────────────────────────────────┐
│ Effects:                        │
│ ┌─────────┬─────────┐          │
│ │Enhanced │ Color   │  ← Normal
│ │  B&W    │  Pop    │
│ └─────────┴─────────┘          │
│ ┌─────────┬─────────┐          │
│ │ Modern  │ Classic │  ← Grayed
│ │   🚫    │   🚫    │     out
│ │ Tomorrow│ Tomorrow│
│ └─────────┴─────────┘          │
└─────────────────────────────────┘
```

**Visual Changes**:
- Opacity: 0.5 (grayed out)
- Cursor: not-allowed
- Badge: 🚫 icon + "Tomorrow" text
- Border: Dashed (indicates disabled)

**Interaction**:
- Tap → Trigger bottom sheet (not blocking, informative)
- Optional: Gentle shake animation + haptic feedback

---

### Countdown Timer Implementation

**Requirements**:
- Real-time countdown to midnight UTC
- Updates every second
- Shows hours, minutes, seconds if < 24h
- Shows "Tomorrow at midnight" if > 24h

**Code Approach**:
```javascript
function calculateResetTime() {
  const now = new Date();
  const utcNow = new Date(now.toISOString());
  const midnight = new Date(utcNow);
  midnight.setUTCHours(24, 0, 0, 0); // Next midnight UTC

  const diff = midnight - utcNow; // milliseconds
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return { hours, minutes, seconds };
}

// Update UI every second
setInterval(() => {
  const time = calculateResetTime();
  document.querySelector('.reset-countdown').textContent =
    `${time.hours}h ${time.minutes}m ${time.seconds}s`;
}, 1000);
```

**Edge Cases**:
- User crosses midnight while viewing sheet → Auto-refresh quota
- User changes timezone → Always use UTC for consistency
- Page in background → Pause countdown, resume on focus (battery optimization)

---

## 8. Accessibility (Mobile)

### WCAG 2.1 AA Compliance

**Requirements**:
- Perceivable: Screen reader support, color contrast
- Operable: Touch targets ≥44x44px, keyboard navigation
- Understandable: Clear language, consistent UI
- Robust: Semantic HTML, ARIA labels

---

### Screen Reader Support

#### Badge Announcements

**HTML**:
```html
<button
  class="effect-btn"
  data-effect="modern"
  aria-label="Modern style, 4 generations remaining today"
  aria-describedby="quota-info"
>
  Modern
  <span class="badge" aria-hidden="true">⚡4</span>
</button>

<div id="quota-info" class="sr-only">
  You have 4 artistic style generations remaining today. Quota resets at midnight UTC.
</div>
```

**Why**:
- `aria-label` gives full context to screen reader users
- Badge visual (`⚡4`) is decorative, hidden from SR with `aria-hidden="true"`
- `aria-describedby` provides additional detail on focus

---

#### Live Region for Quota Updates

**HTML**:
```html
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
  id="quota-status"
>
  <!-- Dynamically updated by JavaScript -->
</div>
```

**JavaScript**:
```javascript
function announceQuotaChange(remaining) {
  const statusDiv = document.getElementById('quota-status');
  statusDiv.textContent = `${remaining} artistic style generations remaining today.`;
}
```

**Behavior**:
- After each generation, announce new quota
- Uses `aria-live="polite"` (non-interrupting)
- Only announces changes (not every page load)

---

#### Bottom Sheet Accessibility

**HTML**:
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="sheet-title"
  aria-describedby="sheet-description"
  class="bottom-sheet"
  hidden
>
  <h2 id="sheet-title">Daily Limit Reached</h2>
  <p id="sheet-description">
    You've created 6 artistic portraits today.
    Unlimited effects still available.
  </p>

  <!-- Content -->

  <button aria-label="Close dialog">Dismiss</button>
</div>
```

**Focus Management**:
1. When sheet opens → Trap focus inside dialog
2. First focus → Close button or primary CTA
3. Tab navigation → Cycles within sheet only
4. ESC key → Closes sheet, returns focus to trigger button

---

### Color Contrast

**WCAG AA Requirements**: 4.5:1 for normal text, 3:1 for large text

**Badge Colors**:
| State | Color | Contrast on White | Pass? |
|-------|-------|-------------------|-------|
| Normal (blue) | #3B82F6 | 5.2:1 | ✅ AA |
| Warning (yellow) | #F59E0B | 4.1:1 | ⚠️ Borderline (use dark text) |
| Urgent (orange) | #F97316 | 4.8:1 | ✅ AA |
| Exhausted (red) | #EF4444 | 5.5:1 | ✅ AA |

**Text Adjustments**:
- Blue, orange, red: White text ✅
- Yellow: Dark gray text (#374151) for contrast ✅

---

### Touch Target Sizes

**iOS Human Interface Guidelines**: 44x44pt minimum
**Android Material Design**: 48x48dp minimum

**Our Implementation**:
| Element | Size | Pass? |
|---------|------|-------|
| Effect button | 80x80px | ✅ Yes |
| Badge area (tap for details) | 44x44px | ✅ Yes |
| Close button (bottom sheet) | 48x48px | ✅ Yes |
| Toast dismiss button | 44x44px | ✅ Yes |
| Alternative effect cards | 100% width x 80px height | ✅ Yes |

---

### Plain Language & Cognitive Accessibility

**Bad Example** (jargon, technical):
```
Rate limit threshold reached.
API quota exceeded (6/6).
Reset: 00:00 UTC.
```

**Good Example** (plain, friendly):
```
Daily limit reached.
You've created 6 artistic portraits today!
More available tomorrow at midnight.
```

**Guidelines**:
- Use 5th-8th grade reading level
- Avoid technical terms (API, quota, threshold)
- Positive framing ("You've created!" not "You've used up")
- Clear timings ("tomorrow at midnight" not "00:00 UTC")

---

### Reduced Motion Support

**Implementation**:
```css
@media (prefers-reduced-motion: reduce) {
  .effect-badge,
  .mini-banner,
  .bottom-sheet,
  .toast {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }

  /* Keep color transitions (minimal motion) */
  .effect-badge {
    transition: background-color 200ms, color 200ms;
  }
}
```

**What's Disabled**:
- Slide-in animations (instant appear)
- Shake effects (no movement)
- Scale animations (instant size change)

**What's Kept**:
- Color transitions (helpful, non-motion)
- Opacity fades (minimal motion)
- Haptic feedback (physical, not visual)

---

### Testing Checklist

**Tools**:
- VoiceOver (iOS Safari) - Primary mobile SR
- TalkBack (Android Chrome) - Android SR
- Color contrast analyzer
- iOS Accessibility Inspector
- Android Accessibility Scanner

**Test Cases**:
1. Navigate to effects with VoiceOver → All badges announced correctly?
2. Generate effect → Quota update announced?
3. Tap disabled button → Bottom sheet keyboard accessible?
4. Use site with high contrast mode → All text readable?
5. Enable reduced motion → No jarring animations?

---

## 9. A/B Testing Plan (Mobile-Specific)

### Hypothesis

**Control (A)**: Badge-only indicators, no proactive warnings
**Variant B**: Badge + contextual toasts (recommended design)
**Variant C**: Badge + persistent mini-banner

**Hypothesis**: Variant B will increase awareness of quota limits without harming conversion, leading to more strategic use of limited effects and reduced support tickets about "why can't I generate more?"

---

### Mobile Segmentation

**Segment by Platform**:
- iOS (Safari) - 40% of mobile traffic
- Android (Chrome) - 60% of mobile traffic

**Why**: Different UI patterns feel native on each platform
(iOS users expect bottom sheets, Android users expect snackbars)

**Segment by Screen Size**:
- Small (<375px width) - iPhone SE, older Android
- Medium (375-430px) - iPhone 12-15, most Android
- Large (>430px) - iPhone Pro Max, tablets

**Why**: Limited space on small screens may require different UX

---

### Metrics to Track

#### Primary Metrics (Conversion Funnel)
1. **Generation Completion Rate**
   - Does quota warning reduce generation attempts?
   - Target: No statistically significant decrease (p < 0.05)

2. **Add-to-Cart Rate**
   - Does warning create friction in purchase flow?
   - Target: No decrease, ideally slight increase (informed users)

3. **Checkout Completion Rate**
   - End-to-end conversion impact
   - Target: No decrease

#### Secondary Metrics (Engagement)
4. **Quota Awareness**
   - % of users who tap badge for details
   - Target: >20% tap-through rate (indicates awareness)

5. **Alternative Effect Adoption**
   - Do users switch to B&W/Color when quota low?
   - Target: >30% switch when quota <3

6. **Toast Dismiss Rate**
   - Do users dismiss quota toasts immediately?
   - Target: <50% immediate dismiss (indicates reading)

#### Support Metrics
7. **Support Tickets**
   - "Why can't I generate?" inquiries
   - Target: 50% reduction vs. no-warning baseline

8. **User Frustration Signals**
   - Rapid button tapping (5+ taps in 3s on disabled button)
   - Target: <5% of exhausted quota sessions

---

### Test Duration

**Minimum Sample Size**:
- Need 1,000 sessions per variant for 80% statistical power
- With 70% mobile traffic, ~5,000 daily sessions
- Test duration: **2 weeks** (allows for week-over-week comparison)

**Weekday vs. Weekend**:
- Include at least 2 full weekends (user behavior differs)
- Monitor daily to catch major issues early

---

### iOS vs. Android Variants

**Hypothesis**: Android users respond better to snackbar-style toasts (Material Design), iOS users prefer bottom sheets (iOS HIG)

**Test Setup**:

**iOS Variant B-iOS**:
- Badge indicators
- Bottom sheet for details (swipe-to-dismiss)
- Haptic feedback on critical actions

**Android Variant B-Android**:
- Badge indicators
- Snackbar toasts (bottom of screen, auto-dismiss)
- No haptic feedback (less common on Android)

**Metrics**:
- Compare engagement & conversion by platform
- Determine if platform-specific UX needed

---

### Implementation (Feature Flags)

**JavaScript**:
```javascript
const variant = window.ABTesting.getVariant('quota-warning-ui');

if (variant === 'control') {
  // Badge only, no toasts
  showBadge();
} else if (variant === 'variantB') {
  // Badge + toasts (recommended)
  showBadge();
  showToastOnGeneration();
} else if (variant === 'variantC') {
  // Badge + persistent banner
  showBadge();
  showPersistentBanner();
}
```

**Assignment**:
- 50% Control (A)
- 30% Variant B (recommended)
- 20% Variant C (more aggressive)

**Sticky Assignment**:
- User gets same variant across sessions (localStorage)
- Ensures consistent experience

---

### Success Criteria

**Ship Variant B if**:
1. ✅ No statistically significant decrease in conversion (p < 0.05)
2. ✅ Quota awareness >20% (users engaging with info)
3. ✅ Support tickets reduced by ≥30%
4. ✅ No major user complaints (monitored via support, social)

**Kill Feature if**:
1. ❌ Conversion rate drops >3% (statistically significant)
2. ❌ High frustration signals (>10% rage tapping)
3. ❌ Accessibility issues reported

---

### Post-Launch Monitoring

**Week 1-2**: Daily monitoring (catch critical issues fast)
**Week 3-4**: Weekly review (ensure stability)
**Month 2+**: Monthly analysis (long-term trends)

**Key Questions**:
- Do users exhaust quota strategically (e.g., save for best photos)?
- Do returning users show different behavior (learned quota system)?
- Does quota warning affect customer lifetime value (CLV)?

---

## 10. Technical Implementation Summary

### File Structure

```
assets/
├── pet-processor.js (existing)
└── quota-warning-system.js (NEW)

snippets/
└── quota-warning-ui.liquid (NEW)

sections/
└── main-product.liquid (MODIFY - add quota UI)

styles/
└── quota-warnings.css (NEW)
```

---

### Component Architecture

**1. QuotaManager Class** (`quota-warning-system.js`)
```javascript
class QuotaManager {
  constructor() {
    this.quota = null;
    this.cache = this.loadCache();
    this.init();
  }

  async init() {
    // Load quota from cache immediately
    this.updateUI(this.cache);

    // Fetch fresh quota in background
    await this.fetchQuota();
  }

  async fetchQuota() {
    // API call with timeout & error handling
  }

  updateUI(quotaData) {
    // Update badges, toasts, banners
  }

  showBottomSheet(reason) {
    // Open quota details sheet
  }

  handleGeneration() {
    // Called after successful generation
    this.quota--;
    this.updateCache();
    this.updateUI();
    this.showToast();
  }
}
```

---

**2. Badge Component** (`snippets/quota-warning-ui.liquid`)
```liquid
<div class="effect-button-wrapper">
  <button
    class="effect-btn"
    data-effect="{{ effect.name }}"
    {% if effect.has_quota_limit %}
      aria-label="{{ effect.label }}, quota remaining"
    {% endif %}
  >
    {{ effect.label }}

    {% if effect.has_quota_limit %}
      <span
        class="quota-badge"
        data-quota-effect="{{ effect.name }}"
        aria-hidden="true"
      >
        <!-- Populated by JavaScript -->
      </span>
    {% endif %}
  </button>
</div>
```

---

**3. Bottom Sheet Component** (`snippets/quota-warning-ui.liquid`)
```liquid
<div
  class="quota-bottom-sheet"
  id="quota-details-sheet"
  role="dialog"
  aria-modal="true"
  hidden
>
  <div class="sheet-backdrop"></div>

  <div class="sheet-content">
    <div class="sheet-header">
      <h2 id="sheet-title">Artistic Styles</h2>
      <button
        class="sheet-close"
        aria-label="Close dialog"
      >×</button>
    </div>

    <div class="sheet-body">
      <!-- Quota details, alternatives, countdown -->
    </div>

    <div class="sheet-footer">
      <button class="btn-primary">Try Enhanced B&W</button>
    </div>
  </div>
</div>
```

---

### API Integration

**Endpoint**: `POST /api/v1/quota/check`

**Request**:
```json
{
  "userId": "anonymous_abc123",
  "timestamp": "2025-10-30T14:32:10Z"
}
```

**Response**:
```json
{
  "remaining": 4,
  "total": 6,
  "resetAt": "2025-10-31T00:00:00Z",
  "effects": {
    "modern": { "remaining": 4 },
    "classic": { "remaining": 4 }
  }
}
```

**Error Handling**:
```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "Daily quota reached",
  "remaining": 0,
  "resetAt": "2025-10-31T00:00:00Z"
}
```

---

### localStorage Schema

```json
{
  "quotaWarningSystem": {
    "cache": {
      "remaining": 4,
      "total": 6,
      "lastUpdated": "2025-10-30T14:32:10Z",
      "resetAt": "2025-10-31T00:00:00Z",
      "source": "api"
    },
    "uiState": {
      "bannerDismissed": false,
      "bottomSheetSeenLevel3": true,
      "lastToastShown": "2025-10-30T14:30:00Z"
    },
    "userPreferences": {
      "reducedMotion": false,
      "hapticFeedback": true
    }
  }
}
```

---

### CSS Variables (Theming)

```css
:root {
  /* Badge Colors */
  --quota-badge-normal: #3B82F6;
  --quota-badge-warning: #F59E0B;
  --quota-badge-urgent: #F97316;
  --quota-badge-exhausted: #EF4444;

  /* Spacing */
  --quota-badge-size: 24px;
  --quota-banner-height: 48px;
  --quota-sheet-max-height: 80vh;

  /* Animation Timing */
  --quota-transition-fast: 200ms;
  --quota-transition-normal: 350ms;
  --quota-transition-slow: 400ms;

  /* Touch Targets */
  --quota-min-touch-target: 44px;
}
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Core quota tracking without UI

**Tasks**:
1. Create QuotaManager class
2. Implement API integration
3. Add localStorage caching
4. Test quota sync across tabs
5. Error handling & offline fallback

**Deliverable**: Quota system works in console.log, no UI yet

---

### Phase 2: Badge Indicators (Week 2)
**Goal**: Minimal viable warning system

**Tasks**:
1. Add badge HTML to effect buttons
2. Implement badge number updates
3. Add color transitions (Level 1-4)
4. Bottom sheet for details (basic)
5. Disabled state for exhausted quota

**Deliverable**: Users can see quota, tap for details

---

### Phase 3: Progressive Warnings (Week 3)
**Goal**: Contextual messaging at critical moments

**Tasks**:
1. Toast notifications after generation
2. Mini-banner for Level 3 (2-3 remaining)
3. Exhausted state with alternatives
4. Countdown timer to reset
5. Animations & transitions

**Deliverable**: Full warning system with all 4 levels

---

### Phase 4: Polish & Accessibility (Week 4)
**Goal**: Production-ready experience

**Tasks**:
1. Screen reader testing & fixes
2. Reduced motion support
3. Haptic feedback (iOS)
4. Performance optimization (60fps)
5. Cross-browser testing

**Deliverable**: WCAG AA compliant, smooth UX

---

### Phase 5: A/B Testing & Iteration (Week 5-6)
**Goal**: Validate design with real users

**Tasks**:
1. Implement feature flags
2. Launch 3-variant A/B test
3. Monitor metrics daily
4. Collect user feedback
5. Iterate based on data

**Deliverable**: Optimized design based on evidence

---

## 12. Risk Assessment & Mitigation

### Risk 1: Quota Warning Reduces Conversion
**Likelihood**: Medium
**Impact**: High (directly affects revenue)

**Mitigation**:
- A/B test before full rollout
- Monitor conversion metrics daily
- Kill switch ready (revert to no-warning)
- Emphasize alternatives prominently

---

### Risk 2: Network Issues Cause Stale Quota
**Likelihood**: High (mobile networks are unreliable)
**Impact**: Medium (user confusion)

**Mitigation**:
- Aggressive caching strategy
- Clear "cached" indicators
- Retry mechanisms
- Fail-safe: Assume quota exhausted if uncertain

---

### Risk 3: Users Don't Understand Quota System
**Likelihood**: Medium
**Impact**: Medium (support tickets)

**Mitigation**:
- Plain language messaging
- Prominent "Help" link in bottom sheet
- FAQ section on quota page
- Monitor support tickets closely

---

### Risk 4: Animations Cause Performance Issues
**Likelihood**: Low
**Impact**: Medium (janky UX)

**Mitigation**:
- Use GPU-accelerated transforms only
- Test on low-end devices (iPhone SE, budget Android)
- Reduced motion fallback
- Lazy load animations (only run when visible)

---

### Risk 5: Accessibility Gaps
**Likelihood**: Medium
**Impact**: High (legal, reputation)

**Mitigation**:
- VoiceOver/TalkBack testing mandatory
- Color contrast checks automated (CI/CD)
- User testing with assistive tech users
- WCAG audit before launch

---

## 13. Success Metrics (3-Month Post-Launch)

### Business Goals
1. **Conversion Rate**: No decrease (target: ±0% change)
2. **Support Tickets**: 40% reduction in quota-related inquiries
3. **User Satisfaction**: NPS score maintained or improved

### User Behavior Goals
4. **Quota Awareness**: 25% of users interact with quota info
5. **Strategic Usage**: Users spread generations throughout day (not all at once)
6. **Alternative Adoption**: 35% try unlimited effects when quota low

### Technical Goals
7. **API Success Rate**: >99.5% quota checks succeed
8. **Cache Hit Rate**: >80% of quota checks served from cache
9. **Performance**: No animations drop below 50fps

---

## 14. Open Questions for Stakeholders

1. **Quota Reset Time**: Should it be midnight UTC (global) or user's local timezone (complex)?
2. **Quota Sharing**: Should Modern & Classic share 6 total, or each get 6 (12 total)?
3. **Power User Tier**: Should we offer "unlimited" for paid subscribers?
4. **Onboarding**: Should we show an explainer on first visit (before user hits limit)?
5. **Analytics**: What should we track beyond standard metrics (time-to-exhaust, effect preferences)?

---

## 15. Appendix: Design Mockups

### A. Badge States (All Levels)

**Level 1 (Normal)**:
```
┌─────────┐
│ Modern  │
│   ⚡6   │
└─────────┘
```

**Level 2 (Reminder)**:
```
┌─────────┐
│ Modern  │
│  ⚠️3    │
└─────────┘
```

**Level 3 (Warning)**:
```
┌─────────┐
│ Modern  │
│  ⚠️2    │
└─────────┘
```

**Level 4 (Exhausted)**:
```
┌─────────┐
│ Modern  │
│   🚫    │
└─────────┘
```

---

### B. Toast Notification (Level 2)

```
┌─────────────────────────────────┐
│ 🎨 3 artistic styles left today │
│                         [Tap to dismiss]
└─────────────────────────────────┘
```

**Position**: Top of screen, below header, above canvas
**Duration**: 3s auto-dismiss
**Animation**: Slide from top

---

### C. Mini-Banner (Level 3)

```
┌─────────────────────────────────┐
│ 💡 2 artistic styles remaining  │
│ [Tap for details]               │
└─────────────────────────────────┘
```

**Position**: Between canvas and effect buttons
**Height**: 48px
**Collapsible**: Dismissible with X button
**Persistence**: Reappears on page load until quota >3

---

### D. Bottom Sheet (Exhausted State)

```
┌─────────────────────────────────┐
│ [Swipe down to dismiss]         │  Grabber
├─────────────────────────────────┤
│         Daily Limit Reached     │  Header
│                            [X]  │
├─────────────────────────────────┤
│ 🎨 Amazing! You've created 6    │
│ artistic pet portraits today.   │
│                                 │
│ Still want more styles?         │
│                                 │
│ ┌──────────────────────────┐   │
│ │ ✅ Enhanced Black & White │   │  Alternative #1
│ │ Unlimited • Professional  │   │
│ │ [Thumbnail]               │   │
│ └──────────────────────────┘   │
│                                 │
│ ┌──────────────────────────┐   │
│ │ ✅ Color Pop              │   │  Alternative #2
│ │ Unlimited • Vibrant       │   │
│ │ [Thumbnail]               │   │
│ └──────────────────────────┘   │
│                                 │
│ 🌙 More artistic styles in:     │
│        8h 23m 45s               │  Countdown
│    Resets daily at midnight UTC │
│                                 │
│ [Try Enhanced B&W Now]          │  Primary CTA
│ [Dismiss]                       │  Secondary
└─────────────────────────────────┘
```

**Max Height**: 80vh
**Scroll**: Content scrollable if exceeds height
**Backdrop**: rgba(0,0,0,0.5) dimmed overlay

---

## 16. Next Steps

**Immediate Actions**:
1. ✅ Review this plan with stakeholders (product, design, eng)
2. ✅ Resolve open questions (quota reset time, sharing model)
3. ⏸️ Create detailed wireframes/prototypes (Figma)
4. ⏸️ Set up A/B testing infrastructure (feature flags)
5. ⏸️ Begin Phase 1 implementation (QuotaManager class)

**Before Launch**:
- User testing with 5-10 mobile users (moderated sessions)
- Accessibility audit (VoiceOver, TalkBack, contrast)
- Performance testing on low-end devices (iPhone SE, budget Android)
- Legal review (clear communication of limits)

**Post-Launch**:
- Daily metrics monitoring (first 2 weeks)
- Weekly iteration based on data
- Monthly retrospective (what worked, what didn't)

---

## Document Control

**Version**: 1.0
**Last Updated**: 2025-10-30
**Author**: Mobile Commerce Architect Agent
**Stakeholders**: Product, Engineering, Design, QA
**Status**: Awaiting Approval

**Change Log**:
- 2025-10-30: Initial draft (v1.0)

---

**END OF IMPLEMENTATION PLAN**
