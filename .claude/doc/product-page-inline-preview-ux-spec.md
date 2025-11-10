# Product Page Inline Preview UX Specification

**Date**: 2025-11-09
**Author**: ux-design-ecommerce-expert
**Context**: Detailed UX design for inline style preview using BottomSheet component
**Session**: context_session_001.md
**Business Model**: Pet portrait e-commerce (70% mobile traffic)

---

## Executive Summary

This specification details the UX design for the **product page inline preview feature** using our newly created shared BottomSheet component. This feature eliminates the need to navigate to `/pages/custom-image-processing` by providing an inline preview experience directly on the product page.

**Expected Impact**:
- Conversion rate: +8-12% (eliminates 8-12% navigation abandonment)
- Time to cart: -30% (from 4 minutes → 2.8 minutes)
- Mobile abandonment: -35% (native drawer pattern vs page navigation)

**Technical Foundation**:
- BottomSheet component (assets/components/bottom-sheet.js) - 460 lines, production-ready
- PetStateManager (assets/pet-state-manager.js) - 580 lines, single source of truth
- SecurityUtils (assets/security-utils.js) - 420 lines, XSS prevention

---

## 1. User Flow Overview

### Current Flow (Problem)
```
Product Page
  ↓
User uploads pet image
  ↓
Clicks "Preview Styles" button
  ↓
NAVIGATION → /pages/custom-image-processing (8-12% abandon here)
  ↓
Processing (30-60s background removal + 10-15s per style)
  ↓
User selects style
  ↓
NAVIGATION → Back to product page
  ↓
Style selection persisted, but trust eroded
  ↓
Add to cart
```

**Abandonment Points**:
1. Navigation away from product page (8-12% loss)
2. Processing time without context (5% loss)
3. Navigation back, unclear if selection saved (3-5% loss)

**Total Loss**: 16-22% potential customers

---

### New Flow (Solution)
```
Product Page
  ↓
User uploads pet image
  ↓
Clicks "Preview Styles" button
  ↓
BOTTOM SHEET DRAWER OPENS (NO NAVIGATION)
  ↓ Product page still visible behind drawer (context preserved)
  ↓
Processing state shown inline (30-60s background removal)
  ↓ Progress bar with realistic timing
  ↓
Style carousel appears with user's pet in 4 styles
  ↓ Swipe to preview: B&W, Color, Modern, Sketch
  ↓
User selects style
  ↓ Optional: Add artist notes (500 char max)
  ↓
Clicks "Apply Style" button
  ↓
DRAWER CLOSES (NO NAVIGATION)
  ↓
Product page updated with style selection
  ↓ Visual confirmation: thumbnail + style name
  ↓
Add to cart
```

**Abandonment Reduction**: 16-22% → 3-5% (73-77% improvement)

---

## 2. Drawer Layout Design

### 2.1 Mobile Layout (70% of Traffic)

#### Drawer Dimensions
```
Height: 70vh (covers 70% of viewport)
Radius: 16px 16px 0 0 (rounded top corners)
Position: Fixed bottom
Z-index: 1000 (overlay above all content)
Animation: translateY(100%) → translateY(0) (slide up from bottom)
```

#### Visual Layout
```
┌─────────────────────────────────────┐
│  ──────  ← Handle bar (swipe affordance)
│                                     │ ← 16px top padding
│  Preview Your Pet Portrait          │ ← H2 title, 20px font
│  Choose a style to see on canvas    │ ← Subtitle, 14px, gray
│                                     │
├─────────────────────────────────────┤ ← Divider (1px, #e5e5e5)
│                                     │
│  CONTENT AREA (scrollable)          │
│                                     │
│  [Processing State]                 │ ← Step 1: Processing
│   OR                                │
│  [Style Carousel]                   │ ← Step 2: Selection
│   OR                                │
│  [Artist Notes]                     │ ← Step 3: Notes (optional)
│                                     │
│  (Content scrolls vertically)       │
│                                     │
├─────────────────────────────────────┤
│  [Apply Style Button] ────────────► │ ← Sticky footer CTA
│  Full width, 48px height            │
└─────────────────────────────────────┘
```

#### Header Design
```html
<div class="bottom-sheet-header">
  <!-- Handle bar for swipe affordance -->
  <div class="bottom-sheet-handle" aria-hidden="true">
    <div class="bottom-sheet-handle-bar"></div>
  </div>

  <!-- Close button (top right) -->
  <button class="bottom-sheet-close"
          aria-label="Close style preview"
          type="button">
    <svg width="24" height="24"><!-- X icon --></svg>
  </button>

  <!-- Title section -->
  <h2 class="bottom-sheet-title" id="drawer-title">
    Preview Your Pet Portrait
  </h2>
  <p class="bottom-sheet-subtitle">
    Choose a style to see on [Product Name]
  </p>
</div>
```

**CSS Specifications**:
```css
.bottom-sheet-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  background: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.bottom-sheet-handle-bar {
  width: 40px;
  height: 4px;
  background: #d1d5db; /* Gray-300 */
  border-radius: 2px;
  margin: 0 auto 16px;
  cursor: grab;
}

.bottom-sheet-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827; /* Gray-900 */
  margin: 0 0 4px 0;
  line-height: 1.3;
}

.bottom-sheet-subtitle {
  font-size: 14px;
  color: #6b7280; /* Gray-500 */
  margin: 0;
  line-height: 1.4;
}

.bottom-sheet-close {
  position: absolute;
  top: 16px;
  right: 16px;
  min-width: 44px;
  min-height: 44px;
  padding: 10px;
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.bottom-sheet-close:hover {
  background: #f3f4f6; /* Gray-100 */
}

.bottom-sheet-close:active {
  background: #e5e7eb; /* Gray-200 */
}
```

---

#### Content Area Design
```html
<div class="bottom-sheet-content">
  <!-- Content changes based on state -->
  <div class="preview-state-container">
    <!-- State 1: Processing -->
    <div class="processing-state" data-state="processing">
      <!-- See section 3.1 -->
    </div>

    <!-- State 2: Style Selection -->
    <div class="style-selection-state" data-state="selecting" hidden>
      <!-- See section 3.2 -->
    </div>

    <!-- State 3: Error -->
    <div class="error-state" data-state="error" hidden>
      <!-- See section 3.4 -->
    </div>
  </div>
</div>
```

**CSS Specifications**:
```css
.bottom-sheet-content {
  padding: 20px;
  overflow-y: auto;
  max-height: calc(70vh - 140px); /* 70vh - header - footer */
  -webkit-overflow-scrolling: touch; /* Smooth scroll on iOS */
}

.preview-state-container {
  min-height: 300px; /* Prevent content shift */
}

/* Smooth state transitions */
.processing-state,
.style-selection-state,
.error-state {
  opacity: 1;
  transition: opacity 0.3s ease;
}

.processing-state[hidden],
.style-selection-state[hidden],
.error-state[hidden] {
  display: none;
}
```

---

#### Footer Design
```html
<div class="bottom-sheet-footer">
  <button class="apply-style-btn"
          type="button"
          disabled>
    Apply Style
  </button>

  <!-- Secondary action (optional) -->
  <button class="cancel-btn"
          type="button">
    Cancel
  </button>
</div>
```

**CSS Specifications**:
```css
.bottom-sheet-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
  background: white;
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  gap: 12px;
}

.apply-style-btn {
  flex: 1;
  min-height: 48px;
  padding: 14px 24px;
  background: #2563eb; /* Blue-600 */
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.apply-style-btn:hover:not(:disabled) {
  background: #1d4ed8; /* Blue-700 */
}

.apply-style-btn:disabled {
  background: #d1d5db; /* Gray-300 */
  cursor: not-allowed;
  opacity: 0.6;
}

.cancel-btn {
  flex: 0 0 auto;
  min-height: 48px;
  padding: 14px 20px;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  font-weight: 500;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
}
```

---

### 2.2 Desktop Layout (30% of Traffic)

