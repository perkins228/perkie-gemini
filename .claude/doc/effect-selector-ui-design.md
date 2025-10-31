# Effect Selector UI Design Specification

**Version**: 1.0
**Date**: 2025-10-30
**Status**: Design Specification (Implementation Pending)
**Session Context**: `.claude/tasks/context_session_001.md`

---

## Overview

This document provides a complete design specification for updating the effect selector UI to replace **Pop Art** and **Dithering** with **Modern (Ink Wash)** and **Classic (Van Gogh)** AI-powered effects. The design prioritizes mobile usability (70% of traffic), visual differentiation of AI effects, and seamless integration with the existing `gemini-effects-ui.js` quota badge system.

---

## Design Objectives

1. **Replace legacy effects** with new AI-powered styles while maintaining UI consistency
2. **Visual differentiation** to show Modern/Classic as premium AI features
3. **Mobile-first touch targets** with minimum 48x48px tap areas and 12px spacing
4. **Badge integration** for quota indicators managed by `gemini-effects-ui.js`
5. **Accessibility** with ARIA labels, focus states, and disabled state clarity
6. **Progressive disclosure** of AI limitations without overwhelming users

---

## Button Order & Effects

### New Effect Order
Per user requirement: **B&W → Color → Modern → Classic**

| Position | Effect | Type | Icon | Label | Quota |
|----------|--------|------|------|-------|-------|
| 1 | `enhancedblackwhite` | Unlimited | ⚫⚪ | B&W | None |
| 2 | `color` | Unlimited | 🌈 | Color | None |
| 3 | `modern` | AI (10/day) | 🖌️ | Modern | Badge |
| 4 | `classic` | AI (10/day) | 🎨 | Classic | Badge |

**Rationale**: Placing unlimited effects first (B&W, Color) establishes baseline options before introducing premium AI effects (Modern, Classic). This creates a natural progression from familiar to novel.

---

## HTML Structure

### Updated Effect Selector Markup

```html
<!-- Effect Grid Container -->
<div class="effect-grid-wrapper">
  <div class="effect-grid" role="group" aria-label="Effect selection">

    <!-- B&W - Unlimited -->
    <button class="effect-btn active"
            data-effect="enhancedblackwhite"
            aria-label="Black and white effect, unlimited"
            aria-pressed="true">
      <span class="effect-emoji" aria-hidden="true">⚫⚪</span>
      <span class="effect-name">B&W</span>
    </button>

    <!-- Color - Unlimited -->
    <button class="effect-btn"
            data-effect="color"
            aria-label="Color effect, unlimited"
            aria-pressed="false">
      <span class="effect-emoji" aria-hidden="true">🌈</span>
      <span class="effect-name">Color</span>
    </button>

    <!-- Modern (Ink Wash) - AI Limited -->
    <button class="effect-btn effect-btn--ai"
            data-effect="modern"
            aria-label="Modern ink wash effect, AI-powered, 10 per day"
            aria-pressed="false">
      <span class="effect-emoji" aria-hidden="true">🖌️</span>
      <span class="effect-name">Modern</span>
      <!-- Badge inserted here by gemini-effects-ui.js -->
    </button>

    <!-- Classic (Van Gogh) - AI Limited -->
    <button class="effect-btn effect-btn--ai"
            data-effect="classic"
            aria-label="Classic Van Gogh effect, AI-powered, 10 per day"
            aria-pressed="false">
      <span class="effect-emoji" aria-hidden="true">🎨</span>
      <span class="effect-name">Classic</span>
      <!-- Badge inserted here by gemini-effects-ui.js -->
    </button>

  </div>
</div>
```

### Key Structural Changes

1. **New BEM modifier**: `.effect-btn--ai` for AI-powered effects
2. **ARIA enhancements**:
   - `aria-label` describes effect + quota status
   - `aria-pressed` indicates selected state
   - `role="group"` on grid container
3. **Badge placeholder**: Badges dynamically inserted by `gemini-effects-ui.js`
4. **Icon selection**:
   - Modern: 🖌️ (brush) represents East Asian ink wash painting
   - Classic: 🎨 (palette) represents impressionist painting
   - Alternative icons if needed: Modern (🎋 bamboo, 🌊 wave), Classic (🖼️ framed picture, 🌻 sunflower)

---

## CSS Styling

### Base Effect Button Styles (Existing)

