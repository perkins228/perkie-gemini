# Gemini Artistic Effects - UX Design Specification

**Created**: 2025-10-30
**Purpose**: Complete UX design for Modern (Ink Wash) and Classic (Van Gogh) AI-powered effects
**Focus**: Mobile-first (70% traffic), conversion optimization, quota management
**Target**: Implementation by development team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [User Journey & Psychology](#user-journey--psychology)
3. [Effect Selector UI Design](#effect-selector-ui-design)
4. [Quota Badge System](#quota-badge-system)
5. [4-Level Warning System](#4-level-warning-system)
6. [Cold Start Loading Experience](#cold-start-loading-experience)
7. [Exhausted State Design](#exhausted-state-design)
8. [Mobile Optimization](#mobile-optimization)
9. [Accessibility Standards](#accessibility-standards)
10. [Technical Implementation Notes](#technical-implementation-notes)
11. [Success Metrics](#success-metrics)

---

## Executive Summary

### Design Philosophy
**"Make AI feel magical, not limited"**

We're introducing premium AI effects (Modern/Ink Wash and Classic/Van Gogh) that have daily usage limits (10 generations/day shared). The UX must:
- **Excite users** about AI capabilities while setting clear expectations
- **Educate gracefully** about daily limits without creating anxiety
- **Convert smoothly** by positioning limits as premium value, not restriction
- **Guide naturally** toward unlimited effects when quota is exhausted

### Key Design Decisions

1. **Promote AI effects first** - Position Modern/Classic as premium features above Enhanced B&W/Color
2. **Progressive disclosure** - Show quota only when relevant (approaching limits)
3. **Positive framing** - "You have 8 generations left today" not "Only 2 remaining"
4. **Trust-building** - Pre-warm API on first page load to eliminate cold starts
5. **Graceful degradation** - When exhausted, celebrate what they created and suggest alternatives

---

## User Journey & Psychology

### Emotional Journey Map

```
User States:
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Discovery   │ Excitement   │ Exploration  │ Constraint   │ Conversion   │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ "What are   │ "AI effects? │ "Let me try  │ "I'm running │ "I love this │
│  these new  │  This looks  │  all of      │  low, better │  effect, I'm │
│  effects?"  │  amazing!"   │  them!"      │  prioritize" │  ordering!"  │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Curious     │ Delighted    │ Engaged      │ Strategic    │ Satisfied    │
│ No quota    │ Silent quota │ Gentle       │ Clear        │ No quota     │
│ shown       │ (10-7 left)  │ reminder     │ warning      │ (bought!)    │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### User Personas & Scenarios

**Persona 1: Sarah (Mobile-First Explorer - 60% of users)**
- **Device**: iPhone 13, Safari
- **Behavior**: Scrolls quickly, impatient with slow loading
- **Goal**: Find the perfect effect for her corgi photo
- **Pain Point**: Doesn't read instructions, clicks everything
- **UX Need**: Visual hierarchy, instant feedback, persistent warnings

**Persona 2: Michael (Desktop Power User - 30% of users)**
- **Device**: Windows laptop, Chrome
- **Behavior**: Tries all effects, compares side-by-side
- **Goal**: Create multiple variations for different products
- **Pain Point**: Quickly exhausts quota experimenting
- **UX Need**: Quota counter visible, batch preview option

**Persona 3: Lisa (Hesitant First-Timer - 10% of users)**
- **Device**: Android tablet, Chrome
- **Behavior**: Reads everything, cautious about "AI"
- **Goal**: Just wants background removed (doesn't need effects)
- **Pain Point**: Intimidated by technical features
- **UX Need**: Clear "skip effects" option, educational tooltips

### Critical UX Principles

1. **Mobile Impatience**: Users won't wait 5-10 seconds without explanation
2. **Cognitive Load**: Max 2 pieces of information per screen (effect name + 1 status)
3. **Loss Aversion**: Frame quota as "remaining value" not "almost gone"
4. **Social Proof**: Show example outputs to set quality expectations
5. **Conversion Focus**: Every design decision must preserve path to purchase

---

## Effect Selector UI Design

### Layout Structure (Mobile-First)

```
┌─────────────────────────────────────────┐
│  Choose Your Effect                     │  ← Section header
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  🎨 Modern (Ink Wash)    [8]    │   │  ← AI effect (promoted)
│  │  AI-powered artistic effect     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  🖼️ Classic (Van Gogh)   [8]    │   │  ← AI effect (promoted)
│  │  AI-powered artistic effect     │   │
│  └─────────────────────────────────┘   │
│  ─────────────────────────────────────  │  ← Divider (subtle)
│  ┌─────────────────────────────────┐   │
│  │  ⚫ Enhanced B&W         ∞       │   │  ← Unlimited effect
│  │  Clean, professional look       │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  🎨 Color                ∞       │   │  ← Unlimited effect
│  │  Vibrant, full-color effect     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Effect Button Specifications

**AI Effect Button (Level 1: Silent - 10-7 remaining)**
```html
<button class="effect-btn effect-ai" data-effect="modern" data-quota="8">
  <div class="effect-icon">🎨</div>
  <div class="effect-content">
    <div class="effect-header">
      <span class="effect-name">Modern (Ink Wash)</span>
      <span class="effect-badge effect-badge-quiet">8</span>
    </div>
    <div class="effect-description">AI-powered artistic effect</div>
  </div>
  <div class="effect-indicator">
    <svg><!-- Sparkle icon --></svg>
  </div>
</button>
```

**Visual Styling (Mobile)**:
- **Height**: 72px (touch-friendly)
- **Padding**: 16px
- **Border**: 2px solid #E5E7EB (default), 2px solid #3B82F6 (selected)
- **Border Radius**: 12px
- **Background**: White (default), #F0F9FF (hover), #EFF6FF (selected)
- **Typography**:
  - Effect name: 16px, font-weight 600
  - Description: 14px, color #6B7280
  - Badge: 12px, font-weight 700

**Badge Color System**:
```css
/* Level 1 (10-7): Subtle, non-intrusive */
.effect-badge-quiet {
  background: #F3F4F6;
  color: #6B7280;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

/* Level 2 (6-4): Gentle reminder */
.effect-badge-notice {
  background: #FEF3C7;
  color: #92400E;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  animation: subtle-pulse 2s ease-in-out infinite;
}

/* Level 3 (3-1): Urgent warning */
.effect-badge-warning {
  background: #FEE2E2;
  color: #991B1B;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  animation: urgent-pulse 1s ease-in-out infinite;
}

/* Level 4 (0): Exhausted */
.effect-badge-exhausted {
  background: #E5E7EB;
  color: #6B7280;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}
```

**Unlimited Effect Button**:
```html
<button class="effect-btn effect-unlimited" data-effect="blackwhite">
  <div class="effect-icon">⚫</div>
  <div class="effect-content">
    <div class="effect-header">
      <span class="effect-name">Enhanced B&W</span>
      <span class="effect-badge-infinity">∞</span>
    </div>
    <div class="effect-description">Clean, professional look</div>
  </div>
</button>
```

### Desktop Adaptations

**Layout Change (768px+)**:
- 2-column grid for effects (2x2)
- Larger preview thumbnails (120px → 180px)
- Hover states more pronounced
- Tooltip on hover showing quota details

**Desktop-Specific Features**:
- Keyboard navigation (Arrow keys, Enter to select)
- Hover preview of sample output
- Comparison mode (click to compare two effects side-by-side)

---

## Quota Badge System

### Badge Display Logic

```javascript
function getQuotaBadgeConfig(remaining) {
  if (remaining >= 7) {
    return {
      level: 1,
      variant: 'quiet',
      display: 'number', // Just show "8"
      animation: 'none',
      showInline: true,
      showModal: false
    };
  } else if (remaining >= 4) {
    return {
      level: 2,
      variant: 'notice',
      display: 'number-with-label', // "6 left"
      animation: 'subtle-pulse',
      showInline: true,
      showModal: false,
      tooltip: 'You have 6 AI generations remaining today'
    };
  } else if (remaining >= 1) {
    return {
      level: 3,
      variant: 'warning',
      display: 'number-with-urgent-label', // "⚠️ 3 left"
      animation: 'urgent-pulse',
      showInline: true,
      showModal: true, // Show warning on next click
      tooltip: 'Running low! You have 3 AI generations left today'
    };
  } else {
    return {
      level: 4,
      variant: 'exhausted',
      display: 'exhausted-message', // "Try tomorrow"
      animation: 'none',
      showInline: true,
      showModal: true, // Show exhaustion modal
      tooltip: 'Daily limit reached. Resets at midnight PST'
    };
  }
}
```

### Badge Placement Strategy

**Mobile (Portrait)**:
- Badge in top-right corner of effect button
- Persistent across all views (selector, preview, results)
- Sticks to top of effect name in sticky headers

**Mobile (Landscape)**:
- Badge moves to inline position (after effect name)
- Reduces height to preserve vertical space

**Desktop**:
- Badge in top-right corner
- Hover reveals detailed tooltip
- Appears in breadcrumb trail during processing

### Visual Examples

**Level 1 (Silent - 10-7 remaining)**:
```
┌──────────────────────────────┐
│ 🎨 Modern (Ink Wash)    [8]  │  ← Small gray badge, no alert
│ AI-powered artistic effect   │
└──────────────────────────────┘
```

**Level 2 (Reminder - 6-4 remaining)**:
```
┌──────────────────────────────┐
│ 🎨 Modern (Ink Wash)  [6 left]│ ← Amber badge, gentle pulse
│ AI-powered artistic effect   │
│ ⓘ You have 6 AI gens today   │  ← Subtle info row (dismissible)
└──────────────────────────────┘
```

**Level 3 (Warning - 3-1 remaining)**:
```
┌──────────────────────────────┐
│ 🎨 Modern (Ink Wash) ⚠️ [3 left]│ ← Red badge, urgent pulse
│ AI-powered artistic effect   │
│ ⚠️ Running low! Choose wisely │  ← Warning row (persistent)
└──────────────────────────────┘
```

**Level 4 (Exhausted - 0 remaining)**:
```
┌──────────────────────────────┐
│ 🎨 Modern (Ink Wash)  [0]    │  ← Gray badge, disabled state
│ AI-powered artistic effect   │
│ 🔒 Daily limit reached       │  ← Lock icon, disabled state
│ [Try Enhanced B&W instead →] │  ← CTA to unlimited effects
└──────────────────────────────┘
```

---

## 4-Level Warning System

### Level 1: Silent (10-7 remaining)

**Philosophy**: User is just discovering the feature - don't create anxiety

**UI Behavior**:
- Small gray badge with number (e.g., "8")
- No warnings, no alerts, no modals
- Badge barely noticeable (gray #6B7280)
- Focus on delighting user with AI quality

**When to Show**:
- First-time users uploading their first pet photo
- Users who haven't used AI effects yet today
- Users with 7+ generations remaining

**Copy Examples**:
- Badge: Just the number "8" (no label)
- No additional messaging

---

### Level 2: Gentle Reminder (6-4 remaining)

**Philosophy**: User is engaged - educate without alarming

**UI Behavior**:
- Amber badge with "left" label (e.g., "6 left")
- Subtle pulse animation (2s interval)
- Optional dismissible info banner
- Tooltip on hover explaining quota

**When to Show**:
- After user has generated 4+ AI effects
- User is actively exploring multiple styles
- Quota crossed below 7 for first time today

**Copy Examples**:
- Badge: "6 left" (amber background)
- Info banner: "💡 Tip: You have 6 AI generations remaining today. They reset at midnight PST."
- Tooltip: "AI effects are limited to 10/day. Enhanced B&W and Color are unlimited!"

**Visual Design**:
```
┌─────────────────────────────────────┐
│ ℹ️ You have 6 AI generations left   │
│    today. Resets at midnight PST.   │
│                             [Dismiss]│
└─────────────────────────────────────┘
```

**Dismissal Logic**:
- User can dismiss banner for this session
- Reappears if quota drops to Level 3
- Persists across page refreshes at Level 2

---

### Level 3: Urgent Warning (3-1 remaining)

**Philosophy**: User is running low - create awareness without panic

**UI Behavior**:
- Red badge with warning icon (e.g., "⚠️ 3 left")
- Urgent pulse animation (1s interval)
- **Modal on next AI effect click** (not immediately)
- Persistent warning banner (cannot dismiss)
- Suggest pre-selecting which style to use

**When to Show**:
- Quota drops to 3 or below
- User clicks on AI effect button
- Before processing starts (confirmation step)

**Modal Design (Mobile)**:
```
┌─────────────────────────────────────┐
│             ⚠️ Running Low           │
│                                     │
│  You have 3 AI generations left     │
│  today. Choose carefully!           │
│                                     │
│  💡 Tip: Try Enhanced B&W (unlimited)│
│     if you want to experiment more. │
│                                     │
│  Which style do you want?           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🎨 Modern (Ink Wash)        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🖼️ Classic (Van Gogh)       │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Go Back]     [Continue (3 left)] │
└─────────────────────────────────────┘
```

**Copy Examples**:
- Badge: "⚠️ 3 left" (red background)
- Banner: "⚠️ You're running low on AI generations. You have 3 left today."
- Modal heading: "Running Low"
- Modal body: "You have 3 AI generations left today. Choose carefully!"
- Tip: "Try Enhanced B&W (unlimited) if you want to experiment more."
- CTA: "Continue (3 left)" (shows decrementing count)

**Behavioral Changes**:
- Disable auto-generation of both styles
- Require user to explicitly choose Modern OR Classic
- Show preview thumbnails of each style before processing
- Add "Go Back" option to cancel and use unlimited effect instead

---

### Level 4: Exhausted (0 remaining)

**Philosophy**: Celebrate what they created, guide to alternatives

**UI Behavior**:
- Gray badge with "0" or "Try tomorrow"
- Disabled state for AI effect buttons
- **Immediate modal** on click (before processing attempt)
- Suggest unlimited effects with sample previews
- Optional: Email capture for "notify when quota resets"

**When to Show**:
- User has used all 10 generations today
- User clicks on disabled AI effect button
- Midnight PST (quota resets, show celebration)

**Exhaustion Modal Design (Mobile)**:
```
┌─────────────────────────────────────┐
│          🎨 Amazing Work!           │
│                                     │
│  You've created 10 beautiful AI     │
│  effects today. Your quota resets   │
│  at midnight PST.                   │
│                                     │
│  In the meantime, try these         │
│  unlimited effects:                 │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ⚫ Enhanced B&W        ∞      │ │
│  │ [Preview thumbnail]           │ │
│  │ Clean, professional look      │ │
│  │ [Try This Effect →]           │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🎨 Color                ∞      │ │
│  │ [Preview thumbnail]           │ │
│  │ Vibrant, full-color effect    │ │
│  │ [Try This Effect →]           │ │
│  └───────────────────────────────┘ │
│                                     │
│  ☐ Email me when quota resets     │
│                                     │
│  [Close]                            │
└─────────────────────────────────────┘
```

**Copy Examples**:
- Heading: "🎨 Amazing Work!" (positive framing)
- Body: "You've created 10 beautiful AI effects today. Your quota resets at midnight PST."
- Subheading: "In the meantime, try these unlimited effects:"
- CTA: "Try This Effect →" (direct to unlimited effect)
- Optional: "Email me when quota resets" (lead capture)

**Disabled Button State**:
```
┌──────────────────────────────┐
│ 🎨 Modern (Ink Wash)   [0]   │  ← Grayed out, reduced opacity
│ AI-powered artistic effect   │
│ 🔒 Resets at midnight PST    │  ← Lock icon, clear messaging
│ [Try Enhanced B&W instead →] │  ← CTA to unlimited
└──────────────────────────────┘
```

**Midnight Reset Celebration**:
```
┌─────────────────────────────────────┐
│          ✨ Quota Reset!            │
│                                     │
│  Good morning! You have 10 fresh    │
│  AI generations ready to use.       │
│                                     │
│  [Start Creating →]                 │
└─────────────────────────────────────┘
```

---

## Cold Start Loading Experience

### The Problem

First API request takes **5-10 seconds** due to:
1. Google Cloud Run cold start (3-4s)
2. Gemini model initialization (2-3s)
3. Image processing overhead (1-2s)

Subsequent requests: **2-3 seconds** (warm API)

**User Expectation**: Instant results (< 1 second tolerance on mobile)

### Solution Strategy

**Phase 1: Pre-warming (Invisible to User)**
- Trigger API warm-up on page load
- Send lightweight "ping" request when user uploads image
- Prime the API before user clicks "Generate"

**Phase 2: Expectation Setting (Visible to User)**
- Show accurate progress bar (not fake spinners)
- Break down what's happening in real-time
- Use animation to make wait feel shorter
- Celebrate the result to justify the wait

### Pre-warming Implementation

**Trigger Points**:
1. **Page Load**: Send silent warm-up request
2. **Image Upload**: Send image preprocessing request
3. **Effect Hover** (desktop): Pre-warm specific effect model

**User Feedback**:
- No visible indicators during pre-warming
- Silent background process
- Only show loading once user clicks "Generate"

```javascript
// Pseudo-code
function prewarmAPI() {
  // Trigger on page load
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await fetch('/api/v1/warmup', { method: 'POST' });
      console.log('[Prewarm] API ready');
    } catch (e) {
      console.warn('[Prewarm] Failed, will cold start on first request');
    }
  });
}

function prewarmOnUpload(imageFile) {
  // Trigger when user uploads image
  // This happens BEFORE they click "Generate"
  const formData = new FormData();
  formData.append('image', imageFile);

  fetch('/api/v1/prepare', {
    method: 'POST',
    body: formData
  }).catch(() => {
    // Silent fail, will process normally
  });
}
```

### Loading State Design (Mobile)

**First Request (Cold Start - 5-10s)**:
```
┌─────────────────────────────────────┐
│     Creating Your Masterpiece       │
│                                     │
│  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░  40%│
│                                     │
│  🔄 Warming up AI model...          │
│                                     │
│  This takes ~10 seconds on your     │
│  first request, then speeds up!     │
│                                     │
│  [Cancel]                           │
└─────────────────────────────────────┘
```

**Progress Bar Stages (Cold Start)**:
- 0-20%: "Uploading your image..." (1-2s)
- 20-40%: "Warming up AI model..." (3-4s)
- 40-70%: "Generating artistic effect..." (3-4s)
- 70-90%: "Applying final touches..." (1-2s)
- 90-100%: "Almost done!" (0.5s)

**Subsequent Requests (Warm - 2-3s)**:
```
┌─────────────────────────────────────┐
│     Creating Your Masterpiece       │
│                                     │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  70%│
│                                     │
│  🎨 Generating artistic effect...   │
│                                     │
│  [Cancel]                           │
└─────────────────────────────────────┘
```

**Progress Bar Stages (Warm)**:
- 0-30%: "Uploading your image..." (0.5s)
- 30-80%: "Generating artistic effect..." (2s)
- 80-100%: "Finalizing..." (0.5s)

### Animation Strategy

**Purpose**: Make 5-10 second wait feel shorter through engagement

**Loading Animation**:
```css
/* Smooth gradient animation */
@keyframes shimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}

.loading-bar {
  background: linear-gradient(
    90deg,
    #3B82F6 0%,
    #60A5FA 50%,
    #3B82F6 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
}
```

**Micro-interactions**:
- Gentle pulse on status text (0.8s interval)
- Progress bar fills smoothly (no jumps)
- Percentage counter increments smoothly
- Success checkmark animation on completion

### Desktop Adaptations

**Show More Details**:
```
┌─────────────────────────────────────────────┐
│        Creating Your Masterpiece            │
│                                             │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░  40% │
│                                             │
│  🔄 Warming up AI model...                  │
│                                             │
│  First-time setup: ~10 seconds              │
│  ✓ Image uploaded (2.4 MB)                  │
│  ⏳ Initializing Gemini 2.5...              │
│  ⏹️ Generating effect...                     │
│                                             │
│  Future requests will be much faster!       │
│                                             │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
```

### Error States

**API Timeout (>15s)**:
```
┌─────────────────────────────────────┐
│         ⚠️ Taking Longer             │
│                                     │
│  The AI is taking longer than       │
│  expected. This happens rarely.     │
│                                     │
│  ⏳ Still processing... (18s)        │
│                                     │
│  [Keep Waiting]  [Cancel & Retry]   │
└─────────────────────────────────────┘
```

**API Failure**:
```
┌─────────────────────────────────────┐
│          ❌ Generation Failed        │
│                                     │
│  We couldn't generate your effect.  │
│  Your quota has NOT been used.      │
│                                     │
│  Want to try:                       │
│  • Different effect style           │
│  • Enhanced B&W (unlimited)         │
│  • Retry Modern/Classic             │
│                                     │
│  [Try Enhanced B&W] [Retry]         │
└─────────────────────────────────────┘
```

---

## Exhausted State Design

### Philosophy

**"You've created amazing work - here's what's next"**

Don't punish users for hitting the limit. Instead:
1. **Celebrate** what they've created (10 beautiful effects!)
2. **Guide** them to alternatives (unlimited effects)
3. **Convert** them to purchase (show their creations on products)
4. **Retain** them for tomorrow (email notification)

### Exhausted Modal (Detailed)

**Modal Trigger**:
- User clicks on AI effect button when quota = 0
- User tries to generate effect when quota = 0
- Does NOT trigger on page load (only on interaction)

**Modal Content (Mobile)**:
```
┌─────────────────────────────────────┐
│          🎨 Amazing Work!           │
│                                     │
│  You've created 10 beautiful AI     │
│  effects today!                     │
│                                     │
│  Your quota resets in:              │
│  ⏰ 6 hours 23 minutes               │
│     (midnight PST)                  │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Try these unlimited effects:       │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ⚫ Enhanced B&W        ∞      │ │
│  │ ┌──────────┐                 │ │
│  │ │ [Sample] │  Clean,         │ │
│  │ │ [Image]  │  professional   │ │
│  │ └──────────┘  look            │ │
│  │ [Generate B&W →]              │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🎨 Color                ∞      │ │
│  │ ┌──────────┐                 │ │
│  │ │ [Sample] │  Vibrant,       │ │
│  │ │ [Image]  │  full-color     │ │
│  │ └──────────┘  effect          │ │
│  │ [Generate Color →]            │ │
│  └───────────────────────────────┘ │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  💌 Get notified when quota resets │
│  ┌─────────────────────────────┐   │
│  │ your-email@example.com      │   │
│  └─────────────────────────────┘   │
│  [Notify Me]                        │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Ready to order your creations?     │
│  [Browse Products →]                │
│                                     │
│  [Close]                            │
└─────────────────────────────────────┘
```

### Disabled Button State (Inline)

**What User Sees**:
```
┌──────────────────────────────────────┐
│ 🎨 Modern (Ink Wash)           [0]   │  ← Opacity 0.5
│ AI-powered artistic effect           │
│ ┌──────────────────────────────────┐ │
│ │ 🔒 Daily limit reached           │ │  ← Lock banner
│ │ Resets in 6h 23m                 │ │
│ │ [Try Enhanced B&W instead →]     │ │  ← Direct CTA
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Click Behavior**:
- Does NOT trigger effect generation
- Opens exhaustion modal instead
- Provides haptic feedback (mobile) to indicate disabled
- Screen reader announces "Daily limit reached, resets at midnight"

### Alternative Suggestions

**Show Sample Outputs**:
- Display actual Enhanced B&W and Color effects from their uploaded image
- Pre-generate unlimited effects while they're deciding
- Side-by-side comparison: "Here's what Enhanced B&W would look like"

**Conversion-Focused CTAs**:
```
┌─────────────────────────────────────┐
│  You've created 10 amazing effects! │
│                                     │
│  🛍️ See your creations on products  │
│  [View on Canvas Print →]           │
│  [View on Mug →]                    │
│  [View on Phone Case →]             │
└─────────────────────────────────────┘
```

### Email Notification Feature

**Capture Form**:
```html
<form class="quota-reset-notification">
  <label for="email">Get notified when your quota resets:</label>
  <div class="input-group">
    <input
      type="email"
      id="email"
      placeholder="your-email@example.com"
      required
      aria-label="Email address for quota reset notification"
    />
    <button type="submit">Notify Me</button>
  </div>
  <p class="privacy-note">
    We'll only email you at midnight PST. No spam, promise!
    <a href="/privacy">Privacy Policy</a>
  </p>
</form>
```

**Email Template (Midnight PST)**:
```
Subject: ✨ Your AI Effects Quota Has Reset!

Hi there,

Good news! Your daily quota of 10 AI effects has reset.

You can now create:
• 10 Modern (Ink Wash) effects
• 10 Classic (Van Gogh) effects

[Start Creating →]

Or try our unlimited effects:
• Enhanced B&W (∞)
• Color (∞)

Happy creating!
- The Perkie Team

---
Unsubscribe | Manage Preferences
```

### Countdown Timer

**Visual Design**:
```css
.quota-countdown {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #F3F4F6;
  border-radius: 8px;
  margin-bottom: 16px;
}

.countdown-icon {
  font-size: 24px;
}

.countdown-time {
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
}

.countdown-label {
  font-size: 14px;
  color: #6B7280;
}
```

**Update Logic**:
- Update every 60 seconds (not every second - save battery)
- Show hours and minutes (e.g., "6h 23m")
- When < 1 hour, switch to minutes only (e.g., "47 minutes")
- When < 10 minutes, add excitement: "⏰ Only 8 minutes until reset!"

---

## Mobile Optimization

### Touch Target Sizes

**Minimum Sizes** (WCAG AAA compliance):
- Effect buttons: **72px height** (exceeds 44px minimum)
- Badge taps: **44px × 44px** (tappable area)
- CTAs in modals: **48px height** (comfortable)
- Close buttons: **44px × 44px** (corner)

**Spacing**:
- Gap between effect buttons: **12px** (prevents mis-taps)
- Padding inside buttons: **16px** (breathing room)
- Modal content padding: **20px** (thumb-safe zones)

### Thumb Zone Optimization

**Priority Placement** (based on right-handed users):
```
┌─────────────────────────────┐
│  [HARD]   [HARD]   [HARD]  │  ← Top corners (hard to reach)
│                             │
│  [EASY]           [MEDIUM] │  ← Middle-right (thumb zone)
│                             │
│  [EASY]   [EASY]   [EASY]  │  ← Bottom center (natural)
└─────────────────────────────┘
```

**Element Positioning**:
- Primary CTAs: **Bottom-center** or **bottom-right**
- Secondary actions: **Top-left** or **top-center**
- Close buttons: **Top-right** (acceptable for dismissal)
- Important info: **Middle-center** (always visible)

**Applied to Our UI**:
- "Generate" button: **Bottom-center** (primary action)
- Effect selector: **Top-half** (scrollable list)
- Quota badge: **Top-right of button** (informational)
- Modal CTAs: **Bottom** (easy to reach)

### One-Handed Use Patterns

**Scrollable Effect List**:
- Vertical scroll (natural thumb motion)
- Snap-to-grid alignment (prevents drift)
- Pull-to-refresh quota status (gesture-based)

**Swipe Gestures** (optional enhancement):
- Swipe left on effect → Show sample output
- Swipe right on effect → Quick select + generate
- Long-press on effect → Show effect details

**Sticky Elements**:
- Quota counter sticks to top when scrolling
- "Generate" button sticks to bottom (always accessible)
- Selected effect name shows in sticky header

### Performance Considerations

**Image Loading**:
- Lazy-load effect preview thumbnails
- Use WebP format with JPEG fallback
- Compress to 80% quality (imperceptible on mobile)
- Size appropriately: 300px width max on mobile

**Animation Performance**:
- Use CSS transforms (GPU-accelerated)
- Avoid animating width/height (causes reflow)
- Limit animations to opacity and transform
- Reduce motion for users with prefers-reduced-motion

**Bundle Size**:
- Lazy-load modal code (only when quota < 7)
- Inline critical CSS for above-fold content
- Defer non-critical scripts
- Target: < 50KB additional JS for quota system

### Landscape Mode Adaptations

**Layout Changes**:
```
Portrait (9:16):              Landscape (16:9):
┌─────────┐                   ┌──────────────────────┐
│ Effect  │                   │ Effects │ Preview    │
│ Buttons │                   │ (Half)  │ (Half)     │
│         │                   │         │            │
│ Preview │                   └──────────────────────┘
│         │
│ Actions │
└─────────┘
```

**Landscape-Specific**:
- 2-column layout (effects left, preview right)
- Reduce button height to 56px (more fit on screen)
- Horizontal quota indicator (saves vertical space)
- Compact modal design (avoid full-screen)

### Network Resilience

**Offline Detection**:
```
┌─────────────────────────────────────┐
│         📡 No Connection            │
│                                     │
│  AI effects require internet.       │
│  Please check your connection.      │
│                                     │
│  Meanwhile, you can:                │
│  • Review your saved effects        │
│  • Browse products                  │
│  • Prepare your pet photos          │
│                                     │
│  [Close]                            │
└─────────────────────────────────────┘
```

**Slow Connection Warning**:
```
┌─────────────────────────────────────┐
│       🐢 Slow Connection            │
│                                     │
│  We've detected a slow connection.  │
│  AI effects may take 20-30s.        │
│                                     │
│  [Continue Anyway]  [Try Later]     │
└─────────────────────────────────────┘
```

**Smart Retries**:
- Exponential backoff: 2s, 4s, 8s
- Max 3 retries before showing error
- Preserve quota on failures (don't decrement)
- Cache partial results (resume on retry)

---

## Accessibility Standards

### WCAG 2.1 AAA Compliance

**Perceivable**:
- Color contrast ratio ≥ 7:1 for body text
- Color contrast ratio ≥ 4.5:1 for UI elements
- Don't rely solely on color for quota status (use icons + text)
- Provide text alternatives for all icons

**Operable**:
- All functionality keyboard-accessible
- No keyboard traps in modals
- Skip links to bypass quota warnings
- Visible focus indicators (3px outline, blue #3B82F6)

**Understandable**:
- Clear, concise language (8th grade reading level)
- Consistent navigation patterns
- Helpful error messages with recovery steps
- Form labels explicitly associated with inputs

**Robust**:
- Valid HTML5 markup
- ARIA landmarks for all regions
- Semantic HTML elements
- Progressive enhancement (works without JS)

### Screen Reader Support

**ARIA Labels**:
```html
<!-- Effect Button -->
<button
  class="effect-btn effect-ai"
  data-effect="modern"
  aria-label="Modern Ink Wash effect, 8 generations remaining today"
  aria-describedby="modern-description"
  role="button"
>
  <span aria-hidden="true">🎨</span>
  <span id="modern-description">
    AI-powered artistic effect that transforms your pet photo into an ink wash painting
  </span>
  <span class="effect-badge" aria-live="polite">8</span>
</button>

<!-- Quota Warning -->
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
>
  You have 3 AI generations left today. Choose carefully.
</div>

<!-- Loading State -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  Creating your masterpiece. Step 2 of 4: Warming up AI model. 40% complete.
</div>

<!-- Exhausted Modal -->
<dialog
  role="dialog"
  aria-labelledby="exhausted-title"
  aria-describedby="exhausted-description"
  aria-modal="true"
>
  <h2 id="exhausted-title">Daily Limit Reached</h2>
  <p id="exhausted-description">
    You've created 10 beautiful AI effects today.
    Your quota resets at midnight Pacific Time.
  </p>
  <!-- Modal content -->
</dialog>
```

**Live Regions**:
- Quota counter: `aria-live="polite"` (announces changes)
- Warning messages: `aria-live="assertive"` (interrupts)
- Loading progress: `aria-live="polite"` (non-intrusive updates)
- Error messages: `role="alert"` (immediate attention)

### Keyboard Navigation

**Tab Order**:
1. Effect buttons (Modern, Classic, B&W, Color)
2. Quota info (if visible)
3. Generate button
4. Modal close button (if modal open)
5. Modal action buttons

**Keyboard Shortcuts**:
- **Tab**: Move focus forward
- **Shift+Tab**: Move focus backward
- **Enter/Space**: Activate button
- **Escape**: Close modal/dismiss warning
- **Arrow Keys**: Navigate between effects (optional enhancement)

**Focus Management**:
```javascript
// When modal opens
function openModal() {
  const modal = document.querySelector('[role="dialog"]');
  const closeButton = modal.querySelector('[data-modal-close]');

  // Store previous focus
  const previousFocus = document.activeElement;

  // Move focus to modal
  closeButton.focus();

  // Trap focus within modal
  modal.addEventListener('keydown', trapFocus);

  // Restore focus on close
  modal.addEventListener('close', () => {
    previousFocus.focus();
  });
}
```

### Visual Accessibility

**Color Blindness Support**:
- Don't use red/green for status (use icons too)
- Level 1: Gray badge + "8" text
- Level 2: Amber badge + "left" text + ℹ️ icon
- Level 3: Red badge + "left" text + ⚠️ icon
- Level 4: Gray badge + "0" text + 🔒 icon

**High Contrast Mode**:
```css
@media (prefers-contrast: high) {
  .effect-badge-quiet {
    background: #000000;
    color: #FFFFFF;
    border: 2px solid #FFFFFF;
  }

  .effect-badge-warning {
    background: #FFFF00;
    color: #000000;
    border: 2px solid #000000;
  }
}
```

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  .effect-badge-notice,
  .effect-badge-warning {
    animation: none; /* Disable pulse */
  }

  .loading-bar {
    animation: none; /* Disable shimmer */
  }

  * {
    transition-duration: 0.01ms !important;
  }
}
```

### Text Readability

**Font Sizes** (minimum):
- Body text: 16px (desktop), 14px (mobile)
- Effect names: 16px (bold)
- Descriptions: 14px
- Badge text: 12px (bold, high contrast)

**Line Height**:
- Body text: 1.5
- Headings: 1.2
- Descriptions: 1.4

**Font Families**:
- Primary: System font stack (performance + familiarity)
- Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

---

## Technical Implementation Notes

### State Management

**Quota State Object**:
```javascript
const quotaState = {
  total: 10,           // Total daily quota
  used: 2,             // Used today
  remaining: 8,        // Remaining today
  resetTime: '2025-10-31T07:00:00Z', // Midnight PST
  lastUpdated: Date.now(),
  level: 1,            // Warning level (1-4)
  sessionId: 'uuid-here',
  userId: 'user-123'   // Optional for logged-in users
};
```

**Local Storage Schema**:
```javascript
// Key: 'perkie_quota_state'
{
  "quotaState": {
    "total": 10,
    "used": 2,
    "remaining": 8,
    "resetTime": "2025-10-31T07:00:00Z",
    "lastUpdated": 1698768000000,
    "level": 1,
    "sessionId": "abc-123",
    "userId": null
  },
  "generationHistory": [
    {
      "timestamp": 1698765000000,
      "effect": "modern",
      "imageHash": "sha256-hash",
      "success": true
    },
    {
      "timestamp": 1698766000000,
      "effect": "classic",
      "imageHash": "sha256-hash",
      "success": true
    }
  ],
  "dismissedWarnings": {
    "level2_firstDismiss": 1698765000000
  }
}
```

**API Response Schema**:
```javascript
{
  "success": true,
  "data": {
    "generatedImageUrl": "https://storage.googleapis.com/...",
    "effect": "modern",
    "quota": {
      "remaining": 7,
      "total": 10,
      "resetTime": "2025-10-31T07:00:00Z",
      "level": 1
    }
  },
  "processingTime": 2.4,
  "cached": false
}
```

### Frontend Integration Points

**Existing Pet Processor Integration**:
```javascript
// In assets/pet-processor.js (existing file)

// Add quota management module
const QuotaManager = {
  init() {
    this.loadState();
    this.checkReset();
    this.updateUI();
  },

  loadState() {
    const saved = localStorage.getItem('perkie_quota_state');
    this.state = saved ? JSON.parse(saved) : this.getDefaultState();
  },

  getDefaultState() {
    return {
      quotaState: {
        total: 10,
        used: 0,
        remaining: 10,
        resetTime: this.getNextMidnightPST(),
        lastUpdated: Date.now(),
        level: 1,
        sessionId: this.generateSessionId()
      },
      generationHistory: [],
      dismissedWarnings: {}
    };
  },

  checkReset() {
    const now = new Date();
    const resetTime = new Date(this.state.quotaState.resetTime);

    if (now >= resetTime) {
      this.resetQuota();
      this.showResetCelebration();
    }
  },

  updateUI() {
    const level = this.calculateLevel();
    this.updateBadges(level);
    this.updateButtons(level);
    this.showWarnings(level);
  },

  calculateLevel() {
    const remaining = this.state.quotaState.remaining;
    if (remaining >= 7) return 1;
    if (remaining >= 4) return 2;
    if (remaining >= 1) return 3;
    return 4;
  },

  async generateEffect(effect, imageData) {
    // Check quota before proceeding
    if (this.state.quotaState.remaining <= 0) {
      this.showExhaustedModal();
      return null;
    }

    // Show warning at Level 3
    if (this.calculateLevel() === 3) {
      const confirmed = await this.showWarningModal();
      if (!confirmed) return null;
    }

    try {
      // Call API
      const result = await this.callGeminiAPI(effect, imageData);

      // Decrement quota
      this.decrementQuota(effect, result.imageHash);

      // Update UI
      this.updateUI();

      return result;
    } catch (error) {
      // Don't decrement quota on failure
      this.showErrorModal(error);
      return null;
    }
  },

  decrementQuota(effect, imageHash) {
    this.state.quotaState.used++;
    this.state.quotaState.remaining--;
    this.state.quotaState.lastUpdated = Date.now();

    this.state.generationHistory.push({
      timestamp: Date.now(),
      effect,
      imageHash,
      success: true
    });

    this.saveState();
  },

  saveState() {
    localStorage.setItem('perkie_quota_state', JSON.stringify(this.state));
  }
};
```

### API Endpoints (Backend)

**POST /api/v1/generate**:
```javascript
// Request
{
  "image": "base64-encoded-image-data",
  "effect": "modern", // or "classic"
  "sessionId": "abc-123",
  "userId": null // optional
}

// Response (Success)
{
  "success": true,
  "data": {
    "generatedImageUrl": "https://storage.googleapis.com/perkie/generated/xyz.jpg",
    "effect": "modern",
    "quota": {
      "remaining": 7,
      "total": 10,
      "resetTime": "2025-10-31T07:00:00Z",
      "level": 1
    }
  },
  "processingTime": 2.4,
  "cached": false
}

// Response (Quota Exceeded)
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily quota exceeded. Resets at midnight PST.",
    "quota": {
      "remaining": 0,
      "total": 10,
      "resetTime": "2025-10-31T07:00:00Z",
      "level": 4
    }
  }
}
```

**GET /api/v1/quota**:
```javascript
// Request
GET /api/v1/quota?sessionId=abc-123

// Response
{
  "success": true,
  "data": {
    "remaining": 8,
    "total": 10,
    "used": 2,
    "resetTime": "2025-10-31T07:00:00Z",
    "level": 1,
    "history": [
      {
        "timestamp": 1698765000000,
        "effect": "modern",
        "success": true
      }
    ]
  }
}
```

### Rate Limiting (Firestore)

**Document Structure**:
```javascript
// Collection: quota_tracking
// Document ID: sessionId (or userId if logged in)
{
  sessionId: 'abc-123',
  userId: null,
  dailyUsage: {
    '2025-10-30': {
      modern: 1,
      classic: 1,
      total: 2
    }
  },
  totalGenerated: 2,
  firstGeneration: Timestamp,
  lastGeneration: Timestamp,
  ipAddress: '192.168.1.1', // For abuse detection
  userAgent: 'Mozilla/5.0...'
}
```

**Rate Limit Check Logic**:
```python
# In backend/gemini-artistic-api/src/core/rate_limiter.py

async def check_quota(session_id: str) -> dict:
    """
    Check if session has remaining quota.
    Returns: { "allowed": bool, "remaining": int, "reset_time": str }
    """
    doc = await firestore.collection('quota_tracking').document(session_id).get()

    if not doc.exists:
        # First-time user
        return {
            "allowed": True,
            "remaining": 10,
            "total": 10,
            "reset_time": get_next_midnight_pst()
        }

    data = doc.to_dict()
    today = datetime.now().strftime('%Y-%m-%d')

    # Check if quota has reset (new day)
    if today not in data.get('dailyUsage', {}):
        return {
            "allowed": True,
            "remaining": 10,
            "total": 10,
            "reset_time": get_next_midnight_pst()
        }

    # Check current usage
    used_today = data['dailyUsage'][today].get('total', 0)
    remaining = 10 - used_today

    return {
        "allowed": remaining > 0,
        "remaining": remaining,
        "total": 10,
        "reset_time": get_next_midnight_pst()
    }
```

### Frontend-Backend Data Flow

```
┌─────────────┐                ┌─────────────┐                ┌─────────────┐
│  Frontend   │                │   Backend   │                │  Firestore  │
│  (Browser)  │                │  (API)      │                │  (Quota DB) │
└──────┬──────┘                └──────┬──────┘                └──────┬──────┘
       │                              │                              │
       │ 1. Page Load                 │                              │
       ├──────────────────────────────>│                              │
       │ GET /api/v1/quota             │                              │
       │                              │ 2. Check Firestore           │
       │                              ├─────────────────────────────>│
       │                              │<─────────────────────────────│
       │<──────────────────────────────│ { remaining: 8 }            │
       │ { remaining: 8, level: 1 }   │                              │
       │                              │                              │
       │ 3. User Clicks "Generate"    │                              │
       │ (Client-side quota check)    │                              │
       │ ✓ Remaining > 0              │                              │
       │                              │                              │
       │ 4. POST /api/v1/generate     │                              │
       ├──────────────────────────────>│                              │
       │ { effect: "modern", image }  │                              │
       │                              │ 5. Verify Quota              │
       │                              ├─────────────────────────────>│
       │                              │<─────────────────────────────│
       │                              │ ✓ Allowed                    │
       │                              │                              │
       │                              │ 6. Generate Effect (Gemini)  │
       │                              │ (5-10s cold, 2-3s warm)      │
       │                              │                              │
       │                              │ 7. Decrement Quota           │
       │                              ├─────────────────────────────>│
       │                              │<─────────────────────────────│
       │                              │ ✓ Updated (remaining: 7)     │
       │                              │                              │
       │<──────────────────────────────│                              │
       │ { imageUrl, remaining: 7 }   │                              │
       │                              │                              │
       │ 8. Update UI                 │                              │
       │ - Show badge: "7 left"       │                              │
       │ - Change level 1 → 2         │                              │
       │ - Show gentle reminder       │                              │
       │                              │                              │
```

### Caching Strategy

**Problem**: Repeated generations waste quota and API costs

**Solution**: SHA256 hash-based caching
```javascript
// Generate hash of (image + effect)
const cacheKey = sha256(imageData + effect);

// Check cache before calling API
const cached = await checkCache(cacheKey);
if (cached) {
  return cached.imageUrl; // Don't decrement quota
}

// Generate new
const result = await gemini.generate(imageData, effect);

// Store in cache
await storeCache(cacheKey, result.imageUrl, ttl = 7 days);

return result.imageUrl;
```

**Cache Storage**:
- Location: Cloud Storage bucket `perkieprints-processing-cache`
- TTL: 7 days (matches session expiry)
- Naming: `generated/{sha256-hash}.jpg`
- Deduplication: Identical images share same cache entry

---

## Success Metrics

### Primary KPIs

**Conversion Rate**:
- Baseline: Current conversion rate with unlimited effects only
- Target: +15% conversion lift from AI effects
- Measure: (Orders with AI effects) / (Total sessions with AI effects)

**AI Effect Adoption**:
- Target: 60% of users try at least one AI effect
- Measure: (Sessions with AI generation) / (Total sessions)

**Quota Efficiency**:
- Target: <5% of users hit exhaustion state
- Measure: (Sessions with 0 remaining) / (Sessions with AI usage)

**Average Effects per User**:
- Target: 3-4 effects per session
- Measure: Mean of (effects generated per session)

### Secondary Metrics

**User Engagement**:
- Time on site: +20% for users who try AI effects
- Pages per session: +30% for AI effect users
- Bounce rate: -10% on pet processor page

**Warning System Effectiveness**:
- Level 2 warning dismissal rate: <30% (most users read it)
- Level 3 warning cancellation rate: 10-20% (some users reconsider)
- Level 4 alternative CTA click rate: >50% (guide to unlimited effects)

**Cold Start Perception**:
- User perception survey: "How fast did the AI feel?" → 4+ / 5 stars
- Abandonment rate during loading: <10%
- Retry rate after cold start: <5%

### Tracking Implementation

**Google Analytics 4 Events**:
```javascript
// Effect selector interaction
gtag('event', 'effect_selected', {
  effect_name: 'modern',
  quota_remaining: 8,
  quota_level: 1,
  user_type: 'new_visitor'
});

// Generation started
gtag('event', 'generation_started', {
  effect_name: 'modern',
  cold_start: true,
  quota_remaining: 8
});

// Generation completed
gtag('event', 'generation_completed', {
  effect_name: 'modern',
  processing_time: 5.2,
  quota_remaining: 7,
  quota_level: 2,
  cached: false
});

// Warning shown
gtag('event', 'quota_warning_shown', {
  warning_level: 2,
  quota_remaining: 6,
  warning_type: 'gentle_reminder'
});

// Warning dismissed
gtag('event', 'quota_warning_dismissed', {
  warning_level: 2,
  quota_remaining: 6
});

// Exhausted state
gtag('event', 'quota_exhausted', {
  total_generated: 10,
  session_duration: 1200, // seconds
  converted_to_unlimited: false
});

// Alternative CTA clicked
gtag('event', 'alternative_effect_clicked', {
  from_effect: 'modern',
  to_effect: 'blackwhite',
  quota_remaining: 0,
  trigger: 'exhausted_modal'
});

// Email notification signup
gtag('event', 'quota_reset_notification_signup', {
  email_provided: true
});
```

**Heatmap Tracking** (Hotjar/Microsoft Clarity):
- Click patterns on effect buttons at different quota levels
- Scroll depth on exhausted modal
- Rage clicks on disabled AI effects
- Exit patterns when quota warnings appear

### A/B Test Opportunities

**Test 1: Badge Visibility**
- Variant A: Always show badge (current design)
- Variant B: Only show badge at Level 2+ (hide at Level 1)
- Hypothesis: Hiding badge at Level 1 reduces anxiety, increases usage

**Test 2: Warning Tone**
- Variant A: Positive framing ("8 generations left!")
- Variant B: Neutral framing ("8/10 used")
- Variant C: Urgent framing ("Only 8 remaining")
- Hypothesis: Positive framing increases usage without panic

**Test 3: Exhausted Modal CTA**
- Variant A: "Try Enhanced B&W" (unlimited effect)
- Variant B: "Browse Products" (conversion-focused)
- Variant C: "Come Back Tomorrow" (retention-focused)
- Hypothesis: Variant B drives higher conversion

**Test 4: Cold Start Messaging**
- Variant A: Technical explanation ("Warming up AI model...")
- Variant B: Friendly explanation ("Creating your masterpiece...")
- Variant C: No explanation (just progress bar)
- Hypothesis: Variant B reduces perceived wait time

---

## Implementation Checklist

### Phase 1: Core UI (Week 1)
- [ ] Design effect selector layout (mobile + desktop)
- [ ] Implement badge system (4 variants)
- [ ] Create quota state management module
- [ ] Build localStorage persistence
- [ ] Add keyboard navigation support
- [ ] Write unit tests for quota logic

### Phase 2: Warning System (Week 1-2)
- [ ] Build Level 1 UI (silent badge)
- [ ] Build Level 2 UI (gentle reminder)
- [ ] Build Level 3 UI (urgent warning)
- [ ] Build Level 4 UI (exhausted modal)
- [ ] Implement dismissal logic
- [ ] Add ARIA labels and screen reader support

### Phase 3: Loading Experience (Week 2)
- [ ] Design cold start loading state
- [ ] Implement progress bar with stages
- [ ] Build API pre-warming system
- [ ] Add loading animations (shimmer, pulse)
- [ ] Create error states (timeout, failure)
- [ ] Test on slow 3G connections

### Phase 4: Backend Integration (Week 2-3)
- [ ] Set up Firestore quota tracking
- [ ] Implement rate limiting logic
- [ ] Build /api/v1/generate endpoint
- [ ] Build /api/v1/quota endpoint
- [ ] Add SHA256 caching
- [ ] Deploy to Cloud Run

### Phase 5: Polish & Testing (Week 3-4)
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Accessibility audit (WCAG 2.1 AAA)
- [ ] Performance optimization (<50KB bundle)
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)
- [ ] Load testing (100 concurrent users)
- [ ] Security review (rate limit bypass prevention)

### Phase 6: Launch & Monitor (Week 4+)
- [ ] Soft launch to 10% of traffic
- [ ] Monitor quota exhaustion rate
- [ ] A/B test warning variants
- [ ] Collect user feedback
- [ ] Optimize based on metrics
- [ ] Full rollout to 100%

---

## Appendix: Copy Bank

### Effect Descriptions

**Modern (Ink Wash)**:
- Short: "AI-powered artistic effect"
- Medium: "Transform your pet into a beautiful ink wash painting"
- Long: "Using advanced AI, we'll create a stunning ink wash painting of your pet with delicate brushstrokes and artistic flair"

**Classic (Van Gogh)**:
- Short: "AI-powered artistic effect"
- Medium: "Give your pet the Van Gogh treatment"
- Long: "Transform your pet photo into a masterpiece with swirling brushstrokes and vibrant colors inspired by Vincent van Gogh"

### Warning Messages

**Level 2 (Gentle Reminder)**:
- "💡 Tip: You have {N} AI generations remaining today. They reset at midnight PST."
- "You have {N} AI effects left today. Enhanced B&W and Color are unlimited!"
- "✨ {N} AI generations remaining. Create wisely!"

**Level 3 (Urgent Warning)**:
- "⚠️ You're running low on AI generations. You have {N} left today."
- "Running low! You have {N} AI generations left today. Choose carefully!"
- "⚠️ Only {N} AI effects remaining today. Try Enhanced B&W (unlimited) if you want to experiment more."

**Level 4 (Exhausted)**:
- "🎨 Amazing work! You've created 10 beautiful AI effects today."
- "You've used all 10 AI generations today. Your quota resets at midnight PST."
- "Daily limit reached. You can still use Enhanced B&W and Color (unlimited)!"

### Loading Messages

**Cold Start**:
- "Creating your masterpiece..." (0-20%)
- "Warming up AI model..." (20-40%)
- "Generating artistic effect..." (40-70%)
- "Applying final touches..." (70-90%)
- "Almost done!" (90-100%)

**Warm Start**:
- "Uploading your image..." (0-30%)
- "Generating artistic effect..." (30-80%)
- "Finalizing..." (80-100%)

### Error Messages

**Quota Exceeded**:
- "Daily limit reached. Your quota resets at midnight PST."
- "You've used all 10 AI generations today. Try Enhanced B&W (unlimited) instead!"

**API Timeout**:
- "The AI is taking longer than expected. This happens rarely."
- "Still processing... Thanks for your patience!"

**Generation Failed**:
- "We couldn't generate your effect. Your quota has NOT been used."
- "Something went wrong. Let's try again! (Your quota is safe)"

**Network Error**:
- "AI effects require internet. Please check your connection."
- "No connection detected. Please check your internet and try again."

---

## Final Design Philosophy

**Remember**: We're not selling AI effects - we're selling pet products. AI effects are a **free conversion tool**, not a revenue source. Every design decision must optimize for:

1. **Discovery** → "Wow, this is amazing!"
2. **Engagement** → "Let me try them all!"
3. **Conversion** → "I'm ordering this!"

The quota system exists to prevent abuse and control costs, but it should **feel like premium value**, not artificial scarcity. Users should feel grateful they get 10 free AI generations per day, not frustrated they "only" get 10.

**Guiding Principle**: Make the magic accessible, make the limits understandable, and make the alternatives delightful.

---

**End of UX Design Specification**

**Next Steps**:
1. Review with stakeholders
2. Create visual mockups in Figma
3. Build interactive prototype
4. Conduct usability testing with 5-10 users
5. Iterate based on feedback
6. Implement in phases

**Questions or Feedback**: Append to `.claude/tasks/context_session_001.md`