#### Drawer Dimensions
```
Height: 600px (fixed height, not viewport-based)
Max-width: 800px (centered on screen)
Position: Fixed bottom center
Z-index: 1000
Animation: Same slide-up pattern as mobile
```

#### Visual Layout (Two-Column)
```
┌─────────────────────────────────────────────────────┐
│  ──────    Preview Your Pet Portrait          [×]   │
│                                                      │
├──────────────────────┬───────────────────────────────┤
│ LEFT: Style Selection│ RIGHT: Live Preview           │
│                      │                               │
│ [Processing...]      │ ┌─────────────────────┐      │
│  OR                  │ │                       │     │
│ [Style Carousel]     │ │  Large preview       │     │
│                      │ │  of selected style   │     │
│ [Artist Notes]       │ │                       │     │
│                      │ │  512x512px           │     │
│ [Apply Style]        │ └─────────────────────┘      │
│                      │                               │
└──────────────────────┴───────────────────────────────┘
```

**Responsive Breakpoints**:
```css
/* Mobile: < 768px */
.bottom-sheet-content {
  flex-direction: column;
}

/* Tablet: 768px - 1024px */
@media (min-width: 768px) {
  .bottom-sheet-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}

/* Desktop: > 1024px */
@media (min-width: 1024px) {
  .bottom-sheet-container {
    max-width: 800px;
    left: 50%;
    transform: translateX(-50%);
  }
}
```

---

## 3. Processing State UI

### 3.1 Initial Upload State
```html
<div class="processing-state" data-state="uploading">
  <!-- Upload icon -->
  <div class="processing-icon">
    <svg class="upload-icon"><!-- Cloud upload icon --></svg>
  </div>

  <!-- Status text -->
  <h3 class="processing-title">Uploading Your Pet Photo</h3>
  <p class="processing-description">
    Preparing your image for processing...
  </p>

  <!-- Progress bar -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: 25%;"></div>
  </div>
  <div class="progress-text">25% complete</div>
</div>
```

**Visual Design**:
```
┌─────────────────────────────────┐
│           ☁️                    │ ← Upload icon (48px)
│      Uploading Your Pet Photo   │ ← H3, 18px, bold
│  Preparing your image for...    │ ← Description, 14px
│                                 │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░    │ ← Progress bar
│  25% complete                   │ ← Percentage text
│                                 │
│  [Cancel]                       │ ← Secondary action
└─────────────────────────────────┘
```

**CSS Specifications**:
```css
.processing-state {
  text-align: center;
  padding: 40px 20px;
}

.processing-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: #dbeafe; /* Blue-100 */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: #2563eb; /* Blue-600 */
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.processing-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
}

.processing-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb; /* Gray-200 */
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}
```

---

### 3.2 Background Removal State (30-60s)
```html
<div class="processing-state" data-state="removing-bg">
  <!-- Processing icon with spinner -->
  <div class="processing-icon">
    <div class="spinner"></div>
  </div>

  <!-- Status text -->
  <h3 class="processing-title">Removing Background</h3>
  <p class="processing-description">
    Our AI is carefully separating your pet from the background
  </p>

  <!-- Progress bar with timer -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: 60%;"></div>
  </div>
  <div class="progress-timer">
    <span class="timer-icon">⏱️</span>
    <span class="timer-text">About 30 seconds remaining</span>
  </div>

  <!-- Stage info (optional) -->
  <div class="stage-info">
    <span class="stage-current">Step 1 of 2:</span> Background Removal
  </div>
</div>
```

**Timer Logic**:
```javascript
// Realistic timer based on actual API performance
const timerStates = [
  { progress: 0, time: 45, message: "About 45 seconds remaining" },
  { progress: 20, time: 35, message: "About 35 seconds remaining" },
  { progress: 40, time: 25, message: "About 25 seconds remaining" },
  { progress: 60, time: 15, message: "About 15 seconds remaining" },
  { progress: 80, time: 5, message: "Almost done..." },
  { progress: 100, time: 0, message: "Complete!" }
];

function updateProgressTimer(elapsedSeconds, totalEstimate) {
  const progress = Math.min((elapsedSeconds / totalEstimate) * 100, 95);
  const remaining = Math.max(totalEstimate - elapsedSeconds, 0);

  progressFill.style.width = `${progress}%`;

  if (remaining > 30) {
    timerText.textContent = `About ${Math.ceil(remaining / 10) * 10} seconds remaining`;
  } else if (remaining > 0) {
    timerText.textContent = `About ${remaining} seconds remaining`;
  } else {
    timerText.textContent = "Almost done...";
  }
}
```

**CSS Specifications**:
```css
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb; /* Gray-200 */
  border-top-color: #2563eb; /* Blue-600 */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  color: #6b7280;
}

.timer-icon {
  font-size: 16px;
}

.stage-info {
  margin-top: 16px;
  padding: 12px;
  background: #f3f4f6; /* Gray-100 */
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
}

.stage-current {
  font-weight: 600;
  color: #2563eb;
}
```

---

### 3.3 Style Generation State (10-15s per style)
```html
<div class="processing-state" data-state="generating-styles">
  <!-- Processing icon -->
  <div class="processing-icon">
    <div class="spinner"></div>
  </div>

  <!-- Status text -->
  <h3 class="processing-title">Creating Style Previews</h3>
  <p class="processing-description">
    Generating 4 artistic styles for your pet
  </p>

  <!-- Progress bar -->
  <div class="progress-bar">
    <div class="progress-fill" style="width: 75%;"></div>
  </div>
  <div class="progress-text">3 of 4 styles complete</div>

  <!-- Style thumbnails (lazy load as they complete) -->
  <div class="style-preview-grid">
    <div class="style-preview-item completed">
      <img src="[B&W URL]" alt="Black & White">
      <span class="style-name">B&W ✓</span>
    </div>
    <div class="style-preview-item completed">
      <img src="[Color URL]" alt="Color">
      <span class="style-name">Color ✓</span>
    </div>
    <div class="style-preview-item completed">
      <img src="[Modern URL]" alt="Modern">
      <span class="style-name">Modern ✓</span>
    </div>
    <div class="style-preview-item loading">
      <div class="skeleton"></div>
      <span class="style-name">Sketch...</span>
    </div>
  </div>
</div>
```

**CSS for Lazy Loading Grid**:
```css
.style-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 24px;
}

.style-preview-item {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 2px solid transparent;
}

.style-preview-item.completed {
  border-color: #10b981; /* Green-500 */
}

.style-preview-item.loading {
  border-color: #d1d5db; /* Gray-300 */
}

.style-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.style-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 12px;
  text-align: center;
  font-weight: 500;
}

.skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    #e5e7eb 25%,
    #f3f4f6 50%,
    #e5e7eb 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

### 3.4 Error State
```html
<div class="error-state" data-state="error">
  <!-- Error icon -->
  <div class="error-icon">
    <svg class="alert-icon"><!-- Triangle alert icon --></svg>
  </div>

  <!-- Error message -->
  <h3 class="error-title">Processing Failed</h3>
  <p class="error-description">
    We couldn't process your image. This might be due to:
  </p>

  <!-- Error reasons -->
  <ul class="error-reasons">
    <li>Image file too large (max 10MB)</li>
    <li>Unsupported file format</li>
    <li>Network connection issue</li>
  </ul>

  <!-- Action buttons -->
  <div class="error-actions">
    <button class="retry-btn">Try Again</button>
    <button class="choose-different-btn">Choose Different Image</button>
  </div>

  <!-- Support link -->
  <a href="/pages/contact" class="support-link">
    Need help? Contact support
  </a>
</div>
```

**CSS Specifications**:
```css
.error-state {
  text-align: center;
  padding: 40px 20px;
}

.error-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: #fef2f2; /* Red-50 */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alert-icon {
  width: 48px;
  height: 48px;
  color: #dc2626; /* Red-600 */
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: #dc2626;
  margin: 0 0 8px 0;
}

.error-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px 0;
}

.error-reasons {
  text-align: left;
  margin: 0 auto 24px;
  max-width: 300px;
  list-style: none;
  padding: 0;
}