```css
/* Keep existing .effect-grid and .effect-btn base styles */
.effect-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem; /* 12px spacing for desktop */
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.effect-btn {
  background: rgba(var(--color-foreground), 0.05);
  border: 2px solid rgba(var(--color-foreground), 0.1);
  border-radius: 8px;
  padding: 1rem 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 48px; /* Touch target */
  min-width: 48px; /* Touch target */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative; /* For badge positioning */

  /* Mobile touch optimizations */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.effect-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.effect-btn.active {
  border-color: rgb(var(--color-button));
  background: rgba(var(--color-button), 0.1);
  color: rgb(var(--color-button));
}
```

### New AI Effect Button Styling

```css
/* AI Effect Differentiation */
.effect-btn--ai {
  /* Subtle gradient background to distinguish AI effects */
  background: linear-gradient(
    135deg,
    rgba(157, 80, 187, 0.08) 0%,    /* Purple tint */
    rgba(79, 172, 254, 0.08) 100%   /* Blue tint */
  );
  border: 2px solid rgba(157, 80, 187, 0.2);
  position: relative;
  overflow: visible; /* Allow badge to overflow if needed */
}

/* AI button hover state - enhanced shimmer effect */
.effect-btn--ai:hover {
  background: linear-gradient(
    135deg,
    rgba(157, 80, 187, 0.15) 0%,
    rgba(79, 172, 254, 0.15) 100%
  );
  border-color: rgba(157, 80, 187, 0.4);
  box-shadow: 0 4px 20px rgba(157, 80, 187, 0.3);
}

/* AI button active state */
.effect-btn--ai.active {
  background: linear-gradient(
    135deg,
    rgba(157, 80, 187, 0.2) 0%,
    rgba(79, 172, 254, 0.2) 100%
  );
  border-color: rgb(157, 80, 187);
  color: rgb(157, 80, 187);
  box-shadow: 0 0 0 3px rgba(157, 80, 187, 0.1);
}

/* Subtle sparkle animation on AI buttons */
.effect-btn--ai::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(
    45deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  border-radius: 8px;
  opacity: 0;
  animation: shimmer 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes shimmer {
  0%, 100% {
    opacity: 0;
    transform: translateX(-100%);
  }
  50% {
    opacity: 1;
    transform: translateX(100%);
  }
}

/* Disabled state for quota exhaustion */
.effect-btn--ai:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(var(--color-foreground), 0.03);
  border-color: rgba(var(--color-foreground), 0.1);
  animation: none; /* Stop shimmer */
}

.effect-btn--ai:disabled::before {
  display: none; /* Hide shimmer overlay */
}

.effect-btn--ai:disabled .effect-emoji {
  filter: grayscale(100%);
  opacity: 0.6;
}

.effect-btn--ai:disabled .effect-name {
  opacity: 0.6;
}

/* Focus state for accessibility */
.effect-btn:focus-visible {
  outline: 3px solid rgb(var(--color-button));
  outline-offset: 2px;
}

.effect-btn--ai:focus-visible {
  outline-color: rgb(157, 80, 187);
}
```

### Badge Positioning (Managed by gemini-effects-ui.js)

```css
/* Badge container - set on button by gemini-effects-ui.js */
.effect-btn {
  position: relative; /* Already set in base styles */
}

/* Badge positioning strategy - badges are absolutely positioned by JS */
.gemini-quota-badge {
  /* Positioning set inline by gemini-effects-ui.js:
   * position: absolute;
   * top: 8px;
   * right: 8px;
   */
  z-index: 10;
  pointer-events: none; /* Don't interfere with button clicks */

  /* Ensure badge doesn't overflow on small screens */
  max-width: calc(100% - 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Badge states are managed by gemini-effects-ui.js:
 * - Level 1 (10-7): "✨ AI" - minimal badge
 * - Level 2 (6-4): "N left" - subtle badge
 * - Level 3 (3-1): "N left" - warning badge with pulse
 * - Level 4 (0): "0 left" - exhausted badge
 */
```

---

## Mobile Layout Strategy

### Mobile Breakpoints

