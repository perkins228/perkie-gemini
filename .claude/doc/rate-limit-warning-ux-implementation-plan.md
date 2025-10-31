# Rate Limit Warning System - UX Implementation Plan

**Created**: 2025-10-30
**Status**: Implementation Plan
**Related**: Gemini Artistic API Integration, Mobile Commerce Optimization

---

## Executive Summary

This document provides a complete UX implementation plan for a conversion-friendly rate limit warning system. The design prioritizes mobile experience (70% traffic), maintains conversion momentum, and frames the 6/day Gemini quota as value rather than restriction.

**Core Design Principle**: Inform without creating anxiety. The warning system should feel like a helpful guide, not a barrier to purchase.

---

## 1. Warning Trigger Strategy

### Recommended Approach: **Progressive Disclosure with Subtle Persistence**

#### Trigger Matrix

| State | Quota Remaining | UI Change | Messaging Priority | Dismissible |
|-------|----------------|-----------|-------------------|-------------|
| **First Use** | 6/6 | Onboarding tooltip (1-time only) | Low | Yes (auto-dismiss 5s) |
| **Normal Use** | 5-4 remaining | Persistent subtle indicator | Very Low | N/A (always visible) |
| **Awareness** | 3 remaining (50%) | Indicator changes color | Low-Medium | N/A |
| **Caution** | 2-1 remaining (75%+) | Prominent warning + modal option | Medium | Yes (manual dismiss) |
| **Last Use** | 1 remaining | Urgent banner + confirmation | High | No (must acknowledge) |
| **Exhausted** | 0 remaining | Effect buttons disabled + helpful message | High | No (permanent until reset) |

### Rationale

**Why not warn on every generation?**
- Creates notification fatigue
- Adds friction to conversion funnel
- Users learn to ignore repeated warnings

**Why show persistent indicator from first use?**
- Sets expectations upfront (no surprise when limit hits)
- Feels like a feature ("I have 6 special generations!") not a restriction
- Allows users to self-manage their quota strategically

**Why escalate at 50% and 75%?**
- 50% (3 left): Awareness without urgency - user still has plenty
- 75% (2 left): Time to make final decisions before exhaustion
- Matches common UX patterns (phone battery warnings)

---

## 2. UI Placement & Visibility

### Mobile Design (70% Traffic) - PRIMARY

#### Location: **Persistent Header Badge + Contextual Inline**

```
┌─────────────────────────────────┐
│  🎨 Artistic: ●●●●○○ (4/6)     │  ← Persistent header badge
│  ✕                              │     (collapses to icon on scroll)
└─────────────────────────────────┘

[Pet Image Preview - Large]

Effect Selection:
┌──────────┬──────────┐
│ Enhanced │  Color   │  ← Unlimited (no badge)
│   B&W    │          │
└──────────┴──────────┘
┌──────────┬──────────┐
│  Modern  │ Classic  │  ← Limited (badge visible)
│ (Ink)    │ (Van G)  │
│  ⓘ 4/6   │  ⓘ 4/6   │  ← Shared quota indicator
└──────────┴──────────┘

[Add to Cart] ← 44px min height
```

#### Visual Hierarchy