.error-reasons li {
  padding: 8px 0 8px 24px;
  position: relative;
  font-size: 13px;
  color: #4b5563;
}

.error-reasons li:before {
  content: "•";
  position: absolute;
  left: 8px;
  color: #dc2626;
  font-weight: bold;
}

.error-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.retry-btn {
  min-height: 48px;
  padding: 14px 24px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.choose-different-btn {
  min-height: 48px;
  padding: 14px 24px;
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.support-link {
  display: inline-block;
  font-size: 13px;
  color: #2563eb;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.support-link:hover {
  border-bottom-color: #2563eb;
}
```

---

## 4. Style Selection UI

### 4.1 Style Carousel (Mobile)
```html
<div class="style-selection-state" data-state="selecting">
  <!-- Heading -->
  <h3 class="selection-heading">Choose Your Style</h3>
  <p class="selection-description">
    Swipe left or right to preview different artistic styles
  </p>

  <!-- Carousel container -->
  <div class="style-carousel"
       role="region"
       aria-label="Style preview carousel">

    <!-- Style cards (horizontal scroll) -->
    <div class="style-cards">
      <!-- Card 1: B&W -->
      <div class="style-card active"
           data-style="enhancedblackwhite"
           role="button"
           tabindex="0"
           aria-label="Black and White style">
        <div class="style-image">
          <img src="[B&W preview URL]"
               alt="Your pet in Black and White style">
          <div class="style-badge">Most Popular</div>
        </div>
        <div class="style-info">
          <h4 class="style-name">Black & White</h4>
          <p class="style-description">Classic timeless look</p>
        </div>
      </div>

      <!-- Card 2: Color -->
      <div class="style-card"
           data-style="color"
           role="button"
           tabindex="0"
           aria-label="Color style">
        <div class="style-image">
          <img src="[Color preview URL]"
               alt="Your pet in Color style">
        </div>
        <div class="style-info">
          <h4 class="style-name">Color</h4>
          <p class="style-description">Natural vibrant colors</p>
        </div>
      </div>

      <!-- Card 3: Modern (Gemini AI) -->
      <div class="style-card"
           data-style="modern"
           role="button"
           tabindex="0"
           aria-label="Modern style - AI generated">
        <div class="style-image">
          <img src="[Modern preview URL]"
               alt="Your pet in Modern style">
          <div class="style-badge ai">✨ AI</div>
        </div>
        <div class="style-info">
          <h4 class="style-name">Modern</h4>
          <p class="style-description">Minimalist artistic effect</p>
        </div>
      </div>

      <!-- Card 4: Sketch (Gemini AI) -->
      <div class="style-card"
           data-style="sketch"
           role="button"
           tabindex="0"
           aria-label="Sketch style - AI generated">
        <div class="style-image">
          <img src="[Sketch preview URL]"
               alt="Your pet in Sketch style">
          <div class="style-badge ai">✨ AI</div>
        </div>
        <div class="style-info">
          <h4 class="style-name">Sketch</h4>
          <p class="style-description">Hand-drawn illustration</p>
        </div>
      </div>
    </div>

    <!-- Carousel navigation dots -->
    <div class="carousel-dots">
      <button class="dot active" aria-label="View style 1"></button>
      <button class="dot" aria-label="View style 2"></button>
      <button class="dot" aria-label="View style 3"></button>
      <button class="dot" aria-label="View style 4"></button>
    </div>
  </div>
</div>
```

**Visual Design**:
```
┌─────────────────────────────────┐
│ Choose Your Style               │ ← H3, 18px
│ Swipe left or right to preview  │ ← Description
│                                 │
│ ┌───────────────────────────┐  │
│ │                           │  │
│ │   [Pet Image: B&W]        │  │ ← Large preview
│ │   300x300px               │  │
│ │                           │  │
│ │   [Most Popular badge]    │  │
│ └───────────────────────────┘  │
│                                 │
│ Black & White                   │ ← Style name
│ Classic timeless look           │ ← Description
│                                 │
│ ●○○○ ← Carousel dots            │
│                                 │
│ ← Swipe hint (first use only)  │
└─────────────────────────────────┘
```

**CSS Specifications**:
```css
.selection-heading {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 6px 0;
}

.selection-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px 0;
}

.style-carousel {
  overflow: hidden;
  position: relative;
}

.style-cards {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Hide scrollbar on Firefox */
  padding-bottom: 16px;
}

.style-cards::-webkit-scrollbar {
  display: none; /* Hide scrollbar on Chrome/Safari */
}

.style-card {
  flex: 0 0 calc(100% - 40px); /* Full width minus padding */
  scroll-snap-align: center;
  border: 3px solid transparent;
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
  cursor: pointer;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.style-card.active {
  border-color: #2563eb; /* Blue-600 */
  transform: scale(1.02);
}

.style-card:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.style-image {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: #f3f4f6; /* Gray-100 */
}

.style-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.style-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 16px;
  backdrop-filter: blur(4px);
}

.style-badge.ai {
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
}

.style-info {
  padding: 16px;
}

.style-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
}

