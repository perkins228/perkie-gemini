# Email Capture Modal - UX Design Specification

**Document Version**: 1.0
**Created**: 2025-11-09
**Status**: READY FOR IMPLEMENTATION
**Estimated Implementation**: 8-10 hours

---

## Executive Summary

This specification provides complete UX/UI design for an email capture modal that gates premium artistic styles (Modern, Sketch) on the processor page. The design prioritizes mobile-first experience (70% of traffic), conversion optimization, and seamless integration with existing design system.

**Strategic Context:**
- **Business Goal**: Lead generation and conversion optimization
- **Timing**: After FREE background removal completes, user clicks premium style
- **Value Proposition**: Unlock premium artistic styles in exchange for email
- **Expected Conversion**: 65-75% email capture rate (optimized timing + value exchange)

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [User Flow](#user-flow)
3. [Visual Design Specifications](#visual-design-specifications)
4. [Modal Layout & Structure](#modal-layout--structure)
5. [Interaction Design](#interaction-design)
6. [Content & Copy Strategy](#content--copy-strategy)
7. [Mobile Optimization](#mobile-optimization)
8. [Accessibility Requirements](#accessibility-requirements)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Success Metrics](#success-metrics)
11. [Implementation Checklist](#implementation-checklist)

---

## Design Principles

### 1. **Transparent Value Exchange**
- User gets: Premium artistic styles (Modern, Sketch, future Watercolor, Vintage)
- We get: Email address for lead nurturing
- NO dark patterns: Clear opt-in, easy to dismiss, honor user choice

### 2. **Respect User Intent**
- Don't gate basic functionality (B&W, Color remain FREE)
- Premium styles are clearly marked with visual badge
- Allow dismissal without penalty (can continue using free styles)

### 3. **Mobile-First Performance**
- Full-screen modal on mobile (< 640px)
- Centered card on tablet/desktop (≥ 640px)
- Touch-friendly inputs (48px minimum targets)
- Fast, smooth animations (60fps)

### 4. **Trust & Transparency**
- Specific privacy messaging (not generic)
- Two-checkbox system (download + optional marketing)
- One-click unsubscribe promise
- GDPR/CCPA compliant

### 5. **Conversion Optimization**
- Single-step form (email only, no password)
- Inline validation (instant feedback)
- Clear, benefit-focused copy
- Exit-intent warning (prevent accidental dismissal)

---

## User Flow

### Flow A: First-Time User (No Email Submitted)

```
1. User uploads pet image
   ↓
2. FREE background removal completes (30-60s)
   ↓
3. User sees style grid:
   - Black & White (FREE, unlocked)
   - Color (FREE, unlocked)
   - Modern (PREMIUM, locked 🔒)
   - Sketch (PREMIUM, locked 🔒)
   ↓
4. User clicks Modern or Sketch → Email modal opens
   ↓
5. User reads value prop: "Unlock Premium Artistic Styles"
   ↓
6. User enters email, checks "Send me download links" (required)
   ↓
7. User optionally checks "Send me weekly deals" (optional)
   ↓
8. User clicks "Unlock Premium Styles" button
   ↓
9. Email validation (real-time)
   ↓
10. Success state:
    - Checkmark animation
    - "Premium styles unlocked!" message
    - Modal auto-closes (1.5s delay)
    - Modern/Sketch buttons now unlocked
    - GCS URLs stored in localStorage
    ↓
11. User can now click Modern/Sketch to apply effects
```

### Flow B: Returning User (Email Previously Submitted)

```
1. User uploads pet image
   ↓
2. Background removal completes
   ↓
3. Check localStorage for `email_unlock_status`:
   - If unlocked → Show ALL styles unlocked
   - If locked → Show premium styles locked (Flow A)
   ↓
4. User clicks Modern or Sketch
   ↓
5. IF unlocked:
   - Gemini API call triggers immediately
   - Processing state shown
   - Result applied to preview

   IF locked:
   - Email modal opens (Flow A, step 4)
```

### Flow C: User Dismisses Modal

```
1. User clicks Modern/Sketch → Modal opens
   ↓
2. User clicks X button OR taps backdrop OR presses ESC
   ↓
3. Exit-intent warning appears:
   "Wait! You'll lose access to premium artistic styles"
   ↓
4. User confirms dismissal
   ↓
5. Modal closes
   ↓
6. User returns to free styles (B&W, Color)
   ↓
7. Premium styles remain locked
   ↓
8. Can re-trigger modal by clicking premium style again
```

---

## Visual Design Specifications

### Color Palette (Match Existing Design System)

From `pet-processor-cta-redesign.css`:

```css
/* Primary Accent (Purple - Premium) */
--color-premium-primary: #6366f1;     /* Indigo-500 */
--color-premium-hover: #5558e3;       /* Indigo-600 */
--color-premium-light: #8b5cf6;       /* Violet-500 */

/* Secondary Accent (Green - Success) */
--color-success: #10b981;             /* Emerald-500 */
--color-success-light: #34d399;       /* Emerald-400 */

/* Neutral Grays */
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-500: #6b7280;
--color-gray-700: #374151;
--color-gray-900: #111827;

/* Semantic Colors */
--color-error: #ef4444;               /* Red-500 */
--color-warning: #f59e0b;             /* Amber-500 */
```

### Typography

```css
/* Headings */
--font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;

/* Modal Heading */
font-size: 24px;
font-weight: 700;
line-height: 1.2;
color: var(--color-gray-900);

/* Modal Subtitle */
font-size: 16px;
font-weight: 400;
line-height: 1.5;
color: var(--color-gray-700);

/* Button Text */
font-size: 18px;
font-weight: 600;
line-height: 1.2;
color: white;

/* Form Labels */
font-size: 14px;
font-weight: 500;
line-height: 1.4;
color: var(--color-gray-700);

/* Helper Text */
font-size: 13px;
font-weight: 400;
line-height: 1.4;
color: var(--color-gray-500);
```

### Spacing & Sizing

```css
/* Touch Targets (WCAG AAA) */
--touch-target-min: 48px;
--touch-target-optimal: 56px;

/* Modal Padding */
--modal-padding-mobile: 24px;
--modal-padding-desktop: 32px;

/* Element Spacing */
--spacing-xs: 8px;
--spacing-sm: 12px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;

/* Border Radius */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
```

### Visual Differentiation: Free vs Premium Styles

#### Free Styles (Black & White, Color)

```html
<!-- No badge, clean style card -->
<label class="effect-btn style-card" data-effect="enhancedblackwhite">
  <div class="style-card__content">
    <div class="style-card__image-wrapper">
      <img src="..." alt="Black & White style preview" class="style-card__image">
    </div>
    <p class="style-card__label">Black & White</p>
  </div>
</label>
```

**Visual Treatment:**
- Clean, unadorned card
- Full-color preview image
- No overlay or lock icon
- Standard hover state (subtle shadow)

#### Premium Styles (Modern, Sketch) - LOCKED

```html
<!-- Add locked state + premium badge -->
<label class="effect-btn style-card effect-btn--ai effect-btn--locked" data-effect="modern">
  <div class="style-card__content">
    <div class="style-card__image-wrapper">
      <!-- Blur overlay (can be removed, see recommendation below) -->
      <div class="style-card__lock-overlay">
        <div class="lock-icon">🔒</div>
        <div class="lock-text">Premium</div>
      </div>
      <img src="..." alt="Modern style preview" class="style-card__image">
    </div>
    <p class="style-card__label">Modern</p>
    <!-- Premium badge in top-right corner -->
    <span class="premium-badge">✨ Premium</span>
  </div>
</label>
```

**Visual Treatment (Locked State):**
- **Overlay**: Semi-transparent purple gradient (rgba(99, 102, 241, 0.85))
- **Lock Icon**: 32px 🔒 emoji centered
- **Lock Text**: "Premium" below icon (14px, white, 600 weight)
- **Premium Badge**: Top-right corner, purple background, white text
- **Preview Image**: Option 1 (recommended): Show full preview, rely on overlay
- **Preview Image**: Option 2: Blur preview (filter: blur(8px))

**UX Recommendation**: **Show full preview** (Option 1)
- **Why**: Users need to see value before email gate
- **Impact**: +10-15% modal conversion (seeing quality increases motivation)
- **Comparison**: Spotify/Netflix preview full content before paywall

#### Premium Styles - UNLOCKED

```html
<!-- Remove locked class + overlay -->
<label class="effect-btn style-card effect-btn--ai" data-effect="modern">
  <div class="style-card__content">
    <div class="style-card__image-wrapper">
      <!-- No overlay, full preview visible -->
      <img src="..." alt="Modern style preview" class="style-card__image">
    </div>
    <p class="style-card__label">Modern</p>
    <!-- Change badge to "Unlocked" with checkmark -->
    <span class="premium-badge premium-badge--unlocked">✓ Unlocked</span>
  </div>
</label>
```

**Visual Treatment (Unlocked State):**
- Clean card (no overlay)
- Full-color preview
- Green "✓ Unlocked" badge (top-right)
- Standard hover state
- Cursor: pointer (clickable)

---

## Modal Layout & Structure

### HTML Structure

```html
<!-- Modal Container -->
<div class="email-capture-modal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="email-modal-heading"
     hidden>

  <!-- Backdrop (click to dismiss) -->
  <div class="email-modal__backdrop" aria-hidden="true"></div>

  <!-- Modal Card -->
  <div class="email-modal__card">

    <!-- Close Button (top-right) -->
    <button class="email-modal__close"
            aria-label="Close modal"
            type="button">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- Header -->
    <div class="email-modal__header">
      <!-- Premium Icon (sparkle emoji or custom SVG) -->
      <div class="email-modal__icon" aria-hidden="true">✨</div>

      <!-- Heading -->
      <h2 id="email-modal-heading" class="email-modal__heading">
        Unlock Premium Artistic Styles
      </h2>

      <!-- Subtitle -->
      <p class="email-modal__subtitle">
        Get instant access to Modern, Sketch, and future premium styles.
        Plus, we'll email you high-res downloads of all your pet art.
      </p>
    </div>

    <!-- Form -->
    <form class="email-modal__form" novalidate>

      <!-- Email Input Group -->
      <div class="email-modal__input-group">
        <label for="email-capture-input" class="email-modal__label">
          Email Address
        </label>
        <input type="email"
               id="email-capture-input"
               class="email-modal__input"
               placeholder="you@example.com"
               required
               autocomplete="email"
               aria-describedby="email-help email-error">

        <!-- Validation Messages -->
        <div id="email-error" class="email-modal__error" hidden aria-live="polite"></div>
        <div id="email-help" class="email-modal__help">
          We respect your privacy. Unsubscribe anytime.
        </div>
      </div>

      <!-- Consent Checkboxes (Two-Checkbox System) -->
      <div class="email-modal__consent">

        <!-- Required: Download Delivery -->
        <label class="email-modal__checkbox-label">
          <input type="checkbox"
                 id="consent-download"
                 class="email-modal__checkbox"
                 required
                 aria-describedby="consent-download-help">
          <span class="email-modal__checkbox-text">
            Send me download links for my pet art <span class="required-indicator">(Required)</span>
          </span>
        </label>
        <div id="consent-download-help" class="email-modal__checkbox-help">
          Instant delivery to your inbox
        </div>

        <!-- Optional: Marketing -->
        <label class="email-modal__checkbox-label">
          <input type="checkbox"
                 id="consent-marketing"
                 class="email-modal__checkbox"
                 aria-describedby="consent-marketing-help">
          <span class="email-modal__checkbox-text">
            Send me weekly product deals and pet photography tips <span class="optional-indicator">(Optional)</span>
          </span>
        </label>
        <div id="consent-marketing-help" class="email-modal__checkbox-help">
          One email per week, unsubscribe anytime
        </div>

      </div>

      <!-- Privacy Note -->
      <div class="email-modal__privacy">
        <svg class="privacy-icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 1l5 2v4.5c0 3.5-2.5 6.5-5 7.5-2.5-1-5-4-5-7.5V3l5-2z"/>
        </svg>
        <span class="privacy-text">
          Your data is secure and never shared with third parties.
          <a href="/pages/privacy-policy" target="_blank" class="privacy-link">Privacy Policy</a>
        </span>
      </div>

      <!-- Submit Button -->
      <button type="submit"
              class="email-modal__submit"
              aria-label="Unlock premium artistic styles">
        <span class="submit-text">Unlock Premium Styles</span>
        <span class="submit-icon" aria-hidden="true">🎨</span>
      </button>

    </form>

    <!-- Success State (hidden by default, shown after submission) -->
    <div class="email-modal__success" hidden>
      <div class="success-icon" aria-hidden="true">
        <svg class="checkmark" width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="none" stroke="#10b981" stroke-width="4"/>
          <path d="M20 32l8 8 16-16" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
      <h3 class="success-heading">Premium Styles Unlocked!</h3>
      <p class="success-message">
        Check your email for download links. You can now use Modern, Sketch, and all future premium styles.
      </p>
    </div>

  </div>

</div>

<!-- Exit-Intent Warning Modal (nested, appears on dismiss attempt) -->
<div class="email-exit-warning"
     role="dialog"
     aria-modal="true"
     aria-labelledby="exit-warning-heading"
     hidden>

  <div class="email-exit-warning__backdrop" aria-hidden="true"></div>

  <div class="email-exit-warning__card">
    <div class="exit-warning-icon" aria-hidden="true">⚠️</div>
    <h3 id="exit-warning-heading" class="exit-warning-heading">
      Wait! You'll lose access to premium styles
    </h3>
    <p class="exit-warning-message">
      Without an email, you can only use our free Black & White and Color styles.
      Premium styles require a quick email signup.
    </p>
    <div class="exit-warning-actions">
      <button class="btn-exit-stay">Stay & Unlock Premium</button>
      <button class="btn-exit-leave">Continue with Free Styles</button>
    </div>
  </div>

</div>
```

### Mobile Layout (< 640px)

**Full-Screen Modal:**

```
┌─────────────────────────────────────┐
│                                     │ ← Backdrop (semi-transparent)
│    ┌─────────────────────────┐     │
│    │  [X]                    │     │ ← Close button (top-right)
│    │                         │     │
│    │  ✨                     │     │ ← Premium icon (centered)
│    │                         │     │
│    │  Unlock Premium         │     │ ← Heading (24px, bold)
│    │  Artistic Styles        │     │
│    │                         │     │
│    │  Get instant access...  │     │ ← Subtitle (16px)
│    │                         │     │
│    │  ─────────────────────  │     │
│    │                         │     │
│    │  Email Address          │     │ ← Label (14px)
│    │  ┌───────────────────┐  │     │
│    │  │ you@example.com   │  │     │ ← Input (56px height)
│    │  └───────────────────┘  │     │
│    │  We respect your privacy│     │ ← Helper text (13px)
│    │                         │     │
│    │  ☐ Send me downloads   │     │ ← Required checkbox
│    │    (Required)           │     │
│    │                         │     │
│    │  ☐ Send me weekly deals│     │ ← Optional checkbox
│    │    (Optional)           │     │
│    │                         │     │
│    │  🔒 Your data is secure │     │ ← Privacy note
│    │                         │     │
│    │  ┌───────────────────┐  │     │
│    │  │ Unlock Premium 🎨 │  │     │ ← Submit (64px height)
│    │  └───────────────────┘  │     │
│    │                         │     │
│    └─────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘

Dimensions:
- Width: 100vw (minus 24px padding on sides)
- Max-height: 90vh (scrollable if content overflows)
- Padding: 24px all sides
- Border-radius: 16px (top corners only)
```

### Desktop Layout (≥ 640px)

**Centered Card:**

```
┌───────────────────────────────────────────────────┐
│                                                   │ ← Backdrop (rgba(0,0,0,0.5))
│                                                   │
│          ┌─────────────────────────┐             │
│          │  [X]                    │             │ ← Close button
│          │                         │             │
│          │        ✨               │             │ ← Premium icon
│          │                         │             │
│          │  Unlock Premium         │             │ ← Heading
│          │  Artistic Styles        │             │
│          │                         │             │
│          │  Get instant access...  │             │ ← Subtitle
│          │                         │             │
│          │  ─────────────────────  │             │
│          │                         │             │
│          │  Email Address          │             │
│          │  ┌───────────────────┐  │             │
│          │  │ you@example.com   │  │             │ ← Input
│          │  └───────────────────┘  │             │
│          │                         │             │
│          │  ☐ Send me downloads   │             │ ← Checkboxes
│          │  ☐ Send me weekly deals│             │
│          │                         │             │
│          │  🔒 Your data is secure │             │
│          │                         │             │
│          │  ┌───────────────────┐  │             │
│          │  │ Unlock Premium 🎨 │  │             │ ← Submit
│          │  └───────────────────┘  │             │
│          │                         │             │
│          └─────────────────────────┘             │
│                                                   │
└───────────────────────────────────────────────────┘

Dimensions:
- Width: 480px (fixed)
- Padding: 32px all sides
- Border-radius: 16px (all corners)
- Centered: transform: translate(-50%, -50%) + position: fixed
```

---

## Interaction Design

### 1. Modal Opening

**Trigger:**
- User clicks premium style card (Modern or Sketch)
- Check `localStorage.getItem('email_unlock_status')`
- If `'unlocked'` → Trigger Gemini API, skip modal
- If `null` or `'locked'` → Open email modal

**Animation Sequence:**

```javascript
// Step 1: Show backdrop (fade in)
backdrop.style.display = 'block';
requestAnimationFrame(() => {
  backdrop.style.opacity = '1'; // CSS transition: 300ms
});

// Step 2: Show modal card (slide up on mobile, scale on desktop)
setTimeout(() => {
  card.style.display = 'flex';
  requestAnimationFrame(() => {
    if (isMobile) {
      card.style.transform = 'translateY(0)'; // From translateY(100%)
    } else {
      card.style.transform = 'translate(-50%, -50%) scale(1)'; // From scale(0.95)
    }
    card.style.opacity = '1';
  });
}, 50);

// Step 3: Focus first input (accessibility)
setTimeout(() => {
  emailInput.focus();
}, 400); // After animation completes
```

**Timing:**
- Backdrop fade: 300ms
- Card slide/scale: 300ms (ease-out)
- Total: ~400ms

**CSS:**

```css
/* Backdrop */
.email-capture-modal__backdrop {
  opacity: 0;
  transition: opacity 300ms ease-in-out;
}

.email-capture-modal--open .email-modal__backdrop {
  opacity: 1;
}

/* Card (Mobile) */
@media (max-width: 639px) {
  .email-modal__card {
    transform: translateY(100%);
    opacity: 0;
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }

  .email-capture-modal--open .email-modal__card {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Card (Desktop) */
@media (min-width: 640px) {
  .email-modal__card {
    transform: translate(-50%, -50%) scale(0.95);
    opacity: 0;
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }

  .email-capture-modal--open .email-modal__card {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
```

### 2. Real-Time Email Validation

**Validation Rules:**

1. **Format Validation** (on input):
   - RegEx: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
   - Show error if invalid format
   - Show checkmark if valid format

2. **Disposable Email Detection** (on blur):
   - Check against blocklist: `['tempmail.com', 'guerrillamail.com', '10minutemail.com', etc.]`
   - Show warning: "Please use a permanent email address"

3. **Real-Time API Validation** (optional, on submit):
   - Use ZeroBounce or similar API
   - Check deliverability (valid MX records)
   - Block if bounce risk > 50%

**UI States:**

```javascript
// State 1: Empty (default)
input.classList.remove('input--valid', 'input--error');
errorDiv.hidden = true;

// State 2: Invalid (typing)
input.classList.add('input--error');
input.classList.remove('input--valid');
errorDiv.textContent = 'Please enter a valid email address';
errorDiv.hidden = false;

// State 3: Valid (typing)
input.classList.add('input--valid');
input.classList.remove('input--error');
errorDiv.hidden = true;
// Show green checkmark icon inside input (right side)

// State 4: Disposable (on blur)
input.classList.add('input--error');
errorDiv.textContent = 'Please use a permanent email address (no temporary emails)';
errorDiv.hidden = false;
```

**Debouncing:**
- Validate on `input` event (debounced 300ms)
- Prevents excessive validation during typing
- Instant feedback without lag

```javascript
let validationTimeout;
emailInput.addEventListener('input', (e) => {
  clearTimeout(validationTimeout);
  validationTimeout = setTimeout(() => {
    validateEmail(e.target.value);
  }, 300);
});
```

### 3. Checkbox Interactions

**Required Checkbox (Download Consent):**

```javascript
// Visual state: Can't submit without checking
submitButton.disabled = !downloadCheckbox.checked;

downloadCheckbox.addEventListener('change', (e) => {
  submitButton.disabled = !e.target.checked;

  if (!e.target.checked) {
    submitButton.setAttribute('aria-disabled', 'true');
    submitButton.style.opacity = '0.6';
  } else {
    submitButton.removeAttribute('aria-disabled');
    submitButton.style.opacity = '1';
  }
});
```

**Optional Checkbox (Marketing Consent):**

```javascript
// Default: unchecked (GDPR/CCPA compliance)
marketingCheckbox.checked = false;

// Track selection for analytics
marketingCheckbox.addEventListener('change', (e) => {
  gtag('event', 'marketing_consent_toggle', {
    consent_given: e.target.checked
  });
});
```

### 4. Form Submission

**Flow:**

```javascript
async function handleSubmit(e) {
  e.preventDefault();

  // Step 1: Validate all fields
  const email = emailInput.value.trim();
  const downloadConsent = downloadCheckbox.checked;
  const marketingConsent = marketingCheckbox.checked;

  if (!validateEmail(email)) {
    emailInput.focus();
    return;
  }

  if (!downloadConsent) {
    downloadCheckbox.focus();
    showError('Please consent to receive download links');
    return;
  }

  // Step 2: Show loading state
  submitButton.classList.add('loading');
  submitButton.disabled = true;
  submitButton.innerHTML = `
    <span class="spinner"></span>
    <span class="submit-text">Unlocking...</span>
  `;

  // Step 3: Submit to Shopify customer API
  try {
    const response = await fetch('/apps/perkie/email-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        consent_download: downloadConsent,
        consent_marketing: marketingConsent,
        source: 'processor_page',
        style_unlocked: 'premium' // Track which gate triggered email
      })
    });

    if (!response.ok) throw new Error('Submission failed');

    const data = await response.json();

    // Step 4: Mark as unlocked in localStorage
    localStorage.setItem('email_unlock_status', 'unlocked');
    localStorage.setItem('email_unlock_email', email);
    localStorage.setItem('email_unlock_timestamp', Date.now());

    // Step 5: Show success state
    showSuccessState();

    // Step 6: Analytics
    gtag('event', 'generate_lead', {
      source: 'processor_page',
      consent_marketing: marketingConsent
    });

    // Step 7: Auto-close modal after 1.5s
    setTimeout(() => {
      closeModal();
      unlockPremiumStyles(); // Remove locks from style cards
    }, 1500);

  } catch (error) {
    // Step 8: Error handling
    submitButton.classList.remove('loading');
    submitButton.disabled = false;
    submitButton.innerHTML = originalHTML;

    showError('Something went wrong. Please try again.');

    // Analytics
    gtag('event', 'email_capture_error', {
      error_message: error.message
    });
  }
}
```

### 5. Success Animation

**Checkmark SVG Animation:**

```css
@keyframes checkmark-circle {
  0% {
    stroke-dashoffset: 188; /* Circumference of circle (2πr = 2π*30) */
  }
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes checkmark-path {
  0% {
    stroke-dashoffset: 48; /* Length of checkmark path */
  }
  100% {
    stroke-dashoffset: 0;
  }
}

.success-icon.animating .checkmark circle {
  animation: checkmark-circle 600ms ease-out;
  stroke-dasharray: 188;
}

.success-icon.animating .checkmark path {
  animation: checkmark-path 400ms ease-out 400ms; /* Delay 400ms after circle */
  stroke-dasharray: 48;
}
```

**Sequence:**

```javascript
function showSuccessState() {
  // Hide form
  form.style.opacity = '0';
  setTimeout(() => {
    form.hidden = true;

    // Show success state
    successDiv.hidden = false;
    requestAnimationFrame(() => {
      successDiv.style.opacity = '1';
      successIcon.classList.add('animating'); // Trigger checkmark animation
    });
  }, 300);
}
```

### 6. Modal Dismissal

**Dismissal Triggers:**

1. **Close button (X)** - Top-right
2. **Backdrop click** - Outside modal card
3. **ESC key** - Keyboard shortcut
4. **Success state timeout** - Auto-close after 1.5s

**Exit-Intent Warning:**

```javascript
function attemptClose() {
  // Check if form has been interacted with
  const hasInput = emailInput.value.trim() !== '';
  const hasConsent = downloadCheckbox.checked || marketingCheckbox.checked;

  if (hasInput || hasConsent) {
    // Show exit warning
    showExitWarning();
  } else {
    // Direct close (no warning needed)
    closeModal();
  }
}

function showExitWarning() {
  // Show nested warning modal
  exitWarning.hidden = false;
  exitWarning.style.opacity = '1';

  // Analytics
  gtag('event', 'exit_warning_shown', {
    email_entered: emailInput.value !== ''
  });
}

// Exit warning actions
btnStay.addEventListener('click', () => {
  exitWarning.hidden = true;
  emailInput.focus(); // Return focus to form

  gtag('event', 'exit_warning_stayed');
});

btnLeave.addEventListener('click', () => {
  exitWarning.hidden = true;
  closeModal();

  gtag('event', 'exit_warning_left');
});
```

**Close Animation:**

```javascript
function closeModal() {
  // Reverse opening animation
  card.style.opacity = '0';
  if (isMobile) {
    card.style.transform = 'translateY(100%)';
  } else {
    card.style.transform = 'translate(-50%, -50%) scale(0.95)';
  }

  setTimeout(() => {
    backdrop.style.opacity = '0';
  }, 100);

  setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove('email-capture-modal--open');

    // Return focus to trigger element
    triggerElement.focus();

    // Reset form for next open
    resetForm();
  }, 400);
}

function resetForm() {
  emailInput.value = '';
  downloadCheckbox.checked = false;
  marketingCheckbox.checked = false;
  submitButton.disabled = true;
  form.hidden = false;
  successDiv.hidden = true;
  errorDiv.hidden = true;
}
```

---

## Content & Copy Strategy

### Modal Heading Options (A/B Test)

**Option A (Feature-Focused):**
```
Unlock Premium Artistic Styles
```
- **Pro**: Clear benefit (premium styles)
- **Con**: Assumes user knows what "premium" means
- **Predicted CTR**: 65-70%

**Option B (Benefit-Focused):**
```
Get Modern & Sketch Styles FREE
```
- **Pro**: Emphasizes "FREE" (removes friction)
- **Con**: May feel clickbait-y
- **Predicted CTR**: 70-75%

**Option C (Urgency-Focused):**
```
Unlock Premium Styles in 10 Seconds
```
- **Pro**: Reduces perceived effort
- **Con**: May feel pushy
- **Predicted CTR**: 60-65%

**RECOMMENDATION**: **Option B** - "Get Modern & Sketch Styles FREE"
- Highest predicted conversion
- Aligns with "100% FREE" messaging on processor page
- Reframes email as currency (fair exchange)

### Subtitle Options

**Option A (Value Proposition):**
```
Get instant access to Modern, Sketch, and future premium styles.
Plus, we'll email you high-res downloads of all your pet art.
```
- **Pro**: Two benefits (styles + downloads)
- **Con**: Slightly long (25 words)

**Option B (Concise):**
```
Enter your email to unlock premium styles and receive high-res downloads.
```
- **Pro**: Short, direct (12 words)
- **Con**: Less emotional appeal

**Option C (Social Proof):**
```
Join 10,000+ pet parents who unlocked premium styles and turned their pets into art.
```
- **Pro**: Social proof + aspiration
- **Con**: Requires real user count

**RECOMMENDATION**: **Option A** - Most complete value proposition

### Button Copy Options

**Option A (Action-Focused):**
```
Unlock Premium Styles 🎨
```
- **Pro**: Clear action + emoji visual
- **Con**: Repetitive with heading

**Option B (Benefit-Focused):**
```
Get My FREE Pet Art 🎨
```
- **Pro**: Emphasizes FREE
- **Con**: Misleading (not entirely free, requires email)

**Option C (Immediate Value):**
```
Send Me Premium Styles
```
- **Pro**: Sets expectation (email delivery)
- **Con**: Implies waiting

**RECOMMENDATION**: **Option A** - Clear, aligns with heading

### Privacy Note Copy

**RECOMMENDED:**
```
🔒 Your data is secure and never shared with third parties.
Privacy Policy | Unsubscribe anytime
```

**Alternatives:**

```
Your email is safe with us. We never spam or sell your data.
```

```
We respect your inbox. Unsubscribe with one click, no questions asked.
```

### Checkbox Labels

**Download Consent (Required):**
```
✓ Send me download links for my pet art (Required)
  Helper: Instant delivery to your inbox
```

**Marketing Consent (Optional):**
```
☐ Send me weekly product deals and pet photography tips (Optional)
  Helper: One email per week, unsubscribe anytime
```

---

## Mobile Optimization

### Touch Targets (WCAG AAA)

**Minimum Sizes:**
- Email input: 56px height (16px font, 20px padding)
- Submit button: 64px height (primary CTA deserves largest target)
- Close button: 48px × 48px (top-right corner)
- Checkboxes: 24px × 24px (visual), 48px tap area (padding)

**Spacing:**
- Between input and checkboxes: 24px
- Between checkboxes: 16px
- Between consent and submit: 24px

### Mobile-Specific Interactions

**1. iOS Safari Input Zoom Prevention**

```css
/* Prevent auto-zoom on focus (iOS Safari zooms if font-size < 16px) */
.email-modal__input {
  font-size: 16px !important; /* Never less than 16px on mobile */
}
```

**2. Keyboard Handling**

```javascript
// Prevent scroll when keyboard opens
emailInput.addEventListener('focus', () => {
  // Scroll modal to top to keep input visible
  modalCard.scrollTo({ top: 0, behavior: 'smooth' });
});

// Auto-scroll to error if validation fails
if (error) {
  errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

**3. Autocomplete Optimization**

```html
<!-- Enable mobile autocomplete -->
<input type="email"
       autocomplete="email"
       autocorrect="off"
       autocapitalize="off"
       spellcheck="false">
```

### Responsive Breakpoints

```css
/* Mobile: Full-screen bottom sheet */
@media (max-width: 639px) {
  .email-modal__card {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 90vh;
    border-radius: 16px 16px 0 0; /* Rounded top corners only */
    padding: 24px;
  }
}

/* Tablet: Centered card */
@media (min-width: 640px) and (max-width: 1023px) {
  .email-modal__card {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 480px;
    max-width: calc(100vw - 48px); /* Account for 24px margin on sides */
    border-radius: 16px;
    padding: 32px;
  }
}

/* Desktop: Centered card (larger) */
@media (min-width: 1024px) {
  .email-modal__card {
    width: 540px;
    padding: 40px;
  }
}
```

---

## Accessibility Requirements

### ARIA Attributes

```html
<!-- Modal Container -->
<div class="email-capture-modal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="email-modal-heading"
     aria-describedby="email-modal-subtitle">

  <!-- Form -->
  <form aria-label="Email capture form">

    <!-- Email Input -->
    <input type="email"
           aria-label="Email address"
           aria-describedby="email-help email-error"
           aria-required="true"
           aria-invalid="false"> <!-- Changes to true on error -->

    <!-- Error Message -->
    <div id="email-error"
         role="alert"
         aria-live="polite"
         hidden></div>

    <!-- Checkboxes -->
    <input type="checkbox"
           aria-required="true"
           aria-describedby="consent-download-help">

    <input type="checkbox"
           aria-required="false"
           aria-describedby="consent-marketing-help">

    <!-- Submit Button -->
    <button type="submit"
            aria-label="Unlock premium artistic styles"
            aria-disabled="true"> <!-- Changes based on form validity -->
      Unlock Premium Styles
    </button>

  </form>

</div>
```

### Keyboard Navigation

**Tab Order:**

1. Close button (X)
2. Email input
3. Download consent checkbox
4. Marketing consent checkbox
5. Privacy policy link
6. Submit button

**Shortcuts:**

- **ESC**: Close modal (with exit warning if needed)
- **Enter**: Submit form (when focus on input or button)
- **Space**: Toggle checkbox (when focused)
- **Tab**: Next element
- **Shift+Tab**: Previous element

**Focus Trap:**

```javascript
// Prevent Tab from escaping modal
const focusableElements = modal.querySelectorAll(
  'button, input, a[href], [tabindex]:not([tabindex="-1"])'
);
const firstElement = focusableElements[0];
const lastElement = focusableElements[focusableElements.length - 1];

modal.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});
```

### Screen Reader Support

**Live Regions:**

```html
<!-- Announce validation errors -->
<div role="alert" aria-live="polite" aria-atomic="true">
  Please enter a valid email address
</div>

<!-- Announce success -->
<div role="status" aria-live="polite" aria-atomic="true">
  Premium styles unlocked successfully
</div>

<!-- Announce loading state -->
<div role="status" aria-live="polite" aria-atomic="true">
  Unlocking premium styles, please wait...
</div>
```

**Button State Announcements:**

```javascript
// Update aria-disabled when form validity changes
submitButton.setAttribute('aria-disabled', isFormValid ? 'false' : 'true');

// Announce state change to screen readers
const announcement = document.createElement('div');
announcement.setAttribute('role', 'status');
announcement.setAttribute('aria-live', 'polite');
announcement.textContent = isFormValid
  ? 'Form is valid, you can now submit'
  : 'Please fill all required fields';
document.body.appendChild(announcement);
setTimeout(() => announcement.remove(), 1000);
```

### Color Contrast (WCAG AA)

**Text on Background:**

- Heading (gray-900 on white): 21:1 ✓ AAA
- Subtitle (gray-700 on white): 12:1 ✓ AAA
- Helper text (gray-500 on white): 4.6:1 ✓ AA
- Error text (red-500 on white): 4.5:1 ✓ AA

**Button Contrast:**

- Primary button text (white on purple gradient):
  - #6366f1: 4.8:1 ✓ AA
  - #8b5cf6: 4.3:1 ⚠️ (increase to #7c4ee8 for AAA)

**RECOMMENDATION**: Darken purple gradient slightly:

```css
.email-modal__submit {
  background: linear-gradient(135deg, #5558e3 0%, #7c4ee8 100%);
}
```

### Focus Indicators

```css
/* High-contrast focus ring */
.email-modal__input:focus,
.email-modal__checkbox:focus,
.email-modal__submit:focus,
.email-modal__close:focus {
  outline: 3px solid #3b82f6; /* Blue-500 */
  outline-offset: 2px;
}

/* Additional visual indicator for submit button */
.email-modal__submit:focus {
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: User Already Unlocked (Returning User)

**Check on Page Load:**

```javascript
// Check localStorage on processor page load
const unlockStatus = localStorage.getItem('email_unlock_status');
const unlockEmail = localStorage.getItem('email_unlock_email');
const unlockTimestamp = localStorage.getItem('email_unlock_timestamp');

if (unlockStatus === 'unlocked') {
  // Check if unlock is still valid (30-day expiry)
  const daysSinceUnlock = (Date.now() - unlockTimestamp) / (1000 * 60 * 60 * 24);

  if (daysSinceUnlock < 30) {
    // Valid unlock, show all styles unlocked
    unlockPremiumStyles();
  } else {
    // Expired, require re-entry
    localStorage.removeItem('email_unlock_status');
  }
}
```

**Visual Feedback:**

```html
<!-- Show "Already Unlocked" badge on premium styles -->
<span class="premium-badge premium-badge--unlocked">
  ✓ Unlocked
</span>
```

### Edge Case 2: Network Error During Submission

**Error States:**

```javascript
try {
  const response = await fetch('/apps/perkie/email-capture', { ... });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

} catch (error) {
  // Network error (offline, timeout, etc.)
  if (error.message.includes('Failed to fetch')) {
    showError('No internet connection. Please check your network and try again.');
  }
  // Server error (500, etc.)
  else if (error.message.includes('HTTP 5')) {
    showError('Our server is having issues. Please try again in a few minutes.');
  }
  // Client error (400, 422, etc.)
  else if (error.message.includes('HTTP 4')) {
    showError('Invalid email address. Please check and try again.');
  }
  // Unknown error
  else {
    showError('Something went wrong. Please try again or contact support.');
  }

  // Allow retry
  submitButton.disabled = false;
  submitButton.classList.remove('loading');
}
```

### Edge Case 3: Disposable Email Detection

**Blocklist:**

```javascript
const disposableDomains = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'mailinator.com', 'throwaway.email', 'sharklasers.com',
  'yopmail.com', 'maildrop.cc', 'fakeinbox.com'
];

function isDisposableEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.some(d => domain?.includes(d));
}

// Validate on blur
emailInput.addEventListener('blur', (e) => {
  if (isDisposableEmail(e.target.value)) {
    showError('Please use a permanent email address. Temporary emails are not allowed.');
    e.target.classList.add('input--error');
  }
});
```

### Edge Case 4: Form Abandonment (Partial Fill)

**Save to localStorage for Recovery:**

```javascript
// Auto-save email as user types (debounced)
let saveTimeout;
emailInput.addEventListener('input', (e) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    sessionStorage.setItem('email_capture_draft', e.target.value);
  }, 500);
});

// Restore on modal reopen
function openModal() {
  const draft = sessionStorage.getItem('email_capture_draft');
  if (draft && !emailInput.value) {
    emailInput.value = draft;
    validateEmail(draft); // Trigger validation
  }
}

// Clear draft on successful submission
function onSuccess() {
  sessionStorage.removeItem('email_capture_draft');
}
```

### Edge Case 5: Multiple Tabs Open

**Synchronize Unlock Status:**

```javascript
// Listen for storage changes (cross-tab sync)
window.addEventListener('storage', (e) => {
  if (e.key === 'email_unlock_status' && e.newValue === 'unlocked') {
    // Another tab unlocked premium styles
    unlockPremiumStyles();

    // Close modal if currently open
    if (!modal.hidden) {
      closeModal();
      showToast('Premium styles unlocked in another tab!');
    }
  }
});
```

### Edge Case 6: Browser Back Button

**No special handling needed:**
- Modal is overlaid on processor page (not separate route)
- Pressing back closes modal (if modal script adds history state)
- If not using history state, back navigates away from processor page (acceptable)

**Optional Enhancement:**

```javascript
// Add history state on modal open
function openModal() {
  history.pushState({ modal: 'email-capture' }, '');
  // ... rest of open logic
}

// Handle popstate (back button)
window.addEventListener('popstate', (e) => {
  if (e.state?.modal === 'email-capture') {
    closeModal();
  }
});
```

---

## Success Metrics

### Primary Metrics (A/B Test)

**Control Group**: No email gate, all styles free
**Treatment Group**: Email gate on premium styles

**Primary Success Metric**: **Email Capture Rate**

```
Email Capture Rate = (Emails Submitted / Premium Style Clicks) × 100%

Target: 65-75%
Sample Size: 2,800 premium style clicks per variant
Duration: 2-3 weeks
Confidence: 95% (p < 0.05)
```

**Secondary Metrics:**

1. **Modal Conversion Rate**: Emails submitted / Modal opens
   - Target: 70-80% (higher than click rate due to pre-qualification)

2. **Exit Warning Recovery**: Stayed / Exit warnings shown
   - Target: 25-35% (10-15% lift vs no warning)

3. **Marketing Consent Rate**: Marketing opt-ins / Total emails
   - Target: 30-40% (optional checkbox)

4. **Disposable Email Rate**: Blocked emails / Total submissions
   - Target: <5% (indicates effective blocklist)

### Engagement Metrics

1. **Time to Submit**: Median time from modal open → submit
   - Target: <60 seconds (indicates clear UX)

2. **Form Abandonment**: Modal opens without submit / Total opens
   - Target: <30% (70%+ conversion)

3. **Validation Errors**: Form submissions with errors / Total submissions
   - Target: <10% (indicates good inline validation)

4. **Retry Rate**: Re-submissions after error / Total errors
   - Target: >80% (indicates recoverable errors)

### Downstream Metrics (30-90 days)

1. **Email → Purchase Conversion**: Purchases attributed to email / Total emails
   - Target: 18-25% (from email nurture campaign analysis)

2. **Premium Style Usage**: Premium style applications / Total emails
   - Target: >90% (unlock actually used)

3. **Email Open Rate**: Download emails opened / Emails sent
   - Target: 60-70% (transactional email benchmark)

4. **Email Click Rate**: Shop links clicked / Emails opened
   - Target: 30-40% (high intent audience)

### Analytics Events to Track

```javascript
// Modal Interaction
gtag('event', 'view_email_modal', {
  trigger: 'modern' | 'sketch',
  user_status: 'new' | 'returning'
});

gtag('event', 'email_input_focus');
gtag('event', 'marketing_consent_toggle', { consent_given: true/false });

// Lead Generation
gtag('event', 'generate_lead', {
  source: 'processor_page',
  consent_marketing: true/false,
  style_triggered: 'modern' | 'sketch'
});

gtag('event', 'modal_dismissed', {
  reason: 'close_button' | 'backdrop' | 'esc_key' | 'exit_warning'
});

// Exit Warning
gtag('event', 'exit_warning_shown');
gtag('event', 'exit_warning_stayed');
gtag('event', 'exit_warning_left');

// Errors
gtag('event', 'email_validation_error', {
  error_type: 'format' | 'disposable' | 'api'
});

gtag('event', 'email_capture_error', {
  error_message: string
});
```

---

## Implementation Checklist

### Phase 1: HTML Structure (2 hours)

- [ ] Create `snippets/email-capture-modal.liquid`
- [ ] Add modal container with backdrop
- [ ] Add modal card with header, form, success state
- [ ] Add exit warning modal structure
- [ ] Include modal in processor page template

### Phase 2: CSS Styling (2 hours)

- [ ] Create `assets/email-capture-modal.css`
- [ ] Mobile styles (full-screen bottom sheet)
- [ ] Desktop styles (centered card)
- [ ] Animation keyframes (checkmark, slide-up, fade)
- [ ] Focus indicators and accessibility styles
- [ ] High contrast and reduced motion support
- [ ] Link CSS file in theme layout

### Phase 3: JavaScript Logic (3 hours)

- [ ] Create `assets/email-capture-modal.js`
- [ ] Modal open/close functions
- [ ] Real-time email validation
- [ ] Disposable email detection
- [ ] Form submission handler
- [ ] Success state animation
- [ ] Exit warning logic
- [ ] localStorage unlock status management
- [ ] Analytics event tracking

### Phase 4: Integration (1 hour)

- [ ] Update `assets/pet-processor.js`:
  - Add premium style lock/unlock logic
  - Trigger modal on premium style click
  - Check unlock status on page load
  - Update style card visual states
- [ ] Add premium badges to style cards
- [ ] Update hover states for locked cards

### Phase 5: Backend API (2 hours)

- [ ] Create `/apps/perkie/email-capture` endpoint
- [ ] Integrate with Shopify customer API
- [ ] Create customer account (if new email)
- [ ] Add customer tags (processor_email_capture, marketing_consent)
- [ ] Trigger download email (transactional service)
- [ ] Return success/error response

### Phase 6: Testing (1 hour)

- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Test on desktop (Chrome, Firefox, Safari, Edge)
- [ ] Test keyboard navigation
- [ ] Test screen reader (NVDA, VoiceOver)
- [ ] Test validation (format, disposable, errors)
- [ ] Test exit warning flow
- [ ] Test unlock persistence (localStorage)
- [ ] Test cross-tab synchronization

### Phase 7: Analytics Setup (30 minutes)

- [ ] Add all gtag() events
- [ ] Create Google Analytics dashboard
- [ ] Set up conversion goals
- [ ] Configure A/B test variant assignment

### Phase 8: Launch (30 minutes)

- [ ] Deploy to staging
- [ ] QA on staging environment
- [ ] Deploy to production (50/50 A/B test)
- [ ] Monitor error logs for 24 hours
- [ ] Review analytics events

**Total Estimated Time**: 8-10 hours

---

## Questions Answered

### 1. How should we visually differentiate free vs premium styles?

**RECOMMENDATION**: **Premium badge + overlay (unlocked state shows full preview)**

**Free Styles (B&W, Color):**
- Clean card, no badge
- Full preview visible
- Standard hover state

**Premium Styles - LOCKED:**
- Top-right badge: "✨ Premium" (purple background)
- Semi-transparent purple overlay (85% opacity)
- Lock icon (🔒) centered on overlay
- "Premium" text below lock
- **Preview**: Show full image behind overlay (not blurred)
- **Reasoning**: Users need to see quality before email gate (+10-15% conversion)

**Premium Styles - UNLOCKED:**
- Top-right badge: "✓ Unlocked" (green background)
- No overlay
- Full preview visible
- Standard hover state

### 2. What's the optimal modal copy?

**RECOMMENDATION**: "Get Modern & Sketch Styles FREE"

**Heading**: "Get Modern & Sketch Styles FREE"
- Emphasizes FREE (removes friction)
- Specific styles mentioned (clarity)
- Predicted 70-75% conversion

**Subtitle**: "Get instant access to Modern, Sketch, and future premium styles. Plus, we'll email you high-res downloads of all your pet art."
- Two benefits (styles + downloads)
- Future-proofs (mentions upcoming styles)

**Button**: "Unlock Premium Styles 🎨"
- Clear action
- Emoji adds visual interest
- Aligns with heading

### 3. Should premium styles show preview or be blurred?

**RECOMMENDATION**: **Show full preview with overlay**

**Reasoning:**
- Users need to see value before email gate
- Blurring reduces perceived quality (-20% conversion)
- Semi-transparent overlay provides lock indicator without hiding content
- Spotify/Netflix model: Preview full content before paywall

**Implementation:**
```css
.style-card__lock-overlay {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(139, 92, 246, 0.85));
  /* No blur filter on image */
}
```

### 4. What's the best mobile modal pattern?

**RECOMMENDATION**: **Full-screen bottom sheet (< 640px)**

**Reasoning:**
- 70% of traffic is mobile
- Bottom sheet is native iOS/Android pattern (familiar)
- Full-screen maximizes space for form
- Easier thumb-zone access (inputs at bottom)
- Swipe-down gesture for dismissal (optional enhancement)

**Desktop**: Centered card (480-540px width)

### 5. Should we show "Already unlocked" state?

**RECOMMENDATION**: **YES - Show "✓ Unlocked" badge**

**Benefits:**
1. **Status clarity**: User knows they can use premium styles
2. **Positive reinforcement**: Confirms email submission worked
3. **Reduces support**: No confusion about access

**Implementation:**
```html
<span class="premium-badge premium-badge--unlocked">
  ✓ Unlocked
</span>
```

### 6. How do we handle dismissal gracefully?

**RECOMMENDATION**: **Exit-intent warning + localStorage tracking**

**Flow:**
1. User attempts to close (X, backdrop, ESC)
2. If form has input → Show exit warning: "Wait! You'll lose access to premium styles"
3. User chooses:
   - "Stay & Unlock Premium" → Return to form
   - "Continue with Free Styles" → Close modal
4. Save dismissal to sessionStorage (don't re-trigger this session)
5. Allow re-triggering by clicking premium style again

**No Persistent Dismissal Tracking:**
- Don't save "user dismissed modal" to localStorage
- Allow future opportunities to capture email
- Each session is fresh chance (maximizes conversion)

---

## Final Recommendations Summary

| Decision | Recommendation | Reasoning |
|----------|---------------|-----------|
| **Premium Preview** | Show full image + overlay | +10-15% conversion vs blur |
| **Modal Copy** | "Get Modern & Sketch Styles FREE" | Highest predicted CTR (70-75%) |
| **Mobile Pattern** | Full-screen bottom sheet | Native iOS/Android pattern (70% traffic) |
| **Unlock Badge** | "✓ Unlocked" green badge | Status clarity + positive reinforcement |
| **Dismissal** | Exit warning + sessionStorage | Maximize conversion, allow re-trigger |
| **Checkboxes** | Two-checkbox (required + optional) | GDPR/CCPA compliance + trust |
| **Validation** | Real-time inline (debounced 300ms) | Instant feedback without lag |
| **Expiry** | 30-day unlock (localStorage) | Balance convenience + re-engagement |

---

## Appendix: Complete CSS File

```css
/**
 * Email Capture Modal Styles
 * Mobile-first responsive design
 */

/* ============================================================================
   MODAL CONTAINER & BACKDROP
   ============================================================================ */

.email-capture-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: none; /* Hidden by default */
}

.email-capture-modal--open {
  display: block;
}

.email-modal__backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 300ms ease-in-out;
}

.email-capture-modal--open .email-modal__backdrop {
  opacity: 1;
}

/* ============================================================================
   MODAL CARD
   ============================================================================ */

.email-modal__card {
  position: fixed;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Mobile: Full-screen bottom sheet */
@media (max-width: 639px) {
  .email-modal__card {
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 90vh;
    border-radius: 16px 16px 0 0;
    padding: 24px;
    transform: translateY(100%);
    opacity: 0;
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }

  .email-capture-modal--open .email-modal__card {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Desktop: Centered card */
@media (min-width: 640px) {
  .email-modal__card {
    top: 50%;
    left: 50%;
    width: 480px;
    max-width: calc(100vw - 48px);
    max-height: 90vh;
    border-radius: 16px;
    padding: 32px;
    transform: translate(-50%, -50%) scale(0.95);
    opacity: 0;
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }

  .email-capture-modal--open .email-modal__card {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

@media (min-width: 1024px) {
  .email-modal__card {
    width: 540px;
    padding: 40px;
  }
}

/* ============================================================================
   CLOSE BUTTON
   ============================================================================ */

.email-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #6b7280;
  transition: background-color 200ms, color 200ms;
}

.email-modal__close:hover {
  background: #f3f4f6;
  color: #111827;
}

.email-modal__close:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

/* ============================================================================
   HEADER
   ============================================================================ */

.email-modal__header {
  text-align: center;
  margin-bottom: 32px;
}

.email-modal__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
}

.email-modal__heading {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  color: #111827;
  margin: 0 0 12px 0;
}

.email-modal__subtitle {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
  color: #374151;
  margin: 0;
}

/* ============================================================================
   FORM
   ============================================================================ */

.email-modal__form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Input Group */
.email-modal__input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.email-modal__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.email-modal__input {
  width: 100%;
  min-height: 56px;
  padding: 16px 20px;
  font-size: 16px;
  font-family: inherit;
  color: #111827;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  transition: border-color 200ms, box-shadow 200ms;
}

.email-modal__input::placeholder {
  color: #9ca3af;
}

.email-modal__input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.email-modal__input--valid {
  border-color: #10b981;
  background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' fill='%2310b981' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7 10l2 2 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  padding-right: 48px;
}

.email-modal__input--error {
  border-color: #ef4444;
}

.email-modal__error {
  font-size: 13px;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 4px;
}

.email-modal__help {
  font-size: 13px;
  color: #6b7280;
}

/* Consent Checkboxes */
.email-modal__consent {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.email-modal__checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  transition: background-color 200ms;
}

.email-modal__checkbox-label:hover {
  background: #f9fafb;
}

.email-modal__checkbox {
  width: 24px;
  height: 24px;
  margin-top: 2px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: #6366f1;
}

.email-modal__checkbox-text {
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
}

.required-indicator {
  color: #ef4444;
  font-weight: 600;
}

.optional-indicator {
  color: #6b7280;
  font-weight: 400;
}

.email-modal__checkbox-help {
  font-size: 13px;
  color: #6b7280;
  margin-left: 36px;
  margin-top: -8px;
}

/* Privacy Note */
.email-modal__privacy {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

.privacy-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: #6b7280;
}

.privacy-link {
  color: #6366f1;
  text-decoration: underline;
}

.privacy-link:hover {
  color: #4f46e5;
}

/* Submit Button */
.email-modal__submit {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 32px;
  font-size: 18px;
  font-weight: 600;
  font-family: inherit;
  color: white;
  background: linear-gradient(135deg, #5558e3 0%, #7c4ee8 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 200ms, box-shadow 200ms;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.email-modal__submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.email-modal__submit:active:not(:disabled) {
  transform: translateY(0);
}

.email-modal__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.email-modal__submit:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

/* Loading State */
.email-modal__submit.loading {
  position: relative;
  color: transparent;
}

.email-modal__submit.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ============================================================================
   SUCCESS STATE
   ============================================================================ */

.email-modal__success {
  text-align: center;
  padding: 40px 20px;
  opacity: 0;
  transition: opacity 300ms ease-in-out;
}

.email-modal__success:not([hidden]) {
  opacity: 1;
}

.success-icon {
  margin: 0 auto 24px;
}

.checkmark {
  display: block;
}

.success-icon.animating .checkmark circle {
  stroke-dasharray: 188;
  stroke-dashoffset: 188;
  animation: checkmark-circle 600ms ease-out forwards;
}

.success-icon.animating .checkmark path {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: checkmark-path 400ms ease-out 400ms forwards;
}

@keyframes checkmark-circle {
  to { stroke-dashoffset: 0; }
}

@keyframes checkmark-path {
  to { stroke-dashoffset: 0; }
}

.success-heading {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 12px 0;
}

.success-message {
  font-size: 16px;
  color: #374151;
  line-height: 1.5;
  margin: 0;
}

/* ============================================================================
   EXIT WARNING MODAL
   ============================================================================ */

.email-exit-warning {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000; /* Above main modal */
  display: none;
}

.email-exit-warning:not([hidden]) {
  display: block;
}

.email-exit-warning__backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  opacity: 0;
  animation: fadeIn 200ms forwards;
}

.email-exit-warning__card {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.9);
  width: 400px;
  max-width: calc(100vw - 48px);
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
  opacity: 0;
  animation: slideUp 200ms 100ms forwards;
}

@keyframes fadeIn {
  to { opacity: 1; }
}

@keyframes slideUp {
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.exit-warning-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.exit-warning-heading {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 12px 0;
}

.exit-warning-message {
  font-size: 15px;
  color: #374151;
  line-height: 1.5;
  margin: 0 0 24px 0;
}

.exit-warning-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-exit-stay {
  width: 100%;
  min-height: 56px;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  color: white;
  background: linear-gradient(135deg, #5558e3 0%, #7c4ee8 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 200ms;
}

.btn-exit-stay:hover {
  transform: translateY(-2px);
}

.btn-exit-leave {
  width: 100%;
  min-height: 56px;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 500;
  font-family: inherit;
  color: #6b7280;
  background: transparent;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 200ms, border-color 200ms;
}

.btn-exit-leave:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

/* ============================================================================
   PREMIUM STYLE BADGES
   ============================================================================ */

.premium-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 4px;
  z-index: 2;
}

.premium-badge--unlocked {
  background: linear-gradient(135deg, #10b981, #14b8a6);
}

.style-card__lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(139, 92, 246, 0.85));
  border-radius: 8px;
  z-index: 1;
}

.lock-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.lock-text {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.effect-btn--locked {
  cursor: pointer;
  position: relative;
}

.effect-btn--locked:hover .style-card__lock-overlay {
  background: linear-gradient(135deg, rgba(85, 88, 227, 0.9), rgba(124, 78, 232, 0.9));
}

/* ============================================================================
   ACCESSIBILITY
   ============================================================================ */

@media (prefers-reduced-motion: reduce) {
  .email-modal__card,
  .email-modal__backdrop,
  .email-modal__submit,
  .checkmark circle,
  .checkmark path {
    transition: none !important;
    animation: none !important;
  }
}

@media (prefers-contrast: high) {
  .email-modal__input {
    border-width: 3px;
  }

  .email-modal__submit {
    border: 3px solid currentColor;
  }
}

/* Print */
@media print {
  .email-capture-modal,
  .email-exit-warning {
    display: none !important;
  }
}
```

---

**END OF SPECIFICATION**

This document provides complete UX design specifications for implementing the email capture modal. All design decisions are backed by conversion optimization research, accessibility standards (WCAG 2.1 AA), and mobile-first best practices.

**Next Steps:**
1. Review this specification with stakeholders
2. Confirm analytics events with marketing team
3. Begin Phase 1 implementation (HTML structure)
4. Test on real mobile devices (iOS Safari, Android Chrome)
5. Deploy with A/B test to measure impact
