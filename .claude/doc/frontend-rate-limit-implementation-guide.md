# Frontend Rate Limit Warning System - Implementation Guide

**Created**: 2025-10-30
**Status**: Ready for Implementation
**Target File**: `assets/pet-processor.js`
**Related Docs**:
- `rate-limit-warning-ux-implementation-plan.md` (UX Design)
- `rate-limit-communication-strategy.md` (Product Strategy)

---

## Executive Summary

This document provides step-by-step implementation instructions for the 4-level progressive rate limit warning system in the frontend. The system tracks Gemini API quota (6/day shared between Modern and Classic effects) and displays appropriate warnings without disrupting conversion flow.

**Implementation Time**: 3-4 hours
**Testing Time**: 1-2 hours
**Total Effort**: 1 day

---

## Rate Limit Context

### Quota Rules
- **Enhanced B&W**: Unlimited (InSPyReNet API)
- **Color**: Unlimited (InSPyReNet API)
- **Modern (Ink Wash)**: 6/day shared quota (Gemini API)
- **Classic (Van Gogh)**: 6/day shared quota (Gemini API)

### Warning Levels
1. **Level 1 (6-4 remaining)**: Silent badge only
2. **Level 2 (3 remaining)**: Toast notification
3. **Level 3 (1-2 remaining)**: Warning banner
4. **Level 4 (0 remaining)**: Exhausted state with alternatives

### Backend Integration
The backend API will return quota information in every response:
```json
{
  "status": "success",
  "image_url": "...",
  "quota_remaining": 5,
  "quota_limit": 6,
  "warning_level": 1,
  "quota_resets_at": "2025-10-31T00:00:00Z"
}
```

---

## Current Code Structure

### File to Modify
**Primary**: `assets/pet-processor.js` (Mobile-First ES6+ Implementation)

### Current Architecture
```javascript
// Main class structure (simplified)
class PetProcessor {
  constructor() {
    this.currentPet = null;
    this.selectedEffect = null;
    // ... other properties
  }

  async processEffect(effectName) {
    // Calls API
    // Displays result
  }
}
```

### Key Classes
- `PetProcessor`: Main processing logic
- `ComparisonManager`: Effect comparison UI
- `EffectManager`: Effect rendering and caching

---

## Implementation Plan

### Phase 1: Add Quota State Management

**File**: `assets/pet-processor.js`
**Location**: Inside `PetProcessor` class constructor

#### 1.1 Add Quota State Properties

**Where**: After existing properties in constructor (around line 200-220)

```javascript
constructor() {
  // ... existing properties ...

  // Quota tracking for Gemini effects
  this.geminiQuota = {
    remaining: 6,          // Current remaining generations
    limit: 6,              // Daily limit
    warningLevel: 1,       // Current warning level (1-4)
    resetTime: null,       // ISO timestamp of next reset
    lastUpdated: null      // Track when quota was last synced
  };

  // Quota UI elements (cached for performance)
  this.quotaElements = {
    modernBadge: null,
    classicBadge: null,
    toast: null,
    banner: null,
    exhaustedMessage: null
  };
}
```

**Assumptions**:
- Backend API is already modified to return quota info
- Session ID is tracked for user identification
- Quota resets at midnight local time

**Critical Notes**:
- Initialize to 6/6 to avoid showing warnings before first API call
- Cache DOM elements to avoid repeated queries
- Use null for resetTime until first API response

---

### Phase 2: Create Quota Update Function

**File**: `assets/pet-processor.js`
**Location**: As new method in `PetProcessor` class (around line 300-400)

#### 2.1 Main Quota Update Method