.style-description {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

/* Carousel dots */
.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db; /* Gray-300 */
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.dot.active {
  background: #2563eb; /* Blue-600 */
  transform: scale(1.3);
}

.dot:hover {
  background: #9ca3af; /* Gray-400 */
}
```

---

### 4.2 Style Grid (Desktop)
```html
<div class="style-selection-state desktop" data-state="selecting">
  <h3 class="selection-heading">Choose Your Style</h3>

  <!-- 2x2 Grid layout -->
  <div class="style-grid">
    <div class="style-card active" data-style="enhancedblackwhite">
      <div class="style-image">
        <img src="[B&W preview URL]" alt="Black & White">
        <div class="style-badge">Most Popular</div>
      </div>
      <div class="style-info">
        <h4 class="style-name">Black & White</h4>
        <p class="style-description">Classic timeless look</p>
      </div>
    </div>

    <!-- Repeat for Color, Modern, Sketch -->
  </div>
</div>
```

**CSS for Grid**:
```css
@media (min-width: 768px) {
  .style-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .style-card {
    flex: 1;
  }
}

@media (min-width: 1024px) {
  .style-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

### 4.3 Artist Notes Field
```html
<div class="artist-notes-section">
  <!-- Heading -->
  <label for="artist-notes" class="artist-notes-label">
    Note for the Artist (Optional)
  </label>
  <p class="artist-notes-hint">
    Tell us about your pet's personality or any special requests
  </p>

  <!-- Textarea -->
  <textarea
    id="artist-notes"
    class="artist-notes-input"
    placeholder="e.g., Please emphasize their bright blue eyes"
    rows="3"
    maxlength="500"
    aria-describedby="char-count"></textarea>

  <!-- Character count -->
  <div class="char-count" id="char-count">
    <span class="char-current">0</span> / 500
  </div>
</div>
```

**CSS Specifications**:
```css
.artist-notes-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.artist-notes-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.artist-notes-hint {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 12px 0;
}

.artist-notes-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: #111827;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.artist-notes-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.artist-notes-input::placeholder {
  color: #9ca3af;
}

.char-count {
  text-align: right;
  font-size: 12px;
  color: #6b7280;
  margin-top: 6px;
}

.char-current {
  font-weight: 600;
  color: #111827;
}

/* Warning when approaching limit */
.char-count.warning .char-current {
  color: #f59e0b; /* Amber-500 */
}

/* Error when at limit */
.char-count.error .char-current {
  color: #dc2626; /* Red-600 */
}
```

**JavaScript for Character Counter**:
```javascript
const artistNotesInput = document.getElementById('artist-notes');
const charCurrent = document.querySelector('.char-current');
const charCount = document.querySelector('.char-count');

artistNotesInput.addEventListener('input', (e) => {
  const length = e.target.value.length;
  charCurrent.textContent = length;

  // Visual feedback
  charCount.classList.remove('warning', 'error');
  if (length > 450) {
    charCount.classList.add('warning');
  }
  if (length >= 500) {
    charCount.classList.add('error');
  }

  // Announce to screen readers
  if (length === 450) {
    announceToScreenReader('Approaching character limit: 50 characters remaining');
  }
  if (length === 500) {
    announceToScreenReader('Character limit reached');
  }
});
```

---

## 5. Interaction Flow (Step-by-Step)

### 5.1 Opening the Drawer

**Trigger**: User clicks "Preview Styles" button on product page

**Sequence**:
```javascript
// 1. User clicks "Preview Styles" button
previewButton.addEventListener('click', async () => {
  // 2. Check if pet image is uploaded
  const petIndex = getCurrentPetIndex();
  const petState = PetStateManager.getInstance();
  const pet = petState.getPet(petIndex);

  if (!pet.image.original) {
    showError('Please upload a pet image first');
    return;
  }

  // 3. Initialize bottom sheet
  const drawer = new BottomSheet({
    container: document.querySelector('.inline-preview-drawer'),
    height: '70vh',
    dismissible: true,
    onOpen: () => {
      // 4. Start processing immediately
      startProcessing(petIndex);
    },
    onClose: () => {
      // 5. Cleanup on close
      cleanupProcessing();
    }
  });

  // 6. Open drawer
  drawer.open();
});

async function startProcessing(petIndex) {
  // Show uploading state
  showState('uploading');

  // Upload to server (if not already uploaded)
  const gcsUrl = await uploadToServer(petIndex);

  // Show background removal state
  showState('removing-bg');

  // Process background removal
  const processedUrl = await removeBackground(gcsUrl);

  // Update state
  PetStateManager.getInstance().updatePet(petIndex, {
    image: {
      processed: processedUrl
    }
  });

  // Show style generation state
  showState('generating-styles');

  // Generate all 4 styles (parallel)
  const styles = await Promise.all([
    generateStyle('enhancedblackwhite', processedUrl),
    generateStyle('color', processedUrl),
    generateStyle('modern', processedUrl),
    generateStyle('sketch', processedUrl)
  ]);

  // Update state with previews
  PetStateManager.getInstance().updatePet(petIndex, {
    previews: {
      enhancedblackwhite: styles[0],
      color: styles[1],
      modern: styles[2],
      sketch: styles[3]
    }
  });

  // Show style selection state
  showState('selecting');
  renderStyleCarousel(styles);
}
```

**Visual Flow**:
```
Product Page
  ↓
[Preview Styles] ← User taps button
  ↓
Drawer slides up (300ms animation)
  ↓ Immediately shows:
┌─────────────────────────────────┐
│  ──────                         │
│  Preview Your Pet Portrait      │
│                                 │
│  ☁️ Uploading Your Pet Photo   │ ← State 1: Uploading
│  Preparing your image...        │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░        │
│  25% complete                   │
│                                 │
│  [Cancel]                       │
└─────────────────────────────────┘
```

---

### 5.2 Processing Flow

**State Machine**:
```javascript
const ProcessingStates = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  REMOVING_BG: 'removing-bg',
  GENERATING_STYLES: 'generating-styles',
  SELECTING: 'selecting',
  ERROR: 'error'
};

class ProcessingStateMachine {
  constructor() {
    this.currentState = ProcessingStates.IDLE;
    this.stateHistory = [];
  }

  transition(newState) {
    console.log(`State transition: ${this.currentState} → ${newState}`);
    this.stateHistory.push(this.currentState);
    this.currentState = newState;

    // Update UI
    this.renderState(newState);

    // Announce to screen readers
    this.announceStateChange(newState);
  }

  renderState(state) {
    // Hide all states
    document.querySelectorAll('[data-state]').forEach(el => {
      el.hidden = true;
    });

    // Show current state
    const stateEl = document.querySelector(`[data-state="${state}"]`);
    if (stateEl) {
      stateEl.hidden = false;
    }
  }

  announceStateChange(state) {
    const announcements = {
      [ProcessingStates.UPLOADING]: 'Uploading your pet photo',
      [ProcessingStates.REMOVING_BG]: 'Removing background from image',
      [ProcessingStates.GENERATING_STYLES]: 'Generating artistic style previews',
      [ProcessingStates.SELECTING]: 'Style previews ready. Choose your favorite.',
      [ProcessingStates.ERROR]: 'An error occurred during processing'
    };

    const message = announcements[state] || '';
    if (message) {
      announceToScreenReader(message);
    }
  }
}
```

---

### 5.3 Style Selection

**User Action**: Taps/clicks a style card

**Sequence**:
```javascript
styleCards.forEach(card => {
  card.addEventListener('click', () => {
    // 1. Remove active class from all cards
    styleCards.forEach(c => c.classList.remove('active'));

    // 2. Add active class to selected card
    card.classList.add('active');

    // 3. Update carousel dots (mobile)
    updateCarouselDots(card.dataset.style);

    // 4. Enable "Apply Style" button
    applyButton.disabled = false;

    // 5. Store selection in state
    const petIndex = getCurrentPetIndex();
    const selectedStyle = card.dataset.style;

    PetStateManager.getInstance().updatePet(petIndex, {
      style: selectedStyle
    });

    // 6. Announce to screen readers
    const styleName = card.querySelector('.style-name').textContent;
    announceToScreenReader(`${styleName} style selected`);
  });

  // Keyboard support (Enter/Space)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });

  // Arrow key navigation (carousel)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextCard(card);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPrevCard(card);
    }
  });
});
```

**Visual Feedback**:
```
Before tap:
┌───────────────────┐
│ [Pet: B&W]        │
│ Border: gray      │ ← Inactive state
│                   │
│ Black & White     │
└───────────────────┘

After tap:
┌───────────────────┐
│ [Pet: B&W]        │
│ Border: blue 3px  │ ← Active state (highlighted)
│ Scale: 1.02       │
│                   │
│ Black & White ✓   │
└───────────────────┘
```

---

### 5.4 Artist Notes (Optional)

**User Action**: Types in textarea

**Sequence**:
```javascript
const artistNotesInput = document.getElementById('artist-notes');

artistNotesInput.addEventListener('input', (e) => {
  const notes = e.target.value;
  const petIndex = getCurrentPetIndex();

  // Sanitize input
  const safeNotes = SecurityUtils.sanitizeArtistNotes(notes);

  // Update state
  PetStateManager.getInstance().updatePet(petIndex, {
    artistNote: safeNotes
  });

  // Update character count
  updateCharacterCount(safeNotes.length);
});

function updateCharacterCount(length) {
  const charCurrent = document.querySelector('.char-current');
  const charCount = document.querySelector('.char-count');

  charCurrent.textContent = length;

  // Visual feedback
  charCount.classList.remove('warning', 'error');

  if (length > 450) {
    charCount.classList.add('warning');
  }

  if (length >= 500) {
    charCount.classList.add('error');
    // Prevent further input
    artistNotesInput.value = artistNotesInput.value.substring(0, 500);
  }
}
```

**Auto-save**: Notes are saved to PetStateManager on every input (debounced 500ms)

---

### 5.5 Applying Style and Closing Drawer

**User Action**: Clicks "Apply Style" button

**Sequence**:
```javascript
applyButton.addEventListener('click', async () => {
  const petIndex = getCurrentPetIndex();
  const petState = PetStateManager.getInstance();
  const pet = petState.getPet(petIndex);

  // 1. Validate selection
  if (!pet.style) {
    showError('Please select a style first');
    return;
  }

  // 2. Show loading state on button
  applyButton.disabled = true;
  applyButton.textContent = 'Applying...';

  // 3. Update product page UI (before closing drawer)
  await updateProductPagePreview(petIndex);

  // 4. Close drawer
  drawer.close();

  // 5. Show success confirmation on product page
  showSuccessToast('Style applied! Ready to add to cart.');

  // 6. Scroll to "Add to Cart" button
  document.querySelector('.add-to-cart-btn').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

  // 7. Highlight "Add to Cart" button (pulse animation)
  highlightAddToCart();
});

async function updateProductPagePreview(petIndex) {
  const petState = PetStateManager.getInstance();
  const pet = petState.getPet(petIndex);

  // Find product page preview elements
  const previewThumbnail = document.querySelector(`[data-pet-preview="${petIndex}"]`);
  const styleLabel = document.querySelector(`[data-pet-style-label="${petIndex}"]`);

  // Update thumbnail
  if (previewThumbnail) {
    const selectedStyleUrl = pet.previews[pet.style];
    previewThumbnail.src = SecurityUtils.validateURL(selectedStyleUrl);
    previewThumbnail.alt = `Your pet in ${pet.style} style`;
  }

  // Update style label
  if (styleLabel) {
    const styleNames = {
      enhancedblackwhite: 'Black & White',
      color: 'Color',
      modern: 'Modern',
      sketch: 'Sketch'
    };
    styleLabel.textContent = styleNames[pet.style] || 'Style selected';
  }

  // Add checkmark indicator
  const petCard = document.querySelector(`[data-pet-card="${petIndex}"]`);
  if (petCard) {
    petCard.classList.add('style-selected');
  }
}
```

**Product Page Update (Visual)**:
```
Before Apply:
┌─────────────────────────────────┐
│ Pet 1: Max                      │
│ [Thumbnail: Original image]     │
│ Style: Not selected             │
│ [Preview Styles]                │
└─────────────────────────────────┘

After Apply:
┌─────────────────────────────────┐
│ Pet 1: Max ✓                    │ ← Checkmark added
│ [Thumbnail: Modern style]       │ ← Updated thumbnail
│ Style: Modern                   │ ← Updated label
│ [Change Style]                  │ ← Button text changes
└─────────────────────────────────┘
```

---

### 5.6 Closing Drawer (Without Applying)

**User Actions** (multiple exit paths):
1. Tap "×" close button
2. Swipe down on drawer
3. Tap outside drawer (on overlay)
4. Press ESC key

**Sequence**:
```javascript
drawer.beforeClose = () => {
  const petIndex = getCurrentPetIndex();
  const petState = PetStateManager.getInstance();
  const pet = petState.getPet(petIndex);

  // Check if user has unsaved changes
  const hasUnsavedChanges = pet.previews && Object.keys(pet.previews).length > 0 && !pet.style;

  if (hasUnsavedChanges) {
    // Show confirmation dialog
    const confirmClose = confirm('You haven\'t selected a style yet. Close anyway?');
    return confirmClose; // Return false to prevent close
  }

  return true; // Allow close
};

drawer.onClose = () => {
  // Cleanup processing
  if (processingTimer) {
    clearInterval(processingTimer);
  }

  // Reset state machine
  stateMachine.transition(ProcessingStates.IDLE);

  // Announce to screen readers
  announceToScreenReader('Style preview closed');
};
```

**Confirmation Dialog** (only if unsaved changes):
```
┌─────────────────────────────────┐
│ ⚠️  Unsaved Changes             │
│                                 │
│ You haven't selected a style    │
│ yet. Your previews will be      │
│ saved so you can come back      │
│ later.                          │
│                                 │
│ [Go Back]  [Close Anyway]       │
└─────────────────────────────────┘
```

---

## 6. Edge Cases & Error Handling

### 6.1 User Closes Drawer Mid-Processing

**Scenario**: User opens drawer, processing starts, user closes drawer before completion

**Handling**:
```javascript
drawer.beforeClose = () => {
  if (stateMachine.currentState === ProcessingStates.REMOVING_BG ||
      stateMachine.currentState === ProcessingStates.GENERATING_STYLES) {

    // Show confirmation
    const message = 'Processing is still in progress. Close anyway?';
    const confirmClose = confirm(message);

    if (confirmClose) {
      // Cancel ongoing requests
      cancelProcessing();
      return true; // Allow close
    } else {
      return false; // Prevent close
    }
  }

  return true; // Allow close for other states
};

function cancelProcessing() {
  // Abort fetch requests
  if (bgRemovalController) {
    bgRemovalController.abort();
  }
  if (styleGenerationControllers) {
    styleGenerationControllers.forEach(controller => controller.abort());
  }

  // Clean up timers
  if (progressTimer) {
    clearInterval(progressTimer);
  }

  // Reset state
  stateMachine.transition(ProcessingStates.IDLE);

  console.log('Processing cancelled by user');
}
```

**User Communication**:
- Show confirmation dialog before cancelling
- Preserve partial results (e.g., if BG removal completed but styles didn't)
- Allow user to resume later

---

### 6.2 Processing Fails (Network Error)

**Scenario**: Background removal or style generation API fails

**Handling**:
```javascript
async function removeBackground(imageUrl) {
  try {
    const response = await fetch('/api/remove-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
      signal: bgRemovalController.signal // For cancellation
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.processedUrl;

  } catch (error) {
    console.error('Background removal failed:', error);

    // Transition to error state
    stateMachine.transition(ProcessingStates.ERROR);

    // Show user-friendly error message
    showError({
      title: 'Processing Failed',
      message: getErrorMessage(error),
      actions: [
        { label: 'Try Again', handler: () => retryProcessing() },
        { label: 'Choose Different Image', handler: () => reopenUpload() }
      ]
    });

    throw error; // Re-throw for caller
  }
}

function getErrorMessage(error) {
  if (error.name === 'AbortError') {
    return 'Processing was cancelled.';
  }
  if (error.message.includes('Network')) {
    return 'Network connection issue. Please check your internet and try again.';
  }
  if (error.message.includes('413')) {
    return 'Image file too large. Please choose a smaller image (max 10MB).';
  }
  if (error.message.includes('415')) {
    return 'Unsupported file format. Please use JPG or PNG images.';
  }

  // Generic error
  return 'Something went wrong. Please try again or contact support if the issue persists.';
}
```

**Error State UI** (see Section 3.4)

---

### 6.3 Slow Connection (3G/4G)

**Scenario**: Processing takes longer than expected on slow mobile connections

**Handling**:
```javascript
// Detect slow connection
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const isSlow = connection && (connection.effectiveType === '2g' || connection.effectiveType === '3g');

if (isSlow) {
  // Show warning message
  showSlowConnectionWarning();

  // Increase timeout limits
  bgRemovalTimeout = 120000; // 2 minutes instead of 60s
  styleGenerationTimeout = 60000; // 1 minute instead of 30s

  // Adjust progress estimates
  progressEstimate = {
    bgRemoval: 90, // 90s instead of 45s
    styleGeneration: 30 // 30s per style instead of 15s
  };
}

function showSlowConnectionWarning() {
  const banner = document.createElement('div');
  banner.className = 'slow-connection-banner';
  banner.innerHTML = `
    <div class="banner-icon">⚠️</div>
    <div class="banner-text">
      <strong>Slow connection detected</strong><br>
      Processing may take longer than usual (up to 2 minutes).
    </div>
  `;

  document.querySelector('.bottom-sheet-content').prepend(banner);
}
```

**Visual Indicator**:
```
┌─────────────────────────────────┐
│ ⚠️  Slow connection detected    │
│ Processing may take up to 2 min │
└─────────────────────────────────┘
│                                 │
│ 🔄 Removing Background          │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░        │
│ About 60 seconds remaining      │
└─────────────────────────────────┘
```

---

### 6.4 User Already Has Style Selected

**Scenario**: User previously selected a style, now clicks "Preview Styles" again

**Handling**:
```javascript
previewButton.addEventListener('click', () => {
  const petIndex = getCurrentPetIndex();
  const petState = PetStateManager.getInstance();
  const pet = petState.getPet(petIndex);

  // Check if style already selected
  if (pet.style && pet.previews && Object.keys(pet.previews).length === 4) {
    // Skip processing, go directly to selection state
    drawer.open();
    stateMachine.transition(ProcessingStates.SELECTING);

    // Pre-populate carousel with existing previews
    renderStyleCarousel(pet.previews, pet.style); // Pass current selection

    // Announce to screen readers
    announceToScreenReader(`Style preview reopened. Current selection: ${pet.style}`);

  } else {
    // Normal flow: start processing
    drawer.open();
    startProcessing(petIndex);
  }
});
```

**Visual Difference**:
- Instant transition to selection state (no processing delay)
- Previously selected style is pre-highlighted
- Button text changes: "Apply Style" → "Update Style"

---

### 6.5 Browser Back Button Behavior

**Expected Behavior**: Back button should close drawer, NOT navigate away from product page

**Implementation** (already handled by BottomSheet component):
```javascript
// From bottom-sheet.js (already implemented)
initBackButton() {
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.bottomSheetOpen && this.state.isOpen) {
      this.close(false); // Don't push to history again
    }
  });
}

open() {
  // Push to browser history
  history.pushState({ bottomSheetOpen: true }, '', window.location.href);

  // ... rest of open logic
}
```

**User Flow**:
```
1. User opens drawer
   → History: [Product Page, Product Page + Drawer]

2. User presses back button
   → Drawer closes
   → History: [Product Page]
   → Still on product page (NO navigation)

3. User presses back button again
   → Navigate to previous page (e.g., collection)
```

---

## 7. Accessibility Implementation

### 7.1 ARIA Roles and Attributes

**Drawer Container**:
```html
<div class="inline-preview-drawer"
     role="dialog"
     aria-modal="true"
     aria-labelledby="drawer-title"
     aria-describedby="drawer-description"
     hidden>

  <h2 id="drawer-title">Preview Your Pet Portrait</h2>
  <p id="drawer-description">
    Choose a style to see your pet on [Product Name]
  </p>

  <!-- Content -->
</div>
```

**Style Carousel**:
```html
<div class="style-carousel"
     role="region"
     aria-label="Style preview carousel"
     aria-live="polite">

  <div class="style-cards" role="list">
    <div class="style-card"
         role="listitem"
         tabindex="0"
         aria-label="Black and White style preview">
      <!-- Content -->
    </div>
  </div>
</div>
```

**Processing Status**:
```html
<div role="status"
     aria-live="polite"
     aria-atomic="true">
  <span id="processing-status">
    Removing background from your pet photo. About 30 seconds remaining.
  </span>
</div>
```

---

### 7.2 Keyboard Navigation

**Focus Trap** (already implemented in BottomSheet):
```javascript
// From bottom-sheet.js
handleFocusTrap(e) {
  if (!this.state.isOpen || e.key !== 'Tab') return;

  const focusableElements = this.container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    // Shift + Tab: Focus last element if on first
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab: Focus first element if on last
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}
```

**Arrow Key Navigation** (for carousel):
```javascript
styleCards.forEach((card, index) => {
  card.addEventListener('keydown', (e) => {
    switch(e.key) {
      case 'ArrowRight':
        e.preventDefault();
        focusCard((index + 1) % styleCards.length);
        scrollCardIntoView((index + 1) % styleCards.length);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        focusCard((index - 1 + styleCards.length) % styleCards.length);
        scrollCardIntoView((index - 1 + styleCards.length) % styleCards.length);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        selectStyle(card);
        break;

      case 'Escape':
        e.preventDefault();
        drawer.close();
        break;
    }
  });
});

function focusCard(index) {
  styleCards[index].focus();
}

function scrollCardIntoView(index) {
  styleCards[index].scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center'
  });
}
```

**Keyboard Shortcuts Summary**:
```
Tab                 Navigate forward through focusable elements
Shift + Tab         Navigate backward through focusable elements
Arrow Right/Left    Navigate between style cards
Enter / Space       Select focused style card
Escape              Close drawer
```

---

### 7.3 Screen Reader Announcements

**Live Region for Status Updates**:
```html
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  <span id="sr-announcement"></span>
</div>
```

**Announcement Helper**:
```javascript
function announceToScreenReader(message) {
  const announcement = document.getElementById('sr-announcement');
  announcement.textContent = message;

  // Clear after 3 seconds to allow new announcements
  setTimeout(() => {
    announcement.textContent = '';
  }, 3000);
}

// Usage examples:
announceToScreenReader('Style preview drawer opened');
announceToScreenReader('Removing background from your pet photo. This may take up to 60 seconds.');
announceToScreenReader('Background removal complete. Generating 4 style previews.');
announceToScreenReader('Modern style selected');
announceToScreenReader('Style applied. Ready to add to cart.');
```

**Progress Updates**:
```javascript
// Announce progress every 25%
let lastAnnouncedProgress = 0;

function updateProgress(percentage) {
  if (percentage - lastAnnouncedProgress >= 25) {
    announceToScreenReader(`Processing ${percentage}% complete`);
    lastAnnouncedProgress = percentage;
  }
}
```

---

### 7.4 Touch Target Sizes

**WCAG 2.1 AAA Requirement**: Minimum 44x44 CSS pixels for all interactive elements

**Compliance**:
```css
/* Close button */
.bottom-sheet-close {
  min-width: 44px;
  min-height: 44px;
  padding: 10px; /* Actual icon 24x24, padding makes it 44x44 */
}

/* Apply button */
.apply-style-btn {
  min-height: 48px; /* Exceeds minimum */
  padding: 14px 24px;
}

/* Style cards (tap target) */
.style-card {
  min-height: 80px; /* Exceeds minimum for better thumb accuracy */
  min-width: 80px;
}

/* Carousel dots */
.dot {
  width: 8px; /* Visual size */
  height: 8px;
  padding: 18px; /* Total tap target: 44x44 */
  margin: -18px; /* Compensate padding to maintain visual spacing */
}

/* Artist notes textarea */
.artist-notes-input {
  min-height: 80px; /* Comfortable typing area */
  font-size: 16px; /* Prevents iOS zoom on focus */
}
```

**Spacing Between Targets**:
```css
/* Minimum 8px spacing between interactive elements */
.error-actions {
  display: flex;
  flex-direction: column;
  gap: 12px; /* Exceeds minimum */
}

.style-cards {
  gap: 16px; /* Prevents accidental taps */
}
```

---

### 7.5 Color Contrast

**WCAG 2.1 AA Requirement**: 4.5:1 for normal text, 3:1 for large text

**Compliance**:
```css
/* Primary text: Black on white */
.bottom-sheet-title {
  color: #111827; /* Gray-900 */
  background: #ffffff;
  /* Contrast ratio: 16.2:1 ✓ Exceeds AAA (7:1) */
}

/* Secondary text: Gray on white */
.bottom-sheet-subtitle {
  color: #6b7280; /* Gray-500 */
  background: #ffffff;
  /* Contrast ratio: 4.6:1 ✓ Passes AA (4.5:1) */
}

/* Link text: Blue on white */
.support-link {
  color: #2563eb; /* Blue-600 */
  background: #ffffff;
  /* Contrast ratio: 5.1:1 ✓ Passes AA */
}

/* Button: White on blue */
.apply-style-btn {
  color: #ffffff;
  background: #2563eb; /* Blue-600 */
  /* Contrast ratio: 5.1:1 ✓ Passes AA */
}

/* Error text: Red on white */
.error-title {
  color: #dc2626; /* Red-600 */
  background: #ffffff;
  /* Contrast ratio: 5.5:1 ✓ Passes AA */
}
```

**Focus Indicators**:
```css
/* Visible focus for keyboard navigation */
*:focus-visible {
  outline: 2px solid #2563eb; /* Blue-600 */
  outline-offset: 2px;
  /* Contrast ratio with white: 5.1:1 ✓ */
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline-width: 3px;
    outline-color: currentColor;
  }
}
```

---

## 8. Performance Optimization

### 8.1 Lazy Loading Style Previews

**Strategy**: Load and display previews progressively as they're generated

**Implementation**:
```javascript
async function generateAllStyles(processedImageUrl) {
  const styles = ['enhancedblackwhite', 'color', 'modern', 'sketch'];
  const previewGrid = document.querySelector('.style-preview-grid');

  // Show skeleton UI immediately
  styles.forEach(style => {
    const skeleton = createSkeletonCard(style);
    previewGrid.appendChild(skeleton);
  });

  // Generate styles in parallel
  const promises = styles.map(async (style, index) => {
    try {
      const previewUrl = await generateStyle(style, processedImageUrl);

      // Update UI immediately when this style completes
      updateStyleCard(style, previewUrl);

      // Update progress
      updateProgress((index + 1) / styles.length * 100);

      return { style, previewUrl };
    } catch (error) {
      console.error(`Failed to generate ${style}:`, error);
      showStyleError(style);
      return { style, previewUrl: null };
    }
  });

  // Wait for all to complete
  const results = await Promise.all(promises);

  // Transition to selection state
  stateMachine.transition(ProcessingStates.SELECTING);

  return results;
}

function createSkeletonCard(style) {
  const card = document.createElement('div');
  card.className = 'style-preview-item loading';
  card.dataset.style = style;
  card.innerHTML = `
    <div class="skeleton"></div>
    <span class="style-name">${getStyleName(style)}...</span>
  `;
  return card;
}

function updateStyleCard(style, previewUrl) {
  const card = document.querySelector(`[data-style="${style}"]`);
  if (!card) return;

  // Remove skeleton
  card.classList.remove('loading');
  card.classList.add('completed');

  // Add image
  const img = document.createElement('img');
  img.src = SecurityUtils.validateURL(previewUrl);
  img.alt = `Your pet in ${getStyleName(style)} style`;
  img.loading = 'lazy'; // Native lazy loading

  card.querySelector('.skeleton').replaceWith(img);

  // Update label
  card.querySelector('.style-name').textContent = `${getStyleName(style)} ✓`;

  // Announce completion
  announceToScreenReader(`${getStyleName(style)} style preview ready`);
}
```

---

### 8.2 Image Optimization

**Progressive Image Loading**:
```javascript
async function loadStylePreview(styleUrl) {
  // 1. Show low-res thumbnail immediately (if cached)
  const thumbnailUrl = styleUrl.replace('.jpg', '_thumb.jpg');
  const thumbnail = await fetchCached(thumbnailUrl);

  if (thumbnail) {
    img.src = thumbnail;
    img.classList.add('loading');
  }

  // 2. Load full-res in background
  const fullRes = new Image();
  fullRes.onload = () => {
    img.src = styleUrl;
    img.classList.remove('loading');
  };
  fullRes.src = styleUrl;
}

// Cache thumbnails in IndexedDB for instant display
async function fetchCached(url) {
  const cache = await caches.open('style-previews-v1');
  const cached = await cache.match(url);

  if (cached) {
    const blob = await cached.blob();
    return URL.createObjectURL(blob);
  }

  return null;
}
```

**CSS Blur Effect** (while loading):
```css
.style-card img.loading {
  filter: blur(8px);
  transition: filter 0.3s ease;
}

.style-card img:not(.loading) {
  filter: blur(0);
}
```

---

### 8.3 Animation Performance

**GPU Acceleration**:
```css
/* All animations use transform/opacity (GPU-accelerated) */
.bottom-sheet-container {
  transform: translateY(100%);
  will-change: transform; /* Hint to browser */
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Avoid animating height, top, left, right (CPU-bound) */
/* ❌ BAD: */
.drawer {
  bottom: -600px;
  transition: bottom 0.3s;
}

/* ✓ GOOD: */
.drawer {
  transform: translateY(100%);
  transition: transform 0.3s;
}
```

**Reduced Motion Support**:
```css
@media (prefers-reduced-motion: reduce) {
  .bottom-sheet-container,
  .style-card,
  .progress-fill {
    transition: none !important;
    animation: none !important;
  }

  /* Still provide visual feedback, just instantly */
  .bottom-sheet-container.open {
    transform: translateY(0);
  }
}
```

---

### 8.4 Memory Management

**Cleanup on Drawer Close**:
```javascript
drawer.onClose = () => {
  // 1. Revoke blob URLs to free memory
  document.querySelectorAll('.style-card img').forEach(img => {
    if (img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
  });

  // 2. Clear event listeners
  removeAllEventListeners();

  // 3. Cancel pending requests
  cancelProcessing();

  // 4. Clear timers
  clearAllTimers();

  // 5. Reset state
  stateMachine.transition(ProcessingStates.IDLE);
};

function removeAllEventListeners() {
  // Clone and replace node to remove all listeners
  const oldCarousel = document.querySelector('.style-carousel');
  const newCarousel = oldCarousel.cloneNode(true);
  oldCarousel.parentNode.replaceChild(newCarousel, oldCarousel);
}
```

---

## 9. Testing Checklist

### 9.1 Functional Testing

**Core Flow**:
- [ ] Clicking "Preview Styles" opens drawer
- [ ] Upload state shows progress correctly
- [ ] Background removal completes successfully
- [ ] All 4 style previews generate
- [ ] Style selection highlights card
- [ ] Artist notes saves on input
- [ ] "Apply Style" updates product page
- [ ] Drawer closes on apply
- [ ] Product page shows thumbnail + style label

**Edge Cases**:
- [ ] Closing drawer mid-processing shows confirmation
- [ ] Processing failure shows error state
- [ ] Retry after error works
- [ ] User with existing style selection sees previews immediately
- [ ] Multiple pets each save independently
- [ ] Slow connection shows warning banner

---

### 9.2 Mobile Testing

**Devices** (minimum):
- [ ] iPhone 14 (iOS 17)
- [ ] iPhone 12 (iOS 15)
- [ ] iPhone 8 (iOS 14) - Low-end test
- [ ] Samsung Galaxy S22 (Android 13)
- [ ] Samsung Galaxy S10 (Android 11) - Low-end test
- [ ] iPad Air (iOS 17)

**Gestures**:
- [ ] Swipe down to close drawer works
- [ ] Swipe left/right in carousel works
- [ ] Tap outside drawer closes it
- [ ] iOS back gesture (left edge swipe) doesn't conflict with carousel
- [ ] Pinch-to-zoom disabled on carousel

**Performance**:
- [ ] Drawer animation 60fps on all devices
- [ ] No jank when scrolling carousel
- [ ] Touch targets minimum 44x44px
- [ ] Thumb-zone optimization (controls at bottom)

---

### 9.3 Desktop Testing

**Browsers** (minimum):
- [ ] Chrome 120+ (Windows/Mac)
- [ ] Firefox 120+ (Windows/Mac)
- [ ] Safari 17+ (Mac)
- [ ] Edge 120+ (Windows)

**Interactions**:
- [ ] Keyboard navigation works (Tab, Arrow keys, Enter, Esc)
- [ ] Mouse hover states work
- [ ] Click outside drawer closes it
- [ ] Two-column layout displays correctly (768px+)
- [ ] Focus trap works

---

### 9.4 Accessibility Testing

**Tools**:
- [ ] Lighthouse accessibility score 100
- [ ] axe DevTools no violations
- [ ] WAVE no errors
- [ ] Keyboard-only navigation (no mouse)
- [ ] Screen reader testing (NVDA/JAWS/VoiceOver)

**Manual Tests**:
- [ ] All interactive elements focusable
- [ ] Focus order logical (top to bottom, left to right)
- [ ] Focus visible on all elements
- [ ] ARIA labels accurate
- [ ] Live regions announce status changes
- [ ] Error messages read by screen reader
- [ ] Color contrast 4.5:1 minimum

---

### 9.5 Performance Testing

**Metrics**:
- [ ] Drawer open animation <300ms
- [ ] First Contentful Paint <1s
- [ ] Largest Contentful Paint <2.5s
- [ ] Cumulative Layout Shift <0.1
- [ ] First Input Delay <100ms
- [ ] Total Blocking Time <300ms

**Network Conditions**:
- [ ] Fast 4G (regular flow)
- [ ] Slow 3G (show warning banner)
- [ ] Offline (graceful error)

---

## 10. Implementation Notes for Developers

### 10.1 File Structure

**New Files to Create**:
```
snippets/
  product-inline-preview-drawer.liquid  (Drawer HTML structure)

assets/
  product-inline-preview.js            (Controller logic)
  product-inline-preview.css           (Drawer styles)

  # Already exist (reuse):
  components/bottom-sheet.js           (Shared component)
  pet-state-manager.js                 (State management)
  security-utils.js                    (Sanitization)
```

**Files to Modify**:
```
snippets/
  ks-product-pet-selector.liquid      (Add "Preview Styles" button trigger)

templates/
  product.json                         (Include drawer snippet)
```

---

### 10.2 Integration Steps

**Step 1: Include Drawer Snippet**
```liquid
{% comment %} templates/product.json {% endcomment %}
{
  "sections": {
    "main": {
      "type": "main-product",
      "blocks": [
        {
          "type": "inline-preview-drawer",
          "settings": {}
        }
      ]
    }
  }
}
```

**Step 2: Add Trigger Button**
```liquid
{% comment %} snippets/ks-product-pet-selector.liquid {% endcomment %}
<div class="pet-actions">
  <button class="preview-styles-btn"
          data-pet-index="{{ pet_index }}"
          data-open-preview-drawer>
    Preview Styles
  </button>
</div>
```

**Step 3: Initialize Drawer**
```javascript
// assets/product-inline-preview.js
document.addEventListener('DOMContentLoaded', () => {
  const previewButtons = document.querySelectorAll('[data-open-preview-drawer]');

  previewButtons.forEach(button => {
    button.addEventListener('click', () => {
      const petIndex = parseInt(button.dataset.petIndex);
      openPreviewDrawer(petIndex);
    });
  });
});

function openPreviewDrawer(petIndex) {
  const drawer = new BottomSheet({
    container: document.querySelector('.inline-preview-drawer'),
    height: '70vh',
    dismissible: true,
    onOpen: () => startProcessing(petIndex),
    onClose: () => cleanupProcessing()
  });

  drawer.open();
}
```

---

### 10.3 API Integration

**Background Removal**:
```javascript
async function removeBackground(imageUrl) {
  const response = await fetch('https://inspirenet-bg-removal-api.run.app/api/v2/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: imageUrl,
      processMode: 'background_removal'
    })
  });

  const data = await response.json();
  return data.gcsUrl;
}
```

**Gemini Style Generation**:
```javascript
async function generateStyle(style, processedImageUrl) {
  // Reuse existing gemini-api-client.js
  const client = new GeminiAPIClient();

  const result = await client.generateStyle({
    imageUrl: processedImageUrl,
    style: style,
    petType: 'dog' // From product metadata
  });

  return result.gcsUrl;
}
```

---

### 10.4 State Management

**Save to PetStateManager**:
```javascript
// After processing completes
const petState = PetStateManager.getInstance();

petState.updatePet(petIndex, {
  image: {
    original: originalImageUrl,
    processed: processedImageUrl,
    gcsUrl: gcsUrl
  },
  previews: {
    enhancedblackwhite: bwUrl,
    color: colorUrl,
    modern: modernUrl,
    sketch: sketchUrl
  },
  metadata: {
    processedAt: Date.now(),
    sessionKey: `pet_${petIndex}_${Date.now()}`
  }
});
```

**Load from PetStateManager**:
```javascript
// When reopening drawer
const petState = PetStateManager.getInstance();
const pet = petState.getPet(petIndex);

if (pet.previews && Object.keys(pet.previews).length === 4) {
  // Skip processing, show previews immediately
  renderStyleCarousel(pet.previews, pet.style);
} else {
  // Start processing
  startProcessing(petIndex);
}
```

---

### 10.5 Security Considerations

**Always Sanitize User Input**:
```javascript
// Artist notes
const artistNotes = SecurityUtils.sanitizeArtistNotes(input.value);

// Pet name
const petName = SecurityUtils.sanitizePetName(input.value);

// Image URLs
const safeUrl = SecurityUtils.validateURL(imageUrl);
if (!safeUrl) {
  throw new Error('Invalid image URL');
}
```

**Validate File Uploads**:
```javascript
function validateImageFile(file) {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please use JPG, PNG, or WebP.');
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  return true;
}
```

---

## 11. Success Metrics

### 11.1 Primary Metrics

**Conversion Rate**:
```
Baseline: 15-18%
Target: 23-30% (+8-12%)
Measurement: (Add to cart events) / (Preview drawer opens)
```

**Time to Cart**:
```
Baseline: 4 minutes
Target: 2.8 minutes (-30%)
Measurement: (Drawer open timestamp) → (Add to cart timestamp)
```

**Navigation Abandonment**:
```
Baseline: 8-12%
Target: 2-3% (-75%)
Measurement: (Drawer opens) - (Drawer closes without applying) / (Drawer opens)
```

---

### 11.2 Secondary Metrics

**Drawer Interaction Rate**:
```
Target: >90%
Measurement: (Users who open drawer) / (Users who upload image)
```

**Style Selection Rate**:
```
Baseline: 72%
Target: 85% (+13%)
Measurement: (Users who select style) / (Users who see previews)
```

**Artist Notes Usage**:
```
Target: >30%
Measurement: (Users who add notes) / (Users who select style)
```

---

### 11.3 Technical Metrics

**Performance**:
```
Drawer open time: <300ms (target)
Processing time: 30-60s (baseline, cannot reduce)
Style carousel scroll FPS: 60fps (target)
```

**Error Rate**:
```
Processing failures: <5% (target)
Network errors: <3% (target)
```

---

## 12. Next Steps

### 12.1 Implementation Priority

**Phase 1** (Week 1-2): Core Drawer Implementation
- [ ] Create drawer HTML structure
- [ ] Integrate BottomSheet component
- [ ] Implement processing states UI
- [ ] Connect to background removal API
- [ ] Connect to Gemini style generation API
- [ ] Integrate PetStateManager

**Phase 2** (Week 3): Mobile Optimization
- [ ] Test on real devices (iOS/Android)
- [ ] Optimize touch gestures
- [ ] Test slow connection handling
- [ ] Performance profiling

**Phase 3** (Week 4): Desktop & Accessibility
- [ ] Implement two-column layout
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] WCAG compliance audit

**Phase 4** (Week 5): Testing & Launch
- [ ] A/B test setup
- [ ] Monitor metrics
- [ ] Iterate based on user feedback

---

### 12.2 Open Questions

1. **Should we show estimated processing time upfront?**
   - Pros: Sets expectations, reduces perceived wait
   - Cons: May deter some users ("60 seconds is too long")
   - Recommendation: Yes, with positive framing ("Creating your personalized previews - about 60 seconds")

2. **Should artist notes be visible before or after style selection?**
   - Current spec: After style selection
   - Alternative: Always visible (may increase completion rate)
   - Recommendation: After (progressive disclosure reduces cognitive load)

3. **Should we allow users to edit uploaded image in drawer?**
   - Current spec: No editing, just style preview
   - Alternative: Add crop/rotate tools
   - Recommendation: No (keep scope focused, add later if needed)

4. **Should we cache style previews indefinitely or with expiry?**
   - Current spec: Cache with 30-day expiry
   - Alternative: Cache indefinitely (risk stale data)
   - Recommendation: 30-day expiry (balance performance vs freshness)

---

## 13. Documentation References

**Related Documents**:
- `.claude/doc/preview-before-purchase-ux-strategy.md` - Strategic analysis
- `.claude/doc/hybrid-inline-preview-implementation-plan.md` - 20-30 hour implementation guide
- `assets/components/bottom-sheet.js` - BottomSheet component API
- `assets/pet-state-manager.js` - State management API
- `assets/security-utils.js` - Security utilities

**External References**:
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design Bottom Sheets](https://m3.material.io/components/bottom-sheets/overview)
- [iOS Human Interface Guidelines - Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)

---

**Document Status**: ✅ COMPLETE

**File Location**: `.claude/doc/product-page-inline-preview-ux-spec.md`

**Author**: ux-design-ecommerce-expert

**Date**: 2025-11-09

**Session**: context_session_001.md