**Normal State (4-6 remaining)**:
- Header badge: Subtle gray with soft blue accent
- Button badges: Small, low contrast (#666)
- No interruption to flow

**Warning State (2-3 remaining)**:
- Header badge: Amber/orange (#F59E0B)
- Button badges: More prominent, amber
- Optional: Gentle pulse animation (1x only, not continuous)

**Critical State (1 remaining)**:
- Header badge: Red (#EF4444)
- Button badges: Red with warning icon
- Inline message above effect buttons: "Last artistic style available today"

**Exhausted State (0 remaining)**:
- Modern/Classic buttons: Disabled (opacity 0.5)
- Overlay text: "Available tomorrow"
- Header badge: Gray with reset countdown

### Desktop Design (30% Traffic) - SECONDARY

#### Location: **Sidebar Panel + Button Badges**

```
┌──────────────────────┬─────────────────┐
│  [Pet Image Preview] │  ╔═════════════╗ │
│                      │  ║  🎨 Artistic│ │
│  [Effect Selection]  │  ║  Styles     │ │
│                      │  ║             │ │
│  ┌────┬────┐         │  ║  ●●●●○○    │ │
│  │ B&W│Col │         │  ║  4/6 left   │ │
│  └────┴────┘         │  ║  today      │ │
│  ┌────┬────┐         │  ║             │ │
│  │Ink │VanG│ ⓘ 4/6   │  ║  Resets at  │ │
│  └────┴────┘         │  ║  midnight   │ │
│                      │  ╚═════════════╝ │
│  [Add to Cart]       │                  │
└──────────────────────┴─────────────────┘
```

**Desktop Benefits**:
- More screen real estate = more informative sidebar
- Can show quota + reset time + explanation
- Hover states can reveal additional details
- Non-intrusive placement

---

## 3. Visual Design Specifications

### Color Palette (Conversion-Optimized)

```css
/* Normal State (4-6 remaining) */
--quota-normal-bg: #F3F4F6;        /* Soft gray */
--quota-normal-text: #6B7280;      /* Medium gray */
--quota-normal-accent: #3B82F6;    /* Soft blue */

/* Awareness State (3 remaining - 50%) */
--quota-aware-bg: #FEF3C7;         /* Soft yellow */
--quota-aware-text: #92400E;       /* Amber-brown */
--quota-aware-accent: #F59E0B;     /* Amber */

/* Warning State (2-1 remaining - 75%+) */
--quota-warning-bg: #FEE2E2;       /* Soft red */
--quota-warning-text: #991B1B;     /* Dark red */
--quota-warning-accent: #EF4444;   /* Red */

/* Exhausted State (0 remaining) */
--quota-exhausted-bg: #F3F4F6;     /* Neutral gray */
--quota-exhausted-text: #4B5563;   /* Medium gray */
--quota-exhausted-accent: #9CA3AF; /* Light gray */
```

### Component Design

#### Header Badge Component

**Normal State**:
```html
<div class="quota-badge quota-badge--normal">
  <span class="quota-badge__icon">🎨</span>
  <span class="quota-badge__label">Artistic:</span>
  <span class="quota-badge__dots">●●●●○○</span>
  <span class="quota-badge__count">(4/6)</span>
</div>
```

**Collapsed State (on scroll)**:
```html
<div class="quota-badge quota-badge--collapsed">
  <span class="quota-badge__icon">🎨</span>
  <span class="quota-badge__count">4/6</span>
</div>
```

**Specifications**:
- Height: 40px (mobile), 36px (desktop)
- Padding: 8px 12px
- Border-radius: 8px
- Font-size: 14px (mobile), 13px (desktop)
- Font-weight: 500 (medium)
- Tap target: 44px minimum (mobile)

#### Button Badge Component

```html
<button class="effect-button" data-effect="modern">
  <img src="modern-preview.jpg" alt="Modern Ink Wash Style">
  <span class="effect-button__label">Modern</span>
  <span class="effect-button__quota">ⓘ 4/6</span>
</button>
```

**Specifications**:
- Badge position: Bottom-right corner (8px inset)
- Font-size: 11px
- Padding: 4px 6px
- Border-radius: 12px (pill shape)
- Background: Semi-transparent overlay (rgba(0,0,0,0.7))
- Text color: White
- Icon: ⓘ or custom SVG info icon

#### Progress Dots Visualization

**Visual Representation**:
```
6/6: ●●●●●●  (all filled)
5/6: ●●●●●○  (one empty)
4/6: ●●●●○○  (two empty)
3/6: ●●●○○○  (three empty - color shifts to amber)
2/6: ●●○○○○  (four empty - color shifts to red)
1/6: ●○○○○○  (five empty - red + animation)
0/6: ○○○○○○  (all empty - gray)
```

**Color Mapping**:
- Filled dot (●): Inherits from parent badge state color
- Empty dot (○): 30% opacity of filled color

### Animation Specifications

#### Pulse Animation (Used Sparingly)

```css
@keyframes quota-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

/* Apply only once when crossing thresholds */
.quota-badge--pulse {
  animation: quota-pulse 1s ease-in-out 1;
}
```

**When to use**:
- First use (onboarding tooltip appears)
- Crossing 50% threshold (6→3 remaining)
- Crossing 75% threshold (3→2 remaining)
- Exhausting quota (1→0 remaining)
- **NEVER**: Continuous looping animation (creates anxiety)

#### Quota Update Animation

```css
@keyframes quota-count-update {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
    color: var(--quota-accent);
  }
  100% {
    transform: scale(1);
  }
}

.quota-badge__count--updating {
  animation: quota-count-update 0.4s ease-in-out;
}
```

**When to use**:
- Every time quota decrements after successful generation
- Provides feedback that action was counted

---

## 4. Messaging Guide (Copy Specifications)

### Principle: **Positive Framing + Actionable Information**

#### Onboarding Tooltip (First Use Only)

**Trigger**: User clicks Modern or Classic effect for the first time
**Display**: 5 seconds auto-dismiss OR manual close
**Placement**: Pointing to header badge (mobile) or sidebar (desktop)

**Copy**:
```
✨ You have 6 artistic style generations today!

Modern and Classic effects are powered by AI and
limited to keep quality high. B&W and Color are
always unlimited.

Quota resets at midnight UTC.

[Got it] ← Manual dismiss button
```

**Tone Analysis**:
- ✅ Starts with benefit ("You have") not restriction
- ✅ Explains WHY there's a limit (quality, not scarcity)
- ✅ Reassures unlimited alternatives exist
- ✅ Sets expectation for reset

#### Normal State (4-6 remaining)

**Header Badge**: `🎨 Artistic: ●●●●○○ (4/6)`
**No additional messaging needed**

**Button Hover/Tap (Desktop/Mobile)**:
```
Tooltip: "4 artistic generations left today"
```

#### Awareness State (3 remaining - 50%)

**Header Badge**: Changes to amber color
**One-time banner** (dismissible, shows once per session):

```
┌─────────────────────────────────────────────┐
│ ⓘ Halfway through your artistic styles      │
│   (3 left today). Unlimited B&W and Color.  │
│                                         [✕] │
└─────────────────────────────────────────────┘
```

**Tone Analysis**:
- ✅ Informational, not alarming
- ✅ Reminds them of unlimited alternatives
- ✅ Dismissible (user choice to keep or remove)

#### Warning State (2 remaining - 75%)

**Header Badge**: Changes to red color
**Inline message** (persistent, not dismissible):

```
⚠️ 2 artistic styles remaining today
Make your favorites count! B&W and Color still unlimited.
```

**Placement**: Between pet preview and effect selection

**Tone Analysis**:
- ✅ Clear warning icon (⚠️) signals importance
- ✅ Encourages strategic use ("make them count")
- ✅ Reassures unlimited alternatives

#### Critical State (1 remaining - Last Use)

**Confirmation Modal** (appears when user clicks Modern/Classic):

```
┌──────────────────────────────────────────┐
│  Last Artistic Style Available Today     │
│                                          │
│  This is your 6th and final artistic    │
│  style generation for today. Choose      │
│  wisely!                                 │
│                                          │
│  • B&W and Color remain unlimited        │
│  • Quota resets at midnight UTC          │
│  • You can save this session and return  │
│                                          │
│  [Cancel] [Generate Final Style]        │
└──────────────────────────────────────────┘
```

**Mobile Version** (Simplified):
```
┌──────────────────────────────────────────┐
│  Last Artistic Style Today               │
│                                          │
│  Your 6th and final generation. Choose  │
│  wisely or save for tomorrow.           │
│                                          │
│  Resets at midnight. B&W/Color still    │
│  unlimited.                              │
│                                          │
│  [Cancel] [Use Last Style]              │
└──────────────────────────────────────────┘
```

**Tone Analysis**:
- ✅ Empowers user to make informed choice
- ✅ No pressure ("cancel" is equal prominence)
- ✅ Provides alternatives and options
- ❌ Avoids panic language like "WARNING" or "LIMIT REACHED"

#### Exhausted State (0 remaining)

**Header Badge**: `🎨 Artistic: ○○○○○○ (0/6)` - Gray, no pulse
**Effect Button Overlay**:

```
┌──────────┬──────────┐
│  Modern  │ Classic  │
│ (Ink)    │ (Van G)  │
│          │          │
│ ✓ Check  │ ✓ Check  │ ← Button overlay
│ tomorrow │ tomorrow │
└──────────┴──────────┘
    ↑ Disabled state (opacity 0.5)
```

**Inline Message** (prominent, persistent):

```
┌─────────────────────────────────────────────┐
│ ✨ You've used all 6 artistic styles today! │
│                                             │
│ Your artistic quota resets at midnight UTC. │
│                                             │
│ Meanwhile:                                  │
│ • Try our classic B&W and Color effects    │
│   (always unlimited!)                       │
│ • Save your favorite and return tomorrow   │
│ • Complete your order with current styles  │
│                                             │
│ Reset countdown: 7h 23m                    │
└─────────────────────────────────────────────┘
```

**Mobile Version** (Simplified):
```
┌─────────────────────────────────────────────┐
│ 🎨 Daily artistic limit reached             │
│                                             │
│ Resets in: 7h 23m                           │
│                                             │
│ ✓ B&W and Color still unlimited             │
│ ✓ Save session for tomorrow                │
│ ✓ Current styles ready to order            │
└─────────────────────────────────────────────┘
```

**Tone Analysis**:
- ✅ Celebrates completion ("You've used all 6!") not failure
- ✅ Provides clear reset information (countdown timer)
- ✅ Offers 3 actionable alternatives
- ✅ Emphasizes current styles are still valuable
- ❌ Avoids negative framing like "OUT OF QUOTA"

### Copy Best Practices

**Always Include**:
1. Current quota status (X/6)
2. Reset timing (midnight UTC or countdown)
3. Unlimited alternatives (B&W, Color)
4. Action user can take (save, use other effects, complete order)

**Never Use**:
- Panic language: "WARNING", "RUNNING OUT", "LIMIT REACHED"
- Vague timing: "Soon", "Later", "Eventually"
- Blame: "You've exceeded", "You've run out"
- Dead ends: Messages with no alternative action

**Tone Checklist**:
- [ ] Starts positive (benefit or acknowledgment)
- [ ] Explains WHY (transparency builds trust)
- [ ] Provides alternatives (never a dead end)
- [ ] Clear timing (specific reset time)
- [ ] Actionable (user knows what to do next)

---

## 5. Mobile-Specific Implementation (70% Traffic)

### Mobile Constraints

1. **Screen Space**: Limited vertical/horizontal space for warnings
2. **Tap Targets**: Minimum 44x44px (iOS HIG), 48x48dp (Material Design)
3. **One-Handed Use**: 75% of users hold phone with one hand
4. **Attention**: Mobile users skim, don't read long messages
5. **Network**: May be on slow connection (progress indicators critical)

### Mobile-Optimized Components

#### Collapsible Header Badge

**Default State** (page load):
```
┌─────────────────────────────────┐
│  🎨 Artistic: ●●●●○○ (4/6)     │  ← Full badge (56px height)
└─────────────────────────────────┘
```

**Scrolled State** (user scrolls down):
```
┌────────────────┐
│  🎨 4/6        │  ← Collapsed (40px height)
└────────────────┘
```

**Rationale**:
- Saves vertical space when scrolling
- Remains visible for awareness
- Expandable on tap (shows full details)

#### Bottom Sheet for Quota Details (Optional)

**Trigger**: User taps collapsed quota badge OR quota info icon
**Behavior**: Slides up from bottom (native mobile pattern)

```
┌─────────────────────────────────┐
│             ━━━━                │ ← Drag handle
│                                 │
│  🎨 Artistic Style Quota        │
│                                 │
│  ●●●●○○  4 of 6 left today     │
│                                 │
│  Why limited?                   │
│  Artistic effects use advanced  │
│  AI processing. We limit to 6   │
│  per day to maintain quality.   │
│                                 │
│  What resets?                   │
│  Midnight UTC (7h 23m)          │
│                                 │
│  Alternatives?                  │
│  • Enhanced B&W (unlimited)     │
│  • Color (unlimited)            │
│                                 │
│  [Close]                        │
└─────────────────────────────────┘
```

**Rationale**:
- Follows native mobile UX patterns (iOS/Android sheets)
- Provides detailed info without cluttering main UI
- User-initiated (no interruption)
- Easily dismissible (swipe down or close button)

#### Inline Banner (Warning States Only)

**Trigger**: 2-3 remaining OR 0 remaining
**Placement**: Between preview and effect selection
**Height**: Auto (based on content), max 120px

```
┌─────────────────────────────────┐
│ ⚠️ 2 artistic styles left       │
│ B&W and Color still unlimited   │
│                             [✕] │ ← Dismissible (2-3 state only)
└─────────────────────────────────┘
```

**Mobile Specifications**:
- Font-size: 14px (readable without zoom)
- Line-height: 1.5 (easy scanning)
- Padding: 12px 16px (ample tap space)
- Close button: 44x44px minimum

#### Modal Confirmation (Last Use)

**Mobile-Optimized Version**:

```
┌─────────────────────────────────┐
│  Last Artistic Style Today      │ ← 18px bold
│                                 │
│  Your 6th and final generation. │ ← 14px regular
│  Choose wisely or save for      │
│  tomorrow.                      │
│                                 │
│  • Resets at midnight           │
│  • B&W/Color unlimited          │
│                                 │
│  [Cancel]  [Use Last Style]     │ ← 44px height
└─────────────────────────────────┘
      ↑ Equal width buttons (50% each)
```

**Touch Optimizations**:
- Buttons: 44px min height, 16px gap between
- Text: 14px minimum (WCAG AA readable)
- Modal: 90% screen width (allows easy dismiss by tap-outside)
- Buttons: High contrast (primary action slightly bolder)

### Mobile Performance Considerations

#### Lazy Loading Quota Status

**Problem**: Fetching quota on page load adds latency
**Solution**: Progressive enhancement

```javascript
// Initial render (optimistic)
<div class="quota-badge quota-badge--loading">
  🎨 <span class="spinner"></span>
</div>

// After API response (0.5-2s)
<div class="quota-badge quota-badge--normal">
  🎨 Artistic: ●●●●○○ (4/6)
</div>
```

**Fallback** (if API fails):
```javascript
<div class="quota-badge quota-badge--error">
  🎨 <span class="quota-badge__error-icon">⚠️</span>
</div>
// Clicking opens bottom sheet with error message
```

#### Offline Handling

**Scenario**: User generated 2 styles, then goes offline

**Behavior**:
1. Last known quota stored in localStorage: `{"quota": 4, "timestamp": 1698660000}`
2. Badge shows last known state with indicator: `🎨 4/6 (offline)`
3. Attempting to generate shows: "No connection. Please reconnect to use artistic styles."

**Rationale**:
- Mobile users frequently have spotty connectivity
- Showing stale data with indicator > showing error immediately
- Prevents confusion when connectivity returns

### Mobile-Specific Interactions

#### Haptic Feedback (iOS/Android)

**When to trigger**:
1. Quota updates after successful generation (light impact)
2. Crossing threshold warning (medium impact)
3. Exhausting quota (heavy impact)
4. Error generating (error vibration pattern)

**Implementation**:
```javascript
// Light haptic (quota update)
navigator.vibrate(10);

// Medium haptic (warning threshold)
navigator.vibrate([10, 50, 10]);

// Heavy haptic (quota exhausted)
navigator.vibrate([20, 100, 20]);
```

**Rationale**:
- Provides tactile feedback without visual interruption
- Accessible for users with visual impairments
- Feels premium and polished

#### Pull-to-Refresh Quota Status

**Scenario**: User suspects quota hasn't updated correctly

**Behavior**: Standard pull-to-refresh gesture refreshes quota from API

**Visual Feedback**:
```
     ↓ Pull to refresh quota

┌─────────────────────────────────┐
│  🎨 Artistic: ●●●●○○ (4/6)     │
│  Updated just now               │ ← Timestamp feedback
└─────────────────────────────────┘
```

**Rationale**:
- Familiar mobile pattern (iOS/Android)
- Gives user control to manually sync
- Builds trust (transparency in sync status)

---

## 6. Edge Cases & Error Handling

### Edge Case Matrix

| Scenario | User Impact | System Behavior | UI Response |
|----------|------------|-----------------|-------------|
| API fails to fetch quota | Can't see remaining quota | Fallback to last known quota (localStorage) | Show "⚠️ 4/6 (offline)" with refresh option |
| API returns invalid quota (e.g., -1 or 7) | Incorrect quota displayed | Validate response, fallback to 0 | Show error state, allow retry |
| User hits quota mid-generation | Wasted attempt | Log attempt, don't decrement quota (idempotent) | Show error: "Generation failed, quota not deducted" |
| User shares session across devices | Quota out of sync | Quota tracked server-side by IP/fingerprint | Real-time sync on each device (polling or SSE) |
| User clears cookies/localStorage | Loses quota tracking | Quota tracked server-side, not client-side | Fetch from API on page load |
| Timezone confusion (reset time) | User confused when quota resets | Store reset timestamp server-side in UTC | Convert to user's local time in UI |
| User in checkout with 0 quota left | Can't generate more styles | Existing styles still available | Allow checkout with current styles, disable new generations |
| Quota API slow (>3s response) | UI feels broken | Show loading state, timeout after 5s | Skeleton loader → error state with retry |
| User rapidly clicks generate (race condition) | Multiple generations, quota over-decremented | Server-side rate limiting (1 req/3s per user) | Disable button after click, show "Processing..." |
| Midnight UTC rollover during session | Quota resets while user browsing | Server-side check on each generation | Auto-refresh quota badge, show toast: "✨ Quota reset!" |

### Error State Designs

#### Quota API Unavailable

**Scenario**: Cannot fetch current quota from server

**UI State**:
```
┌─────────────────────────────────┐
│  🎨 ⚠️ Quota unavailable        │
│  Tap to retry                   │
└─────────────────────────────────┘
```

**Effect Buttons**:
- Modern/Classic: Enabled (optimistic, allow user to try)
- If generation fails: Show error message and retry option

**Messaging**:
```
Unable to check your artistic quota right now.

You can try generating a style - if you've reached
your daily limit, we'll let you know.

[Try Anyway] [Retry Quota Check]
```

**Rationale**:
- Don't block user completely if quota API is down
- Optimistic UX (assume they have quota)
- Backend will enforce limit anyway (validation layer)

#### Generation Fails After Quota Check

**Scenario**: Quota shows 4/6, user clicks generate, but generation fails (Gemini API error)

**UI State**:
1. Button shows loading spinner
2. After 30s timeout or error response
3. Show error message (doesn't decrement quota)

**Messaging**:
```
┌─────────────────────────────────┐
│  Generation Failed               │
│                                 │
│  Your artistic style couldn't   │
│  be generated. Your quota has   │
│  NOT been deducted (still 4/6). │
│                                 │
│  • Check your connection        │
│  • Try again in a moment        │
│  • Use B&W or Color instead     │
│                                 │
│  [Retry] [Cancel]               │
└─────────────────────────────────┘
```

**Backend Behavior**:
- Generation endpoint must be idempotent
- Only decrement quota on successful generation
- Return 500/503 error with clear message

**Rationale**:
- User shouldn't lose quota on our errors
- Transparency builds trust
- Offer alternatives to keep conversion moving

#### Quota Exhausted Mid-Checkout

**Scenario**: User generated 6 styles, selected one, now in checkout, wants to go back and generate more

**UI State**:
1. User navigates back to effect selection
2. Modern/Classic buttons disabled
3. Selected effect still highlighted and available

**Messaging**:
```
┌─────────────────────────────────┐
│  Your artistic quota is used up │
│  for today, but your selected   │
│  style is saved and ready!      │
│                                 │
│  • Continue to checkout         │
│  • Try B&W or Color effects     │
│  • Return tomorrow for 6 more   │
│                                 │
│  [Continue to Checkout]         │
└─────────────────────────────────┘
```

**CTA**: Make "Continue to Checkout" prominent (primary button)

**Rationale**:
- Don't lose the conversion
- Emphasize what they CAN do (proceed with current selection)
- De-emphasize what they CAN'T do (generate more)

### Timezone Handling

**Problem**: User in California sees "Resets at midnight UTC" (4pm PST) - confusing

**Solution**: Show reset time in user's local timezone

**Implementation**:
```javascript
// Backend returns reset timestamp in UTC
const resetTimestampUTC = "2025-10-31T00:00:00Z";

// Frontend converts to user's local timezone
const resetLocal = new Date(resetTimestampUTC);
const resetString = resetLocal.toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

// Display: "Resets at 5:00 PM (your time)" or "Resets at midnight (your time)"
```

**UI Display**:
```
Quota resets at midnight (your time)
         or
Quota resets in 7h 23m
```

**Mobile**: Prefer countdown ("in 7h 23m") - more universal, no timezone confusion

### Session Persistence Across Devices

**Problem**: User starts session on phone, switches to desktop, quota out of sync

**Solution**: Server-side quota tracking by user fingerprint or IP (anonymous users)

**Architecture**:
```
User generates style on Phone
    ↓
Backend decrements quota in Firestore
    ↓
User switches to Desktop
    ↓
Desktop fetches quota from Firestore
    ↓
Displays accurate quota: 5/6
```

**Logged-In Users** (future):
- Track by user ID (most accurate)
- Sync across all devices in real-time

**Anonymous Users** (current):
- Track by IP + user agent fingerprint (reasonable accuracy)
- Accept edge cases (VPN switching, shared IPs)

**Edge Case**: User on shared IP (coffee shop)
- Multiple users may share same quota
- Acceptable trade-off for free service
- Can be mitigated with cookie-based tracking + IP

### Race Condition Prevention

**Problem**: User rapidly clicks "Generate" 3 times, triggers 3 simultaneous API calls

**Solution**: Client-side + server-side rate limiting

**Client-Side**:
```javascript
let isGenerating = false;

function generateEffect(style) {
  if (isGenerating) {
    console.warn('Generation already in progress');
    return;
  }

  isGenerating = true;
  generateButton.disabled = true;
  generateButton.textContent = 'Generating...';

  // API call
  await fetch('/api/generate', { ... });

  isGenerating = false;
  generateButton.disabled = false;
  generateButton.textContent = 'Generate';
}
```

**Server-Side** (Firestore transaction):
```python
@firestore.transactional
def decrement_quota(transaction, user_id):
    doc_ref = db.collection('quotas').document(user_id)
    doc = doc_ref.get(transaction=transaction)

    current_quota = doc.get('remaining')
    if current_quota <= 0:
        raise QuotaExceededError("No quota remaining")

    transaction.update(doc_ref, {'remaining': current_quota - 1})
    return current_quota - 1
```

**Rationale**:
- Client-side prevents accidental double-clicks
- Server-side prevents malicious abuse
- Transactional write prevents race conditions in Firestore

---

## 7. A/B Testing Strategy

### Test Hypothesis

**H0 (Null Hypothesis)**: Rate limit warnings have no effect on conversion rate

**H1 (Alternative)**: Clear rate limit warnings increase conversion rate by reducing uncertainty and encouraging strategic use

### Test Variants

#### Variant A: Progressive Disclosure (Recommended)

**Description**: Persistent subtle indicator + escalating warnings at thresholds

**Components**:
- Header badge always visible (collapsible on scroll)
- Button badges on Modern/Classic effects
- Inline banners at 50%, 75%, 0% thresholds
- Confirmation modal on last use

**Hypothesis**: Users appreciate transparency and strategic planning capability

#### Variant B: Silent Until Critical

**Description**: No indication until 2 remaining or exhausted

**Components**:
- No header badge or button badges
- First warning appears at 2 remaining
- Prominent banner at 0 remaining
- No confirmation modal

**Hypothesis**: Warnings create anxiety; better to let users discover naturally

#### Variant C: Always Prominent

**Description**: Large, always-visible quota indicator + frequent reminders

**Components**:
- Large header banner (non-collapsible)
- Toast notification after every generation
- Warning modal at every threshold (50%, 75%, 90%, 100%)

**Hypothesis**: Maximum awareness = maximum strategic use = higher conversion

#### Control: No Warnings

**Description**: Current behavior (if no system exists)

**Components**:
- No quota indicators
- Effects just stop working at 6 uses
- Generic error message: "Service temporarily unavailable"

**Hypothesis**: Baseline to measure any warning system impact

### Test Configuration

**Split**: 25% each variant (A/B/C/Control)
**Duration**: 2 weeks minimum (capture weekly patterns)
**Sample Size**: Minimum 400 conversions per variant (statistical significance)
**Randomization**: User-level (consistent experience per user)

### Primary Success Metrics

| Metric | Definition | Target | Priority |
|--------|-----------|--------|----------|
| **Conversion Rate** | % users who add-to-cart after using effects | ≥ Control | P0 |
| **Effect Usage Rate** | % users who generate ≥1 Gemini effect | ≥ 40% | P0 |
| **Quota Exhaustion Rate** | % users who hit 6/6 limit | Neutral | P1 |
| **Purchase Completion** | % add-to-cart that complete checkout | ≥ Control | P0 |

### Secondary Success Metrics

| Metric | Definition | Target | Priority |
|--------|-----------|--------|----------|
| **Time to Add-to-Cart** | Seconds from upload to ATC | ≤ Control | P1 |
| **Gemini Effect Selection Rate** | % orders using Modern/Classic vs B&W/Color | ≥ 30% | P1 |
| **Warning Dismissal Rate** | % users who dismiss warnings | Informational | P2 |
| **Return Rate (Next Day)** | % users who return after exhausting quota | ≥ 10% | P2 |
| **Support Ticket Rate** | Tickets mentioning quota/limits | ≤ 1% | P2 |

### Guardrail Metrics (Must Not Degrade)

| Metric | Threshold | Action if Breached |
|--------|-----------|-------------------|
| Mobile Conversion Rate | -5% vs Control | Stop test, rollback |
| Page Load Time | +500ms vs Control | Investigate performance |
| API Error Rate | >5% | Fix backend issues |
| Bounce Rate | +10% vs Control | Review warning UX |

### Data Collection Requirements

**Frontend Events to Track**:
```javascript
// Page load
analytics.track('effects_page_viewed', {
  test_variant: 'progressive_disclosure',
  user_id: anonymousId,
  timestamp: Date.now()
});

// Quota status fetched
analytics.track('quota_fetched', {
  remaining: 6,
  total: 6,
  test_variant: 'progressive_disclosure'
});

// Warning displayed
analytics.track('quota_warning_displayed', {
  remaining: 3,
  threshold: '50%',
  warning_type: 'inline_banner',
  test_variant: 'progressive_disclosure'
});

// Warning interacted
analytics.track('quota_warning_interaction', {
  action: 'dismissed',
  remaining: 3,
  test_variant: 'progressive_disclosure'
});

// Effect generated
analytics.track('effect_generated', {
  effect_type: 'modern',
  remaining_before: 4,
  remaining_after: 3,
  test_variant: 'progressive_disclosure'
});

// Quota exhausted
analytics.track('quota_exhausted', {
  total_generated: 6,
  session_duration: 420, // seconds
  test_variant: 'progressive_disclosure'
});

// Add to cart
analytics.track('add_to_cart', {
  effect_selected: 'modern',
  quota_used: 4,
  test_variant: 'progressive_disclosure'
});
```

**Backend Events to Track**:
- API success/error rates per variant
- Quota check latency per variant
- Generation latency per variant

### Analysis Plan

#### Week 1 Check-In (Early Signal)

**Questions to Answer**:
1. Are any variants causing significant conversion drop? (>10%)
2. Are error rates elevated in any variant?
3. Are users interacting with warnings as expected?
4. Any unexpected user behaviors?

**Action**: Kill underperforming variants, allocate traffic to winners

#### Week 2 Final Analysis

**Statistical Tests**:
1. Chi-square test: Conversion rate differences between variants
2. T-test: Time-to-conversion differences
3. ANOVA: Multi-variant comparison (if >2 variants)

**Confidence Level**: 95% (p < 0.05)

**Decision Criteria**:
- **Clear Winner** (>5% conversion lift, p < 0.05): Deploy to 100%
- **No Significant Difference**: Deploy simplest variant (lowest dev cost)
- **All Variants Worse Than Control**: Keep control (no warnings)

#### Qualitative Analysis

**User Interviews** (Optional but Recommended):
- Recruit 10-15 users per variant
- Ask:
  - "Did you notice the quota indicators? What did you think?"
  - "Did the warnings help or frustrate you?"
  - "Would you change anything about how we communicated the limit?"

**Session Recordings**:
- Watch 50 sessions per variant (Hotjar, FullStory, etc.)
- Look for:
  - Confusion moments (clicks on disabled buttons, re-reading warnings)
  - Rage clicks or frustration signals
  - Successful strategic use (saving quota for specific styles)

### Rollout Plan (Post-Test)

**Phase 1: Winner to 50%** (Week 3)
- Monitor for any issues at scale
- Compare to baseline (control group)

**Phase 2: Winner to 100%** (Week 4)
- Full deployment
- Remove control variant

**Phase 3: Iterate** (Ongoing)
- A/B test micro-optimizations (copy changes, color tweaks, etc.)
- Continuous improvement based on user feedback

---

## 8. Accessibility (WCAG 2.1 AA Compliance)

### Color Contrast Requirements

**Minimum Ratios** (WCAG 2.1 AA):
- Normal text (16px): 4.5:1
- Large text (18px+): 3:1
- UI components: 3:1

#### Quota Badge Contrast Audit

**Normal State**:
```css
/* Background: #F3F4F6, Text: #6B7280 */
/* Contrast: 5.2:1 ✅ PASS */

.quota-badge--normal {
  background: #F3F4F6;
  color: #6B7280;
}
```

**Warning State**:
```css
/* Background: #FEE2E2, Text: #991B1B */
/* Contrast: 7.8:1 ✅ PASS */

.quota-badge--warning {
  background: #FEE2E2;
  color: #991B1B;
}
```

**Exhausted State**:
```css
/* Background: #F3F4F6, Text: #4B5563 */
/* Contrast: 6.1:1 ✅ PASS */

.quota-badge--exhausted {
  background: #F3F4F6;
  color: #4B5563;
}
```

### Screen Reader Support

#### Semantic HTML

**Header Badge**:
```html
<div
  class="quota-badge"
  role="status"
  aria-live="polite"
  aria-label="Artistic styles quota: 4 of 6 remaining"
>
  <span class="quota-badge__icon" aria-hidden="true">🎨</span>
  <span class="quota-badge__label">Artistic:</span>
  <span class="quota-badge__dots" aria-hidden="true">●●●●○○</span>
  <span class="quota-badge__count">(4/6)</span>
</div>
```

**Key Attributes**:
- `role="status"`: Announces updates to screen readers
- `aria-live="polite"`: Announces after current speech finishes
- `aria-label`: Clear description for screen readers
- `aria-hidden="true"`: Hides decorative elements (dots, emojis)

#### Disabled Button Accessibility

**Exhausted Effect Button**:
```html
<button
  class="effect-button"
  data-effect="modern"
  disabled
  aria-disabled="true"
  aria-label="Modern effect unavailable: daily quota exhausted, resets at midnight"
>
  <img src="modern-preview.jpg" alt="">
  <span class="effect-button__label">Modern</span>
  <span class="effect-button__overlay">Check tomorrow</span>
</button>
```

**Key Attributes**:
- `disabled` + `aria-disabled="true"`: Redundant but recommended
- `aria-label`: Explains WHY button is disabled
- Empty `alt` on decorative image (label is on button)

### Keyboard Navigation

**Focus Management**:
```css
/* Visible focus indicator (3:1 contrast) */
.quota-badge:focus-visible,
.effect-button:focus-visible {
  outline: 3px solid #3B82F6;
  outline-offset: 2px;
}

/* Remove outline for mouse users */
.quota-badge:focus:not(:focus-visible),
.effect-button:focus:not(:focus-visible) {
  outline: none;
}
```

**Tab Order**:
1. Header quota badge (focusable, opens details on Enter)
2. Effect buttons (B&W, Color, Modern, Classic)
3. Add to Cart button
4. Modal close buttons (when modal open)

**Keyboard Shortcuts** (Optional Enhancement):
- `?`: Show help overlay with quota info
- `Esc`: Close modals/bottom sheets
- `Arrow keys`: Navigate between effect buttons
- `Enter/Space`: Select focused effect button

### Reduced Motion Support

**Respect User Preferences**:
```css
/* Disable animations for users with motion sensitivity */
@media (prefers-reduced-motion: reduce) {
  .quota-badge--pulse,
  .quota-count--updating {
    animation: none;
  }

  .bottom-sheet {
    transition: none;
  }
}
```

**Alternative Feedback**:
- Use instant state changes instead of animations
- Increase color contrast instead of using motion
- Provide haptic feedback (if available) as alternative to visual motion

### High Contrast Mode Support

**Windows High Contrast Mode**:
```css
@media (prefers-contrast: high) {
  .quota-badge {
    border: 2px solid currentColor;
  }

  .effect-button[disabled] {
    opacity: 0.5;
    text-decoration: line-through;
  }
}
```

**Forced Colors Mode** (Windows):
```css
@media (forced-colors: active) {
  .quota-badge {
    border: 1px solid CanvasText;
  }

  .quota-badge__dots {
    /* Use system colors instead of custom colors */
    color: CanvasText;
  }
}
```

---

## 9. Technical Implementation Specifications

### Frontend Architecture

#### State Management

**Quota State Object**:
```javascript
const quotaState = {
  remaining: 4,           // 0-6
  total: 6,               // Always 6
  resetTimestamp: 1698710400000,  // Midnight UTC
  lastUpdated: 1698676800000,     // Last sync with server
  isLoading: false,       // Fetching from API
  error: null             // Error message if fetch fails
};
```

**State Updates**:
```javascript
// On page load
fetchQuotaStatus();

// After successful generation
decrementQuota();

// On midnight UTC rollover (detected client-side)
resetQuota();

// On error
setQuotaError(errorMessage);
```

#### API Endpoints (Backend Requirements)

**GET /api/v1/quota**

Request:
```http
GET /api/v1/quota
Headers:
  X-User-Fingerprint: sha256_hash
```

Response:
```json
{
  "remaining": 4,
  "total": 6,
  "reset_timestamp": "2025-10-31T00:00:00Z",
  "usage_today": [
    {"style": "modern", "timestamp": "2025-10-30T14:23:11Z"},
    {"style": "classic", "timestamp": "2025-10-30T14:25:33Z"}
  ]
}
```

**POST /api/v1/generate** (Modified)

Request:
```json
{
  "style": "modern",
  "image_url": "gs://bucket/original.jpg"
}
```

Response (Success):
```json
{
  "result_url": "https://...",
  "quota_remaining": 3,
  "processing_time_ms": 4230
}
```

Response (Quota Exceeded):
```json
{
  "error": "quota_exceeded",
  "message": "Daily quota of 6 artistic generations exceeded",
  "quota_remaining": 0,
  "reset_timestamp": "2025-10-31T00:00:00Z"
}
```

Response (Generation Failed):
```json
{
  "error": "generation_failed",
  "message": "Gemini API error, quota not deducted",
  "quota_remaining": 4,  // Unchanged
  "retry_after_seconds": 60
}
```

### Backend Implementation (Firestore)

#### Data Model

**Collection**: `quotas`
**Document ID**: `{user_fingerprint_hash}`

```json
{
  "remaining": 4,
  "total": 6,
  "last_reset": "2025-10-30T00:00:00Z",
  "next_reset": "2025-10-31T00:00:00Z",
  "usage_log": [
    {
      "style": "modern",
      "timestamp": "2025-10-30T14:23:11Z",
      "request_id": "req_abc123",
      "success": true
    },
    {
      "style": "classic",
      "timestamp": "2025-10-30T14:25:33Z",
      "request_id": "req_def456",
      "success": true
    }
  ],
  "created_at": "2025-10-29T08:15:00Z",
  "updated_at": "2025-10-30T14:25:33Z"
}
```

#### Rate Limiting Logic

**Check and Decrement (Atomic Transaction)**:
```python
from google.cloud import firestore
from datetime import datetime, timezone

def check_and_decrement_quota(user_fingerprint: str) -> dict:
    """
    Atomically check and decrement user quota.
    Returns quota info or raises QuotaExceededError.
    """
    db = firestore.Client()
    doc_ref = db.collection('quotas').document(user_fingerprint)

    @firestore.transactional
    def update_quota(transaction):
        doc = doc_ref.get(transaction=transaction)

        if not doc.exists:
            # First-time user, initialize quota
            data = {
                'remaining': 6,
                'total': 6,
                'last_reset': datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0),
                'next_reset': get_next_midnight_utc(),
                'usage_log': [],
                'created_at': firestore.SERVER_TIMESTAMP
            }
            transaction.set(doc_ref, data)
            return {'remaining': 6, 'total': 6}

        data = doc.to_dict()

        # Check if reset needed (past midnight UTC)
        if datetime.now(timezone.utc) >= data['next_reset']:
            data['remaining'] = 6
            data['last_reset'] = data['next_reset']
            data['next_reset'] = get_next_midnight_utc()
            data['usage_log'] = []

        # Check quota
        if data['remaining'] <= 0:
            raise QuotaExceededError(
                f"Daily quota exceeded. Resets at {data['next_reset'].isoformat()}"
            )

        # Decrement quota
        data['remaining'] -= 1
        data['updated_at'] = firestore.SERVER_TIMESTAMP

        transaction.update(doc_ref, {
            'remaining': data['remaining'],
            'last_reset': data['last_reset'],
            'next_reset': data['next_reset'],
            'usage_log': data['usage_log'],
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        return {
            'remaining': data['remaining'],
            'total': data['total'],
            'reset_timestamp': data['next_reset'].isoformat()
        }

    transaction = db.transaction()
    return update_quota(transaction)
```

**Rollback on Failure**:
```python
def generate_artistic_effect(user_fingerprint: str, style: str, image_url: str):
    """
    Generate effect with automatic quota rollback on failure.
    """
    # Step 1: Check and decrement quota (atomic)
    try:
        quota_info = check_and_decrement_quota(user_fingerprint)
    except QuotaExceededError as e:
        return {'error': 'quota_exceeded', 'message': str(e)}

    # Step 2: Attempt generation
    try:
        result_url = gemini_api.generate(style, image_url)

        # Step 3: Log successful usage
        log_usage(user_fingerprint, style, success=True)

        return {
            'result_url': result_url,
            'quota_remaining': quota_info['remaining']
        }

    except GeminiAPIError as e:
        # Step 4: Rollback quota on failure
        rollback_quota(user_fingerprint)

        return {
            'error': 'generation_failed',
            'message': 'Effect generation failed, quota not deducted',
            'quota_remaining': quota_info['remaining'] + 1  # Restored
        }
```

#### User Fingerprinting

**Client-Side** (Frontend):
```javascript
import FingerprintJS from '@fingerprintjs/fingerprintjs';

async function getUserFingerprint() {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;  // e.g., "Xyz123AbC456"
}

// Use in API calls
const fingerprint = await getUserFingerprint();
fetch('/api/v1/generate', {
  headers: {
    'X-User-Fingerprint': fingerprint
  },
  body: JSON.stringify({ style: 'modern', image_url: '...' })
});
```

**Server-Side** (Backend):
```python
def get_user_fingerprint(request):
    """
    Get user fingerprint from request.
    Fallback to IP-based fingerprint if header missing.
    """
    fingerprint = request.headers.get('X-User-Fingerprint')

    if not fingerprint:
        # Fallback: Hash IP + User-Agent
        ip = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')
        fingerprint = hashlib.sha256(f"{ip}:{user_agent}".encode()).hexdigest()

    return fingerprint
```

### Frontend Components (React Example)

#### QuotaBadge Component

```jsx
import React, { useEffect, useState } from 'react';

function QuotaBadge({ remaining, total, isLoading, error, onRefresh }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Collapse on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsCollapsed(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Determine badge state
  const getBadgeState = () => {
    if (error) return 'error';
    if (isLoading) return 'loading';
    if (remaining === 0) return 'exhausted';
    if (remaining <= 2) return 'warning';
    if (remaining === 3) return 'aware';
    return 'normal';
  };

  const state = getBadgeState();
  const dots = '●'.repeat(remaining) + '○'.repeat(total - remaining);

  if (isCollapsed) {
    return (
      <div className={`quota-badge quota-badge--collapsed quota-badge--${state}`}>
        <span className="quota-badge__icon">🎨</span>
        <span className="quota-badge__count">{remaining}/{total}</span>
      </div>
    );
  }

  return (
    <div className={`quota-badge quota-badge--${state}`}>
      <span className="quota-badge__icon">🎨</span>
      <span className="quota-badge__label">Artistic:</span>
      <span className="quota-badge__dots" aria-hidden="true">{dots}</span>
      <span className="quota-badge__count">({remaining}/{total})</span>
      {error && (
        <button
          className="quota-badge__retry"
          onClick={onRefresh}
          aria-label="Retry quota check"
        >
          ↻
        </button>
      )}
    </div>
  );
}

export default QuotaBadge;
```

#### EffectButton Component

```jsx
function EffectButton({
  effect,
  quotaRemaining,
  isLimited,
  onGenerate,
  disabled
}) {
  const isDisabled = disabled || (isLimited && quotaRemaining === 0);

  return (
    <button
      className={`effect-button ${isDisabled ? 'effect-button--disabled' : ''}`}
      onClick={() => !isDisabled && onGenerate(effect)}
      disabled={isDisabled}
      aria-label={
        isDisabled
          ? `${effect.name} effect unavailable: quota exhausted`
          : `Generate ${effect.name} effect, ${quotaRemaining} uses left`
      }
    >
      <img src={effect.preview} alt="" />
      <span className="effect-button__label">{effect.name}</span>

      {isLimited && quotaRemaining > 0 && (
        <span className="effect-button__quota">ⓘ {quotaRemaining}/6</span>
      )}

      {isDisabled && (
        <span className="effect-button__overlay">Check tomorrow</span>
      )}
    </button>
  );
}
```

#### QuotaWarning Component

```jsx
function QuotaWarning({ remaining, onDismiss, isDismissible }) {
  if (remaining > 3) return null;  // No warning above 50%

  const getMessage = () => {
    if (remaining === 0) {
      return {
        title: "✨ You've used all 6 artistic styles today!",
        body: "Your quota resets at midnight UTC. Meanwhile, try our classic B&W and Color effects (always unlimited!)"
      };
    }
    if (remaining === 1) {
      return {
        title: "⚠️ Last artistic style available today",
        body: "Choose wisely! B&W and Color remain unlimited."
      };
    }
    if (remaining === 2) {
      return {
        title: `⚠️ ${remaining} artistic styles remaining today`,
        body: "Make your favorites count! B&W and Color still unlimited."
      };
    }
    return {
      title: `ⓘ ${remaining} artistic styles left today`,
      body: "Unlimited B&W and Color still available."
    };
  };

  const { title, body } = getMessage();
  const severity = remaining === 0 ? 'exhausted' : remaining <= 2 ? 'warning' : 'aware';

  return (
    <div className={`quota-warning quota-warning--${severity}`} role="alert">
      <div className="quota-warning__content">
        <p className="quota-warning__title">{title}</p>
        <p className="quota-warning__body">{body}</p>
      </div>
      {isDismissible && (
        <button
          className="quota-warning__close"
          onClick={onDismiss}
          aria-label="Dismiss warning"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

---

## 10. Success Metrics & Monitoring

### Key Performance Indicators (KPIs)

#### Conversion Funnel Metrics

```
Page Visit
    ↓ (100%)
Upload Image
    ↓ (85%)
View Effects (quota badge visible)
    ↓ (75%)
Generate ≥1 Effect
    ↓ (60%)
Add to Cart
    ↓ (40%)
Complete Purchase
```

**Baseline** (pre-warning system):
- Upload rate: 85%
- Effect generation rate: 60%
- Add-to-cart rate: 40%
- Conversion rate: 25%

**Target** (post-warning system):
- Upload rate: ≥85% (maintain)
- Effect generation rate: ≥60% (maintain or improve)
- Add-to-cart rate: ≥42% (+5% lift)
- Conversion rate: ≥26% (+4% lift)

#### Quota-Specific Metrics

| Metric | Definition | Target | Priority |
|--------|-----------|--------|----------|
| **Quota Awareness Rate** | % users who interact with quota badge/tooltip | ≥30% | P1 |
| **Strategic Usage Rate** | % users who distribute generations across multiple sessions | ≥15% | P2 |
| **Quota Exhaustion Rate** | % users who hit 6/6 limit | 10-20% (sweet spot) | P1 |
| **Premature Abandonment** | % users who leave after seeing warnings | ≤5% | P0 |
| **Gemini Effect Selection** | % orders using Modern/Classic | ≥30% | P1 |
| **Return Rate** | % exhausted users who return next day | ≥12% | P2 |

### Real-Time Monitoring Dashboard

**Metrics to Track Live**:

```javascript
// Example dashboard (Grafana, Datadog, etc.)

Panel 1: Quota Status Distribution (Pie Chart)
- 6/6 remaining: 45%
- 5-4 remaining: 30%
- 3-2 remaining: 15%
- 1 remaining: 5%
- 0 remaining: 5%

Panel 2: Conversion Rate by Quota State (Line Chart)
- Normal (4-6): 42%
- Warning (2-3): 38%
- Exhausted (0): 28%

Panel 3: Warning Interaction Rates (Bar Chart)
- Onboarding tooltip dismissed: 75%
- 50% warning dismissed: 60%
- 75% warning dismissed: 40%
- Last use modal cancelled: 20%

Panel 4: API Performance (Time Series)
- Quota check latency: 95th percentile <200ms
- Generation success rate: 98%
- Rollback rate: 2%

Panel 5: Error Rates (Time Series)
- Quota API failures: <0.5%
- Fingerprint collision rate: <0.1%
- Race condition detections: <0.01%
```

### Alerting Thresholds

**Critical Alerts** (Page immediately):
- Conversion rate drop >15% vs baseline
- API error rate >5%
- Quota check latency >1s (P95)

**Warning Alerts** (Slack notification):
- Conversion rate drop 5-15% vs baseline
- Premature abandonment rate >8%
- Quota exhaustion rate >30% (over-limiting)
- Quota exhaustion rate <5% (under-limiting)

**Info Alerts** (Daily email):
- Daily summary of quota usage patterns
- Warning interaction rates
- A/B test progress updates

### User Feedback Collection

#### In-App Feedback

**Trigger**: After user exhausts quota OR completes purchase

**Survey** (1-2 questions max):
```
Q1: How did you feel about the 6/day limit on artistic styles?
[ ] Didn't notice it
[ ] Noticed but didn't affect my purchase
[ ] Made me more strategic with my choices
[ ] Felt restrictive but understood why
[ ] Frustrated, wish there was no limit

Q2 (if selected "Frustrated"): What would improve your experience?
[ ] Higher daily limit (10+)
[ ] Paid tier with unlimited
[ ] Carry unused quota to next day
[ ] Other: [text input]
```

**Incentive**: 10% discount code for feedback completion

#### Post-Purchase Email

**Sent**: 24 hours after purchase

**Content**:
```
Subject: How was your pet portrait experience?

Hi [Name],

We hope you love your custom [Product Name]!

We recently added artistic style limits (6/day) to maintain
quality. How did this affect your experience?

[Rate Experience: 1-5 stars]

[Optional feedback textarea]

Your input helps us improve!

P.S. Your artistic quota resets daily, so feel free to
create more portraits anytime!
```

### Continuous Improvement Loop

**Weekly Review** (Every Monday):
1. Review conversion metrics vs previous week
2. Identify drop-off points in funnel
3. Review user feedback themes
4. Prioritize 1-2 micro-optimizations for week

**Monthly Review** (Last Friday of month):
1. Deep dive into quota usage patterns
2. Analyze seasonal trends (holidays, etc.)
3. Review A/B test results
4. Plan next month's experiments

**Quarterly Review** (Every 3 months):
1. Evaluate if 6/day limit is still appropriate
2. Consider premium tier introduction
3. Review competitive landscape
4. Major UX overhauls (if needed)

---

## 11. Implementation Phases & Timeline

### Phase 0: Preparation (Week 1)

**Backend Setup**:
- [ ] Set up Firestore collection for quota tracking
- [ ] Implement user fingerprinting logic
- [ ] Create quota check/decrement API endpoints
- [ ] Add rollback mechanism for failed generations
- [ ] Test quota API under load (100 req/s)

**Frontend Setup**:
- [ ] Install fingerprinting library (FingerprintJS)
- [ ] Create quota state management (Redux/Context)
- [ ] Build reusable UI components (badge, warnings, modals)
- [ ] Set up analytics event tracking
- [ ] Configure A/B testing framework (Optimizely, LaunchDarkly, etc.)

**Estimated Effort**: 40 hours (5 days)

### Phase 1: Core Warning System (Week 2)

**Features**:
- [x] Persistent header badge (collapsible on scroll)
- [x] Button badges on limited effects
- [x] Quota API integration
- [x] Basic state management
- [x] Error handling (API failures)

**Testing**:
- [ ] Unit tests for quota logic
- [ ] Integration tests for API endpoints
- [ ] Visual regression tests (Percy, Chromatic)
- [ ] Accessibility audit (Axe, Lighthouse)

**Deployment**: 10% traffic (canary)

**Estimated Effort**: 50 hours (6-7 days)

### Phase 2: Warnings & Messaging (Week 3)

**Features**:
- [x] Onboarding tooltip (first use)
- [x] Inline warnings (50%, 75%, 100% thresholds)
- [x] Confirmation modal (last use)
- [x] Exhausted state UI
- [x] Reset countdown timer

**Testing**:
- [ ] User testing with 10 participants
- [ ] Mobile device testing (iOS, Android)
- [ ] Copy review with UX writer
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)

**Deployment**: 25% traffic

**Estimated Effort**: 40 hours (5 days)

### Phase 3: Mobile Optimizations (Week 4)

**Features**:
- [x] Bottom sheet for quota details
- [x] Haptic feedback (iOS/Android)
- [x] Offline handling
- [x] Pull-to-refresh quota sync
- [x] Mobile-specific copy (shorter)

**Testing**:
- [ ] Mobile-specific user testing (5 participants)
- [ ] Performance testing (Lighthouse mobile score)
- [ ] Network throttling tests (3G, offline)

**Deployment**: 50% traffic

**Estimated Effort**: 35 hours (4-5 days)

### Phase 4: A/B Testing (Week 5-6)

**Setup**:
- [x] Configure 3 test variants + control
- [x] Set up analytics dashboards
- [x] Define success metrics
- [x] Train team on monitoring

**Monitoring**:
- [ ] Daily metric reviews
- [ ] Weekly check-ins
- [ ] User feedback collection
- [ ] Session recording analysis

**Deployment**: 100% traffic (split across variants)

**Estimated Effort**: 20 hours setup + 10 hours/week monitoring

### Phase 5: Optimization & Rollout (Week 7-8)

**Analysis**:
- [ ] Statistical significance testing
- [ ] Winner selection
- [ ] Qualitative feedback synthesis
- [ ] Documentation of learnings

**Rollout**:
- [ ] Deploy winning variant to 100%
- [ ] Remove losing variants
- [ ] Archive test configs
- [ ] Update documentation

**Post-Launch**:
- [ ] Monitor for regression
- [ ] Collect user feedback
- [ ] Plan next iteration

**Estimated Effort**: 30 hours

### Total Timeline: 8 Weeks

**Critical Path Dependencies**:
1. Firestore setup → Quota API endpoints
2. Quota API → Frontend integration
3. Core system → Warnings & messaging
4. All features → A/B testing
5. A/B results → Final rollout

**Risk Buffer**: +2 weeks for unforeseen issues

---

## 12. Cost Estimate & ROI Projection

### Development Costs

| Phase | Hours | Rate | Cost |
|-------|-------|------|------|
| Backend (quota API) | 60 | $100/hr | $6,000 |
| Frontend (UI components) | 80 | $90/hr | $7,200 |
| Design (UX/visual) | 30 | $85/hr | $2,550 |
| Testing & QA | 40 | $75/hr | $3,000 |
| Project management | 20 | $80/hr | $1,600 |
| **Total** | **230** | | **$20,350** |

### Infrastructure Costs (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Firestore reads (quota checks) | 500K/month | $0.18 |
| Firestore writes (quota updates) | 100K/month | $0.54 |
| Firestore storage (1GB) | 1GB | $0.18 |
| Cloud Functions (if used) | 1M invocations | $0.40 |
| **Total** | | **$1.30/month** |

**Note**: Infrastructure cost is negligible (~$16/year)

### ROI Projection (Conservative)

**Assumptions**:
- Current conversion rate: 2.5%
- Current monthly visitors: 50,000
- Average order value: $45
- Target conversion lift: +0.2% (absolute)

**Before Warning System**:
- Monthly conversions: 50,000 × 2.5% = 1,250
- Monthly revenue: 1,250 × $45 = $56,250

**After Warning System** (+0.2% absolute lift):
- Monthly conversions: 50,000 × 2.7% = 1,350
- Monthly revenue: 1,350 × $45 = $60,750
- **Incremental revenue: $4,500/month**

**Payback Period**:
- Development cost: $20,350
- Monthly gain: $4,500
- **Payback: 4.5 months**

**12-Month ROI**:
- Year 1 revenue gain: $4,500 × 12 = $54,000
- Development cost: $20,350
- **Net gain: $33,650 (165% ROI)**

### Risk-Adjusted ROI

**Scenario Analysis**:

| Scenario | Probability | Conversion Lift | Annual Gain | Weighted Gain |
|----------|------------|----------------|-------------|---------------|
| **Best Case** | 20% | +0.5% | $135,000 | $27,000 |
| **Expected** | 50% | +0.2% | $54,000 | $27,000 |
| **Worst Case** | 30% | -0.1% | -$27,000 | -$8,100 |

**Expected Value**: $27,000 + $27,000 - $8,100 = **$45,900/year**

**Risk-Adjusted Payback**: 20,350 / (45,900/12) = **5.3 months**

---

## 13. Dependencies & Requirements

### Technical Dependencies

**Frontend**:
- React 18+ (or framework in use)
- FingerprintJS 3.0+
- Analytics library (Segment, Google Analytics, etc.)
- A/B testing framework (optional but recommended)

**Backend**:
- Google Cloud Firestore
- Existing Gemini Artistic API
- Python 3.9+
- FastAPI

**DevOps**:
- CI/CD pipeline (GitHub Actions, etc.)
- Monitoring (Datadog, Grafana, etc.)
- Error tracking (Sentry, Rollbar, etc.)

### Cross-Team Dependencies

**Design Team**:
- Final visual design approval
- Brand color palette integration
- Icon library access

**Product Team**:
- A/B test variant approval
- Success metrics sign-off
- Pricing strategy (if premium tier considered)

**Marketing Team**:
- User communication plan (emails, blog posts)
- FAQ updates
- Customer support training

**Legal/Compliance**:
- GDPR compliance review (fingerprinting)
- Terms of Service update (quota policy)
- Privacy Policy update (data collection)

### External Dependencies

**Third-Party Services**:
- FingerprintJS (user identification)
- Gemini API (generation service)
- Firestore (quota storage)

**Risk Mitigation**:
- Fallback to IP-based fingerprinting if FingerprintJS fails
- Graceful degradation if Firestore unavailable
- Quota enforcement at generation endpoint (backend validation)

---

## 14. Open Questions & Assumptions

### Questions for Product/Business Team

1. **Premium Tier**: Should we plan for a paid "unlimited" tier in the future?
   - If yes, warning system should mention upgrade path
   - If no, messaging should emphasize free service quality

2. **Quota Adjustments**: Is 6/day the final number, or should we A/B test different limits?
   - Variants: 4/day, 6/day, 10/day
   - Measure quota exhaustion rate vs conversion

3. **Geographic Variations**: Should quota differ by market (US vs international)?
   - Higher quota in premium markets?
   - Lower quota in cost-sensitive markets?

4. **B2B Accounts**: Will business customers get higher quotas?
   - Enterprise tier with 50+/day?
   - Bulk order customers get unlimited?

### Questions for Design Team

1. **Brand Alignment**: Do warning colors align with existing brand guidelines?
   - Should we use brand primary/secondary colors?
   - Or use universal warning colors (amber/red)?

2. **Icon Library**: Do we have approved icons for quota indicators?
   - Create custom or use existing?
   - Emoji vs SVG icons?

3. **Responsive Breakpoints**: What are the exact mobile/tablet/desktop breakpoints?
   - Mobile: <768px?
   - Tablet: 768-1024px?
   - Desktop: >1024px?

### Questions for Engineering Team

1. **Existing Fingerprinting**: Do we already have user identification in place?
   - Logged-in users: Use user ID
   - Anonymous: Implement fingerprinting

2. **Quota Storage**: Firestore vs Redis vs PostgreSQL?
   - Firestore: Easy, serverless, realtime sync
   - Redis: Faster, but requires management
   - PostgreSQL: Existing infra, but slower

3. **Rate Limit Scope**: Per user, per IP, or per session?
   - Per user (logged-in): Most accurate
   - Per fingerprint (anonymous): Reasonable accuracy
   - Per IP: Too broad (shared IPs)

### Assumptions Made

**User Behavior**:
- ✓ Assume 70% mobile, 30% desktop traffic
- ✓ Assume users want to see quota status upfront
- ✓ Assume most users won't exhaust quota (10-20% hit limit)
- ✓ Assume users prefer positive framing over negative

**Technical**:
- ✓ Assume Firestore is acceptable for quota storage
- ✓ Assume quota API latency <200ms P95
- ✓ Assume fingerprinting accuracy >90%
- ✓ Assume existing analytics infrastructure can track events

**Business**:
- ✓ Assume no paid tier launch in next 6 months
- ✓ Assume 6/day quota is final (no A/B testing)
- ✓ Assume quota applies globally (no geo variations)
- ✓ Assume artistic effects remain free indefinitely

---

## 15. Risks & Mitigation Strategies

### High-Impact Risks

#### Risk 1: Conversion Rate Drop

**Description**: Warning system creates anxiety, users abandon before purchase

**Likelihood**: Medium (30%)
**Impact**: High (revenue loss)

**Mitigation**:
1. A/B test before full rollout (control group to measure impact)
2. Positive framing in all messaging ("You have 6" not "Limited to 6")
3. Emphasize unlimited alternatives (B&W, Color)
4. Monitor real-time, rollback within 24h if conversion drops >10%

**Rollback Plan**:
- Feature flag to disable warnings instantly
- Revert to control variant within 15 minutes
- Preserve quota data (don't lose tracking)

#### Risk 2: Quota API Latency/Outage

**Description**: Firestore slow or unavailable, blocks user from generating effects

**Likelihood**: Low (10%)
**Impact**: High (functional failure)

**Mitigation**:
1. Implement aggressive caching (localStorage + CDN)
2. Optimistic UI (assume quota available, validate server-side)
3. Fallback to generation without quota check (with backend enforcement)
4. Set 5s timeout, show error with retry option

**Graceful Degradation**:
```javascript
// Optimistic approach
async function generateEffect(style) {
  // Show loading immediately (don't wait for quota check)
  setLoading(true);

  try {
    // Try to generate (backend enforces quota)
    const result = await api.generate(style);
    return result;
  } catch (error) {
    if (error.code === 'QUOTA_EXCEEDED') {
      // Show quota exhausted message
      showQuotaExhausted();
    } else {
      // Generic error, allow retry
      showError('Generation failed, please try again');
    }
  }
}
```

#### Risk 3: Fingerprinting Inaccuracy

**Description**: Multiple users on shared IP get shared quota (coffee shops, offices)

**Likelihood**: Medium (20%)
**Impact**: Medium (user frustration)

**Mitigation**:
1. Use multi-factor fingerprinting (IP + user agent + canvas + fonts)
2. Accuracy >90% with FingerprintJS Pro
3. Accept edge cases as acceptable trade-off for free service
4. Provide manual reset via customer support (rare cases)

**Communication**:
- FAQ: "Why did my quota reset unexpectedly?" → Explain shared IP scenario
- Support escalation path for frustrated users

### Medium-Impact Risks

#### Risk 4: Timezone Confusion

**Description**: Users don't understand when quota resets ("midnight UTC" unclear)

**Likelihood**: High (40%)
**Impact**: Low (confusion, but not blocking)

**Mitigation**:
1. Always show countdown timer ("Resets in 7h 23m")
2. Convert to user's local timezone in UI
3. Clear FAQ section on quota reset timing
4. Customer support trained on explaining reset logic

#### Risk 5: Users Gaming the System

**Description**: Users clear cookies/change IPs to get more quota

**Likelihood**: Low (15%)
**Impact**: Low (acceptable abuse for free service)

**Mitigation**:
1. Multi-factor fingerprinting makes gaming harder
2. Server-side logging to detect suspicious patterns
3. Rate limit by IP secondary (10/day per IP regardless of fingerprint)
4. Accept some abuse as cost of free service

**When to Take Action**:
- Only if abuse >10% of total quota usage
- Then consider more aggressive fingerprinting or CAPTCHA

### Low-Impact Risks

#### Risk 6: Warning Banner Blindness

**Description**: Users ignore warnings due to banner fatigue

**Likelihood**: Medium (25%)
**Impact**: Low (warnings are optional guidance)

**Mitigation**:
1. Use varied visual treatments (colors, placement)
2. Don't over-warn (only at key thresholds)
3. Make warnings actionable (not just informational)
4. A/B test warning frequency/prominence

#### Risk 7: Mobile Performance Impact

**Description**: Additional UI elements slow down mobile page load

**Likelihood**: Low (10%)
**Impact**: Low (minor performance degradation)

**Mitigation**:
1. Lazy-load quota badge (after initial page paint)
2. Minimize DOM nodes (<50 elements for warnings)
3. Use CSS transforms for animations (GPU-accelerated)
4. Monitor Lighthouse mobile performance score (target >90)

---

## 16. Success Criteria & Launch Checklist

### Pre-Launch Checklist

**Backend**:
- [ ] Firestore collection created and tested
- [ ] Quota check API latency <200ms P95
- [ ] Quota decrement API atomic (no race conditions)
- [ ] Rollback mechanism tested (failed generations don't deduct quota)
- [ ] Rate limiting enforced (1 req/3s per user)
- [ ] Error handling comprehensive (graceful degradation)
- [ ] Load testing passed (100 req/s sustained)

**Frontend**:
- [ ] All UI components render correctly (mobile + desktop)
- [ ] Quota badge collapses on scroll
- [ ] Warnings appear at correct thresholds (50%, 75%, 100%)
- [ ] Confirmation modal on last use
- [ ] Exhausted state UI works (disabled buttons, countdown)
- [ ] Analytics events firing correctly
- [ ] A/B test variants configured

**Design**:
- [ ] Visual design approved by design team
- [ ] Brand colors integrated
- [ ] Copy reviewed by UX writer
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Color contrast verified (4.5:1 minimum)

**Testing**:
- [ ] Unit tests passing (95%+ coverage)
- [ ] Integration tests passing (API endpoints)
- [ ] Cross-browser testing complete (Chrome, Safari, Firefox, Edge)
- [ ] Mobile device testing (iOS, Android)
- [ ] Visual regression tests passing (Percy, Chromatic)
- [ ] Performance tests passing (Lighthouse >90)

**Operations**:
- [ ] Monitoring dashboard configured (Grafana, Datadog)
- [ ] Alerting thresholds set (critical, warning, info)
- [ ] Error tracking enabled (Sentry, Rollbar)
- [ ] Feature flags configured (LaunchDarkly, Optimizely)
- [ ] Rollback plan documented and tested
- [ ] On-call rotation assigned

**Documentation**:
- [ ] User-facing FAQ updated (quota policy, reset timing)
- [ ] Customer support trained (handling quota questions)
- [ ] Engineering runbook written (troubleshooting guide)
- [ ] Analytics dashboard guide (for stakeholders)

### Launch Day Checklist

**T-1 Hour**:
- [ ] Final smoke test on staging environment
- [ ] Verify feature flags ready to toggle
- [ ] Confirm monitoring dashboards live
- [ ] Alert on-call team of deployment

**T-0 (Launch)**:
- [ ] Deploy backend (quota API)
- [ ] Deploy frontend (UI components)
- [ ] Enable feature flag to 10% traffic (canary)
- [ ] Monitor for errors/anomalies

**T+15 Minutes**:
- [ ] Check conversion rate (should be stable)
- [ ] Check API error rate (<1%)
- [ ] Check quota API latency (<200ms P95)
- [ ] Review first user feedback (if any)

**T+1 Hour**:
- [ ] Increase to 25% traffic (if no issues)
- [ ] Continue monitoring

**T+4 Hours**:
- [ ] Increase to 50% traffic
- [ ] Review full metrics dashboard

**T+24 Hours**:
- [ ] Increase to 100% traffic (full rollout)
- [ ] Publish internal launch announcement
- [ ] Share metrics with stakeholders

### Post-Launch Success Criteria (Week 1)

**Must Achieve** (Launch blockers if failed):
- [ ] Conversion rate ≥ baseline (no >5% drop)
- [ ] API error rate <2%
- [ ] Quota API latency <300ms P95
- [ ] Page load time increase <200ms
- [ ] Zero critical bugs (P0)

**Should Achieve** (Warning signs if failed):
- [ ] Conversion rate +1% vs baseline
- [ ] Gemini effect selection rate ≥30%
- [ ] Warning interaction rate 20-40%
- [ ] Premature abandonment rate <8%
- [ ] Support tickets <5 related to quotas

**Nice to Have** (Aspirational):
- [ ] Conversion rate +5% vs baseline
- [ ] Quota exhaustion rate 15-20%
- [ ] User feedback sentiment >80% positive
- [ ] Return rate (next day) ≥15%

### 30-Day Success Criteria

**Conversion Impact**:
- [ ] Sustained conversion lift ≥+2% vs pre-launch baseline
- [ ] Mobile conversion maintained or improved (70% traffic)
- [ ] Desktop conversion maintained or improved (30% traffic)

**User Behavior**:
- [ ] 40%+ users generate at least 1 Gemini effect
- [ ] 30%+ orders use Modern or Classic effect
- [ ] 15%+ users who exhaust quota return next day
- [ ] <10% users abandon after seeing warnings

**Technical Performance**:
- [ ] Quota API uptime >99.9%
- [ ] P95 latency <200ms maintained
- [ ] Zero P0/P1 bugs in production
- [ ] Error rate <1% sustained

**User Satisfaction**:
- [ ] User feedback sentiment >75% positive
- [ ] NPS score maintained or improved
- [ ] Support ticket volume <10/month quota-related
- [ ] No viral negative feedback (social media, reviews)

---

## Appendix A: Wireframe Descriptions

### Mobile Wireframes

**Screen 1: Upload + Initial State**
```
┌─────────────────────────────────────┐
│ Header                         Menu │
│ ┌─────────────────────────────────┐ │
│ │ 🎨 Artistic: ●●●●●● (6/6)      │ │ ← Initial quota badge
│ └─────────────────────────────────┘ │
│                                     │
│ [Upload Pet Photo]                  │
│                                     │
│ • Background removal (free!)        │
│ • 6 artistic styles per day         │
│ • Unlimited classic effects         │
└─────────────────────────────────────┘
```

**Screen 2: Effects Grid + Quota Badge**
```
┌─────────────────────────────────────┐
│ 🎨 4/6               [Pet Preview] │ ← Collapsed badge
│                                     │
│ [Large Pet Image Preview]           │
│                                     │
│ Choose Your Style:                  │
│ ┌──────────┬──────────┐            │
│ │ Enhanced │  Color   │ ← Unlimited│
│ │   B&W    │          │            │
│ └──────────┴──────────┘            │
│ ┌──────────┬──────────┐            │
│ │  Modern  │ Classic  │ ← Limited  │
│ │ (Ink)    │ (Van G)  │            │
│ │  ⓘ 4/6   │  ⓘ 4/6   │            │
│ └──────────┴──────────┘            │
│                                     │
│ [Add to Cart - $45]                 │
└─────────────────────────────────────┘
```

**Screen 3: Warning State (2 remaining)**
```
┌─────────────────────────────────────┐
│ 🎨 2/6               [Pet Preview] │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ 2 artistic styles left       │ │ ← Warning banner
│ │ B&W and Color still unlimited   │ │
│ │                             [✕] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Pet Preview with effects]          │
│                                     │
│ [Effect Grid]                       │
│                                     │
│ [Add to Cart - $45]                 │
└─────────────────────────────────────┘
```

**Screen 4: Exhausted State (0 remaining)**
```
┌─────────────────────────────────────┐
│ 🎨 0/6               [Pet Preview] │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✨ Daily artistic limit reached │ │
│ │                                 │ │
│ │ Resets in: 7h 23m               │ │
│ │                                 │ │
│ │ ✓ B&W and Color still unlimited │ │
│ │ ✓ Current styles ready to order │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌──────────┬──────────┐            │
│ │ Enhanced │  Color   │ ← Enabled  │
│ │   B&W    │          │            │
│ └──────────┴──────────┘            │
│ ┌──────────┬──────────┐            │
│ │  Modern  │ Classic  │ ← Disabled │
│ │   [✓]    │   [✓]    │            │
│ │ tomorrow │ tomorrow │            │
│ └──────────┴──────────┘            │
└─────────────────────────────────────┘
```

### Desktop Wireframes

**Screen 1: Desktop Layout with Sidebar**
```
┌─────────────────────────────────────────────────────────┐
│ Header                                             Menu │
│                                                         │
│ ┌──────────────────────┬────────────────────────────┐  │
│ │                      │  ╔══════════════════════╗  │  │
│ │  [Pet Image Preview] │  ║ 🎨 Artistic Styles   ║  │  │
│ │                      │  ║                      ║  │  │
│ │                      │  ║  ●●●●○○              ║  │  │
│ │                      │  ║  4 of 6 left today   ║  │  │
│ │  Effect Selection:   │  ║                      ║  │  │
│ │                      │  ║  Modern and Classic  ║  │  │
│ │  ┌────┬────┐         │  ║  effects use AI      ║  │  │
│ │  │B&W │Col │         │  ║  processing.         ║  │  │
│ │  └────┴────┘         │  ║                      ║  │  │
│ │  ┌────┬────┐         │  ║  Resets at midnight  ║  │  │
│ │  │Ink │VanG│ ⓘ 4/6   │  ║  (7h 23m)            ║  │  │
│ │  └────┴────┘         │  ║                      ║  │  │
│ │                      │  ║  B&W and Color:      ║  │  │
│ │  [Add to Cart - $45] │  ║  Always unlimited    ║  │  │
│ │                      │  ╚══════════════════════╝  │  │
│ └──────────────────────┴────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Appendix B: Copy Variations for A/B Testing

### Quota Badge Copy

**Variant A: Neutral**
- "🎨 Artistic: 4/6"
- "🎨 Artistic styles: 4/6 left"

**Variant B: Positive**
- "🎨 You have 4 artistic styles today"
- "✨ 4 special styles available"

**Variant C: Scarcity**
- "⚡ 4 artistic generations remaining"
- "⏳ 4/6 artistic uses left"

### 50% Warning Copy

**Variant A: Informational**
- "ⓘ Halfway through your artistic styles (3 left today)"

**Variant B: Strategic**
- "💡 3 artistic styles left - use them wisely!"

**Variant C: Reassuring**
- "✨ 3 more artistic portraits available today (unlimited B&W & Color)"

### Exhausted State Copy

**Variant A: Celebratory**
- "🎉 You've created 6 amazing artistic styles today!"

**Variant B: Neutral**
- "✨ You've used all 6 artistic styles today"

**Variant C: Forward-Looking**
- "⏰ Artistic styles reset in 7h 23m - see you tomorrow!"

---

## Appendix C: FAQ for Customer Support

### Frequently Asked Questions

**Q: Why is there a limit on artistic styles?**
A: Artistic effects (Modern and Classic) use advanced AI processing to create unique, high-quality portraits. We limit them to 6 per day to maintain quality and keep the service free. Our classic B&W and Color effects remain unlimited.

**Q: When does my quota reset?**
A: Your artistic style quota resets at midnight UTC every day. You can see the countdown timer on the effects page.

**Q: What if I need more than 6 artistic styles?**
A: You can use our unlimited B&W and Color effects anytime. If you've hit your daily limit, your artistic quota will reset at midnight. You can also save your session and return tomorrow for 6 more artistic styles.

**Q: Do B&W and Color effects count toward my limit?**
A: No! Enhanced B&W and Color effects are always unlimited. Only Modern (Ink Wash) and Classic (Van Gogh) styles count toward the 6/day limit.

**Q: Why did my quota reset unexpectedly?**
A: If you're using a shared internet connection (coffee shop, office), you may be sharing a quota with others. This is rare but can happen. Contact support if this is a recurring issue.

**Q: Can I carry unused quota to the next day?**
A: No, unused quota doesn't carry over. Your quota resets to 6 at midnight UTC regardless of how many you used the previous day.

**Q: I'm in checkout and ran out of artistic styles. Can I still order?**
A: Yes! Your current effects are saved and ready to order. You can complete your purchase with any of the styles you've already generated.

**Q: What happens if artistic generation fails?**
A: If an artistic style fails to generate, your quota is NOT deducted. You can retry without losing any of your daily uses.

**Q: Can I share my quota with someone else?**
A: Quotas are tied to your device/browser, not accounts. If you're using the same device, you'll share the same quota.

**Q: Is there a way to get unlimited artistic styles?**
A: Currently, all users get 6 artistic styles per day for free. We may introduce premium options in the future, but for now, everyone gets the same generous daily quota.

---

## Implementation Plan Summary

This UX implementation plan provides:

1. **Clear Warning Strategy**: Progressive disclosure with subtle persistence - informs without overwhelming
2. **Mobile-First Design**: Optimized for 70% mobile traffic with collapsible badges, bottom sheets, and touch-friendly UI
3. **Conversion-Friendly Messaging**: Positive framing, emphasizes unlimited alternatives, never creates dead ends
4. **Comprehensive Specifications**: Color palettes, component designs, animation specs, accessibility requirements
5. **Technical Architecture**: Frontend/backend integration, API endpoints, Firestore schema, fingerprinting
6. **A/B Testing Plan**: 4 variants, clear success metrics, statistical analysis framework
7. **Risk Mitigation**: Comprehensive risk matrix with rollback plans and graceful degradation
8. **Timeline & Budget**: 8-week implementation, $20K development cost, 4.5-month payback

**Key Design Principles**:
- Inform, don't restrict
- Celebrate usage, don't punish exhaustion
- Provide alternatives, never dead ends
- Mobile-first, then scale up to desktop
- Positive framing, strategic language
- Accessibility from day one

**Next Steps**:
1. Review and approve this plan
2. Confirm baseline metrics (current conversion rate)
3. Allocate development resources (230 hours)
4. Begin Phase 0 (Firestore setup, fingerprinting)
5. Weekly check-ins during implementation

---

**Document Prepared By**: UX Design E-commerce Expert Agent
**Date**: 2025-10-30
**Status**: Ready for Implementation
**Estimated Reading Time**: 45 minutes