```css
/* Mobile Portrait - 768px and below (70% of traffic) */
@media screen and (max-width: 768px) {
  .effect-grid {
    gap: 2vw; /* Responsive spacing ~7-10px */
    padding: 0 0.5rem; /* Side padding for edge breathing room */
  }

  .effect-btn {
    padding: 3vw 2vw; /* Responsive padding */
    min-height: 48px; /* Maintain touch target */
    gap: 2vw; /* Responsive gap between emoji and text */
    border-radius: 6px; /* Slightly smaller radius */
  }

  .effect-btn span {
    font-size: clamp(0.75rem, 3.5vw, 1.5rem);
    line-height: 1.1;
  }

  .effect-emoji {
    font-size: clamp(2.5rem, 12vw, 5rem);
  }

  /* Reduce badge size on mobile */
  .gemini-quota-badge {
    font-size: 9px !important;
    padding: 2px 6px !important;
  }
}

/* Extra Small Mobile - 375px and below */
@media screen and (max-width: 375px) {
  .effect-grid {
    gap: 1.5vw; /* Tighter spacing ~5-6px */
    padding: 0 0.25rem;
  }

  .effect-btn {
    padding: 2.5vw 1.5vw;
    min-height: 48px; /* Still maintain touch target */
    gap: 2vw;
  }

  .effect-btn span {
    font-size: clamp(0.7rem, 3vw, 1.2rem);
    line-height: 1;
  }

  .effect-emoji {
    font-size: clamp(2rem, 10vw, 3.5rem);
  }

  /* Micro badge for tiny screens */
  .gemini-quota-badge {
    font-size: 8px !important;
    padding: 1px 4px !important;
    top: 4px !important;
    right: 4px !important;
  }
}
```

### Touch Target Compliance

- **Minimum touch target**: 48x48px maintained across all breakpoints
- **Spacing**: 12px desktop, 7-10px mobile (2vw), 5-6px extra small (1.5vw)
- **Thumb zone**: Buttons positioned in easy-to-reach areas (center of screen)
- **No horizontal scroll**: Grid stays within viewport at all breakpoints

---

## Icon Recommendations

### Selected Icons

| Effect | Primary Icon | Rationale | Alternative Options |
|--------|-------------|-----------|---------------------|
| **Modern** | 🖌️ Brush | Universal symbol for East Asian brush painting | 🎋 Bamboo (cultural), 🌊 Wave (artistic) |
| **Classic** | 🎨 Palette | Represents impressionist painting tradition | 🖼️ Frame (gallery), 🌻 Sunflower (Van Gogh signature) |

### Icon Accessibility

- **Size**: `clamp(2rem, 10vw, 3.5rem)` ensures legibility on all devices
- **Contrast**: Emojis render in native OS colors for maximum visibility
- **Fallback**: If emoji rendering fails, text labels remain clear
- **ARIA**: Icons marked `aria-hidden="true"` so screen readers use button labels

### Icon Testing Checklist

- [ ] Test emoji rendering on iOS Safari (primary mobile browser)
- [ ] Test emoji rendering on Android Chrome
- [ ] Test emoji rendering on desktop browsers (Chrome, Firefox, Safari)
- [ ] Verify emoji doesn't break layout on small screens (<360px)
- [ ] Confirm emoji color contrast meets WCAG AA (3:1 minimum for graphics)

---

## Badge Integration Strategy

### Badge Insertion Points

Badges are dynamically inserted by `gemini-effects-ui.js` into buttons with `data-effect="modern"` or `data-effect="classic"`. The UI system looks for these selectors:

```javascript
// From gemini-effects-ui.js:251-253
const modernBtn = this.container.querySelector('[data-effect="modern"]');
const classicBtn = this.container.querySelector('[data-effect="classic"]');
```

### Badge Lifecycle

1. **Initial load**: `GeminiEffectsUI.initialize()` creates badge container
2. **Quota check**: `updateEffectBadges()` inserts/updates badges based on warning level
3. **User interaction**: Badges update after each API call via `updateUI()`
4. **Midnight reset**: `checkQuotaReset()` resets badges to Level 1 state

### Badge Visual Hierarchy

```
Level 1 (Silent):     ✨ AI           - Subtle, informational
Level 2 (Reminder):   N left          - Neutral, white badge
Level 3 (Warning):    N left (pulse)  - Orange, animated
Level 4 (Exhausted):  0 left          - Red, static
```

### Badge Positioning in Button

```html
<button class="effect-btn effect-btn--ai" data-effect="modern">
  <span class="effect-emoji">🖌️</span>
  <span class="effect-name">Modern</span>
  <span class="gemini-quota-badge">✨ AI</span> <!-- Inserted by JS -->
</button>
```