```javascript
/**
 * Updates quota state from API response
 * Called after every Gemini API call
 * @param {Object} response - API response containing quota info
 */
updateQuotaFromResponse(response) {
  // Validate response has quota data
  if (!response || response.quota_remaining === undefined) {
    console.warn('No quota data in API response');
    return;
  }

  // Extract quota information
  const newQuota = {
    remaining: response.quota_remaining,
    limit: response.quota_limit || 6,
    warningLevel: this.calculateWarningLevel(response.quota_remaining),
    resetTime: response.quota_resets_at,
    lastUpdated: new Date().toISOString()
  };

  // Store previous state for comparison
  const previousRemaining = this.geminiQuota.remaining;

  // Update state
  this.geminiQuota = newQuota;

  // Store in localStorage for persistence across page loads
  this.saveQuotaToStorage();

  // Update UI (always update badges, conditionally show warnings)
  this.updateQuotaUI(previousRemaining, newQuota.remaining);

  console.log('Quota updated:', newQuota);
}

/**
 * Calculate warning level based on remaining quota
 * @param {number} remaining - Remaining quota count
 * @returns {number} Warning level (1-4)
 */
calculateWarningLevel(remaining) {
  if (remaining === 0) return 4;      // Exhausted
  if (remaining <= 2) return 3;       // Warning
  if (remaining === 3) return 2;      // Reminder
  return 1;                           // Normal
}

/**
 * Save quota state to localStorage for persistence
 */
saveQuotaToStorage() {
  try {
    localStorage.setItem('perkie_gemini_quota', JSON.stringify(this.geminiQuota));
  } catch (error) {
    console.error('Failed to save quota to storage:', error);
  }
}

/**
 * Load quota state from localStorage on page load
 */
loadQuotaFromStorage() {
  try {
    const stored = localStorage.getItem('perkie_gemini_quota');
    if (stored) {
      const parsed = JSON.parse(stored);

      // Check if quota has reset (new day)
      if (this.hasQuotaReset(parsed.resetTime)) {
        console.log('Quota has reset to 6/6');
        this.geminiQuota.remaining = 6;
        this.geminiQuota.warningLevel = 1;
        return;
      }

      // Use stored quota
      this.geminiQuota = parsed;
      this.updateQuotaUI(null, parsed.remaining);
    }
  } catch (error) {
    console.error('Failed to load quota from storage:', error);
  }
}

/**
 * Check if quota has reset since last update
 * @param {string} resetTime - ISO timestamp of next reset
 * @returns {boolean} True if quota should reset
 */
hasQuotaReset(resetTime) {
  if (!resetTime) return false;
  const resetDate = new Date(resetTime);
  const now = new Date();
  return now >= resetDate;
}
```

**Assumptions**:
- Backend returns consistent quota data structure
- localStorage is available (fallback to memory if not)
- Quota resets at midnight (handled by backend)

**Critical Notes**:
- ALWAYS validate response before updating state
- Store previous state to detect changes
- Persist to localStorage to survive page reloads
- Check for daily reset on page load

---

### Phase 3: Create Badge Update Function

**File**: `assets/pet-processor.js`
**Location**: After quota update methods

#### 3.1 Badge Creation and Update

```javascript
/**
 * Update quota badges on Modern and Classic effect buttons
 * @param {number} remaining - Current remaining quota
 */
updateQuotaBadges(remaining) {
  // Badge configuration based on remaining quota
  const badgeConfig = {
    6: { text: '6', color: '#22c55e', icon: null },         // Green
    5: { text: '5', color: '#22c55e', icon: null },         // Green
    4: { text: '4', color: '#22c55e', icon: null },         // Green
    3: { text: '⚠️3', color: '#f59e0b', icon: 'warning' },  // Amber
    2: { text: '⚠️2', color: '#ef4444', icon: 'warning' },  // Red
    1: { text: '⚠️1', color: '#ef4444', icon: 'warning' },  // Red
    0: { text: '🚫', color: '#9ca3af', icon: 'disabled' }   // Gray
  };

  const badge = badgeConfig[remaining] || badgeConfig[0];

  // Update Modern (Ink Wash) button badge
  this.updateButtonBadge('[data-effect="modern"]', badge);

  // Update Classic (Van Gogh) button badge
  this.updateButtonBadge('[data-effect="classic"]', badge);
}

/**
 * Update or create badge on a specific button
 * @param {string} selector - Button selector
 * @param {Object} badgeConfig - Badge configuration (text, color, icon)
 */
updateButtonBadge(selector, badgeConfig) {
  const button = this.container.querySelector(selector);
  if (!button) {
    console.warn('Button not found:', selector);
    return;
  }

  // Get or create badge element
  let badge = button.querySelector('.quota-badge');
  if (!badge) {
    badge = this.createBadgeElement();
    button.style.position = 'relative'; // Ensure parent is positioned
    button.appendChild(badge);
  }

  // Update badge content and styling
  badge.textContent = badgeConfig.text;
  badge.style.backgroundColor = badgeConfig.color;
  badge.style.color = '#ffffff';

  // Update ARIA label for accessibility
  const effectName = button.getAttribute('data-effect');
  button.setAttribute('aria-label',
    `${effectName} style, ${this.geminiQuota.remaining} generations remaining today`
  );
}

/**
 * Create a new badge element
 * @returns {HTMLElement} Badge element
 */
createBadgeElement() {
  const badge = document.createElement('span');
  badge.className = 'quota-badge';
  badge.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    pointer-events: none;
  `;
  return badge;
}
```

**Assumptions**:
- Effect buttons have `data-effect="modern"` and `data-effect="classic"` attributes
- Container element is accessible via `this.container`
- Buttons exist when this function is called

**Critical Notes**:
- ALWAYS check if button exists before updating
- Create badge only once, reuse for updates
- Use emojis for visual clarity (⚠️ for warning, 🚫 for blocked)
- Add box-shadow for depth and visibility

---

### Phase 4: Create Toast Notification Function

**File**: `assets/pet-processor.js`
**Location**: After badge methods

#### 4.1 Toast Creation and Management

```javascript
/**
 * Show toast notification at specific quota thresholds
 * Only triggers at 3 remaining (50% threshold)
 * @param {number} remaining - Current remaining quota
 */