**Positioning**:
- Top-right corner: `top: 8px; right: 8px;` (desktop)
- Slightly inset on mobile: `top: 4px; right: 4px;` (small screens)
- Z-index: 10 to overlay button content
- Pointer-events: none to avoid blocking button clicks

---

## Accessibility Requirements

### ARIA Labels

```html
<!-- Unlimited effect -->
<button aria-label="Black and white effect, unlimited" aria-pressed="false">

<!-- AI effect with quota -->
<button aria-label="Modern ink wash effect, AI-powered, 10 per day" aria-pressed="false">

<!-- AI effect exhausted -->
<button aria-label="Modern ink wash effect, AI-powered, quota exhausted"
        aria-pressed="false"
        disabled
        aria-disabled="true">
```

### Focus States

- **Visible outline**: 3px solid, offset 2px
- **Color coding**: Standard effects use `--color-button`, AI effects use purple (#9d50bb)
- **No focus trap**: Tab order follows visual order (B&W → Color → Modern → Classic)

### Screen Reader Announcements

```javascript
// When effect is selected
button.setAttribute('aria-pressed', 'true');
// Announce: "Modern ink wash effect selected"

// When quota exhausted
button.setAttribute('aria-disabled', 'true');
button.title = 'Daily AI limit reached. Try B&W or Color (unlimited)';
// Announce: "Modern ink wash effect, unavailable, Daily AI limit reached"
```

### Keyboard Navigation

- **Tab**: Move between effect buttons
- **Space/Enter**: Activate selected button
- **Arrow keys**: (Optional enhancement) Left/Right to cycle through effects
- **Escape**: (If in comparison mode) Exit comparison overlay

### Color Contrast Requirements

| Element | Foreground | Background | Ratio | WCAG Level |
|---------|-----------|------------|-------|------------|
| Button text | `--color-foreground` | Button background | 4.5:1 | AA |
| Active state | `--color-button` | Active background | 4.5:1 | AA |
| AI button text | #9d50bb | AI background | 4.5:1 | AA |
| Badge text | #fff | Badge background | 4.5:1 | AA |
| Disabled text | 0.5 opacity | Button background | 3:1 | AA (graphics) |

---

## Visual Differentiation: AI Effects

### Design Goal
Make Modern and Classic buttons feel **premium and special** without being **overwhelming or gimmicky**.

### Visual Hierarchy Strategy

**Unlimited Effects (B&W, Color)**:
- Clean, minimal design
- Neutral gray background
- Subtle hover state
- Clear, friendly

**AI Effects (Modern, Classic)**:
- Purple-blue gradient background (subtle, not garish)
- Shimmer animation (slow, elegant, 3s cycle)
- Enhanced hover state with glow
- Quota badge in top-right corner
- Disabled state: grayscale + reduced opacity

### Psychological Framing

1. **First impression**: "These are different and special" (gradient + shimmer)
2. **Exploration**: "I can try this 10 times today" (badge shows remaining)
3. **Decision point**: "Should I use one now?" (warning states at low quota)
4. **Post-exhaustion**: "I can always use B&W or Color" (helpful disabled message)

### Avoiding Pitfalls

- **Don't**: Use aggressive animations that distract from the image
- **Don't**: Make AI effects look "locked" or premium-only (they're free with limits)
- **Don't**: Hide the quota limitation until it's too late
- **Do**: Use subtle, elegant visual cues that match the brand
- **Do**: Progressive disclosure (silent → reminder → warning → exhausted)
- **Do**: Maintain parity with unlimited effects (same size, same prominence)

---

## User Flow Examples

### Scenario 1: First-time User (10/10 quota remaining)

```
1. User uploads pet photo
2. Processing completes, effect selector appears
3. B&W is auto-selected (default)
4. User sees 4 buttons: B&W, Color, Modern✨, Classic✨
5. Modern and Classic have subtle gradient + "✨ AI" badge
6. User clicks Modern → Loading state → Effect applied
7. Badge updates to "9 left" (silent, white badge)
8. User continues exploring effects
```

**Design notes**:
- Shimmer animation catches eye but doesn't demand attention
- "✨ AI" badge is informational, not alarming
- User discovers AI effects organically

### Scenario 2: Power User (3/10 remaining - Warning Level)

```
1. User uploads pet photo
2. Effect selector appears with updated badges
3. Modern shows "3 left" in orange with pulse animation
4. Classic shows "3 left" in orange with pulse animation
5. Toast notification: "⚠️ Running low! 3 AI generations remaining"
6. Warning banner appears above buttons (persistent)
7. User carefully selects Modern for their favorite photo
8. Badge updates to "2 left" with same warning state
```

**Design notes**:
- Orange badges are prominent but not panic-inducing
- Pulse animation draws attention without being frantic
- Banner provides context and alternative options
- User feels empowered to make informed choice

### Scenario 3: Quota Exhausted (0/10 remaining)

```
1. User uploads pet photo
2. Effect selector appears with exhausted state
3. B&W and Color buttons are normal (unlimited)
4. Modern and Classic show "0 left" in red badge
5. Modern and Classic are disabled (grayscale, 0.5 opacity)
6. Toast: "🎉 You've created 10 AI masterpieces today! Try B&W or Color"
7. Banner: "Daily AI Limit Reached" with helpful message
8. User clicks disabled button → Toast: "Out of AI generations! Try B&W"
```

**Design notes**:
- Celebration framing ("masterpieces") reduces frustration
- Unlimited alternatives are clearly visible and accessible
- Disabled state is obvious but not punitive
- Clicking disabled button gives helpful feedback, not just silence

---

## Implementation Files

### Files to Modify

1. **`assets/pet-processor.js`** (lines 316-337)
   - Update HTML template in `render()` method
   - Replace `popart` and `dithering` with `modern` and `classic`
   - Add `.effect-btn--ai` class to new buttons
   - Update ARIA labels

2. **`assets/pet-processor-v5.css`** (lines 252-365)
   - Add `.effect-btn--ai` styles
   - Add shimmer animation keyframes
   - Add disabled state overrides
   - Update mobile responsive styles
   - Add badge positioning utilities

3. **`assets/gemini-effects-ui.js`** (lines 251-332)
   - **No changes needed** - already looks for `data-effect="modern"` and `data-effect="classic"`
   - Badge insertion logic is selector-based, will work automatically

4. **Testing files** (optional updates)
   - `testing/pet-processor-v5-test.html` - Update effect buttons
   - `testing/mobile-tests/test-effect-carousel.html` - Update for new effects

### Integration Dependencies

- **Gemini Client**: `gemini-effects-ui.js` must be loaded after `pet-processor.js`
- **localStorage**: Effect selection persists via existing session management
- **Comparison Manager**: Long-press comparison works with new effect IDs
- **Cart System**: Product data uses effect IDs (B&W, Color, Modern, Classic)

---

## Testing Checklist

### Visual Testing

- [ ] Buttons render correctly on desktop (Chrome, Firefox, Safari)
- [ ] Buttons render correctly on mobile iOS (Safari)
- [ ] Buttons render correctly on mobile Android (Chrome)
- [ ] Gradient backgrounds display properly (no banding)
- [ ] Shimmer animation is smooth and subtle (not janky)
- [ ] Emojis render correctly across all platforms
- [ ] Badges position correctly in top-right corner
- [ ] Badges don't overflow button boundaries on small screens

### Functional Testing

- [ ] Clicking B&W applies effect (unlimited)
- [ ] Clicking Color applies effect (unlimited)
- [ ] Clicking Modern applies effect (decrements quota)
- [ ] Clicking Classic applies effect (decrements quota)
- [ ] Badges update after each Modern/Classic use
- [ ] Warning states trigger at 6, 3, and 0 remaining
- [ ] Disabled state prevents clicks on exhausted buttons
- [ ] Clicking disabled button shows helpful toast
- [ ] Midnight reset restores quota and badges

### Mobile Touch Testing

- [ ] Touch targets are minimum 48x48px
- [ ] Buttons have 7-10px spacing on mobile
- [ ] No accidental clicks on adjacent buttons
- [ ] Tap feedback is immediate (no 300ms delay)
- [ ] Long-press comparison works on Modern/Classic
- [ ] Swipe gestures don't interfere with button clicks
- [ ] Buttons stay within viewport on all screen sizes (320px - 768px)

### Accessibility Testing

- [ ] Screen reader announces button labels correctly
- [ ] Screen reader announces quota status
- [ ] Screen reader announces disabled state
- [ ] Tab order follows visual order (B&W → Color → Modern → Classic)
- [ ] Focus outline is visible on all buttons
- [ ] Focus outline has sufficient contrast (3:1 minimum)
- [ ] Keyboard activation works (Space/Enter)
- [ ] ARIA attributes update dynamically