showQuotaToast(remaining) {
  // Only show toast at 3 remaining (Level 2)
  if (remaining !== 3) return;

  // Toast messages by remaining count
  const messages = {
    3: '3 more artistic portraits available today 🎨',
    2: 'Only 2 artistic styles left for today',
    1: 'Last artistic style for today! Make it count ✨'
  };

  const message = messages[remaining];
  if (!message) return;

  // Remove existing toast if present
  this.removeQuotaToast();

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'quota-toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #f59e0b;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    font-size: 14px;
    font-weight: 500;
    max-width: 90%;
    text-align: center;
    animation: slideDown 0.3s ease-out;
  `;

  // Add to DOM
  document.body.appendChild(toast);
  this.quotaElements.toast = toast;

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    this.removeQuotaToast();
  }, 4000);
}

/**
 * Remove toast notification with animation
 */
removeQuotaToast() {
  const toast = this.quotaElements.toast || document.querySelector('.quota-toast');
  if (!toast) return;

  // Animate out
  toast.style.animation = 'slideUp 0.3s ease-out';

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    this.quotaElements.toast = null;
  }, 300);
}
```

**Assumptions**:
- Toast should only appear once at 3 remaining
- User can dismiss by clicking (optional - not implemented)
- Toast auto-dismisses after 4 seconds

**Critical Notes**:
- ONLY show at remaining === 3 (not 2 or 1, that's banner territory)
- Always remove existing toast before creating new one
- Use fixed positioning to overlay everything
- Add ARIA attributes for screen readers
- Mobile-responsive max-width

---

### Phase 5: Create Warning Banner Function

**File**: `assets/pet-processor.js`
**Location**: After toast methods

#### 5.1 Banner Creation and Management

```javascript
/**
 * Show persistent warning banner at low quota levels
 * Triggers at 1-2 remaining (Level 3)
 * @param {number} remaining - Current remaining quota
 */
showQuotaBanner(remaining) {
  // Banner messages for 1-2 remaining
  const bannerMessages = {
    2: '💡 Heads up: 2 artistic styles remaining today',
    1: '⚡ Last artistic portrait for today - make it count!'
  };

  const message = bannerMessages[remaining];

  // Hide banner if not in warning range
  if (!message) {
    this.hideQuotaBanner();
    return;
  }

  // Check if banner already exists
  let banner = this.quotaElements.banner || this.container.querySelector('.quota-banner');

  if (banner) {
    // Update existing banner
    banner.textContent = message;
    return;
  }

  // Create new banner
  banner = document.createElement('div');
  banner.className = 'quota-banner';
  banner.textContent = message;
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'assertive');

  banner.style.cssText = `
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #f59e0b;
    border-left-width: 4px;
    color: #92400e;
    padding: 16px 20px;
    margin: 16px 0;
    border-radius: 8px;
    text-align: center;
    font-weight: 500;
    font-size: 15px;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
    animation: fadeIn 0.4s ease-out;
  `;

  // Insert before effects section
  const effectsSection = this.container.querySelector('.effects-container')
    || this.container.querySelector('[data-effects-section]')
    || this.container.querySelector('.effect-buttons');

  if (effectsSection) {
    effectsSection.parentNode.insertBefore(banner, effectsSection);
    this.quotaElements.banner = banner;
  } else {
    console.warn('Effects section not found, cannot show banner');
  }
}

/**
 * Hide warning banner
 */
hideQuotaBanner() {
  const banner = this.quotaElements.banner || this.container.querySelector('.quota-banner');
  if (!banner) return;

  // Fade out animation
  banner.style.animation = 'fadeOut 0.3s ease-out';

  setTimeout(() => {
    if (banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
    this.quotaElements.banner = null;
  }, 300);
}
```

**Assumptions**:
- Banner appears above effect buttons
- Effects section has identifiable selector
- Banner is persistent until quota changes

**Critical Notes**:
- Banner stays visible (not auto-dismiss like toast)
- Use gradient background for visual prominence
- Thicker left border for emphasis
- Insert BEFORE effects section, not after
- Check for multiple possible effect container selectors

---

### Phase 6: Create Exhausted State Function

**File**: `assets/pet-processor.js`
**Location**: After banner methods

#### 6.1 Exhausted State UI

```javascript
/**
 * Show exhausted state when quota reaches 0
 * Disables Gemini buttons and shows alternatives
 */
showExhaustedState() {
  console.log('Showing exhausted state');

  // Disable Gemini effect buttons
  this.disableGeminiButtons();

  // Show exhausted message with alternatives
  this.showExhaustedMessage();

  // Hide banner (exhausted message replaces it)
  this.hideQuotaBanner();
}

/**
 * Disable Modern and Classic effect buttons
 */
disableGeminiButtons() {
  const modernBtn = this.container.querySelector('[data-effect="modern"]');
  const classicBtn = this.container.querySelector('[data-effect="classic"]');

  [modernBtn, classicBtn].forEach(button => {
    if (!button) return;

    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
    button.style.pointerEvents = 'none';
    button.setAttribute('title', 'Available tomorrow at midnight');
    button.setAttribute('aria-disabled', 'true');

    // Add disabled class for additional styling
    button.classList.add('quota-exhausted');
  });
}

/**
 * Show message explaining exhausted state with alternatives
 */
showExhaustedMessage() {
  // Check if message already exists
  if (this.quotaElements.exhaustedMessage) return;

  // Create exhausted message container
  const message = document.createElement('div');
  message.className = 'quota-exhausted-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');

  message.innerHTML = `
    <div style="
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      margin: 16px 0;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    ">
      <div style="font-size: 48px; margin-bottom: 16px; line-height: 1;">🎨</div>

      <h3 style="
        margin: 0 0 12px 0;
        font-size: 20px;
        font-weight: 600;
        color: #111827;
      ">Daily Artistic Limit Reached</h3>

      <p style="
        margin: 0 0 20px 0;
        color: #6b7280;
        font-size: 15px;
      ">You've created 6 beautiful artistic portraits today!</p>

      <div style="
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
      ">
        <p style="
          margin: 0 0 12px 0;
          font-weight: 600;
          color: #111827;
          font-size: 16px;
        ">Still Available (Unlimited):</p>

        <div style="
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #059669;
            font-weight: 500;
          ">✓ Enhanced Black & White</span>
        </div>

        <div style="
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #059669;
            font-weight: 500;
          ">✓ Full Color</span>
        </div>
      </div>

      <p style="
        margin: 0 0 20px 0;
        color: #6b7280;
        font-size: 14px;
      ">🌙 Artistic styles reset at midnight</p>

      <div style="
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      ">
        <button
          class="btn-try-alternative"
          data-effect="enhancedblackwhite"
          style="
            background: #111827;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#1f2937'"
          onmouseout="this.style.background='#111827'"
        >Try Enhanced B&W</button>

        <button
          class="btn-try-alternative"
          data-effect="color"
          style="
            background: #059669;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 15px;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#047857'"
          onmouseout="this.style.background='#059669'"
        >Try Full Color</button>
      </div>
    </div>
  `;

  // Add click handlers to alternative buttons
  const buttons = message.querySelectorAll('.btn-try-alternative');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      const effect = e.target.getAttribute('data-effect');
      this.selectEffect(effect);
    });
  });

  // Insert before effects section
  const effectsSection = this.container.querySelector('.effects-container')
    || this.container.querySelector('[data-effects-section]')
    || this.container.querySelector('.effect-buttons');

  if (effectsSection) {
    effectsSection.parentNode.insertBefore(message, effectsSection);
    this.quotaElements.exhaustedMessage = message;
  } else {
    console.warn('Effects section not found, cannot show exhausted message');
  }
}

/**
 * Remove exhausted state (when quota resets)
 */
removeExhaustedState() {
  // Re-enable buttons
  const modernBtn = this.container.querySelector('[data-effect="modern"]');
  const classicBtn = this.container.querySelector('[data-effect="classic"]');

  [modernBtn, classicBtn].forEach(button => {
    if (!button) return;

    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    button.style.pointerEvents = 'auto';
    button.removeAttribute('title');
    button.setAttribute('aria-disabled', 'false');
    button.classList.remove('quota-exhausted');
  });

  // Remove exhausted message
  const message = this.quotaElements.exhaustedMessage;
  if (message && message.parentNode) {
    message.parentNode.removeChild(message);
    this.quotaElements.exhaustedMessage = null;
  }
}
```

**Assumptions**:
- Effect buttons have `data-effect` attributes
- `selectEffect()` method exists on PetProcessor class
- User can still navigate to unlimited effects

**Critical Notes**:
- Disable buttons completely (pointer-events: none)
- Show prominent alternatives (B&W and Color)
- Make CTA buttons functional to switch effects
- Use large emoji for visual impact
- Show reset time ("midnight") for transparency

---

### Phase 7: Main UI Update Orchestrator

**File**: `assets/pet-processor.js`
**Location**: After all warning UI methods

#### 7.1 Central Update Function

```javascript
/**
 * Main function to update all quota UI elements
 * Called after quota state changes
 * @param {number|null} previousRemaining - Previous quota count (null on first load)
 * @param {number} currentRemaining - Current quota count
 */
updateQuotaUI(previousRemaining, currentRemaining) {
  const warningLevel = this.geminiQuota.warningLevel;

  console.log('Updating quota UI:', {
    previous: previousRemaining,
    current: currentRemaining,
    level: warningLevel
  });

  // ALWAYS update badges (visible at all times)
  this.updateQuotaBadges(currentRemaining);

  // Handle different warning levels
  switch (warningLevel) {
    case 1: // Normal (6-4 remaining)
      this.hideQuotaBanner();
      // Remove exhausted state if quota was restored
      if (previousRemaining === 0) {
        this.removeExhaustedState();
      }
      break;

    case 2: // Reminder (3 remaining - 50% threshold)
      // Show toast ONLY when transitioning from 4→3
      if (previousRemaining === 4) {
        this.showQuotaToast(currentRemaining);
      }
      this.hideQuotaBanner();
      break;

    case 3: // Warning (1-2 remaining - 75%+ threshold)
      this.showQuotaBanner(currentRemaining);
      // Remove toast if it's showing
      this.removeQuotaToast();
      break;

    case 4: // Exhausted (0 remaining)
      this.showExhaustedState();
      this.removeQuotaToast();
      break;

    default:
      console.warn('Unknown warning level:', warningLevel);
  }
}
```

**Assumptions**:
- Warning level is correctly calculated
- previousRemaining can be null (first load)
- Quota can increase (admin reset or grace quota)

**Critical Notes**:
- ALWAYS update badges regardless of level
- Only show toast on 4→3 transition (not on page load with 3)
- Banner and toast are mutually exclusive
- Handle quota restoration (0→6 reset)

---

### Phase 8: API Integration

**File**: `assets/pet-processor.js`
**Location**: Modify existing API call methods

#### 8.1 Integrate with Gemini API Calls

**Where**: Inside existing `processEffect()` or `callGeminiAPI()` method

```javascript
/**
 * Process effect with Gemini API
 * MODIFY EXISTING METHOD to add quota tracking
 */
async processGeminiEffect(effectName, imageData) {
  try {
    // Existing API call logic...
    const response = await fetch(GEMINI_API_URL + '/api/v1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_data: imageData,
        style: effectName === 'modern' ? 'ink_wash' : 'van_gogh',
        session_id: this.getSessionId()
      })
    });

    const data = await response.json();

    // Check for API errors
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    // ====== NEW: Update quota from response ======
    this.updateQuotaFromResponse(data);
    // =============================================

    // Existing result handling logic...
    return data;

  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}
```

**Where to Add**:
1. Find existing API call method (likely `processEffect`, `callGeminiAPI`, or similar)
2. Add `this.updateQuotaFromResponse(data)` AFTER successful response
3. Add BEFORE result rendering

**Critical Notes**:
- Only update quota on SUCCESSFUL responses
- Don't update quota on API errors
- Update happens AFTER response validation
- Update happens BEFORE UI rendering

---

### Phase 9: Initialization

**File**: `assets/pet-processor.js`
**Location**: Modify constructor or initialization method

#### 9.1 Load Quota on Page Load

**Where**: End of constructor or in `initialize()` method

```javascript
constructor() {
  // ... existing initialization ...

  // Load saved quota from localStorage
  this.loadQuotaFromStorage();

  // Update UI based on loaded quota
  if (this.geminiQuota.remaining < 6) {
    this.updateQuotaUI(null, this.geminiQuota.remaining);
  }
}
```

**Critical Notes**:
- Load quota AFTER DOM is ready
- Update UI ONLY if quota is not full (avoid showing warnings on fresh load)
- Check for daily reset

---

### Phase 10: CSS Animations

**File**: `assets/pet-processor-v5.css` or inline styles
**Location**: Add to existing stylesheet

#### 10.1 Add Animation Keyframes

```css
/* Quota Warning Animations */

@keyframes slideDown {
  from {
    transform: translate(-50%, -100%);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translate(-50%, 0);
    opacity: 1;
  }
  to {
    transform: translate(-50%, -100%);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

/* Quota Badge Styles */

.quota-badge {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Quota Toast Styles */

.quota-toast {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: -0.01em;
}

/* Exhausted Button State */

.effect-btn.quota-exhausted {
  filter: grayscale(100%);
  transition: all 0.3s ease;
}

.effect-btn.quota-exhausted::after {
  content: '🔒';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  opacity: 0.7;
}

/* Mobile Responsive Adjustments */

@media (max-width: 768px) {
  .quota-toast {
    font-size: 13px;
    padding: 10px 20px;
    max-width: 90%;
    top: 10px;
  }

  .quota-banner {
    font-size: 14px;
    padding: 12px 16px;
    margin: 12px 0;
  }

  .quota-exhausted-message > div {
    padding: 20px 16px !important;
  }

  .quota-exhausted-message h3 {
    font-size: 18px !important;
  }

  .quota-exhausted-message .btn-try-alternative {
    padding: 10px 20px !important;
    font-size: 14px !important;
    width: 100%;
    max-width: 200px;
  }
}

/* Reduced Motion Support */

@media (prefers-reduced-motion: reduce) {
  .quota-toast,
  .quota-banner,
  .quota-badge {
    animation: none !important;
    transition: none !important;
  }
}
```

**Assumptions**:
- CSS file is loaded on pet processor pages
- Modern browsers support CSS animations
- Reduced motion preferences are respected

**Critical Notes**:
- Use hardware-accelerated properties (transform, opacity)
- Add reduced-motion fallback for accessibility
- Mobile styles reduce font sizes and padding
- Exhausted state adds visual lock icon overlay

---

## Testing Checklist

### Functional Testing

- [ ] **Badge Visibility**
  - [ ] Badges appear on Modern and Classic buttons
  - [ ] Badge shows correct number (6, 5, 4, 3, 2, 1, 0)
  - [ ] Badge color changes: Green (6-4) → Amber (3) → Red (2-1) → Gray (0)
  - [ ] Badge persists across effect changes
  - [ ] Badge updates after each generation

- [ ] **Toast Notification**
  - [ ] Toast appears ONLY at 3 remaining
  - [ ] Toast displays correct message
  - [ ] Toast auto-dismisses after 4 seconds
  - [ ] Only one toast shows at a time
  - [ ] Toast is readable on all backgrounds

- [ ] **Warning Banner**
  - [ ] Banner appears at 2 remaining
  - [ ] Banner updates message at 1 remaining
  - [ ] Banner disappears at 0 remaining (replaced by exhausted)
  - [ ] Banner stays visible until quota changes
  - [ ] Banner positioned above effect buttons

- [ ] **Exhausted State**
  - [ ] Modern and Classic buttons become disabled
  - [ ] Buttons show opacity: 0.5
  - [ ] Buttons show cursor: not-allowed
  - [ ] Exhausted message appears
  - [ ] Alternative buttons (B&W, Color) are functional
  - [ ] Clicking alternative switches to that effect

- [ ] **State Persistence**
  - [ ] Quota persists across page reloads
  - [ ] Quota resets at midnight (check localStorage)
  - [ ] Quota updates from API responses
  - [ ] Multiple tabs show consistent quota

### Accessibility Testing

- [ ] **Screen Reader**
  - [ ] Badges have ARIA labels with quota info
  - [ ] Toast has role="status" and aria-live="polite"
  - [ ] Banner has role="alert" and aria-live="assertive"
  - [ ] Disabled buttons have aria-disabled="true"
  - [ ] All warnings are announced properly

- [ ] **Keyboard Navigation**
  - [ ] Can navigate to effect buttons with Tab
  - [ ] Disabled buttons skip in tab order
  - [ ] Alternative buttons are keyboard accessible
  - [ ] Focus indicators are visible

- [ ] **Reduced Motion**
  - [ ] Animations are disabled with prefers-reduced-motion
  - [ ] UI still functions without animations

### Mobile Testing (CRITICAL - 70% Traffic)

- [ ] **Responsive Layout** (test at 375px, 414px, 768px widths)
  - [ ] Badges don't overflow buttons
  - [ ] Toast fits within viewport
  - [ ] Banner wraps text properly
  - [ ] Exhausted message is readable
  - [ ] Alternative buttons are thumb-friendly (44px min)

- [ ] **Touch Interactions**
  - [ ] Can tap effect buttons with badges
  - [ ] Can tap alternative buttons in exhausted state
  - [ ] No accidental double-taps
  - [ ] Touch targets are 44x44px minimum

- [ ] **Performance**
  - [ ] No layout shift when badges appear
  - [ ] Animations are smooth (60fps)
  - [ ] No janky scrolling
  - [ ] localStorage writes don't block UI

### Edge Cases

- [ ] **Network Issues**
  - [ ] Handles missing quota data gracefully
  - [ ] Falls back to stored quota if API fails
  - [ ] Shows appropriate error if quota unknown

- [ ] **Race Conditions**
  - [ ] Multiple simultaneous generations handled
  - [ ] Quota updates don't conflict
  - [ ] UI updates are atomic

- [ ] **Quota Restoration**
  - [ ] Midnight reset works (test with fake resetTime)
  - [ ] Exhausted state removes correctly
  - [ ] Buttons re-enable properly
  - [ ] Admin quota increase works

- [ ] **Browser Compatibility**
  - [ ] Works in iOS Safari (mobile primary)
  - [ ] Works in Chrome Android
  - [ ] localStorage fallback for Safari private mode
  - [ ] Emojis render correctly

---

## Validation Scenarios

### Scenario 1: New User First Visit

**Expected Flow**:
1. Page loads with quota 6/6
2. Badges show "6" in green
3. User generates Modern effect
4. Badge updates to "5" (green)
5. No toast or banner shown

**Validation**:
- No warnings on first use
- Badge visible but subtle
- Quota saves to localStorage

---

### Scenario 2: User Hits 50% (3 Remaining)

**Expected Flow**:
1. User has generated 3 effects (quota now 3/6)
2. Badge shows "⚠️3" in amber
3. Toast appears: "3 more artistic portraits available today 🎨"
4. Toast auto-dismisses after 4 seconds
5. User generates 4th effect
6. Badge updates to "⚠️2" in red
7. Banner appears: "💡 Heads up: 2 artistic styles remaining today"

**Validation**:
- Toast only shows once at 3→3 transition
- Banner replaces toast at 2 remaining
- Colors escalate appropriately

---

### Scenario 3: User Exhausts Quota

**Expected Flow**:
1. User has 1 remaining
2. Badge shows "⚠️1" (red)
3. Banner shows: "⚡ Last artistic portrait for today"
4. User generates last effect
5. Badge changes to "🚫" (gray)
6. Banner disappears
7. Exhausted message appears
8. Modern and Classic buttons disabled
9. Alternative buttons (B&W, Color) are functional

**Validation**:
- Buttons truly disabled (can't click)
- Exhausted message is prominent
- Alternatives work correctly
- Conversion path not blocked

---

### Scenario 4: Page Reload with Partial Quota

**Expected Flow**:
1. User has 2 remaining (saved in localStorage)
2. User refreshes page
3. Page loads
4. Badge shows "⚠️2" (red)
5. Banner appears: "💡 Heads up: 2 artistic styles remaining today"
6. No toast shown (not a transition)

**Validation**:
- Quota persists across reloads
- UI reflects stored state
- No duplicate warnings

---

### Scenario 5: Midnight Reset

**Expected Flow**:
1. User has 0 remaining (exhausted state)
2. Clock passes midnight
3. User reloads page (or resetTime is reached)
4. Quota resets to 6/6
5. Badges show "6" (green)
6. Exhausted message removed
7. Buttons re-enabled

**Validation**:
- Reset detection works
- UI fully restores
- No lingering disabled state

---

## Performance Considerations

### Optimization Strategies

1. **DOM Query Caching**
   - Cache effect button references in constructor
   - Avoid repeated `querySelector` calls
   - Store badge elements in `this.quotaElements`

2. **Debouncing**
   - If multiple API calls happen quickly, debounce UI updates
   - Use `requestAnimationFrame` for visual updates

3. **Animation Performance**
   - Use `transform` and `opacity` (GPU accelerated)
   - Avoid `width`, `height`, `top`, `left` animations
   - Use `will-change` sparingly

4. **LocalStorage**
   - Write to localStorage on background thread (if possible)
   - Use try-catch to handle quota exceeded errors
   - Fallback to memory storage if localStorage unavailable

---

## Browser Compatibility

### Supported Browsers

**Mobile (Primary)**:
- iOS Safari 12+
- Chrome Android 80+
- Samsung Internet 10+

**Desktop (Secondary)**:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Polyfills Required

None - all features use standard ES6+ supported by target browsers:
- `async/await`
- `fetch`
- `localStorage`
- CSS animations
- Template literals

---

## Security Considerations

### Input Validation

- Always validate API responses before updating state
- Check `quota_remaining` is a number 0-6
- Sanitize any user-facing messages from API

### XSS Prevention

- Use `textContent` instead of `innerHTML` where possible
- Sanitize any dynamic HTML content
- Trust only backend-provided data

### Rate Limit Bypass Prevention

- Quota is server-authoritative (backend validates)
- Frontend is display-only
- Disabling buttons doesn't bypass limit (backend checks)

---

## Rollback Plan

### If Issues Arise

1. **Feature Flag**
   - Add `window.DISABLE_QUOTA_UI = true` check
   - All UI functions check flag before executing
   - Emergency disable without deployment

2. **Gradual Rollout**
   - Deploy to 10% users first
   - Monitor error rates and conversion
   - Roll back if CVR drops >5%

3. **Fallback Mode**
   - If backend doesn't return quota, show no warnings
   - System works with or without quota data
   - Graceful degradation to unlimited mode

---

## Success Metrics

### KPIs to Monitor

**User Experience**:
- Conversion rate (CVR) - should maintain or improve
- Add-to-cart rate - should not drop
- Time to add-to-cart - should not increase
- Effect selection distribution - track changes

**Quota System**:
- % users hitting daily limit (<15% target)
- % users returning next day (>30% target)
- Average generations per session (3-4 target)
- Support tickets about limits (<5% users)

**Technical**:
- API response time (p95 <2s)
- UI render time (<100ms)
- localStorage success rate (>99%)
- Error rate (<1%)

---

## Post-Implementation Tasks

### After Deployment

1. **Monitor Logs**
   - Check for quota update errors
   - Monitor localStorage failures
   - Track API response consistency

2. **Gather Feedback**
   - User interviews about quota experience
   - Support ticket analysis
   - Conversion funnel analysis

3. **Optimize**
   - Adjust warning thresholds if needed
   - Refine messaging based on feedback
   - A/B test different warning styles

4. **Documentation**
   - Update API documentation with quota fields
   - Document quota reset logic
   - Create troubleshooting guide

---

## Related Files

### Files to Modify

1. **Primary**: `assets/pet-processor.js` (~800 lines added)
2. **Styling**: `assets/pet-processor-v5.css` (~150 lines added)

### Files to Reference

1. `rate-limit-warning-ux-implementation-plan.md` - UX design specifications
2. `rate-limit-communication-strategy.md` - Product strategy
3. `mobile-commerce-gemini-integration-plan.md` - Overall architecture
4. `GEMINI_ARTISTIC_API_BUILD_GUIDE.md` - Backend API guide

---

## Implementation Timeline

### Estimated Effort

- **Phase 1-3**: State & Updates (1 hour)
- **Phase 4-6**: Warning UI (1.5 hours)
- **Phase 7-9**: Integration & Init (1 hour)
- **Phase 10**: CSS & Animations (0.5 hours)
- **Testing**: Full test suite (2 hours)
- **Total**: ~6 hours (1 day)

### Recommended Approach

1. **Day 1 Morning**: Implement Phases 1-3 (state management)
2. **Day 1 Afternoon**: Implement Phases 4-6 (UI components)
3. **Day 2 Morning**: Implement Phases 7-9 (integration)
4. **Day 2 Afternoon**: Phase 10 + Testing
5. **Day 3**: Deploy to test environment, user testing

---

## Questions for Clarification

### Before Starting Implementation

1. **API Endpoint**: Is the Gemini API already returning quota data? If not, when will it be ready?

2. **Session ID**: How is session ID currently generated and stored?

3. **Effect Names**: Confirm data-effect attribute values:
   - Modern = "modern" or "ink_wash"?
   - Classic = "classic" or "van_gogh"?

4. **Reset Time**: Is reset always midnight local time, or midnight UTC?

5. **Grace Quota**: Should we implement the +2 grace for cart users now, or later?

6. **A/B Testing**: Do we need feature flag support for testing?

---

## Final Notes

### Critical Success Factors

1. **Mobile Performance**: 70% of traffic - must be fast and smooth
2. **Conversion Protection**: Never block purchase flow
3. **Clear Communication**: Users should understand limits without anxiety
4. **Graceful Degradation**: Works even if quota data missing
5. **Accessibility**: Screen reader compatible, keyboard navigable

### Non-Negotiables

- ✅ Mobile-responsive at all breakpoints
- ✅ Touch targets 44px minimum
- ✅ Animations smooth at 60fps
- ✅ ARIA labels for screen readers
- ✅ Works offline (loads from localStorage)
- ✅ No layout shift (badges don't cause reflow)

### Nice-to-Haves (Future Enhancements)

- 🔮 Countdown timer to midnight reset
- 🔮 Share modal to encourage return tomorrow
- 🔮 Email notification when quota resets
- 🔮 Premium tier upsell in exhausted state
- 🔮 Analytics event tracking for each warning level

---

**End of Implementation Guide**

This plan is ready for execution. Begin with Phase 1 and proceed sequentially through Phase 10, testing at each phase. Refer back to this document for specifications and edge cases.