### Performance Testing

- [ ] Shimmer animation doesn't cause layout shift
- [ ] Badge insertion doesn't cause reflow
- [ ] Effect switching is instant (<100ms perceived)
- [ ] No memory leaks after 20+ effect switches
- [ ] Mobile performance is smooth (60fps maintained)

---

## Responsive Design Matrix

| Screen Size | Grid Columns | Button Size | Emoji Size | Badge Size | Gap |
|-------------|-------------|-------------|------------|------------|-----|
| Desktop (769px+) | 4 equal | 120-150px | 3.5-5rem | 10-11px | 12px |
| Tablet (376-768px) | 4 equal | 80-120px | 2.5-5rem | 9px | 7-10px (2vw) |
| Mobile (320-375px) | 4 equal | 70-80px | 2-3.5rem | 8px | 5-6px (1.5vw) |

**Constraints**:
- Minimum button size: 48x48px (touch target) at all breakpoints
- Maximum emoji: 5rem (80px) to prevent overwhelming layout
- Minimum gap: 5px to prevent accidental touches
- Maximum grid width: 600px to prevent buttons from stretching too wide

---

## Animation Specifications

### Shimmer Animation (AI Buttons Only)

```css
@keyframes shimmer {
  0%, 100% {
    opacity: 0;
    transform: translateX(-100%);
  }
  50% {
    opacity: 1;
    transform: translateX(100%);
  }
}

.effect-btn--ai::before {
  animation: shimmer 3s ease-in-out infinite;
}
```

**Properties**:
- Duration: 3s (slow enough to be subtle)
- Timing: ease-in-out (smooth acceleration/deceleration)
- Iteration: infinite (continuous background effect)
- Opacity: 0 → 1 → 0 (fade in/out for smoothness)
- Transform: translateX(-100% → 100%) (sweeps left to right)

**Performance considerations**:
- Uses `transform` (GPU-accelerated) instead of `left/right` (CPU-bound)
- Uses `::before` pseudo-element to avoid repainting button content
- `will-change` intentionally NOT used (animation is lightweight enough)

### Pulse Animation (Warning Badges)

```css
@keyframes badgePulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.gemini-quota-badge {
  animation: badgePulse 2s ease-in-out infinite;
}
```

**Properties**:
- Duration: 2s (faster than shimmer to draw attention)
- Timing: ease-in-out (gentle breathing effect)
- Scale: 1.0 → 1.1 → 1.0 (subtle 10% growth)
- Applied: Only at warning level 3 (3-1 remaining)

---

## Design Rationale

### Why This Order (B&W → Color → Modern → Classic)?

1. **Familiarity first**: B&W and Color are standard photo effects users expect
2. **Unlimited baseline**: Establishes "safe" options before introducing limits
3. **Graduated novelty**: Modern (East Asian) is less familiar than Classic (Western), so comes first to maximize experimentation
4. **Visual balance**: Alternating unlimited/AI creates 2+2 visual grouping without hard dividers

### Why Gradients Instead of Solid Colors?

1. **Sophistication**: Gradients signal "premium" without screaming "pay more"
2. **Brand alignment**: Purple/blue gradient matches AI/tech aesthetic
3. **Subtle differentiation**: Doesn't compete with the actual pet photo
4. **Accessibility**: Gradient provides visual interest while maintaining contrast ratio

### Why Shimmer Animation?

1. **Attention without distraction**: 3s cycle is slow enough to avoid eye fatigue
2. **Premium signal**: Mimics "shimmer" effect on premium physical products (holographic cards, metallic finishes)
3. **Discoverability**: Gentle movement catches peripheral vision
4. **Stoppable**: Animation pauses on hover/focus to avoid distracting during interaction

### Why Top-Right Badge Placement?

1. **Non-intrusive**: Doesn't block emoji or text label
2. **Scanning pattern**: Western readers scan top-right for "new" or "status" indicators
3. **Mobile-friendly**: Thumb doesn't cover badge when tapping button center
4. **Consistent**: Matches platform conventions (notification badges, counts)

---

## Edge Cases & Error Handling

### Case 1: Badge Insertion Fails

**Symptom**: `gemini-effects-ui.js` can't find button selectors
**Cause**: Incorrect `data-effect` attribute or timing issue
**Fallback**: Buttons still function, just without quota badges
**Solution**: Defensive coding in `updateEffectBadges()` - check if button exists before inserting badge

### Case 2: Emoji Rendering Fails

**Symptom**: Emojis show as boxes (□) or missing glyphs
**Cause**: Older OS or browser without emoji font
**Fallback**: Text labels remain visible and clear
**Solution**: CSS fallback font stack: `font-family: 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;`

### Case 3: Quota API Fails

**Symptom**: Can't fetch current quota from backend
**Cause**: Network error, API timeout, or server issue
**Fallback**: Default to "0 left" (safest assumption)
**Solution**: Show informative error: "Can't check AI quota. Try B&W or Color."

### Case 4: Disabled Button Clicked Repeatedly

**Symptom**: User spam-clicks disabled Modern/Classic button
**Cause**: Frustration or confusion about quota limits
**Fallback**: First click shows toast, subsequent clicks do nothing
**Solution**: Add `{ once: true }` to event listener in `gemini-effects-ui.js:352`

### Case 5: Screen Width < 320px

**Symptom**: Buttons too small or text truncates
**Cause**: Ultra-narrow viewport (e.g., iPhone SE portrait with browser chrome)
**Fallback**: Buttons maintain 48px minimum height, emoji scales down, text wraps
**Solution**: Use `clamp()` for all sizing to ensure readability floor

---

## Future Enhancements (Out of Scope)

### Phase 2 Considerations

1. **Effect preview on hover**: Show thumbnail of effect before clicking
2. **Drag-to-compare**: Swipe between effects in comparison mode
3. **Favorite effects**: Pin most-used effect to first position
4. **Effect categories**: Group by type (Classic, Modern, Artistic, etc.)
5. **Effect descriptions**: Tooltip explaining what each effect does
6. **Quota sharing**: Share unused AI quota with friends/family
7. **Premium tier**: Unlock unlimited AI effects with subscription

### Analytics to Track

- Click-through rate: B&W vs Color vs Modern vs Classic
- Conversion rate: Which effect drives most cart adds?
- Quota exhaustion rate: How many users hit 0/10 daily?
- Abandonment rate: Do users leave after seeing disabled AI buttons?
- Mobile vs desktop: Different effect preferences by device?

---

## Success Metrics

### Adoption Metrics (Week 1)

- [ ] 40%+ of users try Modern or Classic at least once
- [ ] 20%+ of users use all 10 daily AI quota
- [ ] <5% of users complain about quota limits in support tickets
- [ ] 0 accessibility violations in WAVE audit

### Engagement Metrics (Month 1)

- [ ] 15%+ of final cart items use Modern or Classic effects
- [ ] Average 4-6 AI generations per user per day
- [ ] 25%+ of returning users come back next day for quota reset
- [ ] Net Promoter Score (NPS) remains stable or increases

### Technical Metrics (Ongoing)

- [ ] <100ms perceived latency when switching effects
- [ ] 60fps maintained during shimmer animation on mobile
- [ ] <0.1% badge insertion failures
- [ ] 100% WCAG AA compliance on contrast and focus states

---

## Approval Checklist

Before implementing, confirm:

- [ ] **Business**: Modern (Ink Wash) and Classic (Van Gogh) align with product strategy
- [ ] **Design**: Visual differentiation is subtle yet noticeable
- [ ] **Engineering**: Gemini API integration is ready for Modern/Classic effects
- [ ] **UX**: User testing confirms button order makes sense
- [ ] **Accessibility**: ARIA labels and focus states meet WCAG AA
- [ ] **Mobile**: Touch targets and spacing meet platform guidelines (Apple HIG, Material Design)
- [ ] **Legal**: AI-generated effects comply with licensing and attribution requirements

---

## Implementation Timeline

| Phase | Tasks | Duration | Owner |
|-------|-------|----------|-------|
| **Phase 1: HTML/CSS** | Update `pet-processor.js` template, add CSS styles | 2 hours | Frontend Dev |
| **Phase 2: Testing** | Manual testing on desktop/mobile, accessibility audit | 3 hours | QA |
| **Phase 3: Gemini Integration** | Verify badge system works with new selectors | 1 hour | Integration Dev |
| **Phase 4: Polish** | Fine-tune animations, adjust spacing, fix edge cases | 2 hours | Frontend Dev |
| **Phase 5: Deployment** | Push to test environment, monitor Shopify logs | 1 hour | DevOps |

**Total**: ~9 hours (1-2 days)

---

## Appendix: Code Snippets

### Complete CSS for AI Effects

```css
/* AI Effect Button Styles - Add to pet-processor-v5.css */

.effect-btn--ai {
  background: linear-gradient(
    135deg,
    rgba(157, 80, 187, 0.08) 0%,
    rgba(79, 172, 254, 0.08) 100%
  );
  border: 2px solid rgba(157, 80, 187, 0.2);
  position: relative;
  overflow: visible;
}

.effect-btn--ai:hover {
  background: linear-gradient(
    135deg,
    rgba(157, 80, 187, 0.15) 0%,
    rgba(79, 172, 254, 0.15) 100%
  );
  border-color: rgba(157, 80, 187, 0.4);
  box-shadow: 0 4px 20px rgba(157, 80, 187, 0.3);
}

.effect-btn--ai.active {
  background: linear-gradient(
    135deg,
    rgba(157, 80, 187, 0.2) 0%,
    rgba(79, 172, 254, 0.2) 100%
  );
  border-color: rgb(157, 80, 187);
  color: rgb(157, 80, 187);
  box-shadow: 0 0 0 3px rgba(157, 80, 187, 0.1);
}

.effect-btn--ai::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(
    45deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  border-radius: 8px;
  opacity: 0;
  animation: shimmer 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes shimmer {
  0%, 100% {
    opacity: 0;
    transform: translateX(-100%);
  }
  50% {
    opacity: 1;
    transform: translateX(100%);
  }
}

.effect-btn--ai:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(var(--color-foreground), 0.03);
  border-color: rgba(var(--color-foreground), 0.1);
  animation: none;
}

.effect-btn--ai:disabled::before {
  display: none;
}

.effect-btn--ai:disabled .effect-emoji {
  filter: grayscale(100%);
  opacity: 0.6;
}

.effect-btn--ai:disabled .effect-name {
  opacity: 0.6;
}

.effect-btn:focus-visible {
  outline: 3px solid rgb(var(--color-button));
  outline-offset: 2px;
}

.effect-btn--ai:focus-visible {
  outline-color: rgb(157, 80, 187);
}

.gemini-quota-badge {
  z-index: 10;
  pointer-events: none;
  max-width: calc(100% - 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Mobile adjustments */
@media screen and (max-width: 768px) {
  .gemini-quota-badge {
    font-size: 9px !important;
    padding: 2px 6px !important;
  }
}

@media screen and (max-width: 375px) {
  .gemini-quota-badge {
    font-size: 8px !important;
    padding: 1px 4px !important;
    top: 4px !important;
    right: 4px !important;
  }
}
```

### Complete HTML Template

```javascript
// Update in pet-processor.js render() method (line ~316)

const effectGridHTML = `
  <div class="effect-grid-wrapper">
    <div class="effect-grid" role="group" aria-label="Effect selection">

      <button class="effect-btn active"
              data-effect="enhancedblackwhite"
              aria-label="Black and white effect, unlimited"
              aria-pressed="true">
        <span class="effect-emoji" aria-hidden="true">⚫⚪</span>
        <span class="effect-name">B&W</span>
      </button>

      <button class="effect-btn"
              data-effect="color"
              aria-label="Color effect, unlimited"
              aria-pressed="false">
        <span class="effect-emoji" aria-hidden="true">🌈</span>
        <span class="effect-name">Color</span>
      </button>

      <button class="effect-btn effect-btn--ai"
              data-effect="modern"
              aria-label="Modern ink wash effect, AI-powered, 10 per day"
              aria-pressed="false">
        <span class="effect-emoji" aria-hidden="true">🖌️</span>
        <span class="effect-name">Modern</span>
      </button>

      <button class="effect-btn effect-btn--ai"
              data-effect="classic"
              aria-label="Classic Van Gogh effect, AI-powered, 10 per day"
              aria-pressed="false">
        <span class="effect-emoji" aria-hidden="true">🎨</span>
        <span class="effect-name">Classic</span>
      </button>

    </div>
  </div>
`;
```

---

**End of Specification**

**Next Steps**:
1. Review and approve design specification
2. Coordinate with solution-verification-auditor for implementation planning
3. Coordinate with mobile-commerce-architect for mobile UX validation
4. Implement HTML/CSS changes in `pet-processor.js` and `pet-processor-v5.css`
5. Test on Playwright MCP with Shopify test URL
6. Deploy to main branch for auto-deployment to test environment
